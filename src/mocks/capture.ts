import type { BrowserContext, Response } from "playwright-core";
import { goesLive, readMethods } from "./live.ts";

export type RecordedResponse = {
  method: string;
  url: string;
  status: number;
  headers: Record<string, string>;
  body: Buffer;
};

/**
 * Keeps the response of every request that changes data while recording. Playing
 * the tour answers those requests with these responses, so it never posts,
 * pays or deletes anything for real.
 */
export function captureResponses(context: BrowserContext) {
  const responses: RecordedResponse[] = [];
  const pending: Promise<void>[] = [];

  const capture = async (response: Response) => {
    const request = response.request();
    const method = request.method();

    if (readMethods.includes(method) || goesLive(request.url())) return;

    if (!["fetch", "xhr", "document"].includes(request.resourceType())) return;

    const body = await response.body().catch(() => null);

    if (!body) return;

    const headers = Object.fromEntries(
      Object.entries(await response.allHeaders()).filter(
        ([name]) =>
          name === "content-type" || name.startsWith("access-control-"),
      ),
    );

    responses.push({
      method,
      url: request.url(),
      status: response.status(),
      headers,
      body,
    });
  };

  context.on("response", (response) =>
    pending.push(capture(response).catch(() => {})),
  );

  return {
    responses,
    /** Resolves once every response seen so far has been read. */
    settled: () => Promise.all(pending),
  };
}
