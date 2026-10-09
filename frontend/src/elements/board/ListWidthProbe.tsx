import { faHardDrive, faMemory, faMicrochip } from '@fortawesome/free-solid-svg-icons';
import { useLayoutEffect, useRef } from 'react';
import { compactBytes } from '../../lib/format.ts';
import { useExtTranslations } from '../../translations.ts';
import Chip from './Chip.tsx';

// 'unknown' is left out: that chip only shows while stats load, without the usage chips next to it
const statuses = ['running', 'starting', 'stopping', 'offline'] as const;
const sampleBytes = 1023 * 1024 * 1024;

// Renders the widest realistic chip row off-screen and reports its width, so lists are exactly wide
// enough for one row of chips in whatever font the panel (or a theme) uses.
export default function ListWidthProbe({ onWidth }: { onWidth: (width: number) => void }) {
  const { t: tExt } = useExtTranslations();
  const ref = useRef<HTMLDivElement>(null);

  const longestStatus = statuses
    .map((status) => tExt(`board.status.${status}`, {}))
    .reduce((longest, label) => (label.length > longest.length ? label : longest), '');

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    let active = true;
    const measure = () => {
      if (active) onWidth(Math.ceil(element.getBoundingClientRect().width));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // web fonts loading late (themes) change the width without resizing anything else
    document.fonts?.ready.then(measure).catch(() => null);

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [onWidth, longestStatus]);

  return (
    <div
      ref={ref}
      aria-hidden
      className='kanban-width-probe pointer-events-none invisible absolute top-0 left-0 flex w-max flex-nowrap gap-1'
    >
      <Chip color='orange' dot='currentColor'>
        {longestStatus}
      </Chip>
      <Chip icon={faMicrochip} percent={0}>
        999%
      </Chip>
      <Chip icon={faMemory} percent={0}>
        {compactBytes(sampleBytes)}
      </Chip>
      <Chip icon={faHardDrive} percent={0}>
        {compactBytes(sampleBytes)}
      </Chip>
    </div>
  );
}
