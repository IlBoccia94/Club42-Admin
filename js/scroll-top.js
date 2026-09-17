let activeTarget=null;
let button=null;

const THRESHOLD=280;

function pageScroller(){
  return document.scrollingElement||document.documentElement;
}

function isScrollableElement(el){
  return el instanceof HTMLElement && el.scrollHeight>el.clientHeight+8;
}

function scrollTopOf(target){
  if(!target)return 0;
  if(target===window||target===document||target===pageScroller())return pageScroller().scrollTop||window.scrollY||0;
  return target.scrollTop||0;
}

function targetLabel(target){
  if(target===pageScroller())return 'Torna in cima alla pagina';
  return 'Torna in cima a questa sezione';
}

function updateButton(target=activeTarget){
  if(!button)return;
  const authenticated=!!document.body.dataset.club42Role;
  if(!authenticated){button.classList.remove('show');return}

  const page=pageScroller();
  let chosen=target;
  if(!chosen||!document.contains(chosen)||scrollTopOf(chosen)<=THRESHOLD){
    chosen=scrollTopOf(page)>THRESHOLD?page:null;
  }

  if(!chosen){
    activeTarget=null;
    button.classList.remove('show');
    return;
  }

  activeTarget=chosen;
  const label=targetLabel(chosen);
  button.setAttribute('aria-label',label);
  button.title=label;
  button.classList.add('show');
}

function onElementScroll(event){
  const target=event.target;
  if(!(target instanceof HTMLElement)||!isScrollableElement(target))return;
  if(target===button||button?.contains(target))return;
  activeTarget=target;
  updateButton(target);
}

function onPageScroll(){
  const page=pageScroller();
  if(scrollTopOf(page)>THRESHOLD||!activeTarget||scrollTopOf(activeTarget)<=THRESHOLD)activeTarget=page;
  updateButton(activeTarget);
}

function goTop(){
  const target=activeTarget||pageScroller();
  const behavior=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
  if(target===pageScroller())window.scrollTo({top:0,behavior});
  else target.scrollTo({top:0,behavior});
}

function ensureStyles(){
  if(document.querySelector('link[href^="scroll-top.css"]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='scroll-top.css?v=20260917-1';
  document.head.appendChild(link);
}

export function initScrollTop(){
  if(document.getElementById('club42ScrollTop'))return;
  ensureStyles();
  button=document.createElement('button');
  button.id='club42ScrollTop';
  button.className='club42-scroll-top';
  button.type='button';
  button.setAttribute('aria-label','Torna in cima');
  button.innerHTML='<span aria-hidden="true">↑</span><b>In cima</b>';
  button.addEventListener('click',goTop);
  document.body.appendChild(button);

  window.addEventListener('scroll',onPageScroll,{passive:true});
  document.addEventListener('scroll',onElementScroll,{passive:true,capture:true});
  window.addEventListener('hashchange',()=>requestAnimationFrame(()=>{activeTarget=pageScroller();updateButton(activeTarget)}));
  document.addEventListener('club42:scrolltop-refresh',()=>requestAnimationFrame(()=>updateButton(activeTarget)));
  window.addEventListener('resize',()=>requestAnimationFrame(()=>updateButton(activeTarget)),{passive:true});

  updateButton();
}
