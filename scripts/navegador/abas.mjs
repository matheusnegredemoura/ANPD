// Duas abas do painel abertas: o que uma grava no navegador não é apagado quando a outra grava depois
import { APP, abrirNavegador, diaDeEstudo, placar, vigiarErros } from './comum.mjs';

const b = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await diaDeEstudo(ctx);
const abrir = async () => { const p = await ctx.newPage(); p.setDefaultTimeout(8000); vigiarErros(p, erros); await p.goto(APP); await p.waitForSelector('.aba'); await p.waitForTimeout(800); return p; };

await passo('a aba A junta o que a aba B gravou', async () => {
  const a = await abrir(), c = await abrir();
  await c.evaluate(() => { const k = 'painel-anpd-v3', d = JSON.parse(localStorage.getItem(k)); d.itens = d.itens || {}; d.itens['teste-aba-b'] = [2, 99999, 1, 0, 20000, 0, 0]; localStorage.setItem(k, JSON.stringify(d)); });
  await a.waitForTimeout(500);
  await a.click('.aba[data-vista="questoes"]');
  await a.click('[data-acao="comecar"]');
  await a.waitForSelector('#sessao:not([hidden])');
  await a.locator('.bolha.c').first().click();
  await a.waitForTimeout(800);
  conferir('item da aba B continua gravado', await a.evaluate(() => !!JSON.parse(localStorage.getItem('painel-anpd-v3')).itens['teste-aba-b']));
});

await b.close();
fim(erros);
