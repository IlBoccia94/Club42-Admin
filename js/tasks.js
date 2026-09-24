import {$,app,db,esc,fmtDate,toast,SUPABASE_URL,SUPABASE_KEY} from './core.js';

let tasks=[],users=[],projects=[],events=[],editTaskId=null,activeTab='focus',dragTaskId=null,taskQuickFilter='all';
const statusLabels={backlog:'Backlog',todo:'Da fare',doing:'In corso',blocked:'Bloccato',done:'Fatto'};
const priorityLabels={urgent:'Urgente',high:'Alta',medium:'Media',low:'Bassa'};
const categoryLabels={general:'Generale',project:'Progetto',event:'Evento',admin:'Amministrazione',social:'Social',communication:'Comunicazione',finance:'Finanze'};
const priorityRank={urgent:4,high:3,medium:2,low:1};
const taskQuickFilterLabels={open:'Aperti',today:'Oggi',overdue:'In ritardo',blocked:'Bloccati'};

function localToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function dateObj(s){return s?new Date(s+'T12:00:00'):null}
function addDays(s,n){const d=dateObj(s);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function ownerName(id){const u=users.find(x=>x.user_id===id);return u?.display_name||u?.email||'Non assegnato'}
function projectName(id){return projects.find(x=>x.id===id)?.title||'—'}
function eventName(id){return events.find(x=>x.id===id)?.name||'—'}
function isOpen(t){return t.status!=='done'}
function isOverdue(t){return isOpen(t)&&t.due_date&&t.due_date<localToday()}
function dueText(t){if(!t.due_date)return'Senza scadenza';const today=localToday();if(t.due_date===today)return'Oggi';if(t.due_date<today)return`Scaduto · ${fmtDate(t.due_date)}`;return fmtDate(t.due_date)}
function taskContext(t){if(t.project_id)return projectName(t.project_id);if(t.event_id)return eventName(t.event_id);return categoryLabels[t.category]||'Generale'}
function attentionScore(t){let s=0;if(t.status==='blocked')s+=12;if(isOverdue(t))s+=10;if(t.due_date===localToday()&&isOpen(t))s+=8;if(t.priority==='urgent')s+=6;else if(t.priority==='high')s+=3;if(t.status==='doing')s+=2;if(!t.due_date&&isOpen(t))s-=2;return s}
function matchesTaskQuickFilter(t){
 if(taskQuickFilter==='open')return isOpen(t);
 if(taskQuickFilter==='today')return isOpen(t)&&t.due_date===localToday();
 if(taskQuickFilter==='overdue')return isOverdue(t);
 if(taskQuickFilter==='blocked')return t.status==='blocked';
 return true;
}
function syncTaskQuickFilterUi(){
 document.querySelectorAll('.task-kpi').forEach(btn=>{
  const active=taskQuickFilter===btn.dataset.taskKpi;
  btn.classList.toggle('active-filter',active);
  btn.setAttribute('aria-pressed',active?'true':'false');
 });
 const bar=$('taskQuickFilterBar');
 if(!bar)return;
 const active=taskQuickFilter!=='all';
 bar.hidden=!active;
 if(active&&$('taskQuickFilterLabel'))$('taskQuickFilterLabel').textContent=taskQuickFilterLabels[taskQuickFilter]||'Filtro attivo';
}
function setTaskQuickFilter(type='all',{navigate=true}={}){
 const next=taskQuickFilterLabels[type]?type:'all';
 taskQuickFilter=next;
 if(next==='all')sessionStorage.removeItem('club42_tasks_quick_filter');
 else sessionStorage.setItem('club42_tasks_quick_filter',next);
 syncTaskQuickFilterUi();
 if(navigate)setTab('archive');
 else if(activeTab==='archive')renderArchive();
}
function canForceTaskAttention(){return app.currentProfile?.role==='admin'}
function taskAttentionButton(t,compact=false){
 if(!canForceTaskAttention())return '';
 const disabled=!t.assigned_to;
 const hint=disabled?'Nessun responsabile assegnato':'Richiedi attenzione al responsabile';
 return `<button type="button" class="task-attention-btn${compact?' compact':''}" ${disabled?'disabled':''} title="${hint}" aria-label="${hint}" onclick="event.stopPropagation();requestTaskAttention('${t.id}',this)">🔔</button>`;
}
window.requestTaskAttention=async(id,button)=>{
 if(!canForceTaskAttention())return toast('Solo gli Admin possono inviare richieste di attenzione.');
 const t=tasks.find(x=>x.id===id);if(!t)return toast('Task non trovato.');
 if(!t.assigned_to)return toast('Assegna prima un responsabile a questo task.');
 const recipient=ownerName(t.assigned_to);
 if(!confirm(`Inviare una notifica push forzata a ${recipient} per richiedere attenzione su “${t.title}”?`))return;
 const originalDisabled=!!button?.disabled;
 if(button){button.disabled=true;button.classList.add('sending')}
 try{
  const {data:{session}}=await db.auth.getSession();
  if(!session)return toast('Sessione scaduta. Accedi di nuovo.');
  const response=await fetch(`${SUPABASE_URL}/functions/v1/push-dispatcher`,{
   method:'POST',
   headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':SUPABASE_KEY},
   body:JSON.stringify({action:'admin_task_attention',task_id:id})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
   if(data.reason==='no_subscription')return toast(`${recipient} non ha notifiche push attive su nessun dispositivo.`);
   if(data.reason==='inactive')return toast(`${recipient} non è un utente operativo attivo.`);
   if(data.reason==='no_assignee')return toast('Il task non ha più un responsabile assegnato.');
   return toast(data.error||'Invio della notifica non riuscito.');
  }
  const devices=Number(data.sent||0);
  toast(devices>1?`Richiesta inviata a ${recipient} su ${devices} dispositivi.`:`Richiesta di attenzione inviata a ${recipient}.`);
 }catch(error){
  console.error(error);toast('Invio della notifica non riuscito.');
 }finally{
  if(button){button.classList.remove('sending');button.disabled=originalDisabled}
 }
};

export async function loadTasks(){
 const [tr,ur,pr,er]=await Promise.all([
  db.from('project_tasks').select('*').order('updated_at',{ascending:false}),
  db.from('admin_users').select('user_id,display_name,email,role,active,status').eq('active',true),
  db.from('projects').select('id,title,status,target_date').order('updated_at',{ascending:false}),
  db.from('events').select('id,name,event_date').order('event_date',{ascending:false})
 ]);
 if(tr.error||ur.error||pr.error||er.error){console.error(tr.error||ur.error||pr.error||er.error);toast('Errore caricamento task');return}
 tasks=tr.data||[];users=ur.data||[];projects=pr.data||[];events=er.data||[];fillTaskSelects();renderTasks();
}

function fillTaskSelects(){
 const ownerOptions=['<option value="">Nessuno</option>',...users.map(u=>`<option value="${u.user_id}">${esc(u.display_name||u.email)}</option>`)].join('');
 $('taskOwner').innerHTML=ownerOptions;
 $('taskKanbanOwner').innerHTML=['<option value="all">Tutti i responsabili</option>',...users.map(u=>`<option value="${u.user_id}">${esc(u.display_name||u.email)}</option>`)].join('');
 $('taskOwnerFilter').innerHTML=['<option value="all">Tutti i responsabili</option>',...users.map(u=>`<option value="${u.user_id}">${esc(u.display_name||u.email)}</option>`)].join('');
 $('taskProject').innerHTML=['<option value="">Nessuno</option>',...projects.map(p=>`<option value="${p.id}">${esc(p.title)}</option>`)].join('');
 $('taskProjectFilter').innerHTML=['<option value="all">Tutti i progetti</option>',...projects.map(p=>`<option value="${p.id}">${esc(p.title)}</option>`)].join('');
 $('taskEvent').innerHTML=['<option value="">Nessuno</option>',...events.map(e=>`<option value="${e.id}">${esc(e.name)}${e.event_date?' · '+fmtDate(e.event_date):''}</option>`)].join('');
}

function setTab(name){activeTab=name;sessionStorage.setItem('club42_tasks_tab',name);document.querySelectorAll('.tasks-tab').forEach(b=>b.classList.toggle('active',b.dataset.ttab===name));document.querySelectorAll('.task-tab-panel').forEach(p=>p.classList.toggle('active',p.id==='task-panel-'+name));if(name==='kanban')renderKanban();if(name==='analytics')renderAnalytics();if(name==='archive')renderArchive()}

function renderTasks(){
 const today=localToday();
 $('taskOpenKpi').textContent=tasks.filter(isOpen).length;
 $('taskTodayKpi').textContent=tasks.filter(t=>isOpen(t)&&t.due_date===today).length;
 $('taskOverdueKpi').textContent=tasks.filter(isOverdue).length;
 $('taskBlockedKpi').textContent=tasks.filter(t=>t.status==='blocked').length;
 syncTaskQuickFilterUi();
 renderFocus();renderKanban();renderAnalytics();renderArchive();
}

function focusRow(t){const cls=[isOverdue(t)?'overdue':'',t.status==='blocked'?'blocked':''].filter(Boolean).join(' ');return `<article class="task-focus-item ${cls}" onclick="openTask('${t.id}')"><button class="task-check ${t.status==='done'?'done':''}" onclick="event.stopPropagation();toggleTaskDone('${t.id}')" title="${t.status==='done'?'Riapri':'Segna come fatto'}">${t.status==='done'?'✓':'○'}</button><div class="task-focus-copy"><h4>${esc(t.title)}</h4><p>${esc(taskContext(t))}${t.assigned_to?' · '+esc(ownerName(t.assigned_to)):''}${t.description?' · '+esc(t.description):''}</p></div><div class="task-focus-meta"><div class="task-focus-meta-top"><span class="task-pill task-priority-${t.priority}">${priorityLabels[t.priority]}</span>${taskAttentionButton(t,true)}</div><div style="margin-top:5px">${esc(dueText(t))}</div></div></article>`}

function renderFocus(){
 const open=tasks.filter(isOpen);
 const now=open.filter(t=>attentionScore(t)>0).sort((a,b)=>attentionScore(b)-attentionScore(a)||(a.due_date||'9999').localeCompare(b.due_date||'9999')).slice(0,10);
 $('taskNowList').innerHTML=now.length?now.map(focusRow).join(''):'<div class="task-empty">Niente di urgente in coda. Ottimo.</div>';
 const end=addDays(localToday(),7);const upcoming=open.filter(t=>t.due_date&&t.due_date>localToday()&&t.due_date<=end).sort((a,b)=>a.due_date.localeCompare(b.due_date)||priorityRank[b.priority]-priorityRank[a.priority]).slice(0,10);
 $('taskUpcomingList').innerHTML=upcoming.length?upcoming.map(focusRow).join(''):'<div class="task-empty">Nessuna scadenza nei prossimi 7 giorni.</div>';
 const blocked=open.filter(t=>t.status==='blocked').sort((a,b)=>priorityRank[b.priority]-priorityRank[a.priority]).slice(0,10);
 $('taskBlockedList').innerHTML=blocked.length?blocked.map(focusRow).join(''):'<div class="task-empty">Nessun task bloccato.</div>';
 const noDue=open.filter(t=>!t.due_date).sort((a,b)=>priorityRank[b.priority]-priorityRank[a.priority]||new Date(b.created_at)-new Date(a.created_at)).slice(0,10);
 $('taskNoDueList').innerHTML=noDue.length?noDue.map(focusRow).join(''):'<div class="task-empty">Tutti i task aperti hanno una scadenza.</div>';
}

function taskCard(t){return `<article class="task-card" draggable="true" ondragstart="taskDragStart(event,'${t.id}')" ondragend="taskDragEnd(event)" onclick="openTask('${t.id}')"><div class="task-card-top"><span class="task-pill task-priority-${t.priority}">${priorityLabels[t.priority]}</span><div class="task-card-top-actions"><span class="muted">${t.due_date?fmtDate(t.due_date):''}</span>${taskAttentionButton(t,true)}</div></div><h4>${esc(t.title)}</h4><p>${esc(t.description||t.notes||'')}</p><div class="task-card-meta"><span>${esc(taskContext(t))}</span>${t.assigned_to?`<span>${esc(ownerName(t.assigned_to))}</span>`:''}${t.estimated_hours!=null?`<span>${Number(t.estimated_hours)}h</span>`:''}</div></article>`}

function renderKanban(){const owner=$('taskKanbanOwner')?.value||'all';const filtered=tasks.filter(t=>owner==='all'||t.assigned_to===owner);const cols=[['backlog','Backlog'],['todo','Da fare'],['doing','In corso'],['blocked','Bloccati'],['done','Fatti']];$('taskKanban').innerHTML=cols.map(([st,label])=>{const tt=filtered.filter(t=>t.status===st).sort((a,b)=>priorityRank[b.priority]-priorityRank[a.priority]||(a.due_date||'9999').localeCompare(b.due_date||'9999'));return `<section class="task-column" data-status="${st}" ondragover="taskDragOver(event)" ondragleave="taskDragLeave(event)" ondrop="taskDrop(event,'${st}')"><div class="task-column-head"><b>${label}</b><span>${tt.length}</span></div><div class="task-column-body">${tt.length?tt.map(taskCard).join(''):'<div class="task-empty">Vuoto</div>'}</div></section>`}).join('')}

function renderAnalytics(){renderStatusChart();renderOwnerChart();renderDeadlineChart()}
function renderStatusChart(){const cols={backlog:'#c9c7c0',todo:'#ffc60b',doing:'#216277',blocked:'#fa6b63',done:'#5f9b78'};const labels=['backlog','todo','doing','blocked','done'];const counts=Object.fromEntries(labels.map(s=>[s,tasks.filter(t=>t.status===s).length]));const total=tasks.length;let cursor=0;const parts=[];for(const s of labels){const pct=total?counts[s]/total*100:0;parts.push(`${cols[s]} ${cursor}% ${cursor+pct}%`);cursor+=pct}const bg=total?`conic-gradient(${parts.join(',')})`:'#edf0f1';$('taskStatusChart').innerHTML=`<div class="task-donut-wrap"><div class="task-donut" style="background:${bg}"><div class="task-donut-center"><b>${total}</b><span>task totali</span></div></div><div class="task-legend">${labels.map(s=>`<div class="task-legend-row"><i style="background:${cols[s]}"></i><span>${statusLabels[s]}</span><b>${counts[s]}</b></div>`).join('')}</div></div>`}
function renderOwnerChart(){const open=tasks.filter(isOpen);const rows=[...users.map(u=>({id:u.user_id,name:u.display_name||u.email,count:open.filter(t=>t.assigned_to===u.user_id).length})),{id:null,name:'Non assegnati',count:open.filter(t=>!t.assigned_to).length}].filter(x=>x.count>0).sort((a,b)=>b.count-a.count);if(!rows.length){$('taskOwnerChart').innerHTML='<div class="task-empty">Nessun task aperto da distribuire.</div>';return}const max=Math.max(...rows.map(x=>x.count),1);$('taskOwnerChart').innerHTML=`<div class="task-owner-bars">${rows.map(r=>`<div class="task-owner-row"><label title="${esc(r.name)}">${esc(r.name)}</label><div class="task-owner-track"><i style="width:${Math.max(5,r.count/max*100)}%"></i></div><b>${r.count}</b></div>`).join('')}</div>`}
function renderDeadlineChart(){const start=localToday();const days=Array.from({length:14},(_,i)=>addDays(start,i));const data=days.map(d=>({date:d,count:tasks.filter(t=>isOpen(t)&&t.due_date===d).length}));const max=Math.max(...data.map(x=>x.count),1);const fmt=new Intl.DateTimeFormat('it-IT',{weekday:'short'});$('taskDeadlineChart').innerHTML=`<div class="task-deadline-chart">${data.map(x=>{const dd=dateObj(x.date);const h=x.count?Math.max(8,Math.round(x.count/max*140)):3;return `<div class="task-deadline-day" title="${x.count} task · ${fmtDate(x.date)}"><div class="task-deadline-barslot"><div class="task-deadline-bar" style="height:${h}px;opacity:${x.count?1:.12}"></div></div><b>${String(dd.getDate()).padStart(2,'0')}</b><span>${fmt.format(dd).replace('.','')}</span></div>`}).join('')}</div>`}

function renderArchive(){const q=$('taskSearch')?.value?.toLowerCase().trim()||'',sf=$('taskStatusFilter')?.value||'all',pf=$('taskPriorityFilter')?.value||'all',of=$('taskOwnerFilter')?.value||'all',prf=$('taskProjectFilter')?.value||'all';let rows=tasks.filter(matchesTaskQuickFilter).filter(t=>sf==='all'||t.status===sf).filter(t=>pf==='all'||t.priority===pf).filter(t=>of==='all'||(of==='none'?!t.assigned_to:t.assigned_to===of)).filter(t=>prf==='all'||t.project_id===prf);if(q)rows=rows.filter(t=>[t.title,t.description,t.notes,ownerName(t.assigned_to),projectName(t.project_id),eventName(t.event_id),...(t.labels||[])].some(v=>(v||'').toLowerCase().includes(q)));rows.sort((a,b)=>Number(isOpen(b))-Number(isOpen(a))||Number(isOverdue(b))-Number(isOverdue(a))||priorityRank[b.priority]-priorityRank[a.priority]||(a.due_date||'9999').localeCompare(b.due_date||'9999'));$('taskArchiveList').innerHTML=rows.length?rows.map(t=>`<article class="task-archive-row" onclick="openTask('${t.id}')"><div><h4>${esc(t.title)}</h4><p>${esc(t.description||t.notes||'')}</p></div><div><span class="task-pill">${statusLabels[t.status]}</span></div><div><span class="task-pill task-priority-${t.priority}">${priorityLabels[t.priority]}</span></div><div>${esc(ownerName(t.assigned_to))}</div><div>${esc(taskContext(t))}</div><div>${t.due_date?fmtDate(t.due_date):'—'}</div>${taskAttentionButton(t,true)}</article>`).join(''):`<div class="task-empty">${taskQuickFilter!=='all'?'Nessun task corrisponde al filtro rapido “'+(taskQuickFilterLabels[taskQuickFilter]||'')+'”.':'Nessun task trovato.'}</div>`}

function clearTaskForm(){editTaskId=null;$('taskForm').reset();$('taskDlgTitle').textContent='Nuovo task';$('taskStatus').value='todo';$('taskPriority').value='medium';$('taskCategory').value='general';$('taskDeleteBtn').style.display='none';window.club42EntityTools?.clearTarget('taskDlg')}
window.openTask=id=>{const t=tasks.find(x=>x.id===id);if(!t)return;editTaskId=id;$('taskDlgTitle').textContent=t.title;$('taskTitle').value=t.title;$('taskDescription').value=t.description||'';$('taskStatus').value=t.status;$('taskPriority').value=t.priority;$('taskCategory').value=t.category||'general';$('taskOwner').value=t.assigned_to||'';$('taskStart').value=t.start_date||'';$('taskDue').value=t.due_date||'';$('taskHours').value=t.estimated_hours??'';$('taskProject').value=t.project_id||'';$('taskEvent').value=t.event_id||'';$('taskLabels').value=(t.labels||[]).join(', ');$('taskNotes').value=t.notes||'';$('taskDeleteBtn').style.display='inline-flex';window.club42EntityTools?.setTarget('taskDlg','task',id,t.title);$('taskDlg').showModal()};

async function saveTask(ev){ev.preventDefault();const labels=$('taskLabels').value.split(',').map(x=>x.trim()).filter(Boolean);const row={title:$('taskTitle').value.trim(),description:$('taskDescription').value.trim()||null,status:$('taskStatus').value,priority:$('taskPriority').value,category:$('taskCategory').value,assigned_to:$('taskOwner').value||null,start_date:$('taskStart').value||null,due_date:$('taskDue').value||null,estimated_hours:$('taskHours').value===''?null:Number($('taskHours').value),project_id:$('taskProject').value||null,event_id:$('taskEvent').value||null,labels,notes:$('taskNotes').value.trim()||null};if(editTaskId){const {error}=await db.from('project_tasks').update(row).eq('id',editTaskId);if(error)return toast(error.message);toast('Task aggiornato')}else{const {error}=await db.from('project_tasks').insert({...row,created_by:app.currentUser.id});if(error)return toast(error.message);toast('Task creato')}$('taskDlg').close();await loadTasks()}
async function deleteTask(){if(!editTaskId)return;const t=tasks.find(x=>x.id===editTaskId);if(!confirm(`Eliminare definitivamente “${t.title}”?`))return;const {error}=await db.from('project_tasks').delete().eq('id',editTaskId);if(error)return toast(error.message);$('taskDlg').close();toast('Task eliminato');await loadTasks()}
window.toggleTaskDone=async id=>{const t=tasks.find(x=>x.id===id);if(!t)return;const status=t.status==='done'?'todo':'done';const {error}=await db.from('project_tasks').update({status}).eq('id',id);if(error)return toast(error.message);await loadTasks()};

window.taskDragStart=(ev,id)=>{dragTaskId=id;ev.currentTarget.classList.add('dragging');if(ev.dataTransfer){ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('text/plain',id)}};
window.taskDragEnd=ev=>{ev.currentTarget.classList.remove('dragging');document.querySelectorAll('.task-column').forEach(c=>c.classList.remove('drag-over'));dragTaskId=null};
window.taskDragOver=ev=>{ev.preventDefault();ev.currentTarget.classList.add('drag-over');if(ev.dataTransfer)ev.dataTransfer.dropEffect='move'};
window.taskDragLeave=ev=>{if(!ev.currentTarget.contains(ev.relatedTarget))ev.currentTarget.classList.remove('drag-over')};
window.taskDrop=async(ev,status)=>{ev.preventDefault();ev.currentTarget.classList.remove('drag-over');const id=dragTaskId||ev.dataTransfer?.getData('text/plain');if(!id)return;const t=tasks.find(x=>x.id===id);if(!t||t.status===status)return;const {error}=await db.from('project_tasks').update({status}).eq('id',id);if(error)return toast(error.message);toast(`Task → ${statusLabels[status]}`);dragTaskId=null;await loadTasks()};

function kpiAction(type){
 const next=taskQuickFilter===type?'all':type;
 setTaskQuickFilter(next,{navigate:true});
}

export function initTasks(){
 $('newTaskBtn').onclick=()=>{clearTaskForm();$('taskDlg').showModal()};
 $('taskClose').onclick=()=>$('taskDlg').close();$('taskCancel').onclick=()=>$('taskDlg').close();$('taskForm').onsubmit=saveTask;$('taskDeleteBtn').onclick=deleteTask;
 document.querySelectorAll('.tasks-tab').forEach(b=>b.onclick=()=>setTab(b.dataset.ttab));
 document.querySelectorAll('.task-kpi').forEach(b=>b.onclick=()=>kpiAction(b.dataset.taskKpi));
 $('taskQuickFilterClear').onclick=()=>setTaskQuickFilter('all',{navigate:false});
 $('taskKanbanOwner').onchange=renderKanban;
 ['taskSearch','taskStatusFilter','taskPriorityFilter','taskOwnerFilter','taskProjectFilter'].forEach(id=>$(id).addEventListener(id==='taskSearch'?'input':'change',renderArchive));
 const rememberedFilter=sessionStorage.getItem('club42_tasks_quick_filter');if(taskQuickFilterLabels[rememberedFilter])taskQuickFilter=rememberedFilter;
 syncTaskQuickFilterUi();
 const remembered=sessionStorage.getItem('club42_tasks_tab');if(['focus','kanban','analytics','archive'].includes(remembered))setTab(remembered);
}
