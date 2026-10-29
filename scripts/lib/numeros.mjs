// Números de um texto (algarismos e por extenso), para conferir prazo, quantidade e percentual contra o artigo citado.
// Com comReferencia = false, ignora o que é nome de norma, artigo, parágrafo, inciso ou ano.
export const EXTENSO = { um: 1, uma: 1, dois: 2, duas: 2, 'três': 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20,
  trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200,
  trezentos: 300, quinhentos: 500, mil: 1000, metade: 0.5, dobro: 2, triplo: 3,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, ninety: 90, hundred: 100 };
// Números que são nome de norma, artigo, parágrafo, inciso ou ano, e não prazo ou quantidade
const REFERENCIA = /(art(?:igo)?s?\.?|§+|inciso|al[íi]nea|par[áa]grafo|lei(?: complementar)?(?: n[ºo°.]*)?|decreto(?:-lei)?(?: n[ºo°.]*)?|resolu[çc][ãa]o(?: cd\/anpd)?(?: n[ºo°.]*)?|portaria(?: n[ºo°.]*)?|instru[çc][ãa]o normativa(?: n[ºo°.]*)?|in|emenda(?: constitucional)?(?: n[ºo°.]*)?|s[úu]mula(?: vinculante)?(?: n[ºo°.]*)?|n[ºo°.]+|cap[íi]tulo|se[çc][ãa]o|t[íi]tulo|tema|rel|ed|adi|adpf|re|mpv?|medida provis[óo]ria(?: n[ºo°.]*)?|conven[çc][ãa]o(?: n[ºo°.]*)?|csf|nist|iso(?:\/iec)?|abnt nbr|nbr|ods|g)\s*$/i;

export function numerosDe(txt, comReferencia) {
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
