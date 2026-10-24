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

