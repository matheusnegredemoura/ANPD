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
      '<div class="linha-btns"><button class="btn primario" data-acao="simulado-oficial-120">' + esc(rotuloPausa('sim:prova', 'Começar (' + TOTAL_PROVA + ' itens · ' + duracaoProva() + ')')) + '</button></div>' +
      '</div>' +
      '<div class="cartao">' +
      '<div class="secao-cab"><h2>Provas recentes do Cebraspe</h2><span class="selo mono">Gabarito oficial</span></div>' +
      '<p class="pequeno mudo">Os itens destas provas que estão no banco, com o tempo proporcional ao da prova. Ficaram de fora os que dependem de texto da prova que não veio junto. A AGEPAR 2026 é de múltipla escolha e ainda está com o gabarito preliminar.</p>' +
      '<div class="linha-btns">' +
      PROVAS_RECENTES.map(([pref, nome, min]) => '<button class="btn pequeno" data-acao="simulado-prova" data-pref="' + pref + '" data-nome="' + esc(nome) + '" data-min="' + min + '">' + esc(rotuloPausa('prova:' + pref, nome + ' · ' + pl(Q.filter((q) => q.id.startsWith(pref)).length, 'item', 'itens'))) + '</button>').join('') +
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
  const conferidos = REAIS.filter(gabConferido).length, prelim = REAIS.filter((q) => /preliminar/.test(q.pv)).length;
  const nIades = REAIS.filter((q) => bancaDe(q) === 'IADES').length;
  if (REAIS.length) html += '<div class="cartao reais"><h2>Itens reais de prova</h2><p class="mudo pequeno">' + REAIS.length + ' itens de provas de 2021 a 2026, com comentário: ' + (REAIS.length - conferidos - prelim) + ' com gabarito oficial definitivo, ' + conferidos + ' avulsos, com o gabarito conferido na lei ou no texto da prova' + (prelim ? ', e ' + prelim + ' com o gabarito preliminar da banca, conferido na lei e a revisar quando sair o definitivo' : '') + '. ' + (nIades ? nIades + ' são da seleção da própria ANPD (IADES, 2025). ' : '') + '</p><div class="linha-btns"><button class="btn" data-acao="reais" data-modo="treino">Treinar com comentário</button><button class="btn" data-acao="reais" data-modo="simulado">Fazer como prova</button><button class="btn" data-acao="mais" data-sub="cebraspe">Como o Cebraspe cobra</button></div></div>';
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
// Provas recentes do Cebraspe com caderno próprio no simulado: prefixo dos ids, nome e minutos por item (certo/errado no
// ritmo da prova; múltipla escolha com mais tempo por questão)
const PROVAS_RECENTES = [['anvisa-2024-cebraspe-', 'ANVISA 2024', 1.75], ['tcu-aufc-2026-', 'TCU 2026 (AUFC)', 1.75], ['ag26-', 'AGEPAR 2026', 3]];
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
  let html = '<div class="item-cab"><span class="selo mono">' + esc(nomeBloco(q.b)) + '</span>' + seloReal(q) + '<span class="item-num">' + esc(q.id) + '</span></div>';
  html += renderApoio(q, sessao.i === 0 || sim || !sessao.ids.slice(0, sessao.i).some((x) => QI.get(x).ap === q.ap));
  html += renderComando(q);
  html += '<p class="enunciado">' + (sessao.revelado ? marcarPolaridade(marcarTermos(q.e, 3)) : esc(q.e)) + '</p>';
  html += renderAlternativas(q, marcada, sessao.revelado || !!sessao.flash);
  // Depois da resposta, em tela larga, o item fica à esquerda e o gabarito comentado à direita
  const esq = html, dupla = !sessao.flash && sessao.revelado;
  html = '';
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
    if (sessao.cansaco) html += avisoCansaco(sessao.cansaco);
    html += extrasResposta(q);
    html += renderExplicacao(q);
    html += '<button class="btn primario largo" data-acao="proximo">' + (sessao.i < sessao.ids.length - 1 ? 'Próximo item' : 'Ver resultado') + '</button><p class="atalhos">Enter = próximo</p>';
  }
  return dupla ? '<article class="item dupla"><div class="item-esq">' + esq + '</div><div class="item-dir">' + html + '</div></article>' : '<article class="item">' + esq + html + '</article>';
}
function renderExplicacao(q) {
  let html = '<div class="explica"><span class="gab">Gabarito' + (q.o ? (/preliminar/.test(q.pv) ? ' preliminar da banca' : gabConferido(q) ? (/na lei/.test(q.pv) ? ' conferido na lei' : ' conferido no texto') : ' oficial') : '') + ': ' + nomeGab(q) + ' · armadilha: ' + esc(D.armadilhas[q.a] || q.a) + '</span>';
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
  let html = '<article class="item"><div class="item-cab"><span class="selo mono">' + esc(nomeBloco(nota.b)) + '</span><span class="item-num">' + (r ? (r[1] > 0 ? 'revisão · intervalo ' + fmtIntervalo(r[1]) : 'revisão · errado da última vez') : 'novo') + '</span></div>';
  html += '<p class="mono pequeno mudo">' + esc(nota.r) + '</p>';
  html += '<p class="card-cloze">' + textoCard(nota, card.n, sessao.revelado) + '</p>';
  const lac = lacunaDoCard(nota, card.n), dado = lac.length <= 60 && RE_DADO_CARD.test(lac);
  if (!sessao.revelado) {
    if (dado) html += '<input id="card-digitar" class="card-digitar" type="text" autocomplete="off" enterkeyhint="done" aria-label="Sua resposta para a lacuna" placeholder="Digite o número ou prazo antes de ver">';
    html += '<button class="btn primario largo" data-acao="revelar">Mostrar resposta</button><p class="atalhos">' + (dado ? 'Enter no campo = mostrar · ' : '') + 'Espaço ou Enter = mostrar</p>';
  } else {
    if (sessao.digOk != null) html += '<p class="digitado ' + (sessao.digOk ? 'ok' : 'no') + '">Você digitou <b>' + esc(sessao.dig) + '</b>: ' + (sessao.digOk ? 'confere.' : 'não confere. Bom e Fácil ficam bloqueados neste card.') + '</p>';
    html += '<div class="notas-card">' + [[1, 'Errei'], [2, 'Difícil'], [3, 'Bom'], [4, 'Fácil']].map(([n, t]) => '<button class="n' + n + '" data-acao="avaliar" data-n="' + n + '"' + (sessao.digOk === false && n >= 3 ? ' disabled' : '') + '>' + t + '<small>' + (n === 1 ? 'agora' : fmtIntervalo(calcularCard(card.id, n)[0] - HOJE())) + '</small></button>').join('') + '</div>';
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
  const soMe = ids.length && ids.every((id) => QI.get(id).al);
  html += '<div class="cartao destaque"><span class="rotulo">' + (soMe ? 'Acertos (na múltipla escolha, o erro não desconta)' : 'Nota líquida Cebraspe (certas − erradas)') + '</span><div class="nota-final"><span class="grande">' + liq + '</span><span class="mudo">de ' + n + ' possíveis · ' + (n ? Math.round((liq / n) * 100) : 0) + '%</span></div>' +
    '<div class="placar"><div class="C"><b>' + c + '</b><span>certas</span></div><div class="E"><b>' + e + '</b><span>erradas</span></div><div><b>' + b + '</b><span>em branco</span></div><div class="L"><b>+' + sessao.xp + '</b><span>XP</span></div></div>';
  // Régua de eliminação (a do edital informado ou, como projeção, a da Anatel 2024): só faz sentido na prova inteira
  if (sessao.modo === 'simulado' && sessao.prova && ids.length >= TOTAL_PROVA) {
    // Nota líquida com os pesos, como a do edital: o erro desconta o peso do item (na múltipla escolha, não desconta)
    let c1 = 0, e1 = 0, b1 = 0, c2 = 0, e2 = 0, b2 = 0, liq1 = 0, liq2 = 0;
    ids.forEach((id) => {
      const q = QI.get(id), r = sessao.resp[id] || BRANCO, w = pesoItem(q), pts = r === BRANCO ? 0 : r === q.g ? w : q.al ? 0 : -w;
      if (parteProva(q) === 'b') { if (r === BRANCO) b1++; else if (r === q.g) c1++; else e1++; liq1 += pts; }
      else { if (r === BRANCO) b2++; else if (r === q.g) c2++; else e2++; liq2 += pts; }
    });
    const liqTot = liq1 + liq2, fmtPt = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
    const okP1 = liq1 >= CORTES.p1, okP2 = liq2 >= CORTES.p2, okTot = liqTot >= CORTES.total;
    const aprovado = okP1 && okP2 && okTot, alta = 0.6 * PONTOS_PROVA, media = 0.45 * PONTOS_PROVA;
    const faixaCorte = !aprovado ? 'Eliminado pela régua de nota mínima' : (liqTot >= alta ? 'Nota alta (60% ou mais da prova)' : liqTot >= media ? 'Nota intermediária (45% a 59%)' : 'Nota baixa (menos de 45%)');
    const badgeCls = !aprovado ? 'eliminado' : (liqTot >= alta ? 'aprovado' : 'alerta');
    html += '<div class="cartao" style="border-left:4px solid var(--accent);margin-top:10px">' +
      '<div class="secao-cab"><h2>Régua de eliminação (' + (S.perfil.edital && S.perfil.edital.cortes ? 'do edital' : 'Anatel 2024, como projeção') + ')</h2><span class="corte-badge ' + badgeCls + '">' + (aprovado ? 'HABILITADO' : 'ELIMINADO') + '</span></div>' +
      '<div class="corte-grid">' +
        '<div class="corte-kpi"><b>P1 · Básicos (' + ids.filter((x) => parteProva(QI.get(x)) === 'b').length + ' itens)</b><span>Líquida: <b>' + fmtPt(liq1) + '</b> pts (' + c1 + 'C / ' + e1 + 'E / ' + b1 + 'B)</span><span class="corte-badge ' + (okP1 ? 'aprovado' : 'eliminado') + '" style="margin-top:4px">' + (okP1 ? 'Mínimo atingido (≥ ' + CORTES.p1 + ')' : 'Abaixo do mínimo (< ' + CORTES.p1 + ')') + '</span></div>' +
        '<div class="corte-kpi"><b>P2 · Específicos (' + ids.filter((x) => parteProva(QI.get(x)) !== 'b').length + ' itens)</b><span>Líquida: <b>' + fmtPt(liq2) + '</b> pts (' + c2 + 'C / ' + e2 + 'E / ' + b2 + 'B)</span><span class="corte-badge ' + (okP2 ? 'aprovado' : 'eliminado') + '" style="margin-top:4px">' + (okP2 ? 'Mínimo atingido (≥ ' + CORTES.p2 + ')' : 'Abaixo do mínimo (< ' + CORTES.p2 + ')') + '</span></div>' +
        '<div class="corte-kpi"><b>Conjunto Objetivas (P1+P2)</b><span>Líquida: <b>' + fmtPt(liqTot) + '</b> pts</span><span class="corte-badge ' + (okTot ? 'aprovado' : 'eliminado') + '" style="margin-top:4px">' + (okTot ? 'Habilitado para Discursiva (≥ ' + CORTES.total + ')' : 'Eliminado do concurso (< ' + CORTES.total + ')') + '</span></div>' +
      '</div>' +
      '<p class="pequeno"><b>Faixa:</b> <span class="corte-badge ' + badgeCls + '">' + faixaCorte + '</span> <span class="mudo">Nenhuma nota de corte da ANPD existe ainda; as faixas são só referência.</span></p>' +
      '</div>';
  }
  if (sessao.modo === 'relampago') html += '<p>' + (sessao.recorde ? '<b>Novo recorde!</b> ' : '') + 'Recorde pessoal: ' + (S.perfil.recordes.relampago || 0) + '.</p>';
  if (eMc) html += '<p class="mudo pequeno">' + pl(eMc, 'erro', 'erros') + ' em múltipla escolha não ' + (eMc > 1 ? 'descontaram' : 'descontou') + ' ponto, como no Cebraspe.</p>';
  if (sessao.modo === 'simulado' && ptMax !== n) html += '<p class="pequeno">Nota com os pesos da prova (cada item vale ' + valorDosItens() + '): <b>' + String(Math.round(pt * 100) / 100).replace('.', ',') + '</b> de ' + String(ptMax).replace('.', ',') + ' pontos · <b>' + pct(pt, ptMax) + '%</b>.</p>';
  if (sessao.viradas) html += '<p class="pequeno">' + pl(sessao.viradas, 'virada', 'viradas') + ': ' + pl(sessao.viradas, 'item que você tinha errado em outro dia agora certo', 'itens que você tinha errado em outro dia agora certos') + ', com XP em dobro.</p>';
  if (sessao.ineditos && sessao.ineditos.n >= 5) html += '<p class="pequeno">Nos ' + sessao.ineditos.n + ' itens que você via pela primeira vez, acerto de <b>' + pct(sessao.ineditos.c, sessao.ineditos.n) + '%</b>. É a medida mais fiel do seu nível: item repetido se reconhece.</p>';
  if (sessao.comboMax >= 3) html += '<p class="mudo">Maior sequência de acertos: ' + sessao.comboMax + '.</p>';
  html += '</div>';
  html += cartaoGanhos();
  if (sessao.modo === 'simulado' && Object.keys(porDisc).length > 1) {
    html += '<div class="cartao"><h2>Por disciplina</h2><div class="tabela-env"><table class="tabela"><thead><tr><th>Disciplina</th><th>C</th><th>E</th><th>B</th><th>Líquida</th><th>Pontos</th></tr></thead><tbody>' +
      Object.entries(porDisc).sort((a, b) => b[1].ptMax - a[1].ptMax).map(([dd, v]) => { const t = v.c + v.e + v.b; return '<tr><td>' + esc((DI.get(dd) || { nome: dd }).nome) + '</td><td class="num">' + v.c + '</td><td class="num">' + v.e + '</td><td class="num">' + v.b + '</td><td class="num">' + (v.c - v.e + v.eMc) + ' (' + pct(v.c - v.e + v.eMc, t) + '%)</td><td class="num">' + v.pt + ' de ' + v.ptMax + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="pequeno mudo">' + comNumeros('Pontos: {regraPesos}' + (PESO_BASICA === 1 && PESO_ESPECIFICA === 1 ? ', como na Anatel 2024' : '')) + '. A ordem segue o que cada disciplina pesa na nota.</p></div>';
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
  html += '<div class="linha-btns">' +
    (proximoAcaoBtn || '<button class="btn primario" data-acao="fechar-sessao">Concluir</button>') +
    (idsParaRefazer().length ? '<button class="btn" data-acao="refazer-erros">Refazer ' + pl(idsParaRefazer().length, 'erro ou branco', 'erros e brancos') + '</button>' : '') +
    (proximoAcaoBtn ? '<button class="btn" data-acao="fechar-sessao">Concluir</button>' : '') +
    '</div>';
  return html;
}

/* ================= Folha (painel sobreposto) ================= */
// O foco volta, ao fechar, para o botão que abriu a folha (quem navega pelo teclado não perde o lugar)
let folhaOrigem = null;
function abrirFolha(html, rotulo) {
  const f = document.getElementById('folha');
  if (f.hidden) folhaOrigem = document.activeElement;
  f.innerHTML = '<div class="folha-painel">' + html + '</div>';
  f.setAttribute('aria-label', rotulo || 'Detalhes');
  f.hidden = false;
  f.scrollTop = 0;
  trancarFundo();
  const b = f.querySelector('[data-acao="fechar-folha"]');
  if (b) b.focus(); else focarDialogo(f);
  sincronizarHistorico();
}
function fecharFolha() {
  const f = document.getElementById('folha'), aberta = !f.hidden;
  f.hidden = true; f.innerHTML = ''; UI.folhaAula = null; sincronizarHistorico();
  // Devolve o fundo antes de devolver o foco: com #sessao ainda inerte, focar nela não teria efeito
  trancarFundo();
  if (aberta && folhaOrigem && folhaOrigem.isConnected && typeof folhaOrigem.focus === 'function') folhaOrigem.focus();
  else if (aberta) { const v = document.getElementById(document.getElementById('sessao').hidden ? 'conteudo' : 'sessao'); if (v) try { v.focus({ preventScroll: true }); } catch (e) { /* segue */ } }
  folhaOrigem = null;
}
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
  const ancestral = box.parentElement && box.parentElement.closest('.art-inline[data-art="' + CSS.escape(k) + '"]');
  if (ancestral) { ancestral.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  const lista = box.dataset.lista ? box.dataset.lista.split(',') : null;
  box.innerHTML = htmlArtInline(k, alvo.dataset.q || box.dataset.q, lista, alvo.dataset.box, box.classList.contains('remissao'));
  if (alvo.dataset.q) box.dataset.q = alvo.dataset.q;
  box.hidden = false;
  box.dataset.art = k;
  const dono = document.querySelector('[aria-controls="' + CSS.escape(alvo.dataset.box) + '"][data-art="' + CSS.escape(k) + '"]');
  if (dono) dono.setAttribute('aria-expanded', 'true');
  UI.artInline = k;
  // ao trocar pelo anterior ou próximo, o começo do artigo novo fica à vista
  if (!alvo.getAttribute('aria-controls')) box.scrollIntoView({ block: 'start' });
  try { marcarLido(k); } catch (e) { registrarErro('marcar o artigo como lido', e); }
}
