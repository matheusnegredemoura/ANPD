// Resultado da sessão mostra em que armadilha caíram os erros e treina a principal
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

await passo('erro na sessão aparece por armadilha no resultado', async () => {
  // r4x-09 tem gabarito Errado: marcar Certo garante um erro
  await p.click('.aba[data-vista="questoes"]');
  await p.locator('#busca-questoes').pressSequentially('r4x-09');
  await p.waitForSelector('.item-busca-q');
  await p.click('[data-acao="treinar-busca-q"]');
  await p.waitForSelector('#sessao:not([hidden])');
  await p.click('.bolha.c');
  await p.waitForSelector('.veredito');
  // O trecho aparece dentro do dispositivo, grifado (aqui, o § 1º do art. 13 da Res. 4/2023)
  const cit = (await p.locator('#sessao .citacao q').first().innerText()).replace(/\s+/g, ' ');
  conferir('trecho grifado dentro do dispositivo', (await p.locator('#sessao .citacao q mark').count()) === 1 && /Para efeitos dos incisos I e III/.test(cit) && !/Inclu[íi]do/.test(cit), cit.slice(0, 120));
  await p.click('[data-acao="proximo"]');
  await p.waitForSelector('#sessao .armadilhas-sessao');
  const txt = (await p.textContent('#sessao .armadilhas-sessao')).replace(/\s+/g, ' ');
  const n = (await p.textContent('#sessao .lista-arm-sessao li b')).trim();
  conferir('cartão com o tipo da armadilha e a contagem', /Onde você errou/.test(txt) && n === '1' && !/undefined/.test(txt), n + ' · ' + txt.slice(0, 160));
  const largura = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  conferir('sem rolagem horizontal', largura <= 0, largura + 'px');
});

await passo('o botão abre treino só dessa armadilha', async () => {
  await p.click('#sessao .armadilhas-sessao [data-acao="treinar-arm"]');
  await p.waitForSelector('#sessao .sessao-topo .tit');
  const tit = await p.locator('.sessao-topo .tit').innerText();
  conferir('nova sessão com o nome da armadilha', /Armadilha ·/.test(tit), tit);
  conferir('a sessão anterior fechou', !(await p.locator('#sessao .armadilhas-sessao').count()));
});

await passo('Refazer erros abre a sessão e ela fica aberta', async () => {
  await p.click('#sessao .bolha.c');
  await p.waitForSelector('.veredito');
  // Responde até chegar ao resultado (a sessão de armadilha tem até 20 itens), errando de propósito ao marcar sempre C
  for (let i = 0; i < 25 && !(await p.locator('#sessao [data-acao="refazer-erros"]').count()); i++) {
    await p.click('[data-acao="proximo"]');
    if (await p.locator('#sessao [data-acao="refazer-erros"]').count()) break;
    if (await p.locator('button.alt').count()) await p.locator('button.alt').first().click(); else await p.click('#sessao .bolha.c');
    await p.waitForSelector('.veredito');
  }
  await p.click('#sessao [data-acao="refazer-erros"]');
  await p.waitForTimeout(800);
  const aberta = !(await p.locator('#sessao').evaluate((e) => e.hidden));
  conferir('a sessão de refazer continua aberta', aberta && /Refazer erros/.test(await p.locator('#sessao .sessao-topo .tit').innerText()));
  await p.goBack();
  await p.waitForTimeout(500);
  conferir('Voltar do navegador fecha a sessão', await p.locator('#sessao').evaluate((e) => e.hidden));
});

await b.close();
fim(erros);
