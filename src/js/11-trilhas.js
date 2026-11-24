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
  return { n, resp: resp.length, certos, acerto, minimo, status, novos: qs.filter((q) => !rec(q.id)).length, erros: resp.length - certos, visto: vistoEm(id) };
}
// Data em que o subtema foi estudado: a marcada na trilha ou, para o que veio antes desse registro, a do dia do plano
// com esse subtema em que a aula foi dada como feita
function vistoEm(id) {
  const t = (S.perfil.trilha || {})[id];
  if (t) return t;
  const d = DIAS.find((x) => x.st === id && S.perfil.feitos['aula:' + x.data]);
  return d ? d.data : null;
}
// Passar de tema fica registrado: abrir a aula, terminar uma sessão do subtema ou seguir para o próximo marca o subtema
// como estudado (com a data), e a trilha continua dali, mesmo antes do domínio, que segue medido pelas questões
function marcarEstudado(id) {
  if (!SUBTEMAS.get(id) || vistoEm(id)) return;
  S.perfil.trilha ||= {};
  S.perfil.trilha[id] = hojeISO();
  Store.salvar('perfil');
}
const ROTULO_ST = { vazio: 'sem itens ainda', novo: 'não começado', curso: 'em curso', dominado: 'dominado' };
// Próximo da trilha: o primeiro ainda não estudado nem dominado; com todos estudados, o primeiro ainda não dominado
function proximoSubtema(trilhaId) {
  const t = TRILHAS.find((x) => x.id === trilhaId);
  if (!t) return null;
  const est = t.subtemas.map((st) => [st, estadoSubtema(st.id)]).filter(([, e]) => e.n && e.status !== 'dominado');
  return (est.find(([, e]) => !e.visto) || est[0] || [null])[0];
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
  if (e.visto && e.status !== 'dominado') return '<span class="selo st-visto">aula feita</span>';
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
  if (!li) return '';
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
  const texto = (st.arts || []).filter((k) => ARTI.has(k)).map((k) => ARTI.get(k).texto).concat(li.ideia || '', partes, st.chave || []).filter(Boolean).join('\n').replace(/\*\*/g, '');
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
  const ult = UI.stUltimo && SUBTEMAS.get(UI.stUltimo);
  if (ult) {
    const t = TRILHAS.find((x) => x.id === ult.trilha), i = t.subtemas.findIndex((x) => x.id === ult.id);
    html += '<div class="cartao destaque retomar"><span class="rotulo">Onde você parou</span><b>' + esc(t.nome) + ' · ' + (i + 1) + '. ' + esc(ult.nome) + '</b><div class="linha-btns"><button class="btn primario retomar-st" data-acao="subtema" data-st="' + esc(ult.id) + '">Retomar</button></div></div>';
  }
  if (TRILHAS.length > 2) html += '<div class="chips cb-nav">' + TRILHAS.map((t) => '<button class="chip" data-acao="rolar" data-alvo="tr-' + esc(t.id) + '">' + esc(t.nome.replace(/ do zero$/, '')) + '</button>').join('') + '</div>';
  for (const t of TRILHAS) {
    const est = t.subtemas.map((st) => estadoSubtema(st.id));
    const dom = est.filter((e) => e.status === 'dominado').length, vistos = est.filter((e) => e.visto || e.status === 'dominado').length;
    const prox = proximoSubtema(t.id), iProx = prox ? t.subtemas.findIndex((x) => x.id === prox.id) : -1;
    html += '<div class="cartao trilha" id="tr-' + esc(t.id) + '"><div class="secao-cab"><h2>' + esc(t.nome) + '</h2><span class="mudo pequeno">' + vistos + ' de ' + t.subtemas.length + ' estudados · ' + dom + ' dominados</span></div>' +
      '<p class="pequeno mudo">' + esc(t.resumo) + '</p>' +
      (prox && vistos ? '<div class="linha-btns"><button class="btn pequeno primario continuar-st" data-acao="subtema" data-st="' + esc(prox.id) + '">Continuar: ' + (iProx + 1) + '. ' + esc(prox.nome) + '</button></div>' : '') + '<ol class="lista-st">' +
      t.subtemas.map((st, i) => {
        const e = est[i];
        return '<li><button data-acao="subtema" data-st="' + esc(st.id) + '"><span class="txt"><b>' + esc(st.nome) + '</b><span class="pequeno mudo">' + pl(e.n, 'questão', 'questões') + (e.resp ? ' · respondidas ' + e.resp + ' · acerto atual ' + Math.round(e.acerto * 100) + '%' : '') + '</span></span>' + chipEstado(e) + '</button></li>';
      }).join('') + '</ol></div>';
  }
  return html;
}
function passosDoSubtema(st, e) {
  const out = [], arts = artsDoSubtema(st);
  // O pré-teste traz os itens novos e, depois deles, os errados (idsSubtema, tipo 'pre'). Só antes da primeira resposta
  // do subtema, como no Hoje (ou para continuar o que ficou pausado); depois, quem pratica já pega os inéditos
  const kp = 't:' + st.id + ':';
  if (e.novos && (!e.resp || pausaDe(kp + 'pre'))) out.push({ rot: rotuloPausa(kp + 'pre', 'Pré-teste · ' + Math.min(8, e.novos + e.erros) + ' itens'), attrs: 'data-acao="trilha-sessao" data-st="' + esc(st.id) + '" data-tipo="pre"', primario: !e.resp });
  if (arts.length) out.push({ rot: 'Lei seca', attrs: 'data-acao="st-lei" data-st="' + esc(st.id) + '"' });
  out.push({ rot: 'Aula', attrs: 'data-acao="st-aula" data-st="' + esc(st.id) + '"' });
  if (e.n) out.push({ rot: rotuloPausa(kp + 'pratica', 'Praticar · ' + Math.min(20, e.n) + ' itens'), attrs: 'data-acao="trilha-sessao" data-st="' + esc(st.id) + '" data-tipo="pratica"', primario: !!e.resp });
  return out;
}
function renderSubtema(id) {
  const st = SUBTEMAS.get(id), e = estadoSubtema(id);
  const t = TRILHAS.find((x) => x.id === st.trilha);
  const pos = t.subtemas.findIndex((x) => x.id === id);
  const prox = t.subtemas[pos + 1];
  let html = '<button class="btn pequeno voltar" data-acao="subtema" data-st="">← Trilhas</button>' +
    '<div class="cartao destaque"><span class="rotulo">Subtema ' + (pos + 1) + ' de ' + t.subtemas.length + '</span><h2 class="titulo-st">' + esc(st.nome) + '</h2><p>' + esc(st.resumo) + '</p>' + htmlSimples(st) +
    '<div class="linha-st">' + chipEstado(e) + '<span class="pequeno mudo">' + (e.visto ? 'estudado em ' + esc(fmtData(e.visto, { day: '2-digit', month: '2-digit' })) + ' · ' : '') + pl(e.n, 'questão', 'questões') + ' · ' + e.resp + ' respondidas · ' + (e.resp ? 'acerto atual ' + Math.round(e.acerto * 100) + '%' : 'nenhuma respondida') + ' · domínio pede ' + e.minimo + ' respondidas com 80% de acerto</span></div>' +
    '<div class="linha-btns">' + passosDoSubtema(st, e).map((x, i, a) => '<button class="btn' + (x.primario ? ' primario' : '') + '" ' + x.attrs + '>' + (a.length > 1 ? (i + 1) + '. ' : '') + esc(x.rot) + '</button>').join('') +
    (e.erros ? '<button class="btn" data-acao="trilha-sessao" data-st="' + esc(id) + '" data-tipo="erros">' + esc(rotuloPausa('t:' + id + ':erros', 'Refazer erros · ' + e.erros)) + '</button>' : '') +
    '</div></div>';
  const arts = artsDoSubtema(st).filter((k) => ARTI.get(k));
  if (arts.length) {
    const caixa = 'art-st-' + id.replace(/[^\w-]/g, '');
    html += '<div class="cartao" id="lei-' + esc(id) + '"><h2>Lei seca deste subtema</h2><p class="pequeno mudo">Leia antes da aula, um artigo por vez: o texto abre aqui embaixo, com os grifos. Não precisa entender tudo agora; a aula explica o que ficar difícil.</p>' +
      htmlPalavras(st) + '<div class="chips">' +
      arts.map((k) => '<button class="chip" data-acao="art-inline" data-art="' + esc(k) + '" data-box="' + caixa + '" aria-expanded="false" aria-controls="' + caixa + '">' + esc(nomeArt(k)) + '</button>').join('') + '</div>' +
      '<div class="art-inline" id="' + caixa + '" data-lista="' + esc(arts.join(',')) + '" hidden></div></div>';
  }
  html += '<div class="cartao aula" id="aula-' + esc(id) + '"><h2>Aula</h2>' + (arts.length ? '' : htmlPalavras(st)) + legendaCamadas(true) +
    (arts.length ? '<p class="pequeno mudo">Toque numa citação sublinhada (“art. 3º”) para ler o artigo ali mesmo.</p>' : '') + htmlAula(st) +
    (e.n ? '<div class="linha-btns fim-aula"><button class="btn primario" data-acao="trilha-sessao" data-st="' + esc(id) + '" data-tipo="pratica">' + esc(rotuloPausa('t:' + id + ':pratica', 'Fixar com questões · ' + pl(Math.min(20, e.n), 'item', 'itens'))) + '</button></div>' : '') + '</div>';
  html += '<div class="cartao"><h2>Pontos-chave</h2><ul class="lista-chave">' + st.chave.map((c) => '<li>' + grifarProsa(c) + '</li>').join('') + '</ul></div>';
  html += '<div class="cartao"><h2>Como o Cebraspe tenta te derrubar</h2><ul class="lista-chave armadilhas">' + st.armadilhas.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul></div>';
  const reais = (POR_TEMA.get(id) || []).filter((q) => q.o).length;
  if (reais) html += '<p class="pequeno mudo">' + pl(reais, 'item real', 'itens reais') + ' do Cebraspe neste subtema, misturados aos demais.</p>';
  if (prox) html += '<div class="linha-btns"><button class="btn" data-acao="subtema" data-st="' + esc(prox.id) + '" data-de="' + esc(id) + '">Próximo: ' + esc(prox.nome) + ' ›</button></div>';
  return html;
}

