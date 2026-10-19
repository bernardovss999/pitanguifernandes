/* Testes de regressão do site (Playwright, sem framework).
   Rodar: npm test   (ou: node tests/regression.js)
   Sobe um servidor estático da raiz do repositório e verifica, em celular e desktop,
   tudo o que já quebrou ou foi pedido explicitamente. Sai com código 1 se algo falhar. */
const http = require('http'), fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const ROOT = path.join(__dirname, '..');
const PAGES = ['index', 'governanca', 'metodo', 'planos', 'familia', 'compromissos', 'contato', 'privacidade', '404'];
const MOBILE = { width: 390, height: 844 }, SMALL = { width: 360, height: 740 }, DESKTOP = { width: 1440, height: 900 };
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.xml': 'application/xml', '.txt': 'text/plain' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (f.endsWith('/')) f += 'index.html';
      fs.readFile(f, (err, buf) => {
        if (err) { rsp.writeHead(404); rsp.end('nf'); return; }
        rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); rsp.end(buf);
      });
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

const results = [];
async function test(name, fn) {
  try { await fn(); results.push([true, name]); console.log('  ✓ ' + name); }
  catch (e) { results.push([false, name, e.message]); console.log('  ✗ ' + name + '\n      ' + e.message.split('\n')[0]); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }
function overlap(a, b) { return a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height; }

(async () => {
  const srv = await serve(); const U = 'http://127.0.0.1:' + srv.address().port + '/';
  const px = process.env.HTTPS_PROXY ? process.env.HTTPS_PROXY.replace(/^https?:\/\//, '') : null;
  const browser = await chromium.launch(px ? { args: ['--proxy-server=https=' + px, '--proxy-bypass-list=localhost;127.0.0.1'] } : {});
  const ctx = (vp, mobile) => browser.newContext({ viewport: vp, isMobile: !!mobile, hasTouch: !!mobile });
  async function open(c, page, wait) {
    const p = await c.newPage(); p.errors = [];
    p.on('pageerror', e => p.errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) p.errors.push(m.text()); });
    await p.goto(U + page, { waitUntil: 'load' }); await p.waitForTimeout(wait == null ? 800 : wait);
    return p;
  }

  console.log('\nCabeçalho e abertura no celular');
  for (const vp of [MOBILE, SMALL]) {
    const c = await ctx(vp, true); const p = await open(c, 'index.html', 4800);
    await test(`${vp.width}px: logo do cabeçalho visível, WhatsApp e menu sem sobreposição`, async () => {
      const r = await p.evaluate(() => {
        const box = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: b.x, y: b.y, width: b.width, height: b.height, vis: cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > .9 }; };
        return { brand: box('.hdr .brand svg'), lock: box('.hdr .brand .lock'), wa: box('.hdr .hwa'), burger: box('#burger'), vw: innerWidth };
      });
      ok(r.brand && r.brand.vis && r.brand.width >= 24, 'monograma do cabeçalho invisível');
      ok(r.lock && r.lock.vis, 'nome da marca invisível no cabeçalho');
      ok(r.wa && r.wa.vis && r.wa.width >= 40 && r.wa.height >= 40, 'ícone do WhatsApp ausente no cabeçalho (ou menor que 40px)');
      ok(r.burger && r.burger.vis, 'botão do menu ausente');
      ok(!overlap(r.lock, r.wa) && !overlap(r.wa, r.burger) && !overlap(r.lock, r.burger), 'elementos do cabeçalho se sobrepõem');
      ok(r.burger.x + r.burger.width <= r.vw + 1, 'menu sai da tela');
    });
    await test(`${vp.width}px: arte 3D do monograma no alto da primeira tela, com as cotas`, async () => {
      const r = await p.evaluate(() => {
        const h = document.querySelector('.hart'), hd = document.querySelector('.hdr'), c = document.querySelector('.hart .hcota');
        const b = h.getBoundingClientRect(), hb = hd.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, w: b.width, hdrBottom: hb.bottom, cota: getComputedStyle(c).display, cotaOp: +getComputedStyle(c.querySelector('path')).strokeOpacity, vh: innerHeight };
      });
      ok(r.w >= vp.width * .5, `arte pequena demais (${Math.round(r.w)}px)`);
      ok(r.top < r.vh * .2 && r.bottom < r.vh * .6, `arte fora do alto da tela (top ${Math.round(r.top)}, bottom ${Math.round(r.bottom)})`);
      ok(r.bottom > r.hdrBottom + 60, 'arte escondida atrás do cabeçalho');
      ok(r.cota !== 'none' && r.cotaOp > .3, 'cotas (linhas de medida) escondidas no celular');
    });
    await test(`${vp.width}px: título da abertura visível na primeira tela`, async () => {
      const t = await p.evaluate(() => document.querySelector('#h-hero').getBoundingClientRect().top);
      ok(t < vp.height - 80, `título começa em ${Math.round(t)}px`);
    });
    await test(`${vp.width}px: balão do WhatsApp aparece, fecha e não volta na mesma sessão`, async () => {
      await p.waitForTimeout(1500);
      const shown = await p.evaluate(() => { const e = document.querySelector('.wa-pop'); return !!e && e.classList.contains('show') && getComputedStyle(e).visibility === 'visible'; });
      ok(shown, 'balão não apareceu');
      const inView = await p.evaluate(() => { const b = document.querySelector('.wa-pop').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight; });
      ok(inView, 'balão sai da tela');
      await p.click('.wa-x'); await p.waitForTimeout(500);
      ok(!(await p.evaluate(() => document.querySelector('.wa-pop').classList.contains('show'))), 'balão não fechou');
      await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(6500);
      ok(!(await p.evaluate(() => document.querySelector('.wa-pop').classList.contains('show'))), 'balão voltou depois de fechado');
    });
    await test(`${vp.width}px: sem erros no console`, async () => ok(!p.errors.length, p.errors.join(' | ')));
    await c.close();
  }

  console.log('\nTodas as páginas');
  for (const [vp, m] of [[SMALL, true], [MOBILE, true], [DESKTOP, false]]) {
    const c = await ctx(vp, m);
    await test(`${vp.width}px: nenhuma página com rolagem horizontal, erro ou h1 duplicado`, async () => {
      const bad = [];
      for (const pg of PAGES) {
        const p = await open(c, pg + '.html', 300);
        const r = await p.evaluate(w => ({ ov: Math.max(document.documentElement.scrollWidth, innerWidth) - w, h1: document.querySelectorAll('h1').length, wa: !!document.querySelector('.hdr .hwa') }), vp.width);
        if (r.ov > 0) bad.push(`${pg}: página ${r.ov}px mais larga que a tela`);
        if (r.h1 !== 1) bad.push(`${pg}: ${r.h1} h1`);
        if (!r.wa) bad.push(`${pg}: sem WhatsApp no cabeçalho`);
        if (p.errors.length) bad.push(`${pg}: ${p.errors[0]}`);
        await p.close();
      }
      ok(!bad.length, bad.join('; '));
    });
    await c.close();
  }

  console.log('\nInterações');
  {
    const c = await ctx(MOBILE, true); const p = await open(c, 'index.html', 4800);
    await test('menu do celular abre, fecha e responde ao Esc', async () => {
      await p.evaluate(() => document.getElementById('burger').click()); await p.waitForTimeout(400);
      ok(await p.evaluate(() => document.body.classList.contains('menu-open')), 'menu não abriu');
      await p.keyboard.press('Escape'); await p.waitForTimeout(400);
      ok(!(await p.evaluate(() => document.body.classList.contains('menu-open'))), 'Esc não fechou o menu');
    });
    await test('cabeçalho toma o tom da seção ao rolar', async () => {
      await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, document.getElementById('a-casa').offsetTop + 200); }); await p.waitForTimeout(500);
      const w = await p.evaluate(() => document.querySelector('.hdr').getAttribute('data-tone'));
      await p.evaluate(() => scrollTo(0, document.getElementById('o-nome').offsetTop + 200)); await p.waitForTimeout(500);
      const d = await p.evaluate(() => document.querySelector('.hdr').getAttribute('data-tone'));
      ok(w === 'white' && d === 'dark', `tons: ${w} / ${d}`);
    });
    await c.close();
  }
  {
    const c = await ctx(MOBILE, true); const p = await open(c, 'planos.html');
    await test('planos mostram as três mensalidades', async () => {
      const t = await p.evaluate(() => [...document.querySelectorAll('.plan .price b')].map(b => b.textContent));
      ok(t.join(',') === '790,1.690,3.500', 'valores: ' + t.join(','));
    });
    await test('comparativo no celular mostra um plano por vez', async () => {
      await p.evaluate(() => document.querySelector('.mx-seg button.p3').click());
      const r = await p.evaluate(() => ({ show: document.querySelector('.mx-wrap').getAttribute('data-show'), vis: [...document.querySelectorAll('.mx td')].filter(t => t.offsetParent).length }));
      ok(r.show === 'Concierge' && r.vis === 44, JSON.stringify(r));
    });
    await c.close();
  }
  {
    const c = await ctx(DESKTOP);
    /* o WhatsApp de verdade não é aberto no teste: registramos o endereço que o site tentaria abrir */
    await c.addInitScript(() => { window.open = u => { window.__opened = String(u); return null; }; });
    const p = await open(c, 'contato.html?plano=Premium');
    await test('formulário: valida, abre o WhatsApp e confirma com título legível', async () => {
      ok((await p.inputValue('#msg')) === 'Tenho interesse no plano Premium.', 'plano não veio para a mensagem');
      await p.click('button[type=submit]');
      ok((await p.evaluate(() => [...document.querySelectorAll('.f .msg')].filter(m => m.textContent).length)) >= 2, 'erros não apareceram');
      await p.fill('#nome', 'Teste'); await p.fill('#tel', '21967072931');
      await p.click('button[type=submit]'); await p.waitForTimeout(400);
      const url = await p.evaluate(() => window.__opened || '');
      ok(/wa\.me\/5521967072931\?text=/.test(url), 'WhatsApp não abriu: ' + url);
      ok(await p.evaluate(() => getComputedStyle(document.getElementById('done')).display !== 'none'), 'confirmação não apareceu');
      const col = await p.evaluate(() => getComputedStyle(document.querySelector('#done .h3')).color);
      ok(col !== 'rgb(255, 255, 255)', 'título da confirmação branco sobre branco');
    });
    await c.close();
  }
  {
    const c = await browser.newContext({ viewport: MOBILE, reducedMotion: 'reduce' }); const p = await open(c, 'index.html', 600);
    await test('movimento reduzido: nada fica escondido', async () => {
      const n = await p.evaluate(() => [...document.querySelectorAll('[data-r],[data-h]')].filter(e => +getComputedStyle(e).opacity < .5).length);
      ok(n === 0, n + ' elementos escondidos');
    });
    await c.close();
  }

  await browser.close(); srv.close();
  const fail = results.filter(r => !r[0]);
  console.log(`\n${results.length - fail.length}/${results.length} testes passaram`);
  process.exit(fail.length ? 1 : 0);
})();
