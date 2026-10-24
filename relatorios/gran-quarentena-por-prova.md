# Itens do Gran em quarentena, por prova

**1261 itens** de **338 provas** (328 com link para a prova no Gran) ainda em quarentena. Ficaram fora do banco porque o gabarito veio preenchido por padrão: A em quase toda múltipla escolha e CERTO em quase todo item certo/errado.

## A prova de que o gabarito está errado

- **13 itens do Gran já estão no banco**, copiados de uma prova completa importada de outra fonte. Em **6 deles o gabarito do Gran diverge** do gabarito da prova completa. Esses itens não precisam voltar: o banco já tem a versão certa (coluna `situacao` = "duplicado de …").
- Outros 7 começam igual a um item do banco ("possível duplicado de …"); vale conferir antes de reimportar.
- Na amostra lida à mão, 3 de 6 itens de múltipla escolha e 1 de 10 itens certo/errado tinham gabarito errado com certeza.

## Como usar a planilha

`gran-quarentena-por-prova.csv` tem uma linha por item, já agrupada por prova (as maiores primeiro). Para cada prova: abra o link, confira o gabarito definitivo e preencha a coluna `gabarito_oficial` (C ou E nos itens certo/errado; a letra da alternativa, na ordem da coluna `alternativas`, nos de múltipla escolha; ANULADA quando a banca anulou o item). A coluna `questao_gran` é o número da questão no site. O Excel pode salvar a planilha do jeito dele (separador ponto e vírgula): o script lê os dois formatos.

Depois, uma leva de cada vez:

```sh
python3 scripts/aplicar_gabaritos.py relatorios/gran-quarentena-por-prova.csv "saida/Painel TCU.html"
python3 scripts/lista_gran_por_prova.py "saida/Painel TCU.html" relatorios   # a planilha passa a listar só o que falta
```

O primeiro devolve ao banco os itens conferidos (e para sem gravar nada se algum gabarito estiver fora do formato). Quando o gabarito oficial difere do que veio do Gran, o item volta como inédito: o que você respondeu nele tinha sido corrigido contra o gabarito errado. Tudo o que é aplicado fica registrado em `gabaritos-conferidos.csv`, que devolve os itens depois de um build novo. O segundo refaz a planilha só com o que falta, mantendo o que você já preencheu.

Os 20 itens sem link vieram com só o nome da prova; precisam ser procurados pelo enunciado.

## Por onde começar

As provas são muitas e pequenas: as 20 maiores somam 317 itens (25%), as 50 maiores, 562 (45%).

### O que a quarentena tirou de cada disciplina

| Disciplina | Itens no pacote | Em quarentena | % da disciplina |
|---|---|---|---|
| Contabilidade Pública e Análise de Balanços | 610 | 432 | 71% |
| Administração Financeira e Orçamentária (AFO) | 372 | 196 | 53% |
| Estatística e Matemática Financeira | 235 | 118 | 50% |
| Administração Pública e Governança | 818 | 286 | 35% |
| Economia do Setor Público e da Regulação | 780 | 141 | 18% |
| Controle Externo | 291 | 44 | 15% |
| Direito Constitucional | 449 | 37 | 8% |
| Direito Administrativo e Licitações | 641 | 6 | 1% |
| Auditoria Governamental | 133 | 1 | 1% |

Contabilidade, AFO e Estatística perderam metade ou mais dos itens. As provas com mais itens dessas três disciplinas são as que mais devolvem ao banco.

### As 30 maiores provas

| # | Prova | Itens | C/E · ME | Disciplinas | A conferir |
|---|---|---|---|---|---|
| 1 | [CESPE/CEBRASPE - TCE AC - Auditor de Controle Externo - Área Administração - 2024](https://questoes.grancursosonline.com.br/prova/tce-ac-ac-2024-cespe-cebraspe-auditor-de-controle-externo-area-administracao) | 35 | 35 · 0 | Administração Pública e Governança (29), Administração Financeira e Orçamentária (AFO) (6) | 35 |
| 2 | [CESPE/CEBRASPE - TCE RN - Auditor de Controle Externo - Área: Administração/Gestão de Políticas Públicas/Gestão Pública - 2026](https://questoes.grancursosonline.com.br/prova/tce-rn-rn-2026-cespe-cebraspe-auditor-de-controle-externo-area-administracao-gestao-de-politicas-publicas-gestao-publica) | 33 | 33 · 0 | Administração Pública e Governança (28), Controle Externo (2), Administração Financeira e Orçamentária (AFO) (2) | 33 |
| 3 | [CESPE/CEBRASPE - TCE RN - Auditor de Controle Externo - Área Direito - 2026](https://questoes.grancursosonline.com.br/prova/tce-rn-rn-2026-cespe-cebraspe-auditor-de-controle-externo-area-direito) | 22 | 22 · 0 | Administração Financeira e Orçamentária (AFO) (11), Controle Externo (6), Direito Constitucional (4) | 22 |
| 4 | [CESPE/CEBRASPE - TCE PR - Auditor de Controle Externo - Área Ciências Contábeis - 2024](https://questoes.grancursosonline.com.br/prova/tce-pr-pr-2024-cespe-cebraspe-auditor-de-controle-externo-area-ciencias-contabeis) | 17 | 0 · 17 | Administração Financeira e Orçamentária (AFO) (8), Contabilidade Pública e Análise de Balanços (7), Estatística e Matemática Financeira (2) | 17 |
| 5 | [CESPE/CEBRASPE - CAU - Contador - 2024](https://questoes.grancursosonline.com.br/prova/cau-2024-cespe-cebraspe-contador) | 16 | 16 · 0 | Contabilidade Pública e Análise de Balanços (16) | 16 |
| 6 | [CESPE/CEBRASPE - CNPq - Analista - Área Gestão Orçamentária e Financeira - 2024](https://questoes.grancursosonline.com.br/prova/cnpq-2024-cespe-cebraspe-analista-area-gestao-orcamentaria-e-financeira) | 16 | 16 · 0 | Contabilidade Pública e Análise de Balanços (16) | 16 |
| 7 | [CESPE/CEBRASPE - TCE AC - Auditor de Controle Externo - Área: Contabilidade - 2024](https://questoes.grancursosonline.com.br/prova/tce-ac-ac-2024-cespe-cebraspe-auditor-de-controle-externo-area-contabilidade) | 15 | 15 · 0 | Administração Financeira e Orçamentária (AFO) (6), Estatística e Matemática Financeira (6), Administração Pública e Governança (2) | 15 |
| 8 | [FGV - TCE RR - Auditor de Controle Externo - 2025](https://questoes.grancursosonline.com.br/prova/tce-rr-rr-2025-fgv-auditor-de-controle-externo) | 15 | 0 · 15 | Administração Pública e Governança (13), Controle Externo (1), Estatística e Matemática Financeira (1) | 15 |
| 9 | [CESPE/CEBRASPE - TCE PR - Auditor de Controle Externo - Área Administração - 2024](https://questoes.grancursosonline.com.br/prova/tce-pr-pr-2024-cespe-cebraspe-auditor-de-controle-externo-area-administracao) | 14 | 0 · 14 | Administração Pública e Governança (12), Administração Financeira e Orçamentária (AFO) (2) | 14 |
| 10 | [CESPE/CEBRASPE - TCE RS - Auditor de Controle Externo - Área Ciências Contábeis - 2025](https://questoes.grancursosonline.com.br/prova/tce-rs-rs-2025-cespe-cebraspe-auditor-de-controle-externo-area-ciencias-contabeis) | 14 | 14 · 0 | Contabilidade Pública e Análise de Balanços (8), Administração Financeira e Orçamentária (AFO) (6) | 14 |
| 11 | [CESPE/CEBRASPE - IPAAM - Analista Ambiental - Área: Ciências Contábeis - 2026](https://questoes.grancursosonline.com.br/prova/ipaam-am-2026-cespe-cebraspe-analista-ambiental-area-ciencias-contabeis) | 13 | 0 · 13 | Contabilidade Pública e Análise de Balanços (13) | 13 |
| 12 | [FGV - TCE PA - Auditor de Controle Externo - Área Administrativa - Especialidade: Direito - 2024](https://questoes.grancursosonline.com.br/prova/tce-pa-pa-2024-fgv-auditor-de-controle-externo-area-administrativa-especialidade-direito) | 13 | 0 · 13 | Administração Financeira e Orçamentária (AFO) (7), Contabilidade Pública e Análise de Balanços (4), Controle Externo (1) | 13 |
| 13 | [FGV - TCE PA - Auxiliar de Controle Externo - 2024](https://questoes.grancursosonline.com.br/prova/tce-pa-pa-2024-fgv-auxiliar-de-controle-externo) | 13 | 0 · 13 | Administração Pública e Governança (7), Administração Financeira e Orçamentária (AFO) (2), Estatística e Matemática Financeira (2) | 13 |
| 14 | [FGV - TCE RR - Auditor Substituto de Conselheiro - 2025](https://questoes.grancursosonline.com.br/prova/tce-rr-rr-2025-fgv-auditor-substituto-de-conselheiro) | 13 | 0 · 13 | Administração Pública e Governança (6), Administração Financeira e Orçamentária (AFO) (4), Estatística e Matemática Financeira (3) | 13 |
| 15 | [CESPE/CEBRASPE - TCE AC - Analista Administrativo - Área Administração - 2024](https://questoes.grancursosonline.com.br/prova/tce-ac-ac-2024-cespe-cebraspe-analista-administrativo-area-administracao) | 12 | 12 · 0 | Administração Pública e Governança (12) | 12 |
| 16 | [CESPE/CEBRASPE - TCE PR - Auditor de Controle Externo - Área Direito - 2024](https://questoes.grancursosonline.com.br/prova/tce-pr-pr-2024-cespe-cebraspe-auditor-de-controle-externo-area-direito) | 12 | 0 · 12 | Administração Financeira e Orçamentária (AFO) (7), Direito Constitucional (2), Administração Pública e Governança (2) | 12 |
| 17 | [FGV - TCE PE - Analista de Gestão - Área: Administração - 2025](https://questoes.grancursosonline.com.br/prova/tce-pe-pe-2025-fgv-analista-de-gestao-area-administracao) | 12 | 0 · 12 | Administração Pública e Governança (8), Administração Financeira e Orçamentária (AFO) (4) | 12 |
| 18 | [CESPE/CEBRASPE - SEPLAG AL - Especialista em Gestão Pública - Área: Planejamento - 2026](https://questoes.grancursosonline.com.br/prova/seplag-al-al-2026-cespe-cebraspe-especialista-em-gestao-publica-area-planejamento) | 11 | 11 · 0 | Administração Pública e Governança (11) | 11 |
| 19 | [FGV - TCE GO - Analista de Controle Externo - Área de Controle Externo - 2024](https://questoes.grancursosonline.com.br/prova/tce-go-go-2024-fgv-analista-de-controle-externo-area-de-controle-externo) | 11 | 0 · 11 | Administração Financeira e Orçamentária (AFO) (6), Administração Pública e Governança (5) | 11 |
| 20 | [CESPE/CEBRASPE - CAPES - Analista - Área: Contabilidade - 2024](https://questoes.grancursosonline.com.br/prova/capes-2024-cespe-cebraspe-analista-area-contabilidade) | 10 | 10 · 0 | Contabilidade Pública e Análise de Balanços (10) | 10 |
| 21 | [CESPE/CEBRASPE - EMBRAPA - Analista - Área: Orçamento e Finanças: Contabilidade - 2025](https://questoes.grancursosonline.com.br/prova/embrapa-2025-cespe-cebraspe-analista-area-orcamento-e-financas-contabilidade) | 10 | 10 · 0 | Contabilidade Pública e Análise de Balanços (10) | 10 |
| 22 | [CESPE/CEBRASPE - TCDF - Procurador - 2024](https://questoes.grancursosonline.com.br/prova/tcdf-df-2024-cespe-cebraspe-procurador) | 10 | 10 · 0 | Administração Financeira e Orçamentária (AFO) (8), Direito Constitucional (2) | 10 |
| 23 | [CESPE/CEBRASPE - TCE AC - Auditor de Controle Externo - Área Direito - 2024](https://questoes.grancursosonline.com.br/prova/tce-ac-ac-2024-cespe-cebraspe-auditor-de-controle-externo-area-direito) | 10 | 10 · 0 | Administração Financeira e Orçamentária (AFO) (7), Administração Pública e Governança (3) | 10 |
| 24 | [FGV - Câmara de São Paulo - Consultor Técnico-Legislativo - Área Contador - 2024](https://questoes.grancursosonline.com.br/prova/camara-de-sao-paulo-sp-2024-fgv-consultor-tecnico-legislativo-area-contador) | 10 | 0 · 10 | Contabilidade Pública e Análise de Balanços (5), Estatística e Matemática Financeira (5) | 10 |
| 25 | [FGV - TCE PA - Auditor de Controle Externo - Área: Administrativa - Especialidade: Gestão Governamental - 2024](https://questoes.grancursosonline.com.br/prova/tce-pa-pa-2024-fgv-auditor-de-controle-externo-area-administrativa-especialidade-gestao-governamental) | 10 | 0 · 10 | Administração Financeira e Orçamentária (AFO) (8), Administração Pública e Governança (2) | 10 |
| 26 | [CESPE/CEBRASPE - Prefeitura de Mossoró - Analista - Área: Contabilidade - 2024](https://questoes.grancursosonline.com.br/prova/prefeitura-de-mossoro-rn-2024-cespe-cebraspe-analista-area-contabilidade) | 9 | 9 · 0 | Economia do Setor Público e da Regulação (6), Contabilidade Pública e Análise de Balanços (3) | 9 |
| 27 | [CESPE/CEBRASPE - SEFAZ PR - Agente Fazendário Estadual - Área: Contador - 2026](https://questoes.grancursosonline.com.br/prova/sefaz-pr-pr-2026-cespe-cebraspe-agente-fazendario-estadual-area-contador-2) | 9 | 0 · 9 | Contabilidade Pública e Análise de Balanços (9) | 9 |
| 28 | [CESPE/CEBRASPE - STM - Analista Judiciário - Área Apoio Especializado - Especialidade: Contabilidade - 2025](https://questoes.grancursosonline.com.br/prova/stm-2025-cespe-cebraspe-analista-judiciario-area-apoio-especializado-especialidade-contabilidade) | 9 | 9 · 0 | Contabilidade Pública e Análise de Balanços (6), Economia do Setor Público e da Regulação (3) | 9 |
| 29 | [CESPE/CEBRASPE - TCE AC - Analista Administrativo - Área Direito - 2024](https://questoes.grancursosonline.com.br/prova/tce-ac-ac-2024-cespe-cebraspe-analista-administrativo-area-direito) | 9 | 9 · 0 | Administração Financeira e Orçamentária (AFO) (7), Controle Externo (1), Direito Constitucional (1) | 9 |
| 30 | [FGV - TCE PE - Analista de Gestão - Área Julgamento - 2025](https://questoes.grancursosonline.com.br/prova/tce-pe-pe-2025-fgv-analista-de-gestao-area-julgamento) | 9 | 0 · 9 | Administração Financeira e Orçamentária (AFO) (5), Administração Pública e Governança (4) | 9 |

As outras 308 provas estão na planilha.

## Itens que já estão no banco

| Item do Gran | Gabarito no Gran | Situação | Gabarito da prova completa |
|---|---|---|---|
| `gran-adm-q4361406` | C | duplicado de tcu-aufc-2026-053 | E ⚠ diverge |
| `gran-adm-q4361411` | C | duplicado de tcu-aufc-2026-057 | C |
| `gran-adm-q4361412` | C | duplicado de tcu-aufc-2026-058 | C |
| `gran-dp-q4361388` | C | duplicado de tcu-aufc-2026-038 | C |
| `gran-adm-q4515821` | A | duplicado de tce-sc-fgv-2026-042 | E ⚠ diverge |
| `gran-dp-q4515834` | A | duplicado de tce-sc-fgv-2026-053 | B ⚠ diverge |
| `gran-adm-q4307324` | A | duplicado de tce-mg-2026-073 | A |
| `gran-adm-q4516341` | A | duplicado de tce-sc-fgv-2026-041 | A |
| `gran-dp-q4515753` | A | duplicado de tce-sc-fgv-2026-004 | A |
| `gran-adm-q4515779` | A | duplicado de tce-sc-fgv-2026-090 | C ⚠ diverge |
| `gran-adm-q4515793` | A | duplicado de tce-sc-fgv-2026-098 | A |
| `gran-adm-q4515822` | A | duplicado de tce-sc-fgv-2026-043 | E ⚠ diverge |
| `gran-afo-q4515811` | A | duplicado de tce-sc-fgv-2026-032 | B ⚠ diverge |
