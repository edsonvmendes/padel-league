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
  Monday: 'Segunda', Tuesday: 'Terça', Wednesday: 'Quarta',
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
  const isEs = locale === 'es'; const isPt = locale === 'pt';

  const [leagues, setLeagues] = useState<(League & { playerCount: number; roundCount: number })[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal nova liga
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', weekday: 'Thursday' as string });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    const { data: ls } = await run(() =>
      db.from('leagues').select('*').order('created_at', { ascending: false })
    );
    if (!ls) { setLoading(false); return; }

    const enriched = await Promise.all(ls.map(async (l: League) => {
      const [{ count: pc }, { count: rc }] = await Promise.all([
        db.from('players').select('id', { count: 'exact', head: true }).eq('league_id', l.id).eq('is_active', true),
        db.from('rounds').select('id', { count: 'exact', head: true }).eq('league_id', l.id),
      ]);
      return { ...l, playerCount: pc || 0, roundCount: rc || 0 };
    }));

    setLeagues(enriched);
    setLoading(false);
  };

  const weekdayLabel = (w: string) => isPt ? WEEKDAY_PT[w] || w : isEs ? WEEKDAY_ES[w] || w : w;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = isPt ? 'Nome obrigatório' : isEs ? 'Nombre requerido' : 'Name required';
    else if (form.name.trim().length < 2) e.name = isPt ? 'Mínimo 2 caracteres' : isEs ? 'Mínimo 2 caracteres' : 'Min 2 characters';
    return e;
  };

  const createLeague = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);

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

    setSaving(false);
    if (!newLeague) return;

    // Criar rules padrão para a liga
    await runOrThrow(() => db.from('rules').insert({
      scope: 'league',
      league_id: newLeague.id,
      absence_penalty: -5,
      use_min_actual_when_absent: false,
      three_absences_bonus: 9,
      promotion_count: 1,
      relegation_count: 1,
      allow_merge_courts: false,
      whatsapp_template: null,
    }), isPt ? 'Erro ao criar regras da liga' : isEs ? 'Error al crear reglas de la liga' : 'Failed to create league rules');

    toast.success(isPt ? `Liga "${newLeague.name}" criada!` : isEs ? `¡Liga "${newLeague.name}" creada!` : `League "${newLeague.name}" created!`);
    setShowModal(false);
    setForm({ name: '', weekday: 'Thursday' });
    router.push(`/app/leagues/${newLeague.id}/players`);
  };

  const deleteLeague = async (l: League) => {
    const ok = await confirm({
      title: isPt ? `Excluir liga "${l.name}"` : isEs ? `Eliminar liga "${l.name}"` : `Delete league "${l.name}"`,
      message: isPt ? 'Todos os dados (jogadoras, rodadas, ranking) serão perdidos permanentemente.' : isEs ? 'Todos los datos (jugadoras, jornadas, ranking) se perderán permanentemente.' : 'All data (players, rounds, ranking) will be permanently deleted.',
      confirmLabel: isPt ? 'Excluir' : isEs ? 'Eliminar' : 'Delete',
      cancelLabel: isPt ? 'Cancelar' : isEs ? 'Cancelar' : 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;
    await runOrThrow(
      () => db.from('leagues').delete().eq('id', l.id),
      isPt ? 'Erro ao excluir liga' : isEs ? 'Error al eliminar liga' : 'Failed to delete league'
    );
    toast.success(isPt ? 'Liga excluída' : isEs ? 'Liga eliminada' : 'League deleted');
    load();
  };

  const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-neutral-800">{t('leagues', locale)}</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5">
          <Plus size={16} />
          {isPt ? 'Nova liga' : isEs ? 'Nueva liga' : 'New league'}
        </button>
      </div>

      {loading ? (
        <SkeletonList count={3} lines={2} />
      ) : leagues.length === 0 ? (
        <div className="card p-12 text-center">
          <Trophy size={40} className="text-neutral-200 mx-auto mb-3" />
          <p className="text-neutral-500 mb-4">
            {isPt ? 'Nenhuma liga criada ainda' : isEs ? 'No hay ligas creadas' : 'No leagues created yet'}
          </p>
          <button onClick={() => setShowModal(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} />
            {isPt ? 'Criar primeira liga' : isEs ? 'Crear primera liga' : 'Create first league'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {leagues.map(l => (
            <div key={l.id}
              className="card-hover p-4 flex items-center justify-between cursor-pointer"
              onClick={() => router.push(`/app/leagues/${l.id}/players`)}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Trophy size={20} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-800 truncate">{l.name}</p>
                  <div className="flex items-center gap-3 text-xs text-neutral-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {weekdayLabel(l.weekday)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={11} />
                      {l.playerCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {l.roundCount}/{l.rounds_count}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); router.push(`/app/leagues/${l.id}/settings`); }}
                  className="p-2 text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition">
                  <Pencil size={14} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); deleteLeague(l); }}
                  className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                  <X size={14} />
                </button>
                <ChevronRight size={16} className="text-neutral-300 ml-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nova liga */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowModal(false)}>
          <div className="card w-full max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-neutral-100">
              <h2 className="font-bold text-neutral-800">
                {isPt ? 'Nova Liga' : isEs ? 'Nueva Liga' : 'New League'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-neutral-400 hover:text-neutral-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="label-field">{isPt ? 'Nome da liga' : isEs ? 'Nombre de la liga' : 'League name'}</label>
                <input
                  className={`input-field ${errors.name ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                  placeholder={isPt ? 'Ex: Padel Feminino Taubaté' : isEs ? 'Ej: Pádel Femenino' : 'Ex: Ladies Padel League'}
                  value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors({}); }}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="label-field">{isPt ? 'Dia da semana' : isEs ? 'Día de la semana' : 'Weekday'}</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {WEEKDAYS.map(d => (
                    <button key={d} onClick={() => setForm(f => ({ ...f, weekday: d }))}
                      className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                        form.weekday === d ? 'bg-teal-600 text-white shadow-sm' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                      }`}>
                      {(isPt ? WEEKDAY_PT[d] : isEs ? WEEKDAY_ES[d] : d).slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-neutral-400">
                {isPt ? 'Outros detalhes (quadras, horários, regras) podem ser configurados depois.' : isEs ? 'Otros detalles se pueden configurar después.' : 'Other details (courts, slots, rules) can be configured later.'}
              </p>

              <button onClick={createLeague} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                {saving
                  ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{isPt ? 'Criando...' : isEs ? 'Creando...' : 'Creating...'}</>
                  : <><Plus size={16} />{isPt ? 'Criar liga' : isEs ? 'Crear liga' : 'Create league'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
