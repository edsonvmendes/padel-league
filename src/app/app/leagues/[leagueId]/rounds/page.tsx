'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useDb } from '@/hooks/useDb';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { SkeletonList } from '@/components/Skeleton';
import { Round, League, LeagueTimeSlot, Court } from '@/types/database';
import { t } from '@/lib/i18n';
import { Plus, Calendar, ChevronRight, X, Grid3X3, Lock, PlayCircle, AlertCircle, Trophy, MapPin } from 'lucide-react';

export default function RoundsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user, locale } = useAuth();
  const { db, run, runOrThrow } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const isEs = locale === 'es';
  const isPt = locale === 'pt';

  const [league, setLeague] = useState<League | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [slots, setSlots] = useState<LeagueTimeSlot[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [selectedCourts, setSelectedCourts] = useState<Set<string>>(new Set());
  const [physicalCourtByCourt, setPhysicalCourtByCourt] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) loadAll();
  }, [user, leagueId]);

  const loadAll = async () => {
    const [{ data: leagueData }, { data: roundData }, { data: slotData }, { data: courtData }] = await Promise.all([
      run(() => db.from('leagues').select('*').eq('id', leagueId).single()),
      run(() => db.from('rounds').select('*').eq('league_id', leagueId).order('number')),
      run(() => db.from('league_time_slots').select('*').eq('league_id', leagueId).order('sort_order')),
      run(() => db.from('courts').select('*').eq('league_id', leagueId).order('court_number')),
    ]);

    setLeague(leagueData);
    setRounds(roundData || []);
    setSlots(slotData || []);
    setCourts(courtData || []);
    setLoading(false);
  };

  const openModal = () => {
    if (league?.weekday) {
      const weekdayMap: Record<string, number> = {
        Sunday: 0,
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6,
      };

      const target = weekdayMap[league.weekday] ?? 4;
      const now = new Date();
      const diff = (target - now.getDay() + 7) % 7 || 7;
      const next = new Date(now);
      next.setDate(now.getDate() + diff);
      setModalDate(next.toISOString().split('T')[0]);
    }

    setSelectedCourts(new Set(courts.map((court) => court.id)));
    setPhysicalCourtByCourt(
      courts.reduce<Record<string, string>>((acc, court) => {
        acc[court.id] = '';
        return acc;
      }, {})
    );
    setShowModal(true);
  };

  const toggleCourt = (id: string) => setSelectedCourts((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const setCourtPhysical = (courtId: string, value: string) => {
    setPhysicalCourtByCourt((current) => ({
      ...current,
      [courtId]: value,
    }));
  };

  const groupCount = selectedCourts.size;

  const createRound = async () => {
    if (slots.length === 0 || courts.length === 0) {
      toast.warning(
        isPt
          ? 'Configure horarios e quadras antes de criar a rodada'
          : isEs
            ? 'Configura horarios y canchas antes de crear la jornada'
            : 'Configure time slots and courts before creating a round'
      );
      router.push(`/app/leagues/${leagueId}/settings`);
      return;
    }

    if (!modalDate) {
      toast.warning(isPt ? 'Selecione uma data' : isEs ? 'Selecciona una fecha' : 'Select a date');
      return;
    }

    setCreating(true);

    try {
      const nextNumber = rounds.length > 0 ? Math.max(...rounds.map((round) => round.number)) + 1 : 1;

      const newRound = await runOrThrow(
        () => db.from('rounds').insert({
          league_id: leagueId,
          number: nextNumber,
          round_date: modalDate,
          status: 'draft',
        }).select().single(),
        isPt ? 'Erro ao criar rodada' : isEs ? 'Error al crear jornada' : 'Failed to create round'
      );

      if (!newRound) return;

      if (groupCount > 0) {
        const defaultSlot = slots[0];
        const activeCourts = courts.filter((court) => selectedCourts.has(court.id));
        const groups = activeCourts.map((court) => ({
          round_id: newRound.id,
          league_id: leagueId,
          time_slot_id: defaultSlot.id,
          court_id: court.id,
          physical_court_number: physicalCourtByCourt[court.id] ? parseInt(physicalCourtByCourt[court.id], 10) : null,
          is_cancelled: false,
        }));

        await runOrThrow(
          () => db.from('round_court_groups').insert(groups),
          isPt ? 'Erro ao criar grupos da rodada' : isEs ? 'Error al crear grupos de la jornada' : 'Failed to create round groups'
        );
      }

      setShowModal(false);
      toast.success(isPt ? `Rodada ${nextNumber} criada!` : isEs ? `Jornada ${nextNumber} creada!` : `Round ${nextNumber} created!`);
      router.push(`/app/leagues/${leagueId}/rounds/${newRound.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRound = async (round: Round) => {
    if (round.status === 'closed') {
      toast.warning(isPt ? 'Rodadas fechadas nao podem ser excluidas' : isEs ? 'No se pueden eliminar jornadas cerradas' : 'Closed rounds cannot be deleted');
      return;
    }

    const ok = await confirm({
      title: isPt ? `Excluir Rodada ${round.number}` : isEs ? `Eliminar Jornada ${round.number}` : `Delete Round ${round.number}`,
      message: isPt ? 'Todos os grupos e resultados serao perdidos.' : isEs ? 'Todos los grupos y resultados se perderan.' : 'All groups and results will be lost.',
      confirmLabel: isPt ? 'Excluir' : isEs ? 'Eliminar' : 'Delete',
      cancelLabel: isPt ? 'Cancelar' : isEs ? 'Cancelar' : 'Cancel',
      variant: 'danger',
    });

    if (!ok) return;

    await runOrThrow(
      () => db.from('rounds').delete().eq('id', round.id),
      isPt ? 'Erro ao excluir rodada' : isEs ? 'Error al eliminar jornada' : 'Failed to delete round'
    );

    toast.success(isPt ? 'Rodada excluida' : isEs ? 'Jornada eliminada' : 'Round deleted');
    loadAll();
  };

  const fmtDate = (value: string) => {
    const localeString = isPt ? 'pt-BR' : isEs ? 'es-ES' : 'en-US';
    return new Date(`${value}T12:00:00`).toLocaleDateString(localeString, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const statusBadge: Record<string, string> = {
    draft: 'bg-neutral-900/5 text-neutral-500 ring-1 ring-neutral-900/6',
    running: 'bg-sky-500/12 text-sky-700 ring-1 ring-sky-500/10',
    closed: 'bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/10',
  };

  const statusLabel = (status: string) => {
    if (status === 'draft') return isPt ? 'Rascunho' : isEs ? 'Borrador' : 'Draft';
    if (status === 'running') return isPt ? 'Em andamento' : isEs ? 'En curso' : 'In progress';
    return isPt ? 'Fechada' : isEs ? 'Cerrada' : 'Closed';
  };

  const statusIcon = (status: string) => {
    if (status === 'running') return <PlayCircle size={13} />;
    if (status === 'closed') return <Lock size={13} />;
    return null;
  };

  const closedCount = rounds.filter((round) => round.status === 'closed').length;
  const runningCount = rounds.filter((round) => round.status === 'running').length;
  const draftCount = rounds.filter((round) => round.status === 'draft').length;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.14),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-6 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.42)]">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <span className="inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
              {isPt ? 'Agenda operacional' : isEs ? 'Agenda operativa' : 'Round calendar'}
            </span>
            <div>
              <h1 className="text-3xl font-black tracking-[-0.03em] text-neutral-950 sm:text-4xl">{t('rounds', locale)}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600 sm:text-[15px]">
                {league?.name ? league.name : ''}
                {league?.name ? ' · ' : ''}
                {isPt
                  ? 'Controle abertura, progresso e historico de rodadas com visao clara de capacidade e status.'
                  : isEs
                    ? 'Controla apertura, progreso e historial de jornadas con una lectura clara de capacidad y estado.'
                    : 'Track launch, progress, and round history with a clear read on capacity and status.'}
              </p>
            </div>
          </div>

          <button onClick={openModal} className="btn-primary inline-flex items-center gap-2 self-start lg:self-auto">
            <Plus size={16} />
            {isPt ? 'Nova rodada' : isEs ? 'Nueva jornada' : 'New round'}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <RoundMetric label={isPt ? 'Total' : isEs ? 'Total' : 'Total'} value={rounds.length} tone="teal" />
        <RoundMetric label={isPt ? 'Fechadas' : isEs ? 'Cerradas' : 'Closed'} value={closedCount} tone="emerald" />
        <RoundMetric label={isPt ? 'Em andamento' : isEs ? 'En curso' : 'Running'} value={runningCount} tone="sky" />
        <RoundMetric label={isPt ? 'Rascunho' : isEs ? 'Borrador' : 'Draft'} value={draftCount} tone="neutral" />
      </div>

      {!loading && (slots.length === 0 || courts.length === 0) && (
        <div className="rounded-[1.6rem] border border-amber-200 bg-amber-50/90 p-4 shadow-[0_18px_34px_-30px_rgba(180,83,9,0.28)]">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">
                {isPt ? 'Liga incompleta' : isEs ? 'Liga incompleta' : 'Incomplete league setup'}
              </p>
              <p className="mt-1 leading-6">
                {slots.length === 0 && (isPt ? 'Sem horarios. ' : isEs ? 'Sin horarios. ' : 'No time slots. ')}
                {courts.length === 0 && (isPt ? 'Sem quadras.' : isEs ? 'Sin canchas.' : 'No courts.')}
                {' '}
                <button onClick={() => router.push(`/app/leagues/${leagueId}/settings`)} className="font-semibold underline">
                  {isPt ? 'Configurar agora' : isEs ? 'Configurar ahora' : 'Configure now'}
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-5 sm:p-6">
          <SkeletonList count={4} lines={1} />
        </div>
      ) : rounds.length === 0 ? (
        <div className="card p-10 sm:p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-[0_18px_38px_-22px_rgba(13,148,136,0.75)]">
            <Calendar size={28} />
          </div>
          <p className="text-lg font-bold text-neutral-900">{t('noRounds', locale)}</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
            {isPt
              ? 'Crie a primeira rodada para liberar grupos, alocacao de quadras e operacao semanal.'
              : isEs
                ? 'Crea la primera jornada para liberar grupos, asignacion de canchas y operacion semanal.'
                : 'Create the first round to unlock group creation, court allocation, and weekly operations.'}
          </p>
          <button onClick={openModal} className="btn-primary mt-6 inline-flex items-center gap-2">
            <Plus size={16} />
            {isPt ? 'Criar primeira rodada' : isEs ? 'Crear primera jornada' : 'Create first round'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => (
            <button
              key={round.id}
              onClick={() => router.push(`/app/leagues/${leagueId}/rounds/${round.id}`)}
              className="group w-full rounded-[1.7rem] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-5 text-left shadow-[0_22px_48px_-34px_rgba(15,23,42,0.32)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_56px_-30px_rgba(13,148,136,0.28)]"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-lg font-black shadow-[0_18px_36px_-24px_rgba(15,23,42,0.28)] ${
                    round.status === 'running'
                      ? 'bg-sky-600 text-white'
                      : round.status === 'closed'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-900/8 text-neutral-500'
                  }`}>
                    {round.number}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-neutral-900">
                        {isPt ? `Rodada ${round.number}` : isEs ? `Jornada ${round.number}` : `Round ${round.number}`}
                      </p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadge[round.status]}`}>
                        {statusIcon(round.status)}
                        {statusLabel(round.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-neutral-500">{fmtDate(round.round_date)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  {round.status !== 'closed' && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteRound(round);
                      }}
                      className="rounded-2xl p-2.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <X size={15} />
                    </button>
                  )}
                  <ChevronRight size={18} className="text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-teal-600" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && rounds.length > 0 && (
        <div className="card p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-neutral-500">
              <span className="rounded-full bg-neutral-900/5 px-2.5 py-1">{closedCount} {isPt ? 'fechadas' : isEs ? 'cerradas' : 'closed'}</span>
              <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-sky-700">{runningCount} {isPt ? 'em andamento' : isEs ? 'en curso' : 'running'}</span>
              <span className="rounded-full bg-neutral-900/5 px-2.5 py-1">{draftCount} {isPt ? 'rascunho' : isEs ? 'borrador' : 'draft'}</span>
            </div>
            <div className="sm:ml-auto text-sm font-semibold text-neutral-500">
              {league?.rounds_count ? `${rounds.length} / ${league.rounds_count}` : ''}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-[rgba(9,13,24,0.56)] backdrop-blur-md flex items-end justify-center p-4 sm:items-center" onClick={() => setShowModal(false)}>
          <div
            className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] shadow-[0_34px_90px_-44px_rgba(15,23,42,0.6)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
                  {isPt ? 'Nova rodada' : isEs ? 'Nueva jornada' : 'New round'}
                </p>
                <h2 className="mt-1 text-lg font-bold text-neutral-900">
                  {isPt ? 'Criar estrutura' : isEs ? 'Crear estructura' : 'Build round'}
                  {rounds.length > 0 && <span className="ml-2 text-sm font-normal text-neutral-400">#{Math.max(...rounds.map((round) => round.number)) + 1}</span>}
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} className="rounded-2xl p-2 text-neutral-400 transition hover:bg-neutral-900/5 hover:text-neutral-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div>
                <label className="label-field">
                  <Calendar size={14} className="mr-1 inline" />
                  {isPt ? 'Data da rodada' : isEs ? 'Fecha de la jornada' : 'Round date'}
                </label>
                <input type="date" className="input-field" value={modalDate} onChange={(event) => setModalDate(event.target.value)} />
              </div>

              {courts.length > 0 && (
                <div>
                  <label className="label-field">
                    <Grid3X3 size={14} className="mr-1 inline" />
                    {isPt ? 'Quadras' : isEs ? 'Canchas' : 'Courts'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {courts.map((court) => (
                      <button
                        key={court.id}
                        onClick={() => toggleCourt(court.id)}
                        className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                          selectedCourts.has(court.id) ? 'bg-emerald-600 text-white shadow-[0_14px_28px_-18px_rgba(5,150,105,0.55)]' : 'bg-neutral-900/5 text-neutral-500 hover:bg-neutral-900/8'
                        }`}
                      >
                        {isPt ? `Nivel ${court.court_number}` : isEs ? `Nivel ${court.court_number}` : `Level ${court.court_number}`}
                      </button>
                    ))}
                  </div>

                  {selectedCourts.size > 0 && (
                    <div className="mt-4 space-y-2">
                      {courts.filter((court) => selectedCourts.has(court.id)).map((court) => (
                        <div key={court.id} className="flex flex-col gap-2 rounded-3xl bg-neutral-900/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                            <MapPin size={14} className="text-orange-500" />
                            {isPt ? `Nivel ${court.court_number}` : isEs ? `Nivel ${court.court_number}` : `Level ${court.court_number}`}
                          </div>
                          <select
                            value={physicalCourtByCourt[court.id] || ''}
                            onChange={(event) => setCourtPhysical(court.id, event.target.value)}
                            className="rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700"
                          >
                            <option value="">
                              {isPt ? 'Sem quadra fisica' : isEs ? 'Sin cancha fisica' : 'No physical court'}
                            </option>
                            {Array.from({ length: league?.physical_courts_count || 0 }, (_, index) => index + 1).map((num) => (
                              <option key={num} value={num}>
                                {isPt ? `Fisica ${num}` : isEs ? `Fisica ${num}` : `Physical ${num}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className={`rounded-3xl px-4 py-4 text-sm font-semibold ${groupCount > 0 ? 'bg-teal-500/10 text-teal-700 ring-1 ring-teal-500/12' : 'bg-neutral-900/5 text-neutral-500 ring-1 ring-neutral-900/6'}`}>
                {groupCount > 0
                  ? `${groupCount} ${isPt ? 'jogos serao criados' : isEs ? 'juegos se crearan' : 'games will be created'}`
                  : isPt ? 'Nenhum grupo sera criado' : isEs ? 'No se crearan grupos' : 'No groups will be created'}
              </div>

              {slots.length > 0 && (
                <div className="rounded-3xl bg-neutral-900/5 px-4 py-4 text-xs leading-6 text-neutral-500">
                  {isPt
                    ? `Todos os jogos nascem com horario inicial em ${slots[0].slot_time}. Depois voce ajusta cada um individualmente na tela da rodada.`
                    : isEs
                      ? `Todos los juegos nacen con horario inicial en ${slots[0].slot_time}. Despues ajustas cada uno individualmente en la pantalla de la jornada.`
                      : `All games start with ${slots[0].slot_time} as the initial time slot. You can adjust each one individually on the round screen.`}
                </div>
              )}

              {selectedCourts.size > 0 && (
                <div className="rounded-3xl bg-neutral-900/5 px-4 py-4 text-xs leading-6 text-neutral-500">
                  {isPt
                    ? 'A quadra fisica inicial tambem pode ser definida por jogo aqui. Se deixar vazio, voce escolhe depois.'
                    : isEs
                      ? 'La cancha fisica inicial tambien puede definirse por juego aqui. Si lo dejas vacio, la eliges despues.'
                      : 'The initial physical court can also be set per game here. Leave it empty if you want to choose it later.'}
                </div>
              )}

              <button onClick={createRound} disabled={creating || !modalDate} className="btn-primary flex w-full items-center justify-center gap-2">
                {creating ? (
                  <>
                    <span className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    {isPt ? 'Criando...' : isEs ? 'Creando...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    {isPt ? 'Criar rodada' : isEs ? 'Crear jornada' : 'Create round'}
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

function RoundMetric({ label, value, tone }: {
  label: string;
  value: number;
  tone: 'teal' | 'emerald' | 'sky' | 'neutral';
}) {
  const toneClass = {
    teal: 'bg-teal-500/10 border-teal-200/70',
    emerald: 'bg-emerald-500/10 border-emerald-200/70',
    sky: 'bg-sky-500/10 border-sky-200/70',
    neutral: 'bg-neutral-900/5 border-neutral-900/6',
  }[tone];

  return (
    <div className={`rounded-[1.5rem] border ${toneClass} px-5 py-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.3)]`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-neutral-950">{value}</p>
    </div>
  );
}
