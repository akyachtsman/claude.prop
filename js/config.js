// config.js — Supabase connection constants for the browser client.
//
// PUBLIC BY DESIGN — this is not a secret and is meant to ship in every browser.
// The publishable key only grants what Row-Level Security allows: each signed-in
// user reads/writes only their own `properties` rows (see
// supabase/migrations/0001_properties.sql). RLS is the protection, not obscurity.
//
// data.md's "no hardcoded keys" rule governs the SERVICE-ROLE / secret key, which
// must NEVER appear in client code — and does not here. A no-build GitHub Pages
// site has no CI step to inject a repo variable, so committing the public URL +
// publishable key is the compliant, standard path for a static Supabase app.

export const SUPABASE_URL = 'https://yucnxlimmrgzbqtdizle.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rkz5kMusAPXep8d8LTbXZQ_5SRFHuC9';
