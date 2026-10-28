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
// Blocos dos dias de questões da semana do plano (segunda até o dia): é o que a revisão do dia treina quando não há
// nada vencido, como no começo do estudo; sem nenhum, a prioridade 1
function blocosDaSemana(dia) {
  const seg = isoDeNum(diaNum(dia.data) - ((diaSemana(dia.data) + 6) % 7));
  const bs = [];
  for (const d of DIAS) if (d.data >= seg && d.data <= dia.data && d.modo === 'treino') for (const b of d.blocos) if (!bs.includes(b)) bs.push(b);
  return bs.length ? bs : P1.slice();
}
// Vivo: algum dispositivo não vetado nem revogado. Caput vetado com parágrafo em vigor (Lei 9.507, art. 1º; LAI, art. 35) continua
// vivo; caput revogado leva o artigo inteiro, porque revogar "o art. X" alcança os parágrafos, mesmo sem nota neles.
const VIVO = new Map();
function artigoVivo(k) {
  if (!ARTI.has(k)) return false;
  if (!VIVO.has(k)) {
    const linhas = ARTI.get(k).texto.split('\n');
    VIVO.set(k, !linhaRevogada(linhas[0]) && linhas.some((l) => l.trim() && !linhaRevogada(l) && !/\(VETADO\)/.test(l)));
  }
  return VIVO.get(k);
}
// Dispositivo revogado: o texto antigo não vale mais e não se estuda. Fica só o rótulo (a numeração pula, e a banca às
// vezes cobra que o parágrafo caiu) com a nota de quem revogou. Notas de redação depois da revogação não mudam isso.
const RE_ROTULO = /^\s*[“"]?(?:Art\.\s?[\dA-Zº°-]+\s?\.?|§\s?\d+\s?\.?\s?[º°]?\.?|Parágrafo único\.?|[IVXLC]+(?:-[A-Z])?\s?[-–]|[a-z]\))/;
function linhaRevogada(linha) {
  const r = RE_ROTULO.exec(linha);
  const rotulo = r ? r[0].replace(/^[\s“"]+/, '').trim() : '';
  const m = /\((Revogad[oa][^)]*)\)(?:[\s.;,:”"]*(?:\((?:Redação dada|Incluíd[oa]|NR|Vide)[^)]*\)|Revogad[oa] pel[oa] [^()]*))*[\s.;,:”"]*$/.exec(linha);
  if (m) return { rotulo, nota: '(' + m[1] + ')' };
  // Só o rótulo e a palavra, em minúscula ou sem parênteses: "a) revogada;", "XXI - (revogado);"
  const s = r && /^\s*\(?(revogad[oa]s?)\)?[\s.;,:”"]*(?:\((?:Redação dada|Incluíd[oa]|NR|Vide)[^)]*\)[\s.;,:”"]*)*$/i.exec(linha.slice(r.index + r[0].length));
  return s ? { rotulo, nota: '(' + s[1].toLowerCase() + ')' } : null;
}
// Leitura do dia: todos os artigos dos blocos do dia, se couberem em LEITURA_MAX; senão, uma seleção
// equilibrada entre os blocos: primeiro os artigos de questões que estão na sua lista curta, depois os
// nunca lidos (o que foi lido pela primeira vez hoje continua contando como não lido), depois os mais cobrados.
// Dia de matéria nova (com subtema no plano): a leitura são os artigos do subtema, os mesmos da aula e das questões
function stDoDia(dia) { return dia && dia.st ? SUBTEMAS.get(dia.st) || null : null; }
function artsDoSubtema(st) { return [...new Set((st.arts || []).filter((k) => artigoVivo(k)))]; }
function leituraDoDia(dia) {
  const st = stDoDia(dia);
  if (st) { const arts = artsDoSubtema(st); return { arts: arts.slice(0, LEITURA_MAX), total: arts.length }; }
  const porBloco = [], todos = [];
  for (const b of blocosDoDia(dia)) {
    const bl = BI.get(b), lista = [];
    for (const a of (bl && bl.artigos) || []) { const k = chave(bl.lei || 'lgpd', a); if (artigoVivo(k) && !todos.includes(k)) { todos.push(k); lista.push(k); } }
    if (lista.length) porBloco.push(lista);
  }
  if (todos.length <= LEITURA_MAX) return { arts: todos, total: todos.length };
  const hoje = hojeISO(), lidos = S.perfil.lidos || {};
  const prio = (k) => ((POR_ART.get(k) || []).some((q) => emRevisao(q.id)) ? 1000 : 0) + (lidos[k] && lidos[k] !== hoje ? 0 : 100) + importancia(k);
  const filas = porBloco.map((l) => l.slice().sort((x, y) => prio(y) - prio(x)));
  const escolhidos = new Set();
  for (let i = 0; escolhidos.size < LEITURA_MAX && filas.some((f) => f.length); i++) { const k = filas[i % filas.length].shift(); if (k) escolhidos.add(k); }
  return { arts: todos.filter((k) => escolhidos.has(k)), total: todos.length };
}
function artigosDoDia(dia) { return leituraDoDia(dia).arts; }




// "Recomeçar do zero" apaga a sessão guardada: vai em "extra" do passo, que o roteiro mostra e o cartão do topo não
function botaoRecomecar(k) { return pausaDe(k) ? '<button class="btn pequeno" data-acao="descartar-pausa" data-k="' + esc(k) + '">Recomeçar do zero</button>' : ''; }
function roteiroHoje() {
  const ctx = contextoHoje();
  const dia = ctx.tipo === 'dia' ? ctx.dia : null;
  const d = diaLog();
  const blocos = blocosDoDia(dia);
  const venc = listaVencida().length;
  const manut = manutencaoHoje().length;
  const cardsV = cardsVencidos().filter((c) => c.nota.nu).length;
  const leitura = leituraDoDia(dia);
  const arts = leitura.arts;
  const lidosHoje = (d.a || []).filter((a) => arts.includes(a)).length;
  const cardsBlocos = blocos.filter((b) => (CARDS_POR_BLOCO.get(b) || []).length);
  const novosDisp = cardsNovos(cardsBlocos.length ? cardsBlocos : null).filter((c) => c.nota.nu).length || cardsNovos().filter((c) => c.nota.nu).length;
  const stPlano = dia && dia.modo === 'treino' ? stDoDia(dia) : null;
  const stH = stPlano || subtemaDoDia();
  const dd = discDeHoje();
  const chaveInt = 'i:' + hojeISO();

  const passos = [];
  // O núcleo cabe no dia útil do plano (1 h): revisão, questões do tema, lei, aula (em dia de matéria nova), cards de
  // número e intercaladas (onde entram português e inglês). Dia de plano mais longo (fim de semana) acrescenta a
  // fixação e a discursiva; dia com discursiva no plano traz a discursiva.
  const longo = !!dia && (metaMin(dia.data) || 0) > 60;

  // Revisão espaçada (~10 min): questões vencidas, manutenção e cards de número vencidos
  const revFeita = venc === 0 && manut === 0 && cardsV === 0;
  passos.push({
    titulo: 'Revisão espaçada (~10 min)',
    feito: revFeita,
    texto: (venc || manut || cardsV)
      ? [venc ? pl(venc, 'questão da lista curta', 'questões da lista curta') : '', manut ? pl(manut, 'item de manutenção', 'itens de manutenção') : '', cardsV ? pl(cardsV, 'card de número vencido', 'cards de número vencidos') : ''].filter(Boolean).join(', ') + '.'
      : 'Memória em dia! Nenhum item pendente de revisão para agora.',
    botoes: (venc + manut ? '<button class="btn pequeno primario" data-acao="iniciar-revisao">Revisar questões (' + (venc + manut) + ')</button>' : '') +
            (cardsV ? '<button class="btn pequeno' + (venc + manut ? '' : ' primario') + '" data-acao="cards-revisao" data-num="1">Revisar cards (' + cardsV + ')</button>' : '')
  });

  // Questões do tema / pré-teste (~15 min)
  let qTemaFeita = false;
  let qTemaBtns = '';
  let qTemaTxt = '';
  if (dia) {
    qTemaFeita = !!S.perfil.feitos[dia.data];
    const nDia = nItensDoDia(dia);
    qTemaTxt = dia.modo === 'simulado'
      ? 'Simulado do dia: ' + nDia + ' itens, com tempo e nota líquida.'
      : nDia + ' questões para achar os pontos cegos do tema (' + (dia.blocos || []).map(nomeBloco).join(', ') + ').';
    qTemaBtns = '<button class="btn pequeno primario" data-acao="iniciar-dia" data-dia="' + dia.data + '">' +
      esc(rotuloPausa(dia.data, (qTemaFeita ? 'Outra rodada' : 'Resolver questões') + ' · ' + nDia + ' itens')) + '</button>';
  } else {
    qTemaFeita = !!S.perfil.feitos['r:' + hojeISO()];
    const n = nPreTeste();
    qTemaTxt = 'Sem sessão programada hoje: ' + n + ' questões para medir o nível nos blocos centrais.';
    qTemaBtns = '<button class="btn pequeno primario" data-acao="treino-rapido" data-n="' + n + '" data-pre="1">Treino rápido (' + n + ' itens)</button>';
  }
  passos.push({
    titulo: 'Questões do tema (~15 min)',
    feito: qTemaFeita,
    texto: qTemaTxt,
    botoes: qTemaBtns,
    extra: dia ? botaoRecomecar(dia.data) : ''
  });

  // Dias perdidos do plano: a recuperação entra logo depois das questões do dia
  const rec = proximaRecuperacao(), atrasados = blocosAtrasados();
  if (rec) passos.push({ titulo: 'Recuperar o atraso', semNumero: true, feito: !!S.perfil.feitos['rec:' + hojeISO()],
    texto: rec.falta.map((f) => nomeBloco(f.b)).join(', ') + (atrasados.length > rec.falta.length ? ' (depois, mais ' + pl(atrasados.length - rec.falta.length, 'matéria', 'matérias') + ')' : '') + '.',
    botoes: botaoRecuperar() });

  // Lei seca com grifos (~15 min)
  const metaLeitura = arts.length ? Math.min(arts.length, metaArtigos()) : 0;
  const leiFeita = arts.length ? lidosHoje >= metaLeitura : (d.a || []).length >= 3;
  passos.push({
    titulo: 'Lei seca com grifos (~' + (longo ? 15 : 10) + ' min)',
    feito: leiFeita,
    texto: arts.length
      ? 'Leitura atenta dos ' + metaLeitura + ' artigos prioritários com grifos de prazos, verbos e exceções (' + lidosHoje + ' de ' + metaLeitura + ' lidos hoje).'
      : 'Consulte os artigos das normas com destaque para armadilhas Cebraspe.',
    botoes: stPlano ? '<button class="btn pequeno' + (!leiFeita && qTemaFeita ? ' primario' : '') + '" data-acao="st-lei" data-st="' + esc(stPlano.id) + '">Ler os artigos</button>'
      : arts.length
      ? '<button class="btn pequeno' + (!leiFeita && qTemaFeita ? ' primario' : '') + '" data-acao="ler-dia">Ler artigos (' + lidosHoje + '/' + metaLeitura + ')</button>'
      : '<button class="btn pequeno" data-acao="ir" data-vista="lei">Abrir legislação</button>'
  });

  // Aula da trilha (~10 min): no dia de matéria nova do plano e nos dias longos
  const aulaFeita = !!S.perfil.feitos['aula:' + hojeISO()] || (dia && !!S.perfil.feitos['aula:' + dia.data]);
  if (stPlano || (longo && stH)) passos.push({
    titulo: 'Aula da trilha & jurisprudência (~10 min)',
    feito: aulaFeita,
    texto: (nomeTrilha(stH.trilha) || 'Trilha do zero') + ': ' + stH.nome + '. Mapa mental, exemplos e as armadilhas da banca.',
    botoes: stPlano ? '<button class="btn pequeno' + (leiFeita && !aulaFeita ? ' primario' : '') + '" data-acao="st-aula" data-st="' + esc(stPlano.id) + '">Abrir a aula</button>'
      : '<button class="btn pequeno' + (leiFeita && !aulaFeita ? ' primario' : '') + '" data-acao="aula-folha" data-st="' + esc(stH.id) + '" data-marca="1">Abrir aula da trilha</button>'
  });

  // Fixação prática (~5 min): nos dias longos (no dia útil, as questões do tema já fixam a matéria)
  const chT = 't:' + hojeISO();
  const fixFeita = !!S.perfil.feitos[chT];
  if (longo) passos.push({
    titulo: 'Fixação prática (~5 min)',
    feito: fixFeita,
    texto: '5 itens práticos para aplicar os artigos lidos e consolidar os pontos exigidos pela banca.',
    botoes: stH
      ? '<button class="btn pequeno' + (aulaFeita && !fixFeita ? ' primario' : '') + '" data-acao="trilha-sessao" data-st="' + esc(stH.id) + '" data-tipo="pratica" data-n="5">' + esc(rotuloPausa('t:' + stH.id + ':pratica:5', 'Fixar na prática (5 itens)')) + '</button>'
      : '<button class="btn pequeno" data-acao="treino-rapido" data-n="5">Treino curto (5 itens)</button>'
  });

  // Cards de número e prazo (~5 min): o dado arbitrário que o card fixa melhor; os demais cards ficam na aba Cards
  const metaNovos = Math.min(novosDisp + (d.n || 0), 5);
  const cardsFeitos = (d.n || 0) >= metaNovos && cardsV === 0;
  passos.push({
    titulo: 'Cards de número e prazo (~5 min)',
    feito: cardsFeitos,
    texto: 'Lacunas de prazos, quóruns, percentuais e valores: você digita o número antes de ver (' + Math.min(d.n || 0, 5) + '/' + metaNovos + ' novos hoje).',
    botoes: '<button class="btn pequeno' + (qTemaFeita && leiFeita && !cardsFeitos ? ' primario' : '') + '" data-acao="cards-dia">Estudar ' + Math.max(1, metaNovos - Math.min(d.n || 0, metaNovos)) + ' cards</button>'
  });

  // Treino intercalado: todo dia, com o que falta para a prática chegar ao peso de cada matéria na prova
  const intFeita = !!S.perfil.feitos[chaveInt], nInt = nIntercaladas(), ci = cotasIntercaladas(nInt, estatDisciplinas()), rf = ci.rf;
  const maiores = Object.entries(ci.cotas).filter(([, k]) => k > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d, k]) => (d === 'linguas' ? 'português e inglês' : DI.get(d).nome) + ' (' + k + ')');
  passos.push({
    titulo: 'Treino intercalado (~' + Math.round(nInt) + ' min)',
    feito: intFeita,
    texto: nInt + ' itens para a sua prática chegar ao peso de cada matéria na prova' + (maiores.length ? ': ' + maiores.join(', ') : '') + (rf ? '; reforço em ' + DI.get(rf.d).nome + ' (' + Math.round(rf.ac * 100) + '% de acerto, a mais baixa entre as matérias pesadas)' : '') + '.',
    botoes: '<button class="btn pequeno' + (cardsFeitos && !intFeita ? ' primario' : '') + '" data-acao="intercaladas">' + esc(rotuloPausa(chaveInt, 'Treinar itens intercalados')) + '</button>',
    extra: botaoRecomecar(chaveInt)
  });

  // Discursiva: no dia que o plano marca (e nos dias longos, um esboço ou o espelho)
  const discOk = (dd ? discFeita(dd) : false) || (d.t && (d.t.d || 0) >= 300) || discSalvaHoje();
  const tDisc = dd ? temaDisc(dd) : TEMAS_DISC[0], atrDisc = dd ? pendencias().filter((x) => x.disc).length : 0;
  if (dd || longo) passos.push({
    titulo: dd ? 'Discursiva do dia (~10 min)' : 'Discursiva ou espelho (~10 min)',
    feito: discOk,
    texto: dd
      ? 'Tema do dia: ' + (tDisc ? tDisc.titulo : 'Tema do edital') + '. Esboce os quesitos ou analise o espelho Cebraspe.' + (atrDisc ? ' Há ' + pl(atrDisc, 'discursiva atrasada', 'discursivas atrasadas') + ': cada uma salva dá baixa primeiro na de hoje e depois na mais antiga.' : '')
      : 'Pratique a estruturação de tópicos e o padrão de resposta Cebraspe de um tema da ANPD.',
    botoes: '<button class="btn pequeno' + (intFeita && !discOk ? ' primario' : '') + '" data-acao="disc-dia" data-t="' + esc((tDisc && tDisc.id) || 'sancoes') + '">Escrever / Ver espelho</button>'
  });

  let n = 0;
  for (const p of passos) if (!p.semNumero) p.titulo = ++n + '. ' + p.titulo;
  return { dia, passos };
}

/* ================= Atraso do plano: nada fica sem estudar ================= */
// Dias do plano (desde o início do uso do app) cuja sessão não foi feita, e a leitura desses dias nunca aberta. Nada
// sai daqui por prazo: o dia só sai quando a matéria dele é estudada, por qualquer caminho, ou quando é dispensado.
// - Dia de questões dá baixa sozinho quando, a partir da data dele, você respondeu ao menos metade dos itens
//   previstos (mínimo 10) dos blocos daquele dia, em qualquer sessão (recuperação, treino, batalha, intercaladas).
// - Dia de revisão perdido não vira atraso: o que venceu continua na lista curta e entra na próxima revisão.
// - Simulado perdido fica na lista, para ser feito quando der.
// A recuperação mistura os blocos atrasados, dos dias mais antigos para os mais novos, e entra no roteiro do dia.
function tocadosDesde(b, desde) {
  let n = 0;
  for (const q of POR_BLOCO.get(b) || []) { const r = rec(q.id); if (r && r[0] >= 0 && r[4] >= desde) n++; }
  return n;
}
// Quanto cada matéria do dia pede: metade da sua parte dos itens previstos (mínimo 3, nunca mais que o bloco tem)
function alvoBloco(dia, b) { return Math.min((POR_BLOCO.get(b) || []).length, Math.max(3, Math.ceil(dia.n / dia.blocos.length / 2))); }
// O que ainda falta em cada matéria do dia para ele dar baixa
function faltaDoDia(dia) {
  const desde = diaNum(dia.data);
  return (dia.blocos || []).map((b) => ({ b, falta: Math.max(0, alvoBloco(dia, b) - tocadosDesde(b, desde)) })).filter((x) => x.falta > 0);
}
function diaCompensado(dia) { return dia.modo === 'treino' && dia.blocos.length > 0 && !faltaDoDia(dia).length; }
// Todos os artigos vivos dos blocos do dia (a leitura do dia mostra no máximo LEITURA_MAX deles)
function artigosTodosDoDia(dia) {
  if (stDoDia(dia)) return artsDoSubtema(stDoDia(dia));
  const out = [];
  for (const b of blocosDoDia(dia)) { const bl = BI.get(b); for (const a of (bl && bl.artigos) || []) { const k = chave(bl.lei || 'lgpd', a); if (artigoVivo(k) && !out.includes(k)) out.push(k); } }
  return out;
}
// Leitura atrasada de um dia passado: conta como feita quando você leu tantos artigos daquele dia quanto a leitura do
// dia pedia (todos, ou LEITURA_MAX); até lá, mostra os não lidos que faltam, os mais importantes primeiro
function leituraAtrasadaDoDia(dia, lidos) {
  const todos = artigosTodosDoDia(dia), alvo = Math.min(todos.length, LEITURA_MAX), feitos = todos.filter((k) => lidos[k]).length;
  return feitos >= alvo ? [] : todos.filter((k) => !lidos[k]).sort((a, b) => importancia(b) - importancia(a)).slice(0, alvo - feitos);
}
// Discursiva do plano: o dia com "disc" pede uma discursiva corrigida e salva (uma por semana; duas nas seis últimas).
// Cada correção salva dá baixa em um dia: o de hoje primeiro, depois o atrasado mais antigo, depois o próximo da semana
// (adiantar vale). Vale qualquer tema; o do dia vem sugerido. A baixa fica em S.perfil.feitos['disc:' + data].
// Cota da semana (segunda a domingo): uma discursiva completa, escrita e corrigida pelos quesitos, e um simulado de 30
// itens ou mais com tempo. Ficam à vista abaixo do roteiro até serem cumpridas e não entram na contagem do roteiro do
// dia (que fecha completo sem elas). O simulado do plano na semana também cumpre a cota.
const SIM_SEMANA_N = 30;
function cotaSemana() {
  const sem = semanaAtual(), fim = isoDeNum(diaNum(sem) + 6);
  const discOk = Object.values(S.disc).some((st) => (st.tentativas || []).some((x) => x.d >= sem));
  const simOk = S.simulados.some((x) => x.data >= sem && x.n >= SIM_SEMANA_N);
  const tent = (id) => ((S.disc[id] || {}).tentativas || []).length;
  // Entre os menos treinados, primeiro os temas com espelho oficial da banca: são a única régua externa de severidade
  const oficial = (t) => (/^oficial-/.test(t.id) ? 0 : 1);
  const tema = TEMAS_DISC.slice().sort((a, b) => tent(a.id) - tent(b.id) || oficial(a) - oficial(b))[0];
  const simPlano = DIAS.find((x) => x.modo === 'simulado' && x.data >= hojeISO() && x.data <= fim);
  const chaveSim = 'sim:' + sem;
  return [
    { titulo: 'Discursiva da semana', feito: discOk,
      texto: discOk ? 'Feita nesta semana.' : (tema ? 'Texto inteiro, no limite de linhas e no tempo, corrigido pelos quesitos. Sugestão: ' + tema.titulo + (tent(tema.id) ? '' : ' (tema ainda não treinado)') + '.' : ''),
      botoes: discOk || !tema ? '' : '<button class="btn pequeno" data-acao="disc-dia" data-t="' + esc(tema.id) + '">Escrever</button>' },
    { titulo: 'Simulado da semana (' + SIM_SEMANA_N + ' itens)', feito: simOk,
      texto: simOk ? 'Feito nesta semana.' : 'Com tempo e sem gabarito até entregar: treina ritmo, resistência e a decisão de chutar.' + (simPlano ? ' O simulado do plano de ' + fmtData(simPlano.data, { weekday: 'long' }) + ' também cumpre a cota.' : ''),
      botoes: simOk ? '' : '<button class="btn pequeno" data-acao="simulado-semana">' + esc(rotuloPausa(chaveSim, 'Fazer o simulado')) + '</button>' },
  ];
}
function cartaoSemana() {
  const c = cotaSemana(), feitas = c.filter((x) => x.feito).length;
  return '<div class="cartao semana"><div class="secao-cab"><h2>Esta semana</h2><span class="mono pequeno mudo">' + feitas + ' de ' + c.length + '</span></div><div class="roteiro">' +
    c.map((p) => '<div class="passo' + (p.feito ? ' feito' : '') + '"><div class="marca-passo">' + (p.feito ? '✓' : '◦') + '</div><div class="corpo-passo"><b>' + esc(p.titulo) + '</b><p>' + esc(p.texto) + '</p>' + (p.botoes ? '<div class="linha-btns">' + p.botoes + '</div>' : '') + '</div></div>').join('') + '</div></div>';
}
function discFeita(dia) { return !!S.perfil.feitos['disc:' + dia.data]; }
function discDeHoje() { const h = hojeISO(); return DIAS_DISC.find((d) => d.data === h) || null; }
function temaDisc(dia) { return TEMAS_DISC.find((t) => t.id === dia.disc) || null; }
// Tentativa salva hoje em qualquer tema: num dia sem discursiva no plano, a baixa vai para outro dia, mas o passo de hoje
// foi cumprido
function discSalvaHoje() { const h = hojeISO(); return Object.values(S.disc).some((st) => (st.tentativas || []).some((x) => x.d === h)); }
function darBaixaDisc() {
  const h = hojeISO(), fim = isoDeNum(HOJE() + ((7 - diaSemana(h)) % 7));
  const atrasadas = pendencias().filter((x) => x.disc).map((x) => x.dia);
  const alvo = [discDeHoje()].concat(atrasadas, DIAS_DISC.filter((d) => d.data > h && d.data <= fim)).find((d) => d && !discFeita(d));
  // a baixa muda as pendências: o cálculo guardado para esta tarefa deixa de valer
  if (alvo) { S.perfil.feitos['disc:' + alvo.data] = 1; pendCache = null; }
  return alvo;
}
function botaoDiscDia(dia, primario) {
  return '<button class="btn pequeno' + (primario ? ' primario' : '') + '" data-acao="disc-dia" data-t="' + esc(dia.disc) + '">' + (estadoDisc(dia.disc).rascunho ? 'Continuar a discursiva' : 'Escrever a discursiva') + '</button>';
}
// Várias partes da tela pedem as pendências no mesmo desenho: o cálculo vale até o fim da tarefa atual
function pendencias() {
  if (!pendCache) {
    pendCache = calcularPendencias();
    if (typeof queueMicrotask === 'function') queueMicrotask(() => { pendCache = null; });
    else setTimeout(() => { pendCache = null; }, 0);
  }
  return pendCache || [];
}
// O atraso conta a partir da criação do perfil (quem começa no meio do plano não herda semanas de atraso), ou do
// início do plano, se a pessoa pedir para incluir os dias anteriores (S.perfil.atrasoDesde)
function inicioAtraso() { return S.perfil.atrasoDesde || S.perfil.criado || hojeISO(); }
// Dias do plano antes do início do atraso, já passados e não dispensados (revisão sem discursiva não conta, como no
// atraso): ficam de fora até a pessoa incluí-los
function diasAntesDoAtraso() {
  const ini = inicioAtraso(), disp = S.perfil.dispensados || {};
  return DIAS.filter((d) => d.data < ini && d.data < hojeISO() && !disp[d.data] && (d.modo !== 'revisao' || d.disc));
}
function calcularPendencias() {
  const h = hojeISO(), ini = inicioAtraso();
  const disp = S.perfil.dispensados || {}, lidos = S.perfil.lidos || {};
  const out = [];
  for (const dia of DIAS) {
    if (dia.data >= h || dia.data < ini || disp[dia.data]) continue;
    const sessao = !S.perfil.feitos[dia.data] && dia.modo !== 'revisao' && !diaCompensado(dia);
    const ler = leituraAtrasadaDoDia(dia, lidos);
    const disc = !!dia.disc && !discFeita(dia);
    if (sessao || ler.length || disc) out.push({ dia, sessao, ler, disc });
  }
  return out;
}
// Blocos dos dias de questões atrasados, na ordem do dia mais antigo; cada um com quantos dias o pedem
function blocosAtrasados(p) {
  const m = new Map();
  for (const x of p || pendencias()) if (x.sessao && x.dia.modo === 'treino') for (const b of x.dia.blocos) m.set(b, (m.get(b) || 0) + 1);
  return [...m.entries()].map(([b, dias]) => ({ b, dias }));
}
function leituraAtrasada(p) {
  const arts = [];
  for (const x of p || pendencias()) for (const k of x.ler) if (!arts.includes(k)) arts.push(k);
  return arts;
}
// Sessão de recuperação: o dia atrasado mais antigo, com o que falta em cada matéria dele. Terminada, o dia dá baixa.
function proximaRecuperacao(p) {
  const x = (p || pendencias()).find((y) => y.sessao && y.dia.modo === 'treino');
  if (!x) return null;
  const falta = faltaDoDia(x.dia);
  return { dia: x.dia, falta, n: falta.reduce((a, f) => a + f.falta, 0) };
}
function cfgRecuperacao() {
  const r = proximaRecuperacao();
  if (!r) return null;
  const usados = new Set();
  const st = stDoDia(r.dia), ids = [];
  // Só conta para o dia item das matérias dele ainda não respondido desde aquele dia (como em faltaDoDia): os do subtema
  // que caem em outra matéria ficam de fora, e cada matéria recebe o que ainda falta dela
  const desde = diaNum(r.dia.data), conta = (q) => { const x = rec(q.id); return !(x && x[0] >= 0 && x[4] >= desde); };
  if (st) for (const id of idsDoSubtemaNoDia(st, r.dia.blocos, Math.max(r.n, 10))) { const q = QI.get(id); if (q && r.dia.blocos.includes(q.b) && !usados.has(id)) { usados.add(id); ids.push(id); } }
  for (const f of r.falta) {
    const ja = ids.filter((id) => { const q = QI.get(id); return q.b === f.b && conta(q); }).length;
    if (f.falta > ja) for (const q of selecionar(poolDe([f.b]).filter((q) => !usados.has(q.id) && conta(q)), f.falta - ja, 'mistas')) { usados.add(q.id); ids.push(q.id); }
  }
  return ids.length ? { modo: 'treino', ids: embaralhar(ids), titulo: 'Recuperação · ' + fmtData(r.dia.data, { weekday: 'short', day: '2-digit', month: '2-digit' }), dia: 'rec:' + hojeISO() } : null;
}
function botaoRecuperar(p) {
  const r = proximaRecuperacao(p);
  return r ? '<button class="btn pequeno primario" data-acao="recuperar">' + esc(rotuloPausa('rec:' + hojeISO(), 'Recuperar ' + fmtData(r.dia.data, { day: '2-digit', month: '2-digit' }) + ' · ' + pl(r.n, 'item', 'itens'))) + '</button>' : '';
}
// Linha que explica o que não entra no atraso: os dias antes do perfil (com botão para incluí-los) e a revisão de ontem
function notaForaDoAtraso() {
  const antes = diasAntesDoAtraso(), ontem = DIAS.find((d) => d.data === isoDeNum(HOJE() - 1));
  let t = '';
  if (antes.length) t += '<p class="pequeno">Os ' + pl(antes.length, 'dia', 'dias') + ' do plano de ' + esc(fmtData(antes[0].data, { day: '2-digit', month: '2-digit' })) + ' a ' + esc(fmtData(antes[antes.length - 1].data, { day: '2-digit', month: '2-digit' })) + ' ficaram fora do atraso porque o seu perfil começou em ' + esc(fmtData(inicioAtraso(), { day: '2-digit', month: '2-digit' })) + '. <button class="linkish" data-acao="atraso-desde-inicio">Incluir esses dias no atraso</button></p>';
  if (ontem && ontem.modo === 'revisao' && !S.perfil.feitos[ontem.data] && ontem.data >= inicioAtraso()) t += '<p class="pequeno mudo">A revisão de ontem não vira atraso: o que venceu continua na lista curta e entra na próxima revisão.</p>';
  return t;
}
function cartaoPendencias() {
  const p = pendencias();
  if (!p.length) {
    const nota = notaForaDoAtraso();
    return nota ? '<div class="cartao pendencias vazio"><div class="secao-cab"><h2>Atraso do plano</h2><span class="mono pequeno mudo">0</span></div><p class="pequeno mudo">Nada ficou para trás desde ' + esc(fmtData(inicioAtraso(), { day: '2-digit', month: '2-digit' })) + '.</p>' + nota + '</div>' : '';
  }
  const bs = blocosAtrasados(p), ler = leituraAtrasada(p), sims = p.filter((x) => x.sessao && x.dia.modo === 'simulado');
  const dias = p.filter((x) => x.sessao).length;
  let h = '<div class="cartao pendencias"><div class="secao-cab"><h2>Atraso do plano</h2><span class="mono pequeno mudo">' + p.length + '</span></div>' +
    '<p class="pequeno mudo">Nada sai daqui sozinho: o dia só sai quando você estuda a matéria dele, por qualquer caminho, ou o dispensa.</p>';
  if (bs.length) h += '<div class="atraso-materias">' + bs.slice(0, 6).map((x) => '<span class="chip-atraso">' + esc(nomeBloco(x.b)) + (x.dias > 1 ? ' <b>×' + x.dias + '</b>' : '') + '</span>').join('') + (bs.length > 6 ? '<span class="chip-atraso mais">+' + pl(bs.length - 6, 'matéria', 'matérias') + '</span>' : '') + '</div>' +
    '<div class="linha-btns">' + botaoRecuperar(p) + (ler.length ? '<button class="btn pequeno" data-acao="ler-atraso">Ler ' + Math.min(ler.length, LEITURA_MAX) + (ler.length > LEITURA_MAX ? ' de ' + ler.length : '') + (ler.length === 1 ? ' artigo' : ' artigos') + '</button>' : '') + '</div>';
  else if (ler.length) h += '<div class="linha-btns"><button class="btn pequeno primario" data-acao="ler-atraso">Ler ' + Math.min(ler.length, LEITURA_MAX) + (ler.length > LEITURA_MAX ? ' de ' + ler.length : '') + ' artigos atrasados</button></div>';
  const discs = p.filter((x) => x.disc);
  if (discs.length) h += '<div class="pend"><div class="pend-txt"><b>' + pl(discs.length, 'discursiva atrasada', 'discursivas atrasadas') + '</b><span>A mais antiga: ' + esc(fmtData(discs[0].dia.data, { day: '2-digit', month: '2-digit' })) + ', ' + esc((temaDisc(discs[0].dia) || { titulo: discs[0].dia.disc }).titulo) + '. Cada discursiva corrigida e salva dá baixa numa delas.</span></div><div class="linha-btns">' + botaoDiscDia(discs[0].dia, !bs.length) + '</div></div>';
  for (const x of sims) h += '<div class="pend"><div class="pend-txt"><b>Simulado de ' + esc(fmtData(x.dia.data, { day: '2-digit', month: '2-digit' })) + '</b><span>' + esc(x.dia.atividade) + '</span></div><div class="linha-btns"><button class="btn pequeno" data-acao="iniciar-dia" data-dia="' + x.dia.data + '">' + esc(rotuloPausa(x.dia.data, 'Fazer agora')) + '</button></div></div>';
  h += '<details class="det-lista" data-det="atraso"' + (UI.det.atraso ? ' open' : '') + '><summary>Ver os ' + pl(p.length, 'dia', 'dias') + (dias ? ' (' + dias + ' com sessão)' : '') + '</summary>' +
    p.map((x) => {
      const oque = [x.sessao ? (x.dia.modo === 'simulado' ? 'o simulado' : 'a sessão de ' + x.dia.n + ' itens') : '', x.ler.length ? pl(x.ler.length, 'artigo da leitura', 'artigos da leitura') : '', x.disc ? 'a discursiva' : ''].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' e $1');
      // O que o dia já tem fica à vista: feita a sessão, sobra só a leitura (ou a discursiva)
      const jaFeito = !x.sessao && x.dia.modo !== 'revisao' ? (x.dia.modo === 'simulado' ? 'Simulado feito. ' : 'Questões feitas. ') : '';
      return '<div class="pend"><div class="pend-txt"><b>' + esc(fmtData(x.dia.data, { weekday: 'short', day: '2-digit', month: '2-digit' })) + '</b><span>' + esc(x.dia.atividade) + '</span><span class="pequeno mudo">' + (jaFeito ? '✓ ' + jaFeito : '') + 'Falta' + (!!x.sessao + !!x.ler.length + !!x.disc > 1 || x.ler.length > 1 ? 'm ' : ' ') + esc(oque) + '.</span></div>' +
        '<div class="linha-btns">' + (x.sessao && x.dia.modo !== 'simulado' ? '<button class="btn pequeno" data-acao="iniciar-dia" data-dia="' + x.dia.data + '">' + esc(rotuloPausa(x.dia.data, 'Fazer este dia')) + '</button>' : '') +
        (x.ler.length ? '<button class="btn pequeno" data-acao="ler-pendente" data-dia="' + x.dia.data + '">Ler ' + x.ler.length + '</button>' : '') +
        (x.disc ? botaoDiscDia(x.dia) : '') +
        '<button class="linkish pequeno" data-acao="dispensar-dia" data-dia="' + x.dia.data + '">Dispensar</button></div></div>';
    }).join('') + '</details>';
  return h + notaForaDoAtraso() + '</div>';
}

