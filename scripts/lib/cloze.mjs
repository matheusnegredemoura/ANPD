// Cards cloze e glossário.
//
// cloze/*.txt — uma nota por linha:
//   bloco: lgpd-19-22                     (vale para as linhas seguintes)
//   lgpd 19, II | ... no prazo de até {{15 (quinze) dias}}, contado ... | dica opcional
// Cada {{...}} vira um card (c1, c2...). {{c1::a}} ... {{c1::b}} agrupa lacunas no mesmo card.
// Sem as chaves, o texto precisa existir literalmente no artigo citado. As exceções são os cards de conceito,
// com ref "doutrina <tema>" (não há norma anexada para conferir, então o texto é redação própria), e os cards
// de resumo, com ref "resumo lgpd 8; lgpd 9, § 1º": texto próprio com contexto, que pode juntar vários
// artigos; cada artigo citado precisa existir e todo número do texto precisa aparecer em algum deles.
//
// glossario/*.txt — blocos:
//   === Termo
//   padroes: termo | variação | outra variação
//   def: definição curta
//   busca: consulta sugerida para pesquisar
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RE_LACUNA = /\{\{(?:c(\d+)::)?([^}]+?)\}\}/g;

function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export function semMarcas(texto) {
  return texto.replace(RE_LACUNA, (_, n, t) => t);
}

export function lacunas(texto) {
  const out = [];
  let auto = 0;
  texto.replace(RE_LACUNA, (_, n, t) => {
    const num = n ? Number(n) : ++auto;
    out.push({ n: num, t });
    return t;
  });
  return out;
}

// Refs de um card de resumo ("resumo lgpd 8; lei9784 13"), ou null se o card não for de resumo
export function refsResumo(ref) {
  const m = /^resumo\s+(.+)$/.exec(ref || '');
  return m ? m[1].split(';').map((x) => x.trim()).filter(Boolean) : null;
}

export function lerCloze(raiz) {
  const dir = join(raiz, 'cloze');
  if (!existsSync(dir)) return [];
  const notas = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.txt')).sort()) {
    let bloco = null;
    const linhas = readFileSync(join(dir, f), 'utf8').split('\n');
    linhas.forEach((bruta, i) => {
      const linha = bruta.trim();
      if (!linha || linha.startsWith('#')) return;
      const mb = linha.match(/^bloco:\s*(\S+)/);
      if (mb) { bloco = mb[1]; return; }
      const partes = linha.split(' | ');
      const ref = partes[0].trim();
      const texto = (partes[1] || '').trim();
      const dica = (partes[2] || '').trim() || null;
      const id = 'cz-' + hash(ref + '|' + texto);
      notas.push({ id, bloco, ref, texto, dica, arquivo: join(dir, f), linha: i + 1 });
    });
  }
  return notas;
}

export function lerGlossario(raiz) {
  const dir = join(raiz, 'glossario');
  if (!existsSync(dir)) return [];
  const termos = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.txt')).sort()) {
    const blocos = readFileSync(join(dir, f), 'utf8').split(/^===\s*/m).slice(1);
    for (const b of blocos) {
      const linhas = b.split('\n');
      const t = { termo: linhas[0].trim(), padroes: [], def: '', busca: '', arquivo: join(dir, f) };
      for (const l of linhas.slice(1)) {
        const m = l.match(/^(\w+):\s?(.*)$/);
        if (!m) continue;
        if (m[1] === 'padroes') t.padroes = m[2].split('|').map((x) => x.trim()).filter(Boolean);
        else t[m[1]] = m[2].trim();
      }
      if (!t.padroes.length) t.padroes = [t.termo];
      if (!t.busca) t.busca = t.termo;
      termos.push(t);
    }
  }
  return termos;
}
