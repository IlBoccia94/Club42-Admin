import {$,app,db,esc,toast} from './core.js';

const CHAT_ROLES=new Set(['admin','staff','treasurer']);
const PAGE_SIZE=1000;
const PRESENCE_HEARTBEAT_MS=25000;
const UNREAD_REFRESH_MS=60000;
const MAX_POLL_OPTIONS=30;

const LINK_TYPES={
  event:{label:'Evento',icon:'📅',view:'events'},
  project:{label:'Progetto',icon:'◈',view:'projects'},
  task:{label:'Task',icon:'✓',view:'tasks'},
  member:{label:'Socio',icon:'🪪',view:'members'},
  contact:{label:'Collaboratore',icon:'🤝',view:'contacts'},
  social:{label:'Contenuto Social',icon:'◎',view:'social'}
};

let initialized=false;
let enabled=false;
let channel=null;
let heartbeatTimer=null;
let unreadTimer=null;
let unreadCount=0;
let lastReadAt=null;
let messages=[];
let pollVotes=[];
let sending=false;
let openedFromHash=false;
let linkItems=[];
let selectedLinkItem=null;
let pollInfoMessageId=null;

function canChat(){return !!app.currentUser&&CHAT_ROLES.has(app.currentProfile?.role)}
function dlg(){return $('club42ChatDlg')}
function chatIsOpen(){return !!dlg()?.open&&document.visibilityState==='visible'}
function uuid(){return globalThis.crypto?.randomUUID?.()||('id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2))}
function chatClientId(){
  const key='club42_chat_client_id';
  let value=localStorage.getItem(key);
  if(value)return value;
  value=uuid();
  localStorage.setItem(key,value);
  return value;
}
function clampText(value,max=180){
  const s=String(value||'').trim().replace(/\s+/g,' ');
  return s.length>max?s.slice(0,max-1).trimEnd()+'…':s;
}

function ensureStyles(){
  if(document.querySelector('link[href^="chat.css"]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='chat.css?v=20260920-richchat2';
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

        <div class="club42-chat-tools">
          <button id="club42ChatPollBtn" type="button">📊 Sondaggio</button>
          <button id="club42ChatLinkBtn" type="button">🔗 Collega elemento</button>
        </div>

        <form id="club42ChatForm" class="club42-chat-compose">
          <textarea id="club42ChatText" rows="2" maxlength="4000" required placeholder="Scrivi al direttivo…"></textarea>
          <button id="club42ChatSend" class="btn primary" type="submit">Invia</button>
        </form>

        <section id="club42ChatInfoPanel" class="club42-chat-overlay" hidden aria-label="Informazioni messaggio">
          <div class="club42-chat-overlay-card">
            <div class="club42-chat-overlay-head"><div><span>Messaggio</span><h4>Chi ha letto</h4></div><button type="button" data-chat-overlay-close="club42ChatInfoPanel">×</button></div>
            <div id="club42ChatInfoBody" class="club42-chat-info-body"></div>
          </div>
        </section>

        <section id="club42PollInfoPanel" class="club42-chat-overlay" hidden aria-label="Dettaglio voti sondaggio">
          <div class="club42-chat-overlay-card">
            <div class="club42-chat-overlay-head"><div><span>Sondaggio</span><h4>Chi ha votato cosa</h4></div><button type="button" data-chat-overlay-close="club42PollInfoPanel">×</button></div>
            <div id="club42PollInfoBody" class="club42-poll-info-body"></div>
          </div>
        </section>

        <section id="club42ChatPollPanel" class="club42-chat-overlay" hidden aria-label="Crea sondaggio">
          <form id="club42ChatPollForm" class="club42-chat-overlay-card">
            <div class="club42-chat-overlay-head"><div><span>Nuovo messaggio</span><h4>Crea sondaggio</h4></div><button type="button" data-chat-overlay-close="club42ChatPollPanel">×</button></div>
            <div class="field"><label>Domanda *</label><textarea id="club42PollQuestion" rows="3" maxlength="4000" required placeholder="Su cosa vogliamo votare?"></textarea></div>
            <div class="club42-poll-settings">
              <div class="field"><label>Risposte selezionabili per persona</label><input id="club42PollMaxChoices" type="number" min="1" max="2" value="1" required></div>
              <div class="club42-poll-setting-hint">Ogni persona potrà scegliere fino al numero indicato.</div>
            </div>
            <div class="club42-poll-options-head"><b>Risposte</b><button id="club42PollAddOption" class="btn soft" type="button">＋ Aggiungi risposta</button></div>
            <div id="club42PollOptions" class="club42-poll-compose-options"></div>
            <div class="club42-chat-overlay-actions"><button type="button" class="btn" data-chat-overlay-close="club42ChatPollPanel">Annulla</button><button class="btn primary" type="submit">Invia sondaggio</button></div>
          </form>
        </section>

        <section id="club42ChatLinkPanel" class="club42-chat-overlay" hidden aria-label="Collega elemento">
          <form id="club42ChatLinkForm" class="club42-chat-overlay-card">
            <div class="club42-chat-overlay-head"><div><span>Nuovo messaggio</span><h4>Collega elemento</h4></div><button type="button" data-chat-overlay-close="club42ChatLinkPanel">×</button></div>
            <div class="form-grid">
              <div class="field"><label>Tipo</label><select id="club42LinkType">
                <option value="event">Evento</option>
                <option value="project">Progetto</option>
                <option value="task">Task</option>
                <option value="member">Socio</option>
                <option value="contact">Collaboratore</option>
                <option value="social">Contenuto Social</option>
              </select></div>
              <div class="field"><label>Elemento</label><select id="club42LinkItem"><option value="">Seleziona…</option></select></div>
            </div>
            <div id="club42LinkPreview" class="club42-link-preview"><div class="club42-chat-empty">Seleziona un elemento da collegare.</div></div>
            <div class="club42-chat-overlay-actions"><button type="button" class="btn" data-chat-overlay-close="club42ChatLinkPanel">Annulla</button><button id="club42LinkSend" class="btn primary" type="submit" disabled>Invia collegamento</button></div>
          </form>
        </section>
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
function itDate(value){
  if(!value)return '';
  const d=String(value).includes('T')?new Date(value):new Date(value+'T12:00:00');
  if(Number.isNaN(d.getTime()))return String(value);
  return new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
}
function humanStatus(value){
  const map={
    idea:'Idea',evaluation:'Valutazione',planning:'Pianificazione',confirmed:'Confermato',production:'Produzione',
    completed:'Completato',archived:'Archiviato',cancelled:'Annullato',backlog:'Backlog',todo:'Da fare',
    doing:'In corso',blocked:'Bloccato',done:'Fatto',planned:'Pianificato',review:'Revisione',ready:'Pronto',
    scheduled:'Programmato',published:'Pubblicato',active:'Attivo',inactive:'Inattivo',suspended:'Sospeso',
    reel:'Reel',carousel:'Carousel',story:'Stories',post:'Post',live:'Live',other:'Altro'
  };
  return map[value]||String(value||'');
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
  if(data?.last_read_at){lastReadAt=data.last_read_at;return lastReadAt}
  const cutoff=new Date();cutoff.setMonth(cutoff.getMonth()-3);
  const initialRead=cutoff.toISOString(),now=new Date().toISOString();
  const {data:created,error:createError}=await db.from('director_chat_reads')
    .insert({user_id:app.currentUser.id,last_read_at:initialRead,updated_at:now})
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
  if(lastReadAt&&Date.parse(lastReadAt)>=Date.parse(target)){unreadCount=0;updateBadge();return}
  const {error}=await db.from('director_chat_reads').upsert({
    user_id:app.currentUser.id,last_read_at:target,updated_at:new Date().toISOString()
  },{onConflict:'user_id'});
  if(error){console.error('Chat mark read',error);return}
  lastReadAt=target;unreadCount=0;updateBadge();
}

async function setPresence(open){
  if(!enabled||!app.currentUser)return;
  const visible=open&&document.visibilityState==='visible';
  const {error}=await db.from('director_chat_presence').upsert({
    user_id:app.currentUser.id,client_id:chatClientId(),is_open:visible,last_seen_at:new Date().toISOString()
  },{onConflict:'user_id,client_id'});
  if(error)console.error('Chat presence',error);
}
function stopHeartbeat(){if(heartbeatTimer){clearInterval(heartbeatTimer);heartbeatTimer=null}}
function startHeartbeat(){
  stopHeartbeat();
  if(!chatIsOpen())return;
  heartbeatTimer=setInterval(()=>{if(chatIsOpen())setPresence(true)},PRESENCE_HEARTBEAT_MS);
}

async function fetchMessages(){
  const cutoff=new Date();cutoff.setMonth(cutoff.getMonth()-3);
  const rows=[];let from=0;
  while(true){
    const {data,error}=await db.from('director_chat_messages')
      .select('id,sender_id,sender_name,body,message_type,metadata,created_at')
      .gte('created_at',cutoff.toISOString()).order('created_at',{ascending:true})
      .range(from,from+PAGE_SIZE-1);
    if(error)throw error;
    const batch=data||[];rows.push(...batch);
    if(batch.length<PAGE_SIZE)break;from+=PAGE_SIZE;
  }
  return rows;
}
async function fetchPollVotes(){
  const {data,error}=await db.from('director_chat_poll_votes').select('message_id,user_id,option_id,created_at');
  if(error)throw error;
  return data||[];
}
function votesFor(messageId){return pollVotes.filter(v=>v.message_id===messageId)}

function renderPoll(message){
  const metadata=message.metadata||{};
  const options=Array.isArray(metadata.options)?metadata.options:[];
  const votes=votesFor(message.id);
  const mine=new Set(votes.filter(v=>v.user_id===app.currentUser?.id).map(v=>v.option_id));
  const max=Math.max(1,Number(metadata.max_choices)||1);
  const voters=new Set(votes.map(v=>v.user_id)).size;
  const optionHtml=options.map(opt=>{
    const count=votes.filter(v=>v.option_id===opt.id).length;
    const selected=mine.has(opt.id);
    return `<button type="button" class="club42-poll-option ${selected?'selected':''}" data-chat-poll-message="${message.id}" data-chat-poll-option="${esc(opt.id)}" aria-pressed="${selected}">
      <span class="club42-poll-check">${selected?'✓':''}</span><span class="club42-poll-label">${esc(opt.label)}</span><b>${count}</b>
    </button>`;
  }).join('');
  return `<div class="club42-chat-rich club42-chat-poll">
    <div class="club42-rich-type">📊 Sondaggio</div>
    <h5>${esc(metadata.question||message.body||'Sondaggio')}</h5>
    <div class="club42-poll-options">${optionHtml}</div>
    <div class="club42-poll-foot"><span>Puoi scegliere fino a ${max} ${max===1?'risposta':'risposte'}</span><span>${voters} ${voters===1?'votante':'votanti'}</span></div>
    <button type="button" class="club42-poll-info-link" data-chat-poll-info="${message.id}">ⓘ Chi ha votato cosa</button>
  </div>`;
}
function renderLink(message){
  const m=message.metadata||{},cfg=LINK_TYPES[m.entity_type]||{label:'Elemento',icon:'🔗'};
  const meta=Array.isArray(m.meta)?m.meta.filter(Boolean):[];
  return `<button type="button" class="club42-chat-rich club42-chat-link-card" data-chat-link-message="${message.id}">
    <div class="club42-rich-type">${cfg.icon} ${esc(cfg.label)}</div>
    <h5>${esc(m.title||message.body||'Elemento collegato')}</h5>
    ${m.description?`<p>${esc(m.description)}</p>`:''}
    ${meta.length?`<div class="club42-link-meta">${meta.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}
    <div class="club42-link-open">Apri nell’app →</div>
  </button>`;
}
function renderMessageContent(message){
  if(message.message_type==='poll')return renderPoll(message);
  if(message.message_type==='link')return renderLink(message);
  return `<div class="club42-chat-bubble">${esc(message.body||'').replaceAll('\n','<br>')}</div>`;
}

function renderMessages(firstUnreadId=null){
  const root=$('club42ChatMessages');if(!root)return;
  if(!messages.length){root.innerHTML='<div class="club42-chat-empty">Nessun messaggio ancora. Inizia tu la conversazione.</div>';return}
  let lastDay='';
  root.innerHTML=messages.map(m=>{
    const day=dateKey(m.created_at);
    const divider=day!==lastDay?`<div class="club42-chat-day"><span>${esc(dateLabel(m.created_at))}</span></div>`:'';
    lastDay=day;
    const unread=firstUnreadId===m.id?'<div class="club42-chat-unread-marker" data-chat-first-unread><span>Nuovi messaggi</span></div>':'';
    const own=m.sender_id===app.currentUser?.id;
    return `${divider}${unread}<article class="club42-chat-message ${own?'own':'other'} ${m.message_type||'text'}" data-chat-message-id="${m.id}">
      <div class="club42-chat-message-meta"><strong>${esc(m.sender_name||'Utente Club42')}</strong><time>${esc(formatTime(m.created_at))}</time><button type="button" class="club42-chat-info-btn" data-chat-info-message="${m.id}" title="Informazioni lettura" aria-label="Chi ha letto questo messaggio">ⓘ</button></div>
      ${renderMessageContent(m)}
    </article>`;
  }).join('');
}

function rerenderPreserveScroll(){
  const root=$('club42ChatMessages');if(!root||!dlg()?.open)return;
  const top=root.scrollTop;renderMessages(null);root.scrollTop=top;
}
function scrollToBottom(behavior='auto'){const root=$('club42ChatMessages');if(root)root.scrollTo({top:root.scrollHeight,behavior})}
function scrollToFirstUnread(){
  const root=$('club42ChatMessages'),marker=root?.querySelector('[data-chat-first-unread]');
  if(marker)marker.scrollIntoView({block:'start',behavior:'auto'});else scrollToBottom('auto');
}
function appendMessage(row,{scroll=false}={}){
  if(!row?.id||messages.some(m=>m.id===row.id))return;
  const root=$('club42ChatMessages'),previousTop=root?.scrollTop||0;
  messages.push(row);messages.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  if(dlg()?.open){
    renderMessages(null);
    if(scroll)requestAnimationFrame(()=>scrollToBottom('smooth'));else if(root)root.scrollTop=previousTop;
  }
}

function closeOverlays(){
  document.querySelectorAll('.club42-chat-overlay').forEach(x=>x.hidden=true);
  pollInfoMessageId=null;
}
function showOverlay(id){
  closeOverlays();
  const el=$(id);if(el)el.hidden=false;
}

async function openMessageInfo(messageId){
  const message=messages.find(m=>m.id===messageId);if(!message)return;
  showOverlay('club42ChatInfoPanel');
  const body=$('club42ChatInfoBody');
  body.innerHTML='<div class="club42-chat-empty">Caricamento letture…</div>';
  const [profilesResult,readsResult]=await Promise.all([
    db.from('admin_users').select('user_id,display_name,email,role').eq('active',true).eq('status','active').in('role',['admin','staff','treasurer']).order('display_name'),
    db.from('director_chat_reads').select('user_id,last_read_at')
  ]);
  if(profilesResult.error||readsResult.error){
    console.error(profilesResult.error||readsResult.error);
    body.innerHTML='<div class="club42-chat-empty error">Impossibile caricare le letture.</div>';return;
  }
  const readMap=new Map((readsResult.data||[]).map(r=>[r.user_id,r.last_read_at]));
  const people=(profilesResult.data||[]).filter(p=>p.user_id!==message.sender_id);
  const read=people.filter(p=>Date.parse(readMap.get(p.user_id)||'')>=Date.parse(message.created_at));
  const unread=people.filter(p=>!read.includes(p));
  const person=x=>`<div class="club42-read-person"><span>${esc(x.display_name||x.email||'Utente')}</span></div>`;
  body.innerHTML=`
    <div class="club42-info-message-preview"><b>${esc(message.sender_name)}</b><span>${esc(dateLabel(message.created_at))} · ${esc(formatTime(message.created_at))}</span><p>${esc(clampText(message.body,220))}</p></div>
    <section><div class="club42-info-section-title"><span>✓ Letto da</span><b>${read.length}</b></div>${read.length?read.map(person).join(''):'<div class="club42-chat-empty small">Nessuno ancora.</div>'}</section>
    <section><div class="club42-info-section-title"><span>○ Non ancora letto</span><b>${unread.length}</b></div>${unread.length?unread.map(person).join(''):'<div class="club42-chat-empty small">Tutti hanno letto.</div>'}</section>`;
}

async function openPollInfo(messageId){
  const message=messages.find(m=>m.id===messageId);
  if(!message||message.message_type!=='poll')return;
  showOverlay('club42PollInfoPanel');
  pollInfoMessageId=messageId;
  const body=$('club42PollInfoBody');
  body.innerHTML='<div class="club42-chat-empty">Caricamento voti…</div>';

  const votes=votesFor(messageId);
  const voterIds=[...new Set(votes.map(v=>v.user_id))];
  let profiles=[];
  if(voterIds.length){
    const result=await db.from('admin_users')
      .select('user_id,display_name,email,role')
      .in('user_id',voterIds);
    if(result.error){
      console.error('Chat poll voters',result.error);
      body.innerHTML='<div class="club42-chat-empty error">Impossibile caricare il dettaglio dei voti.</div>';
      return;
    }
    profiles=result.data||[];
  }

  const names=new Map(profiles.map(p=>[p.user_id,p.display_name||p.email||'Utente Club42']));
  const metadata=message.metadata||{};
  const options=Array.isArray(metadata.options)?metadata.options:[];
  const uniqueVoters=new Set(votes.map(v=>v.user_id)).size;

  body.innerHTML=`
    <div class="club42-poll-info-summary">
      <b>${esc(metadata.question||message.body||'Sondaggio')}</b>
      <span>${uniqueVoters} ${uniqueVoters===1?'persona ha votato':'persone hanno votato'}</span>
    </div>
    <div class="club42-poll-info-options">
      ${options.map(opt=>{
        const optionVotes=votes.filter(v=>v.option_id===opt.id);
        return `<section class="club42-poll-info-option">
          <div class="club42-poll-info-option-head"><span>${esc(opt.label)}</span><b>${optionVotes.length}</b></div>
          <div class="club42-poll-voter-list">
            ${optionVotes.length
              ? optionVotes.map(v=>`<div class="club42-poll-voter">✓ ${esc(names.get(v.user_id)||'Utente non disponibile')}</div>`).join('')
              : '<div class="club42-chat-empty small">Nessun voto.</div>'}
          </div>
        </section>`;
      }).join('')}
    </div>`;
}

function addPollOption(value=''){
  const root=$('club42PollOptions');if(!root)return;
  if(root.children.length>=MAX_POLL_OPTIONS)return toast(`Massimo ${MAX_POLL_OPTIONS} risposte`);
  const row=document.createElement('div');
  row.className='club42-poll-compose-row';
  row.innerHTML=`<input maxlength="300" required placeholder="Risposta ${root.children.length+1}" value="${esc(value)}"><button type="button" title="Rimuovi risposta" aria-label="Rimuovi risposta">×</button>`;
  row.querySelector('button').onclick=()=>{if(root.children.length<=2)return toast('Servono almeno 2 risposte');row.remove();syncPollChoiceLimit()};
  root.appendChild(row);syncPollChoiceLimit();
}
function syncPollChoiceLimit(){
  const n=$('club42PollOptions')?.children.length||2,max=$('club42PollMaxChoices');
  if(!max)return;max.max=String(n);if(Number(max.value)>n)max.value=String(n);
}
function resetPollComposer(){
  $('club42PollQuestion').value='';$('club42PollMaxChoices').value='1';
  $('club42PollOptions').innerHTML='';addPollOption();addPollOption();
}
function openPollComposer(){resetPollComposer();showOverlay('club42ChatPollPanel');setTimeout(()=>$('club42PollQuestion')?.focus(),50)}

async function sendPoll(ev){
  ev.preventDefault();
  const question=$('club42PollQuestion').value.trim();
  const labels=[...$('club42PollOptions').querySelectorAll('input')].map(x=>x.value.trim()).filter(Boolean);
  if(question.length<2)return toast('Scrivi la domanda del sondaggio');
  if(labels.length<2)return toast('Aggiungi almeno 2 risposte');
  const maxChoices=Math.max(1,Math.min(labels.length,Number($('club42PollMaxChoices').value)||1));
  const metadata={question,max_choices:maxChoices,options:labels.map(label=>({id:uuid(),label}))};
  const ok=await insertMessage({body:question,message_type:'poll',metadata});
  if(ok)closeOverlays();
}

function normalizeLinkItem(type,row){
  if(type==='event')return{id:row.id,title:row.name,description:clampText(row.guest_description||row.notes||'',220),meta:[row.event_date&&`Data ${itDate(row.event_date)}`,row.event_time&&`Ore ${String(row.event_time).slice(0,5)}`,row.place].filter(Boolean)};
  if(type==='project')return{id:row.id,title:row.title,description:clampText(row.summary||row.objective||'',220),meta:[humanStatus(row.status),row.priority&&`Priorità ${humanStatus(row.priority)}`,row.target_date&&`Obiettivo ${itDate(row.target_date)}`,row.partner].filter(Boolean)};
  if(type==='task')return{id:row.id,title:row.title,description:clampText(row.description||row.notes||'',220),meta:[humanStatus(row.status),row.priority&&`Priorità ${humanStatus(row.priority)}`,row.due_date&&`Scadenza ${itDate(row.due_date)}`].filter(Boolean)};
  if(type==='member')return{id:row.id,title:`${row.first_name||''} ${row.last_name||''}`.trim()||'Socio',description:`Socio #${row.member_number||'—'}`,meta:[humanStatus(row.status),row.join_date&&`Dal ${itDate(row.join_date)}`].filter(Boolean)};
  if(type==='contact')return{id:row.id,title:row.name,description:clampText(row.organization||row.notes||'',220),meta:[row.contact_type==='organization'?'Organizzazione':'Persona',row.city,row.favorite?'Preferito':null].filter(Boolean)};
  if(type==='social')return{id:row.id,title:row.title,description:clampText(row.hook||row.caption||row.production_notes||'',220),meta:[humanStatus(row.status),humanStatus(row.content_type),row.scheduled_date&&`Data ${itDate(row.scheduled_date)}`].filter(Boolean)};
  return null;
}
async function fetchLinkItems(type){
  let query;
  if(type==='event')query=db.from('events').select('id,name,event_date,event_time,place,notes,guest_description').order('event_date',{ascending:false});
  else if(type==='project')query=db.from('projects').select('id,title,summary,objective,status,priority,target_date,partner').order('updated_at',{ascending:false});
  else if(type==='task')query=db.from('project_tasks').select('id,title,description,notes,status,priority,due_date').order('updated_at',{ascending:false});
  else if(type==='member')query=db.rpc('club42_member_directory');
  else if(type==='contact')query=db.from('contacts').select('id,name,organization,contact_type,city,favorite,notes').order('favorite',{ascending:false}).order('name');
  else query=db.from('social_content').select('id,title,hook,caption,production_notes,status,content_type,scheduled_date').order('updated_at',{ascending:false});
  const {data,error}=await query;if(error)throw error;
  return (data||[]).map(row=>normalizeLinkItem(type,row)).filter(Boolean);
}
function renderLinkPreview(item,type){
  const root=$('club42LinkPreview'),send=$('club42LinkSend');selectedLinkItem=item||null;
  if(!item){root.innerHTML='<div class="club42-chat-empty">Seleziona un elemento da collegare.</div>';send.disabled=true;return}
  const cfg=LINK_TYPES[type];
  root.innerHTML=`<div class="club42-chat-rich club42-chat-link-card preview"><div class="club42-rich-type">${cfg.icon} ${esc(cfg.label)}</div><h5>${esc(item.title)}</h5>${item.description?`<p>${esc(item.description)}</p>`:''}${item.meta?.length?`<div class="club42-link-meta">${item.meta.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}</div>`;
  send.disabled=false;
}
async function loadLinkPicker(type){
  const select=$('club42LinkItem'),preview=$('club42LinkPreview'),send=$('club42LinkSend');
  select.disabled=true;send.disabled=true;select.innerHTML='<option value="">Caricamento…</option>';preview.innerHTML='<div class="club42-chat-empty">Caricamento elementi…</div>';
  try{
    linkItems=await fetchLinkItems(type);
    select.innerHTML='<option value="">Seleziona…</option>'+linkItems.map(x=>`<option value="${x.id}">${esc(x.title)}</option>`).join('');
    preview.innerHTML=linkItems.length?'<div class="club42-chat-empty">Seleziona un elemento da collegare.</div>':'<div class="club42-chat-empty">Nessun elemento disponibile.</div>';
  }catch(error){
    console.error('Chat link items',error);
    select.innerHTML='<option value="">Errore caricamento</option>';preview.innerHTML='<div class="club42-chat-empty error">Impossibile caricare gli elementi.</div>';
  }finally{select.disabled=false}
}
async function openLinkComposer(){
  selectedLinkItem=null;$('club42LinkType').value='event';showOverlay('club42ChatLinkPanel');await loadLinkPicker('event');
}
async function sendLink(ev){
  ev.preventDefault();
  const type=$('club42LinkType').value,item=selectedLinkItem;
  if(!item)return toast('Seleziona un elemento da collegare');
  const cfg=LINK_TYPES[type];
  const metadata={entity_type:type,entity_id:item.id,title:item.title,description:item.description||'',meta:item.meta||[],view:cfg.view};
  const ok=await insertMessage({body:item.title,message_type:'link',metadata});
  if(ok)closeOverlays();
}

async function insertMessage({body,message_type='text',metadata={}}){
  if(!enabled||!app.currentUser||sending)return false;
  const clean=String(body||'').trim();if(!clean)return false;
  sending=true;
  const send=$('club42ChatSend');if(send){send.disabled=true;if(message_type==='text')send.textContent='Invio…'}
  try{
    const {data,error}=await db.from('director_chat_messages')
      .insert({sender_id:app.currentUser.id,sender_name:app.currentProfile?.display_name||app.currentProfile?.email||'Utente Club42',body:clean,message_type,metadata})
      .select('id,sender_id,sender_name,body,message_type,metadata,created_at').single();
    if(error)throw error;
    appendMessage(data,{scroll:true});await markReadThrough(data.created_at);return true;
  }catch(error){
    console.error('Chat send',error);toast(error.message||'Invio messaggio non riuscito');return false;
  }finally{
    sending=false;if(send){send.disabled=false;send.textContent='Invia'}
  }
}
async function sendMessage(ev){
  ev.preventDefault();
  const input=$('club42ChatText'),body=input?.value?.trim()||'';if(!body)return;
  const ok=await insertMessage({body});
  if(ok){input.value='';input.focus()}
}

async function togglePollVote(messageId,optionId){
  const message=messages.find(m=>m.id===messageId);if(!message||message.message_type!=='poll')return;
  const mine=votesFor(messageId).filter(v=>v.user_id===app.currentUser?.id);
  const existing=mine.find(v=>v.option_id===optionId);
  if(existing){
    const {error}=await db.from('director_chat_poll_votes').delete().eq('message_id',messageId).eq('user_id',app.currentUser.id).eq('option_id',optionId);
    if(error)return toast(error.message);
    pollVotes=pollVotes.filter(v=>!(v.message_id===messageId&&v.user_id===app.currentUser.id&&v.option_id===optionId));rerenderPreserveScroll();return;
  }
  const max=Math.max(1,Number(message.metadata?.max_choices)||1);
  if(mine.length>=max)return toast(`Puoi scegliere al massimo ${max} ${max===1?'risposta':'risposte'}`);
  const {data,error}=await db.from('director_chat_poll_votes').insert({message_id:messageId,user_id:app.currentUser.id,option_id:optionId}).select('*').single();
  if(error)return toast(error.message);
  if(data&&!pollVotes.some(v=>v.message_id===data.message_id&&v.user_id===data.user_id&&v.option_id===data.option_id))pollVotes.push(data);
  rerenderPreserveScroll();
}

async function openLinkedMessage(messageId){
  const message=messages.find(m=>m.id===messageId),m=message?.metadata||{};
  if(!message||message.message_type!=='link'||!m.entity_type||!m.entity_id)return;
  openedFromHash=false;
  closeChat();
  const opener=window.club42?.openLinkedEntity;
  if(typeof opener!=='function')return toast('Apertura elemento non disponibile');
  const ok=await opener(m.entity_type,m.entity_id);
  if(ok===false)toast('L’elemento collegato non è più disponibile.');
}

async function openChat({fromHash=false}={}){
  if(!enabled)return;
  const dialog=dlg();if(!dialog||dialog.open)return;
  openedFromHash=fromHash;closeOverlays();
  const previousRead=lastReadAt;dialog.showModal();await setPresence(true);startHeartbeat();
  try{
    [messages,pollVotes]=await Promise.all([fetchMessages(),fetchPollVotes()]);
    const firstUnread=messages.find(m=>m.sender_id!==app.currentUser?.id&&(!previousRead||Date.parse(m.created_at)>Date.parse(previousRead)));
    renderMessages(firstUnread?.id||null);requestAnimationFrame(scrollToFirstUnread);
    const latest=messages.at(-1)?.created_at||new Date().toISOString();await markReadThrough(latest);
  }catch(error){
    console.error('Chat load',error);$('club42ChatMessages').innerHTML='<div class="club42-chat-empty error">Errore nel caricamento della chat.</div>';
  }
  setTimeout(()=>$('club42ChatText')?.focus(),80);
}
function closeChat(){if(dlg()?.open)dlg().close()}
async function onChatClosed(){
  stopHeartbeat();closeOverlays();await setPresence(false);
  if(openedFromHash&&location.hash==='#dashboard/chat')history.replaceState(null,'','#dashboard');
  openedFromHash=false;await refreshUnread();
}

function subscribeRealtime(){
  if(channel||!enabled||!app.currentUser)return;
  const userId=app.currentUser.id;
  channel=db.channel(`club42-director-chat-${userId}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'director_chat_messages'},payload=>{
      const row=payload.new;
      if(row.sender_id===app.currentUser?.id){if(dlg()?.open)appendMessage(row);return}
      if(chatIsOpen()){appendMessage(row);markReadThrough(row.created_at)}
      else{unreadCount++;updateBadge()}
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'director_chat_reads',filter:`user_id=eq.${userId}`},payload=>{
      if(payload.new?.last_read_at)lastReadAt=payload.new.last_read_at;
      if(chatIsOpen()){unreadCount=0;updateBadge()}else refreshUnread();
    })
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'director_chat_poll_votes'},payload=>{
      const row=payload.new;
      if(!pollVotes.some(v=>v.message_id===row.message_id&&v.user_id===row.user_id&&v.option_id===row.option_id)){
        pollVotes.push(row);rerenderPreserveScroll();
        if(pollInfoMessageId===row.message_id)openPollInfo(row.message_id);
      }
    })
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'director_chat_poll_votes'},payload=>{
      const row=payload.old;
      pollVotes=pollVotes.filter(v=>!(v.message_id===row.message_id&&v.user_id===row.user_id&&v.option_id===row.option_id));rerenderPreserveScroll();
      if(pollInfoMessageId===row.message_id)openPollInfo(row.message_id);
    })
    .subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('Chat realtime',status)});
}
async function unsubscribeRealtime(){if(!channel)return;const old=channel;channel=null;try{await db.removeChannel(old)}catch(error){console.warn('Chat unsubscribe',error)}}

async function disableChat(){
  if(enabled&&app.currentUser)await setPresence(false);
  enabled=false;$('club42ChatFab')?.setAttribute('hidden','');if(dlg()?.open)dlg().close();stopHeartbeat();
  if(unreadTimer){clearInterval(unreadTimer);unreadTimer=null}
  await unsubscribeRealtime();unreadCount=0;lastReadAt=null;messages=[];pollVotes=[];updateBadge();
}
function maybeOpenFromHash(){if(enabled&&location.hash==='#dashboard/chat')openChat({fromHash:true})}

export async function loadChatForRole(){
  if(!canChat()){await disableChat();return}
  enabled=true;$('club42ChatFab')?.removeAttribute('hidden');await ensureReadState();subscribeRealtime();await refreshUnread();
  if(!unreadTimer)unreadTimer=setInterval(()=>{if(enabled&&!chatIsOpen())refreshUnread()},UNREAD_REFRESH_MS);
  maybeOpenFromHash();
}

export function initChat(){
  if(initialized)return;initialized=true;ensureStyles();buildUi();

  $('club42ChatFab').onclick=()=>openChat();
  $('club42ChatClose').onclick=closeChat;
  $('club42ChatDlg').addEventListener('close',onChatClosed);
  $('club42ChatDlg').addEventListener('click',ev=>{if(ev.target===dlg())closeChat()});
  $('club42ChatForm').addEventListener('submit',sendMessage);
  $('club42ChatText').addEventListener('keydown',ev=>{if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();$('club42ChatForm').requestSubmit()}});
  $('club42ChatPollBtn').onclick=openPollComposer;
  $('club42ChatLinkBtn').onclick=openLinkComposer;
  $('club42ChatPollForm').addEventListener('submit',sendPoll);
  $('club42PollAddOption').onclick=()=>addPollOption();
  $('club42ChatLinkForm').addEventListener('submit',sendLink);
  $('club42LinkType').onchange=ev=>{selectedLinkItem=null;loadLinkPicker(ev.target.value)};
  $('club42LinkItem').onchange=ev=>renderLinkPreview(linkItems.find(x=>x.id===ev.target.value)||null,$('club42LinkType').value);
  document.querySelectorAll('[data-chat-overlay-close]').forEach(btn=>btn.onclick=()=>{
    $(btn.dataset.chatOverlayClose).hidden=true;
    if(btn.dataset.chatOverlayClose==='club42PollInfoPanel')pollInfoMessageId=null;
  });

  $('club42ChatMessages').addEventListener('click',ev=>{
    const info=ev.target.closest('[data-chat-info-message]');
    if(info)return openMessageInfo(info.dataset.chatInfoMessage);
    const pollInfo=ev.target.closest('[data-chat-poll-info]');
    if(pollInfo)return openPollInfo(pollInfo.dataset.chatPollInfo);
    const poll=ev.target.closest('[data-chat-poll-message]');
    if(poll)return togglePollVote(poll.dataset.chatPollMessage,poll.dataset.chatPollOption);
    const link=ev.target.closest('[data-chat-link-message]');
    if(link)return openLinkedMessage(link.dataset.chatLinkMessage);
  });

  window.addEventListener('hashchange',maybeOpenFromHash);
  document.addEventListener('visibilitychange',()=>{
    if(!enabled)return;
    if(dlg()?.open){
      if(document.visibilityState==='visible'){
        setPresence(true);startHeartbeat();
        const latest=messages.at(-1)?.created_at;if(latest)markReadThrough(latest);
      }else{stopHeartbeat();setPresence(false)}
    }else if(document.visibilityState==='visible')refreshUnread();
  });
  db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')disableChat()});
}
