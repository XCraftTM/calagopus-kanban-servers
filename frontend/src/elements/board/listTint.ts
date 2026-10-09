import type { CSSProperties } from 'react';
import { colorToCss, type ListColorValue } from '../../lib/constants.ts';

// Lists without a color keep the panel's surface colors; colored lists mix a little of their color into
// the background and border. The color comes in through --kanban-list-accent so presets keep following
// the light/dark palette.
export const plainListClasses =
  'bg-(--mantine-color-dark-7) light:bg-(--mantine-color-gray-1)! border-(--mantine-color-default-border)';

export const tintedListClasses =
  'bg-[color-mix(in_srgb,var(--kanban-list-accent)_10%,var(--mantine-color-dark-7))] light:bg-[color-mix(in_srgb,var(--kanban-list-accent)_12%,var(--mantine-color-gray-1))]! border-[color-mix(in_srgb,var(--kanban-list-accent)_40%,var(--mantine-color-default-border))]';

export const plainListHoverClasses = 'hover:bg-(--mantine-color-dark-6) light:hover:bg-(--mantine-color-gray-2)!';

export const tintedListHoverClasses =
  'hover:bg-[color-mix(in_srgb,var(--kanban-list-accent)_16%,var(--mantine-color-dark-7))] light:hover:bg-[color-mix(in_srgb,var(--kanban-list-accent)_20%,var(--mantine-color-gray-1))]!';

export function listTintStyle(color: ListColorValue | null): CSSProperties | undefined {
  return color ? ({ '--kanban-list-accent': colorToCss(color) } as CSSProperties) : undefined;
}
