# DESIGN-GAPS.md — where Property Analytics does not meet the house standard yet

The house standard is `directives/design.md` in claude.directives (owner rulings,
2026-10-19). This project moves onto it with `/design-intake` step 1c, in three
steps. Step 1 (2026-10-25) made room with no visible change: the ten classes this
project shared with the house `styles/components.css` are now `legacy-<name>` in
`styles/legacy.css`, and every old screen's root carries `legacy-screen`.

Each line below is one screen and one group of the standard that the screen
breaks, with the file it lives in. **Step 2** moves the screens, one or a few per
PR, in the order the owner picks from this list: each takes the house components
and patterns, drops its `legacy-` classes and `legacy-screen`, and deletes the
lines it fixes. A change that touches a listed screen brings it up to the
standard, or says in its PR why not. **Step 3** deletes this file, once it is
empty, together with `styles/legacy.css`.

The palette is not a gap: by owner ruling (2026-10-25) this project keeps its
Banker Navy colours and fonts (`CLAUDE.md` → Design).

| Screen | Group (design.md) | What breaks | File |
|---|---|---|---|
| Properties list | Cards §5 | Archive is a text button in the card footer; the name is cut with an ellipsis | `js/views/list.js` |
| Properties list | Archive §7 | Archived items live on a separate page, not an Archived (N) pop-over; no confirmation; the toast does not name the property | `js/app.js` |
| Properties list | Words §2 | "+ New property"; "Restore" means JSON import | `js/app.js`, `index.html` |
| Properties list | Empty state §15 | its own `.empty` block | `js/views/list.js` |
| Properties list | Search §16 | actions sit in the top bar; no search box | `js/app.js` |
| Property dashboard | Icons §3 | 🔒/🔓, ↶/↷ and 🏷 used as action icons | `js/views/dashboard.js`, `js/app.js` |
| Property dashboard | Principles §1 | labels and names truncated with an ellipsis in 13 rules | `styles/legacy.css` |
| Property dashboard | Cards §5, Buttons §4 | its own card and button classes; KPI tiles are `div tabindex=0` | `js/views/dashboard.js` |
| Property dashboard | Forms §12 | grid inputs have no visible label | `js/views/dashboard.js` |
| Compare | Segmented §11, Back §11 | `.seg` with `role=group`; Back is a ghost button; ↕ sort glyph | `js/views/compare.js` |
| Archive | Archive §7, Delete §8, Confirm §9 | a separate page; Restore labelled "R"; delete is × behind a native `confirm()` | `js/views/archive.js`, `js/app.js` |
| Photos gallery | Dialogs §10 | its own modal; "Done"; × removes a saved photo | `js/views/dashboard-media.js` |
| Photos gallery | Upload §13 | URLs pasted in a textarea | `js/views/dashboard-media.js` |
| Listing details | Dialogs §10 | its own modal with "Done"; on a short screen (390×340) Done scrolls out of view with the panel (Escape and the backdrop still close it) | `js/views/dashboard-media.js` |
| Import a listing | Dialogs §10, Messages §18 | its own modal, a × text close, its own status line; on a short screen (390×340) the × scrolls out of view with the panel (Escape and the backdrop still close it) | `js/app.js` |
| Sign-in | Forms §12 | the placeholder is the label | `js/account.js` |
| Move local deals | Dialogs §10 | its own modal | `js/account.js` |
| Toast | Messages §18 | shown at the top; "Deleted." does not name the thing | `js/dom.js`, `js/app.js` |
