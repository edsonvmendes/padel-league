-- ============================================================
-- PADEL LEAGUE — Schema Consolidado v3.0
-- Fase 1: unifica 001 + 002 + 003, corrige tipos e conflitos
--
-- MUDANÇAS vs versões anteriores:
--   - payment: BOOLEAN → payment_method ENUM ('cash','transfer','card')
--   - physical_court_number: removido de NOT NULL (nullable, opcional)
--   - physical_courts_count: adicionado em leagues (era migration 003)
--   - round_date: DATE → obrigatório (NOT NULL)
--   - profiles: adicionado is_admin BOOLEAN (usado no front)
--   - round_court_groups: UNIQUE(round_id, time_slot_id, court_id)
--   - round_court_players: UNIQUE(group_id, player_id) + UNIQUE(group_id, position)
--   - matches: UNIQUE(group_id, match_number)
--   - rules: scope via CHECK (em vez de ENUM separado)
--   - Todos os GRANTs explícitos para authenticated/anon
-- ============================================================

-- ============================================================
-- EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE payment_method    AS ENUM ('cash', 'transfer', 'card');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE round_status      AS ENUM ('draft', 'running', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'substitute');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 1. PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  user_id        UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      TEXT        NOT NULL DEFAULT '',
  role           TEXT        NOT NULL DEFAULT 'coach' CHECK (role IN ('admin', 'coach')),
  is_admin       BOOLEAN     NOT NULL DEFAULT FALSE,
  onboarding_ack BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"   ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own"   ON profiles;
DROP POLICY IF EXISTS "profiles_admin_select" ON profiles;

CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_admin_select"
  ON profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.is_admin = TRUE
  ));

-- Trigger: auto-cria profile no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'coach')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. LEAGUES
-- ============================================================
CREATE TABLE IF NOT EXISTS leagues (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  weekday               TEXT        NOT NULL DEFAULT 'Thursday',
  rounds_count          INT         NOT NULL DEFAULT 6,
  max_courts_per_slot   INT         NOT NULL DEFAULT 4,
  physical_courts_count INT         NOT NULL DEFAULT 6,  -- quantas quadras físicas tem o clube
  is_finished           BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leagues_all_owner" ON leagues;
DROP POLICY IF EXISTS "leagues_select_all" ON leagues;

CREATE POLICY "leagues_select_all"
  ON leagues FOR SELECT USING (TRUE);

CREATE POLICY "leagues_all_owner"
  ON leagues FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE INDEX IF NOT EXISTS idx_leagues_owner ON leagues(owner_user_id);

-- ============================================================
-- 3. LEAGUE TIME SLOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS league_time_slots (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id  UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  slot_time  TEXT NOT NULL,
  sort_order INT  NOT NULL DEFAULT 0,
  UNIQUE(league_id, slot_time)
);

ALTER TABLE league_time_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slots_select_all"  ON league_time_slots;
DROP POLICY IF EXISTS "slots_all_owner"   ON league_time_slots;

CREATE POLICY "slots_select_all"
  ON league_time_slots FOR SELECT USING (TRUE);

CREATE POLICY "slots_all_owner"
  ON league_time_slots FOR ALL
  USING (EXISTS (
    SELECT 1 FROM leagues l WHERE l.id = league_id AND l.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM leagues l WHERE l.id = league_id AND l.owner_user_id = auth.uid()
  ));

-- ============================================================
-- 4. PLAYERS
-- ============================================================
CREATE TABLE IF NOT EXISTS players (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     UUID           NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  owner_user_id UUID           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT           NOT NULL,
  birthdate     DATE,
  payment       payment_method NOT NULL DEFAULT 'cash',  -- era BOOLEAN, agora ENUM correto
  is_active     BOOLEAN        NOT NULL DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT now()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "players_select_all" ON players;
DROP POLICY IF EXISTS "players_all_owner"  ON players;

CREATE POLICY "players_select_all"
  ON players FOR SELECT USING (TRUE);

CREATE POLICY "players_all_owner"
  ON players FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE INDEX IF NOT EXISTS idx_players_league_active ON players(league_id, is_active);

-- ============================================================
-- 5. ROUNDS
-- ============================================================
CREATE TABLE IF NOT EXISTS rounds (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id  UUID         NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  number     INT          NOT NULL,
  round_date DATE         NOT NULL,  -- obrigatório (era nullable na v2)
  status     round_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE(league_id, number)
);

ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rounds_select_all" ON rounds;
DROP POLICY IF EXISTS "rounds_all_owner"  ON rounds;

CREATE POLICY "rounds_select_all"
  ON rounds FOR SELECT USING (TRUE);

CREATE POLICY "rounds_all_owner"
  ON rounds FOR ALL
  USING (EXISTS (
    SELECT 1 FROM leagues l WHERE l.id = league_id AND l.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM leagues l WHERE l.id = league_id AND l.owner_user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_rounds_league_number ON rounds(league_id, number);

-- ============================================================
-- 6. COURTS  (quadras de nível / ranking)
-- ============================================================
CREATE TABLE IF NOT EXISTS courts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  court_number INT  NOT NULL,
  UNIQUE(league_id, court_number)
);

ALTER TABLE courts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courts_select_all" ON courts;
DROP POLICY IF EXISTS "courts_all_owner"  ON courts;

CREATE POLICY "courts_select_all"
  ON courts FOR SELECT USING (TRUE);

CREATE POLICY "courts_all_owner"
  ON courts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM leagues l WHERE l.id = league_id AND l.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM leagues l WHERE l.id = league_id AND l.owner_user_id = auth.uid()
  ));

-- ============================================================
-- 7. ROUND COURT GROUPS
--    Relação: uma rodada × um horário × uma quadra de nível
--    physical_court_number: quadra física do clube (nullable — mapeada pelo organizador)
-- ============================================================
CREATE TABLE IF NOT EXISTS round_court_groups (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id              UUID        NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  league_id             UUID        NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  time_slot_id          UUID        NOT NULL REFERENCES league_time_slots(id) ON DELETE CASCADE,
  court_id              UUID        NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  physical_court_number INT,        -- nullable: mapeado opcionalmente pelo organizador
  is_cancelled          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(round_id, time_slot_id, court_id)
);

COMMENT ON COLUMN round_court_groups.physical_court_number IS
  'Quadra física do clube (1-N). court_id representa o nível/ranking. Este campo mapeia onde jogam fisicamente.';

ALTER TABLE round_court_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rcg_select_all" ON round_court_groups;
DROP POLICY IF EXISTS "rcg_all_owner"  ON round_court_groups;

CREATE POLICY "rcg_select_all"
  ON round_court_groups FOR SELECT USING (TRUE);

CREATE POLICY "rcg_all_owner"
  ON round_court_groups FOR ALL
  USING (EXISTS (
    SELECT 1 FROM leagues l WHERE l.id = league_id AND l.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM leagues l WHERE l.id = league_id AND l.owner_user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_rcg_round_slot_court ON round_court_groups(round_id, time_slot_id, court_id);

-- ============================================================
-- 8. ROUND COURT PLAYERS
-- ============================================================
CREATE TABLE IF NOT EXISTS round_court_players (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID              NOT NULL REFERENCES round_court_groups(id) ON DELETE CASCADE,
  player_id       UUID              NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position        INT               NOT NULL CHECK (position BETWEEN 1 AND 4),
  attendance      attendance_status NOT NULL DEFAULT 'present',
  substitute_name TEXT,
  UNIQUE(group_id, player_id),   -- jogadora não pode estar 2x no mesmo grupo
  UNIQUE(group_id, position)     -- posição única por grupo
);

ALTER TABLE round_court_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rcp_select_all" ON round_court_players;
DROP POLICY IF EXISTS "rcp_all_owner"  ON round_court_players;

CREATE POLICY "rcp_select_all"
  ON round_court_players FOR SELECT USING (TRUE);

CREATE POLICY "rcp_all_owner"
  ON round_court_players FOR ALL
  USING (EXISTS (
    SELECT 1 FROM round_court_groups rcg
    JOIN leagues l ON l.id = rcg.league_id
    WHERE rcg.id = group_id AND l.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM round_court_groups rcg
    JOIN leagues l ON l.id = rcg.league_id
    WHERE rcg.id = group_id AND l.owner_user_id = auth.uid()
  ));

-- ============================================================
-- 9. MATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS matches (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID        NOT NULL REFERENCES round_court_groups(id) ON DELETE CASCADE,
  match_number INT         NOT NULL CHECK (match_number BETWEEN 1 AND 3),
  team1_pos1   INT         NOT NULL,
  team1_pos2   INT         NOT NULL,
  team2_pos1   INT         NOT NULL,
  team2_pos2   INT         NOT NULL,
  score_team1  INT         CHECK (score_team1 IS NULL OR (score_team1 >= 0 AND score_team1 <= 7)),
  score_team2  INT         CHECK (score_team2 IS NULL OR (score_team2 >= 0 AND score_team2 <= 7)),
  is_recorded  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, match_number)
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches_select_all" ON matches;
DROP POLICY IF EXISTS "matches_all_owner"  ON matches;

CREATE POLICY "matches_select_all"
  ON matches FOR SELECT USING (TRUE);

CREATE POLICY "matches_all_owner"
  ON matches FOR ALL
  USING (EXISTS (
    SELECT 1 FROM round_court_groups rcg
    JOIN leagues l ON l.id = rcg.league_id
    WHERE rcg.id = group_id AND l.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM round_court_groups rcg
    JOIN leagues l ON l.id = rcg.league_id
    WHERE rcg.id = group_id AND l.owner_user_id = auth.uid()
  ));

-- ============================================================
-- 10. ROUND POINTS
-- ============================================================
CREATE TABLE IF NOT EXISTS round_points (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id   UUID        NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id  UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  points     INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(round_id, player_id)
);

ALTER TABLE round_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rp_select_all" ON round_points;
DROP POLICY IF EXISTS "rp_all_owner"  ON round_points;

CREATE POLICY "rp_select_all"
  ON round_points FOR SELECT USING (TRUE);

CREATE POLICY "rp_all_owner"
  ON round_points FOR ALL
  USING (EXISTS (
    SELECT 1 FROM rounds r
    JOIN leagues l ON l.id = r.league_id
    WHERE r.id = round_id AND l.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM rounds r
    JOIN leagues l ON l.id = r.league_id
    WHERE r.id = round_id AND l.owner_user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_round_points_round ON round_points(round_id);

-- ============================================================
-- 11. LEAGUE RANKINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS league_rankings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID        NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id    UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  total_points INT         NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(league_id, player_id)
);

ALTER TABLE league_rankings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lr_select_all" ON league_rankings;
DROP POLICY IF EXISTS "lr_all_owner"  ON league_rankings;

CREATE POLICY "lr_select_all"
  ON league_rankings FOR SELECT USING (TRUE);

CREATE POLICY "lr_all_owner"
  ON league_rankings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM leagues l WHERE l.id = league_id AND l.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM leagues l WHERE l.id = league_id AND l.owner_user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_lr_league_points ON league_rankings(league_id, total_points DESC);

-- ============================================================
-- 12. RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS rules (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scope                     TEXT        NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'league')),
  league_id                 UUID        REFERENCES leagues(id) ON DELETE CASCADE,
  -- Pontuação de ausência
  absence_penalty           INT         NOT NULL DEFAULT -5,
  use_min_actual_when_absent BOOLEAN    NOT NULL DEFAULT TRUE,
  three_absences_bonus      INT         NOT NULL DEFAULT 9,
  -- Promoção / rebaixamento
  promotion_count           INT         NOT NULL DEFAULT 1,
  relegation_count          INT         NOT NULL DEFAULT 1,
  -- Outros
  allow_merge_courts        BOOLEAN     NOT NULL DEFAULT TRUE,
  whatsapp_template         TEXT        DEFAULT '',
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rules_select_all"    ON rules;
DROP POLICY IF EXISTS "rules_admin_all"     ON rules;
DROP POLICY IF EXISTS "rules_owner_league"  ON rules;

CREATE POLICY "rules_select_all"
  ON rules FOR SELECT USING (TRUE);

-- Admin gerencia regras globais
CREATE POLICY "rules_admin_all"
  ON rules FOR ALL
  USING (
    scope = 'global' AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.is_admin = TRUE)
  )
  WITH CHECK (
    scope = 'global' AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.is_admin = TRUE)
  );

-- Dono da liga gerencia regras da liga
CREATE POLICY "rules_owner_league"
  ON rules FOR ALL
  USING (
    scope = 'league' AND
    EXISTS (SELECT 1 FROM leagues l WHERE l.id = league_id AND l.owner_user_id = auth.uid())
  )
  WITH CHECK (
    scope = 'league' AND
    EXISTS (SELECT 1 FROM leagues l WHERE l.id = league_id AND l.owner_user_id = auth.uid())
  );

-- ============================================================
-- DADOS INICIAIS
-- ============================================================
INSERT INTO rules (scope, league_id)
VALUES ('global', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- GRANTS
-- ============================================================
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL   ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
