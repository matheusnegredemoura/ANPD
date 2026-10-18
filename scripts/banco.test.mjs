import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validar } from './validar.mjs';
import { montarDados, rotuloRef } from './build.mjs';

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
  const { readFileSync } = await import('node:fs');
  const d = montarDados();
  const pacote = JSON.parse(JSON.stringify(empacotar(d)));
  assert.ok(JSON.stringify(pacote).length < JSON.stringify(d).length);
  // O mesmo trecho que o app roda logo depois de ler os dados
  const js = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const ini = js.indexOf('// O pacote chega enxuto'), fim = js.indexOf('const Q = D.questoes;');
  assert.ok(ini > 0 && fim > ini);
  new Function('D', js.slice(ini, fim))(pacote);
  delete pacote.comandos;
  assert.deepEqual(pacote, JSON.parse(JSON.stringify(d)));
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
    if (/[).\d]\s+\(?Vigência\)?(\s|$)/.test(l)) abertas.push(id + ':' + a.id + ' Vigência: ' + l.slice(-60));
    // e abertas: "c) Revogada);" sem o parêntese de abertura
    if (/(?:^|[\s)–-])Revogad[oa]\)/.test(l) && !/\(Revogad[oa]\)/.test(l)) abertas.push(id + ':' + a.id + ' ' + l.slice(0, 60));
  }
  assert.deepEqual(abertas, []);
});
