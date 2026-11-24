// Sincronização entre a conta (banco simulado em window.claude) e a cópia do navegador: nenhum cenário pode perder
// progresso nem preferências. Foi escrito para a perda de dados da versão 18 e falha nela.
import { APP, abrirNavegador, diaDeEstudo, placar } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, fim } = placar();

const DIA = Math.round(Date.UTC(2026, 9, 6) / 86400000);
function perfil(o) { return Object.assign({ xp: 0, meta: 30, novosCards: 20, intercaladas: 30, melhorSeq: 0, dias: {}, conq: {}, recordes: { combo: 0, relampago: 0 }, status: {}, feitos: {}, lidos: {}, saidos: 0, criado: '2026-08-01' }, o); }

// Mesmo espalhamento do app (hashTxt % 4): cada resposta vai para a sua parte do histórico (itens0 a itens3)
function emPartes(q) {
  const out = { itens0: { q: {} }, itens1: { q: {} }, itens2: { q: {} }, itens3: { q: {} } };
  for (const [id, r] of Object.entries(q)) { let h = 2166136261; for (const c of id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } out['itens' + ((h >>> 0) % 4)].q[id] = r; }
  return out;
}

// nuvem: { perfil, itens0..itens3, ... } (dados) com t; local: objeto do localStorage ou null; ui: CHAVE_UI ou null
async function cenario(nome, { nuvem, tNuvem, local, ui, atrasoMs = 0, acao, epNuvem }, verificar) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await diaDeEstudo(ctx);
  await ctx.addInitScript(({ nuvem, tNuvem, local, ui, atrasoMs, epNuvem }) => {
    if (!sessionStorage.getItem('semeado')) {
      sessionStorage.setItem('semeado', '1');
      localStorage.clear();
      if (local) localStorage.setItem('painel-anpd-v3', JSON.stringify(local));
      if (ui) localStorage.setItem('painel-anpd-ui', JSON.stringify(ui));
    }
    window.__nuvem = JSON.parse(JSON.stringify(nuvem));
    window.__sets = [];
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    // Como no claude.ai: o documento lido do banco vem congelado, inclusive por dentro
    const congelar = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(congelar); Object.freeze(o); } return o; };
    const doc = (n) => ({
      get: async () => { await espera(atrasoMs); const d = window.__nuvem[n]; return { exists: !!d, data: () => (d ? congelar({ dev: 'outro', t: tNuvem, v: 3, ep: epNuvem || 0, dados: JSON.parse(JSON.stringify(d)) }) : null) }; },
      set: async (v) => { window.__sets.push(n); window.__nuvem[n] = JSON.parse(JSON.stringify(v.dados)); },
      onSnapshot: () => () => {},
    });
    const vazio = { get: async () => ({ docs: [] }), where: () => vazio, doc };
    window.claude = { use: async (nome) => (nome === 'db' ? { collection: () => vazio } : nome === 'user' ? { id: async () => 'u1' } : null) };
  }, { nuvem, tNuvem, local, ui, atrasoMs, epNuvem });
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  await p.goto(APP);
  if (acao) await acao(p);
  await p.waitForTimeout(atrasoMs + 2500);
  const r = await p.evaluate(() => ({ nuvem: window.__nuvem, sets: window.__sets, local: JSON.parse(localStorage.getItem('painel-anpd-v3') || 'null'), ui: JSON.parse(localStorage.getItem('painel-anpd-ui') || 'null'), tema: document.documentElement.dataset.tema || '' }));
  // O histórico das questões fica em quatro partes (itens0 a itens3)
  r.itensConta = Object.assign({}, ...['itens0', 'itens1', 'itens2', 'itens3'].map((n) => (r.nuvem[n] && r.nuvem[n].q) || {}));
  console.log('\n# ' + nome + ' (gravou na conta: ' + ([...new Set(r.sets)].join(',') || 'nada') + ')');
  await verificar(r, p);
  conferir('sem erro de página', !erros.length, erros.join(' | '));
  await ctx.close();
}

const agora = Date.now();
const nuvemBase = {
  perfil: perfil({ xp: 500, meta: 60, intercaladas: 40, status: { 'lgpd-55': 'dominado' }, feitos: { '2026-09-01': 1 }, conq: { primeira: '2026-08-02' }, dias: { '2026-10-01': { r: 30, c: 20, e: 10, b: 0, xp: 200, k: 0, n: 0, a: [] } }, ui: { modo: 'simulado', n: 40, filtro: 'erradas', prova: 'blocos', blocos: ['lgpd-55'], blocosCards: [], camadas: { cai: true, num: false, alerta: true, verbo: true, erro: true }, lei: 'lgpd', tema: 'escuro' } }),
  ...emPartes({ 'l1-01': [3, DIA + 7, 3, 0, DIA - 2, 0, 0], 'l1-02': [0, DIA + 1, 0, 1, DIA - 1, 0, 0] }),
  cards: { c: {} }, simulados: { lista: [{ data: '2026-10-01', n: 60, c: 40, e: 10, b: 10, liq: 30, seg: 3000, titulo: 'Simulado' }] }, pesquisa: { p: {} }, discursivas: { d: {} },
};

// 1) Navegador limpo (app do Claude, outro aparelho, versão nova) e toque antes de a conta carregar
await cenario('Navegador limpo + toque no tema antes de carregar a conta', {
  nuvem: nuvemBase, tNuvem: agora - 3600e3, local: null, ui: null, atrasoMs: 1500,
  // O botão de tema fica escondido no topo em celular (segue em Ajustes); o clique direto mantém o toque antes da conta
  acao: async (p) => { await p.waitForTimeout(200); await p.evaluate(() => { const b = document.querySelector('[data-acao="tema-alternar"]'); if (b) b.click(); }); },
}, (r) => {
  conferir('meta da conta mantida (60)', r.nuvem.perfil.meta === 60, 'meta=' + r.nuvem.perfil.meta);
  conferir('intercaladas mantidas (40)', r.nuvem.perfil.intercaladas === 40);
  conferir('XP da conta mantido (500)', r.nuvem.perfil.xp >= 500, 'xp=' + r.nuvem.perfil.xp);
  conferir('status do bloco mantido', r.nuvem.perfil.status['lgpd-55'] === 'dominado');
  conferir('dia do plano marcado mantido', r.nuvem.perfil.feitos['2026-09-01'] === 1);
  conferir('respostas da conta mantidas', !!r.itensConta['l1-01'] && !!r.itensConta['l1-02']);
  conferir('simulado mantido', r.nuvem.simulados.lista.length === 1);
  conferir('preferências da conta aplicadas (blocos)', JSON.stringify(r.ui.blocos) === '["lgpd-55"]', JSON.stringify(r.ui.blocos));
  conferir('preferências da conta aplicadas (quantidade e filtro)', r.ui.n === 40 && r.ui.filtro === 'erradas');
  conferir('preferência guardada na conta', r.nuvem.perfil.ui && r.nuvem.perfil.ui.n === 40);
});

// 1b) Navegador limpo e resposta a uma questão antes de a conta carregar
await cenario('Navegador limpo + responde questão antes de carregar a conta', {
  nuvem: nuvemBase, tNuvem: agora - 3600e3, local: null, ui: null, atrasoMs: 2500,
  acao: async (p) => {
    await p.waitForTimeout(300);
    await p.click('[data-acao="iniciar-dia"]');
    await p.waitForSelector('#sessao:not([hidden])');
    if (await p.locator('button.alt').count()) await p.locator('button.alt').first().click(); else await p.click('.bolha.c');
    await p.waitForSelector('.veredito');
    await p.click('[data-acao="proximo"]');
    await p.click('[data-acao="sair-sessao"]').catch(() => {});
  },
}, (r) => {
  conferir('meta da conta mantida (60)', r.nuvem.perfil.meta === 60, 'meta=' + r.nuvem.perfil.meta);
  conferir('XP da conta mantido (>= 500)', r.nuvem.perfil.xp >= 500, 'xp=' + r.nuvem.perfil.xp);
  conferir('status do bloco mantido', r.nuvem.perfil.status['lgpd-55'] === 'dominado');
  conferir('dia do plano marcado mantido', r.nuvem.perfil.feitos['2026-09-01'] === 1);
  conferir('respostas antigas mantidas', !!r.itensConta['l1-01'] && !!r.itensConta['l1-02']);
  conferir('resposta nova registrada', Object.keys(r.itensConta).length >= 3, Object.keys(r.itensConta).length + ' itens');
});

// 2) Navegador com cópia antiga; a conta é mais nova
await cenario('Navegador com cópia antiga, conta mais nova', {
  nuvem: nuvemBase, tNuvem: agora - 3600e3,
  local: { perfil: perfil({ xp: 100, meta: 20, ui: { n: 10, blocos: ['lgpd-5-11'], tema: 'claro' } }), itens: { 'l1-03': [1, DIA + 1, 1, 0, DIA - 5, 0, 0] }, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: { perfil: agora - 86400e3, itens: agora - 86400e3, cards: agora - 86400e3, simulados: agora - 86400e3, pesquisa: agora - 86400e3, discursivas: agora - 86400e3 } },
  ui: { vista: 'hoje', n: 10, blocos: ['lgpd-5-11'], tema: 'claro' },
}, (r) => {
  conferir('meta da conta prevalece (60)', r.nuvem.perfil.meta === 60 && r.local.perfil.meta === 60);
  conferir('XP = maior das duas (500)', r.nuvem.perfil.xp === 500);
  conferir('respostas unidas (conta + navegador)', ['l1-01', 'l1-02', 'l1-03'].every((k) => r.itensConta[k]));
  conferir('preferências da conta prevalecem (n=40, tema escuro)', r.ui.n === 40 && r.tema === 'escuro', 'n=' + r.ui.n + ' tema=' + r.tema);
});

// 3) Navegador mais novo que a conta (uma gravação na conta falhou)
await cenario('Navegador mais novo que a conta', {
  nuvem: nuvemBase, tNuvem: agora - 86400e3,
  local: { perfil: perfil({ xp: 650, meta: 90, status: { 'lgpd-55': 'revisar' }, ui: { n: 60, blocos: ['res-4-2023'], tema: 'claro' } }), itens: { 'l1-01': [4, DIA + 15, 4, 0, DIA, 0, 0] }, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: { perfil: agora - 600e3, itens: agora - 600e3, cards: agora - 600e3, simulados: agora - 600e3, pesquisa: agora - 600e3, discursivas: agora - 600e3 } },
  ui: { vista: 'hoje', n: 60, blocos: ['res-4-2023'], tema: 'claro' },
}, (r) => {
  conferir('meta do navegador prevalece (90)', r.nuvem.perfil.meta === 90);
  conferir('status do navegador prevalece', r.nuvem.perfil.status['lgpd-55'] === 'revisar');
  conferir('XP = 650', r.nuvem.perfil.xp === 650);
  conferir('registro mais recente do item (nível 4)', r.itensConta['l1-01'][0] === 4);
  conferir('item só da conta mantido', !!r.itensConta['l1-02']);
  conferir('simulado da conta mantido', r.nuvem.simulados.lista.length === 1);
  conferir('preferências do navegador prevalecem (n=60)', r.ui.n === 60 && r.nuvem.perfil.ui.n === 60);
});

// 4) Progresso zerado em outro aparelho (época nova na conta): a cópia antiga do navegador não ressuscita
await cenario('Conta zerada em outro aparelho', {
  nuvem: Object.assign({}, nuvemBase, { perfil: perfil({ xp: 0, meta: 60, ep: agora - 7200e3 }), ...emPartes({}), simulados: { lista: [] } }), tNuvem: agora - 3600e3, epNuvem: agora - 7200e3,
  local: { perfil: perfil({ xp: 900 }), itens: { 'l1-09': [2, DIA + 3, 2, 0, DIA - 3, 0, 0] }, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: { perfil: agora - 86400e3 } },
}, (r) => {
  conferir('XP zerado continua zerado', r.nuvem.perfil.xp === 0 && r.local.perfil.xp === 0, 'nuvem=' + r.nuvem.perfil.xp + ' local=' + r.local.perfil.xp);
  conferir('respostas antigas não voltam', !r.itensConta['l1-09'] && !r.local.itens['l1-09']);
});

// 5) Primeira abertura com esta versão: a conta não tem preferências, o navegador tem
await cenario('Conta sem preferências, navegador com preferências', {
  nuvem: Object.assign({}, nuvemBase, { perfil: perfil({ xp: 500, meta: 60 }) }), tNuvem: agora - 3600e3,
  local: { perfil: perfil({ xp: 500, meta: 60 }), itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: { perfil: agora - 86400e3 } },
  ui: { vista: 'hoje', modo: 'treino', n: 30, filtro: 'novas', prova: 'blocos', blocos: ['lgpd-33-36', 'res-19-2024'], blocosCards: [], tema: 'escuro' },
}, (r) => {
  conferir('preferências do navegador sobem para a conta', r.nuvem.perfil.ui && r.nuvem.perfil.ui.n === 30 && JSON.stringify(r.nuvem.perfil.ui.blocos) === '["lgpd-33-36","res-19-2024"]', JSON.stringify(r.nuvem.perfil.ui));
  conferir('preferências do navegador continuam valendo', r.ui.n === 30 && r.tema === 'escuro');
});

// 6) A conta é mais nova e já tem o dia de hoje: o que se faz depois de abrir (ler um artigo, fechar um dia) fica
// guardado, mesmo com o documento da conta congelado
const hojeLocal = await (async () => { const c = await browser.newContext(); await diaDeEstudo(c); const pg = await c.newPage(); const h = await pg.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }); await c.close(); return h; })();
await cenario('Conta mais nova com o dia de hoje: leitura e baixa de dia ficam guardadas', {
  nuvem: Object.assign({}, nuvemBase, { perfil: perfil({ xp: 500, meta: 60, feitos: { '2026-09-01': 1 }, lidos: { 'lgpd:5': '2026-09-01' }, dias: { [hojeLocal]: { r: 3, c: 2, e: 1, b: 0, xp: 20, k: 0, n: 0, a: [] } } }) }), tNuvem: agora - 60e3,
  local: { perfil: perfil({ xp: 100 }), itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: { perfil: agora - 86400e3 } },
  acao: async (p) => {
    await p.waitForTimeout(800);
    await p.click('.aba[data-vista="lei"]');
    await p.locator('#vista-lei [data-acao="abrir-art"]').first().click();
    await p.click('.aba[data-vista="mais"]');
    await p.click('.menu-mais [data-sub="plano"]');
    await p.locator('#vista-mais input[data-acao="dia-feito"]:not(:checked)').first().click();
  },
}, async (r, p) => {
  const novo = Object.keys(r.local.perfil.lidos || {}).find((k) => k !== 'lgpd:5');
  conferir('o artigo lido entrou em lidos', !!novo, JSON.stringify(r.local.perfil.lidos));
  conferir('e no registro do dia', ((r.local.perfil.dias[hojeLocal] || {}).a || []).includes(novo), JSON.stringify(r.local.perfil.dias[hojeLocal]));
  conferir('o dia marcado como feito ficou feito', Object.keys(r.local.perfil.feitos).length > 1, JSON.stringify(r.local.perfil.feitos));
  conferir('a conta recebeu a leitura', !!((r.nuvem.perfil.lidos || {})[novo]));
  const erros = await p.evaluate(() => (JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.erros || []).map((e) => e.m));
  conferir('nenhum erro guardado no diagnóstico', !erros.length, erros.join(' | '));
});

// Discursiva escrita em dois aparelhos: a conta é a cópia mais nova como um todo, mas o tema T1 foi mexido por último
// no navegador. Vale o rascunho mais recente de cada tema, e as tentativas dos dois lados ficam
{
  const tl = (x) => ({ perfil: x, itens: x, cards: x, simulados: x, pesquisa: x, discursivas: x });
  await cenario('Discursiva em dois aparelhos: rascunho mais recente por tema e tentativas unidas', {
    nuvem: Object.assign({}, nuvemBase, { discursivas: { d: {
      T1: { rascunho: 'texto antigo da conta', ts: agora - 7200e3, tentativas: [{ d: '2026-10-01', nc: 5, ne: 2, tl: 20, nq: 4.8 }] },
      T2: { rascunho: 'só na conta', ts: agora - 3600e3, tentativas: [] },
      T3: { rascunho: 'sem marca, da conta', tentativas: [] },
    } } }), tNuvem: agora - 600e3,
    local: { perfil: perfil({ xp: 100 }), itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {
      T1: { rascunho: 'texto novo do navegador', ts: agora - 1800e3, tentativas: [{ d: '2026-10-03', nc: 6, ne: 1, tl: 22, nq: 5.9 }, { d: '2026-10-01', nc: 5, ne: 2, tl: 20, nq: 4.8 }] },
      T3: { rascunho: '', tentativas: [] },
    }, t: tl(agora - 86400e3) },
  }, (r) => {
    const d = r.nuvem.discursivas.d, l = r.local.disc;
    conferir('T1: fica o rascunho mexido por último (o do navegador)', d.T1.rascunho === 'texto novo do navegador' && l.T1.rascunho === 'texto novo do navegador', d.T1.rascunho);
    conferir('T1: tentativas dos dois aparelhos, sem repetir, a mais recente primeiro', d.T1.tentativas.length === 2 && d.T1.tentativas[0].d === '2026-10-03', JSON.stringify(d.T1.tentativas));
    conferir('T2: o tema que só existe na conta chega ao navegador', l.T2 && l.T2.rascunho === 'só na conta');
    conferir('T3: sem marca de hora, o texto em branco não apaga o do outro', d.T3.rascunho === 'sem marca, da conta' && l.T3.rascunho === 'sem marca, da conta');
  });

  // Recomeço do plano e dia dispensado feitos em outro aparelho chegam aqui; o dia dispensado aqui não se perde
  const rc = { de: '2026-10-01', para: '2026-10-06', em: '2026-10-06', pular: [] };
  await cenario('Recomeço e dia dispensado em outro aparelho', {
    nuvem: Object.assign({}, nuvemBase, { perfil: perfil({ xp: 500, recomecos: [rc], dispensados: { '2026-09-02': 1 } }) }), tNuvem: agora - 600e3,
    local: { perfil: perfil({ xp: 100, dispensados: { '2026-09-03': 1 } }), itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: tl(agora - 86400e3) },
  }, (r) => {
    conferir('o recomeço feito no outro aparelho chega ao navegador', (r.local.perfil.recomecos || []).length === 1 && r.local.perfil.recomecos[0].para === rc.para, JSON.stringify(r.local.perfil.recomecos));
    conferir('dias dispensados nos dois aparelhos ficam todos', ['2026-09-02', '2026-09-03'].every((k) => r.local.perfil.dispensados[k] && r.nuvem.perfil.dispensados[k]), JSON.stringify(r.local.perfil.dispensados));
  });
  await cenario('Navegador mais novo sem recomeço: o da conta continua valendo', {
    nuvem: Object.assign({}, nuvemBase, { perfil: perfil({ xp: 500, recomecos: [rc] }) }), tNuvem: agora - 86400e3,
    local: { perfil: perfil({ xp: 650 }), itens: {}, cards: {}, simulados: [], pesquisa: {}, disc: {}, t: tl(agora - 600e3) },
  }, (r) => {
    conferir('o recomeço da conta não some', (r.local.perfil.recomecos || []).length === 1 && (r.nuvem.perfil.recomecos || []).length === 1, JSON.stringify(r.local.perfil.recomecos));
  });
}

await browser.close();
console.log('');
fim();
