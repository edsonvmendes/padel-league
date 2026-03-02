-- Fix infinite recursion in profiles RLS.
-- The old "profiles_admin_select" policy queried "profiles" from inside a
-- policy on "profiles", which causes recursive policy evaluation.

DROP POLICY IF EXISTS "profiles_admin_select" ON profiles;

