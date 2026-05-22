-- Security hardening verification queries.
-- Run after applying migrations 013 and 014.

-- 1) RLS should be enabled on application tables.
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'leagues',
    'league_time_slots',
    'players',
    'league_players',
    'rounds',
    'courts',
    'round_court_groups',
    'round_court_players',
    'matches',
    'round_points',
    'league_rankings',
    'rules',
    'round_confirmations',
    'operational_audit_log'
  )
ORDER BY tablename;

-- 2) Anonymous role should not have direct table/view access.
SELECT
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee = 'anon'
ORDER BY table_name, privilege_type;

-- 3) Anonymous role should execute only public RPCs.
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_public_league_info',
    'public_register_player',
    'get_public_round_confirmation',
    'submit_public_round_confirmation',
    'ensure_round_confirmation_link',
    'close_round'
  )
ORDER BY p.proname;

-- 4) No broad SELECT USING (true) policies should remain active for private tables.
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND qual ILIKE '%true%'
ORDER BY tablename, policyname;
