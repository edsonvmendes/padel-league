-- Phase 2: attendance confirmation by individual link.

CREATE TABLE IF NOT EXISTS round_confirmations (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id             UUID        NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  group_id             UUID        NOT NULL REFERENCES round_court_groups(id) ON DELETE CASCADE,
  round_court_player_id UUID       NOT NULL UNIQUE REFERENCES round_court_players(id) ON DELETE CASCADE,
  player_id            UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token                UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status               TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'present', 'absent')),
  substitute_name      TEXT,
  responded_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE round_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "round_confirmations_select_owner" ON round_confirmations;
DROP POLICY IF EXISTS "round_confirmations_all_owner" ON round_confirmations;

CREATE POLICY "round_confirmations_select_owner"
  ON round_confirmations FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM rounds r
    JOIN leagues l ON l.id = r.league_id
    WHERE r.id = round_id
      AND l.owner_user_id = auth.uid()
  ));

CREATE POLICY "round_confirmations_all_owner"
  ON round_confirmations FOR ALL
  USING (EXISTS (
    SELECT 1
    FROM rounds r
    JOIN leagues l ON l.id = r.league_id
    WHERE r.id = round_id
      AND l.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM rounds r
    JOIN leagues l ON l.id = r.league_id
    WHERE r.id = round_id
      AND l.owner_user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_round_confirmations_round ON round_confirmations(round_id);
CREATE INDEX IF NOT EXISTS idx_round_confirmations_player ON round_confirmations(player_id);

CREATE OR REPLACE FUNCTION public.ensure_round_confirmation_link(p_round_court_player_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token UUID;
  v_round_id UUID;
  v_group_id UUID;
  v_player_id UUID;
BEGIN
  SELECT rc.token
  INTO v_token
  FROM round_confirmations rc
  WHERE rc.round_court_player_id = p_round_court_player_id;

  IF FOUND THEN
    RETURN v_token;
  END IF;

  SELECT rcg.round_id, rcp.group_id, rcp.player_id
  INTO v_round_id, v_group_id, v_player_id
  FROM round_court_players rcp
  JOIN round_court_groups rcg ON rcg.id = rcp.group_id
  JOIN leagues l ON l.id = rcg.league_id
  WHERE rcp.id = p_round_court_player_id
    AND l.owner_user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round player not found or access denied';
  END IF;

  INSERT INTO round_confirmations (
    round_id,
    group_id,
    round_court_player_id,
    player_id
  )
  VALUES (
    v_round_id,
    v_group_id,
    p_round_court_player_id,
    v_player_id
  )
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_round_confirmation(p_token UUID)
RETURNS TABLE (
  token UUID,
  round_id UUID,
  league_name TEXT,
  round_number INT,
  round_date DATE,
  player_name TEXT,
  slot_time TEXT,
  court_number INT,
  status TEXT,
  substitute_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rc.token,
    rc.round_id,
    l.name,
    r.number,
    r.round_date,
    p.full_name,
    lts.slot_time,
    c.court_number,
    rc.status,
    rc.substitute_name
  FROM round_confirmations rc
  JOIN rounds r ON r.id = rc.round_id
  JOIN leagues l ON l.id = r.league_id
  JOIN round_court_groups rcg ON rcg.id = rc.group_id
  JOIN league_time_slots lts ON lts.id = rcg.time_slot_id
  JOIN courts c ON c.id = rcg.court_id
  JOIN players p ON p.id = rc.player_id
  WHERE rc.token = p_token;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_round_confirmation(
  p_token UUID,
  p_status TEXT,
  p_substitute_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round_court_player_id UUID;
  v_clean_substitute TEXT;
BEGIN
  IF p_status NOT IN ('present', 'absent') THEN
    RAISE EXCEPTION 'Invalid confirmation status';
  END IF;

  v_clean_substitute := trim(coalesce(p_substitute_name, ''));

  SELECT round_court_player_id
  INTO v_round_court_player_id
  FROM round_confirmations
  WHERE token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Confirmation link not found';
  END IF;

  UPDATE round_confirmations
  SET
    status = p_status,
    substitute_name = CASE WHEN p_status = 'absent' AND v_clean_substitute <> '' THEN v_clean_substitute ELSE NULL END,
    responded_at = now()
  WHERE token = p_token;

  UPDATE round_court_players
  SET
    attendance = CASE WHEN p_status = 'present' THEN 'present'::attendance_status ELSE 'absent'::attendance_status END,
    substitute_name = CASE WHEN p_status = 'absent' AND v_clean_substitute <> '' THEN v_clean_substitute ELSE NULL END
  WHERE id = v_round_court_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_round_confirmation_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_round_confirmation(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_round_confirmation(UUID, TEXT, TEXT) TO anon, authenticated;
