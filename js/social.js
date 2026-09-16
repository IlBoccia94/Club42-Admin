import {$,app,db,esc,fmtDate,toast} from './core.js';

let contents=[],formats=[],metricsById={},socialUsers=[],calendarCursor=new Date(),activeTab='calendar',editContentId=null,metricsContentId=null;

const statusLabels={idea:'Idea',planned:'Pianificato',production:'In produzione',review:'Revisione',ready:'Pronto',scheduled:'Programmato',published:'Pubblicato',archived:'Archiviato'};
const typeLabels={reel:'Reel',carousel:'Carousel',story:'Stories',post:'Post',live:'Live',other:'Altro'};
const objectiveLabels={discovery:'Scoperta',community:'Community',event:'Evento',culture:'Cultura',conversion:'Conversione'};
const pillarLabels={people:'Persone',stories:'Storie',format:'Format',locality:'Località',conversion:'Conversione'};
const checklistItems=[
 ['hook','Hook forte nel primo secondo'],['clear','Si capisce subito il tema'],['human','Persona, storia o emozione'],['outsider','Comprensibile a un non follower'],['share','Ha un motivo per essere condiviso'],['local','Rilevante per il pubblico locale'],['cta','CTA sensata e contestuale'],['identity','Rafforza l’identità Club42'],['desire','Fa desiderare di partecipare/seguire'],['repurpose','Può generare altri tagli o Stories']
];

function typeBadge(t){return `<span class="social-type">${typeLabels[t]||t}</span>`}
function byId(id){return contents.find(x=>x.id===id)}
function personName(id){return socialUsers.find(x=>x.user_id===id)?.display_name||''}
function localDate(d){if(!d)return'';return fmtDate(d)}

export async function loadSocial(){
 const [cr,fr,mr,ur]=await Promise.all([
  db.from('social_content').select('*').order('scheduled_date',{ascending:true,nullsFirst:false}).order('created_at',{ascending:false}),
  db.from('social_formats').select('*').eq('active',true).order('name'),
  db.from('social_metrics').select('*'),
  db.from('admin_users').select('user_id,display_name,email,active,status').eq('active',true).eq('status','active').order('display_name')
 ]);
 if(cr.error||fr.error||mr.error||ur.error){console.error(cr.error||fr.error||mr.error||ur.error);toast('Errore nel caricamento Social');return}
 contents=cr.data||[];formats=fr.data||[];socialUsers=ur.data||[];metricsById=Object.fromEntries((mr.data||[]).map(m=>[m.content_id,m]));
 populateSocialSelects();renderSocial();
}

function populateSocialSelects(){
 if(!$('scFormat'))return;
 $('scFormat').innerHTML='<option value="">Nessun format</option>'+formats.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('');
 $('scEvent').innerHTML='<option value="">Nessun evento</option>'+app.state.events.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(e=>`<option value="${e.id}">${esc(e.name)} · ${fmtDate(e.date)}</option>`).join('');
 $('scAssigned').innerHTML='<option value="">Non assegnato</option>'+socialUsers.map(u=>`<option value="${u.user_id}">${esc(u.display_name||u.email)}</option>`).join('');
}

function renderSocial(){renderSocialMetrics();renderCalendar();renderPipeline();renderIdeas();renderAnalytics();showSocialTab(activeTab,false)}
function renderSocialMetrics(){
 const now=new Date(),month=now.getMonth(),year=now.getFullYear();
 const thisMonth=contents.filter(c=>c.scheduled_date&&new Date(c.scheduled_date+'T12:00:00').getMonth()===month&&new Date(c.scheduled_date+'T12:00:00').getFullYear()===year);
 $('socialPlanned').textContent=thisMonth.filter(c=>!['published','archived'].includes(c.status)).length;
 $('socialPublished').textContent=thisMonth.filter(c=>c.status==='published').length;
 $('socialIdeas').textContent=contents.filter(c=>c.status==='idea').length;
 $('socialReady').textContent=contents.filter(c=>['ready','scheduled'].includes(c.status)).length;
}

function monthRange(){const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();return{y,m,first:new Date(y,m,1),last:new Date(y,m+1,0)}}
function renderCalendar(){
 if(!$('socialCalendar'))return;const {y,m,first,last}=monthRange();
 $('socialMonthLabel').textContent=new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(first);
 const start=(first.getDay()+6)%7,total=Math.ceil((start+last.getDate())/7)*7;let html='';
 for(let i=0;i<total;i++){
  const day=i-start+1;if(day<1||day>last.getDate()){html+='<div class="social-day outside"></div>';continue}
  const key=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const items=contents.filter(c=>c.scheduled_date===key).sort((a,b)=>(a.scheduled_time||'').localeCompare(b.scheduled_time||''));
  html+=`<div class="social-day"><div class="social-day-num">${day}</div><div class="social-day-items">${items.map(c=>`<button class="social-cal-item social-cal-${c.content_type}" onclick="openSocialContent('${c.id}')"><span>${c.scheduled_time?c.scheduled_time.slice(0,5)+' · ':''}${typeLabels[c.content_type]||c.content_type}</span><b>${esc(c.title)}</b></button>`).join('')}</div><button class="social-day-add" onclick="newSocialContent('${key}')">＋</button></div>`;
 }
 $('socialCalendar').innerHTML=html;
}

function renderPipeline(){
 if(!$('socialPipeline'))return;const stages=['idea','planned','production','review','ready','scheduled','published'];
 $('socialPipeline').innerHTML=stages.map(s=>{const rows=contents.filter(c=>c.status===s);return `<div class="social-column"><div class="social-column-head"><b>${statusLabels[s]}</b><span>${rows.length}</span></div><div class="social-column-body">${rows.map(c=>socialCard(c)).join('')||'<div class="social-empty-mini">Nessun contenuto</div>'}</div></div>`}).join('');
}
function socialCard(c){return `<article class="social-card" onclick="openSocialContent('${c.id}')"><div class="social-card-top">${typeBadge(c.content_type)}<span class="priority priority-${c.priority}">${c.priority}</span></div><h4>${esc(c.title)}</h4><p>${c.scheduled_date?localDate(c.scheduled_date):'Data da definire'}${c.scheduled_time?' · '+c.scheduled_time.slice(0,5):''}</p><div class="social-card-meta"><span>${objectiveLabels[c.objective]}</span>${c.assigned_to?`<span>👤 ${esc(personName(c.assigned_to))}</span>`:''}</div></article>`}

function renderIdeas(){
 if(!$('socialIdeasList'))return;
 const ideas=contents.filter(c=>c.status==='idea');
 $('socialIdeasList').innerHTML=ideas.length?ideas.map(c=>`<article class="social-idea" onclick="openSocialContent('${c.id}')"><div>${typeBadge(c.content_type)} <span class="role-pill">${objectiveLabels[c.objective]}</span></div><h4>${esc(c.title)}</h4><p>${esc(c.hook||c.production_notes||'Nessun dettaglio ancora.')}</p></article>`).join(''):'<div class="empty">Nessuna idea salvata. È un ottimo momento per crearne una.</div>';
 $('socialFormats').innerHTML=formats.map(f=>`<article class="social-format"><div>${typeBadge(f.default_type)} <span class="role-pill">${objectiveLabels[f.default_objective]}</span></div><h4>${esc(f.name)}</h4><p>${esc(f.description||'')}</p><small>KPI: ${esc(f.primary_kpi||'da definire')}</small><button class="btn" onclick="event.stopPropagation();newFromFormat('${f.id}')">Usa format</button></article>`).join('');
}

function sumMetric(key){return Object.values(metricsById).reduce((s,m)=>s+Number(m[key]||0),0)}
function renderAnalytics(){
 if(!$('socialAnalyticsRows'))return;
 $('anaViews').textContent=sumMetric('views').toLocaleString('it-IT');
 $('anaShares').textContent=sumMetric('shares').toLocaleString('it-IT');
 $('anaSaves').textContent=sumMetric('saves').toLocaleString('it-IT');
 $('anaFollowers').textContent=sumMetric('followers_gained').toLocaleString('it-IT');
 $('anaBookings').textContent=sumMetric('bookings').toLocaleString('it-IT');
 $('anaAttendees').textContent=sumMetric('first_time_attendees').toLocaleString('it-IT');
 const published=contents.filter(c=>c.status==='published');
 $('socialAnalyticsRows').innerHTML=published.length?published.map(c=>{const m=metricsById[c.id]||{};return `<tr><td><b>${esc(c.title)}</b><br><span class="muted">${typeLabels[c.content_type]} · ${objectiveLabels[c.objective]}</span></td><td>${Number(m.views||0).toLocaleString('it-IT')}</td><td>${Number(m.non_follower_reach||0).toLocaleString('it-IT')}</td><td>${Number(m.shares||0)}</td><td>${Number(m.saves||0)}</td><td>${Number(m.profile_visits||0)}</td><td>${Number(m.followers_gained||0)}</td><td>${Number(m.completion_rate||0)}%</td><td>${Number(m.bookings||0)}</td><td><button class="icon-btn" onclick="openSocialMetrics('${c.id}')">↗</button></td></tr>`}).join(''):'<tr><td colspan="10" class="empty">Nessun contenuto pubblicato con metriche.</td></tr>';
}

function showSocialTab(tab,update=true){activeTab=tab;document.querySelectorAll('[data-social-tab]').forEach(b=>b.classList.toggle('active',b.dataset.socialTab===tab));document.querySelectorAll('.social-tab-panel').forEach(p=>p.classList.toggle('active',p.id==='social-tab-'+tab));if(update)sessionStorage.setItem('club42_social_tab',tab)}

function clearContentForm(){
 editContentId=null;
 $('socialContentDlgTitle').textContent='Nuovo contenuto';
 $('socialContentForm').reset();
 $('scPlatform').value='instagram';$('scType').value='reel';$('scObjective').value='discovery';$('scPillar').value='locality';$('scStatus').value='idea';$('scPriority').value='medium';
 $('socialDeleteBtn').style.display='none';
 $('socialMetricsBtn').style.display='none';
 checklistItems.forEach(([k])=>{const el=$('check_'+k);if(el)el.checked=false});
}
window.newSocialContent=(date='')=>{clearContentForm();$('scDate').value=date;$('socialContentDlg').showModal()};
window.newFromFormat=id=>{clearContentForm();const f=formats.find(x=>x.id===id);if(f){$('scFormat').value=f.id;$('scType').value=f.default_type;$('scObjective').value=f.default_objective;$('scPillar').value=f.default_pillar;$('scTitle').value=f.name}$('socialContentDlg').showModal()};
window.openSocialContent=id=>{const c=byId(id);if(!c)return;editContentId=id;$('socialContentDlgTitle').textContent='Modifica contenuto';$('scTitle').value=c.title;$('scPlatform').value=c.platform;$('scType').value=c.content_type;$('scObjective').value=c.objective;$('scPillar').value=c.pillar;$('scStatus').value=c.status;$('scPriority').value=c.priority;$('scDate').value=c.scheduled_date||'';$('scTime').value=(c.scheduled_time||'').slice(0,5);$('scFormat').value=c.format_id||'';$('scEvent').value=c.event_id||'';$('scAssigned').value=c.assigned_to||'';$('scHook').value=c.hook||'';$('scCta').value=c.cta||'';$('scCaption').value=c.caption||'';$('scNotes').value=c.production_notes||'';$('scAsset').value=c.asset_url||'';$('scPublishedUrl').value=c.published_url||'';checklistItems.forEach(([k])=>{const el=$('check_'+k);if(el)el.checked=!!c.checklist?.[k]});$('socialDeleteBtn').style.display='inline-flex';$('socialMetricsBtn').style.display=c.status==='published'?'inline-flex':'none';$('socialContentDlg').showModal()};

async function saveContent(ev){ev.preventDefault();const checklist=Object.fromEntries(checklistItems.map(([k])=>[k,!!$('check_'+k)?.checked]));const row={title:$('scTitle').value.trim(),platform:$('scPlatform').value,content_type:$('scType').value,objective:$('scObjective').value,pillar:$('scPillar').value,status:$('scStatus').value,priority:$('scPriority').value,scheduled_date:$('scDate').value||null,scheduled_time:$('scTime').value||null,format_id:$('scFormat').value||null,event_id:$('scEvent').value||null,assigned_to:$('scAssigned').value||null,hook:$('scHook').value.trim()||null,cta:$('scCta').value.trim()||null,caption:$('scCaption').value.trim()||null,production_notes:$('scNotes').value.trim()||null,asset_url:$('scAsset').value.trim()||null,published_url:$('scPublishedUrl').value.trim()||null,checklist};if(row.status==='published'&&!editContentId)row.published_at=new Date().toISOString();let r;if(editContentId){if(row.status==='published'&&!byId(editContentId)?.published_at)row.published_at=new Date().toISOString();r=await db.from('social_content').update(row).eq('id',editContentId)}else r=await db.from('social_content').insert({...row,created_by:app.currentUser.id});if(r.error)return toast(r.error.message);$('socialContentDlg').close();toast(editContentId?'Contenuto aggiornato':'Contenuto creato');await loadSocial()}
async function deleteContent(){if(!editContentId)return;if(!confirm('Eliminare definitivamente questo contenuto editoriale?'))return;const {error}=await db.from('social_content').delete().eq('id',editContentId);if(error)return toast(error.message);$('socialContentDlg').close();toast('Contenuto eliminato');await loadSocial()}

window.openSocialMetrics=id=>{metricsContentId=id;const c=byId(id);if(!c)return;const m=metricsById[id]||{};$('metricsContentTitle').textContent=c.title;['views','reach','non_follower_reach','likes','comments','shares','saves','profile_visits','followers_gained','avg_watch_time_seconds','completion_rate','link_clicks','dm_inquiries','bookings','first_time_attendees'].forEach(k=>{$('sm_'+k).value=m[k]??0});$('socialMetricsDlg').showModal()};
async function saveMetrics(ev){ev.preventDefault();const row={content_id:metricsContentId};['views','reach','non_follower_reach','likes','comments','shares','saves','profile_visits','followers_gained','avg_watch_time_seconds','completion_rate','link_clicks','dm_inquiries','bookings','first_time_attendees'].forEach(k=>row[k]=Number($('sm_'+k).value)||0);const {error}=await db.from('social_metrics').upsert(row,{onConflict:'content_id'});if(error)return toast(error.message);$('socialMetricsDlg').close();toast('Metriche aggiornate');await loadSocial()}

export function initSocial(){
 activeTab=sessionStorage.getItem('club42_social_tab')||'calendar';
 document.querySelectorAll('[data-social-tab]').forEach(b=>b.onclick=()=>showSocialTab(b.dataset.socialTab));
 $('socialPrevMonth').onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar()};
 $('socialNextMonth').onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar()};
 $('socialToday').onclick=()=>{calendarCursor=new Date();renderCalendar()};
 $('newSocialContentBtn').onclick=()=>window.newSocialContent();
 $('socialContentForm').addEventListener('submit',saveContent);
 $('socialDeleteBtn').onclick=deleteContent;
 $('socialMetricsBtn').onclick=()=>{const id=editContentId;$('socialContentDlg').close();window.openSocialMetrics(id)};
 $('socialMetricsForm').addEventListener('submit',saveMetrics);
 $('scFormat').onchange=()=>{const f=formats.find(x=>x.id===$('scFormat').value);if(!f)return;$('scType').value=f.default_type;$('scObjective').value=f.default_objective;$('scPillar').value=f.default_pillar};
}
