// Runs inside the recorded page (see browser/page-script.ts).
import type { Rect } from "../geometry.ts";
import { forceStyle } from "./style.ts";
import type { CaptionOptions, PopoverDom } from "./types.ts";

/**
 * Numbered captions drawn with driver.js, next to an element (with a ring around
 * it) or centered. One caption at a time.
 */
export function createCaptions() {
  let lastPointerDown = 0;
  addEventListener(
    "pointerdown",
    () => (lastPointerDown = performance.now()),
    true,
  );
  let active: { leave: () => void; destroy: () => void } | null = null;
  let leaving: (() => void) | null = null;

  function clear(immediate = false) {
    const current = active;
    active = null;
    leaving?.();
    leaving = null;
    if (!current) return;
    if (immediate) return current.destroy();

    current.leave();
    leaving = current.destroy;
    setTimeout(() => {
      if (leaving !== current.destroy) return;
      current.destroy();
      leaving = null;
    }, 200);
  }

  function show(
    element: Element | null,
    options: CaptionOptions,
  ): Promise<Rect | null> {
    clear(true);

    // Focus would open dropdowns or show focus rings in the video; a real click
    // (within 500ms of a press) still focuses.
    const preventFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if (performance.now() - lastPointerDown < 500) return;
      if (element?.contains(target) || target.closest(".driver-popover"))
        target.blur();
    };

    document.addEventListener("focusin", preventFocus, true);

    if (!document.getElementById("demo-caption-style")) {
      const style = document.createElement("style");
      style.id = "demo-caption-style";
      style.textContent = ".driver-overlay{display:none!important}";
      document.head.append(style);
    }

    const instance = window.driver.js.driver({
      popoverClass: "tour-caption",
      overlayOpacity: 0,
      stagePadding: 6,
      stageRadius: 10,
      popoverOffset: 16,
      allowClose: false,
      allowKeyboardControl: false,
      onPopoverRender: (popover: PopoverDom) => {
        popover.footer.style.display = "flex";
        popover.footerButtons.style.display = "none";
        popover.progress.style.display = "flex";
        popover.progress.replaceChildren(
          ...progressDots(options.total, options.step),
        );
      },
    });
    instance.highlight({
      element: element ?? undefined,
      popover: {
        title: options.title,
        description: options.description,
        side: options.side,
        align: options.align,
      },
    });
    document.body.classList.remove("driver-active");
    const popover = document.querySelector<HTMLElement>(
      ".driver-popover.tour-caption",
    );

    let frame = 0;
    const ring = document.createElement("div");
    const leave = () => {
      popover?.classList.add("is-leaving");
      ring.classList.add("is-leaving");
    };
    if (element) {
      const padding = 6;
      let previous = "";
      if (options.ring) {
        ring.className = "tour-ring is-visible";
        forceStyle(ring, { "pointer-events": "none" });
        document.body.append(ring);
      }
      // Keeps the ring and the caption on the element while it moves.
      const follow = () => {
        // The element went away (e.g. a modal closed after the click): fade out
        // instead of pointing at nothing.
        if (!element.isConnected) return leave();
        const rect = element.getBoundingClientRect();
        const next = `${rect.x},${rect.y},${rect.width},${rect.height}`;
        if (next !== previous) {
          if (previous) instance.refresh();
          previous = next;
          ring.style.transform = `translate(${rect.x - padding}px, ${rect.y - padding}px)`;
          ring.style.width = `${rect.width + padding * 2}px`;
          ring.style.height = `${rect.height + padding * 2}px`;
        }
        frame = requestAnimationFrame(follow);
      };
      follow();
    }

    let destroyed = false;
    active = {
      leave,
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        cancelAnimationFrame(frame);
        ring.remove();
        instance.destroy();
        document.removeEventListener("focusin", preventFocus, true);
      },
    };

    // Measured after the popover's first frames, once it's in place.
    return new Promise((resolve) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => resolve(coveredArea([popover, element]))),
      );
    });
  }

  return { show, clear };
}

/** The progress dots under a caption, the current step highlighted. */
export function progressDots(total: number, step: number) {
  const counter = document.createElement("span");
  counter.className = "tour-step-count";
  counter.textContent = `${step} de ${total}`;
  const bar = document.createElement("span");
  bar.className = "tour-step-bar";
  bar.append(
    ...Array.from({ length: total }, (_, index) => {
      const segment = document.createElement("i");
      if (index < step - 1) segment.className = "is-done";
      if (index === step - 1) segment.className = "is-active";
      return segment;
    }),
  );
  return [counter, bar];
}

/** The smallest box around the elements still on the page. */
export function coveredArea(elements: (Element | null)[]): Rect | null {
  const boxes = elements
    .filter((item) => item?.isConnected)
    .map((item) => item!.getBoundingClientRect());

  if (!boxes.length) return null;

  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.right));
  const bottom = Math.max(...boxes.map((box) => box.bottom));

  return { x: left, y: top, width: right - left, height: bottom - top };
}
