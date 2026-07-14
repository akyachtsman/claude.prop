# Plan — Property Analytics Dashboard & Comparison View

Phase 3 (plan). HOW. Reads `spec.md` (+ Clarifications), `workbook-model.md`,
`design.md`. Honors the constitution: plain HTML/CSS/JS, **no local build**
(`global.md`); the approved Banker Navy contract (`design.md`); local-first now,
Supabase-swappable later (`data.md`, owner decision).

## Stack & constraints
- **Plain HTML + CSS + vanilla JS, ES modules** (`<script type="module">`) —
  no bundler, no framework, no build. Served from GitHub Pages as-is. iPad
  Safari supports ES modules.
- **One entry page (`index.html`)** hosting a small client-side view router;
  no per-view page reloads (needed for the prev/next switcher and live state).
- All styling via `styles/tokens.css` + `styles/components.css` — no new
  hardcoded colors/sizes; new components are added to `components.css`.
- Dynamic text via `textContent` only (`global.md`); numbers/dates via the
  formatter (never raw `toLocaleString` scattered around).

## Architecture — modules (each a testable unit)
```
index.html            ← app shell: topbar + <main id="view">; loads js/app.js
js/
  model.js            ← PURE calc engine. Input: a Property object.
                        Output: a Metrics object (all 12 KPIs + pro-forma +
                        rollups). No DOM, no storage, no globals — unit-testable.
  store.js            ← persistence repository behind an interface:
                        list/get/save/remove/exportAll/importAll. v1 impl =
                        localStorage (key "propanalytics.v1"). Supabase impl
                        drops in behind the same interface later.
  format.js           ← money/percent/ratio/date/no-data formatting per
                        design.md editorial rules. Single source of truth.
  views/
    list.js           ← property list (cards + KPIs + pass/fail badge, empty
                        state with "Load sample deal").
    dashboard.js      ← the one-screen dashboard (the approved reference page,
                        now data-bound + editable, live recalculation). Owns
                        the methodology panel (FR-22) rendered from notes.js
                        into the existing .notes details/summary component, and
                        renders CAP/DSCR/1%-rule verdicts as a text pass/fail
                        pill AND --pass/--fail color — never color alone (FR-11).
    compare.js        ← side-by-side comparison (up to 4 cols then h-scroll).
                        Best/worst highlighting is DIRECTION-AWARE: higher-is-
                        better for CAP, DSCR, CoC, IRR, NPV, total return, RoC;
                        lower-is-better for cost-oriented rows; null/no-data
                        sinks to neutral and is never marked best/worst (FR-19).
                        Each column shows its pass/fail-vs-targets verdict (FR-21).
  notes.js            ← the workbook methodology text (rows 20–29) verbatim,
                        from workbook-verbatim.md (FR-22).
  app.js              ← hash router (#/, #/p/:id, #/compare?ids=), wires views
                        to store + model, owns the topbar switcher.
  sample.js           ← the 1042 Maple Ave fixture (seed for "load sample").
```

## Data shape (the Property object — the persisted unit)
One flat, versioned object; **only inputs are stored**, never computed values
(so metrics can never go stale):
```
{
  id, schemaVersion: 1, name, createdAt, updatedAt,
  info:   { askingPrice, rentableSF, lotSize, yearBuilt, zoning, hvacAge,
            roofAge, parking, ceilingHeight, appraisedValue, apn, bedrooms, baths },
  targets:{ desiredCap, desiredDscr },
  offer:  { offerPrice, fees, improvements },
  loans:  [ { ltv, rate, termYears, type }, { ltv, rate, termYears, type } ],
  tenants:[ { name, sf, monthlyIncome, leaseExpires, leaseOptions }, … up to 4 ],
  expenses:[ { key, label, amount, included, estimated } … 9 fixed categories ],
  assumptions:{ minOppCostEquity, taxRate, collectionLoss, cashflowAppr, capitalAppr }
}
```
`model.js` derives everything else. Free-form text fields (lotSize, parking,
etc.) stay strings, matching the workbook.

## Calc engine (`model.js`) — the fidelity core
Pure functions mirroring `workbook-model.md`, with the two owner-approved
corrections (`spec.md` Clarifications 1) baked in:
- Loan payment: CONV = amortizing `PMT`; IO = `principal × rate/12`; invalid
  type → `null` surfaced as an error, never a wrong number (FR-4a).
- Loan 2 computes from its **own** amount/rate/term (FR-4b).
- Collection loss is live: `rentLessCollection = totalRent × (1 − collLoss)`.
- **YR-1 cashflow subtracts BOTH loans** (correction a).
- **NPV = −allInCost + Σ(t=1..5) CFₜ/(1+WACC)ᵗ** (correction b).
- IRR via bisection on `[−allInCost, CF₁..CF₅]`; **no real root → null → "—"**
  (FR-12, Clarifications 5).
- Every ratio guards divide-by-zero → `null` → "—" (FR-12).
Returns a `Metrics` object; the fixture in `sample.js` has known-good values
that the Playwright spec asserts against (SC-1).

## Data flow
```
input change (dashboard field)
  → app.js updates the in-memory Property (debounced)
  → model.compute(property) → Metrics
  → view re-renders KPI strip + pro-forma + rollups (textContent)
  → on explicit Save: store.save(property) → localStorage
list / compare views: store.list() → model.compute each → render
```
Live recalculation is compute-on-render (metrics never persisted). Save is
explicit so editing is non-destructive until committed (FR-13/16).

## Key decisions & trade-offs
| Decision | Choice | Why / trade-off |
|---|---|---|
| App shape | one page + hash router | switcher & live state need shared in-memory state; avoids reload fl; trade-off: a little routing code vs multi-page simplicity |
| Metrics storage | never stored, always derived | can't go stale; trade-off: recompute each render (trivial cost at this scale) |
| Persistence | localStorage behind a repo interface | zero backend, instant, private; Supabase swaps in behind same interface (data.md); trade-off: per-device until then (NG-1) |
| Calc testing | Playwright fixture assertions | no build/test-runner in a browser-only project; the sample deal's known values gate SC-1 |
| Edit model | explicit Save, live preview | matches investor mental model; trade-off: must handle unsaved-changes affordance |
| Compare width | 4 columns then h-scroll | Clarifications 3; column layout reuses dashboard tokens |

## Failure modes & handling
- **Empty / zero inputs** → `null` metrics render as "—", never NaN/#DIV/0!
  (FR-12, SC-7). Explicitly: zero offer, zero rent, zero debt (DSCR), zero NOI
  (% of NOI), zero SF (rent/SF, avg).
- **IRR no real root** (all-positive or all-negative series) → "—" + tooltip.
- **Invalid loan type** → inline field error; payment shows "—".
- **localStorage unavailable / quota / corrupt JSON** → app still runs from
  in-memory state; a non-blocking notice explains saving is off; import
  validates shape and rejects bad files with a clear message (not a silent
  wipe).
- **Import of a future schemaVersion** → refuse with a message rather than
  mis-parse.
- **Deep-link to a deleted/absent property id** → redirect to list with a note.
- **Script throws on load** → caught by the console-error UI gate (test.md);
  inline module scripts run after DOM (design.md → Script loading).

## Testing (per test.md)
- **`app.spec.js` additions** in `.github/scripts/ui-tests/tests/` (numbered
  from S5 per the CLAUDE.md test-scenarios table, which this plan will fill in):
  - **S5 calc fidelity** — load sample, assert all 12 KPIs equal the fixture
    values (SC-1).
  - **S6 live recalc** — change an input, assert a dependent KPI updates with
    no calculate button (SC-2).
  - **S7 persistence** — save, reload, assert the property survives (SC-3).
  - **S8 compare** — compare 2 properties, assert direction-aware best/worst
    highlight AND each column's pass/fail verdict badge (SC-4, FR-19, FR-21).
  - **S9 empty/zero** — a zeroed property renders "—", never NaN (SC-7).
  - **S10 export/import round-trip** — export, clear, re-import; assert the
    property set is identical (SC-6).
  - **S11 one-screen** — load the dashboard at 1440×900; assert no vertical
    scroll (`scrollingElement.scrollHeight <= innerHeight`) and that all
    workbook data points are present (SC-5).
  - plus the generic gates: console-error, dismissers (delete confirm, any
    modal), controls-clicked, ENTRY load gate.
- Local `UI Tests` job is non-blocking (no backend needed here anyway — all
  client-side, so it can actually pass); **Static Checks blocking**.
- No auth gate in v1 → `qa-live.yml` runs the same suite against Pages.

## Constitution check
- `global.md`: plain HTML/JS, no build ✓; `textContent` ✓; evidence via the
  fixture spec ✓. `design.md`: reuses tokens/components, one-screen dashboard,
  iPad/WCAG/reduced-motion ✓; tables use `makeSortable` where sortable (list).
  `data.md`: no backend in v1; when Supabase lands, RLS + anon key + the repo
  interface, no service key client-side ✓. `test.md`: UI gates honored ✓.
- No requirement in `spec.md` is exceeded; nothing in `plan.md` adds scope.

## Out of scope (from spec non-goals) — not built
Backend/sync, listing/comps import, PDF/share link, sensitivity/scenario tools,
auth, >4 tenants / >2 loans.
