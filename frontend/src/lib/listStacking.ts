// Stacked lists: the board is still one ordered row of groups (the core group order). A per-user flag marks
// a list as sitting below the previous list in the same column, so the stacking survives reordering
// and simply switches off when an admin disables the setting.

export type ListDropTarget =
  | { kind: 'column'; index: number } // a new column before column `index`
  | { kind: 'stack'; column: number; index: number }; // inside column `column`, before list `index`

export function buildColumns<T extends { uuid: string }>(
  groups: T[],
  stacked: Record<string, boolean>,
  enabled: boolean,
): T[][] {
  const columns: T[][] = [];

  for (const group of groups) {
    if (enabled && stacked[group.uuid] && columns.length > 0) {
      columns[columns.length - 1].push(group);
    } else {
      columns.push([group]);
    }
  }

  return columns;
}

const PLACEHOLDER = '\u0000kanban-drop';

export function applyListMove(columns: string[][], uuid: string, target: ListDropTarget): string[][] {
  // insert a placeholder first, then take the list out of its old spot; the indices of the target
  // therefore refer to the layout the user saw while dragging
  const next = columns.map((column) => [...column]);

  if (target.kind === 'column') {
    next.splice(Math.min(Math.max(target.index, 0), next.length), 0, [PLACEHOLDER]);
  } else {
    const column = next[target.column];
    if (!column) return columns;
    column.splice(Math.min(Math.max(target.index, 0), column.length), 0, PLACEHOLDER);
  }

  return next
    .map((column) => column.filter((id) => id !== uuid).map((id) => (id === PLACEHOLDER ? uuid : id)))
    .filter((column) => column.length > 0);
}

export function stackFlags(columns: string[][]): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const column of columns) {
    for (const uuid of column.slice(1)) flags[uuid] = true;
  }

  return flags;
}

export const sameTarget = (a: ListDropTarget | null, b: ListDropTarget | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.kind === b.kind &&
    a.index === b.index &&
    (a.kind === 'column' || (b.kind === 'stack' && a.column === b.column)));

// Where a list dragged to (x, y) would land. The outer quarter of a column on either side makes a new
// column next to it; the middle stacks the list above or below the list under the pointer.
export function hitTestListTarget(board: HTMLElement, x: number, y: number): ListDropTarget | null {
  const columns = [...board.querySelectorAll<HTMLElement>(':scope > [data-kanban-column]')];
  if (columns.length === 0) return null;

  for (const [index, column] of columns.entries()) {
    const rect = column.getBoundingClientRect();
    if (x < rect.left || x > rect.right) continue;

    const edge = rect.width * 0.25;
    if (x < rect.left + edge) return { kind: 'column', index };
    if (x > rect.right - edge) return { kind: 'column', index: index + 1 };

    const lists = [...column.querySelectorAll<HTMLElement>(':scope > [data-kanban-stack-item]')];
    const before = lists.filter((list) => {
      const listRect = list.getBoundingClientRect();
      return listRect.top + listRect.height / 2 < y;
    }).length;

    return { kind: 'stack', column: index, index: before };
  }

  const index = columns.filter((column) => {
    const rect = column.getBoundingClientRect();
    return rect.left + rect.width / 2 < x;
  }).length;

  return { kind: 'column', index };
}
