// store.test.mjs — Node unit tests for the store backend swap (T12).
// Run: node --test tests/store.test.mjs
// Shims localStorage + navigator so the browser store runs headless.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ── shims (installed before importing the module under test) ──────────────
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
let online = true;
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  get: () => ({ get onLine() { return online; } }),
});

const store = await import('../js/store.js');

function reset() { mem.clear(); online = true; store.setSession(null); }
const session = (uid) => ({ user: { id: uid } });
const deal = (id) => ({ id, name: id, info: { askingPrice: 1 } });

// A mock cloud ops that records call order and can be made slow/failing.
function mockOps() {
  const calls = [];
  const ops = {
    calls,
    delayFirst: 0,
    failNext: null,   // set to { isAuth } to make the next upsert reject
    async upsert(p) {
      const d = ops.delayFirst; ops.delayFirst = 0;
      if (d) await new Promise((r) => setTimeout(r, d));
      if (ops.failNext) { const f = ops.failNext; ops.failNext = null; const e = new Error('boom'); e.isAuth = !!f.isAuth; throw e; }
      calls.push(['upsert', p.id]);
    },
    async remove(id) { calls.push(['remove', id]); },
    async fetchAll() { calls.push(['fetchAll']); return ops.rows || []; },
    rows: [],
  };
  return ops;
}

test('logged out writes to propanalytics.v1 and never calls cloud', () => {
  reset();
  const ops = mockOps();
  assert.equal(store.backendKind(), 'local');
  store.save(deal('a'));
  assert.ok(mem.has('propanalytics.v1'), 'local key written');
  assert.equal(ops.calls.length, 0, 'cloud ops untouched while logged out');
});

test('setSession(cloud) swaps namespace; local key is left intact', () => {
  reset();
  store.save(deal('local-only'));               // lands in propanalytics.v1
  const ops = mockOps();
  store.setSession(session('u1'), ops, {});
  assert.equal(store.backendKind(), 'cloud');
  store.save(deal('cloud-1'));
  assert.ok(mem.has('propanalytics.cloud.u1'), 'per-user cloud cache written');
  // the logged-out set is untouched by the cloud write
  const local = JSON.parse(mem.get('propanalytics.v1'));
  assert.deepEqual(local.map((p) => p.id), ['local-only']);
  // cloud cache holds only the cloud write
  const cloud = JSON.parse(mem.get('propanalytics.cloud.u1'));
  assert.deepEqual(cloud.map((p) => p.id), ['cloud-1']);
});

test('two accounts get separate caches', () => {
  reset();
  store.setSession(session('u1'), mockOps(), {});
  store.save(deal('x'));
  store.setSession(session('u2'), mockOps(), {});
  store.save(deal('y'));
  assert.deepEqual(JSON.parse(mem.get('propanalytics.cloud.u1')).map((p) => p.id), ['x']);
  assert.deepEqual(JSON.parse(mem.get('propanalytics.cloud.u2')).map((p) => p.id), ['y']);
});

test('cloud save/remove enqueue write-through serialized in order', async () => {
  reset();
  const ops = mockOps();
  store.setSession(session('u1'), ops, {});
  ops.delayFirst = 30;               // make the first upsert slow
  store.save(deal('a'));             // upsert a (slow)
  store.save(deal('a'));             // upsert a again — must wait for the first
  store.remove('a');                 // remove a — must be last
  await new Promise((r) => setTimeout(r, 120));
  assert.deepEqual(ops.calls, [['upsert', 'a'], ['upsert', 'a'], ['remove', 'a']],
    'same-id ops run in submission order despite a slow first write');
});

test('offline cloud save rejects: returns null, no cache mutation, no cloud call', () => {
  reset();
  const ops = mockOps();
  store.setSession(session('u1'), ops, {});
  store.save(deal('seed'));                    // online: seeds the cache
  const before = mem.get('propanalytics.cloud.u1');
  const callsBefore = ops.calls.length;
  online = false;
  const rec = store.save(deal('nope'));
  assert.equal(rec, null, 'save returns null when offline');
  assert.equal(mem.get('propanalytics.cloud.u1'), before, 'cache not mutated offline');
  assert.equal(ops.calls.length, callsBefore, 'no cloud write attempted offline');
});

test('offline cloud remove rejects: no cache mutation, no cloud call', () => {
  reset();
  const ops = mockOps();
  store.setSession(session('u1'), ops, {});
  store.save(deal('keep'));
  const before = mem.get('propanalytics.cloud.u1');
  const callsBefore = ops.calls.length;
  online = false;
  store.remove('keep');
  assert.equal(mem.get('propanalytics.cloud.u1'), before, 'cache not mutated offline');
  assert.equal(ops.calls.length, callsBefore, 'no cloud delete attempted offline');
});

test('offline notify + auth-lost hooks fire', () => {
  reset();
  const ops = mockOps();
  const seen = [];
  store.setSession(session('u1'), ops, { notify: (m) => seen.push(m), onAuthLost: () => seen.push('AUTHLOST') });
  online = false;
  store.save(deal('z'));
  assert.ok(seen.some((m) => /offline/i.test(m)), 'offline toast fired');
});

test('remove returns true online, false when offline (signed in)', () => {
  reset();
  store.setSession(session('u1'), mockOps(), {});
  store.save(deal('k'));
  assert.equal(store.remove('k'), true, 'online remove reports success');
  store.save(deal('k2'));
  online = false;
  assert.equal(store.remove('k2'), false, 'offline remove reports rejection');
});

test('transient (non-auth) write failure rolls cache back to cloud truth + fires onResync', async () => {
  reset();
  const ops = mockOps();
  const seen = [];
  store.setSession(session('u1'), ops, { notify: (m) => seen.push(m), onResync: () => seen.push('RESYNC') });
  ops.rows = [{ id: 'server', name: 'server truth' }];   // what fetchAll returns on rollback
  ops.failNext = { isAuth: false };
  store.save(deal('local-optimistic'));                  // cache shows it briefly, then upsert fails
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(store.list().map((p) => p.id), ['server'], 'cache rolled back to the account truth');
  assert.ok(seen.includes('RESYNC'), 'onResync fired to re-render');
  assert.ok(seen.some((m) => /couldn.t save/i.test(m)), 'honest toast (no false re-sync promise)');
});

test('auth (401) write failure fires onAuthLost exactly once', async () => {
  reset();
  const ops = mockOps();
  let lost = 0;
  store.setSession(session('u1'), ops, { onAuthLost: () => { lost++; } });
  ops.failNext = { isAuth: true };
  store.save(deal('x'));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(lost, 1, 'auth-lost routed once');
});

test('sign out returns to local with propanalytics.v1 intact', () => {
  reset();
  store.save(deal('home'));                     // local
  store.setSession(session('u1'), mockOps(), {});
  store.save(deal('cloudy'));
  store.setSession(null);                       // sign out
  assert.equal(store.backendKind(), 'local');
  assert.deepEqual(store.list().map((p) => p.id), ['home'], 'local set restored intact');
});
