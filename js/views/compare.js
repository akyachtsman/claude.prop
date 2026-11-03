// views/compare.js — compare saved properties two ways:
//   • Table  — one row per property, every metric across the top (spreadsheet
//     style, best value per column highlighted).
//   • Side by side — each property a column, every metric a row.
// Both share the property picker; best/worst is direction-aware, no-data neutral.

import { el, render, dragScroll } from '../dom.js';
import * as fmt from '../format.js';
import { compute, capVerdict, dscrVerdict } from '../model.js';

// The single, ordered metric set shared by both layouts: [label, selector(m, p),
// formatter, direction]. Asking leads (context only — no winner), then the 12
// dashboard KPIs in KPI-strip order. Direction drives best/worst (up = higher
// is better; down = lower is better; null = neutral). Kept compact by design —
// more columns are expected here later.
export const METRICS = [
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

export const fnum = (v) => (v === null || v === undefined || !Number.isFinite(v));

// Best/worst value for a set given a direction; null when it can't be decided.
export function extremes(vals, dir) {
  if (!dir) return { best: null, worst: null };
  const finite = vals.filter((v) => !fnum(v));
  if (finite.length < 2) return { best: null, worst: null };
  let best = dir === 'up' ? Math.max(...finite) : Math.min(...finite);
  let worst = dir === 'up' ? Math.min(...finite) : Math.max(...finite);
  if (best === worst) return { best: null, worst: null };   // all equal → neutral
  return { best, worst };
}

export function verdictPill(p, m) {
  const cap = capVerdict(m.cap);
  const dscr = dscrVerdict(m.dscr);
  const none = cap === null && dscr === null;
  const pass = cap !== false && dscr !== false && (cap !== null || dscr !== null);
  return el('span', { class: 'compare-verdict' }, [el('span', {
    class: 'pill' + (none ? '' : pass ? ' pill-success' : ' pill-danger'),
    text: none ? '—' : pass ? 'Meets' : 'Below',
  })]);
}

// The house sortable header (design.md §6): a native .th-sort button inside the
// <th>, which carries aria-sort; House.sortable adds the " ▲" / " ▼" mark and
// fires "house:sort". data-key names what the column sorts by: 'name' or a
// METRICS index.
export function sortHeader(key, label, isNum, sortKey, sortDir) {
  const active = sortKey === key;
  const th = el('th', { scope: 'col', class: isNum ? 'num' : null, dataset: { key: String(key) } }, [
    el('button', { class: 'th-sort', type: 'button', text: label }),
  ]);
  if (active) th.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
  return th;
}

// The table keeps its own row order (data-sort="manual": the excluded rows sit
// below their divider, outside the sort), so a header press re-renders through
// onSort(key, dir), which returns the new table; focus moves to the same header
// there, so a keyboard user stays where they pressed.
export function bindSort(table, onSort) {
  table.dataset.sort = 'manual';
  table.addEventListener('house:sort', (e) => {
    const k = table.tHead.rows[0].cells[e.detail.column].dataset.key;
    const next = onSort(k === 'name' ? 'name' : Number(k), e.detail.dir);
    const btn = next && next.querySelector(`thead th[data-key="${k}"] .th-sort`);
    if (btn) btn.focus();
  });
  window.House.sortable(table);
}

// Sorts { p, m } rows by a key from sortHeader, with the house comparator:
// blanks ("—") last in both directions, names in natural order.
export function sortRows(rows, sortKey, sortDir) {
  if (sortKey === null) return rows;
  const keyOf = sortKey === 'name'
    ? ({ p }) => p.name || ''
    : ({ p, m }) => { const v = METRICS[sortKey][1](m, p); return fnum(v) ? null : v; };
  return rows.slice().sort((a, b) => window.House.compare(keyOf(a), keyOf(b), sortDir));
}

// "← Properties": the page's one Back control, top-left of the content (§11).
export function backLink(ctx) {
  return el('button', { class: 'link-action view-back', type: 'button', onclick: () => ctx.goList(), text: '← Properties' });
}

export function renderCompare(container, ctx) {
  const all = ctx.list();
  if (all.length < 2) {
    const host = el('div');
    render(container, [backLink(ctx), el('h1', { text: 'Compare' }), host]);
    window.House.empty(host, {
      title: 'Nothing to compare yet.',
      text: 'Add at least two properties to line them up side by side.',
      action: { label: '+ Add property', onClick: () => ctx.newProperty(), primary: true },
    });
    return;
  }

  const selected = ctx.compareIds && ctx.compareIds.length
    ? all.filter((p) => ctx.compareIds.includes(p.id))
    : all.slice();   // default: line up every saved property
  let layout = 'table';   // 'table' (rows) | 'cols' (side by side)
  // Row-table sorting: key is 'name' or a METRICS index; null = selection order.
  let sortKey = null, sortDir = 'asc';

  function toggleSelected(p, checked) {
    const idx = selected.findIndex((s) => s.id === p.id);
    if (checked) { if (idx < 0) selected.push(p); }
    else if (idx >= 0) selected.splice(idx, 1);
    draw();
  }
  // A checkbox for one property — used in front of its own row (Table layout)
  // or in the picker above its column (Side by side). Unchecking drops it out
  // of the comparison; re-checking brings it right back in.
  function pickerCheckbox(p, on) {
    const checkbox = el('input', {
      type: 'checkbox', class: 'checkbox', checked: on ? true : null,
      'aria-label': `Include ${p.name || 'Untitled'} in comparison`,
    });
    checkbox.addEventListener('change', () => toggleSelected(p, checkbox.checked));
    return checkbox;
  }
  // The row's name opens the deal (design.md §6); its verdict pill sits beside it.
  function prospect(p, m) {
    return el('div', { class: 'compare-prospect' }, [
      el('button', { class: 'row-open', type: 'button', onclick: () => ctx.open(p.id), text: p.name || 'Untitled' }),
      m ? verdictPill(p, m) : null,
    ]);
  }
  const included = () => all.filter((p) => selected.some((s) => s.id === p.id));
  const excluded = () => all.filter((p) => !selected.some((s) => s.id === p.id));

  // The layout switch is the house segmented control (§11): two tabs, each
  // showing its own panel. Only the selected panel is drawn.
  const tabs = el('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Comparison layout' }, [
    el('button', { type: 'button', role: 'tab', id: 'compare-tab-table', 'aria-controls': 'compare-panel-table', 'aria-selected': 'true', text: 'Table' }),
    el('button', { type: 'button', role: 'tab', id: 'compare-tab-cols', 'aria-controls': 'compare-panel-cols', 'aria-selected': 'false', text: 'Side by side' }),
  ]);
  const tablePanel = el('div', { id: 'compare-panel-table', role: 'tabpanel', 'aria-labelledby': 'compare-tab-table' });
  const colsPanel = el('div', { id: 'compare-panel-cols', role: 'tabpanel', 'aria-labelledby': 'compare-tab-cols', hidden: true });
  tabs.addEventListener('house:select', (e) => { layout = e.detail.tab.id === 'compare-tab-cols' ? 'cols' : 'table'; draw(); });

  function tableWrap(table) {
    const wrap = el('div', { class: 'table-wrap compare-wrap' }, [table]);
    dragScroll(wrap);
    return wrap;
  }

  function draw() {
    if (layout === 'table') { render(colsPanel, []); drawTable(); }
    else { render(tablePanel, []); drawSideBySide(); }
  }

  // Table: one row per property, metrics across the top; press any header to
  // sort. A checkbox leads every row, checked property or not — unchecking
  // excludes it from the comparison and sorting, and sinks its row below a
  // divider row; the divider only appears once something is excluded.
  function drawTable() {
    const cols = included().map((p) => ({ p, m: compute(p) }));
    const out = excluded();
    // best/worst is computed over the included set only, independent of row order.
    const bw = METRICS.map(([label, sel, f, dir]) => extremes(cols.map(({ m, p }) => sel(m, p)), dir));
    const colCount = METRICS.length + 2;   // checkbox + prospect + metrics
    const head = el('tr', {}, [
      el('th', { scope: 'col', class: 'compare-check-col', 'aria-label': 'Include in comparison' }),
      sortHeader('name', 'Prospect', false, sortKey, sortDir),
      ...METRICS.map(([label], i) => sortHeader(i, label, true, sortKey, sortDir)),
    ]);
    head.children[1].classList.add('compare-name-col');
    const includedRows = sortRows(cols, sortKey, sortDir).map(({ p, m }) => el('tr', {}, [
      el('td', { class: 'compare-check-col' }, [pickerCheckbox(p, true)]),
      el('td', { class: 'compare-name-col' }, [prospect(p, m)]),
      ...METRICS.map(([label, sel, f], ci) => {
        const v = sel(m, p);
        const { best, worst } = bw[ci];
        const cls = 'num' + (fnum(v) ? '' : v === best ? ' cell--best' : v === worst ? ' cell--worst' : '');
        return el('td', { class: cls, text: fnum(v) ? '—' : f(v) });
      }),
    ]));
    let excludedRows = [];
    if (out.length) {
      excludedRows = [
        el('tr', { class: 'compare-divider-row' }, [
          el('td', { colspan: String(colCount), text: 'Not included in comparison' }),
        ]),
        ...out.map((p) => {
          const m = compute(p);
          return el('tr', { class: 'compare-table-row--off' }, [
            el('td', { class: 'compare-check-col' }, [pickerCheckbox(p, false)]),
            el('td', { class: 'compare-name-col' }, [prospect(p, null)]),
            ...METRICS.map(([label, sel, f]) => {
              const v = sel(m, p);
              return el('td', { class: 'num', text: fnum(v) ? '—' : f(v) });
            }),
          ]);
        }),
      ];
    }
    const table = el('table', { class: 'table compare-table compare-table--rows compare-table--check' }, [
      el('thead', {}, head), el('tbody', {}, [...includedRows, ...excludedRows]),
    ]);
    render(tablePanel, [tableWrap(table)]);
    bindSort(table, (k, d) => { sortKey = k; sortDir = d; return drawTable(); });
    return table;
  }

  // Side by side: each property a column, metrics down the rows. Properties are
  // columns here, so the include checkboxes sit in a picker above the table.
  function drawSideBySide() {
    const inc = included(), out = excluded();
    const pickerRow = (p, on) => el('label', { class: 'compare-row' + (on ? '' : ' compare-row--off') }, [
      pickerCheckbox(p, on), el('span', { class: 'compare-row__name', text: p.name || 'Untitled' }),
    ]);
    const picker = el('div', { class: 'compare-picker' }, [
      ...inc.map((p) => pickerRow(p, true)),
      ...(out.length ? [el('div', { class: 'compare-divider', text: 'Not included in comparison' }), ...out.map((p) => pickerRow(p, false))] : []),
    ]);
    const cols = selected.map((p) => ({ p, m: compute(p) }));
    const headRow = el('tr', {}, [el('th', { scope: 'col', text: 'Metric' }),
      ...cols.map(({ p }) => el('th', { scope: 'col', class: 'num', text: p.name || 'Untitled' }))]);
    const verdictRow = el('tr', { class: 'compare-verdict-row' }, [el('th', { scope: 'row', text: 'Vs targets' }),
      ...cols.map(({ p, m }) => el('td', { class: 'num' }, [verdictPill(p, m)]))]);
    const rows = METRICS.map(([label, sel, f, dir]) => {
      const vals = cols.map(({ m, p }) => sel(m, p));
      const { best, worst } = extremes(vals, dir);
      return el('tr', {}, [el('th', { scope: 'row', text: label }),
        ...vals.map((v) => el('td', {
          class: 'num' + (fnum(v) ? '' : v === best ? ' cell--best' : v === worst ? ' cell--worst' : ''),
          text: fnum(v) ? '—' : f(v),
        }))]);
    });
    render(colsPanel, [picker, tableWrap(el('table', { class: 'table compare-table compare-table--cols' }, [
      el('thead', {}, headRow), el('tbody', {}, [verdictRow, ...rows]),
    ]))]);
  }

  render(container, [
    backLink(ctx),
    el('h1', { text: 'Compare' }),
    el('div', { class: 'view-controls' }, [tabs]),
    el('p', { class: 'view-note', text: 'Uncheck a property to leave it out of the comparison, and check it back in anytime. Press a column header to sort. The best value for each metric is green and the worst is red; no data stays plain.' }),
    tablePanel, colsPanel,
  ]);
  window.House.segmented(tabs);
  draw();
}
