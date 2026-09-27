import { spawn } from "node:child_process";
import http from "node:http";
import { HttpError, sendJson } from "./http.ts";
import { routes } from "./routes.ts";

async function handle(
  request: http.IncomingMessage,
  response: http.ServerResponse,
) {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  for (const route of routes) {
    const match = route.path.exec(decodeURIComponent(pathname));

    if (!match || route.method !== request.method) continue;

    const result = await route.handle({
      request,
      response,
      params: match.slice(1),
    });

    if (!response.headersSent) sendJson(response, 200, result ?? { ok: true });

    return;
  }

  throw new HttpError(404, "Página não encontrada.");
}

/** Serves the UI at http://localhost:<port>, only to this machine. */
export function startServer({ port, open }: { port: number; open: boolean }) {
  const server = http.createServer((request, response) =>
    handle(request, response).catch((error: Error) => {
      const status = error instanceof HttpError ? error.status : 500;
      if (!response.headersSent)
        sendJson(response, status, { error: error.message });
      else response.end();
    }),
  );

  server.listen(port, "127.0.0.1", () => {
    const address = `http://localhost:${port}`;

    console.log(`Interface em ${address} (Ctrl+C para sair)`);

    if (open) openInBrowser(address);
  });

  return server;
}

function openInBrowser(address: string) {
  const [command, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", address]]
      : [process.platform === "darwin" ? "open" : "xdg-open", [address]];
  spawn(command as string, args as string[], {
    stdio: "ignore",
    detached: true,
  }).unref();
}
