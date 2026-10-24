(async function () {
'use strict';

// Fontes do Google pelo script, sem bloquear: como <link> no topo, o navegador só rodaria o painel depois de baixar o
// CSS delas (no celular com rede lenta, a abertura esperava a rede). Até chegarem, vale a fonte de reserva.
{ const f = document.createElement('link'); f.rel = 'stylesheet'; f.href = 'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap'; document.head.appendChild(f); }

/* ================= Dados embutidos ================= */
// O build grava o pacote em gzip e base64 (scripts/build.mjs): o arquivo cai de ~10 MB para ~3 MB
async function lerDados() {
  const el = document.getElementById('dados');
  const b64 = el.textContent.trim();
  el.remove();
  // Decodificação nativa onde houver (mais rápida); senão, atob byte a byte
  let u;
  if (typeof Uint8Array.fromBase64 === 'function') u = Uint8Array.fromBase64(b64);
  else { const bin = atob(b64); u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); }
  return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
if (typeof DecompressionStream !== 'function') {
  document.body.insertAdjacentHTML('afterbegin', '<p style="padding:16px">Este navegador é antigo demais para abrir o painel. Atualize o Chrome, o Safari (16.4 ou mais novo) ou o Firefox.</p>');
  return;
}
const D = JSON.parse(await lerDados());
// O pacote chega enxuto (scripts/build.mjs, empacotar); aqui volta à forma completa antes de qualquer uso
const TEXTO_ART = new Map();
for (const [id, l] of Object.entries(D.lei || {})) {
  let est = [];
  for (const a of l.artigos) { if (a.estrutura) est = a.estrutura; else a.estrutura = est; if (!a.rotulo) a.rotulo = 'Art. ' + a.id; TEXTO_ART.set(id + ':' + a.id, a.texto); }
}
const TAB = D.tab || {};
function deTabela(o) { for (const k in TAB) if (typeof o[k] === 'number') o[k] = TAB[k][o[k]]; }
for (const q of D.questoes) {
  deTabela(q);
  if (q.art === undefined) q.art = null;
  // Trecho guardado como [início, tamanho] no texto do artigo
  q.t = (q.t || []).map((t) => (Array.isArray(t) ? (TEXTO_ART.get(q.l + ':' + q.art) || '').slice(t[0], t[0] + t[1]) : t));
}
for (const c of D.cloze || []) deTabela(c);
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
// Cada item vale 1 ponto, básico ou específico, como no edital da Anatel 2024 (item 8.11.2): é a hipótese do plano até sair o edital.
// Regulação aparece nas duas partes: Lei 13.848 e Lei 9.784 na básica, teoria da regulação na específica.
// Quando o edital sair, a pessoa troca itens, pesos, régua de corte e data da prova em Mais → Ajustes → Edital e prova
// (perfil.edital); o padrão é esta projeção. aplicarEdital refaz as tabelas derivadas a cada desenho da tela.
const PADRAO_EDITAL = {
  basica: { linguas: 21, direito: 19, regulacao: 10 },
  especifica: { regulacao: 4, lgpd: 36, eca: 8, seginfo: 8, gestao: 6, contabil: 2, comparado: 3, economia: 3 },
  pesoB: 1, pesoE: 1,
  // Régua do edital da Anatel 2024: líquida mínima na básica, na específica e no conjunto
  cortes: { p1: 10, p2: 21, total: 36 },
};
const REG_NA_BASICA = new Set(['lei-13848', 'lei-9784']);
const PROVA_BASICA = {}, PROVA_ESPECIFICA = {}, ITENS_PROVA = {}, PONTOS_DISC = {}, CORTES = {};
let PESO_BASICA = 1, PESO_ESPECIFICA = 1, TOTAL_PROVA = 0, PONTOS_PROVA = 0;
function aplicarEdital(ed) {
  ed = ed || {};
  const troca = (alvo, novo) => { for (const k of Object.keys(alvo)) delete alvo[k]; Object.assign(alvo, novo); };
  troca(PROVA_BASICA, ed.basica || PADRAO_EDITAL.basica);
  troca(PROVA_ESPECIFICA, ed.especifica || PADRAO_EDITAL.especifica);
  troca(CORTES, Object.assign({}, PADRAO_EDITAL.cortes, ed.cortes || {}));
  PESO_BASICA = Number(ed.pesoB) > 0 ? Number(ed.pesoB) : PADRAO_EDITAL.pesoB;
  PESO_ESPECIFICA = Number(ed.pesoE) > 0 ? Number(ed.pesoE) : PADRAO_EDITAL.pesoE;
  troca(ITENS_PROVA, {});
  for (const parte of [PROVA_BASICA, PROVA_ESPECIFICA]) for (const [d, k] of Object.entries(parte)) ITENS_PROVA[d] = (ITENS_PROVA[d] || 0) + k;
  TOTAL_PROVA = Object.values(ITENS_PROVA).reduce((a, b) => a + b, 0);
  troca(PONTOS_DISC, {});
  for (const [d, k] of Object.entries(PROVA_BASICA)) PONTOS_DISC[d] = (PONTOS_DISC[d] || 0) + k * PESO_BASICA;
  for (const [d, k] of Object.entries(PROVA_ESPECIFICA)) PONTOS_DISC[d] = (PONTOS_DISC[d] || 0) + k * PESO_ESPECIFICA;
  PONTOS_PROVA = Object.values(PONTOS_DISC).reduce((a, b) => a + b, 0);
}
aplicarEdital();
// Data da prova: a do edital, quando a pessoa a informa em Ajustes; antes disso, a estimativa do cronograma
function dataProva() { return (S.perfil.edital && S.perfil.edital.prova) || D.cronograma.prova; }
// Simulado da prova inteira: 1,75 min por item (os 120 da Anatel 2024 em 3h30)
function minutosProva() { return Math.round(TOTAL_PROVA * 1.75); }
function duracaoProva() { const m = minutosProva(); return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); }
// Parte da prova em que o item cairia: 'b' (básica) ou 'e' (específica)
function somaItens(parte) { return Object.values(parte).reduce((a, b) => a + b, 0); }
function parteProva(q) {
  const d = (BI.get(q.b) || {}).disciplina;
  if (PROVA_BASICA[d] > 0 && PROVA_ESPECIFICA[d] > 0) return REG_NA_BASICA.has(q.b) ? 'b' : 'e';
  return PROVA_BASICA[d] > 0 ? 'b' : 'e';
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
// Itens reais do Cebraspe, a banca projetada: os de outras bancas treinam, mas não medem a prontidão
const REAIS = Q.filter((q) => q.o && /cebraspe|cespe/i.test(q.pv || ''));
// Reserva de medida: ~40% dos itens reais (sorteio fixo pelo id) ficam fora do treino e só aparecem em simulado, para
// que perto da prova ainda haja itens reais intocados para medir a prontidão em condição de prova. Os outros entram no
// treino com cota mínima (REAIS_TREINO) entre os itens novos, porque o banco é mais fácil que a prova.
const RESERVA_MEDIDA = new Set(REAIS.filter((q) => hashTxt('reserva:' + q.id) % 10 < 4).map((q) => q.id));
const REAIS_TREINO = 1 / 3;
// Discursiva: temas com quesitos; a linha manuscrita da folha de texto definitivo é estimada em 70 caracteres
const TEMAS_DISC = (D.discursivas && D.discursivas.temas) || [];
const CARACTERES_LINHA = 70;

// 40 níveis com degraus crescentes: os primeiros saem no primeiro dia. Num ritmo de 10 mil XP por semana,
// Diretor(a)-Presidente chega uns dois meses antes da prova; depois dele, cada mandato pede MANDATO_XP (cerca de uma
// semana), e as conquistas de XP e ritmo seguem até 250 mil.
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
  { g: 'q', id: 'metade', ic: '½', nome: 'Meio banco', desc: 'Respondeu metade dos itens diferentes do banco.' },
  { g: 'q', id: 'certeiro', ic: '90%', nome: 'Dia certeiro', desc: '90% de acerto em 30 ou mais itens no mesmo dia.' },
  { g: 'q', id: 'reais50', ic: 'CB', nome: 'Cara a cara com a banca', desc: 'Respondeu 50 itens reais de prova.' },
  { g: 'q', id: 'reais300', ic: 'CB+', nome: 'Veterano(a) de prova', desc: 'Respondeu 300 itens reais de prova.' },
  { g: 'q', id: 'casca', ic: 'D3', nome: 'Casca grossa', desc: 'Dominou 50 itens de dificuldade alta.' },
  { g: 'q', id: 'calibrado', ic: '?', nome: 'Bem calibrado', desc: 'Marcou dúvida em 20 itens. Agora você sabe quando chutar.' },
  { g: 'c', id: 'meta', ic: 'M', nome: 'Meta batida', desc: 'Cumpriu a meta diária de itens.' },
  { g: 'c', id: 'meta10', ic: 'M10', nome: 'Meta é rotina', desc: 'Cumpriu a meta diária em 10 dias.' },
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
  { g: 'c', id: 'roteiro', ic: '5/5', nome: 'Roteiro completo', desc: 'Fechou todos os passos do roteiro de um dia.' },
  { g: 'c', id: 'roteiro7', ic: '7×', nome: 'Semana de roteiros', desc: 'Fechou o roteiro completo em 7 dias.' },
  { g: 'c', id: 'recuperacao', ic: '↺', nome: 'Nada fica para trás', desc: 'Terminou uma sessão de recuperação do atraso do plano.' },
  { g: 'c', id: 'semanas4', ic: '4×', nome: 'Ritmo de cruzeiro', desc: '4 semanas seguidas com 5.000 XP ou mais.' },
  { g: 'c', id: 'semanas12', ic: '12×', nome: 'Ritmo de prova', desc: '12 semanas seguidas com 5.000 XP ou mais.' },
  { g: 'l', id: 'lei20', ic: '§', nome: 'Lei seca', desc: 'Abriu 20 artigos no leitor da lei seca.' },
  { g: 'l', id: 'lei100', ic: '§100', nome: 'Cem artigos', desc: 'Abriu 100 artigos no leitor da lei seca.' },
  { g: 'l', id: 'lei500', ic: '§500', nome: 'Biblioteca de normas', desc: 'Abriu 500 artigos no leitor da lei seca.' },
  { g: 'l', id: 'leitodas', ic: '§§', nome: 'Lei inteira', desc: 'Abriu todos os artigos da LGPD no leitor.' },
  { g: 'l', id: 'cards50', ic: 'C', nome: 'Cinquenta lacunas', desc: 'Revisou 50 cards cloze.' },
  { g: 'l', id: 'cards300', ic: 'C3', nome: 'Lei na ponta da língua', desc: 'Revisou 300 cards cloze.' },
  { g: 'l', id: 'lista25', ic: 'LC', nome: 'Lista curta', desc: 'Tirou 25 itens da lista de erros.' },
  { g: 'l', id: 'lista100', ic: 'LC+', nome: 'Erro que não volta', desc: 'Tirou 100 itens da lista de erros.' },
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

