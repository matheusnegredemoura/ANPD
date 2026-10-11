// Lê os textos legais de fontes/ e os divide em artigos.
// Cada lei vira { id, nome, artigos: [{ id, rotulo, estrutura, texto }] }.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const LEIS = {
  lgpd: {
    arquivo: 'lgpd.txt',
    nome: 'LGPD — Lei nº 13.709/2018',
    curto: 'LGPD',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm',
  },
  lei13848: {
    arquivo: 'lei13848.txt',
    nome: 'Lei nº 13.848/2019 — Agências Reguladoras',
    curto: 'Lei 13.848',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13848.htm',
  },
  lei9784: {
    arquivo: 'lei9784.txt',
    nome: 'Lei nº 9.784/1999 — Processo Administrativo',
    curto: 'Lei 9.784',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l9784.htm',
  },
  lei15352: {
    arquivo: 'lei15352.txt',
    nome: 'Lei nº 15.352/2026 — ANPD agência e carreira',
    curto: 'Lei 15.352',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15352.htm',
  },
  estrutura: {
    arquivo: 'estrutura-anpd.txt',
    nome: 'Estrutura Regimental da ANPD — Anexo I do Decreto nº 12.881/2026',
    curto: 'Estrutura ANPD',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12881.htm',
  },
  dec12881: {
    arquivo: 'dec12881.txt',
    nome: 'Decreto nº 12.881/2026 — aprova a Estrutura Regimental',
    curto: 'Dec. 12.881',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12881.htm',
  },
  res1: {
    arquivo: 'res1.txt',
    nome: 'Resolução CD/ANPD nº 1/2021 — Fiscalização e processo sancionador',
    curto: 'Res. 1/2021',
    url: 'https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd',
  },
  res2: {
    arquivo: 'res2.txt',
    nome: 'Resolução CD/ANPD nº 2/2022 — Agentes de pequeno porte',
    curto: 'Res. 2/2022',
    url: 'https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-2-de-27-de-janeiro-de-2022',
  },
  res4: {
    arquivo: 'res4.txt',
    nome: 'Resolução CD/ANPD nº 4/2023 — Dosimetria e sanções',
    curto: 'Res. 4/2023',
    url: 'https://www.in.gov.br/web/dou/-/resolucao-cd/anpd-n-4-de-24-de-fevereiro-de-2023-466146077',
  },
  res15: {
    arquivo: 'res15.txt',
    nome: 'Resolução CD/ANPD nº 15/2024 — Incidentes de segurança',
    curto: 'Res. 15/2024',
    url: 'https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd',
  },
  res18: {
    arquivo: 'res18.txt',
    nome: 'Resolução CD/ANPD nº 18/2024 — Encarregado',
    curto: 'Res. 18/2024',
    url: 'https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd',
  },
  res32: {
    arquivo: 'res32.txt',
    nome: 'Resolução CD/ANPD nº 32/2026 — Adequação da União Europeia',
    curto: 'Res. 32/2026',
    url: 'https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd',
  },
  res4ap: {
    arquivo: 'res4ap.txt',
    nome: 'Resolução CD/ANPD nº 4/2023 — Apêndices I e II (cálculo da multa)',
    curto: 'Res. 4 · Apêndices',
    url: 'https://www.in.gov.br/web/dou/-/resolucao-cd/anpd-n-4-de-24-de-fevereiro-de-2023-466146077',
  },
  res19r: {
    arquivo: 'res19r.txt',
    nome: 'Resolução CD/ANPD nº 19/2024 — artigos da resolução',
    curto: 'Res. 19 · resolução',
    url: 'https://www.in.gov.br/web/dou',
  },
  res19: {
    arquivo: 'res19.txt',
    nome: 'Resolução CD/ANPD nº 19/2024 — Regulamento de Transferência Internacional (Anexo I)',
    curto: 'Res. 19/2024',
    url: 'https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd',
  },
  res19c: {
    arquivo: 'res19c.txt',
    nome: 'Resolução CD/ANPD nº 19/2024 — Cláusulas-padrão contratuais (Anexo II)',
    curto: 'Res. 19 · cláusulas',
    url: 'https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd',
  },
  res30: {
    arquivo: 'res30.txt',
    nome: 'Resolução CD/ANPD nº 30/2025 — Mapa de Temas Prioritários 2026-2027',
    curto: 'Res. 30/2025',
    url: 'https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd',
  },
  res31: {
    arquivo: 'res31.txt',
    nome: 'Resolução CD/ANPD nº 31/2025 — Agenda Regulatória 2025-2026',
    curto: 'Res. 31/2025',
    url: 'https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd',
  },
  enun1: {
    arquivo: 'enunciado1.txt',
    nome: 'Enunciado CD/ANPD nº 1/2023 — Dados de crianças e adolescentes',
    curto: 'Enunciado 1/2023',
    url: 'https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd',
  },
  stfsum: {
    arquivo: 'stfsum.txt',
    nome: 'Súmulas e teses do STF e do STJ — aplicação selecionada pelos tribunais',
    curto: 'STF e STJ (súmulas)',
    url: 'https://portal.stf.jus.br/',
    marcadores: true,
  },
  lei15211: {
    arquivo: 'lei15211.txt',
    nome: 'Lei nº 15.211/2025 — ECA Digital',
    curto: 'ECA Digital',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm',
  },
  dec12880: {
    arquivo: 'dec12880.txt',
    nome: 'Decreto nº 12.880/2026 — Regulamento do ECA Digital',
    curto: 'Dec. 12.880',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12880.htm',
  },
  dec12622: {
    arquivo: 'dec12622.txt',
    nome: 'Decreto nº 12.622/2025 — ANPD autoridade do ECA Digital',
    curto: 'Dec. 12.622',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/d12622.htm',
  },
  lei9986: {
    arquivo: 'lei9986.txt',
    nome: 'Lei nº 9.986/2000 — Recursos humanos das agências reguladoras',
    curto: 'Lei 9.986',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l9986.htm',
  },
  lei10871: {
    arquivo: 'lei10871.txt',
    nome: 'Lei nº 10.871/2004 — Carreiras das agências reguladoras',
    curto: 'Lei 10.871',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l10.871.htm',
  },
  dec10411: {
    arquivo: 'dec10411.txt',
    nome: 'Decreto nº 10.411/2020 — Análise de Impacto Regulatório',
    curto: 'Dec. 10.411',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/decreto/d10411.htm',
  },
  lei13874: {
    arquivo: 'lei13874.txt',
    nome: 'Lei nº 13.874/2019 — Liberdade Econômica',
    curto: 'Lei 13.874',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13874.htm',
  },
  lc182: {
    arquivo: 'lc182.txt',
    nome: 'Lei Complementar nº 182/2021 — Marco Legal das Startups',
    curto: 'LC 182',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp182.htm',
  },
  lindb: {
    arquivo: 'lindb.txt',
    nome: 'Decreto-Lei nº 4.657/1942 — LINDB',
    curto: 'LINDB',
    url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del4657compilado.htm',
  },
  dec9830: {
    arquivo: 'dec9830.txt',
    nome: 'Decreto nº 9.830/2019 — Regulamenta os arts. 20 a 30 da LINDB',
    curto: 'Dec. 9.830',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/decreto/d9830.htm',
  },
  eca: {
    arquivo: 'eca.txt',
    nome: 'Lei nº 8.069/1990 — Estatuto da Criança e do Adolescente',
    curto: 'ECA',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8069.htm',
  },
  lei14852: {
    arquivo: 'lei14852.txt',
    nome: 'Lei nº 14.852/2024 — Marco legal dos jogos eletrônicos',
    curto: 'Lei 14.852',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l14852.htm',
  },
  mci: {
    arquivo: 'mci.txt',
    nome: 'Lei nº 12.965/2014 — Marco Civil da Internet',
    curto: 'Marco Civil',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm',
  },
  dec8771: {
    arquivo: 'dec8771.txt',
    nome: 'Decreto nº 8.771/2016 — Regulamento do Marco Civil',
    curto: 'Dec. 8.771',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/decreto/d8771.htm',
  },
  cf88: {
    arquivo: 'cf88.txt',
    nome: 'Constituição Federal de 1988',
    curto: 'CF/88',
    url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
  },
  lei8112: {
    arquivo: 'lei8112.txt',
    nome: 'Lei nº 8.112/1990 — Regime jurídico dos servidores federais',
    curto: 'Lei 8.112',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm',
  },
  lai: {
    arquivo: 'lai.txt',
    nome: 'Lei nº 12.527/2011 — Lei de Acesso à Informação',
    curto: 'LAI',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm',
  },
  dec7724: {
    arquivo: 'dec7724.txt',
    nome: 'Decreto nº 7.724/2012 — Regulamento da LAI',
    curto: 'Dec. 7.724',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/decreto/d7724.htm',
  },
  lei13460: {
    arquivo: 'lei13460.txt',
    nome: 'Lei nº 13.460/2017 — Defesa do usuário do serviço público',
    curto: 'Lei 13.460',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/lei/l13460.htm',
  },
  lei8429: {
    arquivo: 'lei8429.txt',
    nome: 'Lei nº 8.429/1992 — Improbidade Administrativa',
    curto: 'Lei 8.429',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8429.htm',
  },
  lei12846: {
    arquivo: 'lei12846.txt',
    nome: 'Lei nº 12.846/2013 — Lei Anticorrupção',
    curto: 'Lei 12.846',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12846.htm',
  },
  lei12813: {
    arquivo: 'lei12813.txt',
    nome: 'Lei nº 12.813/2013 — Conflito de interesses',
    curto: 'Lei 12.813',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12813.htm',
  },
  dec1171: {
    arquivo: 'dec1171.txt',
    nome: 'Decreto nº 1.171/1994 — Código de Ética do Servidor',
    curto: 'Código de Ética',
    url: 'https://www.planalto.gov.br/ccivil_03/decreto/d1171.htm',
    itens: true,
  },
  lei9507: {
    arquivo: 'lei9507.txt',
    nome: 'Lei nº 9.507/1997 — Habeas data',
    curto: 'Lei 9.507',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l9507.htm',
  },
  dec12572: {
    arquivo: 'dec12572.txt',
    nome: 'Decreto nº 12.572/2025 — Política Nacional de Segurança da Informação',
    curto: 'Dec. 12.572',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/d12572.htm',
  },
  dec11856: {
    arquivo: 'dec11856.txt',
    nome: 'Decreto nº 11.856/2023 — Política Nacional de Cibersegurança',
    curto: 'Dec. 11.856',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/d11856.htm',
  },
  dec10748: {
    arquivo: 'dec10748.txt',
    nome: 'Decreto nº 10.748/2021 — Rede Federal de Gestão de Incidentes Cibernéticos',
    curto: 'Dec. 10.748',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/decreto/d10748.htm',
  },
  gdpr: {
    arquivo: 'gdpr.txt',
    nome: 'GDPR — Regulamento (UE) 2016/679 (texto oficial em inglês)',
    curto: 'GDPR',
    url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
  },
  nistcsf: {
    arquivo: 'nistcsf.txt',
    nome: 'NIST Cybersecurity Framework (CSF) 2.0 — NIST CSWP 29 (2024)',
    curto: 'NIST CSF 2.0',
    url: 'https://doi.org/10.6028/NIST.CSWP.29',
    marcadores: true,
  },
  conv108: {
    arquivo: 'conv108.txt',
    nome: 'Convenção 108+ do Conselho da Europa — versão atualizada (2018)',
    curto: 'Convenção 108+',
    url: 'https://www.coe.int/en/web/data-protection/convention108-and-protocol',
  },
  ingsi1: {
    arquivo: 'in-gsi1.txt',
    nome: 'Instrução Normativa GSI/PR nº 1/2020 — Gestão da segurança da informação',
    curto: 'IN GSI 1/2020',
    url: 'https://www.in.gov.br/web/dou',
  },
  lei8987: {
    arquivo: 'lei8987.txt',
    nome: 'Lei nº 8.987/1995 — Concessões e permissões',
    curto: 'Lei 8.987',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8987cons.htm',
  },
  lei14133: {
    arquivo: 'lei14133.txt',
    nome: 'Lei nº 14.133/2021 — Licitações e Contratos',
    curto: 'Lei 14.133',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
  },
  dl200: {
    arquivo: 'dl200.txt',
    nome: 'Decreto-Lei nº 200/1967 — Organização da Administração Federal',
    curto: 'DL 200',
    url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del0200.htm',
  },
  lei14129: {
    arquivo: 'lei14129.txt',
    nome: 'Lei nº 14.129/2021 — Governo Digital',
    curto: 'Lei 14.129',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14129.htm',
  },
  regimento: {
    arquivo: 'regimento-anpd.txt',
    nome: 'Regimento Interno da ANPD (2021) — Portaria nº 1/2021',
    curto: 'Regimento 2021',
    url: 'https://www.gov.br/anpd/pt-br',
    // Mostrado no topo da norma e de cada artigo
    aviso: 'Texto de 2021, de quando a ANPD integrava a Presidência da República. Onde diverge da Lei 13.848/2019 e da Estrutura Regimental do Decreto 12.881/2026 (unidades, quórum do Conselho Diretor, prazo de consulta pública, PAD de diretor), valem estas. Confira no site da ANPD se já há regimento mais novo.',
  },
  dec10046: {
    arquivo: 'dec10046.txt',
    nome: 'Decreto nº 10.046/2019 — Compartilhamento de dados na administração federal e Cadastro Base do Cidadão',
    curto: 'Dec. 10.046',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/decreto/D10046.htm',
  },
  dec9203: {
    arquivo: 'dec9203.txt',
    nome: 'Decreto nº 9.203/2017 — Política de governança',
    curto: 'Dec. 9.203',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/decreto/d9203.htm',
  },
  inmpcgu1: {
    arquivo: 'in-mpcgu1.txt',
    nome: 'IN Conjunta MP/CGU nº 1/2016 — Controles internos, riscos e governança',
    curto: 'IN MP/CGU 1/2016',
    url: 'https://www.in.gov.br/web/dou',
  },
  dec12976: {
    arquivo: 'dec12976.txt',
    nome: 'Decreto nº 12.976/2026 — Proteção de mulheres na internet',
    curto: 'Dec. 12.976',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12976.htm',
  },
};

// Grupos do seletor da lei seca, na ordem em que aparecem. Toda norma de LEIS entra em exatamente um grupo.
export const GRUPOS_LEIS = [
  ['LGPD e normas da ANPD', ['lgpd', 'lei15352', 'estrutura', 'dec12881', 'regimento', 'res1', 'res2', 'res4', 'res4ap', 'res15', 'res18', 'res19r', 'res19', 'res19c', 'res30', 'res31', 'res32', 'enun1']],
  ['ECA Digital, internet e plataformas', ['lei15211', 'dec12880', 'dec12622', 'eca', 'mci', 'dec8771', 'dec12976', 'lei14852']],
  ['Regulação, agências e carreira', ['lei13848', 'lei9986', 'lei10871', 'dec10411', 'lei13874', 'lc182']],
  ['Governança e gestão pública', ['dec9203', 'inmpcgu1', 'dec10046']],
  ['Constituição', ['cf88']],
  ['Direito administrativo', ['lei9784', 'lindb', 'dec9830', 'lai', 'dec7724', 'lei13460', 'lei8429', 'lei12846', 'lei12813', 'lei8112', 'dec1171', 'lei9507', 'dl200', 'lei14133', 'lei8987', 'lei14129']],
  ['Segurança da informação', ['dec12572', 'dec11856', 'dec10748', 'ingsi1', 'nistcsf']],
  ['Direito comparado (Europa)', ['gdpr', 'conv108']],
  ['Jurisprudência do STF e do STJ', ['stfsum']],
];

// Unidade da norma: artigo, cláusula (cláusulas-padrão), apêndice, anexo ou enunciado.
// O sufixo de letra pode vir depois do ordinal ("Art. 8º-A") e não pode ser começo de palavra ("Art. 40 - Aos" é o art. 40).
const RE_ARTIGO = /^(Art\.|CLÁUSULA|APÊNDICE|ANEXO|ENUNCIADO)\s*(?:(\d+)\s*[ºo°]?(-[A-Z](?![a-zà-ú]))?|([IVXL]+)\b)?(?:º|o|°|\.)?\.?\s*/;
const ROTULO_UNIDADE = { 'Art.': 'Art. ', CLÁUSULA: 'Cláusula ', APÊNDICE: 'Apêndice ', ANEXO: 'Anexo', ENUNCIADO: 'Enunciado ' };
// Títulos, capítulos e seções; em caixa mista ("Título I", como no ECA), só quando seguidos de número romano ou "Único".
const RE_ESTRUTURA = /^(?:(LIVRO|TÍTULO|CAPÍTULO|SEÇÃO|Seção|Subseção|SUBSEÇÃO)\b|(Livro|Título|Capítulo)\s+(?:[IVXL]+|Únic[oa])\b|(Parte (?:Geral|Especial))$|(CHAPTER [IVXL]+|Section \d+)$)/;
// Normas europeias: "Article 4" sozinho na linha (GDPR, em inglês) ou "Artigo 4 – Título" (Convenção 108+).
const RE_ARTICLE = /^(?:Article (\d+)$|Artigo (\d+)(?:\.º)? [–—] )/;
// Itens em algarismo romano que são a unidade da norma (Código de Ética do Decreto nº 1.171/1994).
const RE_ITEM = /^([IVXL]+) - /;

export function normalizar(s) {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Divide o texto em artigos e guarda a localização de cada um (título, capítulo, seção, subseção).
// estrutura[0] é o capítulo (precedido do título, quando a norma tem títulos); estrutura[1] a seção ou subseção.
// Artigos com o mesmo número em sequência (redação original e nova redação, como o 41-A do ECA Digital) viram um só.
export function carregarLei(raiz, id) {
  const meta = LEIS[id];
  const caminho = join(raiz, 'fontes', meta.arquivo);
  if (!existsSync(caminho)) return null;
  const linhas = readFileSync(caminho, 'utf8').split('\n');
  const artigos = [];
  const pos = { livro: '', titulo: '', capitulo: '', secao: '', subsecao: '' };
  let atual = null;
  let ultimo = null; // nível de estrutura que recebe a linha de nome seguinte
  let noAnexo = false;

  for (const bruta of linhas) {
    const linha = bruta.trimEnd();
    if (!linha.trim() || linha.startsWith('#')) continue;
    const e = linha.match(RE_ESTRUTURA);
    if (e) {
      const tipo = e[3] ? 'livro' : e[4] ? (e[4].startsWith('CHAPTER') ? 'capítulo' : 'seção') : (e[1] || e[2]).toLowerCase();
      if (tipo === 'livro') { pos.livro = linha; pos.titulo = pos.capitulo = pos.secao = pos.subsecao = ''; ultimo = 'livro'; }
      else if (tipo === 'título') { pos.titulo = linha; pos.capitulo = pos.secao = pos.subsecao = ''; ultimo = 'titulo'; }
      else if (tipo === 'capítulo') { pos.capitulo = linha; pos.secao = pos.subsecao = ''; ultimo = 'capitulo'; }
      else if (tipo === 'seção') { pos.secao = linha; pos.subsecao = ''; ultimo = 'secao'; }
      else { pos.subsecao = linha; ultimo = 'subsecao'; }
      atual = null;
      continue;
    }
    // Documentos sem artigos (NIST CSF): "@grupo Nome" abre um grupo e "@unidade ID Rótulo" abre uma unidade
    const grp = meta.marcadores && linha.match(/^@grupo (.+)$/);
    if (grp) { pos.capitulo = grp[1]; pos.secao = ''; atual = null; ultimo = null; continue; }
    const uni = meta.marcadores && linha.match(/^@unidade (\S+) (.+)$/);
    if (uni) { atual = { id: uni[1], rotulo: uni[2], estrutura: [pos.capitulo].filter(Boolean), linhas: [] }; artigos.push(atual); continue; }
    const ing = linha.match(RE_ARTICLE);
    const m = ing ? [linha, 'Art.', ing[1] || ing[2]] : linha.match(RE_ARTIGO);
    const num = m && (m[2] ? m[2] + (m[3] || '') : m[4]);
    const item = meta.itens && noAnexo && linha.match(RE_ITEM);
    if ((m && (num || m[1] === 'ANEXO')) || item) {
      ultimo = null;
      let idUnidade, rotulo;
      if (item) { idUnidade = item[1]; rotulo = 'Item ' + item[1]; }
      else if (m[1] === 'ANEXO') { idUnidade = num ? 'Anexo ' + num : 'Anexo'; rotulo = idUnidade; noAnexo = true; }
      else { idUnidade = num; rotulo = ROTULO_UNIDADE[m[1]] + num; }
      if (atual && atual.id === idUnidade) { atual.linhas.push(linha); continue; }
      const topo = [pos.livro, pos.titulo].filter(Boolean).join(' · ');
      const cap = topo && pos.capitulo ? topo + ' · ' + pos.capitulo : pos.capitulo || topo;
      const sec = pos.subsecao ? (pos.secao ? pos.secao + ' · ' : '') + pos.subsecao : pos.secao;
      atual = { id: idUnidade, rotulo, estrutura: [cap, sec].filter(Boolean), linhas: [linha] };
      artigos.push(atual);
      continue;
    }
    if (atual) atual.linhas.push(linha);
    else if (ultimo) pos[ultimo] += ' — ' + linha.trim(); // nome do título, capítulo ou seção em linha separada
  }
  return {
    id,
    ...meta,
    artigos: artigos.map((a) => ({ id: a.id, rotulo: a.rotulo, estrutura: a.estrutura, texto: a.linhas.join('\n') })),
  };
}

export function indicePorArtigo(lei) {
  const mapa = new Map();
  for (const a of lei.artigos) mapa.set(a.id, a);
  return mapa;
}
