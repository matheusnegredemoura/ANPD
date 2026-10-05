// Lê os textos legais de fontes/ e os divide em artigos.
// Cada lei vira { id, nome, artigos: [{ id, rotulo, estrutura, texto }] }.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const LEIS = {
  lgpd: {
    arquivo: 'lgpd.txt',
    nome: 'LGPD — Lei nº 13.709/2018',
    curto: 'LGPD',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm',
  },
};

const RE_ARTIGO = /^Art\.\s*(\d+(?:-[A-Z])?)(?:º|o|\.)?\.?\s*/;
const RE_ESTRUTURA = /^(CAPÍTULO|Seção|TÍTULO|LIVRO)\b/;

export function normalizar(s) {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function carregarLei(raiz, id) {
  const meta = LEIS[id];
  const caminho = join(raiz, 'fontes', meta.arquivo);
  if (!existsSync(caminho)) return null;
  const linhas = readFileSync(caminho, 'utf8').split('\n');
  const artigos = [];
  let atual = null;
  let estrutura = [];
  let pendenteEstrutura = [];

  for (const bruta of linhas) {
    const linha = bruta.trimEnd();
    if (!linha.trim() || linha.startsWith('#')) continue;
    if (RE_ESTRUTURA.test(linha)) {
      if (/^(CAPÍTULO|TÍTULO|LIVRO)/.test(linha)) pendenteEstrutura = [linha];
      else pendenteEstrutura = [pendenteEstrutura[0] || estrutura[0] || '', linha].filter(Boolean);
      atual = null;
      continue;
    }
    const m = linha.match(RE_ARTIGO);
    if (m) {
      if (pendenteEstrutura.length) {
        estrutura = pendenteEstrutura;
        pendenteEstrutura = [];
      }
      atual = { id: m[1], rotulo: 'Art. ' + m[1], estrutura: estrutura.slice(), linhas: [linha] };
      artigos.push(atual);
      continue;
    }
    if (atual) {
      atual.linhas.push(linha);
    } else if (pendenteEstrutura.length) {
      // título de capítulo/seção em linha separada
      pendenteEstrutura[pendenteEstrutura.length - 1] += ' — ' + linha.trim();
    }
  }
  return {
    id,
    ...meta,
    artigos: artigos.map((a) => ({ id: a.id, rotulo: a.rotulo, estrutura: a.estrutura, texto: a.linhas.join('\n') })),
  };
}

export function indicePorArtigo(lei) {
  const mapa = new Map();
  for (const a of lei.artigos) mapa.set(a.id, a);
  return mapa;
}
