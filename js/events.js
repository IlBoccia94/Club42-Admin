import {$,app,db,LEGACY_KEY,esc,selected,list,fmtDate,badge,toast,syncStatus} from './core.js';
import {showView} from './router.js';

let eventContacts=[],eventContactLinks=[];

function mapEvent(r){return{id:r.id,name:r.name,date:r.event_date,time:r.event_time?.slice(0,5)||'',place:r.place||'',capacity:r.capacity||0,price:r.price??'',notes:r.notes||''}}
function mapPerson(r){return{id:r.id,eventId:r.event_id,name:r.name,phone:r.phone||'',email:r.email||'',status:r.status,paid:r.paid?'yes':'no',member:r.member?'yes':'no',diet:r.dietary_requirements||'',notes:r.notes||'',createdAt:r.created_at}}

function ensureEventContactsField(){
 if($('eContacts'))return;
 const notes=$('eNotes')?.closest('.field');
 if(!notes)return;
 notes.insertAdjacentHTML('beforebegin',`<div class="field full"><label>Collaboratori / contatti</label><select id="eContacts" class="event-contact-select" multiple></select><div class="event-contact-hint">Seleziona uno o più contatti della rubrica. Il collegamento alimenta automaticamente lo storico collaborazioni.</div></div>`);
}
function fillEventContacts(){const el=$('eContacts');if(!el)return;el.innerHTML=eventContacts.map(c=>`<option value="${c.id}">${esc(c.name)}${c.organization?' · '+esc(c.organization):''}${c.active?'':' · archiviato'}</option>`).join('')}
function setEventContactSelection(eventId){const el=$('eContacts');if(!el)return;const ids=new Set(eventId?eventContactLinks.filter(x=>x.event_id===eventId).map(x=>x.contact_id):[]);[...el.options].forEach(o=>o.selected=ids.has(o.value))}
async function syncEventContacts(eventId,base){
 const el=$('eContacts');if(!el)return;
 const selectedIds=[...el.selectedOptions].map(o=>o.value),selectedSet=new Set(selectedIds),existing=eventContactLinks.filter(x=>x.event_id===eventId),existingSet=new Set(existing.map(x=>x.contact_id));
 const removeIds=existing.filter(x=>!selectedSet.has(x.contact_id)).map(x=>x.id);
 if(removeIds.length){const {error}=await db.from('contact_collaborations').delete().in('id',removeIds);if(error)throw error}
 const keepIds=existing.filter(x=>selectedSet.has(x.contact_id)).map(x=>x.id);
 if(keepIds.length){const {error}=await db.from('contact_collaborations').update({title:base.name,collaboration_date:base.event_date}).in('id',keepIds);if(error)throw error}
 const addIds=selectedIds.filter(id=>!existingSet.has(id));
 if(addIds.length){const {error}=await db.from('contact_collaborations').insert(addIds.map(contact_id=>({contact_id,event_id:eventId,title:base.name,collaboration_date:base.event_date,created_by:app.currentUser.id})));if(error)throw error}
}

export async function loadRemote(){
  syncStatus('loading','Sincronizzazione…');
  const [er,pr,cr,hr]=await Promise.all([db.from('events').select('*').order('event_date'),db.from('event_registrations').select('*'),db.from('contacts').select('id,name,organization,active').order('name'),db.from('contact_collaborations').select('id,event_id,contact_id,title,collaboration_date,role,notes')]);
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
    const {data,error}=await db.from('events').insert({name:e.name,event_date:e.date,event_time:e.time||null,place:e.place||null,capacity:Number(e.capacity)||0,price:e.price===''?null:Number(e.price),notes:e.notes||null,created_by:app.currentUser.id}).select('id').single();
    if(error)return toast('Importazione interrotta');idMap[e.id]=data.id;
  }
  for(const p of old.people||[]){if(!idMap[p.eventId])continue;await db.from('event_registrations').insert({event_id:idMap[p.eventId],name:p.name,phone:p.phone||null,email:p.email||null,status:p.status||'confirmed',paid:p.paid==='yes',member:p.member==='yes',dietary_requirements:p.diet||null,notes:p.notes||null,created_by:app.currentUser.id})}
  localStorage.setItem(LEGACY_KEY+'_migrated',new Date().toISOString());toast('Dati locali importati');await loadRemote();
}

function renderDashboard(){
  const confirmed=app.state.people.filter(p=>p.status==='confirmed');
  $('dashEvents').textContent=app.state.events.length;$('dashPeople').textContent=confirmed.length;$('dashPaid').textContent=confirmed.filter(p=>p.paid==='yes').length;$('dashMembers').textContent=confirmed.filter(p=>p.member==='yes').length;
  const today=new Date().toISOString().slice(0,10);const next=app.state.events.filter(e=>e.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0]||app.state.events.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];const box=$('nextEventBox');
  if(!next){box.innerHTML='<div class="empty">Nessun evento presente. Creane uno per iniziare.</div>';return}
  const dt=new Date(next.date+'T12:00:00'),day=String(dt.getDate()).padStart(2,'0'),month=dt.toLocaleDateString('it-IT',{month:'short'}).replace('.','').toUpperCase(),n=list(next.id).filter(p=>p.status==='confirmed').length;
  box.innerHTML=`<div class="upcoming-event"><div class="date-tile"><div><b>${day}</b><span>${month}</span></div></div><div><h4>${esc(next.name)}</h4><p>${next.time?next.time+' · ':''}${esc(next.place||'Luogo da definire')}<br>${next.capacity?`${n}/${next.capacity} posti occupati`:`${n} confermati`}</p></div><button class="btn" onclick="selectEvent('${next.id}',true)">Gestisci</button></div>`;
}

export function render(){
  const e=selected();if(e&&!app.state.selected)app.state.selected=e.id;
  $('events').innerHTML=app.state.events.length?app.state.events.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(x=>{const n=list(x.id).filter(p=>p.status==='confirmed').length;return `<div class="event-card ${x.id===app.state.selected?'active':''}" onclick="selectEvent('${x.id}')"><div class="event-card-title">${esc(x.name)}</div><div class="event-card-meta">${fmtDate(x.date)}${x.time?' · '+x.time:''}<br>${esc(x.place||'Luogo da definire')}<br>${x.capacity?`${n}/${x.capacity} posti`:`${n} confermati`}</div><div class="event-card-actions"><button class="icon-btn" onclick="event.stopPropagation();openEvent('${x.id}')">✎</button><button class="icon-btn" onclick="event.stopPropagation();deleteEvent('${x.id}')">×</button></div></div>`}).join(''):'<div class="empty">Nessun evento.</div>';
  renderDashboard();
  if(!e){$('eventName').textContent='Nessun evento';$('eventMeta').textContent='Crea un evento per iniziare.';$('people').innerHTML='<tr><td colspan="7" class="empty">Nessun evento selezionato.</td></tr>';['sConfirmed','sWait','sPaid','sMembers'].forEach(id=>$(id).textContent='0');return}
  const collaborators=eventContactLinks.filter(x=>x.event_id===e.id).length;
  $('eventName').textContent=e.name;$('eventMeta').textContent=`${fmtDate(e.date)}${e.time?' · '+e.time:''}${e.place?' · '+e.place:''}${e.capacity?' · capienza '+e.capacity:''}${collaborators?' · '+collaborators+' collaboratori':''}`;
  const pp=list(e.id),confirmed=pp.filter(p=>p.status==='confirmed');$('sConfirmed').textContent=confirmed.length+(e.capacity?' / '+e.capacity:'');$('sWait').textContent=pp.filter(p=>p.status==='waitlist').length;$('sPaid').textContent=confirmed.filter(p=>p.paid==='yes').length;$('sMembers').textContent=confirmed.filter(p=>p.member==='yes').length;renderPeople();
}

export function renderPeople(){
  const e=selected();if(!e)return;const q=$('search').value.toLowerCase().trim(),sf=$('statusFilter').value;let pp=list(e.id);if(sf!=='all')pp=pp.filter(p=>p.status===sf);if(q)pp=pp.filter(p=>[p.name,p.phone,p.email,p.notes,p.diet].some(v=>(v||'').toLowerCase().includes(q)));pp.sort((a,b)=>a.name.localeCompare(b.name,'it'));
  $('people').innerHTML=pp.length?pp.map(p=>`<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.phone||'')}${p.phone&&p.email?'<br>':''}${esc(p.email||'')}</td><td>${badge(p.status)}</td><td>${p.member==='yes'?'<span class="badge ok">Socio</span>':'<span class="badge off">No</span>'}</td><td>${p.paid==='yes'?'<span class="badge ok">Pagato</span>':'<span class="badge warn">Da pagare</span>'}</td><td>${p.diet?`🍽 ${esc(p.diet)}<br>`:''}<span class="muted">${esc(p.notes||'')}</span></td><td><div class="row"><button class="icon-btn" onclick="openPerson('${p.id}')">✎</button><button class="icon-btn" onclick="deletePerson('${p.id}')">×</button></div></td></tr>`).join(''):'<tr><td colspan="7" class="empty">Nessun iscritto trovato.</td></tr>';
}

export async function selectEvent(id,openView=false){app.state.selected=id;render();await showView('events',{eventId:id});if(openView)document.body.classList.remove('sidebar-open')}
export async function applyEventRoute(eventId){if(eventId&&app.state.events.some(e=>e.id===eventId)){app.state.selected=eventId;render()}else if(app.state.selected){const wanted=`#events/${app.state.selected}`;if(location.hash==='#events')history.replaceState(null,'',wanted)}}

function openEvent(id=null){app.editEventId=id;const e=id?app.state.events.find(x=>x.id===id):null;$('eventDlgTitle').textContent=e?'Modifica evento':'Nuovo evento';$('eName').value=e?.name||'';$('eDate').value=e?.date||'';$('eTime').value=e?.time||'';$('ePlace').value=e?.place||'';$('eCapacity').value=e?.capacity??0;$('ePrice').value=e?.price??'';$('eNotes').value=e?.notes||'';fillEventContacts();setEventContactSelection(id);$('eventDlg').showModal()}
async function deleteEvent(id){const e=app.state.events.find(x=>x.id===id);if(!e||!confirm(`Eliminare “${e.name}” e tutte le relative iscrizioni? Lo storico delle collaborazioni resterà conservato.`))return;const {error}=await db.from('events').delete().eq('id',id);if(error)return toast(error.message);toast('Evento eliminato');await loadRemote()}
function openPerson(id=null){const e=selected();if(!e){openEvent();return}app.editPersonId=id;const p=id?app.state.people.find(x=>x.id===id):null;$('personDlgTitle').textContent=p?'Modifica iscritto':'Aggiungi iscritto';$('pName').value=p?.name||'';$('pPhone').value=p?.phone||'';$('pEmail').value=p?.email||'';$('pStatus').value=p?.status||'confirmed';$('pPaid').value=p?.paid||'no';$('pMember').value=p?.member||'no';$('pDiet').value=p?.diet||'';$('pNotes').value=p?.notes||'';$('personDlg').showModal()}
async function deletePerson(id){const p=app.state.people.find(x=>x.id===id);if(!p||!confirm(`Eliminare ${p.name}?`))return;const {error}=await db.from('event_registrations').delete().eq('id',id);if(error)return toast(error.message);toast('Iscritto eliminato');await loadRemote()}

export function initEvents(){
  ensureEventContactsField();
  window.selectEvent=selectEvent;window.openEvent=openEvent;window.deleteEvent=deleteEvent;window.openPerson=openPerson;window.deletePerson=deletePerson;
  $('eventForm').addEventListener('submit',async ev=>{ev.preventDefault();const base={name:$('eName').value.trim(),event_date:$('eDate').value,event_time:$('eTime').value||null,place:$('ePlace').value.trim()||null,capacity:Number($('eCapacity').value)||0,price:$('ePrice').value===''?null:Number($('ePrice').value),notes:$('eNotes').value.trim()||null};let result;if(app.editEventId)result=await db.from('events').update({...base,updated_at:new Date().toISOString()}).eq('id',app.editEventId).select('id').single();else result=await db.from('events').insert({...base,created_by:app.currentUser.id}).select('id').single();if(result.error)return toast(result.error.message);try{await syncEventContacts(result.data.id,base)}catch(error){console.error(error);return toast('Evento salvato, ma errore nel collegamento collaboratori')}$('eventDlg').close();toast(app.editEventId?'Evento aggiornato':'Evento creato');await loadRemote()});
  $('personForm').addEventListener('submit',async ev=>{ev.preventDefault();const e=selected();const base={event_id:e.id,name:$('pName').value.trim(),phone:$('pPhone').value.trim()||null,email:$('pEmail').value.trim()||null,status:$('pStatus').value,paid:$('pPaid').value==='yes',member:$('pMember').value==='yes',dietary_requirements:$('pDiet').value.trim()||null,notes:$('pNotes').value.trim()||null};let result;if(app.editPersonId)result=await db.from('event_registrations').update({...base,updated_at:new Date().toISOString()}).eq('id',app.editPersonId);else result=await db.from('event_registrations').insert({...base,created_by:app.currentUser.id});if(result.error)return toast(result.error.message);$('personDlg').close();toast(app.editPersonId?'Iscritto aggiornato':'Iscritto aggiunto');await loadRemote()});
  ['globalNewEvent','heroNewEvent','quickEvent','sideNewEvent'].forEach(id=>$(id).onclick=()=>openEvent());['addPerson','quickPerson'].forEach(id=>$(id).onclick=()=>openPerson());$('search').oninput=renderPeople;$('statusFilter').onchange=renderPeople;
}
