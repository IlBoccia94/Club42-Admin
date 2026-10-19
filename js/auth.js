import {$,app,db,APP_URL,initialAuthCallback,toast} from './core.js';
import {applyRoleUi,roleLabel} from './permissions.js?v=20260917-newsletter2';

let authMode='login';
let passwordMode=null;
let bootstrapping=true;
let recoverySessionUserId=null;
const RECOVERY_SENT_MESSAGE='Se esiste un account associato a questa email, riceverai un link per reimpostare la password.';

function cleanCallbackUrl(){
  const view=app.currentProfile?.role==='guest'?'guest':'dashboard';
  history.replaceState(null,'',location.pathname+'#'+view);
  initialAuthCallback.type=null;
  initialAuthCallback.accessToken=null;
  initialAuthCallback.error=null;
}

function callbackPasswordMode(session){
  if(!session?.user||initialAuthCallback.error)return null;
  if(recoverySessionUserId===session.user.id)return 'recovery';
  // A stale/invalid recovery link must not use a previously logged-in session.
  if(initialAuthCallback.accessToken&&initialAuthCallback.accessToken===session.access_token){
    return initialAuthCallback.type;
  }
  return null;
}

function setPasswordError(message=''){
  const error=$('passwordError');
  error.textContent=message;
  error.classList.toggle('show',!!message);
}

function openPasswordDialog(mode){
  if(!['recovery','invite','change'].includes(mode))return;
  const dialog=$('passwordDlg');
  if(dialog.open&&passwordMode===mode)return;
  passwordMode=mode;
  $('passwordForm').reset();
  setPasswordError();
  $('passwordDlgTitle').textContent=mode==='change'?'Cambia password':mode==='recovery'?'Reimposta password':'Imposta password';
  $('passwordDlgText').textContent=mode==='invite'
    ?'Hai aperto un invito Club42. Scegli la password del tuo account.'
    :mode==='recovery'
      ?'Scegli una nuova password per il tuo account Club42.'
      :'Scegli una nuova password per il tuo account. Devi inserirla due volte.';
  $('passwordCancelBtn').textContent=mode==='change'?'Annulla':"Torna all'accesso";
  if(mode!=='change'){
    $('authScreen').classList.remove('hidden');
    $('authFormWrap').style.display='none';
    $('authPending').classList.remove('show');
  }
  if(!dialog.open)dialog.showModal();
  $('newPassword').focus();
}


function ensureSignupControls(){
  if($('authSignupConsent'))return;
  const actions=document.querySelector('#authForm .auth-actions');
  const emailField=$('authEmail')?.closest('.field');
  if(!actions||!emailField)return;
  emailField.insertAdjacentHTML('beforebegin',`<div class="auth-signup-name" id="authSignupName" hidden>
    <div class="field"><label>Nome</label><input id="authFirstName" type="text" autocomplete="given-name" maxlength="80"></div>
    <div class="field"><label>Cognome</label><input id="authLastName" type="text" autocomplete="family-name" maxlength="80"></div>
  </div>`);
  actions.insertAdjacentHTML('beforebegin',`<div class="auth-signup-consent" id="authSignupConsent" hidden>
    <label class="auth-newsletter-check"><input id="authNewsletterActive" type="checkbox" checked><span>Newsletter attiva</span></label>
    <p>Accetto di ricevere comunicazioni e newsletter di Club42. Puoi togliere la spunta se non vuoi riceverle.</p>
  </div>`);
}

function setAuthMode(mode='login',resetConsent=false){
  ensureSignupControls();
  authMode=mode==='signup'?'signup':mode==='forgot'?'forgot':'login';
  const signup=authMode==='signup';
  const forgot=authMode==='forgot';
  const consent=$('authSignupConsent');
  const nameFields=$('authSignupName');
  const firstName=$('authFirstName');
  const lastName=$('authLastName');
  const checkbox=$('authNewsletterActive');
  const submit=document.querySelector('#authForm button[type="submit"]');
  const toggle=$('signupBtn');
  const note=document.querySelector('#authFormWrap .auth-note');
  $('authForm').hidden=forgot;
  $('forgotPasswordForm').hidden=!forgot;
  $('forgotPasswordBtn').hidden=signup;
  if(consent)consent.hidden=!signup;
  if(nameFields)nameFields.hidden=!signup;
  if(firstName)firstName.required=signup;
  if(lastName)lastName.required=signup;
  if(signup&&resetConsent&&checkbox)checkbox.checked=true;
  if(submit)submit.textContent=signup?'Crea account':'Accedi';
  if(toggle)toggle.textContent=signup?'← Ho già un account':'Crea account';
  if($('authPassword'))$('authPassword').autocomplete=signup?'new-password':'current-password';
  if(note){
    note.hidden=forgot;
    note.textContent=signup
      ?'Inserisci nome e cognome: verranno usati come nome utente nell’app. Il nuovo account sarà creato come Guest e, dopo la conferma email, resterà in attesa di approvazione.'
      :'Puoi creare un account liberamente, ma l’accesso ai dati richiede l’approvazione del direttivo.';
  }
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
  try{
    const {data:{session},error}=await db.auth.getSession();
    if(error)throw error;
    const mode=callbackPasswordMode(session);
    // Do not load authorized modules until the invitation/recovery flow finishes.
    if(mode){
      showAuth();
      openPasswordDialog(mode);
    }else if(initialAuthCallback.error||initialAuthCallback.type){
      cleanCallbackUrl();
      if(session?.user){
        await handleSession(session.user,onAuthorized);
        toast('Il link di accesso non è valido o è scaduto. Richiedine uno nuovo.');
      }else{
        showAuth('Il link è scaduto o non valido. Richiedi un nuovo link di recupero.');
      }
    }else if(session?.user){
      await handleSession(session.user,onAuthorized);
    }else{
      showAuth();
    }
  }catch(error){
    console.error('Errore inizializzazione autenticazione',error);
    showAuth('Non è stato possibile verificare la sessione. Riprova ad accedere.');
  }finally{
    bootstrapping=false;
    initialAuthCallback.accessToken=null;
  }
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
      const firstName=($('authFirstName')?.value||'').trim().replace(/\s+/g,' ');
      const lastName=($('authLastName')?.value||'').trim().replace(/\s+/g,' ');
      if(!firstName||!lastName)return showAuth('Inserisci nome e cognome.','signup');
      if(!email||password.length<6)return showAuth('Inserisci email e una password di almeno 6 caratteri.','signup');
      const displayName=`${firstName} ${lastName}`;
      const newsletterActive=$('authNewsletterActive')?.checked===true;
      const {error}=await db.auth.signUp({
        email,
        password,
        options:{
          emailRedirectTo:APP_URL,
          data:{
            first_name:firstName,
            last_name:lastName,
            display_name:displayName,
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

  $('forgotPasswordBtn').onclick=()=>{
    showAuthError();
    $('forgotPasswordEmail').value=$('authEmail').value.trim();
    $('forgotPasswordMessage').hidden=true;
    setAuthMode('forgot');
    $('forgotPasswordEmail').focus();
  };
  $('backToLoginBtn').onclick=()=>{
    showAuthError();
    $('authEmail').value=$('forgotPasswordEmail').value.trim();
    setAuthMode('login');
  };
  $('forgotPasswordForm').addEventListener('submit',async ev=>{
    ev.preventDefault();
    showAuthError();
    const email=$('forgotPasswordEmail').value.trim();
    const button=$('sendRecoveryBtn');
    button.disabled=true;
    try{
      const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:APP_URL});
      if(error)throw error;
      $('forgotPasswordMessage').textContent=RECOVERY_SENT_MESSAGE;
      $('forgotPasswordMessage').hidden=false;
    }catch(error){
      console.error('Errore invio recupero password',error);
      showAuthError('Non è stato possibile inviare la richiesta. Riprova più tardi.');
    }finally{
      button.disabled=false;
    }
  });

  $('changePasswordBtn').onclick=()=>{if(app.currentUser)openPasswordDialog('change')};
  const guestLogout=$('guestLogoutBtn');
  if(guestLogout&&!$('guestChangePasswordBtn')){
    const actions=document.createElement('div');
    actions.className='guest-account-actions';
    guestLogout.parentNode.insertBefore(actions,guestLogout);
    actions.appendChild(guestLogout);
    const change=document.createElement('button');
    change.id='guestChangePasswordBtn';
    change.type='button';
    change.className='guest-logout';
    change.textContent='Cambia password';
    actions.insertBefore(change,guestLogout);
    change.onclick=()=>{if(app.currentUser)openPasswordDialog('change')};
  }

  $('passwordDlg').addEventListener('cancel',ev=>{
    if(passwordMode!=='change')ev.preventDefault();
    else passwordMode=null;
  });
  $('passwordCancelBtn').onclick=async()=>{
    const mode=passwordMode;
    passwordMode=null;
    $('passwordDlg').close();
    if(mode!=='change'){
      cleanCallbackUrl();
      await db.auth.signOut();
      app.currentUser=null;
      app.currentProfile=null;
      delete document.body.dataset.club42Role;
      showAuth();
    }
  };
  $('passwordForm').addEventListener('submit',async ev=>{
    ev.preventDefault();
    const password=$('newPassword').value;
    const confirmation=$('newPassword2').value;
    if(password.length<8)return setPasswordError('La password deve contenere almeno 8 caratteri.');
    if(password!==confirmation)return setPasswordError('Le password non coincidono.');
    setPasswordError();
    const button=$('passwordSaveBtn');
    button.disabled=true;
    try{
      const {data:{user},error:sessionError}=await db.auth.getUser();
      if(sessionError||!user)throw new Error('Sessione scaduta. Richiedi un nuovo link o accedi di nuovo.');
      if(recoverySessionUserId&&passwordMode==='recovery'&&user.id!==recoverySessionUserId){
        throw new Error('La sessione di recupero non corrisponde al link. Richiedine uno nuovo.');
      }
      const {data,error}=await db.auth.updateUser({password});
      if(error)throw error;
      const completedMode=passwordMode;
      passwordMode=null;
      $('passwordForm').reset();
      $('passwordDlg').close();
      if(completedMode!=='change'){
        cleanCallbackUrl();
        await handleSession(data.user||user,onAuthorized);
      }
      toast(completedMode==='recovery'
        ?'🐋 Password aggiornata! Ora puoi accedere con la nuova password.'
        :completedMode==='invite'?'🐋 Password impostata!':'🐋 Password aggiornata!');
    }catch(error){
      setPasswordError(error.message||'Non è stato possibile aggiornare la password.');
    }finally{
      button.disabled=false;
    }
  });

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
  db.auth.onAuthStateChange((event,session)=>{
    if(event==='PASSWORD_RECOVERY'&&session?.user){
      recoverySessionUserId=session.user.id;
      if(!bootstrapping)setTimeout(()=>openPasswordDialog('recovery'),0);
      return;
    }
    if(!bootstrapping&&!passwordMode&&session?.user&&session.user.id!==app.currentUser?.id){
      setTimeout(()=>handleSession(session.user,onAuthorized),0);
    }
  });
}
