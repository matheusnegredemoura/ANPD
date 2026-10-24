// Mede o banco autoral C/E sem apoio: mediana de palavras, % com cópia do trecho ≥ 60%, % de casos e mistura de armadilhas.
import { validar } from '../validar.mjs';
import { copiaDoTrecho } from '../build.mjs';

const qs = validar({ silencioso: true }).questoes.filter((q) => q.origem !== 'real' && !q.alt.length && !q.apoio && q.trecho.length);
const pal = qs.map((q) => q.enunciado.split(/\s+/).length).sort((a, b) => a - b);
const pc = (n) => (100 * n / qs.length).toFixed(1) + '%';
const arm = {};
for (const q of qs) arm[q.armadilha || '-'] = (arm[q.armadilha || '-'] || 0) + 1;
console.log(JSON.stringify({
  n: qs.length, palavras: pal[pal.length >> 1],
  copia60: pc(qs.filter((q) => copiaDoTrecho(q.enunciado, q.trecho) >= 0.6).length),
  copia45: pc(qs.filter((q) => copiaDoTrecho(q.enunciado, q.trecho) >= 0.45).length),
  caso: pc(qs.filter((q) => /^Situação hipotética/.test(q.enunciado)).length),
  dif3: pc(qs.filter((q) => +q.dif === 3).length),
  armadilhas: Object.fromEntries(Object.entries(arm).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, pc(v)])),
}));
