'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useDb, validate } from '@/hooks/useDb';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { SkeletonList, FieldError } from '@/components/Skeleton';
import { Player, PaymentMethod } from '@/types/database';
import { t } from '@/lib/i18n';
import { Plus, Search, X, Edit2, Trash2 } from 'lucide-react';

type FormState = {
  full_name: string;
  birthdate: string;
  payment: PaymentMethod;
  notes: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  full_name: '',
  birthdate: '',
  payment: 'cash',
  notes: '',
  is_active: true,
};

export default function PlayersPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user, locale } = useAuth();
  const { db, run } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const isEs = locale === 'es';
  const isPt = locale === 'pt';

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user && leagueId) load(); }, [user, leagueId]);

  const load = async () => {
    const { data } = await run(
      () => db.from('players').select('*').eq('league_id', leagueId).order('full_name'),
      isEs ? 'Error al cargar jugadoras' : isPt ? 'Erro ao carregar jogadoras' : 'Failed to load players'
    );
    setPlayers(data || []);
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (p: Player) => {
    setEditing(p);
    setForm({
      full_name: p.full_name,
      birthdate: p.birthdate || '',
      payment: p.payment,
      notes: p.notes || '',
      is_active: p.is_active,
    });
    setErrors({});
    setShowForm(true);
  };

  const handleSave = async () => {
    const errs = validate(form, {
      full_name: {
        required: true,
        minLength: 2,
        maxLength: 80,
        label: isEs ? 'Nombre' : isPt ? 'Nome' : 'Name',
      },
      birthdate: {
        pattern: /^\d{4}-\d{2}-\d{2}$/,
        label: isEs ? 'Fecha de nacimiento' : isPt ? 'Data de nascimento' : 'Birthdate',
        custom: (v) => {
          if (!v) return null;
          const d = new Date(v);
          if (isNaN(d.getTime())) return 'Invalid date';
          if (d > new Date()) return isEs ? 'Fecha no puede ser futura' : isPt ? 'Data não pode ser futura' : 'Date cannot be in the future';
          return null;
        },
      },
    });

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    const payload = {
      full_name: form.full_name.trim(),
      birthdate: form.birthdate || null,
      payment: form.payment,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };

    if (editing) {
      const { error } = await run(
        () => db.from('players').update(payload).eq('id', editing.id),
        isEs ? 'Error al actualizar jugadora' : isPt ? 'Erro ao atualizar jogadora' : 'Failed to update player'
      );
      if (!error) {
        toast.success(isEs ? '¡Jugadora actualizada!' : isPt ? 'Jogadora atualizada!' : 'Player updated!');
        setShowForm(false);
        load();
      }
    } else {
      const { error } = await run(
        () => db.from('players').insert({ ...payload, league_id: leagueId, owner_user_id: user!.id }),
        isEs ? 'Error al agregar jugadora' : isPt ? 'Erro ao adicionar jogadora' : 'Failed to add player'
      );
      if (!error) {
        toast.success(isEs ? '¡Jugadora agregada!' : isPt ? 'Jogadora adicionada!' : 'Player added!');
        setShowForm(false);
        load();
      }
    }

    setSaving(false);
  };

  const handleDelete = async (p: Player) => {
    const ok = await confirm({
      title: isEs ? 'Eliminar jugadora' : isPt ? 'Excluir jogadora' : 'Delete player',
      message: isEs
        ? `¿Eliminar a "${p.full_name}"? Esto no se puede deshacer.`
        : isPt
        ? `Excluir "${p.full_name}"? Essa ação não pode ser desfeita.`
        : `Delete "${p.full_name}"? This cannot be undone.`,
      confirmLabel: isEs ? 'Eliminar' : isPt ? 'Excluir' : 'Delete',
      cancelLabel: isEs ? 'Cancelar' : isPt ? 'Cancelar' : 'Cancel',
      variant: 'danger',
    });

    if (!ok) return;

    const { error } = await run(
      () => db.from('players').delete().eq('id', p.id),
      isEs ? 'Error al eliminar' : isPt ? 'Erro ao excluir' : 'Failed to delete'
    );
    if (!error) {
      toast.success(isEs ? 'Jugadora eliminada' : isPt ? 'Jogadora excluída' : 'Player deleted');
      load();
    }
  };

  const toggleActive = async (p: Player) => {
    const { error } = await run(
      () => db.from('players').update({ is_active: !p.is_active }).eq('id', p.id)
    );
    if (!error) load();
  };

  const filtered = players.filter(p => {
    if (activeOnly && !p.is_active) return false;
    if (search && !p.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const payLabel = (pm: PaymentMethod) => ({
    cash:     isEs ? 'Efectivo' : isPt ? 'Dinheiro' : 'Cash',
    transfer: isEs ? 'Transferencia' : isPt ? 'Transferência' : 'Transfer',
    card:     isEs ? 'Tarjeta' : isPt ? 'Cartão' : 'Card',
  }[pm]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-neutral-800">{t('players', locale)}</h1>
        <button onClick={openNew} className="btn-primary flex items-center gap-1.5">
          <Plus size={16} />
          {t('addPlayer', locale)}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className="input-field pl-9"
            placeholder={t('searchPlayers', locale)}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setActiveOnly(!activeOnly)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            activeOnly ? 'bg-teal-50 border-teal-200 text-teal-700' : 'border-neutral-200 text-neutral-500'
          }`}>
          {t('showActive', locale)}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <SkeletonList count={4} lines={1} />
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-neutral-500">{t('noPlayers', locale)}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <div key={p.id} className="card p-3 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => toggleActive(p)}
                  title={p.is_active ? (isEs ? 'Desactivar' : isPt ? 'Desativar' : 'Deactivate') : (isEs ? 'Activar' : isPt ? 'Ativar' : 'Activate')}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition ${
                    p.is_active ? 'bg-teal-100 text-teal-700 hover:bg-teal-200' : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                  }`}>
                  {p.full_name.charAt(0).toUpperCase()}
                </button>
                <div className="min-w-0">
                  <p className={`font-medium text-sm truncate ${p.is_active ? 'text-neutral-800' : 'text-neutral-400 line-through'}`}>
                    {p.full_name}
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    {payLabel(p.payment)}{p.notes ? ` · ${p.notes}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className={p.is_active ? 'badge-present' : 'badge-absent'}>
                  {p.is_active ? t('active', locale) : t('inactive', locale)}
                </span>
                <button onClick={() => openEdit(p)} className="p-2 text-neutral-400 hover:text-teal-600 transition">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => handleDelete(p)} className="p-2 text-neutral-400 hover:text-red-500 transition">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="mt-4 text-sm text-neutral-400 text-right">
          {t('total', locale)}: {filtered.length} / {players.length}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setShowForm(false)}>
          <div className="card p-6 w-full max-w-md rounded-t-2xl sm:rounded-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">
                {editing ? t('editPlayer', locale) : t('addPlayer', locale)}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-neutral-400 hover:text-neutral-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="label-field">{t('playerName', locale)}</label>
                <input
                  className={`input-field ${errors.full_name ? 'border-red-400 focus:ring-red-400' : ''}`}
                  value={form.full_name}
                  onChange={e => { setForm(p => ({ ...p, full_name: e.target.value })); setErrors(p => ({ ...p, full_name: '' })); }}
                  autoFocus
                />
                <FieldError message={errors.full_name} />
              </div>

              {/* Birthdate */}
              <div>
                <label className="label-field">
                  {t('birthdate', locale)}
                  <span className="ml-1 text-neutral-400 font-normal">({isEs ? 'opcional' : isPt ? 'opcional' : 'optional'})</span>
                </label>
                <input
                  type="date"
                  className={`input-field ${errors.birthdate ? 'border-red-400 focus:ring-red-400' : ''}`}
                  value={form.birthdate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => { setForm(p => ({ ...p, birthdate: e.target.value })); setErrors(p => ({ ...p, birthdate: '' })); }}
                />
                <FieldError message={errors.birthdate} />
              </div>

              {/* Payment */}
              <div>
                <label className="label-field">{t('paymentMethod', locale)}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'transfer', 'card'] as PaymentMethod[]).map(pm => (
                    <button
                      key={pm}
                      onClick={() => setForm(p => ({ ...p, payment: pm }))}
                      className={`py-2 rounded-xl text-sm font-semibold transition-all ${
                        form.payment === pm
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}>
                      {payLabel(pm)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label-field">
                  {t('notes', locale)}
                  <span className="ml-1 text-neutral-400 font-normal">({isEs ? 'opcional' : isPt ? 'opcional' : 'optional'})</span>
                </label>
                <input
                  className="input-field"
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder={isEs ? 'Teléfono, nivel, observaciones...' : isPt ? 'Telefone, nível, observações...' : 'Phone, level, notes...'}
                />
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between py-1">
                <label className="text-sm font-semibold text-neutral-700">{t('active', locale)}</label>
                <button
                  onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                  className={`w-12 h-6 rounded-full transition-colors ${form.is_active ? 'bg-teal-500' : 'bg-neutral-300'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Submit */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary w-full flex items-center justify-center gap-2">
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {isEs ? 'Guardando...' : isPt ? 'Salvando...' : 'Saving...'}
                  </>
                ) : t('save', locale)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
