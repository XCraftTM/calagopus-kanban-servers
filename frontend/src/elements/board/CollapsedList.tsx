import { faAnglesRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { ComponentProps } from 'react';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import type { ListColor } from '../../lib/constants.ts';
import type { ServerGroup } from '../../lib/useBoardActions.ts';
import { useExtTranslations } from '../../translations.ts';

// Trello's collapsed list: a slim vertical bar that still accepts dropped cards.
export default function CollapsedList({
  group,
  count,
  color,
  isDropTarget,
  onExpand,
  dragHandleProps,
}: {
  group: ServerGroup;
  count: number;
  color: ListColor | null;
  isDropTarget: boolean;
  onExpand: () => void;
  dragHandleProps?: ComponentProps<'div'>;
}) {
  const { t: tExt } = useExtTranslations();

  return (
    <div
      {...dragHandleProps}
      className={classNames(
        'kanban-list-collapsed relative flex w-11 flex-col items-center gap-2 overflow-hidden rounded-xl border py-2',
        'max-h-[calc(100dvh-15rem)] min-h-40',
        'bg-(--mantine-color-dark-7) light:bg-(--mantine-color-gray-1)! border-(--mantine-color-default-border)',
        'transition-colors hover:bg-(--mantine-color-dark-6) light:hover:bg-(--mantine-color-gray-2)!',
        isDropTarget && 'ring-2 ring-(--mantine-color-blue-filled)',
      )}
      style={{ ...dragHandleProps?.style }}
    >
      {color && (
        <div
          aria-hidden
          className='absolute inset-x-0 top-0 h-1.5'
          style={{ backgroundColor: `var(--mantine-color-${color}-filled)` }}
        />
      )}
      <Tooltip label={tExt('board.list.menu.expand', {})} position='right'>
        <button
          type='button'
          onClick={onExpand}
          className='mt-1 flex size-7 items-center justify-center rounded-md text-(--mantine-color-dimmed) hover:bg-(--mantine-color-default-hover) hover:text-(--mantine-color-text)'
        >
          <FontAwesomeIcon icon={faAnglesRight} className='text-xs' />
        </button>
      </Tooltip>
      <span className='rounded-full bg-(--mantine-color-default-hover) px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-(--mantine-color-dimmed)'>
        {count}
      </span>
      <button
        type='button'
        onClick={onExpand}
        className='min-h-0 flex-1 text-sm font-semibold [writing-mode:vertical-rl] truncate'
      >
        {group.name}
      </button>
    </div>
  );
}
