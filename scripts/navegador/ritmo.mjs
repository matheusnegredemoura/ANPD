// Metas pelo ritmo: com 7 dias de estudo nas duas últimas semanas (mediana de 110 itens), a meta automática é 100
// (90% da mediana, de 10 em 10); escolher uma meta fixa vale até voltar para o ritmo. Semanas de 5 mil XP e um dia
// de 3 mil XP destravam as conquistas de XP e ritmo.
import { APP, abrirNavegador, diaDeEstudo, placar, responder, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await diaDeEstudo(ctx);
await ctx.addInitScript(() => {
  if (sessionStorage.getItem('semeado')) return;
  sessionStorage.setItem('semeado', '1');
  const agora = new Date();
  const hoje = Math.round(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()) / 86400000);
  const iso = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
  const dias = {};
  [40, 79, 105, 110, 161, 168, 230].forEach((r, k) => { dias[iso(hoje - 1 - k)] = { r, c: Math.round(r * 0.8), e: r - Math.round(r * 0.8), b: 0, xp: k === 2 ? 3200 : 1500, k: 0, n: 0, a: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], t: { q: 3600 } }; });
  const perfil = { xp: 12000, meta: 20, novosCards: 5, intercaladas: 20, melhorSeq: 0, dias, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: iso(hoje - 20) };
  localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
});
const p = await ctx.newPage();
p.setDefaultTimeout(8000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(600);
const ajustes = async () => { await p.click('.aba[data-vista="mais"]'); await p.click('#vista-mais [data-acao="mais"][data-sub="ajustes"]'); };

await passo('meta automática pelo ritmo e meta fixa escolhida', async () => {
  await ajustes();
  const auto = p.locator('[data-acao="meta"][data-meta="auto"]');
  const txt = (await auto.textContent()).trim();
  if (!/Pelo meu ritmo · 100/.test(txt)) throw new Error('chip: ' + txt);
  conferir('o ritmo vale no lugar da meta 20 salva', (await auto.getAttribute('aria-pressed')) === 'true');
  await p.click('[data-acao="meta"][data-meta="60"]');
  conferir('meta fixa marcada', (await p.locator('[data-acao="meta"][data-meta="60"]').getAttribute('aria-pressed')) === 'true');
  const pf = await p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil);
  conferir('meta fixa gravada', pf.meta === 60 && pf.metaFixa === 1, JSON.stringify({ meta: pf.meta, fixa: pf.metaFixa }));
  await p.click('[data-acao="meta"][data-meta="auto"]');
  conferir('volta ao ritmo', (await p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.metaFixa)) === 0);
});

await passo('missões do dia acompanham o ritmo', async () => {
  await p.click('.aba[data-vista="hoje"]');
  const t = await p.locator('.missao b').allTextContents();
  const fixas = t.filter((x) => /^(Responder 30 itens|Responder 60 itens|Ler 5 artigos)/.test(x));
  if (fixas.length) throw new Error('missão com meta fixa antiga: ' + fixas.join(' | '));
  const r = t.find((x) => /^Responder \d+ itens$/.test(x));
  if (r && !/^Responder (100|150) itens$/.test(r)) throw new Error('missão de itens fora do ritmo: ' + r);
});

await passo('um item respondido destrava as conquistas de XP e ritmo que os números permitem', async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="comecar"]');
  await p.waitForSelector('#sessao:not([hidden])');
  await responder(p);
  await p.waitForTimeout(500);
  const conq = await p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.conq);
  const faltam = ['sem5k', 'dia3k', 'maratona200'].filter((id) => !conq[id]);
  if (faltam.length) throw new Error('não destravadas: ' + faltam.join(', '));
  const indevidas = ['sem15k', 'dia5k', 'semanas4', 'xp25k'].filter((id) => conq[id]);
  if (indevidas.length) throw new Error('destravadas sem os números: ' + indevidas.join(', '));
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await browser.close();
fim(erros);
