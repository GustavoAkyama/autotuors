import fs from "node:fs";
import type http from "node:http";
import path from "node:path";

/** An error the API answers with its own status and message. */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function readJson<T = Record<string, unknown>>(
  request: http.IncomingMessage,
): Promise<T> {
  let body = "";
  for await (const chunk of request) body += chunk;
  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new HttpError(400, "O corpo da requisição não é um JSON válido.");
  }
}

export function sendJson(
  response: http.ServerResponse,
  status: number,
  data: unknown,
) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  // Functions (like a job's stop and cancel) are left out of the JSON.
  response.end(JSON.stringify(data));
}

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
};

/** Sends a file from `dir`; `file` can't climb out of it. */
export function sendFile(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  dir: string,
  file: string,
) {
  const full = path.resolve(dir, file);
  if (
    !full.startsWith(path.resolve(dir) + path.sep) ||
    !fs.existsSync(full) ||
    !fs.statSync(full).isFile()
  )
    throw new HttpError(404, "Arquivo não encontrado.");

  const type =
    mimeTypes[path.extname(full).toLowerCase()] ?? "application/octet-stream";
  const size = fs.statSync(full).size;

  // Ranges let the browser seek in videos.
  const range = /bytes=(\d*)-(\d*)/.exec(request.headers.range ?? "");
  const start = range?.[1] ? Number(range[1]) : 0;
  const end = range?.[2] ? Number(range[2]) : size - 1;

  response.writeHead(range ? 206 : 200, {
    "content-type": type,
    "content-length": end - start + 1,
    "accept-ranges": "bytes",
    "cache-control": "no-cache",
    ...(range ? { "content-range": `bytes ${start}-${end}/${size}` } : {}),
  });

  fs.createReadStream(full, { start, end }).pipe(response);
}
