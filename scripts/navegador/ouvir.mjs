// Ouvir o artigo: o botão lê o texto vigente sem as notas de redação, troca para "Parar" e para ao sair do artigo. A voz
// do aparelho é substituída por uma falsa que só registra o que receberia.
import { APP, abrirNavegador, diaDeEstudo, placar, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await diaDeEstudo(ctx);
await ctx.addInitScript(() => {
  window.__falas = [];
  window.__cancelados = 0;
  const falso = { speak: (u) => window.__falas.push(u.text), cancel: () => { window.__cancelados++; }, getVoices: () => [] };
  Object.defineProperty(window, 'speechSynthesis', { value: falso, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
});
const p = await ctx.newPage();
p.setDefaultTimeout(8000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(600);

await passo('ouvir o artigo e parar', async () => {
  await p.click('.aba[data-vista="lei"]');
  await p.click('[data-acao="ranking"]');
  await p.locator('.ranking button').first().click();
  const b = p.locator('[data-acao="ouvir-art"]');
  await b.click();
  const falas = await p.evaluate(() => window.__falas);
  conferir('enviou o texto para a voz', falas.length === 1 && /^Artigo /.test(falas[0]), (falas[0] || '').slice(0, 60));
  conferir('sem notas de redação', !/Redação dada|Incluído pela/.test(falas[0] || ''));
  conferir('botão vira Parar', /Parar/.test(await b.textContent()));
  await b.click();
  conferir('botão volta a Ouvir', /Ouvir/.test(await b.textContent()));
  await b.click();
  const antes = await p.evaluate(() => window.__cancelados);
  await p.click('.aba[data-vista="hoje"]');
  conferir('sair do artigo para a voz', (await p.evaluate(() => window.__cancelados)) > antes);
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await browser.close();
fim(erros);
