import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  defaultPiperModel,
  piperBinary,
  piperDir,
  piperModelFile,
} from "./piper.ts";

const release =
  "https://github.com/rhasspy/piper/releases/download/2023.11.14-2";
const archives: Record<string, string> = {
  "win32-x64": "piper_windows_amd64.zip",
  "darwin-x64": "piper_macos_x64.tar.gz",
  "darwin-arm64": "piper_macos_aarch64.tar.gz",
  "linux-x64": "piper_linux_x86_64.tar.gz",
  "linux-arm64": "piper_linux_aarch64.tar.gz",
};

async function download(url: string, file: string) {
  console.log(`Baixando ${url}`);

  const response = await fetch(url);

  if (!response.ok)
    throw new Error(`Falha ao baixar ${url}: HTTP ${response.status}`);

  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
}

async function installBinary() {
  if (fs.existsSync(piperBinary)) return;

  const archive = archives[`${process.platform}-${process.arch}`];

  if (!archive)
    throw new Error(
      `O Piper não tem binário para ${process.platform}-${process.arch}.`,
    );

  const file = path.join(piperDir, archive);

  await download(`${release}/${archive}`, file);
  // Windows' own tar extracts .zip; a GNU tar earlier in PATH would not.
  const tar =
    process.platform === "win32"
      ? path.join(
          process.env.SystemRoot ?? "C:\\Windows",
          "System32",
          "tar.exe",
        )
      : "tar";

  execFileSync(tar, ["-xf", file, "-C", piperDir]);

  fs.rmSync(file);
}

/** Downloads a voice (model and its config) from huggingface.co/rhasspy/piper-voices. */
async function installVoice(model: string) {
  const [region, speaker, quality] = model.split("-");

  if (!region || !speaker || !quality)
    throw new Error(
      `Nome de voz inválido: "${model}". Exemplo: ${defaultPiperModel}`,
    );

  const language = region.split("_")[0];
  const url = `https://huggingface.co/rhasspy/piper-voices/resolve/main/${language}/${region}/${speaker}/${quality}/${model}.onnx`;

  for (const suffix of ["", ".json"]) {
    const file = `${piperModelFile(model)}${suffix}`;
    if (!fs.existsSync(file)) await download(`${url}${suffix}`, file);
  }
}

/** Installs Piper and a voice into .cache/piper; skips what is already there. */
export async function installPiper(model = defaultPiperModel) {
  fs.mkdirSync(piperDir, { recursive: true });

  await installBinary();
  await installVoice(model);
}
