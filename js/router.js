import {$,app} from './core.js';

export const viewMeta={
  dashboard:['Dashboard','Panoramica operativa del Club42'],
  events:['Eventi','Iscrizioni, partecipanti e organizzazione'],
  users:['Utenti','Accessi, ruoli e richieste di autorizzazione'],
  members:['Soci','Anagrafica, tessere e quote associative'],
  cash:['Cassa','Entrate, uscite e rendiconto'],
  projects:['Progetti','Dalle idee alla realizzazione'],
  tasks:['Task','Attività e responsabilità del direttivo'],
  social:['Social','Calendario editoriale, produzione e risultati'],
  contacts:['Contatti','Collaboratori, partner e fornitori']
};

let usersHandler=null;
let eventHandler=null;
let socialHandler=null;
let membersHandler=null;

export function configureRouter({onUsers,onEvent,onSocial,onMembers}={}){
  usersHandler=onUsers||null;
  eventHandler=onEvent||null;
  socialHandler=onSocial||null;
  membersHandler=onMembers||null;
}

function isSupabaseCallbackHash(hash=location.hash){
  const h=hash.toLowerCase();
  return h.includes('access_token=')||h.includes('refresh_token=')||h.includes('error_code=')||h.includes('type=invite')||h.includes('type=recovery')||h.includes('type=signup');
}

export function parseRoute(){
  const raw=location.hash.replace(/^#/,'').trim();
  if(!raw||isSupabaseCallbackHash('#'+raw))return {view:'dashboard',eventId:null,authCallback:isSupabaseCallbackHash('#'+raw)};
  const parts=raw.split('/');
  const view=viewMeta[parts[0]]?parts[0]:'dashboard';
  return {view,eventId:parts[1]||null,authCallback:false};
}

async function applyRoute(){
  if(!app.currentProfile?.active)return;
  const route=parseRoute();
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+route.view));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===route.view));
  $('pageTitle').textContent=viewMeta[route.view][0];
  $('pageSubtitle').textContent=viewMeta[route.view][1];
  document.body.classList.remove('sidebar-open');
  if(route.view==='users'&&usersHandler)await usersHandler();
  if(route.view==='events'&&eventHandler)await eventHandler(route.eventId);
  if(route.view==='social'&&socialHandler)await socialHandler();
  if(route.view==='members'&&membersHandler)await membersHandler();
}

export async function showView(name,{replace=false,eventId=null}={}){
  const view=viewMeta[name]?name:'dashboard';
  const hash=view==='events'&&eventId?`#events/${eventId}`:`#${view}`;
  if(location.hash===hash)return applyRoute();
  if(replace){history.replaceState(null,'',hash);await applyRoute();}
  else location.hash=hash;
}

export async function restoreRoute(){
  if(!location.hash)history.replaceState(null,'','#dashboard');
  await applyRoute();
}

export function initRouter(){
  window.addEventListener('hashchange',applyRoute);
  document.querySelectorAll('.nav-item').forEach(n=>n.onclick=()=>showView(n.dataset.view));
  window.showView=name=>showView(name);
}
