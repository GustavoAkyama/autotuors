// Runs inside the recorded page (see browser/page-script.ts).

/** Sets inline styles as `!important`, so the site's own CSS can't touch them. */
export function forceStyle(element: HTMLElement | SVGElement, style: object) {
  for (const [property, value] of Object.entries(style))
    element.style.setProperty(property, String(value), "important");
}
