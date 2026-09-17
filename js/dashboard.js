import {$,app,db,esc,fmtDate} from './core.js';
import {showView} from './router.js';
import {isAdmin} from './permissions.js';

const openTask=t=>t.status!=='done';
const activeProject=p=>!['completed','archived','cancelled'].includes(p.status);
const activeSocial=s=>s.status!=='published';

function localToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function money(v){return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v)||0)}
function priorityRank(p){return({urgent:0,high:1,medium:2,low:3})[p]??4}
function dueRank(t,today){if(t.due_date&&t.due_date<today)return 0;if(t.due_date===today)return 1;if(t.due_date)return 2;return 3}
function bindLinks(){document.querySelectorAll('#view-dashboard [data-dashboard-view]').forEach(el=>{el.onclick=()=>showView(el.dataset.dashboardView)})}
function attentionRow({icon,title,text,value,view,warn=false,ok=false}){return `<button class="dash-attention-item ${warn?'warn':''} ${ok?'ok':''}" type="button" ${view?`data-dashboard-view="${view}"`:''}><span class="dash-attention-icon">${icon}</span><span class="dash-attention-copy"><b>${esc(title)}</b><span>${esc(text)}</span></span><strong class="dash-attention-value">${esc(String(value))}</strong></button>`}
function pulseRow({icon,title,text,value,view,small=false}){return `<button class="dash-pulse-item" type="button" data-dashboard-view="${view}"><span class="dash-pulse-icon">${icon}</span><span class="dash-pulse-copy"><b>${esc(title)}</b><span>${esc(text)}</span></span><strong class="dash-pulse-value ${small?'small':''}">${esc(String(value))}</strong></button>`}

function renderAttention(tasks,fees,social,pending,today){
  const overdue=tasks.filter(t=>openTask(t)&&t.due_date&&t.due_date<today).length;
  const blocked=tasks.filter(t=>t.status==='blocked').length;
  const renewals=fees.filter(f=>f.payment_status==='due').length;
  const socialLate=social.filter(s=>activeSocial(s)&&s.scheduled_date&&s.scheduled_date<today).length;
  const items=[];
  if(overdue)items.push(attentionRow({icon:'!',title:'Task scaduti',text:'Attività oltre la data prevista',value:overdue,view:'tasks',warn:true}));
  if(blocked)items.push(attentionRow({icon:'×',title:'Task bloccati',text:'Richiedono uno sblocco o una decisione',value:blocked,view:'tasks',warn:true}));
  if(renewals)items.push(attentionRow({icon:'♙',title:'Rinnovi da gestire',text:'Quote associative segnate da rinnovare',value:renewals,view:'members',warn:true}));
  if(socialLate)items.push(attentionRow({icon:'◎',title:'Contenuti social in ritardo',text:'Programmazione superata e contenuto non pubblicato',value:socialLate,view:'social',warn:true}));
  if(isAdmin()&&pending)items.push(attentionRow({icon:'⚙',title:'Utenti in attesa',text:'Account che richiedono una decisione Admin',value:pending,view:'users',warn:true}));
  $('dashAttentionList').innerHTML=items.length?items.join(''):attentionRow({icon:'✓',title:'Nessuna criticità',text:'Non risultano scadenze o blocchi urgenti',value:'OK',ok:true});
}

function renderMyTasks(tasks,today){
  const mine=tasks.filter(t=>openTask(t)&&t.assigned_to===app.currentUser?.id).sort((a,b)=>dueRank(a,today)-dueRank(b,today)||priorityRank(a.priority)-priorityRank(b.priority)||(a.due_date||'9999').localeCompare(b.due_date||'9999')).slice(0,5);
  if(!mine.length){$('dashMyTasks').innerHTML='<div class="dash-empty"><strong>Nessun task assegnato</strong>Quando un’attività viene assegnata a te comparirà qui.</div>';return}
  $('dashMyTasks').innerHTML=mine.map(t=>{let due='Senza scadenza',dueClass='';if(t.due_date){if(t.due_date<today){due='Scaduto';dueClass=' · '+fmtDate(t.due_date)}else if(t.due_date===today)due='Oggi';else due=fmtDate(t.due_date)}return `<button class="dash-task-item" type="button" data-dashboard-view="tasks"><span class="dash-task-main"><span class="dash-task-title"><i class="dash-priority-dot ${esc(t.priority||'')}"></i><b>${esc(t.title)}</b></span><p>${esc(t.description||t.notes||'Nessuna descrizione')}</p></span><span class="dash-task-meta"><b>${esc(due)}</b><span>${esc((t.priority||'').toUpperCase())}${esc(dueClass)}</span></span></button>`}).join('');
}

function renderPulse(cash,projects,social,tasks,today,year){
  const income=cash.filter(x=>x.movement_type==='income').reduce((s,x)=>s+Number(x.amount||0),0);
  const expense=cash.filter(x=>x.movement_type==='expense').reduce((s,x)=>s+Number(x.amount||0),0);
  const balance=income-expense;
  const activeProjects=projects.filter(activeProject);
  const nextProject=activeProjects.filter(p=>p.next_action_due&&p.next_action_due>=today).sort((a,b)=>a.next_action_due.localeCompare(b.next_action_due))[0];
  const nextSocial=social.filter(s=>activeSocial(s)&&s.scheduled_date&&s.scheduled_date>=today).sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date)||(a.scheduled_time||'').localeCompare(b.scheduled_time||''))[0];
  const openTasks=tasks.filter(openTask),mine=openTasks.filter(t=>t.assigned_to===app.currentUser?.id).length,blocked=openTasks.filter(t=>t.status==='blocked').length;
  const rows=[
    pulseRow({icon:'€',title:`Cassa ${year}`,text:`Entrate ${money(income)} · Uscite ${money(expense)}`,value:money(balance),view:'cash',small:true}),
    pulseRow({icon:'◇',title:'Progetti attivi',text:nextProject?`Prossima azione: ${nextProject.next_action||nextProject.title} · ${fmtDate(nextProject.next_action_due)}`:'Portfolio senza prossime scadenze registrate',value:activeProjects.length,view:'projects'}),
    pulseRow({icon:'◎',title:'Prossimo contenuto social',text:nextSocial?`${nextSocial.title} · ${fmtDate(nextSocial.scheduled_date)}`:'Nessun contenuto futuro programmato',value:nextSocial?'→':'—',view:'social'}),
    pulseRow({icon:'✓',title:'Task aperti',text:`${mine} assegnati a te${blocked?` · ${blocked} bloccati`:''}`,value:openTasks.length,view:'tasks'})
  ];
  $('dashPulse').innerHTML=rows.join('');
}

export async function loadDashboard(){
  if(!$('dashAttentionList'))return;
  const today=localToday(),year=Number(today.slice(0,4));
  try{
    const queries=[
      db.from('project_tasks').select('id,title,status,priority,assigned_to,due_date,description,notes'),
      db.from('projects').select('id,title,status,next_action,next_action_due'),
      db.from('social_content').select('id,title,status,scheduled_date,scheduled_time'),
      db.from('cash_transactions').select('amount,movement_type,movement_date').gte('movement_date',`${year}-01-01`).lte('movement_date',`${year}-12-31`),
      db.from('membership_years').select('payment_status,year').eq('year',year)
    ];
    if(isAdmin())queries.push(db.from('admin_users').select('user_id,status').eq('status','pending'));
    const results=await Promise.all(queries);
    const [tr,pr,sr,cr,fr,ur]=results;
    [tr,pr,sr,cr,fr].forEach(r=>{if(r.error)console.error(r.error)});
    const tasks=tr.data||[],projects=pr.data||[],social=sr.data||[],cash=cr.data||[],fees=fr.data||[],pending=ur?.data?.length||0;
    renderAttention(tasks,fees,social,pending,today);
    renderMyTasks(tasks,today);
    renderPulse(cash,projects,social,tasks,today,year);
    bindLinks();
  }catch(error){
    console.error(error);
    $('dashAttentionList').innerHTML='<div class="dash-empty"><strong>Dati non disponibili</strong>Riapri la Dashboard per riprovare.</div>';
    $('dashMyTasks').innerHTML='<div class="dash-empty">Impossibile caricare i task.</div>';
    $('dashPulse').innerHTML='<div class="dash-empty">Impossibile caricare lo stato operativo.</div>';
  }
}

export function initDashboard(){bindLinks()}
