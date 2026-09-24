import {$,app,db,LEGACY_KEY,download,esc,selected,list,fmtDate,badge,toast,syncStatus} from './core.js';
import {showView} from './router.js';

let eventContacts=[],eventContactLinks=[],eventCalendarCursor=new Date(),eventViewMode='manage',eventContactDraft=new Set();
let eventDetailMode='hub',eventDayFilter='all',eventRealtimeChannel=null;
let eventHubData={tasks:[],projects:[],social:[],cash:[]};
const CLUB_CALENDAR_EMAIL='club42.laspezia@gmail.com';

function mapEvent(r){return{id:r.id,name:r.name,date:r.event_date,endDate:r.event_end_date||'',time:r.event_time?.slice(0,5)||'',endTime:r.event_end_time?.slice(0,5)||'',eventStatus:r.event_status||'active',place:r.place||'',capacity:r.capacity||0,price:r.price??'',isFree:!!r.is_free,notes:r.notes||'',guestVisible:!!r.guest_visible,guestTeaser:!!r.guest_teaser,guestDescription:r.guest_description||'',googleCalendarAdded:!!r.google_calendar_added,googleCalendarAddedAt:r.google_calendar_added_at||''}}
function mapPerson(r){return{id:r.id,eventId:r.event_id,name:r.name,phone:r.phone||'',email:r.email||'',status:r.status,paid:r.paid?'yes':'no',member:r.member?'yes':'no',attended:!!r.attended,checkedInAt:r.checked_in_at||'',checkedInBy:r.checked_in_by||'',diet:r.dietary_requirements||'',notes:r.notes||'',createdAt:r.created_at}}
function isEndedEvent(e){return e?.eventStatus==='ended'}
function activeEvents(){return app.state.events.filter(e=>!isEndedEvent(e))}
function historicalEvents(){return app.state.events.filter(isEndedEvent)}
function selectedEvent(){return app.state.events.find(e=>e.id===app.state.selected)||null}
function eventsForView(mode=eventViewMode){return mode==='history'?historicalEvents():activeEvents()}
function syncEventSelectionForView(mode=eventViewMode){
  if(mode==='calendar')return;
  const rows=eventsForView(mode).slice().sort((a,b)=>mode==='history'?b.date.localeCompare(a.date):a.date.localeCompare(b.date));
  if(!rows.some(e=>e.id===app.state.selected))app.state.selected=rows[0]?.id||null;
}

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
function icsEscape(v=''){return String(v).replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;')}
function icsDate(value){return String(value).replaceAll('-','')}
function icsTime(value){return String(value||'').slice(0,5).replace(':','')+'00'}
function calendarFileName(e){
  const slug=String(e.name||'evento').toLowerCase().replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||'evento';
  return `club42-${e.date}-${slug}.ics`;
}
function openGoogleCalendarEvent(id){
  const e=app.state.events.find(x=>x.id===id);if(!e||!e.date)return;

  const start=e.time
    ? `DTSTART;TZID=Europe/Rome:${icsDate(e.date)}T${icsTime(e.time)}`
    : `DTSTART;VALUE=DATE:${icsDate(e.date)}`;

  const lines=[
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Club42//Gestionale//IT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${e.id}@club42`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,
    start,
    `SUMMARY:${icsEscape(e.name)}`
  ];

  if(e.time&&e.endTime){
    lines.push(`DTEND;TZID=Europe/Rome:${icsDate(e.endDate||e.date)}T${icsTime(e.endTime)}`);
  }else if(!e.time){
    lines.push(`DTEND;VALUE=DATE:${icsDate(addDaysIso(e.endDate||e.date,1))}`);
  }

  if(e.place)lines.push(`LOCATION:${icsEscape(e.place)}`);
  const description=[e.guestDescription,e.notes].filter(Boolean).join('\n\n');
  if(description)lines.push(`DESCRIPTION:${icsEscape(description)}`);

  lines.push('END:VEVENT','END:VCALENDAR');
  download(calendarFileName(e),lines.join('\r\n'),'text/calendar;charset=utf-8');
  toast('File calendario creato. Aprilo con Google Calendar e premi Salva.');
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
  notes.insertAdjacentHTML('beforebegin',`
    <div class="field full event-contact-field">
      <label>Collaboratori / contatti</label>
      <select id="eContacts" multiple hidden aria-hidden="true"></select>
      <div class="event-contact-picker">
        <div class="event-contact-selected-box" id="eContactSelected"></div>
        <button class="btn event-contact-open" id="eContactOpen" type="button">＋ Seleziona collaboratori</button>
      </div>
      <div class="event-contact-hint">Qui compaiono solo i collaboratori selezionati. Il collegamento alimenta automaticamente lo storico collaborazioni.</div>
    </div>`);
  $('eContactOpen').onclick=openEventContactPicker;
}
function ensureGuestFields(){
 if($('eGuestVisible'))return;
 const notes=$('eNotes')?.closest('.field');
 if(!notes)return;
 notes.insertAdjacentHTML('afterend',`<div class="field full guest-event-settings"><label>Pagina guest / area soci</label><label class="guest-visibility-check"><input id="eGuestVisible" type="checkbox"> Pubblica l'evento completo ai soci</label><label class="guest-visibility-check"><input id="eGuestTeaser" type="checkbox"> Mostra come “Prossimamente”</label><div class="guest-setting-hint">Le due modalità sono alternative. “Prossimamente” mostra soltanto titolo e descrizione, senza data, ora, luogo, prezzo, calendario o iscrizione.</div><label>Descrizione per i soci</label><textarea id="eGuestDescription" rows="3" placeholder="Testo pubblico dell'evento. Le note interne sopra non verranno mai mostrate ai Guest."></textarea></div>`);
}
function selectedEventContactIds(){
  const el=$('eContacts');
  return new Set(el?[...el.selectedOptions].map(o=>String(o.value)):[]);
}
function renderSelectedEventContacts(){
  const root=$('eContactSelected');if(!root)return;
  const ids=selectedEventContactIds();
  const chosen=eventContacts
    .filter(c=>ids.has(String(c.id)))
    .sort((a,b)=>(a.name||'').localeCompare(b.name||'','it'));
  if(!chosen.length){
    root.innerHTML='<div class="event-contact-empty">Nessun collaboratore selezionato</div>';
    return;
  }
  root.innerHTML=chosen.map(c=>`
    <div class="event-contact-chip">
      <div class="event-contact-chip-copy">
        <b>${esc(c.name)}</b>
        ${c.organization?`<span>${esc(c.organization)}</span>`:''}
      </div>
      <button type="button" data-remove-contact="${c.id}" aria-label="Rimuovi ${esc(c.name)}">×</button>
    </div>`).join('');
  root.querySelectorAll('[data-remove-contact]').forEach(btn=>btn.onclick=()=>{
    const option=[...$('eContacts').options].find(o=>o.value===btn.dataset.removeContact);
    if(option)option.selected=false;
    renderSelectedEventContacts();
  });
}
function fillEventContacts(){
  const el=$('eContacts');if(!el)return;
  const current=selectedEventContactIds();
  el.innerHTML=eventContacts.map(c=>`<option value="${c.id}">${esc(c.name)}${c.organization?' · '+esc(c.organization):''}${c.active?'':' · archiviato'}</option>`).join('');
  [...el.options].forEach(o=>o.selected=current.has(String(o.value)));
  renderSelectedEventContacts();
}
function setEventContactSelection(eventId){
  const el=$('eContacts');if(!el)return;
  const ids=new Set(eventId?eventContactLinks.filter(x=>x.event_id===eventId).map(x=>String(x.contact_id)):[]);
  [...el.options].forEach(o=>o.selected=ids.has(String(o.value)));
  renderSelectedEventContacts();
}
function ensureEventContactPickerDialog(){
  if($('eventContactsDlg'))return;
  document.body.insertAdjacentHTML('beforeend',`
    <dialog id="eventContactsDlg" class="event-contacts-dialog">
      <div class="modal event-contact-modal">
        <div class="modal-head">
          <div>
            <h3>Seleziona collaboratori</h3>
            <p class="event-contact-modal-subtitle">Cerca nella rubrica e scegli uno o più contatti.</p>
          </div>
          <button type="button" class="close" id="eventContactsClose" aria-label="Chiudi">×</button>
        </div>
        <div class="event-contact-search">
          <input id="eventContactSearch" type="search" placeholder="🔎 Cerca nome o organizzazione…" autocomplete="off">
          <span id="eventContactCount">0 selezionati</span>
        </div>
        <div class="event-contact-options" id="eventContactOptions"></div>
        <div class="modal-actions event-contact-modal-actions">
          <button type="button" class="btn" id="eventContactsCancel">Annulla</button>
          <button type="button" class="btn primary" id="eventContactsApply">Conferma selezione</button>
        </div>
      </div>
    </dialog>`);
  $('eventContactSearch').oninput=renderEventContactPicker;
  $('eventContactsCancel').onclick=()=>$('eventContactsDlg').close();
  $('eventContactsClose').onclick=()=>$('eventContactsDlg').close();
  $('eventContactsApply').onclick=applyEventContactPicker;
}
function renderEventContactPicker(){
  const root=$('eventContactOptions');if(!root)return;
  const q=($('eventContactSearch')?.value||'').trim().toLocaleLowerCase('it');
  const rows=eventContacts
    .filter(c=>!q||[c.name,c.organization].some(v=>String(v||'').toLocaleLowerCase('it').includes(q)))
    .sort((a,b)=>{
      const aSelected=eventContactDraft.has(String(a.id))?0:1;
      const bSelected=eventContactDraft.has(String(b.id))?0:1;
      return aSelected-bSelected||(a.name||'').localeCompare(b.name||'','it');
    });
  if($('eventContactCount'))$('eventContactCount').textContent=`${eventContactDraft.size} ${eventContactDraft.size===1?'selezionato':'selezionati'}`;
  root.innerHTML=rows.length?rows.map(c=>{
    const id=String(c.id),checked=eventContactDraft.has(id);
    return `
      <label class="event-contact-option ${checked?'selected':''}">
        <input type="checkbox" value="${esc(id)}" ${checked?'checked':''}>
        <span class="event-contact-option-check">✓</span>
        <span class="event-contact-option-copy">
          <b>${esc(c.name)}</b>
          <small>${c.organization?esc(c.organization):'Nessuna organizzazione'}${c.active?'':' · Archiviato'}</small>
        </span>
      </label>`;
  }).join(''):'<div class="event-contact-no-results">Nessun collaboratore trovato.</div>';
  root.querySelectorAll('input[type="checkbox"]').forEach(input=>input.onchange=()=>{
    if(input.checked)eventContactDraft.add(input.value);else eventContactDraft.delete(input.value);
    input.closest('.event-contact-option')?.classList.toggle('selected',input.checked);
    if($('eventContactCount'))$('eventContactCount').textContent=`${eventContactDraft.size} ${eventContactDraft.size===1?'selezionato':'selezionati'}`;
  });
}
function openEventContactPicker(){
  ensureEventContactPickerDialog();
  eventContactDraft=selectedEventContactIds();
  $('eventContactSearch').value='';
  renderEventContactPicker();
  try{
    $('eventContactsDlg').showModal();
    setTimeout(()=>$('eventContactSearch')?.focus(),40);
  }catch(error){
    console.error(error);
    toast('Non è stato possibile aprire la selezione collaboratori.');
  }
}
function applyEventContactPicker(){
  const el=$('eContacts');if(!el)return;
  [...el.options].forEach(o=>o.selected=eventContactDraft.has(String(o.value)));
  renderSelectedEventContacts();
  if($('eventContactsDlg')?.open)$('eventContactsDlg').close();
}

function ensureEventDetailUi(){
  if($('eventDetailTabs'))return;
  const main=$('eventManagementPanel')?.querySelector('.event-main');
  const hero=main?.querySelector('.event-hero');
  const peoplePanel=$('people')?.closest('section.card.panel');
  if(!main||!hero||!peoplePanel)return;

  peoplePanel.id='eventPeoplePanel';
  const stats=hero.querySelector('.event-stats');
  if(stats&&!$('sPresent'))stats.insertAdjacentHTML('beforeend','<div class="event-stat"><span>✓ Presenti</span><b id="sPresent">0</b></div>');

  hero.insertAdjacentHTML('afterend',`
    <div class="event-detail-tabs" id="eventDetailTabs">
      <button type="button" class="event-detail-tab active" data-event-detail="hub">Hub evento</button>
      <button type="button" class="event-detail-tab" data-event-detail="people">Iscritti</button>
      <button type="button" class="event-detail-tab event-day-tab" data-event-detail="day">✓ Modalità evento</button>
    </div>`);

  peoplePanel.insertAdjacentHTML('beforebegin',`
    <section class="event-hub-panel" id="eventHubPanel">
      <div class="event-hub-actions">
        <button type="button" class="btn" id="eventHubEdit">✎ Modifica evento</button>
        <button type="button" class="btn" id="eventHubAddPerson">＋ Iscritto</button>
        <button type="button" class="btn primary" id="eventHubOpenDay">✓ Modalità evento</button>
      </div>
      <div id="eventHubSummary" class="event-hub-summary"></div>
      <div class="event-hub-grid">
        <section class="card event-hub-card"><div class="event-hub-card-head"><span>◇</span><div><b>Progetti</b><small>Progetti collegati all'evento</small></div></div><div id="eventHubProjects"></div></section>
        <section class="card event-hub-card"><div class="event-hub-card-head"><span>✓</span><div><b>Task</b><small>Attività operative dell'evento</small></div></div><div id="eventHubTasks"></div></section>
        <section class="card event-hub-card"><div class="event-hub-card-head"><span>◎</span><div><b>Social</b><small>Contenuti editoriali collegati</small></div></div><div id="eventHubSocial"></div></section>
        <section class="card event-hub-card"><div class="event-hub-card-head"><span>€</span><div><b>Cassa</b><small>Movimenti economici collegati</small></div></div><div id="eventHubCash"></div></section>
        <section class="card event-hub-card"><div class="event-hub-card-head"><span>☏</span><div><b>Collaboratori</b><small>Contatti coinvolti nell'evento</small></div></div><div id="eventHubContacts"></div></section>
        <section class="card event-hub-card event-hub-notes-card"><div class="event-hub-card-head"><span>≡</span><div><b>Note evento</b><small>Promemoria interni</small></div></div><div id="eventHubNotes"></div></section>
      </div>
    </section>`);

  peoplePanel.insertAdjacentHTML('afterend',`
    <section class="card event-day-panel" id="eventDayPanel" hidden>
      <div class="event-day-head">
        <div><div class="panel-kicker">Modalità evento</div><h3 id="eventDayTitle">Evento</h3><p id="eventDayMeta"></p></div>
        <button class="btn primary" type="button" id="eventDayAddPerson">＋ Aggiungi iscritto</button>
      </div>
      <div class="event-day-stats" id="eventDayStats"></div>
      <div class="event-day-toolbar">
        <input id="eventDaySearch" type="search" placeholder="🔎 Cerca partecipante, telefono, email…" autocomplete="off">
        <div class="event-day-filters">
          <button type="button" class="active" data-event-day-filter="all">Da accogliere</button>
          <button type="button" data-event-day-filter="present">Presenti</button>
          <button type="button" data-event-day-filter="unpaid">Da pagare</button>
          <button type="button" data-event-day-filter="waitlist">Attesa</button>
          <button type="button" data-event-day-filter="everyone">Tutti</button>
        </div>
      </div>
      <div id="eventDayList" class="event-day-list"></div>
    </section>`);

  document.querySelectorAll('[data-event-detail]').forEach(btn=>btn.onclick=()=>showEventDetailMode(btn.dataset.eventDetail));
  $('eventHubEdit').onclick=()=>{const e=selectedEvent();if(e)openEvent(e.id)};
  $('eventHubAddPerson').onclick=()=>openPerson();
  $('eventHubOpenDay').onclick=()=>showEventDetailMode('day');
  $('eventDayAddPerson').onclick=()=>openPerson();
  $('eventDaySearch').oninput=renderEventDay;
  document.querySelectorAll('[data-event-day-filter]').forEach(btn=>btn.onclick=()=>{
    eventDayFilter=btn.dataset.eventDayFilter;
    document.querySelectorAll('[data-event-day-filter]').forEach(x=>x.classList.toggle('active',x.dataset.eventDayFilter===eventDayFilter));
    renderEventDay();
  });
  showEventDetailMode(eventDetailMode,false);
}
function showEventDetailMode(mode='hub',renderNow=true){
  eventDetailMode=['hub','people','day'].includes(mode)?mode:'hub';
  const management=$('eventManagementPanel');
  management?.classList.toggle('event-day-mode',eventDetailMode==='day');
  document.querySelectorAll('[data-event-detail]').forEach(btn=>btn.classList.toggle('active',btn.dataset.eventDetail===eventDetailMode));
  if($('eventHubPanel'))$('eventHubPanel').hidden=eventDetailMode!=='hub';
  if($('eventPeoplePanel'))$('eventPeoplePanel').hidden=eventDetailMode!=='people';
  if($('eventDayPanel'))$('eventDayPanel').hidden=eventDetailMode!=='day';
  if(renderNow){
    if(eventDetailMode==='hub')renderEventHub();
    else if(eventDetailMode==='people')renderPeople();
    else renderEventDay();
  }
}
function euro(value){return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(value)||0)}
function eventHubEmpty(text='Nessun elemento collegato.'){return `<div class="event-hub-empty">${esc(text)}</div>`}
function hubRow({icon,title,meta,type,id,tone=''}){return `<button type="button" class="event-hub-row ${tone}" onclick="openEventHubEntity('${type}','${id}')"><span class="event-hub-row-icon">${icon}</span><span><b>${esc(title)}</b><small>${esc(meta||'')}</small></span><i>›</i></button>`}
window.openEventHubEntity=async(type,id)=>{
  if(type==='contact'){
    await window.club42?.openLinkedEntity?.('contact',id);
    return;
  }
  if(type==='cash'){
    await window.club42?.openLinkedEntity?.('cash',id);
    return;
  }
  await window.club42?.openLinkedEntity?.(type,id);
};
function renderEventHub(){
  if(!$('eventHubPanel'))return;
  const e=selectedEvent();
  const ids=['eventHubSummary','eventHubProjects','eventHubTasks','eventHubSocial','eventHubCash','eventHubContacts','eventHubNotes'];
  if(!e){ids.forEach(id=>{if($(id))$(id).innerHTML=eventHubEmpty('Seleziona un evento.')});return}

  const pp=list(e.id),confirmed=pp.filter(p=>p.status==='confirmed'),present=confirmed.filter(p=>p.attended),paid=confirmed.filter(p=>p.paid==='yes');
  const projects=eventHubData.projects.filter(x=>x.event_id===e.id);
  const tasks=eventHubData.tasks.filter(x=>x.event_id===e.id).sort((a,b)=>(a.status==='done')-(b.status==='done')||(a.due_date||'9999').localeCompare(b.due_date||'9999'));
  const social=eventHubData.social.filter(x=>x.event_id===e.id).sort((a,b)=>(a.scheduled_date||'9999').localeCompare(b.scheduled_date||'9999'));
  const cash=eventHubData.cash.filter(x=>x.event_id===e.id).sort((a,b)=>(b.movement_date||'').localeCompare(a.movement_date||''));
  const contactIds=eventContactLinks.filter(x=>x.event_id===e.id).map(x=>String(x.contact_id));
  const contacts=eventContacts.filter(x=>contactIds.includes(String(x.id)));
  const income=cash.filter(x=>x.movement_type==='income').reduce((sum,x)=>sum+Number(x.amount||0),0);
  const expense=cash.filter(x=>x.movement_type==='expense').reduce((sum,x)=>sum+Number(x.amount||0),0);

  $('eventHubSummary').innerHTML=`
    <div><span>Confermati</span><b>${confirmed.length}${e.capacity?' / '+e.capacity:''}</b></div>
    <div><span>Presenti</span><b>${present.length}</b><small>${confirmed.length?Math.round(present.length/confirmed.length*100):0}% check-in</small></div>
    <div><span>Pagati</span><b>${paid.length}</b><small>${confirmed.length-paid.length} da pagare</small></div>
    <div><span>Saldo evento</span><b>${esc(euro(income-expense))}</b><small>${cash.length} movimenti</small></div>`;

  $('eventHubProjects').innerHTML=projects.length?projects.map(p=>hubRow({icon:'◇',title:p.title,meta:[p.status,p.target_date?fmtDate(p.target_date):''].filter(Boolean).join(' · '),type:'project',id:p.id})).join(''):eventHubEmpty();
  $('eventHubTasks').innerHTML=tasks.length?tasks.slice(0,8).map(t=>hubRow({icon:t.status==='done'?'✓':'○',title:t.title,meta:[t.status,t.priority,t.due_date?fmtDate(t.due_date):''].filter(Boolean).join(' · '),type:'task',id:t.id,tone:t.status==='blocked'?'warn':''})).join(''):eventHubEmpty();
  $('eventHubSocial').innerHTML=social.length?social.slice(0,8).map(s=>hubRow({icon:'◎',title:s.title,meta:[s.content_type,s.status,s.scheduled_date?fmtDate(s.scheduled_date):''].filter(Boolean).join(' · '),type:'social',id:s.id})).join(''):eventHubEmpty();
  $('eventHubCash').innerHTML=cash.length?cash.slice(0,8).map(x=>hubRow({icon:x.movement_type==='income'?'+':'−',title:x.description,meta:`${x.movement_date?fmtDate(x.movement_date)+' · ':''}${euro(x.amount)} · ${x.movement_type==='income'?'Entrata':'Uscita'}`,type:'cash',id:x.id,tone:x.movement_type==='expense'?'expense':'income'})).join(''):eventHubEmpty();
  $('eventHubContacts').innerHTML=contacts.length?contacts.map(x=>hubRow({icon:'☏',title:x.name,meta:x.organization||'Collaboratore',type:'contact',id:x.id})).join(''):eventHubEmpty();
  $('eventHubNotes').innerHTML=e.notes?`<div class="event-hub-notes">${esc(e.notes).replaceAll('\n','<br>')}</div>`:eventHubEmpty('Nessuna nota interna.');
}
function renderEventDay(){
  const root=$('eventDayList');if(!root)return;
  const e=selectedEvent();
  if(!e){root.innerHTML=eventHubEmpty('Seleziona un evento.');return}
  $('eventDayTitle').textContent=e.name;
  $('eventDayMeta').textContent=[eventDateLabel(e),eventTimeLabel(e),e.place].filter(Boolean).join(' · ');

  const all=list(e.id),confirmed=all.filter(p=>p.status==='confirmed'),present=confirmed.filter(p=>p.attended),unpaid=confirmed.filter(p=>p.paid==='no'),wait=all.filter(p=>p.status==='waitlist');
  $('eventDayStats').innerHTML=`
    <div><span>Confermati</span><b>${confirmed.length}</b></div>
    <div><span>Presenti</span><b>${present.length}</b></div>
    <div><span>Da accogliere</span><b>${confirmed.length-present.length}</b></div>
    <div><span>Da pagare</span><b>${unpaid.length}</b></div>`;

  const q=($('eventDaySearch')?.value||'').trim().toLocaleLowerCase('it');
  let rows;
  if(eventDayFilter==='present')rows=present;
  else if(eventDayFilter==='unpaid')rows=unpaid;
  else if(eventDayFilter==='waitlist')rows=wait;
  else if(eventDayFilter==='everyone')rows=all.filter(p=>p.status!=='cancelled');
  else rows=confirmed.filter(p=>!p.attended);
  if(q)rows=rows.filter(p=>[p.name,p.phone,p.email,p.notes,p.diet].some(v=>String(v||'').toLocaleLowerCase('it').includes(q)));
  rows=rows.slice().sort((a,b)=>a.name.localeCompare(b.name,'it'));

  root.innerHTML=rows.length?rows.map(p=>`
    <article class="event-day-person ${p.attended?'present':''} ${p.status!=='confirmed'?'secondary':''}">
      <div class="event-day-person-main">
        <div class="event-day-person-name"><b>${esc(p.name)}</b>${p.member==='yes'?'<span>Socio</span>':''}${p.status==='waitlist'?'<span class="wait">Attesa</span>':''}</div>
        <p>${esc([p.phone,p.email].filter(Boolean).join(' · ')||'Nessun contatto')}</p>
        ${p.diet?`<small>🍽 ${esc(p.diet)}</small>`:''}
        ${p.notes?`<small>📝 ${esc(p.notes)}</small>`:''}
      </div>
      <div class="event-day-person-actions">
        ${p.status==='confirmed'?`<button type="button" class="event-day-check ${p.attended?'active':''}" onclick="toggleEventAttendance('${p.id}')">${p.attended?'✓ Presente':'○ Da accogliere'}</button>`:''}
        <button type="button" class="event-day-mini ${p.paid==='yes'?'active':''}" onclick="toggleEventPaid('${p.id}')">${p.paid==='yes'?'✓ Pagato':'€ Da pagare'}</button>
        <button type="button" class="event-day-mini ${p.member==='yes'?'active':''}" onclick="toggleEventMember('${p.id}')">${p.member==='yes'?'✓ Socio':'○ Non socio'}</button>
        <button type="button" class="event-day-edit" onclick="openPerson('${p.id}')">✎</button>
      </div>
    </article>`).join(''):`<div class="event-day-empty">Nessun partecipante corrisponde al filtro.</div>`;
}
async function patchEventRegistration(id,patch,success='Aggiornato'){
  const person=app.state.people.find(x=>x.id===id);if(!person)return;
  const {error}=await db.from('event_registrations').update({...patch,updated_at:new Date().toISOString()}).eq('id',id);
  if(error)return toast(error.message);
  if(Object.prototype.hasOwnProperty.call(patch,'attended'))person.attended=!!patch.attended;
  if(Object.prototype.hasOwnProperty.call(patch,'checked_in_at'))person.checkedInAt=patch.checked_in_at||'';
  if(Object.prototype.hasOwnProperty.call(patch,'checked_in_by'))person.checkedInBy=patch.checked_in_by||'';
  if(Object.prototype.hasOwnProperty.call(patch,'paid'))person.paid=patch.paid?'yes':'no';
  if(Object.prototype.hasOwnProperty.call(patch,'member'))person.member=patch.member?'yes':'no';
  render();toast(success);
}
window.toggleEventAttendance=async id=>{
  const p=app.state.people.find(x=>x.id===id);if(!p)return;
  const next=!p.attended;
  await patchEventRegistration(id,{attended:next,checked_in_at:next?new Date().toISOString():null,checked_in_by:next?app.currentUser?.id:null},next?'Check-in registrato':'Check-in annullato');
};
window.toggleEventPaid=async id=>{
  const p=app.state.people.find(x=>x.id===id);if(!p)return;
  await patchEventRegistration(id,{paid:p.paid!=='yes'},p.paid==='yes'?'Pagamento rimosso':'Pagamento registrato');
};
window.toggleEventMember=async id=>{
  const p=app.state.people.find(x=>x.id===id);if(!p)return;
  await patchEventRegistration(id,{member:p.member!=='yes'},p.member==='yes'?'Socio rimosso':'Segnato come socio');
};
function ensureEventRealtime(){
  if(eventRealtimeChannel||!app.currentUser)return;
  eventRealtimeChannel=db.channel(`club42-event-checkin-${app.currentUser.id}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'event_registrations'},payload=>{
      const row=mapPerson(payload.new);if(!app.state.people.some(p=>p.id===row.id))app.state.people.push(row);render();
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'event_registrations'},payload=>{
      const row=mapPerson(payload.new),i=app.state.people.findIndex(p=>p.id===row.id);
      if(i>=0)app.state.people[i]=row;else app.state.people.push(row);render();
    })
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'event_registrations'},payload=>{
      const id=payload.old?.id;if(id)app.state.people=app.state.people.filter(p=>p.id!==id);render();
    })
    .subscribe();
}

function ensureEventCalendarUi(){
  const view=$('view-events'),grid=view?.querySelector('.module-grid');
  if(!view||!grid||$('eventCalendarPanel'))return;
  grid.id='eventManagementPanel';
  const listPanel=grid.querySelector('.event-list-panel');
  const listKicker=listPanel?.querySelector('.panel-kicker');
  const listTitle=listPanel?.querySelector('h2');
  const selectedEyebrow=grid.querySelector('.event-hero .eyebrow');
  if(listKicker)listKicker.id='eventListKicker';
  if(listTitle)listTitle.id='eventListTitle';
  if(selectedEyebrow)selectedEyebrow.id='eventSelectedEyebrow';
  grid.insertAdjacentHTML('beforebegin',`
    <div class="event-view-tabs">
      <button class="event-view-tab active" type="button" data-event-view="manage">Gestione</button>
      <button class="event-view-tab" type="button" data-event-view="calendar">Calendario</button>
      <button class="event-view-tab" type="button" data-event-view="history">Storico</button>
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
  eventViewMode=['manage','calendar','history'].includes(mode)?mode:'manage';
  const calendar=$('eventCalendarPanel'),management=$('eventManagementPanel');
  if(calendar){
    const visible=eventViewMode==='calendar';
    calendar.hidden=!visible;
    calendar.style.display=visible?'':'none';
  }
  if(management){
    const visible=eventViewMode!=='calendar';
    management.hidden=!visible;
    management.style.display=visible?'':'none';
  }
  document.querySelectorAll('[data-event-view]').forEach(btn=>btn.classList.toggle('active',btn.dataset.eventView===eventViewMode));

  const history=eventViewMode==='history';
  if($('eventListKicker'))$('eventListKicker').textContent=history?'Archivio':'Calendario';
  if($('eventListTitle'))$('eventListTitle').textContent=history?'Storico eventi':'Eventi';
  if($('eventSelectedEyebrow'))$('eventSelectedEyebrow').textContent=history?'● Evento terminato':'● Evento selezionato';
  if($('sideNewEvent'))$('sideNewEvent').hidden=history;

  if(eventViewMode==='calendar')renderEventCalendar();
  else{
    syncEventSelectionForView(eventViewMode);
    render();
  }
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
      const starts=e.date===key,ends=(e.endDate||e.date)===key,multi=(e.endDate||e.date)!==e.date,ended=isEndedEvent(e);
      const phase=!multi?'':starts?' start':ends?' end':' middle';
      const time=starts&&e.time?e.time+' · ':'';
      const meta=`${ended?'Terminato · ':''}${time}${multi&&!starts?'↳ ':''}`;
      return `<button type="button" class="event-cal-item${phase} ${e.googleCalendarAdded?'calendar-synced ':''}${ended?'ended':''}" onclick="openEventFromCalendar('${e.id}')"><span>${esc(meta)}</span><b>${esc(e.name)}</b></button>`;
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
  const [er,pr,cr,hr,tr,jr,sr,car]=await Promise.all([
    db.from('events').select('*').order('event_date'),
    db.from('event_registrations').select('*'),
    db.rpc('club42_event_contact_directory'),
    db.rpc('club42_event_contact_links'),
    db.from('project_tasks').select('id,event_id,title,status,priority,due_date,description,notes').not('event_id','is',null),
    db.from('projects').select('id,event_id,title,status,priority,target_date,summary').not('event_id','is',null),
    db.from('social_content').select('id,event_id,title,status,content_type,scheduled_date,scheduled_time').not('event_id','is',null),
    db.from('cash_transactions').select('id,event_id,movement_date,movement_type,amount,description').not('event_id','is',null)
  ]);
  if(er.error||pr.error||cr.error||hr.error){console.error(er.error||pr.error||cr.error||hr.error);syncStatus('error','Errore DB');toast('Errore nel caricamento dati');return}
  [tr,jr,sr,car].forEach(r=>{if(r.error)console.warn('Event hub relation',r.error)});
  app.state.events=(er.data||[]).map(mapEvent);app.state.people=(pr.data||[]).map(mapPerson);eventContacts=cr.data||[];eventContactLinks=hr.data||[];fillEventContacts();
  eventHubData={tasks:tr.data||[],projects:jr.data||[],social:sr.data||[],cash:car.data||[]};
  syncEventSelectionForView(eventViewMode==='history'?'history':'manage');
  ensureEventRealtime();
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
  const active=activeEvents();
  const activeIds=new Set(active.map(e=>e.id));
  const activePeople=app.state.people.filter(p=>activeIds.has(p.eventId));
  const confirmed=activePeople.filter(p=>p.status==='confirmed');
  $('dashEvents').textContent=active.length;$('dashPeople').textContent=confirmed.length;$('dashPaid').textContent=confirmed.filter(p=>p.paid==='yes').length;$('dashMembers').textContent=confirmed.filter(p=>p.member==='yes').length;
  const next=active.slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''))[0];const box=$('nextEventBox');
  if(!next){box.innerHTML='<div class="empty">Nessun evento attivo o in programma.</div>';return}
  const dt=new Date(next.date+'T12:00:00'),day=String(dt.getDate()).padStart(2,'0'),month=dt.toLocaleDateString('it-IT',{month:'short'}).replace('.','').toUpperCase(),n=list(next.id).filter(p=>p.status==='confirmed').length;
  const when=[eventDateLabel(next),eventTimeLabel(next)].filter(Boolean).join(' · ');box.innerHTML=`<div class="upcoming-event"><div class="date-tile"><div><b>${day}</b><span>${month}</span></div></div><div><h4>${esc(next.name)}</h4><p>${esc(when)}${when?' · ':''}${esc(next.place||'Luogo da definire')}<br>${next.capacity?`${n}/${next.capacity} posti occupati`:`${n} confermati`}</p></div><button class="btn" onclick="selectEvent('${next.id}',true)">Gestisci</button></div>`;
}

function eventListCard(x,history=false){
  const n=list(x.id).filter(p=>p.status==='confirmed').length;
  const guestBadge=!history?(x.guestTeaser?'<span class="event-guest-badge teaser">◌ Prossimamente</span>':x.guestVisible?'<span class="event-guest-badge">● Pagina soci</span>':''):'<span class="event-ended-badge">● Terminato</span>';
  const time=eventTimeLabel(x),price=eventPriceLabel(x);
  const calendarRow=history?'':`<div class="event-calendar-row" onclick="event.stopPropagation()"><button class="event-calendar-open" type="button" onclick="openGoogleCalendarEvent('${x.id}')" title="Apri una bozza precompilata nel Google Calendar Club42">G&nbsp; Calendar</button><label class="event-calendar-check ${x.googleCalendarAdded?'done':''}"><input type="checkbox" ${x.googleCalendarAdded?'checked':''} onchange="setEventCalendarAdded('${x.id}',this.checked)"> <span>${x.googleCalendarAdded?'Inserito':'Da inserire'}</span></label></div>`;
  return `<div class="event-card ${history?'ended ':''}${x.id===app.state.selected?'active':''}" onclick="selectEvent('${x.id}')"><div class="event-card-title">${esc(x.name)}${guestBadge}</div><div class="event-card-meta">${esc(eventDateLabel(x))}${time?' · '+esc(time):''}<br>${esc(x.place||'Luogo da definire')}<br>${price?esc(price)+' · ':''}${x.capacity?`${n}/${x.capacity} posti`:`${n} confermati`}</div>${calendarRow}<div class="event-card-actions"><button class="icon-btn" onclick="event.stopPropagation();openEvent('${x.id}')">✎</button><button class="icon-btn" onclick="event.stopPropagation();deleteEvent('${x.id}')">×</button></div></div>`;
}

export function render(){
  const listMode=eventViewMode==='history'?'history':'manage';
  syncEventSelectionForView(listMode);
  const e=selectedEvent();
  renderEventCalendar();

  const history=listMode==='history';
  const rows=eventsForView(listMode).slice().sort((a,b)=>history?b.date.localeCompare(a.date):a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  $('events').innerHTML=rows.length?rows.map(x=>eventListCard(x,history)).join(''):`<div class="empty">${history?'Nessun evento nello storico.':'Nessun evento attivo o in programma.'}</div>`;

  if($('eventListKicker'))$('eventListKicker').textContent=history?'Archivio':'Calendario';
  if($('eventListTitle'))$('eventListTitle').textContent=history?'Storico eventi':'Eventi';
  if($('eventSelectedEyebrow'))$('eventSelectedEyebrow').textContent=history?'● Evento terminato':'● Evento selezionato';
  if($('sideNewEvent'))$('sideNewEvent').hidden=history;

  renderDashboard();
  if(!e){
    $('eventName').textContent=history?'Nessun evento terminato':'Nessun evento';$('eventMeta').textContent=history?'Lo storico è vuoto.':'Crea un evento per iniziare.';
    $('people').innerHTML='<tr><td colspan="7" class="empty">Nessun evento selezionato.</td></tr>';
    ['sConfirmed','sWait','sPaid','sMembers','sPresent'].forEach(id=>{if($(id))$(id).textContent='0'});
    renderEventHub();renderEventDay();return
  }

  const collaborators=eventContactLinks.filter(x=>x.event_id===e.id).length;
  const guestState=e.guestTeaser?' · prossimamente ai soci':e.guestVisible?' · visibile ai soci':'';
  const timeLabel=eventTimeLabel(e),priceLabel=eventPriceLabel(e),calendarState=e.googleCalendarAdded?' · Calendar Club42 ✓':' · Calendar da inserire',lifecycle=isEndedEvent(e)?' · Terminato':'';
  $('eventName').textContent=e.name;$('eventMeta').textContent=`${eventDateLabel(e)}${timeLabel?' · '+timeLabel:''}${e.place?' · '+e.place:''}${priceLabel?' · '+priceLabel:''}${e.capacity?' · capienza '+e.capacity:''}${collaborators?' · '+collaborators+' collaboratori':''}${guestState}${calendarState}${lifecycle}`;
  const pp=list(e.id),confirmed=pp.filter(p=>p.status==='confirmed');$('sConfirmed').textContent=confirmed.length+(e.capacity?' / '+e.capacity:'');$('sWait').textContent=pp.filter(p=>p.status==='waitlist').length;$('sPaid').textContent=confirmed.filter(p=>p.paid==='yes').length;$('sMembers').textContent=confirmed.filter(p=>p.member==='yes').length;if($('sPresent'))$('sPresent').textContent=confirmed.filter(p=>p.attended).length;
  renderPeople();renderEventHub();renderEventDay();showEventDetailMode(eventDetailMode,false);
}

export function renderPeople(){
  const e=selectedEvent();if(!e)return;const q=$('search').value.toLowerCase().trim(),sf=$('statusFilter').value;let pp=list(e.id);if(sf!=='all')pp=pp.filter(p=>p.status===sf);if(q)pp=pp.filter(p=>[p.name,p.phone,p.email,p.notes,p.diet].some(v=>(v||'').toLowerCase().includes(q)));pp.sort((a,b)=>a.name.localeCompare(b.name,'it'));
  $('people').innerHTML=pp.length?pp.map(p=>`<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.phone||'')}${p.phone&&p.email?'<br>':''}${esc(p.email||'')}</td><td>${badge(p.status)}</td><td>${p.member==='yes'?'<span class="badge ok">Socio</span>':'<span class="badge off">No</span>'}</td><td>${p.paid==='yes'?'<span class="badge ok">Pagato</span>':'<span class="badge warn">Da pagare</span>'}</td><td>${p.diet?`🍽 ${esc(p.diet)}<br>`:''}<span class="muted">${esc(p.notes||'')}</span></td><td><div class="row"><button class="icon-btn" onclick="openPerson('${p.id}')">✎</button><button class="icon-btn" onclick="deletePerson('${p.id}')">×</button></div></td></tr>`).join(''):'<tr><td colspan="7" class="empty">Nessun iscritto trovato.</td></tr>';
}

export async function selectEvent(id,openView=false){
  const e=app.state.events.find(x=>x.id===id);if(!e)return;
  app.state.selected=id;
  eventDetailMode='hub';
  showEventView(isEndedEvent(e)?'history':'manage');
  showEventDetailMode('hub');
  await showView('events',{eventId:id});
  if(openView)document.body.classList.remove('sidebar-open');
}
export async function applyEventRoute(eventId){
  if(eventId&&app.state.events.some(e=>e.id===eventId)){
    const e=app.state.events.find(x=>x.id===eventId);
    app.state.selected=eventId;
    showEventView(isEndedEvent(e)?'history':'manage');
  }else if(app.state.selected){
    const wanted=`#events/${app.state.selected}`;if(location.hash==='#events')history.replaceState(null,'',wanted);
  }
}

function openEvent(id=null){app.editEventId=id;const e=id?app.state.events.find(x=>x.id===id):null;$('eventDlgTitle').textContent=e?'Modifica evento':'Nuovo evento';$('eName').value=e?.name||'';$('eDate').value=e?.date||'';$('eEndDate').value=e?.endDate||'';$('eTime').value=e?.time||'';$('eEndTime').value=e?.endTime||'';$('ePlace').value=e?.place||'';$('eCapacity').value=e?.capacity??0;$('ePrice').value=e?.price??'';$('eFree').checked=!!e?.isFree;syncEventPriceControl();syncEndDateMin();$('eNotes').value=e?.notes||'';$('eGuestVisible').checked=!!e?.guestVisible;$('eGuestTeaser').checked=!!e?.guestTeaser;$('eGuestDescription').value=e?.guestDescription||'';fillEventContacts();setEventContactSelection(id);$('eventDlg').showModal()}
async function deleteEvent(id){const e=app.state.events.find(x=>x.id===id);if(!e||!confirm(`Eliminare “${e.name}” e tutte le relative iscrizioni? Lo storico delle collaborazioni resterà conservato.`))return;const {error}=await db.from('events').delete().eq('id',id);if(error)return toast(error.message);toast('Evento eliminato');await loadRemote()}
function openPerson(id=null){const e=selectedEvent();if(!e){openEvent();return}app.editPersonId=id;const p=id?app.state.people.find(x=>x.id===id):null;$('personDlgTitle').textContent=p?'Modifica iscritto':'Aggiungi iscritto';$('pName').value=p?.name||'';$('pPhone').value=p?.phone||'';$('pEmail').value=p?.email||'';$('pStatus').value=p?.status||'confirmed';$('pPaid').value=p?.paid||'no';$('pMember').value=p?.member||'no';$('pDiet').value=p?.diet||'';$('pNotes').value=p?.notes||'';$('personDlg').showModal()}
async function deletePerson(id){const p=app.state.people.find(x=>x.id===id);if(!p||!confirm(`Eliminare ${p.name}?`))return;const {error}=await db.from('event_registrations').delete().eq('id',id);if(error)return toast(error.message);toast('Iscritto eliminato');await loadRemote()}

export function initEvents(){
  ensureEventContactsField();ensureGuestFields();ensureEventCalendarUi();ensureEventDetailUi();document.addEventListener('club42:contacts-changed',refreshEventContactData);
  $('eGuestVisible').onchange=()=>{if($('eGuestVisible').checked)$('eGuestTeaser').checked=false};
  $('eGuestTeaser').onchange=()=>{if($('eGuestTeaser').checked)$('eGuestVisible').checked=false};
  $('eFree').onchange=syncEventPriceControl;
  $('eDate').onchange=syncEndDateMin;
  window.selectEvent=selectEvent;window.openEvent=openEvent;window.deleteEvent=deleteEvent;window.openPerson=openPerson;window.deletePerson=deletePerson;window.openGoogleCalendarEvent=openGoogleCalendarEvent;window.setEventCalendarAdded=setEventCalendarAdded;window.openEventFromCalendar=openEventFromCalendar;
  $('eventForm').addEventListener('submit',async ev=>{ev.preventDefault();const startDate=$('eDate').value,endDate=$('eEndDate').value||null;if(endDate&&endDate<startDate)return toast('La data fine non può essere precedente alla data inizio');const isFree=$('eFree').checked;const base={name:$('eName').value.trim(),event_date:startDate,event_end_date:endDate,event_time:$('eTime').value||null,event_end_time:$('eEndTime').value||null,place:$('ePlace').value.trim()||null,capacity:Number($('eCapacity').value)||0,price:isFree?null:($('ePrice').value===''?null:Number($('ePrice').value)),is_free:isFree,notes:$('eNotes').value.trim()||null,guest_visible:$('eGuestVisible').checked,guest_teaser:$('eGuestTeaser').checked,guest_description:$('eGuestDescription').value.trim()||null};let result;if(app.editEventId)result=await db.from('events').update({...base,updated_at:new Date().toISOString()}).eq('id',app.editEventId).select('id').single();else result=await db.from('events').insert({...base,created_by:app.currentUser.id}).select('id').single();if(result.error)return toast(result.error.message);try{await syncEventContacts(result.data.id,base)}catch(error){console.error(error);return toast('Evento salvato, ma errore nel collegamento collaboratori')}$('eventDlg').close();toast(app.editEventId?'Evento aggiornato':'Evento creato');await loadRemote()});
  $('personForm').addEventListener('submit',async ev=>{ev.preventDefault();const e=selectedEvent();if(!e)return toast('Seleziona un evento');const base={event_id:e.id,name:$('pName').value.trim(),phone:$('pPhone').value.trim()||null,email:$('pEmail').value.trim()||null,status:$('pStatus').value,paid:$('pPaid').value==='yes',member:$('pMember').value==='yes',dietary_requirements:$('pDiet').value.trim()||null,notes:$('pNotes').value.trim()||null};let result;if(app.editPersonId)result=await db.from('event_registrations').update({...base,updated_at:new Date().toISOString()}).eq('id',app.editPersonId);else result=await db.from('event_registrations').insert({...base,created_by:app.currentUser.id});if(result.error)return toast(result.error.message);$('personDlg').close();toast(app.editPersonId?'Iscritto aggiornato':'Iscritto aggiunto');await loadRemote()});
  ['globalNewEvent','heroNewEvent','quickEvent','sideNewEvent'].forEach(id=>$(id).onclick=()=>openEvent());['addPerson','quickPerson'].forEach(id=>$(id).onclick=()=>openPerson());$('search').oninput=renderPeople;$('statusFilter').onchange=renderPeople;
}
