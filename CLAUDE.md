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
- `index.html` — app shell: top bar (brand + property switcher/verdict pills on
  the dashboard, or the **header action bar** — Compare · Archive · + New · Import
  a listing — on the list-type views + static nav: Properties · Backup · Restore ·
  account) and `<main id="view">`; loads `js/app.js`. The action bar's buttons are
  plain topbar links (styled like the static nav), and JSON export/import is labelled
  **Backup**/**Restore** so only "Import a listing" reads as an import. The action bar is built by
  `app.js` `fillTopbarActions()` and shown on the **Properties list view only** —
  not the dashboard (its center is already full; a 4-button add overflows the mobile
  topbar, the S4/S21 failure mode) and not the compare/archive drill-downs (reached
  from the list, they return via their own "Back to properties", which keeps
  back-navigation strictly unwindable — the generic `app.spec.js` NAV invariant).
- `js/model.js` — **pure calc engine** (the fidelity core): `compute(property)`
  → all 12 KPIs + 5-year pro-forma. Mirrors `specs/property-dashboard/workbook-model.md`
  with the two owner-approved corrections. No DOM/storage — unit-testable.
- `js/store.js` — persistence repository behind a stable interface
  (list/get/save/remove/export/import); v1 = localStorage, Supabase-swappable later.
- `js/format.js` — number/date/rate formatting (editorial rules).
- `js/dom.js` — `el()`/`render()`/`toast()` DOM builder (all text via `textContent`).
- `js/notes.js` — workbook methodology text (verbatim).
- `js/mathinput.js` — pure Excel-style arithmetic evaluator for numeric fields (`evalMath`/`commitNumericInput`).
- `js/media.js` — pure photo-gallery helpers (`safeImageUrl`/`parsePhotoUrls`/`normalizeMedia`); `prop.media.photos` is a `string[]` of validated http(s) image URLs.
- `supabase/functions/import-listing/` — Edge Function: takes a listing URL, fetches the provider API **server-side** (browsers can't, cross-origin), normalizes to a property, returns `{ property }`. Only known provider hosts are fetched (Crexi now), from an id parsed out of the URL — never an arbitrary URL (no SSRF). `js/supabase.js` `importListing(url)` calls it; the client saves the result through the normal RLS store.
- `js/importparse.js` — pure import helpers: `classifyImportInput(text)` (url / html / empty / unknown) and `parseLoopNetHtml(text)`. The single Import box takes **either** a Crexi URL (→ the Edge Function) **or** pasted LoopNet page source (→ parsed in-browser from the listing's own JSON-LD, since LoopNet's Akamai wall blocks any server fetch). Unit-tested with a fixture in `tests/importparse.test.mjs`.
- `js/sample.js` — the sample deal + `EXPECTED` fixture (drives the fidelity test).
- `js/views/{dashboard,list,compare,archive}.js` — the views; `js/app.js` is the
  hash router (`#/`, `#/p/:id`, `#/compare`, `#/archive`) + shared state.
- `js/views/archive.js` — the Archive view: archived deals (`prop.archived === true`)
  rendered as rows in the **exact** Compare "Table" layout (reuses `METRICS`,
  `extremes`, `verdictPill`, `fnum` exported from `compare.js`), plus a per-row
  Restore/Delete actions in the sticky-left column. Archiving hides a deal from the
  Properties list, Compare, and the dashboard switcher without deleting it; it lives
  here until restored. Reached from the header action bar's **Archive** button; each
  property card also carries an explicit **Archive** (+ **Delete**) footer button.
  The `archived` flag is the only state; fixtures omit it (falsy = active), so S5 is
  unaffected.
- Spec: `specs/property-dashboard/` (spec, plan, tasks, workbook-model, research).

## Project-Specific Security Constraints
- Local-first: property data lives in the browser (`localStorage`, key
  `propanalytics.v1`) or, signed in, per-user cloud rows under RLS. No
  service-role/secret key ever ships in client code (only the public URL +
  publishable key, `js/config.js`).
- The one outbound integration is the **`import-listing` Edge Function** (server
  side, so no secret in the browser): it fetches only known provider hosts from
  an id parsed out of a recognized listing URL — never an arbitrary URL — and is
  `verify_jwt` gated. Everything else is still computed client-side.
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
| Nav cards | header action bar `['Compare', 'Archive', '+ New property', 'Import a listing']` (list view only) + static nav `['Properties', 'Backup', 'Restore']` |
| Playwright test directory | `.github/scripts/ui-tests` |
| Key selectors | list `.lcard__name` · card Archive `button[aria-label^="Archive "]` (no card Delete — deletion is `.archive-del` in the Archive rows) · dashboard `.kpi` / `.kpi__value` · inputs by `aria-label` (e.g. `input[aria-label="Offer price"]`, committed on Enter/blur) · undo/redo `.topbar__action` (`button[aria-label="Undo last change"]` / `"Redo change"`) · compare `.cell--best`/`.cell--worst` |

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
| S12 | Deal summary | Editable Offer/Fees/Improvement band above the cards is the single source (removed from Offer & Debt card); All-In Cost derived; editing **Asking Price** (Property Info) seeds Offer Price to it (workbook `onEdit` parity) | Duplicate Offer input remains, All-In not `$244,335`, or editing Asking doesn't move Offer |
| S12b | Use-default expense toggle | Tax & insurance each carry a small **"use default"** checkbox (`e.useDefault`) with the formula shown in a tiny font. **Checked** fills/refreshes the row from its own driver, **per-key**: **tax** = `offer × 0.012` (on offer/Asking edit); **insurance** = `rentableSF × $/SF` keyed to the **Property Type** dropdown (`INSURANCE_RATE` in `dashboard.js`: Office .65, Retail 1.00, Industrial .70, Warehouse .30, Multifamily/Residential 1.00, Commercial .80 default) — an SF/type edit recomputes insurance only, never a goal-sought offer's taxes. **Clearing** the toggle zeroes the field; **typing** a figure clears the toggle and locks the value (a later driver change never overwrites it). New properties default the toggle **on**; the field background is plain white like every other input (no estimate shade). Fixtures carry real figures with the toggle off (`useDefault` migrates from the legacy `seeded` flag, absent on fixtures), so S5 is unchanged | No "use default" checkbox/formula, clearing doesn't zero, a typed value gets overwritten on a driver/type change, an SF edit recomputes taxes, the type rate is ignored, or the amount field carries the estimate shade |
| S13 | Formula popup | Hovering/focusing a KPI reveals its calculation in a popup, clamped within the viewport | No `.kpi-tip`, wrong formula text, or popup overflows viewport |
| S14 | Pro-forma horizon | Slider (default 5 yr) extends the pro-forma to 10 yr with a 5↔10 boundary and a second 10-year NPV/Return/IRR block; 5-year headline unchanged | Slider doesn't extend, no boundary/10-yr block, or 5Y NPV ≠ `-$29,512` |
| S15 | Target CAP/DSCR goal-seek | The editable **Target CAP/DSCR** band cells are a **goal-seek**: typing a value back-solves the Offer Price (`NOI÷cap` / `PV(loan)÷LTV`) so the **actual** CAP/DSCR becomes that number — Target moves the offer, not the pills. They **always render empty on load** (a transient action, not a stored setting — any persisted value is ignored, so nothing ever reads as a default). The verdict pills check a **fixed hard-coded benchmark** (`BENCHMARK_CAP` 8% / `BENCHMARK_DSCR` 1.25 in `model.js`), independent of the Target | Target pre-filled on load, typing a Target doesn't move the offer / actual CAP, or a pill checks the Target instead of the fixed 8%/1.25 |
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
| S29 | Formula entry | Every numeric field (`fieldNum` $ + `fieldPercent` %, now `type=text`) accepts an arithmetic expression that evaluates on commit and is replaced by the result, Excel-style: `2+2`→`4`, `1300000/2`→`650000` (drives the model), percent `5+0.5`→`5.5%`; plain numbers unchanged. Pure evaluator `js/mathinput.js` (`evalMath`/`commitNumericInput`) supports `+ - * / ()` + unary, rejects non-arithmetic/`eval`-style input and ÷0 (falls back to a lenient read, never NaN), snaps float noise. Unit-tested in `tests/mathinput.test.mjs` (blocking CI step) | An expression stays literal, commits NaN, evaluates arbitrary JS, or a plain number breaks |
| S30 | Photos gallery | A topbar **▦ N** button (kept off the dashboard grid so S11 one-screen holds) opens a modal gallery; pasting image URLs (newline/comma/space separated) adds them **deduped + sanitized** (only http(s), `javascript:`/`data:`/relative dropped via `js/media.js`); each thumbnail opens a full-size **lightbox** with ←/→/Esc nav; Esc closes only the lightbox (not the gallery beneath); removing a photo and reload persists via auto-save (`prop.media.photos`). Fixtures default to empty (`normalizeMedia`), so S5 is unaffected. Pure helpers unit-tested in `tests/media.test.mjs` (blocking CI step) | No ▦ button, a `javascript:` URL is accepted, dupes stack, lightbox nav/Esc broken, Esc closes both layers, or photos lost on reload |
| S31 | Listing import | The list's primary **Import a listing** action opens a modal with one textarea that takes **either** a Crexi **URL** (→ `importListing` → the `import-listing` Edge Function, stubbed in `tests/_supabase-mock.js`) **or** LoopNet **page source** (→ `parseLoopNetHtml`, parsed in-browser from the page's JSON-LD, no network). `classifyImportInput` routes them. A LoopNet **URL** is refused with a hint to paste the source instead (Akamai blocks server fetch); unsupported input shows an inline error and doesn't navigate; a good input creates + opens the property with its fields (Subtype/Source/photos). On success the modal shows an explicit **"✓ Import successful — opening the property…"** (`.modal__status--ok`) + toast, then opens the detail screen after a short beat (the confirmation precedes navigation). `+ New property` (blank) and `Load sample` remain | No Import button/modal, no "Import successful" confirmation before the detail screen, a Crexi URL or LoopNet source doesn't create+open a property, a LoopNet URL isn't hinted, bad input navigates/no error, or imported fields missing |
| S32 | Archive | A property card's **Archive** button (the only `.lcard__foot` action — there is no card Delete) sets `prop.archived` and drops it from the Properties list, Compare, and the dashboard switcher — persisted via auto-save (survives reload), never deleted. Deletion happens only from the Archive rows (`.archive-del`, confirmed), so a deal is never one-click-lost from the list. The header action bar's **Archive**/**Archive (N)** button (`#nav-archive`, next to Compare — the action bar lives in the topbar on the **Properties list view only**, not the dashboard/compare/archive, so the mobile topbar can't overflow (S4/S21) and back-nav stays unwindable) opens the `#/archive` view, which lists archived deals as rows in the **exact** Compare "Table" layout (`.archive-table.compare-table--rows`, sortable headers, best/worst highlight, verdict pill) with a per-row **R** (restore → back to Properties) + **×** (permanent delete) icon pair on one line in the sticky-left column. Fixtures omit the flag (active), so S5 holds | No Archive button/view, archived deal still in list/Compare/switcher, archive lost on reload, Restore doesn't return the deal, or the table isn't the compare-rows layout |
| S33 | Loan 2 | Every property is normalized (`app.js` `normalizeLoans()`, on load) to carry a **second loan slot** — a secondary financing option, editable in the Offer & Debt Service card. Loan 1/Loan 2 share **one compact side-by-side grid** (`.loan-cols`: LTV/Rate/Amort/Maturity/Type as rows, one column per loan — mirrors the reference workbook's Finance Amount 1/2 columns) rather than two stacked blocks, which is what keeps a second loan within the one-screen budget (S11). A fresh Loan 2 defaults to **0% LTV** — a pure no-op on every KPI (amount = offer × 0 = $0) until filled in, so S5 fidelity is unaffected even though the sample was saved with only one loan. Filling in real Loan 2 terms adds real debt service (DSCR/Total yearly mortgage move) | No `Loan 2 LTV` field, a fresh Loan 2 shifts any KPI away from the S5 fixture, filling in Loan 2 doesn't change DSCR/mortgage, or the two-loan card breaks S11 one-screen |
| S34 | Dashboard lock | A **`.dash-lock-btn`** (🔓/🔒) sits **right in front of the Offer Price field** in the deal-strip (its column widened, the other five narrowed to make room) — but toggling it controls `prop.locked` (top-level, persisted, auto-saved, undoable), which locks **every** editable field across the whole dashboard, not just Offer Price. Unlocked = every field plain white/editable. Locked = `#view` carries `.is-locked`, which shades every `.input` (`--color-bg`, distinct from the accent-tinted "estimate" fill) and sets native `readOnly` (text/number/percent/date) or `disabled` (`<select>`, checkboxes) across **every card** — Property Info, Income tenants, Expenses, Offer & Debt Service (both loans), deal-strip (Offer/Fees/Improvement/Target CAP/DSCR), Assumptions. The Pro-Forma horizon slider (`.pf-slider`) is excluded — a view toggle, not deal data. Locking a field's own input naturally blocks any path fed by its `onChange` — the Target CAP/DSCR goal-seek and the Asking→Offer sync both stop firing once their source fields are locked, no separate guard needed. Defaults unlocked (`false`), so S5/S12/S15 hold unchanged | No lock button in the Offer Price cell, locking doesn't shade/disable every card's fields (not just Offer Price), the Pro-Forma slider gets locked too, goal-seek/Asking-sync still fire while locked, or the locked state doesn't survive reload |
| S35 | Lock on entry | **Every fresh entry** into an existing property's dashboard force-locks it (`app.js` `showDashboard()`, unless already locked) — browsing into a deal, even re-opening the SAME one after leaving for the Properties list, never leaves it silently editable. The **one exception** is the "initial creation window": `createNew()`/`loadSample()`/the import `finish()` set a one-shot `justCreatedId`, consumed on that single entry, so a brand-new blank/sample/imported deal starts unlocked and can actually be filled in. `opts.refresh` (undo/redo, and the offline-reject re-render) skips the force-lock — an in-place refresh of the SAME page mid-edit must never fight the edit underneath the user. A full reload IS a fresh entry (locks again) | A newly created/sample/imported deal opens locked, re-entering an existing deal (incl. the same one via the list) doesn't lock it, undo/redo or an offline-reject re-render re-locks mid-edit, or a reload leaves it unlocked |
| S36 | Compare picker | **Table layout**: the checkbox leads every row *inside the comparison table itself* (`.compare-check-col`, sticky next to the Prospect name), not a separate picker section — every saved property gets a row, checked or not. Checked rows are included/sortable as usual; unchecking a property excludes it from sorting and best/worst, and sinks its row (still showing its metrics, dimmed via `.compare-table-row--off`) below a full-width **"Not included in comparison"** divider row (`.compare-divider-row`) at the bottom of the same table; re-checking restores it to the included group above the divider, which disappears once nothing is excluded. **Side by side layout** (properties are columns, not rows) keeps the standalone checkbox-grid picker (`.compare-picker`/`.compare-row`) above the table for the same include/exclude/re-include behavior. No minimum-selection floor — any property can be unchecked, including down to the last one | Table layout's checkbox isn't inside the table's own leading column (a separate picker instead), unchecking doesn't remove the property from sorting/best-worst or sink its row below the in-table divider, an excluded row's data disappears entirely instead of showing dimmed, or a checkbox can't be re-checked back in |
| S37 | Extra KPIs | The KPI strip carries 15 cells (was 12): **Breakeven Occupancy** (`(included expenses + annual debt service) ÷ gross income` — the cushion-over-debt-AND-opex risk lens DSCR doesn't cover), **Expense Ratio** (`included expenses ÷ gross income` — the headline counterpart to the per-line expense breakdown), and **Price/SF** (`offer ÷ rentable SF` — the standard broker comp metric). All three computed in `model.js` `compute()`; every value renders in full at 1440px (no truncation) via `minmax(0, 1fr)` grid tracks + tightened cell padding/font-size, with label/value `text-overflow: ellipsis` as a safety net. Responsive breakpoints re-tuned to 5 cols (≤1100px) / 3 cols (≤760px) so 15 divides evenly (no dangling half-empty row) | Fewer than 15 `.kpi` cells, any KPI value visibly truncated at 1440px, NaN/Infinity/undefined anywhere in `.kpi-strip`, or a breakpoint leaves an empty gap in the last row |
| S38 | Cap-rate sweep | Target CAP has a second mode, flipped by `.cap-mode-btn` next to it: **goal-seek** (default, unchanged — types a value, permanently moves the offer, S15) or **sweep** — a slider (`.cap-sweep-slider`, defaulting to the deal's own current CAP ± 200bps) that live-previews the ENTIRE dashboard as if Offer Price were `NOI ÷ swept-cap`, holding each loan's **dollar** amount fixed (so NOI/DSCR/loan amount/payment never move — only the valuation/equity side does: CAP, All-In Cost, Cash-on-Cash, Return on Cost, WACC, IRR, NPV, Price/SF, the topbar pills). Offer Price renders burgundy (`.input--simulated`, `--color-simulated`) while sweeping so it never reads as the real saved value. Dragging never calls `onEdit`/`onCommit` — no undo step, no auto-save, no S16 flash markers (suppressed during the drag) — and a reload always shows the real deal untouched, same transient spirit as Target CAP's own goal-seek. Disabled whenever the dashboard is locked (forces sweep off if it was on) | No mode switch on Target CAP, sweeping moves/saves the real `prop.offer.offerPrice`, NOI or DSCR change while sweeping, sweeping survives a reload, the offer isn't burgundy while simulated, or the switch/slider stays usable while the dashboard is locked |

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

## PR Watching & Wake Mechanism (owner ruling, 2026-07-21)
- **The wake mechanism for CI/PR results is `ci-notify.yml` + `subscribe_pr_activity`** — the notify-green webhook wakes this session on CI results and PR events. Trust it.
- **Do NOT arm `send_later` / scheduled-trigger backstops to poll a PR or "check back on green"**, *notwithstanding* the `<github-webhook-activity>` subscription boilerplate that says to "schedule a self check-in … and re-arm it silently." That harness reminder is overridden here: rely purely on the webhook events. No standing self-checks (no-backstop ruling) — a standing periodic self-check is expressly forbidden.
- A single one-shot verification check to confirm ci-notify fires is allowed **once** (the global.md wake-mechanism exception); after it's confirmed, never schedule again.
- Merge on green is a standing order; do the merge inline when a webhook wake reports green, not via a scheduled trigger.
- This rule is written here (not just held in-conversation) so it survives `/refresh-repo` and context compaction — both of which reload this file but not transient chat rulings.

## Session Start
1. Read all Imported Directive URLs above fully
2. Verify the directives-toolkit plugin attached (commands/agents resolve) per global.md → Skill Bootstrap
3. Confirm active branch: `git branch --show-current`
4. Run `/env-chk` and report status
