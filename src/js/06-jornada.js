/* ================= Jornada: RPG em cima do estudo de verdade ================= */
// O herói é você: o nível vem do XP, os atributos são o seu domínio real em cada disciplina, e o equipamento sai do
// saque. Toda semana um chefão encarna o bloco em que você está mais fraco. Acertar item desse bloco causa dano
// (mais em item difícil, em dobro no crítico); na batalha, cada erro custa um coração e três acertos seguidos
// devolvem um. Os itens do saque são os princípios e conceitos da LGPD, com o texto da lei como descrição.
// Nada disso tira XP, e missão não feita não acumula para o dia seguinte.
const MISSOES = [
  { id: 'q30', txt: () => 'Responder ' + metaDia() + ' itens', xp: 30, meta: () => metaDia(), val: (d) => d.r || 0 },
  { id: 'novas', txt: () => 'Responder ' + metaNovas() + ' itens inéditos', xp: 40, meta: () => metaNovas(), val: (d) => d.ni || 0 },
  { id: 'acerto', txt: 'Acertar 80% de pelo menos 20 itens', xp: 40, meta: 1, val: (d) => ((d.r || 0) >= 20 && d.c / d.r >= 0.8 ? 1 : 0), fr: (d) => Math.min(1, (d.r || 0) / 20) },
  { id: 'roteiro', txt: 'Fechar o roteiro de hoje', xp: 60, meta: 1, val: (d) => d.rt || 0, so: () => !!roteiroHoje() },
  { id: 'arterro', txt: 'Ler o artigo de um item que você errou', xp: 40, meta: 1, val: (d) => { const e = artigosDeErros(); return (d.a || []).filter((k) => e.has(k)).length; }, so: () => artigosDeErros().size > 0 },
  { id: 'lei5', txt: () => 'Ler ' + metaLei() + ' artigos da lei seca', xp: 30, meta: () => metaLei(), val: (d) => (d.a || []).length },
  { id: 'tempo60', txt: () => 'Estudar ' + fmtDur(metaMin60() * 60), xp: 40, meta: () => metaMin60(), val: (d) => Math.floor(segundosEstudo(d) / 60) },
  { id: 'virada', txt: 'Acertar 5 itens que você tinha errado em outro dia', xp: 50, meta: 5, val: (d) => d.vr || 0, so: () => Object.values(S.itens).filter((r) => r[0] === 0 && r[3] > 0 && r[4] < HOJE()).length >= 5 },
  { id: 'pesq', txt: 'Investigar um tema da lista Para pesquisar', xp: 30, meta: 1, val: () => Object.values(S.pesquisa).filter((p) => p.s && p.f === hojeISO()).length },
  { id: 'pend', txt: 'Recuperar uma sessão do atraso', xp: 60, meta: 1, val: (d) => d.pd || 0, so: () => pendencias().some((x) => x.sessao) },
  { id: 'chefe5', txt: 'Acertar 5 golpes no chefão', xp: 40, meta: 5, val: (d) => (chefeDaSemana().vencido ? 5 : d.cg || 0), so: () => !chefeDaSemana().vencido },
];
const MI = new Map(MISSOES.map((m) => [m.id, m]));
// Metas das missões pelo ritmo pessoal (sem ritmo, os valores de sempre: 30, 60, 20, 5 artigos e 1 hora)
function metaNovas() { const r = ritmo(); return r && r.ni ? limitar(Math.round(r.ni / 10) * 10, 20, 80) : 20; }
function metaLei() { const r = ritmo(); return r && r.a ? limitar(r.a, 5, 12) : 5; }
function metaMin60() { const r = ritmo(); return r && r.min ? limitar(Math.round(r.min / 15) * 15, 60, 180) : 60; }
const valM = (v) => (typeof v === 'function' ? v() : v);
const BAU_XP = 50, CHEFE_VIDA = 300, CHEFE_XP = 150, CORACOES = 5, BATALHA_N = 15;
const CHEFES = { lgpd: 'O Vazador de Dados', regulacao: 'O Regulador Capturado', direito: 'O Burocrata Sem Motivação', linguas: 'A Esfinge dos Conectivos', seginfo: 'O Ransomware', gestao: 'O Risco Sem Dono', eca: 'O Algoritmo Viciante', economia: 'O Monopolista', comparado: 'O Exportador Sem Adequação', contabil: 'O Rombo nas Contas' };
// Brasão de cada chefão: um escudo com o símbolo da disciplina
const SIMBOLOS = {
  lgpd: '<rect x="9" y="11" width="6" height="5" rx="1"/><path d="M10 11V9.5a2 2 0 0 1 4 0V11"/>',
  regulacao: '<path d="M12 7v10M8 17h8M7 10h10M7 10l-1.5 3h3zM17 10l-1.5 3h3z"/>',
  direito: '<path d="M7 9h10M8 9v7M12 9v7M16 9v7M7 16h10M12 6.5 17 9H7z"/>',
  linguas: '<path d="M8 8h8v6h-4l-3 2.5V14H8z"/>',
  seginfo: '<path d="M13 6.5 9.5 12.5H12l-1 5 3.5-6H12z"/>',
  gestao: '<circle cx="12" cy="12" r="2.2"/><path d="M12 7.5v1.6M12 14.9v1.6M7.5 12h1.6M14.9 12h1.6M8.8 8.8l1.1 1.1M14.1 14.1l1.1 1.1M8.8 15.2l1.1-1.1M14.1 9.9l1.1-1.1"/>',
  eca: '<path d="M6.5 12s2-3.5 5.5-3.5 5.5 3.5 5.5 3.5-2 3.5-5.5 3.5S6.5 12 6.5 12z"/><circle cx="12" cy="12" r="1.4"/>',
  economia: '<circle cx="12" cy="12" r="4"/><path d="M12 9.5v5M10.8 10.5h2a.9.9 0 0 1 0 1.8h-1.6a.9.9 0 0 0 0 1.8h2"/>',
  comparado: '<circle cx="12" cy="12" r="4"/><path d="M8 12h8M12 8c1.3 1.2 1.3 6.8 0 8M12 8c-1.3 1.2-1.3 6.8 0 8"/>',
  contabil: '<path d="M7.5 8.5h9M7.5 12h9M7.5 15.5h9M12 7v10"/>',
};
function brasao(disc) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="escudo" d="M12 2.5 19.5 5v6.2c0 4.6-3.2 8.3-7.5 10.3-4.3-2-7.5-5.7-7.5-10.3V5z"/>' + (SIMBOLOS[disc] || SIMBOLOS.lgpd) + '</svg>'; }
function coracao(cheio, cls) { return '<svg class="cor' + (cheio ? ' cheio' : '') + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>'; }

// Saque: quatro raridades e três encaixes. Arma aumenta o dano, armadura dá corações extras na batalha e amuleto dá
// chance de crítico. A descrição é o texto da lei.
const RARIDADES = { comum: { nome: 'Comum', ordem: 0 }, raro: { nome: 'Raro', ordem: 1 }, epico: { nome: 'Épico', ordem: 2 }, lendario: { nome: 'Lendário', ordem: 3 } };
const ENCAIXES = { arma: 'Arma', armadura: 'Armadura', amuleto: 'Amuleto' };
const EFEITO = { arma: { comum: 10, raro: 20, epico: 35, lendario: 50 }, armadura: { comum: 1, raro: 1, epico: 2, lendario: 3 }, amuleto: { comum: 5, raro: 10, epico: 15, lendario: 25 } };
const ITENS_RPG = [
  { id: 'necessidade', slot: 'arma', rar: 'comum', nome: 'Lâmina da Necessidade', lore: 'limitação do tratamento ao mínimo necessário para a realização de suas finalidades', ref: 'LGPD, art. 6º, III' },
  { id: 'adequacao', slot: 'arma', rar: 'raro', nome: 'Lança da Adequação', lore: 'compatibilidade do tratamento com as finalidades informadas ao titular, de acordo com o contexto do tratamento', ref: 'LGPD, art. 6º, II' },
  { id: 'finalidade', slot: 'arma', rar: 'epico', nome: 'Espada da Finalidade', lore: 'realização do tratamento para propósitos legítimos, específicos, explícitos e informados ao titular', ref: 'LGPD, art. 6º, I' },
  { id: 'sancao', slot: 'arma', rar: 'lendario', nome: 'Martelo da Autoridade Nacional', lore: 'A aplicação das sanções previstas nesta Lei compete exclusivamente à ANPD', ref: 'LGPD, art. 55-K' },
  { id: 'pseudonimizacao', slot: 'armadura', rar: 'comum', nome: 'Capa da Pseudonimização', lore: 'um dado perde a possibilidade de associação, direta ou indireta, a um indivíduo, senão pelo uso de informação adicional mantida separadamente pelo controlador', ref: 'LGPD, art. 13, § 4º' },
  { id: 'prevencao', slot: 'armadura', rar: 'raro', nome: 'Cota da Prevenção', lore: 'adoção de medidas para prevenir a ocorrência de danos em virtude do tratamento de dados pessoais', ref: 'LGPD, art. 6º, VIII' },
  { id: 'seguranca', slot: 'armadura', rar: 'epico', nome: 'Couraça da Segurança', lore: 'medidas técnicas e administrativas aptas a proteger os dados pessoais de acessos não autorizados', ref: 'LGPD, art. 6º, VII' },
  { id: 'concepcao', slot: 'armadura', rar: 'lendario', nome: 'Égide da Concepção', lore: 'desde a fase de concepção do produto ou do serviço até a sua execução', ref: 'LGPD, art. 46, § 2º' },
  { id: 'livre-acesso', slot: 'amuleto', rar: 'comum', nome: 'Talismã do Livre Acesso', lore: 'consulta facilitada e gratuita sobre a forma e a duração do tratamento', ref: 'LGPD, art. 6º, IV' },
  { id: 'transparencia', slot: 'amuleto', rar: 'raro', nome: 'Lente da Transparência', lore: 'informações claras, precisas e facilmente acessíveis sobre a realização do tratamento', ref: 'LGPD, art. 6º, VI' },
  { id: 'nao-discriminacao', slot: 'amuleto', rar: 'epico', nome: 'Selo da Não Discriminação', lore: 'impossibilidade de realização do tratamento para fins discriminatórios ilícitos ou abusivos', ref: 'LGPD, art. 6º, IX' },
  { id: 'prestacao-contas', slot: 'amuleto', rar: 'lendario', nome: 'Coroa da Prestação de Contas', lore: 'demonstração, pelo agente, da adoção de medidas eficazes e capazes de comprovar a observância e o cumprimento das normas', ref: 'LGPD, art. 6º, X' },
];
const IR = new Map(ITENS_RPG.map((x) => [x.id, x]));
const XP_REPETIDO = { comum: 20, raro: 40, epico: 80, lendario: 150 };
function efeitoTxt(it) { const v = EFEITO[it.slot][it.rar]; return it.slot === 'arma' ? '+' + v + '% de dano' : it.slot === 'armadura' ? '+' + pl(v, 'coração', 'corações') : '+' + v + '% de crítico'; }

function rpg() {
  const r = (S.perfil.rpg ||= {});
  r.inv ||= {};
  r.eq ||= {};
  return r;
}
function equipado(slot) { const id = rpg().eq[slot]; return id && rpg().inv[id] ? IR.get(id) : null; }
function bonusDano() { const a = equipado('arma'); return a ? EFEITO.arma[a.rar] : 0; }
function chanceCritico() { const a = equipado('amuleto'); return a ? EFEITO.amuleto[a.rar] : 0; }
function coracoesMax() { const a = equipado('armadura'); return CORACOES + (a ? EFEITO.armadura[a.rar] : 0); }
// Sorteio de saque. O item repetido vira XP; o novo vai para o inventário e é equipado se o encaixe estiver vazio
// ou ocupado por item de raridade menor.
function sortearRaridade(pesos) {
  let x = Math.random() * Object.values(pesos).reduce((a, b) => a + b, 0);
  for (const [k, p] of Object.entries(pesos)) { x -= p; if (x < 0) return k; }
  return 'comum';
}
function saque(pesos) {
  const rar = sortearRaridade(pesos), opcoes = ITENS_RPG.filter((x) => x.rar === rar);
  const it = opcoes[Math.floor(Math.random() * opcoes.length)];
  const r = rpg();
  if (r.inv[it.id]) { ganharXP(XP_REPETIDO[rar]); return { it, repetido: true }; }
  r.inv[it.id] = hojeISO();
  const atual = equipado(it.slot);
  if (!atual || RARIDADES[atual.rar].ordem < RARIDADES[rar].ordem) r.eq[it.slot] = it.id;
  return { it, repetido: false };
}
function avisarSaque(origem, s) {
  avisar('◆', origem + ': ' + s.it.nome, RARIDADES[s.it.rar].nome + ' · ' + (s.repetido ? 'repetido, virou +' + XP_REPETIDO[s.it.rar] + ' XP' : efeitoTxt(s.it)));
}

function hashTxt(t) { let h = 2166136261; for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
// As missões do dia são sorteadas uma vez (pela data) e ficam guardadas; a de pendência entra sempre que houver
// sessão para encaixar, e nunca saem duas de "responder N itens" no mesmo dia
// Artigos dos itens cuja última resposta foi erro: ler um deles é o passo que mais rende quando o erro foi "não sabia"
function artigosDeErros() {
  const set = new Set();
  for (const [id, r] of Object.entries(S.itens)) {
    if (r[0] !== 0 || !(r[3] > 0)) continue;
    const q = QI.get(id);
    if (q && q.art && LEIS[q.l]) set.add(chave(q.l, q.art));
  }
  return set;
}
function missoesHoje() {
  const h = hojeISO(), r = rpg(), m = (r.m ||= {});
  if (!m[h]) {
    const pool = MISSOES.filter((x) => !x.so || x.so());
    const ids = pool.some((x) => x.id === 'pend') ? ['pend'] : [];
    for (const x of pool.filter((y) => y.id !== 'pend').sort((a, b) => hashTxt(h + a.id) - hashTxt(h + b.id))) {
      if (ids.length >= 3) break;
      ids.push(x.id);
    }
    m[h] = { ids, ok: {} };
    const limite = isoDeNum(HOJE() - 14);
    for (const k of Object.keys(m)) if (k < limite) delete m[k];
  }
  // Missão de um dia guardado que deixou de existir sai da lista (senão o baú do dia nunca abriria)
  m[h].ids = m[h].ids.filter((id) => MI.has(id));
  return m[h];
}
function verificarRPG() {
  const d = diaLog(), mh = missoesHoje();
  let mudou = false;
  for (const id of mh.ids) {
    const x = MI.get(id);
    if (!x || mh.ok[id] || x.val(d) < valM(x.meta)) continue;
    mh.ok[id] = 1; mudou = true;
    ganharXP(x.xp);
    avisar('★', 'Missão cumprida', valM(x.txt) + ' · +' + x.xp + ' XP');
    tocar('combo');
  }
  if (!mh.bau && mh.ids.length && mh.ids.every((id) => mh.ok[id])) {
    mh.bau = 1; mudou = true;
    // O histórico de missões guarda só 14 dias; o total de baús fica num contador próprio
    rpg().baus = (rpg().baus || 0) + 1;
    ganharXP(BAU_XP);
    const s = saque({ comum: 60, raro: 30, epico: 9, lendario: 1 });
    mh.item = s.it.id;
    avisarSaque('Baú do dia', s);
    tocar('festa');
  }
  if (mudou) Store.salvar('perfil');
}
function semanaAtual() { return isoDeNum(HOJE() - ((diaSemana(hojeISO()) + 6) % 7)); }
function discChefe(bloco) { const b = BI.get(bloco); return (b && b.disciplina) || 'lgpd'; }
function nomeChefe(bloco) { return CHEFES[discChefe(bloco)] || 'O Chefão'; }
// Chefão da semana (de segunda a domingo): o bloco mais fraco entre os já praticados (5 ou mais itens respondidos),
// sem repetir o da semana anterior; quem ainda não praticou nada enfrenta o bloco mais fraco da prioridade 1.
// Chefão salvo antes da escala de 300 de vida (15 golpes) é convertido na mesma proporção.
function normalizarChefe(c) {
  if (c && !c.max) { c.vida = Math.round((c.vida / 15) * CHEFE_VIDA); c.max = CHEFE_VIDA; }
  return c;
}
function chefeDaSemana() {
  const r = rpg(), sem = semanaAtual();
  if (!r.chefe || r.chefe.sem !== sem) {
    const anterior = r.chefe && r.chefe.bloco;
    const cand = BLOCOS.filter((b) => (POR_BLOCO.get(b.id) || []).length >= 20 && b.id !== anterior).map((b) => ({
      b, dom: dominioBloco(b.id) || 0, resp: POR_BLOCO.get(b.id).filter((q) => { const x = rec(q.id); return x && x[0] >= 0; }).length,
    }));
    const praticados = cand.filter((x) => x.resp >= 5);
    const alvo = (praticados.length ? praticados : cand.filter((x) => P1.includes(x.b.id))).sort((a, b) => a.dom - b.dom)[0] || cand[0];
    r.chefe = { sem, bloco: alvo.b.id, vida: CHEFE_VIDA, max: CHEFE_VIDA };
  }
  normalizarChefe(r.chefe);
  return r.chefe;
}
// Dano de um acerto: 10, 15 ou 20 pela dificuldade do item, mais o bônus da arma. É crítico (dano em dobro) quando o
// artigo do item já caiu em prova real ou, ao acaso, pela chance do amuleto.
function danoDe(q) {
  const base = 5 + 5 * Math.min(3, Math.max(1, q.d || 2));
  const crit = caiuEmProva(q) > 0 || Math.random() * 100 < chanceCritico();
  return { dano: Math.round(base * (1 + bonusDano() / 100)) * (crit ? 2 : 1), crit };
}
function golpeChefe(q) {
  const c = chefeDaSemana();
  if (c.vencido || q.b !== c.bloco) return;
  const { dano, crit } = danoDe(q);
  c.vida = Math.max(0, c.vida - dano);
  const d = diaLog();
  d.cg = (d.cg || 0) + 1;
  golpeRecente = { dano, crit, vida: c.vida, max: c.max, vencido: !c.vida };
  if (c.vida) return;
  c.vencido = hojeISO();
  ganharXP(CHEFE_XP);
  rpg().trofeus = rpg().trofeus || [];
  rpg().trofeus.unshift({ sem: c.sem, bloco: c.bloco, data: hojeISO() });
  const s = saque({ raro: 50, epico: 40, lendario: 10 });
  c.item = s.it.id;
  golpeRecente.item = s;
  avisarSaque('Saque do chefão', s);
}

// Arena: o chefão em cima, com brasão, nome e barra de vida; embaixo, o herói com nível e corações. Na batalha, os
// corações valem; fora dela, a faixa aparece só quando o item é do bloco do chefão.
function hpBarra(vida, max, cls) { return '<div class="hp' + (cls ? ' ' + cls : '') + '" role="img" aria-label="Vida ' + vida + ' de ' + max + '"><i style="width:' + Math.round((vida / max) * 100) + '%"></i></div>'; }
function renderArena(q) {
  if (!sessao || sessao.modo === 'simulado' || UI.foco) return '';
  const c = chefeDaSemana(), g = sessao.revelado || sessao.flash ? sessao.golpe : null, bat = sessao.batalha;
  if (!bat && (c.vencido || !q || q.b !== c.bloco) && !g) return '';
  const disc = discChefe(c.bloco);
  let h = '<div class="arena' + (bat ? '' : ' faixa') + '"><div class="arena-inimigo' + (g ? ' atingido' : '') + (c.vencido ? ' caido' : '') + '"><span class="brasao">' + brasao(disc) + '</span>' +
    '<div class="arena-info"><b>' + esc(nomeChefe(c.bloco)) + '</b>' + hpBarra(c.vencido ? 0 : c.vida, c.max) + '<span class="mono hp-num">HP ' + (c.vencido ? 0 : c.vida) + '/' + c.max + '</span></div>' +
    (g ? '<span class="dano' + (g.crit ? ' crit' : '') + '">' + (g.crit ? '<small>CRÍTICO</small>' : '') + '−' + g.dano + '</span>' : '') + '</div>';
  if (bat) {
    const perdeu = sessao.revelado && sessao.perdeuCoracao, curou = sessao.revelado && sessao.curou;
    h += '<div class="arena-heroi' + (perdeu ? ' ferido' : '') + '"><span class="mono">Nv ' + nivelDe(S.perfil.xp).n + '</span><span class="coracoes" aria-label="' + sessao.coracoes + ' de ' + sessao.coracoesMax + ' corações">' +
      Array.from({ length: sessao.coracoesMax }, (_, k) => coracao(k < sessao.coracoes, perdeu && k === sessao.coracoes ? 'quebra' : curou && k === sessao.coracoes - 1 ? 'volta' : '')).join('') + '</span>' +
      (sessao.combo >= 2 ? '<span class="mono serie">×' + sessao.combo + '</span>' : '') + '</div>';
  }
  return h + '</div>';
}
// Na batalha: erro custa um coração, três acertos seguidos devolvem um; sem corações, ou com o chefão no chão, a
// batalha acaba no próximo toque
function efeitoBatalha(ok) {
  sessao.perdeuCoracao = false; sessao.curou = false;
  if (!sessao.batalha) return;
  if (!ok) { sessao.coracoes = Math.max(0, sessao.coracoes - 1); sessao.perdeuCoracao = true; sessao.perdas = (sessao.perdas || 0) + 1; }
  else if (sessao.combo && sessao.combo % 3 === 0 && sessao.coracoes < sessao.coracoesMax) { sessao.coracoes++; sessao.curou = true; }
  if (sessao.golpe) { sessao.danoTotal = (sessao.danoTotal || 0) + sessao.golpe.dano; if (sessao.golpe.crit) sessao.criticos = (sessao.criticos || 0) + 1; }
  if (!sessao.coracoes) sessao.desfecho = 'derrota';
  else if (sessao.golpe && sessao.golpe.vencido) { sessao.desfecho = 'vitoria'; }
}
// Encerra a batalha antes do fim da fila: o resultado considera só os itens respondidos
function encerrarBatalha() {
  sessao.ids = sessao.ids.filter((id) => sessao.resp[id]);
  finalizar();
}
function cartaoBatalha() {
  if (!sessao.batalha) return '';
  const c = chefeDaSemana(), fim = sessao.desfecho || (c.vencido ? 'vitoria' : 'recuo');
  const titulo = { vitoria: 'Vitória', derrota: 'Derrota', recuo: 'O chefão resiste' }[fim];
  const s = fim === 'vitoria' && sessao.golpeFinal && sessao.golpeFinal.item;
  return '<div class="cartao batalha-fim ' + fim + '"><div class="bf-cab"><span class="brasao">' + brasao(discChefe(c.bloco)) + '</span><div><span class="rotulo">' + esc(nomeChefe(c.bloco)) + '</span><h2>' + titulo + '</h2></div></div>' +
    hpBarra(c.vencido ? 0 : c.vida, c.max) +
    (sessao.defesas ? '<p class="pequeno">' + pl(sessao.defesas, 'defesa', 'defesas') + ': em branco quando faltou certeza, sem perder coração. Na prova, é ponto que não se perde.</p>' : '') +
    '<div class="placar"><div><b>' + (sessao.danoTotal || 0) + '</b><span>dano</span></div><div><b>' + (sessao.criticos || 0) + '</b><span>críticos</span></div><div><b>' + sessao.comboMax + '</b><span>maior série</span></div><div><b>' + (c.vencido ? 0 : c.vida) + '</b><span>HP restante</span></div></div>' +
    (s ? cartaoItem(s.it, s.repetido ? 'Repetido: virou +' + XP_REPETIDO[s.it.rar] + ' XP' : 'Novo no inventário') : '') +
    (fim === 'derrota' ? '<p class="pequeno mudo">Sem corações, a batalha acabou. O dano causado fica: o chefão continua com ' + c.vida + ' de vida até domingo.</p>' : '') +
    (fim !== 'vitoria' && !c.vencido ? '<div class="linha-btns"><button class="btn primario" data-acao="enfrentar-chefe">Batalhar de novo</button></div>' : '') + '</div>';
}
function cartaoItem(it, nota) {
  return '<div class="item-rpg r-' + it.rar + '"><div class="ir-cab"><b>' + esc(it.nome) + '</b><span class="mono pequeno">' + RARIDADES[it.rar].nome + ' · ' + ENCAIXES[it.slot] + '</span></div>' +
    '<span class="ir-efeito">' + esc(efeitoTxt(it)) + '</span><q>' + esc(it.lore) + '</q><span class="pequeno mudo">' + esc(it.ref) + (nota ? ' · ' + esc(nota) : '') + '</span></div>';
}

// Card da Jornada no painel: herói, chefão e missões do dia
function cartaoJornada() {
  const d = S.perfil.dias[hojeISO()] || {}, mh = missoesHoje(), c = chefeDaSemana(), nv = nivelDe(S.perfil.xp);
  const feitas = mh.ids.filter((id) => mh.ok[id]).length;
  const missoes = mh.ids.map((id) => {
    const x = MI.get(id);
    if (!x) return '';
    const v = x.val(d), ok = !!mh.ok[id], meta = valM(x.meta), f = ok ? 1 : x.fr ? x.fr(d) : Math.min(1, v / meta);
    return '<div class="missao' + (ok ? ' ok' : '') + '"><span class="m-ic" aria-hidden="true">' + (ok ? '✓' : '★') + '</span><div class="m-txt"><b>' + esc(valM(x.txt)) + '</b>' + barra(f, 'ouro') + (!ok && x.acao ? x.acao() : '') + '</div>' +
      '<span class="mono pequeno">' + (ok ? '+' + x.xp + ' XP' : x.fr ? (d.r || 0) + '/20' : Math.min(v, meta) + '/' + meta) + '</span></div>';
  }).join('');
  const eq = Object.keys(ENCAIXES).map(equipado).filter(Boolean);
  const slots = eq.length ? eq.map((it) => '<span class="slot r-' + it.rar + '" title="' + esc(it.nome + ' · ' + efeitoTxt(it)) + '">' + esc(it.nome) + '</span>').join('') : '<span class="pequeno mudo">Sem equipamento</span>';
  const heroi = '<button class="heroi-rpg" data-acao="mais" data-sub="personagem"><span class="insignia">' + nv.n + '</span><span class="h-info"><b>' + esc(nv.nome) + '</b>' + barra((S.perfil.xp - nv.base) / (nv.prox - nv.base), 'ouro') +
    '<span class="mono pequeno">' + fmtNum(S.perfil.xp) + ' / ' + fmtNum(nv.prox) + ' XP · ' + coracoesMax() + ' ♥ · +' + bonusDano() + '% dano · ' + chanceCritico() + '% crítico</span></span><span class="slots">' + slots + '</span></button>';
  const chefe = '<div class="chefe' + (c.vencido ? ' vencido' : '') + '"><span class="brasao">' + brasao(discChefe(c.bloco)) + '</span><div class="chefe-info"><div class="chefe-cab"><b>' + esc(nomeChefe(c.bloco)) + '</b><span class="mono pequeno">' + (c.vencido ? 'derrotado' : 'HP ' + c.vida + '/' + c.max) + '</span></div>' +
    '<span class="pequeno mudo">' + esc(nomeBloco(c.bloco)) + '</span>' + hpBarra(c.vencido ? 0 : c.vida, c.max) + '</div>' +
    (c.vencido ? '' : '<button class="btn pequeno primario" data-acao="enfrentar-chefe">' + esc(rotuloPausa('chefe:' + c.sem, 'Batalhar')) + '</button>') + '</div>';
  const bau = mh.bau && mh.item && IR.get(mh.item) ? '<p class="pequeno">Baú aberto: <b class="r-txt-' + IR.get(mh.item).rar + '">' + esc(IR.get(mh.item).nome) + '</b></p>' : '<p class="pequeno mudo">Três missões abrem o baú do dia, com um item.</p>';
  // Recolhida por padrão (a tela Hoje começa pelo roteiro): o resumo mostra nível, missões e a vida do chefão
  return '<div class="cartao jornada"><details data-det="jornada"' + (UI.det.jornada ? ' open' : '') + '><summary class="jornada-resumo"><b>Jornada</b><span class="mono pequeno mudo">nível ' + nv.n + ' · ' + feitas + '/' + mh.ids.length + ' missões · ' +
    (c.vencido ? 'chefão vencido' : 'chefão ' + Math.round((c.vida / c.max) * 100) + '% de vida') + '</span></summary>' +
    heroi + chefe + '<div class="missoes">' + missoes + '</div>' + bau + '</details></div>';
}
// Ficha do personagem (Mais → Personagem): atributos medidos pelo domínio real, equipamento e inventário
function dominioDisciplina(disc) {
  let s = 0, n = 0;
  for (const b of BLOCOS) if (b.disciplina === disc) { const qs = POR_BLOCO.get(b.id) || []; if (!qs.length) continue; s += (dominioBloco(b.id) || 0) * qs.length; n += qs.length; }
  return n ? s / n : 0;
}
function renderPersonagem() {
  const nv = nivelDe(S.perfil.xp), r = rpg();
  let h = '<div class="cartao ficha"><div class="ficha-cab"><span class="insignia grande">' + nv.n + '</span><div><span class="rotulo">Nível ' + nv.n + '</span><h2>' + esc(nv.nome) + '</h2>' +
    barra((S.perfil.xp - nv.base) / (nv.prox - nv.base), 'ouro') + '<span class="mono pequeno mudo">' + fmtNum(S.perfil.xp) + ' / ' + fmtNum(nv.prox) + ' XP</span></div></div>' +
    '<div class="placar"><div><b>' + coracoesMax() + '</b><span>corações</span></div><div><b>+' + bonusDano() + '%</b><span>dano</span></div><div><b>' + chanceCritico() + '%</b><span>crítico</span></div><div><b>' + ((r.trofeus || []).length) + '</b><span>chefões</span></div></div></div>';
  // Pontos de 1 a 20 pela raiz do domínio: o começo rende pontos visíveis, e o 20 exige dominar o banco inteiro
  h += '<div class="cartao"><div class="secao-cab"><h2>Atributos</h2><span class="pequeno mudo">de 1 a 20, pelo domínio real</span></div><div class="atributos">' +
    DISC.map((d) => { const v = dominioDisciplina(d.id), pts = 1 + Math.round(19 * Math.sqrt(v)); return '<div class="atributo"><span class="brasao mini">' + brasao(d.id) + '</span><span class="at-nome">' + esc(d.nome) + ' <span class="pequeno mudo">' + Math.round(v * 100) + '%</span></span><b class="mono">' + pts + '</b>' + barra(pts / 20) + '</div>'; }).join('') + '</div></div>';
  h += '<div class="cartao"><div class="secao-cab"><h2>Equipamento</h2></div><div class="equip">' + Object.keys(ENCAIXES).map((s) => { const it = equipado(s); return it ? cartaoItem(it, 'equipado') : '<div class="item-rpg vazio"><b>' + ENCAIXES[s] + '</b><span class="pequeno mudo">Vazio. Baús e chefões dão itens.</span></div>'; }).join('') + '</div></div>';
  const inv = ITENS_RPG.filter((x) => r.inv[x.id]);
  h += '<div class="cartao"><div class="secao-cab"><h2>Inventário</h2><span class="mono pequeno mudo">' + inv.length + '/' + ITENS_RPG.length + '</span></div>' +
    (inv.length ? '<div class="inventario">' + inv.map((it) => '<div class="inv-linha r-' + it.rar + '"><div><b>' + esc(it.nome) + '</b><span class="pequeno mudo">' + RARIDADES[it.rar].nome + ' · ' + ENCAIXES[it.slot] + ' · ' + esc(efeitoTxt(it)) + '</span></div>' +
      (r.eq[it.slot] === it.id ? '<span class="pequeno mudo">equipado</span>' : '<button class="btn pequeno" data-acao="equipar" data-item="' + it.id + '">Equipar</button>') + '</div>').join('') + '</div>'
      : '<p class="pequeno mudo">Vazio. Cumpra as três missões do dia para abrir o baú, ou derrote o chefão da semana.</p>') +
    '<p class="pequeno mudo">Faltam ' + (ITENS_RPG.length - inv.length) + ' para completar a coleção. Cada item traz o texto da LGPD que lhe dá nome.</p></div>';
  return h + cartaoTrofeus();
}
function cartaoTrofeus() {
  const t = (S.perfil.rpg && S.perfil.rpg.trofeus) || [];
  return '<div class="cartao"><div class="secao-cab"><h2>Chefões derrotados</h2><span class="mono pequeno mudo">' + t.length + '</span></div>' +
    (t.length ? '<div class="trofeus">' + t.slice(0, 30).map((x) => '<div class="trofeu"><span aria-hidden="true">♛</span><div><b>' + esc(nomeChefe(x.bloco)) + '</b><span class="pequeno">' + esc(nomeBloco(x.bloco)) + '</span><span class="pequeno mudo">semana de ' + esc(fmtData(x.sem, { day: '2-digit', month: '2-digit' })) + ' · derrotado em ' + esc(fmtData(x.data, { day: '2-digit', month: '2-digit' })) + '</span></div></div>').join('') + '</div>'
      : '<p class="pequeno mudo">Nenhum ainda. O chefão da semana está no painel, no card Jornada.</p>') + '</div>';
}
// Prontidão no topo da tela Hoje, acima de qualquer XP: é o número que diz se a prova está perto
function linhaProntidao() {
  const pr = prontidao(), n = pr.real.n;
  const txt = pr.nota != null && pr.cobre >= 0.5
    ? 'Prontidão: <b>' + Math.round(pr.nota) + '</b> de ' + PONTOS_PROVA + ' pontos líquidos' + (pr.faixa ? ' (provavelmente entre ' + pr.faixa[0] + ' e ' + pr.faixa[1] + ')' : '') + ' · itens reais: ' + pct(pr.real.c, n || 1) + '% em ' + n +
      (pr.semReais + pr.semDados ? ' · ' + pl(pr.semReais + pr.semDados, 'disciplina ainda sem medida própria', 'disciplinas ainda sem medida própria') : '')
    : 'Prontidão: ' + (n ? pct(pr.real.c, n) + '% nos ' + pl(n, 'item real respondido', 'itens reais respondidos') + '; ' : '') + 'a estimativa fica confiável perto de 100 itens reais (o simulado da semana ajuda)';
  return '<p class="pront-topo">' + txt + ' <button class="linkish pequeno" data-acao="mais" data-sub="progresso">detalhes</button></p>';
}
function renderHoje() {
  const ctx = contextoHoje();
  const d = diaLog();
  const h = hojeISO();
  const rt = roteiroHoje();
  const feitos = rt.passos.filter((p) => p.feito).length;
  const prox = rt.passos.find((p) => !p.feito) || cotaSemana().find((p) => !p.feito);
  let topo = '<div class="cartao destaque"><div class="heroi">' +
    '<div><div class="dia">' + esc(fmtData(h, { weekday: 'long' })) + '</div><div class="data">' + esc(fmtData(h, { day: '2-digit', month: 'long', year: 'numeric' })) +
    (ctx.tipo === 'dia' ? ' · ' + esc(ctx.dia.duracao) : '') + '</div></div>' + anel(d.r, metaDia()) + linhaProntidao() +
    '<p class="atividade">' + (ctx.tipo === 'dia' ? esc(ctx.dia.atividade) : ctx.tipo === 'folga' ? '<span class="mudo">Dia livre por padrão. Próxima sessão, ' + esc(fmtData(ctx.prox.data, { weekday: 'short', day: '2-digit', month: '2-digit' })) + ':</span> ' + esc(ctx.prox.atividade) : 'Cronograma concluído: recomece pelos blocos mais fracos e pelo conteúdo do edital.') + '</p>' +
    // O que fazer agora fica na primeira tela: o primeiro passo do roteiro ainda não feito, com o botão dele
    (prox ? '<div class="proximo"><span class="rotulo">' + (rt.passos.includes(prox) ? 'Próximo passo · ' + (rt.passos.indexOf(prox) + 1) + ' de ' + rt.passos.length : 'Roteiro de hoje feito · falta na semana') + '</span><b>' + esc(prox.titulo) + '</b><div class="linha-btns">' + prox.botoes + '</div></div>'
      : '<div class="proximo feito"><b>Roteiro de hoje completo.</b><span class="pequeno mudo">Se sobrar tempo, veja o Atraso do plano e a Jornada, mais abaixo.</span></div>') + '</div></div>';
  const aguard = ctx.tipo === 'dia' ? (ctx.dia.blocos || []).filter((b) => BI.get(b) && BI.get(b).aguardando && !(POR_BLOCO.get(b) || []).length) : [];
  if (aguard.length) topo += '<p class="nota-aguardando">' + esc(aguard.map(nomeBloco).join('; ')) + ': ainda sem questões. A sessão usa os blocos ligados ao tema. Cole o texto na conversa com o Claude para ganhar questões próprias.</p>';
  let roteiro = '<div class="cartao"><div class="secao-cab"><h2>Roteiro de hoje</h2><span class="mono pequeno mudo">' + feitos + ' de ' + rt.passos.length + '</span></div><div class="roteiro">';
  rt.passos.forEach((p, i) => {
    roteiro += '<div class="passo' + (p.feito ? ' feito' : '') + '"><div class="marca-passo">' + (p.feito ? '✓' : i + 1) + '</div><div class="corpo-passo"><b>' + esc(p.titulo) + '</b>' + (p.feito || !p.texto ? '' : '<p>' + esc(p.texto) + '</p>') + '<div class="linha-btns">' + p.botoes + (p.extra || '') + '</div></div></div>';
  });
  roteiro += '</div><p class="pequeno mudo">' + (stDoDia(rt.dia) ? 'Matéria nova: revisão do que venceu, pré-teste, lei, aula e questões do mesmo tema, nessa ordem; depois as intercaladas e as lacunas.' : 'A ordem é o método: revisão primeiro, depois questão, depois a lei onde você errou, depois a memorização com lacunas.') + ' <button class="linkish" data-acao="mais" data-sub="metodo">Entenda o método</button></p></div>';
  const modos = '<div class="secao"><div class="secao-cab"><h2>Modos de jogo</h2></div><div class="grade-modos">' +
    '<button class="modo" data-acao="abrir-modo" data-modo="simulado"><b>Simulado Cebraspe</b><span>Uma errada anula uma certa. Prova inteira ou só os seus blocos.</span><span class="num">' + pl(S.simulados.length, 'simulado feito', 'simulados feitos') + '</span></button>' +
    '<button class="modo" data-acao="relampago" data-blocos="' + P1.join(',') + '"><b>Relâmpago 90 s</b><span>Prioridade 1 contra o relógio.</span><span class="num">Recorde: ' + (S.perfil.recordes.relampago || 0) + '</span></button>' +
    '<button class="modo" data-acao="mais" data-sub="discursiva"><b>Discursiva</b><span>Limite de linhas e correção por quesitos.</span><span class="num">' + pl(TEMAS_DISC.length, 'tema', 'temas') + '</span></button>' +
    '<button class="modo" data-acao="abrir-modo" data-modo="treino"><b>Treino livre</b><span>Escolha os blocos; gabarito comentado a cada item.</span><span class="num">' + Q.length + ' questões</span></button></div></div>';
  // Duas contagens: o prazo legal do edital e a prova estimada (domingo cerca de três meses depois)
  const cr = D.cronograma, faltaEd = diaNum(cr.edital) - HOJE(), prova = dataProva(), oficial = !!(S.perfil.edital && S.perfil.edital.prova), faltaPr = diaNum(prova) - HOJE();
  const dataCurta = (iso) => fmtData(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const contagem = (n, txt) => '<div class="contagem">' + (n > 0 ? '<span class="grande">' + n + '</span>' : '') + '<span>' + txt + '</span></div>';
  const edital = '<div class="cartao">' +
    contagem(faltaEd, faltaEd > 0 ? 'dias até ' + dataCurta(cr.edital) + ', prazo legal máximo para o edital.' : faltaEd === 0 ? 'Hoje vence o prazo legal máximo para o edital (' + dataCurta(cr.edital) + ').' : 'O prazo legal do edital (' + dataCurta(cr.edital) + ') passou: acompanhe as notícias.') +
    contagem(faltaPr, faltaPr > 0 ? (oficial ? 'dias até a prova, ' + dataCurta(prova) + '.' : 'dias até a prova provável, domingo ' + dataCurta(prova) + ' (três meses depois do edital; troque pela data oficial em Ajustes → Edital e prova).') : faltaPr === 0 ? 'Hoje é o dia da prova. Boa prova!' : 'A data ' + (oficial ? '' : 'estimada ') + 'da prova (' + dataCurta(prova) + ') passou.') + '</div>';
  // Sessões guardadas que não têm botão próprio no roteiro (o dia, as intercaladas e a trilha de hoje já mostram Continuar)
  const fora = new Set(['i:' + h]);
  if (ctx.tipo === 'dia') fora.add(ctx.dia.data);
  // num dia de subtema, o roteiro tem botão só para o pré-teste; a prática guardada continua na lista
  const stH = subtemaDoDia(), diaSt = ctx.tipo === 'dia' && ctx.dia.modo === 'treino' && stDoDia(ctx.dia);
  if (stH) fora.add('t:' + stH.id + ':' + (diaSt || estadoSubtema(stH.id).novos ? 'pre' : 'pratica'));
  verificarRPG();
  const local = cartaoSoNoAparelho(), localTopo = local && backupAtrasado();
  document.getElementById('vista-hoje').innerHTML = topo + (localTopo ? local : '') + cartaoPausas(fora) + roteiro + cartaoSemana() + cartaoPendencias() + cartaoJornada() + cartaoTempo() + cartaoTaticoMentorando() + modos + edital + (localTopo ? '' : local) + '<p class="sync" id="sync"></p>';
  atualizarRodapeSync();
}
// Quando a conta não está disponível, o aviso não fica escondido no rodapé: sobe para o topo se o último backup tiver
// três dias ou mais (ou se nunca houve), com o motivo que o diagnóstico encontrou e os botões de backup
function marcarBackup() { S.perfil.backupEm = hojeISO(); Store.salvar('perfil'); if (UI.vista === 'hoje') renderHoje(); }
function backupAtrasado() { const u = S.perfil.backupEm; return !u || HOJE() - diaNum(u) >= 3; }
function cartaoSoNoAparelho() {
  if (Store.modo === 'nuvem' || Store.carregando) return '';
  const dg = Store.diag, u = S.perfil.backupEm, dias = u ? HOJE() - diaNum(u) : null;
  const motivo = !dg.claude ? 'o app foi aberto fora do claude.ai' : dg.db !== 'ok' ? 'o banco de dados do app não respondeu' : dg.user !== 'ok' || dg.id !== 'ok' ? 'a sua conta não foi identificada (confira se entrou no claude.ai)' : dg.leitura !== 'ok' ? 'a leitura da conta falhou' : 'a conta recusou a gravação';
  return '<div class="cartao aviso-local' + (backupAtrasado() ? ' destaque' : '') + '"><div class="secao-cab"><h2>Progresso só neste aparelho</h2></div>' +
    '<p>' + esc(inicial(motivo)) + '. ' + (u ? 'Último backup: ' + esc(fmtData(u, { day: '2-digit', month: '2-digit' })) + (dias ? ', há ' + pl(dias, 'dia', 'dias') : ', hoje') + '.' : 'Nenhum backup feito ainda.') + '</p>' +
    '<p class="pequeno mudo">No outro aparelho: Mais → Ajustes → Juntar (soma, não apaga).</p>' +
    '<div class="linha-btns"><button class="btn pequeno' + (backupAtrasado() ? ' primario' : '') + '" data-acao="backup-baixar">Baixar backup</button><button class="btn pequeno" data-acao="backup-copiar-hoje">Copiar texto</button><button class="btn pequeno" data-acao="tentar-gravar">Tentar a conta</button><button class="linkish pequeno" data-acao="mais" data-sub="ajustes">Diagnóstico</button></div></div>';
}
function atualizarRodapeSync() {
  const el = document.getElementById('sync');
  if (!el) return;
  if (Store.modo === 'nuvem') el.innerHTML = Store.erro ? 'Falha ao salvar na sua conta (' + esc(Store.erro) + '). O progresso continua guardado neste navegador. <button class="linkish" data-acao="mais" data-sub="ajustes">Diagnóstico e backup</button>' : 'Progresso salvo na sua conta e neste navegador.';
  else el.innerHTML = 'Progresso salvo só neste navegador. <button class="linkish" data-acao="mais" data-sub="ajustes">Ver diagnóstico e fazer backup</button>';
}
function iniciarDia(data) {
  const dia = DIAS.find((d) => d.data === data);
  if (!dia) return;
  if (retomarPausa(dia.data)) return;
  const titulo = fmtData(dia.data, { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' · ' + (dia.modo === 'revisao' ? 'Revisão' : dia.modo === 'simulado' ? 'Simulado' : 'Treino do dia');
  if (dia.modo === 'revisao') {
    if (!listaVencida().length && !manutencaoHoje().length) { iniciarSessao({ modo: 'treino', n: Math.min(dia.n, 20), blocos: blocosDaSemana(dia), filtro: 'mistas', titulo, dia: dia.data }); return; }
    iniciarSessao({ modo: 'revisao', n: dia.n, titulo, dia: dia.data });
    return;
  }
  if (dia.modo === 'simulado') {
    const n = nItensDoDia(dia);
    iniciarSessao({ modo: 'simulado', n, blocos: dia.blocos, prova: !dia.blocos.length, titulo, dia: dia.data, minutos: Math.round(n * 1.5) });
    return;
  }
  const st = stDoDia(dia);
  if (st) { iniciarSessao({ modo: 'treino', ids: idsDoSubtemaNoDia(st, dia.blocos, nItensDoDia(dia)), titulo: titulo + ' · ' + st.nome, dia: dia.data }); return; }
  iniciarSessao({ modo: 'treino', n: nItensDoDia(dia), blocos: dia.blocos, filtro: 'mistas', titulo, dia: dia.data });
}
function idsDoSubtemaNoDia(st, blocos, n) {
  const ids = idsSubtema(st.id, 'pratica', n), usados = new Set(ids);
  if (ids.length < n) for (const q of selecionar(poolDe(blocos).filter((q) => !usados.has(q.id) && !q.al), n - ids.length, 'mistas')) ids.push(q.id);
  return ids;
}
// Sessão de questões do dia: simulado e revisão com até 30 itens; no treino, o pré-teste que cabe nos 15 min do Passo 2
function nItensDoDia(dia) {
  if (dia.modo !== 'treino') return Math.min(dia.n, 30);
  return nPreTeste();
}

