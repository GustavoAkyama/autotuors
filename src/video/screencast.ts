import fs from "node:fs";
import path from "node:path";
import type { CDPSession, Page } from "playwright-core";
import type { Rect, Size } from "./geometry.ts";

type Frame = { file: string; time: number };

/** The frames Chrome sent for a page, with the wall-clock time of each. */
export type Screencast = {
  dir: string;
  frames: Frame[];
  endTime: number;
  stop: () => Promise<void>;
};

/** A popup's screencast and where its window was drawn on the page. */
export type Clip = { cast: Screencast; rect: Rect };

/** Saves every frame Chrome paints for the page to `dir`, until `stop()`. */
export async function startScreencast(
  page: Page,
  session: CDPSession,
  dir: string,
  size: Size,
): Promise<Screencast> {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const cast: Screencast = {
    dir,
    frames: [],
    endTime: 0,
    stop: async () => {
      if (cast.endTime) return;
      cast.endTime = Date.now() / 1000;
      await session.send("Page.stopScreencast").catch(() => {});
    },
  };

  session.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    if (cast.endTime) return;
    const file = `${String(cast.frames.length).padStart(6, "0")}.jpg`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(data, "base64"));
    cast.frames.push({ file, time: metadata.timestamp ?? Date.now() / 1000 });
    void session.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  page.once("close", () => {
    cast.endTime ||= Date.now() / 1000;
  });

  await session.send("Page.startScreencast", {
    format: "jpeg",
    quality: 95,
    maxWidth: size.width,
    maxHeight: size.height,
  });

  return cast;
}
