import type { Page } from "playwright-core";
import { fromRoot } from "../paths.ts";
import { targetOf, type Step } from "../script/types.ts";
import type { Demo } from "../video/demo.ts";
import { sleep } from "../video/time.ts";
import { findTarget, type Warn } from "./find-target.ts";

/** Pages of the tour by name: "main", plus each popup a click opened. */
export type Pages = Map<string, Page>;

/** Plays one step: finds its target, shows its caption, then does its action. */
export async function runStep(
  demo: Demo,
  pages: Pages,
  step: Step,
  name: string,
  warn: Warn,
) {
  if (step.action === "wait") return sleep(step.ms);
  if (step.action === "goto") {
    if (step.caption) await demo.caption(null, step.caption);
    await demo.goto(step.url);
    return;
  }

  const page = pages.get(step.page ?? "main");

  if (!page)
    throw new Error(
      `a página "${step.page}" não foi aberta por nenhum passo anterior`,
    );

  if (step.action === "close") {
    // Popups often close themselves (e.g. after an OAuth consent).
    if (!page.isClosed())
      await page
        .waitForEvent("close", { timeout: 5000 })
        .catch(() => page.close());

    return;
  }

  const selector = targetOf(step);
  const target = selector
    ? await findTarget(page, { ...step, target: selector }, name, warn)
    : null;

  // Only optional steps come back without their target.
  if (selector && !target) {
    warn(`pulei um passo opcional porque o alvo não apareceu: ${selector}`);
    return;
  }

  if (step.caption) await demo.caption(target, step.caption);

  switch (step.action) {
    case "click":
      if (step.popup)
        pages.set(step.popup, await demo.clickOpeningPopup(target!, step.host));
      else
        await demo.click(target!, page, {
          button: step.button,
          clickCount: step.clickCount,
        });
      break;
    case "type":
      await demo.type(target!, step.text, page);
      break;
    case "press":
      await demo.press(step.key, page);
      break;
    case "select":
      await demo.select(target!, step.values, page);
      break;
    case "check":
    case "uncheck":
      await demo.check(target!, step.action === "check", page);
      break;
    case "hover":
      await demo.hover(target!, page);
      break;
    case "upload":
      await demo.upload(target!, step.files.map(fromRoot), page);
      break;
  }

  if (step.caption && step.action !== "caption") await demo.clearCaption();
}
