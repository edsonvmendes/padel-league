import { Match, RoundCourtPlayer, Rules, LeagueRanking } from '@/types/database';

/**
 * Standard match pairings: positions 1-4 map to A,B,C,D
 * Match 1: (1,2) vs (3,4) => A+B vs C+D
 * Match 2: (1,3) vs (2,4) => A+C vs B+D
 * Match 3: (1,4) vs (2,3) => A+D vs B+C
 */
export const MATCH_PAIRINGS = [
  { match_number: 1, team1_pos1: 1, team1_pos2: 2, team2_pos1: 3, team2_pos2: 4 },
  { match_number: 2, team1_pos1: 1, team1_pos2: 3, team2_pos1: 2, team2_pos2: 4 },
  { match_number: 3, team1_pos1: 1, team1_pos2: 4, team2_pos1: 2, team2_pos2: 3 },
];

/**
 * Calculate points per player for a single court group
 */
export function calculateGroupPoints(
  matches: Match[],
  players: RoundCourtPlayer[],
  rules: Rules
): Map<string, number> {
  const pointsMap = new Map<string, number>();
  
  // Initialize all players with 0 points
  players.forEach(p => pointsMap.set(p.player_id, 0));
  
  // Find present and absent players
  const presentPlayers = players.filter(p => p.attendance === 'present' || p.attendance === 'substitute');
  const absentPlayers = players.filter(p => p.attendance === 'absent');
  
  const absentCount = absentPlayers.length;
  
  // Case: 3 absences - single present gets bonus
  if (absentCount >= 3) {
    presentPlayers.forEach(p => {
      pointsMap.set(p.player_id, rules.three_absences_bonus);
    });
    absentPlayers.forEach(p => {
      pointsMap.set(p.player_id, rules.absence_penalty);
    });
    return pointsMap;
  }
  
  // Calculate points from recorded matches for present players
  const recordedMatches = matches.filter(m => m.is_recorded);
  
  recordedMatches.forEach(match => {
    const team1Score = match.score_team1 ?? 0;
    const team2Score = match.score_team2 ?? 0;
    
    // Find players by position
    const team1Players = players.filter(
      p => p.position === match.team1_pos1 || p.position === match.team1_pos2
    );
    const team2Players = players.filter(
      p => p.position === match.team2_pos1 || p.position === match.team2_pos2
    );
    
    team1Players.forEach(p => {
      if (p.attendance !== 'absent') {
        pointsMap.set(p.player_id, (pointsMap.get(p.player_id) || 0) + team1Score);
      }
    });
    
    team2Players.forEach(p => {
      if (p.attendance !== 'absent') {
        pointsMap.set(p.player_id, (pointsMap.get(p.player_id) || 0) + team2Score);
      }
    });
  });
  
  // Apply absence penalty
  if (absentCount > 0) {
    const presentPoints = presentPlayers.map(p => pointsMap.get(p.player_id) || 0);
    const minPresent = presentPoints.length > 0 ? Math.min(...presentPoints) : 0;
    
    absentPlayers.forEach(p => {
      let penalty = rules.absence_penalty;
      if (rules.use_min_actual_when_absent && minPresent < penalty) {
        penalty = minPresent;
      }
      pointsMap.set(p.player_id, penalty);
    });
  }
  
  return pointsMap;
}

/**
 * Determine promotion/relegation for a court group
 */
export function calculatePromotionRelegation(
  playerPoints: Map<string, number>,
  rankings: LeagueRanking[],
  rules: Rules
): { promoted: string[]; relegated: string[]; stays: string[] } {
  const entries = Array.from(playerPoints.entries())
    .map(([playerId, points]) => ({
      playerId,
      points,
      rankingPos: rankings.findIndex(r => r.player_id === playerId),
    }))
    .sort((a, b) => {
      // Sort by points descending
      if (b.points !== a.points) return b.points - a.points;
      // Tiebreak: better ranking position (lower index = better)
      if (a.rankingPos !== -1 && b.rankingPos !== -1) {
        return a.rankingPos - b.rankingPos;
      }
      return 0;
    });
  
  const promoted: string[] = [];
  const relegated: string[] = [];
  const stays: string[] = [];
  
  for (let i = 0; i < entries.length; i++) {
    if (i < rules.promotion_count) {
      promoted.push(entries[i].playerId);
    } else if (i >= entries.length - rules.relegation_count) {
      relegated.push(entries[i].playerId);
    } else {
      stays.push(entries[i].playerId);
    }
  }
  
  return { promoted, relegated, stays };
}

/**
 * Generate WhatsApp message for a round
 */
export function generateWhatsAppMessage(
  leagueName: string,
  roundNumber: number,
  rankings: { name: string; points: number; rank: number }[],
  nextRoundGroups: {
    timeSlot: string;
    courtNumber: number;
    players: string[];
  }[],
  locale: 'en' | 'es' = 'es'
): string {
  const isEs = locale === 'es';
  const lines: string[] = [];
  
  // Header
  lines.push(`🏸 *${leagueName}*`);
  lines.push(`${isEs ? 'Jornada' : 'Round'} ${roundNumber}`);
  lines.push('');
  
  // Ranking
  lines.push(`📊 *${isEs ? 'Ranking Actual' : 'Current Ranking'}*`);
  lines.push('');
  
  rankings.slice(0, 10).forEach(r => {
    const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `${r.rank}.`;
    lines.push(`${medal} ${r.name} — ${r.points} pts`);
  });
  
  if (rankings.length > 10) {
    lines.push(`... ${isEs ? 'y' : 'and'} ${rankings.length - 10} ${isEs ? 'más' : 'more'}`);
  }
  
  lines.push('');
  
  // Next round
  if (nextRoundGroups.length > 0) {
    lines.push(`📋 *${isEs ? 'Próxima Jornada' : 'Next Round'}*`);
    lines.push('');
    
    let currentSlot = '';
    nextRoundGroups.forEach(g => {
      if (g.timeSlot !== currentSlot) {
        currentSlot = g.timeSlot;
        lines.push(`⏰ ${g.timeSlot}`);
      }
      lines.push(`  ${isEs ? 'Cancha' : 'Court'} ${g.courtNumber}: ${g.players.join(', ')}`);
    });
    
    lines.push('');
  }
  
  // CTA
  lines.push(`✅ ${isEs ? 'Por favor confirmen su asistencia y envíen suplente si no pueden asistir.' : 'Please confirm your attendance and send a substitute if you can\'t make it.'}`);
  
  return lines.join('\n');
}

/**
 * Validate a score value
 */
export function isValidScore(score: number | null | undefined): boolean {
  if (score === null || score === undefined) return false;
  return Number.isInteger(score) && score >= 0 && score <= 7;
}
