// Conquistas e níveis: um perfil já avançado (35 dias de estudo, simulados, discursivas, chefões, baús, inventário
// completo, itens reais e difíceis dominados) responde um item e destrava, de uma vez, o que os números permitem e
// nada além disso. Confere também o nível 30 (Especialista em Regulação) e a lista agrupada em Progresso.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP, abrirNavegador, diaDeEstudo, placar, responder, sairDaSessao, vigiarErros } from './comum.mjs';
import { montarDados } from '../build.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];

const d = montarDados();
const js = readFileSync(join(RAIZ, 'src', 'app.js'), 'utf8');
const itensRpg = [...js.matchAll(/\{ id: '([a-z-]+)', slot: '([a-z]+)', rar: '([a-z]+)'/g)].map(([, id, slot, rar]) => ({ id, slot, rar }));
const ids = {
  reais: d.questoes.filter((q) => q.o && !q.al).slice(0, 300).map((q) => q.id),
  me: d.questoes.filter((q) => q.al).slice(0, 20).map((q) => q.id),
  dificeis: d.questoes.filter((q) => q.d === 3 && !q.o).slice(0, 50).map((q) => q.id),
};
const tema = d.discursivas.temas[0];

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await diaDeEstudo(ctx);
await ctx.addInitScript(({ ids, itensRpg, tema }) => {
  if (sessionStorage.getItem('semeado')) return;
  sessionStorage.setItem('semeado', '1');
  const agora = new Date();
  const hoje = Math.round(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()) / 86400000);
  const iso = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
  // 35 dias seguidos até ontem: 150 itens com 93% de acerto, 30 cards, meta, roteiro, manutenção e 3 h 03 min de relógio
  const dias = {};
  for (let k = 1; k <= 35; k++) dias[iso(hoje - k)] = { r: 150, c: 140, e: 10, b: 0, xp: 0, k: 30, n: 0, a: [], m: 2, metaOk: 1, rt: 1, t: { q: 11000 } };
  dias[iso(hoje - 3)].pd = 1;
  const it = {};
  const reg = (id, nv, duv) => { it[id] = [nv, hoje + 10, nv, 0, hoje - 1, duv ? 1 : 0, 0, 0]; };
  ids.reais.forEach((id, i) => reg(id, 3, i < 20));
  ids.me.forEach((id) => reg(id, 1));
  ids.dificeis.forEach((id) => reg(id, 3));
  const inv = {}, eq = {};
  for (const x of itensRpg) { inv[x.id] = iso(hoje - 5); eq[x.slot] = eq[x.slot] || x.id; }
  const m = {};
  // O histórico de missões guarda 14 dias; o total de baús vem do contador
  for (let k = 1; k <= 13; k++) m[iso(hoje - k)] = { ids: [], ok: {}, bau: 1 };
  const trofeus = Array.from({ length: 10 }, (_, k) => ({ sem: iso(hoje - 7 * (k + 1)), bloco: 'lgpd-55', data: iso(hoje - 7 * (k + 1)) }));
  const lidos = {};
  for (let k = 0; k < 100; k++) lidos['x' + k] = iso(hoje - 2);
  const perfil = {
    xp: 31600, meta: 30, novosCards: 20, intercaladas: 30, melhorSeq: 0, dias, conq: {}, recordes: { combo: 50, relampago: 25, ex: 5 },
    status: {}, feitos: {}, lidos, saidos: 300, criado: iso(hoje - 40), rpg: { inv, eq, m, trofeus, baus: 30 },
  };
  const simulados = Array.from({ length: 5 }, () => ({ data: iso(hoje - 2), n: 120, c: 105, e: 5, b: 10, liq: 100, seg: 10000, titulo: 'Simulado' }));
  const disc = { [tema.id]: { rascunho: '', tentativas: Array.from({ length: 5 }, () => ({ d: iso(hoje - 2), nq: tema.pontos * 0.75 })) } };
  localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens: it, cards: {}, simulados, pesquisa: {}, disc, t: {} }));
}, { ids, itensRpg, tema: { id: tema.id, pontos: tema.pontos } });
const p = await ctx.newPage();
p.setDefaultTimeout(5000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(500);

await passo('nível 30 na Jornada', async () => {
  const t = await p.textContent('.heroi-rpg');
  if (!/Especialista em Regulação/.test(t)) throw new Error('herói: ' + t.trim().slice(0, 120));
  if (!/\b30\b/.test(await p.textContent('.heroi-rpg .insignia'))) throw new Error('insígnia sem o nível 30');
});

await passo('um item respondido destrava o que os números permitem', async () => {
  await p.click('[data-acao="iniciar-dia"]');
  await p.waitForSelector('#sessao:not([hidden])');
  const t0 = Date.now();
  await responder(p);
  await p.waitForSelector('.veredito');
  console.log('      resposta registrada em ' + (Date.now() - t0) + ' ms');
  const conq = await p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.conq);
  const esperadas = ['primeira', 'r100', 'r500', 'r1000', 'r2500', 'r5000', 'cards50', 'cards300', 'cards1000', 'combo10', 'combo25', 'combo50',
    'relampago15', 'relampago25', 'seq7', 'seq14', 'seq30', 'maratona', 'certeiro', 'hora1', 'hora3', 'horas100', 'fds', 'dias30', 'meta10',
    'memoria50', 'roteiro7', 'recuperacao', 'sim1', 'sim5', 'sim70', 'sim80', 'prova120', 'lei20', 'lei100', 'lista25', 'lista100', 'lista300',
    'explicar5', 'calibrado', 'reais50', 'reais300', 'me20', 'casca', 'disc1', 'disc5', 'discnota', 'bau1', 'bau7', 'bau30', 'chefe1', 'chefe5',
    'chefe10', 'lendario', 'equipado', 'colecao', 'nivel10', 'nivel20', 'nivel30', 'xp25k'];
  const faltam = esperadas.filter((id) => !conq[id]);
  if (faltam.length) throw new Error('não destravadas: ' + faltam.join(', '));
  const indevidas = ['seq60', 'seq100', 'dias100', 'meta50', 'meta100', 'lei500', 'leitodas', 'perfeita', 'lince', 'trilha', 'r10000',
    'maratona200', 'horas250', 'dia3k', 'sem5k', 'semanas4', 'xp50k', 'nivel40'].filter((id) => conq[id]);
  if (indevidas.length) throw new Error('destravadas sem os números: ' + indevidas.join(', '));
});

await passo('Progresso mostra as conquistas em seis grupos', async () => {
  await p.click('[data-acao="proximo"]');
  await sairDaSessao(p);
  await p.waitForSelector('#sessao', { state: 'hidden' });
  await p.click('.aba[data-vista="mais"]');
  await p.click('#vista-mais [data-acao="mais"][data-sub="progresso"]');
  const grupos = p.locator('details[data-det^="cq-"]');
  if ((await grupos.count()) !== 6) throw new Error('grupos: ' + (await grupos.count()));
  const cab = await p.textContent('.secao:has(details[data-det^="cq-"]) .secao-cab');
  if (!/de 106/.test(cab)) throw new Error('cabeçalho: ' + cab.trim());
  await grupos.first().locator('summary').click();
  if ((await grupos.first().locator('.conquista').count()) < 10) throw new Error('grupo de questões vazio');
  if ((await p.locator('.secao:has(details[data-det^="cq-"]) > .conquistas .conquista').count()) !== 4) throw new Error('recentes: esperado 4');
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await browser.close();
fim();
