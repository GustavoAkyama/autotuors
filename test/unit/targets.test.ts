import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fragility,
  locatorName,
  stableTarget,
} from "../../src/script/targets.ts";

test("stableTarget tira do nome as contagens que mudam com os dados", () => {
  assert.equal(
    stableTarget('internal:role=button[name="Hoje, 3 tarefas"i]'),
    'internal:role=button[name="Hoje"i]',
  );
  assert.equal(
    stableTarget('internal:role=link[name="Caixa de entrada (5)"i]'),
    'internal:role=link[name="Caixa de entrada"i]',
  );
  assert.equal(
    stableTarget('internal:role=button[name="Projeto Alfa, nenhuma tarefa"i]'),
    'internal:role=button[name="Projeto Alfa"i]',
  );
});

test("stableTarget mantém nomes exatos e nomes que ficariam curtos demais", () => {
  const exact = 'internal:role=button[name="1 item"s]';
  assert.equal(stableTarget(exact), exact);
  const short = 'internal:role=button[name="A (3)"i]';
  assert.equal(stableTarget(short), short);
});

test("fragility aponta seletores que dependem de estado, posição ou id gerado", () => {
  assert.match(fragility(".MuiInputBase-root.Mui-error") ?? "", /estado/);
  assert.match(fragility("div:nth-child(2) > button") ?? "", /posição/);
  assert.match(fragility("#mui-12345") ?? "", /id gerado/);
  assert.equal(fragility('internal:role=button[name="Salvar"i]'), null);
});

test("locatorName usa a parte mais específica da cadeia", () => {
  assert.deepEqual(
    locatorName({
      kind: "role",
      body: "dialog",
      options: { name: "Nova tarefa" },
      next: { kind: "role", body: "button", options: { name: "Salvar" } },
    }),
    { label: "Salvar", role: "button" },
  );
  assert.deepEqual(locatorName({ kind: "placeholder", body: "Buscar" }), {
    label: "Buscar",
    role: "",
  });
});
