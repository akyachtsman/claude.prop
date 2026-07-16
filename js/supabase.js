// supabase.js — the single Supabase client for the app + thin auth helpers.
//
// PKCE flow: the magic link returns `?code=…` as a query param (not a URL
// fragment), so it never collides with the app's hash router. `detectSessionInUrl`
// makes supabase-js exchange that code for a session and clean the URL on load;
// `persistSession` keeps the user signed in until an explicit sign-out (spec Q6).
// The vendored client library is bundled locally (js/vendor) — no runtime CDN.

import { createClient } from './vendor/supabase-js.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Where the magic link returns the user. Uses the current origin + path so the
// same build works on GitHub Pages and on a localhost dev server; both URLs must
// be listed in the Supabase dashboard's Auth → Redirect URLs allowlist.
function redirectTo() {
  const { origin, pathname } = window.location;
  return origin + pathname;
}

/** Email magic-link sign-in. Resolves { ok } / { ok:false, error }. */
export async function signInWithEmail(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo() },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** The current session (null when logged out). Awaits the initial URL exchange. */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data ? data.session : null;
}

/** Subscribe to auth changes. cb(event, session). Returns an unsubscribe fn. */
export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange(cb);
  return () => data.subscription.unsubscribe();
}
