(function(){
  window.__pf=1; /* avisa a rede de segurança do <head> que o script chegou */
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
  /* só na primeira página vista na sessão (o script do <head> marca no-intro nas seguintes); dura cerca de 1 s */
  var intro=d.getElementById('intro'), hartOk=null;
  function ready(delay){ html.style.setProperty('--h0',(delay||0)+'s'); body.classList.add('ready');
    /* a entrada do monograma dura cerca de 2 s; só depois ele passa a acompanhar o mouse no PC (POL-002), sem atropelar a chegada */
    setTimeout(function(){ html.classList.add('hart-ok'); if(hartOk) hartOk(); }, reduce ? 0 : 2400); }
  if(reduce || html.classList.contains('no-intro') || !intro){ if(intro) intro.remove(); ready(.05); }
  else{
    void intro.offsetWidth; setTimeout(function(){ intro.classList.add('go'); }, 20);
    setTimeout(function(){ intro.classList.add('out'); ready(.06); }, 600);
    var gone=false; function bye(){ if(!gone){ gone=true; intro.remove(); } }
    intro.querySelector('.ip-b').addEventListener('transitionend',bye);
    setTimeout(bye, 1150);
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
  /* menu horizontal só quando cabe: com texto ampliado ou fonte grande do sistema, vira o cabeçalho do celular */
  var largo=matchMedia('(min-width:64em)');
  function compacta(){
    html.classList.remove('hdr-compacto');
    if(!largo.matches) return;
    var w=hdr.querySelector('.wrap'); if(w.scrollWidth>w.clientWidth+1) html.classList.add('hdr-compacto');
  }
  function measure(){
    compacta();
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

  /* ---------- monograma da abertura que acompanha o mouse (POL-002) ----------
     Três números, levados por uma mola criticamente amortecida (solução exata, sem ultrapassar o alvo): --rx/--ry, a
     inclinação na direção do mouse em qualquer ponto da abertura (até 5° e 6°), e --ex, a vista explodida (0 a 1), que cresce
     com a proximidade do monograma. O laço só roda enquanto algo se move e para sozinho no repouso; nada no toque, com
     movimento reduzido ou antes do fim da entrada. O CSS desenha tudo a partir dos números (.abre enquanto --ex > 0). */
  (function(){
    if(!hart || reduce || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    var mono=hart.querySelector('.hmono'), heroEl=hart.closest('section')||hero;
    var K=['ex','rx','ry'], X={ex:0,rx:0,ry:0}, V={ex:0,rx:0,ry:0}, T={ex:0,rx:0,ry:0}, W=10;
    var px=-1, py=-1, raf=0, last=0, G=null;
    function pyNow(){ return parseFloat(hart.style.getPropertyValue('--py'))||0; }
    /* geometria do monograma em repouso, em coordenadas da página (a vista explodida e a inclinação não a deslocam) */
    function geo(){
      if(X.ex||X.rx||X.ry) return;
      var b=mono.getBoundingClientRect(), hb=heroEl.getBoundingClientRect(), sy=window.scrollY||0;
      G={cx:b.left+b.width/2, cy:b.top+b.height/2+sy, w:b.width||1, top:hb.top+sy, bottom:hb.bottom+sy, py:pyNow()};
    }
    function alvo(){
      T.ex=T.rx=T.ry=0;
      if(px<0 || !html.classList.contains('hart-ok')) return;
      if(!G) geo(); if(!G) return;
      var sy=window.scrollY||0, top=G.top-sy, bottom=G.bottom-sy;
      if(py<top || py>bottom || bottom<=0) return;
      var cx=G.cx, cy=G.cy-sy+(pyNow()-G.py), dx=px-cx, dy=py-cy;
      var r=Math.sqrt(dx*dx+dy*dy)/G.w, t=Math.max(0,Math.min(1,(1.5-r)/1.2));
      T.ex=t*t*(3-2*t);
      T.ry=Math.max(-1,Math.min(1,dx/(G.w*1.4)))*6;
      T.rx=-Math.max(-1,Math.min(1,dy/(G.w*1.4)))*5;
    }
    function pinta(){
      hart.style.setProperty('--ex',Math.max(0,Math.min(1,X.ex)).toFixed(4));
      hart.style.setProperty('--rx',X.rx.toFixed(3)); hart.style.setProperty('--ry',X.ry.toFixed(3));
    }
    function passo(now){
      var dt=last ? Math.min(.12,(now-last)/1000) : 1/60, e=Math.exp(-W*dt), quieto=true; last=now;
      K.forEach(function(k){
        var x0=X[k]-T[k], v0=V[k], c=v0+W*x0;
        X[k]=T[k]+(x0+c*dt)*e; V[k]=(v0-W*c*dt)*e;
        if(Math.abs(X[k]-T[k])>.001 || Math.abs(V[k])>.01) quieto=false;
      });
      if(quieto){ K.forEach(function(k){ X[k]=T[k]; V[k]=0; }); }
      hart.classList.toggle('abre', X.ex>0);
      if(quieto && !X.ex && !X.rx && !X.ry){ K.forEach(function(k){ hart.style.removeProperty('--'+k); }); }
      else pinta();
      if(quieto){ raf=0; last=0; hart.classList.remove('mov'); return; }
      raf=requestAnimationFrame(passo);
    }
    function liga(){
      alvo();
      if(raf) return;
      if(T.ex===X.ex && T.rx===X.rx && T.ry===X.ry) return;
      hart.classList.add('mov'); raf=requestAnimationFrame(passo);
    }
    d.addEventListener('pointermove',function(e){ if(e.pointerType && e.pointerType!=='mouse') return; px=e.clientX; py=e.clientY; liga(); },{passive:true});
    d.addEventListener('mouseout',function(e){ if(!e.relatedTarget){ px=py=-1; liga(); } });
    window.addEventListener('scroll',function(){ if(px>=0) liga(); },{passive:true});
    window.addEventListener('resize',function(){ G=null; });
    hartOk=function(){ G=null; if(px>=0) liga(); };
  })();

  /* ---------- Perguntas que ouvimos: a resposta abre medida (POL-012) ----------
     O details continua nativo (teclado, leitor de tela, sem JavaScript); aqui só se anima a altura da resposta, medida na
     hora, para abrir e fechar sem salto. O desenho (cota, texto, + que vira −) é do CSS. Com movimento reduzido, nada muda. */
  if(!reduce && 'animate' in HTMLElement.prototype){
    d.querySelectorAll('.faq-i').forEach(function(det){
      var sum=det.querySelector('summary'), box=det.querySelector('.faq-a'), anim=null;
      if(!sum || !box) return;
      function solta(){ anim=null; box.style.height=''; box.style.overflow=''; }
      sum.addEventListener('click',function(e){
        e.preventDefault();
        /* altura de onde parte: a atual, se a pergunta estava no meio de uma animação; senão, fechada (0) ou aberta (inteira) */
        var meio=!!anim, fechando=det.classList.contains('fechando'), de=(meio || det.open) ? box.getBoundingClientRect().height : 0;
        if(anim){ anim.cancel(); anim=null; }
        box.style.overflow='hidden';
        if(!det.open || fechando){
          det.classList.remove('fechando'); det.open=true; box.style.height='';
          var ate=box.getBoundingClientRect().height; /* a caixa, não o conteúdo rolável: o texto entra deslocado 6 px e isso não conta */
          anim=box.animate([{height:(fechando ? de : 0)+'px'},{height:ate+'px'}],{duration:560,easing:'cubic-bezier(.22,1,.36,1)'});
          anim.onfinish=solta;
        } else {
          det.classList.add('fechando');
          /* fechar responde na hora: curva de saída rápida (a de entrada e saída lenta parecia travar no primeiro instante) */
          anim=box.animate([{height:de+'px'},{height:'0px'}],{duration:360,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
          anim.onfinish=function(){ det.open=false; det.classList.remove('fechando'); anim.cancel(); solta(); };
        }
      });
    });
  }

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
    /* com o menu aberto, o que fica por trás dele não recebe foco nem é lido */
    d.querySelectorAll('main, .foot, .wa, .sett-faixa, .skip').forEach(function(el){ if(open) el.setAttribute('inert',''); else el.removeAttribute('inert'); });
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
  window.addEventListener('resize',function(){ if(largo.matches && !html.classList.contains('hdr-compacto') && body.classList.contains('menu-open')) setMenu(false); });

  /* ---------- página inicial: o link do capítulo em vista fica sublinhado ---------- */
  var spy=(function(){
    var map={'sistemas-da-casa':'governanca.html','governanca':'governanca.html','como-trabalhamos':'metodo.html','planos':'planos.html','o-nome':'familia.html','quem-esta-por-tras':'familia.html','compromissos':'compromissos.html','conversar':''};
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
    /* textos do aviso e da lista vêm do build (data-planos): uma fonte só para o que cada plano acompanha */
    var DADOS={}; try{ DADOS=JSON.parse(sis.getAttribute('data-planos')||'{}'); }catch(e){}
    var SUB=DADOS.sub||{}, NOTA=DADOS.nota||{};
    var picked=null, held=false, canHover=matchMedia('(hover:hover)').matches;
    /* aviso dinâmico (MEL-002): frase + três linhas; em "Todos", o quadro dos três planos (a mesma marcação do build).
       POL-001: o aviso nunca some e a caixa tem sempre a altura da maior versão, medida numa sonda invisível ao carregar e a
       cada mudança de largura: trocar de plano não mexe em nada na seção; a troca é um esmaecer curto */
    var nota=d.getElementById('plan-nota'), notaAtual='todos', notaT0=0;
    function el(tag,cls,txt){ var e=d.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
    function montaNota(alvo,k){
      var n=NOTA[k]; if(!n) return;
      while(alvo.firstChild) alvo.removeChild(alvo.firstChild);
      var pt=el('p','pn-t'), txt=n[0], m=/^(Em todos os planos|Premium e Concierge|No Essencial)/.exec(txt);
      if(m){ pt.appendChild(el('b',null,m[1])); pt.appendChild(d.createTextNode(txt.slice(m[1].length))); } else pt.textContent=txt;
      alvo.appendChild(pt);
      if(k==='todos'){
        var tab=el('table','pn-tab'), th=el('thead'), tb=el('tbody'), tr=el('tr');
        tr.appendChild(el('td')); ['Essencial','Premium','Concierge'].forEach(function(x){ var h=el('th',null,x); h.setAttribute('scope','col'); tr.appendChild(h); });
        th.appendChild(tr); tab.appendChild(th);
        n[1].forEach(function(r){ var tr=el('tr'), h=el('th',null,r[0]); h.setAttribute('scope','row'); tr.appendChild(h); r.slice(1).forEach(function(v){ tr.appendChild(el('td',null,v)); }); tb.appendChild(tr); });
        tab.appendChild(tb); alvo.appendChild(tab); return;
      }
      var dl=el('dl','pn-dl'+((k==='premium'||k==='concierge')?' plan-diff':''));
      n[1].forEach(function(r){
        var div=el('div'), dd=el('dd'), wrap=el('span'); div.appendChild(el('dt',null,r[0]));
        wrap.appendChild(el('span','on',r[1])); if(r[2]) wrap.appendChild(el('small',null,r[2]));
        dd.appendChild(wrap); div.appendChild(dd); dl.appendChild(div);
      });
      alvo.appendChild(dl);
    }
    var caixa=nota && nota.parentNode, largCaixa=-1;
    function medeNota(){
      if(!nota) return;
      var w=nota.getBoundingClientRect().width; if(!w || w===largCaixa) return; largCaixa=w;
      var sonda=nota.cloneNode(false), max=0;
      ['id','role','aria-live'].forEach(function(a){ sonda.removeAttribute(a); });
      sonda.setAttribute('aria-hidden','true'); sonda.classList.remove('troca');
      sonda.style.cssText='position:absolute;left:0;top:0;visibility:hidden;width:'+w+'px';
      caixa.appendChild(sonda);
      Object.keys(NOTA).forEach(function(k){ montaNota(sonda,k); max=Math.max(max,sonda.getBoundingClientRect().height); });
      caixa.removeChild(sonda);
      caixa.style.minHeight=Math.ceil(max)+'px';
    }
    if(nota){
      medeNota();
      if(d.fonts && d.fonts.ready) d.fonts.ready.then(function(){ largCaixa=-1; medeNota(); });
      if('ResizeObserver' in window) new ResizeObserver(function(){ medeNota(); }).observe(caixa);
    }
    function pintaNota(k){ montaNota(nota,k); }
    function mostraNota(p){
      if(!nota) return;
      var k=p||'todos'; if(k===notaAtual) return; notaAtual=k;
      if(reduce){ pintaNota(k); return; }
      nota.classList.add('troca'); clearTimeout(notaT0);
      notaT0=setTimeout(function(){ pintaNota(notaAtual); nota.classList.remove('troca'); },180);
    }
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
        var sm=items[k].querySelector('small'); if(sm && SUB[p]) sm.textContent=SUB[p][g];
        /* etiqueta do ponto: a frequência do plano nos sistemas de inspeção periódica (e "fora do calendário" no Essencial) */
        var b=hots[k] && hots[k].querySelector('button'); if(b && SUB[p]){ var suf=p && (g==='periodica' || off) ? ' · '+SUB[p][g] : ''; b.querySelector('span').textContent=b.getAttribute('aria-label')+suf; }
      });
      mostraNota(p);
    }
    sis.querySelectorAll('.segp button').forEach(function(b){ b.addEventListener('click',function(){ plan(b.getAttribute('data-plan')); }); });
    Object.keys(items).forEach(function(k){
      var li=items[k], a=li.querySelector('a,button');
      if(canHover){
        li.addEventListener('mouseenter',function(){ if(!held) pick(k); });
        li.addEventListener('mouseleave',function(){ if(picked===k && !held) pick(null); });
      }
      a.addEventListener('focus',function(){ pick(k); });
      a.addEventListener('blur',function(){ if(picked===k && !held) pick(null); });
      /* na home o item é um botão (MEL-013): o toque aponta o sistema no desenho e segura até outro toque; nada de navegar */
      if(a.tagName==='BUTTON') a.addEventListener('click',function(){
        pick(picked===k && held ? null : k, true);
        if(!picked) return;
        var r=house.getBoundingClientRect(); if(r.bottom<0 || r.top>innerHeight) house.scrollIntoView({behavior:reduce?'auto':'smooth',block:'nearest'});
      });
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

  /* ---------- WhatsApp: some quando a seção Conversar (lá já há o formulário) ou o comparativo estão na tela ---------- */
  (function(){
    var wa=d.querySelector('.wa'); if(!wa || !('IntersectionObserver' in window)) return;
    var vis=[]; var els=[].slice.call(d.querySelectorAll('#conversar, .mx-wrap')); if(!els.length) return;
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){ vis[els.indexOf(e.target)]=e.isIntersecting && e.intersectionRect.height>0; });
      wa.classList.toggle('hide', vis.some(Boolean));
    },{rootMargin:'0px 0px -30% 0px',threshold:0});
    els.forEach(function(el){ io.observe(el); });
  })();

  /* ---------- "Conversar sobre o Essencial" na home: desce até o formulário já com o plano na mensagem ---------- */
  d.querySelectorAll('.plan-cta[data-plano]').forEach(function(a){
    a.addEventListener('click',function(){ var m=d.getElementById('msg'); if(m && !m.value) m.value='Tenho interesse no plano '+a.getAttribute('data-plano')+'.'; });
  });

  /* ---------- WhatsApp: balão de boas-vindas após 4 s ou ao começar a rolar; fechado, não volta na sessão ---------- */
  (function(){
    var box=d.getElementById('wa'), pop=d.getElementById('wa-pop'), x=d.getElementById('wa-x');
    if(!pop) return;
    var KEY='pf-wa-x', shown=false, closed=false, timer;
    try{ if(sessionStorage.getItem(KEY)) closed=true; }catch(e){}
    if(d.getElementById('form') && !d.getElementById('planos')) closed=true; /* na página de contato o formulário já está à vista */
    function show(){
      if(shown || closed) return;
      if(body.classList.contains('menu-open')){ timer=setTimeout(show,2000); return; }
      shown=true; clearTimeout(timer); window.removeEventListener('scroll',onS);
      pop.classList.add('show'); pop.setAttribute('aria-hidden','false'); box.classList.add('on');
    }
    function onS(){ if((window.scrollY||0)>120){ clearTimeout(timer); timer=setTimeout(show,600); } }
    function close(){ closed=true; pop.classList.remove('show'); pop.setAttribute('aria-hidden','true'); try{ sessionStorage.setItem(KEY,'1'); }catch(e){} }
    x.addEventListener('click',close);
    pop.querySelector('.wa-go').addEventListener('click',close);
    d.addEventListener('keydown',function(e){ if(e.key==='Escape' && pop.classList.contains('show')) close(); });
    if(!closed){ timer=setTimeout(show,4000); window.addEventListener('scroll',onS,{passive:true}); }
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
      var v=tel.value.replace(/\D/g,'');
      if(/^55\d{10,11}$/.test(v)) v=v.slice(2);       /* +55 na frente */
      else if(/^0\d{10,11}$/.test(v)) v=v.slice(1);   /* 0 de longa distância */
      v=v.slice(0,11); var o=v;
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
      if(t.length<10 || +t.slice(0,2)<11){setErr('f-tel','Confira o número, com DDD.');ok=false;first=first||tel;}
      if(!ok){first.focus();return;}
      var tipo=(form.querySelector('input[name=tipo]:checked')||{}).value||'';
      var txt='Olá, aqui é '+nome+'. Gostaria de conversar sobre a gestão da minha casa.\n\nTipo de imóvel: '+tipo+(form.bairro.value.trim()?'\nBairro: '+form.bairro.value.trim():'')+'\nTelefone: '+tel.value+(form.msg.value.trim()?'\n\n'+form.msg.value.trim():'');
      var url='https://wa.me/'+form.getAttribute('data-wa')+'?text='+encodeURIComponent(txt);
      if(again) again.href=url;
      window.open(url,'_blank','noopener');
      form.classList.add('sent'); done.classList.add('show');
      if(form.getBoundingClientRect().top<0) form.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
      d.getElementById('again').focus();
    });
    d.getElementById('again').addEventListener('click',function(){ form.reset(); form.classList.remove('sent'); done.classList.remove('show'); form.nome.focus(); });
  })();
})();
