'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useDb } from '@/hooks/useDb';
import { useConfirm } from '@/components/ConfirmProvider';
import { useToast } from '@/components/ToastProvider';
import { SkeletonList } from '@/components/Skeleton';
import { League } from '@/types/database';
import { t } from '@/lib/i18n';
import { Plus, ChevronRight, Calendar, Users, Trophy, X, Pencil, CopyPlus, Sparkles } from 'lucide-react';

const WEEKDAY_PT: Record<string, string> = {
  Monday: 'Segunda', Tuesday: 'Terca', Wednesday: 'Quarta',
  Thursday: 'Quinta', Friday: 'Sexta', Saturday: 'Sábado', Sunday: 'Domingo',
};

const WEEKDAY_ES: Record<string, string> = {
  Monday: 'Lunes', Tuesday: 'Martes', Wednesday: 'Miércoles',
  Thursday: 'Jueves', Friday: 'Viernes', Saturday: 'Sábado', Sunday: 'Domingo',
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
  const [form, setForm] = useState({ name: '', weekday: 'Thursday' as string, template: 'custom' as LeagueTemplateKey });
  const [showPresetTemplates, setShowPresetTemplates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const leagueTemplates = {
    balanced: {
      rounds_count: 12,
      max_courts_per_slot: 3,
      physical_courts_count: 6,
      slots: ['19:00', '20:30'],
      rules: { absence_penalty: -5, three_absences_bonus: 9, promotion_count: 1, relegation_count: 1, allow_merge_courts: false },
    },
    compact: {
      rounds_count: 8,
      max_courts_per_slot: 2,
      physical_courts_count: 4,
      slots: ['19:00'],
      rules: { absence_penalty: -3, three_absences_bonus: 6, promotion_count: 1, relegation_count: 1, allow_merge_courts: true },
    },
    extended: {
      rounds_count: 16,
      max_courts_per_slot: 4,
      physical_courts_count: 8,
      slots: ['18:30', '20:00', '21:30'],
      rules: { absence_penalty: -5, three_absences_bonus: 9, promotion_count: 2, relegation_count: 2, allow_merge_courts: false },
    },
  } satisfies Record<Exclude<LeagueTemplateKey, 'custom'>, {
    rounds_count: number;
    max_courts_per_slot: number;
    physical_courts_count: number;
    slots: string[];
    rules: {
      absence_penalty: number;
      three_absences_bonus: number;
      promotion_count: number;
      relegation_count: number;
      allow_merge_courts: boolean;
    };
  }>;

  const load = useCallback(async () => {
    if (!user) return;

    const { data: ls } = await run(() => db.from('leagues').select('*').order('created_at', { ascending: false }));
    if (!ls) {
      setLoading(false);
      return;
    }

    const enriched = await Promise.all(ls.map(async (league: League) => {
      const [{ count: playerCount }, { count: roundCount }] = await Promise.all([
        db.from('league_roster').select('id', { count: 'exact', head: true }).eq('league_id', league.id).eq('is_active', true),
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
  }, [db, run, user]);

  useEffect(() => {
    load();
  }, [load]);

  const weekdayLabel = (weekday: string) => (isPt ? WEEKDAY_PT[weekday] || weekday : isEs ? WEEKDAY_ES[weekday] || weekday : weekday);

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      nextErrors.name = isPt ? 'Informe um nome para a liga' : isEs ? 'Ingresa un nombre para la liga' : 'Enter a league name';
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
      const template = form.template === 'custom' ? null : leagueTemplates[form.template];
      const newLeague = await runOrThrow(
        () => db.from('leagues').insert({
          name: form.name.trim(),
          weekday: form.weekday,
          owner_user_id: user!.id,
          rounds_count: template?.rounds_count ?? 12,
          max_courts_per_slot: template?.max_courts_per_slot ?? 3,
          physical_courts_count: template?.physical_courts_count ?? 6,
          is_finished: false,
        }).select().single(),
        isPt ? 'Erro ao criar liga' : isEs ? 'Error al crear liga' : 'Failed to create league'
      );

      if (!newLeague) return;

      await runOrThrow(
        () => db.from('rules').insert({
          scope: 'league',
          league_id: newLeague.id,
          absence_penalty: template?.rules.absence_penalty ?? -5,
          use_min_actual_when_absent: false,
          three_absences_bonus: template?.rules.three_absences_bonus ?? 9,
          promotion_count: template?.rules.promotion_count ?? 1,
          relegation_count: template?.rules.relegation_count ?? 1,
          allow_merge_courts: template?.rules.allow_merge_courts ?? false,
          whatsapp_template: null,
        }),
        isPt ? 'Erro ao criar regras da liga' : isEs ? 'Error al crear reglas de la liga' : 'Failed to create league rules'
      );

      if ((template?.slots.length || 0) > 0) {
        await runOrThrow(
          () => db.from('league_time_slots').insert(
            template!.slots.map((slot, index) => ({
              league_id: newLeague.id,
              slot_time: slot,
              sort_order: index,
            }))
          ),
          isPt ? 'Erro ao criar horários iniciais' : isEs ? 'Error al crear horarios iniciales' : 'Failed to create default slots'
        );
      }

      if ((template?.max_courts_per_slot || 0) > 0) {
        await runOrThrow(
          () => db.from('courts').insert(
            Array.from({ length: template!.max_courts_per_slot }, (_, index) => ({
              league_id: newLeague.id,
              court_number: index + 1,
            }))
          ),
          isPt ? 'Erro ao criar quadras iniciais' : isEs ? 'Error al crear canchas iniciales' : 'Failed to create default courts'
        );
      }

      toast.success(isPt ? `Liga "${newLeague.name}" criada.` : isEs ? `Liga "${newLeague.name}" creada.` : `League "${newLeague.name}" created.`);
      setShowModal(false);
      setForm({ name: '', weekday: 'Thursday', template: 'custom' });
      setShowPresetTemplates(false);
      router.push(`/app/leagues/${newLeague.id}/players`);
    } finally {
      setSaving(false);
    }
  };

  const duplicateLeague = async (league: League) => {
    const ok = await confirm({
      title: isPt ? `Duplicar liga "${league.name}"` : isEs ? `Duplicar liga "${league.name}"` : `Duplicate league "${league.name}"`,
      message: isPt
        ? 'Isso cria uma nova liga com regras, horários, quadras e jogadoras ativas da estrutura atual.'
        : isEs
          ? 'Esto crea una nueva liga con reglas, horarios, canchas y jugadoras activas de la estructura actual.'
          : 'This creates a new league with the current rules, slots, courts, and active players.',
      confirmLabel: isPt ? 'Duplicar' : isEs ? 'Duplicar' : 'Duplicate',
      cancelLabel: isPt ? 'Cancelar' : isEs ? 'Cancelar' : 'Cancel',
    });

    if (!ok) return;

    const [
      { data: sourceRules },
      { data: sourceSlots },
      { data: sourceCourts },
      { data: sourcePlayers },
    ] = await Promise.all([
      run(() => db.from('rules').select('*').eq('league_id', league.id).eq('scope', 'league').maybeSingle()),
      run(() => db.from('league_time_slots').select('*').eq('league_id', league.id).order('sort_order')),
      run(() => db.from('courts').select('*').eq('league_id', league.id).order('court_number')),
      run(() => db.from('league_roster').select('*').eq('league_id', league.id).eq('is_active', true).order('full_name')),
    ]);

    const cloneName = isPt ? `${league.name} (cópia)` : isEs ? `${league.name} (copia)` : `${league.name} (copy)`;

    const duplicated = await runOrThrow(
      () => db.from('leagues').insert({
        name: cloneName,
        weekday: league.weekday,
        owner_user_id: user!.id,
        rounds_count: league.rounds_count,
        max_courts_per_slot: league.max_courts_per_slot,
        physical_courts_count: league.physical_courts_count,
        is_finished: false,
      }).select().single(),
      isPt ? 'Erro ao duplicar liga' : isEs ? 'Error al duplicar liga' : 'Failed to duplicate league'
    );

    if (!duplicated) return;

    await runOrThrow(
      () => db.from('rules').insert({
        scope: 'league',
        league_id: duplicated.id,
        absence_penalty: sourceRules?.absence_penalty ?? -5,
        use_min_actual_when_absent: sourceRules?.use_min_actual_when_absent ?? false,
        three_absences_bonus: sourceRules?.three_absences_bonus ?? 9,
        promotion_count: sourceRules?.promotion_count ?? 1,
        relegation_count: sourceRules?.relegation_count ?? 1,
        allow_merge_courts: sourceRules?.allow_merge_courts ?? false,
        whatsapp_template: sourceRules?.whatsapp_template ?? null,
      }),
      isPt ? 'Erro ao copiar regras da liga' : isEs ? 'Error al copiar reglas de la liga' : 'Failed to copy league rules'
    );

    if ((sourceSlots || []).length > 0) {
      await runOrThrow(
        () => db.from('league_time_slots').insert(
          (sourceSlots || []).map((slot: { slot_time: string; sort_order: number }) => ({
            league_id: duplicated.id,
            slot_time: slot.slot_time,
            sort_order: slot.sort_order,
          }))
        ),
        isPt ? 'Erro ao copiar horários' : isEs ? 'Error al copiar horarios' : 'Failed to copy slots'
      );
    }

    if ((sourceCourts || []).length > 0) {
      await runOrThrow(
        () => db.from('courts').insert(
          (sourceCourts || []).map((court: { court_number: number }) => ({
            league_id: duplicated.id,
            court_number: court.court_number,
          }))
        ),
        isPt ? 'Erro ao copiar quadras' : isEs ? 'Error al copiar canchas' : 'Failed to copy courts'
      );
    }

    if ((sourcePlayers || []).length > 0) {
      await runOrThrow(
        () => db.from('league_players').insert(
          (sourcePlayers || []).map((player: { id: string }) => ({
            league_id: duplicated.id,
            player_id: player.id,
          }))
        ),
        isPt ? 'Erro ao copiar jogadoras' : isEs ? 'Error al copiar jugadoras' : 'Failed to copy players'
      );
    }

    toast.success(
      isPt
        ? `Liga "${duplicated.name}" criada a partir da estrutura atual.`
        : isEs
          ? `Liga "${duplicated.name}" creada a partir de la estructura actual.`
          : `League "${duplicated.name}" created from the current setup.`
    );
    load();
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

    toast.success(isPt ? 'Liga excluida.' : isEs ? 'Liga eliminada.' : 'League deleted.');
    load();
  };

  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const finishedLeagues = leagues.filter((league) => league.is_finished).length;
  const activeLeagues = leagues.length - finishedLeagues;
  const totalPlayers = leagues.reduce((sum, league) => sum + league.playerCount, 0);

  const templateMeta = [
    {
      id: 'custom' as LeagueTemplateKey,
      label: isPt ? 'Livre' : isEs ? 'Libre' : 'Custom',
      detail: isPt ? 'Sem preset. Você ajusta tudo do seu jeito.' : isEs ? 'Sin preset. Ajustas todo a tu manera.' : 'No preset. Adjust everything your way.',
      recommended: true,
    },
    {
      id: 'balanced' as LeagueTemplateKey,
      label: isPt ? 'Balanceado' : isEs ? 'Balanceada' : 'Balanced',
      detail: isPt ? '2 horários, 3 quadras e ciclo padrão' : isEs ? '2 horarios, 3 canchas y ciclo estándar' : '2 slots, 3 courts, default cycle',
      recommended: false,
    },
    {
      id: 'compact' as LeagueTemplateKey,
      label: isPt ? 'Enxuto' : isEs ? 'Compacta' : 'Compact',
      detail: isPt ? '1 horário e operação mais leve' : isEs ? '1 horario y operación más ligera' : '1 slot and lighter setup',
      recommended: false,
    },
    {
      id: 'extended' as LeagueTemplateKey,
      label: isPt ? 'Expandido' : isEs ? 'Extendida' : 'Extended',
      detail: isPt ? '3 horários, mais quadras e ciclo longo' : isEs ? '3 horarios, más canchas y ciclo largo' : '3 slots, more courts, longer cycle',
      recommended: false,
    },
  ];
  const customTemplate = templateMeta[0];
  const presetTemplates = templateMeta.slice(1);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.14),transparent_34%),linear-gradient(140deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-4 sm:p-6 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.42)]">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <span className="inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
              {isPt ? 'Gestão de ligas' : isEs ? 'Gestión de ligas' : 'League management'}
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-[-0.03em] text-neutral-950 sm:text-4xl">{t('leagues', locale)}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600 sm:text-[15px]">
                {isPt
                  ? 'Centralize a operação, acompanhe a capacidade e entre em qualquer liga com uma leitura clara de volume e progresso.'
                  : isEs
                    ? 'Centraliza la operación, sigue la capacidad y entra en cualquier liga con una lectura clara de volumen y progreso.'
                    : 'Centralize operations, track capacity, and enter any league with a clear read on volume and progress.'}
              </p>
            </div>
          </div>

          <button onClick={() => {
            setShowPresetTemplates(false);
            setShowModal(true);
          }} className="btn-primary inline-flex w-full items-center justify-center gap-2 self-start lg:w-auto lg:self-auto">
            <Plus size={16} />
            {isPt ? 'Nova liga' : isEs ? 'Nueva liga' : 'New league'}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label={isPt ? 'Ligas ativas' : isEs ? 'Ligas activas' : 'Active leagues'}
          value={activeLeagues}
          detail={isPt ? 'Em operação' : isEs ? 'En operación' : 'In operation'}
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
          <button onClick={() => {
            setShowPresetTemplates(false);
            setShowModal(true);
          }} className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2 sm:w-auto">
            <Plus size={16} />
            {isPt ? 'Criar primeira liga' : isEs ? 'Crear primera liga' : 'Create first league'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {leagues.map((league) => (
            <div
              key={league.id}
              className="group w-full rounded-[1.75rem] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-5 text-left shadow-[0_22px_48px_-34px_rgba(15,23,42,0.34)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_56px_-30px_rgba(13,148,136,0.28)]"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <button
                  onClick={() => router.push(`/app/leagues/${league.id}/players`)}
                  className="flex min-w-0 flex-1 items-center gap-4 rounded-2xl text-left focus:outline-none focus:ring-2 focus:ring-teal-400/70"
                >
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
                </button>

                <div className="flex w-full items-center justify-between gap-3 md:w-auto md:justify-end">
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
                        duplicateLeague(league);
                      }}
                      aria-label={isPt ? `Duplicar ${league.name}` : isEs ? `Duplicar ${league.name}` : `Duplicate ${league.name}`}
                      className="rounded-2xl p-2.5 text-neutral-400 transition hover:bg-teal-50 hover:text-teal-600"
                      title={isPt ? 'Duplicar liga' : isEs ? 'Duplicar liga' : 'Duplicate league'}
                    >
                      <CopyPlus size={15} />
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        router.push(`/app/leagues/${league.id}/settings`);
                      }}
                      aria-label={isPt ? `Editar configurações de ${league.name}` : isEs ? `Editar configuración de ${league.name}` : `Edit settings for ${league.name}`}
                      className="rounded-2xl p-2.5 text-neutral-400 transition hover:bg-neutral-900/5 hover:text-neutral-700"
                      title={isPt ? 'Editar configurações' : isEs ? 'Editar configuración' : 'Edit settings'}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteLeague(league);
                      }}
                      aria-label={isPt ? `Excluir ${league.name}` : isEs ? `Eliminar ${league.name}` : `Delete ${league.name}`}
                      className="rounded-2xl p-2.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-500"
                      title={isPt ? 'Excluir liga' : isEs ? 'Eliminar liga' : 'Delete league'}
                    >
                      <X size={15} />
                    </button>
                    <ChevronRight size={18} className="text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-teal-600" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-[rgba(9,13,24,0.56)] backdrop-blur-md flex items-end justify-center p-4 sm:items-center" onClick={() => {
          setShowModal(false);
          setShowPresetTemplates(false);
        }}>
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

              <button onClick={() => {
                setShowPresetTemplates(false);
                setShowModal(false);
              }} className="rounded-2xl p-2 text-neutral-400 transition hover:bg-neutral-900/5 hover:text-neutral-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
              <div className="rounded-3xl border border-teal-200/70 bg-teal-500/8 px-4 py-4 text-xs leading-6 text-teal-800">
                {isPt
                  ? 'Comece livre se quiser. Os templates abaixo são apenas atalhos e você pode personalizar toda a liga depois.'
                  : isEs
                    ? 'Puedes empezar en modo libre. Las plantillas son solo atajos y luego personalizas toda la liga.'
                    : 'Start free if you want. Templates are only shortcuts and you can customize the whole league later.'}
              </div>

              <div>
                <label className="label-field">{isPt ? 'Nome da liga' : isEs ? 'Nombre de la liga' : 'League name'}</label>
                <input
                  className={`input-field ${errors.name ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                  placeholder={isPt ? 'Ex: Quinta 19h - Padel da Carla' : isEs ? 'Ej: Jueves 19h - Padel de Carla' : 'Ex: Thursday 7pm - Carla Padel'}
                  value={form.name}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, name: event.target.value }));
                    setErrors({});
                  }}
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                {!errors.name && (
                  <p className="mt-1 text-xs leading-5 text-neutral-400">
                    {isPt
                  ? 'Use qualquer nome que faça sentido para a operação. O identificador interno da liga é gerado automaticamente.'
                      : isEs
                        ? 'Usa cualquier nombre que tenga sentido para la operación. El identificador interno de la liga se genera automáticamente.'
                        : 'Use any name that fits the operation. The league internal ID is generated automatically.'}
                  </p>
                )}
              </div>

              <div>
                <label className="label-field">{isPt ? 'Dia da semana' : isEs ? 'Dia de la semana' : 'Weekday'}</label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
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

              <div>
                <label className="label-field">{isPt ? 'Base de criação' : isEs ? 'Base de creación' : 'Creation base'}</label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => setForm((current) => ({ ...current, template: customTemplate.id }))}
                    className={`rounded-3xl border px-4 py-3 text-left transition ${
                      form.template === customTemplate.id
                        ? 'border-teal-300 bg-teal-500/8 shadow-[0_16px_32px_-24px_rgba(13,148,136,0.4)]'
                        : 'border-neutral-200 bg-white/75 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl ${form.template === customTemplate.id ? 'bg-teal-500 text-white' : 'bg-neutral-900/5 text-neutral-500'}`}>
                        <Sparkles size={14} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-neutral-900">{customTemplate.label}</p>
                          <span className="rounded-full bg-teal-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                            {isPt ? 'Recomendado' : isEs ? 'Recomendada' : 'Recommended'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-neutral-500">{customTemplate.detail}</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setShowPresetTemplates((current) => !current)}
                    className="rounded-3xl border border-neutral-200 bg-white/75 px-4 py-3 text-left text-sm font-semibold text-neutral-700 transition hover:border-neutral-300"
                  >
                    {showPresetTemplates
                      ? (isPt ? 'Ocultar templates rápidos' : isEs ? 'Ocultar plantillas rápidas' : 'Hide quick templates')
                      : (isPt ? 'Ver templates rápidos opcionais' : isEs ? 'Ver plantillas rápidas opcionales' : 'View optional quick templates')}
                  </button>

                  {showPresetTemplates && presetTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setForm((current) => ({ ...current, template: template.id }))}
                      className={`rounded-3xl border px-4 py-3 text-left transition ${
                        form.template === template.id
                          ? 'border-teal-300 bg-teal-500/8 shadow-[0_16px_32px_-24px_rgba(13,148,136,0.4)]'
                          : 'border-neutral-200 bg-white/75 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl ${form.template === template.id ? 'bg-teal-500 text-white' : 'bg-neutral-900/5 text-neutral-500'}`}>
                          <Sparkles size={14} />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-neutral-900">{template.label}</p>
                            {template.recommended && (
                              <span className="rounded-full bg-teal-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                                {isPt ? 'Recomendado' : isEs ? 'Recomendada' : 'Recommended'}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-neutral-500">{template.detail}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-neutral-900/5 p-4 text-xs leading-5 text-neutral-500">
                {isPt
                  ? form.template === 'custom'
                    ? 'Nenhum template é obrigatório. A liga nasce livre e você ajusta quadras, horários e regras depois.'
                    : 'O template só acelera o início. Você pode personalizar quadras, horários e regras depois.'
                  : isEs
                    ? form.template === 'custom'
                      ? 'Ninguna plantilla es obligatoria. La liga nace libre y ajustas canchas, horarios y reglas después.'
                      : 'La plantilla solo acelera el arranque. Puedes personalizar canchas, horarios y reglas después.'
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

type LeagueTemplateKey = 'custom' | 'balanced' | 'compact' | 'extended';

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
