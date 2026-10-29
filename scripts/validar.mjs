// Valida o banco de questões: campos obrigatórios, ids únicos, blocos existentes
// e, para questões com lei anexada em fontes/, se cada trecho citado existe
// literalmente no artigo indicado. Sai com código 1 se houver erro.
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRUPOS_LEIS, LEIS, carregarLei, indicePorArtigo, normalizar } from './lib/leis.mjs';
import { ARMADILHAS, lerTodas, parseRef } from './lib/questoes.mjs';
import { lacunas, lerCloze, lerGlossario, refsResumo, semMarcas } from './lib/cloze.mjs';
import { numerosDe } from './lib/numeros.mjs';

// Refs que não apontam para norma anexada (doutrina, jurisprudência, textos de apoio). Qualquer outro id fora de leis.mjs é erro de digitação.
const REFS_SEM_TEXTO = new Set(['doutrina', 'stf', 'stj', 'tjue', 'texto', 'eciber', 'mrpr', 'lei13303']);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

export function validar({ silencioso = false } = {}) {
  const { blocos } = JSON.parse(readFileSync(join(RAIZ, 'questoes', 'blocos.json'), 'utf8'));
  const idsBlocos = new Set(blocos.map((b) => b.id));
  const leis = {};
  for (const id of Object.keys(LEIS)) {
    const lei = carregarLei(RAIZ, id);
    if (lei) leis[id] = { lei, idx: indicePorArtigo(lei) };
  }

  const questoes = lerTodas(RAIZ);
  const erros = [];
  const avisos = [];
  const vistos = new Map();
  const err = (q, msg) => erros.push(`${relative(RAIZ, q.arquivo)} · ${q.id}: ${msg}`);

  // O mesmo enunciado (com o mesmo texto de apoio e as mesmas alternativas) em dois itens faz a pessoa responder duas
  // vezes a mesma coisa e conta em dobro na revisão
  const chaveTexto = (q) => [q.enunciado, q.apoio, q.alt.join('|')].map((x) => String(x || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, ' ').trim()).join('#');
  const textos = new Map();
  for (const q of questoes) {
    if (vistos.has(q.id)) err(q, `id repetido (também em ${relative(RAIZ, vistos.get(q.id))})`);
    vistos.set(q.id, q.arquivo);
    const ct = chaveTexto(q);
    if (textos.has(ct)) err(q, `enunciado repetido: igual ao de ${textos.get(ct)}`);
    else textos.set(ct, q.id);
    if (!q.bloco || !idsBlocos.has(q.bloco)) err(q, `bloco inválido: ${q.bloco}`);
    if (q.alt.length) {
      // Múltipla escolha: 4 ou 5 alternativas, em ordem (A, B, C...), e o gabarito é uma delas
      const letras = 'ABCDE'.slice(0, q.alt.length);
      if (q.alt.length < 4 || q.alt.length > 5) err(q, `múltipla escolha precisa de 4 ou 5 alternativas (veio ${q.alt.length})`);
      q.alt.forEach((a, i) => { if (!new RegExp('^' + letras[i] + '\\s*\\|\\s*\\S').test(a)) err(q, `alternativa ${i + 1} deve começar por «${letras[i]} | »`); });
      if (!letras.includes(q.gab || '-')) err(q, `gab deve ser uma das letras ${letras} (veio ${q.gab})`);
    } else if (!['C', 'E'].includes(q.gab)) err(q, `gab deve ser C ou E (veio ${q.gab})`);
    if (!q.enunciado || q.enunciado.length < 30) err(q, 'enunciado ausente ou curto demais');
    if (!q.comentario || q.comentario.length < 30) err(q, 'comentário ausente ou curto demais');
    if (q.armadilha && !ARMADILHAS[q.armadilha]) err(q, `armadilha desconhecida: ${q.armadilha}`);
    if (q.dif && !['1', '2', '3'].includes(q.dif)) err(q, `dif deve ser 1, 2 ou 3`);
    if (/"/.test(q.enunciado || '')) err(q, 'use aspas curvas “ ” no enunciado');
    if (q.erroApoio) err(q, q.erroApoio);
    if (q.origem && !['original', 'adaptada', 'real'].includes(q.origem)) err(q, `origem desconhecida: ${q.origem}`);
    if (q.origem === 'real' && !q.prova) err(q, 'item real precisa de "prova:" (banca, órgão, ano, caderno e número do item)');

    const ref = parseRef(q.ref);
    if (!ref) {
      err(q, 'ref ausente');
      continue;
    }
    const fonte = leis[ref.lei];
    if (fonte) {
      const art = fonte.idx.get(ref.art);
      if (!art) {
        err(q, `artigo ${ref.art} não existe em ${ref.lei}`);
        continue;
      }
      if (!q.trecho.length) err(q, 'questão de lei anexada precisa de ao menos um trecho literal');
      const alvo = normalizar(art.texto);
      for (const t of q.trecho) {
        if (!alvo.includes(normalizar(t))) err(q, `trecho não encontrado no ${art.rotulo}: «${t}»`);
      }
    } else if (q.trecho.length && LEIS[ref.lei]) {
      avisos.push(`${q.id}: ${ref.lei} ainda não tem texto em fontes/ — trecho não conferido`);
    } else if (!LEIS[ref.lei] && !REFS_SEM_TEXTO.has(ref.lei)) {
      err(q, `norma desconhecida na ref: ${ref.lei} (use um id de leis.mjs ou ${[...REFS_SEM_TEXTO].join(', ')})`);
    }
  }

  // Estatística por bloco: total e equilíbrio certo/errado
  const porBloco = {};
  for (const q of questoes) {
    if (q.alt.length) continue;
    const s = (porBloco[q.bloco] ||= { total: 0, C: 0, E: 0 });
    s.total++;
    s[q.gab] = (s[q.gab] || 0) + 1;
  }
  for (const [b, s] of Object.entries(porBloco)) {
    if (s.total >= 10) {
      const pc = s.C / s.total;
      if (pc < 0.3 || pc > 0.7) avisos.push(`${b}: gabarito desequilibrado (${s.C} C × ${s.E} E)`);
    }
  }

  // Cada norma aparece em exatamente um grupo do seletor da lei seca
  const nosGrupos = GRUPOS_LEIS.flatMap(([, ids]) => ids);
  for (const id of Object.keys(LEIS)) {
    const n = nosGrupos.filter((x) => x === id).length;
    if (n !== 1) erros.push(`leis.mjs · ${id}: aparece ${n} vez(es) em GRUPOS_LEIS`);
  }
  for (const id of nosGrupos) if (!LEIS[id]) erros.push(`leis.mjs · GRUPOS_LEIS cita norma desconhecida ${id}`);

  // Blocos: artigos citados precisam existir
  for (const b of blocos) {
    const lei = b.lei || 'lgpd';
    if (!LEIS[lei]) erros.push(`blocos.json · ${b.id}: lei desconhecida ${lei}`);
    for (const a of b.artigos || []) {
      if (leis[lei] && !leis[lei].idx.get(a)) erros.push(`blocos.json · ${b.id}: artigo ${a} não existe em ${lei}`);
    }
  }

  // Cards cloze: texto sem lacunas precisa existir no artigo citado (exceto cards de doutrina)
  const notas = lerCloze(RAIZ);
  const idsNotas = new Map();
  for (const n of notas) {
    const onde = `${relative(RAIZ, n.arquivo)}:${n.linha}`;
    if (idsNotas.has(n.id)) erros.push(`${onde}: card repetido (igual à linha ${idsNotas.get(n.id)})`);
    idsNotas.set(n.id, n.linha);
    if (!n.bloco || !idsBlocos.has(n.bloco)) erros.push(`${onde}: bloco inválido ${n.bloco}`);
    const ls = lacunas(n.texto);
    if (!ls.length) erros.push(`${onde}: card sem lacuna {{...}}`);
    const ref = parseRef(n.ref);
    // Card de conceito (doutrina): não há texto normativo para conferir, mas o tema é obrigatório
    if (ref && ref.lei === 'doutrina') {
      if (!ref.art) erros.push(`${onde}: card de doutrina sem tema (use "doutrina <tema>")`);
      if (new Set(ls.map((l) => l.n)).size > 2) erros.push(`${onde}: card de doutrina com mais de 2 lacunas (uma ideia por card)`);
      continue;
    }
    // Card de resumo: texto próprio; cada artigo citado existe e cada número do texto está em algum deles
    const rs = refsResumo(n.ref);
    if (rs) {
      // Card atômico: uma ideia, no máximo duas lacunas (dois lados de um contraste) e frase curta
      const nums = new Set(ls.map((l) => l.n));
      if (nums.size > 2) erros.push(`${onde}: card de resumo com ${nums.size} lacunas (máximo 2)`);
      if (semMarcas(n.texto).length > 240) erros.push(`${onde}: card de resumo longo demais (${semMarcas(n.texto).length} caracteres; máximo 240)`);
      const arts = rs.map((x) => { const r = parseRef(x), f = r && leis[r.lei], a = f && r.art && f.idx.get(r.art); if (!a) erros.push(`${onde}: artigo citado não existe (${x})`); return a; }).filter(Boolean);
      if (arts.length === rs.length) {
        const base = numerosDe(arts.map((a) => a.texto).join('\n'), true);
        const faltam = [...numerosDe(semMarcas(n.texto), false)].filter((v) => v > 1 && !base.has(v));
        if (faltam.length) erros.push(`${onde}: número que não está nos artigos citados: ${faltam.join(', ')}`);
      }
      continue;
    }
    const fonte = ref && leis[ref.lei];
    if (!fonte) { erros.push(`${onde}: lei sem texto anexado (${n.ref})`); continue; }
    const art = fonte.idx.get(ref.art);
    if (!art) { erros.push(`${onde}: artigo ${ref.art} não existe`); continue; }
    if (!normalizar(art.texto).includes(normalizar(semMarcas(n.texto)))) erros.push(`${onde}: texto não encontrado no ${art.rotulo}: «${semMarcas(n.texto)}»`);
  }

  // Glossário
  const glossario = lerGlossario(RAIZ);
  const termosVistos = new Set();
  for (const t of glossario) {
    if (termosVistos.has(t.termo)) erros.push(`glossário: termo repetido ${t.termo}`);
    termosVistos.add(t.termo);
    if (!t.def || t.def.length < 25) erros.push(`glossário: definição curta demais em ${t.termo}`);
    if (t.tipo && t.tipo !== 'juridiques') erros.push(`glossário: tipo desconhecido em ${t.termo}: ${t.tipo}`);
  }

  if (!silencioso) {
    console.log(`Questões: ${questoes.length} · cards cloze: ${notas.length} notas / ${notas.reduce((s, n) => s + new Set(lacunas(n.texto).map((l) => l.n)).size, 0)} cards · glossário: ${glossario.length} termos`);
    for (const b of blocos) {
      const s = porBloco[b.id];
      if (s) console.log(`  ${b.id.padEnd(18)} ${String(s.total).padStart(4)}  (${s.C} C / ${s.E} E)`);
    }
    for (const a of avisos) console.log('aviso: ' + a);
    for (const e of erros) console.error('ERRO: ' + e);
    console.log(erros.length ? `\n${erros.length} erro(s).` : '\nTudo certo.');
  }
  return { questoes, erros, avisos, leis, blocos, notas, glossario };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { erros } = validar();
  process.exit(erros.length ? 1 : 0);
}
