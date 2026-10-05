// Gera o aplicativo em arquivo único.
//   dist/artifact.html  conteúdo da página para publicar como Artifact (sem <html>/<head>/<body>)
//   dist/index.html     documento completo, para abrir no navegador ou hospedar em qualquer lugar
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARMADILHAS, parseRef } from './lib/questoes.mjs';
import { validar } from './validar.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (...p) => readFileSync(join(RAIZ, ...p), 'utf8');

const NOMES_FONTE = {
  lgpd: 'LGPD',
  cf: 'CF/88',
  gdpr: 'GDPR',
  res19: 'Res. CD/ANPD 19/2024',
  res30: 'Res. CD/ANPD 30/2025',
  res31: 'Res. CD/ANPD 31/2025',
  decreto: 'Decreto',
  lc: 'LC',
  stf: 'STF',
  tjue: 'TJUE',
};

function rotuloArtigo(art) {
  if (/^\d$/.test(art)) return `art. ${art}º`;
  return `art. ${art}`;
}

export function rotuloRef(ref) {
  const r = parseRef(ref);
  if (!r) return '';
  if (r.lei === 'texto') return 'Texto de apoio';
  if (r.lei === 'doutrina') return 'Doutrina · ' + ref.slice('doutrina'.length).trim();
  if (r.lei === 'decreto') return 'Decreto nº ' + r.art.replace(/(\d+)(\d{3})$/, '$1.$2') + '/2020';
  if (r.lei === 'lc') return 'Lei Complementar nº ' + r.art + '/2021';
  if (r.lei === 'stf') return 'STF · ' + ref.slice(4).trim();
  if (r.lei === 'tjue') return 'TJUE · ' + ref.slice(5).trim() + ' (Schrems II)';
  if (r.lei === 'res30' || r.lei === 'res31') return NOMES_FONTE[r.lei];
  const nome = NOMES_FONTE[r.lei] || r.lei.toUpperCase();
  if (!r.art) return nome;
  const art = /^\d/.test(r.art) ? rotuloArtigo(r.art) : r.art;
  return `${nome}, ${art}${r.disp ? ', ' + r.disp : ''}`;
}

function compactar(questoes) {
  const apoios = [];
  const lista = questoes.map((q) => {
    const r = parseRef(q.ref);
    let ap = -1;
    if (q.apoio) {
      ap = apoios.indexOf(q.apoio);
      if (ap < 0) ap = apoios.push(q.apoio) - 1;
    }
    return {
      id: q.id,
      b: q.bloco,
      g: q.gab,
      l: r.lei,
      art: r.lei === 'lgpd' ? r.art : null,
      r: rotuloRef(q.ref),
      t: q.trecho,
      a: q.armadilha || 'literal',
      d: Number(q.dif || 2),
      e: q.enunciado,
      c: q.comentario,
      ap,
    };
  });
  return { lista, apoios };
}

export function montarDados() {
  const { questoes, erros, leis } = validar({ silencioso: true });
  if (erros.length) {
    for (const e of erros) console.error('ERRO: ' + e);
    throw new Error(`${erros.length} erro(s) no banco de questões; corrija antes do build.`);
  }
  const { disciplinas, blocos } = JSON.parse(ler('questoes', 'blocos.json'));
  const cronograma = JSON.parse(ler('dados', 'cronograma.json'));
  const { lista, apoios } = compactar(questoes);
  const lei = {};
  for (const [id, { lei: l }] of Object.entries(leis)) {
    lei[id] = { nome: l.nome, curto: l.curto, url: l.url, artigos: l.artigos };
  }
  return {
    versao: new Date().toISOString().slice(0, 10),
    disciplinas,
    blocos,
    armadilhas: ARMADILHAS,
    questoes: lista,
    apoios,
    lei,
    cronograma,
  };
}

function jsonSeguro(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function build() {
  const dados = montarDados();
  const css = ler('src', 'app.css');
  const js = ler('src', 'app.js');
  const corpo = ler('src', 'app.html');
  const pagina = corpo
    .replace('/*__CSS__*/', () => css)
    .replace('/*__DADOS__*/', () => jsonSeguro(dados))
    .replace('/*__JS__*/', () => js);
  mkdirSync(join(RAIZ, 'dist'), { recursive: true });
  writeFileSync(join(RAIZ, 'dist', 'artifact.html'), pagina);
  const completo =
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '</head><body>' + pagina + '</body></html>';
  writeFileSync(join(RAIZ, 'dist', 'index.html'), completo);
  const kb = (Buffer.byteLength(pagina) / 1024).toFixed(0);
  console.log(`dist/artifact.html e dist/index.html gerados (${dados.questoes.length} questões, ${kb} KB).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build();
