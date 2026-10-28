/* ================= Discursiva ================= */
function linhasEstimadas(texto) {
  return String(texto || '').split('\n').reduce((n, p) => n + (p.trim() ? Math.ceil(p.length / CARACTERES_LINHA) : 0), 0);
}
// Passa o texto da caixa para o rascunho do tema aberto e grava (navegador na hora; conta logo em seguida)
function guardarRascunhoDisc() {
  const area = document.getElementById('disc-texto');
  if (!area || !area.dataset.tema || area.readOnly) return;
  estadoDisc(area.dataset.tema).rascunho = area.value;
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
          '<p class="pequeno mudo">Tempo sugerido: ' + x.minutos + ' min · ' + (ult ? 'última nota ' + (Number(ult.nq) || 0).toFixed(2).replace('.', ',') + ' de ' + x.pontos + ' em ' + esc(fmtData(ult.d, { day: '2-digit', month: '2-digit' })) + ' · ' + pl(tent.length, 'tentativa', 'tentativas') : 'ainda não feito') + '</p>' +
          '<div class="linha-btns"><button class="btn primario" data-acao="disc-abrir" data-t="' + esc(x.id) + '">' + (estadoDisc(x.id).rascunho ? 'Continuar' : 'Escrever') + '</button></div></div>';
      }).join('');
  }
  const st = estadoDisc(t.id), corrigindo = UI.discFase === 'correcao';
  let html = '<button class="btn pequeno voltar" data-acao="disc-voltar">← Temas</button>' +
    '<div class="cartao"><span class="rotulo">Discursiva · até ' + t.linhas + ' linhas · ' + t.pontos + ' pontos · tempo sugerido ' + t.minutos + ' min</span><h2>' + esc(t.titulo) + '</h2>' +
    '<p>' + esc(t.comando) + '</p><ol class="lista-cb">' + t.aspectos.map((a) => '<li>' + esc(a) + '</li>').join('') + '</ol></div>' +
    '<div class="secao-cab" style="margin-top:10px"><label class="rotulo" for="disc-texto">Folha de resposta (' + t.linhas + ' linhas)</label><span class="mudo pequeno mono" id="disc-cont">' + contadorDisc(t) + '</span></div>' +
    '<div class="regua-discursiva">' +
      '<textarea id="disc-texto" data-tema="' + esc(t.id) + '" class="disc-area-30" rows="' + t.linhas + '" style="min-height:' + (t.linhas * 24 + 16) + 'px" spellcheck="false"' + (corrigindo ? ' readonly' : '') + ' placeholder="Escreva aqui o seu texto discursivo, parágrafo por parágrafo, contemplando todos os aspectos do comando...">' + esc(st.rascunho) + '</textarea>' +
    '</div>';
  if (!corrigindo) {
    html += CHECK_DISC;
    html += '<div class="linha-btns" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">' +
      '<button class="btn primario" data-acao="disc-corrigir">Terminei: corrigir pelos quesitos</button>' +
      '<button class="btn" data-acao="disc-salvar-rascunho" title="Salva imediatamente o rascunho no navegador">Salvar rascunho</button>' +
      '<button class="btn" data-acao="disc-limpar">Apagar e recomeçar</button>' +
      '<span id="disc-status-salvo" class="pequeno" style="font-weight:600;color:var(--certo)"></span>' +
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
  if (st.tentativas.length) html += '<div class="cartao"><h2>Tentativas anteriores</h2><div class="tabela-env"><table class="tabela"><thead><tr><th>Data</th><th>Linhas</th><th>Erros</th><th>Nota</th></tr></thead><tbody>' + st.tentativas.map((x) => '<tr><td>' + esc(fmtData(x.d, { day: '2-digit', month: '2-digit' })) + '</td><td class="num">' + (Number(x.tl) || 0) + '</td><td class="num">' + (Number(x.ne) || 0) + '</td><td class="num">' + (Number(x.nq) || 0).toFixed(2).replace('.', ',') + '</td></tr>').join('') + '</tbody></table></div></div>';
  return html;
}
let timerDisc = null;
// Itens reais de uma disciplina: os que estão em blocos dela
function reaisDaDisc(id) { return REAIS.filter((q) => (BI.get(q.b) || {}).disciplina === id); }
function numItem(q) { const m = /(item|questão) (\d+)/.exec(q.pv || ''); return m ? (m[1] === 'item' ? 'Item ' : 'Questão ') + m[2] : ((q.pv || '').split(' · ')[1] || q.id); }
// Como a banca constrói o item: mecanismos do item errado (cada um ligado à armadilha do banco, com treino), disfarces do
// item certo, léxico que inverte o sentido e a conta do chute
function cartaoConstrucao(c) {
  const n = (k) => Q.filter((q) => q.a === k && !q.al).length;
  return '<div class="cartao cb-disc" id="cb-construcao"><h2>Como a banca constrói o item</h2><p>' + esc(c.intro) + '</p>' +
    '<h3>Como o item errado é feito</h3>' + c.errado.map((m) => '<div class="gloss-item"><b>' + esc(m.nome) + '</b><p class="pequeno">' + esc(m.como) + '</p><p class="pequeno mudo">' + esc(m.exemplo) + '</p>' +
      (n(m.arm) >= 5 ? '<div class="linha-btns"><button class="btn pequeno" data-acao="treinar-arm" data-a="' + esc(m.arm) + '">Treinar (' + n(m.arm) + ' itens)</button></div>' : '') + '</div>').join('') +
    '<h3>Como o item certo se disfarça</h3><ul class="lista-cb">' + c.certo.map((m) => '<li><b>' + esc(m.nome) + '.</b> ' + esc(m.como) + '</li>').join('') + '</ul>' +
    '<h3>Palavras que invertem o sentido</h3><div class="tabela-env"><table class="tabela"><tbody>' + c.lexico.map(([t, s]) => '<tr><td><b>' + esc(t) + '</b></td><td>' + esc(s) + '</td></tr>').join('') + '</tbody></table></div>' +
    '<p class="pequeno">' + esc(c.chute) + '</p></div>';
}
function renderCebraspe() {
  const cb = D.cebraspe;
  if (!cb) return '<p class="mudo">Dados da banca indisponíveis nesta versão.</p>';
  const li = (t) => '<li>' + esc(t) + '</li>';
  const nC = REAIS.filter((q) => !q.al && q.g === 'C').length, nMc = REAIS.filter((q) => q.al).length;
  const chip = (id) => { const q = QI.get(id); return q ? '<button class="chip item-real" data-acao="revisar-item" data-q="' + esc(id) + '" title="' + esc(q.pv || '') + '">' + esc(numItem(q)) + ' · ' + nomeGab(q) + '</button>' : ''; };
  let html = '<div class="prosa"><h2>Como o Cebraspe cobra</h2><p>' + esc(cb.fonte) + '</p></div>';
  html += '<div class="chips cb-nav">' + cb.disciplinas.map((d) => { const x = DISC.find((y) => y.id === d.id); return x ? '<button class="chip" data-acao="rolar" data-alvo="cb-' + esc(d.id) + '">' + esc(x.nome) + '</button>' : ''; }).join('') + '<button class="chip" data-acao="rolar" data-alvo="cb-construcao">Como o item é feito</button><button class="chip" data-acao="rolar" data-alvo="cb-raiox">O que a banca repete</button><button class="chip" data-acao="rolar" data-alvo="cb-discursiva">Discursiva</button><button class="chip" data-acao="rolar" data-alvo="cb-provas">Provas para mandar</button></div>';
  html += '<div class="cartao"><h2>A prova e a pontuação</h2><div class="tabela-env"><table class="tabela cb-tabela"><thead><tr><th>Prova</th><th>Tamanho</th><th>Corte</th></tr></thead><tbody>' +
    cb.estrutura.map((e) => '<tr><td>' + esc(e.prova) + '</td><td>' + esc(e.itens) + '</td><td>' + esc(e.corte) + '</td></tr>').join('') + '</tbody></table></div>' +
    '<ul class="lista-cb">' + cb.regras.map(li).join('') + '</ul>' +
    '<p class="pequeno mudo">No banco: ' + pl(REAIS.length, 'item real', 'itens reais') + ': ' + nC + ' com gabarito certo, ' + (REAIS.length - nC - nMc) + ' com gabarito errado' + (nMc ? ' e ' + nMc + ' de múltipla escolha' : '') + '.</p></div>';
  if (cb.construcao) html += cartaoConstrucao(cb.construcao);
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
    '<p class="pequeno">' + (S.perfil.edital ? 'Valendo os números que você informou. O simulado da prova inteira, a régua de corte, a prontidão e a contagem até a prova seguem estes números.' : 'Valendo a projeção (estrutura da Anatel 2024 e prova provável em ' + fmtData(D.cronograma.prova, { day: '2-digit', month: '2-digit', year: 'numeric' }) + ')' + (encaixeValido(S.perfil.encaixe) ? ', com o plano encaixado na prova de ' + fmtData(S.perfil.encaixe.prova, { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', que vale para a contagem' : '') + '. Quando o edital da ANPD sair, troque aqui: o simulado, a régua de corte, a prontidão e a contagem passam a seguir o edital.') + '</p>' +
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
    '<div class="cartao destaque"><h2>Sincronizar com o Painel TCU</h2><p class="pequeno">Traz as respostas, cards e artigos lidos do tronco comum (Constitucional, Administrativo, LAI, Línguas, Gestão, Economia e Contabilidade) feitos no Painel TCU. Fica o registro mais recente de cada item; nada é apagado.</p><div class="campo"><label for="arquivo-tcu">Arquivo de backup do Painel TCU (.json)</label><input id="arquivo-tcu" type="file" accept=".json,application/json" data-acao="tcu-arquivo"></div><p class="pequeno mudo">No claude.ai cada painel guarda o progresso só para si, então o caminho é o arquivo: no Painel TCU, Ajustes → salvar progresso em arquivo. Com os dois abertos como arquivo no mesmo navegador, o botão abaixo lê direto.</p><div class="linha-btns"><button class="btn" data-acao="sync-tcu">⇄ Ler do mesmo navegador</button></div></div>' +
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

/* ================= Fase, degrau e checklist do mentor ================= */
// Metas marcadas na semana: só as chaves numéricas (a do bônus fica de fora)
function checksFeitos(cs) { return Object.keys(cs || {}).filter((k) => /^\d+$/.test(k) && cs[k]).length; }
function cadState() {
  const c = (S.perfil.cad ||= {});
  c.checkSem ||= {};
  if (!c.degrau) c.degrau = 1;
  if (!c.fase) c.fase = 'f2';
  return c;
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

function htmlEsqueletos() {
  const ests = (D.discursivas && D.discursivas.estruturas) || [];
  if (!ests.length) return '';
  return '<div class="cartao esq"><h2>Esqueletos de peça e parecer (ANPD)</h2><p class="pequeno mudo">Domine os três moldes antes de treinar velocidade. Copie e preencha os colchetes com os fatos do enunciado.</p>' +
    ests.map((e) => '<details><summary><b>' + esc(e.nome) + '</b></summary><p class="pequeno"><b>Quando usar:</b> ' + esc(e.uso) + '</p><pre>' + esc(e.modelo) + '</pre></details>').join('') + '</div>';
}

// Sincronização inversa: traz do Painel TCU as respostas, cards e leituras do tronco comum. Pelo armazenamento do
// navegador só funciona com os dois abertos como arquivo no mesmo navegador: no claude.ai cada painel tem a própria
// origem e não enxerga o do outro. Por isso também aceita o arquivo de backup (.json) salvo no Painel TCU.
function sincronizarDoTCU(origem) {
  if (origem === undefined) origem = lerLS('painel-tcu-v1');
  if (origem && !origem.itens && origem.dados) origem = origem.dados;
  if (!origem || (!origem.itens && !origem.perfil)) { avisar('!', 'Progresso do Painel TCU não encontrado', 'No claude.ai, salve o backup em arquivo no Painel TCU (Ajustes) e escolha esse arquivo aqui.'); return; }
  let nItens = 0, nCards = 0, nLidos = 0;
  const num = (x) => Number(x) || 0;
  for (const [id, r] of Object.entries(origem.itens || {})) {
    if (!QI.has(id) || !Array.isArray(r)) continue;
    const at = S.itens[id];
    if (!at || num(r[4]) > num(at[4]) || (num(r[4]) === num(at[4]) && num(r[2]) + num(r[3]) > num(at[2]) + num(at[3]))) { S.itens[id] = r.map(num); nItens++; }
  }
  for (const [id, c] of Object.entries(origem.cards || {})) {
    if (!CI.has(id) || !Array.isArray(c)) continue;
    const at = S.cards[id];
    if (!at || num(c[5]) > num(at[5])) { S.cards[id] = c.map(num); nCards++; }
  }
  S.perfil.lidos ||= {};
  for (const [k, dt] of Object.entries((origem.perfil && origem.perfil.lidos) || {})) {
    if (ARTI.has(k) && /^\d{4}-\d\d-\d\d$/.test(dt) && (!S.perfil.lidos[k] || dt < S.perfil.lidos[k])) { S.perfil.lidos[k] = dt; nLidos++; }
  }
  Store.salvarTudo(); renderTudo();
  avisar('⇄', 'Tronco comum trazido do Painel TCU', pl(nItens, 'questão', 'questões') + ', ' + pl(nCards, 'card', 'cards') + ' e ' + pl(nLidos, 'artigo lido', 'artigos lidos') + ' aproveitados.');
}

