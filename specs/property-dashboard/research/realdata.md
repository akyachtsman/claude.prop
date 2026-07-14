# Competitive Analysis: RealData Real Estate Investment Analysis (realdata.com)

**Analyst note on method and a headline finding:** realdata.com and its docs/PDFs block automated fetchers, so this analysis is built from indexed public page content (product pages, docs/knowledge base, blog, user-guide listings) surfaced via web search, cross-checked across multiple pages. The single most strategically important finding: **RealData discontinued new software sales on April 30, 2026 (support ended May 30, 2026)** and has pivoted the site to investor-education eCourses. A 44-year incumbent that defined "lender-grade underwriting reports" has just exited the software market, leaving its installed base (investors, brokers, lenders, developers) orphaned on aging Excel workbooks. That is a direct acquisition opportunity for a modern web-based underwriting dashboard.

---

## 1. Information architecture

RealData organized its catalog as **discrete desktop products per asset strategy**, not modules in one app:

- **REIA Professional Edition** ($495) — flagship: 20-year hold/operate/resell analysis of any commercial or residential income property. Sold with add-ons (e.g., Comparison Analysis) priced separately.
- **REIA Express** ($159) — down-market sibling, explicitly "three programs in one": (a) Detailed Long-Term Analysis (10-year pro forma), (b) Short-Term Analysis (month-by-month buy-renovate-resell up to 24 months — their flip module), (c) Quick Analysis (a few inputs, single-page pass/fail report).
- **Commercial/Industrial Development (CID)** ($395) — ground-up/rehab development feasibility: hard/soft costs, land + development loans with monthly draws, takeout refinance, month-by-month construction-and-absorption mode, lease-up running in parallel with construction, up to 8 unit types.
- **On Schedule** ($395) — construction-phase fund-disbursement tracking.
- Supporting products: Personal Financial Statement (loan-package support), Comparative Lease Analysis, Real Estate Investment Calculators.
- **Bundles** ("Pro + CID + On Schedule," and a "Kitchen Sink" all-products bundle saving $671) plus a **Compare Products page** to route buyers to the right edition.

Structural takeaway: the split is by *investment strategy* (hold vs. develop vs. flip) and by *user sophistication* (Express vs. Pro), with the flip workflow treated as a mode inside the cheaper product rather than a standalone SKU. Each product is a multi-worksheet Excel workbook where "each page has a particular focus, but all pages are linked and share data."

## 2. Core user flows

- **Entry flow (Pro):** a Cash Flow and Resale Analysis module where the user "enters assumptions about the purchase, financing, resale, taxes, and operation" of the property; the workbook then projects before- and after-tax benefits of ownership and resale. Worksheet sequence mirrors the underwriting mental model: property/purchase info → Rent Roll → APOD (operating expenses) → financing → taxes/resale → results/reports.
- **Data entry conventions:** color-coded cells — **blue cells are inputs**, everything else is locked/calculated; "Quick Help" buttons sit on each worksheet; non-relevant worksheets can be hidden; users can add blank "user worksheets" for custom side calculations; a Data Import utility carries assumptions between analyses.
- **Assumption ergonomics:** global escalation rates for income and expenses *or* line-item, year-by-year overrides — a two-tier "quick vs. precise" assumption pattern used throughout.
- **What-if flows:** a **Decision Maker** worksheet toggles key inputs up/down and shows the immediate impact on all key return metrics on the same screen; a proprietary **Goal Seek** finds the purchase price needed to hit a target income, resale price, or rate of return; a dedicated **Sensitivity Analysis** worksheet produces its own reports.
- **Output flow:** one-click printing of any of 29 reports, or one-click **PDF generation** designed for emailing to "colleagues, lenders and clients."
- **Multi-property flow:** analyze each property in its own REIA workbook, then the Comparison Analysis add-on links those workbooks into a group with a shared holding period; edits to any underlying property auto-propagate to the comparison.

## 3. Content depth

**Metrics confirmed supported:** IRR (before- and after-tax), MIRR, PV/NPV (discounted cash flow), Capital Accumulation (CpA — a proprietary reinvestment-based wealth metric), cap rate, cash-on-cash return, before/after-tax cash flow, debt coverage, gross/net operating income, resale proceeds before/after tax. Gallinelli's companion book canonizes "37 key financial measures" (DCF, NPV, cap rate, CoC, DSCR, GOI, NOI, IRR, profitability index, return on equity, long-term gain, depreciation, etc.) — the software is effectively the executable version of that metric canon.

**Inputs/pro-forma depth:**
- 20-year annual pro-forma (Pro); 10-year in Express; month-by-month for flips (Express) and construction/absorption (CID).
- Rent Roll with up to 25 unit types and unlimited tenants per type; commercial expense recoveries (they published a whole educational series on recovery structures).
- APOD worksheet with up to 23 operating-expense line items.
- Financing: up to three fixed- or variable-rate mortgages plus a refinance option; loan amortization schedules; lease-vs-buy comparison sheet.
- **Tax modeling:** full before- vs. after-tax duality across cash flow and resale — depreciation options, interaction of mortgage terms and depreciation with returns, capital gain on sale. After-tax everything is a core differentiator, not an add-on.
- **Resale/exit:** integrated resale analysis at any holding period up to 20 years; reports suppress years beyond the specified hold so presentations only show pertinent data.
- **Partnership/syndication (Pro):** multiple partners with capital accounts and partner allocations; **waterfalls up to four tiers each for cash-flow distributions and sale proceeds** (with sequencing validation); syndication fees modeled explicitly (acquisition, asset management, disposition fees).

## 4. Onboarding, CTAs, conversion

- **Pricing model:** one-time perpetual licenses, loudly positioned against subscriptions ("$495 with no time limit"). Range across catalog roughly $50–$1,399.
- **Trial mechanics:** no free trial; instead an **$85 30-day full license, 100% credited toward the lifetime license** on upgrade — a paid-trial pattern that filters for serious buyers and converts cleanly.
- **Bundling** as the upsell engine: strategy bundles with stated dollar savings ($386, $671), including a video tutorial in starter bundles.
- **Education-led funnel:** Gallinelli's McGraw-Hill books, the $297 "Mastering Real Estate Investing" course (40+ video lessons, quizzes, case studies, one-time payment), a public docs/knowledge base, downloadable PDF user guides, and a long-running blog. The funnel is: learn the metrics from Frank → trust the math → buy the software that computes it. Post-2026, the education layer *is* the business.
- Buy pages are plain "Buy Now" per edition plus a comparison chart — no demo-request or sales-call gating.

## 5. Category-specific tooling

- **Report library as the product's center of gravity:** 29 "presentation-quality" reports in Pro (7 in Express), headlined by the **Real Estate Business Plan** and **Executive Summary** — i.e., not just tables, but a narrative financing package. Also: cash flow/resale projections, APOD, rent roll, loan amortization, lease-vs-buy, partnership/waterfall distributions, sensitivity reports, single-page Quick Analysis verdict sheet.
- **Sensitivity/what-if stack:** three distinct tools (Decision Maker live-toggle dashboard, Goal Seek on purchase price, Sensitivity Analysis worksheet) — sensitivity is a first-class workflow, not a hidden feature.
- **Graphs:** report-only worksheets carry results and charts; graphs ship inside the printable report set rather than as an interactive layer.
- **Comparison Analysis add-on:** side-by-side report across a property group — purchase price, cash investment, cash-on-cash, estimated resale value, before- and after-tax IRR, MIRR, CpA, PV — with live links back to each property's workbook. This is the direct analog of your multi-property comparison view.

## 6. Trust patterns

- **Longevity as identity:** "since 1982," "one of the earliest personal computer software companies still in business," with a founder origin story (1980, SuperCalc, a Connecticut commercial building) told on the About page.
- **Named, credentialed founder:** Frank Gallinelli — author of the category's standard textbook and instructor in **Columbia University's M.S. in Real Estate Development** program. The person is the methodology guarantee.
- **Professional/lender orientation:** explicitly marketed to "individual and institutional investors, developers, brokers, lenders, accountants, portfolio managers, financial planners, builders, and architects," for "presentations to buyers, sellers, lenders and equity partners."
- **Methodology transparency:** they publish the math publicly — articles like "Internal Rate of Return (IRR): Why It's the Gold Standard," "The Case of the Mysterious Sinking IRR," "Dive Deeper than Cap Rate," a multi-part expense-recoveries series, plus full user guides as open PDFs. Nothing is a black box; every metric has a published definition and worked examples.
- **Industry-standard artifacts:** using the APOD (an institutional/CCIM-style form) signals fluency with what brokers and lenders already expect to read.

## 7. Experiential layer

- **Visual language:** utilitarian, Excel-native, information-dense worksheets; hierarchy comes from workbook tabs (one concern per sheet) and the blue-input/locked-output color convention rather than from modern UI chrome. Screens read as an accountant's working papers — dense but legible to a finance-literate audience. No dashboard aesthetics, no cards, no charts-first layout.
- **What makes the printed reports lender-credible:**
  1. **Separation of workspace and presentation** — inputs live in working sheets; reports are separate, formula-free, print-composed pages. The lender never sees the sausage-making.
  2. **Standardized institutional formats** (APOD, rent roll, amortization schedule) that match documents a credit committee already trusts.
  3. **Before-tax AND after-tax columns** throughout, signaling analytical completeness.
  4. **Holding-period-aware output** — years beyond the specified hold are suppressed, so no report ships with dead columns or "N/A" noise.
  5. **A narrative wrapper** — Executive Summary and Business Plan reports turn the numbers into a financing argument, so one artifact serves as the entire loan/equity package.
  6. **Consistent metric definitions** backed by the founder's published textbook — a lender can look up exactly how IRR/MIRR/CpA were computed.

---

## Steal-worthy patterns

- **Report-first architecture:** treat the printable/PDF lender package (executive summary + narrative business plan + APOD-style operating statement + rent roll + amortization + returns summary) as the primary product output, with clean separation between the editing workspace and formula-free presentation pages.
- **Holding-period-aware pro-forma display:** let users set a hold of 1–20 (or N) years and automatically suppress out-of-range years everywhere — screens, charts, and exports.
- **Two-tier assumptions everywhere:** a single global escalation rate per category with optional per-line-item, per-year overrides — fast for a first pass, precise when underwriting hardens.
- **A live "Decision Maker" panel:** one screen where nudging price, rent growth, vacancy, rate, or exit cap instantly re-renders IRR/NPV/DSCR/CoC — sensitivity as a persistent sidebar, not a buried report; pair it with goal-seek on purchase price ("what must I pay to hit a 15% IRR / 1.25 DSCR?").
- **Linked comparison view:** comparisons reference the underlying analyses (not snapshots), normalize to a common holding period, and auto-refresh when any property's assumptions change — exactly RealData's Comparison Analysis pattern, modernized.
- **Before-tax/after-tax duality plus a tiered waterfall module** (up to ~4 tiers for cash flow and sale proceeds, with fee modeling) as the wedge into brokers/syndicators — almost no modern web competitor does after-tax and waterfalls credibly.
- **Methodology transparency as a trust engine:** publish a metric glossary/explainer library (how we compute IRR vs. MIRR, why cap rate misleads) and link each on-screen metric to its explainer — RealData proved education content converts and retains for decades.
- **Paid-trial-with-credit conversion:** a low-cost 30-day full-featured license whose price is credited toward the full plan — filters tire-kickers without a crippled free tier. (Adapt as: trial fee credited to first annual subscription.)

## Weaknesses / gaps

- **Discontinued and desktop-bound:** sales ended April 30, 2026; the products were Excel-dependent workbooks (with recurring Mac/Excel compatibility pain documented on their own blog), no cloud, no collaboration, no mobile — an orphaned installed base actively needing a successor.
- **No data integration:** every rent, expense, comp, and rate is hand-keyed; no market-data, comps, or mortgage-rate feeds, and no portfolio persistence beyond files on disk.
- **Static outputs:** graphs live only in printed reports; there is no interactive charting, no shareable web link for a lender/partner — everything travels as PDF email attachments.
- **Fragmented product line:** income-property, flip, development, comparison, and lease analysis are separate purchases with separate workbooks and add-on pricing, forcing re-entry of data across tools rather than one property model flowing between strategies.
- **Dated presentation of the software itself:** worksheet-tab UX, per-seat licensing, and a 1990s-era site aesthetic — the report *content* was lender-grade, but the authoring experience has none of the onboarding, templates, or progressive disclosure a modern web app can offer.

Sources: [RealData Products](https://www.realdata.com/products/), [REIA product page](https://www.realdata.com/products/real-estate-investment-analysis-reia/), [REIA Professional detail](https://www.realdata.com/p/reia/), [REIA Express](https://www.realdata.com/products/reia-express), [REIA Quick Edition doc](https://www.realdata.com/docs/reia-quick-edition/), [Comparison Analysis add-on doc](https://www.realdata.com/docs/comparison-analysis-add-on/), [CID product page](https://www.realdata.com/products/commercial-industrial-development-cid/), [On Schedule](https://www.realdata.com/products/on-schedule/), [Bundles](https://www.realdata.com/products/bundles), [About Us](https://www.realdata.com/bottom-links/about-us), [REIA v20 User's Guide](https://www.realdata.com/files/user-guides/reiaprofessional20userguide.pdf), [eCourses](https://www.realdata.com/ecourses/), [learn.realdata.com](https://learn.realdata.com/), [IRR "gold standard" article](https://www.realdata.com/internal-rate-of-return-irr-why-its-the-gold-standard-of-real-estate-metrics/), [Dive Deeper than Cap Rate](https://www.realdata.com/dive-deeper-than-cap-rate/), [The Case of the Mysterious Sinking IRR](https://www.realdata.com/the-case-of-the-mysterious-sinking-irr/), [Gallinelli book (Amazon)](https://www.amazon.com/Estate-Investor-Financial-Measures-Updated/dp/1259586189), [Rent Roll data entry doc](https://www.realdata.com/docs/rent-roll-data-entry/), [Buy Now — REIA Professional](https://www.realdata.com/products/real-estate-investment-analysis-reia/buy-now-reia-professional/)