// Pesos da prova: o simulado de prova completa mostra a nota ponderada (item básico vale 1, específico vale 2) e o
// plano mostra quanto cada disciplina vale na nota.
import { APP, abrirNavegador, foto, placar, responder, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, fim } = placar();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const erros = [];
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(500);

await p.click('[data-acao="ir"][data-vista="questoes"]');
await p.click('[data-acao="set-modo"][data-modo="simulado"]');
await p.click('[data-acao="set-prova"][data-prova="prova"]');
await p.click('[data-acao="set-n"][data-n="30"]');
const aviso = (await p.textContent('#vista-questoes')).replace(/\s+/g, ' ');
conferir('a prova completa explica os pesos', /120 itens e 190 pontos/.test(aviso) && /cada item vale 2/.test(aviso), (/Numa prova[^.]*\./.exec(aviso) || [''])[0]);
await p.click('[data-acao="comecar"]');
await p.waitForSelector('#sessao:not([hidden])');

// Marca os 12 primeiros (um erro anula um acerto) e entrega o resto em branco
let reais = 0;
for (let i = 0; i < 12; i++) {
  if (await p.locator('#sessao .selo.real').count()) reais++;
  await responder(p, i % 3 ? 'c' : 'e');
  await p.click('[data-acao="proximo"]');
}
// Pelo menos metade de cada fatia vem de itens reais inéditos (os irmãos de texto podem passar disso)
conferir('simulado traz itens reais', reais >= 4, reais + ' de 12');
await p.click('[data-acao="entregar"]');
await p.click('[data-acao="confirmar-entrega"]');
await p.waitForSelector('.placar');
const res = (await p.textContent('#sessao')).replace(/\s+/g, ' ');
const m = /Nota com os pesos da prova \(básica vale 1, específica vale 2\): (-?\d+) de (\d+) pontos/.exec(res);
conferir('resultado traz a nota ponderada', !!m, m ? m[0] : res.slice(0, 200));
if (m) {
  const [pt, max] = [Number(m[1]), Number(m[2])];
  // 30 itens na proporção da prova: 12 ou 13 básicos e 17 ou 18 específicos, ou seja, 47 ou 48 pontos possíveis
  conferir('pontos possíveis seguem a proporção da prova', max === 47 || max === 48, String(max));
  conferir('nota fica entre -24 e 24 com 12 marcações', pt >= -24 && pt <= 24, String(pt));
}
const cab = await p.locator('#sessao table.tabela thead').first().textContent();
conferir('tabela por disciplina tem a coluna Pontos', /Pontos/.test(cab || ''), cab);
const linhas = await p.locator('#sessao table.tabela tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((c) => c.textContent.trim())));
const soma = linhas.reduce((a, l) => a + Number((/de (\d+)/.exec(l[5] || '') || [0, 0])[1]), 0);
conferir('pontos por disciplina somam o total', m && soma === Number(m[2]), soma + ' de ' + (m ? m[2] : '?'));
await p.screenshot({ path: foto('pesos-resultado.png'), fullPage: true });
await p.click('[data-acao="fechar-sessao"]');

await p.click('.aba[data-vista="mais"]');
await p.click('[data-acao="mais"][data-sub="menu"]').catch(() => {});
await p.click('.menu-mais [data-sub="plano"]');
await p.waitForTimeout(200);
const peso = p.locator('.cartao', { hasText: 'Peso por disciplina' }).first();
const tab = await peso.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((c) => c.textContent.trim())));
conferir('LGPD vem primeiro e vale 37,9% da nota', /^LGPD/.test(tab[0][0]) && tab[0][1] === '37,9%', tab[0].join(' | '));
const total = tab.reduce((a, l) => a + (parseFloat((l[1] || '0').replace(',', '.')) || 0), 0);
conferir('as fatias da nota somam 100%', Math.abs(total - 100) < 0.3, total.toFixed(1));
await peso.screenshot({ path: foto('pesos-plano.png') });

await browser.close();
fim(erros);
