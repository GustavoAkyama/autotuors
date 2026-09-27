import type http from "node:http";
import path from "node:path";
import { deleteSession, listSessions } from "../browser/sessions.ts";
import { siteUrl } from "../browser/url.ts";
import { capturesDir, folders, isValidName, root } from "../paths.ts";
import { config } from "../config.ts";
import { voiceChoicesWithStatus, voiceIdOf } from "../narration/choices.ts";
import { missingRequirements } from "../requirements.ts";
import { scriptExists } from "../script/files.ts";
import { findTrack, trackFile, tracks } from "../video/music.ts";
import { HttpError, readJson, sendFile } from "./http.ts";
import {
  cancelJob,
  currentJob,
  startLogin,
  startPlay,
  startRecording,
  stopJob,
} from "./jobs.ts";
import {
  deleteTour,
  getTour,
  listTours,
  requireName,
  requireTour,
  saveCaptions,
} from "./tours.ts";

type Context = {
  request: http.IncomingMessage;
  response: http.ServerResponse;
  /** The route's capture groups. */
  params: string[];
};

/** A route answers with JSON by returning it, or sends a file itself. */
type Route = {
  method: string;
  path: RegExp;
  handle: (context: Context) => unknown;
};

const uiDir = path.join(root, "ui");

function toUrl(input: unknown, what: string) {
  if (typeof input !== "string" || !input.trim())
    throw new HttpError(400, `Informe ${what}.`);
  try {
    return siteUrl(input);
  } catch (error) {
    throw new HttpError(400, (error as Error).message);
  }
}

/** Name of the music set in tour.config.ts, if any. */
function defaultMusic() {
  const music = config.music;
  if (!music) return null;
  if ("track" in music) return findTrack(music.track)?.title ?? music.track;
  return path.basename(music.file);
}

// Checking for ffmpeg and the voice takes a moment; once in a while is enough.
let requirements = { checkedAt: 0, missing: [] as string[] };
function missing() {
  if (Date.now() - requirements.checkedAt > 10_000)
    requirements = { checkedAt: Date.now(), missing: missingRequirements() };
  return requirements.missing;
}

export const routes: Route[] = [
  // Pages and files.
  {
    method: "GET",
    path: /^\/$/,
    handle: ({ request, response }) =>
      sendFile(request, response, uiDir, "index.html"),
  },
  {
    method: "GET",
    path: /^\/ui\/(.+)$/,
    handle: ({ request, response, params }) =>
      sendFile(request, response, uiDir, params[0]),
  },
  {
    method: "GET",
    path: /^\/videos\/([\w-]+)\.mp4$/,
    handle: ({ request, response, params }) =>
      sendFile(request, response, folders.output, `${params[0]}.mp4`),
  },
  {
    method: "GET",
    path: /^\/errors\/([\w-]+)\.png$/,
    handle: ({ request, response, params }) =>
      sendFile(request, response, folders.output, `${params[0]}-erro.png`),
  },
  {
    method: "GET",
    path: /^\/captures\/([\w-]+)\/([\w-]+\.jpg)$/,
    handle: ({ request, response, params }) =>
      sendFile(request, response, capturesDir(params[0]), params[1]),
  },

  {
    method: "GET",
    path: /^\/music\/([\w-]+)\.mp3$/,
    handle: async ({ request, response, params }) => {
      if (!findTrack(params[0]))
        throw new HttpError(404, "Música não encontrada.");
      const file = await trackFile(params[0]).catch((error: Error) => {
        throw new HttpError(502, error.message);
      });
      sendFile(request, response, path.dirname(file), path.basename(file));
    },
  },

  // What the page shows, polled every second.
  {
    method: "GET",
    path: /^\/api\/state$/,
    handle: () => ({
      job: currentJob(),
      sessions: listSessions(),
      tours: listTours(),
      missing: missing(),
    }),
  },

  // The voices and songs the editor offers.
  {
    method: "GET",
    path: /^\/api\/choices$/,
    handle: async () => ({
      voices: await voiceChoicesWithStatus(),
      music: tracks,
      // What "default" means, as set in tour.config.ts.
      defaults: { voice: voiceIdOf(config.voice), music: defaultMusic() },
    }),
  },

  // Jobs.
  {
    method: "POST",
    path: /^\/api\/login$/,
    handle: async ({ request }) => {
      const body = await readJson(request);
      requireName(body.session, "Nome do login");
      await startLogin(body.session, toUrl(body.url, "a página de login"));
    },
  },
  {
    method: "POST",
    path: /^\/api\/record$/,
    handle: async ({ request }) => {
      const body = await readJson(request);
      requireName(body.name, "Nome do tour");
      const url = toUrl(body.url, "o endereço onde o tour começa");
      if (scriptExists(body.name) && body.force !== true)
        throw new HttpError(409, `Já existe um tour “${body.name}”.`);
      await startRecording({
        name: body.name,
        url,
        session: isValidName(body.session) ? body.session : undefined,
        goal: typeof body.goal === "string" ? body.goal.trim() : undefined,
        width: Number(body.width) || 1280,
      });
    },
  },
  {
    method: "POST",
    path: /^\/api\/play$/,
    handle: async ({ request }) => {
      const body = await readJson(request);
      startPlay(requireTour(body.name));
    },
  },
  { method: "POST", path: /^\/api\/stop$/, handle: () => stopJob() },
  { method: "POST", path: /^\/api\/cancel$/, handle: () => cancelJob() },

  // Tours and logins.
  {
    method: "GET",
    path: /^\/api\/tours\/([^/]+)$/,
    handle: ({ params }) => getTour(requireTour(params[0])),
  },
  {
    method: "PUT",
    path: /^\/api\/tours\/([^/]+)$/,
    handle: async ({ request, params }) => ({
      modified: saveCaptions(requireTour(params[0]), await readJson(request)),
    }),
  },
  {
    method: "DELETE",
    path: /^\/api\/tours\/([^/]+)$/,
    handle: ({ params }) => {
      const name = requireTour(params[0]);
      const job = currentJob();
      if (
        job?.status === "running" &&
        job.kind !== "login" &&
        job.name === name
      )
        throw new HttpError(
          409,
          "Espere a tarefa deste tour terminar ou cancele-a.",
        );
      deleteTour(name);
    },
  },
  {
    method: "DELETE",
    path: /^\/api\/sessions\/([^/]+)$/,
    handle: ({ params }) => {
      requireName(params[0], "Nome do login");
      deleteSession(params[0]);
    },
  },
];
