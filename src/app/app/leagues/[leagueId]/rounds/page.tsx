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
import { Plus, Calendar, ChevronRight, X, Clock, Grid3X3, Lock, PlayCircle, AlertCircle } from 'lucide-react';

export default function RoundsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user, locale } = useAuth();
  const { db, run } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const isEs = locale === 'es'; const isPt = locale === 'pt';

  const [league, setLeague] = useState<League | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [slots, setSlots] = useState<LeagueTimeSlot[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de criação
  const [showModal, setShowModal] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [selectedCourts, setSelectedCourts] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (user) loadAll(); }, [user, leagueId]);

  const loadAll = async () => {
    const [{ data: l }, { data: r }, { data: s }, { data: c }] = await Promise.all([
      run(() => db.from('leagues').select('*').eq('id', leagueId).single()),
      run(() => db.from('rounds').select('*').eq('league_id', leagueId).order('number')),
      run(() => db.from('league_time_slots').select('*').eq('league_id', leagueId).order('sort_order')),
      run(() => db.from('courts').select('*').eq('league_id', leagueId).order('court_number')),
    ]);
    setLeague(l);
    setRounds(r || []);
    setSlots(s || []);
    setCourts(c || []);
    setLoading(false);
  };

  const openModal = () => {
    // Pré-preenche data: próxima ocorrência do weekday da liga
    if (league?.weekday) {
      const WEEKDAY_MAP: Record<string, number> = {
        Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
        Thursday: 4, Friday: 5, Saturday: 6,
      };
      const target = WEEKDAY_MAP[league.weekday] ?? 4;
      const now = new Date();
      const diff = (target - now.getDay() + 7) % 7 || 7;
      const next = new Date(now);
      next.setDate(now.getDate() + diff);
      setModalDate(next.toISOString().split('T')[0]);
    }
    // Seleciona todos por default
    setSelectedSlots(new Set(slots.map(s => s.id)));
    setSelectedCourts(new Set(courts.map(c => c.id)));
    setShowModal(true);
  };

  const toggleSlot = (id: string) => setSelectedSlots(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleCourt = (id: string) => setSelectedCourts(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const groupCount = selectedSlots.size * selectedCourts.size;

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

    const nextNumber = rounds.length > 0 ? Math.max(...rounds.map(r => r.number)) + 1 : 1;

    const { data: newRound, error } = await run(
      () => db.from('rounds').insert({
        league_id: leagueId,
        number: nextNumber,
        round_date: modalDate,
        status: 'draft',
      }).select().single(),
      isPt ? 'Erro ao criar rodada' : isEs ? 'Error al crear jornada' : 'Failed to create round'
    );

    if (error || !newRound) { setCreating(false); return; }
    const round = newRound as any;

    // Criar grupos para cada combinação slot × court selecionados
    if (groupCount > 0) {
      const activeSlots = slots.filter(s => selectedSlots.has(s.id));
      const activeCourts = courts.filter(c => selectedCourts.has(c.id));
      const groups = activeSlots.flatMap(s => activeCourts.map(c => ({
        round_id: round.id,
        league_id: leagueId,
        time_slot_id: s.id,
        court_id: c.id,
        is_cancelled: false,
      })));
      await run(() => db.from('round_court_groups').insert(groups));
    }

    setCreating(false);
    setShowModal(false);
    toast.success(isPt ? `Rodada ${nextNumber} criada!` : isEs ? `¡Jornada ${nextNumber} creada!` : `Round ${nextNumber} created!`);
    router.push(`/app/leagues/${leagueId}/rounds/${round.id}`);
  };

  const handleDeleteRound = async (r: Round) => {
    if (r.status === 'closed') {
      toast.warning(isPt ? 'Rodadas fechadas não podem ser excluídas' : isEs ? 'No se pueden eliminar jornadas cerradas' : 'Closed rounds cannot be deleted');
      return;
    }
    const ok = await confirm({
      title: isPt ? `Excluir Rodada ${r.number}` : isEs ? `Eliminar Jornada ${r.number}` : `Delete Round ${r.number}`,
      message: isPt ? 'Todos os grupos e resultados serão perdidos.' : isEs ? 'Todos los grupos y resultados se perderán.' : 'All groups and results will be lost.',
      confirmLabel: isPt ? 'Excluir' : isEs ? 'Eliminar' : 'Delete',
      cancelLabel: isPt ? 'Cancelar' : isEs ? 'Cancelar' : 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;
    await run(() => db.from('rounds').delete().eq('id', r.id));
    toast.success(isPt ? 'Rodada excluída' : isEs ? 'Jornada eliminada' : 'Round deleted');
    loadAll();
  };

  const fmtDate = (d: string) => {
    const locale_str = isPt ? 'pt-BR' : isEs ? 'es-ES' : 'en-US';
    return new Date(d + 'T12:00:00').toLocaleDateString(locale_str, {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  };

  const STATUS_BADGE: Record<string, string> = {
    draft:   'bg-neutral-100 text-neutral-600',
    running: 'bg-blue-100 text-blue-700',
    closed:  'bg-emerald-100 text-emerald-700',
  };
  const STATUS_LABEL = (s: string) => {
    if (s === 'draft')   return isPt ? 'Rascunho' : isEs ? 'Borrador' : 'Draft';
    if (s === 'running') return isPt ? 'Em andamento' : isEs ? 'En curso' : 'In progress';
    return isPt ? 'Fechada' : isEs ? 'Cerrada' : 'Closed';
  };
  const STATUS_ICON = (s: string) => {
    if (s === 'running') return <PlayCircle size={13} />;
    if (s === 'closed')  return <Lock size={13} />;
    return null;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-neutral-800">{t('rounds', locale)}</h1>
          {league && <p className="text-sm text-neutral-500">{league.name}</p>}
        </div>
        <button onClick={openModal} className="btn-primary flex items-center gap-1.5">
          <Plus size={16} />
          {isPt ? 'Nova rodada' : isEs ? 'Nueva jornada' : 'New round'}
        </button>
      </div>

      {/* Aviso se liga não tem slots ou courts */}
      {!loading && (slots.length === 0 || courts.length === 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-0.5">
              {isPt ? 'Liga incompleta' : isEs ? 'Liga incompleta' : 'Incomplete league setup'}
            </p>
            <p>
              {slots.length === 0 && (isPt ? 'Sem horários. ' : isEs ? 'Sin horarios. ' : 'No time slots. ')}
              {courts.length === 0 && (isPt ? 'Sem quadras.' : isEs ? 'Sin canchas.' : 'No courts.')}
              {' '}
              <button onClick={() => router.push(`/app/leagues/${leagueId}/settings`)}
                className="underline font-semibold">
                {isPt ? 'Configurar →' : isEs ? 'Configurar →' : 'Configure →'}
              </button>
            </p>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <SkeletonList count={3} lines={1} />
      ) : rounds.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar size={40} className="text-neutral-200 mx-auto mb-3" />
          <p className="text-neutral-500 mb-4">{t('noRounds', locale)}</p>
          <button onClick={openModal} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} />
            {isPt ? 'Criar primeira rodada' : isEs ? 'Crear primera jornada' : 'Create first round'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rounds.map(r => (
            <button key={r.id}
              onClick={() => router.push(`/app/leagues/${leagueId}/rounds/${r.id}`)}
              className="card-hover w-full p-4 flex items-center justify-between text-left">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-lg flex-shrink-0 ${
                  r.status === 'running' ? 'bg-blue-600 text-white' :
                  r.status === 'closed'  ? 'bg-emerald-600 text-white' :
                  'bg-neutral-200 text-neutral-500'
                }`}>
                  {r.number}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-800 text-sm">
                    {isPt ? `Rodada ${r.number}` : isEs ? `Jornada ${r.number}` : `Round ${r.number}`}
                  </p>
                  <p className="text-xs text-neutral-400">{fmtDate(r.round_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_BADGE[r.status]}`}>
                  {STATUS_ICON(r.status)}
                  {STATUS_LABEL(r.status)}
                </span>
                {r.status !== 'closed' && (
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteRound(r); }}
                    className="p-1.5 text-neutral-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition">
                    <X size={14} />
                  </button>
                )}
                <ChevronRight size={16} className="text-neutral-300" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Sumário de progresso */}
      {!loading && rounds.length > 0 && (
        <div className="mt-5 flex gap-4 text-xs text-neutral-400 font-medium">
          <span>{rounds.filter(r => r.status === 'closed').length} {isPt ? 'fechadas' : isEs ? 'cerradas' : 'closed'}</span>
          <span>{rounds.filter(r => r.status === 'running').length} {isPt ? 'em andamento' : isEs ? 'en curso' : 'in progress'}</span>
          <span>{rounds.filter(r => r.status === 'draft').length} {isPt ? 'rascunho' : isEs ? 'borrador' : 'draft'}</span>
          <span className="ml-auto">{league?.rounds_count ? `${rounds.length} / ${league.rounds_count}` : ''}</span>
        </div>
      )}

      {/* Modal criar rodada */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowModal(false)}>
          <div className="card w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-neutral-100">
              <h2 className="font-bold text-neutral-800 text-base">
                {isPt ? 'Nova Rodada' : isEs ? 'Nueva Jornada' : 'New Round'}
                {rounds.length > 0 && (
                  <span className="ml-2 text-neutral-400 font-normal text-sm">
                    #{Math.max(...rounds.map(r => r.number)) + 1}
                  </span>
                )}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-neutral-400 hover:text-neutral-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Data */}
              <div>
                <label className="label-field">
                  <Calendar size={14} className="inline mr-1" />
                  {isPt ? 'Data da rodada' : isEs ? 'Fecha de la jornada' : 'Round date'}
                </label>
                <input type="date" className="input-field"
                  value={modalDate} onChange={e => setModalDate(e.target.value)} />
              </div>

              {/* Horários */}
              {slots.length > 0 && (
                <div>
                  <label className="label-field">
                    <Clock size={14} className="inline mr-1" />
                    {isPt ? 'Horários' : isEs ? 'Horarios' : 'Time slots'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {slots.map(s => (
                      <button key={s.id} onClick={() => toggleSlot(s.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          selectedSlots.has(s.id)
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                        }`}>
                        {s.slot_time}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quadras */}
              {courts.length > 0 && (
                <div>
                  <label className="label-field">
                    <Grid3X3 size={14} className="inline mr-1" />
                    {isPt ? 'Quadras' : isEs ? 'Canchas' : 'Courts'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {courts.map(c => (
                      <button key={c.id} onClick={() => toggleCourt(c.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          selectedCourts.has(c.id)
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                        }`}>
                        {isPt ? `Nível ${c.court_number}` : isEs ? `Nivel ${c.court_number}` : `Level ${c.court_number}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumo */}
              <div className={`rounded-xl p-3 text-sm font-medium text-center ${
                groupCount > 0 ? 'bg-teal-50 text-teal-700' : 'bg-neutral-50 text-neutral-500'
              }`}>
                {groupCount > 0
                  ? `${isPt ? '→' : '→'} ${groupCount} ${isPt ? 'grupos serão criados' : isEs ? 'grupos se crearán' : 'groups will be created'} (${selectedSlots.size} × ${selectedCourts.size})`
                  : isPt ? 'Nenhum grupo será criado' : isEs ? 'No se crearán grupos' : 'No groups will be created'}
              </div>

              <button onClick={createRound} disabled={creating || !modalDate}
                className="btn-primary w-full flex items-center justify-center gap-2">
                {creating
                  ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{isPt ? 'Criando...' : isEs ? 'Creando...' : 'Creating...'}</>
                  : <><Plus size={16} />{isPt ? 'Criar rodada' : isEs ? 'Crear jornada' : 'Create round'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
