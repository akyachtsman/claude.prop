// account.js — auth flow + topbar account UI. Owns the sign-in/out lifecycle,
// the first-sign-in reconcile (offer-to-upload + gap-seed), the initial cloud
// fetch, and the offline read-only state. Everything routes through store's
// stable interface; views are untouched.

import { signIn, signUp, resetPassword, updatePassword, signOut, getSession, onAuthChange } from './supabase.js';
import { cloudOps } from './cloud.js';
import * as store from './store.js';
import { el, clear, toast, houseDialog, field } from './dom.js';
import { sampleProperty, demoProperties } from './sample.js';
import { missingFixtures } from './reconcile.js';

const slot = document.getElementById('topbar-account');
const banner = document.getElementById('offline-banner');
let rerender = () => {};      // set by init() — re-renders the current view
let recovering = false;       // true while a password-reset link is being completed

// ── first-sign-in reconcile (D6 fixed order: upload wins, then gap-seed) ────
function fixtures() { return [sampleProperty(), ...demoProperties()]; }

// Re-entry guard (synchronous): the upload prompt awaits a user click, and the
// localStorage "done" flag is only written afterwards — so if two auth events
// (INITIAL_SESSION + SIGNED_IN, or a double SIGNED_IN) each call reconcile before
// the first resolves, both would stack an identical modal. Claim the uid up front
// so only the first call ever runs.
const reconciledUids = new Set();

async function reconcile(uid) {
  if (reconciledUids.has(uid)) return;
  reconciledUids.add(uid);

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

// The house dialog (design.md §10): "Move them in" is the act; Not now, ×, Esc
// and the backdrop all leave the local copy where it is.
function confirmUpload(n) {
  const move = el('button', { class: 'btn btn-primary', type: 'button', text: `Move ${n === 1 ? 'it' : 'them'} in` });
  const d = houseDialog({
    title: 'Move your local deals in?', className: 'upload-modal',
    body: [el('p', { text:
      `You have ${n} propert${n === 1 ? 'y' : 'ies'} saved on this device. Copy ${n === 1 ? 'it into your account so it syncs' : 'them into your account so they sync'} everywhere? Your local copy is kept either way.` })],
    footer: [el('button', { class: 'btn', type: 'button', 'data-dialog-close': '', text: 'Not now' }), move],
  });
  move.addEventListener('click', () => d.close(true));
  return d.done.then((v) => v === true);
}

// ── apply a session to the store (initial fetch + reconcile) ────────────────
async function applySession(session) {
  if (!session || !session.user) { store.setSession(null); return; }
  store.setSession(session, cloudOps, { notify: toast, onAuthLost, onResync: () => rerender() });
  try {
    await store.fetchAll();                 // initial cloud pull → cache
  } catch (e) {
    if (e && e.isAuth) { onAuthLost(); return; }   // expired session → sign out, don't reconcile
    toast("Couldn't load your account, so these are the deals saved on this device.", { error: true });
  }
  await reconcile(session.user.id);
}

// store calls this when a write-through hits a 401 (session expired mid-edit).
function onAuthLost() {
  toast('Signed out. Sign in again to keep saving.', { error: true });
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
// House form (design.md §12): each field's label sits above it; an error sits
// under the field it is about, and the result of a send under the button (§18);
// the button says what it is doing while it works (§4).
function renderGate(host) {
  const H = window.House;
  let mode = 'signin';
  const email = el('input', { class: 'input', type: 'email', placeholder: 'you@example.com', autocomplete: 'email' });
  const password = el('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
  const pwField = field('Password', password);
  pwField.classList.add('authgate__pw');
  const title = el('h1', { class: 'authgate__title' });
  const sub = el('p', { class: 'authgate__sub' });
  const submitBtn = el('button', { class: 'btn btn-primary authgate__send', type: 'button' });
  const links = el('div', { class: 'authgate__links' });

  const say = (target, text, kind = 'err') => H.message(target, text, { kind });
  const hush = () => { say(email, ''); say(password, ''); say(submitBtn, ''); };
  const linkTo = (label, to) => el('button', { class: 'link-action authgate__link', type: 'button', text: label,
    onclick: () => { mode = to; paint(); email.focus(); } });

  function paint() {
    hush(); submitBtn.disabled = false;
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
    if (submitBtn.disabled) return;
    hush();
    const addr = email.value.trim();
    if (!addr) { say(email, 'Enter your email.'); email.focus(); return; }
    if (mode !== 'forgot' && !password.value) { say(password, 'Enter your password.'); password.focus(); return; }
    if (mode === 'signin') {
      const done = H.busy(submitBtn, 'Signing in…');
      const r = await signIn(addr, password.value);
      if (!r.ok) { done(); say(submitBtn, r.error || 'Could not sign in.'); }
      // success → onAuthChange(SIGNED_IN) renders the app
    } else if (mode === 'signup') {
      const done = H.busy(submitBtn, 'Creating account…');
      const r = await signUp(addr, password.value);
      if (!r.ok) { done(); say(submitBtn, r.error || 'Could not create the account.'); }
      else if (r.needsConfirm) { done(); say(submitBtn, `Almost there: confirm your email (${addr}), then sign in.`, 'ok'); }
      // else success → onAuthChange(SIGNED_IN) renders the app
    } else {
      const done = H.busy(submitBtn, 'Sending…');
      const r = await resetPassword(addr);
      done();
      if (r.ok) { submitBtn.disabled = true; say(submitBtn, 'Check your email for a link to set a new password.', 'ok'); }
      else say(submitBtn, r.error || 'Could not send the reset link.');
    }
  }
  submitBtn.addEventListener('click', submit);
  [email, password].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));

  clear(host);
  host.appendChild(el('div', { class: 'authgate' }, [
    el('div', { class: 'card authgate__card' }, [
      el('div', { class: 'authgate__brand', text: 'Property Analytics' }),
      title, sub,
      field('Email', email),
      pwField, submitBtn, links,
    ]),
  ]));
  paint();
  email.focus();
}

// Set-new-password form, shown after the user follows a reset link (recovery).
function renderRecover(host) {
  const H = window.House;
  const password = el('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
  const btn = el('button', { class: 'btn btn-primary authgate__send', type: 'button', text: 'Set new password' });
  const submit = async () => {
    if (btn.disabled) return;
    H.message(btn, '');
    if (!password.value || password.value.length < 6) { H.message(password, 'Use at least 6 characters.'); password.focus(); return; }
    H.message(password, '');
    const done = H.busy(btn, 'Saving…');
    const r = await updatePassword(password.value);
    if (!r.ok) { done(); H.message(btn, r.error || 'Could not set the password.'); return; }
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
    el('div', { class: 'card authgate__card' }, [
      el('div', { class: 'authgate__brand', text: 'Property Analytics' }),
      el('h1', { class: 'authgate__title', text: 'Set a new password' }),
      el('p', { class: 'authgate__sub', text: 'Choose a new password for your account (at least 6 characters).' }),
      field('New password', password),
      btn,
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
