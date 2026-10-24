/* ================= Regras: questões ================= */
// Itens de português e inglês presos a um texto não voltam na revisão espaçada: rever o mesmo texto ensina o gabarito,
// não a leitura. No lugar deles, as sessões trazem textos inéditos. O erro continua contando nas estatísticas.
const SEM_REPETICAO = new Set(Q.filter((q) => q.ap != null && (BI.get(q.b) || {}).disciplina === 'linguas').map((q) => q.id));
function rec(id) { return S.itens[id]; }
function emRevisao(id) { const r = rec(id); return !!r && r[0] >= 0 && r[0] < 3 && !SEM_REPETICAO.has(id); }
function vencida(id) { const r = rec(id); return emRevisao(id) && r[1] <= HOJE(); }
function dominioItem(id) { const r = rec(id); return !r || r[0] < 0 ? 0 : Math.min(r[0], 5) / 5; }
function dominioBloco(bid) {
  const qs = POR_BLOCO.get(bid) || [];
  if (!qs.length) return null;
  return qs.reduce((s, q) => s + dominioItem(q.id), 0) / qs.length;
}
function dominadoVencido(id) { const r = rec(id); return !!r && r[0] >= 3 && r[1] <= HOJE() && !SEM_REPETICAO.has(id); }
function manutencaoFeitaHoje() { const d = S.perfil.dias[hojeISO()]; return (d && d.m) || 0; }
// Itens dominados vencidos que entram hoje (respeitando o limite diário), dos mais atrasados para os mais recentes
function manutencaoHoje() {
  const resta = Math.max(0, MANUTENCAO_DIA - manutencaoFeitaHoje());
  return resta ? Q.filter((q) => dominadoVencido(q.id)).sort((a, b) => rec(a.id)[1] - rec(b.id)[1]).slice(0, resta) : [];
}
function listaVencida() { return Q.filter((q) => vencida(q.id)).sort((a, b) => rec(a.id)[1] - rec(b.id)[1]); }
function nivelDe(xp) {
  let i = 0;
  while (i + 1 < NIVEIS.length && xp >= NIVEIS[i + 1][0]) i++;
  if (i === NIVEIS.length - 1) {
    const mandato = 1 + Math.floor((xp - NIVEIS[i][0]) / MANDATO_XP);
    const base = NIVEIS[i][0] + (mandato - 1) * MANDATO_XP;
    return { n: i + mandato, nome: NIVEIS[i][1] + (mandato > 1 ? ' · mandato ' + mandato : ''), base, prox: base + MANDATO_XP };
  }
  return { n: i + 1, nome: NIVEIS[i][1], base: NIVEIS[i][0], prox: NIVEIS[i + 1][0] };
}
function diaLog(iso) {
  iso = iso || hojeISO();
  if (!S.perfil.dias[iso]) S.perfil.dias[iso] = { r: 0, c: 0, e: 0, b: 0, xp: 0, k: 0, n: 0, a: [], t: {} };
  const d = S.perfil.dias[iso];
  if (d.k == null) d.k = 0;
  if (d.n == null) d.n = 0;
  if (!d.a || !Array.isArray(d.a) || !Object.isExtensible(d.a)) d.a = Array.from(d.a || []);
  if (!d.t || typeof d.t !== 'object' || !Object.isExtensible(d.t)) d.t = Object.assign({}, d.t || {});
  return d;
}
// Só a lista de artigos lidos de hoje é usada; as antigas saem para o documento do perfil não crescer sem limite
function podarPerfil() {
  // Marcas de migrações de versões antigas do app, que não existem mais
  delete S.perfil.migr; delete S.perfil.migrado;
  const limite = isoDeNum(HOJE() - 14);
  for (const [iso, d] of Object.entries(S.perfil.dias || {})) if (iso < limite && d.a && d.a.length) d.a = [];
}
function ativo(iso) { const d = S.perfil.dias[iso]; return !!d && (d.r + (d.k || 0) / 2) >= MIN_DIA_ATIVO; }

/* ================= Tempo de estudo ================= */
// O relógio do dia conta o tempo com o app aberto, visível e em uso. Sem toque, tecla ou rolagem por OCIOSO_S
// segundos (OCIOSO_LER_S na leitura, em que um artigo longo se lê sem tocar), ele para até o próximo toque. Cada
// intervalo vai para a atividade da tela: questões (sessões e simulados), cards, leitura (lei seca, artigo aberto,
// aula, trilhas, Como o Cebraspe cobra, glossário) e discursiva. O tempo no painel, no plano, no método e nos ajustes
// fica à parte ("o"), fora do total. Na leitura e na discursiva, um cronômetro na tela mostra o tempo do dia.
const OCIOSO_S = 180, OCIOSO_LER_S = 300, TIQUE_S = 15;
const ATIV = [['q', 'Questões'], ['c', 'Cards'], ['l', 'Leitura'], ['d', 'Discursiva']];
const LEITURA_MAIS = new Set(['trilha', 'cebraspe', 'glossario', 'pesquisar']);
let ultimoUso = Date.now(), ultimoTique = Date.now(), tempoNaoSalvo = 0;
function atividadeAtual() {
  // Artigo aberto na tela, aula, e o que se lê na folha (item revisado, termo, Investigar) são leitura, mesmo a partir
  // de um item da sessão
  const folha = document.getElementById('folha');
  if (UI.artInline || UI.folhaAula || (folha && !folha.hidden)) return 'l';
  // a tela de resultado da sessão (revisar os itens) também é questão
  if (sessao) return sessao.modo === 'cards' ? 'c' : 'q';
  if (UI.vista === 'lei') return 'l';
  if (UI.vista === 'mais') return UI.mais === 'discursiva' ? 'd' : LEITURA_MAIS.has(UI.mais) ? 'l' : 'o';
  return 'o';
}
function segundosEstudo(d) { const t = (d && d.t) || {}; return ATIV.reduce((s, [k]) => s + (Number(t[k]) || 0), 0); }
// Ritmo pessoal: medianas dos dias de estudo das duas últimas semanas, sem contar hoje (itens respondidos, itens inéditos,
// artigos lidos e minutos de estudo; cada mediana só conta os dias em que aquilo aconteceu). Com menos de 5 dias de estudo
// não há ritmo e valem os valores fixos. A meta automática e as missões do dia partem dele, então sobem com a pessoa.
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
    s: mediana(dias.map((d) => (d.r && d.t && d.t.q ? d.t.q / d.r : 0))),
  };
  ritmoCache = { chave, v };
  return v;
}
// Horas de estudo por semana: a média das duas últimas semanas inteiras (null com menos de 5 dias de estudo nelas)
function horasSemana() {
  const desde = isoDeNum(HOJE() - 14), h = hojeISO();
  const dias = Object.entries(S.perfil.dias || {}).filter(([iso]) => iso >= desde && iso < h);
  if (dias.filter(([iso]) => ativo(iso)).length < 5) return null;
  return dias.reduce((a, [, d]) => a + segundosEstudo(d), 0) / 2 / 3600;
}
const limitar = (x, min, max) => Math.min(max, Math.max(min, x));
// Meta diária de itens: automática (90% da mediana do ritmo, de 10 em 10, entre 20 e 200) ou a fixa escolhida em Ajustes
function metaAuto() { const r = ritmo(); return r && r.r ? limitar(Math.round((r.r * 0.9) / 10) * 10, 20, 200) : null; }
function metaDia() { return (!S.perfil.metaFixa && metaAuto()) || S.perfil.meta || 30; }
// Questões do tema (Passo 2 do roteiro, ~15 min): quantas cabem em 15 min no tempo por item medido, de 5 em 5, entre 8 e 20
function nPreTeste() { const r = ritmo(); return r && r.s ? limitar(Math.round(900 / r.s / 5) * 5, 8, 20) : 8; }
// Artigos de leitura por dia: a mediana dos dias com leitura, entre 6 e 12 (6 sem ritmo)
function metaArtigos() { const r = ritmo(); return r && r.a ? limitar(r.a, 6, 12) : 6; }
function fmtDur(seg) { const m = Math.floor((seg || 0) / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); }
// Duração prevista no plano para o dia ("1h45", "3h"); dia livre ou fora do plano não tem meta de tempo
function metaMin(iso) { const dia = DIAS.find((x) => x.data === iso); const m = dia && /^(\d+)h(\d+)?$/.exec(dia.duracao || ''); return m ? Number(m[1]) * 60 + Number(m[2] || 0) : null; }
function marcarUso() { ultimoUso = Date.now(); }
function ocioso(k, agora) { return agora - ultimoUso > (k === 'l' ? OCIOSO_LER_S : OCIOSO_S) * 1000; }
function fmtRelogio(seg) { const s = Math.floor(seg), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); }
// Cronômetro da leitura e da discursiva: o tempo do dia nessa atividade, correndo enquanto conta, ou pausado
function atualizarCronometro() {
  const el = document.getElementById('cronometro');
  if (!el) return;
  const k = atividadeAtual(), mostra = (k === 'l' || k === 'd') && !document.hidden;
  el.hidden = !mostra;
  if (!mostra) return;
  const agora = Date.now(), parado = ocioso(k, agora);
  const seg = ((((S.perfil.dias[hojeISO()] || {}).t) || {})[k] || 0) + (parado ? 0 : Math.min(agora - ultimoTique, (k === 'l' ? OCIOSO_LER_S : OCIOSO_S) * 1000) / 1000);
  el.classList.toggle('parado', parado);
  el.innerHTML = '<i aria-hidden="true"></i>' + (k === 'l' ? 'Leitura' : 'Discursiva') + ' hoje <b class="mono">' + fmtRelogio(seg) + '</b>' + (parado ? ' · pausado' : '');
}
// final: chamada ao esconder ou fechar a página, para gravar o pedaço do intervalo em curso
function contarTempo(final) {
  const agora = Date.now();
  const k = atividadeAtual();
  // Com uso recente, todo o intervalo desde o último tique conta, mesmo que o navegador tenha atrasado o relógio; o teto
  // é o próprio limite de ociosidade (um aparelho que dormiu não soma horas: sem toque recente, nada conta)
  const dt = Math.min(agora - ultimoTique, (k === 'l' ? OCIOSO_LER_S : OCIOSO_S) * 1000) / 1000;
  ultimoTique = agora;
  if ((document.hidden && !final) || ocioso(k, agora) || dt < 1) return;
  if (!S.perfil.tempoDesde) S.perfil.tempoDesde = hojeISO();
  const t = (diaLog().t ||= {});
  t[k] = Math.round((t[k] || 0) + dt);
  tempoNaoSalvo += dt;
  if (final || tempoNaoSalvo >= 60) { tempoNaoSalvo = 0; Store.salvar('perfil'); }
  atualizarRelogioDia();
}
function atualizarRelogioDia() {
  const el = document.getElementById('tempo-hoje');
  if (!el) return;
  const seg = segundosEstudo(S.perfil.dias[hojeISO()]), meta = metaMin(hojeISO());
  el.textContent = fmtDur(seg);
  const b = document.querySelector('#tempo-barra > i');
  if (b && meta) b.style.width = Math.min(100, Math.round((seg / 60 / meta) * 100)) + '%';
}
// Colunas empilhadas por atividade, uma por dia, na mesma escala; a linha tracejada marca a meta do plano
function colunasTempo(dias, alturaPx) {
  const max = Math.max(3600, ...dias.map(([iso, d]) => Math.max(segundosEstudo(d), (metaMin(iso) || 0) * 60)));
  const hoje = hojeISO();
  return dias.map(([iso, d]) => {
    const t = (d && d.t) || {}, seg = segundosEstudo(d), meta = metaMin(iso);
    const partes = ATIV.filter(([k]) => (t[k] || 0) >= 30).map(([k, nome]) => '<i style="height:' + Math.max(2, Math.round(((t[k] || 0) / max) * alturaPx)) + 'px;background:var(--at-' + k + ')"></i>').join('');
    const dica = fmtData(iso, { weekday: 'short', day: '2-digit', month: '2-digit' }) + ': ' + (seg ? fmtDur(seg) + ' (' + ATIV.filter(([k]) => (t[k] || 0) >= 60).map(([k, nome]) => nome.toLowerCase() + ' ' + fmtDur(t[k])).join(', ') + ')' : 'sem tempo registrado') + (meta ? ' · meta ' + fmtDur(meta * 60) : '');
    return '<div class="tempo-col' + (iso === hoje ? ' hoje' : '') + '" data-dica="' + esc(dica) + '"><div class="col" style="height:' + alturaPx + 'px">' +
      (meta ? '<b class="tempo-meta" style="bottom:' + Math.round(((meta * 60) / max) * alturaPx) + 'px"></b>' : '') + partes + '</div>' +
      '<span>' + esc(dias.length > 7 ? iso.slice(8) : fmtData(iso, { weekday: 'short' }).replace('.', '').slice(0, 3)) + '</span></div>';
  }).join('');
}
function legendaTempo(t) {
  return '<div class="tempo-legenda">' + ATIV.map(([k, nome]) => '<span class="tempo-leg"><i style="background:var(--at-' + k + ')"></i>' + nome + ' <b class="mono">' + fmtDur(t[k] || 0) + '</b></span>').join('') + '</div>';
}
function diasAte(n) { const h = HOJE(), out = []; for (let x = h - n + 1; x <= h; x++) { const iso = isoDeNum(x); out.push([iso, S.perfil.dias[iso] || null]); } return out; }
// Cartão do painel: tempo de hoje contra a meta do plano, por atividade, o que ele rendeu e os últimos sete dias
function cartaoTempo() {
  const h = hojeISO(), d = S.perfil.dias[h] || {}, t = d.t || {};
  const seg = segundosEstudo(d), meta = metaMin(h);
  const r = d.r || 0, tq = t.q || 0;
  const sem = diasAte(7), semSeg = sem.reduce((a, [, x]) => a + segundosEstudo(x), 0);
  const semDias = sem.filter(([, x]) => segundosEstudo(x) >= 600).length;
  const semMetas = sem.filter(([iso]) => metaMin(iso)), semOk = semMetas.filter(([iso, x]) => segundosEstudo(x) >= metaMin(iso) * 60).length;
  const met = (v, rot) => '<div><b class="mono">' + v + '</b><span>' + rot + '</span></div>';
  return '<div class="cartao"><div class="secao-cab"><h2>Tempo de estudo</h2><span class="mono pequeno mudo">' + (meta ? 'meta do plano ' + fmtDur(meta * 60) : 'dia sem meta no plano') + '</span></div>' +
    '<div class="tempo-topo"><span class="tempo-grande mono" id="tempo-hoje">' + fmtDur(seg) + '</span><span class="mudo">' + (meta ? (seg >= meta * 60 ? 'meta cumprida' : 'faltam ' + fmtDur(meta * 60 - seg)) : 'hoje') + '</span></div>' +
    (meta ? '<div class="barra" id="tempo-barra"><i style="width:' + Math.min(100, Math.round((seg / 60 / meta) * 100)) + '%"></i></div>' : '') +
    '<p class="pequeno mudo">Últimos 7 dias: <b>' + fmtDur(semSeg) + '</b> em ' + pl(semDias, 'dia', 'dias') + (semMetas.length ? ' · meta cumprida em ' + semOk + ' de ' + semMetas.length : '') + '.</p>' +
    '<details class="det-tempo" data-det="tempo"' + (UI.det.tempo ? ' open' : '') + '><summary>Detalhes de hoje e da semana</summary>' +
    (seg ? '<div class="tempo-pilha" role="img" aria-label="' + esc('Hoje por atividade: ' + ATIV.map(([k, nome]) => nome + ' ' + fmtDur(t[k] || 0)).join(', ')) + '">' + ATIV.filter(([k]) => (t[k] || 0) >= 30).map(([k, nome]) => '<i style="flex-grow:' + t[k] + ';background:var(--at-' + k + ')" data-dica="' + esc(nome + ': ' + fmtDur(t[k])) + '"></i>').join('') + '</div>' : '') +
    legendaTempo(t) +
    '<div class="estat tempo-estat">' + met(r, 'itens respondidos') + met(r ? pct(d.c || 0, r) + '%' : '—', 'de acerto') +
    met(tq >= 60 && r ? Math.round(tq / r) + ' s' : '—', 'por item') + met(tq >= 300 && r ? Math.round(r / (tq / 3600)) : '—', 'itens por hora') +
    met(d.k || 0, 'cards revisados') + met((d.a || []).length, 'artigos lidos') + '</div>' +
    '<div class="tempo-semana" role="img" aria-label="' + esc('Últimos 7 dias: ' + sem.map(([iso, x]) => fmtData(iso, { weekday: 'short' }) + ' ' + fmtDur(segundosEstudo(x))).join(', ')) + '">' + colunasTempo(sem, 64) + '</div>' +
    '<p class="pequeno mudo">' + (semDias ? 'Média de ' + fmtDur(semSeg / semDias) + ' por dia de estudo. ' : '') + 'Conta só o tempo com o app aberto e em uso; parado por ' + OCIOSO_S / 60 + ' minutos (' + OCIOSO_LER_S / 60 + ' na leitura), o relógio pausa.' + ((t.o || 0) >= 60 ? ' Hoje, mais ' + fmtDur(t.o) + ' no painel, no plano e nos ajustes, que não entram na conta.' : '') + ' <button class="linkish" data-acao="mais" data-sub="progresso">Histórico</button></p></details></div>';
}
// Progresso: 14 dias em colunas, resumo de 30 dias, divisão por atividade, ritmo e tabela dos últimos 7 dias
function cartaoTempoHistorico() {
  const d14 = diasAte(14), d30 = diasAte(30);
  const tot = { q: 0, c: 0, l: 0, d: 0 };
  let seg30 = 0, dias30 = 0, r30 = 0, tq30 = 0, metas = 0, metasOk = 0, melhor = null;
  for (const [iso, d] of d30) {
    const s = segundosEstudo(d), t = (d && d.t) || {};
    ATIV.forEach(([k]) => { tot[k] += Number(t[k]) || 0; });
    seg30 += s; if (s >= 600) dias30++;
    if ((t.q || 0) >= 60 && d.r) { r30 += d.r; tq30 += t.q; }
    const m = metaMin(iso);
    if (m && iso <= hojeISO()) { metas++; if (s >= m * 60) metasOk++; }
    if (s && (!melhor || s > melhor[1])) melhor = [iso, s];
  }
  const maxAt = Math.max(1, ...Object.values(tot));
  let html = '<div class="cartao"><div class="secao-cab"><h2>Tempo de estudo</h2><span class="mudo pequeno">Últimos 14 dias</span></div>' +
    '<div class="tempo-semana tempo-14" role="img" aria-label="Tempo de estudo por dia nos últimos 14 dias; os valores estão na tabela abaixo">' + colunasTempo(d14, 90) + '</div>' + legendaTempo(tot) +
    '<div class="estat">' +
    '<div><b class="mono">' + fmtDur(seg30) + '</b><span>em 30 dias</span></div>' +
    '<div><b class="mono">' + (dias30 ? fmtDur(seg30 / dias30) : '—') + '</b><span>média por dia de estudo</span></div>' +
    '<div><b class="mono">' + (metas ? metasOk + ' de ' + metas : '—') + '</b><span>metas de tempo cumpridas</span></div>' +
    '<div><b class="mono">' + (tq30 >= 600 ? Math.round(r30 / (tq30 / 3600)) : '—') + '</b><span>itens por hora (30 dias)</span></div>' +
    '<div><b class="mono">' + (tq30 >= 600 ? Math.round(tq30 / r30) + ' s' : '—') + '</b><span>por item (30 dias)</span></div>' +
    '<div><b class="mono">' + (melhor ? fmtDur(melhor[1]) : '—') + '</b><span>' + (melhor ? 'melhor dia (' + esc(fmtData(melhor[0], { day: '2-digit', month: '2-digit' })) + ')' : 'melhor dia') + '</span></div></div>' +
    '<div class="dominio">' + ATIV.map(([k, nome]) => '<div class="dom-linha"><span class="nome">' + nome + '</span>' + barra(tot[k] / maxAt, '', '--accent:var(--at-' + k + ')') + '<span class="val">' + pct(tot[k], seg30) + '%</span></div>').join('') + '</div>' +
    '<div class="tabela-env"><table class="tabela"><thead><tr><th>Dia</th><th>Tempo</th><th>Itens</th><th>Acerto</th><th>Cards</th></tr></thead><tbody>' +
    diasAte(7).reverse().map(([iso, d]) => '<tr><td>' + esc(fmtData(iso, { weekday: 'short', day: '2-digit', month: '2-digit' })) + '</td><td class="mono">' + fmtDur(segundosEstudo(d)) + (metaMin(iso) ? ' / ' + fmtDur(metaMin(iso) * 60) : '') + '</td><td class="mono">' + ((d && d.r) || 0) + '</td><td class="mono">' + (d && d.r ? pct(d.c, d.r) + '%' : '—') + '</td><td class="mono">' + ((d && d.k) || 0) + '</td></tr>').join('') +
    '</tbody></table></div>' +
    '<p class="pequeno mudo">' + (S.perfil.tempoDesde ? 'O relógio conta desde ' + esc(fmtData(S.perfil.tempoDesde, { day: '2-digit', month: '2-digit', year: 'numeric' })) + '. ' : '') + 'Itens por hora e tempo por item medem só o tempo em sessões de questões. Painel, plano e ajustes não entram no total.</p></div>';
  return html;
}
// Dias seguidos de estudo. Domingo não quebra, e cada semana (de segunda a sábado) tem uma folga: um dia sem estudo
// não zera a sequência, para um imprevisto não apagar semanas de constância. O dia de folga não conta como estudado.
function sequencia() {
  let n = 0, dia = HOJE();
  if (!ativo(isoDeNum(dia))) dia--;
  const folgas = new Set();
  for (let k = 0; k < 800; k++) {
    const iso = isoDeNum(dia);
    if (ativo(iso)) n++;
    else if (diaSemana(iso) !== 0) {
      const semana = dia - ((diaSemana(iso) + 6) % 7);
      if (folgas.has(semana)) break;
      folgas.add(semana);
    }
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
  // A sequência de acertos só multiplica XP no relâmpago; no treino e na revisão o que vale é ler o comentário, não correr
  return modo === 'relampago' ? Math.round(x * (1 + Math.min(combo, 10) * 0.05)) : x;
}
// Intervalo adaptativo. A escada INTERVALOS é a base, e dois fatores a ajustam a partir do nível 2:
// - o do item: erros e acertos com dúvida encurtam; acertos seguros repetidos alongam (como a facilidade do Anki);
// - o da pessoa: a retenção medida nas revisões de manutenção dos últimos 30 dias calibra todos os intervalos para
//   mirar 90% de lembrança. Com esquecimento exponencial, R = e^(−t/S), o intervalo que dá a retenção-alvo é
//   t × ln(0,9) ÷ ln(R medida). Abaixo de 20 revisões medidas, o fator fica neutro.
//   Só contam as revisões feitas até 1,5 vez o intervalo programado: com o teto diário de manutenção, muitos itens
//   voltam atrasados, e o esquecimento maior desses atrasos puxaria todos os intervalos para baixo (na simulação, o
//   fator ia ao piso de 0,7 e o atraso crescia).
// Os níveis 0 e 1 (erro recente) não mudam: rever logo o erro é o que mais rende.
const RETENCAO_ALVO = 0.9;
function fatorItem(r) {
  const erros = Math.min(r[3] || 0, 4), duvidas = Math.min((r[5] || 0) + (r[6] || 0), 3), seguros = Math.max(0, (r[2] || 0) - (r[5] || 0) - 1);
  return Math.max(0.5, Math.min(1.3, 1 - 0.12 * erros - 0.08 * duvidas + 0.06 * Math.min(seguros, 5)));
}
function retencaoMedida() {
  const hoje = HOJE();
  let m = 0, mc = 0;
  for (const [iso, d] of Object.entries(S.perfil.dias || {})) if (hoje - diaNum(iso) <= 30) { m += d.mp || 0; mc += d.mpc || 0; }
  return { m, mc, ret: m ? mc / m : null, calibra: m >= 20 };
}
function fatorPessoa() {
  const x = retencaoMedida();
  if (!x.calibra) return 1;
  const ret = Math.max(0.5, Math.min(0.99, x.ret));
  return Math.max(0.7, Math.min(1.5, Math.log(RETENCAO_ALVO) / Math.log(ret)));
}
function intervalo(r) {
  const base = INTERVALOS[r[0]];
  return tetoProva(r[0] < 2 ? base : Math.max(1, Math.round(base * fatorItem(r) * fatorPessoa())));
}
// Perto da prova, nenhuma revisão fica marcada para depois dela: o prazo para dois dias antes (o último fim de semana
// de revisão); com a prova a dois dias ou menos, ou já passada, o intervalo segue normal
function tetoProva(ivl) {
  const falta = diaNum(dataProva()) - HOJE() - 2;
  return falta >= 1 ? Math.min(ivl, falta) : ivl;
}
function registrar(q, resp, duvida) {
  golpeRecente = null;
  const hoje = HOJE();
  const r = S.itens[q.id] ? S.itens[q.id].slice() : [-1, 0, 0, 0, 0, 0, 0];
  const antes = r[0];
  const estavaNaLista = antes >= 0 && antes < 3 && !SEM_REPETICAO.has(q.id);
  const eraManutencao = antes >= 3 && r[1] <= hoje;
  const pontual = eraManutencao && hoje - r[4] <= 1.5 * Math.max(1, r[1] - r[4]);
  // Responder de novo no mesmo dia não é revisão espaçada: o acerto repetido não sobe de nível
  const jaRespondidoHoje = antes >= 0 && r[4] === hoje;
  let ok = null;
  if (resp === BRANCO) r[0] = 0;
  else {
    ok = resp === q.g;
    if (antes < 0) r[7] = ok ? 1 : 0;
    if (ok) {
      r[2]++;
      if (antes < 0) r[0] = duvida ? 2 : 4;
      else if (duvida) r[0] = Math.max(1, Math.min(antes, 2));
      else r[0] = jaRespondidoHoje ? Math.max(1, antes) : Math.min(5, antes + 1);
      if (duvida) r[5]++;
    } else { r[3]++; r[0] = 0; if (duvida) r[6]++; }
  }
  r[1] = hoje + intervalo(r);
  r[4] = hoje;
  S.itens[q.id] = r;
  Store.itensSujos.add(parteItem(q.id));
  if (estavaNaLista && r[0] >= 3) S.perfil.saidos = (S.perfil.saidos || 0) + 1;
  const d = diaLog();
  if (resp === BRANCO) d.b = (d.b || 0) + 1; else { d.r++; if (ok) d.c++; else d.e++; }
  // Sequência do dia para o avaliador de cansaço: k/l = acerto/erro em item que você já sabia (nível 3 ou mais, ou
  // acertado mais cedo no mesmo dia); c/e = acerto/erro nos demais
  if (resp !== BRANCO) {
    const sabia = antes >= 3 || (antes >= 1 && jaRespondidoHoje);
    d.sq = ((d.sq || '') + (sabia ? (ok ? 'k' : 'l') : ok ? 'c' : 'e')).slice(-30);
  }
  if (antes < 0 && resp !== BRANCO) d.ni = (d.ni || 0) + 1;
  if (ok) golpeChefe(q);
  if (eraManutencao) { d.m = (d.m || 0) + 1; if (ok && !duvida) d.mc = (d.mc || 0) + 1; }
  if (pontual) { d.mp = (d.mp || 0) + 1; if (ok && !duvida) d.mpc = (d.mpc || 0) + 1; }
  if (ok === false) sugerirPesquisaDoErro(q);
  return ok;
}
// Avaliador de cansaço. Depois de CANSACO_MIN itens no dia, olha os 20 últimos: há cansaço quando você erra o que já
// sabia (3 lapsos ou mais, numa taxa bem acima da sua taxa de esquecimento na revisão) ou quando o acerto cai 15 pontos
// abaixo do seu habitual com algum lapso, ou 25 pontos sem lapso. O aviso não se repete antes de mais 25 itens.
const CANSACO_MIN = 40;
function habito() {
  const desde = isoDeNum(HOJE() - 14), h = hojeISO();
  let c = 0, r = 0, m = 0, mc = 0;
  for (const [iso, d] of Object.entries(S.perfil.dias || {})) {
    if (iso < desde || iso >= h) continue;
    if ((d.r || 0) >= 10) { c += d.c || 0; r += d.r; }
    m += d.m || 0; mc += d.mc || 0;
  }
  return { acerto: r >= 100 ? c / r : 0.75, retencao: m >= 20 ? mc / m : 0.85 };
}
function avaliarCansaco() {
  const d = diaLog(), u = (d.sq || '').slice(-20);
  if ((d.r || 0) < CANSACO_MIN || u.length < 20) return null;
  const ult = (d.cz || []).slice(-1)[0];
  if (ult && d.r - ult < 25) return null;
  const n = (ch) => u.split(ch).length - 1;
  const lapsos = n('l'), sabidos = lapsos + n('k'), acerto = (n('c') + n('k')) / 20, h = habito(), queda = h.acerto - acerto;
  const muitosLapsos = lapsos >= 3 && lapsos / sabidos >= Math.max(0.3, 2 * (1 - h.retencao));
  if (!(muitosLapsos || (queda >= 0.15 && lapsos >= 1) || queda >= 0.25)) return null;
  d.cz = (d.cz || []).concat(d.r);
  return { n: d.r, lapsos, sabidos, acerto, base: h.acerto };
}
// Ponto de cansaço pessoal: a mediana do item em que o primeiro aviso do dia apareceu, nos últimos 30 dias (com 3 ou
// mais dias de aviso)
function pontoCansaco() {
  const desde = isoDeNum(HOJE() - 30);
  const xs = Object.entries(S.perfil.dias || {}).filter(([iso, d]) => iso >= desde && d.cz && d.cz.length).map(([, d]) => d.cz[0]).sort((a, b) => a - b);
  return xs.length >= 3 ? xs[Math.floor((xs.length - 1) / 2)] : null;
}
function avisoCansaco(cz) {
  const pc = pontoCansaco(), partes = [];
  if (cz.lapsos) partes.push(pl(cz.lapsos, 'erro', 'erros') + ' em itens que você já sabia (de ' + cz.sabidos + ' desse tipo)');
  partes.push('acerto de ' + Math.round(cz.acerto * 100) + '%, contra ' + Math.round(cz.base * 100) + '% no seu habitual');
  return '<div class="cartao cansaco" role="status"><b>Sinal de cansaço</b><p>Você já respondeu ' + cz.n + ' itens hoje. Nos últimos 20: ' + partes.join('; ') + '.' +
    (pc ? ' Nos seus dias recentes, o cansaço aparece perto do item ' + pc + '.' : '') + '</p>' +
    '<p class="pequeno">Daqui em diante cada item rende menos, e o erro de distração entra na revisão como se fosse falta de estudo. Uma pausa de 15 minutos (levantar, beber água, olhar longe da tela) ou parar por hoje rende mais que seguir.</p>' +
    '<div class="linha-btns"><button class="btn" data-acao="sair-sessao">Parar e guardar a sessão</button></div></div>';
}
function ganharXP(x) {
  if (!x) return;
  const antes = nivelDe(S.perfil.xp).n;
  S.perfil.xp += x;
  diaLog().xp += x;
  const depois = nivelDe(S.perfil.xp);
  if (depois.n > antes) { avisar('N' + depois.n, 'Subiu de nível', depois.nome); tocar('festa'); }
}
function verificarMeta() {
  const d = diaLog();
  if (!d.metaOk && d.r >= metaDia()) { d.metaOk = 1; ganharXP(50); avisar('M', 'Meta do dia cumprida', '+50 XP de bônus'); conquistar('meta'); }
  verificarRPG();
}
function conquistar(id) {
  if (S.perfil.conq[id]) return;
  S.perfil.conq[id] = hojeISO();
  const c = CONQ.find((x) => x.id === id);
  if (c) avisar(c.ic, 'Conquista: ' + c.nome, c.desc);
}
function verificarConquistas(ctx) {
  ctx = ctx || {};
  const tem = (id) => !!S.perfil.conq[id];
  const se = (cond, id) => { if (cond) conquistar(id); };
  const t = totais();
  se(t.r >= 1, 'primeira'); se(t.r >= 100, 'r100'); se(t.r >= 500, 'r500'); se(t.r >= 1000, 'r1000');
  se(t.k >= 50, 'cards50'); se(t.k >= 300, 'cards300');
  const seq = sequencia();
  if (seq > (S.perfil.melhorSeq || 0)) S.perfil.melhorSeq = seq;
  se(seq >= 7, 'seq7'); se(seq >= 14, 'seq14'); se(seq >= 30, 'seq30'); se(seq >= 60, 'seq60'); se(seq >= 100, 'seq100');
  // Dias: estudo, meta, recordes do dia, manutenção, roteiro, recuperação e tempo
  let ativos = 0, metas = 0, manut = 0, roteiros = 0, seg = 0;
  const xpSem = {};
  for (const [iso, d] of Object.entries(S.perfil.dias)) {
    const sem = isoDeNum(diaNum(iso) - ((diaSemana(iso) + 6) % 7));
    xpSem[sem] = (xpSem[sem] || 0) + (d.xp || 0);
    if (ativo(iso)) ativos++;
    if (d.metaOk) metas++;
    manut += d.m || 0;
    if (d.rt) roteiros++;
    if (d.pd) conquistar('recuperacao');
    if (d.r >= 30 && d.c / d.r >= 0.9) conquistar('certeiro');
    const s = segundosEstudo(d);
    seg += s;
    se(s >= 3600, 'hora1'); se(s >= 3 * 3600, 'hora3');
    // Domingo estudado com o sábado anterior também estudado
    if (!tem('fds') && diaSemana(iso) === 0 && ativo(iso) && ativo(isoDeNum(diaNum(iso) - 1))) conquistar('fds');
  }
  se(ativos >= 30, 'dias30'); se(ativos >= 100, 'dias100');
  se(metas >= 10, 'meta10');
  se(manut >= 50, 'memoria50'); se(roteiros >= 7, 'roteiro7'); se(seg >= 100 * 3600, 'horas100');
  // XP por semana (de segunda a domingo) e a maior série de semanas seguidas com 5.000 XP ou mais
  let serie = 0, melhorSerie = 0;
  const sems = Object.keys(xpSem).sort();
  if (sems.length) for (let n = diaNum(sems[0]); n <= HOJE(); n += 7) { serie = (xpSem[isoDeNum(n)] || 0) >= 5000 ? serie + 1 : 0; melhorSerie = Math.max(melhorSerie, serie); }
  se(melhorSerie >= 4, 'semanas4'); se(melhorSerie >= 12, 'semanas12');
  se(S.simulados.length >= 1, 'sim1'); se(S.simulados.length >= 5, 'sim5');
  se(S.simulados.some((s) => s.n >= 30 && s.liq / s.n >= 0.7), 'sim70');
  se(S.simulados.some((s) => s.n >= 30 && s.liq / s.n >= 0.8), 'sim80');
  se(S.simulados.some((s) => s.n >= Math.min(120, TOTAL_PROVA)), 'prova120');
  const lidos = Object.keys(S.perfil.lidos || {}).length;
  se(lidos >= 20, 'lei20'); se(lidos >= 100, 'lei100'); se(lidos >= 500, 'lei500');
  if (!tem('leitodas') && ARTS.length && ARTS.every((a) => (S.perfil.lidos || {})[a.k])) conquistar('leitodas');
  const saidos = S.perfil.saidos || 0;
  se(saidos >= 25, 'lista25'); se(saidos >= 100, 'lista100');
  const pesq = Object.values(S.pesquisa).filter((p) => p.s).length;
  se(pesq >= 10, 'pesq10'); se(pesq >= 30, 'pesq30');
  se((S.perfil.recordes.ex || 0) >= 5, 'explicar5');
  // Histórico das questões: dúvidas marcadas, itens diferentes, reais, múltipla escolha e domínio dos difíceis
  let duv = 0, vistos = 0, reais = 0, me = 0, dificeis = 0;
  for (const [id, r] of Object.entries(S.itens)) {
    duv += (r[5] || 0) + (r[6] || 0);
    if (r[0] < 0) continue;
    vistos++;
    const q = QI.get(id);
    if (!q) continue;
    if (q.o) reais++;
    if (q.al) me++;
    if (q.d === 3 && r[0] >= 3) dificeis++;
  }
  se(duv >= 20, 'calibrado'); se(vistos >= Math.ceil(Q.length / 2), 'metade');
  se(reais >= 50, 'reais50'); se(reais >= 300, 'reais300'); se(dificeis >= 50, 'casca');
  if (!tem('blocos20')) {
    const fortes = BLOCOS.filter((b) => (dominioBloco(b.id) || 0) >= 0.8).length;
    se(fortes >= 1, 'bloco80'); se(fortes >= 5, 'blocos5'); se(fortes >= 20, 'blocos20');
  }
  if (!tem('p1') && P1.every((b) => (dominioBloco(b) || 0) >= 0.6)) conquistar('p1');
  if (!tem('disciplina') && DISC.some((d) => dominioDisciplina(d.id) >= 0.7)) conquistar('disciplina');
  if (!tem('trilha')) {
    for (const tr of TRILHAS) {
      const sts = tr.subtemas.map((st) => estadoSubtema(st.id)).filter((e) => e.n), dom = sts.filter((e) => e.status === 'dominado').length;
      se(dom >= 1, 'subtema'); se(sts.length && dom === sts.length, 'trilha');
    }
  }
  // Discursivas: tentativas salvas e a melhor fração da nota
  let tent = 0, melhor = 0;
  for (const [id, st] of Object.entries(S.disc)) {
    const tema = TEMAS_DISC.find((x) => x.id === id);
    for (const x of st.tentativas || []) { tent++; if (tema && tema.pontos) melhor = Math.max(melhor, x.nq / tema.pontos); }
  }
  se(tent >= 1, 'disc1'); se(tent >= 5, 'disc5'); se(melhor >= 0.7, 'discnota');
  se(CONTEST.length >= 1, 'lince');
  // Jornada: baús, chefões, saque e nível
  const r = rpg();
  const baus = Math.max(r.baus || 0, Object.values(r.m || {}).filter((x) => x && x.bau).length);
  se(baus >= 1, 'bau1'); se(baus >= 7, 'bau7'); se(baus >= 30, 'bau30');
  const trofeus = (r.trofeus || []).length;
  se(trofeus >= 1, 'chefe1'); se(trofeus >= 5, 'chefe5'); se(trofeus >= 10, 'chefe10');
  const nv = nivelDe(S.perfil.xp).n;
  se(nv >= 10, 'nivel10'); se(nv >= 20, 'nivel20'); se(nv >= 30, 'nivel30');
  if (ctx.respondeu) {
    const h = new Date().getHours();
    se(h >= 23, 'coruja'); se(h >= 4 && h < 7, 'madrugador');
  }
  const rt = roteiroHoje();
  if (rt && rt.passos.every((p) => p.feito) && (S.perfil.dias[hojeISO()] || {}).r > 0) { diaLog().rt = 1; conquistar('roteiro'); }
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
  // "Errei" (intervalo 0) volta no fim da própria sessão e, depois, amanhã. O intervalo guardado segue crescendo;
  // só o vencimento para antes da prova
  return [HOJE() + tetoProva(Math.max(1, ivl)), ivl, ease, reps, lapses, HOJE()];
}
function avaliarCard(id, nota) {
  const novo = cardNovo(id);
  S.cards[id] = calcularCard(id, nota);
  const d = diaLog();
  d.k = (d.k || 0) + 1;
  if (novo) d.n = (d.n || 0) + 1;
  verificarRPG();
  return novo;
}
function cardsVencidos(blocos) {
  const set = blocos && blocos.length ? new Set(blocos) : null;
  return CARDS.filter((c) => (!set || set.has(c.nota.b)) && cardVencido(c.id)).sort((a, b) => S.cards[a.id][0] - S.cards[b.id][0]);
}
function cardsNovos(blocos) {
  const set = blocos && blocos.length ? new Set(blocos) : null;
  // Prazos, números e quóruns entram antes: é o dado arbitrário que o card fixa melhor; conceito se treina com questão
  return CARDS.filter((c) => (!set || set.has(c.nota.b)) && cardNovo(c.id)).sort((a, b) => (b.nota.nu || 0) - (a.nota.nu || 0));
}
const REV_MAX = 60;
function novosRestantesHoje() { return Math.max(0, (S.perfil.novosCards || 20) - (diaLog().n || 0)); }

/* ================= Pesquisa e glossário ================= */
function termosDe(texto, limite, maxFreq) {
  const achados = [];
  for (const g of GLOSS) {
    if (g.j || (maxFreq != null && g.f > maxFreq)) continue;
    const m = g.re.exec(texto);
    if (m) achados.push({ g, i: m.index, len: m[0].length });
  }
  achados.sort((a, b) => a.g.f - b.g.f);
  return limite ? achados.slice(0, limite) : achados;
}
// Palavras de polaridade (restringem, generalizam ou excepcionam) grifadas no enunciado depois da resposta: é onde o
// Cebraspe costuma mexer. Antes da resposta, nada é grifado, para o grifo não virar pista. Só toca o texto fora das tags.
const RE_POLARIDADE = /\b(exclusivamente|somente|apenas|unicamente|sempre|nunca|jamais|qualquer|tod[oa]s?|nenhum[a]?|salvo|exceto|desde que|ainda que|mesmo que|independentemente|vedad[oa]s?|obrigatoriamente|necessariamente|em hipótese alguma|privativ[oa]s?|exclusiv[oa]s?|automaticamente|integralmente)\b/gi;
function marcarPolaridade(html) { return html.split(/(<[^>]+>)/).map((x) => (x.startsWith('<') ? x : x.replace(RE_POLARIDADE, '<span class="g-alerta">$&</span>'))).join(''); }
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
// Itens dos blocos escolhidos (todos, se nenhum tem itens). O filtro de banca e formato vale só para as sessões montadas
// na aba Questões: o plano do dia, a recuperação e as trilhas usam o banco inteiro
const FILTROS_BANCA = {
  cebraspe: (q) => !q.al,
  reais: (q) => !!q.o,
  ineditas: (q) => !q.o,
  multipla: (q) => !!q.al,
};
function poolDe(blocos, banca) {
  const disp = (blocos || []).filter((b) => (POR_BLOCO.get(b) || []).length);
  const set = disp.length ? new Set(disp) : null;
  const base = set ? Q.filter((q) => set.has(q.b)) : Q.slice();
  const f = FILTROS_BANCA[banca];
  const filtrada = f ? base.filter(f) : base;
  return filtrada.length ? filtrada : base;
}
// O banco autoral é mais fácil que a banca (na dificuldade 2, 81% de acerto contra 65% nos itens reais do Cebraspe,
// nos dados de outubro/2026). Quem já acerta 80% ou mais dos autorais na primeira resposta (com pelo menos 100 deles)
// recebe primeiro os que mais erra (ordemDesafio); abaixo disso, a ordem é sorteada.
let desafioCache = null;
function desafioAutoral() {
  const chave = hojeISO() + '|' + Object.keys(S.itens).length;
  if (desafioCache && desafioCache.chave === chave) return desafioCache.v;
  let c = 0, n = 0;
  for (const [id, r] of Object.entries(S.itens)) { const q = QI.get(id); if (q && !q.o && r[7] != null) { c += r[7]; n++; } }
  desafioCache = { chave, v: n >= 100 && c / n >= 0.8 };
  return desafioCache.v;
}
// Ordem do desafio: primeiro os tipos de armadilha em que a pessoa mais erra na primeira resposta, contados à parte nos
// certos e nos errados (suavizados pela média do gabarito quando o tipo tem poucas respostas), intercalando certo e
// errado para o desafio não virar uma fila de itens errados. O rótulo de dificuldade só desempata: nos dados de
// outubro/2026 ele não previa os erros nos autorais (AUC 0,48, contra 0,54 da taxa por armadilha, fora da amostra).
function ordemDesafio(lista) {
  const g = {}, a = {}, ce = (q) => !q.al && (q.g === 'C' || q.g === 'E');
  for (const [id, r] of Object.entries(S.itens)) {
    const q = QI.get(id);
    if (!q || q.o || r[7] == null || !ce(q)) continue;
    const x = (g[q.g] ||= [0, 0]), y = (a[q.g + '|' + q.a] ||= [0, 0]);
    x[0] += 1 - r[7]; x[1]++; y[0] += 1 - r[7]; y[1]++;
  }
  const taxa = (q) => { const x = g[q.g] || [0, 0], y = a[q.g + '|' + q.a] || [0, 0]; return (y[0] + 5 * (x[1] ? x[0] / x[1] : 0.2)) / (y[1] + 5); };
  const fila = (gab) => lista.filter((q) => ce(q) && q.g === gab).map((q) => [taxa(q), q]).sort((p, s) => s[0] - p[0] || (s[1].d || 2) - (p[1].d || 2)).map((p) => p[1]);
  const c = fila('C'), e = fila('E'), out = [];
  while (c.length || e.length) { if (c.length) out.push(c.shift()); if (e.length) out.push(e.shift()); }
  return out.concat(lista.filter((q) => !ce(q)));
}
function selecionar(pool, n, filtro) {
  const hoje = HOJE();
  const venc = [], novas = [], lista = [], domV = [], resto = [];
  for (const q of pool) {
    const r = rec(q.id);
    if (!r || r[0] < 0) { if (!RESERVA_MEDIDA.has(q.id)) novas.push(q); }
    else if (SEM_REPETICAO.has(q.id)) resto.push(q);
    else if (r[0] < 3 && r[1] <= hoje) venc.push(q);
    else if (r[0] < 3) lista.push(q);
    else if (r[1] <= hoje) domV.push(q);
    else resto.push(q);
  }
  embaralhar(venc); embaralhar(lista);
  // Inéditas com pelo menos REAIS_TREINO de itens reais (ou a proporção natural do bloco, se for maior), intercalados
  {
    const reaisN = embaralhar(novas.filter((q) => q.o)), bancoN = embaralhar(novas.filter((q) => !q.o));
    // Desafio: com 80% ou mais de acerto na primeira resposta dos autorais, os mais difíceis para a pessoa vêm primeiro
    if (desafioAutoral()) bancoN.splice(0, bancoN.length, ...ordemDesafio(bancoN));
    const alvo = Math.max(REAIS_TREINO, reaisN.length / (novas.length || 1));
    novas.length = 0;
    for (let i = 0; reaisN.length || bancoN.length; i++) {
      const vezReal = Math.floor((i + 1) * alvo) > Math.floor(i * alvo);
      novas.push((vezReal && reaisN.length) || !bancoN.length ? reaisN.shift() : bancoN.shift());
    }
  }
  domV.sort((a, b) => rec(a.id)[1] - rec(b.id)[1]);
  resto.sort((a, b) => rec(a.id)[1] - rec(b.id)[1]);
  // Itens dominados que venceram: até um quarto da sessão, antes das inéditas (revisão espaçada intercalada)
  const cota = Math.ceil(n / 4);
  let ordem;
  if (filtro === 'novas') ordem = novas.concat(venc, domV, lista, resto);
  else if (filtro === 'erradas') ordem = pool.filter((q) => { const r = rec(q.id); return r && r[3] > 0 && !SEM_REPETICAO.has(q.id); }).sort((a, b) => rec(b.id)[3] - rec(a.id)[3]);
  else ordem = venc.concat(domV.slice(0, cota), novas, lista, domV.slice(cota), resto);
  return embaralhar(ordem.slice(0, n));
}
function selecionarProva(n) {
  const escolhidos = [];
  const usados = new Set();
  for (const [parte, disc, k] of cotasProva(n)) {
    const pool = Q.filter((q) => { const b = BI.get(q.b); return b && b.disciplina === disc && parteProva(q) === parte && !q.al; });
    // Metade da fatia vem de itens reais inéditos, que medem o nível da banca melhor que os escritos para o banco.
    // Depois agrupa por texto dentro da fatia: os irmãos do mesmo texto são da mesma disciplina, e a cota não muda; como
    // os irmãos de um item real também são reais, a parte real pode passar da metade.
    const reais = embaralhar(pool.filter((q) => q.o && inedito(q))).slice(0, Math.ceil(k / 2));
    const sorteio = reais.concat(selecionar(pool.filter((q) => !reais.includes(q)), Math.min(pool.length, k) - reais.length, 'novas'));
    emBlocosDeTexto(sorteio, true, null).forEach((q) => { if (!usados.has(q.id)) { escolhidos.push(q); usados.add(q.id); } });
  }
  if (escolhidos.length < n) selecionar(Q.filter((q) => !usados.has(q.id) && !q.al), n - escolhidos.length, 'novas').forEach((q) => escolhidos.push(q));
  return embaralhar(escolhidos.slice(0, n));
}

function inedito(q) { const r = rec(q.id); return !r || r[0] < 0; }
// Itens reais certo/errado ainda não respondidos, repartidos pelo peso de cada disciplina na nota
function selecionarReais(n) {
  const livres = embaralhar(REAIS.filter((q) => !q.al && inedito(q)));
  const porD = new Map();
  for (const q of livres) { const d = (BI.get(q.b) || {}).disciplina; if (!porD.has(d)) porD.set(d, []); porD.get(d).push(q); }
  const base = Object.entries(PONTOS_DISC).map(([d, w]) => { const x = (n * w) / PONTOS_PROVA; return [d, Math.floor(x), x - Math.floor(x)]; });
  let falta = n - base.reduce((a, b) => a + b[1], 0);
  base.slice().sort((a, b) => b[2] - a[2]).forEach((b) => { if (falta > 0) { b[1]++; falta--; } });
  const out = [];
  for (const [d, k] of base) out.push(...(porD.get(d) || []).slice(0, k));
  if (out.length < n) out.push(...livres.filter((q) => !out.includes(q)).slice(0, n - out.length));
  return embaralhar(out);
}
// Blocos já vistos no cronograma (dias anteriores a hoje), fora as básicas
function blocosEstudados() {
  const h = hojeISO();
  return [...new Set(DIAS.filter((d) => d.data < h).flatMap((d) => d.blocos || []))].filter((b) => !BLOCOS_BASICOS.includes(b) && (POR_BLOCO.get(b) || []).length);
}
// Acerto e prática recente (itens respondidos nos últimos 14 dias) por disciplina
function estatDisciplinas() {
  const desde = HOJE() - 14, out = {};
  for (const [id, r] of Object.entries(S.itens)) {
    const q = QI.get(id), d = q && (BI.get(q.b) || {}).disciplina;
    if (!d || r[0] < 0) continue;
    const x = (out[d] ||= { c: 0, e: 0, rec: 0 });
    x.c += r[2] || 0; x.e += r[3] || 0;
    if (r[4] >= desde) x.rec++;
  }
  return out;
}
// Disciplina de reforço: a de pior acerto abaixo de 80%, com peso de pelo menos 5% da prova e 30 respostas
function disciplinaReforco(est) {
  let pior = null;
  for (const [d, x] of Object.entries(est || estatDisciplinas())) {
    const n = x.c + x.e;
    if (d === 'linguas' || n < 30 || (PONTOS_DISC[d] || 0) / PONTOS_PROVA < 0.05) continue;
    const ac = x.c / n;
    if (ac < 0.8 && (!pior || ac < pior.ac)) pior = { d, ac, n };
  }
  return pior;
}
// Intercaladas: completam a mistura. Os dias do plano são de uma matéria só, e o treino livre tende a repetir a que
// se estuda no momento: o uso real mostrou 62% das respostas em LGPD (30% da prova) e 6% em línguas (17,5%). Por isso,
// duas em cada dez vão para a disciplina de pior acerto (reforço) e o resto se reparte pelo que falta a cada disciplina
// para a prática dos últimos 14 dias chegar ao peso dela na prova, com português e inglês em pares do mesmo texto. Sem
// histórico (menos de 50 itens nos 14 dias), línguas, que quase só entram aqui, ficam com 40% e o resto vai pelo peso.
// O tamanho acompanha o ritmo: um quinto dos itens de um dia típico, entre 10 e 30.
const INTERCALADAS_N = 10;
function nIntercaladas() { const r = ritmo(); return r && r.r ? limitar(Math.round(r.r / 25) * 5, INTERCALADAS_N, 30) : INTERCALADAS_N; }
// Parte de cada disciplina na prática dos últimos 14 dias e o que falta para o peso dela na prova (em fração)
function misturaPraticada(est) {
  est = est || estatDisciplinas();
  const tot = Object.values(est).reduce((a, x) => a + x.rec, 0);
  return { tot, linhas: Object.keys(PONTOS_DISC).map((d) => { const peso = PONTOS_DISC[d] / PONTOS_PROVA, parte = tot ? ((est[d] || {}).rec || 0) / tot : 0; return { d, peso, parte, falta: Math.max(0, peso - parte) }; }) };
}
// Reparte n itens na proporção dos pesos, pelo maior resto
function repartir(n, pesos) {
  const soma = pesos.reduce((a, [, w]) => a + w, 0);
  if (!soma || n <= 0) return {};
  const base = pesos.map(([k, w]) => { const x = (n * w) / soma; return [k, Math.floor(x), x - Math.floor(x)]; });
  let falta = n - base.reduce((a, b) => a + b[1], 0);
  base.slice().sort((a, b) => b[2] - a[2]).forEach((b) => { if (falta > 0) { b[1]++; falta--; } });
  return Object.fromEntries(base.map(([k, q]) => [k, q]));
}
function cotasIntercaladas(n, est) {
  const rf = disciplinaReforco(est), nRf = rf ? Math.round(n * 0.2) : 0, m = misturaPraticada(est);
  let cotas;
  if (m.tot >= 50) cotas = repartir(n - nRf, m.linhas.map((l) => [l.d, l.falta]));
  else {
    const nL = PONTOS_DISC.linguas ? Math.round((n - nRf) * 0.4) : 0;
    cotas = Object.assign(repartir(n - nRf - nL, m.linhas.filter((l) => l.d !== 'linguas').map((l) => [l.d, l.peso])), { linguas: nL });
  }
  return { rf, nRf, cotas };
}
function selecionarIntercaladas(n) {
  const est = estatDisciplinas(), { rf, nRf, cotas } = cotasIntercaladas(n, est), nL = cotas.linguas || 0;
  const escolhidos = [], usados = new Set();
  const pega = (pool, k) => { if (k > 0) selecionar(pool.filter((q) => !usados.has(q.id)), k, 'mistas').forEach((q) => { usados.add(q.id); escolhidos.push(q); }); };
  // Línguas em pares do mesmo texto: ler um texto para responder dois itens, como no caderno
  const doTexto = (bloco, k) => {
    if (k <= 0) return;
    const q = selecionar((POR_BLOCO.get(bloco) || []).filter((x) => !usados.has(x.id)), 1, 'mistas')[0];
    if (!q) return;
    const irmaos = q.ap == null ? [] : (POR_APOIO.get(q.ap) || []).filter((x) => x.id !== q.id && !usados.has(x.id) && !RESERVA_MEDIDA.has(x.id) && !x.al).sort((a, b) => !!rec(a.id) - !!rec(b.id));
    [q].concat(irmaos).slice(0, k).forEach((x) => { usados.add(x.id); escolhidos.push(x); });
    if (escolhidos.filter((x) => x.b === bloco).length < k) pega(POR_BLOCO.get(bloco) || [], k - escolhidos.filter((x) => x.b === bloco).length);
  };
  doTexto('portugues', Math.ceil(nL / 2));
  doTexto('ingles', nL - Math.ceil(nL / 2));
  // Cada disciplina tira dos blocos já estudados e dos básicos dela; sem nenhum, de todos os seus blocos
  const estudados = blocosEstudados();
  const daDisc = (d) => { const de = (b) => (BI.get(b) || {}).disciplina === d, bs = estudados.concat(BLOCOS_BASICOS).filter(de); return (bs.length ? bs : BLOCOS.map((b) => b.id).filter(de)).flatMap((b) => POR_BLOCO.get(b) || []); };
  if (rf) pega(daDisc(rf.d), nRf);
  for (const [d, k] of Object.entries(cotas)) if (d !== 'linguas') pega(daDisc(d), k);
  const resto = n - escolhidos.length, basicas = BLOCOS_BASICOS.filter((b) => b !== 'portugues' && b !== 'ingles');
  const poolE = estudados.flatMap((b) => POR_BLOCO.get(b) || []);
  pega(basicas.flatMap((b) => POR_BLOCO.get(b) || []), poolE.length ? Math.ceil(resto / 2) : resto);
  pega(poolE, n - escolhidos.length);
  return embaralhar(escolhidos);
}

