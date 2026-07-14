// sample.js — the "715 Plumas St" demo deal (first-run "Load sample").
// Mapped from the owner's workbook (715 Plumas St, Yuba City, CA 95991 —
// "Example 1"). EXPECTED holds known-good metric values the fidelity test
// asserts against (SC-1), computed by the shipped js/model.js. Every KPI
// matches the workbook to the penny EXCEPT 5Y NPV, which reflects the
// owner-approved NPV correction (initial investment undiscounted;
// workbook-model.md Fidelity note 3): app $91,523 vs workbook $85,264.

export function sampleProperty() {
  return {
    id: 'sample-715-plumas',
    schemaVersion: 1,
    name: '715 Plumas St — Commercial',
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
    info: {
      askingPrice: 1350000, rentableSF: 11562, lotSize: '18,731 sf', yearBuilt: 1940,
      zoning: 'C1', hvacAge: '1 yr', roofAge: '—', parking: '—',
      ceilingHeight: '—', appraisedValue: 0, apn: '—',
      bedrooms: '—', baths: '—',
    },
    targets: { desiredCap: 0, desiredDscr: 0 },
    offer: { offerPrice: 895000, fees: 0, improvements: 0 },
    loans: [
      { ltv: 0.727, rate: 0.062, termYears: 25, type: 'CONV' },
      { ltv: 0, rate: 0.065, termYears: 25, type: 'IO' },
    ],
    tenants: [
      { name: 'smoke shop', sf: 2679, monthlyIncome: 2500, leaseExpires: 'Jan 2030', leaseOptions: '—' },
      { name: 'perfection', sf: 3290, monthlyIncome: 2500, leaseExpires: 'May 2028', leaseOptions: '—' },
      { name: 'perfection', sf: 2914, monthlyIncome: 2500, leaseExpires: 'May 2028', leaseOptions: '—' },
      { name: 'side space', sf: 2679, monthlyIncome: 0, leaseExpires: 'May 2030', leaseOptions: '—' },
    ],
    expenses: [
      { key: 'insurance', label: 'Insurance', amount: 7300, included: true, estimated: true },
      { key: 'taxes', label: 'Property taxes', amount: 10740, included: true, estimated: true },
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

// Known-good metric values (rounded) for the fidelity test (SC-1). Verified
// against the 715 Plumas workbook: 16/17 match to the penny; npv is the
// app's corrected value ($91,523), not the workbook's $85,264 (see header).
export const EXPECTED = {
  noi: 71960,
  cap: 0.0804,        // 8.04%
  dscr: 1.32,
  noiDebtService: 20694,
  noiLessCollection: 67460,
  cashOnCash: 0.0847, // 8.47%
  returnOnCost: 0.2945,
  onePctRule: -1450,
  wacc: 0.07340,
  annualDebt: 51266,
  allInCost: 244335,
  totalRent: 90000,
  npv: 91523,         // app-corrected (workbook shows $85,264)
  totalReturn: 203021,
  irr: 0.1649,        // ~16.49%
};
