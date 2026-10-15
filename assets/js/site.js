(function(){
  var d=document, html=d.documentElement, body=d.body;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- split words (mask reveal) ---------- */
  function splitEl(el){
    var i=0;
    (function walk(node){
      Array.prototype.slice.call(node.childNodes).forEach(function(n){
        if(n.nodeType===3){
          var parts=n.textContent.split(/(\s+)/), frag=d.createDocumentFragment();
          parts.forEach(function(p){
            if(!p) return;
            if(/^\s+$/.test(p)){frag.appendChild(d.createTextNode(' '));return;}
            var w=d.createElement('span');w.className='w';
            var s=d.createElement('span');s.textContent=p;s.style.setProperty('--i',i++);
            w.appendChild(s);frag.appendChild(w);
          });
          node.replaceChild(frag,n);
        } else if(n.nodeType===1 && !n.matches('.n, .hint, svg')){ walk(n); }
      });
    })(el);
  }
  d.querySelectorAll('.split').forEach(splitEl);

  /* ---------- stagger groups ---------- */
  d.querySelectorAll('[data-stagger]').forEach(function(g){
    var step=parseInt(g.getAttribute('data-stagger')||'110',10);
    var kids=g.querySelectorAll(':scope > [data-r]');
    kids.forEach(function(k,i){k.style.setProperty('--d',(i*step/1000)+'s');});
  });

  /* ---------- reveal on scroll ---------- */
  var targets=d.querySelectorAll('[data-r], main .split:not(.ent .split), [data-img], .fecho');
  if('IntersectionObserver' in window && !reduce){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); (e.target._rv||[]).forEach(function(x){x.classList.add('in')}); io.unobserve(e.target);} });
    },{rootMargin:'0px 0px -9% 0px',threshold:.12});
    targets.forEach(function(t){
      if(t.closest('.ent')) return;
      /* elementos recortados (clip-path) não são vistos pelo observador: observa o pai */
      if(t.hasAttribute('data-img')){ var w=t.parentNode; w._rv=(w._rv||[]).concat(t); io.observe(w); }
      else io.observe(t);
    });
  } else { targets.forEach(function(t){t.classList.add('in');}); }

  /* ---------- intro + hero entrance ---------- */
  var intro=d.getElementById('intro');
  function ready(delay){ html.style.setProperty('--h0',(delay||0)+'s'); body.classList.add('ready'); d.querySelectorAll('.ent .split, .ent [data-img]').forEach(function(s){s.classList.add('in')}); }
  if(reduce || html.classList.contains('no-intro') || !intro){ if(intro) intro.remove(); ready(.05); }
  else{
    void intro.offsetWidth; setTimeout(function(){ intro.classList.add('go'); }, 20);
    setTimeout(function(){ intro.classList.add('out'); ready(.06); }, 600);
    setTimeout(function(){ intro.remove(); }, 1150);
    try{sessionStorage.setItem('pf-intro','1')}catch(e){}
  }

  /* ---------- header state ---------- */
  var hdr=d.getElementById('hdr'), hero=d.querySelector('.ent');
  var steps=d.getElementById('steps'), stepEls=steps?steps.querySelectorAll('.step'):[], fill=steps?steps.querySelector('.fill'):null;
  var ticking=false;
  function onScroll(){
    if(ticking) return; ticking=true;
    requestAnimationFrame(function(){
      ticking=false;
      var y=window.scrollY||0;
      hdr.classList.toggle('solid', !hero || y > Math.max(40, hero.offsetHeight - 90));
      if(steps){
        var r=steps.getBoundingClientRect(), vh=window.innerHeight;
        var wide=window.innerWidth>=1024;
        var start=vh*.82, p;
        if(wide){ p=(start - r.top)/(vh*.45); }
        else { p=(start - r.top)/(r.height); }
        p=Math.max(0,Math.min(1,p));
        fill.style.transform=wide?'scaleX('+p+')':'scaleY('+p+')';
        stepEls.forEach(function(s,i){ s.classList.toggle('on', p >= (wide? i/3.2 : (s.offsetTop+8)/r.height) && p>0.001); });
      }
    });
  }
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',onScroll);
  onScroll();

  /* ---------- WhatsApp: balão ao rolar ou após 3 s parado no topo ---------- */
  (function(){
    var pop=d.getElementById('wa-pop'), x=d.getElementById('wa-x'); if(!pop) return;
    var KEY='pf-wa', done=false, timer=null;
    try{ if(sessionStorage.getItem(KEY)) done=true; }catch(e){}
    if(d.getElementById('form')) done=true; /* na página de contato o WhatsApp já está à vista */
    function show(){
      if(done) return; done=true;
      try{sessionStorage.setItem(KEY,'1')}catch(e){}
      pop.classList.add('show'); pop.setAttribute('aria-hidden','false');
      window.removeEventListener('scroll',onS);
    }
    function hide(){ pop.classList.remove('show'); pop.setAttribute('aria-hidden','true'); }
    function arm(){ clearTimeout(timer); if((window.scrollY||0)<60) timer=setTimeout(show,3000); }
    function onS(){
      if((window.scrollY||0) > window.innerHeight*.5){ clearTimeout(timer); setTimeout(show,500); }
      else arm();
    }
    x.addEventListener('click',hide);
    pop.querySelector('.wa-go').addEventListener('click',hide);
    d.addEventListener('keydown',function(e){ if(e.key==='Escape') hide(); });
    if(!done){ window.addEventListener('scroll',onS,{passive:true}); setTimeout(arm, html.classList.contains('no-intro')?300:1400); }
  })();

  /* ---------- mobile menu ---------- */
  var burger=d.getElementById('burger'), mnav=d.getElementById('mnav');
  function setMenu(open){
    body.classList.toggle('menu-open',open);
    burger.setAttribute('aria-expanded',open);
    burger.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');
    mnav.setAttribute('aria-hidden',!open);
    body.style.overflow=open?'hidden':'';
  }
  burger.addEventListener('click',function(){ setMenu(!body.classList.contains('menu-open')); });
  mnav.querySelectorAll('a').forEach(function(a){ a.addEventListener('click',function(){ setMenu(false); }); });
  d.addEventListener('keydown',function(e){ if(e.key==='Escape' && body.classList.contains('menu-open')){ setMenu(false); burger.focus(); } });

  /* ---------- comparativo (matriz sem valores e sem taxas) ---------- */
  if(d.getElementById('matrix')) (function(){
  var Y='<i class="yes" aria-hidden="true"></i><span class="sr">Incluído</span>', N='<i class="no" aria-hidden="true"></i><span class="sr">Não incluído</span>';
  var M=[
    ['A','Inspeção e manutenção preventiva',[
      ['Plano de manutenção preventiva anual',Y+'Incluído',Y+'Incluído',Y+'Com orçamento anual de investimentos'],
      ['Checklist: elétrica, hidráulica, ar-condicionado, bombas e gás',Y+'Incluído',Y+'Incluído',Y+'Incluído'],
      ['Piscina, jardim, automação e segurança eletrônica',N,Y+'Incluído',Y+'Incluído'],
      ['Cobertura, caixa d’água, esquadrias e áreas externas',N,'Semestral','Trimestral'],
      ['Teste de equipamentos críticos','Trimestral','Mensal','Em toda visita'],
      ['Inventário de equipamentos','Principais ativos','Completo, com etiqueta/QR','Completo, com vida útil e plano de reposição'],
      ['Controle de pragas','Lembrete','Agendamento e conferência','Agendamento e conferência'],
      ['Vistoria pré e pós viagem ou temporal',N,'Uma por trimestre','Sob demanda, em horário comercial']
    ]],
    ['B','Gestão de fornecedores',[
      ['#Seleção e contratação'],
      ['Rede de prestadores homologados',Y+'Incluído',Y+'Incluído',Y+'Prioritária'],
      ['Critérios de homologação (documentos, referências, seguro)','Básicos','Completos','Completos, com reavaliação semestral'],
      ['Cotações comparativas','2 orçamentos','3 orçamentos','3 orçamentos e negociação'],
      ['Análise técnica das propostas (escopo, materiais, prazo)','Resumo','Comparativo','Comparativo e recomendação fundamentada'],
      ['Ordens de serviço e contratos','Ordem de serviço','OS e contratos recorrentes','OS, contratos e renegociação anual'],
      ['#Acompanhamento e controle'],
      ['Acompanhamento da execução','Remoto, com fotos','Presencial nos serviços relevantes','Presencial e conferência final'],
      ['Conferência de qualidade e aceite','Checklist básico',Y+'Incluído',Y+'Com termo de aceite'],
      ['Controle de garantias','Registro','Registro e alertas de prazo','Registro, alertas e acionamento'],
      ['Documentação dos prestadores (seguro, ASO, NRs)',N,'Básica','Completa'],
      ['Avaliação de desempenho (prazo, qualidade, retrabalho)',N,'Semestral','Trimestral']
    ]],
    ['C','Supervisão de obras e reparos',[
      ['#Reparos corretivos'],
      ['Diagnóstico da causa e definição de escopo',Y+'Incluído',Y+'Incluído',Y+'Incluído'],
      ['Acionamento e coordenação do prestador',Y+'Incluído',Y+'Incluído',Y+'Incluído'],
      ['Acompanhamento da execução','Remoto, com fotos e relato','Presencial nos casos relevantes','Presencial'],
      ['Conferência de entrega e registro no histórico',Y+'Incluído',Y+'Incluído',Y+'Incluído'],
      ['Análise de causa raiz em falhas recorrentes',N,Y+'Incluído',Y+'Incluído'],
      ['#Obras e reformas'],
      ['Levantamento de escopo e memorial descritivo','Simples',Y+'Incluído',Y+'Incluído'],
      ['Compatibilização com arquiteto e projetistas',N,Y+'Incluído',Y+'Incluído'],
      ['Cotação e comparativo de propostas','3 propostas','3 propostas e análise','3 propostas, análise e negociação'],
      ['Cronograma e plano de obra','Marcos principais','Cronograma detalhado','Detalhado, com controle semanal'],
      ['Visitas de supervisão','Início, meio e fim','Quinzenais','Semanais'],
      ['Registro fotográfico e relatório da obra','Fotos nos marcos','Relatório quinzenal','Diário de obra semanal'],
      ['Controle de medições e pagamentos conforme avanço',N,Y+'Incluído',Y+'Incluído'],
      ['Gestão de mudanças de escopo (aditivos)',Y+'Incluído',Y+'Incluído',Y+'Incluído'],
      ['Vistoria final e lista de pendências',Y+'Incluído',Y+'Incluído',Y+'Com acompanhamento pós-obra de 90 dias'],
      ['Entrega de documentação (notas, manuais, garantias, as built)','Arquivo básico',Y+'Incluído',Y+'Completa']
    ]],
    ['D','Governança e relatórios',[
      ['Relatório mensal','Resumido','Completo','Completo, com comentário do gestor'],
      ['Histórico de serviços e ativos','Planilha','Plataforma','Plataforma com acesso do proprietário'],
      ['Controle de custos',N,'Por categoria','Por categoria, com orçamento anual e previsão'],
      ['Indicadores','Chamados abertos e fechados','Preventiva × corretiva e custo por sistema','Também disponibilidade de sistemas críticos'],
      ['Painel de obras e contratos',N,Y+'Incluído',Y+'Incluído'],
      ['Reunião com o proprietário',N,'Semestral','Trimestral']
    ]],
    ['E','Atendimento',[
      ['Canal','WhatsApp comercial','WhatsApp prioritário','Canal dedicado'],
      ['Abertura e acompanhamento de chamados',Y+'Incluído',Y+'Incluído',Y+'Incluído'],
      ['Prioridade no acionamento da rede',N,Y+'Incluído',Y+'Prioritária'],
      ['Protocolo de emergência da casa (registros, quadros, gás, contatos)',Y+'Incluído',Y+'Incluído',Y+'Incluído'],
      ['Guarda de chaves e acessos',N,'Cadastro de acessos','Guarda segura e protocolo']
    ]]
  ];
  var P=['Essencial','Premium','Concierge'];
  var h='<div class="mx-head" aria-hidden="true"><span>Serviço</span><span>Essencial</span><span>Premium</span><span>Concierge</span></div>';
  M.forEach(function(g){
    h+='<div class="mx-group" role="table" aria-label="'+g[1]+'"><h4><b>'+g[0]+'</b>'+g[1]+'</h4>';
    g[2].forEach(function(r){
      if(r.length===1){ h+='<p class="mx-sub">'+r[0].slice(1)+'</p>'; return; }
      h+='<div class="mx-row" role="row"><span class="s" role="rowheader">'+r[0]+'</span>';
      for(var k=1;k<4;k++) h+='<span class="c" role="cell" data-p="'+P[k-1]+'"><span class="sr">'+P[k-1]+': </span>'+r[k]+'</span>';
      h+='</div>';
    });
    h+='</div>';
  });
  var mx=d.getElementById('matrix'); mx.innerHTML=h;
  var acc=d.getElementById('comparativo'), accBtn=d.getElementById('acc-btn');
  accBtn.addEventListener('click',function(){
    var open=!acc.classList.contains('open');
    acc.classList.toggle('open',open); accBtn.setAttribute('aria-expanded',open);
    if(open) mx.removeAttribute('inert'); else mx.setAttribute('inert','');
    if(!open){ var t=acc.getBoundingClientRect().top; if(t<0) window.scrollBy({top:t-100,behavior:reduce?'auto':'smooth'}); }
  });
  if(location.hash==='#comparativo') accBtn.click();

  })();

  /* ---------- form ---------- */
  if(d.getElementById('form')) (function(){
  var form=d.getElementById('form'), tel=d.getElementById('tel'), done=d.getElementById('done');
  tel.addEventListener('input',function(){
    var v=tel.value.replace(/\D/g,'').slice(0,11), o=v;
    if(v.length>2) o='('+v.slice(0,2)+') '+v.slice(2);
    if(v.length>6) o='('+v.slice(0,2)+') '+v.slice(2, v.length>10?7:6)+'-'+v.slice(v.length>10?7:6);
    tel.value=o; clearErr('f-tel');
  });
  d.getElementById('nome').addEventListener('input',function(){clearErr('f-nome')});
  function setErr(id,m){var f=d.getElementById(id);f.classList.add('err');f.querySelector('.msg').textContent=m;f.querySelector('input').setAttribute('aria-invalid','true');}
  function clearErr(id){var f=d.getElementById(id);f.classList.remove('err');f.querySelector('.msg').textContent='';f.querySelector('input').removeAttribute('aria-invalid');}
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var nome=form.nome.value.trim(), t=tel.value.replace(/\D/g,''), ok=true, first=null;
    if(nome.length<2){setErr('f-nome','Como podemos chamar você?');ok=false;first=first||form.nome;}
    if(t.length<10){setErr('f-tel','Confira o número, com DDD.');ok=false;first=first||tel;}
    if(!ok){first.focus();return;}
    var tipo=(form.querySelector('input[name=tipo]:checked')||{}).value||'';
    var txt='Olá, aqui é '+nome+'. Gostaria de conversar sobre a gestão da minha casa.\n\nTipo de imóvel: '+tipo+(form.bairro.value.trim()?'\nBairro: '+form.bairro.value.trim():'')+'\nTelefone: '+tel.value+(form.msg.value.trim()?'\n\n'+form.msg.value.trim():'');
    window.open('https://wa.me/5521967072931?text='+encodeURIComponent(txt),'_blank','noopener');
    done.classList.add('show'); done.querySelector('.ic').classList.add('in');
    done.querySelector('#again').focus();
  });
  d.getElementById('again').addEventListener('click',function(){ form.reset(); done.classList.remove('show'); form.nome.focus(); });
  })();
})();
