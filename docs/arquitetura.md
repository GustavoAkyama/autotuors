# Arquitetura

Um tour passa por três etapas, cada uma numa pasta de `src/`:

```
 Chrome (você usa o site)          tours/<nome>.json             output/<nome>.mp4
          │                                  ▲    │                          ▲
          ▼                                  │    ▼                          │
   src/recorder ──── Recording ────▶ src/script      src/player ──── Demo ───▶ src/video
   (grava ações,                     (vira passos,    (executa cada            (cursor, legendas,
    telas e respostas)                legendas e       passo, mocka a           câmera, ffmpeg)
                                      mocks)           rede)
```

## Pastas

| Pasta | Responsabilidade |
| --- | --- |
| `src/cli/` | Os comandos do `pnpm` (`ui`, `record`, `play`, `session`, `setup:piper`). Só leem argumentos e chamam os módulos |
| `src/server/` | Servidor da interface: rotas (`routes.ts`), a tarefa em andamento (`jobs.ts`), tours (`tours.ts`) e HTTP (`http.ts`) |
| `src/browser/` | Abrir o Chrome, logins salvos (`sessions.ts`, `login.ts`) e o helper `pageScript` |
| `src/recorder/` | Grava o que a pessoa faz: o gravador do Playwright (`playwright-recorder.ts`) mais o que a página conta de cada elemento (`interactions.ts`, `page/`) |
| `src/script/` | O roteiro: tipos, leitura e validação (`files.ts`), conversão da gravação em passos (`from-recording.ts`), seletores (`targets.ts`), legendas geradas (`phrases.ts`) e capturas de tela (`captures.ts`) |
| `src/mocks/` | A proteção “nada é publicado de novo”: captura as respostas na gravação (`capture.ts`), gera os mocks (`from-responses.ts`) e responde com eles no vídeo (`replay.ts`) |
| `src/player/` | Toca um roteiro: acha cada alvo e explica falhas (`find-target.ts`), executa o passo (`run-step.ts`) e prepara o site (`play.ts`) |
| `src/video/` | O `Demo`: cursor (`pointer.ts`), legendas (`captions.ts`), popups (`popups.ts`), telas de abertura (`cards.ts`) e a composição do MP4 (`compose/`) |
| `src/video/overlay/` | O que é desenhado dentro da página durante a gravação: cursor, teclas, janela de popup, legendas e rolagem |
| `src/narration/` | Narração com cache e os provedores de voz (`voices/`) |
| `ui/` | A interface: HTML, CSS e JavaScript sem etapa de build |
| `test/` | Testes unitários (`unit/`) e de ponta a ponta (`e2e.test.ts`, com um site de teste em `fixture/`) |

## Código que roda dentro da página

`src/recorder/page/` e `src/video/overlay/` rodam no navegador, injetados com `addInitScript`. O helper `pageScript` (em `src/browser/page-script.ts`) monta o script a partir do código-fonte das funções. Por isso essas funções:

- podem usar globais do navegador, seus argumentos e umas às outras, desde que estejam na lista de helpers;
- não podem usar imports nem constantes do módulo;
- devem ser declaradas com `function`, para manter o nome.

## Convenções

- Node 24 roda os `.ts` direto (type stripping): nada de `enum`, `namespace` ou outra sintaxe que precise de compilação.
- Mensagens para quem usa a ferramenta em português; nomes e comentários do código em inglês.
- Antes de abrir um PR: `pnpm typecheck` e `pnpm test`. `pnpm test:e2e` grava um site de teste e gera o vídeo de verdade (precisa do Chrome, do ffmpeg e do Piper).
