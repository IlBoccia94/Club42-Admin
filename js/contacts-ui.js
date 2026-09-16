export function buildContactsUi(){
  if(!document.querySelector('link[href="contacts.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='contacts.css';document.head.appendChild(l)}
  const nav=document.querySelector('.nav-item[data-view="contacts"]');if(nav){const b=nav.querySelector('.nav-badge');if(b)b.remove()}
  const view=document.getElementById('view-contacts');if(view)view.innerHTML=`<div class="contacts-shell">
    <section class="card contacts-hero"><div class="contacts-hero-inner"><div><div class="hero-eyebrow">Club42 · Relazioni</div><h2>Contatti</h2><p>La memoria delle persone e realtà con cui Club42 costruisce cose: artisti, associazioni, fornitori, location, sponsor, professionisti e partner.</p></div><button class="btn primary" id="newContactBtn">＋ Nuovo contatto</button></div></section>

    <div class="contacts-summary">
      <button class="card contact-kpi" data-contact-kpi="active"><span>Attivi</span><b id="contactsActive">0</b><small>rapporti in rubrica</small></button>
      <button class="card contact-kpi" data-contact-kpi="favorite"><span>Preferiti</span><b id="contactsFavorite">0</b><small>contatti strategici</small></button>
      <button class="card contact-kpi" data-contact-kpi="collaborations"><span>Collaborazioni</span><b id="contactsCollaborations">0</b><small>storico complessivo</small></button>
      <button class="card contact-kpi" data-contact-kpi="returning"><span>Ricorrenti</span><b id="contactsReturning">0</b><small>2+ collaborazioni</small></button>
    </div>

    <div class="contacts-tabs"><button class="contacts-tab active" data-ctab="directory">Rubrica</button><button class="contacts-tab" data-ctab="history">Storico collaborazioni</button></div>

    <section class="contact-tab-panel active" id="contact-panel-directory">
      <div class="card contact-panel"><div class="contacts-toolbar">
        <input id="contactSearch" placeholder="🔎 Cerca nome, organizzazione, email, tag…">
        <select id="contactTypeFilter"><option value="all">Tutte le tipologie</option><option value="person">Persona</option><option value="artist">Artista</option><option value="association">Associazione</option><option value="supplier">Fornitore</option><option value="venue">Location</option><option value="speaker">Relatore / ospite</option><option value="sponsor">Sponsor</option><option value="media">Media</option><option value="professional">Professionista</option></select>
        <select id="contactStatusFilter"><option value="active">Attivi</option><option value="all">Tutti</option><option value="inactive">Archiviati</option><option value="favorite">Preferiti</option></select>
      </div><div id="contactsGrid" class="contacts-grid"></div></div>
    </section>

    <section class="contact-tab-panel" id="contact-panel-history">
      <div class="card contact-panel"><div class="section-head"><div><h3>Timeline collaborazioni</h3><p>Eventi, progetti e collaborazioni registrate nel tempo</p></div><button class="btn" id="newCollaborationBtn">＋ Collaborazione</button></div><div id="collaborationsTimeline" class="collaboration-timeline"></div></div>
    </section>
  </div>`;

  if(!document.getElementById('contactDlg'))document.body.insertAdjacentHTML('beforeend',`<dialog id="contactDlg" class="contact-dialog"><form class="modal" id="contactForm"><div class="modal-head"><div><div class="contact-modal-kicker">Scheda relazione</div><h3 id="contactDlgTitle">Nuovo contatto</h3></div><button type="button" class="close" id="contactClose">×</button></div><div class="contact-dialog-grid"><div class="contact-main-form"><div class="form-grid">
    <div class="field full"><label>Nome / referente *</label><input id="cName" required></div>
    <div class="field full"><label>Organizzazione / realtà</label><input id="cOrganization" placeholder="Es. ZeroMeno, Astrofili Spezzini…"></div>
    <div class="field"><label>Tipologia</label><select id="cType"><option value="person">Persona</option><option value="artist">Artista</option><option value="association">Associazione</option><option value="supplier">Fornitore</option><option value="venue">Location</option><option value="speaker">Relatore / ospite</option><option value="sponsor">Sponsor</option><option value="media">Media</option><option value="professional">Professionista</option></select></div>
    <div class="field"><label>Stato</label><select id="cActive"><option value="true">Attivo</option><option value="false">Archiviato</option></select></div>
    <div class="field"><label>Email</label><input id="cEmail" type="email"></div><div class="field"><label>Telefono</label><input id="cPhone"></div>
    <div class="field"><label>Instagram</label><input id="cInstagram" placeholder="@profilo"></div><div class="field"><label>Sito web</label><input id="cWebsite" placeholder="https://…"></div>
    <div class="field"><label>Città</label><input id="cCity"></div><div class="field"><label>Indirizzo</label><input id="cAddress"></div>
    <div class="field full"><label>Tag</label><input id="cTags" placeholder="es. catering, cinema, musica, fotografia"></div>
    <div class="field full"><label>Note</label><textarea id="cNotes" rows="4" placeholder="Preferenze, condizioni, dettagli del rapporto, cose da ricordare…"></textarea></div>
    <div class="field full contact-favorite-field"><label><input id="cFavorite" type="checkbox"> Contatto strategico / preferito</label></div>
  </div></div><aside class="contact-history-side"><div class="contact-history-head"><div><b>Storico collaborazioni</b><span id="contactHistoryCount">0 collaborazioni</span></div><button type="button" class="icon-btn" id="addContactCollaboration">＋</button></div><div id="contactHistoryList" class="contact-history-list"></div></aside></div><div class="modal-actions"><button type="button" class="btn danger" id="contactDeleteBtn" style="display:none;margin-right:auto">Elimina</button><button type="button" class="btn" id="contactCancel">Annulla</button><button class="btn primary">Salva contatto</button></div></form></dialog>`);

  if(!document.getElementById('collaborationDlg'))document.body.insertAdjacentHTML('beforeend',`<dialog id="collaborationDlg"><form class="modal" id="collaborationForm"><div class="modal-head"><div><div class="contact-modal-kicker">Storico relazione</div><h3 id="collaborationDlgTitle">Nuova collaborazione</h3></div><button type="button" class="close" id="collaborationClose">×</button></div><div class="form-grid">
    <div class="field full"><label>Contatto *</label><select id="ccContact" required><option value="">Seleziona…</option></select></div>
    <div class="field full"><label>Titolo / occasione *</label><input id="ccTitle" required placeholder="Es. Catering Club42 × Astrofili"></div>
    <div class="field"><label>Data</label><input id="ccDate" type="date"></div><div class="field"><label>Ruolo</label><input id="ccRole" placeholder="Es. catering, relatore, artista…"></div>
    <div class="field"><label>Evento collegato</label><select id="ccEvent"><option value="">Nessuno</option></select></div><div class="field"><label>Progetto collegato</label><select id="ccProject"><option value="">Nessuno</option></select></div>
    <div class="field full"><label>Note</label><textarea id="ccNotes" rows="4" placeholder="Com'è andata, accordi, feedback, dettagli utili per la prossima volta…"></textarea></div>
  </div><div class="modal-actions"><button type="button" class="btn danger" id="collaborationDeleteBtn" style="display:none;margin-right:auto">Elimina</button><button type="button" class="btn" id="collaborationCancel">Annulla</button><button class="btn primary">Salva collaborazione</button></div></form></dialog>`);
}
