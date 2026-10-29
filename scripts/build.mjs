// Gera o aplicativo em arquivo único.
//   dist/artifact.html  conteúdo da página para publicar como Artifact (sem <html>/<head>/<body>)
//   dist/index.html     documento completo, para abrir no navegador ou hospedar em qualquer lugar
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { ARMADILHAS, parseRef } from './lib/questoes.mjs';
import { GRUPOS_LEIS, LEIS } from './lib/leis.mjs';
import { validar } from './validar.mjs';
import { lacunas, refsResumo } from './lib/cloze.mjs';
import { jsDoApp } from './lib/fonte.mjs';

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
const UNIDADE = { res19c: 'cláusula', res4ap: 'Apêndice', enun1: 'Enunciado', guias: 'tema' };

function rotuloArtigo(art) {
  if (/^\d$/.test(art)) return `art. ${art}º`;
  return `art. ${art}`;
}

// Rótulo de cada unidade da jurisprudência anexada (fontes/stfsum.txt), preenchido em montarDados
const ROTULO_JURIS = new Map();

export function rotuloRef(ref) {
  const r = parseRef(ref);
  if (!r) return '';
  if (r.lei === 'texto') return 'Texto de apoio';
  if (r.lei === 'doutrina') return 'Doutrina · ' + ref.slice('doutrina'.length).trim();
  if (r.lei === 'decreto') return 'Decreto nº ' + r.art.replace(/(\d+)(\d{3})$/, '$1.$2') + '/2020';
  if (r.lei === 'lc') return 'Lei Complementar nº ' + r.art + '/2021';
  if (r.lei === 'stf') return 'STF · ' + ref.slice(4).trim();
  // Jurisprudência anexada: tribunal e nome curto da unidade ("STF · Tema 532 (RE 633.782)", "STJ · Súmula 37")
  if (r.lei === 'stfsum' && ROTULO_JURIS.has(r.art)) {
    const trib = r.art.startsWith('STJ') ? 'STJ' : r.art === 'SCHREMS' ? 'TJUE' : 'STF';
    const nome = r.art === 'SCHREMS' ? 'Schrems I e II (C-362/14 e C-311/18)' : ROTULO_JURIS.get(r.art).split(' — ')[0].replace(/ do STJ$/, '');
    return trib + ' · ' + nome + (r.disp ? ', ' + r.disp : '');
  }
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

// Fração dos trigramas do enunciado que aparecem no trecho citado. Item autoral que copia 60% ou mais da lei é fácil
// (88% de acerto na primeira resposta, contra 65% nos itens reais de dificuldade 2): a dificuldade dele vai para 1.
const semAcento = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
export function copiaDoTrecho(enunciado, trechos) {
  const e = semAcento(enunciado), t = semAcento((trechos || []).join(' '));
  if (e.length < 6 || t.length < 3) return 0;
  const tri = new Set();
  for (let i = 0; i + 2 < t.length; i++) tri.add(t[i] + ' ' + t[i + 1] + ' ' + t[i + 2]);
  let n = 0;
  for (let i = 0; i + 2 < e.length; i++) if (tri.has(e[i] + ' ' + e[i + 1] + ' ' + e[i + 2])) n++;
  return n / (e.length - 2);
}

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
      d: q.origem !== 'real' && copiaDoTrecho(q.enunciado, q.trecho) >= 0.6 ? 1 : Number(q.dif || 2),
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
  if (leis.stfsum) for (const a of leis.stfsum.lei.artigos) ROTULO_JURIS.set(a.id, a.rotulo);
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
    if (!t.id || !t.comando || !t.aspectos.length || !(Number.isInteger(t.linhas) && t.linhas >= 10 && t.linhas <= 60) || !t.pontos || !t.fatorErro) errosCb.push(`discursivas.json (${t.id}): campos obrigatórios`);
    for (const q of t.quesitos) if (q.conceitos.length !== q.max + 1 || !q.esperado.length) errosCb.push(`discursivas.json (${t.id}, ${q.titulo}): ${q.conceitos.length} conceitos para nota máxima ${q.max}`);
  }
  for (const e of discursivas.estruturas || []) if (!e.id || !e.nome || !e.uso || !e.modelo) errosCb.push(`discursivas.json (esqueleto ${e.id}): campos obrigatórios`);
  // Armadilhas que mais derrubam na ANPD (Como o Cebraspe cobra): o bloco abre o treino e o artigo precisa existir
  const { armadilhas: armadilhasANPD } = JSON.parse(ler('dados', 'armadilhas-anpd.json'));
  for (const a of armadilhasANPD) {
    if (!a.titulo || !a.errado || !a.certo) errosCb.push(`armadilhas-anpd.json (${a.id}): campos obrigatórios`);
    if (!blocos.some((b) => b.id === a.bloco)) errosCb.push(`armadilhas-anpd.json (${a.id}): bloco inexistente ${a.bloco}`);
    const [l, art] = a.art.includes(':') ? a.art.split(':') : ['lgpd', a.art];
    if (!leis[l] || !leis[l].lei.artigos.some((x) => x.id === art)) errosCb.push(`armadilhas-anpd.json (${a.id}): artigo inexistente ${a.art}`);
  }
  // Método do mentor, raio-x e edital projetado: cada bloco, disciplina e tema citado precisa existir
  const { nota: _notaMentor, ...mentor } = JSON.parse(ler('dados', 'mentor.json'));
  const idsBlocos = new Set(blocos.map((b) => b.id));
  for (const d of mentor.metodo.degrausFoco) for (const x of d.discs) if (!discs.has(x)) errosCb.push(`mentor.json (degrau ${d.ordem}): disciplina inexistente ${x}`);
  for (const c of mentor.metodo.ciclo25h) if (!idsBlocos.has(c.bloco) || !discs.has(c.disc)) errosCb.push(`mentor.json (ciclo ${c.id}): bloco ou disciplina inexistente`);
  for (const t of mentor.edital.topicos) if (!idsBlocos.has(t.bloco) || !['A', 'B', 'C'].includes(t.prio)) errosCb.push(`mentor.json (tópico ${t.topico}): bloco inexistente ou prioridade fora de A, B e C`);
  if (mentor.metodo.ciclo25h.reduce((n, c) => n + c.horas, 0) !== 25) errosCb.push('mentor.json: o ciclo semanal não soma 25 horas');
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
    // nu: a nota esconde dado arbitrário (prazo, número, quórum), o que card memoriza melhor que questão; entra primeiro
    const nu = lacunas(n.texto).some((l) => RE_DADO.test(l.t)) ? 1 : undefined;
    // Resumo: sem art (não entra no modo Testar da lei seca, que pinta o texto literal); ar abre os artigos citados
    const rs = refsResumo(n.ref);
    if (rs) {
      const ar = rs.map((x) => { const p = parseRef(x); return [p.lei, p.art]; });
      return { id: n.id, b: n.bloco, l: ar[0][0], r: [...new Set(ar.map(([l]) => rotuloRef(l)))].join(' · '), ar, t: n.texto, dc: n.dica || undefined, nu };
    }
    return { id: n.id, b: n.bloco, l: r.lei, art: r.lei === 'doutrina' ? undefined : r.art, r: rotuloRef(n.ref), t: n.texto, dc: n.dica || undefined, nu };
  });
  // Frequência de cada termo do glossário nas questões: termos raros são sinalizados primeiro
  const textos = lista.map((q) => (q.e + ' ' + q.c).toLowerCase());
  const gloss = glossario.map((t) => {
    const re = regexTermo(t.padroes);
    const n = textos.filter((x) => re.test(x)).length;
    return { t: t.termo, p: t.padroes, d: t.def, f: Math.round((n / textos.length) * 1000) / 1000, ...(t.tipo === 'juridiques' ? { j: 1 } : {}) };
  });
  const lei = {};
  for (const [id, { lei: l }] of Object.entries(leis)) {
    lei[id] = { nome: l.nome, curto: l.curto, url: l.url, artigos: l.artigos, ...(l.aviso ? { aviso: l.aviso } : {}) };
  }
  const grupos = GRUPOS_LEIS.map(([nome, ids]) => ({ nome, ids: ids.filter((id) => lei[id]) })).filter((g) => g.ids.length);
  return {
    versao: 'ANPD 2026/2027 · ' + new Date().toISOString().slice(0, 10),
    // Só o que o app lê (curto, faixa, prio, blocoProva, pontoPartida e hist ficam no blocos.json, para quem edita)
    disciplinas: disciplinas.map(({ id, nome, peso, degrau }) => ({ id, nome, peso, ...(degrau != null ? { degrau } : {}) })),
    blocos: blocos.map(({ prio, hist, ...b }) => b),
    armadilhas: ARMADILHAS,
    armadilhasANPD,
    mentor,
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

function regexTermo(padroes) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(?<![\\p{L}\\d])(?:' + padroes.map(esc).join('|') + ')(?![\\p{L}\\d])', 'iu');
}

// O pacote vai enxuto e o app o reconstitui ao abrir (src/js/01-dados.js, logo depois de ler D): textos que se repetem nas questões
// e nos cards (rótulo da referência, bloco, norma, prova, armadilha, tema e comando) viram índice numa tabela, o trecho
// da lei vira [início, tamanho] dentro do texto do artigo, a estrutura do artigo só vai quando muda em relação ao
// anterior, o rótulo "Art. N" fica implícito e campos vazios são omitidos
const TABELADOS = ['r', 'b', 'l', 'pv', 'a', 'tm', 'cm'];
export function empacotar(d) {
  const lei = {}, textoArt = new Map();
  for (const [id, l] of Object.entries(d.lei)) {
    let ant = null;
    lei[id] = { ...l, artigos: l.artigos.map((a) => {
      textoArt.set(id + ':' + a.id, a.texto);
      const o = { ...a }, est = JSON.stringify(a.estrutura);
      if (est === ant) delete o.estrutura;
      ant = est;
      if (a.rotulo === 'Art. ' + a.id) delete o.rotulo;
      return o;
    }) };
  }
  const tab = Object.fromEntries(TABELADOS.map((k) => [k, []])), pos = Object.fromEntries(TABELADOS.map((k) => [k, new Map()]));
  const tabelar = (o, campos) => {
    for (const k of campos) {
      if (typeof o[k] !== 'string') continue;
      let i = pos[k].get(o[k]);
      if (i === undefined) { i = tab[k].push(o[k]) - 1; pos[k].set(o[k], i); }
      o[k] = i;
    }
    return o;
  };
  const questoes = d.questoes.map((q) => {
    const o = tabelar({ ...q }, TABELADOS);
    if (q.art === null) delete o.art;
    const txt = q.art ? textoArt.get(q.l + ':' + q.art) : null;
    if (Array.isArray(q.t) && !q.t.length) delete o.t;
    else if (txt) o.t = q.t.map((t) => { const i = txt.indexOf(t); return i < 0 ? t : [i, t.length]; });
    return o;
  });
  const cloze = d.cloze.map((c) => tabelar({ ...c }, ['r', 'b', 'l']));
  return { ...d, lei, questoes, cloze, tab };
}

const RE_DADO = /\d|%|\b(uma?|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte|trinta|quarenta|sessenta|noventa|cem|cento|mil|milh\w*|bilh\w*|metade|ter[cç]o|dobro|dias?|horas?|meses|m[eê]s|anos?|semestr\w*|anual|mensal|qu[oó]rum|maioria|unanimidade|percent\w*)\b/i;

function build() {
  const dados = montarDados();
  const css = ler('src', 'app.css');
  const js = jsDoApp(RAIZ);
  const corpo = ler('src', 'app.html');
  const pagina = corpo
    .replace('/*__CSS__*/', () => css)
    .replace('/*__DADOS__*/', () => gzipSync(Buffer.from(JSON.stringify(empacotar(dados))), { level: 9 }).toString('base64'))
    .replace('/*__JS__*/', () => js);
  mkdirSync(join(RAIZ, 'dist'), { recursive: true });
  writeFileSync(join(RAIZ, 'dist', 'artifact.html'), pagina);
  const completo =
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<meta name="theme-color" content="#0c6b66"><meta name="apple-mobile-web-app-title" content="Painel ANPD">' +
    '</head><body>' + pagina + '</body></html>';
  writeFileSync(join(RAIZ, 'dist', 'index.html'), completo);
  const kb = (Buffer.byteLength(pagina) / 1024).toFixed(0);
  const cards = dados.cloze.reduce((s, n) => s + new Set(lacunas(n.t).map((l) => l.n)).size, 0);
  console.log(`dist/ gerado: ${dados.questoes.length} questões, ${cards} cards, ${dados.glossario.length} termos, ${kb} KB.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build();
