export function buildNotificationsUi(){
  if(!document.querySelector('link[href^="notifications.css"]')){
    const l=document.createElement('link');
    l.rel='stylesheet';
    l.href='notifications.css?v=20260917-1';
    document.head.appendChild(l);
  }

  if(!document.querySelector('.nav-item[data-view="notifications"]')){
    const cash=document.querySelector('.nav-item[data-view="cash"]');
    const btn=document.createElement('button');
    btn.className='nav-item';
    btn.dataset.view='notifications';
    btn.innerHTML='<span class="nav-icon">♢</span>Notifiche';
    cash?.insertAdjacentElement('afterend',btn);
  }

  if(!document.getElementById('view-notifications')){
    const section=document.createElement('section');
    section.className='view';
    section.id='view-notifications';
    section.innerHTML=`<div class="notif-shell">
      <section class="card notif-hero">
        <div class="notif-hero-copy">
          <div class="hero-eyebrow">Club42 · PWA & Web Push</div>
          <h2>Notifiche</h2>
          <p>Ricevi gli avvisi importanti anche quando Club42 Admin non è aperto. Ogni dispositivo va autorizzato una sola volta.</p>
        </div>
        <div class="notif-device-card">
          <span class="notif-device-kicker">Questo dispositivo</span>
          <strong id="notifPushStatus">Verifica in corso…</strong>
          <small id="notifPushHint">Controllo supporto e permessi.</small>
          <div class="notif-device-actions">
            <button class="btn primary" id="notifEnablePush">Attiva notifiche</button>
            <button class="btn" id="notifTestPush">Prova notifica</button>
            <button class="btn danger" id="notifDisablePush">Disattiva</button>
          </div>
        </div>
      </section>

      <div class="notif-grid">
        <section class="card notif-panel">
          <div class="section-head notif-section-head">
            <div><div class="panel-kicker">Preferenze</div><h3>Cosa vuoi ricevere</h3><p>Le modifiche vengono salvate sul tuo profilo e valgono su tutti i tuoi dispositivi.</p></div>
          </div>
          <div class="notif-pref-list">
            ${prefRow('tasks','✓','Task','Assegnazioni, blocchi e scadenze')}
            ${prefRow('events','🐋','Eventi','Capienza, promemoria e apertura iscrizioni')}
            ${prefRow('social','◎','Social','Contenuti da pubblicare')}
            ${prefRow('cash','€','Cassa','Nuovi movimenti rilevanti')}
            ${prefRow('members','♙','Soci','Rinnovi da gestire')}
            ${prefRow('projects','◇','Progetti','Prossime azioni')}
            ${prefRow('users','⚙','Utenti','Nuovi account da approvare','notif-admin-only')}
          </div>
        </section>

        <section class="card notif-panel notif-install-panel">
          <div class="panel-kicker">Installazione</div>
          <h3>Club42 come app</h3>
          <p id="notifInstallText">Puoi installare il gestionale nella schermata Home e aprirlo senza barra del browser.</p>
          <div class="notif-app-preview"><img src="assets/IMG-20260914-WA0013.jpg" alt="Icona Club42"><div><strong>Club42 Admin</strong><span>PWA installabile</span></div></div>
          <button class="btn primary" id="notifInstallPwa">Installa Club42 Admin</button>
          <div class="notif-install-note" id="notifInstallNote"></div>
        </section>
      </div>

      <section class="card notif-info-strip">
        <div><strong>Come funzionano le push?</strong><span>Gli avvisi immediati vengono elaborati circa ogni minuto; quelli programmati alle 09:00 usano sempre il fuso Europe/Rome. Tra questi c’è anche 🐋 il promemoria 7 giorni prima per gli eventi Guest ancora in “Prossimamente”. Il browser li consegna tramite il service worker anche a pagina chiusa. Risparmio energetico o “Non disturbare” possono comunque ritardarne la visualizzazione sul dispositivo.</span></div>
        <button class="btn" id="notifAllInfo">ⓘ Quando vengono inviate?</button>
      </section>
    </div>`;
    document.querySelector('main.content')?.appendChild(section);
  }

  if(!document.getElementById('notifInfoDlg')){
    document.body.insertAdjacentHTML('beforeend',`<dialog id="notifInfoDlg" class="notif-dialog"><div class="modal"><div class="modal-head"><div><div class="panel-kicker">Notifiche Club42</div><h3 id="notifInfoTitle">Quando viene inviata</h3></div><button type="button" class="close" id="notifInfoClose">×</button></div><div id="notifInfoBody" class="notif-info-body"></div><div class="modal-actions"><button type="button" class="btn primary" id="notifInfoOk">Chiudi</button></div></div></dialog>`);
  }
}

function prefRow(key,icon,title,subtitle,extra=''){
  return `<article class="notif-pref-row ${extra}" data-notif-category="${key}"><span class="notif-pref-icon">${icon}</span><div class="notif-pref-copy"><b>${title}</b><span>${subtitle}</span></div><button class="icon-btn notif-info-btn" type="button" data-notif-info="${key}" aria-label="Informazioni ${title}">i</button><label class="notif-switch"><input type="checkbox" id="notifPref-${key}" data-notif-pref="${key}" checked><span></span></label></article>`;
}
