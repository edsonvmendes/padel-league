// ============================================================
// PADEL LEAGUE — TypeScript Types v2.0
// Fase 2: alinhado com Schema Consolidado v3.0
// ============================================================

// ============================================================
// ENUMS
// ============================================================
export type PaymentMethod = 'cash' | 'transfer' | 'card';
export type RoundStatus = 'draft' | 'running' | 'closed';
export type AttendanceStatus = 'present' | 'absent' | 'substitute';
export type RulesScope = 'global' | 'league';
export type Weekday = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type Locale = 'en' | 'es' | 'pt';

// ============================================================
// TABELAS
// ============================================================

export interface Profile {
  user_id: string;
  full_name: string;
  role: 'admin' | 'coach';
  is_admin: boolean;
  onboarding_ack: boolean;
  created_at: string;
}

export interface League {
  id: string;
  owner_user_id: string;
  name: string;
  weekday: Weekday;
  rounds_count: number;
  max_courts_per_slot: number;
  physical_courts_count: number;
  is_finished: boolean;
  created_at: string;
}

export interface LeagueTimeSlot {
  id: string;
  league_id: string;
  slot_time: string;          // ex: "09:00", "10:30"
  sort_order: number;
}

export interface Player {
  id: string;
  league_id: string;
  owner_user_id: string;
  full_name: string;
  birthdate: string | null;   // ISO date
  payment: PaymentMethod;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface Round {
  id: string;
  league_id: string;
  number: number;
  round_date: string;         // ISO date, NOT NULL
  status: RoundStatus;
  created_at: string;
}

export interface Court {
  id: string;
  league_id: string;
  court_number: number;
}

export interface RoundCourtGroup {
  id: string;
  round_id: string;
  league_id: string;
  time_slot_id: string;
  court_id: string;
  physical_court_number: number | null;   // nullable — mapeado pelo organizador
  is_cancelled: boolean;
  created_at: string;
}

export interface RoundCourtPlayer {
  id: string;
  group_id: string;
  player_id: string;
  position: 1 | 2 | 3 | 4;
  attendance: AttendanceStatus;
  substitute_name: string | null;
}

export interface Match {
  id: string;
  group_id: string;
  match_number: 1 | 2 | 3;
  team1_pos1: number;
  team1_pos2: number;
  team2_pos1: number;
  team2_pos2: number;
  score_team1: number | null;   // 0-7
  score_team2: number | null;   // 0-7
  is_recorded: boolean;
  created_at: string;
}

export interface RoundPoints {
  id: string;
  round_id: string;
  player_id: string;
  points: number;
  created_at: string;
}

export interface LeagueRanking {
  id: string;
  league_id: string;
  player_id: string;
  total_points: number;
  updated_at: string;
}

export interface Rules {
  id: string;
  scope: RulesScope;
  league_id: string | null;
  absence_penalty: number;              // default -5
  use_min_actual_when_absent: boolean;
  three_absences_bonus: number;         // default 9
  promotion_count: number;
  relegation_count: number;
  allow_merge_courts: boolean;
  whatsapp_template: string | null;
  updated_at: string;
}

// ============================================================
// TIPOS COMPOSTOS (joins frequentes)
// ============================================================

/** Player com nome do grupo em que está na rodada */
export interface RoundCourtPlayerWithPlayer extends RoundCourtPlayer {
  player: Player;
}

/** Grupo completo com jogadoras e partidas */
export interface RoundCourtGroupFull extends RoundCourtGroup {
  time_slot: LeagueTimeSlot;
  court: Court;
  players: RoundCourtPlayerWithPlayer[];
  matches: Match[];
}

/** Rodada com todos os grupos */
export interface RoundFull extends Round {
  groups: RoundCourtGroupFull[];
}

/** Ranking com dados do jogador */
export interface LeagueRankingWithPlayer extends LeagueRanking {
  player: Player;
}

// ============================================================
// TIPOS DE INPUT (formulários / inserts)
// ============================================================

export type LeagueInsert = Omit<League, 'id' | 'created_at'>;
export type LeagueUpdate = Partial<Omit<League, 'id' | 'owner_user_id' | 'created_at'>>;

export type PlayerInsert = Omit<Player, 'id' | 'created_at'>;
export type PlayerUpdate = Partial<Omit<Player, 'id' | 'league_id' | 'owner_user_id' | 'created_at'>>;

export type RoundInsert = Omit<Round, 'id' | 'created_at'>;
export type RoundUpdate = Partial<Pick<Round, 'round_date' | 'status'>>;

export type RoundCourtGroupInsert = Omit<RoundCourtGroup, 'id' | 'created_at'>;
export type RoundCourtPlayerInsert = Omit<RoundCourtPlayer, 'id'>;

export type MatchInsert = Omit<Match, 'id' | 'created_at'>;
export type MatchScoreUpdate = Pick<Match, 'score_team1' | 'score_team2' | 'is_recorded'>;

export type ProfileUpdate = Partial<Pick<Profile, 'full_name' | 'role' | 'is_admin' | 'onboarding_ack'>>;
