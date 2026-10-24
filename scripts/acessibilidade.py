# Correções de acessibilidade apontadas pelo axe-core no Painel TCU: idioma da página, contraste do texto secundário no
# tema claro, papel da tira de respostas e título principal. Roda depois de tela_larga.py.
# Uso: python3 scripts/acessibilidade.py "saida/Painel TCU.html"  (altera o arquivo no lugar; roda uma vez só)
import sys

caminho = sys.argv[1]
t = open(caminho, encoding='utf-8').read()


def trocar(velho, novo, n=1):
    global t
    achou = t.count(velho)
    assert achou == n, f'esperava {n} ocorrência(s), achei {achou}: {velho[:80]!r}'
    t = t.replace(velho, novo)


# Sem lang, leitor de tela e tradutor tratam o painel como inglês
trocar('<!doctype html><html><head>', '<!doctype html><html lang="pt-BR"><head>')
# Texto secundário do tema claro: 4,1:1 no branco; #5a6b63 passa de 4,5:1 no branco, no fundo e no cinza dos cartões
trocar('--ink-3:#6f8179', '--ink-3:#5a6b63', 2)
# aria-label só vale em elemento com papel
trocar('\'<div class="tira" aria-label="Folha de respostas">\'', '\'<div class="tira" role="group" aria-label="Folha de respostas">\'')
# O nome do painel no cabeçalho é o título da página
trocar("""'<div class="marca"><b>Painel TCU</b>""", """'<div class="marca"><b role="heading" aria-level="1">Painel TCU</b>""")

open(caminho, 'w', encoding='utf-8').write(t)
print('ok')
