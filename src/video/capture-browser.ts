import type { Page } from "playwright-core";
import { launchChrome, siteContextOptions } from "../browser/chrome.ts";
import { requireSession } from "../browser/sessions.ts";
import type { Size } from "./geometry.ts";
import { overlayScript } from "./overlay/index.ts";

/** Popups are shown at this scale inside their window, so they fit the video. */
export const popupScale = 0.8;

/**
 * Headless Chrome that shows the site at `viewport` (CSS pixels) and paints it with
 * `captureScale` times more pixels, so the video stays sharp when the camera zooms.
 */
export async function launchCaptureBrowser(options: {
  viewport: Size;
  captureScale: number;
  session?: string;
}) {
  const storageState = options.session
    ? requireSession(options.session)
    : undefined;

  const { viewport, captureScale } = options;

  const browser = await launchChrome({
    args: [
      `--window-size=${viewport.width},${viewport.height}`,
      `--force-device-scale-factor=${captureScale}`,
      "--hide-scrollbars",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });

  const context = await browser.newContext({
    ...(await siteContextOptions(browser, storageState)),
    viewport: null,
  });

  await context.addInitScript(
    overlayScript({ popupCursorScale: 1 / popupScale }),
  );

  const page = await context.newPage();
  const cdp = await emulateViewport(page, viewport);

  return { browser, context, page, cdp };
}

/** Sets the page's size in CSS pixels, keeping the window's scale factor. */
export async function emulateViewport(page: Page, size: Size) {
  const session = await page.context().newCDPSession(page);

  await session.send("Emulation.setDeviceMetricsOverride", {
    ...size,
    deviceScaleFactor: 0,
    mobile: false,
  });

  return session;
}
