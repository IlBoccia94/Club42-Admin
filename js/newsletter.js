import {$,app,db,SUPABASE_URL,SUPABASE_KEY,esc,toast} from './core.js';
import {isAdmin} from './permissions.js';

const MAX_ATTACHMENTS=10;
const MAX_FILE_BYTES=6*1024*1024;
const MAX_TOTAL_BYTES=8*1024*1024;
const ALLOWED_EXTENSIONS=new Set(['pdf','jpg','jpeg','png','doc','docx']);
let recipients=[];
let selected=new Set();
let attachments=[];
let historyRows=[];
let initialized=false;
let sending=false;

function emailOk(v=''){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())}
function ext(name=''){const p=String(name).toLowerCase().split('.');return p.length>1?p.pop()||'':''}
function splitDisplayName(value=''){
  const parts=String(value).trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return{first:'—',last:'—'};
  return{first:parts[0],last:parts.slice(1).join(' ')||'—'};
}
function memberNameFor(user,membersByEmail){
  const member=membersByEmail.get(String(user.email||'').toLowerCase());
  if(member)return{first:member.first_name||'—',last:member.last_name||'—'};
  return splitDisplayName(user.display_name||'');
}
function formatBytes(bytes){
  if(bytes<1024)return `${bytes} B`;
  if(bytes<1024*1024)return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}
function dateTime(v){
  if(!v)return '—';
  const d=new Date(v);
  return d.toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function stripHtml(value=''){
  const div=document.createElement('div');div.innerHTML=value;return (div.textContent||'').replace(/\s+/g,' ').trim();
}
function selectedCount(){return [...selected].filter(id=>recipients.some(r=>r.user_id===id&&r.valid)).length}
function updateSelectedCount(){
  const n=selectedCount();
  $('newsletterSelectedCount').textContent=`${n} ${n===1?'destinatario selezionato':'destinatari selezionati'}`;
  const validIds=recipients.filter(r=>r.valid).map(r=>r.user_id);
  $('newsletterSelectAll').checked=validIds.length>0&&validIds.every(id=>selected.has(id));
  $('newsletterSelectAll').indeterminate=validIds.some(id=>selected.has(id))&&!$('newsletterSelectAll').checked;
}
function renderRecipients(){
  const root=$('newsletterRecipients');if(!root)return;
  const q=($('newsletterSearch')?.value||'').toLowerCase().trim();
  const filtered=recipients.filter(r=>!q||[r.first_name,r.last_name,r.email,r.display_name].some(v=>String(v||'').toLowerCase().includes(q)));
  if(!filtered.length){root.innerHTML='<div class="newsletter-empty">Nessun Guest con newsletter attiva.</div>';updateSelectedCount();return}
  root.innerHTML=filtered.map(r=>`<label class="newsletter-recipient-row ${r.valid?'':'invalid'}"><input type="checkbox" data-newsletter-recipient="${r.user_id}" ${selected.has(r.user_id)?'checked':''} ${r.valid?'':'disabled'}><div class="newsletter-recipient-copy"><b>${esc(r.first_name)} ${esc(r.last_name)}</b><span>${esc(r.email||'Email mancante')}</span>${r.valid?'':'<span class="newsletter-invalid-pill">Email non valida</span>'}</div></label>`).join('');
  root.querySelectorAll('[data-newsletter-recipient]').forEach(input=>input.addEventListener('change',()=>{
    const id=input.dataset.newsletterRecipient;if(!id)return;
    if(input.checked)selected.add(id);else selected.delete(id);updateSelectedCount();
  }));
  updateSelectedCount();
}
function renderAttachments(){
  const root=$('newsletterAttachmentsList');if(!root)return;
  if(!attachments.length){root.innerHTML='<div class="newsletter-no-attachments">Nessun allegato.</div>';return}
  root.innerHTML=attachments.map((a,i)=>`<div class="newsletter-attachment-item"><div class="newsletter-attachment-info"><b>${esc(a.file.name)}</b><span>${formatBytes(a.file.size)}</span></div><button type="button" class="newsletter-remove-attachment" data-remove-attachment="${i}" title="Rimuovi">×</button></div>`).join('');
  root.querySelectorAll('[data-remove-attachment]').forEach(btn=>btn.onclick=()=>{attachments.splice(Number(btn.dataset.removeAttachment),1);renderAttachments()});
}
function historyStatusLabel(s){return s==='completed'?'Completata':s==='partial'?'Parziale':s==='failed'?'Fallita':'In corso'}
function renderHistory(){
  const root=$('newsletterHistory');if(!root)return;
  if(!historyRows.length){root.innerHTML='<div class="newsletter-empty">Nessuna newsletter inviata.</div>';return}
  root.innerHTML=historyRows.map(r=>`<article class="newsletter-history-item"><div class="newsletter-history-main"><b>${esc(r.subject)}</b><span>${dateTime(r.created_at)} · ${esc(r.sent_by_name||'Admin')}</span><span>${esc(stripHtml(r.body_html).slice(0,130))}${stripHtml(r.body_html).length>130?'…':''}</span></div><div class="newsletter-history-result"><strong>${r.success_count}/${r.recipient_count} inviate</strong><span>${r.failure_count?`${r.failure_count} fallite`:r.attachment_count?`${r.attachment_count} allegati`:'Nessun errore'}</span></div><span class="newsletter-history-status ${esc(r.status)}">${historyStatusLabel(r.status)}</span></article>`).join('');
}
function setSendStatus(kind,title,text){
  const box=$('newsletterSendStatus');if(!box)return;
  box.hidden=false;box.className=`newsletter-send-status ${kind||''}`;box.innerHTML=`<strong>${esc(title)}</strong>${esc(text||'')}`;
}
function clearSendStatus(){const box=$('newsletterSendStatus');if(box)box.hidden=true}
function setSending(value){
  sending=value;
  ['newsletterTestBtn','newsletterSendBtn','newsletterConfirmSend'].forEach(id=>{const el=$(id);if(el)el.disabled=value});
}
function editorHtml(){return $('newsletterEditor')?.innerHTML?.trim()||''}
function editorText(){return $('newsletterEditor')?.innerText?.trim()||''}
function validateCompose(requireRecipients=true){
  const subject=$('newsletterSubject').value.trim();
  if(!subject){toast('Inserisci l’oggetto della newsletter');$('newsletterSubject').focus();return null}
  if(!editorText()){toast('Scrivi il corpo della mail');$('newsletterEditor').focus();return null}
  const ids=[...selected].filter(id=>recipients.some(r=>r.user_id===id&&r.valid));
  if(requireRecipients&&!ids.length){toast('Seleziona almeno un destinatario');return null}
  return{subject,bodyHtml:editorHtml(),recipientUserIds:ids};
}
function readFileBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');r.onerror=()=>reject(r.error||new Error('Errore lettura file'));r.readAsDataURL(file)})}
async function serializeAttachments(){
  const out=[];
  for(const item of attachments)out.push({name:item.file.name,type:item.file.type||'',size:item.file.size,data:await readFileBase64(item.file)});
  return out;
}
async function newsletterApi(payload){
  const {data:{session}}=await db.auth.getSession();
  if(!session)throw new Error('Sessione scaduta');
  const response=await fetch(`${SUPABASE_URL}/functions/v1/send-newsletter`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':SUPABASE_KEY},body:JSON.stringify(payload)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Errore invio newsletter');
  return data;
}
async function loadHistory(){
  const {data,error}=await db.from('newsletter_sends').select('id,created_at,completed_at,subject,body_html,recipient_count,success_count,failure_count,attachment_count,status,sent_by_name,last_error').order('created_at',{ascending:false}).limit(40);
  if(error){console.error(error);historyRows=[]}else historyRows=data||[];
  renderHistory();
}
async function loadRecipients(){
  const [{data:users,error:userError},{data:members,error:memberError}]=await Promise.all([
    db.from('admin_users').select('user_id,email,display_name,newsletter_active').eq('role','guest').eq('active',true).eq('status','active').eq('newsletter_active',true).order('display_name'),
    db.from('members').select('first_name,last_name,email').not('email','is',null)
  ]);
  if(userError)throw userError;
  if(memberError)console.warn(memberError);
  const membersByEmail=new Map((members||[]).map(m=>[String(m.email||'').toLowerCase(),m]));
  recipients=(users||[]).map(u=>{const names=memberNameFor(u,membersByEmail);return{...u,first_name:names.first,last_name:names.last,valid:emailOk(u.email)}});
  selected=new Set(recipients.filter(r=>r.valid).map(r=>r.user_id));
  renderRecipients();
}
async function handleFiles(fileList){
  const incoming=[...fileList];
  if(attachments.length+incoming.length>MAX_ATTACHMENTS)return toast(`Puoi allegare al massimo ${MAX_ATTACHMENTS} file`);
  let total=attachments.reduce((s,a)=>s+a.file.size,0);
  for(const file of incoming){
    if(!ALLOWED_EXTENSIONS.has(ext(file.name))){toast(`Formato non supportato: ${file.name}`);continue}
    if(file.size>MAX_FILE_BYTES){toast(`${file.name} supera 6 MB`);continue}
    if(total+file.size>MAX_TOTAL_BYTES){toast('Gli allegati superano 8 MB totali');break}
    attachments.push({file});total+=file.size;
  }
  $('newsletterAttachmentInput').value='';renderAttachments();
}
function execEditor(command,value=null){$('newsletterEditor').focus();document.execCommand(command,false,value)}
function insertLink(){
  let url=prompt('URL del link:','https://');if(!url)return;url=url.trim();
  if(!/^(https?:\/\/|mailto:)/i.test(url))url='https://'+url;
  execEditor('createLink',url);
}
function showConfirm(){
  const data=validateCompose(true);if(!data)return;
  const n=data.recipientUserIds.length,a=attachments.length;
  $('newsletterConfirmSummary').innerHTML=`<div><strong>Oggetto:</strong> ${esc(data.subject)}</div><div><strong>Destinatari:</strong> ${n}</div><div><strong>Allegati:</strong> ${a}</div><div>Stai per inviare questa newsletter a <strong>${n} ${n===1?'persona':'persone'}</strong>. Ogni destinatario riceverà una mail individuale. Vuoi continuare?</div>`;
  $('newsletterConfirmDlg').showModal();
}
async function sendTest(){
  if(sending)return;const data=validateCompose(false);if(!data)return;
  try{setSending(true);setSendStatus('','Invio email di test…','Preparazione allegati e invio a club42.laspezia@gmail.com.');const files=await serializeAttachments();await newsletterApi({action:'test',subject:data.subject,bodyHtml:data.bodyHtml,attachments:files});setSendStatus('success','Email di test inviata','Controlla la casella club42.laspezia@gmail.com prima dell’invio definitivo.');toast('Email di test inviata')}catch(e){setSendStatus('error','Invio test non riuscito',e.message);toast(e.message)}finally{setSending(false)}
}
async function sendFinal(){
  if(sending)return;const data=validateCompose(true);if(!data)return;$('newsletterConfirmDlg').close();
  const requestId=crypto.randomUUID();
  try{setSending(true);setSendStatus('','Invio newsletter…',`Invio individuale a ${data.recipientUserIds.length} destinatari. Non chiudere questa pagina fino al riepilogo finale.`);const files=await serializeAttachments();const result=await newsletterApi({action:'send',requestId,subject:data.subject,bodyHtml:data.bodyHtml,attachments:files,recipientUserIds:data.recipientUserIds});const send=result.send||{};const ok=Number(send.success_count||0),fail=Number(send.failure_count||0),total=Number(send.recipient_count||data.recipientUserIds.length);setSendStatus(fail?'error':'success',fail?'Newsletter inviata con alcuni errori':'Newsletter inviata',`${ok} email inviate correttamente su ${total}.${fail?` ${fail} email non inviate.`:''}`);toast(fail?`${ok} inviate, ${fail} fallite`:'Newsletter inviata');await loadHistory()}catch(e){setSendStatus('error','Invio newsletter non riuscito',e.message);toast(e.message);await loadHistory()}finally{setSending(false)}
}
function ensureNewsletterConsentControls(){
  if(!$('uNewsletterActive')){
    const grid=document.querySelector('#userForm .form-grid');
    if(grid)grid.insertAdjacentHTML('beforeend','<div class="field full newsletter-consent-field" id="uNewsletterWrap"><label class="newsletter-consent-check"><input id="uNewsletterActive" type="checkbox"> Newsletter attiva</label><div class="newsletter-consent-help">Disponibile solo per i Guest. Il consenso viene registrato con data e ora.</div></div>');
  }
  if(!$('iNewsletterActive')){
    const grid=document.querySelector('#inviteForm .form-grid');
    if(grid)grid.insertAdjacentHTML('beforeend','<div class="field full newsletter-consent-field" id="iNewsletterWrap"><label class="newsletter-consent-check"><input id="iNewsletterActive" type="checkbox"> Newsletter attiva</label><div class="newsletter-consent-help">Disponibile solo se il nuovo utente viene creato come Guest.</div></div>');
  }
  const sync=()=>{
    if($('uNewsletterWrap'))$('uNewsletterWrap').hidden=$('uRole')?.value!=='guest';
    if($('iNewsletterWrap'))$('iNewsletterWrap').hidden=$('iRole')?.value!=='guest';
    if($('uRole')?.value!=='guest'&&$('uNewsletterActive'))$('uNewsletterActive').checked=false;
    if($('iRole')?.value!=='guest'&&$('iNewsletterActive'))$('iNewsletterActive').checked=false;
  };
  $('uRole')?.addEventListener('change',sync);$('iRole')?.addEventListener('change',sync);sync();
}
export function syncUserNewsletterControls(){ensureNewsletterConsentControls()}
export function setUserNewsletterForm(user){ensureNewsletterConsentControls();if($('uNewsletterActive'))$('uNewsletterActive').checked=!!user?.newsletter_active;if($('uNewsletterWrap'))$('uNewsletterWrap').hidden=user?.role!=='guest'}
export function resetInviteNewsletterForm(role='staff'){ensureNewsletterConsentControls();if($('iNewsletterActive'))$('iNewsletterActive').checked=false;if($('iNewsletterWrap'))$('iNewsletterWrap').hidden=role!=='guest'}
export function getUserNewsletterValue(kind='edit'){return kind==='invite'?!!$('iNewsletterActive')?.checked:!!$('uNewsletterActive')?.checked}

export async function loadNewsletter(){
  if(!isAdmin())return;
  clearSendStatus();
  try{await Promise.all([loadRecipients(),loadHistory()])}catch(e){console.error(e);toast('Errore nel caricamento Newsletter')}
}
export function initNewsletter(){
  if(initialized)return;initialized=true;
  ensureNewsletterConsentControls();
  $('newsletterSearch').addEventListener('input',renderRecipients);
  $('newsletterSelectAll').addEventListener('change',e=>{const on=e.target.checked;recipients.filter(r=>r.valid).forEach(r=>on?selected.add(r.user_id):selected.delete(r.user_id));renderRecipients()});
  $('newsletterAttachmentInput').addEventListener('change',e=>handleFiles(e.target.files||[]));
  $('newsletterToolbar').querySelectorAll('[data-command]').forEach(btn=>btn.addEventListener('click',()=>execEditor(btn.dataset.command)));
  $('newsletterToolbar').querySelectorAll('[data-heading]').forEach(btn=>btn.addEventListener('click',()=>execEditor('formatBlock',btn.dataset.heading)));
  $('newsletterLinkBtn').addEventListener('click',insertLink);
  $('newsletterTestBtn').addEventListener('click',sendTest);
  $('newsletterSendBtn').addEventListener('click',showConfirm);
  $('newsletterConfirmSend').addEventListener('click',sendFinal);
  $('newsletterConfirmClose').addEventListener('click',()=>$('newsletterConfirmDlg').close());
  $('newsletterConfirmCancel').addEventListener('click',()=>$('newsletterConfirmDlg').close());
  $('newsletterRefreshHistory').addEventListener('click',loadHistory);
}
