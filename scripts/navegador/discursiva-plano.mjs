// Discursiva no plano: o dia com discursiva vira passo do roteiro, salvar a correção dá baixa sozinha, e a discursiva
// de um dia que passou sem ela fica no atraso do plano até a próxima correção salva.
import { readFileSync } from 'node:fs';
import { APP, abrirNavegador, foto, placar, vigiarErros } from './comum.mjs';

const plano = JSON.parse(readFileSync(new URL('../../dados/cronograma.json', import.meta.url), 'utf8'));
const temas = JSON.parse(readFileSync(new URL('../../dados/discursivas.json', import.meta.url), 'utf8')).temas;
// O relógio do navegador vai para as datas do plano, então serve qualquer trecho dele
const discs = plano.fases.flatMap((f) => f.semanas.flatMap((s) => s.dias)).filter((d) => d.disc).slice(1);
// Três dias de discursiva seguidos: no primeiro escreve; o segundo passa sem; no dia do terceiro, o segundo está atrasado
const [d1, d2, d3] = discs;
const titulo = (d) => temas.find((t) => t.id === d.disc).titulo;

const browser = await abrirNavegador();
const { conferir, fim } = placar();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.clock.install({ time: new Date(d1.data + 'T10:00:00') });
let p = await ctx.newPage();
const erros = [];
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(500);

const passoDisc = () => p.locator('.roteiro .passo', { hasText: 'Discursiva do dia' });
conferir('roteiro de ' + d1.data + ' tem a discursiva do dia', (await passoDisc().count()) === 1);
conferir('o passo cita o tema do dia', ((await passoDisc().textContent()) || '').includes(titulo(d1)), titulo(d1));

async function escreverESalvar() {
  await p.fill('#disc-texto', 'O controlador deve comunicar à autoridade nacional e ao titular a ocorrência de incidente de segurança que possa acarretar risco ou dano relevante. '.repeat(4));
  await p.waitForTimeout(1200);
  await p.click('[data-acao="disc-corrigir"]');
  const nq = await p.locator('fieldset').count();
  for (let i = 0; i < nq; i++) await p.locator('input[name="disc-q' + i + '"]').last().check();
  await p.click('[data-acao="disc-salvar"]');
  await p.waitForTimeout(300);
}

await passoDisc().locator('[data-acao="disc-dia"]').click();
await p.waitForTimeout(300);
conferir('o botão abre o tema do dia', ((await p.textContent('#vista-mais')) || '').includes(titulo(d1)));
await escreverESalvar();
const aviso = ((await p.textContent('#avisos').catch(() => '')) || '') + ((await p.textContent('body')) || '');
conferir('o aviso diz que o plano do dia ficou em dia', aviso.includes('em dia'));
await p.click('.aba[data-vista="hoje"]');
await p.waitForTimeout(300);
conferir('o passo da discursiva fica feito', (await p.locator('.roteiro .passo.feito', { hasText: 'Discursiva do dia' }).count()) === 1);

// Pula para o terceiro dia de discursiva: a do segundo não foi feita
await ctx.clock.setSystemTime(new Date(d3.data + 'T10:00:00'));
await p.reload();
await p.waitForTimeout(600);
const atraso = p.locator('.cartao.pendencias');
const txt = ((await atraso.textContent().catch(() => '')) || '').replace(/\s+/g, ' ');
conferir('a discursiva de ' + d2.data + ' aparece no atraso', /1 discursiva atrasada/.test(txt) && txt.includes(titulo(d2)), txt.slice(0, 200));
const passo = ((await passoDisc().textContent()) || '').replace(/\s+/g, ' ');
conferir('o passo de hoje avisa do atraso', /1 discursiva atrasada/.test(passo), passo.slice(0, 200));
await p.screenshot({ path: foto('discursiva-plano.png'), fullPage: true });

// Uma correção salva dá baixa primeiro na de hoje; a segunda, na atrasada
await passoDisc().locator('[data-acao="disc-dia"]').click();
await escreverESalvar();
await p.click('.aba[data-vista="hoje"]');
await p.waitForTimeout(300);
conferir('a primeira correção dá baixa na de hoje', (await p.locator('.roteiro .passo.feito', { hasText: 'Discursiva do dia' }).count()) === 1);
conferir('a atrasada continua no atraso', /1 discursiva atrasada/.test(((await atraso.textContent().catch(() => '')) || '')));
await atraso.locator('[data-acao="disc-dia"]').first().click();
await escreverESalvar();
await p.click('.aba[data-vista="hoje"]');
await p.waitForTimeout(300);
const resto = ((await p.locator('.cartao.pendencias').textContent().catch(() => '')) || '');
conferir('a segunda correção zera o atraso de discursiva', !/discursivas? atrasadas?/.test(resto), resto.slice(0, 160));

await p.click('.aba[data-vista="mais"]');
await p.click('[data-acao="mais"][data-sub="menu"]').catch(() => {});
await p.click('.menu-mais [data-sub="discursiva"]');
await p.waitForTimeout(200);
if (await p.locator('[data-acao="disc-voltar"]').count()) await p.click('[data-acao="disc-voltar"]');
const cartao = ((await p.locator('.cartao', { hasText: 'Discursiva no plano' }).textContent()) || '').replace(/\s+/g, ' ');
conferir('a página de discursiva mostra o plano em dia', /3 de 3/.test(cartao) && /em dia/.test(cartao), cartao.slice(0, 200));

// Adiantar: nas semanas com duas discursivas, a segunda correção do dia dá baixa na próxima da semana, que deixa de
// aparecer como próxima (perfil novo, para não haver atraso de antes)
// semana de segunda a domingo, como no app (a baixa adiantada vai até o domingo)
const semana = (iso) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const par = discs.findIndex((d, i) => i + 1 < discs.length && semana(d.data) === semana(discs[i + 1].data) && d.data !== discs[i + 1].data);
const [e1, e2, e3] = [discs[par], discs[par + 1], discs[par + 2]];
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx2.clock.install({ time: new Date(e1.data + 'T10:00:00') });
p = await ctx2.newPage();
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(500);
await passoDisc().locator('[data-acao="disc-dia"]').click();
await escreverESalvar();
await p.click('[data-acao="disc-editar"]');
await escreverESalvar();
const aviso2 = ((await p.textContent('#avisos').catch(() => '')) || '');
conferir('a segunda correção do dia adianta a de ' + e2.data, aviso2.includes(e2.data.slice(8, 10) + '/' + e2.data.slice(5, 7)), aviso2.slice(-120));
if (await p.locator('[data-acao="disc-voltar"]').count()) await p.click('[data-acao="disc-voltar"]');
const cartao2 = ((await p.locator('.cartao', { hasText: 'Discursiva no plano' }).textContent()) || '').replace(/\s+/g, ' ');
const dm = (d) => d.data.slice(8, 10) + '/' + d.data.slice(5, 7);
conferir('a próxima é a seguinte à adiantada', !!e3 && cartao2.includes(dm(e3)) && !cartao2.includes(dm(e2)), cartao2.slice(0, 220));

// Apagar o rascunho pede um segundo toque: o primeiro só troca o botão
await p.locator('[data-acao="disc-abrir"]').first().click();
await p.fill('#disc-texto', 'Rascunho que não pode sumir com um toque só.');
await p.click('[data-acao="disc-limpar"]');
conferir('o primeiro toque em apagar não apaga', (await p.inputValue('#disc-texto')).startsWith('Rascunho'));
await p.click('[data-acao="disc-limpar-ok"]');
conferir('o segundo toque apaga', (await p.inputValue('#disc-texto')) === '');

await browser.close();
fim(erros);
