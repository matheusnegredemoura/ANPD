# Padrão Cebraspe para escrever e explicar itens (recorte ANPD)

Referência para quem escreve itens do banco ou programa o tutor do painel. Base: manual técnico recebido em 24/10/2026,
conferido e recortado para o cargo de Especialista em Regulação de Proteção de Dados (ANPD). Do adendo pensado para o
TCU, ficou só o que cai para a ANPD (seção 8). O que não foi possível conferir está marcado.

## 1. Estrutura e pontuação

- Item é proposição declarativa, julgada certa (C) ou errada (E). Nunca é pergunta.
- Bloco típico: texto-base ou caso → comando de transição ("Com base no texto/na situação hipotética, julgue os itens a
  seguir.") → itens numerados e independentes entre si.
- Projeção para a ANPD (edital ainda não publicado): uma errada anula uma certa (k = 1), como na Anatel 2024. Se o
  edital trouxer outro fator, ele entra em Ajustes → Edital e prova.
- Nota líquida S = C − k·E. Valor esperado de marcar com chance p de acerto: VE = p(1 + k) − k.
  - k = 1: VE > 0 só se p > 0,5. Marcar com p um pouco acima de 0,5 tem VE positivo, mas pequeno e com variância alta.
    O limiar de 0,65 do material recebido é uma escolha de aversão a risco, não uma consequência da conta.
  - k = 0,5: VE > 0 se p > 1/3; o chute puro (p = 0,5) tem VE = +0,25.
  - No painel, a Calibragem do chute (Progresso) mede o p real de quem marca dúvida.

## 2. Estilo do item

- Norma-padrão, vocabulário técnico, períodos compostos com subordinação.
- Ordem indireta frequente: adjunto adverbial ou subordinada no início, sujeito longe do verbo.
- Padrão de caso: "Situação hipotética: [fato com agentes e detalhes]. Assertiva: [conclusão normativa ou técnica]."
- Comando que fixa a fonte: "de acordo com a LGPD", "segundo a jurisprudência do STF", "à luz do Decreto 10.411".
  Quando a letra da lei e a jurisprudência divergem, o comando decide qual vale.

## 3. Como o item errado é construído (um mecanismo por item)

O item errado é quase todo verdadeiro; uma peça muda. Código da armadilha no banco entre parênteses.

1. **Inversão de conceitos vizinhos** (`conceito`, `comparacao`): troca as definições de dois conceitos da mesma família
   (controlador × operador; anonimização × pseudonimização; desconcentração × descentralização; seleção adversa × risco
   moral; DEA × SFA).
2. **Palavra absoluta ou restrição indevida** (`absoluto`, `extrapolacao`, `rol`): sempre, somente, exclusivamente, em
   qualquer hipótese, independe de, onde a norma admite exceção; ou restringe o que ela deixa amplo. Se a norma for
   absoluta, o item com a palavra absoluta é certo (ver 4.3).
3. **Falsa relação de causa** (`causalidade`): duas verdades ligadas por porque, por isso, já que, visto que que não
   existe, ou causa e efeito invertidos.
4. **Regra geral aplicada à exceção** (`excecao`): o caso traz o detalhe que atrai a exceção, e a conclusão aplica a
   regra geral (ou o inverso).
5. **Sujeito, competência ou instância trocados** (`sujeito`): a ação está certa, quem a pratica não.
6. **Erro no fim do período** (`fecho`): os primeiros 80% reproduzem a norma com exatidão; a oração final erra.
7. Também usados no banco: número, prazo ou quórum trocado (`numero`), dispositivo revogado ou alterado (`revogado`).

Não criar erro caricato (absurdo que se percebe sem saber a matéria).

## 4. Como o item certo é disfarçado

1. **Paráfrase**: outra voz verbal, sinônimos técnicos, outra ordem, mesmo sentido. Proibida a cópia literal: o build
   rebaixa para dificuldade 1 o item autoral que copia 60% ou mais do trecho citado (`copiaDoTrecho`), e o `npm test`
   reprova o banco se algum item autoral passar desse limite.
2. **Aplicação a caso**: fato A e consequência C, sem citar a regra B que os liga.
3. **Falso distrator**: palavra absoluta onde a restrição é real (o rol do art. 11 da LGPD é taxativo; a recondução do
   ouvidor é vedada no mandato regular).

## 5. Léxico que inverte o sentido

| Termo | Sentido |
| --- | --- |
| prescindir de / imprescindível | dispensar / indispensável |
| conquanto, posto que | embora, ainda que (concessão) |
| porquanto, dado que, já que | porque, visto que (causa) |
| deverá / poderá | ato vinculado / faculdade |
| defeso / deferido | proibido / concedido |
| ratificar / retificar | confirmar / corrigir |
| ao encontro de / de encontro a | a favor de / contra |

## 6. Por domínio (ANPD)

- **Português**: a banca separa correção gramatical de manutenção de sentido; reescrita correta que muda o sentido
  (vírgula que torna explicativa a oração restritiva) torna errado o item que afirma "mantém a correção e o sentido".
  Coesão (a que termo o pronome se refere), funções do "que" e do "se" (partícula apassivadora × índice de
  indeterminação, com reflexo na concordância), pontuação de adjuntos deslocados.
- **Direito e regulação**: letra da norma combinada com jurisprudência consolidada (súmulas vinculantes, repercussão
  geral); dever × poder; prazos e competências; regra × exceção.
- **Gestão e políticas públicas**: etapas do ciclo (agenda, formulação, decisão, implementação top-down × bottom-up,
  avaliação ex ante, in itinere, ex post); indicadores de insumo, processo, produto, resultado e impacto.
- **Lógica** (só se o edital trouxer raciocínio lógico; a Anatel 2024 não trouxe): negação da condicional
  ¬(P → Q) ≡ P ∧ ¬Q; contrapositiva ¬Q → ¬P; De Morgan.

## 7. Discursiva

- Comando com quesitos numerados e, em geral, a pontuação de cada um.
- Resposta por quesito, na ordem pedida, um parágrafo cada, começando pela resposta direta. Sem introdução genérica.
- Nota: NPD = NC − k_disc × NE / TL (NC = conteúdo pelos quesitos; NE = erros de língua; TL = linhas efetivamente
  escritas; nota negativa vira zero). O fator k_disc e os pontos vêm do edital; o painel usa os de
  `dados/discursivas.json`.

## 8. Do adendo do TCU, o que vale para a ANPD

Entram (com itens no banco):
- **Prescrição da ação punitiva federal** (Lei 9.873/1999, `fontes/lei9873.txt`): 5 anos da prática ou, na infração
  permanente ou continuada, da cessação; 3 anos de paralisação (intercorrente); crime → prazo da lei penal;
  interrupções do art. 2º; execução da multa em 5 anos (art. 1º-A); não se aplica a infração funcional nem a processo
  tributário (art. 5º). Vale para a ANPD como autarquia federal no exercício do poder de polícia.
- **Independência de instâncias**: absolvição criminal só afasta a responsabilidade administrativa se negar o fato ou a
  autoria (Lei 8.112, art. 126).
- **LINDB, art. 28**: responsabilidade pessoal do agente só por dolo ou erro grosseiro (Decreto 9.830/2019).
- **Microeconomia da regulação**: monopólio natural e subaditividade; Ramsey-Boiteux; custo do serviço × preço-teto
  (Averch-Johnson, fator X, fator Q); DEA × SFA e Malmquist; seleção adversa × risco moral e contratos de menu; CAPM
  (beta = risco sistemático) e WACC; hold-up e ativos específicos; mercados de dois lados; captura (Stigler).
- **AIR × ARR** (Lei 13.848 e Decreto 10.411): AIR antes, ARR depois; casos de dispensa e de não obrigatoriedade no
  decreto.
- **Decisão automatizada e explicabilidade**: acurácia alta não afasta viés nem o dever de informar critérios (LGPD,
  art. 20, §§ 1º e 2º).

Ficam fora (não caem para o cargo): auditoria de obras, BDI, sobrepreço × superfaturamento, tomada de contas especial,
NAT/ISSAI, contabilidade de hedge, NBC TSP além do básico de contabilidade pública, amostragem MUS, regime de
precatórios, emendas de transferência especial.

Não conferido (não usar em item sem fonte): "receitas das agências sujeitas a contingenciamento" como regra da Lei
13.848; o número do acórdão do TCU citado para a business judgment rule.

## 9. Correções ao material recebido

- Ativo biológico é tratado na NBC TSP 26; a NBC TSP 23 trata de políticas contábeis, mudança de estimativa e
  retificação de erro (numeração do CFC; conferir antes de usar em item).
- O programa Mover e a tributação das compras internacionais de pequeno valor são da Lei 14.902/2024, e não da
  14.900/2024, como diz a crítica que acompanhou o manual.
- O limiar de 0,65 para marcar (seção 1) é preferência de risco, não resultado matemático.

## 10. Protocolo para quem escreve ou explica itens

Ao escrever:
1. Proposição declarativa, nunca pergunta.
2. Errado: o resto do item verdadeiro e um único mecanismo da seção 3, anotado em `armadilha`.
3. Certo: paráfrase ou caso (seção 4); nada de copiar o trecho.
4. Toda afirmação normativa conferida no texto anexado em `fontes/`; `trecho` literal do artigo citado; número do
   enunciado presente na norma (o `npm test` confere).
5. Dificuldade: 1 = paráfrase direta ou troca simples (número, sujeito, conceito) em item curto; 2 = caso simples ou
   erro camuflado; 3 = caso em que um detalhe decide, dois dispositivos combinados ou falso distrator. Situação
   hipotética nunca é 1. Em cada nível, certos e errados perto de metade cada.
6. Palavra absoluta só onde a banca a usa: no errado, perto de 10% dos itens; no certo, como falso distrator.
   `node scripts/reescrita/medir.mjs` compara esses sinais do banco com os itens reais.
7. O tamanho não entrega o gabarito: o errado também é longo (parte verdadeira do mesmo artigo e um único erro, ou
   caso), e a situação hipotética é certa ou errada perto de metade cada. O `npm test` falha se, em algum quarto do
   banco por tamanho ou nos casos, os certos saírem da faixa de 38% a 62%.

Ao explicar (tutor):
1. Núcleo conceitual exigido.
2. A palavra, conectivo, sujeito ou prazo que decide o item.
3. O mecanismo da armadilha, para o estudante reconhecer o padrão na próxima vez.
