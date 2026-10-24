// Roda todos os testes de navegador, um processo por arquivo, e resume no fim. Veja comum.mjs para as variáveis.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOTOS } from './comum.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const TESTES = ['fumaca.mjs', 'sincronizacao.mjs', 'pausa.mjs', 'retomada.mjs', 'ia.mjs', 'revisao.mjs', 'multipla-escolha.mjs', 'cards.mjs', 'armadilha.mjs', 'lista-curta.mjs', 'jornada.mjs', 'conquistas.mjs', 'backup.mjs', 'pesos.mjs', 'prontidao.mjs', 'discursiva-plano.mjs', 'cronometro.mjs', 'virada.mjs', 'trilhas.mjs', 'atraso-inicio.mjs', 'artigo-inline.mjs', 'dia-do-zero.mjs', 'voltar.mjs', 'defesa.mjs', 'abas.mjs', 'ritmo.mjs', 'pegadinha.mjs', 'gaveta.mjs', 'ouvir.mjs'];
const resultado = [];
for (const t of TESTES) {
  console.log('\n=== ' + t);
  const r = spawnSync(process.execPath, [join(DIR, t)], { stdio: 'inherit', env: process.env });
  if (r.status === 2) process.exit(2);
  resultado.push([t, r.status === 0]);
}
console.log('\n' + resultado.map(([t, ok]) => (ok ? 'ok    ' : 'FALHA ') + t).join('\n'));
console.log('Capturas de tela em ' + FOTOS);
process.exit(resultado.every(([, ok]) => ok) ? 0 : 1);
