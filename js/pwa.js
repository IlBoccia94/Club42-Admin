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
    swRegistration=await navigator.serviceWorker.register('./sw.js?v=20260917-2',{scope:'./'});
    await navigator.serviceWorker.ready;
    return swRegistration;
  }catch(error){
    console.error('Service worker Club42',error);
    return null;
  }
}
