// _supabase-mock.js — shared test harness that boots the app SIGNED IN with a
// fully stubbed Supabase (no real backend). The app is now gated behind login,
// so UI scenarios run as an authenticated user against an in-memory REST store
// that persists across page reloads within a test.
//
// It injects a valid-looking session, stubs /auth/v1/** and a stateful
// /rest/v1/properties** (GET/POST-upsert/PATCH/DELETE over an in-Node Map), and
// suppresses the first-sign-in reconcile so the account starts with exactly the
// `seed` rows — making a signed-in empty account behave like the old local
// first-run (same "Load sample deal" / "+ New property" affordances).

export const PROJECT_REF = 'yucnxlimmrgzbqtdizle';           // must match js/config.js
export const TEST_UID = '00000000-0000-0000-0000-000000000001';
export const CLOUD_KEY = `propanalytics.cloud.${TEST_UID}`;
const AUTH_KEY = `sb-${PROJECT_REF}-auth-token`;
const RECON_KEY = `propanalytics.reconciled.${TEST_UID}`;

/**
 * Install the signed-in stub on `page` BEFORE navigating.
 * @param {import('@playwright/test').Page} page
 * @param {{ email?: string, seed?: object[], reconcile?: boolean }} opts
 *        seed = full property objects; reconcile=true lets the first-sign-in
 *        gap-seed run (default false → suppressed for deterministic tests).
 * @returns {Promise<{ rows: Map }>}  the live row map (id -> {id,name,data})
 */
export async function installSignedIn(page, { email = 'tester@example.com', seed = [], reconcile = false } = {}) {
  await page.addInitScript(([authKey, reconKey, addr, suppress]) => {
    const future = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;
    localStorage.setItem(authKey, JSON.stringify({
      access_token: 'stub', refresh_token: 'stub', token_type: 'bearer',
      expires_in: 3600 * 24 * 365, expires_at: future,
      user: { id: '00000000-0000-0000-0000-000000000001', email: addr, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
    }));
    if (suppress) localStorage.setItem(reconKey, 'test');   // suppress the first-sign-in gap-seed
  }, [AUTH_KEY, RECON_KEY, email, !reconcile]);

  const rows = new Map();
  for (const p of seed) rows.set(p.id, { id: p.id, name: p.name || null, data: p });

  await page.route('**/auth/v1/**', (route) => {
    const otp = /\/auth\/v1\/otp/.test(route.request().url());
    route.fulfill({ status: otp ? 200 : 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/rest/v1/properties**', (route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const idFilter = (url.searchParams.get('id') || '').replace(/^eq\./, '');
    const list = () => [...rows.values()];
    const range = () => { const n = rows.size; return `0-${Math.max(0, n - 1)}/${n}`; };

    if (method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': range() }, body: JSON.stringify(list()) });
    }
    if (method === 'POST') {                          // upsert (object or array)
      let body = [];
      try { body = JSON.parse(req.postData() || '[]'); } catch (e) { /* ignore */ }
      if (!Array.isArray(body)) body = [body];
      for (const row of body) rows.set(row.id, { id: row.id, name: row.name ?? null, data: row.data ?? row });
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(body) });
    }
    if (method === 'PATCH') {
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch (e) { /* ignore */ }
      if (idFilter && rows.has(idFilter)) rows.set(idFilter, { ...rows.get(idFilter), ...body });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (method === 'DELETE') {
      if (idFilter) rows.delete(idFilter);
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  // import-listing Edge Function — returns a canned property for a Crexi URL,
  // 400 for anything else (so the URL-import flow is exercised without network).
  await page.route('**/functions/v1/import-listing', (route) => {
    let body = {};
    try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) { /* ignore */ }
    const url = String(body.url || '');
    if (!/crexi\.com/.test(url)) {
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Unsupported or invalid listing URL.' }) });
    }
    const property = {
      id: 'imported-' + url.replace(/\D/g, '').slice(-7),
      schemaVersion: 1, name: '3091 Marysville Boulevard',
      info: { propertyType: 'Retail', askingPrice: 950000, rentableSF: 2996, lotSize: '9,259 SF', yearBuilt: '1960', zoning: 'C 2', hvacAge: '', roofAge: 'Newer roof', parking: '', ceilingHeight: '', appraisedValue: 0, apn: '265-0093-012-0000', bedrooms: '', baths: '', subtype: 'Auto Shop', broker: 'Nick Sadek', source: url, photosLink: url, description: 'Prime auto repair / smog shop near HWY-80.' },
      targets: { desiredCap: 0, desiredDscr: 0 },
      offer: { offerPrice: 950000, fees: 0, improvements: 0 },
      loans: [{ ltv: 0.7, rate: 0.065, termYears: 25, maturityYears: 0, type: 'CONV' }, { ltv: 0, rate: 0.065, termYears: 25, maturityYears: 0, type: 'IO' }],
      tenants: Array.from({ length: 4 }, () => ({ name: '', sf: 0, monthlyIncome: 0, leaseExpires: '', leaseOptions: '' })),
      expenses: [
        { key: 'insurance', label: 'Insurance', amount: 2996, included: true, estimated: true, useDefault: true },
        { key: 'taxes', label: 'Property taxes', amount: 11400, included: true, estimated: true, useDefault: true },
        { key: 'utilities', label: 'Utilities', amount: 0, included: true, estimated: false },
      ],
      assumptions: { minOppCostEquity: 0.15, taxRate: 0.28, collectionLoss: 0.05, cashflowAppr: 0.02, capitalAppr: 0.02 },
      media: { photos: ['https://ex.com/a.jpg', 'https://ex.com/b.jpg'] },
    };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ property }) });
  });

  return { rows };
}
