// Runs inside the recorded page (see browser/page-script.ts).
import { forceStyle } from "./style.ts";

/** Shows the keys of a shortcut ("Ctrl" + "K") for a moment, next to the focused field. */
export function createKeyBadge(scale: number) {
  let current: HTMLElement | null = null;

  return function showKeys(keys: string[]) {
    current?.remove();
    const badge = document.createElement("div");
    current = badge;
    forceStyle(badge, {
      position: "fixed",
      left: "0",
      top: "0",
      display: "flex",
      "align-items": "center",
      gap: `${8 * scale}px`,
      padding: `${10 * scale}px ${14 * scale}px`,
      "border-radius": `${14 * scale}px`,
      background: "rgba(21, 21, 27, 0.86)",
      "box-shadow": "0 12px 32px -8px rgba(0, 0, 0, 0.45)",
      color: "#ffffff",
      font: `600 ${18 * scale}px/1 system-ui, sans-serif`,
      "z-index": "2147483647",
      "pointer-events": "none",
    });
    keys.forEach((key, index) => {
      if (index > 0) badge.append("+");
      const cap = document.createElement("span");
      forceStyle(cap, {
        padding: `${7 * scale}px ${11 * scale}px`,
        "border-radius": `${8 * scale}px`,
        background: "rgba(255, 255, 255, 0.14)",
        border: "1px solid rgba(255, 255, 255, 0.22)",
        "min-width": "1.2em",
        "text-align": "center",
      });
      cap.textContent = key;
      badge.append(cap);
    });
    document.documentElement.append(badge);

    // Next to the focused field, where the camera is looking; bottom center otherwise.
    const active = document.activeElement;
    const anchor =
      active && active !== document.body && active !== document.documentElement
        ? active.getBoundingClientRect()
        : null;
    const gap = 14 * scale;
    let left = (innerWidth - badge.offsetWidth) / 2;
    let top = innerHeight - badge.offsetHeight - 40 * scale;
    if (anchor) {
      left = anchor.left + (anchor.width - badge.offsetWidth) / 2;
      top =
        anchor.bottom + gap + badge.offsetHeight <= innerHeight
          ? anchor.bottom + gap
          : anchor.top - gap - badge.offsetHeight;
    }
    forceStyle(badge, {
      left: `${Math.min(Math.max(left, 8), innerWidth - badge.offsetWidth - 8)}px`,
      top: `${Math.min(Math.max(top, 8), innerHeight - badge.offsetHeight - 8)}px`,
    });

    const hidden = { opacity: 0, transform: "translateY(12px) scale(0.96)" };
    const shown = { opacity: 1, transform: "none" };
    badge.animate([hidden, shown], {
      duration: 200,
      easing: "cubic-bezier(0.2, 0.7, 0.3, 1)",
    });
    setTimeout(() => {
      badge
        .animate([shown, hidden], {
          duration: 220,
          easing: "ease-in",
          fill: "forwards",
        })
        .finished.then(() => badge.remove());
    }, 1150);
  };
}
