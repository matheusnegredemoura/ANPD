# Copia o tipo de pegadinha (q.pg, usado pelo Caça-Pegadinha) do Painel ANPD para o Painel TCU, nas questões do tronco
# comum que têm o mesmo id, o mesmo enunciado e o mesmo gabarito nos dois painéis.
# Uso: python3 scripts/copiar_pegadinhas_do_anpd.py "Painel ANPD.html" "saida/Painel TCU.html"  (altera o TCU no lugar)
import base64
import gzip
import json
import re
import sys

anpd, tcu = sys.argv[1:3]
RE_DADOS = re.compile(r'(<script type="text/plain" id="dados">)(.*?)(</script>)', re.S)


def ler(html):
    m = RE_DADOS.search(html)
    return m, json.loads(gzip.decompress(base64.b64decode(m.group(2).strip())))


a_html = open(anpd, encoding='utf-8').read()
t_html = open(tcu, encoding='utf-8').read()
_, a = ler(a_html)
m, t = ler(t_html)

# O ANPD guarda alguns campos como índice numa tabela (D.tab); aqui eles voltam ao texto antes de comparar
tab = a.get('tab', {})


def texto(q, k):
    v = q.get(k)
    return tab[k][v] if k in tab and isinstance(v, int) else v


fonte = {q['id']: q for q in a['questoes'] if q.get('pg')}
n = 0
for q in t['questoes']:
    f = fonte.get(q['id'])
    if f and texto(f, 'e') == q['e'] and texto(f, 'g') == q['g'] and q.get('pg') != f['pg']:
        q['pg'] = f['pg']
        n += 1
b64 = base64.b64encode(gzip.compress(json.dumps(t, ensure_ascii=False, separators=(',', ':')).encode('utf-8'), 9, mtime=0)).decode()
t_html = t_html[:m.start(2)] + b64 + t_html[m.end(2):]
open(tcu, 'w', encoding='utf-8').write(t_html)
print(n, 'questões receberam o tipo de pegadinha')
