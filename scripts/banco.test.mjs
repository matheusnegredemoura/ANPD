import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validar } from './validar.mjs';
import { montarDados, rotuloRef, copiaDoTrecho } from './build.mjs';
import { jsDoApp } from './lib/fonte.mjs';

test('banco de questões sem erros e com trechos conferidos', () => {
  const { erros, questoes } = validar({ silencioso: true });
  assert.deepEqual(erros, []);
  assert.ok(questoes.length > 300);
});

test('toda questão de LGPD cita trecho literal', () => {
  const { questoes } = validar({ silencioso: true });
  const semTrecho = questoes.filter((q) => q.ref.startsWith('lgpd') && !q.trecho.length);
  assert.deepEqual(semTrecho.map((q) => q.id), []);
});

test('situação hipotética e item de reescrita nunca são dificuldade 1 (docs/padrao-cebraspe.md, protocolo 5)', () => {
  const { questoes } = validar({ silencioso: true });
  const reescrita = /could be replaced|can be replaced|replaced with|substituí|reescrit|mantém(-se)? (a correção|o sentido)|preserva(m)? (a correção|o sentido)|\bretoma\b|o pronome|refers to|refere-se a/i;
  const faceis = questoes.filter((q) => q.origem !== 'real' && q.dif === '1' && (/^situação hipotética/i.test(q.enunciado || '') || reescrita.test(q.enunciado || '')));
  assert.deepEqual(faceis.map((q) => q.id), []);
});

test('item errado autoral tem um único erro: o comentário não admite dois (docs/padrao-cebraspe.md, protocolo 2)', () => {
  const { questoes } = validar({ silencioso: true });
  const re = /errad[oa] duas vezes|erra duas vezes|dois erros|errad[oa] nas duas partes|erra nas duas partes/i;
  const duplos = questoes.filter((q) => q.origem !== 'real' && q.gab === 'E' && re.test(q.comentario || ''));
  assert.deepEqual(duplos.map((q) => q.id), []);
});

test('dados do build cobrem blocos, lei e cronograma', () => {
  const d = montarDados();
  const blocos = new Set(d.blocos.map((b) => b.id));
  for (const q of d.questoes) assert.ok(blocos.has(q.b), q.id);
  for (const f of d.cronograma.fases) for (const s of f.semanas) for (const dia of s.dias) for (const b of dia.blocos) assert.ok(blocos.has(b), dia.data + ' ' + b);
  // Discursiva no plano: uma por semana, duas por semana nas seis últimas antes da prova
  const temas = new Set(d.discursivas.temas.map((t) => t.id));
  const discs = d.cronograma.fases.flatMap((f) => f.semanas.flatMap((s) => s.dias)).filter((x) => x.disc);
  for (const x of discs) assert.ok(temas.has(x.disc), x.data + ' ' + x.disc);
  const semana = (iso) => { const t = Date.parse(iso + 'T12:00:00Z') / 86400000; return Math.floor((t - 4) / 7); };
  const porSemana = new Map();
  for (const x of discs) porSemana.set(semana(x.data), (porSemana.get(semana(x.data)) || 0) + 1);
  const ultima = semana(d.cronograma.prova);
  for (let w = semana(discs[0].data); w <= ultima; w++) assert.ok((porSemana.get(w) || 0) >= (ultima - w < 6 ? 2 : 1), 'semana ' + w + ': ' + (porSemana.get(w) || 0));
  assert.equal(d.lei.lgpd.artigos.length, 80);
});

test('rótulos de referência', () => {
  assert.equal(rotuloRef('lgpd 5, VIII'), 'LGPD, art. 5º, VIII');
  assert.equal(rotuloRef('lgpd 55-J, § 2º'), 'LGPD, art. 55-J, § 2º');
  assert.equal(rotuloRef('res19 Anexo II, cláusula 16.1'), 'Res. CD/ANPD 19/2024, Anexo II, cláusula 16.1');
  assert.equal(rotuloRef('decreto 10411'), 'Decreto nº 10.411/2020');
  assert.equal(rotuloRef('tjue C-311/18'), 'TJUE · C-311/18 (Schrems II)');
  assert.equal(rotuloRef('res15'), 'Res. CD/ANPD 15/2024');
});

test('gabarito equilibrado entre certo e errado', () => {
  const { questoes } = validar({ silencioso: true });
  const c = questoes.filter((q) => q.gab === 'C').length / questoes.length;
  assert.ok(c >= 0.4 && c <= 0.6, 'proporção de C fora de 40–60%: ' + (c * 100).toFixed(1) + '%');
});

test('questões de lei não anexada saem marcadas para conferir', () => {
  const d = montarDados();
  const anexadas = new Set(Object.keys(d.lei));
  for (const q of d.questoes) {
    if (anexadas.has(q.l) || q.l === 'doutrina' || q.l === 'texto') assert.equal(q.v, undefined, q.id);
    else assert.equal(q.v, 0, q.id);
  }
});

test('cards cloze têm ao menos uma lacuna', () => {
  const d = montarDados();
  for (const n of d.cloze) assert.match(n.t, /\{\{[^}]+\}\}/, n.r);
});

test('pacote compactado volta igual ao original no app', async () => {
  const { empacotar } = await import('./build.mjs');
  const d = montarDados();
  const pacote = JSON.parse(JSON.stringify(empacotar(d)));
  assert.ok(JSON.stringify(pacote).length < JSON.stringify(d).length);
  // O mesmo trecho que o app roda logo depois de ler os dados
  const js = jsDoApp(new URL('..', import.meta.url).pathname);
  const ini = js.indexOf('// O pacote chega enxuto'), fim = js.indexOf('const Q = D.questoes;');
  assert.ok(ini > 0 && fim > ini);
  new Function('D', js.slice(ini, fim))(pacote);
  delete pacote.tab;
  const esperado = JSON.parse(JSON.stringify(d));
  // A diferença do banco inteiro de uma vez estoura a memória do processo: aponta o primeiro elemento que difere
  for (const k of Object.keys(esperado)) {
    const a = pacote[k], b = esperado[k];
    if (Array.isArray(b)) b.forEach((x, i) => { if (JSON.stringify(a && a[i]) !== JSON.stringify(x)) assert.deepEqual(a && a[i], x, k + '[' + i + ']'); });
  }
  assert.deepEqual(pacote, esperado);
});

// Um erro de sintaxe em qualquer parte de src/js derruba o painel inteiro; o build não roda o JS e não percebe
test('JS do app compila', () => {
  assert.doesNotThrow(() => new Function(jsDoApp(new URL('..', import.meta.url).pathname)));
});

test('plano do zero: subtemas existem, seguem a ordem da trilha e trazem os blocos dos próprios itens', () => {
  const d = montarDados();
  const dias = d.cronograma.fases.flatMap((f) => f.semanas.flatMap((s) => s.dias)).filter((x) => x.st);
  assert.ok(dias.length >= 60, 'poucos dias com subtema: ' + dias.length);
  const pos = new Map(), trilhaDe = new Map();
  for (const t of d.trilhas) t.subtemas.forEach((st, i) => { pos.set(st.id, i); trilhaDe.set(st.id, t.id); });
  const primeiro = new Map();
  for (const x of dias) {
    assert.ok(pos.has(x.st), x.data + ': subtema inexistente ' + x.st);
    assert.equal(x.modo, 'treino', x.data + ': subtema em dia que não é de treino');
    if (!primeiro.has(x.st)) primeiro.set(x.st, x.data);
    // a maior parte dos itens do subtema vem dos blocos do dia (o atraso dá baixa por bloco)
    const itens = d.questoes.filter((q) => q.tm === x.st), noDia = itens.filter((q) => x.blocos.includes(q.b)).length;
    assert.ok(noDia * 2 >= itens.length, x.data + ' ' + x.st + ': só ' + noDia + ' de ' + itens.length + ' itens nos blocos do dia');
  }
  for (const [st, data] of primeiro) for (const [outro, data2] of primeiro) {
    if (trilhaDe.get(st) !== trilhaDe.get(outro) || pos.get(st) >= pos.get(outro)) continue;
    assert.ok(data < data2, 'fora da ordem da trilha: ' + st + ' (' + data + ') depois de ' + outro + ' (' + data2 + ')');
  }
});

test('normas sem redação antiga repetida ao lado da atual (mesmo rótulo, texto quase igual, em linhas seguidas)', () => {
  const d = montarDados();
  const rot = (l) => { const m = /^\s*[“"]?((?:Art\.\s?[\dA-Zº°-]+|§\s?\d+\s?[º°]?(?:-[A-Z])?|Parágrafo único|[IVXLC]+(?:-[A-Z])?\s?[-–]|[a-z]\)))/.exec(l); return m ? m[1].replace(/\s/g, '') : null; };
  const palavras = (s) => new Set(s.toLowerCase().replace(/\([^)]*\)/g, '').split(/[^a-zà-ú0-9]+/).filter((w) => w.length > 3));
  const repetidas = [];
  for (const [id, L] of Object.entries(d.lei)) for (const a of L.artigos) {
    const ls = a.texto.split('\n').filter((x) => x.trim());
    for (let i = 1; i < ls.length; i++) {
      const r = rot(ls[i]);
      if (!r || r !== rot(ls[i - 1])) continue;
      const A = palavras(ls[i - 1]), B = palavras(ls[i]);
      if ([...A].filter((w) => B.has(w)).length / Math.max(1, Math.min(A.size, B.size)) >= 0.5) repetidas.push(id + ':' + a.id + ' ' + r);
    }
  }
  assert.deepEqual(repetidas, []);
});

test('notas de redação, inclusão e revogação nas normas sempre fechadas com parêntese', () => {
  const d = montarDados();
  const abertas = [];
  for (const [id, L] of Object.entries(d.lei)) for (const a of L.artigos) for (const l of a.texto.split('\n')) {
    if (/\((Redação dada|Incluíd[oa]|Revogad[oa])[^)]*$/.test(l)) abertas.push(id + ':' + a.id + ' ' + l.slice(0, 60));
    // rótulo de link do Planalto que não é texto da norma
    if (/[).\d]\s+\(?(?:[Vv]igência|Produção de efeitos?)\)?(\s|$)/.test(l)) abertas.push(id + ':' + a.id + ' Vigência: ' + l.slice(-60));
    // e abertas: "c) Revogada);" sem o parêntese de abertura
    if (/(?:^|[\s)–-])Revogad[oa]\)/.test(l) && !/\(Revogad[oa]\)/.test(l)) abertas.push(id + ':' + a.id + ' ' + l.slice(0, 60));
  }
  assert.deepEqual(abertas, []);
});

test('itens certos: todo número do enunciado está na norma citada (ou foi conferido à mão)', async () => {
  const { auditarNumeros } = await import('./auditar-numeros.mjs');
  const v = validar({ silencioso: true });
  assert.deepEqual(auditarNumeros(v).map((s) => s.id + ' ' + s.faltam.join(',')), []);
  // e a auditoria pega um prazo trocado
  const q = v.questoes.find((x) => x.id === 'air-08');
  const falso = { ...q, id: 'teste', enunciado: q.enunciado.replace('45 dias', '30 dias') };
  assert.equal(auditarNumeros({ questoes: [falso], leis: v.leis }).length, 1);
});

test('comentários: todo prazo ou percentual está em alguma norma anexada ou no enunciado (ou foi conferido à mão)', async () => {
  const { auditarPrazosComentarios } = await import('./auditar-numeros.mjs');
  const v = validar({ silencioso: true });
  assert.deepEqual(auditarPrazosComentarios(v).map((s) => s.id + ' ' + s.faltam.join(',')), []);
  // e a auditoria pega um prazo inventado no comentário
  const q = v.questoes.find((x) => /\b15 dias\b/.test(x.comentario) && !/\b17 dias\b/.test(x.enunciado));
  const falso = { ...q, id: 'teste', comentario: q.comentario.replace(/\b15 dias\b/, '17 dias') };
  assert.equal(auditarPrazosComentarios({ questoes: [falso], leis: v.leis }).length, 1);
});

test('nota interna do arquivo (//) não vaza para o texto do item', () => {
  const vazados = validar({ silencioso: true }).questoes.filter((q) => ['enunciado', 'comentario', 'apoio'].some((k) => /(^|\n)\s*\/\//.test(q[k] || ''))).map((q) => q.id);
  assert.deepEqual(vazados, []);
});

test('glossário: cada padrão marca uma entrada só (o termo grifado não abre a definição de outra)', () => {
  const { glossario } = validar({ silencioso: true });
  const sem = (x) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const dono = new Map(), repetidos = [];
  for (const g of glossario) for (const p of g.padroes) { const k = sem(p); if (dono.has(k) && dono.get(k) !== g.termo) repetidos.push(p + ': ' + dono.get(k) + ' × ' + g.termo); else dono.set(k, g.termo); }
  assert.deepEqual(repetidos, []);
});

test('item autoral não copia 60% ou mais do trecho da norma (padrão Cebraspe)', () => {
  const copiados = validar({ silencioso: true }).questoes
    .filter((q) => q.origem !== 'real' && q.trecho && q.trecho.length && copiaDoTrecho(q.enunciado, q.trecho) >= 0.6)
    .map((q) => q.id);
  assert.deepEqual(copiados, [], 'reescreva em paráfrase ou situação hipotética (docs/padrao-cebraspe.md)');
});

// O tamanho não pode entregar o gabarito: em cada quarto do banco autoral (do item mais curto ao mais longo) e nas
// situações hipotéticas, os certos ficam entre 38% e 62%, como nos itens reais da banca
test('tamanho do item e situação hipotética não entregam o gabarito', () => {
  const qs = validar({ silencioso: true }).questoes.filter((q) => q.origem !== 'real' && !q.alt.length && /^[CE]$/.test(q.gab) && !/^(pt|en)/.test(q.id));
  const tam = (q) => q.enunciado.split(/\s+/).length;
  const ord = qs.slice().sort((a, b) => tam(a) - tam(b)), n = ord.length;
  const certos = (a) => Math.round(100 * a.filter((q) => q.gab === 'C').length / a.length);
  const grupos = [0, 1, 2, 3].map((i) => certos(ord.slice(Math.floor(i * n / 4), Math.floor((i + 1) * n / 4))));
  grupos.push(certos(qs.filter((q) => /^Situação hipotética/.test(q.enunciado))));
  assert.ok(grupos.every((p) => p >= 38 && p <= 62), '% de certos por quarto de tamanho e nos casos: ' + grupos.join(' / '));
});

// Nem palavra solta: "dispensa" chegou a marcar 81% de itens errados (na banca, 63%), e quem treina aqui aprenderia
// a chutar pela palavra. Com 40 itens ou mais, cada sinal fica entre 30% e 70% de errados, como nos itens reais
test('palavras-sinal não entregam o gabarito', () => {
  const qs = validar({ silencioso: true }).questoes.filter((q) => q.origem !== 'real' && !q.alt.length && /^[CE]$/.test(q.gab) && !/^(pt|en)/.test(q.id));
  const SINAIS = { dispensa: /dispens/i, qualquer: /\bqualquer\b/i, 'ainda que': /ainda que/i, basta: /\bbasta/i, 'todo(s)/toda(s)': /\btod[oa]s?\b/i,
    independe: /independ/i, 'desde que': /desde que/i, exclusivo: /exclusiv/i, vedado: /\bvedad[oa]s?\b/i, 'somente/apenas/só': /\b(somente|apenas)\b|\bsó\b/i,
    integral: /integral/i, imediato: /imediat/i, 'salvo/exceto': /\b(salvo|exceto)\b/i, deve: /\bdev(e|em|erá|erão)\b/i, pode: /\bpod(e|em|erá|erão)\b/i, 'não': /\bnão\b/i,
    diretamente: /diretamente/i, 'for (quando for, se for)': /\bfor\b/i, 'além': /\balém\b/i, conforme: /\bconforme\b/i };
  const fora = [];
  for (const [nome, re] of Object.entries(SINAIS)) {
    const a = qs.filter((q) => re.test(q.enunciado)), e = Math.round(100 * a.filter((q) => q.gab === 'E').length / (a.length || 1));
    if (a.length >= 40 && (e < 30 || e > 70)) fora.push(nome + ' ' + e + '% errados em ' + a.length);
  }
  assert.deepEqual(fora, [], 'palavras que entregam o gabarito: ' + fora.join('; '));
});

test('itens do RPG: três por raridade e encaixe, com o texto literal da LGPD', () => {
  const src = readFileSync(new URL('../src/js/06-jornada.js', import.meta.url), 'utf8');
  const lista = src.slice(src.indexOf('const ITENS_RPG = ['), src.indexOf('];', src.indexOf('const ITENS_RPG = [')));
  const itens = [...lista.matchAll(/id: '([^']+)', slot: '(\w+)', rar: '(\w+)', nome: '([^']+)', lore: '([^']+)', ref: '([^']+)'/g)].map((m) => ({ id: m[1], slot: m[2], rar: m[3], lore: m[5], ref: m[6] }));
  const lgpd = readFileSync(new URL('../fontes/lgpd.txt', import.meta.url), 'utf8').replace(/\s+/g, ' ');
  assert.equal(new Set(itens.map((x) => x.id)).size, itens.length, 'id repetido');
  const pares = {};
  for (const x of itens) pares[x.slot + '/' + x.rar] = (pares[x.slot + '/' + x.rar] || 0) + 1;
  assert.deepEqual(Object.values(pares), Array(12).fill(3), JSON.stringify(pares));
  const fora = itens.filter((x) => !/^LGPD, art\./.test(x.ref) || !lgpd.includes(x.lore)).map((x) => x.id);
  assert.deepEqual(fora, [], 'lore fora do texto da LGPD');
});

test('dificuldade por disciplina: no máximo 35% fáceis e pelo menos 12% difíceis', () => {
  const d = montarDados(), B = new Map(d.blocos.map((b) => [b.id, b])), por = {};
  for (const q of d.questoes) if (!q.o && !q.al) (por[(B.get(q.b) || {}).disciplina] ||= []).push(q);
  const fora = [];
  for (const [disc, qs] of Object.entries(por)) {
    if (qs.length < 100) continue;
    const p = (n) => qs.filter((q) => (q.d || 2) === n).length / qs.length;
    if (p(1) > 0.35 || p(3) < 0.12) fora.push(disc + ' ' + Math.round(p(1) * 100) + '/' + Math.round(p(3) * 100));
  }
  assert.deepEqual(fora, []);
});

test('nenhum nome declarado duas vezes no escopo único do app', () => {
  // Os arquivos de src/js viram um só escopo no build: uma função nova com o nome de outra já existente a substitui
  // em silêncio (e o app para de abrir); const ou let repetidos quebram o script inteiro
  const vistos = new Map(), repetidos = [];
  for (const f of readdirSync('src/js').filter((x) => x.endsWith('.js')).sort()) {
    for (const [n, linha] of readFileSync('src/js/' + f, 'utf8').split('\n').entries()) {
      const m = /^(?:async\s+)?(?:function\s*\*?\s*([\p{L}_$][\p{L}\d_$]*)|(?:const|let|var)\s+([\p{L}_$][\p{L}\d_$]*))/u.exec(linha);
      if (!m) continue;
      const nome = m[1] || m[2], onde = f + ':' + (n + 1);
      if (vistos.has(nome)) repetidos.push(nome + ' em ' + vistos.get(nome) + ' e ' + onde); else vistos.set(nome, onde);
    }
  }
  assert.deepEqual(repetidos, []);
});
