# Painel ANPD

Aplicativo de estudo para o concurso de **Especialista em Regulação de Proteção de Dados** da ANPD (Lei nº 15.352/2026), no formato certo/errado do Cebraspe. O cronograma mira o edital até 22/12/2026 e a prova provável em 28/03/2027.

O app publicado fica em <https://claude.ai/artifact/J5WjnHRjrWxyMfa9fL7xpw> e salva o progresso na conta de quem abre, com cópia no navegador e backup em arquivo. O arquivo `dist/index.html` funciona sozinho em qualquer navegador (o progresso fica no próprio navegador).

## O método

A aba **Hoje** monta um roteiro de cinco passos, nesta ordem (a leitura do dia tem no máximo 25 artigos, escolhidos pelos seus erros, pelo que falta ler e pelo que mais cai). O cartão do dia, no topo, mostra o próximo passo pendente com os botões dele, para começar sem rolar a página:

1. **Revisar o que venceu**: a lista curta de questões erradas e os cards vencidos.
2. **Questões do dia**: o bloco do cronograma de 151 dias em seis fases (05/10/2026 a 28/03/2027). Nenhuma sessão recomeça do zero: treino, revisão e simulado (com marcações e tempo) ficam guardados na conta e continuam de onde pararam, inclusive em outro aparelho.
3. **Lei seca grifada**: leitura em sequência dos artigos do dia.
4. **Cards cloze**: lacunas da letra da lei (e dos conceitos de gestão, IA e economia), com revisão espaçada.
5. **Para pesquisar**: um tema ou termo por dia, tirado dos seus erros, em modo **Investigar**: o painel faz perguntas-guia, você escreve a resposta com suas palavras e o Claude confere, corrige pela norma e devolve uma pergunta para ir mais fundo.

A página Mais → Método explica o porquê de cada passo e a estratégia de chute do Cebraspe.

## O que tem

- **5.278 itens.** 4.605 foram escritos para o banco e 673 são itens reais de prova com o gabarito definitivo: 619 do Cebraspe, de dezenas de provas de 2023 a 2026 (as maiores fatias: Anatel 2024, TRF6 2025, Instituto Rio Branco 2026, PF 2025, TCU 2026 e ANAC 2024), com texto de apoio e comando da banca, e 54 de múltipla escolha do processo seletivo da própria ANPD em 2025 (IADES). Outros 85 itens certo/errado foram adaptados dessa prova da ANPD. Por disciplina: LGPD e normas da ANPD 1.544, português e inglês 929, direito administrativo e constitucional 844, regulação 603, gestão pública, riscos, orçamento e dados 417, ECA Digital, plataformas e IA 352, segurança da informação 332, direito comparado 134, economia 123. O gabarito certo/errado está equilibrado (52% certo; nos itens escritos para o banco, 53%, contra 45% nos itens reais), para o treino não ensinar a chutar certo.
- **Trecho literal conferido.** 3.399 itens citam o trecho da norma que decide o gabarito, e o build falha se o trecho não existir no artigo citado. 1.844 itens são de doutrina ou de texto de apoio. 35 citam fontes ainda não anexadas (decisões do STF e do TJUE, Lei 13.303/2016, LGT, E-Ciber, resoluções da Anatel e o Manual de Redação da Presidência) e aparecem com o aviso “confira na fonte”.
- **Treino comentado**: gabarito, comentário, tipo de armadilha, trecho da lei e termos para pesquisar logo depois de cada item. Em Mais → Progresso, **Onde você cai** mostra a taxa de erro por tipo de armadilha e abre treinos de 20 itens só das três que mais derrubam.
- **Itens reais do Cebraspe**: treino com comentário, prova na ordem do caderno e treino por disciplina. A página **Mais → Como o Cebraspe cobra** traz a estrutura e a pontuação do edital da Anatel 2024, o padrão de cobrança de cada disciplina com exemplos, o padrão de resposta da discursiva e as provas recomendadas.
- **Revisão espaçada adaptativa das questões**: a escada base é 0, 1, 3, 7, 16 e 35 dias (o acerto de primeira volta em cerca de 16). A partir do terceiro degrau, o intervalo se ajusta ao item (erros e acertos com dúvida encurtam, acertos seguros alongam) e à pessoa: a retenção medida nas revisões de manutenção dos últimos 30 dias, só as feitas até 1,5 vez o prazo programado, calibra os prazos para mirar 90% de lembrança, com o fator ln(0,9) ÷ ln(retenção medida) da curva de esquecimento (revisões muito atrasadas medem esquecimento a mais e encurtariam tudo à toa). Os acertos antigos vencidos entram na revisão do dia (até 10 por dia, os mais atrasados primeiro) e em até um quarto das sessões; quando a lista curta vencida passa de 40, a sessão de questões novas encolhe. A revisão traz só o que venceu: o que já foi revisto no dia espera o próximo intervalo. Itens de interpretação de texto (português e inglês) não voltam na revisão nem no Refazer erros: no lugar deles vêm textos inéditos, para o treino não virar memória do gabarito.
- **Treino de discursiva**: quinze temas da ANPD no formato do Cebraspe (30 linhas e 20 pontos; 15 linhas e 10 pontos), com contador de linhas, correção por quesitos com conceitos crescentes (com sugestão do Claude) e nota estimada com o desconto de português do edital. Uma discursiva por semana no cronograma.
- **1.052 cards cloze** (824 notas). 695 notas vêm da letra das normas anexadas, conferida no build; 129 são cards de conceito (gestão, riscos, governança, dados, IA, economia e teoria da regulação), marcados “Doutrina”. Agendamento no estilo do Anki (Errei, Difícil, Bom, Fácil), limite diário de cards novos e exportação para o Anki (`dist/anki-lgpd-cloze.txt`).
- **Trilhas do zero** de direito constitucional e administrativo: 26 subtemas com pré-teste, aula expositiva grifada como a lei seca (números por extenso, palavras de alerta, deve × pode, referências a dispositivos e o termo definido em negrito), pontos-chave, armadilhas do Cebraspe e prática até o domínio.
- **Lei seca grifada de 60 textos** em nove grupos: LGPD e normas da ANPD (com o Regimento Interno de 2021, marcado com o aviso de vigência); ECA Digital, internet e plataformas; regulação, agências e carreira; governança e gestão pública (com o Decreto 10.046/2019, de compartilhamento de dados na administração federal); Constituição; direito administrativo; segurança da informação (com o NIST CSF 2.0); direito comparado (GDPR, no texto oficial em inglês, e Convenção 108+); jurisprudência do STF e do STJ (Súmulas 365, 473 e 512 e Súmulas Vinculantes 10 e 13 do STF, com as teses de repercussão geral e os acórdãos que o tribunal liga a elas, e Súmulas 2, 37 e 633 do STJ). Busca em todas as normas, estrelas de importância, ranking dos artigos mais cobrados e camadas de grifo (o que cai, prazos e números, palavras de alerta, deve × pode, seus erros), que também reconhecem o inglês.
- **Glossário de 127 termos**, marcados nas questões e nos cards, e a lista **Para pesquisar**, que recebe sozinha os termos das questões erradas e abre cada tema em modo Investigar.
- **Claude dentro do painel** (no claude.ai, com a permissão de quem estuda e pelo uso da própria conta): confere as respostas do Investigar e corrige a discursiva pelos quesitos, sugerindo o conceito de cada um e os erros de português; a nota final é decisão de quem estuda. Fora do claude.ai, os botões dão lugar a Copiar, que leva o pedido pronto para uma conversa.
- **Simulados Cebraspe**: uma errada anula uma certa, com prova completa de 120 itens na proporção estimada pelo processo seletivo da ANPD de 2025, resultado por disciplina, análise do chute e acerto medido só nos itens que você via pela primeira vez.
- **Relógio de estudo do dia**: conta o tempo com o app aberto e em uso (pausa depois de 3 minutos parado), separado em questões, cards, leitura e discursiva, contra a meta de tempo do plano. O painel mostra o tempo de hoje, itens por hora, tempo por item, acerto, cards e artigos lidos, e os últimos 7 dias; Mais → Progresso traz 14 e 30 dias, metas cumpridas, divisão por atividade e uma tabela dia a dia.
- **Atraso do plano**: perder um dia não deixa matéria sem estudar. Os blocos dos dias sem sessão aparecem depois do roteiro, e o roteiro ganha o passo “Recuperar o atraso”, que fecha um dia por vez (o mais antigo primeiro) com os itens que faltam em cada matéria dele. Nada sai por prazo: o dia dá baixa sozinho quando cada matéria dele recebe, por qualquer caminho, ao menos metade da sua parte dos itens previstos (mínimo 3), ou quando você o dispensa. A leitura atrasada de um dia conta como feita quando você lê tantos artigos dele quanto a leitura do dia pedia (até 25). Dia de revisão perdido não vira atraso (o que venceu segue na lista curta); simulado perdido fica para quando der.
- **Jornada (RPG)**: o herói é você. O nível vem do XP; os atributos (1 a 20) vêm do seu domínio real em cada disciplina; o equipamento sai do saque. Toda semana um chefão encarna o bloco em que você está mais fraco, com 300 de HP. Acertar item desse bloco, em qualquer sessão, causa dano (10, 15 ou 20 pela dificuldade, mais o bônus da arma; crítico em dobro quando o artigo já caiu em prova real ou pela chance do amuleto). Na batalha (Batalhar, 15 itens), a arena mostra o HP do chefão e os corações do herói: cada erro custa um coração, três acertos seguidos devolvem um, e sem corações a batalha acaba (o dano causado fica). Derrotar o chefão dá XP, troféu e um item raro ou melhor. Três missões por dia abrem o baú, que também dá um item. Os 12 itens são princípios e conceitos da LGPD (arma: dano; armadura: corações; amuleto: crítico), cada um com o texto da lei; o repetido vira XP. Ficha, equipamento e inventário em Mais → Personagem. Nada tira XP.
- **O que a sessão rendeu**: o resultado de cada sessão de questões mostra o domínio dos blocos que subiu (antes → depois), os itens que saíram da lista curta, o HP que o chefão perdeu, as missões cumpridas e o nível alcançado. Depois de 150 itens no dia, sugere parar e voltar amanhã.
- **Artigo que já caiu em prova**: quando o item escrito para o banco trata de um artigo citado por itens reais de prova, a resposta avisa quantos são, e o acerto é crítico: 50% a mais de XP e, no chefão, dano em dobro.
- **Sequência com folga e sons**: domingo e um dia por semana, de segunda a sábado, não zeram os dias seguidos. Sons curtos de acerto, erro, combo e marcos, desligados por padrão (botão no topo da sessão).
- **Contestações respondidas pelo banco**: a resposta a cada contestação vem junto com o banco (`dados/contestacoes-respostas.json`) e aparece no item mesmo quando a contestação não conseguiu chegar à conta.
- **Relâmpago 90 s**, XP, níveis, sequência de dias e conquistas. O bônus de sequência de acertos vale só no relâmpago.
- **Ajustes**: metas, tema, backup em arquivo, restauração e diagnóstico da gravação na conta. Preferências e progresso ficam na conta e se mesclam entre aparelhos. O histórico das questões vai em quatro documentos, para nenhum passar do limite de 256 KiB por documento da conta.
- **Backup que não apaga**: restaurar oferece Juntar (soma o backup ao que está no aparelho, registro mais recente de cada item) ou Substituir. Quando a conta não responde, o painel mostra o motivo e, sem backup há três dias ou mais, pede um no topo da tela.

## Estrutura

```
fontes/                 textos oficiais usados para conferir questões e cards (58 textos)
questoes/               banco de questões, em texto simples (reais-*.txt: itens reais do Cebraspe)
questoes/blocos.json    disciplinas e blocos (com os textos que ainda faltam)
cloze/                  notas cloze
glossario/termos.txt    glossário
dados/cronograma.json   cronograma diário até a prova provável (151 dias)
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

Referência, texto com lacunas e dica opcional (a dica aparece no lugar da lacuna). Lacunas sem número viram c1, c2... na ordem; `{{c1::...}}` agrupa lacunas no mesmo card. O texto sem as marcas precisa existir no artigo. A exceção são os cards de conceito, com referência `doutrina <tema>`: não há norma para conferir, e o tema é obrigatório.

## Comandos

```
npm run validar   # confere banco, cards e glossário e mostra o equilíbrio certo/errado por bloco
npm test          # testes do banco e do build
npm run build     # gera dist/index.html, dist/artifact.html e dist/anki-lgpd-cloze.txt
npm run test:navegador   # clica no app num Chromium de verdade (veja abaixo)
```

Validar, testar e gerar o app não exigem dependências externas: só Node 18 ou mais novo.

Os testes de navegador (`scripts/navegador/`) percorrem as telas no celular e no computador, nos dois temas, e conferem a sincronização entre a conta e o navegador (com um banco simulado), a retomada de sessões interrompidas (treino, simulado com marcações e tempo, itens reais, e a troca de aparelho), o Investigar e a correção da discursiva com um Claude simulado, a múltipla escolha, os cards, a calibração da revisão adaptativa e o treino por armadilha. Eles precisam do Playwright, que o projeto não instala: rode `npm install --no-save playwright` uma vez. `CHROMIUM` aponta para um Chromium já instalado, `APP` troca o arquivo testado (para comparar com uma versão antiga) e `FOTOS` escolhe a pasta das capturas de tela.

## Textos que ainda faltam

A lista atualizada fica em `questoes/blocos.json` (campo `faltam`) e aparece no app em Mais → Plano. Cada documento novo vira questões e cards conferidos contra a letra da norma ou contra o gabarito oficial.
