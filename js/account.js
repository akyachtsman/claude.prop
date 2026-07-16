// account.js — auth flow + topbar account UI. Owns the sign-in/out lifecycle,
// the first-sign-in reconcile (offer-to-upload + gap-seed), the initial cloud
// fetch, and the offline read-only state. Everything routes through store's
// stable interface; views are untouched.

import { supabase, signInWithEmail, signOut, getSession, onAuthChange } from './supabase.js';
import { cloudOps } from './cloud.js';
import * as store from './store.js';
import { el, clear, toast } from './dom.js';
import { sampleProperty, demoProperties } from './sample.js';
import { missingFixtures } from './reconcile.js';

const slot = document.getElementById('topbar-account');
const banner = document.getElementById('offline-banner');
let rerender = () => {};      // set by init() — re-renders the current view

// ── modal helper (Banker Navy) ─────────────────────────────────────────────
function modal(children) {
  const panel = el('div', { class: 'modal__panel', role: 'dialog', 'aria-modal': 'true' }, children);
  const overlay = el('div', { class: 'modal__overlay' }, [panel]);
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
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
  store.setSession(session, cloudOps, { notify: toast, onAuthLost });
  try {
    await store.fetchAll();                 // initial cloud pull → cache
  } catch (e) {
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
  } else {
    slot.appendChild(el('button', { class: 'topbar__link account__btn', type: 'button', text: 'Sign in',
      onclick: openSignIn }));
  }
}

function openSignIn() {
  const email = el('input', { class: 'input', type: 'email', 'aria-label': 'Email for sign-in link',
    placeholder: 'you@example.com', autocomplete: 'email' });
  const status = el('p', { class: 'modal__body modal__status' });
  const send = el('button', { class: 'btn btn--primary', type: 'button', text: 'Send link' });
  const m = modal([
    el('h2', { class: 'modal__title', text: 'Sign in' }),
    el('p', { class: 'modal__body', text: 'Enter your email and we’ll send a one-time sign-in link. No password.' }),
    el('div', { class: 'field' }, [email]),
    status,
    el('div', { class: 'modal__actions' }, [
      el('button', { class: 'btn btn--ghost', type: 'button', text: 'Cancel', onclick: () => m.close() }),
      send,
    ]),
  ]);
  email.focus();
  const submit = async () => {
    const addr = email.value.trim();
    if (!addr) { status.textContent = 'Enter your email first.'; return; }
    send.disabled = true; status.textContent = 'Sending…';
    const res = await signInWithEmail(addr);
    if (res.ok) {
      status.classList.add('modal__status--ok');
      status.textContent = `Check your email — a sign-in link is on its way to ${addr}.`;
      send.remove();
    } else {
      send.disabled = false;
      status.textContent = res.error || 'Could not send the link. Try again.';
    }
  };
  send.addEventListener('click', submit);
  email.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
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
  let session = null;
  try { session = await getSession(); } catch (e) { session = null; }
  await applySession(session);
  renderControl(session);
  refreshOnline();

  let first = true;
  onAuthChange(async (event, sess) => {
    if (first) { first = false; return; }          // initial state already handled above
    if (event === 'SIGNED_IN') {
      await applySession(sess);
      renderControl(sess);
      refreshOnline();
      rerender();
    } else if (event === 'SIGNED_OUT') {
      store.setSession(null);
      renderControl(null);
      setReadonly(false);
      rerender();
    }
    // TOKEN_REFRESHED / USER_UPDATED: session stays valid, nothing to swap.
  });
}
