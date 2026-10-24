// O código do app fica em src/js/, um arquivo por parte da tela ou das regras, e o build junta todos na ordem do nome
// (01-dados.js abre a função do app; 14-eventos.js a fecha). Tudo roda num único escopo, como se fosse um arquivo só.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function jsDoApp(raiz) {
  const dir = join(raiz, 'src', 'js');
  return readdirSync(dir).filter((f) => f.endsWith('.js')).sort().map((f) => readFileSync(join(dir, f), 'utf8')).join('');
}
