# Changelog

All notable changes to this extension are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.2.0] - 2026-10-12

### Added

- Admin settings page (Admin → Extensions → Kanban Servers → Configure) with a live preview:
  - **Gap between cards**, 0–32 px (default 8 px).
  - **Allow stacking lists** (off by default): users can drag a list onto another list to stack them in one
    column, or onto a column edge to give it its own column again. A blue line shows where it lands, stacked
    lists share the column height, and collapsed lists become a slim row inside a stack. The stacking is
    saved per user.
- Backend routes for the settings (`extensions.read` / `extensions.manage`, saves are written to the admin
  activity log) and a config route for the board.

### Fixed

- Chips on a card are aligned again: the address chip sat a fraction of a pixel off the egg chip, and the
  chip text sat higher than its icon depending on the font. The text is now centred on its cap height.

## [1.1.1] - 2026-10-09

### Fixed

- The board now fills the window down to the footer, so its horizontal scrollbar always sits at the bottom
  of the screen instead of under the tallest list. Lists still grow with their cards up to the board height
  and scroll inside when longer. On very small windows the board keeps a minimum height of 24rem.
- Dragging the empty space below a short list now scrolls the board sideways, like the space between lists.

## [1.1.0] - 2026-10-09

### Added

- Custom list colors: "Custom color..." in the list menu opens a color picker with the presets, a
  saturation/hue picker, a hex field and a live preview.
- Colored lists get a slight tint of their color in the background and border (also when collapsed), in
  light and dark mode.

### Fixed

- Themes that move the page tabs into their own toolbar (such as the qunix theme) no longer show the
  "Grouped Servers / All Servers" tabs twice.
- The Board/List toggle stays reachable when a theme hides the page header: it then sits at the right end
  of the board toolbar (and above the list view).
- Lists size themselves to the widest possible chip row in the font actually in use, so the chips stay on
  one line with wider fonts, such as the monospace font of the qunix theme.

## [1.0.0] - 2026-10-09

### Added

- Trello-style Kanban board for the **Grouped Servers** page: every server group is a list, every server a card.
- Drag cards between lists and reorder them within a list; drag list headers to reorder lists.
- Optional **Ungrouped** list with your servers that are in no group yet. Drop a card there to remove it from its list.
- Compact cards: status, CPU, memory and disk as chips with usage fill, plus name, description, address (click to
  copy), egg and a badge for servers owned by someone else.
- Card menu (right-click or `…`): power actions, move to list, also add to list, remove from list.
- List menu: add servers, rename (or click the title), select all, collapse, list color, power all, delete.
- "Add another list" column and an inline "Add a server" composer at the bottom of each list.
- Board filter by text (name, description, egg, node, address) and by running/offline state.
- Bulk selection and power actions like the stock page (checkbox, or hold `S` and click).
- Board/List toggle in the page header to switch back to the stock view at any time.
