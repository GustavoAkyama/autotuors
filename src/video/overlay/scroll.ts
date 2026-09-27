// Runs inside the recorded page (see browser/page-script.ts).

/**
 * Scrolls the element's scrolling container (or the page) smoothly until the
 * element is comfortably in view, below a possible fixed header.
 */
export function scrollToElement(element: Element): Promise<void> {
  let container = element.parentElement;
  while (container) {
    const { overflowY } = getComputedStyle(container);
    if (
      /(auto|scroll)/.test(overflowY) &&
      container.scrollHeight > container.clientHeight
    )
      break;
    container = container.parentElement;
  }
  const scroller = container ?? document.scrollingElement!;
  const bounds = container
    ? container.getBoundingClientRect()
    : { top: 0, bottom: innerHeight };
  const rect = element.getBoundingClientRect();
  const top = Math.max(bounds.top, 64);
  const visibleHeight = bounds.bottom - top;
  if (rect.top >= top + 8 && rect.bottom <= bounds.bottom - 8)
    return Promise.resolve();

  const offset =
    rect.height > visibleHeight - 32
      ? rect.top - top - 24
      : rect.top + rect.height / 2 - (top + visibleHeight / 2);
  const from = scroller.scrollTop;
  const to = Math.max(
    0,
    Math.min(from + offset, scroller.scrollHeight - scroller.clientHeight),
  );
  const duration = Math.min(Math.max(Math.abs(to - from) * 0.9, 350), 800);
  const started = performance.now();

  return new Promise((resolve) => {
    const step = (now: number) => {
      const progress = Math.min((now - started) / duration, 1);
      const eased =
        progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      scroller.scrollTop = from + (to - from) * eased;
      if (progress < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}
