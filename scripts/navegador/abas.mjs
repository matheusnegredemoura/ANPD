// Duas abas do painel abertas: o que uma grava no navegador não é apagado quando a outra grava depois. E, dentro
// do painel, cada aba da barra guarda a posição da página.
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
  // O primeiro item pode ser de certo/errado ou de múltipla escolha: vale qualquer resposta que não seja em branco
  await a.locator('#sessao [data-acao="responder"]:not(.b)').first().click();
  await a.waitForTimeout(800);
  conferir('item da aba B continua gravado', await a.evaluate(() => !!JSON.parse(localStorage.getItem('painel-anpd-v3')).itens['teste-aba-b']));
});

await passo('voltar à lei seca pela barra de abas devolve ao ponto da leitura', async () => {
  const p = await abrir();
  await p.click('.aba[data-vista="lei"]');
  await p.waitForTimeout(300);
  await p.evaluate(() => window.scrollTo(0, 1500));
  await p.waitForTimeout(200);
  const antes = await p.evaluate(() => window.scrollY);
  if (antes < 1000) throw new Error('a lei seca não rolou: ' + antes);
  await p.click('.aba[data-vista="questoes"]');
  await p.waitForTimeout(200);
  conferir('outra aba abre no topo', (await p.evaluate(() => window.scrollY)) === 0);
  await p.click('.aba[data-vista="lei"]');
  await p.waitForTimeout(200);
  const depois = await p.evaluate(() => window.scrollY);
  conferir('lei seca volta à mesma altura', Math.abs(depois - antes) < 5, antes + ' → ' + depois);
});

await b.close();
fim(erros);
