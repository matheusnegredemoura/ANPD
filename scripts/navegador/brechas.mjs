// Brechas fechadas (pistas da análise de 25/10):
// - acerto repetido no mesmo dia, pelo treino "só as que já errei", vale 1 XP, não o XP cheio;
// - desmarcar e remarcar uma meta do checklist semanal não paga os 15 XP de novo;
// - chefão que surge na quinta vem com a vida dos dias que restam (1200), e não fica invencível com o teto diário;
// - "Substituir tudo" do backup pede confirmação antes de apagar o progresso da conta;
// - números do edital vindos de um backup não entram crus no HTML;
// - card "Difícil" com 1 dia de intervalo passa a 2 dias, em vez de ficar preso em 1.
import { APP, abrirNavegador, placar, vigiarErros } from './comum.mjs';
import { montarDados } from '../build.mjs';

const browser = await abrirNavegador();
const { passo, fim } = placar();
const erros = [];
const d = montarDados();
const q = d.questoes.find((x) => x.l === 'lgpd' && !x.al && !x.o && (x.g === 'C' || x.g === 'E'));
const nota = d.cloze[0], card = { id: nota.id + '.1', b: nota.b };
const salvo = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')));

// Segunda-feira às 10h, a próxima a partir de hoje: o chefão nasce com a vida cheia
const seg = new Date(); seg.setHours(10, 0, 0, 0); seg.setDate(seg.getDate() + ((8 - seg.getDay()) % 7 || 7));
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.clock.install({ time: seg });
await ctx.addInitScript(({ id, cid }) => {
  if (sessionStorage.getItem('semeado')) return;
  sessionStorage.setItem('semeado', '1');
  const agora = new Date(), hoje = Math.round(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()) / 86400000);
  // Item já respondido hoje (errado uma vez antes, acertado hoje) e card com 1 dia de intervalo vencido hoje
  const itens = { [id]: [3, hoje + 7, 1, 1, hoje, 0, 0, 0] };
  const cards = { [cid]: [hoje, 1, 250, 2, 0, hoje - 1] };
  localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil: { xp: 1000, dias: {}, conq: {}, feitos: {}, status: {} }, itens, cards, simulados: [], pesquisa: {}, disc: {}, t: {} }));
}, { id: q.id, cid: card.id });
const p = await ctx.newPage();
p.setDefaultTimeout(5000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(400);

await passo('acerto repetido no mesmo dia vale 1 XP', async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="set-modo"][data-modo="treino"]');
  await p.click('[data-acao="set-filtro"][data-filtro="erradas"]');
  await p.click('[data-acao="comecar"]');
  await p.waitForSelector('#sessao:not([hidden])');
  if ((await p.textContent('.item-num')).trim() !== q.id) throw new Error('item: ' + (await p.textContent('.item-num')));
  const xp0 = (await salvo(p)).perfil.xp;
  await p.click(q.g === 'C' ? '.bolha.c' : '.bolha.e');
  await p.waitForSelector('.veredito.ok');
  const ganho = (await salvo(p)).perfil.xp - xp0;
  if (ganho !== 1) throw new Error('XP ganho: ' + ganho);
  await p.keyboard.press('Escape');
  await p.waitForSelector('#sessao', { state: 'hidden' });
});

await passo('remarcar meta do checklist não paga de novo', async () => {
  await p.click('.aba[data-vista="mais"]');
  await p.click('#vista-mais [data-acao="mais"][data-sub="metodo"]');
  const chk = '[data-acao="anpd-check-sem"][data-i="2"]';
  const xp0 = (await salvo(p)).perfil.xp;
  await p.check(chk); await p.uncheck(chk); await p.check(chk);
  const ganho = (await salvo(p)).perfil.xp - xp0;
  if (ganho !== 15) throw new Error('XP ganho: ' + ganho);
});

await passo('card Difícil com 1 dia sobe para 2', async () => {
  await p.click('.aba[data-vista="cards"]');
  for (const el of await p.locator('#vista-cards input[data-acao="toggle-bloco-card"]:checked').all()) await el.click();
  await p.click('#vista-cards input[data-bloco="' + card.b + '"]');
  await p.click('[data-acao="cards-so-revisao"]');
  await p.waitForSelector('#sessao:not([hidden]) .card-cloze');
  await p.click('[data-acao="revelar"]');
  await p.click('[data-acao="avaliar"][data-n="2"]');
  const c = (await salvo(p)).cards[card.id];
  if (!c || c[1] !== 2) throw new Error('intervalo: ' + (c && c[1]));
  await p.keyboard.press('Escape');
  await p.waitForSelector('#sessao', { state: 'hidden' });
});

await passo('Substituir tudo pede confirmação; edital de backup vira número', async () => {
  await p.click('.aba[data-vista="mais"]');
  await p.click('#vista-mais [data-acao="mais"][data-sub="ajustes"]');
  const b = await salvo(p);
  const backup = { app: 'painel-anpd', versao: 3, exportado: '2026-10-20T10:00:00.000Z', itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {},
    perfil: Object.assign({}, b.perfil, { xp: 7, edital: { basica: { linguas: '<img src=x onerror="window.__xss=1">', inventada: 5 }, especifica: { lgpd: 40 }, pesoB: 1, pesoE: 1, cortes: { p1: '<b>x</b>' } } }) };
  await p.fill('#texto-backup', JSON.stringify(backup));
  await p.click('[data-acao="backup-colado"]');
  await p.click('[data-acao="backup-substituir"]');
  if ((await salvo(p)).perfil.xp === 7) throw new Error('substituiu no primeiro clique');
  await p.click('[data-acao="backup-confirmar"]');
  await p.waitForTimeout(200);
  if ((await salvo(p)).perfil.xp !== 7) throw new Error('não substituiu depois de confirmar');
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="set-modo"][data-modo="simulado"]').catch(() => {});
  await p.waitForTimeout(200);
  if (await p.evaluate(() => window.__xss || document.querySelector('img[src="x"]'))) throw new Error('HTML do backup entrou na página');
});

// Quinta-feira: chefão novo com 4 dias pela frente
const qui = new Date(seg.getTime() + 3 * 864e5);
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx2.clock.install({ time: qui });
const p2 = await ctx2.newPage();
p2.setDefaultTimeout(5000);
vigiarErros(p2, erros);
await p2.goto(APP);
await p2.waitForTimeout(400);
await passo('chefão que surge na quinta tem 1200 de vida', async () => {
  const v = (await p2.textContent('.chefe .chefe-cab .mono')).trim();
  if (v !== 'HP 1200/1200') throw new Error(v);
});

await browser.close();
fim(erros);
