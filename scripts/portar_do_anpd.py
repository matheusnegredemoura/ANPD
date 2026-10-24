# Leva do Painel ANPD para o Painel TCU: botão Voltar do celular, modo foco, botão da folha de véspera
# e metas pelo ritmo, ancoradas no plano até a prova.
# Uso: python3 scripts/portar_do_anpd.py "saida/Painel TCU.html"  (altera o arquivo no lugar; roda uma vez só)
import sys

caminho = sys.argv[1]
t = open(caminho, encoding='utf-8').read()


def trocar(velho, novo):
    global t
    n = t.count(velho)
    assert n == 1, f'esperava 1 ocorrência, achei {n}: {velho[:80]!r}'
    t = t.replace(velho, novo)


# ---------- 1. Botão Voltar: fecha a folha ou a sessão em vez de sair do painel ----------
trocar("""  renderSessao();
  el.scrollTop = 0;
}
function fecharSessao(guardar = true) {""", """  renderSessao();
  el.scrollTop = 0;
  sincronizarHistorico();
}
function fecharSessao(guardar = true) {""")
trocar("""  Store.descarregar();
  renderTudo();
}
function decorrido()""", """  Store.descarregar();
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
function decorrido()""")
trocar("""  if (b) b.focus();
}
function fecharFolha() { const f = document.getElementById('folha'); f.hidden = true; f.innerHTML = ''; UI.folhaAula = null; }""",
       """  if (b) b.focus();
  sincronizarHistorico();
}
function fecharFolha() { const f = document.getElementById('folha'); f.hidden = true; f.innerHTML = ''; UI.folhaAula = null; sincronizarHistorico(); }""")

# ---------- 2. Modo foco: esconde a arena e o combo durante a sessão ----------
trocar("'cadFiltro', 'aulaFiltroDisc', 'aulaBusca'];", "'cadFiltro', 'aulaFiltroDisc', 'aulaBusca', 'foco'];")
trocar("  if (!sessao || sessao.modo === 'simulado') return '';", "  if (!sessao || sessao.modo === 'simulado' || UI.foco) return '';")
trocar("""    (sessao.modo !== 'simulado' && sessao.modo !== 'cards' && sessao.combo >= 2 ? '<span class="combo' + (sessao.revelado || sessao.flash ? ' pulso' : '') + '">combo ×' + sessao.combo + '</span>' : '') +""",
       """    (!UI.foco && sessao.modo !== 'simulado' && sessao.modo !== 'cards' && sessao.combo >= 2 ? '<span class="combo' + (sessao.revelado || sessao.flash ? ' pulso' : '') + '">combo ×' + sessao.combo + '</span>' : '') +
    '<button class="icone-btn" data-acao="foco" aria-pressed="' + !!UI.foco + '" aria-label="' + (UI.foco ? 'Mostrar a arena' : 'Modo foco: esconder a arena e o combo') + '" title="' + (UI.foco ? 'Modo foco ligado' : 'Modo foco desligado') + '"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg></button>' +""")
trocar("    case 'imprimir-folha-vespera': abrirFolhaVespera(); break;",
       "    case 'imprimir-folha-vespera': abrirFolhaVespera(); break;\n    case 'foco': UI.foco = !UI.foco; salvarUI(); renderSessao(); break;")

# ---------- 3. Botão da folha de véspera no caderno de erros (a ação já existia, sem botão) ----------
trocar("""  let html = '<div class="prosa"><h2>Caderno de Erros · As 4 Causas do Método</h2><p>Questão errada sem revisão vira o mesmo erro na prova. Classifique cada erro em uma das quatro causas do método e escreva uma regra de 1 linha para não repetir.</p></div>';""",
       """  let html = '<div class="prosa" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">' +
    '<div style="flex:1;min-width:260px"><h2>Caderno de Erros · As 4 Causas do Método</h2><p>Questão errada sem revisão vira o mesmo erro na prova. Classifique cada erro em uma das quatro causas do método e escreva uma regra de 1 linha para não repetir.</p></div>' +
    '<button class="btn pequeno primario" data-acao="imprimir-folha-vespera" style="align-self:flex-start;margin-top:4px">Folha de véspera</button>' +
    '</div>';""")

# ---------- 4. Metas: o maior entre o plano até a prova, o ritmo pessoal e a escolha em Ajustes ----------
trocar("""function ativo(iso) { const d = S.perfil.dias[iso]; return !!d && (d.r + (d.k || 0) / 2) >= MIN_DIA_ATIVO; }
""", """function ativo(iso) { const d = S.perfil.dias[iso]; return !!d && (d.r + (d.k || 0) / 2) >= MIN_DIA_ATIVO; }
// Ritmo pessoal: medianas dos dias de estudo das duas últimas semanas, sem contar hoje (itens respondidos, itens inéditos,
// artigos lidos e minutos de estudo; cada mediana só conta os dias em que aquilo aconteceu). Com menos de 5 dias de estudo
// não há ritmo e valem os valores fixos.
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
  };
  ritmoCache = { chave, v };
  return v;
}
const limitar = (x, min, max) => Math.min(max, Math.max(min, x));
// Plano: itens inéditos do banco divididos pelos dias até a prova, de 10 em 10 para cima. É o que o edital exige,
// e não cai quando o ritmo cai; o ritmo (90% da mediana) e a meta escolhida em Ajustes só servem de piso
function diasAteProva() { const p = D.cronograma && D.cronograma.prova; return p ? diaNum(p) - HOJE() : 0; }
function metaPlano() {
  const dias = diasAteProva();
  if (dias <= 0) return null;
  const ineditos = Q.filter((q) => !S.itens[q.id]).length;
  return ineditos ? limitar(Math.ceil(ineditos / dias / 10) * 10, 10, 200) : null;
}
function metaAuto() { const r = ritmo(); return r && r.r ? limitar(Math.round((r.r * 0.9) / 10) * 10, 20, 200) : null; }
function metaDia() { return Math.min(200, Math.max(S.perfil.meta || 30, metaPlano() || 0, metaAuto() || 0)); }
function metaNovas() { const r = ritmo(); return Math.max(metaPlano() || 0, r && r.ni ? limitar(Math.round(r.ni / 10) * 10, 20, 80) : 20); }
function metaMais() { return Math.round((metaDia() * 1.5) / 10) * 10; }
function metaLei() { const r = ritmo(); return r && r.a ? limitar(r.a, 5, 12) : 5; }
function metaArtigos() { const r = ritmo(); return r && r.a ? limitar(r.a, 6, 12) : 6; }
function metaMin60() { const r = ritmo(); return r && r.min ? limitar(Math.round(r.min / 15) * 15, 60, 180) : 60; }
function fmtMin(m) { return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h' + (m % 60 ? String(m % 60).padStart(2, '0') : ''); }
""")
trocar("  if (!d.metaOk && d.r >= S.perfil.meta) {", "  if (!d.metaOk && d.r >= metaDia()) {")
trocar("'</div></div>' + anel(d.r, S.perfil.meta) +", "'</div></div>' + anel(d.r, metaDia()) +")
trocar("  const metaLeitura = arts.length ? Math.min(arts.length, 6) : 0;", "  const metaLeitura = arts.length ? Math.min(arts.length, metaArtigos()) : 0;")
# Missões: texto e meta passam a ser funções; valM aceita os dois formatos
trocar("  { id: 'q30', txt: 'Responder 30 itens', xp: 30, meta: 30, val: (d) => d.r || 0 },",
       "  { id: 'q30', txt: () => 'Responder ' + metaDia() + ' itens', xp: 30, meta: () => metaDia(), val: (d) => d.r || 0 },")
trocar("  { id: 'q60', txt: 'Responder 60 itens', xp: 60, meta: 60, val: (d) => d.r || 0 },",
       "  { id: 'q60', txt: () => 'Responder ' + metaMais() + ' itens', xp: 60, meta: () => metaMais(), val: (d) => d.r || 0 },")
trocar("  { id: 'novas', txt: 'Responder 20 itens inéditos', xp: 40, meta: 20, val: (d) => d.ni || 0 },",
       "  { id: 'novas', txt: () => 'Responder ' + metaNovas() + ' itens inéditos', xp: 40, meta: () => metaNovas(), val: (d) => d.ni || 0 },")
trocar("  { id: 'lei5', txt: 'Ler 5 artigos da lei seca', xp: 30, meta: 5, val: (d) => (d.a || []).length },",
       "  { id: 'lei5', txt: () => 'Ler ' + metaLei() + ' artigos da lei seca', xp: 30, meta: () => metaLei(), val: (d) => (d.a || []).length },")
trocar("  { id: 'tempo60', txt: 'Estudar 1 hora', xp: 40, meta: 60, val: (d) => Math.floor(segundosEstudo(d) / 60) },",
       "  { id: 'tempo60', txt: () => 'Estudar ' + fmtMin(metaMin60()), xp: 40, meta: () => metaMin60(), val: (d) => Math.floor(segundosEstudo(d) / 60) },")
trocar("const MI = new Map(MISSOES.map((m) => [m.id, m]));",
       "const MI = new Map(MISSOES.map((m) => [m.id, m]));\nfunction valM(v) { return typeof v === 'function' ? v() : v; }")
trocar("    if (!x || mh.ok[id] || x.val(d) < x.meta) continue;", "    if (!x || mh.ok[id] || x.val(d) < valM(x.meta)) continue;")
trocar("    avisar('★', 'Missão cumprida', x.txt + ' · +' + x.xp + ' XP');", "    avisar('★', 'Missão cumprida', valM(x.txt) + ' · +' + x.xp + ' XP');")
trocar("    const v = x.val(d), ok = !!mh.ok[id], f = ok ? 1 : x.fr ? x.fr(d) : Math.min(1, v / x.meta);",
       "    const v = x.val(d), ok = !!mh.ok[id], meta = valM(x.meta), f = ok ? 1 : x.fr ? x.fr(d) : Math.min(1, v / meta);")
trocar("<div class=\"m-txt\"><b>' + esc(x.txt) + '</b>", "<div class=\"m-txt\"><b>' + esc(valM(x.txt)) + '</b>")
trocar("x.fr ? (d.r || 0) + '/20' : Math.min(v, x.meta) + '/' + x.meta)", "x.fr ? (d.r || 0) + '/20' : Math.min(v, meta) + '/' + meta)")
# Ajustes: a escolha vira piso, e a tela mostra de onde vem a meta de hoje
trocar("""'" aria-pressed="' + (S.perfil.meta === m) + '">' + m + '</button>').join('') + '</div></div>' +""",
       """'" aria-pressed="' + (S.perfil.meta === m) + '">' + m + '</button>').join('') + '</div>' +
      '<p class="pequeno mudo">Meta de hoje: <b>' + metaDia() + ' itens</b>, o maior entre o plano (' + (metaPlano() ? metaPlano() + ' por dia para ver os inéditos até ' + esc(D.cronograma.prova.split('-').reverse().join('/')) : 'sem data de prova') +
      '), o seu ritmo (' + (metaAuto() ? metaAuto() : 'com menos de 5 dias de estudo, ainda não medido') + ') e a escolha acima, que vale como piso.</p></div>' +""")

open(caminho, 'w', encoding='utf-8').write(t)
print('ok')
