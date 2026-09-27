import { getChoices } from "./api.js";
import { h } from "./dom.js";
import { toast } from "./feedback.js";
import { icon } from "./icons.js";

const option = (value, label, selected) =>
  h("option", { value, selected: value === selected }, label);

const copyButton = (text, title) =>
  h(
    "button",
    {
      class: "icon-button small",
      type: "button",
      title,
      "aria-label": title,
      onclick: () =>
        navigator.clipboard.writeText(text).then(() => toast("Copiado.")),
    },
    icon("copy", 13),
  );

/**
 * The voice and music selectors of a tour. `selected` is what the server says
 * the script uses (`{ voice, music }`); `onChange` runs after each pick.
 */
export function audioPanel(selected, onChange) {
  let ready = false;
  let voices = [];
  let tracks = [];

  const voiceSelect = h("select", {
    class: "input",
    id: "voice-select",
    onchange: () => {
      showVoice();
      onChange();
    },
  });
  const musicSelect = h("select", {
    class: "input",
    id: "music-select",
    onchange: () => {
      stopPreview();
      showMusic();
      onChange();
    },
  });
  const voiceInfo = h("div", { class: "audio-info" });
  const musicInfo = h("div", { class: "audio-info" });
  const preview = h("audio", { preload: "none", onended: () => stopPreview() });
  const previewButton = h("button", {
    class: "button secondary",
    type: "button",
    onclick: togglePreview,
  });

  const element = h(
    "section",
    { class: "card audio-panel" },
    h(
      "div",
      { class: "field" },
      h("label", { for: "voice-select" }, "Narração"),
      voiceSelect,
      voiceInfo,
    ),
    h(
      "div",
      { class: "field" },
      h("label", { for: "music-select" }, "Música de fundo"),
      h("div", { class: "audio-row" }, musicSelect, previewButton),
      musicInfo,
      preview,
    ),
  );

  function fill({ voices: voiceList, music, defaults }) {
    voices = voiceList;
    tracks = music;
    const defaultVoice = voices.find((voice) => voice.id === defaults.voice);
    const group = (engine, label) =>
      h(
        "optgroup",
        { label },
        voices
          .filter((voice) => voice.engine === engine)
          .map((voice) =>
            option(
              voice.id,
              voice.missing ? `${voice.label} (indisponível)` : voice.label,
              selected.voice,
            ),
          ),
      );
    voiceSelect.replaceChildren(
      option(
        "default",
        `Padrão${defaultVoice ? `: ${defaultVoice.engine} ${defaultVoice.label}` : " do tour.config.ts"}`,
        selected.voice,
      ),
      selected.voice === "custom"
        ? option("custom", "A definida no roteiro", selected.voice)
        : null,
      group("Piper", "Piper: offline, instalada com pnpm setup:piper"),
      group("Kokoro", "Kokoro: servidor em Docker"),
      option("none", "Sem narração", selected.voice),
    );

    // Without music in tour.config.ts, "default" and "none" sound the same.
    const musicValue =
      !defaults.music && selected.music === "none" ? "default" : selected.music;
    musicSelect.replaceChildren(
      defaults.music
        ? option("default", `Padrão: ${defaults.music}`, musicValue)
        : option("default", "Sem música", musicValue),
      defaults.music ? option("none", "Sem música", musicValue) : null,
      musicValue === "custom"
        ? option("custom", "A definida no roteiro", musicValue)
        : null,
      h(
        "optgroup",
        { label: "Músicas com licença de uso" },
        tracks.map((track) =>
          option(track.id, `${track.title} · ${track.mood}`, musicValue),
        ),
      ),
    );
    ready = true;
    showVoice();
    showMusic();
  }

  function showVoice() {
    const voice = voices.find((item) => item.id === voiceSelect.value);
    if (voice?.missing) {
      const { reason, command } = voice.missing;
      voiceInfo.replaceChildren(
        h(
          "p",
          { class: "hint warning-text" },
          `${reason}: `,
          h("code", {}, command),
          copyButton(command, "Copiar o comando"),
        ),
      );
    } else if (voiceSelect.value === "none")
      voiceInfo.replaceChildren(
        h("p", { class: "hint" }, "As legendas aparecem sem voz."),
      );
    else
      voiceInfo.replaceChildren(
        h(
          "p",
          { class: "hint" },
          "Lê a descrição de cada legenda, a abertura e o encerramento.",
        ),
      );
  }

  function showMusic() {
    const track = tracks.find((item) => item.id === musicSelect.value);
    previewButton.hidden = !track;
    stopPreview();
    if (!track) {
      musicInfo.replaceChildren();
      return;
    }
    musicInfo.replaceChildren(
      h(
        "p",
        { class: "hint" },
        `${track.artist}, licença `,
        h(
          "a",
          { href: track.licenseUrl, target: "_blank", rel: "noreferrer" },
          track.license,
        ),
        ". Coloque o crédito na descrição do vídeo:",
      ),
      h(
        "div",
        { class: "credit" },
        h("span", {}, track.credit),
        copyButton(track.credit, "Copiar o crédito"),
      ),
    );
  }

  function stopPreview() {
    preview.pause();
    previewButton.replaceChildren(icon("play", 13), "Ouvir");
  }

  function togglePreview() {
    if (!preview.paused) return stopPreview();
    const src = `/music/${musicSelect.value}.mp3`;
    if (!preview.src.endsWith(src)) preview.src = src;
    previewButton.replaceChildren(icon("stop", 13), "Parar");
    preview.play().catch(() => {
      stopPreview();
      toast(
        "Não consegui tocar a música. Verifique a conexão com a internet.",
        "error",
      );
    });
  }

  // Asked on every visit: a voice may have been installed or Kokoro started since.
  getChoices()
    .then(fill)
    .catch((failure) => {
      element.replaceChildren(
        h(
          "p",
          { class: "hint" },
          `Não consegui carregar as vozes e músicas: ${failure.message}`,
        ),
      );
    });

  return {
    element,
    /** The picks to save, or null before the lists load. */
    value: () =>
      ready ? { voice: voiceSelect.value, music: musicSelect.value } : null,
    destroy: stopPreview,
  };
}
