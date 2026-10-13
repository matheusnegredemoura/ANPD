// Para encaixar e Jornada:
// - sessão do plano de dia anterior não concluída aparece em "Atraso do plano" e pode ser dispensada;
// - o dia perdido dá baixa sozinho quando a matéria dele é estudada por outro caminho, e o roteiro ganha o passo de
//   recuperação, que monta a sessão com os blocos atrasados;
// - as três missões do dia são cumpridas pelo que já foi feito no dia, e o baú abre com o XP somado e um item;
// - na batalha contra o chefão, acerto causa dano e erro custa um coração; sem corações, derrota (o dano fica);
// - o golpe final derruba o chefão, registra o troféu e dá um item, que vai para o inventário e é equipado;
// - a sequência de dias não zera com uma folga por semana (de segunda a sábado), e domingo não quebra.
import { APP, abrirNavegador, placar, vigiarErros } from './comum.mjs';
import { lerTodas } from '../lib/questoes.mjs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];

const isoLocal = (dt) => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');

async function abrir(perfilExtra, pesquisa) {
  // As funções de semente viram texto dentro do script: addInitScript não serializa funções passadas como argumento
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx2.addInitScript(`(() => {
    if (sessionStorage.getItem('semeado')) return;
    sessionStorage.setItem('semeado', '1');
    const iso = ${isoLocal.toString()};
    const hoje = new Date();
    const perfil = Object.assign({ xp: 0, meta: 30, novosCards: 20, intercaladas: 30, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: iso(new Date(hoje - 6 * 864e5)), migr: { mesmoDia: '2026-09-01' } }, (${perfilExtra.toString()})(iso(hoje)));
    localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens: {}, cards: {}, simulados: [], pesquisa: (${pesquisa.toString()})(iso(hoje)), disc: {}, t: {} }));
  })();`);
  const p = await ctx2.newPage();
  p.setDefaultTimeout(5000);
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForTimeout(600);
  return { ctx: ctx2, p };
}
const salvo = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')));

await passo('dias anteriores aparecem em "Atraso do plano" e podem ser dispensados', async () => {
  const { ctx, p } = await abrir(() => ({}), () => ({}));
  const card = p.locator('.cartao.pendencias');
  if (!(await card.count())) throw new Error('card Atraso do plano ausente');
  const n0 = await card.locator('.pend').count();
  if (!n0) throw new Error('nenhuma pendência listada');
  const total0 = Number((await card.locator('.secao-cab .mono').textContent()).trim());
  await card.locator('details.det-lista > summary').click();
  await card.locator('[data-acao="dispensar-dia"]').first().click();
  await p.waitForTimeout(200);
  const total1 = (await p.locator('.cartao.pendencias').count()) ? Number((await p.locator('.cartao.pendencias .secao-cab .mono').textContent()).trim()) : 0;
  if (total1 !== total0 - 1) throw new Error('dispensar não tirou a pendência: ' + total0 + ' → ' + total1);
  await ctx.close();
});

await passo('missões cumpridas pelo que já foi feito no dia abrem o baú', async () => {
  const { ctx, p } = await abrir((h) => ({ dias: { [h]: { r: 70, c: 63, e: 7, b: 0, xp: 0, k: 25, n: 0, a: ['lgpd:5', 'lgpd:6', 'lgpd:7', 'lgpd:8', 'lgpd:9'], ni: 25, cmb: 12, pd: 1, rl: 1, cg: 5, t: { q: 4000 } } } }),
    (h) => ({ 'tema teste': { t: 'Tema teste', o: 'teste', s: 1, d: h, f: h } }));
  const ok = await p.locator('.cartao.jornada .missao.ok').count();
  if (ok !== 3) throw new Error(ok + ' missões cumpridas (esperado 3)');
  const card = await p.textContent('.cartao.jornada');
  if (!/Baú aberto/.test(card)) throw new Error('baú não abriu: ' + card.slice(0, 200));
  const d = await salvo(p);
  const h = isoLocal(new Date());
  const m = d.perfil.rpg.m[h];
  if (!m || !m.bau || Object.keys(m.ok).length !== 3) throw new Error('estado das missões: ' + JSON.stringify(m));
  if (!(d.perfil.xp >= 50 + 3 * 30)) throw new Error('XP não somado: ' + d.perfil.xp);
  if (!m.item || !d.perfil.rpg.inv[m.item]) throw new Error('baú sem item no inventário: ' + JSON.stringify(d.perfil.rpg));
  await ctx.close();
});

// Gabarito tirado do próprio banco, para o teste acertar ou errar de propósito
const GAB = new Map(lerTodas(RAIZ).map((q) => [q.id, q.gab]));
async function responder(p, certo) {
  const id = (await p.textContent('.item-num')).trim(), g = GAB.get(id);
  if (await p.locator('button.alt').count()) {
    const letras = 'ABCDE', alvo = certo ? g : letras.split('').find((l) => l !== g);
    await p.locator('button.alt').nth(letras.indexOf(alvo)).click();
  } else await p.click(certo === (g === 'C') ? '.bolha.c' : '.bolha.e');
  await p.waitForSelector('.veredito');
}

await passo('na batalha, acerto causa dano no chefão e erro custa um coração', async () => {
  const { ctx, p } = await abrir(() => ({}), () => ({}));
  const vida0 = (await p.textContent('.chefe .chefe-cab .mono')).trim();
  if (vida0 !== 'HP 300/300') throw new Error('vida inicial: ' + vida0);
  await p.click('[data-acao="enfrentar-chefe"]');
  await p.waitForSelector('.arena');
  await responder(p, true);
  const dano = (await p.textContent('.arena .dano')).trim();
  const c = (await salvo(p)).perfil.rpg.chefe;
  if (!(c.vida < 300) || !/−\d+/.test(dano)) throw new Error('dano: ' + dano + ' · vida ' + c.vida);
  await p.click('[data-acao="proximo"]');
  await responder(p, false);
  const cheios = await p.locator('.arena .cor.cheio').count(), total = await p.locator('.arena .cor').count();
  if (cheios !== total - 1) throw new Error('corações depois de um erro: ' + cheios + ' de ' + total);
  // Erra até acabar os corações: a batalha termina em derrota, e o dano causado fica
  for (let i = 0; i < 10 && !(await p.locator('.batalha-fim').count()); i++) {
    await p.click('[data-acao="proximo"]');
    if (await p.locator('.batalha-fim').count()) break;
    await responder(p, false);
  }
  const fim = await p.textContent('.batalha-fim h2');
  if (fim !== 'Derrota') throw new Error('fim da batalha: ' + fim);
  if ((await salvo(p)).perfil.rpg.chefe.vida !== c.vida) throw new Error('a vida do chefão mudou depois da derrota');
  await ctx.close();
});

await passo('golpe final derruba o chefão e dá um item, que é equipado', async () => {
  // Chefão desta semana quase no chão, no bloco de conceitos da LGPD
  const { ctx, p } = await abrir((h) => {
    const d = new Date(h + 'T12:00:00'), seg = new Date(d - ((d.getDay() + 6) % 7) * 864e5);
    const sem = seg.getFullYear() + '-' + String(seg.getMonth() + 1).padStart(2, '0') + '-' + String(seg.getDate()).padStart(2, '0');
    return { rpg: { chefe: { sem, bloco: 'lgpd-5-11', vida: 5, max: 300 } } };
  }, () => ({}));
  await p.click('[data-acao="enfrentar-chefe"]');
  await p.waitForSelector('.arena');
  await responder(p, true);
  await p.click('[data-acao="proximo"]');
  await p.waitForSelector('.batalha-fim');
  const fim = await p.textContent('.batalha-fim h2');
  if (fim !== 'Vitória') throw new Error('fim da batalha: ' + fim);
  if (!(await p.locator('.batalha-fim .item-rpg').count())) throw new Error('vitória sem saque');
  const r = (await salvo(p)).perfil.rpg;
  if (!r.chefe.vencido || !(r.trofeus || []).length) throw new Error('chefão não registrado como derrotado');
  const inv = Object.keys(r.inv || {});
  if (inv.length !== 1 || !Object.values(r.eq || {}).includes(inv[0])) throw new Error('item não foi para o inventário e o equipamento: ' + JSON.stringify(r));
  await ctx.close();
});

await passo('estudar a matéria por outro caminho dá baixa no dia perdido, e o roteiro chama a recuperação', async () => {
  // Quarta, 14/10/2026, uso desde segunda 12. Segunda (lgpd-55, 25 itens) e terça (lgpd-33-36, 20 itens) sem sessão.
  // Dez itens de lgpd-55 respondidos na terça compensam a segunda; a terça continua no atraso.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.clock.install({ time: new Date('2026-10-14T10:00:00') });
  const terca = Math.round(Date.UTC(2026, 9, 13) / 864e5);
  const itens = {};
  for (const q of lerTodas(RAIZ).filter((x) => x.bloco === 'lgpd-55' && !(x.alt && x.alt.length)).slice(0, 10)) itens[q.id] = [4, terca + 16, 1, 0, terca, 0, 0, 1];
  await ctx.addInitScript((itens) => {
    if (sessionStorage.getItem('semeado')) return;
    sessionStorage.setItem('semeado', '1');
    const perfil = { xp: 0, meta: 30, novosCards: 20, intercaladas: 30, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: '2026-10-12', migr: { mesmoDia: '2026-09-01' } };
    localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
  }, itens);
  const p = await ctx.newPage();
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForTimeout(600);
  const chips = await p.locator('.cartao.pendencias .chip-atraso').allTextContents();
  if (chips.length !== 1 || !/33 a 36|transfer/i.test(chips[0])) throw new Error('matérias atrasadas: ' + JSON.stringify(chips));
  await p.locator('.cartao.pendencias details.det-lista > summary').click();
  const dias = await p.locator('.cartao.pendencias .pend [data-acao="iniciar-dia"]').count();
  if (dias !== 1) throw new Error('dias com sessão pendente: ' + dias + ' (esperado 1: a segunda foi compensada)');
  const passo = p.locator('.roteiro .passo', { hasText: 'Recuperar o atraso' });
  if (!(await passo.count())) throw new Error('roteiro sem o passo de recuperação');
  await passo.locator('[data-acao="recuperar"]').click();
  await p.waitForSelector('#sessao:not([hidden])');
  const tit = await p.textContent('.sessao-topo .tit b');
  if (!/^Recuperação/.test(tit)) throw new Error('sessão aberta: ' + tit);
  await ctx.close();
});

await passo('uma folga por semana não zera a sequência', async () => {
  // Sábado, 17/10/2026. Estudou seg 12, ter 13, qui 15 e sex 16 (folga na quarta 14); na semana anterior, qui 08, sex 09
  // e sáb 10 (folga na quarta 07); domingo 11 não quebra. A terça 06 é a segunda falta daquela semana e encerra a conta.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.clock.install({ time: new Date('2026-10-17T10:00:00') });
  const dia = { r: 20, c: 15, e: 5, b: 0, xp: 0, k: 0, n: 0, a: [] };
  const dias = {};
  for (const d of ['2026-10-05', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-12', '2026-10-13', '2026-10-15', '2026-10-16']) dias[d] = dia;
  await ctx.addInitScript((dias) => {
    if (sessionStorage.getItem('semeado')) return;
    sessionStorage.setItem('semeado', '1');
    const perfil = { xp: 0, meta: 30, novosCards: 20, intercaladas: 30, melhorSeq: 0, dias, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: '2026-10-01', migr: { mesmoDia: '2026-09-01' } };
    localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
  }, dias);
  const p = await ctx.newPage();
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForTimeout(600);
  const seq = (await p.textContent('.pilula.fogo')).trim();
  if (seq !== '7') throw new Error('sequência: ' + seq + ' (esperado 7)');
  await ctx.close();
});

await browser.close();
conferir('sem erro de página', !erros.length, erros.join(' | '));
fim();
