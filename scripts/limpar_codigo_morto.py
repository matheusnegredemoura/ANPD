# Remove código morto do Painel TCU e corrige os tokens de cor, fonte e raio que o bloco de estilos do TCU usava sem
# existirem no tema (o navegador descartava essas declarações). Roda depois de quarentena_por_item.py.
# Uso: python3 scripts/limpar_codigo_morto.py "saida/Painel TCU.html"  (altera o arquivo no lugar; roda uma vez só)
import re
import sys

caminho = sys.argv[1]
t = open(caminho, encoding='utf-8').read()


def trocar(velho, novo, n=1):
    global t
    achou = t.count(velho)
    assert achou == n, f'esperava {n} ocorrência(s), achei {achou}: {velho[:80]!r}'
    t = t.replace(velho, novo)


# ---------- JS: constante sem uso e comentário que descrevia uma regra que não existe ----------
trocar("// Lista curta vencida acima deste número torna o dia pesado: a sessão de questões novas encolhe\nconst REVISOES_DIA_PESADO = 40;\n", "")
trocar("// Em dia pesado (lista curta vencida acima de REVISOES_DIA_PESADO), a sessão de questões do dia encolhe, até o mínimo de 10\n",
       "// Itens da sessão do dia: no treino, os 8 do Passo 2 da rotina; nos outros modos, até 30\n")

# ---------- JS: caixa do Caderno de Erros desenhada duas vezes na correção ----------
# As duas cópias tinham os mesmos ids; "Salvar regra" lia sempre o campo da primeira e perdia o que fosse digitado na
# segunda. Com uma caixa só, a causa do erro portada do Painel ANPD (renderCausaAgora) também sai: era um terceiro
# seletor da mesma causa na mesma tela, e a caixa do TCU já traz a causa e a regra de uma linha.
trocar("  html += caixaCadernoErro(q);\n  html += caixaCadernoErro(q);\n", "  html += caixaCadernoErro(q);\n")
trocar("    if (!ok && r !== BRANCO && sessao.modo !== 'simulado') html += renderCausaAgora(q);\n", "")
t = re.sub(r"function causaDe\(k\) \{[^\n]*\n// Causa do erro marcada na hora,[^\n]*\nfunction renderCausaAgora\(q\) \{\n.*?\n\}\n", '', t, count=1, flags=re.S)
trocar("""    case 'causa-agora': {
      const q = sessao && QI.get(sessao.ids[sessao.i]);
      if (!q || !causaDe(alvo.dataset.causa)) break;
      const e = (cadState().erros[q.id] ||= {});
      e.causa = alvo.dataset.causa; e.data = hojeISO();
      Store.salvar('perfil'); renderSessao(); break;
    }
""", "")
trocar("/* Causa do erro marcada na correção do item */\n.causa-agora{margin-top:10px;display:flex;flex-direction:column;gap:6px}\n.causa-agora p{margin:0}\n", "")
for nome in ('causaDe', 'renderCausaAgora', 'causa-agora'):
    assert nome not in t, nome

# ---------- JS: ações sem nenhum botão (sobras do Painel ANPD ou duplicadas por outra ação) ----------
trocar("    case 'anpd-set-degrau':\n", "")
trocar("    case 'anpd-treino-rapido':\n", "")
trocar("""    case 'limpar-causa-erro': {
      const qid = alvo.dataset.q; delete tcuState().erros[qid]; Store.salvar('perfil'); renderMais(); break;
    }
""", "")
trocar("    case 'filtro-causa-erro':\n    case 'set-filtro-causa': UI.filtroCausa", "    case 'filtro-causa-erro': UI.filtroCausa")
# ANVISA 2024 é caderno do ANPD; o TCU 2026 já abre pelos cadernos oficiais (caderno-oficial)
trocar("""    case 'simulado-anvisa-2024': {
      const ids = Q.filter((q) => q.id.startsWith('anvisa-2024-cebraspe-')).map((q) => q.id);
      if (!ids.length) { avisar('!', 'Caderno vazio', 'Nenhum item da ANVISA 2024 encontrado.'); break; }
      iniciarSessao({ modo: 'simulado', ids, minutos: Math.round(ids.length * 1.75), titulo: 'ANVISA 2024 · Cebraspe · ' + ids.length + ' itens' });
      break;
    }
    case 'simulado-tcu-2026': {
      const ids = Q.filter((q) => q.id.startsWith('tcu-aufc-2026-')).map((q) => q.id);
      if (!ids.length) { avisar('!', 'Caderno vazio', 'Nenhum item do TCU 2026 encontrado.'); break; }
      iniciarSessao({ modo: 'simulado', ids, minutos: Math.round(ids.length * 1.75), titulo: 'TCU 2026 · AUFC · Cebraspe · ' + ids.length + ' itens' });
      break;
    }
""", "")
trocar("    case 'simulado-oficial-200': case 'simulado-oficial-120': ", "    case 'simulado-oficial-200': ")
trocar("    case 'sync-tcu': case 'sync-anpd': ", "    case 'sync-anpd': ")

# ---------- CSS: classes que nada no painel usa ----------
mortas = ['anpd-banner-fase', 'anpd-degrau', 'anpd-topico-linha', 'anpd-tag-hist', 'anpd-sim-banner', 'cad-box', 'cad-grid',
          'termo-barra-container', 'termo-barra', 'termo-seg', 'ranking-vuln', 'ranking-vuln-item', 'tcu-freq', 'esq']
antes = t
for c in mortas:
    # regra de uma linha (no topo do <style> ou com recuo) cujo seletor começa pela classe morta
    t = re.sub(r'(?m)^[ \t]*\.' + re.escape(c) + r'(?![\w-])[^{\n]*\{[^}\n]*\}[ \t]*\n', '', t)
assert t != antes
trocar(".cad-kpi,.corte-kpi{", ".corte-kpi{")
trocar(":is(.cad-kpi,.corte-kpi) b{", ".corte-kpi b{")
trocar(":is(.cad-kpi,.corte-kpi) span{", ".corte-kpi span{")
trocar(",.seletor-bloco,", ",")
for c in mortas + ['cad-kpi', 'seletor-bloco']:
    estilo = ''.join(re.findall(r'<style>(.*?)</style>', t, re.S))
    assert not re.search(r'\.' + re.escape(c) + r'(?![\w-])', estilo), c

# ---------- Tokens que não existem no tema ----------
trocar("var(--muted)", "var(--ink-2)", 7)
trocar("var(--card)", "var(--surface)", 3)
trocar("var(--mono)", "var(--f-mono)", 6)
trocar("var(--raio)", "var(--r)", 5)
trocar("var(--mudo,#888)", "var(--ink-3)")
trocar("var(--mudo)", "var(--ink-3)")
trocar("var(--primaria,#6366f1)", "var(--accent)", 3)

open(caminho, 'w', encoding='utf-8').write(t)
print('ok')
