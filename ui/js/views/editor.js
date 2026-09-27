import {
  cancelJob,
  deleteTour,
  getTour,
  saveTour,
  startVideo,
} from "../api.js";
import { audioPanel } from "../audio.js";
import { debounce, h, timeAgo } from "../dom.js";
import { confirmDialog, lightbox, notice, toast } from "../feedback.js";
import { icon } from "../icons.js";
import { describeStep, groupSteps } from "../steps.js";
import { go, humanize, isBusy, jobOf, store } from "../store.js";

const saveLabels = {
  saved: "Alterações salvas",
  pending: "Alterações não salvas…",
  saving: "Salvando…",
  error: "Não foi possível salvar",
};

/** Grows a text area to fit its text. */
const grow = (textarea) => {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
};

/**
 * Zooms a step's screenshot into the element it used (`rect`, in image pixels),
 * so the thumbnail shows what was clicked instead of the whole page.
 */
function focusShot(img, rect) {
  const { naturalWidth: width, naturalHeight: height } = img;
  if (!rect || !width) return;
  // Room around the element on every side, never closer than a third of the page.
  const regionWidth = Math.min(
    width,
    Math.max(rect.width * 1.3, (rect.height * 1.6 * 16) / 9, width / 3),
  );
  const regionHeight = (regionWidth * 9) / 16;
  const clamp = (value, max) => Math.min(Math.max(value, 0), Math.max(max, 0));
  const x = clamp(
    rect.x + rect.width / 2 - regionWidth / 2,
    width - regionWidth,
  );
  const y = clamp(
    rect.y + rect.height / 2 - regionHeight / 2,
    height - regionHeight,
  );
  img.classList.add("focused");
  img.style.width = `${(width / regionWidth) * 100}%`;
  img.style.left = `${(-x / regionWidth) * 100}%`;
  img.style.top = `${(-y / regionHeight) * 100}%`;
}

const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export function editorView(name) {
  const path = `/api/tours/${encodeURIComponent(name)}`;
  let tour = null;
  /** Version of the script on screen. */
  let modified = null;
  let dirty = false;
  let saving = null;
  let conflict = false;
  let loading = false;
  let dismissedWarnings = null;
  let noticeKey = "";
  let audio = null;

  const header = h(
    "header",
    { class: "editor-header" },
    h("div", { class: "skeleton" }),
  );
  const notices = h("div", { class: "notices" });
  const videoPanel = h("section", { class: "card video-panel" });
  const audioSlot = h("div", { class: "audio-slot" });
  const captions = h("div", { class: "captions", oninput: onEdit });
  const saveStatus = h("span", { class: "save-status" });
  const generateButton = h(
    "button",
    { class: "button primary", onclick: generate },
    icon("play"),
    "Gerar vídeo",
  );

  const element = h(
    "div",
    { class: "editor" },
    h("a", { class: "back", href: "#/" }, icon("back", 15), "Tours"),
    header,
    notices,
    videoPanel,
    audioSlot,
    h(
      "section",
      { class: "captions-section" },
      h(
        "div",
        { class: "section-header" },
        h("h2", {}, "Legendas"),
        h(
          "div",
          { class: "tip" },
          icon("sparkles", 14),
          h("span", {}, "Legendas melhores com o Claude Code:"),
          h("code", {}, `/legendas ${name}`),
          h(
            "button",
            {
              class: "icon-button small",
              title: "Copiar o comando",
              "aria-label": "Copiar o comando",
              onclick: () =>
                navigator.clipboard
                  .writeText(`/legendas ${name}`)
                  .then(() => toast("Comando copiado.")),
            },
            icon("copy", 13),
          ),
        ),
      ),
      captions,
    ),
    h(
      "div",
      { class: "editor-footer" },
      h("div", { class: "editor-footer-inner" }, saveStatus, generateButton),
    ),
  );

  // Loading and showing the tour.

  async function load() {
    loading = true;
    try {
      tour = await getTour(name);
    } catch (failure) {
      loading = false;
      // Nothing to edit or play: only the error stays.
      for (const part of element.querySelectorAll(
        ".video-panel, .audio-slot, .captions-section, .editor-footer",
      ))
        part.hidden = true;
      header.replaceChildren(
        notice("error", failure.message, [
          h(
            "a",
            { class: "button secondary", href: "#/" },
            "Voltar aos tours",
          ),
        ]),
      );
      return;
    }
    loading = false;
    modified = tour.modified;
    dirty = false;
    conflict = false;
    noticeKey = "";
    renderHeader();
    renderAudio();
    renderCaptions();
    setSaveStatus("saved");
    videoKey = "";
    update(store.state);
  }

  function renderHeader() {
    const { script } = tour;
    const captioned = script.steps.filter((step) => step.caption).length;
    header.replaceChildren(
      h(
        "div",
        { class: "editor-title" },
        h("h1", {}, script.intro?.title || humanize(name)),
        script.goal ? h("p", { class: "lead" }, script.goal) : null,
        h(
          "div",
          { class: "meta" },
          h("span", { class: "mono" }, name),
          h(
            "span",
            {},
            `${script.steps.length} passos, ${captioned} com legenda`,
          ),
          h(
            "a",
            { href: script.url, target: "_blank", rel: "noreferrer" },
            icon("globe", 13),
            hostOf(script.url),
          ),
          script.session
            ? h("span", {}, icon("key", 13), script.session)
            : null,
        ),
      ),
      menu(),
    );
  }

  function menu() {
    const id = `menu-${name}`;
    const button = h(
      "button",
      {
        class: "icon-button",
        popovertarget: id,
        "aria-label": "Mais ações",
        title: "Mais ações",
      },
      icon("more", 18),
    );
    const panel = h(
      "div",
      {
        class: "menu",
        id,
        popover: "auto",
        onbeforetoggle: (event) => {
          if (event.newState !== "open") return;
          const box = button.getBoundingClientRect();
          panel.style.top = `${box.bottom + 6}px`;
          panel.style.left = `${Math.max(8, box.right - 220)}px`;
        },
      },
      h(
        "button",
        { onclick: () => go(`#/novo?from=${encodeURIComponent(name)}`) },
        icon("redo", 15),
        "Gravar de novo",
      ),
      h(
        "button",
        { class: "danger", onclick: remove },
        icon("trash", 15),
        "Apagar tour",
      ),
    );
    return h("div", { class: "menu-anchor" }, button, panel);
  }

  function renderAudio() {
    audio?.destroy();
    audio = audioPanel(tour.audio, onEdit);
    audioSlot.replaceChildren(audio.element);
  }

  function renderCaptions() {
    const { script, captures, fragile } = tour;
    let number = 0;
    const fragileBadge = (index) =>
      fragile?.[index]
        ? h(
            "span",
            {
              class: "badge warning",
              title: `O alvo ${fragile[index]}. Se o vídeo falhar aqui, troque o alvo no roteiro por um texto, papel ou data-testid.`,
            },
            icon("warning", 12),
            "alvo frágil",
          )
        : null;
    const stepCard = ({ step, index }) => {
      number += 1;
      const shot = captures[index]?.screenshot
        ? `/${captures[index].screenshot}`
        : null;
      const description = h("textarea", {
        class: "caption-text",
        rows: 1,
        placeholder:
          "Uma frase sobre o que o passo faz. É o que a narração lê.",
        "aria-label": `Descrição do passo ${number}`,
        dataset: { field: "description" },
        value: step.caption.description,
      });
      return h(
        "article",
        { class: "step", dataset: { index } },
        h("div", { class: "step-number" }, String(number)),
        h(
          "div",
          { class: "step-main" },
          h(
            "div",
            { class: "step-action" },
            h("span", {}, describeStep(step)),
            fragileBadge(index),
          ),
          h("input", {
            class: "caption-title",
            placeholder: "Título curto",
            "aria-label": `Título do passo ${number}`,
            dataset: { field: "title" },
            value: step.caption.title,
          }),
          description,
        ),
        shot
          ? h(
              "button",
              {
                class: "step-shot",
                type: "button",
                title: "Ver a tela deste passo",
                onclick: () => lightbox(shot, describeStep(step)),
              },
              h("img", {
                src: shot,
                alt: `Tela do passo ${number}`,
                loading: "lazy",
                onload: (event) =>
                  focusShot(event.target, captures[index].rect),
              }),
            )
          : h("div", { class: "step-shot empty" }, icon("image", 18)),
      );
    };
    const quietGroup = (items) =>
      h(
        "details",
        { class: "quiet-steps" },
        h(
          "summary",
          {},
          icon("chevron", 14),
          h(
            "span",
            {},
            items.length === 1
              ? "1 ação sem legenda"
              : `${items.length} ações sem legenda`,
          ),
          h(
            "span",
            { class: "quiet-preview" },
            items.map(({ step }) => describeStep(step)).join(" · "),
          ),
        ),
        h(
          "ol",
          {},
          items.map(({ step, index }) =>
            h("li", {}, describeStep(step), " ", fragileBadge(index)),
          ),
        ),
      );
    const titleCard = (kind, card) =>
      h(
        "article",
        { class: `title-card ${kind}`, dataset: { card: kind } },
        h(
          "div",
          { class: "title-card-label" },
          kind === "intro" ? "Abertura" : "Encerramento",
        ),
        h("input", {
          class: "caption-title",
          placeholder: "Título",
          "aria-label":
            kind === "intro" ? "Título da abertura" : "Título do encerramento",
          dataset: { field: "title" },
          value: card.title,
        }),
        h("input", {
          class: "caption-text",
          placeholder: "Subtítulo",
          "aria-label":
            kind === "intro"
              ? "Subtítulo da abertura"
              : "Subtítulo do encerramento",
          dataset: { field: "subtitle" },
          value: card.subtitle ?? "",
        }),
      );

    const nothingRecorded =
      !script.steps.length &&
      notice(
        "info",
        "Nenhum passo foi gravado. Grave de novo e faça o passo a passo na janela do Chrome antes de parar.",
        [
          h(
            "a",
            {
              class: "button secondary small",
              href: `#/novo?from=${encodeURIComponent(name)}`,
            },
            icon("redo", 14),
            "Gravar de novo",
          ),
        ],
      );
    captions.replaceChildren(
      ...[
        nothingRecorded,
        script.intro && titleCard("intro", script.intro),
        ...groupSteps(script.steps).map((group) =>
          group.captioned ? stepCard(group.items[0]) : quietGroup(group.items),
        ),
        script.outro && titleCard("outro", script.outro),
      ].filter(Boolean),
    );
    requestAnimationFrame(() =>
      captions.querySelectorAll("textarea").forEach(grow),
    );
  }

  // Saving: every edit is saved a moment after typing stops.

  function setSaveStatus(status) {
    saveStatus.dataset.status = status;
    saveStatus.replaceChildren(
      ...(status === "saved" ? [icon("check", 14)] : []),
      saveLabels[status],
    );
  }

  const field = (root, key) =>
    root.querySelector(`[data-field="${key}"]`).value.trim();

  function collectEdits() {
    const edits = { modified, captions: tour.script.steps.map(() => null) };
    for (const card of captions.querySelectorAll("[data-card]"))
      edits[card.dataset.card] = {
        title: field(card, "title"),
        subtitle: field(card, "subtitle"),
      };
    for (const step of captions.querySelectorAll(".step"))
      edits.captions[step.dataset.index] = {
        title: field(step, "title"),
        description: field(step, "description"),
      };
    const picks = audio?.value();
    if (picks) edits.audio = picks;
    return edits;
  }

  const autosave = debounce(() => save().catch(() => {}), 700);

  function onEdit(event) {
    if (event?.target.matches("textarea")) grow(event.target);
    if (conflict) return;
    dirty = true;
    setSaveStatus("pending");
    autosave();
  }

  async function save() {
    if (saving) await saving.catch(() => {});
    if (!dirty || conflict) return;
    dirty = false;
    setSaveStatus("saving");
    saving = saveTour(name, collectEdits())
      .then((result) => {
        modified = result.modified;
        setSaveStatus(dirty ? "pending" : "saved");
      })
      .catch((failure) => {
        dirty = true;
        if (failure.status === 409) showConflict();
        else {
          setSaveStatus("error");
          toast(failure.message, "error");
        }
        throw failure;
      })
      .finally(() => (saving = null));
    return saving;
  }

  async function flush() {
    autosave.cancel();
    if (saving) await saving.catch(() => {});
    if (dirty && !conflict) await save();
  }

  // The script changed on disk while edits here weren't saved (e.g. /legendas).
  function showConflict() {
    conflict = true;
    noticeKey = "conflict";
    setSaveStatus("error");
    notices.replaceChildren(
      notice(
        "warning",
        [
          h("strong", {}, "O roteiro mudou fora da interface. "),
          "Salvar agora desfaria essas mudanças (feitas, por exemplo, pelo /legendas do Claude Code). Recarregue para ver a versão nova; as edições feitas aqui depois disso serão perdidas.",
        ],
        [
          h(
            "button",
            {
              class: "button secondary",
              onclick: async () => {
                notices.replaceChildren();
                await load();
                toast("Legendas recarregadas.");
              },
            },
            icon("redo", 14),
            "Recarregar legendas",
          ),
        ],
      ),
    );
  }

  // The video.

  let videoKey = "";

  function renderVideo(state) {
    const job = jobOf(state, "play", name);
    const summary = state.tours.find((item) => item.name === name);
    const video = summary?.video ?? tour.video;
    const percent = Math.round((job?.progress ?? 0) * 100);
    const key = [
      job?.status,
      job?.startedAt,
      percent,
      job?.message,
      video,
    ].join("|");
    if (key === videoKey) return;
    videoKey = key;

    if (job?.status === "running") {
      videoPanel.replaceChildren(
        h(
          "div",
          { class: "video-progress" },
          h(
            "div",
            { class: "progress-head" },
            h("span", { class: "spinner" }),
            h("span", {}, job.message),
            h("span", { class: "percent" }, `${percent}%`),
          ),
          h(
            "div",
            { class: "progress" },
            h("div", { style: `width: ${percent}%` }),
          ),
          h(
            "div",
            { class: "row between" },
            h(
              "span",
              { class: "hint" },
              "O Chrome refaz os passos sozinho, sem publicar nada de novo. Mudanças nas legendas valem para a próxima vez.",
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
        ),
      );
      return;
    }

    const parts = [];
    if (job?.status === "error")
      parts.push(
        notice("error", [
          h("strong", {}, "O vídeo não foi gerado. "),
          job.message,
        ]),
        tour.errorShot
          ? h(
              "button",
              {
                class: "error-shot",
                type: "button",
                onclick: () =>
                  lightbox(
                    `/errors/${name}.png?v=${tour.errorShot}`,
                    "Tela do momento do erro",
                  ),
              },
              h("img", {
                src: `/errors/${name}.png?v=${tour.errorShot}`,
                alt: "Tela do momento do erro",
              }),
              h("span", {}, "Tela do momento do erro"),
            )
          : null,
      );
    if (video) {
      parts.push(
        h(
          "div",
          { class: "video-layout" },
          h("video", {
            controls: true,
            preload: "metadata",
            src: `/videos/${encodeURIComponent(name)}.mp4?v=${video}`,
          }),
          h(
            "div",
            { class: "video-side" },
            h(
              "div",
              { class: "status done" },
              h("span", { class: "dot" }),
              "Vídeo pronto",
            ),
            h(
              "p",
              { class: "hint" },
              `Gerado ${timeAgo(video)}. Gere de novo depois de mudar as legendas ou quando o site mudar.`,
            ),
            h("span", { class: "mono path" }, `output/${name}.mp4`),
            h(
              "a",
              {
                class: "button secondary small",
                href: `/videos/${encodeURIComponent(name)}.mp4`,
                download: `${name}.mp4`,
              },
              icon("download", 14),
              "Baixar MP4",
            ),
          ),
        ),
      );
      if (job?.status === "done" && job.warnings.length)
        parts.push(
          notice("warning", [
            h("strong", {}, "O vídeo saiu, mas vale revisar o roteiro:"),
            h(
              "ul",
              {},
              job.warnings.map((warning) => h("li", {}, warning)),
            ),
          ]),
        );
    } else if (job?.status !== "error") {
      parts.push(
        h(
          "div",
          { class: "video-empty" },
          icon("film", 22),
          h(
            "div",
            {},
            h("strong", {}, "Nenhum vídeo ainda"),
            h(
              "p",
              {},
              "Revise as legendas abaixo e clique em “Gerar vídeo”. Leva alguns minutos.",
            ),
          ),
        ),
      );
    }
    videoPanel.replaceChildren(...parts.filter(Boolean));
  }

  // Actions.

  async function generate() {
    try {
      await flush();
      if (conflict)
        return toast("Recarregue as legendas antes de gerar o vídeo.", "error");
      await startVideo(name);
      await store.refresh();
      videoPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (failure) {
      toast(failure.message, "error");
    }
  }

  async function remove() {
    const ok = await confirmDialog({
      title: `Apagar “${tour?.script.intro?.title || name}”?`,
      message:
        "Apaga o roteiro, o vídeo, as telas e as respostas gravadas. Não dá para desfazer.",
      confirm: "Apagar tour",
      danger: true,
    });
    if (!ok) return;
    try {
      autosave.cancel();
      dirty = false;
      await deleteTour(name);
      toast("Tour apagado.");
      go("#/");
    } catch (failure) {
      toast(failure.message, "error");
    }
  }

  // Following the server.

  let lastPlay = "";
  let lastRecordToast = sessionStorage.getItem("record-toast");

  function update(state) {
    if (!tour) return;
    const summary = state.tours.find((item) => item.name === name);
    if (
      summary &&
      summary.modified > modified &&
      !saving &&
      !conflict &&
      !loading
    ) {
      if (dirty) showConflict();
      else {
        load();
        toast("Legendas atualizadas: o roteiro mudou fora da interface.");
        return;
      }
    }

    const play = jobOf(state, "play", name);
    const playKey = play ? `${play.status}:${play.startedAt}` : "";
    if (playKey !== lastPlay) {
      // After a run, the video or the error screenshot changed on disk.
      if (lastPlay && play && play.status !== "running")
        getTour(name)
          .then((fresh) => {
            tour.video = fresh.video;
            tour.errorShot = fresh.errorShot;
            videoKey = "";
            renderVideo(store.state);
          })
          .catch(() => {});
      lastPlay = playKey;
    }
    renderVideo(state);

    const record = jobOf(state, "record", name);
    if (record?.status === "done") {
      const key = String(record.startedAt);
      if (lastRecordToast !== key) {
        lastRecordToast = key;
        sessionStorage.setItem("record-toast", key);
        toast(record.message);
      }
      const show =
        record.warnings.length && dismissedWarnings !== key && !conflict;
      if (show && noticeKey !== key) {
        noticeKey = key;
        notices.replaceChildren(
          notice(
            "warning",
            [
              h("strong", {}, "Revise antes de gerar o vídeo:"),
              h(
                "ul",
                {},
                record.warnings.map((warning) => h("li", {}, warning)),
              ),
            ],
            [
              h(
                "button",
                {
                  class: "icon-button",
                  "aria-label": "Dispensar",
                  onclick: () => {
                    dismissedWarnings = key;
                    notices.replaceChildren();
                  },
                },
                icon("x", 16),
              ),
            ],
          ),
        );
      }
    }

    const running = play?.status === "running";
    generateButton.disabled = isBusy(state);
    generateButton.replaceChildren(
      running ? h("span", { class: "spinner light" }) : icon("play"),
      running
        ? `Gerando… ${Math.round(play.progress * 100)}%`
        : tour.video
          ? "Gerar de novo"
          : "Gerar vídeo",
    );
    generateButton.title =
      isBusy(state) && !running ? "Espere a tarefa em andamento terminar." : "";
  }

  // Edits made right before leaving still get saved.
  const onHide = () => {
    if (!dirty || conflict || !tour) return;
    fetch(path, {
      method: "PUT",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(collectEdits()),
    });
  };
  addEventListener("pagehide", onHide);

  load();
  return {
    element,
    update,
    destroy() {
      removeEventListener("pagehide", onHide);
      audio?.destroy();
      if (tour && !conflict) flush();
    },
  };
}
