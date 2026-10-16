let deferredInstallPrompt = null;
let swRegistration = null;

function ensureHeadLinks(){
  if(!document.querySelector('link[rel="manifest"]')){
    const manifest=document.createElement('link');
    manifest.rel='manifest';
    manifest.href='manifest.webmanifest?v=20260917-1';
    document.head.appendChild(manifest);
  }
  if(!document.querySelector('link[rel="apple-touch-icon"]')){
    const icon=document.createElement('link');
    icon.rel='apple-touch-icon';
    icon.href='assets/IMG-20260914-WA0013.jpg';
    document.head.appendChild(icon);
  }
  if(!document.querySelector('meta[name="apple-mobile-web-app-capable"]')){
    const meta=document.createElement('meta');
    meta.name='apple-mobile-web-app-capable';
    meta.content='yes';
    document.head.appendChild(meta);
  }
  if(!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')){
    const meta=document.createElement('meta');
    meta.name='apple-mobile-web-app-status-bar-style';
    meta.content='default';
    document.head.appendChild(meta);
  }
}

export function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
}

export function isIos(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export async function getServiceWorkerRegistration(){
  if(swRegistration)return swRegistration;
  if(!('serviceWorker' in navigator))return null;
  try{
    swRegistration=await navigator.serviceWorker.ready;
    return swRegistration;
  }catch{return null}
}

export function canPromptInstall(){return !!deferredInstallPrompt}

export async function promptInstallPwa(){
  if(isStandalone())return {outcome:'installed'};
  if(!deferredInstallPrompt)return {outcome:'unavailable'};
  const prompt=deferredInstallPrompt;
  deferredInstallPrompt=null;
  await prompt.prompt();
  const choice=await prompt.userChoice;
  document.dispatchEvent(new CustomEvent('club42:pwa-install-state'));
  return choice;
}

function guestInstallHelpMessage(){
  if(isIos())return 'Su iPhone o iPad apri Club42 in Safari, tocca Condividi e scegli “Aggiungi alla schermata Home”.';
  return 'Apri il menu del browser e scegli “Installa app” oppure “Aggiungi alla schermata Home”.';
}

export function syncGuestInstallUi(){
  const card=document.getElementById('guestInstallPrompt');
  const button=document.getElementById('guestInstallBtn');
  const help=document.getElementById('guestInstallHelp');
  if(!card||!button)return;
  const installed=isStandalone();
  card.hidden=installed;
  if(installed)return;
  button.textContent=canPromptInstall()?'Installa Club42':isIos()?'Come installarla':'Installa Club42';
  if(help&&help.dataset.visible==='1'){
    help.textContent=guestInstallHelpMessage();
    help.hidden=false;
  }
}

export function initGuestInstall(){
  const button=document.getElementById('guestInstallBtn');
  const help=document.getElementById('guestInstallHelp');
  if(!button||button.dataset.bound==='1')return;
  button.dataset.bound='1';
  button.addEventListener('click',async()=>{
    if(isStandalone()){syncGuestInstallUi();return}
    if(canPromptInstall()){
      button.disabled=true;
      const result=await promptInstallPwa();
      button.disabled=false;
      if(result?.outcome==='accepted'||isStandalone()){
        if(help){help.hidden=true;help.dataset.visible='0'}
        syncGuestInstallUi();
        return;
      }
    }
    if(help){
      help.textContent=guestInstallHelpMessage();
      help.hidden=false;
      help.dataset.visible='1';
    }
    syncGuestInstallUi();
  });
  document.addEventListener('club42:pwa-install-state',syncGuestInstallUi);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncGuestInstallUi()});
  try{
    window.matchMedia('(display-mode: standalone)').addEventListener('change',syncGuestInstallUi);
  }catch{}
  syncGuestInstallUi();
}

export async function initPwa(){
  ensureHeadLinks();
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredInstallPrompt=event;
    document.dispatchEvent(new CustomEvent('club42:pwa-install-state'));
  });
  window.addEventListener('appinstalled',()=>{
    deferredInstallPrompt=null;
    document.dispatchEvent(new CustomEvent('club42:pwa-install-state'));
  });
  if(!('serviceWorker' in navigator))return null;
  try{
    swRegistration=await navigator.serviceWorker.register('./sw.js?v=20260918-freshassets1',{scope:'./'});
    await navigator.serviceWorker.ready;
    return swRegistration;
  }catch(error){
    console.error('Service worker Club42',error);
    return null;
  }
}
