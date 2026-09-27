import type { VoiceConfig } from "../narration/index.ts";
import type { MusicSetting } from "../video/music.ts";

// The script format: `pnpm record` writes one, `pnpm play` turns it into a video.

export type StepCaption = {
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  ring?: boolean;
  /** What the narrator says instead of the description; `false` keeps the step silent. */
  narration?: string | false;
};

/** An opening or closing card. */
export type Card = {
  title: string;
  subtitle?: string;
  /** What the narrator says; defaults to title and subtitle. `false` keeps it silent. */
  narration?: string | false;
  /** Image path relative to the project root. */
  logo?: string;
};

type OnPage = {
  /** "main" (default) or a popup alias set by a click's `popup`. */
  page?: string;
  caption?: StepCaption;
  /** Skipped when its target isn't there, like a toast that already closed itself. */
  optional?: boolean;
};

export type Step =
  | { action: "goto"; url: string; caption?: StepCaption }
  | (OnPage & {
      action: "click";
      target: string;
      /** Name for the popup this click opens, used by later steps' `page`. */
      popup?: string;
      /** Address shown on the popup window; defaults to the popup's host. */
      host?: string;
      button?: "left" | "right" | "middle";
      clickCount?: number;
    })
  | (OnPage & { action: "type"; target: string; text: string })
  | (OnPage & { action: "press"; key: string })
  | (OnPage & { action: "select"; target: string; values: string[] })
  | (OnPage & { action: "check" | "uncheck"; target: string })
  | (OnPage & { action: "hover"; target: string })
  | (OnPage & { action: "upload"; target: string; files: string[] })
  | (OnPage & { action: "caption"; target?: string; caption: StepCaption })
  | { action: "wait"; ms: number }
  | { action: "close"; page: string };

export type Mock = {
  method: string;
  /** URL without the query string; `*` matches one path segment and `**` anything. */
  url: string;
  status?: number;
  headers?: Record<string, string>;
  /** File with the response body, relative to the project root. */
  body?: string;
  /** Inline JSON body, handy for hand-written mocks. */
  json?: unknown;
};

export type TourScript = {
  url: string;
  /** What the tour teaches, in one sentence; guides whoever writes the captions. */
  goal?: string;
  width?: number;
  /** Date and time the site sees (ISO), so dates like "today" look as they did when recorded. */
  time?: string;
  /** Saved login to use. */
  session?: string;
  zoom?: boolean | number;
  narrate?: boolean;
  voice?: VoiceConfig;
  music?: MusicSetting | false;
  intro?: Card;
  outro?: Card;
  steps: Step[];
  /** Answers requests that change data and have no mock with an empty success. */
  blockUnmocked?: boolean;
  mocks?: Mock[];
};

export const stepActions = [
  "goto",
  "click",
  "type",
  "press",
  "select",
  "check",
  "uncheck",
  "hover",
  "upload",
  "caption",
  "wait",
  "close",
] as const satisfies Step["action"][];

/** The step's caption, if its kind of step can have one. */
export const captionOf = (step: Step) =>
  "caption" in step ? step.caption : undefined;

/** The step's target selector, if it has one. */
export const targetOf = (step: Step) =>
  "target" in step ? step.target : undefined;
