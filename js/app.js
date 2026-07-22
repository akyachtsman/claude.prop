// app.js — hash router + shared state. Wires views to store + model, owns the
// topbar center slot (switcher/pills or view title), first-run, export/import.

import { el, clear, toast } from './dom.js';
import * as store from './store.js';
import * as fmt from './format.js';
import { capVerdict, dscrVerdict, BENCHMARK_CAP, BENCHMARK_DSCR } from './model.js';
import { sampleProperty, demoProperties } from './sample.js';
import { renderDashboard } from './views/dashboard.js';
import { renderList } from './views/list.js';
import { renderCompare } from './views/compare.js';
import { classifyImportInput, parseLoopNetHtml } from './importparse.js';

const view = document.getElementById('view');
const center = document.getElementById('topbar-center');
const navProps = document.getElementById('nav-properties');
const navCompare = document.getElementById('nav-compare');

let account = null;     // the (dynamically imported) account layer; null if auth infra failed to load
let undoStack = [];     // committed prior states of the property being edited (undo history)
let redoStack = [];     // states undone and available to redo (cleared by any new edit)
let historyId = null;   // the property the undo/redo stacks belong to
let committedState = null;   // the current committed state, in memory (drives undo/redo snapshots)

// ── blank property factory (for "+ New") ────────────────────────────────
function blankProperty() {
  return {
    id: store.newId(), schemaVersion: 1, name: 'New property',
    info: { propertyType: 'Commercial', askingPrice: 0, rentableSF: 0, lotSize: '', yearBuilt: '', zoning: '', hvacAge: '', roofAge: '', parking: '', ceilingHeight: '', appraisedValue: 0, apn: '', bedrooms: '', baths: '', subtype: '', broker: '', source: '', photosLink: '', description: '' },
    targets: { desiredCap: 0, desiredDscr: 0 },   // empty by default; pills use the hard-coded benchmark until a Target is set
    offer: { offerPrice: 0, fees: 0, improvements: 0 },
    loans: [{ ltv: 0.7, rate: 0.065, termYears: 25, maturityYears: 0, type: 'CONV' }, { ltv: 0, rate: 0.065, termYears: 25, maturityYears: 0, type: 'IO' }],
    tenants: Array.from({ length: 4 }, () => ({ name: '', sf: 0, monthlyIncome: 0, leaseExpires: '', leaseOptions: '' })),
    expenses: [
      { key: 'insurance', label: 'Insurance', amount: 0, included: true, estimated: true, useDefault: true },
      { key: 'taxes', label: 'Property taxes', amount: 0, included: true, estimated: true, useDefault: true },
      { key: 'cam', label: 'CAM', amount: 0, included: false, estimated: false },
      { key: 'hoa', label: 'HOA', amount: 0, included: false, estimated: false },
      { key: 'utilities', label: 'Utilities', amount: 0, included: true, estimated: false },
      { key: 'management', label: 'Management', amount: 0, included: true, estimated: false },
      { key: 'maintenance', label: 'Maintenance', amount: 0, included: true, estimated: false },
      { key: 'landscaping', label: 'Landscaping', amount: 0, included: true, estimated: false },
      { key: 'cleaning', label: 'Cleaning', amount: 0, included: false, estimated: false },
    ],
    assumptions: { minOppCostEquity: 0.15, taxRate: 0.28, collectionLoss: 0.05, cashflowAppr: 0.02, capitalAppr: 0.02 },
    media: { photos: [] },   // image URLs shown in the Photos gallery
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
  // Auth gate: without a cloud session, show only the sign-in screen — the app
  // and all data stay hidden until sign-in. If the account layer failed to load
  // (auth infra unreachable), fall through to the local app so the tool still
  // works rather than showing a dead gate.
  if (account && account.needsAuthScreen()) {
    document.body.classList.add('is-gated');
    clear(center);
    return account.renderAuthScreen(view);
  }
  document.body.classList.remove('is-gated');
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
    importUrl: openImport,
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
  const undoBtn = el('button', { class: 'topbar__link topbar__action', type: 'button', 'aria-label': 'Undo last change', title: 'Undo', text: '↶', onclick: () => undo(id) });
  const redoBtn = el('button', { class: 'topbar__link topbar__action', type: 'button', 'aria-label': 'Redo change', title: 'Redo', text: '↷', onclick: () => redo(id) });
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
  const cap = capVerdict(m.cap);
  const dscr = dscrVerdict(m.dscr);
  // 5-year NPV verdict: pass only when NPV > $0 (strictly positive — the deal
  // beats its cost of capital, not merely breaks even), fail at or below $0.
  // Matches the dashboard KPI cell's colour rule. Null (no pill) when NPV isn't
  // a real number (e.g. a zeroed deal).
  const npvOk = Number.isFinite(m.npv) ? m.npv > 0 : null;
  // Pills check the FIXED benchmark, not the deal's Target (that's a goal-seek).
  const capTxt = `CAP ${fmt.percent2(m.cap)} ${cap ? '≥' : '<'} ${fmt.percent2(BENCHMARK_CAP)}`;
  const dscrTxt = `DSCR ${fmt.ratio(m.dscr)} ${dscr ? '≥' : '<'} ${fmt.ratio(BENCHMARK_DSCR)}`;
  // Show the > $0 benchmark explicitly, matching the CAP/DSCR pills' "≥ target" form.
  const npvTxt = `5Y NPV ${fmt.money(m.npv)} ${npvOk ? '>' : '≤'} $0`;
  if (cap !== null) host.appendChild(el('span', { class: 'pill ' + (cap ? 'pill--pass' : 'pill--fail'), text: capTxt }));
  if (dscr !== null) host.appendChild(el('span', { class: 'pill ' + (dscr ? 'pill--pass' : 'pill--fail'), text: dscrTxt }));
  if (npvOk !== null) host.appendChild(el('span', { class: 'pill ' + (npvOk ? 'pill--pass' : 'pill--fail'), text: npvTxt }));
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

// Add a property from a listing: one box takes either a Crexi URL (fetched +
// normalized server-side by the import-listing Edge Function) or LoopNet page
// source (parsed in the browser from its embedded JSON-LD). The app detects
// which and routes it. "Start blank" falls back to createNew.
function openImport() {
  const input = el('textarea', { class: 'input import-ta', rows: '3', 'aria-label': 'Listing URL or page source',
    placeholder: 'Paste a Crexi listing URL — or, for LoopNet, the page source (open the listing, Ctrl+U, select all, copy).' });
  const status = el('p', { class: 'modal__status' });
  const importBtn = el('button', { class: 'btn btn--primary', type: 'button', text: 'Import' });
  const blankBtn = el('button', { class: 'btn btn--ghost', type: 'button', text: 'Start blank instead' });
  const panel = el('div', { class: 'modal__panel import-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Add a property from a listing' }, [
    el('h2', { class: 'modal__title', text: 'Add a property from a listing' }),
    el('p', { class: 'modal__body', text: 'Paste a Crexi URL, or LoopNet page source — the details, photos, and figures come in automatically.' }),
    input, status,
    el('div', { class: 'modal__actions' }, [blankBtn, importBtn]),
  ]);
  const overlay = el('div', { class: 'modal__overlay' }, [panel]);
  const close = () => { document.removeEventListener('keydown', onKey); overlay.remove(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const busy = (on) => { importBtn.disabled = on; importBtn.textContent = on ? 'Importing…' : 'Import'; };
  const finish = (property) => {
    const saved = store.save(property);
    if (!saved) { busy(false); return; }             // offline reject (store toasts)
    // Confirm success in the still-open modal, then open the property after a
    // brief beat so the "import successful" message registers before the switch.
    importBtn.disabled = true;
    importBtn.textContent = 'Imported';
    status.className = 'modal__status modal__status--ok';
    status.textContent = '✓ Import successful — opening the property…';
    toast('Import successful.', 'success');
    setTimeout(() => {
      close();
      navigate('#/p/' + encodeURIComponent(saved.id));
    }, 1000);
  };
  async function doImport() {
    const raw = input.value.trim();
    const kind = classifyImportInput(raw);
    if (kind === 'empty') { status.textContent = 'Paste a listing URL or the page source first.'; return; }
    status.textContent = ''; busy(true);
    if (kind === 'url') {
      if (/loopnet\.com/i.test(raw)) {   // LoopNet blocks server fetch — needs the page source instead
        status.textContent = 'For LoopNet, paste the page source (open the listing, Ctrl+U, select all, copy) — not the URL.';
        busy(false); return;
      }
      let mod;
      try { mod = await import('./supabase.js'); }
      catch { status.textContent = 'Import needs a connection. Try again in a moment.'; busy(false); return; }
      const res = await mod.importListing(raw);
      if (!res.ok) { status.textContent = res.error; busy(false); return; }
      finish(res.property);
    } else if (kind === 'html') {
      const res = parseLoopNetHtml(raw);
      if (!res.ok) { status.textContent = res.error; busy(false); return; }
      finish(res.property);
    } else {
      status.textContent = "That doesn't look like a listing URL or page source.";
      busy(false);
    }
  }
  importBtn.addEventListener('click', doImport);
  blankBtn.addEventListener('click', () => { close(); createNew(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  input.focus();
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
// initialize, the app still boots (in the local fallback below) rather than
// showing a dead gate.
try {
  account = await import('./account.js');
  await account.initAccount({ rerender: router });
} catch (e) {
  account = null;
  store.setSession(null);
}

// Fallback only: if the account layer couldn't load, run the local app with its
// built-in sample + demo seed so the tool still works. When the account layer is
// present, cloud accounts get their fixtures from the sign-in reconcile instead.
if (!account && store.backendKind() === 'local') {
  refreshBuiltinSample();
  seedDemos();
}

window.addEventListener('hashchange', router);
router();
