// Tela Hoje enxuta e cota da semana: prontidão no topo, Jornada recolhida num resumo, cartão "Esta semana" com a
// discursiva e o simulado de 30 itens (o simulado feito na semana cumpre a cota) e a lista Para pesquisar só com os 10
// pendentes mais recentes.
import { APP, abrirNavegador, diaDeEstudo, placar, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await diaDeEstudo(ctx);
await ctx.addInitScript(() => {
  if (sessionStorage.getItem('semeado')) return;
  sessionStorage.setItem('semeado', '1');
  const d = new Date(), hoje = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const pesquisa = {};
  for (let k = 0; k < 15; k++) pesquisa['tema ' + k] = { t: 'Tema de teste ' + k, d: '2026-10-' + String(10 + k).padStart(2, '0'), o: 'teste' };
  const perfil = { xp: 0, meta: 30, novosCards: 5, intercaladas: 20, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: hoje };
  localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens: {}, cards: {}, simulados: [], pesquisa, disc: {}, t: {} }));
});
const p = await ctx.newPage();
p.setDefaultTimeout(8000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(600);

await passo('Hoje: prontidão no topo, Jornada recolhida e cartão da semana', async () => {
  conferir('prontidão no topo', /Prontidão/.test(await p.textContent('#vista-hoje .pront-topo')));
  conferir('Jornada recolhida', (await p.locator('details[data-det="jornada"][open]').count()) === 0);
  conferir('resumo da Jornada com nível e missões', /nível \d+ · \d+\/\d+ missões/.test(await p.textContent('.jornada-resumo')));
  const sem = (await p.textContent('.cartao.semana')).replace(/\s+/g, ' ');
  conferir('discursiva e simulado da semana pendentes', /0 de 2/.test(sem) && /Discursiva da semana/.test(sem) && /Simulado da semana \(30 itens\)/.test(sem), sem.slice(0, 120));
  const ordem = await p.evaluate(() => [...document.querySelectorAll('#vista-hoje > .cartao')].map((c) => c.className));
  const iR = ordem.findIndex((c) => /semana/.test(c)), iJ = ordem.findIndex((c) => /jornada/.test(c));
  conferir('a semana vem antes da Jornada', iR >= 0 && iJ > iR, ordem.join(' | '));
});

await passo('o simulado da semana tem 30 itens e, entregue, cumpre a cota', async () => {
  await p.click('[data-acao="simulado-semana"]');
  await p.waitForSelector('#sessao:not([hidden])');
  const cab = (await p.textContent('.sessao-topo .tit span')).trim();
  if (!/^Item 1 de 30/.test(cab)) throw new Error('cabeçalho: ' + cab);
  await p.click('[data-acao="entregar"]');
  if (await p.locator('[data-acao="confirmar-entrega"]').count()) await p.click('[data-acao="confirmar-entrega"]');
  await p.waitForTimeout(400);
  if (await p.locator('[data-acao="fechar-sessao"]').count()) await p.click('[data-acao="fechar-sessao"]');
  await p.waitForTimeout(300);
  const sem = (await p.textContent('.cartao.semana')).replace(/\s+/g, ' ');
  conferir('simulado da semana cumprido', /1 de 2/.test(sem) && /Feito nesta semana/.test(sem), sem.slice(0, 160));
});

await passo('Para pesquisar mostra só os 10 pendentes mais recentes', async () => {
  await p.click('.aba[data-vista="mais"]');
  await p.click('#vista-mais [data-acao="mais"][data-sub="pesquisar"]');
  conferir('10 visíveis', (await p.locator('.lista-pesq .pesq-linha').count()) === 10);
  await p.click('[data-acao="pesq-todos"]');
  conferir('todos depois do toque', (await p.locator('.lista-pesq .pesq-linha').count()) === 15);
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await browser.close();
fim(erros);
