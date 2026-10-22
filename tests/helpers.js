/* servidor estático da raiz do repositório e navegador para os testes */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.xml': 'application/xml', '.txt': 'text/plain', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon' };
/* servidor estático que imita a Vercel a partir do vercel.json gerado: cabeçalhos (inclusive a CSP),
   rewrites, barra final e a página 404 com status 404. { vercel: false } serve os arquivos crus. */
function serve(root, opts) {
  root = root || ROOT; opts = opts || {};
  const vercel = opts.vercel !== false;
  const conf = () => { try { return JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')); } catch (e) { return {}; } };
  const rx = src => new RegExp('^' + src.replace(/:(\w+)\(([^)]+)\)/g, '(?<$1>$2)').replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const cfg = vercel ? conf() : {}, extra = {};
      let url = decodeURIComponent(req.url.split('?')[0]);
      if (vercel) {
        if (cfg.trailingSlash === false && url.length > 1 && url.endsWith('/')) { rsp.writeHead(308, { Location: url.replace(/\/+$/, '') }); rsp.end(); return; }
        for (const h of cfg.headers || []) if (!h.has && rx(h.source).test(url)) for (const x of h.headers) extra[x.key] = x.value;
        for (const r of cfg.rewrites || []) { const m = url.match(rx(r.source)); if (m) { url = r.destination.replace(/:(\w+)/g, (_, k) => m.groups[k]); break; } }
      }
      let f = path.join(root, url);
      if (url.endsWith('/')) f = path.join(f, 'index.html');
      fs.readFile(f, (err, buf) => {
        if (err) {
          if (!vercel) { rsp.writeHead(404); rsp.end('nf'); return; }
          fs.readFile(path.join(root, '404.html'), (e2, b2) => { rsp.writeHead(404, Object.assign({ 'Content-Type': TYPES['.html'] }, extra)); rsp.end(e2 ? 'nf' : b2); });
          return;
        }
        rsp.writeHead(200, Object.assign({ 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }, extra)); rsp.end(buf);
      });
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}
function launch() {
  const px = process.env.HTTPS_PROXY ? process.env.HTTPS_PROXY.replace(/^https?:\/\//, '') : null;
  return chromium.launch(px ? { args: ['--proxy-server=https=' + px, '--proxy-bypass-list=localhost;127.0.0.1'] } : {});
}

/* arquivo do site (relativo à raiz) como texto */
function ler(rel, root) { return fs.readFileSync(path.join(root || ROOT, rel), 'utf8'); }

/* chaves de decisão do topo de src/build.py (PREVIA, SITE, MOSTRAR_PRECOS...), lidas como valores JS */
function chaves(root) {
  const src = ler('src/build.py', root), out = {};
  for (const m of src.matchAll(/^([A-Z_]+)\s*=\s*(True|False|None|'[^'\n]*'|"[^"\n]*")\s*(?:#.*)?$/gm)) {
    const v = m[2];
    out[m[1]] = v === 'True' ? true : v === 'False' ? false : v === 'None' ? null : v.slice(1, -1);
  }
  return out;
}

/* gera, numa cópia temporária do repositório, o site com outras chaves (ex.: { PREVIA: false })
   e devolve a pasta. Serve para testar os dois lados de cada decisão sem tocar nos arquivos publicados. */
function variante(ch, antes) {
  const { execFileSync } = require('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-var-'));
  fs.cpSync(ROOT, dir, { recursive: true, filter: s => !/[\\/](\.git|node_modules)$/.test(s) });
  if (antes) antes(dir); /* ex.: pôr fotos em src/fotos/ antes de gerar */
  const py = v => v === true ? 'True' : v === false ? 'False' : v == null ? 'None' : JSON.stringify(v);
  const sets = Object.entries(ch).map(([k, v]) => `build.${k} = ${py(v)}`).join('; ');
  execFileSync('python3', ['-c', `import sys; sys.path.insert(0, 'src'); import build; ${sets}; build.build()`], { cwd: dir, stdio: 'pipe' });
  return dir;
}

/* todas as páginas .html da raiz */
function paginasHtml(root) { return fs.readdirSync(root || ROOT).filter(f => f.endsWith('.html')).sort(); }

module.exports = { serve, launch, ROOT, ler, chaves, variante, paginasHtml };
