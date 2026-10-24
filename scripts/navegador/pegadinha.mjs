// Caça-Pegadinha: depois de acertar um item errado elegível, a pessoa aponta o tipo da pegadinha. O tipo da armadilha
// fica escondido na explicação até a escolha; acertar dá +8 XP e conta para a missão e as conquistas; errar mostra qual
// era, sem tirar nada. Item marcado como certo (errou) não tem caça.
import { APP, abrirNavegador, diaDeEstudo, foto, placar, vigiarErros } from './comum.mjs';
import { montarDados } from '../build.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const pg = new Map(montarDados().questoes.filter((q) => q.pg).map((q) => [q.id, q.pg]));
const ids = [...pg.keys()].slice(0, 3);

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await diaDeEstudo(ctx);
await ctx.addInitScript((ids) => {
  if (sessionStorage.getItem('semeado')) return;
  sessionStorage.setItem('semeado', '1');
  const d = new Date(), hoje = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const perfil = { xp: 500, meta: 30, novosCards: 5, intercaladas: 20, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: hoje,
    pausas: { rapido: { modo: 'treino', titulo: 'Teste da caça', data: hoje, ts: Date.now(), ids, feitas: 0, total: ids.length } } };
  localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
}, ids);
const p = await ctx.newPage();
p.setDefaultTimeout(8000);
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(600);
const atual = async () => (await p.textContent('.item .item-num')).trim();
const xp = () => p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.xp);

await passo('acertar o tipo da pegadinha dá golpe certeiro', async () => {
  await p.locator('[data-acao="retomar-pausa"]').first().click();
  await p.waitForSelector('#sessao:not([hidden])');
  const id = await atual();
  await p.click('.bolha.e');
  await p.waitForSelector('.caca');
  await p.locator('.caca').scrollIntoViewIfNeeded();
  await p.screenshot({ path: foto('pegadinha.png') });
  conferir('o tipo da armadilha fica escondido até a escolha', !/armadilha:/.test(await p.textContent('.explica .gab')));
  conferir('três ou quatro alternativas', [3, 4].includes(await p.locator('.caca [data-acao="pegadinha"]').count()));
  const antes = await xp();
  await p.click('.caca [data-t="' + pg.get(id)[0] + '"]');
  await p.waitForSelector('.caca.ok');
  await p.screenshot({ path: foto('pegadinha-ok.png') });
  conferir('golpe certeiro', /Golpe certeiro/.test(await p.textContent('.caca')));
  conferir('ganhou o XP do golpe', (await xp()) >= antes + 8, antes + ' → ' + (await xp()));
  conferir('a armadilha aparece depois da escolha', /armadilha:/.test(await p.textContent('.explica .gab')));
  const rpg = await p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.rpg.peg);
  conferir('placar da caça gravado', JSON.stringify(rpg) === '[1,1]', JSON.stringify(rpg));
  await p.click('[data-acao="proximo"]');
});

await passo('errar o tipo mostra qual era, sem tirar XP', async () => {
  const id = await atual();
  await p.click('.bolha.e');
  await p.waitForSelector('.caca');
  const antes = await xp();
  await p.click('.caca [data-t="' + pg.get(id)[1] + '"]');
  await p.waitForSelector('.caca.no');
  conferir('mostra o tipo certo', /Era /.test(await p.textContent('.caca')));
  conferir('XP igual', (await xp()) === antes);
  await p.click('[data-acao="proximo"]');
});

await passo('marcar certo num item errado não abre a caça', async () => {
  await p.click('.bolha.c');
  await p.waitForSelector('.explica');
  conferir('sem caça', !(await p.locator('.caca').count()));
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await browser.close();
fim(erros);
