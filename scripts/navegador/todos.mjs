// Roda os testes de navegador, cada arquivo num processo, PARALELO de cada vez (padrão 3), e resume no fim.
// Com nomes na linha de comando, roda só esses (npm run test:navegador -- medida fria). Com --repetir N, roda cada
// um N vezes: um teste que ora passa e ora falha é instável e precisa de conserto antes de entrar na bateria.
// Veja comum.mjs para as variáveis.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOTOS } from './comum.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const TESTES = ['fumaca.mjs', 'sincronizacao.mjs', 'pausa.mjs', 'retomada.mjs', 'ia.mjs', 'revisao.mjs', 'multipla-escolha.mjs', 'cards.mjs', 'armadilha.mjs', 'lista-curta.mjs', 'jornada.mjs', 'conquistas.mjs', 'backup.mjs', 'pesos.mjs', 'prontidao.mjs', 'discursiva-plano.mjs', 'cronometro.mjs', 'virada.mjs', 'trilhas.mjs', 'atraso-inicio.mjs', 'artigo-inline.mjs', 'dia-do-zero.mjs', 'voltar.mjs', 'defesa.mjs', 'abas.mjs', 'ritmo.mjs', 'gaveta.mjs', 'ouvir.mjs', 'fria.mjs', 'correcao.mjs', 'semana.mjs', 'medida.mjs', 'edital.mjs', 'roteiro.mjs', 'largura.mjs', 'desafio.mjs', 'cansaco.mjs', 'teclado.mjs', 'brechas.mjs', 'plano-encaixe.mjs', 'sequencia-recuperada.mjs', 'recuperacao-subtema.mjs', 'testar-lacunas.mjs', 'busca-questoes.mjs', 'acessibilidade.mjs', 'glossario-tema.mjs', 'armadilhas-sessao.mjs', 'simulado-tecla-u.mjs'];
const args = process.argv.slice(2), nomes = [];
let repetir = 1;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--repetir') repetir = Math.max(1, Number(args[++i]) || 1);
  else nomes.push(args[i].replace(/\.mjs$/, '') + '.mjs');
}
const fora = nomes.filter((t) => !TESTES.includes(t));
if (fora.length) { console.error('teste desconhecido: ' + fora.join(', ')); process.exit(2); }
const lista = nomes.length ? nomes : TESTES;
const fila = lista.flatMap((t) => Array(repetir).fill(t));
const PARALELO = Math.max(1, Number(process.env.PARALELO) || 3);
const resultado = [];
let abortar = false;
const inicio = Date.now();
// A saída de cada arquivo sai inteira quando ele termina, para não misturar linhas de testes simultâneos
function rodar(t) {
  return new Promise((fim) => {
    const p = spawn(process.execPath, [join(DIR, t)], { env: process.env });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => {
      console.log('\n=== ' + t + '\n' + out.trimEnd());
      if (code === 2) abortar = true;
      fim([t, code === 0]);
    });
  });
}
await Promise.all(Array.from({ length: Math.min(PARALELO, fila.length) }, async () => {
  while (fila.length && !abortar) resultado.push(await rodar(fila.shift()));
}));
if (abortar) process.exit(2);
console.log('\n' + lista.map((t) => {
  const r = resultado.filter(([x]) => x === t), ok = r.filter(([, v]) => v).length;
  return (ok === r.length ? 'ok    ' : 'FALHA ') + t + (repetir > 1 ? ' (' + ok + ' de ' + r.length + ')' : '');
}).join('\n'));
console.log('Capturas de tela em ' + FOTOS + ' · ' + Math.round((Date.now() - inicio) / 1000) + ' s');
process.exit(resultado.every(([, ok]) => ok) ? 0 : 1);
