// Roteiro do dia útil (1 h): núcleo sem caderno de erros, sem cards (as lacunas ficam no modo Testar da lei seca), dia curto para não zerar,
// intercaladas com português e inglês no peso da prova e reforço na disciplina de pior acerto, e XP por ler.
import { APP, abrirNavegador, placar, responder, sairDaSessao, vigiarErros } from './comum.mjs';
import { montarDados } from '../build.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const d = montarDados();
const BLOCO = new Map(d.blocos.map((b) => [b.id, b]));
const disc = (id) => (BLOCO.get((d.questoes.find((q) => q.id === id) || {}).b) || {}).disciplina;
const QD = new Map(d.questoes.map((q) => [q.id, (BLOCO.get(q.b) || {}).disciplina]));
// Regulação com 40 respostas e 60% de acerto: vira a disciplina de reforço
const reg = d.questoes.filter((q) => QD.get(q.id) === 'regulacao' && !q.al).slice(0, 40).map((q, i) => [q.id, i % 10 < 6 ? 1 : 0]);

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
// Terça de 1 h no plano, com matéria nova (pd-anonimizacao)
await ctx.clock.install({ time: new Date('2026-10-27T09:00:00') });
await ctx.addInitScript((reg) => {
  if (sessionStorage.getItem('semeado')) return;
  sessionStorage.setItem('semeado', '1');
  const agora = new Date(), hoje = Math.round(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()) / 86400000);
  const iso = new Date((hoje - 20) * 86400000).toISOString().slice(0, 10);
  const itens = {};
  for (const [id, ok] of reg) itens[id] = [ok ? 3 : 0, hoje + 5, ok, 1 - ok, hoje - 2, 0, 0, ok];
  const perfil = { xp: 0, meta: 30, novosCards: 20, intercaladas: 20, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: iso };
  localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
}, reg);
const p = await ctx.newPage();
p.setDefaultTimeout(8000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForSelector('#vista-hoje .roteiro');
const salvo = () => p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')));

await passo('roteiro do dia útil: núcleo de 1 h, sem caderno de erros', async () => {
  const t = (await p.locator('.roteiro .passo b').allTextContents()).map((x) => x.trim());
  conferir('sem o passo do caderno de erros', !t.some((x) => /Caderno de erros/.test(x)), t.join(' | '));
  conferir('sem passo de cards (as lacunas ficam no modo Testar da lei seca)', !t.some((x) => /Cards/i.test(x)), t.join(' | '));
  const min = t.reduce((a, x) => a + Number((/~(\d+) min/.exec(x) || [0, 0])[1]), 0);
  conferir('o núcleo cabe em 1 h', min <= 60, min + ' min: ' + t.join(' | '));
  conferir('intercaladas também no dia de matéria nova', t.some((x) => /Treino intercalado/.test(x)));
  conferir('sem fixação no dia útil (as questões do tema já fixam)', !t.some((x) => /Fixação/.test(x)));
  conferir('passos numerados em sequência', t.filter((x) => /^\d+\./.test(x)).every((x, i) => x.startsWith(i + 1 + '.')), t.join(' | '));
});

await passo('intercaladas: 10 itens, línguas no peso da prova e reforço em Regulação', async () => {
  const txt = await p.locator('.roteiro .passo', { hasText: 'Treino intercalado' }).textContent().catch(() => '');
  conferir('o passo anuncia o reforço em Regulação', /reforço em Regulação[^)]*\(60% de acerto/.test(txt), txt.replace(/\s+/g, ' ').slice(0, 220));
  await p.click('[data-acao="intercaladas"]');
  await p.waitForSelector('#sessao:not([hidden]) .item-num');
  const ids = [];
  for (let k = 0; k < 30; k++) {
    ids.push((await p.textContent('.item .item-num')).trim());
    await responder(p);
    await p.waitForSelector('[data-acao="proximo"]');
    const ult = /Ver resultado/.test(await p.textContent('[data-acao="proximo"]'));
    await p.click('[data-acao="proximo"]');
    if (ult) break;
  }
  const nL = ids.filter((id) => disc(id) === 'linguas').length, nR = ids.filter((id) => disc(id) === 'regulacao').length;
  conferir('pelo menos 3 de línguas', nL >= 3, nL + ' de ' + ids.length);
  conferir('pelo menos 2 de reforço em Regulação', nR >= 2, nR + ' de ' + ids.length);
  await p.click('[data-acao="fechar-sessao"]').catch(() => {});
});

await passo('ler um artigo rende XP', async () => {
  // A sessão anterior ainda pode estar gravando o XP dela: mede a partir de um valor estável
  let xp0 = (await salvo()).perfil.xp;
  for (let k = 0; k < 10; k++) { await p.waitForTimeout(200); const x = (await salvo()).perfil.xp; if (x === xp0) break; xp0 = x; }
  await p.click('.aba[data-vista="lei"]');
  if (!(await p.locator('.ranking button').count())) await p.click('[data-acao="ranking"]');
  await p.locator('.ranking button').first().click();
  await p.waitForSelector('#vista-lei .texto-lei');
  await p.waitForTimeout(300);
  const xp1 = (await salvo()).perfil.xp;
  conferir('+6 XP pela leitura', xp1 - xp0 === 6, xp0 + ' → ' + xp1);
});

await passo('dia curto: até 20 itens, e o dia conta', async () => {
  await p.click('.aba[data-vista="hoje"]');
  await p.click('[data-acao="dia-curto"]');
  await p.waitForSelector('#sessao:not([hidden]) .item-num');
  conferir('sessão Dia curto', /Dia curto/.test(await p.textContent('.sessao-topo .tit b')));
  const tot = Number((/de (\d+)/.exec(await p.textContent('.sessao-topo .tit span')) || [0, 99])[1]);
  conferir('até 20 itens', tot > 0 && tot <= 20, String(tot));
  for (let k = 0; k < 25; k++) {
    await responder(p);
    await p.waitForSelector('[data-acao="proximo"]');
    const ult = /Ver resultado/.test(await p.textContent('[data-acao="proximo"]'));
    await p.click('[data-acao="proximo"]');
    if (ult) break;
  }
  await p.click('[data-acao="fechar-sessao"]').catch(() => {});
  await p.click('.aba[data-vista="hoje"]');
  const s = await salvo(), h = Object.keys(s.perfil.feitos).find((k) => k.startsWith('curto:'));
  conferir('feito registrado', !!h, JSON.stringify(s.perfil.feitos));
  conferir('o roteiro avisa que o dia contou', /Dia curto feito/.test(await p.textContent('#vista-hoje')));
});

// Sábado de matéria sem lei seca (segurança da informação do zero, 14/11): o roteiro não pede leitura de artigos
{
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await c2.clock.install({ time: new Date('2026-11-14T09:00:00') });
  const p2 = await c2.newPage();
  vigiarErros(p2, erros);
  await p2.goto(APP);
  await p2.waitForSelector('.aba');
  await passo('matéria sem lei seca: sem passo de leitura, aula à mão', async () => {
    const t = ((await p2.textContent('main')) || '').replace(/\s+/g, ' ');
    conferir('é o dia de segurança da informação', /segurança da informação/i.test(t), t.slice(0, 160));
    conferir('sem "Ler os artigos" nem passo de lei seca', !(await p2.locator('[data-acao="st-lei"]').count()) && !/Lei seca com grifos/.test(t));
    conferir('botão da aula presente', (await p2.locator('[data-acao="st-aula"]').count()) > 0);
  });
  await c2.close();
}

conferir('sem erro de página', !erros.length, erros.join(' | '));
await ctx.close();
await browser.close();
fim(erros);
