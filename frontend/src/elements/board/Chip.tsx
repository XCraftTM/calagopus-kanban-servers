import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { ReactNode } from 'react';
import Tooltip from '@/elements/overlays/Tooltip.tsx';

// A small Trello-style label. `color` is a Mantine color name; `percent` draws a usage fill behind the text.
export default function Chip({
  icon,
  color = 'gray',
  tooltip,
  percent,
  dot,
  className,
  children,
}: {
  icon?: IconDefinition;
  color?: string;
  tooltip?: ReactNode;
  percent?: number | null;
  dot?: string;
  className?: string;
  children?: ReactNode;
}) {
  const filled = typeof percent === 'number';

  const chip = (
    <span
      className={classNames(
        'relative inline-flex items-center gap-1 h-5 px-1.5 rounded-[4px] text-[11px] font-semibold leading-none',
        'whitespace-nowrap overflow-hidden max-w-full select-none',
        className,
      )}
      style={{
        backgroundColor: filled ? 'var(--mantine-color-default-hover)' : `var(--mantine-color-${color}-light)`,
        color: filled && color === 'gray' ? 'var(--mantine-color-text)' : `var(--mantine-color-${color}-light-color)`,
      }}
    >
      {filled && (
        <span
          aria-hidden
          className='absolute inset-y-0 left-0 transition-[width] duration-500'
          style={{
            width: `${Math.min(Math.max(percent, 0), 100)}%`,
            backgroundColor: `var(--mantine-color-${color}-light)`,
          }}
        />
      )}
      {dot && <span aria-hidden className='relative size-1.5 rounded-full shrink-0' style={{ backgroundColor: dot }} />}
      {icon && <FontAwesomeIcon icon={icon} className='relative text-[10px] shrink-0 opacity-80' />}
      <span className='relative truncate'>{children}</span>
    </span>
  );

  return tooltip ? (
    <Tooltip label={tooltip} withinPortal>
      {chip}
    </Tooltip>
  ) : (
    chip
  );
}
