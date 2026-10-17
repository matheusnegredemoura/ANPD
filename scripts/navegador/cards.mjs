// Cards por baralho: card de lei mostra a referência e o link para o artigo grifado; card de conceito (doutrina)
// mostra o tema e nenhum link.
import { APP, abrirNavegador, foto, placar, sairDaSessao, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const erros = [];
const { passo, fim } = placar();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
p.setDefaultTimeout(4000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(400);

for (const [bloco, rotulo, comLink] of [['riscos', /^Doutrina · /, false], ['lei-13460', /^Lei 13\.460, art\./, true], ['orcamento', /^CF\/88, art\. 16[5-9]/, true]]) {
  await passo('baralho ' + bloco, async () => {
    await p.click('.aba[data-vista="cards"]');
    for (const el of await p.locator('#vista-cards input[data-acao="toggle-bloco-card"]:checked').all()) await el.click();
    await p.click('#vista-cards input[data-bloco="' + bloco + '"]');
    await p.click('[data-acao="cards-iniciar"]');
    await p.waitForSelector('#sessao:not([hidden]) .card-cloze');
    const ref = (await p.textContent('#sessao p.mono.pequeno')).trim();
    if (!rotulo.test(ref)) throw new Error('referência inesperada: ' + ref);
    await p.click('[data-acao="revelar"]');
    const link = (await p.locator('#sessao [data-acao="art-inline"]').count()) > 0;
    if (link !== comLink) throw new Error(comLink ? 'card de lei sem link para o artigo' : 'card de doutrina com link para artigo');
    await p.locator('#sessao').screenshot({ path: foto('card-' + bloco + '.png') });
    await p.click('[data-acao="avaliar"][data-n="3"]');
    await sairDaSessao(p);
  });
}

await browser.close();
fim(erros);
