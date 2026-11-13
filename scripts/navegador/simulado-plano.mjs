// Simulado do plano (dia de simulado com blocos, como o simulado longo nº 1): escolhe como o simulado da prova, dentro
// dos blocos do dia. Com muitos itens da lista curta vencidos, eles não podem tomar o simulado (antes vinham 60 de 70);
// a sessão tem o número de itens do cronograma, só certo/errado, mais de uma disciplina e só blocos do dia.
import { APP, abrirNavegador, placar, vigiarErros } from './comum.mjs';
import { montarDados } from '../build.mjs';
import { readFileSync } from 'node:fs';

const d = montarDados();
const BLOCO = new Map(d.blocos.map((b) => [b.id, b])), QB = new Map(d.questoes.map((q) => [q.id, q]));
const plano = JSON.parse(readFileSync(new URL('../../dados/cronograma.json', import.meta.url), 'utf8'));
const dia = plano.fases.flatMap((f) => f.semanas.flatMap((s) => s.dias)).filter((x) => x.modo === 'simulado' && x.blocos && x.blocos.length).sort((a, b) => (a.data < b.data ? -1 : 1))[0];
const [y, m, dd] = dia.data.split('-').map(Number);
const HOJE = Math.round(Date.UTC(y, m - 1, dd) / 864e5);
// 120 itens certo/errado dos blocos de LGPD do dia, todos na lista curta e vencidos
const lgpd = new Set(dia.blocos.filter((b) => b.startsWith('lgpd')));
const vencidos = d.questoes.filter((q) => lgpd.has(q.b) && !q.al && !q.ap).slice(0, 120).map((q) => q.id);
const itens = Object.fromEntries(vencidos.map((id) => [id, [1, HOJE - 1, 0, 1, HOJE - 4, 0, 0, 0]]));

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
await ctx.clock.install({ time: new Date(y, m - 1, dd, 10, 0) });
await ctx.addInitScript(([itens, criado]) => {
  if (location.protocol === 'about:' || window.name === 'semeado') return;
  window.name = 'semeado';
  localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil: { criado, feitos: {} }, itens, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
}, [itens, plano.fases[0].semanas[0].dias[0].data]);
const p = await ctx.newPage();
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForSelector('.aba');

await passo('simulado do dia: tamanho do cronograma, sem a lista curta, matérias do dia', async () => {
  await p.locator('[data-acao="iniciar-dia"]').first().click();
  await p.waitForSelector('#sessao:not([hidden])');
  const tit = ((await p.textContent('#sessao .tit')) || '').replace(/\s+/g, ' ');
  conferir('é o simulado, com o número de itens do cronograma', /Simulado/.test(tit) && new RegExp('de ' + dia.n + '\\b').test(tit), tit);
  const ids = [];
  let me = 0;
  for (let i = 0; i < dia.n; i++) {
    ids.push(((await p.textContent('#sessao .item-num')) || '').trim());
    if (await p.locator('#sessao button.alt').count()) me++;
    const prox = p.locator('#sessao [data-acao="proximo"]');
    if (!(await prox.count()) || (await prox.isDisabled())) break;
    await prox.click();
  }
  const daLista = ids.filter((id) => itens[id]).length;
  const discs = new Set(ids.map((id) => (BLOCO.get((QB.get(id) || {}).b) || {}).disciplina));
  conferir('nenhum item da lista curta vencida (havia ' + vencidos.length + ')', daLista === 0, daLista + ' de ' + ids.length);
  conferir('só certo/errado', me === 0, String(me));
  conferir('sem repetição', new Set(ids).size === ids.length);
  conferir('só blocos do dia', ids.every((id) => dia.blocos.includes((QB.get(id) || {}).b)), ids.filter((id) => !dia.blocos.includes((QB.get(id) || {}).b)).join(','));
  conferir('mais de uma disciplina, no peso da prova', discs.size >= 3, [...discs].join(','));
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await browser.close();
fim(erros);
