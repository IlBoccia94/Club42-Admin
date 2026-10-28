export function buildGuestUi(){
  if(!document.querySelector('link[href^="guest.css"]')){
    const l=document.createElement('link');l.rel='stylesheet';l.href='guest.css?v=20261028-weekday1';document.head.appendChild(l);
  }
  if(!document.querySelector('link[href^="guest-actions.css"]')){
    const l=document.createElement('link');l.rel='stylesheet';l.href='guest-actions.css?v=20260917-1';document.head.appendChild(l);
  }

  if(!document.querySelector('.nav-item[data-view="guest"]')){
    const contacts=document.querySelector('.nav-item[data-view="contacts"]');
    const btn=document.createElement('button');
    btn.className='nav-item';btn.dataset.view='guest';
    btn.innerHTML='<span class="nav-icon">☆</span>Pagina guest';
    if(contacts)contacts.insertAdjacentElement('afterend',btn);
    else document.querySelector('.sidebar .nav:last-of-type')?.appendChild(btn);
  }

  if(!document.getElementById('view-guest')){
    const main=document.querySelector('main.content');
    const section=document.createElement('section');
    section.className='view';section.id='view-guest';
    section.innerHTML=`<div class="guest-portal" id="guestPortal">
      <header class="guest-portal-head">
        <div class="guest-brand"><img src="assets/IMG-20260914-WA0014.jpg" alt="Club42"><div><strong>Club42</strong><span>Area soci</span></div></div>
        <button class="guest-logout" id="guestLogoutBtn" type="button">Esci</button>
      </header>

      <section class="guest-hero">
        <div class="guest-hero-copy">
          <span class="guest-eyebrow">CLUB42 · AREA SOCI</span>
          <h1>I prossimi appuntamenti.</h1>
          <p>Eventi, incontri e occasioni da vivere insieme. Qui trovi soltanto gli appuntamenti che il Club ha scelto di condividere con i soci.</p>
        </div>
        <div class="guest-hero-mark" aria-hidden="true"><span>42</span></div>
      </section>

      <section class="guest-push-prompt" id="guestPushPrompt" hidden>
        <div class="guest-push-icon" aria-hidden="true">🔔</div>
        <div class="guest-push-copy">
          <strong id="guestPushTitle">Non perderti le iscrizioni</strong>
          <span id="guestPushText">Attiva le notifiche per sapere quando apriamo le iscrizioni e ricevere un promemoria prima degli eventi.</span>
        </div>
        <button type="button" class="guest-push-btn" id="guestEnablePushBtn">Attiva notifiche</button>
      </section>

      <section class="guest-install-prompt" id="guestInstallPrompt" hidden>
        <div class="guest-install-icon" aria-hidden="true">📲</div>
        <div class="guest-install-copy">
          <strong>Porta Club42 sul telefono</strong>
          <span>Installa Club42 come una vera app: la trovi nella schermata Home e si apre senza passare dal browser.</span>
          <small id="guestInstallHelp" hidden></small>
        </div>
        <button type="button" class="guest-install-btn" id="guestInstallBtn">Installa Club42</button>
      </section>

      <div id="guestEventsRoot"><div class="guest-loading">Caricamento appuntamenti…</div></div>

      <footer class="guest-footer"><div><strong>Club42</strong><span>Associazione culturale · La Spezia</span></div><span>Ci vediamo al prossimo evento.</span></footer>
    </div>`;
    main?.appendChild(section);
  }
}
