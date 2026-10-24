/* ================= Investigar e correção com o Claude ================= */
// A página pergunta ao Claude pela conta de quem estuda (capacidade "sample"): gasta o uso dessa conta, e a primeira
// pergunta de cada abertura pede permissão. Sem a capacidade (arquivo aberto fora do claude.ai, permissão negada), os
// botões de IA somem e fica o caminho manual: copiar o pedido e colar numa conversa com o Claude.
let IA = null, iaNegada = false;
if (window.claude && window.claude.use) window.claude.use('sample').then((x) => { IA = x; atualizarAcoesInv(); }).catch(() => { IA = null; });
function iaPronta() { return !!IA && !iaNegada; }
const MSG_IA = {
  not_granted: 'Sem permissão para usar o Claude nesta página. Dá para liberar no menu de permissões do artifact; enquanto isso, use Copiar.',
  sampling_disabled: 'O Claude não está disponível para esta conta. Use Copiar e cole numa conversa.',
  rate_limited: 'Muitas perguntas seguidas ou limite de uso da conta. Tente daqui a pouco.',
  session_expired: 'A sessão do claude.ai expirou: entre de novo.',
  refused: 'O Claude não respondeu a este pedido. Reformule e tente de novo.',
  empty_completion: 'Veio uma resposta vazia. Tente de novo.',
  invalid_json: 'A correção veio num formato inesperado. Tente de novo.',
  prompt_too_large: 'Texto longo demais para enviar de uma vez.',
};
function erroIA(e) {
  const c = (e && e.code) || 'upstream_error';
  if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(c)) iaNegada = true;
  return MSG_IA[c] || 'Falha de conexão com o Claude. Tente de novo.';
}
async function copiarTexto(txt) {
  try { await navigator.clipboard.writeText(txt); return true; } catch (e) { return false; }
}
// Investigar: em vez de mandar para uma busca, o painel faz perguntas que obrigam a construir a resposta, e o Claude
// confere o que foi escrito, corrige com base na norma e devolve uma pergunta para ir mais fundo.
// O tema já está no título da folha; as perguntas não o repetem, porque muitos temas são frases longas
const PERGUNTAS_GUIA = [
  'Explique o tema com suas palavras, em duas ou três frases, como se ensinasse um colega.',
  'Onde ele aparece na norma? Ache o artigo e leia o dispositivo inteiro: há exceção, prazo ou condição logo ao lado?',
  'Com que conceito vizinho a banca costuma trocá-lo? Qual diferença decide o item?',
  'Monte um caso concreto, de preferência da atuação da ANPD, em que ele muda o resultado.',
];
function glossDe(t) { return GLOSS.find((g) => g.t === t) || GLOSS.find((g) => g.re.test(t)) || null; }
function regrasInv(inv) {
  const g = glossDe(inv.t);
  return 'Você é tutor de quem estuda para o concurso de Especialista em Regulação de Proteção de Dados da ANPD (banca Cebraspe, itens certo ou errado). ' +
    'O estudante está investigando o tema “' + inv.t + '”' + (inv.o ? ' (veio de: ' + inv.o + ')' : '') + '. ' +
    (g ? 'Definição curta que o painel dele traz, possivelmente incompleta: ' + g.d + ' ' : '') +
    'Ele respondeu a estas perguntas-guia: ' + PERGUNTAS_GUIA.join(' ') + '\n\n' +
    'Regras da sua resposta: português do Brasil; texto corrido e curto, até 170 palavras, sem títulos; primeiro diga o que está certo, depois corrija o que está errado ou impreciso e diga o que faltou; ' +
    'quando depender de norma brasileira (LGPD, resoluções da ANPD, outras leis), cite o artigo, e se não tiver certeza do número diga que é preciso conferir na lei em vez de inventar; ' +
    'aponte a armadilha típica do Cebraspe sobre o tema quando houver (palavra trocada, exceção omitida, sujeito trocado); ' +
    'não entregue tudo de uma vez: termine com UMA pergunta curta que leve o estudante ao próximo passo. A conversa vem a seguir.';
}
function conversaInv() {
  const inv = UI.inv;
  if (!inv || !inv.turnos.length) return '';
  const ult = inv.turnos.length - 1;
  return '<div class="inv-conversa">' + inv.turnos.map((x, i) => '<div class="inv-msg ' + (x.role === 'user' ? 'voce' : 'ia') + '"><span class="rotulo">' + (x.role === 'user' ? 'Você' : 'Claude') + '</span><p' + (i === ult && x.role === 'assistant' ? ' id="inv-ultima"' : '') + '>' + esc(x.content) + '</p></div>').join('') + '</div>';
}
function acoesInv() {
  const inv = UI.inv;
  if (inv && inv.ctl) return '<button class="btn" data-acao="inv-parar">Parar</button>';
  return (iaPronta() ? '<button class="btn primario" data-acao="inv-conferir">' + (inv && inv.turnos.length ? 'Responder ao Claude' : 'Conferir com o Claude') + '</button>' : '') +
    '<button class="btn" data-acao="inv-copiar">Copiar para perguntar à IA</button>';
}
function atualizarAcoesInv() { const el = document.getElementById('inv-acoes'); if (el) el.innerHTML = acoesInv(); }
function folhaInvestigar(t, origem) {
  const k = chavePesq(t), p = S.pesquisa[k], g = glossDe(t);
  if (!UI.inv || UI.inv.k !== k) UI.inv = { t, k, o: origem || (p && p.o) || '', turnos: [], rascunho: '' };
  const inv = UI.inv;
  let html = cabFolha('Investigar', t) +
    '<p class="pequeno mudo">Responda antes de ler qualquer coisa: tentar lembrar e explicar fixa mais do que ler a resposta pronta.</p>' +
    '<ol class="lista-cb">' + PERGUNTAS_GUIA.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>' +
    '<div id="inv-conversa">' + conversaInv() + '</div>' +
    '<label class="rotulo" for="inv-texto">' + (inv.turnos.length ? 'Sua resposta à pergunta do Claude' : 'Sua resposta') + '</label>' +
    '<textarea id="inv-texto" class="area-texto" rows="6" placeholder="Escreva o que você sabe, mesmo incompleto.">' + esc(inv.rascunho || (!inv.turnos.length && p && p.r) || '') + '</textarea>' +
    '<p class="pequeno mudo" id="inv-nota"></p><div class="linha-btns" id="inv-acoes">' + acoesInv() + '</div>';
  if (g) html += '<details class="inv-def"><summary>Conferir a definição curta do glossário</summary><p>' + esc(g.d) + '</p></details>';
  html += '<div class="linha-btns">' + (!p ? '<button class="btn" data-acao="add-pesq" data-t="' + esc(t) + '" data-o="' + esc(inv.o || 'investigar') + '">Guardar na lista</button>' : p.s ? '<span class="selo ok">Entendido</span>' : '<button class="btn" data-acao="inv-entendi" data-k="' + esc(k) + '">Entendi: marcar como entendido (+5 XP)</button>') + '</div>';
  abrirFolha(html, 'Investigar ' + t);
}
async function conferirInv() {
  const inv = UI.inv, box = document.getElementById('inv-texto');
  if (!inv || inv.ctl || !box || !iaPronta()) return;
  const txt = box.value.trim();
  if (!txt) { avisar('!', 'Escreva primeiro', 'A conferência só funciona sobre o que você escreveu.'); return; }
  if (!inv.turnos.length) { addPesquisa(inv.t, inv.o || 'investigar', true); const p = S.pesquisa[inv.k]; if (p) { p.r = txt.slice(0, 2000); Store.salvar('pesquisa'); } }
  inv.turnos.push({ role: 'user', content: txt }, { role: 'assistant', content: 'Pensando…' });
  inv.rascunho = '';
  inv.ctl = new AbortController();
  folhaInvestigar(inv.t, inv.o);
  // O Claude não guarda nada entre chamadas: vão as regras e as últimas trocas, começando por uma fala do estudante
  const turnos = inv.turnos.slice(0, -1).slice(-9);
  if (turnos[0].role !== 'user') turnos.shift();
  const resposta = inv.turnos[inv.turnos.length - 1];
  try {
    const r = await IA([{ role: 'user', content: regrasInv(inv) }].concat(turnos), {
      cache: false, signal: inv.ctl.signal,
      onText: ({ text }) => { resposta.content = text; const el = document.getElementById('inv-ultima'); if (el) el.textContent = text; },
    });
    resposta.content = r.text + (r.truncated ? ' […]' : '');
    // Explicar com as próprias palavras vale XP (uma vez por tema e conversa): o incentivo é pensar, não responder rápido
    if (!inv.xp && txt.length >= 80) { inv.xp = 1; ganharXP(5); S.perfil.recordes.ex = (S.perfil.recordes.ex || 0) + 1; verificarConquistas(); Store.salvar('perfil'); avisar('✎', '+5 XP', 'Por explicar com suas palavras.'); }
  } catch (e) {
    if (e && e.text) resposta.content = e.text + ' […]';
    else { inv.turnos.splice(-2, 2); inv.rascunho = txt; }
    if (!e || e.code !== 'cancelled') avisar('!', 'Claude indisponível', erroIA(e));
  }
  inv.ctl = null;
  // Só redesenha se a folha aberta ainda for esta investigação (pode ter sido fechada ou trocada por outra folha)
  if (UI.inv === inv && document.getElementById('inv-conversa')) folhaInvestigar(inv.t, inv.o);
}
async function copiarInv() {
  const inv = UI.inv, box = document.getElementById('inv-texto');
  if (!inv) return;
  const txt = (box && box.value.trim()) || (S.pesquisa[inv.k] && S.pesquisa[inv.k].r) || '';
  const pedido = regrasInv(inv) + '\n\nMinha resposta: ' + (txt || '(ainda não escrevi; faça as perguntas uma de cada vez)');
  const nota = document.getElementById('inv-nota');
  if (await copiarTexto(pedido)) { if (nota) nota.textContent = 'Pedido copiado: cole numa conversa com o Claude.'; return; }
  if (box) { box.value = pedido; box.select(); }
  if (nota) nota.textContent = 'Não deu para copiar sozinho: o pedido está selecionado no campo acima; copie e cole numa conversa.';
}
// Correção da discursiva: o Claude lê o texto com os quesitos, o padrão de resposta e a escala de conceitos e sugere o
// conceito de cada quesito e os erros de português. A pessoa revê e decide antes de salvar.
function pedidoDiscIA(t, texto) {
  return 'Corrija esta resposta discursiva como a banca Cebraspe corrige, com rigor e sem generosidade. O conceito máximo de cada quesito exige explicar, não só citar; o que passar de ' + t.linhas + ' linhas não conta.\n\n' +
    'Tema: ' + t.titulo + '\nComando: ' + t.comando + '\n' + t.aspectos.map((a, i) => (i + 1) + ') ' + a).join('\n') + '\n\n' +
    t.quesitos.map((q, i) => 'Quesito ' + (i + 1) + ' — ' + q.titulo + ' (0 a ' + q.max + ')\nPadrão de resposta:\n' + q.esperado.map((e) => '- ' + e).join('\n') + '\nConceitos:\n' + q.conceitos.map((c, k) => k + ' = ' + c).join('\n')).join('\n\n') +
    '\n\nConte também os erros de português (grafia, acentuação, pontuação, concordância, regência, crase), como o Cebraspe desconta.\n\n' +
    'Texto do candidato:\n"""\n' + texto.slice(0, 6000) + '\n"""\n\n' +
    'Responda só com JSON neste formato: {"quesitos":[{"conceito":2,"porque":"uma ou duas frases: o que garantiu o conceito e o que faltou"}],"erros":3,"exemplos":["trecho errado → forma correta"],"geral":"duas frases com o que mais rende melhorar"}. ' +
    'O array quesitos tem exatamente ' + t.quesitos.length + ' objetos, na ordem dos quesitos; exemplos tem no máximo 5.';
}
async function corrigirDiscIA() {
  const t = TEMAS_DISC.find((x) => x.id === UI.discTema);
  const texto = t && estadoDisc(t.id).rascunho.trim();
  if (!t || !texto || !iaPronta() || UI.discIACarregando) return;
  UI.discIACarregando = true;
  renderMais();
  try {
    const r = await IA.json(pedidoDiscIA(t, texto));
    // Se a pessoa trocou de tema ou voltou a editar enquanto o Claude lia, a correção não vale mais
    if (UI.discTema !== t.id || UI.discFase === 'escrita') { UI.discIACarregando = false; return; }
    const qs = Array.isArray(r && r.quesitos) ? r.quesitos : [];
    if (qs.length !== t.quesitos.length) throw { code: 'invalid_json' };
    const aval = {};
    t.quesitos.forEach((q, i) => { aval[i] = Math.max(0, Math.min(q.max, Math.round(Number(qs[i] && qs[i].conceito) || 0))); });
    UI.discAval = aval;
    UI.discNE = Math.max(0, Math.round(Number(r.erros) || 0));
    UI.discIA = { porque: qs.map((x) => String((x && x.porque) || '')), exemplos: (Array.isArray(r.exemplos) ? r.exemplos : []).slice(0, 5).map(String), geral: String(r.geral || '') };
  } catch (e) {
    avisar('!', 'Correção indisponível', erroIA(e));
  }
  UI.discIACarregando = false;
  if (UI.vista === 'mais') renderMais();
}
function folhaTermo(i) {
  const g = GLOSS[i];
  if (!g) return;
  const naLista = !!S.pesquisa[chavePesq(g.t)];
  const rel = Q.filter((q) => g.re.test(q.e + ' ' + q.c));
  abrirFolha(cabFolha('Glossário', g.t) + '<p>' + esc(g.d) + '</p>' +
    '<div class="linha-btns"><button class="btn primario" data-acao="investigar" data-t="' + esc(g.t) + '" data-o="glossário">Investigar</button>' +
    (naLista ? '<span class="selo ok">Na sua lista</span>' : '<button class="btn" data-acao="add-pesq" data-t="' + esc(g.t) + '" data-o="glossário">Guardar na lista</button>') + '</div>' +
    (rel.length ? '<div class="linha-btns"><button class="btn" data-acao="treinar-termo" data-t="' + i + '">Treinar ' + pl(rel.length, 'questão', 'questões') + ' com este termo</button></div>' : ''), g.t);
}

