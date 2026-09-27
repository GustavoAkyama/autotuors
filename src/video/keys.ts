const keyNames: Record<string, string> = {
  Control: "Ctrl",
  Meta: "⌘",
  Escape: "Esc",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  " ": "Space",
};

/** How each key of a shortcut is shown on screen: "Control+k" → ["Ctrl", "K"]. */
export const keyLabels = (key: string) =>
  key
    .split(/\+(?!$)/)
    .map(
      (part) =>
        keyNames[part] ?? (part.length === 1 ? part.toUpperCase() : part),
    );
