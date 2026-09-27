import { $, h } from "./dom.js";
import { notice } from "./feedback.js";
import { icon } from "./icons.js";
import { humanize, store } from "./store.js";
import { editorView } from "./views/editor.js";
import { homeView } from "./views/home.js";
import { newTourView } from "./views/new-tour.js";

let view = null;

/** #/ → list, #/novo → new tour, #/t/<name> → editor. */
function route() {
  const [path, query = ""] = (location.hash.slice(1) || "/").split("?");
  view?.destroy?.();
  if (path === "/novo") view = newTourView(new URLSearchParams(query));
  else if (path.startsWith("/t/"))
    view = editorView(decodeURIComponent(path.slice(3)));
  else view = homeView();
  $("#view").replaceChildren(view.element);
  // The list and the form have their own button.
  $("#new-button").hidden = !path.startsWith("/t/");
  view.update?.(store.state);
  scrollTo(0, 0);
}

/** What's going on, wherever the user is: missing tools, lost server, a job elsewhere. */
function renderBanners({ job, missing, tours }) {
  const banners = [];
  if (!store.online)
    banners.push(
      notice(
        "error",
        "Sem conexão com o servidor. Ele ainda está rodando? Abra de novo com: pnpm ui",
      ),
    );
  for (const problem of missing ?? []) banners.push(notice("warning", problem));

  const here = location.hash.slice(1);
  const running = job?.status === "running" ? job : null;
  const target =
    running && (running.kind === "login" ? null : `/t/${running.name}`);
  const onPage =
    running &&
    (here === target ||
      (running.kind === "record" && here.startsWith("/novo")));
  if (running && !onPage && running.kind !== "login") {
    const title =
      tours?.find((item) => item.name === running.name)?.title ??
      humanize(running.name);
    const label =
      running.kind === "record"
        ? `Gravando “${title}”`
        : `Gerando o vídeo de “${title}” · ${Math.round(running.progress * 100)}%`;
    banners.push(
      notice("info", label, [
        h(
          "a",
          {
            class: "button secondary small",
            href: running.kind === "record" ? "#/novo" : `#${target}`,
          },
          "Ver",
          icon("arrow", 14),
        ),
      ]),
    );
  }
  const key = JSON.stringify([
    store.online,
    missing,
    running?.kind,
    running?.name,
    running?.progress,
    onPage,
  ]);
  if (renderBanners.last === key) return;
  renderBanners.last = key;
  $("#banners").replaceChildren(...banners);
}

function renderTitle({ job }) {
  const running = job?.status === "running" ? job : null;
  document.title =
    running?.kind === "record"
      ? "● Gravando… · Autotours"
      : running?.kind === "play"
        ? `${Math.round(running.progress * 100)}% · Gerando vídeo · Autotours`
        : "Autotours";
}

store.subscribe((state) => {
  renderBanners(state);
  renderTitle(state);
  view?.update?.(state);
});

async function poll() {
  await store.refresh();
  setTimeout(poll, 1000);
}

addEventListener("hashchange", route);
await store.refresh();
route();
setTimeout(poll, 1000);
