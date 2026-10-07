// Lista curta e relógio de estudo:
// - a revisão traz só o que venceu hoje; o que já foi revisto hoje (ou vence depois) não volta na revisão seguinte;
// - item de interpretação de texto (português e inglês) errado não entra na lista curta;
// - o relógio do dia conta o tempo em uso por atividade e pausa quando o app fica parado.
import { APP, abrirNavegador, placar, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];

function perfil() {
  return { xp: 0, meta: 30, novosCards: 20, intercaladas: 30, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: '2026-08-01', migr: { mesmoDia: '2026-09-01' } };
}
// itens: { id: [nível, vence em (dias a partir de hoje), acertos, erros, último dia (dias a partir de hoje)] }
async function abrir(itens, comRelogio) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  if (comRelogio) await p.clock.install();
  await ctx.addInitScript(`window.__perfil = ${perfil.toString()};`);
  await ctx.addInitScript((itens) => {
    if (sessionStorage.getItem('semeado')) return;
    sessionStorage.setItem('semeado', '1');
    const d = new Date();
    const hoje = Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    const it = {};
    for (const [id, [nv, vence, ac, er, ult]] of Object.entries(itens)) it[id] = [nv, hoje + vence, ac, er, hoje + ult, 0, 0, 0];
    localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil: window.__perfil(), itens: it, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
  }, itens);
  p.setDefaultTimeout(5000);
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForTimeout(500);
  return { ctx, p };
}
const salvo = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')));

await passo('revisão traz só o vencido e não repete o que já foi revisto hoje', async () => {
  // A venceu hoje; B foi revisto hoje e volta amanhã; C volta em 2 dias
  const { ctx, p } = await abrir({ 'lgpd-17-01': [0, 0, 0, 1, -1], 'lgpd-21-01': [1, 1, 1, 1, 0], 'lgpd-22-01': [2, 2, 2, 1, -1] });
  const botao = p.locator('[data-acao="iniciar-revisao"]');
  if ((await botao.textContent()).trim() !== 'Questões (1)') throw new Error('botão: ' + (await botao.textContent()));
  await botao.click();
  await p.waitForSelector('#sessao:not([hidden])');
  const tit = (await p.textContent('#sessao .sessao-topo .tit span')).trim();
  if (!/^Item 1 de 1\b/.test(tit)) throw new Error('revisão com mais de um item: ' + tit);
  await p.click('.bolha.c');
  await p.waitForSelector('.veredito');
  await p.click('[data-acao="proximo"]');
  if (await p.locator('[data-acao="fechar-sessao"]').count()) await p.click('[data-acao="fechar-sessao"]');
  await p.click('.aba[data-vista="hoje"]');
  if (await p.locator('[data-acao="iniciar-revisao"]').count()) throw new Error('revisão ainda oferecida depois de rever o único item vencido');
  await ctx.close();
});

await passo('erro em interpretação de texto não entra na lista curta', async () => {
  const { ctx, p } = await abrir({ 'pt9-01': [0, 0, 0, 1, 0], 'lgpd-17-01': [0, 0, 0, 1, 0] });
  const t = (await p.locator('[data-acao="iniciar-revisao"]').textContent()).trim();
  if (t !== 'Questões (1)') throw new Error('botão: ' + t + ' (o item de texto não deveria contar)');
  await ctx.close();
});

await passo('relógio do dia conta o tempo de questões e pausa quando o app fica parado', async () => {
  const { ctx, p } = await abrir({}, true);
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="set-modo"][data-modo="treino"]');
  await p.click('[data-acao="comecar"]');
  await p.waitForSelector('#sessao:not([hidden])');
  for (let i = 0; i < 4; i++) { await p.mouse.click(5, 300); await p.clock.runFor(15000); }
  const hoje = await p.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  const t1 = ((await salvo(p)).perfil.dias[hoje] || {}).t || {};
  if (!(t1.q >= 45 && t1.q <= 75)) throw new Error('tempo de questões depois de 1 min em uso: ' + JSON.stringify(t1));
  // Dez minutos sem tocar: no máximo os 3 min de tolerância (mais um tique) entram na conta
  await p.clock.runFor(600000);
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const t2 = ((await salvo(p)).perfil.dias[hoje] || {}).t || {};
  if (!(t2.q - t1.q <= 210)) throw new Error('relógio não pausou parado: ' + JSON.stringify(t2));
  await p.click('[data-acao="sair-sessao"]');
  if (await p.locator('[data-acao="confirmar-saida"]').count()) await p.click('[data-acao="confirmar-saida"]');
  await p.click('.aba[data-vista="hoje"]');
  const txt = (await p.textContent('#tempo-hoje')).trim();
  if (!/min|h/.test(txt)) throw new Error('cartão de tempo sem total: ' + txt);
  await ctx.close();
});

await browser.close();
conferir('sem erro de página', !erros.length, erros.join(' | '));
fim();
