import type { BrowserContext, Page } from "playwright-core";
import { pageScript } from "../browser/page-script.ts";
import {
  trackerHelpers,
  trackInteractions,
} from "./page/track-interactions.ts";
import type { RecordedEntry } from "./playwright-recorder.ts";
import type { Interaction } from "./types.ts";

const outlineId = "__tour-highlight";
/** Shows the outline in step screenshots and hides the recorder's own overlay. */
const screenshotStyle = `#${outlineId} { visibility: visible !important; } x-pw-glass { display: none !important; }`;

/**
 * Collects, for each page, what the page script reports about the element behind
 * every interaction, with a screenshot of the moment.
 */
export async function trackPageInteractions(context: BrowserContext) {
  const interactions = new Map<Page, Interaction[]>();
  const pending: Promise<unknown>[] = [];
  const screenshot = (page: Page) =>
    page
      .screenshot({
        type: "jpeg",
        quality: 80,
        scale: "css",
        style: screenshotStyle,
      })
      .catch(() => undefined);
  // Screenshot taken when the pointer went down, for the click that follows.
  const snapshots = new Map<Page, Promise<Buffer | undefined>>();

  await context.exposeBinding("__tourSnapshot", ({ page }) => {
    const taken = screenshot(page);
    snapshots.set(page, taken);
    pending.push(taken);
  });

  await context.exposeBinding(
    "__tourInteraction",
    ({ page }, interaction: Interaction) => {
      interactions.set(page, [...(interactions.get(page) ?? []), interaction]);
      // Keys and typing have no press before them, so they are shot as they happen.
      const snapshot = interaction.detail ? snapshots.get(page) : undefined;

      snapshots.delete(page);

      const taken = snapshot ?? screenshot(page);
      const { url, title, region, transient, rect } = interaction;

      interaction.context = { url, title, region, transient, rect };
      pending.push(
        taken.then((image) => void (interaction.context!.screenshot = image)),
      );
    },
  );

  await context.addInitScript(
    pageScript(trackInteractions, trackerHelpers, outlineId),
  );

  return {
    interactions,
    /** Resolves once every screenshot taken so far is done. */
    settled: () => Promise.all(pending),
  };
}

const interactionTypes: Record<string, string> = {
  click: "click",
  check: "check",
  uncheck: "check",
  fill: "fill",
  select: "select",
  setInputFiles: "file",
  press: "press",
};

/**
 * Pairs each recorded action with the interaction that caused it, copying the
 * element's name, role and context. Both lists are in event order.
 */
export function attachInteractions(
  entries: RecordedEntry[],
  interactions: Map<Page, Interaction[]>,
) {
  const cursors = new Map<Page, number>();

  for (const { page, action } of entries) {
    const type = interactionTypes[action.name];
    const list = interactions.get(page);

    if (!type || !list) continue;

    for (let index = cursors.get(page) ?? 0; index < list.length; index++) {
      const interaction = list[index];

      if (
        interaction.type !== type ||
        interaction.detail < (action.clickCount ?? 0)
      )
        continue;
      action.label = interaction.label || undefined;
      action.role = interaction.role || undefined;
      action.password = interaction.password || undefined;
      action.option = interaction.option || undefined;
      action.context = interaction.context;
      cursors.set(page, index + 1);
      break;
    }
  }
}
