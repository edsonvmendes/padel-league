'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useDb } from '@/hooks/useDb';
import { League, Round } from '@/types/database';
import { t } from '@/lib/i18n';
import { Calendar, Users, Trophy, ChevronRight, Plus, Clock, TrendingUp } from 'lucide-react';

interface DashboardStats {
  totalLeagues: number;
  totalPlayers: number;
  totalRounds: number;
  roundsInProgress: number;
}

interface RecentLeague extends League {
  lastRound: Round | null;
  playerCount: number;
  openRounds: number;
}

export default function AppDashboard() {
  const { user, profile, locale } = useAuth();
  const { db, run } = useDb();
  const router = useRouter();
  const isEs = locale === 'es';
  const isPt = locale === 'pt';

  const [stats, setStats] = useState<DashboardStats>({ totalLeagues: 0, totalPlayers: 0, totalRounds: 0, roundsInProgress: 0 });
  const [leagues, setLeagues] = useState<RecentLeague[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    const [{ data: leaguesData }, { data: roundsData }, { data: playersData }] = await Promise.all([
      run(() => db.from('leagues').select('*').order('created_at', { ascending: false })),
      run(() => db.from('rounds').select('*')),
      run(() => db.from('players').select('id, league_id, is_active').eq('is_active', true)),
    ]);

    const lg = leaguesData || [];
    const rd = roundsData || [];
    const pl = playersData || [];

    setStats({
      totalLeagues: lg.length,
      totalPlayers: pl.length,
      totalRounds: rd.length,
      roundsInProgress: rd.filter((r: Round) => r.status === 'running').length,
    });

    const enriched: RecentLeague[] = lg.map((league: League) => {
      const leagueRounds = rd.filter((r: Round) => r.league_id === league.id);
      const sorted = [...leagueRounds].sort((a: Round, b: Round) => b.number - a.number);
      return {
        ...league,
        lastRound: sorted[0] || null,
        playerCount: pl.filter((p: { league_id: string }) => p.league_id === league.id).length,
        openRounds: leagueRounds.filter((r: Round) => r.status === 'running').length,
      };
    });

    setLeagues(enriched);
    setLoading(false);
  };

  const greeting = () => {
    const hour = new Date().getHours();
    const name = profile?.full_name?.split(' ')[0] || '';

    if (isPt) {
      if (hour < 12) return `Bom dia, ${name}!`;
      if (hour < 18) return `Boa tarde, ${name}!`;
      return `Boa noite, ${name}!`;
    }

    if (isEs) {
      if (hour < 12) return `Buenos dias, ${name}!`;
      if (hour < 18) return `Buenas tardes, ${name}!`;
      return `Buenas noches, ${name}!`;
    }

    if (hour < 12) return `Good morning, ${name}!`;
    if (hour < 18) return `Good afternoon, ${name}!`;
    return `Good evening, ${name}!`;
  };

  const summaryText = isPt
    ? 'Visao imediata do que esta rodando, quantas atletas estao ativas e onde sua operacao precisa de atencao hoje.'
    : isEs
      ? 'Visibilidad inmediata de lo que esta en marcha, cuantas jugadoras estan activas y donde tu operacion necesita atencion hoy.'
      : 'Immediate visibility into what is live, how many players are active, and where your operation needs attention today.';

  const statusLabel = (round: Round) => {
    if (round.status === 'running') return isEs ? 'En curso' : isPt ? 'Em andamento' : 'In progress';
    if (round.status === 'draft') return isEs ? 'Borrador' : isPt ? 'Rascunho' : 'Draft';
    return isEs ? 'Cerrada' : isPt ? 'Fechada' : 'Closed';
  };

  const statusColor = (status: string) => ({
    running: 'bg-sky-500/12 text-sky-700 ring-1 ring-sky-500/10',
    draft: 'bg-neutral-900/5 text-neutral-500 ring-1 ring-neutral-900/6',
    closed: 'bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/10',
  }[status] || 'bg-neutral-900/5 text-neutral-500 ring-1 ring-neutral-900/6');

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_right,rgba(13,148,136,0.18),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.14),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.98),rgba(247,250,252,0.96))] p-6 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.45)]">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <span className="inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
              {isPt ? 'Painel central' : isEs ? 'Panel central' : 'Control room'}
            </span>
            <div>
              <h1 className="text-3xl font-black tracking-[-0.03em] text-neutral-950 sm:text-4xl">{greeting()}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600 sm:text-[15px]">{summaryText}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
            <SpotlightMetric
              label={isPt ? 'Ligas ativas' : isEs ? 'Ligas activas' : 'Active leagues'}
              value={stats.totalLeagues}
              detail={isPt ? 'Base viva' : isEs ? 'Base activa' : 'Live base'}
            />
            <SpotlightMetric
              label={isPt ? 'Rodadas abertas' : isEs ? 'Jornadas abiertas' : 'Live rounds'}
              value={stats.roundsInProgress}
              detail={
                stats.roundsInProgress > 0
                  ? (isPt ? 'Em jogo agora' : isEs ? 'Jugandose ahora' : 'Running now')
                  : (isPt ? 'Sem pendencia' : isEs ? 'Sin pendientes' : 'No backlog')
              }
              accent={stats.roundsInProgress > 0}
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t('leagues', locale)}
          value={stats.totalLeagues}
          icon={<Calendar size={20} className="text-teal-500" />}
          color="bg-teal-50"
        />
        <StatCard
          label={t('players', locale)}
          value={stats.totalPlayers}
          icon={<Users size={20} className="text-violet-500" />}
          color="bg-violet-50"
        />
        <StatCard
          label={t('rounds', locale)}
          value={stats.totalRounds}
          icon={<Trophy size={20} className="text-amber-500" />}
          color="bg-amber-50"
        />
        <StatCard
          label={isPt ? 'Em andamento' : isEs ? 'En curso' : 'In progress'}
          value={stats.roundsInProgress}
          icon={<TrendingUp size={20} className="text-emerald-500" />}
          color="bg-emerald-50"
          highlight={stats.roundsInProgress > 0}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)]">
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
                {isPt ? 'Portfolio' : isEs ? 'Portafolio' : 'Portfolio'}
              </p>
              <h2 className="mt-1 text-lg font-bold text-neutral-900">
                {isPt ? 'Suas ligas' : isEs ? 'Tus ligas' : 'Your leagues'}
              </h2>
            </div>
            <button
              onClick={() => router.push('/app/leagues')}
              className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-3 py-1.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-500/15"
            >
              {isPt ? 'Ver todas' : isEs ? 'Ver todas' : 'View all'}
              <ChevronRight size={14} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-3xl border border-white/80 bg-white/75 p-5 animate-pulse">
                  <div className="mb-3 h-4 w-1/3 rounded-full bg-neutral-200" />
                  <div className="h-3 w-1/2 rounded-full bg-neutral-100" />
                </div>
              ))}
            </div>
          ) : leagues.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-neutral-200 bg-white/80 px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-[0_18px_38px_-22px_rgba(13,148,136,0.8)]">
                <Trophy size={28} />
              </div>
              <p className="text-base font-semibold text-neutral-900">
                {isPt ? 'Nenhuma liga ainda' : isEs ? 'No hay ligas todavia' : 'No leagues yet'}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-neutral-500">
                {isPt
                  ? 'Crie sua primeira operacao, defina regras e comece a rodar partidas com rastreio completo.'
                  : isEs
                    ? 'Crea tu primera operacion, define reglas y empieza a gestionar jornadas con trazabilidad completa.'
                    : 'Create your first operation, define rules, and start running rounds with full traceability.'}
              </p>
              <button onClick={() => router.push('/app/leagues')} className="btn-primary mt-6 inline-flex items-center gap-2">
                <Plus size={16} />
                {t('createLeague', locale)}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {leagues.slice(0, 5).map((league) => (
                <LeagueCard
                  key={league.id}
                  league={league}
                  locale={locale}
                  statusLabel={statusLabel}
                  statusColor={statusColor}
                  onClick={() => router.push(`/app/leagues/${league.id}/rounds`)}
                />
              ))}
              {leagues.length > 5 && (
                <button
                  onClick={() => router.push('/app/leagues')}
                  className="w-full rounded-3xl border border-dashed border-neutral-200 bg-white/70 py-4 text-sm font-semibold text-neutral-500 transition hover:border-teal-300 hover:text-teal-700"
                >
                  +{leagues.length - 5} {isPt ? 'outras ligas' : isEs ? 'ligas mas' : 'more leagues'}
                </button>
              )}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="card overflow-hidden p-5 sm:p-6">
            <div className="rounded-[1.5rem] bg-neutral-950 px-5 py-5 text-white shadow-[0_24px_54px_-32px_rgba(15,23,42,0.9)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">
                {isPt ? 'Operacao ao vivo' : isEs ? 'Operacion en vivo' : 'Live ops'}
              </p>
              <p className="mt-3 text-3xl font-black tracking-[-0.04em]">{stats.roundsInProgress}</p>
              <p className="mt-2 text-sm text-white/70">
                {isPt
                  ? 'rodadas em andamento exigindo monitoramento.'
                  : isEs
                    ? 'jornadas en curso que requieren monitoreo.'
                    : 'rounds currently running and requiring oversight.'}
              </p>
            </div>
          </div>

          <div className="card p-5 sm:p-6">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
                {isPt ? 'Atalhos' : isEs ? 'Atajos' : 'Shortcuts'}
              </p>
              <h2 className="mt-1 text-lg font-bold text-neutral-900">
                {isPt ? 'Acoes rapidas' : isEs ? 'Acciones rapidas' : 'Quick actions'}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <QuickAction
                icon={<Plus size={20} className="text-teal-600" />}
                label={t('createLeague', locale)}
                description={isPt ? 'Configure nova liga, horarios e quadras' : isEs ? 'Configura nueva liga, horarios y canchas' : 'Set up a new league, slots and courts'}
                onClick={() => router.push('/app/leagues')}
              />
              {leagues.length > 0 && (
                <QuickAction
                  icon={<Calendar size={20} className="text-violet-600" />}
                  label={isPt ? 'Nova rodada' : isEs ? 'Nueva jornada' : 'New round'}
                  description={isPt ? 'Criar rodada na liga mais recente' : isEs ? 'Crear jornada en la liga mas reciente' : 'Create a round in the most recent league'}
                  onClick={() => router.push(`/app/leagues/${leagues[0].id}/rounds`)}
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, highlight }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-[1.6rem] border border-white/70 bg-white/88 p-4 shadow-[0_18px_44px_-32px_rgba(15,23,42,0.32)] backdrop-blur-xl ${highlight ? 'ring-2 ring-emerald-400/70' : ''}`}>
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-black tracking-[-0.03em] text-neutral-950">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">{label}</p>
    </div>
  );
}

function SpotlightMetric({ label, value, detail, accent }: {
  label: string;
  value: number;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-[1.4rem] border px-4 py-4 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.35)] ${accent ? 'border-emerald-200 bg-emerald-500/10' : 'border-white/75 bg-white/86'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-neutral-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-neutral-500">{detail}</p>
    </div>
  );
}

function LeagueCard({ league, locale, statusLabel, statusColor, onClick }: {
  league: RecentLeague;
  locale: string;
  statusLabel: (r: Round) => string;
  statusColor: (s: string) => string;
  onClick: () => void;
}) {
  const isEs = locale === 'es';
  const isPt = locale === 'pt';

  const weekdayShort: Record<string, string> = {
    Monday: isPt ? 'Seg' : isEs ? 'Lun' : 'Mon',
    Tuesday: isPt ? 'Ter' : isEs ? 'Mar' : 'Tue',
    Wednesday: isPt ? 'Qua' : isEs ? 'Mie' : 'Wed',
    Thursday: isPt ? 'Qui' : isEs ? 'Jue' : 'Thu',
    Friday: isPt ? 'Sex' : isEs ? 'Vie' : 'Fri',
    Saturday: isPt ? 'Sab' : isEs ? 'Sab' : 'Sat',
    Sunday: isPt ? 'Dom' : isEs ? 'Dom' : 'Sun',
  };

  return (
    <button
      onClick={onClick}
      className="group w-full rounded-[1.7rem] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-4 text-left shadow-[0_20px_46px_-34px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_52px_-30px_rgba(13,148,136,0.28)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 via-emerald-500 to-cyan-500 text-sm font-bold text-white shadow-[0_18px_36px_-22px_rgba(13,148,136,0.7)]">
            {league.name.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-neutral-900 sm:text-[15px]">{league.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-neutral-500">
                {weekdayShort[league.weekday]} · {league.playerCount} {isPt ? 'jogadoras' : isEs ? 'jugadoras' : 'players'}
              </span>
              {league.openRounds > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-700">
                  <Clock size={10} />
                  {league.openRounds}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {league.lastRound && (
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusColor(league.lastRound.status)}`}>
              J{league.lastRound.number} · {statusLabel(league.lastRound)}
            </span>
          )}
          {league.is_finished && (
            <span className="rounded-full bg-neutral-900/5 px-2.5 py-1 text-[11px] font-semibold text-neutral-500 ring-1 ring-neutral-900/6">
              {isPt ? 'Finalizada' : isEs ? 'Finalizada' : 'Finished'}
            </span>
          )}
          <ChevronRight size={16} className="text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-teal-600" />
        </div>
      </div>
    </button>
  );
}

function QuickAction({ icon, label, description, onClick }: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-[1.5rem] border border-white/80 bg-white/75 p-4 text-left shadow-[0_18px_38px_-30px_rgba(15,23,42,0.28)] transition duration-300 hover:-translate-y-0.5 hover:border-teal-200 hover:bg-white"
    >
      <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-neutral-900/5 transition group-hover:bg-teal-500/10">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-neutral-900">{label}</p>
        <p className="mt-1 text-xs leading-5 text-neutral-500">{description}</p>
      </div>
    </button>
  );
}
