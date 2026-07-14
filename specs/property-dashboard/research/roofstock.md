# Roofstock (roofstock.com) — Competitive Teardown for an Investment-Property Analytics App

**Context note (important for interpreting everything below):** Roofstock ran the category-defining retail SFR marketplace from 2016–2023. After merging with Mynd (May 2024), roofstock.com repositioned toward institutional/SFR-BTR services ("Invest & Manage SFR and BTR Portfolios"), and the retail marketplace experience largely migrated to its subsidiary Stessa's marketplace, powered by Roofstock data. The property-detail and analytics patterns that made Roofstock famous — and that are most relevant to your underwriting dashboard — come from the retail marketplace, and they remain the best-documented reference implementation in this category. Both eras are covered below.

---

## 1. Information architecture

- **Current site (2025–26):** a services-led B2B architecture, not a listings-led one. Nav organizes around the investment lifecycle — acquisitions/investment opportunities (including build-to-rent: CO purchases, forward commitments, recapitalizations), property management (under the Mynd brand), portfolio/asset management, dispositions, and data solutions — plus company/news and a login. Headline claims anchor it: 400,000+ investors, 50+ markets, $5B+ in SFR transacted, "all 90 million US single-family homes mapped by investment characteristics."
- **Marketplace-era IA (the relevant pattern):** three top-level jobs — **Buy** (marketplace), **Sell** (list your rental), **Learn** (blog, FAQ, Roofstock Academy) — with sub-products (Roofstock One fractional shares, Portfolios, Cloudhouse calculator) hanging off the Buy branch. The marketplace itself was a Zillow-pattern page: horizontal filter bar on top, toggleable **list view / map view**, listing cards below.
- **Property page sat one click from search results** and concentrated everything — financials, diligence documents, neighborhood data — into one URL with internal tabs (Analysis, Financials/Expenses, Documents, Neighborhood) rather than spreading it across pages. Ecosystem tools (Stessa for owned-asset tracking, Academy for education) were separate properties, keeping the marketplace IA clean.

## 2. Core user flows

- **Browse:** filter-first search. Filters included price, monthly rent, **cap rate, gross yield, expected appreciation**, neighborhood rating (their proprietary 1–5 star score), location/market, occupancy status, lease months remaining, square footage, year built, property condition — plus a notable **"1% rule" one-click filter** (rent ≥ 1% of price). Sorting by financial metric (yield/cap rate/appreciation), not just price, was a core differentiator vs. consumer portals.
- **Evaluate:** listing card → property detail page → "Analysis"/"Financials" section showing Roofstock's underwritten returns → **"Edit assumptions"** to re-underwrite with your own numbers → open diligence docs (inspection report, title, lease, tenant payment history) inline.
- **Compare:** no true side-by-side comparison table existed. Comparison was done implicitly via metric-sortable search results, saved/favorited properties, and saved-search alerts ("buy box" alerts in the Stessa successor). This is a genuine gap (see Weaknesses).
- **Transact:** free offers, two paths — buy at list price straight into checkout, or negotiate. On acceptance: 0.5%/$500-min marketplace fee, $1,500 earnest money via DocuSign flow, human phone call within ~12 hours, close in ~15 days (cash) / ~30 (financed). The e-commerce "checkout for a house" flow was the signature move.

## 3. Content depth (metrics, assumptions, projections)

Per-property metrics displayed (marketplace era):
- **List price and estimated value** (Roofstock's opinion of worth, with repair estimates)
- **Cap rate** (NOI ÷ price)
- **Gross yield** (annual rent ÷ price)
- **Cash-on-cash return** (levered, based on financing assumptions)
- **Annualized/total return** over a selectable horizon — 5-year standard, some views out to 10- and 20-year projections — decomposed into **cash flow + appreciation + equity**
- **Annual/monthly net cash flow** ("Total Net Cash Flow," toggleable month/year)
- **Appreciation rate** (defaulted from ~20-year historical data for the market)
- **Full expense pro-forma:** property taxes, insurance, property management fee, repairs/maintenance reserve, vacancy allowance, closing costs — shown line by line, both historical actuals and forward-year estimates
- **Lease/tenant facts as inputs:** current rent, lease expiration, security deposit, utility responsibility, tenant payment history

Assumptions transparency was the standout: every projection labeled as estimate, defaults visible, and **all key drivers user-editable** (purchase price, down payment %, interest rate, rent, appreciation rate, closing costs). Reviewers demonstrated that changing appreciation from historical to trailing-year materially moved the 5-year annualized return (e.g., to ~20.6%) — i.e., sensitivity was directly experienceable. Critics noted defaults skewed optimistic (maintenance reserves below the 1–2%-of-value rule of thumb) — a caution for your own defaults.

## 4. Onboarding, CTAs, conversion

- **Free account, light gating:** browsing was open; a free signup (short investor-profile questionnaire) unlocked full financial detail, documents, and produced a **personalized dashboard with property recommendations** matched to the profile. Cloudhouse followed the same pattern: instant top-line results free, detailed financial analysis behind free login. Accreditation gating existed only for Roofstock One ($5K minimum, tracking shares, 6-month lock).
- **CTA ladder:** low-commitment steps stacked toward transaction — favorite a property → edit assumptions → schedule a free property-inquiry call with a human → make a free offer → pay only on acceptance (0.5%/$500). "Making an offer costs nothing" was a heavily used friction-killer.
- **First-run:** recommendations + saved-search alerts drove return visits; Roofstock Academy (courses + coaching) served the "not ready yet" segment instead of losing them.

## 5. Category-specific tooling

- **On-page underwriting calculator** ("edit assumptions") embedded in every listing — the analysis lives with the listing, not in a separate tool.
- **Cloudhouse:** free BYOP (bring-your-own-property) calculator — type **any** US single-family address, get forecast rent, cap rate, cash flow, operating costs, neighborhood/school data, with adjustable assumptions. Brilliant top-of-funnel: analytics as lead magnet for addresses not even listed.
- **Neighborhood Rating:** proprietary 1–5 star risk index over ~72,000 census tracts, built with a hierarchical ML normalization ("constant quality standard of living") on home values, income, employment, educational attainment, owner-occupancy %, school ratings, crime. Star levels have written personas (5-star = high employment/income/schools, owner-occupied; 1-star = inverse). Surfaced on the card thumbnail, as a filter, and expanded on the detail page with schools, median income/home values, employment stats.
- **Downloadable property-analysis spreadsheet** (Excel) as a free companion tool; Academy courses teaching cap rate/CoC using the platform's own metrics.
- No native side-by-side compare, no DSCR/IRR/NPV/WACC surfaced anywhere retail-facing — their metric set stopped at cap rate / yield / CoC / total return.

## 6. Trust patterns

- **Roofstock Certification:** third-party inspection (12–15-page report published on the listing), valuation report, market analysis, preliminary title report, tenant payment-history check; repairs required to be <15% of list price; claimed only ~15% of submitted properties pass. Certification is a named, badge-like construct.
- **30-Day Money-Back Guarantee** on certified single-family properties (Roofstock relists and refunds) — unheard-of in real estate, and the single most cited trust device in reviews.
- **Lease-Up Guarantee:** for vacant homes, Roofstock pays 75% of market rent if not leased within 45 days.
- **Radical document transparency:** inspection, title, lease, tenant ledger all viewable pre-offer.
- **Social proof / authority:** transaction volume stats ($5B+), investor counts (400K+), press (Forbes etc.), vetted property-manager network, human touchpoints (inquiry calls, post-offer call) layered onto the self-serve flow.

## 7. Experiential layer

(Reconstructed from public screenshots in reviews and marketing pages; roofstock.com blocks automated fetching, so treat fine detail as directional.)

- **Design language:** clean fintech-meets-real-estate — deep navy/ink primary with teal-green accent, generous whitespace, geometric sans-serif type, aspirational suburban-home photography in heroes, simple line iconography for features/process steps. Density is Zillow-like in search (compact cards, filter chips) but calmer than a data terminal.
- **First impression (marketplace era):** hero = one-sentence value prop ("radically accessible" rental investing) + single primary CTA into the marketplace, followed by a 3-step "how it works," stats band, guarantee badges, press logos. The current B2B site swaps this for capability sections and institutional proof points.
- **Listing cards:** photo-led with a **KPI strip on the thumbnail itself** — price, monthly rent, cap rate/gross yield, year built, sqft, and the neighborhood star rating — so financial triage happens at the grid level before any click.
- **Property detail hierarchy:** photo/3D-tour gallery and address block up top; a **returns panel** (cap rate, CoC, gross yield, appreciation, total return) as the dominant above-fold module; then tabbed/stacked sections — analysis & valuation, expense pro-forma, financing, documents, neighborhood/schools, tenant/lease. Interactive elements: hold-period and financing inputs that live-recalculate the returns panel, month/year cash-flow toggles, projection charts for multi-year cash flow and value growth.
- **Motion/interaction:** modest — live recalculation on assumption edits, map/list toggling, 3D Matterport-style tours and floor plans as the "wow" media. The interactivity budget went to the calculator, not decorative animation.

---

## Steal-worthy patterns

1. **Financial KPIs on the search card itself** (cap rate/yield/rent + a risk score on every thumbnail) — let users triage by return metrics before opening a detail page; add metric-based sorting and a "1% rule"-style one-click heuristic filter.
2. **"Edit assumptions" embedded in the returns panel, with live recalculation** — defaults shown, every driver (price, down payment, rate, rent, appreciation, expenses, hold period) editable in place, so sensitivity analysis is experienced, not explained. Your DSCR/IRR/NPV/WACC engine slots perfectly under this UX.
3. **Total return decomposed** into cash flow + appreciation + equity over a user-selectable hold period, with monthly/annual toggle — makes a 5-year pro-forma feel like one interactive object instead of a table dump.
4. **A named, explained neighborhood/risk score (1–5) with written personas per level** — a proprietary index used simultaneously as filter, card badge, and detail-page module is a durable moat and a trust device.
5. **Cloudhouse-style "analyze any address" free calculator** as top-of-funnel: instant headline metrics for free, full analysis behind a free account — analytics itself is the lead magnet.
6. **Progressive gating:** open browsing → free account unlocks depth + personalized recommendations from a short investor-profile quiz → alerts on saved "buy box" criteria. No paywall before the user has seen value.
7. **Assumptions provenance:** show where each default comes from (historical market appreciation, market vacancy, actual taxes) and label everything as estimate — Roofstock's transparency here is why reviewers trusted numbers they could also override.
8. **Trust as product objects, not copy:** named certification badge, published third-party reports per property, and explicit guarantees rendered as UI elements — adapt as "data verified" badges, methodology disclosures, and per-metric confidence indicators.

## Weaknesses / gaps

1. **No side-by-side comparison view** — users compared candidates via sorting and favorites only; a true multi-property comparison table (your planned feature) is a direct differentiation opportunity.
2. **Shallow metric set for serious underwriters** — no DSCR, IRR, NPV, WACC, or explicit NOI walk on-page; sophisticated investors exported to spreadsheets (Roofstock even shipped one), conceding the power-user workflow.
3. **Optimistic defaults undermined credibility** — maintenance/vacancy assumptions ran low vs. investor rules of thumb, and 5-year totals leaned on a hypothetical sale; reviewers consistently flagged this.
4. **Inventory-dependent experience** — the analytics were welded to their listings; when supply thinned in hot markets, the product had little standalone value (Cloudhouse partially patched this, gated).
5. **Strategic whiplash** — the 2024 pivot to institutional SFR/BTR orphaned the retail marketplace UX (now living under Stessa), leaving the current roofstock.com with no public property-level analytics showcase at all — the retail underwriting-dashboard space they vacated is open.

**Sources:** [roofstock.com](https://www.roofstock.com/) · [Retire Before Dad review](https://www.retirebeforedad.com/roofstock-review/) · [Money Crashers review](https://www.moneycrashers.com/roofstock-review/) · [One Shot Finance walkthrough](https://oneshotfinance.com/roofstock-review-2020-real-estate-investing-for-dummies/) · [WallStreetZen review](https://www.wallstreetzen.com/blog/roofstock-review/) · [Real Estate Skills review](https://www.realestateskills.com/blog/roofstock-reviews) · [Benzinga overview](https://www.benzinga.com/money/roofstock-review) · [Mashvisor reviews](https://www.mashvisor.com/blog/roofstock-reviews/) · [ChooseFI review](https://choosefi.com/review/roofstock-review) · [ListenMoneyMatters review](https://www.listenmoneymatters.com/roofstock-review/) · [Master Passive Income offer-flow case study](https://masterpassiveincome.com/roofstock-review) · [Roofstock money-back guarantee](https://www.roofstock.com/money-back-guarantee) · [Forbes on the guarantee](https://www.forbes.com/sites/joegose/2018/10/18/to-take-edge-off-property-investing-online-roofstock-pledges-guarantee/) · [Roofstock Cloudhouse](https://www.roofstock.com/cloudhouse) · [Inman on Neighborhood Ratings](https://www.inman.com/2017/07/18/roofstock-neighborhood-ratings-real-estate-investment-risk/) · [HousingWire on ratings index](https://www.housingwire.com/articles/40690-roofstock-launches-neighborhood-ratings-index-for-single-family-rental-investors/) · [Roofstock–Mynd merger](https://www.roofstock.com/company/news-press/roofstock-mynd-merge) · [HousingWire on merger](https://www.housingwire.com/articles/former-rivals-become-partners-as-mynd-merges-with-roofstock/) · [Stessa marketplace](https://www.stessa.com/investment-property-marketplace/) · [The Real Estate Crowdfunding Review — Roofstock One](https://www.therealestatecrowdfundingreview.com/roofstock-one-review-and-rating) · [Money Under 30](https://www.moneyunder30.com/investing/reviews/roofstock/) · [The College Investor](https://thecollegeinvestor.com/21592/roofstock-review/) · [Tokenist review](https://tokenist.com/investing/roofstock-review/) · [GoodFinancialCents review](https://www.goodfinancialcents.com/roofstock-review/) · [rentalrealestate.com overview](https://rentalrealestate.com/tools/roofstock/)