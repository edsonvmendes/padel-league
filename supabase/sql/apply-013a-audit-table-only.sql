-- Operational audit trail and database-level guards for closing rounds.

CREATE TABLE IF NOT EXISTS public.operational_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  league_id UUID REFERENCES public.leagues(id) ON DELETE SET NULL,
  round_id UUID REFERENCES public.rounds(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.operational_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_owner" ON public.operational_audit_log;
DROP POLICY IF EXISTS "audit_insert_authenticated" ON public.operational_audit_log;

CREATE POLICY "audit_select_owner"
  ON public.operational_audit_log FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.leagues l
      WHERE l.id = operational_audit_log.league_id
        AND l.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "audit_insert_authenticated"
  ON public.operational_audit_log FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND COALESCE(user_id, auth.uid()) = auth.uid());

CREATE INDEX IF NOT EXISTS idx_operational_audit_league_created
  ON public.operational_audit_log(league_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_audit_round_created
  ON public.operational_audit_log(round_id, created_at DESC);

GRANT SELECT, INSERT ON public.operational_audit_log TO authenticated;
