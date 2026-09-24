export function buildDashboardUi(){
  if(!document.querySelector('link[href^="dashboard.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='dashboard.css?v=20260924-operational1';document.head.appendChild(l)}
  const view=document.getElementById('view-dashboard');
  if(!view)return;
  view.innerHTML=`<div class="dashboard-v3">
    <section class="card dashboard-command">
      <div class="dashboard-command-copy">
        <div class="hero-eyebrow">Club42 · Centro operativo</div>
        <h2>Che cosa richiede attenzione?</h2>
        <p id="dashCommandSummary">Sto leggendo lo stato del Club…</p>
        <div class="dashboard-command-date" id="dashCommandDate"></div>
      </div>
      <div class="dashboard-quick-actions">
        <button class="dash-quick primary" type="button" data-dashboard-create="event"><span>＋</span><b>Evento</b><small>Nuovo appuntamento</small></button>
        <button class="dash-quick" type="button" data-dashboard-create="task"><span>✓</span><b>Task</b><small>Nuova attività</small></button>
        <button class="dash-quick" type="button" data-dashboard-create="social"><span>◎</span><b>Social</b><small>Nuovo contenuto</small></button>
        <button class="dash-quick" type="button" data-dashboard-create="cash"><span>€</span><b>Cassa</b><small>Nuovo movimento</small></button>
      </div>
    </section>

    <div class="dashboard-primary-grid">
      <section class="card dashboard-block dashboard-attention">
        <div class="dashboard-block-head">
          <div><span class="dashboard-kicker coral">Adesso</span><h3>Priorità operative</h3><p>Elementi concreti ordinati per urgenza</p></div>
          <span class="dash-head-count" id="dashAttentionCount">0</span>
        </div>
        <div id="dashAttentionList" class="dash-attention-list"><div class="dash-loading">Caricamento…</div></div>
      </section>

      <section class="card dashboard-block dashboard-agenda">
        <div class="dashboard-block-head">
          <div><span class="dashboard-kicker">Agenda</span><h3>Prossimi 7 giorni</h3><p>Eventi, task e contenuti Social in un'unica sequenza</p></div>
        </div>
        <div id="dashWeekAgenda" class="dash-agenda-list"><div class="dash-loading">Caricamento…</div></div>
      </section>
    </div>

    <div class="dashboard-secondary-grid">
      <section class="card dashboard-block dashboard-my-work">
        <div class="dashboard-block-head"><div><span class="dashboard-kicker">Personale</span><h3>I miei task</h3><p>Le attività assegnate a te, ordinate per urgenza</p></div><button class="btn" data-dashboard-view="tasks">Apri task</button></div>
        <div id="dashMyTasks" class="dash-task-list"><div class="dash-loading">Caricamento…</div></div>
      </section>

      <section class="card dashboard-block dashboard-next">
        <div class="dashboard-block-head"><div><span class="dashboard-kicker">Evento</span><h3>Prossimo appuntamento</h3><p>Il primo evento attivo in calendario</p></div><button class="btn soft" data-dashboard-view="events">Apri eventi</button></div>
        <div id="nextEventBox"></div>
      </section>
    </div>

    <section class="card dashboard-block dashboard-pulse">
      <div class="dashboard-block-head"><div><span class="dashboard-kicker">Quadro generale</span><h3>Stato operativo del Club</h3><p>I numeri che servono per capire rapidamente dove siamo</p></div></div>
      <div id="dashPulse" class="dash-pulse-grid"><div class="dash-loading">Caricamento…</div></div>
    </section>

    <div class="dashboard-legacy" aria-hidden="true"><span id="dashEvents">0</span><span id="dashPeople">0</span><span id="dashPaid">0</span><span id="dashMembers">0</span><button id="heroNewEvent" type="button"></button><button id="quickEvent" type="button"></button><button id="quickPerson" type="button"></button></div>
  </div>`;
}
