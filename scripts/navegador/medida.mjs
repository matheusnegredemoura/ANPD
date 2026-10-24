// Medida honesta: a prontidão mostra a faixa provável, e o treino traz pelo menos 1 item real em cada 4 novos sem tocar
// na reserva de medida (~40% dos itens reais, sorteio fixo pelo id), que fica para os simulados.
import { APP, abrirNavegador, diaDeEstudo, placar, responder, vigiarErros } from './comum.mjs';
import { montarDados } from '../build.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const Q = montarDados().questoes;
const QI = new Map(Q.map((q) => [q.id, q]));
const hashTxt = (t) => { let h = 2166136261; for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const reais = Q.filter((q) => q.o && /cebraspe|cespe/i.test(q.pv || ''));
const reserva = new Set(reais.filter((q) => hashTxt('reserva:' + q.id) % 10 < 4).map((q) => q.id));
const semente = reais.filter((q) => !q.al).slice(0, 300).map((q, i) => [q.id, i % 10 < 7 ? 1 : 0]);

await passo('prontidão no topo com a faixa provável', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await diaDeEstudo(ctx);
  await ctx.addInitScript((semente) => {
    if (sessionStorage.getItem('semeado')) return;
    sessionStorage.setItem('semeado', '1');
    const agora = new Date(), hoje = Math.round(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()) / 86400000);
    const itens = {};
    for (const [id, ok] of semente) itens[id] = [ok, hoje + 3, ok, 1 - ok, hoje - 1, 0, 0, ok];
    const iso = new Date(hoje * 86400000).toISOString().slice(0, 10);
    const perfil = { xp: 0, meta: 30, novosCards: 5, intercaladas: 20, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: iso };
    localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
  }, semente);
  const p = await ctx.newPage();
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForTimeout(600);
  const t = (await p.textContent('.pront-topo')).replace(/\s+/g, ' ');
  conferir('faixa provável no topo', /provavelmente entre -?\d+ e -?\d+/.test(t), t.slice(0, 200));
  const m = /Prontidão: (-?\d+) de 120 pontos líquidos \(provavelmente entre (-?\d+) e (-?\d+)\)/.exec(t);
  conferir('a nota fica dentro da faixa', m && +m[2] <= +m[1] && +m[1] <= +m[3], m ? m.slice(1).join(' ') : t.slice(0, 120));
  await ctx.close();
});

await passo('treino: 1 real em cada 4 novos, sem a reserva de medida', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await diaDeEstudo(ctx);
  const p = await ctx.newPage();
  p.setDefaultTimeout(8000);
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForTimeout(600);
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="set-modo"][data-modo="treino"]');
  await p.click('[data-acao="set-n"][data-n="30"]');
  await p.click('[data-acao="comecar"]');
  await p.waitForSelector('#sessao:not([hidden])');
  const vistos = [];
  for (let k = 0; k < 40; k++) {
    vistos.push((await p.textContent('.item .item-num')).trim());
    await responder(p);
    await p.waitForSelector('[data-acao="proximo"]');
    const fimS = /Ver resultado/.test(await p.textContent('[data-acao="proximo"]'));
    await p.click('[data-acao="proximo"]');
    if (fimS) break;
  }
  const naReserva = vistos.filter((id) => reserva.has(id));
  const nReais = vistos.filter((id) => (QI.get(id) || {}).o).length;
  conferir('nenhum item da reserva no treino', !naReserva.length, naReserva.join(', '));
  conferir('pelo menos 1 real em cada 4', nReais >= Math.floor(vistos.length / 4), nReais + ' de ' + vistos.length);
  await ctx.close();
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await browser.close();
fim(erros);
