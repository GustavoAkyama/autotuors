import { mocksFromResponses } from "../mocks/from-responses.ts";
import type { RecordedAction, Recording } from "../recorder/types.ts";
import { capturesOf, type StepSource } from "./captures.ts";
import { phrasesFor, type Phrases } from "./phrases.ts";
import { fragility, locatorName, stableTarget } from "./targets.ts";
import {
  targetOf,
  type Step,
  type StepCaption,
  type TourScript,
} from "./types.ts";

export type ScriptOptions = {
  /** Saved login the recording used. */
  session?: string;
  locale: string;
  /** What the tour teaches, in one sentence. */
  goal?: string;
};

/**
 * Turns a recording into an editable script, plus the files that go with it:
 * mock bodies, and a screenshot and context for each step.
 */
export function scriptFromRecording(
  name: string,
  recording: Recording,
  options: ScriptOptions,
) {
  const { url, steps, sources, warnings } = stepsFromActions(
    recording,
    phrasesFor(options.locale),
  );

  const { mocks, bodies } = mocksFromResponses(name, recording.responses);

  warnings.push(...fragileTargets(steps));

  const { captures, screenshots } = capturesOf(name, steps, sources);

  const script: TourScript = {
    url,
    goal: options.goal || undefined,
    width: recording.width,
    time: recording.time,
    session: options.session,
    zoom: true,
    narrate: true,
    intro: {
      title: humanize(name),
      subtitle: recording.title || new URL(url).host,
    },
    outro: phrasesFor(options.locale).outro,
    steps,
    blockUnmocked: true,
    mocks,
  };

  return { script, bodies, captures, screenshots, warnings };
}

function stepsFromActions(recording: Recording, phrases: Phrases) {
  const steps: Step[] = [];
  const sources = new Map<Step, StepSource>();
  const warnings: string[] = [];

  let url = recording.url;

  recording.actions.forEach((action, index) => {
    const next = recording.actions[index + 1];
    const page = action.page === "main" ? undefined : action.page;
    const target = stableTarget(action.selector ?? "");
    const { label, role } = elementName(action);
    const add = (step: Step) => {
      steps.push(step);
      if (action.context)
        sources.set(step, { context: action.context, label, role });
    };

    switch (action.name) {
      case "navigate":
        // Popups get where they go through the click that opened them.
        if (page) return;
        if (!steps.length) url = action.url!;
        else add({ action: "goto", url: action.url! });
        return;

      case "click": {
        if (
          firedByPage(action) ||
          focusesNextField(action, next) ||
          labelsNextCheck(action, next)
        )
          return;
        // A toast may close by itself before the replay gets to it.
        const transient = action.context?.transient;

        add({
          action: "click",
          target,
          page,
          optional: transient || undefined,
          popup: action.popup,
          button:
            action.button && action.button !== "left"
              ? action.button
              : undefined,
          clickCount:
            action.clickCount && action.clickCount > 1
              ? action.clickCount
              : undefined,
          caption: transient
            ? undefined
            : toCaption(phrases.click(label, role)),
        });
        return;
      }

      case "fill": {
        const text = action.password
          ? ""
          : (action.text ?? "").replace(/\n+$/, "");
        if (action.password)
          warnings.push(
            `O passo ${steps.length + 1} digita uma senha, que não fica salva no roteiro. Para sites com login, grave usando um login salvo.`,
          );

        const caption = toCaption(phrases.type(label, text));
        // Typing the same field again (e.g. after an accent's dead key) is one step.
        const previous = steps.at(-1);

        if (
          previous?.action === "type" &&
          previous.target === target &&
          previous.page === page
        ) {
          previous.text = text;
          previous.caption = caption;
          return;
        }
        add({ action: "type", target, text, page, caption });
        return;
      }

      case "press":
        // Dead keys only compose accents ("ç", "ã") and end up in the typed text.
        if (action.key === "Dead") return;
        add({ action: "press", key: keyCombo(action), page });
        return;

      case "select":
        add({
          action: "select",
          target,
          values: action.options ?? [],
          page,
          caption: toCaption(
            phrases.select(label, action.option ?? action.options?.[0] ?? ""),
          ),
        });
        return;

      case "check":
      case "uncheck":
        add({
          action: action.name,
          target,
          page,
          caption: toCaption(phrases.check(label, action.name === "check")),
        });
        return;

      case "setInputFiles":
        warnings.push(
          `O passo ${steps.length + 1} envia ${action.files?.join(", ")}: ajuste "files" com o caminho de cada arquivo a partir da raiz do projeto.`,
        );
        add({
          action: "upload",
          target,
          files: action.files ?? [],
          page,
          caption: toCaption(phrases.upload()),
        });
        return;

      case "closePage":
        if (page) add({ action: "close", page });
        return;
    }
  });

  return { url, steps, sources, warnings };
}

/** Label and role of the element an action used, from its locator or from the page. */
function elementName(action: RecordedAction) {
  const fromLocator = locatorName(action.locator);

  return {
    label: fromLocator.label || action.label || "",
    role: fromLocator.role || action.role || "",
  };
}

const toCaption = ([title, description]: [string, string]): StepCaption => ({
  title,
  description,
});

// Clicks that are recorded but replay as part of another step.

/** A click the page fired itself, like Enter sending a form, replays with its cause. */
const firedByPage = (action: RecordedAction) => action.clickCount === 0;

/** A click that only focuses the field typed next is part of the "type" step. */
function focusesNextField(action: RecordedAction, next?: RecordedAction) {
  if (next?.name !== "fill" || next.page !== action.page) return false;

  const { label } = elementName(action);

  return (
    next.selector === action.selector ||
    (!!label && elementName(next).label === label)
  );
}

/** Clicking a checkbox's text also records the check it causes; the check is enough. */
function labelsNextCheck(action: RecordedAction, next?: RecordedAction) {
  if (next?.name !== "check" && next?.name !== "uncheck") return false;
  if (next.page !== action.page) return false;

  const { label } = elementName(action);

  const nextLabel = elementName(next).label;

  return (
    !!label &&
    !!nextLabel &&
    (nextLabel.startsWith(label) || label.startsWith(nextLabel))
  );
}

function fragileTargets(steps: Step[]) {
  return steps.flatMap((step, index) => {
    const target = targetOf(step);
    const reason = target && fragility(target);

    return reason
      ? [
          `O alvo do passo ${index + 1} ${reason} (${target}). Se o vídeo falhar nele, troque por um alvo estável: texto, papel ou data-testid.`,
        ]
      : [];
  });
}

const modifierNames: [bit: number, name: string][] = [
  [1, "Alt"],
  [2, "Control"],
  [4, "Meta"],
  [8, "Shift"],
];

const keyCombo = ({ key = "", modifiers = 0 }: RecordedAction) =>
  [
    ...modifierNames.filter(([bit]) => modifiers & bit).map(([, name]) => name),
    key,
  ].join("+");

const humanize = (name: string) => {
  const words = name.replace(/[-_]+/g, " ").trim();

  return words.charAt(0).toUpperCase() + words.slice(1);
};
