# Workbook verbatim record — `NEW.CAP.NOI.WACC.NPV.IRR.xlsx`, sheet `Example 1`

Machine-generated cell-by-cell copy (openpyxl, 2026-07-14). Every non-empty
cell: exact stored content (labels character-for-character, formulas as
written), the cached value from the file, and the number format. This is the
fidelity source for the build; `workbook-model.md` is the readable model.

Interactive machinery inventory: booleans C18:K18 are the expense include
checkboxes; K8/P8 accept the strings CONV or IO (enforced by the payment
formulas' "Invalid input" branch — no data-validation rules, no protected
cells, no hyperlink objects exist in the file). Merged ranges listed at the end.

| Cell | Kind | Stored content (verbatim) | Cached value | Format |
|---|---|---|---|---|
| A1 | label/text | `https://drive.google.com` | https://drive.google.com | `General` |
| B1 | label/text | `INVESTMENT PROPERTY ANALYTICS` | INVESTMENT PROPERTY ANALYTICS | `General` |
| A2 | label/text | `PROP INFO` | PROP INFO | `General` |
| B2 | label/text | `Asking Price` | Asking Price | `General` |
| C2 | label/text | `Rentable SF` | Rentable SF | `General` |
| D2 | label/text | `Lot Size` | Lot Size | `General` |
| E2 | label/text | `Year Built` | Year Built | `General` |
| F2 | label/text | `Zoning / Class` | Zoning / Class | `General` |
| G2 | label/text | `HVAC Age` | HVAC Age | `General` |
| H2 | label/text | `Roof Age` | Roof Age | `General` |
| I2 | label/text | `Parking          (# / Lot Size)` | Parking          (# / Lot Size) | `General` |
| J2 | label/text | `Ceiling Height` | Ceiling Height | `General` |
| K2 | label/text | `Appraised Value` | Appraised Value | `General` |
| L2 | label/text | `APN` | APN | `General` |
| M2 | label/text | `Bedrooms` | Bedrooms | `General` |
| N2 | label/text | `Baths` | Baths | `General` |
| Q2 | label/text | `Desired CAP*` | Desired CAP* | `General` |
| R2 | label/text | `Desired DSCR*` | Desired DSCR* | `General` |
| B3 | input | `100000.0` | 100000.0 | `"$"#,##0` |
| C3 | input | `1000.0` | 1000.0 | `0` |
| E3 | input | `2025.0` | 2025.0 | `0` |
| K3 | input | `0.0` | 0.0 | `"$"#,##0` |
| M3 | label/text | `...x1, ...x1` | ...x1, ...x1 | `0` |
| N3 | label/text | `...x1, ...x1` | ...x1, ...x1 | `0` |
| Q3 | input | `0.0` | 0.0 | `0.00%` |
| R3 | input | `0.0` | 0.0 | `#,##0.00` |
| A5 | label/text | `CAP` | CAP | `General` |
| B5 | label/text | `DSCR ratio` | DSCR ratio | `General` |
| C5 | label/text | `NOI` | NOI | `General` |
| D5 | label/text | `NOI Debt Service` | NOI Debt Service | `General` |
| E5 | label/text | `NOI - Collection Loss` | NOI - Collection Loss | `General` |
| F5 | label/text | `Cash  on  Cash` | Cash  on  Cash | `General` |
| G5 | label/text | `Annual IRR` | Annual IRR | `General` |
| H5 | label/text | `5Y NPV` | 5Y NPV | `General` |
| I5 | label/text | `5Y Total Return` | 5Y Total Return | `General` |
| J5 | label/text | `WACC` | WACC | `General` |
| K5 | label/text | `Return On Cost` | Return On Cost | `General` |
| L5 | label/text | `1% Rule` | 1% Rule | `General` |
| N5 | label/text | `Minimum Opportunity Cost of Equity` | Minimum Opportunity Cost of Equity | `General` |
| O5 | label/text | `Tax Rate For Interest Deduction` | Tax Rate For Interest Deduction | `General` |
| P5 | label/text | `Collection loss Used for Debt Service ` | Collection loss Used for Debt Service  | `General` |
| Q5 | label/text | `Cash flow Appreciation` | Cash flow Appreciation | `General` |
| R5 | label/text | `Capital Appreciation` | Capital Appreciation | `General` |
| A6 | formula | `=C6/A8` | 0 | `0.00%` |
| B6 | formula | `=if(R8<=0, 0, E6/R8)` | 0 | `0.00` |
| C6 | formula | `=B11-B16` | 0 | `"$"#,##0` |
| D6 | formula | `=C6-(L8+Q8)*12` | -5671.740155 | `"$"#,##0` |
| E6 | formula | `=B13-B16` | 0 | `"$"#,##0` |
| F6 | formula | `=D6/C8` | -0.1890580052 | `0.00%` |
| G6 | formula | `=IRR(M18:R18)` | -0.1280722871 | `0.00%` |
| H6 | formula (array) | `= NPV(J6,M18:R18)` | -22892.86914 | `"$"#,##0` |
| I6 | formula | `=sum(M18:R18)` | -19107.88323 | `"$"#,##0` |
| J6 | formula | `=H8*I8*(1-O6) + N8*O8*(1-O6) + (1-H8-N8)*N6` | 0.07776 | `0.00%` |
| K6 | formula | `=C6/C8` | 0 | `0.00%` |
| L6 | formula | `=B11/12 - (A8*0.01)` | -1000 | `0.00` |
| N6 | input | `0.15` | 0.15 | `0%` |
| O6 | input | `0.28` | 0.28 | `0%` |
| P6 | input | `0.05` | 0.05 | `0%` |
| Q6 | input | `0.02` | 0.02 | `0.00%` |
| R6 | input | `0.02` | 0.02 | `0.00%` |
| A7 | label/text | `Offer Price*` | Offer Price* | `General` |
| C7 | label/text | `All In Cost` | All In Cost | `General` |
| D7 | label/text | `Fees` | Fees | `General` |
| E7 | label/text | `Improvement` | Improvement | `General` |
| F7 | label/text | `DEBT SERVICE` | DEBT SERVICE | `General` |
| G7 | label/text | `Finance Amount 1` | Finance Amount 1 | `General` |
| H7 | label/text | `% LTV` | % LTV | `General` |
| I7 | label/text | `Rate` | Rate | `General` |
| J7 | label/text | `Term (YR)` | Term (YR) | `General` |
| K7 | label/text | `Type` | Type | `General` |
| L7 | label/text | `Monthly Payment` | Monthly Payment | `General` |
| M7 | label/text | `Finance Amount 2` | Finance Amount 2 | `General` |
| N7 | label/text | `% LTV` | % LTV | `General` |
| O7 | label/text | `Rate` | Rate | `General` |
| P7 | label/text | `Type` | Type | `General` |
| Q7 | label/text | `Monthly Payment` | Monthly Payment | `General` |
| R7 | label/text | `Total YR Mortgage` | Total YR Mortgage | `General` |
| A8 | input | `100000.0` | 100000.0 | `"$"#,##0` |
| C8 | formula | `=A8-G8-M8 + D8 + E8` | 30000 | `"$"#,##0` |
| D8 | input | `0.0` | 0.0 | `"$"#,##0` |
| E8 | input | `0.0` | 0.0 | `"$"#,##0` |
| G8 | formula | `=A8*H8` | 70000 | `"$"#,##0` |
| H8 | input | `0.7` | 0.7 | `0%` |
| I8 | input | `0.065` | 0.065 | `0.00%` |
| J8 | input | `25.0` | 25.0 | `General` |
| K8 | label/text | `CONV` | CONV | `General` |
| L8 | formula | `=IF(OR(EXACT(K8, "CONV"), EXACT(K8, "IO")), ⏎  IF(EXACT(K8, "CONV"), ⏎    -PMT(I8/12, J8*12, G8), ⏎    -IPMT(I8/12, 1, J8*12, G8)⏎  ), ⏎  "Invalid input")` | 472.6450129 | `"$"#,##0` |
| M8 | formula | `=A8*N8` | 0 | `"$"#,##0` |
| N8 | input | `0.0` | 0.0 | `0%` |
| O8 | input | `0.065` | 0.065 | `0.00%` |
| P8 | label/text | `IO` | IO | `General` |
| Q8 | formula | `=IF(OR(EXACT(P8, "CONV"), EXACT(P8, "IO")), ⏎  IF(EXACT(P8, "CONV"), ⏎    -PMT(N8/12, O8*12, L8), ⏎    -IPMT(N8/12, 1, O8*12, L8)⏎  ), ⏎  "Invalid input")` | 0 | `"$"#,##0` |
| R8 | formula | `=(L8+Q8)*12` | 5671.740155 | `"$"#,##0` |
| A10 | label/text | `INCOME` | INCOME | `General` |
| B10 | label/text | `Total RENT` | Total RENT | `General` |
| C10 | label/text | `Avg. Rent / SF` | Avg. Rent / SF | `General` |
| D10 | label/text | `Tenant 1` | Tenant 1 | `General` |
| E10 | label/text | `Tenant SF` | Tenant SF | `General` |
| F10 | label/text | `Rent / SF` | Rent / SF | `General` |
| G10 | label/text | `Monthly Income 1` | Monthly Income 1 | `General` |
| H10 | label/text | `Lease Expires` | Lease Expires | `General` |
| I10 | label/text | `Lease Options` | Lease Options | `General` |
| J10 | label/text | `...` | ... | `General` |
| L10 | label/text | `Tenant 2` | Tenant 2 | `General` |
| M10 | label/text | `Tenant SF` | Tenant SF | `General` |
| N10 | label/text | `Rent per SF` | Rent per SF | `General` |
| O10 | label/text | `Monthly Income 2` | Monthly Income 2 | `General` |
| P10 | label/text | `Lease Expires` | Lease Expires | `General` |
| Q10 | label/text | `Lease Options` | Lease Options | `General` |
| R10 | label/text | `...` | ... | `General` |
| B11 | formula | `=(G11+O11+G13+O13)*12` | 0 | `"$"#,##0` |
| C11 | formula | `=(E11/C13*F11)+(E13/C13*F13)+(M11/C13*N11)+(M13/C13*N13)` | 0 | `"$"#,##0.00` |
| D11 | label/text | `...` | ... | `General` |
| E11 | input | `1.0` | 1.0 | `0` |
| F11 | formula | `=G11/E11` | 0 | `"$"#,##0.00` |
| G11 | input | `0.0` | 0.0 | `"$"#,##0` |
| L11 | label/text | `...` | ... | `General` |
| M11 | input | `1.0` | 1.0 | `0` |
| N11 | formula | `=O11/M11` | 0 | `"$"#,##0.00` |
| O11 | input | `0.0` | 0.0 | `"$"#,##0` |
| R11 | input | `0.0` | 0.0 | `@` |
| B12 | label/text | `RENT - Collection Loss` | RENT - Collection Loss | `General` |
| C12 | label/text | `Total Tenant SF` | Total Tenant SF | `General` |
| D12 | label/text | `Tenant 3` | Tenant 3 | `General` |
| E12 | label/text | `Tenant SF` | Tenant SF | `General` |
| F12 | label/text | `Rent per SF` | Rent per SF | `General` |
| G12 | label/text | `Monthly Income 3` | Monthly Income 3 | `General` |
| H12 | label/text | `Lease Expires` | Lease Expires | `General` |
| I12 | label/text | `Lease Options` | Lease Options | `General` |
| J12 | label/text | `...` | ... | `General` |
| L12 | label/text | `Tenant 4` | Tenant 4 | `General` |
| M12 | label/text | `Tenant SF` | Tenant SF | `General` |
| N12 | label/text | `Rent per SF` | Rent per SF | `General` |
| O12 | label/text | `Monthly Income 4` | Monthly Income 4 | `General` |
| P12 | label/text | `Lease Expires` | Lease Expires | `General` |
| Q12 | label/text | `Lease Options` | Lease Options | `General` |
| R12 | label/text | `...` | ... | `General` |
| B13 | formula | `=B11*0.95` | 0 | `"$"#,##0` |
| C13 | formula | `=E11+E13+M11+M13` | 4 | `#,##0` |
| D13 | label/text | `...` | ... | `General` |
| E13 | input | `1.0` | 1.0 | `0` |
| F13 | formula | `=G13/E13` | 0 | `"$"#,##0.00` |
| G13 | input | `0.0` | 0.0 | `"$"#,##0` |
| L13 | label/text | `...` | ... | `General` |
| M13 | input | `1.0` | 1.0 | `0` |
| N13 | formula | `=O13/M13` | 0 | `"$"#,##0.00` |
| O13 | input | `0.0` | 0.0 | `"$"#,##0` |
| A15 | label/text | `EXPENSE (YR)` | EXPENSE (YR) | `General` |
| B15 | label/text | `Total Expense Included` | Total Expense Included | `General` |
| C15 | label/text | `Insurance*` | Insurance* | `General` |
| D15 | label/text | `Property Taxes*` | Property Taxes* | `General` |
| E15 | label/text | `CAM` | CAM | `General` |
| F15 | label/text | `HOA` | HOA | `General` |
| G15 | label/text | `Utilities` | Utilities | `General` |
| H15 | label/text | `Management` | Management | `General` |
| I15 | label/text | `Maintanence` | Maintanence | `General` |
| J15 | label/text | `Landscaping` | Landscaping | `General` |
| K15 | label/text | `Cleaning` | Cleaning | `General` |
| M15 | label/text | `Initial Investment` | Initial Investment | `"$"#,##0.00` |
| N15 | label/text | `YR 1` | YR 1 | `General` |
| O15 | label/text | `YR 2` | YR 2 | `General` |
| P15 | label/text | `YR 3` | YR 3 | `General` |
| Q15 | label/text | `YR 4` | YR 4 | `General` |
| R15 | label/text | `YR 5` | YR 5 | `General` |
| B16 | formula | `=if(C18 = TRUE, C16, 0) + if(D18 = TRUE, D16, 0) + if(E18 = TRUE, E16, 0) + if(F18 = TRUE, F16, 0) + if(G18 = TRUE, G16, 0) + if(H18 = TRUE, H16, 0) + if(I18 = TRUE, I16, 0) + if(J18 = TRUE, J16, 0) + if(K18 = TRUE, K16, 0) ` | 0 | `"$"#,##0` |
| C16 | formula | `=C3*1.25` | 1250 | `"$"#,##0` |
| D16 | formula | `=A8*0.012` | 1200 | `"$"#,##0` |
| E16 | input | `0.0` | 0.0 | `"$"#,##0` |
| F16 | input | `0.0` | 0.0 | `"$"#,##0` |
| G16 | input | `0.0` | 0.0 | `"$"#,##0` |
| H16 | input | `0.0` | 0.0 | `"$"#,##0` |
| I16 | input | `0.0` | 0.0 | `"$"#,##0` |
| J16 | input | `0.0` | 0.0 | `"$"#,##0` |
| K16 | input | `0.0` | 0.0 | `"$"#,##0` |
| L16 | label/text | `Cashflow` | Cashflow | `General` |
| M16 | formula | `=-C8` | -30000 | `"$"#,##0` |
| N16 | formula | `=B11-B16-(L8*12)` | -5671.740155 | `"$"#,##0` |
| O16 | formula | `=N16*(1+Q6)` | -5785.174958 | `"$"#,##0` |
| P16 | formula | `=O16*(1+Q6)` | -5900.878458 | `"$"#,##0` |
| Q16 | formula | `=P16*(1+Q6)` | -6018.896027 | `"$"#,##0` |
| R16 | formula | `=Q16*(1+Q6)-M16` | 23860.72605 | `"$"#,##0` |
| B17 | label/text | `Total Expense` | Total Expense | `General` |
| C17 | formula | `=C16/C6` | #DIV/0! | `0.00%` |
| D17 | formula | `=D16/C6` | #DIV/0! | `0.00%` |
| E17 | formula | `=E16/C6` | #DIV/0! | `0.00%` |
| F17 | formula | `=F16/C6` | #DIV/0! | `0.00%` |
| G17 | formula | `=G16/C6` | #DIV/0! | `0.00%` |
| H17 | formula | `=H16/C6` | #DIV/0! | `0.00%` |
| I17 | formula | `=I16/C6` | #DIV/0! | `0.00%` |
| J17 | formula | `=J16/C6` | #DIV/0! | `0.00%` |
| K17 | formula | `=K16/C6` | #DIV/0! | `0.00%` |
| L17 | label/text | `Appreciation` | Appreciation | `General` |
| M17 | input | `0.0` | 0.0 | `"$"#,##0` |
| N17 | formula | `=A8*R6` | 2000 | `"$"#,##0` |
| O17 | formula | `=(A8+N17)*R6` | 2040 | `"$"#,##0` |
| P17 | formula | `=(A8+N17+O17)*R6` | 2080.8 | `"$"#,##0` |
| Q17 | formula | `=(A8+N17+O17+P17)*R6` | 2122.416 | `"$"#,##0` |
| R17 | formula | `=(A8+N17+O17+P17+Q17)*R6` | 2164.86432 | `"$"#,##0` |
| B18 | formula | `=sum(C16:K16)` | 2450 | `"$"#,##0` |
| C18 | checkbox | `FALSE` | False | `#,##0` |
| D18 | checkbox | `FALSE` | False | `#,##0` |
| E18 | checkbox | `TRUE` | True | `#,##0` |
| F18 | checkbox | `TRUE` | True | `#,##0` |
| G18 | checkbox | `TRUE` | True | `#,##0` |
| H18 | checkbox | `TRUE` | True | `#,##0` |
| I18 | checkbox | `TRUE` | True | `#,##0` |
| J18 | checkbox | `TRUE` | True | `#,##0` |
| K18 | checkbox | `TRUE` | True | `#,##0` |
| L18 | label/text | `Cashflow + Appreciation` | Cashflow + Appreciation | `General` |
| M18 | formula | `=SUM(M16:M17)` | -30000 | `"$"#,##0` |
| N18 | formula | `=SUM(N16:N17)` | -3671.740155 | `"$"#,##0` |
| O18 | formula | `=SUM(O16:O17)` | -3745.174958 | `"$"#,##0` |
| P18 | formula | `=SUM(P16:P17)` | -3820.078458 | `"$"#,##0` |
| Q18 | formula | `=SUM(Q16:Q17)` | -3896.480027 | `"$"#,##0` |
| R18 | formula | `=SUM(R16:R17)` | 26025.59037 | `"$"#,##0` |
| A20 | label/text | `WACC: (Equity%*opportunity cost of equity + Debt%*cost of debt(1-tax rate)) / (Equity% + Debt%)` | WACC: (Equity%*opportunity cost of equity + Debt%*cost of debt(1-tax rate)) / (Equity% + Debt%) | `General` |
| A21 | label/text | `IRR (Internal Rate of Return): The discount rate at which the net present value (NPV) of a project's cash flows equals zero. It represents the expected annualized rate of return generated by an investment.` | IRR (Internal Rate of Return): The discount rate at which the net present value (NPV) of a project's cash flows equals zero. It represents the expected annualized rate of return generated by an investment. | `General` |
| A22 | label/text | `NOTE: Given a constant CAP rate, the IRR will also remain constant, given any combination of NOI and purchase price.` | NOTE: Given a constant CAP rate, the IRR will also remain constant, given any combination of NOI and purchase price. | `General` |
| A23 | label/text | `NOTE: NPV is the difference between the present value of all cash flows over the project's duration, discounted by our WACC. ` | NOTE: NPV is the difference between the present value of all cash flows over the project's duration, discounted by our WACC.  | `General` |
| A24 | label/text | `NOTE: A positive NPV indicates that the project's returns exceed that of our WACC and IRR WILL be greater than WACC, making it a worthwhile investment and you should accept the project.                                             ` | NOTE: A positive NPV indicates that the project's returns exceed that of our WACC and IRR WILL be greater than WACC, making it a worthwhile investment and you should accept the project.                                              | `General` |
| A25 | label/text | `NOTE: A positive NPV directly implies that the IRR will be greater than our discount rate (WACC).  ` | NOTE: A positive NPV directly implies that the IRR will be greater than our discount rate (WACC).   | `General` |
| A26 | label/text | `NOTE: When the NPV of all cash flows equals to 0, it means the project's expected cash flows are just enough to cover the cash flows created by our cost of capital (WACC). This represents the project's break-even cost of capital. Setting NPV to 0 will allow us to evaluate the true rate of return of the project (IRR) versus our cost of capital (WACC). If the resulting IRR exceeds our WACC, it means that our project's profitability exceeds that of our WACC and you should accept the project.` | NOTE: When the NPV of all cash flows equals to 0, it means the project's expected cash flows are just enough to cover the cash flows created by our cost of capital (WACC). This represents the project's break-even cost of capital. Setting NPV to 0 will allow us to evaluate the true rate of return of the project (IRR) versus our cost of capital (WACC). If the resulting IRR exceeds our WACC, it means that our project's profitability exceeds that of our WACC and you should accept the project. | `General` |
| A27 | label/text | `NPV= ∑(t=1 to yr)CFt/(1+r)^t − Initial Investment` | NPV= ∑(t=1 to yr)CFt/(1+r)^t − Initial Investment | `General` |
| A28 | label/text | `          (1+r)^t accounts for the compounding effect of the discount rate over time. This factor is what allows us to convert future values to present values, effectively "bringing" future cash flows to the present. ` |           (1+r)^t accounts for the compounding effect of the discount rate over time. This factor is what allows us to convert future values to present values, effectively "bringing" future cash flows to the present.  | `General` |
| A29 | label/text | `          CFt is the cash flow in year t,     r is the discount rate,     t is the number of years (1 to yr)                                                ` |           CFt is the cash flow in year t,     r is the discount rate,     t is the number of years (1 to yr)                                                 | `General` |

## Merged ranges

- `A10:A13`
- `A15:A18`
- `A20:R20`
- `A21:R21`
- `A22:R22`
- `A23:R23`
- `A24:R24`
- `A25:R25`
- `A26:R26`
- `A27:R27`
- `A28:R28`
- `A29:R29`
- `A2:A3`
- `A7:B7`
- `A8:B8`
- `B1:R1`
- `F7:F8`

