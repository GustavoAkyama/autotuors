import fs from "node:fs";
import path from "node:path";
import { config } from "../config.ts";
import { sessionFile } from "../paths.ts";
import { launchChrome } from "./chrome.ts";

/**
 * Opens Chrome for the user to log in as usual (2FA and captchas included).
 * `finish()` saves the session; closing the window saves it too.
 */
export async function openLogin(name: string, url: string) {
  const file = sessionFile(name);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  // Google and other sites refuse to log in when the browser says it is automated.
  const browser = await launchChrome({
    headless: false,
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    viewport: null,
    locale: config.locale,
    storageState: fs.existsSync(file) ? file : undefined,
  });

  const page = await context.newPage();

  const closed = new Promise<void>((resolve) => {
    page.once("close", () => resolve());
    browser.once("disconnected", () => resolve());
  });
  try {
    await page.goto(url);
  } catch (error) {
    await browser.close();
    throw error;
  }

  // Saved as it goes: closing the last window may take the browser down with it.
  // IndexedDB is where apps like Firebase keep their login.
  const save = () =>
    context.storageState({ path: file, indexedDB: true }).then(
      () => {},
      () => {},
    );

  const autosave = setInterval(save, 2000);

  const close = async (keep: boolean) => {
    clearInterval(autosave);
    if (keep) await save();
    await browser.close().catch(() => {});
  };

  return {
    file,
    closed,
    finish: () => close(true),
    cancel: () => close(false),
  };
}
