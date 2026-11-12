(async function () {
'use strict';

// O artifact chega sem lang no <html>: sem ele, leitor de tela e voz do navegador leem o português com pronúncia errada
if (!document.documentElement.lang) document.documentElement.lang = 'pt-BR';

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
const TRECHO_POS = new Map();
for (const [id, l] of Object.entries(D.lei || {})) {
  let est = [];
  for (const a of l.artigos) { if (a.estrutura) est = a.estrutura; else a.estrutura = est; if (!a.rotulo) a.rotulo = 'Art. ' + a.id; TEXTO_ART.set(id + ':' + a.id, a.texto); }
}
const TAB = D.tab || {};
function deTabela(o) { for (const k in TAB) if (typeof o[k] === 'number') o[k] = TAB[k][o[k]]; }
for (const q of D.questoes) {
  deTabela(q);
  if (q.art === undefined) q.art = null;
  // Trecho guardado como [início, tamanho] no texto do artigo. A posição fica à parte (o item não muda): a explicação
  // mostra o dispositivo inteiro com o trecho grifado
  if ((q.t || []).some(Array.isArray)) TRECHO_POS.set(q.id, q.t.map((t) => (Array.isArray(t) ? t[0] : -1)));
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
// O cronograma do arquivo é a projeção. Com a prova antes do fim dele, a pessoa encaixa o plano na data (perfil.encaixe)
// e D.cronograma.fases e DIAS passam a ser o plano encaixado; aplicarPlano os refaz a cada desenho da tela, como
// aplicarEdital faz com os pesos. DIAS_DISC são os dias com discursiva marcada.
const FASES_BASE = D.cronograma.fases;
const DIAS = [], DIAS_DISC = [];
function montarDias() {
  DIAS.length = 0;
  D.cronograma.fases.forEach((f) => f.semanas.forEach((s) => s.dias.forEach((d) => DIAS.push(Object.assign({ fase: f.id }, d)))));
  DIAS.sort((a, b) => (a.data < b.data ? -1 : 1));
  DIAS_DISC.length = 0;
  DIAS_DISC.push(...DIAS.filter((d) => d.disc));
}
montarDias();
// Plano B: a ANPD disse querer antecipar o concurso; quatro semanas antes da prova provável do cronograma
const PLANO_B = '2027-02-28';
function encaixeValido(x) {
  const iso = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  return x && typeof x === 'object' && iso(x.prova) && iso(x.desde) && x.prova > x.desde ? x : null;
}
// Encaixe numa prova antes do fim do cronograma: saem semanas inteiras que ainda não começaram (as de menor valor
// primeiro: sem conteúdo novo e sem simulado, das mais tardias para as mais cedo), as seguintes são adiantadas em
// múltiplos de 7 dias (cada dia fica no mesmo dia da semana e o sábado continua sendo o bloco longo) e a reta final
// termina no dia da prova. O cálculo parte do dia em que a pessoa encaixou (desde) e, uma vez gravadas, as semanas
// cortadas (cortes) não mudam com o tempo nem com os pesos.
function encaixarPlano(prova, desde, cortes) {
  const semanas = [];
  for (const f of FASES_BASE) for (const s of f.semanas) if (s.dias.length) semanas.push({ s, dias: s.dias.slice().sort((a, b) => (a.data < b.data ? -1 : 1)) });
  semanas.sort((a, b) => (a.dias[0].data < b.dias[0].data ? -1 : 1));
  const reta = semanas[semanas.length - 1], fim = reta && reta.dias[reta.dias.length - 1].data;
  if (!reta || prova >= fim || prova <= desde) return null;
  // Valor da semana: o conteúdo que aparece nela pela primeira vez no plano (subtema ou bloco), pelo peso da disciplina
  // na prova; um simulado vale meio ponto, para que entre semanas só de revisão saiam antes as sem simulado
  const visto = new Set();
  semanas.forEach((w) => { w.ini = w.dias[0].data; });
  semanas.forEach((w, i) => {
    w.sim = w.dias.filter((d) => d.modo === 'simulado').length;
    w.valor = w.sim ? 0.5 : 0;
    w.novo = 0;
    for (const d of w.dias) for (const k of [d.st].concat(d.blocos || [])) if (k && !visto.has(k)) { visto.add(k); w.novo++; w.valor += PONTOS_DISC[(BI.get((d.blocos || [])[0]) || {}).disciplina] || 1; }
    w.cheia = i < semanas.length - 1 && diaNum(semanas[i + 1].ini) - diaNum(w.ini) === 7 && diaSemana(w.ini) === 1;
  });
  const falta = Math.ceil((diaNum(fim) - diaNum(prova)) / 7);
  const cand = semanas.filter((w) => w !== reta && w.cheia && w.ini > desde).sort((a, b) => a.valor - b.valor || (a.ini < b.ini ? 1 : -1));
  const sai = Array.isArray(cortes) ? new Set(semanas.filter((w) => w !== reta && cortes.includes(w.ini))) : new Set(cand.slice(0, falta));
  const novos = new Map();
  let desloc = 0;
  for (const w of semanas) {
    if (sai.has(w)) { desloc += 7; continue; }
    w.desloc = desloc;
    // Dia de feriado que mudou de data perde a menção ao feriado
    novos.set(w, w.dias.map((d) => Object.assign({}, d, { data: isoDeNum(diaNum(d.data) - desloc) }, desloc && /natal|ano-novo/i.test(d.atividade) ? { atividade: 'Revisão leve: o que venceu na revisão espaçada e o que ficou para trás' } : {})));
  }
  const rd = novos.get(reta), ajuste = diaNum(prova) - diaNum(rd[rd.length - 1].data);
  rd.forEach((d) => { d.data = isoDeNum(diaNum(d.data) + ajuste); });
  const iniReta = rd[0].data;
  if (ajuste > 0) {
    // Dias que sobram antes da reta final (prova fora do domingo): livres para o atrasado e o treino intercalado
    for (let n = diaNum(iniReta) - ajuste; n < diaNum(iniReta); n++) {
      const iso = isoDeNum(n);
      if (diaSemana(iso) !== 0 && iso > desde) rd.push({ data: iso, atividade: 'Dia livre do encaixe: o que ficou para trás e o treino intercalado pelo peso da prova', duracao: '1h', modo: 'revisao', blocos: [], n: 30 });
    }
  } else if (ajuste < 0) {
    // Sem semanas bastantes para cortar: o que cairia na reta final sai do plano, e a reta final não volta ao passado
    for (const [w, ds] of novos) if (w !== reta) novos.set(w, ds.filter((d) => d.data < iniReta || d.data <= desde));
    novos.set(reta, rd.filter((d, i) => d.data > desde || i === rd.length - 1));
  }
  const ultimo = novos.get(reta)[novos.get(reta).length - 1];
  ultimo.atividade = 'Prova (' + fmtData(prova, { weekday: 'long', day: '2-digit', month: '2-digit' }).toLowerCase() + '). Nada de conteúdo novo.';
  const dm = (iso) => fmtData(iso, { day: '2-digit', month: '2-digit' });
  let num = 0;
  const fases = FASES_BASE.map((f) => {
    const sems = f.semanas.map((s) => semanas.find((w) => w.s === s)).filter((w) => w && novos.has(w) && novos.get(w).length).map((w) => {
      const ds = novos.get(w).sort((a, b) => (a.data < b.data ? -1 : 1));
      const titulo = /^Semana \d+$/.test(w.s.titulo) ? 'Semana ' + ++num : w.s.titulo;
      const periodo = w.desloc === 0 && w !== reta ? w.s.periodo : dm(ds[0].data) + ' a ' + dm(w.cheia ? isoDeNum(diaNum(ds[0].data) + 6) : ds[ds.length - 1].data);
      const extra = w === reta ? { nota: 'Plano encaixado na prova de ' + fmtData(prova, { day: '2-digit', month: '2-digit', year: 'numeric' }) + '.' } : {};
      return Object.assign({}, w.s, { titulo, periodo, dias: ds }, extra);
    });
    if (!sems.length) return null;
    return Object.assign({}, f, { semanas: sems, periodo: dm(sems[0].dias[0].data) + ' a ' + sems[sems.length - 1].periodo.split(' a ')[1] });
  }).filter(Boolean);
  const ordem = [...sai].sort((a, b) => (a.ini < b.ini ? -1 : 1));
  const cortada = (w) => w.s.titulo + ' (' + w.s.periodo + ')' + (w.novo ? ', com conteúdo novo' : '') + (w.sim ? ', com simulado' : '');
  return { fases, cortes: ordem.map((w) => w.ini), cortadas: ordem.map(cortada), novo: ordem.some((w) => w.novo), simulados: ordem.reduce((a, w) => a + w.sim, 0), curto: !Array.isArray(cortes) && cand.length < falta };
}
// Recomeço (11/2026): depois de dias sem estudo, o que não foi feito desde o primeiro dia de questões pendente anda
// para a frente e recomeça na data marcada, na mesma ordem, de segunda a sábado (fora 25/12 e 1º/1). O que já foi feito
// fica onde estava. Os recomeços se aplicam em sequência, cada um sobre o plano deixado pelo anterior.
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
function recomecosValidos() { return (S.perfil.recomecos || []).filter((x) => x && ISO_RE.test(x.de) && ISO_RE.test(x.para) && x.para > x.de); }
function recomecarFases(fases, rc) {
  const pular = new Set(rc.pular || []), dm = (iso) => fmtData(iso, { day: '2-digit', month: '2-digit' });
  const fs = fases.map((f) => Object.assign({}, f, { semanas: f.semanas.map((s) => Object.assign({}, s, { dias: s.dias.map((d) => Object.assign({}, d)) })) }));
  const mov = fs.flatMap((f) => f.semanas.flatMap((s) => s.dias)).filter((d) => d.data >= rc.de && !pular.has(d.data)).sort((a, b) => (a.data < b.data ? -1 : 1));
  // Enquanto o plano está atrasado em relação às datas originais, os dias de pôr o plano em dia (sem discursiva) saem e
  // absorvem o atraso; alcançadas as datas originais, o resto fica onde estava. O dia da prova nunca anda.
  let n = diaNum(rc.para);
  const fora = new Set();
  for (const d of mov) {
    if (/^Prova/.test(d.atividade)) break;
    while (diaSemana(isoDeNum(n)) === 0 || /-(12-25|01-01)$/.test(isoDeNum(n))) n++;
    if (n > diaNum(d.data) && d.modo === 'revisao' && !d.disc && /pôr o plano em dia/i.test(d.atividade)) { fora.add(d); continue; }
    if (n <= diaNum(d.data)) break;
    const nova = isoDeNum(n++);
    if (/natal|ano-novo/i.test(d.atividade)) d.atividade = 'Revisão leve: o que venceu na revisão espaçada e o que ficou para trás';
    d.data = nova;
  }
  for (const f of fs) {
    for (const s of f.semanas) { s.dias = s.dias.filter((d) => !fora.has(d)); s.dias.sort((a, b) => (a.data < b.data ? -1 : 1)); if (s.dias.length) s.periodo = dm(s.dias[0].data) + ' a ' + dm(s.dias[s.dias.length - 1].data); }
    const ds = f.semanas.flatMap((s) => s.dias).sort((a, b) => (a.data < b.data ? -1 : 1));
    if (ds.length) f.periodo = dm(ds[0].data) + ' a ' + dm(ds[ds.length - 1].data);
  }
  return fs;
}
let PLANO_CHAVE = '';
function aplicarPlano() {
  const e = encaixeValido(S.perfil.encaixe), rcs = recomecosValidos();
  const chave = (e ? e.prova + '|' + e.desde + '|' + (e.cortes || []).join(',') : '') + '#' + rcs.map((x) => x.de + '>' + x.para).join(';');
  if (chave === PLANO_CHAVE) return;
  PLANO_CHAVE = chave;
  const r = e ? encaixarPlano(e.prova, e.desde, e.cortes) : null;
  let fases = r ? r.fases : FASES_BASE;
  for (const rc of rcs) fases = recomecarFases(fases, rc);
  D.cronograma.fases = fases;
  montarDias();
}

// Cards cloze: cada número de lacuna de uma nota vira um card
const RE_LACUNA = /\{\{(?:c(\d+)::)?([^}]+?)\}\}/g;
function lacunasDe(texto) {
  const out = [];
  let auto = 0;
  texto.replace(RE_LACUNA, (m, n, t) => { out.push({ n: n ? Number(n) : ++auto, t }); return m; });
  return out;
}
// O baralho tem só os cards com contexto (resumo e doutrina). Os literais, recortes do artigo, servem às lacunas do
// modo Testar da lei seca; continuam em CI para o histórico deles seguir no backup e na importação.
const NOTAS_TODAS = D.cloze || [];
const NOTAS = NOTAS_TODAS.filter((nota) => !nota.art);
const TODOS_CARDS = [];
NOTAS_TODAS.forEach((nota) => {
  const nums = [...new Set(lacunasDe(nota.t).map((l) => l.n))];
  nums.forEach((n) => TODOS_CARDS.push({ id: nota.id + '.' + n, nota, n }));
});
const CARDS = TODOS_CARDS.filter((c) => !c.nota.art);
const CI = new Map(TODOS_CARDS.map((c) => [c.id, c]));
const CARDS_POR_BLOCO = agrupar(CARDS, (c) => c.nota.b);
const CARDS_POR_ART = agrupar(TODOS_CARDS.filter((c) => c.nota.art), (c) => chave(c.nota.l || 'lgpd', c.nota.art));
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
// Manutenção: itens já dominados (nível 3 ou mais) que venceram voltam aos poucos, no mínimo este número por dia
// (tetoManutencao sobe com o volume real da pessoa), para a carga de revisão caber no dia; os mais atrasados vêm primeiro.
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
// Só disciplinas conhecidas e números positivos: o edital também chega por backup e pela conta, e vai para o HTML
function parteEdital(o) {
  if (!o || typeof o !== 'object') return null;
  const r = {};
  for (const [d, k] of Object.entries(o)) { const n = Math.round(Number(k)); if (DI.has(d) && n > 0 && n <= 500) r[d] = n; }
  return Object.keys(r).length ? r : null;
}
function aplicarEdital(ed) {
  ed = ed && typeof ed === 'object' ? ed : {};
  const cortes = {};
  for (const [k, v] of Object.entries(ed.cortes && typeof ed.cortes === 'object' ? ed.cortes : {})) if (k in PADRAO_EDITAL.cortes && Number.isFinite(Number(v)) && Number(v) >= 0) cortes[k] = Number(v);
  ed = { basica: parteEdital(ed.basica), especifica: parteEdital(ed.especifica), cortes, pesoB: Math.min(10, Number(ed.pesoB)), pesoE: Math.min(10, Number(ed.pesoE)) };
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
// Números nos textos do mentor e do Cebraspe, calculados na hora: {peso:lgpd} ou {peso:lgpd+eca} é a parte dessas
// disciplinas na nota pelos pesos em vigor (os de Ajustes, se mudados); {pontos}, {itens}, {itensB}, {itensE} e
// {regraPesos} descrevem a prova; {horasPre}, {horasPos}, {itensPre}, {itensPos}, {itensSemana} e {semanasPos} vêm do
// cronograma, que é a fonte das metas. Assim nenhuma tela repete um número de uma versão antiga do plano ou dos pesos.
function comNumeros(s) {
  const soma = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const regra = PESO_BASICA === PESO_ESPECIFICA ? 'todo item vale ' + PESO_BASICA : 'cada item da básica vale ' + PESO_BASICA + ' e cada item da específica vale ' + PESO_ESPECIFICA;
  let pre, pos;
  const plano = () => { if (!pre) { pre = planoPorSemana(null, D.cronograma.edital); pos = planoPorSemana(D.cronograma.edital, null); } };
  return String(s).replace(/\{(peso:[a-z+]+|pontos|itensB|itensE|itensPre|itensPos|itensSemana|itens|regraPesos|horasPre|horasPos|semanasPos)\}/g, (m, k) => {
    if (k.startsWith('peso:')) return PONTOS_PROVA ? Math.round((k.slice(5).split('+').reduce((a, d) => a + (PONTOS_DISC[d] || 0), 0) / PONTOS_PROVA) * 100) + '%' : m;
    if (k === 'pontos' || k === 'itens' || k === 'itensB' || k === 'itensE' || k === 'regraPesos') return { pontos: PONTOS_PROVA, itens: TOTAL_PROVA, itensB: soma(PROVA_BASICA), itensE: soma(PROVA_ESPECIFICA), regraPesos: regra }[k];
    plano();
    if (k === 'horasPre') return fmtDur(Math.round(pre.h * 4) / 4 * 3600);
    if (k === 'horasPos') return fmtDur(Math.round(pos.h * 4) / 4 * 3600);
    if (k === 'itensPre') return String(Math.round(pre.n / 10) * 10);
    if (k === 'itensPos') return String(Math.round(pos.n / 10) * 10);
    if (k === 'itensSemana') return String(itensPlanoSemana());
    return String(Math.max(1, Math.round((diaNum(dataProva()) - diaNum(D.cronograma.edital)) / 7)));
  });
}
// Data da prova: a do edital, quando a pessoa a informa em Ajustes; antes disso, a do plano encaixado (plano B) ou a
// estimativa do cronograma
function dataProva() {
  const p = S.perfil.edital && S.perfil.edital.prova, e = encaixeValido(S.perfil.encaixe);
  return typeof p === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : e ? e.prova : D.cronograma.prova;
}
// Simulado da prova inteira: 1,75 min por item (os 120 da Anatel 2024 em 3h30)
const RITMO_PROVA_MIN = 1.75;
function minutosProva() { return Math.round(TOTAL_PROVA * RITMO_PROVA_MIN); }
function duracaoProva() { const m = minutosProva(); return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); }
// Parte da prova em que o item cairia: 'b' (básica) ou 'e' (específica)
function somaItens(parte) { return Object.values(parte).reduce((a, b) => a + b, 0); }
function parteProva(q) {
  const d = (BI.get(q.b) || {}).disciplina;
  if (PROVA_BASICA[d] > 0 && PROVA_ESPECIFICA[d] > 0) return REG_NA_BASICA.has(q.b) ? 'b' : 'e';
  return PROVA_BASICA[d] > 0 ? 'b' : 'e';
}
function pesoItem(q) { return parteProva(q) === 'b' ? PESO_BASICA : PESO_ESPECIFICA; }
// Quanto vale cada item com os pesos em vigor ("1" ou "1 na básica e 2 na específica")
function valorDosItens() { const f = (x) => String(x).replace('.', ','); return PESO_BASICA === PESO_ESPECIFICA ? f(PESO_BASICA) : f(PESO_BASICA) + ' na básica e ' + f(PESO_ESPECIFICA) + ' na específica'; }
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

// 40 níveis com degraus crescentes: os primeiros saem no primeiro dia. Acima de 25 mil os degraus são mais longos: no
// ritmo medido nas primeiras semanas de uso (5 a 8 mil XP por semana), Diretor(a)-Presidente chega perto da prova, e
// não meses antes, quando a escada acabaria justo na reta final; depois dele, cada mandato pede MANDATO_XP, e as
// conquistas de XP e ritmo seguem até 250 mil.
const NIVEIS = [
  [0, 'Titular de dados'], [150, 'Curioso(a) do art. 18'], [300, 'Leitor(a) de lei seca'], [500, 'Suboperador(a)'],
  [700, 'Operador(a)'], [950, 'Controlador(a)'], [1200, 'Controlador(a) conjunto(a)'], [1500, 'Encarregado(a)'],
  [1850, 'Guardião(ã) do consentimento'], [2200, 'Defensor(a) da finalidade'], [2600, 'Analista de conformidade'],
  [3100, 'Mapeador(a) de dados'], [3600, 'Redator(a) de relatório de impacto'], [4200, 'Mestre da pseudonimização'],
  [4800, 'Perito(a) em anonimização'], [5500, 'Projetista da privacidade desde a concepção'], [6400, 'Notificador(a) de incidentes'],
  [7300, 'Caçador(a) de vazamentos'], [8300, 'Protetor(a) do ECA Digital'], [9400, 'Fiscal de campo'],
  [10500, 'Auditor(a) de algoritmos'], [12000, 'Mediador(a) de petições de titulares'], [13500, 'Analista de transferência internacional'],
  [15500, 'Instrutor(a) de processo sancionador'], [17500, 'Calculista da dosimetria'], [19500, 'Redator(a) de guia orientativo'],
  [22000, 'Analista de impacto regulatório'], [25000, 'Relator(a) de consulta pública'], [30000, 'Arquiteto(a) do sandbox regulatório'],
  [36000, 'Especialista em Regulação'], [42500, 'Especialista de referência'], [50000, 'Coordenador(a)'],
  [58500, 'Coordenador(a)-Geral'], [67500, 'Ouvidor(a)'], [77500, 'Corregedor(a)'], [89000, 'Auditor(a)-Chefe'],
  [101500, 'Superintendente'], [116000, 'Conselheiro(a) do CNPD'], [131500, 'Diretor(a) do Conselho Diretor'],
  [150000, 'Diretor(a)-Presidente'],
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
  { g: 'c', id: 'seq7', ic: '7d', nome: 'Semana firme', desc: '7 dias seguidos de estudo (domingo, uma folga por semana e dia do plano recuperado não quebram).' },
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
  { g: 'c', id: 'semanas4', ic: '4×', nome: 'Ritmo de cruzeiro', desc: '4 semanas seguidas com 2.500 XP ou mais (uma semana inteira do plano).' },
  { g: 'c', id: 'semanas12', ic: '12×', nome: 'Ritmo de prova', desc: '12 semanas seguidas com 2.500 XP ou mais (uma semana inteira do plano).' },
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

