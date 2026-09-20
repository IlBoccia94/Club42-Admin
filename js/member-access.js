import {$,app,db,esc,fmtDate,toast} from './core.js';
import {loadMembers} from './members.js?v=20260918-cycle1';
import {isAdmin} from './permissions.js';

const statusLabels={active:'Attivo',suspended:'Sospeso',resigned:'Dimesso',expired:'Scaduto'};
const feeLabels={unknown:'Da verificare',due:'Da rinnovare',paid:'Pagata',waived:'Esente'};
let limitedMembers=[],limitedCycle=null;

function hideAdminControls(){
  ['newMemberBtn','deleteExpiredMembers','exportMembersPdf','exportMembersCsv','exportMembersXlsx','memberDataFilter'].forEach(id=>{const el=$(id);if(el)el.hidden=true});
  const missing=$('memMissing')?.closest('.card');if(missing)missing.hidden=true;
  const head=document.querySelector('.members-table thead tr');if(head)head.innerHTML='<th>#</th><th>Socio</th><th>Iscrizione</th><th>Stato</th><th>Rinnovo</th>';
  const search=$('memberSearch');if(search)search.placeholder='🔎 Cerca nome o numero socio…';
}

function renderLimited(){
  hideAdminControls();
  const year=Number(limitedCycle?.active_year||limitedMembers[0]?.active_year||new Date().getFullYear());
  const label=`${year}/${year+1}`;
  if($('memYearLabel'))$('memYearLabel').textContent=label;
  if($('feeYearTitle'))$('feeYearTitle').textContent=label;
  if($('renewalCycleLabel'))$('renewalCycleLabel').textContent=label;
  if($('renewalExpiryDate'))$('renewalExpiryDate').textContent=fmtDate(limitedCycle?.expiry_date||limitedMembers[0]?.reference_date||'');
  $('memTotal').textContent=limitedMembers.length;
  $('memActive').textContent=limitedMembers.filter(m=>m.status==='active').length;
  $('memRenew').textContent=limitedMembers.filter(m=>m.payment_status==='due').length;
  const q=$('memberSearch').value.toLowerCase().trim(),sf=$('memberStatusFilter').value,ff=$('memberFeeFilter').value;
  let rows=limitedMembers.filter(m=>sf==='all'||m.status===sf).filter(m=>ff==='all'||m.payment_status===ff);
  if(q)rows=rows.filter(m=>[m.first_name,m.last_name,String(m.member_number)].some(v=>(v||'').toLowerCase().includes(q)));
  rows.sort((a,b)=>a.member_number-b.member_number);
  $('membersRows').innerHTML=rows.length?rows.map(m=>`<tr><td><b>${m.member_number}</b></td><td class="member-name"><b>${esc(`${m.first_name} ${m.last_name}`)}</b></td><td>${fmtDate(m.join_date)}</td><td><span class="member-status member-status-${m.status}">${statusLabels[m.status]||m.status}</span></td><td><span class="fee-status fee-status-${m.payment_status}">${feeLabels[m.payment_status]||m.payment_status}</span>${m.payment_status==='paid'&&m.paid_at?`<br><span class="muted">${fmtDate(m.paid_at)}</span>`:''}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">Nessun socio trovato.</td></tr>';
  $('membersCards').innerHTML=rows.length?rows.map(m=>`<article class="member-card" data-member-id="${m.id}"><div class="member-card-top"><div><h4>#${m.member_number} · ${esc(`${m.first_name} ${m.last_name}`)}</h4><p>Iscritto il ${fmtDate(m.join_date)}</p></div></div><div class="member-card-meta"><span class="member-status member-status-${m.status}">${statusLabels[m.status]||m.status}</span><span class="fee-status fee-status-${m.payment_status}">${feeLabels[m.payment_status]||m.payment_status}</span></div></article>`).join(''):'<div class="empty">Nessun socio trovato.</div>';
}

window.focusLimitedMember=id=>{
  const member=limitedMembers.find(m=>m.id===id);if(!member)return false;
  const search=$('memberSearch');if(search)search.value=String(member.member_number);
  renderLimited();
  requestAnimationFrame(()=>{
    const card=document.querySelector(`.member-card[data-member-id="${CSS.escape(id)}"]`);
    card?.scrollIntoView({behavior:'smooth',block:'center'});
    if(card){card.classList.add('member-linked-focus');setTimeout(()=>card.classList.remove('member-linked-focus'),2200)}
  });
  return true;
};

export async function loadMembersForRole(){
  if(isAdmin())return loadMembers();
  const [directoryResult,cycleResult]=await Promise.all([
    db.rpc('club42_member_directory'),
    db.rpc('club42_membership_cycle')
  ]);
  if(directoryResult.error||cycleResult.error){console.error(directoryResult.error||cycleResult.error);toast('Errore nel caricamento soci');return}
  limitedMembers=directoryResult.data||[];
  limitedCycle=Array.isArray(cycleResult.data)?cycleResult.data[0]:cycleResult.data;
  renderLimited();
  $('memberSearch').oninput=renderLimited;
  $('memberStatusFilter').onchange=renderLimited;
  $('memberFeeFilter').onchange=renderLimited;
}
