import { h, timeAgo } from "../dom.js";
import { icon } from "../icons.js";
import { humanize } from "../store.js";

const howItWorks = [
  [
    "record",
    "Grave",
    "Informe o endereço e faça o passo a passo numa janela do Chrome.",
  ],
  [
    "sparkles",
    "Revise as legendas",
    "Cada passo vira uma legenda, com a tela do momento ao lado.",
  ],
  [
    "film",
    "Gere o vídeo",
    "Cursor animado, zoom, narração e abertura, em MP4.",
  ],
];

function status(tour, job) {
  const running =
    job?.status === "running" &&
    job.kind !== "login" &&
    job.name === tour.name;
  if (running && job.kind === "record")
    return h(
      "span",
      { class: "status recording" },
      h("span", { class: "rec-dot" }),
      "Gravando",
    );
  if (running)
    return h(
      "span",
      { class: "status active" },
      `Gerando vídeo · ${Math.round(job.progress * 100)}%`,
    );
  if (tour.error)
    return h("span", { class: "status error" }, "Roteiro com erro");
  if (tour.video)
    return h(
      "span",
      { class: "status done" },
      h("span", { class: "dot" }),
      "Vídeo pronto",
    );
  return h("span", { class: "status" }, "Sem vídeo");
}

function tourRow(tour, job) {
  const edited = Math.max(tour.modified, tour.video ?? 0);
  return h(
    "a",
    { class: "tour", href: `#/t/${encodeURIComponent(tour.name)}` },
    h(
      "div",
      { class: "thumb" },
      tour.thumbnail
        ? h("img", { src: tour.thumbnail, alt: "", loading: "lazy" })
        : icon("film", 20),
    ),
    h(
      "div",
      { class: "tour-body" },
      h(
        "div",
        { class: "tour-title" },
        tour.title || humanize(tour.name),
      ),
      h(
        "div",
        { class: "tour-goal" },
        tour.error ?? tour.goal ?? tour.url ?? "",
      ),
      h(
        "div",
        { class: "tour-meta" },
        status(tour, job),
        tour.steps != null
          ? h("span", {}, `${tour.steps} passos`)
          : null,
        h("span", {}, timeAgo(edited)),
      ),
    ),
    icon("chevron", 18),
  );
}

export function homeView() {
  const list = h("div", { class: "tour-list" });
  const intro = h(
    "section",
    { class: "how-it-works" },
    howItWorks.map(([name, title, text], index) =>
      h(
        "div",
        { class: "how-step" },
        h("div", { class: "how-icon" }, icon(name, 18)),
        h("div", { class: "how-title" }, `${index + 1}. ${title}`),
        h("p", {}, text),
      ),
    ),
  );
  const element = h(
    "div",
    { class: "home" },
    h(
      "div",
      { class: "page-header" },
      h(
        "div",
        {},
        h("h1", {}, "Seus tours"),
        h(
          "p",
          { class: "lead" },
          "Transforme um passo a passo num site em vídeo, com legendas e narração.",
        ),
      ),
      h(
        "a",
        { class: "button primary", href: "#/novo" },
        icon("plus"),
        "Novo tour",
      ),
    ),
    intro,
    list,
  );

  let rendered = "";
  return {
    element,
    update({ tours, job }) {
      const key = JSON.stringify([
        tours,
        job?.name,
        job?.status,
        job?.progress,
      ]);
      if (key === rendered) return;
      rendered = key;
      // Newcomers (nothing but the example) see how it works first.
      intro.hidden =
        tours.filter((item) => item.name !== "exemplo").length > 0;
      const sorted = [...tours].sort(
        (a, b) =>
          Math.max(b.modified, b.video ?? 0) -
          Math.max(a.modified, a.video ?? 0),
      );
      list.replaceChildren(
        ...(sorted.length
          ? sorted.map((tour) => tourRow(tour, job))
          : [
              h(
                "div",
                { class: "empty" },
                icon("film", 28),
                h("h2", {}, "Nenhum tour ainda"),
                h(
                  "p",
                  { class: "muted" },
                  "Grave o primeiro: leva só o tempo de fazer o passo a passo.",
                ),
                h(
                  "a",
                  { class: "button primary", href: "#/novo" },
                  icon("plus"),
                  "Novo tour",
                ),
              ),
            ]),
      );
    },
  };
}
