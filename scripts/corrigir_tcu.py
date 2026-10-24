# Correções no Painel TCU depois da análise crítica:
# - quarentena da raspagem do Gran (gabarito preenchido por padrão);
# - cofre do IndexedDB ligado (gravação automática e recuperação, que existiam sem ninguém chamar);
# - textos herdados do Painel ANPD e código morto.
# Uso: python3 scripts/corrigir_tcu.py "saida/Painel TCU.html"  (altera o arquivo no lugar; roda uma vez só)
import re
import sys

caminho = sys.argv[1]
t = open(caminho, encoding='utf-8').read()


def trocar(velho, novo):
    global t
    n = t.count(velho)
    assert n == 1, f'esperava 1 ocorrência, achei {n}: {velho[:80]!r}'
    t = t.replace(velho, novo)


def apagar_entre(inicio, fim):
    """Apaga de `inicio` (incluso) até `fim` (excluso); os dois marcadores devem ser únicos."""
    global t
    assert t.count(inicio) == 1 and t.count(fim) == 1, (inicio, fim)
    a, b = t.index(inicio), t.index(fim)
    assert a < b
    t = t[:a] + t[b:]


# ---------- 1. Quarentena da raspagem do Gran ----------
trocar("const D = JSON.parse(await lerDados());\n", """const D = JSON.parse(await lerDados());
// Quarentena: a raspagem do Gran (ids gran-*) veio com o gabarito preenchido por padrão — A em 693 dos 698 itens de
// múltipla escolha e CERTO em 547 dos 563 itens C/E —, e a conferência por amostra achou gabaritos errados. Os itens
// seguem no pacote, mas ficam fora do banco (treino, simulados e estatísticas) até voltarem com o gabarito oficial.
const QUARENTENA = [/^gran-/];
function emQuarentena(q) { return QUARENTENA.some((r) => r.test(q.id)); }
const N_QUARENTENA = D.questoes.filter(emQuarentena).length;
D.questoes = D.questoes.filter((q) => !emQuarentena(q));
""")
trocar("      if (!q || !q.id || !q.b || !q.e || !q.g) continue;\n",
       "      if (!q || !q.id || !q.b || !q.e || !q.g) continue;\n      if (emQuarentena(q)) continue;\n")
trocar("""    '<div class="cartao"><div class="campo"><span class="rot">Tema</span>""",
       """    (N_QUARENTENA ? '<div class="cartao"><h2>Itens em quarentena</h2><p class="pequeno">' + fmtNum(N_QUARENTENA) + ' questões da raspagem do Gran estão fora do banco: vieram com o gabarito preenchido por padrão (A ou CERTO), e a conferência achou gabaritos errados. Voltam quando forem reimportadas com o gabarito oficial; o que você já respondeu nelas fica guardado.</p></div>' : '') +
    '<div class="cartao"><div class="campo"><span class="rot">Tema</span>""")

# ---------- 2. Cofre do IndexedDB: grava ao sair da aba e recupera quando o navegador perdeu o progresso ----------
trocar("""    const l = lerLS(CHAVE_LOCAL);
    if (!l) {
      if (typeof aplicarBackupExportado === 'function') aplicarBackupExportado();
      return false;
    }""", """    const l = lerLS(CHAVE_LOCAL);
    if (!l) {
      if (typeof aplicarBackupExportado === 'function') aplicarBackupExportado();
      // Navegador sem a cópia local (dados apagados, outro perfil): tenta o cofre; ele mesmo desiste se já houver progresso
      recuperarIDBSeVazio();
      return false;
    }""")
trocar("""function recuperarIDBSeVazio() {""", """// Ao esconder ou fechar a aba: o ponto de restauração do dia (substitui o de hoje, guarda 5 dias) e o espelho no
// IndexedDB, que sobrevive a uma limpeza do localStorage. Progresso vazio nunca sobrescreve o cofre.
function protegerProgresso() {
  try {
    if (!Store.localLido) return;
    const pacote = { perfil: S.perfil, itens: S.itens, cards: S.cards, simulados: S.simulados, pesquisa: S.pesquisa, disc: S.disc, t: Store.tLocal };
    if (!Object.keys(pacote.itens || {}).length && !(pacote.perfil && pacote.perfil.xp)) return;
    salvarSnapshotDiario(pacote);
    espelharIDB(pacote);
  } catch (e) {}
}
function recuperarIDBSeVazio() {""")
trocar("""    const ok = gravarLS(CHAVE_LOCAL, { perfil: S.perfil, itens: S.itens, cards: S.cards, simulados: S.simulados, pesquisa: S.pesquisa, disc: S.disc, t: this.tLocal });
    this.diag.navegador = ok ? 'ok' : 'bloqueado';""", """    const ok = gravarLS(CHAVE_LOCAL, { perfil: S.perfil, itens: S.itens, cards: S.cards, simulados: S.simulados, pesquisa: S.pesquisa, disc: S.disc, t: this.tLocal });
    this.diag.navegador = ok ? 'ok' : 'bloqueado';
    // O cofre também é gravado durante o uso (no máximo a cada 5 min): ao fechar a aba, a gravação no IndexedDB pode não terminar
    if (ok && Date.now() - (this.tCofre || 0) > 300000) { this.tCofre = Date.now(); protegerProgresso(); }""")
trocar("document.addEventListener('visibilitychange', () => { if (document.hidden) { contarTempo(true); guardarSessaoAberta(); Store.descarregar(); }",
       "document.addEventListener('visibilitychange', () => { if (document.hidden) { contarTempo(true); guardarSessaoAberta(); Store.descarregar(); protegerProgresso(); }")
trocar("window.addEventListener('pagehide', () => { contarTempo(true); guardarSessaoAberta(); Store.descarregar(); });",
       "window.addEventListener('pagehide', () => { contarTempo(true); guardarSessaoAberta(); Store.descarregar(); protegerProgresso(); });")

# ---------- 3. Textos herdados do Painel ANPD ----------
trocar("desc: 'Abriu todos os artigos da LGPD no leitor.' }", "desc: 'Abriu todos os artigos da Lei Orgânica do TCU no leitor.' }")
trocar("desc: '60% de domínio nos blocos de prioridade 1 da LGPD.' }", "desc: '60% de domínio nos blocos de prioridade 1 do edital.' }")
trocar("Cada item traz o texto da LGPD que lhe dá nome.", "Cada item traz o texto da norma que lhe dá nome.")
trocar("// devolvem um. Os itens do saque são os princípios e conceitos da LGPD, com o texto da lei como descrição.",
       "// devolvem um. Os itens do saque são institutos do controle externo e da auditoria, com o texto da norma como descrição.")
trocar("// Raio-x dos itens reais: artigos da LGPD e armadilhas mais frequentes,",
       "// Raio-x dos itens reais: artigos e armadilhas mais frequentes,")

# ---------- 4. Código morto (nenhuma chamada no painel) ----------
trocar("function causaDe(k) { return CAUSAS_ERRO.find((c) => c[0] === k); }\n", "")
apagar_entre("function htmlEsqueletos() {", "// Sincronização inversa: traz do Painel TCU")
apagar_entre("// Sincronização inversa: traz do Painel TCU", "/* ================= Backup ================= */")
for nome in ('causaDe', 'htmlEsqueletos', 'sincronizarDoTCU'):
    assert not re.search(r'\b' + nome + r'\b', t), nome

open(caminho, 'w', encoding='utf-8').write(t)
print('ok')
