// store.js — persistence repository behind a stable interface. Logged out it is
// localStorage (key `propanalytics.v1`), exactly as v1. Signed in, a cloud backend
// (Supabase) takes over behind the same synchronous methods — see setSession() and
// js/cloud.js. Degrades to in-memory if storage is unavailable/corrupt so the app
// always runs.

const LOCAL_KEY = 'propanalytics.v1';
const SEED_KEY = 'propanalytics.seed.v1';   // marks the one-time demo seed as done
const SCHEMA = 1;

// ── shared record shaping ────────────────────────────────────────────────
// Upsert `property` into `list` by id, stamping schema/updatedAt (and createdAt
// on insert). Returns the new list + the shaped record. Backend-agnostic so the
// local and cloud backends persist identically-shaped rows.
function upsertInto(list, property) {
  const l = list.slice();
  const i = l.findIndex((p) => p.id === property.id);
  const now = new Date().toISOString();
  const rec = { ...property, schemaVersion: SCHEMA, updatedAt: now };
  if (i >= 0) l[i] = rec;
  else { rec.createdAt = rec.createdAt || now; l.push(rec); }
  return { list: l, rec };
}

// Validate + normalize an import payload. Returns { ok, props } / { ok:false, error }.
function parseImport(text) {
  let data;
  try { data = JSON.parse(text); }
  catch (e) { return { ok: false, error: 'Not valid JSON.' }; }
  const props = Array.isArray(data) ? data : data && data.properties;
  if (!Array.isArray(props)) return { ok: false, error: 'No properties found in file.' };
  const ver = Array.isArray(data) ? SCHEMA : (data.schemaVersion || SCHEMA);
  if (ver > SCHEMA) return { ok: false, error: `File is a newer format (v${ver}); update the app to import it.` };
  for (const p of props) {
    if (!p || typeof p !== 'object' || !p.id || !p.info) {
      return { ok: false, error: 'File contains a malformed property; nothing was imported.' };
    }
  }
  return { ok: true, props: props.map((p) => ({ ...p, schemaVersion: SCHEMA })) };
}

// ── localStorage-backed cache (used by both the local and cloud backends) ──
// A little object owning one localStorage key, with an in-memory mirror/fallback.
function makeCache(key) {
  let memory = [];
  let storageOK = true;
  return {
    read() {
      if (!storageOK) return memory;   // once reads fail, trust the in-memory set
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) { storageOK = false; return memory; }
    },
    write(list) {
      memory = list;
      try { localStorage.setItem(key, JSON.stringify(list)); storageOK = true; }
      catch (e) { storageOK = false; }   // quota / unavailable — keep running from memory
    },
    probe() {
      try {
        const k = key + '__probe__';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        storageOK = true;
      } catch (e) { storageOK = false; }
      return storageOK;
    },
    isStorageOK() { return storageOK; },
  };
}

// ── local backend — the logged-out repository (key `propanalytics.v1`) ─────
function makeLocalBackend() {
  const cache = makeCache(LOCAL_KEY);
  return {
    kind: 'local',
    probe: () => cache.probe(),
    isStorageOK: () => cache.isStorageOK(),
    list() { return cache.read().slice(); },
    get(id) { return cache.read().find((p) => p.id === id) || null; },
    save(property) {
      const { list, rec } = upsertInto(cache.read(), property);
      cache.write(list);
      return rec;
    },
    remove(id) { cache.write(cache.read().filter((p) => p.id !== id)); return true; },
    exportAll() {
      return JSON.stringify({ schemaVersion: SCHEMA, exportedAt: new Date().toISOString(), properties: cache.read().slice() }, null, 2);
    },
    importAll(text) {
      const r = parseImport(text);
      if (!r.ok) return { ok: false, error: r.error };
      cache.write(r.props);
      return { ok: true, count: r.props.length };
    },
    // One-time demo seed flag: true once markSeeded() runs, so a seeded demo the
    // user later deletes never reappears. Failures swallowed (a store that can't
    // persist the flag just re-seeds, which is harmless).
    hasSeeded() { try { return localStorage.getItem(SEED_KEY) != null; } catch (e) { return false; } },
    markSeeded() { try { localStorage.setItem(SEED_KEY, new Date().toISOString()); } catch (e) { /* ignore */ } },
  };
}

// ── cloud backend — the signed-in repository (Supabase + a per-user cache) ──
// Reads are synchronous from the cache `propanalytics.cloud.<uid>` (never the
// logged-out `propanalytics.v1` key). Writes go to the cache AND enqueue a
// serialized write-through to Supabase. Signed-in + offline REJECTS the write
// (the choke-point) — there is no offline edit to lose or reconcile (spec Q3).
function isOnline() {
  try { return typeof navigator === 'undefined' ? true : navigator.onLine !== false; }
  catch (e) { return true; }
}

function makeCloudBackend(uid, ops, hooks) {
  const cache = makeCache('propanalytics.cloud.' + uid);
  const chains = new Map();   // id -> Promise: serialize write-through per id

  let authLostFired = false;

  // Chain async op after any prior op for the same id (in order), regardless of
  // the prior outcome, so upsert N always lands before N+1. Different ids run
  // free. The chain is pruned once idle so the Map can't grow unbounded.
  function enqueue(id, fn) {
    const prev = chains.get(id) || Promise.resolve();
    const next = prev.then(fn, fn);
    const guarded = next.catch(() => {});   // keep the chain alive after a failure
    chains.set(id, guarded);
    guarded.then(() => { if (chains.get(id) === guarded) chains.delete(id); });
    return next;
  }

  // Pull the account's truth back into the cache after a failed write, so the
  // cache stays a faithful mirror of the cloud (there is no offline write queue
  // by design — spec Q3).
  async function resyncFromCloud() {
    try { cache.write(await ops.fetchAll()); hooks.onResync(); }
    catch (e) { /* leave the cache; the next boot/online fetch reconciles */ }
  }

  function onWriteError(err) {
    if (err && err.isAuth) {                                         // session expired (T18)
      if (!authLostFired) { authLostFired = true; hooks.onAuthLost(); }
      return;
    }
    // Online, but the write didn't land. Don't falsely promise a re-sync that no
    // code performs — roll the cache back to the account's truth instead.
    hooks.notify("Couldn't save that change — reloaded from your account.", 'info');
    resyncFromCloud();
  }
  function rejectOffline() { hooks.notify("You're offline — reconnect to edit.", 'info'); }

  return {
    kind: 'cloud',
    uid,
    probe: () => cache.probe(),
    isStorageOK: () => cache.isStorageOK(),
    list() { return cache.read().slice(); },
    get(id) { return cache.read().find((p) => p.id === id) || null; },
    save(property) {
      if (!isOnline()) { rejectOffline(); return null; }             // choke-point (T10): no cache mutation
      const { list, rec } = upsertInto(cache.read(), property);
      cache.write(list);
      enqueue(rec.id, () => ops.upsert(rec)).catch(onWriteError);
      return rec;
    },
    remove(id) {
      if (!isOnline()) { rejectOffline(); return false; }
      cache.write(cache.read().filter((p) => p.id !== id));
      enqueue(id, () => ops.remove(id)).catch(onWriteError);
      return true;
    },
    exportAll() {
      return JSON.stringify({ schemaVersion: SCHEMA, exportedAt: new Date().toISOString(), properties: cache.read().slice() }, null, 2);
    },
    // Import while signed in is additive (upsert) — never wipes account rows that
    // aren't in the file. Online-gated like any write.
    importAll(text) {
      const r = parseImport(text);
      if (!r.ok) return { ok: false, error: r.error };
      if (!isOnline()) { rejectOffline(); return { ok: false, error: "You're offline — reconnect to import." }; }
      let merged = cache.read();
      for (const p of r.props) {
        const res = upsertInto(merged, p);
        merged = res.list;
        enqueue(res.rec.id, () => ops.upsert(res.rec)).catch(onWriteError);
      }
      cache.write(merged);
      return { ok: true, count: r.props.length };
    },
    // Cloud seeding is the first-sign-in reconcile (app.js), not the demo-seed
    // flag — report already-seeded so boot's seedDemos() no-ops on this backend.
    hasSeeded() { return true; },
    markSeeded() { /* n/a for cloud */ },
    // Pull the account's rows into the cache (initial fetch on sign-in, T16).
    async fetchAll() {
      const rows = await ops.fetchAll();
      cache.write(rows);
      return rows.slice();
    },
  };
}

// ── active backend ────────────────────────────────────────────────────────
let active = makeLocalBackend();

// ── public interface (stable; views never see which backend is active) ─────
export function probe() { return active.probe(); }
export function isStorageOK() { return active.isStorageOK(); }
export function list() { return active.list(); }
export function get(id) { return active.get(id); }
export function save(property) { return active.save(property); }
export function remove(id) { return active.remove(id); }
export function exportAll() { return active.exportAll(); }
export function importAll(text) { return active.importAll(text); }
export function hasSeeded() { return active.hasSeeded(); }
export function markSeeded() { return active.markSeeded(); }

/** Generate a stable-ish unique id (Date.now/Math.random fine at call time). */
export function newId() {
  return 'p-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
}

// ── backend selection (auth-driven) ─────────────────────────────────────────
/**
 * Swap the active backend. `session` null → local (`propanalytics.v1`, untouched
 * by the cloud path). A session → cloud backend on `propanalytics.cloud.<uid>`,
 * using `cloudOps` (js/cloud.js) for write-through and `hooks` = { notify(msg,kind),
 * onAuthLost() } for offline/expired-session feedback. Idempotent per uid.
 */
export function setSession(session, cloudOps, hooks) {
  if (!session || !session.user || !cloudOps) {
    active = makeLocalBackend();
    return;
  }
  const h = { notify: () => {}, onAuthLost: () => {}, onResync: () => {}, ...(hooks || {}) };
  active = makeCloudBackend(session.user.id, cloudOps, h);
}

/** 'local' | 'cloud' — lets boot guard seeding to the local backend (T11). */
export function backendKind() { return active.kind; }

/** Initial cloud fetch after sign-in (T16). No-op on the local backend. */
export async function fetchAll() {
  return typeof active.fetchAll === 'function' ? active.fetchAll() : active.list();
}

/** The logged-out local set, read without switching the active backend — the
 *  first-sign-in reconcile (D6) needs it while the cloud backend is active. */
export function readLocalDeals() {
  return makeLocalBackend().list();
}

// Internals exposed for the cloud layer + tests (not used by views).
export const _internal = { upsertInto, parseImport, makeCache, makeLocalBackend, makeCloudBackend, isOnline, SCHEMA };
