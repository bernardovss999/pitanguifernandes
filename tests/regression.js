/* Testes de regressão do site (Playwright, sem framework).
   Rodar: npm test   (ou: node tests/regression.js)
   Sobe um servidor estático da raiz do repositório e verifica, em celular e desktop,
   tudo o que já quebrou ou foi pedido explicitamente. Sai com código 1 se algo falhar. */
const fs = require('fs'), path = require('path');
const { serve, launch, ROOT, ler, chaves, variante, paginasHtml } = require('./helpers');
const layout = require('./layout');
const PAGES = ['index', 'governanca', 'metodo', 'planos', 'familia', 'compromissos', 'contato', 'privacidade', '404'];
const MOBILE = { width: 390, height: 844 }, SMALL = { width: 360, height: 740 }, DESKTOP = { width: 1440, height: 900 };

/* SO=REG-007 npm test roda só os testes cujo nome contém o texto; sem SO, roda tudo */
const SO = process.env.SO || '';
/* filtrando por um REG-NNN ou MEL-NNN, os blocos antigos (sem REG no nome) nem montam o navegador */
const LEGADO = !SO || !/^(REG|MEL)-\d/.test(SO);
const results = [];
async function test(name, fn) {
  if (SO && !name.includes(SO)) return;
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
    p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
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
  if (LEGADO) for (const vp of [MOBILE, SMALL]) {
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
    /* "balão do WhatsApp aparece, fecha e não volta na mesma sessão" foi reescrito como REG-006 (o balão segue a chave BALAO_WHATSAPP; ver REGRESSOES.md) */
    await test(`${vp.width}px: sem erros no console`, async () => ok(!p.errors.length, p.errors.join(' | ')));
    await c.close();
  }

  console.log('\nTodas as páginas');
  /* 320 px entrou no laço com o REG-019 (iPhone SE e celulares com zoom de tela) */
  if (LEGADO) for (const [vp, m] of [[{ width: 320, height: 568 }, true], [SMALL, true], [MOBILE, true], [DESKTOP, false]]) {
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
          /* 22/10/2026: o conteúdo de uma pergunta fechada (details sem open, fora do summary) não aparece na tela, mas o Chromium
             ainda devolve caixas para ele; sem esta exceção, as respostas fechadas das Perguntas contavam como texto sobre texto */
          const vis = e => { const cs = getComputedStyle(e); return e.getClientRects().length && cs.visibility !== 'hidden' && +cs.opacity > .05 && !e.closest('[aria-hidden=true],.mnav,.intro,[hidden]') && !closed(e) && !(e.closest('details:not([open])') && !e.closest('summary')); };
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
  if (LEGADO) {
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
  if (LEGADO) {
    const c = await ctx(MOBILE, true); const p = await open(c, 'planos.html');
    /* "planos mostram as três mensalidades" foi reescrito como REG-004 (preços seguem a chave MOSTRAR_PRECOS; ver REGRESSOES.md) */
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
  if (LEGADO) {
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
  if (LEGADO) {
    const c = await browser.newContext({ viewport: MOBILE, reducedMotion: 'reduce' }); const p = await open(c, 'index.html', 600);
    await test('movimento reduzido: nada fica escondido', async () => {
      const n = await p.evaluate(() => [...document.querySelectorAll('[data-r],[data-h]')].filter(e => +getComputedStyle(e).opacity < .5).length);
      ok(n === 0, n + ' elementos escondidos');
    });
    await c.close();
  }

  console.log('\nNavegação');
  if (LEGADO) for (const vp of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, DESKTOP]) {
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
  if (LEGADO) {
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

  if (LEGADO) {
    const c = await ctx(DESKTOP); const p = await open(c, 'index.html', 4800);
    /* o fundo da abertura não reage ao mouse. Desde o MEL-004 (20/10/2026) só o monograma responde ao ponteiro (V1 "Cotas e
       profundidade"), sem luz nem destaque no fundo: este teste continua valendo para o .hero e o MEL-004 cobre o monograma */
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
    ok(!d.length, d.length + ' diferenças: ' + d.slice(0, 8).join(' ; '));
  });

  console.log('\nAuditoria geral');
  if (LEGADO) {
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
        /* canonical só nas páginas indexáveis (REG-047: 404 e Política têm noindex próprio) */
        if (!r.meta.title || !r.meta.desc || (!r.meta.canon && !['privacidade', '404'].includes(pg)) || r.meta.lang !== 'pt-BR' || !r.meta.vp) bad.push(`${pg}: metadados incompletos`);
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

  /* ===================================================================== Auditoria Sett × ruflo, 19/10/2026
     Cada teste traz o REG-NNN do site/REGRESSOES.md. Cada um monta o próprio contexto, para rodar sozinho com SO=REG-NNN. */
  console.log('\nAuditoria Sett × ruflo, 19/10/2026');
  const K = chaves();
  const attr = (h, re) => { const m = h.match(re); return m ? m[1] : null; };

  await test('REG-001: chaves PREVIA e SITE: canonical, og, JSON-LD, sitemap e robots no mesmo endereço; faixa de prévia sempre com noindex', async () => {
    const bad = [];
    if (typeof K.PREVIA !== 'boolean') bad.push('chave PREVIA ausente no topo do build.py');
    if (!/^https:\/\/[a-z0-9.-]+\/$/.test(K.SITE || '')) bad.push('chave SITE ausente ou fora do formato https://host/: ' + K.SITE);
    const confere = (root, k, quem) => {
      for (const pg of paginasHtml(root)) {
        const h = ler(pg, root);
        const urls = { canonical: attr(h, /<link rel="canonical" href="([^"]+)"/), 'og:url': attr(h, /<meta property="og:url" content="([^"]+)"/), 'og:image': attr(h, /<meta property="og:image" content="([^"]+)"/) };
        const proprioNoindex = ['privacidade.html', '404.html', 'home.html'].includes(pg); /* noindex da própria página: sem canonical (REG-047) */
        for (const [n, u] of Object.entries(urls)) {
          if (pg === 'home.html') continue; /* home.html só redireciona para a home */
          if (n === 'canonical' && proprioNoindex) { if (u) bad.push(`${quem} ${pg}: canonical em página noindex`); continue; }
          if (!u) bad.push(`${quem} ${pg}: sem ${n}`); else if (!u.startsWith(k.SITE)) bad.push(`${quem} ${pg}: ${n} fora de SITE (${u})`);
        }
        if (urls['og:image'] && urls['og:image'].startsWith(k.SITE) && !fs.existsSync(path.join(root, urls['og:image'].slice(k.SITE.length)))) bad.push(`${quem} ${pg}: og:image aponta para arquivo inexistente`);
        for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
          const ld = JSON.parse(m[1]);
          for (const f of ['url', 'logo', 'image']) if (ld[f] && !String(ld[f]).startsWith(k.SITE)) bad.push(`${quem} ${pg}: JSON-LD ${f} fora de SITE (${ld[f]})`);
        }
        const faixa = /class="sett-faixa"/.test(h), noindex = /<meta name="robots" content="[^"]*noindex/.test(h);
        if (k.PREVIA && !faixa && pg !== 'home.html') bad.push(`${quem} ${pg}: PREVIA ligada e sem a faixa da Sett`);
        if (!k.PREVIA && faixa) bad.push(`${quem} ${pg}: PREVIA desligada e a faixa da Sett continua`);
        if (faixa && !noindex) bad.push(`${quem} ${pg}: faixa de prévia sem meta robots noindex`);
        if (!k.PREVIA && noindex && !['privacidade.html', '404.html', 'home.html'].includes(pg)) bad.push(`${quem} ${pg}: noindex depois do lançamento`);
      }
      const sm = ler('sitemap.xml', root), rb = ler('robots.txt', root);
      (sm.match(/<loc>([^<]+)<\/loc>/g) || ['<loc>vazio</loc>']).forEach(l => { const u = l.replace(/<\/?loc>/g, ''); if (!u.startsWith(k.SITE)) bad.push(`${quem} sitemap: ${u}`); });
      const smr = attr(rb, /^Sitemap:\s*(\S+)/m); if (smr !== k.SITE + 'sitemap.xml') bad.push(`${quem} robots.txt: Sitemap ${smr}`);
      const vj = fs.existsSync(path.join(root, 'vercel.json')) ? JSON.parse(ler('vercel.json', root)) : {};
      const xr = (vj.headers || []).some(r => (r.headers || []).some(x => x.key.toLowerCase() === 'x-robots-tag' && /noindex/.test(x.value)));
      if (k.PREVIA !== xr) bad.push(`${quem} vercel.json: X-Robots-Tag noindex ${xr ? 'presente' : 'ausente'} com PREVIA=${k.PREVIA}`);
    };
    confere(ROOT, K, 'prévia:');
    if (!bad.length) { /* o lançamento: uma troca de chaves, nada mais */
      const k2 = { PREVIA: false, SITE: 'https://pitanguifernandes.com.br/' }, dir = variante(k2);
      try { confere(dir, k2, 'lançamento:'); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    }
    /* imagem de compartilhamento: JPEG 1200×630 (a arte do kit, Perfil e canais/site-compartilhamento.png) */
    const jpg = fs.readFileSync(path.join(ROOT, 'assets/og.jpg')); let dim = null;
    for (let i = 2; i < jpg.length - 9;) { if (jpg[i] !== 0xFF) break; const mk = jpg[i + 1], len = jpg.readUInt16BE(i + 2);
      if (mk >= 0xC0 && mk <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(mk)) { dim = [jpg.readUInt16BE(i + 7), jpg.readUInt16BE(i + 5)]; break; } i += 2 + len; }
    if (!dim || dim[0] !== 1200 || dim[1] !== 630) bad.push('og.jpg não é 1200×630: ' + dim);
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('REG-002: chave EMAIL: sem e-mail publicado enquanto o domínio não recebe; com e-mail, um endereço só', async () => {
    const bad = [];
    if (!('EMAIL' in K)) bad.push('chave EMAIL ausente no topo do build.py');
    const confere = (root, email, quem) => {
      const arqs = paginasHtml(root).map(f => [f, ler(f, root)]).concat([['site.js', ler('assets/js/site.js', root)]]);
      for (const [f, h] of arqs) {
        const mails = [...h.matchAll(/mailto:([^"?]+)/g)].map(m => m[1]);
        const soltos = [...h.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)].map(m => m[0]);
        if (!email && (mails.length || soltos.length)) bad.push(`${quem} ${f}: e-mail publicado com EMAIL=None (${(mails[0] || soltos[0])})`);
        if (email) mails.concat(soltos).forEach(m => { if (m !== email) bad.push(`${quem} ${f}: e-mail diferente da chave (${m})`); });
        for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
          const ld = JSON.parse(m[1]);
          if (!email && 'email' in ld) bad.push(`${quem} ${f}: JSON-LD com email`);
          if (email && ld.email !== email) bad.push(`${quem} ${f}: JSON-LD email ${ld.email}`);
        }
      }
      /* a Política precisa de um canal que funcione para os direitos do titular */
      const pv = ler('privacidade.html', root);
      if (!/href="https:\/\/wa\.me\/\d+/.test(pv)) bad.push(`${quem} privacidade.html: sem o WhatsApp como canal dos direitos`);
      if (email && !pv.includes('mailto:' + email)) bad.push(`${quem} privacidade.html: sem o e-mail da chave`);
    };
    confere(ROOT, K.EMAIL || null, 'prévia:');
    if (!bad.length) { const dir = variante({ EMAIL: 'contato@pitanguifernandes.com.br' });
      try { confere(dir, 'contato@pitanguifernandes.com.br', 'com EMAIL:'); } finally { fs.rmSync(dir, { recursive: true, force: true }); } }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  /* verificação com rede, antes de cada apresentação ou publicação: CHECK_DNS=1 npm test */
  if (process.env.CHECK_DNS) await test('REG-002: (rede) todo e-mail publicado tem caixa de entrada (MX não nulo)', async () => {
    const doms = new Set();
    for (const f of paginasHtml()) for (const m of ler(f).matchAll(/mailto:[^@"]+@([^"?]+)/g)) doms.add(m[1]);
    const bad = [];
    for (const d of doms) {
      const r = await (await fetch((process.env.DNS_URL || 'https://dns.google/resolve') + '?type=MX&name=' + encodeURIComponent(d))).json();
      const mx = (r.Answer || []).filter(a => a.type === 15).map(a => a.data.trim());
      if (!mx.length) bad.push(`${d}: sem registro MX`); else if (mx.some(x => /^0\s+\.?$/.test(x))) bad.push(`${d}: MX nulo (${mx.join(', ')}), o domínio recusa e-mail`);
    }
    ok(!bad.length, 'e-mail do site sem caixa de entrada: ' + bad.join(' | '));
  });

  /* abre o formulário de contato numa raiz qualquer, preenche e devolve o endereço que o site tentaria abrir */
  async function enviaFormulario(root) {
    const sv = root === ROOT ? null : await serve(root), base = sv ? 'http://127.0.0.1:' + sv.address().port + '/' : U;
    const c = await ctx(DESKTOP); await c.addInitScript(() => { window.open = u => { window.__opened = String(u); return null; }; });
    try { const p = await c.newPage(); await p.goto(base + 'contato.html', { waitUntil: 'load' });
      await p.fill('#nome', 'Teste'); await p.fill('#tel', '21999998888'); await p.click('button[type=submit]'); await p.waitForTimeout(300);
      return await p.evaluate(() => window.__opened || '');
    } finally { await c.close(); if (sv) sv.close(); }
  }
  await test('REG-003: WhatsApp numa constante só: todos os wa.me, tel:, JSON-LD e o formulário usam o mesmo número; site.js sem número fixo', async () => {
    const bad = [], n = K.WHATS;
    if (!/^55\d{10,11}$/.test(n || '')) bad.push('constante WHATS ausente no build.py: ' + n);
    const js = ler('assets/js/site.js');
    if (/55\d{10,11}/.test(js) || /wa\.me\/\d/.test(js)) bad.push('site.js tem número de WhatsApp escrito à mão');
    for (const f of paginasHtml()) {
      const h = ler(f);
      for (const m of h.matchAll(/wa\.me\/(\d+)/g)) if (m[1] !== n) bad.push(`${f}: wa.me/${m[1]}`);
      for (const m of h.matchAll(/href="tel:\+?(\d+)"/g)) if (m[1] !== n) bad.push(`${f}: tel:${m[1]}`);
      for (const m of h.matchAll(/"telephone":\s*"([^"]+)"/g)) if (m[1].replace(/\D/g, '') !== n) bad.push(`${f}: JSON-LD telephone ${m[1]}`);
      if (/<form[^>]*id="form"/.test(h) && attr(h, /<form[^>]*data-wa="(\d+)"/) !== n) bad.push(`${f}: formulário sem data-wa=${n}`);
    }
    if (!bad.length) {
      ok((await enviaFormulario(ROOT)).startsWith('https://wa.me/' + n + '?text='), 'formulário não abriu o número da constante');
      /* trocar o número no build muda também o formulário: prova de que o site.js lê o data-wa */
      const dir = variante({ WHATS: '5521900000000' });
      try { const u = await enviaFormulario(dir); if (!u.startsWith('https://wa.me/5521900000000?text=')) bad.push('com outro WHATS, o formulário abriu ' + u.slice(0, 40)); }
      finally { fs.rmSync(dir, { recursive: true, force: true }); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('REG-004: planos seguem a chave de preços (MOSTRAR_PRECOS): sem valores, a nota da Direção de Arte; com valores, os três e o Diagnóstico', async () => {
    const bad = [], NOTA = 'Os valores são apresentados após o diagnóstico, de acordo com o porte e as características de cada imóvel.';
    if (typeof K.MOSTRAR_PRECOS !== 'boolean') bad.push('chave MOSTRAR_PRECOS ausente no topo do build.py');
    const c = await ctx(MOBILE, true);
    try {
      for (const pg of PAGES) {
        const p = await open(c, pg + '.html', 100);
        const r = await p.evaluate(() => ({ price: [...document.querySelectorAll('.plan .price b')].map(b => b.textContent), txt: document.querySelector('main').innerText }));
        if (K.MOSTRAR_PRECOS === true) { if (pg === 'planos' && r.price.join(',') !== '790,1.690,3.500') bad.push('planos: valores ' + r.price.join(',')); }
        else {
          if (r.price.length) bad.push(`${pg}: ${r.price.length} preços nos cartões`);
          const m = r.txt.match(/.{0,30}R\$\s?\d[\d.,]*/); if (m) bad.push(`${pg}: valor no texto ("${m[0].trim()}")`);
          if (['planos', 'index'].includes(pg) && !r.txt.includes(NOTA)) bad.push(`${pg}: sem a nota "Os valores são apresentados após o diagnóstico..."`);
        }
        await p.close();
      }
    } finally { await c.close(); }
    if (!bad.length && K.MOSTRAR_PRECOS === false) { /* o outro lado da chave continua funcionando */
      const dir = variante({ MOSTRAR_PRECOS: true });
      try {
        const pl = ler('planos.html', dir), me = ler('metodo.html', dir);
        const v = [...pl.matchAll(/<p class="price">[\s\S]*?<b class="tnum">([\d.]+)<\/b>/g)].map(m => m[1]).join(',');
        if (v !== '790,1.690,3.500') bad.push('com MOSTRAR_PRECOS=True, planos: ' + v);
        if (!/2\.750/.test(me)) bad.push('com MOSTRAR_PRECOS=True, metodo sem o valor do Diagnóstico');
        if (pl.includes(NOTA)) bad.push('com MOSTRAR_PRECOS=True, a nota "valores após o diagnóstico" contradiz os preços');
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('REG-005: abatimento do Diagnóstico com um texto só, o que vale em qualquer plano ("no todo ou em parte")', async () => {
    const bad = [], A = 'O valor do Diagnóstico é abatido, no todo ou em parte, na contratação de um plano em até 30 dias.';
    if (K.ABATIMENTO !== A) bad.push('constante ABATIMENTO ausente ou diferente no build.py: ' + K.ABATIMENTO);
    const confere = (root, quem) => {
      for (const f of paginasHtml(root)) {
        const txt = ler(f, root).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
        const todas = (txt.match(/[^.]*\babatid[^.]*\./gi) || []).map(x => x.trim());
        todas.filter(x => !A.endsWith(x) && !x.endsWith(A.slice(0, -1) + '.')).forEach(x => bad.push(`${quem} ${f}: "${x.slice(0, 90)}"`));
        if (['planos.html', 'metodo.html'].includes(f) && !txt.includes(A)) bad.push(`${quem} ${f}: sem a regra do abatimento`);
      }
    };
    confere(ROOT, 'site:');
    const dir = variante({ MOSTRAR_PRECOS: !K.MOSTRAR_PRECOS });
    try { confere(dir, 'outra chave de preços:'); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('REG-006: WhatsApp sem balão automático, sem anel pulsante e sem bolinha de on-line (chave BALAO_WHATSAPP)', async () => {
    const bad = [];
    if (typeof K.BALAO_WHATSAPP !== 'boolean') bad.push('chave BALAO_WHATSAPP ausente no topo do build.py');
    if (K.BALAO_WHATSAPP !== true) {
      for (const pg of ['index.html', 'governanca.html']) {
        const c = await ctx(MOBILE, true); /* sessão nova */
        try {
          const p = await open(c, pg, 6000);
          await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, 600); }); await p.waitForTimeout(1500);
          const r = await p.evaluate(() => {
            const vis = e => { const cs = getComputedStyle(e), b = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > .05 && b.width > 0; };
            const btn = document.querySelector('.wa-btn');
            return { pop: !!document.querySelector('.wa-pop.show'), dialog: [...document.querySelectorAll('[role=dialog]')].filter(vis).length,
              anel: btn ? getComputedStyle(btn, '::after').animationName : 'sem botão', online: !!document.querySelector('.wa-av, .wa-go'),
              anim: document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.wa')).length,
              btnVis: !!btn && vis(btn) };
          });
          if (r.pop || r.dialog) bad.push(`${pg}: balão/diálogo aberto sem ação do usuário`);
          if (r.anel !== 'none') bad.push(`${pg}: anel do botão anima (${r.anel})`);
          if (r.anim) bad.push(`${pg}: ${r.anim} animações rodando no WhatsApp`);
          if (r.online) bad.push(`${pg}: bolinha verde de "on-line" no HTML`);
          if (!r.btnVis) bad.push(`${pg}: o botão estático do WhatsApp sumiu`);
        } finally { await c.close(); }
      }
    }
    if (!bad.length && K.BALAO_WHATSAPP === false) { /* com a chave ligada, vale o comportamento antigo: aparece, fecha e não volta na sessão */
      const dir = variante({ BALAO_WHATSAPP: true }), sv = await serve(dir), base = 'http://127.0.0.1:' + sv.address().port + '/';
      const c = await ctx(MOBILE, true);
      try {
        const p = await c.newPage(); await p.goto(base + 'index.html', { waitUntil: 'load' }); await p.waitForTimeout(6300);
        const shown = await p.evaluate(() => { const e = document.querySelector('.wa-pop'); return !!e && e.classList.contains('show') && getComputedStyle(e).visibility === 'visible'; });
        if (!shown) bad.push('com BALAO_WHATSAPP=True o balão não apareceu');
        else {
          if (!(await p.evaluate(() => { const b = document.querySelector('.wa-pop').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight; }))) bad.push('balão sai da tela');
          await p.click('.wa-x'); await p.waitForTimeout(500);
          if (await p.evaluate(() => document.querySelector('.wa-pop').classList.contains('show'))) bad.push('balão não fechou');
          await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(6500);
          if (await p.evaluate(() => document.querySelector('.wa-pop').classList.contains('show'))) bad.push('balão voltou depois de fechado');
        }
      } finally { await c.close(); sv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  const FAMILIAS = { sett: ['Newsreader', 'Jost'], cliente: ['Cormorant Garamond', 'Inter'] };
  /* abre a página registrando toda requisição; devolve as externas e as famílias carregadas de título e texto */
  async function fontesDaPagina(base, pg, vp) {
    const c = await ctx(vp || MOBILE, true), fora = [];
    try {
      const p = await c.newPage();
      p.on('request', q => { const h = new URL(q.url()).hostname; if (!['127.0.0.1', 'localhost'].includes(h) && !q.url().startsWith('data:')) fora.push(q.url()); });
      await p.goto(base + pg, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150);
      const r = await p.evaluate(() => {
        const fam = e => getComputedStyle(e).fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
        const t = fam(document.querySelector('h1')), b = fam(document.body);
        const carregada = f => [...document.fonts].some(ff => ff.family.replace(/^["']|["']$/g, '') === f && ff.status === 'loaded');
        return { titulo: t, texto: b, tOk: carregada(t) && document.fonts.check('32px "' + t + '"'), bOk: carregada(b) && document.fonts.check('16px "' + b + '"') };
      });
      return Object.assign(r, { fora });
    } finally { await c.close(); }
  }
  await test('REG-016: fontes hospedadas no próprio site (chave TIPOGRAFIA): nenhuma requisição externa; títulos e texto na família da chave, carregados', async () => {
    const bad = [];
    if (!FAMILIAS[K.TIPOGRAFIA]) bad.push('chave TIPOGRAFIA ausente ou desconhecida no build.py: ' + K.TIPOGRAFIA);
    const [serif, sans] = FAMILIAS[K.TIPOGRAFIA] || FAMILIAS.sett;
    const confere = async (base, sf, ss, quem, pags) => {
      for (const pg of pags) {
        const r = await fontesDaPagina(base, pg);
        if (r.fora.length) bad.push(`${quem} ${pg}: requisição fora do site (${r.fora[0].slice(0, 60)})`);
        if (r.titulo !== sf) bad.push(`${quem} ${pg}: título em ${r.titulo}, esperado ${sf}`);
        if (r.texto !== ss) bad.push(`${quem} ${pg}: texto em ${r.texto}, esperado ${ss}`);
        if (!r.tOk || !r.bOk) bad.push(`${quem} ${pg}: fontes não carregadas (${r.titulo} ${r.tOk}, ${r.texto} ${r.bOk})`);
      }
    };
    await confere(U, serif, sans, 'site:', PAGES.map(p => p + '.html'));
    if (!bad.length) {
      const outra = K.TIPOGRAFIA === 'sett' ? 'cliente' : 'sett', dir = variante({ TIPOGRAFIA: outra }), sv = await serve(dir);
      try { await confere('http://127.0.0.1:' + sv.address().port + '/', FAMILIAS[outra][0], FAMILIAS[outra][1], `TIPOGRAFIA=${outra}:`, ['index.html', 'planos.html']); }
      finally { sv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });
  await test('REG-016: o CI mede o layout contra a referência commitada (tests/layout-baseline.json), não contra a main', async () => {
    /* com as fontes no próprio site a medição é a mesma em qualquer máquina; comparar com a main deixava vermelho
       todo PR que muda o layout de propósito, mesmo com a referência regravada no próprio PR */
    const wf = ler('.github/workflows/test.yml');
    ok(!/LAYOUT_BASE\s*:/.test(wf), 'o workflow ainda define LAYOUT_BASE (compara com a main)');
    ok(/npm test/.test(wf), 'o workflow não roda npm test');
  });

  /* compromissos como [título, texto], lidos do HTML gerado */
  const compromissos = h => [...h.matchAll(/<article class="cm"[^>]*>([\s\S]*?)<\/article>/g)].map(m => {
    const tx = x => x.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return [tx((m[1].match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/) || [])[1] || ''), tx((m[1].match(/<p>([\s\S]*?)<\/p>/) || [])[1] || '')];
  });
  await test('REG-007: compromisso "Repasse ao custo" declara a taxa de coordenação (ajuste A3)', async () => {
    const bad = [], A3 = 'Serviços de terceiros e materiais são repassados ao custo, com comprovante. A nossa taxa de coordenação é declarada em contrato.';
    for (const f of ['index.html', 'compromissos.html']) {
      const c = compromissos(ler(f)).find(x => x[0] === 'Repasse ao custo');
      if (!c) bad.push(`${f}: sem o compromisso "Repasse ao custo"`); else if (c[1] !== A3) bad.push(`${f}: "${c[1]}"`);
    }
    ok(!bad.length, bad.join(' | '));
  });
  await test('REG-008: compromisso 5 só promete o que vale para todos os planos (ajuste A4), coerente com o comparativo', async () => {
    const bad = [];
    const essencialSemDocs = /Documentação dos prestadores[^<]*<\/th><td[^>]*data-p="Essencial"[^>]*>(?:(?!<\/td>).)*não incluído/i.test(ler('planos.html'));
    for (const f of ['index.html', 'compromissos.html']) {
      const c = compromissos(ler(f))[4] || ['', ''];
      if (c[0] !== 'Prestadores homologados') bad.push(`${f}: título do compromisso 5 "${c[0]}"`);
      if (c[1] !== 'Toda a rede passa por critérios de homologação, e o nível de verificação acompanha o seu plano.') bad.push(`${f}: texto "${c[1]}"`);
      if (essencialSemDocs && /seguro conferid|documentação[^.]*conferid/i.test(c[1])) bad.push(`${f}: promete documentação e seguro conferidos, mas o Essencial não inclui a documentação dos prestadores`);
    }
    if (/prestadores verificados/i.test(attr(ler('compromissos.html'), /<meta name="description" content="([^"]+)"/) || '')) bad.push('compromissos.html: descrição ainda diz "prestadores verificados"');
    ok(!bad.length, bad.join(' | '));
  });

  await test('REG-009: onde o site descreve vistoria, fiscalização, medição e obras, a ressalva da cliente sobre ART/RRT', async () => {
    const bad = [], ART = 'Atividades que exigem responsável técnico (ART/RRT) são executadas por profissional habilitado.';
    if (K.ART !== ART) bad.push('constante ART ausente ou diferente no build.py');
    for (const f of ['index.html', 'governanca.html', 'metodo.html', 'planos.html']) {
      const txt = ler(f).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      const n = txt.split(ART).length - 1;
      if (n !== 1) bad.push(`${f}: ressalva de ART/RRT ${n} vezes`);
    }
    ok(!bad.length, bad.join(' | '));
  });

  /* reescrito em 20/10/2026 (MEL-003): Diana pediu para não aparecer, então fica um cartão só, o de Samuel; as outras exigências
     (nenhum cargo ou credencial sem fonte, rótulo do retrato = nome, ajuste A5 na faixa) continuam iguais */
  await test('REG-010: pessoa sem cargo nem credencial sem fonte; retrato com o nome; "respondem com o próprio nome" (A5); um cartão só, o de Samuel', async () => {
    const bad = [];
    const c = await ctx(MOBILE, true);
    try {
      for (const f of ['index.html', 'familia.html']) {
        const h = ler(f);
        for (const proib of ['Fundador', 'Fundadora', 'Áreas de atuação', 'Atua em', 'Manutenção, PCM e gestão de ativos']) if (h.includes(proib)) bad.push(`${f}: "${proib}" sem fonte`);
        const p = await open(c, f, 100);
        const r = await p.evaluate(() => {
          const sig = e => [...e.querySelectorAll('*')].map(x => x.tagName + '.' + [...x.classList].sort().join('.')).join(' ');
          const ps = [...document.querySelectorAll('.person')];
          return { n: ps.length, sigs: ps.map(sig), nomes: ps.map(x => [((x.querySelector('.portrait .pl') || {}).textContent || '').trim(), ((x.querySelector('h2, h3') || {}).textContent || '').trim()]),
            faixa: (document.querySelector('.pessoas .faixa p') || {}).textContent || '' };
        });
        if (r.n !== 1) bad.push(`${f}: ${r.n} pessoas (esperado só Samuel)`);
        r.nomes.forEach(([pl, nome]) => { if (!nome || pl !== nome) bad.push(`${f}: retrato com rótulo "${pl}" para ${nome}`); });
        if (!/respondem com o próprio nome por cada casa de que cuidam\.$/.test(r.faixa.trim())) bad.push(`${f}: faixa sem o ajuste A5`);
        await p.close();
      }
    } finally { await c.close(); }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('REG-011: seção O nome tipográfica, sem moldura de foto vazia, com a frase revista (PT-001) e nada além do que a cliente escreveu', async () => {
    const bad = [], FRASE = 'Antes de dar nome a uma empresa, Pitangui já era o sobrenome de Sebastião Pitangui, pai de Samuel.';
    const c = await ctx(MOBILE, true);
    try {
      for (const f of ['index.html', 'familia.html']) {
        const p = await open(c, f, 100);
        const r = await p.evaluate(() => { const s = document.getElementById('o-nome');
          return { portrait: s.querySelectorAll('.portrait, img').length, txt: s.innerText.replace(/\s+/g, ' '), nomeVisivel: [...s.querySelectorAll('*')].some(e => !e.closest('.body') && (e.innerText || '').replace(/\s+/g, ' ').trim() === 'Sebastião Pitangui' && parseFloat(getComputedStyle(e).fontSize) >= 32 && /Newsreader|Cormorant|serif/.test(getComputedStyle(e).fontFamily)) }; });
        if (r.portrait) bad.push(`${f}: moldura de retrato vazia na seção O nome`);
        if (!r.txt.includes(FRASE)) bad.push(`${f}: sem a frase revista do PT-001`);
        for (const x of ['É dele o nome que a empresa carrega', 'é o nome de um homem', 'foi o nome de um homem']) if (r.txt.includes(x)) bad.push(`${f}: ainda diz "${x}"`);
        if (!r.txt.includes('Um nome que responde por si.')) bad.push(`${f}: sem a citação`);
        if (!r.nomeVisivel) bad.push(`${f}: sem o nome de Sebastião em destaque tipográfico (A10)`);
        await p.close();
      }
    } finally { await c.close(); }
    ok(!bad.length, bad.join(' | '));
  });

  await test('REG-012: sistemas sem prometer ao Essencial o que ele não inclui; nota dos Planos diz o limite do atendimento (sem plantão, chamado fora do horário)', async () => {
    const bad = [], txt = f => ler(f).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    /* a regra: todos os doze entram no Diagnóstico e cada plano define o calendário. Reescrito em 20/10/2026 (MEL-001): o dono da Sett
       ligou a abertura da seção ao fecho de "A casa" ("No Diagnóstico do Imóvel todos entram."); a frase original continua aceita */
    const SIS = /(Os doze sistemas entram no Diagnóstico do Imóvel\.|No Diagnóstico do Imóvel todos entram\.) Depois, cada plano define quais entram no calendário e com que frequência\./;
    const FORA = 'Fora do horário, o chamado fica registrado e é tratado no início do próximo expediente';
    for (const f of ['index.html', 'governanca.html']) {
      const t = txt(f);
      for (const x of ['entram no mesmo calendário', 'Cada sistema, acompanhado']) if (t.includes(x)) bad.push(`${f}: ainda diz "${x}"`);
      if (!SIS.test(t)) bad.push(`${f}: sem a frase dos doze sistemas no Diagnóstico`);
    }
    /* se algum sistema fica fora de algum plano, nenhuma frase pode pôr os doze no mesmo calendário */
    if (/data-g="(premium|periodica)"/.test(ler('index.html')) && /doze sistemas entram no mesmo/.test(txt('index.html'))) bad.push('promessa dos doze sistemas contradiz o filtro por plano');
    for (const f of ['index.html', 'planos.html']) {
      const t = txt(f);
      if (!t.includes(FORA)) bad.push(`${f}: nota dos Planos sem a regra do atendimento fora do horário`);
      if (!/sem plantão/.test(t)) bad.push(`${f}: nota dos Planos não diz que não há plantão`);
    }
    ok(!bad.length, bad.join(' | '));
  });

  await test('REG-013: Política de Privacidade completa em linguagem simples (controlador, dados, finalidade, base legal, terceiros, prazo, direitos, canal, cookies, data)', async () => {
    const h = ler('privacidade.html'), main = h.slice(h.indexOf('<main'), h.indexOf('</main>'));
    const t = main.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const secoes = [...main.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
    const exige = [
      ['quem cuida dos dados', /Quem cuida dos seus dados/i, /Pitangui Fernandes[^.]*Niterói, RJ/],
      ['dados coletados', /Que dados/i, /nome[^.]*telefone[^.]*bairro[^.]*tipo de imóvel/i],
      ['finalidade', /Para que/i, /retornar o seu contato|responder ao seu contato/i],
      ['base legal', /base legal/i, /art\. 7º, inciso V/],
      ['por onde passam', /Por onde/i, /WhatsApp[^.]*Meta/],
      ['hospedagem e exterior', null, /Vercel[\s\S]*fora do Brasil/],
      ['prazo', /quanto tempo/i, /tempo necessário/],
      ['direitos do art. 18', /direitos/i, /art\. 18[\s\S]*confirmação[\s\S]*acesso[\s\S]*correção[\s\S]*anonimização[\s\S]*portabilidade[\s\S]*eliminação[\s\S]*compartilh[\s\S]*ANPD/],
      ['cookies e rastreamento', /cookies/i, /não usa cookies/],
      ['data de atualização', null, /Última atualização: \d{1,2} de [a-zç]+ de \d{4}/],
    ];
    const bad = [];
    for (const [n, sec, txt] of exige) {
      if (sec && !secoes.some(x => sec.test(x))) bad.push(`sem a seção "${n}"`);
      if (!txt.test(t)) bad.push(`sem o conteúdo de "${n}"`);
    }
    if (!/href="https:\/\/wa\.me\/\d+"/.test(main)) bad.push('sem o canal (WhatsApp) para os pedidos');
    if (/\[|\]/.test(t)) bad.push('colchetes de campo a preencher no texto publicado');
    if (/Google/i.test(t)) bad.push('cita o Google, que o site não usa mais');
    ok(!bad.length, bad.length + ' problemas: ' + bad.join(' | '));
  });

  await test('REG-014: português e tom (PT-002 a PT-009, TOM-003, TOM-004, A1, A6, área sem "e região"); número e unidade nunca separados na quebra de linha', async () => {
    const bad = [];
    const todas = paginasHtml().filter(f => f !== 'home.html').map(f => [f, ler(f)]);
    const texto = h => h.replace(/<script[\s\S]*?<\/script>/g, ' ');
    const PROIBIDO = [
      ['Samuel ou Diana respondem', 'PT-002: "ou" de alternância pede singular'],
      [', como o olhar técnico do proprietário', 'PT-003: pilar 3 sem verbo'],
      ['remunera a gestão: visitas, fornecedores,', 'PT-004: a mensalidade não paga fornecedores'],
      ['IPCA;', 'PT-004: duas ideias unidas por ponto e vírgula'],
      ['/mês</small>', 'PT-005: "Mensalidade" e "/mês" no mesmo bloco'],
      ['Pitangui Fernandes | Governança Residencial ·', 'PT-006: dois separadores na mesma assinatura'],
      ['para <b>Pitangui Fernandes</b>', 'PT-007: faixa sem artigo'],
      ['Uma visita</dd>', 'PT-008: ficha mistura extenso e algarismo'],
      ['seis horas', 'PT-008: ficha mistura extenso e algarismo'],
      ['Solicitar uma conversa', 'PT-008: título do formulário diferente do botão'],
      ['obras e reparos e prestar contas', 'PT-009: falta a vírgula'],
      ['>OS e contratos', 'TOM-003: "OS" sem explicação'], ['>OS, contratos', 'TOM-003: "OS" sem explicação'],
      ['inventário de ativos', 'TOM-003: o entregável se chama inventário de equipamentos'], ['Principais ativos', 'TOM-003: "ativos" sem explicação'],
      ['Histórico de serviços e ativos', 'TOM-003: "ativos" sem explicação'],
      ['Tudo registrado', 'TOM-004: promessa absoluta'],
      ['e região', 'CONT-013: área de atendimento ainda não confirmada'],
    ];
    for (const [f, h] of todas) {
      const t = texto(h);
      for (const [x, why] of PROIBIDO) if (t.includes(x)) bad.push(`${f}: ${why}`);
      const sep = t.replace(/<[^>]+>/g, ' ').match(/R\$ \d|\d (?:meses|mês|dias|dia|horas|hora)\b/);
      if (sep) bad.push(`${f}: "${sep[0]}" com espaço comum (QA-019)`);
    }
    const idx = ler('index.html'), t = f => texto(ler(f));
    if (/class="seal"/.test(idx)) bad.push('index.html: selo "Empresa de família" repete Niterói ao lado do rótulo (A1)');
    /* o rótulo é lido sem as tags: desde o MEL-005 "Empresa de família" fica num span que o celular esconde para o rótulo caber numa linha */
    if (!idx.replace(/<[^>]+>/g, '').includes('Governança residencial · Empresa de família · Niterói')) bad.push('index.html: sem o rótulo único da abertura (A1)');
    if (/class="steps-note"/.test(idx)) bad.push('index.html: nota repetida na seção 04 (A6)');
    const EXIGE = [['index.html', 'Samuel ou Diana responde e marca uma conversa'], ['contato.html', 'Samuel ou Diana responde a você.'],
      ['governanca.html', 'Do conserto pontual à reforma, somos o olhar técnico do proprietário: escopo, cronograma, fiscalização, medição e entrega.'],
      ['planos.html', 'A mensalidade remunera a gestão: visitas, gestão de fornecedores, acompanhamento e relatórios.'],
      ['planos.html', 'O plano adequado é confirmado após o diagnóstico. Reajuste anual pelo IPCA, o índice oficial de inflação.'],
      ['compromissos.html', 'Histórico registrado'], ['index.html', 'para a <b>Pitangui Fernandes</b>'], ['metodo.html', '1 visita</dd>'],
      ['governanca.html', 'supervisionar obras e reparos, e prestar contas.'], ['contato.html', 'Atendemos em Niterói, RJ.']];
    for (const [f, x] of EXIGE) if (!t(f).includes(x)) bad.push(`${f}: falta "${x.slice(0, 50)}"`);
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 8).join(' | '));
  });

  await test('REG-015: nível dos planos como no kit e no motion: anel com 1, 2 e 4 pontos (visitas por mês), nos cartões e no comparativo', async () => {
    const bad = [], c = await ctx(DESKTOP);
    try {
      for (const f of ['index.html', 'planos.html']) {
        const p = await open(c, f, 100);
        const r = await p.evaluate(() => ({
          cards: [...document.querySelectorAll('.plan')].map(pl => { const l = pl.querySelector('.lvl'); return l ? [l.querySelectorAll('.d').length, l.getAttribute('aria-label'), !!l.querySelector('circle.anel')] : null; }),
          mx: [...document.querySelectorAll('.mx thead th.p1 .lvl, .mx thead th.p2 .lvl, .mx thead th.p3 .lvl')].map(l => l.querySelectorAll('.d').length) }));
        const esp = [[1, 'Uma visita por mês'], [2, 'Duas visitas por mês'], [4, 'Visitas semanais']];
        esp.forEach(([n, rot], i) => { const x = r.cards[i];
          if (!x || x[0] !== n || x[1] !== rot || !x[2]) bad.push(`${f}: cartão ${i + 1} ${JSON.stringify(x)}, esperado anel com ${n} pontos e "${rot}"`); });
        if (r.mx.join(',') !== '1,2,4') bad.push(`${f}: comparativo com ${r.mx.join(',')} pontos`);
        await p.close();
      }
    } finally { await c.close(); }
    ok(!bad.length, bad.join(' | '));
  });

  /* o botão do cabeçalho cabe inteiro, com folga das bordas, sem encostar no menu nem sair da linha */
  const medeConversar = p => p.evaluate(() => {
    const b = document.querySelector('.hdr .btn'), nav = document.querySelector('.hdr .nav'), wrap = document.querySelector('.hdr .wrap');
    if (!b || getComputedStyle(b).display === 'none') return { oculto: true };
    const r = document.createRange(); r.selectNodeContents(b); const t = r.getBoundingClientRect(), bb = b.getBoundingClientRect(), nb = nav.getBoundingClientRect(), wb = wrap.getBoundingClientRect();
    return { corte: b.scrollWidth > b.clientWidth, esq: t.left - bb.left, dir: bb.right - t.right, encosta: getComputedStyle(nav).display !== 'none' && nb.right > bb.left - 8, fora: bb.right > wb.right + .5, larg: Math.round(bb.width) };
  });
  await test('REG-017: "Conversar" do cabeçalho inteiro e com folga de 1024 a 1200 px (e de 1152 a 1300 px com fonte padrão de 18 px)', async () => {
    const bad = [];
    for (const fonte of [null, 18]) {
      const c = await ctx({ width: 1024, height: 800 }), p = await c.newPage();
      try {
        if (fonte) { const cdp = await c.newCDPSession(p); await cdp.send('Page.setFontSizes', { fontSizes: { standard: fonte, fixed: 13 } }); }
        await p.goto(U + 'governanca.html', { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready);
        const [de, ate] = fonte ? [1152, 1300] : [1024, 1200];
        for (let w = de; w <= ate; w++) {
          await p.setViewportSize({ width: w, height: 800 });
          const r = await medeConversar(p);
          if (r.oculto) { bad.push(`${w}px${fonte ? ' (18 px)' : ''}: botão oculto`); continue; }
          if (r.corte || r.esq < 12 || r.dir < 12 || r.encosta || r.fora) bad.push(`${w}px${fonte ? ' (18 px)' : ''}: ${JSON.stringify(r)}`);
        }
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' larguras com problema: ' + bad.slice(0, 4).join(' ; '));
  });

  await test('REG-018: "Conversar" no cabeçalho do celular e do tablet, ao lado do Menu (A11), sem sobrepor a marca, de 320 a 1023 px', async () => {
    const bad = [];
    for (const w of [320, 360, 390, 414, 600, 768, 1000]) {
      const c = await ctx({ width: w, height: 800 }, w < 768);
      try {
        for (const pg of ['index.html', 'governanca.html']) {
          const p = await open(c, pg, 100);
          await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 8000 });
          /* a marca entra em cerca de 1,7 s depois do ready (transição de 1 s): espera ela chegar, em vez de um tempo fixo que falha com a máquina ocupada */
          await p.waitForFunction(() => { const l = document.querySelector('.hdr .brand .lock'); return !l || getComputedStyle(l).display === 'none' || +getComputedStyle(l).opacity > .9; }, null, { timeout: 8000 }).catch(() => {});
          await p.waitForTimeout(100);
          const r = await p.evaluate(() => {
            const box = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(), cs = getComputedStyle(e);
              return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height, vis: cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > .5 }; };
            const btn = document.querySelector('.hdr .btn');
            return { btn: box('.hdr .btn'), brand: box('.hdr .brand'), lock: box('.hdr .brand .lock'), burger: box('#burger'), txt: btn && btn.textContent.trim(), corte: btn && btn.scrollWidth > btn.clientWidth, vw: innerWidth };
          });
          const sobre = (a, b) => a && b && a.l < b.r - .5 && b.l < a.r - .5 && a.t < b.b && b.t < a.b;
          const q = `${w}px ${pg}:`;
          if (!r.btn || !r.btn.vis) { bad.push(`${q} Conversar ausente`); await p.close(); continue; }
          if (r.txt !== 'Conversar') bad.push(`${q} texto "${r.txt}"`);
          if (r.corte) bad.push(`${q} texto cortado`);
          if (r.btn.h < 44) bad.push(`${q} alvo de ${Math.round(r.btn.h)} px de altura`);
          if (sobre(r.btn, r.brand)) bad.push(`${q} sobre a marca`);
          if (sobre(r.btn, r.burger)) bad.push(`${q} sobre o Menu`);
          if (r.btn.r > r.vw || (r.burger && r.burger.vis && r.burger.r > r.vw + 1)) bad.push(`${q} sai da tela`);
          if (w >= 360 && !(r.lock && r.lock.vis)) bad.push(`${q} nome da marca sumiu`);
          await p.close();
        }
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('REG-019: 320 px sem rolagem lateral nos Planos (inclusive com o comparativo aberto na home) e nome do sistema sem invadir a coluna na Governança', async () => {
    const bad = [];
    const c = await ctx({ width: 320, height: 568 }, true);
    try {
      for (const [pg, abre] of [['planos.html', false], ['index.html', true]]) {
        const p = await open(c, pg, 300);
        if (abre) { await p.evaluate(() => document.getElementById('acc-btn').click()); await p.waitForTimeout(900); }
        const r = await p.evaluate(() => ({ iw: innerWidth, sw: document.documentElement.scrollWidth }));
        if (r.iw !== 320 || r.sw > 320) bad.push(`${pg}${abre ? ' (comparativo aberto)' : ''}: página com ${Math.max(r.iw, r.sw)} px`);
        await p.close();
      }
    } finally { await c.close(); }
    for (const w of [320, 360, 375]) {
      const c2 = await ctx({ width: w, height: 740 }, true);
      try {
        const p = await open(c2, 'governanca.html', 300);
        /* invade = algum retângulo do texto do nome cruza (ou chega a menos de 4 px de) uma célula da mesma linha */
        const inv = await p.evaluate(() => [...document.querySelectorAll('.esc-rows li')].map(li => {
          const sn = li.querySelector('.sn'), r = document.createRange(); r.selectNodeContents(sn);
          const txt = [...r.getClientRects()], cel = [...li.querySelectorAll('.c')].map(c => c.getBoundingClientRect());
          let pior = -99;
          for (const a of txt) for (const b of cel) if (a.top < b.bottom && b.top < a.bottom) pior = Math.max(pior, Math.min(a.right - b.left, b.right - a.left));
          return [sn.textContent.trim(), Math.round(pior)];
        }).filter(x => x[1] > -4));
        inv.forEach(([n, d]) => bad.push(`governanca ${w}px: "${n}" invade a coluna (${d} px)`));
        await p.close();
      } finally { await c2.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  /* texto que sai da caixa de um elemento com overflow hidden/clip (o texto some de verdade); exceções explícitas */
  const CORTE_EXCECOES = ['.burger .bt' /* "Menu" e "Fechar" empilhados de propósito */, '.acc:not(.open) .acc-body > div' /* comparativo fechado */, '.sr' /* só para leitor de tela */];
  const textoCortado = (p, exc) => p.evaluate(exc => {
    const out = [], vis = e => { for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
    for (const e of document.querySelectorAll('body, body *')) {
      const cs = getComputedStyle(e), cx = /hidden|clip/.test(cs.overflowX), cy = /hidden|clip/.test(cs.overflowY);
      if ((!cx && !cy) || exc.some(s => e.matches(s)) || !e.textContent.trim() || !vis(e)) continue;
      /* botão, link, célula e texto curto com overflow escondido: o conteúdo (com o respiro interno) cabe na caixa (QA-030) */
      if (cx && e.matches('button, a, th, td, label, span, small, b, p, li, h1, h2, h3') && e.scrollWidth > e.clientWidth + 1) { out.push(`${e.tagName.toLowerCase()}.${[...e.classList].join('.')} "${e.textContent.trim().slice(0, 30)}" não cabe (${e.scrollWidth} > ${e.clientWidth})`); continue; }
      const b = e.getBoundingClientRect(), box = { l: b.left + parseFloat(cs.borderLeftWidth), r: b.right - parseFloat(cs.borderRightWidth), t: b.top + parseFloat(cs.borderTopWidth), b: b.bottom - parseFloat(cs.borderBottomWidth) };
      const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      for (let n; (n = tw.nextNode());) {
        if (!n.textContent.trim() || !vis(n.parentElement) || exc.some(s => n.parentElement.closest(s))) continue;
        const r = document.createRange(); r.selectNodeContents(n);
        const q = [...r.getClientRects()].find(q => q.width > 0 && ((cx && (q.left < box.l - 1 || q.right > box.r + 1)) || (cy && (q.top < box.t - 1 || q.bottom > box.b + 1))));
        if (q) { out.push(`${e.tagName.toLowerCase()}.${[...e.classList].join('.')} "${n.textContent.trim().slice(0, 30)}"`); break; }
      }
    }
    return out;
  }, exc);
  await test('REG-020: nenhum texto cortado em 320, 390, 1024, 1054 e 1440 px, em todas as páginas', async () => {
    const bad = [];
    for (const w of [320, 390, 1024, 1054, 1440]) {
      const c = await ctx({ width: w, height: w < 768 ? 740 : 900 }, w < 768);
      await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); } catch (e) {} });
      try {
        for (const pg of PAGES) {
          const p = await open(c, pg + '.html', 200);
          await p.evaluate(() => document.fonts.ready);
          await p.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
          await p.evaluate(() => { const i = document.getElementById('intro'); if (i) i.remove(); document.body.classList.add('ready'); document.querySelectorAll('[data-r]').forEach(e => e.classList.add('in')); });
          await p.waitForTimeout(100);
          (await textoCortado(p, CORTE_EXCECOES)).forEach(x => bad.push(`${w}px ${pg}: ${x}`));
          await p.close();
        }
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' textos cortados: ' + bad.slice(0, 6).join(' | '));
  });

  await test('REG-021: vinheta de no máximo 1 s, só na primeira visita da sessão; texto da abertura legível cedo e LCP < 2,5 s (390 px, servidor local)', async () => {
    const bad = [], c = await ctx(MOBILE, true);
    await c.addInitScript(() => {
      window.__t = {};
      const marca = () => { if (!__t.ready && document.body && document.body.classList.contains('ready')) __t.ready = performance.now(); };
      new MutationObserver(marca).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
      (function lead() { const l = document.querySelector('.hero .lead'); if (l && +getComputedStyle(l).opacity >= .99) { __t.lead = performance.now(); return; } requestAnimationFrame(lead); })();
      (function some() { const i = document.getElementById('intro'); if (document.body && (!i || !i.isConnected)) { __t.semIntro = performance.now(); return; } requestAnimationFrame(some); })();
      try { new PerformanceObserver(l => { const e = l.getEntries(); __t.lcp = e[e.length - 1].startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {}
    });
    try {
      const p = await c.newPage(); await p.goto(U + 'index.html', { waitUntil: 'load' }); await p.waitForTimeout(3500);
      const t1 = await p.evaluate(() => Object.assign({ intro: !document.documentElement.classList.contains('no-intro') }, __t));
      if (!t1.intro) bad.push('primeira visita sem a vinheta');
      if (!(t1.ready < 1200)) bad.push(`conteúdo liberado em ${Math.round(t1.ready)} ms (máx. 1200)`);
      if (!(t1.semIntro < 1300)) bad.push(`vinheta na tela até ${Math.round(t1.semIntro)} ms (máx. ~1 s de animação)`);
      if (!(t1.lead < 1800)) bad.push(`subtítulo legível em ${Math.round(t1.lead)} ms (máx. 1800)`);
      if (!(t1.lcp < 2500)) bad.push(`LCP ${Math.round(t1.lcp)} ms (máx. 2500)`);
      /* recarga e volta à home na mesma sessão: sem vinheta */
      await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
      if (await p.evaluate(() => !!document.getElementById('intro') && !document.documentElement.classList.contains('no-intro'))) bad.push('vinheta de novo na recarga');
      await p.goto(U + 'governanca.html', { waitUntil: 'load' }); await p.goto(U + 'index.html', { waitUntil: 'load' }); await p.waitForTimeout(300);
      if (await p.evaluate(() => !!document.getElementById('intro') && !document.documentElement.classList.contains('no-intro'))) bad.push('vinheta de novo ao voltar à home');
    } finally { await c.close(); }
    ok(!bad.length, bad.join(' | '));
  });

  await test('REG-022: com o menu do celular aberto, o foco do teclado não sai do menu e do cabeçalho; ao fechar, o conteúdo volta a receber foco', async () => {
    const bad = [];
    for (const pg of ['index.html', 'governanca.html']) {
      const c = await ctx(MOBILE, true);
      try {
        const p = await open(c, pg, pg === 'index.html' ? 1500 : 300);
        await p.focus('#burger'); await p.keyboard.press('Enter'); await p.waitForTimeout(450);
        if (!(await p.evaluate(() => document.body.classList.contains('menu-open')))) { bad.push(`${pg}: menu não abriu pelo teclado`); continue; }
        for (let i = 0; i < 14; i++) {
          await p.keyboard.press('Tab');
          const onde = await p.evaluate(() => { const a = document.activeElement; return a && a !== document.body ? (a.closest('#mnav, .hdr') ? '' : (a.textContent.trim().slice(0, 25) || a.tagName)) : ''; });
          if (onde) { bad.push(`${pg}: Tab ${i + 1} foi para "${onde}", atrás do menu`); break; }
        }
        await p.keyboard.press('Escape'); await p.waitForTimeout(400);
        if (await p.evaluate(() => document.querySelector('main').inert || document.querySelector('main').hasAttribute('inert'))) bad.push(`${pg}: conteúdo continua inerte depois de fechar`);
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.join(' | '));
  });

  await test('REG-023: no fim da página, o botão do WhatsApp não cobre nenhum texto do rodapé (360 a 1440 px)', async () => {
    const bad = [];
    for (const w of [360, 390, 768, 1024, 1280, 1440]) {
      const c = await ctx({ width: w, height: w < 768 ? 740 : 800 }, w < 768);
      try {
        for (const pg of ['governanca.html', 'privacidade.html']) {
          const p = await open(c, pg, 900);
          await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, document.documentElement.scrollHeight); }); await p.waitForTimeout(500);
          const hit = await p.evaluate(() => {
            const b = document.querySelector('.wa-btn').getBoundingClientRect(), out = [];
            const tw = document.createTreeWalker(document.querySelector('.foot'), NodeFilter.SHOW_TEXT);
            for (let n; (n = tw.nextNode());) { if (!n.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(n);
              for (const q of r.getClientRects()) if (q.width && q.left < b.right && b.left < q.right && q.top < b.bottom && b.top < q.bottom) { out.push(n.textContent.trim()); break; } }
            return out;
          });
          if (hit.length) bad.push(`${w}px ${pg}: cobre "${hit.join('", "')}"`);
          await p.close();
        }
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.join(' | '));
  });

  await test('REG-024: formulário: exemplo do bairro inteiro no campo; telefone aceita +55 e 0; sem JavaScript, nada de nome e telefone na URL', async () => {
    const bad = [];
    for (const w of [320, 390, 414]) {
      const c = await ctx({ width: w, height: 740 }, true);
      try {
        const p = await open(c, 'contato.html', 200);
        const r = await p.evaluate(() => { const i = document.getElementById('bairro'), cs = getComputedStyle(i), cv = document.createElement('canvas').getContext('2d');
          cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; return { ph: i.placeholder, txt: cv.measureText(i.placeholder).width, cabe: i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) }; });
        if (r.txt > r.cabe) bad.push(`${w}px: exemplo do bairro com ${Math.round(r.txt)} px num campo de ${Math.round(r.cabe)} px ("${r.ph}")`);
        if (w === 390) {
          for (const [entra, sai] of [['+55 21 98765-4321', '(21) 98765-4321'], ['021 98765 4321', '(21) 98765-4321'], ['21987654321', '(21) 98765-4321'], ['2198765432', '(21) 9876-5432'], ['55 99123-4567', '(55) 99123-4567']]) {
            await p.fill('#tel', ''); await p.fill('#tel', entra);
            const v1 = await p.inputValue('#tel'); if (v1 !== sai) bad.push(`colando "${entra}": "${v1}" (esperado "${sai}")`);
            await p.fill('#tel', ''); await p.locator('#tel').pressSequentially(entra);
            const v2 = await p.inputValue('#tel'); if (v2 !== sai) bad.push(`digitando "${entra}": "${v2}" (esperado "${sai}")`);
          }
        }
        await p.close();
      } finally { await c.close(); }
    }
    /* sem JavaScript: o formulário não aparece (nem envia para a própria página com os dados na URL) e o WhatsApp fica à mão */
    const c2 = await browser.newContext({ viewport: MOBILE, javaScriptEnabled: false });
    try {
      const p = await c2.newPage(); await p.goto(U + 'contato.html', { waitUntil: 'load' });
      const r = await p.evaluate(() => { const f = document.getElementById('form'), vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
        return { campos: ['nome', 'tel', 'bairro', 'msg'].filter(id => vis(document.getElementById(id))), botao: vis(f.querySelector('button[type=submit]')), metodo: (f.getAttribute('method') || 'get').toLowerCase(),
          wa: [...f.querySelectorAll('a[href*="wa.me"]')].some(vis) }; });
      if (r.campos.length || r.botao) bad.push(`sem JS: campos visíveis (${r.campos.join(', ')}${r.botao ? ', botão' : ''})`);
      if (r.metodo !== 'post') bad.push(`sem JS: formulário com method ${r.metodo} (os dados iriam para a URL)`);
      if (!r.wa) bad.push('sem JS: nenhum link de WhatsApp no lugar do formulário');
    } finally { await c2.close(); }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('REG-025: alvos de toque com 48 px de altura no celular (Direção de Arte 3.2), sem pontos sobrepostos no desenho da casa', async () => {
    const bad = [], c = await ctx(MOBILE, true);
    try {
      for (const pg of PAGES) {
        const p = await open(c, pg + '.html', pg === 'index' ? 1500 : 300);
        await p.addStyleTag({ content: '*,*::before,*::after{transition:none!important}' });
        await p.evaluate(() => { document.body.classList.add('ready'); document.querySelectorAll('[data-r]').forEach(e => e.classList.add('in')); });
        const r = await p.evaluate(() => {
          const out = [], vis = e => { for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
          for (const e of document.querySelectorAll('a[href], button, .seg label')) {
            if (!vis(e) || e.closest('.sr, [inert]')) continue;
            const b = e.getBoundingClientRect(); if (!b.width || !b.height) continue;
            /* link dentro de uma frase é exceção da própria WCAG 2.5.8 */
            if (e.tagName === 'A' && getComputedStyle(e).display === 'inline' && e.closest('p, small, dd')) continue;
            if (b.height < 47.5 || b.width < 24) out.push(`${e.tagName.toLowerCase()}${e.className ? '.' + String(e.className).split(' ')[0] : ''} "${(e.textContent.trim() || e.getAttribute('aria-label') || '').slice(0, 22)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
          }
          /* pontos da casa: se aparecem, não podem se sobrepor */
          const hs = [...document.querySelectorAll('.hs button')].filter(vis).map(x => x.getBoundingClientRect());
          for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) { const a = hs[i], b = hs[j];
            if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) { out.push('pontos da casa sobrepostos'); i = hs.length; break; } }
          return out;
        });
        r.forEach(x => bad.push(`${pg}: ${x}`));
        await p.close();
      }
    } finally { await c.close(); }
    if (process.env.TODOS) console.log(bad.join('\n'));
    ok(!bad.length, bad.length + ' alvos: ' + bad.slice(0, 8).join(' | '));
  });

  await test('REG-026: cabeçalho sólido opaco nos três tons; impressão legível (nada escondido pela animação, sem WhatsApp, texto escuro no papel branco)', async () => {
    const bad = [];
    { const c = await ctx(DESKTOP);
      try {
        const p = await open(c, 'index.html', 1500);
        for (const id of ['a-casa', 'governanca', 'o-nome']) {
          await p.evaluate(id => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, document.getElementById(id).offsetTop + 200); }, id); await p.waitForTimeout(700);
          const r = await p.evaluate(() => { const h = document.querySelector('.hdr'); return { solid: h.classList.contains('solid'), tom: h.getAttribute('data-tone'), bg: getComputedStyle(h).backgroundColor }; });
          const a = (r.bg.match(/rgba?\(([^)]+)\)/) || [])[1]; const alfa = a && a.split(',').length === 4 ? +a.split(',')[3] : 1;
          if (!r.solid || alfa < 1) bad.push(`cabeçalho sólido no tom ${r.tom} com fundo ${r.bg}`);
        }
      } finally { await c.close(); } }
    for (const pg of ['index.html', 'planos.html', 'contato.html', 'familia.html']) {
      const c = await browser.newContext({ viewport: { width: 800, height: 1100 } });
      try {
        const p = await c.newPage(); await p.goto(U + pg, { waitUntil: 'load' }); await p.waitForTimeout(400);
        await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(200);
        const r = await p.evaluate(() => {
          const vis = e => { for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
          const op = e => { let o = 1; for (let x = e; x && x !== document.documentElement; x = x.parentElement) o *= +getComputedStyle(x).opacity; return o; };
          const L = c => { const m = c.match(/[\d.]+/g).map(Number); const f = v => (v /= 255) <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); };
          const escondidos = [...document.querySelectorAll('[data-r], [data-h]')].filter(e => vis(e) && op(e) < .5).length;
          const claros = [];
          for (const e of document.querySelectorAll('main *, .foot *, .hdr *')) {
            if (!vis(e) || e.closest('[aria-hidden=true], .sr') || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
            if (L(getComputedStyle(e).color) > .183) claros.push(`${e.tagName.toLowerCase()} "${e.textContent.trim().slice(0, 20)}"`);
          }
          const some = s => [...document.querySelectorAll(s)].every(e => !vis(e));
          return { escondidos, claros: claros.slice(0, 3), nClaros: claros.length, wa: some('.wa'), intro: some('.intro'), skip: some('.skip'), hdr: getComputedStyle(document.querySelector('.hdr')).position };
        });
        if (r.escondidos) bad.push(`${pg} impressa: ${r.escondidos} blocos invisíveis`);
        if (r.nClaros) bad.push(`${pg} impressa: ${r.nClaros} textos claros demais para papel branco (${r.claros.join(', ')})`);
        if (!r.wa || !r.intro || !r.skip) bad.push(`${pg} impressa: WhatsApp, vinheta ou "pular" aparecem`);
        if (r.hdr !== 'static') bad.push(`${pg} impressa: cabeçalho ${r.hdr} se repete em cada folha`);
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.join(' | '));
  });

  await test('REG-027: vercel.json gerado com cabeçalhos de segurança e caminhos sem .html; 404 com estilo em qualquer profundidade', async () => {
    const bad = [], vj = fs.existsSync(path.join(ROOT, 'vercel.json')) ? JSON.parse(ler('vercel.json')) : {};
    if (vj.buildCommand) bad.push('vercel.json define buildCommand');
    const todas = (vj.headers || []).filter(r => r.source === '/(.*)' && !r.has).flatMap(r => r.headers);
    const h = k => (todas.find(x => x.key.toLowerCase() === k.toLowerCase()) || {}).value || '';
    if (h('X-Content-Type-Options') !== 'nosniff') bad.push('sem X-Content-Type-Options: nosniff');
    if (!/strict-origin-when-cross-origin|no-referrer/.test(h('Referrer-Policy'))) bad.push('sem Referrer-Policy');
    if (!/camera=\(\)/.test(h('Permissions-Policy'))) bad.push('sem Permissions-Policy');
    const csp = h('Content-Security-Policy');
    if (!/frame-ancestors 'none'/.test(csp) || !/default-src 'self'/.test(csp)) bad.push('CSP ausente ou sem frame-ancestors none');
    if (/googleapis|gstatic|unsafe-eval/.test(csp)) bad.push('CSP libera origem que o site não usa');
    if (!bad.length) {
      /* servidor que imita a Vercel (cabeçalhos, rewrites, barra final e 404) */
      const sv = await serve(ROOT, { vercel: true }), base = 'http://127.0.0.1:' + sv.address().port;
      try {
        for (const pg of ['governanca', 'planos', 'contato', 'privacidade']) {
          const r = await fetch(base + '/' + pg, { redirect: 'manual' });
          if (r.status !== 200 || !(await r.text()).includes('<h1')) bad.push(`/${pg} respondeu ${r.status}`);
        }
        const rb = await fetch(base + '/planos/', { redirect: 'manual' });
        if (![301, 308].includes(rb.status) || rb.headers.get('location') !== '/planos') bad.push(`/planos/ respondeu ${rb.status} ${rb.headers.get('location')}`);
        const c = await ctx(MOBILE, true);
        try {
          for (const u of ['/a/b/nao-existe', '/governanca.html/x']) {
            const p = await c.newPage(); const erros = []; p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) erros.push(m.text()); });
            const resp = await p.goto(base + u, { waitUntil: 'load' });
            const r = await p.evaluate(() => ({ css: [...document.styleSheets].some(s => /site\.css/.test(s.href || '') && s.cssRules.length > 50), h1: (document.querySelector('h1') || {}).textContent,
              links: [...document.querySelectorAll('main a[href]')].map(a => a.getAttribute('href')) }));
            if (resp.status() !== 404) bad.push(`${u}: status ${resp.status()}`);
            if (!r.css) bad.push(`${u}: 404 sem a folha de estilo`);
            r.links.filter(l => !/^(\/|https?:|#)/.test(l)).forEach(l => bad.push(`${u}: link relativo "${l}" quebra fora da raiz`));
            if (erros.length) bad.push(`${u}: ${erros[0].slice(0, 80)}`);
            await p.close();
          }
        } finally { await c.close(); }
      } finally { sv.close(); }
    }
    ok(!bad.length, bad.join(' | '));
  });
  await test('REG-050: CSP coerente com o HTML gerado: todo script inline e todo atributo de evento têm o sha256 na política; nenhuma violação ao navegar', async () => {
    const crypto = require('crypto'), bad = [];
    const vj = fs.existsSync(path.join(ROOT, 'vercel.json')) ? JSON.parse(ler('vercel.json')) : {};
    const csp = ((vj.headers || []).filter(r => r.source === '/(.*)' && !r.has).flatMap(r => r.headers).find(x => /content-security-policy/i.test(x.key)) || {}).value || '';
    const scriptSrc = (csp.match(/script-src ([^;]+)/) || [, ''])[1];
    if (!csp) bad.push('sem Content-Security-Policy no vercel.json');
    const sha = t => "'sha256-" + crypto.createHash('sha256').update(t, 'utf8').digest('base64') + "'";
    for (const f of paginasHtml()) {
      const hh = ler(f);
      for (const m of hh.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
        if (/application\/ld\+json/.test(m[1])) continue;
        if (!scriptSrc.includes(sha(m[2]))) bad.push(`${f}: script inline sem hash na CSP`);
      }
      for (const m of hh.matchAll(/\son[a-z]+="([^"]*)"/g)) {
        const v = m[1].replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        if (!scriptSrc.includes("'unsafe-hashes'") || !scriptSrc.includes(sha(v))) bad.push(`${f}: atributo de evento sem hash ('unsafe-hashes') na CSP`);
      }
    }
    if (!bad.length) { /* navegação real sob a CSP: menu, sanfona e formulário */
      const sv = await serve(ROOT, { vercel: true }), base = 'http://127.0.0.1:' + sv.address().port + '/', viol = [];
      const c = await ctx(MOBILE, true); await c.addInitScript(() => { window.open = () => null; });
      try {
        for (const pg of ['index.html', 'planos.html', 'contato.html', 'home.html', 'privacidade.html']) {
          const p = await c.newPage(); p.on('console', m => { if (/Content Security Policy|Refused to/.test(m.text())) viol.push(pg + ': ' + m.text().slice(0, 90)); });
          await p.goto(base + pg, { waitUntil: 'load' }); await p.waitForTimeout(400);
          if (pg === 'index.html') { await p.evaluate(() => document.getElementById('burger').click()); await p.waitForTimeout(300); }
          if (pg === 'contato.html') { await p.fill('#nome', 'Teste'); await p.fill('#tel', '21999998888'); await p.click('button[type=submit]'); await p.waitForTimeout(300); }
          await p.close();
        }
      } finally { await c.close(); sv.close(); }
      viol.forEach(v => bad.push(v));
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 5).join(' | '));
  });

  await test('REG-028: código-fonte, testes e rascunhos fora da publicação (.vercelignore); sem modelos antigos com {{marcadores}}', async () => {
    const bad = [], f = path.join(ROOT, '.vercelignore');
    const linhas = fs.existsSync(f) ? ler('.vercelignore').split('\n').map(x => x.trim().replace(/^\//, '').replace(/\/$/, '')) : [];
    if (!linhas.length) bad.push('sem .vercelignore');
    for (const x of ['src', 'tests', '.github', 'node_modules', '*.md', 'package*.json']) if (!linhas.includes(x)) bad.push(`.vercelignore não exclui ${x}`);
    for (const x of ['vercel.json', 'assets', '*.html', 'index.html']) if (linhas.includes(x)) bad.push(`.vercelignore exclui ${x}, que precisa ser publicado`);
    if (fs.existsSync(path.join(ROOT, 'src/pages'))) bad.push('src/pages (modelos antigos, não usados pelo build) ainda existe');
    const marc = (function varre(d) { return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (['node_modules', '.git'].includes(e.name) ? [] : varre(path.join(d, e.name))) : (/\.html$/.test(e.name) && /\{\{[A-Z]/.test(fs.readFileSync(path.join(d, e.name), 'utf8')) ? [path.relative(ROOT, path.join(d, e.name))] : [])); })(ROOT);
    marc.forEach(m => bad.push(`${m} tem marcadores {{...}} de modelo`));
    ok(!bad.length, bad.join(' | '));
  });

  await test('REG-029: todo arquivo em assets/ é usado pelo site gerado (nada de imagem de banco ou arquivo velho publicado)', async () => {
    const EXCECOES = []; /* acrescente aqui, com o motivo, o que precisar ser publicado sem referência */
    const corpus = paginasHtml().map(f => ler(f)).concat(['assets/css/site.css', 'assets/js/site.js', 'vercel.json'].map(f => ler(f))).join('\n');
    const arqs = (function varre(d) { return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? varre(path.join(d, e.name)) : [path.relative(ROOT, path.join(d, e.name))]); })(path.join(ROOT, 'assets'));
    const soltos = arqs.filter(a => !EXCECOES.includes(a) && !corpus.includes(a) && !corpus.includes(path.basename(a)));
    ok(!soltos.length, soltos.length + ' arquivos publicados sem uso: ' + soltos.slice(0, 8).join(', ') + (soltos.length > 8 ? '...' : ''));
  });

  await test('REG-030: README e CI conferem: comando certo, CI pega arquivo gerado novo, chaves e lançamento documentados', async () => {
    const bad = [], rd = ler('README.md'), wf = ler('.github/workflows/test.yml');
    if (/npm run build/.test(rd)) bad.push('README manda "npm run build" (o script é "gerar"; "build" é proibido pelo teste de publicação)');
    if (!/npm run gerar/.test(rd)) bad.push('README sem "npm run gerar"');
    if (!/python3 src\/build\.py/.test(wf) || !/git status --porcelain/.test(wf)) bad.push('CI não confere arquivos gerados novos (git status --porcelain)');
    const lock = fs.existsSync(path.join(ROOT, 'package-lock.json')) && require('child_process').spawnSync('git', ['-C', ROOT, 'ls-files', '--error-unmatch', 'package-lock.json']).status === 0;
    if (!lock) bad.push('package-lock.json fora do repositório');
    if (lock && !/npm ci/.test(wf)) bad.push('CI instala sem o lockfile (npm install em vez de npm ci)');
    for (const k of ['PREVIA', 'SITE', 'MOSTRAR_PRECOS', 'BALAO_WHATSAPP', 'EMAIL', 'TIPOGRAFIA', 'WHATS']) if (!rd.includes('`' + k + '`')) bad.push(`README não explica a chave ${k}`);
    if (!/PREVIA = False/.test(rd) || !/SITE = 'https:\/\/pitanguifernandes\.com\.br\/'/.test(rd) || !/CHECK_DNS=1/.test(rd)) bad.push('README sem o passo a passo do lançamento');
    if (/'pf-nav'/.test(ler('tests/layout.js'))) bad.push('layout.js usa chave morta');
    ok(!bad.length, bad.join(' | '));
  });

  /* descrição acessível de um elemento, como o leitor de tela recebe (CDP) */
  async function descricaoAcessivel(c, p, sel) {
    const cdp = await c.newCDPSession(p); await cdp.send('DOM.enable'); await cdp.send('Accessibility.enable');
    const { root } = await cdp.send('DOM.getDocument'); const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
    await cdp.detach(); return ((nodes[0] || {}).description || {}).value || '';
  }
  await test('REG-031: erros do formulário ligados aos campos (aria-describedby) e lidos como descrição pelo leitor de tela', async () => {
    const bad = [];
    for (const [pg, vp] of [['contato.html', MOBILE], ['index.html', DESKTOP]]) {
      const c = await ctx(vp, vp === MOBILE);
      try {
        const p = await open(c, pg, 300);
        await p.evaluate(() => document.getElementById('form').scrollIntoView()); await p.waitForTimeout(300);
        await p.click('#form button[type=submit]'); await p.waitForTimeout(300);
        for (const [id, msg] of [['nome', 'Como podemos chamar você?'], ['tel', 'Confira o número, com DDD.']]) {
          const ref = await p.evaluate(id => { const i = document.getElementById(id), d = i.getAttribute('aria-describedby'); return d && d.split(' ').every(x => document.getElementById(x)) ? d : null; }, id);
          if (!ref) bad.push(`${pg}: #${id} sem aria-describedby para um elemento que existe`);
          const desc = await descricaoAcessivel(c, p, '#' + id);
          if (desc !== msg) bad.push(`${pg}: descrição acessível de #${id} = "${desc}"`);
        }
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.join(' | '));
  });

  /* indicador de foco do elemento ativo: cores do contorno, dos anéis de sombra e (campos) da borda contra o que está em volta */
  const medeFoco = p => p.evaluate(() => {
    const P = c => { const m = (c || '').match(/[\d.]+/g); if (!m) return null; const v = m.map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
    const L = c => { const f = v => (v /= 255) <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
    const R = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const over = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
    const bgOf = el => { const ls = []; for (let e = el; e; e = e.parentElement) { const c = P(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { ls.push(c); if (c.a >= 1) break; } } let b = { r: 255, g: 255, b: 255, a: 1 }; for (let i = ls.length - 1; i >= 0; i--) b = over(ls[i], b); return b; };
    let el = document.activeElement; if (!el || el === document.body) return null;
    if (el.matches('.seg input')) el = el.nextElementSibling; /* a opção do tipo de imóvel desenha o foco no rótulo */
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    const cores = [], ow = cs.outlineStyle !== 'none' ? parseFloat(cs.outlineWidth) || 0 : 0, off = parseFloat(cs.outlineOffset) || 0;
    if (ow) cores.push(P(cs.outlineColor));
    let sp = 0; for (const m of (cs.boxShadow === 'none' ? '' : cs.boxShadow).matchAll(/(rgba?\([^)]*\))[^,]*?(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\s+([\d.]+)px/g)) { if (+m[5] > 1 && !/inset/.test(m[0])) { cores.push(P(m[1])); sp = Math.max(sp, +m[5]); } }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) cores.push(P(cs.borderTopColor));
    const desc = (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') + ' "' + (el.textContent || el.getAttribute('aria-label') || el.id || '').trim().slice(0, 20) + '"');
    if (!cores.length) return { desc, pior: 0, motivo: 'sem indicador' };
    let fundos = [];
    if (ow && off < 0) fundos = [bgOf(el)]; /* contorno por dentro: o fundo é o do próprio elemento */
    else { const d = Math.max(off + ow, sp) + 1.5;
      for (const [x, y] of [[r.left - d, r.top + r.height / 2], [r.right + d, r.top + r.height / 2], [r.left + r.width / 2, r.top - d], [r.left + r.width / 2, r.bottom + d]]) {
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        /* compõe os fundos de tudo o que está sob o ponto (o cabeçalho transparente fica por cima da abertura, que não é ancestral dele) */
        const pilha = document.elementsFromPoint(x, y).filter(t => t !== el && !el.contains(t)), ls = [];
        /* ponto que cai num elemento fixo por cima (cabeçalho, WhatsApp, faixa) não é o fundo do elemento focado */
        const sob = pilha[0] && pilha[0].closest('.hdr, .wa, .sett-faixa'); if (sob && !sob.contains(el)) continue;
        for (const t of pilha) { const c = P(getComputedStyle(t).backgroundColor); if (c && c.a > 0) { ls.push(c); if (c.a >= 1) break; } }
        if (pilha.length) { let b = { r: 255, g: 255, b: 255, a: 1 }; for (let i = ls.length - 1; i >= 0; i--) b = over(ls[i], b); fundos.push(b); } } }
    if (!fundos.length) return null;
    const pior = Math.min(...fundos.map(f => Math.max(...cores.filter(Boolean).map(c => R(over(c, f), f)))));
    return { desc, pior: Math.round(pior * 100) / 100 };
  });
  await test('REG-032: foco do teclado visível em todo lugar (indicador com 3:1 contra o fundo), em todas as páginas, 390 e 1440 px', async () => {
    const bad = [];
    for (const [vp, m] of [[MOBILE, true], [DESKTOP, false]]) {
      const c = await ctx(vp, m); await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); } catch (e) {} });
      try {
        for (const pg of PAGES) {
          const p = await open(c, pg + '.html', 500);
          await p.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
          await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.body.classList.add('ready'); document.querySelectorAll('[data-r]').forEach(e => e.classList.add('in')); });
          const vistos = new Set();
          for (let i = 0; i < 90; i++) {
            await p.keyboard.press('Tab');
            const r = await medeFoco(p); if (!r) continue;
            if (vistos.has(r.desc)) { if (i > 5 && r.desc === [...vistos][0]) break; continue; } vistos.add(r.desc);
            if (r.pior < 3) bad.push(`${vp.width}px ${pg}: ${r.desc} ${r.motivo || r.pior + ':1'}`);
          }
          await p.close();
        }
      } finally { await c.close(); }
    }
    if (process.env.TODOS) console.log(bad.join('\n'));
    ok(!bad.length, bad.length + ' focos fracos: ' + bad.slice(0, 6).join(' | '));
  });

  /* contraste de todo texto visível: cor do texto (com a opacidade acumulada) sobre a pilha real de fundos */
  const contrasteTudo = p => p.evaluate(() => {
    const P = c => { const m = (c || '').match(/[\d.]+/g); if (!m) return null; const v = m.map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
    const L = c => { const f = v => (v /= 255) <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
    const over = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
    const out = [], tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = tw.nextNode());) {
      const el = n.parentElement; if (!n.textContent.trim() || !el || el.closest('.sr, script, style, svg, .sett-faixa, [inert], .hdr .btn[aria-current]')) continue;
      const cs = getComputedStyle(el); let op = 1, vis = true;
      for (let x = el; x; x = x.parentElement) { const c2 = getComputedStyle(x); if (c2.display === 'none' || c2.visibility === 'hidden') { vis = false; break; } op *= +c2.opacity; }
      if (!vis || op < .05) continue;
      const r = document.createRange(); r.selectNodeContents(n); const q = [...r.getClientRects()].find(q => q.width > 2 && q.height > 2); if (!q) continue;
      const x = q.left + q.width / 2, y = q.top + q.height / 2; if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const pilha = document.elementsFromPoint(x, y), ls = [];
      /* texto coberto nesta posição da rolagem (cabeçalho fixo, WhatsApp, cabeçalho da tabela) é medido em outra parada */
      const topo = pilha[0]; if (!topo || !(topo === el || el.contains(topo) || topo.contains(el))) continue;
      for (const t of pilha) { const c = P(getComputedStyle(t).backgroundColor); if (c && c.a > 0) { ls.push(c); if (c.a >= 1) break; } }
      let fundo = { r: 255, g: 255, b: 255, a: 1 }; for (let i = ls.length - 1; i >= 0; i--) fundo = over(ls[i], fundo);
      const cor = P(cs.color); cor.a *= op; const txt = over(cor, fundo);
      const ratio = (Math.max(L(txt), L(fundo)) + .05) / (Math.min(L(txt), L(fundo)) + .05);
      const fs = parseFloat(cs.fontSize), grande = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700);
      if (ratio < (grande ? 3 : 4.5) - .02) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${n.textContent.trim().slice(0, 18)}" ${ratio.toFixed(2)}:1`);
    }
    return out;
  });
  await test('REG-033: contraste AA de todo texto visível, em todas as páginas (inclusive numerais e o filtro "Essencial" dos sistemas)', async () => {
    const bad = [];
    for (const [vp, m] of [[MOBILE, true], [DESKTOP, false]]) {
      const c = await ctx(vp, m); await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); } catch (e) {} });
      try {
        for (const pg of PAGES) {
          const p = await open(c, pg + '.html', 300);
          await p.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
          await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.body.classList.add('ready'); document.querySelectorAll('[data-r]').forEach(e => e.classList.add('in')); });
          const estados = [''];
          if (await p.$('.segp button[data-plan=essencial]')) estados.push('essencial');
          for (const est of estados) {
            if (est) await p.evaluate(() => document.querySelector('.segp button[data-plan=essencial]').click());
            const H = await p.evaluate(() => document.documentElement.scrollHeight);
            const vistos = new Set();
            for (let y = 0; y < H; y += Math.round(vp.height * .8)) {
              await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(60);
              for (const x of await contrasteTudo(p)) { const k = `${vp.width}px ${pg}${est ? ' (filtro Essencial)' : ''}: ${x}`; if (!vistos.has(x)) { vistos.add(x); bad.push(k); } }
            }
          }
          await p.close();
        }
      } finally { await c.close(); }
    }
    if (process.env.TODOS) console.log(bad.join('\n'));
    ok(!bad.length, bad.length + ' textos abaixo do AA: ' + bad.slice(0, 6).join(' | '));
  });

  await test('REG-034: campos e opções do formulário com borda de 3:1 contra o cartão (WCAG 1.4.11)', async () => {
    const bad = [], c = await ctx(MOBILE, true);
    try {
      for (const pg of ['contato.html', 'index.html']) {
        const p = await open(c, pg, 300);
        const r = await p.evaluate(() => {
          const P = c => c.match(/[\d.]+/g).map(Number), L = c => { const f = v => (v /= 255) <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
          const R = (a, b) => { const x = L(P(a)), y = L(P(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
          const fundo = getComputedStyle(document.getElementById('form')).backgroundColor;
          return [...document.querySelectorAll('#nome, #tel, #bairro, #msg, .seg span')].map(e => [e.id || e.textContent.trim(), R(getComputedStyle(e).borderTopColor, fundo), R(getComputedStyle(e).borderTopColor, getComputedStyle(e).backgroundColor)]);
        });
        r.filter(x => Math.min(x[1], x[2]) < 3).forEach(x => bad.push(`${pg}: ${x[0]} borda ${x[1].toFixed(2)}:1 no cartão, ${x[2].toFixed(2)}:1 no campo`));
        await p.close();
      }
    } finally { await c.close(); }
    ok(!bad.length, bad.join(' | '));
  });

  await test('REG-035: nenhuma animação em laço infinito (WCAG 2.2.2) e a página parada não ocupa a CPU', async () => {
    const bad = [];
    for (const [vp, m] of [[MOBILE, true], [DESKTOP, false]]) {
      const c = await ctx(vp, m);
      try {
        for (const pg of ['index.html', 'governanca.html', 'metodo.html', 'familia.html', 'contato.html']) {
          const p = await open(c, pg, 6000);
          const inf = await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getTiming().iterations === Infinity)
            .map(a => (a.animationName || a.constructor.name) + (a.effect.target ? ' em ' + (a.effect.target.className && a.effect.target.className.baseVal !== undefined ? a.effect.target.className.baseVal : a.effect.target.className) : '')));
          if (inf.length) bad.push(`${vp.width}px ${pg}: ${inf.length} animações infinitas (${[...new Set(inf)].slice(0, 4).join(', ')})`);
          if (pg === 'index.html') {
            const cdp = await c.newCDPSession(p); await cdp.send('Performance.enable');
            const td = async () => (await cdp.send('Performance.getMetrics')).metrics.find(x => x.name === 'TaskDuration').value;
            const t0 = await td(); await p.waitForTimeout(10000); const ms = Math.round((await td() - t0) * 1000);
            if (ms > 200) bad.push(`${vp.width}px index: ${ms} ms de trabalho em 10 s parada (máx. 200)`);
            await cdp.detach();
          }
          await p.close();
        }
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.join(' | '));
  });

  await test('REG-036: no comparativo do celular, cada célula diz ao leitor de tela de qual plano é (o cabeçalho da tabela fica escondido)', async () => {
    const bad = [], c = await ctx(MOBILE, true);
    try {
      for (const pg of ['planos.html', 'index.html']) {
        const p = await open(c, pg, 300);
        const r = await p.evaluate(() => {
          const theadOculto = getComputedStyle(document.querySelector('.mx thead')).display === 'none';
          const sem = [...document.querySelectorAll('.mx td')].filter(td => { const sr = td.querySelector('.sr'); return !(sr && sr.textContent.trim().startsWith(td.getAttribute('data-p'))); });
          return { theadOculto, total: document.querySelectorAll('.mx td').length, sem: sem.length, ex: sem.slice(0, 2).map(td => td.getAttribute('data-p') + ': ' + td.textContent.trim().slice(0, 20)) };
        });
        if (r.theadOculto && r.sem) bad.push(`${pg}: ${r.sem} de ${r.total} células sem o nome do plano para o leitor de tela (${r.ex.join(' ; ')})`);
        await p.close();
      }
    } finally { await c.close(); }
    ok(!bad.length, bad.join(' | '));
  });

  /* abre a página com o texto a 200% (fonte raiz dobrada antes de qualquer script) e tudo revelado */
  async function abreTexto200(c, url) {
    const p = await c.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
    await p.goto(url, { waitUntil: 'load' });
    await p.addStyleTag({ content: 'html{font-size:200%!important}*,*::before,*::after{transition:none!important;animation:none!important}' });
    await p.evaluate(() => { const i = document.getElementById('intro'); if (i) i.remove(); document.body.classList.add('ready'); document.querySelectorAll('[data-r]').forEach(e => e.classList.add('in')); dispatchEvent(new Event('resize')); });
    await p.waitForTimeout(400);
    return p;
  }
  await test('REG-037: texto a 200% sem rolagem lateral e sem texto cortado (390 e 1440 px); com preços ligados, o preço continua no cartão', async () => {
    const bad = [];
    for (const [vp, m] of [[MOBILE, true], [DESKTOP, false]]) {
      const c = await ctx(vp, m); await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); } catch (e) {} });
      try {
        for (const pg of PAGES) {
          const p = await abreTexto200(c, U + pg + '.html');
          const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
          if (r.sw > r.iw) bad.push(`${vp.width}px ${pg}: rolagem lateral de ${r.sw - r.iw} px`);
          (await textoCortado(p, CORTE_EXCECOES)).forEach(x => bad.push(`${vp.width}px ${pg}: ${x}`));
          await p.close();
        }
      } finally { await c.close(); }
    }
    { /* o preço (quando a chave estiver ligada) não pode sumir do cartão com o texto grande */
      const dir = variante({ MOSTRAR_PRECOS: true }), sv = await serve(dir), c = await ctx(MOBILE, true);
      try {
        const p = await abreTexto200(c, 'http://127.0.0.1:' + sv.address().port + '/planos.html');
        const fora = await p.evaluate(() => [...document.querySelectorAll('.plan')].filter(pl => { const v = pl.querySelector('.pv'); return v && v.getBoundingClientRect().right > pl.getBoundingClientRect().right + 1; }).length);
        if (fora) bad.push(`com MOSTRAR_PRECOS=True: ${fora} preços saem do cartão`);
      } finally { await c.close(); sv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
    }
    if (process.env.TODOS) console.log(bad.join('\n'));
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('REG-038: a primeira dobra aparece sem esperar o JavaScript (site.js atrasado 3 s: título visível e descoberto em 1 s)', async () => {
    const bad = [];
    for (const [rotulo, repete] of [['primeira visita', false], ['visita seguinte', true]]) {
      const c = await ctx(MOBILE, true);
      if (repete) await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); } catch (e) {} });
      await c.route('**/assets/js/site.js', async rt => { await new Promise(r => setTimeout(r, 3000)); await rt.continue(); });
      try {
        for (const pg of (repete ? ['index'] : PAGES)) {
          const p = await c.newPage(); await p.goto(U + pg + '.html', { waitUntil: 'commit' }); await p.waitForTimeout(1000);
          const r = await p.evaluate(() => {
            const h = document.querySelector('h1'); if (!h) return { erro: 'sem h1' };
            const op = e => { let o = 1; for (let x = e; x; x = x.parentElement) o *= +getComputedStyle(x).opacity; return o; };
            const partes = [h, ...h.querySelectorAll('*')];
            const recortado = partes.some(e => /inset\([^)]*100%/.test(getComputedStyle(e).clipPath));
            const b = h.getBoundingClientRect(), x = b.left + Math.min(b.width, 60) / 2, y = b.top + Math.min(b.height, 40) / 2;
            const topo = document.elementFromPoint(Math.max(1, x), Math.max(1, y));
            return { op: Math.min(...partes.map(op)), recortado, coberto: !!topo && !(topo === h || h.contains(topo)), por: topo && (topo.id || topo.className) };
          });
          if (r.erro) bad.push(`${pg}: ${r.erro}`);
          else if (r.op < .99 || r.recortado || r.coberto) bad.push(`${pg} (${rotulo}): título ${r.op < .99 ? 'com opacidade ' + r.op.toFixed(2) : r.recortado ? 'recortado' : 'coberto por ' + r.por}`);
          await p.close();
        }
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.join(' | '));
  });

  await test('REG-041: depois do lançamento, o endereço da prévia (vercel.app) redireciona para o domínio com 308; nunca noindex no site oficial', async () => {
    const bad = [], HOST = 'pitanguifernandes.vercel.app';
    const redir = vj => (vj.redirects || []).find(r => (r.has || []).some(h => h.type === 'host' && h.value === HOST));
    if (K.PREVIA && redir(JSON.parse(ler('vercel.json')))) bad.push('na prévia, o vercel.app não pode redirecionar (é o endereço da própria prévia)');
    const k2 = { PREVIA: false, SITE: 'https://pitanguifernandes.com.br/' }, dir = variante(k2);
    try {
      const vj = JSON.parse(ler('vercel.json', dir)), r = redir(vj);
      if (!r) bad.push('com PREVIA=False: sem redirecionamento do vercel.app para o domínio');
      else {
        if (!String(r.destination).startsWith(k2.SITE)) bad.push('destino do redirecionamento fora do SITE: ' + r.destination);
        if (r.permanent !== true && r.statusCode !== 308 && r.statusCode !== 301) bad.push('redirecionamento não é permanente');
        if (!/:path\*|\(\.\*\)/.test(r.source) || !/:path\*|\$1/.test(r.destination)) bad.push('o redirecionamento não leva o caminho da página junto');
      }
      if ((vj.headers || []).some(h => !h.has && (h.headers || []).some(x => /x-robots-tag/i.test(x.key)))) bad.push('com PREVIA=False: X-Robots-Tag global no site oficial');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    ok(!bad.length, bad.join(' | '));
  });

  await test('REG-042: o nome acessível dos links da marca contém o texto visível ("Governança residencial"), para quem usa comando de voz', async () => {
    const bad = [], c = await ctx(DESKTOP);
    try {
      for (const pg of PAGES) {
        const p = await open(c, pg + '.html', 200);
        const r = await p.evaluate(() => [...document.querySelectorAll('a.brand')].map(a => { const t = a.querySelector('.tagline'); return [a.getAttribute('aria-label') || '', t ? t.textContent.trim() : '']; }));
        r.forEach(([lab, vis]) => { if (vis && !lab.toLowerCase().includes(vis.toLowerCase())) bad.push(`${pg}: aria-label "${lab}" sem "${vis}"`); });
        await p.close();
      }
    } finally { await c.close(); }
    ok(!bad.length, bad.length + ' links: ' + bad.slice(0, 3).join(' | '));
  });

  await test('REG-043: todo conteúdo visível dentro de uma região (landmark) e regiões do mesmo tipo com nomes diferentes', async () => {
    const bad = [];
    for (const [vp, m] of [[MOBILE, true], [DESKTOP, false]]) {
      const c = await ctx(vp, m); await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); } catch (e) {} });
      try {
        for (const pg of PAGES) {
          const p = await open(c, pg + '.html', 300);
          if (vp === MOBILE && pg === 'index') { await p.evaluate(() => document.getElementById('burger').click()); await p.waitForTimeout(400); }
          const r = await p.evaluate(() => {
            const nome = e => (e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') || '').split(' ').map(id => (document.getElementById(id) || {}).textContent || '').join(' ')).trim().replace(/\s+/g, ' ');
            const papel = e => { const r = e.getAttribute('role'); if (r) return r; const t = e.tagName.toLowerCase();
              if (t === 'main') return 'main'; if (t === 'nav') return 'navigation'; if (t === 'aside') return 'complementary';
              if (t === 'header' && !e.closest('main, article, section, aside, nav')) return 'banner'; if (t === 'footer' && !e.closest('main, article, section, aside, nav')) return 'contentinfo';
              if ((t === 'section' || t === 'form') && nome(e)) return t === 'form' ? 'form' : 'region'; return null; };
            const LAND = ['main', 'navigation', 'complementary', 'banner', 'contentinfo', 'region', 'form'];
            const fora = new Set(), tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            for (let n; (n = tw.nextNode());) {
              const el = n.parentElement; if (!n.textContent.trim() || !el || el.closest('[aria-hidden=true], script, style, .skip, [inert]')) continue;
              if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
              let ok = false; for (let x = el; x; x = x.parentElement) if (LAND.includes(papel(x))) { ok = true; break; }
              if (!ok) fora.add((el.closest('[class]') || el).className.split(' ')[0] + ' "' + n.textContent.trim().slice(0, 20) + '"');
            }
            const grupos = {};
            for (const e of document.querySelectorAll('*')) { const p = papel(e); if (!LAND.includes(p) || e.closest('[aria-hidden=true]')) continue; (grupos[p] = grupos[p] || []).push(nome(e)); }
            const repetidos = Object.entries(grupos).filter(([, ns]) => ns.length > 1).flatMap(([p, ns]) => ns.filter((n, i) => ns.indexOf(n) !== i).map(n => `${p} "${n}"`));
            return { fora: [...fora].slice(0, 4), repetidos };
          });
          r.fora.forEach(x => bad.push(`${vp.width}px ${pg}: fora de região: ${x}`));
          r.repetidos.forEach(x => bad.push(`${vp.width}px ${pg}: região repetida: ${x}`));
          await p.close();
        }
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + [...new Set(bad.map(b => b.replace(/^\d+px [a-z0-9]+: /, '')))].slice(0, 6).join(' | '));
  });

  await test('REG-044: todo link que abre em nova aba avisa no nome acessível ("abre em nova aba")', async () => {
    const bad = [], c = await ctx(MOBILE, true);
    try {
      for (const pg of PAGES) {
        const p = await open(c, pg + '.html', 100);
        const r = await p.evaluate(() => [...document.querySelectorAll('a[target=_blank]')].map(a => (a.getAttribute('aria-label') || a.textContent).replace(/\s+/g, ' ').trim()).filter(n => !/\(abre em nova aba\)$/.test(n)));
        r.forEach(n => bad.push(`${pg}: "${n.slice(0, 40)}"`));
        await p.close();
      }
    } finally { await c.close(); }
    ok(!bad.length, bad.length + ' links: ' + bad.slice(0, 4).join(' | '));
  });

  await test('REG-045: títulos e descrições das páginas indexáveis: termo local, tamanho que o Google mostra inteiro, todos diferentes', async () => {
    const bad = [], titulos = new Set(), descs = new Set();
    const dec = x => x.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
    for (const pg of ['index', 'governanca', 'metodo', 'planos', 'familia', 'compromissos', 'contato']) {
      const h = ler(pg + '.html'), t = dec(attr(h, /<title>([^<]*)<\/title>/) || ''), d = dec(attr(h, /<meta name="description" content="([^"]*)"/) || '');
      if (t.length < 30 || t.length > 65) bad.push(`${pg}: título com ${t.length} caracteres ("${t}")`);
      if (!/Niterói/.test(t)) bad.push(`${pg}: título sem "Niterói" ("${t}")`);
      if (d.length < 70 || d.length > 158) bad.push(`${pg}: descrição com ${d.length} caracteres`);
      if (titulos.has(t)) bad.push(`${pg}: título repetido`); if (descs.has(d)) bad.push(`${pg}: descrição repetida`);
      titulos.add(t); descs.add(d);
    }
    ok(!bad.length, bad.join(' | '));
  });

  await test('REG-046: dados estruturados válidos, com @id, todos os endereços no SITE (menos os perfis em sameAs) e sem dado não confirmado', async () => {
    const bad = [], h = ler('index.html'), m = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!m) bad.push('home sem JSON-LD');
    else {
      const ld = JSON.parse(m[1]);
      if (ld['@type'] !== 'ProfessionalService') bad.push('@type ' + ld['@type']);
      if (ld['@id'] !== K.SITE + '#empresa') bad.push('sem @id ' + K.SITE + '#empresa');
      if (ld.url !== K.SITE) bad.push('url ' + ld.url);
      const urls = []; (function anda(o, k) { if (typeof o === 'string' && /^https?:\/\//.test(o) && k !== 'sameAs' && k !== '@context') urls.push(o); else if (o && typeof o === 'object') for (const [kk, v] of Object.entries(o)) anda(v, Array.isArray(o) ? k : kk); })(ld, '');
      urls.filter(u => !u.startsWith(K.SITE)).forEach(u => bad.push('endereço fora do SITE: ' + u));
      for (const campo of ['founder', 'aggregateRating', 'review', 'openingHours', 'priceRange']) if (campo in ld) bad.push(`campo ${campo} sem confirmação da família`);
      if (!K.EMAIL && 'email' in ld) bad.push('email com EMAIL=None');
    }
    ok(!bad.length, bad.join(' | '));
  });

  await test('REG-047: favicon.ico na raiz (os navegadores pedem) e nenhum canonical em página com noindex de verdade (404 e Política)', async () => {
    const bad = [];
    const ico = path.join(ROOT, 'favicon.ico');
    if (!fs.existsSync(ico)) bad.push('sem favicon.ico na raiz');
    else { const b = fs.readFileSync(ico); if (!(b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) || b.length > 20000) bad.push('favicon.ico não é um .ico pequeno'); }
    const sv = await serve(ROOT, { vercel: true });
    try { const r = await fetch('http://127.0.0.1:' + sv.address().port + '/favicon.ico'); if (r.status !== 200 || !/image\/(x-icon|vnd\.microsoft\.icon)/.test(r.headers.get('content-type') || '')) bad.push(`/favicon.ico respondeu ${r.status} ${r.headers.get('content-type')}`); }
    finally { sv.close(); }
    /* canonical só onde a página pode ser indexada; a prévia inteira tem noindex pela chave, então o critério é o noindex próprio da página */
    const dir = variante({ PREVIA: false });
    try {
      for (const f of paginasHtml(dir)) {
        const h = ler(f, dir), noindex = /<meta name="robots" content="[^"]*noindex/.test(h), canon = /<link rel="canonical"/.test(h);
        if (noindex && canon) bad.push(`${f}: noindex e canonical ao mesmo tempo`);
        if (!noindex && !canon) bad.push(`${f}: indexável sem canonical`);
      }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    ok(!bad.length, bad.join(' | '));
  });

  /* teto de elementos revisto em 20/10/2026 (MEL-008 e MEL-009): a home ganhou as Perguntas que ouvimos, os entregáveis do Diagnóstico e o
     aviso dos planos por decisão do dono (cerca de 50 elementos); o teto sobe de 1.650 para 1.700 com a mesma folga de antes; os bytes não mudam */
  await test('REG-048: orçamento da home: no máximo 1.700 elementos e 20 KB comprimidos (brotli, como a Vercel serve)', async () => {
    const zlib = require('zlib'), h = fs.readFileSync(path.join(ROOT, 'index.html')), br = zlib.brotliCompressSync(h).length, bad = [];
    if (br > 20 * 1024) bad.push(`index.html com ${(br / 1024).toFixed(1)} KB em brotli`);
    const c = await ctx(MOBILE, true);
    try { const p = await open(c, 'index.html', 100); const n = await p.evaluate(() => document.querySelectorAll('*').length); if (n > 1700) bad.push(`${n} elementos na home`); }
    finally { await c.close(); }
    ok(!bad.length, bad.join(' | '));
  });

  await test('REG-049: nenhum teste monta comando de shell com variável de ambiente (LAYOUT_BASE validado e passado como argumento)', async () => {
    const bad = [], lj = ler('tests/layout.js');
    if (/execSync\s*\(/.test(lj) || /exec\s*\(\s*`/.test(lj)) bad.push('layout.js usa execSync/exec com string de comando');
    if (!/execFileSync\s*\(\s*'git'/.test(lj)) bad.push('layout.js não chama o git por execFileSync com argumentos separados');
    if (!lj.includes("throw new Error('LAYOUT_BASE inválido")) bad.push('layout.js não valida o LAYOUT_BASE antes de usar');
    /* a validação de verdade: um ref malicioso é recusado antes de qualquer comando */
    const { spawnSync } = require('child_process');
    const r = spawnSync('node', ['-e', "require('./tests/layout').baseline(null).then(()=>console.log('aceitou')).catch(e=>console.log('recusou: '+e.message))"], { cwd: ROOT, env: Object.assign({}, process.env, { LAYOUT_BASE: 'main; touch /tmp/pf-injecao' }), encoding: 'utf8' });
    if (!/^recusou: LAYOUT_BASE inválido/.test(r.stdout)) bad.push('ref com ponto e vírgula não foi recusado pela validação: ' + (r.stdout + r.stderr).trim().slice(0, 80));
    ok(!bad.length, bad.join(' | '));
  });

  /* ===================================================================== Melhorias de 20/10/2026
     Decisões do dono da Sett (Bloco A) e propostas da auditoria de UX T9 (Bloco B): auditoria/T10-plano-de-melhorias.md.
     Cada teste traz o MEL-NNN do site/REGRESSOES.md (seção "Melhorias de 20/10/2026") e monta o próprio contexto (SO=MEL-NNN npm test). */
  console.log('\nMelhorias de 20/10/2026');

  /* tom de fundo de uma seção, como o cabeçalho o lê (site.js toneOf) */
  const tomDe = el => el.classList.contains('dark') || el.classList.contains('foot') ? 'dark' : el.classList.contains('bg-nevoa') ? 'nevoa' : el.classList.contains('bg-white') ? 'white' : 'sem classe de fundo';

  await test('MEL-001: a casa interativa é a terceira tela da home (seção própria, em névoa, com o texto do dono) e abre a Governança antes dos pilares; no celular o seletor fica acima do desenho', async () => {
    const bad = [];
    const TEXTO = 'São doze sistemas, e cada um costuma ter um prestador diferente. No Diagnóstico do Imóvel todos entram. Depois, cada plano define quais entram no calendário e com que frequência. Escolha um plano para ver o que ele acompanha, no desenho e na lista.';
    for (const [vp, m] of [[MOBILE, true], [DESKTOP, false]]) {
      const c = await ctx(vp, m); await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); } catch (e) {} });
      try {
        const p = await open(c, 'index.html', 300);
        const r = await p.evaluate(() => {
          const secs = [...document.querySelectorAll('main > section')], s3 = secs[2];
          const box = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
          const t = s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
          return { ids: secs.slice(0, 6).map(s => s.id), s3: s3 && { id: s3.id, house: !!s3.querySelector('.house'), tom: s3.className, lab: s3.getAttribute('aria-labelledby') },
            rotulo: t('#sistemas-da-casa .eyebrow'), titulo: t('#sistemas-da-casa h2'), texto: t('#sistemas-da-casa .head p.body'),
            govHouse: !!document.querySelector('#governanca .house'), govTom: (document.getElementById('governanca') || { className: '' }).className,
            segp: box('#sistemas-da-casa .segp'), house: box('#sistemas-da-casa .house-wrap'), lista: box('#sistemas-da-casa .sis-list'), side: box('#sistemas-da-casa .sis-side'),
            fecho: (document.querySelector('#sistemas-da-casa .sis-foot a') || { getAttribute: () => null }).getAttribute('href'), sw: document.documentElement.scrollWidth, iw: innerWidth };
        });
        const q = vp.width + 'px:';
        if (r.ids.join(',') !== 'topo,a-casa,sistemas-da-casa,governanca,como-trabalhamos,planos') bad.push(`${q} ordem das seções ${r.ids.join(',')}`);
        if (!r.s3 || !r.s3.house) bad.push(`${q} a terceira seção não tem a casa`);
        else {
          if (!/\bbg-nevoa\b/.test(r.s3.tom)) bad.push(`${q} a seção da casa não é névoa (${r.s3.tom})`);
          if (r.s3.lab !== 'h-sis') bad.push(`${q} seção da casa sem aria-labelledby=h-sis`);
        }
        if (r.rotulo !== 'A casa, sistema a sistema') bad.push(`${q} rótulo "${r.rotulo}"`);
        if (r.titulo !== 'Os doze sistemas da casa, vistos em conjunto.') bad.push(`${q} título "${r.titulo}"`);
        if (r.texto !== TEXTO) bad.push(`${q} texto de abertura "${r.texto.slice(0, 60)}"`);
        if (r.govHouse) bad.push(`${q} a seção dos pilares ainda contém a casa`);
        if (!/\bbg-white\b/.test(r.govTom)) bad.push(`${q} os pilares não voltaram para o branco (${r.govTom})`);
        if (r.fecho !== 'governanca.html#sistemas') bad.push(`${q} fecho da seção aponta para ${r.fecho}`);
        if (r.sw > r.iw) bad.push(`${q} rolagem lateral de ${r.sw - r.iw} px`);
        if (!r.segp || !r.house || !r.lista) bad.push(`${q} seletor, desenho ou lista ausentes`);
        else if (vp === MOBILE) { if (!(r.segp.top < r.house.top && r.house.top < r.lista.top)) bad.push(`${q} ordem no celular: seletor ${Math.round(r.segp.top)}, desenho ${Math.round(r.house.top)}, lista ${Math.round(r.lista.top)}`); }
        else if (!(r.house.right <= r.side.left + 1 && Math.abs(r.house.top - r.side.top) < 400)) bad.push(`${q} no desktop o desenho não fica à esquerda do seletor e da lista`);
        /* o cabeçalho troca de tom sobre a casa (névoa) e sobre os pilares (branco) */
        for (const [id, tom] of [['sistemas-da-casa', 'nevoa'], ['governanca', 'white']]) {
          await p.evaluate(id => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, document.getElementById(id).offsetTop + 200); }, id); await p.waitForTimeout(500);
          const t = await p.evaluate(() => document.querySelector('.hdr').getAttribute('data-tone'));
          if (t !== tom) bad.push(`${q} sobre #${id} o cabeçalho ficou ${t}, esperado ${tom}`);
        }
        await p.close();
        const g = await open(c, 'governanca.html', 300);
        const rg = await g.evaluate(() => {
          const sis = document.getElementById('sistemas-da-casa'), pil = document.querySelector('.pillars'), h1 = document.querySelector('h1');
          const antes = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
          return { sis: !!sis, antesPilares: antes(sis, pil), depoisTitulo: antes(h1, sis), house: !!(sis && sis.querySelector('.house')), ancoras: ['sis-eletrica', 'sis-cobertura', 'sistemas', 'sistemas-da-casa'].filter(id => !document.getElementById(id)), sw: document.documentElement.scrollWidth, iw: innerWidth };
        });
        if (!rg.sis || !rg.house) bad.push(`${q} governanca.html sem #sistemas-da-casa com a casa`);
        if (!rg.antesPilares) bad.push(`${q} governanca.html: a casa não vem antes dos pilares`);
        if (!rg.depoisTitulo) bad.push(`${q} governanca.html: a casa não vem depois do título da página`);
        if (rg.ancoras.length) bad.push(`${q} governanca.html sem as âncoras ${rg.ancoras.join(', ')}`);
        if (rg.sw > rg.iw) bad.push(`${q} governanca.html com rolagem lateral`);
        await g.close();
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('MEL-012: fundos da home alternados depois da nova ordem (nenhuma seção com o mesmo fundo da anterior; casa em névoa, pilares em branco, método em névoa, planos em branco)', async () => {
    const bad = [], c = await ctx(MOBILE, true);
    try {
      const p = await open(c, 'index.html', 100);
      /* o rodapé continua o marinho do Conversar de propósito (Direção de Arte, seção 09): só as seções entram na regra */
      const seq = await p.evaluate(() => [...document.querySelectorAll('main > section')].map(s => [s.id || s.className.split(' ')[0], s.classList.contains('dark') || s.classList.contains('foot') ? 'dark' : s.classList.contains('bg-nevoa') ? 'nevoa' : s.classList.contains('bg-white') ? 'white' : 'sem classe de fundo']));
      seq.forEach(([id, tom], i) => { if (tom === 'sem classe de fundo') bad.push(`${id}: sem classe de fundo`); if (i && seq[i - 1][1] === tom) bad.push(`${id} repete o fundo ${tom} de ${seq[i - 1][0]}`); });
      const esp = { topo: 'dark', 'a-casa': 'white', 'sistemas-da-casa': 'nevoa', governanca: 'white', 'como-trabalhamos': 'nevoa', planos: 'white', 'o-nome': 'dark', compromissos: 'nevoa', perguntas: 'white', conversar: 'dark' };
      const tons = Object.fromEntries(seq);
      for (const [id, tom] of Object.entries(esp)) { if (!(id in tons)) { if (id !== 'perguntas') bad.push(`sem a seção #${id}`); } else if (tons[id] !== tom) bad.push(`#${id} em ${tons[id]}, esperado ${tom}`); }
      await p.close();
    } finally { await c.close(); }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 8).join(' | '));
  });

  await test('MEL-002: aviso dinâmico dos planos na casa: Premium e Concierge acendem os mesmos doze sistemas e o aviso diz o que muda (visitas, cobertura e esquadrias, equipamentos críticos); Essencial mostra 5 e cita os 7 de fora', async () => {
    const bad = [];
    const nota = p => p.evaluate(() => {
      const n = document.getElementById('plan-nota'), vis = e => !!e && !e.hidden && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
      const on = [...document.querySelectorAll('#plan-nota .plan-diff dd .on')].map(x => x.textContent.trim()), outro = [...document.querySelectorAll('#plan-nota .plan-diff dd small')].map(x => x.textContent.trim());
      return { vis: vis(n), role: n && n.getAttribute('role'), live: n && n.getAttribute('aria-live'), txt: n ? n.innerText.replace(/\s+/g, ' ').trim() : '', diff: vis(document.querySelector('#plan-nota .plan-diff')), on, outro,
        dentro: [...document.querySelectorAll('.sis-list li:not(.off)')].length, sub: Object.fromEntries([...document.querySelectorAll('.sis-list li[data-g=periodica]')].map(li => [li.getAttribute('data-sys'), li.querySelector('small').textContent.trim()])),
        cobertura: (document.querySelector('.hs button[data-hs=cobertura] span') || {}).textContent, piscina: (document.querySelector('.hs button[data-hs=piscina] span') || {}).textContent,
        op: n ? +getComputedStyle(n).opacity : 0, right: n ? n.getBoundingClientRect().right : 0, iw: innerWidth, sw: document.documentElement.scrollWidth };
    });
    for (const [vp, m] of [[DESKTOP, false], [MOBILE, true]]) {
      const c = await ctx(vp, m); await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); } catch (e) {} });
      try {
        const p = await open(c, 'index.html', 300), q = vp.width + 'px:';
        await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.getElementById('sistemas-da-casa').scrollIntoView(); }); await p.waitForTimeout(300);
        let r = await nota(p);
        /* POL-001 (21/10/2026): em "Todos" o aviso não some mais; mostra o quadro do que muda entre os três planos, para a caixa
           ter sempre a mesma altura e a casa não pular (antes este teste exigia o aviso escondido em "Todos") */
        if (!r.vis || !/^Em todos os planos, os doze sistemas entram no Diagnóstico do Imóvel\. O que muda é o calendário e a frequência das visitas\./.test(r.txt)
            || !/Essencial Premium Concierge Visitas Uma por mês Duas por mês Semanais Sistemas no calendário Cinco Doze Doze Teste dos equipamentos críticos Trimestral Mensal Em toda visita/i.test(r.txt)) bad.push(`${q} Todos: aviso sem o resumo do que muda entre os planos ("${r.txt.slice(0, 70)}")`);
        if (r.diff) bad.push(`${q} Todos: comparativo Premium × Concierge aparece`);
        if (r.role !== 'status' || r.live !== 'polite') bad.push(`${q} aviso sem role=status e aria-live=polite`);
        if (r.sub.cobertura !== 'Semestral ou trimestral') bad.push(`${q} Todos: cobertura "${r.sub.cobertura}"`);
        if (!m && r.cobertura !== 'Cobertura e caixa d’água') bad.push(`${q} Todos: etiqueta do ponto "${r.cobertura}"`);
        await p.click('.segp button[data-plan=premium]'); await p.waitForTimeout(700); r = await nota(p);
        if (!r.vis || r.op < .99) bad.push(`${q} Premium: aviso não apareceu (opacidade ${r.op})`);
        if (r.dentro !== 12) bad.push(`${q} Premium: ${r.dentro} sistemas no calendário`);
        if (!/Premium e Concierge acompanham os mesmos doze sistemas\. O que muda é a presença\./.test(r.txt)) bad.push(`${q} Premium: frase "${r.txt.slice(0, 70)}"`);
        if (!r.diff || r.on.join('|') !== 'Duas por mês|Inspeção semestral|Teste mensal') bad.push(`${q} Premium: lado escolhido ${JSON.stringify(r.on)}`);
        if (r.outro.join('|') !== 'no Concierge, semanais|no Concierge, trimestral|no Concierge, em toda visita') bad.push(`${q} Premium: o outro plano ${JSON.stringify(r.outro)}`);
        if (r.sub.cobertura !== 'Semestral' || r.sub.esquadrias !== 'Semestral') bad.push(`${q} Premium: lista diz ${JSON.stringify(r.sub)}`);
        if (!m && r.cobertura !== 'Cobertura e caixa d’água · Semestral') bad.push(`${q} Premium: etiqueta do ponto "${r.cobertura}"`);
        if (r.right > r.iw + .5 || r.sw > r.iw) bad.push(`${q} Premium: aviso sai da tela (${Math.round(r.right)} de ${r.iw})`);
        await p.click('.segp button[data-plan=concierge]'); await p.waitForTimeout(700); r = await nota(p);
        if (r.dentro !== 12) bad.push(`${q} Concierge: ${r.dentro} sistemas no calendário`);
        if (!/semanais/i.test(r.txt) || !/trimestral/i.test(r.txt) || !/em toda visita/.test(r.txt)) bad.push(`${q} Concierge: aviso sem semanais/trimestral/em toda visita: "${r.txt.slice(0, 80)}"`);
        if (!r.diff || r.on.join('|') !== 'Semanais|Inspeção trimestral|Teste em toda visita') bad.push(`${q} Concierge: lado escolhido ${JSON.stringify(r.on)}`);
        if (r.outro.join('|') !== 'no Premium, duas por mês|no Premium, semestral|no Premium, mensal') bad.push(`${q} Concierge: o outro plano ${JSON.stringify(r.outro)}`);
        if (r.sub.cobertura !== 'Trimestral') bad.push(`${q} Concierge: lista diz ${r.sub.cobertura}`);
        if (!m && r.cobertura !== 'Cobertura e caixa d’água · Trimestral') bad.push(`${q} Concierge: etiqueta do ponto "${r.cobertura}"`);
        await p.click('.segp button[data-plan=essencial]'); await p.waitForTimeout(700); r = await nota(p);
        if (r.dentro !== 5) bad.push(`${q} Essencial: ${r.dentro} sistemas no calendário`);
        for (const x of ['elétrica', 'hidráulica', 'ar-condicionado', 'bombas', 'gás', 'piscina', 'jardim', 'automação', 'segurança eletrônica', 'cobertura', 'esquadrias', 'áreas externas', 'fora do calendário']) if (!r.txt.toLowerCase().includes(x)) bad.push(`${q} Essencial: aviso não cita "${x}"`);
        if (r.diff) bad.push(`${q} Essencial: comparativo Premium × Concierge aparece`);
        if (r.sub.cobertura !== 'Fora do calendário') bad.push(`${q} Essencial: lista diz ${r.sub.cobertura}`);
        if (!m && (r.cobertura !== 'Cobertura e caixa d’água · Fora do calendário' || r.piscina !== 'Piscina · Fora do calendário')) bad.push(`${q} Essencial: etiquetas "${r.cobertura}" / "${r.piscina}"`);
        /* nada cortado e nada fora da tela com o aviso aberto */
        (await textoCortado(p, CORTE_EXCECOES)).filter(x => /plan-nota|pn-/.test(x)).forEach(x => bad.push(`${q} Essencial: ${x}`));
        await p.click('.segp button[data-plan=""]'); await p.waitForTimeout(400); r = await nota(p);
        if (!r.vis || !/^Em todos os planos/.test(r.txt)) bad.push(`${q} Todos de novo: aviso sem o resumo ("${r.txt.slice(0, 50)}")`);
        if (r.sub.cobertura !== 'Semestral ou trimestral') bad.push(`${q} Todos de novo: lista diz ${r.sub.cobertura}`);
        /* teclado: o seletor é um grupo de botões; Enter troca o plano e o aviso muda */
        await p.focus('.segp button[data-plan=concierge]'); await p.keyboard.press('Enter'); await p.waitForTimeout(700); r = await nota(p);
        if (!r.vis || !/semanais/i.test(r.txt)) bad.push(`${q} pelo teclado o aviso não mudou`);
        await p.close();
      } finally { await c.close(); }
    }
    { /* movimento reduzido: o aviso aparece sem transição */
      const c = await browser.newContext({ viewport: DESKTOP, reducedMotion: 'reduce' });
      try {
        const p = await open(c, 'index.html', 300);
        await p.click('.segp button[data-plan=premium]'); await p.waitForTimeout(50);
        const r = await p.evaluate(() => { const n = document.getElementById('plan-nota'); if (!n) return { hidden: true, op: 0, td: 'sem aviso' }; const cs = getComputedStyle(n); return { op: +cs.opacity, td: cs.transitionDuration, hidden: n.hidden }; });
        if (r.hidden || r.op < .99 || r.td !== '0s') bad.push(`movimento reduzido: aviso com opacidade ${r.op} e transição ${r.td}`);
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('MEL-013: na home os itens da lista de sistemas apontam o sistema no desenho em vez de navegar (botões de 48 px); na Governança continuam âncoras para o escopo', async () => {
    const bad = [];
    for (const [vp, m] of [[MOBILE, true], [DESKTOP, false]]) {
      const c = await ctx(vp, m); await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); } catch (e) {} });
      try {
        const p = await open(c, 'index.html', 300), q = vp.width + 'px:';
        await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.body.classList.add('ready'); document.querySelectorAll('[data-r]').forEach(e => e.classList.add('in')); document.getElementById('sistemas-da-casa').scrollIntoView(); }); await p.waitForTimeout(300);
        const r = await p.evaluate(() => ({
          botoes: [...document.querySelectorAll('#sistemas-da-casa .sis-list button[type=button]')].map(b => [b.textContent.trim().length > 0, Math.round(b.getBoundingClientRect().height)]),
          links: document.querySelectorAll('#sistemas-da-casa .sis-list a').length, soLink: [...document.querySelectorAll('#sistemas-da-casa a')].map(a => a.getAttribute('href')), url: location.href }));
        if (r.botoes.length !== 12) bad.push(`${q} ${r.botoes.length} botões na lista`);
        if (r.links) bad.push(`${q} ${r.links} links na lista (não pode navegar)`);
        if (r.botoes.some(b => !b[0])) bad.push(`${q} botão sem nome`);
        if (m && r.botoes.some(b => b[1] < 48)) bad.push(`${q} botão com menos de 48 px (${r.botoes.map(b => b[1]).join(',')})`);
        if (r.soLink.join('|') !== 'governanca.html#sistemas') bad.push(`${q} links na seção: ${r.soLink.join(', ')} (só o fecho pode ser link)`);
        /* toque/clique aponta e segura; o segundo toque solta; a página não muda */
        const b = p.locator('#sistemas-da-casa .sis-list li[data-sys=piscina] button');
        if (!(await b.count())) { await p.close(); continue; }
        await b.click(); await p.waitForTimeout(350);
        let e = await p.evaluate(() => ({ on: document.querySelector('.sis-list li[data-sys=piscina]').classList.contains('on'), pick: document.querySelector('.house').classList.contains('pick'), sys: document.querySelector('.house [data-sys=piscina]').classList.contains('on'), url: location.href }));
        if (!e.on || !e.pick || !e.sys) bad.push(`${q} tocar em Piscina não apontou o sistema (${JSON.stringify(e)})`);
        if (e.url !== r.url) bad.push(`${q} tocar na lista navegou para ${e.url}`);
        await b.click(); await p.waitForTimeout(350);
        e = await p.evaluate(() => ({ on: document.querySelector('.sis-list li[data-sys=piscina]').classList.contains('on'), pick: document.querySelector('.house').classList.contains('pick') }));
        if (e.on || e.pick) bad.push(`${q} o segundo toque não soltou o sistema`);
        if (!m) { /* teclado: o foco no item aponta; ao sair, solta */
          await p.focus('#sistemas-da-casa .sis-list li[data-sys=jardim] button'); await p.waitForTimeout(200);
          if (!(await p.evaluate(() => document.querySelector('.sis-list li[data-sys=jardim]').classList.contains('on')))) bad.push(`${q} o foco no item não aponta o sistema`);
          await p.keyboard.press('Tab'); await p.waitForTimeout(200);
          if (await p.evaluate(() => document.querySelector('.sis-list li[data-sys=jardim]').classList.contains('on'))) bad.push(`${q} ao sair do item o sistema continua apontado`);
        }
        await p.close();
        const g = await open(c, 'governanca.html', 200);
        const rg = await g.evaluate(() => ({ links: [...document.querySelectorAll('#sistemas-da-casa .sis-list a')].map(a => a.getAttribute('href')), botoes: document.querySelectorAll('#sistemas-da-casa .sis-list button').length,
          quebradas: [...document.querySelectorAll('#sistemas-da-casa .sis-list a')].map(a => a.getAttribute('href')).filter(h => !document.getElementById(h.slice(1))) }));
        if (rg.links.length !== 12 || rg.links.some(h => !/^#sis-/.test(h))) bad.push(`${q} governanca.html: ${rg.links.length} âncoras #sis-*`);
        if (rg.botoes) bad.push(`${q} governanca.html: botões na lista (deveriam ser âncoras para o escopo)`);
        if (rg.quebradas.length) bad.push(`${q} governanca.html: âncoras sem destino ${rg.quebradas.join(', ')}`);
        await g.close();
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('MEL-011: ao apontar um sistema, o resto da casa esmaece a 45% e o terreno a 75% (a casa não some); o sistema apontado fica inteiro', async () => {
    const bad = [], c = await ctx(DESKTOP);
    try {
      for (const pg of ['index.html', 'governanca.html']) {
        const p = await open(c, pg, 300);
        await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.body.classList.add('ready'); document.querySelectorAll('[data-r]').forEach(e => e.classList.add('in')); document.getElementById('sistemas-da-casa').scrollIntoView(); }); await p.waitForTimeout(1200);
        await p.hover('.hs button[data-hs=piscina]'); await p.waitForTimeout(400);
        const r = await p.evaluate(() => { const h = document.querySelector('.house'), op = s => +getComputedStyle(h.querySelector(s)).opacity;
          return { pick: h.classList.contains('pick'), outro: op('[data-sys=eletrica]'), base: op('.base'), on: op('[data-sys=piscina]') }; });
        if (!r.pick) bad.push(`${pg}: o ponto não apontou o sistema`);
        if (Math.abs(r.outro - .45) > .01) bad.push(`${pg}: sistema fora de foco a ${r.outro} (esperado 0,45)`);
        if (Math.abs(r.base - .75) > .01) bad.push(`${pg}: terreno a ${r.base} (esperado 0,75)`);
        if (r.on < .99) bad.push(`${pg}: o sistema apontado está a ${r.on}`);
        await p.close();
      }
    } finally { await c.close(); }
    ok(!bad.length, bad.join(' | '));
  });

  await test('MEL-003: a seção da família mostra só Samuel (Diana pediu para não aparecer): um cartão, retrato à esquerda e texto ao lado, título "Quem responde pela sua casa."; Diana continua no texto; âncoras antiga e nova', async () => {
    const bad = [];
    for (const [vp, m] of [[MOBILE, true], [DESKTOP, false]]) {
      const c = await ctx(vp, m); await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); } catch (e) {} });
      try {
        for (const f of ['index.html', 'familia.html']) {
          const p = await open(c, f, 200), q = `${vp.width}px ${f}:`;
          await p.evaluate(() => { document.body.classList.add('ready'); document.querySelectorAll('[data-r]').forEach(e => e.classList.add('in')); });
          const r = await p.evaluate(() => {
            const sec = document.querySelector('.pessoas'), ps = [...document.querySelectorAll('.person')], t = e => (e ? e.textContent : '').replace(/\s+/g, ' ').trim();
            const box = e => e ? e.getBoundingClientRect() : null;
            return { id: sec && sec.id, n: ps.length, nome: t(ps[0] && ps[0].querySelector('h2, h3')), pl: t(ps[0] && ps[0].querySelector('.portrait .pl')),
              duoDiana: /Diana/.test(t(document.querySelector('.duo'))), eyebrow: t(sec && sec.querySelector('.eyebrow')), titulo: t(sec && sec.querySelector('h1, h2')),
              faixa: t(sec && sec.querySelector('.faixa')), antiga: !!document.getElementById('samuel-e-diana'), nova: !!document.getElementById('quem-esta-por-tras'),
              portrait: box(ps[0] && ps[0].querySelector('.portrait')), texto: box(ps[0] && ps[0].querySelector('.ptx')), wrap: box(sec && sec.querySelector('.wrap')) };
          });
          if (r.id !== 'quem-esta-por-tras') bad.push(`${q} id da seção "${r.id}"`);
          if (r.n !== 1) bad.push(`${q} ${r.n} cartões de pessoa (esperado 1, Samuel)`);
          if (r.nome !== 'Samuel' || r.pl !== 'Samuel') bad.push(`${q} cartão "${r.nome}" com retrato "${r.pl}"`);
          if (r.duoDiana) bad.push(`${q} Diana ainda aparece no cartão`);
          if (r.eyebrow !== 'Quem está por trás') bad.push(`${q} rótulo "${r.eyebrow}"`);
          if (r.titulo !== 'Quem responde pela sua casa.') bad.push(`${q} título "${r.titulo}"`);
          if (!/^Casados, empreendedores e moradores de Icaraí, em Niterói\. A Pitangui Fernandes é um negócio de casal, tocado por duas pessoas/.test(r.faixa)) bad.push(`${q} faixa mudou: "${r.faixa.slice(0, 60)}"`);
          if (!r.antiga || !r.nova) bad.push(`${q} âncoras: #samuel-e-diana ${r.antiga}, #quem-esta-por-tras ${r.nova}`);
          if (!r.portrait || !r.texto) bad.push(`${q} retrato ou texto ausentes`);
          else if (m) { if (!(r.portrait.bottom <= r.texto.top + 1)) bad.push(`${q} no celular o retrato não vem antes do texto`); }
          else {
            if (!(r.portrait.right <= r.texto.left + 1)) bad.push(`${q} no desktop o retrato não fica à esquerda do texto`);
            if (Math.abs(r.portrait.left - r.wrap.left) > 60) bad.push(`${q} o retrato não está encostado à esquerda (x ${Math.round(r.portrait.left)} vs ${Math.round(r.wrap.left)})`);
            if (!(r.texto.right > r.wrap.left + r.wrap.width * .6)) bad.push(`${q} o texto não ocupa a direita da linha`);
          }
          await p.close();
        }
      } finally { await c.close(); }
    }
    const txt = f => ler(f).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    if (!txt('contato.html').includes('Samuel ou Diana')) bad.push('contato.html: Diana saiu do texto do contato');
    if (!txt('index.html').includes('Samuel ou Diana responde')) bad.push('index.html: Diana saiu do bloco Conversar');
    if (!txt('planos.html').includes('Samuel e a herança de Sebastião Pitangui.')) bad.push('planos.html: cartão "Próximo" não diz "Samuel e a herança de Sebastião Pitangui."');
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  /* desde o POL-002 (21/10/2026) a resposta é contínua (mola amortecida, vista explodida pela proximidade, inclinação leve) em
     vez do hover V1; as verificações deste teste continuam valendo e o POL-002 cobre a fluidez e o repouso */
  await test('MEL-004: no PC, o monograma da abertura responde ao mouse (P sobe, F desce, extrusão cresce, cotas ganham presença) e volta ao sair; nada muda no fundo da abertura, no toque nem com movimento reduzido', async () => {
    const bad = [];
    const estado = p => p.evaluate(() => { const g = s => getComputedStyle(document.querySelector(s)); const hero = document.querySelector('.hero');
      return { fP: g('.hart .fP').transform, fF: g('.hart .fF').transform, dep: g('.hart .dep use').transform, cota: g('.hcota path').strokeOpacity,
        heroMx: hero.style.getPropertyValue('--mx'), heroBg: g('.hero').backgroundImage, heroBefore: getComputedStyle(hero, '::before').content }; });
    const centro = p => p.evaluate(() => { const b = document.querySelector('.hart .fP').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    for (const [rotulo, opts, vp, deveMover] of [['1440 px', {}, DESKTOP, true], ['movimento reduzido', { reducedMotion: 'reduce' }, DESKTOP, false], ['390 px (toque)', { isMobile: true, hasTouch: true }, MOBILE, false]]) {
      const c = await browser.newContext(Object.assign({ viewport: vp }, opts)); const p = await open(c, 'index.html', 300);
      try {
        /* a entrada do monograma termina em cerca de 2 s; o site.js marca hart-ok quando o hover passa a valer */
        await p.waitForFunction(() => document.documentElement.classList.contains('hart-ok'), null, { timeout: 8000 }).catch(() => {});
        await p.waitForTimeout(200);
        const antes = await estado(p);
        if (antes.fP !== 'none' || antes.fF !== 'none') { bad.push(`${rotulo}: faces fora do repouso antes do mouse (${antes.fP})`); continue; }
        const [x, y] = await centro(p); await p.mouse.move(x, y); await p.waitForTimeout(800);
        const sobre = await estado(p);
        if (deveMover) {
          if (sobre.fP === 'none' || sobre.fF === 'none' || sobre.fP === sobre.fF) bad.push(`${rotulo}: as faces não se moveram com o mouse (P ${sobre.fP}, F ${sobre.fF})`);
          if (sobre.dep === antes.dep) bad.push(`${rotulo}: a extrusão não cresceu`);
          if (+sobre.cota < .9) bad.push(`${rotulo}: cotas não se redesenharam (opacidade ${sobre.cota})`);
        } else if (sobre.fP !== 'none' || sobre.fF !== 'none' || sobre.dep !== antes.dep) bad.push(`${rotulo}: o monograma mexeu (${sobre.fP})`);
        /* o fundo da abertura não reage ao mouse (teste "sem iluminação nem destaque seguindo o ponteiro") */
        if (sobre.heroMx || sobre.heroBg !== antes.heroBg || sobre.heroBefore !== antes.heroBefore) bad.push(`${rotulo}: o fundo da abertura mudou com o mouse`);
        await p.mouse.move(5, 5); await p.waitForTimeout(1000);
        const depois = await estado(p);
        if (depois.fP !== 'none' || depois.fF !== 'none' || depois.dep !== antes.dep) bad.push(`${rotulo}: ao sair, o monograma não voltou (${depois.fP})`);
        if (deveMover) { /* nada em laço depois do hover (REG-035) */
          await p.mouse.move(x, y); await p.waitForTimeout(2000);
          const inf = await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getTiming().iterations === Infinity).length);
          if (inf) bad.push(`${rotulo}: ${inf} animações infinitas com o mouse sobre o monograma`);
          if (!(await p.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('.hero .lead')); const b = r.getBoundingClientRect(); const e = document.elementFromPoint(b.left + 20, b.top + 10); return !!e && !!e.closest('.hero-text'); }))) bad.push(`${rotulo}: o texto da abertura deixou de receber o ponteiro`);
        }
        if (p.errors.length) bad.push(`${rotulo}: ${p.errors[0]}`);
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('MEL-005: no celular, o título e o apelo da abertura entram na primeira tela (monograma menor, rótulo numa linha, indicador de rolagem estático); no desktop nada muda', async () => {
    const bad = [];
    for (const [w, h] of [[390, 844], [360, 740], [414, 896]]) {
      const c = await ctx({ width: w, height: h }, true); await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); } catch (e) {} });
      try {
        const p = await open(c, 'index.html', 300);
        await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 8000 }); await p.waitForTimeout(900);
        const r = await p.evaluate(() => {
          const b = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
          const eb = document.querySelector('.hero .eyebrow'), rg = document.createRange(); rg.selectNodeContents(eb);
          const linhas = new Set([...rg.getClientRects()].filter(q => q.width > 0).map(q => Math.round(q.top))).size;
          const hint = document.querySelector('.hero .scroll-hint'), hcs = hint && getComputedStyle(hint);
          return { h1: b('#h-hero'), link: b('.hero-foot a'), hart: b('.hart'), linhas, rotulo: eb.innerText.replace(/\s+/g, ' ').trim(), vh: innerHeight, vw: innerWidth,
            hint: hint ? { vis: hcs.display !== 'none' && hcs.visibility !== 'hidden', h: hint.getBoundingClientRect().height, w: hint.getBoundingClientRect().width, top: hint.getBoundingClientRect().top, anim: hcs.animationName, txt: hint.textContent.trim() } : null,
            inf: document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getTiming().iterations === Infinity).length };
        });
        const q = `${w}×${h}:`, alvo = h >= 844; /* a Direção de Arte (3.2) projeta para 390 px: o apelo e o indicador cabem na dobra a partir daí; em 740 px de altura vale o título */
        if (!(r.h1.top < 360)) bad.push(`${q} título começa em ${Math.round(r.h1.top)} px (máx. 360)`);
        if (alvo && !(r.link.bottom <= r.vh)) bad.push(`${q} o apelo "Conheça a nossa forma de trabalhar" termina em ${Math.round(r.link.bottom)} px, fora da tela de ${r.vh}`);
        if (r.linhas !== 1) bad.push(`${q} rótulo em ${r.linhas} linhas ("${r.rotulo}")`);
        if (r.rotulo.toLowerCase() !== 'governança residencial · niterói') bad.push(`${q} rótulo do celular "${r.rotulo}"`);
        if (!(r.hart.width >= r.vw * .5)) bad.push(`${q} monograma com ${Math.round(r.hart.width)} px (menos da metade da tela)`);
        if (!r.hint || !r.hint.vis) bad.push(`${q} sem indicador de rolagem`);
        else {
          if (r.hint.txt) bad.push(`${q} indicador com texto "${r.hint.txt}"`);
          if (!(r.hint.h >= 28 && r.hint.w <= 2)) bad.push(`${q} indicador não é um fio vertical (${Math.round(r.hint.w)}×${Math.round(r.hint.h)})`);
          if (r.hint.anim !== 'none') bad.push(`${q} indicador animado (${r.hint.anim})`);
          if (alvo && !(r.hint.top + r.hint.h <= r.vh)) bad.push(`${q} indicador fora da primeira tela`);
        }
        if (r.inf) bad.push(`${q} ${r.inf} animações em laço`);
        await p.close();
      } finally { await c.close(); }
    }
    { /* desktop: rótulo completo e sem indicador; a referência de layout em 1440 não muda */
      const c = await ctx(DESKTOP); await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); } catch (e) {} });
      try {
        const p = await open(c, 'index.html', 300);
        const r = await p.evaluate(() => ({ rotulo: document.querySelector('.hero .eyebrow').innerText.replace(/\s+/g, ' ').trim(), hint: (e => e && getComputedStyle(e).display !== 'none')(document.querySelector('.hero .scroll-hint')) }));
        if (r.rotulo.toLowerCase() !== 'governança residencial · empresa de família · niterói') bad.push(`1440px: rótulo "${r.rotulo}"`);
        if (r.hint) bad.push('1440px: indicador de rolagem aparece no desktop');
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('MEL-006: pilares sem cartão (numeral, ícone de linha e linha fina superior, como a Direção de Arte pede) e compactos no celular (numeral e ícone na linha do título; a seção da home abaixo de 1.700 px)', async () => {
    const bad = [];
    for (const [vp, m] of [[MOBILE, true], [DESKTOP, false]]) {
      const c = await ctx(vp, m); await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); } catch (e) {} });
      try {
        for (const f of ['index.html', 'governanca.html']) {
          const p = await open(c, f, 200), q = `${vp.width}px ${f}:`;
          await p.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
          await p.evaluate(() => { document.body.classList.add('ready'); document.querySelectorAll('[data-r]').forEach(e => e.classList.add('in')); });
          const r = await p.evaluate(() => {
            const ps = [...document.querySelectorAll('.pillar')], b = e => e.getBoundingClientRect();
            return { n: ps.length, sec: b(document.getElementById('governanca')).height, nn: document.querySelectorAll('.pillar .nn').length, ic: document.querySelectorAll('.pillar .ic').length,
              pil: ps.map(x => { const cs = getComputedStyle(x), t = x.querySelector('.h3'); return { bg: cs.backgroundColor, bl: cs.borderLeftWidth, bt: cs.borderTopWidth, br: cs.borderRightWidth, h: b(x).height, nnTop: b(x.querySelector('.nn')).top, icTop: b(x.querySelector('.ic')).top, tTop: b(t).top, tLeft: b(t).left, nnLeft: b(x.querySelector('.nn')).left, pTop: b(x.querySelector('p')).top, tBottom: b(t).bottom }; }) };
          });
          if (r.n !== 4 || r.nn !== 4 || r.ic !== 4) bad.push(`${q} ${r.n} pilares, ${r.nn} numerais, ${r.ic} ícones`);
          r.pil.forEach((x, i) => {
            if (!/rgba\(0, 0, 0, 0\)|transparent/.test(x.bg)) bad.push(`${q} pilar ${i + 1} com fundo de cartão (${x.bg})`);
            if (x.bl !== '0px' || x.br !== '0px') bad.push(`${q} pilar ${i + 1} com borda lateral (${x.bl}/${x.br})`);
            if (x.bt !== '1px') bad.push(`${q} pilar ${i + 1} sem a linha fina superior (${x.bt})`);
            if (m) {
              if (Math.abs(x.nnTop - x.tTop) > 24 || Math.abs(x.icTop - x.tTop) > 24) bad.push(`${q} pilar ${i + 1}: numeral/ícone fora da linha do título (${Math.round(x.nnTop)}/${Math.round(x.icTop)} vs ${Math.round(x.tTop)})`);
              if (!(x.nnLeft < x.tLeft)) bad.push(`${q} pilar ${i + 1}: numeral não fica à esquerda do título`);
              if (!(x.pTop >= x.tBottom - 1)) bad.push(`${q} pilar ${i + 1}: texto não fica abaixo do título`);
              if (x.h > 260) bad.push(`${q} pilar ${i + 1} com ${Math.round(x.h)} px`);
            } else if (x.h > 330) bad.push(`${q} pilar ${i + 1} com ${Math.round(x.h)} px (metade vazia)`);
          });
          if (m && f === 'index.html' && r.sec >= 1700) bad.push(`${q} seção dos pilares com ${Math.round(r.sec)} px (máx. 1.700)`);
          await p.close();
        }
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('MEL-010: as três ilustrações isométricas que já existiam (degraus, pilares, contrato) ilustram Como trabalhamos, O que fazemos e Compromissos, como imagem com nome acessível, tamanho declarado e sem laço', async () => {
    const bad = [], ARTES = { stairs: ['como-trabalhamos', ['index.html', 'metodo.html']], pillars: ['governanca', ['index.html', 'governanca.html']], contract: ['compromissos', ['index.html', 'compromissos.html']] };
    const build = ler('src/build.py');
    for (const [nome, [sec, pags]] of Object.entries(ARTES)) {
      const src = ler('src/art/' + nome + '.svg'), label = attr(src, /aria-label="([^"]+)"/), vb = (attr(src, /viewBox="([^"]+)"/) || '').split(/\s+/).map(Number);
      if (!new RegExp("arte\\((?:'[a-z]+', )?'" + nome + "'\\)").test(build)) bad.push(`build.py não usa ${nome}.svg`);
      const pub = path.join(ROOT, 'assets/img', nome + '.svg');
      if (!fs.existsSync(pub)) bad.push(`assets/img/${nome}.svg não publicado`);
      else {
        const pub = ler('assets/img/' + nome + '.svg');
        if (!/<style>[^<]*\.ln\{[^}]*stroke/.test(pub)) bad.push(`assets/img/${nome}.svg sem o estilo de traço (como imagem, não herda o CSS do site)`);
        /* sem o namespace o navegador lê o arquivo como XML qualquer e a imagem sai vazia; sem width/height não há tamanho natural */
        if (!/<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(pub) || !/<svg[^>]*\swidth="\d+"[^>]*\sheight="\d+"/.test(pub)) bad.push(`assets/img/${nome}.svg sem xmlns ou sem width/height no <svg>`);
      }
      for (const f of pags) {
        const h = ler(f), m = h.match(new RegExp('<section[^>]*id="' + sec + '"[\\s\\S]*?</section>'));
        const img = m && m[0].match(/<figure class="arte[^"]*"[^>]*data-r[^>]*>\s*<img ([^>]*)>/);
        if (!img) { bad.push(`${f}: #${sec} sem a figura com ${nome}.svg`); continue; }
        const a = img[1];
        if (!a.includes('assets/img/' + nome + '.svg')) bad.push(`${f}: figura de #${sec} não usa ${nome}.svg`);
        if (attr(a, /alt="([^"]*)"/) !== label) bad.push(`${f}: alt "${attr(a, /alt="([^"]*)"/)}" diferente do aria-label do desenho`);
        if (+attr(a, /width="(\d+)"/) !== Math.round(vb[2]) || +attr(a, /height="(\d+)"/) !== Math.round(vb[3])) bad.push(`${f}: ${nome} sem width/height do viewBox`);
        if (!/loading="lazy"/.test(a)) bad.push(`${f}: ${nome} sem loading=lazy`);
      }
    }
    for (const [vp, m] of [[MOBILE, true], [DESKTOP, false]]) {
      const c = await ctx(vp, m); await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); } catch (e) {} });
      try {
        const p = await open(c, 'index.html', 300);
        await p.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
        await p.evaluate(() => { document.body.classList.add('ready'); document.querySelectorAll('[data-r]').forEach(e => e.classList.add('in')); });
        /* as imagens são lazy: fora da tela não carregam sozinhas; força o carregamento e espera no máximo 5 s */
        await p.evaluate(() => Promise.race([Promise.all([...document.querySelectorAll('.arte img')].map(i => { i.loading = 'eager'; return i.complete ? null : new Promise(r => { i.onload = i.onerror = r; }); })), new Promise(r => setTimeout(r, 5000))]));
        const r = await p.evaluate(() => [...document.querySelectorAll('.arte img')].map(i => { const f = i.closest('.arte'), w = f.closest('.wrap').getBoundingClientRect(), b = i.getBoundingClientRect(), t = f.closest('section').querySelector('h2, h1').getBoundingClientRect();
          return { ok: i.complete && i.naturalWidth > 0 && b.height > 10, w: b.width / w.width, dir: b.left >= w.left + w.width / 2, abaixo: b.top >= t.bottom - 1, op: +getComputedStyle(f).opacity }; }));
        if (r.length !== 3) bad.push(`${vp.width}px: ${r.length} ilustrações na home`);
        r.forEach((x, i) => {
          if (!x.ok) bad.push(`${vp.width}px: ilustração ${i + 1} não carregou`);
          if (x.op < .99) bad.push(`${vp.width}px: ilustração ${i + 1} escondida`);
          if (m && (x.w < .5 || x.w > .7)) bad.push(`${vp.width}px: ilustração ${i + 1} com ${Math.round(x.w * 100)}% da largura (esperado cerca de 60%)`);
          if (m && !x.abaixo) bad.push(`${vp.width}px: ilustração ${i + 1} não fica abaixo do título`);
          if (!m && !x.dir) bad.push(`${vp.width}px: ilustração ${i + 1} não fica na metade direita`);
        });
        await p.close();
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('MEL-009: os seis entregáveis do Diagnóstico aparecem na home, sob a linha do tempo, idênticos aos da página Método (uma lista só no build)', async () => {
    const bad = [], ENTREGA = ['Inventário de equipamentos, com fotos', 'Nota de estado por sistema', 'Lista de riscos priorizada: urgente, 90 dias e 12 meses', 'Plano preventivo anual', 'Estimativa de custos de correções e investimentos', 'Recomendação do plano mais adequado'];
    const itens = (f, sel) => { const h = ler(f), m = h.match(new RegExp('<ul class="' + sel + '"[^>]*>([\\s\\S]*?)</ul>')); return m ? [...m[1].matchAll(/<li>(?:<i[^>]*><\/i>)?([\s\S]*?)<\/li>/g)].map(x => x[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()) : null; };
    const home = itens('index.html', 'entrega'), met = itens('metodo.html', 'list');
    if (!home) bad.push('home sem a lista "O Diagnóstico entrega"');
    else {
      if (home.join('|') !== ENTREGA.join('|')) bad.push('home: itens ' + JSON.stringify(home));
      if (!met || met.join('|') !== home.join('|')) bad.push('metodo.html: lista diferente da home (' + JSON.stringify(met) + ')');
    }
    const sec = (ler('index.html').match(/<section[^>]*id="como-trabalhamos"[\s\S]*?<\/section>/) || [''])[0];
    if (!/O Diagnóstico entrega/.test(sec)) bad.push('home: sem o rótulo "O Diagnóstico entrega"');
    if (!/href="metodo\.html#diagnostico"/.test(sec)) bad.push('home: o link para o Diagnóstico sumiu');
    if (/\d (?:meses|dias)\b/.test(sec.replace(/<[^>]+>/g, ' '))) bad.push('home: número e unidade separáveis (REG-014)');
    for (const [vp, m] of [[MOBILE, true], [DESKTOP, false]]) {
      const c = await ctx(vp, m); await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); } catch (e) {} });
      try {
        const p = await open(c, 'index.html', 200);
        await p.evaluate(() => { document.body.classList.add('ready'); document.querySelectorAll('[data-r]').forEach(e => e.classList.add('in')); });
        const r = await p.evaluate(() => { const li = [...document.querySelectorAll('#como-trabalhamos .entrega li')], b = e => e.getBoundingClientRect();
          const steps = b(document.querySelector('#como-trabalhamos .steps')), cols = new Set(li.map(l => Math.round(b(l).left)));
          return { n: li.length, abaixo: li.every(l => b(l).top >= steps.bottom - 1), cols: cols.size, marcador: li.every(l => getComputedStyle(l, '::before').clipPath !== 'none') }; });
        if (r.n !== 6) bad.push(`${vp.width}px: ${r.n} itens`);
        if (!r.abaixo) bad.push(`${vp.width}px: a lista não fica abaixo da linha do tempo`);
        if (m ? r.cols !== 1 : r.cols !== 3) bad.push(`${vp.width}px: ${r.cols} colunas (esperado ${m ? 1 : 3})`);
        if (!r.marcador) bad.push(`${vp.width}px: item sem o losango`);
        await p.close();
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('MEL-008: seção "Perguntas que ouvimos" na home (branco, depois dos Compromissos): seis perguntas com as respostas das regras comerciais da cliente sem "hip.", sem valores nem prazos, em details acessíveis', async () => {
    const bad = [];
    const FAQ = [
      ['O que a mensalidade cobre?', 'Gestão, inspeção e relatórios. Não cobre serviços de terceiros, materiais e obras.'],
      ['Como funcionam os repasses?', 'Ao custo, com comprovante, mais a taxa de coordenação ou de supervisão declarada em contrato.'],
      ['Vocês recebem comissão de fornecedor?', 'Não. A comissão de fornecedor é proibida, e isso consta do contrato.'],
      ['Quem responde pelos serviços que exigem responsável técnico?', 'Atividades que exigem responsável técnico (ART/RRT) são executadas por profissional habilitado.'],
      ['Posso mudar para um plano maior?', 'A qualquer momento, com abatimento das visitas já realizadas.'],
      ['E se eu encerrar o contrato?', 'Você recebe o histórico e o inventário da casa.'],
    ];
    const h = ler('index.html'), sec = (h.match(/<section[^>]*id="perguntas"[\s\S]*?<\/section>/) || [''])[0];
    if (!sec) bad.push('home sem a seção #perguntas');
    else {
      const t = x => x.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      const ds = [...sec.matchAll(/<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)].map(m => [t(m[1]), t(m[2])]);
      if (ds.length !== 6) bad.push(`${ds.length} perguntas`);
      FAQ.forEach(([q, a], i) => { if (!ds[i] || ds[i][0] !== q || ds[i][1] !== a) bad.push(`pergunta ${i + 1}: ${JSON.stringify(ds[i])}`); });
      for (const x of ['R$', '500', 'hip', '24 horas', 'dias', 'horas', 'h às']) if (t(sec).includes(x)) bad.push(`a seção cita "${x}" (hipótese ou valor que não entra)`);
      if (!/class="sec bg-white/.test(sec)) bad.push('seção não é branca');
      if (!/aria-labelledby="h-faq"/.test(sec) || !/id="h-faq"/.test(sec)) bad.push('seção sem título ligado');
      if (!/Perguntas que ouvimos/.test(sec)) bad.push('sem o título "Perguntas que ouvimos"');
      const ordem = [...h.matchAll(/<section[^>]*id="([^"]+)"/g)].map(m => m[1]);
      if (ordem.indexOf('perguntas') !== ordem.indexOf('compromissos') + 1 || ordem.indexOf('conversar') !== ordem.indexOf('perguntas') + 1) bad.push('a seção não fica entre Compromissos e Conversar (' + ordem.join(',') + ')');
    }
    for (const [vp, m] of [[MOBILE, true], [DESKTOP, false]]) {
      const c = await ctx(vp, m); await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); } catch (e) {} });
      try {
        const p = await open(c, 'index.html', 200), q = vp.width + 'px:';
        if (!(await p.$('#perguntas'))) { bad.push(`${q} sem a seção`); await p.close(); continue; }
        await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.body.classList.add('ready'); document.querySelectorAll('[data-r]').forEach(e => e.classList.add('in')); document.getElementById('perguntas').scrollIntoView(); });
        const r = await p.evaluate(() => [...document.querySelectorAll('#perguntas details')].map(d => { const s = d.querySelector('summary'), b = s.getBoundingClientRect(); return { h: b.height, open: d.open, fs: parseFloat(getComputedStyle(s).fontSize), serif: /Cormorant|Newsreader|serif/.test(getComputedStyle(s).fontFamily) }; }));
        if (r.some(x => x.open)) bad.push(`${q} pergunta aberta antes do clique`);
        if (m && r.some(x => x.h < 48)) bad.push(`${q} resumo com menos de 48 px (${r.map(x => Math.round(x.h)).join(',')})`);
        if (r.some(x => !x.serif || x.fs < 20)) bad.push(`${q} resumo não está em serifa de 20 px ou mais`);
        /* teclado: Tab chega ao resumo, Enter abre, Enter fecha */
        await p.focus('#perguntas details:first-of-type summary'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
        if (!(await p.evaluate(() => document.querySelector('#perguntas details').open))) bad.push(`${q} Enter não abriu a pergunta`);
        const vis = await p.evaluate(() => { const a = document.querySelector('#perguntas details p'); return a && a.getClientRects().length > 0 && getComputedStyle(a).visibility !== 'hidden'; });
        if (!vis) bad.push(`${q} resposta não aparece ao abrir`);
        /* POL-012 (22/10/2026): o fechamento é animado (cerca de 0,4 s) e o details fecha no fim da animação; antes a espera era de 150 ms */
        await p.keyboard.press('Enter'); await p.waitForTimeout(700);
        if (await p.evaluate(() => document.querySelector('#perguntas details').open)) bad.push(`${q} Enter não fechou a pergunta`);
        await p.close();
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('MEL-014: a nota comercial dos Planos vira três itens rotulados (Mensalidade / Repasses e Diagnóstico / Atendimento), em 14 px, com as mesmas frases e constantes', async () => {
    const bad = [];
    for (const f of ['index.html', 'planos.html']) {
      const h = ler(f), foot = (h.match(/<div class="plans-foot">[\s\S]*?<\/section>/) || [''])[0], t = x => x.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      const dts = [...foot.matchAll(/<dt>([^<]*)<\/dt>/g)].map(m => m[1]), dds = [...foot.matchAll(/<dd>([\s\S]*?)<\/dd>/g)].map(m => t(m[1]));
      if (dts.join('|') !== 'Mensalidade|Repasses e Diagnóstico|Atendimento') bad.push(`${f}: rótulos ${JSON.stringify(dts)}`);
      if (/<p>/.test((foot.match(/<dl[\s\S]*?<\/dl>|<div class="note"[\s\S]*?<\/div>/) || [''])[0])) bad.push(`${f}: a nota ainda é em parágrafos`);
      if (!/A mensalidade remunera a gestão: visitas, gestão de fornecedores, acompanhamento e relatórios\. O plano adequado é confirmado após o diagnóstico\. Reajuste anual pelo IPCA, o índice oficial de inflação\./.test(dds[0] || '')) bad.push(`${f}: Mensalidade "${(dds[0] || '').slice(0, 60)}"`);
      if (!/repassados ao custo, com comprovante, mais a taxa de coordenação ou de supervisão declarada em contrato\. O valor do Diagnóstico é abatido, no todo ou em parte/.test(dds[1] || '')) bad.push(`${f}: Repasses e Diagnóstico "${(dds[1] || '').slice(0, 60)}"`);
      if (!/^O atendimento segue o horário de expediente de cada plano, sem plantão de 24 horas\./.test(dds[2] || '')) bad.push(`${f}: Atendimento "${(dds[2] || '').slice(0, 60)}"`);
      if (f === 'planos.html' && !/ART\/RRT/.test(dds[2] || '')) bad.push('planos.html: a ressalva de ART/RRT saiu do item Atendimento');
      if (f === 'index.html' && /ART\/RRT/.test(dds[2] || '')) bad.push('index.html: a ressalva de ART/RRT está duas vezes (na nota e nas Perguntas)');
    }
    const c = await ctx(MOBILE, true);
    try {
      for (const f of ['index.html', 'planos.html']) {
        const p = await open(c, f, 200);
        const r = await p.evaluate(() => [...document.querySelectorAll('.plans-foot dd')].map(d => parseFloat(getComputedStyle(d).fontSize)));
        if (r.length !== 3 || r.some(x => x < 14)) bad.push(`${f}: tamanhos ${r.join(',')} px (mínimo 14)`);
        await p.close();
      }
    } finally { await c.close(); }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('MEL-007: espaços de foto pela chave FOTOS: vazia, nenhuma foto nem moldura vazia; com um slot preenchido, <picture> com width/height, alt, srcset coerente e carregamento tardio (menos a abertura)', async () => {
    const bad = [], build = ler('src/build.py');
    if (!/^FOTOS = \{/m.test(build)) bad.push('chave FOTOS ausente no topo do build.py');
    for (const slot of ['hero', 'detalhe', 'vistoria', 'sebastiao', 'samuel']) if (!new RegExp("'" + slot + "':\\s*dict\\(").test(build)) bad.push(`slot ${slot} não definido em SLOTS`);
    const vazia = /^FOTOS = \{\}/m.test(build);
    if (vazia) for (const f of paginasHtml()) {
      const h = ler(f);
      if (/<picture|class="foto/.test(h)) bad.push(`${f}: foto publicada com FOTOS vazio`);
      for (const m of h.matchAll(/<img ([^>]*)>/g)) if (!/sett-branco\.png|assets\/img\//.test(m[1])) bad.push(`${f}: imagem inesperada (${m[1].slice(0, 50)})`);
    }
    if (!bad.length) { /* variante com Samuel e Sebastião preenchidos: a foto é gerada aqui mesmo (JPEG 1600×2000 pelo navegador) */
      const temPillow = require('child_process').spawnSync('python3', ['-c', 'import PIL'], { stdio: 'pipe' }).status === 0;
      const c0 = await browser.newContext({ viewport: { width: 800, height: 1000 }, deviceScaleFactor: 2 });
      const jpg = await (async () => { const p = await c0.newPage(); await p.setContent('<body style="margin:0;background:linear-gradient(160deg,#6b7a90,#2c3e5a)"><div style="position:absolute;left:30%;top:20%;width:40%;height:50%;background:#d9c7b0;border-radius:40%"></div></body>'); const b = await p.screenshot({ type: 'jpeg', quality: 80 }); await p.close(); return b; })();
      await c0.close();
      const dir = variante({ FOTOS: { samuel: 'samuel.jpg', sebastiao: 'sebastiao.jpg' } }, d => { fs.mkdirSync(path.join(d, 'src/fotos'), { recursive: true }); for (const n of ['samuel', 'sebastiao']) fs.writeFileSync(path.join(d, 'src/fotos', n + '.jpg'), jpg); });
      const sv = await serve(dir), base = 'http://127.0.0.1:' + sv.address().port + '/';
      try {
        for (const f of ['index.html', 'familia.html']) {
          const h = ler(f, dir);
          for (const [slot, sel] of [['samuel', /<div class="portrait[^"]*"[^>]*>\s*<picture class="foto foto-samuel"[^>]*>\s*<img ([^>]*)>/], ['sebastiao', /<section[^>]*id="o-nome"[\s\S]*?<picture class="foto foto-sebastiao"[^>]*>\s*<img ([^>]*)>/]]) {
            const m = h.match(sel); if (!m) { bad.push(`${f}: sem a <picture> de ${slot}`); continue; }
            const a = m[1], w = +attr(a, /width="(\d+)"/), hh = +attr(a, /height="(\d+)"/), alt = attr(a, /alt="([^"]*)"/), srcset = attr(a, /srcset="([^"]*)"/), src = attr(a, /src="([^"]*)"/);
            if (!w || !hh || Math.abs(hh - w * 5 / 4) > 2) bad.push(`${f}: ${slot} com ${w}×${hh}, fora de 4:5`);
            if (!alt) bad.push(`${f}: ${slot} sem alt`);
            if (!/loading="lazy"/.test(a)) bad.push(`${f}: ${slot} sem loading=lazy`);
            if (!src || !fs.existsSync(path.join(dir, src))) bad.push(`${f}: ${slot} aponta para arquivo inexistente (${src})`);
            const cand = (srcset || '').split(',').map(x => x.trim().split(/\s+/));
            if (!cand.length || cand.some(([u, d]) => !fs.existsSync(path.join(dir, u)) || !/^\d+w$/.test(d || ''))) bad.push(`${f}: srcset de ${slot} com arquivo inexistente ou sem descritor (${srcset})`);
            if (temPillow && (cand.length < 2 || cand.some(([u]) => !/\.webp$/.test(u)))) bad.push(`${f}: com o Pillow instalado, ${slot} deveria ter 2 larguras em WebP (${srcset})`);
            if (temPillow) { const maior = cand[cand.length - 1]; if (fs.statSync(path.join(dir, maior[0])).size > 300 * 1024) bad.push(`${f}: ${slot} com mais de 300 KB`); }
          }
          if (/<span class="pl">Sebastião/.test(h)) bad.push(`${f}: nome escrito dentro da moldura (a foto já está lá)`);
        }
        const c = await ctx(DESKTOP); await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); } catch (e) {} });
        try {
          const p = await c.newPage(); const erros = []; p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
          await p.goto(base + 'familia.html', { waitUntil: 'load' }); await p.waitForTimeout(400);
          await p.evaluate(() => { document.body.classList.add('ready'); document.querySelectorAll('[data-r]').forEach(e => e.classList.add('in')); });
          await p.evaluate(() => Promise.all([...document.querySelectorAll('.foto img')].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; }))));
          const r = await p.evaluate(() => [...document.querySelectorAll('.portrait')].map(pt => { const i = pt.querySelector('img'), a = pt.getBoundingClientRect(), b = i && i.getBoundingClientRect();
            return { img: !!i, ok: !!i && i.naturalWidth > 0, cobre: !!b && Math.abs(b.width - a.width) < 2 && Math.abs(b.height - a.height) < 2, fit: i && getComputedStyle(i).objectFit, pl: !!pt.querySelector('.pl'), moldura: getComputedStyle(pt, '::after').display }; }));
          if (r.length !== 2) bad.push(`familia.html: ${r.length} retratos (esperado Sebastião e Samuel)`);
          r.forEach((x, i) => { if (!x.img || !x.ok) bad.push(`familia.html: retrato ${i + 1} sem imagem carregada`); if (!x.cobre || x.fit !== 'cover') bad.push(`familia.html: retrato ${i + 1} não cobre a moldura (${x.fit})`); if (x.pl) bad.push(`familia.html: retrato ${i + 1} ainda tem o nome escrito por cima`); if (x.moldura !== 'none') bad.push(`familia.html: retrato ${i + 1} com fio decorativo sobre a foto`); });
          if (erros.length) bad.push('familia.html: ' + erros[0].slice(0, 80));
        } finally { await c.close(); }
      } finally { sv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });


  /* ===================================================================== POLIMENTO DE 21/10/2026
     Pedido do dono da Sett depois de ver a rodada de melhorias: (1) seções com muito espaço em branco, sobretudo no ultrawide,
     conferindo todas as resoluções; (2) a casa interativa muda de lugar ao trocar de plano; (3) o movimento do monograma ao passar o
     mouse precisa ser fluido e fazer sentido. Cada teste traz o POL-NNN do site/REGRESSOES.md (SO=POL-001 npm test). */
  console.log('\nPolimento de 21/10/2026');
  const ULTRA = { width: 2560, height: 1080 }, ULTRA2 = { width: 3440, height: 1440 }, FHD = { width: 1920, height: 1080 };
  /* abre a página já revelada: sem vinheta, blocos visíveis, imagens lazy carregadas (rola a página inteira uma vez) */
  async function aberta(c, pg) {
    await c.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); sessionStorage.setItem('pf-wa-x', '1'); } catch (e) {} });
    const p = await open(c, pg, 300);
    await p.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto';
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight * .6) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0);
      document.body.classList.add('ready'); document.querySelectorAll('[data-r],[data-h]').forEach(e => e.classList.add('in')); });
    await p.evaluate(() => Promise.all([...document.images].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; }))));
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(700);
    return p;
  }

  /* 21/10/2026, validação T13 (achado B1): a lista mudava de altura em 320, 360 e 1024 px; o teste passou a cobrir essas telas */
  await test('POL-001: ao trocar de plano, a casa interativa não muda de lugar: desenho, seletor e lista ficam parados (home e Governança, 320, 360, 390, 1024, 1440 e 2560 px)', async () => {
    const bad = [];
    for (const [pg, vp, m] of [['index.html', { width: 320, height: 568 }, true], ['index.html', { width: 360, height: 740 }, true], ['index.html', MOBILE, true], ['index.html', { width: 1024, height: 768 }, false],
      ['index.html', DESKTOP, false], ['index.html', ULTRA, false], ['governanca.html', { width: 1024, height: 768 }, false], ['governanca.html', DESKTOP, false], ['governanca.html', MOBILE, true]]) {
      const c = await ctx(vp, m);
      try {
        const p = await aberta(c, pg);
        await p.evaluate(() => { const s = document.querySelector('.sis'); scrollTo(0, s.getBoundingClientRect().top + scrollY - 100); }); await p.waitForTimeout(300);
        const caixas = () => p.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top + scrollY, b.width, b.height].map(v => Math.round(v)); };
          const sec = document.querySelector('.sis').closest('section'), sb = sec.getBoundingClientRect();
          return { casa: r('.sis .house-wrap'), seletor: r('.sis .segp'), lista: r('.sis .sis-list'), secao: Math.round(sb.height) }; });
        const base = await caixas();
        for (const plano of ['essencial', 'premium', 'concierge', '', 'premium', 'essencial']) {
          await p.click('.sis .segp button[data-plan="' + plano + '"]'); await p.waitForTimeout(650);
          const agora = await caixas(), nome = plano || 'todos';
          for (const k of ['casa', 'seletor', 'lista']) if (agora[k].some((v, i) => Math.abs(v - base[k][i]) > 1)) bad.push(pg + ' ' + vp.width + ' px, ' + nome + ': ' + k + ' saiu de ' + base[k].join(',') + ' para ' + agora[k].join(','));
          if (Math.abs(agora.secao - base.secao) > 1) bad.push(pg + ' ' + vp.width + ' px, ' + nome + ': seção mudou de altura (' + base.secao + ' → ' + agora.secao + ')');
        }
        if (p.errors.length) bad.push(pg + ': ' + p.errors[0]);
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + [...new Set(bad)].slice(0, 6).join(' | '));
  });

  await test('POL-002: no PC, o monograma acompanha o mouse em toda a abertura, de forma contínua e amortecida (vista explodida que cresce com a proximidade, cotas que aparecem, inclinação leve), volta ao repouso e para sozinho; nada no toque nem com movimento reduzido', async () => {
    const bad = [];
    const vars = p => p.evaluate(() => { const h = document.querySelector('.hart'), cs = getComputedStyle(h), g = s => getComputedStyle(document.querySelector(s));
      return { ex: +(h.style.getPropertyValue('--ex') || 0), rx: +(h.style.getPropertyValue('--rx') || 0), ry: +(h.style.getPropertyValue('--ry') || 0),
        fP: g('.hart .fP').transform, fF: g('.hart .fF').transform, cota: +g('.hcota path').strokeOpacity, mov: h.classList.contains('mov'),
        heroMx: document.querySelector('.hero').style.getPropertyValue('--mx'), heroBg: g('.hero').backgroundImage }; });
    const centro = p => p.evaluate(() => { const b = document.querySelector('.hart .hmono').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, b.width]; });
    for (const [rotulo, opts, vp, deve] of [['1440 px', {}, DESKTOP, true], ['2560 px', {}, ULTRA, true], ['movimento reduzido', { reducedMotion: 'reduce' }, DESKTOP, false], ['390 px (toque)', { isMobile: true, hasTouch: true }, MOBILE, false]]) {
      const c = await browser.newContext(Object.assign({ viewport: vp }, opts)); const p = await open(c, 'index.html', 300);
      try {
        await p.waitForFunction(() => document.documentElement.classList.contains('hart-ok'), null, { timeout: 8000 }).catch(() => {});
        await p.waitForTimeout(300);
        const repouso = await vars(p);
        const [cx, cy, w] = await centro(p);
        /* longe (sobre o texto da abertura), a meia distância e no centro do monograma */
        const pontos = [[Math.max(40, cx - w * 1.6), cy], [cx - w * .55, cy], [cx, cy]];
        const ex = [], em = [];
        for (const [x, y] of pontos) { await p.mouse.move(x, y, { steps: 6 }); await p.waitForTimeout(900); const v = await vars(p); ex.push(v.ex); em.push(v); }
        const sobre = await vars(p);
        if (deve) {
          if (!(ex[0] < ex[1] && ex[1] < ex[2])) bad.push(rotulo + ': a abertura das peças não cresce com a proximidade (' + ex.map(v => v.toFixed(2)).join(' → ') + ')');
          if (!(ex[2] > .85)) bad.push(rotulo + ': no centro a vista explodida não se completa (' + ex[2].toFixed(2) + ')');
          if (!(ex[0] < .3)) bad.push(rotulo + ': longe do monograma as peças já estão abertas (' + ex[0].toFixed(2) + ')');
          /* à esquerda do monograma ele se inclina para o mouse (graus pequenos); no repouso, nenhuma inclinação */
          if (!(Math.abs(em[1].ry) > .5 && Math.abs(em[1].ry) <= 9)) bad.push(rotulo + ': inclinação fora do esperado a meia distância (ry ' + em[1].ry + ')');
          if (repouso.rx || repouso.ry || repouso.ex) bad.push(rotulo + ': o monograma não começa em repouso');
          if (sobre.fP === 'none' || sobre.fP === sobre.fF) bad.push(rotulo + ': P e F não se separam (' + sobre.fP + ')');
          if (!(sobre.cota > repouso.cota + .25)) bad.push(rotulo + ': as cotas não ganham presença (' + repouso.cota + ' → ' + sobre.cota + ')');
          /* fluidez: indo do canto ao centro, o valor sobe aos poucos (amortecido), sem salto */
          await p.mouse.move(Math.max(40, cx - w * 1.6), cy); await p.waitForTimeout(1200);
          await p.mouse.move(cx, cy); const t = [];
          for (const ms of [50, 150, 350, 900]) { await p.waitForTimeout(ms - (t.length ? [50, 150, 350, 900][t.length - 1] : 0)); t.push((await vars(p)).ex); }
          if (!(t[0] < t[1] && t[1] < t[2] && t[2] <= t[3] + .001)) bad.push(rotulo + ': o movimento não é contínuo (' + t.map(v => v.toFixed(2)).join(', ') + ')');
          if (!(t[0] < .5)) bad.push(rotulo + ': a abertura salta de uma vez (' + t[0].toFixed(2) + ' em 50 ms)');
          /* saiu da abertura: volta ao repouso e o laço de animação para (nada rodando parado, REG-035) */
          await p.evaluate(() => scrollTo(0, innerHeight * 1.4)); await p.mouse.move(cx, cy - 20); await p.waitForTimeout(1600);
          const fora = await vars(p);
          if (!(fora.ex < .01 && Math.abs(fora.rx) < .02 && Math.abs(fora.ry) < .02)) bad.push(rotulo + ': fora da abertura o monograma não volta ao repouso (ex ' + fora.ex + ', rx ' + fora.rx + ')');
          if (fora.mov) bad.push(rotulo + ': o laço de animação continua rodando parado');
        } else if (sobre.ex !== 0 || sobre.fP !== 'none' || sobre.mov) bad.push(rotulo + ': o monograma mexeu (' + sobre.fP + ')');
        if (sobre.heroMx || sobre.heroBg !== repouso.heroBg) bad.push(rotulo + ': o fundo da abertura mudou com o mouse');
        if (p.errors.length) bad.push(rotulo + ': ' + p.errors[0]);
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('POL-003: cabeçalho com ilustração sem buraco: no desktop, título e texto à esquerda e a ilustração ao lado, não empilhada embaixo do texto (O que fazemos, Como trabalhamos, Compromissos; home e páginas)', async () => {
    const bad = [];
    for (const vp of [{ width: 1024, height: 768 }, DESKTOP, FHD, ULTRA, ULTRA2]) {
      const c = await ctx(vp);
      try {
        for (const pg of ['index.html', 'governanca.html', 'metodo.html', 'compromissos.html']) {
          const p = await aberta(c, pg);
          const r = await p.evaluate(() => [...document.querySelectorAll('main .head.split')].filter(h => h.querySelector('.arte')).map(h => {
            const a = h.querySelector('.arte').getBoundingClientRect(), hb = h.getBoundingClientRect();
            const txt = [...h.children].filter(e => !e.classList.contains('arte')).map(e => e.getBoundingClientRect());
            const t = { top: Math.min(...txt.map(b => b.top)), bottom: Math.max(...txt.map(b => b.bottom)), right: Math.max(...txt.map(b => b.right)), left: Math.min(...txt.map(b => b.left)) };
            return { id: h.closest('section').id, head: hb.height, a: { top: a.top, bottom: a.bottom, left: a.left, h: a.height }, t };
          }));
          for (const x of r) {
            const q = pg + ' ' + vp.width + ' #' + x.id + ':';
            if (x.a.left < x.t.right - 4) bad.push(q + ' ilustração embaixo do texto, não ao lado');
            const alto = Math.max(x.t.bottom - x.t.top, x.a.h);
            if (x.head > alto + 32) bad.push(q + ' cabeçalho com ' + Math.round(x.head - alto) + ' px vazios');
          }
          await p.close();
        }
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + [...new Set(bad)].slice(0, 6).join(' | '));
  });

  await test('POL-004: no desktop, "A casa" é uma coluna estreita e centralizada (Direção de Arte, seção 02), sem metade da tela vazia de um lado', async () => {
    const bad = [];
    for (const vp of [{ width: 1024, height: 768 }, DESKTOP, FHD, ULTRA, ULTRA2]) {
      const c = await ctx(vp);
      try {
        const p = await aberta(c, 'index.html');
        const r = await p.evaluate(() => { const sec = document.getElementById('a-casa'), w = sec.querySelector('.wrap'), cs = getComputedStyle(w), wb = w.getBoundingClientRect();
          const l = wb.left + parseFloat(cs.paddingLeft), rr = wb.right - parseFloat(cs.paddingRight); let x0 = 1e9, x1 = -1e9;
          const walk = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT); let n;
          while ((n = walk.nextNode())) { if (!n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) { if (q.width < 1) continue; x0 = Math.min(x0, q.left); x1 = Math.max(x1, q.right); } }
          sec.querySelectorAll('.phrases li').forEach(li => { const b = li.getBoundingClientRect(); x0 = Math.min(x0, b.left); x1 = Math.max(x1, b.right); });
          return { esq: x0 - l, dir: rr - x1, larg: rr - l, cont: x1 - x0 }; });
        if (Math.abs(r.esq - r.dir) > r.larg * .05) bad.push(vp.width + ' px: conteúdo deslocado (' + Math.round(r.esq) + ' px à esquerda × ' + Math.round(r.dir) + ' px à direita)');
        if (r.cont > r.larg * .72) bad.push(vp.width + ' px: coluna com ' + Math.round(100 * r.cont / r.larg) + '% da largura (a Direção de Arte pede coluna estreita, cerca de 7 de 12 colunas)');
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('POL-005: "Quem responde pela sua casa" ocupa a largura no desktop (retrato e texto lado a lado, junto da apresentação do casal) e o retrato provisório é intencional: fundo marinho, sem cara de foto faltando', async () => {
    const bad = [];
    for (const [vp, m] of [[MOBILE, true], [{ width: 1024, height: 768 }, false], [DESKTOP, false], [ULTRA, false]]) {
      const c = await ctx(vp, m);
      try {
        for (const pg of ['index.html', 'familia.html']) {
          const p = await aberta(c, pg);
          const r = await p.evaluate(() => { const sec = document.getElementById('quem-esta-por-tras'), w = sec.querySelector('.wrap'), cs = getComputedStyle(w), wb = w.getBoundingClientRect();
            const l = wb.left + parseFloat(cs.paddingLeft), rr = wb.right - parseFloat(cs.paddingRight); let x0 = 1e9, x1 = -1e9;
            const per = sec.querySelector('.person'), walk = document.createTreeWalker(per, NodeFilter.SHOW_TEXT); let n;
            while ((n = walk.nextNode())) { if (!n.textContent.trim() || n.parentElement.closest('.portrait')) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) { if (q.width < 1) continue; x0 = Math.min(x0, q.left); x1 = Math.max(x1, q.right); } }
            const pt = per.querySelector('.portrait'), ptb = pt.getBoundingClientRect(); x0 = Math.min(x0, ptb.left); x1 = Math.max(x1, ptb.right);
            const cores = (getComputedStyle(pt).backgroundImage + ' ' + getComputedStyle(pt).backgroundColor).match(/rgba?\([^)]+\)/g) || [];
            const lum = c => { const m = c.match(/[\d.]+/g).map(Number); if (m.length > 3 && m[3] === 0) return null; return (.2126 * m[0] + .7152 * m[1] + .0722 * m[2]) / 255; };
            const ls = cores.map(lum).filter(v => v != null), media = ls.length ? ls.reduce((a, b) => a + b, 0) / ls.length : 1;
            return { larg: rr - l, cont: x1 - x0, lum: media, retrato: { h: ptb.height }, vh: innerHeight }; });
          const q = pg + ' ' + vp.width + ' px:';
          if (vp.width >= 1024 && r.cont < r.larg * .8) bad.push(q + ' retrato e texto do Samuel ocupam ' + Math.round(100 * r.cont / r.larg) + '% da largura');
          if (r.lum > .25) bad.push(q + ' retrato provisório claro (luminância ' + r.lum.toFixed(2) + '), com cara de foto faltando');
          if (vp.width < 768 && r.retrato.h > r.vh * .55) bad.push(q + ' retrato ocupa ' + Math.round(r.retrato.h) + ' px da tela de ' + r.vh);
          await p.close();
        }
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('POL-006: nenhuma seção com vão vertical exagerado, em nenhuma página, de 320 a 3440 px (o maior vão entre blocos e o respiro de cada seção ficam proporcionais à altura da tela)', async () => {
    const bad = [];
    const VPS = [[{ width: 320, height: 568 }, true], [MOBILE, true], [{ width: 768, height: 1024 }, true], [{ width: 1024, height: 768 }, false], [{ width: 1280, height: 800 }, false], [DESKTOP, false], [FHD, false], [ULTRA, false], [{ width: 2560, height: 1440 }, false], [ULTRA2, false]];
    for (const [vp, m] of VPS) {
      const c = await ctx(vp, m);
      try {
        for (const pg of ['index', 'governanca', 'metodo', 'planos', 'familia', 'compromissos', 'contato']) {
          const p = await aberta(c, pg + '.html');
          const r = await p.evaluate(() => { const vis = e => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > .05; };
            return [...document.querySelectorAll('main > section')].map(s => { const sb = s.getBoundingClientRect(), top = sb.top + scrollY;
              /* conteúdo visível: cada trecho de texto (pela caixa do próprio texto, não do bloco) e cada imagem, desenho, ícone ou campo */
              const bx = [], add = (b, e) => { b = corta(b, e); if (b) bx.push([b.top + scrollY, b.bottom + scrollY]); };
              /* a caixa visível é recortada pelos ancestrais com overflow (acordeão fechado, texto só para leitor de tela) e pela própria seção */
              const corta = (b, e) => { let t = b.top, bo = b.bottom, l = b.left, r = b.right;
                for (let a = e; a && a !== s.parentElement; a = a.parentElement) { const cs = getComputedStyle(a); if (a !== s && cs.overflowX === 'visible' && cs.overflowY === 'visible' && cs.clip === 'auto') continue;
                  const q = a.getBoundingClientRect(); t = Math.max(t, q.top); bo = Math.min(bo, q.bottom); l = Math.max(l, q.left); r = Math.min(r, q.right); }
                return r - l >= 2 && bo - t >= 2 ? { top: t, bottom: bo } : null; };
              const tw = document.createTreeWalker(s, NodeFilter.SHOW_TEXT); let t;
              while ((t = tw.nextNode())) { if (!t.data.trim() || !t.parentElement || !vis(t.parentElement) || t.parentElement.closest('svg,[hidden],[aria-hidden="true"].ghost')) continue;
                const rg = document.createRange(); rg.selectNodeContents(t); [...rg.getClientRects()].forEach(b => add(b, t.parentElement)); }
              s.querySelectorAll('img,svg,picture,video,input,select,textarea,button,.house-wrap,.portrait').forEach(e => { if (vis(e) && !e.parentElement.closest('svg')) add(e.getBoundingClientRect(), e); }); 
              /* também contam como conteúdo visível: painéis com fundo próprio (diferente do da seção) e linhas divisórias que
                 atravessam pelo menos metade da área útil; o vão é o espaço vazio entre essas coisas, não entre textos */
              s.querySelectorAll('.scroll-hint').forEach(e => { if (vis(e)) { const b = e.getBoundingClientRect(); add({ top: b.top, bottom: b.bottom, left: b.left - 1, right: b.right + 1 }, e); } }); /* fio vertical de 1 px */
              const fundo = getComputedStyle(s).backgroundColor, ww = (s.querySelector('.wrap') || s).getBoundingClientRect().width;
              const cor = c => !/rgba\([^)]*,\s*0\)|transparent/.test(c);
              s.querySelectorAll('*').forEach(e => { if (e.closest('svg') || !vis(e)) return; const cs = getComputedStyle(e), b = e.getBoundingClientRect(); if (b.width < 2) return;
                if (b.height >= 20 && b.width >= 40 && ((cor(cs.backgroundColor) && cs.backgroundColor !== fundo) || cs.backgroundImage !== 'none') && !e.matches('.wm, [aria-hidden="true"]')) add(b, e);
                if (b.width >= ww * .5) { if (parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none' && cor(cs.borderTopColor)) add({ top: b.top, bottom: b.top + 2, left: b.left, right: b.right, width: b.width, height: 2 }, e);
                  if (parseFloat(cs.borderBottomWidth) >= 1 && cs.borderBottomStyle !== 'none' && cor(cs.borderBottomColor)) add({ top: b.bottom - 2, bottom: b.bottom, left: b.left, right: b.right, width: b.width, height: 2 }, e); } });
              if (!bx.length) return null; bx.sort((a, b) => a[0] - b[0]); let gap = 0, fim = bx[0][1];
              for (const [a, z] of bx) { if (a > fim) gap = Math.max(gap, a - fim); fim = Math.max(fim, z); }
              const y0 = Math.min(...bx.map(b => b[0])), y1 = Math.max(...bx.map(b => b[1]));
              return { id: s.id || s.className.split(' ')[0], first: s.matches('.page-first, .hero'), gap, topo: y0 - top, base: top + sb.height - y1 }; }).filter(Boolean); });
          /* limites: o maior vão interno até 12% da altura da tela (mín. 88 px no desktop, 64 px no celular);
             o respiro de cima e de baixo de cada seção até 15% da altura (mín. 96 px no desktop, 72 px no celular), fora a primeira seção */
          const mgap = Math.max(m ? 64 : 88, vp.height * .12), mresp = Math.max(m ? 72 : 96, vp.height * .15);
          r.forEach(x => { const q = pg + ' ' + vp.width + '×' + vp.height + ' #' + x.id + ':';
            if (x.gap > mgap) bad.push(q + ' vão de ' + Math.round(x.gap) + ' px (máx. ' + Math.round(mgap) + ')');
            if (!x.first && x.topo > mresp) bad.push(q + ' respiro de cima de ' + Math.round(x.topo) + ' px (máx. ' + Math.round(mresp) + ')');
            if (x.base > mresp) bad.push(q + ' respiro de baixo de ' + Math.round(x.base) + ' px (máx. ' + Math.round(mresp) + ')'); });
          await p.close();
        }
      } finally { await c.close(); }
    }
    if (process.env.POL_TUDO) fs.writeFileSync(process.env.POL_TUDO, [...new Set(bad)].join('\n'));
    ok(!bad.length, bad.length + ' problemas: ' + [...new Set(bad)].slice(0, 8).join(' | '));
  });

  /* ---- achados da validação independente (ruflo T13, 21/10/2026): auditoria/evidencias/polimento/validacao/relatorio.md ---- */
  await test('POL-007: nenhuma palavra partida no meio da linha (seletor de planos, formulário, títulos e texto) de 320 a 2560 px, e os campos lado a lado do formulário alinhados', async () => {
    const bad = new Set();
    for (const [vp, m] of [[{ width: 320, height: 568 }, true], [MOBILE, true], [{ width: 768, height: 1024 }, true], [{ width: 1024, height: 768 }, false], [{ width: 1060, height: 800 }, false],
      [{ width: 1180, height: 820 }, false], [DESKTOP, false], [ULTRA, false]]) {
      const c = await ctx(vp, m);
      try {
        for (const pg of ['index', 'governanca', 'metodo', 'planos', 'familia', 'compromissos', 'contato']) {
          const p = await aberta(c, pg + '.html');
          const r = await p.evaluate(() => {
            const out = [], tw = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); let n;
            while ((n = tw.nextNode())) {
              const el = n.parentElement; if (!el || el.closest('.sr, svg, [hidden]')) continue;
              const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
              const re = /[A-Za-zÀ-ÿ]{4,}/g; let w;
              while ((w = re.exec(n.data))) {
                const rg = document.createRange(); rg.setStart(n, w.index); rg.setEnd(n, w.index + w[0].length);
                const tops = new Set([...rg.getClientRects()].filter(q => q.width > 1).map(q => Math.round(q.top)));
                if (tops.size > 1) out.push(el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : '') + ' "' + w[0] + '"');
              }
            }
            /* campos lado a lado (no celular eles empilham e não entram aqui): mesma altura na tela */
            document.querySelectorAll('.fields .two').forEach(t => { const bs = [...t.querySelectorAll('input, select, textarea')].map(i => i.getBoundingClientRect());
              if (bs.length > 1 && bs.some(b => b.left >= bs[0].right) && Math.max(...bs.map(b => b.top)) - Math.min(...bs.map(b => b.top)) > 1) out.push('campos lado a lado desalinhados (' + bs.map(b => Math.round(b.top)).join(' × ') + ')'); });
            return out;
          });
          r.forEach(x => bad.add(pg + ' ' + vp.width + ': ' + x));
          await p.close();
        }
      } finally { await c.close(); }
    }
    ok(!bad.size, bad.size + ' problemas: ' + [...bad].slice(0, 8).join(' | '));
  });

  await test('POL-008: no desktop, as notas do fim dos Planos (Mensalidade, Repasses, Atendimento) ocupam a largura em três colunas, sem o vazio à direita (home e página Planos, 1024, 1440 e 2560 px)', async () => {
    const bad = [];
    for (const vp of [{ width: 1024, height: 768 }, DESKTOP, ULTRA]) {
      const c = await ctx(vp);
      try {
        for (const pg of ['index.html', 'planos.html']) {
          const p = await aberta(c, pg);
          const r = await p.evaluate(() => { const sec = document.getElementById('planos'), w = sec.querySelector('.wrap'), cs = getComputedStyle(w), wb = w.getBoundingClientRect();
            const larg = wb.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), dl = sec.querySelector('.plans-dl'), it = [...dl.children].map(e => e.getBoundingClientRect());
            return { larg, dl: dl.getBoundingClientRect().width, n: it.length, tops: it.map(b => Math.round(b.top)) }; });
          const q = pg + ' ' + vp.width + ' px:';
          if (r.dl < r.larg * .9) bad.push(q + ' notas com ' + Math.round(100 * r.dl / r.larg) + '% da largura');
          if (r.n !== 3 || Math.max(...r.tops) - Math.min(...r.tops) > 2) bad.push(q + ' notas não estão lado a lado (' + r.tops.join(', ') + ')');
          await p.close();
        }
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('POL-009: cabeçalho com ilustração e sem texto de apoio ("Começamos entendendo a sua casa."): o título fica centrado na altura do desenho, sem o vão embaixo dele (home e Método, 1024 a 2560 px)', async () => {
    const bad = [];
    for (const vp of [{ width: 1024, height: 768 }, DESKTOP, ULTRA]) {
      const c = await ctx(vp);
      try {
        for (const pg of ['index.html', 'metodo.html']) {
          const p = await aberta(c, pg);
          /* 22/10/2026: na abertura de uma página (Método) vale o pedido de 19/10 do dono, conteúdo logo abaixo do cabeçalho
             (teste "conteúdo da abertura logo abaixo do cabeçalho"): ali o título fica no topo e o desenho, menor, ao lado */
          const r = await p.evaluate(() => [...document.querySelectorAll('main .head.ilus')].filter(h => !h.querySelector(':scope > p') && !h.closest('.page-first')).map(h => {
            const t = h.querySelector(':scope > div').getBoundingClientRect(), a = h.querySelector(':scope > .arte').getBoundingClientRect();
            return { id: h.closest('section').id, dc: Math.round((t.top + t.bottom) / 2 - (a.top + a.bottom) / 2) }; }));
          if (!r.length && pg === 'index.html') bad.push(pg + ': nenhum cabeçalho com ilustração sem texto de apoio');
          r.forEach(x => { if (Math.abs(x.dc) > 24) bad.push(pg + ' ' + vp.width + ' #' + x.id + ': título a ' + x.dc + ' px do centro do desenho'); });
          await p.close();
        }
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('POL-010: no tablet em pé (768 e 834 px), a ilustração dos cabeçalhos e o retrato do Samuel ficam ao lado do texto, sem o vazio ao lado', async () => {
    const bad = [];
    for (const vp of [{ width: 768, height: 1024 }, { width: 834, height: 1194 }]) {
      const c = await ctx(vp, true);
      try {
        for (const pg of ['index.html', 'governanca.html', 'metodo.html', 'compromissos.html', 'familia.html']) {
          const p = await aberta(c, pg);
          const r = await p.evaluate(() => ({
            heads: [...document.querySelectorAll('main .head.ilus')].map(h => { const a = h.querySelector(':scope > .arte').getBoundingClientRect();
              const t = Math.max(...[...h.children].filter(e => !e.classList.contains('arte')).map(e => e.getBoundingClientRect().right)); return { id: h.closest('section').id, ok: a.left >= t - 4 }; }),
            duo: (() => { const d = document.querySelector('.duo'); if (!d) return null; const pt = d.querySelector('.portrait').getBoundingClientRect(), fx = d.querySelector('.faixa').getBoundingClientRect(); return pt.right <= fx.left + 1; })() }));
          const q = pg + ' ' + vp.width + ' px:';
          r.heads.forEach(h => { if (!h.ok) bad.push(q + ' #' + h.id + ' ilustração embaixo do texto'); });
          if (r.duo === false) bad.push(q + ' retrato sozinho na linha, não ao lado da apresentação');
          await p.close();
        }
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('POL-011: acabamentos: marcador do comparativo sem amassar, títulos de cartão sem palavra sozinha na última linha, marca d\'água de Conversar que se apaga em vez de cortar reto e monograma visível no retrato provisório', async () => {
    const bad = new Set();
    for (const [vp, m] of [[{ width: 320, height: 568 }, true], [MOBILE, true], [{ width: 1024, height: 768 }, false], [DESKTOP, false], [ULTRA, false]]) {
      const c = await ctx(vp, m);
      try {
        for (const pg of ['index.html', 'planos.html', 'metodo.html', 'familia.html']) {
          const p = await aberta(c, pg);
          const r = await p.evaluate(() => {
            const out = [];
            /* marcador ● do comparativo: largura natural (.5rem), mesmo quando o texto da célula quebra */
            document.querySelectorAll('.mx .yes').forEach(e => { const b = e.getBoundingClientRect(); if (b.height > 0 && b.width < 7) out.push('marcador do comparativo amassado (' + b.width.toFixed(1) + ' px)'); });
            /* títulos de cartão em mais de uma linha: nada de uma palavra curta sozinha na última linha (viúva: a última linha com uma
               palavra só e menos de 45% da largura da linha mais longa; "Sem comissão / escondida" é aceitável, "obras e / reparos" não) */
            document.querySelectorAll('.pillar .h3, .step h3, .step h2, .cm h3, .cm h2, .faixa strong, .next .t').forEach(h => {
              const tw = document.createTreeWalker(h, NodeFilter.SHOW_TEXT), ws = []; let n;
              while ((n = tw.nextNode())) { const re = /\S+/g; let w; while ((w = re.exec(n.data))) { const rg = document.createRange(); rg.setStart(n, w.index); rg.setEnd(n, w.index + w[0].length); const q = rg.getClientRects()[0]; if (q && q.width > 0) ws.push(q); } }
              const tops = [...new Set(ws.map(q => Math.round(q.top)))]; if (tops.length < 2) return;
              const larg = t => { const l = ws.filter(q => Math.round(q.top) === t); return Math.max(...l.map(q => q.right)) - Math.min(...l.map(q => q.left)); };
              const ult = tops[tops.length - 1], nUlt = ws.filter(q => Math.round(q.top) === ult).length;
              if (nUlt === 1 && larg(ult) < .45 * Math.max(...tops.map(larg))) out.push('palavra sozinha na última linha: "' + h.textContent.trim().slice(0, 40) + '"');
            });
            const wm = document.querySelector('.talk .wm'); if (wm) { const cs = getComputedStyle(wm); if (!/gradient/.test(cs.maskImage || '') && !/gradient/.test(cs.webkitMaskImage || '')) out.push('marca d\'água de Conversar cortada reto'); }
            document.querySelectorAll('.person .portrait').forEach(pt => { if (pt.querySelector('img')) return; const pm = pt.querySelector('.pm'); if (pm && pm.getBoundingClientRect().width < pt.getBoundingClientRect().width * .25) out.push('monograma do retrato provisório pequeno demais (' + Math.round(pm.getBoundingClientRect().width) + ' px)'); });
            return out; });
          r.forEach(x => bad.add(pg + ' ' + vp.width + ': ' + x));
          await p.close();
        }
      } finally { await c.close(); }
    }
    ok(!bad.size, bad.size + ' problemas: ' + [...bad].slice(0, 8).join(' | '));
  });

  await test('POL-012: em "Perguntas que ouvimos", a resposta abre medida e contínua (altura que cresce, cota que se desenha ao lado, texto revelado de cima para baixo, + que vira −) e fecha ao contrário; com movimento reduzido abre na hora; nada em laço', async () => {
    const bad = [];
    const estado = p => p.evaluate(() => { const d = document.querySelector('#perguntas details'), a = d.querySelector('.faq-a'), t = a && a.querySelector('p');
      const sc = s => { const m = (s || '').match(/matrix\(([^)]+)\)/); return m ? +m[1].split(',')[3] : (s === 'none' ? 1 : NaN); };
      return { open: d.open, h: a ? a.getBoundingClientRect().height : -1, full: a ? a.scrollHeight : -1, cota: a ? sc(getComputedStyle(a, '::before').transform) : NaN,
        op: t ? +getComputedStyle(t).opacity : 0, pm: getComputedStyle(d.querySelector('summary .pm')).transform, borda: getComputedStyle(d).borderBottomColor,
        laco: document.getAnimations().filter(x => x.effect && x.effect.getTiming().iterations === Infinity).length }; });
    for (const [vp, m] of [[DESKTOP, false], [MOBILE, true]]) {
      const c = await ctx(vp, m);
      try {
        const p = await aberta(c, 'index.html'), q = vp.width + ' px:';
        await p.evaluate(() => document.querySelector('#perguntas').scrollIntoView({ block: 'center' })); await p.waitForTimeout(400);
        const ini = await estado(p);
        if (!(await p.$('#perguntas details .faq-a'))) { bad.push(q + ' resposta sem o recipiente .faq-a'); await p.close(); continue; }
        await p.click('#perguntas details:first-of-type summary');
        const t = []; for (const ms of [70, 200, 900]) { await p.waitForTimeout(ms - (t.length ? [70, 200, 900][t.length - 1] : 0)); t.push(await estado(p)); }
        if (!t[0].open) bad.push(q + ' a pergunta não abriu');
        if (!(t[0].h < t[2].h * .7 && t[0].h < t[1].h && t[1].h < t[2].h)) bad.push(q + ' a altura não cresce aos poucos (' + t.map(x => Math.round(x.h)).join(' → ') + ')');
        if (Math.abs(t[2].h - t[2].full) > 2) bad.push(q + ' aberta, a resposta não mostra tudo (' + Math.round(t[2].h) + ' de ' + t[2].full + ')');
        if (!(t[0].cota < .9 && t[2].cota > .99)) bad.push(q + ' a cota ao lado da resposta não se desenha (' + t[0].cota + ' → ' + t[2].cota + ')');
        if (!(t[0].op < .9 && t[2].op > .99)) bad.push(q + ' o texto não se revela (' + t[0].op + ' → ' + t[2].op + ')');
        if (t[2].pm === ini.pm) bad.push(q + ' o + não gira para virar −');
        if (t[2].borda === ini.borda) bad.push(q + ' a linha da pergunta aberta não muda de cor');
        await p.click('#perguntas details:first-of-type summary');
        /* 22/10/2026: no GitHub Actions, mais lento, uma amostra só aos 80 ms às vezes caía antes do primeiro quadro do fechamento
           (75 de 76 px); agora são três amostras e basta uma pegar a resposta no meio do caminho */
        const f = [], tf = [80, 160, 260, 900]; for (let i = 0; i < tf.length; i++) { await p.waitForTimeout(tf[i] - (i ? tf[i - 1] : 0)); f.push(await estado(p)); }
        if (!f.slice(0, 3).some(x => x.h > 2 && x.h < t[2].h - 2)) bad.push(q + ' ao fechar, a resposta some de uma vez (' + f.slice(0, 3).map(x => Math.round(x.h)).join(' → ') + ' px em 80, 160 e 260 ms)');
        if (f[3].open) bad.push(q + ' a pergunta não fechou');
        if (f[3].laco) bad.push(q + ' ' + f[3].laco + ' animações em laço');
        if (p.errors.length) bad.push(q + ' ' + p.errors[0]);
        await p.close();
      } finally { await c.close(); }
    }
    { const c = await browser.newContext({ viewport: DESKTOP, reducedMotion: 'reduce' });
      try { const p = await open(c, 'index.html', 300);
        await p.evaluate(() => document.querySelector('#perguntas').scrollIntoView()); await p.click('#perguntas details:first-of-type summary'); await p.waitForTimeout(40);
        const r = await estado(p); if (!r.open || Math.abs(r.h - r.full) > 2) bad.push('movimento reduzido: a resposta não abre na hora (' + Math.round(r.h) + ' de ' + r.full + ')');
      } finally { await c.close(); } }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await test('POL-013: a faixa da prévia usa a fonte do próprio site, não a do sistema: a altura dela (e a da abertura do celular, MEL-005) é a mesma em qualquer máquina; uma linha a partir de 768 px', async () => {
    /* 22/10/2026: no Ubuntu do GitHub Actions a faixa, em system-ui, ficou mais alta e empurrou a abertura do celular (MEL-005
       falhou lá: título a 370 px em 414×896, indicador fora da tela em 390×844), enquanto aqui passava */
    const bad = [];
    for (const [vp, m] of [[{ width: 320, height: 568 }, true], [MOBILE, true], [{ width: 414, height: 896 }, true], [{ width: 768, height: 1024 }, true], [DESKTOP, false]]) {
      const c = await ctx(vp, m);
      try {
        const p = await open(c, 'index.html', 300);
        const r = await p.evaluate(() => { const f = document.querySelector('.sett-faixa'); if (!f) return null; const cs = getComputedStyle(f), sans = getComputedStyle(document.documentElement).getPropertyValue('--sans').trim();
          /* linhas pela altura do conteúdo dividida pela altura de linha (o logo e o link da faixa têm caixas próprias) */
          const linhas = Math.round((f.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight));
          const norm = x => x.replace(/["'\s]/g, '');
          return { fam: norm(cs.fontFamily), sans: norm(sans), linhas }; });
        if (!r) { await p.close(); continue; }
        if (r.fam !== r.sans) bad.push(vp.width + ' px: faixa em "' + r.fam + '" (a fonte do site é "' + r.sans + '")');
        if (vp.width >= 768 && r.linhas > 1) bad.push(vp.width + ' px: faixa em ' + r.linhas + ' linhas');
        await p.close();
      } finally { await c.close(); }
    }
    ok(!bad.length, bad.length + ' problemas: ' + bad.slice(0, 6).join(' | '));
  });

  await browser.close(); srv.close();
  const fail = results.filter(r => !r[0]);
  console.log(`\n${results.length - fail.length}/${results.length} testes passaram`);
  process.exit(fail.length ? 1 : 0);
})();
