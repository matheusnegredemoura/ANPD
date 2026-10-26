// Plano encaixado numa prova antes do fim do cronograma: o plano B (prova em fevereiro) sai com um clique e volta ao
// original; com a data do edital antes do fim do plano, o cartão oferece o encaixe, as semanas cortadas ficam gravadas
// e a reta final termina no dia da prova.
import { APP, abrirNavegador, placar, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, passo, fim } = placar();
const erros = [];
const isoMais = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const hoje = isoMais(0);

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForSelector('#vista-hoje .roteiro');
const perfil = () => p.evaluate(() => JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil);
const abrirPlano = async () => {
  await p.click('.aba[data-vista="mais"]');
  if (await p.locator('#vista-mais [data-acao="mais-voltar"]').count()) await p.click('#vista-mais [data-acao="mais-voltar"]');
  await p.click('#vista-mais [data-acao="mais"][data-sub="plano"]');
};
const textoFase = async (f) => {
  if ((await p.getAttribute('[data-acao="fase"][data-fase="' + f + '"]', 'aria-expanded')) !== 'true') await p.click('[data-acao="fase"][data-fase="' + f + '"]');
  return (await p.textContent('#vista-mais .fase-corpo')).replace(/\s+/g, ' ');
};

if (hoje < '2027-02-01') {
  await passo('plano B pronto e trocado com um clique', async () => {
    await abrirPlano();
    const t = (await p.textContent('#vista-mais')).replace(/\s+/g, ' ');
    conferir('cartão do plano B', /Plano B: prova em 28\/02\/2027/.test(t), t.match(/Plano B[^.]{0,120}/)?.[0]);
    const n = Number(t.match(/tira (\d+) semanas? de revisão/)?.[1]);
    conferir('quatro semanas saem', n === 4, String(n));
    await p.click('details[data-det="plano-b"] summary');
    await p.click('[data-acao="plano-b"]');
    const e = (await perfil()).encaixe;
    conferir('encaixe gravado com as semanas cortadas', e && e.prova === '2027-02-28' && e.desde === hoje && e.cortes.length === 4, JSON.stringify(e));
    const f6 = await textoFase('f6');
    conferir('prova no dia 28/02', /Prova \(domingo, 28\/02\)/.test(f6), f6.match(/Prova \([^)]*\)/)?.[0]);
    conferir('nada depois de 28/02', !/2[2-8]\/03|0[1-9]\/03 a/.test(f6), f6.match(/\d\d\/03[^ ]*/)?.[0]);
    conferir('semanas renumeradas, sem a 25', !/Semana 25/.test(f6) && /Semana 20/.test(f6));
    const c = (await p.textContent('#vista-mais')).replace(/\s+/g, ' ');
    conferir('cartão do plano encaixado', /Plano encaixado na prova de 28\/02\/2027/.test(c) && /4 semanas saíram/.test(c), c.match(/Plano encaixado[^:]{0,160}/)?.[0]);
    await p.click('.aba[data-vista="hoje"]');
    const h = (await p.textContent('#vista-hoje')).replace(/\s+/g, ' ');
    conferir('contagem até 28/02/2027', /dias até a prova provável, 28\/02\/2027/.test(h) || /28\/02\/2027/.test(h), h.match(/.{4}dias até a prova[^.]*/)?.[0]);
  });

  await passo('volta ao plano original', async () => {
    await abrirPlano();
    await p.click('[data-acao="plano-original"]');
    conferir('encaixe apagado', (await perfil()).encaixe === null);
    const f6 = await textoFase('f6');
    conferir('prova provável de volta a 28/03', /Prova provável \(domingo\)/.test(f6) && /28\/03/.test(f6));
  });
}

await passo('data do edital antes do fim do plano: encaixe na data', async () => {
  const prova = isoMais(60);
  await p.click('.aba[data-vista="mais"]');
  if (await p.locator('#vista-mais [data-acao="mais-voltar"]').count()) await p.click('#vista-mais [data-acao="mais-voltar"]');
  await p.click('#vista-mais [data-acao="mais"][data-sub="ajustes"]');
  await p.waitForSelector('#cartao-edital');
  await p.fill('#ed-prova', prova);
  await p.click('[data-acao="edital-salvar"]');
  await abrirPlano();
  const t = (await p.textContent('#vista-mais')).replace(/\s+/g, ' ');
  conferir('cartão mostra o que sai', /O plano passa da data da prova/.test(t) && /Encaixando, saem \d+ semanas inteiras/.test(t), t.match(/Encaixando[^:]*/)?.[0]);
  conferir('sem plano B quando há edital', !/Plano B: prova/.test(t));
  await p.click('[data-acao="plano-encaixar"]');
  const e = (await perfil()).encaixe;
  conferir('encaixe na data do edital', e && e.prova === prova && e.cortes.length > 0, JSON.stringify(e));
  const t2 = (await p.textContent('#vista-mais')).replace(/\s+/g, ' ');
  conferir('cartão de aviso some depois do encaixe', !/O plano passa da data da prova/.test(t2));
  const dd = prova.slice(8, 10) + '/' + prova.slice(5, 7);
  const fases = await p.$$eval('[data-acao="fase"]', (bs) => bs.map((b) => b.dataset.fase));
  const ult = fases[fases.length - 1];
  const tf = await textoFase(ult);
  conferir('última fase termina com a prova na data', new RegExp('Prova \\([^)]*' + dd + '\\)').test(tf), tf.match(/Prova \([^)]*\)/)?.[0]);
  // Recarregar não muda o plano: as semanas cortadas estão gravadas
  await p.reload();
  await p.waitForSelector('.aba[data-vista="mais"]');
  await p.waitForTimeout(500);
  if (!(await p.locator('#vista-mais .fase').count())) await abrirPlano();
  const tf2 = await textoFase(ult);
  conferir('mesmo plano depois de recarregar', new RegExp('Prova \\([^)]*' + dd + '\\)').test(tf2));
});

conferir('sem erro de página', !erros.length, erros.join(' | '));
await ctx.close();
await browser.close();
fim();
