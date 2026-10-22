#!/usr/bin/env python3
"""Monta as páginas estáticas do site.
Segue o roteiro do documento "Direção de Arte e Roteiro do Site": a home tem as seções na ordem do arco
narrativo (com a casa interativa como terceira tela, decisão do dono em 20/10/2026); cada página interna aprofunda a sua seção."""
import os, re, json, shutil, hashlib, base64, html as H

# ===================================================================== CHAVES
# Decisões que a família toma na reunião. Cada chave muda o site inteiro de uma vez; os testes
# (tests/regression.js, seção "Auditoria Sett × ruflo") conferem os dois lados de cada uma.
# Lançamento: PREVIA = False e SITE = 'https://pitanguifernandes.com.br/' (ver README).
PREVIA = True  # faixa "Prévia feita pela Sett... não oficial" + noindex (meta robots e X-Robots-Tag no vercel.json)
SITE = 'https://pitanguifernandes.vercel.app/'  # única origem de canonical, og:url, og:image, JSON-LD, sitemap e robots
WHATS = '5521967072931'  # WhatsApp e telefone públicos da Pitangui: o único lugar do número no site (links, tel:, JSON-LD e formulário)
MOSTRAR_PRECOS = False  # a Direção de Arte pede Planos "sem valores": nenhum preço de plano nem do Diagnóstico aparece
BALAO_WHATSAPP = False  # Direção de Arte 3.1: "Sem pop-ups, chat flutuante (...) botão de WhatsApp pulsante": só o botão, parado
TIPOGRAFIA = 'cliente'  # 'sett' = Newsreader + Jost (kit e motions); 'cliente' = Cormorant Garamond + Inter (Direção de Arte)
EMAIL = None  # o domínio declara MX nulo (não recebe e-mail): nenhum e-mail aparece; quando houver caixa, ex.: 'contato@pitanguifernandes.com.br'
# Espaços de foto (MEL-007): slot -> arquivo da família em src/fotos/. Com o arquivo, o build gera os WebP em assets/fotos/ e a
# <picture>; sem ele, a seção fica como está (tipográfica/isométrica), nunca com moldura vazia. O que fotografar, proporções e
# tamanhos: entregas/04-site/FOTOS - o que fotografar.md. Ex.: {'samuel': 'samuel.jpg', 'sebastiao': 'sebastiao.jpg', 'hero': 'varanda.jpg'}
FOTOS = {}

# regra do documento de produtos: 100% no Concierge e 50% nos demais, ainda hipótese; o site diz o que vale em qualquer cenário
ABATIMENTO = 'O valor do Diagnóstico é abatido, no todo ou em parte, na contratação de um plano em até 30 dias.'
# limite do atendimento, dito antes (regra comercial do documento de produtos, sem "hip."; o plantão saiu na revisão de custos).
# Os horários de cada plano não entram: a linha do documento está marcada como hipótese.
ATENDIMENTO = ('O atendimento segue o horário de expediente de cada plano, sem plantão de 24 horas. Fora do horário, o chamado fica registrado '
               'e é tratado no início do próximo expediente, e o protocolo de emergência da casa orienta você enquanto isso.')
# ressalva do documento de produtos (supervisão de obras e regras comerciais), onde o site descreve vistoria, fiscalização, medição e obras
ART = 'Atividades que exigem responsável técnico (ART/RRT) são executadas por profissional habilitado.'

B = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(B)  # o site gerado fica na raiz do repositório

def rd(p): return open(p, encoding='utf-8').read()

SPRITE = rd(os.path.join(B, 'sprite.html')).rstrip()
WAPATH = rd(os.path.join(B, 'wa-path.txt')).strip()
def wa(texto=True):
    """link do WhatsApp a partir de WHATS; com texto, já leva a mensagem de abertura"""
    return 'https://wa.me/%s%s' % (WHATS, '?text=Ol%C3%A1%2C%20gostaria%20de%20conversar%20sobre%20a%20gest%C3%A3o%20da%20minha%20casa.' if texto else '')
def tel():
    """(21) 96707-2931"""
    return '(%s) %s-%s' % (WHATS[2:4], WHATS[4:-4], WHATS[-4:])
IG = 'https://www.instagram.com/pitanguifernandes/'

ARR = ''
GO = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" '
      'stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>')
NE = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" '
      'stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>')
P_D = 'M 412 114 L 275 34 L 248 20 L 20 152 L 20 336 L 105 385 L 106 290 Z M 285 117 L 82 235 L 80 234 L 80 193 L 243 98 L 250 96 Z'
F_D = 'M 439 142 L 149 309 L 149 555 L 220 514 L 221 448 L 305 400 L 305 329 L 222 377 L 220 376 L 220 342 L 438 216 Z'
WM = ('<svg class="wm" data-r="wm" viewBox="18 18 423 539" aria-hidden="true"><path pathLength="1" fill-rule="evenodd" d="%s"/>'
      '<path pathLength="1" fill-rule="evenodd" d="%s"/></svg>') % (P_D, F_D)
HART = open(os.path.join(B, 'hart.svg'), encoding='utf-8').read().strip()
HOUSE = open(os.path.join(B, 'art', 'house.svg'), encoding='utf-8').read().strip()
HOTS = json.load(open(os.path.join(B, 'art', 'house.json'), encoding='utf-8'))
PM = ('<svg class="pm" viewBox="18 18 423 539" aria-hidden="true"><path pathLength="1" fill-rule="evenodd" d="%s"/>'
      '<path class="f" pathLength="1" fill-rule="evenodd" d="%s"/></svg>') % (P_D, F_D)
YES = '<i class="yes" aria-hidden="true"></i>'

NAV = [('governanca.html', 'Governança'), ('metodo.html', 'Método'), ('planos.html', 'Planos'),
       ('familia.html', 'Família'), ('compromissos.html', 'Compromissos')]

# ----------------------------------------------------------------- fotos (MEL-007)
# proporção, larguras geradas, alt padrão e tratamento de cada espaço (Direção de Arte 1.4: retratos 4:5, ambientes 16:9, detalhes 1:1)
SLOTS = {
 'hero':      dict(ratio=(16, 9), larguras=(1280, 1920, 2560), alt='Ambiente residencial ao anoitecer, com a luz acesa', sizes='100vw', lazy=False),
 'detalhe':   dict(ratio=(1, 1), larguras=(600, 1200), alt='Detalhe de uma casa: esquadria, maçaneta ou jardim', sizes='(min-width: 64em) 20rem, 60vw'),
 'vistoria':  dict(ratio=(3, 2), larguras=(800, 1200), alt='Vistoria em curso, com prancheta e quadro elétrico organizado', sizes='(min-width: 64em) 26rem, 60vw'),
 'sebastiao': dict(ratio=(4, 5), larguras=(640, 1280), alt='Sebastião Pitangui', sizes='(min-width: 64em) 26rem, 100vw', pb=True, legenda='Sebastião Pitangui'),
 'samuel':    dict(ratio=(4, 5), larguras=(640, 1280), alt='Samuel, da Pitangui Fernandes', sizes='(min-width: 64em) 18rem, 56vw'),
}
def dimensoes(caminho):
    """largura e altura de um JPEG, PNG ou WebP, lendo só o cabeçalho (sem o Pillow)"""
    b = open(caminho, 'rb').read(64 * 1024)
    if b[:8] == b'\x89PNG\r\n\x1a\n': return int.from_bytes(b[16:20], 'big'), int.from_bytes(b[20:24], 'big')
    if b[:4] == b'RIFF' and b[8:12] == b'WEBP':
        if b[12:16] == b'VP8X': return 1 + int.from_bytes(b[24:27], 'little'), 1 + int.from_bytes(b[27:30], 'little')
        if b[12:16] == b'VP8L': n = int.from_bytes(b[21:25], 'little'); return 1 + (n & 0x3FFF), 1 + ((n >> 14) & 0x3FFF)
        if b[12:16] == b'VP8 ': return int.from_bytes(b[26:28], 'little') & 0x3FFF, int.from_bytes(b[28:30], 'little') & 0x3FFF
    if b[:2] == b'\xff\xd8':
        i = 2
        while i < len(b) - 9 and b[i] == 0xFF:
            mk, ln = b[i + 1], int.from_bytes(b[i + 2:i + 4], 'big')
            if 0xC0 <= mk <= 0xCF and mk not in (0xC4, 0xC8, 0xCC): return int.from_bytes(b[i + 7:i + 9], 'big'), int.from_bytes(b[i + 5:i + 7], 'big')
            i += 2 + ln
    raise SystemExit('foto %s: formato não reconhecido (use JPEG, PNG ou WebP)' % caminho)

def fotos_gerar(slot):
    """derivados do slot em assets/fotos/ (recorte na proporção e WebP nas larguras do SLOTS, com o Pillow). Gera uma vez e guarda a
    lista em src/fotos/<slot>.json: nas vezes seguintes (e no CI, sem o Pillow) reaproveita os arquivos. Sem o Pillow e sem os
    derivados, publica o original como está, com aviso. Para refazer, apague o .json"""
    sp, arq = SLOTS[slot], FOTOS[slot]
    origem = os.path.join(B, 'fotos', arq); man = os.path.join(B, 'fotos', slot + '.json')
    if not os.path.exists(origem): raise SystemExit('FOTOS[%r] aponta para src/fotos/%s, que não existe' % (slot, arq))
    if os.path.exists(man):
        m = json.load(open(man, encoding='utf-8'))
        if m.get('orig') == arq and all(os.path.exists(os.path.join(ROOT, it[2])) for it in m['itens']): return m['itens']
    dst = os.path.join(ROOT, 'assets', 'fotos'); os.makedirs(dst, exist_ok=True)
    rw, rh = sp['ratio']; itens = []
    try:
        from PIL import Image, ImageOps
    except ImportError:
        Image = None
    if Image:
        im = ImageOps.exif_transpose(Image.open(origem)).convert('L' if sp.get('pb') else 'RGB')
        W, Hh = im.size
        if W / Hh > rw / rh: nw = round(Hh * rw / rh); box = ((W - nw) // 2, 0, (W - nw) // 2 + nw, Hh)
        else: nh = round(W * rh / rw); box = (0, (Hh - nh) // 2, W, (Hh - nh) // 2 + nh)
        im = im.crop(box)
        for lw in sp['larguras']:
            if lw > im.width and itens: break
            lw = min(lw, im.width); lh = round(lw * rh / rw)
            out = '%s-%d.webp' % (slot, lw)
            im.resize((lw, lh), Image.LANCZOS).save(os.path.join(dst, out), 'WEBP', quality=80, method=6)
            itens.append([lw, lh, 'assets/fotos/' + out])
    else:
        print('aviso: sem o Pillow, a foto de %r vai como está (pip install pillow para gerar os WebP nas larguras certas)' % slot)
        out = slot + os.path.splitext(arq)[1].lower(); shutil.copyfile(origem, os.path.join(dst, out))
        w, h = dimensoes(origem); itens.append([w, h, 'assets/fotos/' + out])
    json.dump({'orig': arq, 'itens': itens}, open(man, 'w', encoding='utf-8'), indent=1); return itens

def foto(slot):
    """<picture> do slot (vazio quando a chave FOTOS não tem o arquivo): width/height do maior derivado, alt, srcset e sizes;
    carregamento tardio, menos na abertura"""
    if slot not in FOTOS: return ''
    sp = SLOTS[slot]; itens = fotos_gerar(slot); w, h, maior = itens[-1]
    carga = 'fetchpriority="high"' if sp.get('lazy') is False else 'loading="lazy"'
    return ('<picture class="foto foto-%s"><img src="%s" srcset="%s" sizes="%s" width="%d" height="%d" alt="%s" %s decoding="async"></picture>'
            % (slot, maior, ', '.join('%s %dw' % (it[2], it[0]) for it in itens), sp['sizes'], w, h, H.escape(sp['alt'], quote=True), carga))

def figura_ou_arte(slot, nome):
    """o espaço de foto de uma seção: a foto quando existe; senão a ilustração isométrica (nunca uma moldura vazia)"""
    f = foto(slot)
    return ('<figure class="arte foto-wrap" data-r>%s</figure>' % f) if f else arte(nome)

# ilustrações isométricas de src/art/ (MEL-010): publicadas como imagem em assets/img/, com o traço da casa embutido
# (uma <img> não herda o CSS do site) e sem entrar na contagem de elementos da página (REG-048)
ARTE_CSS = ('.ln{stroke:#0C2448;stroke-width:1;stroke-linejoin:round;vector-effect:non-scaling-stroke}.gr{stroke:#DCE1E9;stroke-width:1;vector-effect:non-scaling-stroke}'
            '.ct,.tx{stroke:#A2A8B4;stroke-width:1;vector-effect:non-scaling-stroke}.tx2{stroke:#3A4E70;stroke-width:1.5;vector-effect:non-scaling-stroke}'
            '.sl{stroke:#fff;stroke-width:1;vector-effect:non-scaling-stroke}.tr{stroke:#A2A8B4;stroke-width:1;stroke-dasharray:4 4;vector-effect:non-scaling-stroke}')
def arte(nome):
    """<figure> com a ilustração; o alt é o aria-label já escrito no desenho e width/height vêm do viewBox"""
    svg = rd(os.path.join(B, 'art', nome + '.svg')).strip()
    label = re.search(r'aria-label="([^"]+)"', svg).group(1)
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
    os.makedirs(os.path.join(ROOT, 'assets', 'img'), exist_ok=True)
    # como arquivo próprio o SVG precisa do namespace (sem ele o navegador o lê como XML qualquer e a imagem sai vazia), do
    # tamanho intrínseco (sem width/height o navegador não sabe o tamanho natural) e do traço embutido
    pub = re.sub(r'<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" ' % (round(vb[2]), round(vb[3])), svg, count=1)
    pub = re.sub(r'(<svg[^>]*>)', r'\1\n<style>%s</style>' % ARTE_CSS, pub, count=1)
    open(os.path.join(ROOT, 'assets', 'img', nome + '.svg'), 'w', encoding='utf-8').write(pub + '\n')
    return ('<figure class="arte arte-%s" data-r><img src="assets/img/%s.svg" alt="%s" width="%d" height="%d" loading="lazy" decoding="async"></figure>'
            % (nome, nome, label, round(vb[2]), round(vb[3])))

def title(page, cls, hid, text, attrs='data-r="rv"'):
    """título da seção: h2 na home, h1 quando a seção abre a página"""
    if page:
        return '<h1 class="%s h1p" id="%s" %s>%s</h1>' % (cls, hid, attrs, text)
    return '<h2 class="%s" id="%s" %s>%s</h2>' % (cls, hid, attrs, text)

# ===================================================================== 01 ABERTURA
def s01():
    f = foto('hero')
    return '''<section class="hero dark ent%s" id="topo" aria-labelledby="h-hero">%s
  %s
  <div class="wrap hero-in">
    <div class="hero-text">
      <p class="eyebrow" data-h style="--d:0s">Governança residencial · <span class="ef">Empresa de família · </span>Niterói</p>
      <h1 class="h1" id="h-hero" data-h style="--d:.1s"><span class="l" style="--i:0">Você cuida da sua família.</span> <span class="l" style="--i:1">Nós cuidamos da sua casa.</span></h1>
      <p class="lead" data-h style="--d:.22s">A Pitangui Fernandes é uma empresa de família que assume a gestão técnica da sua residência: inspeção, fornecedores, reparos e obras, com relatórios claros e decisões sempre suas.</p>
      <div class="hero-foot" data-h style="--d:.34s">
        <a class="tlink" href="#como-trabalhamos">Conheça a nossa forma de trabalhar %s</a>
      </div>
      <span class="scroll-hint" data-h style="--d:.46s" aria-hidden="true"></span>
    </div>
  </div>
</section>''' % (' com-foto' if f else '', ('\n  <div class="hero-foto" aria-hidden="true">%s</div>' % f) if f else '', HART, ARR)

# ===================================================================== 02 A CASA
def s02():
    ph = ''.join('\n        <li data-r><span class="i">%s</span><span class="t">%s</span></li>' % (n, t)
                 for n, t in [('01', 'Três técnicos.'), ('02', 'Três orçamentos.'), ('03', 'Nenhum histórico.')])
    return '''<section class="sec bg-white casa" id="a-casa" aria-labelledby="h-casa">
  <div class="wrap">
    <div class="casa-head">
      <p class="eyebrow" data-r>A casa é um patrimônio vivo</p>
      <h2 class="h2" id="h-casa" data-r="rv">Uma casa funciona bem até o dia em que ninguém sabe quem cuida de quê.</h2>
    </div>
    <ul class="phrases" data-stagger="100" aria-label="O que acontece sem gestão">%s
    </ul>
    <div class="casa-foot">
      <div class="body" data-r>
        <p>Ar-condicionado, bombas, instalações elétricas, telhado, jardim, piscina. Cada sistema tem um prestador, e cada prestador responde por uma parte.</p>
        <p>Quando algo falha, cabe ao proprietário descobrir a causa, encontrar quem resolva, comparar orçamentos e conferir o serviço. Isso consome tempo, atenção e dinheiro, quase sempre nos piores momentos. Falta histórico, falta rotina de prevenção, e falta alguém que responda pelo conjunto.</p>
      </div>
      <p class="fecho" data-r><span>Falta um gestor para a casa.</span></p>
    </div>
  </div>
</section>''' % ph

# ===================================================================== 03 GOVERNANÇA
PILLARS = [
 ('i-casa', 'Cuidar da casa', 'Inspeções e manutenção preventiva em calendário anual, com inventário e histórico de cada equipamento.', 'cuidar'),
 ('i-rede', 'Gerir fornecedores', 'Selecionamos, cotamos, contratamos, acompanhamos e avaliamos os prestadores. Você não precisa procurar técnico.', 'fornecedores'),
 ('i-obra', 'Supervisionar obras e reparos', 'Do conserto pontual à reforma, somos o olhar técnico do proprietário: escopo, cronograma, fiscalização, medição e entrega.', 'obras'),
 ('i-relatorio', 'Prestar contas', 'Relatórios claros, custos por categoria e indicadores para decidir com informação.', 'contas'),
]
def s03(page=False):
    pil = ''.join('''
      <article class="pillar" id="%s" data-r>
        <div class="top"><span class="nn">%d</span><svg class="ic draw" aria-hidden="true"><use href="#%s"/></svg></div>
        <h3 class="h3">%s</h3>
        <p>%s</p>
      </article>''' % (pid, i + 1, ic, t, d) for i, (ic, t, d, pid) in enumerate(PILLARS))
    if page: pil = pil.replace('<h3 class="h3">', '<h2 class="h3">').replace('</h3>', '</h2>')
    foot = '' if page else '''
    <div class="sec-foot" data-r><a class="tlink" href="governanca.html">Ver os pilares e o escopo da vistoria %s</a></div>''' % ARR
    # na home a casa interativa é a seção anterior (s02b, em névoa), então os pilares ficam em branco (MEL-001, MEL-012);
    # na página Governança a casa abre a página, logo abaixo do título e antes dos pilares
    return '''<section class="sec %s gov%s" id="governanca" aria-labelledby="h-gov">
  <div class="wrap">
    <div class="head split ilus">
      <div>
        <p class="eyebrow" data-r>O que fazemos</p>
        %s
      </div>
      <p class="body muted" data-r>Aplicamos à residência o método que as grandes operações usam para cuidar de seus equipamentos e instalações: planejamento, inspeção, contratos, indicadores e registro. Você aprova as decisões e acompanha os resultados. Nós cuidamos da operação.</p>
      %s
    </div>%s
    <div class="pillars" data-stagger="120">%s
    </div>%s%s
  </div>
</section>''' % ('bg-nevoa' if page else 'bg-white', ' ent page-first' if page else '', title(page, 'h2', 'h-gov', 'Gestão profissional para a casa de quem tem pouco tempo para ela.'),
                 figura_ou_arte('detalhe', 'pillars'), sistemas(True) if page else '', pil, '\n    <p class="note art-nota" data-r>__ART__</p>' if page else '', foot)

# --- sistemas da casa: desenho isométrico com os doze sistemas e o que cada plano acompanha.
# Na home é a terceira tela (s02b, decisão do dono em 20/10/2026: MEL-001); na Governança abre a página, antes dos pilares.
SIS_ICON = {'eletrica': 's-eletrica', 'hidraulica': 's-hidraulica', 'ar-condicionado': 's-ar', 'bombas': 's-bomba', 'gas': 's-gas',
            'piscina': 's-piscina', 'jardim': 's-jardim', 'automacao': 's-automacao', 'seguranca': 's-seguranca',
            'cobertura': 's-cobertura', 'esquadrias': 's-esquadria', 'areas-externas': 's-externas'}
SIS_SUB = {'todos': 'Em todos os planos', 'premium': 'Premium e Concierge', 'periodica': 'Semestral ou trimestral'}
# o que a lista diz de cada grupo quando um plano está escolhido (matriz A do documento de produtos, sem "hip.")
SIS_SUB_PLANO = {'': SIS_SUB,
                 'essencial': {'todos': 'Incluído', 'premium': 'Fora do calendário', 'periodica': 'Fora do calendário'},
                 'premium': {'todos': 'Incluído', 'premium': 'Incluído', 'periodica': 'Semestral'},
                 'concierge': {'todos': 'Incluído', 'premium': 'Incluído', 'periodica': 'Trimestral'}}
# aviso dinâmico da casa (MEL-002): uma frase e três linhas (rótulo, o plano escolhido, o outro plano), da matriz A.
# Premium e Concierge acompanham os mesmos doze sistemas; o que muda é a presença.
PLAN_NOTA = {
 # POL-001: em "Todos" o aviso também aparece (nunca some, então nada pula), com o quadro do que muda entre os planos
 'todos': ('Em todos os planos, os doze sistemas entram no Diagnóstico do Imóvel. O que muda é o calendário e a frequência das visitas.',
           [('Visitas', 'Uma por mês', 'Duas por mês', 'Semanais'), ('Sistemas no calendário', 'Cinco', 'Doze', 'Doze'),
            ('Teste dos equipamentos críticos', 'Trimestral', 'Mensal', 'Em toda visita')]),
 'essencial': ('No Essencial, cinco sistemas entram no calendário: elétrica, hidráulica, ar-condicionado, bombas e gás. Piscina, jardim, automação, '
               'segurança eletrônica, cobertura, esquadrias e áreas externas entram no Diagnóstico e ficam fora do calendário.',
               [('Visitas', 'Uma por mês', ''), ('Cobertura, caixa d’água, esquadrias e áreas externas', 'Fora do calendário', ''), ('Equipamentos críticos', 'Teste trimestral', '')]),
 'premium': ('Premium e Concierge acompanham os mesmos doze sistemas. O que muda é a presença.',
             [('Visitas', 'Duas por mês', 'no Concierge, semanais'), ('Cobertura, caixa d’água, esquadrias e áreas externas', 'Inspeção semestral', 'no Concierge, trimestral'),
              ('Equipamentos críticos', 'Teste mensal', 'no Concierge, em toda visita')]),
 'concierge': ('Premium e Concierge acompanham os mesmos doze sistemas. O que muda é a presença.',
               [('Visitas', 'Semanais', 'no Premium, duas por mês'), ('Cobertura, caixa d’água, esquadrias e áreas externas', 'Inspeção trimestral', 'no Premium, semestral'),
                ('Equipamentos críticos', 'Teste em toda visita', 'no Premium, mensal')]),
}
# abertura ligada ao fecho de "A casa" ("Falta um gestor para a casa."); mantém a regra do REG-012 (todos entram no Diagnóstico,
# cada plano define o calendário) sem prometer ao Essencial o que ele não inclui
SIS_TEXTO = ('São doze sistemas, e cada um costuma ter um prestador diferente. No Diagnóstico do Imóvel todos entram. Depois, cada plano '
             'define quais entram no calendário e com que frequência. Escolha um plano para ver o que ele acompanha, no desenho e na lista.')
PN_DESTAQUE = re.compile(r'^(Em todos os planos|Premium e Concierge|No Essencial)')
def nota_html(k):
    """frase + três linhas do aviso; em "Todos", um quadro de três colunas (Essencial, Premium, Concierge). É o que a página
    traz sem JavaScript; o site.js monta as outras versões a partir de data-planos com a mesma marcação (montaNota)"""
    txt, linhas = PLAN_NOTA[k]; m = PN_DESTAQUE.match(txt)
    frase = ('<b>%s</b>%s' % (H.escape(m.group(1)), H.escape(txt[len(m.group(1)):]))) if m else H.escape(txt)
    if k == 'todos':
        corpo = ('<table class="pn-tab"><thead><tr><td></td><th scope="col">Essencial</th><th scope="col">Premium</th><th scope="col">Concierge</th></tr></thead><tbody>%s</tbody></table>'
                 % ''.join('<tr><th scope="row">%s</th>%s</tr>' % (H.escape(r[0]), ''.join('<td>%s</td>' % H.escape(v) for v in r[1:])) for r in linhas))
    else:
        corpo = '<dl class="pn-dl%s">%s</dl>' % (' plan-diff' if k in ('premium', 'concierge') else '', ''.join(
            '<div><dt>%s</dt><dd><span><span class="on">%s</span>%s</span></dd></div>' % (H.escape(a), H.escape(b), ('<small>%s</small>' % H.escape(c)) if c else '')
            for a, b, c in linhas))
    return '<p class="pn-t">%s</p>%s' % (frase, corpo)

def sistemas(page=False):
    hs = ''.join('\n          <li style="--x:%s%%;--y:%s%%;--k:%d"><button type="button" data-hs="%s" aria-label="%s"><i></i><span>%s</span></button></li>'
                 % (h['x'], h['y'], i + 1, h['id'], h['label'], h['label']) for i, h in enumerate(HOTS))
    # na Governança cada item é uma âncora para a linha do escopo; na home, um botão que aponta o sistema no desenho sem sair da página (MEL-013)
    li = ''.join('\n          <li data-sys="%s" data-g="%s" data-r>%s<svg class="ic draw" aria-hidden="true"><use href="#%s"/></svg><span class="sn">%s</span><small>%s</small>%s</li>'
                 % (h['id'], h['grupo'], ('<a href="#sis-%s">' % h['id']) if page else '<button type="button">', SIS_ICON[h['id']], h['label'], SIS_SUB[h['grupo']], '</a>' if page else '</button>') for h in HOTS)
    # na home, o fecho leva ao escopo da vistoria (governanca.html#sistemas); na Governança o escopo está logo abaixo
    foot = '' if page else '\n          <p class="sis-foot" data-r><a class="tlink" href="governanca.html#sistemas">Ver o escopo da vistoria, sistema a sistema %s</a></p>' % ARR
    # os textos do aviso e da lista vão num atributo (o site.js lê): uma fonte só, sem script inline fora da CSP
    dados = H.escape(json.dumps({'nota': PLAN_NOTA, 'sub': SIS_SUB_PLANO}, ensure_ascii=False, separators=(',', ':')), quote=True)
    return '''
    <div class="sis"%s data-planos="%s">
      <div class="head split">
        <div>
          <p class="eyebrow" data-r>A casa, sistema a sistema</p>
          <h2 class="h2" id="h-sis" data-r="rv">Os doze sistemas da casa, vistos em conjunto.</h2>
        </div>
        <p class="body muted" data-r>%s</p>
      </div>
      <div class="sis-grid">
        <figure class="house" data-r="house">
          <div class="house-wrap">
            %s
            <ul class="hs" aria-label="Pontos da casa">%s
            </ul>
          </div>
          <figcaption class="cap">Desenho esquemático da casa.</figcaption>
        </figure>
        <div class="sis-side" data-r>
          <div class="segp" role="group" aria-label="Ver o que cada plano acompanha">
            <button type="button" data-plan="" aria-pressed="true">Todos</button>
            <button type="button" data-plan="essencial" aria-pressed="false">Essencial</button>
            <button type="button" data-plan="premium" aria-pressed="false">Premium</button>
            <button type="button" data-plan="concierge" aria-pressed="false">Concierge</button>
          </div>
          <div class="pn-box">
            <div class="plan-nota" id="plan-nota" role="status" aria-live="polite">%s</div>
          </div>
          <ol class="sis-list" data-stagger="50">%s
          </ol>%s
        </div>
      </div>
    </div>''' % (' id="sistemas-da-casa"' if page else '', dados, SIS_TEXTO, HOUSE, hs, nota_html('todos'), li, foot)

def s02b():
    """terceira tela da home: a casa interativa (MEL-001), em névoa entre "A casa" (branco) e os pilares (branco)"""
    return '''<section class="sec bg-nevoa casa3" id="sistemas-da-casa" aria-labelledby="h-sis">
  <div class="wrap">%s
  </div>
</section>''' % sistemas(False)

# ===================================================================== 04 COMO TRABALHAMOS
STEPS = [
 ('Conversa', 'Conversa inicial', 'Ouvimos como a casa funciona hoje, o que incomoda e o que não pode falhar.'),
 ('Diagnóstico', 'Diagnóstico do Imóvel', 'Vistoria técnica, inventário de equipamentos e mapa de riscos, priorizado em urgente, 90 dias e 12 meses.'),
 ('Plano', 'Plano de gestão', 'Calendário preventivo anual e escolha do plano mais adequado, sem pressa.'),
 ('Rotina', 'Rotina e prestação de contas', 'Visitas, fornecedores, reparos e obras acompanhados, com relatório periódico e a sua aprovação em cada gasto relevante.'),
]
# o que o Diagnóstico entrega (documento de produtos, seção 02): uma lista só, na home (MEL-009) e na página Método
DIAG_ENTREGA = ['Inventário de equipamentos, com fotos', 'Nota de estado por sistema', 'Lista de riscos priorizada: urgente, 90 dias e 12 meses',
                'Plano preventivo anual', 'Estimativa de custos de correções e investimentos', 'Recomendação do plano mais adequado']
def s04(page=False):
    st = ''.join('''
      <li class="step" data-r>
        <span class="mk" aria-hidden="true"></span>
        <span class="nn">%d</span>
        <h3 class="h3">%s</h3>
        <p>%s</p>
      </li>''' % (i + 1, t, d) for i, (k, t, d) in enumerate(STEPS))
    if page: st = st.replace('<h3 class="h3">', '<h2 class="h3">').replace('</h3>', '</h2>')
    # ajuste A6: a nota "O Diagnóstico é a primeira etapa..." repetia o passo 2 e a introdução dos Planos; na home ficam os
    # seis entregáveis do Diagnóstico (MEL-009) e o caminho para a página Método
    note = '' if page else '''
    <div class="entrega-wrap" data-r>
      <p class="eyebrow">O Diagnóstico entrega</p>
      <ul class="entrega">%s
      </ul>
    </div>
    <div class="sec-foot" data-r><a class="tlink" href="metodo.html#diagnostico">Ver o Diagnóstico do Imóvel %s</a></div>''' % (''.join('\n        <li>%s</li>' % e for e in DIAG_ENTREGA), ARR)
    return '''<section class="sec %s met%s" id="como-trabalhamos" aria-labelledby="h-met">
  <div class="wrap">
    <div class="head split ilus sem-apoio">
      <div>
        <p class="eyebrow" data-r>Do primeiro olhar à rotina</p>
        %s
      </div>
      %s
    </div>
    <ol class="steps" data-stagger="120">
      <li class="track" aria-hidden="true"><span class="fill"></span></li>%s
    </ol>%s
  </div>
</section>''' % ('bg-white' if page else 'bg-nevoa', ' ent page-first' if page else '', title(page, 'h2', 'h-met', 'Começamos entendendo a sua casa.'), figura_ou_arte('vistoria', 'stairs'), st, note)

# ===================================================================== 05 PLANOS
# nível de presença como no kit e no motion 03: o anel é o mês, os pontos são as visitas (1, 2 e 4)
VISITAS = {1: ('Uma visita por mês', [-90]), 2: ('Duas visitas por mês', [-90, 90]), 3: ('Visitas semanais', [-90, 0, 90, 180])}
def anel(n, rotulo=True):
    import math
    pt = lambda a, r: (round(r * math.cos(math.radians(a)), 2), round(r * math.sin(math.radians(a)), 2))
    # as doze marcas do mês: um círculo tracejado (12 traços de 1 unidade num perímetro de 2π·18.75), em vez de doze caminhos
    tk = '<circle class="tk" r="18.75" stroke-dasharray="1 %s" stroke-dashoffset=".5" transform="rotate(-90)"/>' % round(2 * math.pi * 18.75 / 12 - 1, 3)
    d = ''.join('<circle class="d" cx="%s" cy="%s" r="3"/>' % pt(a, 13) for a in VISITAS[n][1])
    svg = '<svg viewBox="-21 -21 42 42" aria-hidden="true">%s<circle class="anel" r="13"/>%s</svg>' % (tk, d)
    return ('<span class="lvl" role="img" aria-label="%s">%s</span>' % (VISITAS[n][0], svg)) if rotulo else '<span class="lvl" aria-hidden="true">%s</span>' % svg

PLANS = [
 ('essencial', 'Essencial', 'Organização e controle', 'Para quem quer a casa em ordem e alguém que responda por ela.', 1, '790',
  ['Uma visita por mês', 'Plano de manutenção preventiva anual', 'Rede de prestadores homologados', 'Acompanhamento remoto de reparos', 'Relatório mensal resumido']),
 ('premium', 'Premium', 'Gestão ativa', 'Para casas maiores, rotinas intensas e segundas residências.', 2, '1.690',
  ['Duas visitas por mês', 'Piscina, jardim, automação e segurança eletrônica', 'Supervisão presencial de reparos e obras', 'Controle de custos por categoria', 'Atendimento prioritário']),
 ('concierge', 'Concierge', 'Gestão completa', 'Para propriedades complexas e proprietários que passam temporadas fora.', 3, '3.500',
  ['Visitas semanais', 'Orçamento anual de investimentos e previsão', 'Supervisão semanal de obras', 'Canal de atendimento dedicado', 'Reuniões trimestrais com o proprietário']),
]
def s05(page=False):
    tag = 'h2' if page else 'h3'
    cards = ''.join('''
      <article class="plan p%d" id="%s" data-r>
        <div class="plan-h">
          <div class="tier"><span class="eyebrow tnum">Plano %d</span>%s</div>
          <%s class="pn">%s</%s>
          <p class="sint">%s</p>
        </div>
        <div class="plan-b">
          <p class="perfil">%s</p>
          <ul class="list">%s
          </ul>
%s          <a class="tlink plan-cta" href="%s"%s>Conversar sobre o %s</a>
        </div>
      </article>''' % (n, pid, n, anel(n), tag, name, tag, sint, perf,
                       ''.join('\n          <li>%s</li>' % it for it in items),  # o losango vem do CSS (.plan .list li::before), sem um elemento por item (REG-048)
                       ('\n          <p class="price"><span class="pl">Mensalidade</span><span class="pv"><small>R$</small><b class="tnum">%s</b></span></p>' % price) if MOSTRAR_PRECOS else '',
                       ('contato.html?plano=%s' % name) if page else '#conversar', '' if page else ' data-plano="%s"' % name, name)
                    for pid, name, sint, perf, n, price, items in PLANS)
    cta = 'contato.html' if page else '#conversar'
    return '''<section class="sec %s planos%s" id="planos" aria-labelledby="h-pla">
  <div class="wrap">
    <div class="head split">
      <div>
        <p class="eyebrow" data-r>Planos</p>
        %s
      </div>
      <p class="body muted" data-r>Cada casa pede um nível de presença diferente. Os planos variam em frequência, profundidade e proximidade, e todos partem do diagnóstico.</p>
    </div>
    <div class="plans" data-stagger="120">%s
    </div>
    <div class="acc%s" id="comparativo" data-r>
      <button class="acc-btn" type="button" aria-expanded="%s" aria-controls="acc-body" id="acc-btn">
        <span><span class="at">Comparativo completo dos serviços</span><small>Inspeção, fornecedores, obras, relatórios e atendimento, plano a plano</small></span>
        <span class="pm" aria-hidden="true"></span>
      </button>
      <div class="acc-body" id="acc-body" role="region" aria-labelledby="acc-btn">
        <div><div class="acc-inner" id="matrix"%s>
%s
        </div></div>
      </div>
    </div>
    <div class="plans-foot">
      <dl class="note plans-dl" data-r>
        <div><dt>Mensalidade</dt><dd>%sA mensalidade remunera a gestão: visitas, gestão de fornecedores, acompanhamento e relatórios. O plano adequado é confirmado após o diagnóstico. Reajuste anual pelo IPCA, o índice oficial de inflação.</dd></div>
        <div><dt>Repasses e Diagnóstico</dt><dd>Serviços de terceiros, materiais e obras são repassados ao custo, com comprovante, mais a taxa de coordenação ou de supervisão declarada em contrato. __ABATIMENTO__</dd></div>
        <div><dt>Atendimento</dt><dd>__ATENDIMENTO__%s</dd></div>
      </dl>
      <a class="tlink" href="%s" data-r>Quer conversar sobre qual plano faz sentido para a sua casa? %s</a>
    </div>
  </div>
</section>''' % ('bg-nevoa' if page else 'bg-white', ' ent page-first' if page else '', title(page, 'h2', 'h-pla', 'Três formas de cuidar. Uma só maneira de trabalhar.'), cards,
                 ' open' if page else '', 'true' if page else 'false', '' if page else ' inert', matrix(),
                 '' if MOSTRAR_PRECOS else 'Os valores são apresentados após o diagnóstico, de acordo com o porte e as características de cada imóvel. ',
                 ' __ART__' if page else '', cta, ARR)

# ===================================================================== 06 O NOME
# Sem foto autorizada de Sebastião, a seção é tipográfica (ajuste A10 do roteiro da Sett): o nome em serifa grande,
# sem moldura vazia. O texto diz só o que está no documento da cliente (o parentesco); o tempo verbal da história
# e o resto dela são pendência da família.
def s06(page=False):
    f = foto('sebastiao')
    fig = ('<figure class="fig" data-r="slow"><div class="portrait">%s</div><figcaption class="cap">%s</figcaption></figure>' % (f, SLOTS['sebastiao']['legenda'])) if f else \
          '<p class="fig tipo" data-r="slow" aria-hidden="true">%s<span class="tn">Sebastião<br>Pitangui</span></p>' % PM
    return '''<section class="sec dark nome%s" id="o-nome" aria-labelledby="h-nome">
  <div class="wrap grid">
    %s
    <div class="txt">
      <p class="eyebrow" data-r>O nome</p>
      %s
      <div class="body" data-r>
        <p>Antes de dar nome a uma empresa, Pitangui já era o sobrenome de Sebastião Pitangui, pai de Samuel.</p>
        <p>Escolher esse nome foi uma decisão de responsabilidade. Quem entra na casa de alguém precisa de um nome que possa responder por si.</p>
      </div>
      <p class="quote" data-r>Um nome que responde por si.</p>
    </div>
  </div>
</section>''' % (' ent page-first' if page else '', fig, title(page, 'h2', 'h-nome', 'Pitangui é um nome que recebemos de herança.'))

# ===================================================================== 07 QUEM ESTÁ POR TRÁS
# Pessoas: só o que está no documento da cliente, sem os campos ainda em aberto (cargo, formação, anos, setores).
# Só Samuel tem cartão: Diana pediu para não aparecer (decisão de 20/10/2026, MEL-003); ela continua no texto
# ("Samuel ou Diana responde", WhatsApp, faixa "negócio de casal"). O rótulo do retrato é o nome até chegar a foto.
PESSOAS = [
 ('Samuel', 'Samuel conhece de perto o que separa uma operação que funciona de uma que apenas reage: contratos bem escritos, fornecedores bem avaliados, indicadores acompanhados e histórico registrado.'),
]
def s07():
    pe = ''.join('''
      <article class="person" data-r>
        <div class="portrait"%s>%s</div>
        <div class="ptx">
          <h3 class="h3">%s</h3>
          <div class="body"><p>%s</p></div>
        </div>
      </article>''' % ('' if foto('samuel') else ' aria-hidden="true"', foto('samuel') or '%s<span class="pl">%s</span>' % (PM, nome), nome, txt) for nome, txt in PESSOAS)
    # a âncora antiga (#samuel-e-diana) continua existindo: o kit e o protótipo podem apontar para ela
    return '''<section class="sec bg-white pessoas" id="quem-esta-por-tras" aria-labelledby="h-fam">
  <div class="wrap">
    <div class="head" id="samuel-e-diana">
      <p class="eyebrow" data-r>Quem está por trás</p>
      <h2 class="h2" id="h-fam" data-r="rv">Quem responde pela sua casa.</h2>
    </div>
    <div class="duo">
      <div class="faixa" data-r>
        <strong>Casados, empreendedores e moradores de Icaraí, em Niterói.</strong>
        <p>A Pitangui Fernandes é um negócio de casal, tocado por duas pessoas que vivem na cidade em que atendem, sabem o que significa deixar a casa nas mãos de alguém e respondem com o próprio nome por cada casa de que cuidam.</p>
      </div>%s
    </div>
  </div>
</section>''' % pe

# ===================================================================== 08 COMPROMISSOS
COMMITS = [
 ('i-comissao', 'Sem comissão escondida', 'Não recebemos comissão de fornecedores. Nossa remuneração é declarada em contrato.', ''),
 ('i-aprova', 'Você aprova os gastos', 'Nenhum gasto relevante acontece sem a sua aprovação prévia.', ''),
 ('i-recibo', 'Repasse ao custo', 'Serviços de terceiros e materiais são repassados ao custo, com comprovante. A nossa taxa de coordenação é declarada em contrato.', 'repasse'),
 ('i-chave', 'Discrição e acesso protegido', 'Chaves, senhas e a rotina da sua família são tratadas sob protocolo e termo de confidencialidade.', ''),
 ('i-verificado', 'Prestadores homologados', 'Toda a rede passa por critérios de homologação, e o nível de verificação acompanha o seu plano.', ''),
 ('i-historico', 'Histórico registrado', 'Cada serviço, equipamento e custo entra no histórico da casa. O histórico é seu, e vai com você se um dia nos deixar.', ''),
]
def s08(page=False):
    cm = ''.join('''
      <article class="cm"%s data-r>
        <div class="top"><span class="nn">%d</span><svg class="ic draw" aria-hidden="true"><use href="#%s"/></svg></div>
        <h3>%s</h3>
        <p>%s</p>
      </article>''' % ((' id="%s"' % cid) if cid else '', i + 1, ic, t, d) for i, (ic, t, d, cid) in enumerate(COMMITS))
    if page: cm = cm.replace('<h3>', '<h2>').replace('</h3>', '</h2>')
    return '''<section class="sec bg-nevoa comp%s" id="compromissos" aria-labelledby="h-comp">
  <div class="wrap">
    <div class="head split ilus">
      <div>
        <p class="eyebrow" data-r>O que assinamos embaixo</p>
        %s
      </div>
      <p class="body muted" data-r>Respondemos pelo que fazemos. Por isso, estes seis compromissos constam do nosso contrato.</p>
      %s
    </div>
    <div class="comps" data-stagger="100">%s
    </div>
  </div>
</section>''' % (' ent page-first' if page else '', title(page, 'h2', 'h-comp', 'Em um serviço de confiança, as regras precisam estar à vista.'), arte('contract'), cm)

# ===================================================================== 08b PERGUNTAS QUE OUVIMOS
# Só regras comerciais do documento de produtos (seção 06) sem "hip.": mensalidade, repasses, comissão, responsabilidade
# técnica (a constante ART, que na home vive aqui e não mais na nota dos Planos: REG-009 exige uma vez por página), upgrade e
# saída. Fora, por serem hipóteses ou pendências: prazo do relatório, limite de aprovação, horários, pagamento direto, seguro.
FAQ = [
 ('O que a mensalidade cobre?', 'Gestão, inspeção e relatórios. Não cobre serviços de terceiros, materiais e obras.'),
 ('Como funcionam os repasses?', 'Ao custo, com comprovante, mais a taxa de coordenação ou de supervisão declarada em contrato.'),
 ('Vocês recebem comissão de fornecedor?', 'Não. A comissão de fornecedor é proibida, e isso consta do contrato.'),
 ('Quem responde pelos serviços que exigem responsável técnico?', '__ART__'),
 ('Posso mudar para um plano maior?', 'A qualquer momento, com abatimento das visitas já realizadas.'),
 ('E se eu encerrar o contrato?', 'Você recebe o histórico e o inventário da casa.'),
]
def s08b():
    its = ''.join('''
      <details class="faq-i" data-r>
        <summary>%s<span class="pm" aria-hidden="true"></span></summary>
        <div class="faq-a"><p>%s</p></div>
      </details>''' % (q, a) for q, a in FAQ)
    return '''<section class="sec bg-white faq" id="perguntas" aria-labelledby="h-faq">
  <div class="wrap">
    <div class="head split">
      <div>
        <p class="eyebrow" data-r>Antes de contratar</p>
        <h2 class="h2" id="h-faq" data-r="rv">Perguntas que ouvimos.</h2>
      </div>
      <p class="body muted" data-r>Respostas curtas, com as regras que valem para qualquer plano. O que não estiver aqui, respondemos na conversa inicial.</p>
    </div>
    <div class="faq-list" data-stagger="80">%s
    </div>
  </div>
</section>''' % its

# ===================================================================== 09 CONVERSAR
def s09(page=False):
    d = 'data-r'
    ft = 'h2' if page else 'h3'
    return ('''<section class="sec dark talk%s" id="conversar" aria-labelledby="h-talk">
  %s
  <div class="wrap grid">
    <div class="txt">
      <p class="eyebrow" %s>Conversar</p>
      %s
      <p class="body" %s>O primeiro contato é uma conversa, sem compromisso, com Samuel ou Diana. Ouvimos como a casa funciona hoje e dizemos com franqueza se e como podemos ajudar.</p>
      <ol class="after" %s aria-label="O que acontece depois">
        <li><span class="n">1</span>Você envia a mensagem.</li>
        <li><span class="n">2</span>Samuel ou Diana responde e marca uma conversa, por telefone ou na sua casa.</li>
        <li><span class="n">3</span>Se fizer sentido, agendamos o Diagnóstico do Imóvel.</li>
      </ol>
      <div class="direct" %s>
        <a href="%s" target="_blank" rel="noopener"><span><small>WhatsApp</small><span class="tnum">%s</span></span>%s</a>
%s
        <a href="%s" target="_blank" rel="noopener"><span><small>Instagram</small><span>@pitanguifernandes</span></span>%s</a>
        <p class="area">Atendemos em Niterói, RJ.</p>
      </div>
    </div>
    <form class="form" id="form" method="post" novalidate data-wa="%s" %s>
      <h3 class="form-t">Solicitar conversa</h3>
      <p class="sub">Leva menos de um minuto. A mensagem segue pelo WhatsApp, já com os seus dados.</p>
      <p class="nojs">O formulário precisa de JavaScript para funcionar. Escreva para nós pelo <a href="%s" target="_blank" rel="noopener">WhatsApp, no <span class="tnum">%s</span></a>.</p>
      <div class="fields">
        <div class="two">
          <div class="f" id="f-nome"><label for="nome">Nome</label><input id="nome" name="nome" autocomplete="name" required aria-describedby="nome-msg"><span class="msg" id="nome-msg"></span></div>
          <div class="f" id="f-tel"><label for="tel">WhatsApp ou telefone</label><input id="tel" name="tel" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="(21) 90000-0000" required aria-describedby="tel-msg"><span class="msg" id="tel-msg"></span></div>
        </div>
        <div class="f" id="f-bairro"><label for="bairro">Bairro</label><input id="bairro" name="bairro" autocomplete="address-level3" placeholder="Ex.: Icaraí" aria-describedby="bairro-msg"><span class="msg" id="bairro-msg"></span></div>
        <fieldset class="f">
          <legend>Tipo de imóvel</legend>
          <div class="seg">
            <label><input type="radio" name="tipo" value="Casa" checked><span>Casa</span></label>
            <label><input type="radio" name="tipo" value="Apartamento"><span>Apartamento</span></label>
            <label><input type="radio" name="tipo" value="Segunda residência"><span>Segunda residência</span></label>
          </div>
        </fieldset>
        <div class="f"><label for="msg">Mensagem <em>opcional</em></label><textarea id="msg" name="msg" placeholder="Conte o que mais preocupa você hoje na casa."></textarea></div>
      </div>
      <button class="btn" type="submit">Solicitar conversa</button>
      <p class="micro">Seus dados são usados apenas para este contato, conforme a LGPD. <a href="privacidade.html">Política de Privacidade</a>.</p>
      <div class="done" id="done" role="status" aria-live="polite">
        <span class="dk" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>
        <h3 class="h3">Falta só enviar.</h3>
        <p>Abrimos o WhatsApp com a sua mensagem pronta. Para concluir, basta enviá-la por lá. Samuel ou Diana responde a você.</p>
        <p class="done-alt">O WhatsApp não abriu? <a id="wa-again" href="%s" target="_blank" rel="noopener">Tente abrir de novo</a> ou ligue para <a href="tel:+%s" class="tnum">%s</a>.</p>
        <button class="tlink" type="button" id="again">Enviar outra solicitação</button>
      </div>
    </form>
  </div>
</section>''' % (' ent page-first' if page else '', WM, d, title(page, 'h2', 'h-talk', 'Vamos conversar sobre a sua casa.', d), d, d, d,
                 wa(False), tel(), NE, ('\n        <a href="mailto:%s"><span><small>E-mail</small><span>%s</span></span>%s</a>' % (EMAIL, EMAIL, NE)) if EMAIL else '', IG, NE, WHATS, d, wa(False), tel(), wa(), WHATS, tel())).replace('<h3 class="form-t">', '<%s class="form-t">' % ft).replace('Solicitar conversa</h3>', 'Solicitar conversa</%s>' % ft).replace('<h3 class="h3">Falta só enviar.</h3>', '<%s class="h3">Falta só enviar.</%s>' % (ft, ft))

# ===================================================================== PÁGINAS: complementos
SYS = {
 'A': ('Em todos os planos', 'Checklist de elétrica, hidráulica, ar-condicionado, bombas e gás, do Essencial ao Concierge.',
       'Teste de equipamentos críticos: trimestral no Essencial, mensal no Premium e em toda visita no Concierge.',
       [('eletrica', 'Elétrica'), ('hidraulica', 'Hidráulica'), ('ar-condicionado', 'Ar-condicionado'), ('bombas', 'Bombas'), ('gas', 'Gás')],
       ('y', 'y', 'y')),
 'B': ('Nos planos Premium e Concierge', 'Piscina, jardim, automação e segurança eletrônica entram na rotina a partir do Premium.', '',
       [('piscina', 'Piscina'), ('jardim', 'Jardim'), ('automacao', 'Automação'), ('seguranca', 'Segurança eletrônica')],
       ('n', 'y', 'y')),
 'C': ('Inspeção periódica', 'Cobertura, caixa d’água, esquadrias e áreas externas: semestral no Premium e trimestral no Concierge.', '',
       [('cobertura', 'Cobertura e caixa d’água'), ('esquadrias', 'Esquadrias'), ('areas-externas', 'Áreas externas')],
       ('n', 'Semestral', 'Trimestral')),
}
def cell(v, plan):
    if v == 'y': return '<span class="c">%s<span class="sr">%s: incluído</span></span>' % (YES, plan)
    if v == 'n': return '<span class="c"><i class="no" aria-hidden="true"></i><span class="sr">%s: não incluído</span></span>' % plan
    return '<span class="c"><span class="sr">%s: </span>%s</span>' % (plan, v)

def escopo():
    groups = ''
    for L in 'ABC':
        t, d, nota, items, cov = SYS[L]
        rows = ''.join('\n            <li id="sis-%s"><span class="sn"><i class="dia"></i>%s</span>%s</li>' % (sid, name, ''.join(cell(cov[k], p) for k, p in enumerate(['Essencial', 'Premium', 'Concierge'])))
                       for sid, name in items)
        groups += '''
      <div class="esc-g" data-r>
        <div class="esc-gh">
          <p class="eyebrow">Grupo %s</p>
          <h3 class="h3">%s</h3>
          <p>%s</p>%s
        </div>
        <div class="esc-tab">
          <div class="esc-cols" aria-hidden="true"><span>Sistema</span><span>Essencial</span><span>Premium</span><span>Concierge</span></div>
          <ul class="esc-rows">%s
          </ul>
        </div>
      </div>''' % (L, t, d, ('\n          <p class="note">%s</p>' % nota) if nota else '', rows)
    return '''<section class="sec bg-white" id="sistemas" aria-labelledby="h-esc">
  <div class="wrap">
    <div class="head split">
      <div>
        <p class="eyebrow" data-r>Escopo da vistoria</p>
        <h2 class="h2" id="h-esc" data-r="rv">Cada sistema da casa, com nota de estado e histórico.</h2>
      </div>
      <p class="body muted" data-r>Elétrica, hidráulica, ar-condicionado, bombas, gás, cobertura, esquadrias, áreas externas, piscina, jardim, automação e segurança eletrônica. Todos entram no Diagnóstico do Imóvel. Depois, cada plano define a frequência das inspeções.</p>
    </div>
    <div class="esc">%s
    </div>
    <div class="esc-foot" data-r>
      <p>O diagnóstico entrega o inventário de equipamentos, com fotos, e a nota de estado de cada sistema.</p>
      <div class="esc-links">
        <a class="tlink" href="metodo.html#diagnostico">Ver o Diagnóstico do Imóvel %s</a>
        <a class="tlink" href="planos.html#comparativo">Ver o comparativo dos planos %s</a>
      </div>
    </div>
  </div>
</section>''' % (groups, ARR, ARR)

def diagnostico():
    vis = '\n      <div><dt>Vistoria</dt><dd class="val">1 visita</dd><dd class="sub">Cerca de 6 horas na casa, com inventário e fotos de cada sistema.</dd></div>'
    rel = '\n      <div><dt>Relatório</dt><dd class="val">Até 7 dias úteis</dd><dd class="sub">Nota de estado por sistema, riscos priorizados e plano preventivo anual.</dd></div>'
    aba = ABATIMENTO
    if MOSTRAR_PRECOS:
        ficha = '\n      <div><dt>Investimento</dt><dd class="val"><small>R$</small><b class="tnum">2.750</b></dd><dd class="sub">%s</dd></div>' % aba + vis + rel
    else:  # sem valores: a ficha segue a ordem do processo e termina no abatimento
        ficha = vis + rel + '\n      <div><dt>Abatimento</dt><dd class="val">Até 30 dias</dd><dd class="sub">%s</dd></div>' % aba
    scope = ['Elétrica', 'Hidráulica', 'Ar-condicionado', 'Bombas', 'Gás', 'Cobertura', 'Esquadrias', 'Áreas externas', 'Piscina', 'Jardim', 'Automação', 'Segurança eletrônica']
    rec = DIAG_ENTREGA
    return '''<section class="sec bg-nevoa diag" id="diagnostico" aria-labelledby="h-diag">
  <div class="wrap">
    <div class="head split">
      <div>
        <p class="eyebrow" data-r>Primeira etapa</p>
        <h2 class="h2" id="h-diag" data-r="rv">O Diagnóstico do Imóvel é a primeira etapa de qualquer plano.</h2>
      </div>
      <p class="body muted" data-r>Um retrato objetivo da casa e um plano para os próximos 12 meses. É onde o rigor técnico aparece, antes de qualquer contrato.</p>
    </div>
    <dl class="ficha" data-r>%s
    </dl>
    <div class="cols">
      <div data-r>
        <p class="eyebrow">Escopo da vistoria</p>
        <ul class="scope">%s
        </ul>
      </div>
      <div data-r>
        <p class="eyebrow">O que você recebe</p>
        <ul class="list">%s
        </ul>
      </div>
    </div>
    <p class="note art-nota" data-r>__ART__</p>
  </div>
</section>''' % (ficha, ''.join('\n          <li><i class="dia"></i>%s</li>' % s for s in scope), ''.join('\n          <li><i class="dia"></i>%s</li>' % s for s in rec))

def nxt(href, label, t, s):
    return '''<a class="next" href="%s">
  <div class="wrap">
    <span class="eyebrow">Próximo · %s</span>
    <span class="t">%s</span>
    <span class="s">%s</span>
    <span class="go" aria-hidden="true">%s</span>
  </div>
</a>''' % (href, label, t, s, GO)

def phero(eyebrow, h, lead, extra=''):
    return '''<section class="phero dark ent" aria-labelledby="h-page">
  %s
  <div class="wrap">
    <p class="eyebrow" data-h>%s</p>
    <h1 class="h2 h1p" id="h-page" data-h style="--d:.08s">%s</h1>
    <p class="lead" data-h style="--d:.2s">%s</p>%s
  </div>
</section>''' % (WM, eyebrow, h, lead, extra)

POLITICA_ATUALIZADA = '19 de outubro de 2026'
def priv():
    """Política de Privacidade em linguagem simples (LGPD). Revisão por advogado da família antes do lançamento."""
    canal = '<a href="%s" target="_blank" rel="noopener">WhatsApp, no <span class="tnum">%s</span></a>' % (wa(False), tel())
    if EMAIL:
        canal += ', ou pelo e-mail <a href="mailto:%s">%s</a>' % (EMAIL, EMAIL)
    return '''<section class="sec bg-white">
  <div class="wrap">
    <div class="prose">
      <h2>Quem cuida dos seus dados</h2>
      <p>A Pitangui Fernandes, empresa de família de Niterói, RJ, é quem decide como são usados os dados enviados por este site. A razão social e o CNPJ da empresa entram nesta página no lançamento do site. Para qualquer pedido sobre os seus dados, escreva para nós pelo %s.</p>
      <h2>Que dados coletamos</h2>
      <p>Pelo formulário de contato, pedimos apenas o necessário para conversar com você: nome, WhatsApp ou telefone, bairro, tipo de imóvel e, se quiser, uma mensagem.</p>
      <h2>Para que usamos</h2>
      <p>Usamos esses dados somente para retornar o seu contato e combinar a conversa inicial. Não vendemos seus dados e não enviamos publicidade.</p>
      <h2>Com que base legal</h2>
      <p>Tratamos esses dados porque você pediu o contato. A Lei Geral de Proteção de Dados chama isso de procedimentos preliminares de um contrato, feitos a pedido do titular (Lei 13.709/2018, art. 7º, inciso V).</p>
      <h2>Por onde os dados passam</h2>
      <p>O formulário não envia nada ao site: ele abre o seu próprio WhatsApp com a mensagem pronta, e você decide se envia. A partir daí, a conversa fica no WhatsApp, serviço da Meta, que segue a política de privacidade dele.</p>
      <p>O site é hospedado pela Vercel, que registra dados técnicos de cada acesso, como endereço IP e navegador, para funcionar e se proteger. Meta e Vercel têm sede fora do Brasil, então esses dados podem ser tratados no exterior.</p>
      <h2>Por quanto tempo guardamos</h2>
      <p>Guardamos os dados pelo tempo necessário para o atendimento. Se você não se tornar cliente, pode pedir a exclusão a qualquer momento.</p>
      <h2>Seus direitos</h2>
      <p>Pela LGPD (art. 18), você pode pedir: a confirmação de que tratamos seus dados; o acesso a eles; a correção de dados incompletos ou errados; a anonimização, o bloqueio ou a eliminação de dados desnecessários; a portabilidade para outro fornecedor; a eliminação dos dados; e a informação sobre com quem eles foram compartilhados. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>
      <p>Para fazer qualquer um desses pedidos, escreva pelo %s.</p>
      <h2>Cookies e estatísticas</h2>
      <p>Este site não usa cookies nem ferramentas de estatística ou de rastreamento, e as fontes e imagens vêm do próprio site. Durante a visita, o navegador guarda apenas marcações técnicas, por exemplo para não repetir a animação de abertura, que não saem do seu aparelho.</p>
      <h2>Clientes</h2>
      <p>Para quem contrata um plano, chaves, senhas e a rotina da família são tratadas sob protocolo e termo de confidencialidade, previstos em contrato. O histórico da casa pertence ao cliente e é entregue a ele se o contrato terminar.</p>
      <p class="note">Última atualização: %s.</p>
    </div>
  </div>
</section>''' % (canal, canal, POLITICA_ATUALIZADA)

# ===================================================================== comparativo (tabela real)
N = '<i class="no" aria-hidden="true"></i><span class="sr">Não incluído</span>'
def y(t='Incluído'): return YES + t
MX = [
 ('A', 'Inspeção e manutenção preventiva', [
  ('Plano de manutenção preventiva anual', y(), y(), y('Com orçamento anual de investimentos')),
  ('Checklist: elétrica, hidráulica, ar-condicionado, bombas e gás', y(), y(), y()),
  ('Piscina, jardim, automação e segurança eletrônica', N, y(), y()),
  ('Cobertura, caixa d’água, esquadrias e áreas externas', N, 'Semestral', 'Trimestral'),
  ('Teste de equipamentos críticos', 'Trimestral', 'Mensal', 'Em toda visita'),
  ('Inventário de equipamentos', 'Principais equipamentos', 'Completo, com etiqueta e código QR', 'Completo, com vida útil e plano de reposição'),
  ('Controle de pragas', 'Lembrete', 'Agendamento e conferência', 'Agendamento e conferência'),
  ('Vistoria antes e depois de viagens ou temporais', N, 'Uma por trimestre', 'Sob demanda, em horário comercial')]),
 ('B', 'Gestão de fornecedores', [
  ('#Seleção e contratação',),
  ('Rede de prestadores homologados', y(), y(), y('Prioritária')),
  ('Critérios de homologação (documentos, referências, seguro)', 'Básicos', 'Completos', 'Completos, com reavaliação semestral'),
  ('Cotações comparativas', '2 orçamentos', '3 orçamentos', '3 orçamentos e negociação'),
  ('Análise técnica das propostas (escopo, materiais, prazo)', 'Resumo', 'Comparativo', 'Comparativo e recomendação fundamentada'),
  ('Ordens de serviço e contratos', 'Ordem de serviço', 'Ordens de serviço e contratos recorrentes', 'Ordens de serviço, contratos e renegociação anual'),
  ('#Acompanhamento e controle',),
  ('Acompanhamento da execução', 'Remoto, com fotos', 'Presencial nos serviços relevantes', 'Presencial e conferência final'),
  ('Conferência de qualidade e aceite', 'Checklist básico', y(), y('Com termo de aceite')),
  ('Controle de garantias', 'Registro', 'Registro e alertas de prazo', 'Registro, alertas e acionamento'),
  ('Documentação dos prestadores (seguro, saúde ocupacional e normas de segurança)', N, 'Básica', 'Completa'),
  ('Avaliação de desempenho (prazo, qualidade, retrabalho)', N, 'Semestral', 'Trimestral')]),
 ('C', 'Supervisão de obras e reparos', [
  ('#Reparos corretivos',),
  ('Diagnóstico da causa e definição de escopo', y(), y(), y()),
  ('Acionamento e coordenação do prestador', y(), y(), y()),
  ('Acompanhamento da execução', 'Remoto, com fotos e relato', 'Presencial nos casos relevantes', 'Presencial'),
  ('Conferência de entrega e registro no histórico', y(), y(), y()),
  ('Análise de causa raiz em falhas recorrentes', N, y(), y()),
  ('#Obras e reformas',),
  ('Levantamento de escopo e memorial descritivo', 'Simples', y(), y()),
  ('Compatibilização com arquiteto e projetistas', N, y(), y()),
  ('Cotação e comparativo de propostas', '3 propostas', '3 propostas e análise', '3 propostas, análise e negociação'),
  ('Cronograma e plano de obra', 'Marcos principais', 'Cronograma detalhado', 'Detalhado, com controle semanal'),
  ('Visitas de supervisão', 'Início, meio e fim', 'Quinzenais', 'Semanais'),
  ('Registro fotográfico e relatório da obra', 'Fotos nos marcos', 'Relatório quinzenal', 'Diário de obra semanal'),
  ('Controle de medições e pagamentos conforme avanço', N, y(), y()),
  ('Gestão de mudanças de escopo (aditivos)', y(), y(), y()),
  ('Vistoria final e lista de pendências', y(), y(), y('Com acompanhamento pós-obra de 90 dias')),
  ('Entrega de documentação (notas, manuais, garantias e desenhos finais da obra)', 'Arquivo básico', y(), y('Completa'))]),
 ('D', 'Governança e relatórios', [
  ('Relatório mensal', 'Resumido', 'Completo', 'Completo, com comentário do gestor'),
  ('Histórico de serviços e equipamentos', 'Planilha', 'Plataforma', 'Plataforma com acesso do proprietário'),
  ('Controle de custos', N, 'Por categoria', 'Por categoria, com orçamento anual e previsão'),
  ('Indicadores', 'Chamados abertos e fechados', 'Preventiva × corretiva e custo por sistema', 'Também disponibilidade de sistemas críticos'),
  ('Painel de obras e contratos', N, y(), y()),
  ('Reunião com o proprietário', N, 'Semestral', 'Trimestral')]),
 ('E', 'Atendimento', [
  ('Canal', 'WhatsApp comercial', 'WhatsApp prioritário', 'Canal dedicado'),
  ('Abertura e acompanhamento de chamados', y(), y(), y()),
  ('Prioridade no acionamento da rede', N, y(), y('Prioritária')),
  ('Protocolo de emergência da casa (registros, quadros, gás, contatos)', y(), y(), y()),
  ('Guarda de chaves e acessos', N, 'Cadastro de acessos', 'Guarda segura e protocolo')]),
]
P = ['Essencial', 'Premium', 'Concierge']
def matrix():
    lvl = lambda n: anel(n, rotulo=False)
    seg = ''.join('<button type="button" class="p%d" data-show="%s" aria-pressed="%s">%s</button>' % (i + 1, q, 'true' if i == 0 else 'false', q) for i, q in enumerate(P))
    o = ['          <div class="mx-wrap" data-show="%s">' % P[0],
         '          <div class="mx-top">',
         '            <div class="mx-seg" role="group" aria-label="Plano exibido no comparativo">%s</div>' % seg,
         '            <p class="mx-leg"><span><i class="yes" aria-hidden="true"></i>incluído</span><span><i class="no" aria-hidden="true"></i>não incluído</span></p>',
         '          </div>',
         '          <table class="mx" role="table">', '            <caption class="sr">Comparativo dos serviços por plano</caption>',
         '            <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Serviço</th>'
         + ''.join('<th scope="col" role="columnheader" class="p%d"><span class="pn">%s</span>%s</th>' % (i + 1, q, lvl(i + 1)) for i, q in enumerate(P)) + '</tr></thead>']
    for L, t, rows in MX:
        o.append('            <tbody role="rowgroup">')
        o.append('              <tr class="mx-g" role="row"><th colspan="4" scope="colgroup" role="rowheader"><b>%s</b><span>%s</span></th></tr>' % (L, t))
        for r in rows:
            if len(r) == 1:
                o.append('              <tr class="mx-sub" role="row"><th colspan="4" scope="colgroup" role="rowheader">%s</th></tr>' % r[0][1:])
                continue
            # no celular o cabeçalho da tabela some (um plano por vez): cada célula diz ao leitor de tela de qual plano é
            cells = ''.join('<td role="cell" data-p="%s" class="p%d%s"><span class="sr">%s: </span>%s</td>' % (P[k], k + 1, ' inc' if r[k + 1] == YES + 'Incluído' else '', P[k], r[k + 1]) for k in range(3))
            o.append('              <tr role="row"><th scope="row" role="rowheader">%s</th>%s</tr>' % (r[0], cells))
        o.append('            </tbody>')
    o.append('          </table>')
    o.append('          </div>')
    return '\n'.join(o)

# ===================================================================== moldura da página
# a vinheta só na primeira página vista na sessão (nem em recargas, nem ao voltar à home).
# Rede de segurança: se o site.js não começar em 600 ms (rede lenta), a página aparece inteira na hora,
# sem vinheta e sem as entradas animadas (o site.js marca window.__pf quando roda).
HEAD_JS = ("<script>(function(h){h.classList.add('js');try{if(sessionStorage.getItem('pf-intro'))h.classList.add('no-intro');"
           "else sessionStorage.setItem('pf-intro','1')}catch(e){}setTimeout(function(){var d=document,b=d.body,i=d.getElementById('intro');"
           "if(window.__pf||!b)return;h.classList.add('pf-ja');if(i)i.remove();b.classList.add('ready');"
           "d.querySelectorAll('[data-r]').forEach(function(e){e.classList.add('in')});setTimeout(function(){h.classList.remove('pf-ja')},60)},600)})(document.documentElement)</script>")
def ld_json():
    """dados estruturados da empresa; endereços sempre a partir de SITE. Só o que está confirmado: nada de fundador,
    horário, faixa de preço ou avaliação enquanto a família não confirmar (o site também não publica)"""
    d = {
        '@context': 'https://schema.org',
        '@type': 'ProfessionalService',
        '@id': SITE + '#empresa',
        'name': 'Pitangui Fernandes',
        'slogan': 'Você cuida da sua família. Nós cuidamos da sua casa.',
        'description': 'Governança residencial: gestão técnica da residência, com inspeção, gestão de fornecedores, supervisão de reparos e obras e prestação de contas.',
        'url': SITE,
        'logo': SITE + 'assets/apple-touch-icon.png',
        'image': SITE + 'assets/og.jpg',
        'telephone': '+%s %s %s-%s' % (WHATS[:2], WHATS[2:4], WHATS[4:-4], WHATS[-4:]),
        'areaServed': {'@type': 'City', 'name': 'Niterói'},
        'address': {'@type': 'PostalAddress', 'addressLocality': 'Niterói', 'addressRegion': 'RJ', 'addressCountry': 'BR'},
        'sameAs': ['https://www.instagram.com/pitanguifernandes/'],
    }
    if EMAIL:
        d['email'] = EMAIL
    if EMAIL: d['email'] = EMAIL
    return '<script type="application/ld+json">\n%s\n</script>' % json.dumps(d, ensure_ascii=False, indent=2)
SETT = ('<aside class="sett-faixa" aria-label="Aviso de prévia">Prévia feita pela <a href="https://www.sett.company/" target="_blank" rel="noopener">'
        '<img src="assets/img/sett-branco.png" alt="Sett" width="254" height="96"></a> para a <b>Pitangui Fernandes</b> · não oficial</aside>')
INTRO = '''<!-- ============ ABERTURA ANIMADA ============ -->
<div class="intro" id="intro" aria-hidden="true">
  <span class="ip ip-a"></span>
  <span class="ip ip-b"></span>
  <span class="iline"></span>
  <div class="intro-in">
    <svg class="imono" viewBox="18 18 423 539">
      <path class="m1" pathLength="1" fill-rule="evenodd" d="M 412 114 L 275 34 L 248 20 L 20 152 L 20 336 L 105 385 L 106 290 Z M 285 117 L 82 235 L 80 234 L 80 193 L 243 98 L 250 96 Z"/>
      <path class="m2" pathLength="1" fill-rule="evenodd" d="M 439 142 L 149 309 L 149 555 L 220 514 L 221 448 L 305 400 L 305 329 L 222 377 L 220 376 L 220 342 L 438 216 Z"/>
    </svg>
    <span class="ilock"><span class="iwm"><span class="wordmark"></span></span><span class="tagline">Governança residencial</span></span>
  </div>
</div>'''
LOCK = '<span class="lock" aria-hidden="true"><span class="wordmark"></span><span class="tagline">Governança residencial</span></span>'

def header(cur, home=False):
    nav = '\n'.join('      <a href="%s"%s>%s</a>' % (h, ' aria-current="page"' if h == cur else '', t) for h, t in [('index.html', 'Início')] + NAV)
    return '''<header class="hdr" id="hdr">
  <div class="wrap">
    <a class="brand" href="index.html" aria-label="Pitangui Fernandes, Governança residencial, página inicial">
      <svg viewBox="18 18 423 539" aria-hidden="true"><use href="#mP" class="mono"/><use href="#mF" class="mF"/></svg>
      %s
    </a>
    <nav class="nav" aria-label="Principal">
%s
    </nav>
    <a class="btn" href="%s"%s>Conversar</a>
    <button class="burger" id="burger" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="mnav"><span class="bt" aria-hidden="true"><b>Menu</b><b>Fechar</b></span><span class="bl" aria-hidden="true"><i></i><i></i></span></button>
  </div>
  <span class="prog" aria-hidden="true"></span>
</header>''' % (LOCK, nav, '#conversar' if home else 'contato.html', ' aria-current="page"' if cur == 'contato.html' else '')

def mnav(cur):
    items = [('index.html', 'Início')] + NAV
    li = '\n'.join('    <li style="--i:%d"><a href="%s"%s><span class="mi">%02d</span><span class="mt">%s</span></a></li>'
                   % (i, h, ' aria-current="page"' if h == cur else '', i + 1, t) for i, (h, t) in enumerate(items))
    return '''<nav class="mnav" id="mnav" aria-label="Menu" aria-hidden="true" inert>
  <ol>
%s
  </ol>
  <div class="mfoot">
    <a class="btn" href="contato.html">Conversar sobre a sua casa</a>
    <a class="mwa" href="%s" target="_blank" rel="noopener"><small>WhatsApp</small><span class="tnum">%s</span></a>
    <p>Empresa de família · Niterói, RJ</p>
  </div>
</nav>''' % (li, wa(), tel())

def footer():
    navl = '\n'.join('          <li><a href="%s">%s</a></li>' % (h, t) for h, t in [('index.html', 'Início')] + NAV)
    return '''<footer class="foot">
  <div class="wrap">
    <div class="foot-g">
      <div class="b">
        <a class="brand" href="index.html" aria-label="Pitangui Fernandes, Governança residencial, página inicial" data-r="logo">
          <svg viewBox="18 18 423 539" aria-hidden="true"><use href="#mP" class="mono"/><use href="#mF" class="mF"/></svg>
          %s
        </a>
        <p>Empresa de família. Niterói, RJ.</p>
      </div>
      <div class="c">
        <p class="fh">Contato</p>
        <ul>
          <li><a href="%s" target="_blank" rel="noopener" class="tnum">%s</a></li>%s
          <li><a href="%s" target="_blank" rel="noopener">Instagram</a></li>
        </ul>
      </div>
      <div class="c">
        <p class="fh">Navegação</p>
        <ul>
%s
        </ul>
      </div>
      <div class="c">
        <p class="fh">Informações</p>
        <ul>
          <li><a href="contato.html">Conversar</a></li>
          <li><a href="privacidade.html">Política de Privacidade</a></li>
        </ul>
      </div>
    </div>
    <div class="legal"><span>Pitangui Fernandes | Governança Residencial</span><span>© 2026</span></div>
  </div>
</footer>''' % (LOCK, wa(False), tel(), ('\n          <li><a href="mailto:%s">%s</a></li>' % (EMAIL, EMAIL)) if EMAIL else '', IG, navl)

def wabtn():
    """botão do WhatsApp no canto; o balão de boas-vindas (com avatar e "on-line") só com BALAO_WHATSAPP"""
    pop = '''  <div class="wa-pop" id="wa-pop" role="dialog" aria-labelledby="wa-t" aria-hidden="true">
    <button class="wa-x" type="button" id="wa-x" aria-label="Fechar mensagem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    <div class="wa-who">
      <span class="wa-av" aria-hidden="true"><svg viewBox="18 18 423 539"><use href="#mP" fill="#fff"/><use href="#mF" fill="#A2A8B4"/></svg></span>
      <span><b>Pitangui Fernandes</b><small>Samuel e Diana · Niterói</small></span>
    </div>
    <p class="wa-t" id="wa-t">Olá. Quer conversar sobre a sua casa?</p>
    <p class="wa-s">Fale com Samuel ou Diana pelo WhatsApp.</p>
    <a class="wa-go" href="__WA__" target="_blank" rel="noopener">Iniciar conversa</a>
  </div>
'''.replace('__WA__', wa()) if BALAO_WHATSAPP else ''
    return '''<aside class="wa" id="wa" aria-label="WhatsApp">
%s  <a class="wa-btn" href="%s" target="_blank" rel="noopener" aria-label="Conversar pelo WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" %s/></svg></a>
</aside>''' % (pop, wa(), WAPATH)

# fontes hospedadas no próprio site (subconjunto latin do Google Fonts, licença SIL OFL 1.1, em src/fonts/):
# nada de requisição a terceiros, medição de layout igual em qualquer máquina e nenhum IP de visitante enviado ao Google.
# Newsreader com eixo óptico (16 a 72) e peso 500, o "Medium" que o manual do kit (p.14) usa nos títulos.
# O último número de cada face é o size-adjust: os tamanhos do CSS seguem a Direção de Arte (pensados para a
# Cormorant, de olho pequeno); a Newsreader é 16% mais larga e a Jost tem olho menor que a Inter, então cada face
# é ajustada para manter as quebras de linha e o peso visual aprovados.
TIPOS = {
    'sett': dict(serif="'Newsreader',Georgia,'Times New Roman',serif", sans="'Jost',Arial,Helvetica,sans-serif", peso=500,
                 faces=[('Newsreader', 'normal', '500', 'newsreader-500.woff2', 90), ('Newsreader', 'italic', '500', 'newsreader-500-italic.woff2', 90),
                        ('Jost', 'normal', '400 600', 'jost.woff2', 100)],
                 licencas=['OFL-newsreader.txt', 'OFL-jost.txt']),
    'cliente': dict(serif="'Cormorant Garamond',Georgia,'Times New Roman',serif", sans="'Inter',Arial,Helvetica,sans-serif", peso=600,
                    faces=[('Cormorant Garamond', 'normal', '600', 'cormorant-garamond-600.woff2', 100), ('Cormorant Garamond', 'italic', '600', 'cormorant-garamond-600-italic.woff2', 100),
                           ('Inter', 'normal', '400 600', 'inter.woff2', 100)],
                    licencas=['OFL-cormorantgaramond.txt', 'OFL-inter.txt']),
}

def fontes_head():
    """pré-carrega as duas faces da primeira tela (título e texto); o itálico chega quando for usado"""
    t = TIPOS[TIPOGRAFIA]
    return '\n'.join('<link rel="preload" href="assets/fonts/%s" as="font" type="font/woff2" crossorigin>' % f
                     for fam, est, peso, f, aj in t['faces'] if est == 'normal')

def fontes_css():
    t = TIPOS[TIPOGRAFIA]
    faces = '\n'.join("@font-face{font-family:'%s';font-style:%s;font-weight:%s;font-display:swap;src:url(../fonts/%s) format('woff2')%s}"
                      % (fam, est, peso, f, (';size-adjust:%d%%' % aj) if aj != 100 else '') for fam, est, peso, f, aj in t['faces'])
    return ('/* fontes: %s; licença SIL Open Font License 1.1 em %s */\n%s\n:root{--serif:%s;--sans:%s;--sw:%d}'
            % (' e '.join(dict.fromkeys(f[0] for f in t['faces'])), ', '.join('/assets/fonts/' + l for l in t['licencas']), faces, t['serif'], t['sans'], t['peso']))

def copia_fontes():
    """assets/fonts/ recebe só as fontes da chave (e as licenças); as da outra tipografia saem do site publicado"""
    t = TIPOS[TIPOGRAFIA]; dst = os.path.join(ROOT, 'assets', 'fonts'); os.makedirs(dst, exist_ok=True)
    quero = [f[3] for f in t['faces']] + t['licencas']
    for f in os.listdir(dst):
        if f not in quero: os.remove(os.path.join(dst, f))
    for f in quero: shutil.copyfile(os.path.join(B, 'fonts', f), os.path.join(dst, f))

def page(fname, title_, desc, main, cur=None, dark_top=False, intro=True, robots=None, ld=False, canon=None):
    jsonld = ld
    url = SITE + (canon if canon is not None else fname)
    # canonical só em página que pode ser indexada (o noindex da prévia vem da chave e não conta)
    canonical = '' if robots and 'noindex' in robots else '<link rel="canonical" href="%s">\n' % url
    if PREVIA:  # a prévia não oficial não entra na busca (a faixa e o noindex andam juntos)
        robots = 'noindex' if not robots else robots if 'noindex' in robots else robots + ', noindex'
    intro = intro and fname == 'index.html'  # a vinheta só na chegada à home; quem abre um link interno vê a página na hora
    t = H.escape(title_, quote=True); dsc = H.escape(desc, quote=True)
    head = '''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>%s</title>
<meta name="description" content="%s">
%s<meta name="theme-color" content="%s">
<meta name="color-scheme" content="light only">
%s<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Pitangui Fernandes">
<meta property="og:title" content="%s">
<meta property="og:description" content="%s">
<meta property="og:url" content="%s">
<meta property="og:image" content="%s">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Pitangui Fernandes, Governança Residencial: Você cuida da sua família. Nós cuidamos da sua casa.">
<meta name="twitter:card" content="summary_large_image">
%s
<link rel="stylesheet" href="assets/css/site.css">
%s%s
</head>''' % (t, dsc, ('<meta name="robots" content="%s">\n' % robots) if robots else '', '#071B36' if dark_top else '#ffffff',
              canonical, t, dsc, url, SITE + 'assets/og.jpg', fontes_head(), (ld_json() + '\n') if jsonld else '', HEAD_JS)
    body = ['<body class="%s">' % ('top-dark' if dark_top else 'top-light'), '<a class="skip" href="#conteudo">Pular para o conteúdo</a>'] + ([SETT] if PREVIA else []) + ['',
            '<!-- ============ SVG: monograma + ícones de linha ============ -->', SPRITE, '']
    if intro: body += [INTRO, '']
    body += [header(cur, home=(fname == 'index.html')), '', mnav(cur), '', '<main id="conteudo">', main.rstrip(), '</main>', '', footer(), '', wabtn(), '',
             '<!-- se o script não carregar, o conteúdo escondido para a entrada animada volta a aparecer -->', '<script src="assets/js/site.js" defer onerror="document.documentElement.classList.remove(\'js\')"></script>', '</body>', '</html>', '']
    return head + '\n' + '\n'.join(body)

TITLES = {
 'index.html': ('Pitangui Fernandes | Gestão e governança residencial em Niterói',
                'Gestão profissional da sua casa em Niterói: inspeção, fornecedores, reparos e obras supervisionadas, com relatórios claros. Empresa de família.'),
 'governanca.html': ('Governança residencial em Niterói | Pitangui Fernandes',
                     'O que fazemos, em quatro pilares: cuidar da casa, gerir fornecedores, supervisionar obras e reparos, e prestar contas. E a vistoria, sistema a sistema.'),
 'metodo.html': ('Método e Diagnóstico do Imóvel em Niterói | Pitangui Fernandes',
                 'Da conversa à rotina, em quatro passos. O Diagnóstico do Imóvel é a primeira etapa de qualquer plano.'),
 'planos.html': ('Planos de gestão residencial em Niterói | Pitangui Fernandes',
                 'Essencial, Premium e Concierge: três níveis de presença para cuidar da sua casa, com o comparativo completo dos serviços.'),
 'familia.html': ('Uma empresa de família de Niterói | Pitangui Fernandes',
                  'Pitangui é um nome que recebemos de herança. Samuel e a empresa de família que responde pela sua casa, em Niterói.'),
 'compromissos.html': ('Compromissos | Pitangui Fernandes, gestão residencial em Niterói',
                       'Seis compromissos que constam do nosso contrato: sem comissão escondida, aprovação de gastos, repasse ao custo, discrição, rede homologada e histórico.'),
 'contato.html': ('Contato | Pitangui Fernandes, Niterói',
                  'Vamos conversar sobre a sua casa. O primeiro contato é uma conversa sem compromisso com Samuel ou Diana, em Niterói, RJ.'),
 'privacidade.html': ('Política de Privacidade | Pitangui Fernandes',
                      'Como a Pitangui Fernandes trata os dados enviados pelo formulário de contato, conforme a LGPD.'),
 '404.html': ('Página não encontrada | Pitangui Fernandes', 'Esta página não existe. Volte para o início ou fale com a Pitangui Fernandes.'),
}

SITEMAP = ['', 'governanca.html', 'metodo.html', 'planos.html', 'familia.html', 'compromissos.html', 'contato.html']
HOME = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Pitangui Fernandes</title>
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=index.html">
<script>location.replace('index.html'+location.hash)</script>
</head>
<body style="background:#071B36"><a href="index.html" style="color:#fff">Pitangui Fernandes</a></body>
</html>
"""

PREVIA_HOST = 'pitanguifernandes.vercel.app'  # onde a prévia está publicada (redireciona para o SITE depois do lançamento)
PAGINAS_SEM_HTML = ['governanca', 'metodo', 'planos', 'familia', 'compromissos', 'contato', 'privacidade']

def csp(paginas):
    """Content-Security-Policy só com o que o site usa; os scripts inline entram pelo sha256 do conteúdo gerado"""
    sha = lambda t: "'sha256-%s'" % base64.b64encode(hashlib.sha256(t.encode('utf-8')).digest()).decode()
    scripts, eventos = [], []
    for h in paginas:
        for attrs, corpo in re.findall(r'<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)</script>', h):
            if 'application/ld+json' not in attrs and sha(corpo) not in scripts: scripts.append(sha(corpo))
        for ev in re.findall(r'\son[a-z]+="([^"]*)"', h):
            v = H.unescape(ev)
            if sha(v) not in eventos: eventos.append(sha(v))
    script_src = ' '.join(["'self'"] + scripts + (["'unsafe-hashes'"] + eventos if eventos else []))
    return ("default-src 'self'; script-src %s; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; "
            "connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests" % script_src)

def vercel(paginas):
    """configuração da Vercel (gerada: nada de buildCommand, o site é estático)"""
    regras = [{'key': 'Content-Security-Policy', 'value': csp(paginas)},
              {'key': 'X-Content-Type-Options', 'value': 'nosniff'},
              {'key': 'Referrer-Policy', 'value': 'strict-origin-when-cross-origin'},
              {'key': 'Permissions-Policy', 'value': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'},
              {'key': 'X-Frame-Options', 'value': 'DENY'}]
    if PREVIA:
        regras.append({'key': 'X-Robots-Tag', 'value': 'noindex'})
    cfg = {
        # /governanca, /planos... respondem sem o .html (rewrite, sem redirecionar os links .html de dentro do site,
        # que continuam funcionando também com o site aberto direto do computador)
        'trailingSlash': False,
        'rewrites': [{'source': '/:pagina(%s)' % '|'.join(PAGINAS_SEM_HTML), 'destination': '/:pagina.html'}],
        'headers': [{'source': '/(.*)', 'headers': regras}],
    }
    host = re.sub(r'^https?://|/$', '', SITE)
    if not PREVIA and host != PREVIA_HOST:
        # depois do lançamento, o endereço da prévia não fica no ar duplicado: leva cada página para o domínio
        cfg['redirects'] = [{'source': '/:path*', 'has': [{'type': 'host', 'value': PREVIA_HOST}], 'destination': SITE + ':path*', 'permanent': True}]
    return json.dumps(cfg, ensure_ascii=False, indent=2) + '\n'

def publicacao():
    """sitemap, robots, redirecionamento antigo e vercel.json, todos a partir das chaves"""
    out = {
        'sitemap.xml': '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s\n</urlset>\n'
                       % '\n'.join('  <url><loc>%s%s</loc></url>' % (SITE, u) for u in SITEMAP),
        # a prévia não usa Disallow: o buscador precisa ler a página para ver o noindex
        'robots.txt': 'User-agent: *\nAllow: /\n\nSitemap: %ssitemap.xml\n' % SITE,
        'home.html': HOME,
    }
    for f, txt in out.items():
        open(os.path.join(ROOT, f), 'w', encoding='utf-8').write(txt)
    # a CSP é calculada sobre o HTML já gravado: muda um script inline, muda o hash
    paginas = [rd(os.path.join(ROOT, f)) for f in sorted(os.listdir(ROOT)) if f.endswith('.html')]
    open(os.path.join(ROOT, 'vercel.json'), 'w', encoding='utf-8').write(vercel(paginas))

def nova_aba(html):
    """link que abre outra aba avisa o leitor de tela (WCAG, técnica G201): no aria-label, se houver, ou num texto escondido"""
    AVISO = ' (abre em nova aba)'
    def troca(m):
        abre, corpo = m.group(1), m.group(2)
        if AVISO in abre or AVISO in corpo:
            return m.group(0)
        if 'aria-label="' in abre:
            return re.sub(r'aria-label="([^"]*)"', lambda a: 'aria-label="%s%s"' % (a.group(1), AVISO), abre, count=1) + corpo + '</a>'
        return abre + corpo + '<span class="sr">%s</span></a>' % AVISO
    return re.sub(r'(<a\b[^>]*\btarget="_blank"[^>]*>)(.*?)</a>', troca, html, flags=re.S)

def inseparaveis(html):
    """espaço não separável entre "R$" e o valor e entre número e unidade (12 meses, 30 dias, 6 horas), fora dos scripts"""
    partes = re.split(r'(<script[\s\S]*?</script>)', html)
    for i in range(0, len(partes), 2):
        p = re.sub(r'R\$ (?=\d)', 'R$&nbsp;', partes[i])
        partes[i] = re.sub(r'(\d) (meses|mês|dias|dia|horas|hora)\b', r'\1&nbsp;\2', p)
    return ''.join(partes)

def build():
    pages = {
     'index.html': ('\n\n'.join([s01(), s02(), s02b(), s03(), s04(), s05(), s06(), s07(), s08(), s08b(), s09()]), dict(cur='index.html', dark_top=True, ld=True, canon='')),
     'governanca.html': ('\n\n'.join([s03(True), escopo(), nxt('metodo.html', 'Como trabalhamos', 'Começamos entendendo a sua casa.', 'Da conversa à rotina, em quatro passos.')]), dict(cur='governanca.html')),
     'metodo.html': ('\n\n'.join([s04(True), diagnostico(), nxt('planos.html', 'Planos', 'Três formas de cuidar.', 'Essencial, Premium e Concierge.')]), dict(cur='metodo.html')),
     'planos.html': ('\n\n'.join([s05(True), nxt('familia.html', 'O nome', 'Um nome que responde por si.', 'Samuel e a herança de Sebastião Pitangui.')]), dict(cur='planos.html')),
     'familia.html': ('\n\n'.join([s06(True), s07(), nxt('compromissos.html', 'Compromissos', 'As regras, por escrito.', 'Seis compromissos que constam do nosso contrato.')]), dict(cur='familia.html', dark_top=True)),
     'compromissos.html': ('\n\n'.join([s08(True), nxt('contato.html', 'Conversar', 'Vamos conversar sobre a sua casa.', 'Uma conversa sem compromisso, com Samuel ou Diana.')]), dict(cur='compromissos.html')),
     'contato.html': (s09(True), dict(cur='contato.html', dark_top=True)),
     'privacidade.html': ('\n\n'.join([phero('Informações', 'Política de Privacidade', 'Como tratamos os dados enviados pelo formulário de contato, conforme a Lei Geral de Proteção de Dados.'),
                                        priv()]), dict(dark_top=True, intro=False, robots='noindex')),
     '404.html': (phero('Página não encontrada', 'Este endereço não existe.', 'O link pode estar incompleto ou a página mudou de lugar.',
                        '\n    <div class="hero-foot" data-h style="--d:.32s"><a class="tlink" href="index.html">Voltar para o início %s</a><a class="tlink" href="contato.html">Conversar sobre a sua casa %s</a></div>' % (ARR, ARR)).replace('class="phero dark ent"', 'class="phero phero-404 dark ent"'),
                  dict(dark_top=True, intro=False, robots='noindex')),
    }
    for fname, (main, kw) in pages.items():
        t, d = TITLES[fname]
        html = page(fname, t, d, main, **kw)
        html = nova_aba(inseparaveis(html.replace(' </a>', '</a>').replace('__ABATIMENTO__', ABATIMENTO).replace('__ART__', ART).replace('__ATENDIMENTO__', ATENDIMENTO)))
        # títulos com revelação por máscara: o recorte vai num span interno (o observador não vê elementos recortados)
        html = re.sub(r'(<h[123][^>]*data-r="rv"[^>]*>)(.*?)(</h[123]>)', r'\1<span class="rvi">\2</span>\3', html, flags=re.S)
        if fname == '404.html':  # a 404 aparece em qualquer profundidade (/a/b/x): caminhos a partir da raiz
            html = re.sub(r'\b(href|src)="(?!https?:|mailto:|tel:|#|/|data:)([^"]+)"', r'\1="/\2"', html)
        assert '%s' not in html and '%d' not in html, fname
        open(os.path.join(ROOT, fname), 'w', encoding='utf-8').write(html)
    publicacao()
    # CSS: o logotipo entra uma única vez, numa variável
    wm = rd(os.path.join(B, 'wordmark.b64')).strip()
    copia_fontes()
    css = rd(os.path.join(B, 'site.src.css')).replace('__WM__', wm).replace('/*__FONTES__*/', fontes_css())
    open(os.path.join(ROOT, 'assets/css/site.css'), 'w', encoding='utf-8').write(css)
    print('ok')

if __name__ == '__main__':
    build()
