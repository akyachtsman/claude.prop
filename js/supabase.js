// supabase.js — the single Supabase client for the app + thin auth helpers.
//
// Email + password auth. Sign-up/sign-in use the password grant. "Forgot
// password" emails a reset link; clicking it returns to the app with a PKCE
// `?code=` that supabase-js exchanges into a short-lived recovery session
// (`PASSWORD_RECOVERY` event), after which the app collects a new password via
// updatePassword(). `detectSessionInUrl` performs that exchange and cleans the
// URL; `persistSession` keeps the user signed in until sign-out. The client
// library is vendored locally (js/vendor) — no runtime CDN.

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

// Where password-reset / email-confirm links return the user. Uses the current
// origin + path so the same build works on GitHub Pages and localhost; both URLs
// must be listed in the Supabase dashboard's Auth → Redirect URLs allowlist.
function redirectTo() {
  const { origin, pathname } = window.location;
  return origin + pathname;
}

/** Sign in with email + password. Resolves { ok } / { ok:false, error }. */
export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Create an account with email + password. If the project requires email
 *  confirmation, no session is returned yet — resolves { ok, needsConfirm:true }.
 *  Otherwise the user is signed in immediately ({ ok, needsConfirm:false }). */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email, password, options: { emailRedirectTo: redirectTo() },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, needsConfirm: !data.session };
}

/** Email a password-reset link (returns to the app in recovery mode). */
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Set a new password (used during a recovery session, or any signed-in user). */
export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
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
