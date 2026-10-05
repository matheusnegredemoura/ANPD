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

const INTERVALOS = [0, 1, 3, 7, 16, 35];
const MIN_DIA_ATIVO = 10;
const DOCS = ['perfil', 'itens', 'simulados'];
const CHAVE_LOCAL = 'painel-anpd-v2';
const CHAVE_UI = 'painel-anpd-ui';

const NIVEIS = [
  [0, 'Titular de dados'],
  [120, 'Curioso do art. 18'],
  [300, 'Operador(a)'],
  [600, 'Controlador(a)'],
  [1000, 'Encarregado(a)'],
  [1600, 'Analista de conformidade'],
  [2400, 'Fiscal de campo'],
  [3400, 'Auditor(a) de algoritmos'],
  [4700, 'Instrutor(a) de processo sancionador'],
  [6300, 'Especialista em Regulação'],
  [8300, 'Coordenador(a)-Geral'],
  [10800, 'Diretor(a) do Conselho Diretor'],
  [14000, 'Diretor(a)-Presidente'],
];

const CONQ = [
  { id: 'primeira', ic: '1', nome: 'Primeira marcação', desc: 'Respondeu o primeiro item.' },
  { id: 'meta', ic: 'M', nome: 'Meta batida', desc: 'Cumpriu a meta diária de itens.' },
  { id: 'combo10', ic: '10', nome: 'Dez seguidas', desc: 'Acertou 10 itens em sequência.' },
  { id: 'combo25', ic: '25', nome: 'Gabarito limpo', desc: 'Acertou 25 itens em sequência.' },
  { id: 'r100', ic: '100', nome: 'Cem itens', desc: 'Respondeu 100 itens.' },
  { id: 'r500', ic: '500', nome: 'Quinhentos', desc: 'Respondeu 500 itens.' },
  { id: 'r1000', ic: '1k', nome: 'Mil itens', desc: 'Respondeu 1.000 itens.' },
  { id: 'seq7', ic: '7d', nome: 'Semana firme', desc: '7 dias seguidos de estudo (domingo não quebra).' },
  { id: 'seq30', ic: '30d', nome: 'Mês sem falhar', desc: '30 dias seguidos de estudo.' },
  { id: 'sim1', ic: 'S', nome: 'Primeiro simulado', desc: 'Entregou um simulado.' },
  { id: 'sim70', ic: '70', nome: 'Nota de corte', desc: 'Nota líquida de 70% ou mais em simulado de 30+ itens.' },
  { id: 'relampago15', ic: 'R', nome: 'Relâmpago', desc: 'Nota líquida de 15 ou mais no modo relâmpago.' },
  { id: 'lei20', ic: '§', nome: 'Lei seca', desc: 'Abriu 20 artigos da LGPD no leitor.' },
  { id: 'lista25', ic: 'LC', nome: 'Lista curta', desc: 'Tirou 25 itens da lista de erros.' },
  { id: 'bloco80', ic: '80', nome: 'Bloco dominado', desc: 'Chegou a 80% de domínio em um bloco.' },
  { id: 'p1', ic: 'P1', nome: 'Prioridade 1 em dia', desc: '60% de domínio nos quatro blocos de prioridade 1 da LGPD.' },
  { id: 'calibrado', ic: '?', nome: 'Bem calibrado', desc: 'Marcou dúvida em 20 itens. Agora você sabe quando chutar.' },
  { id: 'coruja', ic: '23h', nome: 'Coruja', desc: 'Respondeu itens depois das 23h.' },
];

/* ================= Utilitários ================= */
function agrupar(lista, chave) {
  const m = new Map();
  for (const x of lista) {
    const k = chave(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function hojeISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function diaNum(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}
function isoDeNum(n) {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}
const HOJE = () => diaNum(hojeISO());
function diaSemana(iso) {
  return new Date(iso + 'T12:00:00').getDay();
}
function fmtData(iso, op) {
  const s = new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', op);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function embaralhar(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function semAcento(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
function pl(n, s, p) {
  return n + ' ' + (n === 1 ? s : p);
}
function pct(a, b) {
  return b ? Math.round((a / b) * 100) : 0;
}
function fmtNum(n) {
  return Number(n).toLocaleString('pt-BR');
}
function fmtTempo(seg) {
  seg = Math.max(0, Math.round(seg));
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
function lerLS(k) {
  try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
}
function gravarLS(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* armazenamento indisponível */ }
}
function rotuloArt(id) {
  return /^\d$/.test(id) ? 'Art. ' + id + 'º' : 'Art. ' + id;
}

/* ================= Estado ================= */
function perfilPadrao() {
  return { xp: 0, meta: 30, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: hojeISO() };
}
const S = { perfil: perfilPadrao(), itens: {}, simulados: [] };
const UI = Object.assign({ vista: 'hoje', modo: 'treino', n: 20, filtro: 'mistas', blocos: ['lgpd-17-22', 'lgpd-52-54', 'lgpd-55', 'lgpd-33-36'], faseAberta: null, artSel: null, busca: '', destaque: 'erros' }, lerLS(CHAVE_UI) || {});
UI.artSel = null;
UI.busca = '';
let sessao = null;

function salvarUI() {
  gravarLS(CHAVE_UI, { vista: UI.vista, modo: UI.modo, n: UI.n, filtro: UI.filtro, blocos: UI.blocos, destaque: UI.destaque });
}

/* ================= Persistência (banco do Artifact ou navegador) ================= */
const Store = {
  modo: 'local',
  dev: Math.random().toString(36).slice(2, 10),
  refs: {},
  timer: {},
  gravando: {},
  fila: {},
  ultimoT: {},
  erro: null,
  carregarLocal() {
    const l = lerLS(CHAVE_LOCAL);
    if (!l) return false;
    if (l.perfil) S.perfil = Object.assign(perfilPadrao(), l.perfil);
    if (l.itens) S.itens = l.itens;
    if (l.simulados) S.simulados = l.simulados;
    return true;
  },
  guardarLocal() {
    gravarLS(CHAVE_LOCAL, { perfil: S.perfil, itens: S.itens, simulados: S.simulados });
  },
  dados(nome) {
    if (nome === 'perfil') return S.perfil;
    if (nome === 'itens') return { q: S.itens };
    return { lista: S.simulados };
  },
  aplicar(nome, corpo) {
    if (!corpo || !corpo.dados) return;
    if (corpo.t && this.ultimoT[nome] && corpo.t <= this.ultimoT[nome]) return;
    this.ultimoT[nome] = corpo.t || Date.now();
    if (nome === 'perfil') S.perfil = Object.assign(perfilPadrao(), corpo.dados);
    else if (nome === 'itens') S.itens = corpo.dados.q || {};
    else S.simulados = corpo.dados.lista || [];
    this.guardarLocal();
  },
  async iniciar() {
    const temLocal = this.carregarLocal();
    const c = window.claude;
    if (!c || typeof c.use !== 'function') return this.pronto();
    let db = null;
    let user = null;
    try {
      [db, user] = await Promise.all([c.use('db'), c.use('user')]);
    } catch (e) { db = null; }
    if (!db || !user) return this.pronto();
    let uid = null;
    try { uid = await user.id(); } catch (e) { uid = null; }
    if (!uid) return this.pronto();
    try {
      const col = db.collection('data/users/' + uid);
      DOCS.forEach((n) => { this.refs[n] = col.doc(n); });
      const snaps = await Promise.all(DOCS.map((n) => this.refs[n].get()));
      this.modo = 'nuvem';
      if (snaps.every((s) => !s.exists)) {
        if (!temLocal) await migrarPainelAntigo(db, user);
        DOCS.forEach((n) => this.gravar(n));
      } else {
        snaps.forEach((s, i) => { if (s.exists) this.aplicar(DOCS[i], s.data()); });
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
      this.modo = 'local';
    }
    this.pronto();
  },
  pronto() {
    renderTudo();
  },
  salvar(...nomes) {
    this.guardarLocal();
    if (this.modo !== 'nuvem') return;
    for (const n of nomes) {
      clearTimeout(this.timer[n]);
      this.timer[n] = setTimeout(() => this.gravar(n), 1200);
    }
  },
  descarregar() {
    if (this.modo !== 'nuvem') return;
    for (const n of DOCS) {
      if (this.timer[n]) {
        clearTimeout(this.timer[n]);
        this.timer[n] = null;
        this.gravar(n);
      }
    }
  },
  async gravar(n) {
    this.timer[n] = null;
    if (this.gravando[n]) { this.fila[n] = true; return; }
    this.gravando[n] = true;
    const t = Date.now();
    try {
      await this.refs[n].set({ dev: this.dev, t, v: 2, dados: this.dados(n) });
      this.ultimoT[n] = t;
      this.erro = null;
    } catch (e) {
      this.erro = (e && e.code) || 'erro';
      if (e && (e.code === 'invalid_argument' || e.code === 'revoked' || e.code === 'not_granted')) this.modo = 'local';
      if (e && e.code === 'unavailable') setTimeout(() => this.salvar(n), 2000 + Math.random() * 2000);
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
      const idx = Number(d.id);
      const st = d.data() && d.data().status;
      const b = BLOCOS.find((x) => x.legado === idx);
      if (b && st && st !== 'nao') S.perfil.status[b.id] = st;
    });
    S.perfil.migrado = hojeISO();
  } catch (e) { /* sem dados antigos */ }
}

/* ================= Regras de estudo ================= */
function rec(id) { return S.itens[id]; }
function respondida(id) { const r = rec(id); return !!r && r[0] >= 0; }
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
    const extra = xp - NIVEIS[i][0];
    const mandato = 1 + Math.floor(extra / 4000);
    const base = NIVEIS[i][0] + (mandato - 1) * 4000;
    return { n: i + mandato, nome: NIVEIS[i][1] + (mandato > 1 ? ' · mandato ' + mandato : ''), base, prox: base + 4000 };
  }
  return { n: i + 1, nome: NIVEIS[i][1], base: NIVEIS[i][0], prox: NIVEIS[i + 1][0] };
}

function diaLog(iso) {
  iso = iso || hojeISO();
  if (!S.perfil.dias[iso]) S.perfil.dias[iso] = { r: 0, c: 0, e: 0, b: 0, xp: 0 };
  return S.perfil.dias[iso];
}
function ativo(iso) { const d = S.perfil.dias[iso]; return !!d && d.r >= MIN_DIA_ATIVO; }
function sequencia() {
  let n = 0;
  let dia = HOJE();
  if (!ativo(isoDeNum(dia))) dia--;
  for (let k = 0; k < 800; k++) {
    const iso = isoDeNum(dia);
    if (ativo(iso)) n++;
    else if (diaSemana(iso) !== 0) break;
    dia--;
  }
  return n;
}
function totais() {
  let r = 0, c = 0, e = 0, b = 0, ativos = 0;
  for (const [iso, d] of Object.entries(S.perfil.dias)) {
    r += d.r; c += d.c; e += d.e; b += d.b || 0;
    if (d.r >= MIN_DIA_ATIVO && iso) ativos++;
  }
  return { r, c, e, b, ativos };
}

function xpAcerto(q, combo, modo) {
  let x = 8 + 2 * (q.d || 2);
  if (modo === 'revisao') x += 4;
  if (modo === 'relampago') x = 6;
  return Math.round(x * (1 + Math.min(combo, 10) * 0.05));
}

// Atualiza a revisão espaçada do item. resp: 'C' | 'E' | 'B'.
function registrar(q, resp, duvida) {
  const hoje = HOJE();
  const r = S.itens[q.id] ? S.itens[q.id].slice() : [-1, 0, 0, 0, 0, 0, 0];
  const antes = r[0];
  const estavaNaLista = antes >= 0 && antes < 3;
  let ok = null;
  if (resp === 'B') {
    r[0] = 0;
  } else {
    ok = resp === q.g;
    if (ok) {
      r[2]++;
      if (antes < 0) r[0] = duvida ? 2 : 4;
      else r[0] = duvida ? Math.max(1, Math.min(antes, 2)) : Math.min(5, antes + 1);
      if (duvida) r[5]++;
    } else {
      r[3]++;
      r[0] = 0;
      if (duvida) r[6]++;
    }
  }
  r[1] = hoje + INTERVALOS[r[0]];
  r[4] = hoje;
  S.itens[q.id] = r;
  if (estavaNaLista && r[0] >= 3) S.perfil.saidos = (S.perfil.saidos || 0) + 1;
  const d = diaLog();
  if (resp === 'B') d.b = (d.b || 0) + 1;
  else { d.r++; if (ok) d.c++; else d.e++; }
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
  if (!d.metaOk && d.r >= S.perfil.meta) {
    d.metaOk = 1;
    ganharXP(50);
    avisar('M', 'Meta do dia cumprida', '+50 XP de bônus');
    conquistar('meta');
  }
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
  if ((S.perfil.recordes.combo || 0) >= 10) conquistar('combo10');
  if ((S.perfil.recordes.combo || 0) >= 25) conquistar('combo25');
  const seq = sequencia();
  if (seq > (S.perfil.melhorSeq || 0)) S.perfil.melhorSeq = seq;
  if (seq >= 7) conquistar('seq7');
  if (seq >= 30) conquistar('seq30');
  if (S.simulados.length) conquistar('sim1');
  if (S.simulados.some((s) => s.n >= 30 && s.liq / s.n >= 0.7)) conquistar('sim70');
  if ((S.perfil.recordes.relampago || 0) >= 15) conquistar('relampago15');
  if (Object.keys(S.perfil.lidos || {}).length >= 20) conquistar('lei20');
  if ((S.perfil.saidos || 0) >= 25) conquistar('lista25');
  if (BLOCOS.some((b) => (dominioBloco(b.id) || 0) >= 0.8)) conquistar('bloco80');
  if (['lgpd-17-22', 'lgpd-52-54', 'lgpd-55', 'lgpd-33-36'].every((b) => (dominioBloco(b) || 0) >= 0.6)) conquistar('p1');
  let duv = 0;
  for (const r of Object.values(S.itens)) duv += (r[5] || 0) + (r[6] || 0);
  if (duv >= 20) conquistar('calibrado');
  if (ctx.respondeu && new Date().getHours() >= 23) conquistar('coruja');
}

/* ================= Seleção de itens ================= */
function blocosDisponiveis(ids) {
  return ids.filter((b) => (POR_BLOCO.get(b) || []).length);
}
function poolDe(blocos) {
  const disp = blocosDisponiveis(blocos || []);
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

/* ================= Sessões ================= */
function iniciarSessao(cfg) {
  let itens;
  if (cfg.modo === 'revisao') {
    const v = listaVencida();
    const l = listaCurta().filter((q) => !vencida(q.id));
    itens = v.concat(embaralhar(l)).slice(0, cfg.n || 30);
    if (!itens.length) {
      avisar('LC', 'Lista curta vazia', 'Nenhum erro pendente. Bom sinal: siga com questões novas.');
      return;
    }
    itens = embaralhar(itens);
  } else if (cfg.ids) {
    itens = cfg.ids.map((id) => QI.get(id)).filter(Boolean);
  } else {
    itens = selecionar(poolDe(cfg.blocos), cfg.n || 20, cfg.filtro || 'mistas');
  }
  if (!itens.length) {
    avisar('!', 'Sem itens', 'Nenhuma questão disponível com esse filtro.');
    return;
  }
  sessao = {
    modo: cfg.modo,
    titulo: cfg.titulo || tituloModo(cfg.modo),
    dia: cfg.dia || null,
    ids: itens.map((q) => q.id),
    i: 0,
    resp: {},
    duv: {},
    revelado: false,
    combo: 0,
    comboMax: 0,
    xp: 0,
    ini: Date.now(),
    limite: cfg.modo === 'relampago' ? 90 : cfg.modo === 'simulado' ? (cfg.minutos || 0) * 60 : 0,
    fim: false,
    confirmar: null,
    flash: null,
  };
  if (cfg.modo === 'relampago') {
    sessao.ids = embaralhar(poolDe(cfg.blocos).map((q) => q.id));
  }
  abrirSessao();
}
function tituloModo(m) {
  return { treino: 'Treino', revisao: 'Revisão da lista curta', simulado: 'Simulado Cebraspe', relampago: 'Relâmpago 90 s' }[m] || 'Sessão';
}
let relogioTimer = null;
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
    if (resta <= 0) {
      if (sessao.modo === 'relampago' || sessao.modo === 'simulado') finalizar();
      return;
    }
    if (el) { el.textContent = fmtTempo(resta); el.classList.toggle('urgente', resta <= 15 || (sessao.modo === 'simulado' && resta <= 300)); }
  } else if (el) {
    el.textContent = fmtTempo(decorrido());
  }
}

function responder(resp) {
  if (!sessao || sessao.fim) return;
  const id = sessao.ids[sessao.i];
  const q = QI.get(id);
  if (sessao.modo === 'simulado') {
    sessao.resp[id] = resp;
    if (sessao.i < sessao.ids.length - 1) sessao.i++;
    renderSessao();
    return;
  }
  if (sessao.revelado || sessao.flash) return;
  if (resp === 'B') return;
  const duvida = !!sessao.duv[id];
  const ok = registrar(q, resp, duvida);
  sessao.resp[id] = resp;
  let x = 0;
  if (ok) {
    sessao.combo++;
    sessao.comboMax = Math.max(sessao.comboMax, sessao.combo);
    x = xpAcerto(q, sessao.combo, sessao.modo);
  } else {
    sessao.combo = 0;
  }
  if (sessao.comboMax > (S.perfil.recordes.combo || 0)) S.perfil.recordes.combo = sessao.comboMax;
  sessao.xp += x;
  ganharXP(x);
  sessao.ultimoGanho = x;
  verificarMeta();
  verificarConquistas({ respondeu: true });
  Store.salvar('perfil', 'itens');
  if (sessao.modo === 'relampago') {
    sessao.flash = ok ? 'ok' : 'no';
    renderSessao();
    setTimeout(() => {
      if (!sessao || sessao.fim) return;
      sessao.flash = null;
      sessao.i++;
      if (sessao.i >= sessao.ids.length) finalizar();
      else renderSessao();
    }, ok ? 380 : 900);
    return;
  }
  sessao.revelado = true;
  renderSessao();
}
function proximo() {
  if (!sessao) return;
  if (sessao.modo === 'simulado') {
    if (sessao.i < sessao.ids.length - 1) { sessao.i++; renderSessao(); }
    return;
  }
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
      if (r === 'B') b++;
      else if (ok) { c++; xp += 10; } else e++;
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
  Store.salvar('perfil', 'itens', 'simulados');
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
  setTimeout(() => el.remove(), 3800);
}

/* ================= Componentes ================= */
function iconeFogo() {
  return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2.2 1-3.8 2.3-5 .2 1.6 1 2.7 2.2 3.1C11 8.5 11.3 5.2 12 2z"/></svg>';
}
function iconeEngrenagem() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
}
function anel(valor, total) {
  const r = 36, circ = 2 * Math.PI * r;
  const f = Math.min(1, total ? valor / total : 0);
  return '<div class="anel" role="img" aria-label="' + valor + ' de ' + total + ' itens hoje"><svg viewBox="0 0 86 86"><circle class="trilho" cx="43" cy="43" r="' + r + '"/>' +
    '<circle class="valor' + (f >= 1 ? ' cheio' : '') + '" cx="43" cy="43" r="' + r + '" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + (circ * (1 - f)).toFixed(1) + '"/></svg>' +
    '<div class="meio"><div><b>' + valor + '</b><br><span>de ' + total + '</span></div></div></div>';
}
function barra(f, cls) {
  return '<div class="barra' + (cls ? ' ' + cls : '') + '"><i style="width:' + Math.round(Math.max(0, Math.min(1, f)) * 100) + '%"></i></div>';
}
function seloPrioridade(p) {
  return '<span class="selo p' + p + '">Prioridade ' + p + '</span>';
}
function nomeBloco(bid) { const b = BI.get(bid); return b ? b.nome : bid; }

/* ================= Cabeçalho ================= */
function renderTopo() {
  const nv = nivelDe(S.perfil.xp);
  const seq = sequencia();
  document.getElementById('topo').innerHTML =
    '<div class="marca"><b>Painel ANPD</b><span>Especialista em Regulação de Proteção de Dados · Nível ' + nv.n + '</span></div>' +
    '<div class="status">' +
    '<span class="pilula fogo' + (seq ? '' : ' apagado') + '" title="Dias seguidos de estudo">' + iconeFogo() + seq + '</span>' +
    '<span class="pilula xp" title="Pontos de experiência">' + fmtNum(S.perfil.xp) + ' XP</span>' +
    '<button class="icone-btn" data-acao="config" aria-label="Ajustes">' + iconeEngrenagem() + '</button>' +
    '</div>';
}

/* ================= Hoje ================= */
function contextoHoje() {
  const h = hojeISO();
  const exato = DIAS.find((d) => d.data === h);
  if (exato) return { tipo: 'dia', dia: exato };
  const prox = DIAS.find((d) => d.data > h);
  if (prox) return { tipo: 'folga', prox };
  return { tipo: 'fim' };
}
function blocosAguardando(ids) {
  return (ids || []).filter((b) => BI.get(b) && BI.get(b).aguardando && !(POR_BLOCO.get(b) || []).length);
}
function renderHoje() {
  const ctx = contextoHoje();
  const d = diaLog();
  const nv = nivelDe(S.perfil.xp);
  const venc = listaVencida().length;
  const curta = listaCurta().length;
  const h = hojeISO();
  let heroi = '';
  if (ctx.tipo === 'dia') {
    const dia = ctx.dia;
    const feito = !!S.perfil.feitos[dia.data];
    const aguard = blocosAguardando(dia.blocos);
    const chips = (dia.blocos || []).map((b) => '<span class="selo">' + esc(nomeBloco(b)) + '</span>').join('');
    heroi = '<div class="cartao destaque"><div class="heroi">' +
      '<div><div class="dia">' + esc(fmtData(h, { weekday: 'long' })) + '</div><div class="data">' + esc(fmtData(h, { day: '2-digit', month: 'long', year: 'numeric' })) + ' · ' + esc(dia.duracao) + '</div></div>' +
      anel(d.r, S.perfil.meta) +
      '<p class="atividade">' + esc(dia.atividade) + '</p>' +
      (chips ? '<div class="chips" style="grid-column:1/-1">' + chips + '</div>' : '') +
      (aguard.length ? '<p class="nota-aguardando" style="grid-column:1/-1">' + esc(aguard.map(nomeBloco).join('; ')) + ': ainda sem questões. A sessão usa os blocos de LGPD ligados ao tema. Envie o texto ao Claude para ganhar questões próprias.</p>' : '') +
      '<div class="acoes linha-btns"><button class="btn primario" data-acao="iniciar-dia" data-dia="' + dia.data + '">' + (feito ? 'Fazer outra rodada' : 'Começar a sessão de hoje') + ' · ' + esc(rotuloModoDia(dia)) + '</button></div>' +
      '</div></div>';
  } else if (ctx.tipo === 'folga') {
    heroi = '<div class="cartao"><div class="heroi">' +
      '<div><div class="dia">' + esc(fmtData(h, { weekday: 'long' })) + '</div><div class="data">Dia livre por padrão; revisão leve é opcional</div></div>' +
      anel(d.r, S.perfil.meta) +
      '<p class="atividade"><span class="mudo">Próxima sessão, ' + esc(fmtData(ctx.prox.data, { weekday: 'short', day: '2-digit', month: '2-digit' })) + ':</span> ' + esc(ctx.prox.atividade) + '</p>' +
      '<div class="acoes linha-btns"><button class="btn primario" data-acao="iniciar-revisao">Revisão leve</button><button class="btn" data-acao="iniciar-dia" data-dia="' + ctx.prox.data + '">Adiantar a próxima</button></div>' +
      '</div></div>';
  } else {
    heroi = '<div class="cartao"><div class="heroi"><div><div class="dia">Ciclo de 11 semanas concluído</div><div class="data">Hora de recomeçar pelos blocos mais fracos</div></div>' + anel(d.r, S.perfil.meta) +
      '<div class="acoes linha-btns"><button class="btn primario" data-acao="iniciar-revisao">Revisar a lista curta</button><button class="btn" data-acao="ir" data-vista="progresso">Ver blocos mais fracos</button></div></div></div>';
  }

  const nivel = '<div class="cartao"><div class="nivel"><div class="insignia">' + nv.n + '</div><div class="info">' +
    '<div class="titulo">' + esc(nv.nome) + '</div>' + barra((S.perfil.xp - nv.base) / (nv.prox - nv.base), 'ouro') +
    '<div class="pequeno mudo mono">' + fmtNum(S.perfil.xp) + ' / ' + fmtNum(nv.prox) + ' XP · faltam ' + fmtNum(nv.prox - S.perfil.xp) + ' para o próximo nível</div></div></div></div>';

  const revisao = '<div class="cartao"><div class="secao-cab"><h2>Lista curta de erros</h2><span class="mudo pequeno">' + pl(curta, 'item', 'itens') + ' na lista</span></div>' +
    (curta ? '<p class="mudo">O erro entra na lista e volta até você acertar duas vezes seguidas, em dias diferentes. ' + (venc ? '<b>' + pl(venc, 'item vence', 'itens vencem') + ' hoje.</b>' : 'Nada vence hoje.') + '</p>' +
      '<div class="linha-btns"><button class="btn' + (venc ? ' primario' : '') + '" data-acao="iniciar-revisao">Revisar agora</button></div>'
      : '<p class="mudo">Vazia. Cada item que você errar ou acertar no chute entra aqui automaticamente.</p>') + '</div>';

  const p1 = ['lgpd-17-22', 'lgpd-52-54', 'lgpd-55', 'lgpd-33-36'];
  const modos = '<div class="secao"><div class="secao-cab"><h2>Modos de jogo</h2></div><div class="grade-modos">' +
    '<button class="modo" data-acao="abrir-modo" data-modo="treino"><b>Treino</b><span>Escolha blocos e receba gabarito comentado a cada item.</span><span class="num">' + Q.length + ' questões no banco</span></button>' +
    '<button class="modo" data-acao="abrir-modo" data-modo="simulado"><b>Simulado Cebraspe</b><span>Uma errada anula uma certa. Em branco vale zero.</span><span class="num">' + pl(S.simulados.length, 'simulado feito', 'simulados feitos') + '</span></button>' +
    '<button class="modo" data-acao="relampago" data-blocos="' + p1.join(',') + '"><b>Relâmpago 90 s</b><span>Quantos itens da prioridade 1 você acerta em um minuto e meio?</span><span class="num">Recorde: ' + (S.perfil.recordes.relampago || 0) + '</span></button>' +
    '<button class="modo" data-acao="ir" data-vista="lei"><b>Lei seca</b><span>A LGPD inteira, com os trechos que você errou marcados.</span><span class="num">' + ARTS.length + ' artigos</span></button>' +
    '</div></div>';

  const faltam = diaNum(D.cronograma.edital) - HOJE();
  const edital = '<div class="cartao"><div class="contagem"><span class="grande">' + Math.max(0, faltam) + '</span><span>' +
    (faltam >= 0 ? 'dias até 22/12/2026, prazo legal máximo para o edital.' : 'O prazo legal do edital (22/12/2026) passou: acompanhe as notícias.') + '</span></div>' +
    '<p class="pequeno mudo">Banca ainda não contratada até a última atualização do plano. O formato certo/errado segue como premissa.</p></div>';

  document.getElementById('vista-hoje').innerHTML = heroi + nivel + revisao + modos + edital + '<p class="sync" id="sync"></p>';
  atualizarRodapeSync();
}
function rotuloModoDia(dia) {
  if (dia.modo === 'revisao') return 'revisão';
  if (dia.modo === 'simulado') return 'simulado de ' + dia.n;
  return dia.n + ' itens';
}
function atualizarRodapeSync() {
  const el = document.getElementById('sync');
  if (!el) return;
  if (Store.modo === 'nuvem') el.textContent = Store.erro ? 'Falha ao salvar na sua conta (' + Store.erro + '). O progresso continua guardado neste navegador.' : 'Progresso salvo na sua conta: abre igual no celular e no computador.';
  else el.textContent = 'Progresso salvo só neste navegador.';
}

function iniciarDia(data) {
  const dia = DIAS.find((d) => d.data === data);
  if (!dia) return;
  const titulo = fmtData(dia.data, { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' · ' + (dia.modo === 'revisao' ? 'Revisão' : dia.modo === 'simulado' ? 'Simulado' : 'Treino do dia');
  if (dia.modo === 'revisao') {
    if (!listaCurta().length) {
      iniciarSessao({ modo: 'treino', n: Math.min(dia.n, 20), blocos: [], filtro: 'mistas', titulo, dia: dia.data });
      return;
    }
    iniciarSessao({ modo: 'revisao', n: dia.n, titulo, dia: dia.data });
    return;
  }
  if (dia.modo === 'simulado') {
    iniciarSessao({ modo: 'simulado', n: dia.n, blocos: dia.blocos, titulo, dia: dia.data, minutos: Math.round(dia.n * 1.5) });
    return;
  }
  iniciarSessao({ modo: 'treino', n: dia.n, blocos: dia.blocos, filtro: 'mistas', titulo, dia: dia.data });
}

/* ================= Treinar ================= */
function renderTreinar() {
  const modo = UI.modo;
  const ns = modo === 'simulado' ? [30, 60, 120] : [10, 20, 30, 50];
  if (!ns.includes(UI.n)) UI.n = ns[1];
  const sel = new Set(UI.blocos);
  const pool = poolDe(UI.blocos);
  let html = '<div class="secao"><div class="secao-cab"><h2>Montar sessão</h2></div>' +
    '<div class="chips" role="group" aria-label="Modo">' +
    ['treino', 'simulado', 'relampago'].map((m) => '<button class="chip" data-acao="set-modo" data-modo="' + m + '" aria-pressed="' + (modo === m) + '">' + esc({ treino: 'Treino comentado', simulado: 'Simulado Cebraspe', relampago: 'Relâmpago 90 s' }[m]) + '</button>').join('') +
    '</div>' +
    '<p class="mudo pequeno">' + esc({
      treino: 'Gabarito e comentário logo após cada item. Primeiro vêm os itens da lista curta que vencem hoje, depois os inéditos.',
      simulado: 'Sem gabarito até entregar. Cada errada anula uma certa; em branco não pontua. No fim, você vê se teria valido a pena chutar.',
      relampago: 'Um minuto e meio. Acerto soma, erro subtrai. Vale o recorde.',
    }[modo]) + '</p></div>';

  if (modo !== 'relampago') {
    html += '<div class="campo"><span class="rot">Quantidade de itens</span><div class="chips">' +
      ns.map((n) => '<button class="chip" data-acao="set-n" data-n="' + n + '" aria-pressed="' + (UI.n === n) + '">' + n + '</button>').join('') + '</div></div>';
  }
  if (modo === 'treino') {
    html += '<div class="campo"><span class="rot">Quais itens</span><div class="chips">' +
      [['mistas', 'Vencidas + inéditas'], ['novas', 'Só inéditas'], ['erradas', 'Só as que já errei']].map(([v, t]) => '<button class="chip" data-acao="set-filtro" data-filtro="' + v + '" aria-pressed="' + (UI.filtro === v) + '">' + t + '</button>').join('') + '</div></div>';
  }

  html += '<div class="secao"><div class="secao-cab"><h2>Blocos</h2><span class="mudo pequeno mono">' + pool.length + ' itens disponíveis</span></div>' +
    '<div class="chips">' +
    '<button class="chip" data-acao="preset" data-preset="p1">Prioridade 1</button>' +
    '<button class="chip" data-acao="preset" data-preset="lgpd">LGPD inteira</button>' +
    '<button class="chip" data-acao="preset" data-preset="tudo">Tudo</button>' +
    '<button class="chip" data-acao="preset" data-preset="nada">Limpar</button></div>';
  for (const disc of DISC) {
    const bs = BLOCOS.filter((b) => b.disciplina === disc.id);
    if (!bs.length) continue;
    html += '<div class="grupo-blocos"><span class="rotulo">' + esc(disc.nome) + ' · peso ' + esc(disc.peso) + '</span>';
    for (const b of bs) {
      const qs = POR_BLOCO.get(b.id) || [];
      const dom = dominioBloco(b.id);
      if (!qs.length) {
        html += '<div class="bloco-op vazio"><input type="checkbox" disabled aria-label="' + esc(b.nome) + '"><div class="txt"><b>' + esc(b.nome) + '</b><small>Aguardando o texto: ' + esc(b.aguardando || 'fonte') + '</small></div></div>';
        continue;
      }
      html += '<label class="bloco-op"><input type="checkbox" data-acao="toggle-bloco" data-bloco="' + b.id + '"' + (sel.has(b.id) ? ' checked' : '') + '>' +
        '<div class="txt"><b>' + esc(b.nome) + '</b><small>' + esc(b.dispositivos) + ' · ' + qs.length + ' itens</small></div>' +
        '<div class="dom">' + barra(dom || 0) + '<span>' + Math.round((dom || 0) * 100) + '%</span></div></label>';
    }
    html += '</div>';
  }
  html += '</div>';
  html += '<button class="btn primario largo" data-acao="comecar"' + (pool.length ? '' : ' disabled') + '>Começar ' + esc({ treino: 'treino', simulado: 'simulado', relampago: 'relâmpago' }[modo]) + '</button>';
  if (!UI.blocos.length) html += '<p class="mudo pequeno">Nenhum bloco marcado: a sessão usa o banco inteiro.</p>';
  document.getElementById('vista-treinar').innerHTML = html;
}
function comecarConfigurado() {
  if (UI.modo === 'relampago') {
    iniciarSessao({ modo: 'relampago', blocos: UI.blocos });
  } else if (UI.modo === 'simulado') {
    iniciarSessao({ modo: 'simulado', n: UI.n, blocos: UI.blocos, minutos: Math.round(UI.n * 1.5) });
  } else {
    iniciarSessao({ modo: 'treino', n: UI.n, blocos: UI.blocos, filtro: UI.filtro });
  }
}

/* ================= Render da sessão ================= */
function renderSessao() {
  const el = document.getElementById('sessao');
  if (!sessao) return;
  if (sessao.fim) { el.innerHTML = '<div class="sessao-corpo">' + renderResultado() + '</div>'; return; }
  const id = sessao.ids[sessao.i];
  const q = QI.get(id);
  const total = sessao.modo === 'relampago' ? null : sessao.ids.length;
  const relogio = sessao.limite ? fmtTempo(sessao.limite - decorrido()) : fmtTempo(decorrido());
  let html = '<div class="sessao-corpo">';
  html += '<div class="sessao-topo"><button class="icone-btn" data-acao="sair-sessao" aria-label="Sair da sessão"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
    '<div class="tit"><b>' + esc(sessao.titulo) + '</b><span>' + (total ? 'Item ' + (sessao.i + 1) + ' de ' + total : 'Item ' + (sessao.i + 1)) + (sessao.xp ? ' · +' + sessao.xp + ' XP' : '') + '</span></div>' +
    (sessao.modo !== 'simulado' && sessao.combo >= 2 ? '<span class="combo' + (sessao.revelado || sessao.flash ? ' pulso' : '') + '">combo ×' + sessao.combo + '</span>' : '') +
    '<span class="relogio" id="relogio">' + relogio + '</span></div>';
  if (sessao.confirmar) html += renderConfirmacao();
  if (total) html += renderTira();
  html += renderItem(q);
  html += '</div>';
  el.innerHTML = html;
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
function renderApoio(q) {
  if (q.ap < 0) return '';
  const txt = D.apoios[q.ap].split('\n').map((p) => '<p>' + esc(p) + '</p>').join('');
  return '<details class="apoio-det"' + (sessao && sessao.i > 0 && sessao.modo !== 'simulado' ? '' : ' open') + '><summary>Texto de apoio</summary><div class="apoio">' + txt + '</div></details>';
}
function renderItem(q) {
  const id = q.id;
  const sim = sessao.modo === 'simulado';
  const marcada = sessao.resp[id];
  let html = '<article class="item">';
  html += '<div class="item-cab"><span class="selo mono">' + esc(nomeBloco(q.b)) + '</span><span class="item-num">' + esc(q.id) + '</span></div>';
  html += renderApoio(q);
  html += '<p class="enunciado">' + esc(q.e) + '</p>';
  if (sessao.flash) {
    html += '<div class="veredito ' + sessao.flash + '"><span>' + (sessao.flash === 'ok' ? 'Certo' : 'Errado: gabarito ' + (q.g === 'C' ? 'CERTO' : 'ERRADO')) + '</span>' + (sessao.ultimoGanho ? '<span class="ganho">+' + sessao.ultimoGanho + ' XP</span>' : '') + '</div>';
  } else if (!sessao.revelado) {
    if (sessao.modo !== 'relampago') {
      html += '<label class="duvida"><input type="checkbox" data-acao="duvida"' + (sessao.duv[id] ? ' checked' : '') + '> Estou em dúvida (vale para medir quando chutar)</label>';
    }
    html += '<div class="respostas">' +
      '<button class="bolha c' + (marcada === 'C' ? ' marcada' : '') + '" data-acao="responder" data-r="C"><span class="oval"><span>C</span></span>CERTO</button>' +
      '<button class="bolha e' + (marcada === 'E' ? ' marcada' : '') + '" data-acao="responder" data-r="E"><span class="oval"><span>E</span></span>ERRADO</button>' +
      (sim ? '<button class="bolha b' + (marcada === 'B' ? ' marcada' : '') + '" data-acao="responder" data-r="B">Em branco</button>' : '') +
      '</div>';
    html += '<p class="atalhos">Teclado: C = certo · E = errado' + (sim ? ' · B = em branco · ← → navegam' : '') + ' · D = dúvida</p>';
    if (sim) {
      const resp = Object.keys(sessao.resp).length;
      html += '<div class="linha-btns"><button class="btn" data-acao="anterior"' + (sessao.i ? '' : ' disabled') + '>Anterior</button>' +
        '<button class="btn" data-acao="proximo"' + (sessao.i < sessao.ids.length - 1 ? '' : ' disabled') + '>Próximo</button>' +
        '<button class="btn primario" data-acao="entregar">Entregar (' + resp + '/' + sessao.ids.length + ')</button></div>';
    }
  } else {
    const r = sessao.resp[id];
    const ok = r === q.g;
    html += '<div class="veredito ' + (ok ? 'ok' : 'no') + '"><span>' + (ok ? 'Você marcou ' + (r === 'C' ? 'CERTO' : 'ERRADO') + ' e acertou.' : 'Você marcou ' + (r === 'C' ? 'CERTO' : 'ERRADO') + '. O gabarito é ' + (q.g === 'C' ? 'CERTO' : 'ERRADO') + '.') + '</span>' +
      (sessao.ultimoGanho ? '<span class="ganho ganho-voa">+' + sessao.ultimoGanho + ' XP</span>' : '<span class="pequeno">Foi para a lista curta</span>') + '</div>';
    html += renderExplicacao(q);
    html += '<button class="btn primario largo" data-acao="proximo">' + (sessao.i < sessao.ids.length - 1 ? 'Próximo item' : 'Ver resultado') + '</button>';
    html += '<p class="atalhos">Enter = próximo</p>';
  }
  html += '</article>';
  return html;
}
function renderExplicacao(q) {
  let html = '<div class="explica"><span class="gab">Gabarito: ' + (q.g === 'C' ? 'certo' : 'errado') + ' · armadilha: ' + esc(D.armadilhas[q.a] || q.a) + '</span>';
  html += '<p>' + esc(q.c) + '</p>';
  if (q.t && q.t.length) {
    html += '<div class="citacao">' + q.t.map((t) => '<q>' + esc(t) + '</q>').join('') +
      '<span class="fonte">' + esc(q.r) + '</span>' +
      (q.art && ARTI.get(q.art) ? '<div><button class="linkish" data-acao="ver-art" data-art="' + esc(q.art) + '" data-q="' + esc(q.id) + '">Ler o ' + esc(rotuloArt(q.art).toLowerCase()) + ' inteiro</button></div>' : '') + '</div>';
  } else {
    html += '<div class="citacao"><span class="fonte">Fonte: ' + esc(q.r) + '</span></div>';
  }
  html += '</div>';
  return html;
}
function renderConfirmacao() {
  if (sessao.confirmar === 'entregar') {
    const faltam = sessao.ids.length - Object.keys(sessao.resp).length;
    return '<div class="cartao destaque"><b>Entregar o simulado?</b><p class="mudo">' + (faltam ? pl(faltam, 'item sem marcação conta', 'itens sem marcação contam') + ' como em branco.' : 'Todos os itens foram marcados.') + '</p>' +
      '<div class="linha-btns"><button class="btn primario" data-acao="confirmar-entrega">Entregar</button><button class="btn" data-acao="cancelar-conf">Voltar</button></div></div>';
  }
  if (sessao.confirmar === 'sair') {
    const msg = sessao.modo === 'simulado' ? 'As marcações deste simulado serão descartadas.' : 'O que você já respondeu fica salvo.';
    return '<div class="cartao destaque"><b>Sair da sessão?</b><p class="mudo">' + msg + '</p>' +
      '<div class="linha-btns"><button class="btn primario" data-acao="confirmar-saida">Sair</button><button class="btn" data-acao="cancelar-conf">Continuar</button></div></div>';
  }
  return '';
}
function renderResultado() {
  const ids = sessao.modo === 'relampago' ? sessao.ids.filter((id) => sessao.resp[id]) : sessao.ids;
  let c = 0, e = 0, b = 0;
  let dc = 0, de = 0, db = 0;
  ids.forEach((id) => {
    const r = sessao.resp[id] || 'B';
    const q = QI.get(id);
    const duv = !!sessao.duv[id];
    if (r === 'B') { b++; if (duv) db++; } else if (r === q.g) { c++; if (duv) dc++; } else { e++; if (duv) de++; }
  });
  const liq = c - e;
  const n = ids.length;
  let html = '<div class="sessao-topo"><div class="tit"><b>' + esc(sessao.titulo) + '</b><span>Resultado · ' + fmtTempo(sessao.dur) + '</span></div><button class="btn" data-acao="fechar-sessao">Concluir</button></div>';
  html += '<div class="cartao destaque"><span class="rotulo">Nota líquida Cebraspe (certas − erradas)</span>' +
    '<div class="nota-final"><span class="grande">' + liq + '</span><span class="mudo">de ' + n + ' possíveis · ' + (n ? Math.round((liq / n) * 100) : 0) + '%</span></div>' +
    '<div class="placar"><div class="C"><b>' + c + '</b><span>certas</span></div><div class="E"><b>' + e + '</b><span>erradas</span></div><div><b>' + b + '</b><span>em branco</span></div><div class="L"><b>+' + sessao.xp + '</b><span>XP</span></div></div>';
  if (sessao.modo === 'relampago') html += '<p>' + (sessao.recorde ? '<b>Novo recorde!</b> ' : '') + 'Recorde pessoal: ' + (S.perfil.recordes.relampago || 0) + '.</p>';
  if (sessao.comboMax >= 3) html += '<p class="mudo">Maior sequência de acertos: ' + sessao.comboMax + '.</p>';
  html += '</div>';
  const nd = dc + de;
  if (nd) {
    const taxa = pct(dc, nd);
    const semChute = liq - dc + de;
    html += '<div class="cartao"><h2>Chutar ou deixar em branco?</h2><p>Nos ' + pl(nd, 'item marcado', 'itens marcados') + ' com dúvida, você acertou ' + dc + ' (' + taxa + '%). ' +
      (taxa > 50 ? 'Acima de 50%, o chute rendeu pontos: sem ele, sua nota seria ' + semChute + '.' : taxa === 50 ? 'Exatamente 50%: chutar ou deixar em branco deu no mesmo.' : 'Abaixo de 50%, o chute custou pontos: deixando esses itens em branco, sua nota seria ' + semChute + '.') + '</p>' +
      '<p class="mudo pequeno">No Cebraspe, chutar só compensa quando a chance de acerto passa de 50%. A aba Progresso acumula essa taxa ao longo do tempo.</p></div>';
  }
  const lista = ids.map((id, k) => {
    const q = QI.get(id);
    const r = sessao.resp[id] || 'B';
    const cls = r === 'B' ? 'B' : r === q.g ? 'C' : 'E';
    return { k, q, cls };
  });
  const ordenada = lista.filter((x) => x.cls !== 'C').concat(lista.filter((x) => x.cls === 'C'));
  html += '<div class="secao"><div class="secao-cab"><h2>Revisar itens</h2><span class="mudo pequeno">Erros e brancos primeiro</span></div><div class="lista-rev">' +
    ordenada.map((x) => '<button data-acao="revisar-item" data-q="' + esc(x.q.id) + '" data-r="' + esc(sessao.resp[x.q.id] || 'B') + '"><span class="marca-res ' + x.cls + '">' + ({ C: '✓', E: '✗', B: '–' }[x.cls]) + '</span><span class="txt">' + esc(x.q.e) + '</span></button>').join('') +
    '</div></div>';
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
  const btn = f.querySelector('[data-acao="fechar-folha"]');
  if (btn) btn.focus();
}
function fecharFolha() {
  const f = document.getElementById('folha');
  f.hidden = true;
  f.innerHTML = '';
}
function folhaItem(id, resp) {
  const q = QI.get(id);
  const r = resp || null;
  let html = '<div class="folha-cab"><div><span class="rotulo">' + esc(nomeBloco(q.b)) + '</span><h2>' + esc(q.id) + '</h2></div><button class="btn pequeno" data-acao="fechar-folha">Fechar</button></div>';
  html += renderApoioFolha(q);
  html += '<p class="enunciado">' + esc(q.e) + '</p>';
  if (r) {
    const ok = r === q.g;
    html += '<div class="veredito ' + (r === 'B' ? 'no' : ok ? 'ok' : 'no') + '"><span>' + (r === 'B' ? 'Em branco.' : 'Você marcou ' + (r === 'C' ? 'CERTO' : 'ERRADO') + '.') + ' Gabarito: ' + (q.g === 'C' ? 'CERTO' : 'ERRADO') + '.</span></div>';
  }
  html += renderExplicacao(q);
  abrirFolha(html, 'Item ' + q.id);
}
function renderApoioFolha(q) {
  if (q.ap < 0) return '';
  return '<details class="apoio-det"><summary>Texto de apoio</summary><div class="apoio">' + D.apoios[q.ap].split('\n').map((p) => '<p>' + esc(p) + '</p>').join('') + '</div></details>';
}
function folhaArtigo(art, qid) {
  const a = ARTI.get(art);
  if (!a) return;
  marcarLido(art);
  const extra = qid ? [qid] : [];
  abrirFolha('<div class="folha-cab"><div><span class="rotulo">' + esc(LEI.curto) + '</span><h2>' + esc(rotuloArt(art)) + '</h2></div><button class="btn pequeno" data-acao="fechar-folha">Fechar</button></div>' +
    '<p class="pequeno mudo">' + esc(a.estrutura.join(' · ')) + '</p>' +
    '<div class="texto-lei">' + textoLei(a, 'erros', extra) + '</div>' +
    '<p class="pequeno mudo">Marcado em amarelo: o trecho que decidiu esta questão. Em vermelho: trechos de questões que você errou.</p>', rotuloArt(art));
}

/* ================= Lei seca ================= */
function marcarLido(art) {
  if (!S.perfil.lidos) S.perfil.lidos = {};
  if (!S.perfil.lidos[art]) {
    S.perfil.lidos[art] = hojeISO();
    verificarConquistas();
    Store.salvar('perfil');
  }
}
function rangesDe(texto, trechos) {
  const out = [];
  for (const t of trechos) {
    if (!t) continue;
    let i = texto.indexOf(t);
    while (i >= 0) { out.push([i, i + t.length]); i = texto.indexOf(t, i + t.length); }
  }
  return out;
}
function textoLei(a, modo, qExtras) {
  const qs = POR_ART.get(a.id) || [];
  const erros = [], todos = [], extras = [];
  for (const q of qs) {
    const r = rec(q.id);
    if (r && r[3] > 0) erros.push(...q.t);
    todos.push(...q.t);
  }
  for (const id of qExtras || []) { const q = QI.get(id); if (q) extras.push(...q.t); }
  return a.texto.split('\n').map((linha, k) => {
    const marcas = [];
    rangesDe(linha, extras).forEach((r) => marcas.push(r.concat('')));
    rangesDe(linha, erros).forEach((r) => marcas.push(r.concat('erro')));
    if (modo === 'todos') rangesDe(linha, todos).forEach((r) => marcas.push(r.concat('')));
    marcas.sort((x, y) => x[0] - y[0] || y[1] - x[1]);
    const unidos = [];
    for (const m of marcas) {
      const u = unidos[unidos.length - 1];
      if (u && m[0] <= u[1]) { u[1] = Math.max(u[1], m[1]); if (m[2] === 'erro') u[2] = 'erro'; }
      else unidos.push(m.slice());
    }
    let html = '', pos = 0;
    for (const [i, f, cls] of unidos) {
      html += fmtNotas(esc(linha.slice(pos, i))) + '<mark' + (cls ? ' class="' + cls + '"' : '') + '>' + fmtNotas(esc(linha.slice(i, f))) + '</mark>';
      pos = f;
    }
    html += fmtNotas(esc(linha.slice(pos)));
    let cls = 'par';
    if (k === 0) cls = 'caput';
    else if (/^[IVXL]+(-[A-Z])?\s-/.test(linha)) cls = 'inc';
    else if (/^[a-z]\)/.test(linha)) cls = 'ali';
    return '<p class="' + cls + '">' + html + '</p>';
  }).join('');
}
function fmtNotas(s) {
  return s.replace(/\((Redação dada|Incluído|Incluída|Revogado|Promulgação)[^)]*\)/g, (m) => '<span class="nota">' + m + '</span>');
}
function renderLei() {
  const el = document.getElementById('vista-lei');
  if (!LEI) { el.innerHTML = '<p class="vazio-msg">Nenhum texto legal anexado ainda.</p>'; return; }
  if (UI.artSel) { el.innerHTML = renderArtigo(UI.artSel); return; }
  let html = '<div class="secao"><div class="secao-cab"><h2>' + esc(LEI.nome) + '</h2><a class="pequeno" href="' + esc(LEI.url) + '" target="_blank" rel="noopener">Planalto</a></div>' +
    '<input class="busca" id="busca-lei" type="search" placeholder="Buscar na lei (ex.: quinze dias, encarregado, Senado)" value="' + esc(UI.busca) + '" data-acao="buscar" aria-label="Buscar na LGPD">' +
    '<p class="pequeno mudo">Os pontos sob cada artigo são as questões do banco sobre ele: verde já dominada, vermelho na lista curta, cinza ainda não respondida.</p></div>';
  if (UI.busca.trim().length >= 3) {
    html += '<div class="resultado-busca">' + buscarLei(UI.busca) + '</div>';
  } else {
    let atual = null, aberto = false;
    for (const a of ARTS) {
      const cap = a.estrutura[0] || '';
      if (cap !== atual) {
        if (aberto) html += '</div></div>';
        html += '<div class="capitulo"><h3>' + esc(cap.replace(/\s*\(Redação dada[^)]*\)/, '')) + '</h3><div class="artigos">';
        aberto = true;
        atual = cap;
      }
      const qs = POR_ART.get(a.id) || [];
      const pontos = qs.slice(0, 6).map((q) => { const r = rec(q.id); const c = !r || r[0] < 0 ? 'nv' : r[0] >= 3 ? 'ok' : 'no'; return '<i class="' + c + '"></i>'; }).join('');
      const vetado = /\((VETADO|Revogado)/.test(a.texto.split('\n')[0]);
      html += '<button class="art-btn' + (S.perfil.lidos && S.perfil.lidos[a.id] ? ' lido' : '') + '" data-acao="abrir-art" data-art="' + esc(a.id) + '"' + (vetado ? ' style="opacity:.55"' : '') + '>' + esc(a.id) + '<span class="pontos">' + pontos + '</span></button>';
    }
    if (aberto) html += '</div></div>';
  }
  el.innerHTML = html;
}
function buscarLei(termo) {
  // Palavras separadas por qualquer pontuação: “quinze dias” encontra “15 (quinze) dias”.
  const palavras = semAcento(termo.trim()).split(/[^a-z0-9º]+/).filter(Boolean);
  if (!palavras.length) return '';
  const re = new RegExp(palavras.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^a-z0-9º]+'));
  const res = [];
  for (const a of ARTS) {
    const m = re.exec(semAcento(a.texto));
    if (m) {
      const i = m.index;
      const ini = Math.max(0, i - 60);
      const trecho = (ini ? '…' : '') + a.texto.slice(ini, i + m[0].length + 90).replace(/\n/g, ' ') + '…';
      res.push('<button data-acao="abrir-art" data-art="' + esc(a.id) + '"><b>' + esc(rotuloArt(a.id)) + '</b><span>' + esc(trecho) + '</span></button>');
    }
  }
  return res.length ? res.join('') : '<p class="vazio-msg">Nada encontrado para “' + esc(termo) + '”.</p>';
}
function renderArtigo(id) {
  const a = ARTI.get(id);
  const idx = ARTS.indexOf(a);
  const qs = POR_ART.get(id) || [];
  const erros = qs.filter((q) => { const r = rec(q.id); return r && r[3] > 0; }).length;
  let html = '<div class="secao-cab"><button class="btn pequeno" data-acao="voltar-lei">Todos os artigos</button>' +
    '<div class="linha-btns"><button class="btn pequeno" data-acao="nav-art" data-art="' + (idx > 0 ? esc(ARTS[idx - 1].id) : '') + '"' + (idx > 0 ? '' : ' disabled') + ' aria-label="Artigo anterior">←</button>' +
    '<button class="btn pequeno" data-acao="nav-art" data-art="' + (idx < ARTS.length - 1 ? esc(ARTS[idx + 1].id) : '') + '"' + (idx < ARTS.length - 1 ? '' : ' disabled') + ' aria-label="Próximo artigo">→</button></div></div>';
  html += '<div class="cartao"><span class="rotulo">' + esc(a.estrutura.join(' · ')) + '</span><h2>' + esc(rotuloArt(id)) + '</h2>' +
    '<div class="chips"><button class="chip" data-acao="destaque" data-d="erros" aria-pressed="' + (UI.destaque === 'erros') + '">Meus erros' + (erros ? ' <span class="n">' + erros + '</span>' : '') + '</button>' +
    '<button class="chip" data-acao="destaque" data-d="todos" aria-pressed="' + (UI.destaque === 'todos') + '">Tudo o que o banco cobra</button></div>' +
    '<div class="texto-lei">' + textoLei(a, UI.destaque) + '</div>';
  if (qs.length) html += '<div class="linha-btns"><button class="btn primario" data-acao="treinar-art" data-art="' + esc(id) + '">Treinar este artigo (' + qs.length + ')</button></div>';
  else html += '<p class="mudo pequeno">Nenhuma questão do banco cita este artigo diretamente.</p>';
  html += '</div>';
  return html;
}

/* ================= Progresso ================= */
function renderProgresso() {
  const t = totais();
  const nv = nivelDe(S.perfil.xp);
  const seq = sequencia();
  let html = '<div class="cartao"><div class="nivel"><div class="insignia">' + nv.n + '</div><div class="info"><div class="titulo">' + esc(nv.nome) + '</div>' +
    barra((S.perfil.xp - nv.base) / (nv.prox - nv.base), 'ouro') + '<div class="pequeno mudo mono">' + fmtNum(S.perfil.xp) + ' XP · próximo nível em ' + fmtNum(nv.prox) + '</div></div></div></div>';
  html += '<div class="estat">' +
    '<div><b>' + fmtNum(t.r) + '</b><span>itens respondidos</span></div>' +
    '<div><b>' + pct(t.c, t.r) + '%</b><span>de acerto</span></div>' +
    '<div><b>' + fmtNum(t.c - t.e) + '</b><span>nota líquida acumulada</span></div>' +
    '<div><b>' + seq + '</b><span>dias seguidos</span></div>' +
    '<div><b>' + (S.perfil.melhorSeq || 0) + '</b><span>melhor sequência</span></div>' +
    '<div><b>' + (S.perfil.recordes.combo || 0) + '</b><span>maior combo</span></div></div>';

  html += '<div class="cartao"><div class="secao-cab"><h2>Constância</h2><span class="mudo pequeno">Últimas 16 semanas</span></div>' + mapaCalor() + '</div>';

  html += '<div class="cartao"><div class="secao-cab"><h2>Domínio por bloco</h2><span class="mudo pequeno">Média da revisão espaçada</span></div><div class="dominio">';
  const comQ = BLOCOS.filter((b) => (POR_BLOCO.get(b.id) || []).length).sort((a, b) => a.prioridade - b.prioridade);
  for (const b of comQ) {
    const dmn = dominioBloco(b.id) || 0;
    html += '<div class="dom-linha" title="' + esc(b.dispositivos) + '"><span class="nome">' + esc(b.nome) + '</span>' + barra(dmn) + '<span class="val">' + Math.round(dmn * 100) + '%</span></div>';
  }
  html += '</div><p class="pequeno mudo">Um acerto de primeira vale 80%; o item chega a 100% quando você confirma o acerto na revisão seguinte. Erro zera.</p></div>';

  const arm = {};
  for (const q of Q) {
    const r = rec(q.id);
    if (!r || r[0] < 0) continue;
    const a = (arm[q.a] ||= { c: 0, e: 0 });
    a.c += r[2]; a.e += r[3];
  }
  const armLista = Object.entries(arm).filter(([, v]) => v.c + v.e >= 3).map(([k, v]) => ({ k, taxa: v.e / (v.c + v.e), n: v.c + v.e })).sort((a, b) => b.taxa - a.taxa);
  html += '<div class="cartao"><div class="secao-cab"><h2>Onde você cai</h2><span class="mudo pequeno">Taxa de erro por tipo de armadilha</span></div>';
  if (armLista.length) {
    html += '<div class="dominio">' + armLista.map((x) => '<div class="dom-linha"><span class="nome">' + esc(D.armadilhas[x.k] || x.k) + '</span>' + barra(x.taxa).replace('class="barra"', 'class="barra" style="--accent:var(--errado)"') + '<span class="val">' + Math.round(x.taxa * 100) + '%</span></div>').join('') + '</div>';
  } else html += '<p class="mudo">Responda algumas dezenas de itens para ver em que tipo de pegadinha você mais erra.</p>';
  html += '</div>';

  let dc = 0, de = 0;
  for (const r of Object.values(S.itens)) { dc += r[5] || 0; de += r[6] || 0; }
  html += '<div class="cartao"><h2>Calibragem do chute</h2>';
  if (dc + de >= 5) {
    const taxa = pct(dc, dc + de);
    html += '<p>Quando marca dúvida, você acerta <b>' + taxa + '%</b> (' + dc + ' de ' + (dc + de) + '). ' + (taxa > 50 ? 'Acima de 50%: na prova, chutar tende a somar pontos.' : 'Até 50%: na prova, deixar em branco tende a ser melhor.') + '</p>';
  } else html += '<p class="mudo">Marque “Estou em dúvida” antes de responder. Com 5 marcações já dá para saber se o seu chute compensa.</p>';
  html += '</div>';

  if (S.simulados.length) {
    html += '<div class="cartao"><h2>Simulados</h2><div class="tabela-env"><table class="tabela"><thead><tr><th>Data</th><th>Itens</th><th>Certas</th><th>Erradas</th><th>Nota</th></tr></thead><tbody>' +
      S.simulados.slice(0, 12).map((s) => '<tr><td>' + esc(fmtData(s.data, { day: '2-digit', month: '2-digit' })) + '</td><td class="num">' + s.n + '</td><td class="num">' + s.c + '</td><td class="num">' + s.e + '</td><td class="num">' + s.liq + ' (' + pct(s.liq, s.n) + '%)</td></tr>').join('') +
      '</tbody></table></div></div>';
  }

  html += '<div class="secao"><div class="secao-cab"><h2>Conquistas</h2><span class="mudo pequeno">' + Object.keys(S.perfil.conq).length + ' de ' + CONQ.length + '</span></div><div class="conquistas">' +
    CONQ.map((c) => { const ok = S.perfil.conq[c.id]; return '<div class="conquista' + (ok ? '' : ' bloqueada') + '"><div class="ic">' + esc(c.ic) + '</div><b>' + esc(c.nome) + '</b><span>' + esc(c.desc) + '</span></div>'; }).join('') +
    '</div></div>';
  document.getElementById('vista-progresso').innerHTML = html;
}
function mapaCalor() {
  const hoje = HOJE();
  const semanas = 16;
  const ini = hoje - diaSemana(isoDeNum(hoje)) - (semanas - 1) * 7;
  let cells = '';
  for (let n = ini; n <= hoje; n++) {
    const iso = isoDeNum(n);
    const d = S.perfil.dias[iso];
    const r = d ? d.r : 0;
    const nivel = r === 0 ? 0 : r < 10 ? 1 : r < 25 ? 2 : r < 50 ? 3 : 4;
    cells += '<i data-n="' + nivel + '"' + (n === hoje ? ' class="hoje"' : '') + ' data-dica="' + esc(fmtData(iso, { day: '2-digit', month: '2-digit' }) + ': ' + pl(r, 'item', 'itens')) + '" aria-label="' + esc(iso + ': ' + r + ' itens') + '"></i>';
  }
  return '<div class="calor-env"><div class="calor" role="img" aria-label="Itens respondidos por dia nas últimas 16 semanas">' + cells + '</div></div>' +
    '<div class="calor-leg">menos <i style="background:var(--calor-0)"></i><i style="background:var(--calor-1)"></i><i style="background:var(--calor-2)"></i><i style="background:var(--calor-3)"></i><i style="background:var(--calor-4)"></i> mais · 1–9, 10–24, 25–49, 50+ itens</div>';
}

/* ================= Plano ================= */
const STATUS_CICLO = { nao: 'andamento', andamento: 'concluido', concluido: 'nao' };
const STATUS_ROT = { nao: 'Não iniciado', andamento: 'Em andamento', concluido: 'Concluído' };
function renderPlano() {
  const h = hojeISO();
  const ctx = contextoHoje();
  if (UI.faseAberta === null) UI.faseAberta = ctx.tipo === 'dia' ? ctx.dia.fase : ctx.tipo === 'folga' ? ctx.prox.fase : 'f5';
  let html = (D.cronograma.doc ? '<p class="pequeno"><a href="' + esc(D.cronograma.doc) + '" target="_blank" rel="noopener">Abrir o Plano de Estudos completo (doc)</a></p>' : '') +
    '<div class="secao"><div class="secao-cab"><h2>Cronograma diário</h2><span class="mudo pequeno">' + DIAS.filter((d) => S.perfil.feitos[d.data]).length + ' de ' + DIAS.length + ' sessões feitas</span></div>';
  for (const f of D.cronograma.fases) {
    const dias = DIAS.filter((d) => d.fase === f.id);
    const feitos = dias.filter((d) => S.perfil.feitos[d.data]).length;
    const aberto = UI.faseAberta === f.id;
    html += '<div class="fase"><button class="fase-cab" data-acao="fase" data-fase="' + f.id + '" aria-expanded="' + aberto + '"><span class="t"><b>' + esc(f.titulo) + ': ' + esc(f.subtitulo) + '</b><span>' + esc(f.periodo) + '</span></span><span class="mono pequeno mudo">' + feitos + '/' + dias.length + '</span><span class="seta">›</span></button>';
    if (aberto) {
      html += '<div class="fase-corpo">';
      for (const s of f.semanas) {
        html += '<div class="semana-tit">' + esc(s.titulo) + ' · ' + esc(s.periodo) + '</div>';
        for (const d of s.dias) {
          const feito = !!S.perfil.feitos[d.data];
          html += '<div class="dia-linha' + (d.data === h ? ' hoje' : d.data < h ? ' passado' : '') + '">' +
            '<div class="data-sel"><b>' + d.data.slice(8) + '</b><span>' + esc(fmtData(d.data, { weekday: 'short' }).replace('.', '')) + '</span></div>' +
            '<div class="dia-txt"><span>' + esc(d.atividade) + '</span><div class="dia-meta"><span class="selo mono">' + esc(d.duracao) + '</span>' +
            '<button class="btn pequeno" data-acao="iniciar-dia" data-dia="' + d.data + '">' + esc(d.modo === 'revisao' ? 'Revisar' : d.modo === 'simulado' ? 'Simulado' : 'Treinar') + '</button></div></div>' +
            '<div class="dia-check"><input type="checkbox" data-acao="dia-feito" data-dia="' + d.data + '"' + (feito ? ' checked' : '') + ' aria-label="Marcar ' + esc(d.data) + ' como feito"></div></div>';
        }
        if (s.nota) html += '<p class="pequeno mudo">' + esc(s.nota) + '</p>';
      }
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div>';

  html += '<div class="cartao"><h2>Peso por disciplina</h2><div class="tabela-env"><table class="tabela"><tbody>' +
    DISC.map((d) => '<tr><td>' + esc(d.nome) + '</td><td style="text-align:right"><span class="selo' + (d.peso === 'MÁXIMO' ? ' p1' : d.peso === 'ALTO' ? ' p2' : '') + '">' + esc(d.peso) + '</span></td></tr>').join('') +
    '</tbody></table></div><p class="pequeno mudo">Ordem de estudo, não percentual de prova.</p></div>';

  html += '<div class="cartao"><div class="secao-cab"><h2>Status dos blocos</h2><span class="mudo pequeno">Toque no status para mudar</span></div><div class="tabela-env"><table class="tabela"><thead><tr><th>Bloco</th><th>Domínio</th><th>Status</th></tr></thead><tbody>';
  for (const b of BLOCOS.slice().sort((a, b2) => a.prioridade - b2.prioridade)) {
    const st = S.perfil.status[b.id] || 'nao';
    const dmn = dominioBloco(b.id);
    html += '<tr><td>' + esc(b.nome) + '<br><span class="pequeno mudo">' + esc(b.dispositivos) + '</span></td><td class="num">' + (dmn === null ? '—' : Math.round(dmn * 100) + '%') + '</td>' +
      '<td><button class="selo status-btn' + (st === 'concluido' ? ' ok' : st === 'andamento' ? ' p2' : '') + '" data-acao="status" data-bloco="' + b.id + '">' + STATUS_ROT[st] + '</button></td></tr>';
  }
  html += '</tbody></table></div></div>';

  const pend = BLOCOS.filter((b) => b.aguardando);
  html += '<div class="cartao"><h2>Textos que faltam</h2><p class="mudo">Cada texto colado na conversa com o Claude vira um bloco novo de questões conferidas contra a letra da norma.</p><ul>' +
    pend.map((b) => '<li>' + esc(b.aguardando) + '</li>').join('') + '</ul></div>';
  document.getElementById('vista-plano').innerHTML = html;
}

/* ================= Ajustes ================= */
function folhaAjustes() {
  const metas = [10, 20, 30, 40, 60];
  abrirFolha('<div class="folha-cab"><h2>Ajustes</h2><button class="btn pequeno" data-acao="fechar-folha">Fechar</button></div>' +
    '<div class="campo"><span class="rot">Meta diária de itens</span><div class="chips">' + metas.map((m) => '<button class="chip" data-acao="meta" data-meta="' + m + '" aria-pressed="' + (S.perfil.meta === m) + '">' + m + '</button>').join('') + '</div>' +
    '<p class="pequeno mudo">Dia com 10 ou mais itens conta para a sequência. Domingo sem estudo não quebra a sequência.</p></div>' +
    '<div class="campo"><span class="rot">Onde o progresso fica</span><p class="pequeno">' + (Store.modo === 'nuvem' ? 'Na sua conta, dentro deste painel. Só você vê o seu progresso.' : 'Neste navegador. Abra o painel logado no claude.ai para salvar na conta.') + '</p></div>' +
    '<div class="campo"><span class="rot">Banco de questões</span><p class="pequeno mudo">' + Q.length + ' itens · versão ' + esc(D.versao) + '</p></div>' +
    '<div class="campo"><span class="rot">Recomeçar do zero</span><p class="pequeno mudo">Apaga XP, respostas, sequência e simulados.</p><div id="zona-zerar"><button class="btn" data-acao="zerar">Zerar progresso</button></div></div>', 'Ajustes');
}

/* ================= Navegação e render ================= */
const VISTAS = ['hoje', 'treinar', 'lei', 'progresso', 'plano'];
function ir(v) {
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
  ({ hoje: renderHoje, treinar: renderTreinar, lei: renderLei, progresso: renderProgresso, plano: renderPlano })[UI.vista]();
  if (sessao) renderSessao();
}

/* ================= Eventos ================= */
document.addEventListener('click', (ev) => {
  const alvo = ev.target.closest('[data-acao]');
  if (!alvo) {
    if (ev.target.id === 'folha') fecharFolha();
    return;
  }
  const a = alvo.dataset.acao;
  if (alvo.tagName === 'INPUT') return;
  switch (a) {
    case 'ir': ir(alvo.dataset.vista); break;
    case 'config': folhaAjustes(); break;
    case 'iniciar-dia': iniciarDia(alvo.dataset.dia); break;
    case 'iniciar-revisao': iniciarSessao({ modo: 'revisao', n: 30 }); break;
    case 'abrir-modo': UI.modo = alvo.dataset.modo; ir('treinar'); break;
    case 'relampago': iniciarSessao({ modo: 'relampago', blocos: (alvo.dataset.blocos || '').split(',').filter(Boolean) }); break;
    case 'set-modo': UI.modo = alvo.dataset.modo; salvarUI(); renderTreinar(); break;
    case 'set-n': UI.n = Number(alvo.dataset.n); salvarUI(); renderTreinar(); break;
    case 'set-filtro': UI.filtro = alvo.dataset.filtro; salvarUI(); renderTreinar(); break;
    case 'preset': {
      const p = alvo.dataset.preset;
      const comQ = BLOCOS.filter((b) => (POR_BLOCO.get(b.id) || []).length);
      if (p === 'p1') UI.blocos = ['lgpd-17-22', 'lgpd-52-54', 'lgpd-55', 'lgpd-33-36'];
      else if (p === 'lgpd') UI.blocos = comQ.filter((b) => b.disciplina === 'lgpd').map((b) => b.id);
      else if (p === 'tudo') UI.blocos = comQ.map((b) => b.id);
      else UI.blocos = [];
      salvarUI(); renderTreinar(); break;
    }
    case 'comecar': comecarConfigurado(); break;
    case 'responder': responder(alvo.dataset.r); break;
    case 'proximo': proximo(); break;
    case 'anterior': if (sessao && sessao.i > 0) { sessao.i--; renderSessao(); } break;
    case 'ir-item': if (sessao) { sessao.i = Number(alvo.dataset.i); renderSessao(); } break;
    case 'entregar': if (sessao) { sessao.confirmar = 'entregar'; renderSessao(); document.getElementById('sessao').scrollTop = 0; } break;
    case 'confirmar-entrega': if (sessao) { sessao.confirmar = null; finalizar(); } break;
    case 'cancelar-conf': if (sessao) { sessao.confirmar = null; renderSessao(); } break;
    case 'sair-sessao':
      if (!sessao) break;
      if (sessao.fim || (!Object.keys(sessao.resp).length)) fecharSessao();
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
    case 'abrir-art': UI.artSel = alvo.dataset.art; marcarLido(UI.artSel); if (UI.vista !== 'lei') ir('lei'); else { renderLei(); window.scrollTo(0, 0); } break;
    case 'nav-art': if (alvo.dataset.art) { UI.artSel = alvo.dataset.art; marcarLido(UI.artSel); renderLei(); window.scrollTo(0, 0); } break;
    case 'voltar-lei': UI.artSel = null; renderLei(); break;
    case 'destaque': UI.destaque = alvo.dataset.d; salvarUI(); renderLei(); break;
    case 'treinar-art': {
      const ids = (POR_ART.get(alvo.dataset.art) || []).map((q) => q.id);
      iniciarSessao({ modo: 'treino', ids: embaralhar(ids), titulo: rotuloArt(alvo.dataset.art) + ' da LGPD' });
      break;
    }
    case 'fase': UI.faseAberta = UI.faseAberta === alvo.dataset.fase ? '' : alvo.dataset.fase; renderPlano(); break;
    case 'status': {
      const b = alvo.dataset.bloco;
      S.perfil.status[b] = STATUS_CICLO[S.perfil.status[b] || 'nao'];
      Store.salvar('perfil'); renderPlano(); break;
    }
    case 'meta': S.perfil.meta = Number(alvo.dataset.meta); Store.salvar('perfil'); folhaAjustes(); renderTudo(); break;
    case 'zerar':
      document.getElementById('zona-zerar').innerHTML = '<p><b>Tem certeza?</b> Não dá para desfazer.</p><div class="linha-btns"><button class="btn primario" data-acao="confirmar-zerar">Apagar tudo</button><button class="btn" data-acao="config">Cancelar</button></div>';
      break;
    case 'confirmar-zerar':
      S.perfil = Object.assign(perfilPadrao(), { status: S.perfil.status, meta: S.perfil.meta });
      S.itens = {}; S.simulados = [];
      Store.salvar('perfil', 'itens', 'simulados');
      fecharFolha(); renderTudo(); avisar('0', 'Progresso zerado', 'Os status dos blocos foram mantidos.');
      break;
    default: break;
  }
});
document.addEventListener('change', (ev) => {
  const alvo = ev.target.closest('[data-acao]');
  if (!alvo) return;
  const a = alvo.dataset.acao;
  if (a === 'toggle-bloco') {
    const b = alvo.dataset.bloco;
    const set = new Set(UI.blocos);
    if (alvo.checked) set.add(b); else set.delete(b);
    UI.blocos = BLOCOS.map((x) => x.id).filter((id) => set.has(id));
    salvarUI(); renderTreinar();
  } else if (a === 'duvida' && sessao) {
    const id = sessao.ids[sessao.i];
    sessao.duv[id] = alvo.checked;
  } else if (a === 'dia-feito') {
    if (alvo.checked) S.perfil.feitos[alvo.dataset.dia] = 1; else delete S.perfil.feitos[alvo.dataset.dia];
    Store.salvar('perfil'); renderPlano();
  }
});
document.addEventListener('input', (ev) => {
  if (ev.target.id === 'busca-lei') {
    UI.busca = ev.target.value;
    const pos = ev.target.selectionStart;
    renderLei();
    const novo = document.getElementById('busca-lei');
    if (novo) { novo.focus(); try { novo.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
  }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    if (!document.getElementById('folha').hidden) { fecharFolha(); return; }
  }
  if (!sessao || sessao.fim || sessao.confirmar) return;
  if (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName) && ev.target.type !== 'checkbox') return;
  if (!document.getElementById('folha').hidden) return;
  const k = ev.key.toLowerCase();
  if (sessao.revelado) {
    if (k === 'enter' || k === ' ') { ev.preventDefault(); proximo(); }
    return;
  }
  if (k === 'c') responder('C');
  else if (k === 'e') responder('E');
  else if (k === 'b' && sessao.modo === 'simulado') responder('B');
  else if (k === 'd' && sessao.modo !== 'relampago') { const id = sessao.ids[sessao.i]; sessao.duv[id] = !sessao.duv[id]; renderSessao(); }
  else if (sessao.modo === 'simulado' && k === 'arrowright') proximo();
  else if (sessao.modo === 'simulado' && k === 'arrowleft' && sessao.i > 0) { sessao.i--; renderSessao(); }
});
// Dica flutuante do mapa de calor
document.addEventListener('pointerover', (ev) => {
  const c = ev.target.closest && ev.target.closest('[data-dica]');
  let dica = document.getElementById('dica');
  if (!c) { if (dica) dica.remove(); return; }
  if (!dica) { dica = document.createElement('div'); dica.id = 'dica'; dica.className = 'dica'; document.body.appendChild(dica); }
  dica.textContent = c.dataset.dica;
  const r = c.getBoundingClientRect();
  dica.style.left = Math.max(8, Math.min(window.innerWidth - 160, r.left - 30)) + 'px';
  dica.style.top = (r.top - 32) + 'px';
});
document.addEventListener('visibilitychange', () => { if (document.hidden) Store.descarregar(); });

/* ================= Início ================= */
function iniciar(dadosQuentes) {
  if (dadosQuentes && dadosQuentes.sessao) {
    sessao = dadosQuentes.sessao;
    if (dadosQuentes.ui) Object.assign(UI, dadosQuentes.ui);
  }
  renderTudo();
  if (sessao) abrirSessao();
  Store.iniciar();
}
const hot = window.claude && window.claude.hot;
if (hot && typeof hot.snapshot === 'function') {
  try { hot.snapshot(() => ({ sessao: sessao && !sessao.fim ? sessao : null, ui: { vista: UI.vista, artSel: UI.artSel } })); } catch (e) { /* opcional */ }
}
if (hot && typeof hot.ready === 'function') hot.ready(iniciar);
else iniciar(hot && hot.data ? hot.data : {});
})();
