/** The element's name in a recorded selector, like “Salvar” in role=button[name="Salvar"i]. */
function targetName(target = "") {
  const plain = target.replaceAll('\\"', '"');
  return (
    /name="([^"]+)"/.exec(plain)?.[1] ??
    /(?:text|label|placeholder|title)="([^"]+)"/.exec(plain)?.[1] ??
    /testid=\[data-testid="([^"]+)"/.exec(plain)?.[1] ??
    target
  );
}

/** What a step does, in words: “Clicar em “Salvar” (no popup1)”. */
export function describeStep(step) {
  const name = targetName(step.target);
  const where = step.page && step.page !== "main" ? ` (no ${step.page})` : "";
  switch (step.action) {
    case "goto":
      return `Abrir ${step.url}`;
    case "click":
      return `Clicar em “${name}”${step.popup ? " (abre um popup)" : ""}${where}`;
    case "type":
      return `Digitar “${step.text}” em “${name}”${where}`;
    case "press":
      return `Pressionar ${step.key}${where}`;
    case "select":
      return `Escolher ${step.values.join(", ")} em “${name}”${where}`;
    case "check":
      return `Marcar “${name}”${where}`;
    case "uncheck":
      return `Desmarcar “${name}”${where}`;
    case "hover":
      return `Passar o mouse em “${name}”${where}`;
    case "upload":
      return `Enviar ${step.files.join(", ")}${where}`;
    case "caption":
      return step.target ? `Legenda em “${name}”` : "Legenda no centro da tela";
    case "wait":
      return `Esperar ${step.ms} ms`;
    case "close":
      return `Fechar o ${step.page}`;
    default:
      return step.action;
  }
}

/**
 * Groups the steps for the editor: each step with a caption on its own, runs of
 * steps without one together, so they take a single quiet row.
 */
export function groupSteps(steps) {
  const groups = [];
  steps.forEach((step, index) => {
    if (step.caption)
      return groups.push({ captioned: true, items: [{ step, index }] });
    const last = groups.at(-1);
    if (last && !last.captioned) last.items.push({ step, index });
    else groups.push({ captioned: false, items: [{ step, index }] });
  });
  return groups;
}
