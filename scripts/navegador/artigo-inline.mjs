// O artigo abre na própria tela, logo abaixo do botão: no comentário do item (sessão), no card e na página do subtema.
// Dispositivo revogado aparece sem o texto antigo; remissão a outro artigo da mesma norma abre logo abaixo da linha; o
// juridiquês do artigo vem traduzido embaixo dele.
// Sem folha por cima e sem trocar de aba, para não depender do jeito como o aparelho desenha camadas fixas. Um erro
// qualquer vira aviso e fica no diagnóstico.
import { APP, abrirNavegador, placar, responder, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const p = await ctx.newPage();
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(600);

await passo('no comentário do item, "Ler inteiro" abre o artigo logo abaixo, e o mesmo botão fecha', async () => {
  await p.click('.aba[data-vista="questoes"]');
  await p.click('[data-acao="preset"][data-preset="p1"]');
  await p.click('[data-acao="comecar"]');
  await p.waitForSelector('#sessao:not([hidden])');
  for (let k = 0; k < 20 && !(await p.locator('#sessao [data-acao="art-inline"]').count()); k++) {
    await responder(p);
    await p.waitForTimeout(100);
    if (!(await p.locator('#sessao [data-acao="art-inline"]').count())) await p.click('#sessao [data-acao="proximo"]');
  }
  const b = p.locator('#sessao [data-acao="art-inline"]').first();
  await b.tap();
  const caixa = p.locator('#sessao .art-inline:not([hidden])');
  if (!(await caixa.count())) throw new Error('o artigo não apareceu');
  if (!(await caixa.locator('.texto-lei p').count())) throw new Error('caixa sem o texto do artigo');
  if ((await b.getAttribute('aria-expanded')) !== 'true') throw new Error('botão sem aria-expanded');
  if (!(await p.locator('#folha').isHidden())) throw new Error('abriu a folha por cima');
  await b.tap();
  if (await p.locator('#sessao .art-inline:not([hidden])').count()) throw new Error('o segundo toque não fechou');
  const lidos = await p.evaluate(() => Object.keys((JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.lidos) || {}));
  if (!lidos.length) throw new Error('artigo não marcado como lido');
  await p.click('[data-acao="sair-sessao"]');
  if (await p.locator('[data-acao="confirmar-saida"]').count()) await p.click('[data-acao="confirmar-saida"]');
});

await passo('na página do subtema, cada artigo abre embaixo dos botões, com anterior e próximo', async () => {
  await p.click('.aba[data-vista="mais"]');
  await p.click('.menu-mais [data-sub="trilha"]');
  await p.click('#vista-mais [data-acao="subtema"][data-st="pd-alcance"]');
  const chips = p.locator('#vista-mais .chip[data-acao="art-inline"]');
  if ((await chips.count()) < 2) throw new Error('subtema sem artigos');
  await chips.first().tap();
  const caixa = p.locator('#vista-mais .art-inline:not([hidden])');
  const t1 = (await caixa.locator('.art-inline-cab b').textContent()) || '';
  if (!/Art\. 1/.test(t1)) throw new Error('primeiro artigo: ' + t1);
  if ((await chips.first().getAttribute('aria-expanded')) !== 'true') throw new Error('chip não ficou marcado');
  await caixa.locator('[data-acao="art-inline"]').last().tap();
  const t2 = (await p.locator('#vista-mais .art-inline:not([hidden]) .art-inline-cab b').textContent()) || '';
  if (!/Art\. 2/.test(t2)) throw new Error('próximo artigo: ' + t2);
  if ((await chips.nth(1).getAttribute('aria-expanded')) !== 'true') throw new Error('o chip do artigo novo não ficou marcado');
  if (!(await p.locator('#vista-mais').isVisible())) throw new Error('trocou de aba');
});

await passo('parágrafo revogado aparece só com o rótulo e a nota, sem o texto antigo', async () => {
  await p.click('.aba[data-vista="lei"]');
  await p.selectOption('#vista-lei select[data-acao="sel-lei"]', 'res1');
  await p.click('#vista-lei [data-acao="abrir-art"][data-art="res1:35"]');
  const linhas = (await p.locator('#vista-lei .texto-lei p').allTextContents()).map((t) => t.trim());
  const rev = linhas.find((t) => /^§ 4º/.test(t)) || '';
  if (!/^§ 4º \(Revogado pela Resolução CD\/ANPD nº 4/.test(rev)) throw new Error('§ 4º: ' + rev);
  if (/não atendimento/.test(linhas.join(' '))) throw new Error('o texto revogado continua lá');
  if (!(await p.locator('#vista-lei .texto-lei p.vetado').count())) throw new Error('a linha revogada não ficou apagada');
});

await passo('no texto da lei, "art. 16 desta Lei" abre o art. 16 logo abaixo da linha, e o mesmo toque fecha', async () => {
  await p.click('#vista-lei [data-acao="voltar-lei"]');
  await p.selectOption('#vista-lei select[data-acao="sel-lei"]', 'lgpd');
  // o artigo fica dentro do capítulo recolhido: aciona o botão direto
  await p.evaluate(() => document.querySelector('#vista-lei [data-acao="abrir-art"][data-art="18"]').click());
  const ref = p.locator('#vista-lei .texto-lei .ref-art[data-art="16"]').first();
  if (!(await ref.count())) throw new Error('a remissão ao art. 16 não virou botão');
  await ref.tap();
  const caixa = p.locator('#vista-lei .art-inline.remissao:not([hidden])');
  const cab = (await caixa.locator('.art-inline-cab b').textContent()) || '';
  if (!/Art\. 16/.test(cab)) throw new Error('abriu: ' + cab);
  if (!(await caixa.locator('.texto-lei p').count())) throw new Error('caixa sem o texto');
  if (await caixa.locator('.legenda-fixa').count()) throw new Error('a caixa da remissão repete a legenda');
  const jur = await p.locator('#vista-lei details.juridiques[open] dt').allTextContents();
  if (!jur.includes('mediante')) throw new Error('o juridiquês do art. 18 não veio traduzido: ' + jur.join(', '));
  await ref.tap();
  if (await p.locator('#vista-lei .art-inline.remissao:not([hidden])').count()) throw new Error('o segundo toque não fechou');
  // citação de outra norma não vira botão: "art. 52 da Constituição Federal" no art. 55-D
  await p.click('#vista-lei [data-acao="voltar-lei"]');
  await p.evaluate(() => document.querySelector('#vista-lei [data-acao="abrir-art"][data-art="55-D"]').click());
  if (await p.locator('#vista-lei .texto-lei .ref-art[data-art="52"]').count()) throw new Error('"art. 52 da Constituição" virou link para o art. 52 da LGPD');
});

await passo('um erro de programa vira aviso e aparece no diagnóstico', async () => {
  await p.evaluate(() => setTimeout(() => { throw new Error('erro de teste do painel'); }, 0));
  await p.waitForTimeout(300);
  const aviso = (await p.textContent('#avisos')) || '';
  if (!/erro de teste do painel/.test(aviso)) throw new Error('sem aviso: ' + aviso.slice(0, 120));
  await p.click('.topo [data-sub="ajustes"]');
  const diag = (await p.textContent('#vista-mais')) || '';
  if (!/Erros nesta abertura[^]*erro de teste do painel/.test(diag)) throw new Error('diagnóstico sem o erro');
  const salvo = await p.evaluate(() => (JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.erros || []).map((e) => e.m));
  conferir('o erro fica no perfil', salvo.some((m) => /erro de teste/.test(m)), salvo.join(' | '));
});

await browser.close();
// o erro provocado de propósito não conta como falha do app
fim(erros.filter((e) => !/erro de teste do painel/.test(e)));
