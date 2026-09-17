export function buildDashboardUi(){
  if(!document.querySelector('link[href^="dashboard.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='dashboard.css?v=20260917-1';document.head.appendChild(l)}
  const view=document.getElementById('view-dashboard');
  if(!view)return;
  view.innerHTML=`<div class="dashboard-v2">
    <section class="card dashboard-hero"><div class="hero-content"><div class="hero-eyebrow">Club42 · Centro operativo</div><h2>Tutto il Club, in un solo posto.</h2><p>Una base unica per coordinare eventi, soci, cassa, progetti e comunicazione.</p><div class="hero-actions"><button class="btn primary" onclick="showView('events')">Gestisci eventi</button><button class="btn" id="heroNewEvent">＋ Crea evento</button></div></div></section>

    <div class="dashboard-primary-grid">
      <section class="card dashboard-block dashboard-next"><div class="dashboard-block-head"><div><span class="dashboard-kicker">Agenda</span><h3>Prossimo evento</h3><p>Il primo appuntamento futuro in calendario</p></div><button class="btn soft" onclick="showView('events')">Apri eventi</button></div><div id="nextEventBox"></div></section>
      <section class="card dashboard-block dashboard-attention"><div class="dashboard-block-head"><div><span class="dashboard-kicker coral">Priorità</span><h3>Da tenere d’occhio</h3><p>Solo ciò che richiede attenzione</p></div></div><div id="dashAttentionList" class="dash-attention-list"><div class="dash-loading">Caricamento…</div></div></section>
    </div>

    <div class="dashboard-secondary-grid">
      <section class="card dashboard-block dashboard-my-work"><div class="dashboard-block-head"><div><span class="dashboard-kicker">Operatività</span><h3>I miei task</h3><p>Le attività assegnate a te, ordinate per urgenza</p></div><button class="btn" onclick="showView('tasks')">Apri task</button></div><div id="dashMyTasks" class="dash-task-list"><div class="dash-loading">Caricamento…</div></div></section>
      <section class="card dashboard-block dashboard-pulse"><div class="dashboard-block-head"><div><span class="dashboard-kicker">Club42</span><h3>Stato operativo</h3><p>Una lettura rapida dei moduli principali</p></div></div><div id="dashPulse" class="dash-pulse-list"><div class="dash-loading">Caricamento…</div></div></section>
    </div>

    <div class="dashboard-legacy" aria-hidden="true"><span id="dashEvents">0</span><span id="dashPeople">0</span><span id="dashPaid">0</span><span id="dashMembers">0</span><button id="quickEvent" type="button"></button><button id="quickPerson" type="button"></button></div>
  </div>`;
}
