import {$,app,db,esc,fmtDate,toast} from './core.js';
import {loadMembers} from './members.js';
import {isAdmin} from './permissions.js';

const statusLabels={active:'Attivo',suspended:'Sospeso',resigned:'Dimesso',expired:'Scaduto'};
const feeLabels={unknown:'Da verificare',due:'Da rinnovare',paid:'Pagata',waived:'Esente'};
let limitedMembers=[];

function hideAdminControls(){
  ['newMemberBtn','saveRenewalReference','deleteExpiredMembers','exportMembersPdf','exportMembersCsv','exportMembersXlsx','memberDataFilter'].forEach(id=>{const el=$(id);if(el)el.hidden=true});
  const renewal=document.querySelector('.renewal-panel');if(renewal)renewal.hidden=true;
  const missing=$('memMissing')?.closest('.card');if(missing)missing.hidden=true;
  const head=document.querySelector('.members-table thead tr');if(head)head.innerHTML='<th>#</th><th>Socio</th><th>Iscrizione</th><th>Stato</th><th>Rinnovo</th>';
  const search=$('memberSearch');if(search)search.placeholder='🔎 Cerca nome o numero socio…';
}

function renderLimited(){
  hideAdminControls();
  const year=limitedMembers[0]?.active_year||new Date().getFullYear();
  if($('memYearLabel'))$('memYearLabel').textContent=year;
  if($('feeYearTitle'))$('feeYearTitle').textContent=year;
  $('memTotal').textContent=limitedMembers.length;
  $('memActive').textContent=limitedMembers.filter(m=>m.status==='active').length;
  $('memRenew').textContent=limitedMembers.filter(m=>m.payment_status==='due').length;
  const q=$('memberSearch').value.toLowerCase().trim(),sf=$('memberStatusFilter').value,ff=$('memberFeeFilter').value;
  let rows=limitedMembers.filter(m=>sf==='all'||m.status===sf).filter(m=>ff==='all'||m.payment_status===ff);
  if(q)rows=rows.filter(m=>[m.first_name,m.last_name,String(m.member_number)].some(v=>(v||'').toLowerCase().includes(q)));
  rows.sort((a,b)=>a.member_number-b.member_number);
  $('membersRows').innerHTML=rows.length?rows.map(m=>`<tr><td><b>${m.member_number}</b></td><td class="member-name"><b>${esc(`${m.first_name} ${m.last_name}`)}</b></td><td>${fmtDate(m.join_date)}</td><td><span class="member-status member-status-${m.status}">${statusLabels[m.status]||m.status}</span></td><td><span class="fee-status fee-status-${m.payment_status}">${feeLabels[m.payment_status]||m.payment_status}</span>${m.payment_status==='paid'&&m.paid_at?`<br><span class="muted">${fmtDate(m.paid_at)}</span>`:''}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">Nessun socio trovato.</td></tr>';
  $('membersCards').innerHTML=rows.length?rows.map(m=>`<article class="member-card"><div class="member-card-top"><div><h4>#${m.member_number} · ${esc(`${m.first_name} ${m.last_name}`)}</h4><p>Iscritto il ${fmtDate(m.join_date)}</p></div></div><div class="member-card-meta"><span class="member-status member-status-${m.status}">${statusLabels[m.status]||m.status}</span><span class="fee-status fee-status-${m.payment_status}">${feeLabels[m.payment_status]||m.payment_status}</span></div></article>`).join(''):'<div class="empty">Nessun socio trovato.</div>';
}

export async function loadMembersForRole(){
  if(isAdmin())return loadMembers();
  const {data,error}=await db.rpc('club42_member_directory');
  if(error){console.error(error);toast('Errore nel caricamento soci');return}
  limitedMembers=data||[];renderLimited();
  $('memberSearch').oninput=renderLimited;
  $('memberStatusFilter').onchange=renderLimited;
  $('memberFeeFilter').onchange=renderLimited;
}
