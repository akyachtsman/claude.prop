# Zilculator (zilculator.com) — Competitive Teardown

*Method note: Zilculator's site blocks automated fetching, so this analysis is assembled from search-indexed copies of their marketing site, help center (help.zilculator.com), blog, and third-party reviews. All pages referenced are public. Confidence is high on features/flows/metrics, moderate on visual-design specifics.*

## 1. Information architecture

- **Public site nav:** Features, Pricing, Reviews (dedicated testimonial page), Marketplace, FAQ, Blog, Terms, plus Sign Up / Login. A large SEO sub-tree lives at `/real-estate-analysis/*` (metric glossary pages) and `/get/*` (dozens of versioned landing-page variants).
- **In-app structure (from help docs and indexed app URLs):** `Dashboard` (account info, notifications, usage stats) → `Properties` (the core object list; add/view properties) → per-property report at a shareable `/properties/{id}` URL → `Property Comparison` page → `Settings` (with a subscription tab). The **property is the atomic unit**; an "analysis" is not a separate object — you model scenarios by *copying a property* and changing assumptions.
- **Reports are public web pages first**, PDF second: each analysis renders as an interactive online report at a stable URL, shareable by email/social or downloadable as PDF.
- **White-label tenancy:** branded per-customer subdomains exist (e.g., `his.zilculator.com`, `lemaracommercial.zilculator.com`) with their own signup and settings — agents get an "inventory website" on a Zilculator subdomain or an embeddable plugin for their own site.
- **Help center IA** mirrors the product: "Analyzing & Marketing Properties" (~11 how-to articles: BRRRR, comparison, MLS loading, rental comps, publishing to marketplace) and "Account Management."

## 2. Core user flows

- **Add a property — a 4-step wizard:** (1) Property information, (2) Purchase information, (3) Rental information, (4) Resale information. Step 1 offers three entry paths: *copy an existing property*, *load from MLS® number*, or *manual entry*. For US addresses, it auto-searches public records and Zillow after you type the address.
- **MLS loader flow:** enter MLS #, click "Load," disambiguate if multiple matches; it pulls address, description, photos, listing price, listing agent, and listing history. Photos can also come from Zillow, Google Street View, or user upload.
- **Strategy selection:** rental / BRRRR (buy-rehab-rent-refinance) / fix & flip / wholesale / multi-family — the wizard adapts (e.g., BRRRR adds rehab budget + refinance step).
- **Rent estimation in-flow:** for US/Canada properties it shows Rentometer Pro estimates and loads up to 20 rental comps no older than 6 months, directly into the rental step.
- **View results:** claimed ~2 minutes from address to a finished interactive report; guided popups walk new users through the wizard (reviewers consistently cite "no learning curve").
- **Compare deals:** select 2+ properties → side-by-side comparison of purchase costs, rehab costs, financing, cash flow, profit, and return metrics, with the **best and worst value per metric auto-highlighted in green/red**. Unlimited properties/scenarios per comparison; comparison itself is shareable/exportable as a branded PDF. Scenario comparison (same property, different financing/rent/price) is done via property copies.

## 3. Content depth

- **Output metrics (confirmed):** cash flow (before/after tax), cap rate, NOI, cash-on-cash return, return on equity, IRR, NPV, GRM, DSCR/debt coverage ratio, break-even ratio, operating expense ratio, LTV, profitability index, taxable income, vacancy & credit loss, gross scheduled/operating income, acquisition costs, profit from sale, equity accumulation.
- **Report anatomy (from their "Property Report page" blog post):** Executive Summary → Property Description → Operation Effectiveness (annual operating data, cash flow, operating ratios) → Financing Overview & Analysis (acquisition-cost distribution chart; cumulative equity vs. declining mortgage balance chart) → Financial Effectiveness (NPV, IRR, CoC, RoE) → Long Term Financial Forecast (multi-year table of operations/financing/cash flow, toggleable between full view and "every 5th year" condensed view, with line charts of operating income and cash flow) → Resale Analysis.
- **Exit/sale modeling is a differentiator:** resale price estimated by **three methods — appreciation, cap rate & NOI, and GRM** — with sale proceeds, net assets, and yield; plus an **optimal holding period** computed by running NPV for a hypothetical sale in each year 1–30 (after-tax cash flows) and picking the max.
- **Inputs:** purchase price, closing costs, rehab budget, multiple financing methods incl. refinance (BRRRR), rent roll/income, itemized operating expenses with the notable ability to **schedule expenses in specific future years** (e.g., roof in year 7), vacancy, appreciation, rent/expense growth, tax/depreciation assumptions.
- **Depth ceiling:** residential-investor grade, not institutional — no tenant-level lease modeling, no WACC, no waterfall/partnership splits, no sensitivity matrices.

## 4. Onboarding, CTAs, conversion

- **Four plans: Free, Plus, Pro, Premium.** Free tier allows analyzing 2 properties (a real freemium, not just a trial). Premium is ~$29/mo; discounted annual pricing lands around $13.60–$23.20/mo, framed as "20% savings." Tiers gate primarily on **number of saved properties** (top tier unlimited) plus branding/marketing features.
- **Risk reversal:** 15-day money-back guarantee on paid plans; self-serve cancel from settings; playful affordability framing ("as affordable as 2 movie tickets a month").
- **First-run:** registration → Dashboard with notifications/stats → guided popups drive you into the property wizard. Reviewers call out that they never needed tutorial videos.
- **Aggressive landing-page machinery:** dozens of versioned pages (`/get/property-analysis-software-v1`, `-v58`, `-v61`) with `?deal=` partner/coach attribution codes, persona variants (real-estate-agent-software, wholesaling-software), and geo variants (investment-calculator-canada). They also absorbed RealEstateAnalysisFREE.com users via a dedicated migration page — a funnel-acquisition play.
- **Hero messaging** is speed + persona: deal analysis and marketing "in a matter of seconds" for "wholesalers, rehabbers, investors and realtors."

## 5. Category-specific tooling

- **Calculators/strategies:** rental, fix & flip, BRRRR, wholesale, multi-family, all in one wizard framework.
- **Data import:** MLS feed loader (photos, description, price, agent, history), Zillow + public records autofill by address, Rentometer Pro rent estimates, up to 20 recent rental comps, plus basic sales-comp CMA.
- **Reports:** interactive web report + auto-generated "PDF Property Package" combining the analysis report and a **marketing flyer**; custom branding (logo, address); share via email/Facebook link.
- **Comparison:** unlimited side-by-side property/scenario comparison with green/red best-worst highlighting, exportable as its own branded report.
- **Sensitivity:** no true sensitivity table; nearest equivalents are the NPV-based optimal-holding-period sweep and what-if via property copies.
- **Beyond analysis — a marketing/lead layer competitors lack:** publish deals to a public **off-market Marketplace** and to your own property-inventory page/subdomain/plugin, with lead-capture forms feeding your inbox or CRM.
- **Education library:** ~20 metric glossary pages (cap rate, IRR, NPV, DSCR, GRM, OER, etc.), each with formula + worked example + **downloadable Excel spreadsheet**.

## 6. Trust patterns

- **Social proof:** dedicated `/reviews` page of testimonials from named personas (agents using it daily for buyer reports, a "newbie developer" who "looks like a seasoned professional," portfolio investors); praise clusters on speed, report polish, and support ("kudos to Lisa" — support is a person, not a queue).
- **Methodology transparency (partial):** the metric glossary with formulas and downloadable Excel examples, plus blog posts explaining calculations (e.g., the NPV-based optimal holding period), effectively publish their math. However, a reviewer's explicit con: "Zilculator doesn't reveal much about how they go about their real estate analysis" — i.e., data-estimate provenance inside the app is opaque.
- **Borrowed authority:** heavy use of MLS®, Zillow®, Rentometer Pro® trademarks as data-source credibility.
- **Weak third-party proof:** SourceForge/Slashdot listings show zero reviews and 0.0 ratings; no G2/Capterra presence — the social proof is almost entirely first-party.

## 7. Experiential layer

- **Overall impression (from reviews + indexed markup; site blocks direct inspection):** a utilitarian, form-driven web app whose *reports* carry the visual ambition — the app is the workbench, the report is the product. Reviewers describe it as clean and friendly rather than dense or "pro-tool."
- **Landing/hero:** persona-led, speed-led copy ("analysis and marketing in seconds"), with report screenshots and a low-friction free signup as the primary CTA; long-form persona landing pages carry testimonial blocks and feature walkthroughs.
- **Dashboard:** modest — account info, notifications, stats; the density lives in the Properties list and the report pages, not the dashboard.
- **Report visual hierarchy:** listing-photo-led header → executive summary → alternating tables and charts (acquisition-cost distribution, equity-vs-mortgage curves, operating income/cash-flow line charts) → resale section. A "full vs. every-5th-year" toggle on the forecast table is a nice density control.
- **Interaction patterns:** step-wizard with contextual guide popups; red/green conditional coloring in comparisons; one-click social sharing on reports. They maintain a Dribbble account, suggesting deliberate design investment in report/flyer templates.
- **Gaps:** no mobile app (browser only); no visible motion/animation language; the in-app forms read as standard-framework UI rather than a distinctive design system.

## Steal-worthy patterns

- **Three-path property intake** (copy existing / auto-load from listing data by address or ID / manual), with autofill from public records so the first wizard step feels magic, not like data entry.
- **Reports as shareable public web pages first, PDF second** — a stable per-analysis URL turns every underwriting into a distribution/virality surface, and enables branding for the pro sending it.
- **Green/red best-worst auto-highlighting per metric row** in the multi-property comparison — the cheapest possible "decision layer" on top of a comparison table, and users specifically cite it.
- **Triangulated exit-value modeling** (appreciation % vs. cap-rate-on-exit-NOI vs. GRM) plus an **NPV-swept optimal holding period** — richer exit thinking than a single terminal-value input, and very buildable on top of an existing IRR/NPV engine.
- **Year-scheduled expenses** (put a roof in year 7) — one small input pattern that makes a 5-year pro-forma feel like real underwriting instead of flat-growth extrapolation.
- **Density toggle on long forecasts** ("full view / every 5th year") — solves the 30-row pro-forma readability problem elegantly.
- **Methodology-as-marketing:** a glossary page per metric (formula + worked example + downloadable spreadsheet) that doubles as SEO, onboarding education, and an accuracy-trust signal.
- **Scenario-by-duplication** as an MVP for sensitivity: cloning a deal with different financing/rent/price and feeding clones into the same comparison view covers 80% of what-if needs before you build a real sensitivity matrix.

## Weaknesses / gaps

- **No true sensitivity analysis** — no tornado tables or rate/rent/vacancy matrices; what-if requires manually cloning properties, which pollutes the property list (analysis and property are conflated as one object).
- **Thin, first-party-only social proof** — zero reviews on SourceForge/Slashdot, no G2/Capterra footprint; all testimonials live on their own domain, and in-app data estimates lack provenance ("doesn't reveal how they do the analysis").
- **No mobile app** and an in-app UI that reviewers describe as merely "clean" — the design investment goes to reports, leaving the working surface (dashboard, property list) generic and stat-poor.
- **Residential-investor ceiling:** no tenant/lease-level modeling, no DSCR-lender workflows, no WACC/partnership waterfalls — a professional underwriting dashboard can out-depth them while matching their speed.
- **Identity split between analysis and marketing/lead-gen** (marketplace, flyers, inventory sites) dilutes the analytics story and dates the product toward agent marketing rather than serious underwriting.

## Sources

- [Zilculator homepage](https://www.zilculator.com/) · [Features](https://www.zilculator.com/features) · [Pricing](https://www.zilculator.com/pricing) · [Reviews](https://www.zilculator.com/reviews) · [FAQ](https://www.zilculator.com/faq) · [Marketplace](https://www.zilculator.com/marketplace) · [Terms](https://www.zilculator.com/terms)
- Help center: [How to Analyze a BRRRR Deal](https://help.zilculator.com/en/analyzing-marketing-properties/how-to-analyze-a-brrrr-deal) · [Load Property Details from MLS](https://help.zilculator.com/en/analyzing-marketing-properties/how-to-load-property-details-from-mls-r) · [Compare Two or More Investment Properties](https://help.zilculator.com/en/analyzing-marketing-properties/how-to-compare-two-or-more-investment-properties) · [Rental Comps & Rentometer](https://help.zilculator.com/en/analyzing-marketing-properties/how-to-load-rental-comps-and-get-rentometer-estimates) · [Publish to Inventory Page & Marketplace](https://help.zilculator.com/en/analyzing-marketing-properties/how-to-publish-property-to-my-property-inventory-page-and-marketplace)
- Zilculator blog: [Property Report page](https://www.zilculator.com/blog/real-estate-analysis-free-property-report-page/) · [Optimal Holding Period calculation](https://www.zilculator.com/blog/optimal-holding-period-calculation/)
- Glossary examples: [DSCR](https://www.zilculator.com/real-estate-analysis/debt-service-coverage-ratio-dscr-formula-excel-example) · [Cap Rate](https://www.zilculator.com/real-estate-analysis/calculate-cap-rate-formula-excel-example) · [IRR](https://www.zilculator.com/real-estate-analysis/calculate-irr-formula-excel-example) · [NOI](https://www.zilculator.com/real-estate-analysis/calculate-noi-formula-excel-example)
- Third-party: [SourceForge listing](https://sourceforge.net/software/product/Zilculator/) · [Slashdot listing](https://slashdot.org/software/p/Zilculator/) · [Tre Pryor review](https://trepryor.com/blog/zilculator-review/) · [Everything SaaS review](https://everythingflex.com/zilculator-property-analysis-saas-review/) · [Edinhart calculator roundup](https://edinhart.com/real-estate-investment-calculators/) · [estateagentnetworking PropTech review](https://estateagentnetworking.co.uk/proptech-review-zilculator/) · [Zilculator on Dribbble](https://dribbble.com/Zilculator)