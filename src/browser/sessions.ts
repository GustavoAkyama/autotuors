import fs from "node:fs";
import { folders, listNames, sessionFile } from "../paths.ts";

// A session is a login saved from a Chrome window (cookies, storage and IndexedDB).

export const listSessions = () => listNames(folders.sessions);

export const deleteSession = (name: string) =>
  fs.rmSync(sessionFile(name), { force: true });

/** The session's file, or an error that says how to log in again. */
export function requireSession(name: string) {
  const file = sessionFile(name);
  if (!fs.existsSync(file))
    throw new Error(
      `Login “${name}” não encontrado. Faça o login de novo pela interface (pnpm ui) ou com: pnpm session ${name} <url>`,
    );
  return file;
}

/** Whether an address looks like a login page, e.g. after a session expired. */
export function looksLikeLogin(address: string) {
  const { hostname, pathname } = new URL(address);
  return (
    /^(?:login|signin|auth|sso|accounts)\./i.test(hostname) ||
    /\/(?:log-?in|sign-?in|entrar|auth|sso)(?:[/.]|$)/i.test(pathname)
  );
}
