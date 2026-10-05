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
  back-navigation strictly unwindable — proven by the project's own **NAV back-flow**
  scenario, not by the generic `app.spec.js` NAV invariant, which SKIPS here).
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
- **Deliberate deviation from `design.md` → Number & Data Formatting's whole-number
  percentages.** `format.js` keeps `percent()` (whole, the directive default) but headline
  rates render through `percent2()` at two decimals, because a CAP of 5.13% and one of 5%
  are different deals and the S5 fidelity fixture is stated to the cent. The deviation is
  confined to rate readouts; every other percentage uses the whole-number form.
- Any change to the financial model must keep `js/sample.js` `EXPECTED` in sync
  and pass the S5 fidelity test.
- **No root-absolute paths** in app source or test specs — Pages serves this
  project under `/claude.prop/`, so a leading slash points at the domain root.
  Use an app-relative URL (`new URL('js/store.js', document.baseURI).href`).
  `qa.yml`'s **"No root-absolute paths"** step in `static-checks` enforces this;
  it is a **deliberate local customization** of the upstream `qa.yml` template —
  `/refresh-repo` must preserve it, not treat it as drift to overwrite.
  **Known limit:** a path assembled from a bare slash (`fetch('/' + p)`) is not
  detected — matching a standalone `'/'` would flag every legitimate one
  (`split('/')`, path joins). Closing it needs syntax-aware scanning, not a
  regex. Reviewers should still catch that form by eye.

- **`check-contrast.js` carries FOUR deliberate local pairs**, each marked
  `// PROJECT-SPECIFIC` in the file — `/refresh-repo` must diff them, not revert them.
  Grep that marker rather than trusting this list; the file is authoritative.
  1. **`accent / surface` at the normal-text floor (4.5), not upstream's 3.0, plus
     `accent / bg`** — `--color-accent` is a SMALL-text colour here in eight places
     (`.authgate__brand`, `.authgate__status--ok`, `.authgate__link`,
     `.modal__status--ok`, `.photos-btn:hover`, `.archive-restore:hover`,
     `.th-sort__caret`, `.link-open`) at 13px/12px, neither of which is WCAG large text.
  2. **`on-navy / accent`** — `--color-on-accent` is not the only foreground over
     accent: `.switcher__btn` and `.topbar__action` keep `--color-on-navy` while
     their hover fill becomes `--color-accent`.
  3. **`accent-hover / accent-light`** — the NOI chip (`.rt-chip--noi`, rendered at
     `dashboard.js:482`). Found by DERIVING pairs from `components.css` (every rule
     declaring both a `color:` and a `background:` from tokens), not by enumerating:
     it was shipping 4.32:1 at 11px bold and no hand-written pair described it.
  4. **`on-danger / danger`** — the gallery delete glyph on its hover fill. This app
     never renders `--color-danger` as a foreground, which is what upstream checks.

  **Two edits this file previously listed are GONE and must not be re-added:** the
  alpha-channel rejection (upstream adopted a better version, exempting fully-opaque
  `FF`/`F`), and a pair naming the `#FFFFFF` literal — `.gallery__del` now uses
  `var(--color-on-danger)`, so the pair scores by name at 6.01 with no exception.

  **Re-run the derivation in (3) whenever `components.css` gains a new fg/bg
  pairing.** Its limit: it only sees rules declaring BOTH a `color:` and a
  `background:`, so text that sets a colour and inherits its background — all eight
  in (1) — is invisible to it. Deriving beats enumerating; neither is a proof.
- **`ui-suite/action.yml` cites `check-ui-suite-env.py` nine times as enforcing step
  adjacency and exact env parity — and that script does not run here.** It is real but
  lives at upstream's `.github/scripts/`, outside `templates/`, so upstream's CI guards
  upstream's copy of the template and **nothing guards this one**. Not a live breakage
  (the composite is verbatim upstream), but the comments promise an editor a mechanical
  catch they will not get: insert a step between the Playwright run and a viewport gate,
  or add an env var to only one of them, and every local check stays green.
  **So run it by hand when touching the composite or the kit** — it takes the target as
  `argv[1]` and the spec files as `argv[2:]`, so it works against this tree unmodified:
  `python3 check-ui-suite-env.py .github/actions/ui-suite/action.yml <kit .js files>`.
  Doing that on 2026-10-05 found a true finding no gate here can see: `PW_EXECUTABLE` is
  read by `playwright.config.js:38` and the composite's run step never sets it. Resolve
  that through the guard's **`ENV_EXEMPT`**, never an input — it is a local-sandbox hatch
  from the developer's own shell, and letting CI pin the browser executable would invert
  *supply the missing thing, never lower the bar*. CI leaving it unset is correct.
  Deliberately **not** forked in: without its case suite it is the guard nobody
  exercises, and with it, ~1,500 lines for every refresh to diff. Handed upstream.

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
| Valid test credential | **LEAVE BOTH UNSET.** Redundant with `auth.spec.js` S23–S28, which exercise the real gate (only the backend stubbed, no credentials), and costly — live Supabase sign-ins would put real auth traffic in a *blocking* job. ⚠️ **Setting one now makes CI FAIL, re-measured 2026-10-05:** `installSignedIn` leaves no gate on screen, and upstream's discriminating guard turns "credentials configured but no gate" into a hard error. So a red S2 right after someone sets a secret means the secret IS the cause. (The 2026-08-26 note claiming a *vacuous pass* here was true of the older kit and is now inverted.) ⚠️ `TEST_AUTH_EMAIL` would not be a secret even if set — it is typed into a *visible* input, so failure screenshots record it where log masking cannot reach. Never write either value in this file. |
| Invalid test credential | _n/a — the suite never asserts a rejected login_ |
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
⚠️ **`property.spec.js` and `auth.spec.js` each set `test.use({ viewport: 1440×900 })` at
FILE scope, which replaces the width in EVERY project — not only the desktop one.** Verified:
S11 ("fits 1440×900, no vertical scroll") passes under `--project=mobile-chrome`, declared at
393×727. So both files push `{ type: 'viewport-override' }` from a `beforeEach`, as
`test.md` → *UI coverage gates* requires of any test that can end up at a width its project
did not declare; without it `check-ui-viewports.js` counts 44 of the 52 results per project
toward a band they never rendered at. The hook form is deliberate — a scenario added later
inherits the marker instead of having to remember it. Do not remove it without also
restricting these files to a single project.
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
| S15 | Target CAP/DSCR goal-seek | The editable **Target CAP/DSCR** band cells are a **goal-seek**: typing a value (or, per S38, dragging its paired slider to release) back-solves the Offer Price (`NOI÷cap` / `PV(loan)÷LTV`) so the **actual** CAP/DSCR becomes that number and **permanently, saved** — Target moves the offer, not the pills. The field is a **live readout of the deal's own actual CAP/DSCR**, not a separately stored setting — it always shows whatever the current actual value is (recomputed on every render, never a persisted "target" distinct from that), so it tracks any edit that moves the real CAP/DSCR, including ones made elsewhere. The verdict pills check a **fixed hard-coded benchmark** (`BENCHMARK_CAP` 8% / `BENCHMARK_DSCR` 1.25 in `model.js`), independent of the Target | Target field doesn't reflect the deal's real current CAP/DSCR on load, typing a Target doesn't move the offer / actual CAP, a pill checks the Target instead of the fixed 8%/1.25, or a committed Target doesn't survive a reload |
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
| S38 | Target CAP/DSCR sliders | Target CAP and Target DSCR share one combined, double-wide deal-cell (`.deal-cell--target-combo`), stacked one row above the other (`.target-row`) instead of two separate side-by-side cells. Each row is a **slider** (`.target-sweep-slider`, fixed range — CAP **5%–20%** at 0.05% steps, DSCR **1–5** at 0.01 steps) plus a **directly-editable readout field** at the right end (a plain `fieldPercent`/`fieldNum`, same Excel-style formula entry as every other numeric field) — no mode switch, no separate preview state. Both controls always show the deal's **live actual** CAP/DSCR (recomputed every render — not a separately stored target) and both **permanently commit** the same way: the slider fires its back-solve on `change` (release, one undo step per drag — not `input`, which would fire continuously mid-drag), the field on blur/Enter, and either one calls the same `goalSeekOffer` as S15's typed goal-seek (`solveOfferForTarget`, shared). The readout text still updates live on every `input` tick while dragging (so the number visibly tracks the handle instead of freezing until release) — that part is a cheap local re-format of the slider's own position, not a commit. No more ephemeral/"what-if" preview mode or simulated-offer styling — every interaction is a real, saved edit. Both disabled whenever the dashboard is locked, same as any other field | Target CAP/DSCR aren't stacked in one combined cell, the slider's range/step is off, the readout doesn't reflect the deal's actual current value on load, the readout freezes until release instead of tracking the drag live, dragging the slider doesn't permanently move the offer on release (or commits on every `input` tick instead of once on release), a committed value doesn't survive a reload, or the field/slider stay editable while the dashboard is locked |
| S39 | NAV back-flow | Every drill-down returns to Properties and the path strictly unwinds, and the page just left is GONE after each. ⚠️ **Compare and Archive each render their back button from TWO independent branches chosen by how much data exists**, so the test's property counts are load-bearing: `compare.js:62` (the `<2` "needs 2+" empty state) **and** `:251` (populated table); `archive.js:19` (empty) **and** `:112` (populated) — plus the dashboard's static `#nav-properties`. Covering only the populated Compare and the empty Archive, as the first version did, left the other two branches able to regress green (Codex, #116). Exists because the generic `NAV` SKIPS here (it needs a multi-level drill-in) while `test.md` still requires a back-flow test for every back affordance | A back control doesn't return to the list, the page just left is still rendered after it, or a data state is changed so one of the four branches stops being exercised |
| S40 | DISMISS (project overlays) | **All five** overlays close by **all three** paths — close control, Escape, and a backdrop click at the overlay's own corner. Four in `property.spec.js` (photo gallery, lightbox, **Listing details**, Import); the fifth, the first-sign-in **account** prompt, in `auth.spec.js`, because `installSignedIn` suppresses the reconcile in `property.spec.js` so it cannot render there — and that prompt is once-per-account (`propanalytics.reconciled.<uid>`), so its init script clears that key on every navigation or a three-path loop would assert against nothing. The gallery must SURVIVE every lightbox dismissal (the upper layer owns the key). The fixture photo URL is stubbed to a real 1×1 PNG so the gallery renders an actual image and the console gate isn't tripped by `ERR_TUNNEL_CONNECTION_FAILED`. ⚠️ **The generic `DISMISS` cannot substitute for any of this and its green says nothing about it** — its CLOSE selector misses the `Done`/`Not now` buttons these modals use, and its backdrop selector (`.backdrop`, `.modal-backdrop`, `.overlay-backdrop`, `[data-backdrop]`) matches **nothing** in this app, whose only backdrop class is `.modal__overlay` (Codex, #116) | Any overlay survives one of its three dismissal paths, a lightbox dismissal also closes the gallery, an overlay is added without a row here, or the image stub is removed and the console gate fires |
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
`token`/`recover` specifics LAST — Playwright's last-registered route wins).

**The generic `S2` skips BY DESIGN — the skip is correct, and setting
`TEST_AUTH_CREDENTIAL`/`TEST_AUTH_EMAIL` makes the signal worse, not better.** It is
structurally redundant with S23–S28, which exercise the *real* gate (only the backend is
stubbed) without credentials. **Desktop skips, re-verified 2026-10-05 (3 skipped / 49
passed): `S2`, `NAV` and `ENTRY`.** NAV needs a multi-level drill-in (this app is one
level with three branches — S39 proves the unwinding property instead); ENTRY needs extra
`APP_PAGES`. Both structural, neither about auth. **S3 and S4 do NOT skip** — no
credential guard, so they run unconditionally with the auth step a no-op.

Do **not** add a local `expect(mechanism).not.toBe('none')` guard: the upstream kit
already carries one that discriminates (gate absent **with** credentials → fail naming
the contradiction; **without** → a visible skip), so a local copy would fork the kit to
get something worse. Worth carrying generally: an auth scenario goes vacuous two ways —
never *reaching* the gate (a public landing route), or being *mocked past* it (this repo's
file-wide `installSignedIn`). Same symptom, different cause.

The store layer (backend swap, offline choke-point, first-sign-in upload/dedup) is
covered by Node unit tests in `tests/*.test.mjs` (run `node --test
tests/store.test.mjs tests/reconcile.test.mjs`; also a blocking CI step in
`qa.yml`). RLS isolation + authenticated-role upsert are proven at the DB via the
Supabase MCP (impersonated, rolled-back). The password-reset email round-trip is
verified **manually** (owner must set Auth Site URL + Redirect URLs to the Pages
URL and `http://localhost:8099`).

## Sandbox Limits (measured 2026-10-05 — re-derive, don't trust past its expiry)
`test.md` → *Sandboxed local runs* requires each project to record what it cannot
run in an agent sandbox, **with the causes and what would make this wrong**.

Two of the four Playwright projects are **webkit** (`tablet` = iPad gen 7,
`iphone` = iPhone 12); the other two are chromium. Measure per project — a
`--project=desktop` run alone overstates what runs here.
| Project | Band | Runs here? |
|---|---|---|
| `desktop` (chromium) | laptop | **Yes** — 49 passed / 3 skipped |
| `mobile-chrome` (chromium) | phone | **Yes** — 49 passed / 3 skipped |
| `tablet` (webkit) | tablet | **No** — `browserType.launch` fails, 52/52 |
| `iphone` (webkit) | phone | **No** — same cause |
| Unit tests, all static guards | — | **Yes** — no network |
| Live-URL run (any project) | — | **No** — `page.goto` gets `ERR_CONNECTION_RESET` on the Pages URL while `curl` gets **200** on it seconds apart. Browser-only, not a host outage |

**Why webkit fails, and why "absent" was the wrong diagnosis.** `npx playwright
install webkit` **succeeds** — `webkit-2359` lands in `/opt/pw-browsers` and the
command **exits 0** — while printing a `validateDependenciesLinux` error. The
binary is there; its OS libraries are not, and `install-deps` needs root apt.
This is `test.md` → *grade on whether a thing WORKS, not a cheaper stand-in*,
hitting both of its named traps at once: **a present binary is not a browser that
launches, and an install that exits 0 is not a browser that launches.** Measured,
not inferred — the 52 failures are all `browserType.launch`.

**What `check-ui-viewports.js` actually establishes — read its green narrowly.** Its
verdict is **SCHEDULED**: a band counts when a project declaring that width has a
**non-skipped** result, and `failed`/`timedOut`/`interrupted` all qualify. So webkit's
launch failures here are 52 *failed* results that SATISFY the tablet band, and the gate
**exits 0** on them (measured: a synthetic report with only `failed` tablet results
returns `GATE EXIT=0`). It is NOT an executed-coverage gate and never says a page
rendered. The stronger **RENDERED** disposition needs the render witness, which a test
that never launched cannot produce — and RENDERED never changes the exit code. **Never
read this gate's green as "all three bands rendered", locally or in CI**; the suite's own
pass/fail is what says webkit ran. Locally use `--project=desktop` and
`--project=mobile-chrome`; CI installs webkit with deps and arbitrates that band.

**Why the chromium projects run at all:** this app has **no runtime CDN import**.
`js/supabase.js:11` loads the client from `./vendor/supabase-js.js` (720KB, zero
`esm.sh` references), and there are **zero** remote imports in `js/` or
`index.html` outside `vendor/`. `esm.sh` is blocked here (`000`) while
`raw.githubusercontent.com` returns `200` — the block is **selective**, so "no
network" is the wrong model. A project that imports its client from a CDN at
runtime gets a page that serves 200 with an app that never boots
(`claude.insurance`, 26 of 36 local failures, CI 0 failed). Vendoring is what
makes local runs meaningful here; it is not luck.

**The remedy for the live-URL limit — supply the missing thing, never lower the
bar:** `python3 -m http.server 8099` and `APP_URL=http://127.0.0.1:8099/`, every
assertion intact against the same built tree. Never relax an assertion, add a
retry, skip a case, disable TLS verification, or unset `HTTPS_PROXY` to make a
sandbox run green. For the browser path, `global.md` → *Network Access Playbook*
rung 6 governs; use `PW_EXECUTABLE=/opt/pw-browsers/chromium` (a **symlink** — do
not append a subpath, and prefer it to the versioned `chromium-<n>` directory,
which moves on every browser bump). **Do not pass `--reporter=line` when the JSON
report is needed**: a CLI reporter *replaces* the config's list, so the json
reporter never writes and the #348 gate has nothing to read.

**What would make this wrong:** webkit's OS deps becoming present (the two webkit
rows would flip); adding any runtime CDN import to app source; the egress
allowlist changing; a browser bump changing `/opt/pw-browsers/` layout; or the
Pages URL becoming browser-reachable. Re-measure rather than trusting this table
— and a local failure is not evidence about the suite until CI has ruled on the
same commit.

**KD-1 (UI-test kit defects list):** `CLEAR` as of 2026-10-05 — the kit carries
upstream's own guard shape at `app.spec.js` (`if (!s2Gated) { … if
(authConfigured) { throw …`). Nothing declined; `/refresh-repo` re-runs every
entry every time regardless.

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
- **Narrow exception — an outcome that NO subscription covers** (owner ruling relayed from `claude.directives`, 2026-08-23; adopt `git.md`): a PR subscription covers that PR and nothing else. **A `workflow_dispatch` run with no matching open PR**, a Pages deploy, or **a live gate on `main` after a merge** is reported by no webhook — `ci-notify.yml` fires only on success *and* only comments on an open PR for the head SHA. It *does* fall back to matching a dispatched run to an open PR **by branch**, so a dispatch onto a PR branch is already covered and must not get a check-in. It says so in its own code ("No open PR … nothing to notify", "silence here is an answer, not a miss"). For those, arm **ONE** check-in named for the specific outcome and drop it the moment that outcome lands. This is not a rhythm and not a poll: the ruling above still forbids standing periodic self-checks, and still forbids check-ins on a PR, which the webhook does cover. The gap is real — a red `qa-live` on `main` reopened #2 for hours with nothing able to wake this session.
- Merge on green is a standing order; do the merge inline when a webhook wake reports green, not via a scheduled trigger.
- This rule is written here (not just held in-conversation) so it survives `/refresh-repo` and context compaction — both of which reload this file but not transient chat rulings.

## Session Start
1. Read all Imported Directive URLs above fully
2. Verify the directives-toolkit plugin attached (commands/agents resolve) per global.md → Skill Bootstrap
3. Confirm active branch: `git branch --show-current`
4. Run `/env-chk` and report status
