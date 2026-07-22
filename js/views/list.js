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

// The site a property was uploaded from — the hostname if the source is a URL
// (crexi.com), otherwise the text as typed. Empty when no source is set.
function sourceLabel(src) {
  const s = (src || '').trim();
  if (!s) return '';
  try { return new URL(s).hostname.replace(/^www\./, ''); } catch { return s; }
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
    // Compare / Archive / New / Import live in the header; the empty state keeps
    // the first-run onboarding CTAs (including "Load sample", which is here only).
    render(container, [el('div', { class: 'empty' }, [
      el('h2', { text: 'No properties yet' }),
      el('p', { text: 'Add a property to underwrite it against your own CAP and DSCR targets, or load a sample deal to explore.' }),
      el('div', { class: 'empty__actions' }, [
        el('button', { class: 'btn btn--primary', type: 'button', onclick: () => ctx.importUrl(), text: 'Import a listing' }),
        el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ctx.newProperty(), text: 'Add your first property' }),
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
    // button) over the head + KPIs, plus a footer with the Archive / Delete
    // actions as siblings (each an explicit, labelled control on the card).
    return el('div', { class: 'lcard' }, [
      el('button', { class: 'lcard__open', type: 'button', 'aria-label': `Open ${prop.name || 'property'}`, onclick: () => ctx.open(prop.id) }, [
        el('div', { class: 'lcard__head' }, [
          el('span', { class: 'lcard__mono', text: monogram(prop.name) }),
          el('div', { class: 'lcard__title' }, [
            el('span', { class: 'lcard__name', text: prop.name || 'Untitled property' }),
            el('span', { class: 'lcard__sub', text: `Offer ${fmt.money(prop.offer.offerPrice)} · ${fmt.integer(prop.info.rentableSF)} SF` }),
            ...(sourceLabel(prop.info && prop.info.source) ? [el('span', { class: 'lcard__source', text: `via ${sourceLabel(prop.info.source)}` })] : []),
          ]),
          badge(prop, m),
        ]),
        el('div', { class: 'lcard__kpis' }, [
          kpi('CAP', fmt.percent2(m.cap)), kpi('DSCR', fmt.ratio(m.dscr)),
          kpi('NOI', fmt.moneyCompact(m.noi)), kpi('CoC', fmt.percent2(m.cashOnCash)),
        ]),
      ]),
      // Archive is the only card action — deleting happens from the Archive view
      // (archive first, then Restore or Delete there), so a deal is never lost in
      // one click from the list.
      el('div', { class: 'lcard__foot' }, [
        el('button', { class: 'lcard__act', type: 'button', 'aria-label': `Archive ${prop.name || 'property'}`, title: 'Archive this property', onclick: () => ctx.archive(prop), text: 'Archive' }),
      ]),
    ]);
  });

  render(container, [
    // The primary actions (Compare / Archive / New / Import) now live in the
    // topbar header (fillTopbarActions), not in this frame.
    el('div', { class: 'list-head' }, [
      el('h1', { text: 'Properties' }),
    ]),
    el('div', { class: 'lcard-grid' }, cards),
  ]);
}
