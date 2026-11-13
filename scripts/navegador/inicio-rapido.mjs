// Início rápido da aba Questões: minhas erradas, itens de prova inéditos e tema de hoje, num toque. Confere também o
// anúncio fixo do veredito para leitor de tela (#anuncio-sessao), que fica dentro do diálogo e não é recriado a cada
// desenho da sessão.
import { APP, abrirNavegador, placar, responder, sairDaSessao, vigiarErros } from './comum.mjs';
import { readFileSync } from 'node:fs';

const plano = JSON.parse(readFileSync(new URL('../../dados/cronograma.json', import.meta.url), 'utf8'));
const dia = plano.fases.flatMap((f) => f.semanas.flatMap((s) => s.dias)).filter((d) => d.modo === 'treino' && d.blocos && d.blocos.length && d.data > '2026-11-01').sort((a, b) => (a.data < b.data ? -1 : 1))[0];
const [y, m, d] = dia.data.split('-').map(Number);
const HOJE = Math.round(Date.UTC(y, m - 1, d) / 864e5);
// Dois itens errados (gabarito Errado nos dois) e o resto do banco inédito
const itens = { 'r32-02': [0, HOJE + 1, 0, 1, HOJE - 1, 0, 0, 0], 'r32-03': [0, HOJE + 1, 0, 1, HOJE - 1, 0, 0, 0] };
const perfil = { criado: dia.data, feitos: {} };

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 1200 } });
await ctx.clock.install({ time: new Date(y, m - 1, d, 10, 0) });
await ctx.addInitScript(([perfil, itens]) => {
  if (location.protocol === 'about:' || window.name === 'semeado') return;
  window.name = 'semeado';
  localStorage.setItem('painel-anpd-v3', JSON.stringify({ perfil, itens, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: {} }));
}, [perfil, itens]);
const p = await ctx.newPage();
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForSelector('.aba');
const botao = (acao) => p.locator('.inicio-rapido [data-acao="' + acao + '"]');
const irQuestoes = async () => { await p.click('[data-acao="ir"][data-vista="questoes"]'); await p.waitForSelector('.inicio-rapido'); };

await passo('a faixa mostra as três sessões, com as contagens', async () => {
  await irQuestoes();
  conferir('minhas erradas: 2', /Minhas erradas · 2$/.test((await botao('treinar-erradas').textContent()).trim()), await botao('treinar-erradas').textContent());
  conferir('itens de prova inéditos disponíveis', !(await botao('treinar-reais').isDisabled()));
  conferir('dia de questões do plano: tema de hoje', (await botao('treinar-tema').textContent()).trim() === 'Tema de hoje', await botao('treinar-tema').textContent());
});

await passo('minhas erradas abre só os itens errados, e o veredito é anunciado uma vez', async () => {
  await botao('treinar-erradas').click();
  await p.waitForSelector('#sessao:not([hidden])');
  const tit = ((await p.textContent('#sessao .tit')) || '').replace(/\s+/g, ' ');
  conferir('título e tamanho', tit.includes('Minhas erradas') && /de 2\b/.test(tit), tit);
  const an = p.locator('#sessao #anuncio-sessao[role="status"]');
  conferir('anúncio fixo dentro do diálogo, vazio antes da resposta', (await an.count()) === 1 && !(await an.textContent()));
  await p.evaluate(() => { window.__anuncio = document.getElementById('anuncio-sessao'); });
  await responder(p, 'e');
  await p.waitForSelector('#sessao .veredito');
  const t = await an.textContent();
  conferir('anuncia o veredito, sem o XP', /acertou/.test(t) && !/XP/.test(t), t);
  conferir('o anúncio é o mesmo elemento (não foi recriado no redesenho)', await p.evaluate(() => window.__anuncio === document.getElementById('anuncio-sessao')));
});

await passo('sair guarda a sessão, e o botão vira Continuar', async () => {
  await sairDaSessao(p);
  await p.waitForSelector('#sessao', { state: 'hidden' });
  await irQuestoes();
  conferir('Continuar na faixa', /^Continuar/.test((await botao('treinar-erradas').textContent()).trim()), await botao('treinar-erradas').textContent());
});

await passo('tema de hoje treina os blocos do dia', async () => {
  await botao('treinar-tema').click();
  await p.waitForSelector('#sessao:not([hidden])');
  conferir('título', ((await p.textContent('#sessao .tit b')) || '').trim() === 'Tema de hoje');
  await sairDaSessao(p);
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await browser.close();
fim(erros);
