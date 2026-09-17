import {$,app,db,APP_URL} from './core.js';
import {applyRoleUi,roleLabel} from './permissions.js';

export async function getProfile(user){
  const {data,error}=await db.from('admin_users').select('user_id,email,display_name,role,active,status').eq('user_id',user.id).maybeSingle();
  if(error)throw error;
  return data;
}

export function showAuth(msg=''){
  $('authScreen').classList.remove('hidden');
  $('authFormWrap').style.display='block';
  $('authPending').classList.remove('show');
  $('authError').textContent=msg;
  $('authError').classList.toggle('show',!!msg);
}

export async function handleSession(user,onAuthorized){
  app.currentUser=user;
  try{
    app.currentProfile=await getProfile(user);
  }catch(error){
    console.error('Errore caricamento profilo Club42',error);
    app.currentProfile=null;
    showAuth('Errore nel caricamento del profilo. Ricarica la pagina o riprova tra poco.');
    return false;
  }
  const ok=app.currentProfile?.active===true&&app.currentProfile?.status==='active';
  if(!ok){
    $('authFormWrap').style.display='none';
    $('authPending').classList.add('show');
    $('pendingEmail').textContent=user.email||user.id;
    $('pendingTitle').textContent=app.currentProfile?.status==='disabled'?'Account disabilitato':'Account in attesa';
    $('pendingText').textContent=app.currentProfile?.status==='disabled'?'Questo account è stato disabilitato da un amministratore.':'La richiesta esiste ma deve essere approvata da un utente autorizzato.';
    $('authScreen').classList.remove('hidden');
    return false;
  }
  if(app.currentProfile.role==='guest'){
    $('authFormWrap').style.display='none';
    $('authPending').classList.add('show');
    $('pendingEmail').textContent=user.email||user.id;
    $('pendingTitle').textContent='Profilo Guest';
    $('pendingText').textContent='Questo profilo non ha accesso ai moduli gestionali Club42. Un Admin può assegnarti un ruolo operativo quando necessario.';
    $('authScreen').classList.remove('hidden');
    return false;
  }
  $('authScreen').classList.add('hidden');
  $('authPending').classList.remove('show');
  $('authFormWrap').style.display='block';
  $('sidebarUserName').textContent=app.currentProfile.display_name||user.email||'Utente';
  $('sidebarUserEmail').textContent=app.currentProfile.email||user.email||'';
  $('sidebarUserRole').textContent=roleLabel(app.currentProfile.role);
  applyRoleUi();
  if(onAuthorized)await onAuthorized();
  return true;
}

export async function bootstrapAuth(onAuthorized){
  const {data:{session}}=await db.auth.getSession();
  if(session?.user)await handleSession(session.user,onAuthorized);else showAuth();
}

export function initAuth(onAuthorized){
  $('authForm').addEventListener('submit',async ev=>{
    ev.preventDefault();
    $('authError').classList.remove('show');
    const {data,error}=await db.auth.signInWithPassword({email:$('authEmail').value.trim(),password:$('authPassword').value});
    if(error)return showAuth(error.message);
    await handleSession(data.user,onAuthorized);
  });

  $('signupBtn').onclick=async()=>{
    const email=$('authEmail').value.trim(),password=$('authPassword').value;
    if(!email||password.length<6)return showAuth('Inserisci email e una password di almeno 6 caratteri.');
    const {error}=await db.auth.signUp({email,password,options:{emailRedirectTo:APP_URL,data:{display_name:email.split('@')[0]}}});
    if(error)return showAuth(error.message);
    $('authFormWrap').style.display='none';
    $('authPending').classList.add('show');
    $('pendingTitle').textContent='Conferma l’email';
    $('pendingText').textContent='Apri la mail ricevuta. Dopo la conferma la tua richiesta resterà in attesa di approvazione.';
    $('pendingEmail').textContent=email;
  };

  const logout=async()=>{
    await db.auth.signOut();
    app.currentUser=null;app.currentProfile=null;
    app.state={events:[],people:[],selected:null};
    delete document.body.dataset.club42Role;
    showAuth();
  };
  $('logoutBtn').onclick=logout;$('pendingLogout').onclick=logout;
  db.auth.onAuthStateChange((_event,session)=>{
    if(session?.user&&session.user.id!==app.currentUser?.id)setTimeout(()=>handleSession(session.user,onAuthorized),0);
  });
}
