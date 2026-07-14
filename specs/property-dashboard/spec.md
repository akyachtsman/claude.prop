# Spec — Property Analytics Dashboard & Comparison View

Phase 1 (specify). WHAT & WHY only — no tech stack, no implementation. Open
questions are tagged `[NEEDS CLARIFICATION]` and resolved in `clarify`.

Constitution (binding): the directives imported via `CLAUDE.md` —
`global.md` (plain HTML/CSS/JS, no local build; `textContent` for dynamic
text; evidence before assertions), `design.md` (the approved Banker Navy
contract, iPad rules, WCAG AA, editorial formatting), `data.md` (Supabase
default when a backend is added; RLS; no keys client-side), `test.md`.

Fidelity sources: `workbook-model.md` (readable model + approved deviations),
`workbook-verbatim.md` (cell-by-cell truth). The dashboard replicates the
workbook's math and every data point in full.

## Why
An investor evaluates income properties on a dozen underwriting metrics
(CAP, DSCR, NOI, IRR, NPV, WACC, cash-on-cash, a 5-year pro-forma) that today
live in a fragile Excel workbook. The workbook is single-file, easy to break,
and can't line deals up next to each other. This product turns that workbook
into a durable dashboard: enter a property's numbers, see every metric compute
live and pass/fail against the investor's own targets, save the deal, and
compare saved deals side by side to pick the winner. No competitor ships this
full metric set (WACC appears in none of the eight surveyed) plus a true
multi-property comparison — the two things this product leads on.

## Primary user
A real-estate investor underwriting small income properties (single-family
through small multifamily / mixed-use, up to 4 tenants), working on a laptop
and iPad. Secondary: anyone they share a deal readout with (lender, partner) —
read-only, later phase.

## User stories
1. **As an investor, I enter a property's purchase, financing, income, and
   expense figures and immediately see all 12 underwriting metrics** so I can
   judge a deal without touching a spreadsheet.
2. **As an investor, I set my own target CAP and DSCR and see each deal marked
   pass or fail against them** so triage is instant.
3. **As an investor, I toggle which expenses count toward NOI** so I can model
   different operating assumptions (e.g. exclude taxes/insurance).
4. **As an investor, I save a property and return to it later** so my
   underwriting persists between sessions.
5. **As an investor, I switch between saved properties from the dashboard**
   (prev/next) so I can review a portfolio quickly on one screen.
6. **As an investor, I compare 2+ saved properties side by side** with the
   best/worst value per metric highlighted so I can pick the strongest deal.
7. **As an investor, I read the methodology behind each metric** so I trust and
   can explain the numbers.
8. **As an investor, I export and re-import my saved properties** so my data
   isn't trapped on one device and I can back it up.

## Functional requirements

### Inputs (all editable; every workbook input reproduced)
- **FR-1 Property info:** asking price, rentable SF, lot size, year built,
  zoning/class, HVAC age, roof age, parking, ceiling height, appraised value,
  APN, bedrooms, baths. Free-form where the workbook is free-form.
- **FR-2 Targets:** desired CAP (%), desired DSCR (ratio).
- **FR-3 Offer & cost:** offer price, fees, improvements.
- **FR-4 Financing — two loans:** per loan — amount is derived from offer ×
  LTV; LTV, rate, term, type (CONV or IO). Loan 2 is optional (defaults to 0%).
  - **FR-4a** Monthly payment computes per type: CONV = amortizing payment;
    IO = interest-only payment. An invalid type shows a clear error, not a
    silent wrong number.
  - **FR-4b** Loan 2 computes from its **own** amount/rate/term (the workbook's
    loan-2 formula bug is corrected — owner-approved; see `workbook-model.md`
    Fidelity note 1).
- **FR-5 Income — up to 4 tenants:** per tenant — name, SF, monthly income,
  lease expires, lease options. Rent/SF is derived. Totals: annual total rent,
  SF-weighted avg rent/SF, total tenant SF, rent less collection loss.
- **FR-6 Expenses — 9 categories:** insurance, property taxes, CAM, HOA,
  utilities, management, maintenance, landscaping, cleaning. Each has an amount
  and an **include-in-NOI toggle**. Insurance (SF × 1.25) and property taxes
  (offer × 1.2%) seed as editable estimates, marked as estimates.
- **FR-7 Assumptions:** min opportunity cost of equity, tax rate for interest
  deduction, collection loss %, cashflow appreciation %, capital appreciation
  %. Collection loss is live (drives rent-less-collection and DSCR — owner
  approved; `workbook-model.md` Fidelity note 2).

### Computed metrics (must match the workbook model exactly)
- **FR-8** All 12 KPIs compute and update **live on any input change, with no
  "calculate" button:** CAP, DSCR, NOI, NOI−Debt Service, NOI−Collection Loss,
  Cash-on-Cash, Annual IRR, 5Y NPV, 5Y Total Return, WACC, Return on Cost,
  1% Rule. Formulas per `workbook-model.md`.
- **FR-9** All-in cost (equity), total expense included vs. all-categories,
  per-category % of NOI, and the rollups in FR-5 compute live.
- **FR-10 Five-year pro-forma:** cashflow row, appreciation row, and combined
  row across Initial + YR1–YR5, exactly per the workbook (YR5 returns equity).
  The combined series drives IRR, NPV, and total return. Shown as a chart
  (operating years) plus the exact table.
- **FR-11 Verdicts:** CAP and DSCR (and 1% Rule) render pass/fail against the
  targets (FR-2), by label **and** color — never color alone.
- **FR-12 Division-by-zero and empty inputs** never show `NaN`/`#DIV/0!`; they
  show `—` (no-data) per `design.md` editorial rules.

### Persistence & navigation
- **FR-13** A property can be **saved**; saved properties **persist across
  sessions** on the same device.
- **FR-14** A **property list** shows every saved property as a card with its
  headline KPIs and a pass/fail badge; selecting one opens its dashboard.
- **FR-15** The dashboard has a **prev/next switcher** to move between saved
  properties without leaving the screen.
- **FR-16** Create, edit, and delete properties. Deleting asks for
  confirmation stating the consequence.
- **FR-17 Export/import:** the full set of saved properties can be exported to
  a file and re-imported (backup / move between devices).

### Comparison
- **FR-18** Select 2+ saved properties and view them **side by side**: every
  KPI and the key inputs, one property per column.
- **FR-19** The **best and worst value per metric** are highlighted
  (green/red), direction-aware (higher CAP is better; lower is better for cost
  metrics where applicable). No-data sinks to neutral, never "best/worst".
- **FR-20** Comparison reflects the **current saved values** of each property
  (edits to a property show in the comparison).
- **FR-21** Pass/fail against targets shows per property in the comparison.

### Methodology & content
- **FR-22** A methodology panel explains WACC, IRR, NPV, the NPV=0 break-even,
  and the discounting factor — carried **verbatim from the workbook notes**
  (`workbook-verbatim.md` rows 20–29).
- **FR-23** All copy, number, date, and rate formatting follows `design.md`
  editorial rules (whole-% , K/M suffixes, "Jun 4" dates, "—" for no data).

### Cross-cutting (constitution)
- **FR-24** Every screen matches the approved Banker Navy contract
  (`styles/tokens.css` + `styles/components.css`); the property dashboard fits
  one laptop-landscape screen without vertical scroll at 1440×900+.
- **FR-25** Works on iPad Safari (44px targets, 48px inputs, 16px+ input font,
  no hover-only); WCAG AA; `:focus-visible`; `prefers-reduced-motion` honored;
  dynamic text inserted via `textContent`, never `innerHTML`.
- **FR-26** No local build step; plain HTML/CSS/JS served from GitHub Pages.

## Success criteria
- **SC-1** For a given set of inputs, every one of the 12 metrics equals the
  workbook's value (validated against a computed fixture within rounding).
- **SC-2** Editing any input updates all dependent metrics with no explicit
  recalculate action.
- **SC-3** A saved property survives a full page reload and browser restart on
  the same device.
- **SC-4** Two properties can be compared with correct best/worst-per-metric
  highlighting.
- **SC-5** The dashboard shows all workbook data points and fits 1440×900 with
  no vertical scroll; passes the CI static + UI gates and the contrast
  guardrail.
- **SC-6** Exported data re-imports to an identical set of properties.
- **SC-7** No `NaN`/`#DIV/0!`/`undefined` ever renders for empty or zero inputs.

## Non-goals (v1)
- **NG-1** No backend / multi-device sync in v1 (local-first; Supabase is a
  planned later phase per the owner decision — data.md governs it then).
- **NG-2** No listing/MLS/comps/rent-estimate data import (paid APIs; out of
  static-tier scope).
- **NG-3** No shareable public report link or lender-grade PDF export in v1
  (later differentiator).
- **NG-4** No sensitivity sliders / scenario A-B / "profit if sold in year N"
  in v1 (deferred per research.md §5; would deviate from exact-workbook math).
- **NG-5** No authentication / multi-user in v1.
- **NG-6** No more than 4 tenants or 2 loans (matches the workbook).

## Open questions
- **[NEEDS CLARIFICATION: workbook quirks]** Two workbook behaviors are
  preserved as-is but flagged (`workbook-model.md` Fidelity note 3): YR-1
  pro-forma cashflow subtracts only loan 1's payments (not loan 2); the 5Y NPV
  discounts the whole series including YR0 (Excel NPV semantics). Keep exact-to-
  workbook, or correct both? Correcting changes SC-1's fixture.
- **[NEEDS CLARIFICATION: compare capacity]** How many properties side by side
  before horizontal scroll on iPad — 3? 4? (affects column sizing).
- **[NEEDS CLARIFICATION: property photos]** The workbook has none. List cards
  can use a monogram/placeholder in v1 — acceptable, or is a photo field
  wanted?
- **[NEEDS CLARIFICATION: seed content]** Ship with the sample "1042 Maple Ave"
  deal preloaded (nice first-run), start empty with an empty-state prompt, or
  offer a "load sample" button?
- **[NEEDS CLARIFICATION: IRR no-solution]** When cashflows never cross zero
  (no real IRR), what shows — "—", "n/a", or a nearest-estimate note?
