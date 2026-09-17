export function buildNewsletterUi(){
  if(!document.querySelector('link[href^="newsletter.css"]')){
    const l=document.createElement('link');l.rel='stylesheet';l.href='newsletter.css?v=20260918-recipients1';document.head.appendChild(l);
  }

  if(!document.querySelector('.nav-item[data-view="newsletter"]')){
    const social=document.querySelector('.nav-item[data-view="social"]');
    const btn=document.createElement('button');
    btn.className='nav-item';btn.dataset.view='newsletter';
    btn.innerHTML='<span class="nav-icon">✉</span>Newsletter';
    if(social)social.insertAdjacentElement('afterend',btn);
    else document.querySelector('.sidebar .nav:last-of-type')?.appendChild(btn);
  }

  if(!document.getElementById('view-newsletter')){
    const main=document.querySelector('main.content');
    const section=document.createElement('section');
    section.className='view';section.id='view-newsletter';
    section.innerHTML=`<div class="newsletter-page">
      <section class="card newsletter-hero">
        <div><div class="panel-kicker">Comunicazioni Club42</div><h2>Newsletter</h2><p>Invia comunicazioni individuali a tutti gli utenti attivi che hanno espresso il consenso alla newsletter.</p></div>
        <div class="newsletter-sender"><span>Mittente</span><strong>Club42 &lt;club42.laspezia@gmail.com&gt;</strong></div>
      </section>

      <div class="newsletter-grid">
        <section class="card newsletter-panel recipients-panel">
          <div class="newsletter-panel-head"><div><div class="panel-kicker">Destinatari</div><h3>Utenti iscritti alla newsletter</h3></div><span class="newsletter-count" id="newsletterSelectedCount">0 selezionati</span></div>
          <div class="newsletter-recipient-tools"><input id="newsletterSearch" type="search" placeholder="🔎 Cerca nome, email o ruolo…"><div class="newsletter-selection-presets"><button class="btn soft" id="newsletterSelectAll" type="button">Seleziona tutti</button><button class="btn soft" id="newsletterSelectGuests" type="button">Solo Guest</button></div></div>
          <div class="newsletter-recipient-list" id="newsletterRecipients"><div class="newsletter-loading">Caricamento destinatari…</div></div>
          <div class="newsletter-recipient-note">Sono selezionabili tutti gli utenti attivi con <strong>Newsletter attiva</strong>. Usa <strong>Solo Guest</strong> per escludere rapidamente Staff, Tesoriere e Admin.</div>
        </section>

        <section class="card newsletter-panel composer-panel">
          <div class="newsletter-panel-head"><div><div class="panel-kicker">Componi</div><h3>Nuova newsletter</h3></div></div>
          <div class="field newsletter-subject"><label>Oggetto *</label><input id="newsletterSubject" maxlength="200" placeholder="Oggetto della newsletter"></div>
          <div class="field full"><label>Corpo della mail *</label>
            <div class="newsletter-editor-wrap">
              <div class="newsletter-toolbar" id="newsletterToolbar">
                <button type="button" data-command="bold" title="Grassetto"><b>B</b></button>
                <button type="button" data-command="italic" title="Corsivo"><i>I</i></button>
                <button type="button" data-command="insertUnorderedList" title="Elenco puntato">• Lista</button>
                <button type="button" data-command="insertOrderedList" title="Elenco numerato">1. Lista</button>
                <button type="button" data-heading="h2" title="Titolo">H2</button>
                <button type="button" id="newsletterLinkBtn" title="Inserisci link">🔗 Link</button>
              </div>
              <div id="newsletterEditor" class="newsletter-editor" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Scrivi qui il contenuto della newsletter…"></div>
            </div>
          </div>

          <div class="newsletter-attachments">
            <div class="newsletter-attachments-head"><div><strong>Allegati</strong><span>PDF, JPG, PNG, DOC, DOCX · max 6 MB per file, 8 MB totali</span></div><label class="btn soft newsletter-file-btn">＋ Aggiungi allegato<input id="newsletterAttachmentInput" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label></div>
            <div id="newsletterAttachmentsList" class="newsletter-attachment-list"><div class="newsletter-no-attachments">Nessun allegato.</div></div>
          </div>

          <div class="newsletter-send-status" id="newsletterSendStatus" hidden></div>
          <div class="newsletter-actions"><button class="btn" id="newsletterTestBtn" type="button">Invia email di test</button><button class="btn primary" id="newsletterSendBtn" type="button">Invia newsletter</button></div>
        </section>
      </div>

      <section class="card newsletter-history-panel">
        <div class="newsletter-panel-head"><div><div class="panel-kicker">Storico</div><h3>Newsletter inviate</h3></div><button class="btn soft" id="newsletterRefreshHistory" type="button">↻ Aggiorna</button></div>
        <div id="newsletterHistory" class="newsletter-history"><div class="newsletter-loading">Caricamento storico…</div></div>
      </section>
    </div>`;
    main?.appendChild(section);
  }

  if(!document.getElementById('newsletterConfirmDlg')){
    document.body.insertAdjacentHTML('beforeend',`<dialog id="newsletterConfirmDlg"><div class="modal newsletter-confirm-modal"><div class="modal-head"><div><div class="panel-kicker">Conferma invio</div><h3>Inviare la newsletter?</h3></div><button type="button" class="close" id="newsletterConfirmClose">×</button></div><div id="newsletterConfirmSummary" class="newsletter-confirm-summary"></div><div class="modal-actions"><button type="button" class="btn" id="newsletterConfirmCancel">Annulla</button><button type="button" class="btn primary" id="newsletterConfirmSend">Invia newsletter</button></div></div></dialog>`);
  }

  if(!document.getElementById('newsletterDeleteDlg')){
    document.body.insertAdjacentHTML('beforeend',`<dialog id="newsletterDeleteDlg"><div class="modal newsletter-delete-modal"><div class="modal-head"><div><div class="panel-kicker">Storico newsletter</div><h3>Eliminare questa newsletter?</h3></div><button type="button" class="close" id="newsletterDeleteClose">×</button></div><div class="newsletter-delete-warning"><div class="newsletter-delete-warning-icon">!</div><div><strong>Questa operazione è definitiva.</strong><p>La voce verrà rimossa dallo storico insieme ai dettagli tecnici delle consegne. Le email già inviate ai destinatari non possono essere richiamate o cancellate.</p></div></div><div id="newsletterDeleteSummary" class="newsletter-confirm-summary"></div><div class="modal-actions"><button type="button" class="btn" id="newsletterDeleteCancel">Mantieni nello storico</button><button type="button" class="btn danger" id="newsletterDeleteConfirm">Elimina dallo storico</button></div></div></dialog>`);
  }
}
