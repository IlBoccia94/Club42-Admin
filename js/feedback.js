import {$,app,db,esc,toast} from './core.js';
import {canUseOperations} from './permissions.js?v=20260918-feedback1';

let feedbackRows=[];
let initialized=false;
let saving=false;

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
function renderFeedback(){
  const root=$('feedbackList');if(!root)return;
  if(!feedbackRows.length){
    root.innerHTML='<div class="feedback-empty">Nessuna richiesta inserita.</div>';
    return;
  }
  root.innerHTML=feedbackRows.map(r=>{
    const p=priorityMeta[r.priority]||priorityMeta.medium;
    return `<article class="feedback-item">
      <div class="feedback-item-top">
        <span class="feedback-priority ${esc(r.priority)}">${esc(p.label)}</span>
        <time>${esc(dateTime(r.created_at))}</time>
      </div>
      <p>${esc(r.description).replaceAll('\n','<br>')}</p>
      <div class="feedback-author">Richiesta da <strong>${esc(r.requested_by_name||'Utente Club42')}</strong></div>
    </article>`;
  }).join('');
}
export async function loadFeedback(){
  if(!canUseOperations())return;
  if($('feedbackCurrentUser'))$('feedbackCurrentUser').textContent=app.currentProfile?.display_name||app.currentProfile?.email||'Utente Club42';
  const {data,error}=await db.from('feedback_requests')
    .select('id,description,priority,requested_by_name,created_at')
    .order('created_at',{ascending:false});
  if(error){console.error(error);toast('Errore nel caricamento dei feedback');feedbackRows=[]}
  else feedbackRows=data||[];
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
export function initFeedback(){
  if(initialized)return;initialized=true;
  $('feedbackForm')?.addEventListener('submit',submitFeedback);
  $('feedbackRefreshBtn')?.addEventListener('click',loadFeedback);
}
