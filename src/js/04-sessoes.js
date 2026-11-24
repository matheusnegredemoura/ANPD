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
    // quando os textos ocupam vagas), depois os do banco. No desafio, os do banco que ficam são os primeiros da ordem do
    // desafio (certos e errados alternados, a armadilha em que mais se erra à frente), não os que o sorteio pôs antes
    const semTexto = itens.filter((q) => q.ap == null), vistosST = semTexto.filter((q) => rec(q.id)), novosST = semTexto.filter((q) => !rec(q.id));
    const vagas = Math.max(0, itens.length - total), autST = novosST.filter((q) => !q.o);
    const ficam = new Set(vistosST.concat(novosST.filter((q) => q.o), desafioAutoral() ? ordemDesafio(autST) : autST).slice(0, Math.max(vagas, vistosST.length)).map((q) => q.id));
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
  // Sessão encerrada deixa uma marca (sem itens) em vez de sumir: na junção com o outro aparelho, a pausa velha de lá
  // não volta, porque a marca é mais nova
  if (sessao.fim || sessao.desfecho || (!sim && !faltam.length)) pausas[k] = pausaEncerrada();
  else {
    pausas[k] = Object.assign({ modo: sessao.modo, titulo: sessao.titulo, dia: sessao.dia, data: hojeISO(), ts: Date.now(), st: sessao.st || undefined, tipoSubtema: sessao.tipoSubtema || undefined }, sim
      ? { ids: sessao.ids, resp: sessao.resp, duv: sessao.duv, i: sessao.i, gasto: Math.round(decorrido()), limite: sessao.limite, total: sessao.ids.length, prova: sessao.prova || undefined }
      : { ids: faltam, feitas: (sessao.feitasAntes || 0) + sessao.ids.length - faltam.length, total: sessao.totalOrig || sessao.ids.length },
      sessao.batalha ? { cor: sessao.coracoes, dano: sessao.danoTotal || 0, crit: sessao.criticos || 0, cmb: sessao.comboMax, per: sessao.perdas || 0, def: sessao.defesas || 0 } : {});
  }
  const recentes = Object.entries(pausas).filter(([, v]) => v && v.data && HOJE() - diaNum(v.data) <= PAUSA_DIAS);
  const manter = new Set(recentes.filter(([, v]) => v.ids).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0)).slice(0, PAUSA_MAX)
    .concat(recentes.filter(([, v]) => !v.ids)).map(([x]) => x));
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
  sessao = novaSessao({ modo: p.modo, titulo: p.titulo, dia: p.dia, chave: k, prova: p.prova, st: p.st, tipoSubtema: p.tipoSubtema }, p.ids);
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
function pausaEncerrada() { return { data: hojeISO(), ts: Date.now(), fim: 1 }; }
function descartarPausa(k) { if (S.perfil.pausas && S.perfil.pausas[k]) { S.perfil.pausas[k] = pausaEncerrada(); Store.salvar('perfil'); } }
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
    const todosVenc = cardsVencidos(cfg.blocos), venc = todosVenc.slice(0, REV_MAX);
    const novos = cfg.soRevisao || todosVenc.length >= REV_MAX ? [] : cardsNovos(cfg.blocos).slice(0, cfg.novos == null ? 20 : cfg.novos);
    const ids = embaralhar(venc.map((c) => c.id)).concat(novos.map((c) => c.id));
    if (!ids.length) {
      avisar('C', 'Nada para revisar agora', 'Escolha outros baralhos de cards.');
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
  else if (cfg.cotas) itens = selecionarProva(cfg.n || 60, cfg.blocos);
  else if (cfg.modo === 'relampago') itens = embaralhar(poolDe(cfg.blocos).filter((q) => !q.al));
  else itens = selecionar(poolDe(cfg.blocos, cfg.banca), cfg.n || 20, cfg.filtro || 'mistas');
  if (!itens.length) { avisar('!', 'Sem itens', 'Nenhuma questão disponível com esse filtro.'); return; }
  if (cfg.modo !== 'relampago') itens = emBlocosDeTexto(itens, !cfg.ids && !cfg.prova && !cfg.cotas && !cfg.intercalado && cfg.modo !== 'revisao', cfg.blocos && cfg.blocos.length && !cfg.prova && !cfg.cotas && !cfg.intercalado ? new Set(cfg.blocos) : null);
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
// Enquanto um diálogo está aberto, o fundo fica inerte: sem Tab, sem leitor de tela, sem clique.
// Sem isto o aria-modal="true" de #sessao e #folha é promessa falsa: o Tab saía do diálogo e caía
// nos botões da tela de trás, escondidos atrás dele.
function trancarFundo() {
  const temSessao = !document.getElementById('sessao').hidden;
  const temFolha = !document.getElementById('folha').hidden;
  for (const id of ['topo', 'conteudo', 'abas']) { const e = document.getElementById(id); if (e) e.inert = temSessao || temFolha; }
  document.getElementById('sessao').inert = temSessao && temFolha;
}
function focarDialogo(el) {
  if (!el.hasAttribute('tabindex')) el.tabIndex = -1;
  const alvo = el.querySelector('button, [href], input, select, textarea') || el;
  try { alvo.focus({ preventScroll: true }); } catch (e) { /* sem foco: segue sem travar */ }
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
  trancarFundo();
  focarDialogo(el);
}
// Trocar de sessão (Refazer erros, treinar a armadilha do resultado) reaproveita a entrada do histórico. Fechar e
// abrir em sequência fazia history.back(), e o popstate, que chega depois, fechava a sessão recém-aberta
function trocarSessao(opts) {
  if (sessao) fecharSessao(true, true);
  iniciarSessao(opts);
  sincronizarHistorico();
}
function fecharSessao(guardar = true, manterHistorico = false) {
  if (guardar) guardarSessaoAberta();
  clearInterval(relogioTimer);
  sessao = null;
  const el = document.getElementById('sessao');
  el.hidden = true;
  el.innerHTML = '';
  document.body.style.overflow = '';
  Store.descarregar();
  renderTudo();
  if (!manterHistorico) sincronizarHistorico();
  trancarFundo();
  // O gatilho foi reescrito por renderTudo; o foco volta para o conteúdo, que já tem tabindex="-1"
  const c = document.getElementById('conteudo');
  if (c) try { c.focus({ preventScroll: true }); } catch (e) { /* segue */ }
}
// Voltar do celular fecha a camada aberta (folha, depois sessão) em vez de sair do painel; a sessão fica guardada
let camadaNoHistorico = false;
// Voltas do histórico pedidas pelo próprio painel: o popstate delas chega depois e não deve fechar a camada que
// já tiver sido aberta nesse meio-tempo (fechar a folha e abrir um treino no mesmo toque)
let voltasDoPainel = 0;
function camadaAberta() { return !document.getElementById('folha').hidden || !document.getElementById('sessao').hidden; }
function sincronizarHistorico() {
  try {
    if (camadaAberta() && !camadaNoHistorico) { history.pushState({ camada: 1 }, ''); camadaNoHistorico = true; }
    else if (!camadaAberta() && camadaNoHistorico) { camadaNoHistorico = false; voltasDoPainel++; history.back(); }
  } catch (e) { /* histórico indisponível: fecha só pelo botão */ }
}
window.addEventListener('popstate', () => {
  if (voltasDoPainel) { voltasDoPainel--; return; }
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
  // Acerto repetido no mesmo dia (sem ser a virada logo depois do erro) vale 1 XP: o filtro "só as que já errei"
  // devolve o mesmo item quantas vezes se quiser, e o XP cheio a cada volta premiaria repetir, não aprender
  const repetidoHoje = ant && ant[0] >= 0 && ant[4] === HOJE() && !virada;
  const ok = registrar(q, resp, !!sessao.duv[id]);
  sessao.golpe = golpeRecente;
  sessao.cansaco = sessao.modo === 'relampago' ? null : avaliarCansaco();
  sessao.resp[id] = resp;
  let x = 0;
  if (ok) {
    sessao.combo++; sessao.comboMax = Math.max(sessao.comboMax, sessao.combo); x = xpAcerto(q, sessao.combo, sessao.modo);
    if (sessao.modo !== 'relampago' && caiuEmProva(q)) x = Math.round(x * 1.5);
    if (virada === 'plena') { x *= 2; sessao.viradas = (sessao.viradas || 0) + 1; const dv = diaLog(); dv.vr = (dv.vr || 0) + 1; } else if (virada) x += 4;
    else if (repetidoHoje) x = 1;
  } else sessao.combo = 0;
  sessao.virada = ok ? virada : null;
  efeitoBatalha(ok);
  if (sessao.golpe && sessao.golpe.vencido) sessao.golpeFinal = sessao.golpe;
  tocar(!ok ? 'erro' : sessao.golpe && sessao.golpe.vencido ? 'festa' : sessao.combo >= 5 && sessao.combo % 5 === 0 ? 'combo' : 'acerto');
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
  // A volta de um "Errei" no fim da sessão é reaprendizado: o card já está marcado para amanhã, e avaliá-lo de novo
  // cortaria a facilidade e somaria lapso e card revisado a cada volta, no mesmo dia. Também fica fora da retenção
  const volta = (sessao.repetidos[id] || 0) > 0 && sessao.ids.indexOf(id) < sessao.i;
  if (!volta) { avaliarCard(id, nota); sessao.notas[nota]++; }
  const x = volta ? 1 : nota === 1 ? 1 : 3;
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
  // A prática do subtema conta como tema estudado (o pré-teste, feito antes da aula, não)
  if (sessao.st && sessao.tipoSubtema !== 'pre') marcarEstudado(sessao.st);
  if (sessao.modo === 'simulado') {
    // pt: nota ponderada (cada item no seu peso); nr/cr: itens reais de prova respondidos e acertados
    let c = 0, e = 0, b = 0, xp = 0, eMc = 0, ni = 0, nc = 0, pt = 0, ptMax = 0, nr = 0, cr = 0;
    sessao.ids.forEach((id) => {
      const q = QI.get(id);
      const r = sessao.resp[id] || BRANCO;
      const novo = inedito(q), ant = rec(id);
      const ok = registrar(q, r, !!sessao.duv[id]);
      const w = pesoItem(q);
      // Virada no simulado conta para a missão como no treino (o registro acima já tira o item da lista de erros)
      if (ok && ant && ant[0] === 0 && ant[3] > 0 && ant[4] < HOJE()) { const dv = diaLog(); dv.vr = (dv.vr || 0) + 1; }
      ptMax += w;
      if (novo && r !== BRANCO) { ni++; if (ok) nc++; }
      if (q.o && r !== BRANCO) { nr++; if (ok) cr++; }
      if (r === BRANCO) b++; else if (ok) { c++; xp += xpAcerto(q, 0, 'simulado'); pt += w; } else { e++; if (q.al) eMc++; else pt -= w; }
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
    if (c + e) verificarRPG();
  }
  if (sessao.dia) {
    // Sessão de um dia anterior do plano: conta para a missão de encaixar pendências
    if ((/^\d{4}-\d{2}-\d{2}$/.test(sessao.dia) && sessao.dia < hojeISO() || /^rec:/.test(sessao.dia)) && !S.perfil.feitos[sessao.dia]) { const d = diaLog(); d.pd = (d.pd || 0) + 1; }
    S.perfil.feitos[sessao.dia] = 1;
    pendCache = null;
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
    if (!audioCtx || audioCtx.state === 'closed') audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state !== 'running') audioCtx.resume();
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
  // O recado de parar vem do avaliador de cansaço (os erros no que você já sabia); sem aviso, um dia muito longo ainda
  // merece o lembrete
  const pc = pontoCansaco();
  const longo = hoje.cz && hoje.cz.length ? '<p class="pequeno mudo">Hoje o avaliador viu sinais de cansaço a partir do item ' + hoje.cz[0] + (pc ? '; nos seus dias recentes, eles aparecem perto do item ' + pc : '') + '. Parar aqui e voltar amanhã costuma render mais do que esticar.</p>'
    : (hoje.r || 0) >= 150 ? '<p class="pequeno mudo">Hoje já são ' + hoje.r + ' itens. Depois de tanto tempo, o cansaço começa a pesar nos acertos; parar aqui e voltar amanhã costuma render mais do que esticar.</p>' : '';
  if (!linhas.length) return longo ? '<div class="cartao">' + longo + '</div>' : '';
  return '<div class="cartao ganhos"><h2>O que esta sessão rendeu</h2>' + linhas.join('') + longo + '</div>';
}
// Linha extra na tela da resposta: o artigo já cobrado em prova real (o acerto nele é crítico: XP e dano em dobro
// no chefão, 50% a mais de XP fora dele)
function extrasResposta(q) {
  const n = caiuEmProva(q);
  return n ? '<p class="extra-resp"><span aria-hidden="true">★</span> Já caiu em prova: ' + pl(n, 'item real', 'itens reais') + ' deste artigo no banco.</p>' : '';
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
    '<div class="status"><span class="pilula fogo' + (seq ? '' : ' apagado') + '" title="Dias seguidos de estudo (domingo, uma folga por semana e dia do plano recuperado não quebram)">' + iconeFogo() + seq + '</span>' +
    '<span class="pilula xp" title="Pontos de experiência">' + fmtNum(S.perfil.xp) + ' XP</span>' +
    '<button class="icone-btn" data-acao="tema-alternar" aria-label="' + (temaEscuroAtivo() ? 'Usar tema claro' : 'Usar modo noturno') + '" title="' + (temaEscuroAtivo() ? 'Tema claro' : 'Modo noturno') + '">' + (temaEscuroAtivo() ? iconeSol() : iconeLua()) + '</button>' +
    '<button class="icone-btn" data-acao="mais" data-sub="ajustes" aria-label="Ajustes">' + iconeEngrenagem() + '</button></div>';
}

