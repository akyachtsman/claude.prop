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
Nor is the Archive page itself: by owner ruling (2026-10-27) archived deals keep
their own compare-style page instead of the §7 Archived (N) pop-over
(`CLAUDE.md` → Design).

Moved so far: the Archive rows' Delete permanently (#140, 2026-10-27), then
Compare and the Archive table (2026-11-03), which take the house page base,
`.link-action` Back, segmented control, `.table`/`.th-sort`/`.row-open`/
`.row-actions`, `.checkbox`, `.pill` and `House.empty`, with their layout in
`styles/project.css`; then the Properties page (2026-11-03): the house toolbar
and search, `.grid` of `.card`s with the archive-box icon, the §7 confirmation
and toast, Archived (N), `+ Add property`, `House.empty`, and "Load backup" in
place of the JSON "Restore"; then Listing details, Import a listing and Move
your local deals in? on the house dialog (2026-11-03), with labelled fields,
Cancel and the act in the footer, and errors under the field; then Sign-in
(2026-11-03), with labels above the fields, errors under them and the house
link and button; and every toast, now `House.toast` at the bottom of the
screen, red for an error, worded past tense ("*Name* archived.").
Then the dashboard's icons and cut-off labels (2026-11-03): the lock is the house
padlock, Undo and Redo are words, Listing details is "Details" and Photos the
camera with the word; no label or name is cut with an ellipsis any more (they
wrap, and four KPI notes are shorter); a KPI's formula is reached through its
label, a native button, instead of a focusable tile.

| Screen | Group (design.md) | What breaks | File |
|---|---|---|---|
| Property dashboard | Principles §1 | the deal's name in the top bar is an editable field 170px wide, so a long name scrolls inside it instead of wrapping | `styles/legacy.css`, `js/app.js` |
| Property dashboard | Cards §5, Buttons §4 | its own compact card, button and field classes (`legacy-card`, `.photos-btn`, `.dash-lock-btn`, `.topbar__action`, 26px fields) instead of the house `.card`, `.btn` and 44px targets | `js/views/dashboard.js`, `styles/legacy.css` |
| Property dashboard | Forms §12 | the grids (tenants, loans) are labelled by their headers and save on commit like a spreadsheet, but show no brief "Saved" beside the cell | `js/views/dashboard.js` |
| Photos gallery | Dialogs §10 | its own modal; "Done"; × removes a saved photo | `js/views/dashboard-media.js` |
| Photos gallery | Upload §13 | URLs pasted in a textarea | `js/views/dashboard-media.js` |
