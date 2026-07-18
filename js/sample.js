// sample.js — the "715 Plumas St" demo deal (first-run "Load sample").
// Reflects the ACTUAL closed transaction (715 Plumas St, Yuba City, CA 95991),
// reconstructed from the Orange Coast Title settlement statement (close of
// escrow 2025-09-22) and the Five Star Bank loan record: $1,300,000 purchase,
// a single $945,000 loan at 6.19% (25-yr amortization, 10-yr maturity —
// origination 2025-09-08, matures 2035-09-08), insurance $9,073/yr (Bass
// Underwriters), property tax reassessed at ~1.1% of the $1.3M basis. The rent
// roll is unchanged (owner-confirmed). At the price actually paid this is a
// value-add profile that does not yet cash-flow (DSCR 0.84, negative near-term
// NPV) — the numbers fall where they fall. EXPECTED holds the known-good metric
// values the fidelity test asserts against (SC-1), computed by the shipped
// js/model.js, including the owner-approved NPV correction (initial investment
// undiscounted; workbook-model.md Fidelity note 3).

export function sampleProperty() {
  return {
    id: 'sample-715-plumas',
    schemaVersion: 1,
    // Bumped whenever the built-in sample's figures change, so a stale copy
    // saved in a returning visitor's localStorage auto-refreshes on boot
    // (see refreshBuiltinSample in app.js). rev 2 = the actual-close rebuild;
    // rev 3 = empty Target CAP/DSCR (pills use the hard-coded benchmark).
    sampleRev: 3,
    name: '715 Plumas St — Commercial',
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
    info: {
      propertyType: 'Retail', askingPrice: 1350000, rentableSF: 11562, lotSize: '18,731 sf', yearBuilt: 1940,
      zoning: 'C1', hvacAge: '1 yr', roofAge: '—', parking: '—',
      ceilingHeight: '—', appraisedValue: 0, apn: '—',
      bedrooms: '—', baths: '—',
    },
    targets: { desiredCap: 0, desiredDscr: 0 },
    offer: { offerPrice: 1300000, fees: 0, improvements: 0 },
    loans: [
      // 72.69% LTV → ~$944,970 on the $1.3M price (documented loan $945,000).
      // 25-yr amortization, 10-yr maturity → a balloon comes due at yr 10
      // (must be refinanced; origination 2025-09-08 → matures 2035-09-08).
      { ltv: 0.7269, rate: 0.0619, termYears: 25, maturityYears: 10, type: 'CONV' },
    ],
    tenants: [
      { name: 'smoke shop', sf: 2679, monthlyIncome: 2500, leaseExpires: '2030-01-31', leaseOptions: '—' },
      { name: 'perfection', sf: 3290, monthlyIncome: 2500, leaseExpires: '2028-05-01', leaseOptions: '—' },
      { name: 'perfection', sf: 2914, monthlyIncome: 2500, leaseExpires: '2028-05-01', leaseOptions: '—' },
      { name: 'side space', sf: 2679, monthlyIncome: 0, leaseExpires: '2030-05-31', leaseOptions: '—' },
    ],
    expenses: [
      { key: 'insurance', label: 'Insurance', amount: 9073, included: true, estimated: false },
      { key: 'taxes', label: 'Property taxes', amount: 14300, included: true, estimated: true },
      { key: 'hoa', label: 'HOA', amount: 0, included: true, estimated: false },
      { key: 'utilities', label: 'Utilities', amount: 0, included: true, estimated: false },
      { key: 'management', label: 'Management', amount: 4500, included: false, estimated: false },
      { key: 'maintenance', label: 'Maintenance', amount: 0, included: true, estimated: false },
      { key: 'landscaping', label: 'Landscaping', amount: 0, included: true, estimated: false },
      { key: 'cleaning', label: 'Cleaning', amount: 0, included: true, estimated: false },
      { key: 'misc', label: 'Misc', amount: 12000, included: false, estimated: false },
    ],
    assumptions: {
      minOppCostEquity: 0.15, taxRate: 0.28, collectionLoss: 0.05,
      cashflowAppr: 0.03, capitalAppr: 0.02,
    },
  };
}

// Three more demo deals, seeded once alongside 715 (see seedDemos in app.js) so
// the Compare view has a richer, varied field without any data entry. Spread
// deliberately across the quality range — a strong industrial NNN, an
// overpriced trophy office that doesn't cover its debt, and a steady mid-market
// apartment — so best/worst highlighting varies column to column. Same
// assumptions as 715 for an apples-to-apples model. Fixed ids make the seed
// idempotent. Invented addresses / rent rolls — illustrative only.
export function demoProperties() {
  const baseAssumptions = {
    minOppCostEquity: 0.15, taxRate: 0.28, collectionLoss: 0.05,
    cashflowAppr: 0.03, capitalAppr: 0.02,
  };
  const at = '2026-07-16T00:00:00.000Z';
  return [
    {
      id: 'demo-2201-del-paso', schemaVersion: 1,
      name: '2201 Del Paso Blvd — Industrial', createdAt: at, updatedAt: at,
      info: {
        propertyType: 'Industrial', askingPrice: 1250000, rentableSF: 14200, lotSize: '1.1 ac', yearBuilt: 1978,
        zoning: 'M1', hvacAge: '—', roofAge: '4 yr', parking: 'Yard + 18',
        ceilingHeight: '22 ft', appraisedValue: 0, apn: '—', bedrooms: '—', baths: '—',
      },
      targets: { desiredCap: 0, desiredDscr: 0 },
      offer: { offerPrice: 1200000, fees: 0, improvements: 0 },
      loans: [{ ltv: 0.65, rate: 0.068, termYears: 25, maturityYears: 10, type: 'CONV' }],
      tenants: [
        { name: 'Regional distributor', sf: 9800, monthlyIncome: 6200, leaseExpires: '2032-03-31', leaseOptions: '2×5 yr' },
        { name: 'Fabrication shop', sf: 4400, monthlyIncome: 3300, leaseExpires: '2029-11-30', leaseOptions: '1×5 yr' },
      ],
      expenses: [
        { key: 'insurance', label: 'Insurance', amount: 6000, included: true, estimated: false },
        { key: 'taxes', label: 'Property taxes', amount: 13200, included: true, estimated: true },
        { key: 'hoa', label: 'HOA', amount: 0, included: true, estimated: false },
        { key: 'utilities', label: 'Utilities', amount: 0, included: true, estimated: false },
        { key: 'management', label: 'Management', amount: 5700, included: false, estimated: true },
        { key: 'maintenance', label: 'Maintenance', amount: 0, included: true, estimated: false },
        { key: 'landscaping', label: 'Landscaping', amount: 0, included: true, estimated: false },
        { key: 'cleaning', label: 'Cleaning', amount: 0, included: true, estimated: false },
        { key: 'misc', label: 'Misc', amount: 0, included: true, estimated: false },
      ],
      assumptions: { ...baseAssumptions },
    },
    {
      id: 'demo-88-capitol-mall', schemaVersion: 1,
      name: '88 Capitol Mall — Office', createdAt: at, updatedAt: at,
      info: {
        propertyType: 'Office', askingPrice: 2500000, rentableSF: 12500, lotSize: '0.4 ac', yearBuilt: 2002,
        zoning: 'C3', hvacAge: '6 yr', roofAge: '9 yr', parking: 'Structure',
        ceilingHeight: '9 ft', appraisedValue: 0, apn: '—', bedrooms: '—', baths: '—',
      },
      targets: { desiredCap: 0, desiredDscr: 0 },
      offer: { offerPrice: 2400000, fees: 0, improvements: 0 },
      loans: [{ ltv: 0.70, rate: 0.066, termYears: 25, maturityYears: 10, type: 'CONV' }],
      tenants: [
        { name: 'Law firm', sf: 6000, monthlyIncome: 7500, leaseExpires: '2028-06-30', leaseOptions: '—' },
        { name: 'Title company', sf: 4000, monthlyIncome: 4200, leaseExpires: '2027-12-31', leaseOptions: '—' },
        { name: 'Coworking suite', sf: 2500, monthlyIncome: 1800, leaseExpires: '2026-12-31', leaseOptions: '—' },
      ],
      expenses: [
        { key: 'insurance', label: 'Insurance', amount: 12000, included: true, estimated: false },
        { key: 'taxes', label: 'Property taxes', amount: 26400, included: true, estimated: true },
        { key: 'hoa', label: 'HOA', amount: 0, included: true, estimated: false },
        { key: 'utilities', label: 'Utilities', amount: 9600, included: true, estimated: true },
        { key: 'management', label: 'Management', amount: 9720, included: false, estimated: true },
        { key: 'maintenance', label: 'Maintenance', amount: 0, included: true, estimated: false },
        { key: 'landscaping', label: 'Landscaping', amount: 0, included: true, estimated: false },
        { key: 'cleaning', label: 'Cleaning', amount: 6000, included: true, estimated: true },
        { key: 'misc', label: 'Misc', amount: 0, included: true, estimated: false },
      ],
      assumptions: { ...baseAssumptions },
    },
    {
      id: 'demo-540-n-street', schemaVersion: 1,
      name: '540 N Street — Apartments', createdAt: at, updatedAt: at,
      info: {
        propertyType: 'Multifamily', askingPrice: 1075000, rentableSF: 5200, lotSize: '7,000 sf', yearBuilt: 1962,
        zoning: 'R3', hvacAge: '—', roofAge: '7 yr', parking: '8 spaces',
        ceilingHeight: '8 ft', appraisedValue: 0, apn: '—', bedrooms: '8', baths: '8',
      },
      targets: { desiredCap: 0, desiredDscr: 0 },
      offer: { offerPrice: 1050000, fees: 0, improvements: 0 },
      loans: [{ ltv: 0.72, rate: 0.061, termYears: 25, maturityYears: 10, type: 'CONV' }],
      tenants: [
        { name: 'Unit 1 — 2BR', sf: 900, monthlyIncome: 2100, leaseExpires: '2027-01-31', leaseOptions: '—' },
        { name: 'Unit 2 — 2BR', sf: 900, monthlyIncome: 2100, leaseExpires: '2027-04-30', leaseOptions: '—' },
        { name: 'Unit 3 — 1BR', sf: 700, monthlyIncome: 1700, leaseExpires: '2026-10-31', leaseOptions: '—' },
        { name: 'Unit 4 — 1BR', sf: 700, monthlyIncome: 1700, leaseExpires: '2027-02-28', leaseOptions: '—' },
      ],
      expenses: [
        { key: 'insurance', label: 'Insurance', amount: 5200, included: true, estimated: false },
        { key: 'taxes', label: 'Property taxes', amount: 11550, included: true, estimated: true },
        { key: 'hoa', label: 'HOA', amount: 0, included: true, estimated: false },
        { key: 'utilities', label: 'Utilities', amount: 4800, included: true, estimated: true },
        { key: 'management', label: 'Management', amount: 5700, included: false, estimated: true },
        { key: 'maintenance', label: 'Maintenance', amount: 6000, included: true, estimated: true },
        { key: 'landscaping', label: 'Landscaping', amount: 1200, included: true, estimated: true },
        { key: 'cleaning', label: 'Cleaning', amount: 0, included: true, estimated: false },
        { key: 'misc', label: 'Misc', amount: 0, included: true, estimated: false },
      ],
      assumptions: { ...baseAssumptions },
    },
  ];
}

// Known-good metric values (rounded) for the fidelity test (SC-1), computed by
// the shipped js/model.js from the actual-close inputs above. This is a
// value-add deal that does not yet cash-flow at the price paid: NOI covers only
// ~0.84× debt service, so cash-on-cash and near-term NPV are negative — the
// engine reports it honestly rather than flattering the deal.
export const EXPECTED = {
  noi: 66627,
  cap: 0.0513,         // 5.13%
  dscr: 0.84,
  noiDebtService: -7757,
  noiLessCollection: 62127,
  cashOnCash: -0.0218, // -2.18%
  returnOnCost: 0.1877,
  onePctRule: -5500,
  wacc: 0.07336,
  annualDebt: 74384,
  allInCost: 355030,
  totalRent: 90000,
  npv: -29512,         // negative at the price paid (app-corrected NPV)
  totalReturn: 94121,
  irr: 0.0529,         // ~5.29%
  // 10-year hold projection (forward projection)
  npv10: -45941,
  totalReturn10: 195766,
  irr10: 0.0548,       // ~5.48%
};
