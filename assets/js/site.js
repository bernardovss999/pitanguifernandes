(function(){
  var d=document, html=d.documentElement, body=d.body;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var darkTop=body.classList.contains('top-dark');

  /* ---------- sequências: frases, passos e compromissos entram um a um ---------- */
  d.querySelectorAll('[data-stagger]').forEach(function(g){
    var step=parseInt(g.getAttribute('data-stagger')||'120',10);
    g.querySelectorAll(':scope > [data-r]').forEach(function(k,i){ k.style.setProperty('--d',(i*step/1000)+'s'); });
  });

  /* ---------- entrada do conteúdo ao rolar: fade + 12 px ---------- */
  var targets=d.querySelectorAll('[data-r]');
  if('IntersectionObserver' in window && !reduce){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    },{rootMargin:'0px 0px -8% 0px',threshold:.08});
    targets.forEach(function(t){ io.observe(t); });
  } else { targets.forEach(function(t){ t.classList.add('in'); }); }

  /* ---------- abertura animada + entrada da página ---------- */
  /* toca ao chegar no site e a cada recarregamento; entre páginas do próprio site, não */
  window.addEventListener('pagehide',function(){ try{sessionStorage.setItem('pf-nav',Date.now())}catch(e){} });
  var intro=d.getElementById('intro');
  function ready(delay){ html.style.setProperty('--h0',(delay||0)+'s'); body.classList.add('ready'); }
  if(reduce || html.classList.contains('no-intro') || !intro){ if(intro) intro.remove(); ready(.05); }
  else{
    void intro.offsetWidth; setTimeout(function(){ intro.classList.add('go'); }, 20);
    setTimeout(function(){ intro.classList.add('out'); ready(.06); }, 1500);
    setTimeout(function(){ intro.remove(); }, 2400);
  }

  /* ---------- cabeçalho: transparente na abertura, branco com linha fina depois de rolar ---------- */
  var hdr=d.getElementById('hdr'), hero=d.querySelector('.ent'), prog=hdr.querySelector('.prog'), faixa=d.querySelector('.sett-faixa');
  var themeMeta=d.querySelector('meta[name="theme-color"]'), theme='';
  var steps=[].map.call(d.querySelectorAll('.steps'),function(s){ return {el:s, items:s.querySelectorAll('.step'), fill:s.querySelector('.fill'), tops:[]}; });
  var ticking=false, M={};
  function setTheme(c){ if(themeMeta && c!==theme){ theme=c; themeMeta.setAttribute('content',c); } }
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
      var y=window.scrollY||0, vh=M.vh;
      var solid=darkTop ? y > Math.max(40, M.heroEnd - 90) : y > 8;
      var rects=steps.map(function(s){ return s.el.getBoundingClientRect(); });
      hdr.classList.toggle('solid', solid);
      hdr.classList.toggle('glass', darkTop && !solid && y > 8);
      setTheme(solid || !darkTop ? '#ffffff' : '#071B36');
      if(prog) prog.style.transform='scaleX('+(M.max>0?Math.min(1,y/M.max):0)+')';
      /* linha do tempo: o passo atual na rolagem ganha o numeral em marinho */
      steps.forEach(function(s,k){
        var r=rects[k]; if(r.bottom<-vh || r.top>vh*2) return;
        var p=M.wide ? (vh*.8 - r.top)/(vh*.45) : (vh*.8 - r.top)/r.height;
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

  /* ---------- menu do celular ---------- */
  var burger=d.getElementById('burger'), mnav=d.getElementById('mnav'), lockY=0;
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
    if(open){
      var light=hdr.classList.contains('solid') || !darkTop;
      mnav.classList.toggle('light',light); body.classList.toggle('menu-light',light);
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
    setTheme(open ? (body.classList.contains('menu-light')?'#ffffff':'#071B36') : (hdr.classList.contains('solid') || !darkTop ?'#ffffff':'#071B36'));
  }
  burger.addEventListener('click',function(){ setMenu(!body.classList.contains('menu-open')); });
  mnav.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click',function(e){
      if(a.getAttribute('aria-current')==='page'){ e.preventDefault(); }
      setMenu(false);
    });
  });
  d.addEventListener('keydown',function(e){ if(e.key==='Escape' && body.classList.contains('menu-open')){ setMenu(false); burger.focus(); } });
  /* ao voltar pelo botão "voltar" (cache do navegador), a página não pode reaparecer com o menu aberto */
  window.addEventListener('pageshow',function(e){ if(e.persisted && body.classList.contains('menu-open')) setMenu(false); });
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

  /* ---------- formulário: validação gentil; o pedido segue pelo WhatsApp ---------- */
  if(d.getElementById('form')) (function(){
    var form=d.getElementById('form'), tel=d.getElementById('tel'), done=d.getElementById('done'), again=d.getElementById('wa-again');
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
      done.classList.add('show');
      d.getElementById('again').focus();
    });
    d.getElementById('again').addEventListener('click',function(){ form.reset(); done.classList.remove('show'); form.nome.focus(); });
  })();
})();
