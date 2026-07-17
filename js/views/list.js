// views/list.js — property list: cards with monogram, headline KPIs, and a
// pass/fail badge. Empty state offers "Load sample deal" and "+ New".

import { el, render } from '../dom.js';
import * as fmt from '../format.js';
import { compute, capVerdict, dscrVerdict } from '../model.js';

function monogram(name) {
  const words = (name || '?').trim().split(/[\s—-]+/).filter(Boolean);
  const initials = (words[0]?.[0] || '?') + (words[1]?.[0] || '');
  return initials.toUpperCase();
}

function badge(prop, m) {
  const cap = capVerdict(m.cap);
  const dscr = dscrVerdict(m.dscr);
  if (cap === null && dscr === null) return el('span', { class: 'pill', text: 'No verdict' });
  const pass = cap !== false && dscr !== false && (cap !== null || dscr !== null);
  return el('span', { class: 'pill ' + (pass ? 'pill--pass' : 'pill--fail'), text: pass ? 'Meets benchmark' : 'Below benchmark' });
}

export function renderList(container, ctx) {
  const props = ctx.list();

  if (props.length === 0) {
    render(container, [el('div', { class: 'empty' }, [
      el('h2', { text: 'No properties yet' }),
      el('p', { text: 'Add a property to underwrite it against your own CAP and DSCR targets, or load a sample deal to explore.' }),
      el('div', { class: 'empty__actions' }, [
        el('button', { class: 'btn btn--primary', type: 'button', onclick: () => ctx.newProperty(), text: 'Add your first property' }),
        el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ctx.loadSample(), text: 'Load sample deal' }),
      ]),
    ])]);
    return;
  }

  const cards = props.map((prop) => {
    const m = compute(prop);
    const kpi = (label, val) => el('div', { class: 'lcard__kpi' }, [
      el('span', { class: 'lcard__kpi-label', text: label }),
      el('span', { class: 'lcard__kpi-val', text: val }),
    ]);
    // The card is a container: a full-area "open" button (a button can't nest a
    // button, so Delete is a sibling) plus a corner Delete control.
    return el('div', { class: 'lcard' }, [
      el('button', { class: 'lcard__open', type: 'button', 'aria-label': `Open ${prop.name || 'property'}`, onclick: () => ctx.open(prop.id) }, [
        el('div', { class: 'lcard__head' }, [
          el('span', { class: 'lcard__mono', text: monogram(prop.name) }),
          el('div', { class: 'lcard__title' }, [
            el('span', { class: 'lcard__name', text: prop.name || 'Untitled property' }),
            el('span', { class: 'lcard__sub', text: `Offer ${fmt.money(prop.offer.offerPrice)} · ${fmt.integer(prop.info.rentableSF)} SF` }),
          ]),
          badge(prop, m),
        ]),
        el('div', { class: 'lcard__kpis' }, [
          kpi('CAP', fmt.percent2(m.cap)), kpi('DSCR', fmt.ratio(m.dscr)),
          kpi('NOI', fmt.moneyCompact(m.noi)), kpi('CoC', fmt.percent2(m.cashOnCash)),
        ]),
      ]),
      // Decorative "opens" cue — pointer-events:none so clicks fall through to
      // the open button beneath it.
      el('span', { class: 'lcard__go', 'aria-hidden': 'true', text: '›' }),
      el('button', { class: 'lcard__del', type: 'button', 'aria-label': `Delete ${prop.name || 'property'}`, title: 'Delete', onclick: () => ctx.remove(prop), text: '×' }),
    ]);
  });

  render(container, [
    el('div', { class: 'list-head' }, [
      el('h1', { text: 'Properties' }),
      el('div', { class: 'list-head__actions' }, [
        el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ctx.goCompare(), text: 'Compare' }),
        el('button', { class: 'btn btn--primary', type: 'button', onclick: () => ctx.newProperty(), text: '+ New property' }),
      ]),
    ]),
    el('div', { class: 'lcard-grid' }, cards),
  ]);
}
