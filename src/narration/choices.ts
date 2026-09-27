import fs from "node:fs";
import type { VoiceConfig } from "./index.ts";
import {
  defaultKokoroUrl,
  defaultKokoroVoice,
  kokoroOnline,
} from "./voices/kokoro.ts";
import {
  defaultPiperModel,
  piperBinary,
  piperModelFile,
} from "./voices/piper.ts";

/** A voice the UI offers. `id` is what the page sends back when choosing it. */
export type VoiceChoice = {
  id: string;
  label: string;
  engine: "Piper" | "Kokoro";
  voice: VoiceConfig;
};

const piperVoice = (model: string, label: string): VoiceChoice => ({
  id: `piper:${model}`,
  label,
  engine: "Piper",
  voice: { provider: "piper", model },
});

const kokoroVoice = (voice: string, label: string): VoiceChoice => ({
  id: `kokoro:${voice}`,
  label,
  engine: "Kokoro",
  voice: { provider: "kokoro", voice },
});

// The Brazilian Portuguese voices of each engine.
export const voiceChoices: VoiceChoice[] = [
  piperVoice("pt_BR-faber-medium", "Faber (masculina)"),
  piperVoice("pt_BR-cadu-medium", "Cadu (masculina)"),
  piperVoice("pt_BR-jeff-medium", "Jeff (masculina)"),
  kokoroVoice("pf_dora", "Dora (feminina)"),
  kokoroVoice("pm_alex", "Alex (masculina)"),
  kokoroVoice("pm_santa", "Santa (masculina)"),
];

/** The id of the choice matching a voice, if the voice is one of them. */
export function voiceIdOf(voice: VoiceConfig) {
  const id =
    voice.provider === "piper"
      ? `piper:${voice.model ?? defaultPiperModel}`
      : `kokoro:${voice.voice ?? defaultKokoroVoice}`;
  return voiceChoices.some((choice) => choice.id === id) ? id : null;
}

// Asking the Kokoro server takes a moment; once in a while is enough.
let kokoro = { checkedAt: 0, online: false };

/** Each choice with what is missing to use it: why, and the command that fixes it. */
export async function voiceChoicesWithStatus() {
  if (Date.now() - kokoro.checkedAt > 10_000)
    kokoro = {
      checkedAt: Date.now(),
      online: await kokoroOnline(defaultKokoroUrl),
    };

  return voiceChoices.map((choice) => {
    let missing: { reason: string; command: string } | null = null;

    if (choice.voice.provider === "piper") {
      const model = choice.voice.model ?? defaultPiperModel;

      if (!fs.existsSync(piperBinary) || !fs.existsSync(piperModelFile(model)))
        missing = {
          reason: "Esta voz não está instalada. Instale com",
          command: `pnpm setup:piper ${model}`,
        };
    } else if (!kokoro.online)
      missing = {
        reason: "O servidor do Kokoro não está rodando. Inicie com",
        command:
          "docker run -d -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest",
      };

    return { ...choice, missing };
  });
}
