import {$,app,db,esc,fmtDate,toast} from './core.js';

let contacts=[],collaborations=[],events=[],projects=[],editContactId=null,editCollaborationId=null,activeTab='directory';
const typeLabels={person:'Persona',artist:'Artista',association:'Associazione',supplier:'Fornitore',venue:'Location',speaker:'Relatore / ospite',sponsor:'Sponsor',media:'Media',professional:'Professionista'};

function collabsFor(id){return collaborations.filter(c=>c.contact_id===id).sort((a,b)=>(b.collaboration_date||'').localeCompare(a.collaboration_date||'')||new Date(b.created_at)-new Date(a.created_at))}
function contactName(id){return contacts.find(c=>c.id===id)?.name||'Contatto'}
function eventName(id){return events.find(e=>e.id===id)?.name||''}
function projectName(id){return projects.find(p=>p.id===id)?.title||''}
function collabContext(c){return c.event_id?eventName(c.event_id):c.project_id?projectName(c.project_id):''}

export async function loadContacts(){
 const [cr,hr,er,pr]=await Promise.all([
  db.from('contacts').select('*').order('favorite',{ascending:false}).order('name'),
  db.from('contact_collaborations').select('*').order('collaboration_date',{ascending:false}).order('created_at',{ascending:false}),
  db.from('events').select('id,name,event_date').order('event_date',{ascending:false}),
  db.from('projects').select('id,title,status,target_date').order('updated_at',{ascending:false})
 ]);
 if(cr.error||hr.error||er.error||pr.error){console.error(cr.error||hr.error||er.error||pr.error);toast('Errore caricamento contatti');return}
 contacts=cr.data||[];collaborations=hr.data||[];events=er.data||[];projects=pr.data||[];fillCollaborationSelects();renderContacts();document.dispatchEvent(new CustomEvent('club42:contacts-changed'));
}

function fillCollaborationSelects(){
 $('ccContact').innerHTML=['<option value="">Seleziona…</option>',...contacts.map(c=>`<option value="${c.id}">${esc(c.name)}${c.organization?' · '+esc(c.organization):''}${c.active?'':' · archiviato'}</option>`)].join('');
 $('ccEvent').innerHTML=['<option value="">Nessuno</option>',...events.map(e=>`<option value="${e.id}">${esc(e.name)}${e.event_date?' · '+fmtDate(e.event_date):''}</option>`)].join('');
 $('ccProject').innerHTML=['<option value="">Nessuno</option>',...projects.map(p=>`<option value="${p.id}">${esc(p.title)}</option>`)].join('');
}

function setTab(name){activeTab=name;document.querySelectorAll('.contacts-tab').forEach(b=>b.classList.toggle('active',b.dataset.ctab===name));document.querySelectorAll('.contact-tab-panel').forEach(p=>p.classList.toggle('active',p.id==='contact-panel-'+name));if(name==='history')renderTimeline()}

function renderContacts(){
 const active=contacts.filter(c=>c.active).length,fav=contacts.filter(c=>c.active&&c.favorite).length,returning=contacts.filter(c=>collabsFor(c.id).length>=2).length;
 $('contactsActive').textContent=active;$('contactsFavorite').textContent=fav;$('contactsCollaborations').textContent=collaborations.length;$('contactsReturning').textContent=returning;
 renderDirectory();renderTimeline();
}

function renderDirectory(){
 const q=$('contactSearch')?.value?.toLowerCase().trim()||'',tf=$('contactTypeFilter')?.value||'all',sf=$('contactStatusFilter')?.value||'active';
 let rows=contacts.filter(c=>tf==='all'||c.contact_type===tf).filter(c=>sf==='all'||(sf==='active'?c.active:sf==='inactive'?!c.active:c.favorite));
 if(q)rows=rows.filter(c=>[c.name,c.organization,c.email,c.phone,c.instagram,c.city,c.notes,...(c.tags||[])].some(v=>(v||'').toLowerCase().includes(q)));
 rows.sort((a,b)=>Number(b.favorite)-Number(a.favorite)||a.name.localeCompare(b.name,'it'));
 $('contactsGrid').innerHTML=rows.length?rows.map(contactCard).join(''):'<div class="contact-empty">Nessun contatto trovato.</div>';
}

function contactCard(c){const history=collabsFor(c.id),last=history[0];return `<article class="contact-card ${c.active?'':'inactive'}" onclick="openContact('${c.id}')"><div class="contact-card-top"><span class="contact-type">${typeLabels[c.contact_type]||esc(c.contact_type)}</span><button class="contact-star ${c.favorite?'active':''}" onclick="event.stopPropagation();toggleContactFavorite('${c.id}')" title="Preferito">${c.favorite?'★':'☆'}</button></div><h4>${esc(c.name)}</h4>${c.organization?`<p class="contact-org">${esc(c.organization)}</p>`:''}<div class="contact-meta">${c.email?`<span>✉ ${esc(c.email)}</span>`:''}${c.phone?`<span>☎ ${esc(c.phone)}</span>`:''}${c.instagram?`<span>◎ ${esc(c.instagram)}</span>`:''}${c.city?`<span>⌖ ${esc(c.city)}</span>`:''}</div><div class="contact-card-foot"><div><b>${history.length}</b><span>collaborazioni</span></div><div><b>${last?.collaboration_date?fmtDate(last.collaboration_date):'—'}</b><span>ultima</span></div></div>${!c.active?'<div class="contact-archived">Archiviato</div>':''}</article>`}

function renderTimeline(){
 const rows=collaborations.slice().sort((a,b)=>(b.collaboration_date||'').localeCompare(a.collaboration_date||'')||new Date(b.created_at)-new Date(a.created_at));
 $('collaborationsTimeline').innerHTML=rows.length?rows.map(c=>`<article class="collaboration-item" onclick="openCollaboration('${c.id}')"><div class="collaboration-date"><b>${c.collaboration_date?fmtDate(c.collaboration_date):'—'}</b></div><div class="collaboration-body"><div class="collaboration-title"><h4>${esc(c.title)}</h4>${c.role?`<span>${esc(c.role)}</span>`:''}</div><p><strong>${esc(contactName(c.contact_id))}</strong>${collabContext(c)?' · '+esc(collabContext(c)):''}</p>${c.notes?`<small>${esc(c.notes)}</small>`:''}</div></article>`).join(''):'<div class="contact-empty">Nessuna collaborazione registrata.</div>';
}

function renderContactHistory(id){const rows=collabsFor(id);$('contactHistoryCount').textContent=`${rows.length} ${rows.length===1?'collaborazione':'collaborazioni'}`;$('contactHistoryList').innerHTML=rows.length?rows.map(c=>`<article class="contact-history-item" onclick="openCollaboration('${c.id}')"><div><b>${esc(c.title)}</b><span>${c.collaboration_date?fmtDate(c.collaboration_date):'Data non indicata'}${c.role?' · '+esc(c.role):''}</span></div><span>›</span></article>`).join(''):'<div class="contact-empty">Nessuna collaborazione ancora registrata.</div>'}

function clearContactForm(){editContactId=null;$('contactForm').reset();$('contactDlgTitle').textContent='Nuovo contatto';$('cType').value='person';$('cActive').value='true';$('cFavorite').checked=false;$('contactDeleteBtn').style.display='none';$('contactHistoryCount').textContent='0 collaborazioni';$('contactHistoryList').innerHTML='<div class="contact-empty">Salva prima il contatto per aggiungere collaborazioni.</div>';window.club42EntityTools?.clearTarget('contactDlg')}
window.openContact=id=>{const c=contacts.find(x=>x.id===id);if(!c)return;editContactId=id;$('contactDlgTitle').textContent=c.name;$('cName').value=c.name||'';$('cOrganization').value=c.organization||'';$('cType').value=c.contact_type||'person';$('cActive').value=String(c.active);$('cEmail').value=c.email||'';$('cPhone').value=c.phone||'';$('cInstagram').value=c.instagram||'';$('cWebsite').value=c.website||'';$('cCity').value=c.city||'';$('cAddress').value=c.address||'';$('cTags').value=(c.tags||[]).join(', ');$('cNotes').value=c.notes||'';$('cFavorite').checked=!!c.favorite;$('contactDeleteBtn').style.display='inline-flex';renderContactHistory(id);window.club42EntityTools?.setTarget('contactDlg','contact',id,c.name);$('contactDlg').showModal()};

async function saveContact(ev){ev.preventDefault();const row={name:$('cName').value.trim(),organization:$('cOrganization').value.trim()||null,contact_type:$('cType').value,email:$('cEmail').value.trim()||null,phone:$('cPhone').value.trim()||null,instagram:$('cInstagram').value.trim()||null,website:$('cWebsite').value.trim()||null,city:$('cCity').value.trim()||null,address:$('cAddress').value.trim()||null,tags:$('cTags').value.split(',').map(x=>x.trim()).filter(Boolean),favorite:$('cFavorite').checked,active:$('cActive').value==='true',notes:$('cNotes').value.trim()||null};if(editContactId){const {error}=await db.from('contacts').update(row).eq('id',editContactId);if(error)return toast(error.message);toast('Contatto aggiornato')}else{const {data,error}=await db.from('contacts').insert({...row,created_by:app.currentUser.id}).select('id').single();if(error)return toast(error.message);editContactId=data.id;toast('Contatto creato')}$('contactDlg').close();await loadContacts()}
async function deleteContact(){if(!editContactId)return;const c=contacts.find(x=>x.id===editContactId),n=collabsFor(editContactId).length;if(!confirm(`Eliminare definitivamente “${c.name}”?${n?` Verranno eliminate anche ${n} collaborazioni dallo storico.`:''}`))return;const {error}=await db.from('contacts').delete().eq('id',editContactId);if(error)return toast(error.message);$('contactDlg').close();toast('Contatto eliminato');await loadContacts()}
window.toggleContactFavorite=async id=>{const c=contacts.find(x=>x.id===id);if(!c)return;const {error}=await db.from('contacts').update({favorite:!c.favorite}).eq('id',id);if(error)return toast(error.message);await loadContacts()};

function clearCollaborationForm(contactId=null){editCollaborationId=null;$('collaborationForm').reset();$('collaborationDlgTitle').textContent='Nuova collaborazione';$('ccContact').value=contactId||'';$('collaborationDeleteBtn').style.display='none'}
function suggestFromEvent(){const id=$('ccEvent').value;if(!id)return;const e=events.find(x=>x.id===id);if(!e)return;if(!$('ccTitle').value.trim())$('ccTitle').value=e.name;$('ccDate').value=e.event_date||$('ccDate').value}
function suggestFromProject(){const id=$('ccProject').value;if(!id)return;const p=projects.find(x=>x.id===id);if(!p)return;if(!$('ccTitle').value.trim())$('ccTitle').value=p.title}
window.openCollaboration=id=>{const c=collaborations.find(x=>x.id===id);if(!c)return;editCollaborationId=id;$('collaborationDlgTitle').textContent='Modifica collaborazione';$('ccContact').value=c.contact_id;$('ccTitle').value=c.title||'';$('ccDate').value=c.collaboration_date||'';$('ccRole').value=c.role||'';$('ccEvent').value=c.event_id||'';$('ccProject').value=c.project_id||'';$('ccNotes').value=c.notes||'';$('collaborationDeleteBtn').style.display='inline-flex';$('collaborationDlg').showModal()};
function newCollaboration(contactId=null){clearCollaborationForm(contactId);$('collaborationDlg').showModal()}
async function saveCollaboration(ev){ev.preventDefault();const row={contact_id:$('ccContact').value,title:$('ccTitle').value.trim(),collaboration_date:$('ccDate').value||null,role:$('ccRole').value.trim()||null,event_id:$('ccEvent').value||null,project_id:$('ccProject').value||null,notes:$('ccNotes').value.trim()||null};let result;if(editCollaborationId)result=await db.from('contact_collaborations').update(row).eq('id',editCollaborationId);else result=await db.from('contact_collaborations').insert({...row,created_by:app.currentUser.id});if(result.error){if(result.error.code==='23505')return toast('Questo contatto è già collegato a questo evento.');return toast(result.error.message)}$('collaborationDlg').close();toast(editCollaborationId?'Collaborazione aggiornata':'Collaborazione aggiunta');await loadContacts();if(editContactId&&$('contactDlg').open)renderContactHistory(editContactId)}
async function deleteCollaboration(){if(!editCollaborationId)return;if(!confirm('Eliminare questa collaborazione dallo storico?'))return;const {error}=await db.from('contact_collaborations').delete().eq('id',editCollaborationId);if(error)return toast(error.message);$('collaborationDlg').close();toast('Collaborazione eliminata');await loadContacts();if(editContactId&&$('contactDlg').open)renderContactHistory(editContactId)}

function kpiAction(type){if(type==='collaborations'){setTab('history');return}setTab('directory');$('contactTypeFilter').value='all';$('contactStatusFilter').value=type==='favorite'?'favorite':'active';if(type==='returning'){$('contactStatusFilter').value='all';const ids=new Set(contacts.filter(c=>collabsFor(c.id).length>=2).map(c=>c.id));$('contactsGrid').innerHTML=contacts.filter(c=>ids.has(c.id)).map(contactCard).join('')||'<div class="contact-empty">Nessun collaboratore ricorrente.</div>';return}renderDirectory()}

export function initContacts(){
 $('newContactBtn').onclick=()=>{clearContactForm();$('contactDlg').showModal()};$('contactClose').onclick=()=>$('contactDlg').close();$('contactCancel').onclick=()=>$('contactDlg').close();$('contactForm').onsubmit=saveContact;$('contactDeleteBtn').onclick=deleteContact;
 document.querySelectorAll('.contacts-tab').forEach(b=>b.onclick=()=>setTab(b.dataset.ctab));document.querySelectorAll('.contact-kpi').forEach(b=>b.onclick=()=>kpiAction(b.dataset.contactKpi));
 $('contactSearch').oninput=renderDirectory;$('contactTypeFilter').onchange=renderDirectory;$('contactStatusFilter').onchange=renderDirectory;
 $('newCollaborationBtn').onclick=()=>newCollaboration();$('addContactCollaboration').onclick=()=>editContactId?newCollaboration(editContactId):toast('Salva prima il contatto');
 $('collaborationClose').onclick=()=>$('collaborationDlg').close();$('collaborationCancel').onclick=()=>$('collaborationDlg').close();$('collaborationForm').onsubmit=saveCollaboration;$('collaborationDeleteBtn').onclick=deleteCollaboration;$('ccEvent').onchange=suggestFromEvent;$('ccProject').onchange=suggestFromProject;
}
