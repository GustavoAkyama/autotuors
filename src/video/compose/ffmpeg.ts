import { spawn } from "node:child_process";

/**
 * H.264 tagged as BT.709, so players show the colors the browser rendered.
 * 4:2:0 in the High profile plays everywhere: without `-pix_fmt`, the filters
 * can hand x264 4:4:4, which phones, WhatsApp and Discord refuse to play.
 */
export const h264Output = [
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-profile:v",
  "high",
  "-level:v",
  "4.1",
  "-preset",
  "slow",
  "-crf",
  "16",
  "-x264-params",
  "colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv",
  "-color_range",
  "tv",
  "-colorspace",
  "bt709",
  "-color_primaries",
  "bt709",
  "-color_trc",
  "bt709",
];

/** Runs ffmpeg, reporting how much of the `duration` seconds is encoded (0–1). */
export function runFfmpeg(
  args: string[],
  duration: number,
  onProgress?: (fraction: number) => void,
) {
  const ffmpeg = spawn(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-nostats", "-progress", "pipe:1", ...args],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  let errors = "";
  let encoded = 0;

  ffmpeg.stderr.on("data", (chunk) => (errors += chunk));
  ffmpeg.stdout.on("data", (chunk) => {
    const time = [...String(chunk).matchAll(/out_time_us=(\d+)/g)].at(-1);

    if (!time) return;
    // The encoder's clock can step back a little; progress only moves forward.
    encoded = Math.max(encoded, Math.min(Number(time[1]) / 1e6 / duration, 1));
    onProgress?.(encoded);
  });

  return new Promise<void>((resolve, reject) => {
    ffmpeg.on("error", (error: NodeJS.ErrnoException) =>
      reject(
        error.code === "ENOENT"
          ? new Error(
              "ffmpeg não encontrado. Instale o ffmpeg 7+ e deixe-o no PATH.",
            )
          : error,
      ),
    );
    ffmpeg.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ffmpeg falhou: ${errors.trim()}`)),
    );
  });
}
