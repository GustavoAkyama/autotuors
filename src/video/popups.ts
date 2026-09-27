import type { Page } from "playwright-core";
import { emulateViewport, popupScale } from "./capture-browser.ts";
import {
  clamp,
  scaleSize,
  type Point,
  type Rect,
  type Size,
} from "./geometry.ts";
import { startScreencast } from "./screencast.ts";

/**
 * Starts recording a popup that just opened and draws a browser window for it on
 * the opener. The video lays the popup's frames over that window.
 */
export async function recordPopup(
  opener: Page,
  popup: Page,
  options: { host?: string; dir: string; captureScale: number },
) {
  if (!options.host && !/^https?:/.test(popup.url()))
    await popup.waitForURL(/^https?:/, { timeout: 5000 }).catch(() => {});
  const address = options.host ?? new URL(popup.url()).host;
  const size = await opener.evaluate(() => window.__demoOverlay.popupSize);
  const session = await emulateViewport(popup, size);

  const [cast, rect] = await Promise.all([
    startScreencast(
      popup,
      session,
      options.dir,
      scaleSize(size, options.captureScale),
    ),
    opener.evaluate(
      ([address, width, height]) =>
        window.__demoOverlay.openWindow(address, width, height),
      [address, size.width * popupScale, size.height * popupScale] as const,
    ),
  ]);
  return { clip: { cast, rect }, size };
}

/** Where a point of the opener falls inside the popup, kept off its edges. */
export const intoPopup = (point: Point, rect: Rect, size: Size): Point => ({
  x: clamp((point.x - rect.x) / popupScale, 24, size.width - 24),
  y: clamp((point.y - rect.y) / popupScale, 24, size.height - 24),
});

/** Where a point of the popup falls on the opener. */
export const outOfPopup = (point: Point, rect: Rect): Point => ({
  x: rect.x + point.x * popupScale,
  y: rect.y + point.y * popupScale,
});
