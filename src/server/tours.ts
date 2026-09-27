import fs from "node:fs";
import { voiceChoices, voiceIdOf } from "../narration/choices.ts";
import {
  capturesDir,
  errorScreenshot,
  isValidName,
  mocksDir,
  scriptFile,
  videoFile,
} from "../paths.ts";
import { loadCaptures, type Capture } from "../script/captures.ts";
import {
  listScripts,
  loadScript,
  saveScript,
  scriptExists,
  scriptModifiedAt,
} from "../script/files.ts";
import { fragility } from "../script/targets.ts";
import { captionOf, targetOf, type TourScript } from "../script/types.ts";
import { findTrack } from "../video/music.ts";
import { HttpError } from "./http.ts";

export function requireName(
  name: unknown,
  what: string,
): asserts name is string {
  if (!isValidName(name))
    throw new HttpError(400, `${what}: use só letras, números, - e _.`);
}

export function requireTour(name: unknown) {
  requireName(name, "Nome do tour");

  if (!scriptExists(name))
    throw new HttpError(404, `Tour “${name}” não encontrado.`);

  return name;
}

const modifiedAt = (file: string) =>
  fs.existsSync(file) ? fs.statSync(file).mtimeMs : null;

/** URL of the first step's screenshot, to show the tour in the list. */
const thumbnailOf = (name: string) => {
  const shot = loadCaptures(name).find((capture) => capture.screenshot);

  return shot ? `/${shot.screenshot}` : null;
};

type Summary = ReturnType<typeof summarize>;
const summaries = new Map<string, { modified: number; summary: Summary }>();

function summarize(name: string, modified: number) {
  try {
    const script = loadScript(name);

    return {
      name,
      modified,
      title: script.intro?.title,
      goal: script.goal,
      url: script.url,
      steps: script.steps.length,
      thumbnail: thumbnailOf(name),
    };
  } catch (error) {
    return { name, modified, error: (error as Error).message };
  }
}

/** What the list of tours shows; a broken script still shows, with its error. */
export function listTours() {
  return listScripts().map((name) => {
    const modified = scriptModifiedAt(name);
    // Scripts are read again only when they change.
    let cached = summaries.get(name);

    if (cached?.modified !== modified) {
      cached = { modified, summary: summarize(name, modified) };
      summaries.set(name, cached);
    }

    return { ...cached.summary, video: modifiedAt(videoFile(name)) };
  });
}

/**
 * The script plus the capture of each step, matched by step number while the
 * targets agree, and by target once the steps were edited out of line.
 */
export function getTour(name: string) {
  const script = loadScript(name);
  const captures = loadCaptures(name);

  const byTarget = new Map(
    captures.filter((item) => item.target).map((item) => [item.target, item]),
  );

  const stepCaptures = script.steps.map((step, index): Capture | null => {
    const target = targetOf(step);
    const sameStep = captures.find((item) => item.step === index + 1);

    if (sameStep && sameStep.target === target) return sameStep;

    return (target && byTarget.get(target)) || null;
  });
  return {
    name,
    script,
    captures: stepCaptures,
    /** Why each step's target may stop matching, if it looks fragile. */
    fragile: script.steps.map((step) => {
      const target = targetOf(step);
      return target ? fragility(target) : null;
    }),
    audio: audioOf(script),
    modified: scriptModifiedAt(name),
    video: modifiedAt(videoFile(name)),
    /** When the last failed attempt took its screenshot, if there is one. */
    errorShot: modifiedAt(errorScreenshot(name)),
  };
}

/**
 * The voice and the music the editor shows selected: "default" follows
 * tour.config.ts, "none" turns it off, and "custom" is something set by hand
 * in the script that the lists do not have.
 */
function audioOf(script: TourScript) {
  let voice = "default";
  if (!script.narrate) voice = "none";
  else if (script.voice) voice = voiceIdOf(script.voice) ?? "custom";
  let music = "default";
  if (script.music === false) music = "none";
  else if (script.music)
    music =
      "track" in script.music && findTrack(script.music.track)
        ? script.music.track
        : "custom";
  return { voice, music };
}

/** Applies a voice or music picked in the editor; "custom" keeps the script as is. */
function applyAudio(
  script: TourScript,
  audio: { voice?: string; music?: string },
) {
  const { voice, music } = audio;
  if (voice === "none") script.narrate = false;
  else if (voice === "default") {
    script.narrate = true;
    delete script.voice;
  } else if (voice && voice !== "custom") {
    const choice = voiceChoices.find((item) => item.id === voice);
    if (!choice) throw new HttpError(400, `Voz desconhecida: “${voice}”.`);
    script.narrate = true;
    script.voice = choice.voice;
  }

  if (music === "none") script.music = false;
  else if (music === "default") delete script.music;
  else if (music && music !== "custom") {
    if (!findTrack(music))
      throw new HttpError(400, `Música desconhecida: “${music}”.`);
    const volume = script.music ? script.music.volume : undefined;
    script.music =
      volume === undefined ? { track: music } : { track: music, volume };
  }
}

type CaptionEdits = {
  /** Version the page loaded; saving over a newer one would undo those changes. */
  modified?: number;
  intro?: { title?: string; subtitle?: string };
  outro?: { title?: string; subtitle?: string };
  /** One per step, `null` for steps without a caption. */
  captions?: ({ title: string; description: string } | null)[];
  /** Choices of the voice and music selectors (see `audioOf`). */
  audio?: { voice?: string; music?: string };
};

/** Saves captions, voice and music edited in the UI; never the actions. */
export function saveCaptions(name: string, edits: CaptionEdits) {
  if (edits.modified !== undefined && edits.modified !== scriptModifiedAt(name))
    throw new HttpError(
      409,
      "O roteiro mudou fora da interface. Recarregue as legendas antes de salvar.",
    );

  const script: TourScript = loadScript(name);

  for (const key of ["intro", "outro"] as const) {
    const card = edits[key];
    if (card?.title && script[key]) script[key] = { ...script[key], ...card };
  }

  script.steps.forEach((step, index) => {
    const edited = edits.captions?.[index];
    const caption = captionOf(step);

    if (edited && caption)
      Object.assign(caption, {
        title: edited.title,
        description: edited.description,
      });
  });

  if (edits.audio) applyAudio(script, edits.audio);

  saveScript(name, script);

  return scriptModifiedAt(name);
}

/** Removes a tour and everything recorded for it. */
export function deleteTour(name: string) {
  for (const target of [
    scriptFile(name),
    videoFile(name),
    errorScreenshot(name),
    mocksDir(name),
    capturesDir(name),
  ])
    fs.rmSync(target, { recursive: true, force: true });
}
