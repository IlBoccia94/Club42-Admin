export function buildFeedbackUi(){
  if(!document.querySelector('link[href^="feedback.css"]')){
    const l=document.createElement('link');l.rel='stylesheet';l.href='feedback.css?v=20260918-workflow1';document.head.appendChild(l);
  }

  if(!document.querySelector('.nav-item[data-view="feedback"]')){
    const contacts=document.querySelector('.nav-item[data-view="contacts"]');
    const btn=document.createElement('button');
    btn.className='nav-item';btn.dataset.view='feedback';
    btn.innerHTML='<span class="nav-icon">✦</span>Feedback';
    if(contacts)contacts.insertAdjacentElement('afterend',btn);
    else document.querySelector('.sidebar .nav:last-of-type')?.appendChild(btn);
  }

  if(!document.getElementById('view-feedback')){
    const main=document.querySelector('main.content');
    const section=document.createElement('section');
    section.className='view';section.id='view-feedback';
    section.innerHTML=`<div class="feedback-page">
      <section class="card feedback-hero">
        <div>
          <div class="panel-kicker">Miglioriamo il gestionale</div>
          <h2>Feedback</h2>
          <p>Segnala bug, fix necessari o nuove funzionalità. Autore e data/ora vengono registrati automaticamente.</p>
        </div>
      </section>

      <section class="card feedback-form-card">
        <div class="feedback-section-head">
          <div><div class="panel-kicker">Nuova richiesta</div><h3>Invia una segnalazione</h3></div>
          <span id="feedbackCurrentUser" class="feedback-current-user"></span>
        </div>
        <form id="feedbackForm" class="feedback-form">
          <div class="field full">
            <label>Descrizione *</label>
            <textarea id="feedbackDescription" rows="6" maxlength="4000" required placeholder="Descrivi con chiarezza il bug, il fix richiesto o la nuova feature…"></textarea>
            <div class="feedback-help">Inserisci tutto ciò che serve per capire il problema o la richiesta.</div>
          </div>
          <div class="feedback-form-bottom">
            <div class="field feedback-priority-field">
              <label>Priorità *</label>
              <select id="feedbackPriority">
                <option value="low">Bassa</option>
                <option value="medium" selected>Media</option>
                <option value="high">Alta</option>
                <option value="critical">Critica</option>
              </select>
            </div>
            <button class="btn primary" id="feedbackSubmitBtn" type="submit">Invia richiesta</button>
          </div>
        </form>
      </section>

      <section class="card feedback-list-card">
        <div class="feedback-section-head feedback-open-head">
          <div><div class="panel-kicker">In lavorazione</div><h3>Da risolvere <span id="feedbackOpenCount" class="feedback-count">0</span></h3></div>
          <div class="feedback-list-tools">
            <select id="feedbackSort" aria-label="Ordina feedback da risolvere">
              <option value="date">Data · più recenti</option>
              <option value="priority">Priorità · alta → bassa</option>
            </select>
            <button class="btn soft" id="feedbackRefreshBtn" type="button">↻ Aggiorna</button>
          </div>
        </div>
        <div class="feedback-sort-note" id="feedbackSortNote">Ordinati per data di inserimento, dal più recente.</div>
        <div id="feedbackOpenList" class="feedback-list"><div class="feedback-empty">Caricamento richieste…</div></div>
      </section>

      <section class="card feedback-list-card feedback-resolved-card">
        <div class="feedback-section-head">
          <div><div class="panel-kicker">Archivio completati</div><h3>Feedback risolti <span id="feedbackResolvedCount" class="feedback-count">0</span></h3></div>
        </div>
        <div id="feedbackResolvedList" class="feedback-list"><div class="feedback-empty">Caricamento richieste…</div></div>
      </section>
    </div>`;
    main?.appendChild(section);
  }
}
