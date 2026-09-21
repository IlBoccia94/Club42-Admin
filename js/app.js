import {$,app,download,list} from './core.js';
import {initRouter,configureRouter,restoreRoute,showView,parseRoute} from './router.js?v=20260918-newsletter-recipients1';
import {initAuth,bootstrapAuth} from './auth.js?v=20260917-signup-newsletter1';
import {applyRoleUi} from './permissions.js?v=20260918-newsletter-recipients1';
import {initPwa} from './pwa.js?v=20260918-freshassets1';
import {initScrollTop} from './scroll-top.js?v=20260917-1';
import {initChat,loadChatForRole} from './chat.js?v=20260921-messageedit1';
import {initEvents,loadRemote,render,applyEventRoute} from './events.js?v=20260921-historycalendar1';
import {initUsers,loadUsers} from './users.js?v=20260918-consentfix1';
import {buildDashboardUi} from './dashboard-ui.js?v=20260917-2';
import {initDashboard,loadDashboard} from './dashboard.js?v=20260917-2';
import {buildNotificationsUi} from './notifications-ui.js?v=20260918-push-audit2';
import {initNotifications,loadNotifications} from './notifications.js?v=20260918-taskattention1';
import {buildSocialUi} from './social-ui.js?v=20260919-votes1';
import {initSocial,loadSocial} from './social.js?v=20260919-votes1';
import {initSocialExtras} from './social-extras.js';
import {initSocialFormats} from './social-formats.js?v=20260919-socialsingle1';
import {buildMembersUi} from './members-ui.js?v=20260918-cycle1';
import {initMembers} from './members.js?v=20260918-cycle1';
import {loadMembersForRole} from './member-access.js?v=20260920-richchat1';
import {buildCashUi} from './cash-ui.js?v=20260918-reimburse1';
import {initCash,loadCash} from './cash.js?v=20260918-reimburse1';
import {buildProjectsUi} from './projects-ui.js?v=20260919-carddesc1';
import {initProjects,loadProjects} from './projects.js?v=20260919-portfoliofilter1';
import {buildTasksUi} from './tasks-ui.js?v=20260919-kpifilters1';
import {initTasks,loadTasks} from './tasks.js?v=20260919-kpifilters1';
import {buildContactsUi} from './contacts-ui.js';
import {initContacts,loadContacts} from './contacts.js?v=20260917-contactsfull1';
import {buildGuestUi} from './guest-ui.js?v=20260918-daterange2';
import {buildFeedbackUi} from './feedback-ui.js?v=20260919-edit1';
import {initFeedback,loadFeedback} from './feedback.js?v=20260919-edit1';
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
    await loadChatForRole();
    history.replaceState(null,'','#guest');
    await restoreRoute();
    return;
  }
  await loadRemote();
  const route=parseRoute();
  await restoreRoute();
  await loadChatForRole();
  if(route.authCallback&&location.hash.includes('type=invite'))setTimeout(()=>{if(!$('passwordDlg').open)$('passwordDlg').showModal()},200);
}

async function openLinkedEntity(type,id){
  if(!id)return false;
  try{
    if(type==='event'){
      await loadRemote();
      if(!app.state.events.some(e=>e.id===id))return false;
      await showView('events',{eventId:id});
      window.openEvent?.(id);
      return $('eventDlg')?.open===true;
    }
    if(type==='project'){
      await loadProjects();await showView('projects');window.openProject?.(id);
      return $('projectDlg')?.open===true;
    }
    if(type==='task'){
      await loadTasks();await showView('tasks');window.openTask?.(id);
      return $('taskDlg')?.open===true;
    }
    if(type==='member'){
      await loadMembersForRole();await showView('members');
      if(app.currentProfile?.role==='admin'){
        window.openMember?.(id);
        return $('memberDlg')?.open===true;
      }
      return window.focusLimitedMember?.(id)===true;
    }
    if(type==='contact'){
      await loadContacts();await showView('contacts');window.openContact?.(id);
      return $('contactDlg')?.open===true;
    }
    if(type==='social'){
      await loadSocial();await showView('social');window.openSocialContent?.(id);
      return $('socialContentDlg')?.open===true;
    }
    return false;
  }catch(error){
    console.error('Apertura elemento collegato dalla chat',error);
    return false;
  }
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
initChat();
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

window.club42={showView,restoreRoute,openLinkedEntity};
