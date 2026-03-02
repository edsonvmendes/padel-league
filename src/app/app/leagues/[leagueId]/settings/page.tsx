'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useDb, validate } from '@/hooks/useDb';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { SkeletonList } from '@/components/Skeleton';
import { League, LeagueTimeSlot, Court, Rules, Weekday } from '@/types/database';
import { Settings, Clock, Grid3X3, Trophy, ChevronLeft, Plus, Save, Trash2 } from 'lucide-react';

type Tab = 'general' | 'slots' | 'courts' | 'rules';

export default function LeagueSettingsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { locale } = useAuth();
  const router = useRouter();
  const { db, run } = useDb();
  const toast = useToast();
  const isEs = locale === 'es';
  const isPt = locale === 'pt';

  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [loading, setLoading] = useState(true);
  const [league, setLeague] = useState<League | null>(null);
  const [slots, setSlots] = useState<LeagueTimeSlot[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [rules, setRules] = useState<Rules | null>(null);

  useEffect(() => {
    loadAll();
  }, [leagueId]);

  const loadAll = async () => {
    const [{ data: leagueData }, { data: slotData }, { data: courtData }, { data: rulesData }] = await Promise.all([
      run(() => db.from('leagues').select('*').eq('id', leagueId).single()),
      run(() => db.from('league_time_slots').select('*').eq('league_id', leagueId).order('sort_order')),
      run(() => db.from('courts').select('*').eq('league_id', leagueId).order('court_number')),
      run(() => db.from('rules').select('*').eq('scope', 'league').eq('league_id', leagueId).single()),
    ]);

    setLeague(leagueData);
    setSlots(slotData || []);
    setCourts(courtData || []);
    setRules(rulesData);
    setLoading(false);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: isPt ? 'Geral' : isEs ? 'General' : 'General', icon: <Settings size={15} /> },
    { id: 'slots', label: isPt ? 'Horarios' : isEs ? 'Horarios' : 'Time Slots', icon: <Clock size={15} /> },
    { id: 'courts', label: isPt ? 'Quadras' : isEs ? 'Canchas' : 'Courts', icon: <Grid3X3 size={15} /> },
    { id: 'rules', label: isPt ? 'Regras' : isEs ? 'Reglas' : 'Rules', icon: <Trophy size={15} /> },
  ];

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)]">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-neutral-200 animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-28 rounded-full bg-neutral-200 animate-pulse" />
              <div className="h-3 w-36 rounded-full bg-neutral-100 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="card p-5 sm:p-6">
          <SkeletonList count={3} lines={2} />
        </div>
      </div>
    );
  }

  if (!league) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.14),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-6 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.42)]">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
        <div className="relative flex items-start gap-4">
          <button
            onClick={() => router.back()}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/80 text-neutral-500 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.28)] transition hover:text-neutral-800"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
              {isPt ? 'Centro de configuracao' : isEs ? 'Centro de configuracion' : 'Configuration center'}
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.03em] text-neutral-950 sm:text-4xl">
              {isPt ? 'Configuracoes' : isEs ? 'Configuracion' : 'Settings'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-neutral-600 sm:text-[15px]">
              {league.name} · {isPt ? 'Regras, capacidade e estrutura operacional da liga.' : isEs ? 'Reglas, capacidad y estructura operativa de la liga.' : 'Rules, capacity, and operational structure for this league.'}
            </p>
          </div>
        </div>
      </section>

      <div className="card p-2">
        <div className="flex gap-1 overflow-x-auto rounded-[1.5rem] bg-neutral-900/5 p-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id ? 'bg-white text-neutral-900 shadow-[0_14px_28px_-20px_rgba(15,23,42,0.3)]' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'general' && (
        <GeneralTab
          league={league}
          locale={locale}
          onSaved={(updated) => {
            setLeague(updated);
            toast.success(isPt ? 'Salvo!' : isEs ? 'Guardado!' : 'Saved!');
          }}
        />
      )}

      {activeTab === 'slots' && (
        <SlotsTab
          leagueId={leagueId}
          slots={slots}
          locale={locale}
          onChanged={() => {
            loadAll();
          }}
        />
      )}

      {activeTab === 'courts' && (
        <CourtsTab
          leagueId={leagueId}
          courts={courts}
          league={league}
          locale={locale}
          onChanged={() => {
            loadAll();
          }}
        />
      )}

      {activeTab === 'rules' && rules && (
        <RulesTab
          rules={rules}
          locale={locale}
          onSaved={() => {
            loadAll();
            toast.success(isPt ? 'Regras salvas!' : isEs ? 'Reglas guardadas!' : 'Rules saved!');
          }}
        />
      )}
    </div>
  );
}

function GeneralTab({ league, locale, onSaved }: { league: League; locale: string; onSaved: (l: League) => void }) {
  const { db, runOrThrow } = useDb();
  const isEs = locale === 'es';
  const isPt = locale === 'pt';

  const weekdays: Weekday[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const weekdayLabel: Record<Weekday, string> = {
    Monday: isPt ? 'Seg' : isEs ? 'Lun' : 'Mon',
    Tuesday: isPt ? 'Ter' : isEs ? 'Mar' : 'Tue',
    Wednesday: isPt ? 'Qua' : isEs ? 'Mie' : 'Wed',
    Thursday: isPt ? 'Qui' : isEs ? 'Jue' : 'Thu',
    Friday: isPt ? 'Sex' : isEs ? 'Vie' : 'Fri',
    Saturday: isPt ? 'Sab' : isEs ? 'Sab' : 'Sat',
    Sunday: isPt ? 'Dom' : isEs ? 'Dom' : 'Sun',
  };

  const [form, setForm] = useState({
    name: league.name,
    weekday: league.weekday,
    rounds_count: league.rounds_count,
    max_courts_per_slot: league.max_courts_per_slot,
    physical_courts_count: league.physical_courts_count,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const nextErrors = validate(form, {
      name: { required: true, minLength: 2, maxLength: 60, label: isPt ? 'Nome' : isEs ? 'Nombre' : 'Name' },
      rounds_count: { required: true, min: 1, max: 30, label: isPt ? 'Rodadas' : isEs ? 'Jornadas' : 'Rounds' },
      max_courts_per_slot: { required: true, min: 1, max: 12, label: isPt ? 'Quadras nivel' : isEs ? 'Canchas nivel' : 'Level courts' },
      physical_courts_count: { required: true, min: 1, max: 20, label: isPt ? 'Quadras fisicas' : isEs ? 'Canchas fisicas' : 'Physical courts' },
    });

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);

    try {
      const data = await runOrThrow(
        () => db.from('leagues').update(form).eq('id', league.id).select().single(),
        isPt ? 'Erro ao salvar' : isEs ? 'Error al guardar' : 'Save failed'
      );

      if (data) onSaved(data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5 sm:p-6 space-y-5">
      <FormField label={isPt ? 'Nome da liga' : isEs ? 'Nombre de la liga' : 'League name'} error={errors.name}>
        <input
          className={`input-field ${errors.name ? 'border-red-400' : ''}`}
          value={form.name}
          onChange={(event) => {
            setForm((current) => ({ ...current, name: event.target.value }));
            setErrors((current) => ({ ...current, name: '' }));
          }}
        />
      </FormField>

      <FormField label={isPt ? 'Dia de jogo' : isEs ? 'Dia de juego' : 'Match day'}>
        <div className="grid grid-cols-7 gap-2">
          {weekdays.map((day) => (
            <button
              key={day}
              onClick={() => setForm((current) => ({ ...current, weekday: day }))}
              className={`rounded-2xl py-2.5 text-xs font-semibold transition ${
                form.weekday === day ? 'bg-neutral-900 text-white shadow-[0_14px_28px_-18px_rgba(15,23,42,0.7)]' : 'bg-neutral-900/5 text-neutral-500 hover:bg-neutral-900/8'
              }`}
            >
              {weekdayLabel[day]}
            </button>
          ))}
        </div>
      </FormField>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label={isPt ? 'Rodadas' : isEs ? 'Jornadas' : 'Rounds'} error={errors.rounds_count}>
          <input
            type="number"
            min={1}
            max={30}
            className={`input-field ${errors.rounds_count ? 'border-red-400' : ''}`}
            value={form.rounds_count}
            onChange={(event) => {
              setForm((current) => ({ ...current, rounds_count: +event.target.value }));
              setErrors((current) => ({ ...current, rounds_count: '' }));
            }}
          />
        </FormField>

        <FormField label={isPt ? 'Quadras nivel' : isEs ? 'Canchas nivel' : 'Level courts'} error={errors.max_courts_per_slot}>
          <input
            type="number"
            min={1}
            max={12}
            className={`input-field ${errors.max_courts_per_slot ? 'border-red-400' : ''}`}
            value={form.max_courts_per_slot}
            onChange={(event) => {
              setForm((current) => ({ ...current, max_courts_per_slot: +event.target.value }));
              setErrors((current) => ({ ...current, max_courts_per_slot: '' }));
            }}
          />
        </FormField>

        <FormField label={isPt ? 'Quadras fisicas' : isEs ? 'Canchas fisicas' : 'Physical courts'} error={errors.physical_courts_count}>
          <input
            type="number"
            min={1}
            max={20}
            className={`input-field ${errors.physical_courts_count ? 'border-red-400' : ''}`}
            value={form.physical_courts_count}
            onChange={(event) => {
              setForm((current) => ({ ...current, physical_courts_count: +event.target.value }));
              setErrors((current) => ({ ...current, physical_courts_count: '' }));
            }}
          />
        </FormField>
      </div>

      <SaveButton saving={saving} onClick={handleSave} locale={locale} />
    </div>
  );
}

function SlotsTab({ leagueId, slots, locale, onChanged }: { leagueId: string; slots: LeagueTimeSlot[]; locale: string; onChanged: () => void }) {
  const { db, runOrThrow } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const isEs = locale === 'es';
  const isPt = locale === 'pt';
  const [newTime, setNewTime] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newTime.match(/^\d{2}:\d{2}$/)) {
      toast.warning(isPt ? 'Horario invalido (HH:MM)' : isEs ? 'Horario invalido (HH:MM)' : 'Invalid time (HH:MM)');
      return;
    }

    if (slots.some((slot) => slot.slot_time === newTime)) {
      toast.warning(isPt ? 'Horario ja existe' : isEs ? 'Horario ya existe' : 'Time slot already exists');
      return;
    }

    setAdding(true);

    try {
      await runOrThrow(() => db.from('league_time_slots').insert({ league_id: leagueId, slot_time: newTime, sort_order: slots.length }));
      setNewTime('');
      toast.success(isPt ? 'Horario adicionado!' : isEs ? 'Horario agregado!' : 'Slot added!');
      onChanged();
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (slot: LeagueTimeSlot) => {
    const ok = await confirm({
      title: isPt ? 'Remover horario' : isEs ? 'Eliminar horario' : 'Remove slot',
      message: `"${slot.slot_time}"`,
      confirmLabel: isPt ? 'Remover' : isEs ? 'Eliminar' : 'Remove',
      cancelLabel: isPt ? 'Cancelar' : isEs ? 'Cancelar' : 'Cancel',
      variant: 'danger',
    });

    if (!ok) return;

    await runOrThrow(() => db.from('league_time_slots').delete().eq('id', slot.id));
    toast.success(isPt ? 'Removido' : isEs ? 'Eliminado' : 'Removed');
    onChanged();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const reordered = [...slots];
    const targetIndex = index + dir;
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    await Promise.all(reordered.map((slot, nextIndex) => runOrThrow(() => db.from('league_time_slots').update({ sort_order: nextIndex }).eq('id', slot.id))));
    onChanged();
  };

  return (
    <div className="card p-5 sm:p-6 space-y-5">
      <div className="rounded-[1.5rem] bg-neutral-900/5 px-4 py-4 text-sm leading-6 text-neutral-600">
        {isPt ? 'Cada horario cria uma camada de quadras por rodada.' : isEs ? 'Cada horario crea una capa de canchas por jornada.' : 'Each slot creates a layer of courts per round.'}
      </div>

      <div className="space-y-3">
        {slots.map((slot, index) => (
          <div key={slot.id} className="flex items-center gap-3 rounded-[1.4rem] border border-white/80 bg-white/70 px-4 py-3 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.2)]">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-700">
              <Clock size={15} />
            </div>
            <span className="flex-1 text-sm font-bold text-neutral-900">{slot.slot_time}</span>
            <div className="flex gap-1">
              {index > 0 && <ArrowBtn onClick={() => move(index, -1)} dir="up" />}
              {index < slots.length - 1 && <ArrowBtn onClick={() => move(index, 1)} dir="down" />}
              <button onClick={() => handleDelete(slot)} className="rounded-2xl p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {slots.length === 0 && (
          <div className="rounded-[1.5rem] border border-dashed border-neutral-200 bg-white/60 py-10 text-center text-sm font-medium text-neutral-400">
            {isPt ? 'Nenhum horario cadastrado' : isEs ? 'Sin horarios' : 'No time slots yet'}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4 sm:flex-row">
        <input type="time" className="input-field flex-1" value={newTime} onChange={(event) => setNewTime(event.target.value)} />
        <button onClick={handleAdd} disabled={adding || !newTime} className="btn-primary inline-flex items-center justify-center gap-2 px-5">
          <Plus size={16} />
          {isPt ? 'Adicionar' : isEs ? 'Agregar' : 'Add'}
        </button>
      </div>
    </div>
  );
}

function CourtsTab({ leagueId, courts, league, locale, onChanged }: {
  leagueId: string;
  courts: Court[];
  league: League;
  locale: string;
  onChanged: () => void;
}) {
  const { db, runOrThrow } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const isEs = locale === 'es';
  const isPt = locale === 'pt';
  const [syncing, setSyncing] = useState(false);
  const inSync = courts.length === league.max_courts_per_slot;

  const syncCourts = async () => {
    setSyncing(true);

    try {
      const target = league.max_courts_per_slot;

      if (target > courts.length) {
        const toAdd = Array.from({ length: target - courts.length }, (_, index) => ({
          league_id: leagueId,
          court_number: courts.length + index + 1,
        }));
        await runOrThrow(() => db.from('courts').insert(toAdd));
      } else {
        const toRemove = courts.slice(target).map((court) => court.id);
        await runOrThrow(() => db.from('courts').delete().in('id', toRemove));
      }

      toast.success(isPt ? 'Quadras sincronizadas!' : isEs ? 'Canchas sincronizadas!' : 'Courts synced!');
      onChanged();
    } finally {
      setSyncing(false);
    }
  };

  const handleAdd = async () => {
    const next = courts.length > 0 ? Math.max(...courts.map((court) => court.court_number)) + 1 : 1;
    await runOrThrow(() => db.from('courts').insert({ league_id: leagueId, court_number: next }));
    toast.success(isPt ? 'Quadra adicionada!' : isEs ? 'Cancha agregada!' : 'Court added!');
    onChanged();
  };

  const handleDelete = async (court: Court) => {
    const ok = await confirm({
      title: isPt ? `Remover quadra ${court.court_number}` : isEs ? `Eliminar cancha ${court.court_number}` : `Remove court ${court.court_number}`,
      message: isPt ? 'Grupos desta quadra em rodadas existentes serao afetados.' : isEs ? 'Los grupos de esta cancha en jornadas existentes seran afectados.' : 'Groups for this court in existing rounds may be affected.',
      confirmLabel: isPt ? 'Remover' : isEs ? 'Eliminar' : 'Remove',
      cancelLabel: isPt ? 'Cancelar' : isEs ? 'Cancelar' : 'Cancel',
      variant: 'warning',
    });

    if (!ok) return;

    await runOrThrow(() => db.from('courts').delete().eq('id', court.id));
    toast.success(isPt ? 'Removida' : isEs ? 'Eliminada' : 'Removed');
    onChanged();
  };

  return (
    <div className="card p-5 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-neutral-500">
          {courts.length} {isPt ? 'quadras' : isEs ? 'canchas' : 'courts'} · {isPt ? 'configurado para' : isEs ? 'configurado para' : 'configured for'} {league.max_courts_per_slot}
        </p>
        {!inSync && (
          <button onClick={syncCourts} disabled={syncing} className="inline-flex items-center justify-center rounded-2xl bg-teal-500/10 px-4 py-2 text-xs font-semibold text-teal-700 ring-1 ring-teal-500/12 transition hover:bg-teal-500/15">
            {syncing ? '...' : `${isPt ? 'Sincronizar' : isEs ? 'Sincronizar' : 'Sync'} -> ${league.max_courts_per_slot}`}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {courts.map((court) => (
          <div key={court.id} className="flex items-center justify-between rounded-[1.4rem] border border-white/80 bg-white/70 px-4 py-3 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.2)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-sm font-bold text-emerald-700">
                {court.court_number}
              </div>
              <span className="text-sm font-bold text-neutral-900">
                {isPt ? `Nivel ${court.court_number}` : isEs ? `Nivel ${court.court_number}` : `Level ${court.court_number}`}
              </span>
            </div>
            <button onClick={() => handleDelete(court)} className="rounded-2xl p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-500">
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {courts.length === 0 && (
          <div className="rounded-[1.5rem] border border-dashed border-neutral-200 bg-white/60 py-10 text-center text-sm font-medium text-neutral-400">
            {isPt ? 'Nenhuma quadra cadastrada' : isEs ? 'Sin canchas' : 'No courts yet'}
          </div>
        )}
      </div>

      <button onClick={handleAdd} className="flex w-full items-center justify-center gap-2 rounded-[1.4rem] border border-dashed border-neutral-200 bg-white/60 py-4 text-sm font-semibold text-neutral-500 transition hover:border-teal-300 hover:text-teal-700">
        <Plus size={16} />
        {isPt ? 'Adicionar quadra' : isEs ? 'Agregar cancha' : 'Add court'}
      </button>

      {!inSync && (
        <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50/90 p-4 text-xs leading-6 text-amber-800">
          {isPt
            ? `Aba "Geral" define ${league.max_courts_per_slot} quadras, mas existem ${courts.length}.`
            : isEs
              ? `"General" define ${league.max_courts_per_slot} canchas, pero hay ${courts.length}.`
              : `"General" tab defines ${league.max_courts_per_slot} courts, but there are ${courts.length}.`}
        </div>
      )}
    </div>
  );
}

function RulesTab({ rules, locale, onSaved }: { rules: Rules; locale: string; onSaved: () => void }) {
  const { db, runOrThrow } = useDb();
  const isEs = locale === 'es';
  const isPt = locale === 'pt';
  const [form, setForm] = useState<Rules>(rules);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const updateField = (field: keyof Rules, value: Rules[keyof Rules]) => setForm((current) => ({ ...current, [field]: value }));

  const handleSave = async () => {
    const nextErrors = validate(form, {
      absence_penalty: { required: true, min: -20, max: 0, label: isPt ? 'Penalidade' : isEs ? 'Penalizacion' : 'Penalty' },
      three_absences_bonus: { required: true, min: 0, max: 30, label: isPt ? 'Bonus' : isEs ? 'Bono' : 'Bonus' },
      promotion_count: { required: true, min: 0, max: 6, label: isPt ? 'Promocao' : isEs ? 'Ascenso' : 'Promotion' },
      relegation_count: { required: true, min: 0, max: 6, label: isPt ? 'Rebaixamento' : isEs ? 'Descenso' : 'Relegation' },
    });

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);

    try {
      const { id, ...rest } = form;
      await runOrThrow(
        () => db.from('rules').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id),
        isPt ? 'Erro ao salvar regras' : isEs ? 'Error al guardar reglas' : 'Failed to save rules'
      );
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5 sm:p-6 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label={isPt ? 'Penalidade ausencia' : isEs ? 'Penalizacion ausencia' : 'Absence penalty'}
          hint={isPt ? 'Valor negativo, ex: -5' : isEs ? 'Valor negativo, ej: -5' : 'Negative value, e.g. -5'}
          error={errors.absence_penalty}
        >
          <input
            type="number"
            max={0}
            className={`input-field ${errors.absence_penalty ? 'border-red-400' : ''}`}
            value={form.absence_penalty}
            onChange={(event) => {
              updateField('absence_penalty', parseInt(event.target.value) || 0);
              setErrors((current) => ({ ...current, absence_penalty: '' }));
            }}
          />
        </FormField>

        <FormField
          label={isPt ? 'Bonus 3 ausencias' : isEs ? 'Bono 3 ausencias' : '3-absences bonus'}
          error={errors.three_absences_bonus}
        >
          <input
            type="number"
            min={0}
            className={`input-field ${errors.three_absences_bonus ? 'border-red-400' : ''}`}
            value={form.three_absences_bonus}
            onChange={(event) => {
              updateField('three_absences_bonus', parseInt(event.target.value) || 0);
              setErrors((current) => ({ ...current, three_absences_bonus: '' }));
            }}
          />
        </FormField>
      </div>

      <RuleToggle
        label={isPt ? 'Usar minimo real quando ausente' : isEs ? 'Usar minimo real si ausente' : 'Use actual min when absent'}
        hint={isPt ? 'Se o minimo real for pior que a penalidade, usa o minimo real' : isEs ? 'Si el minimo real es peor que la penalizacion, usar el minimo real' : 'If actual min is worse than penalty, use actual min'}
        value={form.use_min_actual_when_absent}
        onChange={(value) => updateField('use_min_actual_when_absent', value)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={isPt ? 'Promocao (top N)' : isEs ? 'Ascenso (top N)' : 'Promotion (top N)'} error={errors.promotion_count}>
          <input
            type="number"
            min={0}
            max={6}
            className={`input-field ${errors.promotion_count ? 'border-red-400' : ''}`}
            value={form.promotion_count}
            onChange={(event) => {
              updateField('promotion_count', parseInt(event.target.value) || 0);
              setErrors((current) => ({ ...current, promotion_count: '' }));
            }}
          />
        </FormField>

        <FormField label={isPt ? 'Rebaixamento (bottom N)' : isEs ? 'Descenso (bottom N)' : 'Relegation (bottom N)'} error={errors.relegation_count}>
          <input
            type="number"
            min={0}
            max={6}
            className={`input-field ${errors.relegation_count ? 'border-red-400' : ''}`}
            value={form.relegation_count}
            onChange={(event) => {
              updateField('relegation_count', parseInt(event.target.value) || 0);
              setErrors((current) => ({ ...current, relegation_count: '' }));
            }}
          />
        </FormField>
      </div>

      <RuleToggle
        label={isPt ? 'Permitir fundir quadras' : isEs ? 'Permitir unir canchas' : 'Allow merging courts'}
        hint={isPt ? 'Fundir quadras quando ha muitas ausencias' : isEs ? 'Unir canchas cuando hay muchas ausencias' : 'Merge courts when many absences'}
        value={form.allow_merge_courts}
        onChange={(value) => updateField('allow_merge_courts', value)}
      />

      <FormField
        label={isPt ? 'Template WhatsApp' : isEs ? 'Plantilla WhatsApp' : 'WhatsApp template'}
        hint={isPt ? 'Deixe vazio para usar o template padrao' : isEs ? 'Vacio = template por defecto' : 'Empty = default template'}
      >
        <textarea
          className="input-field h-28 resize-y text-sm"
          value={form.whatsapp_template || ''}
          onChange={(event) => updateField('whatsapp_template', event.target.value || null)}
        />
      </FormField>

      <SaveButton
        saving={saving}
        onClick={handleSave}
        locale={locale}
        label={isPt ? 'Salvar regras' : isEs ? 'Guardar reglas' : 'Save rules'}
      />
    </div>
  );
}

function FormField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{label}</label>
      {children}
      {hint && !error && <p className="text-xs leading-5 text-neutral-400">{hint}</p>}
      {error && <p className="text-xs leading-5 text-red-500">{error}</p>}
    </div>
  );
}

function RuleToggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[1.4rem] bg-neutral-900/5 px-4 py-4">
      <div>
        <p className="text-sm font-bold text-neutral-900">{label}</p>
        <p className="mt-1 text-xs leading-5 text-neutral-500">{hint}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`h-6 w-12 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-teal-500' : 'bg-neutral-300'}`}
      >
        <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function SaveButton({ saving, onClick, locale, label }: { saving: boolean; onClick: () => void; locale: string; label?: string }) {
  const isEs = locale === 'es';
  const isPt = locale === 'pt';

  return (
    <button onClick={onClick} disabled={saving} className="btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto">
      {saving ? (
        <>
          <span className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          {isPt ? 'Salvando...' : isEs ? 'Guardando...' : 'Saving...'}
        </>
      ) : (
        <>
          <Save size={16} />
          {label || (isPt ? 'Salvar' : isEs ? 'Guardar' : 'Save')}
        </>
      )}
    </button>
  );
}

function ArrowBtn({ onClick, dir }: { onClick: () => void; dir: 'up' | 'down' }) {
  return (
    <button
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-2xl bg-neutral-900/5 text-sm font-bold text-neutral-500 transition hover:bg-neutral-900/8 hover:text-neutral-800"
    >
      {dir === 'up' ? '↑' : '↓'}
    </button>
  );
}
