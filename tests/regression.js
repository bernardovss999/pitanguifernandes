/* Testes de regressão do site (Playwright, sem framework).
   Rodar: npm test   (ou: node tests/regression.js)
   Sobe um servidor estático da raiz do repositório e verifica, em celular e desktop,
   tudo o que já quebrou ou foi pedido explicitamente. Sai com código 1 se algo falhar. */
const fs = require('fs'), path = require('path');
const { serve, launch } = require('./helpers');
const layout = require('./layout');
const PAGES = ['index', 'governanca', 'metodo', 'planos', 'familia', 'compromissos', 'contato', 'privacidade', '404'];
const MOBILE = { width: 390, height: 844 }, SMALL = { width: 360, height: 740 }, DESKTOP = { width: 1440, height: 900 };

const results = [];
async function test(name, fn) {
  try { await fn(); results.push([true, name]); console.log('  ✓ ' + name); }
  catch (e) { results.push([false, name, e.message]); console.log('  ✗ ' + name + '\n      ' + e.message.split('\n')[0]); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }
function overlap(a, b) { return a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height; }

(async () => {
  const srv = await serve(); const U = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await launch();
  const ctx = (vp, mobile) => browser.newContext({ viewport: vp, isMobile: !!mobile, hasTouch: !!mobile });
  async function open(c, page, wait) {
    const p = await c.newPage(); p.errors = [];
    p.on('pageerror', e => p.errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) p.errors.push(m.text()); });
    await p.goto(U + page, { waitUntil: 'load' }); await p.waitForTimeout(wait == null ? 800 : wait);
    return p;
  }

  console.log('\nPublicação');
  await test('o Vercel publica o site como estático (sem script build que exija pasta de saída)', async () => {
    /* o deploy do PR #2 falhou porque package.json ganhou um script "build": o Vercel passou a rodar o build e procurar a pasta public */
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const sc = Object.keys(pkg.scripts || {}).filter(k => ['build', 'vercel-build', 'postinstall', 'prepare'].includes(k));
    ok(!sc.length, 'scripts que o Vercel executaria: ' + sc.join(', '));
    ok(!fs.existsSync(path.join(__dirname, '..', 'vercel.json')) || !JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8')).buildCommand, 'vercel.json define buildCommand');
    for (const f of ['index.html', 'assets/css/site.css', 'assets/js/site.js']) ok(fs.existsSync(path.join(__dirname, '..', f)), f + ' ausente na raiz');
  });

  console.log('\nCabeçalho e abertura no celular');
  for (const vp of [MOBILE, SMALL]) {
    const c = await ctx(vp, true); const p = await open(c, 'index.html', 4800);
    await test(`${vp.width}px: cabeçalho com logo e menu, sem WhatsApp no topo`, async () => {
      const r = await p.evaluate(() => {
        const box = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: b.x, y: b.y, width: b.width, height: b.height, vis: cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > .9 }; };
        return { brand: box('.hdr .brand svg'), lock: box('.hdr .brand .lock'), waTop: !!document.querySelector('.hdr [href*="wa.me"], .hdr .hwa'), burger: box('#burger'), vw: innerWidth };
      });
      ok(r.brand && r.brand.vis && r.brand.width >= 24, 'monograma do cabeçalho invisível');
      ok(r.lock && r.lock.vis, 'nome da marca invisível no cabeçalho');
      ok(!r.waTop, 'há WhatsApp no cabeçalho (deve ficar só o botão do canto inferior direito)');
      ok(r.burger && r.burger.vis, 'botão do menu ausente');
      ok(!overlap(r.lock, r.burger), 'marca e menu se sobrepõem');
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
    await test(`${vp.width}px: nenhuma página com rolagem horizontal, erro ou h1 duplicado; WhatsApp só no canto inferior direito`, async () => {
      const bad = [];
      for (const pg of PAGES) {
        const p = await open(c, pg + '.html', 300);
        const r = await p.evaluate(w => { const b = document.querySelector('.wa-btn'), bb = b && b.getBoundingClientRect();
          return { ov: Math.max(document.documentElement.scrollWidth, innerWidth) - w, h1: document.querySelectorAll('h1').length,
            waTop: !!document.querySelector('.hdr [href*="wa.me"], .hdr .hwa'),
            waCorner: !!bb && bb.width >= 44 && innerWidth - bb.right < 40 && innerHeight - bb.bottom < 40 && bb.left > innerWidth / 2 }; }, vp.width);
        if (r.ov > 0) bad.push(`${pg}: página ${r.ov}px mais larga que a tela`);
        if (r.h1 !== 1) bad.push(`${pg}: ${r.h1} h1`);
        if (r.waTop) bad.push(`${pg}: WhatsApp no cabeçalho`);
        if (!r.waCorner) bad.push(`${pg}: botão do WhatsApp fora do canto inferior direito`);
        if (p.errors.length) bad.push(`${pg}: ${p.errors[0]}`);
        await p.close();
      }
      ok(!bad.length, bad.join('; '));
    });
    await c.close();
  }

  console.log('\nAbertura de todas as páginas');
  /* o conteúdo da abertura começava longe demais do cabeçalho (~100 px no desktop): agora fica logo abaixo, sem encostar */
  for (const [vp, m, max] of [[SMALL, true, 40], [MOBILE, true, 40], [{ width: 1024, height: 768 }, false, 72], [{ width: 1366, height: 768 }, false, 72], [DESKTOP, false, 72], [{ width: 1920, height: 1080 }, false, 80]]) {
    const c = await ctx(vp, m);
    await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); sessionStorage.setItem('pf-wa-x', '1'); } catch (e) {} });
    await test(`${vp.width}px: conteúdo da abertura logo abaixo do cabeçalho em todas as páginas`, async () => {
      const bad = [];
      for (const pg of PAGES) {
        if (pg === '404') continue; /* página de erro centralizada na tela, de propósito */
        if (m && pg === 'index') continue; /* no celular a arte 3D abre a home (testada acima) */
        const p = await open(c, pg + '.html', 300);
        await p.addStyleTag({ content: '*{transform:none!important;translate:none!important;transition:none!important;animation:none!important}' }); /* mede a posição final, sem o deslize da entrada */
        const r = await p.evaluate(() => {
          const sec = document.querySelector('main > section'), hdr = document.querySelector('.hdr').getBoundingClientRect();
          const tops = [...sec.querySelectorAll('.eyebrow, h1, h2, .portrait')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect().top);
          return { gap: Math.min(...tops) - hdr.bottom };
        });
        if (r.gap > max || r.gap < 16) bad.push(`${pg}: ${Math.round(r.gap)}px entre o cabeçalho e o conteúdo`);
        await p.close();
      }
      ok(!bad.length, bad.join('; '));
    });
    await c.close();
  }

  console.log('\nCaça de bugs no celular');
  /* varre cada página inteira nos celulares mais comuns: nada vazando escondido para fora da tela, texto sobre texto,
     imagem quebrada ou letra pequena demais para ler */
  for (const vp of [{ width: 320, height: 640 }, SMALL, MOBILE, { width: 414, height: 896 }]) {
    const c = await ctx(vp, true);
    await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); sessionStorage.setItem('pf-wa-x', '1'); } catch (e) {} });
    await test(`${vp.width}px: nada vaza da tela, sem texto sobreposto, imagem quebrada ou letra menor que 11 px`, async () => {
      const bad = [];
      for (const pg of PAGES) {
        const p = await open(c, pg + '.html', 300);
        await p.addStyleTag({ content: '*{transition:none!important;animation:none!important}' });
        await p.evaluate(async () => {
          document.body.classList.add('ready'); document.querySelectorAll('[data-r]').forEach(e => e.classList.add('in'));
          document.querySelectorAll('[aria-expanded=false][aria-controls]:not(#burger)').forEach(b => b.click()); /* abre o comparativo e afins */
          document.documentElement.style.scrollBehavior = 'auto';
          for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 20)); }
          scrollTo(0, 0); await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
        });
        const r = await p.evaluate(() => {
          const vw = innerWidth, out = [];
          /* dentro de um recipiente fechado (sanfona com altura zero que corta o conteúdo) não conta */
          const closed = e => { for (let a = e.parentElement; a; a = a.parentElement) { const b = a.getBoundingClientRect(); if ((b.height < 1 || b.width < 1) && getComputedStyle(a).overflow !== 'visible') return true; } return false; };
          const vis = e => { const cs = getComputedStyle(e); return e.getClientRects().length && cs.visibility !== 'hidden' && +cs.opacity > .05 && !e.closest('[aria-hidden=true],.mnav,.intro,[hidden]') && !closed(e); };
          /* sai da tela sem um pai que corte (overflow) dentro da tela; o corte do body é só rede de segurança e não conta */
          const clipped = e => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible' && a.getBoundingClientRect().right <= vw + 1) return true; return false; };
          const txt = e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
          const name = e => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '') + ' "' + e.textContent.trim().slice(0, 20) + '"';
          document.querySelectorAll('body *').forEach(e => {
            if (!vis(e) || getComputedStyle(e).position === 'fixed') return; const b = e.getBoundingClientRect();
            if (b.width && (b.right > vw + 1 || b.left < -1) && !clipped(e)) out.push('vaza da tela: ' + name(e));
          });
          document.querySelectorAll('main *, footer *, .hdr *').forEach(e => { if (vis(e) && txt(e) && parseFloat(getComputedStyle(e).fontSize) < 11) out.push('letra ' + getComputedStyle(e).fontSize + ': ' + name(e)); });
          document.querySelectorAll('img').forEach(i => { if (i.getAttribute('src') && !i.naturalWidth) out.push('imagem quebrada: ' + i.getAttribute('src')); });
          const leaves = [...document.querySelectorAll('main *')].filter(e => vis(e) && txt(e)).map(e => [e, e.getBoundingClientRect()]);
          for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
            const [a, A] = leaves[i], [b, B] = leaves[j]; if (a.contains(b) || b.contains(a)) continue;
            if (Math.min(A.right, B.right) - Math.max(A.left, B.left) > 4 && Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top) > 4) out.push('texto sobre texto: ' + name(a) + ' / ' + name(b));
          }
          return out;
        });
        r.forEach(x => bad.push(pg + ': ' + x));
        await p.close();
      }
      ok(!bad.length, bad.length + ' problemas: ' + [...new Set(bad)].slice(0, 6).join('; '));
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
    await test('planos sem preço: nenhuma mensalidade nos cartões, e o Conversar no pé de cada cartão', async () => {
      /* pedido: tirar o preço dos planos (o Diagnóstico do Imóvel continua com o valor) */
      const r = await p.evaluate(() => ({ n: document.querySelectorAll('.plan').length, price: document.querySelectorAll('.plan .price').length,
        money: [...document.querySelectorAll('.plan')].filter(e => /R\$|\/mês|790|1\.690|3\.500/.test(e.textContent)).length,
        cta: [...document.querySelectorAll('.plan')].map(e => { const a = e.querySelector('.plan-cta').getBoundingClientRect(), b = e.getBoundingClientRect(); return Math.round(b.bottom - a.bottom); }) }));
      ok(r.n === 3, r.n + ' cartões');
      ok(!r.price && !r.money, 'ainda há preço nos planos');
      ok(r.cta.every(v => v < 64), 'Conversar longe do pé do cartão: ' + r.cta.join(','));
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

  console.log('\nNavegação');
  for (const vp of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, DESKTOP]) {
    const c = await ctx(vp); const p = await open(c, 'governanca.html', 600);
    await test(`${vp.width}px: menu começa por Início e cabe sem encostar na marca nem no Conversar`, async () => {
      const r = await p.evaluate(() => {
        const box = e => e && e.getBoundingClientRect();
        const links = [...document.querySelectorAll('.hdr .nav a')];
        return { names: links.map(a => a.textContent.trim()), first: links[0] && links[0].getAttribute('href'),
          lock: box(document.querySelector('.hdr .brand')), nav: box(document.querySelector('.hdr .nav')), btn: box(document.querySelector('.hdr .btn')), wrap: box(document.querySelector('.hdr .wrap')),
          waTop: !!document.querySelector('.hdr [href*="wa.me"], .hdr .hwa'), btnText: (document.querySelector('.hdr .btn') || {}).textContent,
          wrapped: links.some(a => a.getBoundingClientRect().height > 40),
          btnFits: (b => b.scrollWidth <= b.clientWidth + 1)(document.querySelector('.hdr .btn')) };
      });
      ok(r.names[0] === 'Início' && r.first === 'index.html', 'primeiro item: ' + r.names[0]);
      ok(r.names.join('|') === 'Início|Governança|Método|Planos|Família|Compromissos', r.names.join('|'));
      ok(r.lock.right + 16 <= r.nav.left, 'menu encosta na marca');
      ok(r.nav.right + 16 <= r.btn.left, 'menu encosta no Conversar');
      ok(!r.waTop, 'há WhatsApp no cabeçalho');
      ok(r.btnText.trim() === 'Conversar', 'botão do topo: ' + r.btnText);
      ok(Math.abs(r.wrap.right - r.btn.right) <= 41, 'Conversar não fecha a linha do cabeçalho à direita');
      ok(!r.wrapped, 'algum item quebrou em duas linhas');
      ok(r.btnFits, 'texto do Conversar vaza da borda do botão');
    });
    await c.close();
  }
  {
    const c = await ctx(DESKTOP); const p = await open(c, 'index.html', 4800);
    await test('na home, Início fica marcado no topo e cede a marca ao capítulo ao rolar', async () => {
      const top = await p.evaluate(() => getComputedStyle(document.querySelector('.hdr .nav a[href="index.html"]'), '::after').transform);
      ok(top === 'none' || top === 'matrix(1, 0, 0, 1, 0, 0)', 'Início sem marca no topo: ' + top);
      await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, document.getElementById('planos').offsetTop + 300); }); await p.waitForTimeout(700);
      const r = await p.evaluate(() => ({ on: document.querySelector('.hdr .nav a.on') && document.querySelector('.hdr .nav a.on').textContent, ini: getComputedStyle(document.querySelector('.hdr .nav a[href="index.html"]'), '::after').transform }));
      ok(r.on === 'Planos', 'capítulo marcado: ' + r.on);
      ok(r.ini !== 'none' && r.ini !== 'matrix(1, 0, 0, 1, 0, 0)', 'Início continua marcado junto com o capítulo');
    });
    await c.close();
  }

  {
    const c = await ctx(DESKTOP); const p = await open(c, 'index.html', 4800);
    await test('desktop: sem iluminação nem destaque seguindo o ponteiro do mouse na abertura', async () => {
      await p.mouse.move(300, 300); await p.waitForTimeout(150); await p.mouse.move(900, 500); await p.waitForTimeout(300);
      const r = await p.evaluate(() => { const h = document.querySelector('.hero'), cs = getComputedStyle(h, '::before');
        return { mx: h.style.getPropertyValue('--mx'), my: h.style.getPropertyValue('--my'), bg: cs.content === 'none' ? 'none' : cs.backgroundImage }; });
      ok(!r.mx && !r.my, 'a abertura ainda reage ao mouse');
      ok(r.bg === 'none', 'ainda há luz sobre a abertura no desktop: ' + r.bg.slice(0, 60));
    });
    await c.close();
  }

  console.log('\nLayout (nada pode sair do lugar)');
  await test('posição e tamanho dos blocos iguais à referência em 390 e 1440 px', async () => {
    const base = await layout.baseline(browser);
    const d = layout.compare(base, await layout.measure(browser, U));
    ok(!d.length, d.length + ' diferenças: ' + d.slice(0, 4).join(' ; '));
  });

  console.log('\nAuditoria geral');
  {
    const c = await ctx(MOBILE, true);
    await test('links internos e âncoras existem; imagens com alt; campos com rótulo; botões com nome; metadados completos', async () => {
      const bad = [];
      for (const pg of PAGES) {
        const p = await open(c, pg + '.html', 200);
        const r = await p.evaluate(() => {
          const ids = new Set([...document.querySelectorAll('[id]')].map(e => e.id));
          const name = e => (e.getAttribute('aria-label') || e.textContent || [...e.querySelectorAll('img[alt]')].map(i => i.alt).join('') || '').trim();
          return {
            hrefs: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => !/^(https?:|mailto:|tel:)/.test(h)),
            anchors: [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href').slice(1)).filter(h => h && !ids.has(h)),
            noAlt: [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).length,
            unlabeled: [...document.querySelectorAll('input:not([type=radio]):not([type=hidden]),textarea,select')].filter(i => !document.querySelector(`label[for="${i.id}"]`) && !i.getAttribute('aria-label')).length,
            noName: [...document.querySelectorAll('button, a[href]')].filter(b => !name(b)).length,
            meta: { title: document.title.length, desc: (document.querySelector('meta[name=description]') || {}).content, canon: !!document.querySelector('link[rel=canonical]'), lang: document.documentElement.lang, vp: !!document.querySelector('meta[name=viewport]') },
            blank: [...document.querySelectorAll('a[target=_blank]')].filter(a => !/noopener/.test(a.rel)).length
          };
        });
        for (const h of new Set(r.hrefs)) { const f = h.split('#')[0].split('?')[0]; if (f && !fs.existsSync(path.join(__dirname, '..', f))) bad.push(`${pg}: link quebrado ${h}`); }
        r.anchors.forEach(a => bad.push(`${pg}: âncora #${a} inexistente`));
        if (r.noAlt) bad.push(`${pg}: ${r.noAlt} imagem sem alt`);
        if (r.unlabeled) bad.push(`${pg}: ${r.unlabeled} campo sem rótulo`);
        if (r.noName) bad.push(`${pg}: ${r.noName} botão/link sem nome`);
        if (r.blank) bad.push(`${pg}: link externo sem noopener`);
        if (!r.meta.title || !r.meta.desc || !r.meta.canon || r.meta.lang !== 'pt-BR' || !r.meta.vp) bad.push(`${pg}: metadados incompletos`);
        await p.close();
      }
      const sm = fs.readFileSync(path.join(__dirname, '..', 'sitemap.xml'), 'utf8');
      (sm.match(/<loc>[^<]+<\/loc>/g) || []).forEach(l => { const f = l.replace(/<\/?loc>/g, '').replace(/^https?:\/\/[^/]+\//, '') || 'index.html'; if (!fs.existsSync(path.join(__dirname, '..', f))) bad.push('sitemap: ' + f); });
      ok(!bad.length, bad.join('; '));
    });
    await test('alvos de toque do cabeçalho e do menu com pelo menos 44 px', async () => {
      const p = await open(c, 'index.html', 4800);
      const small = await p.evaluate(() => [...document.querySelectorAll('#burger, .wa-btn')].filter(e => { const b = e.getBoundingClientRect(); return b.width < 44 || b.height < 44; }).map(e => e.className));
      ok(!small.length, 'pequenos: ' + small.join(', '));
    });
    await test('texto principal com contraste AA (corpo, títulos, rótulos) na home', async () => {
      const p = await open(c, 'index.html', 4800);
      const low = await p.evaluate(() => {
        const L = c => { const m = c.match(/[\d.]+/g).map(Number); const f = v => (v /= 255) <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); return [.2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]), m[3] == null ? 1 : m[3]]; };
        const bg = e => { while (e) { const c = getComputedStyle(e).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; e = e.parentElement; } return 'rgb(255,255,255)'; };
        const out = [];
        document.querySelectorAll('main p, main li, main h1, main h2, main h3, main .eyebrow, main small, main a').forEach(e => {
          if (!e.offsetParent || !e.textContent.trim() || e.closest('[aria-hidden=true]')) return;
          const cs = getComputedStyle(e); if (+cs.opacity < .5) return;
          const [l1, a] = L(cs.color), [l2] = L(bg(e)); if (a < .5) return;
          const r = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05), big = parseFloat(cs.fontSize) >= 24;
          if (r < (big ? 3 : 4.5)) out.push(e.tagName + '.' + e.className + ' ' + r.toFixed(2) + ' "' + e.textContent.trim().slice(0, 24) + '"');
        });
        return out;
      });
      ok(!low.length, low.length + ' trechos: ' + low.slice(0, 5).join(' | '));
    });
    await c.close();
  }

  await browser.close(); srv.close();
  const fail = results.filter(r => !r[0]);
  console.log(`\n${results.length - fail.length}/${results.length} testes passaram`);
  process.exit(fail.length ? 1 : 0);
})();
