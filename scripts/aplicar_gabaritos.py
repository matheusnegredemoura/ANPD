# Aplica ao Painel TCU os gabaritos oficiais preenchidos na planilha dos itens em quarentena e devolve esses itens ao
# banco, um a um. Pode rodar de novo a cada leva de provas conferidas (o que já foi aplicado não muda).
# Uso: python3 scripts/aplicar_gabaritos.py relatorios/gran-quarentena-por-prova.csv "saida/Painel TCU.html"
#
# Na coluna gabarito_oficial: C ou E (ou CERTO/ERRADO) nos itens certo/errado; a letra da alternativa, na ordem da
# coluna alternativas, nos de múltipla escolha; ANULADA quando a banca anulou o item (fica fora de vez). Linhas em branco
# e as marcadas como "duplicado de …" (o banco já tem o item, com o gabarito da prova completa) são ignoradas.
# Quando o gabarito oficial difere do que veio do Gran, o item ganha id novo (sufixo -c): o que a pessoa respondeu nele
# foi corrigido contra o gabarito errado, então o painel passa a tratá-lo como inédito.
import base64
import csv
import gzip
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from planilha import ler_planilha  # noqa: E402

planilha, painel = sys.argv[1:3]
RE_DADOS = re.compile(r'(<script type="text/plain" id="dados">)(.*?)(</script>)', re.S)
GENERICO = re.compile(r'^(Item julgado (CERTO|ERRADO) pela banca|Gabarito oficial)', re.I)
LETRAS = 'ABCDE'


html = open(painel, encoding='utf-8').read()
m = RE_DADOS.search(html)
d = json.loads(gzip.decompress(base64.b64decode(m.group(2).strip())))
por_id = {}
for q in d['questoes']:
    por_id[q['id']] = q
    if q['id'].endswith('-c'):
        por_id[q['id'][:-2]] = q

cont = {'aplicados': 0, 'mudou': 0, 'anulados': 0, 'ja': 0}
problemas = []
# Registro permanente do que já foi aplicado: a planilha de trabalho, refeita, lista só o que falta; depois de um build
# novo, é este registro que devolve os itens conferidos (README, "Refazer depois de um novo build")
registro = os.path.join(os.path.dirname(os.path.abspath(planilha)), 'gabaritos-conferidos.csv')
conferidos = {l['id']: l['gabarito_oficial'] for l in ler_planilha(registro)} if os.path.exists(registro) else {}
for n, l in enumerate(ler_planilha(planilha), 2):
    v = (l.get('gabarito_oficial') or '').strip().upper()
    if not v or (l.get('situacao') or '').startswith('duplicado'):
        continue
    q = por_id.get((l.get('id') or '').strip())
    if not q or not q['id'].startswith('gran-'):
        problemas.append(f'linha {n}: id {l.get("id")!r} não está entre os itens do Gran')
        continue
    conferidos[l['id'].strip()] = v
    if v == 'ANULADA':
        if q.get('gv') != 'anulada':
            q['gv'] = 'anulada'
            cont['anulados'] += 1
        continue
    if q.get('al'):
        if len(v) != 1 or v not in LETRAS[:len(q['al'])]:
            problemas.append(f'linha {n} ({q["id"]}): "{v}" não é uma das letras A–{LETRAS[len(q["al"]) - 1]}')
            continue
    else:
        v = {'CERTO': 'C', 'ERRADO': 'E'}.get(v, v)
        if v not in ('C', 'E'):
            problemas.append(f'linha {n} ({q["id"]}): "{v}" não é C nem E')
            continue
    if q.get('gv') == 'oficial' and q['g'] == v:
        cont['ja'] += 1
        continue
    if q['g'] != v:
        q.setdefault('g0', q['g'])
        q['g'] = v
        if not q['id'].endswith('-c'):
            q['id'] += '-c'
        cont['mudou'] += 1
    q['gv'] = 'oficial'
    # O comentário do Gran só repetia o gabarito padrão (e pode contradizer o oficial)
    if not q.get('c') or GENERICO.match(q['c']):
        q['c'] = 'Gabarito conferido no gabarito oficial da banca. Este item ainda não tem comentário.'
    cont['aplicados'] += 1

if problemas:
    print('Nada foi gravado. Corrija na planilha:')
    print('\n'.join('  ' + p for p in problemas))
    sys.exit(1)
b64 = base64.b64encode(gzip.compress(json.dumps(d, ensure_ascii=False, separators=(',', ':')).encode('utf-8'), 9, mtime=0)).decode()
open(painel, 'w', encoding='utf-8').write(html[:m.start(2)] + b64 + html[m.end(2):])
if os.path.abspath(planilha) != os.path.abspath(registro):
    with open(registro, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['id', 'gabarito_oficial', 'situacao'])
        w.writerows([i, v, 'conferido'] for i, v in sorted(conferidos.items()))
print(f"{cont['aplicados']} itens voltaram ao banco ({cont['mudou']} com gabarito diferente do que veio do Gran); "
      f"{cont['anulados']} anulados; {cont['ja']} já estavam aplicados.")
