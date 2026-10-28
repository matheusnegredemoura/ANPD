/* ================= Mais ================= */
function renderMais() {
  const el = document.getElementById('vista-mais');
  const sub = UI.mais;
  let html;
  // Folha da discursiva aberta: uma coluna só, para a pauta ter a largura da linha da folha da banca
  el.classList.toggle('com-folha', sub === 'discursiva' && !!UI.discTema);
  if (sub === 'progresso') html = voltarMais() + renderProgresso();
  else if (sub === 'plano') html = voltarMais() + renderPlano();
  else if (sub === 'pesquisar') html = voltarMais() + renderPesquisar();
  else if (sub === 'glossario') html = voltarMais() + renderGlossario();
  else if (sub === 'metodo') html = voltarMais() + renderMetodo();
  else if (sub === 'edital') html = voltarMais() + renderEditalANPD();
  else if (sub === 'raiox') html = voltarMais() + renderRaioXANPD();
  else if (sub === 'cebraspe') html = voltarMais() + renderCebraspe();
  else if (sub === 'discursiva') html = (UI.discTema ? '' : voltarMais()) + renderDiscursiva() + (UI.discTema ? '' : htmlEsqueletos());
  else if (sub === 'contestacoes') html = voltarMais() + renderContestacoes();
  else if (sub === 'trilha') html = (UI.subtema ? '' : voltarMais()) + renderTrilhas();
  else if (sub === 'ajustes') html = voltarMais() + renderAjustes();
  else if (sub === 'personagem') html = voltarMais() + renderPersonagem();
  else {
    const pend = Object.values(S.pesquisa).filter((p) => !p.s).length;
    const item = (s, ic, t, d) => '<button data-acao="mais" data-sub="' + s + '"><span class="ic">' + ic + '</span><span class="tx"><b>' + t + '</b><span class="s">' + d + '</span></span><span class="mudo">›</span></button>';
    html = '<div class="secao-cab"><h2>Mais</h2></div><div class="menu-mais">' +
      item('trilha', '§', 'Trilhas do zero', TRILHAS.length + ' matérias por subtema, para quem começa: pré-teste, aula, prática e domínio') +
      item('metodo', '1·2', 'Método do Mentor (6 Degraus)', 'Ciclo semanal, degraus de foco, métricas semanais e checklist') +
      item('edital', '≡', 'Edital Projetado e Verticalizado', '10 disciplinas, 38 tópicos com prioridades A/B/C e treino direto') +
      item('raiox', '◎', 'Raio-X do Concurso ANPD', 'Diagnóstico da carreira, banca Cebraspe e sinergia com TCU') +
      '<button data-acao="imprimir-folha-vespera"><span class="ic">✗</span><span class="tx"><b>Folha de véspera</b><span class="s">Os itens que você errou e ainda não acertou depois, por disciplina, para reler antes da prova</span></span><span class="mudo">›</span></button>' +
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
  el.innerHTML = comNumeros(html);
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
  // Var(ln p̂) ≈ (1 − p)/(n·p): incerteza relativa de uma taxa de acerto, para levar a do fator à nota
  const vrel = (t) => { const q = (t.c + 1) / (t.n + 2); return (1 - q) / (q * t.n); };
  const vFator = fator === 1 ? 0 : vrel(real) + vrel(banco);
  let soma = 0, peso = 0, vSoma = 0;
  const linhas = Object.keys(PONTOS_DISC).sort((a, b) => PONTOS_DISC[b] - PONTOS_DISC[a]).map((d) => {
    const x = porD[d] || { r: z(), b: z() }, w = PONTOS_DISC[d];
    let p = null, fonte = 'sem dados', vp = 0;
    if (x.r.n >= 10) { p = x.r.c / x.r.n; fonte = 'reais'; const q = (x.r.c + 1) / (x.r.n + 2); vp = (q * (1 - q)) / x.r.n; }
    else if (x.b.n >= 10) {
      // Correção da disciplina: a razão real/banco dela, puxada para a geral quando há poucos itens reais (peso de 30)
      const fd = x.r.n && x.b.c && fator !== 1 ? (x.r.n * (x.r.c / x.r.n / (x.b.c / x.b.n)) + 30 * fator) / (x.r.n + 30) : fator;
      p = Math.min(1, (x.b.c / x.b.n) * fd); fonte = fd === 1 ? 'banco' : 'banco corrigido';
      const q = (x.b.c + 1) / (x.b.n + 2); vp = ((q * (1 - q)) / x.b.n) * fd * fd + p * p * vFator;
    }
    if (p != null) { soma += w * (2 * p - 1); peso += w; vSoma += w * w * 4 * vp; }
    return { d, x, p, fonte };
  });
  // Faixa de 95%: a nota é a soma ponderada do acerto líquido (2p − 1) de cada disciplina, e a incerteza de cada uma
  // entra com o próprio número de itens (Σ w²·4·Var(p) ÷ (Σ w)²); as medidas pelo banco somam a incerteza do fator
  const nota = peso ? (soma / peso) * PONTOS_PROVA : null;
  const meia = peso && real.n ? (1.96 * Math.sqrt(vSoma) / peso) * PONTOS_PROVA : null;
  const faixa = nota != null && meia != null ? [Math.max(-PONTOS_PROVA, Math.round(nota - meia)), Math.min(PONTOS_PROVA, Math.round(nota + meia))] : null;
  const semReais = linhas.filter((l) => l.p != null && l.fonte !== 'reais').length, semDados = linhas.filter((l) => l.p == null).length;
  return { real, banco, fator, linhas, nota, faixa, semReais, semDados, cobre: peso / PONTOS_PROVA };
}
// Mistura praticada nos últimos 14 dias × peso de cada disciplina na prova: as intercaladas cobrem o que falta
function cartaoMistura() {
  const m = misturaPraticada();
  if (m.tot < 20) return '';
  const linhas = m.linhas.slice().sort((a, b) => b.peso - a.peso);
  return '<div class="cartao"><div class="secao-cab"><h2>Mistura do estudo</h2><span class="mudo pequeno">' + pl(m.tot, 'item', 'itens') + ' nos últimos 14 dias</span></div>' +
    '<div class="tabela-env"><table class="tabela"><thead><tr><th>Disciplina</th><th>Na prova</th><th>Praticado</th><th>Diferença</th></tr></thead><tbody>' +
    linhas.map((l) => { const dif = Math.round((l.parte - l.peso) * 100); return '<tr><td>' + esc((DI.get(l.d) || { nome: l.d }).nome) + '</td><td class="num">' + Math.round(l.peso * 100) + '%</td><td class="num">' + Math.round(l.parte * 100) + '%</td><td class="num' + (dif <= -3 ? ' falta' : '') + '">' + (dif > 0 ? '+' : '') + dif + '</td></tr>'; }).join('') +
    '</tbody></table></div><p class="pequeno mudo">Os dias do plano são de uma matéria só; o treino intercalado do roteiro reparte os itens pelo que falta a cada disciplina para chegar ao peso dela na prova.</p></div>';
}
function cartaoProntidao() {
  const pr = prontidao(), { real, banco } = pr;
  // Reais ainda inéditos por disciplina: mostra onde a reposição com itens de outro banco faz mais falta
  const ined = {};
  for (const q of REAIS) if (!q.al) { const x = (ined[(BI.get(q.b) || {}).disciplina] ||= [0, 0]); x[1]++; if (inedito(q)) x[0]++; }
  const livres = Object.values(ined).reduce((a, x) => a + x[0], 0);
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
      '</tbody></table></div>' +
      '<p class="pequeno">Itens reais ainda inéditos, da disciplina mais perto do fim para a mais folgada: ' + Object.entries(ined).filter(([d]) => DI.has(d)).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]).map(([d, x]) => esc(DI.get(d).nome) + ' ' + x[0] + ' de ' + x[1]).join('; ') + '. Quando acabam numa disciplina, o treino dela fica só com itens escritos para o banco e a prontidão para de acompanhar o seu progresso ali; a reposição vem de itens reais de outros bancos, com o gabarito conferido na lei.</p></details>';
  }
  html += livres ? '<div class="linha-btns"><button class="btn primario" data-acao="treinar-reais">' + esc(rotuloPausa('reais:ineditos', 'Treinar ' + pl(Math.min(20, livres), 'item real inédito', 'itens reais inéditos'))) + '</button></div>' : '';
  html += '<p class="pequeno mudo">Conta só a primeira resposta de cada item certo/errado, no peso da nota (cada item vale ' + valorDosItens() + '). ' + pl(livres, 'item real ainda inédito', 'itens reais ainda inéditos') + ' no banco. Nos simulados de prova completa, pelo menos metade de cada disciplina vem deles enquanto houver inéditos.</p></div>';
  return html;
}
function renderProgresso() {
  const t = totais(), seq = sequencia();
  // Nível e XP ficam na Jornada (Hoje) e na ficha do personagem
  let html = '<div class="estat"><div><b>' + fmtNum(t.r) + '</b><span>itens respondidos</span></div><div><b>' + pct(t.c, t.r) + '%</b><span>de acerto</span></div><div><b>' + fmtNum(t.c - t.e) + '</b><span>nota líquida acumulada</span></div>' +
    '<div><b>' + fmtNum(t.k) + '</b><span>cards revisados</span></div><div><b>' + seq + '</b><span>dias seguidos</span></div><div><b>' + (S.perfil.melhorSeq || 0) + '</b><span>melhor sequência</span></div></div>';
  html += cartaoProntidao() + cartaoMistura();
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
    (pl1.length ? '<div class="dominio">' + pl1.map(([dd, v]) => '<div class="dom-linha"><span class="nome">' + esc((DI.get(dd) || { nome: dd }).nome) + ' · ' + pl(v.n, 'item', 'itens') + '</span>' + barra(v.c / v.n) + '<span class="val">' + pct(v.c, v.n) + '%</span></div>').join('') + '</div>' : '<p class="mudo">Aparece por disciplina a partir de 10 itens respondidos pela primeira vez.</p>') +
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
  if (S.simulados.length) html += '<div class="cartao"><h2>Simulados</h2><div class="tabela-env"><table class="tabela"><thead><tr><th>Data</th><th>Itens</th><th>C</th><th>E</th><th>Nota</th><th>Pontos</th><th>Reais</th></tr></thead><tbody>' + S.simulados.slice(0, 12).map((s) => { const n = (k) => Number(s[k]) || 0; return '<tr><td>' + esc(fmtData(s.data, { day: '2-digit', month: '2-digit' })) + '</td><td class="num">' + n('n') + '</td><td class="num">' + n('c') + '</td><td class="num">' + n('e') + '</td><td class="num">' + n('liq') + ' (' + pct(n('liq'), n('n')) + '%)</td><td class="num">' + (n('ptMax') ? n('pt') + ' de ' + n('ptMax') : '—') + '</td><td class="num">' + (n('nr') ? pct(n('cr'), n('nr')) + '% de ' + n('nr') : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    '<p class="pequeno mudo">Pontos: nota com os pesos da prova (cada item vale ' + valorDosItens() + '). Reais: acerto nos itens reais de prova do simulado.</p></div>';
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
// Prova antes do fim do plano: o cartão mostra quais fases perdem dias e oferece encaixar o plano na data (saem semanas
// inteiras ainda por vir, as de revisão primeiro, e o resto é adiantado). Com o plano encaixado, diz o que saiu e
// permite voltar ao original. Sem edital nem encaixe, mostra o plano B (prova em fevereiro) pronto para um clique.
function cartaoPlanoEncolhe() {
  const prova = dataProva(), fim = DIAS.length ? DIAS[DIAS.length - 1].data : prova, e = encaixeValido(S.perfil.encaixe);
  const fmt = (iso) => fmtData(iso, { day: '2-digit', month: '2-digit' }), fmtA = (iso) => fmtData(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const lista = (r) => '<ul class="pequeno">' + r.cortadas.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul>';
  const fimBase = FASES_BASE.flatMap((f) => f.semanas.flatMap((s) => s.dias)).reduce((m, d) => (d.data > m ? d.data : m), '');
  const previa = prova < fimBase && prova > hojeISO() ? encaixarPlano(prova, hojeISO()) : null;
  const botaoEncaixe = previa ? '<button class="btn primario" data-acao="plano-encaixar">Encaixar o plano até ' + fmt(prova) + '</button>' : '';
  if (e) {
    const r = encaixarPlano(e.prova, e.desde, e.cortes), outra = prova !== e.prova;
    return '<div class="cartao"><h2>Plano encaixado na prova de ' + fmtA(e.prova) + '</h2><p class="pequeno">Encaixado em ' + fmt(e.desde) + '. ' +
      (r && r.cortadas.length ? pl(r.cortadas.length, 'semana saiu', 'semanas saíram') + ' do plano; o resto foi adiantado, cada dia no mesmo dia da semana, e a reta final termina no dia da prova:</p>' + lista(r) : 'Nenhuma semana precisou sair.</p>') +
      (outra ? '<p class="pequeno"><b>A data da prova agora é ' + fmtA(prova) + '.</b> ' + (previa ? 'Encaixe de novo para ela ou volte ao plano original.' : 'Ela não cai antes do fim do plano original: volte a ele.') + '</p>' : '') +
      '<div class="linha-btns">' + (outra ? botaoEncaixe : '') + '<button class="btn" data-acao="plano-original">Voltar ao plano original</button></div></div>';
  }
  if (prova < fim) {
    const fora = DIAS.filter((d) => d.data >= prova);
    const porFase = D.cronograma.fases.map((f) => ({ f, n: fora.filter((d) => d.fase === f.id).length, tot: DIAS.filter((d) => d.fase === f.id).length })).filter((x) => x.n);
    return '<div class="cartao cansaco"><h2>O plano passa da data da prova</h2><p class="pequeno">Com a prova em <b>' + fmt(prova) + '</b>, ' + pl(fora.length, 'dia do cronograma fica', 'dias do cronograma ficam') + ' para depois dela (o plano vai até ' + fmt(fim) + '). Sem encaixe, o que encolhe:</p><ul class="pequeno">' +
      porFase.map((x) => '<li><b>' + esc(x.f.titulo) + ': ' + esc(x.f.subtitulo) + '</b> perde ' + x.n + ' de ' + x.tot + ' dias' + (x.n === x.tot ? ' (inteira)' : '') + '</li>').join('') + '</ul>' +
      (previa ? '<p class="pequeno">Encaixando, saem ' + pl(previa.cortadas.length, 'semana inteira', 'semanas inteiras') + ' ainda por vir, primeiro as de revisão sem conteúdo novo, e o resto é adiantado' + (previa.curto ? '; como não há semanas bastantes para cortar, o que cairia na reta final também sai' : '') + ':</p>' + lista(previa) + '<div class="linha-btns">' + botaoEncaixe + '</div>' : '<p class="pequeno mudo">Até a prova, a revisão espaçada já para dois dias antes dela. Use os sábados e o treino intercalado, que reparte os itens pelo peso de cada disciplina.</p>') + '</div>';
  }
  if (S.perfil.edital && S.perfil.edital.prova) return '';
  const b = encaixarPlano(PLANO_B, hojeISO());
  if (!b) return '';
  return '<details class="cartao det-lista" data-det="plano-b"' + (UI.det['plano-b'] ? ' open' : '') + '><summary><b>Plano B: prova em ' + fmtA(PLANO_B) + '</b></summary><p class="pequeno">Se o concurso for antecipado, o plano encaixado em ' + fmt(PLANO_B) + ' tira ' + pl(b.cortadas.length, 'semana', 'semanas') + (b.novo ? '' : ' de revisão') + ((m) => (m.length ? ' e mantém ' + m.join(' e ') : ''))([!b.novo && 'toda a primeira volta do conteúdo', !b.simulados && 'os simulados'].filter(Boolean)) + (b.simulados ? '; ' + pl(b.simulados, 'simulado sai', 'simulados saem') + ' junto' : '') + ':</p>' + lista(b) +
    '<p class="pequeno mudo">Um clique troca o plano e a contagem até a prova; dá para voltar ao original quando quiser. Quando o edital sair, informe a data em Ajustes → Edital e prova e encaixe o plano nela.</p><div class="linha-btns"><button class="btn" data-acao="plano-b">Usar o plano B</button></div></details>';
}
function renderPlano() {
  const h = hojeISO(), ctx = contextoHoje();
  if (UI.faseAberta === null) UI.faseAberta = ctx.tipo === 'dia' ? ctx.dia.fase : ctx.tipo === 'folga' ? ctx.prox.fase : 'f5';
  let html = (D.cronograma.doc ? '<p class="pequeno"><a href="' + esc(D.cronograma.doc) + '" target="_blank" rel="noopener">Abrir o Plano de Estudos completo (doc) ↗</a></p>' : '') +
    cartaoPlanoEncolhe() +
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
  let r = 0, c = 0, e = 0;
  for (const [iso, d] of Object.entries(S.perfil.dias || {})) {
    if (iso >= semIni && iso <= hoje) {
      r += d.r || 0;
      c += d.c || 0;
      e += d.e || 0;
    }
  }
  const total = c + e;
  const liq = total > 0 ? (c - e) / total : 0;
  const venc = listaVencida().length;
  const cardsV = cardsVencidos().length;
  const cad = cadState();
  const errosPendentes = Q.filter((q) => { const x = rec(q.id); return x && x[3] > 0 && !(x[0] > 0) && !SEM_REPETICAO.has(q.id); }).length;
  const degrauAtual = cad.degrau || 1;
  const md = metricasDegrau(degrauAtual);

  let discSem = false;
  if (S.disc) {
    for (const t of Object.values(S.disc)) {
      if (t.tentativas && t.tentativas.some((x) => x.d && x.d >= semIni)) {
        discSem = true; break;
      }
    }
  }

  return {
    semIni, r, c, e, total, liq,
    venc, cardsV, revisaoTotal: venc + cardsV,
    errosPendentes, degrauAtual, md, discSem,
    metaQuestoes: itensPlanoSemana()
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
  const liqCor = ms.total === 0 ? 'var(--ink-3)' : ms.liq >= 0.6 ? 'var(--certo)' : ms.liq >= 0.4 ? 'var(--accent)' : 'var(--errado)';
  const pctQ = Math.min(100, Math.round((ms.r / ms.metaQuestoes) * 100));

  let prescricao = '';
  let acaoSugerida = '';
  if (ms.revisaoTotal > 0) {
    prescricao = '<b>Atenção à curva do esquecimento:</b> Você possui <b>' + pl(ms.revisaoTotal, 'item pendente', 'itens pendentes') + '</b> de revisão espaçada (' + ms.venc + ' questões, ' + ms.cardsV + ' cards). No Método ANPD, zerar revisões vem antes de avançar para evitar o acúmulo de pontos cegos.';
    acaoSugerida = '<button class="btn pequeno primario" data-acao="iniciar-revisao">Zerar revisão agora</button>';
  } else if (ms.md.totalRespostas >= 40 && ms.md.pronto && ms.degrauAtual < 6) {
    prescricao = '<b>Meta de Degrau Atingida:</b> Parabéns! Você atingiu domínio no <b>' + ms.degrauAtual + 'º Degrau</b> (' + Math.round(ms.md.dom * 100) + '% domínio, nota líquida ' + (ms.md.liq >= 0 ? '+' : '') + ms.md.liq.toFixed(2).replace('.', ',') + '). O mentor recomenda promover seu degrau ativo para o próximo nível!';
    acaoSugerida = '<button class="btn pequeno primario" data-acao="anpd-set-degrau" data-deg="' + (ms.degrauAtual + 1) + '">Avançar para o ' + (ms.degrauAtual + 1) + 'º Degrau</button>';
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
    '<div style="padding:8px 10px;background:var(--surface);border-radius:var(--r)">' +
      '<b class="mono" style="font-size:1.15rem">' + ms.r + ' <span class="pequeno mudo" style="font-size:.75rem">/ ' + ms.metaQuestoes + '</span></b>' +
      '<span style="font-size:.76rem">itens na semana</span>' +
      '<div class="barra" style="height:4px;margin-top:6px"><i style="width:' + pctQ + '%"></i></div>' +
    '</div>' +
    '<div style="padding:8px 10px;background:var(--surface);border-radius:var(--r)">' +
      '<b class="mono" style="font-size:1.15rem;color:' + liqCor + '">' + liqPct + '</b>' +
      '<span style="font-size:.76rem">líquido Cebraspe (meta ≥ +60%)</span>' +
    '</div>' +
    '<div style="padding:8px 10px;background:var(--surface);border-radius:var(--r)">' +
      '<b class="mono" style="font-size:1.15rem">' + ms.degrauAtual + 'º <span class="pequeno mudo" style="font-size:.75rem">/ 6</span></b>' +
      '<span style="font-size:.76rem">degrau ativo (' + Math.round(ms.md.dom * 100) + '% dom)</span>' +
    '</div>' +
    '<div style="padding:8px 10px;background:var(--surface);border-radius:var(--r)">' +
      '<b class="mono" style="font-size:1.15rem;' + (ms.revisaoTotal ? 'color:var(--errado)' : 'color:var(--certo)') + '">' + (ms.revisaoTotal ? ms.revisaoTotal : '✓ 0') + '</b>' +
      '<span style="font-size:.76rem">' + (ms.revisaoTotal ? 'revisões pendentes' : 'revisão em dia') + '</span>' +
    '</div>' +
    '</div>' +
    '<div style="background:var(--surface);padding:10px 12px;border-radius:var(--r);font-size:.86rem;border-left:3px solid var(--accent)">' +
    '<p style="margin:0 0 6px 0;line-height:1.45">' + prescricao + '</p>' +
    '<div class="linha-btns" style="margin-top:4px">' + acaoSugerida +
    '<button class="btn pequeno" data-acao="anpd-treino-rapido" data-deg="' + ms.degrauAtual + '">' + esc(rotuloPausa('deg:' + ms.degrauAtual, 'Treinar 20 itens do ' + ms.degrauAtual + 'º Degrau')) + '</button>' +
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
  let html = '<div class="cartao anpd-banner-fase"><div class="secao-cab"><h2>Etapa e ciclo do método do mentor</h2>' +
    '<div class="chips"><button class="linkish pequeno" data-acao="mais" data-sub="raiox">Ver Raio-X</button>' +
    '<button class="linkish pequeno" data-acao="mais" data-sub="edital">Ver Edital Verticalizado</button></div></div>' +
    '<div class="chips" role="group" aria-label="Etapa do método">' +
    [['f1', 'Etapa 1 · Base ANPD + Tronco TCU'], ['f2', 'Etapa 2 · Ciclo e 6 Degraus'], ['f3', 'Etapa 3 · Reta final pós-edital']].map(([id, rot]) => '<button class="chip" data-acao="anpd-set-fase" data-fase="' + id + '" aria-pressed="' + (f === id) + '">' + rot + '</button>').join('') +
    '</div>';
  if (f === 'f1') {
    html += '<p class="pequeno mudo">Pré-edital, construção de base: o seu plano tem <b>{horasPre} por semana</b> (1 h nos dias úteis e um bloco longo no sábado), e é ele que o roteiro do dia segue; o mentor sugere 18 a 25 h para quem tem esse tempo. As horas se dividem entre o Núcleo Duro da ANPD (LGPD, Resoluções, ECA Digital e Regulação) e o <b>Tronco Comum</b> com o TCU (Constitucional, Administrativo, Gestão, Economia e Português), cujo progresso vem do Painel TCU pelo arquivo de backup dele (Ajustes).</p>';
  } else if (f === 'f2') {
    html += '<p class="pequeno mudo">Tração e fechamento de lacunas: as horas do seu plano (<b>{horasPre} por semana</b>) no ciclo rotativo, nas proporções do ciclo de 25 h do mentor, com foco na subida dos <b>6 Degraus de Prioridade</b>. Só avance para o próximo degrau quando atingir a nota líquida de saída (≥ +0,60).</p>';
  } else {
    html += '<p class="pequeno mudo">Pós-edital: o seu plano tem <b>{horasPos} por semana</b> e cerca de {itensPos} itens; o mentor sugere 35 a 40 h e 450+ questões para quem puder ampliar. O foco é velocidade de resolução de itens Cebraspe, simulados de 120 itens todo sábado e baterias dos itens que você errou.</p>';
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
        '<div class="linha-btns"><button class="btn pequeno' + (ativo ? ' primario' : '') + '" data-acao="anpd-treino-rapido" data-blocos="' + esc(blocosDeg.join(',')) + '" data-tit="Degrau ' + d.ordem + ' · ' + esc(d.bloco) + '">' + esc(rotuloPausa('deg:' + blocosDeg.join(','), 'Treinar 20 itens deste degrau')) + '</button>' +
        (ativo ? '<span class="selo ok">Degrau ativo no ciclo</span>' : '<button class="btn pequeno" data-acao="anpd-set-degrau" data-deg="' + d.ordem + '">Definir como degrau ativo</button>') +
        '</div></div>';
    }).join('') + '</div>';

  // O ciclo do mentor é de 25 h; aqui ele vai para as horas que a pessoa de fato estudou por semana, nas mesmas proporções
  const hs = horasSemana(), hp = planoPorSemana(null, D.cronograma.edital).h, H = Math.max(1, Math.round((hs || hp || 25) * 2) / 2);
  html += '<div class="cartao"><div class="secao-cab"><h2>3. Ciclo semanal (Etapa 2)</h2><span class="selo mono">Soma = ' + fmtDur(H * 3600) + '</span></div>' +
    '<p class="pequeno mudo">' + (hs ? 'Nas suas horas reais: ' + fmtDur(hs * 3600) + ' por semana na média das duas últimas semanas (o cronômetro do dia). As proporções são as do ciclo de 25 h do mentor; nenhuma disciplina fica abandonada.' : 'Nas horas do seu plano (' + fmtDur(H * 3600) + ' por semana), nas proporções do ciclo de 25 h do mentor. Depois de 5 dias de estudo nas duas últimas semanas, as horas passam a seguir o seu tempo real. Nenhuma disciplina fica abandonada.') + '</p>' +
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

  html += '<div class="cartao"><div class="secao-cab"><h2>6. Reta final pós-edital ({semanasPos} semanas)</h2><span class="selo p1">Seu plano: {horasPos}/sem · ~{itensPos} itens/sem</span></div>' +
    '<div class="tabela-env"><table class="tabela"><thead><tr><th>Período</th><th>Foco principal</th></tr></thead><tbody>' +
    // Os quatro trechos repartem as semanas que de fato há entre o edital e a prova (a data de Ajustes, se informada)
    (() => { const rf = mt.retaFinal16Semanas || [], n = Math.max(rf.length, Math.round((diaNum(dataProva()) - diaNum(D.cronograma.edital)) / 7)); return rf.map((r, i) => { const a = Math.round((n * i) / rf.length) + 1, b = Math.round((n * (i + 1)) / rf.length); return '<tr><td><b>' + (a === b ? 'Semana ' + a : 'Semanas ' + a + ' a ' + b) + (i === rf.length - 1 ? ' (véspera)' : '') + '</b></td><td>' + esc(r.foco) + '</td></tr>'; }).join(''); })() +
    '</tbody></table></div></div>';

  const ms = metricasSemanaMentor();
  const chkFeitos = checksFeitos(chk);
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
      else if (i === 1) dicaAuto = '<span class="selo mono pequeno" style="margin-left:6px">' + ms.r + '/' + itensPlanoSemana() + ' itens · ' + (ms.total > 0 ? (ms.liq >= 0 ? '+' : '') + Math.round(ms.liq * 100) + '% líq' : '0%') + '</span>';
      else if (i === 3) dicaAuto = ms.errosPendentes === 0 ? '<span class="selo ok pequeno" style="margin-left:6px">✓ Todos recuperados</span>' : '<span class="selo p2 pequeno" style="margin-left:6px">' + ms.errosPendentes + ' por recuperar</span>';
      else if (i === 5) dicaAuto = ms.discSem ? '<span class="selo ok pequeno" style="margin-left:6px">✓ Feito na semana</span>' : '<span class="selo mono pequeno" style="margin-left:6px">Pendente para sábado</span>';
      return '<label class="pesq-linha' + (chk[i] ? ' feito' : '') + '"><input type="checkbox" data-acao="anpd-check-sem" data-i="' + i + '"' + (chk[i] ? ' checked' : '') + '><div class="tx"><b>' + esc(item.texto) + '</b> ' + dicaAuto + '</div></label>';
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
  const ed = (D.mentor && D.mentor.edital) || {};
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
    [['todas', 'Todas (' + topicos.length + ')'], ...['A', 'B', 'C'].map((v) => [v, 'Prioridade ' + v + ' (' + topicos.filter((t) => t.prio === v).length + ')'])].map(([v, t]) => '<button class="chip" data-acao="ed-prio" data-v="' + v + '" aria-pressed="' + (fPrio === v) + '">' + t + '</button>').join('') +
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
    html += '<div class="cartao"><div class="secao-cab"><h2>' + esc(matNome) + '</h2><span class="selo mono">' + esc(info.grupo) + ' · ' + pl(info.topicos.length, 'tópico', 'tópicos') + '</span></div><div>' +
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
  // A resposta que veio no pacote de dados não pode ser desfeita pela leitura da conta: o documento
  // da coleção continua com status "aberta" e resposta vazia enquanto não for respondido lá, e sem
  // isto o status voltava para "aberta" e a resposta sumia a cada abertura do painel.
  aplicarRespostasDoBanco();
  if (mudou) { gravarContest(); if (UI.vista === 'mais') renderMais(); }
}
function renderContestacoes() {
  const lista = CONTEST.slice().sort((a, b) => (a.data < b.data ? 1 : -1));
  return '<div class="secao-cab"><h2>Minhas contestações</h2><span class="mudo pequeno">' + lista.length + '</span></div>' +
    '<p class="mudo pequeno">Toda contestação é lida na rodada seguinte de revisão do banco. Procedente, o item é corrigido ou retirado; a resposta aparece aqui.</p>' +
    (lista.length ? '<div class="lista-rev">' + lista.map((c) => '<button data-acao="contestar" data-q="' + esc(c.q) + '"><span class="marca-res ' + (c.status === 'procedente' || c.status === 'anulado' ? 'C' : c.status === 'improcedente' ? 'E' : 'B') + '">' + (c.status === 'aberta' || c.status === 'pendente' ? '…' : c.status === 'improcedente' ? '✗' : '✓') + '</span><span class="txt"><b>' + esc(c.q) + '</b> · ' + esc(STATUS_CONTEST[c.status] || c.status) + (QI.get(c.q) ? ' · ' + esc(QI.get(c.q).e.slice(0, 90)) + '…' : '') + '</span></button>').join('') + '</div>' : '<p class="vazio-msg">Nenhuma contestação ainda. O botão “Contestar este item” fica logo abaixo do comentário de cada questão.</p>');
}

