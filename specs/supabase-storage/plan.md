# Plan — Permanent per-user storage (HOW)

Reads `spec.md` (phase 1 + clarifications). Honors the constitution: `data.md`
(RLS always on, no secret keys in the browser, **versioned reversible
migrations**), `global.md` (static tier, no build, `textContent`, cross-platform),
`design.md` (Banker Navy tokens), `test.md` (existing suite green, new behavior
covered). Revised after a fresh-context self-review (findings folded in below).

## Key decisions & trade-offs

### D1 — Client library: vendor `supabase-js`, don't hand-roll auth
Magic-link involves session tokens, refresh, and PKCE — security-sensitive and
error-prone to hand-write. Use `@supabase/supabase-js` v2, **vendored** as a single
pinned ESM file at `js/vendor/supabase-js.js` (fetched once from a CDN at implement
time, then committed — **no CDN at runtime**, works offline). Trade-off: ~120 KB.
Accepted — auth correctness beats byte count.

### D2 — Config: public URL + publishable key, committed (not a secret)
`js/config.js` (committed) exports `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`.
`data.md`'s no-hardcoded-keys rule governs the **service-role/secret** key — which
never appears in this static app. The publishable key is *designed* to ship in every
browser; **RLS is the protection**. A no-build Pages site has no CI/build to inject a
"repo variable," so committing the public key is the compliant, pragmatic path; a
header comment in `config.js` states this so it isn't mistaken for a leak.

### D3 — Store stays synchronous; per-user cache namespace; cloud write-through
The views call `store.save()` synchronously in `onCommit` and undo/redo (FR7 — no
view rewiring). Keep that. Model:
- **Two distinct localStorage namespaces, never mixed:**
  - Logged-out / local: the existing key **`propanalytics.v1`** — *untouched* by the
    cloud path. This is the "your local deals" set the upload prompt promises never to
    destroy (Q1/SC6/US5).
  - Signed-in cloud cache: a **per-user key `propanalytics.cloud.<user_id>`**. The
    sign-in fetch populates *this*, never `propanalytics.v1`.
- **Reads** always come from the active backend's namespace (sync, instant UI).
- **Writes** (signed-in): local cache write (sync) **+** async write-through
  (`upsert`/`delete`) to Supabase.
- **`store.save`/`store.remove` are the single enforcement choke-point.** When
  signed-in AND offline they **reject the write** (no cache mutation, no network) and
  `toast("You're offline — reconnect to edit.")`. So *every* write entry point is
  gated at once: field commits, **`+ New`**, **Load sample**, **undo/redo** — all
  route through `store.save`/`remove`. The dashboard also disables inputs + shows a
  read-only banner (UX), but the choke-point is the guarantee.
- **Per-id write-through serialization.** A `Map<id, Promise>` chains async writes
  for the same id so upsert N always lands before N+1 — rapid commits / undo-redo
  can't leave the cloud stale then "win" on reload. Different ids run in parallel.

### D4 — Backend selection behind the existing interface
`store.js` gains an internal `backend` (`local` | `cloud`) chosen by
`setSession(session|null)`. Public method signatures
(`list/get/save/remove/export/import/newId/probe/isStorageOK/hasSeeded/markSeeded`)
are unchanged. `save`/`remove` additionally enqueue the serialized cloud op when the
cloud backend is active. `refreshBuiltinSample()` and `seedDemos()` (boot,
`app.js:255–256`) are **guarded to the local backend only** — cloud accounts get their
fixtures from D6, so boot-seeding never runs against the cloud namespace.

### D5 — Schema: composite PK, per-user RLS, committed reversible migration
Samples are per-account (Q2), so the app id is not globally unique — scope it to the
user. Committed as a versioned artifact **`supabase/migrations/0001_properties.sql`**
(+ a documented inverse) in the same PR as the code, per `data.md` reversibility;
applied via the Supabase MCP `apply_migration`.

```sql
-- up
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
create policy "select own" on public.properties for select using (auth.uid() = user_id);
create policy "insert own" on public.properties for insert with check (auth.uid() = user_id);
create policy "update own" on public.properties for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own" on public.properties for delete using (auth.uid() = user_id);
grant select, insert, update, delete on public.properties to authenticated;

-- down (documented inverse; deprecation preferred over destruction in production):
-- drop policy "select own" on public.properties;  (…insert/update/delete own…)
-- drop table public.properties;
```
`data jsonb` = the same object we already export. Writes `upsert on conflict
(user_id, id)`; `user_id` defaults to `auth.uid()` so the client never sends it.

### D6 — Seeding + first-sign-in upload: upload wins, seed fills gaps
On first sign-in, in this **fixed order** so a re-seed can never clobber a user's
edited sample:
1. If the device has local deals → **offer to upload** (one prompt). On accept,
   `upsert` the local set by `(user_id, id)` — the user's copies (incl. an edited
   `sample-715-plumas`) land first and **win**.
2. Then seed **only fixture ids absent from the account** (`sampleProperty()` +
   `demoProperties()` whose id isn't already present) — so a fresh account gets its
   samples, but an uploaded/edited copy is never overwritten.
Decline the prompt → account starts empty (or seeded fixtures only); local
`propanalytics.v1` is untouched.

### D7 — Auth flow (magic link, PKCE, boot-ordered)
- **PKCE flow** (`createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true }})`): the magic link returns **`?code=…` (query param, not a URL fragment)**, so it can't collide with the hash router or drive `parseHash`.
- **Boot ordering (fixes the redirect vs. router race):** initialize supabase →
  `await` the session (supabase-js exchanges `?code` and cleans the URL) →
  `store.setSession(session)` → **then** call `router()` for the first time. The
  existing `hashchange`→`router` wiring is added *after* the initial session is
  resolved, so no route renders against a half-exchanged URL.
- Sign in: `signInWithOtp({ email, options:{ emailRedirectTo: <Pages URL> }})` →
  "check your email" state.
- `onAuthStateChange` drives `setSession()` + re-render. **`SIGNED_OUT`** → local
  backend, **cache kept** (Q4).
- Owner dashboard config: Site URL + Redirect URLs = the Pages URL and
  `http://localhost:8099` (local dev).

### D8 — UI (Banker Navy)
- Topbar account control: logged-out → **Sign in** (email input + "Send link" →
  "Check your email"); signed-in → email + **Sign out**. `el()`/`textContent`,
  project tokens, reflows on phone (topbar already responsive).
- **Signed-in + offline** → slim read-only banner + disabled inputs (token-styled).
- A brief "Syncing…" state during the initial cloud fetch; toasts reuse `toast()`.

## Data flow
1. **Boot, logged out:** backend = local (`propanalytics.v1`) → today's app exactly;
   `refreshBuiltinSample`/`seedDemos` run here only. No network.
2. **Sign in:** email → PKCE `?code` → boot-ordered exchange → session.
   `setSession` → cloud backend (`propanalytics.cloud.<uid>`). Initial
   `select * from properties` (RLS-scoped) → populate the **cloud** cache (local key
   untouched) → re-render. Then D6 (offer-to-upload, then gap-seed).
3. **Edit (signed-in, online):** `store.save(p)` → cloud-cache write (sync) →
   serialized async `upsert`. `remove` → cache delete + serialized async `delete`.
4. **Offline (signed-in):** `store.save/remove` reject + toast; read-only banner;
   cache still renders. No write attempted anywhere.
5. **Sign out:** `setSession(null)` → local backend on `propanalytics.v1` (its
   original contents intact); cloud cache retained but inactive.

## Main failure modes & handling
- **Out-of-order write-through** → per-id serialization (D3). N+1 waits for N.
- **Write-through 401 (session expired mid-edit)** → distinguished from a network
  blip by status: 401/auth error routes to the **`SIGNED_OUT`** path (switch to local
  backend + "signed out — sign in again" toast), **not** the "will re-sync" toast
  (which would never re-sync while unauthenticated).
- **Transient write-through failure (network blip, still authed)** → toast
  ("couldn't reach your account — will re-sync"); cache holds the change; next op or
  reload reconciles.
- **Initial fetch fails after sign-in** → stay on cache, read-only, "couldn't load
  your account" toast; retry on reconnect. Never blank the app.
- **Redirect vs. router** → PKCE query-param + boot ordering (D7); `#…` never carries
  tokens.
- **`navigator.onLine` is a weak signal** → it's only the *fast* offline hint; the
  real guard is the Supabase call erroring → read-only. Editing re-enables when a
  write/fetch succeeds again, not on `onLine` alone.
- **RLS misconfig / 401 on read** → load-error toast (not a silent empty portfolio);
  proven at the DB pre-ship (below).
- **Storage full / private mode** → existing `isStorageOK()`; supabase-js session
  storage failing → treat as logged-out.

## Testing strategy
- **Logged-out parity (hard CI gate):** full S5–S22 + app.spec with **no session** →
  green, unchanged (FR10/SC4). Uses the local backend on `propanalytics.v1`.
- **Store abstraction (unit, Node):** mocked cloud backend — session swap flips
  backend + namespace; logged-out never calls the cloud; `save/remove` enqueue
  serialized cloud ops in order; **offline (signed-in) `save`/`remove` reject and do
  not mutate the cache** (the choke-point).
- **First-sign-in upload/dedup (unit, Node):** the D6 logic — upload upserts the local
  set, seed fills only missing fixture ids, an edited local sample is **not**
  clobbered, declining leaves `propanalytics.v1` intact (the data-loss guard).
- **RLS isolation (DB, via Supabase MCP) — run as the authenticated role, not the
  service connection:** seed rows for user A and user B, then
  `set local role authenticated; set local request.jwt.claims = '{"sub":"<userB>"}';`
  and confirm a `select` returns **zero** of user A's rows (and B sees only B's).
  A plain service-connection select bypasses RLS and would false-pass — impersonation
  is mandatory. `get_advisors` additionally confirms RLS-enabled.
- **Real write→row (integration, MCP):** at least one check that an authenticated-role
  `upsert` produces the expected row and an update upserts (not duplicates) by
  `(user_id, id)`.
- **Auth round-trip:** magic-link email + redirect verified **manually** (email isn't
  CI-automatable); the UI states (signed-out / check-email / signed-in / offline
  read-only) get a Playwright test with the supabase client **stubbed**.
- New project-scenario rows (S23+) added to CLAUDE.md per the ui-tester contract.

## Rollout / sequencing
- Project `yucnxlimmrgzbqtdizle` must be `ACTIVE_HEALTHY` before the migration.
- Migration SQL committed with code in one PR (revert restores source + documents the
  inverse). RLS on, no secret key shipped (grep the built assets), isolation proven at
  the DB.
- Purely additive: logged-out behavior is byte-for-byte unchanged; the account layer
  layers on top.
