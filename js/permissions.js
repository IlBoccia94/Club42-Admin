import {app} from './core.js';

export const roleLabel=role=>role==='admin'?'Admin':role==='treasurer'?'Tesoriere':role==='staff'?'Staff':role==='guest'?'Guest':role||'—';
export const isAdmin=()=>app.currentProfile?.role==='admin';
export const isTreasurer=()=>app.currentProfile?.role==='treasurer';
export const isStaff=()=>app.currentProfile?.role==='staff';
export const isGuest=()=>app.currentProfile?.role==='guest';
export const canManageCash=()=>isAdmin()||isTreasurer();
export const canManageEvents=()=>isAdmin()||isStaff();
export const canUseOperations=()=>['admin','treasurer','staff'].includes(app.currentProfile?.role);

const access={
  admin:new Set(['dashboard','events','members','cash','users','projects','tasks','social','contacts']),
  treasurer:new Set(['dashboard','events','members','cash','projects','tasks','social']),
  staff:new Set(['dashboard','events','members','cash','projects','tasks','social']),
  guest:new Set()
};
export function canAccessView(view){return access[app.currentProfile?.role]?.has(view)===true}

function ensureStyles(){
  if(document.querySelector('link[href="permissions.css"]'))return;
  const l=document.createElement('link');l.rel='stylesheet';l.href='permissions.css';document.head.appendChild(l);
}
function setHidden(selector,hidden){document.querySelectorAll(selector).forEach(el=>{el.hidden=hidden})}

export function applyRoleUi(){
  ensureStyles();
  const role=app.currentProfile?.role||'guest';
  document.body.dataset.club42Role=role;
  setHidden('.nav-item[data-view="users"]',role!=='admin');
  setHidden('.nav-item[data-view="contacts"]',role!=='admin');
  setHidden('button[onclick="showView(\'users\')"]',role!=='admin');

  setHidden('#globalNewEvent',true);
  const eventReadonly=role==='treasurer';
  ['#heroNewEvent','#quickEvent','#quickPerson','#sideNewEvent','#addPerson'].forEach(s=>setHidden(s,eventReadonly));

  const cashReadonly=role==='staff';
  setHidden('#newCashBtn',cashReadonly);

  const badge=document.getElementById('sidebarUserRole');
  if(badge)badge.textContent=roleLabel(role);
}
