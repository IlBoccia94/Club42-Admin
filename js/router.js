import {$,app} from './core.js';
import {canAccessView} from './permissions.js?v=20260918-newsletter-recipients1';

export const viewMeta={
  dashboard:['Dashboard','Panoramica operativa del Club42'],
  events:['Eventi','Iscrizioni, partecipanti e organizzazione'],
  users:['Utenti','Accessi, ruoli e richieste di autorizzazione'],
  members:['Soci','Anagrafica, tessere e quote associative'],
  cash:['Cassa','Entrate, uscite e rendiconto'],
  notifications:['Notifiche','Preferenze push, dispositivi e installazione PWA'],
  projects:['Progetti','Portfolio, priorità e avanzamento'],
  tasks:['Task','Control room operativa, priorità e responsabilità'],
  social:['Social','Calendario editoriale, produzione e risultati'],
  newsletter:['Newsletter','Comunicazioni email agli utenti che hanno espresso il consenso'],
  contacts:['Contatti','Rubrica collaboratori e relazioni'],
  feedback:['Feedback','Bug, fix e richieste per il gestionale'],
  guest:['Pagina guest','Anteprima dell’Area soci Club42']
};

let dashboardHandler=null;
let usersHandler=null;
let eventHandler=null;
let socialHandler=null;
let newsletterHandler=null;
let membersHandler=null;
let cashHandler=null;
let notificationsHandler=null;
let projectsHandler=null;
let tasksHandler=null;
let contactsHandler=null;
let feedbackHandler=null;
let guestHandler=null;

export function configureRouter({onDashboard,onUsers,onEvent,onSocial,onNewsletter,onMembers,onCash,onNotifications,onProjects,onTasks,onContacts,onFeedback,onGuest}={}){
  dashboardHandler=onDashboard||null;
  usersHandler=onUsers||null;
  eventHandler=onEvent||null;
  socialHandler=onSocial||null;
  newsletterHandler=onNewsletter||null;
  membersHandler=onMembers||null;
  cashHandler=onCash||null;
  notificationsHandler=onNotifications||null;
  projectsHandler=onProjects||null;
  tasksHandler=onTasks||null;
  contactsHandler=onContacts||null;
  feedbackHandler=onFeedback||null;
  guestHandler=onGuest||null;
}

function defaultView(){return app.currentProfile?.role==='guest'?'guest':'dashboard'}
function isSupabaseCallbackHash(hash=location.hash){
  const h=hash.toLowerCase();
  return h.includes('access_token=')||h.includes('refresh_token=')||h.includes('error_code=')||h.includes('type=invite')||h.includes('type=recovery')||h.includes('type=signup');
}

export function parseRoute(){
  const raw=location.hash.replace(/^#/,'').trim();
  if(!raw||isSupabaseCallbackHash('#'+raw))return {view:defaultView(),eventId:null,authCallback:isSupabaseCallbackHash('#'+raw)};
  const parts=raw.split('/');
  const view=viewMeta[parts[0]]?parts[0]:defaultView();
  return {view,eventId:parts[1]||null,authCallback:false};
}

async function applyRoute(){
  if(!app.currentProfile?.active)return;
  let route=parseRoute();
  if(!canAccessView(route.view)){
    route={view:defaultView(),eventId:null,authCallback:false};
    history.replaceState(null,'',`#${route.view}`);
  }
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+route.view));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===route.view));
  $('pageTitle').textContent=viewMeta[route.view][0];
  $('pageSubtitle').textContent=viewMeta[route.view][1];
  document.body.classList.remove('sidebar-open');
  if(route.view==='dashboard'&&dashboardHandler)await dashboardHandler();
  if(route.view==='users'&&usersHandler)await usersHandler();
  if(route.view==='events'&&eventHandler)await eventHandler(route.eventId);
  if(route.view==='social'&&socialHandler)await socialHandler();
  if(route.view==='newsletter'&&newsletterHandler)await newsletterHandler();
  if(route.view==='members'&&membersHandler)await membersHandler();
  if(route.view==='cash'&&cashHandler)await cashHandler();
  if(route.view==='notifications'&&notificationsHandler)await notificationsHandler();
  if(route.view==='projects'&&projectsHandler)await projectsHandler();
  if(route.view==='tasks'&&tasksHandler)await tasksHandler();
  if(route.view==='contacts'&&contactsHandler)await contactsHandler();
  if(route.view==='feedback'&&feedbackHandler)await feedbackHandler();
  if(route.view==='guest'&&guestHandler)await guestHandler();
}

export async function showView(name,{replace=false,eventId=null}={}){
  const requested=viewMeta[name]?name:defaultView();
  const view=canAccessView(requested)?requested:defaultView();
  const hash=view==='events'&&eventId?`#events/${eventId}`:`#${view}`;
  if(location.hash===hash)return applyRoute();
  if(replace){history.replaceState(null,'',hash);await applyRoute();}
  else location.hash=hash;
}

export async function restoreRoute(){
  if(!location.hash)history.replaceState(null,'',`#${defaultView()}`);
  await applyRoute();
}

export function initRouter(){
  window.addEventListener('hashchange',applyRoute);
  document.querySelectorAll('.nav-item').forEach(n=>n.onclick=()=>showView(n.dataset.view));
  window.showView=name=>showView(name);
}
