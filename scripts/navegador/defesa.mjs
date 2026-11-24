// Em branco no treino é defesa: veredito próprio, sem perder coração, e o item volta na revisão
import { APP, abrirNavegador, diaDeEstudo, placar, vigiarErros } from './comum.mjs';

const b = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await diaDeEstudo(ctx);
const p = await ctx.newPage();
p.setDefaultTimeout(8000);
vigiarErros(p, erros);
await p.goto(APP);

await passo('em branco no treino vira defesa', async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="comecar"]');
  await p.waitForSelector('#sessao:not([hidden])');
  const cor = async () => (await p.locator('.coracoes').getAttribute('aria-label').catch(() => null)) || '';
  const antes = await cor();
  await p.locator('.bolha.b').first().click();
  conferir('veredito de defesa', /defesa, sem perder coração/.test(await p.locator('.veredito').first().innerText()));
  conferir('corações intactos', (await cor()) === antes);
  conferir('comentário aberto', (await p.locator('[data-acao="proximo"], [data-acao="seguir"]').count()) > 0 || (await p.locator('.explica').count()) > 0);
});

await b.close();
fim(erros);
