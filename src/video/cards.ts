import fs from "node:fs";
import path from "node:path";
import type { Browser } from "playwright-core";
import { config, type Theme } from "../config.ts";
import type { Narrator } from "../narration/index.ts";
import { fromRoot } from "../paths.ts";
import type { Card } from "../script/types.ts";
import { emulateViewport } from "./capture-browser.ts";
import type { Segment } from "./compose/index.ts";
import { scaleSize, type Size } from "./geometry.ts";
import { startScreencast } from "./screencast.ts";
import { now, sleep } from "./time.ts";

/** Records an opening or closing card as its own segment of the video. */
export async function recordCard(
  browser: Browser,
  kind: "intro" | "outro",
  card: Card,
  options: {
    viewport: Size;
    captureScale: number;
    dir: string;
    narrator: Narrator | null;
  },
): Promise<Segment> {
  const text = cardNarration(card);
  const speech = options.narrator && text ? await options.narrator(text) : null;

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  const session = await emulateViewport(page, options.viewport);

  await page.setContent(cardHtml(card, kind, config.theme));
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  const cast = await startScreencast(
    page,
    session,
    options.dir,
    scaleSize(options.viewport, options.captureScale),
  );

  await sleep(200);

  const startedAt = now();

  await page.evaluate(() => document.body.classList.add("play"));
  await sleep(Math.max(3200, speech ? speech.duration * 1000 + 1600 : 0));
  await cast.stop();
  await context.close();

  return {
    cast,
    cues: speech ? [{ time: startedAt + 0.5, file: speech.file }] : [],
  };
}

/** What the narrator says on a card: its title, as a sentence, and subtitle. */
function cardNarration(card: Card) {
  if (card.narration === false) return null;
  const title = /[.!?…]$/.test(card.title) ? card.title : `${card.title}.`;
  return card.narration ?? [title, card.subtitle].filter(Boolean).join(" ");
}

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);

const mimeTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function logoTag(logo: string) {
  const file = fromRoot(logo);
  const mime = mimeTypes[path.extname(file).toLowerCase()] ?? "image/png";
  return `<img class="logo" src="data:${mime};base64,${fs.readFileSync(file).toString("base64")}">`;
}

/** A title card. Its animations wait for `document.body.classList.add("play")`. */
export function cardHtml(
  card: Card,
  kind: "intro" | "outro",
  theme: Theme = {},
) {
  const primary = theme.primary ?? "#2563eb";
  const accent = theme.accent ?? "#f97316";
  const font = theme.font ?? 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const check =
    kind === "outro"
      ? '<svg class="check" viewBox="0 0 52 52"><circle cx="26" cy="26" r="23"/><path d="M15.5 27.5l7 7 14-15"/></svg>'
      : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 100%; height: 100%; }
  body {
    display: grid;
    place-items: center;
    overflow: hidden;
    font-family: ${font};
    color: #ffffff;
    background:
      radial-gradient(60% 80% at 85% 110%, color-mix(in srgb, ${accent} 55%, transparent), transparent 70%),
      radial-gradient(90% 90% at 10% 0%, color-mix(in srgb, ${primary} 60%, white), transparent 60%),
      linear-gradient(160deg, ${primary}, color-mix(in srgb, ${primary} 45%, black));
  }
  body:not(.play) * { animation-play-state: paused !important; }
  .card { max-width: 78%; text-align: center; }
  .logo { height: 72px; margin-bottom: 32px; animation: rise 700ms cubic-bezier(0.2, 0.7, 0.3, 1) both; }
  .check { width: 88px; height: 88px; margin-bottom: 28px; fill: none; stroke: #ffffff; stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; }
  .check circle { stroke-dasharray: 145; stroke-dashoffset: 145; animation: draw 700ms ease-out 100ms forwards; }
  .check path { stroke-dasharray: 40; stroke-dashoffset: 40; animation: draw 450ms ease-out 650ms forwards; }
  .title {
    font-size: 64px;
    font-weight: 800;
    line-height: 1.08;
    letter-spacing: -0.02em;
    text-wrap: balance;
    animation: rise 750ms cubic-bezier(0.2, 0.7, 0.3, 1) 150ms both;
  }
  .subtitle {
    margin-top: 20px;
    font-size: 26px;
    font-weight: 500;
    opacity: 0.86;
    text-wrap: balance;
    animation: rise 750ms cubic-bezier(0.2, 0.7, 0.3, 1) 380ms both;
  }
  .bar {
    width: 96px;
    height: 6px;
    margin: 32px auto 0;
    border-radius: 3px;
    background: ${accent};
    animation: grow 650ms cubic-bezier(0.2, 0.7, 0.3, 1) 600ms both;
  }
  @keyframes rise { from { opacity: 0; transform: translateY(28px); } }
  @keyframes grow { from { transform: scaleX(0); } }
  @keyframes draw { to { stroke-dashoffset: 0; } }
</style>
</head>
<body>
  <main class="card">
    ${card.logo ? logoTag(card.logo) : check}
    <h1 class="title">${escape(card.title)}</h1>
    ${card.subtitle ? `<p class="subtitle">${escape(card.subtitle)}</p>` : ""}
    <div class="bar"></div>
  </main>
</body>
</html>`;
}
