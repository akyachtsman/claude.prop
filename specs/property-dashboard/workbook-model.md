# Workbook Model — canonical extraction

Source: `NEW.CAP.NOI.WACC.NPV.IRR.xlsx`, sheet `Example 1` (uploaded 2026-07-14).
This file is the **source of truth** for the property detail dashboard's fields,
formulas, and layout order. The dashboard replicates the model **in full detail**;
visual styling is modernized (owner decision, 2026-07-14) — the workbook's look is
recorded at the bottom for reference only.

Cell references (`B3`, `C6`, …) are the workbook's own; the app uses the named
fields defined here.

## 1. Property info (rows 2–3)

| Field | Cell | Type / format | Default in workbook |
|---|---|---|---|
| Asking Price | B3 | currency `$#,##0` | 100,000 |
| Rentable SF | C3 | integer | 1,000 |
| Lot Size | D3 | text | — |
| Year Built | E3 | integer | 2025 |
| Zoning / Class | F3 | text | — |
| HVAC Age | G3 | text | — |
| Roof Age | H3 | text | — |
| Parking (# / Lot Size) | I3 | text | — |
| Ceiling Height | J3 | text | — |
| Appraised Value | K3 | currency | 0 |
| APN | L3 | text | — |
| Bedrooms | M3 | text (e.g. "...x1, ...x1") | placeholder |
| Baths | N3 | text (same pattern) | placeholder |
| Desired CAP* | Q3 | percent `0.00%` | 0 |
| Desired DSCR* | R3 | number `#,##0.00` | 0 |

`*` = target thresholds the user sets; used for pass/fail comparison against
computed CAP (A6) and DSCR (B6).

## 2. KPI strip (rows 5–6) — 12 computed metrics + 5 assumptions

Computed (left to right):

| # | Metric | Cell | Formula (workbook refs) | Format |
|---|---|---|---|---|
| 1 | CAP | A6 | `NOI / OfferPrice` (`C6/A8`) | 0.00% |
| 2 | DSCR ratio | B6 | `AnnualDebtService <= 0 ? 0 : NOI_less_collection / AnnualDebtService` (`if(R8<=0,0,E6/R8)`) | 0.00 |
| 3 | NOI | C6 | `TotalRent − TotalExpenseIncluded` (`B11−B16`) | $ |
| 4 | NOI Debt Service | D6 | `NOI − 12×(pmt1+pmt2)` (`C6−(L8+Q8)*12`) | $ |
| 5 | NOI − Collection Loss | E6 | `RentLessCollection − TotalExpenseIncluded` (`B13−B16`) | $ |
| 6 | Cash on Cash | F6 | `NOI_DebtService / AllInCost` (`D6/C8`) | 0.00% |
| 7 | Annual IRR | G6 | `IRR(cashflow+appreciation series M18:R18)` | 0.00% |
| 8 | 5Y NPV | H6 | `NPV(WACC, M18:R18)` (array formula; note: includes YR0 in the discounted range — see Fidelity notes) | $ |
| 9 | 5Y Total Return | I6 | `SUM(M18:R18)` | $ |
| 10 | WACC | J6 | `LTV1×rate1×(1−tax) + LTV2×rate2×(1−tax) + (1−LTV1−LTV2)×minOppCostEquity` (`H8*I8*(1-O6)+N8*O8*(1-O6)+(1-H8-N8)*N6`) | 0.00% |
| 11 | Return On Cost | K6 | `NOI / AllInCost` (`C6/C8`) | 0.00% |
| 12 | 1% Rule | L6 | `TotalRent/12 − OfferPrice×0.01` (`B11/12−A8*0.01`) | 0.00 |

Assumption inputs (N5:R6):

| Assumption | Cell | Default |
|---|---|---|
| Minimum Opportunity Cost of Equity | N6 | 15% |
| Tax Rate For Interest Deduction | O6 | 28% |
| Collection loss Used for Debt Service | P6 | 5% |
| Cash flow Appreciation | Q6 | 2% |
| Capital Appreciation | R6 | 2% |

Note: P6 (5%) is displayed as an assumption, but the workbook hardcodes `×0.95`
in B13 rather than referencing P6. The app should compute
`RentLessCollection = TotalRent × (1 − collectionLoss)` so the assumption is live.
(Fidelity note #2.)

## 3. Offer, cost & debt service (rows 7–8)

| Field | Cell | Formula / default | Format |
|---|---|---|---|
| Offer Price* | A8 | input; 100,000 | $ |
| All In Cost | C8 | `Offer − Fin1 − Fin2 + Fees + Improvement` (`A8−G8−M8+D8+E8`) — this is the equity (initial investment) | $ |
| Fees | D8 | input; 0 | $ |
| Improvement | E8 | input; 0 | $ |
| Finance Amount 1 | G8 | `Offer × LTV1` (`A8*H8`) | $ |
| % LTV (1) | H8 | input; 70% | 0% |
| Rate (1) | I8 | input; 6.5% | 0.00% |
| Term YR (1) | J8 | input; 25 | int |
| Type (1) | K8 | input; `CONV` or `IO` | text |
| Monthly Payment (1) | L8 | `CONV → −PMT(rate/12, term×12, principal)`; `IO → −IPMT(rate/12, 1, term×12, principal)`; else "Invalid input" | $ |
| Finance Amount 2 | M8 | `Offer × LTV2` (`A8*N8`) | $ |
| % LTV (2) | N8 | input; 0% | 0% |
| Rate (2) | O8 | input; 6.5% | 0.00% |
| Type (2) | P8 | input; `IO` | text |
| Monthly Payment (2) | Q8 | **workbook formula is buggy** — see Fidelity note #1. App computes like loan 1 from loan 2's own amount/rate/term. | $ |
| Total YR Mortgage | R8 | `(pmt1 + pmt2) × 12` (`(L8+Q8)*12`) | $ |

Loan 2 has no Term column in the sheet (it reuses the layout without J-column);
the app gives loan 2 its own term input (default 25, matching loan 1's pattern).

## 4. Income (rows 10–13) — 4 tenants

Per tenant: Tenant name, Tenant SF, Rent/SF (computed = monthly income / SF),
Monthly Income (input), Lease Expires, Lease Options.
Workbook defaults: SF = 1, Monthly Income = 0 for all four.

| Rollup | Cell | Formula |
|---|---|---|
| Total RENT (annual) | B11 | `(inc1+inc2+inc3+inc4) × 12` |
| Avg. Rent / SF | C11 | SF-weighted: `Σ(tenantSF/totalSF × rentPerSF)` |
| RENT − Collection Loss | B13 | `TotalRent × 0.95` (app: `× (1 − collectionLoss)`) |
| Total Tenant SF | C13 | `Σ tenantSF` |

## 5. Expenses (rows 15–18) — 9 categories with include toggles

| Category | Amount cell | Default formula | Included (default) |
|---|---|---|---|
| Insurance* | C16 | `RentableSF × 1.25` | C18 = FALSE |
| Property Taxes* | D16 | `OfferPrice × 1.2%` | D18 = FALSE |
| CAM | E16 | 0 | TRUE |
| HOA | F16 | 0 | TRUE |
| Utilities | G16 | 0 | TRUE |
| Management | H16 | 0 | TRUE |
| Maintanence [sic — app spells "Maintenance"] | I16 | 0 | TRUE |
| Landscaping | J16 | 0 | TRUE |
| Cleaning | K16 | 0 | TRUE |

- **Total Expense Included** (B16): sum of amounts whose toggle is TRUE — feeds NOI.
- **Total Expense** (B18): sum of all 9 regardless of toggle.
- **% of NOI row** (C17:K17): `amount / NOI` per category (DIV/0 → app shows "—").
- Insurance and Property Taxes are auto-estimated from SF/price but remain
  user-overridable inputs in the app (the `*` marks estimated defaults).

## 6. Five-year pro-forma (M15:R18)

Columns: Initial Investment, YR 1 … YR 5.

| Row | Cells | Formula |
|---|---|---|
| Cashflow | M16:R16 | M16 `= −AllInCost`; N16 `= TotalRent − TotalExpIncl − pmt1×12` (**note: excludes loan 2 — Fidelity note #3**); O16..Q16 `= prior × (1 + cashflowAppreciation)`; R16 `= Q16×(1+cfApp) − M16` (returns the initial equity in YR5) |
| Appreciation | M17:R17 | M17 = 0; N17 `= Offer × capApp`; each later year `= (Offer + Σ prior appreciation) × capApp` (compounding) |
| Cashflow + Appreciation | M18:R18 | column sums — this series feeds IRR (G6), NPV (H6), Total Return (I6) |

## 7. Notes block (rows 20–29)

Educational text to display in the dashboard (an info/methodology panel):
- WACC definition: `(Equity%×opportunity cost of equity + Debt%×cost of debt(1−tax rate)) / (Equity% + Debt%)`
- IRR definition, CAP/IRR constancy note, NPV definition, positive-NPV decision
  rules (2 notes), NPV=0 break-even explanation, the NPV formula
  `NPV = Σ(t=1..yr) CFt/(1+r)^t − Initial Investment`, and the `(1+r)^t` /
  variables explanation. (Full text preserved in the workbook; carry verbatim.)

## Fidelity notes (deliberate deviations — owner-approved 2026-07-14)

1. **Loan 2 payment bug (fixed).** Workbook Q8 references the wrong cells
   (`−PMT(N8/12, O8*12, L8)` = LTV as rate, rate as term, loan-1 payment as
   principal). Only invisible because loan 2 defaults to 0. App computes loan 2
   exactly like loan 1 from its own amount/rate/term/type.
2. **Collection loss made live.** `×0.95` hardcodes assumption P6; app uses
   `×(1 − collectionLoss)` so editing the assumption works.
3. **Preserved as-is:** YR-1 cashflow (N16) subtracts only loan 1's payments
   (`L8×12`, not `(L8+Q8)×12`) while "NOI Debt Service" (D6) subtracts both.
   5Y NPV (H6) discounts the whole M18:R18 range, so YR0 (the initial
   investment) is discounted one period — Excel's NPV() semantics. Both
   replicated to match the workbook; flag for the owner in `clarify` whether
   to also correct these two.

## Workbook visual language (reference only — design is modernized)

- Title bar: navy `#132E57`, white, 24pt — "INVESTMENT PROPERTY ANALYTICS"
- Section headers: blue `#6FA8DC`; column labels: light blue `#CFE2F3`;
  tenant/income headers: `#9FC5E8`; loan-2 header: teal `#76A5AF`
- Computed cells: gray `#CCCCCC`; estimated inputs: `#EFEFEF`
- Headline KPIs (NOI, IRR, NPV, CoC, WACC…): purple `#B4A7D6`, 14–18pt bold
- IRR/NPV input series row + notes: yellow `#FFFF00`; WACC note: orange `#FF9900`
- Font: Times New Roman throughout
