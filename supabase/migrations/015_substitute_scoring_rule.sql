-- Substitute scoring rule: substitutes do not score; the original player receives the absence rule.
-- If use_min_actual_when_absent is enabled and the court minimum is worse than the penalty,
-- the absent/substituted player receives the lower court score.

UPDATE public.rules
SET use_min_actual_when_absent = TRUE,
    updated_at = now()
WHERE scope = 'league';
CREATE OR REPLACE FUNCTION public.close_round(p_round_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $close_round$
DECLARE
  v_round rounds%ROWTYPE;
  v_rules rules%ROWTYPE;
  v_group round_court_groups%ROWTYPE;
  v_player round_court_players%ROWTYPE;
  v_group_player_count INT;
  v_absent_count INT;
  v_points INT;
  v_min_present INT;
BEGIN
  SELECT r.*
  INTO v_round
  FROM rounds r
  JOIN leagues l ON l.id = r.league_id
  WHERE r.id = p_round_id
    AND l.owner_user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found or access denied';
  END IF;

  IF v_round.status = 'closed' THEN
    RAISE EXCEPTION 'Round is already closed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM round_court_groups
    WHERE round_id = p_round_id AND is_cancelled = FALSE
  ) THEN
    RAISE EXCEPTION 'Cannot close round without active groups';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM round_court_groups g
    LEFT JOIN round_court_players rcp ON rcp.group_id = g.id
    WHERE g.round_id = p_round_id
      AND g.is_cancelled = FALSE
    GROUP BY g.id
    HAVING COUNT(rcp.id) <> 4
  ) THEN
    RAISE EXCEPTION 'Cannot close round with incomplete groups';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM round_court_groups g
    LEFT JOIN matches m ON m.group_id = g.id
    WHERE g.round_id = p_round_id
      AND g.is_cancelled = FALSE
    GROUP BY g.id
    HAVING COUNT(m.id) <> 3
      OR COUNT(*) FILTER (WHERE m.score_team1 IS NULL OR m.score_team2 IS NULL OR m.is_recorded IS DISTINCT FROM TRUE) > 0
  ) THEN
    RAISE EXCEPTION 'Cannot close round with pending scores';
  END IF;

  SELECT *
  INTO v_rules
  FROM rules
  WHERE scope = 'global' OR league_id = v_round.league_id
  ORDER BY CASE WHEN league_id = v_round.league_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rules not found for round %', p_round_id;
  END IF;

  DELETE FROM round_points
  WHERE round_id = p_round_id;

  FOR v_group IN
    SELECT *
    FROM round_court_groups
    WHERE round_id = p_round_id
      AND is_cancelled = FALSE
  LOOP
    SELECT COUNT(*)
    INTO v_group_player_count
    FROM round_court_players
    WHERE group_id = v_group.id;

    IF v_group_player_count < 2 THEN
      CONTINUE;
    END IF;

    SELECT COUNT(*)
    INTO v_absent_count
    FROM round_court_players
    WHERE group_id = v_group.id
      AND attendance IN ('absent', 'substitute');

    v_min_present := NULL;

    FOR v_player IN
      SELECT *
      FROM round_court_players
      WHERE group_id = v_group.id
        AND attendance = 'present'
    LOOP
      IF v_absent_count >= 3 THEN
        v_points := v_rules.three_absences_bonus;
      ELSE
        SELECT COALESCE(SUM(
          CASE
            WHEN m.team1_pos1 = v_player.position OR m.team1_pos2 = v_player.position THEN
              CASE
                WHEN COALESCE(m.score_team1, 0) > COALESCE(m.score_team2, 0) THEN ABS(COALESCE(m.score_team1, 0) - COALESCE(m.score_team2, 0))
                WHEN COALESCE(m.score_team1, 0) < COALESCE(m.score_team2, 0) THEN -ABS(COALESCE(m.score_team1, 0) - COALESCE(m.score_team2, 0))
                ELSE 0
              END
            WHEN m.team2_pos1 = v_player.position OR m.team2_pos2 = v_player.position THEN
              CASE
                WHEN COALESCE(m.score_team2, 0) > COALESCE(m.score_team1, 0) THEN ABS(COALESCE(m.score_team2, 0) - COALESCE(m.score_team1, 0))
                WHEN COALESCE(m.score_team2, 0) < COALESCE(m.score_team1, 0) THEN -ABS(COALESCE(m.score_team2, 0) - COALESCE(m.score_team1, 0))
                ELSE 0
              END
            ELSE 0
          END
        ), 0)
        INTO v_points
        FROM matches m
        WHERE m.group_id = v_group.id
          AND m.is_recorded = TRUE;
      END IF;

      INSERT INTO round_points (round_id, player_id, points)
      VALUES (p_round_id, v_player.player_id, v_points)
      ON CONFLICT (round_id, player_id) DO UPDATE
      SET points = EXCLUDED.points;

      IF v_min_present IS NULL OR v_points < v_min_present THEN
        v_min_present := v_points;
      END IF;
    END LOOP;

    FOR v_player IN
      SELECT *
      FROM round_court_players
      WHERE group_id = v_group.id
        AND attendance IN ('absent', 'substitute')
    LOOP
      v_points := v_rules.absence_penalty;

      IF v_absent_count < 3
         AND v_rules.use_min_actual_when_absent
         AND v_min_present IS NOT NULL
         AND v_min_present < v_points THEN
        v_points := v_min_present;
      END IF;

      INSERT INTO round_points (round_id, player_id, points)
      VALUES (p_round_id, v_player.player_id, v_points)
      ON CONFLICT (round_id, player_id) DO UPDATE
      SET points = EXCLUDED.points;
    END LOOP;
  END LOOP;

  DELETE FROM league_rankings
  WHERE league_id = v_round.league_id;

  INSERT INTO league_rankings (league_id, player_id, total_points, updated_at)
  SELECT
    v_round.league_id,
    rp.player_id,
    SUM(rp.points),
    NOW()
  FROM round_points rp
  JOIN rounds r ON r.id = rp.round_id
  WHERE r.league_id = v_round.league_id
    AND (r.status = 'closed' OR r.id = p_round_id)
  GROUP BY rp.player_id;

  UPDATE rounds
  SET status = 'closed'
  WHERE id = p_round_id;

  INSERT INTO operational_audit_log (user_id, league_id, round_id, action, details)
  VALUES (auth.uid(), v_round.league_id, p_round_id, 'round.closed.rpc', '{}'::jsonb);
END;
$close_round$;

GRANT EXECUTE ON FUNCTION public.close_round(UUID) TO authenticated;
