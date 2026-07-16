// views/compare.js — compare saved properties two ways:
//   • Table  — one row per property, every metric across the top (spreadsheet
//     style, best value per column highlighted).
//   • Side by side — each property a column, every metric a row.
// Both share the property picker; best/worst is direction-aware, no-data neutral.

import { el, render } from '../dom.js';
import * as fmt from '../format.js';
import { compute, capVerdict, dscrVerdict } from '../model.js';

// Side-by-side metric rows: [label, selector(m), formatter, direction].
const ROWS = [
  ['CAP', (m) => m.cap, fmt.percent2, 'up'],
  ['DSCR', (m) => m.dscr, fmt.ratio, 'up'],
  ['NOI', (m) => m.noi, fmt.money, 'up'],
  ['NOI − Debt Service', (m) => m.noiDebtService, fmt.money, 'up'],
  ['Cash on Cash', (m) => m.cashOnCash, fmt.percent2, 'up'],
  ['Annual IRR', (m) => m.irr, fmt.percent2, 'up'],
  ['5Y NPV', (m) => m.npv, fmt.money, 'up'],
  ['5Y Total Return', (m) => m.totalReturn, fmt.money, 'up'],
  ['WACC', (m) => m.wacc, fmt.percent2, 'down'],
  ['Return on Cost', (m) => m.returnOnCost, fmt.percent2, 'up'],
  ['1% Rule', (m) => m.onePctRule, fmt.money, 'up'],
  ['All-in cost (equity)', (m) => m.allInCost, fmt.money, 'down'],
  ['Annual debt service', (m) => m.annualDebt, fmt.money, 'down'],
  ['Total rent (yr)', (m) => m.totalRent, fmt.money, 'up'],
];

// Table columns: [label, selector(m, p), formatter, direction]. Asking is
// context only (no winner). Order mirrors the workbook comparison sheet.
const COLS = [
  ['Asking', (m, p) => p.info.askingPrice, fmt.money, null],
  ['NOI − Coll. Loss', (m) => m.noiLessCollection, fmt.money, 'up'],
  ['NOI', (m) => m.noi, fmt.money, 'up'],
  ['Return on Cost', (m) => m.returnOnCost, fmt.percent2, 'up'],
  ['Cash on Cash', (m) => m.cashOnCash, fmt.percent2, 'up'],
  ['1% Rule', (m) => m.onePctRule, fmt.money, 'up'],
  ['DSCR', (m) => m.dscr, fmt.ratio, 'up'],
  ['NOI Debt Svc', (m) => m.noiDebtService, fmt.money, 'up'],
  ['CAP', (m) => m.cap, fmt.percent2, 'up'],
  ['Annual IRR', (m) => m.irr, fmt.percent2, 'up'],
  ['5Y NPV', (m) => m.npv, fmt.money, 'up'],
  ['5Y Total Return', (m) => m.totalReturn, fmt.money, 'up'],
  ['WACC', (m) => m.wacc, fmt.percent2, 'down'],
];

const fnum = (v) => (v === null || v === undefined || !Number.isFinite(v));

// Best/worst value for a set given a direction; null when it can't be decided.
function extremes(vals, dir) {
  if (!dir) return { best: null, worst: null };
  const finite = vals.filter((v) => !fnum(v));
  if (finite.length < 2) return { best: null, worst: null };
  let best = dir === 'up' ? Math.max(...finite) : Math.min(...finite);
  let worst = dir === 'up' ? Math.min(...finite) : Math.max(...finite);
  if (best === worst) return { best: null, worst: null };   // all equal → neutral
  return { best, worst };
}

function verdictPill(p, m) {
  const cap = capVerdict(m.cap, p.targets.desiredCap);
  const dscr = dscrVerdict(m.dscr, p.targets.desiredDscr);
  const none = cap === null && dscr === null;
  const pass = cap !== false && dscr !== false && (cap !== null || dscr !== null);
  return el('span', { class: 'compare-verdict' }, [el('span', {
    class: 'pill ' + (none ? '' : pass ? 'pill--pass' : 'pill--fail'),
    text: none ? 'No targets' : pass ? 'Meets' : 'Below',
  })]);
}

export function renderCompare(container, ctx) {
  const all = ctx.list();
  if (all.length < 2) {
    render(container, [el('div', { class: 'empty' }, [
      el('h2', { text: 'Compare needs 2+ properties' }),
      el('p', { text: 'Save at least two properties to line them up side by side.' }),
      el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ctx.goList(), text: 'Back to properties' }),
    ])]);
    return;
  }

  const selected = ctx.compareIds && ctx.compareIds.length
    ? all.filter((p) => ctx.compareIds.includes(p.id))
    : all.slice();   // default: line up every saved property
  let layout = 'table';   // 'table' (rows) | 'cols' (side by side)

  const chips = el('div', { class: 'compare-picker' }, all.map((p) => {
    const on = selected.some((s) => s.id === p.id);
    const c = el('button', { class: 'chip' + (on ? ' chip--on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', text: p.name || 'Untitled' });
    c.addEventListener('click', () => {
      const idx = selected.findIndex((s) => s.id === p.id);
      if (idx >= 0) { if (selected.length > 2) selected.splice(idx, 1); }   // keep at least 2
      else selected.push(p);   // no upper cap — add as many as you like
      draw();
    });
    return c;
  }));

  const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Comparison layout' }, [
    segBtn('table', 'Table'), segBtn('cols', 'Side by side'),
  ]);
  function segBtn(key, label) {
    const b = el('button', { class: 'seg__btn', type: 'button', text: label });
    b.addEventListener('click', () => { layout = key; draw(); });
    return b;
  }

  const tableHost = el('div', { class: 'table-wrap' });

  function draw() {
    [...chips.children].forEach((c, i) => {
      const on = selected.some((s) => s.id === all[i].id);
      c.className = 'chip' + (on ? ' chip--on' : '');
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    [...seg.children].forEach((b, i) => {
      const on = (i === 0 ? 'table' : 'cols') === layout;
      b.className = 'seg__btn' + (on ? ' seg__btn--on' : '');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (layout === 'table') drawTable(); else drawSideBySide();
  }

  // Table: one row per property, metrics across the top.
  function drawTable() {
    const cols = selected.map((p) => ({ p, m: compute(p) }));
    const head = el('tr', {}, [el('th', { scope: 'col', text: 'Prospect' }),
      ...COLS.map(([label]) => el('th', { scope: 'col', class: 'num', text: label }))]);
    const bw = COLS.map(([label, sel, f, dir]) => extremes(cols.map(({ m, p }) => sel(m, p)), dir));
    const body = cols.map(({ p, m }) => el('tr', {}, [
      el('td', {}, [el('span', { class: 'compare-name', text: p.name || 'Untitled' }), verdictPill(p, m)]),
      ...COLS.map(([label, sel, f], ci) => {
        const v = sel(m, p);
        const { best, worst } = bw[ci];
        const cls = 'num' + (fnum(v) ? '' : v === best ? ' cell--best' : v === worst ? ' cell--worst' : '');
        return el('td', { class: cls, text: fnum(v) ? '—' : f(v) });
      }),
    ]));
    render(tableHost, [el('table', { class: 'data-table compare-table compare-table--rows' }, [
      el('thead', {}, head), el('tbody', {}, body),
    ])]);
  }

  // Side by side: each property a column, metrics down the rows.
  function drawSideBySide() {
    const cols = selected.map((p) => ({ p, m: compute(p) }));
    const headRow = el('tr', {}, [el('th', { scope: 'col', text: 'Metric' }),
      ...cols.map(({ p }) => el('th', { scope: 'col', text: p.name || 'Untitled' }))]);
    const verdictRow = el('tr', { class: 'compare-verdict' }, [el('td', { text: 'Vs targets' }),
      ...cols.map(({ p, m }) => el('td', { class: 'num' }, [verdictPill(p, m).firstChild]))]);
    const rows = ROWS.map(([label, sel, f, dir]) => {
      const vals = cols.map(({ m }) => sel(m));
      const { best, worst } = extremes(vals, dir);
      return el('tr', {}, [el('td', { text: label }),
        ...vals.map((v) => el('td', {
          class: 'num' + (fnum(v) ? '' : v === best ? ' cell--best' : v === worst ? ' cell--worst' : ''),
          text: fnum(v) ? '—' : f(v),
        }))]);
    });
    render(tableHost, [el('table', { class: 'data-table compare-table' }, [
      el('thead', {}, [headRow, verdictRow]), el('tbody', {}, rows),
    ])]);
  }

  render(container, [
    el('div', { class: 'list-head' }, [
      el('h1', { text: 'Compare' }),
      el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ctx.goList(), text: 'Back to properties' }),
    ]),
    el('div', { class: 'compare-controls' }, [seg]),
    el('p', { class: 'fineprint', text: 'Pick any 2 or more properties. Best value per metric is green, worst is red; no-data is neutral.' }),
    chips, tableHost,
  ]);
  draw();
}
