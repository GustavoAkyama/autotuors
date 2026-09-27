import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { folders, fromRoot } from "../../paths.ts";
import type { SpeechProvider } from "../index.ts";

// Piper: free neural TTS that runs offline. `pnpm setup:piper` installs it.
export type PiperOptions = {
  /** Voice name from huggingface.co/rhasspy/piper-voices, or a path to an .onnx file. */
  model?: string;
  /** 1 is normal speed; 1.1 is 10% faster. */
  speed?: number;
};

export const defaultPiperModel = "pt_BR-faber-medium";
export const piperDir = path.join(folders.cache, "piper");
export const piperBinary = path.join(
  piperDir,
  "piper",
  process.platform === "win32" ? "piper.exe" : "piper",
);

export const piperModelFile = (model: string) =>
  model.endsWith(".onnx")
    ? fromRoot(model)
    : path.join(piperDir, `${model}.onnx`);

export function piper({
  model = defaultPiperModel,
  speed = 1,
}: PiperOptions): SpeechProvider {
  const modelFile = piperModelFile(model);

  return {
    id: `piper:${model}:${speed}`,
    extension: "wav",
    async synthesize(text, output) {
      if (!fs.existsSync(piperBinary) || !fs.existsSync(modelFile))
        throw new Error(
          `Piper ou a voz "${model}" não estão instalados. Rode: pnpm setup:piper ${model}`,
        );
      execFileSync(
        piperBinary,
        [
          "--model",
          modelFile,
          "--output_file",
          output,
          "--length_scale",
          String(1 / speed),
        ],
        { input: text, stdio: ["pipe", "ignore", "pipe"] },
      );
    },
  };
}
