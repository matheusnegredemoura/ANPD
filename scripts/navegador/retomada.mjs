// Nenhuma sessão recomeça do zero: simulado com marcações e tempo, itens reais como prova, treino por artigo pela
// mesma porta, e a sessão guardada num aparelho continuando em outro (conta simulada compartilhada entre os dois).
import { APP, abrirNavegador, foto, placar, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];

// Conta simulada: os documentos ficam no Node e valem para qualquer página que use esta função
const conta = {};
async function aparelho(nome) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.exposeFunction('__contaLer', (n) => conta[n] || null);
  await ctx.exposeFunction('__contaGravar', (n, v) => { conta[n] = v; });
  await ctx.addInitScript(() => {
    const doc = (n) => ({
      get: async () => { const d = await window.__contaLer(n); return { exists: !!d, data: () => d }; },
      set: async (v) => { await window.__contaGravar(n, JSON.parse(JSON.stringify(v))); },
      onSnapshot: () => () => {},
    });
    const vazio = { get: async () => ({ docs: [] }), where: () => vazio, doc };
    window.claude = { use: async (x) => (x === 'db' ? { collection: () => vazio } : x === 'user' ? { id: async () => 'u1', isOwner: async () => true } : null) };
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(5000);
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForTimeout(800);
  p.nome = nome;
  return p;
}
const cab = async (p) => (await p.textContent('.sessao-topo .tit span')).trim();
const sair = async (p) => { await p.click('[data-acao="sair-sessao"]'); if (await p.locator('[data-acao="confirmar-saida"]').count()) await p.click('[data-acao="confirmar-saida"]'); await p.waitForTimeout(300); };

const a = await aparelho('A');

await passo('simulado: marcações e tempo sobrevivem a recarregar a página', async () => {
  await a.click('.aba[data-vista="questoes"]');
  await a.click('[data-acao="set-modo"][data-modo="simulado"]');
  await a.click('[data-acao="set-prova"][data-prova="prova"]');
  await a.click('[data-acao="set-n"][data-n="30"]');
  await a.click('[data-acao="comecar"]');
  await a.waitForSelector('#sessao:not([hidden])');
  const marcas = ['c', 'e', 'c', 'c', 'e'];
  for (const m of marcas) await a.click('.bolha.' + m);
  await a.waitForTimeout(1500);
  await a.reload();
  await a.waitForTimeout(800);
  conferir('a aba em que a pessoa estava já mostra a sessão guardada', (await a.locator('.vista:not([hidden]) [data-acao="retomar-pausa"]').count()) === 1);
  await a.click('.aba[data-vista="hoje"]');
  const lista = await a.locator('#vista-hoje [data-acao="retomar-pausa"]').count();
  if (!lista) throw new Error('Hoje não mostra a sessão guardada');
  const txt = (await a.textContent('#vista-hoje .pausa-linha')).replace(/\s+/g, ' ');
  if (!/5 de 30 marcados/.test(txt)) throw new Error('resumo inesperado: ' + txt);
  await a.locator('#vista-hoje [data-acao="retomar-pausa"]').first().click();
  await a.waitForSelector('#sessao:not([hidden])');
  const c = await cab(a);
  if (!/^Item 6 de 30/.test(c)) throw new Error('não voltou ao item 6: ' + c);
  const marcados = await a.locator('.tira i.C, .tira i.E, .tira i.R').count();
  await a.screenshot({ path: foto('retomada-simulado.png') });
  if (marcados !== 5) throw new Error('marcações na folha: ' + marcados + ' (esperava 5)');
  await a.click('.bolha.c');
  await sair(a);
});

await passo('simulado: o relógio para enquanto a sessão está guardada', async () => {
  const antes = await a.evaluate(() => { const p = Object.values(JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.pausas).find((x) => x.modo === 'simulado'); return p.gasto; });
  await a.waitForTimeout(2500);
  await a.click('.aba[data-vista="questoes"]');
  await a.locator('#vista-questoes [data-acao="retomar-pausa"]').first().click();
  await a.waitForSelector('#sessao:not([hidden])');
  const rel = (await a.textContent('#relogio')).trim();
  const [mm, ss] = rel.split(':').map(Number);
  const resta = mm * 60 + ss, limite = 45 * 60;
  if (limite - resta > antes + 2) throw new Error('o relógio andou durante a pausa: ' + rel + ' (gasto antes ' + antes + ' s)');
  await sair(a);
});

await passo('simulado: descartar apaga a sessão guardada', async () => {
  await a.click('.aba[data-vista="questoes"]');
  await a.locator('#vista-questoes [data-acao="retomar-pausa"]').first().click();
  await a.waitForSelector('#sessao:not([hidden])');
  await a.click('[data-acao="sair-sessao"]');
  await a.click('[data-acao="sair-descartar"]');
  await a.waitForTimeout(300);
  await a.click('.aba[data-vista="questoes"]');
  if (await a.locator('#vista-questoes [data-acao="retomar-pausa"]').count()) throw new Error('a sessão continuou guardada');
});

await passo('itens reais como prova: o mesmo botão continua', async () => {
  await a.click('.aba[data-vista="questoes"]');
  await a.click('[data-acao="reais"][data-modo="simulado"]');
  await a.waitForSelector('#sessao:not([hidden])');
  for (let i = 0; i < 3; i++) await a.keyboard.press((await a.locator('button.alt').count()) ? 'a' : 'c');
  await sair(a);
  await a.click('.aba[data-vista="questoes"]');
  await a.click('[data-acao="reais"][data-modo="simulado"]');
  await a.waitForSelector('#sessao:not([hidden])');
  const c = await cab(a);
  if (!/^Item 4 de/.test(c)) throw new Error('recomeçou: ' + c);
  await sair(a);
});

await passo('treino de um artigo na lei seca: o mesmo botão continua', async () => {
  await a.click('.aba[data-vista="lei"]');
  await a.click('[data-acao="ranking"]');
  await a.locator('.ranking button').first().click();
  await a.waitForSelector('[data-acao="treinar-art"]');
  await a.locator('[data-acao="treinar-art"]').first().click();
  await a.waitForSelector('#sessao:not([hidden])');
  const total = Number(/de (\d+)/.exec(await cab(a))[1]);
  if (total < 3) return;
  for (let i = 0; i < 2; i++) {
    if (await a.locator('button.alt').count()) await a.locator('button.alt').first().click(); else await a.click('.bolha.c');
    await a.waitForSelector('.veredito');
    await a.click('[data-acao="proximo"]');
  }
  await sair(a);
  await a.click('.aba[data-vista="lei"]');
  await a.locator('[data-acao="treinar-art"]').first().click();
  await a.waitForSelector('#sessao:not([hidden])');
  const c = await cab(a);
  if (!/^Item 3 de/.test(c)) throw new Error('recomeçou: ' + c);
  await sair(a);
});

await passo('sessão do dia guardada no aparelho A continua no aparelho B', async () => {
  await a.click('.aba[data-vista="hoje"]');
  const botao = a.locator('#vista-hoje [data-acao="iniciar-dia"]').first();
  if (!(await botao.count())) return;
  await botao.click();
  await a.waitForSelector('#sessao:not([hidden])');
  const total = Number(/de (\d+)/.exec(await cab(a))[1]);
  for (let i = 0; i < 2; i++) {
    if (await a.locator('button.alt').count()) await a.locator('button.alt').first().click(); else await a.click('.bolha.c');
    await a.waitForSelector('.veredito');
    await a.click('[data-acao="proximo"]');
  }
  await sair(a);
  await a.waitForTimeout(2000);
  const b = await aparelho('B');
  await b.waitForTimeout(1000);
  const rotulo = (await b.locator('#vista-hoje [data-acao="iniciar-dia"]').first().textContent()).trim();
  conferir('aparelho B mostra Continuar', rotulo.startsWith('Continuar · faltam ' + (total - 2) + ' de ' + total), rotulo);
  await b.locator('#vista-hoje [data-acao="iniciar-dia"]').first().click();
  await b.waitForSelector('#sessao:not([hidden])');
  const c = await cab(b);
  if (!c.startsWith('Item 3 de ' + total)) throw new Error('aparelho B recomeçou: ' + c);
});

await browser.close();
fim(erros);
