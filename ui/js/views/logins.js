import { deleteSession, startLogin, stopJob, cancelJob } from "../api.js";
import { h } from "../dom.js";
import { confirmDialog, notice, toast } from "../feedback.js";
import { icon } from "../icons.js";
import { jobOf, store } from "../store.js";

/** "https://app.meusite.com.br/login" → "meusite" */
function loginName(url) {
  try {
    const host = new URL(/^https?:\/\//.test(url) ? url : `https://${url}`)
      .hostname;
    const parts = host.replace(/^www\./, "").split(".");
    const main =
      parts.length > 2 && parts.at(-2).length <= 3
        ? parts.at(-3)
        : (parts.at(-2) ?? parts[0]);
    return (main ?? "").replace(/[^\w-]/g, "");
  } catch {
    return "";
  }
}

/**
 * Saved logins: the list, and logging into another site. Resolves with the name
 * of the login saved, if any, when the dialog closes.
 */
export function openLoginsDialog({ url = "" } = {}) {
  return new Promise((resolve) => {
    let saved = null;
    let nameEdited = false;
    const list = h("ul", { class: "login-list" });
    const error = h("div");
    const urlInput = h("input", {
      class: "input",
      placeholder: "meusite.com/login",
      value: url,
      inputmode: "url",
      oninput: () => {
        if (!nameEdited) nameInput.value = loginName(urlInput.value);
      },
    });
    const nameInput = h("input", {
      class: "input",
      placeholder: "meu-site",
      value: loginName(url),
      oninput: () => (nameEdited = true),
    });
    const form = h(
      "form",
      {
        class: "stack",
        onsubmit: async (event) => {
          event.preventDefault();
          error.replaceChildren();
          try {
            await startLogin({
              session: nameInput.value.trim(),
              url: urlInput.value.trim(),
            });
            await store.refresh();
          } catch (failure) {
            error.replaceChildren(notice("error", failure.message));
          }
        },
      },
      h(
        "label",
        { class: "field" },
        h("span", {}, "Página de login"),
        urlInput,
      ),
      h(
        "label",
        { class: "field" },
        h("span", {}, "Nome deste login"),
        nameInput,
      ),
      h(
        "button",
        { class: "button primary", type: "submit" },
        icon("globe"),
        "Abrir o Chrome para entrar",
      ),
    );
    const waiting = h(
      "div",
      { class: "stack waiting" },
      notice(
        "info",
        "Entre no site na janela do Chrome que abriu, como sempre (inclusive com verificação em duas etapas). Quando terminar, clique em “Concluir login”.",
      ),
      h(
        "div",
        { class: "row" },
        h(
          "button",
          {
            class: "button primary",
            onclick: () => stopJob().then(() => store.refresh()),
          },
          icon("check"),
          "Concluir login",
        ),
        h(
          "button",
          {
            class: "button ghost",
            onclick: () => cancelJob().then(() => store.refresh()),
          },
          "Cancelar",
        ),
      ),
    );

    const close = () => {
      unsubscribe();
      dialog.close();
      dialog.remove();
      resolve(saved);
    };
    const dialog = h(
      "dialog",
      {
        class: "dialog",
        oncancel: (event) => (event.preventDefault(), close()),
      },
      h(
        "div",
        { class: "dialog-header" },
        h("h2", {}, "Logins salvos"),
        h(
          "button",
          { class: "icon-button", "aria-label": "Fechar", onclick: close },
          icon("x", 18),
        ),
      ),
      h(
        "p",
        { class: "muted" },
        "Para sites que pedem login. O Chrome abre na página de login, você entra normalmente e o login fica salvo neste computador para as gravações.",
      ),
      list,
      h("h3", {}, "Entrar em um site"),
      error,
      form,
      waiting,
    );

    const jobKey = (job) =>
      job ? `${job.name}:${job.status}:${job.startedAt}` : "";
    // Only what changes from now on counts: an old login doesn't close the dialog.
    let lastJob = jobKey(jobOf(store.state, "login"));
    let lastSessions = "";
    const render = (state) => {
      const job = jobOf(state, "login");
      const running = job?.status === "running";
      form.hidden = running;
      waiting.hidden = !running;
      const key = jobKey(job);
      if (key !== lastJob) {
        lastJob = key;
        if (job?.status === "done") {
          saved = job.name;
          toast(`Login “${job.name}” salvo.`);
          close();
          return;
        }
        if (job?.status === "error")
          error.replaceChildren(notice("error", job.message));
      }
      // Redrawn only when it changes, so a click on a button is never lost.
      const sessions = JSON.stringify(state.sessions);
      if (sessions === lastSessions) return;
      lastSessions = sessions;
      list.replaceChildren(
        ...state.sessions.map((session) =>
          h(
            "li",
            {},
            icon("key", 15),
            h("span", {}, session),
            h(
              "button",
              {
                class: "icon-button",
                "aria-label": `Apagar o login ${session}`,
                title: "Apagar",
                onclick: async () => {
                  const ok = await confirmDialog({
                    title: `Apagar o login “${session}”?`,
                    message:
                      "As gravações que usam esse login vão precisar de um login novo.",
                    confirm: "Apagar",
                    danger: true,
                  });
                  if (!ok) return;
                  await deleteSession(session);
                  await store.refresh();
                },
              },
              icon("trash", 15),
            ),
          ),
        ),
      );
      list.hidden = !state.sessions.length;
    };
    const unsubscribe = store.subscribe(render);
    render(store.state);
    document.body.append(dialog);
    dialog.showModal();
  });
}
