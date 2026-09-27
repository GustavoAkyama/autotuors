import type { Card } from "./types.ts";

// Captions the recorder writes from each element's name. `/legendas` in Claude
// Code (or the UI) turns them into captions that explain the flow.

type Caption = [title: string, description: string];

export type Phrases = {
  click: (label: string, role: string) => Caption;
  type: (label: string, text: string) => Caption;
  select: (label: string, value: string) => Caption;
  check: (label: string, checked: boolean) => Caption;
  upload: () => Caption;
  outro: Card;
};

const quote = (text: string) =>
  `“${text.length > 28 ? `${text.slice(0, 26).trimEnd()}…` : text}”`;

const shortText = (text: string) =>
  text && text.length <= 40 && !text.includes("\n");

const choiceRoles = ["menuitem", "option", "radio"];

const portuguese: Phrases = {
  click: (label, role) => {
    if (!label) return ["Clique aqui", "Clique neste ponto para continuar."];
    if (role === "link")
      return [`Abra ${quote(label)}`, "Clique no link para continuar."];
    if (role === "tab")
      return [`Abra ${quote(label)}`, "Clique na aba para ver o conteúdo."];
    if (choiceRoles.includes(role))
      return [`Escolha ${quote(label)}`, "Selecione esta opção."];
    return [`Clique em ${quote(label)}`, "Clique aqui para continuar."];
  },
  type: (label, text) => [
    label ? `Preencha ${quote(label)}` : "Digite aqui",
    shortText(text) ? `Digite “${text}”.` : "Digite o texto neste campo.",
  ],
  select: (label, value) => [
    label ? `Escolha ${quote(label)}` : "Escolha uma opção",
    value ? `Selecione “${value}”.` : "Selecione a opção desejada.",
  ],
  check: (label, checked) =>
    checked
      ? [
          label ? `Marque ${quote(label)}` : "Marque a opção",
          "Ative esta opção.",
        ]
      : [
          label ? `Desmarque ${quote(label)}` : "Desmarque a opção",
          "Desative esta opção.",
        ],
  upload: () => ["Envie o arquivo", "Escolha o arquivo no seu computador."],
  outro: { title: "Pronto!", subtitle: "Agora é a sua vez." },
};

const english: Phrases = {
  click: (label, role) => {
    if (!label) return ["Click here", "Click this spot to continue."];
    if (role === "link")
      return [`Open ${quote(label)}`, "Click the link to continue."];
    if (role === "tab")
      return [`Open ${quote(label)}`, "Click the tab to see its content."];
    if (choiceRoles.includes(role))
      return [`Choose ${quote(label)}`, "Select this option."];
    return [`Click ${quote(label)}`, "Click here to continue."];
  },
  type: (label, text) => [
    label ? `Fill in ${quote(label)}` : "Type here",
    shortText(text) ? `Type “${text}”.` : "Type the text in this field.",
  ],
  select: (label, value) => [
    label ? `Choose ${quote(label)}` : "Choose an option",
    value ? `Select “${value}”.` : "Select the option you need.",
  ],
  check: (label, checked) =>
    checked
      ? [
          label ? `Check ${quote(label)}` : "Check the option",
          "Turn this option on.",
        ]
      : [
          label ? `Uncheck ${quote(label)}` : "Uncheck the option",
          "Turn this option off.",
        ],
  upload: () => ["Upload the file", "Pick the file on your computer."],
  outro: { title: "All set!", subtitle: "Now it's your turn." },
};

export const phrasesFor = (locale: string) =>
  locale.startsWith("pt") ? portuguese : english;
