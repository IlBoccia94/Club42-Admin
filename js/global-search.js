import {$,app,db,esc,fmtDate} from './core.js';

const GROUPS=[
  {type:'event',label:'Eventi',icon:'◫'},
  {type:'project',label:'Progetti',icon:'◇'},
  {type:'task',label:'Task',icon:'✓'},
  {type:'social',label:'Social',icon:'◎'},
  {type:'contact',label:'Contatti',icon:'☏'},
  {type:'member',label:'Soci',icon:'♙'},
  {type:'cash',label:'Cassa',icon:'€'}
];
let activeType='all',searchTimer=null,searchSeq=0,currentResults=[],activeIndex=-1;

function meta(type){return GROUPS.find(x=>x.type===type)||{type,label:type,icon:'•'}}
function normalize(value){return String(value||'').toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function safeTerm(value){return String(value||'').replace(/[,()%]/g,' ').replace(/\s+/g,' ').trim()}
function includesQuery(values,q){const needle=normalize(q);return values.some(v=>normalize(v).includes(needle))}
function money(v){return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v)||0)}
function dateLabel(v){return v?fmtDate(v):''}
function roleCanSearch(){return !!app.currentUser&&['admin','staff','treasurer'].includes(app.currentProfile?.role||'')}

function ensureUi(){
  if($('globalSearchDlg'))return;
  if(!document.querySelector('link[href^="global-search.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='global-search.css?v=20260924-search1';document.head.appendChild(l)}
  const actions=document.querySelector('.topbar-actions');
  const left=document.querySelector('.topbar-left');
  if(actions&&!$('globalSearchOpen')){
    const btn=document.createElement('button');btn.type='button';btn.id='globalSearchOpen';btn.className='global-search-open';btn.hidden=true;
    btn.innerHTML='<span>⌕</span><b>Cerca nel Club42…</b><kbd>Ctrl K</kbd>';btn.setAttribute('aria-label','Ricerca globale');
    actions.insertBefore(btn,actions.firstChild);
  }
  if(left&&!$('globalSearchOpenMobile')){
    const btn=document.createElement('button');btn.type='button';btn.id='globalSearchOpenMobile';btn.className='global-search-open-mobile';btn.hidden=true;btn.textContent='⌕';btn.setAttribute('aria-label','Ricerca globale');
    const menu=$('mobileMenu');if(menu?.nextSibling)left.insertBefore(btn,menu.nextSibling);else left.appendChild(btn);
  }
  document.body.insertAdjacentHTML('beforeend',`
    <dialog id="globalSearchDlg" class="global-search-dialog">
      <div class="global-search-shell">
        <div class="global-search-head">
          <div class="global-search-input-wrap"><span>⌕</span><input id="globalSearchInput" type="search" autocomplete="off" placeholder="Cerca eventi, progetti, task, social, contatti, soci, cassa…"></div>
          <button type="button" id="globalSearchClose" class="global-search-close" aria-label="Chiudi">×</button>
        </div>
        <div id="globalSearchFilters" class="global-search-filters"></div>
        <div id="globalSearchStatus" class="global-search-status">Scrivi qualcosa per cercare in tutto Club42.</div>
        <div id="globalSearchResults" class="global-search-results"></div>
        <div class="global-search-foot"><span>↑ ↓ per muoverti · Invio per aprire</span><span>Esc per chiudere</span></div>
      </div>
    </dialog>`);
  $('globalSearchOpen').onclick=open;
  $('globalSearchOpenMobile').onclick=open;
  $('globalSearchClose').onclick=close;
  $('globalSearchInput').oninput=()=>scheduleSearch();
  $('globalSearchInput').onkeydown=handleKeys;
  $('globalSearchDlg').addEventListener('click',ev=>{if(ev.target===$('globalSearchDlg'))close()});
  renderFilters([]);
}
function renderFilters(results){
  const counts=Object.fromEntries(GROUPS.map(g=>[g.type,results.filter(r=>r.type===g.type).length]));
  $('globalSearchFilters').innerHTML=[
    `<button type="button" class="${activeType==='all'?'active':''}" data-global-search-type="all">Tutti <b>${results.length||''}</b></button>`,
    ...GROUPS.map(g=>`<button type="button" class="${activeType===g.type?'active':''}" data-global-search-type="${g.type}">${g.icon} ${g.label} <b>${counts[g.type]||''}</b></button>`)
  ].join('');
  document.querySelectorAll('[data-global-search-type]').forEach(btn=>btn.onclick=()=>{
    activeType=btn.dataset.globalSearchType;activeIndex=-1;renderFilters(currentResults);renderResults(currentResults);
  });
}
function open(){
  if(!roleCanSearch())return;
  ensureUi();const dlg=$('globalSearchDlg');if(!dlg.open)dlg.showModal();
  setTimeout(()=>{$('globalSearchInput')?.focus();$('globalSearchInput')?.select()},30);
}
function close(){if($('globalSearchDlg')?.open)$('globalSearchDlg').close();activeIndex=-1}
function resetResults(){
  currentResults=[];activeIndex=-1;renderFilters([]);
  $('globalSearchStatus').textContent='Scrivi qualcosa per cercare in tutto Club42.';
  $('globalSearchResults').innerHTML='';
}
function scheduleSearch(){
  clearTimeout(searchTimer);const q=$('globalSearchInput').value.trim();
  if(!q){resetResults();return}
  $('globalSearchStatus').innerHTML='<span class="global-search-spinner"></span> Ricerca in corso…';
  searchTimer=setTimeout(()=>runSearch(q),180);
}

async function queryTable(table,select,orFilter,order=null){
  let q=db.from(table).select(select).or(orFilter).limit(8);
  if(order)q=q.order(order.column,{ascending:order.ascending??true});
  const {data,error}=await q;if(error){console.warn('Global search',table,error);return[]}
  return data||[];
}
async function searchMembers(q){
  const {data,error}=await db.rpc('club42_member_directory');
  if(error){console.warn('Global search members',error);return[]}
  return (data||[]).filter(m=>includesQuery([m.first_name,m.last_name,m.member_number],q)).slice(0,8);
}
async function collect(q){
  const term=safeTerm(q);if(!term)return[];
  const like=`%${term}%`;
  const [events,projects,tasks,social,contacts,members,cash]=await Promise.all([
    queryTable('events','id,name,event_date,event_end_date,event_status,place,notes',`name.ilike.${like},place.ilike.${like},notes.ilike.${like}`,{column:'event_date',ascending:false}),
    queryTable('projects','id,title,summary,status,priority,target_date,partner,objective,event_id',`title.ilike.${like},summary.ilike.${like},partner.ilike.${like},objective.ilike.${like}`,{column:'updated_at',ascending:false}),
    queryTable('project_tasks','id,title,description,status,priority,due_date,notes,project_id,event_id',`title.ilike.${like},description.ilike.${like},notes.ilike.${like}`,{column:'updated_at',ascending:false}),
    queryTable('social_content','id,title,hook,caption,production_notes,status,content_type,scheduled_date,event_id',`title.ilike.${like},hook.ilike.${like},caption.ilike.${like},production_notes.ilike.${like}`,{column:'updated_at',ascending:false}),
    queryTable('contacts','id,name,organization,contact_type,city,active',`name.ilike.${like},organization.ilike.${like},city.ilike.${like}`,{column:'updated_at',ascending:false}),
    searchMembers(q),
    queryTable('cash_transactions','id,entry_number,movement_date,movement_type,amount,description,from_party,to_party,event_id,contact_id,member_id',`description.ilike.${like},from_party.ilike.${like},to_party.ilike.${like},document_reference.ilike.${like}`,{column:'movement_date',ascending:false})
  ]);
  return [
    ...events.map(x=>({type:'event',id:x.id,title:x.name,subtitle:[dateLabel(x.event_date),x.place,x.event_status==='ended'?'Terminato':''].filter(Boolean).join(' · '),search:[x.name,x.place,x.notes]})),
    ...projects.map(x=>({type:'project',id:x.id,title:x.title,subtitle:[x.status,x.priority,x.target_date&&dateLabel(x.target_date)].filter(Boolean).join(' · '),search:[x.title,x.summary,x.partner,x.objective]})),
    ...tasks.map(x=>({type:'task',id:x.id,title:x.title,subtitle:[x.status,x.priority,x.due_date&&dateLabel(x.due_date)].filter(Boolean).join(' · '),search:[x.title,x.description,x.notes]})),
    ...social.map(x=>({type:'social',id:x.id,title:x.title,subtitle:[x.content_type,x.status,x.scheduled_date&&dateLabel(x.scheduled_date)].filter(Boolean).join(' · '),search:[x.title,x.hook,x.caption,x.production_notes]})),
    ...contacts.map(x=>({type:'contact',id:x.id,title:x.name,subtitle:[x.organization,x.city,x.active===false?'Non attivo':''].filter(Boolean).join(' · '),search:[x.name,x.organization,x.city]})),
    ...members.map(x=>({type:'member',id:x.id,title:[x.first_name,x.last_name].filter(Boolean).join(' '),subtitle:[x.member_number?`Socio #${x.member_number}`:'',x.status].filter(Boolean).join(' · '),search:[x.first_name,x.last_name,x.member_number]})),
    ...cash.map(x=>({type:'cash',id:x.id,title:x.description||`Movimento #${x.entry_number}`,subtitle:[x.movement_date&&dateLabel(x.movement_date),x.movement_type==='income'?'Entrata':'Uscita',money(x.amount)].filter(Boolean).join(' · '),search:[x.description,x.from_party,x.to_party,x.entry_number]}))
  ].sort((a,b)=>score(b,q)-score(a,q)||a.title.localeCompare(b.title,'it'));
}
function score(row,q){
  const needle=normalize(q),title=normalize(row.title),all=normalize((row.search||[]).join(' '));
  if(title===needle)return 100;if(title.startsWith(needle))return 80;if(title.includes(needle))return 60;if(all.includes(needle))return 35;return 0;
}
async function runSearch(q){
  const seq=++searchSeq;
  try{
    const results=await collect(q);if(seq!==searchSeq)return;
    currentResults=results;activeIndex=-1;renderFilters(results);renderResults(results);
    $('globalSearchStatus').textContent=results.length?`${results.length} ${results.length===1?'risultato':'risultati'} per “${q}”`:`Nessun risultato per “${q}”.`;
  }catch(error){
    console.error('Global search',error);if(seq!==searchSeq)return;
    currentResults=[];renderFilters([]);$('globalSearchStatus').textContent='Errore durante la ricerca.';$('globalSearchResults').innerHTML='';
  }
}
function visibleResults(results=currentResults){return activeType==='all'?results:results.filter(r=>r.type===activeType)}
function resultCard(row,index){
  const m=meta(row.type);return `<button type="button" class="global-search-result ${index===activeIndex?'active':''}" data-global-result-index="${index}">
    <span class="global-search-result-icon">${m.icon}</span>
    <span class="global-search-result-copy"><b>${esc(row.title)}</b><small>${esc(row.subtitle||m.label)}</small></span>
    <span class="global-search-result-type">${m.label}</span><i>›</i>
  </button>`;
}
function renderResults(results){
  const visible=visibleResults(results);
  const root=$('globalSearchResults');
  if(!visible.length){root.innerHTML=currentResults.length?'<div class="global-search-empty">Nessun risultato in questo modulo.</div>':'';return}
  let html='';
  if(activeType==='all'){
    for(const group of GROUPS){
      const rows=visible.filter(r=>r.type===group.type);if(!rows.length)continue;
      html+=`<section class="global-search-group"><div class="global-search-group-head"><span>${group.icon} ${group.label}</span><b>${rows.length}</b></div><div class="global-search-group-list">${rows.map(r=>resultCard(r,visible.indexOf(r))).join('')}</div></section>`;
    }
  }else html=`<div class="global-search-group-list">${visible.map((r,i)=>resultCard(r,i)).join('')}</div>`;
  root.innerHTML=html;
  root.querySelectorAll('[data-global-result-index]').forEach(btn=>btn.onclick=()=>openResult(visible[Number(btn.dataset.globalResultIndex)]));
}
async function openResult(row){
  if(!row)return;close();
  if(row.type==='event'){
    await window.selectEvent?.(row.id,true);return;
  }
  await window.club42?.openLinkedEntity?.(row.type,row.id);
}
function refreshActive(){
  const rows=visibleResults();document.querySelectorAll('.global-search-result').forEach((el,i)=>el.classList.toggle('active',i===activeIndex));
  const active=document.querySelector('.global-search-result.active');active?.scrollIntoView({block:'nearest'});
  return rows;
}
function handleKeys(ev){
  const rows=visibleResults();
  if(ev.key==='ArrowDown'){ev.preventDefault();if(rows.length){activeIndex=(activeIndex+1)%rows.length;refreshActive()}}
  else if(ev.key==='ArrowUp'){ev.preventDefault();if(rows.length){activeIndex=(activeIndex<=0?rows.length:activeIndex)-1;refreshActive()}}
  else if(ev.key==='Enter'&&activeIndex>=0){ev.preventDefault();openResult(rows[activeIndex])}
}

export function syncGlobalSearchAccess(){
  ensureUi();const allowed=roleCanSearch();
  if($('globalSearchOpen'))$('globalSearchOpen').hidden=!allowed;
  if($('globalSearchOpenMobile'))$('globalSearchOpenMobile').hidden=!allowed;
  if(!allowed)close();
}
export function initGlobalSearch(){
  ensureUi();
  document.addEventListener('keydown',ev=>{
    if((ev.ctrlKey||ev.metaKey)&&String(ev.key).toLowerCase()==='k'){
      if(roleCanSearch()){ev.preventDefault();open()}
    }
  });
  syncGlobalSearchAccess();
}
