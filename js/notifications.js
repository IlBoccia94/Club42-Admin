import {$,app,db,SUPABASE_URL,SUPABASE_KEY,toast} from './core.js';
import {isAdmin,isTreasurer} from './permissions.js';
import {getServiceWorkerRegistration,isStandalone,isIos,canPromptInstall,promptInstallPwa} from './pwa.js';

const VAPID_PUBLIC_KEY='BLVXtniv5aw-9oXQbV9b7pCjeKGzNYahsUNcFvBi_RuwbMLZdvcDEq3Zx9RBVT2wkCXQaZCfzb3uGegWGKwD_JA';
const categories=['tasks','events','social','cash','members','projects','users'];
const info={
  tasks:{title:'Task',body:'Ricevi una push quando ti viene assegnato un task, quando un tuo task viene impostato come bloccato, alle 09:00 del giorno prima della scadenza e una volta quando risulta scaduto.'},
  events:{title:'Eventi',body:'Ricevi una push quando un evento raggiunge la capienza prevista e alle 09:00 del giorno precedente a un evento in calendario.'},
  social:{title:'Social',body:'Ricevi una push circa 2 ore prima dell’orario programmato di un contenuto Social e una volta quando un contenuto programmato risulta in ritardo ma non pubblicato. Se il contenuto ha un assegnatario, l’avviso va a lui; altrimenti agli utenti operativi.'},
  cash:{title:'Cassa',body:'Disponibile per Admin e Tesoriere. Ricevi una push quando un altro utente registra un nuovo movimento di Cassa. Non viene notificata la modifica di un movimento già esistente.'},
  members:{title:'Soci',body:'Disponibile per Admin e Tesoriere. Il lunedì alle 09:00 viene inviato un riepilogo se risultano quote associative da rinnovare. Non viene inviata una notifica per ogni singolo socio.'},
  projects:{title:'Progetti',body:'Alle 09:00 del giorno precedente alla prossima azione di un progetto viene inviato un promemoria al responsabile del progetto; se non c’è un responsabile, l’avviso viene inviato agli utenti operativi.'},
  users:{title:'Utenti',body:'Solo Admin. Ricevi una push quando compare un nuovo account in stato “In attesa” che richiede approvazione.'}
};

function availableCategory(category){
  if(category==='users')return isAdmin();
  if(category==='cash'||category==='members')return isAdmin()||isTreasurer();
  return true;
}

function b64ToUint8(value){
  const padding='='.repeat((4-value.length%4)%4);
  const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}

function timezone(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Rome'}catch{return 'Europe/Rome'}}

async function ensurePreferences(){
  if(!app.currentUser)return null;
  const {data,error}=await db.from('notification_preferences').select('*').eq('user_id',app.currentUser.id).maybeSingle();
  if(error){console.error(error);toast('Errore caricamento preferenze notifiche');return null}
  if(data)return data;
  const row={user_id:app.currentUser.id,timezone:timezone()};
  const {data:created,error:createError}=await db.from('notification_preferences').insert(row).select('*').single();
  if(createError){console.error(createError);return null}
  return created;
}

function renderPreferences(prefs){
  categories.forEach(cat=>{
    const el=$(`notifPref-${cat}`);
    if(el)el.checked=prefs?.[cat]!==false;
    const row=document.querySelector(`[data-notif-category="${cat}"]`);
    if(row)row.hidden=!availableCategory(cat);
  });
}

async function savePreference(category,value){
  if(!app.currentUser||!categories.includes(category)||!availableCategory(category))return;
  const row={user_id:app.currentUser.id,[category]:value,timezone:timezone(),updated_at:new Date().toISOString()};
  const {error}=await db.from('notification_preferences').upsert(row,{onConflict:'user_id'});
  if(error){toast(error.message);const el=$(`notifPref-${category}`);if(el)el.checked=!value;return}
  toast('Preferenza salvata');
}

async function getBrowserSubscription(){
  const reg=await getServiceWorkerRegistration();
  if(!reg?.pushManager)return null;
  try{return await reg.pushManager.getSubscription()}catch{return null}
}

function setStatus(text,hint,kind=''){
  const s=$('notifPushStatus'),h=$('notifPushHint');
  if(s){s.textContent=text;s.classList.remove('notif-status-ok','notif-status-warn','notif-status-bad');if(kind)s.classList.add(`notif-status-${kind}`)}
  if(h)h.textContent=hint;
}

async function refreshPushStatus(){
  const enable=$('notifEnablePush'),test=$('notifTestPush'),disable=$('notifDisablePush');
  const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  if(!supported){setStatus('Push non supportate','Questo browser non supporta Web Push.','bad');if(enable)enable.hidden=true;if(test)test.hidden=true;if(disable)disable.hidden=true;return}
  const sub=await getBrowserSubscription();
  if(Notification.permission==='denied'){
    setStatus('Notifiche bloccate','Riabilita le notifiche dalle impostazioni del browser/sistema.','bad');
    if(enable)enable.hidden=true;if(test)test.hidden=true;if(disable)disable.hidden=!sub;return;
  }
  if(sub){
    setStatus('Notifiche attive','Questo dispositivo può ricevere push anche con la pagina chiusa.','ok');
    if(enable)enable.hidden=true;if(test)test.hidden=false;if(disable)disable.hidden=false;
  }else{
    setStatus(Notification.permission==='granted'?'Dispositivo non registrato':'Non attive','Attivale per ricevere gli avvisi selezionati su questo dispositivo.','warn');
    if(enable)enable.hidden=false;if(test)test.hidden=true;if(disable)disable.hidden=true;
  }
}

async function enablePush(){
  if(!('Notification' in window))return toast('Notifiche non supportate');
  let permission=Notification.permission;
  if(permission!=='granted')permission=await Notification.requestPermission();
  if(permission!=='granted'){await refreshPushStatus();return toast(permission==='denied'?'Permesso notifiche bloccato':'Permesso notifiche non concesso')}
  const reg=await getServiceWorkerRegistration();
  if(!reg?.pushManager)return toast('Service worker non disponibile');
  let sub=await reg.pushManager.getSubscription();
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8(VAPID_PUBLIC_KEY)});
  const data=sub.toJSON();
  const {error}=await db.from('push_subscriptions').upsert({
    user_id:app.currentUser.id,
    endpoint:data.endpoint,
    p256dh:data.keys?.p256dh,
    auth:data.keys?.auth,
    user_agent:navigator.userAgent,
    enabled:true,
    last_seen_at:new Date().toISOString()
  },{onConflict:'endpoint'});
  if(error)return toast(error.message);
  await db.from('notification_preferences').upsert({user_id:app.currentUser.id,timezone:timezone(),updated_at:new Date().toISOString()},{onConflict:'user_id'});
  toast('Notifiche attivate su questo dispositivo');
  await refreshPushStatus();
}

async function disablePush(){
  const sub=await getBrowserSubscription();
  if(!sub)return refreshPushStatus();
  const endpoint=sub.endpoint;
  const {error}=await db.from('push_subscriptions').delete().eq('endpoint',endpoint).eq('user_id',app.currentUser.id);
  if(error)return toast(error.message);
  await sub.unsubscribe().catch(()=>false);
  toast('Notifiche disattivate su questo dispositivo');
  await refreshPushStatus();
}

async function testPush(){
  const {data:{session}}=await db.auth.getSession();
  if(!session)return toast('Sessione scaduta');
  const r=await fetch(`${SUPABASE_URL}/functions/v1/push-dispatcher`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':SUPABASE_KEY},body:JSON.stringify({action:'test'})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)return toast(data.reason==='no_subscription'?'Questo dispositivo non risulta registrato':data.error||'Invio di prova non riuscito');
  toast('Notifica di prova inviata');
}

function showInfo(category=null){
  const dlg=$('notifInfoDlg'),title=$('notifInfoTitle'),body=$('notifInfoBody');
  if(!dlg||!body)return;
  if(category&&info[category]){
    title.textContent=info[category].title;
    body.innerHTML=`<article class="notif-info-card"><h4>Quando viene inviata</h4><p>${info[category].body}</p></article>`;
  }else{
    title.textContent='Quando vengono inviate';
    body.innerHTML=Object.entries(info).filter(([key])=>availableCategory(key)).map(([,x])=>`<article class="notif-info-card"><h4>${x.title}</h4><p>${x.body}</p></article>`).join('');
  }
  dlg.showModal();
}

function renderInstallState(){
  const btn=$('notifInstallPwa'),text=$('notifInstallText'),note=$('notifInstallNote');
  if(!btn||!text||!note)return;
  if(isStandalone()){
    btn.hidden=true;text.textContent='Club42 Admin è già aperto come app installata.';note.textContent='Le push continueranno a funzionare anche quando chiudi questa finestra.';return;
  }
  btn.hidden=false;
  if(canPromptInstall()){
    btn.disabled=false;btn.textContent='Installa Club42 Admin';note.textContent='L’installazione non crea una copia dei dati: usa sempre lo stesso database Supabase.';
  }else if(isIos()){
    btn.disabled=true;btn.textContent='Installa dalla schermata Home';note.textContent='Su iPhone/iPad apri il menu Condividi del browser e scegli “Aggiungi alla schermata Home”.';
  }else{
    btn.disabled=false;btn.textContent='Installa Club42 Admin';note.textContent='Se il browser non mostra ancora il prompt, puoi usare “Installa app” o “Aggiungi a schermata Home” dal menu del browser.';
  }
}

async function installPwa(){
  const result=await promptInstallPwa();
  if(result.outcome==='unavailable')toast('Usa “Installa app” o “Aggiungi a schermata Home” dal menu del browser.');
  renderInstallState();
}

export async function loadNotifications(){
  const prefs=await ensurePreferences();
  renderPreferences(prefs);
  await refreshPushStatus();
  renderInstallState();
}

export function initNotifications(){
  document.querySelectorAll('[data-notif-pref]').forEach(el=>{el.addEventListener('change',()=>savePreference(el.dataset.notifPref,el.checked))});
  document.querySelectorAll('[data-notif-info]').forEach(el=>{el.addEventListener('click',()=>showInfo(el.dataset.notifInfo))});
  $('notifAllInfo').onclick=()=>showInfo();
  $('notifInfoClose').onclick=()=>$('notifInfoDlg').close();
  $('notifInfoOk').onclick=()=>$('notifInfoDlg').close();
  $('notifEnablePush').onclick=enablePush;
  $('notifDisablePush').onclick=disablePush;
  $('notifTestPush').onclick=testPush;
  $('notifInstallPwa').onclick=installPwa;
  document.addEventListener('club42:pwa-install-state',renderInstallState);
}
