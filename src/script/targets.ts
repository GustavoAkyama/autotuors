import type { LocatorInfo } from "../recorder/types.ts";

// Counts in accessible names change with the data, e.g. a list named
// "Hoje, 3 tarefas" becomes "Hoje, 4 tarefas" once the recording creates a task.
const countSuffix =
  /(?:,\s*(?:\d+|sem|nenhum|nenhuma|no)\s+\p{L}+(?:\s+\p{L}+)?|\s*\(\d+\))$/u;

/**
 * Drops the parts of a role's name that change with the data. Names ending in `i`
 * match as a substring, so the rest still finds the element.
 */
export function stableTarget(selector: string) {
  return selector.replace(
    /(\[name=")((?:[^"\\]|\\.)*)("i\])/g,
    (whole, open: string, name: string, close: string) => {
      const stable = name.replace(countSuffix, "").trimEnd();
      return stable.length >= 3 ? `${open}${stable}${close}` : whole;
    },
  );
}

/** Why a selector may stop matching when the tour plays, if it looks fragile. */
export function fragility(selector: string) {
  if (
    /\.Mui-(?:error|focused|selected|expanded|checked|active)\b|\.(?:is-)?(?:active|selected|open|error|invalid)\b/.test(
      selector,
    )
  )
    return "depende de um estado da tela, como erro, foco ou seleção";
  if (/:nth-(?:child|of-type)\(|>> nth=/.test(selector))
    return "depende da posição do elemento na página";
  if (
    /#(?:mui|radix|headlessui|react-aria)[-\w]*|#:r\w*:|#[\w-]*\d{3,}/i.test(
      selector,
    )
  )
    return "usa um id gerado, que muda a cada carregamento";
  return null;
}

/** The label and role of the most specific part of a locator chain that names its element. */
export function locatorName(locator: LocatorInfo | undefined) {
  let label = "";
  let role = "";
  for (let part = locator; part; part = part.next) {
    if (part.kind === "role") {
      role = part.body;
      label = part.options?.name ?? "";
    } else if (
      ["text", "label", "placeholder", "alt", "title"].includes(part.kind)
    ) {
      label = part.body;
    }
  }
  return { label, role };
}
