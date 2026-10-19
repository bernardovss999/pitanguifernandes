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
        /* alturas medidas a partir do início do conteúdo: a faixa da Sett muda de altura conforme a fonte do sistema */
        const top0 = document.querySelector('main').getBoundingClientRect().top + scrollY;
        sel.forEach(s => document.querySelectorAll(s).forEach((e, i) => {
          const b = e.getBoundingClientRect();
          if (!b.width && !b.height) return; /* oculto (ex.: confirmação do formulário) */
          r[`${s}#${i}`] = [b.left, b.top + scrollY - top0, b.width, b.height].map(v => Math.round(v * 10) / 10);
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
    if (!a[2] && !a[3]) continue; /* oculto na referência */
    if (!b) { diffs.push(`${k} ${e}: sumiu`); continue; }
    const far = r => r.some((v, i) => Math.abs(v - b[i]) > TOL);
    /* bloco com mudança declarada também passa se cair exatamente onde a nova referência diz */
    const alt = base.__alt && base.__alt[k] && base.__alt[k][e];
    if (far(a) && (!alt || far(alt))) diffs.push(`${k} ${e}: ${a.join(',')} -> ${b.join(',')}`);
  }
  for (const k of Object.keys(cur)) for (const e of Object.keys(cur[k])) if (!(base[k] && base[k][e])) diffs.push(`${k} ${e}: novo`);
  return diffs;
}
/* referência: com LAYOUT_BASE=<ref do git> (no GitHub, a main), mede essa versão na mesma máquina;
   sem ela, usa tests/layout-baseline.json. Fontes e quebras de linha variam entre máquinas, então
   comparar duas medições do mesmo ambiente é o que vale. */
async function baseline(browser) {
  const ref = process.env.LAYOUT_BASE;
  if (!ref) return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const { execSync } = require('child_process'), os = require('os');
  const { serve, ROOT } = require('./helpers');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-base-'));
  execSync(`git -C "${ROOT}" archive ${ref} | tar -x -C "${dir}"`);
  const srv = await serve(dir);
  let base;
  try { base = await measure(browser, 'http://127.0.0.1:' + srv.address().port + '/'); }
  finally { srv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  /* mudança de layout intencional: a referência gravada no commit difere da referência da main.
     A diferença entre as duas é o deslocamento declarado de cada bloco; ele é somado à medição da main,
     e qualquer outro movimento continua falhando */
  let old = null;
  try { old = JSON.parse(execSync(`git -C "${ROOT}" show ${ref}:tests/layout-baseline.json`, { encoding: 'utf8', maxBuffer: 1 << 26 })); } catch (e) {}
  return old ? declared(base, old, JSON.parse(fs.readFileSync(FILE, 'utf8'))) : base;
}
function declared(base, old, cur) {
  const out = {}, alt = {};
  /* o deslocamento de um bloco que antes era centralizado na tela depende da altura da faixa da Sett (fonte do sistema);
     por isso a posição gravada na nova referência também vale para os blocos com mudança declarada */
  Object.defineProperty(out, '__alt', { value: alt });
  for (const k of new Set([...Object.keys(base), ...Object.keys(cur)])) {
    out[k] = {};
    for (const e of new Set([...Object.keys(base[k] || {}), ...Object.keys(cur[k] || {})])) {
      const m = base[k] && base[k][e], a = old[k] && old[k][e], b = cur[k] && cur[k][e];
      if (m && a && b) { out[k][e] = m.map((v, i) => Math.round((v + b[i] - a[i]) * 10) / 10); if (a.some((v, i) => v !== b[i])) (alt[k] = alt[k] || {})[e] = b; }
      else if (m && !(a && !b)) out[k][e] = m;   /* sem declaração: tem de ficar onde está */
      else if (!m && b && !a) out[k][e] = b;     /* bloco novo declarado */
      /* bloco removido de propósito (estava na referência antiga e saiu da nova): não se cobra */
    }
  }
  return out;
}
module.exports = { measure, compare, baseline, declared, FILE };

if (require.main === module) {
  const { serve, launch } = require('./helpers');
  (async () => {
    const srv = await serve(), browser = await launch();
    const cur = await measure(browser, 'http://127.0.0.1:' + srv.address().port + '/');
    await browser.close(); srv.close();
    if (process.argv.includes('--update')) { fs.writeFileSync(FILE, JSON.stringify(cur)); console.log('referência de layout gravada'); return; }
    const base = await (async () => { const b = await launch(); try { return await baseline(b); } finally { await b.close(); } })();
    const d = compare(base, cur);
    console.log(d.length ? d.slice(0, 30).join('\n') : 'layout idêntico à referência'); process.exit(d.length ? 1 : 0);
  })();
}
