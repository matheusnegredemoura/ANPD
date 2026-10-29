// Auditoria de números nos itens autorais certos (gab C): todo prazo, quantidade, percentual ou valor do enunciado
// precisa existir no artigo citado (em algarismo ou por extenso) ou no texto de apoio. Número que não está lá é
// suspeita de item errado com gabarito certo; a lista sai para conferência na lei, item a item.
// Uso: node scripts/auditar-numeros.mjs  (sai com 1 se houver suspeitas)
import { validar } from './validar.mjs';
import { numerosDe } from './lib/numeros.mjs';

// Itens certos já conferidos à mão na norma (conta da dosimetria, número do caso hipotético, texto em inglês etc.)
const CONFERIDOS = {
  'd12880-15': 'idades do caso; art. 25, § 4º manda a alternativa mais protetiva',
  'pa3-36': 'datas do exemplo; art. 66, § 3º, prazo em meses de data a data',
  'icd-19': 'número de clientes do caso; art. 5º não exige larga escala',
  'r4-38': 'conta conferida: 1,50% × 10 mi = 150 mil; × (1 + 0,30 − 0,05) = 187.500',
  'r4-40': 'conta conferida: V1 leve 1.500; −75% = 375; mínimo da Tabela 1 do Apêndice II = 1.000',
  'sc-35': 'conta conferida: Vbase 3 mi (1,5% × 200 mi), agravantes 35% = atenuantes 35%; −25% (art. 18) = 2,25 mi',
  'sc-36': 'conta conferida: dobro da vantagem (art. 15, I) = 3,6 mi, abaixo do teto de 2% (4 mi)',
  'a48-28': 'o art. 11 remete ao § 5º do art. 9º da Lei 13.848, que fixa os 30 dias úteis',
  'ic-24': 'o prazo em dobro vem do art. 14 da Res. 2; o item cita o art. 3º pela exclusão do alto risco',
  'jur-16': 'anos do caso; decadência de cinco anos (Lei 9.784, art. 54) aplicada pela Súmula 633 do STJ',
};
export function auditarNumeros({ questoes, leis }) {
const suspeitas = [];
for (const q of questoes) {
  if (q.gab !== 'C' || q.alt.length || q.origem === 'real' || CONFERIDOS[q.id]) continue;
  const [lei, art] = (q.ref || '').split(',')[0].trim().split(/\s+/);
  const L = leis[lei];
  const a = L && L.idx && art && L.idx.get(art);
  if (!a) continue;
  const base = numerosDe(a.texto + '\n' + (q.trecho || []).join('\n') + '\n' + (q.apoio || ''), true);
  const doItem = [...numerosDe(q.enunciado, false)].filter((v) => v >= 1 && v !== 1);
  const faltam = doItem.filter((v) => !base.has(v));
  if (faltam.length) suspeitas.push({ id: q.id, ref: q.ref, faltam, e: q.enunciado.slice(0, 220), arquivo: q.arquivo.split('/').pop() });
}
return suspeitas;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
const suspeitas = auditarNumeros(validar({ silencioso: true }));
for (const s of suspeitas) console.log(s.id + ' [' + s.ref + '] ' + s.faltam.join(', ') + ' · ' + s.arquivo + '\n    ' + s.e);
console.log('\n' + suspeitas.length + ' item(ns) certo(s) com número que não está no artigo citado');
process.exit(suspeitas.length ? 1 : 0);
}
