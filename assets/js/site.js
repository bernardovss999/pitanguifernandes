(function(){
  var d=document, html=d.documentElement, body=d.body;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var darkTop=body.classList.contains('top-dark');

  /* ---------- sequências: frases, passos e compromissos entram um a um ---------- */
  d.querySelectorAll('[data-stagger]').forEach(function(g){
    var step=parseInt(g.getAttribute('data-stagger')||'120',10);
    var from=parseFloat(g.getAttribute('data-stagger-from')||'0');
    g.querySelectorAll(':scope > [data-r]').forEach(function(k,i){ k.style.setProperty('--d',(from+i*step/1000)+'s'); });
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
    setTimeout(function(){ intro.classList.add('out'); ready(.06); }, 2350);
    var gone=false; function bye(){ if(!gone){ gone=true; intro.remove(); } }
    intro.querySelector('.ip-b').addEventListener('transitionend',bye);
    setTimeout(bye, 3500);
  }

  /* ---------- cabeçalho: transparente na abertura; ao rolar, toma o tom da seção que passa por baixo ---------- */
  var hdr=d.getElementById('hdr'), hero=d.querySelector('.ent'), prog=hdr.querySelector('.prog'), faixa=d.querySelector('.sett-faixa'), hart=d.querySelector('.hart'), wa=d.querySelector('.wa');
  var themeMeta=d.querySelector('meta[name="theme-color"]'), theme='';
  var TONE={white:'#ffffff',nevoa:'#F3F5F8',dark:'#071B36'};
  function pageY(el){ var t=0; while(el){ t+=el.offsetTop; el=el.offsetParent; } return t; }
  function toneOf(el){ var c=el.classList; return (c.contains('dark')||c.contains('foot')) ? 'dark' : c.contains('bg-nevoa') ? 'nevoa' : 'white'; }
  function themeNow(){ return hdr.classList.contains('solid') ? TONE[hdr.getAttribute('data-tone')||'white'] : (darkTop ? TONE.dark : TONE.white); }
  function headerLight(){ return hdr.classList.contains('solid') ? hdr.getAttribute('data-tone')!=='dark' : !darkTop; }
  var steps=[].map.call(d.querySelectorAll('.steps'),function(s){ return {el:s, items:s.querySelectorAll('.step'), fill:s.querySelector('.fill'), tops:[]}; });
  var ticking=false, M={};
  function setTheme(c){ if(themeMeta && c!==theme){ theme=c; themeMeta.setAttribute('content',c); } }
  function measure(){
    html.style.setProperty('--fh',(faixa?faixa.offsetHeight:0)+'px');
    M.vh=window.innerHeight; M.wide=window.innerWidth>=1024;
    M.heroEnd=hero?hero.offsetTop+hero.offsetHeight:0;
    M.max=html.scrollHeight-M.vh; M.hh=hdr.offsetHeight;
    M.tones=[].map.call(d.querySelectorAll('main > section, main > .next, .foot'),function(el){ return {top:pageY(el), h:el.offsetHeight, tone:toneOf(el)}; });
    steps.forEach(function(s){ s.tops=[].map.call(s.items,function(it){ return it.offsetTop+8; }); });
  }
  function onScroll(){
    if(ticking || body.classList.contains('menu-open')) return; ticking=true;
    requestAnimationFrame(function(){
      ticking=false;
      var y=window.scrollY||0, vh=M.vh;
      var solid=y > 8, line=y+M.hh-1, tone='white';
      for(var t=0;t<M.tones.length;t++){ var T=M.tones[t]; if(T.top<=line && line<T.top+T.h){ tone=T.tone; break; } }
      var rects=steps.map(function(s){ return s.el.getBoundingClientRect(); });
      if(spy) spy(y,vh);
      hdr.classList.toggle('solid', solid);
      if(hdr.getAttribute('data-tone')!==tone) hdr.setAttribute('data-tone',tone);
      setTheme(themeNow());
      /* o balão do WhatsApp só entra depois da primeira tela */
      if(wa) wa.classList.toggle('wait', y < vh*.5);
      if(prog) prog.style.transform='scaleX('+(M.max>0?Math.min(1,y/M.max):0)+')';
      /* a arte da abertura desce um pouco mais devagar que o texto */
      if(hart && !reduce && y < M.heroEnd) hart.style.setProperty('--py',(y*.06).toFixed(1)+'px');
      /* linha do tempo: o passo atual na rolagem ganha o numeral em marinho */
      steps.forEach(function(s,k){
        var r=rects[k]; if(r.bottom<-vh || r.top>vh*2) return;
        var p=M.wide ? (vh*.8 - r.top)/(vh*.45) : (vh*.8 - r.top)/r.height;
        p=Math.max(0,Math.min(1,p));
        if(s.fill) s.fill.style.transform=M.wide?'scaleX('+p+')':'scaleY('+p+')';
        var last=-1;
        for(var i=0;i<s.items.length;i++){ var on=p>0.001 && p >= (M.wide ? i/3.2 : s.tops[i]/r.height); s.items[i].classList.toggle('on', on); if(on) last=i; }
        /* o passo atual leva o losango em pitanga */
        for(var j=0;j<s.items.length;j++) s.items[j].classList.toggle('cur', j===last);
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
      var light=headerLight();
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
    setTheme(open ? (body.classList.contains('menu-light')?'#ffffff':'#071B36') : themeNow());
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

  /* ---------- página inicial: o link do capítulo em vista fica sublinhado ---------- */
  var spy=(function(){
    var map={'governanca':'governanca.html','como-trabalhamos':'metodo.html','planos':'planos.html','o-nome':'familia.html','samuel-e-diana':'familia.html','compromissos':'compromissos.html','conversar':''};
    var links={}; hdr.querySelectorAll('.nav a').forEach(function(a){ links[a.getAttribute('href')]=a; });
    var secs=Object.keys(map).map(function(id){ return d.getElementById(id); }).filter(Boolean);
    if(secs.length<3) return null;
    var cur=null;
    return function(y,vh){
      var id=null, line=y+vh*.4;
      for(var i=0;i<secs.length;i++){ if(secs[i].offsetTop<=line) id=secs[i].id; }
      var last=secs[secs.length-1]; if(id && last.offsetTop+last.offsetHeight<=y) id=null;
      var href=id?map[id]:null; if(href===cur) return; cur=href;
      Object.keys(links).forEach(function(h){ links[h].classList.toggle('on', h===href); });
    };
  })();

  /* ---------- sistemas da casa: desenho, pontos, lista e filtro por plano ---------- */
  (function(){
    var sis=d.querySelector('.sis'); if(!sis) return;
    var house=sis.querySelector('.house'), groups={}, hots={}, items={};
    house.querySelectorAll('[data-sys]').forEach(function(g){ var k=g.getAttribute('data-sys'); (groups[k]=groups[k]||[]).push(g); });
    sis.querySelectorAll('.hs li').forEach(function(li){ hots[li.querySelector('button').getAttribute('data-hs')]=li; });
    sis.querySelectorAll('.sis-list li').forEach(function(li){ items[li.getAttribute('data-sys')]=li; });
    var SUB={'':{todos:'Em todos os planos',premium:'Premium e Concierge',periodica:'Semestral ou trimestral'},
             essencial:{todos:'Incluído',premium:'Não incluído',periodica:'Não incluído'},
             premium:{todos:'Incluído',premium:'Incluído',periodica:'Semestral'},
             concierge:{todos:'Incluído',premium:'Incluído',periodica:'Trimestral'}};
    var picked=null, held=false, canHover=matchMedia('(hover:hover)').matches;
    function pick(id,keep){
      picked=id; held=!!keep;
      Object.keys(groups).forEach(function(k){
        var on=k===id;
        groups[k].forEach(function(g){ g.classList.toggle('on',on); }); if(hots[k]) hots[k].classList.toggle('on',on); if(items[k]) items[k].classList.toggle('on',on);
      });
      house.classList.toggle('pick',!!id);
    }
    function plan(p){
      sis.querySelectorAll('.segp button').forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-plan')===p); });
      Object.keys(items).forEach(function(k){
        var g=items[k].getAttribute('data-g'), off=(p==='essencial' && g!=='todos');
        items[k].classList.toggle('off',off); (groups[k]||[]).forEach(function(g){ g.classList.toggle('off',off); }); if(hots[k]) hots[k].classList.toggle('off',off);
        var sm=items[k].querySelector('small'); if(sm) sm.textContent=SUB[p][g];
      });
    }
    sis.querySelectorAll('.segp button').forEach(function(b){ b.addEventListener('click',function(){ plan(b.getAttribute('data-plan')); }); });
    Object.keys(items).forEach(function(k){
      var li=items[k], a=li.querySelector('a');
      if(canHover){
        li.addEventListener('mouseenter',function(){ if(!held) pick(k); });
        li.addEventListener('mouseleave',function(){ if(picked===k && !held) pick(null); });
      }
      a.addEventListener('focus',function(){ pick(k); });
      a.addEventListener('blur',function(){ if(picked===k && !held) pick(null); });
    });
    Object.keys(hots).forEach(function(k){
      var b=hots[k].querySelector('button');
      if(canHover){
        b.addEventListener('mouseenter',function(){ if(!held) pick(k); });
        b.addEventListener('mouseleave',function(){ if(picked===k && !held) pick(null); });
      }
      b.addEventListener('focus',function(){ pick(k); });
      b.addEventListener('blur',function(){ if(picked===k && !held) pick(null); });
      b.addEventListener('click',function(){
        /* no toque: o sistema fica apontado até um toque fora do bloco */
        pick(picked===k && held ? null : k, true);
        if(!picked) return;
        var li=items[k]; if(!li) return;
        var row=d.getElementById('sis-'+k);
        if(row && row.closest('.esc')){ row.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'}); return; }
        li.scrollIntoView({behavior:reduce?'auto':'smooth',block:'nearest',inline:'center'});
      });
    });
    /* toque fora dos pontos limpa o destaque */
    d.addEventListener('click',function(e){ if(picked && !e.target.closest('.sis')) pick(null); });
  })();

  /* ---------- WhatsApp: some quando a seção Conversar está na tela (lá já há o formulário) ---------- */
  (function(){
    var wa=d.querySelector('.wa'), conv=d.getElementById('conversar');
    if(!wa || !conv || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function(es){ wa.classList.toggle('hide', es[0].isIntersecting); },{rootMargin:'0px 0px -30% 0px',threshold:0}).observe(conv);
  })();

  /* ---------- comparativo: no celular, um plano por vez ---------- */
  (function(){
    var w=d.querySelector('.mx-wrap'); if(!w) return;
    var bs=w.querySelectorAll('.mx-seg button');
    bs.forEach(function(b){ b.addEventListener('click',function(){
      w.setAttribute('data-show',b.getAttribute('data-show'));
      bs.forEach(function(x){ x.setAttribute('aria-pressed', x===b ? 'true' : 'false'); });
    }); });
    /* chegando com ?plano=Premium, o comparativo já abre nesse plano */
    var q=/[?&]plano=([^&#]+)/.exec(location.search); if(q){ bs.forEach(function(b){ if(b.getAttribute('data-show')===decodeURIComponent(q[1])) b.click(); }); }
  })();

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
    /* na página Planos ele já vem aberto; só abre aqui quando chega fechado pelo link #comparativo */
    if(location.hash==='#comparativo' && !acc.classList.contains('open')) btn.click();
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
