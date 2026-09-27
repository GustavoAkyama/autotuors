import fs from "node:fs";
import path from "node:path";
import { folders, fromRoot } from "../paths.ts";
import type { Music } from "./compose/audio.ts";

/**
 * Background music as a script or `tour.config.ts` sets it: a file of yours,
 * or a `track` from the list below, downloaded the first time it is used.
 */
export type MusicSetting =
  | { file: string; volume?: number }
  | { track: string; volume?: number };

/** A song free to use in videos, as long as the video credits it (`credit`). */
export type Track = {
  id: string;
  title: string;
  artist: string;
  mood: string;
  license: string;
  licenseUrl: string;
  /** Where to listen to it and read its license. */
  page: string;
  download: string;
  /** Text to put in the video's description or closing card. */
  credit: string;
};

const ccBy = "https://creativecommons.org/licenses/by/4.0/";

// Kevin MacLeod's songs (incompetech.com) are under CC BY 4.0: free to use,
// commercial videos included, with the credit below.
const macLeod = (id: string, title: string, mood: string): Track => ({
  id,
  title,
  artist: "Kevin MacLeod",
  mood,
  license: "CC BY 4.0",
  licenseUrl: ccBy,
  page: `https://incompetech.com/music/royalty-free/index.html?keywords=${encodeURIComponent(title)}`,
  download: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(title)}.mp3`,
  credit: `"${title}" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0 License ${ccBy}`,
});

export const tracks: Track[] = [
  macLeod("easy-lemon", "Easy Lemon", "Leve e alegre"),
  macLeod("carefree", "Carefree", "Animada, com ukulele"),
  macLeod("wallpaper", "Wallpaper", "Eletrônica calma, bem discreta"),
  macLeod("airport-lounge", "Airport Lounge", "Lounge tranquilo"),
  macLeod("local-forecast", "Local Forecast - Elevator", "Jazz suave"),
  macLeod("bossa-antigua", "Bossa Antigua", "Bossa nova"),
  macLeod("inspired", "Inspired", "Piano e cordas, inspiradora"),
];

export const musicDir = path.join(folders.cache, "music");

export const findTrack = (id: string) =>
  tracks.find((track) => track.id === id);

/** The track's file, downloaded into .cache/music the first time. */
export async function trackFile(id: string) {
  const track = findTrack(id);
  if (!track)
    throw new Error(
      `Música desconhecida: "${id}". Opções: ${tracks.map((item) => item.id).join(", ")}`,
    );
  const file = path.join(musicDir, `${track.id}.mp3`);
  if (fs.existsSync(file)) return file;
  const response = await fetch(track.download).catch((error: Error) => {
    throw new Error(
      `Não consegui baixar a música “${track.title}”: ${error.message}`,
    );
  });
  if (!response.ok)
    throw new Error(
      `Não consegui baixar a música “${track.title}”: HTTP ${response.status}`,
    );
  fs.mkdirSync(musicDir, { recursive: true });
  // Written aside first, so an interrupted download never looks finished.
  const partial = `${file}.partial`;
  fs.writeFileSync(partial, Buffer.from(await response.arrayBuffer()));
  fs.renameSync(partial, file);
  return file;
}

/** The file to play for a music setting. */
export async function resolveMusic(setting: MusicSetting): Promise<Music> {
  const file =
    "track" in setting
      ? await trackFile(setting.track)
      : fromRoot(setting.file);
  return { file, volume: setting.volume };
}
