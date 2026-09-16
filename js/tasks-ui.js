export function buildTasksUi(){
  if(!document.querySelector('link[href="tasks.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='tasks.css';document.head.appendChild(l)}
  const nav=document.querySelector('.nav-item[data-view="tasks"]');if(nav){const b=nav.querySelector('.nav-badge');if(b)b.remove()}
  const view=document.getElementById('view-tasks');if(view)view.innerHTML=`<div class="tasks-shell">
    <section class="card tasks-hero"><div class="tasks-hero-inner"><div><div class="hero-eyebrow">Club42 · Control room</div><h2>Task</h2><p>Priorità chiare, responsabilità visibili e zero attività dimenticate. Tutti i task del Club, compresi quelli dei progetti, vivono qui.</p></div><button class="btn primary" id="newTaskBtn">＋ Nuovo task</button></div></section>

    <div class="tasks-summary">
      <button class="card task-kpi" data-task-kpi="open"><span>Aperti</span><b id="taskOpenKpi">0</b><small>da portare a termine</small></button>
      <button class="card task-kpi" data-task-kpi="today"><span>Oggi</span><b id="taskTodayKpi">0</b><small>scadenza odierna</small></button>
      <button class="card task-kpi" data-task-kpi="overdue"><span>In ritardo</span><b id="taskOverdueKpi">0</b><small>oltre la scadenza</small></button>
      <button class="card task-kpi" data-task-kpi="blocked"><span>Bloccati</span><b id="taskBlockedKpi">0</b><small>richiedono intervento</small></button>
    </div>

    <div class="tasks-tabs">
      <button class="tasks-tab active" data-ttab="focus">Focus</button>
      <button class="tasks-tab" data-ttab="kanban">Kanban</button>
      <button class="tasks-tab" data-ttab="analytics">Analytics</button>
      <button class="tasks-tab" data-ttab="archive">Archivio</button>
    </div>

    <section class="task-tab-panel active" id="task-panel-focus">
      <div class="task-focus-grid">
        <div class="card task-panel task-focus-primary"><div class="section-head"><div><h3>Adesso</h3><p>La coda operativa più importante</p></div><span class="task-live-dot">LIVE</span></div><div id="taskNowList" class="task-list"></div></div>
        <div class="card task-panel"><div class="section-head"><div><h3>Prossimi 7 giorni</h3><p>Scadenze in arrivo</p></div></div><div id="taskUpcomingList" class="task-list"></div></div>
      </div>
      <div class="task-focus-grid secondary">
        <div class="card task-panel"><div class="section-head"><div><h3>Bloccati</h3><p>Ostacoli da rimuovere</p></div></div><div id="taskBlockedList" class="task-list"></div></div>
        <div class="card task-panel"><div class="section-head"><div><h3>Senza scadenza</h3><p>Attività che rischiano di restare nel limbo</p></div></div><div id="taskNoDueList" class="task-list"></div></div>
      </div>
    </section>

    <section class="task-tab-panel" id="task-panel-kanban">
      <div class="task-kanban-toolbar"><div><b>Flusso operativo</b><span>Trascina su desktop o apri il task per cambiarne lo stato</span></div><select id="taskKanbanOwner"><option value="all">Tutti i responsabili</option></select></div>
      <div class="task-kanban-wrap"><div id="taskKanban" class="task-kanban"></div></div>
    </section>

    <section class="task-tab-panel" id="task-panel-analytics">
      <div class="task-analytics-grid">
        <div class="card task-chart-card"><div class="section-head"><div><h3>Distribuzione per stato</h3><p>Dove si concentra il lavoro</p></div></div><div id="taskStatusChart"></div></div>
        <div class="card task-chart-card"><div class="section-head"><div><h3>Carico per responsabile</h3><p>Task aperti assegnati</p></div></div><div id="taskOwnerChart"></div></div>
        <div class="card task-chart-card task-chart-wide"><div class="section-head"><div><h3>Scadenze · prossimi 14 giorni</h3><p>Picchi di attività in arrivo</p></div></div><div id="taskDeadlineChart"></div></div>
      </div>
    </section>

    <section class="task-tab-panel" id="task-panel-archive">
      <div class="card task-panel"><div class="task-toolbar">
        <input id="taskSearch" placeholder="🔎 Cerca task, note, progetto, responsabile…">
        <select id="taskStatusFilter"><option value="all">Tutti gli stati</option><option value="backlog">Backlog</option><option value="todo">Da fare</option><option value="doing">In corso</option><option value="blocked">Bloccato</option><option value="done">Fatto</option></select>
        <select id="taskPriorityFilter"><option value="all">Tutte le priorità</option><option value="urgent">Urgente</option><option value="high">Alta</option><option value="medium">Media</option><option value="low">Bassa</option></select>
        <select id="taskOwnerFilter"><option value="all">Tutti i responsabili</option></select>
        <select id="taskProjectFilter"><option value="all">Tutti i progetti</option></select>
      </div><div id="taskArchiveList" class="task-archive-list"></div></div>
    </section>
  </div>`;

  if(!document.getElementById('taskDlg'))document.body.insertAdjacentHTML('beforeend',`<dialog id="taskDlg" class="task-dialog"><form class="modal" id="taskForm"><div class="modal-head"><div><div class="task-modal-kicker">Attività operativa</div><h3 id="taskDlgTitle">Nuovo task</h3></div><button type="button" class="close" id="taskClose">×</button></div>
    <div class="form-grid">
      <div class="field full"><label>Titolo *</label><input id="taskTitle" required placeholder="Cosa deve essere fatto?"></div>
      <div class="field full"><label>Descrizione</label><textarea id="taskDescription" rows="2" placeholder="Contesto essenziale, risultato atteso…"></textarea></div>
      <div class="field"><label>Stato</label><select id="taskStatus"><option value="backlog">Backlog</option><option value="todo">Da fare</option><option value="doing">In corso</option><option value="blocked">Bloccato</option><option value="done">Fatto</option></select></div>
      <div class="field"><label>Priorità</label><select id="taskPriority"><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option><option value="low">Bassa</option></select></div>
      <div class="field"><label>Categoria</label><select id="taskCategory"><option value="general">Generale</option><option value="project">Progetto</option><option value="event">Evento</option><option value="admin">Amministrazione</option><option value="social">Social</option><option value="communication">Comunicazione</option><option value="finance">Finanze</option></select></div>
      <div class="field"><label>Responsabile</label><select id="taskOwner"><option value="">Nessuno</option></select></div>
      <div class="field"><label>Data inizio</label><input id="taskStart" type="date"></div>
      <div class="field"><label>Scadenza</label><input id="taskDue" type="date"></div>
      <div class="field"><label>Stima ore</label><input id="taskHours" type="number" min="0" step="0.5" placeholder="es. 2.5"></div>
      <div class="field"><label>Progetto collegato</label><select id="taskProject"><option value="">Nessuno</option></select></div>
      <div class="field"><label>Evento collegato</label><select id="taskEvent"><option value="">Nessuno</option></select></div>
      <div class="field"><label>Etichette</label><input id="taskLabels" placeholder="es. catering, urgente, grafica"></div>
      <div class="field full"><label>Note operative</label><textarea id="taskNotes" rows="4" placeholder="Dettagli, dipendenze, link, cosa manca…"></textarea></div>
    </div>
    <div class="modal-actions"><button type="button" class="btn danger" id="taskDeleteBtn" style="display:none;margin-right:auto">Elimina</button><button type="button" class="btn" id="taskCancel">Annulla</button><button class="btn primary">Salva task</button></div>
  </form></dialog>`)
}
