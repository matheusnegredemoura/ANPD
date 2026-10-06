// Itens de múltipla escolha (prova da ANPD de 2025): alternativas, atalhos de teclado, gabarito marcado e nota do
// simulado sem o desconto do Cebraspe para erro de letra.
import { APP, abrirNavegador, foto, placar, sairDaSessao, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const erros = [];
const { passo, fim } = placar();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
p.setDefaultTimeout(4000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(400);

await passo('treino de itens reais chega a uma múltipla escolha e marca o gabarito', async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="reais"][data-modo="treino"]');
  await p.waitForSelector('#sessao:not([hidden])');
  let achou = false;
  for (let i = 0; i < 400; i++) {
    if (await p.locator('button.alt').count()) { achou = true; break; }
    await p.click('.bolha.c');
    await p.waitForSelector('.veredito');
    await p.click('[data-acao="proximo"]');
  }
  if (!achou) throw new Error('nenhuma múltipla escolha encontrada');
  if ((await p.locator('button.alt').count()) < 4) throw new Error('menos de 4 alternativas');
  await p.keyboard.press('b');
  await p.waitForSelector('.veredito');
  if (!(await p.locator('.alt.gab').count())) throw new Error('alternativa do gabarito não marcada');
  await p.locator('#sessao .alternativas').screenshot({ path: foto('mc-depois.png') });
  await sairDaSessao(p);
});

await passo('simulado de itens reais: nota não desconta erro de letra', async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="reais"][data-modo="simulado"]');
  await p.waitForSelector('#sessao:not([hidden])');
  const total = await p.locator('.tira button').count();
  for (let i = 0; i < total; i++) {
    await p.keyboard.press((await p.locator('button.alt').count()) ? 'e' : 'c');
    await p.waitForTimeout(5);
  }
  await p.click('[data-acao="entregar"]');
  if (await p.locator('[data-acao="confirmar-entrega"]').count()) await p.click('[data-acao="confirmar-entrega"]');
  await p.waitForSelector('.nota-final');
  await p.screenshot({ path: foto('mc-resultado.png'), fullPage: true });
});

await browser.close();
fim(erros);
