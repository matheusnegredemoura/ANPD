// Recarregar antes de a conta receber a última gravação (o envio à conta espera 1,2 s) não pode apagar o que ficou
// no navegador. Na volta, a conta está velha e a primeira notificação do onSnapshot traz essa cópia velha, gravada
// por "outro aparelho" (o identificador do aparelho muda a cada abertura): o painel tem de juntar, e não adotá-la.
import { APP, abrirNavegador, diaDeEstudo, placar } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const agora = Date.now();

async function cenario(atrasoSnapshot) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await diaDeEstudo(ctx);
  await ctx.addInitScript(({ agora, atrasoSnapshot }) => {
    if (!sessionStorage.getItem('semeado')) {
      sessionStorage.setItem('semeado', '1');
      localStorage.clear();
      // No navegador: os dois dias recuperados, gravados há pouco (a conta não chegou a recebê-los)
      localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil: { xp: 120, dias: {}, recuperados: { '2026-10-12': 1, '2026-10-13': 1 } }, itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: { perfil: agora - 2000 } }));
    }
    const velho = { dev: 'aparelho-de-antes', t: agora - 60000, v: 3, ep: 0, dados: { xp: 120, dias: {} } };
    window.__nuvem = { perfil: JSON.parse(JSON.stringify(velho.dados)) };
    const doc = (n) => ({
      get: async () => (n === 'perfil' ? { exists: true, data: () => JSON.parse(JSON.stringify(velho)) } : { exists: false, data: () => null }),
      set: async (v) => { window.__nuvem[n] = JSON.parse(JSON.stringify(v.dados)); },
      // A primeira notificação chega depois da carga, com a cópia velha da conta
      onSnapshot: (cb) => { if (n === 'perfil') setTimeout(() => cb({ exists: true, data: () => JSON.parse(JSON.stringify(velho)) }), atrasoSnapshot); return () => {}; },
    });
    const vazio = { get: async () => ({ docs: [] }), where: () => vazio, doc };
    window.claude = { use: async (nome) => (nome === 'db' ? { collection: () => vazio } : nome === 'user' ? { id: async () => 'u1' } : null) };
  }, { agora, atrasoSnapshot });
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  await p.goto(APP);
  await p.waitForTimeout(atrasoSnapshot + 2500);
  const r = await p.evaluate(() => ({ local: JSON.parse(localStorage.getItem('painel-anpd-v3') || 'null'), nuvem: window.__nuvem }));
  await ctx.close();
  return { r, erros };
}

for (const atraso of [300, 2000]) {
  await passo('cópia velha da conta chegando ' + atraso + ' ms depois da carga', async () => {
    const { r, erros } = await cenario(atraso);
    const recLocal = (r.local && r.local.perfil && r.local.perfil.recuperados) || {};
    const recNuvem = (r.nuvem.perfil && r.nuvem.perfil.recuperados) || {};
    conferir('o navegador mantém os dias recuperados', recLocal['2026-10-12'] === 1 && recLocal['2026-10-13'] === 1, JSON.stringify(recLocal));
    conferir('a conta recebe os dias recuperados', recNuvem['2026-10-12'] === 1 && recNuvem['2026-10-13'] === 1, JSON.stringify(recNuvem));
    conferir('sem erro de página', !erros.length, erros.join(' | '));
  });
}

await browser.close();
fim([]);
