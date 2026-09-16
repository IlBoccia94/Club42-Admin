import {showView} from './router.js';

function openParticipants(){
  showView('events').then(()=>{
    setTimeout(()=>{
      document.querySelector('#view-events .panel')?.scrollIntoView({behavior:'smooth',block:'start'});
    },80);
  });
}

export function initDashboardNav(){
  if(!document.querySelector('link[href="ui-fixes.css"]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='ui-fixes.css';
    document.head.appendChild(link);
  }

  const cards=[...document.querySelectorAll('#view-dashboard .metric-card')];
  const actions=[
    ()=>showView('events'),
    openParticipants,
    ()=>showView('cash'),
    ()=>showView('members')
  ];
  const labels=['Apri Eventi','Apri Iscritti','Apri Pagamenti','Apri Soci'];

  cards.forEach((card,index)=>{
    const action=actions[index];
    if(!action)return;
    card.classList.add('dashboard-link');
    card.setAttribute('role','button');
    card.setAttribute('tabindex','0');
    card.setAttribute('aria-label',labels[index]);
    card.onclick=action;
    card.onkeydown=event=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();
        action();
      }
    };
  });
}
