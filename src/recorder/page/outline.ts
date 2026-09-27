// Runs inside the recorded page (see browser/page-script.ts).

/**
 * Moves a box over the element being acted on. The box stays hidden on screen and
 * only shows in the step screenshots, where an outline on the element itself could
 * be clipped by its container.
 */
export function outlineElement(element: Element, boxId: string) {
  let box = document.getElementById(boxId);

  if (!box) {
    box = document.createElement("div");
    box.id = boxId;
    box.style.cssText =
      "position: fixed; z-index: 2147483647; pointer-events: none; visibility: hidden; border: 3px solid #ef4444; border-radius: 6px; box-sizing: border-box;";
    document.documentElement.append(box);
  }

  const rect = element.getBoundingClientRect();

  Object.assign(box.style, {
    left: `${rect.left - 5}px`,
    top: `${rect.top - 5}px`,
    width: `${rect.width + 10}px`,
    height: `${rect.height + 10}px`,
  });
}
