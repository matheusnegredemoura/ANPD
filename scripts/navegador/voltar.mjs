// Voltar do celular (history.back) fecha a camada aberta e não sai do painel; fechar pelo botão não deixa entrada sobrando
import { APP, abrirNavegador, diaDeEstudo, placar, sairDaSessao, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await diaDeEstudo(ctx);
const p = await ctx.newPage();
p.setDefaultTimeout(8000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForSelector('.aba[data-vista="questoes"]');

const comecar = async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="comecar"]');
  await p.waitForSelector('#sessao:not([hidden])');
};

await passo('voltar fecha a sessão aberta e mantém o painel', async () => {
  await comecar();
  await p.goBack();
  await p.waitForSelector('#sessao', { state: 'hidden' });
  conferir('continua no painel', await p.locator('.aba[data-vista="questoes"]').isVisible());
});

await passo('sair pelo botão devolve a entrada do histórico', async () => {
  await comecar();
  await sairDaSessao(p);
  await p.waitForSelector('#sessao', { state: 'hidden' });
  await p.waitForTimeout(300);
  conferir('histórico sem camada pendente', (await p.evaluate(() => history.state)) === null);
});

await browser.close();
fim(erros);
