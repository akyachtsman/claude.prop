# Plan — Permanent per-user storage (HOW)

Reads `spec.md` (phase 1 + clarifications). Honors the constitution: `data.md`
(RLS always on, no secret keys in the browser), `global.md` (static tier, no
build, `textContent`, cross-platform), `design.md` (Banker Navy tokens),
`test.md` (existing suite stays green, new behavior covered).

## Key decisions & trade-offs

### D1 — Client library: vendor `supabase-js`, don't hand-roll auth
Magic-link sign-in involves session tokens, refresh, and PKCE — security-sensitive
and error-prone to hand-write. Use `@supabase/supabase-js` v2, **vendored** as a
single pinned ESM file at `js/vendor/supabase-js.js` (fetched once from a CDN at
implement time, then committed — **no CDN at runtime**, works offline, matches the
no-build rule). Trade-off: ~120 KB added to a currently-tiny app. Accepted — auth
correctness beats byte count, and it's cached after first load.

### D2 — Config: public URL + publishable key, committed (not a secret)
`js/config.js` (committed) exports `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
Per `data.md`, the **no-hardcoded-keys** rule governs the **service-role/secret**
key — which never appears in this static app. The publishable key is *designed* to
ship in every browser; **RLS is the protection**, not key secrecy. A header comment
in `config.js` states this explicitly so it isn't mistaken for a leaked secret.

### D3 — Store stays synchronous; cloud is write-through; editing is online-gated
The views call `store.save()` synchronously inside `onCommit` (and undo/redo). We
**keep that synchronous interface** (FR7 — no view rewiring). Model:
- **localStorage is the always-synchronous cache** and the sole read/write target
  the views see — unchanged from today.
- When **signed in**, each committed local write is **mirrored to the cloud** by an
  async write-through (`upsert`/`delete` on the `properties` table). The UI does not
  block on it.
- **Editing is only enabled when logged-out OR (signed-in AND online).** When
  signed-in AND offline, the dashboard is **read-only** (inputs disabled, an offline
  banner shows) — so a write-through never fires without connectivity. This is how
  "no offline editing" (clarification Q3) is enforced without an offline write queue
  or any conflict resolution.
- On **sign-in / load (online)**, the cloud is fetched as the **source of truth**,
  replaces the local cache, and the app re-renders.

Trade-off vs. "cloud is the only writer": that would force an async `store.save`
and ripple through app.js + undo/redo. Local-cache-first keeps the whole existing
synchronous engine intact and treats the cloud as a replica — far less invasive,
and safe because editing can't happen offline.

### D4 — Backend selection behind the existing interface
`store.js` gains an internal `backend` that is either `local` (today's localStorage
code, extracted unchanged) or `cloud` (localStorage cache + Supabase write-through).
`setSession(session|null)` swaps it. Public methods
(`list/get/save/remove/export/import/newId/probe/isStorageOK/hasSeeded/markSeeded`)
are unchanged in signature. `save`/`remove` additionally enqueue the cloud
write-through when the cloud backend is active.

### D5 — Schema: composite PK so ids are per-user
Samples are per-account (Q2), so the app id (`sample-715-plumas`, `demo-*`,
`p-…`) is **not** globally unique — scope it to the user.

```sql
create table public.properties (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id         text        not null,                    -- app property id, unique per user
  name       text,
  data       jsonb       not null,                    -- full property object (inputs only)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.properties enable row level security;

create policy "select own"  on public.properties for select using (auth.uid() = user_id);
create policy "insert own"  on public.properties for insert with check (auth.uid() = user_id);
create policy "update own"  on public.properties for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own"  on public.properties for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.properties to authenticated;
```
`data jsonb` stores the same object we already export — one row per property, so
the calc engine and export/import shapes are untouched. Writes use
`upsert on conflict (user_id, id)`; `user_id` defaults to `auth.uid()` so the client
never sends it. Applied via the Supabase MCP `apply_migration` (idempotent SQL).

### D6 — Seeding samples client-side (single source of truth)
No DB trigger duplicating sample data. On first sign-in to an **empty** account, the
client seeds `sampleProperty()` + `demoProperties()` into the cloud (same factories
`js/sample.js` already exposes). The Q1 "offer to upload" then upserts the device's
local deals by `(user_id, id)` — so a local `sample-715-plumas` merges with the
seeded one instead of duplicating.

### D7 — Auth flow (magic link)
- Sign in: `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: <pages URL> } })` → "check your email" state.
- Return: supabase-js parses the session from the redirect and persists it (its own
  localStorage keys). `onAuthStateChange` drives `store.setSession()` + a re-render.
- Sign out: `supabase.auth.signOut()` → local backend, **cache kept** (Q4).
- Requires (dashboard, done by owner): Site URL + Redirect URL = the Pages URL (and
  `http://localhost:8099` for local dev).

### D8 — UI (Banker Navy)
- Topbar account control: logged-out → **Sign in** (opens a small email form:
  input + "Send link", then a "Check your email" confirmation); signed-in → the
  email + **Sign out**. Built with `el()`/`textContent`, project tokens, reflows on
  phone (topbar is already responsive).
- **Offline-while-signed-in**: a slim read-only banner + disabled inputs; uses
  `--color-*` tokens, not ad-hoc styling.
- Empty/loading/success states: a brief "Syncing…" while the initial cloud fetch
  runs; toasts reuse the existing `toast()`.

## Data flow
1. **Boot, logged out:** `store` = local backend → today's app exactly (samples/demos
   local, S5–S22 behavior). No network.
2. **Sign in:** email → magic link → redirect → session. `setSession(session)` →
   cloud backend. Initial fetch: `select * from properties` (RLS-scoped to the user)
   → replace local cache → re-render. If the account is empty → seed samples+demos to
   cloud; if the device had local deals → **offer to upload** (upsert by id).
3. **Edit (signed-in, online):** view calls `store.save(p)` → local cache write
   (sync, instant UI) → async `upsert` to cloud. `remove` → local delete + async cloud
   `delete`.
4. **Offline (signed-in):** `navigator.onLine`/Supabase error → read-only mode:
   inputs disabled, banner shown; cache still renders. No writes attempted.
5. **Sign out:** `setSession(null)` → local backend, cache retained.

## Main failure modes & handling
- **Cloud write-through fails while "online" (transient blip).** Local cache already
  has the change; show a toast ("Couldn't reach your account — will re-sync"). On the
  next successful op or reload, the source-of-truth fetch reconciles (last local write
  re-pushed on next edit; or cloud wins on reload). No silent divergence — the toast
  makes it visible. (Rare: editing requires online.)
- **Initial fetch fails after sign-in.** Stay on the cached view, show read-only +
  a "couldn't load your account" toast; retry on reconnect. Never blank the app.
- **Expired/invalid session.** `onAuthStateChange('SIGNED_OUT')` → local backend +
  a gentle "signed out — sign in again" toast. Local cache preserved.
- **RLS/misconfig (empty results or 401).** Surfaced as a load error toast, not a
  silent empty portfolio; verified pre-ship at the DB level (below).
- **Storage full / private mode.** Existing `isStorageOK()` path still applies to the
  cache; supabase-js session storage failing → treat as logged-out.

## Testing strategy
- **Logged-out parity (primary gate):** the full S5–S22 + app.spec suite runs with
  **no session** → must stay green (FR10, SC4). This is the hard CI gate.
- **Backend abstraction (unit, Node):** `store.js` with a mocked cloud backend —
  verify save/remove enqueue cloud ops, session swap flips backends, logged-out never
  calls the cloud.
- **RLS isolation (DB-level, via Supabase MCP):** `execute_sql`/`get_advisors` to
  confirm RLS is on, policies scope to `auth.uid()`, and a second user can't read row
  one — verified directly against the DB (the honest way to prove SC2/SC5 without a
  brittle two-account browser test). No secret key in built assets — grep the bundle.
- **Auth round-trip:** magic-link email + redirect is verified **manually** (email
  isn't automatable in CI); the UI states (signed-out / check-email / signed-in /
  offline-read-only) get a Playwright test with the Supabase client **stubbed**.
- New project-scenario rows (S23+) added to CLAUDE.md per the ui-tester contract.

## Rollout / sequencing notes
- Supabase project `yucnxlimmrgzbqtdizle` must be `ACTIVE_HEALTHY` before the
  migration (it was `COMING_UP` at plan time).
- Ship behind the existing app with **zero logged-out behavior change** first; the
  account layer is purely additive.
- `data.md` compliance checkpoints: RLS on (D5), no secret key shipped (D2 + grep
  test), per-user isolation proven at the DB (testing).
