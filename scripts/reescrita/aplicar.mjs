// Aplica reescritas de itens (JSON: [{ id, e, a?, d?, c?, g? }]) nos arquivos de questoes/: troca enunciado (e), armadilha
// (a), dificuldade (d), comentário (c) e gabarito (g, para virar certo em errado ou o contrário), mantendo referência e trechos. Uso: node aplicar.mjs lote.json
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(new URL('.', import.meta.url).pathname, '..', '..');
const DIR = join(RAIZ, 'questoes');
const lote = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const porId = new Map(lote.map((x) => [x.id, x]));
const CAMPO = { e: 'enunciado', a: 'armadilha', d: 'dif', c: 'comentario', g: 'gab' };
const feitos = new Set();
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.txt'))) {
  const linhas = readFileSync(join(DIR, f), 'utf8').split('\n');
  const out = [];
  let atual = null, pular = false, mudou = false;
  for (const l of linhas) {
    const m = /^===\s*(\S+)/.exec(l);
    if (m) { atual = porId.get(m[1]) || null; if (atual) feitos.add(m[1]); pular = false; out.push(l); continue; }
    if (atual) {
      const c = /^(\w+):/.exec(l);
      if (c) {
        pular = false;
        const k = Object.keys(CAMPO).find((x) => CAMPO[x] === c[1]);
        if (k && atual[k] != null) { out.push(c[1] + ': ' + String(atual[k]).trim()); pular = true; mudou = true; continue; }
      } else if (pular && l.trim()) continue; // linha de continuação do campo trocado
      else if (pular && !l.trim()) pular = false;
    }
    out.push(l);
  }
  if (mudou) writeFileSync(join(DIR, f), out.join('\n'));
}
const faltam = lote.filter((x) => !feitos.has(x.id)).map((x) => x.id);
console.log('aplicadas', feitos.size, faltam.length ? 'NÃO ENCONTRADAS: ' + faltam.join(', ') : '');
