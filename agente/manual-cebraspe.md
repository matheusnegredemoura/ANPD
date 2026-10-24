# Manual técnico: itens e discursivas no padrão Cebraspe (TCU e agências reguladoras)

Base de conhecimento para um agente de IA que cria, analisa ou explica itens no padrão Cebraspe. Conferido em
24/10/2026 contra o texto legal (ver `verificacao-do-manual.md`). Marcações:

- **[divergente]** jurisprudência sem posição estável: não gere item CERTO/ERRADO sobre o ponto; ao explicar, apresente
  as duas posições.
- **[conferir]** afirmação plausível que não foi confirmada na fonte primária: não cite número de norma ou acórdão e
  não use como gabarito sem conferir.

## 0. Regras de uso para o agente

1. Gabarito só sai de fonte que você consegue citar: dispositivo legal, súmula, enunciado de acórdão ou texto-base.
   Sem fonte, não há item.
2. Nunca invente número de lei, artigo, acórdão ou norma contábil. Se não tiver certeza do número, descreva a regra
   sem o número.
3. Leia o dispositivo inteiro (caput, parágrafos, incisos, ressalvas) antes de construir o item. A maior parte dos
   itens ERRADOS do Cebraspe mora na exceção que o leitor apressado não leu.

## 1. Estrutura da prova e pontuação

**Bloco de itens.** Texto-base (excerto, notícia, caso administrativo, descrição técnica) + comando de transição
("Acerca das ideias e das estruturas linguísticas do texto precedente, julgue os itens a seguir."; "Tendo como
referência a situação hipotética apresentada, julgue os próximos itens.") + itens numerados. Item é sempre proposição
declarativa; nunca pergunta.

**Escore líquido.** `S = C − k·E`, em branco vale 0. No modelo clássico, `k = 1` (uma errada anula uma certa); há
editais com `k = 0,5` (duas erradas anulam uma certa). O edital decide.

**Valor esperado de marcar** um item com probabilidade subjetiva de acerto `p`: `VE = p − k(1 − p) = p(1 + k) − k`.

- `k = 1`: `VE > 0 ⇔ p > 0,5`. O chute puro (`p = 0,5`) tem valor esperado zero e só acrescenta risco. Recomendar
  margem (por exemplo, marcar só com `p ≥ 0,6`) é proteção contra excesso de confiança, não exigência da matemática.
- `k = 0,5`: `VE > 0 ⇔ p > 1/3`; o chute puro vale `+0,25` por item, e deixar em branco é subótimo.
- Múltipla escolha do Cebraspe: o edital diz se erro desconta. Não presuma.

## 2. Redação do item

- Norma-padrão, períodos longos com subordinação, vocabulário técnico.
- Ordem indireta: adjuntos e orações deslocados para o início, separando sujeito e verbo, para testar leitura
  estrutural.
- Caso prático: *"[Situação hipotética: …] Nessa situação, [conclusão normativa ou técnica]."* O gabarito depende
  de um detalhe do caso que puxa a regra ou a exceção.

## 3. Como o Cebraspe constrói o item

### 3.1. Itens ERRADOS: o erro é cirúrgico, dentro de uma proposição quase toda verdadeira

| Mecanismo | O que muda | Exemplo |
| --- | --- | --- |
| Inversão de conceitos vizinhos | Troca a definição de dois conceitos simétricos | Desconcentração (órgãos na mesma pessoa jurídica) × descentralização (outra pessoa jurídica); eficácia × eficiência |
| Quantificador absoluto ou restritivo | "Em regra", "pode" viram "sempre", "exclusivamente", "independe de", "é vedado" | Se a própria norma é absoluta, o termo absoluto deixa o item CERTO |
| Causalidade corrompida | Dois fatos verdadeiros ligados por conectivo que inverte causa e efeito, ou cria causa onde há concessão | "A ocorre porque B", quando B decorre de A |
| Regra × exceção | Caso que cai na exceção recebe a conclusão da regra geral (ou o inverso) | Detalhe no enunciado que atrai a ressalva legal |
| Sujeito, competência ou instância trocados | A ação está certa, o titular não | Atribuir ao TCU a sustação de **contrato**, que cabe ao Congresso (CF, art. 71, § 1º) |
| Cauda venenosa | 80% do período reproduz a norma; a oração final erra | "O mandado de segurança protege direito líquido e certo, desde que esgotada a via administrativa" — ERRADO: não se exige esgotamento. Atenção à ressalva real: não cabe contra ato de que caiba recurso administrativo com efeito suspensivo, independentemente de caução (Lei 12.016/2009, art. 5º, I) |

### 3.2. Itens CERTOS: verdade disfarçada

1. Paráfrase: troca de voz verbal, nominalização, sinônimos cultos, com equivalência estrita de sentido.
2. Aplicação dedutiva: dá o fato e a consequência, e cobra a regra intermediária que os liga.
3. Falso distrator: "exclusivamente", "apenas", "sempre" onde a restrição é realmente absoluta na norma.

## 4. Léxico que inverte o valor de verdade

- **Prescindir de** = dispensar ("prescinde de homologação" = não precisa). **Imprescindível** = indispensável.
- **Conquanto, posto que** (sentido tradicional) = concessivas (embora). **Porquanto, já que, dado que, visto que** =
  causais/explicativas.
- **Deverá** (vinculado) × **poderá** (discricionário).
- **Defeso** = proibido. **Deferido** = concedido. **Ratificar** = confirmar. **Retificar** = corrigir.
- **Ao encontro de** = a favor. **De encontro a** = contra.

## 5. Por disciplina

**Língua Portuguesa.** Reescrita: o Cebraspe separa correção gramatical de manutenção do sentido; se o comando
afirma que a reescrita preserva os dois e um deles falha, o item é ERRADO (vírgula que transforma restritiva em
explicativa é o caso clássico). Referência (a que termo retoma "cujo", "o qual", "isso", "lhe", "sua"). "Que"
relativo × integrante; "se" apassivador × índice de indeterminação, com reflexo na concordância ("Vendem-se casas" ×
"Trata-se de casos").

**Direito, Administração e Controle.** O comando diz a fonte ("de acordo com o texto expresso da CF…" × "segundo a
jurisprudência do STF…"); sem indicação, a cobrança mistura letra da lei e jurisprudência consolidada. Políticas
públicas: agenda, formulação, decisão, implementação (*top-down* × *bottom-up*), avaliação *ex ante*, *in itinere* e
*ex post*; indicadores de insumo, processo, produto, resultado e impacto.

**Raciocínio lógico.** Condicional `P → Q`: equivale a `¬Q → ¬P` e a `¬P ∨ Q`; sua negação é `P ∧ ¬Q` (o Cebraspe
tenta induzir "se não P, então não Q"). De Morgan: `¬(P ∧ Q) ≡ ¬P ∨ ¬Q`; `¬(P ∨ Q) ≡ ¬P ∧ ¬Q`.

## 6. Prova discursiva

- Comando com texto motivador e quesitos numerados ("aborde, necessariamente, os seguintes aspectos"), às vezes com
  a pontuação de cada um.
- Resposta técnica direta: um parágrafo por quesito, na ordem do comando, abrindo com a resposta. Sem introdução
  genérica nem fecho filosófico.
- Nota: `NPD = NC − f · NE / TL`, em que NC é a nota de conteúdo, NE o número de erros de microestrutura, TL o total de
  linhas efetivamente escritas e `f` o fator **do edital** (materiais de editais recentes citam 1, 2, 3 e 6, e 7 para a
  peça técnica do TCDF). Nota negativa vira zero. Como TL está no denominador, cada erro pesa menos num texto mais longo
  dentro do limite.

## 7. Protocolo do agente

```markdown
### Ao gerar item inédito
- Proposição declarativa, nunca pergunta.
- Gabarito ERRADO: a proposição é verdadeira exceto num ponto, inserido por um único mecanismo da seção 3.1.
  Nada de erro caricato.
- Gabarito CERTO: nada de cópia literal; use paráfrase, inversão de ordem ou aplicação a uma situação hipotética.
- Registre junto do item: fonte exata (dispositivo, súmula ou acórdão) e o mecanismo usado.
- Não gere item sobre ponto marcado [divergente] ou [conferir].

### Ao explicar gabarito ou atuar como tutor
- Diga o núcleo conceitual cobrado.
- Aponte o operador linguístico, lógico ou normativo que valida ou invalida o item.
- Nomeie o mecanismo da banca, para a pessoa reconhecer o padrão na próxima prova.
- Cite a fonte. Sem fonte segura, diga que não tem certeza.
```

---

# Adendo: TCU e agências reguladoras

## A1. Auditoria governamental (NAT e ISSAI)

- Fontes: Normas de Auditoria do TCU (NAT); ISSAI 100 (princípios), 200 (financeira), 300 (operacional), 400
  (conformidade).
- Atributos do achado: situação encontrada (condição), critério, evidência, causa e efeito.
- Armadilhas: (1) exigir dano financeiro quantificado para haver achado — o efeito pode ser qualitativo ou potencial;
  (2) restringir a auditoria operacional à legalidade — os critérios podem vir de boas práticas, literatura e
  indicadores (economicidade, eficiência, eficácia, efetividade); (3) trocar **suficiência** (quantidade de evidência)
  por **adequação** (qualidade: relevância e confiabilidade). Achados positivos (boas práticas) [conferir na NAT].

## A2. Processo de controle externo

**Ônus da prova.** Quem utiliza recursos públicos deve demonstrar a boa e regular aplicação (CF, art. 70, parágrafo
único; DL 200/1967, art. 93: "Quem quer que utilize dinheiros públicos terá de justificar seu bom e regular emprego").
Armadilha: dizer que cabe à equipe do TCU provar o desvio quando falta comprovação da despesa.

**Prescrição no TCU (Res. TCU 344/2022, que aplica a Lei 9.873/1999 na forma da ADI 5509).**

- Não se aplica aos processos de registro de admissão, aposentadoria, reforma e pensão (art. 1º).
- 5 anos para as pretensões punitiva e de ressarcimento (art. 2º), contados (art. 4º): I da data em que as contas
  deveriam ter sido prestadas (omissão); II da apresentação da prestação de contas; III do recebimento da denúncia ou
  representação; IV do conhecimento da irregularidade em fiscalização; V da cessação da irregularidade permanente ou
  continuada.
- Interrompem a principal (art. 5º): notificação, oitiva, citação ou audiência (inclusive por edital); ato inequívoco
  de apuração do fato; ato inequívoco de tentativa de solução conciliatória; decisão condenatória recorrível. Não
  interrompem: vista, certidão, prestação de informações, juntada de procuração e atos que não sejam apuração (§ 3º,
  Res. 367/2024). Pode interromper mais de uma vez; o prazo recomeça do ato interruptivo.
- Intercorrente (art. 8º): processo paralisado por **mais de 3 anos**, pendente de julgamento ou despacho. Interrompe-se
  por qualquer ato que evidencie o **andamento regular** do processo, com as mesmas exclusões (vista, certidões etc.).
  Começa a correr no primeiro marco interruptivo da principal (§ 3º, Res. 367/2024).
- Agências reguladoras e demais órgãos federais: Lei 9.873/1999 (5 anos para a ação punitiva; intercorrente de 3 anos).

**Sanções da LOTCU.** Inidoneidade do licitante fraudador para licitar na Administração Pública Federal por até 5
anos (Lei 8.443/1992, art. 46). Decisão do TCU que imputa débito ou multa tem eficácia de título executivo (CF, art.
71, § 3º).

**Sustação.** Ato: o TCU susta se não atendido (CF, art. 71, X). Contrato: o Congresso susta; se o Congresso ou o
Executivo não agirem em 90 dias, o TCU decide (art. 71, §§ 1º e 2º).

**Desconsideração da personalidade jurídica.** Aplicação do art. 50 do Código Civil, com o rito dos arts. 133 a 137
do CPC aplicado subsidiariamente, com citação e contraditório dos sócios ou administradores alcançados [conferir o
dispositivo do RITCU que manda aplicar o CPC]. O art. 46 da LOTCU não é fundamento da desconsideração.

## A3. Responsabilização

- **LINDB, art. 28:** o agente público responde por decisões ou opiniões técnicas em caso de dolo ou erro grosseiro.
  **Decreto 9.830/2019, art. 12:** erro grosseiro é o "manifesto, evidente e inescusável praticado com culpa grave",
  com elevado grau de negligência, imprudência ou imperícia (§ 1º); o mero nexo causal não basta (§ 3º); a
  complexidade da matéria é considerada (§ 4º); **o valor do dano, ainda que expressivo, não caracteriza por si só o
  erro grosseiro (§ 5º)**; a responsabilidade pela opinião técnica não se estende automaticamente a quem decidiu com
  base nela (§ 6º).
- **Art. 28 da LINDB e imputação de débito [divergente]:** o entendimento tradicional do TCU exigia erro grosseiro só
  para sanção, bastando culpa comum para o ressarcimento; decisões de 2025 estendem o art. 28 ao débito, sem
  jurisprudência estável.
- **Independência de instâncias:** a absolvição penal só vincula se reconhecer a inexistência do fato ou negar a
  autoria; absolvição por falta de prova não impede a responsabilização no TCU.
- **Improbidade (Lei 8.429/1992 após a Lei 14.230/2021):** só condutas dolosas (art. 1º, § 1º); dolo é "a vontade livre
  e consciente de alcançar o resultado ilícito", não bastando a voluntariedade (§ 2º). A jurisdição de contas do TCU
  (CF, art. 71, II) é autônoma em relação à ação de improbidade.
- **Leniência (Lei 12.846/2013):** o acordo não exime a pessoa jurídica de reparar integralmente o dano (art. 16, § 3º);
  o TCU mantém competência para apurar o dano. Compensação do que já foi pago e cooperação entre CGU, AGU e TCU
  [conferir os termos do acordo de cooperação].

## A4. Obras, licitações (Lei 14.133/2021) e desestatização

- **Sobrepreço** (art. 6º, LVI): preço orçado ou contratado expressivamente superior aos referenciais de mercado (item
  unitário ou valor global). **Superfaturamento** (art. 6º, LVII): dano ao patrimônio da Administração, por exemplo
  medição acima do executado, deficiência de execução que reduza qualidade ou vida útil, alterações e reajustes
  irregulares.
- **BDI:** `BDI = [(1 + AC + S + R + G)(1 + DF)(1 + L) / (1 − I)] − 1` (Acórdão 2.622/2013-TCU-Plenário). IRPJ e CSLL não
  entram no BDI (Súmula TCU 254); administração local, canteiro e mobilização vão nos custos diretos.
- **Curva ABC:** a faixa A concentra a maior parte do custo em poucos itens e orienta a amostra de auditoria.
- **Segregação de funções** (art. 7º, § 1º): vedada a designação do mesmo agente para atuação simultânea em funções
  mais suscetíveis a riscos.
- **Orçamento sigiloso** (art. 24): o sigilo não vale para os controles interno e externo (inciso I); **no julgamento
  por maior desconto, o preço estimado ou máximo consta do edital (parágrafo único)**.
- **Desestatizações:** fiscalização prévia e concomitante dos estudos e das minutas antes do leilão (IN-TCU 81/2018).

## A5. Regulação

- **AIR × ARR.** AIR é prévia à edição, alteração ou revogação de atos normativos de interesse geral (Lei 13.848/2019,
  art. 6º; Decreto 10.411/2020, art. 3º) e compara alternativas, inclusive não regular. Não se aplica a atos
  (Decreto 10.411, art. 3º, § 2º): de natureza administrativa com efeitos internos; de efeitos concretos com
  destinatários individualizados; de execução orçamentária e financeira; estritamente de política cambial e monetária;
  de segurança nacional; de consolidação sem alteração de mérito. ARR é a verificação posterior dos efeitos (art. 13).
- **Captura:** econômica (Stigler: a indústria obtém regulação que a protege) × cognitiva (alinhamento de visão do
  regulador, assimetria de informação, porta giratória). Receitas das agências sujeitas a contingenciamento
  [conferir].
- **Monopólio natural:** subaditividade de custos; custo médio decrescente e acima do custo marginal no trecho
  relevante; `P = CMg` gera prejuízo sem subsídio; segunda melhor solução com Ramsey-Boiteux, `P = CMe` ou tarifa em
  duas partes.
- **Custo do serviço × preço-teto:** custo do serviço tem baixo incentivo à eficiência, risco no consumidor e efeito
  Averch-Johnson (superinvestimento); preço-teto (`IPC − X ± Q`) tem alto incentivo, risco na firma e pode reduzir
  qualidade e investimento (daí o fator Q).
- **DEA × SFA:** DEA é não paramétrica (programação linear) e não separa ruído de ineficiência; SFA é paramétrica e
  separa erro aleatório de ineficiência. Malmquist = emparelhamento (*catch-up*) × deslocamento da fronteira.
- **Assimetria de informação:** seleção adversa (*ex ante*, característica oculta; contratos de menu induzem
  autosseleção) × risco moral (*ex post*, ação oculta).
- **Custo de capital:** CAPM `Re = Rf + β(Rm − Rf)` (+ risco-país quando adotado); β mede risco sistemático.
- **Contratos:** *hold-up* por ativos específicos; risco alocado na matriz de riscos não dá direito a reequilíbrio
  se se materializar para a parte que o assumiu.
- **Mercados de dois lados:** preço zero de um lado não é, por si, predação. **Separação vertical** reduz incentivo à
  discriminação, mas eleva custos de coordenação. **Leilões abertos de várias rodadas** facilitam sinalização entre
  licitantes mais que o envelope fechado.
- **Contabilidade regulatória:** base de remuneração sob critério de prudência (ativo ocioso é glosado); Parcela A
  (custos não gerenciáveis, repassados) × Parcela B (gerenciáveis, sujeitos ao fator X); FAC (custos históricos
  rateados) × LRIC (custo incremental de longo prazo de firma eficiente).

## A6. AFO, Direito Financeiro e Contabilidade Pública

- **Fato permutativo:** compra de imobilizado é despesa de capital no orçamento, mas permuta no patrimônio (caixa por
  imobilizado); a VPD vem com a depreciação.
- **Restos a pagar:** processados = empenhados e liquidados; não processados = só empenhados.
- **ARO** (LRF, art. 38): só a partir do 10º dia do exercício; liquidada até 10 de dezembro; proibida enquanto houver
  ARO anterior não resgatada e no último ano de mandato do chefe do Executivo. Não é receita orçamentária (Lei 4.320,
  art. 3º, parágrafo único).
- **Dívida ativa** (Lei 4.320, art. 39, § 2º): tributária e **não tributária** (multas não tributárias, indenizações,
  alcances, contratos etc.).
- **Despesa com pessoal** (LRF, arts. 18 a 23): soma do mês com os 11 anteriores, por competência (art. 18, § 2º).
  Exclusões (art. 19, § 1º): indenização por demissão; incentivo à demissão voluntária; convocação extraordinária do
  Congresso (art. 57, § 6º, II, CF); decisão judicial de competência anterior ao período de apuração; pessoal do DF,
  Amapá e Roraima custeado pela União; inativos e pensionistas quanto à parcela custeada por (a) contribuições dos
  segurados, (b) compensação financeira entre regimes e (c) transferências para equilíbrio atuarial. **É vedado deduzir
  o aporte para cobertura de déficit financeiro do RPPS (art. 19, § 3º).** Alerta do Tribunal de Contas acima de 90% do
  limite (art. 59, § 1º, II); vedações no limite prudencial de 95% (art. 22, parágrafo único); excesso eliminado nos dois
  quadrimestres seguintes, pelo menos um terço no primeiro (art. 23).
- **Regra de ouro** (CF, art. 167, III): vedadas operações de crédito acima das despesas de capital, ressalvadas as
  autorizadas por créditos suplementares ou especiais com finalidade precisa, aprovados por maioria absoluta.
- **Renúncia de receita** (LRF, art. 14): estimativa de impacto no exercício e nos dois seguintes, mais demonstração de
  que não afeta as metas ou medida de compensação.
- **Regime fiscal sustentável (LC 200/2023):**
  - Despesa primária cresce em termos reais 70% da variação real da receita (meta cumprida) ou 50% (meta descumprida)
    (art. 5º, I e II), nunca abaixo de 0,6% nem acima de 2,5% ao ano (art. 5º, § 1º).
  - Meta descumprida (resultado abaixo do limite inferior da banda): aplicam-se de imediato as vedações dos incisos II,
    III e VI a X do art. 167-A da CF; no segundo ano consecutivo, as dos incisos I a X (art. 6º, caput e § 1º).
  - Despesa obrigatória acima de 95% da primária: vedações dos incisos I a IX do art. 167-A (art. 8º).
  - Investimentos na LOA: no mínimo 0,6% do PIB (art. 10).
  - O art. 167-A da CF, em si, é o mecanismo facultativo de Estados, DF e Municípios (despesa corrente acima de 95% da
    receita corrente); a LC 200 usa a lista de vedações dele para a União.
- **Precatórios** (CF, art. 100): requisições de pequeno valor ficam **fora** do regime de precatórios (§ 3º).
  Preferências dentro do regime: superpreferência dos créditos alimentares de quem tem 60 anos ou mais, doença grave ou
  deficiência, até o triplo da RPV (§ 2º); depois os alimentares (§ 1º); depois os demais, em ordem cronológica.
- **Transferências especiais** (CF, art. 166-A): repasse direto ao ente, sem convênio; os recursos pertencem ao ente no
  ato da transferência (§ 2º, II); vedado pagar pessoal e serviço da dívida (§ 1º). Alcance da fiscalização do TCU e da
  CGU após decisões do STF [conferir].
- **NBC TSP:** 03 (provisões: provável → reconhece; possível → nota explicativa; remota → nada); 05 (concessão no
  **concedente**, que reconhece o ativo de concessão; a ICPC 01 é da concessionária); 07 (imobilizado, depreciação por
  componentes); **26 (ativo biológico: valor justo menos despesas de venda)**; 34 (custos no setor público).
- **Hedge de fluxo de caixa** (CPC 48): parcela eficaz em outros resultados abrangentes (PL); ineficaz no resultado.
- **Custeio:** UEP mede esforço de transformação (exclui matéria-prima); TDABC usa custo por unidade de tempo e
  equações de tempo, e evidencia a capacidade ociosa.

## A7. Dados, TI e auditoria algorítmica

- `INNER JOIN` = interseção; `LEFT JOIN` preserva a tabela da esquerda (com `NULL` sem correspondência). Grafos servem
  para redes de laranjas e conluio (centralidade de grau, intermediação, proximidade).
- Teorema CAP: com partição de rede, escolhe-se consistência ou disponibilidade; sistemas AP têm consistência eventual.
- Supervisionado (classificação, regressão) × não supervisionado (agrupamento, regras de associação). Sobreajuste:
  acerto alto no treino e erro alto no teste.
- Regras de associação: suporte `P(A ∩ B)`; confiança `P(B | A)`; *lift* `P(A ∩ B) / (P(A)·P(B))` (> 1 associação
  positiva; = 1 independência; < 1 associação negativa).
- TF-IDF: peso cresce com a frequência no documento e cai quando o termo aparece em quase todos os documentos.
- Mineração de processos: descoberta (modelo a partir do log) × conformidade (log contra o modelo normativo).
- Amostragem por unidade monetária: boa para superavaliação; fraca para subavaliação, passivos omitidos e saldos
  zerados.
- Hash (SHA-256): saída de tamanho fixo, unidirecional, efeito avalanche. *Zero trust*: sem confiança implícita no
  perímetro. Acurácia alta não afasta viés nem o dever de motivar o ato; decisão sancionadora não se apoia só em
  modelo opaco.

## A8. Discursiva técnica (TCU e agências)

- Um parágrafo por quesito, na ordem do comando, sem introdução genérica.
- **Caso de auditoria (TCU):** achado e critério violado (dispositivo exato); conduta e nexo causal, com o art. 28 da
  LINDB; encaminhamento cabível na competência do TCU (conversão em TCE, citação para defesa ou recolhimento do débito,
  audiência para razões de justificativa, determinação, recomendação, assinatura de prazo, medida cautelar quando
  presentes *fumus boni iuris* e *periculum in mora*, sem *periculum in mora* reverso).
- **Caso regulatório:** diagnóstico da falha de mercado ou da infração contratual; enquadramento (Lei 13.848/2019, Lei
  8.987/1995, Lei 11.079/2004); devido processo sancionador, proporcionalidade, modicidade tarifária e continuidade do
  serviço.
