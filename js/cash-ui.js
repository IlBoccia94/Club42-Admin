export function buildCashUi(){
  if(!document.querySelector('link[href="cash.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='cash.css';document.head.appendChild(l)}
  const nav=document.querySelector('.nav-item[data-view="cash"]');if(nav){const b=nav.querySelector('.nav-badge');if(b)b.remove()}
  const view=document.getElementById('view-cash');if(view)view.innerHTML=`<div class="cash-shell">
    <section class="card cash-hero"><div class="cash-hero-inner"><div><div class="hero-eyebrow">Club42 · Tesoreria</div><h2>Cassa</h2><p>Entrate, uscite e rendiconto sempre aggiornati, con storico completo e backup esportabili.</p></div><div class="cash-hero-actions"><button class="btn" id="cashPdfBtn">PDF</button><button class="btn" id="cashCsvBtn">CSV</button><button class="btn" id="cashExcelBtn">Excel</button><button class="btn primary" id="newCashBtn">＋ Movimento</button></div></div></section>

    <div class="cash-summary">
      <div class="card cash-kpi income"><span>Entrate</span><b id="cashIncome">€ 0,00</b><small id="cashIncomeCount">0 movimenti</small></div>
      <div class="card cash-kpi expense"><span>Uscite</span><b id="cashExpense">€ 0,00</b><small id="cashExpenseCount">0 movimenti</small></div>
      <div class="card cash-kpi balance"><span>Saldo</span><b id="cashBalance">€ 0,00</b><small>entrate - uscite</small></div>
      <div class="card cash-kpi"><span>Movimenti</span><b id="cashMovements">0</b><small id="cashYearLabel">anno selezionato</small></div>
    </div>

    <div class="cash-insights">
      <section class="card cash-panel"><div class="section-head"><div><h3>Spese anticipate per consigliere</h3><p>Quanto ciascun consigliere ha anticipato personalmente</p></div></div><div id="cashCouncilors" class="cash-councilors"></div></section>
      <section class="card cash-panel"><div class="section-head"><div><h3>Flusso mensile</h3><p>Entrate e uscite dell'anno selezionato</p></div></div><div id="cashMonthlyChart" class="cash-monthly"></div></section>
    </div>

    <section class="card cash-panel cash-ledger-panel">
      <div class="section-head cash-ledger-head"><div><h3>Libro cassa</h3><p>Ogni riga è modificabile: aprila per aggiornare o integrare i dati.</p></div><div class="cash-source-note">Import iniziale: Rendicontazione 2026</div></div>
      <div class="cash-toolbar">
        <input id="cashSearch" placeholder="🔎 Cerca descrizione, soggetto, riferimento…">
        <select id="cashYearFilter"></select>
        <select id="cashTypeFilter"><option value="all">Entrate + uscite</option><option value="income">Solo entrate</option><option value="expense">Solo uscite</option></select>
        <select id="cashCategoryFilter"><option value="all">Tutte le categorie</option><option value="unclassified">Da classificare</option><option value="membership">Quote associative</option><option value="donation">Donazioni</option><option value="materials">Materiali</option><option value="services">Servizi</option><option value="event">Eventi</option><option value="reimbursement">Rimborsi</option><option value="other">Altro</option></select>
      </div>
      <div class="table-wrap cash-table-wrap"><table class="cash-table"><thead><tr><th>#</th><th>Data</th><th>Tipo</th><th>Descrizione</th><th>Da</th><th>A</th><th>Categoria</th><th class="num">Importo</th><th></th></tr></thead><tbody id="cashTableBody"></tbody></table></div>
      <div class="cash-mobile-list" id="cashMobileList"></div>
      <div class="foot">☁️ Libro cassa sincronizzato nel database Club42.</div>
    </section>
  </div>`;

  if(!document.getElementById('cashDlg'))document.body.insertAdjacentHTML('beforeend',`<dialog id="cashDlg" class="cash-dialog"><form class="modal" id="cashForm"><div class="modal-head"><div><div class="cash-modal-kicker">Movimento di cassa</div><h3 id="cashDlgTitle">Nuovo movimento</h3></div><button type="button" class="close" id="cashClose">×</button></div>
    <div class="form-grid">
      <div class="field"><label>Data *</label><input id="cashDate" type="date" required></div>
      <div class="field"><label>Tipo *</label><select id="cashType"><option value="income">Entrata</option><option value="expense">Uscita</option></select></div>
      <div class="field"><label>Importo € *</label><input id="cashAmount" type="number" min="0" step="0.01" required></div>
      <div class="field"><label>Categoria</label><select id="cashCategory"><option value="unclassified">Da classificare</option><option value="membership">Quota associativa</option><option value="donation">Donazione</option><option value="materials">Materiali</option><option value="services">Servizi</option><option value="event">Evento</option><option value="reimbursement">Rimborso</option><option value="other">Altro</option></select></div>
      <div class="field full"><label>Descrizione *</label><textarea id="cashDescription" rows="2" required></textarea></div>
      <div class="field"><label>Da</label><input id="cashFrom" placeholder="Chi paga / da chi arriva"></div>
      <div class="field"><label>A</label><input id="cashTo" placeholder="Chi riceve / destinatario"></div>
      <div class="field"><label>Metodo di pagamento</label><input id="cashMethod" placeholder="Contanti, bonifico, carta…"></div>
      <div class="field"><label>Riferimento documento</label><input id="cashDocument" placeholder="Ricevuta, fattura, scontrino…"></div>
      <div class="field"><label>Evento collegato</label><select id="cashEvent"><option value="">Nessuno</option></select></div>
      <div class="field"><label>Contatto collegato</label><select id="cashContact"><option value="">Nessuno</option></select></div>
      <div class="field full"><label>Socio collegato</label><select id="cashMember"><option value="">Nessuno</option></select></div>
      <div class="field full"><label>Note</label><textarea id="cashNotes" rows="3"></textarea></div>
    </div>
    <div class="modal-actions"><button type="button" class="btn danger" id="cashDeleteBtn" style="display:none;margin-right:auto">Elimina</button><button type="button" class="btn" id="cashCancel">Annulla</button><button class="btn primary">Salva movimento</button></div>
  </form></dialog>`)
}
