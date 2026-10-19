# pitanguifernandes

## Como editar e testar

O HTML e o CSS publicados são gerados por `src/build.py` (textos e estrutura) e `src/site.src.css` (estilos). Não edite os `.html` da raiz à mão: edite `src/` e rode `npm run build`.

### Metodologia de testes

1. **Antes de mudar, escreva o teste** do que foi pedido em `tests/regression.js` e confirme que ele falha.
2. Faça a mudança em `src/`, rode `npm run gerar` e depois `npm test` até ficar tudo verde.
3. **Layout protegido:** `tests/layout.js` mede posição e tamanho dos blocos (seções, títulos, cartões, formulário, arte da abertura) em 390 e 1440 px. Localmente compara com `tests/layout-baseline.json`; no GitHub compara com a `main` medida na mesma máquina, porque fontes e quebras de linha variam entre computadores. Mudança de layout intencional: `node tests/layout.js --update` e commit da referência. No GitHub, a diferença entre a referência da `main` e a nova é o deslocamento declarado de cada bloco: ele é somado à medição da `main`, e qualquer outro movimento continua falhando.
4. **Publicação:** o Vercel publica a raiz como site estático. O `package.json` não pode ter os scripts `build`, `vercel-build`, `postinstall` ou `prepare` (um teste garante isso).
5. Os testes rodam no GitHub a cada push e pull request; só mescle na `main` com tudo verde.

Primeira vez: `npm install` e `npx playwright install chromium`.

O que os testes cobrem hoje: cabeçalho (logo, menu, só "Conversar" no topo e com o texto inteiro dentro do botão, sem WhatsApp), conteúdo da abertura logo abaixo do cabeçalho em todas as páginas (360 a 1920 px), caça de bugs no celular em todas as páginas (320/360/390/414 px: nada vazando da tela, texto sobre texto, imagem quebrada, letra menor que 11 px, com o comparativo aberto), arte 3D da abertura com as cotas, botão e balão do WhatsApp no canto inferior direito, ausência de luz seguindo o mouse no desktop, rolagem horizontal em 360/390/1440 px, erros no console, menu e Esc, tom do cabeçalho, "Início" no menu, planos sem preço e comparativo, formulário, movimento reduzido, layout, links, âncoras, alt, rótulos, metadados, sitemap, alvos de toque e contraste.
