// views/compare.js — compare saved properties two ways:
//   • Table  — one row per property, every metric across the top (spreadsheet
//     style, best value per column highlighted).
//   • Side by side — each property a column, every metric a row.
// Both share the property picker; best/worst is direction-aware, no-data neutral.

import { el, render } from '../dom.js';
import * as fmt from '../format.js';
import { compute, capVerdict, dscrVerdict } from '../model.js';

// The single, ordered metric set shared by both layouts: [label, selector(m, p),
// formatter, direction]. Asking leads (context only — no winner), then the 12
// dashboard KPIs in KPI-strip order. Direction drives best/worst (up = higher
// is better; down = lower is better; null = neutral). Kept compact by design —
// more columns are expected here later.
const METRICS = [
  ['Asking', (m, p) => p.info.askingPrice, fmt.money, null],
  ['CAP', (m) => m.cap, fmt.percent2, 'up'],
  ['DSCR', (m) => m.dscr, fmt.ratio, 'up'],
  ['NOI', (m) => m.noi, fmt.money, 'up'],
  ['NOI − Debt Svc', (m) => m.noiDebtService, fmt.money, 'up'],
  ['NOI − Coll. Loss', (m) => m.noiLessCollection, fmt.money, 'up'],
  ['Cash on Cash', (m) => m.cashOnCash, fmt.percent2, 'up'],
  ['Annual IRR', (m) => m.irr, fmt.percent2, 'up'],
  ['5Y NPV', (m) => m.npv, fmt.money, 'up'],
  ['5Y Total Return', (m) => m.totalReturn, fmt.money, 'up'],
  ['WACC', (m) => m.wacc, fmt.percent2, 'down'],
  ['Return on Cost', (m) => m.returnOnCost, fmt.percent2, 'up'],
  ['1% Rule', (m) => m.onePctRule, fmt.money, 'up'],
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
  const cap = capVerdict(m.cap);
  const dscr = dscrVerdict(m.dscr);
  const none = cap === null && dscr === null;
  const pass = cap !== false && dscr !== false && (cap !== null || dscr !== null);
  return el('span', { class: 'compare-verdict' }, [el('span', {
    class: 'pill ' + (none ? '' : pass ? 'pill--pass' : 'pill--fail'),
    text: none ? '—' : pass ? 'Meets' : 'Below',
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
  // Row-table sorting: key is 'name' or a METRICS index; null = selection order.
  let sortKey = null, sortDir = 'asc';

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

  // A clickable, keyboard-operable sort header. Toggles direction when it's
  // already the active column; otherwise sorts by it ascending first (design.md
  // Tables & Sorting), then re-click to flip. aria-sort keeps it accessible.
  function sortHeader(key, label, isNum) {
    const active = sortKey === key;
    const th = el('th', {
      scope: 'col', class: (isNum ? 'num ' : '') + 'th-sort' + (active ? ' th-sort--on' : ''),
      'aria-sort': active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none',
    });
    const btn = el('button', { class: 'th-sort__btn', type: 'button', title: `Sort by ${label}` }, [
      el('span', { class: 'th-sort__label', text: label }),
      el('span', { class: 'th-sort__caret', 'aria-hidden': 'true', text: active ? (sortDir === 'asc' ? '▲' : '▼') : '↕' }),
    ]);
    btn.addEventListener('click', () => {
      if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else { sortKey = key; sortDir = 'asc'; }   // ascending first (design.md)
      draw();
    });
    th.appendChild(btn);
    return th;
  }

  // Order rows by the active sort; non-finite values ("—") always sink to the
  // bottom regardless of direction. Returns a new array (selection order kept).
  function sortRows(rows) {
    if (sortKey === null) return rows;
    const dir = sortDir === 'asc' ? 1 : -1;
    const numeric = sortKey !== 'name';
    const keyOf = numeric ? ({ p, m }) => METRICS[sortKey][1](m, p) : ({ p }) => (p.name || '').toLowerCase();
    return rows.slice().sort((a, b) => {
      const va = keyOf(a), vb = keyOf(b);
      if (numeric) {
        const na = fnum(va), nb = fnum(vb);
        if (na && nb) return 0;
        if (na) return 1;              // a is "—" → after b
        if (nb) return -1;             // b is "—" → after a
        return (va - vb) * dir;
      }
      return String(va).localeCompare(String(vb)) * dir;
    });
  }

  // Table: one row per property, metrics across the top; click any header to sort.
  function drawTable() {
    const cols = selected.map((p) => ({ p, m: compute(p) }));
    // best/worst is computed over the full set, so it's independent of row order.
    const bw = METRICS.map(([label, sel, f, dir]) => extremes(cols.map(({ m, p }) => sel(m, p)), dir));
    const head = el('tr', {}, [sortHeader('name', 'Prospect', false),
      ...METRICS.map(([label], i) => sortHeader(i, label, true))]);
    const body = sortRows(cols).map(({ p, m }) => el('tr', {}, [
      el('td', {}, [el('span', { class: 'compare-name', text: p.name || 'Untitled' }), verdictPill(p, m)]),
      ...METRICS.map(([label, sel, f], ci) => {
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
    const rows = METRICS.map(([label, sel, f, dir]) => {
      const vals = cols.map(({ m, p }) => sel(m, p));
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
    el('p', { class: 'fineprint', text: 'Pick any 2 or more properties. Click a column header to sort. Best value per metric is green, worst is red; no-data is neutral.' }),
    chips, tableHost,
  ]);
  draw();
}
