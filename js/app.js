import {$,app,download,list} from './core.js';
import {initRouter,configureRouter,restoreRoute,showView,parseRoute} from './router.js';
import {initAuth,bootstrapAuth} from './auth.js';
import {initPwa} from './pwa.js?v=20260917-1';
import {initEvents,loadRemote,render,applyEventRoute} from './events.js';
import {initUsers,loadUsers} from './users.js?v=20260917-roles2';
import {buildDashboardUi} from './dashboard-ui.js?v=20260917-2';
import {initDashboard,loadDashboard} from './dashboard.js?v=20260917-2';
import {buildNotificationsUi} from './notifications-ui.js?v=20260917-1';
import {initNotifications,loadNotifications} from './notifications.js?v=20260917-2';
import {buildSocialUi} from './social-ui.js';
import {initSocial,loadSocial} from './social.js';
import {initSocialExtras} from './social-extras.js';
import {initSocialFormats} from './social-formats.js';
import {buildMembersUi} from './members-ui.js';
import {initMembers} from './members.js';
import {loadMembersForRole} from './member-access.js';
import {buildCashUi} from './cash-ui.js';
import {initCash,loadCash} from './cash.js';
import {buildProjectsUi} from './projects-ui.js';
import {initProjects,loadProjects} from './projects.js';
import {buildTasksUi} from './tasks-ui.js';
import {initTasks,loadTasks} from './tasks.js';
import {buildContactsUi} from './contacts-ui.js';
import {initContacts,loadContacts} from './contacts.js';

async function onAuthorized(){
  await loadRemote();
  const route=parseRoute();
  await restoreRoute();
  if(route.authCallback&&location.hash.includes('type=invite'))setTimeout(()=>{if(!$('passwordDlg').open)$('passwordDlg').showModal()},200);
}

function initShell(){
  $('mobileMenu').onclick=()=>document.body.classList.toggle('sidebar-open');
  $('overlay').onclick=()=>document.body.classList.remove('sidebar-open');
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  $('backupBtn').onclick=()=>download(`club42-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(app.state,null,2),'application/json');
  $('exportCsv').onclick=()=>{const e=app.state.events.find(x=>x.id===app.state.selected);if(!e)return;const rows=[['Nome','Telefono','Email','Stato','Socio','Pagamento','Esigenze alimentari','Note'],...list(e.id).map(p=>[p.name,p.phone,p.email,p.status,p.member,p.paid,p.diet,p.notes])];const csv=rows.map(r=>r.map(v=>'"'+String(v||'').replaceAll('"','""')+'"').join(';')).join('\n');download(`iscritti-${e.name.toLowerCase().replace(/[^a-z0-9]+/gi,'-')}.csv`,csv,'text/csv;charset=utf-8')};
}

initPwa();
buildDashboardUi();
buildNotificationsUi();
buildSocialUi();
buildMembersUi();
buildCashUi();
buildProjectsUi();
buildTasksUi();
buildContactsUi();
initSocialExtras();
configureRouter({onDashboard:loadDashboard,onUsers:loadUsers,onEvent:applyEventRoute,onSocial:loadSocial,onMembers:loadMembersForRole,onCash:loadCash,onNotifications:loadNotifications,onProjects:loadProjects,onTasks:loadTasks,onContacts:loadContacts});
initRouter();
initShell();
initEvents();
initUsers();
initDashboard();
initNotifications();
initSocial();
initSocialFormats();
initMembers();
initCash();
initProjects();
initTasks();
initContacts();
initAuth(onAuthorized);
render();
bootstrapAuth(onAuthorized);

window.club42={showView,restoreRoute};
