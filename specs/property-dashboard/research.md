# Competitive Research Synthesis — Property Dashboard & Comparison View

Date: 2026-07-14. Eight parallel teardowns of the leading property-analysis
products; full per-product reports live in `research/` (cited below as
[dealcheck], [mashvisor], [zilculator], [biggerpockets], [stessa], [propstream],
[roofstock], [realdata]). The owner's workbook
(`workbook-model.md`) **leads**; this research supports it — it sets the
interaction patterns and the polish bar, never replaces the model.

## 1. Comparison matrix

| Product | Underwriting depth | IRR | NPV | DSCR | WACC | Multi-property compare | Signature strength | Fatal gap for our use case |
|---|---|---|---|---|---|---|---|---|
| DealCheck | High (investor-grade) | ✓ | — | ✓ | — | Flat side-by-side table (called weak by users) | Import-first flow, 35-yr exit table, no-login shareable reports | No NPV/WACC; no scenario versioning |
| Zilculator | High | ✓ | ✓ | ✓ | — | Best basic compare: green/red best-worst per metric | Triangulated exit value, NPV-swept optimal hold, year-scheduled expenses | Generic working UI; analysis = property (clones pollute list) |
| BiggerPockets | Medium | ✓ | — | — | — | None (top user complaint) | Slider live-recompute, "profit if sold in year N" table, education-led | Hard account wall; 5-use meter; simplistic engine |
| Mashvisor | Low-medium | — | — | — | — | Watchlist + export only | Prefilled defaults (never a blank form), 1-click scenario flip, live recalc | No IRR/NPV/DSCR/exit modeling at all |
| Stessa | N/A (backward-looking) | — | — | — | — | Portfolio rollup, no compare | One card system at two altitudes; published metric formulas | Zero forward-looking underwriting |
| PropStream | Low-medium | — | — | — | — | None; one property at a time | Auto-run with sane defaults; color-coded data provenance; tiered input complexity | Analytics serve lead-gen, not underwriting |
| Roofstock (marketplace era) | Medium | — | — | — | — | None (sort/favorites only) | KPIs on cards; edit-assumptions panel with live recalc; return decomposition | Metric set stops at cap/CoC/total return |
| RealData REIA | Very high (lender-grade) | ✓ | ✓ | ✓ | — | Linked compare, common hold period, auto-refresh | 29-report library; Decision Maker sensitivity panel; before/after-tax duality | **Discontinued Apr 2026**; Excel-bound, no web |

**Category verdict:** No living retail product ships CAP + DSCR + NOI + IRR +
NPV + **WACC** together — the workbook's metric set is beyond every incumbent
(WACC appears in none of the eight). The only product that came close
(RealData) just exited the market. And a **true multi-property comparison
view is the single most-cited gap across the category** — absent or weak in
all eight. Our two planned surfaces sit precisely on the category's two
biggest holes.

## 2. Recommended starting version (v1)

Three surfaces, one calc engine, per the locked brief:

1. **Property list** — card grid; each card carries a photo/placeholder plus a
   KPI strip (CAP, DSCR, cash flow, CoC) and a pass/fail badge so triage happens
   at the grid level [roofstock]. Empty state invites the first property.
2. **Property detail dashboard** — the workbook model (`workbook-model.md`),
   modernized:
   - KPI strip up top as stat cards, color-coded, with explicit **pass/fail vs.
     the user's own Desired CAP\* / Desired DSCR\* targets** — the workbook
     already has these thresholds; DealCheck proves criteria-screening is the
     feature that turns a metrics dump into a decision [dealcheck].
   - Sections in workbook order: property info → financing/debt service →
     income (4 tenants) → expenses (9 toggles) → 5-year pro-forma → methodology
     notes. Two-column responsive; iPad-first per design.md.
   - **Live recalculation on every input, no Calculate button** — universal in
     the category [mashvisor][dealcheck][biggerpockets].
   - **Never a blank form**: new properties seed with the workbook's own
     defaults (70% LTV, 6.5%, 25yr, insurance = SF×1.25, taxes = price×1.2%)
     shown visibly as estimates the user refines [mashvisor][propstream].
   - 5-year pro-forma as table + chart (cashflow, appreciation, combined) with
     the YR5 equity-return step visible; notes block rendered as a collapsible
     methodology panel — publishing the formulas is a proven trust device
     [stessa][zilculator][realdata].
3. **Comparison view** — select 2+ properties → side-by-side columns of every
   KPI + key inputs, with **best/worst per metric auto-highlighted green/red**
   [zilculator], **linked live to the source analyses** (edits propagate; no
   snapshots) [realdata], sortable, and pass/fail rows against desired targets.

**Data layer:** localStorage behind a small repository interface
(list/get/save/delete + JSON export/import), Supabase-swappable later (locked
brief decision).

## 3. Richness / polish bar (the build is held to this)

- **Clarity of DealCheck, dashboard aesthetic of Stessa, metric depth beyond
  both.** "Approachable calculator" tone — clean cards, generous whitespace,
  clear hierarchy — not a spreadsheet grid and not a data terminal.
- Stat-card KPI strip with color semantics (pass/fail/neutral), consistent
  currency/percent formatting per design.md's editorial rules.
- At least two charts on the detail page (5-yr cashflow/appreciation series;
  expense breakdown) and per-metric delta highlighting in compare.
- Inputs feel like refining estimates, not data entry: sensible defaults,
  inline unit affixes ($, %, /mo), estimated values marked as such
  [mashvisor][roofstock].
- Every metric label opens/links to its definition (the workbook's own notes +
  short formula) — methodology transparency as product surface
  [dealcheck][zilculator][stessa][realdata].
- iPad Safari flawless (44px targets, no hover-only), WCAG AA via the contrast
  guardrail, `prefers-reduced-motion` honored — per design.md, non-negotiable.

## 4. Patterns adopted from research (with source)

| Pattern | Source | Where it lands in v1 |
|---|---|---|
| KPI strip on list cards | [roofstock] | Property list |
| Pass/fail vs. saved personal criteria | [dealcheck] + workbook's Desired CAP/DSCR | KPI strip + compare |
| Live recalc, no Calculate button | [mashvisor][dealcheck] | Everywhere |
| Prefilled defaults, never blank | [mashvisor][propstream] | New-property flow |
| Green/red best-worst per metric | [zilculator] | Comparison view |
| Comparison linked to live analyses | [realdata] | Comparison view |
| Methodology panel with formulas | [zilculator][stessa][realdata] | Detail page notes |
| Estimated-value labeling ("provenance") | [propstream][roofstock] | Insurance/tax defaults |
| Return decomposition (cashflow + appreciation + equity) | [roofstock] | 5-yr pro-forma section |

## 5. Deferred (validated as post-v1 by research)

- **Year-by-year "profit if sold in year N" / optimal-hold sweep**
  [biggerpockets][zilculator] — natural extension of the 5-yr pro-forma; add
  after the workbook replica ships (would deviate from "identical" v1 math).
- **Scenario toggle / duplicate-as-scenario** [mashvisor][zilculator] — compare
  view of duplicated properties covers 80% first.
- **Lender-grade PDF / shareable report** [realdata][dealcheck] — strong later
  differentiator; needs the design system settled first.
- **Sensitivity sliders / Decision Maker panel** [biggerpockets][realdata].
- **Any data import (listings, comps, AVM, rent estimates)** — the moat of the
  incumbents, all paid APIs; out of scope for a static-tier v1.

## 6. Open items carried to `clarify`

1. Preserve or correct the two remaining workbook quirks (YR-1 cashflow
   excludes loan 2; Excel-semantics NPV discounting YR0) — see
   `workbook-model.md` → Fidelity notes.
2. Compare view capacity: 2–4 properties side-by-side on iPad comfortably;
   more via horizontal scroll — confirm acceptable.
3. Property photos: none in the workbook; list cards can use a monogram/
   placeholder in v1 — confirm.

**Guardrail note:** all findings synthesize *patterns*; no copy, branding, or
designs were cloned from any product. Public pages only; several sites block
automated access, so those teardowns rely on search-indexed content and
third-party reviews (flagged inside each report).
