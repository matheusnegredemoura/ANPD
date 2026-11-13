// Teste de fumaça: percorre as telas e os fluxos principais no celular e no computador, em tema claro e escuro,
// e falha em erro de página ou rolagem horizontal.
import { APP, abrirNavegador, diaDeEstudo, foto, placar, responder, sairDaSessao, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const erros = [];
const { conferir, passo, fim } = placar();
async function pagina(opts) {
  const ctx = await browser.newContext(opts);
  await diaDeEstudo(ctx);
  const p = await ctx.newPage();
  p.setDefaultTimeout(4000);
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForTimeout(400);
  return p;
}
const larguraSobrando = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

const p = await pagina({ viewport: { width: 390, height: 844 } });
await p.screenshot({ path: foto('hoje.png'), fullPage: true });
conferir('roteiro do dia com passos', (await p.locator('.passo').count()) >= 4);

await passo('sessão do dia', async () => {
  await p.click('[data-acao="iniciar-dia"]');
  await p.waitForSelector('#sessao:not([hidden])');
  for (let i = 0; i < 4; i++) {
    await responder(p, i % 2 ? 'e' : 'c');
    await p.waitForSelector('.veredito');
    if (i === 0) await p.screenshot({ path: foto('feedback.png'), fullPage: true });
    await p.click('[data-acao="proximo"]');
  }
  await sairDaSessao(p);
});

await passo('termo do glossário na explicação', async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="set-modo"][data-modo="treino"]');
  await p.click('[data-acao="comecar"]');
  for (let i = 0; i < 15; i++) {
    await responder(p, 'e');
    await p.waitForSelector('.veredito');
    if (await p.locator('#sessao [data-acao="termo"]').count()) break;
    await p.click('[data-acao="proximo"]');
  }
  if (await p.locator('#sessao [data-acao="termo"]').count()) {
    await p.locator('#sessao [data-acao="termo"]').first().click();
    await p.waitForSelector('#folha:not([hidden])');
    await p.click('[data-acao="fechar-folha"]');
  }
  await sairDaSessao(p);
});

await passo('cards pelo teclado (aba Cards; fora do roteiro do dia)', async () => {
  await p.click('.aba[data-vista="cards"]');
  await p.click('[data-acao="cards-iniciar"]');
  await p.waitForSelector('#sessao:not([hidden])');
  // O deck do dia pode ter menos de 5 cards (o de números e prazos de um bloco curto): para no resultado
  for (let i = 0; i < 5; i++) {
    if (i && /Resultado/.test(await p.textContent('#sessao'))) break;
    // Enter mostra a resposta tanto no card comum quanto no card de número com campo para digitar (nele, Espaço digita)
    await p.keyboard.press('Enter');
    await p.waitForSelector('.notas-card');
    if (i === 0) await p.screenshot({ path: foto('card-verso.png'), fullPage: true });
    await p.keyboard.press(String((i % 4) + 1));
  }
  await sairDaSessao(p);
});

await passo('simulado de prova completa', async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="set-modo"][data-modo="simulado"]');
  await p.click('[data-acao="set-prova"][data-prova="prova"]');
  await p.click('[data-acao="set-n"][data-n="60"]');
  await p.click('[data-acao="comecar"]');
  await p.waitForSelector('#sessao:not([hidden])');
  for (let i = 0; i < 20; i++) {
    if (i % 3 === 0) await p.check('[data-acao="duvida"]');
    await p.click(i % 5 === 4 ? '.bolha.b' : i % 2 ? '.bolha.e' : '.bolha.c');
  }
  await p.click('[data-acao="entregar"]');
  await p.click('[data-acao="confirmar-entrega"]');
  await p.waitForSelector('.nota-final');
  await p.screenshot({ path: foto('resultado.png'), fullPage: true });
  await p.click('[data-acao="fechar-sessao"]');
});

await passo('item com fonte não anexada mostra o aviso', async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="set-modo"][data-modo="treino"]');
  await p.click('[data-acao="preset"][data-preset="nada"]');
  await p.check('input[data-acao="toggle-bloco"][data-bloco="lei-9784"]');
  await p.click('[data-acao="comecar"]');
  await p.waitForSelector('#sessao:not([hidden]) .item-num');
  await responder(p);
  await p.waitForSelector('.veredito');
  await sairDaSessao(p);
  await p.click('[data-acao="preset"][data-preset="nada"]').catch(() => {});
});

await passo('itens reais: treino com selo, comando e apoio', async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="set-modo"][data-modo="treino"]');
  await p.click('[data-acao="reais"][data-modo="treino"]');
  await p.waitForSelector('#sessao:not([hidden])');
  if (!(await p.locator('#sessao .selo.real').count())) throw new Error('sem selo de item real');
  await responder(p, 'c');
  await p.waitForSelector('.veredito');
  await sairDaSessao(p);
});

await passo('itens reais: como prova', async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="reais"][data-modo="simulado"]');
  await p.waitForSelector('#sessao:not([hidden])');
  await p.screenshot({ path: foto('real-prova.png'), fullPage: true });
  await sairDaSessao(p);
});

await passo('como o Cebraspe cobra', async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="mais"][data-sub="cebraspe"]');
  await p.waitForSelector('.cb-disc');
  if (!(await p.locator('.chip.item-real').count())) throw new Error('sem itens citados');
  await p.click('[data-acao="rolar"][data-alvo="cb-discursiva"]');
  await p.locator('.chip.item-real').first().click();
  await p.waitForSelector('#folha:not([hidden])');
  await p.click('[data-acao="fechar-folha"]');
  await p.click('[data-acao="reais-disc"][data-d="linguas"]');
  await p.waitForSelector('#sessao:not([hidden])');
  await sairDaSessao(p);
});

await passo('aba cards', async () => {
  await p.click('.aba[data-vista="cards"]');
  await p.screenshot({ path: foto('cards.png'), fullPage: true });
  if (!(await p.locator('[data-acao="cards-iniciar"]').count())) throw new Error('aba cards sem o botão de estudar');
});

await passo('lei seca: ranking, grifos e busca', async () => {
  await p.click('.aba[data-vista="lei"]');
  await p.click('[data-acao="ranking"]');
  await p.locator('.ranking button').first().click();
  await p.waitForSelector('.texto-lei');
  await p.click('[data-acao="camada"][data-c="verbo"]');
  await p.click('[data-acao="voltar-lei"]');
  await p.click('[data-acao="ranking"]');
  await p.fill('#busca-lei', 'quinze dias');
  if (!(await p.locator('.resultado-busca button').count())) throw new Error('busca sem resultado');
  await p.fill('#busca-lei', '');
});

await passo('lei seca: outras normas', async () => {
  await p.click('.aba[data-vista="lei"]');
  await p.selectOption('#sel-lei', 'cf88');
  await p.waitForTimeout(150);
  await p.click('#vista-lei .art-btn[data-art="cf88:5"]');
  await p.waitForSelector('.texto-lei');
  if (!(await p.textContent('.texto-lei')).includes('LXXIX')) throw new Error('art. 5º da CF incompleto');
  await p.click('[data-acao="nav-art"][aria-label="Próximo artigo"]');
  await p.click('[data-acao="voltar-lei"]');
  for (const [lei, k] of [['dec1171', 'dec1171:XIV'], ['res19c', 'res19c:16'], ['eca', 'eca:263'], ['ingsi1', 'ingsi1:18'], ['gdpr', 'gdpr:33'], ['conv108', 'conv108:15'], ['nistcsf', 'nistcsf:GV.OC'], ['lei13460', 'lei13460:10-A']]) {
    await p.selectOption('#sel-lei', lei);
    await p.click('#vista-lei .art-btn[data-art="' + k + '"]');
    await p.waitForSelector('.texto-lei');
    await p.click('[data-acao="voltar-lei"]');
  }
  await p.selectOption('#sel-lei', 'lgpd');
});

await passo('leitura do dia até o fim da fila', async () => {
  await p.click('.aba[data-vista="hoje"]');
  // dia de matéria nova: a leitura sai pela página do subtema; nos outros dias, pela fila do dia
  if (await p.locator('[data-acao="ler-dia"]').count()) await p.click('[data-acao="ler-dia"]');
  else if (!(await p.locator('[data-acao="st-lei"]').count())) {
    // Matéria sem lei seca (segurança da informação, inglês): o passo de leitura sai e a aula fica à mão
    if (!(await p.locator('[data-acao="st-aula"]').count())) throw new Error('dia sem lei seca e sem botão de aula');
    return;
  } else {
    // "Ler os artigos" já abre o primeiro artigo do subtema
    await p.click('[data-acao="st-lei"]');
    await p.waitForSelector('#vista-mais .art-inline:not([hidden]) .art-inline-cab');
    return;
  }
  await p.waitForSelector('.fila-leitura');
  for (let i = 0; i < 40; i++) {
    if (await p.locator('[data-acao="fim-fila"]').count()) { await p.click('[data-acao="fim-fila"]'); return; }
    await p.click('[data-acao="nav-art"][aria-label="Próximo artigo"]');
  }
  throw new Error('a fila não terminou em 40 artigos');
});

await passo('aula da trilha com negritos e grifos', async () => {
  await p.click('.aba[data-vista="mais"]');
  await p.click('[data-acao="mais"][data-sub="menu"]').catch(() => {});
  await p.click('.menu-mais [data-sub="trilha"]');
  // O subtema fica dentro do grupo recolhido da trilha: aciona o botão direto
  await p.evaluate(() => document.querySelector('[data-acao="subtema"][data-st="const-eficacia"]').click());
  await p.waitForSelector('.texto-aula');
  const neg = await p.locator('.texto-aula .neg').count(), num = await p.locator('.texto-aula .g-num').count();
  if (neg < 5 || num < 3) throw new Error('negritos ' + neg + ', números ' + num);
  if ((await p.textContent('.texto-aula')).includes('**')) throw new Error('marcação ** aparecendo no texto');
  // Aula estruturada: ideia central, mapa mental com ramos e folhas, partes numeradas, caixas e tabela
  const est = await p.evaluate(() => {
    const a = document.querySelector('.cartao.aula');
    return { ideia: a.querySelectorAll('.ideia').length, ramos: a.querySelectorAll('.mapa .ramo').length, folhas: a.querySelectorAll('.mapa .folhas li').length,
      partes: a.querySelectorAll('.parte').length, porque: a.querySelectorAll('.cx-porque').length, tabelas: a.querySelectorAll('.tab-aula').length,
      largura: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  if (est.ideia !== 1 || est.ramos < 4 || est.folhas < 8 || est.partes < 4 || !est.porque || !est.tabelas || est.largura > 0) throw new Error('aula estruturada: ' + JSON.stringify(est));
  await p.click('.cartao.aula [data-acao="camada"][data-c="num"]');
  if (await p.locator('.texto-aula .g-num').count()) throw new Error('camada de números não desligou');
  await p.click('.cartao.aula [data-acao="camada"][data-c="num"]');
});

for (const sub of ['trilha', 'metodo', 'edital', 'raiox', 'cebraspe', 'discursiva', 'personagem', 'progresso', 'plano', 'pesquisar', 'glossario', 'contestacoes', 'ajustes']) {
  await passo('mais/' + sub + ' sem rolagem horizontal', async () => {
    await p.click('.aba[data-vista="mais"]');
    await p.click('[data-acao="mais"][data-sub="menu"]').catch(() => {});
    await p.click('.menu-mais [data-sub="' + sub + '"]');
    await p.waitForTimeout(100);
    await p.screenshot({ path: foto('mais-' + sub + '.png'), fullPage: true });
    const larg = await larguraSobrando(p);
    if (larg > 0) throw new Error(larg + 'px a mais');
  });
}

await passo('backup em texto', async () => {
  await p.click('.aba[data-vista="mais"]');
  await p.click('[data-acao="mais"][data-sub="menu"]').catch(() => {});
  await p.click('.menu-mais [data-sub="ajustes"]');
  await p.click('[data-acao="backup-mostrar"]');
  const j = JSON.parse(await p.inputValue('#zona-backup textarea'));
  if (!j.itens && !(j.dados && j.dados.itens)) throw new Error('backup sem respostas: ' + Object.keys(j).join(','));
});

await passo('relâmpago', async () => {
  await p.click('.aba[data-vista="hoje"]');
  await p.click('[data-acao="relampago"]');
  for (let i = 0; i < 3; i++) { await p.click('.bolha.c'); await p.waitForTimeout(900); }
  await sairDaSessao(p);
});

const xp = await p.textContent('.pilula.xp');
await p.reload();
await p.waitForTimeout(300);
conferir('XP sobrevive a recarregar a página', (await p.textContent('.pilula.xp')) === xp, xp);
for (const v of ['hoje', 'questoes', 'cards', 'lei', 'mais']) {
  await p.click('.aba[data-vista="' + v + '"]');
  const larg = await larguraSobrando(p);
  conferir('aba ' + v + ' sem rolagem horizontal', larg <= 0, larg + 'px');
}

await passo('computador, tema escuro', async () => {
  const d = await pagina({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
  await d.click('[data-acao="iniciar-dia"]');
  await d.keyboard.press('e');
  await d.waitForSelector('.veredito');
  await d.screenshot({ path: foto('desktop-escuro.png') });
});
await passo('celular, tema escuro', async () => {
  const e = await pagina({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  await e.click('.aba[data-vista="mais"]');
  await e.click('.menu-mais [data-sub="cebraspe"]');
  await e.waitForTimeout(150);
  await e.screenshot({ path: foto('cebraspe-escuro.png'), fullPage: true });
});

await browser.close();
fim(erros);
