import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Tooltip } from '@mantine/core';
import classNames from 'classnames';
import { ReactNode } from 'react';

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
      {/* centred on the cap height rather than the line box, so the text lines up with the icon in any font;
          the padding/negative margin pair keeps descenders and accents inside the clipping box */}
      <span className='relative truncate py-[0.3em] -my-[0.3em] [text-box:trim-both_cap_alphabetic]'>{children}</span>
    </span>
  );

  // Mantine's Tooltip attaches to the chip itself; the panel's Tooltip element wraps it in an inline-block
  // span, whose baseline nudged tooltip chips a fraction of a pixel off their neighbours
  return tooltip ? (
    <Tooltip label={tooltip} withinPortal>
      {chip}
    </Tooltip>
  ) : (
    chip
  );
}
