// app.js — hash router + shared state. Wires views to store + model, owns the
// topbar center slot (switcher/pills or view title), first-run, export/import.

import { el, render, clear, toast } from './dom.js';
import * as store from './store.js';
import { compute, capVerdict, dscrVerdict } from './model.js';
import { sampleProperty } from './sample.js';
import { renderDashboard } from './views/dashboard.js';
import { renderList } from './views/list.js';
import { renderCompare } from './views/compare.js';

const view = document.getElementById('view');
const center = document.getElementById('topbar-center');
const navProps = document.getElementById('nav-properties');
const navCompare = document.getElementById('nav-compare');

let flushSave = null;   // flush the active dashboard's pending auto-save (set in showDashboard)

// ── blank property factory (for "+ New") ────────────────────────────────
function blankProperty() {
  return {
    id: store.newId(), schemaVersion: 1, name: 'New property',
    info: { askingPrice: 0, rentableSF: 0, lotSize: '', yearBuilt: '', zoning: '', hvacAge: '', roofAge: '', parking: '', ceilingHeight: '', appraisedValue: 0, apn: '', bedrooms: '', baths: '' },
    targets: { desiredCap: 0.06, desiredDscr: 1.25 },
    offer: { offerPrice: 0, fees: 0, improvements: 0 },
    loans: [{ ltv: 0.7, rate: 0.065, termYears: 25, type: 'CONV' }, { ltv: 0, rate: 0.065, termYears: 25, type: 'IO' }],
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
  if (flushSave) flushSave();          // commit any pending edit before switching views
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
  // Auto-save: edits persist automatically (debounced), so nothing is lost and
  // navigating never has to prompt. flushSave() commits a pending save now.
  let saveTimer = null;
  const autosave = () => { clearTimeout(saveTimer); saveTimer = null; store.save(working); };
  flushSave = () => { if (saveTimer) autosave(); };

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
    setHeaderVerdicts: (m, p) => paintPills(pills, m, p),
    markDirty: () => { clearTimeout(saveTimer); saveTimer = setTimeout(autosave, 400); },
    save: (p) => {
      store.save(p);
      if (store.isStorageOK()) { toast('Saved.', 'success'); }
      else { toast("Couldn't save — storage is full or private mode. Export to keep your data.", 'info'); }
      router(); navigate('#/p/' + encodeURIComponent(p.id));
    },
    remove: (p) => confirmDelete(p),
  });
}

function fmtSub(p) {
  const parts = [];
  if (p.info.askingPrice) parts.push('Asking $' + Math.round(p.info.askingPrice).toLocaleString('en-US'));
  if (p.offer.offerPrice) parts.push('Offer $' + Math.round(p.offer.offerPrice).toLocaleString('en-US'));
  if (p.info.rentableSF) parts.push(Math.round(p.info.rentableSF).toLocaleString('en-US') + ' SF');
  return parts.join(' · ');
}

function paintPills(host, m, p) {
  clear(host);
  const cap = capVerdict(m.cap, p.targets.desiredCap);
  const dscr = dscrVerdict(m.dscr, p.targets.desiredDscr);
  const capTxt = `CAP ${(m.cap * 100).toFixed(2)}% ${cap ? '≥' : '<'} ${(p.targets.desiredCap * 100).toFixed(2)}%`;
  const dscrTxt = `DSCR ${m.dscr === null ? '—' : m.dscr.toFixed(2)} ${dscr ? '≥' : '<'} ${(+p.targets.desiredDscr).toFixed(2)}`;
  if (cap !== null) host.appendChild(el('span', { class: 'pill ' + (cap ? 'pill--pass' : 'pill--fail'), text: capTxt }));
  if (dscr !== null) host.appendChild(el('span', { class: 'pill ' + (dscr ? 'pill--pass' : 'pill--fail'), text: dscrTxt }));
}

// ── actions ────────────────────────────────────────────────────────────
function guardNav(hash) { navigate(hash); }   // edits auto-save; router() flushes any pending save
function createNew() {
  const p = store.save(blankProperty());
  navigate('#/p/' + encodeURIComponent(p.id));
}
function loadSample() {
  const p = store.save(sampleProperty());
  toast('Sample deal loaded.', 'success');
  navigate('#/p/' + encodeURIComponent(p.id));
}
function confirmDelete(p) {
  if (!confirm(`This will permanently delete "${p.name || 'this property'}".`)) return;
  store.remove(p.id);
  toast('Deleted.', 'info');
  navigate('#/');
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

// ── boot ──────────────────────────────────────────────────────────────
document.getElementById('btn-export').addEventListener('click', exportData);
document.getElementById('btn-import').addEventListener('click', importData);
if (!store.probe()) toast('Saving is off — private mode or storage full. Export to keep your data.', 'info');
window.addEventListener('hashchange', router);
window.addEventListener('beforeunload', () => { if (flushSave) flushSave(); });   // don't lose an in-flight edit on close
router();
