import type { FilterGraph } from "./filter-graph.ts";

/** An audio file that starts playing at `time` (wall clock while recording, seconds into the video when composing). */
export type Cue = { time: number; file: string };
export type Music = { file: string; volume?: number };

const format =
  "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo";

/**
 * Adds the narration and the music to the graph, the music ducking while someone
 * talks. Returns the label of the final audio, or null for a silent video.
 */
export function mixAudio(
  graph: FilterGraph,
  cues: Cue[],
  music: Music | null,
  length: number,
) {
  let audio: string | null = null;
  if (cues.length) {
    const voices = cues.map((cue, index) => {
      const source = graph.input("-i", cue.file);
      const delay = Math.max(Math.round(cue.time * 1000), 0);

      graph.add(
        `[${source}:a]${format},adelay=delays=${delay}:all=1[a${index}]`,
      );

      return `[a${index}]`;
    });

    graph.add(
      `${voices.join("")}amix=inputs=${voices.length}:normalize=0:dropout_transition=0[voice]`,
    );
    audio = "voice";
  }

  if (music) {
    const source = graph.input("-stream_loop", "-1", "-i", music.file);

    graph.add(
      `[${source}:a]${format},volume=${music.volume ?? 0.15},afade=t=in:d=1.5[music]`,
    );

    if (audio) {
      graph.add(
        "[voice]asplit=2[voicekey][voicemix]",
        "[music][voicekey]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=450[ducked]",
        "[ducked][voicemix]amix=inputs=2:normalize=0:duration=first[mixed]",
      );
      audio = "mixed";
    } else {
      audio = "music";
    }
  }

  if (!audio) return null;

  const total = length.toFixed(3);
  const fadeOut = Math.max(length - 1.2, 0).toFixed(3);

  graph.add(
    `[${audio}]apad=whole_dur=${total},atrim=end=${total},afade=t=out:st=${fadeOut}:d=1.2,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[audio]`,
  );

  return "audio";
}
