// Busca de questões na aba Questões: acha por palavra e por código, não mostra gabarito e treina os achados
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

await passo('busca por palavra, sem gabarito na lista', async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.locator('#busca-questoes').pressSequentially('legitimo interesse');
  await p.waitForSelector('.item-busca-q');
  const lista = await p.locator('.lista-busca-q').innerText();
  conferir('acha sem acento no termo', /legítimo interesse/i.test(lista), lista.slice(0, 120));
  conferir('foco fica no campo', await p.evaluate(() => document.activeElement && document.activeElement.id === 'busca-questoes'));
  conferir('lista sem gabarito', !/gabarito|\bCerto\b|\bErrado\b/.test(lista));
  conferir('no máximo 10 na lista', (await p.locator('.item-busca-q').count()) <= 10);
  const largura = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  conferir('sem rolagem horizontal', largura <= 0, largura + 'px');
});

await passo('tocar no item abre o comentário', async () => {
  await p.locator('.item-busca-q').first().click();
  await p.waitForSelector('#folha:not([hidden])');
  conferir('folha com o item', (await p.locator('#folha .enunciado').count()) > 0);
  await p.click('[data-acao="fechar-folha"]');
});

await passo('treinar os encontrados', async () => {
  await p.click('[data-acao="treinar-busca-q"]');
  await p.waitForSelector('#sessao:not([hidden])');
  const tit = await p.locator('.sessao-topo .tit').innerText();
  conferir('sessão com o termo no título', /Busca: legitimo interesse/.test(tit), tit);
  const total = Number((tit.match(/de (\d+)/) || [])[1]);
  conferir('no máximo 50 itens', total > 0 && total <= 50, String(total));
});

await passo('busca por código e termo curto', async () => {
  await p.keyboard.press('Escape');
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="limpar-busca-q"]');
  await p.locator('#busca-questoes').fill('');
  await p.locator('#busca-questoes').pressSequentially('lgpd-18-0');
  await p.waitForSelector('.item-busca-q');
  conferir('acha pelo código', /lgpd-18-0/.test(await p.locator('.item-busca-q').first().innerText()));
  await p.locator('#busca-questoes').fill('ia');
  await p.locator('#busca-questoes').dispatchEvent('input');
  conferir('termo de 2 letras não lista', !(await p.locator('.item-busca-q').count()));
});

await b.close();
fim(erros);
