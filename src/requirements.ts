import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { config } from "./config.ts";
import {
  defaultPiperModel,
  piperBinary,
  piperModelFile,
} from "./narration/voices/piper.ts";

const hasCommand = (command: string) =>
  !spawnSync(command, ["-version"], { stdio: "ignore" }).error;

/** What is missing to make videos, as instructions for the user. */
export function missingRequirements() {
  const missing: string[] = [];
  if (!hasCommand("ffmpeg") || !hasCommand("ffprobe"))
    missing.push(
      "O ffmpeg não foi encontrado. Instale o ffmpeg 7+ e deixe-o no PATH.",
    );
  const voice = config.voice;
  if (voice.provider === "piper") {
    const model = voice.model ?? defaultPiperModel;
    if (!fs.existsSync(piperBinary) || !fs.existsSync(piperModelFile(model)))
      missing.push(
        `A voz da narração não está instalada. Rode: pnpm setup:piper${model === defaultPiperModel ? "" : ` ${model}`}`,
      );
  }
  return missing;
}
