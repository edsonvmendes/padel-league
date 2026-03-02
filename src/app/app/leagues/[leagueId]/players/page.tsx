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
import { Plus, Search, X, Edit2, Trash2, Users } from 'lucide-react';

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
  const { db, run, runOrThrow } = useDb();
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

  useEffect(() => {
    if (user && leagueId) load();
  }, [user, leagueId]);

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

  const openEdit = (player: Player) => {
    setEditing(player);
    setForm({
      full_name: player.full_name,
      birthdate: player.birthdate || '',
      payment: player.payment,
      notes: player.notes || '',
      is_active: player.is_active,
    });
    setErrors({});
    setShowForm(true);
  };

  const handleSave = async () => {
    const nextErrors = validate(form, {
      full_name: {
        required: true,
        minLength: 2,
        maxLength: 80,
        label: isEs ? 'Nombre' : isPt ? 'Nome' : 'Name',
      },
      birthdate: {
        pattern: /^\d{4}-\d{2}-\d{2}$/,
        label: isEs ? 'Fecha de nacimiento' : isPt ? 'Data de nascimento' : 'Birthdate',
        custom: (value) => {
          if (!value) return null;
          const date = new Date(value);
          if (isNaN(date.getTime())) return 'Invalid date';
          if (date > new Date()) return isEs ? 'Fecha no puede ser futura' : isPt ? 'Data nao pode ser futura' : 'Date cannot be in the future';
          return null;
        },
      },
    });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
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

    try {
      if (editing) {
        await runOrThrow(
          () => db.from('players').update(payload).eq('id', editing.id),
          isEs ? 'Error al actualizar jugadora' : isPt ? 'Erro ao atualizar jogadora' : 'Failed to update player'
        );
        toast.success(isEs ? 'Jogadora atualizada!' : isPt ? 'Jogadora atualizada!' : 'Player updated!');
      } else {
        await runOrThrow(
          () => db.from('players').insert({ ...payload, league_id: leagueId, owner_user_id: user!.id }),
          isEs ? 'Error al agregar jugadora' : isPt ? 'Erro ao adicionar jogadora' : 'Failed to add player'
        );
        toast.success(isEs ? 'Jogadora adicionada!' : isPt ? 'Jogadora adicionada!' : 'Player added!');
      }

      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (player: Player) => {
    const ok = await confirm({
      title: isEs ? 'Eliminar jugadora' : isPt ? 'Excluir jogadora' : 'Delete player',
      message: isEs
        ? `Eliminar "${player.full_name}"? Esta accion no se puede deshacer.`
        : isPt
          ? `Excluir "${player.full_name}"? Essa acao nao pode ser desfeita.`
          : `Delete "${player.full_name}"? This cannot be undone.`,
      confirmLabel: isEs ? 'Eliminar' : isPt ? 'Excluir' : 'Delete',
      cancelLabel: isEs ? 'Cancelar' : isPt ? 'Cancelar' : 'Cancel',
      variant: 'danger',
    });

    if (!ok) return;

    await runOrThrow(
      () => db.from('players').delete().eq('id', player.id),
      isEs ? 'Error al eliminar' : isPt ? 'Erro ao excluir' : 'Failed to delete'
    );

    toast.success(isEs ? 'Jogadora excluida' : isPt ? 'Jogadora excluida' : 'Player deleted');
    load();
  };

  const toggleActive = async (player: Player) => {
    await runOrThrow(
      () => db.from('players').update({ is_active: !player.is_active }).eq('id', player.id),
      isEs ? 'Error al actualizar estado' : isPt ? 'Erro ao atualizar status' : 'Failed to update status'
    );
    load();
  };

  const filtered = players.filter((player) => {
    if (activeOnly && !player.is_active) return false;
    if (search && !player.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeCount = players.filter((player) => player.is_active).length;
  const inactiveCount = players.length - activeCount;

  const payLabel = (payment: PaymentMethod) => ({
    cash: isEs ? 'Efectivo' : isPt ? 'Dinheiro' : 'Cash',
    transfer: isEs ? 'Transferencia' : isPt ? 'Transferencia' : 'Transfer',
    card: isEs ? 'Tarjeta' : isPt ? 'Cartao' : 'Card',
  }[payment]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.14),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-6 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.42)]">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <span className="inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
              {isPt ? 'Base de atletas' : isEs ? 'Base de jugadoras' : 'Player roster'}
            </span>
            <div>
              <h1 className="text-3xl font-black tracking-[-0.03em] text-neutral-950 sm:text-4xl">{t('players', locale)}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600 sm:text-[15px]">
                {isPt
                  ? 'Gerencie presenca operacional, status e observacoes da liga com leitura rapida e edicao sem atrito.'
                  : isEs
                    ? 'Gestiona presencia operativa, estado y observaciones de la liga con lectura rapida y edicion sin friccion.'
                    : 'Manage operational presence, status, and notes with fast scanning and low-friction editing.'}
              </p>
            </div>
          </div>

          <button onClick={openNew} className="btn-primary inline-flex items-center gap-2 self-start lg:self-auto">
            <Plus size={16} />
            {t('addPlayer', locale)}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          label={isPt ? 'Total' : isEs ? 'Total' : 'Total'}
          value={players.length}
          detail={isPt ? 'base cadastrada' : isEs ? 'base registrada' : 'registered roster'}
          tone="teal"
        />
        <MetricCard
          label={isPt ? 'Ativas' : isEs ? 'Activas' : 'Active'}
          value={activeCount}
          detail={isPt ? 'aptas para rodada' : isEs ? 'listas para la jornada' : 'eligible for rounds'}
          tone="emerald"
        />
        <MetricCard
          label={isPt ? 'Inativas' : isEs ? 'Inactivas' : 'Inactive'}
          value={inactiveCount}
          detail={isPt ? 'fora da escala' : isEs ? 'fuera de la escala' : 'off rotation'}
          tone="neutral"
        />
      </div>

      <section className="card p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              className="input-field pl-11"
              placeholder={t('searchPlayers', locale)}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button
            onClick={() => setActiveOnly(!activeOnly)}
            className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              activeOnly ? 'bg-teal-500/10 text-teal-700 ring-1 ring-teal-500/15' : 'bg-neutral-900/5 text-neutral-500 ring-1 ring-neutral-900/6'
            }`}
          >
            {t('showActive', locale)}
          </button>
        </div>
      </section>

      {loading ? (
        <div className="card p-5 sm:p-6">
          <SkeletonList count={5} lines={1} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 sm:p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-[0_18px_38px_-22px_rgba(13,148,136,0.75)]">
            <Users size={28} />
          </div>
          <p className="text-lg font-bold text-neutral-900">{t('noPlayers', locale)}</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
            {isPt
              ? 'Monte a base da liga para liberar sorteios, presenca e atribuicao de partidas.'
              : isEs
                ? 'Construye la base de la liga para liberar sorteos, presencia y asignacion de partidos.'
                : 'Build the roster to unlock attendance, round setup, and match assignment.'}
          </p>
          <button onClick={openNew} className="btn-primary mt-6 inline-flex items-center gap-2">
            <Plus size={16} />
            {t('addPlayer', locale)}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((player) => (
            <div
              key={player.id}
              className="rounded-[1.6rem] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-4 shadow-[0_20px_44px_-34px_rgba(15,23,42,0.3)]"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    onClick={() => toggleActive(player)}
                    title={player.is_active ? (isEs ? 'Desactivar' : isPt ? 'Desativar' : 'Deactivate') : (isEs ? 'Activar' : isPt ? 'Ativar' : 'Activate')}
                    className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-bold transition ${
                      player.is_active
                        ? 'bg-teal-500/12 text-teal-700 ring-1 ring-teal-500/12 hover:bg-teal-500/18'
                        : 'bg-neutral-900/5 text-neutral-400 ring-1 ring-neutral-900/6 hover:bg-neutral-900/8'
                    }`}
                  >
                    {player.full_name.charAt(0).toUpperCase()}
                  </button>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`truncate text-sm font-bold ${player.is_active ? 'text-neutral-900' : 'text-neutral-400 line-through'}`}>
                        {player.full_name}
                      </p>
                      <span className={player.is_active ? 'badge-present' : 'badge-absent'}>
                        {player.is_active ? t('active', locale) : t('inactive', locale)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs leading-5 text-neutral-500">
                      {payLabel(player.payment)}{player.notes ? ` · ${player.notes}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => openEdit(player)} className="rounded-2xl p-2.5 text-neutral-400 transition hover:bg-teal-50 hover:text-teal-600">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => handleDelete(player)} className="rounded-2xl p-2.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="text-right text-sm font-medium text-neutral-400">
          {t('total', locale)}: {filtered.length} / {players.length}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-[rgba(9,13,24,0.56)] backdrop-blur-md flex items-end justify-center p-4 sm:items-center" onClick={() => setShowForm(false)}>
          <div
            className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] shadow-[0_34px_90px_-44px_rgba(15,23,42,0.6)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
                  {editing ? (isPt ? 'Edicao' : isEs ? 'Edicion' : 'Editing') : (isPt ? 'Nova atleta' : isEs ? 'Nueva jugadora' : 'New player')}
                </p>
                <h2 className="mt-1 text-lg font-bold text-neutral-900">
                  {editing ? t('editPlayer', locale) : t('addPlayer', locale)}
                </h2>
              </div>
              <button onClick={() => setShowForm(false)} className="rounded-2xl p-2 text-neutral-400 transition hover:bg-neutral-900/5 hover:text-neutral-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div>
                <label className="label-field">{t('playerName', locale)}</label>
                <input
                  className={`input-field ${errors.full_name ? 'border-red-400 focus:ring-red-400' : ''}`}
                  value={form.full_name}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, full_name: event.target.value }));
                    setErrors((current) => ({ ...current, full_name: '' }));
                  }}
                  autoFocus
                />
                <FieldError message={errors.full_name} />
              </div>

              <div>
                <label className="label-field">
                  {t('birthdate', locale)}
                  <span className="ml-1 font-normal text-neutral-400">({isEs ? 'opcional' : isPt ? 'opcional' : 'optional'})</span>
                </label>
                <input
                  type="date"
                  className={`input-field ${errors.birthdate ? 'border-red-400 focus:ring-red-400' : ''}`}
                  value={form.birthdate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, birthdate: event.target.value }));
                    setErrors((current) => ({ ...current, birthdate: '' }));
                  }}
                />
                <FieldError message={errors.birthdate} />
              </div>

              <div>
                <label className="label-field">{t('paymentMethod', locale)}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'transfer', 'card'] as PaymentMethod[]).map((payment) => (
                    <button
                      key={payment}
                      onClick={() => setForm((current) => ({ ...current, payment }))}
                      className={`rounded-2xl py-2.5 text-sm font-semibold transition ${
                        form.payment === payment ? 'bg-neutral-900 text-white shadow-[0_14px_28px_-18px_rgba(15,23,42,0.7)]' : 'bg-neutral-900/5 text-neutral-500 hover:bg-neutral-900/8'
                      }`}
                    >
                      {payLabel(payment)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label-field">
                  {t('notes', locale)}
                  <span className="ml-1 font-normal text-neutral-400">({isEs ? 'opcional' : isPt ? 'opcional' : 'optional'})</span>
                </label>
                <input
                  className="input-field"
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder={isEs ? 'Telefono, nivel, observaciones...' : isPt ? 'Telefone, nivel, observacoes...' : 'Phone, level, notes...'}
                />
              </div>

              <div className="flex items-center justify-between rounded-3xl bg-neutral-900/5 px-4 py-3">
                <label className="text-sm font-semibold text-neutral-700">{t('active', locale)}</label>
                <button
                  onClick={() => setForm((current) => ({ ...current, is_active: !current.is_active }))}
                  className={`h-6 w-12 rounded-full transition-colors ${form.is_active ? 'bg-teal-500' : 'bg-neutral-300'}`}
                >
                  <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <button onClick={handleSave} disabled={saving} className="btn-primary flex w-full items-center justify-center gap-2">
                {saving ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
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

function MetricCard({ label, value, detail, tone }: {
  label: string;
  value: number;
  detail: string;
  tone: 'teal' | 'emerald' | 'neutral';
}) {
  const toneClass = {
    teal: 'bg-teal-500/10 border-teal-200/70',
    emerald: 'bg-emerald-500/10 border-emerald-200/70',
    neutral: 'bg-neutral-900/5 border-neutral-900/6',
  }[tone];

  return (
    <div className={`rounded-[1.5rem] border ${toneClass} px-5 py-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.3)]`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-neutral-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-neutral-500">{detail}</p>
    </div>
  );
}
