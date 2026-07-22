// import-listing — server-side listing importer for Property Analytics.
//
// The browser can't fetch listing sites directly (CORS + bot protection), so the
// app POSTs a listing URL here; this function fetches the provider's public API
// server-side, normalizes it to our property schema, and returns { property }.
// The client then saves it through the normal (RLS-scoped) store, so this
// function never touches the database.
//
// SECURITY: only known provider hosts are ever fetched, and only from an id
// parsed out of a recognized listing URL — never an arbitrary user-supplied URL
// (no SSRF surface). verify_jwt is on, so only signed-in callers reach it.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOW_ORIGINS = new Set([
  "https://akyachtsman.github.io",
  "http://localhost:8099",
  "http://127.0.0.1:8099",
]);
function cors(origin: string | null): Record<string, string> {
  const o = origin && ALLOW_ORIGINS.has(origin) ? origin : "https://akyachtsman.github.io";
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(origin) } });

// Parse a supported listing URL into { provider, id }. Returns null if unsupported.
function parseListing(raw: string): { provider: string; id: string } | null {
  let u: URL;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\./, "");
  if (host === "crexi.com") {
    const m = u.pathname.match(/\/properties\/(\d+)/);
    if (m) return { provider: "crexi", id: m[1] };
  }
  return null;
}

const strip = (h: string) => (h || "")
  .replace(/<li>/g, "\n• ").replace(/<[^>]+>/g, "").replace(/​/g, "")
  .replace(/[ \t]+/g, " ").replace(/\s+\n/g, "\n").trim();
const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : 0; };

async function fetchJson(url: string): Promise<any> {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/json" } });
  if (!r.ok) throw new Error(`upstream ${r.status} for ${url}`);
  return r.json();
}

async function importCrexi(id: string): Promise<any> {
  const [asset, brokers, gallery] = await Promise.all([
    fetchJson(`https://api.crexi.com/assets/${id}`),
    fetchJson(`https://api.crexi.com/assets/${id}/brokers`).catch(() => []),
    fetchJson(`https://api.crexi.com/assets/${id}/gallery`).catch(() => []),
  ]);
  const det: Record<string, any> = Object.fromEntries((asset.summaryDetails || []).map((d: any) => [d.key, d]));
  const loc: any = (asset.locations || [])[0] || {};
  const b0: any = (Array.isArray(brokers) ? brokers[0] : brokers) || {};
  const bname = [b0.firstName, b0.lastName].filter(Boolean).join(" ");
  const bfirm = (b0.brokerage || {}).name || "";
  const listingUrl = `https://www.crexi.com/properties/${id}/${asset.urlSlug || ""}`;
  const offer = num(asset.askingPrice);
  const sf = num(det.SquareFootage?.value);
  const addr = [loc.address, loc.city, (loc.state || loc.stateVerified || {}).code, loc.zip].filter(Boolean).join(", ");
  const desc = [strip(asset.marketingDescription), asset.investmentHighlights ? "Highlights:" + strip(asset.investmentHighlights) : ""]
    .filter(Boolean).join("\n\n");
  return {
    id: crypto.randomUUID(), schemaVersion: 1, name: asset.name || addr || `Crexi ${id}`,
    info: {
      propertyType: (asset.types || [])[0] || "Commercial", askingPrice: offer, rentableSF: sf,
      lotSize: det.LotSize?.display ? det.LotSize.display + " SF" : "", yearBuilt: String(det.YearBuilt?.value || ""),
      zoning: det.PermittedZoning?.value || "", hvacAge: "", roofAge: /newer roof/i.test(asset.marketingDescription || "") ? "Newer roof" : "",
      parking: "", ceilingHeight: "", appraisedValue: 0, apn: det.Apn?.value || "", bedrooms: "", baths: "",
      subtype: (asset.subtypes || [])[0] || "", broker: [bname, bfirm].filter(Boolean).join(" — "),
      source: listingUrl, photosLink: listingUrl, description: desc,
    },
    targets: { desiredCap: 0, desiredDscr: 0 },
    offer: { offerPrice: offer, fees: 0, improvements: 0 },
    loans: [
      { ltv: 0.7, rate: 0.065, termYears: 25, maturityYears: 0, type: "CONV" },
      { ltv: 0, rate: 0.065, termYears: 25, maturityYears: 0, type: "IO" },
    ],
    tenants: Array.from({ length: 4 }, () => ({ name: "", sf: 0, monthlyIncome: 0, leaseExpires: "", leaseOptions: "" })),
    expenses: [
      { key: "insurance", label: "Insurance", amount: Math.round(sf * 1.0), included: true, estimated: true, useDefault: true },
      { key: "taxes", label: "Property taxes", amount: Math.round(offer * 0.012), included: true, estimated: true, useDefault: true },
      { key: "cam", label: "CAM", amount: 0, included: false, estimated: false },
      { key: "hoa", label: "HOA", amount: 0, included: false, estimated: false },
      { key: "utilities", label: "Utilities", amount: 0, included: true, estimated: false },
      { key: "management", label: "Management", amount: 0, included: true, estimated: false },
      { key: "maintenance", label: "Maintenance", amount: 0, included: true, estimated: false },
      { key: "landscaping", label: "Landscaping", amount: 0, included: true, estimated: false },
      { key: "cleaning", label: "Cleaning", amount: 0, included: false, estimated: false },
    ],
    assumptions: { minOppCostEquity: 0.15, taxRate: 0.28, collectionLoss: 0.05, cashflowAppr: 0.02, capitalAppr: 0.02 },
    media: { photos: (gallery || []).map((g: any) => g.imageUrl).filter(Boolean) },
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405, origin);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400, origin); }
  const parsed = parseListing(body?.url || "");
  if (!parsed) return json({ error: "Unsupported or invalid listing URL. Crexi property links are supported." }, 400, origin);
  try {
    const property = parsed.provider === "crexi" ? await importCrexi(parsed.id) : null;
    if (!property) return json({ error: "Unsupported provider." }, 400, origin);
    return json({ property }, 200, origin);
  } catch (e) {
    return json({ error: "Couldn't reach the listing. Try again, or add the property manually.", detail: String(e) }, 502, origin);
  }
});
