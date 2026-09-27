import { pageScript } from "../../browser/page-script.ts";
import { coveredArea, createCaptions, progressDots } from "./caption.ts";
import { createCursor } from "./cursor.ts";
import { createKeyBadge } from "./keys.ts";
import { createPopupWindow } from "./popup-window.ts";
import { scrollToElement } from "./scroll.ts";
import { forceStyle } from "./style.ts";

export type { CaptionOptions, DemoOverlay } from "./types.ts";

type OverlayOptions = {
  /** Popups are shown smaller in the video, so their cursor is drawn bigger. */
  popupCursorScale: number;
};

/**
 * Runs in every page of the recording and sets up `window.__demoOverlay`: the
 * cursor, key badges, popup windows and captions drawn over the site.
 */
function installPageOverlay(options: OverlayOptions) {
  if (window.top !== window) return;

  const scale = window.opener ? options.popupCursorScale : 1;
  const cursor = createCursor(scale);
  const popupWindow = createPopupWindow(cursor.hide);
  const captions = createCaptions();

  // A popup keeps the size its page asked for, inside the drawn window.
  const openWindow = window.open.bind(window);
  window.open = (url, target, features) => {
    window.__demoOverlay.popupSize = {
      width: Number(features?.match(/width=(\d+)/)?.[1]) || 600,
      height: Number(features?.match(/height=(\d+)/)?.[1]) || 700,
    };
    return openWindow(url, target, features);
  };

  window.__demoOverlay = {
    popupSize: { width: 600, height: 700 },
    move: cursor.move,
    press: cursor.press,
    keys: createKeyBadge(scale),
    openWindow: popupWindow.open,
    closeWindow: popupWindow.close,
    caption: captions.show,
    clearCaption: captions.clear,
    scrollToElement,
  };
}

export const overlayScript = (options: OverlayOptions) =>
  pageScript(
    installPageOverlay,
    [
      forceStyle,
      createCursor,
      createKeyBadge,
      createPopupWindow,
      createCaptions,
      progressDots,
      coveredArea,
      scrollToElement,
    ],
    options,
  );
