// Cronômetro da leitura: na lei seca e nas aulas aparece o tempo de leitura do dia, que corre enquanto conta, pausa
// sem uso e entra no relógio do dia como Leitura.
import { APP, abrirNavegador, foto, placar, vigiarErros } from './comum.mjs';

const browser = await abrirNavegador();
const { conferir, fim } = placar();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.clock.install({ time: new Date() });
const p = await ctx.newPage();
const erros = [];
vigiarErros(p, erros);
await p.goto(APP);
await p.waitForTimeout(500);

const crono = p.locator('#cronometro');
const segundos = async () => { const m = /(\d+):(\d\d)/.exec((await crono.textContent()) || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : -1; };
await p.clock.runFor(2000);
conferir('no painel, o cronômetro fica escondido', await crono.isHidden());

await p.click('.aba[data-vista="lei"]');
await p.clock.runFor(61000);
conferir('na lei seca, o cronômetro aparece', await crono.isVisible(), await crono.textContent());
const s1 = await segundos();
conferir('um minuto lendo vira cerca de 1:00', s1 >= 55 && s1 <= 75, String(s1));
await p.screenshot({ path: foto('cronometro-lei.png') });

// Abre um artigo (leitura também): rolar conta como uso
await p.locator('[data-acao="art-inline"], [data-acao="abrir-art"]').first().click().catch(() => {});
await p.clock.runFor(30000);
const s2 = await segundos();
conferir('o tempo continua correndo', s2 > s1, s1 + ' → ' + s2);

// Cinco minutos sem tocar: pausa
await p.clock.runFor(330000);
conferir('sem uso por mais de 5 minutos, pausa', /pausado/.test((await crono.textContent()) || ''), await crono.textContent());
const s3 = await segundos();
await p.clock.runFor(60000);
conferir('pausado, não conta', (await segundos()) === s3, s3 + ' → ' + (await segundos()));
await p.mouse.wheel(0, 200);
await p.clock.runFor(20000);
conferir('rolar a tela retoma', !/pausado/.test((await crono.textContent()) || '') && (await segundos()) > s3);

// Aula da trilha: também é leitura
await p.click('[data-acao="fechar-folha"]').catch(() => {});
await p.click('.aba[data-vista="mais"]');
await p.click('[data-acao="mais"][data-sub="menu"]').catch(() => {});
await p.click('.menu-mais [data-sub="trilha"]');
await p.locator('#vista-mais [data-acao="subtema"]').first().click();
await p.clock.runFor(16000);
conferir('na aula da trilha, o cronômetro aparece', await crono.isVisible());

// O relógio do dia registra a leitura
await p.click('.aba[data-vista="hoje"]');
await p.clock.runFor(1500);
conferir('de volta ao painel, o cronômetro some', await crono.isHidden());
const det = p.locator('.det-tempo');
await det.locator('summary').click();
const leg = ((await det.textContent()) || '').replace(/\s+/g, ' ');
conferir('o tempo de estudo do dia mostra a leitura', /Leitura [1-9]\d* min/.test(leg), (/Leitura [^A-Z]*/.exec(leg) || [''])[0]);

// Relógio atrasado pelo navegador (tiques espaçados) com uso recente: o intervalo inteiro conta, não só 30 s
const leitura = () => p.evaluate(() => (JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.dias || {})[Object.keys(JSON.parse(localStorage.getItem('painel-anpd-v3')).perfil.dias).sort().pop()].t.l || 0);
await p.click('.aba[data-vista="lei"]');
await p.clock.runFor(16000);
await p.evaluate(() => window.dispatchEvent(new Event('pagehide')));
const l1 = await leitura();
await p.mouse.wheel(0, 100);
await p.clock.setSystemTime((await p.evaluate(() => Date.now())) + 120000);
await p.mouse.wheel(0, 100);
await p.clock.runFor(15000);
await p.evaluate(() => window.dispatchEvent(new Event('pagehide')));
const l2 = await leitura();
conferir('tiques atrasados com uso recente contam o intervalo inteiro', l2 - l1 >= 120, l1 + ' → ' + l2);

// Item revisado, termo ou Investigar na folha: também é leitura
await p.click('.aba[data-vista="mais"]');
await p.click('[data-acao="mais"][data-sub="menu"]').catch(() => {});
await p.click('.menu-mais [data-sub="glossario"]');
await p.click('.aba[data-vista="hoje"]');
await p.evaluate(() => { document.querySelector('[data-acao="investigar"]') ? document.querySelector('[data-acao="investigar"]').click() : null; });
await p.waitForTimeout(100);
if (await p.locator('#folha:not([hidden])').count()) {
  await p.mouse.wheel(0, 50);
  await p.clock.runFor(31000);
  conferir('com a folha aberta, o cronômetro mostra leitura', await crono.isVisible() && /Leitura/.test((await crono.textContent()) || ''), await crono.textContent());
} else conferir('abriu a folha do Investigar', false);

await browser.close();
fim(erros);
