// views/dashboard.js — the one-screen property dashboard: editable inputs,
// live recompute, KPI strip, 5yr pro-forma, expense toggles, methodology.
// Inputs stay mounted (focus preserved); only output nodes refresh on edit.

import { el, render } from '../dom.js';
import * as fmt from '../format.js';
import { compute, capVerdict, dscrVerdict, onePctVerdict } from '../model.js';
import { NOTES } from '../notes.js';

const DEBOUNCE = 120;

// ── small field builders ───────────────────────────────────────────────
function fieldNum(value, onChange, opts = {}) {
  const input = el('input', {
    class: 'input' + (opts.estimate ? ' input--estimate' : ''),
    type: 'number', step: opts.step || 'any', inputmode: 'decimal',
    value: value ?? '', 'aria-label': opts.label || '',
  });
  input.addEventListener('input', () => onChange(input.value === '' ? 0 : parseFloat(input.value)));
  return input;
}
function fieldText(value, onChange, opts = {}) {
  const input = el('input', { class: 'input', type: 'text', value: value ?? '', 'aria-label': opts.label || '' });
  input.addEventListener('input', () => onChange(input.value));
  return input;
}
// Percentage entry: the model stores a decimal (0.09) but the user types/reads
// percent (9). onChange still receives the decimal.
function fieldPercent(value, onChange, opts = {}) {
  const shown = (value === '' || value == null) ? '' : String(parseFloat((value * 100).toFixed(6)));
  const wrap = el('span', { class: 'input-pct' }, [
    el('input', {
      class: 'input', type: 'number', step: opts.step || '0.1', inputmode: 'decimal',
      value: shown, 'aria-label': opts.label || '',
    }),
    el('span', { class: 'input-pct__sign', text: '%' }),
  ]);
  const input = wrap.firstChild;
  input.addEventListener('input', () => onChange(input.value === '' ? 0 : parseFloat(input.value) / 100));
  return wrap;
}
function fieldDate(value, onChange, opts = {}) {
  const input = el('input', { class: 'input', type: 'date', value: value ?? '', 'aria-label': opts.label || '' });
  input.addEventListener('input', () => onChange(input.value));
  return input;
}
function fieldSelect(value, options, onChange, label) {
  const sel = el('select', { class: 'input', 'aria-label': label || '' },
    options.map((o) => el('option', { value: o, selected: o === value ? true : null, text: o })));
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

// ── main render ─────────────────────────────────────────────────────────
export function renderDashboard(container, ctx) {
  const prop = ctx.property;               // working copy (mutable)
  const out = {};                          // output nodes we refresh
  let timer = null;
  let firstPaint = true;                   // suppress change-flash on initial render

  // Soft "this value just changed" cue: the values changed by the latest edit
  // keep a faint highlight until the next edit, which clears them and marks the
  // newly-changed ones. Suppressed on the initial render.
  const flashed = [];
  function clearFlashes() { flashed.forEach((n) => n.classList.remove('flash')); flashed.length = 0; }
  function flash(node) {
    if (!node) return;
    node.classList.add('flash');
    flashed.push(node);
  }
  function setText(node, value) {
    const s = String(value);
    if (node.textContent === s) return;
    node.textContent = s;
    if (!firstPaint) flash(node);
  }

  function refresh() {
    const m = compute(prop);
    ctx.setHeaderVerdicts(m, prop);        // topbar pills
    ctx.markDirty();                       // unsaved indicator
    if (!firstPaint) clearFlashes();       // drop the prior edit's highlights before marking new ones
    paintKPIs(m);
    paintDerived(m);
  }
  function onEdit() { clearTimeout(timer); timer = setTimeout(refresh, DEBOUNCE); }

  // Offer inputs appear twice (the deal-summary strip atop Property Info and
  // the Offer & Debt card); offerField keeps every input bound to the same
  // field in sync so editing either one updates the other live. All-In Cost
  // is derived and painted into every registered cell (out.allInCells).
  const offerInputs = { offerPrice: [], fees: [], improvements: [] };
  out.allInCells = [];
  function offerField(key, label) {
    const input = fieldNum(prop.offer[key], (v) => {
      prop.offer[key] = v;
      offerInputs[key].forEach((n) => { if (n !== input) n.value = input.value; });
      onEdit();
    }, { label });
    offerInputs[key].push(input);
    return input;
  }
  function dealCell(label, control, accent) {
    return el('div', { class: 'deal-cell' + (accent ? ' deal-cell--accent' : '') }, [
      el('span', { class: 'deal-cell__label', text: label }), control,
    ]);
  }
  // Goal-seek: typing a Desired CAP or DSCR back-solves the Offer Price that
  // achieves it (mirrors the workbook's Apps Script) and updates the offer
  // input in place; the verdict pills still compare actual ≥ desired. Flooring
  // keeps the resulting metric at/above target so the pill reads as met.
  // Desired ≤ 0 (or cleared) leaves the offer untouched.
  function pvAnnuity(rate, nper, pmt) {   // present value of a level payment stream
    if (rate === 0) return -(pmt * nper);
    return -(pmt * (1 - Math.pow(1 + rate, -nper)) / rate);
  }
  function goalSeekOffer(kind, target) {
    const m = compute(prop);
    let offer = null;
    if (kind === 'cap') {
      if (target > 0 && m.noi > 0) offer = m.noi / target;              // CAP = NOI ÷ offer
    } else {
      const ln = prop.loans[0] || {};
      const rate = Number(ln.rate) || 0, term = Number(ln.termYears) || 0, ltv = Number(ln.ltv) || 0;
      if (target > 0 && term > 0 && ltv > 0 && Number.isFinite(m.noiLessCollection)) {
        const loan = pvAnnuity(rate / 12, term * 12, -(m.noiLessCollection / (target * 12)));
        offer = loan / ltv;                                             // gross the supported loan up by LTV
      }
    }
    if (Number.isFinite(offer) && offer > 0) {
      const v = Math.floor(offer);
      prop.offer.offerPrice = v;
      offerInputs.offerPrice.forEach((n) => { n.value = String(v); });
    }
  }

  // KPI strip — def = [label, valueFn, valueClassFn, noteFn, formula].
  // `formula` drives the hover/focus popup (mirrors workbook-model.md / model.js).
  const KPI_DEFS = [
    ['CAP', (m) => fmt.percent2(m.cap), (m) => verdictClass(capVerdict(m.cap, prop.targets.desiredCap)), () => `target ${fmt.percent2(prop.targets.desiredCap)}`,
      'NOI ÷ Offer Price'],
    ['DSCR', (m) => fmt.ratio(m.dscr), (m) => verdictClass(dscrVerdict(m.dscr, prop.targets.desiredDscr)), () => `target ${fmt.ratio(prop.targets.desiredDscr)}`,
      '(Rent − collection loss − included expenses) ÷ annual debt service'],
    ['NOI', (m) => fmt.money(m.noi), null, () => 'per year',
      'Total rent − included expenses'],
    ['NOI − Debt Svc', (m) => fmt.money(m.noiDebtService), null, () => 'per year',
      'NOI − annual debt service'],
    ['NOI − Coll. Loss', (m) => fmt.money(m.noiLessCollection), null, () => 'less collection',
      '(Rent − collection loss) − included expenses'],
    ['Cash on Cash', (m) => fmt.percent2(m.cashOnCash), null, () => 'on equity',
      '(NOI − annual debt service) ÷ all-in cost'],
    ['Annual IRR', (m) => fmt.percent2(m.irr), (m) => m.irr !== null && m.irr >= m.wacc ? 'kpi__value--pass' : '', () => 'vs WACC',
      'Rate where NPV of [−all-in cost, yr 1…5 cashflows] = 0'],
    ['5Y NPV', (m) => fmt.money(m.npv), (m) => m.npv > 0 ? 'kpi__value--pass' : (m.npv < 0 ? 'kpi__value--fail' : ''), () => 'at WACC',
      '−All-in cost + Σ (yearₜ cashflow ÷ (1 + WACC)ᵗ), t = 1…5'],
    ['5Y Total Return', (m) => fmt.money(m.totalReturn), null, () => 'CF + appreciation',
      'Sum of the 5-year cashflow + appreciation series (incl. −all-in)'],
    ['WACC', (m) => fmt.percent2(m.wacc), null, () => 'hurdle rate',
      'Σ(LTV × rate × (1 − tax)) + (1 − ΣLTV) × min. opportunity cost of equity'],
    ['Return on Cost', (m) => fmt.percent2(m.returnOnCost), null, () => 'NOI / all-in',
      'NOI ÷ all-in cost'],
    ['1% Rule', (m) => fmt.money(m.onePctRule), (m) => verdictClass(onePctVerdict(m.onePctRule)), () => 'rent vs 1% offer',
      'Monthly rent − 1% of offer price'],
  ];
  // Shared formula popup — position:fixed so it escapes the strip's overflow:hidden
  // and can be clamped to the viewport. Included in render() so it's cleaned up.
  const kpiTip = el('div', { class: 'kpi-tip', role: 'tooltip' });
  function showTip(anchor, text) {
    kpiTip.textContent = text;
    kpiTip.classList.add('kpi-tip--on');
    kpiTip.style.left = '0px'; kpiTip.style.top = '0px';   // measure at origin
    const a = anchor.getBoundingClientRect(), t = kpiTip.getBoundingClientRect();
    const left = Math.max(8, Math.min(a.left + a.width / 2 - t.width / 2, window.innerWidth - t.width - 8));
    let top = a.top - t.height - 6;
    if (top < 4) top = a.bottom + 6;                        // flip below if it would leave the viewport
    kpiTip.style.left = left + 'px'; kpiTip.style.top = top + 'px';
  }
  function hideTip() { kpiTip.classList.remove('kpi-tip--on'); }
  const kpiStrip = el('section', { class: 'kpi-strip', 'aria-label': 'Key metrics' },
    KPI_DEFS.map((def, i) => {
      const valNode = el('div', { class: 'kpi__value' });
      const noteNode = el('div', { class: 'kpi__note' });
      const formula = def[4];
      const srDesc = formula ? el('span', { class: 'sr-only', id: 'kpi-f' + i, text: 'Formula: ' + formula }) : null;
      const cell = el('div', formula ? { class: 'kpi kpi--info', tabindex: '0', 'aria-describedby': 'kpi-f' + i } : { class: 'kpi' }, [
        el('span', { class: 'kpi__label', text: def[0] }), valNode, noteNode, srDesc,
      ]);
      out['kpi' + i] = { valNode, noteNode, def, cell };
      if (formula) {
        cell.addEventListener('mouseenter', () => showTip(cell, formula));
        cell.addEventListener('mouseleave', hideTip);
        cell.addEventListener('focus', () => showTip(cell, formula));
        cell.addEventListener('blur', hideTip);
      }
      return cell;
    }));

  function paintKPIs(m) {
    KPI_DEFS.forEach((def, i) => {
      const { valNode, noteNode, cell } = out['kpi' + i];
      const nv = def[1](m);
      if (valNode.textContent !== nv && !firstPaint) flash(cell);   // flash the cell (valNode's class is reset below)
      valNode.textContent = nv;
      valNode.className = 'kpi__value ' + (def[2] ? def[2](m) : '');
      noteNode.textContent = def[3](m);
    });
  }

  // Property info ---------------------------------------------------------
  const infoDefs = [
    ['Asking', 'askingPrice', 'num'], ['Appraised', 'appraisedValue', 'num'],
    ['Rentable SF', 'rentableSF', 'num'], ['Lot', 'lotSize', 'text'],
    ['Built', 'yearBuilt', 'num'], ['Zoning', 'zoning', 'text'],
    ['Beds', 'bedrooms', 'text'], ['Baths', 'baths', 'text'],
    ['HVAC', 'hvacAge', 'text'], ['Roof', 'roofAge', 'text'],
    ['Parking', 'parking', 'text'], ['Ceiling', 'ceilingHeight', 'text'],
    ['APN', 'apn', 'text'],
  ];
  // Deal summary — full-width band ABOVE the cards, mirroring the workbook's
  // Offer/All-In/Fees/Improvement header row. Editable, synced with the Offer
  // & Debt card; All-In Cost derived. Built here, mounted in render() below.
  const allInSummaryCell = el('div', { class: 'deal-cell__val' });
  out.allInCells.push(allInSummaryCell);
  const dealStrip = el('div', { class: 'deal-strip', 'aria-label': 'Deal summary' }, [
    dealCell('Offer Price', offerField('offerPrice', 'Offer price')),
    dealCell('All-In Cost', allInSummaryCell, true),
    dealCell('Fees', offerField('fees', 'Fees')),
    dealCell('Improvement', offerField('improvements', 'Improvements')),
    dealCell('Desired CAP', fieldPercent(prop.targets.desiredCap, (v) => { prop.targets.desiredCap = v; goalSeekOffer('cap', v); onEdit(); }, { label: 'Desired CAP' })),
    dealCell('Desired DSCR', fieldNum(prop.targets.desiredDscr, (v) => { prop.targets.desiredDscr = v; goalSeekOffer('dscr', v); onEdit(); }, { label: 'Desired DSCR', step: '0.01' })),
  ]);
  const infoCard = card('Property Info', 'col-3', [
    el('div', { class: 'form-grid form-grid--3' }, infoDefs.map(([label, key, type]) =>
      labeledField(label, type === 'num'
        ? fieldNum(prop.info[key], (v) => { prop.info[key] = v; onEdit(); }, { label })
        : fieldText(prop.info[key], (v) => { prop.info[key] = v; onEdit(); }, { label })))),
  ]);

  // Income ----------------------------------------------------------------
  const rentPerSFNodes = [];
  const incomeRows = prop.tenants.map((t, i) => {
    const rps = el('td', { class: 'num' });
    rentPerSFNodes.push(rps);
    return el('tr', {}, [
      el('td', {}, [fieldText(t.name, (v) => { t.name = v; onEdit(); }, { label: 'Tenant name' })]),
      el('td', { class: 'num' }, [fieldNum(t.sf, (v) => { t.sf = v; onEdit(); }, { label: 'SF' })]),
      el('td', { class: 'num' }, [fieldNum(t.monthlyIncome, (v) => { t.monthlyIncome = v; onEdit(); }, { label: 'Rent/mo' })]),
      rps,
      el('td', {}, [fieldDate(t.leaseExpires, (v) => { t.leaseExpires = v; onEdit(); }, { label: 'Lease expires' })]),
      el('td', {}, [fieldText(t.leaseOptions, (v) => { t.leaseOptions = v; onEdit(); }, { label: 'Lease options' })]),
    ]);
  });
  out.totalSFCell = el('td', { class: 'num' });        // SF column
  out.totalMoRentCell = el('td', { class: 'num' });    // Rent/mo column
  out.avgRentCell = el('td', { class: 'num' });         // Rent/SF column
  out.totalRentCell = el('td', { class: 'num', colspan: '2' });   // over lease cols
  out.rentLessCell = el('td', { class: 'num', colspan: '2' });    // over lease cols
  const incomeCard = card('Income', 'col-5', [
    tableWrap(el('table', { class: 'data-table data-table--dense' }, [
      el('thead', {}, el('tr', {}, ['Tenant', 'SF', 'Rent / mo', 'Rent / SF', 'Lease Expires', 'Lease Options']
        .map((h, i) => el('th', { scope: 'col', class: i >= 1 && i <= 3 ? 'num' : '' , text: h })))),
      el('tbody', {}, [
        ...incomeRows,
        // Total rent: Tenant | SF | Rent/mo | Rent/SF | (Total /yr over lease cols)
        el('tr', { class: 'total' }, [el('td', { text: 'Total rent' }), out.totalSFCell, out.totalMoRentCell, out.avgRentCell, out.totalRentCell]),
        // Rent − collection loss: label reflects the live assumption | value over lease cols
        el('tr', {}, [out.rentLessLabel = el('td', {}), el('td', { class: 'num' }, []), el('td', { class: 'num' }, []), el('td', { class: 'num' }, []), out.rentLessCell]),
      ]),
    ])),
  ]);

  // Expenses --------------------------------------------------------------
  const expPctNodes = [];
  const expRows = prop.expenses.map((e, i) => {
    const chk = el('input', { type: 'checkbox', id: 'exp-' + e.key, checked: e.included ? true : null, 'aria-label': e.label + ' include in NOI' });
    chk.addEventListener('change', () => { e.included = chk.checked; rowEl.className = 'check-row' + (chk.checked ? '' : ' check-row--off'); onEdit(); });
    const pct = el('span', { class: 'pct' });
    expPctNodes.push({ pct, i });
    const amount = fieldNum(e.amount, (v) => { e.amount = v; onEdit(); }, { label: e.label + ' amount', estimate: e.estimated });
    amount.classList.add('amount-input');
    const rowEl = el('div', { class: 'check-row' + (e.included ? '' : ' check-row--off') }, [
      chk,
      el('label', { for: 'exp-' + e.key }, [e.label + (e.estimated ? '* ' : ' '), pct]),
      amount,
    ]);
    return rowEl;
  });
  out.totalInclCell = el('dd', {});
  const expenseCard = card('Expenses (yr) — included in NOI', 'col-4', [
    el('div', { class: 'check-grid' }, expRows),
    el('dl', { class: 'facts facts--1col' }, [
      el('div', {}, [el('dt', { text: 'Total incl. (feeds NOI) / all cat.' }), out.totalInclCell]),
    ]),
    el('p', { class: 'fineprint', text: '* estimated default · % = share of NOI' }),
  ]);

  // Offer & debt service --------------------------------------------------
  out.debtNodes = {};
  function debtRow(label, valueNode) { return el('div', {}, [el('dt', { text: label }), valueNode]); }
  const loanFields = prop.loans.map((ln, i) => {
    const amt = el('dd', {});
    out.debtNodes['loanAmt' + i] = amt;
    const pay = el('dd', {});
    out.debtNodes['pay' + i] = pay;
    return el('div', { class: 'loan-edit' }, [
      el('div', { class: 'field' }, [el('span', { class: 'field__label', text: `Loan ${i + 1} — LTV / rate / term / type` }),
        el('div', { class: 'loan-grid' }, [
          fieldPercent(ln.ltv, (v) => { ln.ltv = v; onEdit(); }, { label: `Loan ${i + 1} LTV`, step: '0.1' }),
          fieldPercent(ln.rate, (v) => { ln.rate = v; onEdit(); }, { label: `Loan ${i + 1} rate`, step: '0.1' }),
          fieldNum(ln.termYears, (v) => { ln.termYears = v; onEdit(); }, { label: `Loan ${i + 1} term` }),
          fieldSelect(ln.type, ['CONV', 'IO'], (v) => { ln.type = v; onEdit(); }, `Loan ${i + 1} type`),
        ])]),
      el('dl', { class: 'facts facts--1col' }, [
        el('div', {}, [el('dt', { text: `Loan ${i + 1} amount / mo. payment` }),
          el('dd', {}, [amt, document.createTextNode(' · '), pay])]),
      ]),
    ]);
  });
  out.totalMortgageCell = el('dd', {});
  out.allInCell = el('dd', {});
  out.allInCells.push(out.allInCell);
  // Offer / Fees / Improvement now live only in the deal-summary band above;
  // this card is loan data + derived debt/equity totals.
  const debtCard = card('Offer & Debt Service', 'col-3', [
    ...loanFields,
    el('dl', { class: 'facts facts--1col' }, [
      el('div', {}, [el('dt', { text: 'Total yearly mortgage' }), out.totalMortgageCell]),
      el('div', {}, [el('dt', { text: 'All-in cost (equity)' }), out.allInCell]),
    ]),
  ]);

  // Pro-forma -------------------------------------------------------------
  // Horizon is user-selectable (5 default, 10). drawProforma() rebuilds the
  // chart/table/stats into pfBody on each recompute and on slider change; the
  // slider itself stays mounted so it keeps focus/position across edits.
  let horizon = 5;
  let lastM = null;
  const pfBody = el('div', {});
  const horizonSlider = el('input', {
    type: 'range', min: '5', max: '10', step: '5', value: '5',
    class: 'pf-slider', 'aria-label': 'Pro-forma horizon (years)',
  });
  horizonSlider.addEventListener('input', () => {
    horizon = parseInt(horizonSlider.value, 10) || 5;
    if (lastM) drawProforma(lastM);
  });
  const proformaCard = card('Pro-Forma', 'col-6', [
    pfBody,
    el('div', { class: 'pf-head' }, [
      el('span', { class: 'pf-head__lbl', text: '5 yr' }), horizonSlider,
      el('span', { class: 'pf-head__lbl', text: '10 yr' }),
    ]),
  ]);

  // Assumptions + methodology --------------------------------------------
  const assumeDefs = [
    ['Min opp. equity', 'minOppCostEquity'], ['Tax (int. ded.)', 'taxRate'],
    ['Collection loss', 'collectionLoss'], ['Cashflow appr. rate', 'cashflowAppr'],
    ['Property appr. rate', 'capitalAppr'],
  ];
  // Desired CAP/DSCR now live in the deal-summary band above the cards.
  const assumeCard = card('Assumptions', '', [
    grid2(assumeDefs.map(([label, key]) =>
      labeledField(label, fieldPercent(prop.assumptions[key], (v) => { prop.assumptions[key] = v; onEdit(); }, { label, step: '0.1' })))),
  ]);
  const methodCard = el('section', { class: 'card notes', 'aria-label': 'Methodology' }, [
    el('span', { class: 'eyebrow', text: 'Methodology' }),
    el('details', {}, [
      el('summary', { text: 'Definitions & decision rules (workbook notes)' }),
      ...NOTES.map((n) => el('div', {}, [el('h3', { text: n.title }), el('p', { text: n.body })])),
    ]),
  ]);
  const rightStack = el('div', { class: 'col-3 stack' }, [assumeCard, methodCard]);

  // Actions — rendered into the top bar (keeps the dashboard one-screen) ----
  if (ctx.actionsHost) {
    render(ctx.actionsHost, [
      el('button', { class: 'topbar__link topbar__action', type: 'button', onclick: () => ctx.save(prop), text: 'Save' }),
      el('button', { class: 'topbar__link topbar__action', type: 'button', onclick: () => ctx.remove(prop), text: 'Delete' }),
    ]);
  }

  render(container, [
    kpiStrip,
    dealStrip,
    el('div', { class: 'grid' }, [infoCard, incomeCard, expenseCard, debtCard, proformaCard, rightStack]),
    kpiTip,
  ]);

  // ── output painting ────────────────────────────────────────────────
  function paintDerived(m) {
    // income
    prop.tenants.forEach((t, i) => { setText(rentPerSFNodes[i], fmt.moneyCents(m.tenantRentPerSF[i])); });
    setText(out.totalSFCell, fmt.integer(m.totalTenantSF));
    setText(out.totalMoRentCell, fmt.money(m.totalMonthlyRent));
    setText(out.avgRentCell, fmt.moneyCents(m.avgRentPerSF));
    setText(out.totalRentCell, fmt.money(m.totalRent) + ' / yr');
    out.rentLessLabel.textContent = `Rent − ${fmt.percent(prop.assumptions.collectionLoss)} coll. loss`;
    setText(out.rentLessCell, fmt.money(m.rentLessCollection) + ' / yr');
    // expenses
    expPctNodes.forEach(({ pct, i }) => { setText(pct, fmt.percent(m.expensePctOfNoi[i])); });
    setText(out.totalInclCell, `${fmt.money(m.includedExpense)} / ${fmt.money(m.allExpense)}`);
    // debt
    m.loans.forEach((l, i) => {
      setText(out.debtNodes['loanAmt' + i], fmt.money(l.amount));
      setText(out.debtNodes['pay' + i], l.payment === null ? 'Invalid type' : fmt.money(l.payment));
    });
    setText(out.totalMortgageCell, fmt.money(m.annualDebt));
    out.allInCells.forEach((n) => { setText(n, fmt.money(m.allInCost)); });
    drawProforma(m);
  }
  function setCell(cell, v) {
    cell.textContent = fmt.money(v);
    cell.classList.toggle('neg', typeof v === 'number' && v < 0);
  }
  function barEl(kind, v, maxV, H, title) {
    const h = Math.max(2, Math.round((Math.abs(v) / maxV) * H));
    const b = el('div', { class: `chart__bar chart__bar--${kind}`, title });
    b.style.height = h + 'px';
    return b;
  }
  function statRow(label, h, boundary) {
    return el('div', { class: 'pf-stat' + (boundary ? ' pf-stat--boundary' : '') }, [
      el('span', { class: 'pf-stat__label', text: label }),
      el('span', {}, [el('b', { text: fmt.money(h.npv) }), ' NPV']),
      el('span', {}, [el('b', { text: fmt.money(h.totalReturn) }), ' Total return']),
      el('span', {}, [el('b', { text: fmt.percent2(h.irr) }), ' IRR']),
    ]);
  }
  // Rebuild the pro-forma chart/table/stats for the selected horizon (5 or 10).
  function drawProforma(m) {
    lastM = m;
    const H = horizon;
    const pf = m.proforma;
    const hs = H === 10 ? pf.h10 : pf.h5;      // hold-series for the table (equity returned in YR H)
    const boundary = H === 10;                 // show the 5↔10 divider only when zoomed out
    // chart — operating cashflow + appreciation bars, years 1..H
    const op = pf.operating.slice(0, H), ap = pf.apprYear.slice(0, H);
    const maxV = Math.max(1, ...op.map(Math.abs), ...ap.map(Math.abs));
    const chartPlot = el('div', { class: 'chart__plot', role: 'img', 'aria-label': `${H}-year operating cashflow and appreciation` },
      op.map((c, i) => el('div', { class: 'chart__group' + (boundary && i === 4 ? ' chart__group--boundary' : '') }, [
        (i === 0 || i === H - 1) ? el('span', { class: 'chart__value', text: fmt.moneyCompact(op[i] + ap[i]) }) : null,
        barEl('cf', c, maxV, 72, `YR ${i + 1} cashflow ${fmt.money(c)}`),
        barEl('ap', ap[i], maxV, 72, `YR ${i + 1} appreciation ${fmt.money(ap[i])}`),
      ])));
    const chart = el('div', { class: 'chart' }, [
      chartPlot,
      el('div', { class: 'chart__xlabels' }, op.map((_, i) => el('span', { class: boundary && i === 4 ? 'x--boundary' : '', text: `YR ${i + 1}` }))),
      el('div', { class: 'legend' }, [
        el('span', {}, [el('i', { class: 'sw-cf' }), 'Operating cashflow']),
        el('span', {}, [el('i', { class: 'sw-ap' }), 'Appreciation']),
      ]),
    ]);
    // table — Initial + YR1..YRH; boundary border on the YR5 column when zoomed
    const heads = ['Series', 'Initial', ...Array.from({ length: H }, (_, i) => `YR ${i + 1}`)];
    const bCol = (i) => boundary && i === 6 ? ' cell--boundary' : '';   // header YR5 = index 6
    const row = (label, arr, cls) => el('tr', { class: cls || '' }, [el('td', { text: label }),
      ...arr.map((v, i) => { const c = el('td', { class: 'num' + (boundary && i === 5 ? ' cell--boundary' : '') }); setCell(c, v); return c; })]);
    const table = tableWrap(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, heads.map((h, i) => el('th', { scope: 'col', class: (i ? 'num' : '') + bCol(i), text: h })))),
      el('tbody', {}, [row('Cashflow', hs.cashflow), row('Appreciation', hs.appreciation), row('CF + appreciation', hs.combined, 'total')]),
    ]));
    // stats — 5-year always; 10-year (after the boundary) only when zoomed out
    const stats = el('div', { class: 'pf-stats' }, [
      statRow('5-year', pf.h5),
      boundary ? statRow('10-year', pf.h10, true) : null,
    ]);
    const note = el('p', { class: 'fineprint', text: `YR ${H} includes the return of equity (chart shows operating years); this series feeds IRR, NPV, and total return.` });
    render(pfBody, [chart, table, stats, note]);
  }

  refresh();          // initial paint
  firstPaint = false; // subsequent edits flash the values that change
}

// ── helpers ───────────────────────────────────────────────────────────
function verdictClass(v) { return v === null ? '' : (v ? 'kpi__value--pass' : 'kpi__value--fail'); }
function card(title, colClass, children) {
  return el('section', { class: 'card ' + (colClass || ''), 'aria-label': title }, [
    el('span', { class: 'eyebrow', text: title }), ...children,
  ]);
}
function tableWrap(t) { return el('div', { class: 'table-wrap' }, [t]); }
function grid2(children) { return el('div', { class: 'form-grid' }, children); }
function labeledField(label, input) {
  return el('label', { class: 'field' }, [el('span', { class: 'field__label', text: label }), input]);
}
