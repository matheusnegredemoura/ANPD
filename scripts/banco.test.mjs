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
