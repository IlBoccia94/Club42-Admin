export function initSocialExtras(){
  if(!document.querySelector('link[href="social-extras.css"]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='social-extras.css';
    document.head.appendChild(link);
  }

  const wrap=document.getElementById('socialPipelineWrap');
  const prev=document.getElementById('socialPipelinePrev');
  const next=document.getElementById('socialPipelineNext');
  if(prev&&wrap)prev.onclick=()=>wrap.scrollBy({left:-520,behavior:'smooth'});
  if(next&&wrap)next.onclick=()=>wrap.scrollBy({left:520,behavior:'smooth'});

  if(wrap){
    wrap.addEventListener('wheel',event=>{
      if(window.innerWidth<=650)return;
      if(Math.abs(event.deltaY)<=Math.abs(event.deltaX))return;
      const max=wrap.scrollWidth-wrap.clientWidth;
      const canMove=(event.deltaY>0&&wrap.scrollLeft<max-1)||(event.deltaY<0&&wrap.scrollLeft>1);
      if(!canMove)return;
      event.preventDefault();
      wrap.scrollLeft+=event.deltaY;
    },{passive:false});
  }
}
