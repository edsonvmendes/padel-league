-- Public player self-registration flow.
-- First version: access is based on league id in the link.

CREATE OR REPLACE FUNCTION public.get_public_league_info(p_league_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  weekday TEXT,
  is_finished BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.name, l.weekday, l.is_finished
  FROM leagues l
  WHERE l.id = p_league_id;
$$;

CREATE OR REPLACE FUNCTION public.public_register_player(
  p_league_id UUID,
  p_full_name TEXT,
  p_birthdate DATE DEFAULT NULL,
  p_payment payment_method DEFAULT 'cash',
  p_phone TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_user_id UUID;
  v_is_finished BOOLEAN;
  v_player_id UUID;
  v_clean_name TEXT;
  v_clean_phone TEXT;
  v_clean_notes TEXT;
  v_combined_notes TEXT;
BEGIN
  v_clean_name := trim(coalesce(p_full_name, ''));
  v_clean_phone := trim(coalesce(p_phone, ''));
  v_clean_notes := trim(coalesce(p_notes, ''));

  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'Player name is required';
  END IF;

  SELECT owner_user_id, is_finished
  INTO v_owner_user_id, v_is_finished
  FROM leagues
  WHERE id = p_league_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'League not found';
  END IF;

  IF v_is_finished THEN
    RAISE EXCEPTION 'League is closed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM players
    WHERE league_id = p_league_id
      AND lower(trim(full_name)) = lower(v_clean_name)
  ) THEN
    RAISE EXCEPTION 'Player already exists in this league';
  END IF;

  IF v_clean_phone <> '' AND v_clean_notes <> '' THEN
    v_combined_notes := format('phone:%s', v_clean_phone) || E'\n' || v_clean_notes;
  ELSIF v_clean_phone <> '' THEN
    v_combined_notes := format('phone:%s', v_clean_phone);
  ELSIF v_clean_notes <> '' THEN
    v_combined_notes := v_clean_notes;
  ELSE
    v_combined_notes := NULL;
  END IF;

  INSERT INTO players (
    league_id,
    owner_user_id,
    full_name,
    birthdate,
    payment,
    notes,
    is_active
  )
  VALUES (
    p_league_id,
    v_owner_user_id,
    v_clean_name,
    p_birthdate,
    p_payment,
    v_combined_notes,
    TRUE
  )
  RETURNING id INTO v_player_id;

  RETURN v_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_league_info(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_register_player(UUID, TEXT, DATE, payment_method, TEXT, TEXT) TO anon, authenticated;
