import assert from "node:assert/strict";
import { test } from "node:test";
import type { RecordedAction, Recording } from "../../src/recorder/types.ts";
import { scriptFromRecording } from "../../src/script/from-recording.ts";

const context = { url: "https://app.test/", title: "App", region: "" };

function recording(actions: RecordedAction[]): Recording {
  return {
    url: "https://app.test/",
    width: 1280,
    title: "App de teste",
    time: "2026-09-27T12:00:00.000Z",
    actions,
    responses: [],
  };
}

const role = (name: string, label: string) =>
  `internal:role=${name}[name="${label}"i]`;

const actionsOf = (actions: RecordedAction[]) =>
  scriptFromRecording("t", recording(actions), {
    locale: "pt-BR",
  }).script.steps.map((step) => step.action);

test("junta o clique que só foca o campo à digitação seguinte", () => {
  assert.deepEqual(
    actionsOf([
      {
        name: "click",
        page: "main",
        selector: role("textbox", "Título"),
        clickCount: 1,
        label: "Título",
      },
      {
        name: "fill",
        page: "main",
        selector: role("textbox", "Título"),
        text: "Oi",
        label: "Título",
      },
    ]),
    ["type"],
  );
});

test("junta o clique no texto do checkbox à marcação", () => {
  assert.deepEqual(
    actionsOf([
      {
        name: "click",
        page: "main",
        selector: 'internal:text="Lembrar de mim"i',
        clickCount: 1,
        label: "Lembrar de mim",
      },
      {
        name: "check",
        page: "main",
        selector: role("checkbox", "Lembrar de mim"),
        label: "Lembrar de mim",
      },
    ]),
    ["check"],
  );
});

test("ignora cliques disparados pela página e teclas mortas", () => {
  const { script } = scriptFromRecording(
    "t",
    recording([
      { name: "press", page: "main", key: "Dead" },
      { name: "press", page: "main", key: "Enter" },
      {
        name: "click",
        page: "main",
        selector: role("button", "Enviar"),
        clickCount: 0,
      },
    ]),
    { locale: "pt-BR" },
  );
  assert.deepEqual(script.steps, [
    { action: "press", key: "Enter", page: undefined },
  ]);
});

test("a primeira navegação é o início do roteiro; as outras viram goto", () => {
  const { script } = scriptFromRecording(
    "t",
    recording([
      { name: "navigate", page: "main", url: "https://app.test/painel" },
      {
        name: "click",
        page: "main",
        selector: role("link", "Ajuda"),
        clickCount: 1,
      },
      { name: "navigate", page: "main", url: "https://app.test/ajuda" },
    ]),
    { locale: "pt-BR" },
  );
  assert.equal(script.url, "https://app.test/painel");
  assert.deepEqual(
    script.steps.map((step) => step.action),
    ["click", "goto"],
  );
});

test("digitações seguidas no mesmo campo viram um passo com o texto final", () => {
  const target = role("textbox", "Nome");
  const { script } = scriptFromRecording(
    "t",
    recording([
      { name: "fill", page: "main", selector: target, text: "Joa" },
      { name: "fill", page: "main", selector: target, text: "João" },
    ]),
    { locale: "pt-BR" },
  );
  assert.equal(script.steps.length, 1);
  assert.equal(
    script.steps[0].action === "type" && script.steps[0].text,
    "João",
  );
});

test("senhas não vão para o roteiro e geram aviso", () => {
  const { script, warnings } = scriptFromRecording(
    "t",
    recording([
      {
        name: "fill",
        page: "main",
        selector: role("textbox", "Senha"),
        text: "segredo",
        password: true,
      },
    ]),
    { locale: "pt-BR" },
  );
  assert.equal(script.steps[0].action === "type" && script.steps[0].text, "");
  assert.match(warnings[0], /senha/);
});

test("cliques em avisos passageiros ficam opcionais e sem legenda", () => {
  const { script } = scriptFromRecording(
    "t",
    recording([
      {
        name: "click",
        page: "main",
        selector: role("button", "Fechar"),
        clickCount: 1,
        context: { ...context, transient: true },
      },
    ]),
    { locale: "pt-BR" },
  );
  const [step] = script.steps;
  assert.equal(step.action === "click" && step.optional, true);
  assert.equal("caption" in step ? step.caption : "?", undefined);
});

test("popups ganham nome, e os passos neles apontam para ele", () => {
  const { script } = scriptFromRecording(
    "t",
    recording([
      {
        name: "click",
        page: "main",
        selector: role("button", "Conectar"),
        clickCount: 1,
        popup: "popup1",
      },
      { name: "navigate", page: "popup1", url: "https://auth.test/" },
      {
        name: "click",
        page: "popup1",
        selector: role("button", "Autorizar"),
        clickCount: 1,
      },
      { name: "closePage", page: "popup1" },
    ]),
    { locale: "pt-BR" },
  );
  assert.deepEqual(
    script.steps.map((step) => [
      step.action,
      "page" in step ? step.page : undefined,
    ]),
    [
      ["click", undefined],
      ["click", "popup1"],
      ["close", "popup1"],
    ],
  );
  assert.equal(
    script.steps[0].action === "click" && script.steps[0].popup,
    "popup1",
  );
});

test("atalhos são gravados com os modificadores", () => {
  const { script } = scriptFromRecording(
    "t",
    recording([{ name: "press", page: "main", key: "k", modifiers: 2 }]),
    { locale: "pt-BR" },
  );
  assert.equal(
    script.steps[0].action === "press" && script.steps[0].key,
    "Control+k",
  );
});

test("legendas, abertura e encerramento seguem o idioma", () => {
  const actions: RecordedAction[] = [
    {
      name: "click",
      page: "main",
      selector: role("button", "Salvar"),
      clickCount: 1,
      label: "Salvar",
      role: "button",
    },
  ];
  const pt = scriptFromRecording("criar-tarefa", recording(actions), {
    locale: "pt-BR",
    goal: "Criar uma tarefa",
  }).script;
  const en = scriptFromRecording("criar-tarefa", recording(actions), {
    locale: "en-US",
  }).script;
  const captionTitle = (step = pt.steps[0]) =>
    "caption" in step ? step.caption?.title : undefined;
  assert.equal(captionTitle(pt.steps[0]), "Clique em “Salvar”");
  assert.equal(captionTitle(en.steps[0]), "Click “Salvar”");
  assert.deepEqual(pt.intro, {
    title: "Criar tarefa",
    subtitle: "App de teste",
  });
  assert.equal(pt.outro?.title, "Pronto!");
  assert.equal(pt.goal, "Criar uma tarefa");
  assert.equal(pt.blockUnmocked, true);
});
