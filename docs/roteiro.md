# Formato do roteiro

Cada tour é um arquivo `tours/<nome>.json`. A gravação cria o arquivo; você pode editá-lo à mão, pela interface (legendas) ou com o `/legendas` do Claude Code. O vídeo pode ser gerado de novo quantas vezes quiser, por exemplo quando o site mudar.

```json
{
  "url": "https://x.com/home",
  "goal": "Como publicar um post no X",
  "width": 1280,
  "session": "x",
  "zoom": true,
  "narrate": true,
  "intro": { "title": "Como postar no X", "subtitle": "Em dois passos" },
  "outro": { "title": "Pronto!", "subtitle": "Agora é a sua vez." },
  "steps": [
    {
      "action": "type",
      "target": "internal:role=textbox[name=\"Post text\"i]",
      "text": "Meu primeiro post",
      "caption": { "title": "Escreva o post", "description": "Conte o que está acontecendo." }
    },
    {
      "action": "click",
      "target": "internal:testid=[data-testid=\"tweetButtonInline\"s]",
      "caption": {
        "title": "Publique",
        "description": "Clique em “Postar”.",
        "narration": "Agora é só clicar em postar."
      }
    }
  ],
  "blockUnmocked": true,
  "mocks": [
    {
      "method": "POST",
      "url": "https://x.com/i/api/graphql/*/CreateTweet",
      "status": 200,
      "body": "mocks/post-no-x/01-CreateTweet.json"
    }
  ]
}
```

## Campos

| Campo | Uso |
| --- | --- |
| `url` | Página onde o tour começa |
| `goal` | O que o tour ensina, em uma frase; orienta quem escreve as legendas |
| `width` | Largura da tela em pixels (padrão 1280); a altura segue 16:9. Use 1600 para telas com muita informação |
| `time` | Data e hora que o site vê (ISO). A gravação salva o momento em que começou, para datas como “hoje” ficarem iguais às da gravação |
| `session` | Login salvo que o vídeo usa |
| `zoom` | `true` (até 1,4×) ou o zoom máximo, como `1.6` |
| `narrate` | Lê cada legenda em voz alta |
| `voice` | Troca a voz só neste roteiro, como o seletor do editor (veja [Narração](narracao.md)) |
| `music` | Uma música da lista, `{ "track": "easy-lemon", "volume": 0.15 }`, um arquivo seu, `{ "file": "assets/musica.mp3" }`, ou `false` para tirar a música do `tour.config.ts` (veja [Música](narracao.md#música)) |
| `intro` / `outro` | Telas de abertura e encerramento: `{ title, subtitle?, narration?, logo? }` |
| `steps` | Os passos, em ordem |
| `blockUnmocked` | Responde `{}` às requisições que alteram dados e não têm mock |
| `mocks` | Respostas prontas (veja abaixo) |

## Passos

| Ação | Campos |
| --- | --- |
| `goto` | `url` |
| `click` | `target`; `popup` dá nome ao popup que o clique abre; `host` troca o endereço exibido na janela; `button` e `clickCount` para clique direito ou duplo |
| `type` | `target`, `text` (o campo é limpo antes) |
| `press` | `key` (`Enter`, `Control+K`...), exibida na tela |
| `select` | `target`, `values` |
| `check` / `uncheck` | `target` |
| `hover` | `target` |
| `upload` | `target`, `files` (caminhos a partir da raiz do projeto) |
| `caption` | `caption` e `target` opcional (sem alvo, a legenda fica centralizada) |
| `wait` | `ms` |
| `close` | `page`: espera o popup fechar sozinho ou o fecha |

Qualquer ação aceita:

- `caption`: a legenda mostrada antes dela, `{ title, description, narration?, side?, align?, ring? }`. `narration` troca o texto narrado (útil para siglas); `narration: false` deixa o passo mudo.
- `page`: onde a ação acontece, `main` (padrão) ou o nome de um popup.
- `optional: true`: pula o passo quando o alvo não aparece, como um aviso que já sumiu.

O `target` é um seletor do Playwright. A gravação escreve seletores como `internal:role=button[name="Postar"i]` (o `i` no fim casa o nome por trecho, sem diferenciar maiúsculas); seletores CSS também funcionam.

## Mocks

Um mock é uma resposta pronta para uma requisição: `method`, `url` (sem a query; `*` casa um trecho do caminho e `**` qualquer coisa), `status`, `headers` e o corpo em `body` (arquivo a partir da raiz do projeto) ou `json` (inline).

- A gravação cria um mock para cada requisição que altera dados (POST, PUT, PATCH, DELETE), com o corpo em `mocks/<nome>/`. Mocks da mesma URL respondem na ordem em que foram gravados.
- Login, renovação de token e conexões em tempo real (WebSocket, socket.io) nunca são mockados: continuam indo ao site.
- Mocks também servem para GETs, para mostrar dados que a conta não tem:

```json
{ "method": "GET", "url": "https://app.com/api/tarefas", "json": [{ "id": 1, "titulo": "Comprar café" }] }
```

## Quando o vídeo falha

A gravação e a geração já evitam as quebras mais comuns:

- **Nomes com contagem** (“Hoje, 3 tarefas”, “Caixa de entrada (5)”) são gravados sem a contagem, já que o que a gravação cria muda esses números. Se mesmo assim um nome não for achado, o vídeo tenta uma versão mais curta com um único resultado e avisa qual usou.
- **Avisos que somem sozinhos** (toasts, alertas) viram passos `optional`, sem legenda.
- **Cliques duplicados**, como o clique no texto de um checkbox seguido da marcação dele, viram um passo só.
- **Seletores frágeis**, que dependem de estado (`.Mui-error`), posição (`nth-child`) ou id gerado, geram um aviso ao salvar a gravação.
- **Login expirado**: a geração para logo no começo, avisando que o site abriu na tela de login. Faça o login de novo.
- A narração é gerada antes da gravação começar, para o site não ficar parado enquanto a voz é sintetizada.

Quando um passo falha, a mensagem diz o alvo, a página e a causa provável, e a tela do momento fica salva em `output/<nome>-erro.png`. Os avisos que não impediram o vídeo aparecem na interface e no terminal (começando por “Atenção:”).

Para depurar a composição do vídeo, `pnpm play <nome> --keep-frames` mantém os quadros em `output/<nome>/`.
