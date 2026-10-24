// Trilhas do zero: a aula do dia segue a matéria principal do plano (ECA Digital em 09/11/2026), a trilha de ECA
// Digital aparece com seus subtemas e a aula, e o pré-teste do subtema abre. Passar de tema fica registrado: depois de
// abrir a aula do subtema 1 e seguir para o 2, quem sai do app e volta encontra "Onde você parou" no 2, e a lista
// mostra o 1 como estudado e o botão Continuar no 2.
import { readFileSync } from 'node:fs';
import { APP, abrirNavegador, foto, placar, vigiarErros } from './comum.mjs';

const plano = JSON.parse(readFileSync(new URL('../../dados/cronograma.json', import.meta.url), 'utf8'));
const dias = plano.fases.flatMap((f) => f.semanas.flatMap((s) => s.dias));
const diaEca = dias.find((d) => d.blocos[0] === 'eca-digital');
const diaLgpd = dias.find((d) => d.blocos[0] === 'lgpd-17-22');

const browser = await abrirNavegador();
const { conferir, fim } = placar();
const erros = [];

async function passoDaTrilha(data) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.clock.install({ time: new Date(data + 'T10:00:00') });
  const p = await ctx.newPage();
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForTimeout(500);
  const passo = ((await p.locator('.roteiro .passo', { hasText: 'do zero' }).first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ');
  return { ctx, p, passo };
}

const eca = await passoDaTrilha(diaEca.data);
conferir('em ' + diaEca.data + ' (ECA Digital no plano) a aula do dia é de ECA Digital', /ECA Digital do zero/.test(eca.passo), eca.passo.slice(0, 120));
await eca.ctx.close();

const lgpd = await passoDaTrilha(diaLgpd.data);
conferir('em ' + diaLgpd.data + ' (LGPD no plano) a aula do dia é de LGPD', /LGPD do zero/.test(lgpd.passo), lgpd.passo.slice(0, 120));
const p = lgpd.p;
await p.click('.aba[data-vista="mais"]');
await p.click('[data-acao="mais"][data-sub="menu"]').catch(() => {});
await p.click('.menu-mais [data-sub="trilha"]');
await p.waitForTimeout(200);
const pagina = ((await p.textContent('#vista-mais')) || '').replace(/\s+/g, ' ');
conferir('a página de trilhas tem a trilha de ECA Digital', /ECA Digital do zero/.test(pagina));
const nTrilhas = JSON.parse(readFileSync(new URL('../../dados/trilhas.json', import.meta.url), 'utf8')).trilhas.length;
conferir('o menu de trilhas tem uma matéria por trilha (' + nTrilhas + ')', (await p.locator('.cb-nav .chip').count()) === nTrilhas, String(await p.locator('.cb-nav .chip').count()));
await p.locator('[data-acao="subtema"][data-st="ed-fiscalizacao"]').click();
await p.waitForTimeout(200);
const aula = ((await p.textContent('#vista-mais')) || '').replace(/\s+/g, ' ');
conferir('a aula de sanções do ECA Digital separa ANPD e Judiciário', /Poder Judiciário/.test(aula) && /10% do faturamento/.test(aula));
await p.screenshot({ path: foto('trilha-eca.png'), fullPage: true });
const sobra = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
conferir('a aula não estoura a largura do celular', sobra <= 0, String(sobra));

// Pré-teste de um subtema novo: os itens vêm do mais fácil ao mais difícil
await p.locator('#vista-mais [data-acao="trilha-sessao"][data-tipo="pre"]').first().click().catch((e) => console.log('clique:', e.message.split('\n')[0]));
await p.waitForSelector('#sessao:not([hidden])', { timeout: 5000 }).catch(() => {});
conferir('o pré-teste do subtema abre', await p.locator('#sessao:not([hidden])').count() === 1);
await lgpd.ctx.close();

{
  const trilhas = JSON.parse(readFileSync(new URL('../../dados/trilhas.json', import.meta.url), 'utf8')).trilhas;
  const [st1, st2] = trilhas.find((t) => t.id === 'regulacao').subtemas;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForTimeout(500);
  const abrirTrilhas = async () => {
    await p.click('.aba[data-vista="mais"]');
    await p.click('[data-acao="mais"][data-sub="menu"]').catch(() => {});
    await p.click('.menu-mais [data-sub="trilha"]');
    await p.waitForTimeout(200);
  };
  await abrirTrilhas();
  await p.click('[data-acao="subtema"][data-st="' + st1.id + '"]');
  await p.click('[data-acao="st-aula"][data-st="' + st1.id + '"]');
  await p.click('[data-acao="subtema"][data-de="' + st1.id + '"]');
  await p.waitForTimeout(200);
  const salvo = await p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.trilha || {});
  conferir('abrir a aula e seguir para o próximo registra o subtema como estudado', !!salvo[st1.id], JSON.stringify(salvo));
  await p.reload();
  await p.waitForTimeout(500);
  await abrirTrilhas();
  const onde = await p.locator('.retomar-st').getAttribute('data-st').catch(() => null);
  conferir('ao voltar ao app, as trilhas oferecem retomar o subtema em que a pessoa estava', onde === st2.id, String(onde));
  if (onde) {
    await p.click('.retomar-st');
    await p.waitForTimeout(200);
    conferir('Retomar abre esse subtema', ((await p.textContent('.titulo-st')) || '').trim() === st2.nome);
    await p.click('.voltar[data-acao="subtema"]');
    await p.waitForTimeout(200);
  }
  const cont = await p.locator('#tr-regulacao .continuar-st').getAttribute('data-st').catch(() => null);
  conferir('a lista mostra Continuar no subtema seguinte ao estudado', cont === st2.id, String(cont));
  const chip = ((await p.locator('#tr-regulacao [data-st="' + st1.id + '"] .selo').textContent().catch(() => '')) || '').trim();
  conferir('o subtema estudado aparece como aula feita', chip === 'aula feita', chip);
  await ctx.close();
}

await browser.close();
fim(erros);
