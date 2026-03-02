'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useDb } from '@/hooks/useDb';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { Round, League, LeagueTimeSlot, Court, RoundCourtGroup, RoundCourtPlayer, Match, Player, Rules } from '@/types/database';
import { t } from '@/lib/i18n';
import { parsePlayerContact, toWhatsAppPhone } from '@/lib/playerContact';
import { MATCH_PAIRINGS, calculateGroupPoints, isValidScore } from '@/lib/scoring-engine';
import {
  ArrowLeft, PlayCircle, Lock, Check, MessageCircle, MapPin, CalendarPlus, Bell,
  Trophy, ChevronDown, ChevronUp, AlertTriangle, XCircle,
} from 'lucide-react';

interface GroupWithDetails {
  group: RoundCourtGroup;
  court: Court;
  slot: LeagueTimeSlot;
  players: (RoundCourtPlayer & { playerData: Player })[];
  matches: Match[];
}

export default function RoundDetailPage() {
  const { leagueId, roundId } = useParams<{ leagueId: string; roundId: string }>();
  const { user, locale } = useAuth();
  const { db, run, runOrThrow } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const isEs = locale === 'es'; const isPt = locale === 'pt';

  const [round, setRound] = useState<Round | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [slots, setSlots] = useState<LeagueTimeSlot[]>([]);
  const [groups, setGroups] = useState<GroupWithDetails[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [rules, setRules] = useState<Rules | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [startingRound, setStartingRound] = useState(false);
  const [closingRound, setClosingRound] = useState(false);
  const isMutating = startingRound || closingRound;

  const getActionErrorMessage = (_error: any, fallback: string) => fallback;
  const getPhysicalCourtConflictMessage = (targetSlotId?: string) => {
    const sameSlot = targetSlotId === undefined;

    if (isPt) {
      return sameSlot
        ? 'Essa quadra fisica ja esta ocupada neste horario. Se quiser reutiliza-la em outro horario, troque o horario primeiro.'
        : 'Essa quadra fisica ja esta ocupada no horario selecionado. Escolha outra quadra fisica ou libere esse horario antes.';
    }

    if (isEs) {
      return sameSlot
        ? 'Esta cancha fisica ya esta ocupada en este horario. Si quieres reutilizarla en otro horario, cambia primero el horario.'
        : 'Esta cancha fisica ya esta ocupada en el horario seleccionado. Elige otra cancha fisica o libera ese horario antes.';
    }

    return sameSlot
      ? 'This physical court is already in use in this time slot. If you want to reuse it in another slot, change the time slot first.'
      : 'This physical court is already in use in the selected time slot. Choose another physical court or free that slot first.';
  };
  const getPhysicalCourtAutoMoveMessage = (slotTime: string) => {
    if (isPt) return `Quadra fisica movida automaticamente para o horario ${slotTime} para evitar conflito.`;
    if (isEs) return `Cancha fisica movida automaticamente al horario ${slotTime} para evitar conflicto.`;
    return `Physical court was moved automatically to ${slotTime} to avoid a conflict.`;
  };

  useEffect(() => { if (user) loadAll(); }, [user, roundId]);

  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    setActionError(null);
    try {
      const [
        roundRes,
        leagueRes,
        slotsRes,
        courtsRes,
        groupsRes,
        playersRes,
        rulesRes,
      ] = await Promise.all([
        run(() => db.from('rounds').select('*').eq('id', roundId).single()),
        run(() => db.from('leagues').select('*').eq('id', leagueId).single()),
        run(() => db.from('league_time_slots').select('*').eq('league_id', leagueId).order('sort_order')),
        run(() => db.from('courts').select('*').eq('league_id', leagueId).order('court_number')),
        run(() => db.from('round_court_groups').select('*').eq('round_id', roundId)),
        run(() => db.from('players').select('*').eq('league_id', leagueId).eq('is_active', true).order('full_name')),
        run(() => db.from('rules').select('*').or(`scope.eq.global,league_id.eq.${leagueId}`).order('scope', { ascending: false }).limit(1)),
      ]);

      if (roundRes.error) throw new Error(`rounds: ${roundRes.error.message || 'unknown error'}`);
      if (leagueRes.error) throw new Error(`leagues: ${leagueRes.error.message || 'unknown error'}`);
      if (slotsRes.error) throw new Error(`league_time_slots: ${slotsRes.error.message || 'unknown error'}`);
      if (courtsRes.error) throw new Error(`courts: ${courtsRes.error.message || 'unknown error'}`);
      if (groupsRes.error) throw new Error(`round_court_groups: ${groupsRes.error.message || 'unknown error'}`);
      if (playersRes.error) throw new Error(`players: ${playersRes.error.message || 'unknown error'}`);
      if (rulesRes.error) throw new Error(`rules: ${rulesRes.error.message || 'unknown error'}`);

      const roundData = roundRes.data;
      const leagueData = leagueRes.data;
      const slotsData = slotsRes.data || [];
      const courtsData = courtsRes.data || [];
      const playersData = playersRes.data || [];
      const rulesData = rulesRes.data || [];

      setRound(roundData);
      setLeague(leagueData);
      setSlots(slotsData);
      setAllPlayers(playersData);
      setRules(rulesData[0] || null);

      const resolvedGroups = groupsRes.data || [];

      if (resolvedGroups.length > 0) {
        const gIds = resolvedGroups.map((g: any) => g.id);
        const [cpRes, matchesRes] = await Promise.all([
          gIds.length ? run(() => db.from('round_court_players').select('*').in('group_id', gIds)) : Promise.resolve({ data: [], error: null }),
          gIds.length ? run(() => db.from('matches').select('*').in('group_id', gIds)) : Promise.resolve({ data: [], error: null }),
        ]);

        if (cpRes.error) throw new Error(`round_court_players: ${cpRes.error.message || 'unknown error'}`);
        if (matchesRes.error) throw new Error(`matches: ${matchesRes.error.message || 'unknown error'}`);

        const cpData = cpRes.data || [];
        const matchesData = matchesRes.data || [];

        const enriched: GroupWithDetails[] = resolvedGroups.map((g: any) => ({
          group: g,
          court: courtsData.find((c: Court) => c.id === g.court_id) as Court,
          slot: slotsData.find((s: LeagueTimeSlot) => s.id === g.time_slot_id) as LeagueTimeSlot,
          players: (cpData as any[]).filter(cp => cp.group_id === g.id).map(cp => ({
            ...cp,
            playerData: playersData.find((p: Player) => p.id === cp.player_id) || ({} as Player),
          })),
          matches: (matchesData as Match[]).filter(m => m.group_id === g.id).sort((a, b) => a.match_number - b.match_number),
        }));

        setGroups(enriched.sort((a, b) => {
          const sd = (a.slot?.sort_order || 0) - (b.slot?.sort_order || 0);
          return sd !== 0 ? sd : (a.court?.court_number || 0) - (b.court?.court_number || 0);
        }));
      } else {
        setGroups([]);
      }
    } catch (_error: any) {
      setGroups([]);
      setLoadError(
        isPt
          ? 'Não foi possível carregar esta rodada agora.'
          : isEs
            ? 'No fue posible cargar esta jornada ahora.'
            : 'Unable to load this round right now.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Ações de jogadoras ──────────────────────────────────────
  const assignPlayer = async (groupId: string, position: number, playerId: string) => {
    if (isMutating) return;
    setActionError(null);
    try {
      await runOrThrow(() => db.from('round_court_players').delete().eq('group_id', groupId).eq('position', position));
      await runOrThrow(() => db.from('round_court_players').delete().eq('group_id', groupId).eq('player_id', playerId));
      await runOrThrow(() => db.from('round_court_players').insert({ group_id: groupId, player_id: playerId, position, attendance: 'present' }));
      const cpData = await runOrThrow(() => db.from('round_court_players').select('*').eq('group_id', groupId));
      if (cpData && cpData.length === 4) {
        const existing = await runOrThrow(() => db.from('matches').select('id').eq('group_id', groupId));
        if (!existing || existing.length === 0) {
          await runOrThrow(() => db.from('matches').insert(MATCH_PAIRINGS.map(mp => ({ group_id: groupId, ...mp }))));
        }
      }
      loadAll();
    } catch (error: any) {
      setActionError(getActionErrorMessage(
        error,
        isPt ? 'Não foi possível atualizar as jogadoras da quadra.' : isEs ? 'No se pudo actualizar las jugadoras de la cancha.' : 'Could not update court players.'
      ));
    }
  };

  const removePlayer = async (cpId: string) => {
    if (isMutating) return;
    setActionError(null);
    try {
      await runOrThrow(() => db.from('round_court_players').delete().eq('id', cpId));
      loadAll();
    } catch (error: any) {
      setActionError(getActionErrorMessage(
        error,
        isPt ? 'Não foi possível remover a jogadora.' : isEs ? 'No se pudo quitar la jugadora.' : 'Could not remove the player.'
      ));
    }
  };

  const toggleAttendance = async (cpId: string, current: string) => {
    if (isMutating) return;
    setActionError(null);
    try {
      const cycle = { present: 'absent', absent: 'substitute', substitute: 'present' } as Record<string, string>;
      await runOrThrow(() => db.from('round_court_players').update({ attendance: cycle[current] || 'present' }).eq('id', cpId));
      loadAll();
    } catch (error: any) {
      setActionError(getActionErrorMessage(
        error,
        isPt ? 'Não foi possível atualizar a presença.' : isEs ? 'No se pudo actualizar la asistencia.' : 'Could not update attendance.'
      ));
    }
  };

  const saveScore = async (matchId: string, score1: number, score2: number) => {
    if (isMutating) return;
    if (!isValidScore(score1) || !isValidScore(score2)) return;
    setActionError(null);
    try {
      await runOrThrow(() => db.from('matches').update({ score_team1: score1, score_team2: score2, is_recorded: false }).eq('id', matchId));
      toast.success(
        isPt
          ? 'Placar salvo como rascunho. Ele sera confirmado ao fechar a rodada.'
          : isEs
            ? 'Marcador guardado como borrador. Se confirmara al cerrar la jornada.'
            : 'Score saved as draft. It will be confirmed when the round is closed.'
      );
      loadAll();
    } catch (error: any) {
      setActionError(getActionErrorMessage(
        error,
        isPt ? 'Não foi possível salvar o placar.' : isEs ? 'No se pudo guardar el marcador.' : 'Could not save the score.'
      ));
    }
  };

  const setSubstituteName = async (cpId: string, substituteName: string) => {
    if (isMutating) return;
    setActionError(null);
    try {
      await runOrThrow(
        () => db.from('round_court_players').update({ substitute_name: substituteName.trim() || null }).eq('id', cpId),
        isPt ? 'Erro ao salvar suplente' : isEs ? 'Error al guardar suplente' : 'Failed to save substitute'
      );
      loadAll();
    } catch (error: any) {
      setActionError(getActionErrorMessage(
        error,
        isPt ? 'NÃ£o foi possÃ­vel salvar o nome da suplente.' : isEs ? 'No se pudo guardar el nombre de la suplente.' : 'Could not save the substitute name.'
      ));
    }
  };

  const setPhysicalCourt = async (groupId: string, physicalNum: number | null) => {
    if (isMutating) return;
    setActionError(null);
    const currentGroup = groups.find(g => g.group.id === groupId)?.group;
    if (!currentGroup) return;

    if (physicalNum !== null) {
      const slotConflict = groups.find(g =>
        g.group.id !== groupId
        && g.group.time_slot_id === currentGroup.time_slot_id
        && g.group.physical_court_number === physicalNum
      );

      if (slotConflict) {
        const fallbackSlot = slots.find(slot => !groups.some(g =>
          g.group.id !== groupId
          && g.group.time_slot_id === slot.id
          && g.group.physical_court_number === physicalNum
        ));

        if (!fallbackSlot) {
          const message = getPhysicalCourtConflictMessage();
          setActionError(message);
          toast.warning(message);
          return;
        }

        try {
          await runOrThrow(() => db.from('round_court_groups').update({
            physical_court_number: physicalNum,
            time_slot_id: fallbackSlot.id,
          }).eq('id', groupId));
          toast.success(getPhysicalCourtAutoMoveMessage(fallbackSlot.slot_time));
          loadAll();
          return;
        } catch (error: any) {
          if (error?.code === '23505') {
            const message = getPhysicalCourtConflictMessage();
            setActionError(message);
            toast.warning(message);
            return;
          }

          setActionError(getActionErrorMessage(
            error,
            isPt ? 'NÃ£o foi possÃ­vel atualizar a quadra fÃ­sica.' : isEs ? 'No se pudo actualizar la cancha asignada.' : 'Could not update the physical court.'
          ));
          return;
        }
      }
    }

    try {
      await runOrThrow(() => db.from('round_court_groups').update({ physical_court_number: physicalNum }).eq('id', groupId));
      loadAll();
    } catch (error: any) {
      if (error?.code === '23505') {
        const message = getPhysicalCourtConflictMessage();
        setActionError(message);
        toast.warning(message);
        return;
      }

      setActionError(getActionErrorMessage(
        error,
        isPt ? 'Não foi possível atualizar a quadra física.' : isEs ? 'No se pudo actualizar la cancha asignada.' : 'Could not update the physical court.'
      ));
    }
  };

  const setGroupSlot = async (groupId: string, slotId: string) => {
    if (isMutating) return;
    setActionError(null);
    const currentGroup = groups.find(g => g.group.id === groupId)?.group;
    if (!currentGroup) return;

    if (currentGroup.physical_court_number !== null) {
      const slotConflict = groups.find(g =>
        g.group.id !== groupId
        && g.group.time_slot_id === slotId
        && g.group.physical_court_number === currentGroup.physical_court_number
      );

      if (slotConflict) {
        const message = getPhysicalCourtConflictMessage(slotId);
        setActionError(message);
        toast.warning(message);
        return;
      }
    }

    try {
      await runOrThrow(() => db.from('round_court_groups').update({ time_slot_id: slotId }).eq('id', groupId));
      loadAll();
    } catch (error: any) {
      if (error?.code === '23505' && currentGroup.physical_court_number !== null) {
        const message = getPhysicalCourtConflictMessage(slotId);
        setActionError(message);
        toast.warning(message);
        return;
      }

      setActionError(getActionErrorMessage(
        error,
        isPt ? 'Não foi possível atualizar o horário do jogo.' : isEs ? 'No se pudo actualizar el horario del juego.' : 'Could not update the match time.'
      ));
    }
  };

  // ── Status da rodada ────────────────────────────────────────
  const startRound = async () => {
    if (isMutating) return;
    setActionError(null);
    setStartingRound(true);
    try {
      await runOrThrow(() => db.from('rounds').update({ status: 'running' }).eq('id', roundId));
      toast.success(isPt ? 'Rodada iniciada.' : isEs ? 'Jornada iniciada.' : 'Round started.');
      loadAll();
    } catch (error: any) {
      setActionError(getActionErrorMessage(
        error,
        isPt ? 'Não foi possível iniciar a rodada.' : isEs ? 'No se pudo iniciar la jornada.' : 'Could not start the round.'
      ));
    } finally {
      setStartingRound(false);
    }
  };

  const closeRound = async () => {
    if (!round) return;

    const ok = await confirm({
      title: isPt ? 'Fechar rodada' : isEs ? 'Cerrar jornada' : 'Close round',
      message: isPt ? 'Os pontos serão calculados e o ranking atualizado. Não é possível desfazer.' : isEs ? 'Se calcularán puntos y se actualizará el ranking. No se puede deshacer.' : 'Points will be calculated and ranking updated. This cannot be undone.',
      confirmLabel: isPt ? 'Fechar' : isEs ? 'Cerrar' : 'Close',
      cancelLabel: isPt ? 'Cancelar' : isEs ? 'Cancelar' : 'Cancel',
      variant: 'warning',
    });
    if (!ok) return;

    setActionError(null);
    setClosingRound(true);
    try {
      const pendingMatchIds = groups
        .flatMap(group => group.matches)
        .filter(match => match.score_team1 !== null && match.score_team2 !== null && !match.is_recorded)
        .map(match => match.id);

      if (pendingMatchIds.length > 0) {
        await runOrThrow(
          () => db.from('matches').update({ is_recorded: true }).in('id', pendingMatchIds),
          isPt ? 'Erro ao confirmar placares' : isEs ? 'Error al confirmar marcadores' : 'Failed to confirm scores'
        );
      }

      await runOrThrow(
        () => db.rpc('close_round', { p_round_id: roundId }),
        isPt ? 'Erro ao fechar rodada' : isEs ? 'Error al cerrar jornada' : 'Failed to close round'
      );
      toast.success(isPt ? 'Rodada fechada. Ranking atualizado.' : isEs ? 'Jornada cerrada. Ranking actualizado.' : 'Round closed. Ranking updated.');
      loadAll();
    } catch (error: any) {
      setActionError(getActionErrorMessage(
        error,
        isPt ? 'Não foi possível fechar a rodada.' : isEs ? 'No se pudo cerrar la jornada.' : 'Could not close the round.'
      ));
    } finally {
      setClosingRound(false);
    }
  };

  // ── WhatsApp ────────────────────────────────────────────────
  const buildRoundWhatsAppMessage = async () => {
    if (!league || !round) return null;
    const date = new Date(`${round.round_date}T12:00:00`);
    const dateLabel = Number.isNaN(date.getTime())
      ? round.round_date
      : date.toLocaleDateString(isPt ? 'pt-BR' : isEs ? 'es-ES' : 'en-US');

    const title = [
      `*${league.name.toUpperCase()}*`,
      isPt
        ? `RODADA ${round.number} - ${dateLabel}`
        : isEs
          ? `JORNADA ${round.number} - ${dateLabel}`
          : `ROUND ${round.number} - ${dateLabel}`,
      '',
    ];

    const sortedGroups = [...groups].sort((a, b) => {
      const slotDiff = (a.slot?.sort_order || 0) - (b.slot?.sort_order || 0);
      return slotDiff !== 0 ? slotDiff : (a.court?.court_number || 0) - (b.court?.court_number || 0);
    });

    const body = sortedGroups.flatMap((group) => {
      const sectionTitle = `*${isPt ? 'CANCHA' : isEs ? 'CANCHA' : 'COURT'} ${group.court?.court_number || '-'}*`;
      const scheduleLine = `${isPt ? 'HORARIO' : isEs ? 'HORARIO' : 'TIME'}: ${group.slot?.slot_time || '--:--'} | ${isPt ? 'CANCHAS' : isEs ? 'CANCHAS' : 'PHYS'}: ${group.group.physical_court_number || '-'}`;
      const columnLine = `${isPt ? 'JOGADORAS' : isEs ? 'JUGADORAS' : 'PLAYERS'} | ${isPt ? 'SUPLENTES' : isEs ? 'SUPLENTES' : 'SUBSTITUTES'}`;
      const players = [1, 2, 3, 4].map((position) => {
        const player = group.players.find((entry) => entry.position === position);
        const name = player?.playerData?.full_name || '-';
        const substitute = player?.attendance === 'present'
          ? 'ok'
          : (player?.substitute_name?.trim() || (isPt ? 'pendente' : isEs ? 'pendiente' : 'pending'));
        return `${position}. ${name} | ${substitute}`;
      });

      return [sectionTitle, scheduleLine, columnLine, ...players, ''];
    });

    return [...title, ...body].join('\n').trim();
  };

  const copyWhatsApp = async () => {
    const msg = await buildRoundWhatsAppMessage();
    if (!msg) return;

    let ok = false;
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(msg); ok = true; } catch {}
    }
    if (!ok) {
      const ta = Object.assign(document.createElement('textarea'), { value: msg, readOnly: true, style: 'position:fixed;left:-9999px' });
      document.body.appendChild(ta); ta.select();
      ok = document.execCommand('copy'); document.body.removeChild(ta);
    }
    ok
      ? toast.success(isPt ? 'Copiado.' : isEs ? 'Copiado.' : 'Copied.')
      : toast.error(isPt ? 'Não foi possível copiar agora.' : isEs ? 'No fue posible copiar ahora.' : 'Could not copy right now.');
  };

  // ── Render ──────────────────────────────────────────────────
  const openWhatsAppRound = async () => {
    const msg = await buildRoundWhatsAppMessage();
    if (!msg || typeof window === 'undefined') return;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const openWhatsAppGroup = (g: GroupWithDetails) => {
    if (!league || !round || typeof window === 'undefined') return;

    const lines = [
      `*${league.name}*`,
      isPt ? `Rodada ${round.number}` : isEs ? `Jornada ${round.number}` : `Round ${round.number}`,
      isPt ? `Quadra nível ${g.court.court_number}` : isEs ? `Cancha nivel ${g.court.court_number}` : `Level court ${g.court.court_number}`,
      isPt ? `Horário: ${g.slot?.slot_time || '-'}` : isEs ? `Horario: ${g.slot?.slot_time || '-'}` : `Time: ${g.slot?.slot_time || '-'}`,
      '',
      ...[1, 2, 3, 4].map((position) => {
        const player = g.players.find((entry) => entry.position === position);
        const label = ['A', 'B', 'C', 'D'][position - 1];
        if (!player) return `${label}: ${isPt ? 'a definir' : isEs ? 'por definir' : 'to assign'}`;
        return `${label}: ${player.playerData?.full_name || '?'} (${player.attendance})`;
      }),
      '',
      isPt ? 'Confirme presença ou envie substituta, por favor.' : isEs ? 'Confirma asistencia o envía suplente, por favor.' : 'Please confirm attendance or send a substitute.',
    ];

    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer');
  };

  const openGoogleCalendarRound = () => {
    if (!league || !round || typeof window === 'undefined') return;

    const parseSlotMinutes = (slotTime: string) => {
      const [hours, minutes] = slotTime.split(':').map((value) => parseInt(value, 10));
      return ((Number.isFinite(hours) ? hours : 9) * 60) + (Number.isFinite(minutes) ? minutes : 0);
    };
    const buildDate = (minutesFromMidnight: number) => {
      const [year, month, day] = round.round_date.split('-').map((value) => parseInt(value, 10));
      const hours = Math.floor(minutesFromMidnight / 60);
      const minutes = minutesFromMidnight % 60;
      return new Date(year, (month || 1) - 1, day || 1, hours, minutes, 0, 0);
    };
    const formatGoogleDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

    const slotMinutes = slots.length > 0
      ? slots.map((slot) => parseSlotMinutes(slot.slot_time)).sort((a, b) => a - b)
      : [9 * 60];
    const startDate = buildDate(slotMinutes[0]);
    const endDate = buildDate(slotMinutes[slotMinutes.length - 1] + 90);
    const startLabel = slots[0]?.slot_time || '--:--';
    const endLabel = slots[slots.length - 1]?.slot_time || startLabel;
    const details = [
      league.name,
      isPt ? `Rodada ${round.number} | ${startLabel} até ${endLabel}` : isEs ? `Jornada ${round.number} | ${startLabel} a ${endLabel}` : `Round ${round.number} | ${startLabel} to ${endLabel}`,
      isPt ? 'Resumo da programação do dia.' : isEs ? 'Resumen de la programación del día.' : 'Day schedule summary.',
      '',
      isPt ? 'Programação de quadras:' : isEs ? 'Programación de canchas:' : 'Court schedule:',
      ...groups.map((group) => {
        const playerNames = group.players.map((player) => player.playerData?.full_name || '?').join(', ');
        return `${group.slot?.slot_time || '--:--'} • ${isPt ? 'Quadra' : isEs ? 'Cancha' : 'Court'} ${group.court?.court_number || '-'}${playerNames ? ` • ${playerNames}` : ''}`;
      }),
    ].join('\n').trim();

    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.set('action', 'TEMPLATE');
    url.searchParams.set('text', `${league.name} | ${isPt ? 'Rodada' : isEs ? 'Jornada' : 'Round'} ${round.number}`);
    url.searchParams.set('dates', `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`);
    url.searchParams.set('details', details);

    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  const filteredGroups = groups;

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-[2rem] border border-white/70 bg-white/85 p-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)] sm:p-6">
        <div className="mb-3 h-7 w-1/3 rounded-full bg-neutral-200" />
        <div className="h-4 w-1/2 rounded-full bg-neutral-100" />
      </div>
      {[1, 2].map(i => (
        <div key={i} className="card p-5">
          <div className="mb-4 h-4 w-1/4 rounded-full bg-neutral-200" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map(j => <div key={j} className="h-24 rounded-2xl bg-neutral-100" />)}
          </div>
        </div>
      ))}
    </div>
  );
  if (!round) {
    if (loadError) {
      return (
        <div className="max-w-2xl mx-auto py-10">
          <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-[0_18px_34px_-30px_rgba(220,38,38,0.25)]">
            <div className="font-semibold">{isPt ? 'Erro ao carregar rodada' : isEs ? 'Error al cargar jornada' : 'Round loading error'}</div>
            <div className="mt-1 break-words">{loadError}</div>
            <button
              onClick={loadAll}
              className="mt-3 rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700">
              {isPt ? 'Tentar de novo' : isEs ? 'Intentar otra vez' : 'Try again'}
            </button>
          </div>
        </div>
      );
    }
    return <div className="text-center py-12 text-red-400">{t('error', locale)}</div>;
  }

  const isClosed = round.status === 'closed';
  const physicalCourtsCount = league?.physical_courts_count || 6;
  const attendanceIssues: any[] = [];
  const levelNum = 0;
  const g = { slot: null as { slot_time?: string } | null };
  const attendanceLabel = (_value: string) => '';

  const _unusedOpenAttendanceWhatsApp1 = () => {
    if (attendanceIssues.length === 0 || typeof window === 'undefined') return;

    const lines = [
      isPt ? `Quadra nível ${levelNum} - ajuste de presença` : isEs ? `Cancha nivel ${levelNum} - ajuste de asistencia` : `Level court ${levelNum} - attendance follow-up`,
      isPt ? `Horário: ${g.slot?.slot_time || '-'}` : isEs ? `Horario: ${g.slot?.slot_time || '-'}` : `Time: ${g.slot?.slot_time || '-'}`,
      '',
      ...attendanceIssues.map((player) => `${player.playerData?.full_name || '?'} - ${attendanceLabel(player.attendance)}`),
      '',
      isPt ? 'Por favor confirme presença ou envie substituta para este jogo.' : isEs ? 'Por favor confirma asistencia o envía suplente para este partido.' : 'Please confirm attendance or send a substitute for this match.',
    ];

    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer');
  };
  const _unusedOpenAttendanceWhatsApp2 = () => {
    if (attendanceIssues.length === 0 || typeof window === 'undefined') return;

    const lines = [
      isPt ? `Quadra nível ${levelNum} - ajuste de presença` : isEs ? `Cancha nivel ${levelNum} - ajuste de asistencia` : `Level court ${levelNum} - attendance follow-up`,
      isPt ? `Horário: ${g.slot?.slot_time || '-'}` : isEs ? `Horario: ${g.slot?.slot_time || '-'}` : `Time: ${g.slot?.slot_time || '-'}`,
      '',
      ...attendanceIssues.map((player) => `${player.playerData?.full_name || '?'} - ${attendanceLabel(player.attendance)}`),
      '',
      isPt ? 'Por favor confirme presença ou envie substituta para este jogo.' : isEs ? 'Por favor confirma asistencia o envía suplente para este partido.' : 'Please confirm attendance or send a substitute for this match.',
    ];

    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-5">
      {loadError && (
        <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-[0_18px_34px_-30px_rgba(220,38,38,0.25)]">
          <div className="font-semibold">{isPt ? 'Erro ao carregar rodada' : isEs ? 'Error al cargar jornada' : 'Round loading error'}</div>
          <div className="mt-1 break-words">{loadError}</div>
          <button
            onClick={loadAll}
            className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
            {isPt ? 'Tentar de novo' : isEs ? 'Intentar otra vez' : 'Try again'}
          </button>
        </div>
      )}

      {actionError && (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-[0_18px_34px_-30px_rgba(180,83,9,0.22)]">
          <div className="font-semibold">
            {isPt ? 'Falha na operação' : isEs ? 'Fallo en la operación' : 'Action failed'}
          </div>
          <div className="mt-1 break-words">{actionError}</div>
        </div>
      )}

      {/* Header card */}
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.14),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-4 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.42)] sm:p-6">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <button onClick={() => router.push(`/app/leagues/${leagueId}/rounds`)}
              className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/80 text-neutral-500 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.28)] transition hover:text-neutral-800">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
                {isPt ? 'Centro da rodada' : isEs ? 'Centro de jornada' : 'Round control'}
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-[-0.03em] text-neutral-950 sm:text-4xl">
                {isPt ? `Rodada ${round.number}` : isEs ? `Jornada ${round.number}` : `Round ${round.number}`}
              </h1>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-neutral-500">
                <MapPin size={13} className="text-teal-500" />
                {league?.name}
              </p>
            </div>
          </div>
          <StatusBadge status={round.status} locale={locale} />
        </div>

        {/* Action buttons */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {round.status === 'draft' && (
            <button onClick={startRound} disabled={isMutating} className="btn-primary inline-flex w-full items-center justify-center gap-1.5 disabled:opacity-60 sm:w-auto">
              {startingRound
                ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{isPt ? 'Iniciando...' : isEs ? 'Iniciando...' : 'Starting...'}</>
                : <><PlayCircle size={16} />{isPt ? 'Iniciar' : isEs ? 'Iniciar jornada' : 'Start round'}</>}
            </button>
          )}
          {round.status === 'running' && (
            <button onClick={closeRound} disabled={isMutating}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_-24px_rgba(15,23,42,0.45)] transition hover:bg-neutral-700 disabled:opacity-60 sm:w-auto">
              {closingRound
                ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{isPt ? 'Fechando...' : isEs ? 'Cerrando...' : 'Closing...'}</>
                : <><Lock size={16} />{isPt ? 'Fechar rodada' : isEs ? 'Cerrar jornada' : 'Close round'}</>}
            </button>
          )}
          <button onClick={copyWhatsApp} disabled={isMutating}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_-24px_rgba(37,211,102,0.45)] transition hover:bg-[#1ebe59] disabled:opacity-60 sm:w-auto">
            <MessageCircle size={16} />
            {isPt ? 'Copiar WhatsApp' : isEs ? 'Copiar WhatsApp' : 'Copy WhatsApp'}
          </button>
          <button onClick={openWhatsAppRound} disabled={isMutating}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-emerald-200 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/15 disabled:opacity-60 sm:w-auto">
            <MessageCircle size={16} />
            {isPt ? 'Abrir WhatsApp' : isEs ? 'Abrir WhatsApp' : 'Open WhatsApp'}
          </button>
          <button onClick={openGoogleCalendarRound} disabled={isMutating}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-sky-200 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-500/15 disabled:opacity-60 sm:w-auto">
            <CalendarPlus size={16} />
            {isPt ? 'Google Agenda' : isEs ? 'Google Calendar' : 'Google Calendar'}
          </button>
        </div>

        {slots.length > 0 && (
          <div className="mt-5 rounded-[1.4rem] bg-neutral-900/5 px-4 py-3 text-sm text-neutral-600">
            {isPt
              ? 'Horário e quadra física podem ser ajustados em cada jogo.'
              : isEs
                ? 'Horario y cancha asignada se pueden ajustar en cada juego.'
                : 'Time slot and physical court can be set per game.'}
          </div>
        )}
      </section>

      {/* Court cards */}
      {slots.length === 0 ? (
        <div className="card space-y-3 p-8 text-center text-neutral-500 sm:p-10">
          <p className="font-semibold">
            {isPt ? 'Faltam horários na liga' : isEs ? 'Faltan horarios en la liga' : 'This league has no time slots'}
          </p>
          <button
            onClick={() => router.push(`/app/leagues/${leagueId}/settings`)}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto">
            {isPt ? 'Configurar liga' : isEs ? 'Configurar liga' : 'Configure league'}
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="card space-y-3 p-8 text-center text-neutral-500 sm:p-10">
          <p className="font-semibold">
            {isPt ? 'Esta rodada ainda não tem grupos' : isEs ? 'Esta jornada aún no tiene grupos' : 'This round has no groups yet'}
          </p>
          <p className="text-sm text-neutral-400">
            {isPt ? 'Configure horários e quadras antes de abrir a próxima rodada.' : isEs ? 'Configura horarios y canchas antes de abrir la próxima jornada.' : 'Configure time slots and courts before opening the next round.'}
          </p>
          <button
            onClick={() => router.push(`/app/leagues/${leagueId}/settings`)}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto">
            {isPt ? 'Abrir configurações' : isEs ? 'Abrir configuración' : 'Open settings'}
          </button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="card p-10 text-center text-neutral-400">
          {isPt ? 'Nenhuma quadra neste horário' : isEs ? 'No hay canchas en este horario' : 'No courts in this time slot'}
        </div>
      ) : (
        groups.map(g => (
          <CourtCard
            key={g.group.id}
            g={g}
            isClosed={isClosed}
            physicalCourtsCount={physicalCourtsCount}
            allPlayers={allPlayers}
            allGroups={groups}
            slots={slots}
            rules={rules}
            expandedGroup={expandedGroup}
            disabled={isClosed || isMutating}
            locale={locale}
            onExpand={id => setExpandedGroup(expandedGroup === id ? null : id)}
            onAssignPlayer={assignPlayer}
            onRemovePlayer={removePlayer}
            onToggleAttendance={toggleAttendance}
            onSetSubstituteName={setSubstituteName}
            onSaveScore={saveScore}
            onSetPhysical={setPhysicalCourt}
            onSetSlot={setGroupSlot}
            onOpenWhatsApp={() => openWhatsAppGroup(g)}
          />
        ))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COURT CARD
// ─────────────────────────────────────────────────────────────
function CourtCard({ g, isClosed, physicalCourtsCount, allPlayers, allGroups, slots, rules, expandedGroup, disabled, locale, onExpand, onAssignPlayer, onRemovePlayer, onToggleAttendance, onSetSubstituteName, onSaveScore, onSetPhysical, onSetSlot, onOpenWhatsApp }: {
  g: GroupWithDetails; isClosed: boolean; physicalCourtsCount: number;
  allPlayers: Player[]; allGroups: GroupWithDetails[]; slots: LeagueTimeSlot[]; rules: Rules | null;
  expandedGroup: string | null; disabled: boolean; locale: string;
  onExpand: (id: string) => void;
  onAssignPlayer: (gId: string, pos: number, pId: string) => void;
  onRemovePlayer: (cpId: string) => void;
  onToggleAttendance: (cpId: string, att: string) => void;
  onSetSubstituteName: (cpId: string, substituteName: string) => void;
  onSaveScore: (mId: string, s1: number, s2: number) => void;
  onSetPhysical: (gId: string, n: number | null) => void;
  onSetSlot: (gId: string, slotId: string) => void;
  onOpenWhatsApp: () => void;
}) {
  const isEs = locale === 'es'; const isPt = locale === 'pt';
  const toast = useToast();
  const isExpanded = expandedGroup === g.group.id;
  const allRecorded = g.matches.length === 3 && g.matches.every(m => m.is_recorded);
  const hasPlayers = g.players.length === 4;
  const pendingCount = g.matches.filter(m => !m.is_recorded).length;
  const attendanceIssues = g.players.filter(player => player.attendance !== 'present');
  const absentIssues = attendanceIssues.filter(player => player.attendance === 'absent');
  const substituteIssues = attendanceIssues.filter(player => player.attendance === 'substitute');
  const openAttendanceWhatsApp = () => {
    if (attendanceIssues.length === 0 || typeof window === 'undefined') return;

    const lines = [
      isPt ? `Quadra nível ${levelNum} - ajuste de presença` : isEs ? `Cancha nivel ${levelNum} - ajuste de asistencia` : `Level court ${levelNum} - attendance follow-up`,
      isPt ? `Horário: ${g.slot?.slot_time || '-'}` : isEs ? `Horario: ${g.slot?.slot_time || '-'}` : `Time: ${g.slot?.slot_time || '-'}`,
      '',
      ...attendanceIssues.map((player) => `${player.playerData?.full_name || '?'} - ${attendanceLabel(player.attendance)}`),
      '',
      isPt ? 'Por favor confirme presença ou envie substituta para este jogo.' : isEs ? 'Por favor confirma asistencia o envía suplente para este partido.' : 'Please confirm attendance or send a substitute for this match.',
    ];

    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer');
  };
  const levelNum = g.court?.court_number || 0;
  const physicalNum = g.group.physical_court_number;
  const assignedInCurrentSlot = new Set(
    allGroups
      .filter(other => other.slot?.id === g.slot?.id && other.group.id !== g.group.id)
      .flatMap(other => other.players.map(player => player.player_id))
  );

  const ATTENDANCE_STYLE: Record<string, string> = {
    present:    'bg-emerald-50 border-emerald-300',
    absent:     'bg-red-50 border-red-300',
    substitute: 'bg-amber-50 border-amber-300',
  };
  const ATTENDANCE_BTN: Record<string, string> = {
    present:    'bg-emerald-200 text-emerald-800',
    absent:     'bg-red-200 text-red-800',
    substitute: 'bg-amber-200 text-amber-800',
  };
  const copyAttendanceWhatsApp = async () => {
    if (attendanceIssues.length === 0 || typeof window === 'undefined') return;

    const lines = [
      isPt ? `Quadra nível ${levelNum} - ajuste de presença` : isEs ? `Cancha nivel ${levelNum} - ajuste de asistencia` : `Level court ${levelNum} - attendance follow-up`,
      isPt ? `Horario: ${g.slot?.slot_time || '-'}` : isEs ? `Horario: ${g.slot?.slot_time || '-'}` : `Time: ${g.slot?.slot_time || '-'}`,
      '',
      ...attendanceIssues.map((player) => `${player.playerData?.full_name || '?'} - ${attendanceLabel(player.attendance)}`),
      '',
      isPt ? 'Por favor confirme presença ou envie substituta para este jogo.' : isEs ? 'Por favor confirma asistencia o envia suplente para este partido.' : 'Please confirm attendance or send a substitute for this match.',
    ];

    const message = lines.join('\n');
    let copied = false;
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(message); copied = true; } catch {}
    }
    if (!copied) {
      const ta = Object.assign(document.createElement('textarea'), { value: message, readOnly: true, style: 'position:fixed;left:-9999px' });
      document.body.appendChild(ta);
      ta.select();
      copied = document.execCommand('copy');
      document.body.removeChild(ta);
    }

    copied
      ? toast.success(isPt ? 'Mensagem copiada.' : isEs ? 'Mensaje copiado.' : 'Message copied.')
      : toast.error(isPt ? 'Não foi possível copiar agora.' : isEs ? 'No fue posible copiar ahora.' : 'Could not copy right now.');
  };
  const buildIssueMessage = (kind: 'absent' | 'substitute') => {
    const players = kind === 'absent' ? absentIssues : substituteIssues;
    if (players.length === 0) return null;

    const title = kind === 'absent'
      ? (isPt ? `Quadra nivel ${levelNum} - confirmar ausencias` : isEs ? `Cancha nivel ${levelNum} - confirmar ausencias` : `Level court ${levelNum} - confirm absences`)
      : (isPt ? `Quadra nivel ${levelNum} - confirmar substitutas` : isEs ? `Cancha nivel ${levelNum} - confirmar suplentes` : `Level court ${levelNum} - confirm substitutes`);
    const cta = kind === 'absent'
      ? (isPt ? 'Por favor confirme presença ou indique substituta para estas jogadoras.' : isEs ? 'Por favor confirma asistencia o indica suplente para estas jugadoras.' : 'Please confirm attendance or provide a substitute for these players.')
      : (isPt ? 'Por favor confirme as substitutas disponiveis para esta quadra.' : isEs ? 'Por favor confirma las suplentes disponibles para esta cancha.' : 'Please confirm the available substitutes for this court.');

    return [
      title,
      isPt ? `Horario: ${g.slot?.slot_time || '-'}` : isEs ? `Horario: ${g.slot?.slot_time || '-'}` : `Time: ${g.slot?.slot_time || '-'}`,
      '',
      ...players.map((player) => `${player.playerData?.full_name || '?'} - ${attendanceLabel(player.attendance)}${player.substitute_name ? ` - ${player.substitute_name}` : ''}`),
      '',
      cta,
    ].join('\n');
  };
  const copyIssueMessage = async (kind: 'absent' | 'substitute') => {
    const message = buildIssueMessage(kind);
    if (!message || typeof window === 'undefined') return;

    let copied = false;
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(message); copied = true; } catch {}
    }
    if (!copied) {
      const ta = Object.assign(document.createElement('textarea'), { value: message, readOnly: true, style: 'position:fixed;left:-9999px' });
      document.body.appendChild(ta);
      ta.select();
      copied = document.execCommand('copy');
      document.body.removeChild(ta);
    }

    copied
      ? toast.success(isPt ? 'Mensagem copiada.' : isEs ? 'Mensaje copiado.' : 'Message copied.')
      : toast.error(isPt ? 'Não foi possível copiar agora.' : isEs ? 'No fue posible copiar ahora.' : 'Could not copy right now.');
  };
  const openIssueWhatsApp = (kind: 'absent' | 'substitute') => {
    const message = buildIssueMessage(kind);
    if (!message || typeof window === 'undefined') return;
    const players = kind === 'absent' ? absentIssues : substituteIssues;
    const directPhone = players.length === 1 ? toWhatsAppPhone(parsePlayerContact(players[0].playerData?.notes).phone) : null;
    const target = directPhone
      ? `https://wa.me/${directPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(target, '_blank', 'noopener,noreferrer');
  };
  const remindPlayer = (playerEntry: RoundCourtPlayer & { playerData: Player }) => {
    if (typeof window === 'undefined') return;

    const contact = parsePlayerContact(playerEntry.playerData?.notes);
    const phone = toWhatsAppPhone(contact.phone);
    if (!phone) {
      toast.warning(isPt ? 'Adicione um telefone para essa jogadora.' : isEs ? 'Agrega un telefono para esta jugadora.' : 'Add a phone number for this player.');
      return;
    }

    const reminderTone = playerEntry.attendance === 'absent'
      ? {
          intro: isPt ? 'Preciso confirmar sua ausencia nesta rodada.' : isEs ? 'Necesito confirmar tu ausencia en esta jornada.' : 'I need to confirm your absence for this round.',
          followUp: isPt ? 'Se conseguir jogar, me avisa. Se nao, me confirma para eu ajustar a escala.' : isEs ? 'Si puedes jugar, avisame. Si no, confirmamelo para ajustar la rotacion.' : 'If you can still play, let me know. Otherwise, please confirm so I can adjust the lineup.',
          cta: isPt ? 'confirmar ausencia' : isEs ? 'confirmar ausencia' : 'confirm absence',
        }
      : playerEntry.attendance === 'substitute'
        ? {
            intro: isPt ? 'Quero alinhar sua entrada como substituta nesta rodada.' : isEs ? 'Quiero confirmar tu entrada como suplente en esta jornada.' : 'I want to confirm your substitute availability for this round.',
            followUp: isPt ? 'Me avisa se consegue entrar nessa faixa de horario.' : isEs ? 'Avisame si puedes entrar en esta franja horaria.' : 'Let me know if you can join in this time slot.',
            cta: isPt ? 'chamar substituta' : isEs ? 'llamar suplente' : 'call substitute',
          }
        : {
            intro: isPt ? 'Lembrete rapido da sua rodada.' : isEs ? 'Recordatorio rapido de tu partido.' : 'Quick reminder for your match.',
            followUp: isPt ? 'Me confirma sua presenca quando puder, por favor.' : isEs ? 'Confirma tu asistencia cuando puedas, por favor.' : 'Please confirm your attendance when you can.',
            cta: isPt ? 'confirmar presenca' : isEs ? 'confirmar asistencia' : 'confirm attendance',
          };

    const message = [
      isPt ? `Oi, ${playerEntry.playerData?.full_name || 'jogadora'}.` : isEs ? `Hola, ${playerEntry.playerData?.full_name || 'jugadora'}.` : `Hi, ${playerEntry.playerData?.full_name || 'player'}.`,
      reminderTone.intro,
      isPt ? `Faixa prevista: ${g.slot?.slot_time || '--:--'}.` : isEs ? `Franja prevista: ${g.slot?.slot_time || '--:--'}.` : `Planned slot: ${g.slot?.slot_time || '--:--'}.`,
      isPt ? `Quadra nivel ${levelNum}.` : isEs ? `Cancha nivel ${levelNum}.` : `Level court ${levelNum}.`,
      reminderTone.followUp,
    ].join('\n');

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };
  const attendanceLabel = (a: string) => {
    if (a === 'present')    return isPt ? '✓ Presente' : isEs ? '✓ Presente' : '✓ Present';
    if (a === 'absent')     return isPt ? '✗ Ausente'  : isEs ? '✗ Ausente'  : '✗ Absent';
    return isPt ? '↔ Sub' : isEs ? '↔ Suplente' : '↔ Sub';
  };

  return (
    <div className={`overflow-hidden rounded-[1.8rem] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] shadow-[0_22px_48px_-34px_rgba(15,23,42,0.32)] ${g.group.is_cancelled ? 'opacity-40' : ''}`}>
      {/* Header */}
      <div className="border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 flex-col items-center justify-center rounded-2xl font-bold shadow-[0_18px_34px_-24px_rgba(15,23,42,0.28)] ${
              allRecorded ? 'bg-emerald-500 text-white' : hasPlayers ? 'bg-teal-500 text-white' : 'bg-neutral-900/8 text-neutral-500'
            }`}>
              <span className="text-[9px] uppercase leading-none">{isPt ? 'Nív' : isEs ? 'Niv' : 'Lvl'}</span>
              <span className="text-lg leading-none">{levelNum}</span>
            </div>
            <div>
              <h3 className="text-sm font-black text-neutral-900 sm:text-base">
                {isPt ? `Quadra Nível ${levelNum}` : isEs ? `Cancha Nivel ${levelNum}` : `Level Court ${levelNum}`}
              </h3>
              <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                {!disabled ? (
                  <select
                    className="cursor-pointer rounded-lg border-none bg-transparent p-0 text-xs font-semibold text-teal-700 focus:ring-0"
                    value={g.slot?.id || ''}
                    onChange={e => { if (e.target.value) onSetSlot(g.group.id, e.target.value); }}>
                    {slots.map(slot => (
                      <option key={slot.id} value={slot.id}>{slot.slot_time}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-semibold text-teal-700">{g.slot?.slot_time || '—'}</span>
                )}
                <MapPin size={12} className="text-orange-500" />
                {!disabled ? (
                  <select
                    className="cursor-pointer rounded-lg border-none bg-transparent p-0 text-xs font-semibold text-orange-600 focus:ring-0"
                    value={physicalNum || ''}
                    onChange={e => onSetPhysical(g.group.id, e.target.value ? parseInt(e.target.value) : null)}>
                    <option value="">{isPt ? '— Quadra física —' : isEs ? '— Cancha física —' : '— Physical court —'}</option>
                    {Array.from({ length: physicalCourtsCount }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{isPt ? `Física ${n}` : isEs ? `Física ${n}` : `Phys. ${n}`}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-orange-600 font-semibold">
                    {physicalNum ? `Física ${physicalNum}` : '—'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex self-start sm:self-auto items-center gap-2">
            <button
              onClick={onOpenWhatsApp}
              className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-500/10 px-2.5 py-2 text-emerald-700 transition hover:bg-emerald-500/15"
              title={isPt ? 'Abrir WhatsApp desta quadra' : isEs ? 'Abrir WhatsApp de esta cancha' : 'Open WhatsApp for this court'}
            >
              <MessageCircle size={14} />
            </button>
            {allRecorded
              ? <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">✓ {isPt ? 'Ok' : isEs ? 'Ok' : 'Ok'}</span>
              : hasPlayers && pendingCount > 0
              ? <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">{pendingCount} pend.</span>
              : <span className="text-xs px-2 py-1 rounded-full bg-neutral-100 text-neutral-500 font-semibold">{g.players.length}/4</span>}
          </div>
        </div>
      </div>

      {/* Players grid */}
      <div className="p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map(pos => {
            const cp = g.players.find(p => p.position === pos);
            const posLabel = ['A', 'B', 'C', 'D'][pos - 1];
            return (
              <div key={pos}>
                {cp ? (
                  <div className={`rounded-2xl p-3 text-center border-2 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.2)] ${ATTENDANCE_STYLE[cp.attendance] || 'bg-neutral-50 border-neutral-200'}`}>
                    <div className="mb-1 text-[10px] font-bold text-neutral-400">{posLabel}</div>
                    <div className="truncate text-sm font-bold text-neutral-800">{cp.playerData?.full_name || '?'}</div>
                    {!disabled ? (
                      <div className="mt-2 flex flex-col gap-1.5">
                        <button onClick={() => onToggleAttendance(cp.id, cp.attendance)}
                          className={`w-full rounded-xl py-1.5 text-xs font-semibold ${ATTENDANCE_BTN[cp.attendance] || ''}`}>
                          {attendanceLabel(cp.attendance)}
                        </button>
                        {cp.attendance !== 'present' && (
                          <input
                            type="text"
                            defaultValue={cp.substitute_name || ''}
                            placeholder={isPt ? 'Nome da suplente' : isEs ? 'Nombre suplente' : 'Substitute name'}
                            onBlur={e => {
                              if ((cp.substitute_name || '') !== e.target.value) {
                                onSetSubstituteName(cp.id, e.target.value);
                              }
                            }}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-2 py-1.5 text-[10px] text-neutral-700 placeholder:text-neutral-400"
                          />
                        )}
                        <button onClick={() => onRemovePlayer(cp.id)}
                          className="text-[10px] text-neutral-400 hover:text-red-500 flex items-center justify-center gap-0.5">
                          <XCircle size={10} />
                          {isPt ? 'remover' : isEs ? 'quitar' : 'remove'}
                        </button>
                      </div>
                    ) : (
                      <p className={`mt-1 text-xs font-medium ${cp.attendance === 'present' ? 'text-emerald-600' : cp.attendance === 'absent' ? 'text-red-500' : 'text-amber-600'}`}>
                        {attendanceLabel(cp.attendance)}
                      </p>
                    )}
                  </div>
                ) : !disabled ? (
                  <div className="rounded-2xl border-2 border-dashed border-neutral-200 p-3">
                    <div className="mb-1 text-center text-[10px] font-bold text-neutral-400">{posLabel}</div>
                    <select className="w-full rounded-xl border border-neutral-200 bg-white p-2 text-xs text-neutral-700"
                      value=""
                      onChange={e => { if (e.target.value) onAssignPlayer(g.group.id, pos, e.target.value); }}>
                      <option value="">{isPt ? 'Selecionar...' : isEs ? 'Seleccionar...' : 'Select...'}</option>
                      {allPlayers
                        .filter(p => !assignedInCurrentSlot.has(p.id) && !g.players.some(gp => gp.player_id === p.id))
                        .map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-neutral-100 p-3 text-center text-neutral-200 text-sm">—</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Aviso < 4 jogadoras */}
      {g.players.length > 0 && g.players.length < 4 && g.matches.length === 0 && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <AlertTriangle size={15} />
            {isPt ? `${4 - g.players.length} jogadoras faltando` : isEs ? `Faltan ${4 - g.players.length} jugadoras` : `${4 - g.players.length} players missing`}
          </div>
        </div>
      )}

      {/* Partidas */}
      {g.matches.length > 0 && (
        <div className="border-t border-neutral-100">
          <button onClick={() => onExpand(g.group.id)}
            className="flex w-full items-center justify-between bg-neutral-50 px-5 py-4 transition hover:bg-neutral-100">
            <div className="flex items-center gap-2">
              <Trophy size={15} className="text-teal-600" />
              <span className="font-semibold text-sm text-neutral-700">
                {isPt ? 'Resultados e Pontos' : isEs ? 'Resultados y Puntos' : 'Results & Points'}
              </span>
              {allRecorded && <Check size={13} className="text-emerald-500" />}
            </div>
            {isExpanded ? <ChevronUp size={17} className="text-neutral-400" /> : <ChevronDown size={17} className="text-neutral-400" />}
          </button>

          {isExpanded && (
            <div className="p-5 space-y-3">
              {g.matches.map(m => {
                const t1p1 = g.players.find(p => p.position === m.team1_pos1);
                const t1p2 = g.players.find(p => p.position === m.team1_pos2);
                const t2p1 = g.players.find(p => p.position === m.team2_pos1);
                const t2p2 = g.players.find(p => p.position === m.team2_pos2);
                return (
                  <MatchScoreRow key={m.id} match={m}
                    team1={[t1p1?.playerData?.full_name || '?', t1p2?.playerData?.full_name || '?']}
                    team2={[t2p1?.playerData?.full_name || '?', t2p2?.playerData?.full_name || '?']}
                    onSave={onSaveScore} disabled={disabled} locale={locale} />
                );
              })}

              {/* Preview de pontos */}
              {rules && g.matches.some(m => m.is_recorded || (m.score_team1 !== null && m.score_team2 !== null)) && (
                <div className="border-t border-neutral-100 pt-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
                    {isPt ? 'Pontos' : isEs ? 'Puntos' : 'Points'}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {Array.from(calculateGroupPoints(g.matches, g.players, rules).entries())
                      .sort((a, b) => b[1] - a[1])
                      .map(([pid, pts], idx, arr) => {
                        const pl = g.players.find(p => p.player_id === pid);
                        return (
                          <div key={pid} className={`flex items-center justify-between rounded-2xl px-3 py-2 text-sm border ${
                            idx === 0 ? 'bg-emerald-50 border-emerald-200' :
                            idx === arr.length - 1 ? 'bg-red-50 border-red-200' :
                            'bg-neutral-50 border-neutral-100'
                          }`}>
                            <span className="text-neutral-700 truncate font-medium">
                              {idx === 0 ? '▲ ' : idx === arr.length - 1 ? '▼ ' : ''}{pl?.playerData?.full_name || '?'}
                            </span>
                            <span className={`font-extrabold ml-2 ${pts >= 0 ? 'text-teal-600' : 'text-red-500'}`}>{pts}</span>
                          </div>
                        );
                      })}
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-1.5">▲ {isPt ? 'Sobe' : isEs ? 'Sube' : 'Up'} - ▼ {isPt ? 'Desce' : isEs ? 'Baja' : 'Down'}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MATCH SCORE ROW
// ─────────────────────────────────────────────────────────────
function MatchScoreRow({ match, team1, team2, onSave, disabled, locale }: {
  match: Match; team1: string[]; team2: string[];
  onSave: (id: string, s1: number, s2: number) => void;
  disabled: boolean; locale: string;
}) {
  const isEs = locale === 'es'; const isPt = locale === 'pt';
  const [s1, setS1] = useState(match.score_team1?.toString() || '');
  const [s2, setS2] = useState(match.score_team2?.toString() || '');

  useEffect(() => {
    setS1(match.score_team1?.toString() || '');
    setS2(match.score_team2?.toString() || '');
  }, [match.score_team1, match.score_team2]);

  const handleSave = () => {
    const n1 = parseInt(s1); const n2 = parseInt(s2);
    if (isValidScore(n1) && isValidScore(n2)) onSave(match.id, n1, n2);
  };

  const recorded = match.is_recorded;
  const hasDraft = !recorded && match.score_team1 !== null && match.score_team2 !== null;

  return (
    <div className={`rounded-2xl border p-4 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.2)] ${
      recorded
        ? 'bg-emerald-50 border-emerald-200'
        : hasDraft
          ? 'bg-amber-50 border-amber-200'
          : 'bg-neutral-50 border-neutral-200'
    }`}>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neutral-400">
        {isPt ? `Partida ${match.match_number}` : isEs ? `Partido ${match.match_number}` : `Match ${match.match_number}`}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2.5">
        {/* Team 1 */}
        <div className="w-full flex-1 space-y-0.5 sm:text-right">
          <p className="text-xs font-semibold text-neutral-700 leading-tight truncate">{team1[0]}</p>
          <p className="text-xs font-semibold text-neutral-700 leading-tight truncate">{team1[1]}</p>
        </div>
        {/* Scores */}
        <div className="flex flex-shrink-0 items-center justify-center gap-1.5">
          <input type="number" inputMode="numeric" min="0" max="7"
            value={s1} onChange={e => setS1(e.target.value)} disabled={disabled}
            className={`h-14 w-14 rounded-2xl border-2 text-center text-2xl font-extrabold transition focus:outline-none focus:ring-2 focus:ring-teal-500 ${
              recorded
                ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                : hasDraft
                  ? 'border-amber-300 bg-amber-100 text-amber-800'
                  : 'border-neutral-300 bg-white'
            } disabled:opacity-60`} />
          <span className="text-neutral-300 text-2xl font-bold">/</span>
          <input type="number" inputMode="numeric" min="0" max="7"
            value={s2} onChange={e => setS2(e.target.value)} disabled={disabled}
            className={`h-14 w-14 rounded-2xl border-2 text-center text-2xl font-extrabold transition focus:outline-none focus:ring-2 focus:ring-teal-500 ${
              recorded
                ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                : hasDraft
                  ? 'border-amber-300 bg-amber-100 text-amber-800'
                  : 'border-neutral-300 bg-white'
            } disabled:opacity-60`} />
        </div>
        {/* Team 2 */}
        <div className="w-full flex-1 space-y-0.5">
          <p className="text-xs font-semibold text-neutral-700 leading-tight truncate">{team2[0]}</p>
          <p className="text-xs font-semibold text-neutral-700 leading-tight truncate">{team2[1]}</p>
        </div>
        {/* Save btn */}
        {!disabled && s1 !== '' && s2 !== '' && (
          <button onClick={handleSave}
            className={`flex w-full flex-shrink-0 items-center justify-center rounded-2xl p-3 transition sm:w-auto ${
              recorded
                ? 'bg-emerald-200 text-emerald-700 hover:bg-emerald-300'
                : hasDraft
                  ? 'bg-amber-200 text-amber-800 hover:bg-amber-300'
                  : 'bg-teal-600 text-white shadow-[0_14px_28px_-20px_rgba(13,148,136,0.45)] hover:bg-teal-700'
            }`}>
            <Check size={18} />
          </button>
        )}
        {disabled && recorded && <div className="p-2 flex-shrink-0"><Check size={18} className="text-emerald-500" /></div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────
function StatusBadge({ status, locale }: { status: string; locale: string }) {
  const isEs = locale === 'es'; const isPt = locale === 'pt';
  const label = status === 'running'
    ? (isPt ? 'Em andamento' : isEs ? 'En curso' : 'In progress')
    : status === 'closed'
    ? (isPt ? 'Fechada' : isEs ? 'Cerrada' : 'Closed')
    : (isPt ? 'Rascunho' : isEs ? 'Borrador' : 'Draft');
  const cls = {
    draft:   'bg-neutral-900/5 text-neutral-600 ring-1 ring-neutral-900/6',
    running: 'bg-sky-500/12 text-sky-700 ring-1 ring-sky-500/10',
    closed:  'bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/10',
  }[status] || 'bg-neutral-900/5 text-neutral-600 ring-1 ring-neutral-900/6';
  return (
    <span className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}
