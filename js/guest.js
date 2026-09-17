import {$,app,db,download,esc,toast} from './core.js';

let guestEvents=[];

function dateParts(value){
  const d=new Date(`${value}T12:00:00`);
  return {
    day:String(d.getDate()).padStart(2,'0'),
    month:d.toLocaleDateString('it-IT',{month:'short'}).replace('.','').toUpperCase(),
    weekday:d.toLocaleDateString('it-IT',{weekday:'long'}),
    long:d.toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})
  };
}
function dateRangeLabel(e){
  if(!e?.event_date)return '';
  const start=dateParts(e.event_date);
  const end=e.event_end_date&&e.event_end_date!==e.event_date?dateParts(e.event_end_date):null;
  if(!end)return start.long;
  const sd=new Date(`${e.event_date}T12:00:00`),ed=new Date(`${e.event_end_date}T12:00:00`);
  if(sd.getFullYear()===ed.getFullYear()&&sd.getMonth()===ed.getMonth()){
    const month=sd.toLocaleDateString('it-IT',{month:'long'});
    return `${sd.getDate()}–${ed.getDate()} ${month} ${sd.getFullYear()}`;
  }
  return `${start.long} – ${end.long}`;
}

function compactDateBadge(e){
  const start=dateParts(e.event_date);
  if(!e.event_end_date||e.event_end_date===e.event_date)return{day:start.day,month:start.month,range:false,crossMonth:false};
  const end=dateParts(e.event_end_date);
  const sd=new Date(`${e.event_date}T12:00:00`),ed=new Date(`${e.event_end_date}T12:00:00`);
  if(sd.getFullYear()===ed.getFullYear()&&sd.getMonth()===ed.getMonth()){
    return{day:`${start.day}–${end.day}`,month:start.month,range:true,crossMonth:false};
  }
  return{day:`${start.day} ${start.month}`,month:`– ${end.day} ${end.month}`,range:true,crossMonth:true};
}
function whenLabel(e){
  const today=new Date();today.setHours(0,0,0,0);
  const start=new Date(`${e.event_date}T00:00:00`);start.setHours(0,0,0,0);
  const end=new Date(`${e.event_end_date||e.event_date}T00:00:00`);end.setHours(0,0,0,0);
  if(start<today&&end>=today)return 'In corso';
  const days=Math.round((start-today)/86400000);
  if(days===0)return 'Oggi';
  if(days===1)return 'Domani';
  if(days>1&&days<=7)return `Tra ${days} giorni`;
  return dateParts(e.event_date).weekday;
}
function priceLabel(e){
  if(e?.is_free)return 'Gratuito';
  if(e?.price===null||e?.price===undefined||e?.price==='')return '';
  const n=Number(e.price);
  return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',minimumFractionDigits:n%1?2:0}).format(n);
}
function timeLabel(e){
  const start=e?.event_time?String(e.event_time).slice(0,5):'';
  const end=e?.event_end_time?String(e.event_end_time).slice(0,5):'';
  if(start&&end)return `${start} – ${end}`;
  if(start)return start;
  if(end)return `Fine ${end}`;
  return '';
}
function eventMeta(e,includeDateRange=false){
  const bits=[];
  if(includeDateRange&&e.event_end_date&&e.event_end_date!==e.event_date)bits.push(`<span><b>◫</b>${esc(dateRangeLabel(e))}</span>`);
  const time=timeLabel(e);if(time)bits.push(`<span><b>◷</b>${esc(time)}</span>`);
  if(e.place)bits.push(`<span><b>⌖</b>${esc(e.place)}</span>`);
  const price=priceLabel(e);if(price)bits.push(`<span><b>€</b>${esc(price)}</span>`);
  return bits.join('');
}
function calendarButton(e){return `<button type="button" class="guest-calendar-btn" onclick="addGuestEventToCalendar('${e.id}')"><span>＋</span> Aggiungi al calendario</button>`}
function registrationButton(e){
  const isGuest=app.currentProfile?.role==='guest';
  if(e.registration_status==='confirmed')return '<button type="button" class="guest-register-btn registered" disabled><span>✓</span> Sei iscritto</button>';
  if(e.registration_status==='waitlist')return '<button type="button" class="guest-register-btn waitlisted" disabled><span>⏳</span> In lista d’attesa</button>';
  if(!isGuest)return '<button type="button" class="guest-register-btn" onclick="previewGuestRegistration()"><span>＋</span> Iscriviti</button>';
  return `<button type="button" class="guest-register-btn" data-register-event="${e.id}" onclick="registerGuestEvent('${e.id}',this)"><span>＋</span> Iscriviti</button>`;
}
function eventActions(e){return `<div class="guest-event-actions">${registrationButton(e)}${calendarButton(e)}</div>`}

function featuredCard(e){
  const p=compactDateBadge(e);
  const cls=p.crossMonth?'guest-date-cross':p.range?'guest-date-range':'';
  return `<article class="guest-featured-card">
    <div class="guest-featured-date"><span>${esc(p.month)}</span><strong class="${cls}">${esc(p.day)}</strong><small>${esc(whenLabel(e))}</small></div>
    <div class="guest-featured-body"><div class="guest-next-pill">PROSSIMO EVENTO</div><h2>${esc(e.name)}</h2>${e.guest_description?`<p>${esc(e.guest_description)}</p>`:''}<div class="guest-meta">${eventMeta(e,true)}</div>${eventActions(e)}</div>
  </article>`;
}
function regularCard(e){
  const p=compactDateBadge(e);
  const cls=p.crossMonth?'guest-date-cross':p.range?'guest-date-range':'';
  return `<article class="guest-event-card">
    <div class="guest-event-date"><strong class="${cls}">${esc(p.day)}</strong><span>${esc(p.month)}</span></div>
    <div class="guest-event-copy"><div class="guest-event-when">${esc(whenLabel(e))} · ${esc(dateRangeLabel(e))}</div><h3>${esc(e.name)}</h3>${e.guest_description?`<p>${esc(e.guest_description)}</p>`:''}<div class="guest-meta">${eventMeta(e)}</div>${eventActions(e)}</div>
  </article>`;
}
function teaserCard(e){
  return `<article class="guest-teaser-card"><div class="guest-teaser-glow" aria-hidden="true"></div><div class="guest-coming-pill">PROSSIMAMENTE</div><h3>${esc(e.name)}</h3>${e.guest_description?`<p>${esc(e.guest_description)}</p>`:''}</article>`;
}
function renderGuestEvents(){
  const root=$('guestEventsRoot');if(!root)return;
  const scheduled=guestEvents.filter(e=>!e.is_teaser&&e.event_date);
  const teasers=guestEvents.filter(e=>e.is_teaser);
  if(!scheduled.length&&!teasers.length){
    root.innerHTML=`<section class="guest-empty"><div class="guest-empty-symbol">42</div><h2>Nessun appuntamento pubblicato.</h2><p>Stiamo preparando i prossimi eventi. Quando saranno pronti, li troverai qui.</p></section>`;
    return;
  }
  let html='';
  if(scheduled.length){
    const [next,...rest]=scheduled;
    html+=`<section class="guest-next"><div class="guest-section-head"><div><span>IN EVIDENZA</span><h2>Il prossimo appuntamento</h2></div><b>${scheduled.length} ${scheduled.length===1?'evento':'eventi'} in programma</b></div>${featuredCard(next)}</section>`;
    if(rest.length)html+=`<section class="guest-upcoming"><div class="guest-section-head"><div><span>CALENDARIO</span><h2>A seguire</h2></div></div><div class="guest-events-grid">${rest.map(regularCard).join('')}</div></section>`;
  }
  if(teasers.length)html+=`<section class="guest-coming"><div class="guest-section-head"><div><span>IN ARRIVO</span><h2>Prossimamente</h2></div><b>${teasers.length} ${teasers.length===1?'anticipazione':'anticipazioni'}</b></div><div class="guest-teasers-grid">${teasers.map(teaserCard).join('')}</div></section>`;
  root.innerHTML=html;
}

function icsEscape(v=''){return String(v).replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;')}
function icsDate(value){return String(value).replaceAll('-','')}
function icsTime(value){return String(value||'').slice(0,5).replace(':','')+'00'}
function addDaysIso(value,days){
  const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+days);
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
window.addGuestEventToCalendar=id=>{
  const e=guestEvents.find(x=>x.id===id);if(!e||e.is_teaser||!e.event_date)return;
  const start=e.event_time?`DTSTART;TZID=Europe/Rome:${icsDate(e.event_date)}T${icsTime(e.event_time)}`:`DTSTART;VALUE=DATE:${icsDate(e.event_date)}`;
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Club42//Area Soci//IT','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${e.id}@club42`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,start,`SUMMARY:${icsEscape(e.name)}`];
  if(e.event_time&&e.event_end_time){
    lines.push(`DTEND;TZID=Europe/Rome:${icsDate(e.event_end_date||e.event_date)}T${icsTime(e.event_end_time)}`);
  }else if(!e.event_time){
    lines.push(`DTEND;VALUE=DATE:${icsDate(addDaysIso(e.event_end_date||e.event_date,1))}`);
  }
  if(e.place)lines.push(`LOCATION:${icsEscape(e.place)}`);
  if(e.guest_description)lines.push(`DESCRIPTION:${icsEscape(e.guest_description)}`);
  lines.push('END:VEVENT','END:VCALENDAR');
  download(`club42-${e.event_date}-${e.name.toLowerCase().replace(/[^a-z0-9]+/gi,'-')}.ics`,lines.join('\r\n'),'text/calendar;charset=utf-8');
};
window.previewGuestRegistration=()=>toast('Anteprima: l’iscrizione è disponibile agli utenti Guest.');
window.registerGuestEvent=async(id,button)=>{
  if(app.currentProfile?.role!=='guest')return;
  if(button){button.disabled=true;button.classList.add('loading');button.innerHTML='<span>…</span> Iscrizione in corso';}
  const {data,error}=await db.rpc('club42_guest_register_event',{p_event_id:id});
  if(error){console.error(error);toast(error.message||'Non è stato possibile completare l’iscrizione');await loadGuestPage();return}
  const result=Array.isArray(data)?data[0]:data;
  if(result?.registration_status==='waitlist')toast('Posti esauriti: sei stato inserito in lista d’attesa');
  else toast(result?.already_registered?'Risulti già iscritto a questo evento':'Iscrizione confermata!');
  await loadGuestPage();
};

export async function loadGuestPage(){
  const root=$('guestEventsRoot');if(root)root.innerHTML='<div class="guest-loading">Caricamento appuntamenti…</div>';
  const {data,error}=await db.rpc('club42_guest_events');
  if(error){console.error(error);if(root)root.innerHTML='<section class="guest-empty"><h2>Non riusciamo a caricare gli eventi.</h2><p>Riprova tra poco.</p></section>';return}
  guestEvents=data||[];renderGuestEvents();
}
