// app.js — hash router + shared state. Wires views to store + model, owns the
// topbar center slot (switcher/pills or view title), first-run, export/import.

import { el, clear, toast } from './dom.js';
import * as store from './store.js';
import * as fmt from './format.js';
import { capVerdict, dscrVerdict } from './model.js';
import { sampleProperty, demoProperties } from './sample.js';
import { renderDashboard } from './views/dashboard.js';
import { renderList } from './views/list.js';
import { renderCompare } from './views/compare.js';

const view = document.getElementById('view');
const center = document.getElementById('topbar-center');
const navProps = document.getElementById('nav-properties');
const navCompare = document.getElementById('nav-compare');

let undoStack = [];     // committed prior states of the property being edited (undo history)
let redoStack = [];     // states undone and available to redo (cleared by any new edit)
let historyId = null;   // the property the undo/redo stacks belong to
let committedState = null;   // the current committed state, in memory (drives undo/redo snapshots)

// ── blank property factory (for "+ New") ────────────────────────────────
function blankProperty() {
  return {
    id: store.newId(), schemaVersion: 1, name: 'New property',
    info: { askingPrice: 0, rentableSF: 0, lotSize: '', yearBuilt: '', zoning: '', hvacAge: '', roofAge: '', parking: '', ceilingHeight: '', appraisedValue: 0, apn: '', bedrooms: '', baths: '' },
    targets: { desiredCap: 0.06, desiredDscr: 1.25 },
    offer: { offerPrice: 0, fees: 0, improvements: 0 },
    loans: [{ ltv: 0.7, rate: 0.065, termYears: 25, maturityYears: 0, type: 'CONV' }, { ltv: 0, rate: 0.065, termYears: 25, maturityYears: 0, type: 'IO' }],
    tenants: Array.from({ length: 4 }, () => ({ name: '', sf: 0, monthlyIncome: 0, leaseExpires: '', leaseOptions: '' })),
    expenses: [
      { key: 'insurance', label: 'Insurance', amount: 0, included: true, estimated: true },
      { key: 'taxes', label: 'Property taxes', amount: 0, included: true, estimated: true },
      { key: 'cam', label: 'CAM', amount: 0, included: false, estimated: false },
      { key: 'hoa', label: 'HOA', amount: 0, included: false, estimated: false },
      { key: 'utilities', label: 'Utilities', amount: 0, included: true, estimated: false },
      { key: 'management', label: 'Management', amount: 0, included: true, estimated: false },
      { key: 'maintenance', label: 'Maintenance', amount: 0, included: true, estimated: false },
      { key: 'landscaping', label: 'Landscaping', amount: 0, included: true, estimated: false },
      { key: 'cleaning', label: 'Cleaning', amount: 0, included: false, estimated: false },
    ],
    assumptions: { minOppCostEquity: 0.15, taxRate: 0.28, collectionLoss: 0.05, cashflowAppr: 0.02, capitalAppr: 0.02 },
  };
}

function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

// ── routing ─────────────────────────────────────────────────────────────
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('p/')) return { route: 'dashboard', id: decodeURIComponent(h.slice(2)) };
  if (h.startsWith('compare')) {
    const q = h.split('?')[1] || '';
    const ids = new URLSearchParams(q).get('ids');
    return { route: 'compare', ids: ids ? ids.split(',') : null };
  }
  return { route: 'list' };
}

function navigate(hash) { location.hash = hash; }

function setActiveNav(route) {
  navProps.classList.toggle('topbar__link--active', route !== 'compare');
  navCompare.classList.toggle('topbar__link--active', route === 'compare');
}

function router() {
  const r = parseHash();
  setActiveNav(r.route);
  if (r.route === 'dashboard') return showDashboard(r.id);
  if (r.route === 'compare') return showCompare(r.ids);
  return showList();
}

// ── views ────────────────────────────────────────────────────────────────
function showList() {
  clear(center);
  center.appendChild(el('span', { class: 'topbar__viewtitle', text: 'Properties' }));
  renderList(view, {
    list: store.list,
    open: (id) => navigate('#/p/' + encodeURIComponent(id)),
    newProperty: createNew,
    loadSample: loadSample,
    goCompare: () => navigate('#/compare'),
    remove: (p) => {
      if (!confirm(`This will permanently delete "${p.name || 'this property'}".`)) return;
      if (!store.remove(p.id)) return;   // offline reject (store toasts) — leave the card
      toast('Deleted.', 'info');
      showList();   // re-render the list in place
    },
  });
}

function showCompare(ids) {
  clear(center);
  center.appendChild(el('span', { class: 'topbar__viewtitle', text: 'Compare' }));
  renderCompare(view, {
    list: store.list, compareIds: ids,
    goList: () => navigate('#/'),
  });
}

function showDashboard(id) {
  const saved = store.get(id);
  if (!saved) { toast('That property no longer exists.', 'info'); navigate('#/'); return; }
  const props = store.list();
  const idx = props.findIndex((p) => p.id === id);
  const working = deepCopy(saved);

  // Undo/Redo: each committed edit (a field commits on Enter/blur) pushes the
  // prior state; Undo pops it, Redo replays it. A new edit clears the redo
  // history. The stacks are module-level so they survive the in-place re-render
  // on undo/redo, and reset when you switch to a different property.
  if (historyId !== id) { undoStack = []; redoStack = []; historyId = id; }
  committedState = deepCopy(saved);
  const undoBtn = el('button', { class: 'topbar__link topbar__action', type: 'button', 'aria-label': 'Undo last change', text: 'Undo', onclick: () => undo(id) });
  const redoBtn = el('button', { class: 'topbar__link topbar__action', type: 'button', 'aria-label': 'Redo change', text: 'Redo', onclick: () => redo(id) });
  const refreshHistory = () => { undoBtn.disabled = undoStack.length === 0; redoBtn.disabled = redoStack.length === 0; };
  refreshHistory();

  // topbar center: switcher (prev/next + title) + verdict pills
  clear(center);
  const prevId = props[(idx - 1 + props.length) % props.length]?.id;
  const nextId = props[(idx + 1) % props.length]?.id;
  const title = el('div', { class: 'switcher__title' }, [
    el('h1', { text: working.name || 'Untitled' }),
    el('span', { class: 'sub', text: `${fmtSub(working)} · property ${idx + 1} of ${props.length}` }),
  ]);
  const pills = el('div', { class: 'topbar__pills' });
  const actionsHost = el('div', { class: 'topbar__actions' });
  const switcher = el('div', { class: 'switcher' }, [
    el('button', { class: 'switcher__btn', type: 'button', 'aria-label': 'Previous property', onclick: () => guardNav('#/p/' + encodeURIComponent(prevId)), text: '◀' }),
    title,
    el('button', { class: 'switcher__btn', type: 'button', 'aria-label': 'Next property', onclick: () => guardNav('#/p/' + encodeURIComponent(nextId)), text: '▶' }),
  ]);
  center.appendChild(switcher);
  center.appendChild(pills);
  center.appendChild(actionsHost);

  renderDashboard(view, {
    property: working,
    actionsHost,
    undoButton: undoBtn,
    redoButton: redoBtn,
    setHeaderVerdicts: (m, p) => paintPills(pills, m, p),
    // Each committed edit: snapshot the prior state for undo, drop the redo
    // history, and persist immediately (commit = saved — no Save button).
    onCommit: () => {
      // Signed-in + offline rejects the write (store returns null): discard the
      // typed edit by re-rendering from the committed state; don't touch history.
      if (!store.save(working)) { showDashboard(working.id); return; }
      undoStack.push(committedState);
      committedState = deepCopy(working);
      redoStack = [];
      if (!store.isStorageOK()) toast("Couldn't save — storage is full or private mode. Export to keep your data.", 'info');
      refreshHistory();
    },
  });
}

function fmtSub(p) {
  const parts = [];
  if (p.info.askingPrice) parts.push('Asking ' + fmt.money(p.info.askingPrice));
  if (p.offer.offerPrice) parts.push('Offer ' + fmt.money(p.offer.offerPrice));
  if (p.info.rentableSF) parts.push(fmt.integer(p.info.rentableSF) + ' SF');
  return parts.join(' · ');
}

function paintPills(host, m, p) {
  clear(host);
  const cap = capVerdict(m.cap, p.targets.desiredCap);
  const dscr = dscrVerdict(m.dscr, p.targets.desiredDscr);
  const capTxt = `CAP ${fmt.percent2(m.cap)} ${cap ? '≥' : '<'} ${fmt.percent2(Number(p.targets.desiredCap))}`;
  const dscrTxt = `DSCR ${fmt.ratio(m.dscr)} ${dscr ? '≥' : '<'} ${fmt.ratio(Number(p.targets.desiredDscr))}`;
  if (cap !== null) host.appendChild(el('span', { class: 'pill ' + (cap ? 'pill--pass' : 'pill--fail'), text: capTxt }));
  if (dscr !== null) host.appendChild(el('span', { class: 'pill ' + (dscr ? 'pill--pass' : 'pill--fail'), text: dscrTxt }));
}

// ── actions ────────────────────────────────────────────────────────────
function guardNav(hash) { navigate(hash); }   // edits persist synchronously on commit
function undo(id) {
  if (!undoStack.length) return;
  const prev = undoStack[undoStack.length - 1];   // the state before the most recent committed edit
  if (!store.save(prev)) return;                   // offline reject → leave the stacks untouched
  undoStack.pop();
  redoStack.push(committedState);                  // current state → available to redo
  showDashboard(id);                               // re-render from the restored state (history is module-level, preserved)
}
function redo(id) {
  if (!redoStack.length) return;
  const next = redoStack[redoStack.length - 1];
  if (!store.save(next)) return;                   // offline reject → leave the stacks untouched
  redoStack.pop();
  undoStack.push(committedState);                  // current state → available to undo
  showDashboard(id);
}
function createNew() {
  const p = store.save(blankProperty());
  if (!p) return;                                  // offline reject (store toasts)
  navigate('#/p/' + encodeURIComponent(p.id));
}
function loadSample() {
  const p = store.save(sampleProperty());
  if (!p) return;                                  // offline reject (store toasts)
  toast('Sample deal loaded.', 'success');
  navigate('#/p/' + encodeURIComponent(p.id));
}

// ── export / import ──────────────────────────────────────────────────────
function exportData() {
  const blob = new Blob([store.exportAll()], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'property-analytics-export.json' });
  document.body.appendChild(a); a.click(); a.remove();
}
function importData() {
  const input = el('input', { type: 'file', accept: 'application/json' });
  input.addEventListener('change', () => {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = store.importAll(String(reader.result));
      if (res.ok) { toast(`Imported ${res.count} propert${res.count === 1 ? 'y' : 'ies'}.`, 'success'); navigate('#/'); router(); }
      else toast(res.error, 'info');
    };
    reader.readAsText(file);
  });
  input.click();
}

// Refresh a stale built-in sample: if a returning visitor has an older copy
// of the demo saved in localStorage (its sampleRev predates the current one),
// replace it with the corrected figures so they don't have to delete + reload.
// Scoped to the canonical sample id only — never touches a user's own deals.
function refreshBuiltinSample() {
  const fresh = sampleProperty();
  const stored = store.get(fresh.id);
  // Only refresh an OLDER copy (missing sampleRev counts as 0); never overwrite a
  // stored sample that is newer than what this build ships.
  if (stored && (stored.sampleRev || 0) < fresh.sampleRev) {
    store.save(fresh);
    toast('Updated the built-in 715 Plumas sample to the latest figures.', 'info');
  }
}

// Seed the extra demo deals once, so an existing user gets a richer Compare set
// without lifting a finger. Guarded two ways: only when the store already holds
// data (a brand-new visitor still meets the empty first-run), and only once ever
// (store.hasSeeded), so a demo the user deletes never comes back. Never
// overwrites a property the user already has under the same id.
function seedDemos() {
  if (store.hasSeeded() || store.list().length === 0) return;
  demoProperties().forEach((p) => { if (!store.get(p.id)) store.save(p); });
  store.markSeeded();
}

// ── boot ──────────────────────────────────────────────────────────────
document.getElementById('btn-export').addEventListener('click', exportData);
document.getElementById('btn-import').addEventListener('click', importData);
if (!store.probe()) toast('Saving is off — private mode or storage full. Export to keep your data.', 'info');

// Resolve auth before the first render (boot ordering): exchange any magic-link
// ?code, swap to the cloud backend, run the initial fetch + first-sign-in
// reconcile. Loaded dynamically and guarded so that if the account layer can't
// initialize, the app still boots fully in logged-out local mode (FR5).
try {
  const { initAccount } = await import('./account.js');
  await initAccount({ rerender: router });
} catch (e) {
  store.setSession(null);
}

// The built-in sample refresh + one-time demo seed belong to the logged-out
// local backend only; cloud accounts get their fixtures from the sign-in
// reconcile (js/account.js), so guard these to the local backend.
if (store.backendKind() === 'local') {
  refreshBuiltinSample();
  seedDemos();
}

window.addEventListener('hashchange', router);
router();
