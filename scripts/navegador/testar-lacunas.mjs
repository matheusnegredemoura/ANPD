// Modo Testar da lei seca: além de prazos e deve × pode, esconde as lacunas dos cards do artigo, no próprio texto
// (os cards soltos saíram do roteiro do dia). Art. 2º da LGPD: o card da autodeterminação informativa vira tarja,
// some só com o modo ligado e abre no toque.
import { APP, abrirNavegador, placar, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { passo, fim } = placar();
const erros = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
p.setDefaultTimeout(8000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForSelector('#vista-hoje .roteiro');

await passo('o roteiro do dia não tem passo de cards', async () => {
  const t = (await p.locator('.roteiro .passo b').allTextContents()).join(' | ');
  if (/Cards/i.test(t)) throw new Error(t);
});

await passo('Testar esconde a lacuna do card no artigo, e o toque revela', async () => {
  await p.click('.aba[data-vista="lei"]');
  await p.selectOption('#vista-lei select[data-acao="sel-lei"]', 'lgpd');
  await p.evaluate(() => document.querySelector('#vista-lei [data-acao="abrir-art"][data-art="2"]').click());
  await p.waitForSelector('#vista-lei .texto-lei');
  if (await p.locator('#vista-lei .texto-lei .g-lac').count()) throw new Error('tarja de lacuna sem o modo Testar');
  await p.click('#vista-lei [data-acao="camada"][data-c="teste"]');
  const lac = p.locator('#vista-lei .texto-lei .g-lac', { hasText: 'autodeterminação' }).first();
  if (!(await lac.count())) throw new Error('a lacuna do card não virou tarja');
  const cor = await lac.evaluate((el) => getComputedStyle(el).color);
  if (cor !== 'rgba(0, 0, 0, 0)') throw new Error('a lacuna aparece com o modo ligado: ' + cor);
  await lac.click();
  if (!/revelado/.test(await lac.getAttribute('class'))) throw new Error('o toque não revelou a lacuna');
  await p.click('#vista-lei [data-acao="camada"][data-c="teste"]');
  if (await p.locator('#vista-lei .texto-lei .g-lac').count()) throw new Error('a tarja ficou depois de desligar o Testar');
});

await browser.close();
fim(erros);
