'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useDb } from '@/hooks/useDb';
import { useToast } from '@/components/ToastProvider';
import { SkeletonList } from '@/components/Skeleton';
import { League, Player, Round, RoundPoints, Rules } from '@/types/database';
import { downloadCsv, safeFileName } from '@/lib/clientExport';
import { Trophy, Medal, ChevronLeft, Users, ArrowUp, ArrowDown, Minus, Filter, Activity, Download } from 'lucide-react';

type RankingEntry = {
  player: Player;
  points: number;
  previousPoints: number;
  pointsDelta: number;
  history: number[];
  position: number;
  previousPosition: number | null;
  movement: number | null;
  isTied: boolean;
};

type RankingSnapshot = {
  entries: RankingEntry[];
  topScore: number;
  selectedRounds: Round[];
};

export default function LeagueRankingPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user, locale } = useAuth();
  const { db, run } = useDb();
  const toast = useToast();
  const router = useRouter();
  const isEs = locale === 'es';
  const isPt = locale === 'pt';

  const [league, setLeague] = useState<League | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [closedRounds, setClosedRounds] = useState<Round[]>([]);
  const [roundPoints, setRoundPoints] = useState<RoundPoints[]>([]);
  const [rules, setRules] = useState<Rules | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<'all' | string>('all');
  const [compareRoundId, setCompareRoundId] = useState<'prev' | 'none' | string>('prev');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) load();
  }, [user, leagueId]);

  const load = async () => {
    setLoading(true);

    const [
      { data: leagueData },
      { data: playerData },
      { data: roundData },
      { data: rulesData },
    ] = await Promise.all([
      run(() => db.from('leagues').select('*').eq('id', leagueId).single()),
      run(() => db.from('league_roster').select('*').eq('league_id', leagueId).order('full_name')),
      run(() => db.from('rounds').select('*').eq('league_id', leagueId).eq('status', 'closed').order('number')),
      run(() => db.from('rules').select('*').or(`scope.eq.global,league_id.eq.${leagueId}`).order('scope', { ascending: false }).limit(1)),
    ]);

    const rounds = (roundData as Round[]) || [];
    const roundIds = rounds.map((round) => round.id);
    const { data: pointsData } = roundIds.length > 0
      ? await run(() => db.from('round_points').select('*').in('round_id', roundIds))
      : { data: [] };

    setLeague((leagueData as League) || null);
    setPlayers((playerData as Player[]) || []);
    setClosedRounds(rounds);
    setRoundPoints((pointsData as RoundPoints[]) || []);
    setRules(((rulesData as Rules[]) || [])[0] || null);
    setLoading(false);
  };

  const rankingData = useMemo((): { snapshot: RankingSnapshot; comparedRound: Round | null } => {
    const roundsOrdered = [...closedRounds].sort((a, b) => a.number - b.number);
    const targetIndex = selectedRoundId === 'all'
      ? roundsOrdered.length - 1
      : roundsOrdered.findIndex((round) => round.id === selectedRoundId);

    if (targetIndex < 0) {
      return { snapshot: { entries: [], topScore: 0, selectedRounds: [] }, comparedRound: null };
    }

    const selectedRounds = roundsOrdered.slice(0, targetIndex + 1);
    const selectedIds = new Set(selectedRounds.map((round) => round.id));

    let comparisonRounds: Round[] = [];
    if (compareRoundId === 'none') {
      comparisonRounds = [];
    } else if (compareRoundId === 'prev') {
      comparisonRounds = roundsOrdered.slice(0, targetIndex);
    } else {
      const compareIndex = roundsOrdered.findIndex((round) => round.id === compareRoundId);
      comparisonRounds = compareIndex >= 0 ? roundsOrdered.slice(0, compareIndex + 1) : [];
    }

    const comparisonIds = new Set(comparisonRounds.map((round) => round.id));

    const selectedTotals = new Map<string, number>();
    const comparisonTotals = new Map<string, number>();
    const pointsByRound = new Map<string, Map<string, number>>();

    roundPoints.forEach((entry) => {
      if (selectedIds.has(entry.round_id)) {
        selectedTotals.set(entry.player_id, (selectedTotals.get(entry.player_id) || 0) + entry.points);
        const roundBucket = pointsByRound.get(entry.round_id) || new Map<string, number>();
        roundBucket.set(entry.player_id, (roundBucket.get(entry.player_id) || 0) + entry.points);
        pointsByRound.set(entry.round_id, roundBucket);
      }
      if (comparisonIds.has(entry.round_id)) {
        comparisonTotals.set(entry.player_id, (comparisonTotals.get(entry.player_id) || 0) + entry.points);
      }
    });

    const previousRanking = players
      .filter((player) => comparisonTotals.has(player.id))
      .map((player) => ({
        playerId: player.id,
        points: comparisonTotals.get(player.id) || 0,
        name: player.full_name,
      }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
      .reduce<Map<string, number>>((acc, entry, index) => {
        acc.set(entry.playerId, index + 1);
        return acc;
      }, new Map());

    const entries = players
      .filter((player) => selectedTotals.has(player.id))
      .map((player) => {
        const points = selectedTotals.get(player.id) || 0;
        const previousPoints = comparisonTotals.get(player.id) || 0;
        let running = 0;
        const history = selectedRounds.map((round) => {
          running += pointsByRound.get(round.id)?.get(player.id) || 0;
          return running;
        });
        return {
          player,
          points,
          previousPoints,
          history,
        };
      })
      .sort((a, b) => b.points - a.points || a.player.full_name.localeCompare(b.player.full_name))
      .map((entry, index) => {
        const position = index + 1;
        const previousPosition = previousRanking.get(entry.player.id) || null;
        return {
          player: entry.player,
          points: entry.points,
          previousPoints: entry.previousPoints,
          pointsDelta: entry.points - entry.previousPoints,
          history: entry.history,
          position,
          previousPosition,
          movement: previousPosition ? previousPosition - position : null,
          isTied: false,
        };
      });

    const entriesWithTies = entries.map((entry, index, list) => ({
      ...entry,
      isTied: (list[index - 1]?.points === entry.points) || (list[index + 1]?.points === entry.points),
    }));

    let comparedRound: Round | null = null;
    if (comparisonRounds.length > 0) {
      comparedRound = comparisonRounds[comparisonRounds.length - 1];
    }

    return {
      snapshot: {
        entries: entriesWithTies,
        topScore: entriesWithTies[0]?.points || 0,
        selectedRounds,
      },
      comparedRound,
    };
  }, [closedRounds, players, roundPoints, selectedRoundId, compareRoundId]);

  const entries = rankingData.snapshot.entries;
  const topScore = rankingData.snapshot.topScore;
  const selectedRounds = rankingData.snapshot.selectedRounds;
  const podium = entries.slice(0, 3);
  const remaining = entries.slice(3);
  const activePlayers = players.filter((player) => player.is_active).length;
  const inactiveInRanking = entries.filter((entry) => !entry.player.is_active).length;
  const comparedRound = rankingData.comparedRound;
  const selectedRound = selectedRoundId === 'all'
    ? closedRounds[closedRounds.length - 1] || null
    : closedRounds.find((round) => round.id === selectedRoundId) || null;

  const exportRanking = () => {
    if (entries.length === 0) {
      toast.warning(isPt ? 'Nao ha ranking para exportar' : isEs ? 'No hay ranking para exportar' : 'No ranking to export');
      return;
    }

    const headers = [
      isPt ? 'Posicao' : isEs ? 'Posicion' : 'Position',
      isPt ? 'Jogadora' : isEs ? 'Jugadora' : 'Player',
      isPt ? 'Pontos' : isEs ? 'Puntos' : 'Points',
      isPt ? 'Delta' : isEs ? 'Delta' : 'Delta',
      isPt ? 'Movimento' : isEs ? 'Movimiento' : 'Movement',
      isPt ? 'Status' : isEs ? 'Estado' : 'Status',
    ];

    const rows = entries.map((entry) => [
      entry.position,
      entry.player.full_name,
      entry.points,
      entry.pointsDelta,
      entry.movement ?? (isPt ? 'novo' : isEs ? 'nuevo' : 'new'),
      entry.player.is_active ? (isPt ? 'Ativa' : isEs ? 'Activa' : 'Active') : (isPt ? 'Inativa' : isEs ? 'Inactiva' : 'Inactive'),
    ]);

    downloadCsv(
      `${safeFileName(`${league?.name || 'ranking'}-ranking`)}.csv`,
      headers,
      rows
    );

    toast.success(isPt ? 'Ranking exportado.' : isEs ? 'Ranking exportado.' : 'Ranking exported.');
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-[2rem] border border-white/70 bg-white/85 p-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)] sm:p-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-neutral-200 animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-32 rounded-full bg-neutral-200 animate-pulse" />
              <div className="h-3 w-52 rounded-full bg-neutral-100 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="card p-5 sm:p-6">
          <SkeletonList count={6} lines={1} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(20,184,166,0.14),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-4 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.42)] sm:p-6">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
          <button
            onClick={() => router.push(`/app/leagues/${leagueId}/rounds`)}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/80 text-neutral-500 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.28)] transition hover:text-neutral-800"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
              {isPt ? 'Classificacao ao vivo' : isEs ? 'Clasificacion en vivo' : 'Live standings'}
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.03em] text-neutral-950 sm:text-4xl">
              Ranking
            </h1>
            <p className="mt-2 text-sm leading-6 text-neutral-600 sm:text-[15px]">
              {league?.name || ''}{league?.name ? ' - ' : ''}{isPt ? 'Comparacao entre cortes, delta de pontos e zonas competitivas.' : isEs ? 'Comparacion entre cortes, delta de puntos y zonas competitivas.' : 'Scope comparison, point deltas, and competitive zones.'}
            </p>
          </div>
          </div>
          <button
            onClick={exportRanking}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white/80 px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-white sm:w-auto"
          >
            <Download size={16} />
            {isPt ? 'Exportar CSV' : isEs ? 'Exportar CSV' : 'Export CSV'}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <MetricCard
          label={isPt ? 'Ranqueadas' : isEs ? 'Rankeadas' : 'Ranked'}
          value={entries.length}
          detail={isPt ? 'no recorte atual' : isEs ? 'en el recorte actual' : 'in current scope'}
          tone="amber"
        />
        <MetricCard
          label={isPt ? 'Ativas' : isEs ? 'Activas' : 'Active'}
          value={activePlayers}
          detail={isPt ? 'na base atual' : isEs ? 'en la base actual' : 'in current roster'}
          tone="teal"
        />
        <MetricCard
          label={isPt ? 'Inativas no ranking' : isEs ? 'Inactivas en ranking' : 'Inactive in ranking'}
          value={inactiveInRanking}
          detail={isPt ? 'pontuam, mas ficam sinalizadas' : isEs ? 'puntuan, pero quedan marcadas' : 'scored, but visually marked'}
          tone="neutral"
        />
        <MetricCard
          label={isPt ? 'Lider' : isEs ? 'Lider' : 'Leader'}
          value={topScore}
          detail={isPt ? 'maior pontuacao' : isEs ? 'mayor puntuacion' : 'highest points'}
          tone="amber"
        />
      </div>

      {closedRounds.length > 0 && (
        <div className="card p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
            {isPt ? 'Linha do tempo' : isEs ? 'Linea de tiempo' : 'Timeline'}
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {closedRounds.map((round) => {
              const isInsideScope = selectedRounds.some((item) => item.id === round.id);
              const isBaseline = comparedRound?.id === round.id;
              return (
                <div
                  key={round.id}
                  className={`flex-shrink-0 rounded-2xl px-3 py-2 text-xs font-semibold ${
                    isBaseline
                      ? 'bg-amber-500/12 text-amber-700 ring-1 ring-amber-500/10'
                      : isInsideScope
                        ? 'bg-teal-500/12 text-teal-700 ring-1 ring-teal-500/10'
                        : 'bg-neutral-900/5 text-neutral-500 ring-1 ring-neutral-900/6'
                  }`}
                >
                  {isPt ? `R${round.number}` : isEs ? `J${round.number}` : `R${round.number}`}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
              {isPt ? 'Ranking ate' : isEs ? 'Ranking hasta' : 'Ranking through'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Filter size={16} className="text-neutral-400" />
              <select
                value={selectedRoundId}
                onChange={(event) => {
                  const value = event.target.value as 'all' | string;
                  setSelectedRoundId(value);
                  setCompareRoundId('prev');
                }}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700"
              >
                <option value="all">{isPt ? 'Ranking completo' : isEs ? 'Ranking completo' : 'Full ranking'}</option>
                {closedRounds.map((round) => (
                  <option key={round.id} value={round.id}>
                    {isPt ? `Ate rodada ${round.number}` : isEs ? `Hasta jornada ${round.number}` : `Up to round ${round.number}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
              {isPt ? 'Comparar com' : isEs ? 'Comparar con' : 'Compare against'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Filter size={16} className="text-neutral-400" />
              <select
                value={compareRoundId}
                onChange={(event) => setCompareRoundId(event.target.value as 'prev' | 'none' | string)}
                className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700"
              >
                <option value="prev">{isPt ? 'Recorte anterior' : isEs ? 'Corte anterior' : 'Previous scope'}</option>
                <option value="none">{isPt ? 'Sem comparacao' : isEs ? 'Sin referencia' : 'No comparison'}</option>
                {closedRounds.map((round) => (
                  <option key={round.id} value={round.id}>
                    {isPt ? `Rodada ${round.number}` : isEs ? `Jornada ${round.number}` : `Round ${round.number}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-neutral-500">
          <span className="rounded-full bg-neutral-900/5 px-2.5 py-1">
            {selectedRound
              ? (isPt ? `Corte atual: rodada ${selectedRound.number}` : isEs ? `Corte actual: jornada ${selectedRound.number}` : `Current scope: round ${selectedRound.number}`)
              : (isPt ? 'Sem rodadas fechadas' : isEs ? 'Sin jornadas cerradas' : 'No closed rounds')}
          </span>
          <span className="rounded-full bg-teal-500/10 px-2.5 py-1 text-teal-700">
            {comparedRound
              ? (isPt ? `Comparando com rodada ${comparedRound.number}` : isEs ? `Comparando con jornada ${comparedRound.number}` : `Comparing with round ${comparedRound.number}`)
              : (isPt ? 'Sem base de comparacao' : isEs ? 'Sin referencia previa' : 'No comparison baseline')}
          </span>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="card p-10 sm:p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_18px_38px_-22px_rgba(245,158,11,0.65)]">
            <Trophy size={28} />
          </div>
          <p className="text-lg font-bold text-neutral-900">
            {isPt ? 'Sem ranking ainda' : isEs ? 'Sin ranking aún' : 'No ranking yet'}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
            {isPt
              ? 'Feche pelo menos uma rodada para consolidar pontos e liberar o ranking.'
              : isEs
                ? 'Cierra al menos una jornada para consolidar puntos y activar la clasificación.'
                : 'Close at least one round to consolidate points and populate the standings.'}
          </p>
        </div>
      ) : (
        <>
          {podium.length > 0 && (
            <section className="card p-4 sm:p-6">
              <div className="mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
                  {isPt ? 'Podio' : isEs ? 'Podio' : 'Podium'}
                </p>
                <h2 className="mt-1 text-lg font-bold text-neutral-900">
                  {isPt ? 'Top 3 da liga' : isEs ? 'Top 3 de la liga' : 'League top 3'}
                </h2>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {podium.map((entry) => (
                  <div
                    key={entry.player.id}
                    className={`rounded-[1.7rem] border p-5 shadow-[0_22px_48px_-34px_rgba(15,23,42,0.28)] ${
                      entry.position === 1
                        ? 'border-amber-200 bg-[linear-gradient(145deg,rgba(255,251,235,0.96),rgba(255,247,237,0.94))]'
                        : entry.position === 2
                          ? 'border-neutral-200 bg-[linear-gradient(145deg,rgba(250,250,250,0.96),rgba(245,245,245,0.94))]'
                          : 'border-orange-200 bg-[linear-gradient(145deg,rgba(255,247,237,0.96),rgba(255,237,213,0.92))]'
                    } ${!entry.player.is_active ? 'opacity-75 ring-1 ring-neutral-300/70' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-[0_18px_36px_-24px_rgba(15,23,42,0.25)] ${
                        entry.position === 1 ? 'bg-amber-500' : entry.position === 2 ? 'bg-neutral-500' : 'bg-orange-500'
                      }`}>
                        <Medal size={18} />
                      </div>
                      <MovementBadge entry={entry} locale={locale} compact />
                    </div>
                    <p className="mt-4 truncate text-base font-black text-neutral-950">{entry.player.full_name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {!entry.player.is_active && <InactiveBadge locale={locale} />}
                      <PointsDeltaBadge entry={entry} locale={locale} compact />
                      {entry.isTied && <TieBadge locale={locale} compact />}
                    </div>
                    <div className="mt-3">
                      <SparklineBars values={entry.history} tone={entry.position === 1 ? 'amber' : 'teal'} />
                    </div>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                      {isPt ? 'Pontos' : isEs ? 'Puntos' : 'Points'}
                    </p>
                    <p className="mt-1 text-3xl font-black tracking-[-0.04em] text-neutral-950">{entry.points}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {rules && (
            <div className="grid gap-3 lg:grid-cols-2">
              <ZoneCard
                title={isPt ? 'Zona de promoção' : isEs ? 'Zona de ascenso' : 'Promotion zone'}
                players={entries.slice(0, Math.max(rules.promotion_count, 0))}
                emptyLabel={isPt ? 'Nenhuma promoção configurada' : isEs ? 'Sin ascenso configurado' : 'No promotion configured'}
                locale={locale}
                tone="emerald"
              />
              <ZoneCard
                title={isPt ? 'Zona de rebaixamento' : isEs ? 'Zona de descenso' : 'Relegation zone'}
                players={rules.relegation_count > 0 ? entries.slice(-rules.relegation_count) : []}
                emptyLabel={isPt ? 'Nenhum rebaixamento configurado' : isEs ? 'Sin descenso configurado' : 'No relegation configured'}
                locale={locale}
                tone="red"
              />
            </div>
          )}

          <div className="space-y-3">
            {(remaining.length > 0 ? remaining : podium).map((entry) => (
              <div
                key={entry.player.id}
                className={`rounded-[1.7rem] border p-5 shadow-[0_22px_48px_-34px_rgba(15,23,42,0.32)] ${
                  entry.player.is_active
                    ? 'border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))]'
                    : 'border-neutral-200 bg-[linear-gradient(145deg,rgba(250,250,250,0.96),rgba(244,244,245,0.9))]'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-black shadow-[0_18px_36px_-24px_rgba(15,23,42,0.25)] ${
                      entry.position === 1
                        ? 'bg-amber-500 text-white'
                        : entry.position === 2
                          ? 'bg-neutral-300 text-neutral-800'
                          : entry.position === 3
                            ? 'bg-orange-500 text-white'
                            : 'bg-neutral-900/6 text-neutral-600'
                    }`}>
                      {entry.position <= 3 ? <Medal size={18} /> : entry.position}
                    </div>

                    <div className="min-w-0">
                      <p className={`truncate text-sm font-bold sm:text-base ${entry.player.is_active ? 'text-neutral-900' : 'text-neutral-500'}`}>
                        {entry.player.full_name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium text-neutral-500">
                          {isPt ? `Posicao #${entry.position}` : isEs ? `Posicion #${entry.position}` : `Position #${entry.position}`}
                        </p>
                        <MovementBadge entry={entry} locale={locale} />
                        <PointsDeltaBadge entry={entry} locale={locale} />
                        {entry.isTied && <TieBadge locale={locale} />}
                        {!entry.player.is_active && <InactiveBadge locale={locale} />}
                      </div>
                      <div className="mt-3 max-w-full sm:max-w-[220px]">
                        <SparklineBars values={entry.history} tone={entry.player.is_active ? 'teal' : 'neutral'} />
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start sm:gap-4">
                    <div className="rounded-2xl bg-neutral-900/5 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                        {isPt ? 'Pontos' : isEs ? 'Puntos' : 'Points'}
                      </p>
                      <p className="mt-1 text-2xl font-black tracking-[-0.03em] text-neutral-950">{entry.points}</p>
                    </div>
                    <div className="hidden rounded-2xl bg-teal-500/10 px-4 py-3 text-teal-700 sm:block">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Gap</p>
                      <p className="mt-1 text-sm font-black">{entry.position === 1 ? '-' : topScore - entry.points}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-neutral-500">
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700">
              {isPt ? 'Fechamento de rodada atualiza o ranking' : isEs ? 'El cierre de jornada actualiza el ranking' : 'Closing a round updates the ranking'}
            </span>
            <span className="rounded-full bg-neutral-900/5 px-2.5 py-1">
              {comparedRound
                ? (isPt ? `Base de comparacao: rodada ${comparedRound.number}` : isEs ? `Referencia base: jornada ${comparedRound.number}` : `Comparison baseline: round ${comparedRound.number}`)
                : (isPt ? 'Sem base de comparacao' : isEs ? 'Sin referencia previa' : 'No comparison baseline')}
            </span>
          </div>
          <div className="sm:ml-auto flex items-center gap-2 text-sm font-semibold text-neutral-500">
            <Users size={16} />
            {entries.length}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, tone }: {
  label: string;
  value: number;
  detail: string;
  tone: 'amber' | 'teal' | 'neutral';
}) {
  const toneClass = {
    amber: 'bg-amber-500/10 border-amber-200/70',
    teal: 'bg-teal-500/10 border-teal-200/70',
    neutral: 'bg-neutral-900/5 border-neutral-900/6',
  }[tone];

  return (
    <div className={`rounded-[1.5rem] border ${toneClass} px-4 py-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.3)] sm:px-5 sm:py-5`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-neutral-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-neutral-500">{detail}</p>
    </div>
  );
}

function MovementBadge({ entry, locale, compact }: {
  entry: RankingEntry;
  locale: string;
  compact?: boolean;
}) {
  const isEs = locale === 'es';
  const isPt = locale === 'pt';

  if (entry.movement === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900/5 px-2 py-1 text-[11px] font-semibold text-neutral-500">
        <Minus size={12} />
        {compact ? '-' : (isPt ? 'Novo' : isEs ? 'Nuevo' : 'New')}
      </span>
    );
  }

  if (entry.movement > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-700">
        <ArrowUp size={12} />
        {entry.movement}
      </span>
    );
  }

  if (entry.movement < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-700">
        <ArrowDown size={12} />
        {Math.abs(entry.movement)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900/5 px-2 py-1 text-[11px] font-semibold text-neutral-500">
      <Minus size={12} />
      {compact ? '-' : (isPt ? 'Estavel' : isEs ? 'Estable' : 'Stable')}
    </span>
  );
}

function PointsDeltaBadge({ entry, locale, compact }: {
  entry: RankingEntry;
  locale: string;
  compact?: boolean;
}) {
  const isEs = locale === 'es';
  const isPt = locale === 'pt';

  if (entry.pointsDelta > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-2 py-1 text-[11px] font-semibold text-teal-700">
        +{entry.pointsDelta} {compact ? '' : (isPt ? 'pts' : isEs ? 'pts' : 'pts')}
      </span>
    );
  }

  if (entry.pointsDelta < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-700">
        {entry.pointsDelta} {compact ? '' : (isPt ? 'pts' : isEs ? 'pts' : 'pts')}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900/5 px-2 py-1 text-[11px] font-semibold text-neutral-500">
      0 {compact ? '' : (isPt ? 'pts' : isEs ? 'pts' : 'pts')}
    </span>
  );
}

function InactiveBadge({ locale }: { locale: string }) {
  const isEs = locale === 'es';
  const isPt = locale === 'pt';

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900/6 px-2 py-1 text-[11px] font-semibold text-neutral-500">
      <Activity size={11} />
      {isPt ? 'Inativa' : isEs ? 'Inactiva' : 'Inactive'}
    </span>
  );
}

function TieBadge({ locale, compact = false }: { locale: string; compact?: boolean }) {
  const isEs = locale === 'es';
  const isPt = locale === 'pt';

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/10 px-2 py-1 text-[11px] font-semibold text-fuchsia-700">
      {compact ? 'T' : isPt ? 'Empate técnico' : isEs ? 'Empate técnico' : 'Technical tie'}
    </span>
  );
}

function SparklineBars({ values, tone }: { values: number[]; tone: 'amber' | 'teal' | 'neutral' }) {
  if (values.length === 0) {
    return null;
  }

  const maxValue = Math.max(...values, 1);
  const toneClass = {
    amber: 'bg-amber-500/70',
    teal: 'bg-teal-500/70',
    neutral: 'bg-neutral-400/70',
  }[tone];

  return (
    <div className="flex h-8 items-end gap-1" aria-hidden="true">
      {values.map((value, index) => {
        const height = Math.max(20, Math.round((value / maxValue) * 100));

        return (
          <span
            key={`${index}-${value}`}
            className={`w-2 rounded-full ${toneClass}`}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}

function ZoneCard({ title, players, emptyLabel, tone, locale }: {
  title: string;
  players: RankingEntry[];
  emptyLabel: string;
  tone: 'emerald' | 'red';
  locale: string;
}) {
  const toneClass = {
    emerald: 'border-emerald-200 bg-emerald-500/8',
    red: 'border-red-200 bg-red-500/8',
  }[tone];

  return (
    <div className={`rounded-[1.6rem] border ${toneClass} p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.24)]`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{title}</p>
      <div className="mt-3 space-y-2">
        {players.length === 0 ? (
          <p className="text-sm font-medium text-neutral-500">{emptyLabel}</p>
        ) : (
          players.map((entry) => (
            <div key={entry.player.id} className="flex flex-col gap-2 rounded-2xl bg-white/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="truncate text-sm font-semibold text-neutral-800">
                #{entry.position} {entry.player.full_name}
              </span>
              <div className="ml-3 flex items-center gap-2">
                {entry.isTied && <TieBadge locale={locale} compact />}
                <PointsDeltaBadge entry={entry} locale="en" compact />
                <span className="text-sm font-black text-neutral-900">{entry.points}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
