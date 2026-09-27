import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { folders } from "../paths.ts";
import { audioDuration } from "./audio.ts";
import { kokoro, type KokoroOptions } from "./voices/kokoro.ts";
import { piper, type PiperOptions } from "./voices/piper.ts";

/**
 * A text-to-speech engine. To add one (e.g. a paid API), write a factory in
 * `voices/`, add its options to `VoiceConfig` and register it in `providers`.
 */
export type SpeechProvider = {
  /** Must change whenever the same text would sound different; it keys the cache. */
  id: string;
  /** Extension of the audio file `synthesize` writes (any format ffmpeg reads). */
  extension: string;
  synthesize: (text: string, output: string) => Promise<void>;
};

export type VoiceConfig =
  | ({ provider: "piper" } & PiperOptions)
  | ({ provider: "kokoro" } & KokoroOptions);

type Factory = (options: VoiceConfig, locale: string) => SpeechProvider;

const providers = { piper, kokoro } as Record<VoiceConfig["provider"], Factory>;

export type Speech = { file: string; duration: number };
export type Narrator = (text: string) => Promise<Speech>;

const cacheDir = path.join(folders.cache, "narration");

/** Speaks a text with the voice, keeping each sentence's audio in the cache. */
export function createNarrator(voice: VoiceConfig, locale: string): Narrator {
  const factory = providers[voice.provider];

  if (!factory)
    throw new Error(`Provedor de voz desconhecido: "${voice.provider}"`);

  const provider = factory(voice, locale);

  return async (text) => {
    const key = crypto
      .createHash("sha1")
      .update(`${provider.id}\n${text}`)
      .digest("hex");

    const file = path.join(cacheDir, `${key}.${provider.extension}`);

    if (!fs.existsSync(file)) {
      fs.mkdirSync(cacheDir, { recursive: true });
      // Written aside first, so an interrupted synthesis never lands in the cache.
      const partial = path.join(
        cacheDir,
        `${key}.partial.${provider.extension}`,
      );

      await provider.synthesize(text, partial);

      fs.renameSync(partial, file);
    }

    return { file, duration: audioDuration(file) };
  };
}
