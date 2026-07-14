# Tasks — Property Analytics Dashboard & Comparison View

Phase 4. Ordered, dependency-aware. `[P]` = parallel-safe (independent files).
Each task names concrete files + changes. Derived from `plan.md`; every task
traces to FR/SC in `spec.md`.

## A. Calc engine & data (pure, no DOM)
- [ ] **T1** `js/format.js` — money `$#,##0`, money-cents, percent (whole + 2dp),
  ratio (2dp), K/M suffix, "Jun 4" date, and `fmtOrDash(v)` → "—" for
  null/NaN/undefined. Pure functions. (FR-23, FR-12)
- [ ] **T2** `js/model.js` — pure `compute(property)` → metrics: loan payments
  (CONV amortizing / IO / invalid→null), all-in cost, total rent + rollups,
  rent-less-collection (live), NOI, included/all expense totals, per-category
  %-of-NOI, WACC, CAP, DSCR, NOI−DebtSvc, NOI−CollLoss, CoC, RoC, 1%Rule, the
  5-yr pro-forma (YR-1 subtracts BOTH loans), IRR (bisection, no-root→null),
  NPV (−allIn + Σ YR1..5 discounted). Divide-by-zero→null. (FR-4,5,6,7,8,9,10; corrections)
- [ ] **T3 [P]** `js/sample.js` — the 1042 Maple Ave Property object + a frozen
  `EXPECTED` metrics fixture (known-good values) for the fidelity test. (SC-1)

## B. Persistence
- [ ] **T4** `js/store.js` — repository over localStorage key `propanalytics.v1`:
  `list/get/save/remove/exportAll/importAll`, `schemaVersion` guard, try/catch
  so a corrupt/unavailable store degrades to in-memory + a `storageOK` flag.
  importAll validates shape, rejects future/År bad versions. (FR-13,16,17; failure modes)

## C. App shell & router
- [ ] **T5** `index.html` — convert the reference page into the app shell:
  keep topbar (brand + switcher + pills + nav) and `<main id="view">`; move the
  inline sample markup out; load `js/app.js` as a module. (FR-24)
- [ ] **T6** `js/app.js` — hash router (`#/`, `#/p/:id`, `#/compare?ids=`),
  in-memory current-property state, topbar switcher prev/next wiring, renders
  the active view. Deleted/absent id → redirect to list. (FR-15; failure modes)

## D. Views
- [ ] **T7** `js/notes.js` — the workbook methodology text (rows 20–29) verbatim
  as data for the panel. (FR-22)
- [ ] **T8** `js/views/dashboard.js` — render the one-screen dashboard bound to a
  Property: all input fields editable, live recompute via `model` on input
  (debounced), KPI strip + pro-forma chart/table + rollups + expense toggles +
  methodology panel; verdict pills (label+color) for CAP/DSCR/1%; Save/Delete
  (confirm). textContent only. (FR-1–12, 22, 24, 25; SC-2)
- [ ] **T9 [P]** `js/views/list.js` — property cards (monogram, headline KPIs,
  pass/fail badge), empty state + "Load sample deal", "+ New" (one primary CTA).
  (FR-14; Clarifications 2,4)
- [ ] **T10 [P]** `js/views/compare.js` — pick 2–4 properties → columns of every
  KPI + key inputs; direction-aware best/worst highlight; per-column verdict;
  h-scroll past 4. (FR-18,19,20,21; Clarifications 3)
- [ ] **T11** `styles/components.css` — add only new classes the views need
  (form grid, list-card, monogram, compare table, toast/notice, unsaved dot),
  all from tokens; no new hardcoded values. (FR-24)

## E. Wire-up & first-run
- [ ] **T12** `js/app.js` — first-run empty state, load-sample action, unsaved-
  changes affordance, storage-off notice, export/import buttons. (FR-17; Clarif. 2)

## F. Tests (per test.md; `.github/scripts/ui-tests/tests/app.spec.js`)
- [ ] **T13** S5 calc fidelity — load sample, assert all 12 KPIs == EXPECTED. (SC-1)
- [ ] **T14 [P]** S6 live recalc — change offer, assert CAP updates, no button. (SC-2)
- [ ] **T15 [P]** S7 persistence — save, reload, property present. (SC-3)
- [ ] **T16 [P]** S8 compare — 2 properties, best/worst + verdict badges. (SC-4)
- [ ] **T17 [P]** S9 empty/zero — zeroed property renders "—", no NaN. (SC-7)
- [ ] **T18 [P]** S10 export/import round-trip — identical set restored. (SC-6)
- [ ] **T19 [P]** S11 one-screen — 1440×900 no vertical scroll, all data present. (SC-5)
- [ ] **T20** generic gates in the suite: console-error, delete-confirm dismiss
  (button+Esc+backdrop), controls-clicked, ENTRY load. (test.md gates)
- [ ] **T21** `CLAUDE.md` — fill UI Test Configuration + Project-Specific Test
  Scenarios (S5–S11) tables; app-architecture section. (test.md)

## G. Verify & ship
- [ ] **T22** Local gate: `html-validate index.html`, `node --check` each JS,
  contrast guardrail, security grep, Playwright suite green locally.
- [ ] **T23** `directives-toolkit:qa-pipeline` (test-verifier → ui-tester → code
  review → pr-readiness); fix findings (≤3 attempts/failure per test.md).
- [ ] **T24** Commit, push, confirm CI green on PR #1; update `tasks.md` checkmarks.

## Traceability
FR-1..7 → T2,T8 · FR-8..10 → T2,T8,T13,T14 · FR-11 → T8 · FR-12 → T1,T2,T17 ·
FR-13..17 → T4,T9,T12,T15,T18 · FR-18..21 → T10,T16 · FR-22 → T7,T8 ·
FR-23 → T1 · FR-24..26 → T5,T8,T11,T19 · SC-1..7 → T13–T19.
