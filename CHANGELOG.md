# Changelog

All notable changes to this extension are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
