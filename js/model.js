// model.js — the fidelity core. Pure calc engine mirroring workbook-model.md
// with the two owner-approved corrections (spec.md Clarifications 1):
//   (a) YR-1 cashflow subtracts BOTH loans' payments.
//   (b) NPV = -allInCost + Σ(t=1..5) CFₜ/(1+WACC)ᵗ  (initial undiscounted).
// No DOM, no storage, no globals. compute(property) → metrics.

const HOLD_YEARS = 5;
const MAX_YEARS = 10;

/** Safe divide: null on divide-by-zero / non-finite (renders as "—"). */
function div(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  const r = a / b;
  return Number.isFinite(r) ? r : null;
}

function num(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** Monthly payment for one loan. CONV = amortizing; IO = interest-only;
 *  anything else → null (surfaced as an error, never a wrong number). */
export function loanPayment({ amount, rate, termYears, type }) {
  const p = num(amount), r = num(rate) / 12, n = num(termYears) * 12;
  if (type === 'IO') return p * r;
  if (type === 'CONV') {
    if (r === 0) return n > 0 ? p / n : null;
    if (n <= 0) return null;
    return (p * r) / (1 - Math.pow(1 + r, -n));
  }
  return null; // invalid type
}

/** Outstanding principal after `monthsPaid` payments on an amortizing loan —
 *  i.e. the balloon that comes due if the note matures before it fully
 *  amortizes. Payment is unaffected (it is sized off the amortization term);
 *  this only reports what is still owed at maturity. IO loans never amortize,
 *  so the whole principal balloons. Returns 0 once fully amortized. */
export function remainingBalance({ amount, rate, termYears, type }, monthsPaid) {
  const p = num(amount), r = num(rate) / 12, n = num(termYears) * 12, k = num(monthsPaid);
  if (p <= 0) return 0;
  if (k <= 0) return p;
  if (type === 'IO') return p;            // interest-only: principal never reduces
  if (type !== 'CONV') return p;          // unknown type: assume no amortization
  if (k >= n) return 0;                   // fully paid off by maturity
  if (r === 0) return p * (1 - k / n);    // zero-interest: linear paydown
  // Balance_k = P(1+r)^k − PMT · ((1+r)^k − 1)/r
  const pmt = loanPayment({ amount: p, rate, termYears, type });
  const g = Math.pow(1 + r, k);
  return Math.max(0, p * g - pmt * (g - 1) / r);
}

/** Internal rate of return via bisection on the full series [initial, CF1..CFn].
 *  Returns null when the series never crosses zero (no real IRR). */
export function irr(series) {
  // IRR is undefined without an initial outflow and at least one inflow.
  if (!(series[0] < 0)) return null;
  if (!series.slice(1).some((c) => c > 0)) return null;
  const npvAt = (rate) => series.reduce((s, cf, i) => s + cf / Math.pow(1 + rate, i), 0);
  const lo0 = -0.9999, hi0 = 10;
  const fLo = npvAt(lo0), fHi = npvAt(hi0);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo === 0 || fHi === 0 || fLo * fHi > 0) return null;
  let lo = lo0, hi = hi0;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, f = npvAt(mid);
    if (Math.abs(f) < 1e-6) return mid;
    if (fLo * f < 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Compute every derived metric for a Property. */
export function compute(property) {
  const p = property || {};
  const info = p.info || {}, offer = p.offer || {}, a = p.assumptions || {};
  const loans = p.loans || [], tenants = p.tenants || [], expenses = p.expenses || [];

  const offerPrice = num(offer.offerPrice);
  const collectionLoss = num(a.collectionLoss);
  const taxRate = num(a.taxRate);
  const minOpp = num(a.minOppCostEquity);

  // Financing
  const loanCalc = loans.map((ln) => {
    const amount = offerPrice * num(ln.ltv);
    const payment = loanPayment({ ...ln, amount });
    // A commercial note often matures (comes due) before its amortization term
    // ends, leaving a balloon that must be refinanced or paid. This is
    // reported for context only — it does not change the payment, DSCR, or NPV
    // (a refinance is cash-neutral at maturity).
    const maturityYears = num(ln.maturityYears);
    const hasBalloon = amount > 0 && maturityYears > 0 && maturityYears < num(ln.termYears);
    const balloon = hasBalloon ? remainingBalance({ ...ln, amount }, maturityYears * 12) : null;
    return { ...ln, amount, payment, maturityYears, hasBalloon, balloon };
  });
  const pmt1 = loanCalc[0] ? loanCalc[0].payment : 0;
  const pmt2 = loanCalc[1] ? loanCalc[1].payment : 0;
  const paymentsValid = [pmt1, pmt2].every((x) => x === null ? false : true);
  const monthlyDebt = (num(pmt1) + num(pmt2));
  const annualDebt = monthlyDebt * 12;
  const financeTotal = loanCalc.reduce((s, l) => s + num(l.amount), 0);
  const allInCost = offerPrice - financeTotal + num(offer.fees) + num(offer.improvements);

  // Income
  const totalMonthlyRent = tenants.reduce((s, t) => s + num(t.monthlyIncome), 0);
  const totalRent = totalMonthlyRent * 12;
  const totalTenantSF = tenants.reduce((s, t) => s + num(t.sf), 0);
  const avgRentPerSF = div(totalMonthlyRent, totalTenantSF);
  const rentLessCollection = totalRent * (1 - collectionLoss);
  const tenantRentPerSF = tenants.map((t) => div(num(t.monthlyIncome), num(t.sf)));

  // Expenses
  const includedExpense = expenses.reduce((s, e) => s + (e.included ? num(e.amount) : 0), 0);
  const allExpense = expenses.reduce((s, e) => s + num(e.amount), 0);
  const noi = totalRent - includedExpense;
  const noiLessCollection = rentLessCollection - includedExpense;
  const expensePctOfNoi = expenses.map((e) => div(num(e.amount), noi));

  // Headline metrics
  const cap = div(noi, offerPrice);
  const dscr = annualDebt <= 0 ? null : div(noiLessCollection, annualDebt);
  const noiDebtService = noi - annualDebt;
  const cashOnCash = div(noiDebtService, allInCost);
  const returnOnCost = div(noi, allInCost);
  const onePctRule = totalMonthlyRent - offerPrice * 0.01;
  const wacc = loanCalc.reduce((s, l) => s + num(l.ltv) * num(l.rate) * (1 - taxRate), 0)
    + (1 - loanCalc.reduce((s, l) => s + num(l.ltv), 0)) * minOpp;

  // Pro-forma projections (correction a: YR-1 subtracts BOTH loans via annualDebt).
  // The 5-year hold is the fidelity baseline (unchanged); the 10-year hold is a
  // forward projection using the same assumptions, with the return of equity
  // deferred to the final held year.
  const cfAppr = num(a.cashflowAppr), capAppr = num(a.capitalAppr);
  // Operating cashflow (no equity return) and appreciation, per year 1..MAX_YEARS.
  const operating = [];
  { let ob = totalRent - includedExpense - annualDebt;
    for (let t = 1; t <= MAX_YEARS; t++) { operating.push(ob); ob = ob * (1 + cfAppr); } }
  const apprYear = [];
  { let acc = 0;
    for (let t = 1; t <= MAX_YEARS; t++) { const inc = (offerPrice + acc) * capAppr; apprYear.push(inc); acc += inc; } }

  // One hold scenario for horizon H: series indexed 0..H (index 0 = initial
  // outflow), equity (all-in cost) returned in the final year H. Correction b:
  // NPV leaves the initial investment undiscounted.
  function holdScenario(H) {
    const cashflow = [-allInCost], appreciation = [0], combined = [-allInCost];
    for (let t = 1; t <= H; t++) {
      const cf = operating[t - 1] + (t === H ? allInCost : 0);
      const ap = apprYear[t - 1];
      cashflow.push(cf); appreciation.push(ap); combined.push(cf + ap);
    }
    const npv = -allInCost + combined.slice(1).reduce((s, c, i) => s + c / Math.pow(1 + wacc, i + 1), 0);
    return { years: H, cashflow, appreciation, combined, npv,
      totalReturn: combined.reduce((s, c) => s + c, 0), irr: irr(combined) };
  }
  const h5 = holdScenario(HOLD_YEARS), h10 = holdScenario(MAX_YEARS);
  // Headline stays the 5-year hold (KPI strip, EXPECTED, S5 fidelity).
  const irrValue = h5.irr, npv = h5.npv, totalReturn = h5.totalReturn;

  return {
    // financing
    loans: loanCalc, pmt1, pmt2, paymentsValid, annualDebt, monthlyDebt,
    financeTotal, allInCost,
    // income
    totalMonthlyRent, totalRent, totalTenantSF, avgRentPerSF, rentLessCollection,
    tenantRentPerSF,
    // expenses
    includedExpense, allExpense, expensePctOfNoi,
    // headline (5-year hold)
    noi, noiLessCollection, cap, dscr, noiDebtService, cashOnCash, returnOnCost,
    onePctRule, wacc, irr: irrValue, npv, totalReturn,
    // proforma: per-year series + both hold horizons; legacy 5-year aliases kept
    proforma: {
      operating, apprYear, maxYears: MAX_YEARS, h5, h10,
      cashflow: h5.cashflow, appreciation: h5.appreciation, combined: h5.combined, years: HOLD_YEARS,
    },
  };
}

/** Pass/fail verdict helpers (label + value, never color alone). */
export function capVerdict(cap, targetCap) {
  if (cap === null || !Number.isFinite(num(targetCap))) return null;
  return cap >= num(targetCap);
}
export function dscrVerdict(dscr, targetDscr) {
  if (dscr === null || !Number.isFinite(num(targetDscr))) return null;
  return dscr >= num(targetDscr);
}
export function onePctVerdict(onePctRule) {
  if (onePctRule === null || onePctRule === undefined) return null;
  return onePctRule >= 0;
}
