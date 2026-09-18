import {$,app,db,LEGACY_KEY,esc,selected,list,fmtDate,badge,toast,syncStatus} from './core.js';
import {showView} from './router.js';

let eventContacts=[],eventContactLinks=[],eventCalendarCursor=new Date(),eventViewMode='manage';
const CLUB_CALENDAR_EMAIL='club42.laspezia@gmail.com';

function mapEvent(r){return{id:r.id,name:r.name,date:r.event_date,endDate:r.event_end_date||'',time:r.event_time?.slice(0,5)||'',endTime:r.event_end_time?.slice(0,5)||'',place:r.place||'',capacity:r.capacity||0,price:r.price??'',isFree:!!r.is_free,notes:r.notes||'',guestVisible:!!r.guest_visible,guestTeaser:!!r.guest_teaser,guestDescription:r.guest_description||'',googleCalendarAdded:!!r.google_calendar_added,googleCalendarAddedAt:r.google_calendar_added_at||''}}
function mapPerson(r){return{id:r.id,eventId:r.event_id,name:r.name,phone:r.phone||'',email:r.email||'',status:r.status,paid:r.paid?'yes':'no',member:r.member?'yes':'no',diet:r.dietary_requirements||'',notes:r.notes||'',createdAt:r.created_at}}

function eventDateLabel(e){return e?.endDate&&e.endDate!==e.date?`${fmtDate(e.date)} → ${fmtDate(e.endDate)}`:fmtDate(e?.date||'')}
function eventTimeLabel(e){
  if(e?.time&&e?.endTime)return `${e.time}–${e.endTime}`;
  if(e?.time)return e.time;
  if(e?.endTime)return `fine ${e.endTime}`;
  return '';
}
function eventPriceLabel(e){
  if(e?.isFree)return 'Gratuito';
  if(e?.price===null||e?.price===undefined||e?.price==='')return '';
  const n=Number(e.price);
  return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',minimumFractionDigits:n%1?2:0}).format(n);
}
function syncEventPriceControl(){
  const free=$('eFree')?.checked===true;
  if($('ePrice'))$('ePrice').disabled=free;
}
function syncEndDateMin(){
  const start=$('eDate')?.value||'';
  if(!$('eEndDate'))return;
  $('eEndDate').min=start;
  if(start&&$('eEndDate').value&&$('eEndDate').value<start)$('eEndDate').value='';
}

function addDaysIso(value,days){
  const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);
}
function datePartsInZone(date,timeZone='Europe/Rome'){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const get=t=>Number(parts.find(p=>p.type===t)?.value||0);
  return{year:get('year'),month:get('month'),day:get('day'),hour:get('hour'),minute:get('minute'),second:get('second')};
}
function zonedDateTime(date,time='00:00',timeZone='Europe/Rome'){
  const [y,m,d]=date.split('-').map(Number),[hh,mm]=time.split(':').map(Number);
  const wanted=Date.UTC(y,m-1,d,hh||0,mm||0,0);let guess=wanted;
  for(let i=0;i<4;i++){
    const p=datePartsInZone(new Date(guess),timeZone);
    const represented=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
    const delta=wanted-represented;guess+=delta;if(delta===0)break;
  }
  return new Date(guess);
}
function googleStamp(date){
  return date.toISOString().replace(/[-:]/g,'').replace('.000','');
}
function googleAllDayStamp(date){return String(date||'').replaceAll('-','')}
function googleCalendarUrl(e){
  const params=new URLSearchParams({action:'TEMPLATE',text:e.name,location:e.place||'',authuser:CLUB_CALENDAR_EMAIL,stz:'Europe/Rome',etz:'Europe/Rome'});
  let details=[e.guestDescription,e.notes].filter(Boolean).join('\n\n');
  if(e.isFree)details=[details,'Gratuito'].filter(Boolean).join('\n\n');

  if(e.time){
    const start=zonedDateTime(e.date,e.time);
    let end;
    if(e.endTime){
      let endDate=e.endDate||e.date;
      end=zonedDateTime(endDate,e.endTime);
      if(end<=start&&(!e.endDate||e.endDate===e.date))end=zonedDateTime(addDaysIso(e.date,1),e.endTime);
    }else if(e.endDate&&e.endDate!==e.date){
      end=zonedDateTime(e.endDate,'23:59');
      details=[details,'Nota: ora fine non specificata nel gestionale; verifica l’orario di fine prima di salvare.'].filter(Boolean).join('\n\n');
    }else{
      end=new Date(start.getTime()+60*60*1000);
      details=[details,'Nota: ora fine non specificata nel gestionale; Google Calendar propone 1 ora di durata. Verifica prima di salvare.'].filter(Boolean).join('\n\n');
    }
    params.set('dates',googleStamp(start)+'/'+googleStamp(end));
  }else{
    const endExclusive=addDaysIso(e.endDate||e.date,1);
    params.set('dates',googleAllDayStamp(e.date)+'/'+googleAllDayStamp(endExclusive));
    if(e.endTime)details=[details,'Ora fine indicata nel gestionale: '+e.endTime+'. L’evento viene aperto come giornata intera perché manca l’ora di inizio.'].filter(Boolean).join('\n\n');
  }

  if(details)params.set('details',details);
  return 'https://calendar.google.com/calendar/r/eventedit?'+params.toString();
}
function openGoogleCalendarEvent(id){
  const e=app.state.events.find(x=>x.id===id);if(!e)return;
  const win=window.open(googleCalendarUrl(e),'_blank','noopener,noreferrer');
  if(!win)toast('Il browser ha bloccato l’apertura di Google Calendar.');
  else toast('Bozza aperta nel Google Calendar Club42. Dopo averla salvata, spunta “Inserito”.');
}
async function setEventCalendarAdded(id,value){
  const e=app.state.events.find(x=>x.id===id);if(!e)return;
  const {error}=await db.from('events').update({google_calendar_added:!!value,updated_at:new Date().toISOString()}).eq('id',id);
  if(error){toast(error.message);return}
  e.googleCalendarAdded=!!value;
  e.googleCalendarAddedAt=value?new Date().toISOString():'';
  toast(value?'Evento segnato come inserito nel Google Calendar':'Evento segnato come non inserito nel Google Calendar');
  render();
}

function ensureEventContactsField(){
 if($('eContacts'))return;
 const notes=$('eNotes')?.closest('.field');
 if(!notes)return;
 notes.insertAdjacentHTML('beforebegin',`<div class="field full"><label>Collaboratori / contatti</label><select id="eContacts" class="event-contact-select" multiple></select><div class="event-contact-hint">Seleziona uno o più contatti della rubrica. Il collegamento alimenta automaticamente lo storico collaborazioni.</div></div>`);
}
function ensureGuestFields(){
 if($('eGuestVisible'))return;
 const notes=$('eNotes')?.closest('.field');
 if(!notes)return;
 notes.insertAdjacentHTML('afterend',`<div class="field full guest-event-settings"><label>Pagina guest / area soci</label><label class="guest-visibility-check"><input id="eGuestVisible" type="checkbox"> Pubblica l'evento completo ai soci</label><label class="guest-visibility-check"><input id="eGuestTeaser" type="checkbox"> Mostra come “Prossimamente”</label><div class="guest-setting-hint">Le due modalità sono alternative. “Prossimamente” mostra soltanto titolo e descrizione, senza data, ora, luogo, prezzo, calendario o iscrizione.</div><label>Descrizione per i soci</label><textarea id="eGuestDescription" rows="3" placeholder="Testo pubblico dell'evento. Le note interne sopra non verranno mai mostrate ai Guest."></textarea></div>`);
}
function fillEventContacts(){const el=$('eContacts');if(!el)return;el.innerHTML=eventContacts.map(c=>`<option value="${c.id}">${esc(c.name)}${c.organization?' · '+esc(c.organization):''}${c.active?'':' · archiviato'}</option>`).join('')}
function setEventContactSelection(eventId){const el=$('eContacts');if(!el)return;const ids=new Set(eventId?eventContactLinks.filter(x=>x.event_id===eventId).map(x=>x.contact_id):[]);[...el.options].forEach(o=>o.selected=ids.has(o.value))}

function ensureEventCalendarUi(){
  const view=$('view-events'),grid=view?.querySelector('.module-grid');
  if(!view||!grid||$('eventCalendarPanel'))return;
  grid.id='eventManagementPanel';
  grid.insertAdjacentHTML('beforebegin',`
    <div class="event-view-tabs">
      <button class="event-view-tab active" type="button" data-event-view="manage">Gestione</button>
      <button class="event-view-tab" type="button" data-event-view="calendar">Calendario</button>
    </div>
    <section class="card event-calendar-panel" id="eventCalendarPanel" hidden>
      <div class="event-calendar-toolbar">
        <div><div class="panel-kicker">Programma Club42</div><h3>Vista mensile</h3></div>
        <div class="event-month-nav">
          <button class="icon-btn" id="eventPrevMonth" type="button" aria-label="Mese precedente">‹</button>
          <b id="eventMonthLabel"></b>
          <button class="icon-btn" id="eventNextMonth" type="button" aria-label="Mese successivo">›</button>
          <button class="btn" id="eventToday" type="button">Oggi</button>
        </div>
      </div>
      <div class="event-calendar-weekdays"><span>Lun</span><span>Mar</span><span>Mer</span><span>Gio</span><span>Ven</span><span>Sab</span><span>Dom</span></div>
      <div class="event-calendar-grid" id="eventCalendarGrid"></div>
    </section>`);

  view.querySelectorAll('[data-event-view]').forEach(btn=>btn.addEventListener('click',()=>showEventView(btn.dataset.eventView)));
  $('eventPrevMonth').onclick=()=>{eventCalendarCursor=new Date(eventCalendarCursor.getFullYear(),eventCalendarCursor.getMonth()-1,1);renderEventCalendar()};
  $('eventNextMonth').onclick=()=>{eventCalendarCursor=new Date(eventCalendarCursor.getFullYear(),eventCalendarCursor.getMonth()+1,1);renderEventCalendar()};
  $('eventToday').onclick=()=>{eventCalendarCursor=new Date();renderEventCalendar()};
  showEventView(eventViewMode);
}
function showEventView(mode='manage'){
  eventViewMode=mode==='calendar'?'calendar':'manage';
  const calendar=$('eventCalendarPanel'),management=$('eventManagementPanel');
  if(calendar){
    const visible=eventViewMode==='calendar';
    calendar.hidden=!visible;
    calendar.style.display=visible?'':'none';
  }
  if(management){
    const visible=eventViewMode==='manage';
    management.hidden=!visible;
    management.style.display=visible?'':'none';
  }
  document.querySelectorAll('[data-event-view]').forEach(btn=>btn.classList.toggle('active',btn.dataset.eventView===eventViewMode));
  if(eventViewMode==='calendar')renderEventCalendar();
}
function eventOccursOn(e,key){
  const end=e.endDate||e.date;
  return !!e.date&&e.date<=key&&key<=end;
}
function renderEventCalendar(){
  const root=$('eventCalendarGrid');if(!root)return;
  const y=eventCalendarCursor.getFullYear(),m=eventCalendarCursor.getMonth();
  const first=new Date(y,m,1),last=new Date(y,m+1,0);
  $('eventMonthLabel').textContent=new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(first);
  const start=(first.getDay()+6)%7,total=Math.ceil((start+last.getDate())/7)*7;
  const tp=datePartsInZone(new Date(),'Europe/Rome'),today=`${tp.year}-${String(tp.month).padStart(2,'0')}-${String(tp.day).padStart(2,'0')}`;
  let html='';
  for(let i=0;i<total;i++){
    const day=i-start+1;
    if(day<1||day>last.getDate()){html+='<div class="event-cal-day outside"></div>';continue}
    const key=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const rows=app.state.events.filter(e=>eventOccursOn(e,key)).sort((a,b)=>(a.time||'').localeCompare(b.time||'')||a.name.localeCompare(b.name,'it'));
    html+=`<div class="event-cal-day ${key===today?'today':''}"><div class="event-cal-day-num">${day}</div><div class="event-cal-items">${rows.map(e=>{
      const starts=e.date===key,ends=(e.endDate||e.date)===key,multi=(e.endDate||e.date)!==e.date;
      const phase=!multi?'':starts?' start':ends?' end':' middle';
      const time=starts&&e.time?e.time+' · ':'';
      return `<button type="button" class="event-cal-item${phase} ${e.googleCalendarAdded?'calendar-synced':''}" onclick="openEventFromCalendar('${e.id}')"><span>${esc(time)}${multi&&!starts?'↳ ':''}</span><b>${esc(e.name)}</b></button>`;
    }).join('')}</div></div>`;
  }
  root.innerHTML=html;
}
async function openEventFromCalendar(id){
  const e=app.state.events.find(x=>x.id===id);
  if(e){
    const d=new Date(e.date+'T12:00:00');
    eventCalendarCursor=new Date(d.getFullYear(),d.getMonth(),1);
  }
  await selectEvent(id,false);
  showEventView('manage');
}
async function refreshEventContactData(){const [cr,hr]=await Promise.all([db.rpc('club42_event_contact_directory'),db.rpc('club42_event_contact_links')]);if(cr.error||hr.error){console.error(cr.error||hr.error);return}eventContacts=cr.data||[];eventContactLinks=hr.data||[];fillEventContacts();if($('eventDlg')?.open)setEventContactSelection(app.editEventId);render()}
async function syncEventContacts(eventId,base){
 const el=$('eContacts');if(!el)return;
 const selectedIds=[...el.selectedOptions].map(o=>o.value);
 const {error}=await db.rpc('club42_sync_event_contacts',{p_event_id:eventId,p_contact_ids:selectedIds,p_title:base.name,p_collaboration_date:base.event_date});
 if(error)throw error;
}

export async function loadRemote(){
  syncStatus('loading','Sincronizzazione…');
  const [er,pr,cr,hr]=await Promise.all([db.from('events').select('*').order('event_date'),db.from('event_registrations').select('*'),db.rpc('club42_event_contact_directory'),db.rpc('club42_event_contact_links')]);
  if(er.error||pr.error||cr.error||hr.error){console.error(er.error||pr.error||cr.error||hr.error);syncStatus('error','Errore DB');toast('Errore nel caricamento dati');return}
  app.state.events=(er.data||[]).map(mapEvent);app.state.people=(pr.data||[]).map(mapPerson);eventContacts=cr.data||[];eventContactLinks=hr.data||[];fillEventContacts();
  if(!app.state.events.some(e=>e.id===app.state.selected))app.state.selected=app.state.events[0]?.id||null;
  syncStatus('ok','Sincronizzato');render();await offerLegacyImport();
}

async function offerLegacyImport(){
  if(app.state.events.length)return;
  let old;try{old=JSON.parse(localStorage.getItem(LEGACY_KEY)||'null')}catch{}
  if(!old?.events?.length||localStorage.getItem(LEGACY_KEY+'_migrated'))return;
  if(!confirm(`Ho trovato ${old.events.length} eventi salvati in questo browser. Vuoi importarli nel database condiviso?`)){localStorage.setItem(LEGACY_KEY+'_migrated','declined');return}
  const idMap={};
  for(const e of old.events){
    const legacyFree=e.price!==''&&Number(e.price)===0;const {data,error}=await db.from('events').insert({name:e.name,event_date:e.date,event_end_date:null,event_time:e.time||null,event_end_time:null,place:e.place||null,capacity:Number(e.capacity)||0,price:legacyFree?null:(e.price===''?null:Number(e.price)),is_free:legacyFree,notes:e.notes||null,created_by:app.currentUser.id}).select('id').single();
    if(error)return toast('Importazione interrotta');idMap[e.id]=data.id;
  }
  for(const p of old.people||[]){if(!idMap[p.eventId])continue;await db.from('event_registrations').insert({event_id:idMap[p.eventId],name:p.name,phone:p.phone||null,email:p.email||null,status:p.status||'confirmed',paid:p.paid==='yes',member:p.member==='yes',dietary_requirements:p.diet||null,notes:p.notes||null,created_by:app.currentUser.id})}
  localStorage.setItem(LEGACY_KEY+'_migrated',new Date().toISOString());toast('Dati locali importati');await loadRemote();
}

function renderDashboard(){
  const confirmed=app.state.people.filter(p=>p.status==='confirmed');
  $('dashEvents').textContent=app.state.events.length;$('dashPeople').textContent=confirmed.length;$('dashPaid').textContent=confirmed.filter(p=>p.paid==='yes').length;$('dashMembers').textContent=confirmed.filter(p=>p.member==='yes').length;
  const today=new Date().toISOString().slice(0,10);const next=app.state.events.filter(e=>(e.endDate||e.date)>=today).sort((a,b)=>a.date.localeCompare(b.date))[0]||app.state.events.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];const box=$('nextEventBox');
  if(!next){box.innerHTML='<div class="empty">Nessun evento presente. Creane uno per iniziare.</div>';return}
  const dt=new Date(next.date+'T12:00:00'),day=String(dt.getDate()).padStart(2,'0'),month=dt.toLocaleDateString('it-IT',{month:'short'}).replace('.','').toUpperCase(),n=list(next.id).filter(p=>p.status==='confirmed').length;
  const when=[eventDateLabel(next),eventTimeLabel(next)].filter(Boolean).join(' · ');box.innerHTML=`<div class="upcoming-event"><div class="date-tile"><div><b>${day}</b><span>${month}</span></div></div><div><h4>${esc(next.name)}</h4><p>${esc(when)}${when?' · ':''}${esc(next.place||'Luogo da definire')}<br>${next.capacity?`${n}/${next.capacity} posti occupati`:`${n} confermati`}</p></div><button class="btn" onclick="selectEvent('${next.id}',true)">Gestisci</button></div>`;
}

export function render(){
  const e=selected();if(e&&!app.state.selected)app.state.selected=e.id;
  renderEventCalendar();
  $('events').innerHTML=app.state.events.length?app.state.events.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(x=>{const n=list(x.id).filter(p=>p.status==='confirmed').length;const guestBadge=x.guestTeaser?'<span class="event-guest-badge teaser">◌ Prossimamente</span>':x.guestVisible?'<span class="event-guest-badge">● Pagina soci</span>':'';const time=eventTimeLabel(x),price=eventPriceLabel(x);return `<div class="event-card ${x.id===app.state.selected?'active':''}" onclick="selectEvent('${x.id}')"><div class="event-card-title">${esc(x.name)}${guestBadge}</div><div class="event-card-meta">${esc(eventDateLabel(x))}${time?' · '+esc(time):''}<br>${esc(x.place||'Luogo da definire')}<br>${price?esc(price)+' · ':''}${x.capacity?`${n}/${x.capacity} posti`:`${n} confermati`}</div><div class="event-calendar-row" onclick="event.stopPropagation()"><button class="event-calendar-open" type="button" onclick="openGoogleCalendarEvent('${x.id}')" title="Apri una bozza precompilata nel Google Calendar Club42">G&nbsp; Calendar</button><label class="event-calendar-check ${x.googleCalendarAdded?'done':''}"><input type="checkbox" ${x.googleCalendarAdded?'checked':''} onchange="setEventCalendarAdded('${x.id}',this.checked)"> <span>${x.googleCalendarAdded?'Inserito':'Da inserire'}</span></label></div><div class="event-card-actions"><button class="icon-btn" onclick="event.stopPropagation();openEvent('${x.id}')">✎</button><button class="icon-btn" onclick="event.stopPropagation();deleteEvent('${x.id}')">×</button></div></div>`}).join(''):'<div class="empty">Nessun evento.</div>';
  renderDashboard();
  if(!e){$('eventName').textContent='Nessun evento';$('eventMeta').textContent='Crea un evento per iniziare.';$('people').innerHTML='<tr><td colspan="7" class="empty">Nessun evento selezionato.</td></tr>';['sConfirmed','sWait','sPaid','sMembers'].forEach(id=>$(id).textContent='0');return}
  const collaborators=eventContactLinks.filter(x=>x.event_id===e.id).length;
  const guestState=e.guestTeaser?' · prossimamente ai soci':e.guestVisible?' · visibile ai soci':'';
  const timeLabel=eventTimeLabel(e),priceLabel=eventPriceLabel(e),calendarState=e.googleCalendarAdded?' · Calendar Club42 ✓':' · Calendar da inserire';$('eventName').textContent=e.name;$('eventMeta').textContent=`${eventDateLabel(e)}${timeLabel?' · '+timeLabel:''}${e.place?' · '+e.place:''}${priceLabel?' · '+priceLabel:''}${e.capacity?' · capienza '+e.capacity:''}${collaborators?' · '+collaborators+' collaboratori':''}${guestState}${calendarState}`;
  const pp=list(e.id),confirmed=pp.filter(p=>p.status==='confirmed');$('sConfirmed').textContent=confirmed.length+(e.capacity?' / '+e.capacity:'');$('sWait').textContent=pp.filter(p=>p.status==='waitlist').length;$('sPaid').textContent=confirmed.filter(p=>p.paid==='yes').length;$('sMembers').textContent=confirmed.filter(p=>p.member==='yes').length;renderPeople();
}

export function renderPeople(){
  const e=selected();if(!e)return;const q=$('search').value.toLowerCase().trim(),sf=$('statusFilter').value;let pp=list(e.id);if(sf!=='all')pp=pp.filter(p=>p.status===sf);if(q)pp=pp.filter(p=>[p.name,p.phone,p.email,p.notes,p.diet].some(v=>(v||'').toLowerCase().includes(q)));pp.sort((a,b)=>a.name.localeCompare(b.name,'it'));
  $('people').innerHTML=pp.length?pp.map(p=>`<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.phone||'')}${p.phone&&p.email?'<br>':''}${esc(p.email||'')}</td><td>${badge(p.status)}</td><td>${p.member==='yes'?'<span class="badge ok">Socio</span>':'<span class="badge off">No</span>'}</td><td>${p.paid==='yes'?'<span class="badge ok">Pagato</span>':'<span class="badge warn">Da pagare</span>'}</td><td>${p.diet?`🍽 ${esc(p.diet)}<br>`:''}<span class="muted">${esc(p.notes||'')}</span></td><td><div class="row"><button class="icon-btn" onclick="openPerson('${p.id}')">✎</button><button class="icon-btn" onclick="deletePerson('${p.id}')">×</button></div></td></tr>`).join(''):'<tr><td colspan="7" class="empty">Nessun iscritto trovato.</td></tr>';
}

export async function selectEvent(id,openView=false){app.state.selected=id;render();await showView('events',{eventId:id});if(openView)document.body.classList.remove('sidebar-open')}
export async function applyEventRoute(eventId){if(eventId&&app.state.events.some(e=>e.id===eventId)){app.state.selected=eventId;render()}else if(app.state.selected){const wanted=`#events/${app.state.selected}`;if(location.hash==='#events')history.replaceState(null,'',wanted)}}

function openEvent(id=null){app.editEventId=id;const e=id?app.state.events.find(x=>x.id===id):null;$('eventDlgTitle').textContent=e?'Modifica evento':'Nuovo evento';$('eName').value=e?.name||'';$('eDate').value=e?.date||'';$('eEndDate').value=e?.endDate||'';$('eTime').value=e?.time||'';$('eEndTime').value=e?.endTime||'';$('ePlace').value=e?.place||'';$('eCapacity').value=e?.capacity??0;$('ePrice').value=e?.price??'';$('eFree').checked=!!e?.isFree;syncEventPriceControl();syncEndDateMin();$('eNotes').value=e?.notes||'';$('eGuestVisible').checked=!!e?.guestVisible;$('eGuestTeaser').checked=!!e?.guestTeaser;$('eGuestDescription').value=e?.guestDescription||'';fillEventContacts();setEventContactSelection(id);$('eventDlg').showModal()}
async function deleteEvent(id){const e=app.state.events.find(x=>x.id===id);if(!e||!confirm(`Eliminare “${e.name}” e tutte le relative iscrizioni? Lo storico delle collaborazioni resterà conservato.`))return;const {error}=await db.from('events').delete().eq('id',id);if(error)return toast(error.message);toast('Evento eliminato');await loadRemote()}
function openPerson(id=null){const e=selected();if(!e){openEvent();return}app.editPersonId=id;const p=id?app.state.people.find(x=>x.id===id):null;$('personDlgTitle').textContent=p?'Modifica iscritto':'Aggiungi iscritto';$('pName').value=p?.name||'';$('pPhone').value=p?.phone||'';$('pEmail').value=p?.email||'';$('pStatus').value=p?.status||'confirmed';$('pPaid').value=p?.paid||'no';$('pMember').value=p?.member||'no';$('pDiet').value=p?.diet||'';$('pNotes').value=p?.notes||'';$('personDlg').showModal()}
async function deletePerson(id){const p=app.state.people.find(x=>x.id===id);if(!p||!confirm(`Eliminare ${p.name}?`))return;const {error}=await db.from('event_registrations').delete().eq('id',id);if(error)return toast(error.message);toast('Iscritto eliminato');await loadRemote()}

export function initEvents(){
  ensureEventContactsField();ensureGuestFields();ensureEventCalendarUi();document.addEventListener('club42:contacts-changed',refreshEventContactData);
  $('eGuestVisible').onchange=()=>{if($('eGuestVisible').checked)$('eGuestTeaser').checked=false};
  $('eGuestTeaser').onchange=()=>{if($('eGuestTeaser').checked)$('eGuestVisible').checked=false};
  $('eFree').onchange=syncEventPriceControl;
  $('eDate').onchange=syncEndDateMin;
  window.selectEvent=selectEvent;window.openEvent=openEvent;window.deleteEvent=deleteEvent;window.openPerson=openPerson;window.deletePerson=deletePerson;window.openGoogleCalendarEvent=openGoogleCalendarEvent;window.setEventCalendarAdded=setEventCalendarAdded;window.openEventFromCalendar=openEventFromCalendar;
  $('eventForm').addEventListener('submit',async ev=>{ev.preventDefault();const startDate=$('eDate').value,endDate=$('eEndDate').value||null;if(endDate&&endDate<startDate)return toast('La data fine non può essere precedente alla data inizio');const isFree=$('eFree').checked;const base={name:$('eName').value.trim(),event_date:startDate,event_end_date:endDate,event_time:$('eTime').value||null,event_end_time:$('eEndTime').value||null,place:$('ePlace').value.trim()||null,capacity:Number($('eCapacity').value)||0,price:isFree?null:($('ePrice').value===''?null:Number($('ePrice').value)),is_free:isFree,notes:$('eNotes').value.trim()||null,guest_visible:$('eGuestVisible').checked,guest_teaser:$('eGuestTeaser').checked,guest_description:$('eGuestDescription').value.trim()||null};let result;if(app.editEventId)result=await db.from('events').update({...base,updated_at:new Date().toISOString()}).eq('id',app.editEventId).select('id').single();else result=await db.from('events').insert({...base,created_by:app.currentUser.id}).select('id').single();if(result.error)return toast(result.error.message);try{await syncEventContacts(result.data.id,base)}catch(error){console.error(error);return toast('Evento salvato, ma errore nel collegamento collaboratori')}$('eventDlg').close();toast(app.editEventId?'Evento aggiornato':'Evento creato');await loadRemote()});
  $('personForm').addEventListener('submit',async ev=>{ev.preventDefault();const e=selected();const base={event_id:e.id,name:$('pName').value.trim(),phone:$('pPhone').value.trim()||null,email:$('pEmail').value.trim()||null,status:$('pStatus').value,paid:$('pPaid').value==='yes',member:$('pMember').value==='yes',dietary_requirements:$('pDiet').value.trim()||null,notes:$('pNotes').value.trim()||null};let result;if(app.editPersonId)result=await db.from('event_registrations').update({...base,updated_at:new Date().toISOString()}).eq('id',app.editPersonId);else result=await db.from('event_registrations').insert({...base,created_by:app.currentUser.id});if(result.error)return toast(result.error.message);$('personDlg').close();toast(app.editPersonId?'Iscritto aggiornato':'Iscritto aggiunto');await loadRemote()});
  ['globalNewEvent','heroNewEvent','quickEvent','sideNewEvent'].forEach(id=>$(id).onclick=()=>openEvent());['addPerson','quickPerson'].forEach(id=>$(id).onclick=()=>openPerson());$('search').oninput=renderPeople;$('statusFilter').onchange=renderPeople;
}
