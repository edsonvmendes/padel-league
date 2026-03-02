'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useDb } from '@/hooks/useDb';
import { SkeletonList } from '@/components/Skeleton';
import { League, Player, Round, RoundPoints, Rules } from '@/types/database';
import { Trophy, Medal, ChevronLeft, Users, ArrowUp, ArrowDown, Minus, Filter } from 'lucide-react';

type RankingEntry = {
  player: Player;
  points: number;
  position: number;
  previousPosition: number | null;
  movement: number | null;
};

export default function LeagueRankingPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user, locale } = useAuth();
  const { db, run } = useDb();
  const router = useRouter();
  const isEs = locale === 'es';
  const isPt = locale === 'pt';

  const [league, setLeague] = useState<League | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [closedRounds, setClosedRounds] = useState<Round[]>([]);
  const [roundPoints, setRoundPoints] = useState<RoundPoints[]>([]);
  const [rules, setRules] = useState<Rules | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<'all' | string>('all');
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
      run(() => db.from('players').select('*').eq('league_id', leagueId).order('full_name')),
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

  const rankingData = useMemo(() => {
    const roundsOrdered = [...closedRounds].sort((a, b) => a.number - b.number);
    const targetIndex = selectedRoundId === 'all'
      ? roundsOrdered.length - 1
      : roundsOrdered.findIndex((round) => round.id === selectedRoundId);

    const effectiveIndex = targetIndex;
    if (effectiveIndex < 0) {
      return { entries: [] as RankingEntry[], topScore: 0, comparedRound: null as Round | null };
    }

    const includedRounds = roundsOrdered.slice(0, effectiveIndex + 1);
    const previousRounds = roundsOrdered.slice(0, effectiveIndex);
    const includedIds = new Set(includedRounds.map((round) => round.id));
    const previousIds = new Set(previousRounds.map((round) => round.id));

    const currentTotals = new Map<string, number>();
    const previousTotals = new Map<string, number>();

    roundPoints.forEach((entry) => {
      if (includedIds.has(entry.round_id)) {
        currentTotals.set(entry.player_id, (currentTotals.get(entry.player_id) || 0) + entry.points);
      }
      if (previousIds.has(entry.round_id)) {
        previousTotals.set(entry.player_id, (previousTotals.get(entry.player_id) || 0) + entry.points);
      }
    });

    const activeEntries = players
      .filter((player) => currentTotals.has(player.id))
      .map((player) => ({
        player,
        points: currentTotals.get(player.id) || 0,
      }))
      .sort((a, b) => b.points - a.points || a.player.full_name.localeCompare(b.player.full_name));

    const previousRanking = players
      .filter((player) => previousTotals.has(player.id))
      .map((player) => ({
        playerId: player.id,
        points: previousTotals.get(player.id) || 0,
      }))
      .sort((a, b) => b.points - a.points)
      .reduce<Map<string, number>>((acc, entry, index) => {
        acc.set(entry.playerId, index + 1);
        return acc;
      }, new Map());

    const entries: RankingEntry[] = activeEntries.map((entry, index) => {
      const previousPosition = previousRanking.get(entry.player.id) || null;
      const position = index + 1;
      return {
        player: entry.player,
        points: entry.points,
        position,
        previousPosition,
        movement: previousPosition ? previousPosition - position : null,
      };
    });

    return {
      entries,
      topScore: entries[0]?.points || 0,
      comparedRound: effectiveIndex > 0 ? roundsOrdered[effectiveIndex - 1] : null,
    };
  }, [closedRounds, players, roundPoints, selectedRoundId]);

  const entries = rankingData.entries;
  const topScore = rankingData.topScore;
  const podium = entries.slice(0, 3);
  const remaining = entries.slice(3);
  const activePlayers = players.filter((player) => player.is_active).length;
  const comparedRound = rankingData.comparedRound;
  const selectedRound = selectedRoundId === 'all'
    ? closedRounds[closedRounds.length - 1] || null
    : closedRounds.find((round) => round.id === selectedRoundId) || null;

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)]">
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
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(20,184,166,0.14),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-6 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.42)]">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
        <div className="relative flex items-start gap-4">
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
            <h1 className="mt-1 text-3xl font-black tracking-[-0.03em] text-neutral-950 sm:text-4xl">
              Ranking
            </h1>
            <p className="mt-2 text-sm leading-6 text-neutral-600 sm:text-[15px]">
              {league?.name || ''} · {isPt ? 'Filtro por rodada, movimento e zonas competitivas.' : isEs ? 'Filtro por jornada, movimiento y zonas competitivas.' : 'Round filter, movement, and competitive zones.'}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          label={isPt ? 'Jogadoras ranqueadas' : isEs ? 'Jugadoras rankeadas' : 'Ranked players'}
          value={entries.length}
          detail={isPt ? 'com pontos no recorte' : isEs ? 'con puntos en el recorte' : 'with points in this scope'}
          tone="amber"
        />
        <MetricCard
          label={isPt ? 'Ativas' : isEs ? 'Activas' : 'Active'}
          value={activePlayers}
          detail={isPt ? 'na base atual' : isEs ? 'en la base actual' : 'in the current roster'}
          tone="teal"
        />
        <MetricCard
          label={isPt ? 'Lider' : isEs ? 'Lider' : 'Leader'}
          value={topScore}
          detail={isPt ? 'maior pontuacao' : isEs ? 'mayor puntuacion' : 'highest points'}
          tone="neutral"
        />
      </div>

      <div className="card p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
              {isPt ? 'Recorte' : isEs ? 'Recorte' : 'Scope'}
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-700">
              {selectedRound
                ? (isPt ? `Ate a rodada ${selectedRound.number}` : isEs ? `Hasta la jornada ${selectedRound.number}` : `Up to round ${selectedRound.number}`)
                : (isPt ? 'Sem rodadas fechadas' : isEs ? 'Sin jornadas cerradas' : 'No closed rounds')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-neutral-400" />
            <select
              value={selectedRoundId}
              onChange={(event) => setSelectedRoundId(event.target.value as 'all' | string)}
              className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700"
            >
              <option value="all">
                {isPt ? 'Ranking completo' : isEs ? 'Ranking completo' : 'Full ranking'}
              </option>
              {closedRounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {isPt ? `Ate rodada ${round.number}` : isEs ? `Hasta jornada ${round.number}` : `Up to round ${round.number}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="card p-10 sm:p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_18px_38px_-22px_rgba(245,158,11,0.65)]">
            <Trophy size={28} />
          </div>
          <p className="text-lg font-bold text-neutral-900">
            {isPt ? 'Sem ranking ainda' : isEs ? 'Sin ranking aun' : 'No ranking yet'}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
            {isPt
              ? 'Feche pelo menos uma rodada para consolidar pontos e preencher a classificacao.'
              : isEs
                ? 'Cierra al menos una jornada para consolidar puntos y llenar la clasificacion.'
                : 'Close at least one round to consolidate points and populate the standings.'}
          </p>
        </div>
      ) : (
        <>
          {podium.length > 0 && (
            <section className="card p-5 sm:p-6">
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
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-[0_18px_36px_-24px_rgba(15,23,42,0.25)] ${
                        entry.position === 1 ? 'bg-amber-500' : entry.position === 2 ? 'bg-neutral-500' : 'bg-orange-500'
                      }`}>
                        <Medal size={18} />
                      </div>
                      <MovementBadge entry={entry} locale={locale} compact />
                    </div>
                    <p className="mt-4 truncate text-base font-black text-neutral-950">
                      {entry.player.full_name}
                    </p>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                      {isPt ? 'Pontos' : isEs ? 'Puntos' : 'Points'}
                    </p>
                    <p className="mt-1 text-3xl font-black tracking-[-0.04em] text-neutral-950">
                      {entry.points}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {rules && (
            <div className="grid gap-3 lg:grid-cols-2">
              <ZoneCard
                title={isPt ? 'Zona de promocao' : isEs ? 'Zona de ascenso' : 'Promotion zone'}
                players={entries.slice(0, Math.max(rules.promotion_count, 0))}
                emptyLabel={isPt ? 'Nenhuma promocao configurada' : isEs ? 'Sin ascenso configurado' : 'No promotion configured'}
                tone="emerald"
              />
              <ZoneCard
                title={isPt ? 'Zona de rebaixamento' : isEs ? 'Zona de descenso' : 'Relegation zone'}
                players={rules.relegation_count > 0 ? entries.slice(-rules.relegation_count) : []}
                emptyLabel={isPt ? 'Nenhum rebaixamento configurado' : isEs ? 'Sin descenso configurado' : 'No relegation configured'}
                tone="red"
              />
            </div>
          )}

          <div className="space-y-3">
            {(remaining.length > 0 ? remaining : podium).map((entry) => (
              <div
                key={entry.player.id}
                className="rounded-[1.7rem] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-5 shadow-[0_22px_48px_-34px_rgba(15,23,42,0.32)]"
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
                      <p className="truncate text-sm font-bold text-neutral-900 sm:text-base">
                        {entry.player.full_name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium text-neutral-500">
                          {isPt ? `Posicao #${entry.position}` : isEs ? `Posicion #${entry.position}` : `Position #${entry.position}`}
                        </p>
                        <MovementBadge entry={entry} locale={locale} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="rounded-2xl bg-neutral-900/5 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                        {isPt ? 'Pontos' : isEs ? 'Puntos' : 'Points'}
                      </p>
                      <p className="mt-1 text-2xl font-black tracking-[-0.03em] text-neutral-950">
                        {entry.points}
                      </p>
                    </div>
                    <div className="hidden rounded-2xl bg-teal-500/10 px-4 py-3 text-teal-700 sm:block">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Gap</p>
                      <p className="mt-1 text-sm font-black">
                        {entry.position === 1 ? '-' : topScore - entry.points}
                      </p>
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
                ? (isPt ? `Comparado com rodada ${comparedRound.number}` : isEs ? `Comparado con jornada ${comparedRound.number}` : `Compared with round ${comparedRound.number}`)
                : (isPt ? 'Sem rodada anterior para comparar' : isEs ? 'Sin jornada previa para comparar' : 'No previous round to compare')}
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
    <div className={`rounded-[1.5rem] border ${toneClass} px-5 py-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.3)]`}>
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

function ZoneCard({ title, players, emptyLabel, tone }: {
  title: string;
  players: RankingEntry[];
  emptyLabel: string;
  tone: 'emerald' | 'red';
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
            <div key={entry.player.id} className="flex items-center justify-between rounded-2xl bg-white/70 px-3 py-2">
              <span className="truncate text-sm font-semibold text-neutral-800">
                #{entry.position} {entry.player.full_name}
              </span>
              <span className="ml-3 text-sm font-black text-neutral-900">{entry.points}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
