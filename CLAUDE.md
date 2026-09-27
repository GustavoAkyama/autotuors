@README.md
@docs/arquitetura.md

## Notas para o Claude

- Depois de mudar o código, rode `pnpm typecheck` e `pnpm test`. Se a mudança toca o gravador, o reprodutor ou o vídeo, rode também `pnpm test:e2e`.
- Para revisar um vídeo, extraia quadros com o ffmpeg: `ffmpeg -ss 5 -i output/<nome>.mp4 -frames:v 1 quadro.png`.
- `sessions/`, `mocks/`, `captures/` e as gravações em `tours/` são dados de quem usa a ferramenta: não os versione nem os apague sem pedir.
