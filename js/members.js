import {$,app,db,esc,fmtDate,toast,download} from './core.js';

let ACTIVE_YEAR=new Date().getFullYear(),yearStart='',expiryDate='';
let members=[],fees=[],editMemberId=null;

const statusLabels={active:'Attivo',suspended:'Sospeso',resigned:'Dimesso',expired:'Scaduto'};
const feeLabels={unknown:'Da verificare',due:'Da rinnovare',paid:'Pagata',waived:'Esente'};

function feeFor(memberId){return fees.find(f=>f.member_id===memberId&&f.year===ACTIVE_YEAR)||null}
function fullName(m){return `${m.first_name} ${m.last_name}`.trim()}
function missingCount(m){let n=0;if(!m.tax_code)n++;if(!m.email)n++;return n}
function cycleLabel(){return `${ACTIVE_YEAR}/${ACTIVE_YEAR+1}`}
function needsRenewal(m){return !!m.join_date&&!['resigned','expired'].includes(m.status)&&!!yearStart&&m.join_date<yearStart}
function effectiveFeeStatus(m){const f=feeFor(m.id);return f?.payment_status||(needsRenewal(m)?'due':'unknown')}
function normalizedRows(){return members.slice().sort((a,b)=>a.member_number-b.member_number).map(m=>{const f=feeFor(m.id),fs=effectiveFeeStatus(m);return{Numero:m.member_number,Nome:m.first_name,Cognome:m.last_name,'Codice fiscale':m.tax_code||'',Email:m.email||'',Telefono:m.phone||'','Data iscrizione':m.join_date||'',Stato:statusLabels[m.status]||m.status,'Firma ricevuta':m.signature_received?'Sì':'No','Annualità':cycleLabel(),'Quota':f?.amount??15,'Stato quota':feeLabels[fs],'Data pagamento':f?.paid_at||'','Metodo pagamento':f?.payment_method||'','Numero ricevuta':f?.receipt_number||'',Note:m.notes||'','Note quota':f?.notes||''}})}

async function syncRenewals(){
 const updates=[],inserts=[];
 for(const m of members){
  if(!needsRenewal(m))continue;
  const f=feeFor(m.id);
  if(f){
   if(['paid','waived','due'].includes(f.payment_status))continue;
   updates.push(db.from('membership_years').update({payment_status:'due'}).eq('id',f.id));
  }else{
   inserts.push({member_id:m.id,year:ACTIVE_YEAR,amount:15,payment_status:'due',created_by:app.currentUser?.id||null});
  }
 }
 if(inserts.length){const {error}=await db.from('membership_years').insert(inserts);if(error)console.error(error)}
 if(updates.length)await Promise.all(updates);
 if(inserts.length||updates.length){const {data}=await db.from('membership_years').select('*').eq('year',ACTIVE_YEAR);fees=data||fees}
}

export async function loadMembers(){
 const [mr,cr,fr]=await Promise.all([
  db.from('members').select('*').order('member_number'),
  db.rpc('club42_membership_cycle'),
  db.from('membership_years').select('*')
 ]);
 if(mr.error||cr.error||fr.error){console.error(mr.error||cr.error||fr.error);toast('Errore nel caricamento soci');return}
 const cycle=Array.isArray(cr.data)?cr.data[0]:cr.data;
 ACTIVE_YEAR=Number(cycle?.active_year)||new Date().getFullYear();
 yearStart=cycle?.year_start||`${ACTIVE_YEAR}-09-01`;
 expiryDate=cycle?.expiry_date||`${ACTIVE_YEAR+1}-08-31`;
 members=mr.data||[];
 fees=(fr.data||[]).filter(f=>f.year===ACTIVE_YEAR);
 await syncRenewals();renderMembers();
}

function renderMembers(){
 $('memYearLabel').textContent=cycleLabel();$('feeYearTitle').textContent=cycleLabel();if($('renewalCycleLabel'))$('renewalCycleLabel').textContent=cycleLabel();if($('renewalExpiryDate'))$('renewalExpiryDate').textContent=fmtDate(expiryDate);
 $('memTotal').textContent=members.length;$('memActive').textContent=members.filter(m=>m.status==='active').length;$('memMissing').textContent=members.filter(m=>missingCount(m)>0).length;$('memRenew').textContent=members.filter(m=>effectiveFeeStatus(m)==='due').length;
 const q=$('memberSearch').value.toLowerCase().trim(),sf=$('memberStatusFilter').value,ff=$('memberFeeFilter').value,df=$('memberDataFilter').value;
 let rows=members.filter(m=>sf==='all'||m.status===sf).filter(m=>{const st=effectiveFeeStatus(m);return ff==='all'||st===ff}).filter(m=>df==='all'||(df==='incomplete'?missingCount(m)>0:missingCount(m)===0));
 if(q)rows=rows.filter(m=>[m.first_name,m.last_name,m.tax_code,m.email,m.phone,String(m.member_number)].some(v=>(v||'').toLowerCase().includes(q)));
 rows.sort((a,b)=>a.member_number-b.member_number);
 $('membersRows').innerHTML=rows.length?rows.map(memberRow).join(''):'<tr><td colspan="9" class="empty">Nessun socio trovato.</td></tr>';
 $('membersCards').innerHTML=rows.length?rows.map(memberCard).join(''):'<div class="empty">Nessun socio trovato.</div>';
}
function memberRow(m){const f=feeFor(m.id),fs=effectiveFeeStatus(m),miss=missingCount(m);return `<tr><td><b>${m.member_number}</b></td><td class="member-name"><b>${esc(fullName(m))}</b>${miss?`<span class="missing-chip">${miss} dato${miss>1?'i':''} mancante${miss>1?'i':''}</span>`:''}</td><td>${esc(m.tax_code||'—')}</td><td>${esc(m.email||'—')}${m.phone?`<br><span class="muted">${esc(m.phone)}</span>`:''}</td><td>${fmtDate(m.join_date)}</td><td><span class="member-status member-status-${m.status}">${statusLabels[m.status]}</span></td><td><span class="fee-status fee-status-${fs}">${feeLabels[fs]}</span>${f?.payment_status==='paid'?`<br><span class="muted">${f.paid_at?fmtDate(f.paid_at):''}</span>`:''}</td><td>${m.signature_received?'✓':'—'}</td><td><div class="member-actions"><button class="icon-btn" onclick="openMember('${m.id}')">✎</button></div></td></tr>`}
function memberCard(m){const f=feeFor(m.id),fs=effectiveFeeStatus(m);return `<article class="member-card" onclick="openMember('${m.id}')"><div class="member-card-top"><div><h4>#${m.member_number} · ${esc(fullName(m))}</h4><p>${esc(m.email||'Nessuna email')}<br>${esc(m.tax_code||'Codice fiscale mancante')}</p></div><button class="icon-btn">✎</button></div><div class="member-card-meta"><span class="member-status member-status-${m.status}">${statusLabels[m.status]}</span><span class="fee-status fee-status-${fs}">${feeLabels[fs]}</span></div></article>`}

function clearForm(){editMemberId=null;$('memberForm').reset();$('memberDlgTitle').textContent='Nuovo socio';$('mJoin').value=new Date().toISOString().slice(0,10);$('mStatus').value='active';$('mSignature').value='false';$('mfAmount').value='15';$('mfStatus').value='unknown';$('memberDeleteBtn').style.display='none'}
window.openMember=id=>{const m=members.find(x=>x.id===id);if(!m)return;editMemberId=id;const f=feeFor(id);$('memberDlgTitle').textContent=`Socio #${m.member_number}`;$('mFirst').value=m.first_name;$('mLast').value=m.last_name;$('mNumber').value=m.member_number;$('mJoin').value=m.join_date;$('mTax').value=m.tax_code||'';$('mEmail').value=m.email||'';$('mPhone').value=m.phone||'';$('mStatus').value=m.status;$('mSignature').value=String(m.signature_received);$('mNotes').value=m.notes||'';$('mfAmount').value=f?.amount??15;$('mfStatus').value=f?.payment_status||effectiveFeeStatus(m);$('mfPaidAt').value=f?.paid_at||'';$('mfMethod').value=f?.payment_method||'';$('mfReceipt').value=f?.receipt_number||'';$('mfNotes').value=f?.notes||'';$('memberDeleteBtn').style.display='inline-flex';$('memberDlg').showModal()};

async function saveMember(ev){ev.preventDefault();const row={first_name:$('mFirst').value.trim(),last_name:$('mLast').value.trim(),join_date:$('mJoin').value,tax_code:$('mTax').value.trim().toUpperCase()||null,email:$('mEmail').value.trim()||null,phone:$('mPhone').value.trim()||null,status:$('mStatus').value,signature_received:$('mSignature').value==='true',notes:$('mNotes').value.trim()||null};if($('mNumber').value)row.member_number=Number($('mNumber').value);let memberId=editMemberId;if(editMemberId){const {error}=await db.from('members').update(row).eq('id',editMemberId);if(error)return toast(error.code==='23505'?'Numero socio o codice fiscale già presente.':error.message)}else{const {data,error}=await db.from('members').insert({...row,created_by:app.currentUser.id}).select('id').single();if(error)return toast(error.code==='23505'?'Numero socio o codice fiscale già presente.':error.message);memberId=data.id}
 const feeRow={member_id:memberId,year:ACTIVE_YEAR,amount:Number($('mfAmount').value)||0,payment_status:$('mfStatus').value,paid_at:$('mfPaidAt').value||null,payment_method:$('mfMethod').value.trim()||null,receipt_number:$('mfReceipt').value.trim()||null,notes:$('mfNotes').value.trim()||null,created_by:app.currentUser.id};const {error:fe}=await db.from('membership_years').upsert(feeRow,{onConflict:'member_id,year'});if(fe)return toast(fe.message);$('memberDlg').close();toast(editMemberId?'Socio aggiornato':'Socio aggiunto');await loadMembers()}
async function deleteMember(){if(!editMemberId)return;const m=members.find(x=>x.id===editMemberId);if(!confirm(`Eliminare definitivamente il socio #${m.member_number} ${fullName(m)} e il suo storico quote?`))return;const {error}=await db.from('members').delete().eq('id',editMemberId);if(error)return toast(error.message);$('memberDlg').close();toast('Socio eliminato');await loadMembers()}

async function deleteExpiredMembers(){const expired=members.filter(m=>m.status==='expired');if(!expired.length)return toast('Non ci sono soci scaduti da eliminare.');if(!confirm(`Stai per eliminare definitivamente ${expired.length} soci in stato Scaduto e tutto il loro storico quote. Continuare?`))return;const typed=prompt('Conferma definitiva: scrivi ELIMINA per procedere.');if(typed!=='ELIMINA')return toast('Eliminazione annullata');const {error}=await db.from('members').delete().eq('status','expired');if(error)return toast(error.message);toast(`${expired.length} soci scaduti eliminati`);await loadMembers()}

function csvEscape(v){return `"${String(v??'').replaceAll('"','""')}"`}
function exportCsv(){const rows=normalizedRows(),headers=Object.keys(rows[0]||{});const csv='\uFEFF'+[headers.map(csvEscape).join(';'),...rows.map(r=>headers.map(h=>csvEscape(r[h])).join(';'))].join('\n');download(`club42-registro-soci-${ACTIVE_YEAR}.csv`,csv,'text/csv;charset=utf-8')}
function loadScript(src,test){return new Promise((resolve,reject)=>{if(test())return resolve();const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
async function exportExcel(){try{await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',()=>!!window.XLSX);const rows=normalizedRows();const ws=XLSX.utils.json_to_sheet(rows);ws['!cols']=[{wch:8},{wch:18},{wch:22},{wch:20},{wch:30},{wch:16},{wch:16},{wch:14},{wch:16},{wch:12},{wch:12},{wch:16},{wch:16},{wch:20},{wch:18},{wch:30},{wch:24}];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,`Soci ${ACTIVE_YEAR}`);XLSX.writeFile(wb,`club42-registro-soci-${ACTIVE_YEAR}.xlsx`)}catch(e){console.error(e);toast('Errore esportazione Excel')}}
async function exportPdf(){try{await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',()=>!!window.jspdf);await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',()=>!!window.jspdf?.jsPDF?.API?.autoTable);const {jsPDF}=window.jspdf;const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});doc.setFontSize(16);doc.text(`Club42 - Registro soci ${cycleLabel()}`,14,14);doc.setFontSize(8);doc.text(`Scadenza annualità: ${fmtDate(expiryDate)} · Esportato il ${new Intl.DateTimeFormat('it-IT').format(new Date())} · ${members.length} soci`,14,20);doc.autoTable({startY:25,head:[['#','Nome','Cognome','Codice fiscale','Data iscrizione','Email','Stato','Rinnovo']],body:members.slice().sort((a,b)=>a.member_number-b.member_number).map(m=>{const f=feeFor(m.id);return[m.member_number,m.first_name,m.last_name,m.tax_code||'',fmtDate(m.join_date),m.email||'',statusLabels[m.status],feeLabels[effectiveFeeStatus(m)]]}),styles:{fontSize:7,cellPadding:2},headStyles:{fillColor:[33,98,119]},columnStyles:{0:{cellWidth:9},1:{cellWidth:25},2:{cellWidth:34},3:{cellWidth:34},4:{cellWidth:24},5:{cellWidth:61},6:{cellWidth:24},7:{cellWidth:26}}});doc.save(`club42-registro-soci-${ACTIVE_YEAR}.pdf`)}catch(e){console.error(e);toast('Errore esportazione PDF')}}

export function initMembers(){
 $('newMemberBtn').onclick=()=>{clearForm();$('memberDlg').showModal()};$('memberClose').onclick=()=>$('memberDlg').close();$('memberCancel').onclick=()=>$('memberDlg').close();$('memberForm').addEventListener('submit',saveMember);$('memberDeleteBtn').onclick=deleteMember;$('memberSearch').oninput=renderMembers;$('memberStatusFilter').onchange=renderMembers;$('memberFeeFilter').onchange=renderMembers;$('memberDataFilter').onchange=renderMembers;$('deleteExpiredMembers').onclick=deleteExpiredMembers;$('exportMembersCsv').onclick=exportCsv;$('exportMembersXlsx').onclick=exportExcel;$('exportMembersPdf').onclick=exportPdf;
}
