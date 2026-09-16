import {$,app,db,esc,toast} from './core.js';
import {loadSocial} from './social.js';

let managedFormats=[];
let editFormatId=null;
let observer=null;
let observerHost=null;
let refreshTimer=null;

const typeLabels={reel:'Reel',carousel:'Carousel',story:'Stories',post:'Post',live:'Live',other:'Altro'};
const objectiveLabels={discovery:'Scoperta',community:'Community',event:'Evento',culture:'Cultura',conversion:'Conversione'};

function formatCard(f){
  return `<article class="social-format">
    <div><span class="social-type">${typeLabels[f.default_type]||esc(f.default_type)}</span> <span class="role-pill">${objectiveLabels[f.default_objective]||esc(f.default_objective)}</span></div>
    <h4>${esc(f.name)}</h4>
    <p>${esc(f.description||'')}</p>
    <small>KPI: ${esc(f.primary_kpi||'da definire')}</small>
    <div class="social-format-actions">
      <button class="btn" type="button" onclick="newFromFormat('${f.id}')">Usa format</button>
      <button class="btn" type="button" onclick="editSocialFormat('${f.id}')">Modifica</button>
      <button class="btn danger" type="button" onclick="deleteSocialFormat('${f.id}')">Elimina</button>
    </div>
  </article>`;
}

function observeHost(){
  const host=$('socialFormats');
  if(!host||!observer)return;
  observerHost=host;
  observer.observe(host,{childList:true,subtree:false});
}

function renderFormats(){
  const host=$('socialFormats');
  if(!host)return;
  observer?.disconnect();
  host.innerHTML=managedFormats.length
    ?managedFormats.map(formatCard).join('')
    :'<div class="empty">Nessun format ricorrente. Creane uno per iniziare.</div>';
  observeHost();
}

export async function refreshSocialFormats(){
  if(!app.currentUser)return;
  const {data,error}=await db.from('social_formats').select('*').eq('active',true).order('name');
  if(error){console.error(error);toast('Errore nel caricamento dei format');return}
  managedFormats=data||[];
  renderFormats();
}

function scheduleRefresh(){
  if(!app.currentUser)return;
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(()=>refreshSocialFormats(),30);
}

function ensureUi(){
  const secondCard=document.querySelector('#social-tab-ideas .social-ideas-card:nth-child(2)');
  const head=secondCard?.querySelector('.section-head');
  if(head&&!$('newSocialFormatBtn')){
    const btn=document.createElement('button');
    btn.className='btn';
    btn.type='button';
    btn.id='newSocialFormatBtn';
    btn.textContent='＋ Nuovo format';
    head.appendChild(btn);
  }

  if(!$('socialFormatDlg')){
    document.body.insertAdjacentHTML('beforeend',`
      <dialog id="socialFormatDlg" class="social-dialog-wide">
        <form class="modal" id="socialFormatForm">
          <div class="modal-head">
            <h3 id="socialFormatDlgTitle">Nuovo format</h3>
            <button type="button" class="close" id="socialFormatClose">×</button>
          </div>
          <div class="form-grid">
            <div class="field full"><label>Nome format *</label><input id="sfName" required placeholder="Es. 42 secondi"></div>
            <div class="field full"><label>Descrizione</label><textarea id="sfDescription" rows="3" placeholder="Come funziona il format e quando usarlo"></textarea></div>
            <div class="field"><label>Tipo predefinito</label><select id="sfType"><option value="reel">Reel</option><option value="carousel">Carousel</option><option value="story">Stories</option><option value="post">Post</option><option value="live">Live</option><option value="other">Altro</option></select></div>
            <div class="field"><label>Obiettivo predefinito</label><select id="sfObjective"><option value="discovery">Scoperta</option><option value="community">Community</option><option value="event">Evento</option><option value="culture">Cultura</option><option value="conversion">Conversione</option></select></div>
            <div class="field"><label>Pilastro predefinito</label><select id="sfPillar"><option value="people">Persone</option><option value="stories">Storie</option><option value="format">Format</option><option value="locality">Località</option><option value="conversion">Conversione</option></select></div>
            <div class="field"><label>KPI principale</label><input id="sfKpi" placeholder="Es. Condivisioni e completion rate"></div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn danger" id="socialFormatDeleteBtn" style="display:none;margin-right:auto">Elimina</button>
            <button type="button" class="btn" id="socialFormatCancel">Annulla</button>
            <button class="btn primary">Salva format</button>
          </div>
        </form>
      </dialog>`);
  }
}

function resetFormatForm(){
  editFormatId=null;
  $('socialFormatForm').reset();
  $('socialFormatDlgTitle').textContent='Nuovo format';
  $('sfType').value='reel';
  $('sfObjective').value='discovery';
  $('sfPillar').value='format';
  $('socialFormatDeleteBtn').style.display='none';
}

function openNewFormat(){
  resetFormatForm();
  $('socialFormatDlg').showModal();
}

window.editSocialFormat=id=>{
  const f=managedFormats.find(x=>x.id===id);
  if(!f)return;
  editFormatId=id;
  $('socialFormatDlgTitle').textContent='Modifica format';
  $('sfName').value=f.name||'';
  $('sfDescription').value=f.description||'';
  $('sfType').value=f.default_type||'reel';
  $('sfObjective').value=f.default_objective||'discovery';
  $('sfPillar').value=f.default_pillar||'format';
  $('sfKpi').value=f.primary_kpi||'';
  $('socialFormatDeleteBtn').style.display='inline-flex';
  $('socialFormatDlg').showModal();
};

async function deleteFormat(id){
  const f=managedFormats.find(x=>x.id===id);
  if(!f)return;
  if(!confirm(`Eliminare il format “${f.name}”? I contenuti già creati resteranno salvati, ma non saranno più collegati a questo format.`))return;
  const {error}=await db.from('social_formats').delete().eq('id',id);
  if(error)return toast(error.message);
  if($('socialFormatDlg')?.open)$('socialFormatDlg').close();
  toast('Format eliminato');
  await loadSocial();
  await refreshSocialFormats();
}

window.deleteSocialFormat=id=>deleteFormat(id);

async function saveFormat(ev){
  ev.preventDefault();
  const row={
    name:$('sfName').value.trim(),
    description:$('sfDescription').value.trim()||null,
    default_type:$('sfType').value,
    default_objective:$('sfObjective').value,
    default_pillar:$('sfPillar').value,
    primary_kpi:$('sfKpi').value.trim()||null,
    active:true
  };
  let result;
  if(editFormatId)result=await db.from('social_formats').update(row).eq('id',editFormatId);
  else result=await db.from('social_formats').insert({...row,created_by:app.currentUser?.id||null});
  if(result.error){
    if(result.error.code==='23505')return toast('Esiste già un format con questo nome.');
    return toast(result.error.message);
  }
  $('socialFormatDlg').close();
  toast(editFormatId?'Format aggiornato':'Format creato');
  await loadSocial();
  await refreshSocialFormats();
}

export function initSocialFormats(){
  ensureUi();
  $('newSocialFormatBtn').onclick=openNewFormat;
  $('socialFormatClose').onclick=()=>$('socialFormatDlg').close();
  $('socialFormatCancel').onclick=()=>$('socialFormatDlg').close();
  $('socialFormatDeleteBtn').onclick=()=>{if(editFormatId)deleteFormat(editFormatId)};
  $('socialFormatForm').addEventListener('submit',saveFormat);

  observer=new MutationObserver(()=>scheduleRefresh());
  observeHost();
}
