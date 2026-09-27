import type { BrowserContext, Page } from "playwright-core";
import { launchChrome, siteContextOptions } from "../browser/chrome.ts";
import { requireSession } from "../browser/sessions.ts";
import { captureResponses } from "../mocks/capture.ts";
import { attachInteractions, trackPageInteractions } from "./interactions.ts";
import {
  enablePlaywrightRecorder,
  type RecordedEntry,
} from "./playwright-recorder.ts";
import type { RecordedAction, Recording } from "./types.ts";

export type RecordOptions = {
  url: string;
  width: number;
  /** Saved login to start with. */
  session?: string;
  headless?: boolean;
};

/**
 * Opens Chrome at `url` and records what the user does until `stop()`, or until
 * the window closes (`closed`).
 */
export async function record(options: RecordOptions) {
  const storageState = options.session
    ? requireSession(options.session)
    : undefined;
  const browser = await launchChrome({ headless: options.headless ?? false });
  const context = await browser.newContext({
    ...(await siteContextOptions(browser, storageState)),
    viewport: {
      width: options.width,
      height: Math.round((options.width * 9) / 16),
    },
  });

  const entries: RecordedEntry[] = [];
  const popups = trackPopups(context, entries);
  const network = captureResponses(context);
  const tracker = await trackPageInteractions(context);
  const disableRecorder = await enablePlaywrightRecorder(context, entries);

  const time = new Date().toISOString();
  const page = await context.newPage();

  await page.goto(options.url);

  const closed = new Promise<void>((resolve) => {
    page.once("close", () => resolve());
    browser.once("disconnected", () => resolve());
  });

  const stop = async (): Promise<Recording> => {
    await disableRecorder();
    await Promise.all([network.settled(), tracker.settled()]);

    const title = await page.title().catch(() => "");

    await browser.close().catch(() => {});

    attachInteractions(entries, tracker.interactions);

    return {
      url: options.url,
      width: options.width,
      title,
      time,
      actions: withPageNames(entries, page, popups),
      responses: network.responses,
    };
  };

  return { page, closed, stop };
}

/** Popups opened while recording, in order. Closing one is recorded as an action. */
function trackPopups(context: BrowserContext, entries: RecordedEntry[]) {
  const popups: Page[] = [];

  context.on("page", async (page) => {
    if (!(await page.opener().catch(() => null))) return;
    popups.push(page);
    // The recorder can't report a page that is already closed.
    page.once("close", () =>
      entries.push({ page, action: { name: "closePage", page: "" } }),
    );
  });

  return popups;
}

/** Names each action's page ("main", "popup1"...) and the popup it opened. */
function withPageNames(
  entries: RecordedEntry[],
  main: Page,
  popups: Page[],
): RecordedAction[] {
  const guid = (page: Page) => (page as unknown as { _guid: string })._guid;
  const nameOf = (page: Page) =>
    page === main ? "main" : `popup${popups.indexOf(page) + 1}`;

  return entries.map(({ page, action }) => {
    const signal = action.signals?.find((item) => item.name === "popup");
    const popup =
      signal && popups.find((item) => guid(item) === signal.popupPageGuid);

    return {
      ...action,
      page: nameOf(page),
      popup: popup ? nameOf(popup) : undefined,
    };
  });
}
