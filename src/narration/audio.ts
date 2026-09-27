import { execFileSync } from "node:child_process";

/** Length of an audio file in seconds. */
export function audioDuration(file: string) {
  const output = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { encoding: "utf8" },
  );

  return Number.parseFloat(output);
}
