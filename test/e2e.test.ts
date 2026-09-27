// Records the fixture site in a headless Chrome and makes its video: the whole
// flow, end to end. Needs Google Chrome, ffmpeg and Piper (pnpm setup:piper).
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import type { Page } from "playwright-core";
import { audioDuration } from "../src/narration/audio.ts";
import { capturesDir, mocksDir, scriptFile, videoFile } from "../src/paths.ts";
import { play } from "../src/player/play.ts";
import { record } from "../src/recorder/record.ts";
import { loadCaptures } from "../src/script/captures.ts";
import { saveRecording } from "../src/script/save-recording.ts";
import { startFixtureSite } from "./fixture/server.ts";

const name = "e2e-teste";
const pause = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

/** What a user would do: open the list, create a task, close the toast, connect an account. */
async function createTask(page: Page) {
  await page.getByRole("link", { name: "Minhas tarefas" }).click();
  await page.waitForURL(/tasks/);
  await pause();
  await page.getByLabel("Título").click();
  await page.keyboard.type("Comprar café", { delay: 20 });
  await pause();
  await page.getByLabel("Prioridade").selectOption("high");
  await pause();
  await page.getByLabel("Urgente").click();
  await pause();
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.getByRole("status").waitFor();
  await pause(600);
  await page.getByRole("button", { name: "Fechar" }).click();
  await pause();
  const popupOpened = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Conectar conta" }).click();
  const popup = await popupOpened;
  await popup.waitForLoadState();
  await pause();
  await popup.getByRole("button", { name: "Autorizar" }).click();
  await popup.waitForEvent("close");
  await pause(800);
}

function cleanUp() {
  for (const target of [
    scriptFile(name),
    videoFile(name),
    mocksDir(name),
    capturesDir(name),
  ])
    fs.rmSync(target, { recursive: true, force: true });
}

test(
  "grava o site de teste e gera o vídeo sem publicar nada de novo",
  { timeout: 10 * 60_000 },
  async () => {
    const site = await startFixtureSite();
    try {
      const recording = await record({
        url: site.url,
        width: 1280,
        headless: true,
      });
      await createTask(recording.page);
      const saved = saveRecording(name, await recording.stop(), {
        locale: "pt-BR",
        goal: "Criar uma tarefa",
      });
      const { steps } = saved.script;

      assert.deepEqual(
        steps.map((step) => step.action),
        [
          "click",
          "type",
          "select",
          "check",
          "click",
          "click",
          "click",
          "click",
          "close",
        ],
      );
      assert.equal(steps[1].action === "type" && steps[1].text, "Comprar café");
      // The toast closes by itself, so clicking it is optional and has no caption.
      assert.deepEqual(
        [
          steps[5].action === "click" && steps[5].optional,
          "caption" in steps[5] && steps[5].caption,
        ],
        [true, undefined],
      );
      assert.equal(steps[6].action === "click" && steps[6].popup, "popup1");
      assert.equal(saved.script.mocks?.length, 1);
      assert.equal(saved.captures, 8);
      assert.ok(
        loadCaptures(name).every(
          (capture) => capture.screenshot && capture.rect,
        ),
        "cada passo tem a tela do momento e a posição do elemento",
      );
      assert.equal(site.posts(), 1);

      const warnings: string[] = [];
      const video = await play(saved.script, name, {
        onWarning: (message) => warnings.push(message),
      });
      assert.equal(site.posts(), 1, "a reprodução respondeu o POST com o mock");
      assert.ok(audioDuration(video) > 20, "o vídeo tem a duração esperada");
      assert.deepEqual(warnings, []);
    } finally {
      site.close();
      cleanUp();
    }
  },
);
