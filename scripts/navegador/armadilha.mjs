// Treino por armadilha: com um histórico em que a pessoa erra itens de "texto literal" e acerta os de "rol", o
// cartão Onde você cai do Progresso oferece treinar a armadilha que mais derruba, e a sessão traz só itens dela.
import { APP, abrirNavegador, foto, placar, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  if (sessionStorage.getItem('semeado')) return;
  sessionStorage.setItem('semeado', '1');
  const hoje = Math.round(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) / 86400000);
  const perfil = { xp: 0, meta: 30, novosCards: 20, intercaladas: 30, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: '2026-08-01', migr: { mesmoDia: '2026-09-01' } };
  // ae-04 e ae-06 são de texto literal (três erros cada); ae-01 e ae-09, de rol (só acertos)
  const itens = { 'ae-04': [0, hoje + 1, 0, 3, hoje - 1, 0, 0, 0], 'ae-06': [0, hoje + 1, 0, 3, hoje - 1, 0, 0, 0], 'ae-01': [4, hoje + 16, 3, 0, hoje - 1, 0, 0, 1], 'ae-09': [4, hoje + 16, 3, 0, hoje - 1, 0, 0, 1] };
  localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
});
const p = await ctx.newPage();
p.setDefaultTimeout(5000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(500);

await passo('Onde você cai oferece treinar a armadilha que mais derruba', async () => {
  await p.click('.aba[data-vista="mais"]');
  await p.click('.menu-mais [data-sub="progresso"]');
  const b = p.locator('[data-acao="treinar-arm"]').first();
  await b.scrollIntoViewIfNeeded();
  await p.screenshot({ path: foto('armadilha-progresso.png'), fullPage: false });
  const a = await b.getAttribute('data-a');
  if (a !== 'literal') throw new Error('primeiro botão: ' + a);
  if ((await p.locator('[data-acao="treinar-arm"][data-a="rol"]').count()) !== 0) throw new Error('ofereceu treinar armadilha sem erro');
});
await passo('a sessão traz só itens de texto literal', async () => {
  await p.click('[data-acao="treinar-arm"][data-a="literal"]');
  await p.waitForSelector('#sessao:not([hidden])');
  const titulo = await p.textContent('#sessao .tit b');
  if (!/Armadilha · Texto literal/.test(titulo)) throw new Error('título: ' + titulo);
  for (let i = 0; i < 3; i++) {
    if (await p.locator('button.alt').count()) await p.locator('button.alt').first().click(); else await p.click('.bolha.c');
    await p.waitForSelector('.explica');
    const ex = await p.textContent('.explica .gab');
    if (!/armadilha: Texto literal/.test(ex)) throw new Error('item de outra armadilha: ' + ex);
    await p.click('[data-acao="proximo"]');
  }
});

await browser.close();
conferir('sem erro de página', !erros.length, erros.join(' | '));
fim();
