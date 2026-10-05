# Painel ANPD

Aplicativo de estudo por questões para o concurso de **Especialista em Regulação de Proteção de Dados** da ANPD (Lei nº 15.352/2026), no formato certo/errado do Cebraspe.

O app publicado fica em <https://claude.ai/artifact/J5WjnHRjrWxyMfa9fL7xpw> e salva o progresso na conta de quem abre. O arquivo `dist/index.html` funciona sozinho em qualquer navegador (o progresso fica no próprio navegador).

## O que tem

- **394 questões originais**, 286 delas de LGPD cobrindo os arts. 1º a 65, já com a redação da Lei nº 15.352/2026. Cada questão de LGPD cita o trecho literal que decide o gabarito, e o build falha se esse trecho não existir no artigo indicado.
- **Treino comentado**: gabarito, comentário, tipo de armadilha e o trecho da lei logo depois de cada item.
- **Lista curta de erros** (revisão espaçada): o item errado, ou acertado no chute, volta em 0, 1, 3, 7, 16 e 35 dias até ser confirmado. O acerto de primeira não entra em revisão.
- **Simulado Cebraspe**: uma errada anula uma certa, em branco vale zero, com cronômetro. No fim, o app mostra se o chute nos itens marcados com dúvida rendeu ou custou pontos.
- **Relâmpago 90 s**: acerto soma, erro subtrai, vale recorde.
- **Lei seca**: a LGPD inteira, com busca, os trechos que você errou marcados em vermelho e o que o banco cobra em amarelo.
- **Gamificação**: XP com bônus de combo, 13 níveis (de Titular de dados a Diretor(a)-Presidente), sequência de dias (domingo não quebra), meta diária e 18 conquistas.
- **Plano**: o cronograma de 11 semanas (05/10 a 22/12) com botão para começar a sessão de cada dia, peso por disciplina, status dos blocos e a lista de textos que faltam.

## Estrutura

```
fontes/            textos legais usados para conferir as questões (hoje: LGPD compilada)
questoes/          banco de questões, um arquivo por bloco, em texto simples
questoes/blocos.json   disciplinas e blocos (com os textos que ainda faltam)
dados/cronograma.json  cronograma diário das 11 semanas
src/               app.html, app.css e app.js
scripts/           validador, build e testes
dist/              app gerado (index.html completo; artifact.html para publicar)
```

## Formato de uma questão

```
=== lgpd-19-01
gab: E
ref: lgpd 19, II
trecho: fornecida no prazo de até 15 (quinze) dias, contado da data do requerimento do titular
armadilha: numero
dif: 1
enunciado: A confirmação de existência de tratamento ... deve ser fornecida no prazo de até 30 dias ...
comentario: O prazo do inciso II do art. 19 é de até 15 dias ...
```

`trecho` pode se repetir e precisa existir literalmente no artigo citado em `ref` sempre que o texto da lei estiver em `fontes/`. Tipos de armadilha: `literal`, `rol`, `numero`, `sujeito`, `absoluto`, `extrapolacao`, `excecao`, `conceito`, `vetado`, `caso`, `comparacao`, `interpretacao`.

## Comandos

```
npm run validar   # confere o banco e mostra o equilíbrio certo/errado por bloco
npm test          # testes do banco e do build
npm run build     # gera dist/index.html e dist/artifact.html
```

Não há dependências externas: só Node 18 ou mais novo.

## Textos que ainda faltam

Cada um vira um bloco de questões conferidas contra a letra da norma:

- Lei nº 15.352/2026 (texto integral, para a carreira e as mudanças na Lei nº 13.848/2019 e na Lei nº 9.986/2000)
- Lei nº 13.848/2019 e Lei nº 9.784/1999 (textos compilados)
- Resoluções CD/ANPD nº 1/2021, 4/2023, 15/2024, 19/2024, 18/2024, 2/2022 e 32/2026
- Lei nº 15.211/2025 (ECA Digital) e Decretos nº 12.622/2025, 12.880/2026 e 12.881/2026
