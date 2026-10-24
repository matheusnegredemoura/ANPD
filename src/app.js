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
const REAIS_TREINO = 0.25;
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
const CAMPOS_UI = ['modo', 'n', 'filtro', 'prova', 'blocos', 'blocosCards', 'camadas', 'lei', 'tema', 'som', 'foco'];
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
  // Discursiva: fica o rascunho mais novo que não esteja vazio (um aparelho com o texto em branco não apaga o do outro)
  // e a lista de tentativas mais longa
  if (n === 'discursivas') return { d: mesclarMapa(velho.d, novo.d, (a, b) => {
    const ras = b && b.rascunho && b.rascunho.trim() ? b.rascunho : (a && a.rascunho) || '';
    const tA = (a && a.tentativas) || [], tB = (b && b.tentativas) || [];
    return Object.assign({}, a, b, { rascunho: ras, tentativas: tB.length >= tA.length ? tB : tA });
  }) };
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
  // Dia, aula ou discursiva dados como feitos num aparelho continuam feitos no outro
  p.feitos = Object.assign({}, velho.feitos, novo.feitos);
  p.cad = mesclarCad(velho.cad, novo.cad);
  p.lidos = mesclarMapa(nuvem.lidos, local.lidos, (a, b) => (b < a ? b : a));
  p.recordes = mesclarMapa(nuvem.recordes, local.recordes, (a, b) => Math.max(num(a), num(b)));
  p.criado = [nuvem.criado, local.criado].filter(Boolean).sort()[0] || hojeISO();
  if (!p.ui && velho.ui) p.ui = velho.ui;
  p.rpg = mesclarRPG(velho.rpg, novo.rpg);
  return p;
}
// Caderno de erros: a anotação mais recente de cada questão e as metas da semana marcadas em qualquer aparelho
function mesclarCad(velho, novo) {
  if (!velho && !novo) return undefined;
  velho = velho || {}; novo = novo || {};
  const r = Object.assign({}, velho, novo);
  r.erros = mesclarMapa(velho.erros, novo.erros, (a, b) => ((a.data || '') > (b.data || '') ? a : b));
  r.checkSem = mesclarMapa(velho.checkSem, novo.checkSem, (a, b) => Object.assign({}, a, b));
  return r;
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
  if (!S.perfil.dias[iso]) S.perfil.dias[iso] = { r: 0, c: 0, e: 0, b: 0, xp: 0, k: 0, n: 0, a: [], t: {} };
  const d = S.perfil.dias[iso];
  if (d.k == null) d.k = 0;
  if (d.n == null) d.n = 0;
  if (!d.a || !Array.isArray(d.a) || !Object.isExtensible(d.a)) d.a = Array.from(d.a || []);
  if (!d.t || typeof d.t !== 'object' || !Object.isExtensible(d.t)) d.t = Object.assign({}, d.t || {});
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
// Ritmo pessoal: medianas dos dias de estudo das duas últimas semanas, sem contar hoje (itens respondidos, itens inéditos,
// artigos lidos e minutos de estudo; cada mediana só conta os dias em que aquilo aconteceu). Com menos de 5 dias de estudo
// não há ritmo e valem os valores fixos. A meta automática e as missões do dia partem dele, então sobem com a pessoa.
let ritmoCache = null;
function ritmo() {
  const h = hojeISO(), chave = h + '|' + Object.keys(S.perfil.dias || {}).length;
  if (ritmoCache && ritmoCache.chave === chave) return ritmoCache.v;
  const mediana = (xs) => { const o = xs.filter((x) => x > 0).sort((a, b) => a - b); return o.length ? o[Math.floor((o.length - 1) / 2)] : 0; };
  const desde = isoDeNum(HOJE() - 14);
  const dias = Object.entries(S.perfil.dias || {}).filter(([iso]) => iso >= desde && iso < h && ativo(iso)).map(([, d]) => d);
  const v = dias.length < 5 ? null : {
    r: mediana(dias.map((d) => d.r || 0)), ni: mediana(dias.map((d) => d.ni || 0)),
    a: mediana(dias.map((d) => (d.a || []).length)), min: Math.round(mediana(dias.map((d) => segundosEstudo(d) / 60))),
    s: mediana(dias.map((d) => (d.r && d.t && d.t.q ? d.t.q / d.r : 0))),
  };
  ritmoCache = { chave, v };
  return v;
}
// Horas de estudo por semana: a média das duas últimas semanas inteiras (null com menos de 5 dias de estudo nelas)
function horasSemana() {
  const desde = isoDeNum(HOJE() - 14), h = hojeISO();
  const dias = Object.entries(S.perfil.dias || {}).filter(([iso]) => iso >= desde && iso < h);
  if (dias.filter(([iso]) => ativo(iso)).length < 5) return null;
  return dias.reduce((a, [, d]) => a + segundosEstudo(d), 0) / 2 / 3600;
}
const limitar = (x, min, max) => Math.min(max, Math.max(min, x));
// Meta diária de itens: automática (90% da mediana do ritmo, de 10 em 10, entre 20 e 200) ou a fixa escolhida em Ajustes
function metaAuto() { const r = ritmo(); return r && r.r ? limitar(Math.round((r.r * 0.9) / 10) * 10, 20, 200) : null; }
function metaDia() { return (!S.perfil.metaFixa && metaAuto()) || S.perfil.meta || 30; }
// Questões do tema (Passo 2 do roteiro, ~15 min): quantas cabem em 15 min no tempo por item medido, de 5 em 5, entre 8 e 20
function nPreTeste() { const r = ritmo(); return r && r.s ? limitar(Math.round(900 / r.s / 5) * 5, 8, 20) : 8; }
// Artigos de leitura por dia: a mediana dos dias com leitura, entre 6 e 12 (6 sem ritmo)
function metaArtigos() { const r = ritmo(); return r && r.a ? limitar(r.a, 6, 12) : 6; }
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
  return tetoProva(r[0] < 2 ? base : Math.max(1, Math.round(base * fatorItem(r) * fatorPessoa())));
}
// Perto da prova, nenhuma revisão fica marcada para depois dela: o prazo para dois dias antes (o último fim de semana
// de revisão); com a prova a dois dias ou menos, ou já passada, o intervalo segue normal
function tetoProva(ivl) {
  const falta = diaNum(dataProva()) - HOJE() - 2;
  return falta >= 1 ? Math.min(ivl, falta) : ivl;
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
  if (!d.metaOk && d.r >= metaDia()) { d.metaOk = 1; ganharXP(50); avisar('M', 'Meta do dia cumprida', '+50 XP de bônus'); conquistar('meta'); }
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
  se(t.r >= 1, 'primeira'); se(t.r >= 100, 'r100'); se(t.r >= 500, 'r500'); se(t.r >= 1000, 'r1000');
  se(t.k >= 50, 'cards50'); se(t.k >= 300, 'cards300');
  const seq = sequencia();
  if (seq > (S.perfil.melhorSeq || 0)) S.perfil.melhorSeq = seq;
  se(seq >= 7, 'seq7'); se(seq >= 14, 'seq14'); se(seq >= 30, 'seq30'); se(seq >= 60, 'seq60'); se(seq >= 100, 'seq100');
  // Dias: estudo, meta, recordes do dia, manutenção, roteiro, recuperação e tempo
  let ativos = 0, metas = 0, manut = 0, roteiros = 0, seg = 0;
  const xpSem = {};
  for (const [iso, d] of Object.entries(S.perfil.dias)) {
    const sem = isoDeNum(diaNum(iso) - ((diaSemana(iso) + 6) % 7));
    xpSem[sem] = (xpSem[sem] || 0) + (d.xp || 0);
    if (ativo(iso)) ativos++;
    if (d.metaOk) metas++;
    manut += d.m || 0;
    if (d.rt) roteiros++;
    if (d.pd) conquistar('recuperacao');
    if (d.r >= 30 && d.c / d.r >= 0.9) conquistar('certeiro');
    const s = segundosEstudo(d);
    seg += s;
    se(s >= 3600, 'hora1'); se(s >= 3 * 3600, 'hora3');
    // Domingo estudado com o sábado anterior também estudado
    if (!tem('fds') && diaSemana(iso) === 0 && ativo(iso) && ativo(isoDeNum(diaNum(iso) - 1))) conquistar('fds');
  }
  se(ativos >= 30, 'dias30'); se(ativos >= 100, 'dias100');
  se(metas >= 10, 'meta10');
  se(manut >= 50, 'memoria50'); se(roteiros >= 7, 'roteiro7'); se(seg >= 100 * 3600, 'horas100');
  // XP por semana (de segunda a domingo) e a maior série de semanas seguidas com 5.000 XP ou mais
  let serie = 0, melhorSerie = 0;
  const sems = Object.keys(xpSem).sort();
  if (sems.length) for (let n = diaNum(sems[0]); n <= HOJE(); n += 7) { serie = (xpSem[isoDeNum(n)] || 0) >= 5000 ? serie + 1 : 0; melhorSerie = Math.max(melhorSerie, serie); }
  se(melhorSerie >= 4, 'semanas4'); se(melhorSerie >= 12, 'semanas12');
  se(S.simulados.length >= 1, 'sim1'); se(S.simulados.length >= 5, 'sim5');
  se(S.simulados.some((s) => s.n >= 30 && s.liq / s.n >= 0.7), 'sim70');
  se(S.simulados.some((s) => s.n >= 30 && s.liq / s.n >= 0.8), 'sim80');
  se(S.simulados.some((s) => s.n >= Math.min(120, TOTAL_PROVA)), 'prova120');
  const lidos = Object.keys(S.perfil.lidos || {}).length;
  se(lidos >= 20, 'lei20'); se(lidos >= 100, 'lei100'); se(lidos >= 500, 'lei500');
  if (!tem('leitodas') && ARTS.length && ARTS.every((a) => (S.perfil.lidos || {})[a.k])) conquistar('leitodas');
  const saidos = S.perfil.saidos || 0;
  se(saidos >= 25, 'lista25'); se(saidos >= 100, 'lista100');
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
  se(reais >= 50, 'reais50'); se(reais >= 300, 'reais300'); se(dificeis >= 50, 'casca');
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
  // "Errei" (intervalo 0) volta no fim da própria sessão e, depois, amanhã. O intervalo guardado segue crescendo;
  // só o vencimento para antes da prova
  return [HOJE() + tetoProva(Math.max(1, ivl)), ivl, ease, reps, lapses, HOJE()];
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
  // Prazos, números e quóruns entram antes: é o dado arbitrário que o card fixa melhor; conceito se treina com questão
  return CARDS.filter((c) => (!set || set.has(c.nota.b)) && cardNovo(c.id)).sort((a, b) => (b.nota.nu || 0) - (a.nota.nu || 0));
}
const REV_MAX = 60;
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
// Palavras de polaridade (restringem, generalizam ou excepcionam) grifadas no enunciado depois da resposta: é onde o
// Cebraspe costuma mexer. Antes da resposta, nada é grifado, para o grifo não virar pista. Só toca o texto fora das tags.
const RE_POLARIDADE = /\b(exclusivamente|somente|apenas|unicamente|sempre|nunca|jamais|qualquer|tod[oa]s?|nenhum[a]?|salvo|exceto|desde que|ainda que|mesmo que|independentemente|vedad[oa]s?|obrigatoriamente|necessariamente|em hipótese alguma|privativ[oa]s?|exclusiv[oa]s?|automaticamente|integralmente)\b/gi;
function marcarPolaridade(html) { return html.split(/(<[^>]+>)/).map((x) => (x.startsWith('<') ? x : x.replace(RE_POLARIDADE, '<span class="g-alerta">$&</span>'))).join(''); }
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
// Itens dos blocos escolhidos (todos, se nenhum tem itens). O filtro de banca e formato vale só para as sessões montadas
// na aba Questões: o plano do dia, a recuperação e as trilhas usam o banco inteiro
const FILTROS_BANCA = {
  cebraspe: (q) => !q.al,
  reais: (q) => !!q.o,
  ineditas: (q) => !q.o,
  multipla: (q) => !!q.al,
};
function poolDe(blocos, banca) {
  const disp = (blocos || []).filter((b) => (POR_BLOCO.get(b) || []).length);
  const set = disp.length ? new Set(disp) : null;
  const base = set ? Q.filter((q) => set.has(q.b)) : Q.slice();
  const f = FILTROS_BANCA[banca];
  const filtrada = f ? base.filter(f) : base;
  return filtrada.length ? filtrada : base;
}
function selecionar(pool, n, filtro) {
  const hoje = HOJE();
  const venc = [], novas = [], lista = [], domV = [], resto = [];
  for (const q of pool) {
    const r = rec(q.id);
    if (!r || r[0] < 0) { if (!RESERVA_MEDIDA.has(q.id)) novas.push(q); }
    else if (SEM_REPETICAO.has(q.id)) resto.push(q);
    else if (r[0] < 3 && r[1] <= hoje) venc.push(q);
    else if (r[0] < 3) lista.push(q);
    else if (r[1] <= hoje) domV.push(q);
    else resto.push(q);
  }
  embaralhar(venc); embaralhar(lista);
  // Inéditas com pelo menos REAIS_TREINO de itens reais (ou a proporção natural do bloco, se for maior), intercalados
  {
    const reaisN = embaralhar(novas.filter((q) => q.o)), bancoN = embaralhar(novas.filter((q) => !q.o));
    const alvo = Math.max(REAIS_TREINO, reaisN.length / (novas.length || 1));
    novas.length = 0;
    for (let i = 0; reaisN.length || bancoN.length; i++) {
      const vezReal = Math.floor((i + 1) * alvo) > Math.floor(i * alvo);
      novas.push((vezReal && reaisN.length) || !bancoN.length ? reaisN.shift() : bancoN.shift());
    }
  }
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
  return 6; // 6 itens rápidos para caber nos 10 min do Passo 7 da rotina de 1h30
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
    const extra = (POR_APOIO.get(ap) || []).filter((x) => !usados.has(x.id) && !rec(x.id) && !RESERVA_MEDIDA.has(x.id) && (!soBlocos || soBlocos.has(x.b))).slice(0, Math.max(0, k));
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
    // Itens sem texto preenchem o resto: revisões primeiro, depois os reais inéditos (a cota de reais do treino não se perde
    // quando os textos ocupam vagas), depois os do banco
    const semTexto = itens.filter((q) => q.ap == null), vistosST = semTexto.filter((q) => rec(q.id)), novosST = semTexto.filter((q) => !rec(q.id));
    const vagas = Math.max(0, itens.length - total);
    const ficam = new Set(vistosST.concat(novosST.filter((q) => q.o), novosST.filter((q) => !q.o)).slice(0, Math.max(vagas, vistosST.length)).map((q) => q.id));
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
      sessao.batalha ? { cor: sessao.coracoes, dano: sessao.danoTotal || 0, crit: sessao.criticos || 0, cmb: sessao.comboMax, per: sessao.perdas || 0, def: sessao.defesas || 0 } : {});
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
    if (sessao.batalha && p.cor != null) { sessao.coracoes = Math.max(1, Math.min(p.cor, sessao.coracoesMax)); sessao.danoTotal = p.dano || 0; sessao.criticos = p.crit || 0; sessao.comboMax = p.cmb || 0; sessao.perdas = p.per || 0; sessao.defesas = p.def || 0; }
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
    // Teto de revisões por sessão para a fila não engolir o tempo das questões; com a fila cheia, não entram novos
    const todosVenc = cardsVencidos(cfg.blocos), venc = todosVenc.slice(0, cfg.maxRev || REV_MAX);
    const novos = cfg.soRevisao || todosVenc.length >= REV_MAX ? [] : cardsNovos(cfg.blocos).slice(0, Math.min(novosRestantesHoje(), cfg.novos == null ? 20 : cfg.novos));
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
  else itens = selecionar(poolDe(cfg.blocos, cfg.banca), cfg.n || 20, cfg.filtro || 'mistas');
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
    modo: cfg.modo, st: cfg.st || null, tipoSubtema: cfg.tipoSubtema || null, titulo: cfg.titulo || tituloModo(cfg.modo), dia: cfg.dia || null, ids, i: 0,
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
  sincronizarHistorico();
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
  sincronizarHistorico();
}
// Voltar do celular fecha a camada aberta (folha, depois sessão) em vez de sair do painel; a sessão fica guardada
let camadaNoHistorico = false;
function camadaAberta() { return !document.getElementById('folha').hidden || !document.getElementById('sessao').hidden; }
function sincronizarHistorico() {
  try {
    if (camadaAberta() && !camadaNoHistorico) { history.pushState({ camada: 1 }, ''); camadaNoHistorico = true; }
    else if (!camadaAberta() && camadaNoHistorico) { camadaNoHistorico = false; history.back(); }
  } catch (e) { /* histórico indisponível: fecha só pelo botão */ }
}
window.addEventListener('popstate', () => {
  if (!camadaNoHistorico) return;
  camadaNoHistorico = false;
  if (!document.getElementById('folha').hidden) fecharFolha();
  else if (!document.getElementById('sessao').hidden) fecharSessao();
  sincronizarHistorico();
});
function decorrido() { return (Date.now() - sessao.ini) / 1000; }
// Tempo no item (treino, revisão e batalha): conta do item aparecer até a resposta. Passa a avisar acima do ritmo de
// prova, RITMO_PROVA_S por item (120 itens objetivos em cerca de 3 h, sobrando tempo para a discursiva; hipótese até o
// edital). O relâmpago e o simulado têm relógio próprio.
const RITMO_PROVA_S = 90;
function comTempoItem() { return sessao && !['simulado', 'relampago', 'cards'].includes(sessao.modo); }
function segItem() { const id = sessao.ids[sessao.i], t = (sessao.tempos || {})[id]; return t != null ? t : Math.round((Date.now() - (sessao.itemIni || Date.now())) / 1000); }
function htmlTempoItem() {
  const s = segItem();
  return '<span class="t-item mono' + (s > RITMO_PROVA_S ? ' lento' : '') + '" id="t-item" title="Tempo neste item; ritmo de prova: até ' + fmtTempo(RITMO_PROVA_S) + '">' + fmtTempo(s) + '</span>';
}
function tique() {
  if (!sessao || sessao.fim) return;
  const el = document.getElementById('relogio');
  if (sessao.limite) {
    const resta = sessao.limite - decorrido();
    if (resta <= 0) { finalizar(); return; }
    if (el) { el.textContent = fmtTempo(resta); el.classList.toggle('urgente', resta <= 15 || (sessao.modo === 'simulado' && resta <= 300)); }
  } else if (el) el.textContent = fmtTempo(decorrido());
  const ti = document.getElementById('t-item');
  if (ti && comTempoItem() && !sessao.revelado) { const s = segItem(); ti.textContent = fmtTempo(s); ti.classList.toggle('lento', s > RITMO_PROVA_S); }
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
  if (sessao.revelado || sessao.flash) return;
  if (comTempoItem() && sessao.itemIni) (sessao.tempos ||= {})[id] = Math.round((Date.now() - sessao.itemIni) / 1000);
  if (resp === BRANCO) { defender(q, id); return; }
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
// Em branco no treino é defesa, como na prova (1 errada anula 1 certa): não perde coração nem quebra o combo,
// ganha pouco XP, o item volta na revisão e o comentário abre para aprender
function defender(q, id) {
  registrar(q, BRANCO, !!sessao.duv[id]);
  sessao.golpe = null;
  sessao.virada = null;
  sessao.resp[id] = BRANCO;
  sessao.defesas = (sessao.defesas || 0) + 1;
  sessao.xp += 2;
  ganharXP(2);
  sessao.ultimoGanho = 2;
  atualizarPausa();
  Store.salvar('perfil', 'itens');
  sessao.revelado = true;
  renderSessao();
}
function avaliar(nota) {
  if (!sessao || sessao.modo !== 'cards' || !sessao.revelado || (sessao.digOk === false && nota >= 3)) return;
  const id = sessao.ids[sessao.i];
  sessao.dig = ''; sessao.digOk = null;
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
  if (sessao.modo === 'cards') {
    if (!sessao.revelado) {
      const c = CI.get(sessao.ids[sessao.i]), campo = document.getElementById('card-digitar');
      sessao.dig = campo ? campo.value.trim() : '';
      sessao.digOk = c ? confereDigitado(sessao.dig, lacunaDoCard(c.nota, c.n)) : null;
      sessao.revelado = true;
      renderSessao();
    }
    return;
  }
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
    // pt: nota ponderada (cada item no seu peso); nr/cr: itens reais de prova respondidos e acertados
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
  if (/ResizeObserver|Script error|chrome-extension|moz-extension|safari-extension|frame\.claudeusercontent/i.test(msg)) return;
  const linha = (onde ? onde + ': ' : '') + msg;
  if (ERROS.some((x) => x.m === linha)) return;
  const pilha = String((e && e.stack) || '').split('\n').slice(0, 4).map((x) => x.trim()).join(' | ').slice(0, 400);
  console.warn('[Painel ANPD]', linha, pilha);
  ERROS.unshift({ m: linha, p: pilha, t: new Date().toISOString(), v: D.versao, ua: String(navigator.userAgent || '').slice(0, 160) });
  ERROS.length = Math.min(ERROS.length, 5);
  try { S.perfil.erros = ERROS.slice(); Store.salvar('perfil'); } catch (x) { /* sem gravação */ }
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




// "Recomeçar do zero" apaga a sessão guardada: vai em "extra" do passo, que o roteiro mostra e o cartão do topo não
function botaoRecomecar(k) { return pausaDe(k) ? '<button class="btn pequeno" data-acao="descartar-pausa" data-k="' + esc(k) + '">Recomeçar do zero</button>' : ''; }
function roteiroHoje() {
  const ctx = contextoHoje();
  const dia = ctx.tipo === 'dia' ? ctx.dia : null;
  const d = diaLog();
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
  const stPlano = dia && dia.modo === 'treino' ? stDoDia(dia) : null;
  const stH = stPlano || subtemaDoDia();
  const dd = discDeHoje();
  const chaveInt = 'i:' + hojeISO();

  const passos = [];

  // Passo 1: Revisão Espaçada (~10 min)
  const revFeita = venc === 0 && manut === 0 && cardsV === 0;
  passos.push({
    titulo: '1. Revisão espaçada (~10 min)',
    feito: revFeita,
    texto: (venc || manut || cardsV)
      ? [venc ? pl(venc, 'questão da lista curta', 'questões da lista curta') : '', manut ? pl(manut, 'item de manutenção', 'itens de manutenção') : '', cardsV ? pl(cardsV, 'card vencido', 'cards vencidos') : ''].filter(Boolean).join(' e ') + ' prontos para ativar a memória de curto prazo.'
      : 'Memória em dia! Nenhum item pendente de revisão para agora.',
    botoes: (venc + manut ? '<button class="btn pequeno primario" data-acao="iniciar-revisao">Revisar questões (' + (venc + manut) + ')</button>' : '') +
            (cardsV ? '<button class="btn pequeno' + (venc + manut ? '' : ' primario') + '" data-acao="cards-revisao">Revisar cards (' + cardsV + ')</button>' : '')
  });

  // Passo 2: Questões do Tema / Pré-teste (~15 min)
  let qTemaFeita = false;
  let qTemaBtns = '';
  let qTemaTxt = '';
  if (dia) {
    qTemaFeita = !!S.perfil.feitos[dia.data];
    const nDia = nItensDoDia(dia);
    qTemaTxt = dia.modo === 'simulado'
      ? 'Simulado do dia: ' + nDia + ' itens, com tempo e nota líquida.'
      : nDia + ' questões para achar os pontos cegos do tema (' + esc((dia.blocos || []).map(nomeBloco).join(', ')) + ').';
    qTemaBtns = '<button class="btn pequeno primario" data-acao="iniciar-dia" data-dia="' + dia.data + '">' +
      esc(rotuloPausa(dia.data, (qTemaFeita ? 'Outra rodada' : 'Resolver questões') + ' · ' + nDia + ' itens')) + '</button>';
  } else {
    qTemaFeita = !!S.perfil.feitos['r:' + hojeISO()];
    const n = nPreTeste();
    qTemaTxt = 'Sem sessão programada hoje: ' + n + ' questões para medir o nível nos blocos centrais.';
    qTemaBtns = '<button class="btn pequeno primario" data-acao="treino-rapido" data-n="' + n + '" data-pre="1">Treino rápido (' + n + ' itens)</button>';
  }
  passos.push({
    titulo: '2. Questões do tema (~15 min)',
    feito: qTemaFeita,
    texto: qTemaTxt,
    botoes: qTemaBtns,
    extra: dia ? botaoRecomecar(dia.data) : ''
  });

  // Dias perdidos do plano: a recuperação entra logo depois das questões do dia
  const rec = proximaRecuperacao(), atrasados = blocosAtrasados();
  if (rec) passos.push({ titulo: 'Recuperar o atraso', feito: !!S.perfil.feitos['rec:' + hojeISO()],
    texto: rec.falta.map((f) => nomeBloco(f.b)).join(', ') + (atrasados.length > rec.falta.length ? ' (depois, mais ' + pl(atrasados.length - rec.falta.length, 'matéria', 'matérias') + ')' : '') + '.',
    botoes: botaoRecuperar() });

  // Passo 3: Lei Seca com Grifos (~15 min)
  const metaLeitura = arts.length ? Math.min(arts.length, metaArtigos()) : 0;
  const leiFeita = arts.length ? lidosHoje >= metaLeitura : (d.a || []).length >= 3;
  passos.push({
    titulo: '3. Lei seca com grifos (~15 min)',
    feito: leiFeita,
    texto: arts.length
      ? 'Leitura atenta dos ' + metaLeitura + ' artigos prioritários com grifos de prazos, verbos e exceções (' + lidosHoje + ' de ' + metaLeitura + ' lidos hoje).'
      : 'Consulte os artigos das normas com destaque para armadilhas Cebraspe.',
    botoes: stPlano ? '<button class="btn pequeno' + (!leiFeita && qTemaFeita ? ' primario' : '') + '" data-acao="st-lei" data-st="' + esc(stPlano.id) + '">Ler os artigos</button>'
      : arts.length
      ? '<button class="btn pequeno' + (!leiFeita && qTemaFeita ? ' primario' : '') + '" data-acao="ler-dia">Ler artigos (' + lidosHoje + '/' + metaLeitura + ')</button>'
      : '<button class="btn pequeno" data-acao="ir" data-vista="lei">Abrir legislação</button>'
  });

  // Passo 4: Aula da Trilha & Jurisprudência (~15 min)
  const aulaFeita = !!S.perfil.feitos['aula:' + hojeISO()] || (dia && !!S.perfil.feitos['aula:' + dia.data]);
  passos.push({
    titulo: '4. Aula da trilha & jurisprudência (~15 min)',
    feito: aulaFeita,
    texto: stH
      ? esc(nomeTrilha(stH.trilha) || 'Trilha do zero') + ': ' + esc(stH.nome) + '. Mapa mental, exemplos e as armadilhas da banca.'
      : 'Sem subtema para hoje: abra uma aula das Trilhas do zero.',
    botoes: stPlano ? '<button class="btn pequeno' + (leiFeita && !aulaFeita ? ' primario' : '') + '" data-acao="st-aula" data-st="' + esc(stPlano.id) + '">Abrir a aula</button>'
      : stH ? '<button class="btn pequeno' + (leiFeita && !aulaFeita ? ' primario' : '') + '" data-acao="aula-folha" data-st="' + esc(stH.id) + '" data-marca="1">Abrir aula da trilha</button>' : '<button class="btn pequeno" data-acao="mais" data-sub="trilha">Trilhas do zero</button>'
  });

  // Passo 5: Fixação Prática (~10 min)
  const chT = 't:' + hojeISO();
  const fixFeita = !!S.perfil.feitos[chT];
  passos.push({
    titulo: '5. Fixação prática (~10 min)',
    feito: fixFeita,
    texto: '5 itens práticos para aplicar os artigos lidos e consolidar os pontos exigidos pela banca.',
    botoes: stH
      ? '<button class="btn pequeno' + (aulaFeita && !fixFeita ? ' primario' : '') + '" data-acao="trilha-sessao" data-st="' + esc(stH.id) + '" data-tipo="pratica" data-n="5">Fixar na prática (5 itens)</button>'
      : '<button class="btn pequeno" data-acao="treino-rapido" data-n="5">Treino curto (5 itens)</button>'
  });

  // Passo 6: Cards Cloze de Memorização (~10 min)
  const metaNovos = Math.min(novosDisp + (d.n || 0), 5);
  const cardsFeitos = (d.n || 0) >= metaNovos && cardsV === 0;
  passos.push({
    titulo: '6. Cards cloze de memorização (~10 min)',
    feito: cardsFeitos,
    texto: 'Fixação ativa de 5 lacunas cruciais: prazos, alíquotas de dosimetria, sanções e competências (' + (d.n || 0) + '/5 concluídos).',
    botoes: '<button class="btn pequeno' + (fixFeita && !cardsFeitos ? ' primario' : '') + '" data-acao="cards-dia">Estudar 5 cards</button>'
  });

  // Passo 7: Treino Intercalado (~10 min)
  const intFeita = !!S.perfil.feitos[chaveInt];
  passos.push({
    titulo: '7. Treino intercalado (~10 min)',
    feito: intFeita,
    texto: '6 itens rápidos alternando matérias básicas (Português, Inglês, Constitucional e Administrativo).',
    botoes: '<button class="btn pequeno' + (cardsFeitos && !intFeita ? ' primario' : '') + '" data-acao="intercaladas">' + esc(rotuloPausa(chaveInt, 'Treinar 6 itens intercalados')) + '</button>',
    extra: botaoRecomecar(chaveInt)
  });

  // Passo 8: Discursiva Focal ou Espelho (~10 min)
  const discOk = (dd ? discFeita(dd) : false) || (d.t && (d.t.d || 0) >= 300) || !!S.perfil.feitos['disc:' + hojeISO()];
  const tDisc = dd ? temaDisc(dd) : TEMAS_DISC[0], atrDisc = dd ? pendencias().filter((x) => x.disc).length : 0;
  passos.push({
    titulo: dd ? '8. Discursiva do dia (~10 min)' : '8. Discursiva ou espelho (~10 min)',
    feito: discOk,
    texto: dd
      ? 'Tema do dia: ' + esc(tDisc ? tDisc.titulo : 'Tema do edital') + '. Esboce os quesitos ou analise o espelho Cebraspe.' + (atrDisc ? ' Há ' + pl(atrDisc, 'discursiva atrasada', 'discursivas atrasadas') + ': cada uma salva dá baixa primeiro na de hoje e depois na mais antiga.' : '')
      : 'Pratique a estruturação de tópicos e o padrão de resposta Cebraspe de um tema da ANPD.',
    botoes: '<button class="btn pequeno' + (intFeita && !discOk ? ' primario' : '') + '" data-acao="disc-dia" data-t="' + esc((tDisc && tDisc.id) || 'sancoes') + '">Escrever / Ver espelho</button>'
  });

  // Passo 9: Caderno de Erros e Pesquisa (~5 min)
  const errosCad = Object.values(cadState().erros || {}).filter((e) => e.data === hojeISO()).length;
  const erroFeito = pesqHoje > 0 || errosCad > 0 || d.e === 0;
  passos.push({
    titulo: '9. Caderno de erros e pesquisa (~5 min)',
    feito: erroFeito,
    texto: d.e > 0
      ? 'Catalogar a causa dos erros de hoje (' + d.e + ' ' + pl(d.e, 'erro', 'erros') + ') para blindar a véspera.'
      : 'Pesquisar 1 termo do glossário regulatório ou revisar suas regras pessoais.',
    botoes: '<button class="btn pequeno' + (!erroFeito && d.e > 0 ? ' primario' : '') + '" data-acao="mais" data-sub="erros">Caderno de erros' + (d.e ? ' (' + d.e + ')' : '') + '</button>' +
            '<button class="btn pequeno" data-acao="mais" data-sub="pesquisar">Pesquisar termo</button>'
  });

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
  return (dia.blocos || []).map((b) => ({ b, falta: Math.max(0, alvoBloco(dia, b) - tocadosDesde(b, desde)) })).filter((x) => x.falta > 0);
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
// Cota da semana (segunda a domingo): uma discursiva completa, escrita e corrigida pelos quesitos, e um simulado de 30
// itens ou mais com tempo. Ficam à vista abaixo do roteiro até serem cumpridas e não entram na contagem do roteiro do
// dia (que fecha completo sem elas). O simulado do plano na semana também cumpre a cota.
const SIM_SEMANA_N = 30;
function cotaSemana() {
  const sem = semanaAtual(), fim = isoDeNum(diaNum(sem) + 6);
  const discOk = Object.values(S.disc).some((st) => (st.tentativas || []).some((x) => x.d >= sem));
  const simOk = S.simulados.some((x) => x.data >= sem && x.n >= SIM_SEMANA_N);
  const tent = (id) => ((S.disc[id] || {}).tentativas || []).length;
  // Entre os menos treinados, primeiro os temas com espelho oficial da banca: são a única régua externa de severidade
  const oficial = (t) => (/^oficial-/.test(t.id) ? 0 : 1);
  const tema = TEMAS_DISC.slice().sort((a, b) => tent(a.id) - tent(b.id) || oficial(a) - oficial(b))[0];
  const simPlano = DIAS.find((x) => x.modo === 'simulado' && x.data >= hojeISO() && x.data <= fim);
  const chaveSim = 'sim:' + sem;
  return [
    { titulo: 'Discursiva da semana', feito: discOk,
      texto: discOk ? 'Feita nesta semana.' : (tema ? 'Texto inteiro, no limite de linhas e no tempo, corrigido pelos quesitos. Sugestão: ' + tema.titulo + (tent(tema.id) ? '' : ' (tema ainda não treinado)') + '.' : ''),
      botoes: discOk || !tema ? '' : '<button class="btn pequeno" data-acao="disc-dia" data-t="' + esc(tema.id) + '">Escrever</button>' },
    { titulo: 'Simulado da semana (' + SIM_SEMANA_N + ' itens)', feito: simOk,
      texto: simOk ? 'Feito nesta semana.' : 'Com tempo e sem gabarito até entregar: treina ritmo, resistência e a decisão de chutar.' + (simPlano ? ' O simulado do plano de ' + fmtData(simPlano.data, { weekday: 'long' }) + ' também cumpre a cota.' : ''),
      botoes: simOk ? '' : '<button class="btn pequeno" data-acao="simulado-semana">' + esc(rotuloPausa(chaveSim, 'Fazer o simulado')) + '</button>' },
  ];
}
function cartaoSemana() {
  const c = cotaSemana(), feitas = c.filter((x) => x.feito).length;
  return '<div class="cartao semana"><div class="secao-cab"><h2>Esta semana</h2><span class="mono pequeno mudo">' + feitas + ' de ' + c.length + '</span></div><div class="roteiro">' +
    c.map((p) => '<div class="passo' + (p.feito ? ' feito' : '') + '"><div class="marca-passo">' + (p.feito ? '✓' : '◦') + '</div><div class="corpo-passo"><b>' + esc(p.titulo) + '</b><p>' + esc(p.texto) + '</p>' + (p.botoes ? '<div class="linha-btns">' + p.botoes + '</div>' : '') + '</div></div>').join('') + '</div></div>';
}
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
  if (!pendCache) {
    pendCache = calcularPendencias();
    if (typeof queueMicrotask === 'function') queueMicrotask(() => { pendCache = null; });
    else setTimeout(() => { pendCache = null; }, 0);
  }
  return pendCache || [];
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
  { id: 'q30', txt: () => 'Responder ' + metaDia() + ' itens', xp: 30, meta: () => metaDia(), val: (d) => d.r || 0 },
  { id: 'novas', txt: () => 'Responder ' + metaNovas() + ' itens inéditos', xp: 40, meta: () => metaNovas(), val: (d) => d.ni || 0 },
  { id: 'acerto', txt: 'Acertar 80% de pelo menos 20 itens', xp: 40, meta: 1, val: (d) => ((d.r || 0) >= 20 && d.c / d.r >= 0.8 ? 1 : 0), fr: (d) => Math.min(1, (d.r || 0) / 20) },
  { id: 'roteiro', txt: 'Fechar o roteiro de hoje', xp: 60, meta: 1, val: (d) => d.rt || 0, so: () => !!roteiroHoje() },
  { id: 'arterro', txt: 'Ler o artigo de um item que você errou', xp: 40, meta: 1, val: (d) => { const e = artigosDeErros(); return (d.a || []).filter((k) => e.has(k)).length; }, so: () => artigosDeErros().size > 0 },
  { id: 'lei5', txt: () => 'Ler ' + metaLei() + ' artigos da lei seca', xp: 30, meta: () => metaLei(), val: (d) => (d.a || []).length },
  { id: 'tempo60', txt: () => 'Estudar ' + fmtDur(metaMin60() * 60), xp: 40, meta: () => metaMin60(), val: (d) => Math.floor(segundosEstudo(d) / 60) },
  { id: 'virada', txt: 'Acertar 5 itens que você tinha errado em outro dia', xp: 50, meta: 5, val: (d) => d.vr || 0, so: () => Object.values(S.itens).filter((r) => r[0] === 0 && r[3] > 0 && r[4] < HOJE()).length >= 5 },
  { id: 'pesq', txt: 'Investigar um tema da lista Para pesquisar', xp: 30, meta: 1, val: () => Object.values(S.pesquisa).filter((p) => p.s && p.f === hojeISO()).length },
  { id: 'pend', txt: 'Recuperar uma sessão do atraso', xp: 60, meta: 1, val: (d) => d.pd || 0, so: () => pendencias().some((x) => x.sessao) },
  { id: 'chefe5', txt: 'Acertar 5 golpes no chefão', xp: 40, meta: 5, val: (d) => (chefeDaSemana().vencido ? 5 : d.cg || 0), so: () => !chefeDaSemana().vencido },
];
const MI = new Map(MISSOES.map((m) => [m.id, m]));
// Metas das missões pelo ritmo pessoal (sem ritmo, os valores de sempre: 30, 60, 20, 5 artigos e 1 hora)
function metaNovas() { const r = ritmo(); return r && r.ni ? limitar(Math.round(r.ni / 10) * 10, 20, 80) : 20; }
function metaLei() { const r = ritmo(); return r && r.a ? limitar(r.a, 5, 12) : 5; }
function metaMin60() { const r = ritmo(); return r && r.min ? limitar(Math.round(r.min / 15) * 15, 60, 180) : 60; }
const valM = (v) => (typeof v === 'function' ? v() : v);
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
// Artigos dos itens cuja última resposta foi erro: ler um deles é o passo que mais rende quando o erro foi "não sabia"
function artigosDeErros() {
  const set = new Set();
  for (const [id, r] of Object.entries(S.itens)) {
    if (r[0] !== 0 || !(r[3] > 0)) continue;
    const q = QI.get(id);
    if (q && q.art && LEIS[q.l]) set.add(chave(q.l, q.art));
  }
  return set;
}
function missoesHoje() {
  const h = hojeISO(), r = rpg(), m = (r.m ||= {});
  if (!m[h]) {
    const pool = MISSOES.filter((x) => !x.so || x.so());
    const ids = pool.some((x) => x.id === 'pend') ? ['pend'] : [];
    for (const x of pool.filter((y) => y.id !== 'pend').sort((a, b) => hashTxt(h + a.id) - hashTxt(h + b.id))) {
      if (ids.length >= 3) break;
      ids.push(x.id);
    }
    m[h] = { ids, ok: {} };
    const limite = isoDeNum(HOJE() - 14);
    for (const k of Object.keys(m)) if (k < limite) delete m[k];
  }
  // Missão de um dia guardado que deixou de existir sai da lista (senão o baú do dia nunca abriria)
  m[h].ids = m[h].ids.filter((id) => MI.has(id));
  return m[h];
}
function verificarRPG() {
  const d = diaLog(), mh = missoesHoje();
  let mudou = false;
  for (const id of mh.ids) {
    const x = MI.get(id);
    if (!x || mh.ok[id] || x.val(d) < valM(x.meta)) continue;
    mh.ok[id] = 1; mudou = true;
    ganharXP(x.xp);
    avisar('★', 'Missão cumprida', valM(x.txt) + ' · +' + x.xp + ' XP');
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
  if (!sessao || sessao.modo === 'simulado' || UI.foco) return '';
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
  else if (sessao.golpe && sessao.golpe.vencido) { sessao.desfecho = 'vitoria'; }
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
    (sessao.defesas ? '<p class="pequeno">' + pl(sessao.defesas, 'defesa', 'defesas') + ': em branco quando faltou certeza, sem perder coração. Na prova, é ponto que não se perde.</p>' : '') +
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
    const v = x.val(d), ok = !!mh.ok[id], meta = valM(x.meta), f = ok ? 1 : x.fr ? x.fr(d) : Math.min(1, v / meta);
    return '<div class="missao' + (ok ? ' ok' : '') + '"><span class="m-ic" aria-hidden="true">' + (ok ? '✓' : '★') + '</span><div class="m-txt"><b>' + esc(valM(x.txt)) + '</b>' + barra(f, 'ouro') + (!ok && x.acao ? x.acao() : '') + '</div>' +
      '<span class="mono pequeno">' + (ok ? '+' + x.xp + ' XP' : x.fr ? (d.r || 0) + '/20' : Math.min(v, meta) + '/' + meta) + '</span></div>';
  }).join('');
  const eq = Object.keys(ENCAIXES).map(equipado).filter(Boolean);
  const slots = eq.length ? eq.map((it) => '<span class="slot r-' + it.rar + '" title="' + esc(it.nome + ' · ' + efeitoTxt(it)) + '">' + esc(it.nome) + '</span>').join('') : '<span class="pequeno mudo">Sem equipamento</span>';
  const heroi = '<button class="heroi-rpg" data-acao="mais" data-sub="personagem"><span class="insignia">' + nv.n + '</span><span class="h-info"><b>' + esc(nv.nome) + '</b>' + barra((S.perfil.xp - nv.base) / (nv.prox - nv.base), 'ouro') +
    '<span class="mono pequeno">' + fmtNum(S.perfil.xp) + ' / ' + fmtNum(nv.prox) + ' XP · ' + coracoesMax() + ' ♥ · +' + bonusDano() + '% dano · ' + chanceCritico() + '% crítico</span></span><span class="slots">' + slots + '</span></button>';
  const chefe = '<div class="chefe' + (c.vencido ? ' vencido' : '') + '"><span class="brasao">' + brasao(discChefe(c.bloco)) + '</span><div class="chefe-info"><div class="chefe-cab"><b>' + esc(nomeChefe(c.bloco)) + '</b><span class="mono pequeno">' + (c.vencido ? 'derrotado' : 'HP ' + c.vida + '/' + c.max) + '</span></div>' +
    '<span class="pequeno mudo">' + esc(nomeBloco(c.bloco)) + '</span>' + hpBarra(c.vencido ? 0 : c.vida, c.max) + '</div>' +
    (c.vencido ? '' : '<button class="btn pequeno primario" data-acao="enfrentar-chefe">' + esc(rotuloPausa('chefe:' + c.sem, 'Batalhar')) + '</button>') + '</div>';
  const bau = mh.bau && mh.item && IR.get(mh.item) ? '<p class="pequeno">Baú aberto: <b class="r-txt-' + IR.get(mh.item).rar + '">' + esc(IR.get(mh.item).nome) + '</b></p>' : '<p class="pequeno mudo">Três missões abrem o baú do dia, com um item.</p>';
  // Recolhida por padrão (a tela Hoje começa pelo roteiro): o resumo mostra nível, missões e a vida do chefão
  return '<div class="cartao jornada"><details data-det="jornada"' + (UI.det.jornada ? ' open' : '') + '><summary class="jornada-resumo"><b>Jornada</b><span class="mono pequeno mudo">nível ' + nv.n + ' · ' + feitas + '/' + mh.ids.length + ' missões · ' +
    (c.vencido ? 'chefão vencido' : 'chefão ' + Math.round((c.vida / c.max) * 100) + '% de vida') + '</span></summary>' +
    heroi + chefe + '<div class="missoes">' + missoes + '</div>' + bau + '</details></div>';
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
// Prontidão no topo da tela Hoje, acima de qualquer XP: é o número que diz se a prova está perto
function linhaProntidao() {
  const pr = prontidao(), n = pr.real.n;
  const txt = pr.nota != null && pr.cobre >= 0.5
    ? 'Prontidão: <b>' + Math.round(pr.nota) + '</b> de ' + PONTOS_PROVA + ' pontos líquidos' + (pr.faixa ? ' (provavelmente entre ' + pr.faixa[0] + ' e ' + pr.faixa[1] + ')' : '') + ' · itens reais: ' + pct(pr.real.c, n || 1) + '% em ' + n +
      (pr.semReais + pr.semDados ? ' · ' + pl(pr.semReais + pr.semDados, 'disciplina ainda sem medida própria', 'disciplinas ainda sem medida própria') : '')
    : 'Prontidão: ' + (n ? pct(pr.real.c, n) + '% nos ' + pl(n, 'item real respondido', 'itens reais respondidos') + '; ' : '') + 'a estimativa fica confiável perto de 100 itens reais (o simulado da semana ajuda)';
  return '<p class="pront-topo">' + txt + ' <button class="linkish pequeno" data-acao="mais" data-sub="progresso">detalhes</button></p>';
}
function renderHoje() {
  const ctx = contextoHoje();
  const d = diaLog();
  const h = hojeISO();
  const rt = roteiroHoje();
  const feitos = rt.passos.filter((p) => p.feito).length;
  const prox = rt.passos.find((p) => !p.feito) || cotaSemana().find((p) => !p.feito);
  let topo = '<div class="cartao destaque"><div class="heroi">' +
    '<div><div class="dia">' + esc(fmtData(h, { weekday: 'long' })) + '</div><div class="data">' + esc(fmtData(h, { day: '2-digit', month: 'long', year: 'numeric' })) +
    (ctx.tipo === 'dia' ? ' · ' + esc(ctx.dia.duracao) : '') + '</div></div>' + anel(d.r, metaDia()) + linhaProntidao() +
    '<p class="atividade">' + (ctx.tipo === 'dia' ? esc(ctx.dia.atividade) : ctx.tipo === 'folga' ? '<span class="mudo">Dia livre por padrão. Próxima sessão, ' + esc(fmtData(ctx.prox.data, { weekday: 'short', day: '2-digit', month: '2-digit' })) + ':</span> ' + esc(ctx.prox.atividade) : 'Cronograma concluído: recomece pelos blocos mais fracos e pelo conteúdo do edital.') + '</p>' +
    // O que fazer agora fica na primeira tela: o primeiro passo do roteiro ainda não feito, com o botão dele
    (prox ? '<div class="proximo"><span class="rotulo">' + (rt.passos.includes(prox) ? 'Próximo passo · ' + (rt.passos.indexOf(prox) + 1) + ' de ' + rt.passos.length : 'Roteiro de hoje feito · falta na semana') + '</span><b>' + esc(prox.titulo) + '</b><div class="linha-btns">' + prox.botoes + '</div></div>'
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
    '<button class="modo" data-acao="mais" data-sub="discursiva"><b>Discursiva</b><span>Limite de linhas e correção por quesitos.</span><span class="num">' + pl(TEMAS_DISC.length, 'tema', 'temas') + '</span></button>' +
    '<button class="modo" data-acao="abrir-modo" data-modo="treino"><b>Treino livre</b><span>Escolha os blocos; gabarito comentado a cada item.</span><span class="num">' + Q.length + ' questões</span></button></div></div>';
  // Duas contagens: o prazo legal do edital e a prova estimada (domingo cerca de três meses depois)
  const cr = D.cronograma, faltaEd = diaNum(cr.edital) - HOJE(), prova = dataProva(), oficial = !!(S.perfil.edital && S.perfil.edital.prova), faltaPr = diaNum(prova) - HOJE();
  const dataCurta = (iso) => fmtData(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const contagem = (n, txt) => '<div class="contagem">' + (n > 0 ? '<span class="grande">' + n + '</span>' : '') + '<span>' + txt + '</span></div>';
  const edital = '<div class="cartao">' +
    contagem(faltaEd, faltaEd > 0 ? 'dias até ' + dataCurta(cr.edital) + ', prazo legal máximo para o edital.' : faltaEd === 0 ? 'Hoje vence o prazo legal máximo para o edital (' + dataCurta(cr.edital) + ').' : 'O prazo legal do edital (' + dataCurta(cr.edital) + ') passou: acompanhe as notícias.') +
    contagem(faltaPr, faltaPr > 0 ? (oficial ? 'dias até a prova, ' + dataCurta(prova) + '.' : 'dias até a prova provável, domingo ' + dataCurta(prova) + ' (três meses depois do edital; troque pela data oficial em Ajustes → Edital e prova).') : faltaPr === 0 ? 'Hoje é o dia da prova. Boa prova!' : 'A data ' + (oficial ? '' : 'estimada ') + 'da prova (' + dataCurta(prova) + ') passou.') + '</div>';
  // Sessões guardadas que não têm botão próprio no roteiro (o dia, as intercaladas e a trilha de hoje já mostram Continuar)
  const fora = new Set(['i:' + h]);
  if (ctx.tipo === 'dia') fora.add(ctx.dia.data);
  // num dia de subtema, o roteiro tem botão só para o pré-teste; a prática guardada continua na lista
  const stH = subtemaDoDia(), diaSt = ctx.tipo === 'dia' && ctx.dia.modo === 'treino' && stDoDia(ctx.dia);
  if (stH) fora.add('t:' + stH.id + ':' + (diaSt || estadoSubtema(stH.id).novos ? 'pre' : 'pratica'));
  verificarRPG();
  const local = cartaoSoNoAparelho(), localTopo = local && backupAtrasado();
  document.getElementById('vista-hoje').innerHTML = topo + (localTopo ? local : '') + cartaoPausas(fora) + roteiro + cartaoSemana() + cartaoPendencias() + cartaoJornada() + cartaoTempo() + cartaoTaticoMentorando() + modos + edital + (localTopo ? '' : local) + '<p class="sync" id="sync"></p>';
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
    const n = nItensDoDia(dia);
    iniciarSessao({ modo: 'simulado', n, blocos: dia.blocos, prova: !dia.blocos.length, titulo, dia: dia.data, minutos: Math.round(n * 1.5) });
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
// Sessão de questões do dia: simulado e revisão com até 30 itens; no treino, o pré-teste que cabe nos 15 min do Passo 2
function nItensDoDia(dia) {
  if (dia.modo !== 'treino') return Math.min(dia.n, 30);
  return nPreTeste();
}

/* ================= Questões (montar sessão) ================= */
function renderQuestoes() {
  const modo = UI.modo;
  const ns = modo === 'simulado' ? [30, 60, 120] : [10, 20, 30, 50];
  if (!ns.includes(UI.n)) UI.n = ns[1];
  const sel = new Set(UI.blocos);
  const pool = poolDe(UI.blocos, UI.filtroBanca);
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
    html += '<div class="cartao destaque anpd-sim-banner">' +
      '<div class="secao-cab"><h2>Simulado no formato ' + (S.perfil.edital ? 'do edital' : 'projetado da ANPD') + '</h2><span class="selo mono">' + TOTAL_PROVA + ' itens · ' + duracaoProva() + '</span></div>' +
      '<p class="pequeno"><b>' + somaItens(PROVA_BASICA) + ' itens de conhecimentos básicos (P1)</b> e <b>' + somaItens(PROVA_ESPECIFICA) + ' de específicos (P2)</b>' + (S.perfil.edital ? ', como no edital informado em Ajustes' : ', como na Anatel 2024') + '. No fim, a régua de eliminação (nota mínima de ' + CORTES.p1 + ' na P1, ' + CORTES.p2 + ' na P2 e ' + CORTES.total + ' no conjunto).' + (S.perfil.edital ? '' : ' O edital da ANPD ainda não saiu: estrutura e cortes são projeção; troque em Ajustes → Edital e prova quando sair.') + '</p>' +
      '<div class="linha-btns"><button class="btn primario" data-acao="simulado-oficial-120">Começar (' + TOTAL_PROVA + ' itens · ' + duracaoProva() + ')</button></div>' +
      '</div>' +
      '<div class="cartao">' +
      '<div class="secao-cab"><h2>Provas recentes do Cebraspe</h2><span class="selo mono">Gabarito oficial</span></div>' +
      '<p class="pequeno mudo">Os itens destas provas que estão no banco, com o tempo proporcional ao da prova. Ficaram de fora os que dependem de texto da prova que não veio junto.</p>' +
      '<div class="linha-btns">' +
      '<button class="btn pequeno" data-acao="simulado-anvisa-2024">ANVISA 2024 · ' + pl(Q.filter((q) => q.id.startsWith('anvisa-2024-cebraspe-')).length, 'item', 'itens') + '</button>' +
      '<button class="btn pequeno" data-acao="simulado-tcu-2026">TCU 2026 (AUFC) · ' + pl(Q.filter((q) => q.id.startsWith('tcu-aufc-2026-')).length, 'item', 'itens') + '</button>' +
      '</div></div>';
    html += '<div class="campo"><span class="rot">Composição</span><div class="chips">' +
      '<button class="chip" data-acao="set-prova" data-prova="prova" aria-pressed="' + usarProva + '">Prova completa (básicos + específicos)</button>' +
      '<button class="chip" data-acao="set-prova" data-prova="blocos" aria-pressed="' + !usarProva + '">Só os blocos marcados</button></div>' +
      (usarProva ? '<p class="pequeno mudo">Numa prova de ' + TOTAL_PROVA + ' itens e ' + PONTOS_PROVA + ' pontos. Básica: ' + Object.entries(PROVA_BASICA).map(([d, k]) => esc(DI.get(d).nome) + ' ' + k).join(' · ') + '. Específica: ' + Object.entries(PROVA_ESPECIFICA).map(([d, k]) => esc(DI.get(d).nome) + ' ' + k).join(' · ') + '. Estimativa para Especialista em Regulação, sobre as provas da Anatel e da ANAC de 2024; muda quando sair o edital.</p>' : '') + '</div>';
  }
  if (modo !== 'relampago') html += '<div class="campo"><span class="rot">Quantidade de itens</span><div class="chips">' + ns.map((n) => '<button class="chip" data-acao="set-n" data-n="' + n + '" aria-pressed="' + (UI.n === n) + '">' + n + '</button>').join('') + '</div></div>';
  if (modo !== 'relampago') html += '<div class="campo"><span class="rot">Banca e formato</span><div class="chips">' +
    [['todas', 'Todos (' + Q.length + ')'], ['cebraspe', 'Só certo ou errado'], ['reais', 'Só itens de prova'], ['ineditas', 'Só itens do painel'], ['multipla', 'Só múltipla escolha']].map(([v, t]) => '<button class="chip" data-acao="set-banca" data-banca="' + v + '" aria-pressed="' + ((UI.filtroBanca || 'todas') === v) + '">' + t + '</button>').join('') + '</div></div>';

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
  else if (UI.modo === 'simulado') iniciarSessao({ modo: 'simulado', n: UI.n, blocos: UI.blocos, banca: UI.filtroBanca, prova: UI.prova === 'prova', minutos: Math.round(UI.n * 1.5), titulo: UI.prova === 'prova' ? 'Simulado · prova completa' : 'Simulado Cebraspe' });
  else iniciarSessao({ modo: 'treino', n: UI.n, blocos: UI.blocos, filtro: UI.filtro, banca: UI.filtroBanca });
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
  if (comTempoItem() && sessao.itemDe !== sessao.ids[sessao.i]) { sessao.itemDe = sessao.ids[sessao.i]; sessao.itemIni = Date.now(); }
  const relogio = sessao.limite ? fmtTempo(sessao.limite - decorrido()) : fmtTempo(decorrido());
  let html = '<div class="sessao-corpo"><div class="sessao-topo"><button class="icone-btn" data-acao="sair-sessao" aria-label="Sair da sessão"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
    '<div class="tit"><b>' + esc(sessao.titulo) + '</b><span>' + (total ? (sessao.modo === 'cards' ? 'Card ' : 'Item ') + ((sessao.feitasAntes || 0) + sessao.i + 1) + ' de ' + (sessao.totalOrig || total) : 'Item ' + (sessao.i + 1)) + (sessao.xp ? ' · +' + sessao.xp + ' XP' : '') + '</span></div>' +
    (!UI.foco && sessao.modo !== 'simulado' && sessao.modo !== 'cards' && sessao.combo >= 2 ? '<span class="combo' + (sessao.revelado || sessao.flash ? ' pulso' : '') + '">combo ×' + sessao.combo + '</span>' : '') +
    '<button class="icone-btn" data-acao="foco" aria-pressed="' + !!UI.foco + '" aria-label="' + (UI.foco ? 'Mostrar a arena' : 'Modo foco: esconder a arena e o combo') + '" title="' + (UI.foco ? 'Modo foco ligado' : 'Modo foco desligado') + '"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg></button>' +
    '<button class="icone-btn som" data-acao="som" aria-pressed="' + !!UI.som + '" aria-label="' + (UI.som ? 'Desligar o som' : 'Ligar o som') + '" title="' + (UI.som ? 'Som ligado' : 'Som desligado') + '">' + iconeSom(!!UI.som) + '</button>' +
    (comTempoItem() ? htmlTempoItem() : '') + '<span class="relogio" id="relogio">' + relogio + '</span></div>';
  if (sessao.confirmar) html += renderConfirmacao();
  if (sessao.modo === 'cards') html += barra(sessao.i / sessao.ids.length) + renderCardSessao(CI.get(sessao.ids[sessao.i]));
  else { html += renderArena(QI.get(sessao.ids[sessao.i])); if (total) html += renderTira(); html += renderItem(QI.get(sessao.ids[sessao.i])); }
  el.innerHTML = html + '</div>';
  centrarTira();
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
    return sessao.modo === 'simulado' ? '<button data-acao="ir-item" data-i="' + k + '" aria-label="Item ' + (k + 1) + ': ' + (r ? (r === BRANCO ? 'em branco' : 'marcado') : 'sem resposta') + '"' + (id === atual ? ' aria-current="step"' : '') + '>' + i + '</button>' : i;
  }).join('') + '</div>';
}
// A folha de respostas é uma fita de uma linha: mantém a bolinha do item atual no meio
function centrarTira() {
  const t = document.querySelector('#sessao .tira'), at = t && t.querySelector('.atual');
  if (at) t.scrollLeft = at.getBoundingClientRect().left - t.getBoundingClientRect().left + t.scrollLeft - t.clientWidth / 2;
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
  html += '<p class="enunciado">' + (sessao.revelado ? marcarPolaridade(marcarTermos(q.e, 3)) : esc(q.e)) + '</p>';
  html += renderAlternativas(q, marcada, sessao.revelado || !!sessao.flash);
  if (sessao.flash) {
    html += '<div class="veredito ' + sessao.flash + '"><span>' + (sessao.flash === 'ok' ? 'Certo' : 'Errado: gabarito ' + nomeGab(q).toUpperCase()) + '</span>' + (sessao.ultimoGanho ? '<span class="ganho">+' + sessao.ultimoGanho + ' XP</span>' : '') + '</div>';
  } else if (!sessao.revelado) {
    if (sessao.modo !== 'relampago') html += '<label class="duvida"><input type="checkbox" data-acao="duvida"' + (sessao.duv[id] ? ' checked' : '') + '> Estou em dúvida (mede quando vale chutar)</label>';
    const branco = sim || sessao.modo !== 'relampago' ? '<button class="bolha b' + (marcada === BRANCO ? ' marcada' : '') + '" data-acao="responder" data-r="' + BRANCO + '"' + (sim ? '' : ' title="Defesa: não perde coração nem combo; o item volta na revisão"') + '>Em branco</button>' : '';
    if (q.al) {
      if (branco) html += '<div class="respostas">' + branco + '</div>';
      html += '<p class="atalhos">Teclado: A a ' + LETRAS[q.al.length - 1] + ' marcam a alternativa' + (sim ? ' · ← → navegam' : '') + '</p>';
    } else {
      html += '<div class="respostas"><button class="bolha c' + (marcada === 'C' ? ' marcada' : '') + '" data-acao="responder" data-r="C"><span class="oval"><span>C</span></span>CERTO</button>' +
        '<button class="bolha e' + (marcada === 'E' ? ' marcada' : '') + '" data-acao="responder" data-r="E"><span class="oval"><span>E</span></span>ERRADO</button>' + branco + '</div>';
      html += '<p class="atalhos">Teclado: C = certo · E = errado' + (sim ? ' · B = em branco · ← → navegam' : branco ? ' · B = em branco (defesa)' : '') + ' · D = dúvida</p>';
    }
    if (sim) html += '<div class="linha-btns"><button class="btn" data-acao="anterior"' + (sessao.i ? '' : ' disabled') + '>Anterior</button><button class="btn" data-acao="proximo"' + (sessao.i < sessao.ids.length - 1 ? '' : ' disabled') + '>Próximo</button><button class="btn primario" data-acao="entregar">Entregar (' + Object.keys(sessao.resp).length + '/' + sessao.ids.length + ')</button></div>';
  } else {
    const r = sessao.resp[id], ok = r === q.g, br = r === BRANCO, gab = q.al ? 'a letra ' + q.g : q.g === 'C' ? 'CERTO' : 'ERRADO';
    html += '<div class="veredito ' + (br ? 'defesa' : ok ? 'ok' : 'no') + '"><span>' + (br ? 'Em branco: defesa, sem perder coração. O gabarito é ' + gab + '.' : ok ? 'Você marcou ' + nomeResp(q, r) + ' e acertou.' : 'Você marcou ' + nomeResp(q, r) + '. O gabarito é ' + gab + '.') + '</span>' +
      (sessao.ultimoGanho ? '<span class="ganho ganho-voa">+' + sessao.ultimoGanho + ' XP' + (br ? '' : sessao.virada === 'plena' ? ' <small>virada</small>' : caiuEmProva(q) && sessao.modo !== 'relampago' ? ' <small>crítico</small>' : '') + '</span>' : '<span class="pequeno">' + (SEM_REPETICAO.has(id) ? 'Este texto não volta: vêm outros' : 'Foi para a lista curta') + '</span>') + '</div>';
    if (!ok && !br && sessao.modo !== 'simulado') html += renderCausaAgora(q);
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
  html += caixaCadernoErro(q);
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
// Card de número, prazo ou quórum: a lacuna pode ser digitada antes de ver a resposta. Se o digitado não confere, Bom e
// Fácil ficam bloqueados (a nota não pode ser mais generosa que a resposta). Confere pelos números (algarismos ou por
// extenso: "30", "trinta", "cento e vinte") e pelas unidades digitadas (dias, meses, úteis…), que precisam estar na
// lacuna; sem número na lacuna, pelas palavras.
const NUM_PAL = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500, mil: 1000 };
const RE_DADO_CARD = /\d|\b(dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|duzentos|trezentos|quinhentos|mil|metade|dobro|triplo|ter[cç]os?)\b/i;
function numerosDe(t) {
  const out = new Set(), w = semAcento(t).replace(/(\d)\.(\d{3})/g, '$1$2').match(/\d+(?:,\d+)?|[a-z]+/g) || [];
  let acc = null;
  const fecha = () => { if (acc != null) { out.add(acc); acc = null; } };
  for (const x of w) {
    if (/^\d/.test(x)) { fecha(); out.add(Number(x.replace(',', '.'))); }
    else if (x === 'e' && acc != null) continue;
    else if (x in NUM_PAL) acc = NUM_PAL[x] === 1000 ? (acc || 1) * 1000 : (acc || 0) + NUM_PAL[x];
    else fecha();
  }
  fecha();
  return out;
}
function unidadesDe(t) {
  const u = new Set(), x = semAcento(t);
  [[/\bhoras?\b/, 'h'], [/\bdias?\b/, 'd'], [/\bsemanas?\b/, 's'], [/\bmes(es)?\b/, 'm'], [/\banos?\b/, 'a'], [/\buteis\b|\butil\b/, 'u'], [/\bcorridos?\b/, 'c']].forEach(([re, k]) => { if (re.test(x)) u.add(k); });
  return u;
}
function confereDigitado(dig, lac) {
  if (!String(dig || '').trim()) return null;
  const nl = numerosDe(lac), nd = numerosDe(dig), ul = unidadesDe(lac);
  if ([...unidadesDe(dig)].some((u) => !ul.has(u))) return false;
  if (nl.size) return nd.size > 0 && [...nd].every((x) => nl.has(x));
  const pal = (t) => semAcento(t).match(/[a-z]{3,}/g) || [];
  const pl2 = new Set(pal(lac)), pd = pal(dig);
  return pd.length > 0 && pd.every((x) => pl2.has(x)) && pd.length * 2 >= pl2.size;
}
function lacunaDoCard(nota, n) { let auto = 0, achou = ''; nota.t.replace(RE_LACUNA, (m, num, t) => { if ((num ? Number(num) : ++auto) === n) achou = t; return m; }); return achou; }
function renderCardSessao(card) {
  const nota = card.nota;
  const r = S.cards[card.id];
  let html = '<article class="item"><div class="item-cab"><span class="selo mono">' + esc(nomeBloco(nota.b)) + '</span><span class="item-num">' + (r ? 'revisão · intervalo ' + fmtIntervalo(r[1]) : 'novo') + '</span></div>';
  html += '<p class="mono pequeno mudo">' + esc(nota.r) + '</p>';
  html += '<p class="card-cloze">' + textoCard(nota, card.n, sessao.revelado) + '</p>';
  const lac = lacunaDoCard(nota, card.n), dado = lac.length <= 60 && RE_DADO_CARD.test(lac);
  if (!sessao.revelado) {
    if (dado) html += '<input id="card-digitar" class="card-digitar" type="text" autocomplete="off" enterkeyhint="done" aria-label="Sua resposta para a lacuna" placeholder="Digite o número ou prazo antes de ver">';
    html += '<button class="btn primario largo" data-acao="revelar">Mostrar resposta</button><p class="atalhos">' + (dado ? 'Enter no campo = mostrar · ' : '') + 'Espaço ou Enter = mostrar</p>';
  } else {
    if (sessao.digOk != null) html += '<p class="digitado ' + (sessao.digOk ? 'ok' : 'no') + '">Você digitou <b>' + esc(sessao.dig) + '</b>: ' + (sessao.digOk ? 'confere.' : 'não confere. Bom e Fácil ficam bloqueados neste card.') + '</p>';
    html += '<div class="notas-card">' + [[1, 'Errei'], [2, 'Difícil'], [3, 'Bom'], [4, 'Fácil']].map(([n, t]) => '<button class="n' + n + '" data-acao="avaliar" data-n="' + n + '"' + (sessao.digOk === false && n >= 3 ? ' disabled' : '') + '>' + t + '<small>' + (n === 1 ? 'agora' : fmtIntervalo(calcularCard(card.id, n)[1])) + '</small></button>').join('') + '</div>';
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
  const tempos = Object.values(sessao.tempos || {});
  if (tempos.length >= 3) {
    const lentos = tempos.filter((x) => x > RITMO_PROVA_S).length, media = Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length);
    html += '<p class="pequeno ritmo-sessao">Tempo por item: média de ' + fmtTempo(media) + (lentos ? '; ' + pl(lentos, 'item passou', 'itens passaram') + ' de ' + fmtTempo(RITMO_PROVA_S) + ', o ritmo de prova.' : '; todos dentro do ritmo de prova (' + fmtTempo(RITMO_PROVA_S) + ').') + '</p>';
  }
  html += cartaoBatalha();
  html += '<div class="cartao destaque"><span class="rotulo">Nota líquida Cebraspe (certas − erradas)</span><div class="nota-final"><span class="grande">' + liq + '</span><span class="mudo">de ' + n + ' possíveis · ' + (n ? Math.round((liq / n) * 100) : 0) + '%</span></div>' +
    '<div class="placar"><div class="C"><b>' + c + '</b><span>certas</span></div><div class="E"><b>' + e + '</b><span>erradas</span></div><div><b>' + b + '</b><span>em branco</span></div><div class="L"><b>+' + sessao.xp + '</b><span>XP</span></div></div>';
  // Régua de eliminação (a do edital informado ou, como projeção, a da Anatel 2024): só faz sentido na prova inteira
  if (sessao.modo === 'simulado' && sessao.prova && ids.length >= TOTAL_PROVA) {
    let c1 = 0, e1 = 0, b1 = 0, c2 = 0, e2 = 0, b2 = 0;
    ids.forEach((id) => {
      const q = QI.get(id), r = sessao.resp[id] || BRANCO, isBasica = parteProva(q) === 'b';
      if (isBasica) { if (r === BRANCO) b1++; else if (r === q.g) c1++; else e1++; }
      else { if (r === BRANCO) b2++; else if (r === q.g) c2++; else e2++; }
    });
    const liq1 = c1 - e1, liq2 = c2 - e2, liqTot = liq1 + liq2;
    const okP1 = liq1 >= CORTES.p1, okP2 = liq2 >= CORTES.p2, okTot = liqTot >= CORTES.total;
    const aprovado = okP1 && okP2 && okTot;
    const faixaCorte = !aprovado ? 'Eliminado pela régua de nota mínima' : (liqTot >= 72 ? 'Nota alta (60% ou mais da prova)' : liqTot >= 54 ? 'Nota intermediária (45% a 59%)' : 'Nota baixa (menos de 45%)');
    const badgeCls = !aprovado ? 'eliminado' : (liqTot >= 72 ? 'aprovado' : 'alerta');
    html += '<div class="cartao" style="border-left:4px solid var(--accent);margin-top:10px">' +
      '<div class="secao-cab"><h2>Régua de eliminação (' + (S.perfil.edital && S.perfil.edital.cortes ? 'do edital' : 'Anatel 2024, como projeção') + ')</h2><span class="corte-badge ' + badgeCls + '">' + (aprovado ? 'HABILITADO' : 'ELIMINADO') + '</span></div>' +
      '<div class="corte-grid">' +
        '<div class="corte-kpi"><b>P1 · Básicos (' + ids.filter((x) => parteProva(QI.get(x)) === 'b').length + ' itens)</b><span>Líquida: <b>' + liq1 + '</b> pts (' + c1 + 'C / ' + e1 + 'E / ' + b1 + 'B)</span><span class="corte-badge ' + (okP1 ? 'aprovado' : 'eliminado') + '" style="margin-top:4px">' + (okP1 ? 'Mínimo atingido (≥ ' + CORTES.p1 + ')' : 'Abaixo do mínimo (< 10)') + '</span></div>' +
        '<div class="corte-kpi"><b>P2 · Específicos (' + ids.filter((x) => parteProva(QI.get(x)) !== 'b').length + ' itens)</b><span>Líquida: <b>' + liq2 + '</b> pts (' + c2 + 'C / ' + e2 + 'E / ' + b2 + 'B)</span><span class="corte-badge ' + (okP2 ? 'aprovado' : 'eliminado') + '" style="margin-top:4px">' + (okP2 ? 'Mínimo atingido (≥ ' + CORTES.p2 + ')' : 'Abaixo do mínimo (< 21)') + '</span></div>' +
        '<div class="corte-kpi"><b>Conjunto Objetivas (P1+P2)</b><span>Líquida: <b>' + liqTot + '</b> pts</span><span class="corte-badge ' + (okTot ? 'aprovado' : 'eliminado') + '" style="margin-top:4px">' + (okTot ? 'Habilitado para Discursiva (≥ ' + CORTES.total + ')' : 'Eliminado do concurso (< 36)') + '</span></div>' +
      '</div>' +
      '<p class="pequeno"><b>Faixa:</b> <span class="corte-badge ' + badgeCls + '">' + faixaCorte + '</span> <span class="mudo">Nenhuma nota de corte da ANPD existe ainda; as faixas são só referência.</span></p>' +
      '</div>';
  }
  if (sessao.modo === 'relampago') html += '<p>' + (sessao.recorde ? '<b>Novo recorde!</b> ' : '') + 'Recorde pessoal: ' + (S.perfil.recordes.relampago || 0) + '.</p>';
  if (eMc) html += '<p class="mudo pequeno">' + pl(eMc, 'erro', 'erros') + ' em múltipla escolha não ' + (eMc > 1 ? 'descontaram' : 'descontou') + ' ponto, como no Cebraspe.</p>';
  if (sessao.modo === 'simulado' && ptMax !== n) html += '<p class="pequeno">Nota com os pesos da prova (cada item vale ' + (PESO_ESPECIFICA === 1 ? '1' : '1 na básica e ' + PESO_ESPECIFICA + ' na específica') + '): <b>' + pt + '</b> de ' + ptMax + ' pontos · <b>' + pct(pt, ptMax) + '%</b>.</p>';
  if (sessao.viradas) html += '<p class="pequeno">' + pl(sessao.viradas, 'virada', 'viradas') + ': ' + pl(sessao.viradas, 'item que você tinha errado em outro dia agora certo', 'itens que você tinha errado em outro dia agora certos') + ', com XP em dobro.</p>';
  if (sessao.ineditos && sessao.ineditos.n >= 5) html += '<p class="pequeno">Nos ' + sessao.ineditos.n + ' itens que você via pela primeira vez, acerto de <b>' + pct(sessao.ineditos.c, sessao.ineditos.n) + '%</b>. É a medida mais fiel do seu nível: item repetido se reconhece.</p>';
  if (sessao.comboMax >= 3) html += '<p class="mudo">Maior sequência de acertos: ' + sessao.comboMax + '.</p>';
  html += '</div>';
  html += cartaoGanhos();
  if (sessao.modo === 'simulado' && Object.keys(porDisc).length > 1) {
    html += '<div class="cartao"><h2>Por disciplina</h2><div class="tabela-env"><table class="tabela"><thead><tr><th>Disciplina</th><th>C</th><th>E</th><th>B</th><th>Líquida</th><th>Pontos</th></tr></thead><tbody>' +
      Object.entries(porDisc).sort((a, b) => b[1].ptMax - a[1].ptMax).map(([dd, v]) => { const t = v.c + v.e + v.b; return '<tr><td>' + esc((DI.get(dd) || { nome: dd }).nome) + '</td><td class="num">' + v.c + '</td><td class="num">' + v.e + '</td><td class="num">' + v.b + '</td><td class="num">' + (v.c - v.e + v.eMc) + ' (' + pct(v.c - v.e + v.eMc, t) + '%)</td><td class="num">' + v.pt + ' de ' + v.ptMax + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="pequeno mudo">Pontos: cada item vale 1, como na Anatel 2024. A ordem segue o que cada disciplina pesa na nota.</p></div>';
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
  let proximoAcaoBtn = '';
  if (sessao.st && sessao.tipoSubtema === 'pre') {
    proximoAcaoBtn = '<button class="btn primario" data-acao="st-lei" data-st="' + esc(sessao.st) + '">2. Ler Lei Seca do Subtema ›</button>';
  } else if (sessao.st && sessao.tipoSubtema === 'pratica') {
    proximoAcaoBtn = '<button class="btn primario" data-acao="subtema" data-st="' + esc(sessao.st) + '">Voltar ao Subtema ›</button>';
  }
  const btnErros = e > 0 ? '<button class="btn" data-acao="mais" data-sub="erros">Caderno de Erros (' + e + ')</button>' : '';
  html += '<div class="linha-btns">' +
    (proximoAcaoBtn || '<button class="btn primario" data-acao="fechar-sessao">Concluir</button>') +
    (idsParaRefazer().length ? '<button class="btn" data-acao="refazer-erros">Refazer ' + pl(idsParaRefazer().length, 'erro ou branco', 'erros e brancos') + '</button>' : '') +
    btnErros +
    (proximoAcaoBtn ? '<button class="btn" data-acao="fechar-sessao">Concluir</button>' : '') +
    '</div>';
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
  sincronizarHistorico();
}
function fecharFolha() { const f = document.getElementById('folha'); f.hidden = true; f.innerHTML = ''; UI.folhaAula = null; sincronizarHistorico(); }
function cabFolha(rotulo, titulo) { return '<div class="folha-cab"><div><span class="rotulo">' + esc(rotulo) + '</span><h2>' + esc(titulo) + '</h2></div><button class="btn pequeno" data-acao="fechar-folha">Fechar</button></div>'; }
function folhaItem(id, resp) {
  const q = QI.get(id);
  let html = cabFolha(nomeBloco(q.b), q.id) + renderApoio(q, false) + renderComando(q) + '<p class="enunciado">' + marcarTermos(q.e, 3) + '</p>' + renderAlternativas(q, resp, true);
  if (resp) html += '<div class="veredito ' + (resp === BRANCO ? 'defesa' : resp === q.g ? 'ok' : 'no') + '"><span>' + (resp === BRANCO ? (sessao.modo === 'simulado' ? 'Em branco.' : 'Em branco: defesa, sem perder coração.') : 'Você marcou ' + nomeResp(q, resp) + '.') + ' Gabarito: ' + nomeGab(q).toUpperCase() + '.</span></div>';
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
  // Artigo já aberto mais acima na mesma cadeia de remissões: em vez de abrir de novo dentro dele mesmo, leva até lá
  const ancestral = box.parentElement && box.parentElement.closest('.art-inline[data-art="' + k + '"]');
  if (ancestral) { ancestral.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
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
// Ler rende XP (antes só responder rendia): o artigo do dia vale pouco menos que um acerto; o de um item errado, o dobro
const XP_LER = 6, XP_LER_ERRO = 12;
function marcarLido(art) {
  if (!S.perfil.lidos) S.perfil.lidos = {};
  const d = diaLog();
  if (!Array.isArray(d.a) || !Object.isExtensible(d.a)) d.a = Array.from(d.a || []);
  if (!d.a.includes(art)) { d.a.push(art); ganharXP(artigosDeErros().has(art) ? XP_LER_ERRO : XP_LER); }
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
    (soTexto ? '' : item('erro', 'Meus erros', 'background:var(--errado-bg);box-shadow:inset 0 -2px 0 var(--errado)')) +
    item('teste', 'Testar: esconder prazos e deve × pode', 'background:var(--surface-2);border:1px solid var(--line)') + '</div>';
}
function seletorLei() {
  return '<label class="rotulo" for="sel-lei">Norma</label><select id="sel-lei" class="sel-lei" data-acao="sel-lei">' +
    GRUPOS.map((g) => '<optgroup label="' + esc(g.nome) + '">' + g.ids.map((id) => '<option value="' + esc(id) + '"' + (id === UI.lei ? ' selected' : '') + '>' + esc(LEIS[id].nome) + '</option>').join('') + '</optgroup>').join('') + '</select>';
}
function primeiraLinha(a) { const ls = a.texto.split('\n'); return (/^Article \d+$/.test(ls[0]) && ls[1] ? ls[1] : ls[0]).replace(/^(Art\.|CLÁUSULA|APÊNDICE|ENUNCIADO)\s*[\dIVXL\-A-Zº°o.]+\s*/, '').replace(/^[IVXL]+ - /, ''); }

function diagnosticoArtigo(k) {
  const qs = POR_ART.get(k) || [];
  let c = 0, e = 0, nResp = 0, pendentes = 0, erradasIds = [];
  const ce = (cadState() && cadState().erros) || {};
  for (const q of qs) {
    const r = rec(q.id);
    if (r && (r[2] + r[3] > 0)) {
      nResp++;
      c += r[2];
      e += r[3];
      if (r[0] === 0 || r[3] > r[2] || ce[q.id]) {
        pendentes++;
        erradasIds.push(q.id);
      }
    }
  }
  const tot = qs.length;
  const taxa = (c + e > 0) ? Math.round((c / (c + e)) * 100) : null;
  const est = estrelas(k);
  let nivel = 'neutro';
  if (c + e > 0) {
    if (pendentes > 0 || (nResp >= 2 && taxa < 65) || (c === 0 && e > 0)) {
      nivel = 'vermelho';
    } else if (taxa >= 80 && nResp >= 3 && pendentes === 0) {
      nivel = 'verde';
    } else {
      nivel = 'amarelo';
    }
  } else if (est >= 2 && tot >= 5) {
    nivel = 'amarelo';
  }
  return { k, tot, nResp, c, e, taxa, pendentes, erradasIds, nivel, est };
}

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
    '<div class="chips"><button class="chip" data-acao="ranking" aria-pressed="' + (UI.ranking && !UI.termometro) + '">Mais importantes primeiro</button><button class="chip" data-acao="ler-tudo">Ler do início</button><button class="chip" data-acao="toggle-termometro" aria-pressed="' + !!UI.termometro + '">Termômetro de Vulnerabilidades</button></div>' +
    '<p class="pequeno mudo">Estrelas: quanto o artigo pesa no banco. Pontos: acertos e erros. Borda termossensível: Crítico, Atenção, Dominado.</p></div>';
  const diagArts = arts.map((a) => diagnosticoArtigo(a.k));
  const vermArts = diagArts.filter((d) => d.nivel === 'vermelho');
  const amarArts = diagArts.filter((d) => d.nivel === 'amarelo');
  const verdArts = diagArts.filter((d) => d.nivel === 'verde');
  const neutArts = diagArts.filter((d) => d.nivel === 'neutro');
  let totQuestoesVerm = 0;
  for (const d of vermArts) totQuestoesVerm += (d.erradasIds && d.erradasIds.length ? d.erradasIds.length : d.tot);

  html += '<div class="cartao destaque termometro-card">' +
    '<div class="secao-cab"><h2>Termômetro de Vulnerabilidade · ' + esc(L.curto || L.nome) + '</h2>' +
    '<span class="selo mono">' + vermArts.length + ' Críticos · ' + amarArts.length + ' Atenção · ' + verdArts.length + ' Dominados</span></div>' +
    '<p class="pequeno">Diagnóstico do seu desempenho cruzando as questões com os artigos da norma. Identifica onde a banca Cebraspe pode te derrubar.</p>' +
    '<div class="termo-barra-container"><div class="termo-barra">' +
      '<div class="termo-seg verm" style="width:' + pct(vermArts.length, arts.length) + '%" title="' + vermArts.length + ' Artigos Críticos"></div>' +
      '<div class="termo-seg amar" style="width:' + pct(amarArts.length, arts.length) + '%" title="' + amarArts.length + ' Artigos em Atenção"></div>' +
      '<div class="termo-seg verd" style="width:' + pct(verdArts.length, arts.length) + '%" title="' + verdArts.length + ' Artigos Dominados"></div>' +
      '<div class="termo-seg neut" style="width:' + pct(neutArts.length, arts.length) + '%" title="' + neutArts.length + ' Não Testados"></div>' +
    '</div></div>' +
    '<div class="linha-btns" style="margin-top:10px">' +
      (vermArts.length ? '<button class="btn primario" data-acao="neutralizar-vulnerabilidades">Neutralizar Vulnerabilidades (' + pl(totQuestoesVerm, 'item crítico', 'itens críticos') + ')</button>' : amarArts.length ? '<button class="btn primario" data-acao="neutralizar-vulnerabilidades">Treinar Artigos em Atenção (' + amarArts.length + ')</button>' : '') +
      '<button class="chip" data-acao="toggle-termometro" aria-pressed="' + !!UI.termometro + '">' + (UI.termometro ? 'Ver estrutura da lei' : 'Ver ranking de vulnerabilidades') + '</button>' +
    '</div></div>';
  if (UI.busca.trim().length >= 3) html += '<div class="resultado-busca">' + buscarLei(UI.busca) + '</div>';
  else if (UI.termometro) {
    const diagList = arts.map((a) => ({ a, d: diagnosticoArtigo(a.k) }))
                         .filter((x) => x.d.tot > 0)
                         .sort((x, y) => {
                           const ordem = { vermelho: 0, amarelo: 1, neutro: 2, verde: 3 };
                           if (ordem[x.d.nivel] !== ordem[y.d.nivel]) return ordem[x.d.nivel] - ordem[y.d.nivel];
                           if (x.d.pendentes !== y.d.pendentes) return y.d.pendentes - x.d.pendentes;
                           return y.d.est - x.d.est;
                         });
    html += '<div class="ranking-vuln">';
    if (!diagList.length) html += '<p class="vazio-msg">Nenhum artigo com questões ligadas nesta norma.</p>';
    else {
      for (const { a, d } of diagList) {
        const estStr = d.est ? '★'.repeat(d.est) : '';
        const nivelLabel = d.nivel === 'vermelho' ? 'Crítico' : d.nivel === 'amarelo' ? 'Atenção' : d.nivel === 'verde' ? 'Dominado' : 'Não testado';
        const taxaStr = d.taxa != null ? d.taxa + '% acerto (' + d.c + 'C / ' + d.e + 'E)' : d.tot + ' questões no banco';
        html += '<div class="ranking-vuln-item ' + (d.nivel === 'vermelho' ? 'verm' : d.nivel === 'amarelo' ? 'amar' : d.nivel === 'verde' ? 'verd' : '') + '">' +
          '<div style="flex:1;min-width:200px">' +
            '<div style="display:flex;align-items:center;gap:6px">' +
              '<b>' + esc(rotuloArt(a.k)) + '</b>' +
              (estStr ? '<span class="estrelas" style="color:var(--gold)">' + estStr + '</span>' : '') +
              '<span class="corte-badge ' + (d.nivel === 'vermelho' ? 'eliminado' : d.nivel === 'amarelo' ? 'alerta' : d.nivel === 'verde' ? 'aprovado' : '') + '">' + nivelLabel + '</span>' +
            '</div>' +
            '<div class="pequeno mudo" style="margin-top:2px">' + esc(primeiraLinha(a).slice(0, 85)) + '</div>' +
            '<div class="pequeno" style="margin-top:2px;font-weight:600">' + taxaStr + (d.pendentes ? ' · <span style="color:var(--errado)">' + pl(d.pendentes, 'pendência', 'pendências') + '</span>' : '') + '</div>' +
          '</div>' +
          '<div class="linha-btns" style="margin:0">' +
            '<button class="btn pequeno' + (d.nivel === 'vermelho' ? ' primario' : '') + '" data-acao="treinar-art" data-art="' + esc(a.k) + '">Treinar (' + d.tot + ')</button>' +
            '<button class="btn pequeno" data-acao="abrir-art" data-art="' + esc(a.k) + '">Ler lei</button>' +
          '</div>' +
        '</div>';
      }
    }
    html += '</div>';
  } else if (UI.ranking) {
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
      const dArt = diagnosticoArtigo(a.k);
      const termoCls = dArt.nivel === 'vermelho' ? ' termo-verm' : dArt.nivel === 'amarelo' ? ' termo-amar' : dArt.nivel === 'verde' ? ' termo-verd' : '';
      html += '<button class="art-btn' + (S.perfil.lidos && S.perfil.lidos[a.k] ? ' lido' : '') + termoCls + '" data-acao="abrir-art" data-art="' + esc(a.k) + '"' + (vetado ? ' style="opacity:.5"' : '') + ' aria-label="' + esc(rotuloArt(a.k)) + '" title="' + esc(rotuloArt(a.k)) + (dArt.taxa != null ? ' · ' + dArt.taxa + '% acerto' : '') + '">' + esc(a.id) + (est ? '<span class="estrelas">' + '★'.repeat(est) + '</span>' : '') + '<span class="pontos">' + pontos + '</span></button>';
    }
    if (aberto) html += '</div></div>';
  }
  el.innerHTML = html;
}
// Busca em todas as normas: a norma aberta vem primeiro; no máximo 60 resultados
// Sem resultado exato, tenta a família da palavra: "transferencia" acha "transferir" (prefixo de 60% da palavra)
function buscarLei(termo, aprox) {
  const palavras = semAcento(termo.trim()).split(/[^a-z0-9º]+/).filter(Boolean);
  if (!palavras.length) return '';
  const raiz = (p) => (aprox && p.length > 5 ? p.slice(0, Math.max(4, Math.round(p.length * 0.6))) : p);
  const re = new RegExp(palavras.map((p) => raiz(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (aprox && p.length > 5 ? '[a-z]*' : '')).join('[^a-z0-9º]+'));
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
  if (!res.length) return !aprox && palavras.some((p) => p.length > 5) ? buscarLei(termo, true) : '<p class="vazio-msg">Nada encontrado para “' + esc(termo) + '”.</p>';
  return (aprox ? '<p class="pequeno mudo">Nada exato para “' + esc(termo) + '”; mostrando palavras da mesma família.</p>' : '') + (total > res.length ? '<p class="pequeno mudo">' + total + ' resultados; mostrando os 60 primeiros (norma aberta primeiro).</p>' : '') + res.join('');
}
// Gaveta do artigo na lei seca: os itens deste artigo que a pessoa já errou, os ainda não recuperados primeiro, com o
// gabarito, o comentário e a regra que ela escreveu no Caderno de Erros
function gavetaErrosArt(qs) {
  const notas = cadState().erros || {};
  const errados = qs.filter((q) => { const r = rec(q.id); return r && r[3] > 0; })
    .sort((x, y) => (rec(x.id)[0] > 0) - (rec(y.id)[0] > 0) || rec(y.id)[3] - rec(x.id)[3]);
  if (!errados.length) return '';
  const pend = errados.filter((q) => !(rec(q.id)[0] > 0)).length;
  return '<details class="erros-art"><summary>Seus erros neste artigo (' + errados.length + (pend ? ', ' + pend + ' sem recuperar' : '') + ')</summary>' +
    errados.slice(0, 8).map((q) => {
      const r = rec(q.id), nota = notas[q.id] && notas[q.id].nota;
      return '<div class="erro-art' + (r[0] > 0 ? ' virou' : '') + '"><p class="pequeno mudo">' + esc(q.id) + ' · ' + pl(r[3], 'erro', 'erros') + (r[0] > 0 ? ' · já recuperado' : '') + '</p><p>' + esc(q.e) + '</p>' +
        '<p class="pequeno"><b>Gabarito: ' + esc(nomeGab(q)) + '.</b> ' + marcarTermos(q.c, 3) + '</p>' + (nota ? '<p class="pequeno"><b>Sua regra:</b> ' + esc(nota) + '</p>' : '') + '</div>';
    }).join('') + (errados.length > 8 ? '<p class="pequeno mudo">Mais ' + (errados.length - 8) + ' no Caderno de Erros.</p>' : '') + '</details>';
}
// Ouvir o artigo: a voz do aparelho lê o texto vigente, sem as notas de redação; cada trecho lido conta como uso, para
// o relógio da leitura não parar enquanto a pessoa escuta. Sai do artigo, a voz para.
let falando = null;
const PODE_FALAR = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
function textoParaFala(a) {
  return (a.rotulo + '. ' + textoVigente(a))
    .replace(/\((Redação dada|Incluíd[oa]|Acrescid[oa]|Renumerad[oa]|Vide|Vigência|Regulamento)[^)]*\)/gi, '')
    .replace(/§§/g, 'parágrafos').replace(/§/g, 'parágrafo').replace(/\bArt\./g, 'Artigo').replace(/\bnº/g, 'número').replace(/\s+/g, ' ').trim();
}
function pararFala() { if (falando && PODE_FALAR) speechSynthesis.cancel(); falando = null; }
function rotuloFala(k) { return falando === k ? 'Parar a leitura em voz' : 'Ouvir o artigo'; }
function ouvirArtigo(k) {
  const a = ARTI.get(k);
  if (!a || !PODE_FALAR) return;
  if (falando === k) { pararFala(); } else {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(textoParaFala(a));
    u.lang = 'pt-BR';
    const voz = speechSynthesis.getVoices().find((v) => /^pt[-_]BR/i.test(v.lang)) || speechSynthesis.getVoices().find((v) => /^pt/i.test(v.lang));
    if (voz) u.voice = voz;
    u.onboundary = marcarUso;
    u.onend = u.onerror = () => { if (falando === k) { falando = null; const b = document.querySelector('[data-acao="ouvir-art"]'); if (b) b.textContent = rotuloFala(k); } };
    falando = k;
    speechSynthesis.speak(u);
    marcarUso();
  }
  const b = document.querySelector('[data-acao="ouvir-art"]');
  if (b) b.textContent = rotuloFala(k);
}
// Leitura fria: o artigo já lido em outro dia abre sem grifos, sem português claro e sem o glossário, para a pessoa
// achar sozinha prazos, verbos e exceções, como vai ler na prova; um toque traz tudo de volta para conferir.
const FRIA_VISTA = new Set();
function leituraFria(k) { const d = (S.perfil.lidos || {})[k]; return !!d && d < hojeISO() && !FRIA_VISTA.has(k); }
function renderArtigo(k) {
  if (falando && falando !== k) pararFala();
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
  const dArt = diagnosticoArtigo(k);
  let avisoVuln = '';
  if (dArt.tot > 0) {
    if (dArt.nivel === 'vermelho') {
      avisoVuln = '<div class="aviso-vulnerabilidade verm"><div><b>Ponto Crítico Cebraspe:</b> ' + (dArt.taxa != null ? dArt.taxa + '% de acerto (' + dArt.c + 'C / ' + dArt.e + 'E)' : 'Sem acertos consolidados') + (dArt.pendentes ? ' · ' + pl(dArt.pendentes, 'questão', 'questões') + ' com erro pendente' : '') + '.</div>' +
        (qs.length ? '<button class="btn pequeno primario" data-acao="treinar-art" data-art="' + esc(k) + '">Treinar questões (' + qs.length + ')</button>' : '') + '</div>';
    } else if (dArt.nivel === 'amarelo') {
      avisoVuln = '<div class="aviso-vulnerabilidade amar"><div><b>Artigo em Atenção:</b> ' + (dArt.taxa != null ? dArt.taxa + '% de acerto (' + dArt.c + 'C / ' + dArt.e + 'E)' : 'Artigo relevante (' + '★'.repeat(dArt.est) + ') ainda não testado') + '.</div>' +
        (qs.length ? '<button class="btn pequeno" data-acao="treinar-art" data-art="' + esc(k) + '">Treinar questões (' + qs.length + ')</button>' : '') + '</div>';
    } else if (dArt.nivel === 'verde') {
      avisoVuln = '<div class="aviso-vulnerabilidade verd"><div><b>Artigo Dominado:</b> ' + dArt.taxa + '% de acerto consolidado nas questões resolvidas (' + dArt.c + 'C / ' + dArt.e + 'E).</div></div>';
    }
  }
  const fria = leituraFria(k);
  html += '<div class="cartao' + (fria ? ' fria' : '') + '"><span class="rotulo">' + esc([L.curto].concat(a.estrutura).join(' · ')) + '</span><h2>' + esc(rotuloArt(k)) + (est ? ' <span class="estrelas" title="Importância no banco">' + '★'.repeat(est) + '</span>' : '') + '</h2>' +
    avisoVuln + gavetaErrosArt(qs) +
    (fria ? '<div class="fria-aviso"><span>Leitura fria: você já leu este artigo. Leia sem grifos e ache sozinho prazos, verbos e exceções.</span><button class="btn pequeno" data-acao="conferir-fria" data-art="' + esc(k) + '">Conferir com grifos</button></div>' : '') +
    htmlClaro(a) + legendaCamadas() + '<div class="texto-lei">' + textoLei(a) + '</div>' + caixaJuridiques(a) + '<div class="linha-btns">';
  if (qs.length) html += '<button class="btn primario" data-acao="treinar-art" data-art="' + esc(k) + '">Questões deste artigo (' + qs.length + ')</button>';
  if (cs.length) html += '<button class="btn" data-acao="cards-art" data-art="' + esc(k) + '">Cards deste artigo (' + cs.length + ')</button>';
  if (PODE_FALAR) html += '<button class="btn" data-acao="ouvir-art" data-art="' + esc(k) + '">' + rotuloFala(k) + '</button>';
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
  else if (sub === 'edital') el.innerHTML = voltarMais() + renderEditalANPD();
  else if (sub === 'raiox') el.innerHTML = voltarMais() + renderRaioXANPD();
  else if (sub === 'erros') el.innerHTML = voltarMais() + renderCadernoErros();
  else if (sub === 'cebraspe') el.innerHTML = voltarMais() + renderCebraspe();
  else if (sub === 'discursiva') el.innerHTML = (UI.discTema ? '' : voltarMais()) + renderDiscursiva() + (UI.discTema ? '' : htmlEsqueletos());
  else if (sub === 'contestacoes') el.innerHTML = voltarMais() + renderContestacoes();
  else if (sub === 'trilha') el.innerHTML = (UI.subtema ? '' : voltarMais()) + renderTrilhas();
  else if (sub === 'ajustes') el.innerHTML = voltarMais() + renderAjustes();
  else if (sub === 'personagem') el.innerHTML = voltarMais() + renderPersonagem();
  else {
    const pend = Object.values(S.pesquisa).filter((p) => !p.s).length;
    const item = (s, ic, t, d) => '<button data-acao="mais" data-sub="' + s + '"><span class="ic">' + ic + '</span><span class="tx"><b>' + t + '</b><span class="s">' + d + '</span></span><span class="mudo">›</span></button>';
    el.innerHTML = '<div class="secao-cab"><h2>Mais</h2></div><div class="menu-mais">' +
      item('trilha', '§', 'Trilhas do zero', TRILHAS.length + ' matérias por subtema, para quem começa: pré-teste, aula, prática e domínio') +
      item('metodo', '1·2', 'Método do Mentor (6 Degraus)', 'Ciclo semanal, degraus de foco, métricas semanais e checklist') +
      item('edital', '≡', 'Edital Projetado e Verticalizado', '10 disciplinas, 38 tópicos com prioridades A/B/C e treino direto') +
      item('raiox', '◎', 'Raio-X do Concurso ANPD', 'Diagnóstico da carreira, banca Cebraspe e sinergia com TCU') +
      item('erros', '✗', 'Caderno de Erros (4 causas)', (() => { const n = Object.keys(cadState().erros).length; return n ? pl(n, 'erro classificado', 'erros classificados') : 'Classifique cada erro e escreva a regra de 1 linha'; })()) +
      item('cebraspe', 'C/E', 'Como o Cebraspe cobra', 'A prova, o padrão por disciplina, itens reais e discursiva') +
      item('discursiva', '✎', 'Treino de discursiva', TEMAS_DISC.length + ' temas com quesitos no padrão Cebraspe, contador de linhas e nota estimada') +
      item('personagem', '♛', 'Personagem', 'Nível, atributos, equipamento, inventário e chefões derrotados') +
      item('progresso', '▥', 'Progresso', 'Domínio por bloco, constância, onde você cai, conquistas') +
      item('plano', '▦', 'Plano e cronograma', 'Seis fases até a prova (' + fmtData(dataProva(), { day: '2-digit', month: '2-digit', year: 'numeric' }) + '), status dos blocos, textos que faltam') +
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
  // Faixa de 95%: a incerteza do acerto nos itens reais (p ± 1,96·√(p(1−p)/n)) vale para a nota inteira, e cada ponto
  // percentual de acerto vira 2 pontos líquidos (2p − 1). Aproximação conservadora: as disciplinas medidas pelo banco
  // herdam a incerteza dos reais pela correção.
  const nota = peso ? (soma / peso) * PONTOS_PROVA : null;
  const pr = real.n ? real.c / real.n : null, meia = pr != null ? 2 * 1.96 * Math.sqrt((pr * (1 - pr)) / real.n) * PONTOS_PROVA : null;
  const faixa = nota != null && meia != null ? [Math.max(-PONTOS_PROVA, Math.round(nota - meia)), Math.min(PONTOS_PROVA, Math.round(nota + meia))] : null;
  const semReais = linhas.filter((l) => l.p != null && l.fonte !== 'reais').length, semDados = linhas.filter((l) => l.p == null).length;
  return { real, banco, fator, linhas, nota, faixa, semReais, semDados, cobre: peso / PONTOS_PROVA };
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
    html += '<div class="nota-final"><span class="grande">' + Math.round(pr.nota) + '</span><span class="mudo">de ' + PONTOS_PROVA + ' pontos líquidos, se marcasse a prova inteira hoje' + (pr.faixa ? '; com 95% de confiança, entre ' + pr.faixa[0] + ' e ' + pr.faixa[1] + ' (a faixa estreita conforme você responde itens reais)' : '') + (pr.cobre < 0.99 ? ' (estimativa sobre ' + Math.round(pr.cobre * 100) + '% da nota; o resto ainda não tem respostas)' : '') + (pr.semReais ? '. ' + pl(pr.semReais, 'disciplina é estimada', 'disciplinas são estimadas') + ' pelo banco, por ter menos de 10 itens reais respondidos' : '') + '</span></div>';
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
  html += '<p class="pequeno mudo">Conta só a primeira resposta de cada item certo/errado, no peso da nota (cada item vale ' + (PESO_ESPECIFICA === 1 ? '1' : '1 na básica e ' + PESO_ESPECIFICA + ' na específica') + '). ' + pl(livres, 'item real ainda inédito', 'itens reais ainda inéditos') + ' no banco. Nos simulados de prova completa, pelo menos metade de cada disciplina vem deles enquanto houver inéditos.</p></div>';
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
    '<p class="pequeno mudo">Pontos: nota com os pesos da prova (cada item vale ' + (PESO_ESPECIFICA === 1 ? '1' : '1 na básica e ' + PESO_ESPECIFICA + ' na específica') + '). Reais: acerto nos itens reais de prova do simulado.</p></div>';
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
  html += '</div><div class="cartao"><h2>Peso por disciplina</h2><div class="tabela-env"><table class="tabela"><thead><tr><th>Disciplina</th><th>Na nota</th><th>Prioridade</th></tr></thead><tbody>' + DISC.slice().sort((a, b) => (PONTOS_DISC[b.id] || 0) - (PONTOS_DISC[a.id] || 0)).map((d) => '<tr><td>' + esc(d.nome) + '</td><td class="num">' + (PONTOS_DISC[d.id] ? (Math.round((PONTOS_DISC[d.id] / PONTOS_PROVA) * 1000) / 10).toLocaleString('pt-BR') + '%' : '—') + '</td><td style="text-align:right"><span class="selo' + (d.peso === 'MÁXIMO' ? ' p1' : d.peso === 'ALTO' ? ' p2' : '') + '">' + esc(d.peso) + '</span></td></tr>').join('') + '</tbody></table></div><p class="pequeno mudo">Na nota: quanto a disciplina vale numa prova de ' + PONTOS_PROVA + ' pontos, em que cada item básico vale ' + PESO_BASICA + ' e cada específico vale ' + PESO_ESPECIFICA + (S.perfil.edital ? ' (edital informado em Ajustes).' : ' (projeção da Anatel 2024 até sair o edital).') + ' Prioridade: ordem de estudo do guia do cargo. Português e inglês entram um pouco todo dia, nas questões intercaladas.</p></div>';
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
  // Pendentes: só os 10 mais recentes de saída (a lista crescia mais rápido que dava para investigar); o resto, a um toque
  const todos = (UI.filtroPesq === 'feitos' ? feitos : pend).sort((a, b) => (a.d < b.d ? 1 : -1));
  const PESQ_VISIVEIS = 10, corta = UI.filtroPesq !== 'feitos' && !UI.pesqTodos && todos.length > PESQ_VISIVEIS;
  const vis = corta ? todos.slice(0, PESQ_VISIVEIS) : todos;
  let html = '<div class="secao-cab"><h2>Para pesquisar</h2><span class="mudo pequeno">' + pend.length + ' pendentes · ' + feitos.length + ' entendidos</span></div>' +
    '<p class="mudo pequeno">Quando você erra, os termos da questão entram aqui sozinhos. Em Investigar, o painel faz as perguntas, você escreve a resposta e o Claude confere, corrige pela norma e devolve uma pergunta para ir mais fundo. Depois marque como entendido (+5 XP).</p>' +
    '<div class="chips"><button class="chip" data-acao="filtro-pesq" data-f="pendentes" aria-pressed="' + (UI.filtroPesq !== 'feitos') + '">Pendentes</button><button class="chip" data-acao="filtro-pesq" data-f="feitos" aria-pressed="' + (UI.filtroPesq === 'feitos') + '">Entendidos</button></div>';
  html += '<div class="lista-pesq">' + (vis.length ? vis.map((x) => {
    const g = GLOSS.find((t) => t.t === x.t);
    return '<div class="pesq-linha' + (x.s ? ' feito' : '') + '"><input type="checkbox" data-acao="pesq-feito" data-k="' + esc(x.k) + '"' + (x.s ? ' checked' : '') + ' aria-label="Marcar como entendido"><div class="tx"><b>' + esc(x.t) + '</b><small>' + esc(x.o || '') + ' · ' + esc(fmtData(x.d, { day: '2-digit', month: '2-digit' })) + '</small>' +
      (g ? '<button class="linkish pequeno" data-acao="termo" data-t="' + g.i + '">Ver definição</button>' : '') + '</div><button class="btn pequeno" data-acao="investigar" data-t="' + esc(x.t) + '" data-o="' + esc(x.o || '') + '">Investigar</button></div>';
  }).join('') : '<p class="vazio-msg">' + (UI.filtroPesq === 'feitos' ? 'Nada marcado como entendido ainda.' : 'Lista vazia. Os temas sugeridos abaixo e os termos das questões erradas aparecem aqui.') + '</p>') + '</div>' +
    (corta ? '<button class="linkish pequeno" data-acao="pesq-todos">Mostrar os outros ' + (todos.length - PESQ_VISIVEIS) + ' pendentes</button>' : '');
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

function metricasSemanaMentor() {
  const semIni = semanaAtual();
  const hoje = hojeISO();
  let r = 0, c = 0, e = 0, b = 0, k = 0, seg = 0;
  for (const [iso, d] of Object.entries(S.perfil.dias || {})) {
    if (iso >= semIni && iso <= hoje) {
      r += d.r || 0;
      c += d.c || 0;
      e += d.e || 0;
      b += d.b || 0;
      k += d.k || 0;
      seg += segundosEstudo(d);
    }
  }
  const total = c + e;
  const liq = total > 0 ? (c - e) / total : 0;
  const liqPontos = c - e;
  const venc = listaVencida().length;
  const cardsV = cardsVencidos().length;
  const cad = cadState();
  const errosPendentes = Object.values(cad.erros || {}).filter((x) => !x.causa || x.causa === 'sem').length;
  const degrauAtual = cad.degrau || 1;
  const md = metricasDegrau(degrauAtual);

  let discSem = false;
  if (S.disc) {
    for (const t of Object.values(S.disc)) {
      if (t.tentativas && t.tentativas.some((x) => x.data && x.data >= semIni)) {
        discSem = true; break;
      }
      if (t.rascunho && t.rascunho.length >= 200 && S.perfil.feitos && S.perfil.feitos['disc:' + hoje]) {
        discSem = true; break;
      }
    }
  }

  return {
    semIni, r, c, e, b, k, seg, total, liq, liqPontos,
    venc, cardsV, revisaoTotal: venc + cardsV,
    errosPendentes, degrauAtual, md, discSem,
    metaQuestoes: 200, metaHorasSeg: 25 * 3600
  };
}

function fimDeSemana(iso = hojeISO()) {
  const d = diaSemana(iso);
  return d === 0 || d === 6;
}

function cartaoTaticoMentorando(forcar = false) {
  if (!forcar && !fimDeSemana()) return '';
  const ms = metricasSemanaMentor();
  const deg = (D.mentor && D.mentor.metodo && D.mentor.metodo.degrausFoco && D.mentor.metodo.degrausFoco.find((x) => x.ordem === ms.degrauAtual)) || { bloco: 'Núcleo Duro ANPD', ordem: 1 };
  const liqPct = ms.total > 0 ? (ms.liq >= 0 ? '+' : '') + Math.round(ms.liq * 100) + '%' : '—';
  const liqCor = ms.total === 0 ? 'var(--mudo)' : ms.liq >= 0.6 ? 'var(--certo)' : ms.liq >= 0.4 ? 'var(--accent)' : 'var(--errado)';
  const pctQ = Math.min(100, Math.round((ms.r / ms.metaQuestoes) * 100));

  let prescricao = '';
  let acaoSugerida = '';
  if (ms.revisaoTotal > 0) {
    prescricao = '<b>Atenção à curva do esquecimento:</b> Você possui <b>' + pl(ms.revisaoTotal, 'item pendente', 'itens pendentes') + '</b> de revisão espaçada (' + ms.venc + ' questões, ' + ms.cardsV + ' cards). No Método ANPD, zerar revisões vem antes de avançar para evitar o acúmulo de pontos cegos.';
    acaoSugerida = '<button class="btn pequeno primario" data-acao="iniciar-revisao">Zerar revisão agora</button>';
  } else if (ms.md.totalRespostas >= 40 && ms.md.pronto && ms.degrauAtual < 6) {
    prescricao = '<b>Meta de Degrau Atingida:</b> Parabéns! Você atingiu domínio no <b>' + ms.degrauAtual + 'º Degrau</b> (' + Math.round(ms.md.dom * 100) + '% domínio, nota líquida ' + (ms.md.liq >= 0 ? '+' : '') + ms.md.liq.toFixed(2).replace('.', ',') + '). O mentor recomenda promover seu degrau ativo para o próximo nível!';
    acaoSugerida = '<button class="btn pequeno primario" data-acao="anpd-set-degrau" data-deg="' + (ms.degrauAtual + 1) + '">Avançar para o ' + (ms.degrauAtual + 1) + 'º Degrau</button>';
  } else if (ms.errosPendentes > 0) {
    prescricao = '<b>Blindagem de Lacunas:</b> Você possui <b>' + pl(ms.errosPendentes, 'erro não classificado', 'erros não classificados') + '</b> no Caderno de Erros. Classifique a causa (Conceito, Pegadinha, Leitura ou Chute) e registre sua regra de 1 linha.';
    acaoSugerida = '<button class="btn pequeno primario" data-acao="mais" data-sub="erros">Classificar erros (' + ms.errosPendentes + ')</button>';
  } else if (ms.total > 15 && ms.liq < 0.6) {
    prescricao = '<b>Calibragem Cebraspe:</b> Sua nota líquida da semana está em ' + liqPct + ' (meta: ≥ +60%). Lembre-se: no Cebraspe, 1 erro anula 1 acerto. Deixe em branco itens com termos absolutos suspeitos (“sempre”, “incondicionalmente”, “indelegável”) se não tiver 100% de certeza.';
    acaoSugerida = '<button class="btn pequeno" data-acao="mais" data-sub="cebraspe">Ver armadilhas Cebraspe</button>';
  } else {
    prescricao = '<b>Ritmo Firme e Consistente:</b> Memória blindada e sem revisões atrasadas. Seu degrau ativo é o <b>' + ms.degrauAtual + 'º Degrau (' + esc(deg.bloco) + ')</b>. Siga o roteiro de 9 passos de 90 min com foco nas peculiaridades da banca Cebraspe.';
    acaoSugerida = '<button class="btn pequeno primario" data-acao="mais" data-sub="metodo">Ver ciclo e degraus</button>';
  }

  let html = '<div class="cartao destaque termometro-card" style="border-left:4px solid var(--accent);margin-bottom:14px">' +
    '<div class="secao-cab"><div style="display:flex;align-items:center;gap:8px">' +
    '<span class="selo p1" style="font-weight:700">Balanço Semanal do Mentorando</span>' +
    '<span class="mono pequeno mudo">' + esc(fmtData(ms.semIni, { day: '2-digit', month: '2-digit' })) + ' a ' + esc(fmtData(hojeISO(), { day: '2-digit', month: '2-digit' })) + '</span>' +
    '</div><button class="linkish pequeno" data-acao="mais" data-sub="metodo">Método 6 Degraus ›</button></div>' +
    '<div class="estat" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:10px 0 12px">' +
    '<div style="padding:8px 10px;background:var(--surface);border-radius:var(--raio)">' +
      '<b class="mono" style="font-size:1.15rem">' + ms.r + ' <span class="pequeno mudo" style="font-size:.75rem">/ ' + ms.metaQuestoes + '</span></b>' +
      '<span style="font-size:.76rem">itens na semana</span>' +
      '<div class="barra" style="height:4px;margin-top:6px"><i style="width:' + pctQ + '%"></i></div>' +
    '</div>' +
    '<div style="padding:8px 10px;background:var(--surface);border-radius:var(--raio)">' +
      '<b class="mono" style="font-size:1.15rem;color:' + liqCor + '">' + liqPct + '</b>' +
      '<span style="font-size:.76rem">líquido Cebraspe (meta ≥ +60%)</span>' +
    '</div>' +
    '<div style="padding:8px 10px;background:var(--surface);border-radius:var(--raio)">' +
      '<b class="mono" style="font-size:1.15rem">' + ms.degrauAtual + 'º <span class="pequeno mudo" style="font-size:.75rem">/ 6</span></b>' +
      '<span style="font-size:.76rem">degrau ativo (' + Math.round(ms.md.dom * 100) + '% dom)</span>' +
    '</div>' +
    '<div style="padding:8px 10px;background:var(--surface);border-radius:var(--raio)">' +
      '<b class="mono" style="font-size:1.15rem;' + (ms.revisaoTotal ? 'color:var(--errado)' : 'color:var(--certo)') + '">' + (ms.revisaoTotal ? ms.revisaoTotal : '✓ 0') + '</b>' +
      '<span style="font-size:.76rem">' + (ms.revisaoTotal ? 'revisões pendentes' : 'revisão em dia') + '</span>' +
    '</div>' +
    '</div>' +
    '<div style="background:var(--surface);padding:10px 12px;border-radius:var(--raio);font-size:.86rem;border-left:3px solid var(--accent)">' +
    '<p style="margin:0 0 6px 0;line-height:1.45">' + prescricao + '</p>' +
    '<div class="linha-btns" style="margin-top:4px">' + acaoSugerida +
    '<button class="btn pequeno" data-acao="anpd-treino-rapido" data-deg="' + ms.degrauAtual + '">Treinar 20 itens do ' + ms.degrauAtual + 'º Degrau</button>' +
    '</div></div>' +
    '</div>';
  return html;
}

function metricasDegrau(degNum) {
  const discs = new Set(DISC.filter((d) => d.degrau === degNum).map((d) => d.id));
  const qs = Q.filter((q) => { const b = BI.get(q.b); return b && discs.has(b.disciplina); });
  let resp = 0, c = 0, e = 0, domSoma = 0;
  for (const q of qs) {
    const r = rec(q.id);
    if (!r || r[0] < 0) continue;
    resp++;
    c += r[2] || 0;
    e += r[3] || 0;
    domSoma += dominioItem(q.id);
  }
  const totalRespostas = c + e;
  const liq = totalRespostas ? (c - e) / totalRespostas : 0;
  return { totalQ: qs.length, resp, totalRespostas, liq, dom: qs.length ? domSoma / qs.length : 0, pronto: resp >= 40 && liq >= 0.6 };
}

function cartaoFaseANPD() {
  const c = cadState();
  const f = c.fase || 'f2';
  let html = '<div class="cartao anpd-banner-fase"><div class="secao-cab"><h2>Fase e Ciclo do Método ANPD</h2>' +
    '<div class="chips"><button class="linkish pequeno" data-acao="mais" data-sub="raiox">Ver Raio-X</button>' +
    '<button class="linkish pequeno" data-acao="mais" data-sub="edital">Ver Edital Verticalizado</button></div></div>' +
    '<div class="chips" role="group" aria-label="Fase de preparação">' +
    [['f1', 'Fase 1 · Base ANPD + Tronco TCU'], ['f2', 'Fase 2 · Ciclo 25h e 6 Degraus'], ['f3', 'Fase 3 · Reta Final Pós-Edital']].map(([id, rot]) => '<button class="chip" data-acao="anpd-set-fase" data-fase="' + id + '" aria-pressed="' + (f === id) + '">' + rot + '</button>').join('') +
    '</div>';
  if (f === 'f1') {
    html += '<p class="pequeno mudo">Pré-edital com foco em construção de base: <b>18 a 25 horas semanais</b> divididas entre o Núcleo Duro da ANPD (LGPD, 7 Resoluções, ECA Digital e Regulação) e o <b>Tronco Comum</b> compartilhado com o TCU (Constitucional, Administrativo, Gestão, Economia e Português), trazido do Painel TCU com 1 clique (Ajustes), quando os dois estão abertos no mesmo navegador.</p>';
  } else if (f === 'f2') {
    html += '<p class="pequeno mudo">Fase de tração e fechamento de lacunas: <b>25 horas por semana</b> organizadas no ciclo rotativo com foco na subida dos <b>6 Degraus de Prioridade</b>. Só avance para o próximo degrau quando atingir a nota líquida de saída (≥ +0,60).</p>';
  } else {
    html += '<p class="pequeno mudo">Pós-edital anunciado ou publicado: <b>35 a 40 horas semanais</b> com foco em velocidade de resolução de itens Cebraspe (450+ questões/semana), simulados de 120 itens todo sábado e treino intensivo das 4 causas de erro do Caderno de Erros.</p>';
  }
  html += '</div>';
  return html;
}

function renderMetodo() {
  const mt = (D.mentor && D.mentor.metodo) || {};
  if (!mt.degrausFoco) {
    return '<div class="prosa"><h2>Método Operacional ANPD</h2><p>Carregando método...</p></div>';
  }
  const c = cadState();
  const semKey = semanaAtual();
  const chk = (c.checkSem && c.checkSem[semKey]) || {};
  let html = '<div class="prosa"><h2>Método do Mentor · Especialista em Regulação ANPD</h2>' +
    '<p>Roteiro operacional de estudo focado na carreira de regulação da ANPD: 6 métricas semanais quantitativas, subida sequencial pelos 6 Degraus de Prioridade, ciclo de 25 horas e checklist semanal de controle.</p></div>';
  html += cartaoFaseANPD();
  html += cartaoTaticoMentorando(true);

  html += '<div class="cartao"><div class="secao-cab"><h2>1. As 6 métricas semanais do método</h2><span class="selo mono">Controle por números</span></div>' +
    '<div class="tabela-env"><table class="tabela"><thead><tr><th>Métrica</th><th>Como medir</th><th>Meta por fase</th></tr></thead><tbody>' +
    mt.metricasSemanais.map((m) => '<tr><td><b>' + esc(m.metrica) + '</b></td><td class="pequeno">' + esc(m.como) + '</td><td><b>' + esc(m.meta) + '</b></td></tr>').join('') +
    '</tbody></table></div></div>';

  html += '<div class="cartao"><div class="secao-cab"><h2>2. Os 6 Degraus de Prioridade (Subida em Sequência)</h2><span class="selo p1">Nota líquida ≥ +0,60</span></div>' +
    '<p class="pequeno mudo">Não estude as 10 disciplinas ao mesmo tempo sem critério. Suba um degrau de foco por vez; ao atingir a meta de saída, a disciplina entra em modo de manutenção no ciclo semanal (questões intercaladas + revisão espaçada).</p>' +
    mt.degrausFoco.map((d) => {
      const md = metricasDegrau(d.ordem);
      const ativo = Number(c.degrau || 1) === d.ordem;
      const discsDeg = d.discs || DISC.filter((x) => x.degrau === d.ordem).map((x) => x.id);
      const blocosDeg = BLOCOS.filter((b) => discsDeg.includes(b.disciplina)).map((b) => b.id);
      return '<div class="anpd-degrau' + (ativo ? ' ativo' : '') + (md.pronto ? ' ok' : '') + '">' +
        '<div class="secao-cab"><b>' + d.ordem + 'º degrau · ' + esc(d.bloco) + '</b><span class="mono pequeno">' + (md.pronto ? '✓ Meta atingida' : Math.round(md.dom * 100) + '% domínio · ' + md.resp + ' itens vistos') + '</span></div>' +
        '<p class="pequeno" style="margin:4px 0">' + esc(d.motivo) + '</p>' +
        '<p class="pequeno mudo">Critério para avançar: <b>' + esc(d.saida) + '</b> · Nota líquida atual: <b>' + (md.totalRespostas ? (md.liq >= 0 ? '+' : '') + md.liq.toFixed(2).replace('.', ',') : '—') + '</b></p>' +
        '<div class="linha-btns"><button class="btn pequeno' + (ativo ? ' primario' : '') + '" data-acao="anpd-treino-rapido" data-blocos="' + esc(blocosDeg.join(',')) + '" data-tit="Degrau ' + d.ordem + ' · ' + esc(d.bloco) + '">Treinar 20 itens deste degrau</button>' +
        (ativo ? '<span class="selo ok">Degrau ativo no ciclo</span>' : '<button class="btn pequeno" data-acao="anpd-set-degrau" data-deg="' + d.ordem + '">Definir como degrau ativo</button>') +
        '</div></div>';
    }).join('') + '</div>';

  // O ciclo do mentor é de 25 h; aqui ele vai para as horas que a pessoa de fato estudou por semana, nas mesmas proporções
  const hs = horasSemana(), H = hs ? Math.max(1, Math.round(hs * 2) / 2) : 25;
  html += '<div class="cartao"><div class="secao-cab"><h2>3. Ciclo semanal (Fase 2)</h2><span class="selo mono">Soma = ' + fmtDur(H * 3600) + '</span></div>' +
    '<p class="pequeno mudo">' + (hs ? 'Nas suas horas reais: ' + fmtDur(hs * 3600) + ' por semana na média das duas últimas semanas (o cronômetro do dia). As proporções são as do ciclo de 25 h do mentor; nenhuma disciplina fica abandonada.' : 'Ciclo de referência de 25 h. Depois de 5 dias de estudo nas duas últimas semanas, as horas passam a seguir o seu tempo real, nas mesmas proporções. Nenhuma disciplina fica abandonada.') + '</p>' +
    '<div class="tabela-env"><table class="tabela"><thead><tr><th>Bloco do ciclo</th><th>Horas</th><th>%</th><th>Ação rápida</th></tr></thead><tbody>' +
    mt.ciclo25h.map((c) => {
      const pct = Math.round((c.horas / 25) * 100);
      return '<tr><td><b>' + esc(c.materia) + '</b></td><td class="mono">' + fmtDur(Math.round((c.horas / 25) * H * 4) / 4 * 3600) + '</td><td class="mono">' + pct + '%</td><td>' +
        '<button class="btn pequeno" data-acao="treinar-bloco" data-bloco="' + esc(c.bloco) + '">Treinar</button></td></tr>';
    }).join('') +
    '</tbody></table></div></div>';

  html += '<div class="cartao"><div class="secao-cab"><h2>4. Como estudar cada tipo de conteúdo</h2></div>' +
    '<div class="tabela-env"><table class="tabela"><thead><tr><th>Tipo</th><th>Matérias</th><th>Como estudar</th><th>Erro que mais reprova</th></tr></thead><tbody>' +
    mt.tecnicaPorTipo.map((tp) => '<tr><td><b>' + esc(tp.tipo) + '</b></td><td class="pequeno">' + esc(tp.materias) + '</td><td class="pequeno">' + esc(tp.como) + '</td><td class="pequeno mudo">' + esc(tp.erro) + '</td></tr>').join('') +
    '</tbody></table></div>' +
    '<h3>Espelhos de prova Cebraspe para usar como banco de treino</h3>' +
    '<div class="tabela-env"><table class="tabela"><thead><tr><th>Prova</th><th>Para que usar</th><th>Link oficial</th></tr></thead><tbody>' +
    mt.provasTreino.map((p) => '<tr><td><b>' + esc(p.prova) + '</b></td><td class="pequeno">' + esc(p.uso) + '</td><td><a class="linkish pequeno" href="' + esc(p.url) + '" target="_blank" rel="noopener">Abrir ↗</a></td></tr>').join('') +
    '</tbody></table></div></div>';

  html += '<div class="cartao"><div class="secao-cab"><h2>5. Materiais de referência e fontes primárias</h2></div>' +
    '<div class="tabela-env"><table class="tabela"><thead><tr><th>Disciplina</th><th>Fontes primárias (obrigatórias)</th><th>Livro ou curso de apoio</th><th>Observação</th></tr></thead><tbody>' +
    mt.materiaisPorDisciplina.map((m) => '<tr><td><b>' + esc(m.mat) + '</b></td><td class="pequeno">' + esc(m.primarias) + '</td><td class="pequeno">' + esc(m.livro) + '</td><td class="pequeno mudo">' + esc(m.obs) + '</td></tr>').join('') +
    '</tbody></table></div></div>';

  html += '<div class="cartao"><div class="secao-cab"><h2>6. Reta Final Pós-Edital (16 Semanas)</h2><span class="selo p1">35–40h/sem · 450+ questões/sem</span></div>' +
    '<div class="tabela-env"><table class="tabela"><thead><tr><th>Período</th><th>Foco principal</th></tr></thead><tbody>' +
    (mt.retaFinal16Semanas || []).map((r) => '<tr><td><b>' + esc(r.semanas) + '</b></td><td>' + esc(r.foco) + '</td></tr>').join('') +
    '</tbody></table></div></div>';

  const ms = metricasSemanaMentor();
  const chkFeitos = Object.values(chk).filter(Boolean).length;
  const chkTotal = (mt.checklistSemanal && mt.checklistSemanal.length) || 7;
  const chkPct = Math.min(100, Math.round((chkFeitos / chkTotal) * 100));

  html += '<div class="cartao destaque termometro-card"><div class="secao-cab">' +
    '<div><h2>7. Checklist Operacional da Semana</h2>' +
    '<span class="mono pequeno mudo">' + esc(fmtData(semKey, { day: '2-digit', month: '2-digit' })) + ' · ' + chkFeitos + ' de ' + chkTotal + ' metas cumpridas</span></div>' +
    '<span class="selo ' + (chkFeitos === chkTotal ? 'ok' : 'p1') + '">' + (chkFeitos === chkTotal ? '✓ Semana Completa (+50 XP)' : chkPct + '% concluído') + '</span></div>' +
    '<div class="barra" style="margin:8px 0 12px"><i style="width:' + chkPct + '%"></i></div>' +
    '<p class="pequeno mudo">Cada item cumprido concede <b>+15 XP</b>. Fechar as 7 metas na semana concede <b>+50 XP de Bônus de Excelência</b>.</p>' +
    '<div class="lista-pesq">' +
    (mt.checklistSemanal || []).map((item, i) => {
      let dicaAuto = '';
      if (i === 0) dicaAuto = ms.revisaoTotal === 0 ? '<span class="selo ok pequeno" style="margin-left:6px">✓ Zerado hoje</span>' : '<span class="selo p2 pequeno" style="margin-left:6px">' + ms.revisaoTotal + ' pendentes</span>';
      else if (i === 1) dicaAuto = '<span class="selo mono pequeno" style="margin-left:6px">' + ms.r + '/200 itens · ' + (ms.total > 0 ? (ms.liq >= 0 ? '+' : '') + Math.round(ms.liq * 100) + '% líq' : '0%') + '</span>';
      else if (i === 3) dicaAuto = ms.errosPendentes === 0 ? '<span class="selo ok pequeno" style="margin-left:6px">✓ 100% classificados</span>' : '<span class="selo p2 pequeno" style="margin-left:6px">' + ms.errosPendentes + ' sem classificar</span>';
      else if (i === 5) dicaAuto = ms.discSem ? '<span class="selo ok pequeno" style="margin-left:6px">✓ Feito na semana</span>' : '<span class="selo mono pequeno" style="margin-left:6px">Pendente para sábado</span>';
      return '<label class="pesq-linha' + (chk[i] ? ' feito' : '') + '"><input type="checkbox" data-acao="anpd-check-sem" data-i="' + i + '"' + (chk[i] ? ' checked' : '') + '><div class="tx"><b>' + esc(item.texto || item) + '</b> ' + dicaAuto + '</div></label>';
    }).join('') +
    '</div></div>';

  html += '<div class="cartao"><details><summary><b>Princípios operacionais e regras do app (Expandir)</b></summary><div class="prosa" style="margin-top:10px">' +
    '<h3>Regras que não se negociam</h3><ul>' +
    '<li>O erro entra na lista curta e volta com intervalos crescentes (no mesmo dia, depois de 1 dia, depois de 3 dias): sai da lista depois de três acertos seguidos, e errou de novo, recomeça.</li>' +
    '<li>Interpretação de texto não volta na revisão: reler o mesmo texto ensina o gabarito, não a leitura. No lugar, as sessões trazem textos inéditos.</li>' +
    '<li>Intercale. Todo dia faça uma sessão mista com blocos já estudados para fixação ativa.</li>' +
    '<li>Revisão vem antes de matéria nova: zere a lista curta e os cards cloze vencidos antes de abrir novo conteúdo.</li>' +
    '<li>Discursiva todo sábado: escreva no limite de linhas (30–45) sem consulta, usando os esqueletos técnicos.</li>' +
    '</ul></div></details></div>';

  return html;
}

function renderRaioXANPD() {
  const rx = (D.mentor && D.mentor.raiox) || {};
  if (!rx.veredito) return '<div class="prosa"><h2>Raio-X ANPD</h2><p>Carregando Raio-X...</p></div>';
  let html = '<div class="prosa"><h2>Raio-X — Especialista em Regulação de Proteção de Dados (ANPD)</h2><p class="pequeno mudo">Atualizado em ' + esc(rx.atualizadoEm) + ' · Diagnóstico do cargo, banca Cebraspe, histórico e sinergia com TCU</p></div>';
  html += '<div class="cartao destaque"><span class="rotulo">Veredito do mentor</span>' +
    rx.veredito.map((p, i) => '<p' + (i === 0 || i === rx.veredito.length - 1 ? ' style="font-weight:600"' : ' class="pequeno"') + '>' + esc(p) + '</p>').join('') +
    '</div>';

  html += '<div class="cartao"><div class="secao-cab"><h2>Situação atual (' + esc(rx.atualizadoEm) + ')</h2><span class="selo p1">Concurso efetivo · pré-edital</span></div>' +
    '<div class="tabela-env"><table class="tabela"><thead><tr><th>Item</th><th>Situação</th></tr></thead><tbody>' +
    rx.situacao.map((s) => '<tr><td><b>' + esc(s.item) + '</b></td><td>' + esc(s.valor) + '</td></tr>').join('') +
    '</tbody></table></div>' +
    '<h3>Sinais a monitorar, nesta ordem</h3><ol class="lista-cb">' + rx.sinais.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol></div>';

  html += '<div class="cartao"><div class="secao-cab"><h2>O cargo e a carreira (Lei nº 15.352/2026)</h2><span class="selo mono">40h · Brasília</span></div>' +
    '<div class="tabela-env"><table class="tabela"><thead><tr><th>Componente</th><th>Valor ou regra</th></tr></thead><tbody>' +
    rx.remuneracao.map((r) => '<tr><td><b>' + esc(r.comp) + '</b></td><td>' + esc(r.val) + '</td></tr>').join('') +
    '</tbody></table></div>' +
    '<h3>Atribuições típicas do Especialista em Regulação da ANPD</h3><ul class="lista-cb">' +
    rx.atribuicoes.map((a) => '<li>' + esc(a) + '</li>').join('') + '</ul></div>';

  html += '<div class="cartao"><h2>Histórico de editais e espelhos Cebraspe</h2>' +
    '<div class="tabela-env"><table class="tabela"><thead><tr><th>Concurso</th><th>Banca</th><th>Vagas</th><th>Inscritos</th><th>Observação</th></tr></thead><tbody>' +
    rx.historicoEditais.map((h) => '<tr><td><b>' + esc(h.ano + ' · ' + h.banca) + '</b></td><td class="mono">' + esc(h.banca) + '</td><td class="mono">' + esc(h.vagas) + '</td><td class="mono">' + esc(h.inscritos) + '</td><td class="pequeno">' + esc(h.obs) + '</td></tr>').join('') +
    '</tbody></table></div>' + (rx.historicoNota ? '<p class="pequeno mudo">' + esc(rx.historicoNota) + '</p>' : '') + '</div>';

  html += '<div class="cartao"><h2>Comparativo: Cebraspe vs. PSS Anterior</h2>' +
    '<div class="tabela-env"><table class="tabela"><thead><tr><th>Aspecto</th><th>PSS Anterior (Temporários)</th><th>Concurso Efetivo (Cebraspe)</th></tr></thead><tbody>' +
    rx.comparativoBancas.map((cb) => '<tr><td><b>' + esc(cb.item) + '</b></td><td class="pequeno">' + esc(cb.pss) + '</td><td class="pequeno"><b>' + esc(cb.cebraspe) + '</b></td></tr>').join('') +
    '</tbody></table></div></div>';

  html += '<div class="cartao"><h2>Novidades regulatórias e marcos 2025/2026</h2><ul class="lista-cb">' +
    rx.novidades2025.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul></div>';

  return html;
}

function renderEditalANPD() {
  const ed = (D.mentor && (D.mentor.edital || D.mentor.edital2027)) || {};
  const fPrio = UI.edPrio || 'todas';
  const busca = semAcento((UI.edBusca || '').trim());
  let html = '<div class="prosa"><h2>Edital Projetado e Conteúdo Programático — ANPD</h2>' +
    '<p>Estrutura projetada para Especialista em Regulação com base na Lei 15.352/2026, Decreto 12.881/2026 e no padrão das agências federais no Cebraspe (Anatel, ANAC e BACEN). Clique em <b>Treinar</b> em qualquer tópico para abrir uma bateria direta com questões do bloco.</p></div>';

  if (ed.pesosProjetados && ed.pesosProjetados.length) {
    html += '<div class="cartao"><div class="secao-cab"><h2>Pesos projetados das 10 disciplinas</h2><span class="selo mono">Básicos vs. Específicos</span></div>' +
      '<div class="tabela-env"><table class="tabela"><thead><tr><th>Disciplina</th><th>Peso projetado</th><th>Bloco de prova</th><th>Justificativa</th></tr></thead><tbody>' +
      ed.pesosProjetados.map((p) => '<tr><td><b>' + esc(p.mat) + '</b></td><td class="mono"><b>' + esc(p.faixa) + '</b></td><td>' + esc(p.bloco) + '</td><td class="pequeno">' + esc(p.motivo) + '</td></tr>').join('') +
      '</tbody></table></div></div>';
  }

  const topicos = ed.topicos || [];
  html += '<div class="cartao"><div class="campo"><span class="rot">Filtrar por prioridade</span><div class="chips">' +
    [['todas', 'Todas (' + topicos.length + ' tópicos)'], ['A', 'Prioridade A (~70% da prova)'], ['B', 'Prioridade B (~20%)'], ['C', 'Prioridade C (~10%)']].map(([v, t]) => '<button class="chip" data-acao="ed-prio" data-v="' + v + '" aria-pressed="' + (fPrio === v) + '">' + t + '</button>').join('') +
    '</div></div>' +
    '<input class="busca" id="busca-edital" type="search" placeholder="Filtrar tópico, norma ou conceito no edital (ex.: legítimo interesse, encarregado, AIR, NIST, DPO)" value="' + esc(UI.edBusca || '') + '"></div>';

  const porMat = new Map();
  for (const t of topicos) {
    if (fPrio !== 'todas' && t.prio !== fPrio) continue;
    if (busca && !semAcento((t.grupo || '') + ' ' + (t.mat || '') + ' ' + (t.topico || '') + ' ' + (t.estudar || '')).includes(busca)) continue;
    if (!porMat.has(t.mat)) porMat.set(t.mat, { grupo: t.grupo, topicos: [] });
    porMat.get(t.mat).topicos.push(t);
  }

  for (const [matNome, info] of porMat.entries()) {
    html += '<div class="cartao"><div class="secao-cab"><h2>' + esc(matNome) + '</h2><span class="selo mono">' + esc(info.grupo) + ' · ' + info.topicos.length + ' tópicos</span></div><div>' +
      info.topicos.map((t) => {
        const nQ = (POR_BLOCO.get(t.bloco) || []).length;
        return '<div class="anpd-topico-linha"><div><div><span class="selo ' + (t.prio === 'A' ? 'p1' : t.prio === 'B' ? 'p2' : '') + '">Prio ' + esc(t.prio) + '</span> ' +
          '<span class="anpd-tag-hist">' + esc(t.hist || 'Core') + '</span> ' +
          '<b>' + esc(t.topico) + '</b></div>' +
          '<p class="pequeno mudo" style="margin:3px 0 0">' + esc(t.estudar) + '</p></div>' +
          (t.bloco && nQ ? '<button class="btn pequeno" data-acao="treinar-bloco" data-bloco="' + esc(t.bloco) + '">Treinar (' + nQ + ')</button>' : '') + '</div>';
      }).join('') + '</div></div>';
  }

  if (ed.provasTCs && ed.provasTCs.length) {
    html += '<div class="cartao"><h2>Espelhos Cebraspe para Especialista em Regulação</h2>' +
      '<div class="tabela-env"><table class="tabela"><thead><tr><th>Prova</th><th>Banca</th><th>Estrutura</th><th>O que sinaliza</th></tr></thead><tbody>' +
      ed.provasTCs.map((p) => '<tr><td><b>' + esc(p.prova) + '</b></td><td class="mono">' + esc(p.banca) + '</td><td class="pequeno">' + esc(p.est) + '</td><td class="pequeno mudo">' + esc(p.sinal) + '</td></tr>').join('') +
      '</tbody></table></div></div>';
  }

  if (ed.naoCaiu && ed.naoCaiu.length) {
    html += '<div class="cartao"><h2>O que NÃO priorizar no estudo (Custo × Benefício baixo)</h2><ul class="lista-cb">' +
      ed.naoCaiu.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul></div>';
  }
  return html;
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
// Passa o texto da caixa para o rascunho do tema aberto e grava (navegador na hora; conta logo em seguida)
function guardarRascunhoDisc() {
  const area = document.getElementById('disc-texto');
  if (!area || !UI.discTema || area.readOnly) return;
  estadoDisc(UI.discTema).rascunho = area.value;
  clearTimeout(timerDisc);
  Store.salvar('discursivas');
}
function crescerDisc(area) { area.style.height = 'auto'; area.style.height = area.scrollHeight + 'px'; }
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
    '<div class="secao-cab" style="margin-top:10px"><label class="rotulo" for="disc-texto">Folha de resposta (' + t.linhas + ' linhas)</label><span class="mudo pequeno mono" id="disc-cont">' + contadorDisc(t) + '</span></div>' +
    '<div class="regua-discursiva">' +
      '<textarea id="disc-texto" class="disc-area-30" rows="' + t.linhas + '" style="min-height:' + (t.linhas * 24 + 16) + 'px" spellcheck="false"' + (corrigindo ? ' readonly' : '') + ' placeholder="Escreva aqui o seu texto discursivo, parágrafo por parágrafo, contemplando todos os aspectos do comando...">' + esc(st.rascunho) + '</textarea>' +
    '</div>';
  if (!corrigindo) {
    html += CHECK_DISC;
    html += '<div class="linha-btns" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">' +
      '<button class="btn primario" data-acao="disc-corrigir">Terminei: corrigir pelos quesitos</button>' +
      '<button class="btn" data-acao="disc-salvar-rascunho" title="Salva imediatamente o rascunho no navegador">Salvar rascunho</button>' +
      '<button class="btn" data-acao="disc-limpar">Apagar e recomeçar</button>' +
      '<span id="disc-status-salvo" class="pequeno verde" style="font-weight:600"></span>' +
      '</div>';
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
  if (D.armadilhasANPD && D.armadilhasANPD.length) html += '<div class="cartao cb-disc" id="cb-armadilhas-anpd"><h2>As ' + D.armadilhasANPD.length + ' armadilhas que mais derrubam na ANPD</h2>' +
    D.armadilhasANPD.map((a) => '<div class="gloss-item"><b>' + esc(a.titulo) + '</b><p class="pequeno"><span class="selo p1">Errado</span> ' + esc(a.errado) + '</p><p class="pequeno"><span class="selo ok">Certo</span> ' + esc(a.certo) + '</p>' +
      '<div class="linha-btns"><button class="btn pequeno" data-acao="treinar-bloco" data-bloco="' + esc(a.bloco) + '">Treinar bloco</button></div></div>').join('') + '</div>';
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
  cb = cb || { padroes: [], disciplinas: [] };
  const conta = (lista, chave) => { const m = new Map(); for (const q of lista) { const k = chave(q); if (k) m.set(k, (m.get(k) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]); };
  const arts = conta(REAIS.filter((q) => q.l === 'lgpd'), (q) => q.art).slice(0, 8);
  const arms = conta(REAIS.filter((q) => q.l !== 'texto'), (q) => q.a).slice(0, 6);
  const rotArt = (a) => 'art. ' + a + (/^\d$/.test(a) ? 'º' : '');
  let html = '<div class="cartao cb-disc" id="cb-raiox"><h2>O que a banca repete</h2>' +
    '<p class="pequeno mudo">Contado nos ' + REAIS.length + ' itens reais do banco.</p>' +
    (arts.length ? '<p><b>Artigos da LGPD mais cobrados.</b> ' + arts.map(([a, n]) => esc(rotArt(a)) + ' (' + n + ')').join(' · ') + '</p>' : '') +
    '<p><b>Armadilhas mais frequentes nos itens de norma.</b> ' + arms.map(([a, n]) => esc((D.armadilhas && D.armadilhas[a]) || a) + ' (' + n + ')').join(' · ') + '</p>';
  for (const p of (cb.padroes || [])) {
    if (!p) continue;
    html += '<h3>' + esc(p.titulo || '') + '</h3><p>' + esc(p.texto || '') + '</p>' + (p.exemplos && p.exemplos.length ? '<div class="chips">' + p.exemplos.map(chip).join('') + '</div>' : '');
  }
  return html + '</div>';
}
// Edital e prova: quando o edital sair, a pessoa troca a projeção (Anatel 2024) pelos números oficiais
function cartaoEdital() {
  const ed = S.perfil.edital || {}, n = (v) => (v == null ? '' : esc(String(v)));
  const campo = (id, rot, v, extra) => '<label class="ed-campo"><span>' + rot + '</span><input id="' + id + '" type="number" min="0" step="' + (extra || 1) + '" inputmode="decimal" value="' + n(v) + '"></label>';
  const linhas = DISC.map((d) => '<tr><td>' + esc(d.nome) + '</td><td><input class="ed-n" data-parte="b" data-d="' + d.id + '" type="number" min="0" step="1" inputmode="numeric" value="' + (PROVA_BASICA[d.id] || '') + '" aria-label="' + esc(d.nome) + ', básica"></td><td><input class="ed-n" data-parte="e" data-d="' + d.id + '" type="number" min="0" step="1" inputmode="numeric" value="' + (PROVA_ESPECIFICA[d.id] || '') + '" aria-label="' + esc(d.nome) + ', específica"></td></tr>').join('');
  return '<div class="cartao" id="cartao-edital"><h2>Edital e prova</h2>' +
    '<p class="pequeno">' + (S.perfil.edital ? 'Valendo os números que você informou. O simulado da prova inteira, a régua de corte, a prontidão e a contagem até a prova seguem estes números.' : 'Valendo a projeção (estrutura da Anatel 2024 e prova provável em ' + fmtData(D.cronograma.prova, { day: '2-digit', month: '2-digit', year: 'numeric' }) + '). Quando o edital da ANPD sair, troque aqui: o simulado, a régua de corte, a prontidão e a contagem passam a seguir o edital.') + '</p>' +
    '<div class="ed-grade"><label class="ed-campo"><span>Data da prova</span><input id="ed-prova" type="date" value="' + n(ed.prova || '') + '"></label>' +
    campo('ed-pesob', 'Peso do item básico', PESO_BASICA, '0.5') + campo('ed-pesoe', 'Peso do item específico', PESO_ESPECIFICA, '0.5') +
    campo('ed-c1', 'Corte na básica (P1)', CORTES.p1) + campo('ed-c2', 'Corte na específica (P2)', CORTES.p2) + campo('ed-ct', 'Corte no conjunto', CORTES.total) + '</div>' +
    '<div class="tabela-env"><table class="tabela ed-tabela"><thead><tr><th>Disciplina</th><th>Itens na básica</th><th>Itens na específica</th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
    '<p class="pequeno mudo">Cortes em nota líquida (certas menos erradas, já com os pesos). Cada disciplina fica numa parte só; só a Regulação pode ir às duas (Lei 13.848 e Lei 9.784 na básica, o resto na específica). O cronograma não é refeito sozinho: se a data mudar muito, peça um plano novo.</p>' +
    '<p class="pequeno" id="ed-msg" role="status"></p>' +
    '<div class="linha-btns"><button class="btn primario" data-acao="edital-salvar">Salvar edital</button>' + (S.perfil.edital ? '<button class="btn" data-acao="edital-padrao">Voltar à projeção</button>' : '') + '</div></div>';
}
// Lê o cartão: devolve o edital ou uma mensagem do que está errado
function lerEdital() {
  const v = (id) => document.getElementById(id).value.trim();
  const num = (id) => (v(id) === '' ? NaN : Number(v(id)));
  const basica = {}, especifica = {};
  for (const el of document.querySelectorAll('#cartao-edital .ed-n')) {
    const k = el.value.trim() === '' ? 0 : Number(el.value);
    if (!Number.isInteger(k) || k < 0) return { erro: 'Itens por disciplina: use números inteiros (0 ou mais).' };
    if (k) (el.dataset.parte === 'b' ? basica : especifica)[el.dataset.d] = k;
  }
  const dupla = Object.keys(basica).find((d) => especifica[d] && d !== 'regulacao');
  if (dupla) return { erro: DI.get(dupla).nome + ' está nas duas partes. Ponha cada disciplina numa parte só (só a Regulação se divide).' };
  if (!Object.keys(basica).length || !Object.keys(especifica).length) return { erro: 'Ponha itens nas duas partes da prova.' };
  const pesoB = num('ed-pesob'), pesoE = num('ed-pesoe');
  if (!(pesoB > 0) || !(pesoE > 0)) return { erro: 'Os pesos precisam ser maiores que zero.' };
  const cortes = { p1: num('ed-c1'), p2: num('ed-c2'), total: num('ed-ct') };
  if (Object.values(cortes).some((c) => !(c >= 0))) return { erro: 'Os cortes precisam ser números (0 ou mais).' };
  const prova = v('ed-prova');
  if (prova && !/^\d{4}-\d{2}-\d{2}$/.test(prova)) return { erro: 'Data da prova inválida.' };
  const ed = { basica, especifica, pesoB, pesoE, cortes };
  if (prova) ed.prova = prova;
  return { ed };
}
function renderAjustes() {
  const metas = [30, 60, 90, 120, 150], novos = [5, 10, 15, 20, 30], auto = metaAuto();
  const dg = Store.diag;
  const linha = (rot, val, ok) => '<tr><td>' + rot + '</td><td class="' + (ok === true ? 'ok' : ok === false ? 'no' : '') + '">' + esc(val) + '</td></tr>';
  const st = (v) => (v === 'ok' ? true : v === '—' ? null : false);
  return '<div class="secao-cab"><h2>Ajustes</h2></div>' +
    '<div class="cartao destaque"><h2>Sincronizar com o Painel TCU</h2><p class="pequeno">Traz as respostas, cards e artigos lidos do tronco comum (Constitucional, Administrativo, LAI, Línguas, Gestão, Economia e Contabilidade) feitos no Painel TCU neste navegador. Fica o registro mais recente de cada item; nada é apagado.</p><div class="linha-btns"><button class="btn primario" data-acao="sync-tcu">⇄ Trazer progresso do Painel TCU</button></div></div>' +
    '<div class="cartao"><div class="campo"><span class="rot">Tema</span><div class="chips">' + TEMAS.map(([v, t]) => '<button class="chip" data-acao="tema" data-tema="' + v + '" aria-pressed="' + (UI.tema === v) + '">' + t + '</button>').join('') + '</div><p class="pequeno mudo">Automático segue o aparelho e o claude.ai. Noturno pelo horário fica escuro das 19h às 6h. A escolha fica salva na sua conta, como as demais preferências.</p></div></div>' +
    '<div class="cartao"><div class="campo"><span class="rot">Meta diária de questões</span><div class="chips">' +
      '<button class="chip" data-acao="meta" data-meta="auto" aria-pressed="' + !S.perfil.metaFixa + '">Pelo meu ritmo' + (auto ? ' · ' + auto : '') + '</button>' +
      metas.map((m) => '<button class="chip" data-acao="meta" data-meta="' + m + '" aria-pressed="' + (!!S.perfil.metaFixa && S.perfil.meta === m) + '">' + m + '</button>').join('') + '</div>' +
      '<p class="pequeno mudo">Pelo meu ritmo: 90% da mediana de itens por dia de estudo nas duas últimas semanas, recalculada a cada dia' + (auto ? '' : ' (começa depois de 5 dias de estudo; até lá vale ' + metaDia() + ')') + '. As missões do dia e a leitura do roteiro também seguem o seu ritmo.</p></div>' +
    '<div class="campo"><span class="rot">Cards novos por dia</span><div class="chips">' + novos.map((m) => '<button class="chip" data-acao="novos-cards" data-n="' + m + '" aria-pressed="' + ((S.perfil.novosCards || 20) === m) + '">' + m + '</button>').join('') + '</div><p class="pequeno mudo">Cada card novo volta várias vezes nos dias seguintes. Entram primeiro os de prazo, número e quórum; com mais de 60 revisões vencidas, os novos esperam a fila baixar.</p></div></div>' +
    cartaoEdital() +
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

/* ================= Caderno de erros ================= */
function cadState() {
  const c = (S.perfil.cad ||= {});
  c.erros ||= {};
  c.checkSem ||= {};
  if (!c.degrau) c.degrau = 1;
  if (!c.fase) c.fase = 'f2';
  return c;
}
function caixaCadernoErro(q) {
  const r = rec(q.id);
  const errouSessao = sessao && sessao.resp && sessao.resp[q.id] && sessao.resp[q.id] !== q.g && sessao.resp[q.id] !== BRANCO;
  if (!errouSessao && (!r || !r[3])) return '';
  const ce = cadState().erros[q.id] || {};
  return '<div class="cad-box" id="ce-box-' + esc(q.id) + '"><span class="rotulo">Caderno de Erros · Qual foi a causa?</span>' +
    '<div class="chips" style="margin:6px 0">' + CAUSAS_ERRO.map(([k, rot]) => '<button class="chip" data-acao="set-causa-erro" data-q="' + esc(q.id) + '" data-causa="' + k + '" aria-pressed="' + (ce.causa === k) + '">' + esc(rot) + '</button>').join('') + '</div>' +
    '<div style="display:flex;gap:6px;margin-top:6px"><input class="busca" id="ce-nota-' + esc(q.id) + '" style="font-size:.82rem" placeholder="Regra de 1 linha para não errar de novo (ex.: prazo é 3 dias úteis, não 72h)" value="' + esc(ce.nota || '') + '">' +
    '<button class="btn pequeno" data-acao="salvar-nota-erro" data-q="' + esc(q.id) + '">Salvar regra</button></div></div>';
}
// Autoverificação antes de corrigir a discursiva: o que a banca cobra na forma de uma manifestação técnica (nota técnica
// ou parecer). Só marca para a própria pessoa conferir; não entra na nota.
const CHECK_DISC = '<details class="check-disc"><summary>Antes de corrigir: confira o texto</summary><ul>' + [
  'Respondi a todos os aspectos do comando, na ordem pedida.',
  'Cada afirmação jurídica tem o dispositivo (artigo, inciso, resolução).',
  'Enquadrei os agentes (controlador, operador, encarregado) e a hipótese legal (art. 7º ou, para dado sensível, art. 11).',
  'Disse quem decide e com base em quê: ANPD, Conselho Diretor, Coordenação-Geral de Fiscalização, com a norma que dá a competência.',
  'Fechei com uma conclusão que responde à pergunta do comando, sem tema novo.',
  'Fiquei dentro do limite de linhas e sem marcas de identificação.',
].map((x) => '<li><label><input type="checkbox"> ' + x + '</label></li>').join('') + '</ul></details>';
const CAUSAS_ERRO = [
  ['nao-sabia', 'Não sabia o ponto', 'Voltar à lei seca só naquele dispositivo e revisar os cards do artigo.'],
  ['leu-errado', 'Li errado o comando', 'Sublinhar as palavras de comando (exceto, somente, vedado, pode, deve) antes de julgar o item.'],
  ['pegadinha', 'Caí em pegadinha conhecida', 'Anotar o par de termos que a banca trocou (ex.: 3 dias úteis × 72 horas; 2% × 4%; controlador × encarregado).'],
  ['chute', 'Chutei sem convicção', 'No Cebraspe, chute duvidoso dá prejuízo esperado negativo. Deixe em branco se a chance for < 50%.'],
];
function causaDe(k) { return CAUSAS_ERRO.find((c) => c[0] === k); }
// Causa do erro marcada na hora, na própria correção do item; vai para o Caderno de Erros e para o placar de causas
function renderCausaAgora(q) {
  const atual = (cadState().erros[q.id] || {}).causa;
  return '<div class="causa-agora" role="group" aria-label="Por que errou"><span class="pequeno">Por que errou?</span><div class="chips">' +
    CAUSAS_ERRO.map(([k, rot]) => '<button class="chip" data-acao="causa-agora" data-causa="' + k + '" aria-pressed="' + (atual === k) + '">' + esc(rot) + '</button>').join('') + '</div>' +
    (atual ? '<p class="pequeno mudo">' + esc(causaDe(atual)[2]) + '</p>' : '') +
    // Não sabia o ponto: o caminho para o artigo fica ali mesmo, no lugar do erro
    (atual === 'nao-sabia' && q.art && ARTI.get(chave(q.l, q.art)) ? '<div class="linha-btns">' + botaoArt(chave(q.l, q.art), q.id, 'Abrir o artigo agora') + '</div>' : '') + '</div>';
}
function errosDoBanco() {
  return Q.filter((q) => { const r = rec(q.id); return (r && r[3] > 0) || (cadState().erros[q.id] && cadState().erros[q.id].causa); });
}
function renderCadernoErros() {
  const ce = cadState().erros;
  const filtro = UI.filtroCausa || 'todas';
  const erradas = errosDoBanco();
  const cont = { 'nao-sabia': 0, 'leu-errado': 0, 'pegadinha': 0, 'chute': 0, 'sem': 0 };
  for (const q of erradas) {
    const c = (ce[q.id] && ce[q.id].causa) || 'sem';
    cont[c] = (cont[c] || 0) + 1;
  }
  const filtradas = erradas.filter((q) => {
    const c = (ce[q.id] && ce[q.id].causa) || 'sem';
    return filtro === 'todas' || c === filtro;
  });
  let html = '<div class="prosa" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">' +
    '<div style="flex:1;min-width:260px"><h2>Caderno de Erros · Diagnóstico por Causa</h2>' +
    '<p>O Cebraspe pune a repetição do mesmo erro. Classifique cada item que você errou em uma das quatro causas do método e escreva a regra de 1 linha para não cair de novo.</p></div>' +
    '<button class="btn pequeno primario" data-acao="imprimir-folha-vespera" style="align-self:flex-start;margin-top:4px">Folha de véspera</button>' +
    '</div>';
  html += '<div class="cad-grid">' +
    CAUSAS_ERRO.map(([k, rot, rem]) => '<div class="cad-kpi"><b>' + (cont[k] || 0) + ' · ' + esc(rot) + '</b><span>' + esc(rem) + '</span>' +
      (cont[k] ? '<div class="linha-btns" style="margin-top:6px"><button class="btn pequeno primario" data-acao="treinar-causa-erro" data-causa="' + k + '">Treinar (' + cont[k] + ')</button></div>' : '') +
      '</div>').join('') +
    '<div class="cad-kpi"><b>' + (cont.sem || 0) + ' · Sem classificar</b><span>Erros do histórico que ainda não receberam causa.</span>' +
    (cont.sem ? '<div class="linha-btns" style="margin-top:6px"><button class="btn pequeno primario" data-acao="treinar-causa-erro" data-causa="sem">Classificar (' + cont.sem + ')</button></div>' : '') +
    '</div></div>';

  html += '<div class="cartao"><div class="secao-cab"><h2>Questões registradas (' + filtradas.length + ')</h2>' +
    '<div class="chips">' + [['todas', 'Todas (' + erradas.length + ')']].concat(CAUSAS_ERRO.map(([k, r]) => [k, r + ' (' + (cont[k] || 0) + ')'])).concat([['sem', 'Sem causa (' + (cont.sem || 0) + ')']]).map(([v, t]) => '<button class="chip" data-acao="set-filtro-causa" data-causa="' + v + '" aria-pressed="' + (filtro === v) + '">' + t + '</button>').join('') +
    '</div></div>';

  if (!filtradas.length) html += '<p class="mudo pequeno">Nenhuma questão encontrada com esse filtro.</p>';
  else {
    html += '<div class="lista-erros">' + filtradas.slice(0, 50).map((q) => {
      const e = ce[q.id] || {};
      const r = rec(q.id);
      return '<div class="cartao" style="margin-bottom:8px"><div class="secao-cab"><span class="selo ' + (q.g === 'C' ? 'ok' : 'p1') + '">' + q.g + '</span>' +
        '<span class="mono pequeno">' + esc(nomeBloco(q.b)) + ' · ' + esc(q.r || '') + '</span>' +
        (r ? '<span class="pequeno mudo">' + r[2] + 'C / ' + r[3] + 'E</span>' : '') + '</div>' +
        '<p style="margin:6px 0">' + esc(q.e) + '</p>' +
        (q.c ? '<p class="pequeno mudo">' + esc(q.c) + '</p>' : '') +
        '<div class="chips" style="margin:6px 0">' + CAUSAS_ERRO.map(([k, rot]) => '<button class="chip" data-acao="set-causa-erro" data-q="' + esc(q.id) + '" data-causa="' + k + '" aria-pressed="' + (e.causa === k) + '">' + esc(rot) + '</button>').join('') + '</div>' +
        '<div style="display:flex;gap:6px;margin-top:6px"><input class="busca" id="ce-nota-' + esc(q.id) + '" style="font-size:.82rem" placeholder="Regra de 1 linha para não errar de novo" value="' + esc(e.nota || '') + '">' +
        '<button class="btn pequeno" data-acao="salvar-nota-erro" data-q="' + esc(q.id) + '">Salvar regra</button>' +
        (e.causa ? '<button class="btn pequeno" data-acao="limpar-causa-erro" data-q="' + esc(q.id) + '">Limpar</button>' : '') + '</div>' +
        '</div>';
    }).join('') + (filtradas.length > 50 ? '<p class="pequeno mudo">Mostrando as primeiras 50 de ' + filtradas.length + ' questões.</p>' : '') + '</div>';
  }
  html += '</div>';
  return html;
}

function htmlEsqueletos() {
  const ests = (D.discursivas && D.discursivas.estruturas) || [];
  if (!ests.length) return '';
  return '<div class="cartao esq"><h2>Esqueletos de peça e parecer (ANPD)</h2><p class="pequeno mudo">Domine os três moldes antes de treinar velocidade. Copie e preencha os colchetes com os fatos do enunciado.</p>' +
    ests.map((e) => '<details><summary><b>' + esc(e.nome) + '</b></summary><p class="pequeno"><b>Quando usar:</b> ' + esc(e.uso) + '</p><pre>' + esc(e.modelo) + '</pre></details>').join('') + '</div>';
}

// Sincronização inversa: traz do Painel TCU (mesmo navegador) as respostas, cards e leituras do tronco comum
function sincronizarDoTCU() {
  const origem = lerLS('painel-tcu-v1');
  if (!origem || (!origem.itens && !origem.perfil)) { avisar('!', 'Painel TCU não encontrado neste navegador', 'Abra o Painel TCU neste mesmo navegador ao menos uma vez.'); return; }
  let nItens = 0, nCards = 0, nLidos = 0, nErros = 0;
  const num = (x) => Number(x) || 0;
  for (const [id, r] of Object.entries(origem.itens || {})) {
    if (!QI.has(id) || !Array.isArray(r)) continue;
    const at = S.itens[id];
    if (!at || num(r[4]) > num(at[4]) || (num(r[4]) === num(at[4]) && num(r[2]) + num(r[3]) > num(at[2]) + num(at[3]))) { S.itens[id] = r.slice(); nItens++; }
  }
  for (const [id, c] of Object.entries(origem.cards || {})) {
    if (!CI.has(id) || !Array.isArray(c)) continue;
    const at = S.cards[id];
    if (!at || num(c[5]) > num(at[5])) { S.cards[id] = c.slice(); nCards++; }
  }
  S.perfil.lidos ||= {};
  for (const [k, dt] of Object.entries((origem.perfil && origem.perfil.lidos) || {})) {
    if (ARTI.has(k) && (!S.perfil.lidos[k] || dt < S.perfil.lidos[k])) { S.perfil.lidos[k] = dt; nLidos++; }
  }
  if (origem.perfil && origem.perfil.tcu && origem.perfil.tcu.erros) {
    const ceLocal = (cadState().erros ||= {});
    for (const [qid, obj] of Object.entries(origem.perfil.tcu.erros)) {
      if (QI.has(qid) && (!ceLocal[qid] || (!ceLocal[qid].nota && obj.nota))) {
        ceLocal[qid] = Object.assign({}, obj);
        nErros++;
      }
    }
  }
  Store.salvarTudo(); renderTudo();
  avisar('⇄', 'Tronco comum trazido do Painel TCU', pl(nItens, 'questão', 'questões') + ', ' + pl(nCards, 'card', 'cards') + (nErros ? ', ' + pl(nErros, 'anotação de erro', 'anotações de erro') : '') + ' e ' + pl(nLidos, 'artigo lido', 'artigos lidos') + ' aproveitados.');
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
  if (window.claude) return null;
  // Arquivo aberto do disco (fora do claude.ai): o navegador baixa por um link comum
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([conteudo], { type: 'application/json;charset=utf-8' }));
    a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    avisar('↓', 'Arquivo pronto', nome);
    return true;
  } catch (e) { return null; }
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
// Posição da página em cada aba: voltar pela barra de abas devolve a pessoa ao ponto em que estava (no meio da lei seca, por exemplo)
const ROLAGEM = {};
function ir(v, rolar = 0) {
  if (!VISTAS.includes(v)) v = 'hoje';
  if (v !== 'lei') pararFala();
  UI.vista = v;
  salvarUI();
  renderTudo();
  window.scrollTo(0, rolar);
}
function renderTudo() {
  aplicarEdital(S.perfil.edital);
  document.documentElement.classList.toggle('lei-teste', !!UI.camadas.teste);
  UI.artInline = null;
  renderTopo();
  VISTAS.forEach((v) => { document.getElementById('vista-' + v).hidden = v !== UI.vista; });
  document.querySelectorAll('.aba').forEach((b) => { if (b.dataset.vista === UI.vista) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  ({ hoje: renderHoje, questoes: renderQuestoes, cards: renderCards, lei: renderLei, mais: renderMais })[UI.vista]();
  const disc = document.getElementById('disc-texto');
  if (disc && disc.offsetParent) crescerDisc(disc);
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
  // Modo Testar da lei seca: a tarja some no toque e volta no segundo
  const tarja = UI.camadas.teste && ev.target.closest('.texto-lei .g-num, .texto-lei .g-verbo');
  if (tarja) { tarja.classList.toggle('revelado'); return; }
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
      if (alvo.classList.contains('aba') && alvo.dataset.vista !== UI.vista) {
        ROLAGEM[UI.vista] = window.scrollY;
        ir(alvo.dataset.vista, alvo.dataset.vista === 'mais' ? 0 : ROLAGEM[alvo.dataset.vista] || 0);
        break;
      }
      ir(alvo.dataset.vista); break;
    case 'mais': if (sessao) fecharSessao(true); fecharFolha(); UI.mais = alvo.dataset.sub || 'menu'; if (UI.vista !== 'mais') ir('mais'); else { renderMais(); window.scrollTo(0, 0); } break;
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
    case 'treino-rapido': iniciarSessao({ modo: 'treino', n: Number(alvo.dataset.n) || 20, blocos: [], filtro: 'mistas', chave: 'rapido', dia: alvo.dataset.pre ? 'r:' + hojeISO() : undefined }); break;
    case 'abrir-modo': UI.modo = alvo.dataset.modo; if (UI.modo === 'simulado') UI.prova = 'prova'; ir('questoes'); break;
    case 'relampago': iniciarSessao({ modo: 'relampago', blocos: (alvo.dataset.blocos || '').split(',').filter(Boolean) }); break;
    case 'set-modo': UI.modo = alvo.dataset.modo; salvarUI(); renderQuestoes(); break;
    case 'set-prova': UI.prova = alvo.dataset.prova; salvarUI(); renderQuestoes(); break;
    case 'set-n': UI.n = Number(alvo.dataset.n); salvarUI(); renderQuestoes(); break;
    case 'set-filtro': UI.filtro = alvo.dataset.filtro; salvarUI(); renderQuestoes(); break;
    case 'set-banca': UI.filtroBanca = alvo.dataset.banca; salvarUI(); renderQuestoes(); break;
    case 'anpd-set-fase': cadState().fase = alvo.dataset.fase; Store.salvar('perfil'); renderMais(); break;
    case 'anpd-set-degrau': cadState().degrau = Number(alvo.dataset.deg); Store.salvar('perfil'); renderMais(); break;
    case 'anpd-treino-rapido': {
      let bls = (alvo.dataset.blocos || '').split(',').filter(Boolean);
      let tit = alvo.dataset.tit;
      if (!bls.length && alvo.dataset.deg) {
        const degNum = Number(alvo.dataset.deg);
        const discsDeg = DISC.filter((x) => x.degrau === degNum).map((x) => x.id);
        bls = BLOCOS.filter((b) => discsDeg.includes(b.disciplina)).map((b) => b.id);
        tit = degNum + 'º Degrau · Treino Focado (20 itens)';
      }
      iniciarSessao({ modo: 'treino', n: 20, blocos: bls, filtro: 'mistas', titulo: tit || 'Treino ANPD' });
      break;
    }
    case 'ed-prio': UI.edPrio = alvo.dataset.v; renderMais(); break;
    case 'set-filtro-causa': UI.filtroCausa = alvo.dataset.causa; renderMais(); break;
    case 'set-causa-erro': {
      const qid = alvo.dataset.q, e = (cadState().erros[qid] ||= {});
      e.causa = alvo.dataset.causa; e.data = hojeISO();
      const inp = document.getElementById('ce-nota-' + qid); if (inp && inp.value.trim()) e.nota = inp.value.trim();
      Store.salvar('perfil'); renderMais(); break;
    }
    case 'salvar-nota-erro': {
      const qid = alvo.dataset.q, e = (cadState().erros[qid] ||= {});
      const inp = document.getElementById('ce-nota-' + qid);
      if (inp) { e.nota = inp.value.trim(); e.data = hojeISO(); Store.salvar('perfil'); avisar('✓', 'Regra salva no Caderno de Erros'); renderMais(); }
      break;
    }
    case 'limpar-causa-erro': {
      const qid = alvo.dataset.q; delete cadState().erros[qid]; Store.salvar('perfil'); renderMais(); break;
    }
    case 'treinar-causa-erro': {
      const causa = alvo.dataset.causa;
      const ids = errosDoBanco().filter((q) => {
        const c = (cadState().erros[q.id] && cadState().erros[q.id].causa) || 'sem';
        return causa === 'sem' ? c === 'sem' : c === causa;
      }).map((q) => q.id);
      if (!ids.length) { avisar('!', 'Nenhuma questão encontrada'); break; }
      iniciarSessao({ modo: 'treino', ids: embaralhar(ids), titulo: 'Treino · Erros (' + (causaDe(causa) ? causaDe(causa)[1] : 'Sem causa') + ')' });
      break;
    }
    case 'preset': {
      const p = alvo.dataset.preset, comQ = BLOCOS.filter((b) => (POR_BLOCO.get(b.id) || []).length);
      UI.blocos = p === 'p1' ? P1.slice() : p === 'lgpd' ? comQ.filter((b) => b.disciplina === 'lgpd').map((b) => b.id) : p === 'tudo' ? comQ.map((b) => b.id) : [];
      salvarUI(); renderQuestoes(); break;
    }
    case 'comecar': comecarConfigurado(); break;
    case 'simulado-semana': iniciarSessao({ modo: 'simulado', n: SIM_SEMANA_N, prova: true, minutos: Math.round(SIM_SEMANA_N * RITMO_PROVA_S / 60), titulo: 'Simulado da semana', chave: 'sim:' + semanaAtual() }); break;
    case 'simulado-oficial-120': iniciarSessao({ modo: 'simulado', n: TOTAL_PROVA, prova: true, minutos: minutosProva(), titulo: 'Simulado · prova inteira (' + TOTAL_PROVA + ' itens)' }); break;
    case 'simulado-anvisa-2024': {
      const ids = Q.filter((q) => q.id.startsWith('anvisa-2024-cebraspe-')).map((q) => q.id);
      if (!ids.length) { avisar('!', 'Caderno vazio', 'Nenhum item da ANVISA 2024 encontrado.'); break; }
      iniciarSessao({ modo: 'simulado', ids, minutos: Math.round(ids.length * 1.75), titulo: 'ANVISA 2024 · Cebraspe · ' + ids.length + ' itens' });
      break;
    }
    case 'simulado-tcu-2026': {
      const ids = Q.filter((q) => q.id.startsWith('tcu-aufc-2026-')).map((q) => q.id);
      if (!ids.length) { avisar('!', 'Caderno vazio', 'Nenhum item do TCU 2026 encontrado.'); break; }
      iniciarSessao({ modo: 'simulado', ids, minutos: Math.round(ids.length * 1.75), titulo: 'TCU 2026 · AUFC · Cebraspe · ' + ids.length + ' itens' });
      break;
    }
    case 'imprimir-folha-vespera': abrirFolhaVespera(); break;
    case 'responder': responder(alvo.dataset.r); break;
    case 'revelar': proximo(); break;
    case 'avaliar': avaliar(Number(alvo.dataset.n)); break;
    case 'pesq-todos': UI.pesqTodos = true; renderMais(); break;
    case 'causa-agora': {
      const q = sessao && QI.get(sessao.ids[sessao.i]);
      if (!q || !causaDe(alvo.dataset.causa)) break;
      const e = (cadState().erros[q.id] ||= {});
      e.causa = alvo.dataset.causa; e.data = hojeISO();
      Store.salvar('perfil'); renderSessao(); break;
    }
    case 'proximo': proximo(); break;
    case 'som': UI.som = !UI.som; salvarUI(); tocar('acerto'); renderSessao(); break;
    case 'foco': UI.foco = !UI.foco; salvarUI(); renderSessao(); break;
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
    case 'ouvir-art': ouvirArtigo(alvo.dataset.art); break;
    case 'conferir-fria': FRIA_VISTA.add(alvo.dataset.art); renderLei(); break;
    case 'voltar-lei': pararFala(); if (UI.artSel && ARTI.get(UI.artSel)) UI.lei = ARTI.get(UI.artSel).lei; UI.artSel = null; UI.leiFila = null; renderLei(); window.scrollTo(0, 0); break;
    case 'ler-dia': { const ctx = contextoHoje(); const arts = artigosDoDia(ctx.tipo === 'dia' ? ctx.dia : null); if (arts.length) abrirArtigo(arts[0], arts); break; }
    case 'ler-tudo': if (artsDe(UI.lei).length) abrirArtigo(artsDe(UI.lei)[0].k, null); break;
    case 'fim-fila': UI.leiFila = null; UI.artSel = null; avisar('§', 'Leitura do dia concluída', 'Agora os cards cloze desses artigos.'); ir('hoje'); break;
    case 'ranking': UI.ranking = !UI.ranking; if (UI.ranking) UI.termometro = false; renderLei(); break;
    case 'toggle-termometro': UI.termometro = !UI.termometro; if (UI.termometro) UI.ranking = false; renderLei(); break;
    case 'neutralizar-vulnerabilidades': {
      const L = LEIS[UI.lei || 'lgpd'];
      const diagArts = L.artigos.map((a) => diagnosticoArtigo(a.k));
      const verms = diagArts.filter((d) => d.nivel === 'vermelho');
      let ids = [];
      for (const d of verms) {
        if (d.erradasIds && d.erradasIds.length) ids.push(...d.erradasIds);
        else { const qs = POR_ART.get(d.k) || []; ids.push(...qs.map((q) => q.id)); }
      }
      ids = [...new Set(ids)];
      if (!ids.length) {
        const amars = diagArts.filter((d) => d.nivel === 'amarelo');
        for (const d of amars) { const qs = POR_ART.get(d.k) || []; ids.push(...qs.map((q) => q.id)); }
        ids = [...new Set(ids)];
      }
      if (!ids.length) { avisar('✓', 'Nenhuma vulnerabilidade crítica', 'Parabéns! Você não tem artigos com desempenho crítico nesta norma.'); break; }
      iniciarSessao({ modo: 'treino', ids: embaralhar(ids).slice(0, 30), titulo: 'Neutralizar Vulnerabilidades · ' + (L.curto || L.nome), chave: 'vuln:' + (UI.lei || 'lgpd') });
      break;
    }
    case 'camada':
      UI.camadas[alvo.dataset.c] = !UI.camadas[alvo.dataset.c];
      if (alvo.dataset.c === 'teste' && UI.camadas.teste) UI.camadas.num = UI.camadas.verbo = true;
      document.documentElement.classList.toggle('lei-teste', !!UI.camadas.teste);
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
    case 'disc-salvar-rascunho': {
      guardarRascunhoDisc();
      const el = document.getElementById('disc-status-salvo');
      if (el) el.textContent = '✓ Salvo às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      break;
    }
    case 'disc-voltar': guardarRascunhoDisc(); UI.discTema = null; UI.discFase = null; renderMais(); window.scrollTo(0, 0); break;
    case 'investigar': folhaInvestigar(alvo.dataset.t, alvo.dataset.o); break;
    case 'inv-conferir': conferirInv(); break;
    case 'inv-parar': if (UI.inv && UI.inv.ctl) UI.inv.ctl.abort(); break;
    case 'inv-copiar': copiarInv(); break;
    case 'inv-entendi': { const p = S.pesquisa[alvo.dataset.k]; if (p && !p.s) { p.s = 1; p.f = hojeISO(); ganharXP(5); verificarConquistas(); Store.salvar('pesquisa', 'perfil'); } if (UI.inv) folhaInvestigar(UI.inv.t, UI.inv.o); if (UI.vista === 'mais') renderMais(); break; }
    case 'disc-ia': corrigirDiscIA(); break;
    case 'claro-ia': await traduzirIA(alvo); break;
    case 'disc-corrigir':
      guardarRascunhoDisc();
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
    case 'aula-folha':
      if (alvo.dataset.marca && !S.perfil.feitos['aula:' + hojeISO()]) { S.perfil.feitos['aula:' + hojeISO()] = 1; Store.salvar('perfil'); }
      folhaAula(alvo.dataset.st); break;
    case 'st-lei': case 'st-aula': abrirSubtemaEm(alvo.dataset.st, a === 'st-lei' ? 'lei' : 'aula'); break;
    case 'trilha-sessao': {
      const st = SUBTEMAS.get(alvo.dataset.st), tipo = alvo.dataset.tipo;
      const chT = 't:' + st.id + ':' + tipo;
      if (pausaDe(chT)) { fecharFolha(); retomarPausa(chT); break; }
      const ids = idsSubtema(st.id, tipo, Number(alvo.dataset.n) || (tipo === 'pre' ? 8 : 20));
      if (!ids.length) { avisar('§', 'Nada para fazer aqui', tipo === 'erros' ? 'Você não tem erros pendentes neste subtema.' : 'Todos os itens já foram vistos: use Praticar.'); break; }
      fecharFolha();
      iniciarSessao({ modo: 'treino', ids, titulo: (tipo === 'pre' ? 'Pré-teste · ' : tipo === 'erros' ? 'Erros · ' : 'Prática · ') + st.nome, dia: 't:' + hojeISO(), chave: chT, st: st.id, tipoSubtema: tipo });
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
    case 'meta': if (alvo.dataset.meta === 'auto') S.perfil.metaFixa = 0; else { S.perfil.meta = Number(alvo.dataset.meta); S.perfil.metaFixa = 1; } Store.salvar('perfil'); renderTudo(); break;
    case 'novos-cards': S.perfil.novosCards = Number(alvo.dataset.n); Store.salvar('perfil'); renderTudo(); break;
    case 'edital-salvar': {
      const r = lerEdital();
      if (r.erro) { document.getElementById('ed-msg').textContent = r.erro; break; }
      S.perfil.edital = r.ed; Store.salvar('perfil'); renderTudo();
      document.getElementById('ed-msg').textContent = 'Edital salvo: prova de ' + TOTAL_PROVA + ' itens e ' + PONTOS_PROVA + ' pontos' + (r.ed.prova ? ', em ' + fmtData(r.ed.prova, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '') + '.';
      break;
    }
    // null, não delete: a junção de perfis (mesclarDoc) traria de volta o edital do outro aparelho
    case 'edital-padrao': S.perfil.edital = null; Store.salvar('perfil'); renderTudo(); document.getElementById('ed-msg').textContent = 'De volta à projeção da Anatel 2024.'; break;
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
      S.perfil = Object.assign(perfilPadrao(), { status: S.perfil.status, meta: S.perfil.meta, metaFixa: S.perfil.metaFixa, novosCards: S.perfil.novosCards, intercaladas: S.perfil.intercaladas, ui: S.perfil.ui, ep: Date.now() });
      S.itens = {}; S.cards = {}; S.simulados = []; S.pesquisa = {}; S.disc = {};
      Store.salvarTudo(); renderTudo(); avisar('0', 'Progresso zerado', 'Status dos blocos, metas e preferências foram mantidos.');
      break;
    case 'copiar-erros': if (await copiarTexto(JSON.stringify(ERROS, null, 1))) avisar('✓', 'Erros copiados', 'Cole na conversa com o Claude.'); break;
    case 'sync-tcu': sincronizarDoTCU(); break;
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
  else if (a === 'anpd-check-sem' || a === 'tcu-check-sem') {
    const semKey = semanaAtual(), cs = ((cadState().checkSem ||= {})[semKey] ||= {});
    if (alvo.checked) {
      cs[alvo.dataset.i] = true;
      ganharXP(15);
      const totalChecks = ((D.mentor && D.mentor.metodo && D.mentor.metodo.checklistSemanal) || []).length || 7;
      const feitos = Object.values(cs).filter(Boolean).length;
      if (feitos >= totalChecks) {
        ganharXP(50);
        avisar('★', 'Semana 100% Cumprida!', 'Checklist semanal do mentor zerado (+50 XP de bônus)');
      }
    } else {
      delete cs[alvo.dataset.i];
    }
    Store.salvar('perfil');
    if (UI.vista === 'mais') renderMais();
    else if (UI.vista === 'hoje') renderHoje();
  }
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
// Sair da caixa de texto da discursiva grava o rascunho na hora, sem esperar a pausa da digitação
document.addEventListener('focusout', (ev) => { if (ev.target && ev.target.id === 'disc-texto') guardarRascunhoDisc(); });
document.addEventListener('focusin', (ev) => { if (ev.target && ev.target.id === 'disc-texto') crescerDisc(ev.target); });
// Outra aba do painel gravou no navegador: junta o que ela tem com o que está aqui (como no Juntar do backup), para
// nenhuma apagar o progresso da outra; não grava de volta aqui, a próxima gravação normal já leva a junção
window.addEventListener('storage', (ev) => {
  if (ev.key !== CHAVE_LOCAL || !ev.newValue || !Store.localLido) return;
  let d;
  try { d = JSON.parse(ev.newValue); } catch (e) { return; }
  if (!d || !d.perfil) return;
  const ep = S.perfil.ep;
  S.perfil = Object.assign(perfilPadrao(), mesclarDoc('perfil', d.perfil, S.perfil, true));
  if (ep) S.perfil.ep = ep; else delete S.perfil.ep;
  podarPerfil();
  S.itens = mesclarDoc('itens', { q: d.itens || {} }, { q: S.itens }).q;
  S.cards = mesclarDoc('cards', { c: d.cards || {} }, { c: S.cards }).c;
  S.simulados = mesclarDoc('simulados', { lista: d.simulados || [] }, { lista: S.simulados }, true).lista;
  S.pesquisa = mesclarDoc('pesquisa', { p: d.pesquisa || {} }, { p: S.pesquisa }, true).p;
  S.disc = mesclarDoc('discursivas', { d: d.disc || {} }, { d: S.disc }, true).d;
  if (!sessao) renderTudo();
});
// Teclado do celular aberto de verdade (a área visível encolhe): o que é fixo embaixo sai do caminho. Pelo foco não dá:
// no Android, fechar o teclado com o Voltar mantém o campo focado
if (window.visualViewport) {
  let alturaMax = window.visualViewport.height;
  window.visualViewport.addEventListener('resize', () => {
    const h = window.visualViewport.height;
    if (h > alturaMax) alturaMax = h;
    document.body.classList.toggle('kb-aberto', h < alturaMax * 0.75);
  });
}
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
    crescerDisc(ev.target);
    const c = document.getElementById('disc-cont');
    if (c) c.innerHTML = contadorDisc(t);
    // Rascunho salvo um segundo depois da última tecla
    clearTimeout(timerDisc);
    timerDisc = setTimeout(() => Store.salvar('discursivas'), 1000);
    return;
  }
  if (id !== 'busca-lei' && id !== 'busca-gloss' && id !== 'busca-edital') return;
  const pos = ev.target.selectionStart;
  if (id === 'busca-lei') { UI.busca = ev.target.value; renderLei(); }
  else if (id === 'busca-edital') { UI.edBusca = ev.target.value; renderMais(); }
  else { UI.buscaGloss = ev.target.value; renderMais(); }
  const novo = document.getElementById(id);
  if (novo) { novo.focus(); try { novo.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !document.getElementById('folha').hidden) { fecharFolha(); return; }
  if (!sessao || sessao.fim || sessao.confirmar) return;
  if (ev.target && ev.target.id === 'card-digitar' && ev.key === 'Enter') { ev.preventDefault(); proximo(); return; }
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
  else if (k === 'b' && sessao.modo !== 'relampago') responder(BRANCO);
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

// Folha de véspera: os erros anotados, por disciplina, com a regra pessoal de cada um, para reler antes da prova
function abrirFolhaVespera() {
  const erradas = errosDoBanco();
  if (!erradas.length) { avisar('!', 'Nenhum erro registrado', 'Você ainda não registrou erros para gerar a folha.'); return; }
  const ce = cadState().erros;
  const porDisc = {};
  for (const q of erradas) (porDisc[(BI.get(q.b) || {}).disciplina || 'outros'] ||= []).push(q);
  let html = '<div class="folha-impressao"><p class="pequeno mudo">Revisão final · ' + pl(erradas.length, 'questão anotada', 'questões anotadas') + '</p>';
  for (const [disc, qs] of Object.entries(porDisc)) {
    html += '<h2>' + esc((DI.get(disc) || { nome: disc }).nome) + ' (' + qs.length + ')</h2>';
    for (const q of qs) {
      const e = ce[q.id] || {}, causa = causaDe(e.causa);
      html += '<div class="folha-item"><div class="folha-meta">' + esc(nomeBloco(q.b)) + ' · ' + esc(q.r || '') + ' · Gabarito: <b>' + esc(nomeGab(q)) + '</b>' + (causa ? ' · ' + esc(causa[1]) : '') + '</div>' +
        '<p class="folha-enunciado">' + esc(q.e) + '</p>' +
        (e.nota ? '<div class="folha-regra"><b>Regra pessoal:</b> ' + esc(e.nota) + '</div>' : '') +
        (q.c ? '<p class="pequeno mudo"><em>' + esc(q.c) + '</em></p>' : '') + '</div>';
    }
  }
  abrirFolha(cabFolha('Caderno de erros', 'Folha de véspera') + html + '</div>', 'Folha de véspera');
}

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
})().catch((e) => console.error('Falha ao abrir o painel', e));
