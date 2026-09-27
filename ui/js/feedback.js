import { h } from "./dom.js";
import { icon } from "./icons.js";

/** A short message in the corner that goes away by itself. */
export function toast(message, kind = "done") {
  const element = h(
    "div",
    { class: `toast ${kind}`, role: "status" },
    icon(kind === "error" ? "warning" : "check", 16),
    h("span", {}, message),
  );
  document.getElementById("toasts").append(element);
  setTimeout(() => element.classList.add("leaving"), 3200);
  setTimeout(() => element.remove(), 3500);
}

/** A colored box: "info", "warning" or "error". */
export function notice(kind, content, actions = []) {
  return h(
    "div",
    { class: `notice ${kind}`, role: kind === "error" ? "alert" : "status" },
    icon(kind === "info" ? "info" : "warning", 16),
    h("div", { class: "notice-body" }, content),
    actions.length ? h("div", { class: "notice-actions" }, actions) : null,
  );
}

/** Asks before something that can't be undone. Resolves true to go ahead. */
export function confirmDialog({ title, message, confirm, danger = false }) {
  return new Promise((resolve) => {
    const close = (answer) => {
      dialog.close();
      dialog.remove();
      resolve(answer);
    };
    const dialog = h(
      "dialog",
      { class: "dialog small", oncancel: () => close(false) },
      h("h2", {}, title),
      h("p", { class: "muted" }, message),
      h(
        "div",
        { class: "dialog-actions" },
        h(
          "button",
          { class: "button secondary", onclick: () => close(false) },
          "Cancelar",
        ),
        h(
          "button",
          {
            class: `button ${danger ? "danger" : "primary"}`,
            onclick: () => close(true),
          },
          confirm,
        ),
      ),
    );
    document.body.append(dialog);
    dialog.showModal();
  });
}

/** Shows an image full size; a click anywhere closes it. */
export function lightbox(src, alt) {
  const dialog = h(
    "dialog",
    {
      class: "lightbox",
      onclick: () => dialog.close(),
      onclose: () => dialog.remove(),
    },
    h("img", { src, alt }),
  );
  document.body.append(dialog);
  dialog.showModal();
}
