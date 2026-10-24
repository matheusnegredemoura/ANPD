// Mostra gabarito, trecho e enunciado atual dos itens de um lote de reescrita, com a cópia do trecho, para conferência
// antes do commit. Uso: node scripts/reescrita/conferir.mjs lote.json
import { readFileSync } from 'node:fs';
import { validar } from '../validar.mjs';
import { copiaDoTrecho } from '../build.mjs';

const ids = JSON.parse(readFileSync(process.argv[2], 'utf8')).map((x) => x.id);
const Q = new Map(validar({ silencioso: true }).questoes.map((q) => [q.id, q]));
for (const id of ids) {
  const q = Q.get(id);
  if (!q) { console.log('?? ' + id); continue; }
  console.log('### ' + id + ' ' + q.gab + ' ' + q.armadilha + ' c=' + Math.round(copiaDoTrecho(q.enunciado, q.trecho) * 100) + '%');
  console.log('T: ' + q.trecho.join(' | ').slice(0, 420));
  console.log('E: ' + q.enunciado);
}
