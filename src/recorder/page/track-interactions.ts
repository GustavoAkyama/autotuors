import {
  cleanText,
  ignoresMouse,
  interactiveSelector,
  isCheckbox,
  isTransient,
  labelOf,
  regionOf,
  roleOf,
} from "./element.ts";
import { outlineElement } from "./outline.ts";

export const trackerHelpers = [
  cleanText,
  ignoresMouse,
  interactiveSelector,
  isCheckbox,
  isTransient,
  labelOf,
  regionOf,
  roleOf,
  outlineElement,
];

/**
 * Runs in the page and reports the element behind each click, input and key press,
 * mirroring the rules the Playwright recorder uses to turn events into actions, so
 * both lists line up.
 */
export function trackInteractions(outlineId: string) {
  if (window.top !== window) return;

  // The recorder holds each click for 500ms and drops it if its page is gone by
  // then, so a popup that closes itself right after a click would lose that click.
  if (window.opener) {
    const close = window.close.bind(window);
    window.close = () => void setTimeout(close, 1000);
  }

  const interactive = interactiveSelector();

  // The press comes before the click, and taking the screenshot then catches the
  // page before a link navigates or a menu opens.
  addEventListener(
    "pointerdown",
    (event) => {
      const target = event.composedPath()[0];
      if (!(target instanceof Element)) return;
      outlineElement(target.closest(interactive) ?? target, outlineId);
      window.__tourSnapshot?.();
    },
    true,
  );

  let lastFill: Element | null = null;

  const report = (type: string, event: Event, detail = 0) => {
    const target = event.composedPath()[0];

    if (!(target instanceof Element)) return;

    const element = target.closest(interactive) ?? target;
    // The recorder merges consecutive fills of the same field into one action.
    if (type === "fill" && lastFill === element) return;
    lastFill = type === "fill" ? element : null;

    const role = roleOf(element);
    // Real clicks were outlined on pointerdown; the ones the page fires itself
    // must not move the box while the screenshot of their cause is being taken.
    if (!detail && type !== "click") outlineElement(element, outlineId);

    const box = element.getBoundingClientRect();
    window.__tourInteraction?.({
      type,
      detail,
      role,
      label: labelOf(element, role).slice(0, 80),
      password:
        element instanceof HTMLInputElement && element.type === "password",
      option:
        element instanceof HTMLSelectElement
          ? cleanText(element.selectedOptions[0]?.textContent)
          : "",
      url: location.href,
      title: document.title,
      region: regionOf(element),
      transient: isTransient(element),
      rect: {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      },
    });
  };

  addEventListener(
    "click",
    (event) => {
      const target = event.composedPath()[0];
      // Clicks the page fires itself (detail 0), like the one on the submit
      // button when Enter sends a form, are reported too.
      if (ignoresMouse(target)) return;
      report(
        isCheckbox(target) && event.detail === 1 ? "check" : "click",
        event,
        event.detail,
      );
    },
    true,
  );

  addEventListener(
    "input",
    (event) => {
      const target = event.composedPath()[0];
      if (target instanceof HTMLInputElement && target.type === "file")
        report("file", event);
      else if (target instanceof HTMLSelectElement) report("select", event);
      else if (
        !isCheckbox(target) &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          (target instanceof HTMLElement && target.isContentEditable))
      )
        report("fill", event);
    },
    true,
  );

  addEventListener(
    "keydown",
    (event) => {
      const target = event.composedPath()[0];
      const { key } = event;
      if (!(target instanceof HTMLElement) || typeof key !== "string") return;
      // Enter in a text area or rich editor types a line break.
      if (
        key === "Enter" &&
        (target instanceof HTMLTextAreaElement || target.isContentEditable)
      )
        return;
      if (
        [
          "Backspace",
          "Delete",
          "AltGraph",
          "Shift",
          "Control",
          "Meta",
          "Alt",
          "Process",
        ].includes(key)
      )
        return;
      if (key === "@" && event.code === "KeyL") return;
      const paste = navigator.platform.includes("Mac")
        ? key === "v" && event.metaKey
        : (key === "v" && event.ctrlKey) ||
          (key === "Insert" && event.shiftKey);
      if (paste) return;
      const modified = event.ctrlKey || event.altKey || event.metaKey;
      // Plain characters are part of the typed text.
      if (key.length === 1 && !modified && !isCheckbox(target)) return;
      report(key === " " && isCheckbox(target) ? "check" : "press", event);
    },
    true,
  );
}
