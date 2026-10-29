// Cards por baralho: card de lei mostra a referência e o link para o artigo grifado; card de conceito (doutrina)
// mostra o tema e nenhum link. Estudo livre: com o lote de novos do dia já gasto, Estudar segue trazendo novos.
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

for (const [bloco, rotulo, comLink] of [['riscos', /^Doutrina · /, false], ['lei-13460', /^Lei 13\.460, art\./, true], ['orcamento', /^(CF\/88|LRF|Lei 4\.320)[^,]*, art\. \d/, true]]) {
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

await passo('lote de novos do dia já gasto não trava a aba', async () => {
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx2.addInitScript(() => {
    if (sessionStorage.getItem('semeado')) return;
    sessionStorage.setItem('semeado', '1');
    const d = new Date(), hoje = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const perfil = { xp: 0, meta: 30, novosCards: 5, intercaladas: 20, melhorSeq: 0, dias: { [hoje]: { r: 0, c: 0, e: 0, b: 0, xp: 0, k: 10, n: 5, nc: 5, a: [], t: {} } }, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: hoje };
    localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
  });
  const p2 = await ctx2.newPage();
  vigiarErros(p2, erros);
  await p2.goto(APP);
  await p2.waitForTimeout(400);
  await p2.click('.aba[data-vista="cards"]');
  const btn = p2.locator('[data-acao="cards-iniciar"]');
  if (await btn.isDisabled()) throw new Error('Estudar desabilitado: ' + (await btn.textContent()));
  if (!/Estudar \(5\)/.test(await btn.textContent())) throw new Error('esperava 5 novos: ' + (await btn.textContent()));
  await ctx2.close();
});

await browser.close();
fim(erros);
