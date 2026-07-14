// sample.js — the "1042 Maple Ave" demo deal (first-run "Load sample").
// EXPECTED holds known-good metric values the fidelity test asserts against
// (SC-1). Values verified against the corrected workbook model.

export function sampleProperty() {
  return {
    id: 'sample-1042-maple',
    schemaVersion: 1,
    name: '1042 Maple Ave — Duplex',
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
    info: {
      askingPrice: 485000, rentableSF: 2400, lotSize: '0.21 ac', yearBuilt: 1998,
      zoning: 'R-2', hvacAge: '6 yr', roofAge: '9 yr', parking: '4 / paved',
      ceilingHeight: '8 ft', appraisedValue: 470000, apn: '042-118-77',
      bedrooms: '2 × 2', baths: '2 × 2',
    },
    targets: { desiredCap: 0.06, desiredDscr: 1.25 },
    offer: { offerPrice: 460000, fees: 4600, improvements: 15000 },
    loans: [
      { ltv: 0.70, rate: 0.065, termYears: 25, type: 'CONV' },
      { ltv: 0, rate: 0.065, termYears: 25, type: 'IO' },
    ],
    tenants: [
      { name: 'Unit A', sf: 1200, monthlyIncome: 2150, leaseExpires: 'Mar 2027', leaseOptions: '1 × 2 yr' },
      { name: 'Unit B', sf: 1200, monthlyIncome: 2050, leaseExpires: 'Nov 2026', leaseOptions: '—' },
      { name: '', sf: 0, monthlyIncome: 0, leaseExpires: '', leaseOptions: '' },
      { name: '', sf: 0, monthlyIncome: 0, leaseExpires: '', leaseOptions: '' },
    ],
    expenses: [
      { key: 'insurance', label: 'Insurance', amount: 3000, included: true, estimated: true },
      { key: 'taxes', label: 'Property taxes', amount: 5520, included: true, estimated: true },
      { key: 'cam', label: 'CAM', amount: 0, included: false, estimated: false },
      { key: 'hoa', label: 'HOA', amount: 0, included: false, estimated: false },
      { key: 'utilities', label: 'Utilities', amount: 1800, included: true, estimated: false },
      { key: 'management', label: 'Management', amount: 3024, included: true, estimated: false },
      { key: 'maintenance', label: 'Maintenance', amount: 2520, included: true, estimated: false },
      { key: 'landscaping', label: 'Landscaping', amount: 960, included: true, estimated: false },
      { key: 'cleaning', label: 'Cleaning', amount: 0, included: false, estimated: false },
    ],
    assumptions: {
      minOppCostEquity: 0.15, taxRate: 0.28, collectionLoss: 0.05,
      cashflowAppr: 0.02, capitalAppr: 0.02,
    },
  };
}

// Known-good metric values (rounded) for the fidelity test (SC-1).
export const EXPECTED = {
  noi: 33576,
  cap: 0.0730,        // 7.30%
  dscr: 1.19,
  noiDebtService: 7486,
  noiLessCollection: 31056,
  cashOnCash: 0.0475, // 4.75%
  returnOnCost: 0.2130,
  onePctRule: -400,
  wacc: 0.07776,
  annualDebt: 26090,
  allInCost: 157600,
  totalRent: 50400,
  npv: 20325,
  totalReturn: 86835,
  irr: 0.1097,        // ~10.97%
};
