// Gêmeo: item que você já errou volta trocado por um item inédito que cobra o mesmo dispositivo (mesma norma e mesma
// referência), de preferência com o gabarito oposto. O acerto no gêmeo sobe o original na agenda sem somar acerto nele;
// o aviso aparece só depois da resposta. Item errado sem gêmeo inédito volta ele mesmo.
import { APP, abrirNavegador, placar, responder, vigiarErros } from './comum.mjs';
import { montarDados } from '../build.mjs';

const d = montarDados();
const grupos = new Map();
for (const q of d.questoes) if (q.l && q.r && !q.al && q.ap == null) { const k = q.l + '|' + q.r; (grupos.get(k) || grupos.set(k, []).get(k)).push(q); }
// X: grupo com um gêmeo de gabarito oposto, todos autorais (a reserva de medida só tem itens reais); Y: sem irmão
const [, gx] = [...grupos].find(([, g]) => g.length >= 3 && g.every((q) => !q.o) && new Set(g.map((q) => q.g)).size === 2);
const X = gx[0], esperado = gx.filter((q) => q.id !== X.id && q.g !== X.g).map((q) => q.id);
const [, gy] = [...grupos].find(([k, g]) => g.length === 1 && k.startsWith('lgpd|'));
const Y = gy[0];
const [y, m, dd] = [2026, 11, 25];
const HOJE = Math.round(Date.UTC(y, m - 1, dd) / 864e5);
const itens = { [X.id]: [0, HOJE, 0, 1, HOJE - 1, 0, 0, 0], [Y.id]: [0, HOJE, 0, 1, HOJE - 1, 0, 0, 0] };

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 1100 } });
await ctx.clock.install({ time: new Date(y, m - 1, dd, 10, 0) });
await ctx.addInitScript(([itens]) => {
  if (location.protocol === 'about:' || window.name === 'semeado') return;
  window.name = 'semeado';
  localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil: { criado: '2026-10-05', feitos: {} }, itens, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
}, [itens]);
const p = await ctx.newPage();
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForSelector('.aba');
const estado = () => p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')).itens);

await passo('minhas erradas: X vem trocado pelo gêmeo, Y (sem gêmeo) vem ele mesmo', async () => {
  await p.click('[data-acao="ir"][data-vista="questoes"]');
  await p.locator('.inicio-rapido [data-acao="treinar-erradas"]').click();
  await p.waitForSelector('#sessao:not([hidden])');
  const vistos = [];
  for (let i = 0; i < 2; i++) {
    const id = ((await p.textContent('#sessao .item-num')) || '').trim();
    vistos.push(id);
    conferir('sem aviso de gêmeo antes da resposta (' + id + ')', !(await p.locator('#sessao .gemeo').count()));
    const q = d.questoes.find((x) => x.id === id);
    await responder(p, q.g.toLowerCase());
    await p.waitForSelector('#sessao .veredito');
    if (id !== Y.id) {
      conferir('o gêmeo é do mesmo dispositivo, com o gabarito oposto', esperado.includes(id), id + ' · esperado um de ' + esperado.join(','));
      const bt = p.locator('#sessao .gemeo [data-acao="revisar-item"]');
      conferir('depois da resposta, o aviso aponta para a questão errada', (await bt.count()) === 1 && (await bt.getAttribute('data-q')) === X.id);
    }
    const prox = p.locator('#sessao [data-acao="proximo"]');
    if (i === 0) await prox.click();
  }
  conferir('X não aparece, Y aparece', !vistos.includes(X.id) && vistos.includes(Y.id), vistos.join(','));
});

await passo('o acerto no gêmeo sobe X na agenda sem somar acerto nele', async () => {
  const it = await estado();
  const x = it[X.id];
  conferir('X no nível 1, volta amanhã', x[0] === 1 && x[1] === HOJE + 1, JSON.stringify(x));
  conferir('acertos e erros de X intactos', x[2] === 0 && x[3] === 1, JSON.stringify(x));
  const g = Object.keys(it).find((k) => esperado.includes(k));
  conferir('o gêmeo ganhou registro próprio', !!g && it[g][0] === 3, g + ' ' + JSON.stringify(it[g]));
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await browser.close();
fim(erros);
