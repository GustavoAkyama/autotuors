import type { Mock } from "../script/types.ts";
import type { RecordedResponse } from "./capture.ts";

// Ids and hashes in paths change between sessions (e.g. GraphQL query ids).
const looksLikeId = (segment: string) =>
  /^\d{3,}$/.test(segment) ||
  /^[0-9a-f-]{32,36}$/i.test(segment) ||
  (segment.length >= 16 && /\d/.test(segment) && /[a-z]/i.test(segment));

/** The URL without its query, with ids turned into `*`. */
export function generalizeUrl(address: string) {
  const url = new URL(address);
  const segments = url.pathname
    .split("/")
    .map((segment) => (looksLikeId(segment) ? "*" : segment));

  return `${url.origin}${segments.join("/")}`;
}

const extensionFor = (contentType = "") =>
  contentType.includes("json")
    ? "json"
    : contentType.includes("html")
      ? "html"
      : contentType.startsWith("text/")
        ? "txt"
        : "bin";

/**
 * Turns recorded responses into the script's mocks. Bodies go to files in
 * `mocks/<name>/`, keyed here by their path relative to the project root.
 */
export function mocksFromResponses(
  name: string,
  responses: RecordedResponse[],
) {
  const bodies = new Map<string, Buffer>();
  const mocks: Mock[] = responses.map((response, index) => {
    const slug =
      new URL(response.url).pathname
        .split("/")
        .filter(Boolean)
        .at(-1)
        ?.replace(/[^\w.-]+/g, "_") || "root";

    let body: string | undefined;

    if (response.body.length) {
      const number = String(index + 1).padStart(2, "0");
      body = `mocks/${name}/${number}-${slug}.${extensionFor(response.headers["content-type"])}`;
      bodies.set(body, response.body);
    }

    return {
      method: response.method,
      url: generalizeUrl(response.url),
      status: response.status,
      headers: response.headers,
      body,
    };
  });

  return { mocks, bodies };
}
