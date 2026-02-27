'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useDb } from '@/hooks/useDb';
import { League, Round, Player } from '@/types/database';
import { t } from '@/lib/i18n';
import { Calendar, Users, Trophy, ChevronRight, Plus, Clock, TrendingUp, AlertCircle } from 'lucide-react';

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
    const [
      { data: leaguesData },
      { data: roundsData },
      { data: playersData },
    ] = await Promise.all([
      run(() => db.from('leagues').select('*').order('created_at', { ascending: false })),
      run(() => db.from('rounds').select('*')),
      run(() => db.from('players').select('id, league_id, is_active').eq('is_active', true)),
    ]);

    const lg = leaguesData || [];
    const rd = roundsData || [];
    const pl = playersData || [];

    // Stats globais
    setStats({
      totalLeagues: lg.length,
      totalPlayers: pl.length,
      totalRounds: rd.length,
      roundsInProgress: rd.filter((r: Round) => r.status === 'running').length,
    });

    // Enriquecer leagues com info de rounds e players
    const enriched: RecentLeague[] = lg.map((league: League) => {
      const leagueRounds = rd.filter((r: Round) => r.league_id === league.id);
      const sorted = [...leagueRounds].sort((a: Round, b: Round) => b.number - a.number);
      return {
        ...league,
        lastRound: sorted[0] || null,
        playerCount: pl.filter((p: any) => p.league_id === league.id).length,
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
      if (hour < 12) return `Buenos días, ${name}!`;
      if (hour < 18) return `Buenas tardes, ${name}!`;
      return `Buenas noches, ${name}!`;
    }
    if (hour < 12) return `Good morning, ${name}!`;
    if (hour < 18) return `Good afternoon, ${name}!`;
    return `Good evening, ${name}!`;
  };

  const statusLabel = (round: Round) => {
    if (round.status === 'running') return isEs ? 'En curso' : isPt ? 'Em andamento' : 'In progress';
    if (round.status === 'draft')   return isEs ? 'Borrador' : isPt ? 'Rascunho' : 'Draft';
    return isEs ? 'Cerrada' : isPt ? 'Fechada' : 'Closed';
  };

  const statusColor = (status: string) => ({
    running: 'bg-blue-100 text-blue-700',
    draft:   'bg-neutral-100 text-neutral-500',
    closed:  'bg-emerald-100 text-emerald-700',
  }[status] || 'bg-neutral-100 text-neutral-500');

  return (
    <div className="space-y-6">

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-extrabold text-neutral-900">{greeting()}</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          {isPt ? 'Aqui está o resumo das suas ligas.' : isEs ? 'Aquí está el resumen de tus ligas.' : 'Here\'s a summary of your leagues.'}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

      {/* Leagues list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-neutral-800">
            {isPt ? 'Suas ligas' : isEs ? 'Tus ligas' : 'Your leagues'}
          </h2>
          <button
            onClick={() => router.push('/app/leagues')}
            className="text-sm text-teal-600 font-semibold hover:text-teal-800 flex items-center gap-1">
            {isPt ? 'Ver todas' : isEs ? 'Ver todas' : 'View all'}
            <ChevronRight size={14} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-4 bg-neutral-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-neutral-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : leagues.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="text-4xl mb-3">🏸</div>
            <p className="text-neutral-500 font-medium mb-4">
              {isPt ? 'Nenhuma liga ainda' : isEs ? 'No hay ligas todavía' : 'No leagues yet'}
            </p>
            <button onClick={() => router.push('/app/leagues')}
              className="btn-primary inline-flex items-center gap-2">
              <Plus size={16} />
              {t('createLeague', locale)}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {leagues.slice(0, 5).map(league => (
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
                className="w-full py-3 border-2 border-dashed border-neutral-200 rounded-xl text-sm font-semibold text-neutral-400 hover:border-teal-300 hover:text-teal-600 transition">
                +{leagues.length - 5} {isPt ? 'outras ligas' : isEs ? 'ligas más' : 'more leagues'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-base font-bold text-neutral-800 mb-3">
          {isPt ? 'Ações rápidas' : isEs ? 'Acciones rápidas' : 'Quick actions'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickAction
            icon={<Plus size={20} className="text-teal-600" />}
            label={t('createLeague', locale)}
            description={isPt ? 'Configure nova liga, horários e quadras' : isEs ? 'Configura nueva liga, horarios y canchas' : 'Set up a new league, slots and courts'}
            onClick={() => router.push('/app/leagues')}
          />
          {leagues.length > 0 && (
            <QuickAction
              icon={<Calendar size={20} className="text-violet-600" />}
              label={isPt ? 'Nova rodada' : isEs ? 'Nueva jornada' : 'New round'}
              description={isPt ? 'Criar rodada na liga mais recente' : isEs ? 'Crear jornada en la liga más reciente' : 'Create a round in the most recent league'}
              onClick={() => router.push(`/app/leagues/${leagues[0].id}/rounds`)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTES LOCAIS
// ============================================================

function StatCard({ label, value, icon, color, highlight }: {
  label: string; value: number; icon: React.ReactNode; color: string; highlight?: boolean;
}) {
  return (
    <div className={`card p-4 ${highlight ? 'ring-2 ring-emerald-400' : ''}`}>
      <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-extrabold text-neutral-900">{value}</p>
      <p className="text-xs text-neutral-500 mt-0.5 font-medium">{label}</p>
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

  const WEEKDAY_SHORT: Record<string, string> = {
    Monday:    isPt ? 'Seg' : isEs ? 'Lun' : 'Mon',
    Tuesday:   isPt ? 'Ter' : isEs ? 'Mar' : 'Tue',
    Wednesday: isPt ? 'Qua' : isEs ? 'Mié' : 'Wed',
    Thursday:  isPt ? 'Qui' : isEs ? 'Jue' : 'Thu',
    Friday:    isPt ? 'Sex' : isEs ? 'Vie' : 'Fri',
    Saturday:  isPt ? 'Sáb' : isEs ? 'Sáb' : 'Sat',
    Sunday:    isPt ? 'Dom' : isEs ? 'Dom' : 'Sun',
  };

  return (
    <button onClick={onClick} className="card-hover w-full p-4 flex items-center justify-between text-left gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar */}
        <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {league.name.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0">
          <p className="font-semibold text-neutral-800 truncate">{league.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-neutral-400">
              {WEEKDAY_SHORT[league.weekday]} · {league.playerCount} {isPt ? 'jogadoras' : isEs ? 'jugadoras' : 'players'}
            </span>
            {league.openRounds > 0 && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-blue-600">
                <Clock size={10} />
                {league.openRounds}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {league.lastRound && (
          <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${statusColor(league.lastRound.status)}`}>
            J{league.lastRound.number} · {statusLabel(league.lastRound)}
          </span>
        )}
        {league.is_finished && (
          <span className="text-xs px-2 py-1 rounded-lg font-semibold bg-neutral-100 text-neutral-400">
            {isPt ? 'Finalizada' : isEs ? 'Finalizada' : 'Finished'}
          </span>
        )}
        <ChevronRight size={16} className="text-neutral-300" />
      </div>
    </button>
  );
}

function QuickAction({ icon, label, description, onClick }: {
  icon: React.ReactNode; label: string; description: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="card-hover p-4 text-left flex items-start gap-3 w-full">
      <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-neutral-800 text-sm">{label}</p>
        <p className="text-xs text-neutral-400 mt-0.5">{description}</p>
      </div>
    </button>
  );
}
