(function () {
'use strict';

/* ================= Dados embutidos ================= */
const D = JSON.parse(document.getElementById('dados').textContent);
// O pacote chega enxuto (scripts/build.mjs, empacotar); aqui volta à forma completa antes de qualquer uso
for (const q of D.questoes) { if (typeof q.cm === 'number') q.cm = D.comandos[q.cm]; if (q.art === undefined) q.art = null; if (!q.t) q.t = []; }
for (const l of Object.values(D.lei || {})) {
  let est = [];
  for (const a of l.artigos) { if (a.estrutura) est = a.estrutura; else a.estrutura = est; if (!a.rotulo) a.rotulo = 'Art. ' + a.id; }
}
const Q = D.questoes;
// Múltipla escolha: q.al traz as alternativas e q.g é a letra; nos itens certo/errado, q.al não existe
const LETRAS = 'ABCDE';
// Resposta em branco: um código que não colide com a letra B das alternativas
const BRANCO = '-';
const QI = new Map(Q.map((q) => [q.id, q]));
const BLOCOS = D.blocos;
const BI = new Map(BLOCOS.map((b) => [b.id, b]));
const DISC = D.disciplinas;
const DI = new Map(DISC.map((d) => [d.id, d]));
// Lei seca: várias normas. A chave de um artigo é o id na LGPD ("18") e "norma:id" nas demais ("cf88:5"),
// o que mantém válidos os artigos lidos guardados antes de haver outras normas.
const LEIS = D.lei || {};
const GRUPOS = D.grupos || [{ nome: 'Normas', ids: Object.keys(LEIS) }];
function chave(lei, art) { return lei === 'lgpd' ? art : lei + ':' + art; }
const ARTI = new Map();
for (const [id, l] of Object.entries(LEIS)) for (const a of l.artigos) { a.lei = id; a.k = chave(id, a.id); ARTI.set(a.k, a); }
const LEI = LEIS.lgpd;
const ARTS = LEI ? LEI.artigos : [];
function artsDe(lei) { return LEIS[lei] ? LEIS[lei].artigos : []; }
const POR_BLOCO = agrupar(Q, (q) => q.b);
const POR_ART = agrupar(Q.filter((q) => q.art && LEIS[q.l]), (q) => chave(q.l, q.art));
// Artigos citados por itens reais de prova: o acerto num item escrito para o banco sobre um deles vale 50% a mais,
// porque é matéria que a banca já mostrou que cobra
const REAIS_POR_ART = new Map();
for (const [k, qs] of POR_ART) { const n = qs.filter((q) => q.o).length; if (n) REAIS_POR_ART.set(k, n); }
function caiuEmProva(q) { return q.art && !q.o ? REAIS_POR_ART.get(chave(q.l, q.art)) || 0 : 0; }
const DIAS = [];
D.cronograma.fases.forEach((f) => f.semanas.forEach((s) => s.dias.forEach((d) => DIAS.push(Object.assign({ fase: f.id }, d)))));
DIAS.sort((a, b) => (a.data < b.data ? -1 : 1));

// Cards cloze: cada número de lacuna de uma nota vira um card
const RE_LACUNA = /\{\{(?:c(\d+)::)?([^}]+?)\}\}/g;
function lacunasDe(texto) {
  const out = [];
  let auto = 0;
  texto.replace(RE_LACUNA, (m, n, t) => { out.push({ n: n ? Number(n) : ++auto, t }); return m; });
  return out;
}
const NOTAS = D.cloze || [];
const CARDS = [];
NOTAS.forEach((nota) => {
  const nums = [...new Set(lacunasDe(nota.t).map((l) => l.n))];
  nums.forEach((n) => CARDS.push({ id: nota.id + '.' + n, nota, n }));
});
const CI = new Map(CARDS.map((c) => [c.id, c]));
const CARDS_POR_BLOCO = agrupar(CARDS, (c) => c.nota.b);
const CARDS_POR_ART = agrupar(CARDS.filter((c) => c.nota.art), (c) => chave(c.nota.l || 'lgpd', c.nota.art));
// Bloco do cronograma que cobre cada artigo (para o peso do artigo no ranking)
const BLOCO_DO_ART = new Map();
for (const b of BLOCOS) for (const a of b.artigos || []) { const k = chave(b.lei || 'lgpd', a); if (!BLOCO_DO_ART.has(k)) BLOCO_DO_ART.set(k, b); }

// Glossário com expressão regular por termo; os termos jurídicos (j) só aparecem explicados embaixo dos artigos
const GLOSS = (D.glossario || []).map((g, i) => Object.assign({ i, re: regexTermo(g.p) }, g));
const JURIDIQUES = GLOSS.filter((g) => g.j);
function regexTermo(padroes) {
  const e = padroes.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  try { return new RegExp('(?<![\\p{L}\\d])(?:' + e + ')(?![\\p{L}\\d])', 'iu'); } catch (err) { return new RegExp('(?:' + e + ')', 'i'); }
}

const INTERVALOS = [0, 1, 3, 7, 16, 35];
// Manutenção: itens já dominados (nível 3 ou mais) que venceram voltam aos poucos, no máximo este número por dia,
// para a carga de revisão caber no dia; os mais atrasados vêm primeiro.
const MANUTENCAO_DIA = 10;
// Leitura do dia: acima deste número de artigos, o app escolhe os que você errou, os ainda não lidos e os mais cobrados
const LEITURA_MAX = 25;
// Lista curta vencida acima deste número torna o dia pesado: a sessão de questões novas encolhe
const REVISOES_DIA_PESADO = 40;
// Intercalação: matérias básicas, treinadas todo dia, e blocos já estudados no cronograma, misturados na mesma sessão
const BLOCOS_BASICOS = ['portugues', 'ingles', 'constitucional', 'administrativo', 'lai', 'etica-improbidade', 'lei-9784'];
const MIN_DIA_ATIVO = 10;
// O histórico das questões vai em quatro documentos (itens0 a itens3): cada documento da conta aceita até 256 KiB, e um
// documento só estouraria por volta de 7 mil questões respondidas. No resto do app, "itens" continua sendo um nome só.
const PARTES_ITENS = ['itens0', 'itens1', 'itens2', 'itens3'];
const DOCS = ['perfil'].concat(PARTES_ITENS, ['cards', 'simulados', 'pesquisa', 'discursivas']);
const PARTE_DE = new Map();
function parteItem(id) {
  let p = PARTE_DE.get(id);
  if (!p) { p = PARTES_ITENS[hashTxt(id) % PARTES_ITENS.length]; PARTE_DE.set(id, p); }
  return p;
}
// Acima disto o documento não é enviado: a conta recusaria (limite de 256 KiB) e o erro apareceria no diagnóstico
const LIMITE_DOC = 240000;
const CHAVE_LOCAL = 'painel-anpd-v3';
const CHAVE_UI = 'painel-anpd-ui';
const P1 = ['lgpd-17-22', 'lgpd-52-54', 'lgpd-55', 'lgpd-33-36', 'lgpd-5-11'];
// Prova completa simulada: itens por disciplina numa prova de 120 (50 básicos + 70 específicos), estimativa para
// Especialista em Regulação feita sobre a estrutura da Anatel 2024 e da ANAC 2024 até sair o edital. Gestão fica em 6
// (o guia do cargo dá 4% do estudo): o terço de gestão do processo seletivo da ANPD (2025) veio do cargo gerencial, e
// o específico do especialista deve concentrar-se na LGPD e nas normas da ANPD. Contabilidade e finanças públicas
// (orçamento, Lei 4.320, LRF e contabilidade geral) ficam com 2, peso BAIXO no guia.
// Cada item básico vale 1 ponto e cada específico vale 2 (50 + 140 = 190): é a hipótese do plano até sair o edital.
// Na Anatel 2024, todo item valia 1; se o edital da ANPD repetir isso, basta pôr PESO_ESPECIFICA = 1.
// Regulação aparece nas duas partes: Lei 13.848 e Lei 9.784 na básica, teoria da regulação na específica.
const PESO_BASICA = 1, PESO_ESPECIFICA = 2;
const PROVA_BASICA = { linguas: 21, direito: 19, regulacao: 10 };
const PROVA_ESPECIFICA = { regulacao: 4, lgpd: 36, eca: 8, seginfo: 8, gestao: 6, contabil: 2, comparado: 3, economia: 3 };
const REG_NA_BASICA = new Set(['lei-13848', 'lei-9784']);
const ITENS_PROVA = {};
for (const parte of [PROVA_BASICA, PROVA_ESPECIFICA]) for (const [d, k] of Object.entries(parte)) ITENS_PROVA[d] = (ITENS_PROVA[d] || 0) + k;
const TOTAL_PROVA = Object.values(ITENS_PROVA).reduce((a, b) => a + b, 0);
const PONTOS_DISC = {};
for (const [d, k] of Object.entries(PROVA_BASICA)) PONTOS_DISC[d] = (PONTOS_DISC[d] || 0) + k * PESO_BASICA;
for (const [d, k] of Object.entries(PROVA_ESPECIFICA)) PONTOS_DISC[d] = (PONTOS_DISC[d] || 0) + k * PESO_ESPECIFICA;
const PONTOS_PROVA = Object.values(PONTOS_DISC).reduce((a, b) => a + b, 0);
// Parte da prova em que o item cairia: 'b' (básica, peso 1) ou 'e' (específica, peso 2)
function parteProva(q) {
  const d = (BI.get(q.b) || {}).disciplina;
  return d === 'linguas' || d === 'direito' || (d === 'regulacao' && REG_NA_BASICA.has(q.b)) ? 'b' : 'e';
}
function pesoItem(q) { return parteProva(q) === 'b' ? PESO_BASICA : PESO_ESPECIFICA; }
// Fatias da prova (parte + disciplina) para n itens, pelo método do maior resto (a soma dá exatamente n)
function cotasProva(n) {
  const fatias = Object.entries(PROVA_BASICA).map(([d, k]) => ['b', d, k]).concat(Object.entries(PROVA_ESPECIFICA).map(([d, k]) => ['e', d, k]));
  const base = fatias.map(([p, d, k]) => { const x = (n * k) / TOTAL_PROVA; return [p, d, Math.floor(x), x - Math.floor(x)]; });
  let falta = n - base.reduce((a, b) => a + b[2], 0);
  base.slice().sort((a, b) => b[3] - a[3]).forEach((b) => { if (falta > 0) { b[2]++; falta--; } });
  return base.map(([p, d, k]) => [p, d, k]);
}
const REAIS = Q.filter((q) => q.o);
// Discursiva: temas com quesitos; a linha manuscrita da folha de texto definitivo é estimada em 70 caracteres
const TEMAS_DISC = (D.discursivas && D.discursivas.temas) || [];
const CARACTERES_LINHA = 70;

// 40 níveis com degraus crescentes: os primeiros saem no primeiro dia; no ritmo de 500 a 1.000 XP por dia de estudo,
// Diretor(a)-Presidente chega perto da prova. Depois dele, cada mandato pede MANDATO_XP.
const NIVEIS = [
  [0, 'Titular de dados'], [150, 'Curioso(a) do art. 18'], [300, 'Leitor(a) de lei seca'], [500, 'Suboperador(a)'],
  [700, 'Operador(a)'], [950, 'Controlador(a)'], [1200, 'Controlador(a) conjunto(a)'], [1500, 'Encarregado(a)'],
  [1850, 'Guardião(ã) do consentimento'], [2200, 'Defensor(a) da finalidade'], [2600, 'Analista de conformidade'],
  [3100, 'Mapeador(a) de dados'], [3600, 'Redator(a) de relatório de impacto'], [4200, 'Mestre da pseudonimização'],
  [4800, 'Perito(a) em anonimização'], [5500, 'Projetista da privacidade desde a concepção'], [6400, 'Notificador(a) de incidentes'],
  [7300, 'Caçador(a) de vazamentos'], [8300, 'Protetor(a) do ECA Digital'], [9400, 'Fiscal de campo'],
  [10500, 'Auditor(a) de algoritmos'], [12000, 'Mediador(a) de petições de titulares'], [13500, 'Analista de transferência internacional'],
  [15500, 'Instrutor(a) de processo sancionador'], [17500, 'Calculista da dosimetria'], [19500, 'Redator(a) de guia orientativo'],
  [22000, 'Analista de impacto regulatório'], [25000, 'Relator(a) de consulta pública'], [28000, 'Arquiteto(a) do sandbox regulatório'],
  [31500, 'Especialista em Regulação'], [35500, 'Especialista de referência'], [40000, 'Coordenador(a)'],
  [45000, 'Coordenador(a)-Geral'], [50500, 'Ouvidor(a)'], [56500, 'Corregedor(a)'], [63500, 'Auditor(a)-Chefe'],
  [71000, 'Superintendente'], [79500, 'Conselheiro(a) do CNPD'], [89000, 'Diretor(a) do Conselho Diretor'],
  [100000, 'Diretor(a)-Presidente'],
];
const MANDATO_XP = 10000;

// Conquistas em cinco grupos (g); cada id fica gravado com a data em perfil.conq
const GRUPOS_CONQ = [['q', 'Questões'], ['c', 'Constância'], ['l', 'Lei, cards e revisão'], ['p', 'Domínio e prova'], ['j', 'Jornada']];
const CONQ = [
  { g: 'q', id: 'primeira', ic: '1', nome: 'Primeira marcação', desc: 'Respondeu o primeiro item.' },
  { g: 'q', id: 'r100', ic: '100', nome: 'Cem itens', desc: 'Respondeu 100 itens.' },
  { g: 'q', id: 'r500', ic: '500', nome: 'Quinhentos', desc: 'Respondeu 500 itens.' },
  { g: 'q', id: 'r1000', ic: '1k', nome: 'Mil itens', desc: 'Respondeu 1.000 itens.' },
  { g: 'q', id: 'r2500', ic: '2,5k', nome: 'Dois mil e quinhentos', desc: 'Respondeu 2.500 itens.' },
  { g: 'q', id: 'r5000', ic: '5k', nome: 'Cinco mil', desc: 'Respondeu 5.000 itens.' },
  { g: 'q', id: 'metade', ic: '½', nome: 'Meio banco', desc: 'Respondeu metade dos itens diferentes do banco.' },
  { g: 'q', id: 'combo10', ic: '10', nome: 'Dez seguidas', desc: 'Acertou 10 itens em sequência.' },
  { g: 'q', id: 'combo25', ic: '25', nome: 'Gabarito limpo', desc: 'Acertou 25 itens em sequência.' },
  { g: 'q', id: 'combo50', ic: '50', nome: 'Cinquenta seguidas', desc: 'Acertou 50 itens em sequência.' },
  { g: 'q', id: 'maratona', ic: '»', nome: 'Maratona', desc: 'Respondeu 100 itens no mesmo dia.' },
  { g: 'q', id: 'certeiro', ic: '90%', nome: 'Dia certeiro', desc: '90% de acerto em 30 ou mais itens no mesmo dia.' },
  { g: 'q', id: 'reais50', ic: 'CB', nome: 'Cara a cara com a banca', desc: 'Respondeu 50 itens reais de prova.' },
  { g: 'q', id: 'reais300', ic: 'CB+', nome: 'Veterano(a) de prova', desc: 'Respondeu 300 itens reais de prova.' },
  { g: 'q', id: 'casca', ic: 'D3', nome: 'Casca grossa', desc: 'Dominou 50 itens de dificuldade alta.' },
  { g: 'q', id: 'me20', ic: 'A–E', nome: 'Cinco alternativas', desc: 'Respondeu 20 itens de múltipla escolha.' },
  { g: 'q', id: 'calibrado', ic: '?', nome: 'Bem calibrado', desc: 'Marcou dúvida em 20 itens. Agora você sabe quando chutar.' },
  { g: 'q', id: 'relampago15', ic: 'R', nome: 'Relâmpago', desc: 'Nota líquida de 15 ou mais no modo relâmpago.' },
  { g: 'q', id: 'relampago25', ic: 'R+', nome: 'Trovão', desc: 'Nota líquida de 25 ou mais no modo relâmpago.' },
  { g: 'c', id: 'meta', ic: 'M', nome: 'Meta batida', desc: 'Cumpriu a meta diária de itens.' },
  { g: 'c', id: 'meta10', ic: 'M10', nome: 'Meta é rotina', desc: 'Cumpriu a meta diária em 10 dias.' },
  { g: 'c', id: 'meta50', ic: 'M50', nome: 'Meta inabalável', desc: 'Cumpriu a meta diária em 50 dias.' },
  { g: 'c', id: 'seq7', ic: '7d', nome: 'Semana firme', desc: '7 dias seguidos de estudo (domingo e uma folga por semana não quebram).' },
  { g: 'c', id: 'seq14', ic: '14d', nome: 'Quinzena firme', desc: '14 dias seguidos de estudo.' },
  { g: 'c', id: 'seq30', ic: '30d', nome: 'Mês sem falhar', desc: '30 dias seguidos de estudo.' },
  { g: 'c', id: 'seq60', ic: '60d', nome: 'Dois meses de pé', desc: '60 dias seguidos de estudo.' },
  { g: 'c', id: 'seq100', ic: '100d', nome: 'Cem dias', desc: '100 dias seguidos de estudo.' },
  { g: 'c', id: 'dias30', ic: '30', nome: 'Trinta dias de estudo', desc: '30 dias de estudo, seguidos ou não.' },
  { g: 'c', id: 'dias100', ic: '100', nome: 'Cem dias de estudo', desc: '100 dias de estudo, seguidos ou não.' },
  { g: 'c', id: 'fds', ic: 'S+D', nome: 'Ensaio de domingo', desc: 'Estudou no sábado e no domingo da mesma semana. A prova cai num domingo.' },
  { g: 'c', id: 'hora1', ic: '1h', nome: 'Uma hora de foco', desc: 'Estudou 1 hora no mesmo dia (relógio do app).' },
  { g: 'c', id: 'hora3', ic: '3h', nome: 'Três horas', desc: 'Estudou 3 horas no mesmo dia.' },
  { g: 'c', id: 'horas100', ic: '100h', nome: 'Cem horas', desc: 'Somou 100 horas de estudo no app.' },
  { g: 'c', id: 'coruja', ic: '23h', nome: 'Coruja', desc: 'Estudou depois das 23h.' },
  { g: 'c', id: 'madrugador', ic: '6h', nome: 'Madrugador(a)', desc: 'Respondeu um item entre 4h e 7h.' },
  { g: 'c', id: 'roteiro', ic: '5/5', nome: 'Roteiro completo', desc: 'Fechou todos os passos do roteiro de um dia.' },
  { g: 'c', id: 'roteiro7', ic: '7×', nome: 'Semana de roteiros', desc: 'Fechou o roteiro completo em 7 dias.' },
  { g: 'c', id: 'recuperacao', ic: '↺', nome: 'Nada fica para trás', desc: 'Terminou uma sessão de recuperação do atraso do plano.' },
  { g: 'l', id: 'lei20', ic: '§', nome: 'Lei seca', desc: 'Abriu 20 artigos no leitor da lei seca.' },
  { g: 'l', id: 'lei100', ic: '§100', nome: 'Cem artigos', desc: 'Abriu 100 artigos no leitor da lei seca.' },
  { g: 'l', id: 'lei500', ic: '§500', nome: 'Biblioteca de normas', desc: 'Abriu 500 artigos no leitor da lei seca.' },
  { g: 'l', id: 'leitodas', ic: '§§', nome: 'Lei inteira', desc: 'Abriu todos os artigos da LGPD no leitor.' },
  { g: 'l', id: 'cards50', ic: 'C', nome: 'Cinquenta lacunas', desc: 'Revisou 50 cards cloze.' },
  { g: 'l', id: 'cards300', ic: 'C3', nome: 'Lei na ponta da língua', desc: 'Revisou 300 cards cloze.' },
  { g: 'l', id: 'cards1000', ic: 'C1k', nome: 'Mil lacunas', desc: 'Revisou 1.000 cards cloze.' },
  { g: 'l', id: 'lista25', ic: 'LC', nome: 'Lista curta', desc: 'Tirou 25 itens da lista de erros.' },
  { g: 'l', id: 'lista100', ic: 'LC+', nome: 'Erro que não volta', desc: 'Tirou 100 itens da lista de erros.' },
  { g: 'l', id: 'lista300', ic: 'LC3', nome: 'Lista enxuta', desc: 'Tirou 300 itens da lista de erros.' },
  { g: 'l', id: 'memoria50', ic: '↻', nome: 'Memória de longo prazo', desc: 'Confirmou 50 acertos antigos que voltaram para manutenção.' },
  { g: 'l', id: 'pesq10', ic: '?!', nome: 'Curiosidade', desc: 'Marcou 10 temas como pesquisados e entendidos.' },
  { g: 'l', id: 'pesq30', ic: '?!+', nome: 'Investigador(a)', desc: 'Marcou 30 temas como pesquisados e entendidos.' },
  { g: 'l', id: 'explicar5', ic: '✎', nome: 'Com suas palavras', desc: 'Explicou 5 temas com suas palavras na investigação.' },
  { g: 'l', id: 'subtema', ic: 'ST', nome: 'Subtema dominado', desc: 'Dominou um subtema de uma trilha do zero.' },
  { g: 'l', id: 'trilha', ic: 'TR', nome: 'Trilha completa', desc: 'Dominou todos os subtemas de uma trilha.' },
  { g: 'p', id: 'bloco80', ic: '80', nome: 'Bloco dominado', desc: 'Chegou a 80% de domínio em um bloco.' },
  { g: 'p', id: 'blocos5', ic: '80×5', nome: 'Cinco blocos dominados', desc: '80% de domínio em 5 blocos.' },
  { g: 'p', id: 'blocos20', ic: '80×20', nome: 'Vinte blocos dominados', desc: '80% de domínio em 20 blocos.' },
  { g: 'p', id: 'p1', ic: 'P1', nome: 'Prioridade 1 em dia', desc: '60% de domínio nos blocos de prioridade 1 da LGPD.' },
  { g: 'p', id: 'disciplina', ic: '70', nome: 'Disciplina firme', desc: '70% de domínio médio numa disciplina inteira.' },
  { g: 'p', id: 'sim1', ic: 'S', nome: 'Primeiro simulado', desc: 'Entregou um simulado.' },
  { g: 'p', id: 'sim5', ic: 'S5', nome: 'Cinco simulados', desc: 'Entregou 5 simulados.' },
  { g: 'p', id: 'sim70', ic: '70%', nome: 'Nota de corte', desc: 'Nota líquida de 70% ou mais em simulado de 30+ itens.' },
  { g: 'p', id: 'sim80', ic: '80%', nome: 'Acima do corte', desc: 'Nota líquida de 80% ou mais em simulado de 30+ itens.' },
  { g: 'p', id: 'prova120', ic: '120', nome: 'Prova inteira', desc: 'Entregou um simulado de 120 itens.' },
  { g: 'p', id: 'disc1', ic: 'Tx', nome: 'Primeira discursiva', desc: 'Salvou a correção de uma discursiva.' },
  { g: 'p', id: 'disc5', ic: 'Tx5', nome: 'Cinco discursivas', desc: 'Salvou 5 correções de discursiva.' },
  { g: 'p', id: 'discnota', ic: 'Tx+', nome: 'Texto de aprovação', desc: '70% ou mais da nota numa discursiva.' },
  { g: 'p', id: 'lince', ic: '!', nome: 'Olho de lince', desc: 'Contestou um item que parecia errado.' },
  { g: 'j', id: 'bau1', ic: '▣', nome: 'Baú do dia', desc: 'Cumpriu as missões de um dia e abriu o baú.' },
  { g: 'j', id: 'bau7', ic: '▣7', nome: 'Sete baús', desc: 'Abriu 7 baús do dia.' },
  { g: 'j', id: 'bau30', ic: '▣30', nome: 'Trinta baús', desc: 'Abriu 30 baús do dia.' },
  { g: 'j', id: 'chefe1', ic: 'Ch', nome: 'Primeiro chefão', desc: 'Derrotou um chefão da semana.' },
  { g: 'j', id: 'chefe5', ic: 'Ch5', nome: 'Caçador(a) de chefões', desc: 'Derrotou 5 chefões.' },
  { g: 'j', id: 'chefe10', ic: 'Ch10', nome: 'Dez troféus', desc: 'Derrotou 10 chefões.' },
  { g: 'j', id: 'perfeita', ic: '♥', nome: 'Vitória perfeita', desc: 'Derrotou o chefão numa batalha sem perder nenhum coração.' },
  { g: 'j', id: 'lendario', ic: '★', nome: 'Item lendário', desc: 'Conseguiu um item lendário.' },
  { g: 'j', id: 'equipado', ic: 'EQ', nome: 'Equipado(a)', desc: 'Arma, armadura e amuleto equipados ao mesmo tempo.' },
  { g: 'j', id: 'colecao', ic: '12', nome: 'Arsenal completo', desc: 'Reuniu todos os itens do inventário.' },
  { g: 'j', id: 'nivel10', ic: 'N10', nome: 'Nível 10', desc: 'Chegou ao nível 10: ' + NIVEIS[9][1] + '.' },
  { g: 'j', id: 'nivel20', ic: 'N20', nome: 'Nível 20', desc: 'Chegou ao nível 20: ' + NIVEIS[19][1] + '.' },
  { g: 'j', id: 'nivel30', ic: 'N30', nome: 'Nível 30', desc: 'Chegou ao nível 30: ' + NIVEIS[29][1] + '.' },
];

/* ================= Utilitários ================= */
function agrupar(lista, chave) {
  const m = new Map();
  for (const x of lista) { const k = chave(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function hojeISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function diaNum(iso) { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); }
function isoDeNum(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }
const HOJE = () => diaNum(hojeISO());
function diaSemana(iso) { return new Date(iso + 'T12:00:00').getDay(); }
function inicial(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function fmtData(iso, op) { return inicial(new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', op)); }
function embaralhar(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function semAcento(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function pl(n, s, p) { return n + ' ' + (n === 1 ? s : p); }
function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
function fmtNum(n) { return Number(n).toLocaleString('pt-BR'); }
function fmtTempo(seg) { seg = Math.max(0, Math.round(seg)); return String(Math.floor(seg / 60)).padStart(2, '0') + ':' + String(seg % 60).padStart(2, '0'); }
function lerLS(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function gravarLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function rotuloArt(k) {
  const a = ARTI.get(k);
  const r = a ? a.rotulo : 'Art. ' + k;
  return /^Art\. \d$/.test(r) ? r + 'º' : r;
}
// Minúscula só na palavra comum ("Art." vira "art."); siglas como "GV.OC" ficam como estão
function minusc(s) { return /^\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
// "art. 5º" na LGPD; "CF/88, art. 5º" nas demais normas
function nomeArt(k) { const a = ARTI.get(k); return (a && a.lei !== 'lgpd' ? LEIS[a.lei].curto + ', ' : '') + minusc(rotuloArt(k)); }
function nomeBloco(bid) { const b = BI.get(bid); return b ? b.nome : bid; }
function fmtIntervalo(d) {
  if (d <= 0) return 'hoje';
  if (d === 1) return '1 dia';
  if (d < 30) return d + ' dias';
  const m = Math.round(d / 30);
  if (d < 365) return m + (m > 1 ? ' meses' : ' mês');
  return Math.round(d / 365) + ' ano(s)';
}

/* ================= Estado ================= */
function perfilPadrao() {
  return { xp: 0, meta: 30, novosCards: 20, intercaladas: 30, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: hojeISO() };
}
const S = { perfil: perfilPadrao(), itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {} };
// Último golpe no chefão (a tela da resposta anima o dano) e pendências do plano já calculadas neste desenho da tela
let golpeRecente = null, pendCache = null;
const UI = Object.assign({ lei: 'lgpd', vista: 'hoje', modo: 'treino', n: 20, filtro: 'mistas', prova: 'blocos', blocos: P1.slice(), blocosCards: [], faseAberta: null, camadas: { cai: true, num: true, alerta: true, verbo: true, erro: true } }, lerLS(CHAVE_UI) || {});
UI.discTema = null; UI.discFase = null; UI.discAval = {}; UI.discNE = 0; UI.det = {};
UI.artSel = null; UI.busca = ''; UI.mais = 'menu'; UI.leiFila = null; UI.ranking = false; UI.filtroPesq = 'pendentes'; UI.buscaGloss = ''; UI.artInline = null;
if (!UI.camadas) UI.camadas = { cai: true, num: true, alerta: true, verbo: true, erro: true };
let sessao = null;
// Preferências que acompanham a conta (vão no documento do perfil), para não se perderem quando o navegador
// ou o app do Claude limpam o armazenamento local. A aba aberta (vista) fica só neste aparelho.
const CAMPOS_UI = ['modo', 'n', 'filtro', 'prova', 'blocos', 'blocosCards', 'camadas', 'lei', 'tema', 'som'];
function prefsUI() { const o = {}; for (const k of CAMPOS_UI) if (UI[k] !== undefined) o[k] = UI[k]; return o; }
function salvarUI() {
  const p = prefsUI();
  gravarLS(CHAVE_UI, Object.assign({ vista: UI.vista }, p));
  if (JSON.stringify(p) !== JSON.stringify(S.perfil.ui || null)) { S.perfil.ui = p; Store.salvar('perfil'); }
}
// Preferências vindas da conta (outro aparelho, navegador limpo ou versão nova do painel)
function aplicarPrefs() {
  const p = S.perfil.ui;
  if (!p || typeof p !== 'object') return;
  for (const k of CAMPOS_UI) if (p[k] !== undefined) UI[k] = Array.isArray(p[k]) ? p[k].slice() : p[k] && typeof p[k] === 'object' ? Object.assign({}, p[k]) : p[k];
  UI.blocos = (UI.blocos || []).filter((b) => BI.has(b));
  UI.blocosCards = (UI.blocosCards || []).filter((b) => BI.has(b));
  if (!LEIS[UI.lei]) UI.lei = 'lgpd';
  if (!TEMAS.some(([v]) => v === UI.tema)) UI.tema = 'auto';
  gravarLS(CHAVE_UI, Object.assign({ vista: UI.vista }, prefsUI()));
  aplicarTema();
}
// Tema: 'auto' segue o aparelho e o claude.ai; 'horario' fica escuro das 19h às 6h. A escolha acompanha a conta.
const TEMAS = [['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro'], ['horario', 'Noturno pelo horário']];
function temaDaVez() {
  if (UI.tema === 'claro' || UI.tema === 'escuro') return UI.tema;
  if (UI.tema === 'horario') { const h = new Date().getHours(); return h >= 19 || h < 6 ? 'escuro' : 'claro'; }
  return null;
}
function aplicarTema() {
  const t = temaDaVez(), raiz = document.documentElement;
  if (t) raiz.dataset.tema = t; else delete raiz.dataset.tema;
}
function temaEscuroAtivo() {
  const raiz = document.documentElement;
  if (raiz.dataset.tema) return raiz.dataset.tema === 'escuro';
  if (raiz.dataset.theme) return raiz.dataset.theme === 'dark';
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
if (!TEMAS.some(([v]) => v === UI.tema)) UI.tema = 'auto';
aplicarTema();
// Em Automático, o ícone do topo acompanha a troca de tema do aparelho
try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => renderTopo()); } catch (e) { /* navegador antigo */ }
// No modo pelo horário, confere a hora a cada minuto
setInterval(() => { if (UI.tema === 'horario') { const antes = document.documentElement.dataset.tema; aplicarTema(); if (antes !== document.documentElement.dataset.tema) renderTopo(); } }, 60000);

/* ================= Persistência ================= */
// Junção de duas cópias do mesmo documento (a da conta e a deste navegador).
// O que só acumula (respostas, cards, dias de estudo, conquistas, simulados, lista de pesquisa) é unido, e em cada
// registro fica o mais recente. O que se liga e desliga (metas, status dos blocos, dias marcados no plano,
// preferências) vem da cópia mais nova, completada pela outra no que faltar.
function mesclarMapa(a, b, escolher) {
  const r = Object.assign({}, a || {});
  for (const [k, v] of Object.entries(b || {})) r[k] = k in r ? escolher(r[k], v) : v;
  return r;
}
function mesclarRPG(velho, novo) {
  if (!velho || !novo) return novo || velho;
  const r = Object.assign({}, velho, novo);
  r.inv = mesclarMapa(velho.inv, novo.inv, (a, b) => (b < a ? b : a));
  r.eq = Object.assign({}, velho.eq, novo.eq);
  r.baus = Math.max(velho.baus || 0, novo.baus || 0);
  const vistos = new Set();
  r.trofeus = (novo.trofeus || []).concat(velho.trofeus || []).filter((t) => { const k = t.sem + '|' + t.bloco; if (vistos.has(k)) return false; vistos.add(k); return true; });
  const a = normalizarChefe(velho.chefe && Object.assign({}, velho.chefe)), b = normalizarChefe(novo.chefe && Object.assign({}, novo.chefe));
  if (a && b && a.sem === b.sem && a.bloco === b.bloco) r.chefe = Object.assign({}, b, { vida: Math.min(a.vida, b.vida), vencido: b.vencido || a.vencido, item: b.item || a.item });
  // Chefões diferentes na mesma semana (cada aparelho sorteou um): fica o que já foi derrotado ou o mais ferido
  else if (a && b && a.sem === b.sem) r.chefe = a.vencido && !b.vencido ? a : b.vencido && !a.vencido ? b : a.vida / a.max < b.vida / b.max ? a : b;
  else if (a && b) r.chefe = a.sem > b.sem ? a : b;
  r.m = mesclarMapa(velho.m, novo.m, (x, y) => Object.assign({}, x, y, { ok: Object.assign({}, x.ok, y.ok), bau: x.bau || y.bau, item: y.item || x.item }));
  return r;
}
function mesclarDoc(n, nuvem, local, localNovo) {
  nuvem = nuvem || {}; local = local || {};
  const novo = localNovo ? local : nuvem, velho = localNovo ? nuvem : local;
  const num = (x) => Number(x) || 0;
  // Item: [nível, próxima, acertos, erros, último dia, ...]; card: [vence, intervalo, facilidade, repetições, lapsos, último dia]
  if (/^itens/.test(n)) return { q: mesclarMapa(nuvem.q, local.q, (a, b) => (num(b[4]) > num(a[4]) || (num(b[4]) === num(a[4]) && num(b[2]) + num(b[3]) > num(a[2]) + num(a[3])) ? b : a)) };
  if (n === 'cards') return { c: mesclarMapa(nuvem.c, local.c, (a, b) => (num(b[5]) > num(a[5]) || (num(b[5]) === num(a[5]) && num(b[3]) + num(b[4]) > num(a[3]) + num(a[4])) ? b : a)) };
  if (n === 'simulados') {
    const vistos = new Set(), lista = [];
    for (const s of (novo.lista || []).concat(velho.lista || [])) {
      const k = [s.data, s.titulo, s.n, s.c, s.e, s.b, s.seg].join('|');
      if (!vistos.has(k)) { vistos.add(k); lista.push(s); }
    }
    lista.sort((x, y) => (x.data < y.data ? 1 : x.data > y.data ? -1 : 0));
    return { lista };
  }
  if (n === 'pesquisa') return { p: mesclarMapa(velho.p, novo.p, (a, b) => b) };
  if (n === 'discursivas') return { d: mesclarMapa(velho.d, novo.d, (a, b) => ((a.tentativas || []).length > (b.tentativas || []).length ? a : b)) };
  const atividade = (d) => num(d && d.r) + num(d && d.k) + num(d && d.b);
  const p = Object.assign(perfilPadrao(), velho, novo);
  p.xp = Math.max(num(nuvem.xp), num(local.xp));
  p.saidos = Math.max(num(nuvem.saidos), num(local.saidos));
  p.melhorSeq = Math.max(num(nuvem.melhorSeq), num(local.melhorSeq));
  p.dias = mesclarMapa(nuvem.dias, local.dias, (a, b) => {
    const dia = atividade(b) > atividade(a) ? b : a;
    const t = mesclarMapa(a && a.t, b && b.t, (x, y) => Math.max(num(x), num(y)));
    return Object.keys(t).length ? Object.assign({}, dia, { t }) : dia;
  });
  p.conq = Object.assign({}, velho.conq, novo.conq);
  p.lidos = mesclarMapa(nuvem.lidos, local.lidos, (a, b) => (b < a ? b : a));
  p.recordes = mesclarMapa(nuvem.recordes, local.recordes, (a, b) => Math.max(num(a), num(b)));
  p.criado = [nuvem.criado, local.criado].filter(Boolean).sort()[0] || hojeISO();
  if (!p.ui && velho.ui) p.ui = velho.ui;
  p.rpg = mesclarRPG(velho.rpg, novo.rpg);
  return p;
}
// O banco entrega o documento congelado, inclusive por dentro: sem uma cópia, marcar artigo como lido, dar baixa num
// dia ou somar o tempo falharia (às vezes em silêncio) em tudo o que veio da conta
function lerDoc(s) {
  const d = s && s.exists ? s.data() : null;
  return d ? JSON.parse(JSON.stringify(d)) : null;
}
// O progresso fica no banco do Artifact (por usuário) e, sempre, também neste navegador.
// Na abertura, a cópia da conta e a deste navegador são mescladas (mesclarDoc): nenhuma apaga a outra.
const Store = {
  modo: 'local', dev: Math.random().toString(36).slice(2, 10), refs: {}, timer: {}, gravando: {}, fila: {}, ultimoT: {}, erro: null,
  // Partes do histórico de questões com resposta nova desde a última gravação; tamanho de cada documento enviado
  itensSujos: new Set(), tamanhos: {},
  // Quando cada documento mudou neste navegador; decide qual cópia manda no que liga e desliga (metas, status, preferências)
  tLocal: {},
  // Até a conta ser lida, nada do navegador conta como mais novo que ela: as mudanças ficam marcadas em "sujo"
  carregando: true, sujo: {}, localLido: false, localReal: false,
  diag: { claude: false, db: '—', user: '—', id: '—', leitura: '—', gravacao: '—', navegador: '—' },
  carregarLocal() {
    this.localLido = true;
    const l = lerLS(CHAVE_LOCAL);
    if (!l) return false;
    this.localReal = true;
    if (l.perfil) { S.perfil = Object.assign(perfilPadrao(), l.perfil); podarPerfil(); }
    if (l.itens) S.itens = l.itens;
    if (l.cards) S.cards = l.cards;
    if (l.simulados) S.simulados = l.simulados;
    if (l.pesquisa) S.pesquisa = l.pesquisa;
    if (l.disc) S.disc = l.disc;
    this.tLocal = l.t || {};
    return true;
  },
  guardarLocal() {
    // Antes de ler a cópia do navegador, gravar aqui apagaria o progresso guardado nele
    if (!this.localLido) return;
    const ok = gravarLS(CHAVE_LOCAL, { perfil: S.perfil, itens: S.itens, cards: S.cards, simulados: S.simulados, pesquisa: S.pesquisa, disc: S.disc, t: this.tLocal });
    this.diag.navegador = ok ? 'ok' : 'bloqueado';
  },
  dados(n) {
    if (n === 'perfil') return S.perfil;
    if (PARTES_ITENS.includes(n)) { const q = {}; for (const [id, r] of Object.entries(S.itens)) if (parteItem(id) === n) q[id] = r; return { q }; }
    if (n === 'cards') return { c: S.cards };
    if (n === 'simulados') return { lista: S.simulados };
    if (n === 'discursivas') return { d: S.disc };
    return { p: S.pesquisa };
  },
  definir(n, d) {
    if (n === 'perfil') { S.perfil = Object.assign(perfilPadrao(), d); podarPerfil(); aplicarPrefs(); }
    else if (PARTES_ITENS.includes(n)) {
      for (const id of Object.keys(S.itens)) if (parteItem(id) === n) delete S.itens[id];
      Object.assign(S.itens, (d && d.q) || {});
    }
    else if (n === 'cards') S.cards = d.c || {};
    else if (n === 'simulados') S.simulados = d.lista || [];
    else if (n === 'discursivas') S.disc = d.d || {};
    else S.pesquisa = d.p || {};
  },
  // Adota a cópia da conta inteira (outro aparelho gravou e aqui não há nada pendente)
  aplicar(n, corpo) {
    if (!corpo || !corpo.dados) return;
    if (corpo.t && this.ultimoT[n] && corpo.t <= this.ultimoT[n]) return;
    this.ultimoT[n] = corpo.t || Date.now();
    this.tLocal[n] = this.ultimoT[n];
    this.definir(n, corpo.dados);
    this.guardarLocal();
  },
  // Junta a cópia da conta com a deste navegador; se a junção tiver algo que a conta não tinha, grava de volta
  mesclar(n, corpo, localNovo) {
    if (!corpo || !corpo.dados) return;
    const antes = JSON.stringify(corpo.dados);
    this.ultimoT[n] = Math.max(this.ultimoT[n] || 0, corpo.t || 0);
    this.definir(n, mesclarDoc(n, corpo.dados, JSON.parse(JSON.stringify(this.dados(n))), localNovo));
    if (JSON.stringify(this.dados(n)) !== antes) { this.tLocal[n] = Date.now(); this.guardarLocal(); this.gravar(n); }
    else { this.tLocal[n] = corpo.t || this.tLocal[n]; this.guardarLocal(); }
  },
  async iniciar() {
    this.carregando = true;
    if (!this.localLido) this.carregarLocal();
    const c = window.claude;
    this.diag.claude = !!(c && typeof c.use === 'function');
    if (!this.diag.claude) return this.pronto();
    let db = null, user = null;
    try { db = await c.use('db'); this.diag.db = db ? 'ok' : 'indisponível'; } catch (e) { this.diag.db = 'erro ' + ((e && e.code) || ''); }
    try { user = await c.use('user'); this.diag.user = user ? 'ok' : 'indisponível'; } catch (e) { this.diag.user = 'erro ' + ((e && e.code) || ''); }
    if (!db || !user) return this.pronto();
    let uid = null;
    try { uid = await user.id(); } catch (e) { uid = null; }
    this.diag.id = uid ? 'ok' : 'sem identidade (entre na conta)';
    if (!uid) return this.pronto();
    try {
      this.db = db; this.uid = uid;
      const col = db.collection('data/users/' + uid);
      DOCS.forEach((n) => { this.refs[n] = col.doc(n); });
      const snaps = await Promise.all(DOCS.map((n) => this.refs[n].get()));
      this.diag.leitura = 'ok';
      this.modo = 'nuvem';
      if (!snaps.some((s) => s.exists)) DOCS.forEach((n) => this.gravar(n));
      else {
        // Zerar ou restaurar backup muda a "época" (perfil.ep): entre épocas diferentes vale a mais nova, inteira
        const epLocal = S.perfil.ep || 0;
        const docs = snaps.map(lerDoc), dp = docs[DOCS.indexOf('perfil')], epNuvem = (dp && dp.dados && dp.dados.ep) || 0;
        docs.forEach((d, i) => {
          const n = DOCS[i];
          if (epLocal > epNuvem) this.gravar(n);
          // Época mais nova na conta (zerou ou restaurou em outro aparelho): documento que lá não existe conta como vazio,
          // para o que é deste navegador, de antes, não voltar para a conta
          else if (epNuvem > epLocal) { if (d && d.dados) this.aplicar(n, d); else this.definir(n, {}); }
          else if (!d || !d.dados) this.gravar(n);
          else this.mesclar(n, d, this.localReal && !!this.tLocal[n] && !!d.t && this.tLocal[n] > d.t);
        });
      }
      DOCS.forEach((n) => {
        this.refs[n].onSnapshot((s) => {
          const d = lerDoc(s);
          if (!d || d.dev === this.dev) return;
          // Com gravação pendente aqui, junta as duas; sem nada pendente, adota a do outro aparelho
          if ((this.timer[n] || this.gravando[n]) && (d.ep || 0) === (S.perfil.ep || 0)) this.mesclar(n, d, true); else this.aplicar(n, d);
          renderTudo();
        }, (e) => { console.warn('assinatura encerrada', n, e && e.code); });
      });
    } catch (e) {
      console.warn('banco indisponível, usando o navegador', e);
      this.diag.leitura = 'erro ' + ((e && e.code) || '');
      this.modo = 'local';
    }
    this.pronto();
    enviarContestacoesPendentes();
  },
  // "itens" vira as partes com resposta nova (ou todas, se não se sabe quais mudaram)
  expandir(nomes) {
    const out = [];
    for (const n of nomes) {
      if (n !== 'itens') { out.push(n); continue; }
      out.push(...(this.itensSujos.size ? [...this.itensSujos] : PARTES_ITENS));
      this.itensSujos.clear();
    }
    return [...new Set(out)];
  },
  pronto() {
    this.carregando = false;
    // O que mudou enquanto a conta era lida já está mesclado em S: agora vale como mudança deste navegador
    const sujos = Object.keys(this.sujo);
    this.sujo = {};
    if (sujos.length) this.salvar(...sujos);
    // Primeira abertura com preferências na conta: leva as deste navegador
    if (!S.perfil.ui) salvarUI();
    renderTudo();
  },
  salvar(...nomes) {
    nomes = this.expandir(nomes);
    const agora = Date.now();
    for (const n of nomes) { if (this.carregando) this.sujo[n] = true; else this.tLocal[n] = agora; }
    this.guardarLocal();
    if (this.carregando) return;
    if (this.modo !== 'nuvem') return;
    for (const n of nomes) { clearTimeout(this.timer[n]); this.timer[n] = setTimeout(() => this.gravar(n), 1200); }
  },
  salvarTudo() { this.itensSujos.clear(); this.salvar(...DOCS); },
  descarregar() {
    if (this.modo !== 'nuvem') return;
    for (const n of DOCS) if (this.timer[n]) { clearTimeout(this.timer[n]); this.timer[n] = null; this.gravar(n); }
  },
  async gravar(n) {
    this.timer[n] = null;
    if (this.gravando[n]) { this.fila[n] = true; return; }
    const t = Date.now();
    const corpo = { dev: this.dev, t, v: 3, ep: S.perfil.ep || 0, dados: this.dados(n) };
    const tam = JSON.stringify(corpo).length;
    this.tamanhos[n] = tam;
    if (tam > LIMITE_DOC) {
      this.erro = 'documento ' + n + ' com ' + Math.round(tam / 1024) + ' KB, acima do limite da conta';
      this.diag.gravacao = 'erro: ' + this.erro;
      atualizarRodapeSync();
      return;
    }
    this.gravando[n] = true;
    try {
      await this.refs[n].set(corpo);
      this.ultimoT[n] = t;
      this.erro = null;
      this.diag.gravacao = 'ok';
    } catch (e) {
      this.erro = (e && e.code) || 'erro';
      this.diag.gravacao = 'erro ' + this.erro;
      if (e && ['invalid_argument', 'transform_error', 'revoked', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e.code)) this.modo = 'local';
      if (e && (e.code === 'unavailable' || e.code === 'resource_exhausted')) setTimeout(() => this.salvar(n), 3000 + Math.random() * 3000);
      atualizarRodapeSync();
    } finally {
      this.gravando[n] = false;
      if (this.fila[n]) { this.fila[n] = false; this.gravar(n); }
    }
  },
};

/* ================= Regras: questões ================= */
// Itens de português e inglês presos a um texto não voltam na revisão espaçada: rever o mesmo texto ensina o gabarito,
// não a leitura. No lugar deles, as sessões trazem textos inéditos. O erro continua contando nas estatísticas.
const SEM_REPETICAO = new Set(Q.filter((q) => q.ap != null && (BI.get(q.b) || {}).disciplina === 'linguas').map((q) => q.id));
function rec(id) { return S.itens[id]; }
function emRevisao(id) { const r = rec(id); return !!r && r[0] >= 0 && r[0] < 3 && !SEM_REPETICAO.has(id); }
function vencida(id) { const r = rec(id); return emRevisao(id) && r[1] <= HOJE(); }
function dominioItem(id) { const r = rec(id); return !r || r[0] < 0 ? 0 : Math.min(r[0], 5) / 5; }
function dominioBloco(bid) {
  const qs = POR_BLOCO.get(bid) || [];
  if (!qs.length) return null;
  return qs.reduce((s, q) => s + dominioItem(q.id), 0) / qs.length;
}
function dominadoVencido(id) { const r = rec(id); return !!r && r[0] >= 3 && r[1] <= HOJE() && !SEM_REPETICAO.has(id); }
function manutencaoFeitaHoje() { const d = S.perfil.dias[hojeISO()]; return (d && d.m) || 0; }
// Itens dominados vencidos que entram hoje (respeitando o limite diário), dos mais atrasados para os mais recentes
function manutencaoHoje() {
  const resta = Math.max(0, MANUTENCAO_DIA - manutencaoFeitaHoje());
  return resta ? Q.filter((q) => dominadoVencido(q.id)).sort((a, b) => rec(a.id)[1] - rec(b.id)[1]).slice(0, resta) : [];
}
function listaVencida() { return Q.filter((q) => vencida(q.id)).sort((a, b) => rec(a.id)[1] - rec(b.id)[1]); }
function nivelDe(xp) {
  let i = 0;
  while (i + 1 < NIVEIS.length && xp >= NIVEIS[i + 1][0]) i++;
  if (i === NIVEIS.length - 1) {
    const mandato = 1 + Math.floor((xp - NIVEIS[i][0]) / MANDATO_XP);
    const base = NIVEIS[i][0] + (mandato - 1) * MANDATO_XP;
    return { n: i + mandato, nome: NIVEIS[i][1] + (mandato > 1 ? ' · mandato ' + mandato : ''), base, prox: base + MANDATO_XP };
  }
  return { n: i + 1, nome: NIVEIS[i][1], base: NIVEIS[i][0], prox: NIVEIS[i + 1][0] };
}
function diaLog(iso) {
  iso = iso || hojeISO();
  if (!S.perfil.dias[iso]) S.perfil.dias[iso] = { r: 0, c: 0, e: 0, b: 0, xp: 0, k: 0, n: 0, a: [] };
  const d = S.perfil.dias[iso];
  if (d.k == null) d.k = 0;
  if (d.n == null) d.n = 0;
  if (!d.a) d.a = [];
  return d;
}
// Só a lista de artigos lidos de hoje é usada; as antigas saem para o documento do perfil não crescer sem limite
function podarPerfil() {
  // Marcas de migrações de versões antigas do app, que não existem mais
  delete S.perfil.migr; delete S.perfil.migrado;
  const limite = isoDeNum(HOJE() - 14);
  for (const [iso, d] of Object.entries(S.perfil.dias || {})) if (iso < limite && d.a && d.a.length) d.a = [];
}
function ativo(iso) { const d = S.perfil.dias[iso]; return !!d && (d.r + (d.k || 0) / 2) >= MIN_DIA_ATIVO; }

/* ================= Tempo de estudo ================= */
// O relógio do dia conta o tempo com o app aberto, visível e em uso. Sem toque, tecla ou rolagem por OCIOSO_S
// segundos (OCIOSO_LER_S na leitura, em que um artigo longo se lê sem tocar), ele para até o próximo toque. Cada
// intervalo vai para a atividade da tela: questões (sessões e simulados), cards, leitura (lei seca, artigo aberto,
// aula, trilhas, Como o Cebraspe cobra, glossário) e discursiva. O tempo no painel, no plano, no método e nos ajustes
// fica à parte ("o"), fora do total. Na leitura e na discursiva, um cronômetro na tela mostra o tempo do dia.
const OCIOSO_S = 180, OCIOSO_LER_S = 300, TIQUE_S = 15;
const ATIV = [['q', 'Questões'], ['c', 'Cards'], ['l', 'Leitura'], ['d', 'Discursiva']];
const LEITURA_MAIS = new Set(['trilha', 'cebraspe', 'glossario', 'pesquisar']);
let ultimoUso = Date.now(), ultimoTique = Date.now(), tempoNaoSalvo = 0;
function atividadeAtual() {
  // Artigo aberto na tela, aula, e o que se lê na folha (item revisado, termo, Investigar) são leitura, mesmo a partir
  // de um item da sessão
  const folha = document.getElementById('folha');
  if (UI.artInline || UI.folhaAula || (folha && !folha.hidden)) return 'l';
  // a tela de resultado da sessão (revisar os itens) também é questão
  if (sessao) return sessao.modo === 'cards' ? 'c' : 'q';
  if (UI.vista === 'lei') return 'l';
  if (UI.vista === 'mais') return UI.mais === 'discursiva' ? 'd' : LEITURA_MAIS.has(UI.mais) ? 'l' : 'o';
  return 'o';
}
function segundosEstudo(d) { const t = (d && d.t) || {}; return ATIV.reduce((s, [k]) => s + (Number(t[k]) || 0), 0); }
function fmtDur(seg) { const m = Math.floor((seg || 0) / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); }
// Duração prevista no plano para o dia ("1h45", "3h"); dia livre ou fora do plano não tem meta de tempo
function metaMin(iso) { const dia = DIAS.find((x) => x.data === iso); const m = dia && /^(\d+)h(\d+)?$/.exec(dia.duracao || ''); return m ? Number(m[1]) * 60 + Number(m[2] || 0) : null; }
function marcarUso() { ultimoUso = Date.now(); }
function ocioso(k, agora) { return agora - ultimoUso > (k === 'l' ? OCIOSO_LER_S : OCIOSO_S) * 1000; }
function fmtRelogio(seg) { const s = Math.floor(seg), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); }
// Cronômetro da leitura e da discursiva: o tempo do dia nessa atividade, correndo enquanto conta, ou pausado
function atualizarCronometro() {
  const el = document.getElementById('cronometro');
  if (!el) return;
  const k = atividadeAtual(), mostra = (k === 'l' || k === 'd') && !document.hidden;
  el.hidden = !mostra;
  if (!mostra) return;
  const agora = Date.now(), parado = ocioso(k, agora);
  const seg = ((((S.perfil.dias[hojeISO()] || {}).t) || {})[k] || 0) + (parado ? 0 : Math.min(agora - ultimoTique, (k === 'l' ? OCIOSO_LER_S : OCIOSO_S) * 1000) / 1000);
  el.classList.toggle('parado', parado);
  el.innerHTML = '<i aria-hidden="true"></i>' + (k === 'l' ? 'Leitura' : 'Discursiva') + ' hoje <b class="mono">' + fmtRelogio(seg) + '</b>' + (parado ? ' · pausado' : '');
}
// final: chamada ao esconder ou fechar a página, para gravar o pedaço do intervalo em curso
function contarTempo(final) {
  const agora = Date.now();
  const k = atividadeAtual();
  // Com uso recente, todo o intervalo desde o último tique conta, mesmo que o navegador tenha atrasado o relógio; o teto
  // é o próprio limite de ociosidade (um aparelho que dormiu não soma horas: sem toque recente, nada conta)
  const dt = Math.min(agora - ultimoTique, (k === 'l' ? OCIOSO_LER_S : OCIOSO_S) * 1000) / 1000;
  ultimoTique = agora;
  if ((document.hidden && !final) || ocioso(k, agora) || dt < 1) return;
  if (!S.perfil.tempoDesde) S.perfil.tempoDesde = hojeISO();
  const t = (diaLog().t ||= {});
  t[k] = Math.round((t[k] || 0) + dt);
  tempoNaoSalvo += dt;
  if (final || tempoNaoSalvo >= 60) { tempoNaoSalvo = 0; Store.salvar('perfil'); }
  atualizarRelogioDia();
}
function atualizarRelogioDia() {
  const el = document.getElementById('tempo-hoje');
  if (!el) return;
  const seg = segundosEstudo(S.perfil.dias[hojeISO()]), meta = metaMin(hojeISO());
  el.textContent = fmtDur(seg);
  const b = document.querySelector('#tempo-barra > i');
  if (b && meta) b.style.width = Math.min(100, Math.round((seg / 60 / meta) * 100)) + '%';
}
// Colunas empilhadas por atividade, uma por dia, na mesma escala; a linha tracejada marca a meta do plano
function colunasTempo(dias, alturaPx) {
  const max = Math.max(3600, ...dias.map(([iso, d]) => Math.max(segundosEstudo(d), (metaMin(iso) || 0) * 60)));
  const hoje = hojeISO();
  return dias.map(([iso, d]) => {
    const t = (d && d.t) || {}, seg = segundosEstudo(d), meta = metaMin(iso);
    const partes = ATIV.filter(([k]) => (t[k] || 0) >= 30).map(([k, nome]) => '<i style="height:' + Math.max(2, Math.round(((t[k] || 0) / max) * alturaPx)) + 'px;background:var(--at-' + k + ')"></i>').join('');
    const dica = fmtData(iso, { weekday: 'short', day: '2-digit', month: '2-digit' }) + ': ' + (seg ? fmtDur(seg) + ' (' + ATIV.filter(([k]) => (t[k] || 0) >= 60).map(([k, nome]) => nome.toLowerCase() + ' ' + fmtDur(t[k])).join(', ') + ')' : 'sem tempo registrado') + (meta ? ' · meta ' + fmtDur(meta * 60) : '');
    return '<div class="tempo-col' + (iso === hoje ? ' hoje' : '') + '" data-dica="' + esc(dica) + '"><div class="col" style="height:' + alturaPx + 'px">' +
      (meta ? '<b class="tempo-meta" style="bottom:' + Math.round(((meta * 60) / max) * alturaPx) + 'px"></b>' : '') + partes + '</div>' +
      '<span>' + esc(dias.length > 7 ? iso.slice(8) : fmtData(iso, { weekday: 'short' }).replace('.', '').slice(0, 3)) + '</span></div>';
  }).join('');
}
function legendaTempo(t) {
  return '<div class="tempo-legenda">' + ATIV.map(([k, nome]) => '<span class="tempo-leg"><i style="background:var(--at-' + k + ')"></i>' + nome + ' <b class="mono">' + fmtDur(t[k] || 0) + '</b></span>').join('') + '</div>';
}
function diasAte(n) { const h = HOJE(), out = []; for (let x = h - n + 1; x <= h; x++) { const iso = isoDeNum(x); out.push([iso, S.perfil.dias[iso] || null]); } return out; }
// Cartão do painel: tempo de hoje contra a meta do plano, por atividade, o que ele rendeu e os últimos sete dias
function cartaoTempo() {
  const h = hojeISO(), d = S.perfil.dias[h] || {}, t = d.t || {};
  const seg = segundosEstudo(d), meta = metaMin(h);
  const r = d.r || 0, tq = t.q || 0;
  const sem = diasAte(7), semSeg = sem.reduce((a, [, x]) => a + segundosEstudo(x), 0);
  const semDias = sem.filter(([, x]) => segundosEstudo(x) >= 600).length;
  const semMetas = sem.filter(([iso]) => metaMin(iso)), semOk = semMetas.filter(([iso, x]) => segundosEstudo(x) >= metaMin(iso) * 60).length;
  const met = (v, rot) => '<div><b class="mono">' + v + '</b><span>' + rot + '</span></div>';
  return '<div class="cartao"><div class="secao-cab"><h2>Tempo de estudo</h2><span class="mono pequeno mudo">' + (meta ? 'meta do plano ' + fmtDur(meta * 60) : 'dia sem meta no plano') + '</span></div>' +
    '<div class="tempo-topo"><span class="tempo-grande mono" id="tempo-hoje">' + fmtDur(seg) + '</span><span class="mudo">' + (meta ? (seg >= meta * 60 ? 'meta cumprida' : 'faltam ' + fmtDur(meta * 60 - seg)) : 'hoje') + '</span></div>' +
    (meta ? '<div class="barra" id="tempo-barra"><i style="width:' + Math.min(100, Math.round((seg / 60 / meta) * 100)) + '%"></i></div>' : '') +
    '<p class="pequeno mudo">Últimos 7 dias: <b>' + fmtDur(semSeg) + '</b> em ' + pl(semDias, 'dia', 'dias') + (semMetas.length ? ' · meta cumprida em ' + semOk + ' de ' + semMetas.length : '') + '.</p>' +
    '<details class="det-tempo" data-det="tempo"' + (UI.det.tempo ? ' open' : '') + '><summary>Detalhes de hoje e da semana</summary>' +
    (seg ? '<div class="tempo-pilha" role="img" aria-label="' + esc('Hoje por atividade: ' + ATIV.map(([k, nome]) => nome + ' ' + fmtDur(t[k] || 0)).join(', ')) + '">' + ATIV.filter(([k]) => (t[k] || 0) >= 30).map(([k, nome]) => '<i style="flex-grow:' + t[k] + ';background:var(--at-' + k + ')" data-dica="' + esc(nome + ': ' + fmtDur(t[k])) + '"></i>').join('') + '</div>' : '') +
    legendaTempo(t) +
    '<div class="estat tempo-estat">' + met(r, 'itens respondidos') + met(r ? pct(d.c || 0, r) + '%' : '—', 'de acerto') +
    met(tq >= 60 && r ? Math.round(tq / r) + ' s' : '—', 'por item') + met(tq >= 300 && r ? Math.round(r / (tq / 3600)) : '—', 'itens por hora') +
    met(d.k || 0, 'cards revisados') + met((d.a || []).length, 'artigos lidos') + '</div>' +
    '<div class="tempo-semana" role="img" aria-label="' + esc('Últimos 7 dias: ' + sem.map(([iso, x]) => fmtData(iso, { weekday: 'short' }) + ' ' + fmtDur(segundosEstudo(x))).join(', ')) + '">' + colunasTempo(sem, 64) + '</div>' +
    '<p class="pequeno mudo">' + (semDias ? 'Média de ' + fmtDur(semSeg / semDias) + ' por dia de estudo. ' : '') + 'Conta só o tempo com o app aberto e em uso; parado por ' + OCIOSO_S / 60 + ' minutos (' + OCIOSO_LER_S / 60 + ' na leitura), o relógio pausa.' + ((t.o || 0) >= 60 ? ' Hoje, mais ' + fmtDur(t.o) + ' no painel, no plano e nos ajustes, que não entram na conta.' : '') + ' <button class="linkish" data-acao="mais" data-sub="progresso">Histórico</button></p></details></div>';
}
// Progresso: 14 dias em colunas, resumo de 30 dias, divisão por atividade, ritmo e tabela dos últimos 7 dias
function cartaoTempoHistorico() {
  const d14 = diasAte(14), d30 = diasAte(30);
  const tot = { q: 0, c: 0, l: 0, d: 0 };
  let seg30 = 0, dias30 = 0, r30 = 0, tq30 = 0, metas = 0, metasOk = 0, melhor = null;
  for (const [iso, d] of d30) {
    const s = segundosEstudo(d), t = (d && d.t) || {};
    ATIV.forEach(([k]) => { tot[k] += Number(t[k]) || 0; });
    seg30 += s; if (s >= 600) dias30++;
    if ((t.q || 0) >= 60 && d.r) { r30 += d.r; tq30 += t.q; }
    const m = metaMin(iso);
    if (m && iso <= hojeISO()) { metas++; if (s >= m * 60) metasOk++; }
    if (s && (!melhor || s > melhor[1])) melhor = [iso, s];
  }
  const maxAt = Math.max(1, ...Object.values(tot));
  let html = '<div class="cartao"><div class="secao-cab"><h2>Tempo de estudo</h2><span class="mudo pequeno">Últimos 14 dias</span></div>' +
    '<div class="tempo-semana tempo-14" role="img" aria-label="Tempo de estudo por dia nos últimos 14 dias; os valores estão na tabela abaixo">' + colunasTempo(d14, 90) + '</div>' + legendaTempo(tot) +
    '<div class="estat">' +
    '<div><b class="mono">' + fmtDur(seg30) + '</b><span>em 30 dias</span></div>' +
    '<div><b class="mono">' + (dias30 ? fmtDur(seg30 / dias30) : '—') + '</b><span>média por dia de estudo</span></div>' +
    '<div><b class="mono">' + (metas ? metasOk + ' de ' + metas : '—') + '</b><span>metas de tempo cumpridas</span></div>' +
    '<div><b class="mono">' + (tq30 >= 600 ? Math.round(r30 / (tq30 / 3600)) : '—') + '</b><span>itens por hora (30 dias)</span></div>' +
    '<div><b class="mono">' + (tq30 >= 600 ? Math.round(tq30 / r30) + ' s' : '—') + '</b><span>por item (30 dias)</span></div>' +
    '<div><b class="mono">' + (melhor ? fmtDur(melhor[1]) : '—') + '</b><span>' + (melhor ? 'melhor dia (' + esc(fmtData(melhor[0], { day: '2-digit', month: '2-digit' })) + ')' : 'melhor dia') + '</span></div></div>' +
    '<div class="dominio">' + ATIV.map(([k, nome]) => '<div class="dom-linha"><span class="nome">' + nome + '</span>' + barra(tot[k] / maxAt, '', '--accent:var(--at-' + k + ')') + '<span class="val">' + pct(tot[k], seg30) + '%</span></div>').join('') + '</div>' +
    '<div class="tabela-env"><table class="tabela"><thead><tr><th>Dia</th><th>Tempo</th><th>Itens</th><th>Acerto</th><th>Cards</th></tr></thead><tbody>' +
    diasAte(7).reverse().map(([iso, d]) => '<tr><td>' + esc(fmtData(iso, { weekday: 'short', day: '2-digit', month: '2-digit' })) + '</td><td class="mono">' + fmtDur(segundosEstudo(d)) + (metaMin(iso) ? ' / ' + fmtDur(metaMin(iso) * 60) : '') + '</td><td class="mono">' + ((d && d.r) || 0) + '</td><td class="mono">' + (d && d.r ? pct(d.c, d.r) + '%' : '—') + '</td><td class="mono">' + ((d && d.k) || 0) + '</td></tr>').join('') +
    '</tbody></table></div>' +
    '<p class="pequeno mudo">' + (S.perfil.tempoDesde ? 'O relógio conta desde ' + esc(fmtData(S.perfil.tempoDesde, { day: '2-digit', month: '2-digit', year: 'numeric' })) + '. ' : '') + 'Itens por hora e tempo por item medem só o tempo em sessões de questões. Painel, plano e ajustes não entram no total.</p></div>';
  return html;
}
// Dias seguidos de estudo. Domingo não quebra, e cada semana (de segunda a sábado) tem uma folga: um dia sem estudo
// não zera a sequência, para um imprevisto não apagar semanas de constância. O dia de folga não conta como estudado.
function sequencia() {
  let n = 0, dia = HOJE();
  if (!ativo(isoDeNum(dia))) dia--;
  const folgas = new Set();
  for (let k = 0; k < 800; k++) {
    const iso = isoDeNum(dia);
    if (ativo(iso)) n++;
    else if (diaSemana(iso) !== 0) {
      const semana = dia - ((diaSemana(iso) + 6) % 7);
      if (folgas.has(semana)) break;
      folgas.add(semana);
    }
    dia--;
  }
  return n;
}
function totais() {
  let r = 0, c = 0, e = 0, b = 0, k = 0;
  for (const d of Object.values(S.perfil.dias)) { r += d.r; c += d.c; e += d.e; b += d.b || 0; k += d.k || 0; }
  return { r, c, e, b, k };
}
function xpAcerto(q, combo, modo) {
  let x = 8 + 2 * (q.d || 2);
  if (modo === 'revisao') x += 4;
  if (modo === 'relampago') x = 6;
  // A sequência de acertos só multiplica XP no relâmpago; no treino e na revisão o que vale é ler o comentário, não correr
  return modo === 'relampago' ? Math.round(x * (1 + Math.min(combo, 10) * 0.05)) : x;
}
// Intervalo adaptativo. A escada INTERVALOS é a base, e dois fatores a ajustam a partir do nível 2:
// - o do item: erros e acertos com dúvida encurtam; acertos seguros repetidos alongam (como a facilidade do Anki);
// - o da pessoa: a retenção medida nas revisões de manutenção dos últimos 30 dias calibra todos os intervalos para
//   mirar 90% de lembrança. Com esquecimento exponencial, R = e^(−t/S), o intervalo que dá a retenção-alvo é
//   t × ln(0,9) ÷ ln(R medida). Abaixo de 20 revisões medidas, o fator fica neutro.
//   Só contam as revisões feitas até 1,5 vez o intervalo programado: com o teto diário de manutenção, muitos itens
//   voltam atrasados, e o esquecimento maior desses atrasos puxaria todos os intervalos para baixo (na simulação, o
//   fator ia ao piso de 0,7 e o atraso crescia).
// Os níveis 0 e 1 (erro recente) não mudam: rever logo o erro é o que mais rende.
const RETENCAO_ALVO = 0.9;
function fatorItem(r) {
  const erros = Math.min(r[3] || 0, 4), duvidas = Math.min((r[5] || 0) + (r[6] || 0), 3), seguros = Math.max(0, (r[2] || 0) - (r[5] || 0) - 1);
  return Math.max(0.5, Math.min(1.3, 1 - 0.12 * erros - 0.08 * duvidas + 0.06 * Math.min(seguros, 5)));
}
function retencaoMedida() {
  const hoje = HOJE();
  let m = 0, mc = 0;
  for (const [iso, d] of Object.entries(S.perfil.dias || {})) if (hoje - diaNum(iso) <= 30) { m += d.mp || 0; mc += d.mpc || 0; }
  return { m, mc, ret: m ? mc / m : null, calibra: m >= 20 };
}
function fatorPessoa() {
  const x = retencaoMedida();
  if (!x.calibra) return 1;
  const ret = Math.max(0.5, Math.min(0.99, x.ret));
  return Math.max(0.7, Math.min(1.5, Math.log(RETENCAO_ALVO) / Math.log(ret)));
}
function intervalo(r) {
  const base = INTERVALOS[r[0]];
  return r[0] < 2 ? base : Math.max(1, Math.round(base * fatorItem(r) * fatorPessoa()));
}
function registrar(q, resp, duvida) {
  golpeRecente = null;
  const hoje = HOJE();
  const r = S.itens[q.id] ? S.itens[q.id].slice() : [-1, 0, 0, 0, 0, 0, 0];
  const antes = r[0];
  const estavaNaLista = antes >= 0 && antes < 3 && !SEM_REPETICAO.has(q.id);
  const eraManutencao = antes >= 3 && r[1] <= hoje;
  const pontual = eraManutencao && hoje - r[4] <= 1.5 * Math.max(1, r[1] - r[4]);
  // Responder de novo no mesmo dia não é revisão espaçada: o acerto repetido não sobe de nível
  const jaRespondidoHoje = antes >= 0 && r[4] === hoje;
  let ok = null;
  if (resp === BRANCO) r[0] = 0;
  else {
    ok = resp === q.g;
    if (antes < 0) r[7] = ok ? 1 : 0;
    if (ok) {
      r[2]++;
      if (antes < 0) r[0] = duvida ? 2 : 4;
      else if (duvida) r[0] = Math.max(1, Math.min(antes, 2));
      else r[0] = jaRespondidoHoje ? Math.max(1, antes) : Math.min(5, antes + 1);
      if (duvida) r[5]++;
    } else { r[3]++; r[0] = 0; if (duvida) r[6]++; }
  }
  r[1] = hoje + intervalo(r);
  r[4] = hoje;
  S.itens[q.id] = r;
  Store.itensSujos.add(parteItem(q.id));
  if (estavaNaLista && r[0] >= 3) S.perfil.saidos = (S.perfil.saidos || 0) + 1;
  const d = diaLog();
  if (resp === BRANCO) d.b = (d.b || 0) + 1; else { d.r++; if (ok) d.c++; else d.e++; }
  if (antes < 0 && resp !== BRANCO) d.ni = (d.ni || 0) + 1;
  if (ok) golpeChefe(q);
  if (eraManutencao) { d.m = (d.m || 0) + 1; if (ok && !duvida) d.mc = (d.mc || 0) + 1; }
  if (pontual) { d.mp = (d.mp || 0) + 1; if (ok && !duvida) d.mpc = (d.mpc || 0) + 1; }
  if (ok === false) sugerirPesquisaDoErro(q);
  return ok;
}
function ganharXP(x) {
  if (!x) return;
  const antes = nivelDe(S.perfil.xp).n;
  S.perfil.xp += x;
  diaLog().xp += x;
  const depois = nivelDe(S.perfil.xp);
  if (depois.n > antes) { avisar('N' + depois.n, 'Subiu de nível', depois.nome); tocar('festa'); }
}
function verificarMeta() {
  const d = diaLog();
  if (!d.metaOk && d.r >= S.perfil.meta) { d.metaOk = 1; ganharXP(50); avisar('M', 'Meta do dia cumprida', '+50 XP de bônus'); conquistar('meta'); }
  verificarRPG();
}
function conquistar(id) {
  if (S.perfil.conq[id]) return;
  S.perfil.conq[id] = hojeISO();
  const c = CONQ.find((x) => x.id === id);
  if (c) avisar(c.ic, 'Conquista: ' + c.nome, c.desc);
}
function verificarConquistas(ctx) {
  ctx = ctx || {};
  const tem = (id) => !!S.perfil.conq[id];
  const se = (cond, id) => { if (cond) conquistar(id); };
  const t = totais();
  se(t.r >= 1, 'primeira'); se(t.r >= 100, 'r100'); se(t.r >= 500, 'r500'); se(t.r >= 1000, 'r1000'); se(t.r >= 2500, 'r2500'); se(t.r >= 5000, 'r5000');
  se(t.k >= 50, 'cards50'); se(t.k >= 300, 'cards300'); se(t.k >= 1000, 'cards1000');
  const combo = S.perfil.recordes.combo || 0;
  se(combo >= 10, 'combo10'); se(combo >= 25, 'combo25'); se(combo >= 50, 'combo50');
  const relampago = S.perfil.recordes.relampago || 0;
  se(relampago >= 15, 'relampago15'); se(relampago >= 25, 'relampago25');
  const seq = sequencia();
  if (seq > (S.perfil.melhorSeq || 0)) S.perfil.melhorSeq = seq;
  se(seq >= 7, 'seq7'); se(seq >= 14, 'seq14'); se(seq >= 30, 'seq30'); se(seq >= 60, 'seq60'); se(seq >= 100, 'seq100');
  // Dias: estudo, meta, recordes do dia, manutenção, roteiro, recuperação e tempo
  let ativos = 0, metas = 0, manut = 0, roteiros = 0, seg = 0;
  for (const [iso, d] of Object.entries(S.perfil.dias)) {
    if (ativo(iso)) ativos++;
    if (d.metaOk) metas++;
    manut += d.m || 0;
    if (d.rt) roteiros++;
    if (d.pd) conquistar('recuperacao');
    if (d.r >= 100) conquistar('maratona');
    if (d.r >= 30 && d.c / d.r >= 0.9) conquistar('certeiro');
    const s = segundosEstudo(d);
    seg += s;
    se(s >= 3600, 'hora1'); se(s >= 3 * 3600, 'hora3');
    // Domingo estudado com o sábado anterior também estudado
    if (!tem('fds') && diaSemana(iso) === 0 && ativo(iso) && ativo(isoDeNum(diaNum(iso) - 1))) conquistar('fds');
  }
  se(ativos >= 30, 'dias30'); se(ativos >= 100, 'dias100');
  se(metas >= 10, 'meta10'); se(metas >= 50, 'meta50');
  se(manut >= 50, 'memoria50'); se(roteiros >= 7, 'roteiro7'); se(seg >= 100 * 3600, 'horas100');
  se(S.simulados.length >= 1, 'sim1'); se(S.simulados.length >= 5, 'sim5');
  se(S.simulados.some((s) => s.n >= 30 && s.liq / s.n >= 0.7), 'sim70');
  se(S.simulados.some((s) => s.n >= 30 && s.liq / s.n >= 0.8), 'sim80');
  se(S.simulados.some((s) => s.n >= 120), 'prova120');
  const lidos = Object.keys(S.perfil.lidos || {}).length;
  se(lidos >= 20, 'lei20'); se(lidos >= 100, 'lei100'); se(lidos >= 500, 'lei500');
  if (!tem('leitodas') && ARTS.length && ARTS.every((a) => (S.perfil.lidos || {})[a.k])) conquistar('leitodas');
  const saidos = S.perfil.saidos || 0;
  se(saidos >= 25, 'lista25'); se(saidos >= 100, 'lista100'); se(saidos >= 300, 'lista300');
  const pesq = Object.values(S.pesquisa).filter((p) => p.s).length;
  se(pesq >= 10, 'pesq10'); se(pesq >= 30, 'pesq30');
  se((S.perfil.recordes.ex || 0) >= 5, 'explicar5');
  // Histórico das questões: dúvidas marcadas, itens diferentes, reais, múltipla escolha e domínio dos difíceis
  let duv = 0, vistos = 0, reais = 0, me = 0, dificeis = 0;
  for (const [id, r] of Object.entries(S.itens)) {
    duv += (r[5] || 0) + (r[6] || 0);
    if (r[0] < 0) continue;
    vistos++;
    const q = QI.get(id);
    if (!q) continue;
    if (q.o) reais++;
    if (q.al) me++;
    if (q.d === 3 && r[0] >= 3) dificeis++;
  }
  se(duv >= 20, 'calibrado'); se(vistos >= Math.ceil(Q.length / 2), 'metade');
  se(reais >= 50, 'reais50'); se(reais >= 300, 'reais300'); se(me >= 20, 'me20'); se(dificeis >= 50, 'casca');
  if (!tem('blocos20')) {
    const fortes = BLOCOS.filter((b) => (dominioBloco(b.id) || 0) >= 0.8).length;
    se(fortes >= 1, 'bloco80'); se(fortes >= 5, 'blocos5'); se(fortes >= 20, 'blocos20');
  }
  if (!tem('p1') && P1.every((b) => (dominioBloco(b) || 0) >= 0.6)) conquistar('p1');
  if (!tem('disciplina') && DISC.some((d) => dominioDisciplina(d.id) >= 0.7)) conquistar('disciplina');
  if (!tem('trilha')) {
    for (const tr of TRILHAS) {
      const sts = tr.subtemas.map((st) => estadoSubtema(st.id)).filter((e) => e.n), dom = sts.filter((e) => e.status === 'dominado').length;
      se(dom >= 1, 'subtema'); se(sts.length && dom === sts.length, 'trilha');
    }
  }
  // Discursivas: tentativas salvas e a melhor fração da nota
  let tent = 0, melhor = 0;
  for (const [id, st] of Object.entries(S.disc)) {
    const tema = TEMAS_DISC.find((x) => x.id === id);
    for (const x of st.tentativas || []) { tent++; if (tema && tema.pontos) melhor = Math.max(melhor, x.nq / tema.pontos); }
  }
  se(tent >= 1, 'disc1'); se(tent >= 5, 'disc5'); se(melhor >= 0.7, 'discnota');
  se(CONTEST.length >= 1, 'lince');
  // Jornada: baús, chefões, saque e nível
  const r = rpg();
  const baus = Math.max(r.baus || 0, Object.values(r.m || {}).filter((x) => x && x.bau).length);
  se(baus >= 1, 'bau1'); se(baus >= 7, 'bau7'); se(baus >= 30, 'bau30');
  const trofeus = (r.trofeus || []).length;
  se(trofeus >= 1, 'chefe1'); se(trofeus >= 5, 'chefe5'); se(trofeus >= 10, 'chefe10');
  se(ITENS_RPG.some((it) => it.rar === 'lendario' && r.inv[it.id]), 'lendario');
  se(Object.keys(ENCAIXES).every((sl) => equipado(sl)), 'equipado');
  se(ITENS_RPG.every((it) => r.inv[it.id]), 'colecao');
  const nv = nivelDe(S.perfil.xp).n;
  se(nv >= 10, 'nivel10'); se(nv >= 20, 'nivel20'); se(nv >= 30, 'nivel30');
  if (ctx.respondeu) {
    const h = new Date().getHours();
    se(h >= 23, 'coruja'); se(h >= 4 && h < 7, 'madrugador');
  }
  const rt = roteiroHoje();
  if (rt && rt.passos.every((p) => p.feito) && (S.perfil.dias[hojeISO()] || {}).r > 0) { diaLog().rt = 1; conquistar('roteiro'); }
}

/* ================= Regras: cards (estilo Anki) ================= */
// Estado do card: [vence, intervalo, facilidade×100, repetições, lapsos, último dia]
function cardNovo(id) { return !S.cards[id]; }
function cardVencido(id) { const r = S.cards[id]; return !!r && r[0] <= HOJE(); }
function calcularCard(id, nota) {
  const r = S.cards[id];
  let ivl, ease, reps, lapses;
  if (!r) {
    ivl = { 1: 0, 2: 1, 3: 1, 4: 4 }[nota];
    ease = 250 + (nota === 4 ? 15 : 0) - (nota === 2 ? 15 : 0) - (nota === 1 ? 20 : 0);
    reps = nota > 1 ? 1 : 0;
    lapses = 0;
  } else {
    [, ivl, ease, reps, lapses] = r;
    if (nota === 1) { lapses++; ease = Math.max(130, ease - 20); ivl = 0; reps = 0; }
    else if (nota === 2) { ease = Math.max(130, ease - 15); ivl = Math.max(1, Math.round(Math.max(ivl, 1) * 1.2)); reps++; }
    else if (nota === 3) { ivl = ivl < 1 ? 1 : Math.max(ivl + 1, Math.round((ivl * ease) / 100)); reps++; }
    else { ease += 15; ivl = ivl < 1 ? 3 : Math.max(ivl + 2, Math.round(((ivl * ease) / 100) * 1.3)); reps++; }
  }
  // "Errei" (intervalo 0) volta no fim da própria sessão e, depois, amanhã
  return [HOJE() + Math.max(1, ivl), ivl, ease, reps, lapses, HOJE()];
}
function avaliarCard(id, nota) {
  const novo = cardNovo(id);
  S.cards[id] = calcularCard(id, nota);
  const d = diaLog();
  d.k = (d.k || 0) + 1;
  if (novo) d.n = (d.n || 0) + 1;
  verificarRPG();
  return novo;
}
function cardsVencidos(blocos) {
  const set = blocos && blocos.length ? new Set(blocos) : null;
  return CARDS.filter((c) => (!set || set.has(c.nota.b)) && cardVencido(c.id)).sort((a, b) => S.cards[a.id][0] - S.cards[b.id][0]);
}
function cardsNovos(blocos) {
  const set = blocos && blocos.length ? new Set(blocos) : null;
  return CARDS.filter((c) => (!set || set.has(c.nota.b)) && cardNovo(c.id));
}
function novosRestantesHoje() { return Math.max(0, (S.perfil.novosCards || 20) - (diaLog().n || 0)); }

/* ================= Pesquisa e glossário ================= */
function termosDe(texto, limite, maxFreq) {
  const achados = [];
  for (const g of GLOSS) {
    if (g.j || (maxFreq != null && g.f > maxFreq)) continue;
    const m = g.re.exec(texto);
    if (m) achados.push({ g, i: m.index, len: m[0].length });
  }
  achados.sort((a, b) => a.g.f - b.g.f);
  return limite ? achados.slice(0, limite) : achados;
}
function marcarTermos(texto, max) {
  // Envolve a primeira ocorrência de até `max` termos do glossário num botão; o resto é escapado.
  const achados = termosDe(texto, null, 0.2);
  const usados = [];
  for (const a of achados) {
    if (usados.length >= max) break;
    if (usados.some((u) => a.i < u.i + u.len && u.i < a.i + a.len)) continue;
    usados.push(a);
  }
  usados.sort((a, b) => a.i - b.i);
  let html = '', pos = 0;
  for (const u of usados) {
    html += esc(texto.slice(pos, u.i)) + '<button class="termo" data-acao="termo" data-t="' + u.g.i + '">' + esc(texto.slice(u.i, u.i + u.len)) + '</button>';
    pos = u.i + u.len;
  }
  return html + esc(texto.slice(pos));
}
function chavePesq(t) { return semAcento(t).replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 120); }
function addPesquisa(t, origem, silencioso) {
  const k = chavePesq(t);
  if (!k || S.pesquisa[k]) return false;
  S.pesquisa[k] = { t, o: origem || '', s: 0, d: hojeISO() };
  Store.salvar('pesquisa');
  if (!silencioso) avisar('+', 'Na sua lista de pesquisa', t);
  return true;
}
function sugerirPesquisaDoErro(q) {
  termosDe(q.e + ' ' + q.c, 2, 0.2).forEach((a) => addPesquisa(a.g.t, 'erro em ' + q.id, true));
  (q.p || []).forEach((p) => addPesquisa(p, 'erro em ' + q.id, true));
}

/* ================= Seleção de itens ================= */
function poolDe(blocos) {
  const disp = (blocos || []).filter((b) => (POR_BLOCO.get(b) || []).length);
  if (!disp.length) return Q.slice();
  const set = new Set(disp);
  return Q.filter((q) => set.has(q.b));
}
function selecionar(pool, n, filtro) {
  const hoje = HOJE();
  const venc = [], novas = [], lista = [], domV = [], resto = [];
  for (const q of pool) {
    const r = rec(q.id);
    if (!r || r[0] < 0) novas.push(q);
    else if (SEM_REPETICAO.has(q.id)) resto.push(q);
    else if (r[0] < 3 && r[1] <= hoje) venc.push(q);
    else if (r[0] < 3) lista.push(q);
    else if (r[1] <= hoje) domV.push(q);
    else resto.push(q);
  }
  embaralhar(venc); embaralhar(novas); embaralhar(lista);
  domV.sort((a, b) => rec(a.id)[1] - rec(b.id)[1]);
  resto.sort((a, b) => rec(a.id)[1] - rec(b.id)[1]);
  // Itens dominados que venceram: até um quarto da sessão, antes das inéditas (revisão espaçada intercalada)
  const cota = Math.ceil(n / 4);
  let ordem;
  if (filtro === 'novas') ordem = novas.concat(venc, domV, lista, resto);
  else if (filtro === 'erradas') ordem = pool.filter((q) => { const r = rec(q.id); return r && r[3] > 0 && !SEM_REPETICAO.has(q.id); }).sort((a, b) => rec(b.id)[3] - rec(a.id)[3]);
  else ordem = venc.concat(domV.slice(0, cota), novas, lista, domV.slice(cota), resto);
  return embaralhar(ordem.slice(0, n));
}
function selecionarProva(n) {
  const escolhidos = [];
  const usados = new Set();
  for (const [parte, disc, k] of cotasProva(n)) {
    const pool = Q.filter((q) => { const b = BI.get(q.b); return b && b.disciplina === disc && parteProva(q) === parte && !q.al; });
    // Metade da fatia vem de itens reais inéditos, que medem o nível da banca melhor que os escritos para o banco.
    // Depois agrupa por texto dentro da fatia: os irmãos do mesmo texto são da mesma disciplina, e a cota não muda; como
    // os irmãos de um item real também são reais, a parte real pode passar da metade.
    const reais = embaralhar(pool.filter((q) => q.o && inedito(q))).slice(0, Math.ceil(k / 2));
    const sorteio = reais.concat(selecionar(pool.filter((q) => !reais.includes(q)), Math.min(pool.length, k) - reais.length, 'novas'));
    emBlocosDeTexto(sorteio, true, null).forEach((q) => { if (!usados.has(q.id)) { escolhidos.push(q); usados.add(q.id); } });
  }
  if (escolhidos.length < n) selecionar(Q.filter((q) => !usados.has(q.id) && !q.al), n - escolhidos.length, 'novas').forEach((q) => escolhidos.push(q));
  return embaralhar(escolhidos.slice(0, n));
}

function inedito(q) { const r = rec(q.id); return !r || r[0] < 0; }
// Itens reais certo/errado ainda não respondidos, repartidos pelo peso de cada disciplina na nota
function selecionarReais(n) {
  const livres = embaralhar(REAIS.filter((q) => !q.al && inedito(q)));
  const porD = new Map();
  for (const q of livres) { const d = (BI.get(q.b) || {}).disciplina; if (!porD.has(d)) porD.set(d, []); porD.get(d).push(q); }
  const base = Object.entries(PONTOS_DISC).map(([d, w]) => { const x = (n * w) / PONTOS_PROVA; return [d, Math.floor(x), x - Math.floor(x)]; });
  let falta = n - base.reduce((a, b) => a + b[1], 0);
  base.slice().sort((a, b) => b[2] - a[2]).forEach((b) => { if (falta > 0) { b[1]++; falta--; } });
  const out = [];
  for (const [d, k] of base) out.push(...(porD.get(d) || []).slice(0, k));
  if (out.length < n) out.push(...livres.filter((q) => !out.includes(q)).slice(0, n - out.length));
  return embaralhar(out);
}
// Blocos já vistos no cronograma (dias anteriores a hoje), fora as básicas
function blocosEstudados() {
  const h = hojeISO();
  return [...new Set(DIAS.filter((d) => d.data < h).flatMap((d) => d.blocos || []))].filter((b) => !BLOCOS_BASICOS.includes(b) && (POR_BLOCO.get(b) || []).length);
}
// Metade das matérias básicas, metade dos blocos já estudados, tudo misturado
function selecionarIntercaladas(n) {
  const estudados = new Set(blocosEstudados());
  const basicas = new Set(BLOCOS_BASICOS);
  const poolB = Q.filter((q) => basicas.has(q.b));
  const poolE = Q.filter((q) => estudados.has(q.b));
  const a = selecionar(poolB, poolE.length ? Math.ceil(n / 2) : n, 'mistas');
  const usados = new Set(a.map((q) => q.id));
  const b = poolE.length ? selecionar(poolE.filter((q) => !usados.has(q.id)), n - a.length, 'mistas') : [];
  return embaralhar(a.concat(b));
}
// Tamanho das intercaladas: o escolhido em Ajustes, menor em dia pesado (até o mínimo de 10)
// Em dia de 1h45 do plano, as intercaladas ficam em no máximo 20, para o dia caber no tempo
function nIntercaladas() {
  const ctx = contextoHoje();
  const curto = ctx.tipo === 'dia' && ctx.dia && ctx.dia.duracao === '1h45';
  const escolha = S.perfil.intercaladas == null ? 30 : S.perfil.intercaladas;
  const base = curto ? Math.min(escolha, 20) : escolha;
  const excesso = listaVencida().length - REVISOES_DIA_PESADO;
  return excesso > 0 ? Math.max(Math.min(10, base), base - Math.ceil(excesso / 2)) : base;
}

/* ================= Sessões ================= */
let relogioTimer = null;
// Como na prova, os itens do mesmo texto de apoio vêm em sequência, na ordem do caderno. Em sessões montadas pelo app,
// o bloco é completado com itens irmãos ainda não vistos (até 5 por texto), e saem itens inéditos sem texto para manter o tamanho.
const POR_APOIO = agrupar(Q.filter((q) => q.ap != null), (q) => q.ap);
const ORDEM_Q = new Map(Q.map((q, i) => [q.id, i]));
// Em sessão de blocos escolhidos (o dia do plano, a recuperação, a batalha), os itens irmãos do mesmo texto só vêm
// desses blocos: na batalha, todo acerto tem de ser golpe no chefão
function emBlocosDeTexto(itens, puxar, soBlocos) {
  const usados = new Set(itens.map((q) => q.id));
  const irmaos = (ap, k) => {
    const extra = (POR_APOIO.get(ap) || []).filter((x) => !usados.has(x.id) && !rec(x.id) && (!soBlocos || soBlocos.has(x.b))).slice(0, Math.max(0, k));
    extra.forEach((x) => usados.add(x.id));
    return extra;
  };
  const doCaderno = (g) => g.sort((a, b) => ORDEM_Q.get(a.id) - ORDEM_Q.get(b.id));
  const ordemTextos = [...new Set(itens.filter((q) => q.ap != null).map((q) => q.ap))];
  const blocos = new Map();
  if (!puxar) {
    for (const ap of ordemTextos) blocos.set(ap, doCaderno(itens.filter((q) => q.ap === ap)));
  } else {
    // Poucos textos com vários itens cada, como no caderno: blocos de 3 a 5 itens (ou o que o texto tiver),
    // até 40% da sessão. Itens já vistos de outros textos continuam (são revisão); os inéditos excedentes saem.
    const nSemTexto = itens.filter((q) => q.ap == null).length;
    const teto = Math.max(Math.round(itens.length * 0.4), itens.length - nSemTexto);
    let total = 0;
    for (const ap of ordemTextos) {
      let g = itens.filter((q) => q.ap === ap);
      const vistos = g.filter((q) => rec(q.id));
      if (total >= teto) { if (vistos.length) { blocos.set(ap, doCaderno(vistos)); total += vistos.length; } continue; }
      if (g.length < 3) g = g.concat(irmaos(ap, Math.min(5, teto - total) - g.length));
      const cabe = Math.max(vistos.length, teto - total);
      if (g.length > cabe) g = vistos.concat(g.filter((q) => !rec(q.id)).slice(0, cabe - vistos.length));
      blocos.set(ap, doCaderno(g));
      total += g.length;
    }
    // Itens sem texto preenchem o resto, revisões primeiro
    const semTexto = itens.filter((q) => q.ap == null);
    const vagas = Math.max(0, itens.length - total);
    const ficam = new Set(semTexto.filter((q) => rec(q.id)).concat(semTexto.filter((q) => !rec(q.id))).slice(0, Math.max(vagas, semTexto.filter((q) => rec(q.id)).length)).map((q) => q.id));
    itens = itens.filter((q) => (q.ap == null ? ficam.has(q.id) : blocos.has(q.ap)));
  }
  const feitos = new Set();
  const out = [];
  for (const q of itens) {
    if (q.ap == null) { out.push(q); continue; }
    if (feitos.has(q.ap) || !blocos.has(q.ap)) continue;
    feitos.add(q.ap);
    out.push(...blocos.get(q.ap));
  }
  return out;
}
// Sessão interrompida: treino, revisão e simulado ficam guardados no perfil (que vai para a conta) e continuam de onde
// pararam, mesmo depois de fechar o app ou trocar de aparelho. O relâmpago recomeça (é um jogo de 90 s) e os cards não
// precisam (cada avaliação já fica salva). A chave diz de onde a sessão veio: o dia do plano, a rodada de intercaladas, o
// subtema da trilha, o artigo, a disciplina dos itens reais. Quem entra de novo pela mesma porta continua. Sessões montadas
// na hora (aba Questões, refazer erros, termo do glossário) ganham chave própria e continuam pela lista de sessões
// guardadas. No simulado ficam também as marcações e o tempo gasto; o relógio para enquanto a sessão está guardada.
// Pausas com mais de 7 dias caducam, e ficam no máximo as 8 mais recentes.
const PAUSA_DIAS = 7, PAUSA_MAX = 8;
const MODOS_PAUSA = new Set(['treino', 'revisao', 'simulado']);
function chavePausa(s) { return s && MODOS_PAUSA.has(s.modo) ? s.chave || null : null; }
function pausaDe(k) {
  const p = k && S.perfil.pausas && S.perfil.pausas[k];
  if (!p || !Array.isArray(p.ids) || !p.data || HOJE() - diaNum(p.data) > PAUSA_DIAS) return null;
  const ids = p.ids.filter((id) => QI.has(id) && (p.modo !== 'revisao' || vencida(id) || dominadoVencido(id)));
  if (!ids.length) return null;
  const x = Object.assign({}, p, { ids });
  if (p.modo === 'simulado') x.resp = Object.fromEntries(Object.entries(p.resp || {}).filter(([id]) => QI.has(id)));
  return x;
}
function pausasVivas() {
  return Object.keys(S.perfil.pausas || {}).map((k) => [k, pausaDe(k)]).filter(([, p]) => p).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
}
function resumoPausa(p) {
  if (p.modo === 'simulado') return Object.keys(p.resp || {}).length + ' de ' + p.ids.length + ' marcados · ' + fmtTempo(p.gasto || 0) + ' de prova';
  return 'faltam ' + p.ids.length + ' de ' + p.total;
}
function atualizarPausa() {
  const k = chavePausa(sessao);
  if (!k) return;
  const pausas = (S.perfil.pausas ||= {});
  const sim = sessao.modo === 'simulado';
  const faltam = sessao.ids.filter((id) => !sessao.resp[id]);
  if (sessao.fim || sessao.desfecho || (!sim && !faltam.length)) delete pausas[k];
  else {
    pausas[k] = Object.assign({ modo: sessao.modo, titulo: sessao.titulo, dia: sessao.dia, data: hojeISO(), ts: Date.now() }, sim
      ? { ids: sessao.ids, resp: sessao.resp, duv: sessao.duv, i: sessao.i, gasto: Math.round(decorrido()), limite: sessao.limite, total: sessao.ids.length, prova: sessao.prova || undefined }
      : { ids: faltam, feitas: (sessao.feitasAntes || 0) + sessao.ids.length - faltam.length, total: sessao.totalOrig || sessao.ids.length },
      sessao.batalha ? { cor: sessao.coracoes, dano: sessao.danoTotal || 0, crit: sessao.criticos || 0, cmb: sessao.comboMax, per: sessao.perdas || 0 } : {});
  }
  const manter = new Set(Object.entries(pausas).filter(([, v]) => v && v.data && HOJE() - diaNum(v.data) <= PAUSA_DIAS)
    .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0)).slice(0, PAUSA_MAX).map(([x]) => x));
  for (const x of Object.keys(pausas)) if (!manter.has(x)) delete pausas[x];
}
// Guarda a sessão aberta (ao sair, ao trocar de app ou de aba, ao fechar a página). Sessão sem nenhuma resposta não vira pausa.
function guardarSessaoAberta() {
  if (!sessao || sessao.fim || !chavePausa(sessao) || (!Object.keys(sessao.resp).length && !sessao.retomada)) return false;
  atualizarPausa();
  Store.salvar('perfil');
  return true;
}
function retomarPausa(k) {
  const p = pausaDe(k);
  if (!p) return false;
  sessao = novaSessao({ modo: p.modo, titulo: p.titulo, dia: p.dia, chave: k, prova: p.prova }, p.ids);
  sessao.retomada = true;
  if (p.modo === 'simulado') {
    sessao.resp = p.resp;
    sessao.duv = Object.assign({}, p.duv);
    sessao.i = Math.min(Math.max(0, Number(p.i) || 0), p.ids.length - 1);
    sessao.limite = p.limite || 0;
    sessao.ini = Date.now() - (p.gasto || 0) * 1000;
  } else {
    sessao.feitasAntes = p.feitas || 0;
    sessao.totalOrig = p.total || p.ids.length;
    // Batalha retomada continua com os corações e o placar de quando você saiu
    if (sessao.batalha && p.cor != null) { sessao.coracoes = Math.max(1, Math.min(p.cor, sessao.coracoesMax)); sessao.danoTotal = p.dano || 0; sessao.criticos = p.crit || 0; sessao.comboMax = p.cmb || 0; sessao.perdas = p.per || 0; }
  }
  abrirSessao();
  return true;
}
function descartarPausa(k) { if (S.perfil.pausas && S.perfil.pausas[k]) { delete S.perfil.pausas[k]; Store.salvar('perfil'); } }
// Rótulo do botão: "Continuar · faltam 12 de 40" quando há pausa; o rótulo normal quando não há
function rotuloPausa(k, normal) { const p = pausaDe(k); return p ? 'Continuar · ' + resumoPausa(p) : normal; }
// Lista das sessões guardadas, com Continuar e Descartar; "fora" são as chaves que já têm botão próprio na tela
function cartaoPausas(fora) {
  const lista = pausasVivas().filter(([k]) => !(fora && fora.has(k)));
  if (!lista.length) return '';
  return '<div class="cartao destaque"><div class="secao-cab"><h2>Sessões guardadas</h2><span class="mono pequeno mudo">' + lista.length + '</span></div>' +
    lista.map(([k, p]) => '<div class="pausa-linha"><div class="pausa-txt"><b>' + esc(p.titulo) + '</b><span class="pequeno mudo">' + esc(resumoPausa(p)) + (p.data !== hojeISO() ? ' · guardada em ' + esc(fmtData(p.data, { day: '2-digit', month: '2-digit' })) : '') + '</span></div>' +
      '<div class="linha-btns"><button class="btn pequeno primario" data-acao="retomar-pausa" data-k="' + esc(k) + '">Continuar</button><button class="btn pequeno" data-acao="descartar-pausa" data-k="' + esc(k) + '">Descartar</button></div></div>').join('') +
    '<p class="pequeno mudo">Ficam guardadas por ' + PAUSA_DIAS + ' dias, na sua conta: dá para continuar em outro aparelho.</p></div>';
}
function iniciarSessao(cfg) {
  if (MODOS_PAUSA.has(cfg.modo) && !cfg.novo && (cfg.chave || cfg.dia) && retomarPausa(cfg.chave || cfg.dia)) return;
  let itens;
  if (cfg.modo === 'cards') {
    const venc = cardsVencidos(cfg.blocos).slice(0, cfg.maxRev || 200);
    const novos = cfg.soRevisao ? [] : cardsNovos(cfg.blocos).slice(0, Math.min(novosRestantesHoje(), cfg.novos == null ? 20 : cfg.novos));
    const ids = embaralhar(venc.map((c) => c.id)).concat(novos.map((c) => c.id));
    if (!ids.length) {
      avisar('C', 'Nada para revisar agora', novosRestantesHoje() ? 'Escolha outros baralhos de cards.' : 'Limite de cards novos de hoje atingido. Ajuste em Mais → Ajustes.');
      return;
    }
    iniciarCards(ids, cfg.titulo);
    return;
  }
  if (cfg.modo === 'revisao') {
    // Só o que venceu hoje: quem já foi revisto volta no intervalo programado, e não na próxima revisão do mesmo dia
    itens = embaralhar(listaVencida().concat(manutencaoHoje()).slice(0, cfg.n || 30));
    if (!itens.length) { avisar('LC', 'Nada vencido para revisar', 'O que você já revisou volta no intervalo programado. Siga com questões novas.'); return; }
  } else if (cfg.ids) itens = cfg.ids.map((id) => QI.get(id)).filter(Boolean);
  else if (cfg.intercalado) itens = selecionarIntercaladas(cfg.n || 30);
  else if (cfg.prova) itens = selecionarProva(cfg.n || 60);
  else if (cfg.modo === 'relampago') itens = embaralhar(poolDe(cfg.blocos).filter((q) => !q.al));
  else itens = selecionar(poolDe(cfg.blocos), cfg.n || 20, cfg.filtro || 'mistas');
  if (!itens.length) { avisar('!', 'Sem itens', 'Nenhuma questão disponível com esse filtro.'); return; }
  if (cfg.modo !== 'relampago') itens = emBlocosDeTexto(itens, !cfg.ids && !cfg.prova && cfg.modo !== 'revisao', cfg.blocos && cfg.blocos.length && !cfg.prova && !cfg.intercalado ? new Set(cfg.blocos) : null);
  sessao = novaSessao(cfg, itens.map((q) => q.id));
  abrirSessao();
}
// Erros e brancos da sessão, fora a interpretação de texto (refazer logo o mesmo texto só treina a memória do gabarito)
function idsParaRefazer() {
  return sessao.ids.filter((id) => (sessao.modo !== 'relampago' || sessao.resp[id]) && (sessao.resp[id] || BRANCO) !== QI.get(id).g && !SEM_REPETICAO.has(id));
}
function iniciarCards(ids, titulo) {
  sessao = novaSessao({ modo: 'cards', titulo }, ids);
  sessao.notas = { 1: 0, 2: 0, 3: 0, 4: 0 };
  sessao.repetidos = {};
  abrirSessao();
}
function novaSessao(cfg, ids) {
  return {
    modo: cfg.modo, titulo: cfg.titulo || tituloModo(cfg.modo), dia: cfg.dia || null, ids, i: 0,
    chave: MODOS_PAUSA.has(cfg.modo) ? cfg.chave || cfg.dia || 'x:' + Date.now().toString(36) : null, resp: {}, duv: {}, revelado: false,
    combo: 0, comboMax: 0, xp: 0, ini: Date.now(), fim: false, prova: !!cfg.prova, confirmar: null, flash: null, retrato: cfg.modo === 'cards' ? null : retratoSessao(ids),
    batalha: String(cfg.chave || '').startsWith('chefe:'), coracoes: coracoesMax(), coracoesMax: coracoesMax(),
    limite: cfg.modo === 'relampago' ? 90 : cfg.modo === 'simulado' ? (cfg.minutos || 0) * 60 : 0,
  };
}
function tituloModo(m) {
  return { treino: 'Treino', revisao: 'Revisão da lista curta', simulado: 'Simulado Cebraspe', relampago: 'Relâmpago 90 s', cards: 'Cards cloze' }[m] || 'Sessão';
}
function abrirSessao() {
  const el = document.getElementById('sessao');
  el.hidden = false;
  document.body.style.overflow = 'hidden';
  clearInterval(relogioTimer);
  relogioTimer = setInterval(tique, 1000);
  renderSessao();
  el.scrollTop = 0;
}
function fecharSessao(guardar = true) {
  if (guardar) guardarSessaoAberta();
  clearInterval(relogioTimer);
  sessao = null;
  const el = document.getElementById('sessao');
  el.hidden = true;
  el.innerHTML = '';
  document.body.style.overflow = '';
  Store.descarregar();
  renderTudo();
}
function decorrido() { return (Date.now() - sessao.ini) / 1000; }
function tique() {
  if (!sessao || sessao.fim) return;
  const el = document.getElementById('relogio');
  if (sessao.limite) {
    const resta = sessao.limite - decorrido();
    if (resta <= 0) { finalizar(); return; }
    if (el) { el.textContent = fmtTempo(resta); el.classList.toggle('urgente', resta <= 15 || (sessao.modo === 'simulado' && resta <= 300)); }
  } else if (el) el.textContent = fmtTempo(decorrido());
}
function responder(resp) {
  if (!sessao || sessao.fim || sessao.modo === 'cards') return;
  const id = sessao.ids[sessao.i];
  const q = QI.get(id);
  if (sessao.modo === 'simulado') {
    sessao.resp[id] = resp;
    if (sessao.i < sessao.ids.length - 1) sessao.i++;
    atualizarPausa();
    Store.salvar('perfil');
    renderSessao();
    return;
  }
  if (sessao.revelado || sessao.flash || resp === BRANCO) return;
  // Virada: acertar um item cuja última resposta foi erro. É onde o aprendizado aparece: se o erro foi em outro dia,
  // o XP dobra; no mesmo dia (logo depois de ler o comentário), ganha só um pouco a mais
  const ant = rec(id), virada = ant && ant[0] === 0 && ant[3] > 0 ? (ant[4] < HOJE() ? 'plena' : 'mesmo-dia') : null;
  const ok = registrar(q, resp, !!sessao.duv[id]);
  sessao.golpe = golpeRecente;
  sessao.resp[id] = resp;
  let x = 0;
  if (ok) {
    sessao.combo++; sessao.comboMax = Math.max(sessao.comboMax, sessao.combo); x = xpAcerto(q, sessao.combo, sessao.modo);
    if (sessao.modo !== 'relampago' && caiuEmProva(q)) x = Math.round(x * 1.5);
    if (virada === 'plena') { x *= 2; sessao.viradas = (sessao.viradas || 0) + 1; const dv = diaLog(); dv.vr = (dv.vr || 0) + 1; } else if (virada) x += 4;
  } else sessao.combo = 0;
  sessao.virada = ok ? virada : null;
  efeitoBatalha(ok);
  if (sessao.golpe && sessao.golpe.vencido) sessao.golpeFinal = sessao.golpe;
  tocar(!ok ? 'erro' : sessao.golpe && sessao.golpe.vencido ? 'festa' : sessao.combo >= 5 && sessao.combo % 5 === 0 ? 'combo' : 'acerto');
  { const dl = diaLog(); if (sessao.combo > (dl.cmb || 0)) dl.cmb = sessao.combo; }
  if (sessao.comboMax > (S.perfil.recordes.combo || 0)) S.perfil.recordes.combo = sessao.comboMax;
  sessao.xp += x;
  ganharXP(x);
  sessao.ultimoGanho = x;
  verificarMeta();
  verificarConquistas({ respondeu: true });
  atualizarPausa();
  Store.salvar('perfil', 'itens', 'pesquisa');
  if (sessao.modo === 'relampago') {
    sessao.flash = ok ? 'ok' : 'no';
    renderSessao();
    setTimeout(() => {
      if (!sessao || sessao.fim) return;
      sessao.flash = null;
      sessao.i++;
      if (sessao.i >= sessao.ids.length) finalizar(); else renderSessao();
    }, ok ? 380 : 900);
    return;
  }
  sessao.revelado = true;
  renderSessao();
}
function avaliar(nota) {
  if (!sessao || sessao.modo !== 'cards' || !sessao.revelado) return;
  const id = sessao.ids[sessao.i];
  avaliarCard(id, nota);
  sessao.notas[nota]++;
  const x = nota === 1 ? 1 : 3;
  sessao.xp += x;
  ganharXP(x);
  if (nota === 1 && (sessao.repetidos[id] || 0) < 2) { sessao.repetidos[id] = (sessao.repetidos[id] || 0) + 1; sessao.ids.push(id); }
  verificarConquistas({ respondeu: true });
  Store.salvar('perfil', 'cards');
  sessao.revelado = false;
  sessao.i++;
  if (sessao.i >= sessao.ids.length) finalizar();
  else { renderSessao(); document.getElementById('sessao').scrollTop = 0; }
}
function proximo() {
  if (!sessao) return;
  if (sessao.modo === 'cards') { if (!sessao.revelado) { sessao.revelado = true; renderSessao(); } return; }
  if (sessao.modo === 'simulado') { if (sessao.i < sessao.ids.length - 1) { sessao.i++; renderSessao(); } return; }
  if (!sessao.revelado) return;
  sessao.revelado = false;
  if (sessao.desfecho) { encerrarBatalha(); return; }
  sessao.i++;
  if (sessao.i >= sessao.ids.length) finalizar();
  else { renderSessao(); document.getElementById('sessao').scrollTop = 0; }
}
function finalizar() {
  if (!sessao || sessao.fim) return;
  sessao.fim = true;
  sessao.dur = decorrido();
  clearInterval(relogioTimer);
  if (sessao.modo === 'simulado') {
    // pt: nota ponderada (item básico vale 1, específico vale 2); nr/cr: itens reais de prova respondidos e acertados
    let c = 0, e = 0, b = 0, xp = 0, eMc = 0, ni = 0, nc = 0, pt = 0, ptMax = 0, nr = 0, cr = 0;
    sessao.ids.forEach((id) => {
      const q = QI.get(id);
      const r = sessao.resp[id] || BRANCO;
      const novo = inedito(q);
      const ok = registrar(q, r, !!sessao.duv[id]);
      const w = pesoItem(q);
      ptMax += w;
      if (novo && r !== BRANCO) { ni++; if (ok) nc++; }
      if (q.o && r !== BRANCO) { nr++; if (ok) cr++; }
      if (r === BRANCO) b++; else if (ok) { c++; xp += 10; pt += w; } else { e++; if (q.al) eMc++; else pt -= w; }
    });
    sessao.ineditos = { n: ni, c: nc };
    xp += 40;
    sessao.xp = xp;
    ganharXP(xp);
    S.simulados.unshift({ data: hojeISO(), n: sessao.ids.length, c, e, b, liq: c - (e - eMc), seg: Math.round(sessao.dur), titulo: sessao.titulo, ni, nc, pt, ptMax, nr, cr });
    S.simulados = S.simulados.slice(0, 60);
    verificarMeta();
  }
  if (sessao.modo === 'relampago') {
    let c = 0, e = 0;
    sessao.ids.forEach((id) => { const r = sessao.resp[id]; if (!r) return; if (r === QI.get(id).g) c++; else e++; });
    if (c - e > (S.perfil.recordes.relampago || 0)) { S.perfil.recordes.relampago = c - e; sessao.recorde = true; }
    if (c + e) { const d = diaLog(); d.rl = (d.rl || 0) + 1; verificarRPG(); }
  }
  if (sessao.dia) {
    // Sessão de um dia anterior do plano: conta para a missão de encaixar pendências
    if ((/^\d{4}-\d{2}-\d{2}$/.test(sessao.dia) && sessao.dia < hojeISO() || /^rec:/.test(sessao.dia)) && !S.perfil.feitos[sessao.dia]) { const d = diaLog(); d.pd = (d.pd || 0) + 1; }
    S.perfil.feitos[sessao.dia] = 1;
    verificarRPG();
  }
  atualizarPausa();
  verificarConquistas();
  Store.salvarTudo();
  renderSessao();
  document.getElementById('sessao').scrollTop = 0;
}

/* ================= Sons ================= */
// Sons curtos sintetizados na hora (sem arquivo de áudio), desligados por padrão: o botão de som fica no topo da
// sessão. O navegador só libera o áudio depois de um toque, e toda chamada vem de uma resposta ou de um botão.
let audioCtx = null;
const SONS = { acerto: [[660, 0], [880, 0.07]], erro: [[196, 0]], combo: [[660, 0], [830, 0.06], [990, 0.12]], festa: [[523, 0], [659, 0.08], [784, 0.16], [1047, 0.26]] };
function tocar(tipo) {
  if (!UI.som || !SONS[tipo]) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime, dur = tipo === 'erro' ? 0.22 : 0.15;
    for (const [f, dt] of SONS[tipo]) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = tipo === 'erro' ? 'triangle' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.07, t0 + dt + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + dt);
      o.stop(t0 + dt + dur + 0.02);
    }
  } catch (e) { /* sem áudio neste navegador */ }
}

/* ================= O que a sessão rendeu ================= */
// Retrato tirado no começo da sessão (ou na retomada): o resultado compara com ele o domínio dos blocos tocados, os
// itens que saíram da lista curta, a vida do chefão, as missões e o nível
function retratoSessao(ids) {
  const blocos = [...new Set(ids.map((id) => (QI.get(id) || {}).b).filter(Boolean))];
  const dom = {};
  for (const b of blocos) dom[b] = dominioBloco(b) || 0;
  const mh = missoesHoje(), c = chefeDaSemana();
  return { dom, saidos: S.perfil.saidos || 0, sem: c.sem, vida: c.vencido ? 0 : c.vida, missoes: mh.ids.filter((x) => mh.ok[x]).length, bau: !!mh.bau, nivel: nivelDe(S.perfil.xp).n };
}
function cartaoGanhos() {
  const r = sessao.retrato;
  if (!r) return '';
  const linhas = [];
  const subiram = Object.entries(r.dom).map(([b, antes]) => ({ b, antes, depois: dominioBloco(b) || 0 }))
    .filter((x) => Math.round(x.depois * 100) > Math.round(x.antes * 100))
    .sort((a, b) => b.depois - b.antes - (a.depois - a.antes)).slice(0, 4);
  for (const x of subiram) {
    const a = Math.round(x.antes * 100), d = Math.round(x.depois * 100);
    linhas.push('<div class="ganho-dom"><div class="gd-cab"><span>' + esc(nomeBloco(x.b)) + '</span><span class="mono">' + a + '% → <b>' + d + '%</b></span></div>' +
      '<div class="barra-ganho" role="img" aria-label="Domínio de ' + a + '% para ' + d + '%"><i style="width:' + a + '%"></i><i class="novo" style="width:' + (d - a) + '%"></i></div></div>');
  }
  const saiu = (S.perfil.saidos || 0) - r.saidos;
  if (saiu > 0) linhas.push('<p class="ganho-linha"><span aria-hidden="true">✓</span> ' + pl(saiu, 'item saiu', 'itens saíram') + ' da lista curta: agora ' + (saiu > 1 ? 'voltam' : 'volta') + ' só para confirmar, daqui a semanas.</p>');
  const c = chefeDaSemana();
  if (!sessao.batalha && c.sem === r.sem && r.vida) {
    const dano = r.vida - (c.vencido ? 0 : c.vida);
    if (dano > 0) linhas.push('<div class="ganho-dom"><div class="gd-cab"><span>' + esc(nomeChefe(c.bloco)) + '</span><span class="mono">HP ' + r.vida + ' → <b>' + (c.vencido ? 0 : c.vida) + '</b></span></div>' + hpBarra(c.vencido ? 0 : c.vida, c.max) + '</div>');
  }
  const mh = missoesHoje(), m = mh.ids.filter((x) => mh.ok[x]).length - r.missoes;
  if (m > 0) linhas.push('<p class="ganho-linha"><span aria-hidden="true">★</span> ' + pl(m, 'missão cumprida', 'missões cumpridas') + (mh.bau && !r.bau ? ' e o baú do dia aberto' : '') + '.</p>');
  const nv = nivelDe(S.perfil.xp);
  if (nv.n > r.nivel) linhas.push('<p class="ganho-linha"><span aria-hidden="true">▲</span> Nível ' + nv.n + ': ' + esc(nv.nome) + '.</p>');
  const hoje = S.perfil.dias[hojeISO()] || {};
  // Depois de um dia muito longo, o recado é parar: o cansaço pesa nos acertos e amanhã a revisão rende mais
  const longo = (hoje.r || 0) >= 150 ? '<p class="pequeno mudo">Hoje já são ' + hoje.r + ' itens. Depois de tanto tempo, o cansaço começa a pesar nos acertos; parar aqui e voltar amanhã costuma render mais do que esticar.</p>' : '';
  if (!linhas.length) return longo ? '<div class="cartao">' + longo + '</div>' : '';
  return '<div class="cartao ganhos"><h2>O que esta sessão rendeu</h2>' + linhas.join('') + longo + '</div>';
}
// Linha extra na tela da resposta: o artigo já cobrado em prova real (o acerto nele é crítico: XP e dano em dobro
// no chefão, 50% a mais de XP fora dele)
function extrasResposta(q) {
  const n = caiuEmProva(q);
  return n ? '<p class="extra-resp quente"><span aria-hidden="true">★</span> Já caiu em prova: ' + pl(n, 'item real', 'itens reais') + ' deste artigo no banco.</p>' : '';
}

/* ================= Avisos ================= */
function avisar(ic, titulo, texto) {
  const box = document.getElementById('avisos');
  const el = document.createElement('div');
  el.className = 'aviso';
  el.innerHTML = '<div class="ic">' + esc(ic) + '</div><div><b>' + esc(titulo) + '</b><span>' + esc(texto || '') + '</span></div>';
  // Só informa: não recebe toque, para não roubar o clique do botão que estiver embaixo (some sozinho em 3,8 s)
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), 3800);
}

// Erros: aparecem num aviso, ficam no diagnóstico (Ajustes) e vão para o perfil na conta (os cinco últimos), para um
// problema que só acontece num aparelho poder ser lido e corrigido depois
const ERROS = [];
function registrarErro(onde, e) {
  const msg = String((e && (e.message || (e.reason && e.reason.message))) || e || 'erro desconhecido').slice(0, 200);
  const linha = (onde ? onde + ': ' : '') + msg;
  if (ERROS.some((x) => x.m === linha)) return;
  const pilha = String((e && e.stack) || '').split('\n').slice(0, 4).map((x) => x.trim()).join(' | ').slice(0, 400);
  ERROS.unshift({ m: linha, p: pilha, t: new Date().toISOString(), v: D.versao, ua: String(navigator.userAgent || '').slice(0, 160) });
  ERROS.length = Math.min(ERROS.length, 5);
  try { S.perfil.erros = ERROS.slice(); Store.salvar('perfil'); } catch (x) { /* sem gravação, fica só na tela */ }
  try { avisar('!', 'Algo falhou nesta tela', linha.slice(0, 120) + ' (detalhes em Mais → Ajustes)'); } catch (x) { /* sem aviso */ }
}
window.addEventListener('error', (ev) => registrarErro('', ev.error || ev.message));
window.addEventListener('unhandledrejection', (ev) => registrarErro('', ev.reason));

/* ================= Componentes ================= */
function iconeFogo() { return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2.2 1-3.8 2.3-5 .2 1.6 1 2.7 2.2 3.1C11 8.5 11.3 5.2 12 2z"/></svg>'; }
function iconeSom(ligado) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/>' + (ligado ? '<path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>' : '<path d="M17 9l5 6M22 9l-5 6"/>') + '</svg>'; }
function iconeLua() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>'; }
function iconeSol() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'; }
function iconeEngrenagem() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'; }
function anel(valor, total) {
  const r = 36, circ = 2 * Math.PI * r, f = Math.min(1, total ? valor / total : 0);
  return '<div class="anel" role="img" aria-label="' + valor + ' de ' + total + ' itens hoje"><svg viewBox="0 0 86 86"><circle class="trilho" cx="43" cy="43" r="' + r + '"/>' +
    '<circle class="valor' + (f >= 1 ? ' cheio' : '') + '" cx="43" cy="43" r="' + r + '" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + (circ * (1 - f)).toFixed(1) + '"/></svg>' +
    '<div class="meio"><div><b>' + valor + '</b><br><span>de ' + total + '</span></div></div></div>';
}
function barra(f, cls, estilo) { return '<div class="barra' + (cls ? ' ' + cls : '') + '"' + (estilo ? ' style="' + estilo + '"' : '') + '><i style="width:' + Math.round(Math.max(0, Math.min(1, f)) * 100) + '%"></i></div>'; }
function voltarMais() { return '<button class="btn pequeno voltar" data-acao="mais" data-sub="menu">← Mais</button>'; }

/* ================= Cabeçalho ================= */
function renderTopo() {
  const nv = nivelDe(S.perfil.xp);
  const seq = sequencia();
  document.getElementById('topo').innerHTML =
    '<div class="marca"><b>Painel ANPD</b><span>Especialista em Regulação de Proteção de Dados · Nível ' + nv.n + '</span></div>' +
    '<div class="status"><span class="pilula fogo' + (seq ? '' : ' apagado') + '" title="Dias seguidos de estudo (domingo e uma folga por semana não quebram)">' + iconeFogo() + seq + '</span>' +
    '<span class="pilula xp" title="Pontos de experiência">' + fmtNum(S.perfil.xp) + ' XP</span>' +
    '<button class="icone-btn" data-acao="tema-alternar" aria-label="' + (temaEscuroAtivo() ? 'Usar tema claro' : 'Usar modo noturno') + '" title="' + (temaEscuroAtivo() ? 'Tema claro' : 'Modo noturno') + '">' + (temaEscuroAtivo() ? iconeSol() : iconeLua()) + '</button>' +
    '<button class="icone-btn" data-acao="mais" data-sub="ajustes" aria-label="Ajustes">' + iconeEngrenagem() + '</button></div>';
}

/* ================= Hoje: roteiro do método ================= */
function contextoHoje() {
  const h = hojeISO();
  const exato = DIAS.find((d) => d.data === h);
  if (exato) return { tipo: 'dia', dia: exato };
  const prox = DIAS.find((d) => d.data > h);
  if (prox) return { tipo: 'folga', prox };
  return { tipo: 'fim' };
}
function blocosDoDia(dia) { return dia && dia.blocos ? dia.blocos : []; }
// Blocos dos dias de questões da semana do plano (segunda até o dia): é o que a revisão do dia treina quando não há
// nada vencido, como no começo do estudo; sem nenhum, a prioridade 1
function blocosDaSemana(dia) {
  const seg = isoDeNum(diaNum(dia.data) - ((diaSemana(dia.data) + 6) % 7));
  const bs = [];
  for (const d of DIAS) if (d.data >= seg && d.data <= dia.data && d.modo === 'treino') for (const b of d.blocos) if (!bs.includes(b)) bs.push(b);
  return bs.length ? bs : P1.slice();
}
// Vivo: algum dispositivo não vetado nem revogado. Caput vetado com parágrafo em vigor (Lei 9.507, art. 1º; LAI, art. 35) continua
// vivo; caput revogado leva o artigo inteiro, porque revogar "o art. X" alcança os parágrafos, mesmo sem nota neles.
const VIVO = new Map();
function artigoVivo(k) {
  if (!ARTI.has(k)) return false;
  if (!VIVO.has(k)) {
    const linhas = ARTI.get(k).texto.split('\n');
    VIVO.set(k, !linhaRevogada(linhas[0]) && linhas.some((l) => l.trim() && !linhaRevogada(l) && !/\(VETADO\)/.test(l)));
  }
  return VIVO.get(k);
}
// Dispositivo revogado: o texto antigo não vale mais e não se estuda. Fica só o rótulo (a numeração pula, e a banca às
// vezes cobra que o parágrafo caiu) com a nota de quem revogou. Notas de redação depois da revogação não mudam isso.
const RE_ROTULO = /^\s*[“"]?(?:Art\.\s?[\dA-Zº°-]+\s?\.?|§\s?\d+\s?\.?\s?[º°]?\.?|Parágrafo único\.?|[IVXLC]+(?:-[A-Z])?\s?[-–]|[a-z]\))/;
function linhaRevogada(linha) {
  const r = RE_ROTULO.exec(linha);
  const rotulo = r ? r[0].replace(/^[\s“"]+/, '').trim() : '';
  const m = /\((Revogad[oa][^)]*)\)(?:[\s.;,:”"]*(?:\((?:Redação dada|Incluíd[oa]|NR|Vide)[^)]*\)|Revogad[oa] pel[oa] [^()]*))*[\s.;,:”"]*$/.exec(linha);
  if (m) return { rotulo, nota: '(' + m[1] + ')' };
  // Só o rótulo e a palavra, em minúscula ou sem parênteses: "a) revogada;", "XXI - (revogado);"
  const s = r && /^\s*\(?(revogad[oa]s?)\)?[\s.;,:”"]*(?:\((?:Redação dada|Incluíd[oa]|NR|Vide)[^)]*\)[\s.;,:”"]*)*$/i.exec(linha.slice(r.index + r[0].length));
  return s ? { rotulo, nota: '(' + s[1].toLowerCase() + ')' } : null;
}
// Leitura do dia: todos os artigos dos blocos do dia, se couberem em LEITURA_MAX; senão, uma seleção
// equilibrada entre os blocos: primeiro os artigos de questões que estão na sua lista curta, depois os
// nunca lidos (o que foi lido pela primeira vez hoje continua contando como não lido), depois os mais cobrados.
// Dia de matéria nova (com subtema no plano): a leitura são os artigos do subtema, os mesmos da aula e das questões
function stDoDia(dia) { return dia && dia.st ? SUBTEMAS.get(dia.st) || null : null; }
function artsDoSubtema(st) { return [...new Set((st.arts || []).filter((k) => artigoVivo(k)))]; }
function leituraDoDia(dia) {
  const st = stDoDia(dia);
  if (st) { const arts = artsDoSubtema(st); return { arts: arts.slice(0, LEITURA_MAX), total: arts.length }; }
  const porBloco = [], todos = [];
  for (const b of blocosDoDia(dia)) {
    const bl = BI.get(b), lista = [];
    for (const a of (bl && bl.artigos) || []) { const k = chave(bl.lei || 'lgpd', a); if (artigoVivo(k) && !todos.includes(k)) { todos.push(k); lista.push(k); } }
    if (lista.length) porBloco.push(lista);
  }
  if (todos.length <= LEITURA_MAX) return { arts: todos, total: todos.length };
  const hoje = hojeISO(), lidos = S.perfil.lidos || {};
  const prio = (k) => ((POR_ART.get(k) || []).some((q) => emRevisao(q.id)) ? 1000 : 0) + (lidos[k] && lidos[k] !== hoje ? 0 : 100) + importancia(k);
  const filas = porBloco.map((l) => l.slice().sort((x, y) => prio(y) - prio(x)));
  const escolhidos = new Set();
  for (let i = 0; escolhidos.size < LEITURA_MAX && filas.some((f) => f.length); i++) { const k = filas[i % filas.length].shift(); if (k) escolhidos.add(k); }
  return { arts: todos.filter((k) => escolhidos.has(k)), total: todos.length };
}
function artigosDoDia(dia) { return leituraDoDia(dia).arts; }
function rotulosArts(arts) {
  if (arts.length <= 3) return arts.map(nomeArt).join(', ');
  const a0 = ARTI.get(arts[0]), a1 = ARTI.get(arts[arts.length - 1]);
  const pref = a0.lei !== 'lgpd' && a0.lei === a1.lei ? LEIS[a0.lei].curto + ', ' : '';
  return pref + 'arts. ' + a0.id + ' a ' + a1.id + ' (' + arts.length + ' artigos)';
}
function sugestoesDoDia(blocos) {
  const fonte = (blocos.length ? blocos : P1).flatMap((b) => (BI.get(b) && BI.get(b).pesquisar) || []);
  return fonte.filter((t) => !S.pesquisa[chavePesq(t)]);
}
function rotuloModoDia(dia) {
  if (dia.modo === 'revisao') return 'revisão';
  if (dia.modo === 'simulado') return 'simulado de ' + dia.n;
  return dia.n + ' itens';
}
// "Recomeçar do zero" apaga a sessão guardada: vai em "extra" do passo, que o roteiro mostra e o cartão do topo não
function botaoRecomecar(k) { return pausaDe(k) ? '<button class="btn pequeno" data-acao="descartar-pausa" data-k="' + esc(k) + '">Recomeçar do zero</button>' : ''; }
function roteiroHoje() {
  const ctx = contextoHoje();
  const dia = ctx.tipo === 'dia' ? ctx.dia : null;
  const d = S.perfil.dias[hojeISO()] || { r: 0, k: 0, n: 0, a: [] };
  const blocos = blocosDoDia(dia);
  const venc = listaVencida().length;
  const manut = manutencaoHoje().length;
  const cardsV = cardsVencidos().length;
  const leitura = leituraDoDia(dia);
  const arts = leitura.arts;
  const lidosHoje = (d.a || []).filter((a) => arts.includes(a)).length;
  const cardsBlocos = blocos.filter((b) => (CARDS_POR_BLOCO.get(b) || []).length);
  const novosDisp = cardsNovos(cardsBlocos.length ? cardsBlocos : null).length;
  const pesqHoje = Object.values(S.pesquisa).filter((p) => p.s && p.f === hojeISO()).length;
  const passos = [];
  passos.push({
    titulo: 'Revisar o que venceu', feito: venc === 0 && manut === 0 && cardsV === 0,
    texto: venc || manut || cardsV ? [venc ? pl(venc, 'questão da lista curta', 'questões da lista curta') : '', manut ? pl(manut, 'acerto antigo para confirmar', 'acertos antigos para confirmar') : '', cardsV ? pl(cardsV, 'card', 'cards') : ''].filter(Boolean).join(' · ') + ' vencem hoje.' : 'Nada vencido hoje.',
    botoes: (venc + manut ? '<button class="btn pequeno primario" data-acao="iniciar-revisao">Questões (' + (venc + manut) + ')</button>' : '') + (cardsV ? '<button class="btn pequeno' + (venc + manut ? '' : ' primario') + '" data-acao="cards-revisao">Cards (' + cardsV + ')</button>' : ''),
  });
  const stH = dia && dia.modo === 'treino' ? stDoDia(dia) : null;
  if (stH) {
    const e = estadoSubtema(stH.id), artsSt = artsDoSubtema(stH), lidos = S.perfil.lidos || {}, nLidos = artsSt.filter((k) => lidos[k]).length, chPre = 't:' + stH.id + ':pre';
    if (e.novos || e.resp) passos.push({ titulo: 'Pré-teste: ' + stH.nome, feito: e.resp > 0,
      texto: 'Antes de estudar, ' + pl(Math.min(8, e.novos), 'item', 'itens') + ' para ver o que você já sabe. Errar aqui é esperado: o erro mostra o que procurar na lei e na aula.',
      botoes: '<button class="btn pequeno primario" data-acao="trilha-sessao" data-st="' + esc(stH.id) + '" data-tipo="pre">' + esc(rotuloPausa(chPre, 'Pré-teste · ' + pl(Math.min(8, e.novos), 'item', 'itens'))) + '</button>', extra: botaoRecomecar(chPre) });
    if (artsSt.length) passos.push({ titulo: 'Lei seca do dia', feito: nLidos >= artsSt.length,
      texto: inicial(rotulosArts(artsSt)) + ' · lidos: ' + nLidos + ' de ' + artsSt.length + '. As palavras difíceis vêm explicadas logo acima dos artigos.',
      botoes: '<button class="btn pequeno primario" data-acao="st-lei" data-st="' + esc(stH.id) + '">Ler os artigos</button>' });
    passos.push({ titulo: 'Aula do dia', feito: !!S.perfil.feitos['aula:' + dia.data],
      texto: (nomeTrilha(stH.trilha) || 'Trilha do zero') + ': ' + stH.nome + '. A aula explica o que você leu; as citações de artigo abrem o texto ali mesmo.',
      botoes: '<button class="btn pequeno primario" data-acao="st-aula" data-st="' + esc(stH.id) + '">Abrir a aula</button>' });
  }
  if (dia) {
    const feito = !!S.perfil.feitos[dia.data];
    const nDia = nItensDoDia(dia);
    passos.push({ titulo: dia.modo === 'simulado' ? 'Simulado do dia' : dia.modo === 'revisao' ? 'Sessão de revisão do dia' : stH ? 'Questões do dia: ' + stH.nome : 'Questões do dia', feito,
      texto: dia.modo === 'treino' && nDia < dia.n ? 'Sessão reduzida de ' + dia.n + ' para ' + nDia + ' itens: há ' + pl(venc, 'revisão vencida', 'revisões vencidas') + ', e elas vêm primeiro.' : '', botoes: '<button class="btn pequeno primario" data-acao="iniciar-dia" data-dia="' + dia.data + '">' + esc(rotuloPausa(dia.data, (feito ? 'Outra rodada' : 'Começar') + ' · ' + rotuloModoDia(Object.assign({}, dia, { n: nDia })))) + '</button>', extra: botaoRecomecar(dia.data) });
  }
  const dd = discDeHoje();
  if (dd) {
    const t = temaDisc(dd), atr = pendencias().filter((x) => x.disc).length;
    passos.push({ titulo: 'Discursiva do dia', feito: discFeita(dd),
      texto: (t ? t.titulo + ': até ' + t.linhas + ' linhas, ' + t.minutos + ' min, sem consulta. Corrija pelos quesitos e salve.' : '') + (atr ? ' Há ' + pl(atr, 'discursiva atrasada', 'discursivas atrasadas') + ': cada uma salva dá baixa primeiro na de hoje e depois na mais antiga.' : ''),
      botoes: discFeita(dd) ? '' : botaoDiscDia(dd, true) });
  }
  const rec = proximaRecuperacao();
  const atrasados = blocosAtrasados();
  if (rec) {
    passos.push({ titulo: 'Recuperar o atraso', feito: !!S.perfil.feitos['rec:' + hojeISO()],
      texto: rec.falta.map((f) => nomeBloco(f.b)).join(', ') + (atrasados.length > rec.falta.length ? ' (depois, mais ' + pl(atrasados.length - rec.falta.length, 'matéria', 'matérias') + ')' : '') + '.',
      botoes: botaoRecuperar() });
  }
  const nInt = nIntercaladas();
  if (nInt > 0) {
    const chaveInt = 'i:' + hojeISO();
    passos.push({ titulo: 'Questões intercaladas', feito: !!S.perfil.feitos[chaveInt],
      texto: 'Matérias básicas e blocos já estudados, misturados.' + (nInt < (S.perfil.intercaladas == null ? 30 : S.perfil.intercaladas) ? (listaVencida().length > REVISOES_DIA_PESADO ? ' Sessão menor hoje: há muita revisão vencida.' : ' Sessão menor hoje, para o dia de 1h45 caber no tempo.') : ''),
      botoes: '<button class="btn pequeno primario" data-acao="intercaladas">' + esc(rotuloPausa(chaveInt, (S.perfil.feitos[chaveInt] ? 'Outra rodada' : 'Começar') + ' · ' + nInt + ' itens')) + '</button>', extra: botaoRecomecar(chaveInt) });
  }
  const std = stH ? null : subtemaDoDia();
  if (std) {
    const e = estadoSubtema(std.id), chT = 't:' + hojeISO(), tipoT = e.novos ? 'pre' : 'pratica', chPT = 't:' + std.id + ':' + tipoT;
    passos.push({ titulo: nomeTrilha(std.trilha) || 'Trilha do zero', feito: !!S.perfil.feitos[chT],
      texto: std.nome + ' (' + ROTULO_ST[e.status] + (e.resp ? ', acerto ' + Math.round(e.acerto * 100) + '%' : '') + '). Pré-teste, depois a lei e a aula na página do subtema.',
      botoes: '<button class="btn pequeno primario" data-acao="trilha-sessao" data-st="' + esc(std.id) + '" data-tipo="' + tipoT + '">' + esc(rotuloPausa(chPT, e.novos ? 'Pré-teste · ' + pl(Math.min(8, e.novos), 'item', 'itens') : 'Praticar · ' + pl(Math.min(20, e.n), 'item', 'itens'))) + '</button>' +
        '<button class="btn pequeno" data-acao="subtema" data-st="' + esc(std.id) + '">Aula e subtema</button>', extra: botaoRecomecar(chPT) });
  }
  if (!dia && !atrasados.length) {
    passos.push({ titulo: 'Questões livres', feito: d.r >= S.perfil.meta, texto: 'Sem sessão programada para hoje. Uma rodada leve mantém a sequência.',
      botoes: '<button class="btn pequeno primario" data-acao="treino-rapido">Treino de 20 itens</button>' });
  }
  if (stH) { /* a lei do dia já é um passo acima */ } else if (arts.length) {
    passos.push({ titulo: 'Lei seca grifada', feito: lidosHoje >= arts.length,
      texto: (leitura.total > arts.length ? arts.length + ' dos ' + leitura.total + ' artigos do dia (lista curta, não lidos e mais cobrados)' : inicial(rotulosArts(arts))) + ' · lidos hoje: ' + lidosHoje + ' de ' + arts.length + '.',
      botoes: '<button class="btn pequeno" data-acao="ler-dia">Ler em sequência</button>' });
  } else {
    passos.push({ titulo: 'Lei seca grifada', feito: (d.a || []).length >= 3, texto: 'Abra os artigos das questões que você errou.',
      botoes: '<button class="btn pequeno" data-acao="ir" data-vista="lei">Abrir a lei</button>' });
  }
  const metaNovos = Math.min(novosDisp + (d.n || 0), S.perfil.novosCards || 20, 10);
  passos.push({ titulo: 'Cards cloze', feito: (d.n || 0) >= metaNovos && cardsV === 0,
    texto: (cardsBlocos.length ? 'Lacunas dos artigos do dia. ' : 'Lacunas de todas as normas. ') + 'Novos hoje: ' + (d.n || 0) + ' de ' + (S.perfil.novosCards || 20) + '.',
    botoes: '<button class="btn pequeno" data-acao="cards-dia">Estudar cards</button>' });
  const sugest = sugestoesDoDia(blocos);
  passos.push({ titulo: 'Para pesquisar', feito: pesqHoje > 0,
    texto: sugest.length ? 'Sugestão: ' + sugest[0] + '.' : 'Abra a sua lista e pesquise um tema.',
    botoes: (sugest.length ? '<button class="btn pequeno primario" data-acao="investigar" data-t="' + esc(sugest[0]) + '" data-o="roteiro do dia">Investigar</button>' : '') +
      '<button class="btn pequeno" data-acao="mais" data-sub="pesquisar">Minha lista (' + Object.values(S.pesquisa).filter((p) => !p.s).length + ')</button>' });
  return { dia, passos };
}
/* ================= Atraso do plano: nada fica sem estudar ================= */
// Dias do plano (desde o início do uso do app) cuja sessão não foi feita, e a leitura desses dias nunca aberta. Nada
// sai daqui por prazo: o dia só sai quando a matéria dele é estudada, por qualquer caminho, ou quando é dispensado.
// - Dia de questões dá baixa sozinho quando, a partir da data dele, você respondeu ao menos metade dos itens
//   previstos (mínimo 10) dos blocos daquele dia, em qualquer sessão (recuperação, treino, batalha, intercaladas).
// - Dia de revisão perdido não vira atraso: o que venceu continua na lista curta e entra na próxima revisão.
// - Simulado perdido fica na lista, para ser feito quando der.
// A recuperação mistura os blocos atrasados, dos dias mais antigos para os mais novos, e entra no roteiro do dia.
function tocadosDesde(b, desde) {
  let n = 0;
  for (const q of POR_BLOCO.get(b) || []) { const r = rec(q.id); if (r && r[0] >= 0 && r[4] >= desde) n++; }
  return n;
}
// Quanto cada matéria do dia pede: metade da sua parte dos itens previstos (mínimo 3, nunca mais que o bloco tem)
function alvoBloco(dia, b) { return Math.min((POR_BLOCO.get(b) || []).length, Math.max(3, Math.ceil(dia.n / dia.blocos.length / 2))); }
// O que ainda falta em cada matéria do dia para ele dar baixa
function faltaDoDia(dia) {
  const desde = diaNum(dia.data);
  return dia.blocos.map((b) => ({ b, falta: Math.max(0, alvoBloco(dia, b) - tocadosDesde(b, desde)) })).filter((x) => x.falta > 0);
}
function diaCompensado(dia) { return dia.modo === 'treino' && dia.blocos.length > 0 && !faltaDoDia(dia).length; }
// Todos os artigos vivos dos blocos do dia (a leitura do dia mostra no máximo LEITURA_MAX deles)
function artigosTodosDoDia(dia) {
  if (stDoDia(dia)) return artsDoSubtema(stDoDia(dia));
  const out = [];
  for (const b of blocosDoDia(dia)) { const bl = BI.get(b); for (const a of (bl && bl.artigos) || []) { const k = chave(bl.lei || 'lgpd', a); if (artigoVivo(k) && !out.includes(k)) out.push(k); } }
  return out;
}
// Leitura atrasada de um dia passado: conta como feita quando você leu tantos artigos daquele dia quanto a leitura do
// dia pedia (todos, ou LEITURA_MAX); até lá, mostra os não lidos que faltam, os mais importantes primeiro
function leituraAtrasadaDoDia(dia, lidos) {
  const todos = artigosTodosDoDia(dia), alvo = Math.min(todos.length, LEITURA_MAX), feitos = todos.filter((k) => lidos[k]).length;
  return feitos >= alvo ? [] : todos.filter((k) => !lidos[k]).sort((a, b) => importancia(b) - importancia(a)).slice(0, alvo - feitos);
}
// Discursiva do plano: o dia com "disc" pede uma discursiva corrigida e salva (uma por semana; duas nas seis últimas).
// Cada correção salva dá baixa em um dia: o de hoje primeiro, depois o atrasado mais antigo, depois o próximo da semana
// (adiantar vale). Vale qualquer tema; o do dia vem sugerido. A baixa fica em S.perfil.feitos['disc:' + data].
const DIAS_DISC = DIAS.filter((d) => d.disc);
function discFeita(dia) { return !!S.perfil.feitos['disc:' + dia.data]; }
function discDeHoje() { const h = hojeISO(); return DIAS_DISC.find((d) => d.data === h) || null; }
function temaDisc(dia) { return TEMAS_DISC.find((t) => t.id === dia.disc) || null; }
function darBaixaDisc() {
  const h = hojeISO(), fim = isoDeNum(HOJE() + ((7 - diaSemana(h)) % 7));
  const atrasadas = pendencias().filter((x) => x.disc).map((x) => x.dia);
  const alvo = [discDeHoje()].concat(atrasadas, DIAS_DISC.filter((d) => d.data > h && d.data <= fim)).find((d) => d && !discFeita(d));
  // a baixa muda as pendências: o cálculo guardado para esta tarefa deixa de valer
  if (alvo) { S.perfil.feitos['disc:' + alvo.data] = 1; pendCache = null; }
  return alvo;
}
function botaoDiscDia(dia, primario) {
  return '<button class="btn pequeno' + (primario ? ' primario' : '') + '" data-acao="disc-dia" data-t="' + esc(dia.disc) + '">' + (estadoDisc(dia.disc).rascunho ? 'Continuar a discursiva' : 'Escrever a discursiva') + '</button>';
}
// Várias partes da tela pedem as pendências no mesmo desenho: o cálculo vale até o fim da tarefa atual
function pendencias() {
  if (!pendCache) { pendCache = calcularPendencias(); queueMicrotask(() => { pendCache = null; }); }
  return pendCache;
}
// O atraso conta a partir da criação do perfil (quem começa no meio do plano não herda semanas de atraso), ou do
// início do plano, se a pessoa pedir para incluir os dias anteriores (S.perfil.atrasoDesde)
function inicioAtraso() { return S.perfil.atrasoDesde || S.perfil.criado || hojeISO(); }
// Dias do plano antes do início do atraso, já passados e não dispensados (revisão sem discursiva não conta, como no
// atraso): ficam de fora até a pessoa incluí-los
function diasAntesDoAtraso() {
  const ini = inicioAtraso(), disp = S.perfil.dispensados || {};
  return DIAS.filter((d) => d.data < ini && d.data < hojeISO() && !disp[d.data] && (d.modo !== 'revisao' || d.disc));
}
function calcularPendencias() {
  const h = hojeISO(), ini = inicioAtraso();
  const disp = S.perfil.dispensados || {}, lidos = S.perfil.lidos || {};
  const out = [];
  for (const dia of DIAS) {
    if (dia.data >= h || dia.data < ini || disp[dia.data]) continue;
    const sessao = !S.perfil.feitos[dia.data] && dia.modo !== 'revisao' && !diaCompensado(dia);
    const ler = leituraAtrasadaDoDia(dia, lidos);
    const disc = !!dia.disc && !discFeita(dia);
    if (sessao || ler.length || disc) out.push({ dia, sessao, ler, disc });
  }
  return out;
}
// Blocos dos dias de questões atrasados, na ordem do dia mais antigo; cada um com quantos dias o pedem
function blocosAtrasados(p) {
  const m = new Map();
  for (const x of p || pendencias()) if (x.sessao && x.dia.modo === 'treino') for (const b of x.dia.blocos) m.set(b, (m.get(b) || 0) + 1);
  return [...m.entries()].map(([b, dias]) => ({ b, dias }));
}
function leituraAtrasada(p) {
  const arts = [];
  for (const x of p || pendencias()) for (const k of x.ler) if (!arts.includes(k)) arts.push(k);
  return arts;
}
// Sessão de recuperação: o dia atrasado mais antigo, com o que falta em cada matéria dele. Terminada, o dia dá baixa.
function proximaRecuperacao(p) {
  const x = (p || pendencias()).find((y) => y.sessao && y.dia.modo === 'treino');
  if (!x) return null;
  const falta = faltaDoDia(x.dia);
  return { dia: x.dia, falta, n: falta.reduce((a, f) => a + f.falta, 0) };
}
function cfgRecuperacao() {
  const r = proximaRecuperacao();
  if (!r) return null;
  const usados = new Set();
  const st = stDoDia(r.dia);
  const ids = st ? idsDoSubtemaNoDia(st, r.dia.blocos, Math.max(r.n, 10)) : [];
  if (!st) for (const f of r.falta) for (const q of selecionar(poolDe([f.b]).filter((q) => !usados.has(q.id)), f.falta, 'mistas')) { usados.add(q.id); ids.push(q.id); }
  return ids.length ? { modo: 'treino', ids: embaralhar(ids), titulo: 'Recuperação · ' + fmtData(r.dia.data, { weekday: 'short', day: '2-digit', month: '2-digit' }), dia: 'rec:' + hojeISO() } : null;
}
function botaoRecuperar(p) {
  const r = proximaRecuperacao(p);
  return r ? '<button class="btn pequeno primario" data-acao="recuperar">' + esc(rotuloPausa('rec:' + hojeISO(), 'Recuperar ' + fmtData(r.dia.data, { day: '2-digit', month: '2-digit' }) + ' · ' + pl(r.n, 'item', 'itens'))) + '</button>' : '';
}
// Linha que explica o que não entra no atraso: os dias antes do perfil (com botão para incluí-los) e a revisão de ontem
function notaForaDoAtraso() {
  const antes = diasAntesDoAtraso(), ontem = DIAS.find((d) => d.data === isoDeNum(HOJE() - 1));
  let t = '';
  if (antes.length) t += '<p class="pequeno">Os ' + pl(antes.length, 'dia', 'dias') + ' do plano de ' + esc(fmtData(antes[0].data, { day: '2-digit', month: '2-digit' })) + ' a ' + esc(fmtData(antes[antes.length - 1].data, { day: '2-digit', month: '2-digit' })) + ' ficaram fora do atraso porque o seu perfil começou em ' + esc(fmtData(inicioAtraso(), { day: '2-digit', month: '2-digit' })) + '. <button class="linkish" data-acao="atraso-desde-inicio">Incluir esses dias no atraso</button></p>';
  if (ontem && ontem.modo === 'revisao' && !S.perfil.feitos[ontem.data] && ontem.data >= inicioAtraso()) t += '<p class="pequeno mudo">A revisão de ontem não vira atraso: o que venceu continua na lista curta e entra na próxima revisão.</p>';
  return t;
}
function cartaoPendencias() {
  const p = pendencias();
  if (!p.length) {
    const nota = notaForaDoAtraso();
    return nota ? '<div class="cartao pendencias vazio"><div class="secao-cab"><h2>Atraso do plano</h2><span class="mono pequeno mudo">0</span></div><p class="pequeno mudo">Nada ficou para trás desde ' + esc(fmtData(inicioAtraso(), { day: '2-digit', month: '2-digit' })) + '.</p>' + nota + '</div>' : '';
  }
  const bs = blocosAtrasados(p), ler = leituraAtrasada(p), sims = p.filter((x) => x.sessao && x.dia.modo === 'simulado');
  const dias = p.filter((x) => x.sessao).length;
  let h = '<div class="cartao pendencias"><div class="secao-cab"><h2>Atraso do plano</h2><span class="mono pequeno mudo">' + p.length + '</span></div>' +
    '<p class="pequeno mudo">Nada sai daqui sozinho: o dia só sai quando você estuda a matéria dele, por qualquer caminho, ou o dispensa.</p>';
  if (bs.length) h += '<div class="atraso-materias">' + bs.slice(0, 6).map((x) => '<span class="chip-atraso">' + esc(nomeBloco(x.b)) + (x.dias > 1 ? ' <b>×' + x.dias + '</b>' : '') + '</span>').join('') + (bs.length > 6 ? '<span class="chip-atraso mais">+' + pl(bs.length - 6, 'matéria', 'matérias') + '</span>' : '') + '</div>' +
    '<div class="linha-btns">' + botaoRecuperar(p) + (ler.length ? '<button class="btn pequeno" data-acao="ler-atraso">Ler ' + Math.min(ler.length, LEITURA_MAX) + (ler.length > LEITURA_MAX ? ' de ' + ler.length : '') + ' artigos</button>' : '') + '</div>';
  else if (ler.length) h += '<div class="linha-btns"><button class="btn pequeno primario" data-acao="ler-atraso">Ler ' + Math.min(ler.length, LEITURA_MAX) + (ler.length > LEITURA_MAX ? ' de ' + ler.length : '') + ' artigos atrasados</button></div>';
  const discs = p.filter((x) => x.disc);
  if (discs.length) h += '<div class="pend"><div class="pend-txt"><b>' + pl(discs.length, 'discursiva atrasada', 'discursivas atrasadas') + '</b><span>A mais antiga: ' + esc(fmtData(discs[0].dia.data, { day: '2-digit', month: '2-digit' })) + ', ' + esc((temaDisc(discs[0].dia) || { titulo: discs[0].dia.disc }).titulo) + '. Cada discursiva corrigida e salva dá baixa numa delas.</span></div><div class="linha-btns">' + botaoDiscDia(discs[0].dia, !bs.length) + '</div></div>';
  for (const x of sims) h += '<div class="pend"><div class="pend-txt"><b>Simulado de ' + esc(fmtData(x.dia.data, { day: '2-digit', month: '2-digit' })) + '</b><span>' + esc(x.dia.atividade) + '</span></div><div class="linha-btns"><button class="btn pequeno" data-acao="iniciar-dia" data-dia="' + x.dia.data + '">' + esc(rotuloPausa(x.dia.data, 'Fazer agora')) + '</button></div></div>';
  h += '<details class="det-lista" data-det="atraso"' + (UI.det.atraso ? ' open' : '') + '><summary>Ver os ' + pl(p.length, 'dia', 'dias') + (dias ? ' (' + dias + ' com sessão)' : '') + '</summary>' +
    p.map((x) => {
      const oque = [x.sessao ? (x.dia.modo === 'simulado' ? 'o simulado' : 'a sessão de ' + x.dia.n + ' itens') : '', x.ler.length ? pl(x.ler.length, 'artigo da leitura', 'artigos da leitura') : '', x.disc ? 'a discursiva' : ''].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' e $1');
      // O que o dia já tem fica à vista: feita a sessão, sobra só a leitura (ou a discursiva)
      const jaFeito = !x.sessao && x.dia.modo !== 'revisao' ? (x.dia.modo === 'simulado' ? 'Simulado feito. ' : 'Questões feitas. ') : '';
      return '<div class="pend"><div class="pend-txt"><b>' + esc(fmtData(x.dia.data, { weekday: 'short', day: '2-digit', month: '2-digit' })) + '</b><span>' + esc(x.dia.atividade) + '</span><span class="pequeno mudo">' + (jaFeito ? '✓ ' + jaFeito : '') + 'Falta' + (!!x.sessao + !!x.ler.length + !!x.disc > 1 || x.ler.length > 1 ? 'm ' : ' ') + esc(oque) + '.</span></div>' +
        '<div class="linha-btns">' + (x.sessao && x.dia.modo !== 'simulado' ? '<button class="btn pequeno" data-acao="iniciar-dia" data-dia="' + x.dia.data + '">' + esc(rotuloPausa(x.dia.data, 'Fazer este dia')) + '</button>' : '') +
        (x.ler.length ? '<button class="btn pequeno" data-acao="ler-pendente" data-dia="' + x.dia.data + '">Ler ' + x.ler.length + '</button>' : '') +
        (x.disc ? botaoDiscDia(x.dia) : '') +
        '<button class="linkish pequeno" data-acao="dispensar-dia" data-dia="' + x.dia.data + '">Dispensar</button></div></div>';
    }).join('') + '</details>';
  return h + notaForaDoAtraso() + '</div>';
}

/* ================= Jornada: RPG em cima do estudo de verdade ================= */
// O herói é você: o nível vem do XP, os atributos são o seu domínio real em cada disciplina, e o equipamento sai do
// saque. Toda semana um chefão encarna o bloco em que você está mais fraco. Acertar item desse bloco causa dano
// (mais em item difícil, em dobro no crítico); na batalha, cada erro custa um coração e três acertos seguidos
// devolvem um. Os itens do saque são os princípios e conceitos da LGPD, com o texto da lei como descrição.
// Nada disso tira XP, e missão não feita não acumula para o dia seguinte.
const MISSOES = [
  { id: 'q30', txt: 'Responder 30 itens', xp: 30, meta: 30, val: (d) => d.r || 0 },
  { id: 'q60', txt: 'Responder 60 itens', xp: 60, meta: 60, val: (d) => d.r || 0 },
  { id: 'novas', txt: 'Responder 20 itens inéditos', xp: 40, meta: 20, val: (d) => d.ni || 0 },
  { id: 'acerto', txt: 'Acertar 80% de pelo menos 20 itens', xp: 40, meta: 1, val: (d) => ((d.r || 0) >= 20 && d.c / d.r >= 0.8 ? 1 : 0), fr: (d) => Math.min(1, (d.r || 0) / 20) },
  { id: 'combo', txt: 'Acertar 10 seguidos', xp: 30, meta: 10, val: (d) => d.cmb || 0 },
  { id: 'lei5', txt: 'Ler 5 artigos da lei seca', xp: 30, meta: 5, val: (d) => (d.a || []).length },
  { id: 'cards20', txt: 'Revisar 20 cards', xp: 30, meta: 20, val: (d) => d.k || 0 },
  { id: 'tempo60', txt: 'Estudar 1 hora', xp: 40, meta: 60, val: (d) => Math.floor(segundosEstudo(d) / 60) },
  { id: 'virada', txt: 'Acertar 5 itens que você tinha errado em outro dia', xp: 50, meta: 5, val: (d) => d.vr || 0, so: () => Object.values(S.itens).filter((r) => r[0] === 0 && r[3] > 0 && r[4] < HOJE()).length >= 5 },
  { id: 'pesq', txt: 'Investigar um tema da lista Para pesquisar', xp: 30, meta: 1, val: () => Object.values(S.pesquisa).filter((p) => p.s && p.f === hojeISO()).length },
  { id: 'pend', txt: 'Recuperar uma sessão do atraso', xp: 60, meta: 1, val: (d) => d.pd || 0, so: () => pendencias().some((x) => x.sessao) },
  { id: 'rel', txt: 'Jogar uma rodada do Relâmpago', xp: 30, meta: 1, val: (d) => d.rl || 0, acao: () => '<button class="linkish pequeno" data-acao="relampago" data-blocos="' + P1.join(',') + '">Jogar</button>' },
  { id: 'chefe5', txt: 'Acertar 5 golpes no chefão', xp: 40, meta: 5, val: (d) => (chefeDaSemana().vencido ? 5 : d.cg || 0), so: () => !chefeDaSemana().vencido },
];
const MI = new Map(MISSOES.map((m) => [m.id, m]));
const BAU_XP = 50, CHEFE_VIDA = 300, CHEFE_XP = 150, CORACOES = 5, BATALHA_N = 15;
const CHEFES = { lgpd: 'O Vazador de Dados', regulacao: 'O Regulador Capturado', direito: 'O Burocrata Sem Motivação', linguas: 'A Esfinge dos Conectivos', seginfo: 'O Ransomware', gestao: 'O Risco Sem Dono', eca: 'O Algoritmo Viciante', economia: 'O Monopolista', comparado: 'O Exportador Sem Adequação', contabil: 'O Rombo nas Contas' };
// Brasão de cada chefão: um escudo com o símbolo da disciplina
const SIMBOLOS = {
  lgpd: '<rect x="9" y="11" width="6" height="5" rx="1"/><path d="M10 11V9.5a2 2 0 0 1 4 0V11"/>',
  regulacao: '<path d="M12 7v10M8 17h8M7 10h10M7 10l-1.5 3h3zM17 10l-1.5 3h3z"/>',
  direito: '<path d="M7 9h10M8 9v7M12 9v7M16 9v7M7 16h10M12 6.5 17 9H7z"/>',
  linguas: '<path d="M8 8h8v6h-4l-3 2.5V14H8z"/>',
  seginfo: '<path d="M13 6.5 9.5 12.5H12l-1 5 3.5-6H12z"/>',
  gestao: '<circle cx="12" cy="12" r="2.2"/><path d="M12 7.5v1.6M12 14.9v1.6M7.5 12h1.6M14.9 12h1.6M8.8 8.8l1.1 1.1M14.1 14.1l1.1 1.1M8.8 15.2l1.1-1.1M14.1 9.9l1.1-1.1"/>',
  eca: '<path d="M6.5 12s2-3.5 5.5-3.5 5.5 3.5 5.5 3.5-2 3.5-5.5 3.5S6.5 12 6.5 12z"/><circle cx="12" cy="12" r="1.4"/>',
  economia: '<circle cx="12" cy="12" r="4"/><path d="M12 9.5v5M10.8 10.5h2a.9.9 0 0 1 0 1.8h-1.6a.9.9 0 0 0 0 1.8h2"/>',
  comparado: '<circle cx="12" cy="12" r="4"/><path d="M8 12h8M12 8c1.3 1.2 1.3 6.8 0 8M12 8c-1.3 1.2-1.3 6.8 0 8"/>',
  contabil: '<path d="M7.5 8.5h9M7.5 12h9M7.5 15.5h9M12 7v10"/>',
};
function brasao(disc) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="escudo" d="M12 2.5 19.5 5v6.2c0 4.6-3.2 8.3-7.5 10.3-4.3-2-7.5-5.7-7.5-10.3V5z"/>' + (SIMBOLOS[disc] || SIMBOLOS.lgpd) + '</svg>'; }
function coracao(cheio, cls) { return '<svg class="cor' + (cheio ? ' cheio' : '') + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>'; }

// Saque: quatro raridades e três encaixes. Arma aumenta o dano, armadura dá corações extras na batalha e amuleto dá
// chance de crítico. A descrição é o texto da lei.
const RARIDADES = { comum: { nome: 'Comum', ordem: 0 }, raro: { nome: 'Raro', ordem: 1 }, epico: { nome: 'Épico', ordem: 2 }, lendario: { nome: 'Lendário', ordem: 3 } };
const ENCAIXES = { arma: 'Arma', armadura: 'Armadura', amuleto: 'Amuleto' };
const EFEITO = { arma: { comum: 10, raro: 20, epico: 35, lendario: 50 }, armadura: { comum: 1, raro: 1, epico: 2, lendario: 3 }, amuleto: { comum: 5, raro: 10, epico: 15, lendario: 25 } };
const ITENS_RPG = [
  { id: 'necessidade', slot: 'arma', rar: 'comum', nome: 'Lâmina da Necessidade', lore: 'limitação do tratamento ao mínimo necessário para a realização de suas finalidades', ref: 'LGPD, art. 6º, III' },
  { id: 'adequacao', slot: 'arma', rar: 'raro', nome: 'Lança da Adequação', lore: 'compatibilidade do tratamento com as finalidades informadas ao titular, de acordo com o contexto do tratamento', ref: 'LGPD, art. 6º, II' },
  { id: 'finalidade', slot: 'arma', rar: 'epico', nome: 'Espada da Finalidade', lore: 'realização do tratamento para propósitos legítimos, específicos, explícitos e informados ao titular', ref: 'LGPD, art. 6º, I' },
  { id: 'sancao', slot: 'arma', rar: 'lendario', nome: 'Martelo da Autoridade Nacional', lore: 'A aplicação das sanções previstas nesta Lei compete exclusivamente à ANPD', ref: 'LGPD, art. 55-K' },
  { id: 'pseudonimizacao', slot: 'armadura', rar: 'comum', nome: 'Capa da Pseudonimização', lore: 'um dado perde a possibilidade de associação, direta ou indireta, a um indivíduo, senão pelo uso de informação adicional mantida separadamente pelo controlador', ref: 'LGPD, art. 13, § 4º' },
  { id: 'prevencao', slot: 'armadura', rar: 'raro', nome: 'Cota da Prevenção', lore: 'adoção de medidas para prevenir a ocorrência de danos em virtude do tratamento de dados pessoais', ref: 'LGPD, art. 6º, VIII' },
  { id: 'seguranca', slot: 'armadura', rar: 'epico', nome: 'Couraça da Segurança', lore: 'medidas técnicas e administrativas aptas a proteger os dados pessoais de acessos não autorizados', ref: 'LGPD, art. 6º, VII' },
  { id: 'concepcao', slot: 'armadura', rar: 'lendario', nome: 'Égide da Concepção', lore: 'desde a fase de concepção do produto ou do serviço até a sua execução', ref: 'LGPD, art. 46, § 2º' },
  { id: 'livre-acesso', slot: 'amuleto', rar: 'comum', nome: 'Talismã do Livre Acesso', lore: 'consulta facilitada e gratuita sobre a forma e a duração do tratamento', ref: 'LGPD, art. 6º, IV' },
  { id: 'transparencia', slot: 'amuleto', rar: 'raro', nome: 'Lente da Transparência', lore: 'informações claras, precisas e facilmente acessíveis sobre a realização do tratamento', ref: 'LGPD, art. 6º, VI' },
  { id: 'nao-discriminacao', slot: 'amuleto', rar: 'epico', nome: 'Selo da Não Discriminação', lore: 'impossibilidade de realização do tratamento para fins discriminatórios ilícitos ou abusivos', ref: 'LGPD, art. 6º, IX' },
  { id: 'prestacao-contas', slot: 'amuleto', rar: 'lendario', nome: 'Coroa da Prestação de Contas', lore: 'demonstração, pelo agente, da adoção de medidas eficazes e capazes de comprovar a observância e o cumprimento das normas', ref: 'LGPD, art. 6º, X' },
];
const IR = new Map(ITENS_RPG.map((x) => [x.id, x]));
const XP_REPETIDO = { comum: 20, raro: 40, epico: 80, lendario: 150 };
function efeitoTxt(it) { const v = EFEITO[it.slot][it.rar]; return it.slot === 'arma' ? '+' + v + '% de dano' : it.slot === 'armadura' ? '+' + pl(v, 'coração', 'corações') : '+' + v + '% de crítico'; }

function rpg() {
  const r = (S.perfil.rpg ||= {});
  r.inv ||= {};
  r.eq ||= {};
  return r;
}
function equipado(slot) { const id = rpg().eq[slot]; return id && rpg().inv[id] ? IR.get(id) : null; }
function bonusDano() { const a = equipado('arma'); return a ? EFEITO.arma[a.rar] : 0; }
function chanceCritico() { const a = equipado('amuleto'); return a ? EFEITO.amuleto[a.rar] : 0; }
function coracoesMax() { const a = equipado('armadura'); return CORACOES + (a ? EFEITO.armadura[a.rar] : 0); }
// Sorteio de saque. O item repetido vira XP; o novo vai para o inventário e é equipado se o encaixe estiver vazio
// ou ocupado por item de raridade menor.
function sortearRaridade(pesos) {
  let x = Math.random() * Object.values(pesos).reduce((a, b) => a + b, 0);
  for (const [k, p] of Object.entries(pesos)) { x -= p; if (x < 0) return k; }
  return 'comum';
}
function saque(pesos) {
  const rar = sortearRaridade(pesos), opcoes = ITENS_RPG.filter((x) => x.rar === rar);
  const it = opcoes[Math.floor(Math.random() * opcoes.length)];
  const r = rpg();
  if (r.inv[it.id]) { ganharXP(XP_REPETIDO[rar]); return { it, repetido: true }; }
  r.inv[it.id] = hojeISO();
  const atual = equipado(it.slot);
  if (!atual || RARIDADES[atual.rar].ordem < RARIDADES[rar].ordem) r.eq[it.slot] = it.id;
  return { it, repetido: false };
}
function avisarSaque(origem, s) {
  avisar('◆', origem + ': ' + s.it.nome, RARIDADES[s.it.rar].nome + ' · ' + (s.repetido ? 'repetido, virou +' + XP_REPETIDO[s.it.rar] + ' XP' : efeitoTxt(s.it)));
}

function hashTxt(t) { let h = 2166136261; for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
// As missões do dia são sorteadas uma vez (pela data) e ficam guardadas; a de pendência entra sempre que houver
// sessão para encaixar, e nunca saem duas de "responder N itens" no mesmo dia
function missoesHoje() {
  const h = hojeISO(), r = rpg(), m = (r.m ||= {});
  if (!m[h]) {
    const pool = MISSOES.filter((x) => !x.so || x.so());
    const ids = pool.some((x) => x.id === 'pend') ? ['pend'] : [];
    for (const x of pool.filter((y) => y.id !== 'pend').sort((a, b) => hashTxt(h + a.id) - hashTxt(h + b.id))) {
      if (ids.length >= 3) break;
      if (x.id.startsWith('q') && /^q\d/.test(x.id) && ids.some((i) => /^q\d/.test(i))) continue;
      ids.push(x.id);
    }
    m[h] = { ids, ok: {} };
    const limite = isoDeNum(HOJE() - 14);
    for (const k of Object.keys(m)) if (k < limite) delete m[k];
  }
  return m[h];
}
function verificarRPG() {
  const d = diaLog(), mh = missoesHoje();
  let mudou = false;
  for (const id of mh.ids) {
    const x = MI.get(id);
    if (!x || mh.ok[id] || x.val(d) < x.meta) continue;
    mh.ok[id] = 1; mudou = true;
    ganharXP(x.xp);
    avisar('★', 'Missão cumprida', x.txt + ' · +' + x.xp + ' XP');
    tocar('combo');
  }
  if (!mh.bau && mh.ids.length && mh.ids.every((id) => mh.ok[id])) {
    mh.bau = 1; mudou = true;
    // O histórico de missões guarda só 14 dias; o total de baús fica num contador próprio
    rpg().baus = (rpg().baus || 0) + 1;
    ganharXP(BAU_XP);
    const s = saque({ comum: 60, raro: 30, epico: 9, lendario: 1 });
    mh.item = s.it.id;
    avisarSaque('Baú do dia', s);
    tocar('festa');
  }
  if (mudou) Store.salvar('perfil');
}
function semanaAtual() { return isoDeNum(HOJE() - ((diaSemana(hojeISO()) + 6) % 7)); }
function discChefe(bloco) { const b = BI.get(bloco); return (b && b.disciplina) || 'lgpd'; }
function nomeChefe(bloco) { return CHEFES[discChefe(bloco)] || 'O Chefão'; }
// Chefão da semana (de segunda a domingo): o bloco mais fraco entre os já praticados (5 ou mais itens respondidos),
// sem repetir o da semana anterior; quem ainda não praticou nada enfrenta o bloco mais fraco da prioridade 1.
// Chefão salvo antes da escala de 300 de vida (15 golpes) é convertido na mesma proporção.
function normalizarChefe(c) {
  if (c && !c.max) { c.vida = Math.round((c.vida / 15) * CHEFE_VIDA); c.max = CHEFE_VIDA; }
  return c;
}
function chefeDaSemana() {
  const r = rpg(), sem = semanaAtual();
  if (!r.chefe || r.chefe.sem !== sem) {
    const anterior = r.chefe && r.chefe.bloco;
    const cand = BLOCOS.filter((b) => (POR_BLOCO.get(b.id) || []).length >= 20 && b.id !== anterior).map((b) => ({
      b, dom: dominioBloco(b.id) || 0, resp: POR_BLOCO.get(b.id).filter((q) => { const x = rec(q.id); return x && x[0] >= 0; }).length,
    }));
    const praticados = cand.filter((x) => x.resp >= 5);
    const alvo = (praticados.length ? praticados : cand.filter((x) => P1.includes(x.b.id))).sort((a, b) => a.dom - b.dom)[0] || cand[0];
    r.chefe = { sem, bloco: alvo.b.id, vida: CHEFE_VIDA, max: CHEFE_VIDA };
  }
  normalizarChefe(r.chefe);
  return r.chefe;
}
// Dano de um acerto: 10, 15 ou 20 pela dificuldade do item, mais o bônus da arma. É crítico (dano em dobro) quando o
// artigo do item já caiu em prova real ou, ao acaso, pela chance do amuleto.
function danoDe(q) {
  const base = 5 + 5 * Math.min(3, Math.max(1, q.d || 2));
  const crit = caiuEmProva(q) > 0 || Math.random() * 100 < chanceCritico();
  return { dano: Math.round(base * (1 + bonusDano() / 100)) * (crit ? 2 : 1), crit };
}
function golpeChefe(q) {
  const c = chefeDaSemana();
  if (c.vencido || q.b !== c.bloco) return;
  const { dano, crit } = danoDe(q);
  c.vida = Math.max(0, c.vida - dano);
  const d = diaLog();
  d.cg = (d.cg || 0) + 1;
  golpeRecente = { dano, crit, vida: c.vida, max: c.max, vencido: !c.vida };
  if (c.vida) return;
  c.vencido = hojeISO();
  ganharXP(CHEFE_XP);
  rpg().trofeus = rpg().trofeus || [];
  rpg().trofeus.unshift({ sem: c.sem, bloco: c.bloco, data: hojeISO() });
  const s = saque({ raro: 50, epico: 40, lendario: 10 });
  c.item = s.it.id;
  golpeRecente.item = s;
  avisarSaque('Saque do chefão', s);
}

// Arena: o chefão em cima, com brasão, nome e barra de vida; embaixo, o herói com nível e corações. Na batalha, os
// corações valem; fora dela, a faixa aparece só quando o item é do bloco do chefão.
function hpBarra(vida, max, cls) { return '<div class="hp' + (cls ? ' ' + cls : '') + '" role="img" aria-label="Vida ' + vida + ' de ' + max + '"><i style="width:' + Math.round((vida / max) * 100) + '%"></i></div>'; }
function renderArena(q) {
  if (sessao.modo === 'simulado') return '';
  const c = chefeDaSemana(), g = sessao.revelado || sessao.flash ? sessao.golpe : null, bat = sessao.batalha;
  if (!bat && (c.vencido || !q || q.b !== c.bloco) && !g) return '';
  const disc = discChefe(c.bloco);
  let h = '<div class="arena' + (bat ? '' : ' faixa') + '"><div class="arena-inimigo' + (g ? ' atingido' : '') + (c.vencido ? ' caido' : '') + '"><span class="brasao">' + brasao(disc) + '</span>' +
    '<div class="arena-info"><b>' + esc(nomeChefe(c.bloco)) + '</b>' + hpBarra(c.vencido ? 0 : c.vida, c.max) + '<span class="mono hp-num">HP ' + (c.vencido ? 0 : c.vida) + '/' + c.max + '</span></div>' +
    (g ? '<span class="dano' + (g.crit ? ' crit' : '') + '">' + (g.crit ? '<small>CRÍTICO</small>' : '') + '−' + g.dano + '</span>' : '') + '</div>';
  if (bat) {
    const perdeu = sessao.revelado && sessao.perdeuCoracao, curou = sessao.revelado && sessao.curou;
    h += '<div class="arena-heroi' + (perdeu ? ' ferido' : '') + '"><span class="mono">Nv ' + nivelDe(S.perfil.xp).n + '</span><span class="coracoes" aria-label="' + sessao.coracoes + ' de ' + sessao.coracoesMax + ' corações">' +
      Array.from({ length: sessao.coracoesMax }, (_, k) => coracao(k < sessao.coracoes, perdeu && k === sessao.coracoes ? 'quebra' : curou && k === sessao.coracoes - 1 ? 'volta' : '')).join('') + '</span>' +
      (sessao.combo >= 2 ? '<span class="mono serie">×' + sessao.combo + '</span>' : '') + '</div>';
  }
  return h + '</div>';
}
// Na batalha: erro custa um coração, três acertos seguidos devolvem um; sem corações, ou com o chefão no chão, a
// batalha acaba no próximo toque
function efeitoBatalha(ok) {
  sessao.perdeuCoracao = false; sessao.curou = false;
  if (!sessao.batalha) return;
  if (!ok) { sessao.coracoes = Math.max(0, sessao.coracoes - 1); sessao.perdeuCoracao = true; sessao.perdas = (sessao.perdas || 0) + 1; }
  else if (sessao.combo && sessao.combo % 3 === 0 && sessao.coracoes < sessao.coracoesMax) { sessao.coracoes++; sessao.curou = true; }
  if (sessao.golpe) { sessao.danoTotal = (sessao.danoTotal || 0) + sessao.golpe.dano; if (sessao.golpe.crit) sessao.criticos = (sessao.criticos || 0) + 1; }
  if (!sessao.coracoes) sessao.desfecho = 'derrota';
  else if (sessao.golpe && sessao.golpe.vencido) { sessao.desfecho = 'vitoria'; if (!sessao.perdas) conquistar('perfeita'); }
}
// Encerra a batalha antes do fim da fila: o resultado considera só os itens respondidos
function encerrarBatalha() {
  sessao.ids = sessao.ids.filter((id) => sessao.resp[id]);
  finalizar();
}
function cartaoBatalha() {
  if (!sessao.batalha) return '';
  const c = chefeDaSemana(), fim = sessao.desfecho || (c.vencido ? 'vitoria' : 'recuo');
  const titulo = { vitoria: 'Vitória', derrota: 'Derrota', recuo: 'O chefão resiste' }[fim];
  const s = fim === 'vitoria' && sessao.golpeFinal && sessao.golpeFinal.item;
  return '<div class="cartao batalha-fim ' + fim + '"><div class="bf-cab"><span class="brasao">' + brasao(discChefe(c.bloco)) + '</span><div><span class="rotulo">' + esc(nomeChefe(c.bloco)) + '</span><h2>' + titulo + '</h2></div></div>' +
    hpBarra(c.vencido ? 0 : c.vida, c.max) +
    '<div class="placar"><div><b>' + (sessao.danoTotal || 0) + '</b><span>dano</span></div><div><b>' + (sessao.criticos || 0) + '</b><span>críticos</span></div><div><b>' + sessao.comboMax + '</b><span>maior série</span></div><div><b>' + (c.vencido ? 0 : c.vida) + '</b><span>HP restante</span></div></div>' +
    (s ? cartaoItem(s.it, s.repetido ? 'Repetido: virou +' + XP_REPETIDO[s.it.rar] + ' XP' : 'Novo no inventário') : '') +
    (fim === 'derrota' ? '<p class="pequeno mudo">Sem corações, a batalha acabou. O dano causado fica: o chefão continua com ' + c.vida + ' de vida até domingo.</p>' : '') +
    (fim !== 'vitoria' && !c.vencido ? '<div class="linha-btns"><button class="btn primario" data-acao="enfrentar-chefe">Batalhar de novo</button></div>' : '') + '</div>';
}
function cartaoItem(it, nota) {
  return '<div class="item-rpg r-' + it.rar + '"><div class="ir-cab"><b>' + esc(it.nome) + '</b><span class="mono pequeno">' + RARIDADES[it.rar].nome + ' · ' + ENCAIXES[it.slot] + '</span></div>' +
    '<span class="ir-efeito">' + esc(efeitoTxt(it)) + '</span><q>' + esc(it.lore) + '</q><span class="pequeno mudo">' + esc(it.ref) + (nota ? ' · ' + esc(nota) : '') + '</span></div>';
}

// Card da Jornada no painel: herói, chefão e missões do dia
function cartaoJornada() {
  const d = S.perfil.dias[hojeISO()] || {}, mh = missoesHoje(), c = chefeDaSemana(), nv = nivelDe(S.perfil.xp);
  const feitas = mh.ids.filter((id) => mh.ok[id]).length;
  const missoes = mh.ids.map((id) => {
    const x = MI.get(id);
    if (!x) return '';
    const v = x.val(d), ok = !!mh.ok[id], f = ok ? 1 : x.fr ? x.fr(d) : Math.min(1, v / x.meta);
    return '<div class="missao' + (ok ? ' ok' : '') + '"><span class="m-ic" aria-hidden="true">' + (ok ? '✓' : '★') + '</span><div class="m-txt"><b>' + esc(x.txt) + '</b>' + barra(f, 'ouro') + (!ok && x.acao ? x.acao() : '') + '</div>' +
      '<span class="mono pequeno">' + (ok ? '+' + x.xp + ' XP' : x.fr ? (d.r || 0) + '/20' : Math.min(v, x.meta) + '/' + x.meta) + '</span></div>';
  }).join('');
  const eq = Object.keys(ENCAIXES).map(equipado).filter(Boolean);
  const slots = eq.length ? eq.map((it) => '<span class="slot r-' + it.rar + '" title="' + esc(it.nome + ' · ' + efeitoTxt(it)) + '">' + esc(it.nome) + '</span>').join('') : '<span class="pequeno mudo">Sem equipamento</span>';
  const heroi = '<button class="heroi-rpg" data-acao="mais" data-sub="personagem"><span class="insignia">' + nv.n + '</span><span class="h-info"><b>' + esc(nv.nome) + '</b>' + barra((S.perfil.xp - nv.base) / (nv.prox - nv.base), 'ouro') +
    '<span class="mono pequeno">' + fmtNum(S.perfil.xp) + ' / ' + fmtNum(nv.prox) + ' XP · ' + coracoesMax() + ' ♥ · +' + bonusDano() + '% dano · ' + chanceCritico() + '% crítico</span></span><span class="slots">' + slots + '</span></button>';
  const chefe = '<div class="chefe' + (c.vencido ? ' vencido' : '') + '"><span class="brasao">' + brasao(discChefe(c.bloco)) + '</span><div class="chefe-info"><div class="chefe-cab"><b>' + esc(nomeChefe(c.bloco)) + '</b><span class="mono pequeno">' + (c.vencido ? 'derrotado' : 'HP ' + c.vida + '/' + c.max) + '</span></div>' +
    '<span class="pequeno mudo">' + esc(nomeBloco(c.bloco)) + '</span>' + hpBarra(c.vencido ? 0 : c.vida, c.max) + '</div>' +
    (c.vencido ? '' : '<button class="btn pequeno primario" data-acao="enfrentar-chefe">' + esc(rotuloPausa('chefe:' + c.sem, 'Batalhar')) + '</button>') + '</div>';
  const bau = mh.bau && mh.item && IR.get(mh.item) ? '<p class="pequeno">Baú aberto: <b class="r-txt-' + IR.get(mh.item).rar + '">' + esc(IR.get(mh.item).nome) + '</b></p>' : '<p class="pequeno mudo">Três missões abrem o baú do dia, com um item.</p>';
  return '<div class="cartao jornada"><div class="secao-cab"><h2>Jornada</h2><span class="mono pequeno mudo">' + feitas + '/' + mh.ids.length + ' missões</span></div>' +
    heroi + chefe + '<div class="missoes">' + missoes + '</div>' + bau + '</div>';
}
// Ficha do personagem (Mais → Personagem): atributos medidos pelo domínio real, equipamento e inventário
function dominioDisciplina(disc) {
  let s = 0, n = 0;
  for (const b of BLOCOS) if (b.disciplina === disc) { const qs = POR_BLOCO.get(b.id) || []; if (!qs.length) continue; s += (dominioBloco(b.id) || 0) * qs.length; n += qs.length; }
  return n ? s / n : 0;
}
function renderPersonagem() {
  const nv = nivelDe(S.perfil.xp), r = rpg();
  let h = '<div class="cartao ficha"><div class="ficha-cab"><span class="insignia grande">' + nv.n + '</span><div><span class="rotulo">Nível ' + nv.n + '</span><h2>' + esc(nv.nome) + '</h2>' +
    barra((S.perfil.xp - nv.base) / (nv.prox - nv.base), 'ouro') + '<span class="mono pequeno mudo">' + fmtNum(S.perfil.xp) + ' / ' + fmtNum(nv.prox) + ' XP</span></div></div>' +
    '<div class="placar"><div><b>' + coracoesMax() + '</b><span>corações</span></div><div><b>+' + bonusDano() + '%</b><span>dano</span></div><div><b>' + chanceCritico() + '%</b><span>crítico</span></div><div><b>' + ((r.trofeus || []).length) + '</b><span>chefões</span></div></div></div>';
  // Pontos de 1 a 20 pela raiz do domínio: o começo rende pontos visíveis, e o 20 exige dominar o banco inteiro
  h += '<div class="cartao"><div class="secao-cab"><h2>Atributos</h2><span class="pequeno mudo">de 1 a 20, pelo domínio real</span></div><div class="atributos">' +
    DISC.map((d) => { const v = dominioDisciplina(d.id), pts = 1 + Math.round(19 * Math.sqrt(v)); return '<div class="atributo"><span class="brasao mini">' + brasao(d.id) + '</span><span class="at-nome">' + esc(d.nome) + ' <span class="pequeno mudo">' + Math.round(v * 100) + '%</span></span><b class="mono">' + pts + '</b>' + barra(pts / 20) + '</div>'; }).join('') + '</div></div>';
  h += '<div class="cartao"><div class="secao-cab"><h2>Equipamento</h2></div><div class="equip">' + Object.keys(ENCAIXES).map((s) => { const it = equipado(s); return it ? cartaoItem(it, 'equipado') : '<div class="item-rpg vazio"><b>' + ENCAIXES[s] + '</b><span class="pequeno mudo">Vazio. Baús e chefões dão itens.</span></div>'; }).join('') + '</div></div>';
  const inv = ITENS_RPG.filter((x) => r.inv[x.id]);
  h += '<div class="cartao"><div class="secao-cab"><h2>Inventário</h2><span class="mono pequeno mudo">' + inv.length + '/' + ITENS_RPG.length + '</span></div>' +
    (inv.length ? '<div class="inventario">' + inv.map((it) => '<div class="inv-linha r-' + it.rar + '"><div><b>' + esc(it.nome) + '</b><span class="pequeno mudo">' + RARIDADES[it.rar].nome + ' · ' + ENCAIXES[it.slot] + ' · ' + esc(efeitoTxt(it)) + '</span></div>' +
      (r.eq[it.slot] === it.id ? '<span class="pequeno mudo">equipado</span>' : '<button class="btn pequeno" data-acao="equipar" data-item="' + it.id + '">Equipar</button>') + '</div>').join('') + '</div>'
      : '<p class="pequeno mudo">Vazio. Cumpra as três missões do dia para abrir o baú, ou derrote o chefão da semana.</p>') +
    '<p class="pequeno mudo">Faltam ' + (ITENS_RPG.length - inv.length) + ' para completar a coleção. Cada item traz o texto da LGPD que lhe dá nome.</p></div>';
  return h + cartaoTrofeus();
}
function cartaoTrofeus() {
  const t = (S.perfil.rpg && S.perfil.rpg.trofeus) || [];
  return '<div class="cartao"><div class="secao-cab"><h2>Chefões derrotados</h2><span class="mono pequeno mudo">' + t.length + '</span></div>' +
    (t.length ? '<div class="trofeus">' + t.slice(0, 30).map((x) => '<div class="trofeu"><span aria-hidden="true">♛</span><div><b>' + esc(nomeChefe(x.bloco)) + '</b><span class="pequeno">' + esc(nomeBloco(x.bloco)) + '</span><span class="pequeno mudo">semana de ' + esc(fmtData(x.sem, { day: '2-digit', month: '2-digit' })) + ' · derrotado em ' + esc(fmtData(x.data, { day: '2-digit', month: '2-digit' })) + '</span></div></div>').join('') + '</div>'
      : '<p class="pequeno mudo">Nenhum ainda. O chefão da semana está no painel, no card Jornada.</p>') + '</div>';
}
function renderHoje() {
  const ctx = contextoHoje();
  const d = diaLog();
  const h = hojeISO();
  const rt = roteiroHoje();
  const feitos = rt.passos.filter((p) => p.feito).length;
  const prox = rt.passos.find((p) => !p.feito);
  let topo = '<div class="cartao destaque"><div class="heroi">' +
    '<div><div class="dia">' + esc(fmtData(h, { weekday: 'long' })) + '</div><div class="data">' + esc(fmtData(h, { day: '2-digit', month: 'long', year: 'numeric' })) +
    (ctx.tipo === 'dia' ? ' · ' + esc(ctx.dia.duracao) : '') + '</div></div>' + anel(d.r, S.perfil.meta) +
    '<p class="atividade">' + (ctx.tipo === 'dia' ? esc(ctx.dia.atividade) : ctx.tipo === 'folga' ? '<span class="mudo">Dia livre por padrão. Próxima sessão, ' + esc(fmtData(ctx.prox.data, { weekday: 'short', day: '2-digit', month: '2-digit' })) + ':</span> ' + esc(ctx.prox.atividade) : 'Cronograma concluído: recomece pelos blocos mais fracos e pelo conteúdo do edital.') + '</p>' +
    // O que fazer agora fica na primeira tela: o primeiro passo do roteiro ainda não feito, com o botão dele
    (prox ? '<div class="proximo"><span class="rotulo">Próximo passo · ' + (rt.passos.indexOf(prox) + 1) + ' de ' + rt.passos.length + '</span><b>' + esc(prox.titulo) + '</b><div class="linha-btns">' + prox.botoes + '</div></div>'
      : '<div class="proximo feito"><b>Roteiro de hoje completo.</b><span class="pequeno mudo">Se sobrar tempo, veja o Atraso do plano e a Jornada, mais abaixo.</span></div>') + '</div></div>';
  const aguard = ctx.tipo === 'dia' ? (ctx.dia.blocos || []).filter((b) => BI.get(b) && BI.get(b).aguardando && !(POR_BLOCO.get(b) || []).length) : [];
  if (aguard.length) topo += '<p class="nota-aguardando">' + esc(aguard.map(nomeBloco).join('; ')) + ': ainda sem questões. A sessão usa os blocos ligados ao tema. Cole o texto na conversa com o Claude para ganhar questões próprias.</p>';
  let roteiro = '<div class="cartao"><div class="secao-cab"><h2>Roteiro de hoje</h2><span class="mono pequeno mudo">' + feitos + ' de ' + rt.passos.length + '</span></div><div class="roteiro">';
  rt.passos.forEach((p, i) => {
    roteiro += '<div class="passo' + (p.feito ? ' feito' : '') + '"><div class="marca-passo">' + (p.feito ? '✓' : i + 1) + '</div><div class="corpo-passo"><b>' + esc(p.titulo) + '</b>' + (p.feito || !p.texto ? '' : '<p>' + esc(p.texto) + '</p>') + '<div class="linha-btns">' + p.botoes + (p.extra || '') + '</div></div></div>';
  });
  roteiro += '</div><p class="pequeno mudo">' + (stDoDia(rt.dia) ? 'Matéria nova: revisão do que venceu, pré-teste, lei, aula e questões do mesmo tema, nessa ordem; depois as intercaladas e as lacunas.' : 'A ordem é o método: revisão primeiro, depois questão, depois a lei onde você errou, depois a memorização com lacunas.') + ' <button class="linkish" data-acao="mais" data-sub="metodo">Entenda o método</button></p></div>';
  const modos = '<div class="secao"><div class="secao-cab"><h2>Modos de jogo</h2></div><div class="grade-modos">' +
    '<button class="modo" data-acao="abrir-modo" data-modo="simulado"><b>Simulado Cebraspe</b><span>Uma errada anula uma certa. Prova inteira ou só os seus blocos.</span><span class="num">' + pl(S.simulados.length, 'simulado feito', 'simulados feitos') + '</span></button>' +
    '<button class="modo" data-acao="relampago" data-blocos="' + P1.join(',') + '"><b>Relâmpago 90 s</b><span>Prioridade 1 contra o relógio.</span><span class="num">Recorde: ' + (S.perfil.recordes.relampago || 0) + '</span></button>' +
    '<button class="modo" data-acao="ir" data-vista="cards"><b>Cards cloze</b><span>A letra da lei com lacunas e revisão espaçada.</span><span class="num">' + CARDS.length + ' cards</span></button>' +
    '<button class="modo" data-acao="mais" data-sub="discursiva"><b>Discursiva</b><span>Limite de linhas e correção por quesitos.</span><span class="num">' + pl(TEMAS_DISC.length, 'tema', 'temas') + '</span></button>' +
    '<button class="modo" data-acao="abrir-modo" data-modo="treino"><b>Treino livre</b><span>Escolha os blocos; gabarito comentado a cada item.</span><span class="num">' + Q.length + ' questões</span></button></div></div>';
  // Duas contagens: o prazo legal do edital e a prova estimada (domingo cerca de três meses depois)
  const cr = D.cronograma, faltaEd = diaNum(cr.edital) - HOJE(), faltaPr = diaNum(cr.prova) - HOJE();
  const dataCurta = (iso) => fmtData(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const contagem = (n, txt) => '<div class="contagem">' + (n > 0 ? '<span class="grande">' + n + '</span>' : '') + '<span>' + txt + '</span></div>';
  const edital = '<div class="cartao">' +
    contagem(faltaEd, faltaEd > 0 ? 'dias até ' + dataCurta(cr.edital) + ', prazo legal máximo para o edital.' : faltaEd === 0 ? 'Hoje vence o prazo legal máximo para o edital (' + dataCurta(cr.edital) + ').' : 'O prazo legal do edital (' + dataCurta(cr.edital) + ') passou: acompanhe as notícias.') +
    contagem(faltaPr, faltaPr > 0 ? 'dias até a prova provável, domingo ' + dataCurta(cr.prova) + ' (três meses depois do edital; troque pela data oficial quando sair).' : faltaPr === 0 ? 'Hoje é o dia provável da prova. Boa prova!' : 'A data estimada da prova (' + dataCurta(cr.prova) + ') passou.') + '</div>';
  // Sessões guardadas que não têm botão próprio no roteiro (o dia, as intercaladas e a trilha de hoje já mostram Continuar)
  const fora = new Set(['i:' + h]);
  if (ctx.tipo === 'dia') fora.add(ctx.dia.data);
  // num dia de subtema, o roteiro tem botão só para o pré-teste; a prática guardada continua na lista
  const stH = subtemaDoDia(), diaSt = ctx.tipo === 'dia' && ctx.dia.modo === 'treino' && stDoDia(ctx.dia);
  if (stH) fora.add('t:' + stH.id + ':' + (diaSt || estadoSubtema(stH.id).novos ? 'pre' : 'pratica'));
  verificarRPG();
  const local = cartaoSoNoAparelho(), localTopo = local && backupAtrasado();
  document.getElementById('vista-hoje').innerHTML = topo + (localTopo ? local : '') + cartaoPausas(fora) + cartaoTempo() + roteiro + cartaoPendencias() + cartaoJornada() + modos + edital + (localTopo ? '' : local) + '<p class="sync" id="sync"></p>';
  atualizarRodapeSync();
}
// Quando a conta não está disponível, o aviso não fica escondido no rodapé: sobe para o topo se o último backup tiver
// três dias ou mais (ou se nunca houve), com o motivo que o diagnóstico encontrou e os botões de backup
function marcarBackup() { S.perfil.backupEm = hojeISO(); Store.salvar('perfil'); if (UI.vista === 'hoje') renderHoje(); }
function backupAtrasado() { const u = S.perfil.backupEm; return !u || HOJE() - diaNum(u) >= 3; }
function cartaoSoNoAparelho() {
  if (Store.modo === 'nuvem' || Store.carregando) return '';
  const dg = Store.diag, u = S.perfil.backupEm, dias = u ? HOJE() - diaNum(u) : null;
  const motivo = !dg.claude ? 'o app foi aberto fora do claude.ai' : dg.db !== 'ok' ? 'o banco de dados do app não respondeu' : dg.user !== 'ok' || dg.id !== 'ok' ? 'a sua conta não foi identificada (confira se entrou no claude.ai)' : dg.leitura !== 'ok' ? 'a leitura da conta falhou' : 'a conta recusou a gravação';
  return '<div class="cartao aviso-local' + (backupAtrasado() ? ' destaque' : '') + '"><div class="secao-cab"><h2>Progresso só neste aparelho</h2></div>' +
    '<p>' + esc(inicial(motivo)) + '. ' + (u ? 'Último backup: ' + esc(fmtData(u, { day: '2-digit', month: '2-digit' })) + (dias ? ', há ' + pl(dias, 'dia', 'dias') : ', hoje') + '.' : 'Nenhum backup feito ainda.') + '</p>' +
    '<p class="pequeno mudo">No outro aparelho: Mais → Ajustes → Juntar (soma, não apaga).</p>' +
    '<div class="linha-btns"><button class="btn pequeno' + (backupAtrasado() ? ' primario' : '') + '" data-acao="backup-baixar">Baixar backup</button><button class="btn pequeno" data-acao="backup-copiar-hoje">Copiar texto</button><button class="btn pequeno" data-acao="tentar-gravar">Tentar a conta</button><button class="linkish pequeno" data-acao="mais" data-sub="ajustes">Diagnóstico</button></div></div>';
}
function atualizarRodapeSync() {
  const el = document.getElementById('sync');
  if (!el) return;
  if (Store.modo === 'nuvem') el.innerHTML = Store.erro ? 'Falha ao salvar na sua conta (' + esc(Store.erro) + '). O progresso continua guardado neste navegador. <button class="linkish" data-acao="mais" data-sub="ajustes">Diagnóstico e backup</button>' : 'Progresso salvo na sua conta e neste navegador.';
  else el.innerHTML = 'Progresso salvo só neste navegador. <button class="linkish" data-acao="mais" data-sub="ajustes">Ver diagnóstico e fazer backup</button>';
}
function iniciarDia(data) {
  const dia = DIAS.find((d) => d.data === data);
  if (!dia) return;
  if (retomarPausa(dia.data)) return;
  const titulo = fmtData(dia.data, { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' · ' + (dia.modo === 'revisao' ? 'Revisão' : dia.modo === 'simulado' ? 'Simulado' : 'Treino do dia');
  if (dia.modo === 'revisao') {
    if (!listaVencida().length && !manutencaoHoje().length) { iniciarSessao({ modo: 'treino', n: Math.min(dia.n, 20), blocos: blocosDaSemana(dia), filtro: 'mistas', titulo, dia: dia.data }); return; }
    iniciarSessao({ modo: 'revisao', n: dia.n, titulo, dia: dia.data });
    return;
  }
  if (dia.modo === 'simulado') {
    iniciarSessao({ modo: 'simulado', n: dia.n, blocos: dia.blocos, prova: !dia.blocos.length, titulo, dia: dia.data, minutos: Math.round(dia.n * 1.5) });
    return;
  }
  const st = stDoDia(dia);
  if (st) { iniciarSessao({ modo: 'treino', ids: idsDoSubtemaNoDia(st, dia.blocos, nItensDoDia(dia)), titulo: titulo + ' · ' + st.nome, dia: dia.data }); return; }
  iniciarSessao({ modo: 'treino', n: nItensDoDia(dia), blocos: dia.blocos, filtro: 'mistas', titulo, dia: dia.data });
}
function idsDoSubtemaNoDia(st, blocos, n) {
  const ids = idsSubtema(st.id, 'pratica', n), usados = new Set(ids);
  if (ids.length < n) for (const q of selecionar(poolDe(blocos).filter((q) => !usados.has(q.id) && !q.al), n - ids.length, 'mistas')) ids.push(q.id);
  return ids;
}
// Em dia pesado (lista curta vencida acima de REVISOES_DIA_PESADO), a sessão de questões do dia encolhe, até o mínimo de 10
function nItensDoDia(dia) {
  if (dia.modo !== 'treino') return dia.n;
  const excesso = listaVencida().length - REVISOES_DIA_PESADO;
  return excesso > 0 ? Math.max(Math.min(10, dia.n), dia.n - Math.ceil(excesso / 2)) : dia.n;
}

/* ================= Questões (montar sessão) ================= */
function renderQuestoes() {
  const modo = UI.modo;
  const ns = modo === 'simulado' ? [30, 60, 120] : [10, 20, 30, 50];
  if (!ns.includes(UI.n)) UI.n = ns[1];
  const sel = new Set(UI.blocos);
  const pool = poolDe(UI.blocos);
  const usarProva = modo === 'simulado' && UI.prova === 'prova';
  let html = cartaoPausas() +
    '<div class="secao"><div class="secao-cab"><h2>Montar sessão</h2><span class="mudo pequeno mono">' + Q.length + ' questões no banco</span></div>' +
    '<div class="chips" role="group" aria-label="Modo">' +
    ['treino', 'simulado', 'relampago'].map((m) => '<button class="chip" data-acao="set-modo" data-modo="' + m + '" aria-pressed="' + (modo === m) + '">' + esc({ treino: 'Treino comentado', simulado: 'Simulado Cebraspe', relampago: 'Relâmpago 90 s' }[m]) + '</button>').join('') + '</div>' +
    '<p class="mudo pequeno">' + esc({
      treino: 'Gabarito, comentário, trecho da lei e termos para pesquisar logo após cada item. Primeiro vêm os itens da lista curta que vencem hoje, depois os inéditos.',
      simulado: 'Sem gabarito até entregar. Cada errada anula uma certa; em branco não pontua. No fim, você vê o resultado por disciplina e se valeu a pena chutar.',
      relampago: 'Um minuto e meio. Acerto soma, erro subtrai. Vale o recorde.',
    }[modo]) + '</p></div>';
  if (modo === 'simulado') {
    html += '<div class="campo"><span class="rot">Composição</span><div class="chips">' +
      '<button class="chip" data-acao="set-prova" data-prova="prova" aria-pressed="' + usarProva + '">Prova completa (básicos + específicos)</button>' +
      '<button class="chip" data-acao="set-prova" data-prova="blocos" aria-pressed="' + !usarProva + '">Só os blocos marcados</button></div>' +
      (usarProva ? '<p class="pequeno mudo">Numa prova de ' + TOTAL_PROVA + ' itens e ' + PONTOS_PROVA + ' pontos. Básica, cada item vale 1: ' + Object.entries(PROVA_BASICA).map(([d, k]) => esc(DI.get(d).nome) + ' ' + k).join(' · ') + '. Específica, cada item vale 2: ' + Object.entries(PROVA_ESPECIFICA).map(([d, k]) => esc(DI.get(d).nome) + ' ' + k).join(' · ') + '. Estimativa para Especialista em Regulação, sobre as provas da Anatel e da ANAC de 2024; muda quando sair o edital.</p>' : '') + '</div>';
  }
  if (modo !== 'relampago') html += '<div class="campo"><span class="rot">Quantidade de itens</span><div class="chips">' + ns.map((n) => '<button class="chip" data-acao="set-n" data-n="' + n + '" aria-pressed="' + (UI.n === n) + '">' + n + '</button>').join('') + '</div></div>';
  if (modo === 'treino') html += '<div class="campo"><span class="rot">Quais itens</span><div class="chips">' + [['mistas', 'Vencidas + inéditas'], ['novas', 'Só inéditas'], ['erradas', 'Só as que já errei']].map(([v, t]) => '<button class="chip" data-acao="set-filtro" data-filtro="' + v + '" aria-pressed="' + (UI.filtro === v) + '">' + t + '</button>').join('') + '</div></div>';
  if (!usarProva) {
    html += '<div class="secao"><div class="secao-cab"><h2>Blocos</h2><span class="mudo pequeno mono">' + pool.length + ' itens disponíveis</span></div>' +
      '<div class="chips"><button class="chip" data-acao="preset" data-preset="p1">Prioridade 1</button><button class="chip" data-acao="preset" data-preset="lgpd">LGPD inteira</button><button class="chip" data-acao="preset" data-preset="tudo">Tudo</button><button class="chip" data-acao="preset" data-preset="nada">Limpar</button></div>';
    html += listaBlocos(sel, 'toggle-bloco', (b) => POR_BLOCO.get(b.id) || [], (b) => dominioBloco(b.id)) + '</div>';
  }
  html += '<button class="btn primario largo comecar-fixo" data-acao="comecar"' + (pool.length || usarProva ? '' : ' disabled') + '>Começar ' + esc({ treino: 'treino', simulado: 'simulado', relampago: 'relâmpago' }[modo]) + '</button>';
  const conferidos = REAIS.filter(gabConferido).length;
  const nIades = REAIS.filter((q) => bancaDe(q) === 'IADES').length;
  if (REAIS.length) html += '<div class="cartao reais"><h2>Itens reais de prova</h2><p class="mudo pequeno">' + REAIS.length + ' itens de provas de 2021 a 2026, com comentário: ' + (REAIS.length - conferidos) + ' com gabarito oficial definitivo e ' + conferidos + ' avulsos, com o gabarito conferido na lei ou no texto da prova. ' + (nIades ? nIades + ' são da seleção da própria ANPD (IADES, 2025). ' : '') + '</p><div class="linha-btns"><button class="btn" data-acao="reais" data-modo="treino">Treinar com comentário</button><button class="btn" data-acao="reais" data-modo="simulado">Fazer como prova</button><button class="btn" data-acao="mais" data-sub="cebraspe">Como o Cebraspe cobra</button></div></div>';
  if (!usarProva && !UI.blocos.length) html += '<p class="mudo pequeno">Nenhum bloco marcado: a sessão usa o banco inteiro.</p>';
  document.getElementById('vista-questoes').innerHTML = html;
}
function listaBlocos(sel, acao, itensDe, dominioDe) {
  let html = '';
  for (const disc of DISC) {
    const bs = BLOCOS.filter((b) => b.disciplina === disc.id);
    let parte = '';
    for (const b of bs) {
      const qs = itensDe(b);
      if (!qs.length) {
        if (acao === 'toggle-bloco') parte += '<div class="bloco-op vazio"><input type="checkbox" disabled aria-label="' + esc(b.nome) + '"><div class="txt"><b>' + esc(b.nome) + '</b><small>Aguardando o texto: ' + esc(b.aguardando || 'fonte') + '</small></div></div>';
        continue;
      }
      const dom = dominioDe(b) || 0;
      const prov = qs.every((q) => q.v === 0);
      parte += '<label class="bloco-op"><input type="checkbox" data-acao="' + acao + '" data-bloco="' + b.id + '"' + (sel.has(b.id) ? ' checked' : '') + '>' +
        '<div class="txt"><b>' + esc(b.nome) + '</b><small>' + esc(b.dispositivos) + ' · ' + qs.length + ' itens' + (prov ? ' · provisórias, conferir na fonte' : '') + '</small></div>' +
        '<div class="dom">' + barra(dom) + '<span>' + Math.round(dom * 100) + '%</span></div></label>';
    }
    if (parte) html += '<div class="grupo-blocos"><span class="rotulo">' + esc(disc.nome) + ' · peso ' + esc(disc.peso) + '</span>' + parte + '</div>';
  }
  return html;
}
function comecarConfigurado() {
  if (UI.modo === 'relampago') iniciarSessao({ modo: 'relampago', blocos: UI.blocos });
  else if (UI.modo === 'simulado') iniciarSessao({ modo: 'simulado', n: UI.n, blocos: UI.blocos, prova: UI.prova === 'prova', minutos: Math.round(UI.n * 1.5), titulo: UI.prova === 'prova' ? 'Simulado · prova completa' : 'Simulado Cebraspe' });
  else iniciarSessao({ modo: 'treino', n: UI.n, blocos: UI.blocos, filtro: UI.filtro });
}

/* ================= Cards (montar sessão) ================= */
function dominioCardsBloco(bid) {
  const cs = CARDS_POR_BLOCO.get(bid) || [];
  if (!cs.length) return null;
  return cs.reduce((s, c) => { const r = S.cards[c.id]; return s + (r ? Math.min(1, r[1] / 21) : 0); }, 0) / cs.length;
}
function renderCards() {
  const sel = new Set(UI.blocosCards);
  const blocos = UI.blocosCards.length ? UI.blocosCards : null;
  const venc = cardsVencidos(blocos).length;
  const novos = cardsNovos(blocos).length;
  const rest = novosRestantesHoje();
  const vistos = CARDS.filter((c) => S.cards[c.id]).length;
  let html = '<div class="secao"><div class="secao-cab"><h2>Cards cloze</h2><span class="mudo pequeno mono">' + CARDS.length + ' cards · ' + NOTAS.length + ' notas</span></div>' +
    '<p class="mudo pequeno">Cada card esconde uma palavra-chave. Os cards de lei usam o texto literal do artigo; os marcados “Doutrina” cobrem conceitos de gestão, riscos, dados, IA e economia, que não têm lei de referência. Responda de cabeça, revele e diga como foi: Errei, Difícil, Bom ou Fácil. O intervalo até a próxima revisão cresce a cada acerto, como no Anki.</p></div>';
  html += '<div class="contadores"><div class="rev"><b>' + venc + '</b><span>para revisar hoje</span></div><div class="nov"><b>' + Math.min(rest, novos) + '</b><span>novos liberados hoje</span></div><div><b>' + vistos + '</b><span>já estudados</span></div></div>';
  html += '<div class="linha-btns"><button class="btn primario" data-acao="cards-iniciar"' + (venc || (rest && novos) ? '' : ' disabled') + '>Estudar (' + (venc + Math.min(rest, novos)) + ')</button>' +
    '<button class="btn" data-acao="cards-so-revisao"' + (venc ? '' : ' disabled') + '>Só revisões (' + venc + ')</button></div>';
  if (!rest) html += '<p class="pequeno mudo">Limite de cards novos de hoje atingido (' + (S.perfil.novosCards || 20) + '). Ajuste em Mais → Ajustes.</p>';
  html += '<div class="secao"><div class="secao-cab"><h2>Baralhos</h2><span class="mudo pequeno">Nenhum marcado = todos</span></div>' +
    listaBlocos(sel, 'toggle-bloco-card', (b) => CARDS_POR_BLOCO.get(b.id) || [], (b) => dominioCardsBloco(b.id)) + '</div>';
  document.getElementById('vista-cards').innerHTML = html;
}
/* ================= Render da sessão ================= */
function renderSessao() {
  const el = document.getElementById('sessao');
  UI.artInline = null;
  if (!sessao) return;
  if (sessao.fim) { el.innerHTML = '<div class="sessao-corpo">' + (sessao.modo === 'cards' ? renderResultadoCards() : renderResultado()) + '</div>'; return; }
  const total = sessao.modo === 'relampago' ? null : sessao.ids.length;
  const relogio = sessao.limite ? fmtTempo(sessao.limite - decorrido()) : fmtTempo(decorrido());
  let html = '<div class="sessao-corpo"><div class="sessao-topo"><button class="icone-btn" data-acao="sair-sessao" aria-label="Sair da sessão"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
    '<div class="tit"><b>' + esc(sessao.titulo) + '</b><span>' + (total ? (sessao.modo === 'cards' ? 'Card ' : 'Item ') + ((sessao.feitasAntes || 0) + sessao.i + 1) + ' de ' + (sessao.totalOrig || total) : 'Item ' + (sessao.i + 1)) + (sessao.xp ? ' · +' + sessao.xp + ' XP' : '') + '</span></div>' +
    (sessao.modo !== 'simulado' && sessao.modo !== 'cards' && sessao.combo >= 2 ? '<span class="combo' + (sessao.revelado || sessao.flash ? ' pulso' : '') + '">combo ×' + sessao.combo + '</span>' : '') +
    '<button class="icone-btn som" data-acao="som" aria-pressed="' + !!UI.som + '" aria-label="' + (UI.som ? 'Desligar o som' : 'Ligar o som') + '" title="' + (UI.som ? 'Som ligado' : 'Som desligado') + '">' + iconeSom(!!UI.som) + '</button>' +
    '<span class="relogio" id="relogio">' + relogio + '</span></div>';
  if (sessao.confirmar) html += renderConfirmacao();
  if (sessao.modo === 'cards') html += barra(sessao.i / sessao.ids.length) + renderCardSessao(CI.get(sessao.ids[sessao.i]));
  else { html += renderArena(QI.get(sessao.ids[sessao.i])); if (total) html += renderTira(); html += renderItem(QI.get(sessao.ids[sessao.i])); }
  el.innerHTML = html + '</div>';
}
function renderTira() {
  const atual = sessao.ids[sessao.i];
  return '<div class="tira" aria-label="Folha de respostas">' + sessao.ids.map((id, k) => {
    const r = sessao.resp[id];
    let cls = '';
    if (sessao.modo === 'simulado') cls = r ? (r === BRANCO ? 'B' : 'R') : '';
    else if (r) cls = r === QI.get(id).g ? 'C' : 'E';
    if (id === atual) cls += ' atual';
    const i = '<i class="' + cls.trim() + '"></i>';
    return sessao.modo === 'simulado' ? '<button data-acao="ir-item" data-i="' + k + '" aria-label="Ir para o item ' + (k + 1) + '">' + i + '</button>' : i;
  }).join('') + '</div>';
}
function renderApoio(q, aberto) {
  if (q.ap == null) return '';
  return '<details class="apoio-det"' + (aberto ? ' open' : '') + '><summary>Texto de apoio</summary><div class="apoio">' + D.apoios[q.ap].split('\n').map((p) => '<p>' + esc(p) + '</p>').join('') + '</div></details>';
}
// Itens reais de prova: selo com a origem e o comando da banca que antecede o item
// Itens reais avulsos chegaram sem gabarito: o gabarito foi conferido no texto da lei
function gabConferido(q) { return /conferido n[ao] (lei|texto)/.test(q.pv || ''); }
// Múltipla escolha: rótulos da resposta marcada e do gabarito
function nomeResp(q, r) { return q.al ? 'a letra ' + r : r === 'C' ? 'CERTO' : 'ERRADO'; }
function nomeGab(q) { return q.al ? 'letra ' + q.g : q.g === 'C' ? 'certo' : 'errado'; }
// Antes da resposta, as alternativas são botões; depois, mostram o gabarito e a letra marcada
function renderAlternativas(q, marcada, revelar) {
  if (!q.al) return '';
  return '<div class="alternativas">' + q.al.map((t, k) => {
    const L = LETRAS[k];
    const cls = 'alt' + (revelar ? (L === q.g ? ' gab' : L === marcada ? ' errou' : '') : L === marcada ? ' marcada' : '');
    const conteudo = '<span class="oval"><span>' + L + '</span></span><span>' + esc(t) + '</span>';
    return revelar ? '<div class="' + cls + '">' + conteudo + '</div>' : '<button class="' + cls + '" data-acao="responder" data-r="' + L + '">' + conteudo + '</button>';
  }).join('') + '</div>';
}
// A banca é o primeiro campo da linha da prova (Cebraspe na maioria; IADES no processo seletivo da própria ANPD)
function bancaDe(q) { return ((q.pv || '').split(' · ')[0] || 'Cebraspe').trim(); }
// Item adaptado de prova real (certo/errado escrito a partir de uma questão de múltipla escolha): selo próprio
function seloReal(q) { return q.o ? '<span class="selo real" title="' + esc(q.pv || '') + '">Item real ' + esc(bancaDe(q)) + '</span>' : q.ad ? '<span class="selo" title="' + esc(q.pv || '') + '">Adaptado de prova</span>' : ''; }
// Ordem do caderno: conhecimentos básicos antes dos específicos, depois pelo número do item
function ordemProva(q) { const m = /(?:item|questão) (\d+)/.exec(q.pv || ''); return (/Básicos/.test(q.pv || '') ? 0 : 1000) + (m ? Number(m[1]) : 999); }
function renderComando(q) { return q.cm ? '<p class="comando">' + esc(q.cm) + '</p>' : ''; }
function renderItem(q) {
  const id = q.id, sim = sessao.modo === 'simulado', marcada = sessao.resp[id];
  let html = '<article class="item"><div class="item-cab"><span class="selo mono">' + esc(nomeBloco(q.b)) + '</span>' + seloReal(q) + '<span class="item-num">' + esc(q.id) + '</span></div>';
  html += renderApoio(q, sessao.i === 0 || sim || !sessao.ids.slice(0, sessao.i).some((x) => QI.get(x).ap === q.ap));
  html += renderComando(q);
  html += '<p class="enunciado">' + (sessao.revelado ? marcarTermos(q.e, 3) : esc(q.e)) + '</p>';
  html += renderAlternativas(q, marcada, sessao.revelado || !!sessao.flash);
  if (sessao.flash) {
    html += '<div class="veredito ' + sessao.flash + '"><span>' + (sessao.flash === 'ok' ? 'Certo' : 'Errado: gabarito ' + nomeGab(q).toUpperCase()) + '</span>' + (sessao.ultimoGanho ? '<span class="ganho">+' + sessao.ultimoGanho + ' XP</span>' : '') + '</div>';
  } else if (!sessao.revelado) {
    if (sessao.modo !== 'relampago') html += '<label class="duvida"><input type="checkbox" data-acao="duvida"' + (sessao.duv[id] ? ' checked' : '') + '> Estou em dúvida (mede quando vale chutar)</label>';
    const branco = sim ? '<button class="bolha b' + (marcada === BRANCO ? ' marcada' : '') + '" data-acao="responder" data-r="' + BRANCO + '">Em branco</button>' : '';
    if (q.al) {
      if (branco) html += '<div class="respostas">' + branco + '</div>';
      html += '<p class="atalhos">Teclado: A a ' + LETRAS[q.al.length - 1] + ' marcam a alternativa' + (sim ? ' · ← → navegam' : '') + '</p>';
    } else {
      html += '<div class="respostas"><button class="bolha c' + (marcada === 'C' ? ' marcada' : '') + '" data-acao="responder" data-r="C"><span class="oval"><span>C</span></span>CERTO</button>' +
        '<button class="bolha e' + (marcada === 'E' ? ' marcada' : '') + '" data-acao="responder" data-r="E"><span class="oval"><span>E</span></span>ERRADO</button>' + branco + '</div>';
      html += '<p class="atalhos">Teclado: C = certo · E = errado' + (sim ? ' · B = em branco · ← → navegam' : '') + ' · D = dúvida</p>';
    }
    if (sim) html += '<div class="linha-btns"><button class="btn" data-acao="anterior"' + (sessao.i ? '' : ' disabled') + '>Anterior</button><button class="btn" data-acao="proximo"' + (sessao.i < sessao.ids.length - 1 ? '' : ' disabled') + '>Próximo</button><button class="btn primario" data-acao="entregar">Entregar (' + Object.keys(sessao.resp).length + '/' + sessao.ids.length + ')</button></div>';
  } else {
    const r = sessao.resp[id], ok = r === q.g;
    html += '<div class="veredito ' + (ok ? 'ok' : 'no') + '"><span>' + (ok ? 'Você marcou ' + nomeResp(q, r) + ' e acertou.' : 'Você marcou ' + nomeResp(q, r) + '. O gabarito é ' + (q.al ? 'a letra ' + q.g : q.g === 'C' ? 'CERTO' : 'ERRADO') + '.') + '</span>' +
      (sessao.ultimoGanho ? '<span class="ganho ganho-voa">+' + sessao.ultimoGanho + ' XP' + (sessao.virada === 'plena' ? ' <small>virada</small>' : caiuEmProva(q) && sessao.modo !== 'relampago' ? ' <small>crítico</small>' : '') + '</span>' : '<span class="pequeno">' + (SEM_REPETICAO.has(id) ? 'Este texto não volta: vêm outros' : 'Foi para a lista curta') + '</span>') + '</div>';
    html += extrasResposta(q);
    html += renderExplicacao(q);
    html += '<button class="btn primario largo" data-acao="proximo">' + (sessao.i < sessao.ids.length - 1 ? 'Próximo item' : 'Ver resultado') + '</button><p class="atalhos">Enter = próximo</p>';
  }
  return html + '</article>';
}
function renderExplicacao(q) {
  let html = '<div class="explica"><span class="gab">Gabarito' + (q.o ? (gabConferido(q) ? (/na lei/.test(q.pv) ? ' conferido na lei' : ' conferido no texto') : ' oficial') : '') + ': ' + nomeGab(q) + ' · armadilha: ' + esc(D.armadilhas[q.a] || q.a) + '</span>';
  if (q.o || (q.ad && q.pv)) html += '<p class="pequeno mudo">' + esc(q.pv) + '</p>';
  html += '<p>' + marcarTermos(q.c, 3) + '</p>';
  if (q.t && q.t.length) {
    html += '<div class="citacao">' + q.t.map((t) => '<q>' + esc(t) + '</q>').join('') + '<span class="fonte">' + esc(q.r) + '</span>' +
      (q.art && ARTI.get(chave(q.l, q.art)) ? '<div>' + botaoArt(chave(q.l, q.art), q.id) + '</div>' : '') + '</div>';
  } else html += '<div class="citacao"><span class="fonte">Fonte: ' + esc(q.r) + '</span></div>';
  if (q.v === 0) html += '<p class="aviso-conferir">Texto oficial ainda não anexado ao app: confira esta referência na fonte antes de confiar nela.</p>';
  if (q.tm && SUBTEMAS.get(q.tm)) html += '<p class="pequeno"><button class="linkish" data-acao="aula-folha" data-st="' + esc(q.tm) + '">Rever a aula: ' + esc(SUBTEMAS.get(q.tm).nome) + '</button></p>';
  html += blocoPesquisar(q.e + ' ' + q.c, q.p, 'questão ' + q.id);
  const ct = CONTEST.find((x) => x.q === q.id);
  html += '<div class="contestar"><button class="linkish pequeno" data-acao="contestar" data-q="' + esc(q.id) + '">' + (ct ? 'Contestação enviada (' + esc(STATUS_CONTEST[ct.status] || ct.status) + ') · ver' : 'Contestar este item') + '</button></div>';
  return html + '</div>';
}
function blocoPesquisar(texto, extras, origem) {
  const termos = termosDe(texto, 4, 0.35);
  const itens = (extras || []).slice(0, 3);
  if (!termos.length && !itens.length) return '';
  let html = '<div class="pesquisar-box"><span class="rotulo">Para pesquisar e entender melhor</span><div class="chips">';
  termos.forEach((a) => { html += '<button class="chip termo-chip" data-acao="termo" data-t="' + a.g.i + '">' + esc(a.g.t) + '</button>'; });
  itens.forEach((t) => { html += '<button class="chip termo-chip" data-acao="investigar" data-t="' + esc(t) + '" data-o="' + esc(origem) + '">' + esc(t) + '</button>'; });
  return html + '</div></div>';
}
function textoCard(nota, n, revelado) {
  let auto = 0, html = '', pos = 0;
  nota.t.replace(RE_LACUNA, (m, num, t, idx) => {
    const k = num ? Number(num) : ++auto;
    html += esc(nota.t.slice(pos, idx));
    if (k === n) html += revelado ? '<mark class="lacuna-resp">' + esc(t) + '</mark>' : '<span class="lacuna">' + esc(nota.dc ? '[' + nota.dc + ']' : '[ … ]') + '</span>';
    else html += esc(t);
    pos = idx + m.length;
    return m;
  });
  return html + esc(nota.t.slice(pos));
}
function renderCardSessao(card) {
  const nota = card.nota;
  const r = S.cards[card.id];
  let html = '<article class="item"><div class="item-cab"><span class="selo mono">' + esc(nomeBloco(nota.b)) + '</span><span class="item-num">' + (r ? 'revisão · intervalo ' + fmtIntervalo(r[1]) : 'novo') + '</span></div>';
  html += '<p class="mono pequeno mudo">' + esc(nota.r) + '</p>';
  html += '<p class="card-cloze">' + textoCard(nota, card.n, sessao.revelado) + '</p>';
  if (!sessao.revelado) {
    html += '<button class="btn primario largo" data-acao="revelar">Mostrar resposta</button><p class="atalhos">Espaço ou Enter = mostrar</p>';
  } else {
    html += '<div class="notas-card">' + [[1, 'Errei'], [2, 'Difícil'], [3, 'Bom'], [4, 'Fácil']].map(([n, t]) => '<button class="n' + n + '" data-acao="avaliar" data-n="' + n + '">' + t + '<small>' + (n === 1 ? 'agora' : fmtIntervalo(calcularCard(card.id, n)[1])) + '</small></button>').join('') + '</div>';
    html += '<p class="atalhos">Teclado: 1 Errei · 2 Difícil · 3 Bom · 4 Fácil</p>';
    const kn = nota.art ? chave(nota.l || 'lgpd', nota.art) : null;
    if (kn && ARTI.get(kn)) html += '<div>' + botaoArt(kn) + '</div>';
    html += blocoPesquisar(nota.t.replace(RE_LACUNA, '$2'), null, 'card');
  }
  return html + '</article>';
}
function renderConfirmacao() {
  if (sessao.confirmar === 'entregar') {
    const faltam = sessao.ids.length - Object.keys(sessao.resp).length;
    return '<div class="cartao destaque"><b>Entregar o simulado?</b><p class="mudo">' + (faltam ? pl(faltam, 'item sem marcação conta', 'itens sem marcação contam') + ' como em branco.' : 'Todos os itens foram marcados.') + '</p><div class="linha-btns"><button class="btn primario" data-acao="confirmar-entrega">Entregar</button><button class="btn" data-acao="cancelar-conf">Voltar</button></div></div>';
  }
  if (sessao.confirmar === 'sair') {
    return '<div class="cartao destaque"><b>Sair da sessão?</b><p class="mudo">' + (sessao.modo === 'simulado' ? 'As ' + pl(Object.keys(sessao.resp).length, 'marcação', 'marcações') + ' e o tempo de prova ficam guardados, e o relógio para. Para seguir, toque em Continuar na lista de sessões guardadas (abas Hoje e Questões) ou no mesmo botão que abriu o simulado.' : sessao.modo === 'cards' ? 'Os cards que você avaliou ficam salvos; os outros continuam na fila de revisão.' : sessao.modo === 'relampago' ? 'O relâmpago termina aqui, sem recorde.' : chavePausa(sessao) ? 'O que você respondeu já está salvo, e os ' + sessao.ids.filter((id) => !sessao.resp[id]).length + ' itens que faltam ficam guardados: o mesmo botão passa a Continuar, e a sessão aparece em Sessões guardadas (abas Hoje e Questões).' : 'O que você já respondeu fica salvo.') + '</p><div class="linha-btns"><button class="btn primario" data-acao="confirmar-saida">Sair</button><button class="btn" data-acao="cancelar-conf">Continuar</button>' + (sessao.modo === 'simulado' ? '<button class="btn" data-acao="sair-descartar">Descartar o simulado</button>' : '') + '</div></div>';
  }
  return '';
}
function renderResultadoCards() {
  const n = sessao.notas, total = n[1] + n[2] + n[3] + n[4];
  return '<div class="sessao-topo"><div class="tit"><b>' + esc(sessao.titulo) + '</b><span>Resultado · ' + fmtTempo(sessao.dur) + '</span></div><button class="btn" data-acao="fechar-sessao">Concluir</button></div>' +
    '<div class="cartao destaque"><span class="rotulo">Cards revisados</span><div class="nota-final"><span class="grande">' + total + '</span><span class="mudo">retenção ' + pct(n[3] + n[4], total) + '%</span></div>' +
    '<div class="placar"><div class="E"><b>' + n[1] + '</b><span>errei</span></div><div><b>' + n[2] + '</b><span>difícil</span></div><div class="C"><b>' + n[3] + '</b><span>bom</span></div><div class="L"><b>' + n[4] + '</b><span>fácil</span></div></div>' +
    '<p class="mudo">+' + sessao.xp + ' XP. Os cards marcados como “Errei” voltaram no fim da sessão e voltam amanhã também.</p></div>' +
    '<div class="linha-btns"><button class="btn primario" data-acao="fechar-sessao">Concluir</button></div>';
}
function renderResultado() {
  const ids = sessao.modo === 'relampago' ? sessao.ids.filter((id) => sessao.resp[id]) : sessao.ids;
  // No Cebraspe, erro em item certo/errado anula um acerto; erro em múltipla escolha não desconta
  let c = 0, e = 0, b = 0, dc = 0, de = 0, eMc = 0, pt = 0, ptMax = 0;
  const porDisc = {};
  ids.forEach((id) => {
    const r = sessao.resp[id] || BRANCO, q = QI.get(id), duv = !!sessao.duv[id] && !q.al;
    const disc = (BI.get(q.b) || {}).disciplina || 'outros';
    const pd = (porDisc[disc] ||= { c: 0, e: 0, b: 0, eMc: 0, pt: 0, ptMax: 0 });
    const w = pesoItem(q);
    ptMax += w; pd.ptMax += w;
    if (r === BRANCO) { b++; pd.b++; } else if (r === q.g) { c++; pd.c++; pt += w; pd.pt += w; if (duv) dc++; } else { e++; pd.e++; if (duv) de++; if (q.al) { eMc++; pd.eMc++; } else { pt -= w; pd.pt -= w; } }
  });
  const liq = c - (e - eMc), n = ids.length;
  let html = '<div class="sessao-topo"><div class="tit"><b>' + esc(sessao.titulo) + '</b><span>Resultado · ' + fmtTempo(sessao.dur) + '</span></div><button class="btn" data-acao="fechar-sessao">Concluir</button></div>';
  html += cartaoBatalha();
  html += '<div class="cartao destaque"><span class="rotulo">Nota líquida Cebraspe (certas − erradas)</span><div class="nota-final"><span class="grande">' + liq + '</span><span class="mudo">de ' + n + ' possíveis · ' + (n ? Math.round((liq / n) * 100) : 0) + '%</span></div>' +
    '<div class="placar"><div class="C"><b>' + c + '</b><span>certas</span></div><div class="E"><b>' + e + '</b><span>erradas</span></div><div><b>' + b + '</b><span>em branco</span></div><div class="L"><b>+' + sessao.xp + '</b><span>XP</span></div></div>';
  if (sessao.modo === 'relampago') html += '<p>' + (sessao.recorde ? '<b>Novo recorde!</b> ' : '') + 'Recorde pessoal: ' + (S.perfil.recordes.relampago || 0) + '.</p>';
  if (eMc) html += '<p class="mudo pequeno">' + pl(eMc, 'erro', 'erros') + ' em múltipla escolha não ' + (eMc > 1 ? 'descontaram' : 'descontou') + ' ponto, como no Cebraspe.</p>';
  if (sessao.modo === 'simulado' && ptMax !== n) html += '<p class="pequeno">Nota com os pesos da prova (básica vale 1, específica vale 2): <b>' + pt + '</b> de ' + ptMax + ' pontos · <b>' + pct(pt, ptMax) + '%</b>.</p>';
  if (sessao.viradas) html += '<p class="pequeno">' + pl(sessao.viradas, 'virada', 'viradas') + ': ' + pl(sessao.viradas, 'item que você tinha errado em outro dia agora certo', 'itens que você tinha errado em outro dia agora certos') + ', com XP em dobro.</p>';
  if (sessao.ineditos && sessao.ineditos.n >= 5) html += '<p class="pequeno">Nos ' + sessao.ineditos.n + ' itens que você via pela primeira vez, acerto de <b>' + pct(sessao.ineditos.c, sessao.ineditos.n) + '%</b>. É a medida mais fiel do seu nível: item repetido se reconhece.</p>';
  if (sessao.comboMax >= 3) html += '<p class="mudo">Maior sequência de acertos: ' + sessao.comboMax + '.</p>';
  html += '</div>';
  html += cartaoGanhos();
  if (sessao.modo === 'simulado' && Object.keys(porDisc).length > 1) {
    html += '<div class="cartao"><h2>Por disciplina</h2><div class="tabela-env"><table class="tabela"><thead><tr><th>Disciplina</th><th>C</th><th>E</th><th>B</th><th>Líquida</th><th>Pontos</th></tr></thead><tbody>' +
      Object.entries(porDisc).sort((a, b) => b[1].ptMax - a[1].ptMax).map(([dd, v]) => { const t = v.c + v.e + v.b; return '<tr><td>' + esc((DI.get(dd) || { nome: dd }).nome) + '</td><td class="num">' + v.c + '</td><td class="num">' + v.e + '</td><td class="num">' + v.b + '</td><td class="num">' + (v.c - v.e + v.eMc) + ' (' + pct(v.c - v.e + v.eMc, t) + '%)</td><td class="num">' + v.pt + ' de ' + v.ptMax + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="pequeno mudo">Pontos: cada item básico vale 1 e cada específico vale 2. A ordem segue o que cada disciplina pesa na nota.</p></div>';
  }
  const nd = dc + de;
  if (nd) {
    const taxa = pct(dc, nd), semChute = liq - dc + de;
    html += '<div class="cartao"><h2>Chutar ou deixar em branco?</h2><p>Nos ' + pl(nd, 'item marcado', 'itens marcados') + ' com dúvida, você acertou ' + dc + ' (' + taxa + '%). ' +
      (taxa > 50 ? 'Acima de 50%, o chute rendeu pontos: sem ele, sua nota seria ' + semChute + '.' : taxa === 50 ? 'Exatamente 50%: chutar ou deixar em branco deu no mesmo.' : 'Abaixo de 50%, o chute custou pontos: deixando esses itens em branco, sua nota seria ' + semChute + '.') +
      '</p><p class="mudo pequeno">No Cebraspe, chutar só compensa quando a chance de acerto passa de 50%.</p></div>';
  }
  const lista = ids.map((id) => { const q = QI.get(id), r = sessao.resp[id] || BRANCO; return { q, cls: r === BRANCO ? 'B' : r === q.g ? 'C' : 'E' }; });
  const ordenada = lista.filter((x) => x.cls !== 'C').concat(lista.filter((x) => x.cls === 'C'));
  html += '<div class="secao"><div class="secao-cab"><h2>Revisar itens</h2><span class="mudo pequeno">Erros e brancos primeiro</span></div><div class="lista-rev">' +
    ordenada.map((x) => '<button data-acao="revisar-item" data-q="' + esc(x.q.id) + '" data-r="' + esc(sessao.resp[x.q.id] || BRANCO) + '"><span class="marca-res ' + x.cls + '">' + ({ C: '✓', E: '✗', B: '–' }[x.cls]) + '</span><span class="txt">' + esc(x.q.e) + '</span></button>').join('') + '</div></div>';
  html += '<div class="linha-btns"><button class="btn primario" data-acao="fechar-sessao">Concluir</button>' + (idsParaRefazer().length ? '<button class="btn" data-acao="refazer-erros">Refazer ' + pl(idsParaRefazer().length, 'erro ou branco', 'erros e brancos') + '</button>' : '') + '</div>';
  return html;
}

/* ================= Folha (painel sobreposto) ================= */
function abrirFolha(html, rotulo) {
  const f = document.getElementById('folha');
  f.innerHTML = '<div class="folha-painel">' + html + '</div>';
  f.setAttribute('aria-label', rotulo || 'Detalhes');
  f.hidden = false;
  f.scrollTop = 0;
  const b = f.querySelector('[data-acao="fechar-folha"]');
  if (b) b.focus();
}
function fecharFolha() { const f = document.getElementById('folha'); f.hidden = true; f.innerHTML = ''; UI.folhaAula = null; }
function cabFolha(rotulo, titulo) { return '<div class="folha-cab"><div><span class="rotulo">' + esc(rotulo) + '</span><h2>' + esc(titulo) + '</h2></div><button class="btn pequeno" data-acao="fechar-folha">Fechar</button></div>'; }
function folhaItem(id, resp) {
  const q = QI.get(id);
  let html = cabFolha(nomeBloco(q.b), q.id) + renderApoio(q, false) + renderComando(q) + '<p class="enunciado">' + marcarTermos(q.e, 3) + '</p>' + renderAlternativas(q, resp, true);
  if (resp) html += '<div class="veredito ' + (resp !== BRANCO && resp === q.g ? 'ok' : 'no') + '"><span>' + (resp === BRANCO ? 'Em branco.' : 'Você marcou ' + nomeResp(q, resp) + '.') + ' Gabarito: ' + nomeGab(q).toUpperCase() + '.</span></div>';
  abrirFolha(html + renderExplicacao(q), 'Item ' + q.id);
}
// Artigo aberto na própria tela, logo abaixo do botão: sem folha por cima e sem trocar de aba, para funcionar igual em
// qualquer aparelho. O mesmo botão fecha. Com "lista" (os artigos de um subtema), a caixa ganha anterior e próximo.
let nCaixaArt = 0;
function botaoArt(k, qid, rotulo, lista) {
  const id = 'art-' + (++nCaixaArt);
  return '<button class="linkish" data-acao="art-inline" data-art="' + esc(k) + '"' + (qid ? ' data-q="' + esc(qid) + '"' : '') + ' data-box="' + id + '" aria-expanded="false" aria-controls="' + id + '">' + esc(rotulo || 'Ler inteiro, grifado: ' + nomeArt(k)) + '</button>' +
    '<div class="art-inline" id="' + id + '"' + (lista ? ' data-lista="' + esc(lista.join(',')) + '"' : '') + ' hidden></div>';
}
function htmlArtInline(k, qid, lista, box, remissao) {
  const a = ARTI.get(k), L = LEIS[a.lei], i = lista ? lista.indexOf(k) : -1;
  const nav = (x, t) => '<button class="btn pequeno" data-acao="art-inline" data-art="' + esc(x) + '" data-box="' + box + '">' + t + '</button>';
  return '<div class="art-inline-cab"><b>' + esc(L.curto + ' · ' + rotuloArt(k)) + '</b>' + (a.estrutura.length ? '<span class="pequeno mudo">' + esc(a.estrutura.join(' · ')) + '</span>' : '') + '</div>' +
    (L.aviso ? '<p class="aviso-conferir">' + esc(L.aviso) + '</p>' : '') + htmlClaro(a, remissao) + '<div class="texto-lei">' + textoLei(a, qid ? [qid] : []) + '</div>' + (remissao ? '' : caixaJuridiques(a)) +
    (remissao ? '' : '<p class="pequeno mudo legenda-fixa">Grifos: <span class="g-cai">o que cai</span> · <span class="g-num">prazos e números</span> · <span class="g-alerta">alerta</span> · <span class="g-verbo">deve × pode</span> · <span class="g-erro">seus erros</span></p>') +
    (i >= 0 ? '<div class="linha-btns">' + (i > 0 ? nav(lista[i - 1], '← ' + esc(nomeArt(lista[i - 1]))) : '') + (i < lista.length - 1 ? nav(lista[i + 1], esc(nomeArt(lista[i + 1])) + ' →') : '') + '</div>' : '');
}
function abrirArtInline(alvo) {
  const k = alvo.dataset.art, box = document.getElementById(alvo.dataset.box);
  if (!box || !ARTI.get(k)) return;
  const fechar = !box.hidden && box.dataset.art === k;
  document.querySelectorAll('[data-box="' + alvo.dataset.box + '"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  if (fechar) {
    box.hidden = true; box.innerHTML = ''; box.dataset.art = '';
    const aberta = [...document.querySelectorAll('.art-inline:not([hidden])')].pop();
    UI.artInline = aberta ? aberta.dataset.art : null;
    return;
  }
  const lista = box.dataset.lista ? box.dataset.lista.split(',') : null;
  box.innerHTML = htmlArtInline(k, alvo.dataset.q || box.dataset.q, lista, alvo.dataset.box, box.classList.contains('remissao'));
  if (alvo.dataset.q) box.dataset.q = alvo.dataset.q;
  box.hidden = false;
  box.dataset.art = k;
  const dono = document.querySelector('[aria-controls="' + alvo.dataset.box + '"][data-art="' + k + '"]');
  if (dono) dono.setAttribute('aria-expanded', 'true');
  UI.artInline = k;
  // ao trocar pelo anterior ou próximo, o começo do artigo novo fica à vista
  if (!alvo.getAttribute('aria-controls')) box.scrollIntoView({ block: 'start' });
  try { marcarLido(k); } catch (e) { registrarErro('marcar o artigo como lido', e); }
}
/* ================= Investigar e correção com o Claude ================= */
// A página pergunta ao Claude pela conta de quem estuda (capacidade "sample"): gasta o uso dessa conta, e a primeira
// pergunta de cada abertura pede permissão. Sem a capacidade (arquivo aberto fora do claude.ai, permissão negada), os
// botões de IA somem e fica o caminho manual: copiar o pedido e colar numa conversa com o Claude.
let IA = null, iaNegada = false;
if (window.claude && window.claude.use) window.claude.use('sample').then((x) => { IA = x; atualizarAcoesInv(); }).catch(() => { IA = null; });
function iaPronta() { return !!IA && !iaNegada; }
const MSG_IA = {
  not_granted: 'Sem permissão para usar o Claude nesta página. Dá para liberar no menu de permissões do artifact; enquanto isso, use Copiar.',
  sampling_disabled: 'O Claude não está disponível para esta conta. Use Copiar e cole numa conversa.',
  rate_limited: 'Muitas perguntas seguidas ou limite de uso da conta. Tente daqui a pouco.',
  session_expired: 'A sessão do claude.ai expirou: entre de novo.',
  refused: 'O Claude não respondeu a este pedido. Reformule e tente de novo.',
  empty_completion: 'Veio uma resposta vazia. Tente de novo.',
  invalid_json: 'A correção veio num formato inesperado. Tente de novo.',
  prompt_too_large: 'Texto longo demais para enviar de uma vez.',
};
function erroIA(e) {
  const c = (e && e.code) || 'upstream_error';
  if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(c)) iaNegada = true;
  return MSG_IA[c] || 'Falha de conexão com o Claude. Tente de novo.';
}
async function copiarTexto(txt) {
  try { await navigator.clipboard.writeText(txt); return true; } catch (e) { return false; }
}
// Investigar: em vez de mandar para uma busca, o painel faz perguntas que obrigam a construir a resposta, e o Claude
// confere o que foi escrito, corrige com base na norma e devolve uma pergunta para ir mais fundo.
// O tema já está no título da folha; as perguntas não o repetem, porque muitos temas são frases longas
const PERGUNTAS_GUIA = [
  'Explique o tema com suas palavras, em duas ou três frases, como se ensinasse um colega.',
  'Onde ele aparece na norma? Ache o artigo e leia o dispositivo inteiro: há exceção, prazo ou condição logo ao lado?',
  'Com que conceito vizinho a banca costuma trocá-lo? Qual diferença decide o item?',
  'Monte um caso concreto, de preferência da atuação da ANPD, em que ele muda o resultado.',
];
function glossDe(t) { return GLOSS.find((g) => g.t === t) || GLOSS.find((g) => g.re.test(t)) || null; }
function regrasInv(inv) {
  const g = glossDe(inv.t);
  return 'Você é tutor de quem estuda para o concurso de Especialista em Regulação de Proteção de Dados da ANPD (banca Cebraspe, itens certo ou errado). ' +
    'O estudante está investigando o tema “' + inv.t + '”' + (inv.o ? ' (veio de: ' + inv.o + ')' : '') + '. ' +
    (g ? 'Definição curta que o painel dele traz, possivelmente incompleta: ' + g.d + ' ' : '') +
    'Ele respondeu a estas perguntas-guia: ' + PERGUNTAS_GUIA.join(' ') + '\n\n' +
    'Regras da sua resposta: português do Brasil; texto corrido e curto, até 170 palavras, sem títulos; primeiro diga o que está certo, depois corrija o que está errado ou impreciso e diga o que faltou; ' +
    'quando depender de norma brasileira (LGPD, resoluções da ANPD, outras leis), cite o artigo, e se não tiver certeza do número diga que é preciso conferir na lei em vez de inventar; ' +
    'aponte a armadilha típica do Cebraspe sobre o tema quando houver (palavra trocada, exceção omitida, sujeito trocado); ' +
    'não entregue tudo de uma vez: termine com UMA pergunta curta que leve o estudante ao próximo passo. A conversa vem a seguir.';
}
function conversaInv() {
  const inv = UI.inv;
  if (!inv || !inv.turnos.length) return '';
  const ult = inv.turnos.length - 1;
  return '<div class="inv-conversa">' + inv.turnos.map((x, i) => '<div class="inv-msg ' + (x.role === 'user' ? 'voce' : 'ia') + '"><span class="rotulo">' + (x.role === 'user' ? 'Você' : 'Claude') + '</span><p' + (i === ult && x.role === 'assistant' ? ' id="inv-ultima"' : '') + '>' + esc(x.content) + '</p></div>').join('') + '</div>';
}
function acoesInv() {
  const inv = UI.inv;
  if (inv && inv.ctl) return '<button class="btn" data-acao="inv-parar">Parar</button>';
  return (iaPronta() ? '<button class="btn primario" data-acao="inv-conferir">' + (inv && inv.turnos.length ? 'Responder ao Claude' : 'Conferir com o Claude') + '</button>' : '') +
    '<button class="btn" data-acao="inv-copiar">Copiar para perguntar à IA</button>';
}
function atualizarAcoesInv() { const el = document.getElementById('inv-acoes'); if (el) el.innerHTML = acoesInv(); }
function folhaInvestigar(t, origem) {
  const k = chavePesq(t), p = S.pesquisa[k], g = glossDe(t);
  if (!UI.inv || UI.inv.k !== k) UI.inv = { t, k, o: origem || (p && p.o) || '', turnos: [], rascunho: '' };
  const inv = UI.inv;
  let html = cabFolha('Investigar', t) +
    '<p class="pequeno mudo">Responda antes de ler qualquer coisa: tentar lembrar e explicar fixa mais do que ler a resposta pronta.</p>' +
    '<ol class="lista-cb">' + PERGUNTAS_GUIA.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>' +
    '<div id="inv-conversa">' + conversaInv() + '</div>' +
    '<label class="rotulo" for="inv-texto">' + (inv.turnos.length ? 'Sua resposta à pergunta do Claude' : 'Sua resposta') + '</label>' +
    '<textarea id="inv-texto" class="area-texto" rows="6" placeholder="Escreva o que você sabe, mesmo incompleto.">' + esc(inv.rascunho || (!inv.turnos.length && p && p.r) || '') + '</textarea>' +
    '<p class="pequeno mudo" id="inv-nota"></p><div class="linha-btns" id="inv-acoes">' + acoesInv() + '</div>';
  if (g) html += '<details class="inv-def"><summary>Conferir a definição curta do glossário</summary><p>' + esc(g.d) + '</p></details>';
  html += '<div class="linha-btns">' + (!p ? '<button class="btn" data-acao="add-pesq" data-t="' + esc(t) + '" data-o="' + esc(inv.o || 'investigar') + '">Guardar na lista</button>' : p.s ? '<span class="selo ok">Entendido</span>' : '<button class="btn" data-acao="inv-entendi" data-k="' + esc(k) + '">Entendi: marcar como entendido (+5 XP)</button>') + '</div>';
  abrirFolha(html, 'Investigar ' + t);
}
async function conferirInv() {
  const inv = UI.inv, box = document.getElementById('inv-texto');
  if (!inv || inv.ctl || !box || !iaPronta()) return;
  const txt = box.value.trim();
  if (!txt) { avisar('!', 'Escreva primeiro', 'A conferência só funciona sobre o que você escreveu.'); return; }
  if (!inv.turnos.length) { addPesquisa(inv.t, inv.o || 'investigar', true); const p = S.pesquisa[inv.k]; if (p) { p.r = txt.slice(0, 2000); Store.salvar('pesquisa'); } }
  inv.turnos.push({ role: 'user', content: txt }, { role: 'assistant', content: 'Pensando…' });
  inv.rascunho = '';
  inv.ctl = new AbortController();
  folhaInvestigar(inv.t, inv.o);
  // O Claude não guarda nada entre chamadas: vão as regras e as últimas trocas, começando por uma fala do estudante
  const turnos = inv.turnos.slice(0, -1).slice(-9);
  if (turnos[0].role !== 'user') turnos.shift();
  const resposta = inv.turnos[inv.turnos.length - 1];
  try {
    const r = await IA([{ role: 'user', content: regrasInv(inv) }].concat(turnos), {
      cache: false, signal: inv.ctl.signal,
      onText: ({ text }) => { resposta.content = text; const el = document.getElementById('inv-ultima'); if (el) el.textContent = text; },
    });
    resposta.content = r.text + (r.truncated ? ' […]' : '');
    // Explicar com as próprias palavras vale XP (uma vez por tema e conversa): o incentivo é pensar, não responder rápido
    if (!inv.xp && txt.length >= 80) { inv.xp = 1; ganharXP(5); S.perfil.recordes.ex = (S.perfil.recordes.ex || 0) + 1; verificarConquistas(); Store.salvar('perfil'); avisar('✎', '+5 XP', 'Por explicar com suas palavras.'); }
  } catch (e) {
    if (e && e.text) resposta.content = e.text + ' […]';
    else { inv.turnos.splice(-2, 2); inv.rascunho = txt; }
    if (!e || e.code !== 'cancelled') avisar('!', 'Claude indisponível', erroIA(e));
  }
  inv.ctl = null;
  // Só redesenha se a folha aberta ainda for esta investigação (pode ter sido fechada ou trocada por outra folha)
  if (UI.inv === inv && document.getElementById('inv-conversa')) folhaInvestigar(inv.t, inv.o);
}
async function copiarInv() {
  const inv = UI.inv, box = document.getElementById('inv-texto');
  if (!inv) return;
  const txt = (box && box.value.trim()) || (S.pesquisa[inv.k] && S.pesquisa[inv.k].r) || '';
  const pedido = regrasInv(inv) + '\n\nMinha resposta: ' + (txt || '(ainda não escrevi; faça as perguntas uma de cada vez)');
  const nota = document.getElementById('inv-nota');
  if (await copiarTexto(pedido)) { if (nota) nota.textContent = 'Pedido copiado: cole numa conversa com o Claude.'; return; }
  if (box) { box.value = pedido; box.select(); }
  if (nota) nota.textContent = 'Não deu para copiar sozinho: o pedido está selecionado no campo acima; copie e cole numa conversa.';
}
// Correção da discursiva: o Claude lê o texto com os quesitos, o padrão de resposta e a escala de conceitos e sugere o
// conceito de cada quesito e os erros de português. A pessoa revê e decide antes de salvar.
function pedidoDiscIA(t, texto) {
  return 'Corrija esta resposta discursiva como a banca Cebraspe corrige, com rigor e sem generosidade. O conceito máximo de cada quesito exige explicar, não só citar; o que passar de ' + t.linhas + ' linhas não conta.\n\n' +
    'Tema: ' + t.titulo + '\nComando: ' + t.comando + '\n' + t.aspectos.map((a, i) => (i + 1) + ') ' + a).join('\n') + '\n\n' +
    t.quesitos.map((q, i) => 'Quesito ' + (i + 1) + ' — ' + q.titulo + ' (0 a ' + q.max + ')\nPadrão de resposta:\n' + q.esperado.map((e) => '- ' + e).join('\n') + '\nConceitos:\n' + q.conceitos.map((c, k) => k + ' = ' + c).join('\n')).join('\n\n') +
    '\n\nConte também os erros de português (grafia, acentuação, pontuação, concordância, regência, crase), como o Cebraspe desconta.\n\n' +
    'Texto do candidato:\n"""\n' + texto.slice(0, 6000) + '\n"""\n\n' +
    'Responda só com JSON neste formato: {"quesitos":[{"conceito":2,"porque":"uma ou duas frases: o que garantiu o conceito e o que faltou"}],"erros":3,"exemplos":["trecho errado → forma correta"],"geral":"duas frases com o que mais rende melhorar"}. ' +
    'O array quesitos tem exatamente ' + t.quesitos.length + ' objetos, na ordem dos quesitos; exemplos tem no máximo 5.';
}
async function corrigirDiscIA() {
  const t = TEMAS_DISC.find((x) => x.id === UI.discTema);
  const texto = t && estadoDisc(t.id).rascunho.trim();
  if (!t || !texto || !iaPronta() || UI.discIACarregando) return;
  UI.discIACarregando = true;
  renderMais();
  try {
    const r = await IA.json(pedidoDiscIA(t, texto));
    // Se a pessoa trocou de tema ou voltou a editar enquanto o Claude lia, a correção não vale mais
    if (UI.discTema !== t.id || UI.discFase === 'escrita') { UI.discIACarregando = false; return; }
    const qs = Array.isArray(r && r.quesitos) ? r.quesitos : [];
    if (qs.length !== t.quesitos.length) throw { code: 'invalid_json' };
    const aval = {};
    t.quesitos.forEach((q, i) => { aval[i] = Math.max(0, Math.min(q.max, Math.round(Number(qs[i] && qs[i].conceito) || 0))); });
    UI.discAval = aval;
    UI.discNE = Math.max(0, Math.round(Number(r.erros) || 0));
    UI.discIA = { porque: qs.map((x) => String((x && x.porque) || '')), exemplos: (Array.isArray(r.exemplos) ? r.exemplos : []).slice(0, 5).map(String), geral: String(r.geral || '') };
  } catch (e) {
    avisar('!', 'Correção indisponível', erroIA(e));
  }
  UI.discIACarregando = false;
  if (UI.vista === 'mais') renderMais();
}
function folhaTermo(i) {
  const g = GLOSS[i];
  if (!g) return;
  const naLista = !!S.pesquisa[chavePesq(g.t)];
  const rel = Q.filter((q) => g.re.test(q.e + ' ' + q.c));
  abrirFolha(cabFolha('Glossário', g.t) + '<p>' + esc(g.d) + '</p>' +
    '<div class="linha-btns"><button class="btn primario" data-acao="investigar" data-t="' + esc(g.t) + '" data-o="glossário">Investigar</button>' +
    (naLista ? '<span class="selo ok">Na sua lista</span>' : '<button class="btn" data-acao="add-pesq" data-t="' + esc(g.t) + '" data-o="glossário">Guardar na lista</button>') + '</div>' +
    (rel.length ? '<div class="linha-btns"><button class="btn" data-acao="treinar-termo" data-t="' + i + '">Treinar ' + pl(rel.length, 'questão', 'questões') + ' com este termo</button></div>' : ''), g.t);
}

/* ================= Lei seca ================= */
function marcarLido(art) {
  if (!S.perfil.lidos) S.perfil.lidos = {};
  const d = diaLog();
  if (!d.a.includes(art)) d.a.push(art);
  if (!S.perfil.lidos[art]) S.perfil.lidos[art] = hojeISO();
  verificarConquistas();
  verificarRPG();
  Store.salvar('perfil');
}
// Item real do Cebraspe sobre o artigo pesa mais que questão autoral: mostra o que a banca de fato cobra
function importancia(id) {
  const qa = POR_ART.get(id) || [], qs = qa.length, reais = qa.filter((q) => q.o).length;
  const cs = (CARDS_POR_ART.get(id) || []).length;
  const b = BLOCO_DO_ART.get(id);
  const bonus = b ? (b.prioridade === 1 ? 4 : b.prioridade === 2 ? 2 : 0) : 0;
  return qs * 2 + reais * 3 + cs + bonus;
}
function estrelas(id) { const s = importancia(id); return s >= 16 ? 3 : s >= 8 ? 2 : s >= 3 ? 1 : 0; }
// Os grifos também reconhecem o inglês do GDPR (EUR, %, prazos em horas e anos, shall/may, unless, only...)
const RE_NUM = /(?:R\$\s?)?\d[\d.,]*%?\s\([^)]+\)(?:\s(?:dias|meses|anos|horas))?|\d{1,2}º? de [a-zç]+ de \d{4}|\d{1,3}(?: \d{3})+ EUR|\d+ %|\b\d+ (?:hours|days|weeks|months|years)\b|\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}/g;
const RE_ALERTA = /(?<![\p{L}])(?:somente|exclusivamente|exclusiva|exclusivos|vedad[oa]s?|salvo|exceto|ressalvad[oa]s?|desde que|em nenhuma hipótese|em nenhum caso|em circunstância alguma|independentemente|não se aplica|sem prejuízo|só não|apenas|sempre que possível|a qualquer momento|imediatamente|nul[oa]s?|gratuita|sem custos|only|solely|exclusively|unless|except|prohibited|shall not|not apply|without prejudice|in any case|regardless|irrespective|free of charge|without undue delay)(?![\p{L}])/giu;
const RE_VERBO = /(?<![\p{L}])(?:deverá|deverão|deve|devem|poderá|poderão|pode|podem|compete|competem|cabe|obriga-se|é obrigado|shall|may|must)(?![\p{L}])/giu;
function rangesRegex(linha, re, cls) {
  const out = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(linha))) { if (!m[0]) { re.lastIndex++; continue; } out.push([m.index, m.index + m[0].length, cls]); }
  return out;
}
function rangesTexto(linha, trechos, cls) {
  const out = [];
  for (const t of trechos) {
    if (!t) continue;
    let i = linha.indexOf(t);
    while (i >= 0) { out.push([i, i + t.length, cls]); i = linha.indexOf(t, i + t.length); }
  }
  return out;
}
// Remissão dentro do texto ("exceto nas hipóteses previstas no art. 16 desta Lei"): o artigo citado abre logo abaixo da
// linha, na própria tela. Só vale para a mesma norma: depois do número, "da Lei nº…", "do Decreto…" ou "do ADCT" é outra
// norma, e "desta Lei" ou nada é a própria; antes do número, "Medida Provisória nº 2.228-1, de 2001, os arts. 1º…"
// (cláusula de revogação) também é outra. Linha recuada ou entre aspas é texto de outra norma alterada por esta.
const RE_REMISSAO = /(?<![\p{L}])arts?\.\s(\d+)(?:\s?[º°o])?(-[A-Z])?((?:(?:,\s|\se\s|\sa\s)\d+(?:\s?[º°o])?(?:-[A-Z])?)*)/gu;
const OUTRA_NORMA_DEPOIS = /^[^.;:]{0,80}?(?:\s(?:d[aoe]s?|n[ao]s?)\s(?:Lei|Decreto|Constituição|Código|Medida Provisória|Emenda|Resolução|Convenção|Regimento|Ato das Disposições|ADCT|Consolidação|Estatuto)(?![\p{L}])|\s-\s?ADCT)/u;
const MESMA_NORMA = /^[^.;:]{0,80}?\s(?:desta|deste)\s(?:Lei|Decreto|Resolução|Regulamento|Constituição|Código|Estatuto|Portaria|Regimento)/u;
const OUTRA_NORMA_ANTES = /(?:Lei|Decreto|Decreto-Lei|Medida Provisória|Lei Complementar|Resolução)(?: Complementar)? nº [\d.\-]+(?:, de [^,;]{1,30})?,?\s(?:e\s)?(?:os|o|as|a|nos|no|dos|do)?\s?$/u;
function remissoesDaLinha(linha, a) {
  if (/^[\s“"]/.test(linha)) return [];
  const semAbrev = (t) => t.replace(/(?<![\p{L}])(arts?|inc|al|n)\./gu, '$1');
  const out = [];
  RE_REMISSAO.lastIndex = 0;
  let m;
  while ((m = RE_REMISSAO.exec(linha))) {
    const depois = semAbrev(linha.slice(m.index + m[0].length, m.index + m[0].length + 120));
    if (!MESMA_NORMA.test(depois) && OUTRA_NORMA_DEPOIS.test(depois)) continue;
    if (OUTRA_NORMA_ANTES.test(linha.slice(Math.max(0, m.index - 90), m.index))) continue;
    // cada número da lista ("arts. 7º e 11") vira o seu botão
    const ini = m.index + m[0].indexOf(m[1]), lista = linha.slice(ini, m.index + m[0].length), re = /(\d+)(?:\s?[º°o])?(-[A-Z])?/g;
    let n;
    while ((n = re.exec(lista))) {
      const k = chave(a.lei, n[1] + (n[2] || ''));
      // o primeiro número leva junto o "art.", para o toque ter onde pegar
      if (k !== a.k && ARTI.has(k)) out.push([n.index ? ini + n.index : m.index, ini + n.index + n[0].length, 'ref-lei', k]);
    }
  }
  return out;
}
// Texto vigente do artigo: sem as linhas revogadas e vetadas
function textoVigente(a) { return a.texto.split('\n').filter((l) => !linhaRevogada(l) && !/\(VETADO\)/.test(l)).join('\n'); }
// Termos técnicos do artigo (de ofício, ônus da prova, ad referendum…), na ordem em que aparecem, recolhidos a um toque
function caixaJuridiques(a) {
  const texto = textoVigente(a);
  const achados = JURIDIQUES.map((g) => ({ g, i: texto.search(g.re) })).filter((x) => x.i >= 0).sort((x, y) => x.i - y.i).slice(0, 8);
  if (!achados.length) return '';
  return '<details class="juridiques"><summary>Termos técnicos deste artigo (' + achados.length + ')</summary><dl>' +
    achados.map(({ g }) => '<dt>' + esc(g.t) + '</dt><dd>' + esc(g.d) + '</dd>').join('') + '</dl></details>';
}
// O artigo em português claro, antes do texto da lei: o que ele manda, para quem, quando e com que exceção. Os das
// trilhas vêm escritos e conferidos (dados/claro.json); nos outros, o Claude traduz na hora, a pedido, com o aviso de
// conferir no texto. A tradução gerada fica guardada só nesta abertura. Na caixa de remissão, só a escrita.
const CLARO = D.claro || {};
const CLARO_IA = new Map();
function htmlClaro(a, enxuto) {
  if (!artigoVivo(a.k)) return '';
  if (CLARO[a.k]) return '<div class="claro"><span class="rotulo">Em português claro</span><p>' + grifarProsa(CLARO[a.k]) + '</p></div>';
  if (enxuto) return '';
  if (CLARO_IA.has(a.k)) return '<div class="claro ia"><span class="rotulo">Em português claro · gerado pelo Claude, confira no texto</span><p>' + esc(CLARO_IA.get(a.k)) + '</p></div>';
  return iaPronta() ? '<div class="claro vazio"><button class="btn pequeno" data-acao="claro-ia" data-art="' + esc(a.k) + '">Explicar este artigo em português claro (Claude)</button></div>' : '';
}
function pedidoClaro(a) {
  return 'Explique em português claro, para quem estuda para concurso e nunca leu lei, o que diz o dispositivo abaixo (' + LEIS[a.lei].curto + ', ' + rotuloArt(a.k) + '). Regras: ' +
    '1) diga o que ele manda, proíbe ou permite, para quem, quando e com que exceções, seguindo a ordem do texto; ' +
    '2) não acrescente nada que o texto não diga, não cite jurisprudência nem doutrina e, se algo depender de outro artigo, diga só que depende; ' +
    '3) explique cada termo técnico com palavras do dia a dia na própria frase; ' +
    '4) texto corrido, de 3 a 6 frases, sem markdown, títulos ou listas.\n\nTexto:\n' + textoVigente(a);
}
async function traduzirIA(alvo) {
  const k = alvo.dataset.art, a = ARTI.get(k), caixa = alvo.closest('.claro');
  if (!a || !caixa || !iaPronta()) return;
  caixa.classList.remove('vazio');
  caixa.innerHTML = '<span class="rotulo">Em português claro · o Claude está escrevendo…</span><p></p>';
  const p = caixa.querySelector('p');
  try {
    const r = await IA(pedidoClaro(a), { onText: ({ text }) => { p.textContent = text; } });
    CLARO_IA.set(k, r.text.trim() + (r.truncated ? ' […]' : ''));
    caixa.classList.add('ia');
    caixa.innerHTML = '<span class="rotulo">Em português claro · gerado pelo Claude, confira no texto</span><p>' + esc(CLARO_IA.get(k)) + '</p>';
  } catch (e) {
    caixa.classList.add('vazio');
    caixa.innerHTML = '<button class="btn pequeno" data-acao="claro-ia" data-art="' + esc(k) + '">Explicar este artigo em português claro (Claude)</button>';
    if (!e || e.code !== 'cancelled') avisar('!', 'Claude indisponível', erroIA(e));
  }
}
function textoLei(a, qExtras) {
  const cam = UI.camadas;
  const erros = [], cai = [], extras = [];
  for (const q of POR_ART.get(a.k) || []) { const r = rec(q.id); if (r && r[3] > 0) erros.push(...q.t); cai.push(...q.t); }
  for (const c of CARDS_POR_ART.get(a.k) || []) cai.push(c.nota.t.replace(RE_LACUNA, '$2'));
  for (const id of qExtras || []) { const q = QI.get(id); if (q) extras.push(...q.t); }
  return a.texto.split('\n').map((linha, k) => {
    // Vetos e revogações não têm valor de estudo: a linha aparece apagada e sem grifo, e a revogada sem o texto antigo
    const rev = linhaRevogada(linha);
    if (rev) return '<p class="par vetado">' + (rev.rotulo ? esc(rev.rotulo) + ' ' : '') + '<span class="nota">' + esc(rev.nota) + '</span></p>';
    if (/^(?:Art\. [\dA-Zº-]+\.?|§ \d+º|Parágrafo único\.?|[IVXL]+(?:-[A-Z])? -|[a-z]\))\s*\(VETADO\)/.test(linha)) return '<p class="par vetado">' + esc(linha) + '</p>';
    let rs = [];
    if (cam.cai) rs = rs.concat(rangesTexto(linha, cai, 'g-cai'));
    rs = rs.concat(rangesTexto(linha, extras, 'g-cai'));
    if (cam.erro) rs = rs.concat(rangesTexto(linha, erros, 'g-erro'));
    if (cam.num) rs = rs.concat(rangesRegex(linha, RE_NUM, 'g-num'));
    if (cam.alerta) rs = rs.concat(rangesRegex(linha, RE_ALERTA, 'g-alerta'));
    if (cam.verbo) rs = rs.concat(rangesRegex(linha, RE_VERBO, 'g-verbo'));
    const remissoes = remissoesDaLinha(linha, a);
    rs = rs.concat(remissoes);
    const cortes = new Set([0, linha.length]);
    rs.forEach(([i, f]) => { cortes.add(i); cortes.add(f); });
    const pts = [...cortes].sort((x, y) => x - y);
    let html = '', caixa = null;
    for (let j = 0; j < pts.length - 1; j++) {
      const i = pts[j], f = pts[j + 1];
      const classes = new Set(rs.filter((r) => r[0] <= i && r[1] >= f).map((r) => r[2]));
      if (classes.has('g-erro')) classes.delete('g-cai');
      const seg = fmtNotas(esc(linha.slice(i, f)));
      const rem = classes.delete('ref-lei') && remissoes.find((r) => r[0] <= i && r[1] >= f);
      if (rem) {
        caixa ||= 'art-' + (++nCaixaArt);
        html += '<button class="ref-art' + (classes.size ? ' ' + [...classes].join(' ') : '') + '" data-acao="art-inline" data-art="' + esc(rem[3]) + '" data-box="' + caixa + '" aria-controls="' + caixa + '" aria-expanded="false" aria-label="Ler ' + esc(nomeArt(rem[3])) + ' aqui">' + seg + '</button>';
      } else html += classes.size ? '<span class="' + [...classes].join(' ') + '">' + seg + '</span>' : seg;
    }
    let cls = 'par';
    if (k === 0) cls = 'caput';
    else if (/^[IVXL]+(-[A-Z])?\s-/.test(linha)) cls = 'inc';
    else if (/^[a-z]\)/.test(linha) || /^\((?:[a-z]{1,2}|[ivx]+)\) /.test(linha)) cls = 'ali';
    else if (/^\(\d+\) /.test(linha)) cls = 'inc';
    return '<p class="' + cls + '">' + html + '</p>' + (caixa ? '<div class="art-inline remissao" id="' + caixa + '" hidden></div>' : '');
  }).join('');
}
// Grifos das aulas da trilha: as mesmas camadas da lei seca (prazos e números, alerta, deve × pode), com números por
// extenso, que é como a aula escreve ("um terço", "três quintos", "dois turnos"), referências a dispositivos em destaque
// discreto e negrito no termo que está sendo definido ("Poder de polícia é…", "Plena:"). **termo** acrescenta negrito
// onde a regra não alcança.
const RE_NUM_PROSA = /(?<![\p{L}\d])(?:\d+(?:[.,]\d+)?%|\d+\s(?:dias(?: úteis| corridos)?|meses|anos|horas|turnos|vezes|membros)|(?:um|uma|dois|duas|três|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte|trinta|quarenta|cinquenta|sessenta|noventa|cem|cento e vinte|mil)\s(?:dias(?: úteis| corridos)?|meses|anos|horas|turnos|terços?|quintos?|quartos?|vezes|membros|instâncias)|três quintos|dois terços|um terço|mais da metade|metade|maioria (?:absoluta|relativa|simples|qualificada)|unanimidade)(?![\p{L}])/giu;
const RE_REF_PROSA = /(?<![\p{L}])(?:arts?\.\s\d+[º°]?(?:-[A-Z])?(?:,\s(?:[IVXL]+|§\s\d+[º°]?|caput|parágrafo único))*|§§?\s\d+[º°]?|(?:ADI|ADPF|RE|ARE|MS|HC)\s[\d.]+)/gu;
const RE_DEF_PROSA = /(?:^|(?<=[.;]\s))([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}\-]*(?:\s[\p{L}\-]+){0,4}?)(?=:\s|\s(?:é|são)\s(?:o|a|os|as|um|uma|aquel[ea]s?|quando|instrumento|atividade|ato|poder|princípio|dever|direito|garantia|norma|conjunto|pessoa|órgão|entidade)(?![\p{L}]))/gu;
const NAO_NEGRITO = /^(?:(?:Ela|Ele|Elas|Eles|Isso|Isto|Há|Também|Mas|Já|Aqui|Ambos|Ambas|Cada|Toda|Todo|Na|No|Nas|Nos|Em|A|O|As|Os|É|Esse|Essa|Este|Esta)$|(?:O que|Que|Quem|Como|Quando|Onde)(?![\p{L}]))/u;
// refs (opcional): { mapa: Map(número do artigo → chave), lei, box } — a citação "art. 3º" vira botão que abre o artigo na
// caixa da parte da aula. Só vira botão o que se resolve sem dúvida: um artigo do subtema, ou da norma única do subtema
// quando a frase não cita outra norma logo antes.
const OUTRA_NORMA = /(?:Lei|Decreto|Resolução|Res\.|CF|Constituição|GDPR|LINDB|Código|Regimento|Portaria|IN |Convenção|ECA|Súmula)[^.;]{0,30}$/;
function refDeArtigo(refs, txt, antes) {
  const m = /arts?\.\s(\d+(?:-[A-Z])?)/.exec(txt);
  if (!refs || !m) return null;
  if (refs.mapa.has(m[1])) return refs.mapa.get(m[1]);
  if (!refs.lei || OUTRA_NORMA.test(antes)) return null;
  const k = chave(refs.lei, m[1]);
  return ARTI.has(k) && artigoVivo(k) ? k : null;
}
function grifarProsa(texto, refs) {
  const cam = UI.camadas;
  // **termo** vira negrito explícito; as posições são contadas no texto já sem os asteriscos
  const fortes = [];
  let limpo = '';
  String(texto).split(/(\*\*[^*]+\*\*)/).forEach((pedaco) => {
    const m = /^\*\*([^*]+)\*\*$/.exec(pedaco);
    if (m) { fortes.push([limpo.length, limpo.length + m[1].length, 'neg']); limpo += m[1]; } else limpo += pedaco;
  });
  let rs = fortes.slice();
  RE_DEF_PROSA.lastIndex = 0;
  let m;
  while ((m = RE_DEF_PROSA.exec(limpo))) {
    if (NAO_NEGRITO.test(m[1]) || m[1].length <= 2) continue;
    // O artigo fica fora do negrito: "A ANPD é…" grifa ANPD
    const art = /^(?:As?|Os?)\s/.exec(m[1]), ini = m.index + (art ? art[0].length : 0);
    rs.push([ini, m.index + m[1].length, 'neg']);
  }
  if (cam.num) rs = rs.concat(rangesRegex(limpo, RE_NUM_PROSA, 'g-num'));
  if (cam.alerta) rs = rs.concat(rangesRegex(limpo, RE_ALERTA, 'g-alerta'));
  if (cam.verbo) rs = rs.concat(rangesRegex(limpo, RE_VERBO, 'g-verbo'));
  const citacoes = rangesRegex(limpo, RE_REF_PROSA, 'ref-dispo');
  rs = rs.concat(citacoes);
  const alvo = new Map(refs ? citacoes.map((r) => [r, refDeArtigo(refs, limpo.slice(r[0], r[1]), limpo.slice(Math.max(0, r[0] - 40), r[0]))]) : []);
  const cortes = new Set([0, limpo.length]);
  rs.forEach(([i, f]) => { cortes.add(i); cortes.add(f); });
  const pts = [...cortes].sort((x, y) => x - y);
  let html = '';
  for (let j = 0; j < pts.length - 1; j++) {
    const i = pts[j], f = pts[j + 1];
    const classes = [...new Set(rs.filter((r) => r[0] <= i && r[1] >= f).map((r) => r[2]))];
    const seg = esc(limpo.slice(i, f));
    const cit = refs && classes.includes('ref-dispo') ? citacoes.find((r) => r[0] <= i && r[1] >= f) : null, k = cit && alvo.get(cit);
    if (k) html += '<button class="' + classes.join(' ') + ' ref-art" data-acao="art-inline" data-art="' + esc(k) + '" data-box="' + refs.box + '" aria-controls="' + refs.box + '" aria-expanded="false">' + seg + '</button>';
    else html += classes.length ? '<span class="' + classes.join(' ') + '">' + seg + '</span>' : seg;
  }
  return html;
}
function fmtNotas(s) { return s.replace(/\((Redação dada|Incluído|Incluída|Revogado|Promulgação)[^)]*\)/g, (m) => '<span class="nota">' + m + '</span>'); }
// Na aula só valem as camadas que dependem do texto (números, alerta, deve × pode); "o que cai" e "meus erros" são da lei
function legendaCamadas(soTexto) {
  const cam = UI.camadas;
  const item = (k, t, estilo) => '<button class="camada" data-acao="camada" data-c="' + k + '" aria-pressed="' + !!cam[k] + '"><i style="' + estilo + '"></i>' + t + '</button>';
  return '<div class="camadas" aria-label="Grifos">' +
    (soTexto ? '' : item('cai', 'O que cai', 'background:var(--mark)')) + item('num', 'Prazos e números', 'background:var(--accent)') +
    item('alerta', 'Palavras de alerta', 'background:var(--errado)') + item('verbo', 'Deve × pode', 'border:1.5px dotted var(--ink)') +
    (soTexto ? '' : item('erro', 'Meus erros', 'background:var(--errado-bg);box-shadow:inset 0 -2px 0 var(--errado)')) + '</div>';
}
function seletorLei() {
  return '<label class="rotulo" for="sel-lei">Norma</label><select id="sel-lei" class="sel-lei" data-acao="sel-lei">' +
    GRUPOS.map((g) => '<optgroup label="' + esc(g.nome) + '">' + g.ids.map((id) => '<option value="' + esc(id) + '"' + (id === UI.lei ? ' selected' : '') + '>' + esc(LEIS[id].nome) + '</option>').join('') + '</optgroup>').join('') + '</select>';
}
function primeiraLinha(a) { const ls = a.texto.split('\n'); return (/^Article \d+$/.test(ls[0]) && ls[1] ? ls[1] : ls[0]).replace(/^(Art\.|CLÁUSULA|APÊNDICE|ENUNCIADO)\s*[\dIVXL\-A-Zº°o.]+\s*/, '').replace(/^[IVXL]+ - /, ''); }
function renderLei() {
  const el = document.getElementById('vista-lei');
  if (!Object.keys(LEIS).length) { el.innerHTML = '<p class="vazio-msg">Nenhum texto legal anexado ainda.</p>'; return; }
  if (!LEIS[UI.lei]) UI.lei = LEIS.lgpd ? 'lgpd' : Object.keys(LEIS)[0];
  if (UI.artSel && ARTI.get(UI.artSel)) { el.innerHTML = renderArtigo(UI.artSel); return; }
  UI.artSel = null;
  const L = LEIS[UI.lei];
  const arts = L.artigos;
  const lidos = arts.filter((a) => S.perfil.lidos && S.perfil.lidos[a.k]).length;
  let html = '<div class="secao"><div class="sel-lei-caixa">' + seletorLei() + '</div>' +
    '<div class="secao-cab"><h2>' + esc(L.nome) + '</h2><a class="pequeno" href="' + esc(L.url) + '" target="_blank" rel="noopener">Fonte oficial ↗</a></div>' +
    (L.aviso ? '<p class="aviso-conferir">' + esc(L.aviso) + '</p>' : '') +
    '<p class="pequeno mudo">' + pl(arts.length, 'unidade', 'unidades') + ' · ' + lidos + ' lida' + (lidos === 1 ? '' : 's') + ' · ' + pl((arts.reduce((n, a) => n + (POR_ART.get(a.k) || []).length, 0)), 'questão ligada', 'questões ligadas') + '</p>' +
    '<input class="busca" id="busca-lei" type="search" placeholder="Buscar em todas as normas (ex.: quinze dias, encarregado, Senado)" value="' + esc(UI.busca) + '" aria-label="Buscar em todas as normas">' +
    '<div class="chips"><button class="chip" data-acao="ranking" aria-pressed="' + UI.ranking + '">Mais importantes primeiro</button><button class="chip" data-acao="ler-tudo">Ler do início</button></div>' +
    '<p class="pequeno mudo">Estrelas: quanto o artigo pesa no banco (questões, itens reais do Cebraspe com peso maior, cards e prioridade do bloco). Pontos: as questões sobre ele (verde dominada, vermelho na lista curta, cinza não respondida).</p></div>';
  if (UI.busca.trim().length >= 3) html += '<div class="resultado-busca">' + buscarLei(UI.busca) + '</div>';
  else if (UI.ranking) {
    const top = arts.map((a) => ({ a, s: importancia(a.k) })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s).slice(0, 30);
    html += top.length
      ? '<div class="ranking">' + top.map(({ a }) => '<button data-acao="abrir-art" data-art="' + esc(a.k) + '"><b>' + esc(rotuloArt(a.k)) + '</b><span class="t">' + esc(primeiraLinha(a).slice(0, 90)) + '</span><span class="estrelas">' + '★'.repeat(estrelas(a.k)) + '</span></button>').join('') + '</div>'
      : '<p class="vazio-msg">Ainda não há questões nem cards ligados a esta norma para montar o ranking.</p>';
  } else {
    let atual = null, aberto = false;
    for (const a of arts) {
      const cap = a.estrutura[0] || '';
      if (cap !== atual || !aberto) {
        if (aberto) html += '</div></div>';
        html += '<div class="capitulo">' + (cap ? '<h3>' + esc(cap.replace(/\s*\(Redação dada[^)]*\)/, '')) + '</h3>' : '') + '<div class="artigos">';
        aberto = true; atual = cap;
      }
      const qs = POR_ART.get(a.k) || [];
      const pontos = qs.slice(0, 6).map((q) => { const r = rec(q.id); return '<i class="' + (!r || r[0] < 0 ? 'nv' : r[0] >= 3 ? 'ok' : 'no') + '"></i>'; }).join('');
      const vetado = /\((VETADO|Revogad[oa])/.test(a.texto.split('\n')[0]);
      const est = estrelas(a.k);
      html += '<button class="art-btn' + (S.perfil.lidos && S.perfil.lidos[a.k] ? ' lido' : '') + '" data-acao="abrir-art" data-art="' + esc(a.k) + '"' + (vetado ? ' style="opacity:.5"' : '') + ' aria-label="' + esc(rotuloArt(a.k)) + '">' + esc(a.id) + (est ? '<span class="estrelas">' + '★'.repeat(est) + '</span>' : '') + '<span class="pontos">' + pontos + '</span></button>';
    }
    if (aberto) html += '</div></div>';
  }
  el.innerHTML = html;
}
// Busca em todas as normas: a norma aberta vem primeiro; no máximo 60 resultados
function buscarLei(termo) {
  const palavras = semAcento(termo.trim()).split(/[^a-z0-9º]+/).filter(Boolean);
  if (!palavras.length) return '';
  const re = new RegExp(palavras.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^a-z0-9º]+'));
  const ordem = [UI.lei].concat(GRUPOS.flatMap((g) => g.ids).filter((id) => id !== UI.lei));
  const res = [];
  let total = 0;
  for (const id of ordem) {
    for (const a of artsDe(id)) {
      if (!a.sa) a.sa = semAcento(a.texto);
      const m = re.exec(a.sa);
      if (!m) continue;
      total++;
      if (res.length >= 60) continue;
      const ini = Math.max(0, m.index - 60);
      res.push('<button data-acao="abrir-art" data-art="' + esc(a.k) + '"><b>' + esc(id === UI.lei ? rotuloArt(a.k) : LEIS[id].curto + ' · ' + rotuloArt(a.k)) + '</b><span>' + esc((ini ? '…' : '') + a.texto.slice(ini, m.index + m[0].length + 90).replace(/\n/g, ' ') + '…') + '</span></button>');
    }
  }
  if (!res.length) return '<p class="vazio-msg">Nada encontrado para “' + esc(termo) + '”.</p>';
  return (total > res.length ? '<p class="pequeno mudo">' + total + ' resultados; mostrando os 60 primeiros (norma aberta primeiro).</p>' : '') + res.join('');
}
function renderArtigo(k) {
  const a = ARTI.get(k);
  const L = LEIS[a.lei];
  const fila = UI.leiFila && UI.leiFila.includes(k) ? UI.leiFila : null;
  const seq = fila || artsDe(a.lei).map((x) => x.k);
  const idx = seq.indexOf(k);
  const ant = idx > 0 ? seq[idx - 1] : null, prox = idx < seq.length - 1 ? seq[idx + 1] : null;
  const qs = POR_ART.get(k) || [];
  const cs = CARDS_POR_ART.get(k) || [];
  let html = '<div class="secao-cab"><button class="btn pequeno" data-acao="voltar-lei">' + esc(L.curto) + ': todos os artigos</button><div class="linha-btns">' +
    '<button class="btn pequeno" data-acao="nav-art" data-art="' + esc(ant || '') + '"' + (ant ? '' : ' disabled') + ' aria-label="Artigo anterior">←</button>' +
    '<button class="btn pequeno" data-acao="nav-art" data-art="' + esc(prox || '') + '"' + (prox ? '' : ' disabled') + ' aria-label="Próximo artigo">→</button></div></div>';
  if (L.aviso) html += '<p class="aviso-conferir">' + esc(L.aviso) + '</p>';
  if (fila) html += '<div class="fila-leitura"><span>Leitura do dia: ' + (idx + 1) + ' de ' + fila.length + '</span>' + (prox ? '' : '<button class="btn pequeno" data-acao="fim-fila">Concluir leitura</button>') + '</div>';
  const est = estrelas(k);
  html += '<div class="cartao"><span class="rotulo">' + esc([L.curto].concat(a.estrutura).join(' · ')) + '</span><h2>' + esc(rotuloArt(k)) + (est ? ' <span class="estrelas" title="Importância no banco">' + '★'.repeat(est) + '</span>' : '') + '</h2>' +
    htmlClaro(a) + legendaCamadas() + '<div class="texto-lei">' + textoLei(a) + '</div>' + caixaJuridiques(a) + '<div class="linha-btns">';
  if (qs.length) html += '<button class="btn primario" data-acao="treinar-art" data-art="' + esc(k) + '">Questões deste artigo (' + qs.length + ')</button>';
  if (cs.length) html += '<button class="btn" data-acao="cards-art" data-art="' + esc(k) + '">Cards deste artigo (' + cs.length + ')</button>';
  html += '</div>';
  if (!qs.length && !cs.length) html += '<p class="mudo pequeno">Nenhuma questão ou card do banco cita este artigo diretamente.</p>';
  const termos = termosDe(a.texto, 5, 0.5);
  if (termos.length) html += '<div class="pesquisar-box"><span class="rotulo">Termos deste artigo para entender</span><div class="chips">' + termos.map((t) => '<button class="chip termo-chip" data-acao="termo" data-t="' + t.g.i + '">' + esc(t.g.t) + '</button>').join('') + '</div></div>';
  return html + '</div>';
}

/* ================= Mais ================= */
function renderMais() {
  const el = document.getElementById('vista-mais');
  const sub = UI.mais;
  if (sub === 'progresso') el.innerHTML = voltarMais() + renderProgresso();
  else if (sub === 'plano') el.innerHTML = voltarMais() + renderPlano();
  else if (sub === 'pesquisar') el.innerHTML = voltarMais() + renderPesquisar();
  else if (sub === 'glossario') el.innerHTML = voltarMais() + renderGlossario();
  else if (sub === 'metodo') el.innerHTML = voltarMais() + renderMetodo();
  else if (sub === 'cebraspe') el.innerHTML = voltarMais() + renderCebraspe();
  else if (sub === 'discursiva') el.innerHTML = (UI.discTema ? '' : voltarMais()) + renderDiscursiva();
  else if (sub === 'contestacoes') el.innerHTML = voltarMais() + renderContestacoes();
  else if (sub === 'trilha') el.innerHTML = (UI.subtema ? '' : voltarMais()) + renderTrilhas();
  else if (sub === 'ajustes') el.innerHTML = voltarMais() + renderAjustes();
  else if (sub === 'personagem') el.innerHTML = voltarMais() + renderPersonagem();
  else {
    const pend = Object.values(S.pesquisa).filter((p) => !p.s).length;
    const item = (s, ic, t, d) => '<button data-acao="mais" data-sub="' + s + '"><span class="ic">' + ic + '</span><span class="tx"><b>' + t + '</b><span class="s">' + d + '</span></span><span class="mudo">›</span></button>';
    el.innerHTML = '<div class="secao-cab"><h2>Mais</h2></div><div class="menu-mais">' +
      item('trilha', '§', 'Trilhas do zero', TRILHAS.length + ' matérias por subtema, para quem começa: pré-teste, aula, prática e domínio') +
      item('metodo', '1·2', 'Método', 'Como estudar com o app para passar') +
      item('cebraspe', 'C/E', 'Como o Cebraspe cobra', 'A prova, o padrão por disciplina, itens reais e discursiva') +
      item('discursiva', '✎', 'Treino de discursiva', TEMAS_DISC.length + ' temas com quesitos no padrão Cebraspe, contador de linhas e nota estimada') +
      item('personagem', '♛', 'Personagem', 'Nível, atributos, equipamento, inventário e chefões derrotados') +
      item('progresso', '▥', 'Progresso', 'Domínio por bloco, constância, onde você cai, conquistas') +
      item('plano', '▦', 'Plano e cronograma', 'Seis fases até a prova provável (' + fmtData(D.cronograma.prova, { day: '2-digit', month: '2-digit', year: 'numeric' }) + '), status dos blocos, textos que faltam') +
      item('pesquisar', '?', 'Para pesquisar', pend ? pl(pend, 'tema pendente', 'temas pendentes') + ' na sua lista' : 'Temas e termos para entender melhor') +
      item('glossario', 'Aa', 'Glossário', GLOSS.length + ' termos com definição e busca sugerida') +
      item('contestacoes', '!', 'Minhas contestações', CONTEST.length ? pl(CONTEST.length, 'contestação', 'contestações') + ', ' + CONTEST.filter((c) => c.status === 'aberta' || c.status === 'pendente').length + ' em aberto' : 'Itens que você apontou como errados e a resposta') +
      item('ajustes', '⚙', 'Ajustes, backup e diagnóstico', 'Metas, salvar progresso em arquivo, conferir a gravação') + '</div>';
  }
}
// Conquistas: as quatro mais recentes à mostra (fecham duas linhas no celular) e os cinco grupos recolhidos, cada um com a contagem
function cartaoConquistas() {
  const feitas = CONQ.filter((c) => S.perfil.conq[c.id]);
  const card = (c) => '<div class="conquista' + (S.perfil.conq[c.id] ? '' : ' bloqueada') + '"><div class="ic">' + esc(c.ic) + '</div><b>' + esc(c.nome) + '</b><span>' + esc(c.desc) + '</span></div>';
  const recentes = feitas.slice().sort((a, b) => (S.perfil.conq[a.id] < S.perfil.conq[b.id] ? 1 : -1)).slice(0, 4);
  return '<div class="secao"><div class="secao-cab"><h2>Conquistas</h2><span class="mudo pequeno">' + feitas.length + ' de ' + CONQ.length + '</span></div>' +
    (recentes.length ? '<div class="conquistas">' + recentes.map(card).join('') + '</div>' : '<p class="mudo pequeno">Nenhuma ainda: a primeira sai no primeiro item respondido.</p>') +
    GRUPOS_CONQ.map(([g, nome]) => {
      const cs = CONQ.filter((c) => c.g === g), n = cs.filter((c) => S.perfil.conq[c.id]).length;
      return '<details class="det-lista" data-det="cq-' + g + '"' + (UI.det['cq-' + g] ? ' open' : '') + '><summary>' + esc(nome) + ' <span class="mudo pequeno">' + n + ' de ' + cs.length + '</span></summary><div class="conquistas">' + cs.map(card).join('') + '</div></details>';
    }).join('') + '</div>';
}
// Prontidão: acerto na primeira resposta de cada item (inédito), separado em itens reais de prova e itens escritos para
// o banco, que tendem a ser mais fáceis. A nota estimada usa, por disciplina, o acerto nos reais quando há 10 ou mais
// respondidos; senão, o acerto nos do banco multiplicado pela razão geral reais ÷ banco (medida a partir de 30 reais).
// Conta só certo/errado e supõe todos os itens marcados: cada item vale 2p − 1 do seu peso.
function prontidao() {
  const z = () => ({ c: 0, n: 0 });
  const real = z(), banco = z(), porD = {};
  for (const q of Q) {
    if (q.al) continue;
    const r = rec(q.id), d = (BI.get(q.b) || {}).disciplina;
    if (!r || r[7] == null || !PONTOS_DISC[d]) continue;
    const x = (porD[d] ||= { r: z(), b: z() });
    for (const t of q.o ? [real, x.r] : [banco, x.b]) { t.n++; t.c += r[7]; }
  }
  const fator = real.n >= 30 && banco.n >= 30 && banco.c ? real.c / real.n / (banco.c / banco.n) : 1;
  let soma = 0, peso = 0;
  const linhas = Object.keys(PONTOS_DISC).sort((a, b) => PONTOS_DISC[b] - PONTOS_DISC[a]).map((d) => {
    const x = porD[d] || { r: z(), b: z() };
    let p = null, fonte = 'sem dados';
    if (x.r.n >= 10) { p = x.r.c / x.r.n; fonte = 'reais'; }
    else if (x.b.n >= 10) { p = Math.min(1, (x.b.c / x.b.n) * fator); fonte = fator === 1 ? 'banco' : 'banco corrigido'; }
    if (p != null) { soma += PONTOS_DISC[d] * (2 * p - 1); peso += PONTOS_DISC[d]; }
    return { d, x, p, fonte };
  });
  return { real, banco, fator, linhas, nota: peso ? (soma / peso) * PONTOS_PROVA : null, cobre: peso / PONTOS_PROVA };
}
function cartaoProntidao() {
  const pr = prontidao(), { real, banco } = pr;
  const livres = REAIS.filter((q) => !q.al && inedito(q)).length;
  const taxa = (t) => (t.n ? pct(t.c, t.n) + '%' : '—');
  let html = '<div class="cartao"><div class="secao-cab"><h2>Prontidão para a prova</h2><span class="mudo pequeno">' + pl(real.n, 'item real respondido', 'itens reais respondidos') + '</span></div>';
  html += '<div class="dominio">' +
    '<div class="dom-linha"><span class="nome">Itens reais de prova · ' + pl(real.n, 'primeira resposta', 'primeiras respostas') + '</span>' + barra(real.n ? real.c / real.n : 0) + '<span class="val">' + taxa(real) + '</span></div>' +
    '<div class="dom-linha"><span class="nome">Itens escritos para o banco · ' + pl(banco.n, 'primeira resposta', 'primeiras respostas') + '</span>' + barra(banco.n ? banco.c / banco.n : 0) + '<span class="val">' + taxa(banco) + '</span></div></div>';
  if (pr.nota != null && pr.cobre >= 0.5) {
    html += '<div class="nota-final"><span class="grande">' + Math.round(pr.nota) + '</span><span class="mudo">de ' + PONTOS_PROVA + ' pontos líquidos, se marcasse a prova inteira hoje' + (pr.cobre < 0.99 ? ' (estimativa sobre ' + Math.round(pr.cobre * 100) + '% da nota; o resto ainda não tem respostas)' : '') + '</span></div>';
  }
  let leitura;
  if (real.n < 30) leitura = 'Com ' + pl(real.n, 'item real respondido', 'itens reais respondidos') + ', ainda não dá para comparar. A medida fica confiável perto de 100 itens reais: faltam ' + Math.max(0, 100 - real.n) + '. Até lá, a estimativa usa os itens do banco, que tendem a ser mais fáceis que os da banca.';
  else {
    const dif = banco.n ? Math.round((banco.c / banco.n - real.c / real.n) * 100) : 0;
    leitura = dif > 2 ? 'Nos itens reais você acerta ' + dif + ' pontos percentuais a menos que nos do banco. A estimativa já desconta essa diferença nas disciplinas com poucos itens reais respondidos.'
      : dif < -2 ? 'Nos itens reais você acerta ' + -dif + ' pontos percentuais a mais que nos do banco: o banco não está facilitando para você.'
      : 'Nos itens reais e nos do banco o seu acerto é parecido: o banco está medindo bem o seu nível.';
    if (real.n < 100) leitura += ' Faltam ' + (100 - real.n) + ' itens reais para a medida ficar confiável.';
  }
  html += '<p>' + leitura + '</p>';
  const comDados = pr.linhas.filter((l) => l.x.r.n + l.x.b.n);
  if (comDados.length) {
    html += '<details class="det-lista" data-det="prontidao"' + (UI.det.prontidao ? ' open' : '') + '><summary>Por disciplina</summary><div class="tabela-env"><table class="tabela"><thead><tr><th>Disciplina</th><th>Na nota</th><th>Reais</th><th>Banco</th><th>Usado</th></tr></thead><tbody>' +
      comDados.map((l) => '<tr><td>' + esc((DI.get(l.d) || { nome: l.d }).nome) + '</td><td class="num">' + PONTOS_DISC[l.d] + '</td><td class="num">' + (l.x.r.n ? pct(l.x.r.c, l.x.r.n) + '% de ' + l.x.r.n : '—') + '</td><td class="num">' + (l.x.b.n ? pct(l.x.b.c, l.x.b.n) + '% de ' + l.x.b.n : '—') + '</td><td>' + (l.p == null ? 'menos de 10 respostas' : Math.round(l.p * 100) + '% (' + l.fonte + ')') + '</td></tr>').join('') +
      '</tbody></table></div></details>';
  }
  html += livres ? '<div class="linha-btns"><button class="btn primario" data-acao="treinar-reais">' + esc(rotuloPausa('reais:ineditos', 'Treinar ' + pl(Math.min(20, livres), 'item real inédito', 'itens reais inéditos'))) + '</button></div>' : '';
  html += '<p class="pequeno mudo">Conta só a primeira resposta de cada item certo/errado, no peso da nota (básica vale 1, específica vale 2). ' + pl(livres, 'item real ainda inédito', 'itens reais ainda inéditos') + ' no banco. Nos simulados de prova completa, pelo menos metade de cada disciplina vem deles enquanto houver inéditos.</p></div>';
  return html;
}
function renderProgresso() {
  const t = totais(), seq = sequencia();
  // Nível e XP ficam na Jornada (Hoje) e na ficha do personagem
  let html = '<div class="estat"><div><b>' + fmtNum(t.r) + '</b><span>itens respondidos</span></div><div><b>' + pct(t.c, t.r) + '%</b><span>de acerto</span></div><div><b>' + fmtNum(t.c - t.e) + '</b><span>nota líquida acumulada</span></div>' +
    '<div><b>' + fmtNum(t.k) + '</b><span>cards revisados</span></div><div><b>' + seq + '</b><span>dias seguidos</span></div><div><b>' + (S.perfil.melhorSeq || 0) + '</b><span>melhor sequência</span></div></div>';
  html += cartaoProntidao();
  html += cartaoTempoHistorico();
  html += '<div class="cartao"><div class="secao-cab"><h2>Constância</h2><span class="mudo pequeno">Últimas 16 semanas</span></div>' + mapaCalor() + '</div>';
  // Os blocos já praticados vêm do mais fraco ao mais forte; os outros ficam recolhidos. Tocar num bloco abre um treino dele.
  const doms = BLOCOS.filter((b) => (POR_BLOCO.get(b.id) || []).length).map((b) => ({ b, d: dominioBloco(b.id) || 0, resp: POR_BLOCO.get(b.id).filter((q) => { const r = rec(q.id); return r && r[0] >= 0; }).length }));
  const prat = doms.filter((x) => x.resp).sort((a, b) => a.d - b.d), nprat = doms.filter((x) => !x.resp).sort((a, b) => a.b.prioridade - b.b.prioridade);
  const linhaDom = (x) => '<button class="dom-linha" data-acao="treinar-bloco" data-bloco="' + esc(x.b.id) + '"><span class="nome">' + esc(x.b.nome) + (x.resp ? ' · ' + x.resp + ' respondidas' : '') + '</span>' + barra(x.d) + '<span class="val">' + Math.round(x.d * 100) + '%</span></button>';
  html += '<div class="cartao"><div class="secao-cab"><h2>Domínio por bloco</h2><span class="mudo pequeno">' + pl(prat.length, 'bloco praticado', 'blocos praticados') + '</span></div>' +
    (prat.length ? '<div class="dominio">' + prat.map(linhaDom).join('') + '</div>' : '<p class="mudo">Nenhum bloco praticado ainda.</p>') +
    (nprat.length ? '<details class="det-lista" data-det="nprat"' + (UI.det.nprat ? ' open' : '') + '><summary>Ainda não praticados (' + nprat.length + ')</summary><div class="dominio">' + nprat.map(linhaDom).join('') + '</div></details>' : '') +
    '<p class="pequeno mudo">Do mais fraco ao mais forte; toque num bloco para treinar 20 itens dele. Acerto de primeira vale 80%; o item chega a 100% quando você confirma o acerto na revisão seguinte. Erro zera.</p></div>';
  for (const t of TRILHAS) {
    const dom = t.subtemas.filter((st) => estadoSubtema(st.id).status === 'dominado').length;
    html += '<div class="cartao"><details class="det-lista" data-det="st-' + esc(t.id) + '"' + (UI.det['st-' + t.id] ? ' open' : '') + '><summary><b>Domínio por subtema · ' + esc(t.nome.replace(/ do zero$/, '')) + '</b> <span class="mudo pequeno">' + dom + ' de ' + t.subtemas.length + ' dominados</span></summary><div class="dominio">' +
      t.subtemas.map((st) => { const e = estadoSubtema(st.id); return '<button class="dom-linha" data-acao="subtema" data-st="' + esc(st.id) + '"><span class="nome">' + esc(st.nome) + '</span>' + barra(e.acerto * (e.n ? e.resp / e.n : 0)) + '<span class="val">' + (e.status === 'dominado' ? '✓' : e.resp + '/' + e.n) + '</span></button>'; }).join('') +
      '</div><p class="pequeno mudo">A barra combina quanto do subtema você já respondeu e quanto acerta hoje. ✓ = dominado.</p></details></div>';
  }
  const porDisc = {};
  for (const q of Q) { const r = rec(q.id); if (!r || r[0] < 0) continue; const dd = (BI.get(q.b) || {}).disciplina; const x = (porDisc[dd] ||= { c: 0, e: 0 }); x.c += r[2]; x.e += r[3]; }
  const discs = Object.entries(porDisc).filter(([, v]) => v.c + v.e >= 3);
  if (discs.length) html += '<div class="cartao"><div class="secao-cab"><h2>Acerto por disciplina</h2></div><div class="dominio">' + discs.map(([dd, v]) => '<div class="dom-linha"><span class="nome">' + esc((DI.get(dd) || { nome: dd }).nome) + ' · ' + (v.c + v.e) + ' respostas</span>' + barra(v.c / (v.c + v.e)) + '<span class="val">' + pct(v.c, v.c + v.e) + '%</span></div>').join('') + '</div></div>';
  // Acerto na primeira resposta: mede o nível sem o efeito de rever o mesmo item (registrado desde a versão 22)
  const prim = {};
  for (const q of Q) { const r = rec(q.id); if (!r || r[7] == null) continue; const dd = (BI.get(q.b) || {}).disciplina; const x = (prim[dd] ||= { c: 0, n: 0 }); x.n++; x.c += r[7]; }
  const pl1 = Object.entries(prim).filter(([, v]) => v.n >= 10);
  const tot1 = Object.values(prim).reduce((a, v) => ({ c: a.c + v.c, n: a.n + v.n }), { c: 0, n: 0 });
  const rm = retencaoMedida(), fp = fatorPessoa();
  html += '<div class="cartao"><div class="secao-cab"><h2>Revisão adaptativa</h2><span class="mudo pequeno">' + (rm.m ? pct(rm.mc, rm.m) + '% de ' + pl(rm.m, 'revisão', 'revisões') + ' no prazo em 30 dias' : 'sem revisões no prazo ainda') + '</span></div>' +
    '<p>' + (rm.calibra ? 'Você lembrou, com segurança, ' + pct(rm.mc, rm.m) + '% dos acertos antigos que voltaram. A meta é 90%: os intervalos de revisão estão ' + (fp > 1.02 ? 'alongados em ' + Math.round((fp - 1) * 100) + '%, porque você está esquecendo menos do que o previsto.' : fp < 0.98 ? 'encurtados em ' + Math.round((1 - fp) * 100) + '%, para os itens voltarem antes de serem esquecidos.' : 'no ponto certo.') : 'A calibração começa com 20 revisões de acertos antigos feitas no prazo (faltam ' + (20 - rm.m) + '). Até lá, os intervalos seguem o padrão.') + '</p>' +
    '<p class="pequeno mudo">Cada item também tem o seu ritmo: o que você já errou ou acertou com dúvida volta antes; o que acerta com segurança repetidas vezes espaça mais.</p></div>';
  html += '<div class="cartao"><div class="secao-cab"><h2>Acerto em itens inéditos</h2><span class="mudo pequeno">' + (tot1.n ? pct(tot1.c, tot1.n) + '% em ' + tot1.n + ' primeiras respostas' : 'primeira resposta de cada item') + '</span></div>' +
    (pl1.length ? '<div class="dominio">' + pl1.map(([dd, v]) => '<div class="dom-linha"><span class="nome">' + esc((DI.get(dd) || { nome: dd }).nome) + ' · ' + v.n + ' itens</span>' + barra(v.c / v.n) + '<span class="val">' + pct(v.c, v.n) + '%</span></div>').join('') + '</div>' : '<p class="mudo">Aparece por disciplina a partir de 10 itens respondidos pela primeira vez.</p>') +
    '<p class="pequeno mudo">O acerto geral sobe quando o mesmo item volta na revisão e você o reconhece. Aqui conta só a primeira resposta de cada item: é o número que se parece com a prova.</p></div>';
  const arm = {};
  for (const q of Q) { const r = rec(q.id); if (!r || r[0] < 0) continue; const x = (arm[q.a] ||= { c: 0, e: 0 }); x.c += r[2]; x.e += r[3]; }
  const armLista = Object.entries(arm).filter(([, v]) => v.c + v.e >= 3).map(([k, v]) => ({ k, taxa: v.e / (v.c + v.e) })).sort((a, b) => b.taxa - a.taxa);
  html += '<div class="cartao"><div class="secao-cab"><h2>Onde você cai</h2><span class="mudo pequeno">Taxa de erro por tipo de armadilha</span></div>' +
    (armLista.length ? '<div class="dominio">' + armLista.map((x) => '<div class="dom-linha"><span class="nome">' + esc(D.armadilhas[x.k] || x.k) + '</span>' + barra(x.taxa, '', '--accent:var(--errado)') + '<span class="val">' + Math.round(x.taxa * 100) + '%</span></div>').join('') + '</div>' +
      (armLista[0].taxa > 0 ? '<p class="pequeno mudo">Treine de propósito a pegadinha que mais te derruba: 20 itens só desse tipo, dos blocos mais cobrados.</p><div class="linha-btns">' + armLista.filter((x) => x.taxa > 0).slice(0, 3).map((x, i) => '<button class="btn pequeno' + (i ? '' : ' primario') + '" data-acao="treinar-arm" data-a="' + esc(x.k) + '">' + esc(rotuloPausa('arm:' + x.k, D.armadilhas[x.k] || x.k)) + '</button>').join('') + '</div>' : '') : '<p class="mudo">Responda algumas dezenas de itens para ver em que tipo de pegadinha você mais erra.</p>') + '</div>';
  let dc = 0, de = 0;
  for (const r of Object.values(S.itens)) { dc += r[5] || 0; de += r[6] || 0; }
  html += '<div class="cartao"><h2>Calibragem do chute</h2>' + (dc + de >= 5 ? '<p>Quando marca dúvida, você acerta <b>' + pct(dc, dc + de) + '%</b> (' + dc + ' de ' + (dc + de) + '). ' + (pct(dc, dc + de) > 50 ? 'Acima de 50%: na prova, chutar tende a somar pontos.' : 'Até 50%: na prova, deixar em branco tende a ser melhor.') + '</p>' : '<p class="mudo">Marque “Estou em dúvida” antes de responder. Com 5 marcações já dá para saber se o seu chute compensa.</p>') + '</div>';
  if (S.simulados.length) html += '<div class="cartao"><h2>Simulados</h2><div class="tabela-env"><table class="tabela"><thead><tr><th>Data</th><th>Itens</th><th>C</th><th>E</th><th>Nota</th><th>Pontos</th><th>Reais</th></tr></thead><tbody>' + S.simulados.slice(0, 12).map((s) => '<tr><td>' + esc(fmtData(s.data, { day: '2-digit', month: '2-digit' })) + '</td><td class="num">' + s.n + '</td><td class="num">' + s.c + '</td><td class="num">' + s.e + '</td><td class="num">' + s.liq + ' (' + pct(s.liq, s.n) + '%)</td><td class="num">' + (s.ptMax ? s.pt + ' de ' + s.ptMax : '—') + '</td><td class="num">' + (s.nr ? pct(s.cr, s.nr) + '% de ' + s.nr : '—') + '</td></tr>').join('') + '</tbody></table></div>' +
    '<p class="pequeno mudo">Pontos: nota com os pesos da prova (básica vale 1, específica vale 2). Reais: acerto nos itens reais de prova do simulado.</p></div>';
  html += cartaoConquistas();
  html += cartaoTrofeus();
  return html;
}
function mapaCalor() {
  const hoje = HOJE(), ini = hoje - diaSemana(isoDeNum(hoje)) - 15 * 7;
  let cells = '';
  for (let n = ini; n <= hoje; n++) {
    const iso = isoDeNum(n), d = S.perfil.dias[iso];
    const r = d ? d.r + Math.round((d.k || 0) / 2) : 0;
    const nivel = r === 0 ? 0 : r < 10 ? 1 : r < 25 ? 2 : r < 50 ? 3 : 4;
    cells += '<i data-n="' + nivel + '"' + (n === hoje ? ' class="hoje"' : '') + ' data-dica="' + esc(fmtData(iso, { day: '2-digit', month: '2-digit' }) + ': ' + (d ? pl(d.r, 'item', 'itens') + ', ' + pl(d.k || 0, 'card', 'cards') : 'sem estudo')) + '" aria-label="' + esc(iso + ': ' + r) + '"></i>';
  }
  return '<div class="calor-env"><div class="calor" role="img" aria-label="Estudo por dia nas últimas 16 semanas">' + cells + '</div></div>' +
    '<div class="calor-leg">menos <i style="background:var(--calor-0)"></i><i style="background:var(--calor-1)"></i><i style="background:var(--calor-2)"></i><i style="background:var(--calor-3)"></i><i style="background:var(--calor-4)"></i> mais · itens + metade dos cards</div>';
}
const STATUS_CICLO = { nao: 'andamento', andamento: 'concluido', concluido: 'nao' };
const STATUS_ROT = { nao: 'Não iniciado', andamento: 'Em andamento', concluido: 'Concluído' };
function renderPlano() {
  const h = hojeISO(), ctx = contextoHoje();
  if (UI.faseAberta === null) UI.faseAberta = ctx.tipo === 'dia' ? ctx.dia.fase : ctx.tipo === 'folga' ? ctx.prox.fase : 'f5';
  let html = (D.cronograma.doc ? '<p class="pequeno"><a href="' + esc(D.cronograma.doc) + '" target="_blank" rel="noopener">Abrir o Plano de Estudos completo (doc) ↗</a></p>' : '') +
    '<div class="secao"><div class="secao-cab"><h2>Cronograma diário</h2><span class="mudo pequeno">' + DIAS.filter((d) => S.perfil.feitos[d.data]).length + ' de ' + DIAS.length + ' sessões feitas</span></div>';
  for (const f of D.cronograma.fases) {
    const dias = DIAS.filter((d) => d.fase === f.id), feitos = dias.filter((d) => S.perfil.feitos[d.data]).length, aberto = UI.faseAberta === f.id;
    html += '<div class="fase"><button class="fase-cab" data-acao="fase" data-fase="' + f.id + '" aria-expanded="' + aberto + '"><span class="t"><b>' + esc(f.titulo) + ': ' + esc(f.subtitulo) + '</b><span>' + esc(f.periodo) + '</span></span><span class="mono pequeno mudo">' + feitos + '/' + dias.length + '</span><span class="seta">›</span></button>';
    if (aberto) {
      html += '<div class="fase-corpo">';
      for (const s of f.semanas) {
        html += '<div class="semana-tit">' + esc(s.titulo) + ' · ' + esc(s.periodo) + '</div>';
        for (const d of s.dias) {
          html += '<div class="dia-linha' + (d.data === h ? ' hoje' : d.data < h ? ' passado' : '') + '"><div class="data-sel"><b>' + d.data.slice(8) + '</b><span>' + esc(fmtData(d.data, { weekday: 'short' }).replace('.', '')) + '</span></div>' +
            '<div class="dia-txt"><span>' + esc(d.atividade) + '</span><div class="dia-meta"><span class="selo mono">' + esc(d.duracao) + '</span><button class="btn pequeno" data-acao="iniciar-dia" data-dia="' + d.data + '">' + esc(d.modo === 'revisao' ? 'Revisar' : d.modo === 'simulado' ? 'Simulado' : 'Treinar') + '</button></div></div>' +
            '<div class="dia-check"><input type="checkbox" data-acao="dia-feito" data-dia="' + d.data + '"' + (S.perfil.feitos[d.data] ? ' checked' : '') + ' aria-label="Marcar ' + esc(d.data) + ' como feito"></div></div>';
        }
        if (s.nota) html += '<p class="pequeno mudo">' + esc(s.nota) + '</p>';
      }
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div><div class="cartao"><h2>Peso por disciplina</h2><div class="tabela-env"><table class="tabela"><thead><tr><th>Disciplina</th><th>Na nota</th><th>Prioridade</th></tr></thead><tbody>' + DISC.slice().sort((a, b) => (PONTOS_DISC[b.id] || 0) - (PONTOS_DISC[a.id] || 0)).map((d) => '<tr><td>' + esc(d.nome) + '</td><td class="num">' + (PONTOS_DISC[d.id] ? (Math.round((PONTOS_DISC[d.id] / PONTOS_PROVA) * 1000) / 10).toLocaleString('pt-BR') + '%' : '—') + '</td><td style="text-align:right"><span class="selo' + (d.peso === 'MÁXIMO' ? ' p1' : d.peso === 'ALTO' ? ' p2' : '') + '">' + esc(d.peso) + '</span></td></tr>').join('') + '</tbody></table></div><p class="pequeno mudo">Na nota: quanto a disciplina vale numa prova de ' + PONTOS_PROVA + ' pontos, em que cada item básico vale 1 e cada específico vale 2 (estimativa até sair o edital). Prioridade: ordem de estudo do guia do cargo. Português e inglês entram um pouco todo dia, nas questões intercaladas.</p></div>';
  html += '<div class="cartao"><div class="secao-cab"><h2>Status dos blocos</h2><span class="mudo pequeno">Toque no status para mudar</span></div><div class="tabela-env"><table class="tabela"><thead><tr><th>Bloco</th><th>Domínio</th><th>Status</th></tr></thead><tbody>';
  BLOCOS.slice().sort((a, b) => a.prioridade - b.prioridade).forEach((b) => {
    const st = S.perfil.status[b.id] || 'nao', dmn = dominioBloco(b.id);
    html += '<tr><td>' + esc(b.nome) + '<br><span class="pequeno mudo">' + esc(b.dispositivos) + '</span></td><td class="num">' + (dmn === null ? '—' : Math.round(dmn * 100) + '%') + '</td><td><button class="selo status-btn' + (st === 'concluido' ? ' ok' : st === 'andamento' ? ' p2' : '') + '" data-acao="status" data-bloco="' + b.id + '">' + STATUS_ROT[st] + '</button></td></tr>';
  });
  html += '</tbody></table></div></div>';
  html += '<div class="cartao"><h2>Textos que faltam</h2><p class="mudo">A lei seca já tem ' + Object.keys(LEIS).length + ' normas. Cada documento novo enviado ao Claude vira questões e cards conferidos contra a letra da norma ou contra o gabarito oficial.</p><ul>' + (D.faltam || []).map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
  return html;
}
function renderPesquisar() {
  const itens = Object.entries(S.pesquisa).map(([k, v]) => Object.assign({ k }, v));
  const pend = itens.filter((x) => !x.s), feitos = itens.filter((x) => x.s);
  const vis = (UI.filtroPesq === 'feitos' ? feitos : pend).sort((a, b) => (a.d < b.d ? 1 : -1));
  let html = '<div class="secao-cab"><h2>Para pesquisar</h2><span class="mudo pequeno">' + pend.length + ' pendentes · ' + feitos.length + ' entendidos</span></div>' +
    '<p class="mudo pequeno">Quando você erra, os termos da questão entram aqui sozinhos. Em Investigar, o painel faz as perguntas, você escreve a resposta e o Claude confere, corrige pela norma e devolve uma pergunta para ir mais fundo. Depois marque como entendido (+5 XP).</p>' +
    '<div class="chips"><button class="chip" data-acao="filtro-pesq" data-f="pendentes" aria-pressed="' + (UI.filtroPesq !== 'feitos') + '">Pendentes</button><button class="chip" data-acao="filtro-pesq" data-f="feitos" aria-pressed="' + (UI.filtroPesq === 'feitos') + '">Entendidos</button></div>';
  html += '<div class="lista-pesq">' + (vis.length ? vis.map((x) => {
    const g = GLOSS.find((t) => t.t === x.t);
    return '<div class="pesq-linha' + (x.s ? ' feito' : '') + '"><input type="checkbox" data-acao="pesq-feito" data-k="' + esc(x.k) + '"' + (x.s ? ' checked' : '') + ' aria-label="Marcar como entendido"><div class="tx"><b>' + esc(x.t) + '</b><small>' + esc(x.o || '') + ' · ' + esc(fmtData(x.d, { day: '2-digit', month: '2-digit' })) + '</small>' +
      (g ? '<button class="linkish pequeno" data-acao="termo" data-t="' + g.i + '">Ver definição</button>' : '') + '</div><button class="btn pequeno" data-acao="investigar" data-t="' + esc(x.t) + '" data-o="' + esc(x.o || '') + '">Investigar</button></div>';
  }).join('') : '<p class="vazio-msg">' + (UI.filtroPesq === 'feitos' ? 'Nada marcado como entendido ainda.' : 'Lista vazia. Os temas sugeridos abaixo e os termos das questões erradas aparecem aqui.') + '</p>') + '</div>';
  const ctx = contextoHoje();
  const doDia = new Set(blocosDoDia(ctx.tipo === 'dia' ? ctx.dia : ctx.tipo === 'folga' ? ctx.prox : null));
  html += '<div class="secao"><div class="secao-cab"><h2>Sugestões por bloco</h2></div><p class="mudo pequeno">Temas que costumam confundir em cada bloco. Os blocos do dia vêm abertos.</p>';
  BLOCOS.filter((b) => (b.pesquisar || []).length).sort((a, b) => (doDia.has(b.id) ? 0 : 1) - (doDia.has(a.id) ? 0 : 1) || a.prioridade - b.prioridade).forEach((b) => {
    const faltam = b.pesquisar.filter((t) => !S.pesquisa[chavePesq(t)]).length;
    html += '<details class="grupo-pesq"' + (doDia.has(b.id) ? ' open' : '') + '><summary><span>' + esc(b.nome) + '</span><span class="mono pequeno mudo">' + faltam + ' de ' + b.pesquisar.length + '</span></summary><div class="grupo-blocos">' + b.pesquisar.map((t) => {
      const na = !!S.pesquisa[chavePesq(t)];
      return '<div class="pesq-linha"><div class="tx"><b>' + esc(t) + '</b></div>' + (na ? '<span class="selo ok">Na lista</span>' : '<button class="btn pequeno" data-acao="add-pesq" data-t="' + esc(t) + '" data-o="' + esc(b.nome) + '">+ Lista</button>') + '<button class="btn pequeno" data-acao="investigar" data-t="' + esc(t) + '" data-o="' + esc(b.nome) + '">Investigar</button></div>';
    }).join('') + '</div></details>';
  });
  return html + '</div>';
}
function renderGlossario() {
  const q = semAcento(UI.buscaGloss.trim());
  const lista = GLOSS.filter((g) => !q || semAcento(g.t + ' ' + g.d).includes(q)).sort((a, b) => a.t.localeCompare(b.t, 'pt'));
  return '<div class="secao-cab"><h2>Glossário</h2><span class="mudo pequeno">' + GLOSS.length + ' termos</span></div>' +
    '<input class="busca" id="busca-gloss" type="search" placeholder="Buscar termo" value="' + esc(UI.buscaGloss) + '" aria-label="Buscar no glossário">' +
    '<p class="mudo pequeno">Os termos sublinhados com pontos nas questões e nos cards abrem estas definições. Os marcados como termo jurídico aparecem explicados embaixo de cada artigo da lei seca.</p>' +
    lista.map((g) => '<div class="gloss-item"><b>' + esc(g.t) + '</b>' + (g.j ? ' <span class="selo">termo jurídico</span>' : '') + '<p>' + esc(g.d) + '</p><div class="linha-btns"><button class="linkish pequeno" data-acao="investigar" data-t="' + esc(g.t) + '" data-o="glossário">Investigar</button>' +
      (S.pesquisa[chavePesq(g.t)] ? '<span class="selo ok">Na lista</span>' : '<button class="linkish pequeno" data-acao="add-pesq" data-t="' + esc(g.t) + '" data-o="glossário">Guardar na lista</button>') + '</div></div>').join('');
}
// Fontes citadas por itens que ainda não têm o texto no app, contadas no próprio banco
function fontesSemTexto() {
  const nomes = [[/^STF/, 'decisões do STF'], [/^TJUE/, 'decisões do TJUE'], [/E-Ciber/, 'a E-Ciber'], [/Manual de Redação/, 'o Manual de Redação da Presidência'], [/13\.303/, 'a Lei 13.303/2016']];
  const vistos = [];
  for (const q of Q) {
    if (q.v !== 0) continue;
    const x = nomes.find(([re]) => re.test(q.r || ''));
    const nome = x ? x[1] : String(q.r || '').split(' · ')[0];
    if (nome && !vistos.includes(nome)) vistos.push(nome);
  }
  return vistos.length > 1 ? vistos.slice(0, -1).join(', ') + ' e ' + vistos[vistos.length - 1] : vistos.join('');
}
function renderMetodo() {
  return '<div class="prosa"><h2>O método do Painel</h2>' +
    '<p>O plano segue a ordem em que cada matéria faz sentido para quem começa do zero: na LGPD, primeiro o que a lei protege e as palavras que ela usa, depois quando se pode tratar dados, os direitos, os casos especiais e, por fim, quem fiscaliza e pune. Até fevereiro, quase todo dia de semana é um subtema novo de uma trilha; depois, o plano passa a ciclos de revisão e simulados.</p>' +
    '<h3>Dia de matéria nova (aba Hoje)</h3><ol>' +
    '<li><b>Revisar o que venceu.</b> A lista curta de questões e os cards vencidos. É o que mais rende por minuto: você reforça o que estava a ponto de esquecer.</li>' +
    '<li><b>Pré-teste.</b> Oito itens do subtema antes de estudar. Errar aqui é esperado: o erro mostra o que procurar na lei e na aula, e a explicação gruda mais depois dele.</li>' +
    '<li><b>Lei seca do dia.</b> Os artigos do subtema, um por vez, com os grifos. Antes deles, as palavras difíceis vêm explicadas e um guia mostra como ler um artigo (caput, parágrafo, inciso, exceção). Não precisa entender tudo: a aula vem a seguir.</li>' +
    '<li><b>Aula do dia.</b> Explica o que você leu, com mapa mental, tabelas e exemplos. As citações de artigo (“art. 3º”) abrem o texto ali mesmo.</li>' +
    '<li><b>Questões do dia.</b> Os itens do mesmo subtema, do mais fácil ao mais difícil. Marque “Estou em dúvida” sempre que não tiver certeza: isso mede o seu chute.</li>' +
    '<li><b>Intercaladas, cards e pesquisa.</b> Matérias básicas e blocos já estudados, misturados; as lacunas da letra da lei; e um tema da sua lista Para pesquisar, em que você explica com suas palavras e o Claude confere.</li></ol>' +
    '<h3>Dias de revisão, bloco longo e simulado</h3><p>Sexta é revisão da lista curta. Sábado é bloco longo (um subtema, uma língua e, quase sempre, uma discursiva) ou simulado. Nesses dias, e quando a matéria já foi vista, a ordem é questão primeiro e lei onde você errou: a questão mostra o que a banca troca, e a lei lida logo depois do erro fixa a palavra exata.</p>' +
    '<h3>Regras que não se negociam</h3><ul>' +
    '<li>O erro entra na lista curta e volta com intervalos crescentes (no mesmo dia, depois de 1 dia, depois de 3 dias): sai da lista depois de três acertos seguidos, e errou de novo, recomeça. Cada revisão traz só o que venceu: o que você já reviu hoje espera o próximo intervalo.</li>' +
    '<li>Interpretação de texto (português e inglês) não volta na revisão: reler o mesmo texto ensina o gabarito, não a leitura. No lugar, as sessões trazem textos inéditos.</li>' +
    '<li>Perdeu um dia? A matéria dele não some. Os blocos dos dias sem sessão vão para “Atraso do plano”, e o roteiro ganha o passo “Recuperar o atraso”, começando pelo dia mais antigo. A recuperação fecha um dia por vez, com os itens que faltam em cada matéria dele. O dia também sai sozinho quando cada matéria dele recebe, por qualquer caminho, ao menos metade da sua parte dos itens previstos (mínimo 3), ou quando você o dispensa. Dia de revisão perdido não vira atraso: o que venceu continua na lista curta.</li>' +
    '<li>O acerto também volta, para confirmar que não foi sorte: o acerto de primeira volta em cerca de 16 dias, e cada confirmação seguinte espaça mais (cerca de 35 dias). Os intervalos se adaptam: o item que você já errou ou acertou com dúvida volta antes, e a sua retenção real nas revisões calibra todos os prazos para mirar 90% de lembrança (Mais → Progresso). Esses acertos antigos entram na revisão do dia, no máximo ' + MANUTENCAO_DIA + ' por dia, os mais atrasados primeiro, e ocupam até um quarto das sessões de questões.</li>' +
    '<li>Intercale. Todo dia há uma sessão que mistura as matérias básicas com os blocos já estudados. Assunto novo entra em bloco; o que você já viu volta misturado, porque misturar obriga a reconhecer o tipo de questão e fixa mais (prática intercalada, somada à revisão espaçada e à recuperação ativa).</li>' +
    '<li>Revisão vem antes de questão nova. Quando a lista curta vencida passa de ' + REVISOES_DIA_PESADO + ' itens, a sessão de questões novas do dia encolhe sozinha.</li>' +
    '<li>Errou, leia o artigo inteiro. O botão “Ler inteiro, grifado” aparece depois de cada questão e de cada card. A leitura do dia tem no máximo ' + LEITURA_MAX + ' artigos: quando os blocos do dia têm mais, o app escolhe os ligados à sua lista curta, os ainda não lidos e os mais cobrados.</li>' +
    '<li>Domingo é livre por padrão e não quebra a sequência. Cada semana tem ainda uma folga: um dia sem estudo, de segunda a sábado, não zera os dias seguidos.</li>' +
    '<li>Não pule a revisão para fazer questões novas: a lista curta cresce e o esquecimento come o que você estudou.</li></ul>' +
    '<h3>Estratégia Cebraspe</h3><ul>' +
    '<li>Uma errada anula uma certa; em branco vale zero. Chutar só compensa quando sua chance de acerto passa de 50%.</li>' +
    '<li>A aba Progresso mostra a sua taxa de acerto quando marca dúvida. Acima de 50%, chute; abaixo, deixe em branco.</li>' +
    '<li>Desconfie de palavras absolutas (sempre, nunca, somente, exclusivamente) e de itens que acrescentam algo à lei.</li>' +
    '<li>Até terminar a primeira volta, os simulados curtos do plano medem só o que já foi estudado; o primeiro simulado completo, em dezembro, é um diagnóstico. Depois, o plano traz um simulado completo a cada duas semanas.</li>' +
    '<li>Discursiva toda semana, no sábado longo: escreva sem consulta, no tempo e no limite de linhas, e corrija pelos quesitos. Na Anatel 2024 ela valia 30 pontos e eliminava quem fizesse menos de 15.</li></ul>' +
    '<h3>Semana típica</h3><p>Segunda a quarta: um subtema por dia da matéria principal da fase (LGPD até novembro, depois ECA Digital, segurança da informação e, em janeiro, direito constitucional, economia e gestão). Quinta: direito administrativo ou regulação, também do zero. Sexta: revisão da lista curta. Sábado: bloco longo ou simulado. Domingo: livre.</p>' +
    '<h3>Quando o edital sair</h3><p>O cronograma genérico para. O conteúdo programático oficial passa a mandar, os simulados ficam maiores e a revisão espaçada continua todos os dias. Cole o edital na conversa com o Claude para reorganizar os blocos.</p>' +
    '<h3>Questões marcadas para conferir</h3><p>' + pl(Q.filter((q) => q.v === 0).length, 'item cita', 'itens citam') + ' fontes ainda não coladas no app: ' + fontesSemTexto() + '. Eles mostram o aviso “confira na fonte” e só viram definitivos quando o texto oficial for anexado e cada trecho for conferido. Nos itens reais com gabarito oficial, o que falta conferir é a referência do comentário; nos avulsos, o próprio gabarito foi conferido na lei, e a linha da prova avisa.</p>' +
    '<h3>Como a banca cobra</h3><p>A página Como o Cebraspe cobra, aqui em Mais, mostra o formato da prova, o padrão de cada disciplina com itens reais e o que pontua na discursiva.</p></div>';
}
/* ================= Contestação de itens ================= */
// Cada contestação fica neste navegador e numa coleção compartilhada do banco do app, onde o Claude lê,
// corrige o item na rodada seguinte e devolve status e resposta.
const CHAVE_CONTEST = 'painel-anpd-contestacoes';
const MOTIVOS_CONTEST = [['gabarito', 'O gabarito está errado'], ['comentario', 'O comentário ou o trecho está errado'], ['desatualizado', 'A norma mudou ou foi revogada'], ['ambiguo', 'O enunciado é ambíguo'], ['outro', 'Outro motivo']];
const STATUS_CONTEST = { aberta: 'aberta', pendente: 'aguardando envio', procedente: 'procedente, item corrigido', improcedente: 'improcedente', anulado: 'item retirado do banco' };
const CONTEST = lerLS(CHAVE_CONTEST) || [];
function gravarContest() { gravarLS(CHAVE_CONTEST, CONTEST); }
// Respostas que vêm com o banco: valem para a contestação daquele item feita até a data da resposta, mesmo que ela
// nunca tenha chegado à conta (status "aguardando envio")
function aplicarRespostasDoBanco() {
  let mudou = false;
  for (const c of CONTEST) {
    const r = (D.respostasContest || {})[c.q];
    if (!r || (c.status !== 'aberta' && c.status !== 'pendente') || String(c.data).slice(0, 10) > r.data) continue;
    c.status = r.status; c.resposta = r.resposta; mudou = true;
  }
  if (mudou) gravarContest();
}
aplicarRespostasDoBanco();
// Contestações que vêm num backup: entram as que este navegador ainda não tem
function juntarContestacoes(lista) {
  let n = 0;
  for (const c of Array.isArray(lista) ? lista : []) if (c && c.q && !CONTEST.some((x) => x.q === c.q && x.data === c.data)) { CONTEST.push(c); n++; }
  if (n) { gravarContest(); aplicarRespostasDoBanco(); }
}
function folhaContestar(id) {
  const q = QI.get(id), ct = CONTEST.find((x) => x.q === id);
  let html = cabFolha('Contestar item', id) + (q ? '<p class="enunciado">' + esc(q.e) + '</p><p class="pequeno mudo">Gabarito ' + nomeGab(q) + ' · ' + esc(q.r) + '</p>' : '<p class="mudo">Este item não está mais no banco.</p>');
  if (ct) {
    html += '<div class="cartao"><p><b>Status:</b> ' + esc(STATUS_CONTEST[ct.status] || ct.status) + ' · enviada em ' + esc(fmtData(ct.data.slice(0, 10), { day: '2-digit', month: '2-digit' })) + '</p><p><b>Motivo:</b> ' + esc((MOTIVOS_CONTEST.find((m) => m[0] === ct.motivo) || [0, ct.motivo])[1]) + '</p>' + (ct.texto ? '<p>' + esc(ct.texto) + '</p>' : '') + (ct.resposta ? '<p><b>Resposta:</b> ' + esc(ct.resposta) + '</p>' : '<p class="pequeno mudo">A resposta aparece aqui quando o item for revisto.</p>') + '</div>';
  } else if (q) {
    html += '<fieldset class="quesito"><legend><b>Motivo</b></legend>' + MOTIVOS_CONTEST.map(([v, t], i) => '<label class="conceito"><input type="radio" name="contest-motivo" value="' + v + '"' + (i ? '' : ' checked') + '><span>' + esc(t) + '</span></label>').join('') + '</fieldset>' +
      '<div class="campo"><label for="contest-texto">Explique (de preferência com o artigo ou a fonte)</label><textarea id="contest-texto" class="disc-area" rows="4" style="min-height:6rem"></textarea></div>' +
      '<div class="linha-btns"><button class="btn primario" data-acao="contestar-enviar" data-q="' + esc(id) + '">Enviar contestação</button></div>';
  }
  abrirFolha(html, 'Contestar ' + id);
}
async function enviarContestacao(rec) {
  if (!Store.db || !Store.uid) { rec.status = 'pendente'; return false; }
  try {
    const ref = await Store.db.collection('contestacoes').add({ q: rec.q, motivo: rec.motivo, texto: rec.texto, data: rec.data, versao: rec.versao, uid: Store.uid, status: 'aberta', resposta: '' });
    rec.id = ref.id; rec.status = 'aberta'; return true;
  } catch (e) { rec.status = 'pendente'; return false; }
}
// Ao abrir o app: envia as pendentes e traz status e respostas das já enviadas
async function enviarContestacoesPendentes() {
  if (!Store.db || !Store.uid) return;
  let mudou = false;
  for (const c of CONTEST) if (c.status === 'pendente') { await enviarContestacao(c); mudou = true; }
  try {
    const snap = await Store.db.collection('contestacoes').where('uid', '==', Store.uid).get();
    for (const d of snap.docs) {
      const x = d.data(), c = CONTEST.find((y) => y.id === d.id);
      if (c && (c.status !== x.status || c.resposta !== x.resposta)) { c.status = x.status; c.resposta = x.resposta || ''; mudou = true; }
    }
  } catch (e) { /* sem leitura: fica o que está no navegador */ }
  if (mudou) { gravarContest(); if (UI.vista === 'mais') renderMais(); }
}
function renderContestacoes() {
  const lista = CONTEST.slice().sort((a, b) => (a.data < b.data ? 1 : -1));
  return '<div class="secao-cab"><h2>Minhas contestações</h2><span class="mudo pequeno">' + lista.length + '</span></div>' +
    '<p class="mudo pequeno">Toda contestação é lida na rodada seguinte de revisão do banco. Procedente, o item é corrigido ou retirado; a resposta aparece aqui.</p>' +
    (lista.length ? '<div class="lista-rev">' + lista.map((c) => '<button data-acao="contestar" data-q="' + esc(c.q) + '"><span class="marca-res ' + (c.status === 'procedente' || c.status === 'anulado' ? 'C' : c.status === 'improcedente' ? 'E' : 'B') + '">' + (c.status === 'aberta' || c.status === 'pendente' ? '…' : c.status === 'improcedente' ? '✗' : '✓') + '</span><span class="txt"><b>' + esc(c.q) + '</b> · ' + esc(STATUS_CONTEST[c.status] || c.status) + (QI.get(c.q) ? ' · ' + esc(QI.get(c.q).e.slice(0, 90)) + '…' : '') + '</span></button>').join('') + '</div>' : '<p class="vazio-msg">Nenhuma contestação ainda. O botão “Contestar este item” fica logo abaixo do comentário de cada questão.</p>');
}

/* ================= Trilhas de estudo do zero ================= */
// Cada subtema reúne aula, pontos-chave, armadilhas e as questões marcadas com o mesmo tema.
// Domínio: respondeu ao menos 70% dos itens (mínimo de 10, ou todos se houver menos) e acerta hoje 80% ou mais deles.
const TRILHAS = (D.trilhas || []).filter((t) => t.subtemas && t.subtemas.length);
const SUBTEMAS = new Map(TRILHAS.flatMap((t) => t.subtemas.map((st) => [st.id, Object.assign({ trilha: t.id }, st)])));
const POR_TEMA = agrupar(Q.filter((q) => q.tm), (q) => q.tm);
function estadoSubtema(id) {
  const qs = POR_TEMA.get(id) || [];
  const resp = qs.filter((q) => { const r = rec(q.id); return r && r[0] >= 0; });
  const certos = resp.filter((q) => rec(q.id)[0] >= 1).length;
  // Domínio: 70% dos itens respondidos (de 10 a 25 itens) com 80% de acerto. O teto de 25 vale para os subtemas grandes
  // (processo administrativo e LAI têm mais de 100 itens), que senão travariam a trilha por semanas
  const n = qs.length, minimo = Math.min(n, Math.max(10, Math.min(25, Math.ceil(n * 0.7))));
  const acerto = resp.length ? certos / resp.length : 0;
  const status = !n ? 'vazio' : !resp.length ? 'novo' : resp.length >= minimo && acerto >= 0.8 ? 'dominado' : 'curso';
  return { n, resp: resp.length, certos, acerto, minimo, status, novos: qs.filter((q) => !rec(q.id)).length, erros: resp.length - certos };
}
const ROTULO_ST = { vazio: 'sem itens ainda', novo: 'não começado', curso: 'em curso', dominado: 'dominado' };
function proximoSubtema(trilhaId) {
  const t = TRILHAS.find((x) => x.id === trilhaId);
  if (!t) return null;
  return t.subtemas.find((st) => { const e = estadoSubtema(st.id); return e.n && e.status !== 'dominado'; }) || null;
}
// Blocos de cada trilha e de cada subtema: os das questões que entram nele
const BLOCOS_ST = new Map([...SUBTEMAS.keys()].map((id) => [id, new Set((POR_TEMA.get(id) || []).map((q) => q.b))]));
const BLOCOS_TR = new Map(TRILHAS.map((t) => [t.id, new Set(t.subtemas.flatMap((st) => [...BLOCOS_ST.get(st.id)]))]));
// Uma aula por dia: o próximo subtema da trilha que cobre a matéria do plano de hoje (o próprio subtema, se cobrir;
// senão, a trilha), olhando os blocos do dia na ordem do plano, em que a matéria principal vem primeiro. Sem matéria
// no plano, ou com ela já dominada, as trilhas se alternam dia a dia.
function subtemaDoDia() {
  const dia = DIAS.find((d) => d.data === hojeISO());
  if (dia && dia.st && SUBTEMAS.get(dia.st)) return SUBTEMAS.get(dia.st);
  const cands = TRILHAS.map((t) => proximoSubtema(t.id)).filter(Boolean).map((st) => SUBTEMAS.get(st.id));
  if (!cands.length) return null;
  const blocosHoje = (dia && dia.blocos) || [];
  const achar = (de) => blocosHoje.map((b) => cands.find((st) => de(st).has(b))).find(Boolean);
  const doPlano = achar((st) => BLOCOS_ST.get(st.id)) || achar((st) => BLOCOS_TR.get(st.trilha));
  if (doPlano) return doPlano;
  return cands[Math.floor(Date.parse(hojeISO() + 'T12:00:00Z') / 864e5) % cands.length];
}
function nomeTrilha(id) { const t = TRILHAS.find((x) => x.id === id); return t ? t.nome : ''; }
// Pré-teste: itens ainda não vistos primeiro; prática: não vistos, depois os errados, depois os vencidos. Os não vistos
// vêm do mais fácil ao mais difícil, para quem começa do zero subir aos poucos
function idsSubtema(id, tipo, n) {
  const qs = POR_TEMA.get(id) || [];
  if (tipo === 'erros') return embaralhar(qs.filter((q) => { const r = rec(q.id); return r && r[0] === 0; }).map((q) => q.id));
  const novos = embaralhar(qs.filter((q) => !rec(q.id))).sort((a, b) => a.d - b.d);
  const errados = embaralhar(qs.filter((q) => { const r = rec(q.id); return r && r[0] === 0; }));
  const resto = embaralhar(qs.filter((q) => { const r = rec(q.id); return r && r[0] > 0; })).sort((a, b) => rec(a.id)[1] - rec(b.id)[1]);
  const ordem = tipo === 'pre' ? novos.concat(errados) : novos.concat(errados, resto);
  return ordem.slice(0, n).map((q) => q.id);
}
function chipEstado(e) {
  return '<span class="selo st-' + e.status + '">' + esc(ROTULO_ST[e.status]) + '</span>';
}
// Aula estruturada (dados/trilhas.json, campo licao): ideia central, mapa mental e partes com tabela, lista, passos e caixas
const CAIXAS_AULA = [['mnemo', 'Para lembrar'], ['ex', 'Exemplo'], ['atencao', 'Atenção'], ['porque', 'Por que é assim']];
function htmlMapa(m) {
  return '<figure class="mapa"><figcaption class="rotulo">Mapa mental</figcaption><div class="mapa-centro">' + grifarProsa(m.centro) + '</div><ul class="mapa-ramos">' +
    m.ramos.map((r, i) => '<li class="ramo ramo-' + (i + 1) + '"><span class="ramo-t"><span>' + grifarProsa(r.t) + '</span></span>' +
      (r.f.length ? '<ul class="folhas">' + r.f.map((f) => '<li>' + grifarProsa(f) + '</li>').join('') + '</ul>' : '') + '</li>').join('') + '</ul></figure>';
}
function htmlTabelaAula(t, refs) {
  // No celular a tabela vira fichas: cada célula leva o nome da coluna (data-c), lido pelo CSS
  const cab = t.cab.map((c) => String(c).replace(/\*\*/g, ''));
  return '<div class="tabela-env"><table class="tab-aula' + (cab.length > 2 ? ' fichas' : '') + '"><thead><tr>' + t.cab.map((c) => '<th scope="col">' + grifarProsa(c) + '</th>').join('') + '</tr></thead><tbody>' +
    t.linhas.map((l) => '<tr>' + l.map((c, j) => j ? '<td data-c="' + esc(cab[j]) + '">' + grifarProsa(c, refs) + '</td>' : '<th scope="row">' + grifarProsa(c, refs) + '</th>').join('') + '</tr>').join('') + '</tbody></table></div>';
}
// Referências da aula: os artigos do subtema pelo número, e a norma única dele (se houver uma só)
function refsDaAula(st) {
  const arts = (st.arts || []).filter((k) => ARTI.has(k)), leis = [...new Set(arts.map((k) => ARTI.get(k).lei))], porNum = new Map();
  for (const k of arts) { const n = ARTI.get(k).id; porNum.set(n, porNum.has(n) ? null : k); }
  return { mapa: new Map([...porNum].filter(([, k]) => k)), lei: leis.length === 1 ? leis[0] : null };
}
function caixaRefs(base) { const box = 'art-' + (++nCaixaArt); return [Object.assign({}, base, { box }), '<div class="art-inline" id="' + box + '" hidden></div>']; }
function htmlParteAula(p, i, base) {
  const [refs, caixa] = caixaRefs(base);
  let h = '<section class="parte"><h3><span class="parte-n">' + (i + 1) + '</span><span>' + grifarProsa(p.t) + '</span></h3>';
  if (p.texto) h += '<p>' + grifarProsa(p.texto, refs) + '</p>';
  if (p.lista) h += '<ul class="lista-chave">' + p.lista.map((x) => '<li>' + grifarProsa(x, refs) + '</li>').join('') + '</ul>';
  if (p.passos) h += '<ol class="passos">' + p.passos.map((x) => '<li>' + grifarProsa(x, refs) + '</li>').join('') + '</ol>';
  if (p.tabela) h += htmlTabelaAula(p.tabela, refs);
  if (p.depois) h += '<p>' + grifarProsa(p.depois, refs) + '</p>';
  for (const [k, rot] of CAIXAS_AULA) if (p[k]) h += '<div class="caixa cx-' + k + '"><span class="rotulo">' + rot + '</span><p>' + grifarProsa(p[k], refs) + '</p></div>';
  return h + caixa + '</section>';
}
function htmlAula(st) {
  const li = st.licao, base = refsDaAula(st);
  if (!li) { const [refs, caixa] = caixaRefs(base); return '<div class="texto-aula">' + st.aula.map((p) => '<p>' + grifarProsa(p, refs) + '</p>').join('') + caixa + '</div>'; }
  const [refs, caixa] = caixaRefs(base);
  return '<div class="texto-aula licao"><div class="ideia"><span class="rotulo">Ideia central</span><p>' + grifarProsa(li.ideia, refs) + '</p>' + caixa + '</div>' +
    htmlMapa(li.mapa) + li.partes.map((p, i) => htmlParteAula(p, i, base)).join('') + '</div>';
}
// Palavras desta aula: os termos do glossário que aparecem nos artigos e na aula do subtema, na ordem em que surgem.
// Vêm primeiro as que os subtemas anteriores da mesma trilha ainda não mostraram (no máximo seis), para a caixa não
// repetir sempre os mesmos termos básicos
const PALAVRAS_ST = new Map();
function termosDoSubtema(st) {
  const li = st.licao || {};
  const partes = (li.partes || []).flatMap((p) => [p.t, p.texto, p.depois].concat(p.lista || [], p.passos || [], p.tabela ? p.tabela.linhas.flat() : [], CAIXAS_AULA.map(([k]) => p[k])));
  const texto = (st.arts || []).filter((k) => ARTI.has(k)).map((k) => ARTI.get(k).texto).concat(li.ideia || '', partes, st.aula || [], st.chave || []).filter(Boolean).join('\n').replace(/\*\*/g, '');
  return GLOSS.filter((g) => !g.j).map((g) => ({ g, i: texto.search(g.re) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i).map((x) => x.g);
}
function palavrasDoSubtema(st) {
  if (PALAVRAS_ST.has(st.id)) return PALAVRAS_ST.get(st.id);
  const t = TRILHAS.find((x) => x.id === st.trilha), vistas = new Set();
  for (const ant of t ? t.subtemas : []) { if (ant.id === st.id) break; for (const g of palavrasDoSubtema(SUBTEMAS.get(ant.id))) vistas.add(g.t); }
  const todas = termosDoSubtema(st), novas = todas.filter((g) => !vistas.has(g.t));
  const out = (novas.length >= 3 ? novas : novas.concat(todas.filter((g) => vistas.has(g.t)))).slice(0, 6);
  PALAVRAS_ST.set(st.id, out);
  return out;
}
function htmlPalavras(st) {
  const ps = palavrasDoSubtema(st);
  return ps.length ? '<details class="palavras" open><summary>Antes de ler: ' + pl(ps.length, 'palavra que aparece aqui', 'palavras que aparecem aqui') + '</summary><dl>' + ps.map((g) => '<dt>' + esc(g.t) + '</dt><dd>' + esc(g.d) + '</dd>').join('') + '</dl></details>' : '';
}
// Para quem nunca leu lei: como se lê um artigo (aberto até 15 artigos lidos)
function htmlComoLer() {
  const novato = Object.keys(S.perfil.lidos || {}).length < 15;
  return '<details class="como-ler"' + (novato ? ' open' : '') + '><summary>Primeira vez lendo lei? Como ler um artigo</summary><ul class="lista-chave">' +
    '<li><b>Art.</b> é a unidade da lei. O texto logo depois do número é o <b>caput</b>: a regra principal.</li>' +
    '<li><b>§</b> (parágrafo) completa o caput ou abre uma exceção; quando é um só, vem como “Parágrafo único”.</li>' +
    '<li><b>Incisos</b> (I, II, III…) são os itens de uma lista; <b>alíneas</b> (a, b, c…) dividem um inciso.</li>' +
    '<li><span class="g-alerta">salvo</span>, <span class="g-alerta">exceto</span>, <span class="g-alerta">desde que</span> e <span class="g-alerta">somente</span> mudam a regra: é ali que a banca mexe.</li>' +
    '<li><span class="g-verbo">deve</span> obriga; <span class="g-verbo">pode</span> permite. Trocar um pelo outro é a pegadinha mais comum.</li>' +
    '<li>Prazos e números (<span class="g-num">15 (quinze) dias</span>) importam com a unidade: dias, dias úteis, meses.</li>' +
    '<li>“(Redação dada pela Lei…)” avisa que o texto mudou; “(VETADO)” e “(Revogado)” não valem, e o texto revogado nem aparece.</li>' +
    '<li>Quando o artigo cita outro da mesma lei (“nas hipóteses do <span class="ref-art">art. 16</span> desta Lei”), toque na citação: o artigo citado abre logo abaixo.</li>' +
    '<li>Antes do texto de cada artigo vem o mesmo artigo em português claro: leia primeiro, depois a letra da lei, que é o que a banca cobra. Embaixo, os termos técnicos dele (“de ofício”, “ônus da prova”…) explicados.</li>' +
    '<li>Leia o artigo inteiro antes de concluir: a exceção costuma estar no parágrafo seguinte.</li></ul></details>';
}
// O subtema contado como se conta a alguém que nunca leu a lei: vem antes da lei seca e da aula
function htmlSimples(st) {
  return st.simples ? '<div class="simples"><span class="rotulo">Em palavras simples</span><p>' + grifarProsa(st.simples) + '</p></div>' : '';
}
function folhaAula(id) {
  const st = SUBTEMAS.get(id);
  if (!st) return;
  const html = cabFolha('Aula', st.nome) + htmlSimples(st) + legendaCamadas(true) + htmlAula(st) +
    '<h3>Pontos-chave</h3><ul class="lista-chave">' + st.chave.map((c) => '<li>' + grifarProsa(c) + '</li>').join('') + '</ul>' +
    '<h3>Armadilhas</h3><ul class="lista-chave armadilhas">' + st.armadilhas.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul>';
  abrirFolha(html, 'Aula: ' + st.nome);
  UI.folhaAula = id;
}
function renderTrilhas() {
  if (UI.subtema && SUBTEMAS.get(UI.subtema)) return renderSubtema(UI.subtema);
  let html = '<div class="secao-cab"><h2>Trilhas do zero</h2></div>' +
    '<p class="mudo">Para quem está começando a matéria. Em cada subtema: faça o pré-teste, mesmo sem saber (errar antes de estudar faz a explicação grudar mais), leia os artigos da lei com as palavras difíceis explicadas, depois a aula, que explica o que você leu, e pratique até dominar.</p>';
  if (TRILHAS.length > 2) html += '<div class="chips cb-nav">' + TRILHAS.map((t) => '<button class="chip" data-acao="rolar" data-alvo="tr-' + esc(t.id) + '">' + esc(t.nome.replace(/ do zero$/, '')) + '</button>').join('') + '</div>';
  for (const t of TRILHAS) {
    const est = t.subtemas.map((st) => estadoSubtema(st.id));
    const dom = est.filter((e) => e.status === 'dominado').length;
    html += '<div class="cartao trilha" id="tr-' + esc(t.id) + '"><div class="secao-cab"><h2>' + esc(t.nome) + '</h2><span class="mudo pequeno">' + dom + ' de ' + t.subtemas.length + ' dominados</span></div>' +
      '<p class="pequeno mudo">' + esc(t.resumo) + '</p><ol class="lista-st">' +
      t.subtemas.map((st, i) => {
        const e = est[i];
        return '<li><button data-acao="subtema" data-st="' + esc(st.id) + '"><span class="txt"><b>' + esc(st.nome) + '</b><span class="pequeno mudo">' + pl(e.n, 'questão', 'questões') + (e.resp ? ' · respondidas ' + e.resp + ' · acerto atual ' + Math.round(e.acerto * 100) + '%' : '') + '</span></span>' + chipEstado(e) + '</button></li>';
      }).join('') + '</ol></div>';
  }
  return html;
}
function passosDoSubtema(st, e) {
  const out = [], arts = artsDoSubtema(st);
  if (e.novos) out.push({ rot: 'Pré-teste · ' + Math.min(8, e.novos) + ' itens', attrs: 'data-acao="trilha-sessao" data-st="' + esc(st.id) + '" data-tipo="pre"', primario: !e.resp });
  if (arts.length) out.push({ rot: 'Lei seca', attrs: 'data-acao="st-lei" data-st="' + esc(st.id) + '"' });
  out.push({ rot: 'Aula', attrs: 'data-acao="st-aula" data-st="' + esc(st.id) + '"' });
  if (e.n) out.push({ rot: 'Praticar · ' + Math.min(20, e.n) + ' itens', attrs: 'data-acao="trilha-sessao" data-st="' + esc(st.id) + '" data-tipo="pratica"', primario: !!e.resp });
  return out;
}
function renderSubtema(id) {
  const st = SUBTEMAS.get(id), e = estadoSubtema(id);
  const t = TRILHAS.find((x) => x.id === st.trilha);
  const pos = t.subtemas.findIndex((x) => x.id === id);
  const prox = t.subtemas[pos + 1];
  let html = '<button class="btn pequeno voltar" data-acao="subtema" data-st="">← Trilhas</button>' +
    '<div class="cartao destaque"><span class="rotulo">Subtema ' + (pos + 1) + ' de ' + t.subtemas.length + '</span><h2 class="titulo-st">' + esc(st.nome) + '</h2><p>' + esc(st.resumo) + '</p>' + htmlSimples(st) +
    '<div class="linha-st">' + chipEstado(e) + '<span class="pequeno mudo">' + pl(e.n, 'questão', 'questões') + ' · ' + e.resp + ' respondidas · ' + (e.resp ? 'acerto atual ' + Math.round(e.acerto * 100) + '%' : 'nenhuma respondida') + ' · domínio pede ' + e.minimo + ' respondidas com 80% de acerto</span></div>' +
    '<div class="linha-btns">' + passosDoSubtema(st, e).map((x, i, a) => '<button class="btn' + (x.primario ? ' primario' : '') + '" ' + x.attrs + '>' + (a.length > 1 ? (i + 1) + '. ' : '') + x.rot + '</button>').join('') +
    (e.erros ? '<button class="btn" data-acao="trilha-sessao" data-st="' + esc(id) + '" data-tipo="erros">Refazer erros · ' + e.erros + '</button>' : '') +
    '</div></div>';
  const arts = artsDoSubtema(st).filter((k) => ARTI.get(k));
  if (arts.length) {
    const caixa = 'art-st-' + id.replace(/[^\w-]/g, '');
    html += '<div class="cartao" id="lei-' + esc(id) + '"><h2>Lei seca deste subtema</h2><p class="pequeno mudo">Leia antes da aula, um artigo por vez: o texto abre aqui embaixo, com os grifos. Não precisa entender tudo agora; a aula explica o que ficar difícil.</p>' +
      htmlPalavras(st) + htmlComoLer() + '<div class="chips">' +
      arts.map((k) => '<button class="chip" data-acao="art-inline" data-art="' + esc(k) + '" data-box="' + caixa + '" aria-expanded="false" aria-controls="' + caixa + '">' + esc(nomeArt(k)) + '</button>').join('') + '</div>' +
      '<div class="art-inline" id="' + caixa + '" data-lista="' + esc(arts.join(',')) + '" hidden></div></div>';
  }
  html += '<div class="cartao aula" id="aula-' + esc(id) + '"><h2>Aula</h2>' + (arts.length ? '' : htmlPalavras(st)) + legendaCamadas(true) +
    (arts.length ? '<p class="pequeno mudo">Toque numa citação sublinhada (“art. 3º”) para ler o artigo ali mesmo.</p>' : '') + htmlAula(st) +
    (e.n ? '<div class="linha-btns fim-aula"><button class="btn primario" data-acao="trilha-sessao" data-st="' + esc(id) + '" data-tipo="pratica">Fixar com questões · ' + Math.min(20, e.n) + ' itens</button></div>' : '') + '</div>';
  html += '<div class="cartao"><h2>Pontos-chave</h2><ul class="lista-chave">' + st.chave.map((c) => '<li>' + grifarProsa(c) + '</li>').join('') + '</ul></div>';
  html += '<div class="cartao"><h2>Como o Cebraspe tenta te derrubar</h2><ul class="lista-chave armadilhas">' + st.armadilhas.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul></div>';
  const reais = (POR_TEMA.get(id) || []).filter((q) => q.o).length;
  if (reais) html += '<p class="pequeno mudo">' + pl(reais, 'item real', 'itens reais') + ' do Cebraspe neste subtema, misturados aos demais.</p>';
  if (prox) html += '<div class="linha-btns"><button class="btn" data-acao="subtema" data-st="' + esc(prox.id) + '">Próximo: ' + esc(prox.nome) + ' ›</button></div>';
  return html;
}

/* ================= Discursiva ================= */
function linhasEstimadas(texto) {
  return String(texto || '').split('\n').reduce((n, p) => n + (p.trim() ? Math.ceil(p.length / CARACTERES_LINHA) : 0), 0);
}
function estadoDisc(id) { return (S.disc[id] ||= { rascunho: '', tentativas: [] }); }
function contadorDisc(t) {
  const txt = estadoDisc(t.id).rascunho, l = linhasEstimadas(txt), palavras = (txt.match(/\S+/g) || []).length;
  return 'Linhas estimadas: <b>' + l + '</b> de ' + t.linhas + ' · ' + pl(palavras, 'palavra', 'palavras') +
    (l > t.linhas ? ' · <span class="no">passou do limite: o que exceder é desconsiderado na correção</span>' : l && l < Math.ceil(t.linhas * 0.7) ? ' · texto curto: o desconto por erro pesa mais' : '');
}
function notaDisc(t) {
  const aval = UI.discAval || {};
  const somaMax = t.quesitos.reduce((n, q) => n + q.max, 0);
  const soma = t.quesitos.reduce((n, q, i) => n + (aval[i] || 0), 0);
  const nc = (soma / somaMax) * t.pontos;
  const tl = Math.max(1, Math.min(t.linhas, linhasEstimadas(estadoDisc(t.id).rascunho)));
  const ne = Math.max(0, Number(UI.discNE) || 0);
  const desc = (t.fatorErro * ne) / tl;
  return { nc, desc, nq: Math.max(0, nc - desc), tl, ne, completo: t.quesitos.every((q, i) => aval[i] != null) };
}
function resultadoDisc(t) {
  const r = notaDisc(t);
  const f = (x) => x.toFixed(2).replace('.', ',');
  return '<b>Nota estimada: ' + f(r.nq) + ' de ' + t.pontos + '</b><span>Conteúdo ' + f(r.nc) + ' − desconto de português ' + f(r.desc) + ' (' + t.fatorErro + ' × ' + r.ne + ' erros ÷ ' + r.tl + ' linhas)' + (r.completo ? '' : ' · marque um conceito em cada quesito') + '</span>';
}
// Cadência da discursiva no plano: quantas já deviam ter sido feitas, quantas foram e qual vem a seguir
function cartaoDiscPlano() {
  if (!DIAS_DISC.length) return '';
  const h = hojeISO(), ini = inicioAtraso(), disp = S.perfil.dispensados || {};
  const devidas = DIAS_DISC.filter((d) => d.data <= h && d.data >= ini && !disp[d.data]);
  const feitas = devidas.filter(discFeita).length, prox = DIAS_DISC.find((d) => d.data >= h && !discFeita(d) && !disp[d.data]);
  // as adiantadas já têm baixa e não contam como próximas
  const restam = DIAS_DISC.filter((d) => d.data > h && !discFeita(d) && !disp[d.data]).length;
  return '<div class="cartao"><div class="secao-cab"><h2>Discursiva no plano</h2><span class="mono pequeno mudo">' + feitas + ' de ' + devidas.length + '</span></div>' +
    '<p>Uma por semana; duas por semana nas seis últimas antes da prova. ' + (devidas.length ? (feitas >= devidas.length ? 'Você está em dia.' : pl(devidas.length - feitas, 'discursiva atrasada', 'discursivas atrasadas') + ': cada correção salva dá baixa numa delas, da mais antiga para a mais nova.') : '') + '</p>' +
    (prox ? '<p class="pequeno">Próxima: <b>' + esc(fmtData(prox.data, { weekday: 'short', day: '2-digit', month: '2-digit' })) + '</b>, ' + esc((temaDisc(prox) || { titulo: prox.disc }).titulo) + '. Depois dela, mais ' + Math.max(0, restam - (prox.data > h ? 1 : 0)) + ' até a prova.</p><div class="linha-btns">' + botaoDiscDia(prox, true) + '</div>' : '') + '</div>';
}
function renderDiscursiva() {
  const t = TEMAS_DISC.find((x) => x.id === UI.discTema);
  if (!t) {
    UI.discTema = null;
    return '<div class="prosa"><h2>Treino de discursiva</h2><p>' + esc((D.discursivas || {}).fonte || '') + '</p><p>Escreva como na prova: sem consulta, no tempo sugerido e dentro do limite de linhas. Depois corrija pelos quesitos com honestidade. O conceito máximo exige explicar, não só citar.</p></div>' + cartaoDiscPlano() +
      TEMAS_DISC.map((x) => {
        const tent = estadoDisc(x.id).tentativas, ult = tent[0];
        return '<div class="cartao disc-tema"><div class="secao-cab"><h2>' + esc(x.titulo) + '</h2><span class="selo mono">' + x.linhas + ' linhas · ' + x.pontos + ' pts</span></div>' +
          '<p class="pequeno mudo">Tempo sugerido: ' + x.minutos + ' min · ' + (ult ? 'última nota ' + ult.nq.toFixed(2).replace('.', ',') + ' de ' + x.pontos + ' em ' + esc(fmtData(ult.d, { day: '2-digit', month: '2-digit' })) + ' · ' + pl(tent.length, 'tentativa', 'tentativas') : 'ainda não feito') + '</p>' +
          '<div class="linha-btns"><button class="btn primario" data-acao="disc-abrir" data-t="' + esc(x.id) + '">' + (estadoDisc(x.id).rascunho ? 'Continuar' : 'Escrever') + '</button></div></div>';
      }).join('');
  }
  const st = estadoDisc(t.id), corrigindo = UI.discFase === 'correcao';
  let html = '<button class="btn pequeno voltar" data-acao="disc-voltar">← Temas</button>' +
    '<div class="cartao"><span class="rotulo">Discursiva · até ' + t.linhas + ' linhas · ' + t.pontos + ' pontos · tempo sugerido ' + t.minutos + ' min</span><h2>' + esc(t.titulo) + '</h2>' +
    '<p>' + esc(t.comando) + '</p><ol class="lista-cb">' + t.aspectos.map((a) => '<li>' + esc(a) + '</li>').join('') + '</ol></div>' +
    '<label class="rotulo" for="disc-texto">Seu texto</label><textarea id="disc-texto" class="disc-area" rows="16" spellcheck="false"' + (corrigindo ? ' readonly' : '') + ' placeholder="Escreva aqui, em parágrafos, um para cada aspecto do comando.">' + esc(st.rascunho) + '</textarea>' +
    '<p class="pequeno mudo" id="disc-cont">' + contadorDisc(t) + '</p>';
  if (!corrigindo) {
    html += '<div class="linha-btns"><button class="btn primario" data-acao="disc-corrigir">Terminei: corrigir pelos quesitos</button><button class="btn" data-acao="disc-limpar">Apagar e recomeçar</button></div>';
    return html;
  }
  const aval = UI.discAval || {};
  const ia = UI.discIA;
  if (iaPronta() || ia) html += '<div class="cartao"><h2>Correção pelo Claude</h2><p class="pequeno mudo">O Claude lê o seu texto com os quesitos, o padrão de resposta e a escala de conceitos, e sugere o conceito de cada quesito e os erros de português. A decisão é sua: ajuste o que discordar antes de salvar.</p>' +
    (ia ? (ia.geral ? '<p>' + esc(ia.geral) + '</p>' : '') + (ia.exemplos.length ? '<details><summary>Erros de português apontados</summary><ul class="lista-cb">' + ia.exemplos.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></details>' : '') : '') +
    (iaPronta() ? '<div class="linha-btns"><button class="btn' + (ia ? '' : ' primario') + '" data-acao="disc-ia"' + (UI.discIACarregando ? ' disabled' : '') + '>' + (UI.discIACarregando ? 'O Claude está lendo o seu texto…' : ia ? 'Pedir outra correção' : 'Pedir correção ao Claude') + '</button></div>' : '') + '</div>';
  html += '<div class="cartao"><h2>Correção pelos quesitos</h2><p class="pequeno mudo">Releia o seu texto procurando cada elemento esperado. Citar sem explicar fica no conceito mais baixo.</p>' +
    t.quesitos.map((q, i) => '<fieldset class="quesito"><legend><b>Quesito ' + (i + 1) + ' · ' + esc(q.titulo) + '</b> <span class="mono pequeno mudo">0 a ' + q.max + '</span></legend>' +
      '<details><summary>O que precisava aparecer</summary><ul class="lista-cb">' + q.esperado.map((e) => '<li>' + esc(e) + '</li>').join('') + '</ul></details>' +
      (ia && ia.porque[i] ? '<p class="pequeno ia-porque"><b>Claude:</b> ' + esc(ia.porque[i]) + '</p>' : '') +
      q.conceitos.map((c, k) => '<label class="conceito"><input type="radio" name="disc-q' + i + '" data-acao="disc-conceito" data-q="' + i + '" value="' + k + '"' + (aval[i] === k ? ' checked' : '') + '><span><b>' + k + '</b> ' + esc(c) + '</span></label>').join('') + '</fieldset>').join('') +
    '<div class="campo"><label for="disc-ne">Erros de português que você encontrou ao reler (grafia, acentuação, pontuação, concordância, regência)</label><input id="disc-ne" type="number" min="0" step="1" inputmode="numeric" value="' + esc(UI.discNE || 0) + '"></div>' +
    '<div class="disc-res" id="disc-res">' + resultadoDisc(t) + '</div>' +
    '<div class="linha-btns"><button class="btn primario" data-acao="disc-salvar">Salvar resultado</button><button class="btn" data-acao="disc-editar">Voltar a editar</button></div></div>';
  if (st.tentativas.length) html += '<div class="cartao"><h2>Tentativas anteriores</h2><div class="tabela-env"><table class="tabela"><thead><tr><th>Data</th><th>Linhas</th><th>Erros</th><th>Nota</th></tr></thead><tbody>' + st.tentativas.map((x) => '<tr><td>' + esc(fmtData(x.d, { day: '2-digit', month: '2-digit' })) + '</td><td class="num">' + x.tl + '</td><td class="num">' + x.ne + '</td><td class="num">' + x.nq.toFixed(2).replace('.', ',') + '</td></tr>').join('') + '</tbody></table></div></div>';
  return html;
}
let timerDisc = null;
// Itens reais de uma disciplina: os que estão em blocos dela
function reaisDaDisc(id) { return REAIS.filter((q) => (BI.get(q.b) || {}).disciplina === id); }
function numItem(q) { const m = /(item|questão) (\d+)/.exec(q.pv || ''); return m ? (m[1] === 'item' ? 'Item ' : 'Questão ') + m[2] : ((q.pv || '').split(' · ')[1] || q.id); }
function renderCebraspe() {
  const cb = D.cebraspe;
  if (!cb) return '<p class="mudo">Dados da banca indisponíveis nesta versão.</p>';
  const li = (t) => '<li>' + esc(t) + '</li>';
  const nC = REAIS.filter((q) => !q.al && q.g === 'C').length, nMc = REAIS.filter((q) => q.al).length;
  const chip = (id) => { const q = QI.get(id); return q ? '<button class="chip item-real" data-acao="revisar-item" data-q="' + esc(id) + '" title="' + esc(q.pv || '') + '">' + esc(numItem(q)) + ' · ' + nomeGab(q) + '</button>' : ''; };
  let html = '<div class="prosa"><h2>Como o Cebraspe cobra</h2><p>' + esc(cb.fonte) + '</p></div>';
  html += '<div class="chips cb-nav">' + cb.disciplinas.map((d) => { const x = DISC.find((y) => y.id === d.id); return x ? '<button class="chip" data-acao="rolar" data-alvo="cb-' + esc(d.id) + '">' + esc(x.nome) + '</button>' : ''; }).join('') + '<button class="chip" data-acao="rolar" data-alvo="cb-raiox">O que a banca repete</button><button class="chip" data-acao="rolar" data-alvo="cb-discursiva">Discursiva</button><button class="chip" data-acao="rolar" data-alvo="cb-provas">Provas para mandar</button></div>';
  html += '<div class="cartao"><h2>A prova e a pontuação</h2><div class="tabela-env"><table class="tabela cb-tabela"><thead><tr><th>Prova</th><th>Tamanho</th><th>Corte</th></tr></thead><tbody>' +
    cb.estrutura.map((e) => '<tr><td>' + esc(e.prova) + '</td><td>' + esc(e.itens) + '</td><td>' + esc(e.corte) + '</td></tr>').join('') + '</tbody></table></div>' +
    '<ul class="lista-cb">' + cb.regras.map(li).join('') + '</ul>' +
    '<p class="pequeno mudo">No banco: ' + pl(REAIS.length, 'item real', 'itens reais') + ': ' + nC + ' com gabarito certo, ' + (REAIS.length - nC - nMc) + ' com gabarito errado' + (nMc ? ' e ' + nMc + ' de múltipla escolha' : '') + '.</p></div>';
  html += renderRaioX(cb, chip);
  for (const d of cb.disciplinas) {
    const x = DISC.find((y) => y.id === d.id);
    if (!x) continue;
    const nReais = reaisDaDisc(d.id).length;
    html += '<div class="cartao cb-disc" id="cb-' + esc(d.id) + '"><div class="secao-cab"><h2>' + esc(x.nome) + '</h2><span class="selo">peso ' + esc(x.peso.toLowerCase()) + '</span></div>' +
      '<p><b>Na Anatel 2024.</b> ' + esc(d.anatel) + '</p>' +
      (d.como.length ? '<h3>Como a banca cobrou</h3><ul class="lista-cb">' + d.como.map(li).join('') + '</ul>' : '') +
      (d.inferencia ? '<p class="inferencia"><b>Aposta para a ANPD</b> (inferência, sem prova anterior). ' + esc(d.inferencia) + '</p>' : '') +
      '<p><b>Como treinar.</b> ' + esc(d.treino) + '</p>' +
      (d.exemplos.length ? '<div class="campo"><span class="rot">Abrir item real</span><div class="chips">' + d.exemplos.map(chip).join('') + '</div></div>' : '') +
      (nReais ? '<div class="linha-btns"><button class="btn" data-acao="reais-disc" data-d="' + esc(d.id) + '">Treinar ' + pl(nReais, 'item real', 'itens reais') + '</button></div>' : '<p class="pequeno mudo">Sem item real desta matéria no banco ainda.</p>') + '</div>';
  }
  const ds = cb.discursiva;
  html += '<div class="cartao cb-disc" id="cb-discursiva"><h2>Discursiva</h2><ul class="lista-cb">' + ds.formato.map(li).join('') + '</ul>' +
    '<h3>O que caiu e como foi pontuado</h3><ul class="lista-cb">' + ds.caiu.map(li).join('') + '</ul>' +
    '<h3>O que isso ensina</h3><ul class="lista-cb">' + ds.licoes.map(li).join('') + '</ul>' +
    '<p class="inferencia"><b>Aposta para a ANPD</b> (inferência). ' + esc(ds.inferencia) + '</p></div>';
  html += '<div class="cartao cb-disc" id="cb-provas"><h2>Provas para mandar</h2><p class="mudo pequeno">Cebraspe, mais recentes primeiro. Para cada uma: o caderno, o gabarito definitivo (não o preliminar) e o padrão de resposta da discursiva, se houver. Cada prova enviada vira itens reais com gabarito oficial e atualiza esta página.</p><ol class="lista-cb">' + cb.provas.map(li).join('') + '</ol></div>';
  return html;
}
// Raio-x dos itens reais: artigos da LGPD e armadilhas mais frequentes, contados no banco, e os padrões que a banca repete
function renderRaioX(cb, chip) {
  const conta = (lista, chave) => { const m = new Map(); for (const q of lista) { const k = chave(q); if (k) m.set(k, (m.get(k) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]); };
  const arts = conta(REAIS.filter((q) => q.l === 'lgpd'), (q) => q.art).slice(0, 8);
  const arms = conta(REAIS.filter((q) => q.l !== 'texto'), (q) => q.a).slice(0, 6);
  const rotArt = (a) => 'art. ' + a + (/^\d$/.test(a) ? 'º' : '');
  let html = '<div class="cartao cb-disc" id="cb-raiox"><h2>O que a banca repete</h2>' +
    '<p class="pequeno mudo">Contado nos ' + REAIS.length + ' itens reais do banco.</p>' +
    (arts.length ? '<p><b>Artigos da LGPD mais cobrados.</b> ' + arts.map(([a, n]) => esc(rotArt(a)) + ' (' + n + ')').join(' · ') + '</p>' : '') +
    '<p><b>Armadilhas mais frequentes nos itens de norma.</b> ' + arms.map(([a, n]) => esc(D.armadilhas[a] || a) + ' (' + n + ')').join(' · ') + '</p>';
  for (const p of cb.padroes || []) html += '<h3>' + esc(p.titulo) + '</h3><p>' + esc(p.texto) + '</p>' + (p.exemplos.length ? '<div class="chips">' + p.exemplos.map(chip).join('') + '</div>' : '');
  return html + '</div>';
}
function renderAjustes() {
  const metas = [20, 30, 40, 60, 90], novos = [5, 10, 15, 20, 30], inter = [0, 20, 30, 40, 50];
  const dg = Store.diag;
  const linha = (rot, val, ok) => '<tr><td>' + rot + '</td><td class="' + (ok === true ? 'ok' : ok === false ? 'no' : '') + '">' + esc(val) + '</td></tr>';
  const st = (v) => (v === 'ok' ? true : v === '—' ? null : false);
  return '<div class="secao-cab"><h2>Ajustes</h2></div>' +
    '<div class="cartao"><div class="campo"><span class="rot">Tema</span><div class="chips">' + TEMAS.map(([v, t]) => '<button class="chip" data-acao="tema" data-tema="' + v + '" aria-pressed="' + (UI.tema === v) + '">' + t + '</button>').join('') + '</div><p class="pequeno mudo">Automático segue o aparelho e o claude.ai. Noturno pelo horário fica escuro das 19h às 6h. A escolha fica salva na sua conta, como as demais preferências.</p></div></div>' +
    '<div class="cartao"><div class="campo"><span class="rot">Meta diária de questões</span><div class="chips">' + metas.map((m) => '<button class="chip" data-acao="meta" data-meta="' + m + '" aria-pressed="' + (S.perfil.meta === m) + '">' + m + '</button>').join('') + '</div></div>' +
    '<div class="campo"><span class="rot">Questões intercaladas por dia</span><div class="chips">' + inter.map((m) => '<button class="chip" data-acao="intercaladas-n" data-n="' + m + '" aria-pressed="' + ((S.perfil.intercaladas == null ? 30 : S.perfil.intercaladas) === m) + '">' + (m || 'Desligar') + '</button>').join('') + '</div><p class="pequeno mudo">Metade das matérias básicas, metade dos blocos já estudados, misturadas. Em dia pesado de revisão a sessão encolhe sozinha.</p></div>' +
    '<div class="campo"><span class="rot">Cards novos por dia</span><div class="chips">' + novos.map((m) => '<button class="chip" data-acao="novos-cards" data-n="' + m + '" aria-pressed="' + ((S.perfil.novosCards || 20) === m) + '">' + m + '</button>').join('') + '</div><p class="pequeno mudo">Cada card novo volta várias vezes nos dias seguintes. 20 por dia é o equilíbrio para quem tem 1h45 de estudo.</p></div></div>' +
    '<div class="cartao"><h2>Backup do progresso</h2><p class="pequeno">Salve um arquivo com todo o seu progresso. Se a gravação na conta falhar, ou se você trocar de aparelho, é só restaurar.</p>' +
    '<div class="linha-btns"><button class="btn primario" data-acao="backup-baixar">Baixar backup (.json)</button><button class="btn" data-acao="backup-mostrar">Copiar como texto</button></div>' +
    '<div class="campo"><label for="arquivo-backup">Restaurar de um arquivo</label><input id="arquivo-backup" type="file" accept=".json,application/json" data-acao="backup-arquivo"></div>' +
    '<div class="campo"><label for="texto-backup">Ou restaurar colando o texto do backup</label><textarea id="texto-backup" class="area-texto" placeholder="Cole aqui o texto copiado em “Copiar como texto”"></textarea><div class="linha-btns"><button class="btn" data-acao="backup-colado">Restaurar do texto</button></div></div>' +
    '<div id="zona-backup"></div></div>' +
    '<div class="cartao"><h2>Diagnóstico da gravação</h2><p class="pequeno mudo">Use quando o progresso não aparecer em outro aparelho ou surgir mensagem de erro.</p><div class="tabela-env"><table class="tabela diag"><tbody>' +
    linha('Onde o progresso está', Store.modo === 'nuvem' ? 'Na sua conta e neste navegador' : 'Só neste navegador', Store.modo === 'nuvem') +
    linha('Página aberta dentro do claude.ai', dg.claude ? 'sim' : 'não', dg.claude) +
    linha('Banco de dados do app', dg.db, st(dg.db)) +
    linha('Identificação do usuário', dg.user === 'ok' ? dg.id : dg.user, dg.user === 'ok' && dg.id === 'ok' ? true : dg.user === '—' ? null : false) +
    linha('Leitura do progresso salvo', dg.leitura, st(dg.leitura)) +
    linha('Última gravação', dg.gravacao, st(dg.gravacao)) +
    linha('Cópia neste navegador', dg.navegador, st(dg.navegador)) +
    linha('Erros nesta abertura', ERROS.length ? ERROS.length + ' · o último: ' + ERROS[0].m : 'nenhum', !ERROS.length) +
    (Object.keys(Store.tamanhos).length ? (() => { const [n, t] = Object.entries(Store.tamanhos).sort((a, b) => b[1] - a[1])[0]; return linha('Maior documento enviado', n + ' · ' + Math.round(t / 1024) + ' KB de 256', t <= LIMITE_DOC); })() : '') +
    '</tbody></table></div><p class="pequeno">Se o banco aparecer como indisponível: abra o app pelo link do claude.ai com a sua conta conectada (não por arquivo baixado), no navegador ou no app do Claude, e confira as permissões do artifact. Enquanto isso, o progresso fica neste navegador e o backup em arquivo garante que nada se perca.</p>' +
    '<div class="linha-btns"><button class="btn" data-acao="permissoes">Abrir permissões do app</button><button class="btn" data-acao="tentar-gravar">Tentar gravar de novo</button>' + (ERROS.length ? '<button class="btn" data-acao="copiar-erros">Copiar os erros</button>' : '') + '</div></div>' +
    '<div class="cartao"><h2>Banco de conteúdo</h2><p class="pequeno mudo">' + Q.length + ' questões · ' + CARDS.length + ' cards cloze · ' + GLOSS.length + ' termos · versão ' + esc(D.versao) + '</p></div>' +
    '<div class="cartao"><h2>Recomeçar do zero</h2><p class="pequeno mudo">Apaga XP, respostas, cards, sequência, simulados, discursivas e lista de pesquisa.</p><div id="zona-zerar"><button class="btn" data-acao="zerar">Zerar progresso</button></div></div>';
}

/* ================= Backup ================= */
let backupPendente = null;
function backupTexto() {
  return JSON.stringify({ app: 'painel-anpd', versao: 3, exportado: new Date().toISOString(), perfil: S.perfil, itens: S.itens, cards: S.cards, simulados: S.simulados, pesquisa: S.pesquisa, disc: S.disc, contestacoes: CONTEST });
}
async function salvarArquivo(nome, conteudo) {
  let dl = null;
  try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({ filename: nome, data: conteudo }); avisar('↓', 'Arquivo pronto', nome); return true; }
    catch (e) { if (e && e.code === 'declined') return false; }
  }
  return null;
}
function mostrarTexto(destino, conteudo, rotulo) {
  const el = destino ? document.getElementById(destino) : null;
  const html = '<p class="pequeno">' + esc(rotulo) + '</p><textarea class="area-texto" id="texto-export" readonly>' + esc(conteudo) + '</textarea><div class="linha-btns"><button class="btn pequeno" data-acao="copiar">Copiar</button></div>';
  if (el) el.innerHTML = html; else abrirFolha(cabFolha('Exportar', 'Texto') + html, 'Exportar');
}
function restaurar(texto) {
  let d;
  try { d = JSON.parse(String(texto).trim()); } catch (e) { avisar('!', 'Backup inválido', 'Não é um backup do Painel ANPD (confira se o texto foi copiado inteiro).'); return; }
  if (!d || d.app !== 'painel-anpd' || !d.perfil) { avisar('!', 'Backup inválido', 'Não é um backup do Painel ANPD.'); return; }
  backupPendente = d;
  const z = document.getElementById('zona-backup');
  const resumo = 'Backup de ' + esc(fmtData(String(d.exportado).slice(0, 10), { day: '2-digit', month: '2-digit', year: 'numeric' })) + ': ' + fmtNum(d.perfil.xp || 0) + ' XP, ' + pl(Object.keys(d.itens || {}).length, 'questão', 'questões') + ' e ' + pl(Object.keys(d.cards || {}).length, 'card', 'cards') + ' com histórico.';
  if (z) z.innerHTML = '<div class="cartao destaque"><p>' + resumo + '</p><p class="pequeno mudo">Juntar soma o backup ao que já está neste aparelho: nenhuma resposta, card ou dia de estudo se perde, e em cada item fica o registro mais recente. Substituir apaga o progresso deste aparelho e põe o do backup no lugar.</p><div class="linha-btns"><button class="btn primario" data-acao="backup-juntar">Juntar com este aparelho</button><button class="btn" data-acao="backup-confirmar">Substituir tudo</button><button class="btn" data-acao="mais" data-sub="ajustes">Cancelar</button></div></div>';
}

/* ================= Navegação ================= */
const VISTAS = ['hoje', 'questoes', 'cards', 'lei', 'mais'];
function ir(v) {
  if (!VISTAS.includes(v)) v = 'hoje';
  UI.vista = v;
  salvarUI();
  renderTudo();
  window.scrollTo(0, 0);
}
function renderTudo() {
  UI.artInline = null;
  renderTopo();
  VISTAS.forEach((v) => { document.getElementById('vista-' + v).hidden = v !== UI.vista; });
  document.querySelectorAll('.aba').forEach((b) => { if (b.dataset.vista === UI.vista) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  ({ hoje: renderHoje, questoes: renderQuestoes, cards: renderCards, lei: renderLei, mais: renderMais })[UI.vista]();
  if (sessao) renderSessao();
}
// Página do subtema já na parte pedida: na lei, abre o primeiro artigo ainda não lido; na aula do dia, dá baixa no passo
function abrirSubtemaEm(id, parte) {
  if (!SUBTEMAS.get(id)) return;
  fecharFolha();
  UI.subtema = id;
  UI.mais = 'trilha';
  if (UI.vista !== 'mais') ir('mais'); else renderMais();
  const el = document.getElementById(parte + '-' + id);
  if (el) el.scrollIntoView({ block: 'start' });
  if (parte === 'aula') {
    const dia = DIAS.find((d) => d.data === hojeISO());
    if (dia && dia.st === id && !S.perfil.feitos['aula:' + dia.data]) { S.perfil.feitos['aula:' + dia.data] = 1; Store.salvar('perfil'); }
    return;
  }
  const lidos = S.perfil.lidos || {}, chips = [...document.querySelectorAll('#lei-' + id + ' .chip[data-acao="art-inline"]')];
  const c = chips.find((b) => !lidos[b.dataset.art]) || chips[0];
  if (c) abrirArtInline(c);
}
function abrirArtigo(art, fila) {
  if (!ARTI.get(art)) return;
  UI.artSel = art;
  UI.lei = ARTI.get(art).lei;
  if (fila !== undefined) UI.leiFila = fila;
  if (UI.vista !== 'lei') ir('lei'); else { renderLei(); window.scrollTo(0, 0); }
  try { marcarLido(art); } catch (e) { registrarErro('marcar o artigo como lido', e); }
}

/* ================= Eventos ================= */
document.addEventListener('click', async (ev) => {
  const alvo = ev.target.closest('[data-acao]');
  if (!alvo) { if (ev.target.id === 'folha') fecharFolha(); return; }
  const a = alvo.dataset.acao;
  if (alvo.tagName === 'INPUT' || alvo.tagName === 'SELECT') return;
  try { await executar(a, alvo); } catch (e) { registrarErro('botão ' + a, e); }
});
async function executar(a, alvo) {
  switch (a) {
    case 'ir':
      // A aba Mais sempre abre o menu do Mais, não a última página aberta lá dentro
      if (alvo.classList.contains('aba') && alvo.dataset.vista === 'mais') { UI.mais = 'menu'; UI.subtema = null; if (UI.vista === 'mais') { renderMais(); window.scrollTo(0, 0); break; } }
      ir(alvo.dataset.vista); break;
    case 'mais': fecharFolha(); UI.mais = alvo.dataset.sub || 'menu'; if (UI.vista !== 'mais') ir('mais'); else { renderMais(); window.scrollTo(0, 0); } break;
    case 'iniciar-dia': iniciarDia(alvo.dataset.dia); break;
    case 'recuperar': { if (retomarPausa('rec:' + hojeISO())) break; const cfg = cfgRecuperacao(); if (cfg) iniciarSessao(cfg); else avisar('✓', 'Sem atraso', 'As matérias dos dias passados já foram estudadas.'); break; }
    case 'ler-atraso': { const arts = leituraAtrasada().slice(0, LEITURA_MAX); if (arts.length) abrirArtigo(arts[0], arts); break; }
    case 'ler-pendente': { const x = pendencias().find((y) => y.dia.data === alvo.dataset.dia); if (x && x.ler.length) abrirArtigo(x.ler[0], x.ler); break; }
    case 'atraso-desde-inicio':
      S.perfil.atrasoDesde = DIAS[0].data;
      Store.salvar('perfil'); pendCache = null; renderHoje();
      avisar('✓', 'Atraso desde o início do plano', 'Os dias desde ' + fmtData(DIAS[0].data, { day: '2-digit', month: '2-digit' }) + ' entram no atraso. Os que você não quiser fazer podem ser dispensados um a um.');
      break;
    case 'dispensar-dia': {
      (S.perfil.dispensados ||= {})[alvo.dataset.dia] = hojeISO();
      Store.salvar('perfil'); renderHoje();
      avisar('✓', 'Pendência dispensada', 'O dia ' + fmtData(alvo.dataset.dia, { day: '2-digit', month: '2-digit' }) + ' saiu da lista. O que você estudou dele continua contando.');
      break;
    }
    case 'enfrentar-chefe': {
      const c = chefeDaSemana();
      if (sessao) fecharSessao(false);
      iniciarSessao({ modo: 'treino', n: BATALHA_N, blocos: [c.bloco], filtro: 'mistas', titulo: 'Batalha · ' + nomeChefe(c.bloco), chave: 'chefe:' + c.sem });
      break;
    }
    case 'equipar': { const it = IR.get(alvo.dataset.item); if (it && rpg().inv[it.id]) { rpg().eq[it.slot] = it.id; Store.salvar('perfil'); renderMais(); } break; }
    case 'iniciar-revisao': iniciarSessao({ modo: 'revisao', n: 30, chave: 'rev' }); break;
    case 'intercaladas': if (retomarPausa('i:' + hojeISO())) break; iniciarSessao({ modo: 'treino', intercalado: true, n: nIntercaladas(), titulo: 'Questões intercaladas', dia: 'i:' + hojeISO() }); break;
    case 'treino-rapido': iniciarSessao({ modo: 'treino', n: 20, blocos: [], filtro: 'mistas', chave: 'rapido' }); break;
    case 'abrir-modo': UI.modo = alvo.dataset.modo; if (UI.modo === 'simulado') UI.prova = 'prova'; ir('questoes'); break;
    case 'relampago': iniciarSessao({ modo: 'relampago', blocos: (alvo.dataset.blocos || '').split(',').filter(Boolean) }); break;
    case 'set-modo': UI.modo = alvo.dataset.modo; salvarUI(); renderQuestoes(); break;
    case 'set-prova': UI.prova = alvo.dataset.prova; salvarUI(); renderQuestoes(); break;
    case 'set-n': UI.n = Number(alvo.dataset.n); salvarUI(); renderQuestoes(); break;
    case 'set-filtro': UI.filtro = alvo.dataset.filtro; salvarUI(); renderQuestoes(); break;
    case 'preset': {
      const p = alvo.dataset.preset, comQ = BLOCOS.filter((b) => (POR_BLOCO.get(b.id) || []).length);
      UI.blocos = p === 'p1' ? P1.slice() : p === 'lgpd' ? comQ.filter((b) => b.disciplina === 'lgpd').map((b) => b.id) : p === 'tudo' ? comQ.map((b) => b.id) : [];
      salvarUI(); renderQuestoes(); break;
    }
    case 'comecar': comecarConfigurado(); break;
    case 'responder': responder(alvo.dataset.r); break;
    case 'revelar': proximo(); break;
    case 'avaliar': avaliar(Number(alvo.dataset.n)); break;
    case 'proximo': proximo(); break;
    case 'som': UI.som = !UI.som; salvarUI(); tocar('acerto'); renderSessao(); break;
    case 'anterior': if (sessao && sessao.i > 0) { sessao.i--; renderSessao(); } break;
    case 'ir-item': if (sessao) { sessao.i = Number(alvo.dataset.i); renderSessao(); } break;
    case 'entregar': if (sessao) { sessao.confirmar = 'entregar'; renderSessao(); document.getElementById('sessao').scrollTop = 0; } break;
    case 'confirmar-entrega': if (sessao) { sessao.confirmar = null; finalizar(); } break;
    case 'cancelar-conf': if (sessao) { sessao.confirmar = null; renderSessao(); } break;
    case 'sair-sessao':
      if (!sessao) break;
      if (sessao.fim || (sessao.modo === 'cards' ? sessao.i === 0 : !Object.keys(sessao.resp).length)) fecharSessao();
      else { sessao.confirmar = 'sair'; renderSessao(); document.getElementById('sessao').scrollTop = 0; }
      break;
    case 'descartar-pausa': descartarPausa(alvo.dataset.k); renderTudo(); break;
    case 'retomar-pausa': retomarPausa(alvo.dataset.k); break;
    case 'confirmar-saida': {
      const k = chavePausa(sessao);
      fecharSessao();
      const p = k && pausaDe(k);
      if (p) avisar('II', 'Sessão guardada', resumoPausa(p).replace(/^./, (c) => c.toUpperCase()) + '. Toque em Continuar para seguir de onde parou.');
      break;
    }
    case 'sair-descartar': { const k = chavePausa(sessao); fecharSessao(false); if (k) descartarPausa(k); renderTudo(); break; }
    case 'fechar-sessao': fecharSessao(); break;
    case 'refazer-erros': {
      const ids = idsParaRefazer();
      fecharSessao();
      iniciarSessao({ modo: 'treino', ids: embaralhar(ids), titulo: 'Refazer erros' });
      break;
    }
    case 'revisar-item': folhaItem(alvo.dataset.q, alvo.dataset.r); break;
    case 'art-inline': abrirArtInline(alvo); break;
    case 'fechar-folha': fecharFolha(); break;
    case 'termo': folhaTermo(Number(alvo.dataset.t)); break;
    case 'treinar-termo': {
      const g = GLOSS[Number(alvo.dataset.t)];
      const ids = Q.filter((q) => g.re.test(q.e + ' ' + q.c)).map((q) => q.id);
      fecharFolha();
      if (sessao) fecharSessao();
      iniciarSessao({ modo: 'treino', ids: embaralhar(ids).slice(0, 20), titulo: g.t });
      break;
    }
    case 'add-pesq':
      if (addPesquisa(alvo.dataset.t, alvo.dataset.o)) {
        if (alvo.closest('#folha') || alvo.closest('#sessao')) { if (alvo.tagName === 'BUTTON') alvo.outerHTML = '<span class="selo ok">Na sua lista</span>'; }
        else if (UI.vista === 'mais') renderMais(); else if (UI.vista === 'hoje') renderHoje();
      }
      break;
    case 'filtro-pesq': UI.filtroPesq = alvo.dataset.f; renderMais(); break;
    case 'abrir-art': abrirArtigo(alvo.dataset.art, null); break;
    case 'nav-art': if (alvo.dataset.art) abrirArtigo(alvo.dataset.art); break;
    case 'voltar-lei': if (UI.artSel && ARTI.get(UI.artSel)) UI.lei = ARTI.get(UI.artSel).lei; UI.artSel = null; UI.leiFila = null; renderLei(); window.scrollTo(0, 0); break;
    case 'ler-dia': { const ctx = contextoHoje(); const arts = artigosDoDia(ctx.tipo === 'dia' ? ctx.dia : null); if (arts.length) abrirArtigo(arts[0], arts); break; }
    case 'ler-tudo': if (artsDe(UI.lei).length) abrirArtigo(artsDe(UI.lei)[0].k, null); break;
    case 'fim-fila': UI.leiFila = null; UI.artSel = null; avisar('§', 'Leitura do dia concluída', 'Agora os cards cloze desses artigos.'); ir('hoje'); break;
    case 'ranking': UI.ranking = !UI.ranking; renderLei(); break;
    case 'camada':
      UI.camadas[alvo.dataset.c] = !UI.camadas[alvo.dataset.c];
      salvarUI();
      if (alvo.closest('#folha') && UI.folhaAula) folhaAula(UI.folhaAula);
      else if (UI.vista === 'mais') renderMais(); else renderLei();
      break;
    case 'treinar-arm': {
      // Itens da armadilha escolhida, de preferência nos blocos de prioridade 1 e 2; vencidas e inéditas primeiro
      const k = alvo.dataset.a;
      const todos = Q.filter((q) => q.a === k && !q.al);
      const fortes = todos.filter((q) => (BI.get(q.b) || {}).prioridade <= 2);
      const ids = selecionar(fortes.length >= 20 ? fortes : todos, 20, 'mistas').map((q) => q.id);
      if (ids.length) iniciarSessao({ modo: 'treino', ids, titulo: 'Armadilha · ' + (D.armadilhas[k] || k), chave: 'arm:' + k });
      break;
    }
    case 'treinar-bloco': iniciarSessao({ modo: 'treino', n: 20, blocos: [alvo.dataset.bloco], filtro: 'mistas', titulo: 'Treino · ' + nomeBloco(alvo.dataset.bloco), chave: 'bloco:' + alvo.dataset.bloco }); break;
    case 'treinar-art': { const ids = (POR_ART.get(alvo.dataset.art) || []).map((q) => q.id); iniciarSessao({ modo: 'treino', ids: embaralhar(ids), titulo: 'Questões · ' + nomeArt(alvo.dataset.art), chave: 'art:' + alvo.dataset.art }); break; }
    case 'cards-art': iniciarCards((CARDS_POR_ART.get(alvo.dataset.art) || []).map((c) => c.id), 'Cards · ' + nomeArt(alvo.dataset.art)); break;
    case 'treinar-reais': {
      const ids = selecionarReais(20).map((q) => q.id);
      if (ids.length) iniciarSessao({ modo: 'treino', ids, titulo: 'Itens reais inéditos', chave: 'reais:ineditos' });
      break;
    }
    case 'reais-disc': {
      const d = (D.cebraspe ? D.cebraspe.disciplinas : []).find((x) => x.id === alvo.dataset.d);
      const ids = d ? reaisDaDisc(d.id).map((q) => q.id) : [];
      if (ids.length) iniciarSessao({ modo: 'treino', ids: embaralhar(ids), titulo: 'Itens reais · ' + ((DISC.find((x) => x.id === d.id) || {}).nome || d.id), chave: 'reais:' + d.id });
      break;
    }
    case 'disc-abrir': UI.discTema = alvo.dataset.t; UI.discFase = 'escrita'; UI.discAval = {}; UI.discNE = 0; UI.discIA = null; renderMais(); window.scrollTo(0, 0); break;
    case 'disc-voltar': UI.discTema = null; UI.discFase = null; renderMais(); window.scrollTo(0, 0); break;
    case 'investigar': folhaInvestigar(alvo.dataset.t, alvo.dataset.o); break;
    case 'inv-conferir': conferirInv(); break;
    case 'inv-parar': if (UI.inv && UI.inv.ctl) UI.inv.ctl.abort(); break;
    case 'inv-copiar': copiarInv(); break;
    case 'inv-entendi': { const p = S.pesquisa[alvo.dataset.k]; if (p && !p.s) { p.s = 1; p.f = hojeISO(); ganharXP(5); verificarConquistas(); Store.salvar('pesquisa', 'perfil'); } if (UI.inv) folhaInvestigar(UI.inv.t, UI.inv.o); if (UI.vista === 'mais') renderMais(); break; }
    case 'disc-ia': corrigirDiscIA(); break;
    case 'claro-ia': await traduzirIA(alvo); break;
    case 'disc-corrigir':
      if (!estadoDisc(UI.discTema).rascunho.trim()) { avisar('!', 'Texto vazio', 'Escreva a resposta antes de corrigir.'); break; }
      UI.discFase = 'correcao'; renderMais(); break;
    case 'disc-dia': fecharFolha(); UI.mais = 'discursiva'; UI.discTema = alvo.dataset.t; UI.discFase = 'escrita'; UI.discAval = {}; UI.discNE = 0; UI.discIA = null; if (UI.vista !== 'mais') ir('mais'); else renderMais(); window.scrollTo(0, 0); break;
    case 'disc-editar': UI.discFase = 'escrita'; UI.discIA = null; renderMais(); break;
    case 'disc-limpar': alvo.outerHTML = '<button class="btn" data-acao="disc-limpar-ok">Apagar mesmo o texto</button>'; break;
    case 'disc-limpar-ok': { const t = estadoDisc(UI.discTema); t.rascunho = ''; Store.salvar('discursivas'); renderMais(); break; }
    case 'disc-salvar': {
      const t = TEMAS_DISC.find((x) => x.id === UI.discTema);
      if (!t) break;
      const r = notaDisc(t);
      if (!r.completo) { avisar('!', 'Falta conceito', 'Marque um conceito em cada quesito antes de salvar.'); break; }
      const st = estadoDisc(t.id);
      st.tentativas.unshift({ d: hojeISO(), nc: Math.round(r.nc * 100) / 100, ne: r.ne, tl: r.tl, nq: Math.round(r.nq * 100) / 100, q: t.quesitos.map((q, i) => UI.discAval[i]), ia: UI.discIA ? 1 : undefined });
      st.tentativas = st.tentativas.slice(0, 8);
      ganharXP(30);
      verificarConquistas();
      const baixa = darBaixaDisc();
      Store.salvar('discursivas', 'perfil');
      avisar('✎', 'Discursiva salva', r.nq.toFixed(2).replace('.', ',') + ' de ' + t.pontos + ' · +30 XP' + (baixa ? ' · plano de ' + fmtData(baixa.data, { day: '2-digit', month: '2-digit' }) + ' em dia' : ''));
      renderMais();
      break;
    }
    case 'contestar': folhaContestar(alvo.dataset.q); break;
    case 'subtema': fecharFolha(); UI.subtema = alvo.dataset.st || null; UI.mais = 'trilha'; if (UI.vista !== 'mais') ir('mais'); else renderMais(); window.scrollTo(0, 0); break;
    case 'aula-folha': folhaAula(alvo.dataset.st); break;
    case 'st-lei': case 'st-aula': abrirSubtemaEm(alvo.dataset.st, a === 'st-lei' ? 'lei' : 'aula'); break;
    case 'trilha-sessao': {
      const st = SUBTEMAS.get(alvo.dataset.st), tipo = alvo.dataset.tipo;
      const chT = 't:' + st.id + ':' + tipo;
      if (pausaDe(chT)) { fecharFolha(); retomarPausa(chT); break; }
      const ids = idsSubtema(st.id, tipo, tipo === 'pre' ? 8 : 20);
      if (!ids.length) { avisar('§', 'Nada para fazer aqui', tipo === 'erros' ? 'Você não tem erros pendentes neste subtema.' : 'Todos os itens já foram vistos: use Praticar.'); break; }
      fecharFolha();
      iniciarSessao({ modo: 'treino', ids, titulo: (tipo === 'pre' ? 'Pré-teste · ' : tipo === 'erros' ? 'Erros · ' : 'Prática · ') + st.nome, dia: 't:' + hojeISO(), chave: chT });
      break;
    }
    case 'contestar-enviar': {
      const motivo = (document.querySelector('input[name="contest-motivo"]:checked') || {}).value || 'outro';
      const texto = (document.getElementById('contest-texto') || {}).value || '';
      const rec = { q: alvo.dataset.q, motivo, texto: texto.trim().slice(0, 2000), data: new Date().toISOString(), versao: D.versao, status: 'pendente', resposta: '' };
      CONTEST.push(rec); gravarContest(); verificarConquistas(); Store.salvar('perfil');
      alvo.disabled = true;
      const ok = await enviarContestacao(rec);
      gravarContest();
      avisar('!', ok ? 'Contestação enviada' : 'Contestação guardada', ok ? 'O item será revisto na próxima rodada.' : 'Sem conexão com o banco agora: ela será enviada quando o app abrir conectado.');
      folhaContestar(rec.q);
      break;
    }
    case 'rolar': { const el = document.getElementById(alvo.dataset.alvo); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); break; }
    case 'reais': {
      const ids = REAIS.map((q) => q.id);
      iniciarSessao({ modo: alvo.dataset.modo, ids: alvo.dataset.modo === 'simulado' ? ids.sort((a, b) => ordemProva(QI.get(a)) - ordemProva(QI.get(b))) : embaralhar(ids), titulo: alvo.dataset.modo === 'simulado' ? 'Itens reais como prova' : 'Itens reais de prova', chave: 'reais-' + alvo.dataset.modo });
      break;
    }
    case 'cards-iniciar': iniciarSessao({ modo: 'cards', blocos: UI.blocosCards, novos: novosRestantesHoje() }); break;
    case 'cards-so-revisao': iniciarSessao({ modo: 'cards', blocos: UI.blocosCards, soRevisao: true }); break;
    case 'cards-revisao': iniciarSessao({ modo: 'cards', soRevisao: true, titulo: 'Cards vencidos' }); break;
    case 'cards-dia': {
      const ctx = contextoHoje();
      const bs = blocosDoDia(ctx.tipo === 'dia' ? ctx.dia : null).filter((b) => (CARDS_POR_BLOCO.get(b) || []).length);
      iniciarSessao({ modo: 'cards', blocos: bs, novos: novosRestantesHoje(), titulo: 'Cards do dia' });
      break;
    }
    case 'fase': UI.faseAberta = UI.faseAberta === alvo.dataset.fase ? '' : alvo.dataset.fase; renderMais(); break;
    case 'status': { const b = alvo.dataset.bloco; S.perfil.status[b] = STATUS_CICLO[S.perfil.status[b] || 'nao']; Store.salvar('perfil'); renderMais(); break; }
    case 'tema': UI.tema = alvo.dataset.tema; salvarUI(); aplicarTema(); renderTudo(); break;
    case 'tema-alternar': UI.tema = temaEscuroAtivo() ? 'claro' : 'escuro'; salvarUI(); aplicarTema(); renderTudo(); break;
    case 'meta': S.perfil.meta = Number(alvo.dataset.meta); Store.salvar('perfil'); renderTudo(); break;
    case 'intercaladas-n': S.perfil.intercaladas = Number(alvo.dataset.n); Store.salvar('perfil'); renderTudo(); break;
    case 'novos-cards': S.perfil.novosCards = Number(alvo.dataset.n); Store.salvar('perfil'); renderTudo(); break;
    case 'backup-baixar': {
      const r = await salvarArquivo('painel-anpd-backup-' + hojeISO() + '.json', backupTexto());
      if (r === true) marcarBackup();
      else if (r === null) mostrarTexto(document.getElementById('zona-backup') ? 'zona-backup' : null, backupTexto(), 'O download não está disponível aqui. Copie o texto e guarde num arquivo .json.');
      break;
    }
    case 'backup-copiar-hoje': mostrarTexto(null, backupTexto(), 'Copie e guarde este texto (num e-mail para você mesmo, por exemplo). Para restaurar, cole-o em Mais → Ajustes e escolha Juntar.'); break;
    case 'backup-mostrar': mostrarTexto('zona-backup', backupTexto(), 'Copie e guarde este texto. Para restaurar, cole-o em “Ou restaurar colando o texto do backup”, aqui mesmo.'); break;
    case 'backup-colado': { const t = document.getElementById('texto-backup'); if (!t || !t.value.trim()) avisar('!', 'Nada colado', 'Cole o texto do backup no campo acima.'); else restaurar(t.value); break; }
    case 'backup-juntar': {
      const d = backupPendente;
      if (!d) break;
      // No que liga e desliga (metas, status, preferências), vale a cópia com mais histórico; a época deste aparelho fica
      const localNovo = Object.keys(S.itens).length >= Object.keys(d.itens || {}).length, ep = S.perfil.ep;
      S.perfil = Object.assign(perfilPadrao(), mesclarDoc('perfil', d.perfil, S.perfil, localNovo));
      if (ep) S.perfil.ep = ep; else delete S.perfil.ep;
      podarPerfil(); aplicarPrefs();
      S.itens = mesclarDoc('itens', { q: d.itens || {} }, { q: S.itens }).q;
      S.cards = mesclarDoc('cards', { c: d.cards || {} }, { c: S.cards }).c;
      S.simulados = mesclarDoc('simulados', { lista: d.simulados || [] }, { lista: S.simulados }, localNovo).lista;
      S.pesquisa = mesclarDoc('pesquisa', { p: d.pesquisa || {} }, { p: S.pesquisa }, localNovo).p;
      S.disc = mesclarDoc('discursivas', { d: d.disc || {} }, { d: S.disc }, localNovo).d;
      juntarContestacoes(d.contestacoes);
      backupPendente = null;
      Store.salvarTudo(); renderTudo(); avisar('↺', 'Backup somado a este aparelho', fmtNum(S.perfil.xp) + ' XP · ' + pl(Object.keys(S.itens).length, 'questão', 'questões') + ' com histórico');
      break;
    }
    case 'backup-confirmar': {
      const d = backupPendente;
      if (!d) break;
      S.perfil = Object.assign(perfilPadrao(), d.perfil, { ep: Date.now() }); podarPerfil(); aplicarPrefs(); S.itens = d.itens || {}; S.cards = d.cards || {}; S.simulados = d.simulados || []; S.pesquisa = d.pesquisa || {}; S.disc = d.disc || {};
      juntarContestacoes(d.contestacoes);
      backupPendente = null;
      Store.salvarTudo(); renderTudo(); avisar('↺', 'Progresso restaurado', fmtNum(S.perfil.xp) + ' XP');
      break;
    }
    case 'copiar': {
      const ta = document.getElementById('texto-export');
      if (!ta) break;
      try { await navigator.clipboard.writeText(ta.value); avisar('✓', 'Copiado', ''); if (ta.value.startsWith('{"app":"painel-anpd"')) marcarBackup(); } catch (e) { ta.focus(); ta.select(); }
      break;
    }
    case 'permissoes': {
      try { const p = window.claude && window.claude.use ? await window.claude.use('permissions') : null; if (p) await p.manage(); else avisar('!', 'Indisponível aqui', 'Use o menu de permissões do artifact no claude.ai.'); }
      catch (e) { avisar('!', 'Não abriu', 'Use o menu de permissões do artifact no claude.ai.'); }
      break;
    }
    case 'tentar-gravar':
      if (Store.modo === 'nuvem') { Store.salvarTudo(); Store.descarregar(); avisar('↑', 'Gravando', 'Confira o diagnóstico em alguns segundos.'); }
      else { Object.assign(Store.diag, { db: '—', user: '—', id: '—', leitura: '—', gravacao: '—' }); Store.iniciar(); }
      setTimeout(() => { if (!sessao) renderTudo(); }, 2500);
      break;
    case 'zerar': document.getElementById('zona-zerar').innerHTML = '<p><b>Tem certeza?</b> Não dá para desfazer. Baixe um backup antes.</p><div class="linha-btns"><button class="btn primario" data-acao="confirmar-zerar">Apagar tudo</button><button class="btn" data-acao="mais" data-sub="ajustes">Cancelar</button></div>'; break;
    case 'confirmar-zerar':
      S.perfil = Object.assign(perfilPadrao(), { status: S.perfil.status, meta: S.perfil.meta, novosCards: S.perfil.novosCards, intercaladas: S.perfil.intercaladas, ui: S.perfil.ui, ep: Date.now() });
      S.itens = {}; S.cards = {}; S.simulados = []; S.pesquisa = {}; S.disc = {};
      Store.salvarTudo(); renderTudo(); avisar('0', 'Progresso zerado', 'Status dos blocos, metas e preferências foram mantidos.');
      break;
    case 'copiar-erros': if (await copiarTexto(JSON.stringify(ERROS, null, 1))) avisar('✓', 'Erros copiados', 'Cole na conversa com o Claude.'); break;
    default: break;
  }
}
document.addEventListener('change', (ev) => {
  const alvo = ev.target.closest('[data-acao]');
  if (!alvo) return;
  const a = alvo.dataset.acao;
  if (a === 'sel-lei') { UI.lei = alvo.value; UI.artSel = null; UI.leiFila = null; salvarUI(); renderLei(); return; }
  if (a === 'toggle-bloco' || a === 'toggle-bloco-card') {
    const chave = a === 'toggle-bloco' ? 'blocos' : 'blocosCards';
    const set = new Set(UI[chave]);
    if (alvo.checked) set.add(alvo.dataset.bloco); else set.delete(alvo.dataset.bloco);
    UI[chave] = BLOCOS.map((x) => x.id).filter((id) => set.has(id));
    salvarUI();
    if (a === 'toggle-bloco') renderQuestoes(); else renderCards();
  } else if (a === 'duvida' && sessao) sessao.duv[sessao.ids[sessao.i]] = alvo.checked;
  else if (a === 'disc-conceito') {
    UI.discAval = UI.discAval || {};
    UI.discAval[Number(alvo.dataset.q)] = Number(alvo.value);
    const t = TEMAS_DISC.find((x) => x.id === UI.discTema), el = document.getElementById('disc-res');
    if (t && el) el.innerHTML = resultadoDisc(t);
  }
  else if (a === 'dia-feito') { if (alvo.checked) S.perfil.feitos[alvo.dataset.dia] = 1; else delete S.perfil.feitos[alvo.dataset.dia]; Store.salvar('perfil'); renderMais(); }
  else if (a === 'pesq-feito') {
    const p = S.pesquisa[alvo.dataset.k];
    if (p) { p.s = alvo.checked ? 1 : 0; p.f = alvo.checked ? hojeISO() : null; if (alvo.checked) ganharXP(5); verificarConquistas(); Store.salvar('pesquisa', 'perfil'); renderMais(); }
  } else if (a === 'backup-arquivo') {
    const f = alvo.files && alvo.files[0];
    if (!f) return;
    const leitor = new FileReader();
    leitor.onload = () => restaurar(String(leitor.result));
    leitor.readAsText(f);
  }
});
// Partes recolhidas (<details data-det>) continuam abertas ou fechadas quando a tela é redesenhada
document.addEventListener('toggle', (ev) => { const d = ev.target; if (d && d.dataset && d.dataset.det) UI.det[d.dataset.det] = d.open; }, true);
document.addEventListener('input', (ev) => {
  const id = ev.target.id;
  if (id === 'inv-texto') { if (UI.inv) UI.inv.rascunho = ev.target.value; return; }
  if (id === 'disc-texto' || id === 'disc-ne') {
    const t = TEMAS_DISC.find((x) => x.id === UI.discTema);
    if (!t) return;
    if (id === 'disc-ne') { UI.discNE = ev.target.value; const el = document.getElementById('disc-res'); if (el) el.innerHTML = resultadoDisc(t); return; }
    estadoDisc(t.id).rascunho = ev.target.value;
    const c = document.getElementById('disc-cont');
    if (c) c.innerHTML = contadorDisc(t);
    // Rascunho salvo um segundo depois da última tecla
    clearTimeout(timerDisc);
    timerDisc = setTimeout(() => Store.salvar('discursivas'), 1000);
    return;
  }
  if (id !== 'busca-lei' && id !== 'busca-gloss') return;
  const pos = ev.target.selectionStart;
  if (id === 'busca-lei') { UI.busca = ev.target.value; renderLei(); } else { UI.buscaGloss = ev.target.value; renderMais(); }
  const novo = document.getElementById(id);
  if (novo) { novo.focus(); try { novo.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !document.getElementById('folha').hidden) { fecharFolha(); return; }
  if (!sessao || sessao.fim || sessao.confirmar) return;
  if (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName) && ev.target.type !== 'checkbox') return;
  if (!document.getElementById('folha').hidden) return;
  const k = ev.key.toLowerCase();
  if (sessao.modo === 'cards') {
    if (!sessao.revelado && (k === ' ' || k === 'enter')) { ev.preventDefault(); proximo(); }
    else if (sessao.revelado && ['1', '2', '3', '4'].includes(k)) avaliar(Number(k));
    return;
  }
  if (sessao.revelado) { if (k === 'enter' || k === ' ') { ev.preventDefault(); proximo(); } return; }
  const qAtual = QI.get(sessao.ids[sessao.i]);
  if (qAtual && qAtual.al) {
    const L = k.toUpperCase();
    if (k.length === 1 && LETRAS.slice(0, qAtual.al.length).includes(L)) responder(L);
    else if (sessao.modo === 'simulado' && k === 'arrowright') proximo();
    else if (sessao.modo === 'simulado' && k === 'arrowleft' && sessao.i > 0) { sessao.i--; renderSessao(); }
    return;
  }
  if (k === 'c') responder('C');
  else if (k === 'e') responder('E');
  else if (k === 'b' && sessao.modo === 'simulado') responder(BRANCO);
  else if (k === 'd' && sessao.modo !== 'relampago') { const id = sessao.ids[sessao.i]; sessao.duv[id] = !sessao.duv[id]; renderSessao(); }
  else if (sessao.modo === 'simulado' && k === 'arrowright') proximo();
  else if (sessao.modo === 'simulado' && k === 'arrowleft' && sessao.i > 0) { sessao.i--; renderSessao(); }
});
document.addEventListener('pointerover', (ev) => {
  let dica = document.getElementById('dica');
  // No toque a dica não teria como sumir: só aparece com mouse
  if (ev.pointerType && ev.pointerType !== 'mouse') { if (dica) dica.remove(); return; }
  const c = ev.target.closest && ev.target.closest('[data-dica]');
  if (!c) { if (dica) dica.remove(); return; }
  if (!dica) { dica = document.createElement('div'); dica.id = 'dica'; dica.className = 'dica'; document.body.appendChild(dica); }
  dica.textContent = c.dataset.dica;
  const r = c.getBoundingClientRect();
  dica.style.left = Math.max(8, Math.min(window.innerWidth - 200, r.left - 30)) + 'px';
  dica.style.top = (r.top - 32) + 'px';
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { contarTempo(true); guardarSessaoAberta(); Store.descarregar(); } else { ultimoTique = Date.now(); marcarUso(); } });
window.addEventListener('pagehide', () => { contarTempo(true); guardarSessaoAberta(); Store.descarregar(); });
window.addEventListener('pageshow', (e) => { if (e.persisted) ultimoTique = Date.now(); });
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => document.addEventListener(ev, marcarUso, { passive: true, capture: true }));
// Rolar dentro da folha ou da sessão também é uso: o evento de rolagem não sobe, mas passa pela captura no documento
document.addEventListener('scroll', marcarUso, { passive: true, capture: true });
setInterval(() => contarTempo(false), TIQUE_S * 1000);
setInterval(atualizarCronometro, 1000);

/* ================= Início ================= */
function iniciar(dadosQuentes) {
  if (dadosQuentes && dadosQuentes.sessao) { sessao = dadosQuentes.sessao; if (dadosQuentes.ui) Object.assign(UI, dadosQuentes.ui); }
  if (!VISTAS.includes(UI.vista)) UI.vista = 'hoje';
  // A cópia deste navegador entra antes da primeira tela: nada é desenhado (nem gravado) com o progresso zerado
  if (!Store.localLido) Store.carregarLocal();
  renderTudo();
  if (sessao) abrirSessao();
  Store.iniciar();
}
const hot = window.claude && window.claude.hot;
if (hot && typeof hot.snapshot === 'function') {
  try { hot.snapshot(() => ({ sessao: sessao && !sessao.fim ? sessao : null, ui: { vista: UI.vista, artSel: UI.artSel, mais: UI.mais } })); } catch (e) { /* opcional */ }
}
if (hot && typeof hot.ready === 'function') hot.ready(iniciar);
else iniciar(hot && hot.data ? hot.data : {});
})();
