import path from "node:path";
import readline from "node:readline/promises";
import { openLogin } from "../browser/login.ts";
import { isValidName, root } from "../paths.ts";

const [name, url] = process.argv.slice(2);

if (!isValidName(name) || !url) {
  console.error("Uso: pnpm session <nome> <url>");
  process.exit(1);
}

const login = await openLogin(name, url);

console.log("Faça login na janela do Chrome.");

const prompt = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

await Promise.race([
  login.closed,
  prompt
    .question("Quando terminar, pressione Enter aqui (ou feche a janela).\n")
    .catch(() => {}),
]);

prompt.close();

await login.finish();

console.log(
  `Login salvo em ${path.relative(root, login.file)}. Use --session ${name} ao gravar.`,
);
