// Edital e prova em Ajustes: data, itens por disciplina, pesos e cortes trocam a projeção; a contagem, o simulado da
// prova inteira e a régua seguem o edital informado. Perto da prova, nenhuma revisão vence depois dela. O ciclo semanal
// do mentor vai para as horas reais de estudo.
import { APP, abrirNavegador, placar, vigiarErros } from './comum.mjs';
import { montarDados } from '../build.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const gab = new Map(montarDados().questoes.map((q) => [q.id, q.g]));
const hojeNum = () => { const d = new Date(); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); };
const isoMais = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
// Dez dias de estudo nas duas últimas semanas, 1 h cada (5 h por semana)
await ctx.addInitScript(() => {
  if (sessionStorage.getItem('semeado')) return;
  sessionStorage.setItem('semeado', '1');
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const dias = {};
  for (let n = 1; n <= 10; n++) dias[iso(n)] = { r: 60, t: { q: 3600 } };
  const perfil = { xp: 0, meta: 30, novosCards: 5, intercaladas: 20, melhorSeq: 0, dias, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: iso(20) };
  localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
});
const p = await ctx.newPage();
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForSelector('#vista-hoje .roteiro');

await passo('sem edital: projeção', async () => {
  const t = (await p.textContent('#vista-hoje')).replace(/\s+/g, ' ');
  conferir('contagem até a prova provável', /dias até a prova provável/.test(t), t.match(/dias até a prova[^.]*/)?.[0]);
});

await passo('ciclo do mentor nas horas reais', async () => {
  await p.click('.aba[data-vista="mais"]');
  await p.click('#vista-mais [data-acao="mais"][data-sub="metodo"]');
  const t = (await p.textContent('#vista-mais')).replace(/\s+/g, ' ');
  conferir('soma do ciclo = 5h', /Ciclo semanal \(Fase 2\) ?Soma = 5h00/.test(t), t.match(/Ciclo semanal[^.]{0,80}/)?.[0]);
  conferir('explica a média das duas semanas', /5h00 por semana na média das duas últimas semanas/.test(t));
});

await passo('edital salvo: contagem, simulado e régua seguem o edital', async () => {
  await p.click('.aba[data-vista="mais"]');
  await p.click('#vista-mais [data-acao="mais"][data-sub="ajustes"]');
  await p.waitForSelector('#cartao-edital');
  // Gestão nas duas partes é recusada
  await p.fill('.ed-n[data-parte="b"][data-d="gestao"]', '5');
  await p.click('[data-acao="edital-salvar"]');
  conferir('disciplina nas duas partes recusada', /Gestão pública[^.]* está nas duas partes/.test(await p.textContent('#ed-msg')));
  await p.fill('.ed-n[data-parte="b"][data-d="gestao"]', '');
  await p.fill('#ed-prova', isoMais(10));
  await p.fill('#ed-c1', '5');
  await p.fill('#ed-c2', '12');
  await p.fill('#ed-ct', '25');
  await p.fill('.ed-n[data-parte="b"][data-d="linguas"]', '30');
  await p.click('[data-acao="edital-salvar"]');
  const msg = await p.textContent('#ed-msg');
  conferir('salvo com a nova soma', /Edital salvo: prova de 129 itens e 129 pontos/.test(msg), msg);
  const ed = await p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.edital);
  conferir('gravado no perfil', ed && ed.basica.linguas === 30 && ed.cortes.p2 === 12 && ed.prova === isoMais(10), JSON.stringify(ed));
  await p.click('.aba[data-vista="hoje"]');
  const h = (await p.textContent('#vista-hoje')).replace(/\s+/g, ' ');
  conferir('contagem com a data do edital', /10 ?dias até a prova, \d\d\/\d\d\/\d{4}\./.test(h), h.match(/.{4}dias até a prova[^.]*/)?.[0]);
  await p.click('[data-acao="abrir-modo"][data-modo="simulado"]');
  const s = (await p.textContent('#vista-questoes')).replace(/\s+/g, ' ');
  conferir('simulado da prova inteira com 129 itens e a régua nova', /129 itens · 3h46/.test(s) && /nota mínima de 5 na P1, 12 na P2 e 25 no conjunto/.test(s), s.match(/Simulado no formato.{0,300}/)?.[0]);
});

await passo('revisão não vence depois da prova', async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('#vista-questoes [data-acao="set-modo"][data-modo="treino"]');
  await p.click('#vista-questoes [data-acao="comecar"]');
  await p.waitForSelector('#sessao:not([hidden]) .item-num');
  const id = (await p.textContent('.item .item-num')).trim();
  if (await p.locator('button.alt').count()) await p.click('button.alt[data-r="' + gab.get(id) + '"]');
  else await p.click('.bolha.' + gab.get(id).toLowerCase());
  await p.waitForTimeout(300);
  const r = await p.evaluate((id) => JSON.parse(localStorage.getItem('painel-anpd-v3')).itens[id], id);
  conferir('acerto de primeira vence 2 dias antes da prova (8 dias), não em 16', r && r[0] === 4 && r[1] - hojeNum() === 8, JSON.stringify(r));
  await p.click('[data-acao="sair-sessao"]');
  if (await p.locator('[data-acao="confirmar-saida"]').count()) await p.click('[data-acao="confirmar-saida"]');
});

await passo('voltar à projeção', async () => {
  await p.click('.aba[data-vista="mais"]');
  await p.click('#vista-mais [data-acao="mais"][data-sub="ajustes"]');
  await p.click('[data-acao="edital-padrao"]');
  const ed = await p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.edital);
  conferir('edital apagado com null', ed === null, JSON.stringify(ed));
  conferir('tabela volta a 21 itens de línguas', (await p.inputValue('.ed-n[data-parte="b"][data-d="linguas"]')) === '21');
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await ctx.close();
await browser.close();
fim();
