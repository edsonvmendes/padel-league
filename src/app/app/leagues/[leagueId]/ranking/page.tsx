'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useDb } from '@/hooks/useDb';
import { SkeletonList } from '@/components/Skeleton';
import { League, LeagueRanking, Player } from '@/types/database';
import { Trophy, Medal, ChevronLeft, Users } from 'lucide-react';

type RankingEntry = LeagueRanking & {
  player: Player | null;
  position: number;
};

export default function LeagueRankingPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user, locale } = useAuth();
  const { db, run } = useDb();
  const router = useRouter();
  const isEs = locale === 'es';
  const isPt = locale === 'pt';

  const [league, setLeague] = useState<League | null>(null);
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [activePlayers, setActivePlayers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) load();
  }, [user, leagueId]);

  const load = async () => {
    setLoading(true);

    const [{ data: leagueData }, { data: rankingData }, { data: playerData }] = await Promise.all([
      run(() => db.from('leagues').select('*').eq('id', leagueId).single()),
      run(() => db.from('league_rankings').select('*').eq('league_id', leagueId).order('total_points', { ascending: false })),
      run(() => db.from('players').select('*').eq('league_id', leagueId).order('full_name')),
    ]);

    const players = (playerData || []) as Player[];
    const rankings = (rankingData || []) as LeagueRanking[];

    setLeague(leagueData || null);
    setActivePlayers(players.filter((player) => player.is_active).length);
    setEntries(
      rankings.map((entry, index) => ({
        ...entry,
        player: players.find((player) => player.id === entry.player_id) || null,
        position: index + 1,
      }))
    );

    setLoading(false);
  };

  const topScore = entries[0]?.total_points || 0;
  const podium = entries.slice(0, 3);
  const remaining = entries.slice(3);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)]">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-neutral-200 animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-32 rounded-full bg-neutral-200 animate-pulse" />
              <div className="h-3 w-48 rounded-full bg-neutral-100 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="card p-5 sm:p-6">
          <SkeletonList count={5} lines={1} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
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
              {isPt ? 'Ranking' : isEs ? 'Ranking' : 'Ranking'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-neutral-600 sm:text-[15px]">
              {league?.name || ''} · {isPt ? 'Pontuacao consolidada por rodada fechada.' : isEs ? 'Puntuacion consolidada por jornada cerrada.' : 'Points consolidated from closed rounds.'}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          label={isPt ? 'Jogadoras ranqueadas' : isEs ? 'Jugadoras rankeadas' : 'Ranked players'}
          value={entries.length}
          detail={isPt ? 'com pontos acumulados' : isEs ? 'con puntos acumulados' : 'with accumulated points'}
          tone="amber"
        />
        <MetricCard
          label={isPt ? 'Ativas' : isEs ? 'Activas' : 'Active'}
          value={activePlayers}
          detail={isPt ? 'na base atual' : isEs ? 'en la base actual' : 'in the current roster'}
          tone="teal"
        />
        <MetricCard
          label={isPt ? 'Topo' : isEs ? 'Lider' : 'Leader'}
          value={topScore}
          detail={isPt ? 'melhor pontuacao' : isEs ? 'mejor puntuacion' : 'highest score'}
          tone="neutral"
        />
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
        <div className="space-y-5">
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
                    key={entry.id}
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
                      <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-neutral-600">
                        #{entry.position}
                      </span>
                    </div>
                    <p className="mt-4 truncate text-base font-black text-neutral-950">
                      {entry.player?.full_name || '?'}
                    </p>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                      {isPt ? 'Pontos' : isEs ? 'Puntos' : 'Points'}
                    </p>
                    <p className="mt-1 text-3xl font-black tracking-[-0.04em] text-neutral-950">
                      {entry.total_points}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="space-y-3">
            {(remaining.length > 0 ? remaining : podium).map((entry) => (
            <div
              key={entry.id}
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
                      {entry.player?.full_name || '?'}
                    </p>
                    <p className="mt-1 text-xs font-medium text-neutral-500">
                      {isPt ? `Posicao #${entry.position}` : isEs ? `Posicion #${entry.position}` : `Position #${entry.position}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="rounded-2xl bg-neutral-900/5 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                      {isPt ? 'Pontos' : isEs ? 'Puntos' : 'Points'}
                    </p>
                    <p className="mt-1 text-2xl font-black tracking-[-0.03em] text-neutral-950">
                      {entry.total_points}
                    </p>
                  </div>
                  <div className="hidden rounded-2xl bg-teal-500/10 px-4 py-3 text-teal-700 sm:block">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Gap</p>
                    <p className="mt-1 text-sm font-black">
                      {entry.position === 1 ? '—' : topScore - entry.total_points}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-neutral-500">
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700">{isPt ? 'Fechamento de rodada atualiza o ranking' : isEs ? 'El cierre de jornada actualiza el ranking' : 'Closing a round updates the ranking'}</span>
            <span className="rounded-full bg-neutral-900/5 px-2.5 py-1">{isPt ? 'Sem tela manual de edicao' : isEs ? 'Sin edicion manual' : 'No manual editing screen'}</span>
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
