/* ================= Backup ================= */
let backupPendente = null;
function backupTexto() {
  return JSON.stringify({ app: 'painel-anpd', versao: 3, exportado: new Date().toISOString(), perfil: S.perfil, itens: S.itens, cards: S.cards, simulados: S.simulados, pesquisa: S.pesquisa, disc: S.disc, contestacoes: CONTEST });
}
async function salvarArquivo(nome, conteudo) {
  let dl = null;
  try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({ filename: nome, data: conteudo }); avisar('↓', 'Arquivo pronto', nome); return true; }
    catch (e) { if (e && e.code === 'declined') return false; }
  }
  if (window.claude) return null;
  // Arquivo aberto do disco (fora do claude.ai): o navegador baixa por um link comum
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([conteudo], { type: 'application/json;charset=utf-8' }));
    a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    avisar('↓', 'Arquivo pronto', nome);
    return true;
  } catch (e) { return null; }
}
function mostrarTexto(destino, conteudo, rotulo) {
  const el = destino ? document.getElementById(destino) : null;
  const html = '<p class="pequeno">' + esc(rotulo) + '</p><textarea class="area-texto" id="texto-export" readonly>' + esc(conteudo) + '</textarea><div class="linha-btns"><button class="btn pequeno" data-acao="copiar">Copiar</button></div>';
  if (el) el.innerHTML = html; else abrirFolha(cabFolha('Exportar', 'Texto') + html, 'Exportar');
}
function restaurar(texto) {
  let d;
  try { d = JSON.parse(String(texto).trim()); } catch (e) { avisar('!', 'Backup inválido', 'Não é um backup do Painel ANPD (confira se o texto foi copiado inteiro).'); return; }
  if (!d || d.app !== 'painel-anpd' || !d.perfil) { avisar('!', 'Backup inválido', 'Não é um backup do Painel ANPD.'); return; }
  backupPendente = d;
  const z = document.getElementById('zona-backup');
  const resumo = 'Backup de ' + esc(fmtData(String(d.exportado).slice(0, 10), { day: '2-digit', month: '2-digit', year: 'numeric' })) + ': ' + fmtNum(d.perfil.xp || 0) + ' XP, ' + pl(Object.keys(d.itens || {}).length, 'questão', 'questões') + ' e ' + pl(Object.keys(d.cards || {}).length, 'card', 'cards') + ' com histórico.';
  if (z) z.innerHTML = '<div class="cartao destaque"><p>' + resumo + '</p><p class="pequeno mudo">Juntar soma o backup ao que já está neste aparelho: nenhuma resposta, card ou dia de estudo se perde, e em cada item fica o registro mais recente. Substituir apaga o progresso deste aparelho e põe o do backup no lugar.</p><div class="linha-btns"><button class="btn primario" data-acao="backup-juntar">Juntar com este aparelho</button><button class="btn" data-acao="backup-confirmar">Substituir tudo</button><button class="btn" data-acao="mais" data-sub="ajustes">Cancelar</button></div></div>';
}

/* ================= Navegação ================= */
const VISTAS = ['hoje', 'questoes', 'cards', 'lei', 'mais'];
// Posição da página em cada aba: voltar pela barra de abas devolve a pessoa ao ponto em que estava (no meio da lei seca, por exemplo)
const ROLAGEM = {};
function ir(v, rolar = 0) {
  if (!VISTAS.includes(v)) v = 'hoje';
  if (v !== 'lei') pararFala();
  UI.vista = v;
  salvarUI();
  renderTudo();
  window.scrollTo(0, rolar);
}
function renderTudo() {
  aplicarEdital(S.perfil.edital);
  document.documentElement.classList.toggle('lei-teste', !!UI.camadas.teste);
  UI.artInline = null;
  renderTopo();
  VISTAS.forEach((v) => { document.getElementById('vista-' + v).hidden = v !== UI.vista; });
  document.querySelectorAll('.aba').forEach((b) => { if (b.dataset.vista === UI.vista) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  ({ hoje: renderHoje, questoes: renderQuestoes, cards: renderCards, lei: renderLei, mais: renderMais })[UI.vista]();
  const disc = document.getElementById('disc-texto');
  if (disc && disc.offsetParent) crescerDisc(disc);
  if (sessao) renderSessao();
}
// Monitor: os blocos de cada tela vão para colunas montadas aqui (alvenaria). Cada bloco entra na coluna mais baixa no
// momento do desenho e fica nela até o próximo: abrir um <details> só empurra os de baixo, sem trocar ninguém de coluna
// (o que as colunas de jornal faziam), e um bloco longo, como o roteiro do dia, não deixa vazio embaixo dos curtos (o
// que a grade fazia, porque a linha da grade tem a altura do bloco mais alto). Cabeçalho, voltar, menu e a linha de
// sincronização ocupam a largura toda. Toda tela é redesenhada por inteiro (innerHTML), e o observador remonta.
const TELA_LARGA = window.matchMedia('(min-width:1200px)');
const COLUNA_MIN = { hoje: 460, questoes: 460, cards: 460, mais: 540, lei: 540 };
const largaToda = (c) => c.matches('.secao-cab,.voltar,.menu-mais,.sync');
function alvenaria(v) {
  const el = document.getElementById('vista-' + v);
  if (!el || el.hidden) return;
  const n = TELA_LARGA.matches && !el.matches('.com-folha,.com-artigo') ? Math.max(1, Math.floor((el.clientWidth + 24) / (COLUNA_MIN[v] + 24))) : 1;
  const montada = el.querySelector(':scope > .colunas'), soltos = [...el.children].some((c) => !c.matches('.colunas') && !largaToda(c));
  // Nada a refazer (cada troca de filhos chama o observador de novo; sem esta saída, ele não pararia)
  if (montada ? !soltos && Number(montada.dataset.n) === n : !soltos || n === 1) return;
  // De volta à ordem do desenho
  const blocos = [];
  for (const c of [...el.children]) blocos.push(...(c.matches('.colunas') ? [...c.querySelectorAll(':scope > .coluna > *')].sort((a, b) => a.dataset.alv - b.dataset.alv) : [c]));
  if (n === 1) { if (montada) el.replaceChildren(...blocos); return; }
  const filhos = [], grupos = new Map();
  let g = null;
  blocos.forEach((c, i) => {
    if (largaToda(c)) { g = null; filhos.push(c); return; }
    c.dataset.alv = i;
    if (!g) {
      g = document.createElement('div');
      g.className = 'colunas'; g.dataset.n = n; g.style.setProperty('--ncol', n);
      for (let k = 0; k < n; k++) g.appendChild(Object.assign(document.createElement('div'), { className: 'coluna' }));
      filhos.push(g); grupos.set(g, []);
    }
    grupos.get(g).push(c);
  });
  el.replaceChildren(...filhos);
  for (const [grupo, lista] of grupos) {
    const cols = [...grupo.children];
    if (!emOrdem(v)) { for (const c of lista) cols.reduce((a, b) => (b.offsetHeight < a.offsetHeight ? b : a)).appendChild(c); continue; }
    // Na lei e no glossário, a ordem (dos capítulos, alfabética) vale mais que o encaixe: as colunas se enchem em sequência (de cima para baixo e
    // da esquerda para a direita), com alturas parecidas; cada bloco vai para a coluna em que cai o meio dele
    cols[0].append(...lista);
    const alt = lista.map((c) => c.offsetHeight + 18), tot = alt.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    lista.forEach((c, i) => { cols[Math.min(n - 1, Math.floor(((acc + alt[i] / 2) / tot) * n))].appendChild(c); acc += alt[i]; });
  }
}
const emOrdem = (v) => v === 'lei' || (v === 'mais' && UI.mais === 'glossario');
for (const v of VISTAS) { const el = document.getElementById('vista-' + v); if (el) new MutationObserver(() => alvenaria(v)).observe(el, { childList: true }); }
let alvenariaTimer = null;
window.addEventListener('resize', () => { clearTimeout(alvenariaTimer); alvenariaTimer = setTimeout(() => alvenaria(UI.vista), 150); });
// Página do subtema já na parte pedida: na lei, abre o primeiro artigo ainda não lido; na aula do dia, dá baixa no passo
function abrirSubtemaEm(id, parte) {
  if (!SUBTEMAS.get(id)) return;
  fecharFolha();
  UI.subtema = id;
  UI.mais = 'trilha';
  if (UI.vista !== 'mais') ir('mais'); else renderMais();
  const el = document.getElementById(parte + '-' + id);
  if (el) el.scrollIntoView({ block: 'start' });
  if (parte === 'aula') {
    const dia = DIAS.find((d) => d.data === hojeISO());
    if (dia && dia.st === id && !S.perfil.feitos['aula:' + dia.data]) { S.perfil.feitos['aula:' + dia.data] = 1; Store.salvar('perfil'); }
    return;
  }
  const lidos = S.perfil.lidos || {}, chips = [...document.querySelectorAll('#lei-' + id + ' .chip[data-acao="art-inline"]')];
  const c = chips.find((b) => !lidos[b.dataset.art]) || chips[0];
  if (c) abrirArtInline(c);
}
function abrirArtigo(art, fila) {
  if (!ARTI.get(art)) return;
  UI.artSel = art;
  UI.lei = ARTI.get(art).lei;
  if (fila !== undefined) UI.leiFila = fila;
  if (UI.vista !== 'lei') ir('lei'); else { renderLei(); window.scrollTo(0, 0); }
  try { marcarLido(art); } catch (e) { registrarErro('marcar o artigo como lido', e); }
}

