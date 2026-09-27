/**
 * Creates an element: h("button", { class: "button", onclick }, "Salvar").
 * Props starting with "on" become listeners; `null`, `false` and `undefined` are skipped.
 */
export function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key.startsWith("on")) element.addEventListener(key.slice(2), value);
    else if (key === "class") element.className = value;
    else if (key === "dataset") Object.assign(element.dataset, value);
    else if (key === "value") element.value = value;
    else if (key === "html") element.innerHTML = value;
    else element.setAttribute(key, value === true ? "" : String(value));
  }
  element.append(
    ...children
      .flat(Infinity)
      .filter((child) => child != null && child !== false),
  );
  return element;
}

export const $ = (selector, root = document) => root.querySelector(selector);

/** Turns "Como criar uma tarefa" into "como-criar-uma-tarefa". */
export function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
}

/** "há 5 minutos", "ontem", "12 de set." */
export function timeAgo(time) {
  const seconds = (Date.now() - time) / 1000;
  if (seconds < 60) return "agora há pouco";
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)} h`;
  if (seconds < 172800) return "ontem";
  return new Date(time).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });
}

/** Runs `action` at most once per `ms`, the last call winning. */
export function debounce(action, ms) {
  let timer = 0;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => action(...args), ms);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}
