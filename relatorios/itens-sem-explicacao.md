# Itens sem explicação — Painel TCU

Gerado a partir do pacote do Painel TCU. Fora da conta: os 1261 itens do Gran em quarentena.

**1359 de 5262 itens (26%)** não explicam o gabarito: 537 têm o comentário vazio (o texto de apoio só repete o gabarito) e 822 têm um comentário genérico ("Item julgado CERTO pela banca…", "Gabarito oficial…"). 1111 deles são itens reais de prova.

A lista completa, com enunciado, alternativas e gabarito, está em `itens-sem-explicacao.csv`, já na ordem de trabalho: disciplina de maior peso (`prio` do painel), depois bloco de prioridade 1, depois itens reais.

Os itens que você errou não entram nesta ordem porque o seu histórico fica no navegador, não no pacote. Para começar por eles, cruze esta lista com o Caderno de Erros.

## Por disciplina

| Disciplina | Peso (`prio`) | Itens | Sem explicação | % |
|---|---|---|---|---|
| Análise de Dados, IA e LGPD/LAI | 0.15 | 902 | 113 | 13% |
| Auditoria Governamental | 0.11 | 132 | 88 | 67% |
| Controle Externo | 0.10 | 247 | 155 | 63% |
| Estatística e Matemática Financeira | 0.10 | 117 | 84 | 72% |
| Português, Inglês e Raciocínio Analítico | 0.09 | 1186 | 244 | 21% |
| Administração Financeira e Orçamentária (AFO) | 0.08 | 176 | 103 | 59% |
| Contabilidade Pública e Análise de Balanços | 0.08 | 178 | 108 | 61% |
| Direito Administrativo e Licitações | 0.08 | 635 | 156 | 25% |
| Direito Constitucional | 0.07 | 412 | 105 | 25% |
| Anticorrupção, LINDB, Civil e Processo Civil | 0.05 | 106 | 48 | 45% |
| Administração Pública e Governança | 0.05 | 532 | 125 | 23% |
| Economia do Setor Público e da Regulação | 0.04 | 639 | 30 | 5% |

## Por bloco, na ordem de trabalho

| Disciplina | Bloco | Prioridade | Itens | Sem explicação | Reais sem explicação |
|---|---|---|---|---|---|
| Análise de Dados, IA e LGPD/LAI | Mineração de Dados, CRISP-DM, BI, DW e ETL (`dados-bi`) | 1 | 77 | 28 | 28 |
| Análise de Dados, IA e LGPD/LAI | Bancos de Dados Relacionais, Normalização e SQL (`dados-sql`) | 1 | 42 | 31 | 21 |
| Análise de Dados, IA e LGPD/LAI | LGPD e LAI Aplicadas às Auditorias e ao Setor Público (`lgpd-lai-tcu`) | 1 | 566 | 4 | 4 |
| Análise de Dados, IA e LGPD/LAI | PLN, IA Generativa, Algoritmos e Segurança da Informação (`ia`) | 2 | 200 | 50 | 50 |
| Auditoria Governamental | Achados, Matrizes, Relatórios e Contas Anuais (IN 84/2020) (`aud-achados-relatorio`) | 1 | 10 | 2 | 2 |
| Auditoria Governamental | Amostragem, Execução, Técnicas e Evidências (`aud-amostragem-exec`) | 1 | 16 | 7 | 7 |
| Auditoria Governamental | Conceitos, Papéis e Três Linhas de Defesa (`aud-conceitos`) | 1 | 44 | 36 | 36 |
| Auditoria Governamental | Normas de Auditoria: ISSAIs 100 a 400, NBASP e NAT (`aud-normas`) | 1 | 23 | 13 | 5 |
| Auditoria Governamental | Planejamento, Risco, Materialidade e Matriz de Planejamento (`aud-planejamento`) | 1 | 39 | 30 | 10 |
| Controle Externo | Controle Externo na Constituição (Arts. 70 a 75) (`ce-cf`) | 1 | 70 | 54 | 27 |
| Controle Externo | Eficácia das Decisões, Execução e Jurisprudência do STF (`ce-eficacia`) | 1 | 12 | 2 | 2 |
| Controle Externo | Lei Orgânica do TCU (Lei 8.443/1992) (`ce-lotcu`) | 1 | 37 | 24 | 12 |
| Controle Externo | TCU: Natureza, Competência, Jurisdição e Composição (`ce-natureza`) | 1 | 35 | 24 | 24 |
| Controle Externo | Regimento Interno do TCU e Instrumentos de Fiscalização (`ce-ritcu`) | 1 | 50 | 40 | 40 |
| Estatística e Matemática Financeira | Estatística Descritiva, Probabilidade e Distribuições (`est-desc-prob`) | 1 | 48 | 37 | 27 |
| Estatística e Matemática Financeira | Inferência, Testes de Hipóteses, Amostragem e Regressão (`est-inf-amostra`) | 1 | 29 | 18 | 4 |
| Estatística e Matemática Financeira | Matemática Financeira: Juros, Taxas, Rendas, Price/SAC e VPL/TIR (`matfin-juros-amort`) | 1 | 40 | 29 | 29 |
| Controle Externo | Controle da Administração e da Atividade Financeira (`ce-adm-fin`) | 2 | 17 | 11 | 11 |
| Português, Inglês e Raciocínio Analítico | Língua Inglesa: Leitura de Textos Técnicos, Auditoria (ISSAIs) e Vocabulário (`ingles`) | 1 | 402 | 15 | 5 |
| Português, Inglês e Raciocínio Analítico | Língua Portuguesa: Interpretação, Morfossintaxe, Reescrita e Redação Oficial (`portugues`) | 1 | 744 | 202 | 169 |
| Português, Inglês e Raciocínio Analítico | Raciocínio Analítico: Argumentação, Senso Crítico e Falácias (`raciocinio-analitico`) | 1 | 40 | 27 | 27 |
| Contabilidade Pública e Análise de Balanços | Análise das Demonstrações Contábeis: Índices, AH/AV e Notas Explicativas (`adc-indices`) | 1 | 18 | 10 | 10 |
| Direito Administrativo e Licitações | Licitações e Contratos (Lei 14.133/2021) e Registro de Preços (Dec. 11.462/2023) (`adm-licitacoes-14133`) | 1 | 80 | 26 | 18 |
| Administração Financeira e Orçamentária (AFO) | Execução Orçamentária e Financeira, Restos a Pagar e Conta Única (`afo-execucao`) | 1 | 22 | 8 | 5 |
| Administração Financeira e Orçamentária (AFO) | LRF (LC 101/2000), Regime Fiscal Sustentável (LC 200/2023) e SIAFI (`afo-lrf-arcabouco`) | 1 | 53 | 37 | 19 |
| Contabilidade Pública e Análise de Balanços | Procedimentos Patrimoniais (MCASP) e Demonstrações Contábeis (DCASP) (`casp-patrimonio-dcasp`) | 1 | 49 | 35 | 16 |
| Contabilidade Pública e Análise de Balanços | NBC TSP Estrutura Conceitual, PCASP e Enfoque Orçamentário × Patrimonial (`contabilidade`) | 1 | 111 | 63 | 63 |
| Direito Administrativo e Licitações | Improbidade Administrativa (Lei 8.429/1992 c/ Lei 14.230/2021) (`etica-improbidade`) | 1 | 42 | 12 | 12 |
| Administração Financeira e Orçamentária (AFO) | Orçamento na CF (PPA, LDO, LOA), Princípios e Classificações (`orcamento`) | 1 | 101 | 58 | 58 |
| Direito Administrativo e Licitações | Organização Administrativa, Serviços Públicos, Atos e Agentes (Lei 8.112) (`administrativo`) | 2 | 359 | 115 | 80 |
| Direito Administrativo e Licitações | Poderes Administrativos e Processo Administrativo Federal (Lei 9.784/1999) (`lei-9784`) | 3 | 154 | 3 | 3 |
| Direito Constitucional | Poder Legislativo, Processo Legislativo, CPIs e Administração Pública (Arts. 37–41) (`cf-leg-adm`) | 1 | 81 | 13 | 13 |
| Direito Constitucional | Organização do Estado, Direitos Fundamentais, Executivo e Controle de Constitucionalidade (`constitucional`) | 2 | 331 | 92 | 76 |
| Administração Pública e Governança | Modelos de Administração Pública, Governança (Dec. 9.203/2017) e Políticas Públicas (`gestao-publica`) | 1 | 371 | 100 | 100 |
| Anticorrupção, LINDB, Civil e Processo Civil | Crimes contra a Administração, Lavagem, Org. Criminosa, Convenções e Abuso (`anticorr-penal-conv`) | 2 | 20 | 12 | 12 |
| Administração Pública e Governança | Planejamento Estratégico, Processos, Projetos, Ágil, Pessoas e ESG (`riscos`) | 2 | 161 | 25 | 25 |
| Anticorrupção, LINDB, Civil e Processo Civil | Direito Civil (Parte Geral e Obrigações) e Processo Civil (`civil-cpc`) | 3 | 44 | 36 | 36 |
| Economia do Setor Público e da Regulação | Microeconomia, Falhas de Mercado e Economia da Regulação (`regulacao-teoria`) | 1 | 495 | 6 | 4 |
| Economia do Setor Público e da Regulação | Macroeconomia, Contas Nacionais, IS-LM e Finanças Públicas (`economia`) | 2 | 144 | 24 | 21 |
