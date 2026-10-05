# Painel ANPD

Aplicativo de estudo para o concurso de **Especialista em Regulação de Proteção de Dados** da ANPD (Lei nº 15.352/2026), no formato certo/errado do Cebraspe.

O app publicado fica em <https://claude.ai/artifact/J5WjnHRjrWxyMfa9fL7xpw> e salva o progresso na conta de quem abre, com cópia no navegador e backup em arquivo. O arquivo `dist/index.html` funciona sozinho em qualquer navegador (o progresso fica no próprio navegador).

## O método

A aba **Hoje** monta um roteiro de cinco passos, nesta ordem (a leitura do dia tem no máximo 25 artigos, escolhidos pelos seus erros, pelo que falta ler e pelo que mais cai):

1. **Revisar o que venceu**: a lista curta de questões erradas e os cards vencidos.
2. **Questões do dia**: o bloco do cronograma de 11 semanas (05/10 a 22/12/2026).
3. **Lei seca grifada**: leitura em sequência dos artigos do dia.
4. **Cards cloze**: lacunas da letra da lei, com revisão espaçada.
5. **Para pesquisar**: um tema ou termo por dia, tirado dos seus erros.

A página Mais → Método explica o porquê de cada passo e a estratégia de chute do Cebraspe.

## O que tem

- **1.249 itens certo/errado.** 1.135 foram escritos para o banco e 114 são itens reais do Cebraspe (Anatel 2024, Conhecimentos Básicos e Específicos do cargo 6), com o gabarito oficial definitivo, o texto de apoio e o comando da banca. Por disciplina: LGPD e normas da ANPD 617, regulação 179, direito administrativo e constitucional 114, ECA Digital e plataformas 94, segurança da informação 73, português e inglês 54, direito comparado 48, gestão pública e dados 40, economia 30. O gabarito está equilibrado (55% certo).
- **Trecho literal conferido.** 1.032 itens citam o trecho da norma que decide o gabarito, e o build falha se o trecho não existir no artigo citado. 192 itens são de doutrina ou de texto de apoio. 25 citam fontes ainda não anexadas (decisões do STF e do TJUE e, nos itens reais, LGT, Lei 8.987/1995, E-Ciber e resoluções da Anatel) e aparecem com o aviso “confira na fonte”.
- **Treino comentado**: gabarito, comentário, tipo de armadilha, trecho da lei e termos para pesquisar logo depois de cada item.
- **Itens reais do Cebraspe**: treino com comentário, prova na ordem do caderno e treino por disciplina. A página **Mais → Como o Cebraspe cobra** traz a estrutura e a pontuação do edital da Anatel 2024, o padrão de cobrança de cada disciplina com exemplos, o padrão de resposta da discursiva e as provas recomendadas.
- **Revisão espaçada das questões**: o item errado volta em 0, 1, 3, 7, 16 e 35 dias; o acerto de primeira volta em 16 dias. Os acertos antigos vencidos entram na revisão do dia (até 10 por dia, os mais atrasados primeiro) e em até um quarto das sessões; quando a lista curta vencida passa de 40, a sessão de questões novas encolhe.
- **Treino de discursiva**: cinco temas da ANPD no formato do Cebraspe (30 linhas e 20 pontos; 15 linhas e 10 pontos), com contador de linhas, correção por quesitos com conceitos crescentes e nota estimada com o desconto de português do edital. Uma discursiva por semana no cronograma.
- **509 cards cloze** (421 notas) de todas as normas anexadas, com agendamento no estilo do Anki (Errei, Difícil, Bom, Fácil), limite diário de cards novos e exportação para o Anki (`dist/anki-lgpd-cloze.txt`).
- **Lei seca grifada de 50 normas** em sete grupos: LGPD e normas da ANPD; ECA Digital, internet e plataformas; regulação, agências e carreira; Constituição; direito administrativo; segurança da informação (com o NIST CSF 2.0); direito comparado (GDPR, no texto oficial em inglês, e Convenção 108+). Busca em todas as normas, estrelas de importância, ranking dos artigos mais cobrados e camadas de grifo (o que cai, prazos e números, palavras de alerta, deve × pode, seus erros), que também reconhecem o inglês.
- **Glossário de 99 termos**, marcados nas questões e nos cards, e a lista **Para pesquisar**, que recebe sozinha os termos das questões erradas.
- **Simulados Cebraspe**: uma errada anula uma certa, com prova completa nos pesos do plano, resultado por disciplina e análise do chute.
- **Relâmpago 90 s**, XP, níveis, sequência de dias e conquistas.
- **Ajustes**: metas, backup em arquivo, restauração e diagnóstico da gravação na conta.

## Estrutura

```
fontes/                 textos oficiais usados para conferir questões e cards (50 normas)
questoes/               banco de questões, em texto simples (reais-*.txt: itens reais do Cebraspe)
questoes/blocos.json    disciplinas e blocos (com os textos que ainda faltam)
cloze/                  notas cloze
glossario/termos.txt    glossário
dados/cronograma.json   cronograma diário das 11 semanas
dados/cebraspe.json     página Como o Cebraspe cobra (cada item citado precisa existir no banco)
dados/discursivas.json  temas de discursiva com quesitos (cada quesito precisa de um conceito por nota)
src/                    app.html, app.css e app.js
scripts/                validador, build e testes
dist/                   app gerado (index.html completo; artifact.html para publicar; arquivo do Anki)
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
pesquisar: Prazos de atendimento ao titular
```

`trecho` pode se repetir e precisa existir literalmente no artigo citado em `ref` sempre que o texto da lei estiver em `fontes/`. Itens reais levam `origem: real` e `prova:` (obrigatório), e podem ter `comando:` (a frase de comando da banca) e `apoio:` (o texto de apoio, ou `@NOME` para usar um `apoio_NOME:` definido no cabeçalho do arquivo). `pesquisar` (opcional, pode repetir) sugere um tema para a lista Para pesquisar. Uma questão pode trocar de bloco com `bloco:` próprio. Tipos de armadilha: `literal`, `rol`, `numero`, `sujeito`, `absoluto`, `extrapolacao`, `excecao`, `conceito`, `revogado`, `caso`, `comparacao`, `interpretacao`.

## Formato de um card cloze

```
bloco: lgpd-17-22
lgpd 17 | Toda {{pessoa natural}} tem assegurada a titularidade de seus dados pessoais | quem é titular
```

Referência, texto com lacunas e dica opcional. Lacunas sem número viram c1, c2... na ordem; `{{c1::...}}` agrupa lacunas no mesmo card. O texto sem as marcas precisa existir no artigo.

## Comandos

```
npm run validar   # confere banco, cards e glossário e mostra o equilíbrio certo/errado por bloco
npm test          # testes do banco e do build
npm run build     # gera dist/index.html, dist/artifact.html e dist/anki-lgpd-cloze.txt
```

Não há dependências externas: só Node 18 ou mais novo.

## Textos que ainda faltam

A lista atualizada fica em `questoes/blocos.json` (campo `faltam`) e aparece no app em Mais → Plano. Cada documento novo vira questões e cards conferidos contra a letra da norma ou contra o gabarito oficial.
