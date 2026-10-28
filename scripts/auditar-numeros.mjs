// Auditoria de números nos itens autorais certos (gab C): todo prazo, quantidade, percentual ou valor do enunciado
// precisa existir no artigo citado (em algarismo ou por extenso) ou no texto de apoio. Número que não está lá é
// suspeita de item errado com gabarito certo; a lista sai para conferência na lei, item a item.
// Uso: node scripts/auditar-numeros.mjs  (sai com 1 se houver suspeitas)
import { validar } from './validar.mjs';

const EXTENSO = { um: 1, uma: 1, dois: 2, duas: 2, 'três': 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20,
  trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200,
  trezentos: 300, quinhentos: 500, mil: 1000, metade: 0.5, dobro: 2, triplo: 3,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, ninety: 90, hundred: 100 };
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
// Números que são nome de norma, artigo, parágrafo, inciso ou ano, e não prazo ou quantidade
const REFERENCIA = /(art(?:igo)?s?\.?|§+|inciso|al[íi]nea|par[áa]grafo|lei(?: complementar)?(?: n[ºo°.]*)?|decreto(?:-lei)?(?: n[ºo°.]*)?|resolu[çc][ãa]o(?: cd\/anpd)?(?: n[ºo°.]*)?|portaria(?: n[ºo°.]*)?|instru[çc][ãa]o normativa(?: n[ºo°.]*)?|in|emenda(?: constitucional)?(?: n[ºo°.]*)?|s[úu]mula(?: vinculante)?(?: n[ºo°.]*)?|n[ºo°.]+|cap[íi]tulo|se[çc][ãa]o|t[íi]tulo|tema|rel|ed|adi|adpf|re|mpv?|medida provis[óo]ria(?: n[ºo°.]*)?|conven[çc][ãa]o(?: n[ºo°.]*)?|csf|nist|iso(?:\/iec)?|abnt nbr|nbr|ods|g)\s*$/i;

function numerosDe(txt, comReferencia) {
  const out = new Set();
  const t = txt.replace(/ /g, ' ');
  for (const m of t.matchAll(/\d[\d.]*(?:,\d+)?/g)) {
    const antes = t.slice(Math.max(0, m.index - 40), m.index);
    const bruto = m[0].replace(/\.$/, '');
    if (/\.(\d{1,2}|\d{4,})(\D|$)/.test(bruto + ' ')) continue;
    const v = Number(bruto.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(v)) continue;
    if (!comReferencia) {
      if (REFERENCIA.test(antes)) continue;
      if (/^(19|20)\d\d$/.test(bruto)) continue;
      if (/^\d+[ºª°]/.test(t.slice(m.index))) continue;
      // continuação de lista de referências: "arts. 7º e 11", "Leis 8.112 e 9.784"
      if (/(art(?:igo)?s?\.?|leis|incisos|§§)\s*[\dºª°.,\s]*(e|ou|a)\s*$/i.test(antes)) continue;
    }
    out.add(v);
  }
  let soma = null;
  const fecha = () => { if (soma != null) out.add(soma); soma = null; };
  for (const m of t.toLowerCase().matchAll(/\p{L}+/gu)) {
    const w = m[0];
    if (w in EXTENSO) {
      out.add(EXTENSO[w]);
      soma = w === 'mil' || w === 'hundred' ? (soma || 1) * EXTENSO[w] : (soma || 0) + EXTENSO[w];
    } else if (w !== 'e' && w !== 'and') fecha();
  }
  fecha();
  return out;
}

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
