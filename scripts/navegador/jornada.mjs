// Para encaixar e Jornada:
// - sessão do plano de dia anterior não concluída aparece em "Para encaixar" e pode ser dispensada;
// - as três missões do dia são cumpridas pelo que já foi feito no dia, e o baú abre com o XP somado;
// - acerto em item do bloco do chefão da semana tira 1 de vida, e a tela da resposta mostra o golpe;
// - o resultado da sessão mostra o que ela rendeu (golpes no chefão, domínio que subiu);
// - a sequência de dias não zera com uma folga por semana (de segunda a sábado), e domingo não quebra.
import { APP, abrirNavegador, placar, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];

const isoLocal = (dt) => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');

async function abrir(perfilExtra, pesquisa) {
  // As funções de semente viram texto dentro do script: addInitScript não serializa funções passadas como argumento
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx2.addInitScript(`(() => {
    if (sessionStorage.getItem('semeado')) return;
    sessionStorage.setItem('semeado', '1');
    const iso = ${isoLocal.toString()};
    const hoje = new Date();
    const perfil = Object.assign({ xp: 0, meta: 30, novosCards: 20, intercaladas: 30, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: iso(new Date(hoje - 6 * 864e5)), migr: { mesmoDia: '2026-09-01' } }, (${perfilExtra.toString()})(iso(hoje)));
    localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens: {}, cards: {}, simulados: [], pesquisa: (${pesquisa.toString()})(iso(hoje)), disc: {}, t: {} }));
  })();`);
  const p = await ctx2.newPage();
  p.setDefaultTimeout(5000);
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForTimeout(600);
  return { ctx: ctx2, p };
}
const salvo = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')));

await passo('sessões de dias anteriores aparecem em "Para encaixar" e podem ser dispensadas', async () => {
  const { ctx, p } = await abrir(() => ({}), () => ({}));
  const card = p.locator('.cartao.pendencias');
  if (!(await card.count())) throw new Error('card Para encaixar ausente');
  const n0 = await card.locator('.pend').count();
  if (!n0) throw new Error('nenhuma pendência listada');
  const total0 = Number((await card.locator('.secao-cab .mono').textContent()).trim());
  await card.locator('[data-acao="dispensar-dia"]').first().click();
  await p.waitForTimeout(200);
  const total1 = (await p.locator('.cartao.pendencias').count()) ? Number((await p.locator('.cartao.pendencias .secao-cab .mono').textContent()).trim()) : 0;
  if (total1 !== total0 - 1) throw new Error('dispensar não tirou a pendência: ' + total0 + ' → ' + total1);
  await ctx.close();
});

await passo('missões cumpridas pelo que já foi feito no dia abrem o baú', async () => {
  const { ctx, p } = await abrir((h) => ({ dias: { [h]: { r: 70, c: 63, e: 7, b: 0, xp: 0, k: 25, n: 0, a: ['lgpd:5', 'lgpd:6', 'lgpd:7', 'lgpd:8', 'lgpd:9'], ni: 25, cmb: 12, pd: 1, rl: 1, cg: 5, t: { q: 4000 } } } }),
    (h) => ({ 'tema teste': { t: 'Tema teste', o: 'teste', s: 1, d: h, f: h } }));
  const ok = await p.locator('.cartao.jornada .missao.ok').count();
  if (ok !== 3) throw new Error(ok + ' missões cumpridas (esperado 3)');
  const cab = (await p.textContent('.cartao.jornada .secao-cab .mono')).trim();
  if (!/baú aberto/.test(cab)) throw new Error('baú não abriu: ' + cab);
  const d = await salvo(p);
  const h = isoLocal(new Date());
  const m = d.perfil.rpg.m[h];
  if (!m || !m.bau || Object.keys(m.ok).length !== 3) throw new Error('estado das missões: ' + JSON.stringify(m));
  if (!(d.perfil.xp >= 50 + 3 * 30)) throw new Error('XP não somado: ' + d.perfil.xp);
  await ctx.close();
});

await passo('acerto em item do bloco do chefão tira 1 de vida', async () => {
  const { ctx, p } = await abrir(() => ({}), () => ({}));
  const vida0 = (await p.textContent('.chefe .chefe-cab .mono')).trim();
  if (!/^15\/15/.test(vida0)) throw new Error('vida inicial: ' + vida0);
  await p.click('[data-acao="enfrentar-chefe"]');
  await p.waitForSelector('#sessao:not([hidden])');
  let acertou = false;
  for (let i = 0; i < 15 && !acertou; i++) {
    if (await p.locator('button.alt').count()) await p.locator('button.alt').first().click(); else await p.click('.bolha.c');
    await p.waitForSelector('.veredito');
    acertou = (await p.locator('.veredito.ok').count()) > 0;
    if (!acertou) await p.click('[data-acao="proximo"]');
  }
  if (!acertou) throw new Error('nenhum acerto em 15 itens');
  const c = (await salvo(p)).perfil.rpg.chefe;
  if (c.vida !== 14) throw new Error('vida depois de um acerto: ' + c.vida);
  const golpe = (await p.textContent('.extra-resp.golpe')) || '';
  if (!/14\/15/.test(golpe)) throw new Error('golpe não aparece na resposta: ' + golpe);
  // Vai até o resultado: o cartão do que a sessão rendeu conta o golpe
  for (let i = 0; i < 20 && !(await p.locator('.cartao.ganhos').count()); i++) {
    if (!(await p.locator('.veredito').count())) {
      if (await p.locator('button.alt').count()) await p.locator('button.alt').first().click(); else await p.click('.bolha.c');
    }
    await p.click('[data-acao="proximo"]');
  }
  await p.waitForSelector('.cartao.ganhos');
  const ganhos = await p.textContent('.cartao.ganhos');
  if (!/golpe/.test(ganhos)) throw new Error('resultado sem o golpe no chefão: ' + ganhos);
  await ctx.close();
});

await passo('uma folga por semana não zera a sequência', async () => {
  // Sábado, 17/10/2026. Estudou seg 12, ter 13, qui 15 e sex 16 (folga na quarta 14); na semana anterior, qui 08, sex 09
  // e sáb 10 (folga na quarta 07); domingo 11 não quebra. A terça 06 é a segunda falta daquela semana e encerra a conta.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.clock.install({ time: new Date('2026-10-17T10:00:00') });
  const dia = { r: 20, c: 15, e: 5, b: 0, xp: 0, k: 0, n: 0, a: [] };
  const dias = {};
  for (const d of ['2026-10-05', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-12', '2026-10-13', '2026-10-15', '2026-10-16']) dias[d] = dia;
  await ctx.addInitScript((dias) => {
    if (sessionStorage.getItem('semeado')) return;
    sessionStorage.setItem('semeado', '1');
    const perfil = { xp: 0, meta: 30, novosCards: 20, intercaladas: 30, melhorSeq: 0, dias, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: '2026-10-01', migr: { mesmoDia: '2026-09-01' } };
    localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
  }, dias);
  const p = await ctx.newPage();
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForTimeout(600);
  const seq = (await p.textContent('.pilula.fogo')).trim();
  if (seq !== '7') throw new Error('sequência: ' + seq + ' (esperado 7)');
  await ctx.close();
});

await browser.close();
conferir('sem erro de página', !erros.length, erros.join(' | '));
fim();
