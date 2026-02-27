'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useDb, validate } from '@/hooks/useDb';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { SkeletonList, FieldError } from '@/components/Skeleton';
import { League, LeagueTimeSlot, Court, Rules, Weekday } from '@/types/database';
import { Settings, Clock, Grid3X3, Trophy, ChevronLeft, Plus, X, Save, Trash2 } from 'lucide-react';

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

  useEffect(() => { loadAll(); }, [leagueId]);

  const loadAll = async () => {
    const [{ data: l }, { data: s }, { data: c }, { data: r }] = await Promise.all([
      run(() => db.from('leagues').select('*').eq('id', leagueId).single()),
      run(() => db.from('league_time_slots').select('*').eq('league_id', leagueId).order('sort_order')),
      run(() => db.from('courts').select('*').eq('league_id', leagueId).order('court_number')),
      run(() => db.from('rules').select('*').eq('scope', 'league').eq('league_id', leagueId).single()),
    ]);
    setLeague(l);
    setSlots(s || []);
    setCourts(c || []);
    setRules(r);
    setLoading(false);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: isPt ? 'Geral'     : isEs ? 'General'   : 'General',    icon: <Settings size={15} /> },
    { id: 'slots',   label: isPt ? 'Horários'  : isEs ? 'Horarios'  : 'Time Slots', icon: <Clock size={15} /> },
    { id: 'courts',  label: isPt ? 'Quadras'   : isEs ? 'Canchas'   : 'Courts',     icon: <Grid3X3 size={15} /> },
    { id: 'rules',   label: isPt ? 'Regras'    : isEs ? 'Reglas'    : 'Rules',      icon: <Trophy size={15} /> },
  ];

  if (loading) return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-neutral-200 rounded-xl animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-5 w-24 bg-neutral-200 rounded animate-pulse" />
          <div className="h-3 w-32 bg-neutral-100 rounded animate-pulse" />
        </div>
      </div>
      <SkeletonList count={3} lines={2} />
    </div>
  );

  if (!league) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-500 transition">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-neutral-800">
            {isPt ? 'Configurações' : isEs ? 'Configuración' : 'Settings'}
          </h1>
          <p className="text-sm text-neutral-500">{league.name}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id ? 'bg-white text-neutral-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <GeneralTab league={league} locale={locale}
          onSaved={updated => { setLeague(updated); toast.success(isPt ? 'Salvo!' : isEs ? '¡Guardado!' : 'Saved!'); }} />
      )}
      {activeTab === 'slots' && (
        <SlotsTab leagueId={leagueId} slots={slots} locale={locale}
          onChanged={() => { loadAll(); }} />
      )}
      {activeTab === 'courts' && (
        <CourtsTab leagueId={leagueId} courts={courts} league={league} locale={locale}
          onChanged={() => { loadAll(); }} />
      )}
      {activeTab === 'rules' && rules && (
        <RulesTab rules={rules} locale={locale}
          onSaved={() => { loadAll(); toast.success(isPt ? 'Regras salvas!' : isEs ? '¡Reglas guardadas!' : 'Rules saved!'); }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// TAB GENERAL
// ─────────────────────────────────────────
function GeneralTab({ league, locale, onSaved }: { league: League; locale: string; onSaved: (l: League) => void }) {
  const { db, run } = useDb();
  const toast = useToast();
  const isEs = locale === 'es'; const isPt = locale === 'pt';

  const WEEKDAYS: Weekday[] = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const WD_LABEL: Record<Weekday, string> = {
    Monday:    isPt ? 'Seg' : isEs ? 'Lun' : 'Mon',
    Tuesday:   isPt ? 'Ter' : isEs ? 'Mar' : 'Tue',
    Wednesday: isPt ? 'Qua' : isEs ? 'Mié' : 'Wed',
    Thursday:  isPt ? 'Qui' : isEs ? 'Jue' : 'Thu',
    Friday:    isPt ? 'Sex' : isEs ? 'Vie' : 'Fri',
    Saturday:  isPt ? 'Sáb' : isEs ? 'Sáb' : 'Sat',
    Sunday:    isPt ? 'Dom' : isEs ? 'Dom' : 'Sun',
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
    const errs = validate(form, {
      name:                 { required: true, minLength: 2, maxLength: 60,  label: isPt ? 'Nome' : isEs ? 'Nombre' : 'Name' },
      rounds_count:         { required: true, min: 1, max: 30,              label: isPt ? 'Rodadas' : isEs ? 'Jornadas' : 'Rounds' },
      max_courts_per_slot:  { required: true, min: 1, max: 12,              label: isPt ? 'Quadras nível' : isEs ? 'Canchas nivel' : 'Level courts' },
      physical_courts_count:{ required: true, min: 1, max: 20,              label: isPt ? 'Quadras físicas' : isEs ? 'Canchas físicas' : 'Physical courts' },
    });
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    const { data, error } = await run(
      () => db.from('leagues').update(form).eq('id', league.id).select().single(),
      isPt ? 'Erro ao salvar' : isEs ? 'Error al guardar' : 'Save failed'
    );
    setSaving(false);
    if (data && !error) onSaved(data);
  };

  return (
    <div className="card p-6 space-y-5">
      <FormField label={isPt ? 'Nome da liga' : isEs ? 'Nombre de la liga' : 'League name'} error={errors.name}>
        <input className={`input-field ${errors.name ? 'border-red-400' : ''}`}
          value={form.name}
          onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setErrors(p => ({ ...p, name: '' })); }} />
      </FormField>

      <FormField label={isPt ? 'Dia de jogo' : isEs ? 'Día de juego' : 'Match day'}>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map(d => (
            <button key={d} onClick={() => setForm(p => ({ ...p, weekday: d }))}
              className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                form.weekday === d ? 'bg-teal-600 text-white shadow-sm' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}>
              {WD_LABEL[d]}
            </button>
          ))}
        </div>
      </FormField>

      <div className="grid grid-cols-3 gap-4">
        <FormField label={isPt ? 'Rodadas' : isEs ? 'Jornadas' : 'Rounds'} error={errors.rounds_count}>
          <input type="number" min={1} max={30} className={`input-field ${errors.rounds_count ? 'border-red-400' : ''}`}
            value={form.rounds_count}
            onChange={e => { setForm(p => ({ ...p, rounds_count: +e.target.value })); setErrors(p => ({ ...p, rounds_count: '' })); }} />
        </FormField>
        <FormField label={isPt ? 'Quadras nível' : isEs ? 'Canchas nivel' : 'Level courts'} error={errors.max_courts_per_slot}>
          <input type="number" min={1} max={12} className={`input-field ${errors.max_courts_per_slot ? 'border-red-400' : ''}`}
            value={form.max_courts_per_slot}
            onChange={e => { setForm(p => ({ ...p, max_courts_per_slot: +e.target.value })); setErrors(p => ({ ...p, max_courts_per_slot: '' })); }} />
        </FormField>
        <FormField label={isPt ? 'Quadras físicas' : isEs ? 'Canchas físicas' : 'Physical courts'} error={errors.physical_courts_count}>
          <input type="number" min={1} max={20} className={`input-field ${errors.physical_courts_count ? 'border-red-400' : ''}`}
            value={form.physical_courts_count}
            onChange={e => { setForm(p => ({ ...p, physical_courts_count: +e.target.value })); setErrors(p => ({ ...p, physical_courts_count: '' })); }} />
        </FormField>
      </div>

      <SaveButton saving={saving} onClick={handleSave} locale={locale} />
    </div>
  );
}

// ─────────────────────────────────────────
// TAB SLOTS
// ─────────────────────────────────────────
function SlotsTab({ leagueId, slots, locale, onChanged }: { leagueId: string; slots: LeagueTimeSlot[]; locale: string; onChanged: () => void }) {
  const { db, run } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const isEs = locale === 'es'; const isPt = locale === 'pt';
  const [newTime, setNewTime] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newTime.match(/^\d{2}:\d{2}$/)) {
      toast.warning(isPt ? 'Horário inválido (HH:MM)' : isEs ? 'Horario inválido (HH:MM)' : 'Invalid time (HH:MM)');
      return;
    }
    if (slots.some(s => s.slot_time === newTime)) {
      toast.warning(isPt ? 'Horário já existe' : isEs ? 'Horario ya existe' : 'Time slot already exists');
      return;
    }
    setAdding(true);
    const { error } = await run(
      () => db.from('league_time_slots').insert({ league_id: leagueId, slot_time: newTime, sort_order: slots.length }),
    );
    setAdding(false);
    if (!error) { setNewTime(''); toast.success(isPt ? 'Horário adicionado!' : isEs ? '¡Horario agregado!' : 'Slot added!'); onChanged(); }
  };

  const handleDelete = async (s: LeagueTimeSlot) => {
    const ok = await confirm({
      title: isPt ? 'Remover horário' : isEs ? 'Eliminar horario' : 'Remove slot',
      message: `"${s.slot_time}"`,
      confirmLabel: isPt ? 'Remover' : isEs ? 'Eliminar' : 'Remove',
      cancelLabel: isPt ? 'Cancelar' : isEs ? 'Cancelar' : 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;
    const { error } = await run(() => db.from('league_time_slots').delete().eq('id', s.id));
    if (!error) { toast.success(isPt ? 'Removido' : isEs ? 'Eliminado' : 'Removed'); onChanged(); }
  };

  const move = async (i: number, dir: -1 | 1) => {
    const reordered = [...slots];
    const j = i + dir;
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    await Promise.all(reordered.map((s, idx) => db.from('league_time_slots').update({ sort_order: idx }).eq('id', s.id)));
    onChanged();
  };

  return (
    <div className="card p-6 space-y-4">
      <p className="text-sm text-neutral-500">
        {isPt ? 'Cada horário cria uma camada de quadras por rodada.' : isEs ? 'Cada horario crea una capa de canchas por jornada.' : 'Each slot creates a layer of courts per round.'}
      </p>

      <div className="space-y-2">
        {slots.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 bg-neutral-50 rounded-xl px-4 py-3">
            <Clock size={15} className="text-teal-500 flex-shrink-0" />
            <span className="font-semibold text-neutral-800 flex-1">{s.slot_time}</span>
            <div className="flex gap-1">
              {i > 0 && <ArrowBtn onClick={() => move(i, -1)} dir="up" />}
              {i < slots.length - 1 && <ArrowBtn onClick={() => move(i, 1)} dir="down" />}
              <button onClick={() => handleDelete(s)}
                className="p-1.5 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {slots.length === 0 && (
          <div className="text-center py-8 text-neutral-400 text-sm">
            {isPt ? 'Nenhum horário cadastrado' : isEs ? 'Sin horarios' : 'No time slots yet'}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t border-neutral-100">
        <input type="time" className="input-field flex-1"
          value={newTime} onChange={e => setNewTime(e.target.value)} />
        <button onClick={handleAdd} disabled={adding || !newTime}
          className="btn-primary flex items-center gap-1.5 px-4">
          <Plus size={16} />
          {isPt ? 'Adicionar' : isEs ? 'Agregar' : 'Add'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// TAB COURTS
// ─────────────────────────────────────────
function CourtsTab({ leagueId, courts, league, locale, onChanged }: {
  leagueId: string; courts: Court[]; league: League; locale: string; onChanged: () => void;
}) {
  const { db, run } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const isEs = locale === 'es'; const isPt = locale === 'pt';
  const [syncing, setSyncing] = useState(false);
  const inSync = courts.length === league.max_courts_per_slot;

  const syncCourts = async () => {
    setSyncing(true);
    const target = league.max_courts_per_slot;
    if (target > courts.length) {
      const toAdd = Array.from({ length: target - courts.length }, (_, i) => ({
        league_id: leagueId, court_number: courts.length + i + 1,
      }));
      await run(() => db.from('courts').insert(toAdd));
    } else {
      const toRemove = courts.slice(target).map(c => c.id);
      await run(() => db.from('courts').delete().in('id', toRemove));
    }
    setSyncing(false);
    toast.success(isPt ? 'Quadras sincronizadas!' : isEs ? '¡Canchas sincronizadas!' : 'Courts synced!');
    onChanged();
  };

  const handleAdd = async () => {
    const next = courts.length > 0 ? Math.max(...courts.map(c => c.court_number)) + 1 : 1;
    const { error } = await run(() => db.from('courts').insert({ league_id: leagueId, court_number: next }));
    if (!error) { toast.success(isPt ? 'Quadra adicionada!' : isEs ? '¡Cancha agregada!' : 'Court added!'); onChanged(); }
  };

  const handleDelete = async (c: Court) => {
    const ok = await confirm({
      title: isPt ? `Remover quadra ${c.court_number}` : isEs ? `Eliminar cancha ${c.court_number}` : `Remove court ${c.court_number}`,
      message: isPt ? 'Grupos desta quadra em rodadas existentes serão afetados.' : isEs ? 'Los grupos de esta cancha en jornadas existentes serán afectados.' : 'Groups for this court in existing rounds may be affected.',
      confirmLabel: isPt ? 'Remover' : isEs ? 'Eliminar' : 'Remove',
      cancelLabel: isPt ? 'Cancelar' : isEs ? 'Cancelar' : 'Cancel',
      variant: 'warning',
    });
    if (!ok) return;
    const { error } = await run(() => db.from('courts').delete().eq('id', c.id));
    if (!error) { toast.success(isPt ? 'Removida' : isEs ? 'Eliminada' : 'Removed'); onChanged(); }
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {courts.length} {isPt ? 'quadras' : isEs ? 'canchas' : 'courts'} · {isPt ? 'configurado para' : isEs ? 'configurado para' : 'configured for'} {league.max_courts_per_slot}
        </p>
        {!inSync && (
          <button onClick={syncCourts} disabled={syncing}
            className="text-xs font-semibold text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg hover:bg-teal-100 transition">
            {syncing ? '...' : `${isPt ? 'Sincronizar' : isEs ? 'Sincronizar' : 'Sync'} → ${league.max_courts_per_slot}`}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {courts.map(c => (
          <div key={c.id} className="flex items-center justify-between bg-neutral-50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-700 font-bold text-sm">
                {c.court_number}
              </div>
              <span className="font-medium text-neutral-700 text-sm">
                {isPt ? `Nível ${c.court_number}` : isEs ? `Nivel ${c.court_number}` : `Level ${c.court_number}`}
              </span>
            </div>
            <button onClick={() => handleDelete(c)}
              className="p-1.5 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {courts.length === 0 && (
          <div className="text-center py-8 text-neutral-400 text-sm">
            {isPt ? 'Nenhuma quadra cadastrada' : isEs ? 'Sin canchas' : 'No courts yet'}
          </div>
        )}
      </div>

      <button onClick={handleAdd}
        className="w-full border-2 border-dashed border-neutral-200 rounded-xl py-3 text-sm font-semibold text-neutral-400 hover:border-teal-300 hover:text-teal-600 transition flex items-center justify-center gap-2">
        <Plus size={16} />
        {isPt ? 'Adicionar quadra' : isEs ? 'Agregar cancha' : 'Add court'}
      </button>

      {!inSync && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          ⚠️ {isPt
            ? `Aba "Geral" define ${league.max_courts_per_slot} quadras, mas existem ${courts.length}.`
            : isEs
            ? `"General" define ${league.max_courts_per_slot} canchas, pero hay ${courts.length}.`
            : `"General" tab defines ${league.max_courts_per_slot} courts, but there are ${courts.length}.`}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// TAB RULES
// ─────────────────────────────────────────
function RulesTab({ rules, locale, onSaved }: { rules: Rules; locale: string; onSaved: () => void }) {
  const { db, run } = useDb();
  const isEs = locale === 'es'; const isPt = locale === 'pt';
  const [form, setForm] = useState<Rules>(rules);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const up = (field: keyof Rules, value: any) => setForm(p => ({ ...p, [field]: value }));

  const handleSave = async () => {
    const errs = validate(form, {
      absence_penalty:      { required: true, min: -20, max: 0,  label: isPt ? 'Penalidade' : isEs ? 'Penalización' : 'Penalty' },
      three_absences_bonus: { required: true, min: 0,   max: 30, label: isPt ? 'Bônus' : isEs ? 'Bono' : 'Bonus' },
      promotion_count:      { required: true, min: 0,   max: 6,  label: isPt ? 'Promoção' : isEs ? 'Ascenso' : 'Promotion' },
      relegation_count:     { required: true, min: 0,   max: 6,  label: isPt ? 'Rebaixamento' : isEs ? 'Descenso' : 'Relegation' },
    });
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    const { id, ...rest } = form;
    await run(
      () => db.from('rules').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id),
      isPt ? 'Erro ao salvar regras' : isEs ? 'Error al guardar reglas' : 'Failed to save rules'
    );
    setSaving(false);
    onSaved();
  };

  return (
    <div className="card p-6 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <FormField label={isPt ? 'Penalidade ausência' : isEs ? 'Penalización ausencia' : 'Absence penalty'}
          hint={isPt ? 'Valor negativo, ex: -5' : isEs ? 'Valor negativo, ej: -5' : 'Negative value, e.g. -5'}
          error={errors.absence_penalty}>
          <input type="number" max={0} className={`input-field ${errors.absence_penalty ? 'border-red-400' : ''}`}
            value={form.absence_penalty}
            onChange={e => { up('absence_penalty', parseInt(e.target.value) || 0); setErrors(p => ({ ...p, absence_penalty: '' })); }} />
        </FormField>
        <FormField label={isPt ? 'Bônus 3 ausências' : isEs ? 'Bono 3 ausencias' : '3-absences bonus'}
          error={errors.three_absences_bonus}>
          <input type="number" min={0} className={`input-field ${errors.three_absences_bonus ? 'border-red-400' : ''}`}
            value={form.three_absences_bonus}
            onChange={e => { up('three_absences_bonus', parseInt(e.target.value) || 0); setErrors(p => ({ ...p, three_absences_bonus: '' })); }} />
        </FormField>
      </div>

      <RuleToggle
        label={isPt ? 'Usar mínimo real quando ausente' : isEs ? 'Usar mínimo real si ausente' : 'Use actual min when absent'}
        hint={isPt ? 'Se o mínimo real for pior que a penalidade, usa o mínimo real' : isEs ? 'Si el mínimo real es peor que la penalización, usar el mínimo real' : 'If actual min is worse than penalty, use actual min'}
        value={form.use_min_actual_when_absent}
        onChange={v => up('use_min_actual_when_absent', v)} />

      <div className="grid grid-cols-2 gap-4">
        <FormField label={isPt ? 'Promoção (top N)' : isEs ? 'Ascenso (top N)' : 'Promotion (top N)'} error={errors.promotion_count}>
          <input type="number" min={0} max={6} className={`input-field ${errors.promotion_count ? 'border-red-400' : ''}`}
            value={form.promotion_count}
            onChange={e => { up('promotion_count', parseInt(e.target.value) || 0); setErrors(p => ({ ...p, promotion_count: '' })); }} />
        </FormField>
        <FormField label={isPt ? 'Rebaixamento (bottom N)' : isEs ? 'Descenso (bottom N)' : 'Relegation (bottom N)'} error={errors.relegation_count}>
          <input type="number" min={0} max={6} className={`input-field ${errors.relegation_count ? 'border-red-400' : ''}`}
            value={form.relegation_count}
            onChange={e => { up('relegation_count', parseInt(e.target.value) || 0); setErrors(p => ({ ...p, relegation_count: '' })); }} />
        </FormField>
      </div>

      <RuleToggle
        label={isPt ? 'Permitir fundir quadras' : isEs ? 'Permitir unir canchas' : 'Allow merging courts'}
        hint={isPt ? 'Fundir quadras quando há muitas ausências' : isEs ? 'Unir canchas cuando hay muchas ausencias' : 'Merge courts when many absences'}
        value={form.allow_merge_courts}
        onChange={v => up('allow_merge_courts', v)} />

      <FormField label={isPt ? 'Template WhatsApp' : isEs ? 'Plantilla WhatsApp' : 'WhatsApp template'}
        hint={isPt ? 'Deixe vazio para usar o template padrão' : isEs ? 'Vacío = template por defecto' : 'Empty = default template'}>
        <textarea className="input-field h-28 resize-y text-sm"
          value={form.whatsapp_template || ''}
          onChange={e => up('whatsapp_template', e.target.value || null)} />
      </FormField>

      <SaveButton saving={saving} onClick={handleSave} locale={locale}
        label={isPt ? 'Salvar regras' : isEs ? 'Guardar reglas' : 'Save rules'} />
    </div>
  );
}

// ─────────────────────────────────────────
// MICRO COMPONENTES
// ─────────────────────────────────────────
function FormField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-field">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-neutral-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">⚠ {error}</p>}
    </div>
  );
}

function RuleToggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-neutral-700">{label}</p>
        {hint && <p className="text-xs text-neutral-400 mt-0.5">{hint}</p>}
      </div>
      <button onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-teal-500' : 'bg-neutral-300'}`}>
        <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function SaveButton({ saving, onClick, locale, label }: { saving: boolean; onClick: () => void; locale: string; label?: string }) {
  const isEs = locale === 'es'; const isPt = locale === 'pt';
  return (
    <button onClick={onClick} disabled={saving}
      className="btn-primary flex items-center gap-2">
      {saving
        ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{isPt ? 'Salvando...' : isEs ? 'Guardando...' : 'Saving...'}</>
        : <><Save size={16} />{label || (isPt ? 'Salvar' : isEs ? 'Guardar' : 'Save')}</>
      }
    </button>
  );
}

function ArrowBtn({ onClick, dir }: { onClick: () => void; dir: 'up' | 'down' }) {
  return (
    <button onClick={onClick}
      className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-200 transition text-sm font-bold">
      {dir === 'up' ? '↑' : '↓'}
    </button>
  );
}
