import type { Point, Rect, Size } from "../geometry.ts";

export type CaptionOptions = {
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  step: number;
  total: number;
  ring: boolean;
};

/** What the page overlay offers the recorder, at `window.__demoOverlay`. */
export type DemoOverlay = {
  /** Size the page asked for in its last `window.open`. */
  popupSize: Size;
  move: (from: Point, to: Point, duration: number) => void;
  press: () => void;
  keys: (keys: string[]) => void;
  /** Draws a browser window for a popup; returns where its content goes. */
  openWindow: (host: string, width: number, height: number) => Rect;
  closeWindow: () => void;
  /** Resolves with the area covered by the caption and its element. */
  caption: (
    element: Element | null,
    options: CaptionOptions,
  ) => Promise<Rect | null>;
  clearCaption: (immediate?: boolean) => void;
  scrollToElement: (element: Element) => Promise<void>;
};

export type DriverInstance = {
  highlight: (step: object) => void;
  refresh: () => void;
  destroy: () => void;
};

export type PopoverDom = {
  footer: HTMLElement;
  footerButtons: HTMLElement;
  progress: HTMLElement;
};

declare global {
  interface Window {
    __demoOverlay: DemoOverlay;
    /** driver.js, added to the page before the first caption. */
    driver: { js: { driver: (config: object) => DriverInstance } };
  }
}
