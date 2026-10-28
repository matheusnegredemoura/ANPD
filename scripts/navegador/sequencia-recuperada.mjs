// Sequência de volta quando o atraso zera: dois dias do plano perdidos na mesma semana quebram a sequência; recuperados
// os dois (o atraso some), eles voltam a contar e a marca fica gravada; dispensados, o atraso some mas a sequência
// continua quebrada.
import { APP, abrirNavegador, placar, vigiarErros } from './comum.mjs';
import { montarDados } from '../build.mjs';

const dados = montarDados();
const plano = dados.cronograma.fases.flatMap((f) => f.semanas.flatMap((s) => s.dias)).sort((a, b) => (a.data < b.data ? -1 : 1));
const porData = new Map(plano.map((d) => [d.data, d]));
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const num = (s) => Date.parse(s + 'T12:00:00Z');
// Segunda e terça de questões (sem discursiva), com uma semana de plano antes e a quinta seguinte também no plano
const m1 = plano.find((d) => {
  const t = num(d.data), d2 = porData.get(iso(t + 864e5));
  return new Date(t).getUTCDay() === 1 && d.modo !== 'revisao' && !d.disc && d2 && d2.modo !== 'revisao' && !d2.disc && porData.has(iso(t - 7 * 864e5)) && porData.has(iso(t + 3 * 864e5));
}).data;
const m2 = iso(num(m1) + 864e5), hoje = iso(num(m1) + 3 * 864e5), criado = iso(num(m1) - 7 * 864e5);
// Todos os artigos lidos: o atraso fica só com as sessões dos dias perdidos
const lidos = {};
for (const [lei, l] of Object.entries(dados.lei)) for (const a of l.artigos || []) lidos[lei === 'lgpd' ? a.id : lei + ':' + a.id] = criado;
function estado(extraFeitos, dispensados) {
  const dias = {}, feitos = {};
  for (let t = num(criado); t < num(hoje); t += 864e5) {
    const d = iso(t);
    if (d !== m1 && d !== m2) dias[d] = { r: 20, c: 15, e: 5 };
    const p = porData.get(d);
    if (p && d !== m1 && d !== m2) { feitos[d] = 1; if (p.disc) feitos['disc:' + d] = 1; }
  }
  for (const d of extraFeitos) feitos[d] = 1;
  return { perfil: { xp: 0, meta: 30, novosCards: 20, intercaladas: 30, melhorSeq: 0, dias, conq: {}, recordes: {}, status: {}, feitos, lidos, saidos: 0, criado, dispensados }, itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} };
}
const dentro = (num(hoje) - num(criado)) / 864e5;

const browser = await abrirNavegador();
const { conferir, fim } = placar();
const erros = [];
async function abrir(est) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.clock.install({ time: new Date(hoje + 'T10:00:00') });
  await ctx.addInitScript((e) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('painel-anpd-v3', JSON.stringify(e)); }, est);
  const p = await ctx.newPage();
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForSelector('#vista-hoje .roteiro');
  return p;
}
const fogo = async (p) => Number((await p.textContent('.pilula.fogo')).trim());
const recuperados = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.recuperados || {});

let p = await abrir(estado([], {}));
let t = (await p.textContent('#vista-hoje')).replace(/\s+/g, ' ');
conferir('dois dias perdidos na mesma semana: atraso de 2 e sequência quebrada', /Atraso do plano\s*2/.test(t) && (await fogo(p)) === 1, (await fogo(p)) + ' · ' + t.match(/Atraso do plano\s*\d+/)?.[0]);
conferir('com atraso, nada é marcado como recuperado', !Object.keys(await recuperados(p)).length);
await p.context().close();

p = await abrir(estado([m1, m2], {}));
t = (await p.textContent('#avisos')).replace(/\s+/g, ' ');
conferir('atraso zerado: a sequência volta com os dias recuperados', (await fogo(p)) === dentro, (await fogo(p)) + ' de ' + dentro);
conferir('aviso de sequência de volta', /Sequência de volta/.test(t) && /2 dias do plano recuperados/.test(t), t.slice(0, 120));
const rec = await recuperados(p);
conferir('os dois dias ficam gravados como recuperados', rec[m1] === 1 && rec[m2] === 1 && Object.keys(rec).length === 2, JSON.stringify(rec));
await p.reload();
await p.waitForSelector('#vista-hoje .roteiro');
conferir('depois de recarregar, a sequência continua', (await fogo(p)) === dentro && !/Sequência de volta/.test(await p.textContent('#avisos')));
await p.context().close();

p = await abrir(estado([], { [m1]: hoje, [m2]: hoje }));
conferir('dias dispensados não são recuperação: atraso zerado e a sequência segue quebrada', (await fogo(p)) === 1 && !Object.keys(await recuperados(p)).length && !/Atraso do plano/.test(await p.textContent('#vista-hoje')), String(await fogo(p)));
await p.context().close();

await browser.close();
fim(erros);
