// Acessibilidade básica que o axe acusou e foi corrigida: idioma da página, aria-label só em elemento com papel e
// nada apagado por opacidade (ela derruba o contraste do texto abaixo de 4,5:1)
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

// aria-label em div, span ou i sem role é proibido pela especificação ARIA; leitor de tela pode ignorá-lo
const ariaSemPapel = () => p.evaluate(() => [...document.querySelectorAll('div[aria-label]:not([role]), span[aria-label]:not([role]), i[aria-label]:not([role])')].filter((e) => e.offsetParent).map((e) => e.className || e.tagName).slice(0, 5));
const opacos = (sel) => p.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent && Number(getComputedStyle(e).opacity) < 1).length, sel);

await passo('idioma da página', async () => {
  conferir('html com lang pt-BR', (await p.evaluate(() => document.documentElement.lang)) === 'pt-BR');
});

await passo('lei seca: vetados e camadas sem opacidade', async () => {
  await p.click('.aba[data-vista="lei"]');
  conferir('há artigo vetado na lista', (await p.locator('.art-btn.vetado').count()) > 0);
  conferir('vetado sem opacidade', !(await opacos('.art-btn.vetado')));
  await p.click('button[data-art="52"]');
  await p.waitForSelector('.camadas');
  conferir('camada desligada sem opacidade no texto', !(await opacos('.camada[aria-pressed="false"]')));
});

await passo('sessão e progresso: aria-label com papel', async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="comecar"]');
  await p.waitForSelector('#sessao:not([hidden])');
  const s = await ariaSemPapel();
  conferir('sessão sem aria-label órfão', !s.length, s.join(', '));
  await p.keyboard.press('Escape');
  await p.click('.aba[data-vista="mais"]');
  await p.click('#vista-mais [data-acao="mais"][data-sub="progresso"]');
  const g = await ariaSemPapel();
  conferir('progresso sem aria-label órfão', !g.length, g.join(', '));
});

await passo('plano: dias passados sem opacidade', async () => {
  await p.click('.aba[data-vista="mais"]');
  await p.click('#vista-mais [data-acao="mais"][data-sub="plano"]');
  conferir('dia passado sem opacidade', !(await opacos('.dia-linha.passado')));
});

await b.close();
fim(erros);
