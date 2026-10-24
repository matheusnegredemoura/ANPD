# Leva para o Painel TCU os recursos do Painel ANPD de 24/10/2026: edital e prova editáveis, prontidão no topo e
# Jornada recolhida, cota da semana (discursiva e simulado), tempo por item, causa do erro na correção, Caça-Pegadinha,
# masmorra da semana, card de número digitado, leitura fria, gaveta de erros e voz no artigo, reserva de itens reais
# para medida, revisões antes da prova, lista de verificação da discursiva e fontes sem bloquear a abertura.
# O código vai em portar_do_anpd_v2.diff, já adaptado ao TCU; o dado do Caça-Pegadinha vem de
# copiar_pegadinhas_do_anpd.py. Roda depois de comprimir_dados.py, portar_do_anpd.py e corrigir_tcu.py.
# Uso: python3 scripts/portar_do_anpd_v2.py "saida/Painel TCU.html"  (altera o arquivo no lugar; roda uma vez só)
# O diff só entra com o contexto idêntico: se o build mudou o código ao redor, o script para e diz onde.
import os
import re
import sys

caminho = sys.argv[1]
diff = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'portar_do_anpd_v2.diff')
html = open(caminho, encoding='utf-8').read()

# A linha do pacote de dados (vários MB) fica fora do diff
m = re.search(r'<script type="text/plain" id="dados">.*?</script>\n', html, re.S)
dados = m.group(0)
linhas = (html[:m.start()] + html[m.end():]).split('\n')


def hunks(texto):
    atual = None
    for l in texto.split('\n'):
        if l.startswith('@@'):
            atual = {'velho': [], 'novo': [], 'linha': int(re.match(r'@@ -(\d+)', l).group(1))}
            yield atual
        elif atual is not None and l[:1] in (' ', '-', '+'):
            if l[0] in ' -':
                atual['velho'].append(l[1:])
            if l[0] in ' +':
                atual['novo'].append(l[1:])


desloc = 0
# list(): cada trecho só fica completo depois de lidas as linhas dele
for i, h in enumerate(list(hunks(open(diff, encoding='utf-8').read().split('\n', 2)[2])), 1):
    if not h['velho']:
        sys.exit(f'Trecho {i} do diff está vazio.')
    alvo = h['linha'] - 1 + desloc
    n = len(h['velho'])
    # Procura o trecho idêntico perto da linha esperada (o build pode ter mudado o tamanho do arquivo antes dele)
    pos = next((alvo + d for d in sorted(range(-400, 401), key=abs) if linhas[alvo + d:alvo + d + n] == h['velho']), None)
    if pos is None:
        sys.exit(f'Trecho {i} do diff (linha {h["linha"]}) não confere com o arquivo: o código do TCU mudou ali. Nada foi gravado.')
    linhas[pos:pos + n] = h['novo']
    desloc = pos - (h['linha'] - 1) + len(h['novo']) - n

texto = '\n'.join(linhas)
alvo = '<script>\n(async function () {'
assert texto.count(alvo) == 1
open(caminho, 'w', encoding='utf-8').write(texto.replace(alvo, dados + alvo))
print('ok')
