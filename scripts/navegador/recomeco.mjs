// Recomeçar o plano: depois de dias sem estudo, o botão do cartão do atraso leva o que não foi feito para a
// frente, a começar no dia da volta (no seguinte, se já houve estudo nele), na mesma ordem. O atraso zera, a próxima sessão é a do primeiro dia parado e a
// escolha fica gravada; dá para recomeçar de novo sobre o primeiro recomeço e desfazer um de cada vez. Também confere
// que um dia com as questões feitas e só a leitura pendente não entra no atraso.
// O estado é semeado uma vez por contexto, já na data do teste: recarregar a aba às vezes perde o armazenamento no
// Playwright (como em sequencia-recuperada), então a gravação é conferida no próprio armazenamento.
import { APP, abrirNavegador, placar, vigiarErros } from './comum.mjs';
import { readFileSync } from 'node:fs';

const plano = JSON.parse(readFileSync(new URL('../../dados/cronograma.json', import.meta.url), 'utf8'));
const dias = plano.fases.flatMap((f) => f.semanas.flatMap((s) => s.dias)).sort((a, b) => (a.data < b.data ? -1 : 1));
// Três dias de questões seguidos, sem discursiva (discursiva pendente de um dia feito continua no atraso, de propósito):
// o perfil nasce no primeiro, que fica feito, e o teste volta dois dias depois do terceiro
const k = dias.findIndex((d, i) => i > 20 && [0, 1, 2].every((j) => dias[i + j] && dias[i + j].modo === 'treino' && !dias[i + j].disc));
const A = dias[k].data, prox = dias[k + 1], num = (iso) => Date.parse(iso + 'T10:00:00'), iso = (t) => new Date(t).toISOString().slice(0, 10);
const B = iso(num(dias[k + 2].data) + 864e5 * 2);
const ddmm = (s) => s.slice(8, 10) + '/' + s.slice(5, 7);
// Sem estudo no dia da volta, o recomeço começa nele mesmo (ou na segunda, se for domingo)
const recomeco = (de) => { let t = num(de); while (new Date(t).getDay() === 0) t += 864e5; return iso(t); };
const CHAVE = 'painel-anpd-v3';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
async function abrir(data, perfil) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1400 } });
  await ctx.clock.install({ time: new Date(data + 'T10:00:00') });
  await ctx.addInitScript(([chave, perfil]) => {
    if (location.protocol === 'about:' || window.name === 'semeado') return;
    window.name = 'semeado';
    localStorage.setItem(chave, JSON.stringify({ perfil, itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
  }, [CHAVE, perfil]);
  const p = await ctx.newPage();
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForSelector('.aba');
  await p.waitForTimeout(700);
  const cartao = async () => ((await p.locator('.cartao.pendencias').textContent().catch(() => '')) || '').replace(/\s+/g, ' ');
  const tela = async () => ((await p.textContent('main')) || '').replace(/\s+/g, ' ');
  const gravado = () => p.evaluate((c) => JSON.parse(localStorage.getItem(c)).perfil.recomecos || [], CHAVE);
  return { ctx, p, cartao, tela, gravado };
}

const dia1 = recomeco(B);
let rc1 = null;
{
  const { ctx, p, cartao, tela, gravado } = await abrir(B, { criado: A, feitos: { [A]: A } });
  await passo('dia com questões feitas e só leitura pendente fica fora do atraso', async () => {
    await p.click('details[data-det="atraso"] summary').catch(() => {});
    await p.waitForTimeout(300);
    const t = await cartao();
    conferir('há atraso dos dias parados', /Ver os \d+ dias/.test(t), t.slice(0, 160));
    conferir('o dia de questões feitas não está nele', !t.includes('., ' + ddmm(A)), ddmm(A));
  });
  await passo('recomeçar leva o parado para o dia da volta', async () => {
    await p.click('[data-acao="recomecar"]');
    await p.waitForTimeout(500);
    const t = await cartao(), m = await tela();
    conferir('atraso zera e o cartão diz desde quando', /Atraso do plano\s*0/.test(t) && t.includes('Plano recomeçado em ' + ddmm(dia1)), t.slice(0, 200));
    conferir('a sessão do dia é a do primeiro dia parado', m.includes(prox.atividade.slice(0, 30)), m.slice(0, 240));
    const g = await gravado();
    conferir('a escolha fica gravada no perfil', g.length === 1 && g[0].de === prox.data && g[0].para === dia1, JSON.stringify(g));
    rc1 = g[0];
  });
  await ctx.close();
}

// Mais três dias parados depois do primeiro recomeço: um segundo recomeço vai sobre ele, e desfazer tira só o último
const C = iso(num(dia1) + 864e5 * 3), dia2 = recomeco(C);
if (rc1) {
  const { ctx, p, cartao, tela, gravado } = await abrir(C, { criado: A, feitos: { [A]: A }, recomecos: [rc1] });
  await passo('segundo recomeço e desfazer um de cada vez', async () => {
    conferir('parou de novo: há atraso', /Ver os \d+ dias/.test(await cartao()));
    await p.click('[data-acao="recomecar"]');
    await p.waitForTimeout(500);
    const m = await tela();
    conferir('o segundo recomeço começa no dia seguinte, ainda com o primeiro dia parado', (await cartao()).includes('Plano recomeçado em ' + ddmm(dia2)) && m.includes(prox.atividade.slice(0, 30)), m.slice(0, 240));
    conferir('os dois recomeços ficam gravados', (await gravado()).length === 2);
    await p.click('[data-acao="recomeco-desfazer"]');
    await p.waitForTimeout(500);
    conferir('desfazer volta ao primeiro recomeço (com o atraso dele)', /Ver os \d+ dias/.test(await cartao()) && (await gravado()).length === 1);
  });
  await ctx.close();
}

conferir('sem erro de página', !erros.length, erros.join(' | '));
await browser.close();
fim(erros);
