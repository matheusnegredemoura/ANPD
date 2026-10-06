// Sair da sessão do dia no meio e voltar: deve continuar de onde parou, inclusive depois de recarregar a página.
import { APP, abrirNavegador, foto, placar, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, fim } = placar();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const erros = [];
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(500);

const botaoDia = p.locator('[data-acao="iniciar-dia"]').first();
await botaoDia.click();
await p.waitForSelector('#sessao:not([hidden])');
const cab = async () => (await p.textContent('.sessao-topo .tit span')).trim();
const total = Number(/de (\d+)/.exec(await cab())[1]);
const respondidos = [];
for (let i = 0; i < 3; i++) {
  respondidos.push((await p.textContent('.item-num')).trim());
  if (await p.locator('button.alt').count()) await p.locator('button.alt').first().click(); else await p.click('.bolha.c');
  await p.waitForSelector('.veredito');
  await p.click('[data-acao="proximo"]');
}
const quartoAntes = (await p.textContent('.item-num')).trim();
console.log('respondidos:', respondidos.join(', '), '· próximo seria', quartoAntes, '· total', total);
await p.click('[data-acao="sair-sessao"]');
const msg = (await p.textContent('#sessao .cartao.destaque')).trim();
conferir('confirmação explica que os itens que faltam ficam guardados', /ficam guardados/.test(msg), msg.slice(0, 140));
await p.click('[data-acao="confirmar-saida"]');
await p.waitForTimeout(300);
const rotulo1 = (await p.locator('[data-acao="iniciar-dia"]').first().textContent()).trim();
conferir('botão do dia passa a Continuar', rotulo1 === 'Continuar · faltam ' + (total - 3) + ' de ' + total, rotulo1);
conferir('há opção de recomeçar do zero', (await p.locator('[data-acao="descartar-pausa"]').count()) === 1);

// Recarrega a página: a pausa tem de sobreviver
await p.reload();
await p.waitForTimeout(600);
const rotulo2 = (await p.locator('[data-acao="iniciar-dia"]').first().textContent()).trim();
conferir('pausa sobrevive a recarregar a página', rotulo2 === rotulo1, rotulo2);
await p.locator('[data-acao="iniciar-dia"]').first().click();
await p.waitForSelector('#sessao:not([hidden])');
conferir('continua no item 4 de ' + total, (await cab()).startsWith('Item 4 de ' + total), await cab());
const primeiroRetomado = (await p.textContent('.item-num')).trim();
conferir('primeiro item retomado é o que vinha a seguir', primeiroRetomado === quartoAntes, primeiroRetomado + ' vs ' + quartoAntes);
conferir('não repete itens já respondidos', !respondidos.includes(primeiroRetomado));

// Responde mais um, sai, e confere a contagem nova
if (await p.locator('button.alt').count()) await p.locator('button.alt').first().click(); else await p.click('.bolha.e');
await p.waitForSelector('.veredito');
await p.click('[data-acao="proximo"]');
await p.click('[data-acao="sair-sessao"]');
await p.click('[data-acao="confirmar-saida"]');
await p.waitForTimeout(300);
const rotulo3 = (await p.locator('[data-acao="iniciar-dia"]').first().textContent()).trim();
conferir('contagem atualizada depois de mais uma resposta', rotulo3 === 'Continuar · faltam ' + (total - 4) + ' de ' + total, rotulo3);

// Recomeçar do zero descarta a pausa
await p.click('[data-acao="descartar-pausa"]');
await p.waitForTimeout(200);
const rotulo4 = (await p.locator('[data-acao="iniciar-dia"]').first().textContent()).trim();
conferir('recomeçar volta ao botão normal', !/Continuar/.test(rotulo4), rotulo4);

// Treino livre pela aba Questões
await p.click('[data-acao="ir"][data-vista="questoes"]');
await p.click('[data-acao="set-modo"][data-modo="treino"]');
await p.click('[data-acao="comecar"]');
await p.waitForSelector('#sessao:not([hidden])');
if (await p.locator('button.alt').count()) await p.locator('button.alt').first().click(); else await p.click('.bolha.c');
await p.waitForSelector('.veredito');
await p.click('[data-acao="proximo"]');
await p.click('[data-acao="sair-sessao"]');
await p.click('[data-acao="confirmar-saida"]');
await p.waitForTimeout(300);
conferir('aba Questões mostra o treino interrompido', (await p.locator('#vista-questoes [data-acao="retomar-pausa"]').count()) === 1);
await p.locator('#vista-questoes [data-acao="retomar-pausa"]').first().click();
await p.waitForSelector('#sessao:not([hidden])');
conferir('treino livre continua no item 2', (await cab()).startsWith('Item 2 de'), await cab());
await p.screenshot({ path: foto('pausa.png') });

await browser.close();
fim(erros);
