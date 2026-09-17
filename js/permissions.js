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
  admin:new Set(['dashboard','events','members','cash','notifications','users','projects','tasks','social','contacts']),
  treasurer:new Set(['dashboard','events','members','cash','notifications','projects','tasks','social','contacts']),
  staff:new Set(['dashboard','events','members','cash','notifications','projects','tasks','social','contacts']),
  guest:new Set()
};
export function canAccessView(view){return access[app.currentProfile?.role]?.has(view)===true}

function ensureStyles(){
  if(document.querySelector('link[href^="permissions.css"]'))return;
  const l=document.createElement('link');l.rel='stylesheet';l.href='permissions.css?v=20260917-access5';document.head.appendChild(l);
}
function setHidden(selector,hidden){document.querySelectorAll(selector).forEach(el=>{el.hidden=hidden})}
function syncRoleGuide(){
  const dlg=document.getElementById('roleInfoDlg');if(!dlg)return;
  dlg.querySelectorAll('.role-info-card').forEach(card=>{
    const title=card.querySelector('h4')?.textContent?.trim();const p=card.querySelector('p');if(!p)return;
    if(title==='Tesoriere')p.innerHTML='<strong>Ha tutti i permessi operativi dello Staff, più la gestione completa della Cassa.</strong> Può creare e gestire Eventi e partecipanti, consultare i dati essenziali dei Soci, lavorare su Progetti, Task e Social e gestire completamente Contatti e collaborazioni. Non vede Utenti.';
    if(title==='Staff')p.innerHTML='Può creare e gestire Eventi e partecipanti, consultare i <strong>dati essenziali dei Soci</strong>, vedere la <strong>Cassa in sola lettura</strong>, lavorare su Progetti, Task e Social e <strong>gestire completamente Contatti e collaborazioni</strong>. Non vede Utenti.';
  });
  const note=dlg.querySelector('.role-info-note');if(note)note.innerHTML='<strong>Tesoriere = Staff + Cassa.</strong> Staff e Tesoriere hanno gli stessi permessi operativi su Eventi, Progetti, Task, Social e Contatti; il Tesoriere può inoltre inserire, modificare ed eliminare movimenti di Cassa. La sezione <strong>Utenti</strong> resta esclusivamente Admin.';
}

export function applyRoleUi(){
  ensureStyles();syncRoleGuide();
  const role=app.currentProfile?.role||'guest';
  document.body.dataset.club42Role=role;
  setHidden('.nav-item[data-view="users"]',role!=='admin');
  setHidden('.nav-item[data-view="contacts"]',role==='guest');
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
