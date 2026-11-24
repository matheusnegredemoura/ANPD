// Virada: acertar no dia seguinte um item que você errou vale XP em dobro e aparece no resultado da sessão.
import { APP, abrirNavegador, placar, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, fim } = placar();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const ontem = new Date();
ontem.setHours(10, 0, 0, 0);
await ctx.clock.install({ time: ontem });
const p = await ctx.newPage();
const erros = [];
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(500);

async function treino(filtro) {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="set-modo"][data-modo="treino"]');
  await p.click('[data-acao="set-filtro"][data-filtro="' + filtro + '"]');
  await p.click('[data-acao="comecar"]');
  await p.waitForSelector('#sessao:not([hidden])');
}
const gabarito = async () => {
  const t = (await p.textContent('.veredito')) || '';
  const m = /gabarito é (CERTO|ERRADO|a letra ([A-E]))/.exec(t);
  return m ? (m[2] || m[1]) : null;
};

// Dia 1: responde até errar um item certo/errado e anota o gabarito
await treino('novas');
let errado = null, gab = null;
for (let i = 0; i < 20 && !errado; i++) {
  const num = (await p.textContent('.item-num')).trim();
  const ce = (await p.locator('button.alt').count()) === 0;
  if (ce) await p.click('.bolha.c'); else await p.locator('button.alt').first().click();
  await p.waitForSelector('.veredito');
  if (ce && (await p.locator('.veredito.no').count())) { errado = num; gab = await gabarito(); }
  await p.click('[data-acao="proximo"]');
}
conferir('errou um item no primeiro dia', !!errado && gab === 'ERRADO', errado + ' ' + gab);
await p.click('[data-acao="sair-sessao"]').catch(() => {});
await p.click('[data-acao="confirmar-saida"]').catch(() => {});

// Dia 2: treino só com os que já errou; acerta o item e confere o XP em dobro
await ctx.clock.setSystemTime(new Date(ontem.getTime() + 864e5));
await p.reload();
await p.waitForTimeout(600);
await treino('erradas');
let achou = false, ganho = '';
for (let i = 0; i < 10 && !achou; i++) {
  const num = (await p.textContent('.item-num')).trim();
  if (num === errado) {
    await p.click('.bolha.e');
    await p.waitForSelector('.veredito');
    ganho = ((await p.textContent('.veredito .ganho').catch(() => '')) || '').replace(/\s+/g, ' ');
    achou = true;
  } else {
    if (await p.locator('button.alt').count()) await p.locator('button.alt').first().click(); else await p.click('.bolha.c');
    await p.waitForSelector('.veredito');
  }
  await p.click('[data-acao="proximo"]');
}
conferir('o item errado voltou no treino de erros', achou);
const xp = Number((/\+(\d+) XP/.exec(ganho) || [0, 0])[1]);
conferir('acerto do item antes errado vem marcado como virada', /virada/.test(ganho), ganho);
conferir('virada vale o dobro (pelo menos 20 XP)', xp >= 20, String(xp));
await p.waitForSelector('.placar', { timeout: 5000 }).catch(() => {});
if (!(await p.locator('.placar').count())) { await p.click('[data-acao="sair-sessao"]').catch(() => {}); }
const res = ((await p.textContent('#sessao').catch(() => '')) || '').replace(/\s+/g, ' ');
conferir('resultado conta a virada', /1 virada/.test(res) || !(await p.locator('.placar').count()), (/\d+ viradas?[^.]*/.exec(res) || ['(sem resultado)'])[0]);

await browser.close();
fim(erros);
