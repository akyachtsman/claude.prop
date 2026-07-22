// importparse.js — turn pasted import input into a property. The app's single
// Import box accepts either:
//   • a listing URL (Crexi) — fetched + normalized server-side by the
//     import-listing Edge Function (the browser can't fetch it cross-origin);
//   • pasted page source (LoopNet) — parsed HERE, in the browser, from the
//     listing's own embedded JSON-LD, so no server (and no bot wall) is involved.
// No DOM APIs are used, so this unit-tests directly in Node.

const num = (v) => { const n = Number(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 0; };

// Decide what the user pasted. 'html' (page source) wins over 'url' when tags
// are present, so a LoopNet page that happens to contain URLs isn't misread.
export function classifyImportInput(text) {
  const t = String(text || '').trim();
  if (!t) return 'empty';
  if (t.includes('<') && /<(?:!doctype|html|script|section|div|meta)\b/i.test(t)) return 'html';
  if (/^https?:\/\/\S+$/i.test(t) || /^www\.\S+$/i.test(t)) return 'url';
  return 'unknown';
}

// Pull the RealEstateListing/Product JSON-LD object out of pasted HTML.
function extractListingLd(html) {
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let obj;
    try { obj = JSON.parse(m[1].trim()); } catch { continue; }
    for (const o of (Array.isArray(obj) ? obj : [obj])) {
      const t = o && o['@type'];
      const types = Array.isArray(t) ? t : [t];
      if (types.includes('RealEstateListing') || types.includes('Product')) return o;
    }
  }
  return null;
}

// Building photos, de-duplicated and ordered by their photo number.
function loopnetPhotos(html) {
  const re = /https:\/\/images1\.loopnet\.com\/i2\/[^"'\s]+Building-Photo-(\d+)-Large\.jpg/gi;
  const byNum = new Map();
  let m;
  while ((m = re.exec(html))) { const n = Number(m[1]); if (!byNum.has(n)) byNum.set(n, m[0]); }
  return [...byNum.entries()].sort((a, b) => a[0] - b[0]).map(([, url]) => url);
}

const matchOne = (s, re) => { const m = re.exec(s); return m ? String(m[1]).trim() : ''; };

// Parse pasted LoopNet page source into a property (or an error to show).
export function parseLoopNetHtml(html) {
  const s = String(html || '');
  const ld = extractListingLd(s);
  if (!ld) return { ok: false, error: "Couldn't find listing data — paste the full page source (Ctrl+U, then select all and copy)." };

  const ap = {};
  for (const p of (ld.additionalProperty || [])) ap[p.name] = Array.isArray(p.value) ? p.value[0] : p.value;
  const addr = (ld.contentLocation && ld.contentLocation.address) || {};
  const brokers = (Array.isArray(ld.provider) ? ld.provider : [ld.provider]).filter(Boolean);
  const brokerName = brokers.map((b) => b.name).filter(Boolean).join(' & ');
  const firm = brokers.map((b) => b.memberOf && b.memberOf.name).filter(Boolean)[0] || '';
  const url = ld.url || matchOne(s, /"url":"(https:\/\/www\.loopnet\.com\/Listing\/[^"]+)"/i) || '';
  const id = matchOne(String(ld['@id'] || url), /\/(\d+)(?:\/|#|$)/) || String((ld.name || 'x').length);
  const price = num((ld.offers && ld.offers[0] && ld.offers[0].price) || ap['Price']);
  const sf = num(ap['Gross Leasable Area'] || ap['Building Size'] || ap['Rentable Building Area']);
  const apn = matchOne(s, /Parcel Number[\s\S]{0,240}?taxes-zoning__nowrap">([^<]+)</i)
    || matchOne(s, /"ParcelNumber"[\s\S]{0,160}?>\s*([0-9][0-9-]{4,})\s*</i) || '';
  const totalAssessment = num(matchOne(s, /Total Assessment[\s\S]{0,240}?taxes-zoning__nowrap">\$?([\d,]+)</i));
  const photos = loopnetPhotos(s);

  const factParts = [
    ['Sale type', ap['Sale Type']], ['Sale condition', ap['Sale Condition']],
    ['Class', ap['Building Class']], ['Stories', ap['No. Stories']],
    ['Opportunity Zone', ap['Opportunity Zone']], ['Walk Score', ap['Walk Score']],
    ['Parking', ap['Parking Ratio']], ['Price/SF', ap['Price Per SF']],
  ].filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}: ${v}`);
  const description = [
    ld.description || '',
    factParts.length ? 'Facts — ' + factParts.join(' · ') : '',
    brokerName ? `Broker: ${brokerName}${firm ? ' — ' + firm : ''}` : '',
    totalAssessment ? `Total assessment: $${totalAssessment.toLocaleString()}` : '',
  ].filter(Boolean).join('\n\n');

  const property = {
    id: 'loopnet-' + id, schemaVersion: 1, name: ld.name || addr.streetAddress || 'LoopNet listing',
    info: {
      propertyType: ap['Property Type'] || 'Commercial', askingPrice: price, rentableSF: sf,
      lotSize: ap['Lot Size'] || '', yearBuilt: String(ap['Year Built'] || ''),
      zoning: ap['Zoning'] || '', hvacAge: '', roofAge: '',
      parking: ap['Parking Ratio'] || '', ceilingHeight: '',
      appraisedValue: totalAssessment, apn, bedrooms: '', baths: '',
      subtype: ap['Property Subtype'] || '', broker: [brokerName, firm].filter(Boolean).join(' — '),
      source: url, photosLink: url, description,
    },
    targets: { desiredCap: 0, desiredDscr: 0 },
    offer: { offerPrice: price, fees: 0, improvements: 0 },
    loans: [{ ltv: 0.7, rate: 0.065, termYears: 25, maturityYears: 0, type: 'CONV' }, { ltv: 0, rate: 0.065, termYears: 25, maturityYears: 0, type: 'IO' }],
    tenants: Array.from({ length: 4 }, () => ({ name: '', sf: 0, monthlyIncome: 0, leaseExpires: '', leaseOptions: '' })),
    expenses: [
      { key: 'insurance', label: 'Insurance', amount: Math.round(sf * 1.0), included: true, estimated: true, useDefault: true },
      { key: 'taxes', label: 'Property taxes', amount: Math.round(price * 0.012), included: true, estimated: true, useDefault: true },
      { key: 'cam', label: 'CAM', amount: 0, included: false, estimated: false },
      { key: 'hoa', label: 'HOA', amount: 0, included: false, estimated: false },
      { key: 'utilities', label: 'Utilities', amount: 0, included: true, estimated: false },
      { key: 'management', label: 'Management', amount: 0, included: true, estimated: false },
      { key: 'maintenance', label: 'Maintenance', amount: 0, included: true, estimated: false },
      { key: 'landscaping', label: 'Landscaping', amount: 0, included: true, estimated: false },
      { key: 'cleaning', label: 'Cleaning', amount: 0, included: false, estimated: false },
    ],
    assumptions: { minOppCostEquity: 0.15, taxRate: 0.28, collectionLoss: 0.05, cashflowAppr: 0.02, capitalAppr: 0.02 },
    media: { photos },
  };
  return { ok: true, property };
}
