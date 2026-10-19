// Trilhas do zero: a aula do dia segue a matéria principal do plano (ECA Digital em 09/11/2026), a trilha de ECA
// Digital aparece com seus subtemas e a aula, e o pré-teste do subtema abre.
import { readFileSync } from 'node:fs';
import { APP, abrirNavegador, foto, placar, vigiarErros } from './comum.mjs';

const plano = JSON.parse(readFileSync(new URL('../../dados/cronograma.json', import.meta.url), 'utf8'));
const dias = plano.fases.flatMap((f) => f.semanas.flatMap((s) => s.dias));
const diaEca = dias.find((d) => d.blocos[0] === 'eca-digital');
const diaLgpd = dias.find((d) => d.blocos[0] === 'lgpd-17-22');

const browser = await abrirNavegador();
const { conferir, fim } = placar();
const erros = [];

async function passoDaTrilha(data) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.clock.install({ time: new Date(data + 'T10:00:00') });
  const p = await ctx.newPage();
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForTimeout(500);
  const passo = ((await p.locator('.roteiro .passo', { hasText: 'do zero' }).first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ');
  return { ctx, p, passo };
}

const eca = await passoDaTrilha(diaEca.data);
conferir('em ' + diaEca.data + ' (ECA Digital no plano) a aula do dia é de ECA Digital', /ECA Digital do zero/.test(eca.passo), eca.passo.slice(0, 120));
await eca.ctx.close();

const lgpd = await passoDaTrilha(diaLgpd.data);
conferir('em ' + diaLgpd.data + ' (LGPD no plano) a aula do dia é de LGPD', /LGPD do zero/.test(lgpd.passo), lgpd.passo.slice(0, 120));
const p = lgpd.p;
await p.click('.aba[data-vista="mais"]');
await p.click('[data-acao="mais"][data-sub="menu"]').catch(() => {});
await p.click('.menu-mais [data-sub="trilha"]');
await p.waitForTimeout(200);
const pagina = ((await p.textContent('#vista-mais')) || '').replace(/\s+/g, ' ');
conferir('a página de trilhas tem a trilha de ECA Digital', /ECA Digital do zero/.test(pagina));
const nTrilhas = JSON.parse(readFileSync(new URL('../../dados/trilhas.json', import.meta.url), 'utf8')).trilhas.length;
conferir('o menu de trilhas tem uma matéria por trilha (' + nTrilhas + ')', (await p.locator('.cb-nav .chip').count()) === nTrilhas, String(await p.locator('.cb-nav .chip').count()));
await p.locator('[data-acao="subtema"][data-st="ed-fiscalizacao"]').click();
await p.waitForTimeout(200);
const aula = ((await p.textContent('#vista-mais')) || '').replace(/\s+/g, ' ');
conferir('a aula de sanções do ECA Digital separa ANPD e Judiciário', /Poder Judiciário/.test(aula) && /10% do faturamento/.test(aula));
await p.screenshot({ path: foto('trilha-eca.png'), fullPage: true });
const sobra = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
conferir('a aula não estoura a largura do celular', sobra <= 0, String(sobra));

// Pré-teste de um subtema novo: os itens vêm do mais fácil ao mais difícil
await p.locator('#vista-mais [data-acao="trilha-sessao"][data-tipo="pre"]').first().click().catch((e) => console.log('clique:', e.message.split('\n')[0]));
await p.waitForSelector('#sessao:not([hidden])', { timeout: 5000 }).catch(() => {});
conferir('o pré-teste do subtema abre', await p.locator('#sessao:not([hidden])').count() === 1);
await lgpd.ctx.close();

await browser.close();
fim(erros);
