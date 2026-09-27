// Runs inside the recorded page (see browser/page-script.ts).
import type { Rect } from "../geometry.ts";
import { forceStyle } from "./style.ts";

/**
 * A browser window drawn over the page for a popup (OAuth, checkout). The popup's
 * own recording is laid over its content area when the video is composed.
 */
export function createPopupWindow(hideCursor: () => void) {
  let elements: HTMLElement[] = [];

  return {
    open(host: string, width: number, height: number): Rect {
      const titleHeight = 38;
      const backdrop = document.createElement("div");
      forceStyle(backdrop, {
        position: "fixed",
        inset: "0",
        background: "rgba(20, 16, 24, 0.32)",
        "z-index": "2147483000",
        "pointer-events": "none",
      });
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });

      const frame = document.createElement("div");
      forceStyle(frame, {
        position: "fixed",
        left: `${Math.round((innerWidth - width) / 2)}px`,
        top: `${Math.round((innerHeight - height - titleHeight) / 2)}px`,
        width: `${width}px`,
        "border-radius": "12px 12px 0 0",
        overflow: "hidden",
        background: "#ffffff",
        "box-shadow":
          "0 28px 70px -16px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.1)",
        "z-index": "2147483001",
        "pointer-events": "none",
      });

      const titleBar = document.createElement("div");
      forceStyle(titleBar, {
        height: `${titleHeight}px`,
        display: "flex",
        "align-items": "center",
        gap: "8px",
        padding: "0 14px",
        background: "#f1f2f4",
        "border-bottom": "1px solid #dcdde1",
        color: "#3c4043",
        font: "500 13px system-ui, sans-serif",
      });
      const svgNs = "http://www.w3.org/2000/svg";
      const lock = document.createElementNS(svgNs, "svg");
      lock.setAttribute("viewBox", "0 0 24 24");
      lock.setAttribute("width", "14");
      lock.setAttribute("height", "14");
      const lockPath = document.createElementNS(svgNs, "path");
      lockPath.setAttribute(
        "d",
        "M7 10V7a5 5 0 0 1 10 0v3h1.5v11h-13V10Zm2 0h6V7a3 3 0 0 0-6 0Z",
      );
      lockPath.setAttribute("fill", "#5f6368");
      lock.append(lockPath);
      const address = document.createElement("span");
      address.textContent = host;
      titleBar.append(lock, address);

      const content = document.createElement("div");
      forceStyle(content, {
        width: `${width}px`,
        height: `${height}px`,
        background: "#ffffff",
      });

      frame.append(titleBar, content);
      document.documentElement.append(backdrop, frame);
      elements = [backdrop, frame];
      // The popup's recording shows its own cursor.
      hideCursor();

      const rect = content.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    },

    close() {
      for (const element of elements) element.remove();
      elements = [];
    },
  };
}
