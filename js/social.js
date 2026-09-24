import {$,app,db,esc,fmtDate,toast} from './core.js';

let contents=[],formats=[],metricsById={},socialUsers=[],socialVoteUsers=[],socialIdeaVotes=[],calendarCursor=new Date(),activeTab='calendar',editContentId=null,metricsContentId=null,seriesScopeResolver=null;

const statusLabels={idea:'Idea',planned:'Pianificato',production:'In produzione',review:'Revisione',ready:'Pronto',scheduled:'Programmato',published:'Pubblicato',archived:'Archiviato'};
const typeLabels={reel:'Reel',carousel:'Carousel',story:'Stories',post:'Post',live:'Live',other:'Altro'};
const objectiveLabels={discovery:'Scoperta',community:'Community',event:'Evento',culture:'Cultura',conversion:'Conversione'};
const pillarLabels={people:'Persone',stories:'Storie',format:'Format',locality:'Località',conversion:'Conversione'};
const checklistItems=[
 ['hook','Hook forte nel primo secondo'],['clear','Si capisce subito il tema'],['human','Persona, storia o emozione'],['outsider','Comprensibile a un non follower'],['share','Ha un motivo per essere condiviso'],['local','Rilevante per il pubblico locale'],['cta','CTA sensata e contestuale'],['identity','Rafforza l’identità Club42'],['desire','Fa desiderare di partecipare/seguire'],['repurpose','Può generare altri tagli o Stories']
];

function typeBadge(t){return `<span class="social-type">${typeLabels[t]||t}</span>`}
function byId(id){const key=String(id??'').trim();return contents.find(x=>String(x.id??'').trim()===key)}
function personName(id){return socialUsers.find(x=>x.user_id===id)?.display_name||''}
function localDate(d){if(!d)return'';return fmtDate(d)}
function canVoteSocialIdea(){return ['admin','staff','treasurer'].includes(app.currentProfile?.role||'')}
function socialVotesFor(id){return socialIdeaVotes.filter(v=>v.content_id===id)}
function socialVoteUserName(id){const u=socialVoteUsers.find(x=>x.user_id===id)||socialUsers.find(x=>x.user_id===id);return u?.display_name||u?.email||'Utente non disponibile'}
function socialIdeaVoteStats(id){const vv=socialVotesFor(id),me=vv.find(v=>v.voter_id===app.currentUser?.id);return{positive:vv.filter(v=>Number(v.vote)===1).length,negative:vv.filter(v=>Number(v.vote)===-1).length,mine:Number(me?.vote||0)}}
function socialIdeaVoteControls(id,compact=false){const s=socialIdeaVoteStats(id);return `<div class="club-vote-strip${compact?' compact':''}" onclick="event.stopPropagation()"><button type="button" class="club-vote-btn positive ${s.mine===1?'active':''}" aria-label="Voto positivo" aria-pressed="${s.mine===1}" onclick="event.stopPropagation();setSocialIdeaVote('${id}',1)">👍 <b>${s.positive}</b></button><button type="button" class="club-vote-btn negative ${s.mine===-1?'active':''}" aria-label="Voto negativo" aria-pressed="${s.mine===-1}" onclick="event.stopPropagation();setSocialIdeaVote('${id}',-1)">👎 <b>${s.negative}</b></button><button type="button" class="club-vote-details" onclick="event.stopPropagation();openSocialIdeaVotes('${id}')">Chi ha votato</button></div>`}
function ensureSocialIdeaVotesDialog(){if($('socialIdeaVotesDlg'))return;document.body.insertAdjacentHTML('beforeend',`<dialog id="socialIdeaVotesDlg" class="club-votes-dialog"><div class="modal club-votes-modal"><div class="modal-head"><div><div class="social-series-kicker">Valutazione trasparente</div><h3 id="socialIdeaVotesTitle">Voti idea</h3></div><button type="button" class="close" id="socialIdeaVotesClose">×</button></div><div id="socialIdeaVotesBody" class="club-votes-body"></div><div class="modal-actions"><button type="button" class="btn" id="socialIdeaVotesDone">Chiudi</button></div></div></dialog>`);$('socialIdeaVotesClose').onclick=()=>$('socialIdeaVotesDlg').close();$('socialIdeaVotesDone').onclick=()=>$('socialIdeaVotesDlg').close()}
function renderSocialIdeaVotePanel(){
 const wrap=$('socialIdeaVotePanelWrap'),root=$('socialIdeaVotePanel');if(!wrap||!root)return;
 const item=editContentId?byId(editContentId):null;
 const visible=!!item&&$('scStatus')?.value==='idea';
 wrap.hidden=!visible;
 if(!visible){root.innerHTML='';return}
 root.innerHTML=socialIdeaVoteControls(item.id);
}
window.openSocialIdeaVotes=id=>{const item=byId(id);if(!item)return;ensureSocialIdeaVotesDialog();const vv=socialVotesFor(id).slice().sort((a,b)=>socialVoteUserName(a.voter_id).localeCompare(socialVoteUserName(b.voter_id),'it'));const pos=vv.filter(v=>Number(v.vote)===1),neg=vv.filter(v=>Number(v.vote)===-1);$('socialIdeaVotesTitle').textContent=item.title;const list=(rows,empty)=>rows.length?rows.map(v=>`<div class="club-voter-row"><span>${esc(socialVoteUserName(v.voter_id))}</span><b>${Number(v.vote)===1?'👍 Favorevole':'👎 Contrario'}</b></div>`).join(''):`<div class="club-votes-empty">${empty}</div>`;$('socialIdeaVotesBody').innerHTML=`<section><div class="club-votes-section-title"><span>👍 Favorevoli</span><b>${pos.length}</b></div>${list(pos,'Nessun voto positivo.')}</section><section><div class="club-votes-section-title"><span>👎 Contrari</span><b>${neg.length}</b></div>${list(neg,'Nessun voto negativo.')}</section>`;$('socialIdeaVotesDlg').showModal()}
window.setSocialIdeaVote=async(id,vote)=>{if(!canVoteSocialIdea())return toast('Il tuo profilo non può votare le idee Social.');const item=byId(id);if(!item||item.status!=='idea')return toast('Si possono votare solo le idee Social.');const current=socialIdeaVotes.find(v=>v.content_id===id&&v.voter_id===app.currentUser?.id);let result;if(current&&Number(current.vote)===Number(vote))result=await db.from('social_idea_votes').delete().eq('content_id',id).eq('voter_id',app.currentUser.id);else result=await db.from('social_idea_votes').upsert({content_id:id,voter_id:app.currentUser.id,vote:Number(vote),updated_at:new Date().toISOString()},{onConflict:'content_id,voter_id'});if(result.error)return toast(result.error.message);await loadSocial();if(editContentId===id)renderSocialIdeaVotePanel();toast(current&&Number(current.vote)===Number(vote)?'Voto rimosso':'Voto registrato')}


export async function loadSocial(){
 const [cr,fr,mr,ur,vr,vur]=await Promise.all([
  db.from('social_content').select('*').order('scheduled_date',{ascending:true,nullsFirst:false}).order('created_at',{ascending:false}),
  db.from('social_formats').select('*').eq('active',true).order('name'),
  db.from('social_metrics').select('*'),
  db.from('admin_users').select('user_id,display_name,email,active,status').eq('active',true).eq('status','active').order('display_name'),
  db.from('social_idea_votes').select('*'),
  db.from('admin_users').select('user_id,display_name,email,role,active,status')
 ]);
 if(cr.error||fr.error||mr.error||ur.error||vr.error||vur.error){console.error(cr.error||fr.error||mr.error||ur.error||vr.error||vur.error);toast('Errore nel caricamento Social');return}
 contents=cr.data||[];formats=fr.data||[];socialUsers=ur.data||[];socialIdeaVotes=vr.data||[];socialVoteUsers=vur.data||[];metricsById=Object.fromEntries((mr.data||[]).map(m=>[m.content_id,m]));
 populateSocialSelects();renderSocial();
}
window.club42LoadSocial=()=>loadSocial();

function populateSocialSelects(){
 if(!$('scFormat'))return;
 $('scFormat').innerHTML='<option value="">Nessun format</option>'+formats.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('');
 const currentEvent=$('scEvent')?.value||'';
 $('scEvent').innerHTML='<option value="">Nessun evento</option>'+app.state.events.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(e=>`<option value="${e.id}">${esc(e.name)} · ${fmtDate(e.date)}</option>`).join('');
 if(currentEvent&&app.state.events.some(e=>e.id===currentEvent))$('scEvent').value=currentEvent;
 $('scAssigned').innerHTML='<option value="">Non assegnato</option>'+socialUsers.map(u=>`<option value="${u.user_id}">${esc(u.display_name||u.email)}</option>`).join('');
 syncSocialEventPickerValue();
}

function socialEventById(id){return app.state.events.find(e=>String(e.id)===String(id))||null}
function isSocialEventEnded(e){
 if(!e)return false;
 if(e.eventStatus)return e.eventStatus==='ended';
 const end=e.endDate||e.date;if(!end)return false;
 const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 return end<today;
}
function socialEventDateText(e){
 if(!e)return'';
 const range=e.endDate&&e.endDate!==e.date?`${fmtDate(e.date)} → ${fmtDate(e.endDate)}`:fmtDate(e.date);
 const time=e.time?String(e.time).slice(0,5):'';
 return [range,time&&`ore ${time}`].filter(Boolean).join(' · ');
}
function syncSocialEventPickerValue(){
 const btn=$('scEventPickerBtn'),label=$('scEventPickerValue');if(!btn||!label)return;
 const e=socialEventById($('scEvent')?.value||'');
 if(!e){label.textContent='Nessun evento';btn.classList.remove('has-value','ended');return}
 label.textContent=`${e.name} · ${fmtDate(e.date)}`;
 btn.classList.add('has-value');
 btn.classList.toggle('ended',isSocialEventEnded(e));
}
function renderSocialEventPicker(){
 const root=$('socialEventPickerList');if(!root)return;
 const q=($('socialEventPickerSearch')?.value||'').trim().toLocaleLowerCase('it');
 const includeEnded=$('socialEventIncludeEnded')?.checked===true;
 const selectedId=$('scEvent')?.value||'';
 const selected=socialEventById(selectedId);
 let rows=app.state.events
  .filter(e=>includeEnded||!isSocialEventEnded(e))
  .filter(e=>!q||[e.name,e.place].some(v=>String(v||'').toLocaleLowerCase('it').includes(q)))
  .sort((a,b)=>{
    const ae=isSocialEventEnded(a),be=isSocialEventEnded(b);
    if(ae!==be)return ae?1:-1;
    return ae?b.date.localeCompare(a.date):a.date.localeCompare(b.date);
  });

 const current=$('socialEventCurrent');
 if(current){
  const showCurrent=!!selected&&isSocialEventEnded(selected)&&!includeEnded;
  current.hidden=!showCurrent;
  if(showCurrent)current.innerHTML=`<div><span>Evento attualmente collegato</span><b>${esc(selected.name)}</b><small>${esc(socialEventDateText(selected))}${selected.place?' · '+esc(selected.place):''} · Terminato</small></div>`;
 }
 if($('socialEventPickerCount'))$('socialEventPickerCount').textContent=`${rows.length} ${rows.length===1?'evento':'eventi'}`;
 root.innerHTML=rows.length?rows.map(e=>{
   const ended=isSocialEventEnded(e),active=String(e.id)===String(selectedId);
   return `<button type="button" class="social-event-picker-card ${active?'selected ':''}${ended?'ended':''}" data-social-event-id="${e.id}">
     <div class="social-event-picker-card-top"><span class="social-event-picker-status ${ended?'ended':'active'}">${ended?'Terminato':'Attivo'}</span>${active?'<span class="social-event-picker-selected">✓ Selezionato</span>':''}</div>
     <b>${esc(e.name)}</b>
     <span>${esc(socialEventDateText(e))}</span>
     <small>${esc(e.place||'Luogo da definire')}</small>
   </button>`;
 }).join(''):'<div class="social-event-picker-empty">Nessun evento corrisponde ai filtri.</div>';

 root.querySelectorAll('[data-social-event-id]').forEach(btn=>btn.onclick=()=>{
   $('scEvent').value=btn.dataset.socialEventId;
   syncSocialEventPickerValue();
   $('socialEventPickerOverlay').hidden=true;
   $('scEventPickerBtn')?.focus();
 });
}
function openSocialEventPicker(){
 if(!$('socialEventPickerOverlay'))return;
 $('socialEventPickerSearch').value='';
 $('socialEventIncludeEnded').checked=false;
 $('socialEventPickerOverlay').hidden=false;
 renderSocialEventPicker();
 setTimeout(()=>$('socialEventPickerSearch')?.focus(),40);
}
function closeSocialEventPicker(){
 if($('socialEventPickerOverlay'))$('socialEventPickerOverlay').hidden=true;
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
  html+=`<div class="social-day"><div class="social-day-num">${day}</div><div class="social-day-items">${items.map(c=>`<button class="social-cal-item social-cal-${c.content_type}" onclick="openSocialContent('${c.id}')"><span>${c.recurrence_group_id?'↻ ':''}${c.scheduled_time?c.scheduled_time.slice(0,5)+' · ':''}${typeLabels[c.content_type]||c.content_type}</span><b>${esc(c.title)}</b></button>`).join('')}</div><button class="social-day-add" onclick="newSocialContent('${key}')">＋</button></div>`;
 }
 $('socialCalendar').innerHTML=html;
}

function pipelineIso(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function pipelinePresetRange(key){
 const now=new Date(),y=now.getFullYear(),m=now.getMonth();
 if(key==='all')return{from:'',to:'',label:'Tutti'};
 if(key==='year')return{from:`${y}-01-01`,to:`${y}-12-31`,label:"Quest'anno"};
 if(key==='next3')return{from:pipelineIso(new Date(y,m,1,12)),to:pipelineIso(new Date(y,m+4,0,12)),label:'Questo mese + prossimi 3 mesi'};
 if(key==='week'){
  const start=new Date(y,m,now.getDate(),12),offset=(start.getDay()+6)%7;
  start.setDate(start.getDate()-offset);
  const end=new Date(start);end.setDate(end.getDate()+6);
  return{from:pipelineIso(start),to:pipelineIso(end),label:'Questa settimana'};
 }
 return{from:pipelineIso(new Date(y,m,1,12)),to:pipelineIso(new Date(y,m+1,0,12)),label:'Questo mese'};
}
function pipelineFilterState(){
 const preset=$('socialPipelinePeriod')?.value||'month';
 const customFrom=$('socialPipelineFrom')?.value||'',customTo=$('socialPipelineTo')?.value||'';
 const custom=!!(customFrom||customTo);
 const base=pipelinePresetRange(preset);
 return{
  preset,custom,
  from:custom?customFrom:base.from,
  to:custom?customTo:base.to,
  label:custom?'Intervallo personalizzato':base.label,
  invalid:!!(customFrom&&customTo&&customFrom>customTo)
 };
}
function matchesPipelineDate(content,state){
 if(state.invalid)return false;
 if(!state.custom&&state.preset==='all')return true;
 const date=content.scheduled_date||'';
 if(!date)return false;
 if(state.from&&date<state.from)return false;
 if(state.to&&date>state.to)return false;
 return true;
}
function syncPipelineFilterUi(state,visibleCount){
 const summary=$('socialPipelineFilterSummary');
 if(summary){
  if(state.invalid)summary.innerHTML='<b>Intervallo non valido</b><span>La data “Da” deve precedere la data “A”.</span>';
  else{
   const range=[state.from&&`dal ${fmtDate(state.from)}`,state.to&&`al ${fmtDate(state.to)}`].filter(Boolean).join(' ');
   summary.innerHTML=`<b>${esc(state.label)}</b><span>${range?esc(range)+' · ':''}${visibleCount} ${visibleCount===1?'contenuto':'contenuti'}</span>`;
  }
 }
 const clear=$('socialPipelineClearDates');if(clear)clear.disabled=!state.custom;
 const from=$('socialPipelineFrom'),to=$('socialPipelineTo');
 if(from)from.max=to?.value||'';
 if(to)to.min=from?.value||'';
}
function renderPipeline(){
 if(!$('socialPipeline'))return;
 const stages=['idea','planned','production','review','ready','scheduled','published'];
 const state=pipelineFilterState();
 const filtered=contents.filter(item=>matchesPipelineDate(item,state));
 $('socialPipeline').innerHTML=stages.map(s=>{
  const rows=filtered.filter(item=>item.status===s);
  return `<div class="social-column"><div class="social-column-head"><b>${statusLabels[s]}</b><span>${rows.length}</span></div><div class="social-column-body">${rows.map(item=>socialCard(item)).join('')||'<div class="social-empty-mini">Nessun contenuto</div>'}</div></div>`
 }).join('');
 syncPipelineFilterUi(state,filtered.filter(item=>stages.includes(item.status)).length);
}
function socialCard(c){return `<article class="social-card" onclick="openSocialContent('${c.id}')"><div class="social-card-top">${typeBadge(c.content_type)}<span class="priority priority-${c.priority}">${c.priority}</span></div><h4>${esc(c.title)}</h4><p>${c.scheduled_date?localDate(c.scheduled_date):'Data da definire'}${c.scheduled_time?' · '+c.scheduled_time.slice(0,5):''}</p><div class="social-card-meta"><span>${objectiveLabels[c.objective]}</span>${c.assigned_to?`<span>👤 ${esc(personName(c.assigned_to))}</span>`:''}</div></article>`}

function renderIdeas(){
 if(!$('socialIdeasList'))return;
 const ideas=contents.filter(c=>c.status==='idea');
 $('socialIdeasList').innerHTML=ideas.length?ideas.map(c=>`<article class="social-idea" onclick="openSocialContent('${c.id}')"><div>${typeBadge(c.content_type)} <span class="role-pill">${objectiveLabels[c.objective]}</span></div><h4>${esc(c.title)}</h4><p>${esc(c.hook||c.production_notes||'Nessun dettaglio ancora.')}</p>${socialIdeaVoteControls(c.id,true)}</article>`).join(''):'<div class="empty">Nessuna idea salvata. È un ottimo momento per crearne una.</div>';
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

function socialDateFromIso(value){
 const [y,m,d]=String(value||'').split('-').map(Number);
 return y&&m&&d?new Date(y,m-1,d,12,0,0,0):null;
}
function socialIsoDate(date){
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function socialAddDays(date,days){const d=new Date(date);d.setDate(d.getDate()+days);return d}
function socialWeekStart(date){const d=new Date(date),offset=(d.getDay()+6)%7;d.setDate(d.getDate()-offset);return d}
function socialMonthCandidate(year,month,day){
 const d=new Date(year,month,day,12,0,0,0);
 return d.getFullYear()===year&&d.getMonth()===month&&d.getDate()===day?d:null;
}
function socialNthWeekday(year,month,nth,weekday){
 if(nth==='last'){
  const d=new Date(year,month+1,0,12,0,0,0);
  d.setDate(d.getDate()-((d.getDay()-weekday+7)%7));
  return d;
 }
 const first=new Date(year,month,1,12,0,0,0);
 const day=1+((weekday-first.getDay()+7)%7)+(Number(nth)-1)*7;
 return socialMonthCandidate(year,month,day);
}
function socialUuid(){
 const c=globalThis.crypto;
 if(c?.randomUUID)return c.randomUUID();
 return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,ch=>{
  const r=Math.random()*16|0,v=ch==='x'?r:(r&3)|8;return v.toString(16)
 });
}
function recurrenceRuleFromForm(){
 return{
  type:$('scRecurrenceType').value,
  interval:Math.max(1,Math.min(12,Number($('scRecurrenceInterval').value)||1)),
  weekdays:[...document.querySelectorAll('[data-recur-weekday]:checked')].map(x=>Number(x.value)),
  dayOfMonth:Math.max(1,Math.min(31,Number($('scRecurrenceMonthDay').value)||1)),
  nth:$('scRecurrenceNth').value,
  weekday:Number($('scRecurrenceWeekday').value),
  endMode:$('scRecurrenceEndMode').value,
  count:Math.max(2,Math.min(104,Number($('scRecurrenceCount').value)||12)),
  until:$('scRecurrenceUntil').value||null
 };
}
function generateRecurrenceDates(){
 const start=socialDateFromIso($('scDate').value);
 if(!start)return{dates:[],error:'Scegli una data di partenza.'};
 const rule=recurrenceRuleFromForm(),dates=[],limit=104;
 const until=rule.endMode==='until'?socialDateFromIso(rule.until):null;
 if(rule.endMode==='until'&&!until)return{dates:[],error:'Scegli la data finale della ricorrenza.'};
 if(until&&until<start)return{dates:[],error:'La data finale deve essere successiva alla data di partenza.'};
 const target=rule.endMode==='count'?rule.count:limit;
 const accept=d=>{
  if(!d||d<start)return false;
  if(until&&d>until)return false;
  const iso=socialIsoDate(d);
  if(!dates.includes(iso))dates.push(iso);
  return dates.length>=target;
 };

 if(rule.type==='daily'){
  let d=new Date(start),guard=0;
  while(dates.length<target&&guard++<5000){
   if(until&&d>until)break;
   accept(d);d=socialAddDays(d,rule.interval);
  }
 }else if(rule.type==='weekly'){
  if(!rule.weekdays.length)return{dates:[],error:'Seleziona almeno un giorno della settimana.'};
  const week0=socialWeekStart(start);let d=new Date(start),guard=0;
  while(dates.length<target&&guard++<5000){
   if(until&&d>until)break;
   const weekIndex=Math.floor(Math.round((socialWeekStart(d)-week0)/86400000)/7);
   if(weekIndex%rule.interval===0&&rule.weekdays.includes(d.getDay()))accept(d);
   d=socialAddDays(d,1);
  }
 }else if(rule.type==='monthly_day'){
  let offset=0,guard=0;
  while(dates.length<target&&guard++<500){
   const monthIndex=start.getMonth()+offset;
   const y=start.getFullYear()+Math.floor(monthIndex/12),m=((monthIndex%12)+12)%12;
   const d=socialMonthCandidate(y,m,rule.dayOfMonth);
   if(until&&d&&d>until)break;
   if(until&&!d){
    const firstNext=new Date(y,m+1,1,12,0,0,0);if(firstNext>until)break;
   }
   accept(d);offset+=rule.interval;
  }
 }else if(rule.type==='monthly_weekday'){
  let offset=0,guard=0;
  while(dates.length<target&&guard++<500){
   const monthIndex=start.getMonth()+offset;
   const y=start.getFullYear()+Math.floor(monthIndex/12),m=((monthIndex%12)+12)%12;
   const d=socialNthWeekday(y,m,rule.nth,rule.weekday);
   if(until&&d&&d>until)break;
   accept(d);offset+=rule.interval;
  }
 }
 if(rule.endMode==='until'&&dates.length>=limit){
  const last=socialDateFromIso(dates[dates.length-1]);
  if(last&&until&&last<until)return{dates,error:'La serie supera il limite di 104 occorrenze. Accorcia il periodo o aumenta l’intervallo.'};
 }
 if(dates.length<2)return{dates,error:'La ricorrenza deve generare almeno 2 contenuti. Modifica intervallo o fine serie.'};
 return{dates:dates.slice(0,limit),rule};
}
function seedWeeklyDayFromStart(){
 if(!$('scDate')?.value)return;
 const boxes=[...document.querySelectorAll('[data-recur-weekday]')];
 if(boxes.some(x=>x.checked))return;
 const d=socialDateFromIso($('scDate').value);if(!d)return;
 const match=boxes.find(x=>Number(x.value)===d.getDay());if(match)match.checked=true;
}
function syncRecurrenceUi(){
 const recurring=$('scRecurring')?.checked&&!editContentId;
 if($('scRecurrencePanel'))$('scRecurrencePanel').hidden=!recurring;
 if(!recurring)return;
 const type=$('scRecurrenceType').value;
 $('scRecurrenceWeekly').hidden=type!=='weekly';
 $('scRecurrenceMonthlyDay').hidden=type!=='monthly_day';
 $('scRecurrenceMonthlyWeekday').hidden=type!=='monthly_weekday';
 $('scRecurrenceUnit').textContent=type==='daily'?'giorno/i':type==='weekly'?'settimana/e':'mese/i';
 const endMode=$('scRecurrenceEndMode').value;
 $('scRecurrenceCountField').hidden=endMode!=='count';
 $('scRecurrenceUntilField').hidden=endMode!=='until';
 if(type==='weekly')seedWeeklyDayFromStart();
 renderRecurrencePreview();
}
function renderRecurrencePreview(){
 const root=$('scRecurrencePreview');if(!root||!$('scRecurring')?.checked||editContentId)return;
 const result=generateRecurrenceDates();
 if(result.error){root.classList.add('error');root.textContent=result.error;return}
 root.classList.remove('error');
 const fmt=new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'short',year:'numeric'});
 const first=result.dates.slice(0,5).map(x=>fmt.format(socialDateFromIso(x))).join(' · ');
 root.innerHTML=`<b>${result.dates.length} contenuti</b><span>${esc(first)}${result.dates.length>5?' · …':''}</span>`;
}
function resetRecurrenceForm(){
 if(!$('scRecurring'))return;
 $('scRecurring').checked=false;$('scRecurring').disabled=false;
 $('scRecurrenceType').value='weekly';$('scRecurrenceInterval').value='1';
 $('scRecurrenceEndMode').value='count';$('scRecurrenceCount').value='12';$('scRecurrenceUntil').value='';
 $('scRecurrenceMonthDay').value='1';$('scRecurrenceNth').value='1';$('scRecurrenceWeekday').value='1';
 document.querySelectorAll('[data-recur-weekday]').forEach(x=>x.checked=false);
 $('scRecurrencePanel').hidden=true;$('scRecurrenceExisting').hidden=true;
}
function seriesRowsForScope(content,scope){
 if(!content)return[];
 if(scope==='single'||!content.recurrence_group_id)return[content];
 const all=contents
  .filter(x=>x.recurrence_group_id===content.recurrence_group_id)
  .sort((a,b)=>(Number(a.recurrence_sequence)||9999)-(Number(b.recurrence_sequence)||9999)||(a.scheduled_date||'9999').localeCompare(b.scheduled_date||'9999'));
 if(scope==='all')return all;
 const seq=Number(content.recurrence_sequence);
 if(Number.isFinite(seq)&&seq>0)return all.filter(x=>Number(x.recurrence_sequence)>=seq);
 if(content.scheduled_date)return all.filter(x=>(x.scheduled_date||'')>=content.scheduled_date);
 const index=all.findIndex(x=>x.id===content.id);
 return index>=0?all.slice(index):[content];
}
function ensureSeriesScopeDialog(){
 if($('socialSeriesActionDlg'))return true;
 document.body.insertAdjacentHTML('beforeend',`
  <dialog id="socialSeriesActionDlg" class="social-series-action-dialog">
    <div class="modal social-series-action-modal">
      <div class="modal-head">
        <div>
          <div class="social-series-kicker">↻ Serie ricorrente</div>
          <h3 id="socialSeriesActionTitle">Come vuoi procedere?</h3>
          <p id="socialSeriesActionText" class="social-series-action-text"></p>
        </div>
        <button type="button" class="close" id="socialSeriesActionClose" aria-label="Chiudi">×</button>
      </div>
      <div class="social-series-scope-list">
        <button type="button" class="social-series-scope" data-series-scope="single">
          <span class="social-series-scope-icon">1</span>
          <span><b>Solo questo contenuto</b><small>Interviene soltanto sull'occorrenza che hai aperto.</small></span>
          <em id="socialSeriesSingleCount">1</em>
        </button>
        <button type="button" class="social-series-scope" data-series-scope="future">
          <span class="social-series-scope-icon">→</span>
          <span><b>Questo e tutti i successivi</b><small>Interviene da questa occorrenza in avanti, lasciando intatti i precedenti.</small></span>
          <em id="socialSeriesFutureCount">0</em>
        </button>
        <button type="button" class="social-series-scope" data-series-scope="all">
          <span class="social-series-scope-icon">↻</span>
          <span><b>Tutta la serie</b><small>Interviene su tutte le occorrenze della stessa serie.</small></span>
          <em id="socialSeriesAllCount">0</em>
        </button>
      </div>
      <div id="socialSeriesDateNote" class="social-series-date-note" hidden>📅 Nelle modifiche multiple ogni occorrenza mantiene la propria data. Un'eventuale nuova data inserita nel form viene applicata solo al contenuto che hai aperto.</div>
      <div class="modal-actions"><button type="button" class="btn" id="socialSeriesActionCancel">Annulla</button></div>
    </div>
  </dialog>`);
 const dlg=$('socialSeriesActionDlg');
 if(!dlg)return false;
 document.querySelectorAll('[data-series-scope]').forEach(btn=>btn.onclick=()=>settleSeriesScope(btn.dataset.seriesScope));
 $('socialSeriesActionCancel').onclick=()=>settleSeriesScope(null);
 $('socialSeriesActionClose').onclick=()=>settleSeriesScope(null);
 dlg.addEventListener('cancel',ev=>{ev.preventDefault();settleSeriesScope(null)});
 return true;
}
function settleSeriesScope(scope=null){
 const dlg=$('socialSeriesActionDlg');
 if(dlg?.open)dlg.close();
 const resolver=seriesScopeResolver;seriesScopeResolver=null;
 if(resolver)resolver(scope);
}
function chooseSeriesScope(action,content){
 if(!content?.recurrence_group_id)return Promise.resolve('single');
 if(!ensureSeriesScopeDialog()){
  toast('Impossibile aprire la scelta della serie.');
  return Promise.resolve(null);
 }
 const single=seriesRowsForScope(content,'single').length;
 const future=seriesRowsForScope(content,'future').length;
 const all=seriesRowsForScope(content,'all').length;
 $('socialSeriesSingleCount').textContent=String(single);
 $('socialSeriesFutureCount').textContent=String(future);
 $('socialSeriesAllCount').textContent=String(all);
 const deleting=action==='delete';
 $('socialSeriesActionDlg').classList.toggle('delete-mode',deleting);
 $('socialSeriesActionTitle').textContent=deleting?'Quali contenuti vuoi eliminare?':'A quali contenuti vuoi applicare le modifiche?';
 $('socialSeriesActionText').textContent=deleting
  ?'L’eliminazione è definitiva. Scegli quanto della serie vuoi rimuovere.'
  :'Scegli se aggiornare soltanto questa occorrenza, da questa in avanti oppure l’intera serie.';
 $('socialSeriesDateNote').hidden=deleting;
 return new Promise(resolve=>{
  if(seriesScopeResolver)seriesScopeResolver(null);
  seriesScopeResolver=resolve;
  const dlg=$('socialSeriesActionDlg');
  try{
   if(dlg.open)dlg.close();
   dlg.showModal();
  }catch(error){
   console.error('Apertura selezione serie Social',error);
   seriesScopeResolver=null;
   resolve(null);
   toast('Impossibile aprire la scelta della serie.');
  }
 });
}
async function updateRecurringContent(content,row,scope){
 const targets=seriesRowsForScope(content,scope);
 if(!targets.length)return{error:{message:'Nessun contenuto della serie trovato.'},count:0};
 if(scope==='single'){
  const result=await db.from('social_content').update(row).eq('id',content.id);
  return{...result,count:1};
 }
 const bulkRow={...row};
 delete bulkRow.scheduled_date;
 const ids=targets.map(x=>x.id);
 const result=await db.from('social_content').update(bulkRow).in('id',ids);
 if(result.error)return{...result,count:0};
 if(row.scheduled_date!==content.scheduled_date){
  const dateResult=await db.from('social_content').update({scheduled_date:row.scheduled_date}).eq('id',content.id);
  if(dateResult.error)return{error:dateResult.error,count:ids.length};
 }
 return{...result,count:ids.length};
}
async function deleteRecurringContent(content,scope){
 const targets=seriesRowsForScope(content,scope);
 if(!targets.length)return{error:{message:'Nessun contenuto della serie trovato.'},count:0};
 const result=await db.from('social_content').delete().in('id',targets.map(x=>x.id));
 return{...result,count:targets.length};
}

function clearContentForm(){
 editContentId=null;
 $('socialContentDlgTitle').textContent='Nuovo contenuto';
 $('socialContentForm').reset();
 $('scPlatform').value='instagram';$('scType').value='reel';$('scObjective').value='discovery';$('scPillar').value='locality';$('scStatus').value='idea';$('scPriority').value='medium';
 $('socialDeleteBtn').style.display='none';
 $('socialMetricsBtn').style.display='none';
 resetRecurrenceForm();
 if($('socialIdeaVotePanelWrap'))$('socialIdeaVotePanelWrap').hidden=true;
 if($('socialIdeaVotePanel'))$('socialIdeaVotePanel').innerHTML='';
 checklistItems.forEach(([k])=>{const el=$('check_'+k);if(el)el.checked=false});
 syncSocialEventPickerValue();
}
window.newSocialContent=(date='')=>{clearContentForm();$('scDate').value=date;seedWeeklyDayFromStart();$('socialContentDlg').showModal()};
window.newFromFormat=id=>{clearContentForm();const f=formats.find(x=>x.id===id);if(f){$('scFormat').value=f.id;$('scType').value=f.default_type;$('scObjective').value=f.default_objective;$('scPillar').value=f.default_pillar;$('scTitle').value=f.name}$('socialContentDlg').showModal()};
window.openSocialContent=id=>{
 try{
  const c=byId(id);if(!c)return toast('Contenuto non trovato.');
  const dlg=$('socialContentDlg');if(!dlg)return toast('Modulo Social non disponibile. Ricarica la pagina.');
  editContentId=id;
  $('socialContentDlgTitle').textContent='Modifica contenuto';
  $('scTitle').value=c.title||'';
  $('scPlatform').value=c.platform||'instagram';
  $('scType').value=c.content_type||'reel';
  $('scObjective').value=c.objective||'discovery';
  $('scPillar').value=c.pillar||'locality';
  $('scStatus').value=c.status||'idea';
  $('scPriority').value=c.priority||'medium';
  $('scDate').value=c.scheduled_date||'';
  $('scTime').value=(c.scheduled_time||'').slice(0,5);
  $('scFormat').value=c.format_id||'';
  $('scEvent').value=c.event_id||'';
  syncSocialEventPickerValue();
  $('scAssigned').value=c.assigned_to||'';
  $('scHook').value=c.hook||'';
  $('scCta').value=c.cta||'';
  $('scCaption').value=c.caption||'';
  $('scNotes').value=c.production_notes||'';
  $('scAsset').value=c.asset_url||'';
  $('scPublishedUrl').value=c.published_url||'';
  resetRecurrenceForm();
  $('scRecurring').disabled=true;
  $('scRecurrenceExisting').hidden=!c.recurrence_group_id;
  renderSocialIdeaVotePanel();
  checklistItems.forEach(([k])=>{const el=$('check_'+k);if(el)el.checked=!!c.checklist?.[k]});
  $('socialDeleteBtn').style.display='inline-flex';
  $('socialMetricsBtn').style.display=c.status==='published'?'inline-flex':'none';
  if(dlg.open)dlg.close();
  dlg.showModal();
 }catch(error){
  console.error('Apertura contenuto Social',error);
  toast('Errore nell’apertura del contenuto. Ricarica la pagina e riprova.');
 }
};

async function saveContent(ev){
 ev.preventDefault();
 const checklist=Object.fromEntries(checklistItems.map(([k])=>[k,!!$('check_'+k)?.checked]));
 const row={title:$('scTitle').value.trim(),platform:$('scPlatform').value,content_type:$('scType').value,objective:$('scObjective').value,pillar:$('scPillar').value,status:$('scStatus').value,priority:$('scPriority').value,scheduled_date:$('scDate').value||null,scheduled_time:$('scTime').value||null,format_id:$('scFormat').value||null,event_id:$('scEvent').value||null,assigned_to:$('scAssigned').value||null,hook:$('scHook').value.trim()||null,cta:$('scCta').value.trim()||null,caption:$('scCaption').value.trim()||null,production_notes:$('scNotes').value.trim()||null,asset_url:$('scAsset').value.trim()||null,published_url:$('scPublishedUrl').value.trim()||null,checklist};
 if(row.status==='published'&&!editContentId)row.published_at=new Date().toISOString();

 let r,affected=0;
 if(editContentId){
  const current=byId(editContentId);
  if(row.status==='published'&&!current?.published_at)row.published_at=new Date().toISOString();
  if(current?.recurrence_group_id){
   const scope=await chooseSeriesScope('edit',current);
   if(!scope)return;
   r=await updateRecurringContent(current,row,scope);
   affected=r.count||0;
  }else{
   r=await db.from('social_content').update(row).eq('id',editContentId);
   affected=1;
  }
 }else if($('scRecurring')?.checked){
  const generated=generateRecurrenceDates();
  if(generated.error)return toast(generated.error);
  const groupId=socialUuid();
  const rows=generated.dates.map((date,index)=>({
   ...row,
   scheduled_date:date,
   recurrence_group_id:groupId,
   recurrence_sequence:index+1,
   recurrence_rule:generated.rule,
   created_by:app.currentUser.id
  }));
  r=await db.from('social_content').insert(rows);
  if(!r.error)toast(`Serie creata: ${rows.length} contenuti nel calendario`);
 }else{
  r=await db.from('social_content').insert({...row,created_by:app.currentUser.id});
 }
 if(r.error)return toast(r.error.message);
 $('socialContentDlg').close();
 if(editContentId)toast(affected>1?`${affected} contenuti della serie aggiornati`:'Contenuto aggiornato');else if(!$('scRecurring')?.checked)toast('Contenuto creato');
 await loadSocial()
}
async function deleteContent(){
 if(!editContentId)return;
 const current=byId(editContentId);if(!current)return;
 let result,count=1;
 if(current.recurrence_group_id){
  const scope=await chooseSeriesScope('delete',current);
  if(!scope)return;
  result=await deleteRecurringContent(current,scope);
  count=result.count||0;
 }else{
  if(!confirm('Eliminare definitivamente questo contenuto editoriale?'))return;
  result=await db.from('social_content').delete().eq('id',editContentId);
 }
 if(result.error)return toast(result.error.message);
 $('socialContentDlg').close();
 toast(count>1?`${count} contenuti della serie eliminati`:'Contenuto eliminato');
 await loadSocial()
}

window.openSocialMetrics=id=>{metricsContentId=id;const c=byId(id);if(!c)return;const m=metricsById[id]||{};$('metricsContentTitle').textContent=c.title;['views','reach','non_follower_reach','likes','comments','shares','saves','profile_visits','followers_gained','avg_watch_time_seconds','completion_rate','link_clicks','dm_inquiries','bookings','first_time_attendees'].forEach(k=>{$('sm_'+k).value=m[k]??0});$('socialMetricsDlg').showModal()};
async function saveMetrics(ev){ev.preventDefault();const row={content_id:metricsContentId};['views','reach','non_follower_reach','likes','comments','shares','saves','profile_visits','followers_gained','avg_watch_time_seconds','completion_rate','link_clicks','dm_inquiries','bookings','first_time_attendees'].forEach(k=>row[k]=Number($('sm_'+k).value)||0);const {error}=await db.from('social_metrics').upsert(row,{onConflict:'content_id'});if(error)return toast(error.message);$('socialMetricsDlg').close();toast('Metriche aggiornate');await loadSocial()}

export function initSocial(){
 activeTab=sessionStorage.getItem('club42_social_tab')||'calendar';
 document.querySelectorAll('[data-social-tab]').forEach(b=>b.onclick=()=>showSocialTab(b.dataset.socialTab));
 $('socialPrevMonth').onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar()};
 $('socialNextMonth').onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar()};
 $('socialToday').onclick=()=>{calendarCursor=new Date();renderCalendar()};
 $('socialPipelinePeriod').value='month';
 $('socialPipelinePeriod').addEventListener('change',renderPipeline);
 $('socialPipelineFrom').addEventListener('change',renderPipeline);
 $('socialPipelineTo').addEventListener('change',renderPipeline);
 $('socialPipelineClearDates').onclick=()=>{$('socialPipelineFrom').value='';$('socialPipelineTo').value='';renderPipeline()};
 $('newSocialContentBtn').onclick=()=>window.newSocialContent();
 $('socialContentForm').addEventListener('submit',saveContent);
 $('socialDeleteBtn').onclick=deleteContent;
 $('socialMetricsBtn').onclick=()=>{const id=editContentId;$('socialContentDlg').close();window.openSocialMetrics(id)};
 $('socialMetricsForm').addEventListener('submit',saveMetrics);
 $('scRecurring').onchange=syncRecurrenceUi;
 ['scRecurrenceType','scRecurrenceInterval','scRecurrenceEndMode','scRecurrenceCount','scRecurrenceUntil','scRecurrenceMonthDay','scRecurrenceNth','scRecurrenceWeekday'].forEach(id=>$(id).addEventListener(id==='scRecurrenceInterval'||id==='scRecurrenceCount'||id==='scRecurrenceMonthDay'?'input':'change',syncRecurrenceUi));
 document.querySelectorAll('[data-recur-weekday]').forEach(x=>x.onchange=renderRecurrencePreview);
 $('scDate').addEventListener('change',()=>{if($('scRecurring').checked){seedWeeklyDayFromStart();syncRecurrenceUi()}});
 $('scStatus').addEventListener('change',renderSocialIdeaVotePanel);
 $('scEventPickerBtn').onclick=openSocialEventPicker;
 $('socialEventPickerClose').onclick=closeSocialEventPicker;
 $('socialEventPickerSearch').addEventListener('input',renderSocialEventPicker);
 $('socialEventIncludeEnded').addEventListener('change',renderSocialEventPicker);
 $('socialEventClear').onclick=()=>{$('scEvent').value='';syncSocialEventPickerValue();closeSocialEventPicker();$('scEventPickerBtn')?.focus()};
 $('socialEventPickerOverlay').addEventListener('click',ev=>{if(ev.target===$('socialEventPickerOverlay'))closeSocialEventPicker()});
 $('scFormat').onchange=()=>{const f=formats.find(x=>x.id===$('scFormat').value);if(!f)return;$('scType').value=f.default_type;$('scObjective').value=f.default_objective;$('scPillar').value=f.default_pillar};
}
