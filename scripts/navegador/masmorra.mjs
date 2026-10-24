// Masmorra da semana: com só o bloco dos arts. 17 a 22 da LGPD praticado, ele é o do chefão e a masmorra tem um andar
// por artigo; os andares sem erro já contam como limpos. O primeiro andar tem um erro pendente e é o próximo a descer;
// acertar os itens dele limpa o andar e dá o XP do andar.
import { APP, abrirNavegador, diaDeEstudo, placar, vigiarErros } from './comum.mjs';
import { montarDados } from '../build.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const Q = montarDados().questoes;
const bloco = Q.filter((q) => q.b === 'lgpd-17-22' && q.art && q.l === 'lgpd');
const primeiro = String(Math.min(...bloco.map((q) => parseInt(q.art, 10))));
const doAndar = bloco.filter((q) => q.art === primeiro);
const gab = new Map(Q.map((q) => [q.id, q.g]));

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await diaDeEstudo(ctx);
await ctx.addInitScript(({ ids, pend }) => {
  if (sessionStorage.getItem('semeado')) return;
  sessionStorage.setItem('semeado', '1');
  const agora = new Date(), hoje = Math.round(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()) / 86400000);
  const itens = {};
  ids.forEach((id) => { itens[id] = id === pend ? [0, hoje - 1, 0, 1, hoje - 2, 0, 0] : [1, hoje + 5, 1, 0, hoje - 2, 0, 0]; });
  const iso = new Date(hoje * 86400000).toISOString().slice(0, 10);
  const perfil = { xp: 0, meta: 30, novosCards: 5, intercaladas: 20, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: iso };
  localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
}, { ids: bloco.map((q) => q.id), pend: doAndar[0].id });
const p = await ctx.newPage();
p.setDefaultTimeout(8000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(600);

await passo('a Jornada mostra a masmorra com o primeiro andar por limpar', async () => {
  const t = (await p.textContent('.masmorra')).replace(/\s+/g, ' ');
  if (!/Masmorra da semana/.test(t) || !/\d+\/\d+ andares/.test(t)) throw new Error('masmorra: ' + t);
  conferir('o próximo andar é o do erro pendente', new RegExp('Próximo andar: Art\\. ' + primeiro + '\\D[^·]*· 1 erro pendente').test(t), t.slice(0, 160));
});

await passo('descer e acertar os itens do andar limpa o andar', async () => {
  await p.click('.masmorra [data-acao="treinar-art"]');
  await p.waitForSelector('#sessao:not([hidden])');
  for (let k = 0; k < 200; k++) {
    if (!(await p.locator('#sessao:not([hidden]) .item .item-num').count())) break;
    const id = (await p.textContent('.item .item-num')).trim();
    const g = gab.get(id);
    if (await p.locator('button.alt').count()) await p.locator('button.alt').nth('ABCDE'.indexOf(g)).click(); else await p.click('.bolha.' + g.toLowerCase());
    await p.waitForSelector('[data-acao="proximo"]');
    const fimSessao = /Ver resultado/.test(await p.textContent('[data-acao="proximo"]'));
    await p.click('[data-acao="proximo"]');
    if (fimSessao) break;
  }
  const r = await p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.rpg);
  conferir('andar registrado como limpo', r.masm && r.masm.ok.includes(primeiro), JSON.stringify(r.masm));
  conferir('contador de andares', r.andares === 1, String(r.andares));
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await browser.close();
fim(erros);
