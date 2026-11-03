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
Cancel and the act in the footer, and errors under the field.

| Screen | Group (design.md) | What breaks | File |
|---|---|---|---|
| Property dashboard | Icons §3 | 🔒/🔓, ↶/↷ and 🏷 used as action icons | `js/views/dashboard.js`, `js/app.js` |
| Property dashboard | Principles §1 | labels and names truncated with an ellipsis in 13 rules | `styles/legacy.css` |
| Property dashboard | Cards §5, Buttons §4 | its own card and button classes; KPI tiles are `div tabindex=0` | `js/views/dashboard.js` |
| Property dashboard | Forms §12 | grid inputs have no visible label | `js/views/dashboard.js` |
| Photos gallery | Dialogs §10 | its own modal; "Done"; × removes a saved photo | `js/views/dashboard-media.js` |
| Photos gallery | Upload §13 | URLs pasted in a textarea | `js/views/dashboard-media.js` |
| Sign-in | Forms §12 | the placeholder is the label | `js/account.js` |
| Toast | Messages §18 | shown at the top, by this project's own toast, not `House.toast` | `js/dom.js`, `js/app.js` |
