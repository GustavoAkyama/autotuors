// Runs inside the recorded page (see browser/page-script.ts): only browser globals
// and the other functions of this folder are available.

export function cleanText(text: string | null | undefined) {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

export function isCheckbox(node: EventTarget | null) {
  return (
    node instanceof HTMLInputElement &&
    ["checkbox", "radio"].includes(node.type)
  );
}

/** Selects and native pickers are recorded by what they change, not by clicks. */
export function ignoresMouse(node: EventTarget | null) {
  return (
    node instanceof HTMLSelectElement ||
    node instanceof HTMLOptionElement ||
    (node instanceof HTMLInputElement &&
      [
        "color",
        "date",
        "datetime-local",
        "file",
        "month",
        "range",
        "time",
        "week",
      ].includes(node.type))
  );
}

/** Elements a user acts on: an event inside one belongs to it. */
export function interactiveSelector() {
  const roles = [
    "button",
    "link",
    "tab",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "checkbox",
    "radio",
    "switch",
    "textbox",
    "combobox",
    "searchbox",
    "treeitem",
  ];
  return [
    "a[href]",
    "button",
    "input",
    "textarea",
    "select",
    "summary",
    "label",
    "[contenteditable]:not([contenteditable='false'])",
    ...roles.map((role) => `[role=${role}]`),
  ].join(",");
}

export function roleOf(element: Element) {
  const role = element.getAttribute("role");
  if (role) return role;
  if (element instanceof HTMLAnchorElement) return "link";
  if (element instanceof HTMLButtonElement || element.tagName === "SUMMARY")
    return "button";
  if (element instanceof HTMLSelectElement) return "combobox";
  if (element instanceof HTMLInputElement) {
    if (["button", "submit", "reset", "image"].includes(element.type))
      return "button";
    if (isCheckbox(element)) return element.type;
    return element.type === "search" ? "searchbox" : "textbox";
  }
  if (element instanceof HTMLTextAreaElement) return "textbox";
  if (element instanceof HTMLElement && element.isContentEditable)
    return "textbox";
  return "";
}

/** The element's accessible name, roughly as a screen reader would say it. */
export function labelOf(element: Element, role: string) {
  const aria = cleanText(element.getAttribute("aria-label"));

  if (aria) return aria;

  const labelledBy = element.getAttribute("aria-labelledby");

  if (labelledBy) {
    const text = cleanText(
      labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent)
        .join(" "),
    );

    if (text) return text;
  }

  const labels = (element as HTMLInputElement).labels;

  if (labels?.length) {
    const text = cleanText(
      Array.from(labels, (label) => label.textContent).join(" "),
    );

    if (text) return text;
  }

  for (const name of ["placeholder", "title", "alt"]) {
    const text = cleanText(element.getAttribute(name));

    if (text) return text;
  }

  // A text field's own text is what the user typed, not its name.
  if (
    !["textbox", "searchbox", "combobox"].includes(role) &&
    element instanceof HTMLElement
  ) {
    const text =
      cleanText(element.innerText) ||
      cleanText(element.querySelector("img[alt]")?.getAttribute("alt")) ||
      cleanText(element.querySelector("svg title")?.textContent);

    if (text) return text;
  }

  if (element instanceof HTMLInputElement) return cleanText(element.value);
  return "";
}

/** Name of the dialog, menu or listbox the element is in. */
export function regionOf(element: Element) {
  const region = element.closest(
    "dialog, [role=dialog], [role=alertdialog], [aria-modal=true], [role=menu], [role=listbox]",
  );

  if (!region) return "";

  const labelledBy = region.getAttribute("aria-labelledby");
  
  return cleanText(
    region.getAttribute("aria-label") ||
      (labelledBy && document.getElementById(labelledBy)?.textContent) ||
      region.querySelector("h1, h2, h3, h4, legend")?.textContent ||
      region.getAttribute("role") ||
      "dialog",
  ).slice(0, 80);
}

/** Inside a toast or alert, which closes by itself: a replay may find it gone. */
export function isTransient(element: Element) {
  return Boolean(
    element.closest(
      [
        "[role=alert]",
        "[role=status]",
        "[aria-live=polite]",
        "[aria-live=assertive]",
        ".MuiSnackbar-root",
        "[data-sonner-toast]",
        '[class*="toast" i]',
        '[class*="snackbar" i]',
      ].join(","),
    ),
  );
}
