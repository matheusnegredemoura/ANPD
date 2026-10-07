// Revisão adaptativa: com o histórico de revisões de manutenção semeado no navegador, o prazo gravado depois de um
// acerto seguro de primeira deve seguir a calibração pela retenção medida (16 dias sem calibração, mais com retenção
// alta, menos com retenção baixa).
import { APP, abrirNavegador, placar, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];

function perfil(dias) {
  return { xp: 0, meta: 30, novosCards: 20, intercaladas: 30, melhorSeq: 0, dias, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: '2026-08-01', migr: { mesmoDia: '2026-09-01' } };
}
// Prazo, em dias, do primeiro acerto de primeira numa sessão de treino, com m revisões de manutenção no prazo (mc certas)
// ontem
async function prazoDoAcerto(m, mc, noPrazo = true) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(`window.__perfil = ${perfil.toString()};`);
  await ctx.addInitScript(({ m, mc, noPrazo }) => {
    if (sessionStorage.getItem('semeado')) return;
    sessionStorage.setItem('semeado', '1');
    const ontem = new Date(Date.now() - 86400e3);
    const iso = ontem.getFullYear() + '-' + String(ontem.getMonth() + 1).padStart(2, '0') + '-' + String(ontem.getDate()).padStart(2, '0');
    const dias = m ? { [iso]: { r: m, c: mc, e: m - mc, b: 0, xp: 0, k: 0, n: 0, a: [], m, mc, mp: noPrazo ? m : 0, mpc: noPrazo ? mc : 0 } } : {};
    localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil: window.__perfil(dias), itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
  }, { m, mc, noPrazo });
  const p = await ctx.newPage();
  p.setDefaultTimeout(5000);
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForTimeout(500);
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="set-modo"][data-modo="treino"]');
  await p.click('[data-acao="comecar"]');
  await p.waitForSelector('#sessao:not([hidden])');
  for (let i = 0; i < 20; i++) {
    const id = (await p.textContent('#sessao .item-num')).trim();
    if (await p.locator('button.alt').count()) await p.locator('button.alt').first().click(); else await p.click('.bolha.c');
    await p.waitForSelector('.veredito');
    if (await p.locator('.veredito.ok').count()) {
      const r = await p.evaluate((id) => JSON.parse(localStorage.getItem('painel-anpd-v3')).itens[id], id);
      await ctx.close();
      return r[1] - r[4];
    }
    await p.click('[data-acao="proximo"]');
  }
  await ctx.close();
  throw new Error('nenhum acerto em 20 itens');
}

await passo('sem calibração, acerto seguro de primeira volta em 16 dias', async () => { const d = await prazoDoAcerto(0, 0); if (d !== 16) throw new Error(d + ' dias'); });
await passo('retenção medida de 100% alonga o prazo em 50% (24 dias)', async () => { const d = await prazoDoAcerto(40, 40); if (d !== 24) throw new Error(d + ' dias'); });
await passo('retenção medida de 70% encurta o prazo em 30% (11 dias)', async () => { const d = await prazoDoAcerto(40, 28); if (d !== 11) throw new Error(d + ' dias'); });
await passo('menos de 20 revisões medidas não calibra (16 dias)', async () => { const d = await prazoDoAcerto(10, 10); if (d !== 16) throw new Error(d + ' dias'); });
await passo('revisões atrasadas não calibram: 40 feitas, nenhuma no prazo (16 dias)', async () => { const d = await prazoDoAcerto(40, 28, false); if (d !== 16) throw new Error(d + ' dias'); });

await browser.close();
conferir('sem erro de página', !erros.length, erros.join(' | '));
fim();
