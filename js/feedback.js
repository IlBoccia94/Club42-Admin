import {$,app,db,esc,toast} from './core.js';
import {canUseOperations} from './permissions.js?v=20260918-feedback2';

let feedbackRows=[];
let feedbackUpdates=[];
let initialized=false;
let saving=false;
const busyFeedbackIds=new Set();

const priorityMeta={
  low:{label:'Bassa',rank:1},
  medium:{label:'Media',rank:2},
  high:{label:'Alta',rank:3},
  critical:{label:'Critica',rank:4}
};

function dateTime(value){
  if(!value)return '—';
  return new Date(value).toLocaleString('it-IT',{
    day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'
  });
}
function updatesFor(feedbackId){
  return feedbackUpdates.filter(u=>u.feedback_id===feedbackId)
    .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
}
function sortOpenRows(rows){
  const mode=$('feedbackSort')?.value||'date';
  const copy=[...rows];
  if(mode==='priority'){
    return copy.sort((a,b)=>{
      const rank=(priorityMeta[b.priority]?.rank||0)-(priorityMeta[a.priority]?.rank||0);
      if(rank)return rank;
      return new Date(a.created_at)-new Date(b.created_at);
    });
  }
  return copy.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
}
function sortResolvedRows(rows){
  return [...rows].sort((a,b)=>new Date(b.resolved_at||b.created_at)-new Date(a.resolved_at||a.created_at));
}
function renderNotes(row){
  const notes=updatesFor(row.id);
  const history=notes.length
    ? `<div class="feedback-updates">${notes.map(n=>`<div class="feedback-update"><p>${esc(n.note).replaceAll('\n','<br>')}</p><span>${esc(n.created_by_name||'Utente Club42')} · ${esc(dateTime(n.created_at))}</span></div>`).join('')}</div>`
    : '<div class="feedback-no-updates">Nessuna nota di aggiornamento.</div>';
  return `<div class="feedback-update-area">
    <div class="feedback-update-title">Aggiornamenti</div>
    ${history}
    <div class="feedback-add-update">
      <textarea rows="2" maxlength="2000" data-feedback-note-text="${row.id}" placeholder="Aggiungi una nota di aggiornamento…"></textarea>
      <button class="btn soft" type="button" data-feedback-note="${row.id}">Aggiungi nota</button>
    </div>
  </div>`;
}
function renderCard(row,resolved=false){
  const p=priorityMeta[row.priority]||priorityMeta.medium;
  const stateAction=resolved
    ? `<button class="btn feedback-reopen-btn" type="button" data-feedback-reopen="${row.id}">↺ Riapri</button>`
    : `<button class="btn success feedback-resolve-btn" type="button" data-feedback-resolve="${row.id}">✓ Segna risolto</button>`;
  const resolvedMeta=resolved
    ? `<div class="feedback-resolved-meta">Risolto ${esc(dateTime(row.resolved_at))}${row.resolved_by_name?` da <strong>${esc(row.resolved_by_name)}</strong>`:''}</div>`
    : '';
  return `<article class="feedback-item ${resolved?'resolved':''}">
    <div class="feedback-item-top">
      <div class="feedback-item-badges"><span class="feedback-priority ${esc(row.priority)}">${esc(p.label)}</span>${resolved?'<span class="feedback-state resolved">Risolto</span>':'<span class="feedback-state open">Da risolvere</span>'}</div>
      <time>${esc(dateTime(row.created_at))}</time>
    </div>
    <p class="feedback-description">${esc(row.description).replaceAll('\n','<br>')}</p>
    <div class="feedback-author">Richiesta da <strong>${esc(row.requested_by_name||'Utente Club42')}</strong></div>
    ${resolvedMeta}
    <div class="feedback-card-actions">${stateAction}</div>
    ${renderNotes(row)}
  </article>`;
}
function bindListActions(root){
  if(!root)return;
  root.querySelectorAll('[data-feedback-resolve]').forEach(btn=>btn.onclick=()=>setResolved(btn.dataset.feedbackResolve,true));
  root.querySelectorAll('[data-feedback-reopen]').forEach(btn=>btn.onclick=()=>setResolved(btn.dataset.feedbackReopen,false));
  root.querySelectorAll('[data-feedback-note]').forEach(btn=>btn.onclick=()=>addUpdate(btn.dataset.feedbackNote));
}
function renderFeedback(){
  const openRoot=$('feedbackOpenList'),resolvedRoot=$('feedbackResolvedList');
  if(!openRoot||!resolvedRoot)return;
  const open=sortOpenRows(feedbackRows.filter(r=>!r.resolved));
  const resolved=sortResolvedRows(feedbackRows.filter(r=>r.resolved));
  $('feedbackOpenCount').textContent=String(open.length);
  $('feedbackResolvedCount').textContent=String(resolved.length);
  const priorityMode=$('feedbackSort')?.value==='priority';
  $('feedbackSortNote').textContent=priorityMode
    ?'Priorità Critica → Alta → Media → Bassa; a parità di priorità, dal più vecchio al più nuovo.'
    :'Ordinati per data di inserimento, dal più recente.';
  openRoot.innerHTML=open.length?open.map(r=>renderCard(r,false)).join(''):'<div class="feedback-empty">Nessun feedback da risolvere 🎉</div>';
  resolvedRoot.innerHTML=resolved.length?resolved.map(r=>renderCard(r,true)).join(''):'<div class="feedback-empty">Nessun feedback risolto.</div>';
  bindListActions(openRoot);bindListActions(resolvedRoot);
}
export async function loadFeedback(){
  if(!canUseOperations())return;
  if($('feedbackCurrentUser'))$('feedbackCurrentUser').textContent=app.currentProfile?.display_name||app.currentProfile?.email||'Utente Club42';
  const [feedbackResult,updatesResult]=await Promise.all([
    db.from('feedback_requests')
      .select('id,description,priority,requested_by_name,created_at,resolved,resolved_at,resolved_by_name')
      .order('created_at',{ascending:false}),
    db.from('feedback_updates')
      .select('id,feedback_id,note,created_by_name,created_at')
      .order('created_at',{ascending:true})
  ]);
  if(feedbackResult.error||updatesResult.error){
    console.error(feedbackResult.error||updatesResult.error);
    toast('Errore nel caricamento dei feedback');
    feedbackRows=[];feedbackUpdates=[];
  }else{
    feedbackRows=feedbackResult.data||[];
    feedbackUpdates=updatesResult.data||[];
  }
  renderFeedback();
}
async function submitFeedback(ev){
  ev.preventDefault();
  if(saving||!canUseOperations())return;
  const description=$('feedbackDescription').value.trim();
  const priority=$('feedbackPriority').value;
  if(description.length<3){toast('Inserisci una descrizione più completa');return}
  try{
    saving=true;
    $('feedbackSubmitBtn').disabled=true;
    $('feedbackSubmitBtn').textContent='Invio…';
    const {error}=await db.from('feedback_requests').insert({description,priority});
    if(error)throw error;
    $('feedbackDescription').value='';
    $('feedbackPriority').value='medium';
    toast('Richiesta inviata');
    await loadFeedback();
  }catch(error){
    console.error(error);
    toast(error.message||'Errore durante l’invio del feedback');
  }finally{
    saving=false;
    $('feedbackSubmitBtn').disabled=false;
    $('feedbackSubmitBtn').textContent='Invia richiesta';
  }
}
async function setResolved(id,resolved){
  if(!canUseOperations()||!id||busyFeedbackIds.has(id))return;
  busyFeedbackIds.add(id);
  try{
    const {data,error}=await db.from('feedback_requests').update({resolved}).eq('id',id).select('id,resolved').maybeSingle();
    if(error)throw error;
    if(!data)throw new Error('Feedback non aggiornato');
    toast(resolved?'Feedback spostato tra i risolti':'Feedback riaperto');
    await loadFeedback();
  }catch(error){
    console.error(error);
    toast(error.message||'Errore nell’aggiornamento del feedback');
  }finally{
    busyFeedbackIds.delete(id);
  }
}
async function addUpdate(id){
  if(!canUseOperations()||!id||busyFeedbackIds.has(id))return;
  const input=document.querySelector(`[data-feedback-note-text="${CSS.escape(id)}"]`);
  const note=input?.value?.trim()||'';
  if(!note){toast('Scrivi una nota di aggiornamento');input?.focus();return}
  busyFeedbackIds.add(id);
  try{
    const {error}=await db.from('feedback_updates').insert({feedback_id:id,note});
    if(error)throw error;
    toast('Nota aggiunta');
    await loadFeedback();
  }catch(error){
    console.error(error);
    toast(error.message||'Errore durante l’aggiunta della nota');
  }finally{
    busyFeedbackIds.delete(id);
  }
}
export function initFeedback(){
  if(initialized)return;initialized=true;
  $('feedbackForm')?.addEventListener('submit',submitFeedback);
  $('feedbackRefreshBtn')?.addEventListener('click',loadFeedback);
  $('feedbackSort')?.addEventListener('change',renderFeedback);
}
