import type { BrowserContext, Page } from "playwright-core";
import type { RecordedAction } from "./types.ts";

export type RecordedEntry = { page: Page; action: RecordedAction };

// `_enableRecorder` is what `playwright codegen` and Playwright's own MCP server
// use; it isn't public API, so package.json pins playwright-core.
type RecorderSink = {
  actionAdded: (page: Page, action: unknown, code: string) => void;
  actionUpdated: (page: Page, action: unknown, code: string) => void;
  signalAdded: (page: Page, signal: unknown, code: string) => void;
};
type RecorderContext = BrowserContext & {
  _enableRecorder: (params: object, sink: RecorderSink) => Promise<void>;
  _disableRecorder: () => Promise<void>;
};

/**
 * Turns on Playwright's recorder, which adds each action to `entries` as JSON
 * (selector, locator, text...). Returns a function that turns it off.
 */
export async function enablePlaywrightRecorder(
  context: BrowserContext,
  entries: RecordedEntry[],
) {
  const recorder = context as RecorderContext;
  const parse = (code: string) =>
    JSON.parse(code.split("\n")[0]) as RecordedAction;

  await recorder._enableRecorder(
    {
      mode: "recording",
      recorderMode: "api",
      language: "jsonl",
      omitCallTracking: true,
    },
    {
      actionAdded: (page, _action, code) =>
        entries.push({ page, action: parse(code) }),
      // Typing more into the same field, for example, updates the last action.
      actionUpdated: (_page, _action, code) => {
        const last = entries.at(-1);
        if (last) last.action = parse(code);
      },
      // Signals (a popup opened, a navigation) are added to the last action.
      signalAdded: (page, _signal, code) => {
        const last = entries.at(-1);
        if (code && last?.page === page) last.action = parse(code);
      },
    },
  );

  return () => recorder._disableRecorder().catch(() => {});
}
