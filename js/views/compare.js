// views/compare.js — side-by-side comparison. Pick 2+ saved properties; each
// becomes a column of every KPI + key inputs. Best/worst per metric is
// direction-aware; no-data is neutral. Each column shows its pass/fail verdict.

import { el, render } from '../dom.js';
import * as fmt from '../format.js';
import { compute, capVerdict, dscrVerdict } from '../model.js';

// metric rows: [label, selector, formatter, direction] — dir: 'up' higher better,
// 'down' lower better, null = no best/worst.
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

  // selection state — default first up to 4
  const selected = ctx.compareIds && ctx.compareIds.length
    ? all.filter((p) => ctx.compareIds.includes(p.id))
    : all.slice(0, 4);

  const chips = el('div', { class: 'compare-picker' }, all.map((p) => {
    const on = selected.some((s) => s.id === p.id);
    const c = el('button', { class: 'chip' + (on ? ' chip--on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', text: p.name || 'Untitled' });
    c.addEventListener('click', () => {
      const idx = selected.findIndex((s) => s.id === p.id);
      if (idx >= 0) { if (selected.length > 2) selected.splice(idx, 1); }
      else if (selected.length < 4) selected.push(p);
      draw();
    });
    return c;
  }));

  const tableHost = el('div', { class: 'table-wrap' });

  function draw() {
    // refresh chip states
    [...chips.children].forEach((c, i) => {
      const on = selected.some((s) => s.id === all[i].id);
      c.className = 'chip' + (on ? ' chip--on' : '');
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const cols = selected.map((p) => ({ p, m: compute(p) }));

    const headRow = el('tr', {}, [el('th', { scope: 'col', text: 'Metric' }),
      ...cols.map(({ p }) => el('th', { scope: 'col', text: p.name || 'Untitled' }))]);

    // verdict row
    const verdictRow = el('tr', { class: 'compare-verdict' }, [el('td', { text: 'Vs targets' }),
      ...cols.map(({ p, m }) => {
        const cap = capVerdict(m.cap, p.targets.desiredCap);
        const dscr = dscrVerdict(m.dscr, p.targets.desiredDscr);
        const pass = cap !== false && dscr !== false && (cap !== null || dscr !== null);
        const none = cap === null && dscr === null;
        return el('td', { class: 'num' }, [el('span', {
          class: 'pill ' + (none ? '' : pass ? 'pill--pass' : 'pill--fail'),
          text: none ? 'No targets' : pass ? 'Meets' : 'Below',
        })]);
      })]);

    const rows = ROWS.map(([label, sel, f, dir]) => {
      const vals = cols.map(({ m }) => sel(m));
      const finite = vals.filter((v) => v !== null && Number.isFinite(v));
      let best = null, worst = null;
      if (dir && finite.length > 1) {
        best = dir === 'up' ? Math.max(...finite) : Math.min(...finite);
        worst = dir === 'up' ? Math.min(...finite) : Math.max(...finite);
        if (best === worst) { best = null; worst = null; } // all equal → neutral
      }
      return el('tr', {}, [el('td', { text: label }),
        ...vals.map((v) => {
          const cls = v === null || !Number.isFinite(v) ? 'num'
            : v === best ? 'num cell--best' : v === worst ? 'num cell--worst' : 'num';
          return el('td', { class: cls, text: f(v) });
        })]);
    });

    render(tableHost, [el('table', { class: 'data-table compare-table' }, [
      el('thead', {}, [headRow, verdictRow]),
      el('tbody', {}, rows),
    ])]);
  }

  render(container, [
    el('div', { class: 'list-head' }, [
      el('h1', { text: 'Compare' }),
      el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ctx.goList(), text: 'Back to properties' }),
    ]),
    el('p', { class: 'fineprint', text: 'Pick 2–4 properties. Best value per metric is green, worst is red; no-data is neutral.' }),
    chips, tableHost,
  ]);
  draw();
}
