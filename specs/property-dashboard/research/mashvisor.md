# Competitive Teardown: Mashvisor (mashvisor.com)

**Method note:** Mashvisor's site and several review sites sit behind bot protection that the research proxy could not pass, so this analysis is assembled from search-indexed content of Mashvisor's marketing pages, help center articles, product blog posts, and third-party reviews (Awning, Hospitable, SparkRental, BNBCalc, Trustpilot/BBB, etc.). Claims below are sourced; the few inferences are flagged.

---

## 1. Information architecture

- **Positioning has pivoted to STR-first.** The homepage title is now "Mashvisor | Short-Term Rental Data Analysis & Airbnb Data" — the IA leads with Airbnb/vacation-rental analytics, with long-term ("traditional") rentals as the secondary strategy. This matters: they organize the product around *rental strategy*, not around portfolios of saved analyses.
- **Product suite is organized as a funnel from macro to micro**, and the nav/product pages mirror it:
  1. **Market Finder** (`/product/market-finder`) — national bird's-eye view; markets graded A+ to D via the proprietary "Mashmeter" score; filters for listing price, cap rate, occupancy, even crime rate; heatmap + Table View; "Market Insights" content modules on the dashboard.
  2. **Property Finder** (`/product/*`) — listing-level search across up to 5 locations simultaneously; MLS listings overlaid with projected returns.
  3. **Property (Analytics) Page** — the underwriting workspace for a single address: calculator, comps, 10-year Payback Balance.
  4. Supporting products: free **Airbnb Calculator** (`/airbnb-calculator`, a lead-gen tool), **Dynamic Pricing** (`/product/dynamic-pricing`), **Mashboard** (agent/owner-data tool), **API** (`/api-doc`), and a `/data-methodology` page.
- **User's saved work lives in a "Saved Homes / My Properties" list** — a flat list showing type, sale price, the user's own star-rating of the property, and tenant-occupancy status. There is no notion of "analyses" or "reports" as first-class saved objects; the property is the unit of organization.
- Heavy SEO scaffolding: an enormous blog (`/blog/...`) and programmatic location pages (`/invest/...`) do most of the top-of-funnel work.

## 2. Core user flows

- **Add a property = search, not form-fill.** The primary entry is a search bar accepting state, city, ZIP, neighborhood, or a specific address (including off-market and foreclosed homes) with typeahead suggestions. Users arrive at a property either via map/table browsing (Property Finder) or direct address lookup (Airbnb Calculator / property page). There is no "blank underwriting form" start — every analysis begins pre-populated with Mashvisor's estimates.
- **Market → neighborhood → property drill-down:** heatmap a city by a chosen metric (listing price, rental income, cash-on-cash, occupancy), click into neighborhoods (Mashmeter score, median price, avg rental income, occupancy, walkability), then click property pins to open the analytics page.
- **Entering financials = adjusting prefilled assumptions.** On the property page the user toggles cash vs. mortgage; mortgage inputs are down payment, loan amount, loan type/term, interest rate. Expenses are prefilled from local-market averages, split into one-time startup costs and recurring costs, each editable, with custom line items addable. Any change triggers instant recalculation of all metrics.
- **The signature interaction: a one-click Traditional ↔ Airbnb strategy toggle** that swaps the entire pro-forma (e.g., 4.2% CoC traditional vs. 7.8% Airbnb on the same $350K property) so users pick the "optimal rental strategy."
- **Comparing deals** is comparatively weak: save properties to a watchlist, view them in a table, export search results to Excel, or run Property Finder across 5 locations side by side. There's no dedicated multi-deal comparison canvas with editable scenarios.

## 3. Content depth (metrics & inputs)

**Metrics computed/displayed:** rental income (monthly/annual, both strategies), cash flow, cap rate, cash-on-cash return, NOI (implied in their CoC definition), occupancy rate (booked-vs-blocked adjusted for STR), ADR/nightly rate, projected annual STR revenue, 10-year "Investment Payback Balance" (cumulative profit table/graph factoring revenue, expenses, cash flow, startup costs, vacancy), ML-based Property Score, Mashmeter market grade, walkability, crime rate, days-on-market/seasonality and YoY trends (STR side).

**Inputs supported:** price; financing (cash/mortgage; down payment, loan amount, loan type, term, rate); one-time costs (inspection, repairs, furnishing, closing costs, custom); recurring costs (insurance, utilities, property management, maintenance, property tax, HOA, rental income tax, cleaning fees, custom); rental income override; occupancy override.

**Depth ceiling — important for you:** No IRR, no NPV, no DSCR, no WACC, no explicit exit/sale assumptions, no appreciation/equity modeling, no refinance/BRRRR/flip phases, no tenant/lease-level modeling, and projections cap at the 10-year payback table (vs. DealCheck's 30-year projections + IRR + DSCR). Mashvisor's own DealCheck review concedes it's the market-selection tool, not the deep-underwriting tool. Your app's metric set (IRR, NPV, DSCR, WACC, 5-yr pro-forma with exit) is exactly the layer Mashvisor lacks.

## 4. Onboarding, CTAs, conversion

- **7-day free trial on every plan** (card required — the source of most complaints); pricing roughly Lite ~$17.99–29.99/mo, Standard ~$49.99/mo, Professional ~$74.99/mo, with ~20–30% annual discounts and frequent 15–60% promo codes. Feature-gating drives upgrades: rental comps unlock at Standard; Excel exports are quota'd (20/mo Standard, 60/mo Professional) and branded property PDFs are Professional-tier.
- **First-run is an investor-profile wizard:** budget, purchase timeline, financing method, target renter, number of properties owned — used to personalize the experience. Free onboarding and email support are advertised.
- **Free tools as conversion surface:** the free Airbnb Calculator and free market data pages let users run one real analysis before hitting the paywall — classic "taste the data" gating.
- Newer retention hooks: saved-filter presets, custom property email alerts, and a ChatGPT App Directory integration (Dec 2025) as acquisition PR.

## 5. Category-specific tooling

- **Calculators:** investment property calculator (both strategies), embedded mortgage calculator, Airbnb revenue calculator, 10-year payback table. Live recalculation on every input change.
- **Sensitivity analysis: effectively absent.** Users can manually nudge assumptions, but there's no tornado chart, break-even solver, or scenario A/B — a clear gap.
- **Comps & data import:** the standout. Auto-imported MLS listing data; STR comps with nightly rates, occupancy, revenue, amenity/Superhost filters; long-term rental comps with rent estimates; sales comps (improved via 2025 Akrivis AVM partnership); STR regulation highlights with links to municipal ordinances; historical STR performance (36 months via API); dynamic pricing calendar using seasonality/events/booking history.
- **Reports/export:** branded PDF property reports (user logo + company name) covering expenses, ROI, sales and rental comps, shareable by email/SMS; Excel/CSV export of search results and comp lists (green "Export to Excel" button, quota-gated).
- **Comparison:** 5-market simultaneous Property Finder search; Table View for market comparison; watchlist. No editable side-by-side deal matrix.

## 6. Trust patterns

- **Methodology transparency is a real asset:** a dedicated `/data-methodology` page; named data sources (MLS, Airbnb, Zillow, Realtor.com, Rentometer, Redfin, Census Bureau, public records); stated rules like "medians not means," minimum 3 reviews for Airbnb comps to count, and booked-vs-blocked-night occupancy logic; coverage stats marketed concretely (all 50 states, 400+ metros, 10,000+ ZIPs, "95% of U.S. markets," 450K+ properties analyzed / 11M+ active Airbnb listings, weekly STR updates, daily MLS updates).
- **Scores as trust shortcuts:** Mashmeter (A+–D market grade) and ML Property Score compress methodology into a single credible-feeling number.
- **Social proof is thin and double-edged:** Trustpilot ~3.8–4.0/5 (~480 reviews), BBB ~4.67 but with a visible complaint file, essentially no G2/Capterra presence. Public complaints center on auto-renewal/refund practices, unhelpful billing support, and rent-estimate accuracy (especially STR overestimates) — a reputational drag their marketing can't fully paper over. Partnership/press signals (Akrivis, ChatGPT directory alongside Expedia/Spotify/Canva) are doing recent trust work.

## 7. Experiential layer

*(Assembled from screenshot descriptions in help docs/reviews; direct visual inspection was blocked.)*

- **Map-first, data-dense workspace:** the core screen is a split search experience — search bar + filter row on top, map with property pins, and a one-click Map/Table toggle. The heatmap defaults to monochrome blue shades (darkest = hottest) with an optional full-color mode (green = hot, red = cold); metric choice recolors the map.
- **Landing/first impression** leads with the search action and free-calculator hooks rather than a passive brochure — the hero invites you to type a market and see numbers immediately. Marketing pages lean on product screenshots of the heatmap and analytics page as hero imagery.
- **Property page hierarchy** (recently overhauled for "enhanced visuals... easy-to-read format"): photos/listing facts up top, headline ROI metrics for both strategies, then progressive-disclosure sections — calculator (financing, expenses), comps, payback balance chart/table. Numbers are presented as editable defaults, which visually communicates "estimate, not gospel."
- **Iconography/scores over prose:** letter grades (A+–D), color-coded scores, and single-number composites carry much of the communication load; green is used for affirmative actions (e.g., the Export to Excel button).
- **Interaction patterns worth noting:** live recalculation of all metrics on any input change; one-click strategy flip; saved filter presets; typeahead location search. Reviewers consistently call it "user-friendly" but data-heavy; density skews toward research tool rather than polished consumer product.

---

## Steal-worthy patterns

- **Prefilled underwriting, never a blank form:** seed every new analysis with market-derived defaults (rents, taxes, insurance, management %, closing costs) that the user edits — the first render already shows CAP/NOI/CoC, and editing feels like refining, not data entry.
- **One-click scenario toggle at the top of the analysis page:** their Traditional↔Airbnb flip is the memorable interaction; your analog could be financing scenarios (e.g., 20% vs 25% down, or hold-period variants) swapping the whole pro-forma instantly.
- **Live full-page recalculation on any input change** — no "Calculate" button anywhere; every assumption edit ripples through DSCR, IRR, NPV, payback in real time.
- **A cumulative payback/equity table-plus-chart as a standard section** (their 10-year Payback Balance) — an intuitive "when am I whole?" visual that complements IRR for less sophisticated users.
- **Public methodology page + inline metric provenance:** named data sources, median-not-mean logic, comp-inclusion rules. For an underwriting tool, showing *how* each default was derived converts skeptics.
- **Branded, shareable PDF reports (user's logo/company) with expenses broken into one-time vs. recurring** — turns individual investors' agents/lender conversations into a distribution channel.
- **Free single-analysis calculator as the top-of-funnel:** let anyone run one real address through a slimmed version of the engine before the paywall.
- **Composite scores as scanning aids** (market grade, property score) layered on top of raw metrics for the comparison view — grades for triage, metrics for underwriting.

## Weaknesses / gaps (your openings)

- **Shallow financial modeling:** no IRR, NPV, DSCR, WACC, exit/sale assumptions, appreciation/equity buildup, refinance, or multi-year pro-forma beyond the 10-year cumulative payback table — professional underwriters must leave the tool.
- **No sensitivity/scenario tooling:** assumptions can only be nudged one at a time; no break-even, stress-test, or saved scenario comparison on a single deal.
- **Weak multi-deal comparison:** watchlist + Excel export instead of a true side-by-side comparison canvas with user-adjusted assumptions — your multi-property comparison view directly attacks this.
- **Trust debt from billing practices and support:** trial auto-renewal charges, refused refunds, BBB complaints, and slow support are the loudest public complaints — an opening for transparent billing, easy cancellation, and responsive support as a differentiator.
- **Data-accuracy skepticism, especially STR revenue overestimates**, compounded by quota-gated exports and tier-gated comps that make users feel nickel-and-dimed for their own analysis output.

---

**Sources:** [Mashvisor homepage](https://www.mashvisor.com/) · [Market Finder](https://www.mashvisor.com/product/market-finder) · [Airbnb Calculator](https://www.mashvisor.com/airbnb-calculator) · [Airbnb Data](https://www.mashvisor.com/airbnb-data) · [Pricing](https://www.mashvisor.com/pricing) · [Data Methodology](https://www.mashvisor.com/data-methodology) · [Rental Property Calculator blog](https://www.mashvisor.com/blog/rental-property-calculator/) · [Investment Property Calculator blog](https://www.mashvisor.com/blog/mashvisors-investment-property-calculator/) · [Real Estate Heatmap blog](https://www.mashvisor.com/blog/real-estate-heatmap/) · [Exporting an Investment Property Report](https://www.mashvisor.com/blog/exporting-an-investment-property-report/) · [Nov 2024 feature spotlight](https://www.mashvisor.com/blog/mashvisor-new-features-nov-2024/) · [Oct 2024 feature spotlight](https://www.mashvisor.com/blog/mashvisor-new-features-oct-2024/) · [DealCheck review by Mashvisor](https://www.mashvisor.com/blog/dealcheck-review/) · Help Center: [Getting Started](https://help.mashvisor.com/en/articles/1269047-getting-started-with-mashvisor), [Payback Balance](https://help.mashvisor.com/en/articles/2058508-what-is-payback-balance-on-the-property-page), [Heat Map](https://help.mashvisor.com/en/articles/2140650-how-to-use-the-heat-map), [Property Finder](https://help.mashvisor.com/en/articles/1811363-how-to-use-the-property-finder-tool), [Mashmeter Score](https://help.mashvisor.com/en/articles/7109404-what-is-the-mashmeter-score), [Property Alerts](https://help.mashvisor.com/en/articles/7060788-add-and-save-property-alerts) · Reviews: [Awning](https://awning.com/post/mashvisor-review), [Hospitable](https://hospitable.com/mashvisor-review), [SparkRental](https://sparkrental.com/mashvisor-review/), [RealEstateSkills](https://www.realestateskills.com/blog/mashvisor-review), [GoSummer](https://www.gosummer.com/post/mashvisor-review), [BNBCalc](https://www.bnbcalc.com/reviews/mashvisor-review-2026), [10xBNB](https://learn.10xbnb.com/mashvisor-review/), [New Silver](https://newsilver.com/the-lender/mashvisor-review-with-pricing-alternatives/), [ModestMoney](https://www.modestmoney.com/mashvisor-review/), [CompareCamp](https://comparecamp.com/mashvisor-review-pricing-pros-cons-features/), [Tekpon](https://tekpon.com/deals/mashvisor-free-trial-demo/) · Trust: [Trustpilot](https://www.trustpilot.com/review/www.mashvisor.com), [BBB complaints](https://www.bbb.org/us/ca/campbell/profile/investment-advisory-services/mashvisor-1216-651297/complaints), [G2](https://www.g2.com/products/mashvisor/reviews), [Capterra](https://www.capterra.com/p/207377/Mashvisor/) · [Graphed: Export to Excel](https://www.graphed.com/blog/how-to-export-mashvisor-data-to-excel-or-csv) · [PRNewswire: ChatGPT App Directory](https://www.prnewswire.com/news-releases/mashvisor-launches-in-the-chatgpt-app-directory-giving-users-live-us-rental-investment-data-inside-their-ai-workflow-302763587.html)