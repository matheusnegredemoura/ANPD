// Correção do item no treino: relógio do item no topo, palavras de polaridade grifadas só depois da resposta, causa do
// erro marcada na hora (vai para o Caderno de Erros) e, no fim, o tempo médio por item. Na discursiva, a lista de
// autoverificação aparece antes de corrigir.
import { APP, abrirNavegador, diaDeEstudo, placar, vigiarErros } from './comum.mjs';
import { montarDados } from '../build.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const Q = montarDados().questoes.filter((q) => !q.al && !q.ap && q.art && /\b(somente|exclusivamente|salvo|sempre)\b/i.test(q.e));
const ids = Q.slice(0, 3).map((q) => q.id);
const gab = new Map(Q.map((q) => [q.id, q.g]));

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await diaDeEstudo(ctx);
await ctx.addInitScript((ids) => {
  if (sessionStorage.getItem('semeado')) return;
  sessionStorage.setItem('semeado', '1');
  const d = new Date(), hoje = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const perfil = { xp: 0, meta: 30, novosCards: 5, intercaladas: 20, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: hoje,
    pausas: { rapido: { modo: 'treino', titulo: 'Teste da correção', data: hoje, ts: Date.now(), ids, feitas: 0, total: ids.length } } };
  localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
}, ids);
const p = await ctx.newPage();
p.setDefaultTimeout(8000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(600);
const atual = async () => (await p.textContent('.item .item-num')).trim();

await passo('relógio do item, grifo de polaridade depois da resposta e causa do erro', async () => {
  await p.locator('[data-acao="retomar-pausa"]').first().click();
  await p.waitForSelector('#sessao:not([hidden])');
  conferir('relógio do item no topo', (await p.locator('#t-item').count()) === 1);
  conferir('sem grifo antes de responder', !(await p.locator('.enunciado .g-alerta').count()));
  await p.waitForTimeout(1200);
  conferir('o relógio anda', /0:0[1-9]/.test(await p.textContent('#t-item')), await p.textContent('#t-item'));
  const id = await atual();
  await p.click('.bolha.' + (gab.get(id) === 'C' ? 'e' : 'c'));
  await p.waitForSelector('.causa-agora');
  conferir('grifo de polaridade depois da resposta', (await p.locator('.enunciado .g-alerta').count()) >= 1);
  await p.click('.causa-agora [data-causa="leu-errado"]');
  const cad = await p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.cad);
  conferir('causa gravada no Caderno de Erros', cad && cad.erros && cad.erros[Object.keys(cad.erros)[0]].causa === 'leu-errado', JSON.stringify(cad));
  conferir('chip marcado', (await p.locator('.causa-agora [data-causa="leu-errado"]').getAttribute('aria-pressed')) === 'true');
  await p.click('.causa-agora [data-causa="nao-sabia"]');
  conferir('não sabia: botão para o artigo ali mesmo', /Abrir o artigo agora/.test(await p.textContent('.causa-agora')));
  for (let k = 0; k < 2; k++) {
    await p.click('[data-acao="proximo"]');
    const i2 = await atual();
    await p.click('.bolha.' + gab.get(i2).toLowerCase());
    conferir('acerto não pede causa', !(await p.locator('.causa-agora').count()));
  }
  await p.click('[data-acao="proximo"]');
  await p.waitForSelector('.ritmo-sessao');
  conferir('resultado com o tempo por item', /Tempo por item: média de/.test(await p.textContent('.ritmo-sessao')));
});

await passo('discursiva mostra a autoverificação antes de corrigir', async () => {
  await p.click('[data-acao="fechar-sessao"]');
  await p.click('.aba[data-vista="mais"]');
  await p.click('#vista-mais [data-acao="mais"][data-sub="discursiva"]');
  await p.locator('[data-acao="disc-abrir"]').first().click();
  await p.waitForSelector('.check-disc');
  conferir('seis pontos para conferir', (await p.locator('.check-disc li').count()) === 6);
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await browser.close();
fim(erros);
