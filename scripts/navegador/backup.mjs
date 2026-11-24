// Progresso só no navegador e backup:
// - sem a conta, o aviso "Progresso só neste aparelho" vem no topo enquanto não houver backup recente;
// - restaurar com Juntar soma o backup ao que já está no aparelho (respostas, XP, contestações), sem apagar nada;
// - copiar o backup registra a data, e o aviso desce para o fim da página.
import { APP, abrirNavegador, placar, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];

const DIA = Math.round(Date.UTC(2026, 9, 6) / 86400000);
function perfil(o) { return Object.assign({ xp: 0, meta: 30, novosCards: 20, intercaladas: 30, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: '2026-09-01' }, o); }

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
await ctx.addInitScript(({ local }) => {
  if (sessionStorage.getItem('semeado')) return;
  sessionStorage.setItem('semeado', '1');
  localStorage.clear();
  localStorage.setItem('painel-anpd-v3', JSON.stringify(local));
}, { local: { perfil: perfil({ xp: 200 }), itens: { 'lgpd-17-01': [1, DIA + 1, 1, 0, DIA - 1, 0, 0] }, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} } });
const p = await ctx.newPage();
p.setDefaultTimeout(5000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(600);

await passo('sem a conta e sem backup, o aviso vem no topo', async () => {
  const cartoes = await p.locator('#vista-hoje > .cartao').evaluateAll((els) => els.map((e) => e.className + '|' + (e.querySelector('h2') || {}).textContent));
  const i = cartoes.findIndex((c) => /aviso-local/.test(c));
  if (i < 0) throw new Error('aviso ausente: ' + cartoes.join(' / '));
  if (i > 1) throw new Error('aviso fora do topo (posição ' + i + ')');
});

await passo('Juntar soma o backup ao progresso do aparelho', async () => {
  const backup = { app: 'painel-anpd', versao: 3, exportado: '2026-10-08T22:30:00.000Z', perfil: perfil({ xp: 500, meta: 20 }),
    itens: { 'lgpd-21-01': [2, DIA + 3, 2, 0, DIA - 2, 0, 0], 'lgpd-17-01': [0, DIA - 3, 0, 1, DIA - 4, 0, 0] }, cards: {}, simulados: [], pesquisa: {}, disc: {},
    contestacoes: [{ q: 'lgpd-21-01', motivo: 'outro', texto: 'teste', data: '2026-10-07T10:00:00.000Z', versao: '2026-10-07', status: 'pendente', resposta: '' }] };
  await p.click('[data-acao="mais"][data-sub="ajustes"]');
  await p.fill('#texto-backup', JSON.stringify(backup));
  await p.click('[data-acao="backup-colado"]');
  await p.click('[data-acao="backup-juntar"]');
  await p.waitForTimeout(300);
  const d = await p.evaluate(() => ({ s: JSON.parse(localStorage.getItem('painel-anpd-v3')), c: JSON.parse(localStorage.getItem('painel-anpd-contestacoes') || '[]') }));
  const ids = Object.keys(d.s.itens);
  if (!ids.includes('lgpd-21-01') || !ids.includes('lgpd-17-01')) throw new Error('itens: ' + ids.join(','));
  // O registro mais recente do item fica: o do aparelho (último dia DIA - 1) e não o do backup (DIA - 4)
  if (d.s.itens['lgpd-17-01'][4] !== DIA - 1) throw new Error('registro do item trocado pelo mais antigo');
  if (d.s.perfil.xp !== 500) throw new Error('XP: ' + d.s.perfil.xp);
  if (!d.c.some((c) => c.q === 'lgpd-21-01')) throw new Error('contestação do backup não entrou');
});

await passo('copiar o backup registra a data e o aviso desce', async () => {
  await p.click('.aba[data-vista="hoje"]');
  await p.click('[data-acao="backup-copiar-hoje"]');
  await p.click('#folha [data-acao="copiar"]');
  await p.waitForTimeout(300);
  const em = await p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.backupEm);
  if (!em) throw new Error('data do backup não registrada');
  await p.click('[data-acao="fechar-folha"]');
  const cartoes = await p.locator('#vista-hoje > .cartao').evaluateAll((els) => els.map((e) => e.className));
  const i = cartoes.findIndex((c) => /aviso-local/.test(c));
  if (i < cartoes.length - 2) throw new Error('aviso continua no topo (posição ' + i + ' de ' + cartoes.length + ')');
});

await browser.close();
conferir('sem erro de página', !erros.length, erros.join(' | '));
fim();
