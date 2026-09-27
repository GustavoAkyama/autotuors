import path from "node:path";
import type { Page } from "playwright-core";
import { looksLikeLogin } from "../browser/sessions.ts";
import { errorScreenshot, root } from "../paths.ts";
import { fragility } from "../script/targets.ts";
import type { Step } from "../script/types.ts";

export type Warn = (message: string) => void;

type TargetStep = Step & { target: string; optional?: boolean };

/**
 * Waits for the step's target. An optional step whose target never shows up gets
 * `null`; any other step either finds its target or throws an error that explains
 * the likely cause.
 */
export async function findTarget(
  page: Page,
  step: TargetStep,
  name: string,
  warn: Warn,
) {
  // Hidden inputs (styled checkboxes, file pickers) are used without being seen.
  const state = ["check", "uncheck", "upload"].includes(step.action)
    ? "attached"
    : "visible";

  const locator = page.locator(step.target).first();
  const found = await locator
    .waitFor({ state, timeout: step.optional ? 3000 : 20000 })
    .then(
      () => true,
      () => false,
    );

  if (found) return locator;
  if (step.optional) return null;

  const relaxed = await relaxName(page, step.target);

  if (relaxed) {
    warn(
      `o alvo ${step.target} não existe mais; usei ${relaxed}. Atualize o roteiro com ele.`,
    );

    return page.locator(relaxed).first();
  }

  throw await notFound(page, step.target, name);
}

/**
 * A role name that no longer matches, like "Hoje, 3 tarefas" after the recording
 * created another task, often still has a stable start. Tries shorter versions of
 * the name and takes one only if it finds a single element.
 */
async function relaxName(page: Page, selector: string) {
  const match = /^internal:role=(\w+)\[name="((?:[^"\\]|\\.)*)"i\]$/.exec(
    selector,
  );

  if (!match) return null;

  const [, role, name] = match;

  const parts = name.split(/,\s*/);
  const candidates = parts
    .slice(1)
    .map((_, index) => parts.slice(0, parts.length - 1 - index).join(", "));

  for (const candidate of candidates) {
    if (candidate.length < 3) break;

    const relaxed = `internal:role=${role}[name="${candidate}"i]`;

    if ((await page.locator(relaxed).count()) === 1) return relaxed;
  }

  return null;
}

/** Explains why a target wasn't found, with a screenshot of the moment. */
async function notFound(page: Page, target: string, name: string) {
  const count = await page
    .locator(target)
    .count()
    .catch(() => 0);

  const reasons = [
    count
      ? "o elemento existe, mas não está visível; talvez falte um passo antes (passar o mouse, abrir um menu) ou um passo anterior não teve o efeito esperado"
      : "nenhum elemento com esse alvo na tela; o nome pode ter mudado com os dados, ou um passo anterior levou a outra tela",
  ];

  const fragile = fragility(target);

  if (fragile) reasons.push(`o alvo ${fragile}`);
  if (looksLikeLogin(page.url()))
    reasons.push("a página é de login; o login salvo pode ter expirado");

  const file = errorScreenshot(name);

  await page.screenshot({ path: file }).catch(() => {});

  return new Error(
    `não achei ${target} em ${page.url()}. Provável: ${reasons.join("; ")}. Tela do momento: ${path.relative(root, file)}`,
  );
}
