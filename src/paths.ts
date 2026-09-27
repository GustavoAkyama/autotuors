import fs from "node:fs";
import path from "node:path";

/** Project root: tour.config.ts and the folders below live here. */
export const root = path.resolve(import.meta.dirname, "..");

/** Where each kind of file goes. Everything but `tours/` is ignored by git. */
export const folders = {
  /** Scripts (`<name>.json`), written by the recorder and edited by hand or in the UI. */
  tours: path.join(root, "tours"),
  /** Recorded responses replayed in place of requests that change data. */
  mocks: path.join(root, "mocks"),
  /** A screenshot and the context of each recorded step, for writing captions. */
  captures: path.join(root, "captures"),
  /** Saved logins (cookies and storage). Never share these. */
  sessions: path.join(root, "sessions"),
  /** Finished videos, plus the frames of the one being made. */
  output: path.join(root, "output"),
  /** Narration audio and the Piper voice. */
  cache: path.join(root, ".cache"),
};

export const scriptFile = (name: string) =>
  path.join(folders.tours, `${name}.json`);
export const sessionFile = (name: string) =>
  path.join(folders.sessions, `${name}.json`);
export const videoFile = (name: string) =>
  path.join(folders.output, `${name}.mp4`);
/** Screenshot of the moment a step failed. */
export const errorScreenshot = (name: string) =>
  path.join(folders.output, `${name}-erro.png`);
/** Frames and ffmpeg files of a video being made; removed when it's done. */
export const framesDir = (name: string) => path.join(folders.output, name);
export const capturesDir = (name: string) => path.join(folders.captures, name);
export const mocksDir = (name: string) => path.join(folders.mocks, name);

/** Paths inside scripts (mock bodies, uploads, logos) are relative to the root. */
export const fromRoot = (file: string) => path.resolve(root, file);

/** Tour and session names are file names too. */
export const isValidName = (name: unknown): name is string =>
  typeof name === "string" && /^[\w-]+$/.test(name);

/** Names of the `.json` files in a folder, sorted. */
export function listNames(folder: string) {
  if (!fs.existsSync(folder)) return [];
  return fs
    .readdirSync(folder)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length))
    .sort();
}
