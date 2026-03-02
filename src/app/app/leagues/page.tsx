'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useDb } from '@/hooks/useDb';
import { useConfirm } from '@/components/ConfirmProvider';
import { useToast } from '@/components/ToastProvider';
import { SkeletonList } from '@/components/Skeleton';
import { League } from '@/types/database';
import { t } from '@/lib/i18n';
import { Plus, ChevronRight, Calendar, Users, Trophy, X, Pencil } from 'lucide-react';

const WEEKDAY_PT: Record<string, string> = {
  Monday: 'Segunda', Tuesday: 'Terca', Wednesday: 'Quarta',
  Thursday: 'Quinta', Friday: 'Sexta', Saturday: 'Sabado', Sunday: 'Domingo',
};

const WEEKDAY_ES: Record<string, string> = {
  Monday: 'Lunes', Tuesday: 'Martes', Wednesday: 'Miercoles',
  Thursday: 'Jueves', Friday: 'Viernes', Saturday: 'Sabado', Sunday: 'Domingo',
};

export default function LeaguesPage() {
  const { user, locale } = useAuth();
  const { db, run, runOrThrow } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const isEs = locale === 'es';
  const isPt = locale === 'pt';

  const [leagues, setLeagues] = useState<(League & { playerCount: number; roundCount: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', weekday: 'Thursday' as string });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    const { data: ls } = await run(() => db.from('leagues').select('*').order('created_at', { ascending: false }));
    if (!ls) {
      setLoading(false);
      return;
    }

    const enriched = await Promise.all(ls.map(async (league: League) => {
      const [{ count: playerCount }, { count: roundCount }] = await Promise.all([
        db.from('players').select('id', { count: 'exact', head: true }).eq('league_id', league.id).eq('is_active', true),
        db.from('rounds').select('id', { count: 'exact', head: true }).eq('league_id', league.id),
      ]);

      return {
        ...league,
        playerCount: playerCount || 0,
        roundCount: roundCount || 0,
      };
    }));

    setLeagues(enriched);
    setLoading(false);
  };

  const weekdayLabel = (weekday: string) => (isPt ? WEEKDAY_PT[weekday] || weekday : isEs ? WEEKDAY_ES[weekday] || weekday : weekday);

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      nextErrors.name = isPt ? 'Nome obrigatorio' : isEs ? 'Nombre requerido' : 'Name required';
    } else if (form.name.trim().length < 2) {
      nextErrors.name = isPt ? 'Minimo 2 caracteres' : isEs ? 'Minimo 2 caracteres' : 'Min 2 characters';
    }

    return nextErrors;
  };

  const createLeague = async () => {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);

    try {
      const newLeague = await runOrThrow(
        () => db.from('leagues').insert({
          name: form.name.trim(),
          weekday: form.weekday,
          owner_user_id: user!.id,
          rounds_count: 12,
          max_courts_per_slot: 3,
          physical_courts_count: 6,
          is_finished: false,
        }).select().single(),
        isPt ? 'Erro ao criar liga' : isEs ? 'Error al crear liga' : 'Failed to create league'
      );

      if (!newLeague) return;

      await runOrThrow(
        () => db.from('rules').insert({
          scope: 'league',
          league_id: newLeague.id,
          absence_penalty: -5,
          use_min_actual_when_absent: false,
          three_absences_bonus: 9,
          promotion_count: 1,
          relegation_count: 1,
          allow_merge_courts: false,
          whatsapp_template: null,
        }),
        isPt ? 'Erro ao criar regras da liga' : isEs ? 'Error al crear reglas de la liga' : 'Failed to create league rules'
      );

      toast.success(isPt ? `Liga "${newLeague.name}" criada!` : isEs ? `Liga "${newLeague.name}" creada!` : `League "${newLeague.name}" created!`);
      setShowModal(false);
      setForm({ name: '', weekday: 'Thursday' });
      router.push(`/app/leagues/${newLeague.id}/players`);
    } finally {
      setSaving(false);
    }
  };

  const deleteLeague = async (league: League) => {
    const ok = await confirm({
      title: isPt ? `Excluir liga "${league.name}"` : isEs ? `Eliminar liga "${league.name}"` : `Delete league "${league.name}"`,
      message: isPt
        ? 'Todos os dados (jogadoras, rodadas, ranking) serao perdidos permanentemente.'
        : isEs
          ? 'Todos los datos (jugadoras, jornadas, ranking) se perderan permanentemente.'
          : 'All data (players, rounds, ranking) will be permanently deleted.',
      confirmLabel: isPt ? 'Excluir' : isEs ? 'Eliminar' : 'Delete',
      cancelLabel: isPt ? 'Cancelar' : isEs ? 'Cancelar' : 'Cancel',
      variant: 'danger',
    });

    if (!ok) return;

    await runOrThrow(
      () => db.from('leagues').delete().eq('id', league.id),
      isPt ? 'Erro ao excluir liga' : isEs ? 'Error al eliminar liga' : 'Failed to delete league'
    );

    toast.success(isPt ? 'Liga excluida' : isEs ? 'Liga eliminada' : 'League deleted');
    load();
  };

  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const finishedLeagues = leagues.filter((league) => league.is_finished).length;
  const activeLeagues = leagues.length - finishedLeagues;
  const totalPlayers = leagues.reduce((sum, league) => sum + league.playerCount, 0);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.14),transparent_34%),linear-gradient(140deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-6 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.42)]">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <span className="inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
              {isPt ? 'Gestao de ligas' : isEs ? 'Gestion de ligas' : 'League management'}
            </span>
            <div>
              <h1 className="text-3xl font-black tracking-[-0.03em] text-neutral-950 sm:text-4xl">{t('leagues', locale)}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600 sm:text-[15px]">
                {isPt
                  ? 'Centralize operacao, acompanhe capacidade e entre em qualquer liga com uma leitura clara de volume e progresso.'
                  : isEs
                    ? 'Centraliza la operacion, sigue la capacidad y entra en cualquier liga con una lectura clara de volumen y progreso.'
                    : 'Centralize operations, track capacity, and enter any league with a clear read on volume and progress.'}
              </p>
            </div>
          </div>

          <button onClick={() => setShowModal(true)} className="btn-primary inline-flex items-center gap-2 self-start lg:self-auto">
            <Plus size={16} />
            {isPt ? 'Nova liga' : isEs ? 'Nueva liga' : 'New league'}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label={isPt ? 'Ligas ativas' : isEs ? 'Ligas activas' : 'Active leagues'}
          value={activeLeagues}
          detail={isPt ? 'Em operacao' : isEs ? 'En operacion' : 'In operation'}
          tone="teal"
        />
        <SummaryCard
          label={isPt ? 'Ligas fechadas' : isEs ? 'Ligas cerradas' : 'Closed leagues'}
          value={finishedLeagues}
          detail={isPt ? 'Ciclo concluido' : isEs ? 'Ciclo concluido' : 'Completed cycle'}
          tone="amber"
        />
        <SummaryCard
          label={isPt ? 'Atletas ativas' : isEs ? 'Jugadoras activas' : 'Active players'}
          value={totalPlayers}
          detail={isPt ? 'Base atual' : isEs ? 'Base actual' : 'Current roster'}
          tone="violet"
        />
      </div>

      {loading ? (
        <div className="card p-5 sm:p-6">
          <SkeletonList count={4} lines={2} />
        </div>
      ) : leagues.length === 0 ? (
        <div className="card p-10 sm:p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-[0_18px_38px_-22px_rgba(13,148,136,0.8)]">
            <Trophy size={28} />
          </div>
          <p className="text-lg font-bold text-neutral-900">
            {isPt ? 'Nenhuma liga criada ainda' : isEs ? 'No hay ligas creadas' : 'No leagues created yet'}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
            {isPt
              ? 'Crie sua primeira liga para organizar jogadoras, rodadas, quadras e regras em um unico fluxo.'
              : isEs
                ? 'Crea tu primera liga para organizar jugadoras, jornadas, canchas y reglas en un unico flujo.'
                : 'Create your first league to organize players, rounds, courts, and rules in one operating flow.'}
          </p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-6 inline-flex items-center gap-2">
            <Plus size={16} />
            {isPt ? 'Criar primeira liga' : isEs ? 'Crear primera liga' : 'Create first league'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {leagues.map((league) => (
            <button
              key={league.id}
              onClick={() => router.push(`/app/leagues/${league.id}/players`)}
              className="group w-full rounded-[1.75rem] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-5 text-left shadow-[0_22px_48px_-34px_rgba(15,23,42,0.34)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_56px_-30px_rgba(13,148,136,0.28)]"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 via-emerald-500 to-cyan-500 text-white shadow-[0_18px_36px_-22px_rgba(13,148,136,0.75)]">
                    <Trophy size={20} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-bold text-neutral-900">{league.name}</p>
                      {league.is_finished && (
                        <span className="rounded-full bg-neutral-900/5 px-2.5 py-1 text-[11px] font-semibold text-neutral-500 ring-1 ring-neutral-900/6">
                          {isPt ? 'Finalizada' : isEs ? 'Finalizada' : 'Finished'}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-neutral-500">
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900/5 px-2.5 py-1">
                        <Calendar size={12} />
                        {weekdayLabel(league.weekday)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900/5 px-2.5 py-1">
                        <Users size={12} />
                        {league.playerCount}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900/5 px-2.5 py-1">
                        <Calendar size={12} />
                        {league.roundCount}/{league.rounds_count}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 md:justify-end">
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                      {isPt ? 'Progresso' : isEs ? 'Progreso' : 'Progress'}
                    </p>
                    <p className="mt-1 text-sm font-bold text-neutral-900">
                      {Math.min(100, Math.round((league.roundCount / Math.max(league.rounds_count, 1)) * 100))}%
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        router.push(`/app/leagues/${league.id}/settings`);
                      }}
                      className="rounded-2xl p-2.5 text-neutral-400 transition hover:bg-neutral-900/5 hover:text-neutral-700"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteLeague(league);
                      }}
                      className="rounded-2xl p-2.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <X size={15} />
                    </button>
                    <ChevronRight size={18} className="text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-teal-600" />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-[rgba(9,13,24,0.56)] backdrop-blur-md flex items-end justify-center p-4 sm:items-center" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] shadow-[0_34px_90px_-44px_rgba(15,23,42,0.6)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
                  {isPt ? 'Nova estrutura' : isEs ? 'Nueva estructura' : 'New structure'}
                </p>
                <h2 className="mt-1 text-lg font-bold text-neutral-900">
                  {isPt ? 'Criar liga' : isEs ? 'Crear liga' : 'Create league'}
                </h2>
              </div>

              <button onClick={() => setShowModal(false)} className="rounded-2xl p-2 text-neutral-400 transition hover:bg-neutral-900/5 hover:text-neutral-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div>
                <label className="label-field">{isPt ? 'Nome da liga' : isEs ? 'Nombre de la liga' : 'League name'}</label>
                <input
                  className={`input-field ${errors.name ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                  placeholder={isPt ? 'Ex: Padel Feminino Taubate' : isEs ? 'Ej: Padel Femenino' : 'Ex: Ladies Padel League'}
                  value={form.name}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, name: event.target.value }));
                    setErrors({});
                  }}
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
              </div>

              <div>
                <label className="label-field">{isPt ? 'Dia da semana' : isEs ? 'Dia de la semana' : 'Weekday'}</label>
                <div className="grid grid-cols-4 gap-2">
                  {weekdays.map((weekday) => (
                    <button
                      key={weekday}
                      onClick={() => setForm((current) => ({ ...current, weekday }))}
                      className={`rounded-2xl py-2.5 text-xs font-semibold transition ${
                        form.weekday === weekday
                          ? 'bg-neutral-900 text-white shadow-[0_14px_28px_-18px_rgba(15,23,42,0.7)]'
                          : 'bg-neutral-900/5 text-neutral-500 hover:bg-neutral-900/8'
                      }`}
                    >
                      {weekdayLabel(weekday).slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-neutral-900/5 p-4 text-xs leading-5 text-neutral-500">
                {isPt
                  ? 'Outros detalhes, como quadras, horarios e regras, podem ser ajustados depois sem travar a criacao inicial.'
                  : isEs
                    ? 'Otros detalles, como canchas, horarios y reglas, pueden ajustarse despues sin bloquear la creacion inicial.'
                    : 'Other details such as courts, slots, and rules can be refined later without blocking the initial setup.'}
              </div>

              <button onClick={createLeague} disabled={saving} className="btn-primary flex w-full items-center justify-center gap-2">
                {saving ? (
                  <>
                    <span className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    {isPt ? 'Criando...' : isEs ? 'Creando...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    {isPt ? 'Criar liga' : isEs ? 'Crear liga' : 'Create league'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, detail, tone }: {
  label: string;
  value: number;
  detail: string;
  tone: 'teal' | 'amber' | 'violet';
}) {
  const toneClass = {
    teal: 'bg-teal-500/10 border-teal-200/70',
    amber: 'bg-amber-500/10 border-amber-200/70',
    violet: 'bg-violet-500/10 border-violet-200/70',
  }[tone];

  return (
    <div className={`rounded-[1.5rem] border ${toneClass} px-5 py-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.3)]`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-neutral-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-neutral-500">{detail}</p>
    </div>
  );
}
