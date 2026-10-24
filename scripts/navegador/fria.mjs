// Leitura fria e lacuna digitada. O artigo lido num dia anterior abre sem grifos, sem português claro e sem glossário,
// com um botão para conferir; o lido hoje abre normal. No card de prazo, digitar o número errado bloqueia Bom e Fácil.
import { APP, abrirNavegador, diaDeEstudo, placar, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await diaDeEstudo(ctx);
await ctx.addInitScript(() => {
  if (sessionStorage.getItem('semeado')) return;
  sessionStorage.setItem('semeado', '1');
  const agora = new Date(), hoje = Math.round(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()) / 86400000);
  const ontem = new Date((hoje - 3) * 86400000).toISOString().slice(0, 10);
  const lidos = {};
  const perfil = { xp: 0, meta: 30, novosCards: 20, intercaladas: 20, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos, saidos: 0, criado: ontem };
  localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
});
const p = await ctx.newPage();
p.setDefaultTimeout(8000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForSelector('.aba');
await p.waitForTimeout(600);

const abrirPrimeiro = async () => {
  await p.click('.aba[data-vista="lei"]');
  if (!(await p.locator('.ranking button').count())) await p.click('[data-acao="ranking"]');
  await p.locator('.ranking button').first().click();
  await p.waitForSelector('#vista-lei .texto-lei');
};

await passo('artigo lido hoje abre normal; lido em outro dia abre em leitura fria', async () => {
  await abrirPrimeiro();
  conferir('lido hoje: sem leitura fria', !(await p.locator('.cartao.fria').count()));
  const k = await p.evaluate(() => { const l = JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.lidos; return Object.keys(l).find((x) => l[x] === Object.values(l).sort().pop()); });
  // O app grava o estado ao sair da página (pagehide); sem bloquear essa gravação, o reload desfaria a data trocada aqui
  await p.evaluate((k) => { const s = JSON.parse(localStorage.getItem('painel-anpd-v3')); s.perfil.lidos[k] = '2026-01-02'; localStorage.setItem('painel-anpd-v3', JSON.stringify(s)); Storage.prototype.setItem = () => {}; }, k);
  await p.reload();
  // Com a bateria em paralelo o app demora mais a abrir: espera a barra de abas antes de navegar
  await p.waitForSelector('.aba');
  await p.waitForTimeout(600);
  // O mesmo artigo (o ranking pode mudar de ordem depois da leitura)
  await p.click('.aba[data-vista="lei"]');
  if (!(await p.locator('.ranking button').count())) await p.click('[data-acao="ranking"]');
  await p.click('.ranking button[data-art="' + k + '"]');
  await p.waitForSelector('.cartao.fria');
  conferir('português claro escondido', !(await p.locator('.fria .claro').isVisible().catch(() => false)));
  await p.click('[data-acao="conferir-fria"]');
  conferir('conferir tira a leitura fria', !(await p.locator('.cartao.fria').count()));
});

await passo('card de prazo: número errado digitado bloqueia Bom e Fácil', async () => {
  await p.click('.aba[data-vista="cards"]');
  await p.click('[data-acao="cards-iniciar"]');
  await p.waitForSelector('#sessao:not([hidden])');
  let achou = false;
  for (let k = 0; k < 25 && !achou; k++) {
    if (await p.locator('#card-digitar').count()) { achou = true; break; }
    await p.click('[data-acao="revelar"]');
    await p.click('[data-acao="avaliar"][data-n="3"]');
  }
  if (!achou) throw new Error('nenhum card de número nos primeiros 25');
  await p.fill('#card-digitar', '987654');
  await p.press('#card-digitar', 'Enter');
  await p.waitForSelector('.digitado.no');
  conferir('Bom bloqueado', await p.locator('[data-acao="avaliar"][data-n="3"]').isDisabled());
  conferir('Fácil bloqueado', await p.locator('[data-acao="avaliar"][data-n="4"]').isDisabled());
  await p.keyboard.press('4');
  conferir('tecla 4 não avalia', await p.locator('.digitado.no').count() === 1);
  await p.click('[data-acao="avaliar"][data-n="1"]');
  conferir('Errei avalia e segue', !(await p.locator('.digitado').count()));
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await browser.close();
fim(erros);
