import path from "node:path";
import { parseArgs } from "node:util";
import { play } from "../player/play.ts";
import { loadScript } from "../script/files.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { "keep-frames": { type: "boolean", default: false } },
});

const [input] = positionals;

if (!input) {
  console.error(
    "Uso: pnpm play <nome | caminho/do/roteiro.json> [--keep-frames]",
  );
  process.exit(1);
}

// "[42%] Passo 3 de 9": readable here, and parsed by `pnpm ui` for its progress bar.
let last = "";
await play(loadScript(input), path.basename(input, ".json"), {
  keepFrames: values["keep-frames"],
  onProgress: (fraction, label) => {
    const line = `[${Math.round(fraction * 100)}%] ${label}`;
    if (line !== last) console.log(line);
    last = line;
  },
  onWarning: (message) => console.log(`Atenção: ${message}`),
});
