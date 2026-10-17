// Prontidão medida com itens reais: o Progresso separa o acerto inédito em itens reais e itens do banco, e o botão de
// treino traz só itens reais ainda não respondidos.
import { APP, abrirNavegador, foto, placar, responder, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, fim } = placar();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const erros = [];
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(500);

const abrirProgresso = async () => {
  await p.click('.aba[data-vista="mais"]');
  await p.click('[data-acao="mais"][data-sub="menu"]').catch(() => {});
  await p.click('.menu-mais [data-sub="progresso"]');
  await p.waitForTimeout(200);
  return p.locator('.cartao', { hasText: 'Prontidão para a prova' }).first();
};

let card = await abrirProgresso();
conferir('cartão de prontidão aparece no Progresso', (await card.count()) === 1);
let txt = (await card.textContent()).replace(/\s+/g, ' ');
conferir('sem respostas, pede itens reais para medir', /faltam 100/.test(txt), txt.slice(0, 160));
conferir('oferece 20 itens reais inéditos', /Treinar 20 itens reais inéditos/.test(txt));

await card.locator('[data-acao="treinar-reais"]').click();
await p.waitForSelector('#sessao:not([hidden])');
const total = Number(/de (\d+)/.exec(await p.textContent('.sessao-topo .tit span'))[1]);
conferir('sessão tem 20 itens', total === 20, String(total));
let reais = 0;
for (let i = 0; i < total; i++) {
  if (await p.locator('#sessao .selo.real').count()) reais++;
  await responder(p, i % 4 ? 'c' : 'e');
  await p.waitForSelector('.veredito');
  await p.click('[data-acao="proximo"]');
}
conferir('todos os itens são reais', reais === total, reais + ' de ' + total);
await p.waitForSelector('.placar');
await p.click('[data-acao="fechar-sessao"]');

card = await abrirProgresso();
txt = (await card.textContent()).replace(/\s+/g, ' ');
conferir('conta as 20 primeiras respostas em itens reais', /Itens reais de prova · 20 primeiras respostas/.test(txt), txt.slice(0, 200));
conferir('faltam 80 para a medida ficar confiável', /faltam 80/.test(txt));
await card.screenshot({ path: foto('prontidao.png') });

await browser.close();
fim(erros);
