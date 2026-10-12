import { z } from 'zod';

export const PACKAGE_NAME = 'dev.xcrafttm.kanbanservers';

// the core API limits a group to 100 servers and a page to 100 items, so one page holds a whole list
export const MAX_SERVERS_PER_GROUP = 100;
export const GROUP_NAME_MIN = 2;
export const GROUP_NAME_MAX = 31;

export const UNGROUPED_ID = 'ungrouped';

export const queryKeys = {
  all: ['extensions', PACKAGE_NAME] as const,
  groupServers: (groupUuid: string) => ['extensions', PACKAGE_NAME, 'group', groupUuid] as const,
  ungrouped: () => ['extensions', PACKAGE_NAME, 'ungrouped'] as const,
  config: () => ['extensions', PACKAGE_NAME, 'config'] as const,
};

export const viewSchema = z.enum(['board', 'list']);
export type BoardView = z.infer<typeof viewSchema>;

export const statusFilterSchema = z.enum(['all', 'running', 'offline']);
export type StatusFilter = z.infer<typeof statusFilterSchema>;

export const listColors = [
  'blue',
  'cyan',
  'teal',
  'green',
  'lime',
  'yellow',
  'orange',
  'red',
  'pink',
  'grape',
  'violet',
] as const;
export const listColorSchema = z.enum(listColors);
export type ListColor = z.infer<typeof listColorSchema>;

// a list color is either a preset (follows the light/dark palette) or any custom hex color
export const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
export const listColorValueSchema = z.union([listColorSchema, hexColorSchema]);
export type ListColorValue = z.infer<typeof listColorValueSchema>;

export const isPresetColor = (color: string): color is ListColor => (listColors as readonly string[]).includes(color);

export const colorToCss = (color: ListColorValue) =>
  isPresetColor(color) ? `var(--mantine-color-${color}-filled)` : color;

export const settingKeys = {
  view: `${PACKAGE_NAME}::view`,
  collapsed: `${PACKAGE_NAME}::collapsed`,
  colors: `${PACKAGE_NAME}::colors`,
  showUngrouped: `${PACKAGE_NAME}::show_ungrouped`,
  // lists that sit below the previous list in the same column (only used while stacking is allowed)
  stacked: `${PACKAGE_NAME}::stacked`,
};
