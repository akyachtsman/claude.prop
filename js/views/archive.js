// views/archive.js — archived properties, shown as rows in a table exactly like
// the Compare "Table" layout (one row per property, every metric across the top,
// best value per column highlighted). The name opens the deal, and the last cell
// holds the row's actions, Restore and Delete permanently (design.md §6).
// Archiving hides a property from the Properties list and Compare without
// deleting it; this is where it lives until restored (an owner exception to
// design.md §7's Archived (N) pop-over, recorded in CLAUDE.md).

import { el, render, dragScroll } from '../dom.js';
import { compute } from '../model.js';
import { METRICS, fnum, extremes, verdictPill, sortHeader, bindSort, sortRows, backLink } from './compare.js';

export function renderArchive(container, ctx) {
  const all = ctx.archived();

  if (all.length === 0) {
    const host = el('div');
    render(container, [backLink(ctx), el('h1', { text: 'Archive' }), host]);
    window.House.empty(host, {
      title: 'No archived properties yet.',
      text: 'Archive a property from its card on the Properties list to keep it here without deleting it.',
    });
    return;
  }

  // Row-table sorting: 'name' or a METRICS index; null = as-listed order.
  let sortKey = null, sortDir = 'asc';
  const tableHost = el('div', { class: 'table-wrap compare-wrap' });
  dragScroll(tableHost);

  // The house buttons (design.md §3, §4, §8): a secondary text Restore, then the
  // trash-can Delete permanently, confirmed by app.js.
  function actions(p) {
    const name = p.name || 'property';
    const del = `Delete ${name} permanently`;
    return el('div', { class: 'row-actions' }, [
      el('button', { class: 'btn archive-restore', type: 'button', 'aria-label': `Restore ${name}`, title: 'Restore to Properties', onclick: () => ctx.restore(p), text: 'Restore' }),
      el('button', { class: 'btn btn-icon archive-del', type: 'button', 'aria-label': del, title: del, onclick: (e) => ctx.remove(p, e.currentTarget) }, [window.House.icon('trash')]),
    ]);
  }

  function draw() {
    const cols = all.map((p) => ({ p, m: compute(p) }));
    // best/worst over the full set — independent of row order.
    const bw = METRICS.map(([label, sel, f, dir]) => extremes(cols.map(({ m, p }) => sel(m, p)), dir));
    const head = el('tr', {}, [
      sortHeader('name', 'Prospect', false, sortKey, sortDir),
      ...METRICS.map(([label], i) => sortHeader(i, label, true, sortKey, sortDir)),
      el('th', { scope: 'col', class: 'compare-actions-col', text: 'Actions' }),
    ]);
    head.firstChild.classList.add('compare-name-col');
    const body = sortRows(cols, sortKey, sortDir).map(({ p, m }) => el('tr', {}, [
      el('td', { class: 'compare-name-col' }, [
        el('div', { class: 'compare-prospect' }, [
          el('button', { class: 'row-open archive-name', type: 'button', onclick: () => ctx.open(p.id), text: p.name || 'Untitled' }),
          verdictPill(p, m),
        ]),
      ]),
      ...METRICS.map(([label, sel, f], ci) => {
        const v = sel(m, p);
        const { best, worst } = bw[ci];
        const cls = 'num' + (fnum(v) ? '' : v === best ? ' cell--best' : v === worst ? ' cell--worst' : '');
        return el('td', { class: cls, text: fnum(v) ? '—' : f(v) });
      }),
      el('td', { class: 'compare-actions-col' }, [actions(p)]),
    ]));
    const table = el('table', { class: 'table compare-table compare-table--rows archive-table' }, [
      el('thead', {}, head), el('tbody', {}, body),
    ]);
    render(tableHost, [table]);
    bindSort(table, (k, d) => { sortKey = k; sortDir = d; return draw(); });
    return table;
  }

  render(container, [
    backLink(ctx),
    el('h1', { text: 'Archive' }),
    el('p', { class: 'view-note', text: 'Archived properties, laid out like Compare. Press a column header to sort; the best value for each metric is green and the worst is red. Restore returns a deal to Properties; Delete permanently removes it for good.' }),
    tableHost,
  ]);
  draw();
}
