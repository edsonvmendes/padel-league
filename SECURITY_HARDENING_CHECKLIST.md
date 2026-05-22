# Security Hardening Checklist

## Supabase

- Apply `supabase/sql/apply-014-harden-anon-access-and-function-grants.sql`.
- Run `supabase/sql/verify-security-hardening.sql` and confirm:
  - every listed table has `rowsecurity = true`;
  - `anon` has no direct table/view grants;
  - `anon` can execute only the public registration/confirmation RPCs;
  - no private table keeps broad `USING (true)` policies.
- Review Auth settings:
  - production Site URL and Redirect URLs only;
  - native Auth rate limits enabled/reasonable;
  - MFA enabled for admin accounts;
  - email confirmation policy intentional.
- Review database operations:
  - SSL enforcement enabled;
  - backups configured;
  - Realtime publications do not include private tables unless required.

## Vercel

- Confirm environment variables are separated for Production, Preview, and Development.
- Mark private env vars as Sensitive where the plan supports it.
- Protect Preview deployments when they can reach production-like data.
- Keep production deployment restricted to the intended branch.
- Consider Vercel Firewall/WAF rules for abuse patterns.
- Confirm security headers are present in production responses.

## GitHub

- Enable branch protection or repository ruleset on `main`.
- Require passing checks before merge.
- Enable Dependabot alerts and security updates.
- Enable secret scanning and push protection.
- Add `SECURITY.md` before onboarding external users.
- Consider CODEOWNERS for:
  - `supabase/migrations/`
  - `src/app/auth/`
  - `src/proxy.ts`
  - `next.config.js`
  - `vercel.json`

## Manual Smoke Tests

- Anonymous user cannot open `/app`.
- Logged-in user can open `/app`.
- Logged-in user is redirected away from `/login`.
- Public join page still loads with a valid league id.
- Public confirmation page still loads with a valid token.
- Login returns `429` after repeated invalid attempts.
- Closing a round with incomplete groups/scores is blocked.
