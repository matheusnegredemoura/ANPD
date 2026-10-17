// Atraso desde o início do plano: com o perfil criado no meio do plano, o cartão explica que os dias anteriores
// ficaram de fora e oferece incluí-los; a revisão perdida de ontem não vira atraso, e o cartão diz por quê.
import { APP, abrirNavegador, placar, vigiarErros } from './comum.mjs';
import { readFileSync } from 'node:fs';

const plano = JSON.parse(readFileSync(new URL('../../dados/cronograma.json', import.meta.url), 'utf8'));
const dias = plano.fases.flatMap((f) => f.semanas.flatMap((s) => s.dias));
// Um dia de revisão sem discursiva que não seja o primeiro do plano: o perfil nasce nele, e o teste olha o dia seguinte
const i = dias.findIndex((d, k) => k > 3 && d.modo === 'revisao' && !d.disc);
const criado = dias[i].data, hoje = new Date(Date.parse(criado + 'T10:00:00') + 864e5);
const antes = dias.slice(0, i).filter((d) => d.modo !== 'revisao' || d.disc).length;

const browser = await abrirNavegador();
const { conferir, fim } = placar();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.clock.install({ time: new Date(criado + 'T10:00:00') });
const p = await ctx.newPage();
const erros = [];
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(500);
await ctx.clock.setSystemTime(hoje);
await p.reload();
await p.waitForTimeout(600);

const cartao = async () => ((await p.locator('.cartao.pendencias').textContent().catch(() => '')) || '').replace(/\s+/g, ' ');
let t = await cartao();
conferir('sem atraso, o cartão aparece e explica os dias de fora', new RegExp('Os ' + antes + ' dias do plano').test(t), t.slice(0, 160));
conferir('a revisão perdida de ontem é explicada', /revisão de ontem não vira atraso/.test(t));
await p.click('[data-acao="atraso-desde-inicio"]');
await p.waitForTimeout(400);
t = await cartao();
conferir('incluir traz os dias anteriores para o atraso', /Ver os \d+ dias/.test(t) && !/ficaram fora do atraso/.test(t), t.slice(0, 160));
await p.reload();
await p.waitForTimeout(600);
conferir('a escolha fica gravada', /Ver os \d+ dias/.test(await cartao()));

await browser.close();
fim(erros);
