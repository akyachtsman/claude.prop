-- 0003_revoke_properties_truncate.sql — security hardening.
--
-- Supabase's default grants gave the anon and authenticated roles TRUNCATE on
-- public.properties. TRUNCATE ignores row-level security, so a role holding it
-- could empty every user's rows at once. PostgREST exposes no TRUNCATE and no
-- function these roles can call runs one, so it was not reachable, but neither
-- role ever needs it: the app deletes its own rows through the "delete own" policy.
-- Found by the Secret Columns audit (data.md), 2026-10-27.

-- ── up ────────────────────────────────────────────────────────────────────
revoke truncate on public.properties from anon, authenticated;

-- ── down (documented inverse — re-opens the RLS bypass; not recommended)
-- grant truncate on public.properties to anon, authenticated;
