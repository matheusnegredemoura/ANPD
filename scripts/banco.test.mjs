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
  assert.equal(d.lei.lgpd.artigos.length, 80);
});

test('rótulos de referência', () => {
  assert.equal(rotuloRef('lgpd 5, VIII'), 'LGPD, art. 5º, VIII');
  assert.equal(rotuloRef('lgpd 55-J, § 2º'), 'LGPD, art. 55-J, § 2º');
  assert.equal(rotuloRef('res19 Anexo II, cláusula 16.1'), 'Res. CD/ANPD 19/2024, Anexo II, cláusula 16.1');
  assert.equal(rotuloRef('decreto 10411'), 'Decreto nº 10.411/2020');
});
