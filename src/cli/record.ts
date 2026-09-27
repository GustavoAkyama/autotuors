import path from "node:path";
import readline from "node:readline/promises";
import { parseArgs } from "node:util";
import { config } from "../config.ts";
import { isValidName, root } from "../paths.ts";
import { record } from "../recorder/record.ts";
import { scriptExists } from "../script/files.ts";
import { saveRecording } from "../script/save-recording.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    session: { type: "string" },
    width: { type: "string", default: "1280" },
    goal: { type: "string" },
    force: { type: "boolean", default: false },
  },
});

const [name, url] = positionals;

if (!isValidName(name) || !url) {
  console.error(
    'Uso: pnpm record <nome> <url> [--goal "o que o tour ensina"] [--session <login>] [--width 1280] [--force]',
  );
  process.exit(1);
}

if (scriptExists(name) && !values.force) {
  console.error(
    `tours/${name}.json já existe. Use --force para gravar por cima.`,
  );
  process.exit(1);
}

const prompt = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const goal =
  values.goal ??
  (await prompt
    .question(
      "Em uma frase, o que este tour ensina? (ajuda a escrever as legendas; Enter pula)\n> ",
    )
    .catch(() => ""));

const recording = await record({
  url,
  width: Number(values.width),
  session: values.session,
});

console.log("Gravando. Faça o passo a passo na janela do Chrome.");

await Promise.race([
  recording.closed,
  prompt
    .question("Quando terminar, feche a janela ou pressione Enter aqui.\n")
    .catch(() => {}),
]);

prompt.close();

const saved = saveRecording(name, await recording.stop(), {
  session: values.session,
  locale: config.locale,
  goal: goal.trim(),
});

for (const warning of saved.warnings) console.warn(`Atenção: ${warning}`);

console.log(
  `Roteiro salvo em ${path.relative(root, saved.file)} (${saved.script.steps.length} passos, ${saved.mocks} respostas em mocks/${name}/).`,
);

if (saved.captures)
  console.log(
    `Telas de cada passo em captures/${name}/: peça ao Claude “/legendas ${name}” para reescrever as legendas.`,
  );

console.log(`Revise as legendas e gere o vídeo com: pnpm play ${name}`);
