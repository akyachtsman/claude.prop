-- 0004_revoke_default_table_privileges.sql — security hardening.
--
-- Finishes what 0003 started. Supabase's default privileges give anon and
-- authenticated every privilege on each table in public, including TRUNCATE,
-- REFERENCES, TRIGGER and (Postgres 17) MAINTAIN. The app uses none of them: the
-- browser only selects, inserts, updates and deletes its own rows under RLS.
-- 0003 revoked TRUNCATE on properties alone; this revokes all four on every
-- existing table and in the postgres role's default privileges, so a table added
-- later starts without them. Data API grants (select/insert/update/delete) are
-- untouched. Found by data.md -> Supabase Defaults, 2026-10-29.
--
-- Contains TRUNCATE, so from a project thread it runs through the SQL Editor
-- (data.md -> MCP Configuration), not the connector.

-- ── up ────────────────────────────────────────────────────────────────────
revoke truncate, references, trigger, maintain
  on all tables in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from anon, authenticated;

-- ── down (documented inverse — re-opens the RLS bypass; not recommended)
-- grant truncate, references, trigger, maintain
--   on all tables in schema public to anon, authenticated;
-- alter default privileges for role postgres in schema public
--   grant truncate, references, trigger, maintain on tables to anon, authenticated;
