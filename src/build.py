#!/usr/bin/env python3
"""Monta as páginas estáticas do site.
Segue o roteiro do documento "Direção de Arte e Roteiro do Site": a home tem as nove
seções na ordem do arco narrativo; cada página interna aprofunda a sua seção."""
import os, re, json, html as H

B = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(B)  # o site gerado fica na raiz do repositório
SITE = 'https://pitanguifernandes.com.br/'

def rd(p): return open(p, encoding='utf-8').read()

SPRITE = rd(os.path.join(B, 'sprite.html')).rstrip()
WAPATH = rd(os.path.join(B, 'wa-path.txt')).strip()
WA = 'https://wa.me/5521967072931?text=Ol%C3%A1%2C%20gostaria%20de%20conversar%20sobre%20a%20gest%C3%A3o%20da%20minha%20casa.'
TEL = '(21) 96707-2931'
MAIL = 'contato@pitanguifernandes.com.br'
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

def title(page, cls, hid, text, attrs='data-r="rv"'):
    """título da seção: h2 na home, h1 quando a seção abre a página"""
    if page:
        return '<h1 class="%s h1p" id="%s" %s>%s</h1>' % (cls, hid, attrs, text)
    return '<h2 class="%s" id="%s" %s>%s</h2>' % (cls, hid, attrs, text)

# ===================================================================== 01 ABERTURA
def s01():
    return '''<section class="hero dark ent" id="topo" aria-labelledby="h-hero">
  %s
  <div class="wrap hero-in">
    <div class="hero-text">
      <p class="eyebrow" data-h style="--d:0s">Governança residencial · Niterói</p>
      <h1 class="h1" id="h-hero" data-h style="--d:.1s"><span class="l" style="--i:0">Você cuida da sua família.</span> <span class="l" style="--i:1">Nós cuidamos da sua casa.</span></h1>
      <p class="lead" data-h style="--d:.22s">A Pitangui Fernandes é uma empresa de família que assume a gestão técnica da sua residência: inspeção, fornecedores, reparos e obras, com relatórios claros e decisões sempre suas.</p>
      <div class="hero-foot" data-h style="--d:.34s">
        <a class="tlink" href="#como-trabalhamos">Conheça a nossa forma de trabalhar %s</a>
        <span class="seal"><svg viewBox="18 18 423 539" aria-hidden="true"><use href="#mP" fill="currentColor"/><use href="#mF" fill="currentColor" opacity=".55"/></svg>Empresa de família</span>
      </div>
    </div>
  </div>
</section>''' % (HART, ARR)

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
 ('i-obra', 'Supervisionar obras e reparos', 'Do conserto pontual à reforma: escopo, cronograma, fiscalização, medição e entrega, como o olhar técnico do proprietário.', 'obras'),
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
    return '''<section class="sec bg-nevoa gov%s" id="governanca" aria-labelledby="h-gov">
  <div class="wrap">
    <div class="head split">
      <div>
        <p class="eyebrow" data-r>O que fazemos</p>
        %s
      </div>
      <p class="body muted" data-r>Aplicamos à residência o método que as grandes operações usam para cuidar de seus equipamentos e instalações: planejamento, inspeção, contratos, indicadores e registro. Você aprova as decisões e acompanha os resultados. Nós cuidamos da operação.</p>
    </div>
    <div class="pillars" data-stagger="120">%s
    </div>%s%s
  </div>
</section>''' % (' ent page-first' if page else '', title(page, 'h2', 'h-gov', 'Gestão profissional para a casa de quem tem pouco tempo para ela.'), pil, sistemas(page), foot)

# --- sistemas da casa: desenho isométrico com os doze sistemas e o que cada plano acompanha
SIS_ICON = {'eletrica': 's-eletrica', 'hidraulica': 's-hidraulica', 'ar-condicionado': 's-ar', 'bombas': 's-bomba', 'gas': 's-gas',
            'piscina': 's-piscina', 'jardim': 's-jardim', 'automacao': 's-automacao', 'seguranca': 's-seguranca',
            'cobertura': 's-cobertura', 'esquadrias': 's-esquadria', 'areas-externas': 's-externas'}
SIS_SUB = {'todos': 'Em todos os planos', 'premium': 'Premium e Concierge', 'periodica': 'Semestral ou trimestral'}
def sistemas(page=False):
    hs = ''.join('\n          <li style="--x:%s%%;--y:%s%%;--k:%d"><button type="button" data-hs="%s" aria-label="%s"><i></i><span>%s</span></button></li>'
                 % (h['x'], h['y'], i + 1, h['id'], h['label'], h['label']) for i, h in enumerate(HOTS))
    href = '#sis-%s' if page else 'governanca.html#sis-%s'
    hs_tag = 'h2' if page else 'h3'
    li = ''.join('\n          <li data-sys="%s" data-g="%s" data-r><a href="%s"><svg class="ic draw" aria-hidden="true"><use href="#%s"/></svg><span class="sn">%s</span><small>%s</small></a></li>'
                 % (h['id'], h['grupo'], href % h['id'], SIS_ICON[h['id']], h['label'], SIS_SUB[h['grupo']]) for h in HOTS)
    return ('''
    <div class="sis" id="sistemas-da-casa">
      <div class="head split">
        <div>
          <p class="eyebrow" data-r>Sistemas da casa</p>
          <h3 class="h2" id="h-sis" data-r="rv">Cada sistema, acompanhado por quem responde pelo conjunto.</h3>
        </div>
        <p class="body muted" data-r>Com a Pitangui Fernandes, os doze sistemas entram no mesmo calendário, no mesmo histórico e no mesmo relatório. Explore os pontos do desenho ou escolha um plano para ver o que cada um acompanha.</p>
      </div>
      <div class="sis-grid">
        <figure class="house" data-r="house">
          <div class="house-wrap">
            %s
            <ul class="hs" aria-label="Pontos da casa">%s
            </ul>
          </div>
          <figcaption class="cap">Desenho esquemático. Os doze sistemas entram no Diagnóstico do Imóvel.</figcaption>
        </figure>
        <div class="sis-side" data-r>
          <div class="segp" role="group" aria-label="Ver o que cada plano acompanha">
            <button type="button" data-plan="" aria-pressed="true">Todos</button>
            <button type="button" data-plan="essencial" aria-pressed="false">Essencial</button>
            <button type="button" data-plan="premium" aria-pressed="false">Premium</button>
            <button type="button" data-plan="concierge" aria-pressed="false">Concierge</button>
          </div>
          <ol class="sis-list" data-stagger="50">%s
          </ol>
        </div>
      </div>
    </div>''' % (HOUSE, hs, li)).replace('<h3 class="h2" id="h-sis"', '<%s class="h2" id="h-sis"' % hs_tag).replace('conjunto.</h3>', 'conjunto.</%s>' % hs_tag)

# ===================================================================== 04 COMO TRABALHAMOS
STEPS = [
 ('Conversa', 'Conversa inicial', 'Ouvimos como a casa funciona hoje, o que incomoda e o que não pode falhar.'),
 ('Diagnóstico', 'Diagnóstico do Imóvel', 'Vistoria técnica, inventário de equipamentos e mapa de riscos, priorizado em urgente, 90 dias e 12 meses.'),
 ('Plano', 'Plano de gestão', 'Calendário preventivo anual e escolha do plano mais adequado, sem pressa.'),
 ('Rotina', 'Rotina e prestação de contas', 'Visitas, fornecedores, reparos e obras acompanhados, com relatório periódico e a sua aprovação em cada gasto relevante.'),
]
def s04(page=False):
    st = ''.join('''
      <li class="step" data-r>
        <span class="mk" aria-hidden="true"></span>
        <span class="nn">%d</span>
        <h3 class="h3">%s</h3>
        <p>%s</p>
      </li>''' % (i + 1, t, d) for i, (k, t, d) in enumerate(STEPS))
    if page: st = st.replace('<h3 class="h3">', '<h2 class="h3">').replace('</h3>', '</h2>')
    # na página Método a seção seguinte já é o Diagnóstico em detalhe; a nota só faz sentido na home
    note = '' if page else '\n    <div class="steps-note" data-r><p>O Diagnóstico do Imóvel é a primeira etapa de qualquer plano. Investimento de R$ 2.750, abatido na contratação de um plano em até 30 dias.</p><a class="tlink" href="metodo.html#diagnostico">Ver o que o diagnóstico entrega %s</a></div>' % ARR
    return '''<section class="sec bg-white met%s" id="como-trabalhamos" aria-labelledby="h-met">
  <div class="wrap">
    <div class="head">
      <p class="eyebrow" data-r>Do primeiro olhar à rotina</p>
      %s
    </div>
    <ol class="steps" data-stagger="120">
      <li class="track" aria-hidden="true"><span class="fill"></span></li>%s
    </ol>%s
  </div>
</section>''' % (' ent page-first' if page else '', title(page, 'h2', 'h-met', 'Começamos entendendo a sua casa.'), st, note)

# ===================================================================== 05 PLANOS
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
          <div class="tier"><span class="eyebrow tnum">Plano %d</span><span class="lvl" role="img" aria-label="Nível de presença %d de 3">%s</span></div>
          <%s class="pn">%s</%s>
          <p class="sint">%s</p>
        </div>
        <div class="plan-b">
          <p class="perfil">%s</p>
          <ul class="list">%s
          </ul>
          <p class="price"><span class="pl">Mensalidade</span><span class="pv"><small>R$</small><b class="tnum">%s</b><small>/mês</small></span></p>
          <a class="tlink plan-cta" href="%s"%s>Conversar sobre o %s</a>
        </div>
      </article>''' % (n, pid, n, n, ''.join('<i%s style="--n:%d"></i>' % (' class="on"' if k < n else '', k) for k in range(3)), tag, name, tag, sint, perf,
                       ''.join('\n          <li><i class="dia"></i>%s</li>' % it for it in items), price,
                       ('contato.html?plano=%s' % name) if page else '#conversar', '' if page else ' data-plano="%s"' % name, name)
                    for pid, name, sint, perf, n, price, items in PLANS)
    cta = 'contato.html' if page else '#conversar'
    return '''<section class="sec bg-nevoa planos%s" id="planos" aria-labelledby="h-pla">
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
      <p class="note" data-r>A mensalidade remunera a gestão: visitas, fornecedores, acompanhamento e relatórios. Serviços de terceiros, materiais e obras são repassados ao custo, com comprovante, mais a taxa de coordenação ou de supervisão declarada em contrato. O valor do Diagnóstico do Imóvel é abatido na contratação de um plano em até 30 dias. Reajuste anual pelo IPCA; o plano adequado é confirmado após o diagnóstico.</p>
      <a class="tlink" href="%s" data-r>Quer conversar sobre qual plano faz sentido para a sua casa? %s</a>
    </div>
  </div>
</section>''' % (' ent page-first' if page else '', title(page, 'h2', 'h-pla', 'Três formas de cuidar. Uma só maneira de trabalhar.'), cards,
                 ' open' if page else '', 'true' if page else 'false', '' if page else ' inert', matrix(), cta, ARR)

# ===================================================================== 06 O NOME
def s06(page=False):
    return '''<section class="sec dark nome%s" id="o-nome" aria-labelledby="h-nome">
  <div class="wrap grid">
    <figure class="fig" data-r="slow">
      <div class="portrait" aria-hidden="true">%s<span class="pl">Sebastião Pitangui</span></div>
    </figure>
    <div class="txt">
      <p class="eyebrow" data-r>O nome</p>
      %s
      <div class="body" data-r>
        <p>Antes de ser o nome de uma empresa, Pitangui é o nome de um homem: Sebastião Pitangui, pai de Samuel. É dele o nome que a empresa carrega.</p>
        <p>Escolher esse nome foi uma decisão de responsabilidade. Quem entra na casa de alguém precisa de um nome que possa responder por si.</p>
      </div>
      <p class="quote" data-r>Um nome que responde por si.</p>
    </div>
  </div>
</section>''' % (' ent page-first' if page else '', PM, title(page, 'h2', 'h-nome', 'Pitangui é um nome que recebemos de herança.'))

# ===================================================================== 07 SAMUEL E DIANA
CREDS = [('Manutenção e PCM', 'Planejamento e controle da manutenção preventiva e corretiva.'),
         ('Gestão de ativos', 'Inventário, criticidade, vida útil e plano de reposição.'),
         ('Contratos e fornecedores', 'Seleção, cotação, contratação e avaliação de prestadores.'),
         ('Indicadores e operação predial', 'Custos, desempenho e relatórios para decisão.')]
def s07():
    cr = ''.join('\n              <li><span class="ci">%02d</span><div><b>%s</b><span>%s</span></div></li>' % (i + 1, a, b) for i, (a, b) in enumerate(CREDS))
    return '''<section class="sec bg-white pessoas" id="samuel-e-diana" aria-labelledby="h-fam">
  <div class="wrap">
    <div class="head">
      <p class="eyebrow" data-r>Quem está por trás</p>
      <h2 class="h2" id="h-fam" data-r="rv">Duas pessoas, um compromisso.</h2>
    </div>
    <div class="faixa" data-r>
      <strong>Casados, empreendedores e moradores de Icaraí, em Niterói.</strong>
      <p>A Pitangui Fernandes é um negócio de casal, tocado por duas pessoas que vivem na cidade em que atendem e que sabem o que significa deixar a casa nas mãos de alguém.</p>
    </div>
    <div class="duo">
      <article class="person" data-r>
        <div class="portrait light" aria-hidden="true">%s<span class="pl">Manutenção, PCM e gestão de ativos</span></div>
        <div class="ptx">
          <p class="role eyebrow">Fundador</p>
          <h3 class="h3">Samuel</h3>
          <div class="body"><p>Atua em planejamento e controle de manutenção (PCM) e em gestão de ativos. Conhece de perto o que separa uma operação que funciona de uma que apenas reage: contratos bem escritos, fornecedores bem avaliados, indicadores acompanhados e histórico registrado.</p></div>
          <div class="creds">
            <p class="eyebrow">Áreas de atuação</p>
            <ol>%s
            </ol>
          </div>
        </div>
      </article>
      <article class="person" data-r>
        <div class="portrait light" aria-hidden="true">%s<span class="pl">Diana Oliveira</span></div>
        <div class="ptx">
          <p class="role eyebrow">Fundadora</p>
          <h3 class="h3">Diana Oliveira</h3>
          <div class="body"><p>Na Pitangui Fernandes, Diana é quem garante que cada casa seja tratada com a atenção que a nossa própria casa receberia.</p></div>
        </div>
      </article>
    </div>
  </div>
</section>''' % (PM, cr, PM)

# ===================================================================== 08 COMPROMISSOS
COMMITS = [
 ('i-comissao', 'Sem comissão escondida', 'Não recebemos comissão de fornecedores. Nossa remuneração é declarada em contrato.', ''),
 ('i-aprova', 'Você aprova os gastos', 'Nenhum gasto relevante acontece sem a sua aprovação prévia.', ''),
 ('i-recibo', 'Repasse ao custo', 'Serviços de terceiros e materiais são repassados ao custo, com comprovante.', 'repasse'),
 ('i-chave', 'Discrição e acesso protegido', 'Chaves, senhas e a rotina da sua família são tratadas sob protocolo e termo de confidencialidade.', ''),
 ('i-verificado', 'Prestadores verificados', 'Rede homologada, com documentação, referências e seguro conferidos.', ''),
 ('i-historico', 'Tudo registrado', 'Cada serviço, equipamento e custo entra no histórico da casa. O histórico é seu, e vai com você se um dia nos deixar.', ''),
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
    <div class="head split">
      <div>
        <p class="eyebrow" data-r>O que assinamos embaixo</p>
        %s
      </div>
      <p class="body muted" data-r>Respondemos pelo que fazemos. Por isso, estes seis compromissos constam do nosso contrato.</p>
    </div>
    <div class="comps" data-stagger="100">%s
    </div>
  </div>
</section>''' % (' ent page-first' if page else '', title(page, 'h2', 'h-comp', 'Em um serviço de confiança, as regras precisam estar à vista.'), cm)

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
        <li><span class="n">2</span>Samuel ou Diana respondem e marcam uma conversa, por telefone ou na sua casa.</li>
        <li><span class="n">3</span>Se fizer sentido, agendamos o Diagnóstico do Imóvel.</li>
      </ol>
      <div class="direct" %s>
        <a href="https://wa.me/5521967072931" target="_blank" rel="noopener"><span><small>WhatsApp</small><span class="tnum">%s</span></span>%s</a>
        <a href="mailto:%s"><span><small>E-mail</small><span>%s</span></span>%s</a>
        <a href="%s" target="_blank" rel="noopener"><span><small>Instagram</small><span>@pitanguifernandes</span></span>%s</a>
        <p class="area">Atendemos Niterói e região.</p>
      </div>
    </div>
    <form class="form" id="form" novalidate %s>
      <h3 class="form-t">Solicitar uma conversa</h3>
      <p class="sub">Leva menos de um minuto. A mensagem segue pelo WhatsApp, já com os seus dados.</p>
      <div class="fields">
        <div class="two">
          <div class="f" id="f-nome"><label for="nome">Nome</label><input id="nome" name="nome" autocomplete="name" required><span class="msg" aria-live="polite"></span></div>
          <div class="f" id="f-tel"><label for="tel">WhatsApp ou telefone</label><input id="tel" name="tel" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="(21) 90000-0000" required><span class="msg" aria-live="polite"></span></div>
        </div>
        <div class="f" id="f-bairro"><label for="bairro">Bairro</label><input id="bairro" name="bairro" autocomplete="address-level3" placeholder="Ex.: Icaraí, São Francisco, Camboinhas"><span class="msg" aria-live="polite"></span></div>
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
        <p>Abrimos o WhatsApp com a sua mensagem pronta. Para concluir, basta enviá-la por lá. Samuel ou Diana respondem a você.</p>
        <p class="done-alt">O WhatsApp não abriu? <a id="wa-again" href="%s" target="_blank" rel="noopener">Tente abrir de novo</a> ou ligue para <a href="tel:+5521967072931" class="tnum">%s</a>.</p>
        <button class="tlink" type="button" id="again">Enviar outra solicitação</button>
      </div>
    </form>
  </div>
</section>''' % (' ent page-first' if page else '', WM, d, title(page, 'h2', 'h-talk', 'Vamos conversar sobre a sua casa.', d), d, d, d,
                 TEL, NE, MAIL, MAIL, NE, IG, NE, d, WA, TEL)).replace('<h3 class="form-t">', '<%s class="form-t">' % ft).replace('conversa</h3>', 'conversa</%s>' % ft).replace('<h3 class="h3">Falta só enviar.</h3>', '<%s class="h3">Falta só enviar.</%s>' % (ft, ft))

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
        <div>
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
      <p>O diagnóstico entrega o inventário de ativos com fotos e a nota de estado de cada sistema.</p>
      <div class="esc-links">
        <a class="tlink" href="metodo.html#diagnostico">Ver o Diagnóstico do Imóvel %s</a>
        <a class="tlink" href="planos.html#comparativo">Ver o comparativo dos planos %s</a>
      </div>
    </div>
  </div>
</section>''' % (groups, ARR, ARR)

def diagnostico():
    scope = ['Elétrica', 'Hidráulica', 'Ar-condicionado', 'Bombas', 'Gás', 'Cobertura', 'Esquadrias', 'Áreas externas', 'Piscina', 'Jardim', 'Automação', 'Segurança eletrônica']
    rec = ['Inventário de equipamentos, com fotos', 'Nota de estado por sistema', 'Lista de riscos priorizada: urgente, 90 dias e 12 meses',
           'Plano preventivo anual', 'Estimativa de custos de correções e investimentos', 'Recomendação do plano mais adequado']
    return '''<section class="sec bg-nevoa diag" id="diagnostico" aria-labelledby="h-diag">
  <div class="wrap">
    <div class="head split">
      <div>
        <p class="eyebrow" data-r>Primeira etapa</p>
        <h2 class="h2" id="h-diag" data-r="rv">O Diagnóstico do Imóvel é a primeira etapa de qualquer plano.</h2>
      </div>
      <p class="body muted" data-r>Um retrato objetivo da casa e um plano para os próximos 12 meses. É onde o rigor técnico aparece, antes de qualquer contrato.</p>
    </div>
    <dl class="ficha" data-r>
      <div><dt>Investimento</dt><dd class="val"><small>R$</small><b class="tnum">2.750</b></dd><dd class="sub">Abatido na contratação de um plano em até 30 dias, no todo ou em parte, conforme o plano.</dd></div>
      <div><dt>Vistoria</dt><dd class="val">Uma visita</dd><dd class="sub">Cerca de seis horas na casa, com inventário e fotos de cada sistema.</dd></div>
      <div><dt>Relatório</dt><dd class="val">Até 7 dias úteis</dd><dd class="sub">Nota de estado por sistema, riscos priorizados e plano preventivo anual.</dd></div>
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
  </div>
</section>''' % (''.join('\n          <li><i class="dia"></i>%s</li>' % s for s in scope), ''.join('\n          <li><i class="dia"></i>%s</li>' % s for s in rec))

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

PRIV = '''<section class="sec bg-white" aria-label="Política de Privacidade">
  <div class="wrap">
    <div class="prose">
      <h2>O que coletamos</h2>
      <p>Pelo formulário de contato, pedimos apenas o necessário para conversar com você: nome, telefone ou WhatsApp, bairro, tipo de imóvel e, se quiser, uma mensagem. A mensagem é enviada pelo seu próprio WhatsApp, diretamente para o nosso número; o site não guarda cópia dos dados.</p>
      <h2>Para que usamos</h2>
      <p>Usamos esses dados somente para retornar o seu contato e combinar a conversa inicial. Não vendemos nem compartilhamos seus dados e não enviamos publicidade.</p>
      <h2>Por quanto tempo guardamos</h2>
      <p>Guardamos os dados pelo tempo necessário para o atendimento. Se você não se tornar cliente, eles podem ser excluídos a qualquer momento, a seu pedido.</p>
      <h2>Clientes</h2>
      <p>Para quem contrata um plano, chaves, senhas e a rotina da família são tratadas sob protocolo e termo de confidencialidade, previstos em contrato. O histórico da casa pertence ao cliente e é entregue a ele se o contrato terminar.</p>
      <h2>Seus direitos</h2>
      <p>Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você pode pedir acesso, correção ou exclusão dos seus dados. Basta escrever para <a href="mailto:contato@pitanguifernandes.com.br">contato@pitanguifernandes.com.br</a>.</p>
      <h2>Estatísticas de visita</h2>
      <p>Este site não usa cookies de rastreamento nem ferramentas de estatística de visita.</p>
      <p class="note">Pitangui Fernandes | Governança Residencial · Niterói, RJ · © 2026</p>
    </div>
  </div>
</section>'''

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
  ('Inventário de equipamentos', 'Principais ativos', 'Completo, com etiqueta e código QR', 'Completo, com vida útil e plano de reposição'),
  ('Controle de pragas', 'Lembrete', 'Agendamento e conferência', 'Agendamento e conferência'),
  ('Vistoria antes e depois de viagens ou temporais', N, 'Uma por trimestre', 'Sob demanda, em horário comercial')]),
 ('B', 'Gestão de fornecedores', [
  ('#Seleção e contratação',),
  ('Rede de prestadores homologados', y(), y(), y('Prioritária')),
  ('Critérios de homologação (documentos, referências, seguro)', 'Básicos', 'Completos', 'Completos, com reavaliação semestral'),
  ('Cotações comparativas', '2 orçamentos', '3 orçamentos', '3 orçamentos e negociação'),
  ('Análise técnica das propostas (escopo, materiais, prazo)', 'Resumo', 'Comparativo', 'Comparativo e recomendação fundamentada'),
  ('Ordens de serviço e contratos', 'Ordem de serviço', 'OS e contratos recorrentes', 'OS, contratos e renegociação anual'),
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
  ('Histórico de serviços e ativos', 'Planilha', 'Plataforma', 'Plataforma com acesso do proprietário'),
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
    lvl = lambda n: '<span class="lvl" aria-hidden="true">%s</span>' % ''.join('<i%s></i>' % (' class="on"' if i < n else '') for i in range(3))
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
            cells = ''.join('<td role="cell" data-p="%s" class="p%d%s">%s</td>' % (P[k], k + 1, ' inc' if r[k + 1] == YES + 'Incluído' else '', r[k + 1]) for k in range(3))
            o.append('              <tr role="row"><th scope="row" role="rowheader">%s</th>%s</tr>' % (r[0], cells))
        o.append('            </tbody>')
    o.append('          </table>')
    o.append('          </div>')
    return '\n'.join(o)

# ===================================================================== moldura da página
HEAD_JS = ("<script>document.documentElement.classList.add('js');try{var n=performance.getEntriesByType('navigation')[0],"
           "v=+sessionStorage.getItem('pf-nav');sessionStorage.removeItem('pf-nav');if(n&&n.type!=='reload'&&v&&Date.now()-v<15000)"
           "document.documentElement.classList.add('no-intro')}catch(e){}</script>")
LD = '''<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "name": "Pitangui Fernandes",
  "description": "Governança residencial: gestão técnica da residência, com inspeção, gestão de fornecedores, supervisão de reparos e obras e prestação de contas.",
  "url": "https://pitanguifernandes.com.br/",
  "logo": "https://pitanguifernandes.com.br/assets/apple-touch-icon.png",
  "image": "https://pitanguifernandes.com.br/assets/og.jpg",
  "telephone": "+55 21 96707-2931",
  "email": "contato@pitanguifernandes.com.br",
  "areaServed": { "@type": "City", "name": "Niterói" },
  "address": { "@type": "PostalAddress", "addressLocality": "Niterói", "addressRegion": "RJ", "addressCountry": "BR" },
  "sameAs": ["https://www.instagram.com/pitanguifernandes/"]
}
</script>'''
SETT = ('<p class="sett-faixa">Prévia feita pela <a href="https://www.sett.company/" target="_blank" rel="noopener">'
        '<img src="assets/img/sett-branco.png" alt="Sett" width="254" height="96"></a> para <b>Pitangui Fernandes</b> · não oficial</p>')
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
    nav = '\n'.join('      <a href="%s"%s>%s</a>' % (h, ' aria-current="page"' if h == cur else '', t) for h, t in NAV)
    return '''<header class="hdr" id="hdr">
  <div class="wrap">
    <a class="brand" href="index.html" aria-label="Pitangui Fernandes, página inicial">
      <svg viewBox="18 18 423 539" aria-hidden="true"><use href="#mP" class="mono"/><use href="#mF" class="mF"/></svg>
      %s
    </a>
    <nav class="nav" aria-label="Principal">
%s
    </nav>
    <a class="btn" href="%s"%s>Conversar</a>
    <a class="hwa" href="%s" target="_blank" rel="noopener" aria-label="Conversar pelo WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" %s/></svg></a>
    <button class="burger" id="burger" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="mnav"><span class="bt" aria-hidden="true"><b>Menu</b><b>Fechar</b></span><span class="bl" aria-hidden="true"><i></i><i></i></span></button>
  </div>
  <span class="prog" aria-hidden="true"></span>
</header>''' % (LOCK, nav, '#conversar' if home else 'contato.html', ' aria-current="page"' if cur == 'contato.html' else '', WA, WAPATH)

def mnav(cur):
    items = [('index.html', 'Início')] + NAV
    li = '\n'.join('    <li style="--i:%d"><a href="%s"%s><span class="mi">%02d</span><span class="mt">%s</span></a></li>'
                   % (i, h, ' aria-current="page"' if h == cur else '', i + 1, t) for i, (h, t) in enumerate(items))
    return '''<div class="mnav" id="mnav" aria-hidden="true" inert>
  <ol>
%s
  </ol>
  <div class="mfoot">
    <a class="btn" href="contato.html">Conversar sobre a sua casa</a>
    <a class="mwa" href="%s" target="_blank" rel="noopener"><small>WhatsApp</small><span class="tnum">%s</span></a>
    <p>Empresa de família · Niterói, RJ</p>
  </div>
</div>''' % (li, WA, TEL)

def footer():
    navl = '\n'.join('          <li><a href="%s">%s</a></li>' % (h, t) for h, t in [('index.html', 'Início')] + NAV)
    return '''<footer class="foot">
  <div class="wrap">
    <div class="foot-g">
      <div class="b">
        <a class="brand" href="index.html" aria-label="Pitangui Fernandes, página inicial" data-r="logo">
          <svg viewBox="18 18 423 539" aria-hidden="true"><use href="#mP" class="mono"/><use href="#mF" class="mF"/></svg>
          %s
        </a>
        <p>Empresa de família. Niterói, RJ.</p>
      </div>
      <div class="c">
        <p class="fh">Contato</p>
        <ul>
          <li><a href="https://wa.me/5521967072931" target="_blank" rel="noopener" class="tnum">%s</a></li>
          <li><a href="mailto:%s">%s</a></li>
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
</footer>''' % (LOCK, TEL, MAIL, MAIL, IG, navl)

WABTN = '''<div class="wa" id="wa">
  <div class="wa-pop" id="wa-pop" role="dialog" aria-labelledby="wa-t" aria-hidden="true">
    <button class="wa-x" type="button" id="wa-x" aria-label="Fechar mensagem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    <div class="wa-who">
      <span class="wa-av" aria-hidden="true"><svg viewBox="18 18 423 539"><use href="#mP" fill="#fff"/><use href="#mF" fill="#A2A8B4"/></svg></span>
      <span><b>Pitangui Fernandes</b><small>Samuel e Diana · Niterói</small></span>
    </div>
    <p class="wa-t" id="wa-t">Olá. Quer conversar sobre a sua casa?</p>
    <p class="wa-s">Fale com Samuel ou Diana pelo WhatsApp.</p>
    <a class="wa-go" href="%s" target="_blank" rel="noopener">Iniciar conversa</a>
  </div>
  <a class="wa-btn" href="%s" target="_blank" rel="noopener" aria-label="Conversar pelo WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" %s/></svg></a>
</div>''' % (WA, WA, WAPATH)

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,600&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet">')

def page(fname, title_, desc, main, cur=None, dark_top=False, intro=True, robots=None, ld=False, canon=None):
    url = SITE + (canon if canon is not None else fname)
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
<link rel="canonical" href="%s">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Pitangui Fernandes">
<meta property="og:title" content="%s">
<meta property="og:description" content="%s">
<meta property="og:url" content="%s">
<meta property="og:image" content="https://pitanguifernandes.com.br/assets/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Pitangui Fernandes, governança residencial em Niterói">
<meta name="twitter:card" content="summary_large_image">
%s
<link rel="stylesheet" href="assets/css/site.css">
%s%s
</head>''' % (t, dsc, ('<meta name="robots" content="%s">\n' % robots) if robots else '', '#071B36' if dark_top else '#ffffff',
              url, t, dsc, url, FONTS, (LD + '\n') if ld else '', HEAD_JS)
    body = ['<body class="%s">' % ('top-dark' if dark_top else 'top-light'), '<a class="skip" href="#conteudo">Pular para o conteúdo</a>', SETT, '',
            '<!-- ============ SVG: monograma + ícones de linha ============ -->', SPRITE, '']
    if intro: body += [INTRO, '']
    body += [header(cur, home=(fname == 'index.html')), '', mnav(cur), '', '<main id="conteudo">', main.rstrip(), '</main>', '', footer(), '', WABTN, '',
             '<!-- se o script não carregar, o conteúdo escondido para a entrada animada volta a aparecer -->', '<script src="assets/js/site.js" defer onerror="document.documentElement.classList.remove(\'js\')"></script>', '</body>', '</html>', '']
    return head + '\n' + '\n'.join(body)

TITLES = {
 'index.html': ('Pitangui Fernandes | Gestão e governança residencial em Niterói',
                'Gestão profissional da sua casa em Niterói: inspeção, fornecedores, reparos e obras supervisionadas, com relatórios claros. Empresa de família.'),
 'governanca.html': ('Governança Residencial | Pitangui Fernandes',
                     'O que fazemos, em quatro pilares: cuidar da casa, gerir fornecedores, supervisionar obras e reparos e prestar contas. E o escopo da vistoria, sistema a sistema.'),
 'metodo.html': ('Como trabalhamos | Pitangui Fernandes',
                 'Da conversa à rotina, em quatro passos. O Diagnóstico do Imóvel é a primeira etapa de qualquer plano.'),
 'planos.html': ('Planos | Pitangui Fernandes',
                 'Essencial, Premium e Concierge: três níveis de presença para cuidar da sua casa, com o comparativo completo dos serviços.'),
 'familia.html': ('O nome e a família | Pitangui Fernandes',
                  'Pitangui é um nome que recebemos de herança. Samuel e Diana, as pessoas por trás da Pitangui Fernandes.'),
 'compromissos.html': ('Compromissos | Pitangui Fernandes',
                       'Seis compromissos que constam do nosso contrato: sem comissão escondida, aprovação de gastos, repasse ao custo, discrição, prestadores verificados e histórico registrado.'),
 'contato.html': ('Conversar | Pitangui Fernandes',
                  'Vamos conversar sobre a sua casa. O primeiro contato é uma conversa sem compromisso com Samuel ou Diana. Niterói e região.'),
 'privacidade.html': ('Política de Privacidade | Pitangui Fernandes',
                      'Como a Pitangui Fernandes trata os dados enviados pelo formulário de contato, conforme a LGPD.'),
 '404.html': ('Página não encontrada | Pitangui Fernandes', 'Esta página não existe. Volte para o início ou fale com a Pitangui Fernandes.'),
}

def build():
    pages = {
     'index.html': ('\n\n'.join([s01(), s02(), s03(), s04(), s05(), s06(), s07(), s08(), s09()]), dict(dark_top=True, ld=True, canon='')),
     'governanca.html': ('\n\n'.join([s03(True), escopo(), nxt('metodo.html', 'Como trabalhamos', 'Começamos entendendo a sua casa.', 'Da conversa à rotina, em quatro passos.')]), dict(cur='governanca.html')),
     'metodo.html': ('\n\n'.join([s04(True), diagnostico(), nxt('planos.html', 'Planos', 'Três formas de cuidar.', 'Essencial, Premium e Concierge.')]), dict(cur='metodo.html')),
     'planos.html': ('\n\n'.join([s05(True), nxt('familia.html', 'O nome', 'Um nome que responde por si.', 'Samuel, Diana e a herança de Sebastião Pitangui.')]), dict(cur='planos.html')),
     'familia.html': ('\n\n'.join([s06(True), s07(), nxt('compromissos.html', 'Compromissos', 'As regras, por escrito.', 'Seis compromissos que constam do nosso contrato.')]), dict(cur='familia.html', dark_top=True)),
     'compromissos.html': ('\n\n'.join([s08(True), nxt('contato.html', 'Conversar', 'Vamos conversar sobre a sua casa.', 'Uma conversa sem compromisso, com Samuel ou Diana.')]), dict(cur='compromissos.html')),
     'contato.html': (s09(True), dict(cur='contato.html', dark_top=True)),
     'privacidade.html': ('\n\n'.join([phero('Informações', 'Política de Privacidade', 'Como tratamos os dados enviados pelo formulário de contato, conforme a Lei Geral de Proteção de Dados.'), PRIV]), dict(dark_top=True, intro=False, robots='noindex')),
     '404.html': (phero('Página não encontrada', 'Este endereço não existe.', 'O link pode estar incompleto ou a página mudou de lugar.',
                        '\n    <div class="hero-foot" data-h style="--d:.32s"><a class="tlink" href="index.html">Voltar para o início %s</a><a class="tlink" href="contato.html">Conversar sobre a sua casa %s</a></div>' % (ARR, ARR)).replace('class="phero dark ent"', 'class="phero phero-404 dark ent"'),
                  dict(dark_top=True, intro=False, robots='noindex')),
    }
    for fname, (main, kw) in pages.items():
        t, d = TITLES[fname]
        html = page(fname, t, d, main, **kw)
        html = html.replace(' </a>', '</a>')
        # títulos com revelação por máscara: o recorte vai num span interno (o observador não vê elementos recortados)
        html = re.sub(r'(<h[123][^>]*data-r="rv"[^>]*>)(.*?)(</h[123]>)', r'\1<span class="rvi">\2</span>\3', html, flags=re.S)
        assert '%s' not in html and '%d' not in html, fname
        open(os.path.join(ROOT, fname), 'w', encoding='utf-8').write(html)
    # CSS: o logotipo entra uma única vez, numa variável
    wm = rd(os.path.join(B, 'wordmark.b64')).strip()
    css = rd(os.path.join(B, 'site.src.css')).replace('__WM__', wm)
    open(os.path.join(ROOT, 'assets/css/site.css'), 'w', encoding='utf-8').write(css)
    print('ok')

if __name__ == '__main__':
    build()
