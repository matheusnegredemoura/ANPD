(function () {
'use strict';

/* ================= Dados embutidos ================= */
const D = JSON.parse(document.getElementById('dados').textContent);
const Q = D.questoes;
const QI = new Map(Q.map((q) => [q.id, q]));
const BLOCOS = D.blocos;
const BI = new Map(BLOCOS.map((b) => [b.id, b]));
const DISC = D.disciplinas;
const DI = new Map(DISC.map((d) => [d.id, d]));
const LEI = D.lei.lgpd;
const ARTS = LEI ? LEI.artigos : [];
const ARTI = new Map(ARTS.map((a) => [a.id, a]));
const POR_BLOCO = agrupar(Q, (q) => q.b);
const POR_ART = agrupar(Q.filter((q) => q.l === 'lgpd' && q.art), (q) => q.art);
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
const CARDS_POR_ART = agrupar(CARDS, (c) => c.nota.art);

// Glossário com expressão regular por termo
const GLOSS = (D.glossario || []).map((g, i) => Object.assign({ i, re: regexTermo(g.p) }, g));
function regexTermo(padroes) {
  const e = padroes.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  try { return new RegExp('(?<![\\p{L}\\d])(?:' + e + ')(?![\\p{L}\\d])', 'iu'); } catch (err) { return new RegExp('(?:' + e + ')', 'i'); }
}

const INTERVALOS = [0, 1, 3, 7, 16, 35];
const MIN_DIA_ATIVO = 10;
const DOCS = ['perfil', 'itens', 'cards', 'simulados', 'pesquisa'];
const CHAVE_LOCAL = 'painel-anpd-v3';
const CHAVE_LOCAL_ANTIGA = 'painel-anpd-v2';
const CHAVE_UI = 'painel-anpd-ui';
const P1 = ['lgpd-17-22', 'lgpd-52-54', 'lgpd-55', 'lgpd-33-36'];
// Distribuição da prova completa simulada (proporção por disciplina, segue os pesos do plano)
const PESOS_PROVA = { lgpd: 0.45, regulacao: 0.15, eca: 0.07, seginfo: 0.08, direito: 0.09, comparado: 0.06, economia: 0.05, linguas: 0.05 };

const NIVEIS = [
  [0, 'Titular de dados'], [120, 'Curioso do art. 18'], [300, 'Operador(a)'], [600, 'Controlador(a)'],
  [1000, 'Encarregado(a)'], [1600, 'Analista de conformidade'], [2400, 'Fiscal de campo'], [3400, 'Auditor(a) de algoritmos'],
  [4700, 'Instrutor(a) de processo sancionador'], [6300, 'Especialista em Regulação'], [8300, 'Coordenador(a)-Geral'],
  [10800, 'Diretor(a) do Conselho Diretor'], [14000, 'Diretor(a)-Presidente'],
];

const CONQ = [
  { id: 'primeira', ic: '1', nome: 'Primeira marcação', desc: 'Respondeu o primeiro item.' },
  { id: 'meta', ic: 'M', nome: 'Meta batida', desc: 'Cumpriu a meta diária de itens.' },
  { id: 'roteiro', ic: '5/5', nome: 'Roteiro completo', desc: 'Fechou os cinco passos do roteiro de um dia.' },
  { id: 'combo10', ic: '10', nome: 'Dez seguidas', desc: 'Acertou 10 itens em sequência.' },
  { id: 'combo25', ic: '25', nome: 'Gabarito limpo', desc: 'Acertou 25 itens em sequência.' },
  { id: 'r100', ic: '100', nome: 'Cem itens', desc: 'Respondeu 100 itens.' },
  { id: 'r500', ic: '500', nome: 'Quinhentos', desc: 'Respondeu 500 itens.' },
  { id: 'r1000', ic: '1k', nome: 'Mil itens', desc: 'Respondeu 1.000 itens.' },
  { id: 'cards50', ic: 'C', nome: 'Cinquenta lacunas', desc: 'Revisou 50 cards cloze.' },
  { id: 'cards300', ic: 'C3', nome: 'Lei na ponta da língua', desc: 'Revisou 300 cards cloze.' },
  { id: 'seq7', ic: '7d', nome: 'Semana firme', desc: '7 dias seguidos de estudo (domingo não quebra).' },
  { id: 'seq30', ic: '30d', nome: 'Mês sem falhar', desc: '30 dias seguidos de estudo.' },
  { id: 'sim1', ic: 'S', nome: 'Primeiro simulado', desc: 'Entregou um simulado.' },
  { id: 'sim70', ic: '70', nome: 'Nota de corte', desc: 'Nota líquida de 70% ou mais em simulado de 30+ itens.' },
  { id: 'relampago15', ic: 'R', nome: 'Relâmpago', desc: 'Nota líquida de 15 ou mais no modo relâmpago.' },
  { id: 'lei20', ic: '§', nome: 'Lei seca', desc: 'Abriu 20 artigos da LGPD no leitor.' },
  { id: 'leitodas', ic: '§§', nome: 'Lei inteira', desc: 'Abriu todos os artigos da LGPD no leitor.' },
  { id: 'lista25', ic: 'LC', nome: 'Lista curta', desc: 'Tirou 25 itens da lista de erros.' },
  { id: 'pesq10', ic: '?!', nome: 'Curiosidade', desc: 'Marcou 10 temas como pesquisados e entendidos.' },
  { id: 'bloco80', ic: '80', nome: 'Bloco dominado', desc: 'Chegou a 80% de domínio em um bloco.' },
  { id: 'p1', ic: 'P1', nome: 'Prioridade 1 em dia', desc: '60% de domínio nos quatro blocos de prioridade 1 da LGPD.' },
  { id: 'calibrado', ic: '?', nome: 'Bem calibrado', desc: 'Marcou dúvida em 20 itens. Agora você sabe quando chutar.' },
  { id: 'coruja', ic: '23h', nome: 'Coruja', desc: 'Estudou depois das 23h.' },
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
function fmtData(iso, op) { const s = new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', op); return s.charAt(0).toUpperCase() + s.slice(1); }
function embaralhar(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function semAcento(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function pl(n, s, p) { return n + ' ' + (n === 1 ? s : p); }
function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
function fmtNum(n) { return Number(n).toLocaleString('pt-BR'); }
function fmtTempo(seg) { seg = Math.max(0, Math.round(seg)); return String(Math.floor(seg / 60)).padStart(2, '0') + ':' + String(seg % 60).padStart(2, '0'); }
function lerLS(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function gravarLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function rotuloArt(id) { return /^\d$/.test(id) ? 'Art. ' + id + 'º' : 'Art. ' + id; }
function busca(q) { return 'https://www.google.com/search?q=' + encodeURIComponent(q); }
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
  return { xp: 0, meta: 30, novosCards: 20, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: hojeISO() };
}
const S = { perfil: perfilPadrao(), itens: {}, cards: {}, simulados: [], pesquisa: {} };
const UI = Object.assign({ vista: 'hoje', modo: 'treino', n: 20, filtro: 'mistas', prova: 'blocos', blocos: P1.slice(), blocosCards: [], faseAberta: null, camadas: { cai: true, num: true, alerta: true, verbo: true, erro: true } }, lerLS(CHAVE_UI) || {});
UI.artSel = null; UI.busca = ''; UI.mais = 'menu'; UI.leiFila = null; UI.ranking = false; UI.filtroPesq = 'pendentes'; UI.buscaGloss = ''; UI.folhaArt = null; UI.folhaQ = null;
if (!UI.camadas) UI.camadas = { cai: true, num: true, alerta: true, verbo: true, erro: true };
let sessao = null;
function salvarUI() {
  gravarLS(CHAVE_UI, { vista: UI.vista, modo: UI.modo, n: UI.n, filtro: UI.filtro, prova: UI.prova, blocos: UI.blocos, blocosCards: UI.blocosCards, camadas: UI.camadas });
}

/* ================= Persistência ================= */
// O progresso fica no banco do Artifact (por usuário) e, sempre, também neste navegador.
const Store = {
  modo: 'local', dev: Math.random().toString(36).slice(2, 10), refs: {}, timer: {}, gravando: {}, fila: {}, ultimoT: {}, erro: null,
  diag: { claude: false, db: '—', user: '—', id: '—', leitura: '—', gravacao: '—', navegador: '—' },
  carregarLocal() {
    const l = lerLS(CHAVE_LOCAL) || lerLS(CHAVE_LOCAL_ANTIGA);
    if (!l) return false;
    if (l.perfil) S.perfil = Object.assign(perfilPadrao(), l.perfil);
    if (l.itens) S.itens = l.itens;
    if (l.cards) S.cards = l.cards;
    if (l.simulados) S.simulados = l.simulados;
    if (l.pesquisa) S.pesquisa = l.pesquisa;
    return true;
  },
  guardarLocal() {
    const ok = gravarLS(CHAVE_LOCAL, { perfil: S.perfil, itens: S.itens, cards: S.cards, simulados: S.simulados, pesquisa: S.pesquisa });
    this.diag.navegador = ok ? 'ok' : 'bloqueado';
  },
  dados(n) {
    if (n === 'perfil') return S.perfil;
    if (n === 'itens') return { q: S.itens };
    if (n === 'cards') return { c: S.cards };
    if (n === 'simulados') return { lista: S.simulados };
    return { p: S.pesquisa };
  },
  aplicar(n, corpo) {
    if (!corpo || !corpo.dados) return;
    if (corpo.t && this.ultimoT[n] && corpo.t <= this.ultimoT[n]) return;
    this.ultimoT[n] = corpo.t || Date.now();
    const d = corpo.dados;
    if (n === 'perfil') S.perfil = Object.assign(perfilPadrao(), d);
    else if (n === 'itens') S.itens = d.q || {};
    else if (n === 'cards') S.cards = d.c || {};
    else if (n === 'simulados') S.simulados = d.lista || [];
    else S.pesquisa = d.p || {};
    this.guardarLocal();
  },
  async iniciar() {
    const temLocal = this.carregarLocal();
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
      const col = db.collection('data/users/' + uid);
      DOCS.forEach((n) => { this.refs[n] = col.doc(n); });
      const snaps = await Promise.all(DOCS.map((n) => this.refs[n].get()));
      this.diag.leitura = 'ok';
      this.modo = 'nuvem';
      if (!snaps.some((s) => s.exists)) {
        if (!temLocal) await migrarPainelAntigo(db, user);
        DOCS.forEach((n) => this.gravar(n));
      } else {
        snaps.forEach((s, i) => { if (s.exists) this.aplicar(DOCS[i], s.data()); else this.gravar(DOCS[i]); });
      }
      DOCS.forEach((n) => {
        this.refs[n].onSnapshot((s) => {
          if (!s.exists) return;
          const d = s.data();
          if (!d || d.dev === this.dev) return;
          this.aplicar(n, d);
          renderTudo();
        }, (e) => { console.warn('assinatura encerrada', n, e && e.code); });
      });
    } catch (e) {
      console.warn('banco indisponível, usando o navegador', e);
      this.diag.leitura = 'erro ' + ((e && e.code) || '');
      this.modo = 'local';
    }
    this.pronto();
  },
  pronto() { renderTudo(); },
  salvar(...nomes) {
    this.guardarLocal();
    if (this.modo !== 'nuvem') return;
    for (const n of nomes) { clearTimeout(this.timer[n]); this.timer[n] = setTimeout(() => this.gravar(n), 1200); }
  },
  salvarTudo() { this.salvar(...DOCS); },
  descarregar() {
    if (this.modo !== 'nuvem') return;
    for (const n of DOCS) if (this.timer[n]) { clearTimeout(this.timer[n]); this.timer[n] = null; this.gravar(n); }
  },
  async gravar(n) {
    this.timer[n] = null;
    if (this.gravando[n]) { this.fila[n] = true; return; }
    this.gravando[n] = true;
    const t = Date.now();
    try {
      await this.refs[n].set({ dev: this.dev, t, v: 3, dados: this.dados(n) });
      this.ultimoT[n] = t;
      this.erro = null;
      this.diag.gravacao = 'ok';
    } catch (e) {
      this.erro = (e && e.code) || 'erro';
      this.diag.gravacao = 'erro ' + this.erro;
      if (e && ['invalid_argument', 'revoked', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e.code)) this.modo = 'local';
      if (e && (e.code === 'unavailable' || e.code === 'resource_exhausted')) setTimeout(() => this.salvar(n), 3000 + Math.random() * 3000);
      atualizarRodapeSync();
    } finally {
      this.gravando[n] = false;
      if (this.fila[n]) { this.fila[n] = false; this.gravar(n); }
    }
  },
};
async function migrarPainelAntigo(db, user) {
  let dono = false;
  try { dono = await user.isOwner(); } catch (e) { dono = false; }
  if (!dono) return;
  try {
    const snap = await db.collection('progress').get();
    snap.docs.forEach((d) => {
      const st = d.data() && d.data().status;
      const b = BLOCOS.find((x) => x.legado === Number(d.id));
      if (b && st && st !== 'nao') S.perfil.status[b.id] = st;
    });
    S.perfil.migrado = hojeISO();
  } catch (e) { /* sem dados antigos */ }
}

/* ================= Regras: questões ================= */
function rec(id) { return S.itens[id]; }
function emRevisao(id) { const r = rec(id); return !!r && r[0] >= 0 && r[0] < 3; }
function vencida(id) { const r = rec(id); return emRevisao(id) && r[1] <= HOJE(); }
function dominioItem(id) { const r = rec(id); return !r || r[0] < 0 ? 0 : Math.min(r[0], 5) / 5; }
function dominioBloco(bid) {
  const qs = POR_BLOCO.get(bid) || [];
  if (!qs.length) return null;
  return qs.reduce((s, q) => s + dominioItem(q.id), 0) / qs.length;
}
function listaCurta() { return Q.filter((q) => emRevisao(q.id)); }
function listaVencida() { return Q.filter((q) => vencida(q.id)).sort((a, b) => rec(a.id)[1] - rec(b.id)[1]); }
function nivelDe(xp) {
  let i = 0;
  while (i + 1 < NIVEIS.length && xp >= NIVEIS[i + 1][0]) i++;
  if (i === NIVEIS.length - 1) {
    const mandato = 1 + Math.floor((xp - NIVEIS[i][0]) / 4000);
    const base = NIVEIS[i][0] + (mandato - 1) * 4000;
    return { n: i + mandato, nome: NIVEIS[i][1] + (mandato > 1 ? ' · mandato ' + mandato : ''), base, prox: base + 4000 };
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
function ativo(iso) { const d = S.perfil.dias[iso]; return !!d && (d.r + (d.k || 0) / 2) >= MIN_DIA_ATIVO; }
function sequencia() {
  let n = 0, dia = HOJE();
  if (!ativo(isoDeNum(dia))) dia--;
  for (let k = 0; k < 800; k++) {
    const iso = isoDeNum(dia);
    if (ativo(iso)) n++; else if (diaSemana(iso) !== 0) break;
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
  return Math.round(x * (1 + Math.min(combo, 10) * 0.05));
}
function registrar(q, resp, duvida) {
  const hoje = HOJE();
  const r = S.itens[q.id] ? S.itens[q.id].slice() : [-1, 0, 0, 0, 0, 0, 0];
  const antes = r[0];
  const estavaNaLista = antes >= 0 && antes < 3;
  let ok = null;
  if (resp === 'B') r[0] = 0;
  else {
    ok = resp === q.g;
    if (ok) {
      r[2]++;
      if (antes < 0) r[0] = duvida ? 2 : 4;
      else r[0] = duvida ? Math.max(1, Math.min(antes, 2)) : Math.min(5, antes + 1);
      if (duvida) r[5]++;
    } else { r[3]++; r[0] = 0; if (duvida) r[6]++; }
  }
  r[1] = hoje + INTERVALOS[r[0]];
  r[4] = hoje;
  S.itens[q.id] = r;
  if (estavaNaLista && r[0] >= 3) S.perfil.saidos = (S.perfil.saidos || 0) + 1;
  const d = diaLog();
  if (resp === 'B') d.b = (d.b || 0) + 1; else { d.r++; if (ok) d.c++; else d.e++; }
  if (ok === false) sugerirPesquisaDoErro(q);
  return ok;
}
function ganharXP(x) {
  if (!x) return;
  const antes = nivelDe(S.perfil.xp).n;
  S.perfil.xp += x;
  diaLog().xp += x;
  const depois = nivelDe(S.perfil.xp);
  if (depois.n > antes) avisar('N' + depois.n, 'Subiu de nível', depois.nome);
}
function verificarMeta() {
  const d = diaLog();
  if (!d.metaOk && d.r >= S.perfil.meta) { d.metaOk = 1; ganharXP(50); avisar('M', 'Meta do dia cumprida', '+50 XP de bônus'); conquistar('meta'); }
}
function conquistar(id) {
  if (S.perfil.conq[id]) return;
  S.perfil.conq[id] = hojeISO();
  const c = CONQ.find((x) => x.id === id);
  if (c) avisar(c.ic, 'Conquista: ' + c.nome, c.desc);
}
function verificarConquistas(ctx) {
  ctx = ctx || {};
  const t = totais();
  if (t.r >= 1) conquistar('primeira');
  if (t.r >= 100) conquistar('r100');
  if (t.r >= 500) conquistar('r500');
  if (t.r >= 1000) conquistar('r1000');
  if (t.k >= 50) conquistar('cards50');
  if (t.k >= 300) conquistar('cards300');
  if ((S.perfil.recordes.combo || 0) >= 10) conquistar('combo10');
  if ((S.perfil.recordes.combo || 0) >= 25) conquistar('combo25');
  const seq = sequencia();
  if (seq > (S.perfil.melhorSeq || 0)) S.perfil.melhorSeq = seq;
  if (seq >= 7) conquistar('seq7');
  if (seq >= 30) conquistar('seq30');
  if (S.simulados.length) conquistar('sim1');
  if (S.simulados.some((s) => s.n >= 30 && s.liq / s.n >= 0.7)) conquistar('sim70');
  if ((S.perfil.recordes.relampago || 0) >= 15) conquistar('relampago15');
  const lidos = Object.keys(S.perfil.lidos || {}).length;
  if (lidos >= 20) conquistar('lei20');
  if (ARTS.length && lidos >= ARTS.length) conquistar('leitodas');
  if ((S.perfil.saidos || 0) >= 25) conquistar('lista25');
  if (Object.values(S.pesquisa).filter((p) => p.s).length >= 10) conquistar('pesq10');
  if (BLOCOS.some((b) => (dominioBloco(b.id) || 0) >= 0.8)) conquistar('bloco80');
  if (P1.every((b) => (dominioBloco(b) || 0) >= 0.6)) conquistar('p1');
  let duv = 0;
  for (const r of Object.values(S.itens)) duv += (r[5] || 0) + (r[6] || 0);
  if (duv >= 20) conquistar('calibrado');
  if (ctx.respondeu && new Date().getHours() >= 23) conquistar('coruja');
  const rt = roteiroHoje();
  if (rt && rt.passos.every((p) => p.feito) && (S.perfil.dias[hojeISO()] || {}).r > 0) conquistar('roteiro');
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
  return [HOJE() + ivl, ivl, ease, reps, lapses, HOJE()];
}
function avaliarCard(id, nota) {
  const novo = cardNovo(id);
  S.cards[id] = calcularCard(id, nota);
  const d = diaLog();
  d.k = (d.k || 0) + 1;
  if (novo) d.n = (d.n || 0) + 1;
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
    if (maxFreq != null && g.f > maxFreq) continue;
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
  const venc = [], novas = [], lista = [], resto = [];
  for (const q of pool) {
    const r = rec(q.id);
    if (!r || r[0] < 0) novas.push(q);
    else if (r[0] < 3 && r[1] <= hoje) venc.push(q);
    else if (r[0] < 3) lista.push(q);
    else resto.push(q);
  }
  embaralhar(venc); embaralhar(novas); embaralhar(lista);
  resto.sort((a, b) => rec(a.id)[1] - rec(b.id)[1]);
  let ordem;
  if (filtro === 'novas') ordem = novas.concat(venc, lista, resto);
  else if (filtro === 'erradas') ordem = pool.filter((q) => { const r = rec(q.id); return r && r[3] > 0; }).sort((a, b) => rec(b.id)[3] - rec(a.id)[3]);
  else ordem = venc.concat(novas, lista, resto);
  return embaralhar(ordem.slice(0, n));
}
function selecionarProva(n) {
  const escolhidos = [];
  const usados = new Set();
  for (const [disc, peso] of Object.entries(PESOS_PROVA)) {
    const pool = Q.filter((q) => { const b = BI.get(q.b); return b && b.disciplina === disc; });
    selecionar(pool, Math.min(pool.length, Math.round(n * peso)), 'mistas').forEach((q) => { escolhidos.push(q); usados.add(q.id); });
  }
  if (escolhidos.length < n) selecionar(Q.filter((q) => !usados.has(q.id)), n - escolhidos.length, 'mistas').forEach((q) => escolhidos.push(q));
  return embaralhar(escolhidos.slice(0, n));
}

/* ================= Sessões ================= */
let relogioTimer = null;
function iniciarSessao(cfg) {
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
    const v = listaVencida();
    const l = listaCurta().filter((q) => !vencida(q.id));
    itens = embaralhar(v.concat(embaralhar(l)).slice(0, cfg.n || 30));
    if (!itens.length) { avisar('LC', 'Lista curta vazia', 'Nenhum erro pendente. Siga com questões novas.'); return; }
  } else if (cfg.ids) itens = cfg.ids.map((id) => QI.get(id)).filter(Boolean);
  else if (cfg.prova) itens = selecionarProva(cfg.n || 60);
  else if (cfg.modo === 'relampago') itens = embaralhar(poolDe(cfg.blocos));
  else itens = selecionar(poolDe(cfg.blocos), cfg.n || 20, cfg.filtro || 'mistas');
  if (!itens.length) { avisar('!', 'Sem itens', 'Nenhuma questão disponível com esse filtro.'); return; }
  sessao = novaSessao(cfg, itens.map((q) => q.id));
  abrirSessao();
}
function iniciarCards(ids, titulo) {
  sessao = novaSessao({ modo: 'cards', titulo }, ids);
  sessao.notas = { 1: 0, 2: 0, 3: 0, 4: 0 };
  sessao.repetidos = {};
  abrirSessao();
}
function novaSessao(cfg, ids) {
  return {
    modo: cfg.modo, titulo: cfg.titulo || tituloModo(cfg.modo), dia: cfg.dia || null, ids, i: 0, resp: {}, duv: {}, revelado: false,
    combo: 0, comboMax: 0, xp: 0, ini: Date.now(), fim: false, confirmar: null, flash: null,
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
function fecharSessao() {
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
    renderSessao();
    return;
  }
  if (sessao.revelado || sessao.flash || resp === 'B') return;
  const ok = registrar(q, resp, !!sessao.duv[id]);
  sessao.resp[id] = resp;
  let x = 0;
  if (ok) { sessao.combo++; sessao.comboMax = Math.max(sessao.comboMax, sessao.combo); x = xpAcerto(q, sessao.combo, sessao.modo); }
  else sessao.combo = 0;
  if (sessao.comboMax > (S.perfil.recordes.combo || 0)) S.perfil.recordes.combo = sessao.comboMax;
  sessao.xp += x;
  ganharXP(x);
  sessao.ultimoGanho = x;
  verificarMeta();
  verificarConquistas({ respondeu: true });
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
    let c = 0, e = 0, b = 0, xp = 0;
    sessao.ids.forEach((id) => {
      const q = QI.get(id);
      const r = sessao.resp[id] || 'B';
      const ok = registrar(q, r, !!sessao.duv[id]);
      if (r === 'B') b++; else if (ok) { c++; xp += 10; } else e++;
    });
    xp += 40;
    sessao.xp = xp;
    ganharXP(xp);
    S.simulados.unshift({ data: hojeISO(), n: sessao.ids.length, c, e, b, liq: c - e, seg: Math.round(sessao.dur), titulo: sessao.titulo });
    S.simulados = S.simulados.slice(0, 60);
    verificarMeta();
  }
  if (sessao.modo === 'relampago') {
    let c = 0, e = 0;
    sessao.ids.forEach((id) => { const r = sessao.resp[id]; if (!r) return; if (r === QI.get(id).g) c++; else e++; });
    if (c - e > (S.perfil.recordes.relampago || 0)) { S.perfil.recordes.relampago = c - e; sessao.recorde = true; }
  }
  if (sessao.dia) S.perfil.feitos[sessao.dia] = 1;
  verificarConquistas();
  Store.salvarTudo();
  renderSessao();
  document.getElementById('sessao').scrollTop = 0;
}

/* ================= Avisos ================= */
function avisar(ic, titulo, texto) {
  const box = document.getElementById('avisos');
  const el = document.createElement('div');
  el.className = 'aviso';
  el.innerHTML = '<div class="ic">' + esc(ic) + '</div><div><b>' + esc(titulo) + '</b><span>' + esc(texto || '') + '</span></div>';
  el.addEventListener('click', () => el.remove());
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), 3800);
}

/* ================= Componentes ================= */
function iconeFogo() { return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2.2 1-3.8 2.3-5 .2 1.6 1 2.7 2.2 3.1C11 8.5 11.3 5.2 12 2z"/></svg>'; }
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
    '<div class="status"><span class="pilula fogo' + (seq ? '' : ' apagado') + '" title="Dias seguidos de estudo">' + iconeFogo() + seq + '</span>' +
    '<span class="pilula xp" title="Pontos de experiência">' + fmtNum(S.perfil.xp) + ' XP</span>' +
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
function artigosDoDia(dia) {
  const arts = [];
  for (const b of blocosDoDia(dia)) for (const a of (BI.get(b) && BI.get(b).artigos) || []) if (!arts.includes(a)) arts.push(a);
  return arts.filter((a) => ARTI.has(a) && !/^Art\. [\d\-A-Z]+\.? \((VETADO|Revogado)/.test(ARTI.get(a).texto));
}
function rotulosArts(arts) {
  if (arts.length <= 3) return arts.map((a) => rotuloArt(a).toLowerCase()).join(', ');
  return 'arts. ' + arts[0] + ' a ' + arts[arts.length - 1] + ' (' + arts.length + ' artigos)';
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
function roteiroHoje() {
  const ctx = contextoHoje();
  const dia = ctx.tipo === 'dia' ? ctx.dia : null;
  const d = S.perfil.dias[hojeISO()] || { r: 0, k: 0, n: 0, a: [] };
  const blocos = blocosDoDia(dia);
  const venc = listaVencida().length;
  const cardsV = cardsVencidos().length;
  const arts = artigosDoDia(dia);
  const lidosHoje = (d.a || []).filter((a) => arts.includes(a)).length;
  const cardsBlocos = blocos.filter((b) => (CARDS_POR_BLOCO.get(b) || []).length);
  const novosDisp = cardsNovos(cardsBlocos.length ? cardsBlocos : null).length;
  const pesqHoje = Object.values(S.pesquisa).filter((p) => p.s && p.f === hojeISO()).length;
  const passos = [];
  passos.push({
    titulo: 'Revisar o que venceu', feito: venc === 0 && cardsV === 0,
    texto: venc || cardsV ? (venc ? pl(venc, 'questão da lista curta vence', 'questões da lista curta vencem') : 'Nenhuma questão vencida') + ' · ' + (cardsV ? pl(cardsV, 'card vence', 'cards vencem') : 'nenhum card vencido') + ' hoje.' : 'Nada vencido. A revisão espaçada traz de volta o que você errou na hora certa.',
    botoes: (venc ? '<button class="btn pequeno primario" data-acao="iniciar-revisao">Questões (' + venc + ')</button>' : '') + (cardsV ? '<button class="btn pequeno' + (venc ? '' : ' primario') + '" data-acao="cards-revisao">Cards (' + cardsV + ')</button>' : ''),
  });
  if (dia) {
    const feito = !!S.perfil.feitos[dia.data];
    passos.push({ titulo: dia.modo === 'simulado' ? 'Simulado do dia' : dia.modo === 'revisao' ? 'Sessão de revisão do dia' : 'Questões do dia', feito,
      texto: dia.atividade, botoes: '<button class="btn pequeno primario" data-acao="iniciar-dia" data-dia="' + dia.data + '">' + (feito ? 'Outra rodada' : 'Começar') + ' · ' + esc(rotuloModoDia(dia)) + '</button>' });
  } else {
    passos.push({ titulo: 'Questões livres', feito: d.r >= S.perfil.meta, texto: 'Sem sessão programada para hoje. Uma rodada leve mantém a sequência.',
      botoes: '<button class="btn pequeno primario" data-acao="treino-rapido">Treino de 20 itens</button>' });
  }
  if (arts.length) {
    passos.push({ titulo: 'Lei seca grifada', feito: lidosHoje >= arts.length,
      texto: 'Leia na literalidade: ' + rotulosArts(arts) + '. Lidos hoje: ' + lidosHoje + ' de ' + arts.length + '.',
      botoes: '<button class="btn pequeno" data-acao="ler-dia">Ler em sequência</button>' });
  } else {
    passos.push({ titulo: 'Lei seca grifada', feito: (d.a || []).length >= 3, texto: 'Abra os artigos das questões que você errou. Os grifos mostram prazos, palavras de alerta e o que mais cai.',
      botoes: '<button class="btn pequeno" data-acao="ir" data-vista="lei">Abrir a lei</button>' });
  }
  const metaNovos = Math.min(novosDisp + (d.n || 0), S.perfil.novosCards || 20, 10);
  passos.push({ titulo: 'Cards cloze', feito: (d.n || 0) >= metaNovos && cardsV === 0,
    texto: (cardsBlocos.length ? 'Lacunas dos artigos do dia. ' : 'Lacunas da LGPD. ') + 'Novos hoje: ' + (d.n || 0) + ' de ' + (S.perfil.novosCards || 20) + '.',
    botoes: '<button class="btn pequeno" data-acao="cards-dia">Estudar cards</button>' });
  const sugest = sugestoesDoDia(blocos);
  passos.push({ titulo: 'Para pesquisar', feito: pesqHoje > 0,
    texto: sugest.length ? 'Sugestão de hoje: ' + sugest[0] + '.' : 'Abra a sua lista e pesquise um tema.',
    botoes: (sugest.length ? '<a class="btn pequeno" href="' + esc(busca(sugest[0])) + '" target="_blank" rel="noopener">Pesquisar ↗</a><button class="btn pequeno" data-acao="add-pesq" data-t="' + esc(sugest[0]) + '" data-o="roteiro do dia">Guardar na lista</button>' : '') +
      '<button class="btn pequeno" data-acao="mais" data-sub="pesquisar">Minha lista (' + Object.values(S.pesquisa).filter((p) => !p.s).length + ')</button>' });
  return { dia, passos };
}
function renderHoje() {
  const ctx = contextoHoje();
  const d = diaLog();
  const h = hojeISO();
  const rt = roteiroHoje();
  const feitos = rt.passos.filter((p) => p.feito).length;
  let topo = '<div class="cartao destaque"><div class="heroi">' +
    '<div><div class="dia">' + esc(fmtData(h, { weekday: 'long' })) + '</div><div class="data">' + esc(fmtData(h, { day: '2-digit', month: 'long', year: 'numeric' })) +
    (ctx.tipo === 'dia' ? ' · ' + esc(ctx.dia.duracao) : '') + '</div></div>' + anel(d.r, S.perfil.meta) +
    '<p class="atividade">' + (ctx.tipo === 'dia' ? esc(ctx.dia.atividade) : ctx.tipo === 'folga' ? '<span class="mudo">Dia livre por padrão. Próxima sessão, ' + esc(fmtData(ctx.prox.data, { weekday: 'short', day: '2-digit', month: '2-digit' })) + ':</span> ' + esc(ctx.prox.atividade) : 'Ciclo de 11 semanas concluído: recomece pelos blocos mais fracos.') + '</p></div></div>';
  const aguard = ctx.tipo === 'dia' ? (ctx.dia.blocos || []).filter((b) => BI.get(b) && BI.get(b).aguardando && !(POR_BLOCO.get(b) || []).length) : [];
  if (aguard.length) topo += '<p class="nota-aguardando">' + esc(aguard.map(nomeBloco).join('; ')) + ': ainda sem questões. A sessão usa os blocos ligados ao tema. Cole o texto na conversa com o Claude para ganhar questões próprias.</p>';
  let roteiro = '<div class="cartao"><div class="secao-cab"><h2>Roteiro de hoje</h2><span class="mono pequeno mudo">' + feitos + ' de ' + rt.passos.length + '</span></div><div class="roteiro">';
  rt.passos.forEach((p, i) => {
    roteiro += '<div class="passo' + (p.feito ? ' feito' : '') + '"><div class="marca-passo">' + (p.feito ? '✓' : i + 1) + '</div><div class="corpo-passo"><b>' + esc(p.titulo) + '</b><p>' + esc(p.texto) + '</p><div class="linha-btns">' + p.botoes + '</div></div></div>';
  });
  roteiro += '</div><p class="pequeno mudo">A ordem é o método: revisão primeiro, depois questão, depois a lei onde você errou, depois a memorização com lacunas. <button class="linkish" data-acao="mais" data-sub="metodo">Entenda o método</button></p></div>';
  const nv = nivelDe(S.perfil.xp);
  const nivel = '<div class="cartao"><div class="nivel"><div class="insignia">' + nv.n + '</div><div class="info"><div class="titulo">' + esc(nv.nome) + '</div>' +
    barra((S.perfil.xp - nv.base) / (nv.prox - nv.base), 'ouro') + '<div class="pequeno mudo mono">' + fmtNum(S.perfil.xp) + ' / ' + fmtNum(nv.prox) + ' XP · faltam ' + fmtNum(nv.prox - S.perfil.xp) + '</div></div></div></div>';
  const modos = '<div class="secao"><div class="secao-cab"><h2>Modos de jogo</h2></div><div class="grade-modos">' +
    '<button class="modo" data-acao="abrir-modo" data-modo="simulado"><b>Simulado Cebraspe</b><span>Uma errada anula uma certa. Prova completa com os pesos do plano ou só os seus blocos.</span><span class="num">' + pl(S.simulados.length, 'simulado feito', 'simulados feitos') + '</span></button>' +
    '<button class="modo" data-acao="relampago" data-blocos="' + P1.join(',') + '"><b>Relâmpago 90 s</b><span>Quantos itens da prioridade 1 você acerta em um minuto e meio?</span><span class="num">Recorde: ' + (S.perfil.recordes.relampago || 0) + '</span></button>' +
    '<button class="modo" data-acao="ir" data-vista="cards"><b>Cards cloze</b><span>A letra da lei com lacunas, no estilo do Anki, com revisão espaçada.</span><span class="num">' + CARDS.length + ' cards</span></button>' +
    '<button class="modo" data-acao="abrir-modo" data-modo="treino"><b>Treino livre</b><span>Escolha blocos e receba gabarito comentado a cada item.</span><span class="num">' + Q.length + ' questões</span></button></div></div>';
  const faltam = diaNum(D.cronograma.edital) - HOJE();
  const edital = '<div class="cartao"><div class="contagem"><span class="grande">' + Math.max(0, faltam) + '</span><span>' +
    (faltam >= 0 ? 'dias até 22/12/2026, prazo legal máximo para o edital.' : 'O prazo legal do edital (22/12/2026) passou: acompanhe as notícias.') + '</span></div></div>';
  document.getElementById('vista-hoje').innerHTML = topo + roteiro + nivel + modos + edital + '<p class="sync" id="sync"></p>';
  atualizarRodapeSync();
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
  const titulo = fmtData(dia.data, { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' · ' + (dia.modo === 'revisao' ? 'Revisão' : dia.modo === 'simulado' ? 'Simulado' : 'Treino do dia');
  if (dia.modo === 'revisao') {
    if (!listaCurta().length) { iniciarSessao({ modo: 'treino', n: Math.min(dia.n, 20), blocos: [], filtro: 'mistas', titulo, dia: dia.data }); return; }
    iniciarSessao({ modo: 'revisao', n: dia.n, titulo, dia: dia.data });
    return;
  }
  if (dia.modo === 'simulado') {
    iniciarSessao({ modo: 'simulado', n: dia.n, blocos: dia.blocos, prova: !dia.blocos.length, titulo, dia: dia.data, minutos: Math.round(dia.n * 1.5) });
    return;
  }
  iniciarSessao({ modo: 'treino', n: dia.n, blocos: dia.blocos, filtro: 'mistas', titulo, dia: dia.data });
}

/* ================= Questões (montar sessão) ================= */
function renderQuestoes() {
  const modo = UI.modo;
  const ns = modo === 'simulado' ? [30, 60, 120] : [10, 20, 30, 50];
  if (!ns.includes(UI.n)) UI.n = ns[1];
  const sel = new Set(UI.blocos);
  const pool = poolDe(UI.blocos);
  const usarProva = modo === 'simulado' && UI.prova === 'prova';
  let html = '<div class="secao"><div class="secao-cab"><h2>Montar sessão</h2><span class="mudo pequeno mono">' + Q.length + ' questões no banco</span></div>' +
    '<div class="chips" role="group" aria-label="Modo">' +
    ['treino', 'simulado', 'relampago'].map((m) => '<button class="chip" data-acao="set-modo" data-modo="' + m + '" aria-pressed="' + (modo === m) + '">' + esc({ treino: 'Treino comentado', simulado: 'Simulado Cebraspe', relampago: 'Relâmpago 90 s' }[m]) + '</button>').join('') + '</div>' +
    '<p class="mudo pequeno">' + esc({
      treino: 'Gabarito, comentário, trecho da lei e termos para pesquisar logo após cada item. Primeiro vêm os itens da lista curta que vencem hoje, depois os inéditos.',
      simulado: 'Sem gabarito até entregar. Cada errada anula uma certa; em branco não pontua. No fim, você vê o resultado por disciplina e se valeu a pena chutar.',
      relampago: 'Um minuto e meio. Acerto soma, erro subtrai. Vale o recorde.',
    }[modo]) + '</p></div>';
  if (modo === 'simulado') {
    html += '<div class="campo"><span class="rot">Composição</span><div class="chips">' +
      '<button class="chip" data-acao="set-prova" data-prova="prova" aria-pressed="' + usarProva + '">Prova completa (pesos do plano)</button>' +
      '<button class="chip" data-acao="set-prova" data-prova="blocos" aria-pressed="' + !usarProva + '">Só os blocos marcados</button></div>' +
      (usarProva ? '<p class="pequeno mudo">' + Object.entries(PESOS_PROVA).map(([d, p]) => esc(DI.get(d).nome) + ' ' + Math.round(p * 100) + '%').join(' · ') + '</p>' : '') + '</div>';
  }
  if (modo !== 'relampago') html += '<div class="campo"><span class="rot">Quantidade de itens</span><div class="chips">' + ns.map((n) => '<button class="chip" data-acao="set-n" data-n="' + n + '" aria-pressed="' + (UI.n === n) + '">' + n + '</button>').join('') + '</div></div>';
  if (modo === 'treino') html += '<div class="campo"><span class="rot">Quais itens</span><div class="chips">' + [['mistas', 'Vencidas + inéditas'], ['novas', 'Só inéditas'], ['erradas', 'Só as que já errei']].map(([v, t]) => '<button class="chip" data-acao="set-filtro" data-filtro="' + v + '" aria-pressed="' + (UI.filtro === v) + '">' + t + '</button>').join('') + '</div></div>';
  if (!usarProva) {
    html += '<div class="secao"><div class="secao-cab"><h2>Blocos</h2><span class="mudo pequeno mono">' + pool.length + ' itens disponíveis</span></div>' +
      '<div class="chips"><button class="chip" data-acao="preset" data-preset="p1">Prioridade 1</button><button class="chip" data-acao="preset" data-preset="lgpd">LGPD inteira</button><button class="chip" data-acao="preset" data-preset="tudo">Tudo</button><button class="chip" data-acao="preset" data-preset="nada">Limpar</button></div>';
    html += listaBlocos(sel, 'toggle-bloco', (b) => POR_BLOCO.get(b.id) || [], (b) => dominioBloco(b.id)) + '</div>';
  }
  html += '<button class="btn primario largo" data-acao="comecar"' + (pool.length || usarProva ? '' : ' disabled') + '>Começar ' + esc({ treino: 'treino', simulado: 'simulado', relampago: 'relâmpago' }[modo]) + '</button>';
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
  let html = '<div class="secao"><div class="secao-cab"><h2>Cards cloze da LGPD</h2><span class="mudo pequeno mono">' + CARDS.length + ' cards · ' + NOTAS.length + ' notas</span></div>' +
    '<p class="mudo pequeno">Cada card esconde uma palavra-chave do texto literal da lei. Responda de cabeça, revele e diga como foi: Errei, Difícil, Bom ou Fácil. O intervalo até a próxima revisão cresce a cada acerto, como no Anki.</p></div>';
  html += '<div class="contadores"><div class="rev"><b>' + venc + '</b><span>para revisar hoje</span></div><div class="nov"><b>' + Math.min(rest, novos) + '</b><span>novos liberados hoje</span></div><div><b>' + vistos + '</b><span>já estudados</span></div></div>';
  html += '<div class="linha-btns"><button class="btn primario" data-acao="cards-iniciar"' + (venc || (rest && novos) ? '' : ' disabled') + '>Estudar (' + (venc + Math.min(rest, novos)) + ')</button>' +
    '<button class="btn" data-acao="cards-so-revisao"' + (venc ? '' : ' disabled') + '>Só revisões (' + venc + ')</button></div>';
  if (!rest) html += '<p class="pequeno mudo">Limite de cards novos de hoje atingido (' + (S.perfil.novosCards || 20) + '). Ajuste em Mais → Ajustes.</p>';
  html += '<div class="secao"><div class="secao-cab"><h2>Baralhos</h2><span class="mudo pequeno">Nenhum marcado = todos</span></div>' +
    listaBlocos(sel, 'toggle-bloco-card', (b) => CARDS_POR_BLOCO.get(b.id) || [], (b) => dominioCardsBloco(b.id)) + '</div>';
  html += '<div class="cartao"><h2>Levar para o Anki</h2><p class="pequeno">Baixe o arquivo e importe no Anki (Arquivo → Importar). Ele já vem com o tipo de nota Cloze e o baralho “ANPD::LGPD (lei seca)”. O progresso do Anki não volta para o app.</p>' +
    '<div class="linha-btns"><button class="btn" data-acao="exportar-anki">Baixar arquivo do Anki (.txt)</button></div></div>';
  document.getElementById('vista-cards').innerHTML = html;
}
function exportarAnkiTexto() {
  const linhas = ['#separator:tab', '#html:true', '#notetype:Cloze', '#deck:ANPD::LGPD (lei seca)', '#tags column:3', '#columns:Text\tBack Extra\tTags'];
  const limpa = (s) => String(s).replace(/[\t\n\r]+/g, ' ');
  for (const n of NOTAS) {
    let auto = 0;
    const texto = n.t.replace(RE_LACUNA, (m, num, t) => '{{c' + (num ? num : ++auto) + '::' + t + '}}');
    linhas.push([limpa(texto), limpa(n.r + (n.dc ? ' · dica: ' + n.dc : '')), n.b].join('\t'));
  }
  return linhas.join('\n') + '\n';
}

/* ================= Render da sessão ================= */
function renderSessao() {
  const el = document.getElementById('sessao');
  if (!sessao) return;
  if (sessao.fim) { el.innerHTML = '<div class="sessao-corpo">' + (sessao.modo === 'cards' ? renderResultadoCards() : renderResultado()) + '</div>'; return; }
  const total = sessao.modo === 'relampago' ? null : sessao.ids.length;
  const relogio = sessao.limite ? fmtTempo(sessao.limite - decorrido()) : fmtTempo(decorrido());
  let html = '<div class="sessao-corpo"><div class="sessao-topo"><button class="icone-btn" data-acao="sair-sessao" aria-label="Sair da sessão"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
    '<div class="tit"><b>' + esc(sessao.titulo) + '</b><span>' + (total ? (sessao.modo === 'cards' ? 'Card ' : 'Item ') + (sessao.i + 1) + ' de ' + total : 'Item ' + (sessao.i + 1)) + (sessao.xp ? ' · +' + sessao.xp + ' XP' : '') + '</span></div>' +
    (sessao.modo !== 'simulado' && sessao.modo !== 'cards' && sessao.combo >= 2 ? '<span class="combo' + (sessao.revelado || sessao.flash ? ' pulso' : '') + '">combo ×' + sessao.combo + '</span>' : '') +
    '<span class="relogio" id="relogio">' + relogio + '</span></div>';
  if (sessao.confirmar) html += renderConfirmacao();
  if (sessao.modo === 'cards') html += barra(sessao.i / sessao.ids.length) + renderCardSessao(CI.get(sessao.ids[sessao.i]));
  else { if (total) html += renderTira(); html += renderItem(QI.get(sessao.ids[sessao.i])); }
  el.innerHTML = html + '</div>';
}
function renderTira() {
  const atual = sessao.ids[sessao.i];
  return '<div class="tira" aria-label="Folha de respostas">' + sessao.ids.map((id, k) => {
    const r = sessao.resp[id];
    let cls = '';
    if (sessao.modo === 'simulado') cls = r ? (r === 'B' ? 'B' : 'R') : '';
    else if (r) cls = r === QI.get(id).g ? 'C' : 'E';
    if (id === atual) cls += ' atual';
    const i = '<i class="' + cls.trim() + '"></i>';
    return sessao.modo === 'simulado' ? '<button data-acao="ir-item" data-i="' + k + '" aria-label="Ir para o item ' + (k + 1) + '">' + i + '</button>' : i;
  }).join('') + '</div>';
}
function renderApoio(q, aberto) {
  if (q.ap < 0) return '';
  return '<details class="apoio-det"' + (aberto ? ' open' : '') + '><summary>Texto de apoio</summary><div class="apoio">' + D.apoios[q.ap].split('\n').map((p) => '<p>' + esc(p) + '</p>').join('') + '</div></details>';
}
function renderItem(q) {
  const id = q.id, sim = sessao.modo === 'simulado', marcada = sessao.resp[id];
  let html = '<article class="item"><div class="item-cab"><span class="selo mono">' + esc(nomeBloco(q.b)) + '</span><span class="item-num">' + esc(q.id) + '</span></div>';
  html += renderApoio(q, sessao.i === 0 || sim || !sessao.ids.slice(0, sessao.i).some((x) => QI.get(x).ap === q.ap));
  html += '<p class="enunciado">' + (sessao.revelado ? marcarTermos(q.e, 3) : esc(q.e)) + '</p>';
  if (sessao.flash) {
    html += '<div class="veredito ' + sessao.flash + '"><span>' + (sessao.flash === 'ok' ? 'Certo' : 'Errado: gabarito ' + (q.g === 'C' ? 'CERTO' : 'ERRADO')) + '</span>' + (sessao.ultimoGanho ? '<span class="ganho">+' + sessao.ultimoGanho + ' XP</span>' : '') + '</div>';
  } else if (!sessao.revelado) {
    if (sessao.modo !== 'relampago') html += '<label class="duvida"><input type="checkbox" data-acao="duvida"' + (sessao.duv[id] ? ' checked' : '') + '> Estou em dúvida (mede quando vale chutar)</label>';
    html += '<div class="respostas"><button class="bolha c' + (marcada === 'C' ? ' marcada' : '') + '" data-acao="responder" data-r="C"><span class="oval"><span>C</span></span>CERTO</button>' +
      '<button class="bolha e' + (marcada === 'E' ? ' marcada' : '') + '" data-acao="responder" data-r="E"><span class="oval"><span>E</span></span>ERRADO</button>' +
      (sim ? '<button class="bolha b' + (marcada === 'B' ? ' marcada' : '') + '" data-acao="responder" data-r="B">Em branco</button>' : '') + '</div>';
    html += '<p class="atalhos">Teclado: C = certo · E = errado' + (sim ? ' · B = em branco · ← → navegam' : '') + ' · D = dúvida</p>';
    if (sim) html += '<div class="linha-btns"><button class="btn" data-acao="anterior"' + (sessao.i ? '' : ' disabled') + '>Anterior</button><button class="btn" data-acao="proximo"' + (sessao.i < sessao.ids.length - 1 ? '' : ' disabled') + '>Próximo</button><button class="btn primario" data-acao="entregar">Entregar (' + Object.keys(sessao.resp).length + '/' + sessao.ids.length + ')</button></div>';
  } else {
    const r = sessao.resp[id], ok = r === q.g;
    html += '<div class="veredito ' + (ok ? 'ok' : 'no') + '"><span>' + (ok ? 'Você marcou ' + (r === 'C' ? 'CERTO' : 'ERRADO') + ' e acertou.' : 'Você marcou ' + (r === 'C' ? 'CERTO' : 'ERRADO') + '. O gabarito é ' + (q.g === 'C' ? 'CERTO' : 'ERRADO') + '.') + '</span>' +
      (sessao.ultimoGanho ? '<span class="ganho ganho-voa">+' + sessao.ultimoGanho + ' XP</span>' : '<span class="pequeno">Foi para a lista curta</span>') + '</div>';
    html += renderExplicacao(q);
    html += '<button class="btn primario largo" data-acao="proximo">' + (sessao.i < sessao.ids.length - 1 ? 'Próximo item' : 'Ver resultado') + '</button><p class="atalhos">Enter = próximo</p>';
  }
  return html + '</article>';
}
function renderExplicacao(q) {
  let html = '<div class="explica"><span class="gab">Gabarito: ' + (q.g === 'C' ? 'certo' : 'errado') + ' · armadilha: ' + esc(D.armadilhas[q.a] || q.a) + '</span>';
  html += '<p>' + marcarTermos(q.c, 3) + '</p>';
  if (q.t && q.t.length) {
    html += '<div class="citacao">' + q.t.map((t) => '<q>' + esc(t) + '</q>').join('') + '<span class="fonte">' + esc(q.r) + '</span>' +
      (q.art && ARTI.get(q.art) ? '<div><button class="linkish" data-acao="ver-art" data-art="' + esc(q.art) + '" data-q="' + esc(q.id) + '">Ler o ' + esc(rotuloArt(q.art).toLowerCase()) + ' inteiro, grifado</button></div>' : '') + '</div>';
  } else html += '<div class="citacao"><span class="fonte">Fonte: ' + esc(q.r) + '</span></div>';
  if (q.v === 0) html += '<p class="aviso-conferir">Texto oficial ainda não anexado ao app: confira esta referência na fonte antes de confiar nela.</p>';
  html += blocoPesquisar(q.e + ' ' + q.c, q.p, 'questão ' + q.id);
  return html + '</div>';
}
function blocoPesquisar(texto, extras, origem) {
  const termos = termosDe(texto, 4, 0.35);
  const itens = (extras || []).slice(0, 3);
  if (!termos.length && !itens.length) return '';
  let html = '<div class="pesquisar-box"><span class="rotulo">Para pesquisar e entender melhor</span><div class="chips">';
  termos.forEach((a) => { html += '<button class="chip termo-chip" data-acao="termo" data-t="' + a.g.i + '">' + esc(a.g.t) + '</button>'; });
  itens.forEach((t) => { html += '<a class="chip termo-chip" href="' + esc(busca(t)) + '" target="_blank" rel="noopener" data-acao="add-pesq" data-t="' + esc(t) + '" data-o="' + esc(origem) + '">' + esc(t) + ' ↗</a>'; });
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
    html += '<div class="notas-card">' + [[1, 'Errei'], [2, 'Difícil'], [3, 'Bom'], [4, 'Fácil']].map(([n, t]) => '<button class="n' + n + '" data-acao="avaliar" data-n="' + n + '">' + t + '<small>' + fmtIntervalo(calcularCard(card.id, n)[1]) + '</small></button>').join('') + '</div>';
    html += '<p class="atalhos">Teclado: 1 Errei · 2 Difícil · 3 Bom · 4 Fácil</p>';
    if (nota.art && ARTI.get(nota.art)) html += '<div><button class="linkish" data-acao="ver-art" data-art="' + esc(nota.art) + '">Ler o ' + esc(rotuloArt(nota.art).toLowerCase()) + ' inteiro, grifado</button></div>';
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
    return '<div class="cartao destaque"><b>Sair da sessão?</b><p class="mudo">' + (sessao.modo === 'simulado' ? 'As marcações deste simulado serão descartadas.' : 'O que você já respondeu fica salvo.') + '</p><div class="linha-btns"><button class="btn primario" data-acao="confirmar-saida">Sair</button><button class="btn" data-acao="cancelar-conf">Continuar</button></div></div>';
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
  let c = 0, e = 0, b = 0, dc = 0, de = 0;
  const porDisc = {};
  ids.forEach((id) => {
    const r = sessao.resp[id] || 'B', q = QI.get(id), duv = !!sessao.duv[id];
    const disc = (BI.get(q.b) || {}).disciplina || 'outros';
    const pd = (porDisc[disc] ||= { c: 0, e: 0, b: 0 });
    if (r === 'B') { b++; pd.b++; } else if (r === q.g) { c++; pd.c++; if (duv) dc++; } else { e++; pd.e++; if (duv) de++; }
  });
  const liq = c - e, n = ids.length;
  let html = '<div class="sessao-topo"><div class="tit"><b>' + esc(sessao.titulo) + '</b><span>Resultado · ' + fmtTempo(sessao.dur) + '</span></div><button class="btn" data-acao="fechar-sessao">Concluir</button></div>';
  html += '<div class="cartao destaque"><span class="rotulo">Nota líquida Cebraspe (certas − erradas)</span><div class="nota-final"><span class="grande">' + liq + '</span><span class="mudo">de ' + n + ' possíveis · ' + (n ? Math.round((liq / n) * 100) : 0) + '%</span></div>' +
    '<div class="placar"><div class="C"><b>' + c + '</b><span>certas</span></div><div class="E"><b>' + e + '</b><span>erradas</span></div><div><b>' + b + '</b><span>em branco</span></div><div class="L"><b>+' + sessao.xp + '</b><span>XP</span></div></div>';
  if (sessao.modo === 'relampago') html += '<p>' + (sessao.recorde ? '<b>Novo recorde!</b> ' : '') + 'Recorde pessoal: ' + (S.perfil.recordes.relampago || 0) + '.</p>';
  if (sessao.comboMax >= 3) html += '<p class="mudo">Maior sequência de acertos: ' + sessao.comboMax + '.</p>';
  html += '</div>';
  if (sessao.modo === 'simulado' && Object.keys(porDisc).length > 1) {
    html += '<div class="cartao"><h2>Por disciplina</h2><div class="tabela-env"><table class="tabela"><thead><tr><th>Disciplina</th><th>C</th><th>E</th><th>B</th><th>Líquida</th></tr></thead><tbody>' +
      Object.entries(porDisc).map(([dd, v]) => { const t = v.c + v.e + v.b; return '<tr><td>' + esc((DI.get(dd) || { nome: dd }).nome) + '</td><td class="num">' + v.c + '</td><td class="num">' + v.e + '</td><td class="num">' + v.b + '</td><td class="num">' + (v.c - v.e) + ' (' + pct(v.c - v.e, t) + '%)</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }
  const nd = dc + de;
  if (nd) {
    const taxa = pct(dc, nd), semChute = liq - dc + de;
    html += '<div class="cartao"><h2>Chutar ou deixar em branco?</h2><p>Nos ' + pl(nd, 'item marcado', 'itens marcados') + ' com dúvida, você acertou ' + dc + ' (' + taxa + '%). ' +
      (taxa > 50 ? 'Acima de 50%, o chute rendeu pontos: sem ele, sua nota seria ' + semChute + '.' : taxa === 50 ? 'Exatamente 50%: chutar ou deixar em branco deu no mesmo.' : 'Abaixo de 50%, o chute custou pontos: deixando esses itens em branco, sua nota seria ' + semChute + '.') +
      '</p><p class="mudo pequeno">No Cebraspe, chutar só compensa quando a chance de acerto passa de 50%.</p></div>';
  }
  const lista = ids.map((id) => { const q = QI.get(id), r = sessao.resp[id] || 'B'; return { q, cls: r === 'B' ? 'B' : r === q.g ? 'C' : 'E' }; });
  const ordenada = lista.filter((x) => x.cls !== 'C').concat(lista.filter((x) => x.cls === 'C'));
  html += '<div class="secao"><div class="secao-cab"><h2>Revisar itens</h2><span class="mudo pequeno">Erros e brancos primeiro</span></div><div class="lista-rev">' +
    ordenada.map((x) => '<button data-acao="revisar-item" data-q="' + esc(x.q.id) + '" data-r="' + esc(sessao.resp[x.q.id] || 'B') + '"><span class="marca-res ' + x.cls + '">' + ({ C: '✓', E: '✗', B: '–' }[x.cls]) + '</span><span class="txt">' + esc(x.q.e) + '</span></button>').join('') + '</div></div>';
  html += '<div class="linha-btns"><button class="btn primario" data-acao="fechar-sessao">Concluir</button>' + (e + b ? '<button class="btn" data-acao="refazer-erros">Refazer os ' + (e + b) + ' erros e brancos</button>' : '') + '</div>';
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
function fecharFolha() { const f = document.getElementById('folha'); f.hidden = true; f.innerHTML = ''; UI.folhaArt = null; }
function cabFolha(rotulo, titulo) { return '<div class="folha-cab"><div><span class="rotulo">' + esc(rotulo) + '</span><h2>' + esc(titulo) + '</h2></div><button class="btn pequeno" data-acao="fechar-folha">Fechar</button></div>'; }
function folhaItem(id, resp) {
  const q = QI.get(id);
  let html = cabFolha(nomeBloco(q.b), q.id) + renderApoio(q, false) + '<p class="enunciado">' + marcarTermos(q.e, 3) + '</p>';
  if (resp) html += '<div class="veredito ' + (resp !== 'B' && resp === q.g ? 'ok' : 'no') + '"><span>' + (resp === 'B' ? 'Em branco.' : 'Você marcou ' + (resp === 'C' ? 'CERTO' : 'ERRADO') + '.') + ' Gabarito: ' + (q.g === 'C' ? 'CERTO' : 'ERRADO') + '.</span></div>';
  abrirFolha(html + renderExplicacao(q), 'Item ' + q.id);
}
function folhaArtigo(art, qid) {
  const a = ARTI.get(art);
  if (!a) return;
  marcarLido(art);
  abrirFolha(cabFolha(LEI.curto, rotuloArt(art)) + '<p class="pequeno mudo">' + esc(a.estrutura.join(' · ')) + '</p>' + legendaCamadas() +
    '<div class="texto-lei">' + textoLei(a, qid ? [qid] : []) + '</div>', rotuloArt(art));
  UI.folhaArt = art;
  UI.folhaQ = qid || null;
}
function folhaTermo(i) {
  const g = GLOSS[i];
  if (!g) return;
  const naLista = !!S.pesquisa[chavePesq(g.t)];
  const rel = Q.filter((q) => g.re.test(q.e + ' ' + q.c));
  abrirFolha(cabFolha('Glossário', g.t) + '<p>' + esc(g.d) + '</p>' +
    '<div class="linha-btns"><a class="btn primario" href="' + esc(busca(g.s)) + '" target="_blank" rel="noopener">Pesquisar no Google ↗</a>' +
    (naLista ? '<span class="selo ok">Na sua lista</span>' : '<button class="btn" data-acao="add-pesq" data-t="' + esc(g.t) + '" data-o="glossário">Guardar na lista</button>') + '</div>' +
    '<p class="pequeno mudo">Busca sugerida: ' + esc(g.s) + '</p>' +
    (rel.length ? '<div class="linha-btns"><button class="btn" data-acao="treinar-termo" data-t="' + i + '">Treinar ' + pl(rel.length, 'questão', 'questões') + ' com este termo</button></div>' : ''), g.t);
}

/* ================= Lei seca ================= */
function marcarLido(art) {
  if (!S.perfil.lidos) S.perfil.lidos = {};
  const d = diaLog();
  if (!d.a.includes(art)) d.a.push(art);
  if (!S.perfil.lidos[art]) S.perfil.lidos[art] = hojeISO();
  verificarConquistas();
  Store.salvar('perfil');
}
function importancia(id) {
  const qs = (POR_ART.get(id) || []).length;
  const cs = (CARDS_POR_ART.get(id) || []).length;
  const b = BLOCOS.find((x) => (x.artigos || []).includes(id));
  const bonus = b ? (b.prioridade === 1 ? 4 : b.prioridade === 2 ? 2 : 0) : 0;
  return qs * 2 + cs + bonus;
}
function estrelas(id) { const s = importancia(id); return s >= 16 ? 3 : s >= 8 ? 2 : s >= 3 ? 1 : 0; }
const RE_NUM = /(?:R\$\s?)?\d[\d.,]*%?\s\([^)]+\)(?:\s(?:dias|meses|anos|horas))?|\d{1,2}º? de [a-zç]+ de \d{4}/g;
const RE_ALERTA = /(?<![\p{L}])(?:somente|exclusivamente|exclusiva|exclusivos|vedad[oa]s?|salvo|exceto|ressalvad[oa]s?|desde que|em nenhuma hipótese|em nenhum caso|em circunstância alguma|independentemente|não se aplica|sem prejuízo|só não|apenas|sempre que possível|a qualquer momento|imediatamente|nul[oa]s?|gratuita|sem custos)(?![\p{L}])/giu;
const RE_VERBO = /(?<![\p{L}])(?:deverá|deverão|deve|devem|poderá|poderão|pode|podem|compete|competem|cabe|obriga-se|é obrigado)(?![\p{L}])/giu;
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
function textoLei(a, qExtras) {
  const cam = UI.camadas;
  const erros = [], cai = [], extras = [];
  for (const q of POR_ART.get(a.id) || []) { const r = rec(q.id); if (r && r[3] > 0) erros.push(...q.t); cai.push(...q.t); }
  for (const c of CARDS_POR_ART.get(a.id) || []) cai.push(c.nota.t.replace(RE_LACUNA, '$2'));
  for (const id of qExtras || []) { const q = QI.get(id); if (q) extras.push(...q.t); }
  return a.texto.split('\n').map((linha, k) => {
    let rs = [];
    if (cam.cai) rs = rs.concat(rangesTexto(linha, cai, 'g-cai'));
    rs = rs.concat(rangesTexto(linha, extras, 'g-cai'));
    if (cam.erro) rs = rs.concat(rangesTexto(linha, erros, 'g-erro'));
    if (cam.num) rs = rs.concat(rangesRegex(linha, RE_NUM, 'g-num'));
    if (cam.alerta) rs = rs.concat(rangesRegex(linha, RE_ALERTA, 'g-alerta'));
    if (cam.verbo) rs = rs.concat(rangesRegex(linha, RE_VERBO, 'g-verbo'));
    const cortes = new Set([0, linha.length]);
    rs.forEach(([i, f]) => { cortes.add(i); cortes.add(f); });
    const pts = [...cortes].sort((x, y) => x - y);
    let html = '';
    for (let j = 0; j < pts.length - 1; j++) {
      const i = pts[j], f = pts[j + 1];
      const classes = new Set(rs.filter((r) => r[0] <= i && r[1] >= f).map((r) => r[2]));
      if (classes.has('g-erro')) classes.delete('g-cai');
      const seg = fmtNotas(esc(linha.slice(i, f)));
      html += classes.size ? '<span class="' + [...classes].join(' ') + '">' + seg + '</span>' : seg;
    }
    let cls = 'par';
    if (k === 0) cls = 'caput';
    else if (/^[IVXL]+(-[A-Z])?\s-/.test(linha)) cls = 'inc';
    else if (/^[a-z]\)/.test(linha)) cls = 'ali';
    return '<p class="' + cls + '">' + html + '</p>';
  }).join('');
}
function fmtNotas(s) { return s.replace(/\((Redação dada|Incluído|Incluída|Revogado|Promulgação)[^)]*\)/g, (m) => '<span class="nota">' + m + '</span>'); }
function legendaCamadas() {
  const cam = UI.camadas;
  const item = (k, t, estilo) => '<button class="camada" data-acao="camada" data-c="' + k + '" aria-pressed="' + !!cam[k] + '"><i style="' + estilo + '"></i>' + t + '</button>';
  return '<div class="camadas" aria-label="Grifos">' +
    item('cai', 'O que cai', 'background:var(--mark)') + item('num', 'Prazos e números', 'background:var(--accent)') +
    item('alerta', 'Palavras de alerta', 'background:var(--errado)') + item('verbo', 'Deve × pode', 'border:1.5px dotted var(--ink)') +
    item('erro', 'Meus erros', 'background:var(--errado-bg);box-shadow:inset 0 -2px 0 var(--errado)') + '</div>';
}
function renderLei() {
  const el = document.getElementById('vista-lei');
  if (!LEI) { el.innerHTML = '<p class="vazio-msg">Nenhum texto legal anexado ainda.</p>'; return; }
  if (UI.artSel) { el.innerHTML = renderArtigo(UI.artSel); return; }
  let html = '<div class="secao"><div class="secao-cab"><h2>' + esc(LEI.nome) + '</h2><a class="pequeno" href="' + esc(LEI.url) + '" target="_blank" rel="noopener">Planalto ↗</a></div>' +
    '<input class="busca" id="busca-lei" type="search" placeholder="Buscar na lei (ex.: quinze dias, encarregado, Senado)" value="' + esc(UI.busca) + '" aria-label="Buscar na LGPD">' +
    '<div class="chips"><button class="chip" data-acao="ranking" aria-pressed="' + UI.ranking + '">Mais importantes primeiro</button><button class="chip" data-acao="ler-tudo">Ler do art. 1º em diante</button></div>' +
    '<p class="pequeno mudo">Estrelas: quanto o artigo pesa no banco (questões, cards e prioridade do bloco). Pontos: as questões sobre ele (verde dominada, vermelho na lista curta, cinza não respondida).</p></div>';
  if (UI.busca.trim().length >= 3) html += '<div class="resultado-busca">' + buscarLei(UI.busca) + '</div>';
  else if (UI.ranking) {
    const top = ARTS.map((a) => ({ a, s: importancia(a.id) })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s).slice(0, 30);
    html += '<div class="ranking">' + top.map(({ a }) => '<button data-acao="abrir-art" data-art="' + esc(a.id) + '"><b>' + esc(rotuloArt(a.id)) + '</b><span class="t">' + esc(a.texto.split('\n')[0].replace(/^Art\.\s*[\d\-A-Zº.]+\s*/, '').slice(0, 90)) + '</span><span class="estrelas">' + '★'.repeat(estrelas(a.id)) + '</span></button>').join('') + '</div>';
  } else {
    let atual = null, aberto = false;
    for (const a of ARTS) {
      const cap = a.estrutura[0] || '';
      if (cap !== atual) {
        if (aberto) html += '</div></div>';
        html += '<div class="capitulo"><h3>' + esc(cap.replace(/\s*\(Redação dada[^)]*\)/, '')) + '</h3><div class="artigos">';
        aberto = true; atual = cap;
      }
      const qs = POR_ART.get(a.id) || [];
      const pontos = qs.slice(0, 6).map((q) => { const r = rec(q.id); return '<i class="' + (!r || r[0] < 0 ? 'nv' : r[0] >= 3 ? 'ok' : 'no') + '"></i>'; }).join('');
      const vetado = /\((VETADO|Revogado)/.test(a.texto.split('\n')[0]);
      const est = estrelas(a.id);
      html += '<button class="art-btn' + (S.perfil.lidos && S.perfil.lidos[a.id] ? ' lido' : '') + '" data-acao="abrir-art" data-art="' + esc(a.id) + '"' + (vetado ? ' style="opacity:.5"' : '') + '>' + esc(a.id) + (est ? '<span class="estrelas">' + '★'.repeat(est) + '</span>' : '') + '<span class="pontos">' + pontos + '</span></button>';
    }
    if (aberto) html += '</div></div>';
  }
  el.innerHTML = html;
}
function buscarLei(termo) {
  const palavras = semAcento(termo.trim()).split(/[^a-z0-9º]+/).filter(Boolean);
  if (!palavras.length) return '';
  const re = new RegExp(palavras.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^a-z0-9º]+'));
  const res = [];
  for (const a of ARTS) {
    const m = re.exec(semAcento(a.texto));
    if (m) {
      const ini = Math.max(0, m.index - 60);
      res.push('<button data-acao="abrir-art" data-art="' + esc(a.id) + '"><b>' + esc(rotuloArt(a.id)) + '</b><span>' + esc((ini ? '…' : '') + a.texto.slice(ini, m.index + m[0].length + 90).replace(/\n/g, ' ') + '…') + '</span></button>');
    }
  }
  return res.length ? res.join('') : '<p class="vazio-msg">Nada encontrado para “' + esc(termo) + '”.</p>';
}
function renderArtigo(id) {
  const a = ARTI.get(id);
  const fila = UI.leiFila && UI.leiFila.includes(id) ? UI.leiFila : null;
  const seq = fila || ARTS.map((x) => x.id);
  const idx = seq.indexOf(id);
  const ant = idx > 0 ? seq[idx - 1] : null, prox = idx < seq.length - 1 ? seq[idx + 1] : null;
  const qs = POR_ART.get(id) || [];
  const cs = CARDS_POR_ART.get(id) || [];
  let html = '<div class="secao-cab"><button class="btn pequeno" data-acao="voltar-lei">Todos os artigos</button><div class="linha-btns">' +
    '<button class="btn pequeno" data-acao="nav-art" data-art="' + esc(ant || '') + '"' + (ant ? '' : ' disabled') + ' aria-label="Artigo anterior">←</button>' +
    '<button class="btn pequeno" data-acao="nav-art" data-art="' + esc(prox || '') + '"' + (prox ? '' : ' disabled') + ' aria-label="Próximo artigo">→</button></div></div>';
  if (fila) html += '<div class="fila-leitura"><span>Leitura do dia: ' + (idx + 1) + ' de ' + fila.length + '</span>' + (prox ? '' : '<button class="btn pequeno" data-acao="fim-fila">Concluir leitura</button>') + '</div>';
  const est = estrelas(id);
  html += '<div class="cartao"><span class="rotulo">' + esc(a.estrutura.join(' · ')) + '</span><h2>' + esc(rotuloArt(id)) + (est ? ' <span class="estrelas" title="Importância no banco">' + '★'.repeat(est) + '</span>' : '') + '</h2>' +
    legendaCamadas() + '<div class="texto-lei">' + textoLei(a) + '</div><div class="linha-btns">';
  if (qs.length) html += '<button class="btn primario" data-acao="treinar-art" data-art="' + esc(id) + '">Questões deste artigo (' + qs.length + ')</button>';
  if (cs.length) html += '<button class="btn" data-acao="cards-art" data-art="' + esc(id) + '">Cards deste artigo (' + cs.length + ')</button>';
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
  else if (sub === 'ajustes') el.innerHTML = voltarMais() + renderAjustes();
  else {
    const pend = Object.values(S.pesquisa).filter((p) => !p.s).length;
    const item = (s, ic, t, d) => '<button data-acao="mais" data-sub="' + s + '"><span class="ic">' + ic + '</span><span class="tx"><b>' + t + '</b><span class="s">' + d + '</span></span><span class="mudo">›</span></button>';
    el.innerHTML = '<div class="secao-cab"><h2>Mais</h2></div><div class="menu-mais">' +
      item('metodo', '1·2', 'Método', 'Como estudar com o app para passar') +
      item('progresso', '▥', 'Progresso', 'Domínio por bloco, constância, onde você cai, conquistas') +
      item('plano', '▦', 'Plano e cronograma', '11 semanas até 22/12, status dos blocos, textos que faltam') +
      item('pesquisar', '?', 'Para pesquisar', pend ? pl(pend, 'tema pendente', 'temas pendentes') + ' na sua lista' : 'Temas e termos para entender melhor') +
      item('glossario', 'Aa', 'Glossário', GLOSS.length + ' termos com definição e busca sugerida') +
      item('ajustes', '⚙', 'Ajustes, backup e diagnóstico', 'Metas, salvar progresso em arquivo, conferir a gravação') + '</div>';
  }
}
function renderProgresso() {
  const t = totais(), nv = nivelDe(S.perfil.xp), seq = sequencia();
  let html = '<div class="cartao"><div class="nivel"><div class="insignia">' + nv.n + '</div><div class="info"><div class="titulo">' + esc(nv.nome) + '</div>' + barra((S.perfil.xp - nv.base) / (nv.prox - nv.base), 'ouro') + '<div class="pequeno mudo mono">' + fmtNum(S.perfil.xp) + ' XP · próximo nível em ' + fmtNum(nv.prox) + '</div></div></div></div>';
  html += '<div class="estat"><div><b>' + fmtNum(t.r) + '</b><span>itens respondidos</span></div><div><b>' + pct(t.c, t.r) + '%</b><span>de acerto</span></div><div><b>' + fmtNum(t.c - t.e) + '</b><span>nota líquida acumulada</span></div>' +
    '<div><b>' + fmtNum(t.k) + '</b><span>cards revisados</span></div><div><b>' + seq + '</b><span>dias seguidos</span></div><div><b>' + (S.perfil.melhorSeq || 0) + '</b><span>melhor sequência</span></div></div>';
  html += '<div class="cartao"><div class="secao-cab"><h2>Constância</h2><span class="mudo pequeno">Últimas 16 semanas</span></div>' + mapaCalor() + '</div>';
  html += '<div class="cartao"><div class="secao-cab"><h2>Domínio por bloco</h2><span class="mudo pequeno">Questões</span></div><div class="dominio">';
  BLOCOS.filter((b) => (POR_BLOCO.get(b.id) || []).length).sort((a, b) => a.prioridade - b.prioridade).forEach((b) => {
    const dmn = dominioBloco(b.id) || 0;
    html += '<div class="dom-linha"><span class="nome">' + esc(b.nome) + '</span>' + barra(dmn) + '<span class="val">' + Math.round(dmn * 100) + '%</span></div>';
  });
  html += '</div><p class="pequeno mudo">Acerto de primeira vale 80%; o item chega a 100% quando você confirma o acerto na revisão seguinte. Erro zera.</p></div>';
  const porDisc = {};
  for (const q of Q) { const r = rec(q.id); if (!r || r[0] < 0) continue; const dd = (BI.get(q.b) || {}).disciplina; const x = (porDisc[dd] ||= { c: 0, e: 0 }); x.c += r[2]; x.e += r[3]; }
  const discs = Object.entries(porDisc).filter(([, v]) => v.c + v.e >= 3);
  if (discs.length) html += '<div class="cartao"><div class="secao-cab"><h2>Acerto por disciplina</h2></div><div class="dominio">' + discs.map(([dd, v]) => '<div class="dom-linha"><span class="nome">' + esc((DI.get(dd) || { nome: dd }).nome) + ' · ' + (v.c + v.e) + ' respostas</span>' + barra(v.c / (v.c + v.e)) + '<span class="val">' + pct(v.c, v.c + v.e) + '%</span></div>').join('') + '</div></div>';
  const arm = {};
  for (const q of Q) { const r = rec(q.id); if (!r || r[0] < 0) continue; const x = (arm[q.a] ||= { c: 0, e: 0 }); x.c += r[2]; x.e += r[3]; }
  const armLista = Object.entries(arm).filter(([, v]) => v.c + v.e >= 3).map(([k, v]) => ({ k, taxa: v.e / (v.c + v.e) })).sort((a, b) => b.taxa - a.taxa);
  html += '<div class="cartao"><div class="secao-cab"><h2>Onde você cai</h2><span class="mudo pequeno">Taxa de erro por tipo de armadilha</span></div>' +
    (armLista.length ? '<div class="dominio">' + armLista.map((x) => '<div class="dom-linha"><span class="nome">' + esc(D.armadilhas[x.k] || x.k) + '</span>' + barra(x.taxa, '', '--accent:var(--errado)') + '<span class="val">' + Math.round(x.taxa * 100) + '%</span></div>').join('') + '</div>' : '<p class="mudo">Responda algumas dezenas de itens para ver em que tipo de pegadinha você mais erra.</p>') + '</div>';
  let dc = 0, de = 0;
  for (const r of Object.values(S.itens)) { dc += r[5] || 0; de += r[6] || 0; }
  html += '<div class="cartao"><h2>Calibragem do chute</h2>' + (dc + de >= 5 ? '<p>Quando marca dúvida, você acerta <b>' + pct(dc, dc + de) + '%</b> (' + dc + ' de ' + (dc + de) + '). ' + (pct(dc, dc + de) > 50 ? 'Acima de 50%: na prova, chutar tende a somar pontos.' : 'Até 50%: na prova, deixar em branco tende a ser melhor.') + '</p>' : '<p class="mudo">Marque “Estou em dúvida” antes de responder. Com 5 marcações já dá para saber se o seu chute compensa.</p>') + '</div>';
  if (S.simulados.length) html += '<div class="cartao"><h2>Simulados</h2><div class="tabela-env"><table class="tabela"><thead><tr><th>Data</th><th>Itens</th><th>C</th><th>E</th><th>Nota</th></tr></thead><tbody>' + S.simulados.slice(0, 12).map((s) => '<tr><td>' + esc(fmtData(s.data, { day: '2-digit', month: '2-digit' })) + '</td><td class="num">' + s.n + '</td><td class="num">' + s.c + '</td><td class="num">' + s.e + '</td><td class="num">' + s.liq + ' (' + pct(s.liq, s.n) + '%)</td></tr>').join('') + '</tbody></table></div></div>';
  html += '<div class="secao"><div class="secao-cab"><h2>Conquistas</h2><span class="mudo pequeno">' + Object.keys(S.perfil.conq).length + ' de ' + CONQ.length + '</span></div><div class="conquistas">' +
    CONQ.map((c) => '<div class="conquista' + (S.perfil.conq[c.id] ? '' : ' bloqueada') + '"><div class="ic">' + esc(c.ic) + '</div><b>' + esc(c.nome) + '</b><span>' + esc(c.desc) + '</span></div>').join('') + '</div></div>';
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
  html += '</div><div class="cartao"><h2>Peso por disciplina</h2><div class="tabela-env"><table class="tabela"><tbody>' + DISC.map((d) => '<tr><td>' + esc(d.nome) + '</td><td style="text-align:right"><span class="selo' + (d.peso === 'MÁXIMO' ? ' p1' : d.peso === 'ALTO' ? ' p2' : '') + '">' + esc(d.peso) + '</span></td></tr>').join('') + '</tbody></table></div><p class="pequeno mudo">Ordem de estudo, não percentual de prova.</p></div>';
  html += '<div class="cartao"><div class="secao-cab"><h2>Status dos blocos</h2><span class="mudo pequeno">Toque no status para mudar</span></div><div class="tabela-env"><table class="tabela"><thead><tr><th>Bloco</th><th>Domínio</th><th>Status</th></tr></thead><tbody>';
  BLOCOS.slice().sort((a, b) => a.prioridade - b.prioridade).forEach((b) => {
    const st = S.perfil.status[b.id] || 'nao', dmn = dominioBloco(b.id);
    html += '<tr><td>' + esc(b.nome) + '<br><span class="pequeno mudo">' + esc(b.dispositivos) + '</span></td><td class="num">' + (dmn === null ? '—' : Math.round(dmn * 100) + '%') + '</td><td><button class="selo status-btn' + (st === 'concluido' ? ' ok' : st === 'andamento' ? ' p2' : '') + '" data-acao="status" data-bloco="' + b.id + '">' + STATUS_ROT[st] + '</button></td></tr>';
  });
  html += '</tbody></table></div></div>';
  html += '<div class="cartao"><h2>Textos que faltam</h2><p class="mudo">Cada texto colado na conversa com o Claude vira questões e cards conferidos contra a letra da norma.</p><ul>' + BLOCOS.filter((b) => b.aguardando).map((b) => '<li>' + esc(b.aguardando) + '</li>').join('') + '</ul></div>';
  return html;
}
function renderPesquisar() {
  const itens = Object.entries(S.pesquisa).map(([k, v]) => Object.assign({ k }, v));
  const pend = itens.filter((x) => !x.s), feitos = itens.filter((x) => x.s);
  const vis = (UI.filtroPesq === 'feitos' ? feitos : pend).sort((a, b) => (a.d < b.d ? 1 : -1));
  let html = '<div class="secao-cab"><h2>Para pesquisar</h2><span class="mudo pequeno">' + pend.length + ' pendentes · ' + feitos.length + ' entendidos</span></div>' +
    '<p class="mudo pequeno">Quando você erra, os termos da questão entram aqui sozinhos. Pesquise, leia uma boa fonte e marque como entendido (+5 XP).</p>' +
    '<div class="chips"><button class="chip" data-acao="filtro-pesq" data-f="pendentes" aria-pressed="' + (UI.filtroPesq !== 'feitos') + '">Pendentes</button><button class="chip" data-acao="filtro-pesq" data-f="feitos" aria-pressed="' + (UI.filtroPesq === 'feitos') + '">Entendidos</button></div>';
  html += '<div class="lista-pesq">' + (vis.length ? vis.map((x) => {
    const g = GLOSS.find((t) => t.t === x.t);
    return '<div class="pesq-linha' + (x.s ? ' feito' : '') + '"><input type="checkbox" data-acao="pesq-feito" data-k="' + esc(x.k) + '"' + (x.s ? ' checked' : '') + ' aria-label="Marcar como entendido"><div class="tx"><b>' + esc(x.t) + '</b><small>' + esc(x.o || '') + ' · ' + esc(fmtData(x.d, { day: '2-digit', month: '2-digit' })) + '</small>' +
      (g ? '<button class="linkish pequeno" data-acao="termo" data-t="' + g.i + '">Ver definição</button>' : '') + '</div><a href="' + esc(busca(g ? g.s : x.t)) + '" target="_blank" rel="noopener">Pesquisar ↗</a></div>';
  }).join('') : '<p class="vazio-msg">' + (UI.filtroPesq === 'feitos' ? 'Nada marcado como entendido ainda.' : 'Lista vazia. Os temas sugeridos abaixo e os termos das questões erradas aparecem aqui.') + '</p>') + '</div>';
  const ctx = contextoHoje();
  const doDia = new Set(blocosDoDia(ctx.tipo === 'dia' ? ctx.dia : ctx.tipo === 'folga' ? ctx.prox : null));
  html += '<div class="secao"><div class="secao-cab"><h2>Sugestões por bloco</h2></div><p class="mudo pequeno">Temas que costumam confundir em cada bloco. Os blocos do dia vêm abertos.</p>';
  BLOCOS.filter((b) => (b.pesquisar || []).length).sort((a, b) => (doDia.has(b.id) ? 0 : 1) - (doDia.has(a.id) ? 0 : 1) || a.prioridade - b.prioridade).forEach((b) => {
    const faltam = b.pesquisar.filter((t) => !S.pesquisa[chavePesq(t)]).length;
    html += '<details class="grupo-pesq"' + (doDia.has(b.id) ? ' open' : '') + '><summary><span>' + esc(b.nome) + '</span><span class="mono pequeno mudo">' + faltam + ' de ' + b.pesquisar.length + '</span></summary><div class="grupo-blocos">' + b.pesquisar.map((t) => {
      const na = !!S.pesquisa[chavePesq(t)];
      return '<div class="pesq-linha"><div class="tx"><b>' + esc(t) + '</b></div>' + (na ? '<span class="selo ok">Na lista</span>' : '<button class="btn pequeno" data-acao="add-pesq" data-t="' + esc(t) + '" data-o="' + esc(b.nome) + '">+ Lista</button>') + '<a href="' + esc(busca(t)) + '" target="_blank" rel="noopener">↗</a></div>';
    }).join('') + '</div></details>';
  });
  return html + '</div>';
}
function renderGlossario() {
  const q = semAcento(UI.buscaGloss.trim());
  const lista = GLOSS.filter((g) => !q || semAcento(g.t + ' ' + g.d).includes(q)).sort((a, b) => a.t.localeCompare(b.t, 'pt'));
  return '<div class="secao-cab"><h2>Glossário</h2><span class="mudo pequeno">' + GLOSS.length + ' termos</span></div>' +
    '<input class="busca" id="busca-gloss" type="search" placeholder="Buscar termo" value="' + esc(UI.buscaGloss) + '" aria-label="Buscar no glossário">' +
    '<p class="mudo pequeno">Os termos sublinhados com pontos nas questões e nos cards abrem estas definições.</p>' +
    lista.map((g) => '<div class="gloss-item"><b>' + esc(g.t) + '</b><p>' + esc(g.d) + '</p><div class="linha-btns"><a class="link-ext" href="' + esc(busca(g.s)) + '" target="_blank" rel="noopener">Pesquisar ↗</a>' +
      (S.pesquisa[chavePesq(g.t)] ? '<span class="selo ok">Na lista</span>' : '<button class="linkish pequeno" data-acao="add-pesq" data-t="' + esc(g.t) + '" data-o="glossário">Guardar na lista</button>') + '</div></div>').join('');
}
function renderMetodo() {
  return '<div class="prosa"><h2>O método do Painel</h2>' +
    '<p>Sem prova anterior da ANPD, o estudo não começa pela leitura corrida da lei: começa pela questão. A questão mostra o que a banca troca; a lei, lida logo depois do erro, fixa a palavra exata; a lacuna e a revisão espaçada garantem que você ainda saiba aquilo no dia da prova.</p>' +
    '<h3>O ciclo de cada dia (aba Hoje)</h3><ol>' +
    '<li><b>Revisar o que venceu.</b> Primeiro a lista curta de questões e os cards vencidos. É o que mais rende por minuto: você reforça o que estava a ponto de esquecer.</li>' +
    '<li><b>Questões do dia.</b> O bloco do cronograma, no formato certo/errado. Marque “Estou em dúvida” sempre que não tiver certeza: isso mede o seu chute.</li>' +
    '<li><b>Lei seca grifada.</b> Leia os artigos do dia na literalidade. Os grifos mostram onde a banca mexe: prazos e números, palavras de alerta (somente, salvo, vedado), deve × pode e os seus erros.</li>' +
    '<li><b>Cards cloze.</b> As lacunas tiram a palavra exata do texto da lei. Faça os novos do dia e responda de cabeça antes de revelar.</li>' +
    '<li><b>Para pesquisar.</b> Os termos das questões erradas entram sozinhos na sua lista. Pesquise um tema por dia e marque como entendido.</li></ol>' +
    '<h3>Regras que não se negociam</h3><ul>' +
    '<li>O acerto de primeira só volta depois de semanas. O erro entra na lista curta e volta com intervalos crescentes (no mesmo dia, depois de 1 dia, depois de 3 dias): sai da lista depois de três acertos seguidos, e errou de novo, recomeça.</li>' +
    '<li>Errou, leia o artigo inteiro. O botão “Ler o artigo inteiro, grifado” aparece depois de cada questão e de cada card.</li>' +
    '<li>Domingo é livre por padrão e não quebra a sequência.</li>' +
    '<li>Não pule a revisão para fazer questões novas: a lista curta cresce e o esquecimento come o que você estudou.</li></ul>' +
    '<h3>Estratégia Cebraspe</h3><ul>' +
    '<li>Uma errada anula uma certa; em branco vale zero. Chutar só compensa quando sua chance de acerto passa de 50%.</li>' +
    '<li>A aba Progresso mostra a sua taxa de acerto quando marca dúvida. Acima de 50%, chute; abaixo, deixe em branco.</li>' +
    '<li>Desconfie de palavras absolutas (sempre, nunca, somente, exclusivamente) e de itens que acrescentam algo à lei.</li>' +
    '<li>A partir da Fase 2, faça ao menos um simulado de prova completa por semana.</li></ul>' +
    '<h3>Semana típica</h3><p>Segunda e terça: bloco de prioridade da vez. Quarta: uma resolução da ANPD. Quinta: tronco regulatório (Lei 13.848/2019 e Lei 9.784/1999). Sexta: revisão da lista curta. Sábado: bloco longo ou simulado. Domingo: livre.</p>' +
    '<h3>Quando o edital sair</h3><p>O cronograma genérico para. O conteúdo programático oficial passa a mandar, os simulados ficam maiores e a revisão espaçada continua todos os dias. Cole o edital na conversa com o Claude para reorganizar os blocos.</p>' +
    '<h3>Questões marcadas para conferir</h3><p>Questões sobre normas ainda não coladas no app (Lei 9.784/1999, Lei 13.848/2019, LINDB, ECA Digital, Constituição, GDPR e resoluções da ANPD) mostram o aviso “confira na fonte”. Elas foram escritas com cuidado, mas só viram definitivas quando o texto oficial for anexado e cada trecho for conferido.</p></div>';
}
function renderAjustes() {
  const metas = [10, 20, 30, 40, 60], novos = [5, 10, 20, 30, 50];
  const dg = Store.diag;
  const linha = (rot, val, ok) => '<tr><td>' + rot + '</td><td class="' + (ok === true ? 'ok' : ok === false ? 'no' : '') + '">' + esc(val) + '</td></tr>';
  const st = (v) => (v === 'ok' ? true : v === '—' ? null : false);
  return '<div class="secao-cab"><h2>Ajustes</h2></div>' +
    '<div class="cartao"><div class="campo"><span class="rot">Meta diária de questões</span><div class="chips">' + metas.map((m) => '<button class="chip" data-acao="meta" data-meta="' + m + '" aria-pressed="' + (S.perfil.meta === m) + '">' + m + '</button>').join('') + '</div></div>' +
    '<div class="campo"><span class="rot">Cards novos por dia</span><div class="chips">' + novos.map((m) => '<button class="chip" data-acao="novos-cards" data-n="' + m + '" aria-pressed="' + ((S.perfil.novosCards || 20) === m) + '">' + m + '</button>').join('') + '</div><p class="pequeno mudo">Cada card novo volta várias vezes nos dias seguintes. 20 por dia é o equilíbrio para quem tem 1h45 de estudo.</p></div></div>' +
    '<div class="cartao"><h2>Backup do progresso</h2><p class="pequeno">Salve um arquivo com todo o seu progresso. Se a gravação na conta falhar, ou se você trocar de aparelho, é só restaurar.</p>' +
    '<div class="linha-btns"><button class="btn primario" data-acao="backup-baixar">Baixar backup (.json)</button><button class="btn" data-acao="backup-mostrar">Copiar como texto</button></div>' +
    '<div class="campo"><label for="arquivo-backup">Restaurar de um arquivo</label><input id="arquivo-backup" type="file" accept=".json,application/json" data-acao="backup-arquivo"></div>' +
    '<div id="zona-backup"></div></div>' +
    '<div class="cartao"><h2>Diagnóstico da gravação</h2><p class="pequeno mudo">Use quando o progresso não aparecer em outro aparelho ou surgir mensagem de erro.</p><div class="tabela-env"><table class="tabela diag"><tbody>' +
    linha('Onde o progresso está', Store.modo === 'nuvem' ? 'Na sua conta e neste navegador' : 'Só neste navegador', Store.modo === 'nuvem') +
    linha('Página aberta dentro do claude.ai', dg.claude ? 'sim' : 'não', dg.claude) +
    linha('Banco de dados do app', dg.db, st(dg.db)) +
    linha('Identificação do usuário', dg.user === 'ok' ? dg.id : dg.user, dg.user === 'ok' && dg.id === 'ok' ? true : dg.user === '—' ? null : false) +
    linha('Leitura do progresso salvo', dg.leitura, st(dg.leitura)) +
    linha('Última gravação', dg.gravacao, st(dg.gravacao)) +
    linha('Cópia neste navegador', dg.navegador, st(dg.navegador)) +
    '</tbody></table></div><p class="pequeno">Se o banco aparecer como indisponível: abra o app pelo link do claude.ai com a sua conta conectada (não por arquivo baixado), no navegador ou no app do Claude, e confira as permissões do artifact. Enquanto isso, o progresso fica neste navegador e o backup em arquivo garante que nada se perca.</p>' +
    '<div class="linha-btns"><button class="btn" data-acao="permissoes">Abrir permissões do app</button><button class="btn" data-acao="tentar-gravar">Tentar gravar de novo</button></div></div>' +
    '<div class="cartao"><h2>Banco de conteúdo</h2><p class="pequeno mudo">' + Q.length + ' questões · ' + CARDS.length + ' cards cloze · ' + GLOSS.length + ' termos · versão ' + esc(D.versao) + '</p></div>' +
    '<div class="cartao"><h2>Recomeçar do zero</h2><p class="pequeno mudo">Apaga XP, respostas, cards, sequência, simulados e lista de pesquisa.</p><div id="zona-zerar"><button class="btn" data-acao="zerar">Zerar progresso</button></div></div>';
}

/* ================= Backup ================= */
let backupPendente = null;
function backupTexto() {
  return JSON.stringify({ app: 'painel-anpd', versao: 3, exportado: new Date().toISOString(), perfil: S.perfil, itens: S.itens, cards: S.cards, simulados: S.simulados, pesquisa: S.pesquisa });
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
  try { d = JSON.parse(texto); } catch (e) { avisar('!', 'Arquivo inválido', 'Não é um backup do Painel ANPD.'); return; }
  if (!d || d.app !== 'painel-anpd' || !d.perfil) { avisar('!', 'Arquivo inválido', 'Não é um backup do Painel ANPD.'); return; }
  backupPendente = d;
  const z = document.getElementById('zona-backup');
  const resumo = 'Backup de ' + esc(fmtData(String(d.exportado).slice(0, 10), { day: '2-digit', month: '2-digit', year: 'numeric' })) + ': ' + fmtNum(d.perfil.xp || 0) + ' XP, ' + Object.keys(d.itens || {}).length + ' questões e ' + Object.keys(d.cards || {}).length + ' cards com histórico.';
  if (z) z.innerHTML = '<div class="cartao destaque"><p>' + resumo + '</p><p class="pequeno mudo">Restaurar substitui o progresso atual.</p><div class="linha-btns"><button class="btn primario" data-acao="backup-confirmar">Restaurar</button><button class="btn" data-acao="mais" data-sub="ajustes">Cancelar</button></div></div>';
}

/* ================= Navegação ================= */
const VISTAS = ['hoje', 'questoes', 'cards', 'lei', 'mais'];
function ir(v) {
  if (v === 'treinar') v = 'questoes';
  if (v === 'progresso' || v === 'plano') { UI.mais = v; v = 'mais'; }
  if (!VISTAS.includes(v)) v = 'hoje';
  UI.vista = v;
  salvarUI();
  renderTudo();
  window.scrollTo(0, 0);
}
function renderTudo() {
  renderTopo();
  VISTAS.forEach((v) => { document.getElementById('vista-' + v).hidden = v !== UI.vista; });
  document.querySelectorAll('.aba').forEach((b) => { if (b.dataset.vista === UI.vista) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  ({ hoje: renderHoje, questoes: renderQuestoes, cards: renderCards, lei: renderLei, mais: renderMais })[UI.vista]();
  if (sessao) renderSessao();
}
function abrirArtigo(art, fila) {
  UI.artSel = art;
  if (fila !== undefined) UI.leiFila = fila;
  marcarLido(art);
  if (UI.vista !== 'lei') ir('lei'); else { renderLei(); window.scrollTo(0, 0); }
}

/* ================= Eventos ================= */
document.addEventListener('click', async (ev) => {
  const alvo = ev.target.closest('[data-acao]');
  if (!alvo) { if (ev.target.id === 'folha') fecharFolha(); return; }
  const a = alvo.dataset.acao;
  if (alvo.tagName === 'INPUT') return;
  switch (a) {
    case 'ir': ir(alvo.dataset.vista); break;
    case 'mais': fecharFolha(); UI.mais = alvo.dataset.sub || 'menu'; if (UI.vista !== 'mais') ir('mais'); else { renderMais(); window.scrollTo(0, 0); } break;
    case 'iniciar-dia': iniciarDia(alvo.dataset.dia); break;
    case 'iniciar-revisao': iniciarSessao({ modo: 'revisao', n: 30 }); break;
    case 'treino-rapido': iniciarSessao({ modo: 'treino', n: 20, blocos: [], filtro: 'mistas' }); break;
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
    case 'confirmar-saida': fecharSessao(); break;
    case 'fechar-sessao': fecharSessao(); break;
    case 'refazer-erros': {
      const ids = sessao.ids.filter((id) => (sessao.resp[id] || 'B') !== QI.get(id).g);
      fecharSessao();
      iniciarSessao({ modo: 'treino', ids: embaralhar(ids), titulo: 'Refazer erros' });
      break;
    }
    case 'revisar-item': folhaItem(alvo.dataset.q, alvo.dataset.r); break;
    case 'ver-art': folhaArtigo(alvo.dataset.art, alvo.dataset.q); break;
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
    case 'voltar-lei': UI.artSel = null; UI.leiFila = null; renderLei(); break;
    case 'ler-dia': { const ctx = contextoHoje(); const arts = artigosDoDia(ctx.tipo === 'dia' ? ctx.dia : null); if (arts.length) abrirArtigo(arts[0], arts); break; }
    case 'ler-tudo': abrirArtigo(ARTS[0].id, null); break;
    case 'fim-fila': UI.leiFila = null; UI.artSel = null; avisar('§', 'Leitura do dia concluída', 'Agora os cards cloze desses artigos.'); ir('hoje'); break;
    case 'ranking': UI.ranking = !UI.ranking; renderLei(); break;
    case 'camada':
      UI.camadas[alvo.dataset.c] = !UI.camadas[alvo.dataset.c];
      salvarUI();
      if (alvo.closest('#folha') && UI.folhaArt) folhaArtigo(UI.folhaArt, UI.folhaQ); else renderLei();
      break;
    case 'treinar-art': { const ids = (POR_ART.get(alvo.dataset.art) || []).map((q) => q.id); iniciarSessao({ modo: 'treino', ids: embaralhar(ids), titulo: rotuloArt(alvo.dataset.art) + ' da LGPD' }); break; }
    case 'cards-art': iniciarCards((CARDS_POR_ART.get(alvo.dataset.art) || []).map((c) => c.id), 'Cards do ' + rotuloArt(alvo.dataset.art).toLowerCase()); break;
    case 'cards-iniciar': iniciarSessao({ modo: 'cards', blocos: UI.blocosCards, novos: novosRestantesHoje() }); break;
    case 'cards-so-revisao': iniciarSessao({ modo: 'cards', blocos: UI.blocosCards, soRevisao: true }); break;
    case 'cards-revisao': iniciarSessao({ modo: 'cards', soRevisao: true, titulo: 'Cards vencidos' }); break;
    case 'cards-dia': {
      const ctx = contextoHoje();
      const bs = blocosDoDia(ctx.tipo === 'dia' ? ctx.dia : null).filter((b) => (CARDS_POR_BLOCO.get(b) || []).length);
      iniciarSessao({ modo: 'cards', blocos: bs, novos: novosRestantesHoje(), titulo: 'Cards do dia' });
      break;
    }
    case 'exportar-anki': {
      const txt = exportarAnkiTexto();
      const r = await salvarArquivo('anki-lgpd-cloze.txt', txt);
      if (r === null) mostrarTexto(null, txt, 'O download não está disponível aqui. Copie o texto, salve como anki-lgpd-cloze.txt e importe no Anki.');
      break;
    }
    case 'fase': UI.faseAberta = UI.faseAberta === alvo.dataset.fase ? '' : alvo.dataset.fase; renderMais(); break;
    case 'status': { const b = alvo.dataset.bloco; S.perfil.status[b] = STATUS_CICLO[S.perfil.status[b] || 'nao']; Store.salvar('perfil'); renderMais(); break; }
    case 'meta': S.perfil.meta = Number(alvo.dataset.meta); Store.salvar('perfil'); renderTudo(); break;
    case 'novos-cards': S.perfil.novosCards = Number(alvo.dataset.n); Store.salvar('perfil'); renderTudo(); break;
    case 'backup-baixar': {
      const r = await salvarArquivo('painel-anpd-backup-' + hojeISO() + '.json', backupTexto());
      if (r === null) mostrarTexto('zona-backup', backupTexto(), 'O download não está disponível aqui. Copie o texto e guarde num arquivo .json.');
      break;
    }
    case 'backup-mostrar': mostrarTexto('zona-backup', backupTexto(), 'Copie e guarde este texto. Para restaurar, salve-o como .json e use “Restaurar de um arquivo”.'); break;
    case 'backup-confirmar': {
      const d = backupPendente;
      if (!d) break;
      S.perfil = Object.assign(perfilPadrao(), d.perfil); S.itens = d.itens || {}; S.cards = d.cards || {}; S.simulados = d.simulados || []; S.pesquisa = d.pesquisa || {};
      backupPendente = null;
      Store.salvarTudo(); renderTudo(); avisar('↺', 'Progresso restaurado', fmtNum(S.perfil.xp) + ' XP');
      break;
    }
    case 'copiar': {
      const ta = document.getElementById('texto-export');
      if (!ta) break;
      try { await navigator.clipboard.writeText(ta.value); avisar('✓', 'Copiado', ''); } catch (e) { ta.focus(); ta.select(); }
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
      setTimeout(() => { if (UI.vista === 'mais') renderMais(); }, 2500);
      break;
    case 'zerar': document.getElementById('zona-zerar').innerHTML = '<p><b>Tem certeza?</b> Não dá para desfazer. Baixe um backup antes.</p><div class="linha-btns"><button class="btn primario" data-acao="confirmar-zerar">Apagar tudo</button><button class="btn" data-acao="mais" data-sub="ajustes">Cancelar</button></div>'; break;
    case 'confirmar-zerar':
      S.perfil = Object.assign(perfilPadrao(), { status: S.perfil.status, meta: S.perfil.meta, novosCards: S.perfil.novosCards });
      S.itens = {}; S.cards = {}; S.simulados = []; S.pesquisa = {};
      Store.salvarTudo(); renderTudo(); avisar('0', 'Progresso zerado', 'Os status dos blocos foram mantidos.');
      break;
    default: break;
  }
});
document.addEventListener('change', (ev) => {
  const alvo = ev.target.closest('[data-acao]');
  if (!alvo) return;
  const a = alvo.dataset.acao;
  if (a === 'toggle-bloco' || a === 'toggle-bloco-card') {
    const chave = a === 'toggle-bloco' ? 'blocos' : 'blocosCards';
    const set = new Set(UI[chave]);
    if (alvo.checked) set.add(alvo.dataset.bloco); else set.delete(alvo.dataset.bloco);
    UI[chave] = BLOCOS.map((x) => x.id).filter((id) => set.has(id));
    salvarUI();
    if (a === 'toggle-bloco') renderQuestoes(); else renderCards();
  } else if (a === 'duvida' && sessao) sessao.duv[sessao.ids[sessao.i]] = alvo.checked;
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
document.addEventListener('input', (ev) => {
  const id = ev.target.id;
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
  if (k === 'c') responder('C');
  else if (k === 'e') responder('E');
  else if (k === 'b' && sessao.modo === 'simulado') responder('B');
  else if (k === 'd' && sessao.modo !== 'relampago') { const id = sessao.ids[sessao.i]; sessao.duv[id] = !sessao.duv[id]; renderSessao(); }
  else if (sessao.modo === 'simulado' && k === 'arrowright') proximo();
  else if (sessao.modo === 'simulado' && k === 'arrowleft' && sessao.i > 0) { sessao.i--; renderSessao(); }
});
document.addEventListener('pointerover', (ev) => {
  const c = ev.target.closest && ev.target.closest('[data-dica]');
  let dica = document.getElementById('dica');
  if (!c) { if (dica) dica.remove(); return; }
  if (!dica) { dica = document.createElement('div'); dica.id = 'dica'; dica.className = 'dica'; document.body.appendChild(dica); }
  dica.textContent = c.dataset.dica;
  const r = c.getBoundingClientRect();
  dica.style.left = Math.max(8, Math.min(window.innerWidth - 200, r.left - 30)) + 'px';
  dica.style.top = (r.top - 32) + 'px';
});
document.addEventListener('visibilitychange', () => { if (document.hidden) Store.descarregar(); });

/* ================= Início ================= */
function iniciar(dadosQuentes) {
  if (dadosQuentes && dadosQuentes.sessao) { sessao = dadosQuentes.sessao; if (dadosQuentes.ui) Object.assign(UI, dadosQuentes.ui); }
  if (UI.vista === 'treinar') UI.vista = 'questoes';
  if (!VISTAS.includes(UI.vista)) UI.vista = 'hoje';
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
