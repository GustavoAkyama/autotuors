import fs from "node:fs";
import path from "node:path";
import { capturesDir, fromRoot, mocksDir } from "../paths.ts";
import type { Recording } from "../recorder/types.ts";
import { writeCaptures } from "./captures.ts";
import { saveScript } from "./files.ts";
import { scriptFromRecording, type ScriptOptions } from "./from-recording.ts";

/**
 * Saves a recording as tours/<name>.json, its mock bodies in mocks/<name>/ and
 * what each step looked like in captures/<name>/.
 */
export function saveRecording(
  name: string,
  recording: Recording,
  options: ScriptOptions,
) {
  const { script, bodies, captures, screenshots, warnings } =
    scriptFromRecording(name, recording, options);

  for (const dir of [mocksDir(name), capturesDir(name)])
    fs.rmSync(dir, { recursive: true, force: true });

  for (const [file, content] of [...bodies, ...screenshots]) {
    fs.mkdirSync(path.dirname(fromRoot(file)), { recursive: true });
    fs.writeFileSync(fromRoot(file), content);
  }

  if (captures.length) writeCaptures(name, script.goal, captures);

  return {
    file: saveScript(name, script),
    script,
    mocks: bodies.size,
    captures: captures.length,
    warnings,
  };
}
