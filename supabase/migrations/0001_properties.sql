-- 0001_properties.sql — per-user property storage for Property Analytics.
-- Feature: specs/supabase-storage/. Applied via Supabase MCP apply_migration.
--
-- One row per saved property; `data` is the same inputs-only object the app
-- already exports. Ids are the app's own (e.g. 'sample-715-plumas', 'p-...'),
-- unique PER USER — samples are seeded per account — so the primary key is the
-- composite (user_id, id). RLS is ON with per-user policies; the anon/publishable
-- key is safe in the browser because these policies enforce access.
--
-- Reversibility (data.md): the documented inverse is at the bottom. Prefer
-- deprecation over destruction in a populated production DB.

-- ── up ────────────────────────────────────────────────────────────────────
create table if not exists public.properties (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  name       text,
  data       jsonb       not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.properties enable row level security;

create policy "select own" on public.properties
  for select using (auth.uid() = user_id);
create policy "insert own" on public.properties
  for insert with check (auth.uid() = user_id);
create policy "update own" on public.properties
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own" on public.properties
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.properties to authenticated;

-- ── down (documented inverse — do not auto-run in production) ────────────────
-- drop policy "delete own" on public.properties;
-- drop policy "update own" on public.properties;
-- drop policy "insert own" on public.properties;
-- drop policy "select own" on public.properties;
-- drop table public.properties;
