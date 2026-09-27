import fs from "node:fs";
import type { Page } from "playwright-core";
import { looksLikeLogin } from "../browser/sessions.ts";
import { replayMocks } from "../mocks/replay.ts";
import { errorScreenshot } from "../paths.ts";
import { captionOf, type TourScript } from "../script/types.ts";
import { Demo, type Progress } from "../video/demo.ts";
import type { Warn } from "./find-target.ts";
import { runStep, type Pages } from "./run-step.ts";

export type PlayOptions = {
  /** Reports progress from 0 to 1, with what is happening. */
  onProgress?: Progress;
  /** Things that didn't stop the video but deserve a fix in the script. */
  onWarning?: Warn;
  /** Keeps the frames in output/<name>/, for debugging. */
  keepFrames?: boolean;
};

/**
 * Plays a script in Chrome and makes output/<name>.mp4. Recording the steps takes
 * about 70% of the time; making the video, the rest.
 */
export async function play(
  script: TourScript,
  name: string,
  {
    onProgress = () => {},
    onWarning = (message) => console.warn(`Atenção: ${message}`),
    keepFrames = false,
  }: PlayOptions = {},
) {
  onProgress(0, "Abrindo o navegador");

  fs.rmSync(errorScreenshot(name), { force: true });

  const captions = script.steps.flatMap((step) => captionOf(step) ?? []);
  const demo = await Demo.open(name, captions.length, {
    width: script.width,
    session: script.session,
    zoom: script.zoom,
    narrate: script.narrate,
    voice: script.voice,
    music: script.music,
    keepFrames,
    onProgress: (fraction, label) => onProgress(0.7 + fraction * 0.3, label),
  });

  await prepareSite(demo, script);

  onProgress(0.02, "Preparando a narração");

  await demo.prepareNarration(captions);
  await demo.goto(script.url);

  // Without this, an expired login only shows up as a timeout on the first step.
  if (looksLikeLogin(demo.page.url()) && !looksLikeLogin(script.url)) {
    await demo.abort();

    throw new Error(
      script.session
        ? `O site abriu na tela de login (${demo.page.url()}): o login salvo “${script.session}” expirou. Faça o login de novo e gere o vídeo.`
        : `O site abriu na tela de login (${demo.page.url()}). Grave usando um login salvo.`,
    );
  }

  await demo.start();

  const pages: Pages = new Map([["main", demo.page]]);

  for (const [index, step] of script.steps.entries()) {
    onProgress(
      0.05 + (index / script.steps.length) * 0.65,
      `Passo ${index + 1} de ${script.steps.length}`,
    );

    try {
      await runStep(demo, pages, step, name, (message) =>
        onWarning(`passo ${index + 1}: ${message}`),
      );
    } catch (error) {
      await demo.abort();
      throw new Error(
        `O passo ${index + 1} (${step.action}) falhou: ${(error as Error).message}`,
      );
    }
  }

  const video = await demo.finish();

  onProgress(1, "Vídeo pronto");

  return video;
}

/** Mocks, the recording's date and dialogs: the site behaves as it did when recorded. */
async function prepareSite(demo: Demo, script: TourScript) {
  await replayMocks(demo.context, script);

  // Timers keep running; only the date stays put.
  if (script.time) await demo.context.clock.setFixedTime(script.time);
  if (script.intro) demo.intro(script.intro);
  if (script.outro) demo.outro(script.outro);

  // Native dialogs never show up on video; accept them so the flow goes on.
  const acceptDialogs = (page: Page) =>
    page.on("dialog", (dialog) => void dialog.accept().catch(() => {}));

  acceptDialogs(demo.page);

  demo.context.on("page", acceptDialogs);
}
