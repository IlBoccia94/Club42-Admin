import {$,app,db,esc,toast} from './core.js';

const CHAT_ROLES=new Set(['admin','staff','treasurer']);
const PAGE_SIZE=1000;
const PRESENCE_HEARTBEAT_MS=25000;
const UNREAD_REFRESH_MS=60000;

let initialized=false;
let enabled=false;
let channel=null;
let heartbeatTimer=null;
let unreadTimer=null;
let unreadCount=0;
let lastReadAt=null;
let messages=[];
let sending=false;
let openedFromHash=false;

function canChat(){return !!app.currentUser&&CHAT_ROLES.has(app.currentProfile?.role)}
function dlg(){return $('club42ChatDlg')}
function chatIsOpen(){return !!dlg()?.open&&document.visibilityState==='visible'}

function ensureStyles(){
  if(document.querySelector('link[href^="chat.css"]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='chat.css?v=20260920-chat1';
  document.head.appendChild(link);
}

function buildUi(){
  if($('club42ChatFab'))return;
  document.body.insertAdjacentHTML('beforeend',`
    <button id="club42ChatFab" class="club42-chat-fab" type="button" aria-label="Apri chat direttivo" title="Chat direttivo" hidden>
      <span class="club42-chat-fab-icon" aria-hidden="true">💬</span>
      <b>Chat</b>
      <span id="club42ChatBadge" class="club42-chat-badge" hidden>0</span>
    </button>
    <dialog id="club42ChatDlg" class="club42-chat-dialog" aria-labelledby="club42ChatTitle">
      <div class="club42-chat-shell">
        <header class="club42-chat-head">
          <div>
            <div class="club42-chat-kicker">Direttivo Club42</div>
            <h3 id="club42ChatTitle">Chat</h3>
            <p>Messaggi in tempo reale · cronologia ultimi 3 mesi</p>
          </div>
          <button id="club42ChatClose" class="close" type="button" aria-label="Chiudi chat">×</button>
        </header>
        <div id="club42ChatMessages" class="club42-chat-messages" aria-live="polite">
          <div class="club42-chat-empty">Caricamento chat…</div>
        </div>
        <form id="club42ChatForm" class="club42-chat-compose">
          <textarea id="club42ChatText" rows="2" maxlength="4000" required placeholder="Scrivi al direttivo…"></textarea>
          <button id="club42ChatSend" class="btn primary" type="submit">Invia</button>
        </form>
      </div>
    </dialog>`);
}

function formatTime(value){
  return new Intl.DateTimeFormat('it-IT',{hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}
function dateKey(value){
  return new Intl.DateTimeFormat('it-IT',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
}
function dateLabel(value){
  const d=new Date(value),today=new Date(),yesterday=new Date();
  yesterday.setDate(today.getDate()-1);
  const same=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
  if(same(d,today))return 'Oggi';
  if(same(d,yesterday))return 'Ieri';
  return new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'long',year:'numeric'}).format(d);
}

function updateBadge(){
  const badge=$('club42ChatBadge'),button=$('club42ChatFab');
  if(!badge||!button)return;
  if(unreadCount>0){
    badge.hidden=false;
    badge.textContent=unreadCount>99?'99+':String(unreadCount);
    button.setAttribute('aria-label',`Apri chat direttivo · ${unreadCount} messaggi non letti`);
    button.classList.add('has-unread');
  }else{
    badge.hidden=true;
    badge.textContent='0';
    button.setAttribute('aria-label','Apri chat direttivo');
    button.classList.remove('has-unread');
  }
}

async function ensureReadState(){
  if(!enabled||!app.currentUser)return null;
  const {data,error}=await db.from('director_chat_reads').select('last_read_at').eq('user_id',app.currentUser.id).maybeSingle();
  if(error){console.error('Chat read state',error);return null}
  if(data?.last_read_at){
    lastReadAt=data.last_read_at;
    return lastReadAt;
  }
  const now=new Date().toISOString();
  const {data:created,error:createError}=await db.from('director_chat_reads')
    .insert({user_id:app.currentUser.id,last_read_at:now,updated_at:now})
    .select('last_read_at').single();
  if(createError){console.error('Chat read init',createError);return null}
  lastReadAt=created.last_read_at;
  return lastReadAt;
}

async function refreshUnread(){
  if(!enabled||!app.currentUser)return;
  if(chatIsOpen()){unreadCount=0;updateBadge();return}
  if(!lastReadAt)await ensureReadState();
  if(!lastReadAt)return;
  const {count,error}=await db.from('director_chat_messages')
    .select('id',{count:'exact',head:true})
    .gt('created_at',lastReadAt)
    .neq('sender_id',app.currentUser.id);
  if(error){console.error('Chat unread count',error);return}
  unreadCount=Number(count||0);
  updateBadge();
}

async function markReadThrough(value){
  if(!enabled||!app.currentUser)return;
  const target=value||new Date().toISOString();
  if(lastReadAt&&Date.parse(lastReadAt)>=Date.parse(target)){
    unreadCount=0;updateBadge();return;
  }
  const row={user_id:app.currentUser.id,last_read_at:target,updated_at:new Date().toISOString()};
  const {error}=await db.from('director_chat_reads').upsert(row,{onConflict:'user_id'});
  if(error){console.error('Chat mark read',error);return}
  lastReadAt=target;
  unreadCount=0;
  updateBadge();
}

async function setPresence(open){
  if(!enabled||!app.currentUser)return;
  const visible=open&&document.visibilityState==='visible';
  const {error}=await db.from('director_chat_presence').upsert({
    user_id:app.currentUser.id,
    is_open:visible,
    last_seen_at:new Date().toISOString()
  },{onConflict:'user_id'});
  if(error)console.error('Chat presence',error);
}
function stopHeartbeat(){
  if(heartbeatTimer){clearInterval(heartbeatTimer);heartbeatTimer=null}
}
function startHeartbeat(){
  stopHeartbeat();
  if(!chatIsOpen())return;
  heartbeatTimer=setInterval(()=>{if(chatIsOpen())setPresence(true)},PRESENCE_HEARTBEAT_MS);
}

async function fetchMessages(){
  const cutoff=new Date();
  cutoff.setMonth(cutoff.getMonth()-3);
  const rows=[];
  let from=0;
  while(true){
    const {data,error}=await db.from('director_chat_messages')
      .select('id,sender_id,sender_name,body,created_at')
      .gte('created_at',cutoff.toISOString())
      .order('created_at',{ascending:true})
      .range(from,from+PAGE_SIZE-1);
    if(error)throw error;
    const batch=data||[];
    rows.push(...batch);
    if(batch.length<PAGE_SIZE)break;
    from+=PAGE_SIZE;
  }
  return rows;
}

function renderMessages(firstUnreadId=null){
  const root=$('club42ChatMessages');
  if(!root)return;
  if(!messages.length){
    root.innerHTML='<div class="club42-chat-empty">Nessun messaggio ancora. Inizia tu la conversazione.</div>';
    return;
  }
  let lastDay='';
  root.innerHTML=messages.map(m=>{
    const day=dateKey(m.created_at);
    const divider=day!==lastDay?`<div class="club42-chat-day"><span>${esc(dateLabel(m.created_at))}</span></div>`:'';
    lastDay=day;
    const unread=firstUnreadId===m.id?'<div class="club42-chat-unread-marker" data-chat-first-unread><span>Nuovi messaggi</span></div>':'';
    const own=m.sender_id===app.currentUser?.id;
    return `${divider}${unread}<article class="club42-chat-message ${own?'own':'other'}" data-chat-message-id="${m.id}">
      <div class="club42-chat-message-meta"><strong>${esc(m.sender_name||'Utente Club42')}</strong><time>${esc(formatTime(m.created_at))}</time></div>
      <div class="club42-chat-bubble">${esc(m.body||'').replaceAll('\n','<br>')}</div>
    </article>`;
  }).join('');
}

function scrollToBottom(behavior='auto'){
  const root=$('club42ChatMessages');
  if(root)root.scrollTo({top:root.scrollHeight,behavior});
}
function scrollToFirstUnread(){
  const root=$('club42ChatMessages');
  const marker=root?.querySelector('[data-chat-first-unread]');
  if(marker)marker.scrollIntoView({block:'start',behavior:'auto'});
  else scrollToBottom('auto');
}
function appendMessage(row,{scroll=false}={}){
  if(!row?.id||messages.some(m=>m.id===row.id))return;
  messages.push(row);
  messages.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  if(dlg()?.open){
    renderMessages(null);
    if(scroll)requestAnimationFrame(()=>scrollToBottom('smooth'));
  }
}

async function openChat({fromHash=false}={}){
  if(!enabled)return;
  const dialog=dlg();
  if(!dialog||dialog.open)return;
  openedFromHash=fromHash;
  const previousRead=lastReadAt;
  dialog.showModal();
  await setPresence(true);
  startHeartbeat();
  try{
    messages=await fetchMessages();
    const firstUnread=messages.find(m=>m.sender_id!==app.currentUser?.id&&(!previousRead||Date.parse(m.created_at)>Date.parse(previousRead)));
    renderMessages(firstUnread?.id||null);
    requestAnimationFrame(scrollToFirstUnread);
    const latest=messages.at(-1)?.created_at||new Date().toISOString();
    await markReadThrough(latest);
  }catch(error){
    console.error('Chat load',error);
    $('club42ChatMessages').innerHTML='<div class="club42-chat-empty error">Errore nel caricamento della chat.</div>';
  }
  setTimeout(()=>$('club42ChatText')?.focus(),80);
}

function closeChat(){
  if(dlg()?.open)dlg().close();
}

async function onChatClosed(){
  stopHeartbeat();
  await setPresence(false);
  if(openedFromHash&&location.hash==='#dashboard/chat'){
    history.replaceState(null,'','#dashboard');
  }
  openedFromHash=false;
  await refreshUnread();
}

async function sendMessage(ev){
  ev.preventDefault();
  if(!enabled||!app.currentUser||sending)return;
  const input=$('club42ChatText');
  const body=input?.value?.trim()||'';
  if(!body)return;
  sending=true;
  const send=$('club42ChatSend');
  if(send){send.disabled=true;send.textContent='Invio…'}
  try{
    const {data,error}=await db.from('director_chat_messages')
      .insert({sender_id:app.currentUser.id,sender_name:app.currentProfile?.display_name||app.currentProfile?.email||'Utente Club42',body})
      .select('id,sender_id,sender_name,body,created_at')
      .single();
    if(error)throw error;
    input.value='';
    appendMessage(data,{scroll:true});
    await markReadThrough(data.created_at);
  }catch(error){
    console.error('Chat send',error);
    toast(error.message||'Invio messaggio non riuscito');
  }finally{
    sending=false;
    if(send){send.disabled=false;send.textContent='Invia'}
    input?.focus();
  }
}

function subscribeRealtime(){
  if(channel||!enabled||!app.currentUser)return;
  const userId=app.currentUser.id;
  channel=db.channel(`club42-director-chat-${userId}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'director_chat_messages'},payload=>{
      const row=payload.new;
      if(row.sender_id===app.currentUser?.id){
        if(dlg()?.open)appendMessage(row);
        return;
      }
      if(chatIsOpen()){
        appendMessage(row);
        markReadThrough(row.created_at);
      }else{
        unreadCount++;
        updateBadge();
      }
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'director_chat_reads',filter:`user_id=eq.${userId}`},payload=>{
      if(payload.new?.last_read_at)lastReadAt=payload.new.last_read_at;
      if(chatIsOpen()){unreadCount=0;updateBadge()}
      else refreshUnread();
    })
    .subscribe(status=>{
      if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('Chat realtime',status);
    });
}
async function unsubscribeRealtime(){
  if(!channel)return;
  const old=channel;channel=null;
  try{await db.removeChannel(old)}catch(error){console.warn('Chat unsubscribe',error)}
}

async function disableChat(){
  enabled=false;
  $('club42ChatFab')?.setAttribute('hidden','');
  if(dlg()?.open)dlg().close();
  stopHeartbeat();
  if(unreadTimer){clearInterval(unreadTimer);unreadTimer=null}
  await unsubscribeRealtime();
  unreadCount=0;lastReadAt=null;messages=[];
  updateBadge();
}

function maybeOpenFromHash(){
  if(enabled&&location.hash==='#dashboard/chat')openChat({fromHash:true});
}

export async function loadChatForRole(){
  if(!canChat()){await disableChat();return}
  enabled=true;
  $('club42ChatFab')?.removeAttribute('hidden');
  await ensureReadState();
  subscribeRealtime();
  await refreshUnread();
  if(!unreadTimer)unreadTimer=setInterval(()=>{if(enabled&&!chatIsOpen())refreshUnread()},UNREAD_REFRESH_MS);
  maybeOpenFromHash();
}

export function initChat(){
  if(initialized)return;
  initialized=true;
  ensureStyles();
  buildUi();

  $('club42ChatFab').onclick=()=>openChat();
  $('club42ChatClose').onclick=closeChat;
  $('club42ChatDlg').addEventListener('close',onChatClosed);
  $('club42ChatDlg').addEventListener('click',ev=>{if(ev.target===dlg())closeChat()});
  $('club42ChatForm').addEventListener('submit',sendMessage);
  $('club42ChatText').addEventListener('keydown',ev=>{
    if(ev.key==='Enter'&&!ev.shiftKey){
      ev.preventDefault();
      $('club42ChatForm').requestSubmit();
    }
  });

  window.addEventListener('hashchange',maybeOpenFromHash);
  document.addEventListener('visibilitychange',()=>{
    if(!enabled)return;
    if(dlg()?.open){
      if(document.visibilityState==='visible'){
        setPresence(true);startHeartbeat();
        const latest=messages.at(-1)?.created_at;
        if(latest)markReadThrough(latest);
      }else{
        stopHeartbeat();setPresence(false);
      }
    }else if(document.visibilityState==='visible'){
      refreshUnread();
    }
  });
  db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')disableChat()});
}
