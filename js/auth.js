import {$,app,db,APP_URL} from './core.js';
import {applyRoleUi,roleLabel} from './permissions.js?v=20260917-newsletter2';

let authMode='login';

function ensureSignupControls(){
  if($('authSignupConsent'))return;
  const actions=document.querySelector('#authForm .auth-actions');
  if(!actions)return;
  actions.insertAdjacentHTML('beforebegin',`<div class="auth-signup-consent" id="authSignupConsent" hidden>
    <label class="auth-newsletter-check"><input id="authNewsletterActive" type="checkbox" checked><span>Newsletter attiva</span></label>
    <p>Accetto di ricevere comunicazioni e newsletter di Club42. Puoi togliere la spunta se non vuoi riceverle.</p>
  </div>`);
}

function setAuthMode(mode='login',resetConsent=false){
  ensureSignupControls();
  authMode=mode==='signup'?'signup':'login';
  const signup=authMode==='signup';
  const consent=$('authSignupConsent');
  const checkbox=$('authNewsletterActive');
  const submit=document.querySelector('#authForm button[type="submit"]');
  const toggle=$('signupBtn');
  const note=document.querySelector('#authFormWrap .auth-note');
  if(consent)consent.hidden=!signup;
  if(signup&&resetConsent&&checkbox)checkbox.checked=true;
  if(submit)submit.textContent=signup?'Crea account':'Accedi';
  if(toggle)toggle.textContent=signup?'← Ho già un account':'Crea account';
  if($('authPassword'))$('authPassword').autocomplete=signup?'new-password':'current-password';
  if(note)note.textContent=signup
    ?'Il nuovo account verrà creato come Guest. Dopo la conferma email resterà in attesa di approvazione.'
    :'Puoi creare un account liberamente, ma l’accesso ai dati richiede l’approvazione del direttivo.';
}

function showAuthError(msg=''){
  $('authError').textContent=msg;
  $('authError').classList.toggle('show',!!msg);
}

export async function getProfile(user){
  const {data,error}=await db.from('admin_users').select('user_id,email,display_name,role,active,status').eq('user_id',user.id).maybeSingle();
  if(error)throw error;
  return data;
}

export function showAuth(msg='',mode='login'){
  ensureSignupControls();
  setAuthMode(mode,false);
  $('authScreen').classList.remove('hidden');
  $('authFormWrap').style.display='block';
  $('authPending').classList.remove('show');
  showAuthError(msg);
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
  $('authScreen').classList.add('hidden');
  $('authPending').classList.remove('show');
  $('authFormWrap').style.display='block';
  setAuthMode('login',false);
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
  ensureSignupControls();
  setAuthMode('login',false);

  $('authForm').addEventListener('submit',async ev=>{
    ev.preventDefault();
    showAuthError('');
    const email=$('authEmail').value.trim();
    const password=$('authPassword').value;

    if(authMode==='signup'){
      if(!email||password.length<6)return showAuth('Inserisci email e una password di almeno 6 caratteri.','signup');
      const newsletterActive=$('authNewsletterActive')?.checked===true;
      const {error}=await db.auth.signUp({
        email,
        password,
        options:{
          emailRedirectTo:APP_URL,
          data:{
            display_name:email.split('@')[0],
            newsletter_active:newsletterActive
          }
        }
      });
      if(error)return showAuth(error.message,'signup');
      $('authFormWrap').style.display='none';
      $('authPending').classList.add('show');
      $('pendingTitle').textContent='Conferma l’email';
      $('pendingText').textContent='Apri la mail ricevuta. Dopo la conferma la tua richiesta resterà in attesa di approvazione.';
      $('pendingEmail').textContent=email;
      return;
    }

    const {data,error}=await db.auth.signInWithPassword({email,password});
    if(error)return showAuth(error.message,'login');
    await handleSession(data.user,onAuthorized);
  });

  $('signupBtn').onclick=()=>{
    showAuthError('');
    if(authMode==='login')setAuthMode('signup',true);
    else setAuthMode('login',false);
  };

  const logout=async()=>{
    await db.auth.signOut();
    app.currentUser=null;app.currentProfile=null;
    app.state={events:[],people:[],selected:null};
    delete document.body.dataset.club42Role;
    history.replaceState(null,'',location.pathname+'#dashboard');
    showAuth();
  };
  $('logoutBtn').onclick=logout;$('pendingLogout').onclick=logout;
  if($('guestLogoutBtn'))$('guestLogoutBtn').onclick=logout;
  db.auth.onAuthStateChange((_event,session)=>{
    if(session?.user&&session.user.id!==app.currentUser?.id)setTimeout(()=>handleSession(session.user,onAuthorized),0);
  });
}
