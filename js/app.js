import {$,app,download,list} from './core.js';
import {initRouter,configureRouter,restoreRoute,showView,parseRoute} from './router.js?v=20260918-newsletter-recipients1';
import {initAuth,bootstrapAuth} from './auth.js?v=20260917-signup-newsletter1';
import {applyRoleUi} from './permissions.js?v=20260918-newsletter-recipients1';
import {initPwa} from './pwa.js?v=20260918-freshassets1';
import {initScrollTop} from './scroll-top.js?v=20260917-1';
import {initEvents,loadRemote,render,applyEventRoute} from './events.js?v=20260918-contactpicker2';
import {initUsers,loadUsers} from './users.js?v=20260918-consentfix1';
import {buildDashboardUi} from './dashboard-ui.js?v=20260917-2';
import {initDashboard,loadDashboard} from './dashboard.js?v=20260917-2';
import {buildNotificationsUi} from './notifications-ui.js?v=20260918-push-audit2';
import {initNotifications,loadNotifications} from './notifications.js?v=20260918-taskattention1';
import {buildSocialUi} from './social-ui.js?v=20260918-recurrence1';
import {initSocial,loadSocial} from './social.js?v=20260918-recurrence1';
import {initSocialExtras} from './social-extras.js';
import {initSocialFormats} from './social-formats.js';
import {buildMembersUi} from './members-ui.js?v=20260918-cycle1';
import {initMembers} from './members.js?v=20260918-cycle1';
import {loadMembersForRole} from './member-access.js?v=20260918-cycle1';
import {buildCashUi} from './cash-ui.js?v=20260918-reimburse1';
import {initCash,loadCash} from './cash.js?v=20260918-reimburse1';
import {buildProjectsUi} from './projects-ui.js';
import {initProjects,loadProjects} from './projects.js';
import {buildTasksUi} from './tasks-ui.js?v=20260918-taskattention2';
import {initTasks,loadTasks} from './tasks.js?v=20260918-taskattention2';
import {buildContactsUi} from './contacts-ui.js';
import {initContacts,loadContacts} from './contacts.js?v=20260917-contactsfull1';
import {buildGuestUi} from './guest-ui.js?v=20260918-daterange2';
import {buildFeedbackUi} from './feedback-ui.js?v=20260918-workflow1';
import {initFeedback,loadFeedback} from './feedback.js?v=20260918-workflow1';
import {loadGuestPage} from './guest.js?v=20260918-staffregister1';
import {buildNewsletterUi} from './newsletter-ui.js?v=20260918-recipients1';
import {initNewsletter,loadNewsletter} from './newsletter.js?v=20260918-recipients1';

function ensureSidebarLayout(){
  if(document.querySelector('link[href^="sidebar-layout.css"]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='sidebar-layout.css?v=20260917-1';
  document.head.appendChild(link);
}

function ensureReadabilityStyles(){
  if(document.querySelector('link[href^="readability.css"]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='readability.css?v=20260918-3';
  document.head.appendChild(link);
}

async function onAuthorized(){
  applyRoleUi();
  if(app.currentProfile?.role==='guest'){
    history.replaceState(null,'','#guest');
    await restoreRoute();
    return;
  }
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

ensureSidebarLayout();
initScrollTop();
initPwa();
buildDashboardUi();
buildNotificationsUi();
buildSocialUi();
buildMembersUi();
buildCashUi();
buildProjectsUi();
buildTasksUi();
buildContactsUi();
buildFeedbackUi();
buildGuestUi();
buildNewsletterUi();
ensureReadabilityStyles();
initSocialExtras();
configureRouter({onDashboard:loadDashboard,onUsers:loadUsers,onEvent:applyEventRoute,onSocial:loadSocial,onNewsletter:loadNewsletter,onMembers:loadMembersForRole,onCash:loadCash,onNotifications:loadNotifications,onProjects:loadProjects,onTasks:loadTasks,onContacts:loadContacts,onFeedback:loadFeedback,onGuest:loadGuestPage});
initRouter();
initShell();
initEvents();
initNewsletter();
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
initFeedback();
initAuth(onAuthorized);
render();
bootstrapAuth(onAuthorized);

window.club42={showView,restoreRoute};
