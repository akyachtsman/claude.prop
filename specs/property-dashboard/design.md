# Design — "Banker Navy" (established at /design-intake, 2026-07-14)

## Decisions (owner-selected)
- **Mood:** banker navy — deep navy structure (`#132E4E`), paper-white surfaces,
  crisp and credible. Echoes the source workbook's own navy title bar.
- **Accent:** teal `#0E7C6D` for actions/highlights; pass/fail semantics stay
  green/red and are never carried by color alone (label + color).
- **Type:** clean geometric sans (Inter → system stack), tabular numerals
  everywhere (`font-variant-numeric: tabular-nums`); uppercase letterspaced
  eyebrows as section labels (ledger heritage).
- **Signature element:** the **KPI strip** — all twelve underwriting metrics in
  one framed, hairline-divided band (echoes the workbook's merged metric row).
  6 × 2 on desktop, 3 × 4 on iPad.
- Generated direction (no external reference image); informed by
  `research.md`'s polish bar (DealCheck clarity, Stessa card aesthetic).

## Contract files
- `styles/tokens.css` — colors (core + navy structure + verdict + chart),
  type scale, spacing, radius, shadow. Chart series (`--chart-1 #3E6FAE`,
  `--chart-2 #159E86`) validated with the dataviz palette validator (CVD +
  contrast, light and dark surface) — keep validated if changed.
- `styles/components.css` — topbar, page frame, eyebrow, card + 12-col grid,
  KPI strip, pills, buttons, fields/inputs (incl. `.input--estimate` for
  model-seeded defaults), checkbox rows (expense toggles), data tables, facts
  grid, pure-CSS bar chart + legend, methodology `details`, footer.

## Reference page (the look-gate)
- **`index.html`** — the property detail dashboard, rendered with a static
  sample deal ("1042 Maple Ave — Duplex", offer $460K, 70% LTV @ 6.5%/25yr).
  All figures computed with the workbook model (loan-2 fix applied); the KPI
  strip intentionally shows a mixed verdict (CAP passes 7.30% vs 6.00%; DSCR
  fails 1.19 vs 1.25; 1% rule fails) so both semantic states are visible.
- Verified: `check-contrast.js` all pairs AA; `html-validate` clean; zero
  console/page errors in Chromium; desktop (1440) and iPad (834) screenshots
  reviewed.
- Chart shows operating years (YR 5 return of equity carried in the table, not
  the bars) — noted in the legend and fine print.

## Rules for downstream pages (/sdd-loop)
- Every value reads `var(--…)` from tokens.css — no hardcoded colors/sizes.
- New components go into components.css, built from tokens.
- The comparison view and property list reuse: topbar, cards, KPI cells,
  pills, data-table (with `makeSortable` per design.md → Tables & sorting).
- Estimated/model-seeded inputs use `.input--estimate` + an "estimated" pill.
