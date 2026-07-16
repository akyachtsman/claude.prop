// store.js — persistence repository behind a stable interface. v1 = localStorage;
// a Supabase impl drops in behind the same methods later (data.md). Degrades to
// in-memory if storage is unavailable/corrupt so the app always runs.

const KEY = 'propanalytics.v1';
const SEED_KEY = 'propanalytics.seed.v1';   // marks the one-time demo seed as done
const SCHEMA = 1;

let memory = [];        // in-memory mirror / fallback
let storageOK = true;   // false when localStorage can't be used

function read() {
  if (!storageOK) return memory;   // once writes fail, trust the in-memory set
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    storageOK = false;
    return memory;
  }
}

/** Probe storage at boot so isStorageOK() is meaningful before the first save
 *  (catches private-mode/quota where getItem works but setItem throws). */
export function probe() {
  try {
    const k = '__probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    storageOK = true;
  } catch (e) {
    storageOK = false;
  }
  return storageOK;
}

function write(list) {
  memory = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    storageOK = true;
  } catch (e) {
    storageOK = false; // quota / unavailable — keep running from memory
  }
}

export function isStorageOK() { return storageOK; }

/** One-time demo seed flag: hasSeeded() is true once markSeeded() has run, so a
 *  seeded demo the user later deletes never reappears. Failures are swallowed —
 *  a store that can't persist the flag simply re-seeds, which is harmless. */
export function hasSeeded() {
  try { return localStorage.getItem(SEED_KEY) != null; } catch (e) { return false; }
}
export function markSeeded() {
  try { localStorage.setItem(SEED_KEY, new Date().toISOString()); } catch (e) { /* ignore */ }
}

export function list() {
  const l = read();
  memory = l;
  return l.slice();
}

export function get(id) {
  return list().find((p) => p.id === id) || null;
}

export function save(property) {
  const l = read();
  const i = l.findIndex((p) => p.id === property.id);
  const now = new Date().toISOString();
  const rec = { ...property, schemaVersion: SCHEMA, updatedAt: now };
  if (i >= 0) l[i] = rec;
  else { rec.createdAt = rec.createdAt || now; l.push(rec); }
  write(l);
  return rec;
}

export function remove(id) {
  write(read().filter((p) => p.id !== id));
}

/** Generate a stable-ish unique id without Date.now/Math.random dependence
 *  at module load (both fine at call time in the browser). */
export function newId() {
  return 'p-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
}

/** Export the whole set as a pretty JSON string for download. */
export function exportAll() {
  return JSON.stringify({ schemaVersion: SCHEMA, exportedAt: new Date().toISOString(), properties: list() }, null, 2);
}

/** Import from a JSON string. Validates shape + version; never silently wipes.
 *  Returns { ok, count, error }. Replaces the current set on success. */
export function importAll(text) {
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
  write(props.map((p) => ({ ...p, schemaVersion: SCHEMA })));
  return { ok: true, count: props.length };
}
