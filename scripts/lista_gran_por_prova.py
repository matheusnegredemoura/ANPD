# Lista os itens do Gran em quarentena (ids gran-*) agrupados pela prova de origem, para reimportar com o gabarito oficial.
# Uso: python3 scripts/lista_gran_por_prova.py pacote.json relatorios/
# O pacote é o JSON do #dados do Painel TCU já descomprimido (gzip + base64).
# Gera gran-quarentena-por-prova.md (resumo) e gran-quarentena-por-prova.csv (planilha de trabalho, uma linha por item,
# com a coluna gabarito_oficial em branco para preencher).
import collections
import csv
import json
import re
import sys
import unicodedata

pacote, saida = sys.argv[1:3]
d = json.load(open(pacote, encoding='utf-8'))
B = {b['id']: b for b in d['blocos']}
DI = {x['id']: x for x in d['disciplinas']}
G = [q for q in d['questoes'] if q['id'].startswith('gran-')]
O = [q for q in d['questoes'] if not q['id'].startswith('gran-')]
LINK = re.compile(r'^\[([^\]]*)\]\((https?://[^)]*)\)$')
LETRAS = 'ABCDE'


def norm(s):
    s = unicodedata.normalize('NFKD', (s or '').lower())
    return re.sub(r'[^a-z0-9]', '', ''.join(c for c in s if not unicodedata.combining(c)))


def prova(q):
    m = LINK.match(q.get('pv') or '')
    return (m.group(1), m.group(2)) if m else ((q.get('pv') or 'Sem prova informada').strip(), '')


def letra_certa(q):
    """Texto da alternativa correta (múltipla escolha) ou C/E."""
    if not q.get('al'):
        return q['g']
    i = LETRAS.find(q['g'])
    return q['al'][i] if 0 <= i < len(q['al']) else None


# Itens do Gran que já estão no banco, vindos de uma prova completa: o gabarito dessa prova é a referência
exato = collections.defaultdict(list)
inicio = collections.defaultdict(list)
for q in O:
    exato[norm(q['e'])].append(q)
    if len(norm(q['e'])) >= 120:
        inicio[norm(q['e'])[:120]].append(q)


def gemeo(g):
    ms = exato.get(norm(g['e']))
    if ms:
        m = ms[0]
        if g.get('al'):
            alvo = norm(letra_certa(m))
            letra = next((LETRAS[i] for i, a in enumerate(g['al']) if norm(a) == alvo), '')
        else:
            letra = m['g']
        return 'duplicado', m['id'], letra
    ms = inicio.get(norm(g['e'])[:120]) if len(norm(g['e'])) >= 120 else None
    if ms:
        return 'possível duplicado', ms[0]['id'], ''
    return '', '', ''


linhas = []
for q in G:
    nome, url = prova(q)
    sit, gid, gab_gemeo = gemeo(q)
    b = B[q['b']]
    linhas.append({
        'prova': nome, 'link': url, 'banca': q.get('banca') or '', 'ano': q.get('ano') or '',
        'id': q['id'], 'questao_gran': re.search(r'q(\d+)$', q['id']).group(1),
        'disciplina': DI[b['disciplina']]['nome'], 'bloco': q['b'],
        'tipo': 'múltipla escolha' if q.get('al') else 'certo/errado',
        'gabarito_no_pacote': q['g'],
        'gabarito_oficial': gab_gemeo if sit == 'duplicado' else '',
        'situacao': (sit + ' de ' + gid) if sit else 'conferir',
        'enunciado': q['e'],
        'alternativas': ' | '.join(LETRAS[i] + ') ' + a for i, a in enumerate(q.get('al') or [])),
    })

por_prova = collections.defaultdict(list)
for l in linhas:
    por_prova[(l['prova'], l['link'])].append(l)
ordem = sorted(por_prova, key=lambda k: (-len(por_prova[k]), k[0]))
linhas = [l for k in ordem for l in sorted(por_prova[k], key=lambda l: l['id'])]

with open(saida + '/gran-quarentena-por-prova.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=list(linhas[0]))
    w.writeheader()
    w.writerows(linhas)

# ---------- Resumo ----------
dup = [l for l in linhas if l['situacao'].startswith('duplicado')]
diverge = [l for l in dup if l['gabarito_oficial'] != l['gabarito_no_pacote']]
possivel = [l for l in linhas if l['situacao'].startswith('possível')]
sem_link = [l for l in linhas if not l['link']]
tot_d = collections.Counter(B[q['b']]['disciplina'] for q in d['questoes'])
gr_d = collections.Counter(B[q['b']]['disciplina'] for q in G)


def cobertura(n):
    k = ordem[:n]
    return sum(len(por_prova[x]) for x in k)


L = ['# Itens do Gran em quarentena, por prova', '',
     f'**{len(G)} itens** de **{len(por_prova)} provas** ({sum(1 for k in por_prova if k[1])} com link para a prova no Gran). '
     'Ficaram fora do banco porque o gabarito veio preenchido por padrão: A em quase toda múltipla escolha e CERTO em quase todo item certo/errado.', '',
     '## A prova de que o gabarito está errado', '',
     f'- **{len(dup)} itens do Gran já estão no banco**, copiados de uma prova completa importada de outra fonte. '
     f'Em **{len(diverge)} deles o gabarito do Gran diverge** do gabarito da prova completa. '
     'Esses itens não precisam voltar: o banco já tem a versão certa (coluna `situacao` = "duplicado de …").',
     f'- Outros {len(possivel)} começam igual a um item do banco ("possível duplicado de …"); vale conferir antes de reimportar.',
     '- Na amostra lida à mão, 3 de 6 itens de múltipla escolha e 1 de 10 itens certo/errado tinham gabarito errado com certeza.', '',
     '## Como usar a planilha', '',
     '`gran-quarentena-por-prova.csv` tem uma linha por item, já agrupada por prova (as maiores primeiro). '
     'Para cada prova: abra o link, confira o gabarito definitivo e preencha a coluna `gabarito_oficial` '
     '(C ou E nos itens certo/errado; a letra da alternativa, na ordem da coluna `alternativas`, nos de múltipla escolha). '
     'A coluna `questao_gran` é o número da questão no site.', '',
     f'Os {len(sem_link)} itens sem link vieram com só o nome da prova; precisam ser procurados pelo enunciado.', '',
     '## Por onde começar', '',
     f'As provas são muitas e pequenas: as 20 maiores somam {cobertura(20)} itens ({100 * cobertura(20) / len(G):.0f}%), '
     f'as 50 maiores, {cobertura(50)} ({100 * cobertura(50) / len(G):.0f}%).', '',
     '### O que a quarentena tirou de cada disciplina', '',
     '| Disciplina | Itens no pacote | Em quarentena | % da disciplina |', '|---|---|---|---|']
for x in sorted(d['disciplinas'], key=lambda x: -gr_d[x['id']] / max(1, tot_d[x['id']])):
    k = x['id']
    if gr_d[k]:
        L.append(f"| {x['nome']} | {tot_d[k]} | {gr_d[k]} | {100 * gr_d[k] / tot_d[k]:.0f}% |")
L += ['', 'Contabilidade, AFO e Estatística perderam metade ou mais dos itens. As provas com mais itens dessas três disciplinas '
      'são as que mais devolvem ao banco.', '',
      '### As 30 maiores provas', '',
      '| # | Prova | Itens | C/E · ME | Disciplinas | A conferir |', '|---|---|---|---|---|---|']
for i, k in enumerate(ordem[:30], 1):
    ls = por_prova[k]
    ce = sum(1 for l in ls if l['tipo'] == 'certo/errado')
    disc = collections.Counter(l['disciplina'] for l in ls)
    disc_txt = ', '.join(f'{n} ({c})' for n, c in disc.most_common(3))
    nome = f'[{k[0]}]({k[1]})' if k[1] else k[0]
    L.append(f"| {i} | {nome} | {len(ls)} | {ce} · {len(ls) - ce} | {disc_txt} | {sum(1 for l in ls if not l['situacao'].startswith('duplicado'))} |")
L += ['', f'As outras {len(ordem) - 30} provas estão na planilha.', '',
      '## Itens que já estão no banco', '',
      '| Item do Gran | Gabarito no Gran | Situação | Gabarito da prova completa |', '|---|---|---|---|']
for l in dup:
    L.append(f"| `{l['id']}` | {l['gabarito_no_pacote']} | {l['situacao']} | {l['gabarito_oficial'] or '?'}{' ⚠ diverge' if l['gabarito_oficial'] != l['gabarito_no_pacote'] else ''} |")
open(saida + '/gran-quarentena-por-prova.md', 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print(len(G), 'itens;', len(por_prova), 'provas;', len(dup), 'duplicados (', len(diverge), 'divergem );', len(possivel), 'possíveis;',
      len(sem_link), 'sem link; top20', cobertura(20), 'top50', cobertura(50))
