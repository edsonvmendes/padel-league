-- Harden RLS policies to avoid cross-tenant reads and remove fragile patterns.

-- ============================================================
-- PROFILES
-- ============================================================
DROP POLICY IF EXISTS "profiles_admin_select" ON profiles;

-- ============================================================
-- LEAGUES
-- ============================================================
DROP POLICY IF EXISTS "leagues_select_all" ON leagues;

CREATE POLICY "leagues_select_owner"
  ON leagues FOR SELECT
  USING (auth.uid() = owner_user_id);

-- ============================================================
-- LEAGUE TIME SLOTS
-- ============================================================
DROP POLICY IF EXISTS "slots_select_all" ON league_time_slots;

CREATE POLICY "slots_select_owner"
  ON league_time_slots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM leagues l
    WHERE l.id = league_id AND l.owner_user_id = auth.uid()
  ));

-- ============================================================
-- PLAYERS
-- ============================================================
DROP POLICY IF EXISTS "players_select_all" ON players;

CREATE POLICY "players_select_owner"
  ON players FOR SELECT
  USING (auth.uid() = owner_user_id);

-- ============================================================
-- ROUNDS
-- ============================================================
DROP POLICY IF EXISTS "rounds_select_all" ON rounds;

CREATE POLICY "rounds_select_owner"
  ON rounds FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM leagues l
    WHERE l.id = league_id AND l.owner_user_id = auth.uid()
  ));

-- ============================================================
-- COURTS
-- ============================================================
DROP POLICY IF EXISTS "courts_select_all" ON courts;

CREATE POLICY "courts_select_owner"
  ON courts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM leagues l
    WHERE l.id = league_id AND l.owner_user_id = auth.uid()
  ));

-- ============================================================
-- ROUND COURT GROUPS
-- ============================================================
DROP POLICY IF EXISTS "rcg_select_all" ON round_court_groups;

CREATE POLICY "rcg_select_owner"
  ON round_court_groups FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM leagues l
    WHERE l.id = league_id AND l.owner_user_id = auth.uid()
  ));

-- ============================================================
-- ROUND COURT PLAYERS
-- ============================================================
DROP POLICY IF EXISTS "rcp_select_all" ON round_court_players;

CREATE POLICY "rcp_select_owner"
  ON round_court_players FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM round_court_groups rcg
    JOIN leagues l ON l.id = rcg.league_id
    WHERE rcg.id = group_id AND l.owner_user_id = auth.uid()
  ));

-- ============================================================
-- MATCHES
-- ============================================================
DROP POLICY IF EXISTS "matches_select_all" ON matches;

CREATE POLICY "matches_select_owner"
  ON matches FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM round_court_groups rcg
    JOIN leagues l ON l.id = rcg.league_id
    WHERE rcg.id = group_id AND l.owner_user_id = auth.uid()
  ));

-- ============================================================
-- ROUND POINTS
-- ============================================================
DROP POLICY IF EXISTS "rp_select_all" ON round_points;

CREATE POLICY "rp_select_owner"
  ON round_points FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM rounds r
    JOIN leagues l ON l.id = r.league_id
    WHERE r.id = round_id AND l.owner_user_id = auth.uid()
  ));

-- ============================================================
-- LEAGUE RANKINGS
-- ============================================================
DROP POLICY IF EXISTS "lr_select_all" ON league_rankings;

CREATE POLICY "lr_select_owner"
  ON league_rankings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM leagues l
    WHERE l.id = league_id AND l.owner_user_id = auth.uid()
  ));

-- ============================================================
-- RULES
-- ============================================================
DROP POLICY IF EXISTS "rules_select_all" ON rules;

CREATE POLICY "rules_select_global_authenticated"
  ON rules FOR SELECT
  USING (
    scope = 'global' AND auth.role() = 'authenticated'
  );

