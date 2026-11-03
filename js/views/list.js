// views/list.js — the Properties page (design.md §5, §7, §15, §16): a toolbar
// (search, Compare, Archived (N), Import a listing, then + Add property at the
// right) over a grid of house cards. A card opens from anywhere on it; its one
// action, Archive, sits in the top-right corner and is confirmed by app.js.

import { el, render } from '../dom.js';
import * as fmt from '../format.js';
import { compute, capVerdict, dscrVerdict } from '../model.js';

// The search survives leaving the page and coming back (§11: Back returns to
// the same filters), for as long as the page is open.
let query = '';

function badge(m) {
  const cap = capVerdict(m.cap);
  const dscr = dscrVerdict(m.dscr);
  if (cap === null && dscr === null) return el('span', { class: 'pill', text: 'No verdict' });
  const pass = cap !== false && dscr !== false && (cap !== null || dscr !== null);
  return el('span', { class: 'pill ' + (pass ? 'pill-success' : 'pill-danger'), text: pass ? 'Meets benchmark' : 'Below benchmark' });
}

// What the search box matches: the name, plus the type and city when the deal
// carries them.
function haystack(p) {
  const i = p.info || {};
  return [p.name, i.propertyType, i.subtype, i.city, i.address].filter(Boolean).join(' ').toLowerCase();
}

function card(prop, ctx) {
  const m = compute(prop);
  const name = prop.name || 'Untitled property';
  const kpi = (label, val) => el('div', { class: 'lcard__kpi' }, [
    el('span', { class: 'lcard__kpi-label', text: label }),
    el('span', { class: 'lcard__kpi-val', text: val }),
  ]);
  const archive = `Archive ${name}`;
  // A card with an action is a plain container (§5): the title is the opening
  // button, stretched over the card; the Archive icon sits above that overlay.
  return el('div', { class: 'card lcard' }, [
    el('div', { class: 'card-actions' }, [
      el('button', { class: 'btn btn-icon lcard__archive', type: 'button', 'aria-label': archive, title: archive, onclick: (e) => ctx.archive(prop, e.currentTarget) }, [window.House.icon('archive')]),
    ]),
    el('button', { class: 'card-open lcard__open', type: 'button', onclick: () => ctx.open(prop.id) }, [
      el('span', { class: 'card-title lcard__name', text: name }),
    ]),
    el('div', { class: 'card-sub', text: `Offer ${fmt.money(prop.offer.offerPrice)} · ${fmt.integer(prop.info.rentableSF)} SF` }),
    el('div', { class: 'lcard__status' }, [badge(m)]),
    // The six headline numbers the owner reads the list by (§1.6), always the
    // same six: format.js renders "—" for anything not computable, so a card's
    // shape never shifts between properties.
    el('div', { class: 'lcard__kpis' }, [
      kpi('CAP', fmt.percent2(m.cap)), kpi('DSCR', fmt.ratio(m.dscr)),
      kpi('NOI', fmt.moneyCompact(m.noi)), kpi('CoC', fmt.percent2(m.cashOnCash)),
      kpi('IRR', fmt.percent2(m.irr)), kpi('5Y NPV', fmt.moneyCompact(m.npv)),
    ]),
  ]);
}

// Archived (N): the archive icon, then the words; hidden when N is 0 (§7). By
// owner ruling it opens the Archive page rather than a pop-over.
function archivedButton(ctx) {
  const n = ctx.archivedCount();
  if (!n) return null;
  return el('button', { class: 'btn archived-btn', type: 'button', id: 'nav-archive', onclick: () => ctx.goArchive() }, [
    window.House.icon('archive'), el('span', { text: `Archived (${n})` }),
  ]);
}

export function renderList(container, ctx) {
  const props = ctx.list();

  if (props.length === 0) {
    // First run: the empty state carries the Add button itself (§15), with the
    // two other ways in beside it.
    const host = el('div', { class: 'list-first' });
    const archived = archivedButton(ctx);
    render(container, [el('h1', { text: 'Properties' }), host, archived ? el('div', { class: 'list-under' }, [archived]) : null]);
    const box = window.House.empty(host, {
      title: 'No properties yet.',
      text: 'Add a property to underwrite it against your CAP and DSCR targets, import a listing, or load a sample deal to explore.',
      action: { label: '+ Add property', onClick: () => ctx.newProperty(), primary: true },
    });
    box.querySelector('.empty-act').after(
      el('button', { class: 'btn empty-act', type: 'button', onclick: () => ctx.importUrl(), text: 'Import a listing' }),
      el('button', { class: 'btn empty-act', type: 'button', onclick: () => ctx.loadSample(), text: 'Load sample deal' }),
    );
    return;
  }

  const grid = el('div', { class: 'grid lcard-grid' });
  function draw() {
    const q = query.trim().toLowerCase();
    const shown = q ? props.filter((p) => haystack(p).includes(q)) : props;
    if (!shown.length) {
      window.House.empty(grid, {
        title: 'No properties match your search.',
        action: { label: 'Clear search', onClick: () => { search.value = ''; query = ''; draw(); search.focus(); } },
      });
      grid.classList.add('lcard-grid--none');
      return;
    }
    grid.classList.remove('lcard-grid--none');
    render(grid, shown.map((p) => card(p, ctx)));
  }

  const search = el('input', { class: 'input', type: 'search', placeholder: 'Search properties…', 'aria-label': 'Search properties', value: query });
  search.addEventListener('input', () => { query = search.value; draw(); });

  render(container, [
    el('h1', { text: 'Properties' }),
    // §16: search first, then the list's tools, then + Add at the right end.
    el('div', { class: 'toolbar list-toolbar' }, [
      el('label', { class: 'search' }, [window.House.icon('search'), search]),
      el('button', { class: 'btn', type: 'button', id: 'nav-compare', onclick: () => ctx.goCompare(), text: 'Compare' }),
      archivedButton(ctx),
      el('button', { class: 'btn', type: 'button', onclick: () => ctx.importUrl(), text: 'Import a listing' }),
      el('button', { class: 'btn btn-primary toolbar-add', type: 'button', onclick: () => ctx.newProperty(), text: '+ Add property' }),
    ]),
    grid,
  ]);
  draw();
}
