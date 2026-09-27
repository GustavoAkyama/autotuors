# Narração e música

Com a narração ligada, cada legenda é lida em voz alta:

- O texto lido é a `description` da legenda, ou `narration` quando definido. `narration: false` deixa o passo mudo.
- A abertura e o encerramento leem título e subtítulo.
- A legenda fica na tela pelo tempo da fala.
- Os áudios ficam em cache em `.cache/narration/`: cada frase é sintetizada uma vez só, e o tempo gasto gerando a voz é cortado do vídeo.

## Escolhendo a voz

No editor do tour, o seletor **Narração** mostra as vozes em português do Brasil dos dois motores, **Piper** e **Kokoro**, além de **Sem narração**. A escolha é salva no roteiro (campos `narrate` e `voice`). Se uma voz ainda não está pronta, o editor mostra o comando que a prepara.

**Padrão** usa a voz do `voice` no `tour.config.ts`, que vale para todos os tours:

```ts
voice: { provider: "piper", model: "pt_BR-faber-medium" },
```

| Motor | Vozes | Como preparar |
| --- | --- | --- |
| `piper` (padrão) | Faber, Cadu e Jeff (masculinas) | `pnpm setup:piper <voz>`, sem Docker. Instala em `.cache/piper/` |
| `kokoro` | Dora (feminina), Alex e Santa (masculinas) | Um container Docker rodando na sua máquina |

## Piper

Voz neural gratuita que roda offline e é rápida na CPU (menos de 1 s por frase). `pnpm setup:piper` instala o Piper e a voz padrão; passe o nome para instalar outra:

```sh
pnpm setup:piper pt_BR-cadu-medium
pnpm setup:piper pt_BR-jeff-medium
```

```ts
voice: { provider: "piper", model: "pt_BR-faber-medium", speed: 1 },
```

- `model`: nome de uma voz de [piper-voices](https://huggingface.co/rhasspy/piper-voices) ou caminho para um arquivo `.onnx`.
- `speed`: 1 é a velocidade normal; 1.1 é 10% mais rápido.

## Kokoro

[Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI) (Apache-2.0) roda na CPU dentro de um container Docker (imagem de ~1,5 GB). É a única opção com voz feminina em português, mas o sotaque às vezes escorrega: ouça antes de adotar.

```sh
docker run -d --name kokoro -p 8880:8880 --restart unless-stopped ghcr.io/remsky/kokoro-fastapi-cpu:latest
```

Com uma GPU NVIDIA, use a imagem `ghcr.io/remsky/kokoro-fastapi-gpu:latest` e acrescente `--gpus all`.

```ts
voice: { provider: "kokoro", voice: "pf_dora", speed: 1 },
```

- `voice`: `pf_dora`, `pm_alex` ou `pm_santa`.
- `url`: onde o servidor responde, se não for o padrão `http://127.0.0.1:8880/v1`.
- Enquanto o modelo carrega, o servidor responde 503 e a narração espera.

## Música

No editor, o seletor **Música de fundo** traz uma lista de músicas com licença de uso. O botão **Ouvir** toca a música ali mesmo. Cada música é baixada uma vez, na primeira vez que é usada, e fica em `.cache/music/`.

| Música | Clima |
| --- | --- |
| Easy Lemon | Leve e alegre |
| Carefree | Animada, com ukulele |
| Wallpaper | Eletrônica calma, bem discreta |
| Airport Lounge | Lounge tranquilo |
| Local Forecast - Elevator | Jazz suave |
| Bossa Antigua | Bossa nova |
| Inspired | Piano e cordas, inspiradora |

Todas são de Kevin MacLeod ([incompetech.com](https://incompetech.com)), sob a licença [Creative Commons BY 4.0](https://creativecommons.org/licenses/by/4.0/). Você pode usá-las em qualquer vídeo, inclusive comercial, desde que dê o crédito. O editor mostra o texto do crédito, pronto para copiar para a descrição do vídeo:

```
"Easy Lemon" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0 License https://creativecommons.org/licenses/by/4.0/
```

A música toca durante todo o vídeo, abaixa sozinha durante a narração e some no final. Ela fica no campo `music`, no roteiro ou no `tour.config.ts` (para valer em todos os tours):

```ts
music: { track: "easy-lemon", volume: 0.15 },        // uma música da lista
music: { file: "assets/minha-musica.mp3" },          // ou um arquivo seu
```

No roteiro, `"music": false` tira a música do `tour.config.ts`. Para usar um arquivo seu, confira antes se a licença dele permite.

## Outro motor de voz

Para usar outro serviço (uma API paga, por exemplo), crie `src/narration/voices/<nome>.ts` com uma função que recebe as opções e o idioma e devolve um `SpeechProvider`. Depois acrescente as opções ao tipo `VoiceConfig` e registre a função em `providers`, os dois em `src/narration/index.ts`. Para que ele apareça no seletor do editor, acrescente as vozes em `src/narration/choices.ts`.

```ts
import fs from "node:fs";
import type { SpeechProvider } from "../index.ts";

export type MinhaVozOptions = { voice?: string };

export function minhaVoz({ voice = "padrao" }: MinhaVozOptions): SpeechProvider {
  return {
    id: `minha-voz:${voice}`, // mude quando o áudio mudar: é a chave do cache
    extension: "mp3",         // qualquer formato que o ffmpeg leia
    async synthesize(text, output) {
      const audio = await chamarApi(text, voice); // Buffer com o áudio
      fs.writeFileSync(output, audio);
    },
  };
}
```
