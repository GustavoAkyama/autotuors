import {
  chromium,
  type Browser,
  type BrowserContextOptions,
  type LaunchOptions,
} from "playwright-core";
import { config } from "../config.ts";

/** The Google Chrome installed on the machine; no browser is downloaded. */
export const launchChrome = (options: LaunchOptions = {}) =>
  chromium.launch({ channel: "chrome", ...options });

/**
 * The user agent of a normal Chrome window. Headless Chrome announces itself as
 * "HeadlessChrome", and sites that tie a login to the browser would drop a session
 * saved from the login window.
 */
export async function windowUserAgent(browser: Browser) {
  const page = await browser.newPage();
  const agent = await page.evaluate(() => navigator.userAgent);
  await page.close();
  return agent.replace("HeadlessChrome/", "Chrome/");
}

/**
 * Context settings shared by recording and playback, so the site sees the same
 * browser, language and login in both. `storageState` is a session file; check it
 * with `requireSession` before launching, so a missing one leaves no Chrome behind.
 */
export async function siteContextOptions(
  browser: Browser,
  storageState?: string,
): Promise<BrowserContextOptions> {
  return {
    locale: config.locale,
    colorScheme: config.colorScheme,
    userAgent: await windowUserAgent(browser),
    // Service workers would answer requests before the mocks see them.
    serviceWorkers: "block",
    storageState,
  };
}
