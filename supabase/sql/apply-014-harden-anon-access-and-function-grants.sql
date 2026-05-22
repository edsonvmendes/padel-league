-- Harden anonymous access.
--
-- Public pages must keep working through SECURITY DEFINER RPCs only:
-- - get_public_league_info
-- - public_register_player
-- - get_public_round_confirmation
-- - submit_public_round_confirmation
--
-- Anonymous users should not have direct table or view access.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

REVOKE ALL ON public.league_roster FROM PUBLIC;
REVOKE ALL ON public.league_roster FROM anon;
GRANT SELECT ON public.league_roster TO authenticated;
GRANT SELECT ON public.league_roster TO service_role;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

GRANT EXECUTE ON FUNCTION public.get_public_league_info(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_register_player(UUID, TEXT, DATE, payment_method, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_round_confirmation(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_round_confirmation(UUID, TEXT, TEXT) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ensure_round_confirmation_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_round(UUID) TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
