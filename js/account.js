// account.js — auth flow + topbar account UI. Owns the sign-in/out lifecycle,
// the first-sign-in reconcile (offer-to-upload + gap-seed), the initial cloud
// fetch, and the offline read-only state. Everything routes through store's
// stable interface; views are untouched.

import { signIn, signUp, resetPassword, updatePassword, signOut, getSession, onAuthChange } from './supabase.js';
import { cloudOps } from './cloud.js';
import * as store from './store.js';
import { el, clear, toast } from './dom.js';
import { sampleProperty, demoProperties } from './sample.js';
import { missingFixtures } from './reconcile.js';

const slot = document.getElementById('topbar-account');
const banner = document.getElementById('offline-banner');
let rerender = () => {};      // set by init() — re-renders the current view
let recovering = false;       // true while a password-reset link is being completed

// ── modal helper (Banker Navy) ─────────────────────────────────────────────
function modal(children) {
  const panel = el('div', { class: 'modal__panel', role: 'dialog', 'aria-modal': 'true' }, children);
  const overlay = el('div', { class: 'modal__overlay' }, [panel]);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { document.removeEventListener('keydown', onKey); overlay.remove(); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  return { close, panel };
}

// ── first-sign-in reconcile (D6 fixed order: upload wins, then gap-seed) ────
function fixtures() { return [sampleProperty(), ...demoProperties()]; }

async function reconcile(uid) {
  const RECON_KEY = 'propanalytics.reconciled.' + uid;
  try { if (localStorage.getItem(RECON_KEY)) return; } catch (e) { /* proceed */ }

  const localDeals = store.readLocalDeals();
  if (localDeals.length) {
    const upload = await confirmUpload(localDeals.length);
    if (upload) localDeals.forEach((d) => store.save(d));   // upsert — user copies win
  }
  // Seed only fixture ids the account is missing, so an uploaded/edited copy is
  // never overwritten and a fresh account still gets its samples.
  missingFixtures(store.list(), fixtures()).forEach((f) => store.save(f));

  try { localStorage.setItem(RECON_KEY, new Date().toISOString()); } catch (e) { /* ignore */ }
}

function confirmUpload(n) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; m.close(); resolve(v); };
    const m = modal([
      el('h2', { class: 'modal__title', text: 'Move your local deals in?' }),
      el('p', { class: 'modal__body', text:
        `You have ${n} propert${n === 1 ? 'y' : 'ies'} saved on this device. Copy ${n === 1 ? 'it' : 'them'} into your account so they sync everywhere? Your local copy is kept either way.` }),
      el('div', { class: 'modal__actions' }, [
        el('button', { class: 'btn btn--ghost', type: 'button', text: 'Not now', onclick: () => finish(false) }),
        el('button', { class: 'btn btn--primary', type: 'button', text: `Move ${n === 1 ? 'it' : 'them'} in`, onclick: () => finish(true) }),
      ]),
    ]);
  });
}

// ── apply a session to the store (initial fetch + reconcile) ────────────────
async function applySession(session) {
  if (!session || !session.user) { store.setSession(null); return; }
  store.setSession(session, cloudOps, { notify: toast, onAuthLost, onResync: () => rerender() });
  try {
    await store.fetchAll();                 // initial cloud pull → cache
  } catch (e) {
    if (e && e.isAuth) { onAuthLost(); return; }   // expired session → sign out, don't reconcile
    toast("Couldn't load your account — showing cached deals.", 'info');
  }
  await reconcile(session.user.id);
}

// store calls this when a write-through hits a 401 (session expired mid-edit).
function onAuthLost() {
  toast('Signed out — sign in again to keep saving.', 'info');
  signOut();                                // clears tokens → fires SIGNED_OUT → switch to local
}

// ── topbar control ──────────────────────────────────────────────────────────
function renderControl(session) {
  clear(slot);
  if (session && session.user) {
    slot.appendChild(el('span', { class: 'account__email', title: session.user.email, text: session.user.email }));
    slot.appendChild(el('button', { class: 'topbar__link account__btn', type: 'button', text: 'Sign out',
      onclick: () => signOut() }));
  }
  // Logged out: nothing here — the full-page auth gate owns sign-in.
}

/** True whenever the full-page auth screen (sign in / reset) should be shown
 *  instead of the app: logged out, or mid password-recovery. */
export function needsAuthScreen() {
  return recovering || store.backendKind() !== 'cloud';
}

/** Full-page auth screen — the only thing a logged-out visitor sees. Renders the
 *  set-new-password form during recovery, else the email+password gate. */
export function renderAuthScreen(host) {
  return recovering ? renderRecover(host) : renderGate(host);
}

// Email + password gate with three modes: sign in / create account / forgot.
function renderGate(host) {
  let mode = 'signin';
  const email = el('input', { class: 'input', type: 'email', 'aria-label': 'Email', placeholder: 'you@example.com', autocomplete: 'email' });
  const password = el('input', { class: 'input', type: 'password', 'aria-label': 'Password', placeholder: 'Password', autocomplete: 'current-password' });
  const pwField = el('div', { class: 'field authgate__field' }, [password]);
  const title = el('h1', { class: 'authgate__title' });
  const sub = el('p', { class: 'authgate__sub' });
  const submitBtn = el('button', { class: 'btn btn--primary authgate__send', type: 'button' });
  const status = el('p', { class: 'authgate__status', role: 'status' });
  const links = el('div', { class: 'authgate__links' });

  const setStatus = (msg, ok = false) => { status.textContent = msg || ''; status.classList.toggle('authgate__status--ok', !!ok); };
  const linkTo = (label, to) => el('button', { class: 'authgate__link', type: 'button', text: label,
    onclick: () => { mode = to; paint(); email.focus(); } });

  function paint() {
    setStatus(''); submitBtn.disabled = false;
    clear(links);
    if (mode === 'signin') {
      title.textContent = 'Sign in to your portfolio';
      sub.textContent = 'Enter your email and password to reach your deals on any device.';
      password.setAttribute('autocomplete', 'current-password'); pwField.hidden = false;
      submitBtn.textContent = 'Sign in';
      links.appendChild(linkTo('Create an account', 'signup'));
      links.appendChild(linkTo('Forgot password?', 'forgot'));
    } else if (mode === 'signup') {
      title.textContent = 'Create your account';
      sub.textContent = 'Choose an email and a password (at least 6 characters). Your deals sync to this account.';
      password.setAttribute('autocomplete', 'new-password'); pwField.hidden = false;
      submitBtn.textContent = 'Create account';
      links.appendChild(linkTo('Have an account? Sign in', 'signin'));
    } else {
      title.textContent = 'Reset your password';
      sub.textContent = 'Enter your email and we’ll send a link to set a new password.';
      pwField.hidden = true;
      submitBtn.textContent = 'Send reset link';
      links.appendChild(linkTo('Back to sign in', 'signin'));
    }
  }

  async function submit() {
    const addr = email.value.trim();
    if (!addr) return setStatus('Enter your email first.');
    if (mode !== 'forgot' && !password.value) return setStatus('Enter your password.');
    submitBtn.disabled = true; setStatus('Working…');
    if (mode === 'signin') {
      const r = await signIn(addr, password.value);
      if (!r.ok) { submitBtn.disabled = false; setStatus(r.error || 'Could not sign in.'); }
      // success → onAuthChange(SIGNED_IN) renders the app
    } else if (mode === 'signup') {
      const r = await signUp(addr, password.value);
      if (!r.ok) { submitBtn.disabled = false; setStatus(r.error || 'Could not create the account.'); }
      else if (r.needsConfirm) setStatus(`Almost there — confirm your email (${addr}), then sign in.`, true);
      // else success → onAuthChange(SIGNED_IN) renders the app
    } else {
      const r = await resetPassword(addr);
      if (r.ok) setStatus('Check your email for a link to set a new password.', true);
      else { submitBtn.disabled = false; setStatus(r.error || 'Could not send the reset link.'); }
    }
  }
  submitBtn.addEventListener('click', submit);
  [email, password].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));

  clear(host);
  host.appendChild(el('div', { class: 'authgate' }, [
    el('div', { class: 'authgate__card' }, [
      el('div', { class: 'authgate__brand', text: 'Property Analytics' }),
      title, sub,
      el('div', { class: 'field authgate__field' }, [email]),
      pwField, submitBtn, status, links,
    ]),
  ]));
  paint();
  email.focus();
}

// Set-new-password form, shown after the user follows a reset link (recovery).
function renderRecover(host) {
  const password = el('input', { class: 'input', type: 'password', 'aria-label': 'New password', placeholder: 'New password', autocomplete: 'new-password' });
  const status = el('p', { class: 'authgate__status', role: 'status' });
  const btn = el('button', { class: 'btn btn--primary authgate__send', type: 'button', text: 'Set new password' });
  const submit = async () => {
    if (!password.value || password.value.length < 6) { status.textContent = 'Use at least 6 characters.'; return; }
    btn.disabled = true; status.textContent = 'Saving…';
    const r = await updatePassword(password.value);
    if (!r.ok) { btn.disabled = false; status.textContent = r.error || 'Could not set the password.'; return; }
    recovering = false;                         // now a full session → load the account + show the app
    const session = await getSession();
    await applySession(session);
    renderControl(session);
    refreshOnline();
    rerender();
  };
  btn.addEventListener('click', submit);
  password.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  clear(host);
  host.appendChild(el('div', { class: 'authgate' }, [
    el('div', { class: 'authgate__card' }, [
      el('div', { class: 'authgate__brand', text: 'Property Analytics' }),
      el('h1', { class: 'authgate__title', text: 'Set a new password' }),
      el('p', { class: 'authgate__sub', text: 'Choose a new password for your account (at least 6 characters).' }),
      el('div', { class: 'field authgate__field' }, [password]),
      btn, status,
    ]),
  ]));
  password.focus();
}

// ── offline read-only state (T19) ───────────────────────────────────────────
function setReadonly(on) {
  banner.hidden = !on;
  document.body.classList.toggle('is-readonly', on);
}
function refreshOnline() {
  // Only meaningful signed in; logged-out local mode is always editable.
  const cloud = store.backendKind() === 'cloud';
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  setReadonly(cloud && offline);
}
window.addEventListener('offline', refreshOnline);
window.addEventListener('online', async () => {
  refreshOnline();
  if (store.backendKind() === 'cloud') {
    try { await store.fetchAll(); rerender(); } catch (e) { /* stay on cache */ }
  }
});

// ── boot ─────────────────────────────────────────────────────────────────────
/** Resolve the session (exchanging a magic-link ?code), apply it, and render the
 *  control — all BEFORE the first router() call (boot ordering, T13). Then
 *  subscribe for later sign-in/out. Returns nothing; call store.backendKind()
 *  after to decide local seeding. */
export async function initAccount({ rerender: rr }) {
  rerender = rr || rerender;

  // Drive the initial apply from the first auth event (INITIAL_SESSION) rather
  // than a separate getSession() call — that avoids a race where getSession
  // resolves null before the persisted session hydrates and the INITIAL_SESSION
  // that carries it gets dropped (which stranded the user on the gate). Boot
  // waits on that first event so the session is applied before the first render.
  let booted = false;
  await new Promise((resolve) => {
    const done = () => { if (!booted) { booted = true; resolve(); } };
    const applyAndRender = async (sess) => {
      recovering = false;
      if (sess) { await applySession(sess); renderControl(sess); }
      else { store.setSession(null); renderControl(null); }
      refreshOnline();
    };
    onAuthChange(async (event, sess) => {
      if (event === 'PASSWORD_RECOVERY') { recovering = true; rerender(); done(); return; }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        await applyAndRender(sess);
        booted ? rerender() : done();
        return;
      }
      if (event === 'SIGNED_OUT') {
        recovering = false;
        store.setSession(null); renderControl(null); setReadonly(false);
        booted ? rerender() : done();
        return;
      }
      // TOKEN_REFRESHED / USER_UPDATED: session stays valid, nothing to swap.
      if (!booted) done();
    });
    // Safety net: never hang boot if no auth event arrives (treat as logged out).
    setTimeout(done, 3000);
  });
}
