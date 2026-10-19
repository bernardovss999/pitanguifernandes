/* Guarda de layout: mede a posição e o tamanho dos blocos principais e compara com
   tests/layout-baseline.json. Mudanças visuais (cor, textura, movimento) não podem mover nada.
   Atualizar a referência de propósito: node tests/layout.js --update */
const fs = require('fs'), path = require('path');
const FILE = path.join(__dirname, 'layout-baseline.json');
const PAGES = ['index', 'governanca', 'metodo', 'planos', 'familia', 'compromissos', 'contato'];
const VIEWPORTS = [[390, 844, true], [1440, 900, false]];
const SEL = ['main > section', 'main > a.next', 'h1', 'h2', 'h3', '.hdr .brand', '.hart', '.hero-text', '.plan', '.pillar', '.cm', '.step', '.person', '.form', '.mx-wrap', '.house', '.sis-list', '.foot'];
const TOL = 1.5;

async function measure(browser, U) {
  const out = {};
  for (const [w, h, m] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: m, hasTouch: m });
    for (const pg of PAGES) {
      const p = await ctx.newPage();
      await p.addInitScript(() => { try { sessionStorage.setItem('pf-intro', '1'); sessionStorage.setItem('pf-wa-x', '1'); } catch (e) {} });
      await p.goto(U + pg + '.html', { waitUntil: 'load' });
      await p.evaluate(() => document.fonts.ready);
      await p.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
      await p.evaluate(() => { document.body.classList.add('ready'); document.querySelectorAll('[data-r]').forEach(e => e.classList.add('in')); });
      await p.waitForTimeout(150);
      out[`${pg}@${w}`] = await p.evaluate(sel => {
        const r = {};
        sel.forEach(s => document.querySelectorAll(s).forEach((e, i) => {
          const b = e.getBoundingClientRect();
          r[`${s}#${i}`] = [b.left, b.top + scrollY, b.width, b.height].map(v => Math.round(v * 10) / 10);
        }));
        return r;
      }, SEL);
      await p.close();
    }
    await ctx.close();
  }
  return out;
}

function compare(base, cur) {
  const diffs = [];
  for (const k of Object.keys(base)) for (const e of Object.keys(base[k])) {
    const a = base[k][e], b = cur[k] && cur[k][e];
    if (!b) { diffs.push(`${k} ${e}: sumiu`); continue; }
    if (a.some((v, i) => Math.abs(v - b[i]) > TOL)) diffs.push(`${k} ${e}: ${a.join(',')} -> ${b.join(',')}`);
  }
  for (const k of Object.keys(cur)) for (const e of Object.keys(cur[k])) if (!(base[k] && base[k][e])) diffs.push(`${k} ${e}: novo`);
  return diffs;
}
module.exports = { measure, compare, FILE };

if (require.main === module) {
  const { serve, launch } = require('./helpers');
  (async () => {
    const srv = await serve(), browser = await launch();
    const cur = await measure(browser, 'http://127.0.0.1:' + srv.address().port + '/');
    await browser.close(); srv.close();
    if (process.argv.includes('--update')) { fs.writeFileSync(FILE, JSON.stringify(cur)); console.log('referência de layout gravada'); return; }
    const d = compare(JSON.parse(fs.readFileSync(FILE, 'utf8')), cur);
    console.log(d.length ? d.slice(0, 30).join('\n') : 'layout idêntico à referência'); process.exit(d.length ? 1 : 0);
  })();
}
