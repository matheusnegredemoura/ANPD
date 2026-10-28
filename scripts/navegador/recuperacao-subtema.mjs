// Recuperação de dia com subtema: segunda, 26/10/2026, era dia de dados sensíveis (subtema pd-sensiveis) com duas
// matérias, lgpd-5-11 e lgpd-1-4-14. Na terça, a sessão de recuperação traz o que falta de cada uma, e respondê-la
// inteira dá baixa no dia (antes, os itens do subtema que caíam em outra matéria ocupavam as vagas e o dia ficava
// pendente depois da recuperação feita).
import { APP, abrirNavegador, placar, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { passo, fim } = placar();
const erros = [];

await passo('recuperação de dia com subtema dá baixa no dia quando respondida inteira', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.clock.install({ time: new Date('2026-10-27T10:00:00') });
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem('semeado')) return;
    sessionStorage.setItem('semeado', '1');
    const perfil = { xp: 0, meta: 30, novosCards: 20, intercaladas: 30, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: '2026-10-26' };
    localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(8000);
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForSelector('#vista-hoje .roteiro');
  const botao = p.locator('.roteiro [data-acao="recuperar"]');
  if (!(await botao.count())) throw new Error('sem passo de recuperação');
  const rot = (await botao.textContent()).trim();
  if (!/26\/10/.test(rot)) throw new Error('recuperação de outro dia: ' + rot);
  await botao.click();
  await p.waitForSelector('#sessao:not([hidden])');
  for (let i = 0; i < 60; i++) {
    if (await p.locator('button.alt').count()) await p.locator('button.alt').first().click(); else await p.click('.bolha.c');
    await p.waitForSelector('.veredito');
    await p.click('[data-acao="proximo"]');
    if (await p.locator('[data-acao="fechar-sessao"]').count()) break;
  }
  await p.click('[data-acao="fechar-sessao"]');
  await p.waitForSelector('#vista-hoje .roteiro');
  const depois = p.locator('.roteiro [data-acao="recuperar"]');
  const resto = (await depois.count()) ? (await depois.textContent()).trim() : '';
  if (/26\/10/.test(resto)) throw new Error('o dia continuou pendente depois da recuperação: ' + resto);
  await ctx.close();
});

await browser.close();
fim(erros);
