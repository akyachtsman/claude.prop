// reconcile.test.mjs — first-sign-in upload/dedup (D6, T20). Proves: uploaded
// local copies win, gap-seed fills only missing fixture ids, an edited local
// sample is not clobbered, and declining leaves propanalytics.v1 intact.
// Run: node --test tests/reconcile.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
let online = true;
Object.defineProperty(globalThis, 'navigator', {
  configurable: true, get: () => ({ get onLine() { return online; } }),
});

const store = await import('../js/store.js');
const { missingFixtures } = await import('../js/reconcile.js');

function mockOps(rows = []) {
  const calls = [];
  return {
    calls,
    async upsert(p) { calls.push(['upsert', p.id]); },
    async remove(id) { calls.push(['remove', id]); },
    async fetchAll() { return rows; },
  };
}
const session = (uid) => ({ user: { id: uid } });

// The built-in fixtures (fixed ids), one carrying a marker so we can tell the
// default apart from an uploaded/edited copy of the same id.
const FIXTURES = [
  { id: 'sample-715-plumas', name: 'Sample', marker: 'DEFAULT' },
  { id: 'demo-a', name: 'A' }, { id: 'demo-b', name: 'B' }, { id: 'demo-c', name: 'C' },
];

test('missingFixtures returns only ids absent from the account', () => {
  const have = [{ id: 'demo-a' }, { id: 'sample-715-plumas' }];
  const missing = missingFixtures(have, FIXTURES).map((f) => f.id);
  assert.deepEqual(missing, ['demo-b', 'demo-c']);
});

test('upload wins, then gap-seed fills only missing ids; local key untouched', () => {
  mem.clear(); online = true; store.setSession(null);
  // Device has local deals: an EDITED sample + a user-made deal.
  store.save({ id: 'sample-715-plumas', name: 'Sample', marker: 'EDITED' });
  store.save({ id: 'p-user', name: 'Mine' });
  const localBefore = mem.get('propanalytics.v1');

  // Sign in to a fresh (empty) account.
  const ops = mockOps([]);
  store.setSession(session('u1'), ops, {});

  // D6 step 1 — upload local deals (upsert; user copies win).
  store.readLocalDeals().forEach((d) => store.save(d));
  // D6 step 2 — seed only fixtures the account is missing.
  missingFixtures(store.list(), FIXTURES).forEach((f) => store.save(f));

  const ids = store.list().map((p) => p.id).sort();
  assert.deepEqual(ids, ['demo-a', 'demo-b', 'demo-c', 'p-user', 'sample-715-plumas']);
  // the edited sample survived — gap-seed did NOT overwrite it with the default
  assert.equal(store.get('sample-715-plumas').marker, 'EDITED');
  // the logged-out local set is byte-for-byte intact
  assert.equal(mem.get('propanalytics.v1'), localBefore);
});

test('decline upload — account gets fixtures only; local deals stay local', () => {
  mem.clear(); online = true; store.setSession(null);
  store.save({ id: 'p-local', name: 'Local only' });
  const localBefore = mem.get('propanalytics.v1');

  store.setSession(session('u2'), mockOps([]), {});
  // Declined: no upload. Only gap-seed runs.
  missingFixtures(store.list(), FIXTURES).forEach((f) => store.save(f));

  const ids = store.list().map((p) => p.id).sort();
  assert.deepEqual(ids, ['demo-a', 'demo-b', 'demo-c', 'sample-715-plumas']);
  assert.equal(store.get('p-local'), null, 'user local deal not pushed to the account');
  assert.equal(mem.get('propanalytics.v1'), localBefore, 'local set intact after decline');
});
