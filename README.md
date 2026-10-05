# Painel ANPD

Aplicativo de estudo para o concurso de **Especialista em Regulação de Proteção de Dados** da ANPD (Lei nº 15.352/2026), no formato certo/errado do Cebraspe.

O app publicado fica em <https://claude.ai/artifact/J5WjnHRjrWxyMfa9fL7xpw> e salva o progresso na conta de quem abre, com cópia no navegador e backup em arquivo. O arquivo `dist/index.html` funciona sozinho em qualquer navegador (o progresso fica no próprio navegador).

## O método

A aba **Hoje** monta um roteiro de cinco passos, nesta ordem:

1. **Revisar o que venceu**: a lista curta de questões erradas e os cards vencidos.
2. **Questões do dia**: o bloco do cronograma de 11 semanas (05/10 a 22/12/2026).
3. **Lei seca grifada**: leitura em sequência dos artigos do dia.
4. **Cards cloze**: lacunas da letra da lei, com revisão espaçada.
5. **Para pesquisar**: um tema ou termo por dia, tirado dos seus erros.

A página Mais → Método explica o porquê de cada passo e a estratégia de chute do Cebraspe.

## O que tem

- **749 questões originais.** 414 são de LGPD (arts. 1º a 65, com a redação da Lei nº 15.352/2026) e citam o trecho literal que decide o gabarito; o build falha se o trecho não existir no artigo. As demais cobrem Leis 9.784/1999, 13.848/2019 e 9.986/2000, LINDB, resoluções da ANPD, ECA Digital, Constituição, GDPR, regulação, segurança da informação, economia e estatística, português e inglês. Questões de normas ainda não anexadas ao app aparecem com o aviso “confira na fonte”. O gabarito está equilibrado (55% certo).
- **Treino comentado**: gabarito, comentário, tipo de armadilha, trecho da lei e termos para pesquisar logo depois de cada item.
- **Revisão espaçada das questões**: o item errado volta em 0, 1, 3, 7, 16 e 35 dias; o acerto de primeira volta em 16 dias.
- **233 cards cloze** de LGPD (202 notas), com agendamento no estilo do Anki (Errei, Difícil, Bom, Fácil), limite diário de cards novos e exportação para o Anki (`dist/anki-lgpd-cloze.txt`).
- **Lei seca grifada**: a LGPD inteira, com busca, estrelas de importância, ranking dos artigos mais cobrados e camadas de grifo (o que cai, prazos e números, palavras de alerta, deve × pode, seus erros).
- **Glossário de 99 termos**, marcados nas questões e nos cards, e a lista **Para pesquisar**, que recebe sozinha os termos das questões erradas.
- **Simulados Cebraspe**: uma errada anula uma certa, com prova completa nos pesos do plano, resultado por disciplina e análise do chute.
- **Relâmpago 90 s**, XP, níveis, sequência de dias e conquistas.
- **Ajustes**: metas, backup em arquivo, restauração e diagnóstico da gravação na conta.

## Estrutura

```
fontes/                textos legais usados para conferir as questões (hoje: LGPD compilada)
questoes/              banco de questões, em texto simples
questoes/blocos.json   disciplinas e blocos (com os textos que ainda faltam)
cloze/                 notas cloze da LGPD
glossario/termos.txt   glossário
dados/cronograma.json  cronograma diário das 11 semanas
src/                   app.html, app.css e app.js
scripts/               validador, build e testes
dist/                  app gerado (index.html completo; artifact.html para publicar; arquivo do Anki)
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

`trecho` pode se repetir e precisa existir literalmente no artigo citado em `ref` sempre que o texto da lei estiver em `fontes/`. `pesquisar` (opcional, pode repetir) sugere um tema para a lista Para pesquisar. Uma questão pode trocar de bloco com `bloco:` próprio. Tipos de armadilha: `literal`, `rol`, `numero`, `sujeito`, `absoluto`, `extrapolacao`, `excecao`, `conceito`, `vetado`, `caso`, `comparacao`, `interpretacao`.

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

Cada texto anexado converte as questões provisórias em conferidas e permite cards cloze:

- Lei nº 15.352/2026 (texto integral, para a carreira e as mudanças na Lei nº 13.848/2019 e na Lei nº 9.986/2000)
- Lei nº 13.848/2019, Lei nº 9.986/2000 e Lei nº 9.784/1999 (textos compilados)
- Resoluções CD/ANPD nº 1/2021, 2/2022, 4/2023, 15/2024, 18/2024, 19/2024 e 32/2026
- Lei nº 15.211/2025 (ECA Digital) e Decretos nº 12.622/2025, 12.880/2026 e 12.881/2026
