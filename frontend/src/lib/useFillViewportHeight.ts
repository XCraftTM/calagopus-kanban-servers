import { RefObject, useLayoutEffect } from 'react';

const MIN_HEIGHT = 384;

// Sizes the element so it reaches down to the bottom of the window, leaving room for whatever still
// follows it on the page (the footer). The board's horizontal scrollbar then always sits at the bottom
// of the screen, however short the lists are. Below MIN_HEIGHT the page scrolls instead.
export function useFillViewportHeight(ref: RefObject<HTMLElement | null>, active: boolean) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!active || !element) return;

    const apply = (height: number) => {
      const value = `${Math.max(MIN_HEIGHT, Math.floor(height))}px`;
      if (element.style.height !== value) element.style.height = value;
    };

    const fit = () => {
      const page = document.scrollingElement ?? document.documentElement;
      const top = element.getBoundingClientRect().top + window.scrollY;

      apply(window.innerHeight - top);

      // anything after the board (margins, footer) pushes the page past the window: take that back off
      const overflow = page.scrollHeight - window.innerHeight;
      if (overflow > 0) apply(window.innerHeight - top - overflow);
    };

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };

    fit();
    window.addEventListener('resize', schedule);
    // content above the board can change height too (filters wrapping, announcements, theme headers)
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      element.style.height = '';
    };
  }, [ref, active]);
}
