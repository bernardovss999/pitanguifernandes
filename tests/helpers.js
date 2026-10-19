/* servidor estático da raiz do repositório e navegador para os testes */
const http = require('http'), fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const ROOT = path.join(__dirname, '..');
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
function launch() {
  const px = process.env.HTTPS_PROXY ? process.env.HTTPS_PROXY.replace(/^https?:\/\//, '') : null;
  return chromium.launch(px ? { args: ['--proxy-server=https=' + px, '--proxy-bypass-list=localhost;127.0.0.1'] } : {});
}
module.exports = { serve, launch, ROOT };
