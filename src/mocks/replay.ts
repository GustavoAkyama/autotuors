import fs from "node:fs";
import type { BrowserContext, Request } from "playwright-core";
import { fromRoot } from "../paths.ts";
import type { Mock, TourScript } from "../script/types.ts";
import { goesLive, readMethods } from "./live.ts";

/** A mock's URL as a regex: `*` matches one path segment and `**` anything. */
export const urlPattern = (url: string) =>
  new RegExp(
    `^${url
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "\u0000")
      .replace(/\*/g, "[^/]*")
      .replace(/\u0000/g, ".*")}$`,
  );

/** Lets the page read a mocked answer from another origin, like the real one did. */
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers().origin;
  return origin
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-credentials": "true",
      }
    : {};
}

function mockBody(mock: Mock) {
  if (mock.json !== undefined) return JSON.stringify(mock.json);

  return mock.body ? fs.readFileSync(fromRoot(mock.body)) : "";
}

/**
 * Answers requests with the script's mocks. With `blockUnmocked`, any other
 * request that changes data gets an empty success instead of reaching the site.
 */
export async function replayMocks(
  context: BrowserContext,
  script: Pick<TourScript, "mocks" | "blockUnmocked">,
) {
  const mocks = (script.mocks ?? []).map((mock) => ({
    ...mock,
    method: mock.method.toUpperCase(),
    pattern: urlPattern(mock.url),
    used: false,
  }));

  if (!mocks.length && !script.blockUnmocked) return;

  await context.route(
    () => true,
    async (route) => {
      const request = route.request();

      if (goesLive(request.url())) return route.fallback();

      const method = request.method();
      const url = request.url().split(/[?#]/)[0];

      // Mocks of the same request answer in the order they were recorded.
      const matching = mocks.filter(
        (mock) => mock.method === method && mock.pattern.test(url),
      );

      const mock =
        matching.find((candidate) => !candidate.used) ?? matching.at(-1);

      if (mock) {
        mock.used = true;

        return route.fulfill({
          status: mock.status ?? 200,
          headers: {
            ...corsHeaders(request),
            ...mock.headers,
            ...(mock.json !== undefined
              ? { "content-type": "application/json" }
              : {}),
          },
          body: mockBody(mock),
        });
      }

      if (script.blockUnmocked && !readMethods.includes(method))
        return route.fulfill({
          status: 200,
          headers: {
            ...corsHeaders(request),
            "content-type": "application/json",
          },
          body: "{}",
        });

      return route.fallback();
    },
  );
}
