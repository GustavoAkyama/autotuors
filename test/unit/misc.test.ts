import assert from "node:assert/strict";
import { test } from "node:test";
import { looksLikeLogin } from "../../src/browser/sessions.ts";
import { siteUrl } from "../../src/browser/url.ts";
import { validateScript } from "../../src/script/files.ts";
import type { TourScript } from "../../src/script/types.ts";
import { planCamera } from "../../src/video/compose/camera.ts";
import { keyLabels } from "../../src/video/keys.ts";

test("siteUrl completa endereços digitados sem protocolo", () => {
  assert.equal(siteUrl("meusite.com/login"), "https://meusite.com/login");
  assert.equal(siteUrl("  http://app.test/x "), "http://app.test/x");
  assert.equal(
    siteUrl("localhost:5173/painel"),
    "http://localhost:5173/painel",
  );
  assert.throws(() => siteUrl("nada"), /não parece um endereço/);
});

test("looksLikeLogin reconhece páginas de login", () => {
  assert.ok(looksLikeLogin("https://app.test/login?next=/"));
  assert.ok(looksLikeLogin("https://accounts.google.com/signin"));
  assert.ok(looksLikeLogin("https://app.test/entrar"));
  assert.ok(!looksLikeLogin("https://app.test/tarefas"));
});

test("validateScript explica o que falta no roteiro", () => {
  const invalid = (script: unknown) => script as TourScript;
  assert.throws(
    () => validateScript(invalid({ steps: [] }), "x.json"),
    /"url"/,
  );
  assert.throws(
    () =>
      validateScript(
        invalid({ url: "https://a.test", steps: [{ action: "dance" }] }),
        "x.json",
      ),
    /passo 1 .* "dance"/,
  );
  validateScript(
    { url: "https://a.test", steps: [{ action: "wait", ms: 10 }] },
    "x.json",
  );
});

test("keyLabels mostra atalhos como no teclado", () => {
  assert.deepEqual(keyLabels("Control+k"), ["Ctrl", "K"]);
  assert.deepEqual(keyLabels("Control++"), ["Ctrl", "+"]);
  assert.deepEqual(keyLabels("ArrowDown"), ["↓"]);
});

test("a câmera aproxima do alvo e volta ao quadro inteiro", () => {
  const moves = planCamera(
    [
      { time: 1, rect: { x: 100, y: 100, width: 200, height: 40 } },
      { time: 1.2, rect: { x: 120, y: 110, width: 100, height: 30 } },
      { time: 5, rect: null },
    ],
    { width: 1280, height: 720 },
    1.4,
  );
  assert.equal(moves.length, 2, "o segundo alvo já estava enquadrado");
  assert.equal(moves[0].to.zoom, 1.4);
  assert.deepEqual(moves[1].to, { zoom: 1, x: 640, y: 360 });
  assert.equal(moves[1].start, 5);
});
