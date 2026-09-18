export function buildSocialUi(){
  if(!document.querySelector('link[href^="social.css"]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='social.css?v=20260918-seriesactions1';document.head.appendChild(link);
  }
  const nav=document.querySelector('.nav-item[data-view="social"]');
  if(nav){const badge=nav.querySelector('.nav-badge');if(badge)badge.remove()}
  const view=document.getElementById('view-social');
  if(view){view.innerHTML=`
    <div class="social-shell">
      <section class="card social-hero"><div class="social-hero-inner"><div><div class="hero-eyebrow">Club42 · Media locale</div><h2>Calendario editoriale</h2><p>Pianifica, produci e misura contenuti che trasformano Club42 da semplice bacheca eventi a punto di riferimento locale per cultura, persone e socialità.</p></div><button class="btn primary" id="newSocialContentBtn">＋ Nuovo contenuto</button></div></section>
      <div class="social-summary"><div class="card"><span>Pianificati questo mese</span><b id="socialPlanned">0</b></div><div class="card"><span>Pubblicati questo mese</span><b id="socialPublished">0</b></div><div class="card"><span>Idee in banca</span><b id="socialIdeas">0</b></div><div class="card"><span>Pronti / programmati</span><b id="socialReady">0</b></div></div>
      <div class="social-tabs"><button class="social-tab active" data-social-tab="calendar">Calendario</button><button class="social-tab" data-social-tab="pipeline">Pipeline</button><button class="social-tab" data-social-tab="ideas">Idee & format</button><button class="social-tab" data-social-tab="analytics">Risultati</button></div>
      <section class="social-tab-panel active" id="social-tab-calendar"><div class="card social-calendar-card"><div class="social-toolbar"><div><div class="panel-kicker">Piano editoriale</div><h3 style="margin:3px 0 0;font-family:var(--font-subtitle);color:var(--blue)">Vista mensile</h3></div><div class="social-month-nav"><button class="icon-btn" id="socialPrevMonth">‹</button><b id="socialMonthLabel"></b><button class="icon-btn" id="socialNextMonth">›</button><button class="btn" id="socialToday">Oggi</button></div></div><div class="social-weekdays"><span>Lun</span><span>Mar</span><span>Mer</span><span>Gio</span><span>Ven</span><span>Sab</span><span>Dom</span></div><div class="social-calendar" id="socialCalendar"></div></div></section>
      <section class="social-tab-panel" id="social-tab-pipeline"><div class="card social-pipeline-card"><div class="social-pipeline-toolbar"><div><div class="panel-kicker">Produzione</div><h3>Pipeline contenuti</h3><p>Segui ogni contenuto dall'idea alla pubblicazione.</p></div><div class="social-pipeline-controls"><button class="icon-btn" id="socialPipelinePrev" type="button" aria-label="Scorri pipeline a sinistra">‹</button><button class="icon-btn" id="socialPipelineNext" type="button" aria-label="Scorri pipeline a destra">›</button></div></div><div class="social-pipeline-wrap" id="socialPipelineWrap"><div class="social-pipeline" id="socialPipeline"></div></div></div></section>
      <section class="social-tab-panel" id="social-tab-ideas"><div class="social-ideas-grid"><div class="card social-ideas-card"><div class="section-head"><div><h3>Banca idee</h3><p>Spunti non ancora calendarizzati</p></div><button class="btn" onclick="newSocialContent()">＋ Idea</button></div><div class="social-list" id="socialIdeasList"></div></div><div class="card social-ideas-card"><div class="section-head"><div><h3>Format ricorrenti</h3><p>Serie coerenti con la strategia Instagram Club42</p></div></div><div class="social-list" id="socialFormats"></div></div></div></section>
      <section class="social-tab-panel" id="social-tab-analytics"><div class="social-analytics-summary"><div class="card"><span>Visualizzazioni</span><b id="anaViews">0</b></div><div class="card"><span>Condivisioni</span><b id="anaShares">0</b></div><div class="card"><span>Salvataggi</span><b id="anaSaves">0</b></div><div class="card"><span>Nuovi follower</span><b id="anaFollowers">0</b></div><div class="card"><span>Prenotazioni</span><b id="anaBookings">0</b></div><div class="card"><span>Nuovi partecipanti</span><b id="anaAttendees">0</b></div></div><div class="card panel"><div class="section-head"><div><h3>Performance contenuti</h3><p>Non solo like: copertura non follower, condivisioni, retention e conversione reale</p></div></div><div class="table-wrap social-table"><table><thead><tr><th>Contenuto</th><th>Views</th><th>Reach non follower</th><th>Share</th><th>Save</th><th>Visite profilo</th><th>Follower</th><th>Completion</th><th>Prenotazioni</th><th></th></tr></thead><tbody id="socialAnalyticsRows"></tbody></table></div></div></section>
    </div>`}
  if(!document.getElementById('socialContentDlg')){
    document.body.insertAdjacentHTML('beforeend',`
    <dialog id="socialContentDlg" class="social-dialog-wide"><form class="modal" id="socialContentForm"><div class="modal-head"><h3 id="socialContentDlgTitle">Nuovo contenuto</h3><button type="button" class="close" data-social-close="socialContentDlg">×</button></div><div class="form-grid">
      <div class="field full"><label>Titolo / idea *</label><input id="scTitle" required placeholder="Es. A La Spezia non c'è niente da fare?"></div>
      <div class="field"><label>Piattaforma</label><select id="scPlatform"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="facebook">Facebook</option><option value="youtube">YouTube</option><option value="other">Altro</option></select></div>
      <div class="field"><label>Tipo</label><select id="scType"><option value="reel">Reel</option><option value="carousel">Carousel</option><option value="story">Stories</option><option value="post">Post</option><option value="live">Live</option><option value="other">Altro</option></select></div>
      <div class="field"><div class="field-label-row"><label>Obiettivo</label><button type="button" class="info-tip" aria-label="Spiegazione degli obiettivi">i</button><div class="info-popover"><b>Obiettivo = cosa vogliamo ottenere.</b><span><strong>Scoperta:</strong> raggiungere persone che non conoscono Club42.</span><span><strong>Community:</strong> aumentare relazione e interazioni con chi ci segue.</span><span><strong>Evento:</strong> dare attenzione a uno specifico appuntamento.</span><span><strong>Cultura:</strong> offrire valore culturale anche senza promuovere nulla.</span><span><strong>Conversione:</strong> ottenere un'azione concreta: prenotazione, iscrizione, tessera, click o DM.</span></div></div><select id="scObjective"><option value="discovery">Scoperta</option><option value="community">Community</option><option value="event">Evento</option><option value="culture">Cultura</option><option value="conversion">Conversione</option></select></div>
      <div class="field"><div class="field-label-row"><label>Pilastro</label><button type="button" class="info-tip" aria-label="Spiegazione dei pilastri">i</button><div class="info-popover"><b>Pilastro = su cosa si regge il racconto.</b><span><strong>Persone:</strong> volti, membri, ospiti e partecipanti.</span><span><strong>Storie:</strong> esperienze, racconti, backstage e trasformazioni.</span><span><strong>Format:</strong> serie ricorrenti e riconoscibili, come “42 secondi”.</span><span><strong>Località:</strong> La Spezia, territorio, luoghi e vita culturale locale.</span><span><strong>Conversione:</strong> contenuto costruito principalmente attorno all'azione finale.</span></div></div><select id="scPillar"><option value="people">Persone</option><option value="stories">Storie</option><option value="format">Format</option><option value="locality">Località</option><option value="conversion">Conversione</option></select></div>
      <div class="field"><label>Stato</label><select id="scStatus"><option value="idea">Idea</option><option value="planned">Pianificato</option><option value="production">In produzione</option><option value="review">Revisione</option><option value="ready">Pronto</option><option value="scheduled">Programmato</option><option value="published">Pubblicato</option><option value="archived">Archiviato</option></select></div>
      <div class="field"><label>Priorità</label><select id="scPriority"><option value="low">Bassa</option><option value="medium">Media</option><option value="high">Alta</option></select></div>
      <div class="field"><label>Data</label><input id="scDate" type="date"></div><div class="field"><label>Ora</label><input id="scTime" type="time"></div>
      <div class="field full social-recurrence-field">
        <label class="social-recurring-toggle"><input id="scRecurring" type="checkbox"> Contenuto ricorrente</label>
        <div id="scRecurrencePanel" class="social-recurrence-panel" hidden>
          <div class="social-recurrence-grid">
            <div class="field"><label>Ripeti</label><select id="scRecurrenceType"><option value="weekly">Ogni settimana</option><option value="daily">Ogni N giorni</option><option value="monthly_day">Ogni mese · giorno del mese</option><option value="monthly_weekday">Ogni mese · es. primo lunedì</option></select></div>
            <div class="field"><label>Intervallo</label><div class="social-recurrence-interval"><input id="scRecurrenceInterval" type="number" min="1" max="12" value="1"><span id="scRecurrenceUnit">settimana/e</span></div></div>
          </div>
          <div id="scRecurrenceWeekly" class="social-recurrence-section">
            <label>Giorni della settimana</label>
            <div class="social-weekday-picker">
              <label><input type="checkbox" data-recur-weekday value="1"><span>Lun</span></label>
              <label><input type="checkbox" data-recur-weekday value="2"><span>Mar</span></label>
              <label><input type="checkbox" data-recur-weekday value="3"><span>Mer</span></label>
              <label><input type="checkbox" data-recur-weekday value="4"><span>Gio</span></label>
              <label><input type="checkbox" data-recur-weekday value="5"><span>Ven</span></label>
              <label><input type="checkbox" data-recur-weekday value="6"><span>Sab</span></label>
              <label><input type="checkbox" data-recur-weekday value="0"><span>Dom</span></label>
            </div>
          </div>
          <div id="scRecurrenceMonthlyDay" class="social-recurrence-section" hidden>
            <div class="field"><label>Giorno del mese</label><input id="scRecurrenceMonthDay" type="number" min="1" max="31" value="1"></div>
            <div class="social-recurrence-help">Nei mesi che non hanno quel giorno (es. 31 febbraio), l'occorrenza viene saltata.</div>
          </div>
          <div id="scRecurrenceMonthlyWeekday" class="social-recurrence-section" hidden>
            <div class="social-recurrence-grid">
              <div class="field"><label>Posizione</label><select id="scRecurrenceNth"><option value="1">Primo</option><option value="2">Secondo</option><option value="3">Terzo</option><option value="4">Quarto</option><option value="last">Ultimo</option></select></div>
              <div class="field"><label>Giorno</label><select id="scRecurrenceWeekday"><option value="1">Lunedì</option><option value="2">Martedì</option><option value="3">Mercoledì</option><option value="4">Giovedì</option><option value="5">Venerdì</option><option value="6">Sabato</option><option value="0">Domenica</option></select></div>
            </div>
          </div>
          <div class="social-recurrence-grid">
            <div class="field"><label>Termina</label><select id="scRecurrenceEndMode"><option value="count">Dopo un numero di occorrenze</option><option value="until">A una data precisa</option></select></div>
            <div class="field" id="scRecurrenceCountField"><label>Numero occorrenze</label><input id="scRecurrenceCount" type="number" min="2" max="104" value="12"></div>
            <div class="field" id="scRecurrenceUntilField" hidden><label>Fino al</label><input id="scRecurrenceUntil" type="date"></div>
          </div>
          <div id="scRecurrencePreview" class="social-recurrence-preview"></div>
        </div>
        <div id="scRecurrenceExisting" class="social-recurrence-existing" hidden>↻ Questo contenuto appartiene a una serie ricorrente. Quando salvi o elimini potrai scegliere se agire solo su questo, da questo in poi oppure su tutta la serie.</div>
      </div>
      <div class="field"><label>Format</label><select id="scFormat"></select></div><div class="field"><label>Evento collegato</label><select id="scEvent"></select></div>
      <div class="field full"><label>Responsabile</label><select id="scAssigned"></select></div>
      <div class="field full"><label>Hook</label><textarea id="scHook" rows="2" placeholder="Il gancio dei primi secondi..."></textarea></div>
      <div class="field full"><label>Call to action</label><textarea id="scCta" rows="2" placeholder="Es. Mandalo all'amico che dice che a La Spezia non c'è niente da fare."></textarea></div>
      <div class="field full"><label>Caption / copy</label><textarea id="scCaption" rows="4"></textarea></div>
      <div class="field full"><label>Note di produzione / shot list</label><textarea id="scNotes" rows="4"></textarea></div>
      <div class="field"><label>Link asset / Canva / Drive</label><input id="scAsset" type="url" placeholder="https://..."></div><div class="field"><label>URL pubblicato</label><input id="scPublishedUrl" type="url" placeholder="https://instagram.com/..."></div>
      <div class="field full"><label>Checklist strategica prima della pubblicazione</label><div class="social-checklist">
       <label class="social-check"><input type="checkbox" id="check_hook">Hook forte nel primo secondo</label><label class="social-check"><input type="checkbox" id="check_clear">Tema subito comprensibile</label><label class="social-check"><input type="checkbox" id="check_human">Persona, storia o emozione</label><label class="social-check"><input type="checkbox" id="check_outsider">Comprensibile a un non follower</label><label class="social-check"><input type="checkbox" id="check_share">Motivo per essere condiviso</label><label class="social-check"><input type="checkbox" id="check_local">Rilevante localmente</label><label class="social-check"><input type="checkbox" id="check_cta">CTA sensata</label><label class="social-check"><input type="checkbox" id="check_identity">Rafforza identità Club42</label><label class="social-check"><input type="checkbox" id="check_desire">Fa desiderare partecipazione</label><label class="social-check"><input type="checkbox" id="check_repurpose">Riutilizzabile in altri tagli</label>
      </div></div>
    </div><div class="modal-actions"><button type="button" class="btn danger" id="socialDeleteBtn" style="display:none;margin-right:auto">Elimina</button><button type="button" class="btn" id="socialMetricsBtn" style="display:none">Metriche</button><button type="button" class="btn" data-social-close="socialContentDlg">Annulla</button><button class="btn primary">Salva</button></div></form></dialog>
    <dialog id="socialSeriesActionDlg" class="social-series-action-dialog">
      <div class="modal social-series-action-modal">
        <div class="modal-head">
          <div>
            <div class="social-series-kicker">↻ Serie ricorrente</div>
            <h3 id="socialSeriesActionTitle">Come vuoi procedere?</h3>
            <p id="socialSeriesActionText" class="social-series-action-text"></p>
          </div>
          <button type="button" class="close" id="socialSeriesActionClose" aria-label="Chiudi">×</button>
        </div>
        <div class="social-series-scope-list">
          <button type="button" class="social-series-scope" data-series-scope="single">
            <span class="social-series-scope-icon">1</span>
            <span><b>Solo questo contenuto</b><small>Modifica o elimina soltanto l'occorrenza che hai aperto.</small></span>
            <em id="socialSeriesSingleCount">1</em>
          </button>
          <button type="button" class="social-series-scope" data-series-scope="future">
            <span class="social-series-scope-icon">→</span>
            <span><b>Questo e tutti i successivi</b><small>Interviene da questa occorrenza in avanti, lasciando intatti i precedenti.</small></span>
            <em id="socialSeriesFutureCount">0</em>
          </button>
          <button type="button" class="social-series-scope" data-series-scope="all">
            <span class="social-series-scope-icon">↻</span>
            <span><b>Tutta la serie</b><small>Interviene su tutte le occorrenze della stessa serie.</small></span>
            <em id="socialSeriesAllCount">0</em>
          </button>
        </div>
        <div id="socialSeriesDateNote" class="social-series-date-note" hidden>📅 Nelle modifiche multiple ogni occorrenza mantiene la propria data. Un'eventuale nuova data inserita nel form viene applicata solo al contenuto che hai aperto.</div>
        <div class="modal-actions"><button type="button" class="btn" id="socialSeriesActionCancel">Annulla</button></div>
      </div>
    </dialog>
    <dialog id="socialMetricsDlg" class="social-dialog-wide"><form class="modal" id="socialMetricsForm"><div class="modal-head"><div><h3>Risultati</h3><div class="muted" id="metricsContentTitle"></div></div><button type="button" class="close" data-social-close="socialMetricsDlg">×</button></div><div class="metrics-grid"><div class="metrics-section-title">Distribuzione e interazioni</div>
      <div class="field"><label>Visualizzazioni</label><input id="sm_views" type="number" min="0"></div><div class="field"><label>Reach</label><input id="sm_reach" type="number" min="0"></div><div class="field"><label>Reach non follower</label><input id="sm_non_follower_reach" type="number" min="0"></div><div class="field"><label>Like</label><input id="sm_likes" type="number" min="0"></div><div class="field"><label>Commenti</label><input id="sm_comments" type="number" min="0"></div><div class="field"><label>Condivisioni</label><input id="sm_shares" type="number" min="0"></div><div class="field"><label>Salvataggi</label><input id="sm_saves" type="number" min="0"></div><div class="field"><label>Visite profilo</label><input id="sm_profile_visits" type="number" min="0"></div><div class="field"><label>Follower generati</label><input id="sm_followers_gained" type="number" min="0"></div>
      <div class="metrics-section-title">Retention Reel</div><div class="field"><label>Watch time medio (sec)</label><input id="sm_avg_watch_time_seconds" type="number" min="0" step="0.01"></div><div class="field"><label>Completion rate %</label><input id="sm_completion_rate" type="number" min="0" max="100" step="0.01"></div><div></div>
      <div class="metrics-section-title">Conversione reale</div><div class="field"><label>Click link</label><input id="sm_link_clicks" type="number" min="0"></div><div class="field"><label>DM / richieste info</label><input id="sm_dm_inquiries" type="number" min="0"></div><div class="field"><label>Prenotazioni</label><input id="sm_bookings" type="number" min="0"></div><div class="field"><label>Partecipanti alla prima volta</label><input id="sm_first_time_attendees" type="number" min="0"></div>
    </div><div class="modal-actions"><button type="button" class="btn" data-social-close="socialMetricsDlg">Annulla</button><button class="btn primary">Salva metriche</button></div></form></dialog>`)
  }
  document.querySelectorAll('[data-social-close]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.socialClose).close())
}
