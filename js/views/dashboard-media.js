// dashboard-media.js — the Property Info card header's two buttons and the three
// overlays they open: the photo gallery, its full-size lightbox, and the
// Listing-details form.
//
// Split out of dashboard.js, which had reached 905 lines because almost
// everything lived inside one renderDashboard() closure. This block was the one
// part closing over nothing but `prop` and `onEdit`, so moving it NARROWS the
// seam rather than widening it: dashboard.js previously held eight interrelated
// bindings here (two buttons, two label refreshers, three openers and
// LISTING_FIELDS) and now makes a single call and places two buttons. Everything
// else is module-private.
//
// All three are house dialogs rather than inline fields because the dashboard
// must stay one-screen (S11) and touch inputs are 44px tall; the gallery/viewer
// layering and every dismissal path are S30/S40's subject.

import { el, clear, toast, houseDialog, field } from '../dom.js';
import { safeImageUrl, parsePhotoUrls } from '../media.js';

/** Build the Photos (N) and Listing-details buttons, each fully wired to
 *  its overlay. `onEdit` is the dashboard's commit + auto-save hook, called only
 *  when an overlay actually changed something. */
export function mediaButtons({ prop, onEdit }) {
// Photos button — lives in the Property Info card header (not the top bar, so
// the mobile top bar can't overflow; and in an existing header row, so it adds
// no dashboard height). Opens the gallery modal (hoisted below).
// design.md §3: a photo act is the camera with the word.
const photosBtn = el('button', { class: 'photos-btn', type: 'button', title: 'Photos' });
function refreshPhotosBtn() {
  const n = prop.media.photos.length;
  photosBtn.replaceChildren(window.House.icon('camera'), el('span', { text: `Photos (${n})` }));
  photosBtn.setAttribute('aria-label', `Photos (${n})`);
}
refreshPhotosBtn();
photosBtn.addEventListener('click', openGallery);
// Listing details — the extra descriptors imported from a source listing
// (subtype, tenancy, broker, …) plus a free-text description. Kept in a modal
// rather than inline fields so the one-screen layout holds on every context
// (touch inputs are 44px tall, so extra inline rows would overflow on mobile).
const LISTING_FIELDS = [['Subtype', 'subtype'], ['Broker', 'broker'], ['Source', 'source']];
// A word, not an emoji (§3: emoji are never an action's icon); the ✓ says the
// deal already carries some details.
const listingBtn = el('button', { class: 'photos-btn', type: 'button', title: 'Listing details', 'aria-label': 'Listing details' });
function refreshListingBtn() {
  const filled = LISTING_FIELDS.some(([, k]) => (prop.info[k] || '').trim())
    || (prop.info.photosLink || '').trim() || (prop.info.description || '').trim();
  listingBtn.textContent = filled ? 'Details ✓' : 'Details';
}
refreshListingBtn();
listingBtn.addEventListener('click', openListing);

// The photo gallery — the house dialog (design.md §10, §12). It works on a copy:
// Add photos and each photo's × change only the copy, and Save stores it in one
// commit (one undo step); Cancel, × and (with nothing changed) Esc and the
// backdrop leave the deal's photos as they were. Photos are links pasted into
// the box, not uploaded files (CLAUDE.md -> Design, the Photos ruling).
function openGallery() {
  const photos = [...prop.media.photos];
  const grid = el('div', { class: 'gallery__grid' });
  let d;
  function renderThumbs() {
    clear(grid);
    if (!photos.length) {
      grid.appendChild(el('p', { class: 'gallery__empty', text: 'No photos yet. Paste photo links below to add them.' }));
      return;
    }
    photos.forEach((url, i) => {
      const view = el('button', { class: 'gallery__open', type: 'button', 'aria-label': `View photo ${i + 1}`, title: `View photo ${i + 1}` },
        [el('img', { class: 'gallery__img', loading: 'lazy', alt: '', src: url })]);
      view.addEventListener('click', () => openLightbox(photos, i, view));
      // × takes a photo off before Save (design.md §2, §3: Remove, ×).
      const del = el('button', { class: 'btn btn-icon gallery__del', type: 'button', 'aria-label': `Remove photo ${i + 1}`, title: `Remove photo ${i + 1}` }, [window.House.icon('x')]);
      del.addEventListener('click', () => {
        photos.splice(i, 1);
        renderThumbs();
        d.setDirty(true);
        (grid.querySelector('.gallery__del') || ta).focus();
      });
      grid.appendChild(el('figure', { class: 'gallery__cell' }, [view, del]));
    });
  }
  const ta = el('textarea', { class: 'input gallery__ta', rows: '2', 'aria-label': 'Add photo links', placeholder: 'e.g. https://example.com/front.jpg, one per line' });
  const addBtn = el('button', { class: 'btn', type: 'button', text: 'Add photos' });
  addBtn.addEventListener('click', () => {
    const seen = new Set(photos);
    const fresh = parsePhotoUrls(ta.value).filter((u) => !seen.has(u));
    if (!fresh.length) {
      window.House.message(ta, 'No new photo links found. Paste links that start with http:// or https://.');
      ta.focus();
      return;
    }
    photos.push(...fresh);
    ta.value = '';
    renderThumbs();
    d.setDirty(true);
    window.House.message(ta, `${fresh.length} photo${fresh.length > 1 ? 's' : ''} added. Save to keep ${fresh.length > 1 ? 'them' : 'it'}.`, { kind: 'ok' });
  });
  const save = el('button', { class: 'btn btn-primary', type: 'button', text: 'Save' });
  d = houseDialog({
    title: 'Photos', className: 'gallery-modal', opener: photosBtn,
    body: [grid, field('Add photo links', ta), el('div', { class: 'gallery__add' }, [addBtn])],
    footer: [el('button', { class: 'btn', type: 'button', 'data-dialog-close': '', text: 'Cancel' }), save],
  });
  renderThumbs();
  save.addEventListener('click', () => {
    const changed = photos.length !== prop.media.photos.length || photos.some((u, i) => u !== prop.media.photos[i]);
    prop.media.photos = photos;
    d.close();
    refreshPhotosBtn();
    if (changed) { onEdit(); toast('Photos saved.'); }
  });
}

// The photo viewer — a read-only house dialog over the gallery (§10: a dialog
// opened from another sits above it, and Esc closes only the top one).
// Previous and Next sit beside × in the header, not in a footer, so the photo
// keeps the height on a short screen; ← and → step too.
function openLightbox(photos, start, opener) {
  let idx = start;
  const img = el('img', { class: 'lightbox__img', alt: '' });
  const prev = el('button', { class: 'btn', type: 'button', text: 'Previous' });
  const next = el('button', { class: 'btn', type: 'button', text: 'Next' });
  const d = houseDialog({
    title: '', className: 'lightbox-modal', opener, initialFocus: photos.length > 1 ? next : undefined,
    actions: photos.length > 1 ? [prev, next] : [],
    body: [img],
  });
  const title = d.box.querySelector('.dialog-title');
  const paint = () => {
    img.src = photos[idx];
    title.textContent = `Photo ${idx + 1} of ${photos.length}`;
    img.alt = title.textContent;
  };
  const step = (n) => { idx = (idx + n + photos.length) % photos.length; paint(); };
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  d.box.addEventListener('keydown', (e) => {
    if (photos.length < 2) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });
  paint();
}

// Listing details — the house dialog (design.md §10, §12): labelled fields for
// the extra descriptors and a description. Nothing is stored until Save, which
// commits once (one undo step); Cancel, ×, Esc and the backdrop leave the deal
// as it was (Esc and the backdrop do nothing once something is typed).
function openListing() {
  const input = (key, attrs = {}) => {
    const inp = el('input', { class: 'input', type: 'text', ...attrs });
    inp.value = prop.info[key] || '';
    return inp;
  };
  const fields = LISTING_FIELDS.map(([label, key]) => [key, input(key, { 'aria-label': label })]);
  // Photos link — a URL to the source listing / photo gallery, with a live
  // "Open ↗" link when the value is a valid http(s) address.
  const linkInp = input('photosLink', { type: 'url', 'aria-label': 'Photos link', placeholder: 'e.g. https://www.crexi.com/properties/…' });
  const linkOpen = el('a', { class: 'link-open', target: '_blank', rel: 'noopener noreferrer', text: 'Open ↗' });
  const syncLink = () => { const u = safeImageUrl(linkInp.value); if (u) { linkOpen.href = u; linkOpen.hidden = false; } else { linkOpen.removeAttribute('href'); linkOpen.hidden = true; } };
  linkInp.addEventListener('input', syncLink);
  syncLink();
  const ta = el('textarea', { class: 'input desc-ta', rows: '6', 'aria-label': 'Property description', placeholder: 'e.g. highlights, building and business extras' });
  ta.value = prop.info.description || '';
  const save = el('button', { class: 'btn btn-primary', type: 'button', text: 'Save' });
  const d = houseDialog({
    title: 'Listing details', className: 'desc-modal', opener: listingBtn,
    body: [
      el('div', { class: 'desc-grid' }, LISTING_FIELDS.map(([label], i) => field(label, fields[i][1]))),
      field('Photos link', linkInp, [' ', linkOpen]),
      field('Description', ta),
    ],
    footer: [el('button', { class: 'btn', type: 'button', 'data-dialog-close': '', text: 'Cancel' }), save],
  });
  save.addEventListener('click', () => {
    const next = { photosLink: linkInp.value, description: ta.value };
    fields.forEach(([key, inp]) => { next[key] = inp.value; });
    const changed = Object.keys(next).some((k) => (prop.info[k] || '') !== next[k]);
    Object.assign(prop.info, next);
    d.close();
    refreshListingBtn();
    if (changed) { onEdit(); toast('Listing details saved.'); }
  });
}

  return { photosBtn, listingBtn };
}
