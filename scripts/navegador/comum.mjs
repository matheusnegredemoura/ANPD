// Apoio aos testes de navegador (npm run test:navegador).
//
// Os testes abrem dist/index.html num Chromium de verdade e clicam no app como uma pessoa faria. Eles não fazem
// parte de npm test porque precisam do pacote playwright, que o projeto não instala: rode antes
// `npm install --no-save playwright` (e `npx playwright install chromium`, se não houver um Chromium na máquina).
//
// Variáveis de ambiente:
//   CHROMIUM  caminho do executável do Chromium (sem ela, usa o do Playwright)
//   APP       endereço do app (padrão: dist/index.html deste repositório; aceita outro arquivo, para comparar versões)
//   FOTOS     pasta das capturas de tela (padrão: pasta temporária do sistema)
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const APP = process.env.APP || pathToFileURL(join(RAIZ, 'dist', 'index.html')).href;
export const FOTOS = process.env.FOTOS || join(tmpdir(), 'painel-anpd-fotos');
mkdirSync(FOTOS, { recursive: true });
export const foto = (nome) => join(FOTOS, nome);

export async function abrirNavegador() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('Falta o pacote playwright. Rode: npm install --no-save playwright');
    process.exit(2);
  }
  return chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
}

// Só os dias de questões do plano têm sessão de blocos e leitura do dia: domingo é livre, e dia de revisão ou de
// simulado não tem leitura. Os testes que dependem delas abrem o app no próximo dia de questões do plano (hoje, se for
// um), à mesma hora; o relógio instalado continua correndo normalmente a partir dali.
const isoLocal = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export async function diaDeEstudo(ctx) {
  const d = new Date(), hoje = isoLocal(d);
  const plano = JSON.parse(readFileSync(join(RAIZ, 'dados', 'cronograma.json'), 'utf8'));
  const prox = plano.fases.flatMap((f) => f.semanas.flatMap((s) => s.dias)).filter((x) => x.modo === 'treino' && x.data >= hoje).map((x) => x.data).sort()[0];
  if (!prox || prox === hoje) return;
  const [y, m, dd] = prox.split('-').map(Number);
  d.setFullYear(y, m - 1, dd);
  await ctx.clock.install({ time: d });
}

// Erros de página e de console do próprio app. Falha ao baixar recurso externo (as fontes do Google, sem rede)
// não conta: o app funciona sem elas.
export function vigiarErros(p, erros) {
  p.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  p.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/^https?:/.test(m.location().url || '') || /Failed to load resource/.test(m.text())) return;
    erros.push('console: ' + m.text());
  });
}

// Placar: conferir(nome, ok, extra) para verificações simples, passo(nome, fn) para um roteiro que pode lançar.
export function placar() {
  const pl = { falhas: 0 };
  pl.conferir = (nome, ok, extra) => {
    if (!ok) pl.falhas++;
    console.log((ok ? 'ok    ' : 'FALHA ') + nome + (extra ? ' :: ' + extra : ''));
  };
  pl.passo = async (nome, fn) => {
    try {
      await fn();
      console.log('ok    ' + nome);
    } catch (e) {
      pl.falhas++;
      console.log('FALHA ' + nome + ' :: ' + e.message.split('\n').slice(0, 3).join(' | '));
    }
  };
  pl.fim = (erros = []) => {
    if (erros.length) {
      pl.falhas++;
      console.log('FALHA erros de página:\n  ' + erros.join('\n  '));
    }
    console.log(pl.falhas ? pl.falhas + ' falha(s)' : 'tudo certo');
    process.exit(pl.falhas ? 1 : 0);
  };
  return pl;
}

// Responde o item da tela: na múltipla escolha, a primeira alternativa; no certo/errado, a bolha pedida.
export async function responder(p, bolha = 'c') {
  if (await p.locator('button.alt').count()) await p.locator('button.alt').first().click();
  else await p.click('.bolha.' + bolha);
}

export async function sairDaSessao(p) {
  await p.click('[data-acao="sair-sessao"]');
  if (await p.locator('[data-acao="confirmar-saida"]').count()) await p.click('[data-acao="confirmar-saida"]');
}
