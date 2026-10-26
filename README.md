# Painel ANPD

Aplicativo de estudo para o concurso de **Especialista em Regulação de Proteção de Dados** da ANPD (Lei nº 15.352/2026), no formato certo/errado do Cebraspe. O cronograma mira o edital até 22/12/2026 e a prova provável em 28/03/2027.

O app publicado fica em <https://claude.ai/artifact/J5WjnHRjrWxyMfa9fL7xpw> e salva o progresso na conta de quem abre, com cópia no navegador e backup em arquivo. O arquivo `dist/index.html` funciona sozinho em qualquer navegador (o progresso fica no próprio navegador).

## O que tem

- **Banco certo/errado** com itens escritos no padrão do Cebraspe (`docs/padrao-cebraspe.md`) e itens reais de prova com gabarito definitivo. Item autoral cita a norma e um trecho literal, conferido no build; os números dos itens certos são auditados no `npm test`.
- **Roteiro do dia** (aba Hoje): revisão vencida, pré-teste, lei seca do subtema com tradução em português claro, aula, questões do fácil ao difícil, intercaladas, cards e Investigar. Em dia de revisão ou simulado, questão primeiro e lei onde errou.
- **Trilhas do zero** (LGPD, ECA Digital, regulação, segurança, economia e gestão, constitucional, administrativo), **lei seca grifada**, **cards cloze** com agendamento estilo Anki, **glossário** e lista **Para pesquisar**.
- **Simulados** com a regra do Cebraspe (uma errada anula uma certa), prova completa ponderada, **discursivas** corrigidas por quesitos, **prontidão** medida com itens reais e **onde você cai** por tipo de armadilha.
- **Revisão espaçada adaptativa**, atraso do plano recuperável, relógio de estudo, progresso salvo na conta com backup em arquivo.

Os totais atuais saem no fim do `npm run build`. A página Mais → Método explica cada passo.

## Quando sair o edital

Os pesos, a divisão dos itens entre as disciplinas e a cadência do plano são hipóteses montadas sobre as provas da Anatel e da ANAC de 2024. O plano espera o edital até 22/12/2026. Antes dele, as áreas pequenas não ganham mais itens. Quando ele sair, recalibre nesta ordem:

1. No app, em Mais → Ajustes → Edital e prova: data da prova, itens por disciplina em cada parte, pesos e cortes (ficam no perfil; o padrão `PADRAO_EDITAL` está em `src/js/01-dados.js`). Os blocos de regulação que caem na parte básica estão em `REG_NA_BASICA`, no mesmo arquivo.
   Se a data informada cai antes do fim do plano, o cartão do Plano oferece encaixar: saem as semanas cheias de menor peso ainda não estudadas, o resto é adiantado e a reta final termina no dia da prova (`encaixarPlano` em `src/js/01-dados.js`; o corte fica em `perfil.encaixe`, e "Voltar ao plano original" desfaz). Sem data informada, o mesmo cartão traz o plano B, com prova em 28/02/2027.
2. `dados/cronograma.json`: a data da prova, a parte de cada disciplina nos dias do plano e os dias com `disc` (o teste do banco exige uma discursiva por semana e duas nas seis últimas semanas).
3. `dados/cebraspe.json` (a regra de pontuação) e `dados/discursivas.json` (linhas, pontos e fator de desconto de português).
4. Disciplina fora do edital fica com 0 itens em Ajustes (o simulado de prova completa deixa de sorteá-la) e dos dias do plano; tópico fora do edital sai do banco, como saíram os de telecomunicações. Blocos que entrarem com menos de 40 itens ganham itens antes de ir para o plano.
5. `npm run validar`, `npm test` e `npm run test:navegador` (o `pesos.mjs` confere a nota ponderada).

## Regra até o edital

Nenhuma mecânica de jogo nova (modo, minijogo, moeda, ranking, conquista de volume) até sair o edital. O que entra é conteúdo (itens, aulas, cards, textos de norma) e ajuste guiado pelos dados de uso: tempo real, acerto por disciplina, causas de erro, passos do roteiro que não fecham. Os dados mostraram falta de conteúdo e de constância, não de técnica.

## Auditoria do banco

- Amostras sorteadas de itens autorais conferidos um a um na norma, na tese ou no texto de apoio: 100 de LGPD e regulação e 100 das demais disciplinas (direito, línguas, ECA Digital, segurança, gestão, economia, comparado e contabilidade). Nenhum gabarito errado nos 200; pela regra de três, a taxa de erro do banco autoral fica abaixo de 1,5% com 95% de confiança. Um comentário impreciso foi corrigido (gc-41).
- `scripts/auditar-numeros.mjs` (roda no `npm test`): nos itens certos, todo prazo, quantidade, percentual ou valor do enunciado precisa estar na norma citada ou no texto de apoio. Item conferido à mão (conta da dosimetria, número de caso hipotético) entra em `CONFERIDOS`, com o motivo.
- Na prova, o botão de contestação continua sendo a rede de proteção: item contestado vai para a lista de Minhas contestações.

## Estrutura

```
fontes/                 textos oficiais usados para conferir questões e cards (62 textos)
questoes/               banco de questões, em texto simples (reais-*.txt: itens reais do Cebraspe)
questoes/blocos.json    disciplinas e blocos (com os textos que ainda faltam)
cloze/                  notas cloze
glossario/termos.txt    glossário
glossario/juridiques.txt termos jurídicos explicados embaixo dos artigos (tipo: juridiques)
dados/claro.json        artigos das trilhas em português claro (chave lei:artigo)
dados/cronograma.json   cronograma diário até a prova provável (151 dias)
dados/cebraspe.json     página Como o Cebraspe cobra (cada item citado precisa existir no banco)
dados/discursivas.json  temas de discursiva com quesitos (cada quesito precisa de um conceito por nota)
src/                    app.html, app.css e js/ (o código do app, um arquivo por parte; o build junta na ordem do nome)
scripts/                validador, build e testes
dist/                   app gerado pelo build, fora do git (index.html completo; artifact.html para publicar)
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

Referência, texto com lacunas e dica opcional (a dica aparece no lugar da lacuna). Lacunas sem número viram c1, c2... na ordem; `{{c1::...}}` agrupa lacunas no mesmo card. O texto sem as marcas precisa existir no artigo. A exceção são os cards de conceito, com referência `doutrina <tema>`: não há norma para conferir, e o tema é obrigatório.

## Comandos

```
npm run validar   # confere banco, cards e glossário e mostra o equilíbrio certo/errado por bloco
npm test          # testes do banco e do build
npm run build     # gera dist/index.html e dist/artifact.html (fora do git: rode o build antes de testar ou publicar)
npm run test:navegador   # clica no app num Chromium de verdade (veja abaixo)
```

Validar, testar e gerar o app não exigem dependências externas: só Node 18 ou mais novo.

Os testes de navegador (`scripts/navegador/`) percorrem as telas no celular e no computador, nos dois temas, e conferem a sincronização entre a conta e o navegador (com um banco simulado), a retomada de sessões interrompidas (treino, simulado com marcações e tempo, itens reais, e a troca de aparelho), o Investigar e a correção da discursiva com um Claude simulado, a múltipla escolha, os cards, a calibração da revisão adaptativa e o treino por armadilha. Eles precisam do Playwright, que o projeto não instala: rode `npm install --no-save playwright` uma vez. `CHROMIUM` aponta para um Chromium já instalado, `APP` troca o arquivo testado (para comparar com uma versão antiga) e `FOTOS` escolhe a pasta das capturas de tela.

## Textos que ainda faltam

A lista atualizada fica em `questoes/blocos.json` (campo `faltam`) e aparece no app em Mais → Plano. Cada documento novo vira questões e cards conferidos contra a letra da norma ou contra o gabarito oficial.
