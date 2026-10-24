# Layout para tela larga (monitor e ultrawide, a partir de 1200 px): as abas viram um trilho à esquerda, as telas de
# cartões correm em colunas, a sessão põe texto-base, questão e correção lado a lado (três colunas a partir de 1900 px)
# e o artigo da lei seca fica ao lado do português claro e das notas. No celular nada muda: os contêineres novos têm
# display:contents abaixo de 1200 px. Roda depois de limpar_codigo_morto.py.
# Uso: python3 scripts/tela_larga.py "saida/Painel TCU.html"  (altera o arquivo no lugar; roda uma vez só)
import re
import sys

caminho = sys.argv[1]
t = open(caminho, encoding='utf-8').read()


def trocar(velho, novo, n=1):
    global t
    achou = t.count(velho)
    assert achou == n, f'esperava {n} ocorrência(s), achei {achou}: {velho[:80]!r}'
    t = t.replace(velho, novo)


CSS = """
/* Tela larga (monitor e ultrawide, a partir de 1200 px): abas num trilho à esquerda, telas de cartões em colunas,
   sessão com texto-base | questão | correção e artigo da lei ao lado das notas. Abaixo de 1200 px os contêineres
   novos não existem para o layout (display:contents) e tudo fica como no celular. */
.item-t,.item-q,.item-r,.art-lado,.art-texto,.art-lado2{display:contents}
@media (min-width:1200px){
  :root{--trilho:96px;--col:620px}
  .app{max-width:none;margin:0;padding:0 32px 32px calc(var(--trilho) + 32px)}
  .topo{margin-inline:-32px;padding-inline:32px}
  .abas{top:0;right:auto;width:var(--trilho);flex-direction:column;justify-content:flex-start;gap:6px;padding:18px 10px;border-top:0;border-right:1px solid var(--line)}
  .abas>.aba{flex:0 0 auto;max-width:none;padding:10px 4px}
  .avisos{bottom:24px}
  .cronometro{bottom:16px}
  /* Telas de cartões: colunas de leitura (de cima para baixo, depois a coluna seguinte) */
  :is(#vista-hoje,#vista-cards,#vista-mais),#vista-lei:not(:has(.art-texto)){display:block;columns:3 var(--col);column-gap:20px}
  :is(#vista-hoje,#vista-cards,#vista-mais,#vista-lei)>*{break-inside:avoid;margin-bottom:20px}
  :is(#vista-cards,#vista-mais,#vista-lei)>:is(.secao-cab,.voltar,.prosa,.menu-mais,.secao:first-child){column-span:all}
  #vista-lei>:is(.secao-titulo,.capitulo){margin-bottom:10px}
  #vista-lei>.secao-titulo{break-after:avoid}
  /* Listas de blocos (Cards e Questões): os grupos de disciplina se repartem em colunas */
  #vista-cards>.secao:has(>.grupo-blocos){column-span:all}
  .secao:has(>.grupo-blocos){display:block;columns:3 420px;column-gap:20px}
  .secao:has(>.grupo-blocos)>.secao-cab{column-span:all;margin-bottom:10px}
  .grupo-blocos{break-inside:avoid;margin-bottom:16px}
  /* Questões: os cadernos oficiais numa coluna à esquerda; a montagem da sessão, na ordem, à direita */
  #vista-questoes{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.7fr);grid-template-rows:repeat(9,min-content) 1fr;column-gap:28px;align-items:start}
  #vista-questoes>*{grid-column:2;margin-bottom:16px}
  #vista-questoes>.tcu-cadernos-box{grid-column:1;grid-row:1 / -1}
  #vista-questoes .secao:has(>.grupo-blocos){columns:2 420px}
  .comecar-fixo{bottom:16px}
  .menu-mais{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr))}
  /* Artigo da lei seca: texto numa coluna de leitura; português claro, avisos e notas ao lado */
  #vista-lei:has(.art-texto){max-width:1640px}
  #vista-lei>.cartao:has(>.art-texto){display:grid;grid-template-columns:minmax(0,78ch) minmax(320px,1fr);grid-template-rows:auto auto min-content 1fr;column-gap:36px;row-gap:12px;align-items:start}
  #vista-lei>.cartao:has(>.art-texto)>:is(.rotulo,h2){grid-column:1 / -1}
  .art-texto,.art-lado,.art-lado2{display:flex;flex-direction:column;gap:12px;min-width:0}
  .art-texto{grid-column:1;grid-row:3 / span 2}
  .art-lado{grid-column:2;grid-row:3}
  .art-lado2{grid-column:2;grid-row:4}
  /* Sessão: questão | correção; com texto-base, ele fica numa coluna própria e acompanha a rolagem */
  .sessao-corpo{max-width:min(100%,1720px);padding-inline:32px}
  .sessao .item{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px 32px;align-items:start}
  .sessao .item>.item-cab{grid-column:1 / -1}
  .item-t,.item-q,.item-r{display:flex;flex-direction:column;gap:14px;min-width:0}
  .item-q{grid-column:1;grid-row:2}
  .item-r{grid-column:2;grid-row:2}
  .sessao .item:has(>.item-t){grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)}
  .sessao .item>.item-t{grid-column:1;grid-row:2 / span 2;position:sticky;top:12px;max-height:calc(100dvh - 140px);overflow-y:auto;padding-right:8px}
  .sessao .item:has(>.item-t)>.item-q{grid-column:2;grid-row:2}
  .sessao .item:has(>.item-t)>.item-r{grid-column:2;grid-row:3}
  .folha-painel{max-width:1100px}
}
@media (min-width:1900px){
  .sessao-corpo:has(.item-t){max-width:min(100%,2440px)}
  .sessao .item:has(>.item-t){grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr)}
  .sessao .item:has(>.item-t)>.item-r{grid-column:3;grid-row:2}
}
"""
trocar(".jornada details[open]>.jornada-resumo{margin-bottom:10px}\n\n</style>\n</head>",
       ".jornada details[open]>.jornada-resumo{margin-bottom:10px}\n" + CSS + "\n</style>\n</head>")

# ---------- Sessão: texto-base, questão e correção em contêineres próprios ----------
trocar("function renderApoio(q, aberto) {", """// Na tela larga o texto-base fica sempre aberto: há espaço para ele ao lado da questão
function telaLarga() { return matchMedia('(min-width:1200px)').matches; }
function renderApoio(q, aberto) {""")
trocar("""  html += renderApoio(q, sessao.i === 0 || sim || !sessao.ids.slice(0, sessao.i).some((x) => QI.get(x).ap === q.ap));
  html += renderComando(q);""", """  const ap = renderApoio(q, telaLarga() || sessao.i === 0 || sim || !sessao.ids.slice(0, sessao.i).some((x) => QI.get(x).ap === q.ap));
  if (ap) html += '<div class="item-t">' + ap + '</div>';
  // A questão fica em .item-q; o veredito e a correção, em .item-r (o fecho do último contêiner vai no return)
  html += '<div class="item-q">' + renderComando(q);""")
trocar("""  if (sessao.flash) {
    html += '<div class="veredito ' + sessao.flash""", """  if (sessao.flash) {
    html += '</div><div class="item-r"><div class="veredito ' + sessao.flash""")
trocar("""    html += '<div class="veredito ' + (ok ? 'ok' : 'no') + '"><span>' + (ok ? 'Você marcou '""",
       """    html += '</div><div class="item-r"><div class="veredito ' + (ok ? 'ok' : 'no') + '"><span>' + (ok ? 'Você marcou '""")
trocar("""<p class="atalhos">Enter = próximo</p>';
  }
  return html + '</article>';""", """<p class="atalhos">Enter = próximo</p>';
  }
  return html + '</div></article>';""")

# ---------- Lei seca: notas antes do texto, texto e notas depois em contêineres próprios ----------
trocar("""    avisoVuln + gavetaErrosArt(qs) +""", """    '<div class="art-lado">' + avisoVuln + gavetaErrosArt(qs) +""")
trocar("""    htmlClaro(a) + legendaCamadas() + '<div class="texto-lei">' + textoLei(a) + '</div>' + caixaJuridiques(a) + '<div class="linha-btns">';""",
       """    htmlClaro(a) + '</div><div class="art-texto">' + legendaCamadas() + '<div class="texto-lei">' + textoLei(a) + '</div></div>' +
    '<div class="art-lado2">' + caixaJuridiques(a) + '<div class="linha-btns">';""")
t, n = re.subn(r"(  if \(termos\.length\) html \+= '<div class=\"pesquisar-box\"><span class=\"rotulo\">Termos deste artigo para entender</span>[^\n]*\n)  return html \+ '</div>';\n",
               r"\1  return html + '</div></div>';\n", t)
assert n == 1, 'fim de renderArtigo'

open(caminho, 'w', encoding='utf-8').write(t)
print('ok')
