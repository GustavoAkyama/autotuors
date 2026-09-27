import { cancelJob, getTour, startRecording, stopJob } from "../api.js";
import { h, slugify } from "../dom.js";
import { confirmDialog, notice } from "../feedback.js";
import { icon } from "../icons.js";
import { go, jobOf, store } from "../store.js";
import { openLoginsDialog } from "./logins.js";

const noLogin = "";
const newLogin = "__new__";

/** A name from the address when there is no goal: "meusite.com/painel" → "meusite-painel". */
const nameFromUrl = (url) =>
  slugify(
    url
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("?")[0],
  );

const clock = (ms) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

export function newTourView(params) {
  let nameEdited = false;
  const error = h("div");

  const urlInput = h("input", {
    class: "input",
    name: "url",
    placeholder: "meusite.com/painel",
    inputmode: "url",
    autocomplete: "url",
    required: true,
    oninput: () => suggestName(),
  });
  const goalInput = h("input", {
    class: "input",
    name: "goal",
    placeholder: "Como criar e concluir uma tarefa",
    oninput: () => suggestName(),
  });
  const nameInput = h("input", {
    class: "input mono",
    name: "name",
    placeholder: "criar-tarefa",
    required: true,
    pattern: "[\\w-]+",
    oninput: () => {
      nameEdited = true;
      checkName();
    },
  });
  const nameHint = h("span", { class: "hint" }, "Nome do arquivo e do vídeo.");
  const loginSelect = h("select", {
    class: "input",
    onchange: async () => {
      if (loginSelect.value !== newLogin) return;
      loginSelect.value = noLogin;
      const saved = await openLoginsDialog({ url: urlInput.value.trim() });
      await store.refresh();
      fillLogins(store.state.sessions, saved);
    },
  });
  const wideInput = h("input", { type: "checkbox" });

  function suggestName() {
    if (nameEdited) return;
    const goal = goalInput.value.trim();
    nameInput.value = goal
      ? slugify(goal.replace(/^como\s+/i, ""))
      : nameFromUrl(urlInput.value.trim());
    checkName();
  }

  function checkName() {
    const exists = store.state.tours.some(
      (item) => item.name === nameInput.value.trim(),
    );
    nameHint.textContent = exists
      ? "Já existe um tour com esse nome: gravar de novo substitui o atual."
      : "Nome do arquivo e do vídeo.";
    nameHint.classList.toggle("warning-text", exists);
  }

  function fillLogins(sessions, selected = loginSelect.value) {
    loginSelect.replaceChildren(
      new Option("Nenhum: o site é público", noLogin),
      ...sessions.map((session) => new Option(session, session)),
      new Option("Entrar em um site…", newLogin),
    );
    loginSelect.value = sessions.includes(selected) ? selected : noLogin;
  }

  async function submit(event) {
    event.preventDefault();
    error.replaceChildren();
    const body = {
      name: nameInput.value.trim(),
      url: urlInput.value.trim(),
      goal: goalInput.value.trim(),
      session: loginSelect.value || undefined,
      width: wideInput.checked ? 1600 : 1280,
    };
    try {
      try {
        await startRecording(body);
      } catch (failure) {
        if (failure.status !== 409 || !body.name) throw failure;
        const ok = await confirmDialog({
          title: "Gravar por cima?",
          message: `${failure.message} A gravação nova substitui o roteiro, as legendas e o vídeo dele.`,
          confirm: "Gravar por cima",
          danger: true,
        });
        if (!ok) return;
        await startRecording({ ...body, force: true });
      }
      await store.refresh();
    } catch (failure) {
      error.replaceChildren(notice("error", failure.message));
    }
  }

  const form = h(
    "form",
    { class: "card form", onsubmit: submit },
    h("h1", {}, "Novo tour"),
    h(
      "p",
      { class: "lead" },
      "O Chrome abre no endereço abaixo. Faça o passo a passo como se estivesse ensinando alguém.",
    ),
    error,
    h(
      "label",
      { class: "field" },
      h("span", {}, "Onde o tour começa"),
      urlInput,
    ),
    h(
      "label",
      { class: "field" },
      h("span", {}, "O que ele ensina ", h("em", {}, "(opcional)")),
      goalInput,
      h("span", { class: "hint" }, "Uma frase. Ajuda a escrever as legendas."),
    ),
    h("label", { class: "field" }, h("span", {}, "Nome"), nameInput, nameHint),
    h(
      "div",
      { class: "field" },
      h(
        "div",
        { class: "field-label" },
        h("span", {}, "Login"),
        h(
          "button",
          {
            type: "button",
            class: "link",
            onclick: async () => {
              const saved = await openLoginsDialog({
                url: urlInput.value.trim(),
              });
              await store.refresh();
              fillLogins(store.state.sessions, saved ?? loginSelect.value);
            },
          },
          "Gerenciar",
        ),
      ),
      loginSelect,
      h(
        "span",
        { class: "hint" },
        "Para sites que pedem login, entre uma vez e o login fica salvo.",
      ),
    ),
    h(
      "label",
      { class: "check" },
      wideInput,
      h("span", {}, "Tela larga (1600 px), para páginas com muita informação"),
    ),
    h(
      "button",
      { class: "button primary large", type: "submit" },
      icon("record"),
      "Começar a gravar",
    ),
  );

  const timer = h("span", { class: "timer" }, "00:00");
  const recordingUrl = h("span", { class: "mono" });
  const recording = h(
    "section",
    { class: "card recording", hidden: true },
    h(
      "div",
      { class: "recording-status" },
      h("span", { class: "rec-dot large" }),
      h("span", {}, "Gravando"),
      timer,
    ),
    h(
      "p",
      {},
      "Faça o passo a passo na janela do Chrome que abriu. Quando terminar, clique em ",
      h("strong", {}, "Parar gravação"),
      " ou feche a janela.",
    ),
    h("div", { class: "summary-box" }, icon("globe", 15), recordingUrl),
    h(
      "div",
      { class: "row" },
      h(
        "button",
        {
          class: "button primary large",
          onclick: () => stopJob().then(() => store.refresh()),
        },
        icon("stop"),
        "Parar gravação",
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
    h(
      "p",
      { class: "hint" },
      "O que você fizer agora acontece de verdade no site, uma única vez: o vídeo refaz os passos sem publicar nada de novo. Prefira uma conta de teste.",
    ),
  );

  const element = h(
    "div",
    { class: "narrow" },
    h("a", { class: "back", href: "#/" }, icon("back", 15), "Tours"),
    form,
    recording,
  );

  fillLogins(store.state.sessions);
  // "Gravar de novo" comes with the tour to replace.
  const from = params.get("from");
  if (from)
    getTour(from).then(({ script }) => {
      urlInput.value = script.url;
      goalInput.value = script.goal ?? "";
      nameInput.value = from;
      nameEdited = true;
      fillLogins(store.state.sessions, script.session);
      checkName();
    });
  else setTimeout(() => urlInput.focus());

  const jobKey = (job) =>
    job ? `${job.name}:${job.status}:${job.startedAt}` : "";
  // Only what changes from now on counts: an old recording doesn't open the editor.
  let lastJob = jobKey(jobOf(store.state, "record"));
  let lastSessions = JSON.stringify(store.state.sessions);
  let tick = 0;
  return {
    element,
    update(state) {
      const job = jobOf(state, "record");
      const running = job?.status === "running";
      form.hidden = running;
      recording.hidden = !running;
      clearInterval(tick);
      if (running) {
        recordingUrl.textContent = urlInput.value.trim() || job.name;
        const draw = () =>
          (timer.textContent = clock(Date.now() - job.startedAt));
        draw();
        tick = setInterval(draw, 250);
      }
      const key = jobKey(job);
      if (key !== lastJob) {
        lastJob = key;
        // A recording that ended opens in the editor; one that failed says why here.
        if (job?.status === "done")
          return go(`#/t/${encodeURIComponent(job.name)}`);
        if (job?.status === "error")
          error.replaceChildren(notice("error", job.message));
      }
      const sessions = JSON.stringify(state.sessions);
      if (sessions !== lastSessions && document.activeElement !== loginSelect) {
        lastSessions = sessions;
        fillLogins(state.sessions);
      }
    },
    destroy() {
      clearInterval(tick);
    },
  };
}
