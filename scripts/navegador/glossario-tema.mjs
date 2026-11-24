// Investigar um tema mostra a definição do termo que é o assunto do tema (o que aparece primeiro no título), e não
// a do primeiro termo do glossário que por acaso aparece em algum ponto do título
import { APP, abrirNavegador, diaDeEstudo, placar, vigiarErros } from './comum.mjs';

const b = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await diaDeEstudo(ctx);
const p = await ctx.newPage();
p.setDefaultTimeout(8000);
vigiarErros(p, erros);
await p.goto(APP);

const TEMA = 'Quem é agente de tratamento de pequeno porte';
await passo('tema sobre pequeno porte mostra a definição de pequeno porte', async () => {
  await p.click('.aba[data-vista="mais"]');
  await p.click('.menu-mais [data-sub="pesquisar"]');
  const seletor = '[data-acao="investigar"][data-t="' + TEMA + '"]';
  const grupo = p.locator('#vista-mais details.grupo-pesq', { has: p.locator(seletor) });
  const botao = grupo.locator(seletor);
  if (!(await grupo.evaluate((d) => d.open))) await grupo.locator('summary').click();
  await botao.click();
  await p.waitForSelector('#folha:not([hidden]) details.inv-def');
  await p.locator('#folha details.inv-def summary').click();
  const def = await p.locator('#folha details.inv-def p').innerText();
  conferir('definição do agente de pequeno porte', /empresas de pequeno porte/i.test(def), def.slice(0, 90));
  conferir('não a de agentes de tratamento', !/^Controlador e operador/.test(def));
});

await b.close();
fim(erros);
