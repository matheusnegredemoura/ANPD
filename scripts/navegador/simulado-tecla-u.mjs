// No simulado, U pula para o próximo item ainda sem resposta (o em branco marcado conta como resposta)
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
const itemAtual = async () => Number(((await p.locator('#sessao .sessao-topo .tit span').innerText()).match(/Item (\d+)/) || [])[1]);
// Na múltipla escolha marca a primeira alternativa; devolve se a bolha pedida foi mesmo clicada
const marcar = async (bolha) => { if (await p.locator('button.alt').count()) { await p.locator('button.alt').first().click(); return false; } await p.click('.bolha.' + bolha); return true; };

await passo('U salta os respondidos e o em branco', async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="set-modo"][data-modo="simulado"]');
  await p.click('[data-acao="comecar"]');
  await p.waitForSelector('#sessao:not([hidden])');
  await marcar('c');
  await marcar('e');
  const branco = await marcar('b');
  conferir('três respondidos, no item 4', (await itemAtual()) === 4, String(await itemAtual()));
  for (let i = 0; i < 3; i++) await p.keyboard.press('ArrowLeft');
  conferir('voltou ao item 1', (await itemAtual()) === 1, String(await itemAtual()));
  await p.keyboard.press('u');
  conferir('U leva ao item 4, o primeiro sem resposta', (await itemAtual()) === 4, String(await itemAtual()));
  const resumo = (await p.locator('#sessao .resumo-sim').innerText()).replace(/\s+/g, ' ');
  const respondidos = [...resumo.matchAll(/(\d+)\/\d+/g)].reduce((t, m) => t + Number(m[1]), 0);
  conferir('o resumo do simulado soma os três respondidos e conta o em branco', respondidos === 3 && (branco ? /1 em branco/.test(resumo) : !/em branco/.test(resumo)), resumo);
  conferir('a linha de atalhos ensina o U', /U = próximo sem resposta/.test(await p.locator('#sessao .atalhos').first().innerText()));
});

await passo('"/" fora da sessão leva à busca da tela', async () => {
  await p.keyboard.press('Escape');
  await p.waitForSelector('#sessao', { state: 'hidden' });
  await p.click('.aba[data-vista="questoes"]');
  await p.locator('body').press('/');
  conferir('foco na busca de questões', await p.evaluate(() => document.activeElement && document.activeElement.id === 'busca-questoes'));
  await p.click('.aba[data-vista="lei"]');
  await p.locator('body').press('/');
  conferir('foco na busca da lei seca', await p.evaluate(() => document.activeElement && document.activeElement.id === 'busca-lei'));
});

await b.close();
fim(erros);
