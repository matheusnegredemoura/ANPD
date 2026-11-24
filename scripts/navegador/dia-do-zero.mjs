// Dia de matéria nova no plano (campo st): o roteiro traz pré-teste, lei, aula e questões do mesmo subtema, nessa
// ordem; "Ler os artigos" abre o primeiro artigo do subtema na própria página, com as palavras, o guia de leitura e o
// subtema em palavras simples;
// a aula dá baixa no passo; as questões do dia são do subtema; a citação de artigo dentro da aula abre o texto ali.
import { readFileSync } from 'node:fs';
import { APP, abrirNavegador, placar, vigiarErros } from './comum.mjs';
import { montarDados } from '../build.mjs';

const plano = JSON.parse(readFileSync(new URL('../../dados/cronograma.json', import.meta.url), 'utf8'));
const dia = plano.fases.flatMap((f) => f.semanas.flatMap((s) => s.dias)).find((d) => d.st === 'pd-principios');
const dados = montarDados();
const doSubtema = new Set(dados.questoes.filter((q) => q.tm === dia.st).map((q) => q.id));

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await ctx.clock.install({ time: new Date(dia.data + 'T09:00:00') });
const p = await ctx.newPage();
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(600);

const titulos = async () => (await p.locator('.roteiro .passo b').allTextContents()).map((t) => t.trim());

await passo('o roteiro de ' + dia.data + ' traz questões, lei e aula do mesmo subtema, nessa ordem', async () => {
  const t = await titulos();
  const i = (re) => t.findIndex((x) => re.test(x));
  const ordem = [i(/^2\. Questões do tema/), i(/^3\. Lei seca/), i(/^4\. Aula/)];
  if (ordem.some((x) => x < 0) || ordem.some((x, k) => k && x <= ordem[k - 1])) throw new Error(t.join(' | '));
  if (t.some((x) => /^Lei seca grifada$/.test(x))) throw new Error('lei seca repetida no roteiro');
});

await passo('"Ler os artigos" abre o art. 6º na página do subtema, com as palavras do subtema', async () => {
  await p.locator('.roteiro [data-acao="st-lei"]').first().tap();
  await p.waitForTimeout(300);
  if (!(await p.locator('#vista-mais').isVisible())) throw new Error('não abriu a página do subtema');
  const cab = (await p.locator('#vista-mais .art-inline:not([hidden]) .art-inline-cab b').first().textContent()) || '';
  if (!/Art\. 6/.test(cab)) throw new Error('artigo aberto: ' + cab);
  if (!(await p.locator('#lei-pd-principios details.palavras dt').count())) throw new Error('sem as palavras do subtema');
  const simples = (await p.locator('#vista-mais .cartao.destaque .simples').textContent()) || '';
  if (!/Em palavras simples[^]*boa-fé/.test(simples)) throw new Error('sem o subtema em palavras simples: ' + simples.slice(0, 80));
});

await passo('a aula dá baixa no passo do roteiro', async () => {
  await p.click('.aba[data-vista="hoje"]');
  await p.locator('.roteiro [data-acao="st-aula"]').first().tap();
  await p.waitForTimeout(200);
  await p.click('.aba[data-vista="hoje"]');
  const feito = await p.locator('.roteiro .passo.feito', { hasText: '4. Aula' }).count();
  if (!feito) throw new Error('passo da aula sem baixa');
  const lei = await p.locator('.roteiro .passo.feito', { hasText: '3. Lei seca' }).count();
  conferir('a lei do dia também ficou feita (art. 6º lido)', lei === 1);
});

await passo('as questões do dia são do subtema', async () => {
  await p.locator('.roteiro [data-acao="iniciar-dia"]').first().tap();
  await p.waitForSelector('#sessao:not([hidden])');
  const id = ((await p.textContent('.item-num')) || '').trim();
  if (!doSubtema.has(id)) throw new Error('item fora do subtema: ' + id);
  await p.click('[data-acao="sair-sessao"]');
});

await passo('na aula de "Para que serve a LGPD", a citação de artigo abre o texto ali mesmo', async () => {
  await p.click('.aba[data-vista="mais"]');
  await p.click('[data-acao="mais"][data-sub="menu"]').catch(() => {});
  await p.click('.menu-mais [data-sub="trilha"]');
  await p.click('#vista-mais [data-acao="subtema"][data-st="pd-alcance"]');
  const ref = p.locator('#aula-pd-alcance .ref-art').first();
  if (!(await ref.count())) throw new Error('aula sem citação clicável');
  const txt = (await ref.textContent()) || '';
  await ref.tap();
  const box = p.locator('#aula-pd-alcance .art-inline:not([hidden])');
  const cab = (await box.locator('.art-inline-cab b').textContent()) || '';
  const num = /\d+/.exec(txt)[0];
  if (!new RegExp('Art\\. ' + num + '\\D').test(cab + ' ')) throw new Error('citação ' + txt + ' abriu ' + cab);
});

await browser.close();
fim(erros);
