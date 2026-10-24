// Compara os itens C/E escritos para o banco com os itens reais da banca (sem línguas) nos sinais que entregam o
// gabarito: palavra absoluta no item errado, “pode” no item certo, tamanho, casos e certo/errado por dificuldade.
import { validar } from '../validar.mjs';
import { copiaDoTrecho } from '../build.mjs';

const ABS = /\b(somente|apenas|exclusivamente|sempre|nunca|necessariamente|em qualquer hip[óo]tese|independentemente|todos? os|nenhum|jamais|só)\b/i;
const POD = /\b(pode|podem|poder[áa]|admite|faculta)\b/i;
const qs = validar({ silencioso: true }).questoes.filter((q) => !q.alt.length && /^[CE]$/.test(q.gab) && !/^(pt|en)/.test(q.id));
const pc = (a, f) => (100 * a.filter(f).length / (a.length || 1)).toFixed(0) + '%';
for (const nome of ['autor', 'real']) {
  const a = qs.filter((q) => (q.origem === 'real') === (nome === 'real'));
  const C = a.filter((q) => q.gab === 'C'), E = a.filter((q) => q.gab === 'E'), abs = a.filter((q) => ABS.test(q.enunciado));
  const pal = a.map((q) => q.enunciado.split(/\s+/).length).sort((x, y) => x - y);
  const r = { n: a.length, certos: pc(a, (q) => q.gab === 'C'), palavras: pal[pal.length >> 1], caso: pc(a, (q) => /^Situação hipotética/.test(q.enunciado)),
    absolutoNoErrado: pc(E, (q) => ABS.test(q.enunciado)), absolutoNoCerto: pc(C, (q) => ABS.test(q.enunciado)), erradoSeAbsoluto: pc(abs, (q) => q.gab === 'E'),
    podeNoCerto: pc(C, (q) => POD.test(q.enunciado)), podeNoErrado: pc(E, (q) => POD.test(q.enunciado)) };
  if (nome === 'autor') {
    r.copia60 = pc(a.filter((q) => q.trecho.length), (q) => copiaDoTrecho(q.enunciado, q.trecho) >= 0.6);
    for (const d of [1, 2, 3]) r['certosDif' + d] = pc(a.filter((q) => +(q.dif || 2) === d), (q) => q.gab === 'C');
  }
  console.log(nome, JSON.stringify(r));
}
