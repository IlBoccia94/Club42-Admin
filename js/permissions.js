import {app} from './core.js';

export const roleLabel=role=>role==='admin'?'Admin':role==='treasurer'?'Tesoriere':role==='staff'?'Staff':role==='guest'?'Guest':role||'—';
export const isAdmin=()=>app.currentProfile?.role==='admin';
export const isTreasurer=()=>app.currentProfile?.role==='treasurer';
export const isStaff=()=>app.currentProfile?.role==='staff';
export const isGuest=()=>app.currentProfile?.role==='guest';
export const canManageCash=()=>isAdmin()||isTreasurer();
export const canManageEvents=()=>isAdmin()||isStaff()||isTreasurer();
export const canUseOperations=()=>['admin','treasurer','staff'].includes(app.currentProfile?.role);

const access={
  admin:new Set(['dashboard','events','members','cash','notifications','users','projects','tasks','social','newsletter','contacts','feedback','guest']),
  treasurer:new Set(['dashboard','events','members','cash','notifications','projects','tasks','social','contacts','feedback','guest']),
  staff:new Set(['dashboard','events','members','cash','notifications','projects','tasks','social','contacts','feedback','guest']),
  guest:new Set(['guest'])
};
export function canAccessView(view){return access[app.currentProfile?.role]?.has(view)===true}

function ensureStyles(){
  if(document.querySelector('link[href^="permissions.css"]'))return;
  const l=document.createElement('link');l.rel='stylesheet';l.href='permissions.css?v=20260917-newsletter1';document.head.appendChild(l);
}
function setHidden(selector,hidden){document.querySelectorAll(selector).forEach(el=>{el.hidden=hidden})}
function syncRoleGuide(){
  const dlg=document.getElementById('roleInfoDlg');if(!dlg)return;
  dlg.querySelectorAll('.role-info-card').forEach(card=>{
    const title=card.querySelector('h4')?.textContent?.trim();const p=card.querySelector('p');if(!p)return;
    if(title==='Admin')p.innerHTML='<strong>Accesso completo.</strong> Gestisce Eventi, Soci, Cassa, Progetti, Task, Social, Contatti, Feedback, Newsletter e Utenti. È l’unico ruolo che può amministrare account, consensi newsletter e invii email.';
    if(title==='Tesoriere')p.innerHTML='<strong>Ha tutti i permessi operativi dello Staff, più la gestione completa della Cassa.</strong> Può creare e gestire Eventi e partecipanti, consultare i dati essenziali dei Soci, lavorare su Progetti, Task e Social, gestire completamente Contatti e collaborazioni e utilizzare Feedback. Può inoltre aprire la Pagina guest in anteprima. Non vede Utenti né Newsletter.';
    if(title==='Staff')p.innerHTML='Può creare e gestire Eventi e partecipanti, consultare i <strong>dati essenziali dei Soci</strong>, vedere la <strong>Cassa in sola lettura</strong>, lavorare su Progetti, Task e Social, <strong>gestire completamente Contatti e collaborazioni</strong> e utilizzare <strong>Feedback</strong> e aprire la Pagina guest in anteprima. Non vede Utenti né Newsletter.';
    if(title==='Guest')p.innerHTML='<strong>Accesso esclusivo all’Area soci.</strong> Vede soltanto la Pagina guest con gli eventi che il direttivo ha scelto di rendere visibili. Non vede menu né moduli gestionali.';
  });
  const note=dlg.querySelector('.role-info-note');if(note)note.innerHTML='<strong>Tesoriere = Staff + Cassa.</strong> La sezione <strong>Newsletter</strong>, insieme alla gestione del consenso dei Guest, è esclusivamente Admin. La <strong>Pagina guest</strong> resta l’unica area accessibile ai Guest.';
}

export function applyRoleUi(){
  ensureStyles();syncRoleGuide();
  const role=app.currentProfile?.role||'guest';
  document.body.dataset.club42Role=role;
  setHidden('.nav-item[data-view="users"]',role!=='admin');
  setHidden('.nav-item[data-view="newsletter"]',role!=='admin');
  setHidden('.nav-item[data-view="contacts"]',role==='guest');
  setHidden('.nav-item[data-view="feedback"]',role==='guest');
  setHidden('.nav-item[data-view="members"]',role==='guest');
  setHidden('.nav-item[data-view="notifications"]',role==='guest');
  setHidden('button[onclick="showView(\'users\')"]',role!=='admin');

  setHidden('#globalNewEvent',true);
  const eventReadonly=!canManageEvents();
  ['#heroNewEvent','#quickEvent','#quickPerson','#sideNewEvent','#addPerson'].forEach(s=>setHidden(s,eventReadonly));

  const cashReadonly=!canManageCash();
  setHidden('#newCashBtn',cashReadonly);

  const badge=document.getElementById('sidebarUserRole');
  if(badge)badge.textContent=roleLabel(role);
}
