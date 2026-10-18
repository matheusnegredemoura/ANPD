// Investigar, correção da discursiva e artigo em português claro com o Claude, usando um Claude simulado (nada é
// enviado de verdade), e o caminho manual quando a página não tem o Claude.
import { readFileSync } from 'node:fs';
import { APP, abrirNavegador, foto, placar, vigiarErros } from './comum.mjs';

// Um artigo da Lei 8.112 ainda sem tradução escrita: as traduções crescem, então a escolha não fica fixa no teste
const CLARO = JSON.parse(readFileSync(new URL('../../dados/claro.json', import.meta.url), 'utf8')).artigos;
const NUM_SEM = [...readFileSync(new URL('../../fontes/lei8112.txt', import.meta.url), 'utf8').matchAll(/^Art\. (\d+)º?\.? (.*)$/gm)]
  .filter((m) => !/Revogad|VETADO/i.test(m[2])).map((m) => m[1]).find((n) => +n > 20 && !CLARO['lei8112:' + n]);
const SEM = 'lei8112:' + NUM_SEM;

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];

async function pagina(comClaude) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((comClaude) => {
    window.__pedidos = [];
    const sample = async (input, opts = {}) => {
      window.__pedidos.push(input);
      const text = 'Está certo que o titular pode pedir acesso. Faltou o prazo do art. 19. Qual é o prazo da declaração completa?';
      if (opts.onText) opts.onText({ text, delta: text });
      return { text, truncated: false, modelTierApplied: 'default' };
    };
    sample.json = async (input) => {
      window.__pedidos.push(input);
      const n = (String(input).match(/^Quesito \d+ — /gm) || []).length;
      return { quesitos: Array.from({ length: n }, (_, i) => ({ conceito: i === 0 ? 2 : 1, porque: 'Citou a regra sem explicar o critério.' })), erros: 2, exemplos: ['a nível de → em nível de'], geral: 'Explique os critérios, não só os cite.' };
    };
    window.claude = { use: async (x) => (x === 'sample' && comClaude ? sample : null) };
  }, comClaude);
  const p = await ctx.newPage();
  p.setDefaultTimeout(5000);
  vigiarErros(p, erros);
  await p.goto(APP);
  await p.waitForTimeout(600);
  return p;
}
// Abre a lista Para pesquisar e o primeiro grupo de sugestões (numa conta nova a lista pessoal está vazia)
const abrirPesquisar = async (p) => {
  await p.click('.aba[data-vista="mais"]');
  await p.click('.menu-mais [data-sub="pesquisar"]');
  await p.waitForTimeout(150);
  if (!(await p.locator('#vista-mais [data-acao="investigar"]:visible').count())) await p.locator('#vista-mais details.grupo-pesq summary').first().click();
};

const p = await pagina(true);
await passo('Investigar: o Claude confere a resposta e devolve uma pergunta', async () => {
  await abrirPesquisar(p);
  await p.locator('#vista-mais [data-acao="investigar"]:visible').first().click();
  await p.waitForSelector('#folha:not([hidden]) #inv-texto');
  if ((await p.locator('#folha .lista-cb li').count()) < 3) throw new Error('sem perguntas-guia');
  await p.fill('#inv-texto', 'É o direito de saber se meus dados são tratados e de acessá-los.');
  await p.click('[data-acao="inv-conferir"]');
  await p.waitForSelector('#folha .inv-msg.ia');
  await p.waitForTimeout(200);
  const resp = await p.textContent('#folha .inv-msg.ia p');
  if (!/Qual é o prazo/.test(resp)) throw new Error('resposta não apareceu: ' + resp);
  const botao = (await p.textContent('[data-acao="inv-conferir"]')).trim();
  if (botao !== 'Responder ao Claude') throw new Error('botão: ' + botao);
  const pedido = await p.evaluate(() => window.__pedidos[0]);
  if (!Array.isArray(pedido) || pedido[0].role !== 'user' || !/Especialista em Regulação/.test(pedido[0].content)) throw new Error('pedido sem as regras do tutor');
  await p.fill('#inv-texto', 'Quinze dias.');
  await p.click('[data-acao="inv-conferir"]');
  await p.waitForFunction(() => document.querySelectorAll('#folha .inv-msg').length === 4);
  const segundo = await p.evaluate(() => window.__pedidos[1]);
  if (segundo.length !== 4 || segundo[3].content !== 'Quinze dias.') throw new Error('a conversa não foi junto: ' + segundo.length);
  await p.screenshot({ path: foto('investigar.png') });
  await p.click('[data-acao="fechar-folha"]');
});

await passo('Investigar guarda o tema na lista com a primeira resposta', async () => {
  const r = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('painel-anpd-v3')).pesquisa || {}).filter((x) => x.r).length);
  if (r < 1) throw new Error('resposta não guardada');
});

await passo('Discursiva: o Claude sugere conceitos e erros, e dá para salvar', async () => {
  await p.click('.aba[data-vista="mais"]');
  await p.click('.menu-mais [data-sub="discursiva"]');
  await p.locator('[data-acao="disc-abrir"]').first().click();
  await p.fill('#disc-texto', 'A ANPD aplica sanções do art. 52 da LGPD, da advertência à proibição, depois de processo administrativo com ampla defesa. '.repeat(6));
  await p.click('[data-acao="disc-corrigir"]');
  await p.click('[data-acao="disc-ia"]');
  await p.waitForSelector('.ia-porque');
  const marcados = await p.locator('input[data-acao="disc-conceito"]:checked').count();
  const quesitos = await p.locator('fieldset.quesito').count();
  if (marcados !== quesitos) throw new Error('conceitos marcados ' + marcados + ' de ' + quesitos);
  if ((await p.inputValue('#disc-ne')) !== '2') throw new Error('erros de português não preenchidos');
  await p.screenshot({ path: foto('disc-ia.png'), fullPage: true });
  await p.click('[data-acao="disc-salvar"]');
  await p.waitForTimeout(200);
  const ia = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('painel-anpd-v3')).disc; return Object.values(d).some((x) => x.tentativas && x.tentativas[0] && x.tentativas[0].ia === 1); });
  conferir('tentativa salva marcada como corrigida pelo Claude', ia);
});

await passo('Artigo sem tradução escrita: o Claude explica em português claro, com aviso de conferir', async () => {
  await p.click('.aba[data-vista="lei"]');
  if (await p.locator('#vista-lei [data-acao="voltar-lei"]').count()) await p.click('#vista-lei [data-acao="voltar-lei"]');
  await p.selectOption('#vista-lei select[data-acao="sel-lei"]', 'lei8112');
  await p.evaluate((k) => document.querySelector('#vista-lei [data-acao="abrir-art"][data-art="' + k + '"]').click(), SEM);
  const n = await p.evaluate(() => window.__pedidos.length);
  await p.click('#vista-lei [data-acao="claro-ia"]');
  await p.waitForSelector('#vista-lei .claro.ia');
  const txt = (await p.textContent('#vista-lei .claro.ia')) || '';
  if (!/confira no texto[^]*Está certo que o titular/.test(txt)) throw new Error('caixa: ' + txt.slice(0, 120));
  const pedido = await p.evaluate((n) => String(window.__pedidos[n]), n);
  conferir('o pedido leva o texto do artigo e as regras', /português claro/.test(pedido) && new RegExp('Texto:\\nArt\\. ' + NUM_SEM + '\\b').test(pedido), pedido.slice(0, 160));
  // num artigo com tradução escrita, não há botão do Claude
  await p.click('#vista-lei [data-acao="voltar-lei"]');
  await p.selectOption('#vista-lei select[data-acao="sel-lei"]', 'lgpd');
  await p.evaluate(() => document.querySelector('#vista-lei [data-acao="abrir-art"][data-art="18"]').click());
  conferir('artigo das trilhas vem com a tradução escrita, sem botão', !(await p.locator('#vista-lei [data-acao="claro-ia"]').count()) && (await p.locator('#vista-lei .claro:not(.ia)').count()) === 1);
});

const q = await pagina(false);
await passo('Sem o Claude: some o botão de conferir e fica o Copiar', async () => {
  await abrirPesquisar(q);
  await q.locator('#vista-mais [data-acao="investigar"]:visible').first().click();
  await q.waitForSelector('#folha:not([hidden]) #inv-texto');
  if (await q.locator('[data-acao="inv-conferir"]').count()) throw new Error('botão de conferir apareceu sem o Claude');
  await q.fill('#inv-texto', 'Minha tentativa.');
  await q.click('[data-acao="inv-copiar"]');
  await q.waitForTimeout(200);
  const nota = (await q.textContent('#inv-nota')).trim();
  if (!nota) throw new Error('nenhum aviso depois de copiar');
  await q.click('[data-acao="fechar-folha"]');
  await q.click('.aba[data-vista="mais"]');
  await q.click('.menu-mais [data-sub="discursiva"]');
  await q.locator('[data-acao="disc-abrir"]').first().click();
  await q.fill('#disc-texto', 'Texto de teste.');
  await q.click('[data-acao="disc-corrigir"]');
  if (await q.locator('[data-acao="disc-ia"]').count()) throw new Error('correção pelo Claude apareceu sem o Claude');
});

await passo('Sem o Claude, o artigo sem tradução escrita não mostra o botão', async () => {
  await q.click('.aba[data-vista="lei"]');
  if (await q.locator('#vista-lei [data-acao="voltar-lei"]').count()) await q.click('#vista-lei [data-acao="voltar-lei"]');
  await q.selectOption('#vista-lei select[data-acao="sel-lei"]', 'lei8112');
  await q.evaluate((k) => document.querySelector('#vista-lei [data-acao="abrir-art"][data-art="' + k + '"]').click(), SEM);
  if (await q.locator('#vista-lei [data-acao="claro-ia"]').count()) throw new Error('botão do Claude sem o Claude');
});

await browser.close();
fim(erros);
