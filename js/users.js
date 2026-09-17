import {$,app,db,SUPABASE_URL,SUPABASE_KEY,esc,fmtDate,toast} from './core.js';
import {getProfile} from './auth.js';
import {roleLabel} from './permissions.js?v=20260917-newsletter2';
import {syncUserNewsletterControls,setUserNewsletterForm,resetInviteNewsletterForm,getUserNewsletterValue} from './newsletter.js?v=20260917-2';

async function adminApi(action,payload={}){
  const {data:{session}}=await db.auth.getSession();
  if(!session)throw new Error('Sessione scaduta');
  const r=await fetch(`${SUPABASE_URL}/functions/v1/manage-admin-users`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':SUPABASE_KEY},body:JSON.stringify({action,...payload})});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Errore gestione utenti');return data;
}

function ensureRoleOptions(){
  ['uRole','iRole'].forEach(id=>{
    const s=$(id);if(!s)return;
    const wanted=[['admin','Admin'],['treasurer','Tesoriere'],['staff','Staff'],['guest','Guest']];
    const current=s.value;
    s.innerHTML=wanted.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
    if(wanted.some(([v])=>v===current))s.value=current;
  });
}

function ensurePermissionGuide(){
  const head=document.querySelector('#view-users .users-head');
  const invite=$('inviteUserBtn');
  if(head&&invite&&!$('roleInfoBtn')){
    const wrap=document.createElement('div');wrap.className='users-head-actions';
    invite.parentNode.insertBefore(wrap,invite);wrap.appendChild(invite);
    const info=document.createElement('button');info.type='button';info.className='btn';info.id='roleInfoBtn';info.textContent='ⓘ Permessi ruoli';wrap.insertBefore(info,invite);
  }
  if(!$('roleInfoDlg'))document.body.insertAdjacentHTML('beforeend',`<dialog id="roleInfoDlg"><div class="modal"><div class="modal-head"><div><div class="panel-kicker">Accessi gestionale</div><h3>Visibilità dei ruoli</h3></div><button type="button" class="close" id="roleInfoClose">×</button></div><div class="role-info-grid">
    <article class="role-info-card"><h4>Admin</h4><p><strong>Accesso completo.</strong> Gestisce Eventi, Soci, Cassa, Progetti, Task, Social, Contatti, Newsletter e Utenti.</p></article>
    <article class="role-info-card"><h4>Tesoriere</h4><p>Ha i permessi operativi dello Staff più la gestione completa della Cassa. Non vede Utenti né Newsletter.</p></article>
    <article class="role-info-card"><h4>Staff</h4><p>Gestisce i moduli operativi del Club, con Cassa in sola lettura. Non vede Utenti né Newsletter.</p></article>
    <article class="role-info-card"><h4>Guest</h4><p><strong>Accesso esclusivo all’Area soci.</strong> Non vede i moduli gestionali.</p></article>
  </div><div class="role-info-note">La sezione <strong>Newsletter</strong> e la gestione dei consensi sono disponibili esclusivamente agli Admin.</div><div class="modal-actions"><button type="button" class="btn primary" id="roleInfoOk">Ho capito</button></div></div></dialog>`);
}

export async function loadUsers(){try{const data=await adminApi('list');app.adminUsers=data.users||[];renderUsers()}catch(e){toast(e.message)}}
function statusLabel(s){return s==='active'?'Attivo':s==='disabled'?'Disabilitato':'In attesa'}
function newsletterBadge(u){return u.role==='guest'&&u.newsletter_active?'<span class="newsletter-user-badge">Newsletter</span>':''}
function userActions(u){const self=u.user_id===app.currentUser?.id;const approve=u.status==='pending'?`<button class="btn success" onclick="quickUserStatus('${u.user_id}','active')">Approva</button>`:'';const toggle=u.status==='active'&&!self?`<button class="btn" onclick="quickUserStatus('${u.user_id}','disabled')">Disabilita</button>`:u.status==='disabled'?`<button class="btn success" onclick="quickUserStatus('${u.user_id}','active')">Riattiva</button>`:'';const del=!self?`<button class="btn danger" onclick="deleteAdminUser('${u.user_id}')">Elimina</button>`:'';return `<div class="user-actions">${approve}<button class="btn" onclick="openUser('${u.user_id}')">Modifica</button>${toggle}${del}</div>`}
function renderUsers(){$('usersActive').textContent=app.adminUsers.filter(u=>u.status==='active').length;$('usersPending').textContent=app.adminUsers.filter(u=>u.status==='pending').length;$('usersDisabled').textContent=app.adminUsers.filter(u=>u.status==='disabled').length;const rows=app.adminUsers.map(u=>`<tr><td><b>${esc(u.display_name||'Senza nome')}</b>${newsletterBadge(u)}<br><span class="muted">${esc(u.email||'')}</span></td><td><span class="role-pill">${esc(roleLabel(u.role))}</span></td><td><span class="status-pill status-${u.status}">${statusLabel(u.status)}</span></td><td>${fmtDate((u.created_at||'').slice(0,10))}</td><td>${userActions(u)}</td></tr>`).join('');$('usersTableBody').innerHTML=rows||'<tr><td colspan="5" class="empty">Nessun utente.</td></tr>';$('usersCards').innerHTML=app.adminUsers.map(u=>`<div class="user-card"><h4>${esc(u.display_name||'Senza nome')} ${newsletterBadge(u)}</h4><div class="email">${esc(u.email||'')}</div><div class="meta"><span class="role-pill">${esc(roleLabel(u.role))}</span><span class="status-pill status-${u.status}">${statusLabel(u.status)}</span></div>${userActions(u)}</div>`).join('')||'<div class="empty">Nessun utente.</div>'}
function openUser(id){const u=app.adminUsers.find(x=>x.user_id===id);if(!u)return;ensureRoleOptions();app.editUserId=id;$('uName').value=u.display_name||'';$('uEmail').value=u.email||'';$('uRole').value=u.role;$('uStatus').value=u.status;setUserNewsletterForm(u);$('userDlg').showModal()}
async function quickUserStatus(id,status){const u=app.adminUsers.find(x=>x.user_id===id);if(!u)return;try{await adminApi('update',{userId:id,displayName:u.display_name,role:u.role,status,newsletterActive:!!u.newsletter_active});toast(status==='active'?'Utente attivato':'Utente disabilitato');await loadUsers()}catch(e){toast(e.message)}}
async function deleteAdminUser(id){const u=app.adminUsers.find(x=>x.user_id===id);if(!u||!confirm(`Eliminare definitivamente l'account di ${u.display_name||u.email}?`))return;try{await adminApi('delete',{userId:id});toast('Utente eliminato');await loadUsers()}catch(e){toast(e.message)}}

export function initUsers(){
  ensureRoleOptions();ensurePermissionGuide();syncUserNewsletterControls();
  window.openUser=openUser;window.quickUserStatus=quickUserStatus;window.deleteAdminUser=deleteAdminUser;
  $('roleInfoBtn').onclick=()=>$('roleInfoDlg').showModal();$('roleInfoClose').onclick=()=>$('roleInfoDlg').close();$('roleInfoOk').onclick=()=>$('roleInfoDlg').close();
  $('userForm').addEventListener('submit',async e=>{e.preventDefault();try{await adminApi('update',{userId:app.editUserId,displayName:$('uName').value.trim(),role:$('uRole').value,status:$('uStatus').value,newsletterActive:getUserNewsletterValue('edit')});$('userDlg').close();toast('Utente aggiornato');await loadUsers();if(app.editUserId===app.currentUser.id){app.currentProfile=await getProfile(app.currentUser);$('sidebarUserName').textContent=app.currentProfile.display_name;$('sidebarUserRole').textContent=roleLabel(app.currentProfile.role)}}catch(err){toast(err.message)}});
  $('inviteUserBtn').onclick=()=>{ensureRoleOptions();$('iName').value='';$('iEmail').value='';$('iRole').value='staff';resetInviteNewsletterForm('staff');$('inviteDlg').showModal()};
  $('inviteForm').addEventListener('submit',async e=>{e.preventDefault();try{await adminApi('invite',{displayName:$('iName').value.trim(),email:$('iEmail').value.trim(),role:$('iRole').value,newsletterActive:getUserNewsletterValue('invite')});$('inviteDlg').close();toast('Invito inviato');await loadUsers()}catch(err){toast(err.message)}});
  $('passwordForm').addEventListener('submit',async e=>{e.preventDefault();const a=$('newPassword').value,b=$('newPassword2').value;if(a!==b)return toast('Le password non coincidono');const {error}=await db.auth.updateUser({password:a});if(error)return toast(error.message);history.replaceState(null,'',location.pathname+'#dashboard');$('passwordDlg').close();toast('Password impostata')});
}
