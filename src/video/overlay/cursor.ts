// Runs inside the recorded page (see browser/page-script.ts).
import type { Point } from "../geometry.ts";
import { forceStyle } from "./style.ts";

/** The animated mouse pointer drawn on the page, with a ripple on each click. */
export function createCursor(scale: number) {
  const svgNs = "http://www.w3.org/2000/svg";
  const cursor = document.createElement("div");
  forceStyle(cursor, {
    position: "fixed",
    left: "0",
    top: "0",
    "z-index": "2147483647",
    "pointer-events": "none",
    opacity: "0",
    transform: "translate(-100px, -100px)",
  });
  const arrow = document.createElementNS(svgNs, "svg");
  const arrowSize = 26 * scale;
  arrow.setAttribute("viewBox", "0 0 24 24");
  arrow.setAttribute("width", String(arrowSize));
  arrow.setAttribute("height", String(arrowSize));
  forceStyle(arrow, {
    position: "absolute",
    left: `${-4 * scale}px`,
    top: `${-2.5 * scale}px`,
    overflow: "visible",
    filter: "drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35))",
    "transform-origin": "4px 2px",
    transition: "transform 120ms ease-out",
  });
  const path = document.createElementNS(svgNs, "path");
  path.setAttribute("d", "M4 2.5v17.2l4.6-4.4 3.2 7.2 3-1.3-3.1-7h6.5Z");
  path.setAttribute("fill", "#ffffff");
  path.setAttribute("stroke", "#15151b");
  path.setAttribute("stroke-width", "1.4");
  path.setAttribute("stroke-linejoin", "round");
  arrow.append(path);
  cursor.append(arrow);

  // A same-origin popup replaces its first document (about:blank) without running
  // this script again, so always mount into whatever `document` is now.
  const observer = new MutationObserver(() => mount());
  let observed: Document | null = null;
  const mount = () => {
    if (observed !== document) {
      observer.observe(document, { childList: true, subtree: true });
      observed = document;
    }
    if (
      document.documentElement &&
      cursor.parentNode !== document.documentElement
    )
      document.documentElement.append(cursor);
  };
  mount();

  const place = ({ x, y }: Point) =>
    forceStyle(cursor, { transform: `translate(${x}px, ${y}px)` });

  return {
    move(from: Point, to: Point, duration: number) {
      mount();
      forceStyle(cursor, { transition: "none", opacity: "1" });
      place(from);
      // Applies the jump to `from` before the transition starts.
      cursor.getBoundingClientRect();
      forceStyle(cursor, {
        transition: `transform ${duration}ms cubic-bezier(0.45, 0, 0.2, 1)`,
      });
      place(to);
    },

    press() {
      mount();
      forceStyle(arrow, { transform: "scale(0.82)" });
      setTimeout(() => forceStyle(arrow, { transform: "scale(1)" }), 140);
      const ripple = document.createElement("div");
      const size = 38 * scale;
      forceStyle(ripple, {
        position: "absolute",
        left: `${-size / 2}px`,
        top: `${-size / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
        "border-radius": "50%",
        border: "2.5px solid rgba(37, 99, 235, 0.85)",
        background: "rgba(37, 99, 235, 0.18)",
      });
      cursor.prepend(ripple);
      ripple
        .animate(
          [
            { transform: "scale(0.3)", opacity: 1 },
            { transform: "scale(1.25)", opacity: 0 },
          ],
          { duration: 520, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
        )
        .finished.then(() => ripple.remove());
    },

    hide() {
      forceStyle(cursor, { opacity: "0" });
    },
  };
}
