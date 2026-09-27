import { defaultPiperModel } from "../narration/voices/piper.ts";
import { installPiper } from "../narration/voices/piper-install.ts";

const model = process.argv[2] ?? defaultPiperModel;

await installPiper(model);

console.log(`Piper pronto com a voz ${model}.`);
