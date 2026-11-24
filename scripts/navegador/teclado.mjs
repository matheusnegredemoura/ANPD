// Teclado e diálogo: Cmd/Ctrl + letra pertence ao navegador e não responde o item (copiar o enunciado marcava Certo);
// a letra sozinha continua respondendo. Com a sessão aberta o fundo fica inerte e o foco entra no diálogo; Escape
// fecha a sessão (guardada) e devolve o foco ao conteúdo. No dia de simulado do plano, a sessão tem o tamanho do
// cronograma, não o teto de 30 do pré-teste.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP, abrirNavegador, diaDeEstudo, placar, vigiarErros } from './comum.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const inertes = (p) => p.evaluate(() => ['topo', 'conteudo', 'abas'].map((id) => document.getElementById(id).inert));

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await diaDeEstudo(ctx);
const p = await ctx.newPage();
p.setDefaultTimeout(5000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(300);

await passo('sessão aberta: fundo inerte e foco dentro do diálogo', async () => {
  await p.click('[data-acao="iniciar-dia"]');
  await p.waitForSelector('#sessao:not([hidden])');
  const i = await inertes(p);
  if (i.some((x) => !x)) throw new Error('topo/conteudo/abas inert: ' + i.join(','));
  if (!(await p.evaluate(() => document.getElementById('sessao').contains(document.activeElement)))) throw new Error('foco fora da sessão');
});

await passo('Cmd+C, Ctrl+C, Ctrl+E e Cmd+B não respondem o item', async () => {
  // Vale para os dois formatos: no certo/errado as letras são C, E e B (branco); na múltipla escolha, as alternativas
  await p.evaluate(() => document.activeElement.blur());
  for (const k of ['Meta+c', 'Control+c', 'Control+e', 'Meta+b']) await p.keyboard.press(k);
  await p.waitForTimeout(150);
  if (await p.locator('.veredito').count()) throw new Error('atalho com modificador respondeu');
});

await passo('a letra sozinha continua respondendo', async () => {
  await p.keyboard.press('c');
  await p.waitForSelector('.veredito');
});

await passo('Escape fecha a sessão, solta o fundo e devolve o foco', async () => {
  await p.keyboard.press('Escape');
  await p.waitForSelector('#sessao', { state: 'hidden' });
  const i = await inertes(p);
  if (i.some((x) => x)) throw new Error('fundo continua inerte: ' + i.join(','));
  if ((await p.evaluate(() => document.activeElement.id)) !== 'conteudo') throw new Error('foco em ' + (await p.evaluate(() => document.activeElement.tagName)));
  const pausas = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.pausas || {}).length);
  if (!pausas) throw new Error('sessão não ficou guardada');
});

// Primeiro simulado do plano: abre com o número de itens do cronograma
const plano = JSON.parse(readFileSync(join(RAIZ, 'dados', 'cronograma.json'), 'utf8'));
const sim = plano.fases.flatMap((f) => f.semanas.flatMap((s) => s.dias)).filter((d) => d.modo === 'simulado' && d.n > 30).sort((a, b) => (a.data < b.data ? -1 : 1))[0];
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
const [y, m, d] = sim.data.split('-').map(Number);
await ctx2.clock.install({ time: new Date(y, m - 1, d, 10, 0) });
const p2 = await ctx2.newPage();
p2.setDefaultTimeout(5000);
vigiarErros(p2, erros);
await p2.goto(APP);
await p2.waitForTimeout(300);
await passo('simulado do plano com ' + sim.n + ' itens (' + sim.data + ')', async () => {
  await p2.click('[data-acao="iniciar-dia"]');
  await p2.waitForSelector('#sessao:not([hidden])');
  const t = await p2.textContent('#sessao .tit span');
  if (!new RegExp('de ' + sim.n + '\\b').test(t)) throw new Error('contador: ' + t);
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await browser.close();
fim();
