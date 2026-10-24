// Gaveta de erros na lei seca: o artigo aberto mostra os itens dele que a pessoa já errou, com gabarito, comentário e a
// regra do Caderno de Erros; os ainda não recuperados vêm primeiro. Artigo sem erro não tem gaveta.
import { APP, abrirNavegador, diaDeEstudo, placar, vigiarErros } from './comum.mjs';
import { montarDados } from '../build.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
// Todos os itens com artigo ganham um erro; os de número par já foram recuperados (nível 2)
const ids = montarDados().questoes.filter((q) => q.art).map((q) => q.id);

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await diaDeEstudo(ctx);
await ctx.addInitScript((ids) => {
  if (sessionStorage.getItem('semeado')) return;
  sessionStorage.setItem('semeado', '1');
  const agora = new Date(), hoje = Math.round(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()) / 86400000);
  const itens = {};
  ids.forEach((id, i) => { itens[id] = [i % 2 ? 0 : 2, hoje + 3, i % 2 ? 0 : 1, 1, hoje - 1, 0, 0]; });
  const iso = new Date(hoje * 86400000).toISOString().slice(0, 10);
  const perfil = { xp: 0, meta: 30, novosCards: 5, intercaladas: 20, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: iso,
    cad: { erros: { [ids[1]]: { causa: 'nao-sabia', nota: 'Regra de teste da gaveta', data: iso } } } };
  localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
}, ids);
const p = await ctx.newPage();
p.setDefaultTimeout(8000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(600);

await passo('artigo da lei seca mostra a gaveta com os erros', async () => {
  await p.click('.aba[data-vista="lei"]');
  await p.click('[data-acao="ranking"]');
  await p.locator('.ranking button').first().click();
  await p.waitForSelector('.erros-art');
  const resumo = (await p.textContent('.erros-art summary')).trim();
  if (!/^Seus erros neste artigo \(\d+/.test(resumo)) throw new Error('resumo: ' + resumo);
  await p.click('.erros-art summary');
  const primeiro = await p.locator('.erro-art').first().getAttribute('class');
  conferir('os não recuperados vêm primeiro', !/virou/.test(primeiro), primeiro);
  conferir('gabarito e comentário', /Gabarito: (certo|errado|letra [A-E])\./.test(await p.textContent('.erro-art')));
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await browser.close();
fim(erros);
