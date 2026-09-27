import path from "node:path";
import type { Page } from "playwright-core";
import { config, type Theme } from "../config.ts";
import { root } from "../paths.ts";
import type { Speech } from "../narration/index.ts";
import type { StepCaption } from "../script/types.ts";

/** A caption as `Demo.caption` takes it. */
export type Caption = StepCaption;

/** What the narrator says for a caption, or null to keep it silent. */
export const narrationOf = ({ narration, description }: Caption) =>
  narration === false ? null : (narration ?? description);

/** Long enough to read the caption, or to hear it with a short pause after. */
export function captionDuration(caption: Caption, speech: Speech | null) {
  const words = `${caption.title} ${caption.description}`.split(/\s+/).length;
  const reading = Math.min(Math.max(words * 170, 1300), 3200);
  return speech ? Math.max(reading, speech.duration * 1000 + 800) : reading;
}

function themeCss(theme: Theme) {
  const variables = {
    "--tour-primary": theme.primary,
    "--tour-accent": theme.accent,
    "--tour-surface": theme.surface,
    "--tour-text": theme.text,
    "--tour-font": theme.font,
  };
  const declarations = Object.entries(variables)
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}:${value}`);
  return `:root{${declarations.join(";")}}`;
}

/** Adds driver.js and the caption styles (in the theme's colors) to a page, once. */
export async function injectCaptionAssets(page: Page) {
  if (await page.evaluate(() => Boolean(window.driver))) return;
  const driverDir = path.join(root, "node_modules/driver.js/dist");
  await page.addStyleTag({ path: path.join(driverDir, "driver.css") });
  await page.addStyleTag({
    path: path.join(import.meta.dirname, "captions.css"),
  });
  await page.addStyleTag({ content: themeCss(config.theme) });
  await page.addScriptTag({ path: path.join(driverDir, "driver.js.iife.js") });
}
