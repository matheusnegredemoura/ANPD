# Quarentena do Gran item a item: um item gran-* volta ao banco assim que o gabarito oficial dele for conferido (q.gv,
# gravado por aplicar_gabaritos.py), sem esperar a prova inteira. Roda depois de portar_do_anpd_v2.py.
# Uso: python3 scripts/quarentena_por_item.py "saida/Painel TCU.html"  (altera o arquivo no lugar; roda uma vez só)
import sys

caminho = sys.argv[1]
t = open(caminho, encoding='utf-8').read()


def trocar(velho, novo):
    global t
    n = t.count(velho)
    assert n == 1, f'esperava 1 ocorrência, achei {n}: {velho[:80]!r}'
    t = t.replace(velho, novo)


trocar("""const QUARENTENA = [/^gran-/];
function emQuarentena(q) { return QUARENTENA.some((r) => r.test(q.id)); }
const N_QUARENTENA = D.questoes.filter(emQuarentena).length;""", """// Item a item: o que já teve o gabarito conferido no gabarito oficial da banca (q.gv = 'oficial') volta ao banco; o
// anulado pela banca (q.gv = 'anulada') fica fora de vez e sai da contagem do que falta conferir
const QUARENTENA = [/^gran-/];
function emQuarentena(q) { return q.gv !== 'oficial' && QUARENTENA.some((r) => r.test(q.id)); }
const N_QUARENTENA = D.questoes.filter((q) => emQuarentena(q) && q.gv !== 'anulada').length;
const N_CONFERIDOS = D.questoes.filter((q) => q.gv === 'oficial' && QUARENTENA.some((r) => r.test(q.id))).length;""")
trocar("""    (N_QUARENTENA ? '<div class="cartao"><h2>Itens em quarentena</h2><p class="pequeno">' + fmtNum(N_QUARENTENA) + ' questões da raspagem do Gran estão fora do banco: vieram com o gabarito preenchido por padrão (A ou CERTO), e a conferência achou gabaritos errados. Voltam quando forem reimportadas com o gabarito oficial; o que você já respondeu nelas fica guardado.</p></div>' : '') +""",
       """    (N_QUARENTENA ? '<div class="cartao"><h2>Itens em quarentena</h2><p class="pequeno">' + fmtNum(N_QUARENTENA) + ' questões da raspagem do Gran estão fora do banco: vieram com o gabarito preenchido por padrão (A ou CERTO), e a conferência achou gabaritos errados. Cada uma volta assim que o gabarito dela for conferido no gabarito oficial da banca; o que você já respondeu nelas fica guardado.' + (N_CONFERIDOS ? ' Já voltaram ' + fmtNum(N_CONFERIDOS) + ', conferidas.' : '') + '</p></div>' : '') +""")
open(caminho, 'w', encoding='utf-8').write(t)
print('ok')
