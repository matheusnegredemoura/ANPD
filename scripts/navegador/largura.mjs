// Tela larga (ultrawide 2560×1080): abas num trilho à esquerda, cartões em colunas, sem rolagem lateral; na sessão, o
// item fica à esquerda e o gabarito comentado à direita; na lei seca, o texto à esquerda e o português claro ao lado.
import { APP, abrirNavegador, placar, responder, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const ctx = await browser.newContext({ viewport: { width: 2560, height: 1080 } });
await ctx.clock.install({ time: new Date('2026-10-27T09:00:00') });
const p = await ctx.newPage();
p.setDefaultTimeout(8000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForSelector('#vista-hoje .roteiro');
const caixa = (sel) => p.locator(sel).first().boundingBox();
const semRolagem = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

await passo('Hoje: trilho lateral e cartões em colunas', async () => {
  const abas = await caixa('#abas');
  conferir('abas em trilho vertical à esquerda', abas.x === 0 && abas.height > 900 && abas.width < 140, JSON.stringify(abas));
  const xs = new Set();
  for (const el of await p.locator('#vista-hoje .coluna > .cartao').all()) { const b = await el.boundingBox(); if (b) xs.add(Math.round(b.x)); }
  conferir('pelo menos 3 colunas de cartões', xs.size >= 3, [...xs].join(', '));
  conferir('sem rolagem lateral', await semRolagem());
  // O roteiro é o cartão mais longo: na grade, a linha dele empurrava os cartões seguintes para baixo do fim dele,
  // deixando vazio sob os curtos. Nas colunas, cada bloco começa logo abaixo do anterior da mesma coluna
  const vaos = await p.evaluate(() => [...document.querySelectorAll('#vista-hoje .coluna')].flatMap((c) => {
    const bs = [...c.children].map((b) => b.getBoundingClientRect());
    return bs.slice(1).map((b, i) => Math.round(b.top - bs[i].bottom));
  }));
  conferir('nenhum vazio entre blocos da mesma coluna', vaos.length > 0 && vaos.every((v) => v <= 24), vaos.join(', '));
  // Abrir um detalhe dentro de um cartão não troca nenhum bloco de coluna
  const posicoes = () => p.evaluate(() => [...document.querySelectorAll('#vista-hoje .coluna > *')].map((b) => Math.round(b.getBoundingClientRect().left)).join(','));
  const antes = await posicoes();
  await p.locator('#vista-hoje details > summary').first().click();
  conferir('abrir um detalhe não troca cartões de coluna', (await posicoes()) === antes);
});

await passo('sessão: item à esquerda, gabarito à direita', async () => {
  await p.click('[data-acao="iniciar-dia"]');
  await p.waitForSelector('#sessao:not([hidden]) .item-num');
  await responder(p);
  await p.waitForSelector('.item.dupla .item-dir .veredito');
  const e = await caixa('.item-esq'), d = await caixa('.item-dir');
  conferir('duas colunas lado a lado', d.x > e.x + e.width - 1 && Math.abs(d.y - e.y) < 40, JSON.stringify({ e, d }));
  await p.click('[data-acao="sair-sessao"]');
  if (await p.locator('[data-acao="confirmar-saida"]').count()) await p.click('[data-acao="confirmar-saida"]');
});

await passo('lei seca: texto à esquerda, português claro ao lado', async () => {
  await p.click('.aba[data-vista="lei"]');
  if (!(await p.locator('.ranking button').count())) await p.click('[data-acao="ranking"]');
  await p.locator('.ranking button').first().click();
  await p.waitForSelector('#vista-lei .texto-lei');
  const t = await caixa('#vista-lei .art-texto'), l = await caixa('#vista-lei .art-lado');
  conferir('texto e painel lado a lado', t && l && l.x > t.x + t.width - 1, JSON.stringify({ t, l }));
  conferir('sem rolagem lateral', await semRolagem());
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await ctx.close();
await browser.close();
fim(erros);
