// Gera o aplicativo em arquivo único.
//   dist/artifact.html  conteúdo da página para publicar como Artifact (sem <html>/<head>/<body>)
//   dist/index.html     documento completo, para abrir no navegador ou hospedar em qualquer lugar
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARMADILHAS, parseRef } from './lib/questoes.mjs';
import { GRUPOS_LEIS, LEIS } from './lib/leis.mjs';
import { validar } from './validar.mjs';
import { lacunas } from './lib/cloze.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (...p) => readFileSync(join(RAIZ, ...p), 'utf8');

const NOMES_FONTE = {
  lgpd: 'LGPD',
  cf: 'CF/88',
  gdpr: 'GDPR',
  res1: 'Res. CD/ANPD 1/2021',
  res2: 'Res. CD/ANPD 2/2022',
  res4: 'Res. CD/ANPD 4/2023',
  res15: 'Res. CD/ANPD 15/2024',
  res18: 'Res. CD/ANPD 18/2024',
  res19: 'Res. CD/ANPD 19/2024',
  lindb: 'LINDB (Decreto-Lei 4.657/1942)',
  res30: 'Res. CD/ANPD 30/2025',
  res31: 'Res. CD/ANPD 31/2025',
  decreto: 'Decreto',
  lc: 'LC',
  lei9784: 'Lei 9.784/1999',
  lei13848: 'Lei 13.848/2019',
  lei9986: 'Lei 9.986/2000',
  lei15211: 'ECA Digital (Lei 15.211/2025)',
  lei15352: 'Lei 15.352/2026',
  dec12880: 'Decreto 12.880/2026',
  dec12622: 'Decreto 12.622/2025',
  stj: 'STJ',
  lei8987: 'Lei 8.987/1995',
  eciber: 'E-Ciber (Decreto 10.222/2020)',
  lei14133: 'Lei 14.133/2021 (licitações e contratos)',
  lei14129: 'Lei 14.129/2021 (Governo Digital)',
  mrpr: 'Manual de Redação da Presidência da República',
  lei13303: 'Lei 13.303/2016 (estatais)',
  dl200: 'Decreto-Lei 200/1967',
  stf: 'STF',
  tjue: 'TJUE',
};

// Unidades que não são artigos
const UNIDADE = { res19c: 'cláusula', res4ap: 'Apêndice', enun1: 'Enunciado' };

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
  if (r.lei === 'tjue') {
    const caso = ref.slice(5).trim();
    const apelido = { 'C-311/18': 'Schrems II', 'C-362/14': 'Schrems I' }[caso];
    return 'TJUE · ' + caso + (apelido ? ' (' + apelido + ')' : '');
  }
  if (r.lei === 'nistcsf' && r.art) {
    const sec = /^S(\d)$/.exec(r.art);
    return 'NIST CSF 2.0, ' + (sec ? 'seção ' + sec[1] : r.art === 'A' ? 'Apêndice A' : r.art === 'C' ? 'Apêndice C (glossário)' : r.art) + (r.disp ? ', ' + r.disp : '');
  }
  if ((r.lei === 'res30' || r.lei === 'res31') && !/^(\d|Anexo)/.test(r.art || '')) return NOMES_FONTE[r.lei];
  const nome = NOMES_FONTE[r.lei] || (LEIS[r.lei] && LEIS[r.lei].curto) || r.lei.toUpperCase();
  if (!r.art) return nome;
  let art;
  if (UNIDADE[r.lei]) art = UNIDADE[r.lei] + ' ' + r.art;
  else if (r.lei === 'dec1171' && /^[IVXL]+$/.test(r.art)) art = 'item ' + r.art;
  else art = /^\d/.test(r.art) ? rotuloArtigo(r.art) : r.art;
  // "cláusula 16" com dispositivo "cláusula 16.1": basta o dispositivo
  if (r.disp && r.disp.toLowerCase().startsWith(art.split(' ')[0].toLowerCase() + ' ')) return `${nome}, ${r.disp}`;
  return `${nome}, ${art}${r.disp ? ', ' + r.disp : ''}`;
}

const FONTES_SEM_CONFERIR = new Set(['doutrina', 'texto']);

function compactar(questoes, leisAnexadas) {
  const apoios = [];
  const lista = questoes.map((q) => {
    const r = parseRef(q.ref);
    // Índice do texto de apoio; ausente quando o item não tem texto
    let ap;
    if (q.apoio) {
      ap = apoios.indexOf(q.apoio);
      if (ap < 0) ap = apoios.push(q.apoio) - 1;
    }
    return {
      id: q.id,
      b: q.bloco,
      g: q.gab,
      l: r.lei,
      art: leisAnexadas.has(r.lei) ? r.art : null,
      r: rotuloRef(q.ref),
      t: q.trecho,
      a: q.armadilha || 'literal',
      d: Number(q.dif || 2),
      e: q.enunciado,
      al: q.alt.length ? q.alt.map((x) => x.replace(/^[A-E]\s*\|\s*/, '')) : undefined,
      c: q.comentario,
      ap,
      p: q.pesquisar && q.pesquisar.length ? q.pesquisar : undefined,
      o: q.origem === 'real' ? 1 : undefined,
      ad: q.origem === 'adaptada' ? 1 : undefined,
      pv: q.prova || undefined,
      cm: q.comando || undefined,
      tm: q.tema || undefined,
      v: leisAnexadas.has(r.lei) || FONTES_SEM_CONFERIR.has(r.lei) ? undefined : 0,
    };
  });
  return { lista, apoios };
}

export function montarDados() {
  const { questoes, erros, leis, notas, glossario } = validar({ silencioso: true });
  if (erros.length) {
    for (const e of erros) console.error('ERRO: ' + e);
    throw new Error(`${erros.length} erro(s) no banco de questões; corrija antes do build.`);
  }
  const { disciplinas, blocos, faltam } = JSON.parse(ler('questoes', 'blocos.json'));
  const cronograma = JSON.parse(ler('dados', 'cronograma.json'));
  const { lista, apoios } = compactar(questoes, new Set(Object.keys(leis)));
  // Página "Como o Cebraspe cobra": cada disciplina e cada item real citado precisam existir no banco
  const cebraspe = JSON.parse(ler('dados', 'cebraspe.json'));
  const ids = new Set(lista.map((q) => q.id)), discs = new Set(disciplinas.map((d) => d.id));
  const errosCb = [];
  for (const d of cebraspe.disciplinas) {
    if (!discs.has(d.id)) errosCb.push(`cebraspe.json: disciplina inexistente ${d.id}`);
    for (const id of d.exemplos) if (!ids.has(id)) errosCb.push(`cebraspe.json (${d.id}): item inexistente ${id}`);
  }
  for (const p of cebraspe.padroes || []) for (const id of p.exemplos) if (!ids.has(id)) errosCb.push(`cebraspe.json (padrão ${p.titulo}): item inexistente ${id}`);
  // Discursiva: cada quesito precisa de um conceito para cada nota de 0 até o máximo
  const discursivas = JSON.parse(ler('dados', 'discursivas.json'));
  for (const t of discursivas.temas) {
    if (!t.id || !t.comando || !t.aspectos.length || ![15, 30].includes(t.linhas) || !t.pontos || !t.fatorErro) errosCb.push(`discursivas.json (${t.id}): campos obrigatórios`);
    for (const q of t.quesitos) if (q.conceitos.length !== q.max + 1 || !q.esperado.length) errosCb.push(`discursivas.json (${t.id}, ${q.titulo}): ${q.conceitos.length} conceitos para nota máxima ${q.max}`);
  }
  // Dia de discursiva no plano: o tema precisa existir
  const temasDisc = new Set(discursivas.temas.map((t) => t.id));
  for (const f of cronograma.fases) for (const s of f.semanas) for (const dia of s.dias) if (dia.disc && !temasDisc.has(dia.disc)) errosCb.push(`cronograma.json (${dia.data}): tema de discursiva inexistente ${dia.disc}`);
  // Trilhas: subtemas únicos, artigos existentes e todo tema de trilha usado nas questões precisa existir
  const trilhas = JSON.parse(ler('dados', 'trilhas.json')).trilhas;
  // Respostas às contestações: chegam com o banco, mesmo quando a contestação não conseguiu ir para a conta
  const respostasContest = JSON.parse(ler('dados', 'contestacoes-respostas.json'));
  for (const id of Object.keys(respostasContest)) if (!ids.has(id)) errosCb.push(`contestacoes-respostas.json: item inexistente ${id}`);
  // Artigos em português claro: a chave segue o formato das trilhas (lei:artigo) e o artigo precisa existir
  const claro = {};
  for (const [k, txt] of Object.entries(JSON.parse(ler('dados', 'claro.json')).artigos)) {
    const [l, a] = k.split(':');
    if (!leis[l] || !leis[l].lei.artigos.some((x) => x.id === a)) errosCb.push(`claro.json: artigo inexistente ${k}`);
    if (typeof txt !== 'string' || txt.length < 80 || txt.length > 2000) errosCb.push(`claro.json (${k}): texto ausente ou fora de 80 a 2000 caracteres`);
    if (/\*\*|\n/.test(txt)) errosCb.push(`claro.json (${k}): sem negrito com ** nem quebra de linha`);
    claro[l === 'lgpd' ? a : k] = txt;
  }
  const subtemas = new Set();
  const prefixos = new Set();
  for (const t of trilhas) {
    for (const st of t.subtemas) {
      if (subtemas.has(st.id)) errosCb.push(`trilhas.json: subtema repetido ${st.id}`);
      subtemas.add(st.id);
      prefixos.add(st.id.split('-')[0] + '-');
      if (!st.nome || !((st.aula && st.aula.length) || st.licao) || !st.chave || !st.armadilhas) errosCb.push(`trilhas.json (${st.id}): campos obrigatórios`);
      if (!st.simples || st.simples.length < 150 || st.simples.length > 700) errosCb.push(`trilhas.json (${st.id}): "simples" (o subtema em palavras simples) ausente ou fora de 150 a 700 caracteres`);
      // Lição estruturada: ideia central, mapa mental e partes (cada uma com ao menos um conteúdo)
      if (st.licao) {
        const li = st.licao;
        const mapaOk = li.mapa && li.mapa.centro && Array.isArray(li.mapa.ramos) && li.mapa.ramos.length && li.mapa.ramos.every((r) => r.t && Array.isArray(r.f));
        if (!li.ideia || !mapaOk || li.mapa.ramos.length > 6 || !Array.isArray(li.partes) || !li.partes.length) errosCb.push(`trilhas.json (${st.id}): lição incompleta`);
        for (const [i, p] of (li.partes || []).entries()) {
          if (!p.t || !['texto', 'lista', 'passos', 'tabela', 'ex', 'mnemo', 'atencao', 'porque'].some((k) => p[k])) errosCb.push(`trilhas.json (${st.id}): parte ${i + 1} sem título ou conteúdo`);
          if (p.tabela && !p.tabela.linhas.every((l) => l.length === p.tabela.cab.length)) errosCb.push(`trilhas.json (${st.id}): tabela da parte ${i + 1} com colunas desiguais`);
        }
      }
      st.arts = (st.artigos || []).map((k) => {
        const [l, a] = k.split(':');
        const ok = leis[l] && leis[l].lei.artigos.some((x) => x.id === a);
        if (!ok) errosCb.push(`trilhas.json (${st.id}): artigo inexistente ${k}`);
        return l === 'lgpd' ? a : k;
      });
      delete st.artigos;
    }
  }
  // Subtema com "blocos" recebe até "itens" questões do banco (padrão 30) desses blocos; com "soArtigos", só as que
  // citam os artigos do subtema; com "termos", só aquelas cujo enunciado traz um dos termos ("excluir" tira as que trazem).
  // A dificuldade vem misturada, perto de metade fácil, um terço média e o resto difícil (o nível que faltar cede a vez
  // aos outros), e, no mesmo nível, numa ordem fixa pelo id, para o conjunto não mudar de um build para outro. Questão
  // cujo tema já é de outra trilha fica com ele (um tema antigo que não é subtema pode ser trocado); múltipla escolha fica fora.
  const hashId = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
  const PESO_DIF = { 1: 0.5, 2: 0.35, 3: 0.15 };
  for (const t of trilhas) for (const st of t.subtemas) {
    if (!st.blocos) continue;
    for (const b of st.blocos) if (!blocos.some((x) => x.id === b)) errosCb.push(`trilhas.json (${st.id}): bloco inexistente ${b}`);
    const bl = new Set(st.blocos), arts = st.soArtigos ? new Set(st.arts) : null;
    const re = st.termos ? new RegExp(st.termos.join('|'), 'i') : null, fora = st.excluir ? new RegExp(st.excluir.join('|'), 'i') : null;
    const cand = lista.filter((q) => (!q.tm || !subtemas.has(q.tm)) && !q.al && bl.has(q.b) && (!arts || (q.art && arts.has(q.l === 'lgpd' ? q.art : q.l + ':' + q.art))) &&
      (!re || re.test(q.e)) && (!fora || !fora.test(q.e)));
    const pos = new Map(), vistos = {};
    for (const q of cand.sort((a, b) => hashId(a.id) - hashId(b.id))) { vistos[q.d] = (vistos[q.d] || 0) + 1; pos.set(q, (vistos[q.d] - 0.5) / (PESO_DIF[q.d] || 0.15)); }
    cand.sort((a, b) => pos.get(a) - pos.get(b) || a.d - b.d);
    // Perto de 55% certo e 45% errado, como no resto do banco, quando há itens dos dois lados
    // Itens que já trazem o tema do subtema no próprio arquivo contam para o mínimo de 12
    const proprios = lista.filter((q) => q.tm === st.id).length;
    const n = Math.min(cand.length, st.itens || 30), cs = cand.filter((q) => q.g === 'C'), es = cand.filter((q) => q.g !== 'C');
    const nC = Math.min(cs.length, Math.max(n - es.length, Math.round(n * 0.55)));
    for (const q of cs.slice(0, nC).concat(es.slice(0, n - nC))) q.tm = st.id;
    if (cand.length + proprios < 12) errosCb.push(`trilhas.json (${st.id}): só ${cand.length + proprios} itens nos blocos indicados`);
    delete st.blocos; delete st.soArtigos; delete st.itens; delete st.termos; delete st.excluir;
  }
  for (const q of lista) {
    if (!q.tm) continue;
    const pre = q.tm.split('-')[0] + '-';
    if (prefixos.has(pre) && !subtemas.has(q.tm)) errosCb.push(`${q.id}: tema de trilha inexistente ${q.tm}`);
  }
  if (errosCb.length) {
    for (const e of errosCb) console.error('ERRO: ' + e);
    throw new Error(`${errosCb.length} erro(s) em dados/cebraspe.json, discursivas.json ou trilhas.json.`);
  }
  const cloze = notas.map((n) => {
    const r = parseRef(n.ref);
    return { id: n.id, b: n.bloco, l: r.lei, art: r.lei === 'doutrina' ? undefined : r.art, r: rotuloRef(n.ref), t: n.texto, dc: n.dica || undefined };
  });
  // Frequência de cada termo do glossário nas questões: termos raros são sinalizados primeiro
  const textos = lista.map((q) => (q.e + ' ' + q.c).toLowerCase());
  const gloss = glossario.map((t) => {
    const re = regexTermo(t.padroes);
    const n = textos.filter((x) => re.test(x)).length;
    return { t: t.termo, p: t.padroes, d: t.def, s: t.busca, f: Math.round((n / textos.length) * 1000) / 1000, ...(t.tipo === 'juridiques' ? { j: 1 } : {}) };
  });
  const lei = {};
  for (const [id, { lei: l }] of Object.entries(leis)) {
    lei[id] = { nome: l.nome, curto: l.curto, url: l.url, artigos: l.artigos, ...(l.aviso ? { aviso: l.aviso } : {}) };
  }
  const grupos = GRUPOS_LEIS.map(([nome, ids]) => ({ nome, ids: ids.filter((id) => lei[id]) })).filter((g) => g.ids.length);
  return {
    versao: new Date().toISOString().slice(0, 10),
    disciplinas,
    blocos,
    armadilhas: ARMADILHAS,
    questoes: lista,
    apoios,
    lei,
    grupos,
    faltam: faltam || [],
    cronograma,
    cebraspe,
    discursivas,
    trilhas,
    cloze,
    glossario: gloss,
    respostasContest,
    claro,
  };
}

export function regexTermo(padroes) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(?<![\\p{L}\\d])(?:' + padroes.map(esc).join('|') + ')(?![\\p{L}\\d])', 'iu');
}

// O pacote vai enxuto e o app o reconstitui ao abrir (app.js, logo depois de ler D): comandos das questões numa
// tabela, estrutura do artigo só quando muda em relação ao anterior, rótulo "Art. N" implícito e campos vazios omitidos
export function empacotar(d) {
  const lei = {};
  for (const [id, l] of Object.entries(d.lei)) {
    let ant = null;
    lei[id] = { ...l, artigos: l.artigos.map((a) => {
      const o = { ...a }, est = JSON.stringify(a.estrutura);
      if (est === ant) delete o.estrutura;
      ant = est;
      if (a.rotulo === 'Art. ' + a.id) delete o.rotulo;
      return o;
    }) };
  }
  const comandos = [...new Set(d.questoes.map((q) => q.cm).filter((c) => typeof c === 'string'))];
  const idx = new Map(comandos.map((c, i) => [c, i]));
  const questoes = d.questoes.map((q) => {
    const o = { ...q };
    if (typeof q.cm === 'string') o.cm = idx.get(q.cm);
    if (q.art === null) delete o.art;
    if (Array.isArray(q.t) && !q.t.length) delete o.t;
    return o;
  });
  return { ...d, lei, questoes, comandos };
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
    .replace('/*__DADOS__*/', () => jsonSeguro(empacotar(dados)))
    .replace('/*__JS__*/', () => js);
  mkdirSync(join(RAIZ, 'dist'), { recursive: true });
  writeFileSync(join(RAIZ, 'dist', 'artifact.html'), pagina);
  const completo =
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '</head><body>' + pagina + '</body></html>';
  writeFileSync(join(RAIZ, 'dist', 'index.html'), completo);
  const kb = (Buffer.byteLength(pagina) / 1024).toFixed(0);
  const cards = dados.cloze.reduce((s, n) => s + new Set(lacunas(n.t).map((l) => l.n)).size, 0);
  console.log(`dist/ gerado: ${dados.questoes.length} questões, ${cards} cards, ${dados.glossario.length} termos, ${kb} KB.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build();
