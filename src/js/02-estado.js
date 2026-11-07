/* ================= Estado ================= */
function perfilPadrao() {
  return { xp: 0, meta: 30, novosCards: 20, intercaladas: 30, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: hojeISO() };
}
const S = { perfil: perfilPadrao(), itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {} };
// Último golpe no chefão (a tela da resposta anima o dano) e pendências do plano já calculadas neste desenho da tela
let golpeRecente = null, pendCache = null;
const UI = Object.assign({ lei: 'lgpd', vista: 'hoje', modo: 'treino', n: 20, filtro: 'mistas', prova: 'blocos', blocos: P1.slice(), blocosCards: [], faseAberta: null, camadas: { cai: true, num: true, alerta: true, verbo: true, erro: true } }, lerLS(CHAVE_UI) || {});
UI.discTema = null; UI.discFase = null; UI.discAval = {}; UI.discNE = 0; UI.det = {};
UI.artSel = null; UI.busca = ''; UI.mais = 'menu'; UI.leiFila = null; UI.ranking = false; UI.filtroPesq = 'pendentes'; UI.buscaGloss = ''; UI.buscaQ = ''; UI.artInline = null;
if (!UI.camadas) UI.camadas = { cai: true, num: true, alerta: true, verbo: true, erro: true };
let sessao = null;
// Preferências que acompanham a conta (vão no documento do perfil), para não se perderem quando o navegador
// ou o app do Claude limpam o armazenamento local. A aba aberta (vista) fica só neste aparelho.
// stUltimo: o último subtema aberto, para a página de trilhas oferecer a volta a ele depois de sair do app
const CAMPOS_UI = ['modo', 'n', 'filtro', 'prova', 'blocos', 'blocosCards', 'camadas', 'lei', 'tema', 'som', 'foco', 'stUltimo'];
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
  if (a && b && a.sem === b.sem && a.bloco === b.bloco) {
    const dia = (a.dia || '') > (b.dia || '') ? a.dia : b.dia, dd = (x) => (x.dia === dia ? x.danoDia || 0 : 0);
    r.chefe = Object.assign({}, b, { vida: Math.min(a.vida, b.vida), vencido: b.vencido || a.vencido, item: b.item || a.item, dia, danoDia: Math.max(dd(a), dd(b)) });
  }
  // Chefões diferentes na mesma semana (cada aparelho sorteou um): fica o que já foi derrotado ou o mais ferido
  else if (a && b && a.sem === b.sem) r.chefe = a.vencido && !b.vencido ? a : b.vencido && !a.vencido ? b : a.vida / a.max < b.vida / b.max ? a : b;
  else if (a && b) r.chefe = a.sem > b.sem ? a : b;
  r.m = mesclarMapa(velho.m, novo.m, (x, y) => Object.assign({}, x, y, { ok: Object.assign({}, x.ok, y.ok), bau: x.bau || y.bau, item: y.item || x.item }));
  return r;
}
const CAMPOS_RESPOSTA = new Set(['r', 'c', 'e', 'b', 'k', 'n', 'nc', 'sq', 'ni', 'm', 'mc', 'mp', 'mpc', 'cz']);
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
  // Dia: o que vem das respostas e dos cards (contagens, sequência, cansaço) sai inteiro do lado com mais atividade,
  // para os números baterem entre si; o resto junta campo a campo: artigos lidos somados sem repetir, tempos e
  // contadores (XP, roteiro, atraso recuperado, viradas) pelo maior, marcas que valem num aparelho valem no outro
  p.dias = mesclarMapa(nuvem.dias, local.dias, (a, b) => {
    if (!a || !b) return a || b;
    const base = atividade(b) > atividade(a) ? b : a, outro = base === b ? a : b, r = Object.assign({}, outro, base);
    for (const k of Object.keys(outro)) {
      if (CAMPOS_RESPOSTA.has(k)) continue;
      const x = base[k], y = outro[k];
      if (Array.isArray(x) || Array.isArray(y)) r[k] = [...new Set([].concat(x || [], y || []))];
      else if (typeof x === 'number' || typeof y === 'number') r[k] = Math.max(num(x), num(y));
      else if (x && y && typeof x === 'object') r[k] = mesclarMapa(x, y, (u, v) => Math.max(num(u), num(v)));
      else r[k] = x || y;
    }
    return r;
  });
  p.conq = Object.assign({}, velho.conq, novo.conq);
  // Dia, aula ou discursiva dados como feitos num aparelho continuam feitos no outro
  p.feitos = Object.assign({}, velho.feitos, novo.feitos);
  p.recuperados = Object.assign({}, velho.recuperados, novo.recuperados);
  // Sessões pausadas: cada uma fica com o registro mais recente dos dois aparelhos (um simulado pela metade num deles
  // não some porque o outro gravou depois); a marca de encerrada, mais nova, vence a pausa antiga
  p.pausas = mesclarMapa(velho.pausas, novo.pausas, (a, b) => (num(b && b.ts) >= num(a && a.ts) ? b : a));
  p.cad = mesclarCad(velho.cad, novo.cad);
  p.lidos = mesclarMapa(nuvem.lidos, local.lidos, (a, b) => (b < a ? b : a));
  p.trilha = mesclarMapa(nuvem.trilha, local.trilha, (a, b) => (b < a ? b : a));
  p.recordes = mesclarMapa(nuvem.recordes, local.recordes, (a, b) => Math.max(num(a), num(b)));
  p.criado = [nuvem.criado, local.criado].filter(Boolean).sort()[0] || hojeISO();
  if (!p.ui && velho.ui) p.ui = velho.ui;
  p.rpg = mesclarRPG(velho.rpg, novo.rpg);
  return p;
}
// Fase, degrau e metas da semana marcadas em qualquer aparelho
function mesclarCad(velho, novo) {
  if (!velho && !novo) return undefined;
  velho = velho || {}; novo = novo || {};
  const r = Object.assign({}, velho, novo);
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
  modo: 'local', dev: Math.random().toString(36).slice(2, 10), refs: {}, timer: {}, gravando: {}, fila: {}, ultimoT: {}, tGravou: {}, erro: null,
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
    const antes = this.diag.navegador;
    this.diag.navegador = ok ? 'ok' : 'bloqueado';
    if (antes !== this.diag.navegador && typeof atualizarRodapeSync === 'function') atualizarRodapeSync();
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
    // O que estava para ser gravado daqui era sobre a cópia antiga: gravá-lo depois desfaria a adoção
    clearTimeout(this.timer[n]); this.timer[n] = null;
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
          else if (epNuvem > epLocal) { if (d && d.dados) this.aplicar(n, d); else { this.definir(n, {}); this.guardarLocal(); } }
          else if (!d || !d.dados) this.gravar(n);
          else this.mesclar(n, d, this.localReal && !!this.tLocal[n] && !!d.t && this.tLocal[n] > d.t);
        });
      }
      DOCS.forEach((n) => {
        this.refs[n].onSnapshot((s) => {
          const d = lerDoc(s);
          if (!d || d.dev === this.dev) return;
          // Com gravação pendente aqui, ou recém-feita (a do outro aparelho pode ter saído antes de ver a daqui), junta as
          // duas; sem nada recente, adota a do outro aparelho
          const recente = Date.now() - (this.tGravou[n] || 0) < 15000;
          // Cópia de antes de zerar ou restaurar (época mais velha que a daqui) chegando atrasada: fica de fora
          if ((d.ep || 0) < (S.perfil.ep || 0)) return;
          if ((this.timer[n] || this.gravando[n] || recente) && (d.ep || 0) === (S.perfil.ep || 0)) this.mesclar(n, d, true); else this.aplicar(n, d);
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
      this.tGravou[n] = Date.now();
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

