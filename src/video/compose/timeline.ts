import fs from "node:fs";
import path from "node:path";
import type { Screencast } from "../screencast.ts";

/** A wall-clock span (seconds) cut from the video, e.g. while narration was synthesized. */
export type Pause = { start: number; end: number };

/** Maps wall-clock times to seconds into the segment, skipping pauses. */
export function timeline(cast: Screencast, pauses: Pause[]) {
  const skipped = (time: number) =>
    pauses.reduce(
      (total, pause) =>
        total + Math.max(0, Math.min(time, pause.end) - pause.start),
      0,
    );
  const origin = cast.frames[0].time - skipped(cast.frames[0].time);
  return (time: number) => time - skipped(time) - origin;
}

/** Writes an ffconcat list that holds each frame until the next one arrived. */
export function concatList(cast: Screencast, at: (time: number) => number) {
  const lines = ["ffconcat version 1.0"];
  cast.frames.forEach((frame, index) => {
    const next = cast.frames[index + 1]?.time ?? cast.endTime;
    lines.push(
      `file '${frame.file}'`,
      `duration ${Math.max(at(next) - at(frame.time), 0.001).toFixed(4)}`,
    );
  });

  lines.push(`file '${cast.frames.at(-1)!.file}'`);

  const list = path.join(cast.dir, "frames.ffconcat");
  fs.writeFileSync(list, lines.join("\n"));
  return list;
}
