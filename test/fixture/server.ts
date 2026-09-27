import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

/**
 * Serves the small "Tarefas Demo" site in this folder. POST /api/tasks creates a
 * task and is counted, so tests can check that playing a tour never posts.
 */
export async function startFixtureSite() {
  let posts = 0;
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "POST" && url.pathname === "/api/tasks") {
      let body = "";
      for await (const chunk of request) body += chunk;
      posts += 1;
      response.writeHead(201, { "content-type": "application/json" });
      return response.end(JSON.stringify({ id: posts, ...JSON.parse(body) }));
    }
    const file = path.join(
      import.meta.dirname,
      url.pathname === "/" ? "index.html" : path.basename(url.pathname),
    );
    if (!file.endsWith(".html") || !fs.existsSync(file))
      return response.writeHead(404).end();
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    posts: () => posts,
    close: () => server.close(),
  };
}
