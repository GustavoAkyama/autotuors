import fs from "node:fs";
import path from "node:path";
import { capturesDir } from "../paths.ts";
import type { StepContext } from "../recorder/types.ts";
import { targetOf, type Step } from "./types.ts";

/**
 * What was on screen at a step, saved to captures/<name>/context.json so captions
 * can be rewritten (by /legendas in Claude Code) and shown next to each step in the UI.
 */
export type Capture = Omit<StepContext, "screenshot"> & {
  step: number;
  action: string;
  target?: string;
  label: string;
  role: string;
  /** Path of the screenshot, relative to the project root. */
  screenshot?: string;
};

/** The recorded action a step came from. */
export type StepSource = { context: StepContext; label: string; role: string };

export function capturesOf(
  name: string,
  steps: Step[],
  sources: Map<Step, StepSource>,
) {
  const captures: Capture[] = [];
  const screenshots = new Map<string, Buffer>();

  steps.forEach((step, index) => {
    const source = sources.get(step);

    if (!source) return;

    const { screenshot, ...context } = source.context;

    const number = String(index + 1).padStart(2, "0");
    const file = screenshot && `captures/${name}/${number}.jpg`;

    if (file) screenshots.set(file, screenshot);

    captures.push({
      step: index + 1,
      action: step.action,
      target: targetOf(step),
      label: source.label,
      role: source.role,
      ...context,
      screenshot: file,
    });
  });

  return { captures, screenshots };
}

const contextFile = (name: string) =>
  path.join(capturesDir(name), "context.json");

export function writeCaptures(
  name: string,
  goal: string | undefined,
  captures: Capture[],
) {
  fs.mkdirSync(capturesDir(name), { recursive: true });
  fs.writeFileSync(
    contextFile(name),
    `${JSON.stringify({ goal, steps: captures }, null, 2)}\n`,
  );
}

export function loadCaptures(name: string): Capture[] {
  const file = contextFile(name);

  if (!fs.existsSync(file)) return [];
  
  return (JSON.parse(fs.readFileSync(file, "utf8")) as { steps: Capture[] })
    .steps;
}
