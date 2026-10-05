// Formato dos arquivos em questoes/*.txt
//
//   bloco: lgpd-17-22            (cabeçalho do arquivo, vale para todas as questões abaixo)
//
//   === lgpd-18-01               (id único)
//   gab: C | E
//   ref: lgpd 18, V              (lei + artigo; depois da vírgula, o dispositivo exibido)
//   trecho: texto literal         (pode repetir; precisa existir no artigo citado)
//   armadilha: rol                (tipo de pegadinha, ver ARMADILHAS)
//   dif: 1 | 2 | 3
//   enunciado: ...
//   comentario: ...
//   origem: original | adaptada | real   (opcional; padrão: original)
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const ARMADILHAS = {
  literal: 'Texto literal',
  rol: 'Rol taxativo ou exemplificativo',
  numero: 'Número, prazo ou quórum trocado',
  sujeito: 'Sujeito ou competência trocada',
  absoluto: 'Palavra absoluta (sempre, nunca, somente)',
  extrapolacao: 'Acrescenta o que a lei não diz',
  excecao: 'Exceção esquecida ou invertida',
  conceito: 'Conceito ou definição',
  vetado: 'Dispositivo vetado ou revogado',
  caso: 'Caso concreto',
  comparacao: 'Comparação entre regimes',
  interpretacao: 'Interpretação de texto',
};

const CAMPOS_MULTIPLOS = new Set(['trecho']);

export function lerArquivoQuestoes(caminho) {
  const bruto = readFileSync(caminho, 'utf8');
  const blocos = bruto.split(/^===\s*/m);
  const cabecalho = {};
  let ultimoCab = null;
  for (const linha of blocos[0].split('\n')) {
    if (linha.startsWith('//')) continue;
    const m = linha.match(/^(\w+):\s*(.*)$/);
    if (m) {
      ultimoCab = m[1];
      cabecalho[m[1]] = m[2].trim();
    } else if (ultimoCab && linha.trim()) {
      cabecalho[ultimoCab] += '\n' + linha.trim();
    }
  }
  const questoes = [];
  for (const b of blocos.slice(1)) {
    const linhas = b.split('\n');
    const id = linhas[0].trim();
    const q = { id, bloco: cabecalho.bloco, trecho: [], arquivo: caminho };
    if (cabecalho.apoio) q.apoio = cabecalho.apoio;
    let ultimo = null;
    for (const linha of linhas.slice(1)) {
      if (!linha.trim()) continue;
      const m = linha.match(/^(\w+):\s?(.*)$/);
      if (m) {
        const [, k, v] = m;
        ultimo = k;
        if (CAMPOS_MULTIPLOS.has(k)) q[k].push(v.trim());
        else q[k] = v.trim();
      } else if (ultimo && !CAMPOS_MULTIPLOS.has(ultimo)) {
        q[ultimo] += '\n' + linha.trim();
      }
    }
    questoes.push(q);
  }
  return questoes;
}

export function lerTodas(raiz) {
  const dir = join(raiz, 'questoes');
  const arquivos = readdirSync(dir).filter((f) => f.endsWith('.txt')).sort();
  return arquivos.flatMap((f) => lerArquivoQuestoes(join(dir, f)));
}

export function parseRef(ref) {
  if (!ref) return null;
  const [base, ...resto] = ref.split(',');
  const partes = base.trim().split(/\s+/);
  return { lei: partes[0], art: partes.slice(1).join(' ') || null, disp: resto.join(',').trim() || null };
}
