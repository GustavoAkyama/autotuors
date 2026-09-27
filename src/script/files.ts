import fs from "node:fs";
import path from "node:path";
import { folders, listNames, root, scriptFile } from "../paths.ts";
import { stepActions, type TourScript } from "./types.ts";

export const listScripts = () => listNames(folders.tours);

export const scriptExists = (name: string) => fs.existsSync(scriptFile(name));

/** Changes whenever anything rewrites the script, like /legendas in Claude Code. */
export const scriptModifiedAt = (name: string) =>
  fs.statSync(scriptFile(name)).mtimeMs;

/** Reads a script from its name or from a path to a `.json` file. */
export function loadScript(nameOrFile: string): TourScript {
  const file = nameOrFile.endsWith(".json")
    ? path.resolve(nameOrFile)
    : scriptFile(nameOrFile);

  if (!fs.existsSync(file))
    throw new Error(`Roteiro não encontrado: ${path.relative(root, file)}`);

  const script = JSON.parse(fs.readFileSync(file, "utf8")) as TourScript;

  validateScript(script, path.basename(file));

  return script;
}

export function validateScript(script: TourScript, file: string) {
  if (typeof script.url !== "string")
    throw new Error(`${file}: falta o campo "url".`);

  if (!Array.isArray(script.steps))
    throw new Error(`${file}: falta a lista "steps".`);

  const known = new Set<string>(stepActions);

  script.steps.forEach((step, index) => {
    if (!known.has(step.action))
      throw new Error(
        `${file}: o passo ${index + 1} tem a ação desconhecida "${step.action}".`,
      );
  });
}

export function saveScript(name: string, script: TourScript) {
  const file = scriptFile(name);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(script, null, 2)}\n`);

  return file;
}
