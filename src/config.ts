import userConfig from "../tour.config.ts";
import type { VoiceConfig } from "./narration/index.ts";
import type { MusicSetting } from "./video/music.ts";

export type Theme = {
  primary?: string;
  accent?: string;
  surface?: string;
  text?: string;
  font?: string;
};

/** What `tour.config.ts` can set. Every field is optional. */
export type TourConfig = {
  /** Language of the browser and of the captions the recorder writes. */
  locale?: string;
  colorScheme?: "light" | "dark";
  /** Colors and font of the captions and of the opening and closing cards. */
  theme?: Theme;
  /** Voice used when a tour narrates. */
  voice?: VoiceConfig;
  /** Background music for every tour. */
  music?: MusicSetting;
};

const user: TourConfig = userConfig;

export const config = {
  locale: user.locale ?? "pt-BR",
  colorScheme: user.colorScheme ?? "light",
  theme: user.theme ?? {},
  voice: user.voice ?? { provider: "piper" },
  music: user.music ?? null,
};
