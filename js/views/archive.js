// views/archive.js — archived properties, shown as rows in a table exactly like
// the Compare "Table" layout (one row per property, every metric across the top,
// best value per column highlighted). Each row adds Restore + Delete actions and
// a clickable name that reopens the deal. Archiving hides a property from the
// Properties list and Compare without deleting it; this is where it lives until
// restored.

import { el, render } from '../dom.js';
import { compute } from '../model.js';
import { METRICS, fnum, extremes, verdictPill } from './compare.js';

export function renderArchive(container, ctx) {
  const all = ctx.archived();

  if (all.length === 0) {
    render(container, [
      el('div', { class: 'list-head' }, [
        el('h1', { text: 'Archive' }),
        el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ctx.goList(), text: 'Back to properties' }),
      ]),
      el('div', { class: 'empty' }, [
        el('h2', { text: 'No archived properties' }),
        el('p', { text: 'Archive a property from its card on the Properties list to tuck it away here without deleting it.' }),
      ]),
    ]);
    return;
  }

  // Row-table sorting: 'name' or a METRICS index; null = as-listed order.
  let sortKey = null, sortDir = 'asc';
  const tableHost = el('div', { class: 'table-wrap' });

  // A clickable, keyboard-operable sort header — identical behaviour to Compare:
  // ascending first, re-click flips; aria-sort keeps it accessible.
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
      else { sortKey = key; sortDir = 'asc'; }
      draw();
    });
    th.appendChild(btn);
    return th;
  }

  // Non-finite values ("—") always sink to the bottom regardless of direction.
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
        if (na) return 1;
        if (nb) return -1;
        return (va - vb) * dir;
      }
      return String(va).localeCompare(String(vb)) * dir;
    });
  }

  function draw() {
    const cols = all.map((p) => ({ p, m: compute(p) }));
    // best/worst over the full set — independent of row order.
    const bw = METRICS.map(([label, sel, f, dir]) => extremes(cols.map(({ m, p }) => sel(m, p)), dir));
    const head = el('tr', {}, [
      sortHeader('name', 'Prospect', false),
      ...METRICS.map(([label], i) => sortHeader(i, label, true)),
    ]);
    const body = sortRows(cols).map(({ p, m }) => el('tr', {}, [
      // Name + verdict + the row's actions, all in the sticky-left first column so
      // Restore stays visible no matter how far the metric columns scroll.
      // Name + verdict + the R/× actions all on ONE line in the sticky-left column.
      el('td', {}, [
        el('div', { class: 'archive-prospect' }, [
          // Actions lead the row (R restore, × permanent delete), then the name + verdict.
          el('div', { class: 'archive-actions' }, [
            el('button', { class: 'btn btn--ghost btn--sm archive-restore', type: 'button', 'aria-label': `Restore ${p.name || 'property'}`, title: 'Restore to Properties', onclick: () => ctx.restore(p), text: 'R' }),
            el('button', { class: 'btn btn--ghost btn--sm archive-del', type: 'button', 'aria-label': `Delete ${p.name || 'property'}`, title: 'Permanently delete', onclick: () => ctx.remove(p), text: '×' }),
          ]),
          el('button', { class: 'compare-name archive-name', type: 'button', title: 'Open', onclick: () => ctx.open(p.id), text: p.name || 'Untitled' }),
          verdictPill(p, m),
        ]),
      ]),
      ...METRICS.map(([label, sel, f], ci) => {
        const v = sel(m, p);
        const { best, worst } = bw[ci];
        const cls = 'num' + (fnum(v) ? '' : v === best ? ' cell--best' : v === worst ? ' cell--worst' : '');
        return el('td', { class: cls, text: fnum(v) ? '—' : f(v) });
      }),
    ]));
    render(tableHost, [el('table', { class: 'data-table compare-table compare-table--rows archive-table' }, [
      el('thead', {}, head), el('tbody', {}, body),
    ])]);
  }

  render(container, [
    el('div', { class: 'list-head' }, [
      el('h1', { text: 'Archive' }),
      el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ctx.goList(), text: 'Back to properties' }),
    ]),
    el('p', { class: 'fineprint', text: 'Archived properties, laid out like Compare. Click a column header to sort; best value per metric is green, worst is red. Restore returns a deal to Properties.' }),
    tableHost,
  ]);
  draw();
}
