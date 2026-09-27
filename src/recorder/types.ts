import type { RecordedResponse } from "../mocks/capture.ts";

/** Locator as the Playwright recorder describes it, e.g. `{ kind: "role", body: "button", options: { name: "Postar" } }`. */
export type LocatorInfo = {
  kind: string;
  body: string;
  options?: { name?: string };
  next?: LocatorInfo;
};

/** What the page looked like when an action happened. */
export type StepContext = {
  url: string;
  title: string;
  /** Name of the dialog, menu or listbox the element is in. */
  region: string;
  /** Inside a toast or alert, which closes by itself. */
  transient?: boolean;
  /** Where the element was on the screenshot, in CSS pixels. */
  rect?: { x: number; y: number; width: number; height: number };
  /** Screenshot with the element outlined, taken as the user acted. */
  screenshot?: Buffer;
};

/** An action reported by the Playwright recorder, plus what we learned about its element. */
export type RecordedAction = {
  name: string;
  /** "main" or the alias of a popup ("popup1", ...). */
  page: string;
  selector?: string;
  locator?: LocatorInfo;
  text?: string;
  key?: string;
  modifiers?: number;
  options?: string[];
  files?: string[];
  url?: string;
  button?: "left" | "right" | "middle";
  clickCount?: number;
  signals?: { name: string; popupPageGuid?: string }[];
  /** Alias of the popup this action opened. */
  popup?: string;
  label?: string;
  role?: string;
  password?: boolean;
  /** Visible text of the option a select was set to. */
  option?: string;
  /** Where the action happened, for writing its caption. */
  context?: StepContext;
};

export type Recording = {
  url: string;
  width: number;
  title: string;
  /** When the recording started (ISO); replays show the site this same moment. */
  time: string;
  actions: RecordedAction[];
  responses: RecordedResponse[];
};

/** What the page reports about the element behind a click, input or key press. */
export type Interaction = {
  type: string;
  /** The click's `event.detail`: 0 for clicks the page fired itself. */
  detail: number;
  label: string;
  role: string;
  password: boolean;
  option: string;
  url: string;
  title: string;
  region: string;
  transient: boolean;
  rect: { x: number; y: number; width: number; height: number };
  context?: StepContext;
};

declare global {
  interface Window {
    __tourInteraction?: (interaction: Interaction) => void;
    __tourSnapshot?: () => void;
  }
}
