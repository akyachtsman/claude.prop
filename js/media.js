// media.js — pure helpers for the property photo gallery. No DOM, so it
// unit-tests directly. A property's media is { photos: string[] } where each
// entry is a validated http(s) image URL.

// Normalize one value to a safe http(s) URL string, or null. Rejects
// javascript:/data:/relative junk so a pasted URL can only ever become an
// <img src> pointing at a real remote image.
export function safeImageUrl(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  let u;
  try { u = new URL(s); } catch { return null; }
  return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : null;
}

// Parse pasted text — URLs separated by newlines, commas, or whitespace — into a
// de-duplicated, order-preserving list of valid image URLs.
export function parsePhotoUrls(text) {
  const seen = new Set();
  const out = [];
  for (const tok of String(text ?? '').split(/[\s,]+/)) {
    const url = safeImageUrl(tok);
    if (url && !seen.has(url)) { seen.add(url); out.push(url); }
  }
  return out;
}

// Coerce a persisted (possibly legacy or malformed) media value into the canonical
// shape, dropping anything that isn't a valid image URL. Accepts bare string
// entries and legacy { url } objects.
export function normalizeMedia(media) {
  const photos = (media && Array.isArray(media.photos)) ? media.photos : [];
  const clean = [];
  const seen = new Set();
  for (const p of photos) {
    const url = safeImageUrl(typeof p === 'string' ? p : (p && p.url));
    if (url && !seen.has(url)) { seen.add(url); clean.push(url); }
  }
  return { photos: clean };
}
