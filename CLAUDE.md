# CLAUDE.md — Property Analytics

## Imported Directives
https://raw.githubusercontent.com/akyachtsman/claude.directives/main/directives/global.md
https://raw.githubusercontent.com/akyachtsman/claude.directives/main/directives/design.md
https://raw.githubusercontent.com/akyachtsman/claude.directives/main/directives/test.md
https://raw.githubusercontent.com/akyachtsman/claude.directives/main/directives/data.md
https://raw.githubusercontent.com/akyachtsman/claude.directives/main/directives/git.md

---

## Project Overview
- **Project name:** Property Analytics
- **Live URL:** https://akyachtsman.github.io/claude.prop/
- **Stack:** Static tier — plain HTML + CSS + vanilla JS on GitHub Pages (branch-source, no build). [Add backend/data details if the project needs them]
- **Branch policy:** Develop on a `claude/<name>` feature branch; PRs target `main`

## Design
This project's look is its own — established at kickoff via `/design-intake`
(per `directives/design.md`), not a shared company theme. It lives in:
- `styles/tokens.css` — brand primitives (color, type, spacing, radius, shadow)
- `styles/components.css` — reusable components
- **Reference page:** `index.html` ("Banker Navy", established & owner-approved 2026-07-14 — see `specs/property-dashboard/design.md`)

## Application Architecture
- [main source file/folder] — [brief description]

## Required Commands
| Purpose | Command |
|---|---|
| Validate HTML | `npx html-validate index.html` |
| Validate workflow YAML | `python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/qa.yml'))"` |

## Application Architecture
Single-page app, plain HTML/CSS/JS ES modules, no build (static tier).
- `index.html` — app shell: top bar (brand + property switcher + verdict pills +
  nav/Save/Delete) and `<main id="view">`; loads `js/app.js`.
- `js/model.js` — **pure calc engine** (the fidelity core): `compute(property)`
  → all 12 KPIs + 5-year pro-forma. Mirrors `specs/property-dashboard/workbook-model.md`
  with the two owner-approved corrections. No DOM/storage — unit-testable.
- `js/store.js` — persistence repository behind a stable interface
  (list/get/save/remove/export/import); v1 = localStorage, Supabase-swappable later.
- `js/format.js` — number/date/rate formatting (editorial rules).
- `js/dom.js` — `el()`/`render()`/`toast()` DOM builder (all text via `textContent`).
- `js/notes.js` — workbook methodology text (verbatim).
- `js/sample.js` — the sample deal + `EXPECTED` fixture (drives the fidelity test).
- `js/views/{dashboard,list,compare}.js` — the three views; `js/app.js` is the
  hash router (`#/`, `#/p/:id`, `#/compare`) + shared state.
- Spec: `specs/property-dashboard/` (spec, plan, tasks, workbook-model, research).

## Project-Specific Security Constraints
- Local-first: all property data lives in the browser (`localStorage`, key
  `propanalytics.v1`); no backend, no credentials, no network calls in v1.
- Export/import is user-initiated JSON; import validates shape + schema version
  and never silently wipes existing data.

## Project-Specific Coding Standards
- Only inputs are persisted; every metric is recomputed on render (never stored)
  so numbers can't go stale.
- All dynamic text via `textContent` / the `el()` helper — never `innerHTML` with data.
- Every displayed value reads from `js/format.js`; no ad-hoc number formatting.
- Any change to the financial model must keep `js/sample.js` `EXPECTED` in sync
  and pass the S5 fidelity test.

## Agent Workflow
1. Use a `claude/<name>` feature branch
2. For a non-trivial feature, run `/sdd-loop` (`specify` → `clarify` → `plan` → `tasks`) before coding — separate WHAT from HOW; trivial changes skip to step 3
3. Implement changes in [main source file] — or `/sdd-loop analyze` then `/sdd-loop implement` to check consistency and work the task list
4. Run Required Commands above — all must pass
5. Prefer `qa-pipeline`; run steps individually only if it fails:
   `test-verifier` → `pr-review-toolkit:code-reviewer` → `/security-review` (if security-relevant) → `pr-readiness-reviewer`
6. Open PR to `main`

## UI Test Configuration
Read by `ui-tester` and the Playwright kit at runtime — fill in before invoking agents:
| Key | Value |
|---|---|
| App URL | `https://akyachtsman.github.io/claude.prop/` |
| Valid test credential | _none — no auth in v1 (local-first app)_ |
| Invalid test credential | _n/a_ |
| Primary nav button | `Load sample deal` (first-run) / `+ New property` |
| Primary content selector | `.kpi-strip` (dashboard) · `.lcard` (list) · `.compare-table` (compare) |
| Nav cards | `['Properties', 'Compare']` |
| Playwright test directory | `.github/scripts/ui-tests` |
| Key selectors | list `.lcard__name` · delete `.lcard__del` · dashboard `.kpi` / `.kpi__value` · inputs by `aria-label` (e.g. `input[aria-label="Offer price"]`, committed on Enter/blur) · undo/redo `.topbar__action` (`button[aria-label="Undo last change"]` / `"Redo change"`) · compare `.cell--best`/`.cell--worst` |

## Project-Specific Test Scenarios
Authoritative list of coverage beyond the generic S1–S4 suite — the ui-tester
adds one `app.spec.js` scenario per row, numbered from S5. Fill in before
invoking agents (the ui-tester stops and asks if this table is missing).
Implemented in `.github/scripts/ui-tests/tests/property.spec.js` (desktop,
fine-pointer context; the generic `app.spec.js` covers the mobile viewports).
| # | Feature | What to verify | Failure indicator |
|---|---|---|---|
| S5 | Calc fidelity | Sample deal's 12 KPIs equal the actual-close fixture (CAP 5.13%, DSCR 0.84, NPV -$29,512, …) | Any KPI differs from EXPECTED |
| S6 | Commit recalc | Editing Offer price updates CAP on field commit (Enter/blur), not mid-type; no calculate button | Recompute fires mid-type, or no recompute on commit |
| S7 | Persistence | Saved property survives a reload | List empty after reload |
| S8 | Comparison | Two layouts (default `.compare-table--rows` spreadsheet table + `Side by side` toggle); best/worst per metric highlighted + verdict pill; clicking any column header sorts the rows (`aria-sort` toggles asc/desc, "—" sinks last) | No `.cell--best`/`.cell--worst`/verdict pill, toggle doesn't switch layouts, or a header click doesn't sort |
| S9 | Empty/zero | Zeroed property renders "—", never NaN | `NaN`/`Infinity`/`undefined` in KPIs |
| S10 | Export/import | Data round-trips to an identical set | Property missing after restore |
| S11 | One-screen | Dashboard fits 1440×900 with no vertical scroll; all data points present | `scrollHeight > innerHeight` |
| S12 | Deal summary | Editable Offer/Fees/Improvement band above the cards is the single source (removed from Offer & Debt card); All-In Cost derived | Duplicate Offer input remains, or All-In not `$244,335` |
| S13 | Formula popup | Hovering/focusing a KPI reveals its calculation in a popup, clamped within the viewport | No `.kpi-tip`, wrong formula text, or popup overflows viewport |
| S14 | Pro-forma horizon | Slider (default 5 yr) extends the pro-forma to 10 yr with a 5↔10 boundary and a second 10-year NPV/Return/IRR block; 5-year headline unchanged | Slider doesn't extend, no boundary/10-yr block, or 5Y NPV ≠ `-$29,512` |
| S15 | CAP/DSCR goal-seek (split from Target) | Two separate concerns: the editable **Target CAP/DSCR** band cells (default 8% / 1.25) drive the verdict pills only, and the **blank** "Solve offer for CAP/DSCR" inputs under Offer Price back-solve the offer (`NOI÷cap` / `PV(loan)÷LTV`) then clear — one-shot, never touching the Target benchmark or persisting | Editing Target moves the offer, a solve input is pre-filled on load, a solve doesn't move the offer, or resulting CAP/DSCR ≠ solved target |
| S16 | Change marker | After an edit, output values that changed get a corner-fold `.flash` marker that persists until the next edit; none on initial load or on edits with no computed effect | Marker on load, none on a rippling edit, or one on an inert edit |
| S17 | Generated shade | Computed fields (KPI cells, All-In, fact values) share the `--gen-shade` fill so generated values read distinct from inputs | A generated field lacks the shade |
| S18 | Auto-save | Edits persist automatically (debounced); switching properties never prompts to save; a reload keeps the edit | Edit lost after reload, or a switch shows an unsaved-changes prompt |
| S19 | Amort vs. maturity | Loan carries separate Amort + Maturity terms; when maturity < amort a balloon (remaining balance) is reported (`$725,708 · yr 10`); payment/DSCR/NPV unchanged by maturity (a refinance is cash-neutral) | No balloon shown, or editing maturity changes DSCR/payment |
| S20 | Stale-sample refresh | A returning visitor's older built-in sample (lower `sampleRev`) auto-updates to the latest figures on boot (offer `$1,300,000`, CAP `5.13%`); user-created deals are never touched | Stale sample survives a reload, or a non-sample property is overwritten |
| S21 | Undo/redo | Each committed edit is one undo step; the Undo topbar button reverts the last change and Redo replays it; both disarm when empty; typing without committing is not undoable | Undo/Redo missing/stuck-disabled, doesn't revert/replay, or a mid-type change is captured |
| S22 | Demo seed | Three extra demo deals (`demoProperties()`) seed once on boot when the store is already non-empty (a brand-new visitor still meets the empty first-run), guarded by `store.hasSeeded()`; a seeded deal the user deletes never reappears | Seed fires on an empty first-run, doesn't seed on a non-empty store, or a deleted demo reappears after reload |
| S23 | Auth gate (logged out) | Logged out shows **only** the full-page sign-in wall (`.authgate`); the topbar nav, KPI strip, and every deal are hidden — no app or data leaks | Gate missing, or any `.lcard`/`.kpi-strip`/nav visible while logged out |
| S24 | Password sign-in | Valid email+password on the gate signs in and reveals the app (account email in the topbar, gate gone); stubbed `signInWithPassword` (`/auth/v1/token`) | Sign-in doesn't reveal the app, or a hard error on valid creds |
| S25 | Forgot password | The **Forgot password?** link switches to reset mode (password field hidden); **Send reset link** shows the `.authgate__status--ok` "Check your email" state (stubbed `/auth/v1/recover`) | No reset mode, or no "check your email" state |
| S26 | Signed-in chrome | With a session the gate is gone, the topbar shows the account email + **Sign out**, and `store.backendKind()` is `cloud` (reads/writes `propanalytics.cloud.<uid>`) | Gate still shown, email/Sign out missing, or backend stays local |
| S27 | Offline read-only | Signed-in + offline shows the `#offline-banner` and `body.is-readonly`; the write choke-point (`store.save`/`remove`) rejects edits (no cache mutation); reconnect clears the banner | No banner/read-only state, or an edit persists while offline signed-in |
| S28 | First-sign-in seed | A fresh account (reconcile enabled) gap-seeds the 715 Plumas sample + 3 demos on first sign-in; the test reloads (reading the persisted stateful mock) so the assertion is engine-independent across chromium/webkit. The gap-seed *logic* is also unit-tested in `tests/reconcile.test.mjs` | Fewer than 4 cards, or a fixture missing |

**The app is gated behind login** (owner decision, 2026-07-16), using **email +
password** (`signIn`/`signUp`/`resetPassword`/`updatePassword` in `js/supabase.js`;
the gate has sign-in / create-account / forgot modes + a recovery form). Logged
out shows only the sign-in wall; the app + all data require a Supabase session.
(On public Pages this is a UI curtain, not file security — the real protection is
per-user RLS on the data.) Because of the gate, **all UI scenarios run signed-in**:
`property.spec.js` + the generic `app.spec.js` boot via
`tests/_supabase-mock.js` `installSignedIn()` — it injects a session
(`sb-<ref>-auth-token`), stubs `**/auth/v1/**` + a **stateful**
`**/rest/v1/properties**` (GET/upsert/delete over an in-memory map that survives
reloads), and suppresses the first-sign-in reconcile so a signed-in empty account
behaves like the old local first-run (same "Load sample deal"/"+ New" flow). The
logged-out gate states + fresh-account seed live in `auth.spec.js` (S23–S28) with
the auth client stubbed (register the `**/auth/v1/**` catch-all route FIRST and
`token`/`recover` specifics LAST — Playwright's last-registered route wins). The
store layer (backend swap, offline choke-point, first-sign-in upload/dedup) is
covered by Node unit tests in `tests/*.test.mjs` (run `node --test
tests/store.test.mjs tests/reconcile.test.mjs`; also a blocking CI step in
`qa.yml`). RLS isolation + authenticated-role upsert are proven at the DB via the
Supabase MCP (impersonated, rolled-back). The password-reset email round-trip is
verified **manually** (owner must set Auth Site URL + Redirect URLs to the Pages
URL and `http://localhost:8099`).

## Reporting Requirements
Agents write evidence to `.agent-reports/`:
- `implementation-summary.md`, `test-report.md`, `ui-test-report.md`
- `playwright-results.json`, `screenshots/` (on failure)
- `code-review-report.md`, `test-coverage-report.md`, `security-review-report.md`, `pr-readiness-report.md`

## Safety Rules for Agents
- Reviewer agents must not edit code unless explicitly instructed.
- Test commands must not require production credentials.
- Destructive commands, data resets, migrations, or deploys require explicit approval.
- If a check can't run locally, explain why and name the closest substitute.

## Session Start
1. Read all Imported Directive URLs above fully
2. Verify the directives-toolkit plugin attached (commands/agents resolve) per global.md → Skill Bootstrap
3. Confirm active branch: `git branch --show-current`
4. Run `/env-chk` and report status
