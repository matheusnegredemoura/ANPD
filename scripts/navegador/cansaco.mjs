// Avaliador de cansaço: com 45 itens já respondidos hoje e acerto habitual de 80% (retenção de 90% na revisão), errar
// em sequência itens que você já sabia acende o aviso quando os lapsos chegam a 30% dos itens sabidos entre os 20
// últimos (o sexto erro), e não antes; o item do aviso fica guardado no dia.
import { APP, abrirNavegador, diaDeEstudo, placar, vigiarErros } from './comum.mjs';
import { montarDados } from '../build.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];

const d = montarDados();
const GAB = new Map(d.questoes.map((q) => [q.id, q.g]));
const sabidos = d.questoes.filter((q) => !q.o && !q.al && (q.g === 'C' || q.g === 'E')).slice(0, 30).map((q) => q.id);

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await diaDeEstudo(ctx);
await ctx.addInitScript((sabidos) => {
  if (sessionStorage.getItem('semeado')) return;
  sessionStorage.setItem('semeado', '1');
  const agora = new Date(), hoje = Math.round(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()) / 86400000);
  const iso = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
  const itens = {};
  for (const id of sabidos) itens[id] = [4, hoje, 3, 0, hoje - 10, 0, 0, 1];
  const dias = {};
  for (let k = 1; k <= 6; k++) dias[iso(hoje - k)] = { r: 100, c: 80, e: 20, b: 0, xp: 0, k: 0, n: 0, a: [], t: {}, m: 30, mc: 27 };
  dias[iso(hoje)] = { r: 45, c: 40, e: 5, b: 0, xp: 0, k: 0, n: 0, a: [], t: {}, sq: 'k'.repeat(20) };
  const perfil = { xp: 0, meta: 30, novosCards: 20, intercaladas: 20, melhorSeq: 0, dias, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: iso(hoje - 20) };
  localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
}, sabidos);
const p = await ctx.newPage();
p.setDefaultTimeout(8000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForSelector('.aba');
await p.waitForTimeout(500);

await passo('errar o que já sabia acende o aviso de cansaço no sexto lapso', async () => {
  await p.click('[data-acao="iniciar-revisao"]');
  await p.waitForSelector('#sessao:not([hidden])');
  const avisos = [];
  for (let i = 0; i < 6; i++) {
    const id = (await p.textContent('#sessao .item-num')).trim();
    if (!sabidos.includes(id)) throw new Error('item fora da semente: ' + id);
    await p.click(GAB.get(id) === 'C' ? '.bolha.e' : '.bolha.c');
    await p.waitForSelector('.veredito');
    avisos.push(await p.locator('.cartao.cansaco').count());
    if (i < 5) await p.click('[data-acao="proximo"]');
  }
  conferir('sem aviso até o quinto lapso', avisos.slice(0, 5).every((x) => !x), avisos.join(','));
  conferir('aviso no sexto lapso', avisos[5] === 1, avisos.join(','));
  const txt = ((await p.textContent('.cartao.cansaco').catch(() => '')) || '').replace(/\s+/g, ' ');
  conferir('o aviso diz quantos itens e quantos lapsos', /51 itens hoje/.test(txt) && /6 erros em itens que você já sabia/.test(txt), txt.slice(0, 200));
  const cz = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('painel-anpd-v3')); const h = Object.keys(s.perfil.dias).sort().pop(); return s.perfil.dias[h].cz; });
  conferir('o item do aviso fica guardado no dia', JSON.stringify(cz) === '[51]', JSON.stringify(cz));
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await browser.close();
fim(erros);
