---
name: legendas
description: Reescreve as legendas, a narração, a abertura e o encerramento de um roteiro gravado pela interface ou com `pnpm record` (tours/<nome>.json), usando o objetivo do tour e as telas de cada passo em captures/<nome>/, e aponta os passos que podem quebrar o vídeo.
argument-hint: <nome>
---

Reescreva as legendas de `tours/$ARGUMENTS.json`.

## Material

1. Leia `tours/$ARGUMENTS.json`. O campo `goal` diz o que o tour ensina.
2. Leia `captures/$ARGUMENTS/context.json`. Cada item traz o número do passo, a ação, o alvo, o nome e o papel do elemento, a URL, o título da página, o diálogo ou menu aberto (`region`), se o elemento está num aviso que some sozinho (`transient`), onde o elemento estava na tela (`rect`) e a screenshot.
3. Abra as screenshots. O elemento usado no passo está contornado em vermelho. A tela foi capturada no instante da ação, então um menu pode já estar abrindo.
4. Os passos são casados pelo número. Se o roteiro foi editado depois da gravação e os números não baterem mais, case pelo `target`.

Sem `goal` e sem `captures/`, deduza a intenção pela sequência de passos e pelos alvos. Se ela continuar ambígua, pergunte ao usuário em uma frase antes de escrever.

## O que escrever

Entenda primeiro o fluxo inteiro e depois escreva cada legenda pensando no que ela ensina dentro dele. A legenda explica o porquê do passo, e não só o clique.

- `title`: 2 a 4 palavras, no imperativo ("Crie a tarefa").
- `description`: uma frase curta sobre o que o passo faz ou por que ele importa. Não repita o título e não use "Clique aqui para continuar".
- `narration`: só quando a fala natural for diferente do texto escrito (siglas, símbolos, nomes de botão longos). Caso contrário, omita.
- `intro`: `title` com o tema do tour e `subtitle` com o resultado ou o contexto. `outro`: fechamento curto, ligado ao que foi feito.
- Use o idioma do `locale` em `tour.config.ts` e os termos exatos da interface, entre aspas curvas: “Salvar”.
- Um passo que só completa outro (escolher uma opção depois de abrir um menu, confirmar a escolha) fica sem `caption`. Assim o vídeo mostra uma legenda só para o conjunto.
- Passos com `optional: true` (fechar um aviso, por exemplo) ficam sem `caption`. A legenda seguraria o passo por segundos, e o aviso some antes do clique. Se a confirmação importa, fale dela no `outro`.
- Não exponha dados de clientes que aparecem nas telas (nomes, e-mails, valores).

## Limites

Mude só `caption`, `intro` e `outro`. Não altere `action`, `target`, `text`, `page`, `optional`, os mocks nem a ordem dos passos. Se um passo parecer errado ou sobrando, aponte no resumo em vez de apagar.

## O que pode quebrar o vídeo

O `play` já resolve sozinho parte dos problemas. A gravação tira contagens do fim dos nomes (“, 3 tarefas”, “(5)”), junta cliques duplicados e marca como opcionais os passos em avisos. Na reprodução, se não achar um nome, ele tenta uma versão mais curta com um único resultado e pula os passos opcionais que sumiram. Mesmo assim, aponte no resumo:

- **Tentativas que deram erro.** Um clique que gerou mensagem de validação na tela seguinte (“Preencha este campo”) seguido da correção. No `play`, a tentativa pode dar certo e mudar o fluxo. Sugira apagar a tentativa ou gravar de novo.
- **Alvos frágeis.** Seletores CSS com estado (`.Mui-error`, `.active`), posição (`nth-child`, `>> nth=`) ou id gerado (`#mui-123`). Sugira um alvo por texto, papel ou `data-testid` visível na tela.
- **Nomes que mudam com os dados** e que a limpeza automática não cobre: valores, datas relativas (“há 2 minutos”), nomes criados na própria gravação. O que a gravação cria acontece de verdade, e as leituras (GET) do `play` vêm do site real. Com o `i` no fim, o nome casa por trecho, então sugira o alvo sem a parte variável.
- **Dados que aparecem no vídeo** porque a gravação os criou de verdade, como uma tarefa de teste que já aparece na lista antes do passo que a cria.

No fim, mostre uma tabela curta com o número do passo, a legenda antiga e a nova, diga quais passos ficaram sem legenda e por quê, e liste os riscos acima que encontrou.
