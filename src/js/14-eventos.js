/* ================= Eventos ================= */
document.addEventListener('click', async (ev) => {
  // Modo Testar da lei seca: a tarja some no toque e volta no segundo
  const tarja = UI.camadas.teste && ev.target.closest('.texto-lei .g-num, .texto-lei .g-verbo');
  if (tarja) { tarja.classList.toggle('revelado'); return; }
  const alvo = ev.target.closest('[data-acao]');
  if (!alvo) { if (ev.target.id === 'folha') fecharFolha(); return; }
  const a = alvo.dataset.acao;
  if (alvo.tagName === 'INPUT' || alvo.tagName === 'SELECT') return;
  try { await executar(a, alvo); } catch (e) { registrarErro('botão ' + a, e); }
});
async function executar(a, alvo) {
  switch (a) {
    case 'ir':
      // A aba Mais sempre abre o menu do Mais, não a última página aberta lá dentro
      if (alvo.classList.contains('aba') && alvo.dataset.vista === 'mais') { UI.mais = 'menu'; UI.subtema = null; if (UI.vista === 'mais') { renderMais(); window.scrollTo(0, 0); break; } }
      if (alvo.classList.contains('aba') && alvo.dataset.vista !== UI.vista) {
        ROLAGEM[UI.vista] = window.scrollY;
        ir(alvo.dataset.vista, alvo.dataset.vista === 'mais' ? 0 : ROLAGEM[alvo.dataset.vista] || 0);
        break;
      }
      ir(alvo.dataset.vista); break;
    case 'mais': if (sessao) fecharSessao(true); fecharFolha(); UI.mais = alvo.dataset.sub || 'menu'; if (UI.vista !== 'mais') ir('mais'); else { renderMais(); window.scrollTo(0, 0); } break;
    case 'iniciar-dia': iniciarDia(alvo.dataset.dia); break;
    case 'recuperar': { if (retomarPausa('rec:' + hojeISO())) break; const cfg = cfgRecuperacao(); if (cfg) iniciarSessao(cfg); else avisar('✓', 'Sem atraso', 'As matérias dos dias passados já foram estudadas.'); break; }
    case 'ler-atraso': { const arts = leituraAtrasada().slice(0, LEITURA_MAX); if (arts.length) abrirArtigo(arts[0], arts); break; }
    case 'ler-pendente': { const x = pendencias().find((y) => y.dia.data === alvo.dataset.dia); if (x && x.ler.length) abrirArtigo(x.ler[0], x.ler); break; }
    case 'atraso-desde-inicio':
      S.perfil.atrasoDesde = DIAS[0].data;
      Store.salvar('perfil'); pendCache = null; renderHoje();
      avisar('✓', 'Atraso desde o início do plano', 'Os dias desde ' + fmtData(DIAS[0].data, { day: '2-digit', month: '2-digit' }) + ' entram no atraso. Os que você não quiser fazer podem ser dispensados um a um.');
      break;
    case 'dispensar-dia': {
      (S.perfil.dispensados ||= {})[alvo.dataset.dia] = hojeISO();
      Store.salvar('perfil'); renderHoje();
      avisar('✓', 'Pendência dispensada', 'O dia ' + fmtData(alvo.dataset.dia, { day: '2-digit', month: '2-digit' }) + ' saiu da lista. O que você estudou dele continua contando.');
      break;
    }
    case 'enfrentar-chefe': {
      const c = chefeDaSemana();
      if (c.vencido || recuou(c)) { avisar('♛', nomeChefe(c.bloco), c.vencido ? 'Derrotado nesta semana.' : 'Recuou: hoje ele não aguenta mais golpes. Volta amanhã com ' + c.vida + ' de vida.'); break; }
      if (sessao) fecharSessao(false);
      iniciarSessao({ modo: 'treino', n: BATALHA_N, blocos: [c.bloco], filtro: 'mistas', titulo: 'Batalha · ' + nomeChefe(c.bloco), chave: 'chefe:' + c.sem });
      break;
    }
    case 'equipar': { const it = IR.get(alvo.dataset.item); if (it && rpg().inv[it.id]) { rpg().eq[it.slot] = it.id; Store.salvar('perfil'); renderMais(); } break; }
    case 'iniciar-revisao': iniciarSessao({ modo: 'revisao', n: 30, chave: 'rev' }); break;
    case 'intercaladas': if (retomarPausa('i:' + hojeISO())) break; iniciarSessao({ modo: 'treino', intercalado: true, n: nIntercaladas(), titulo: 'Questões intercaladas', dia: 'i:' + hojeISO() }); break;
    case 'treino-rapido': iniciarSessao({ modo: 'treino', n: Number(alvo.dataset.n) || 20, blocos: [], filtro: 'mistas', chave: 'rapido', dia: alvo.dataset.pre ? 'r:' + hojeISO() : undefined }); break;
    case 'abrir-modo': UI.modo = alvo.dataset.modo; if (UI.modo === 'simulado') UI.prova = 'prova'; ir('questoes'); break;
    case 'relampago': iniciarSessao({ modo: 'relampago', blocos: (alvo.dataset.blocos || '').split(',').filter(Boolean) }); break;
    case 'set-modo': UI.modo = alvo.dataset.modo; salvarUI(); renderQuestoes(); break;
    case 'set-prova': UI.prova = alvo.dataset.prova; salvarUI(); renderQuestoes(); break;
    case 'set-n': UI.n = Number(alvo.dataset.n); salvarUI(); renderQuestoes(); break;
    case 'set-filtro': UI.filtro = alvo.dataset.filtro; salvarUI(); renderQuestoes(); break;
    case 'set-banca': UI.filtroBanca = alvo.dataset.banca; salvarUI(); renderQuestoes(); break;
    case 'anpd-set-fase': cadState().fase = alvo.dataset.fase; Store.salvar('perfil'); renderMais(); break;
    case 'anpd-set-degrau': cadState().degrau = Number(alvo.dataset.deg); Store.salvar('perfil'); renderMais(); break;
    case 'anpd-treino-rapido': {
      let bls = (alvo.dataset.blocos || '').split(',').filter(Boolean);
      let tit = alvo.dataset.tit;
      if (!bls.length && alvo.dataset.deg) {
        const degNum = Number(alvo.dataset.deg);
        const discsDeg = DISC.filter((x) => x.degrau === degNum).map((x) => x.id);
        bls = BLOCOS.filter((b) => discsDeg.includes(b.disciplina)).map((b) => b.id);
        tit = degNum + 'º Degrau · Treino Focado (20 itens)';
      }
      iniciarSessao({ modo: 'treino', n: 20, blocos: bls, filtro: 'mistas', titulo: tit || 'Treino ANPD' });
      break;
    }
    case 'ed-prio': UI.edPrio = alvo.dataset.v; renderMais(); break;
    case 'preset': {
      const p = alvo.dataset.preset, comQ = BLOCOS.filter((b) => (POR_BLOCO.get(b.id) || []).length);
      UI.blocos = p === 'p1' ? P1.slice() : p === 'lgpd' ? comQ.filter((b) => b.disciplina === 'lgpd').map((b) => b.id) : p === 'tudo' ? comQ.map((b) => b.id) : [];
      salvarUI(); renderQuestoes(); break;
    }
    case 'comecar': comecarConfigurado(); break;
    case 'simulado-semana': iniciarSessao({ modo: 'simulado', n: SIM_SEMANA_N, prova: true, minutos: Math.round(SIM_SEMANA_N * RITMO_PROVA_S / 60), titulo: 'Simulado da semana', chave: 'sim:' + semanaAtual() }); break;
    case 'simulado-oficial-120': iniciarSessao({ modo: 'simulado', n: TOTAL_PROVA, prova: true, minutos: minutosProva(), titulo: 'Simulado · prova inteira (' + TOTAL_PROVA + ' itens)' }); break;
    case 'simulado-anvisa-2024': {
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
    case 'imprimir-folha-vespera': abrirFolhaVespera(); break;
    case 'responder': responder(alvo.dataset.r); break;
    case 'revelar': proximo(); break;
    case 'avaliar': avaliar(Number(alvo.dataset.n)); break;
    case 'pesq-todos': UI.pesqTodos = true; renderMais(); break;
    case 'proximo': proximo(); break;
    case 'som': UI.som = !UI.som; salvarUI(); tocar('acerto'); renderSessao(); break;
    case 'foco': UI.foco = !UI.foco; salvarUI(); renderSessao(); break;
    case 'anterior': if (sessao && sessao.i > 0) { sessao.i--; renderSessao(); } break;
    case 'ir-item': if (sessao) { sessao.i = Number(alvo.dataset.i); renderSessao(); } break;
    case 'entregar': if (sessao) { sessao.confirmar = 'entregar'; renderSessao(); document.getElementById('sessao').scrollTop = 0; } break;
    case 'confirmar-entrega': if (sessao) { sessao.confirmar = null; finalizar(); } break;
    case 'cancelar-conf': if (sessao) { sessao.confirmar = null; renderSessao(); } break;
    case 'sair-sessao':
      if (!sessao) break;
      if (sessao.fim || (sessao.modo === 'cards' ? sessao.i === 0 : !Object.keys(sessao.resp).length)) fecharSessao();
      else { sessao.confirmar = 'sair'; renderSessao(); document.getElementById('sessao').scrollTop = 0; }
      break;
    case 'descartar-pausa': descartarPausa(alvo.dataset.k); renderTudo(); break;
    case 'retomar-pausa': retomarPausa(alvo.dataset.k); break;
    case 'confirmar-saida': {
      const k = chavePausa(sessao);
      fecharSessao();
      const p = k && pausaDe(k);
      if (p) avisar('II', 'Sessão guardada', resumoPausa(p).replace(/^./, (c) => c.toUpperCase()) + '. Toque em Continuar para seguir de onde parou.');
      break;
    }
    case 'sair-descartar': { const k = chavePausa(sessao); fecharSessao(false); if (k) descartarPausa(k); renderTudo(); break; }
    case 'fechar-sessao': fecharSessao(); break;
    case 'refazer-erros': {
      const ids = idsParaRefazer();
      fecharSessao();
      iniciarSessao({ modo: 'treino', ids: embaralhar(ids), titulo: 'Refazer erros' });
      break;
    }
    case 'revisar-item': folhaItem(alvo.dataset.q, alvo.dataset.r); break;
    case 'art-inline': abrirArtInline(alvo); break;
    case 'fechar-folha': fecharFolha(); break;
    case 'termo': folhaTermo(Number(alvo.dataset.t)); break;
    case 'treinar-termo': {
      const g = GLOSS[Number(alvo.dataset.t)];
      const ids = Q.filter((q) => g.re.test(q.e + ' ' + q.c)).map((q) => q.id);
      fecharFolha();
      if (sessao) fecharSessao();
      iniciarSessao({ modo: 'treino', ids: embaralhar(ids).slice(0, 20), titulo: g.t });
      break;
    }
    case 'add-pesq':
      if (addPesquisa(alvo.dataset.t, alvo.dataset.o)) {
        if (alvo.closest('#folha') || alvo.closest('#sessao')) { if (alvo.tagName === 'BUTTON') alvo.outerHTML = '<span class="selo ok">Na sua lista</span>'; }
        else if (UI.vista === 'mais') renderMais(); else if (UI.vista === 'hoje') renderHoje();
      }
      break;
    case 'filtro-pesq': UI.filtroPesq = alvo.dataset.f; renderMais(); break;
    case 'abrir-art': abrirArtigo(alvo.dataset.art, null); break;
    case 'nav-art': if (alvo.dataset.art) abrirArtigo(alvo.dataset.art); break;
    case 'ouvir-art': ouvirArtigo(alvo.dataset.art); break;
    case 'conferir-fria': FRIA_VISTA.add(alvo.dataset.art); renderLei(); break;
    case 'voltar-lei': pararFala(); if (UI.artSel && ARTI.get(UI.artSel)) UI.lei = ARTI.get(UI.artSel).lei; UI.artSel = null; UI.leiFila = null; renderLei(); window.scrollTo(0, 0); break;
    case 'ler-dia': { const ctx = contextoHoje(); const arts = artigosDoDia(ctx.tipo === 'dia' ? ctx.dia : null); if (arts.length) abrirArtigo(arts[0], arts); break; }
    case 'ler-tudo': if (artsDe(UI.lei).length) abrirArtigo(artsDe(UI.lei)[0].k, null); break;
    case 'fim-fila': UI.leiFila = null; UI.artSel = null; avisar('§', 'Leitura do dia concluída', 'Agora os cards cloze desses artigos.'); ir('hoje'); break;
    case 'ranking': UI.ranking = !UI.ranking; if (UI.ranking) UI.termometro = false; renderLei(); break;
    case 'toggle-termometro': UI.termometro = !UI.termometro; if (UI.termometro) UI.ranking = false; renderLei(); break;
    case 'neutralizar-vulnerabilidades': {
      const L = LEIS[UI.lei || 'lgpd'];
      const diagArts = L.artigos.map((a) => diagnosticoArtigo(a.k));
      const verms = diagArts.filter((d) => d.nivel === 'vermelho');
      let ids = [];
      for (const d of verms) {
        if (d.erradasIds && d.erradasIds.length) ids.push(...d.erradasIds);
        else { const qs = POR_ART.get(d.k) || []; ids.push(...qs.map((q) => q.id)); }
      }
      ids = [...new Set(ids)];
      if (!ids.length) {
        const amars = diagArts.filter((d) => d.nivel === 'amarelo');
        for (const d of amars) { const qs = POR_ART.get(d.k) || []; ids.push(...qs.map((q) => q.id)); }
        ids = [...new Set(ids)];
      }
      if (!ids.length) { avisar('✓', 'Nenhuma vulnerabilidade crítica', 'Parabéns! Você não tem artigos com desempenho crítico nesta norma.'); break; }
      iniciarSessao({ modo: 'treino', ids: embaralhar(ids).slice(0, 30), titulo: 'Neutralizar Vulnerabilidades · ' + (L.curto || L.nome), chave: 'vuln:' + (UI.lei || 'lgpd') });
      break;
    }
    case 'camada':
      UI.camadas[alvo.dataset.c] = !UI.camadas[alvo.dataset.c];
      if (alvo.dataset.c === 'teste' && UI.camadas.teste) UI.camadas.num = UI.camadas.verbo = true;
      document.documentElement.classList.toggle('lei-teste', !!UI.camadas.teste);
      salvarUI();
      if (alvo.closest('#folha') && UI.folhaAula) folhaAula(UI.folhaAula);
      else if (UI.vista === 'mais') renderMais(); else renderLei();
      break;
    case 'treinar-arm': {
      // Itens da armadilha escolhida, de preferência nos blocos de prioridade 1 e 2; vencidas e inéditas primeiro
      const k = alvo.dataset.a;
      const todos = Q.filter((q) => q.a === k && !q.al);
      const fortes = todos.filter((q) => (BI.get(q.b) || {}).prioridade <= 2);
      const ids = selecionar(fortes.length >= 20 ? fortes : todos, 20, 'mistas').map((q) => q.id);
      if (ids.length) iniciarSessao({ modo: 'treino', ids, titulo: 'Armadilha · ' + (D.armadilhas[k] || k), chave: 'arm:' + k });
      break;
    }
    case 'treinar-bloco': iniciarSessao({ modo: 'treino', n: 20, blocos: [alvo.dataset.bloco], filtro: 'mistas', titulo: 'Treino · ' + nomeBloco(alvo.dataset.bloco), chave: 'bloco:' + alvo.dataset.bloco }); break;
    case 'treinar-art': { const ids = (POR_ART.get(alvo.dataset.art) || []).map((q) => q.id); iniciarSessao({ modo: 'treino', ids: embaralhar(ids), titulo: 'Questões · ' + nomeArt(alvo.dataset.art), chave: 'art:' + alvo.dataset.art }); break; }
    case 'cards-art': iniciarCards((CARDS_POR_ART.get(alvo.dataset.art) || []).map((c) => c.id), 'Cards · ' + nomeArt(alvo.dataset.art)); break;
    case 'treinar-reais': {
      const ids = selecionarReais(20).map((q) => q.id);
      if (ids.length) iniciarSessao({ modo: 'treino', ids, titulo: 'Itens reais inéditos', chave: 'reais:ineditos' });
      break;
    }
    case 'reais-disc': {
      const d = (D.cebraspe ? D.cebraspe.disciplinas : []).find((x) => x.id === alvo.dataset.d);
      const ids = d ? reaisDaDisc(d.id).map((q) => q.id) : [];
      if (ids.length) iniciarSessao({ modo: 'treino', ids: embaralhar(ids), titulo: 'Itens reais · ' + ((DISC.find((x) => x.id === d.id) || {}).nome || d.id), chave: 'reais:' + d.id });
      break;
    }
    case 'disc-abrir': UI.discTema = alvo.dataset.t; UI.discFase = 'escrita'; UI.discAval = {}; UI.discNE = 0; UI.discIA = null; renderMais(); window.scrollTo(0, 0); break;
    case 'disc-salvar-rascunho': {
      guardarRascunhoDisc();
      const el = document.getElementById('disc-status-salvo');
      if (el) el.textContent = '✓ Salvo às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      break;
    }
    case 'disc-voltar': guardarRascunhoDisc(); UI.discTema = null; UI.discFase = null; renderMais(); window.scrollTo(0, 0); break;
    case 'investigar': folhaInvestigar(alvo.dataset.t, alvo.dataset.o); break;
    case 'inv-conferir': conferirInv(); break;
    case 'inv-parar': if (UI.inv && UI.inv.ctl) UI.inv.ctl.abort(); break;
    case 'inv-copiar': copiarInv(); break;
    case 'inv-entendi': { const p = S.pesquisa[alvo.dataset.k]; if (p && !p.s) { p.s = 1; p.f = hojeISO(); ganharXP(5); verificarConquistas(); Store.salvar('pesquisa', 'perfil'); } if (UI.inv) folhaInvestigar(UI.inv.t, UI.inv.o); if (UI.vista === 'mais') renderMais(); break; }
    case 'disc-ia': corrigirDiscIA(); break;
    case 'claro-ia': await traduzirIA(alvo); break;
    case 'disc-corrigir':
      guardarRascunhoDisc();
      if (!estadoDisc(UI.discTema).rascunho.trim()) { avisar('!', 'Texto vazio', 'Escreva a resposta antes de corrigir.'); break; }
      UI.discFase = 'correcao'; renderMais(); break;
    case 'disc-dia': fecharFolha(); UI.mais = 'discursiva'; UI.discTema = alvo.dataset.t; UI.discFase = 'escrita'; UI.discAval = {}; UI.discNE = 0; UI.discIA = null; if (UI.vista !== 'mais') ir('mais'); else renderMais(); window.scrollTo(0, 0); break;
    case 'disc-editar': UI.discFase = 'escrita'; UI.discIA = null; renderMais(); break;
    case 'disc-limpar': alvo.outerHTML = '<button class="btn" data-acao="disc-limpar-ok">Apagar mesmo o texto</button>'; break;
    case 'disc-limpar-ok': { const t = estadoDisc(UI.discTema); t.rascunho = ''; Store.salvar('discursivas'); renderMais(); break; }
    case 'disc-salvar': {
      const t = TEMAS_DISC.find((x) => x.id === UI.discTema);
      if (!t) break;
      const r = notaDisc(t);
      if (!r.completo) { avisar('!', 'Falta conceito', 'Marque um conceito em cada quesito antes de salvar.'); break; }
      const st = estadoDisc(t.id);
      st.tentativas.unshift({ d: hojeISO(), nc: Math.round(r.nc * 100) / 100, ne: r.ne, tl: r.tl, nq: Math.round(r.nq * 100) / 100, q: t.quesitos.map((q, i) => UI.discAval[i]), ia: UI.discIA ? 1 : undefined });
      st.tentativas = st.tentativas.slice(0, 8);
      ganharXP(30);
      verificarConquistas();
      const baixa = darBaixaDisc();
      Store.salvar('discursivas', 'perfil');
      avisar('✎', 'Discursiva salva', r.nq.toFixed(2).replace('.', ',') + ' de ' + t.pontos + ' · +30 XP' + (baixa ? ' · plano de ' + fmtData(baixa.data, { day: '2-digit', month: '2-digit' }) + ' em dia' : ''));
      renderMais();
      break;
    }
    case 'contestar': folhaContestar(alvo.dataset.q); break;
    case 'subtema':
      if (alvo.dataset.de) marcarEstudado(alvo.dataset.de);
      fecharFolha(); UI.subtema = alvo.dataset.st || null; if (UI.subtema) UI.stUltimo = UI.subtema; UI.mais = 'trilha'; salvarUI(); if (UI.vista !== 'mais') ir('mais'); else renderMais(); window.scrollTo(0, 0); break;
    case 'aula-folha':
      marcarEstudado(alvo.dataset.st);
      if (alvo.dataset.marca && !S.perfil.feitos['aula:' + hojeISO()]) { S.perfil.feitos['aula:' + hojeISO()] = 1; Store.salvar('perfil'); }
      folhaAula(alvo.dataset.st); break;
    case 'st-lei': case 'st-aula': abrirSubtemaEm(alvo.dataset.st, a === 'st-lei' ? 'lei' : 'aula'); break;
    case 'trilha-sessao': {
      const st = SUBTEMAS.get(alvo.dataset.st), tipo = alvo.dataset.tipo;
      const chT = 't:' + st.id + ':' + tipo;
      if (pausaDe(chT)) { fecharFolha(); retomarPausa(chT); break; }
      const ids = idsSubtema(st.id, tipo, Number(alvo.dataset.n) || (tipo === 'pre' ? 8 : 20));
      if (!ids.length) { avisar('§', 'Nada para fazer aqui', tipo === 'erros' ? 'Você não tem erros pendentes neste subtema.' : 'Todos os itens já foram vistos: use Praticar.'); break; }
      fecharFolha();
      iniciarSessao({ modo: 'treino', ids, titulo: (tipo === 'pre' ? 'Pré-teste · ' : tipo === 'erros' ? 'Erros · ' : 'Prática · ') + st.nome, dia: 't:' + hojeISO(), chave: chT, st: st.id, tipoSubtema: tipo });
      break;
    }
    case 'contestar-enviar': {
      const motivo = (document.querySelector('input[name="contest-motivo"]:checked') || {}).value || 'outro';
      const texto = (document.getElementById('contest-texto') || {}).value || '';
      const rec = { q: alvo.dataset.q, motivo, texto: texto.trim().slice(0, 2000), data: new Date().toISOString(), versao: D.versao, status: 'pendente', resposta: '' };
      CONTEST.push(rec); gravarContest(); verificarConquistas(); Store.salvar('perfil');
      alvo.disabled = true;
      const ok = await enviarContestacao(rec);
      gravarContest();
      avisar('!', ok ? 'Contestação enviada' : 'Contestação guardada', ok ? 'O item será revisto na próxima rodada.' : 'Sem conexão com o banco agora: ela será enviada quando o app abrir conectado.');
      folhaContestar(rec.q);
      break;
    }
    case 'rolar': { const el = document.getElementById(alvo.dataset.alvo); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); break; }
    case 'reais': {
      const ids = REAIS.map((q) => q.id);
      iniciarSessao({ modo: alvo.dataset.modo, ids: alvo.dataset.modo === 'simulado' ? ids.sort((a, b) => ordemProva(QI.get(a)) - ordemProva(QI.get(b))) : embaralhar(ids), titulo: alvo.dataset.modo === 'simulado' ? 'Itens reais como prova' : 'Itens reais de prova', chave: 'reais-' + alvo.dataset.modo });
      break;
    }
    case 'cards-iniciar': iniciarSessao({ modo: 'cards', blocos: UI.blocosCards, novos: novosRestantesHoje() }); break;
    case 'cards-so-revisao': iniciarSessao({ modo: 'cards', blocos: UI.blocosCards, soRevisao: true }); break;
    case 'dia-curto': {
      const ctx = contextoHoje(), bs = blocosDoDia(ctx.tipo === 'dia' ? ctx.dia : null);
      const rev = listaVencida().concat(manutencaoHoje()).slice(0, 10), usados = new Set(rev.map((q) => q.id));
      const pool = (bs.length ? bs : P1).flatMap((b) => POR_BLOCO.get(b) || []).filter((q) => !usados.has(q.id) && !q.al);
      const ids = rev.concat(selecionar(pool, 10, 'novas')).map((q) => q.id);
      iniciarSessao({ modo: 'treino', ids, dia: 'curto:' + hojeISO(), titulo: 'Dia curto' });
      break;
    }
    case 'cards-revisao': iniciarSessao({ modo: 'cards', soRevisao: true, soNumero: !!alvo.dataset.num, titulo: 'Cards vencidos' }); break;
    // Cards do roteiro: 5 de número e prazo, dos blocos do dia quando eles têm; senão, de qualquer bloco
    case 'cards-dia': {
      const ctx = contextoHoje();
      const bs = blocosDoDia(ctx.tipo === 'dia' ? ctx.dia : null).filter((b) => (CARDS_POR_BLOCO.get(b) || []).some((c) => c.nota.nu));
      iniciarSessao({ modo: 'cards', blocos: bs.length ? bs : null, soNumero: true, novos: Math.min(5, novosRestantesHoje()), titulo: 'Cards de número e prazo' });
      break;
    }
    case 'fase': UI.faseAberta = UI.faseAberta === alvo.dataset.fase ? '' : alvo.dataset.fase; renderMais(); break;
    case 'status': { const b = alvo.dataset.bloco; S.perfil.status[b] = STATUS_CICLO[S.perfil.status[b] || 'nao']; Store.salvar('perfil'); renderMais(); break; }
    case 'tema': UI.tema = alvo.dataset.tema; salvarUI(); aplicarTema(); renderTudo(); break;
    case 'tema-alternar': UI.tema = temaEscuroAtivo() ? 'claro' : 'escuro'; salvarUI(); aplicarTema(); renderTudo(); break;
    case 'meta': if (alvo.dataset.meta === 'auto') S.perfil.metaFixa = 0; else { S.perfil.meta = Number(alvo.dataset.meta); S.perfil.metaFixa = 1; } Store.salvar('perfil'); renderTudo(); break;
    case 'novos-cards': S.perfil.novosCards = Number(alvo.dataset.n); Store.salvar('perfil'); renderTudo(); break;
    case 'edital-salvar': {
      const r = lerEdital();
      if (r.erro) { document.getElementById('ed-msg').textContent = r.erro; break; }
      S.perfil.edital = r.ed; Store.salvar('perfil'); renderTudo();
      document.getElementById('ed-msg').textContent = 'Edital salvo: prova de ' + TOTAL_PROVA + ' itens e ' + PONTOS_PROVA + ' pontos' + (r.ed.prova ? ', em ' + fmtData(r.ed.prova, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '') + '.';
      break;
    }
    // null, não delete: a junção de perfis (mesclarDoc) traria de volta o edital do outro aparelho
    case 'edital-padrao': S.perfil.edital = null; Store.salvar('perfil'); renderTudo(); document.getElementById('ed-msg').textContent = 'De volta à projeção da Anatel 2024.'; break;
    // Encaixe do plano numa prova antes do fim do cronograma (a do edital) ou no plano B; as semanas cortadas ficam
    // gravadas, para o plano não mudar depois com o tempo nem com os pesos
    case 'plano-encaixar': case 'plano-b': {
      const prova = a === 'plano-b' ? PLANO_B : dataProva(), r = encaixarPlano(prova, hojeISO());
      if (!r) break;
      S.perfil.encaixe = { prova, desde: hojeISO(), cortes: r.cortes };
      Store.salvar('perfil'); renderTudo();
      avisar('✓', 'Plano encaixado até ' + fmtData(prova, { day: '2-digit', month: '2-digit' }), pl(r.cortes.length, 'semana saiu', 'semanas saíram') + ' do plano; o resto foi adiantado.');
      break;
    }
    case 'plano-original': S.perfil.encaixe = null; Store.salvar('perfil'); renderTudo(); avisar('✓', 'Plano original', 'O cronograma voltou a ser o da projeção.'); break;
    case 'backup-baixar': {
      const r = await salvarArquivo('painel-anpd-backup-' + hojeISO() + '.json', backupTexto());
      if (r === true) marcarBackup();
      else if (r === null) mostrarTexto(document.getElementById('zona-backup') ? 'zona-backup' : null, backupTexto(), 'O download não está disponível aqui. Copie o texto e guarde num arquivo .json.');
      break;
    }
    case 'backup-copiar-hoje': mostrarTexto(null, backupTexto(), 'Copie e guarde este texto (num e-mail para você mesmo, por exemplo). Para restaurar, cole-o em Mais → Ajustes e escolha Juntar.'); break;
    case 'backup-mostrar': mostrarTexto('zona-backup', backupTexto(), 'Copie e guarde este texto. Para restaurar, cole-o em “Ou restaurar colando o texto do backup”, aqui mesmo.'); break;
    case 'backup-colado': { const t = document.getElementById('texto-backup'); if (!t || !t.value.trim()) avisar('!', 'Nada colado', 'Cole o texto do backup no campo acima.'); else restaurar(t.value); break; }
    case 'backup-juntar': {
      const d = backupPendente;
      if (!d) break;
      // No que liga e desliga (metas, status, preferências), vale a cópia com mais histórico; a época deste aparelho fica
      const localNovo = Object.keys(S.itens).length >= Object.keys(d.itens || {}).length, ep = S.perfil.ep;
      S.perfil = Object.assign(perfilPadrao(), mesclarDoc('perfil', d.perfil, S.perfil, localNovo));
      if (ep) S.perfil.ep = ep; else delete S.perfil.ep;
      podarPerfil(); aplicarPrefs();
      S.itens = mesclarDoc('itens', { q: d.itens || {} }, { q: S.itens }).q;
      S.cards = mesclarDoc('cards', { c: d.cards || {} }, { c: S.cards }).c;
      S.simulados = mesclarDoc('simulados', { lista: d.simulados || [] }, { lista: S.simulados }, localNovo).lista;
      S.pesquisa = mesclarDoc('pesquisa', { p: d.pesquisa || {} }, { p: S.pesquisa }, localNovo).p;
      S.disc = mesclarDoc('discursivas', { d: d.disc || {} }, { d: S.disc }, localNovo).d;
      juntarContestacoes(d.contestacoes);
      backupPendente = null;
      Store.salvarTudo(); renderTudo(); avisar('↺', 'Backup somado a este aparelho', fmtNum(S.perfil.xp) + ' XP · ' + pl(Object.keys(S.itens).length, 'questão', 'questões') + ' com histórico');
      break;
    }
    case 'backup-substituir': {
      const z = document.getElementById('zona-backup');
      if (!backupPendente || !z) break;
      z.insertAdjacentHTML('beforeend', '<div class="cartao"><p><b>Substituir tudo?</b> O progresso deste aparelho e o da sua conta saem, e o do backup entra no lugar. Não dá para desfazer: baixe um backup do estado atual antes.</p><div class="linha-btns"><button class="btn" data-acao="backup-confirmar">Sim, substituir</button><button class="btn" data-acao="mais" data-sub="ajustes">Cancelar</button></div></div>');
      z.querySelector('[data-acao="backup-substituir"]').disabled = true;
      break;
    }
    case 'backup-confirmar': {
      const d = backupPendente;
      if (!d) break;
      S.perfil = Object.assign(perfilPadrao(), d.perfil, { ep: Date.now() }); podarPerfil(); aplicarPrefs(); S.itens = d.itens || {}; S.cards = d.cards || {}; S.simulados = d.simulados || []; S.pesquisa = d.pesquisa || {}; S.disc = d.disc || {};
      juntarContestacoes(d.contestacoes);
      backupPendente = null;
      Store.salvarTudo(); renderTudo(); avisar('↺', 'Progresso restaurado', fmtNum(S.perfil.xp) + ' XP');
      break;
    }
    case 'copiar': {
      const ta = document.getElementById('texto-export');
      if (!ta) break;
      try { await navigator.clipboard.writeText(ta.value); avisar('✓', 'Copiado', ''); if (ta.value.startsWith('{"app":"painel-anpd"')) marcarBackup(); } catch (e) { ta.focus(); ta.select(); }
      break;
    }
    case 'permissoes': {
      try { const p = window.claude && window.claude.use ? await window.claude.use('permissions') : null; if (p) await p.manage(); else avisar('!', 'Indisponível aqui', 'Use o menu de permissões do artifact no claude.ai.'); }
      catch (e) { avisar('!', 'Não abriu', 'Use o menu de permissões do artifact no claude.ai.'); }
      break;
    }
    case 'tentar-gravar':
      if (Store.modo === 'nuvem') { Store.salvarTudo(); Store.descarregar(); avisar('↑', 'Gravando', 'Confira o diagnóstico em alguns segundos.'); }
      else { Object.assign(Store.diag, { db: '—', user: '—', id: '—', leitura: '—', gravacao: '—' }); Store.iniciar(); }
      setTimeout(() => { if (!sessao) renderTudo(); }, 2500);
      break;
    case 'zerar': document.getElementById('zona-zerar').innerHTML = '<p><b>Tem certeza?</b> Não dá para desfazer. Baixe um backup antes.</p><div class="linha-btns"><button class="btn primario" data-acao="confirmar-zerar">Apagar tudo</button><button class="btn" data-acao="mais" data-sub="ajustes">Cancelar</button></div>'; break;
    case 'confirmar-zerar':
      S.perfil = Object.assign(perfilPadrao(), { status: S.perfil.status, meta: S.perfil.meta, metaFixa: S.perfil.metaFixa, novosCards: S.perfil.novosCards, intercaladas: S.perfil.intercaladas, ui: S.perfil.ui, edital: S.perfil.edital, ep: Date.now() });
      S.itens = {}; S.cards = {}; S.simulados = []; S.pesquisa = {}; S.disc = {};
      Store.salvarTudo(); renderTudo(); avisar('0', 'Progresso zerado', 'Status dos blocos, metas, preferências e os dados do edital foram mantidos.');
      break;
    case 'copiar-erros': if (await copiarTexto(JSON.stringify(ERROS, null, 1))) avisar('✓', 'Erros copiados', 'Cole na conversa com o Claude.'); break;
    case 'sync-tcu': sincronizarDoTCU(undefined); break;
    default: break;
  }
}
document.addEventListener('change', (ev) => {
  const alvo = ev.target.closest('[data-acao]');
  if (!alvo) return;
  const a = alvo.dataset.acao;
  if (a === 'sel-lei') { UI.lei = alvo.value; UI.artSel = null; UI.leiFila = null; salvarUI(); renderLei(); return; }
  if (a === 'toggle-bloco' || a === 'toggle-bloco-card') {
    const chave = a === 'toggle-bloco' ? 'blocos' : 'blocosCards';
    const set = new Set(UI[chave]);
    if (alvo.checked) set.add(alvo.dataset.bloco); else set.delete(alvo.dataset.bloco);
    UI[chave] = BLOCOS.map((x) => x.id).filter((id) => set.has(id));
    salvarUI();
    if (a === 'toggle-bloco') renderQuestoes(); else renderCards();
  } else if (a === 'duvida' && sessao) sessao.duv[sessao.ids[sessao.i]] = alvo.checked;
  else if (a === 'disc-conceito') {
    UI.discAval = UI.discAval || {};
    UI.discAval[Number(alvo.dataset.q)] = Number(alvo.value);
    const t = TEMAS_DISC.find((x) => x.id === UI.discTema), el = document.getElementById('disc-res');
    if (t && el) el.innerHTML = resultadoDisc(t);
  }
  else if (a === 'dia-feito') { if (alvo.checked) S.perfil.feitos[alvo.dataset.dia] = 1; else delete S.perfil.feitos[alvo.dataset.dia]; Store.salvar('perfil'); renderMais(); }
  else if (a === 'anpd-check-sem' || a === 'tcu-check-sem') {
    const semKey = semanaAtual(), cs = ((cadState().checkSem ||= {})[semKey] ||= {});
    // Desmarcar guarda o item como já pago (0): remarcar não paga os 15 XP de novo, e o bônus sai uma vez por semana
    if (alvo.checked) {
      const pago = alvo.dataset.i in cs;
      cs[alvo.dataset.i] = 1;
      if (!pago) ganharXP(15);
      const totalChecks = ((D.mentor && D.mentor.metodo && D.mentor.metodo.checklistSemanal) || []).length || 7;
      if (checksFeitos(cs) >= totalChecks && !cs.bonus) {
        cs.bonus = 1;
        ganharXP(50);
        avisar('★', 'Semana 100% Cumprida!', 'Checklist semanal do mentor zerado (+50 XP de bônus)');
      }
    } else {
      cs[alvo.dataset.i] = 0;
    }
    Store.salvar('perfil');
    if (UI.vista === 'mais') renderMais();
    else if (UI.vista === 'hoje') renderHoje();
  }
  else if (a === 'pesq-feito') {
    const p = S.pesquisa[alvo.dataset.k];
    if (p) { p.s = alvo.checked ? 1 : 0; p.f = alvo.checked ? hojeISO() : null; if (alvo.checked) ganharXP(5); verificarConquistas(); Store.salvar('pesquisa', 'perfil'); renderMais(); }
  } else if (a === 'backup-arquivo') {
    const f = alvo.files && alvo.files[0];
    if (!f) return;
    const leitor = new FileReader();
    leitor.onload = () => restaurar(String(leitor.result));
    leitor.readAsText(f);
  } else if (a === 'tcu-arquivo') {
    const f = alvo.files && alvo.files[0];
    if (!f) return;
    const leitor = new FileReader();
    leitor.onload = () => { let o = null; try { o = JSON.parse(String(leitor.result)); } catch (e) { /* arquivo inválido */ } sincronizarDoTCU(o); };
    leitor.readAsText(f);
  }
});
// Sair da caixa de texto da discursiva grava o rascunho na hora, sem esperar a pausa da digitação
document.addEventListener('focusout', (ev) => { if (ev.target && ev.target.id === 'disc-texto') guardarRascunhoDisc(); });
document.addEventListener('focusin', (ev) => { if (ev.target && ev.target.id === 'disc-texto') crescerDisc(ev.target); });
// Outra aba do painel gravou no navegador: junta o que ela tem com o que está aqui (como no Juntar do backup), para
// nenhuma apagar o progresso da outra; não grava de volta aqui, a próxima gravação normal já leva a junção
window.addEventListener('storage', (ev) => {
  if (ev.key !== CHAVE_LOCAL || !ev.newValue || !Store.localLido) return;
  let d;
  try { d = JSON.parse(ev.newValue); } catch (e) { return; }
  if (!d || !d.perfil) return;
  const ep = S.perfil.ep;
  S.perfil = Object.assign(perfilPadrao(), mesclarDoc('perfil', d.perfil, S.perfil, true));
  if (ep) S.perfil.ep = ep; else delete S.perfil.ep;
  podarPerfil();
  S.itens = mesclarDoc('itens', { q: d.itens || {} }, { q: S.itens }).q;
  S.cards = mesclarDoc('cards', { c: d.cards || {} }, { c: S.cards }).c;
  S.simulados = mesclarDoc('simulados', { lista: d.simulados || [] }, { lista: S.simulados }, true).lista;
  S.pesquisa = mesclarDoc('pesquisa', { p: d.pesquisa || {} }, { p: S.pesquisa }, true).p;
  S.disc = mesclarDoc('discursivas', { d: d.disc || {} }, { d: S.disc }, true).d;
  if (!sessao) renderTudo();
});
// Teclado do celular aberto de verdade (a área visível encolhe com um campo de texto focado): o que é fixo embaixo sai do
// caminho. Só pelo foco não dá: no Android, fechar o teclado com o Voltar mantém o campo focado. Girar o aparelho muda a
// largura e recomeça a medida (em paisagem a altura cai sem teclado nenhum, e a barra de abas sumia)
if (window.visualViewport) {
  const vv = window.visualViewport;
  let alturaMax = vv.height, largura = vv.width;
  vv.addEventListener('resize', () => {
    const h = vv.height, a = document.activeElement;
    if (Math.abs(vv.width - largura) > 1) { largura = vv.width; alturaMax = h; }
    if (h > alturaMax) alturaMax = h;
    const campo = !!a && (/^(TEXTAREA|SELECT)$/.test(a.tagName) || (a.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|range|file)$/.test(a.type)) || a.isContentEditable);
    document.body.classList.toggle('kb-aberto', campo && h < alturaMax * 0.75);
  });
}
// Partes recolhidas (<details data-det>) continuam abertas ou fechadas quando a tela é redesenhada
document.addEventListener('toggle', (ev) => { const d = ev.target; if (d && d.dataset && d.dataset.det) UI.det[d.dataset.det] = d.open; }, true);
document.addEventListener('input', (ev) => {
  const id = ev.target.id;
  if (id === 'inv-texto') { if (UI.inv) UI.inv.rascunho = ev.target.value; return; }
  if (id === 'disc-texto' || id === 'disc-ne') {
    const t = TEMAS_DISC.find((x) => x.id === UI.discTema);
    if (!t) return;
    if (id === 'disc-ne') { UI.discNE = ev.target.value; const el = document.getElementById('disc-res'); if (el) el.innerHTML = resultadoDisc(t); return; }
    estadoDisc(t.id).rascunho = ev.target.value;
    crescerDisc(ev.target);
    const c = document.getElementById('disc-cont');
    if (c) c.innerHTML = contadorDisc(t);
    // Rascunho salvo um segundo depois da última tecla
    clearTimeout(timerDisc);
    timerDisc = setTimeout(() => Store.salvar('discursivas'), 1000);
    return;
  }
  if (id !== 'busca-lei' && id !== 'busca-gloss' && id !== 'busca-edital') return;
  const pos = ev.target.selectionStart;
  if (id === 'busca-lei') { UI.busca = ev.target.value; renderLei(); }
  else if (id === 'busca-edital') { UI.edBusca = ev.target.value; renderMais(); }
  else { UI.buscaGloss = ev.target.value; renderMais(); }
  const novo = document.getElementById(id);
  if (novo) { novo.focus(); try { novo.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !document.getElementById('folha').hidden) { fecharFolha(); return; }
  // Diálogo com aria-modal tem de fechar no Escape; a sessão fica guardada e volta em "Continuar"
  if (ev.key === 'Escape' && sessao && !sessao.confirmar) { fecharSessao(true); return; }
  // Folha aberta (diálogo modal): o Tab circula dentro dela, sem cair na tela de trás
  if (ev.key === 'Tab' && !document.getElementById('folha').hidden) {
    const fs = [...document.getElementById('folha').querySelectorAll('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent);
    if (fs.length && (ev.shiftKey ? document.activeElement === fs[0] || !fs.includes(document.activeElement) : document.activeElement === fs[fs.length - 1])) { ev.preventDefault(); (ev.shiftKey ? fs[fs.length - 1] : fs[0]).focus(); }
    return;
  }
  if (!sessao || sessao.fim || sessao.confirmar) return;
  if (ev.target && ev.target.id === 'card-digitar' && ev.key === 'Enter') { ev.preventDefault(); proximo(); return; }
  if (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName) && ev.target.type !== 'checkbox') return;
  if (!document.getElementById('folha').hidden) return;
  // Atalho de uma letra só vale sem modificador: com Cmd/Ctrl/Alt a tecla pertence ao navegador.
  // Sem esta guarda, copiar o enunciado (Cmd+C) marcava "Certo", Ctrl+E marcava "Errado" e Cmd+B
  // respondia em branco, e a resposta ia para o histórico, para o XP e para a medida de prontidão.
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const k = ev.key.toLowerCase();
  if (sessao.modo === 'cards') {
    if (!sessao.revelado && (k === ' ' || k === 'enter')) { ev.preventDefault(); proximo(); }
    else if (sessao.revelado && ['1', '2', '3', '4'].includes(k)) avaliar(Number(k));
    return;
  }
  if (sessao.revelado) { if (k === 'enter' || k === ' ') { ev.preventDefault(); proximo(); } return; }
  const qAtual = QI.get(sessao.ids[sessao.i]);
  if (qAtual && qAtual.al) {
    const L = k.toUpperCase();
    if (k.length === 1 && LETRAS.slice(0, qAtual.al.length).includes(L)) responder(L);
    else if (sessao.modo === 'simulado' && k === 'arrowright') proximo();
    else if (sessao.modo === 'simulado' && k === 'arrowleft' && sessao.i > 0) { sessao.i--; renderSessao(); }
    return;
  }
  if (k === 'c') responder('C');
  else if (k === 'e') responder('E');
  else if (k === 'b' && sessao.modo !== 'relampago') responder(BRANCO);
  else if (k === 'd' && sessao.modo !== 'relampago') { const id = sessao.ids[sessao.i]; sessao.duv[id] = !sessao.duv[id]; renderSessao(); }
  else if (sessao.modo === 'simulado' && k === 'arrowright') proximo();
  else if (sessao.modo === 'simulado' && k === 'arrowleft' && sessao.i > 0) { sessao.i--; renderSessao(); }
});
document.addEventListener('pointerover', (ev) => {
  let dica = document.getElementById('dica');
  // No toque a dica não teria como sumir: só aparece com mouse
  if (ev.pointerType && ev.pointerType !== 'mouse') { if (dica) dica.remove(); return; }
  const c = ev.target.closest && ev.target.closest('[data-dica]');
  if (!c) { if (dica) dica.remove(); return; }
  if (!dica) { dica = document.createElement('div'); dica.id = 'dica'; dica.className = 'dica'; document.body.appendChild(dica); }
  dica.textContent = c.dataset.dica;
  const r = c.getBoundingClientRect();
  dica.style.left = Math.max(8, Math.min(window.innerWidth - 200, r.left - 30)) + 'px';
  dica.style.top = (r.top - 32) + 'px';
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { contarTempo(true); guardarSessaoAberta(); Store.descarregar(); } else { ultimoTique = Date.now(); marcarUso(); } });
window.addEventListener('pagehide', () => { contarTempo(true); guardarSessaoAberta(); Store.descarregar(); });
window.addEventListener('pageshow', (e) => { if (e.persisted) ultimoTique = Date.now(); });
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => document.addEventListener(ev, marcarUso, { passive: true, capture: true }));
// Rolar dentro da folha ou da sessão também é uso: o evento de rolagem não sobe, mas passa pela captura no documento
document.addEventListener('scroll', marcarUso, { passive: true, capture: true });
setInterval(() => contarTempo(false), TIQUE_S * 1000);
setInterval(atualizarCronometro, 1000);

// Folha de véspera: os itens errados que ainda não foram acertados depois, por disciplina, com gabarito e comentário,
// para reler antes da prova. Interpretação de texto fica de fora: o texto não volta na prova.
function abrirFolhaVespera() {
  const erradas = Q.filter((q) => { const r = rec(q.id); return r && r[3] > 0 && !(r[0] > 0) && !SEM_REPETICAO.has(q.id); });
  if (!erradas.length) { avisar('!', 'Nenhum erro por recuperar', 'Cada item que você errou já foi acertado depois.'); return; }
  const porDisc = {};
  for (const q of erradas) (porDisc[(BI.get(q.b) || {}).disciplina || 'outros'] ||= []).push(q);
  let html = '<div class="folha-impressao"><p class="pequeno mudo">Revisão final · ' + pl(erradas.length, 'item errado ainda não recuperado', 'itens errados ainda não recuperados') + '</p>';
  for (const [disc, qs] of Object.entries(porDisc)) {
    html += '<h2>' + esc((DI.get(disc) || { nome: disc }).nome) + ' (' + qs.length + ')</h2>';
    for (const q of qs) {
      html += '<div class="folha-item"><div class="folha-meta">' + esc(nomeBloco(q.b)) + ' · ' + esc(q.r || '') + ' · Gabarito: <b>' + esc(nomeGab(q)) + '</b> · armadilha: ' + esc(D.armadilhas[q.a] || q.a) + '</div>' +
        '<p class="folha-enunciado">' + esc(q.e) + '</p>' +
        (q.c ? '<p class="pequeno mudo"><em>' + esc(q.c) + '</em></p>' : '') + '</div>';
    }
  }
  abrirFolha(cabFolha('Seus erros', 'Folha de véspera') + html + '</div>', 'Folha de véspera');
}

/* ================= Início ================= */
function iniciar(dadosQuentes) {
  if (dadosQuentes && dadosQuentes.sessao) { sessao = dadosQuentes.sessao; if (dadosQuentes.ui) Object.assign(UI, dadosQuentes.ui); }
  if (!VISTAS.includes(UI.vista)) UI.vista = 'hoje';
  // A cópia deste navegador entra antes da primeira tela: nada é desenhado (nem gravado) com o progresso zerado
  if (!Store.localLido) Store.carregarLocal();
  renderTudo();
  if (sessao) abrirSessao();
  Store.iniciar();
}
const hot = window.claude && window.claude.hot;
if (hot && typeof hot.snapshot === 'function') {
  try { hot.snapshot(() => ({ sessao: sessao && !sessao.fim ? sessao : null, ui: { vista: UI.vista, artSel: UI.artSel, mais: UI.mais } })); } catch (e) { /* opcional */ }
}
if (hot && typeof hot.ready === 'function') hot.ready(iniciar);
else iniciar(hot && hot.data ? hot.data : {});
})().catch((e) => console.error('Falha ao abrir o painel', e));
