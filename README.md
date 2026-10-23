# pitanguifernandes

Site da Pitangui Fernandes · Governança Residencial. Hoje é uma **prévia não oficial feita pela Sett**
(faixa no topo e `noindex`), publicada em https://pitanguifernandes.vercel.app.

## Como editar e testar

O HTML, o CSS publicado, o `sitemap.xml`, o `robots.txt`, o `home.html` e o `vercel.json` são **gerados** por
`src/build.py` (textos, estrutura e configuração) e `src/site.src.css` (estilos). Não edite os arquivos da raiz à mão:
edite `src/` (ou `assets/js/site.js`, que não é gerado) e rode `npm run gerar`.

```bash
npm ci                          # primeira vez (e npx playwright install chromium, se o navegador não estiver instalado)
npm run gerar                   # python3 src/build.py: regera o site a partir de src/
npm test                        # suíte inteira (Playwright, sem framework); sai com código 1 se algo falhar
SO=REG-007 npm test             # só os testes cujo nome contém o texto (rápido, para ver um teste falhar e passar)
CHECK_DNS=1 npm test            # acrescenta a verificação com rede: todo e-mail publicado tem MX que recebe
npm run test:layout             # só a guarda de layout
```

### A home, seção a seção (ordem de 20/10/2026)

01 Abertura (marinho) → 02 A casa (branco) → 03 **A casa, sistema a sistema** (névoa: o desenho da casa com o filtro por plano e
o aviso do que muda entre Essencial, Premium e Concierge) → 04 O que fazemos (branco, os quatro pilares) → 05 Como trabalhamos
(névoa, os quatro passos e o que o Diagnóstico entrega) → 06 Planos (branco) → 07 O nome (marinho) → 08 Quem responde pela sua
casa (branco, só Samuel) → 09 Compromissos (névoa) → 10 **Perguntas que ouvimos** (branco) → 11 Conversar e rodapé (marinho).
Os fundos alternam sempre (um teste garante). Cada seção é uma função `sNN()` no `build.py`; as páginas internas reaproveitam
as mesmas funções com `page=True`. As decisões dessa rodada estão em `REGRESSOES.md`, seção "Melhorias de 20/10/2026" (`MEL-NNN`);
o polimento de 21/10/2026 (`POL-NNN`: casa que não pula ao trocar de plano, monograma que acompanha o mouse, cabeçalhos com
ilustração ao lado, "A casa" em coluna centralizada, Samuel na largura toda, ritmo vertical de 320 a 3440 px e, depois da validação
independente do ruflo, nenhuma palavra partida, notas dos Planos em três colunas, tablet em duas colunas e acabamentos) está na
seção seguinte.

O monograma da abertura (POL-002) é desenhado pelo CSS a partir de três números que o `site.js` leva com uma mola amortecida:
`--rx`/`--ry` (inclinação, em graus) e `--ex` (vista explodida, de 0 a 1). Para mudar a intensidade, altere os deslocamentos no
bloco `.hart.abre` do `src/site.src.css`; para mudar a velocidade, `W` (rigidez da mola) no `site.js`.

### Metodologia (a mesma do bot da Sett)

1. **Teste primeiro.** Todo bug ou pedido ganha um teste em `tests/regression.js` (seção "Auditoria Sett × ruflo",
   com o `REG-NNN` no nome; melhorias na seção "Melhorias de 20/10/2026", com `MEL-NNN`). Rode e **veja falhar** no código atual.
2. **Corrija** em `src/` (ou `assets/js/site.js`), `npm run gerar`, e o mesmo teste passa.
3. **Suíte inteira verde** (`npm test` com código de saída 0) antes de cada commit.
4. **Registre** uma linha em `REGRESSOES.md` (ID, data, sintoma, causa, correção, teste).
5. **Nunca** apague, pule ou afrouxe um teste para a suíte passar. Se a família mudar uma decisão, o teste é
   reescrito e o porquê vai para o `REGRESSOES.md` (foi o caso dos preços e do balão do WhatsApp, REG-004 e REG-006).

### Layout protegido

`tests/layout.js` mede posição e tamanho dos blocos (seções, títulos, cartões, formulário, arte da abertura) em 390 e
1440 px e compara com `tests/layout-baseline.json`, aqui e no GitHub. As fontes são do próprio site (`assets/fonts/`),
então a medição é a mesma em qualquer máquina; se alguma fonte não carregar, o teste para com "fontes não carregadas"
em vez de acusar layout. Mudança de layout **intencional**: confira as diferenças, rode `node tests/layout.js --update`
e faça o commit da referência junto com a mudança. `LAYOUT_BASE=<ref> node tests/layout.js` compara com outra versão.

## Chaves de decisão (topo de `src/build.py`)

Cada chave muda o site inteiro de uma vez, e os testes conferem os dois lados de cada uma (geram uma cópia temporária
com a chave invertida).

| Chave | Hoje | O que faz |
|---|---|---|
| `PREVIA` | `True` | Faixa "Prévia feita pela Sett para a Pitangui Fernandes · não oficial", meta robots `noindex` em todas as páginas e `X-Robots-Tag: noindex` no `vercel.json`. Com `False`, as três coisas saem juntas. |
| `SITE` | `'https://pitanguifernandes.vercel.app/'` | Única origem dos endereços absolutos: canonical, og:url, og:image, JSON-LD, sitemap e robots. |
| `WHATS` | `'5521967072931'` | O número do WhatsApp e do telefone, num lugar só: links, `tel:`, JSON-LD e o formulário (`data-wa`). |
| `MOSTRAR_PRECOS` | `False` | A Direção de Arte pede Planos "sem valores": sem mensalidade nos cartões e sem valor do Diagnóstico; a nota dos Planos abre com "Os valores são apresentados após o diagnóstico...". Com `True`, voltam R$ 790, 1.690, 3.500 e 2.750. |
| `BALAO_WHATSAPP` | `False` | Sem balão automático, sem anel pulsante e sem bolinha de "on-line" (Direção de Arte 3.1). Com `True`, volta o balão de boas-vindas. |
| `EMAIL` | `None` | O domínio declara MX nulo (não recebe e-mail): nenhum e-mail aparece e a Política indica o WhatsApp. Quando a caixa existir, preencher (ex.: `'contato@pitanguifernandes.com.br'`). |
| `TIPOGRAFIA` | `'cliente'` | `'cliente'` = Cormorant Garamond 600 + Inter (Direção de Arte); `'sett'` = Newsreader 500 + Jost (kit e motions, sem o circunflexo deformado da Cormorant). As duas ficam em `src/fonts/` com as licenças SIL OFL; o build copia só as da chave para `assets/fonts/`. |
| `FOTOS` | `{}` | Espaços de foto: `slot → arquivo em src/fotos/`. Slots: `hero` (16:9, fundo da abertura em duotone), `detalhe` (1:1, O que fazemos), `vistoria` (3:2, Como trabalhamos), `sebastiao` (4:5, preto e branco, O nome), `samuel` (4:5, Quem responde pela sua casa). Com o arquivo, o build recorta na proporção, gera os WebP em `assets/fotos/` (com o Pillow: `pip install pillow`; a lista fica em `src/fotos/<slot>.json` e é reaproveitada depois, inclusive no CI) e emite a `<picture>` com `width`/`height`, `alt`, `srcset` e carregamento tardio (menos a abertura). Sem o arquivo, a seção fica como está (tipográfica ou com a ilustração isométrica), nunca com moldura vazia. O que fotografar: `entregas/04-site/FOTOS - o que fotografar.md`. |

Textos com regra comercial também ficam em constantes, para valer igual em todas as páginas: `ABATIMENTO`
(Diagnóstico abatido "no todo ou em parte" em até 30 dias), `ART` (ressalva de responsável técnico: na home ela vive nas
Perguntas, nas outras páginas na nota dos Planos, sob os pilares e no Diagnóstico), `ATENDIMENTO` (sem plantão; fora do
horário, o chamado é tratado no próximo expediente), `POLITICA_ATUALIZADA`, `FAQ` (as seis perguntas, só com regras do
documento da cliente sem "hip."), `PLAN_NOTA` e `SIS_SUB_PLANO` (o que cada plano acompanha, da matriz de serviços) e
`DIAG_ENTREGA` (os seis entregáveis do Diagnóstico, na home e na página Método).

## Como lançar (quando a família contratar e aprovar)

1. **Domínio** (registro.br, zona DNS): `A @` com o valor que o cartão do domínio mostrar no painel da Vercel
   (o geral é `76.76.21.21`) e `CNAME www` para o alvo indicado lá; na Vercel, `pitanguifernandes.com.br` como principal
   e `www` com redirecionamento 308 para ele.
2. **E-mail**, se for publicar um: criar a caixa no provedor escolhido, trocar o MX nulo (`0 .`) e o SPF `-all`
   pelos registros do provedor (MX, SPF, DKIM e DMARC) e testar envio e recebimento.
3. **Chaves** em `src/build.py`:
   ```python
   PREVIA = False
   SITE = 'https://pitanguifernandes.com.br/'
   EMAIL = 'contato@pitanguifernandes.com.br'   # só depois do passo 2
   ```
   e conferir com a família `MOSTRAR_PRECOS`, `TIPOGRAFIA` e o número em `WHATS`.
4. **Política de Privacidade**: acrescentar razão social e CNPJ (o texto hoje diz que entram no lançamento),
   atualizar `POLITICA_ATUALIZADA` e pedir a revisão do advogado da família.
5. `npm run gerar`, `npm test` e `CHECK_DNS=1 npm test` (o teste com rede falha se o e-mail publicado não tiver MX que recebe).
6. Depois de no ar: conferir `curl -sI https://pitanguifernandes.com.br/` (200, sem `X-Robots-Tag`), a prévia do link
   no WhatsApp, e enviar o `sitemap.xml` no Google Search Console. O endereço `pitanguifernandes.vercel.app` deve
   redirecionar para o domínio (ver REGRESSOES.md, REG-041).

Pendências que dependem da família (não inventar: o site não publica o que não foi confirmado): sobrenome e credenciais
de Samuel, função e trajetória de Diana, história e foto de Sebastião (e o tempo verbal), fotos do casal, bairros e cidades
atendidos, horários de atendimento por plano, prazo de resposta, razão social e CNPJ.

## Publicação

A Vercel publica a raiz como site estático. O `package.json` não pode ter os scripts `build`, `vercel-build`,
`postinstall` ou `prepare` (um teste garante isso). O `vercel.json` é gerado pelo build: cabeçalhos de segurança
(CSP com o sha256 de cada script inline, calculado do HTML gerado; nosniff; Referrer-Policy; Permissions-Policy;
X-Frame-Options), `rewrites` para os endereços sem `.html` e `trailingSlash: false`. O `.vercelignore` tira da
publicação `src/`, `tests/`, `.github/`, `node_modules/`, os `.md` e os `package*.json`. A página 404 usa caminhos a
partir da raiz (aparece em qualquer profundidade); as demais usam caminhos relativos, então o site também abre
direto do computador (index.html com dois cliques). O servidor dos testes imita a Vercel a partir do `vercel.json`
(cabeçalhos, rewrites, barra final e 404), então a suíte roda sob a CSP real.

Os testes rodam no GitHub a cada push e pull request (o CI confere também que `python3 src/build.py` não muda nem
cria nenhum arquivo); só mescle na `main` com tudo verde.

## O que os testes cobrem hoje

Publicação estática; cabeçalho (logo, menu, "Conversar" do celular ao desktop sem corte e com o texto inteiro dentro do botão, sem WhatsApp no topo);
conteúdo da abertura logo abaixo do cabeçalho em todas as páginas (360 a 1920 px); caça de bugs no celular em todas as páginas
(320/360/390/414 px: nada vazando da tela, texto sobre texto, imagem quebrada, letra menor que 11 px, com o comparativo aberto); arte 3D
da abertura com as cotas; vinheta original de cerca de 2,3 s a cada chegada e recarga (não ao navegar dentro do site), com o texto pintado por baixo e LCP; botão do WhatsApp no canto,
sem balão nem animação; rolagem horizontal em 320, 360, 390 e 1440 px; erros no console (sob a CSP); menu, Esc, foco
preso no menu aberto; tom do cabeçalho e cabeçalho opaco; "Início" no menu; planos sem valores (e com, pela chave),
nível em anel 1/2/4, comparativo um plano por vez e a 320 px; formulário (validação, WhatsApp pela constante, máscara
com +55 e 0, sem JavaScript); movimento reduzido; layout; texto cortado em cinco larguras; alvos de toque de 48 px;
impressão; links, âncoras, alt, rótulos, metadados, sitemap e contraste; chaves PREVIA/SITE/EMAIL/WHATS/MOSTRAR_PRECOS/
BALAO_WHATSAPP/TIPOGRAFIA/FOTOS; fontes do próprio site sem requisição externa; textos fiéis aos documentos da cliente
(compromissos, ART/RRT, Samuel, O nome, sistemas, atendimento, Política de Privacidade, português e tom);
vercel.json, CSP, 404, .vercelignore e arquivos sem uso em `assets/`; e as melhorias de 20/10/2026 (casa interativa como
terceira tela com o aviso por plano, fundos alternados, botões da lista, família só com Samuel, monograma com resposta ao
mouse, primeira tela do celular, pilares sem cartão, ilustrações, entregáveis do Diagnóstico, Perguntas que ouvimos, nota dos
Planos em itens e espaços de foto); e o polimento de 21/10/2026 (a casa parada ao trocar de plano, o monograma contínuo e
amortecido, cabeçalhos sem buraco, "A casa" centralizada, a seção do Samuel na largura, nenhum vão exagerado em 7 páginas e
10 telas, de 320×568 a 3440×1440, nenhuma palavra partida no meio, notas dos Planos em três colunas, tablet em duas colunas e
títulos de cartão sem viúva). Lista completa, com o porquê de cada teste, em `REGRESSOES.md`.
