// Auditoria de números nos itens autorais certos (gab C): todo prazo, quantidade, percentual ou valor do enunciado
// precisa existir no artigo citado (em algarismo ou por extenso) ou no texto de apoio. Número que não está lá é
// suspeita de item errado com gabarito certo; a lista sai para conferência na lei, item a item.
// Uso: node scripts/auditar-numeros.mjs  (sai com 1 se houver suspeitas)
import { validar } from './validar.mjs';
import { EXTENSO, numerosDe } from './lib/numeros.mjs';

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

// Prazos e percentuais dos comentários (dia, mês, ano, hora, %): cada par número + unidade precisa existir em alguma
// norma anexada ou no próprio enunciado. Pega o comentário que explica a resposta com um prazo que não existe.
// Fora daqui só o que é conta ou jurisprudência, conferido à mão
const COMENTARIOS_CONFERIDOS = {
  'pp2-03': 'prazo em dobro do pequeno porte (Res. 2, art. 14, II) sobre os 3 dias úteis da Res. 15',
  'ic-24': 'prazo em dobro do pequeno porte (Res. 2, art. 14) sobre os 3 dias úteis da Res. 15',
  'r4z-06': 'prazo em dobro (Res. 4, art. 17, § 2º) sobre os 20 dias úteis do caput',
  'da-age-12': '140 dias da Súmula 635 do STJ',
  'imp-11': '140 dias da Súmula 635 do STJ',
  'trf6-18': '140 dias da Súmula 635 do STJ',
  'lu-27': 'vacância escalonada da Lei 13.460, art. 25 (360, 540 e 720 dias)',
  'us3-12': 'vacância escalonada da Lei 13.460, art. 25 (360, 540 e 720 dias)',
  'cs-inc-04': '72 horas do GDPR, art. 33, para comparação',
};
const UNIDADE = { dia: 'dia', dias: 'dia', mes: 'mes', meses: 'mes', ano: 'ano', anos: 'ano', hora: 'hora', horas: 'hora', '%': '%', 'por cento': '%' };
const semAcento = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export function prazosDe(txt) {
  // "365 (trezentos e sessenta e cinco) dias": o número por extenso entre parênteses é só repetição do algarismo
  const t = semAcento(txt).replace(/(\d)\s*\([a-z\s]+\)/g, '$1');
  const out = new Set();
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?|[a-z]+(?:\s+e\s+[a-z]+)*)\s*(%|por cento|dias?|meses|mes|anos?|horas?)\b(\s+(?:uteis|corridos))?/g)) {
    let v = m[1];
    if (/^\d/.test(v)) v = Number(v.replace(/\./g, '').replace(',', '.'));
    else {
      let soma = 0;
      for (const p of v.split(/\s+e\s+/)) { const n = EXTENSO_SEM_ACENTO[p]; if (n == null) { soma = NaN; break; } soma += n; }
      v = soma;
    }
    if (!Number.isFinite(v) || v <= 1) continue;
    const par = v + ' ' + UNIDADE[m[2]];
    out.add(par);
    if (m[3] && /uteis/.test(m[3])) out.add(par + ' uteis');
  }
  return out;
}
const EXTENSO_SEM_ACENTO = Object.fromEntries(Object.entries(EXTENSO).map(([k, v]) => [semAcento(k), v]));
export function auditarPrazosComentarios({ questoes, leis }) {
  const corpus = new Set();
  for (const { lei } of Object.values(leis)) for (const a of lei.artigos) for (const p of prazosDe(a.texto)) corpus.add(p);
  const suspeitas = [];
  for (const q of questoes) {
    if (!q.ref || /^(doutrina|texto)\b/.test(q.ref) || COMENTARIOS_CONFERIDOS[q.id]) continue;
    const doItem = prazosDe(q.enunciado + ' ' + (q.apoio || '') + ' ' + (q.alt || []).join(' '));
    const faltam = [...prazosDe(q.comentario)].filter((p) => !corpus.has(p) && !doItem.has(p));
    if (faltam.length) suspeitas.push({ id: q.id, ref: q.ref, faltam, c: q.comentario.slice(0, 220) });
  }
  return suspeitas;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
const suspeitas = auditarNumeros(validar({ silencioso: true }));
for (const s of suspeitas) console.log(s.id + ' [' + s.ref + '] ' + s.faltam.join(', ') + ' · ' + s.arquivo + '\n    ' + s.e);
console.log('\n' + suspeitas.length + ' item(ns) certo(s) com número que não está no artigo citado');
process.exit(suspeitas.length ? 1 : 0);
}
