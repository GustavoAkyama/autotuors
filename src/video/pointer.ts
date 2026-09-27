import type { Page } from "playwright-core";
import type { Point } from "./geometry.ts";
import { sleep } from "./time.ts";

export type ClickOptions = {
  button?: "left" | "right" | "middle";
  clickCount?: number;
};

/** The drawn cursor of each page: glides like a hand would, then clicks for real. */
export class Pointer {
  private readonly positions = new Map<Page, Point>();

  positionOn(page: Page) {
    return this.positions.get(page);
  }

  /** Puts the cursor somewhere without animating it. */
  async place(page: Page, point: Point) {
    this.positions.set(page, point);
    await page.evaluate((value) => {
      window.__demoOverlay.move(value, value, 0);
    }, point);
  }

  /** Remembers where the cursor is, e.g. after the page drew it itself. */
  remember(page: Page, point: Point) {
    this.positions.set(page, point);
  }

  async moveTo(page: Page, target: Point) {
    const from = this.positions.get(page) ?? target;
    const distance = Math.hypot(target.x - from.x, target.y - from.y);
    const duration = Math.round(
      Math.min(Math.max(260 + distance * 0.38, 320), 760),
    );

    await page.evaluate(
      ([start, end, ms]) => window.__demoOverlay.move(start, end, ms),
      [from, target, duration] as const,
    );
    this.positions.set(page, target);
    await sleep(duration);
    await page.mouse.move(target.x, target.y);
  }

  /** Clicks where the cursor is, with the click ripple. */
  async tap(
    page: Page,
    { button = "left", clickCount = 1 }: ClickOptions = {},
  ) {
    await sleep(120);
    await page.evaluate(() => window.__demoOverlay.press());
    for (let count = 1; count <= clickCount; count++) {
      if (count > 1) await sleep(90);
      await page.mouse.down({ button, clickCount: count });
      await sleep(70);
      await page.mouse.up({ button, clickCount: count });
    }
    await sleep(320);
  }
}
