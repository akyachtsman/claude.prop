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

  function refresh() {
    const m = compute(prop);
    ctx.setHeaderVerdicts(m, prop);        // topbar pills
    ctx.markDirty();                       // unsaved indicator
    paintKPIs(m);
    paintDerived(m);
  }
  function onEdit() { clearTimeout(timer); timer = setTimeout(refresh, DEBOUNCE); }

  // KPI strip -------------------------------------------------------------
  const KPI_DEFS = [
    ['CAP', (m) => fmt.percent2(m.cap), (m) => verdictClass(capVerdict(m.cap, prop.targets.desiredCap)), () => `target ${fmt.percent2(prop.targets.desiredCap)}`],
    ['DSCR', (m) => fmt.ratio(m.dscr), (m) => verdictClass(dscrVerdict(m.dscr, prop.targets.desiredDscr)), () => `target ${fmt.ratio(prop.targets.desiredDscr)}`],
    ['NOI', (m) => fmt.money(m.noi), null, () => 'per year'],
    ['NOI − Debt Svc', (m) => fmt.money(m.noiDebtService), null, () => 'per year'],
    ['NOI − Coll. Loss', (m) => fmt.money(m.noiLessCollection), null, () => 'less collection'],
    ['Cash on Cash', (m) => fmt.percent2(m.cashOnCash), null, () => 'on equity'],
    ['Annual IRR', (m) => fmt.percent2(m.irr), (m) => m.irr !== null && m.irr >= m.wacc ? 'kpi__value--pass' : '', () => 'vs WACC'],
    ['5Y NPV', (m) => fmt.money(m.npv), (m) => m.npv > 0 ? 'kpi__value--pass' : (m.npv < 0 ? 'kpi__value--fail' : ''), () => 'at WACC'],
    ['5Y Total Return', (m) => fmt.money(m.totalReturn), null, () => 'CF + appreciation'],
    ['WACC', (m) => fmt.percent2(m.wacc), null, () => 'hurdle rate'],
    ['Return on Cost', (m) => fmt.percent2(m.returnOnCost), null, () => 'NOI / all-in'],
    ['1% Rule', (m) => fmt.money(m.onePctRule), (m) => verdictClass(onePctVerdict(m.onePctRule)), () => 'rent vs 1% offer'],
  ];
  const kpiStrip = el('section', { class: 'kpi-strip', 'aria-label': 'Key metrics' },
    KPI_DEFS.map((def, i) => {
      const valNode = el('div', { class: 'kpi__value' });
      const noteNode = el('div', { class: 'kpi__note' });
      out['kpi' + i] = { valNode, noteNode, def };
      return el('div', { class: 'kpi' }, [
        el('span', { class: 'kpi__label', text: def[0] }), valNode, noteNode,
      ]);
    }));

  function paintKPIs(m) {
    KPI_DEFS.forEach((def, i) => {
      const { valNode, noteNode } = out['kpi' + i];
      valNode.textContent = def[1](m);
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
  const infoCard = card('Property Info', 'col-3', [
    grid2(infoDefs.map(([label, key, type]) =>
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
      el('td', {}, [fieldText(t.leaseExpires, (v) => { t.leaseExpires = v; onEdit(); }, { label: 'Lease expires' })]),
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
        // Rent − collection loss: label | (blanks) | value over lease cols
        el('tr', {}, [el('td', { text: 'Rent − 5% coll. loss' }), el('td', { class: 'num' }, []), el('td', { class: 'num' }, []), el('td', { class: 'num' }, []), out.rentLessCell]),
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
          fieldNum(ln.ltv, (v) => { ln.ltv = v; onEdit(); }, { label: `Loan ${i + 1} LTV`, step: '0.01' }),
          fieldNum(ln.rate, (v) => { ln.rate = v; onEdit(); }, { label: `Loan ${i + 1} rate`, step: '0.001' }),
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
  const debtCard = card('Offer & Debt Service', 'col-3', [
    grid2([
      labeledField('Offer price', fieldNum(prop.offer.offerPrice, (v) => { prop.offer.offerPrice = v; onEdit(); }, { label: 'Offer price' })),
      labeledField('Fees (closing)', fieldNum(prop.offer.fees, (v) => { prop.offer.fees = v; onEdit(); }, { label: 'Fees' })),
      labeledField('Improvements', fieldNum(prop.offer.improvements, (v) => { prop.offer.improvements = v; onEdit(); }, { label: 'Improvements' })),
    ]),
    ...loanFields,
    el('dl', { class: 'facts facts--1col' }, [
      el('div', {}, [el('dt', { text: 'Total yearly mortgage' }), out.totalMortgageCell]),
      el('div', {}, [el('dt', { text: 'All-in cost (equity)' }), out.allInCell]),
    ]),
  ]);

  // Pro-forma -------------------------------------------------------------
  out.pfCells = { cf: [], ap: [], cb: [] };
  const yrHeads = ['Series', 'Initial', 'YR 1', 'YR 2', 'YR 3', 'YR 4', 'YR 5'];
  function pfRow(label, key, cls) {
    const cells = [];
    for (let i = 0; i < 6; i++) { const c = el('td', { class: 'num' }); cells.push(c); out.pfCells[key].push(c); }
    return el('tr', { class: cls || '' }, [el('td', { text: label }), ...cells]);
  }
  out.pfChart = el('div', { class: 'chart__plot', role: 'img', 'aria-label': 'Five-year operating cashflow and appreciation' });
  const proformaCard = card('Five-Year Pro-Forma', 'col-6', [
    el('div', { class: 'chart' }, [
      out.pfChart,
      el('div', { class: 'chart__xlabels' }, ['YR 1', 'YR 2', 'YR 3', 'YR 4', 'YR 5'].map((y) => el('span', { text: y }))),
      el('div', { class: 'legend' }, [
        el('span', {}, [el('i', { class: 'sw-cf' }), 'Operating cashflow']),
        el('span', {}, [el('i', { class: 'sw-ap' }), 'Appreciation']),
      ]),
    ]),
    tableWrap(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, yrHeads.map((h, i) => el('th', { scope: 'col', class: i ? 'num' : '', text: h })))),
      el('tbody', {}, [pfRow('Cashflow', 'cf'), pfRow('Appreciation', 'ap'), pfRow('CF + appreciation', 'cb', 'total')]),
    ])),
    el('p', { class: 'fineprint', text: 'YR 5 includes the return of equity (chart shows operating years); this series feeds IRR, NPV, and total return.' }),
  ]);

  // Assumptions + methodology --------------------------------------------
  const assumeDefs = [
    ['Min opp. equity', 'minOppCostEquity'], ['Tax (int. ded.)', 'taxRate'],
    ['Collection loss', 'collectionLoss'], ['CF appr.', 'cashflowAppr'],
    ['Cap appr.', 'capitalAppr'],
  ];
  const targetDefs = [['Desired CAP', 'desiredCap'], ['Desired DSCR', 'desiredDscr']];
  const assumeCard = card('Assumptions', '', [
    grid2([
      ...assumeDefs.map(([label, key]) => labeledField(label, fieldNum(prop.assumptions[key], (v) => { prop.assumptions[key] = v; onEdit(); }, { label, step: '0.01' }))),
      ...targetDefs.map(([label, key]) => labeledField(label, fieldNum(prop.targets[key], (v) => { prop.targets[key] = v; onEdit(); }, { label, step: '0.01' }))),
    ]),
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
    el('div', { class: 'grid' }, [infoCard, incomeCard, expenseCard, debtCard, proformaCard, rightStack]),
  ]);

  // ── output painting ────────────────────────────────────────────────
  function paintDerived(m) {
    // income
    prop.tenants.forEach((t, i) => { rentPerSFNodes[i].textContent = fmt.moneyCents(m.tenantRentPerSF[i]); });
    out.totalSFCell.textContent = fmt.integer(m.totalTenantSF);
    out.totalMoRentCell.textContent = fmt.money(m.totalMonthlyRent);
    out.avgRentCell.textContent = fmt.moneyCents(m.avgRentPerSF);
    out.totalRentCell.textContent = fmt.money(m.totalRent) + ' / yr';
    out.rentLessCell.textContent = fmt.money(m.rentLessCollection) + ' / yr';
    // expenses
    expPctNodes.forEach(({ pct, i }) => { pct.textContent = fmt.percent(m.expensePctOfNoi[i]); });
    out.totalInclCell.textContent = `${fmt.money(m.includedExpense)} / ${fmt.money(m.allExpense)}`;
    // debt
    m.loans.forEach((l, i) => {
      out.debtNodes['loanAmt' + i].textContent = fmt.money(l.amount);
      out.debtNodes['pay' + i].textContent = l.payment === null ? 'Invalid type' : fmt.money(l.payment);
    });
    out.totalMortgageCell.textContent = fmt.money(m.annualDebt);
    out.allInCell.textContent = fmt.money(m.allInCost);
    // pro-forma table
    const pf = m.proforma;
    for (let i = 0; i < 6; i++) {
      setCell(out.pfCells.cf[i], pf.cashflow[i]);
      setCell(out.pfCells.ap[i], pf.appreciation[i]);
      setCell(out.pfCells.cb[i], pf.combined[i]);
    }
    paintChart(m);
  }
  function setCell(cell, v) {
    cell.textContent = fmt.money(v);
    cell.classList.toggle('neg', typeof v === 'number' && v < 0);
  }
  function paintChart(m) {
    const cf = m.proforma.operating;               // YR1..5 operating (no equity return)
    const ap = m.proforma.appreciation.slice(1);
    const maxV = Math.max(1, ...cf.map(Math.abs), ...ap.map(Math.abs));
    const H = 72;
    render(out.pfChart, cf.map((c, i) => el('div', { class: 'chart__group' }, [
      i === 0 || i === 4 ? el('span', { class: 'chart__value', text: fmt.moneyCompact(cf[i] + ap[i]) }) : null,
      barEl('cf', c, maxV, H, `YR ${i + 1} cashflow ${fmt.money(c)}`),
      barEl('ap', ap[i], maxV, H, `YR ${i + 1} appreciation ${fmt.money(ap[i])}`),
    ])));
  }
  function barEl(kind, v, maxV, H, title) {
    const h = Math.max(2, Math.round((Math.abs(v) / maxV) * H));
    const b = el('div', { class: `chart__bar chart__bar--${kind}`, title });
    b.style.height = h + 'px';
    return b;
  }

  refresh(); // initial paint
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
