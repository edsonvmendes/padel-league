'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useDb, validate } from '@/hooks/useDb';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { SkeletonList, FieldError } from '@/components/Skeleton';
import { League, Player, PaymentMethod } from '@/types/database';
import { t } from '@/lib/i18n';
import { buildPlayerNotes, normalizePhoneInput, parsePlayerContact, toWhatsAppPhone } from '@/lib/playerContact';
import { Plus, Search, X, Edit2, Trash2, Users, Copy, Smartphone } from 'lucide-react';

type FormState = {
  full_name: string;
  phone: string;
  birthdate: string;
  payment: PaymentMethod;
  notes: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  full_name: '',
  phone: '',
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
  const [basePlayers, setBasePlayers] = useState<Player[]>([]);
  const [playerLeagueCounts, setPlayerLeagueCounts] = useState<Record<string, number>>({});
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [baseSearch, setBaseSearch] = useState('');
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
    const [{ data: playerData }, { data: basePlayerData }, { data: leagueLinkData }, { data: leagueData }] = await Promise.all([
      run(
        () => db.from('league_roster').select('*').eq('league_id', leagueId).order('full_name'),
        isEs ? 'Error al cargar jugadoras' : isPt ? 'Erro ao carregar jogadoras' : 'Failed to load players'
      ),
      run(
        () => db.from('players').select('*').eq('owner_user_id', user!.id).order('full_name'),
        isEs ? 'Error al cargar base general' : isPt ? 'Erro ao carregar base geral' : 'Failed to load player base'
      ),
      run(
        () => db.from('league_players').select('player_id, league_id'),
        isEs ? 'Error al cargar vinculos' : isPt ? 'Erro ao carregar vinculos' : 'Failed to load player links'
      ),
      run(() => db.from('leagues').select('*').eq('id', leagueId).single()),
    ]);

    setPlayers(playerData || []);
    setBasePlayers(basePlayerData || []);
    setPlayerLeagueCounts(
      ((leagueLinkData as { player_id: string }[]) || []).reduce<Record<string, number>>((acc, item) => {
        acc[item.player_id] = (acc[item.player_id] || 0) + 1;
        return acc;
      }, {})
    );
    setLeague(leagueData || null);
    setLoading(false);
  };

  const linkExistingPlayer = async (playerId: string) => {
    const alreadyLinked = players.some((player) => player.id === playerId);
    if (alreadyLinked) {
      toast.warning(
        isPt ? 'Essa jogadora ja esta vinculada a esta liga.' : isEs ? 'Esta jugadora ya esta vinculada a esta liga.' : 'This player is already linked to this league.'
      );
      return;
    }

    await runOrThrow(
      () => db.from('league_players').insert({ league_id: leagueId, player_id: playerId }),
      isEs ? 'Error al vincular jugadora' : isPt ? 'Erro ao vincular jogadora' : 'Failed to link player'
    );
    setBaseSearch('');
    toast.success(
      isPt ? 'Jogadora vinculada a liga.' : isEs ? 'Jugadora vinculada a la liga.' : 'Player linked to the league.'
    );
    load();
  };

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (player: Player) => {
    const contact = parsePlayerContact(player.notes);
    setEditing(player);
    setForm({
      full_name: player.full_name,
      phone: contact.phone,
      birthdate: player.birthdate || '',
      payment: player.payment,
      notes: contact.notes,
      is_active: player.is_active,
    });
    setErrors({});
    setShowForm(true);
  };

  const handleSave = async () => {
    const nextErrors = validate(form, {
      full_name: {
        required: true,
        label: isEs ? 'Nombre' : isPt ? 'Nome' : 'Name',
      },
      birthdate: {
        pattern: /^\d{4}-\d{2}-\d{2}$/,
        label: isEs ? 'Fecha de nacimiento' : isPt ? 'Data de nascimento' : 'Birthdate',
        custom: (value) => {
          if (!value) return null;
          const date = new Date(value);
          if (isNaN(date.getTime())) return isEs ? 'Fecha invalida' : isPt ? 'Data invalida' : 'Invalid date';
          if (date > new Date()) return isEs ? 'La fecha no puede ser futura' : isPt ? 'A data não pode ser futura' : 'Date cannot be in the future';
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
      notes: buildPlayerNotes(form.phone, form.notes),
      is_active: form.is_active,
    };

    try {
      if (editing) {
        await runOrThrow(
          () => db.from('players').update(payload).eq('id', editing.id),
          isEs ? 'Error al actualizar jugadora' : isPt ? 'Erro ao atualizar jogadora' : 'Failed to update player'
        );
        toast.success(isEs ? 'Jugadora actualizada.' : isPt ? 'Jogadora atualizada.' : 'Player updated.');
      } else {
        const normalizedName = payload.full_name.trim().toLocaleLowerCase();
        const existingBasePlayer = basePlayers.find(
          (player) => player.full_name.trim().toLocaleLowerCase() === normalizedName
        );

        if (existingBasePlayer) {
          const alreadyLinked = players.some((player) => player.id === existingBasePlayer.id);
          if (alreadyLinked) {
            toast.warning(
              isPt
                ? 'Ja existe uma jogadora com esse nome nesta liga. Edite o cadastro atual para ajustar os dados.'
                : isEs
                  ? 'Ya existe una jugadora con ese nombre en esta liga. Edita el registro actual para ajustar los datos.'
                  : 'A player with this name is already linked to this league. Edit the current record to update it.'
            );
            return;
          }

          await runOrThrow(
            () => db.from('players').update(payload).eq('id', existingBasePlayer.id),
            isEs ? 'Error al actualizar base existente' : isPt ? 'Erro ao atualizar base existente' : 'Failed to update existing player base'
          );
          await runOrThrow(
            () => db.from('league_players').insert({ league_id: leagueId, player_id: existingBasePlayer.id }),
            isEs ? 'Error al vincular jugadora a la liga' : isPt ? 'Erro ao vincular jogadora a liga' : 'Failed to link player to league'
          );
          toast.success(
            isEs ? 'Jugadora existente vinculada.' : isPt ? 'Jogadora existente vinculada.' : 'Existing player linked.'
          );
        } else {
          const created = await runOrThrow(
            () => db.from('players').insert({ ...payload, league_id: null, owner_user_id: user!.id }).select('id').single(),
            isEs ? 'Error al agregar jugadora' : isPt ? 'Erro ao adicionar jogadora' : 'Failed to add player'
          );
          if (!created) return;
          await runOrThrow(
            () => db.from('league_players').insert({ league_id: leagueId, player_id: (created as { id: string }).id }),
            isEs ? 'Error al vincular jugadora a la liga' : isPt ? 'Erro ao vincular jogadora a liga' : 'Failed to link player to league'
          );
          toast.success(isEs ? 'Jugadora agregada.' : isPt ? 'Jogadora adicionada.' : 'Player added.');
        }
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
          ? `Excluir "${player.full_name}"? Essa ação não pode ser desfeita.`
          : `Delete "${player.full_name}"? This cannot be undone.`,
      confirmLabel: isEs ? 'Eliminar' : isPt ? 'Excluir' : 'Delete',
      cancelLabel: isEs ? 'Cancelar' : isPt ? 'Cancelar' : 'Cancel',
      variant: 'danger',
    });

    if (!ok) return;

    await runOrThrow(
      () => db.from('league_players').delete().eq('league_id', leagueId).eq('player_id', player.id),
      isEs ? 'Error al desvincular jugadora' : isPt ? 'Erro ao desvincular jogadora' : 'Failed to unlink player'
    );

    const remainingLinksResult = await run(() =>
      db.from('league_players').select('id', { count: 'exact', head: true }).eq('player_id', player.id)
    );
    const remainingLinks = (remainingLinksResult as any).count || 0;

    if (!remainingLinks) {
      await runOrThrow(
        () => db.from('players').delete().eq('id', player.id),
        isEs ? 'Error al eliminar' : isPt ? 'Erro ao excluir' : 'Failed to delete'
      );
    }

    toast.success(isEs ? 'Jugadora eliminada.' : isPt ? 'Jogadora excluída.' : 'Player deleted.');
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
  const linkedPlayerIds = new Set(players.map((player) => player.id));
  const availableBasePlayers = basePlayers.filter((player) => !linkedPlayerIds.has(player.id));
  const normalizedFormName = form.full_name.trim().toLocaleLowerCase();
  const filteredBasePlayers = availableBasePlayers
    .filter((player) => (
      !baseSearch.trim() || player.full_name.toLowerCase().includes(baseSearch.trim().toLowerCase())
    ))
    .slice(0, 8);
  const baseMatchesForForm = !editing && normalizedFormName
    ? availableBasePlayers
        .filter((player) => player.full_name.toLowerCase().includes(normalizedFormName))
        .slice(0, 4)
    : [];
  const matchingBasePlayer = !editing && normalizedFormName
    ? basePlayers.find((player) => player.full_name.trim().toLocaleLowerCase() === normalizedFormName) || null
    : null;
  const matchingBasePlayerAlreadyLinked = !!matchingBasePlayer && linkedPlayerIds.has(matchingBasePlayer.id);

  const payLabel = (payment: PaymentMethod) => ({
    cash: isEs ? 'Efectivo' : isPt ? 'Dinheiro' : 'Cash',
    transfer: isEs ? 'Transferencia' : isPt ? 'Transferencia' : 'Transfer',
    card: isEs ? 'Tarjeta' : isPt ? 'Cartao' : 'Card',
  }[payment]);

  const copyText = async (value: string) => {
    if (typeof window === 'undefined') return false;

    let copied = false;
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(value); copied = true; } catch {}
    }
    if (!copied) {
      const ta = Object.assign(document.createElement('textarea'), { value, readOnly: true, style: 'position:fixed;left:-9999px' });
      document.body.appendChild(ta);
      ta.select();
      copied = document.execCommand('copy');
      document.body.removeChild(ta);
    }

    return copied;
  };

  const copyJoinLink = async () => {
    if (typeof window === 'undefined') return;

    const url = `${window.location.origin}/join/${leagueId}`;
    const copied = await copyText(url);

    copied
      ? toast.success(isPt ? 'Link de cadastro copiado.' : isEs ? 'Link de registro copiado.' : 'Join link copied.')
      : toast.error(isPt ? 'Nao foi possivel copiar o link agora.' : isEs ? 'No fue posible copiar el link ahora.' : 'Could not copy the link right now.');
  };

  const formPhoneReady = !form.phone || !!toWhatsAppPhone(form.phone);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.14),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-4 sm:p-6 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.42)]">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <span className="inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
              {isPt ? 'Base de atletas' : isEs ? 'Base de jugadoras' : 'Player roster'}
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-[-0.03em] text-neutral-950 sm:text-4xl">{t('players', locale)}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600 sm:text-[15px]">
                {isPt
                  ? 'Gerencie a lista da liga e vincule jogadoras da sua base.'
                  : isEs
                    ? 'Gestiona la lista de la liga y vincula jugadoras de tu base.'
                    : 'Manage the league roster and link players from your base.'}
              </p>
              <p className="mt-2 max-w-xl text-xs leading-5 text-neutral-500 sm:text-sm">
                {isPt ? 'Use a base comum para evitar duplicidades.' : isEs ? 'Usa la base comun para evitar duplicados.' : 'Use the shared base to avoid duplicates.'}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <button
              onClick={copyJoinLink}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-500/15 lg:w-auto"
            >
              <Copy size={16} />
              {isPt ? 'Copiar link cadastro' : isEs ? 'Copiar link registro' : 'Copy join link'}
            </button>
            <button onClick={openNew} className="btn-primary inline-flex w-full items-center justify-center gap-2 lg:w-auto">
              <Plus size={16} />
              {t('addPlayer', locale)}
            </button>
          </div>
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
          label={isPt ? 'Base Livre' : isEs ? 'Base Libre' : 'Available Base'}
          value={availableBasePlayers.length}
          detail={isPt ? 'prontas para vincular' : isEs ? 'listas para vincular' : 'ready to link'}
          tone="teal"
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

      {availableBasePlayers.length > 0 && (
        <section className="card p-4 sm:p-5">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
                {isPt ? 'Base comum' : isEs ? 'Base comun' : 'Shared base'}
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                {isPt
                  ? 'Busque e vincule jogadoras existentes.'
                  : isEs
                    ? 'Busca y vincula jugadoras existentes.'
                    : 'Search and link existing players.'}
              </p>
            </div>
            <div className="self-start rounded-2xl bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 ring-1 ring-sky-200/80">
              {filteredBasePlayers.length}/{availableBasePlayers.length}
            </div>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  className="input-field pl-11"
                  value={baseSearch}
                  onChange={(event) => setBaseSearch(event.target.value)}
                  placeholder={isPt ? 'Buscar jogadora na base comum...' : isEs ? 'Buscar jugadora en la base comun...' : 'Search player in shared base...'}
                />
              </div>
              <div className="grid gap-2 lg:grid-cols-2">
                {filteredBasePlayers.length === 0 ? (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                    {isPt ? 'Nenhuma jogadora encontrada com esse filtro.' : isEs ? 'No se encontro ninguna jugadora con ese filtro.' : 'No players found for this filter.'}
                  </div>
                ) : (
                  filteredBasePlayers.map((player) => (
                    <div key={player.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-900">{player.full_name}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {player.is_active ? (isPt ? 'Ativa na base' : isEs ? 'Activa en la base' : 'Active in base') : (isPt ? 'Inativa na base' : isEs ? 'Inactiva en la base' : 'Inactive in base')}
                          {(playerLeagueCounts[player.id] || 0) > 0 ? ` • ${playerLeagueCounts[player.id]} ${isPt ? 'liga(s)' : isEs ? 'liga(s)' : 'league(s)'}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => linkExistingPlayer(player.id)}
                        className="rounded-2xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-700"
                      >
                        {isPt ? 'Vincular' : isEs ? 'Vincular' : 'Link'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      )}

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
              ? 'Adicione ou vincule jogadoras para montar a lista da liga.'
              : isEs
                ? 'Agrega o vincula jugadoras para armar la lista de la liga.'
                : 'Add or link players to build the league roster.'}
          </p>
          <button onClick={openNew} className="btn-primary mt-6 inline-flex items-center gap-2">
            <Plus size={16} />
            {t('addPlayer', locale)}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((player) => {
            const contact = parsePlayerContact(player.notes);
            const rawPhone = contact.phone.trim();
            const hasPhone = !!rawPhone;

            return (
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
                      {(playerLeagueCounts[player.id] || 0) > 1 && (
                        <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 ring-1 ring-sky-200/80">
                          {isPt
                            ? `${playerLeagueCounts[player.id]} ligas`
                            : isEs
                              ? `${playerLeagueCounts[player.id]} ligas`
                              : `${playerLeagueCounts[player.id]} leagues`}
                        </span>
                      )}
                      {hasPhone && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ring-1 ${
                          toWhatsAppPhone(rawPhone)
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/80'
                            : 'bg-amber-50 text-amber-700 ring-amber-200/80'
                        }`}>
                          <Smartphone size={11} />
                          {toWhatsAppPhone(rawPhone) ? (isPt ? 'Whats' : isEs ? 'Whats' : 'Phone') : (isPt ? 'Revisar' : isEs ? 'Revisar' : 'Check')}
                        </span>
                      )}
                      <span className={player.is_active ? 'badge-present' : 'badge-absent'}>
                        {player.is_active ? t('active', locale) : t('inactive', locale)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs leading-5 text-neutral-500">
                      {contact.phone ? `${contact.phone} - ` : ''}{payLabel(player.payment)}{contact.notes ? ` - ${contact.notes}` : ''}
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
            );
          })}
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
                  {editing ? (isPt ? 'Edição' : isEs ? 'Edición' : 'Editing') : (isPt ? 'Nova atleta' : isEs ? 'Nueva jugadora' : 'New player')}
                </p>
                <h2 className="mt-1 text-lg font-bold text-neutral-900">
                  {editing ? t('editPlayer', locale) : t('addPlayer', locale)}
                </h2>
              </div>
              <button onClick={() => setShowForm(false)} className="rounded-2xl p-2 text-neutral-400 transition hover:bg-neutral-900/5 hover:text-neutral-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
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
                {matchingBasePlayer && (
                  <div className={`mt-3 rounded-2xl border px-3 py-3 text-sm ${
                    matchingBasePlayerAlreadyLinked
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-sky-200 bg-sky-50 text-sky-800'
                  }`}>
                    <p className="font-semibold">
                      {matchingBasePlayerAlreadyLinked
                        ? (isPt ? 'Este nome ja esta nesta liga.' : isEs ? 'Este nombre ya esta en esta liga.' : 'This name is already in this league.')
                        : (isPt ? 'Encontramos esse nome na sua base comum.' : isEs ? 'Encontramos este nombre en tu base comun.' : 'We found this name in your shared base.')}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-current/80">
                      {matchingBasePlayerAlreadyLinked
                        ? (isPt ? 'Para evitar duplicidade, edite o cadastro atual na lista.' : isEs ? 'Para evitar duplicados, edita el registro actual en la lista.' : 'To avoid duplicates, edit the current record in the list.')
                        : (isPt ? 'Ao salvar, a tela vai reutilizar esse cadastro e apenas vincular a jogadora a esta liga.' : isEs ? 'Al guardar, la pantalla reutilizara este registro y solo vinculara la jugadora a esta liga.' : 'On save, the screen will reuse this record and only link the player to this league.')}
                    </p>
                  </div>
                )}
                {!matchingBasePlayer && baseMatchesForForm.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                      {isPt ? 'Resultados na base' : isEs ? 'Resultados en la base' : 'Base results'}
                    </p>
                    <div className="mt-2 grid gap-2">
                      {baseMatchesForForm.map((player) => (
                        <button
                          key={player.id}
                          type="button"
                          onClick={async () => {
                            await linkExistingPlayer(player.id);
                            setShowForm(false);
                          }}
                          className="flex items-center justify-between rounded-2xl border border-white bg-white px-3 py-2 text-left transition hover:border-teal-200 hover:bg-teal-50"
                        >
                          <span className="truncate text-sm font-medium text-neutral-800">{player.full_name}</span>
                          <span className="ml-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700">
                            {isPt ? 'vincular' : isEs ? 'vincular' : 'link'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!errors.full_name && (
                  <p className="mt-1 text-xs leading-5 text-neutral-400">
                    {isPt
                      ? 'Use o nome do jeito que você organiza sua lista. O cadastro continua simples e livre.'
                      : isEs
                        ? 'Usa el nombre como organizas tu lista. El registro sigue simple y libre.'
                        : 'Use the name however you organize your roster. The entry stays simple and flexible.'}
                  </p>
                )}
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
                  {isPt ? 'Telefone' : isEs ? 'Teléfono' : 'Phone'}
                  <span className="ml-1 font-normal text-neutral-400">({isEs ? 'opcional' : isPt ? 'opcional' : 'optional'})</span>
                </label>
                <input
                  className="input-field"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: normalizePhoneInput(event.target.value) }))}
                  placeholder={isEs ? '+34 600 000 000' : isPt ? '+55 11 99999-9999' : '+1 555 555 5555'}
                  inputMode="tel"
                  autoComplete="tel"
                />
                <p className="mt-1 text-xs leading-5 text-neutral-400">
                  {isPt ? 'Se preencher, o app pode abrir o WhatsApp direto no contato da jogadora.' : isEs ? 'Si lo completas, el sistema puede abrir WhatsApp directo en el contacto de la jugadora.' : 'If filled, the app can open WhatsApp directly for this player.'}
                </p>
                {!formPhoneReady && (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    {isPt ? 'Adicione pelo menos 8 dígitos para o número ficar pronto para WhatsApp.' : isEs ? 'Agrega al menos 8 dígitos para que el número quede listo para WhatsApp.' : 'Add at least 8 digits so the number is ready for WhatsApp.'}
                  </p>
                )}
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
                  placeholder={isEs ? 'Teléfono, nivel, observaciones...' : isPt ? 'Telefone, nível, observações...' : 'Phone, level, notes...'}
                />
                <p className="mt-1 text-xs leading-5 text-neutral-400">
                  {isPt ? 'Use este campo do seu jeito: telefone, nível, observação interna ou qualquer lembrete útil.' : isEs ? 'Usa este campo a tu manera: teléfono, nivel, observación interna o cualquier recordatorio útil.' : 'Use this field your own way: phone, level, internal notes, or any helpful reminder.'}
                </p>
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



