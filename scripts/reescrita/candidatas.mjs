// Itens autorais mais distantes do padrão da banca, por ordem de peso na prova: cópia do trecho (≥ 45%), armadilha
// "literal" ou enunciado curto (< 18 palavras). Saída em lotes para reescrita (docs/padrao-cebraspe.md).
// Uso: node scripts/reescrita/candidatas.mjs [disciplina] [inicio] [fim] [pasta com lotes já aplicados, para pular]
import { readFileSync, readdirSync } from 'node:fs';
import { validar } from '../validar.mjs';
import { copiaDoTrecho } from '../build.mjs';

const ORDEM = ['lgpd', 'regulacao', 'eca', 'direito', 'seginfo', 'gestao', 'comparado', 'economia', 'contabil'];
const v = validar({ silencioso: true });
const blocos = JSON.parse(readFileSync(new URL('../../questoes/blocos.json', import.meta.url), 'utf8')).blocos;
const BL = new Map(blocos.map((b) => [b.id, b]));
export function candidatas() {
  return v.questoes.filter((q) => q.origem !== 'real' && !q.alt.length && !q.apoio && BL.get(q.bloco) && ORDEM.includes(BL.get(q.bloco).disciplina))
    .map((q) => ({ q, cp: copiaDoTrecho(q.enunciado, q.trecho), pal: q.enunciado.split(/\s+/).length }))
    .filter((x) => x.cp >= 0.45 || x.q.armadilha === 'literal' || x.pal < 18)
    .sort((a, b) => ORDEM.indexOf(BL.get(a.q.bloco).disciplina) - ORDEM.indexOf(BL.get(b.q.bloco).disciplina) || (BL.get(a.q.bloco).prioridade || 9) - (BL.get(b.q.bloco).prioridade || 9) || a.q.id.localeCompare(b.q.id));
}
if (process.argv[1].endsWith('candidatas.mjs')) {
  const [d, i, f, pasta] = process.argv.slice(2);
  const feitos = new Set(pasta ? readdirSync(pasta).filter((n) => n.endsWith('.json')).flatMap((n) => JSON.parse(readFileSync(pasta + '/' + n, 'utf8')).map((x) => x.id)) : []);
  const lista = candidatas().filter((x) => (!d || BL.get(x.q.bloco).disciplina === d) && !feitos.has(x.q.id));
  if (i == null) {
    const por = {};
    for (const x of candidatas()) por[BL.get(x.q.bloco).disciplina] = (por[BL.get(x.q.bloco).disciplina] || 0) + 1;
    console.log(JSON.stringify(por), candidatas().length);
  } else for (const { q, cp } of lista.slice(+i, +f)) {
    console.log('### ' + q.id + ' | ' + q.gab + ' | ' + q.ref + ' | ' + q.armadilha + ' | dif ' + (q.dif || 2) + ' | cópia ' + Math.round(cp * 100) + '%');
    for (const t of q.trecho) console.log('T: ' + t);
    console.log('E: ' + q.enunciado);
    console.log('C: ' + (q.comentario || '').slice(0, 260));
  }
}
