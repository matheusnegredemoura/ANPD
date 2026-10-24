// Desafio: quem acerta 80% ou mais dos autorais na primeira resposta recebe primeiro os itens inéditos do tipo de
// armadilha em que mais erra, contado à parte nos certos e nos errados, e com certos e errados intercalados. O perfil
// semeado tem 120 primeiras respostas autorais, com os 20 erros todos em itens errados de sujeito trocado (9% dos errados
// do banco): na sessão, eles passam a ser a maioria dos errados (o bloco sem inédito desse tipo traz outro).
import { APP, abrirNavegador, diaDeEstudo, placar, vigiarErros } from './comum.mjs';
import { montarDados } from '../build.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];

const d = montarDados();
const Q = new Map(d.questoes.map((q) => [q.id, q]));
const autorais = d.questoes.filter((q) => !q.o && !q.al && (q.g === 'C' || q.g === 'E'));
const sujeitoE = autorais.filter((q) => q.g === 'E' && q.a === 'sujeito');
const semente = { errados: sujeitoE.slice(0, 20).map((q) => q.id), certos: autorais.filter((q) => q.a !== 'sujeito').slice(0, 100).map((q) => q.id) };

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await diaDeEstudo(ctx);
await ctx.addInitScript((semente) => {
  if (sessionStorage.getItem('semeado')) return;
  sessionStorage.setItem('semeado', '1');
  const agora = new Date(), hoje = Math.round(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()) / 86400000);
  // Nada vence hoje: os acertos dominados voltam daqui a 30 dias, e os erros, daqui a 10 (fora da frente da sessão)
  const itens = {};
  for (const id of semente.certos) itens[id] = [3, hoje + 30, 1, 0, hoje - 2, 0, 0, 1];
  for (const id of semente.errados) itens[id] = [1, hoje + 10, 0, 1, hoje - 2, 0, 0, 0];
  const perfil = { xp: 0, meta: 30, novosCards: 20, intercaladas: 20, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: '2026-08-01' };
  localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
}, semente);
const p = await ctx.newPage();
p.setDefaultTimeout(8000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForSelector('.aba');
await p.waitForTimeout(500);

await passo('desafio: errados do tipo em que mais erra primeiro, certos e errados intercalados', async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="set-modo"][data-modo="treino"]');
  await p.click('[data-acao="comecar"]');
  await p.waitForSelector('#sessao:not([hidden])');
  const vistos = [];
  for (let i = 0; i < 20; i++) {
    if (!(await p.locator('#sessao .item-num').count())) break;
    vistos.push((await p.textContent('#sessao .item-num')).trim());
    if (await p.locator('button.alt').count()) await p.locator('button.alt').first().click(); else await p.click('.bolha.c');
    await p.waitForSelector('.veredito');
    if (!(await p.locator('[data-acao="proximo"]').count())) break;
    await p.click('[data-acao="proximo"]');
  }
  const novosAut = vistos.map((id) => Q.get(id)).filter((q) => q && !q.o && !q.al && (q.g === 'C' || q.g === 'E') && !semente.certos.includes(q.id) && !semente.errados.includes(q.id));
  const nE = novosAut.filter((q) => q.g === 'E'), nC = novosAut.length - nE.length;
  const sujeito = nE.filter((q) => q.a === 'sujeito').length;
  const base = Math.round(100 * sujeitoE.length / autorais.filter((q) => q.g === 'E').length);
  conferir('a sessão trouxe autorais inéditos', novosAut.length >= 8, novosAut.length + ' de ' + vistos.length);
  conferir('errados de sujeito trocado à frente', nE.length > 0 && sujeito / nE.length >= 0.5, sujeito + ' de ' + nE.length + ' (no banco, ' + base + '% dos errados) ' + nE.filter((q) => q.a !== 'sujeito').map((q) => q.id + ':' + q.a + ':' + q.b).join(' '));
  conferir('certos e errados intercalados', Math.abs(nC - nE.length) <= 2, nC + ' certos, ' + nE.length + ' errados');
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await browser.close();
fim(erros);
