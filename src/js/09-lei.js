/* ================= Lei seca ================= */
// Ler rende XP (antes só responder rendia): o artigo do dia vale pouco menos que um acerto; o de um item errado, o dobro
const XP_LER = 6, XP_LER_ERRO = 12;
function marcarLido(art) {
  if (!S.perfil.lidos) S.perfil.lidos = {};
  const d = diaLog();
  if (!Array.isArray(d.a) || !Object.isExtensible(d.a)) d.a = Array.from(d.a || []);
  if (!d.a.includes(art)) { d.a.push(art); ganharXP(artigosDeErros().has(art) ? XP_LER_ERRO : XP_LER); }
  if (!S.perfil.lidos[art]) S.perfil.lidos[art] = hojeISO();
  verificarConquistas();
  verificarRPG();
  Store.salvar('perfil');
}
// Item real do Cebraspe sobre o artigo pesa mais que questão autoral: mostra o que a banca de fato cobra
function importancia(id) {
  const qa = POR_ART.get(id) || [], qs = qa.length, reais = qa.filter((q) => q.o).length;
  const cs = (CARDS_POR_ART.get(id) || []).length;
  const b = BLOCO_DO_ART.get(id);
  const bonus = b ? (b.prioridade === 1 ? 4 : b.prioridade === 2 ? 2 : 0) : 0;
  return qs * 2 + reais * 3 + cs + bonus;
}
function estrelas(id) { const s = importancia(id); return s >= 16 ? 3 : s >= 8 ? 2 : s >= 3 ? 1 : 0; }
// Os grifos também reconhecem o inglês do GDPR (EUR, %, prazos em horas e anos, shall/may, unless, only...)
const RE_NUM = /(?:R\$\s?)?\d[\d.,]*%?\s\([^)]+\)(?:\s(?:dias|meses|anos|horas))?|\d{1,2}º? de [a-zç]+ de \d{4}|\d{1,3}(?: \d{3})+ EUR|\d+ %|\b\d+ (?:hours|days|weeks|months|years)\b|\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}/g;
const RE_ALERTA = /(?<![\p{L}])(?:somente|exclusivamente|exclusiva|exclusivos|vedad[oa]s?|salvo|exceto|ressalvad[oa]s?|desde que|em nenhuma hipótese|em nenhum caso|em circunstância alguma|independentemente|não se aplica|sem prejuízo|só não|apenas|sempre que possível|a qualquer momento|imediatamente|nul[oa]s?|gratuita|sem custos|only|solely|exclusively|unless|except|prohibited|shall not|not apply|without prejudice|in any case|regardless|irrespective|free of charge|without undue delay)(?![\p{L}])/giu;
const RE_VERBO = /(?<![\p{L}])(?:deverá|deverão|deve|devem|poderá|poderão|pode|podem|compete|competem|cabe|obriga-se|é obrigado|shall|may|must)(?![\p{L}])/giu;
function rangesRegex(linha, re, cls) {
  const out = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(linha))) { if (!m[0]) { re.lastIndex++; continue; } out.push([m.index, m.index + m[0].length, cls]); }
  return out;
}
function rangesTexto(linha, trechos, cls) {
  const out = [];
  for (const t of trechos) {
    if (!t) continue;
    let i = linha.indexOf(t);
    while (i >= 0) { out.push([i, i + t.length, cls]); i = linha.indexOf(t, i + t.length); }
  }
  return out;
}
// Remissão dentro do texto ("exceto nas hipóteses previstas no art. 16 desta Lei"): o artigo citado abre logo abaixo da
// linha, na própria tela. Só vale para a mesma norma: depois do número, "da Lei nº…", "do Decreto…" ou "do ADCT" é outra
// norma, e "desta Lei" ou nada é a própria; antes do número, "Medida Provisória nº 2.228-1, de 2001, os arts. 1º…"
// (cláusula de revogação) também é outra. Linha recuada ou entre aspas é texto de outra norma alterada por esta.
const RE_REMISSAO = /(?<![\p{L}])arts?\.\s(\d+)(?:\s?[º°o])?(-[A-Z])?((?:(?:,\s|\se\s|\sa\s)\d+(?:\s?[º°o])?(?:-[A-Z])?)*)/gu;
const OUTRA_NORMA_DEPOIS = /^[^.;:]{0,80}?(?:\s(?:d[aoe]s?|n[ao]s?)\s(?:Lei|Decreto|Constituição|Código|Medida Provisória|Emenda|Resolução|Convenção|Regimento|Ato das Disposições|ADCT|Consolidação|Estatuto)(?![\p{L}])|\s-\s?ADCT)/u;
const MESMA_NORMA = /^[^.;:]{0,80}?\s(?:desta|deste)\s(?:Lei|Decreto|Resolução|Regulamento|Constituição|Código|Estatuto|Portaria|Regimento)/u;
const OUTRA_NORMA_ANTES = /(?:Lei|Decreto|Decreto-Lei|Medida Provisória|Lei Complementar|Resolução)(?: Complementar)? nº [\d.\-]+(?:, de [^,;]{1,30})?,?\s(?:e\s)?(?:os|o|as|a|nos|no|dos|do)?\s?$/u;
function remissoesDaLinha(linha, a) {
  if (/^[\s“"]/.test(linha)) return [];
  const semAbrev = (t) => t.replace(/(?<![\p{L}])(arts?|inc|al|n)\./gu, '$1');
  const out = [];
  RE_REMISSAO.lastIndex = 0;
  let m;
  while ((m = RE_REMISSAO.exec(linha))) {
    const depois = semAbrev(linha.slice(m.index + m[0].length, m.index + m[0].length + 120));
    if (!MESMA_NORMA.test(depois) && OUTRA_NORMA_DEPOIS.test(depois)) continue;
    if (OUTRA_NORMA_ANTES.test(linha.slice(Math.max(0, m.index - 90), m.index))) continue;
    // cada número da lista ("arts. 7º e 11") vira o seu botão
    const ini = m.index + m[0].indexOf(m[1]), lista = linha.slice(ini, m.index + m[0].length), re = /(\d+)(?:\s?[º°o])?(-[A-Z])?/g;
    let n;
    while ((n = re.exec(lista))) {
      const k = chave(a.lei, n[1] + (n[2] || ''));
      // o primeiro número leva junto o "art.", para o toque ter onde pegar
      if (k !== a.k && ARTI.has(k)) out.push([n.index ? ini + n.index : m.index, ini + n.index + n[0].length, 'ref-lei', k]);
    }
  }
  return out;
}
// Texto vigente do artigo: sem as linhas revogadas e vetadas
function textoVigente(a) { return a.texto.split('\n').filter((l) => !linhaRevogada(l) && !/\(VETADO\)/.test(l)).join('\n'); }
// Termos técnicos do artigo (de ofício, ônus da prova, ad referendum…), na ordem em que aparecem, recolhidos a um toque
function caixaJuridiques(a) {
  const texto = textoVigente(a);
  const achados = JURIDIQUES.map((g) => ({ g, i: texto.search(g.re) })).filter((x) => x.i >= 0).sort((x, y) => x.i - y.i).slice(0, 8);
  if (!achados.length) return '';
  return '<details class="juridiques"><summary>Termos técnicos deste artigo (' + achados.length + ')</summary><dl>' +
    achados.map(({ g }) => '<dt>' + esc(g.t) + '</dt><dd>' + esc(g.d) + '</dd>').join('') + '</dl></details>';
}
// O artigo em português claro, antes do texto da lei: o que ele manda, para quem, quando e com que exceção. Os das
// trilhas vêm escritos e conferidos (dados/claro.json); nos outros, o Claude traduz na hora, a pedido, com o aviso de
// conferir no texto. A tradução gerada fica guardada só nesta abertura. Na caixa de remissão, só a escrita.
const CLARO = D.claro || {};
// Explicações geradas ficam no navegador: o mesmo artigo não volta a gastar o uso da conta. Guarda o tamanho do texto
// explicado para descartar a explicação se o artigo mudar numa versão nova do painel.
const CLARO_IA = new Map(Object.entries(lerLS('painel-anpd-claro-ia') || {}));
function claroIA(a) { const v = CLARO_IA.get(a.k); return v && v[0] === textoVigente(a).length ? v[1] : null; }
function htmlClaro(a, enxuto) {
  if (!artigoVivo(a.k)) return '';
  if (CLARO[a.k]) return '<div class="claro"><span class="rotulo">Em português claro</span><p>' + grifarProsa(CLARO[a.k]) + '</p></div>';
  if (enxuto) return '';
  const ia = claroIA(a);
  if (ia) return '<div class="claro ia"><span class="rotulo">Em português claro · gerado pelo Claude, confira no texto</span><p>' + esc(ia) + '</p></div>';
  return iaPronta() ? '<div class="claro vazio"><button class="btn pequeno" data-acao="claro-ia" data-art="' + esc(a.k) + '">Explicar este artigo em português claro (Claude)</button></div>' : '';
}
function pedidoClaro(a) {
  return 'Explique em português claro, para quem estuda para concurso e nunca leu lei, o que diz o dispositivo abaixo. Regras: ' +
    '1) diga o que ele manda, proíbe ou permite, para quem, quando e com que exceções, seguindo a ordem do texto; ' +
    '2) não acrescente nada que o texto não diga, não cite jurisprudência nem doutrina e, se algo depender de outro artigo, diga só que depende; ' +
    '3) explique cada termo técnico com palavras do dia a dia na própria frase; ' +
    '4) texto corrido, de 3 a 6 frases, sem markdown, títulos ou listas.\n\n' + LEIS[a.lei].curto + ', ' + rotuloArt(a.k) + ':\n' + textoVigente(a);
}
async function traduzirIA(alvo) {
  const k = alvo.dataset.art, a = ARTI.get(k), caixa = alvo.closest('.claro');
  if (!a || !caixa || !iaPronta()) return;
  caixa.classList.remove('vazio');
  caixa.innerHTML = '<span class="rotulo">Em português claro · o Claude está escrevendo…</span><p></p>';
  const p = caixa.querySelector('p');
  try {
    const r = await IA(pedidoClaro(a), { onText: ({ text }) => { p.textContent = text; } });
    const texto = r.text.trim() + (r.truncated ? ' […]' : '');
    CLARO_IA.set(k, [textoVigente(a).length, texto]);
    if (!r.truncated) { const salvo = lerLS('painel-anpd-claro-ia') || {}; salvo[k] = CLARO_IA.get(k); gravarLS('painel-anpd-claro-ia', salvo); }
    caixa.classList.add('ia');
    caixa.innerHTML = '<span class="rotulo">Em português claro · gerado pelo Claude, confira no texto</span><p>' + esc(texto) + '</p>';
  } catch (e) {
    caixa.classList.add('vazio');
    caixa.innerHTML = '<button class="btn pequeno" data-acao="claro-ia" data-art="' + esc(k) + '">Explicar este artigo em português claro (Claude)</button>';
    if (!e || e.code !== 'cancelled') avisar('!', 'Claude indisponível', erroIA(e));
  }
}
function textoLei(a, qExtras) {
  const cam = UI.camadas;
  const erros = [], cai = [], extras = [];
  for (const q of POR_ART.get(a.k) || []) { const r = rec(q.id); if (r && r[3] > 0) erros.push(...q.t); cai.push(...q.t); }
  for (const c of CARDS_POR_ART.get(a.k) || []) cai.push(c.nota.t.replace(RE_LACUNA, '$2'));
  for (const id of qExtras || []) { const q = QI.get(id); if (q) extras.push(...q.t); }
  return a.texto.split('\n').map((linha, k) => {
    // Vetos e revogações não têm valor de estudo: a linha aparece apagada e sem grifo, e a revogada sem o texto antigo
    const rev = linhaRevogada(linha);
    if (rev) return '<p class="par vetado">' + (rev.rotulo ? esc(rev.rotulo) + ' ' : '') + '<span class="nota">' + esc(rev.nota) + '</span></p>';
    if (/^(?:Art\. [\dA-Zº-]+\.?|§ \d+º|Parágrafo único\.?|[IVXL]+(?:-[A-Z])? -|[a-z]\))\s*\(VETADO\)/.test(linha)) return '<p class="par vetado">' + esc(linha) + '</p>';
    let rs = [];
    if (cam.cai) rs = rs.concat(rangesTexto(linha, cai, 'g-cai'));
    rs = rs.concat(rangesTexto(linha, extras, 'g-cai'));
    if (cam.erro) rs = rs.concat(rangesTexto(linha, erros, 'g-erro'));
    if (cam.num) rs = rs.concat(rangesRegex(linha, RE_NUM, 'g-num'));
    if (cam.alerta) rs = rs.concat(rangesRegex(linha, RE_ALERTA, 'g-alerta'));
    if (cam.verbo) rs = rs.concat(rangesRegex(linha, RE_VERBO, 'g-verbo'));
    const remissoes = remissoesDaLinha(linha, a);
    rs = rs.concat(remissoes);
    const cortes = new Set([0, linha.length]);
    rs.forEach(([i, f]) => { cortes.add(i); cortes.add(f); });
    const pts = [...cortes].sort((x, y) => x - y);
    let html = '', caixa = null;
    for (let j = 0; j < pts.length - 1; j++) {
      const i = pts[j], f = pts[j + 1];
      const classes = new Set(rs.filter((r) => r[0] <= i && r[1] >= f).map((r) => r[2]));
      if (classes.has('g-erro')) classes.delete('g-cai');
      const seg = fmtNotas(esc(linha.slice(i, f)));
      const rem = classes.delete('ref-lei') && remissoes.find((r) => r[0] <= i && r[1] >= f);
      if (rem) {
        caixa ||= 'art-' + (++nCaixaArt);
        html += '<button class="ref-art' + (classes.size ? ' ' + [...classes].join(' ') : '') + '" data-acao="art-inline" data-art="' + esc(rem[3]) + '" data-box="' + caixa + '" aria-controls="' + caixa + '" aria-expanded="false" aria-label="Ler ' + esc(nomeArt(rem[3])) + ' aqui">' + seg + '</button>';
      } else html += classes.size ? '<span class="' + [...classes].join(' ') + '">' + seg + '</span>' : seg;
    }
    let cls = 'par';
    if (k === 0) cls = 'caput';
    else if (/^[IVXL]+(-[A-Z])?\s-/.test(linha)) cls = 'inc';
    else if (/^[a-z]\)/.test(linha) || /^\((?:[a-z]{1,2}|[ivx]+)\) /.test(linha)) cls = 'ali';
    else if (/^\(\d+\) /.test(linha)) cls = 'inc';
    return '<p class="' + cls + '">' + html + '</p>' + (caixa ? '<div class="art-inline remissao" id="' + caixa + '" hidden></div>' : '');
  }).join('');
}
// Grifos das aulas da trilha: as mesmas camadas da lei seca (prazos e números, alerta, deve × pode), com números por
// extenso, que é como a aula escreve ("um terço", "três quintos", "dois turnos"), referências a dispositivos em destaque
// discreto e negrito no termo que está sendo definido ("Poder de polícia é…", "Plena:"). **termo** acrescenta negrito
// onde a regra não alcança.
const RE_NUM_PROSA = /(?<![\p{L}\d])(?:\d+(?:[.,]\d+)?%|\d+\s(?:dias(?: úteis| corridos)?|meses|anos|horas|turnos|vezes|membros)|(?:um|uma|dois|duas|três|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte|trinta|quarenta|cinquenta|sessenta|noventa|cem|cento e vinte|mil)\s(?:dias(?: úteis| corridos)?|meses|anos|horas|turnos|terços?|quintos?|quartos?|vezes|membros|instâncias)|três quintos|dois terços|um terço|mais da metade|metade|maioria (?:absoluta|relativa|simples|qualificada)|unanimidade)(?![\p{L}])/giu;
const RE_REF_PROSA = /(?<![\p{L}])(?:arts?\.\s\d+[º°]?(?:-[A-Z])?(?:,\s(?:[IVXL]+|§\s\d+[º°]?|caput|parágrafo único))*|§§?\s\d+[º°]?|(?:ADI|ADPF|RE|ARE|MS|HC)\s[\d.]+)/gu;
const RE_DEF_PROSA = /(?:^|(?<=[.;]\s))([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}\-]*(?:\s[\p{L}\-]+){0,4}?)(?=:\s|\s(?:é|são)\s(?:o|a|os|as|um|uma|aquel[ea]s?|quando|instrumento|atividade|ato|poder|princípio|dever|direito|garantia|norma|conjunto|pessoa|órgão|entidade)(?![\p{L}]))/gu;
const NAO_NEGRITO = /^(?:(?:Ela|Ele|Elas|Eles|Isso|Isto|Há|Também|Mas|Já|Aqui|Ambos|Ambas|Cada|Toda|Todo|Na|No|Nas|Nos|Em|A|O|As|Os|É|Esse|Essa|Este|Esta)$|(?:O que|Que|Quem|Como|Quando|Onde)(?![\p{L}]))/u;
// refs (opcional): { mapa: Map(número do artigo → chave), lei, box } — a citação "art. 3º" vira botão que abre o artigo na
// caixa da parte da aula. Só vira botão o que se resolve sem dúvida: um artigo do subtema, ou da norma única do subtema
// quando a frase não cita outra norma logo antes.
const OUTRA_NORMA = /(?:Lei|Decreto|Resolução|Res\.|CF|Constituição|GDPR|LINDB|Código|Regimento|Portaria|IN |Convenção|ECA|Súmula)[^.;]{0,30}$/;
function refDeArtigo(refs, txt, antes) {
  const m = /arts?\.\s(\d+(?:-[A-Z])?)/.exec(txt);
  if (!refs || !m) return null;
  if (refs.mapa.has(m[1])) return refs.mapa.get(m[1]);
  if (!refs.lei || OUTRA_NORMA.test(antes)) return null;
  const k = chave(refs.lei, m[1]);
  return ARTI.has(k) && artigoVivo(k) ? k : null;
}
function grifarProsa(texto, refs) {
  const cam = UI.camadas;
  // **termo** vira negrito explícito; as posições são contadas no texto já sem os asteriscos
  const fortes = [];
  let limpo = '';
  String(texto).split(/(\*\*[^*]+\*\*)/).forEach((pedaco) => {
    const m = /^\*\*([^*]+)\*\*$/.exec(pedaco);
    if (m) { fortes.push([limpo.length, limpo.length + m[1].length, 'neg']); limpo += m[1]; } else limpo += pedaco;
  });
  let rs = fortes.slice();
  RE_DEF_PROSA.lastIndex = 0;
  let m;
  while ((m = RE_DEF_PROSA.exec(limpo))) {
    if (NAO_NEGRITO.test(m[1]) || m[1].length <= 2) continue;
    // O artigo fica fora do negrito: "A ANPD é…" grifa ANPD
    const art = /^(?:As?|Os?)\s/.exec(m[1]), ini = m.index + (art ? art[0].length : 0);
    rs.push([ini, m.index + m[1].length, 'neg']);
  }
  if (cam.num) rs = rs.concat(rangesRegex(limpo, RE_NUM_PROSA, 'g-num'));
  if (cam.alerta) rs = rs.concat(rangesRegex(limpo, RE_ALERTA, 'g-alerta'));
  if (cam.verbo) rs = rs.concat(rangesRegex(limpo, RE_VERBO, 'g-verbo'));
  const citacoes = rangesRegex(limpo, RE_REF_PROSA, 'ref-dispo');
  rs = rs.concat(citacoes);
  const alvo = new Map(refs ? citacoes.map((r) => [r, refDeArtigo(refs, limpo.slice(r[0], r[1]), limpo.slice(Math.max(0, r[0] - 40), r[0]))]) : []);
  const cortes = new Set([0, limpo.length]);
  rs.forEach(([i, f]) => { cortes.add(i); cortes.add(f); });
  const pts = [...cortes].sort((x, y) => x - y);
  let html = '';
  for (let j = 0; j < pts.length - 1; j++) {
    const i = pts[j], f = pts[j + 1];
    const classes = [...new Set(rs.filter((r) => r[0] <= i && r[1] >= f).map((r) => r[2]))];
    const seg = esc(limpo.slice(i, f));
    const cit = refs && classes.includes('ref-dispo') ? citacoes.find((r) => r[0] <= i && r[1] >= f) : null, k = cit && alvo.get(cit);
    if (k) html += '<button class="' + classes.join(' ') + ' ref-art" data-acao="art-inline" data-art="' + esc(k) + '" data-box="' + refs.box + '" aria-controls="' + refs.box + '" aria-expanded="false">' + seg + '</button>';
    else html += classes.length ? '<span class="' + classes.join(' ') + '">' + seg + '</span>' : seg;
  }
  return html;
}
function fmtNotas(s) { return s.replace(/\((Redação dada|Incluído|Incluída|Revogado|Promulgação)[^)]*\)/g, (m) => '<span class="nota">' + m + '</span>'); }
// Na aula só valem as camadas que dependem do texto (números, alerta, deve × pode); "o que cai" e "meus erros" são da lei
function legendaCamadas(soTexto) {
  const cam = UI.camadas;
  const item = (k, t, estilo) => '<button class="camada" data-acao="camada" data-c="' + k + '" aria-pressed="' + !!cam[k] + '"><i style="' + estilo + '"></i>' + t + '</button>';
  return '<div class="camadas" aria-label="Grifos">' +
    (soTexto ? '' : item('cai', 'O que cai', 'background:var(--mark)')) + item('num', 'Prazos e números', 'background:var(--accent)') +
    item('alerta', 'Palavras de alerta', 'background:var(--errado)') + item('verbo', 'Deve × pode', 'border:1.5px dotted var(--ink)') +
    (soTexto ? '' : item('erro', 'Meus erros', 'background:var(--errado-bg);box-shadow:inset 0 -2px 0 var(--errado)')) +
    item('teste', 'Testar: esconder prazos e deve × pode', 'background:var(--surface-2);border:1px solid var(--line)') + '</div>';
}
function seletorLei() {
  return '<label class="rotulo" for="sel-lei">Norma</label><select id="sel-lei" class="sel-lei" data-acao="sel-lei">' +
    GRUPOS.map((g) => '<optgroup label="' + esc(g.nome) + '">' + g.ids.map((id) => '<option value="' + esc(id) + '"' + (id === UI.lei ? ' selected' : '') + '>' + esc(LEIS[id].nome) + '</option>').join('') + '</optgroup>').join('') + '</select>';
}
function primeiraLinha(a) { const ls = a.texto.split('\n'); return (/^Article \d+$/.test(ls[0]) && ls[1] ? ls[1] : ls[0]).replace(/^(Art\.|CLÁUSULA|APÊNDICE|ENUNCIADO)\s*[\dIVXL\-A-Zº°o.]+\s*/, '').replace(/^[IVXL]+ - /, ''); }

function diagnosticoArtigo(k) {
  const qs = POR_ART.get(k) || [];
  let c = 0, e = 0, nResp = 0, pendentes = 0, erradasIds = [];
  for (const q of qs) {
    const r = rec(q.id);
    if (r && (r[2] + r[3] > 0)) {
      nResp++;
      c += r[2];
      e += r[3];
      if (r[0] === 0 || r[3] > r[2]) {
        pendentes++;
        erradasIds.push(q.id);
      }
    }
  }
  const tot = qs.length;
  const taxa = (c + e > 0) ? Math.round((c / (c + e)) * 100) : null;
  const est = estrelas(k);
  let nivel = 'neutro';
  if (c + e > 0) {
    if (pendentes > 0 || (nResp >= 2 && taxa < 65) || (c === 0 && e > 0)) {
      nivel = 'vermelho';
    } else if (taxa >= 80 && nResp >= 3 && pendentes === 0) {
      nivel = 'verde';
    } else {
      nivel = 'amarelo';
    }
  } else if (est >= 2 && tot >= 5) {
    nivel = 'amarelo';
  }
  return { k, tot, nResp, c, e, taxa, pendentes, erradasIds, nivel, est };
}

// Itens que "Neutralizar vulnerabilidades" abre (até VULN_MAX): os errados dos artigos em vermelho (os itens todos do
// artigo, se nenhum foi errado); sem artigo em vermelho, os itens dos amarelos. O botão conta pela mesma regra.
const VULN_MAX = 30;
function idsVulneraveis(diag) {
  const de = (d, soErradas) => (soErradas && d.erradasIds && d.erradasIds.length ? d.erradasIds : (POR_ART.get(d.k) || []).map((q) => q.id));
  const verm = [...new Set(diag.filter((d) => d.nivel === 'vermelho').flatMap((d) => de(d, true)))];
  return verm.length ? verm : [...new Set(diag.filter((d) => d.nivel === 'amarelo').flatMap((d) => de(d, false)))];
}
function renderLei() {
  const el = document.getElementById('vista-lei');
  if (!Object.keys(LEIS).length) { el.innerHTML = '<p class="vazio-msg">Nenhum texto legal anexado ainda.</p>'; return; }
  if (!LEIS[UI.lei]) UI.lei = LEIS.lgpd ? 'lgpd' : Object.keys(LEIS)[0];
  el.classList.toggle('com-artigo', !!(UI.artSel && ARTI.get(UI.artSel)));
  if (UI.artSel && ARTI.get(UI.artSel)) { el.innerHTML = renderArtigo(UI.artSel); return; }
  UI.artSel = null;
  const L = LEIS[UI.lei];
  const arts = L.artigos;
  const lidos = arts.filter((a) => S.perfil.lidos && S.perfil.lidos[a.k]).length;
  let html = '<div class="secao"><div class="sel-lei-caixa">' + seletorLei() + '</div>' +
    '<div class="secao-cab"><h2>' + esc(L.nome) + '</h2><a class="pequeno" href="' + esc(L.url) + '" target="_blank" rel="noopener">Fonte oficial ↗</a></div>' +
    (L.aviso ? '<p class="aviso-conferir">' + esc(L.aviso) + '</p>' : '') +
    '<p class="pequeno mudo">' + pl(arts.length, 'unidade', 'unidades') + ' · ' + lidos + ' lida' + (lidos === 1 ? '' : 's') + ' · ' + pl((arts.reduce((n, a) => n + (POR_ART.get(a.k) || []).length, 0)), 'questão ligada', 'questões ligadas') + '</p>' +
    '<input class="busca" id="busca-lei" type="search" placeholder="Buscar em todas as normas (ex.: quinze dias, encarregado, Senado)" value="' + esc(UI.busca) + '" aria-label="Buscar em todas as normas">' +
    '<div class="chips"><button class="chip" data-acao="ranking" aria-pressed="' + (UI.ranking && !UI.termometro) + '">Mais importantes primeiro</button><button class="chip" data-acao="ler-tudo">Ler do início</button><button class="chip" data-acao="toggle-termometro" aria-pressed="' + !!UI.termometro + '">Termômetro de Vulnerabilidades</button></div>' +
    '<p class="pequeno mudo">Estrelas: quanto o artigo pesa no banco. Pontos: acertos e erros. Borda termossensível: Crítico, Atenção, Dominado.</p></div>';
  // Um diagnóstico por artigo, reaproveitado no termômetro, no ranking de vulnerabilidades e na grade de artigos
  const diag = new Map(arts.map((a) => [a.k, diagnosticoArtigo(a.k)]));
  const diagArts = [...diag.values()];
  const vermArts = diagArts.filter((d) => d.nivel === 'vermelho');
  const amarArts = diagArts.filter((d) => d.nivel === 'amarelo');
  const verdArts = diagArts.filter((d) => d.nivel === 'verde');
  const neutArts = diagArts.filter((d) => d.nivel === 'neutro');
  const totQuestoesVerm = Math.min(VULN_MAX, idsVulneraveis(diagArts).length);

  html += '<div class="cartao destaque termometro-card">' +
    '<div class="secao-cab"><h2>Termômetro de Vulnerabilidade · ' + esc(L.curto || L.nome) + '</h2>' +
    '<span class="selo mono">' + vermArts.length + ' Críticos · ' + amarArts.length + ' Atenção · ' + verdArts.length + ' Dominados</span></div>' +
    '<p class="pequeno">Diagnóstico do seu desempenho cruzando as questões com os artigos da norma. Identifica onde a banca Cebraspe pode te derrubar.</p>' +
    '<div class="termo-barra-container"><div class="termo-barra">' +
      '<div class="termo-seg verm" style="width:' + pct(vermArts.length, arts.length) + '%" title="' + vermArts.length + ' Artigos Críticos"></div>' +
      '<div class="termo-seg amar" style="width:' + pct(amarArts.length, arts.length) + '%" title="' + amarArts.length + ' Artigos em Atenção"></div>' +
      '<div class="termo-seg verd" style="width:' + pct(verdArts.length, arts.length) + '%" title="' + verdArts.length + ' Artigos Dominados"></div>' +
      '<div class="termo-seg neut" style="width:' + pct(neutArts.length, arts.length) + '%" title="' + neutArts.length + ' Não Testados"></div>' +
    '</div></div>' +
    '<div class="linha-btns" style="margin-top:10px">' +
      (vermArts.length ? '<button class="btn primario" data-acao="neutralizar-vulnerabilidades">' + esc(rotuloPausa('vuln:' + (UI.lei || 'lgpd'), 'Neutralizar Vulnerabilidades (' + pl(totQuestoesVerm, 'item crítico', 'itens críticos') + ')')) + '</button>' : amarArts.length ? '<button class="btn primario" data-acao="neutralizar-vulnerabilidades">Treinar Artigos em Atenção (' + amarArts.length + ')</button>' : '') +
      '<button class="chip" data-acao="toggle-termometro" aria-pressed="' + !!UI.termometro + '">' + (UI.termometro ? 'Ver estrutura da lei' : 'Ver ranking de vulnerabilidades') + '</button>' +
    '</div></div>';
  if (UI.busca.trim().length >= 3) html += '<div class="resultado-busca">' + buscarLei(UI.busca) + '</div>';
  else if (UI.termometro) {
    const diagList = arts.map((a) => ({ a, d: diag.get(a.k) }))
                         .filter((x) => x.d.tot > 0)
                         .sort((x, y) => {
                           const ordem = { vermelho: 0, amarelo: 1, neutro: 2, verde: 3 };
                           if (ordem[x.d.nivel] !== ordem[y.d.nivel]) return ordem[x.d.nivel] - ordem[y.d.nivel];
                           if (x.d.pendentes !== y.d.pendentes) return y.d.pendentes - x.d.pendentes;
                           return y.d.est - x.d.est;
                         });
    html += '<div class="ranking-vuln">';
    if (!diagList.length) html += '<p class="vazio-msg">Nenhum artigo com questões ligadas nesta norma.</p>';
    else {
      for (const { a, d } of diagList) {
        const estStr = d.est ? '★'.repeat(d.est) : '';
        const nivelLabel = d.nivel === 'vermelho' ? 'Crítico' : d.nivel === 'amarelo' ? 'Atenção' : d.nivel === 'verde' ? 'Dominado' : 'Não testado';
        const taxaStr = d.taxa != null ? d.taxa + '% acerto (' + d.c + 'C / ' + d.e + 'E)' : d.tot + ' questões no banco';
        html += '<div class="ranking-vuln-item ' + (d.nivel === 'vermelho' ? 'verm' : d.nivel === 'amarelo' ? 'amar' : d.nivel === 'verde' ? 'verd' : '') + '">' +
          '<div style="flex:1;min-width:200px">' +
            '<div style="display:flex;align-items:center;gap:6px">' +
              '<b>' + esc(rotuloArt(a.k)) + '</b>' +
              (estStr ? '<span class="estrelas" style="color:var(--gold)">' + estStr + '</span>' : '') +
              '<span class="corte-badge ' + (d.nivel === 'vermelho' ? 'eliminado' : d.nivel === 'amarelo' ? 'alerta' : d.nivel === 'verde' ? 'aprovado' : '') + '">' + nivelLabel + '</span>' +
            '</div>' +
            '<div class="pequeno mudo" style="margin-top:2px">' + esc(primeiraLinha(a).slice(0, 85)) + '</div>' +
            '<div class="pequeno" style="margin-top:2px;font-weight:600">' + taxaStr + (d.pendentes ? ' · <span style="color:var(--errado)">' + pl(d.pendentes, 'pendência', 'pendências') + '</span>' : '') + '</div>' +
          '</div>' +
          '<div class="linha-btns" style="margin:0">' +
            '<button class="btn pequeno' + (d.nivel === 'vermelho' ? ' primario' : '') + '" data-acao="treinar-art" data-art="' + esc(a.k) + '">Treinar (' + d.tot + ')</button>' +
            '<button class="btn pequeno" data-acao="abrir-art" data-art="' + esc(a.k) + '">Ler lei</button>' +
          '</div>' +
        '</div>';
      }
    }
    html += '</div>';
  } else if (UI.ranking) {
    const top = arts.map((a) => ({ a, s: importancia(a.k) })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s).slice(0, 30);
    html += top.length
      ? '<div class="ranking">' + top.map(({ a }) => '<button data-acao="abrir-art" data-art="' + esc(a.k) + '"><b>' + esc(rotuloArt(a.k)) + '</b><span class="t">' + esc(primeiraLinha(a).slice(0, 90)) + '</span><span class="estrelas">' + '★'.repeat(estrelas(a.k)) + '</span></button>').join('') + '</div>'
      : '<p class="vazio-msg">Ainda não há questões nem cards ligados a esta norma para montar o ranking.</p>';
  } else {
    let atual = null, aberto = false;
    for (const a of arts) {
      const cap = a.estrutura[0] || '';
      if (cap !== atual || !aberto) {
        if (aberto) html += '</div></div>';
        html += '<div class="capitulo">' + (cap ? '<h3>' + esc(cap.replace(/\s*\(Redação dada[^)]*\)/, '')) + '</h3>' : '') + '<div class="artigos">';
        aberto = true; atual = cap;
      }
      const qs = POR_ART.get(a.k) || [];
      const pontos = qs.slice(0, 6).map((q) => { const r = rec(q.id); return '<i class="' + (!r || r[0] < 0 ? 'nv' : r[0] >= 3 ? 'ok' : 'no') + '"></i>'; }).join('');
      const vetado = /\((VETADO|Revogad[oa])/.test(a.texto.split('\n')[0]);
      const est = estrelas(a.k);
      const dArt = diag.get(a.k);
      const termoCls = dArt.nivel === 'vermelho' ? ' termo-verm' : dArt.nivel === 'amarelo' ? ' termo-amar' : dArt.nivel === 'verde' ? ' termo-verd' : '';
      html += '<button class="art-btn' + (S.perfil.lidos && S.perfil.lidos[a.k] ? ' lido' : '') + termoCls + '" data-acao="abrir-art" data-art="' + esc(a.k) + '"' + (vetado ? ' style="opacity:.5"' : '') + ' aria-label="' + esc(rotuloArt(a.k)) + '" title="' + esc(rotuloArt(a.k)) + (dArt.taxa != null ? ' · ' + dArt.taxa + '% acerto' : '') + '">' + esc(a.id) + (est ? '<span class="estrelas">' + '★'.repeat(est) + '</span>' : '') + '<span class="pontos">' + pontos + '</span></button>';
    }
    if (aberto) html += '</div></div>';
  }
  el.innerHTML = html;
}
// Busca em todas as normas: a norma aberta vem primeiro; no máximo 60 resultados
// Sem resultado exato, tenta a família da palavra: "transferencia" acha "transferir" (prefixo de 60% da palavra)
// Na segunda tentativa, até três palavras entre as buscadas: quem digita “direitos titular” quer “direitos do titular”
const SEP_APROX = '[^a-z0-9º]+(?:[a-z0-9º]+[^a-z0-9º]+){0,3}?';
function buscarLei(termo, aprox) {
  const palavras = semAcento(termo.trim()).split(/[^a-z0-9º]+/).filter(Boolean);
  if (!palavras.length) return '';
  const raiz = (p) => (aprox && p.length > 5 ? p.slice(0, Math.max(4, Math.round(p.length * 0.6))) : p);
  const re = new RegExp(palavras.map((p) => raiz(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (aprox && p.length > 5 ? '[a-z]*' : '')).join(aprox ? SEP_APROX : '[^a-z0-9º]+'));
  const ordem = [UI.lei].concat(GRUPOS.flatMap((g) => g.ids).filter((id) => id !== UI.lei));
  const res = [];
  let total = 0;
  for (const id of ordem) {
    for (const a of artsDe(id)) {
      if (!a.sa) a.sa = semAcento(a.texto);
      const m = re.exec(a.sa);
      if (!m) continue;
      total++;
      if (res.length >= 60) continue;
      const ini = Math.max(0, m.index - 60);
      res.push('<button data-acao="abrir-art" data-art="' + esc(a.k) + '"><b>' + esc(id === UI.lei ? rotuloArt(a.k) : LEIS[id].curto + ' · ' + rotuloArt(a.k)) + '</b><span>' + esc((ini ? '…' : '') + a.texto.slice(ini, m.index + m[0].length + 90).replace(/\n/g, ' ') + '…') + '</span></button>');
    }
  }
  if (!res.length) return !aprox && (palavras.length > 1 || palavras.some((p) => p.length > 5)) ? buscarLei(termo, true) : '<p class="vazio-msg">Nada encontrado para “' + esc(termo) + '”.</p>';
  return (aprox ? '<p class="pequeno mudo">Nada exato para “' + esc(termo) + '”; mostrando trechos com até três palavras entre as buscadas e palavras da mesma família.</p>' : '') + (total > res.length ? '<p class="pequeno mudo">' + total + ' resultados; mostrando os 60 primeiros (norma aberta primeiro).</p>' : '') + res.join('');
}
// Gaveta do artigo na lei seca: os itens deste artigo que a pessoa já errou, os ainda não recuperados primeiro, com o
// gabarito e o comentário
function gavetaErrosArt(qs) {
  const errados = qs.filter((q) => { const r = rec(q.id); return r && r[3] > 0; })
    .sort((x, y) => (rec(x.id)[0] > 0) - (rec(y.id)[0] > 0) || rec(y.id)[3] - rec(x.id)[3]);
  if (!errados.length) return '';
  const pend = errados.filter((q) => !(rec(q.id)[0] > 0)).length;
  return '<details class="erros-art"><summary>Seus erros neste artigo (' + errados.length + (pend ? ', ' + pend + ' sem recuperar' : '') + ')</summary>' +
    errados.slice(0, 8).map((q) => {
      const r = rec(q.id);
      return '<div class="erro-art' + (r[0] > 0 ? ' virou' : '') + '"><p class="pequeno mudo">' + esc(q.id) + ' · ' + pl(r[3], 'erro', 'erros') + (r[0] > 0 ? ' · já recuperado' : '') + '</p><p>' + esc(q.e) + '</p>' +
        '<p class="pequeno"><b>Gabarito: ' + esc(nomeGab(q)) + '.</b> ' + marcarTermos(q.c, 3) + '</p>' + '</div>';
    }).join('') + (errados.length > 8 ? '<p class="pequeno mudo">Mais ' + (errados.length - 8) + ' em Questões › Só as que já errei.</p>' : '') + '</details>';
}
// Ouvir o artigo: a voz do aparelho lê o texto vigente, sem as notas de redação; cada trecho lido conta como uso, para
// o relógio da leitura não parar enquanto a pessoa escuta. Sai do artigo, a voz para.
let falando = null;
const PODE_FALAR = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
function textoParaFala(a) {
  return (a.rotulo + '. ' + textoVigente(a))
    .replace(/\((Redação dada|Incluíd[oa]|Acrescid[oa]|Renumerad[oa]|Vide|Vigência|Regulamento)[^)]*\)/gi, '')
    .replace(/§§/g, 'parágrafos').replace(/§/g, 'parágrafo').replace(/\bArt\./g, 'Artigo').replace(/\bnº/g, 'número').replace(/\s+/g, ' ').trim();
}
function pararFala() { if (falando && PODE_FALAR) speechSynthesis.cancel(); falando = null; }
function rotuloFala(k) { return falando === k ? 'Parar a leitura em voz' : 'Ouvir o artigo'; }
// A fala em curso fica guardada aqui: presa só a uma variável local, o Chrome e o Safari podem descartá-la no meio de
// um artigo longo, e o fim (que libera o botão) nunca chega
let falaAtual = null;
function ouvirArtigo(k) {
  const a = ARTI.get(k);
  if (!a || !PODE_FALAR) return;
  if (falando === k) { pararFala(); } else {
    speechSynthesis.cancel();
    const u = falaAtual = new SpeechSynthesisUtterance(textoParaFala(a));
    u.lang = 'pt-BR';
    const voz = speechSynthesis.getVoices().find((v) => /^pt[-_]BR/i.test(v.lang)) || speechSynthesis.getVoices().find((v) => /^pt/i.test(v.lang));
    if (voz) u.voice = voz;
    u.onboundary = marcarUso;
    u.onend = u.onerror = () => { if (falaAtual === u) falaAtual = null; if (falando === k) { falando = null; const b = document.querySelector('[data-acao="ouvir-art"]'); if (b) b.textContent = rotuloFala(k); } };
    falando = k;
    speechSynthesis.speak(u);
    marcarUso();
  }
  const b = document.querySelector('[data-acao="ouvir-art"]');
  if (b) b.textContent = rotuloFala(k);
}
// Leitura fria: o artigo já lido em outro dia abre sem grifos, sem português claro e sem o glossário, para a pessoa
// achar sozinha prazos, verbos e exceções, como vai ler na prova; um toque traz tudo de volta para conferir.
const FRIA_VISTA = new Set();
function leituraFria(k) { const d = (S.perfil.lidos || {})[k]; return !!d && d < hojeISO() && !FRIA_VISTA.has(k); }
function renderArtigo(k) {
  if (falando && falando !== k) pararFala();
  const a = ARTI.get(k);
  const L = LEIS[a.lei];
  const fila = UI.leiFila && UI.leiFila.includes(k) ? UI.leiFila : null;
  const seq = fila || artsDe(a.lei).map((x) => x.k);
  const idx = seq.indexOf(k);
  const ant = idx > 0 ? seq[idx - 1] : null, prox = idx < seq.length - 1 ? seq[idx + 1] : null;
  const qs = POR_ART.get(k) || [];
  const cs = CARDS_POR_ART.get(k) || [];
  let html = '<div class="secao-cab"><button class="btn pequeno" data-acao="voltar-lei">' + esc(L.curto) + ': todos os artigos</button><div class="linha-btns">' +
    '<button class="btn pequeno" data-acao="nav-art" data-art="' + esc(ant || '') + '"' + (ant ? '' : ' disabled') + ' aria-label="Artigo anterior">←</button>' +
    '<button class="btn pequeno" data-acao="nav-art" data-art="' + esc(prox || '') + '"' + (prox ? '' : ' disabled') + ' aria-label="Próximo artigo">→</button></div></div>';
  if (L.aviso) html += '<p class="aviso-conferir">' + esc(L.aviso) + '</p>';
  if (fila) html += '<div class="fila-leitura"><span>Leitura do dia: ' + (idx + 1) + ' de ' + fila.length + '</span>' + (prox ? '' : '<button class="btn pequeno" data-acao="fim-fila">Concluir leitura</button>') + '</div>';
  const est = estrelas(k);
  const dArt = diagnosticoArtigo(k);
  let avisoVuln = '';
  if (dArt.tot > 0) {
    if (dArt.nivel === 'vermelho') {
      avisoVuln = '<div class="aviso-vulnerabilidade verm"><div><b>Ponto Crítico Cebraspe:</b> ' + (dArt.taxa != null ? dArt.taxa + '% de acerto (' + dArt.c + 'C / ' + dArt.e + 'E)' : 'Sem acertos consolidados') + (dArt.pendentes ? ' · ' + pl(dArt.pendentes, 'questão', 'questões') + ' com erro pendente' : '') + '.</div>' +
        (qs.length ? '<button class="btn pequeno primario" data-acao="treinar-art" data-art="' + esc(k) + '">Treinar questões (' + qs.length + ')</button>' : '') + '</div>';
    } else if (dArt.nivel === 'amarelo') {
      avisoVuln = '<div class="aviso-vulnerabilidade amar"><div><b>Artigo em Atenção:</b> ' + (dArt.taxa != null ? dArt.taxa + '% de acerto (' + dArt.c + 'C / ' + dArt.e + 'E)' : 'Artigo relevante (' + '★'.repeat(dArt.est) + ') ainda não testado') + '.</div>' +
        (qs.length ? '<button class="btn pequeno" data-acao="treinar-art" data-art="' + esc(k) + '">Treinar questões (' + qs.length + ')</button>' : '') + '</div>';
    } else if (dArt.nivel === 'verde') {
      avisoVuln = '<div class="aviso-vulnerabilidade verd"><div><b>Artigo Dominado:</b> ' + dArt.taxa + '% de acerto consolidado nas questões resolvidas (' + dArt.c + 'C / ' + dArt.e + 'E).</div></div>';
    }
  }
  const fria = leituraFria(k);
  // Em tela larga, o texto da lei fica à esquerda e o português claro, os avisos e os erros, ao lado (art-lado)
  html += '<div class="cartao art-cartao' + (fria ? ' fria' : '') + '"><span class="rotulo">' + esc([L.curto].concat(a.estrutura).join(' · ')) + '</span><h2>' + esc(rotuloArt(k)) + (est ? ' <span class="estrelas" title="Importância no banco">' + '★'.repeat(est) + '</span>' : '') + '</h2><div class="art-lado">' +
    avisoVuln + gavetaErrosArt(qs) +
    (fria ? '<div class="fria-aviso"><span>Leitura fria: você já leu este artigo. Leia sem grifos e ache sozinho prazos, verbos e exceções.</span><button class="btn pequeno" data-acao="conferir-fria" data-art="' + esc(k) + '">Conferir com grifos</button></div>' : '') +
    htmlClaro(a) + '</div><div class="art-texto">' + legendaCamadas() + '<div class="texto-lei">' + textoLei(a) + '</div>' + caixaJuridiques(a) + '<div class="linha-btns">';
  if (qs.length) html += '<button class="btn primario" data-acao="treinar-art" data-art="' + esc(k) + '">Questões deste artigo (' + qs.length + ')</button>';
  if (cs.length) html += '<button class="btn" data-acao="cards-art" data-art="' + esc(k) + '">Cards deste artigo (' + cs.length + ')</button>';
  if (PODE_FALAR) html += '<button class="btn" data-acao="ouvir-art" data-art="' + esc(k) + '">' + rotuloFala(k) + '</button>';
  html += '</div>';
  if (!qs.length && !cs.length) html += '<p class="mudo pequeno">Nenhuma questão ou card do banco cita este artigo diretamente.</p>';
  const termos = termosDe(a.texto, 5, 0.5);
  if (termos.length) html += '<div class="pesquisar-box"><span class="rotulo">Termos deste artigo para entender</span><div class="chips">' + termos.map((t) => '<button class="chip termo-chip" data-acao="termo" data-t="' + t.g.i + '">' + esc(t.g.t) + '</button>').join('') + '</div></div>';
  return html + '</div></div>';
}

