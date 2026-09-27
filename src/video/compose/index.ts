import fs from "node:fs";
import path from "node:path";
import { even, type Size } from "../geometry.ts";
import type { Clip, Screencast } from "../screencast.ts";
import { mixAudio, type Cue, type Music } from "./audio.ts";
import { cameraFilter, planCamera, type Focus } from "./camera.ts";
import { h264Output, runFfmpeg } from "./ffmpeg.ts";
import { FilterGraph } from "./filter-graph.ts";
import { concatList, timeline, type Pause } from "./timeline.ts";

export type { Cue, Focus, Music, Pause };

/** A recorded part of the video (intro, tour, outro); parts are joined with a crossfade. */
export type Segment = {
  cast: Screencast;
  /** Popups, drawn over the page inside their window. */
  clips?: Clip[];
  pauses?: Pause[];
  focuses?: Focus[];
  cues?: Cue[];
};

export type ComposeOptions = {
  segments: Segment[];
  /** Page size in CSS pixels. */
  viewport: Size;
  /** Captured pixels per CSS pixel. */
  captureScale: number;
  /** Maximum camera zoom; 1 disables the camera. */
  zoom: number;
  size: Size;
  fps: number;
  music: Music | null;
  output: string;
  /** Where the frame lists and the filter script are written. */
  workDir: string;
  /** Called with 0–1 as ffmpeg encodes. */
  onProgress?: (fraction: number) => void;
};

const crossfade = 0.5;

/** Joins the recorded segments, camera moves and audio into one MP4. */
export async function composeVideo(options: ComposeOptions) {
  const graph = new FilterGraph();
  const parts = options.segments
    .filter((segment) => segment.cast.frames.length)
    .map((segment, index) => segmentVideo(graph, segment, index, options));

  // Each part starts as the one before it fades out.
  let length = 0;
  const cues: Cue[] = [];
  const starts = parts.map((part, index) => {
    const start = index === 0 ? 0 : length - crossfade;
    length = start + part.duration;
    cues.push(...part.cues.map((cue) => ({ ...cue, time: start + cue.time })));
    return start;
  });

  let video = parts[0].label;

  for (let index = 1; index < parts.length; index++) {
    graph.add(
      `[${video}][${parts[index].label}]xfade=transition=fade:duration=${crossfade}:offset=${starts[index].toFixed(3)}[x${index}]`,
    );
    video = `x${index}`;
  }

  const audio = mixAudio(graph, cues, options.music, length);

  const script = path.join(options.workDir, "filters.txt");
  fs.writeFileSync(script, graph.filters.join(";\n"));
  await runFfmpeg(
    [
      ...graph.inputs,
      "-/filter_complex",
      script,
      "-map",
      `[${video}]`,
      ...(audio ? ["-map", `[${audio}]`, "-c:a", "aac", "-b:a", "192k"] : []),
      ...h264Output,
      "-t",
      length.toFixed(3),
      "-movflags",
      "+faststart",
      options.output,
    ],
    length,
    options.onProgress,
  );
}

/**
 * Adds one segment to the graph: its frames, its popups over them and the camera.
 * Returns the label of its video, its length and its audio cues, in seconds.
 */
function segmentVideo(
  graph: FilterGraph,
  segment: Segment,
  index: number,
  options: ComposeOptions,
) {
  const { viewport, captureScale, size, fps } = options;
  const capture = {
    width: even(viewport.width * captureScale),
    height: even(viewport.height * captureScale),
  };
  const at = timeline(segment.cast, segment.pauses ?? []);
  const input = (cast: Screencast) =>
    graph.input("-f", "concat", "-safe", "0", "-i", concatList(cast, at));

  let label = `s${index}`;
  graph.add(
    `[${input(segment.cast)}:v]format=rgb24,scale=${capture.width}:${capture.height}:flags=lanczos,fps=${fps}[${label}]`,
  );

  const clips = (segment.clips ?? []).filter((clip) => clip.cast.frames.length);
  clips.forEach((clip, clipIndex) => {
    const offset = at(clip.cast.frames[0].time).toFixed(3);
    const end = at(clip.cast.endTime).toFixed(3);
    const width = even(clip.rect.width * captureScale);
    const height = even(clip.rect.height * captureScale);
    const popup = `s${index}p${clipIndex}`;
    const next = `s${index}c${clipIndex}`;
    graph.add(
      `[${input(clip.cast)}:v]format=rgb24,fps=${fps},scale=${width}:${height}:flags=lanczos,setpts=PTS-STARTPTS+${offset}/TB[${popup}]`,
      `[${label}][${popup}]overlay=${Math.round(clip.rect.x * captureScale)}:${Math.round(clip.rect.y * captureScale)}:eof_action=pass:enable='between(t,${offset},${end})'[${next}]`,
    );
    label = next;
  });

  const focuses = (segment.focuses ?? []).map((focus) => ({
    ...focus,
    time: at(focus.time),
  }));
  const camera =
    focuses.length && options.zoom > 1
      ? cameraFilter(
          planCamera(focuses, viewport, options.zoom),
          viewport,
          size,
          fps,
        )
      : `scale=${size.width}:${size.height}:flags=lanczos`;
  // zoompan only takes YUV; 4:4:4 keeps it free to pan by single pixels.
  graph.add(
    `[${label}]scale=out_range=tv:out_color_matrix=bt709,format=yuv444p,${camera},format=yuv420p,setsar=1[v${index}]`,
  );

  return {
    label: `v${index}`,
    duration: at(segment.cast.endTime),
    cues: (segment.cues ?? []).map((cue) => ({
      file: cue.file,
      time: at(cue.time),
    })),
  };
}
