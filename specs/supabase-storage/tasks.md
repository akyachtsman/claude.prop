# Tasks — Permanent per-user storage

Derived from `plan.md`. Ordered + dependency-aware; `[P]` = parallel-safe (no
dependency on an unfinished task). Each task names concrete files and is sized to
roughly a failing-check → implement → verify → commit loop. Check off in place.

## Phase A — Backend foundation (DB)
- [ ] **T1. Precondition:** confirm project `yucnxlimmrgzbqtdizle` is `ACTIVE_HEALTHY`
  (Supabase MCP `list_projects`/`get_project`). Block Phase A DB tasks until it is.
- [ ] **T2.** Write `supabase/migrations/0001_properties.sql` — the D5 `up` (table,
  composite PK `(user_id,id)`, `enable row level security`, four `auth.uid()`
  policies, `grant … to authenticated`) **and** the documented `down` inverse as
  comments. Commit (versioned artifact, `data.md` reversibility). Depends: —
- [ ] **T3.** Apply the migration via MCP `apply_migration` (name `properties`).
  Depends: T1, T2.
- [ ] **T4. RLS proof (as the authenticated role):** via MCP `execute_sql`, insert a
  row for a fake user A and user B, then `set local role authenticated; set local
  request.jwt.claims = '{"sub":"<B>"}';` and assert a `select` returns **0** of A's
  rows. Also `get_advisors` → RLS-enabled, no warnings. Depends: T3.

## Phase B — Client config + library  (no DB dependency)
- [ ] **T5. [P]** Vendor `@supabase/supabase-js` v2 → `js/vendor/supabase-js.js`
  (download the pinned ESM bundle once from a CDN via the proxy, commit it; no
  runtime CDN). Record the exact version in a header comment. Depends: —
- [ ] **T6. [P]** `js/config.js` — export `SUPABASE_URL`
  (`https://yucnxlimmrgzbqtdizle.supabase.co`) + `SUPABASE_PUBLISHABLE_KEY`
  (`sb_publishable_…`), with a header comment: *public by design, RLS is the guard,
  never a secret key here.* Depends: —
- [ ] **T7.** `js/supabase.js` — `createClient(url, key, { auth: { flowType: 'pkce',
  detectSessionInUrl: true, persistSession: true }})`; export the client + thin
  helpers `signInWithEmail(email)`, `signOut()`, `getSession()`,
  `onAuthChange(cb)`. Depends: T5, T6.

## Phase C — Store refactor (keep it green at each step)
- [ ] **T8.** Extract the current localStorage code in `js/store.js` into an internal
  `localBackend` object (read/write on `propanalytics.v1`); `store` delegates to it.
  **No behavior change.** Verify: full logged-out S5–S22 + app suite still green.
  Depends: —
- [ ] **T9.** Add `cloudBackend` to `store.js`: cache on `propanalytics.cloud.<uid>`;
  `list/get` from cache; `save`→cache write + enqueue serialized `upsert`;
  `remove`→cache delete + serialized `delete`; a `Map<id,Promise>` per-id write chain.
  Depends: T7, T8, (T3 for a live table — but codeable/unit-testable before).
- [ ] **T10.** Offline choke-point: in `store.save`/`store.remove`, when
  `backend===cloud` and offline (Supabase call errors / `!navigator.onLine`),
  **reject** without mutating cache and `toast("You're offline — reconnect to edit.")`.
  Depends: T9.
- [ ] **T11.** `store.setSession(session|null)` swaps `local`↔`cloud`; guard
  `refreshBuiltinSample()`/`seedDemos()` (`app.js` boot) to run on the **local**
  backend only. Depends: T8, T9.
- [ ] **T12. Unit (Node) [P]:** store backend swap flips namespace; logged-out never
  calls cloud; `save/remove` enqueue serialized ops **in order**; offline (cloud)
  `save/remove` reject and don't mutate cache. Depends: T9, T10, T11.

## Phase D — Auth flow + UI
- [ ] **T13.** Boot ordering in `js/app.js`: init supabase → `await getSession()`
  (exchanges `?code`, cleans URL) → `store.setSession(session)` → **then** first
  `router()`; register `hashchange`→`router` after. Depends: T7, T11.
- [ ] **T14.** `onAuthChange` handler: `SIGNED_IN`→setSession(cloud)+fetch (T16);
  `SIGNED_OUT`→setSession(null)+local backend, cache kept (Q4)+re-render. Depends: T13.
- [ ] **T15.** Topbar account control (`index.html` slot + `js/app.js`/a small
  `js/views` helper): logged-out → **Sign in** (email input + "Send link" →
  "Check your email"); signed-in → email + **Sign out**. `el()`/`textContent`,
  Banker Navy tokens, reflows on phone. Depends: T7, T14.
- [ ] **T16.** Initial cloud fetch on sign-in: `select *` (RLS-scoped) → populate the
  **cloud** cache (never `propanalytics.v1`) → "Syncing…" state → re-render; on fetch
  error → cached read-only + toast. Depends: T9, T14.
- [ ] **T17.** First-sign-in reconcile (D6, fixed order): if local deals exist → the
  **offer-to-upload** prompt; on accept `upsert` local set (user copies win); then
  seed **only missing** fixture ids (`sampleProperty()`+`demoProperties()`); decline →
  leave `propanalytics.v1` intact. Depends: T16.
- [ ] **T18.** 401-vs-blip on write-through: auth/401 error → route to `SIGNED_OUT`
  handling (local backend + "signed out — sign in again"); transient error → "will
  re-sync" toast + cache holds. Depends: T9, T14.
- [ ] **T19.** Offline read-only UI: banner + disable dashboard inputs / +New / Load
  sample / undo-redo affordances when signed-in+offline; re-enable on reconnect.
  (Choke-point in T10 is the guarantee; this is the visible state.) Depends: T10, T15.

## Phase E — Verify + ship
- [ ] **T20. Unit (Node) [P]:** D6 upload/dedup — upload upserts, gap-seed fills only
  missing ids, an **edited** local sample is not clobbered, **decline leaves
  `propanalytics.v1` intact** (the data-loss guard). Depends: T17.
- [ ] **T21. DB integration (MCP) [P]:** an authenticated-role `upsert` produces the
  row; a second upsert by same `(user_id,id)` updates (no duplicate). Depends: T4.
- [ ] **T22. Playwright:** auth UI states (signed-out / check-email / signed-in /
  offline read-only) with the supabase client **stubbed**; assert logged-out S5–S22
  parity unaffected. Add scenarios to `.github/scripts/ui-tests/tests/`. Depends: T15, T19.
- [ ] **T23.** CLAUDE.md: add S23+ scenario rows (auth states, cloud persist, offline
  read-only, upload-on-sign-in) + UI-test config notes. Depends: T22.
- [ ] **T24.** Grep built/served assets for any `service_role`/secret key → must be
  absent; only URL + publishable key present (SC5). Depends: T6.
- [ ] **T25.** `qa-pipeline` (test-verifier → ui-tester → code review → pr-readiness),
  `/commit-chk`, open PR to `main` (draft), watch CI, merge on green. Depends: all.

## Traceability (every FR/SC → task)
FR1/2→T7,T15 · FR3→T9,T16 · FR4→T2,T4 · FR5→T8,T22 · FR6→T10,T19 · FR7→T8,T9 ·
FR8→T17 · FR9→T15 · FR10→T8,T22 · SC1→T16,T21 · SC2→T4 · SC3→T10,T19 · SC4→T22 ·
SC5→T2,T24 · SC6→T17,T20.
