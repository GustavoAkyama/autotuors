import fs from "node:fs";
import type { SpeechProvider } from "../index.ts";

// Kokoro-FastAPI: free neural TTS (Apache-2.0) served from Docker, with the
// OpenAI speech API. Start it with:
//   docker run -d -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest
export type KokoroOptions = {
  /** Voice id, e.g. "pf_dora", "pm_alex" or "pm_santa" for Brazilian Portuguese. */
  voice?: string;
  /** 1 is normal speed. */
  speed?: number;
  /** Base URL of the server's API. */
  url?: string;
};

export const defaultKokoroUrl = "http://127.0.0.1:8880/v1";
export const defaultKokoroVoice = "pf_dora";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** How long to wait while the server loads its model (it answers 503 meanwhile). */
const loadingLimit = 20 * 60_000;

export function kokoro({
  voice = defaultKokoroVoice,
  speed = 1,
  url = defaultKokoroUrl,
}: KokoroOptions): SpeechProvider {
  const endpoint = `${url.replace(/\/+$/, "")}/audio/speech`;
  const body = {
    model: "kokoro",
    // The voice's first letter sets the language ("p" is Brazilian Portuguese).
    voice,
    speed,
    response_format: "wav",
  };

  return {
    id: `kokoro:${voice}:${speed}`,
    extension: "wav",
    async synthesize(text, output) {
      const started = Date.now();

      for (;;) {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...body, input: text }),
        }).catch((error: Error) => {
          throw new Error(
            `Não consegui falar com o Kokoro em ${endpoint}: ${error.message}. Ele está rodando? Inicie com: docker run -d -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest`,
          );
        });

        if (response.ok) {
          fs.writeFileSync(output, Buffer.from(await response.arrayBuffer()));
          return;
        }

        const busy = response.status === 503 || response.status === 429;

        if (busy && Date.now() - started < loadingLimit) {
          const retry = Number(response.headers.get("retry-after") ?? NaN);
          await sleep((Number.isFinite(retry) ? retry : 5) * 1000);
          continue;
        }

        throw new Error(
          `O Kokoro respondeu ${response.status}: ${(await response.text()).slice(0, 300)}`,
        );
      }
    },
  };
}

/** Whether a Kokoro server answers at `url`, checked quickly. */
export async function kokoroOnline(url = defaultKokoroUrl) {
  try {
    const response = await fetch(`${url.replace(/\/+$/, "")}/audio/voices`, {
      signal: AbortSignal.timeout(1500),
    });

    return response.ok;
  } catch {
    return false;
  }
}
