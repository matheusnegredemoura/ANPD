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

await passo('AGEPAR 2026: caderno próprio no simulado e gabarito preliminar avisado', async () => {
  if (await p.locator('#sessao:not([hidden]) [data-acao="fechar-sessao"]').count()) await p.click('#sessao [data-acao="fechar-sessao"]');
  await p.click('.aba[data-vista="questoes"]');
  const cartao = (await p.textContent('.cartao.reais')).replace(/\s+/g, ' ');
  if (!/com o gabarito preliminar da banca/.test(cartao)) throw new Error('cartão dos reais não avisa o gabarito preliminar: ' + cartao.slice(0, 200));
  await p.click('[data-acao="set-modo"][data-modo="simulado"]');
  const botao = p.locator('[data-acao="simulado-prova"][data-pref="ag26-"]');
  const rotulo = await botao.textContent();
  const n = Number(rotulo.match(/(\d+) itens/)?.[1]);
  if (!(n >= 50)) throw new Error('botão da AGEPAR sem os itens: ' + rotulo);
  await botao.click();
  await p.waitForSelector('#sessao:not([hidden])');
  if ((await p.locator('.tira button').count()) !== n) throw new Error('sessão não tem os ' + n + ' itens');
  if ((await p.locator('button.alt').count()) < 5) throw new Error('primeiro item sem as cinco alternativas');
  if (!/AGEPAR 2026/.test(await p.textContent('#sessao'))) throw new Error('título da sessão sem AGEPAR 2026');
  await sairDaSessao(p);
});

await browser.close();
fim(erros);
