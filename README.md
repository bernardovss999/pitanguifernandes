# pitanguifernandes

## Como editar e testar

O HTML e o CSS publicados são gerados por `src/build.py` (textos e estrutura) e `src/site.src.css` (estilos). Não edite os `.html` da raiz à mão: edite `src/` e rode `npm run build`.

Antes de publicar, rode `npm test` (precisa de `npm install` e `npx playwright install chromium` na primeira vez). Os testes em `tests/regression.js` conferem, no celular e no desktop, o cabeçalho (logo, WhatsApp e menu), a arte da abertura com as cotas, o balão do WhatsApp, rolagem horizontal, erros no console, menu, planos, comparativo e formulário. Eles também rodam no GitHub a cada push.
