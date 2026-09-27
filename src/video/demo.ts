import fs from "node:fs";
import path from "node:path";
import type {
  BrowserContext,
  CDPSession,
  Locator,
  Page,
} from "playwright-core";
import { config } from "../config.ts";
import {
  createNarrator,
  type Narrator,
  type VoiceConfig,
} from "../narration/index.ts";
import { framesDir, videoFile } from "../paths.ts";
import type { Card } from "../script/types.ts";
import { launchCaptureBrowser } from "./capture-browser.ts";
import {
  captionDuration,
  injectCaptionAssets,
  narrationOf,
  type Caption,
} from "./captions.ts";
import { recordCard } from "./cards.ts";
import {
  composeVideo,
  type Cue,
  type Focus,
  type Music,
  type Pause,
  type Segment,
} from "./compose/index.ts";
import { scaleSize, type Rect, type Size } from "./geometry.ts";
import { keyLabels } from "./keys.ts";
import { resolveMusic, type MusicSetting } from "./music.ts";
import type { CaptionOptions } from "./overlay/index.ts";
import { Pointer, type ClickOptions } from "./pointer.ts";
import { intoPopup, outOfPopup, recordPopup } from "./popups.ts";
import { startScreencast, type Clip, type Screencast } from "./screencast.ts";
import { now, sleep } from "./time.ts";

export type { Caption, Card, ClickOptions, MusicSetting, VoiceConfig };

export type Progress = (fraction: number, label: string) => void;

export type DemoOptions = {
  /** Page width in CSS pixels; the height follows 16:9. */
  width?: number;
  /** Saved login to use. */
  session?: string;
  /** Zoom the camera into each action; a number sets the maximum zoom. */
  zoom?: boolean | number;
  /** Read each caption's description (or `narration`) aloud. */
  narrate?: boolean;
  voice?: VoiceConfig;
  music?: MusicSetting | false;
  /** Keeps the frames in output/<name>/ after the video is made, for debugging. */
  keepFrames?: boolean;
  /** Reports how far `finish()` is, from 0 to 1. */
  onProgress?: Progress;
};

type Settings = {
  name: string;
  totalSteps: number;
  viewport: Size;
  zoom: number;
  captureScale: number;
  narrator: Narrator | null;
  music: Music | null;
  keepFrames: boolean;
  onProgress: Progress;
};

const videoWidth = 1920;
const defaultZoom = 1.4;

/**
 * Records a tour video of a site: a cursor that glides and clicks, numbered
 * captions, narration, camera zoom, popups in windows and title cards.
 *
 * Open it, navigate and set up mocks, `start()`, act and caption, then `finish()`.
 */
export class Demo {
  readonly context: BrowserContext;
  readonly page: Page;
  /** Frames and work files of this video. */
  readonly outputDir: string;
  private readonly cdp: CDPSession;
  private readonly settings: Settings;
  private readonly pointer = new Pointer();
  // What the video is made of, in wall-clock time.
  private readonly clips: Clip[] = [];
  private readonly pauses: Pause[] = [];
  private readonly focuses: Focus[] = [];
  private readonly cues: Cue[] = [];
  private readonly cards: { intro?: Card; outro?: Card } = {};
  private main: Screencast | null = null;
  private captionPage: Page | null = null;
  private openPopups = 0;
  private step = 0;

  private constructor(
    context: BrowserContext,
    page: Page,
    cdp: CDPSession,
    settings: Settings,
  ) {
    this.context = context;
    this.page = page;
    this.cdp = cdp;
    this.settings = settings;
    this.outputDir = framesDir(settings.name);
  }

  /** Opens Chrome for the video `name`; `totalSteps` is how many captions it has. */
  static async open(
    name: string,
    totalSteps: number,
    options: DemoOptions = {},
  ) {
    const width = options.width ?? 1280;
    const viewport = { width, height: Math.round((width * 9) / 16) };
    const zoom =
      options.zoom === true
        ? defaultZoom
        : Math.max(Number(options.zoom) || 1, 1);
    // Capture enough pixels that zooming in stays sharp.
    const captureScale = Math.round((videoWidth / width) * zoom * 1000) / 1000;
    // Downloaded before Chrome opens, so a failure costs nothing.
    const musicSetting =
      options.music === false ? null : (options.music ?? config.music);
    const music = musicSetting ? await resolveMusic(musicSetting) : null;
    const { context, page, cdp } = await launchCaptureBrowser({
      viewport,
      captureScale,
      session: options.session,
    });
    return new Demo(context, page, cdp, {
      name,
      totalSteps,
      viewport,
      zoom,
      captureScale,
      narrator: options.narrate
        ? createNarrator(options.voice ?? config.voice, config.locale)
        : null,
      music,
      keepFrames: options.keepFrames ?? false,
      onProgress: options.onProgress ?? (() => {}),
    });
  }

  /** Opens a full URL, or a path of the site that is open. */
  async goto(url: string) {
    const current = this.page.url();
    const base = /^https?:/.test(current) ? current : undefined;
    if (!base && !/^https?:\/\//.test(url))
      throw new Error(
        `goto("${url}"): o primeiro endereço precisa ser completo, como https://meusite.com/pagina.`,
      );
    await this.page.goto(new URL(url, base).href);
    // Sites with live connections never go network-idle; don't wait forever.
    await this.page
      .waitForLoadState("networkidle", { timeout: 8000 })
      .catch(() => {});
  }

  /** Starts recording. Before it, nothing shows in the video. */
  async start() {
    this.main = await startScreencast(
      this.page,
      this.cdp,
      path.join(this.outputDir, "frames-main"),
      this.captured(this.settings.viewport),
    );
    const { width, height } = this.settings.viewport;
    await this.pointer.place(this.page, { x: width * 0.62, y: height * 0.7 });
    await sleep(600);
  }

  // Actions. They take the page of the locator, so they work inside popups too.

  async click(
    locator: Locator,
    page = locator.page(),
    options: ClickOptions = {},
  ) {
    await this.pointAt(locator, page);
    await this.pointer.tap(page, options);
  }

  async type(locator: Locator, text: string, page = locator.page()) {
    await this.click(locator, page);
    // The recorded text is the field's final value, so anything already in it goes.
    await locator.clear().catch(() => {});
    await page.keyboard.type(text, { delay: 28 });
    await sleep(250);
  }

  /** Presses a key or shortcut (e.g. "Enter", "Control+K") and shows it on screen. */
  async press(key: string, page = this.page) {
    await page.evaluate(
      (keys) => window.__demoOverlay.keys(keys),
      keyLabels(key),
    );
    await sleep(220);
    await page.keyboard.press(key);
    await sleep(600);
  }

  async hover(locator: Locator, page = locator.page()) {
    await this.pointAt(locator, page);
    await sleep(400);
  }

  async select(
    locator: Locator,
    values: string | string[],
    page = locator.page(),
  ) {
    await this.pointAt(locator, page);
    // A real click would open the native dropdown, which never shows up on video.
    await page.evaluate(() => window.__demoOverlay.press());
    await locator.selectOption(values);
    await sleep(450);
  }

  async check(locator: Locator, checked = true, page = locator.page()) {
    // Styled checkboxes hide the real input.
    if (!(await locator.isVisible())) {
      await locator.setChecked(checked, { force: true });
      return;
    }
    await this.pointAt(locator, page);
    if ((await locator.isChecked()) !== checked) await this.pointer.tap(page);
  }

  async upload(
    locator: Locator,
    files: string | string[],
    page = locator.page(),
  ) {
    if (await locator.isVisible()) {
      await this.pointAt(locator, page);
      await page.evaluate(() => window.__demoOverlay.press());
    }
    await locator.setInputFiles(files);
    await sleep(500);
  }

  // Captions.

  /**
   * Synthesizes the narration of these captions before `start()`. Synthesis during
   * the recording is cut from the video, but the page keeps running meanwhile, so a
   * toast or anything else on a timer can be gone by the next step.
   */
  async prepareNarration(captions: Caption[]) {
    if (!this.settings.narrator) return;
    for (const caption of captions) {
      const text = narrationOf(caption);
      if (text) await this.settings.narrator(text);
    }
  }

  /** Shows a numbered caption next to `target`, or centered when it's `null`. */
  async caption(target: Locator | null, caption: Caption) {
    this.step += 1;
    const { narration: _, ...shown } = caption;
    const options: CaptionOptions = {
      ...shown,
      ring: caption.ring ?? true,
      step: this.step,
      total: this.settings.totalSteps,
    };
    const text = narrationOf(caption);
    const speech =
      this.settings.narrator && text ? await this.speak(text) : null;
    const page = target?.page() ?? this.page;
    await injectCaptionAssets(page);

    let shownAt = now();
    if (target) {
      await target.waitFor({ state: "visible" });
      await this.bringIntoView(target);
      shownAt = now();
      const area = await target.evaluate(
        (element, value) => window.__demoOverlay.caption(element, value),
        options,
      );
      this.focus(area, page, shownAt);
    } else {
      await page.evaluate(
        (value) => window.__demoOverlay.caption(null, value),
        options,
      );
      this.focus(null, page, shownAt);
    }
    this.captionPage = page;
    if (speech) this.cues.push({ time: shownAt + 0.3, file: speech.file });
    await sleep(captionDuration(caption, speech));
  }

  /** Removes the caption, e.g. before an interaction. */
  async clearCaption() {
    const page = this.captionPage ?? this.page;
    if (page.isClosed()) return;
    await page
      .evaluate(() => window.__demoOverlay.clearCaption())
      .catch(() => {});
    await sleep(200);
  }

  // Popups.

  /** Clicks something that opens a popup and shows the popup in a window; returns its page. */
  async clickOpeningPopup(locator: Locator, host?: string) {
    const popupEvent = this.page.waitForEvent("popup");
    await this.click(locator);
    const popup = await popupEvent;
    await this.clearCaption();
    this.focus(null);
    this.openPopups += 1;
    const { clip, size } = await recordPopup(this.page, popup, {
      host,
      dir: path.join(this.outputDir, `frames-popup-${this.clips.length}`),
      captureScale: this.settings.captureScale,
    });
    this.clips.push(clip);
    this.pointer.remember(
      popup,
      intoPopup(this.pointer.positionOn(this.page)!, clip.rect, size),
    );
    popup.once("close", () => this.popupClosed(popup, clip.rect));
    return popup;
  }

  /** Brings the cursor back to the page, where it was in the popup. */
  private popupClosed(popup: Page, rect: Rect) {
    this.openPopups -= 1;
    const point = outOfPopup(this.pointer.positionOn(popup)!, rect);
    this.pointer.remember(this.page, point);
    void this.page
      .evaluate((value) => {
        window.__demoOverlay.closeWindow();
        window.__demoOverlay.move(value, value, 0);
      }, point)
      .then(() => this.page.mouse.move(point.x, point.y))
      // The whole browser may be closing.
      .catch(() => {});
  }

  // Title cards.

  /** Opens the video with a title card. */
  intro(card: Card) {
    this.cards.intro = card;
  }

  /** Ends the video with a closing card. */
  outro(card: Card) {
    this.cards.outro = card;
  }

  /** Stops recording and makes output/<name>.mp4. */
  async finish() {
    const { onProgress, viewport } = this.settings;
    onProgress(0, "Finalizando a gravação");
    await this.clearCaption();
    this.focus(null);
    await sleep(this.settings.zoom > 1 ? 1000 : 700);
    await this.main!.stop();
    for (const clip of this.clips) await clip.cast.stop();

    const segments: Segment[] = [];
    if (this.cards.intro) {
      onProgress(0.03, "Gravando a abertura");
      segments.push(await this.recordCard("intro", this.cards.intro));
    }
    segments.push({
      cast: this.main!,
      clips: this.clips,
      pauses: this.pauses,
      focuses: this.focuses,
      cues: this.cues,
    });
    if (this.cards.outro) {
      onProgress(0.08, "Gravando o encerramento");
      segments.push(await this.recordCard("outro", this.cards.outro));
    }
    await this.context.browser()!.close();

    const output = videoFile(this.settings.name);
    onProgress(0.13, "Montando o vídeo");
    await composeVideo({
      segments,
      viewport,
      captureScale: this.settings.captureScale,
      zoom: this.settings.zoom,
      size: {
        width: videoWidth,
        height: Math.round((viewport.height * videoWidth) / viewport.width),
      },
      fps: 30,
      music: this.settings.music,
      output,
      workDir: this.outputDir,
      onProgress: (fraction) =>
        onProgress(0.13 + fraction * 0.87, "Montando o vídeo"),
    });
    this.discardFrames();
    console.log(`Vídeo salvo em ${output}`);
    return output;
  }

  /** Gives up on the video: closes Chrome and removes the frames. */
  async abort() {
    await this.context.browser()?.close();
    this.discardFrames();
  }

  private discardFrames() {
    if (!this.settings.keepFrames)
      fs.rmSync(this.outputDir, { recursive: true, force: true });
  }

  private captured(size: Size) {
    return scaleSize(size, this.settings.captureScale);
  }

  /** Tells the camera where the action is; `null` shows the whole page. */
  private focus(rect: Rect | null, page = this.page, time = now()) {
    if (!this.main || page !== this.page || this.openPopups) return;
    this.focuses.push({ time, rect });
  }

  private async bringIntoView(target: Locator) {
    await target.evaluate((element) =>
      window.__demoOverlay.scrollToElement(element),
    );
    await sleep(120);
  }

  /** Scrolls to the element, points the camera at it and moves the cursor there. */
  private async pointAt(locator: Locator, page: Page) {
    await locator.waitFor({ state: "visible" });
    await this.bringIntoView(locator);
    const box = (await locator.boundingBox())!;
    this.focus(box, page);
    await this.pointer.moveTo(page, {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    });
  }

  /** Synthesizes speech, cutting the time it takes out of the video. */
  private async speak(text: string) {
    const started = now();
    const speech = await this.settings.narrator!(text);
    if (this.main) this.pauses.push({ start: started, end: now() });
    return speech;
  }

  private recordCard(kind: "intro" | "outro", card: Card) {
    return recordCard(this.context.browser()!, kind, card, {
      viewport: this.settings.viewport,
      captureScale: this.settings.captureScale,
      dir: path.join(this.outputDir, `frames-${kind}`),
      narrator: this.settings.narrator,
    });
  }
}
