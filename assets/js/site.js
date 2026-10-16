(function(){
  var d=document, html=d.documentElement, body=d.body;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- título principal: divide em palavras para a entrada ---------- */
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
        } else if(n.nodeType===1 && !n.matches('svg')){ walk(n); }
      });
    })(el);
  }
  d.querySelectorAll('.split').forEach(splitEl);

  /* ---------- grupos em sequência ---------- */
  d.querySelectorAll('[data-stagger]').forEach(function(g){
    var step=parseInt(g.getAttribute('data-stagger')||'110',10);
    g.querySelectorAll(':scope > [data-r]').forEach(function(k,i){ k.style.setProperty('--d',(i*step/1000)+'s'); });
  });

  /* ---------- revelação ao rolar ---------- */
  var targets=d.querySelectorAll('[data-r], [data-img], .fecho, .mdraw');
  if('IntersectionObserver' in window && !reduce){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    },{rootMargin:'0px 0px -8% 0px',threshold:.1});
    targets.forEach(function(t){ if(!t.closest('.ent')) io.observe(t); });
  } else { targets.forEach(function(t){ t.classList.add('in'); }); }

  /* ---------- abertura + entrada da página ---------- */
  /* a abertura toca ao chegar no site e a cada recarregamento; entre páginas do próprio site, não */
  window.addEventListener('pagehide',function(){ try{sessionStorage.setItem('pf-nav',Date.now())}catch(e){} });
  var intro=d.getElementById('intro');
  function ready(delay){
    html.style.setProperty('--h0',(delay||0)+'s'); body.classList.add('ready');
    d.querySelectorAll('.ent [data-img], .ent .mdraw').forEach(function(s){ s.classList.add('in'); });
  }
  if(reduce || html.classList.contains('no-intro') || !intro){ if(intro) intro.remove(); ready(.05); }
  else{
    void intro.offsetWidth; setTimeout(function(){ intro.classList.add('go'); }, 20);
    setTimeout(function(){ intro.classList.add('out'); ready(.06); }, 1500);
    setTimeout(function(){ intro.remove(); }, 2400);
  }

  /* ---------- cabeçalho, progresso de leitura e linha do método ---------- */
  var hdr=d.getElementById('hdr'), hero=d.querySelector('.ent'), prog=hdr.querySelector('.prog'), faixa=d.querySelector('.sett-faixa');
  var themeMeta=d.querySelector('meta[name="theme-color"]'), theme='';
  var steps=[].map.call(d.querySelectorAll('.steps'),function(s){ return {el:s, items:s.querySelectorAll('.step'), fill:s.querySelector('.fill'), tops:[]}; });
  var ticking=false, M={};
  function setTheme(c){ if(themeMeta && c!==theme){ theme=c; themeMeta.setAttribute('content',c); } }
  /* medidas de layout ficam em cache e só são refeitas quando a página muda de tamanho */
  function measure(){
    html.style.setProperty('--fh',(faixa?faixa.offsetHeight:0)+'px');
    M.vh=window.innerHeight; M.wide=window.innerWidth>=1024;
    M.heroEnd=hero?hero.offsetTop+hero.offsetHeight:0;
    M.max=html.scrollHeight-M.vh;
    steps.forEach(function(s){ s.tops=[].map.call(s.items,function(it){ return it.offsetTop+8; }); });
  }
  function onScroll(){
    if(ticking || body.classList.contains('menu-open')) return; ticking=true;
    requestAnimationFrame(function(){
      ticking=false;
      /* leituras primeiro, escritas depois */
      var y=window.scrollY||0, vh=M.vh;
      var solid=!hero || y > Math.max(40, M.heroEnd - 90);
      var rects=steps.map(function(s){ return s.el.getBoundingClientRect(); });
      hdr.classList.toggle('solid', solid);
      hdr.classList.toggle('glass', !solid && y > 8);
      setTheme(solid?'#ffffff':'#071B36');
      if(prog) prog.style.transform='scaleX('+(M.max>0?Math.min(1,y/M.max):0)+')';
      steps.forEach(function(s,k){
        var r=rects[k]; if(r.bottom<-vh || r.top>vh*2) return;
        var p=M.wide ? (vh*.82 - r.top)/(vh*.45) : (vh*.82 - r.top)/r.height;
        p=Math.max(0,Math.min(1,p));
        if(s.fill) s.fill.style.transform=M.wide?'scaleX('+p+')':'scaleY('+p+')';
        for(var i=0;i<s.items.length;i++) s.items[i].classList.toggle('on', p>0.001 && p >= (M.wide ? i/3.2 : s.tops[i]/r.height));
      });
    });
  }
  var rT; function onResize(){ clearTimeout(rT); rT=setTimeout(function(){ measure(); onScroll(); },120); }
  measure();
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',onResize);
  window.addEventListener('load',function(){ measure(); onScroll(); });
  if('ResizeObserver' in window) new ResizeObserver(onResize).observe(body);
  onScroll();

  /* ---------- sistemas da casa: faixa contínua, que pausa no mouse e pode ser arrastada ---------- */
  (function(){
    var sl=d.querySelector('.slider'), track=sl&&sl.querySelector('.slider-track');
    if(!track) return;
    var sec=sl.closest('section'), x=0, v=0, half=0, last=0, raf=0, onscreen=false, hover=false, focus=false, drag=null, moved=0;
    var SPEED=reduce?0:.04; /* px por ms */
    function size(){ half=track.scrollWidth/2; }
    function wrap(){ if(half>0){ while(x<=-half) x+=half; while(x>0) x-=half; } }
    function paint(){ track.style.transform='translate3d('+x.toFixed(2)+'px,0,0)'; }
    function frame(t){
      var dt=last?Math.min(48,t-last):16; last=t;
      if(!drag){
        if(Math.abs(v)>.01){ x+=v*dt; v*=Math.pow(.94,dt/16); }
        else if(!hover && !focus) x-=SPEED*dt;
      }
      wrap(); paint();
      raf=onscreen?requestAnimationFrame(frame):0;
    }
    function run(){ if(!raf && onscreen){ last=0; raf=requestAnimationFrame(frame); } }
    size();
    window.addEventListener('resize',size);
    window.addEventListener('load',size);
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(es){ onscreen=es[0].isIntersecting; run(); },{rootMargin:'120px 0px'}).observe(sl);
    } else { onscreen=true; run(); }
    if(matchMedia('(hover:hover)').matches){
      sl.addEventListener('mouseenter',function(){ hover=true; });
      sl.addEventListener('mouseleave',function(){ hover=false; });
    }
    sl.addEventListener('pointerdown',function(e){
      if(e.pointerType==='mouse' && e.button!==0) return;
      drag={x:e.clientX, y:e.clientY, ox:x, lx:e.clientX, lt:e.timeStamp, id:e.pointerId, on:false}; moved=0; v=0;
    });
    sl.addEventListener('pointermove',function(e){
      if(!drag || e.pointerId!==drag.id) return;
      var dx=e.clientX-drag.x, dy=e.clientY-drag.y;
      if(!drag.on){
        if(Math.abs(dx)<6 && Math.abs(dy)<6) return;
        if(Math.abs(dy)>Math.abs(dx)){ drag=null; return; } /* gesto vertical: deixa a página rolar */
        drag.on=true; sl.classList.add('dragging');
        try{ sl.setPointerCapture(e.pointerId); }catch(err){}
      }
      var dt=Math.max(1,e.timeStamp-drag.lt);
      v=(e.clientX-drag.lx)/dt; drag.lx=e.clientX; drag.lt=e.timeStamp;
      moved=Math.abs(dx); x=drag.ox+dx; wrap(); paint();
    });
    function end(){ if(!drag) return; if(!drag.on) v=0; drag=null; sl.classList.remove('dragging'); v=Math.max(-2.5,Math.min(2.5,v)); }
    sl.addEventListener('pointerup',end);
    sl.addEventListener('pointercancel',end);
    sl.addEventListener('lostpointercapture',end);
    /* arrastar não abre o link */
    sl.addEventListener('click',function(e){ if(moved>6){ e.preventDefault(); e.stopPropagation(); } moved=0; },true);
    sl.addEventListener('dragstart',function(e){ e.preventDefault(); });
    /* teclado: o cartão em foco vem para a vista */
    sl.addEventListener('focusin',function(e){
      focus=true; v=0;
      var li=e.target.closest('.sl-li'); if(!li) return;
      x=-(li.offsetLeft - Math.max(16,(sl.clientWidth-li.offsetWidth)/2)); wrap(); paint();
      if(sec) sec.scrollLeft=0; sl.scrollLeft=0;
    });
    sl.addEventListener('focusout',function(){ focus=false; });
  })();

  /* ---------- WhatsApp: o balão aparece depois que a pessoa já leu um pouco; fica até ser fechado ---------- */
  var wa=d.getElementById('wa'), waPop=d.getElementById('wa-pop');
  (function(){
    if(!waPop) return;
    var KEY='pf-wa-x', shown=false, closed=false, timer=null;
    try{ if(sessionStorage.getItem(KEY)) closed=true; }catch(e){}
    if(d.getElementById('form')) closed=true; /* na página de contato o WhatsApp já está à vista */
    function show(){
      if(shown || closed) return;
      if(body.classList.contains('menu-open')){ clearTimeout(timer); timer=setTimeout(show,3000); return; }
      shown=true; clearTimeout(timer);
      waPop.classList.add('show'); waPop.setAttribute('aria-hidden','false'); wa.classList.add('on');
      window.removeEventListener('scroll',onS);
    }
    function hide(){
      closed=true; clearTimeout(timer);
      waPop.classList.remove('show'); waPop.setAttribute('aria-hidden','true');
      try{sessionStorage.setItem(KEY,'1')}catch(e){}
    }
    /* depois de rolar cerca de uma tela e meia, ou de 25 s na página */
    function onS(){ if((window.scrollY||0) > window.innerHeight*1.5){ clearTimeout(timer); timer=setTimeout(show,600); window.removeEventListener('scroll',onS); } }
    d.getElementById('wa-x').addEventListener('click',hide);
    waPop.querySelector('.wa-go').addEventListener('click',hide);
    d.addEventListener('keydown',function(e){ if(e.key==='Escape' && shown && !closed) hide(); });
    if(!closed){
      window.addEventListener('scroll',onS,{passive:true});
      timer=setTimeout(show,25000);
    }
  })();

  /* ---------- menu do celular ---------- */
  var burger=d.getElementById('burger'), mnav=d.getElementById('mnav'), lockY=0, leaveT=null;
  function lockScroll(on){
    /* iOS ignora overflow:hidden no body; fixar o body é o único bloqueio confiável */
    if(on){
      lockY=window.scrollY||0;
      body.style.position='fixed'; body.style.top=(-lockY)+'px'; body.style.left='0'; body.style.right='0'; body.style.width='100%';
    } else {
      body.style.position=''; body.style.top=''; body.style.left=''; body.style.right=''; body.style.width='';
      html.style.scrollBehavior='auto'; window.scrollTo(0,lockY); html.style.scrollBehavior='';
    }
  }
  function setMenu(open){
    if(open===body.classList.contains('menu-open')) return;
    clearTimeout(leaveT);
    if(open){
      var light=hdr.classList.contains('solid');
      mnav.classList.toggle('light',light); body.classList.toggle('menu-light',light);
      mnav.classList.remove('leaving');
      mnav.querySelectorAll('.picked').forEach(function(li){ li.classList.remove('picked'); });
      lockScroll(true);
      body.classList.add('menu-open');
      mnav.scrollTop=0;
    } else {
      body.classList.remove('menu-open');
      lockScroll(false);
      onScroll();
    }
    burger.setAttribute('aria-expanded',open);
    burger.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');
    mnav.setAttribute('aria-hidden',!open);
    if(open) mnav.removeAttribute('inert'); else mnav.setAttribute('inert','');
    setTheme(open ? (body.classList.contains('menu-light')?'#ffffff':'#071B36') : (hdr.classList.contains('solid')?'#ffffff':'#071B36'));
  }
  burger.addEventListener('click',function(){ setMenu(!body.classList.contains('menu-open')); });
  mnav.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click',function(e){
      if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button) return;
      if(a.target==='_blank'){ setMenu(false); return; }
      if(a.getAttribute('aria-current')==='page'){ e.preventDefault(); setMenu(false); return; }
      var li=a.closest('li');
      if(reduce || !li) return;
      /* a opção escolhida avança, as demais recuam; só então a página muda */
      e.preventDefault();
      li.classList.add('picked'); mnav.classList.add('leaving');
      var href=a.href; leaveT=setTimeout(function(){ location.href=href; },380);
    });
  });
  d.addEventListener('keydown',function(e){ if(e.key==='Escape' && body.classList.contains('menu-open')){ setMenu(false); burger.focus(); } });
  /* ao voltar pelo botão "voltar" (cache do navegador), a página não pode reaparecer com o menu aberto */
  window.addEventListener('pageshow',function(e){ if(e.persisted && body.classList.contains('menu-open')) setMenu(false); mnav.classList.remove('leaving'); });
  window.addEventListener('resize',function(){ if(window.innerWidth>=1024 && body.classList.contains('menu-open')) setMenu(false); });

  /* ---------- comparativo dos planos (sanfona) ---------- */
  (function(){
    var acc=d.getElementById('comparativo'), btn=d.getElementById('acc-btn'), mx=d.getElementById('matrix');
    if(!acc || !btn) return;
    btn.addEventListener('click',function(){
      var open=!acc.classList.contains('open');
      acc.classList.toggle('open',open); btn.setAttribute('aria-expanded',open);
      if(open) mx.removeAttribute('inert'); else mx.setAttribute('inert','');
      if(!open){ var t=acc.getBoundingClientRect().top; if(t<0) window.scrollBy({top:t-100,behavior:reduce?'auto':'smooth'}); }
    });
    if(location.hash==='#comparativo') btn.click();
  })();

  /* ---------- formulário: monta a mensagem e abre o WhatsApp ---------- */
  if(d.getElementById('form')) (function(){
    var form=d.getElementById('form'), tel=d.getElementById('tel'), done=d.getElementById('done'), again=d.getElementById('wa-again');
    /* vindo de um plano, a mensagem já começa com ele */
    try{
      var plano=new URLSearchParams(location.search).get('plano');
      if(plano && /^(Essencial|Premium|Concierge)$/.test(plano)) form.msg.value='Tenho interesse no plano '+plano+'.';
    }catch(e){}
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
      var url='https://wa.me/5521967072931?text='+encodeURIComponent(txt);
      if(again) again.href=url;
      window.open(url,'_blank','noopener');
      done.classList.add('show'); done.querySelector('.ic').classList.add('in');
      d.getElementById('again').focus();
    });
    d.getElementById('again').addEventListener('click',function(){ form.reset(); done.classList.remove('show'); form.nome.focus(); });
  })();
})();
