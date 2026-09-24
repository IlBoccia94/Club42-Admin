import {$,app,db,esc,fmtDate} from './core.js';
import {showView} from './router.js';
import {isAdmin} from './permissions.js';

const openTask=t=>t.status!=='done';
const activeProject=p=>!['completed','archived','cancelled'].includes(p.status);
const activeSocial=s=>!['published','archived'].includes(s.status);

function localToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function isoAddDays(value,days){const d=new Date(value+'T12:00:00');d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function money(v){return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v)||0)}
function priorityRank(p){return({urgent:0,high:1,medium:2,low:3})[p]??4}
function dueRank(t,today){if(t.due_date&&t.due_date<today)return 0;if(t.due_date===today)return 1;if(t.status==='blocked')return 2;if(t.due_date)return 3;return 4}
function personDateLabel(value,today){if(value===today)return'Oggi';if(value===isoAddDays(today,1))return'Domani';return fmtDate(value)}
function fullTodayLabel(){return new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date())}

function entityButtonAttrs(type,id){
  return type&&id?`data-dashboard-entity="${type}" data-dashboard-id="${id}"`:'';
}
function bindLinks(){
  document.querySelectorAll('#view-dashboard [data-dashboard-view]').forEach(el=>{el.onclick=()=>showView(el.dataset.dashboardView)});
  document.querySelectorAll('#view-dashboard [data-dashboard-entity]').forEach(el=>{el.onclick=()=>{
    const type=el.dataset.dashboardEntity,id=el.dataset.dashboardId;
    window.club42?.openLinkedEntity?.(type,id);
  }});
  document.querySelectorAll('#view-dashboard [data-dashboard-create]').forEach(el=>{el.onclick=()=>quickCreate(el.dataset.dashboardCreate)});
}
async function quickCreate(type){
  if(type==='event'){
    await showView('events');
    window.openEvent?.();
    return;
  }
  if(type==='task'){
    await showView('tasks');
    $('newTaskBtn')?.click();
    return;
  }
  if(type==='social'){
    await showView('social');
    window.newSocialContent?.();
    return;
  }
  if(type==='cash'){
    await showView('cash');
    $('newCashBtn')?.click();
  }
}

function attentionItem(item){
  const cls=item.level==='critical'?'critical':item.level==='warn'?'warn':item.level==='info'?'info':'';
  return `<button class="dash-attention-item ${cls}" type="button" ${item.type?entityButtonAttrs(item.type,item.id):item.view?`data-dashboard-view="${item.view}"`:''}>
    <span class="dash-attention-icon">${item.icon}</span>
    <span class="dash-attention-copy"><b>${esc(item.title)}</b><span>${esc(item.text)}</span></span>
    <span class="dash-attention-side"><strong>${esc(item.badge||'')}</strong>${item.when?`<small>${esc(item.when)}</small>`:''}</span>
  </button>`;
}
function taskItem(t,today){
  let due='Senza scadenza',meta=(t.priority||'').toUpperCase();
  if(t.due_date){
    due=t.due_date<today?`Scaduto · ${fmtDate(t.due_date)}`:personDateLabel(t.due_date,today);
  }
  return `<button class="dash-task-item" type="button" ${entityButtonAttrs('task',t.id)}>
    <span class="dash-task-main"><span class="dash-task-title"><i class="dash-priority-dot ${esc(t.priority||'')}"></i><b>${esc(t.title)}</b></span><p>${esc(t.description||t.notes||'Nessuna descrizione')}</p></span>
    <span class="dash-task-meta"><b>${esc(due)}</b><span>${esc(meta)}</span></span>
  </button>`;
}
function pulseCard({icon,title,value,text,view,tone=''}){return `<button class="dash-pulse-card ${tone}" type="button" data-dashboard-view="${view}"><span class="dash-pulse-icon">${icon}</span><span class="dash-pulse-copy"><b>${esc(title)}</b><strong>${esc(String(value))}</strong><small>${esc(text)}</small></span></button>`}

function buildAttention(tasks,projects,social,fees,cash,pending,today){
  const items=[];
  for(const t of tasks.filter(openTask)){
    let score=0,reason='',badge='',level='warn';
    if(t.status==='blocked'){score+=90;reason='Task bloccato';badge='Bloccato';level='critical'}
    if(t.due_date&&t.due_date<today){score+=100;reason=t.status==='blocked'?'Bloccato e scaduto':'Task oltre la scadenza';badge='Scaduto';level='critical'}
    else if(t.due_date===today){score+=80;reason=t.status==='blocked'?'Bloccato · scade oggi':'Task da chiudere oggi';badge='Oggi';level='warn'}
    if(!score)continue;
    score+=5-priorityRank(t.priority);
    items.push({score,icon:'✓',title:t.title,text:reason,badge,when:t.due_date?fmtDate(t.due_date):'',type:'task',id:t.id,level});
  }
  for(const p of projects.filter(activeProject)){
    let score=0,text='',badge='',date='',level='warn';
    if(p.next_action_due&&p.next_action_due<today){score=78;text=p.next_action?`Prossima azione scaduta: ${p.next_action}`:'Prossima azione scaduta';badge='Azione scaduta';date=p.next_action_due;level='critical'}
    else if(p.next_action_due===today){score=68;text=p.next_action?`Da fare oggi: ${p.next_action}`:'Prossima azione prevista oggi';badge='Oggi';date=p.next_action_due}
    else if(p.target_date&&p.target_date<today){score=60;text='Data obiettivo superata';badge='Obiettivo';date=p.target_date;level='critical'}
    if(score)items.push({score,icon:'◇',title:p.title,text,badge,when:date?fmtDate(date):'',type:'project',id:p.id,level});
  }
  for(const s of social.filter(activeSocial)){
    if(!s.scheduled_date||s.scheduled_date>today)continue;
    const late=s.scheduled_date<today;
    items.push({score:late?72:58,icon:'◎',title:s.title,text:late?'Contenuto programmato ma non ancora pubblicato':'Contenuto previsto oggi',badge:late?'In ritardo':'Oggi',when:fmtDate(s.scheduled_date),type:'social',id:s.id,level:late?'critical':'warn'});
  }
  const renewals=fees.filter(f=>f.payment_status==='due').length;
  if(renewals)items.push({score:48,icon:'♙',title:'Quote associative da gestire',text:'Soci con quota annuale ancora da regolarizzare',badge:String(renewals),view:'members',level:'warn'});
  const reimbursements=cash.filter(x=>x.movement_type==='expense'&&!x.user_reimbursed&&(x.associated_user_id||x.associated_user_name));
  if(reimbursements.length){
    const total=reimbursements.reduce((sum,x)=>sum+Number(x.amount||0),0);
    items.push({score:52,icon:'€',title:'Rimborsi da effettuare',text:`${reimbursements.length} ${reimbursements.length===1?'movimento':'movimenti'} ancora da rimborsare`,badge:money(total),view:'cash',level:'warn'});
  }
  if(isAdmin()&&pending)items.push({score:55,icon:'⚙',title:'Utenti in attesa',text:'Richieste di accesso che richiedono una decisione',badge:String(pending),view:'users',level:'warn'});
  return items.sort((a,b)=>b.score-a.score).slice(0,9);
}
function renderAttention(tasks,projects,social,fees,cash,pending,today){
  const items=buildAttention(tasks,projects,social,fees,cash,pending,today);
  $('dashAttentionCount').textContent=String(items.length);
  $('dashAttentionList').innerHTML=items.length?items.map(attentionItem).join(''):`<div class="dash-state-ok"><span>✓</span><div><b>Niente di urgente</b><p>Non risultano scadenze, blocchi o arretrati che richiedano intervento.</p></div></div>`;
  return items.length;
}

function renderMyTasks(tasks,today){
  const mine=tasks.filter(t=>openTask(t)&&t.assigned_to===app.currentUser?.id)
    .sort((a,b)=>dueRank(a,today)-dueRank(b,today)||priorityRank(a.priority)-priorityRank(b.priority)||(a.due_date||'9999').localeCompare(b.due_date||'9999'))
    .slice(0,6);
  if(!mine.length){$('dashMyTasks').innerHTML='<div class="dash-empty"><strong>Nessun task assegnato</strong>Quando un’attività viene assegnata a te comparirà qui.</div>';return}
  $('dashMyTasks').innerHTML=mine.map(t=>taskItem(t,today)).join('');
}

function agendaItem({date,time,icon,title,text,type,id,kind}){
  return `<button class="dash-agenda-item ${kind||''}" type="button" ${entityButtonAttrs(type,id)}>
    <span class="dash-agenda-date"><b>${esc(date)}</b>${time?`<small>${esc(time)}</small>`:''}</span>
    <span class="dash-agenda-icon">${icon}</span>
    <span class="dash-agenda-copy"><b>${esc(title)}</b><span>${esc(text)}</span></span>
  </button>`;
}
function renderWeekAgenda(events,tasks,social,today){
  const end=isoAddDays(today,6),rows=[];
  events.filter(e=>e.event_status!=='ended').forEach(e=>{
    const start=e.event_date,endDate=e.event_end_date||start;
    if(!start||endDate<today||start>end)return;
    const display=start<today?today:start;
    rows.push({sort:`${display} ${e.event_time||'00:00'}`,date:display,time:e.event_time?String(e.event_time).slice(0,5):'',icon:'◫',title:e.name,text:[e.place,start<today?'Evento in corso':null].filter(Boolean).join(' · ')||'Evento Club42',type:'event',id:e.id,kind:'event'});
  });
  tasks.filter(t=>openTask(t)&&t.due_date&&t.due_date>=today&&t.due_date<=end).forEach(t=>{
    rows.push({sort:`${t.due_date} 23:00`,date:t.due_date,time:'',icon:'✓',title:t.title,text:t.assigned_to===app.currentUser?.id?'Task assegnato a te':'Task del direttivo',type:'task',id:t.id,kind:'task'});
  });
  social.filter(s=>activeSocial(s)&&s.scheduled_date&&s.scheduled_date>=today&&s.scheduled_date<=end).forEach(s=>{
    rows.push({sort:`${s.scheduled_date} ${s.scheduled_time||'12:00'}`,date:s.scheduled_date,time:s.scheduled_time?String(s.scheduled_time).slice(0,5):'',icon:'◎',title:s.title,text:`${s.content_type||'Contenuto'} · ${s.status||'pianificato'}`,type:'social',id:s.id,kind:'social'});
  });
  rows.sort((a,b)=>a.sort.localeCompare(b.sort));
  $('dashWeekAgenda').innerHTML=rows.length?rows.slice(0,12).map(x=>agendaItem({...x,date:personDateLabel(x.date,today)})).join(''):'<div class="dash-empty"><strong>Settimana libera</strong>Nessun evento, task o contenuto Social calendarizzato nei prossimi 7 giorni.</div>';
}

function renderPulse(cash,projects,social,tasks,events,fees,today,year){
  const yearCash=cash.filter(x=>String(x.movement_date||'').startsWith(String(year)));
  const income=yearCash.filter(x=>x.movement_type==='income').reduce((s,x)=>s+Number(x.amount||0),0);
  const expense=yearCash.filter(x=>x.movement_type==='expense').reduce((s,x)=>s+Number(x.amount||0),0);
  const reimbursements=yearCash.filter(x=>x.movement_type==='expense'&&!x.user_reimbursed&&(x.associated_user_id||x.associated_user_name));
  const activeProjects=projects.filter(activeProject);
  const projectAttention=activeProjects.filter(p=>(p.next_action_due&&p.next_action_due<=today)||(p.target_date&&p.target_date<today)).length;
  const openTasks=tasks.filter(openTask),mine=openTasks.filter(t=>t.assigned_to===app.currentUser?.id).length,blocked=openTasks.filter(t=>t.status==='blocked').length;
  const monthEnd=isoAddDays(today,30);
  const socialMonth=social.filter(s=>activeSocial(s)&&s.scheduled_date&&s.scheduled_date>=today&&s.scheduled_date<=monthEnd).length;
  const eventsMonth=events.filter(e=>e.event_status!=='ended'&&e.event_date&&e.event_date>=today&&e.event_date<=monthEnd).length;
  const renewals=fees.filter(f=>f.payment_status==='due').length;
  $('dashPulse').innerHTML=[
    pulseCard({icon:'€',title:`Cassa ${year}`,value:money(income-expense),text:`Entrate ${money(income)} · Uscite ${money(expense)}${reimbursements.length?` · ${reimbursements.length} rimborsi aperti`:''}`,view:'cash'}),
    pulseCard({icon:'◇',title:'Progetti attivi',value:activeProjects.length,text:projectAttention?`${projectAttention} richiedono attenzione`:'Nessuna scadenza critica',view:'projects',tone:projectAttention?'warn':''}),
    pulseCard({icon:'✓',title:'Task aperti',value:openTasks.length,text:`${mine} assegnati a te${blocked?` · ${blocked} bloccati`:''}`,view:'tasks',tone:blocked?'warn':''}),
    pulseCard({icon:'◎',title:'Social · 30 giorni',value:socialMonth,text:'Contenuti ancora da pubblicare',view:'social'}),
    pulseCard({icon:'◫',title:'Eventi · 30 giorni',value:eventsMonth,text:'Appuntamenti attivi in calendario',view:'events'}),
    pulseCard({icon:'♙',title:`Quote ${year}`,value:renewals,text:renewals?'Da regolarizzare':'Tutte regolarizzate',view:'members',tone:renewals?'warn':''})
  ].join('');
}

function renderCommandSummary(attentionCount,tasks,today){
  $('dashCommandDate').textContent=fullTodayLabel();
  const todayMine=tasks.filter(t=>openTask(t)&&t.assigned_to===app.currentUser?.id&&t.due_date===today).length;
  const overdueMine=tasks.filter(t=>openTask(t)&&t.assigned_to===app.currentUser?.id&&t.due_date&&t.due_date<today).length;
  let text='';
  if(attentionCount===0)text='Il quadro operativo è pulito: non risultano criticità immediate.';
  else text=`${attentionCount} ${attentionCount===1?'elemento richiede':'elementi richiedono'} attenzione`;
  if(todayMine||overdueMine)text+=` · per te: ${todayMine} oggi${overdueMine?', '+overdueMine+' in ritardo':''}`;
  $('dashCommandSummary').textContent=text;
}

export async function loadDashboard(){
  if(!$('dashAttentionList'))return;
  const today=localToday(),year=Number(today.slice(0,4));
  try{
    const queries=[
      db.from('project_tasks').select('id,title,status,priority,assigned_to,due_date,description,notes,project_id,event_id'),
      db.from('projects').select('id,title,status,priority,target_date,next_action,next_action_due'),
      db.from('social_content').select('id,title,status,priority,content_type,scheduled_date,scheduled_time'),
      db.from('cash_transactions').select('id,amount,movement_type,movement_date,associated_user_id,associated_user_name,user_reimbursed'),
      db.from('membership_years').select('payment_status,year').eq('year',year),
      db.from('events').select('id,name,event_date,event_end_date,event_time,event_end_time,event_status,place').order('event_date')
    ];
    if(isAdmin())queries.push(db.from('admin_users').select('user_id,status').eq('status','pending'));
    const results=await Promise.all(queries);
    const [tr,pr,sr,cr,fr,er,ur]=results;
    [tr,pr,sr,cr,fr,er].forEach(r=>{if(r.error)console.error(r.error)});
    const tasks=tr.data||[],projects=pr.data||[],social=sr.data||[],cash=cr.data||[],fees=fr.data||[],events=er.data||[],pending=ur?.data?.length||0;
    const attentionCount=renderAttention(tasks,projects,social,fees,cash,pending,today);
    renderMyTasks(tasks,today);
    renderWeekAgenda(events,tasks,social,today);
    renderPulse(cash,projects,social,tasks,events,fees,today,year);
    renderCommandSummary(attentionCount,tasks,today);
    bindLinks();
  }catch(error){
    console.error(error);
    $('dashCommandSummary').textContent='Non sono riuscito a leggere tutti i dati operativi.';
    $('dashAttentionList').innerHTML='<div class="dash-empty"><strong>Dati non disponibili</strong>Riapri la Dashboard per riprovare.</div>';
    $('dashMyTasks').innerHTML='<div class="dash-empty">Impossibile caricare i task.</div>';
    $('dashWeekAgenda').innerHTML='<div class="dash-empty">Impossibile caricare l’agenda.</div>';
    $('dashPulse').innerHTML='<div class="dash-empty">Impossibile caricare lo stato operativo.</div>';
  }
}

export function initDashboard(){bindLinks()}
