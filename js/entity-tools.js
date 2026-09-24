import {$,db,esc,fmtDate} from './core.js';

let current={type:null,id:null,title:'',tab:'links',sourceDialogId:null};
let auditChannel=null;

const typeMeta={
  event:{label:'Evento',icon:'◫'},
  project:{label:'Progetto',icon:'◇'},
  task:{label:'Task',icon:'✓'},
  social:{label:'Social',icon:'◎'},
  cash:{label:'Cassa',icon:'€'},
  contact:{label:'Contatto',icon:'☏'},
  member:{label:'Socio',icon:'♙'},
  registration:{label:'Iscritto',icon:'♙'},
  collaboration:{label:'Collaborazione',icon:'☏'},
  membership:{label:'Quota',icon:'€'}
};
const fieldLabels={
  name:'nome',title:'titolo',description:'descrizione',summary:'descrizione',
  status:'stato',priority:'priorità',event_date:'data evento',event_end_date:'data fine',
  event_time:'ora inizio',event_end_time:'ora fine',place:'luogo',capacity:'capienza',
  price:'prezzo',is_free:'gratuito',notes:'note',guest_visible:'visibilità soci',
  guest_teaser:'prossimamente',guest_description:'descrizione soci',event_status:'stato evento',
  attended:'presenza',checked_in_at:'orario check-in',checked_in_by:'check-in effettuato da',
  paid:'pagamento',member:'stato socio',dietary_requirements:'esigenze alimentari',
  project_id:'progetto collegato',event_id:'evento collegato',contact_id:'contatto collegato',
  member_id:'socio collegato',assigned_to:'responsabile',due_date:'scadenza',
  start_date:'data inizio',target_date:'data obiettivo',next_action:'prossima azione',
  next_action_due:'scadenza prossima azione',budget_planned:'budget previsto',
  budget_actual:'budget effettivo',scheduled_date:'data pubblicazione',scheduled_time:'ora pubblicazione',
  content_type:'tipo contenuto',objective:'obiettivo',pillar:'pilastro',hook:'hook',cta:'CTA',
  caption:'caption',production_notes:'note produzione',movement_date:'data movimento',
  movement_type:'tipo movimento',amount:'importo',category:'categoria',description:'descrizione',
  from_party:'da',to_party:'a',payment_method:'metodo pagamento',document_reference:'documento',
  user_reimbursed:'rimborso',organization:'organizzazione',contact_type:'tipologia',
  email:'email',phone:'telefono',instagram:'Instagram',website:'sito web',city:'città',
  address:'indirizzo',tags:'tag',favorite:'preferito',active:'stato attivo',
  first_name:'nome',last_name:'cognome',member_number:'numero socio',join_date:'data iscrizione',
  tax_code:'codice fiscale',signature_received:'firma ricevuta',payment_status:'stato quota',
  paid_at:'data pagamento',receipt_number:'numero ricevuta',role:'ruolo',
  collaboration_date:'data collaborazione'
};

function meta(type){return typeMeta[type]||{label:type||'Elemento',icon:'•'}}
function labelField(v){return fieldLabels[v]||String(v||'').replaceAll('_',' ')}
function fmtDateTime(value){
  if(!value)return'';
  try{return new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}catch{return value}
}
function entityTitle(row,type){
  if(!row)return'';
  if(type==='member')return [row.first_name,row.last_name].filter(Boolean).join(' ')||`Socio #${row.member_number||''}`;
  return row.title||row.name||row.description||'Elemento collegato';
}
function relation(type,row,group,detail=''){
  if(!row?.id)return null;
  return{type,id:row.id,title:entityTitle(row,type),group,detail};
}
function money(v){return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v)||0)}
function dedupe(rows){const seen=new Set();return rows.filter(x=>x&&(!seen.has(x.type+':'+x.id)&&seen.add(x.type+':'+x.id)))}

async function fetchByIds(table,select,ids){
  const clean=[...new Set((ids||[]).filter(Boolean))];
  if(!clean.length)return[];
  const {data,error}=await db.from(table).select(select).in('id',clean);
  if(error){console.warn('Entity links',error);return[]}
  return data||[];
}
async function safeQuery(builder){
  const {data,error}=await builder;
  if(error){console.warn('Entity links',error);return[]}
  return data||[];
}

async function relationsForEvent(id){
  const [projects,tasks,social,cash,collabs]=await Promise.all([
    safeQuery(db.from('projects').select('id,title,status,target_date').eq('event_id',id).order('updated_at',{ascending:false})),
    safeQuery(db.from('project_tasks').select('id,title,status,priority,due_date').eq('event_id',id).order('updated_at',{ascending:false})),
    safeQuery(db.from('social_content').select('id,title,status,content_type,scheduled_date').eq('event_id',id).order('scheduled_date',{ascending:true,nullsFirst:false})),
    safeQuery(db.from('cash_transactions').select('id,description,movement_type,amount,movement_date').eq('event_id',id).order('movement_date',{ascending:false})),
    safeQuery(db.from('contact_collaborations').select('id,contact_id,title,role,collaboration_date').eq('event_id',id).order('collaboration_date',{ascending:false}))
  ]);
  const contacts=await fetchByIds('contacts','id,name,organization',collabs.map(x=>x.contact_id));
  return dedupe([
    ...projects.map(x=>relation('project',x,'Progetti',[x.status,x.target_date&&fmtDate(x.target_date)].filter(Boolean).join(' · '))),
    ...tasks.map(x=>relation('task',x,'Task',[x.status,x.priority,x.due_date&&fmtDate(x.due_date)].filter(Boolean).join(' · '))),
    ...social.map(x=>relation('social',x,'Social',[x.content_type,x.status,x.scheduled_date&&fmtDate(x.scheduled_date)].filter(Boolean).join(' · '))),
    ...cash.map(x=>relation('cash',x,'Cassa',`${x.movement_type==='income'?'Entrata':'Uscita'} · ${money(x.amount)}${x.movement_date?' · '+fmtDate(x.movement_date):''}`)),
    ...contacts.map(x=>relation('contact',x,'Collaboratori',x.organization||'Collaboratore'))
  ]);
}
async function relationsForProject(id){
  const [{data:p},tasks,collabs]=await Promise.all([
    db.from('projects').select('id,title,event_id').eq('id',id).maybeSingle(),
    safeQuery(db.from('project_tasks').select('id,title,status,priority,due_date').eq('project_id',id).order('updated_at',{ascending:false})),
    safeQuery(db.from('contact_collaborations').select('id,contact_id,title,role,collaboration_date').eq('project_id',id).order('collaboration_date',{ascending:false}))
  ]);
  const contacts=await fetchByIds('contacts','id,name,organization',collabs.map(x=>x.contact_id));
  let event=[],social=[],cash=[];
  if(p?.event_id){
    [event,social,cash]=await Promise.all([
      fetchByIds('events','id,name,event_date,place',[p.event_id]),
      safeQuery(db.from('social_content').select('id,title,status,content_type,scheduled_date').eq('event_id',p.event_id).order('scheduled_date',{ascending:true,nullsFirst:false})),
      safeQuery(db.from('cash_transactions').select('id,description,movement_type,amount,movement_date').eq('event_id',p.event_id).order('movement_date',{ascending:false}))
    ]);
  }
  return dedupe([
    ...event.map(x=>relation('event',x,'Evento collegato',[x.event_date&&fmtDate(x.event_date),x.place].filter(Boolean).join(' · '))),
    ...tasks.map(x=>relation('task',x,'Task del progetto',[x.status,x.priority,x.due_date&&fmtDate(x.due_date)].filter(Boolean).join(' · '))),
    ...social.map(x=>relation('social',x,'Social dell’evento',[x.content_type,x.status,x.scheduled_date&&fmtDate(x.scheduled_date)].filter(Boolean).join(' · '))),
    ...cash.map(x=>relation('cash',x,'Cassa dell’evento',`${x.movement_type==='income'?'Entrata':'Uscita'} · ${money(x.amount)}`)),
    ...contacts.map(x=>relation('contact',x,'Collaboratori',x.organization||'Collaboratore'))
  ]);
}
async function relationsForTask(id){
  const {data:t,error}=await db.from('project_tasks').select('id,title,project_id,event_id').eq('id',id).maybeSingle();
  if(error||!t)return[];
  const [projects,events]=await Promise.all([
    fetchByIds('projects','id,title,status,target_date',[t.project_id]),
    fetchByIds('events','id,name,event_date,place',[t.event_id])
  ]);
  let social=[],cash=[];
  if(t.event_id)[social,cash]=await Promise.all([
    safeQuery(db.from('social_content').select('id,title,status,content_type,scheduled_date').eq('event_id',t.event_id).limit(8)),
    safeQuery(db.from('cash_transactions').select('id,description,movement_type,amount,movement_date').eq('event_id',t.event_id).order('movement_date',{ascending:false}).limit(8))
  ]);
  return dedupe([
    ...projects.map(x=>relation('project',x,'Progetto',[x.status,x.target_date&&fmtDate(x.target_date)].filter(Boolean).join(' · '))),
    ...events.map(x=>relation('event',x,'Evento',[x.event_date&&fmtDate(x.event_date),x.place].filter(Boolean).join(' · '))),
    ...social.map(x=>relation('social',x,'Social del contesto',[x.content_type,x.status].filter(Boolean).join(' · '))),
    ...cash.map(x=>relation('cash',x,'Cassa del contesto',`${x.movement_type==='income'?'Entrata':'Uscita'} · ${money(x.amount)}`))
  ]);
}
async function relationsForSocial(id){
  const {data:s,error}=await db.from('social_content').select('id,title,event_id').eq('id',id).maybeSingle();
  if(error||!s?.event_id)return[];
  const [events,projects,tasks,cash]=await Promise.all([
    fetchByIds('events','id,name,event_date,place',[s.event_id]),
    safeQuery(db.from('projects').select('id,title,status,target_date').eq('event_id',s.event_id)),
    safeQuery(db.from('project_tasks').select('id,title,status,priority,due_date').eq('event_id',s.event_id).limit(10)),
    safeQuery(db.from('cash_transactions').select('id,description,movement_type,amount,movement_date').eq('event_id',s.event_id).order('movement_date',{ascending:false}).limit(8))
  ]);
  return dedupe([
    ...events.map(x=>relation('event',x,'Evento',[x.event_date&&fmtDate(x.event_date),x.place].filter(Boolean).join(' · '))),
    ...projects.map(x=>relation('project',x,'Progetti',[x.status,x.target_date&&fmtDate(x.target_date)].filter(Boolean).join(' · '))),
    ...tasks.map(x=>relation('task',x,'Task',[x.status,x.due_date&&fmtDate(x.due_date)].filter(Boolean).join(' · '))),
    ...cash.map(x=>relation('cash',x,'Cassa',`${x.movement_type==='income'?'Entrata':'Uscita'} · ${money(x.amount)}`))
  ]);
}
async function relationsForCash(id){
  const {data:x,error}=await db.from('cash_transactions').select('id,description,event_id,contact_id,member_id').eq('id',id).maybeSingle();
  if(error||!x)return[];
  const [events,contacts,members]=await Promise.all([
    fetchByIds('events','id,name,event_date,place',[x.event_id]),
    fetchByIds('contacts','id,name,organization',[x.contact_id]),
    fetchByIds('members','id,member_number,first_name,last_name,status',[x.member_id])
  ]);
  return dedupe([
    ...events.map(v=>relation('event',v,'Evento',[v.event_date&&fmtDate(v.event_date),v.place].filter(Boolean).join(' · '))),
    ...contacts.map(v=>relation('contact',v,'Contatto',v.organization||'')),
    ...members.map(v=>relation('member',v,'Socio',v.member_number?`Socio #${v.member_number}`:''))
  ]);
}
async function relationsForContact(id){
  const [collabs,cash]=await Promise.all([
    safeQuery(db.from('contact_collaborations').select('id,title,event_id,project_id,role,collaboration_date').eq('contact_id',id).order('collaboration_date',{ascending:false})),
    safeQuery(db.from('cash_transactions').select('id,description,movement_type,amount,movement_date').eq('contact_id',id).order('movement_date',{ascending:false}))
  ]);
  const events=await fetchByIds('events','id,name,event_date,place',collabs.map(x=>x.event_id));
  const projects=await fetchByIds('projects','id,title,status,target_date',collabs.map(x=>x.project_id));
  return dedupe([
    ...events.map(v=>relation('event',v,'Eventi',[v.event_date&&fmtDate(v.event_date),v.place].filter(Boolean).join(' · '))),
    ...projects.map(v=>relation('project',v,'Progetti',[v.status,v.target_date&&fmtDate(v.target_date)].filter(Boolean).join(' · '))),
    ...cash.map(v=>relation('cash',v,'Cassa',`${v.movement_type==='income'?'Entrata':'Uscita'} · ${money(v.amount)}${v.movement_date?' · '+fmtDate(v.movement_date):''}`))
  ]);
}
async function relationsForMember(id){
  const cash=await safeQuery(db.from('cash_transactions').select('id,description,movement_type,amount,movement_date,event_id').eq('member_id',id).order('movement_date',{ascending:false}));
  const events=await fetchByIds('events','id,name,event_date,place',cash.map(x=>x.event_id));
  return dedupe([
    ...cash.map(v=>relation('cash',v,'Cassa',`${v.movement_type==='income'?'Entrata':'Uscita'} · ${money(v.amount)}${v.movement_date?' · '+fmtDate(v.movement_date):''}`)),
    ...events.map(v=>relation('event',v,'Eventi collegati ai movimenti',[v.event_date&&fmtDate(v.event_date),v.place].filter(Boolean).join(' · ')))
  ]);
}
async function loadRelations(){
  const {type,id}=current;
  if(type==='event')return relationsForEvent(id);
  if(type==='project')return relationsForProject(id);
  if(type==='task')return relationsForTask(id);
  if(type==='social')return relationsForSocial(id);
  if(type==='cash')return relationsForCash(id);
  if(type==='contact')return relationsForContact(id);
  if(type==='member')return relationsForMember(id);
  return[];
}

function renderRelations(rows){
  const root=$('club42EntityLinks');
  if(!rows.length){root.innerHTML='<div class="entity-tools-empty"><b>Nessun collegamento</b><span>Questo elemento non ha ancora relazioni registrate con altri moduli.</span></div>';return}
  const groups=new Map();
  for(const row of rows){if(!groups.has(row.group))groups.set(row.group,[]);groups.get(row.group).push(row)}
  root.innerHTML=[...groups.entries()].map(([group,items])=>`
    <section class="entity-tools-group">
      <div class="entity-tools-group-title"><b>${esc(group)}</b><span>${items.length}</span></div>
      <div class="entity-tools-links">${items.map(x=>{const m=meta(x.type);return `
        <button type="button" class="entity-tools-link" data-entity-link-type="${x.type}" data-entity-link-id="${x.id}">
          <span class="entity-tools-link-icon">${m.icon}</span>
          <span><b>${esc(x.title)}</b><small>${esc(x.detail||m.label)}</small></span><i>›</i>
        </button>`}).join('')}</div>
    </section>`).join('');
  root.querySelectorAll('[data-entity-link-type]').forEach(btn=>btn.onclick=()=>openRelation(btn.dataset.entityLinkType,btn.dataset.entityLinkId));
}
async function loadLinks(){
  $('club42EntityLinks').innerHTML='<div class="entity-tools-loading">Caricamento collegamenti…</div>';
  try{renderRelations(await loadRelations())}catch(error){console.error(error);$('club42EntityLinks').innerHTML='<div class="entity-tools-empty">Impossibile caricare i collegamenti.</div>'}
}

function relevantAudit(row){
  if(!row||!current.id)return false;
  if(row.entity_type===current.type&&row.entity_id===current.id)return true;
  if(current.type==='event'&&row.parent_event_id===current.id)return true;
  if(current.type==='project'&&row.parent_project_id===current.id)return true;
  if(current.type==='contact'&&row.parent_contact_id===current.id)return true;
  if(current.type==='member'&&row.parent_member_id===current.id)return true;
  return false;
}
async function loadAudit(){
  const root=$('club42EntityAudit');root.innerHTML='<div class="entity-tools-loading">Caricamento cronologia…</div>';
  try{
    const queries=[db.from('club42_audit_log').select('*').eq('entity_type',current.type).eq('entity_id',current.id).order('occurred_at',{ascending:false}).limit(80)];
    if(current.type==='event')queries.push(db.from('club42_audit_log').select('*').eq('parent_event_id',current.id).order('occurred_at',{ascending:false}).limit(80));
    if(current.type==='project')queries.push(db.from('club42_audit_log').select('*').eq('parent_project_id',current.id).order('occurred_at',{ascending:false}).limit(80));
    if(current.type==='contact')queries.push(db.from('club42_audit_log').select('*').eq('parent_contact_id',current.id).order('occurred_at',{ascending:false}).limit(80));
    if(current.type==='member')queries.push(db.from('club42_audit_log').select('*').eq('parent_member_id',current.id).order('occurred_at',{ascending:false}).limit(80));
    const results=await Promise.all(queries);
    const map=new Map();
    for(const r of results){if(r.error)throw r.error;for(const row of r.data||[])map.set(row.id,row)}
    const rows=[...map.values()].filter(relevantAudit).sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at)).slice(0,100);
    renderAudit(rows);
  }catch(error){console.error(error);root.innerHTML='<div class="entity-tools-empty">Impossibile caricare la cronologia.</div>'}
}
function auditAction(row){
  if(row.action==='insert')return'creato';
  if(row.action==='delete')return'eliminato';
  return'modificato';
}
function renderAudit(rows){
  const root=$('club42EntityAudit');
  if(!rows.length){root.innerHTML='<div class="entity-tools-empty"><b>Nessuna modifica registrata</b><span>La cronologia parte da quando è stato attivato l’audit log.</span></div>';return}
  root.innerHTML=`<div class="entity-audit-list">${rows.map(row=>{
    const m=meta(row.entity_type),fields=(row.changed_fields||[]).map(labelField);
    const context=row.entity_type!==current.type?`${m.label}: ${row.entity_title||'elemento'}`:row.entity_title||current.title;
    return `<article class="entity-audit-row">
      <span class="entity-audit-icon">${m.icon}</span>
      <div><p><b>${esc(row.actor_name||'Sistema Club42')}</b> ha ${auditAction(row)} <strong>${esc(context)}</strong></p>
      ${fields.length?`<small>Campi: ${esc(fields.join(', '))}</small>`:''}
      <time>${esc(fmtDateTime(row.occurred_at))}</time></div>
    </article>`;
  }).join('')}</div>`;
}

async function openRelation(type,id){
  close();
  const source=current.sourceDialogId?$(current.sourceDialogId):null;
  if(source?.open)source.close();
  if(type==='event'){
    await window.selectEvent?.(id,true);
    return;
  }
  await window.club42?.openLinkedEntity?.(type,id);
}
function setTab(tab){
  current.tab=tab==='audit'?'audit':'links';
  document.querySelectorAll('[data-entity-tools-tab]').forEach(b=>b.classList.toggle('active',b.dataset.entityToolsTab===current.tab));
  $('club42EntityLinks').hidden=current.tab!=='links';
  $('club42EntityAudit').hidden=current.tab!=='audit';
}
async function open(type,id,title='',tab='links',sourceDialogId=null){
  if(!type||!id)return;
  current={type,id,title:title||meta(type).label,tab:tab==='audit'?'audit':'links',sourceDialogId};
  $('club42EntityToolsTitle').textContent=current.title;
  $('club42EntityToolsKicker').textContent=`${meta(type).label} · contesto operativo`;
  $('club42EntityToolsOverlay').hidden=false;
  document.body.classList.add('entity-tools-open');
  setTab(current.tab);
  await Promise.all([loadLinks(),loadAudit()]);
}
function close(){
  const overlay=$('club42EntityToolsOverlay');if(overlay)overlay.hidden=true;
  document.body.classList.remove('entity-tools-open');
}
function ensureLaunchButton(dialogId){
  const dlg=$(dialogId),actions=dlg?.querySelector('.modal-actions');if(!dlg||!actions)return null;
  let btn=actions.querySelector('[data-entity-tools-launch]');
  if(!btn){
    btn=document.createElement('button');btn.type='button';btn.className='btn entity-tools-launch';btn.dataset.entityToolsLaunch='';btn.textContent='↗ Collegamenti & cronologia';btn.hidden=true;
    const cancel=actions.querySelector('[id$="Cancel"],[data-social-close],button:not(.danger)');
    if(cancel)actions.insertBefore(btn,cancel);else actions.appendChild(btn);
  }
  return btn;
}
function setTarget(dialogId,type,id,title){
  const btn=ensureLaunchButton(dialogId);if(!btn)return;
  btn.hidden=!id;
  btn.onclick=id?()=>open(type,id,title,'links',dialogId):null;
}
function clearTarget(dialogId){
  const btn=ensureLaunchButton(dialogId);if(btn){btn.hidden=true;btn.onclick=null}
}

export function initEntityTools(){
  if(!document.querySelector('link[href^="entity-tools.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='entity-tools.css?v=20260924-links1';document.head.appendChild(l)}
  if(!$('club42EntityToolsOverlay'))document.body.insertAdjacentHTML('beforeend',`
    <section id="club42EntityToolsOverlay" class="entity-tools-overlay" hidden aria-label="Collegamenti e cronologia">
      <div class="entity-tools-panel">
        <div class="entity-tools-head">
          <div><span id="club42EntityToolsKicker">Contesto operativo</span><h3 id="club42EntityToolsTitle">Elemento</h3></div>
          <button type="button" id="club42EntityToolsClose" aria-label="Chiudi">×</button>
        </div>
        <div class="entity-tools-tabs">
          <button type="button" class="active" data-entity-tools-tab="links">Collegamenti</button>
          <button type="button" data-entity-tools-tab="audit">Cronologia</button>
        </div>
        <div id="club42EntityLinks" class="entity-tools-body"></div>
        <div id="club42EntityAudit" class="entity-tools-body" hidden></div>
      </div>
    </section>`);
  $('club42EntityToolsClose').onclick=close;
  $('club42EntityToolsOverlay').onclick=ev=>{if(ev.target===$('club42EntityToolsOverlay'))close()};
  document.querySelectorAll('[data-entity-tools-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.entityToolsTab));
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!$('club42EntityToolsOverlay')?.hidden)close()});
  if(!auditChannel) auditChannel=db.channel('club42-entity-audit-live')
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'club42_audit_log'},payload=>{if(!$('club42EntityToolsOverlay')?.hidden&&relevantAudit(payload.new))loadAudit()})
    .subscribe();
}
export const entityTools={open,close,setTarget,clearTarget};
