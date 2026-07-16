-- 0002_revoke_rls_auto_enable_exec.sql — security hardening.
--
-- The "Enable automatic RLS" project option creates a SECURITY DEFINER function
-- public.rls_auto_enable() and an event trigger that auto-enables RLS on new
-- tables. Because Data API exposure is on, that function was also callable via
-- /rest/v1/rpc/rls_auto_enable by the anon + authenticated roles (flagged by the
-- security advisor: lints 0028/0029). It only needs to run as an event trigger —
-- not via the REST RPC — so revoke public EXECUTE. The event trigger is
-- unaffected (triggers don't require role EXECUTE grants).

-- ── up ────────────────────────────────────────────────────────────────────
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;

-- ── down (documented inverse — re-opens the advisor warning; not recommended)
-- grant execute on function public.rls_auto_enable() to anon, authenticated;
