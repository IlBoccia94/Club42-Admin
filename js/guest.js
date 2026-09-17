import {$,db,download,esc} from './core.js';

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
function whenLabel(value){
  const today=new Date();today.setHours(0,0,0,0);
  const d=new Date(`${value}T00:00:00`);d.setHours(0,0,0,0);
  const days=Math.round((d-today)/86400000);
  if(days===0)return 'Oggi';
  if(days===1)return 'Domani';
  if(days>1&&days<=7)return `Tra ${days} giorni`;
  return dateParts(value).weekday;
}
function priceLabel(price){
  if(price===null||price===undefined||price==='')return '';
  const n=Number(price);
  if(n===0)return 'Ingresso libero';
  return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',minimumFractionDigits:n%1?2:0}).format(n);
}
function eventMeta(e){
  const bits=[];
  if(e.event_time)bits.push(`<span><b>◷</b>${esc(String(e.event_time).slice(0,5))}</span>`);
  if(e.place)bits.push(`<span><b>⌖</b>${esc(e.place)}</span>`);
  const price=priceLabel(e.price);if(price)bits.push(`<span><b>€</b>${esc(price)}</span>`);
  return bits.join('');
}
function calendarButton(e){return `<button type="button" class="guest-calendar-btn" onclick="addGuestEventToCalendar('${e.id}')"><span>＋</span> Aggiungi al calendario</button>`}

function featuredCard(e){
  const p=dateParts(e.event_date);
  return `<article class="guest-featured-card">
    <div class="guest-featured-date"><span>${p.month}</span><strong>${p.day}</strong><small>${esc(whenLabel(e.event_date))}</small></div>
    <div class="guest-featured-body"><div class="guest-next-pill">PROSSIMO EVENTO</div><h2>${esc(e.name)}</h2>${e.guest_description?`<p>${esc(e.guest_description)}</p>`:''}<div class="guest-meta">${eventMeta(e)}</div>${calendarButton(e)}</div>
  </article>`;
}
function regularCard(e){
  const p=dateParts(e.event_date);
  return `<article class="guest-event-card">
    <div class="guest-event-date"><strong>${p.day}</strong><span>${p.month}</span></div>
    <div class="guest-event-copy"><div class="guest-event-when">${esc(whenLabel(e.event_date))} · ${esc(p.long)}</div><h3>${esc(e.name)}</h3>${e.guest_description?`<p>${esc(e.guest_description)}</p>`:''}<div class="guest-meta">${eventMeta(e)}</div>${calendarButton(e)}</div>
  </article>`;
}
function renderGuestEvents(){
  const root=$('guestEventsRoot');if(!root)return;
  if(!guestEvents.length){
    root.innerHTML=`<section class="guest-empty"><div class="guest-empty-symbol">42</div><h2>Nessun appuntamento pubblicato.</h2><p>Stiamo preparando i prossimi eventi. Quando saranno pronti, li troverai qui.</p></section>`;
    return;
  }
  const [next,...rest]=guestEvents;
  root.innerHTML=`<section class="guest-next"><div class="guest-section-head"><div><span>IN EVIDENZA</span><h2>Il prossimo appuntamento</h2></div><b>${guestEvents.length} ${guestEvents.length===1?'evento':'eventi'} in programma</b></div>${featuredCard(next)}</section>${rest.length?`<section class="guest-upcoming"><div class="guest-section-head"><div><span>CALENDARIO</span><h2>A seguire</h2></div></div><div class="guest-events-grid">${rest.map(regularCard).join('')}</div></section>`:''}`;
}

function icsEscape(v=''){return String(v).replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;')}
function icsDate(value){return String(value).replaceAll('-','')}
function icsTime(value){return String(value||'').slice(0,5).replace(':','')+'00'}
window.addGuestEventToCalendar=id=>{
  const e=guestEvents.find(x=>x.id===id);if(!e)return;
  const start=e.event_time?`DTSTART;TZID=Europe/Rome:${icsDate(e.event_date)}T${icsTime(e.event_time)}`:`DTSTART;VALUE=DATE:${icsDate(e.event_date)}`;
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Club42//Area Soci//IT','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${e.id}@club42`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,start,`SUMMARY:${icsEscape(e.name)}`];
  if(e.place)lines.push(`LOCATION:${icsEscape(e.place)}`);
  if(e.guest_description)lines.push(`DESCRIPTION:${icsEscape(e.guest_description)}`);
  lines.push('END:VEVENT','END:VCALENDAR');
  download(`club42-${e.event_date}-${e.name.toLowerCase().replace(/[^a-z0-9]+/gi,'-')}.ics`,lines.join('\r\n'),'text/calendar;charset=utf-8');
};

export async function loadGuestPage(){
  const root=$('guestEventsRoot');if(root)root.innerHTML='<div class="guest-loading">Caricamento appuntamenti…</div>';
  const {data,error}=await db.rpc('club42_guest_events');
  if(error){console.error(error);if(root)root.innerHTML='<section class="guest-empty"><h2>Non riusciamo a caricare gli eventi.</h2><p>Riprova tra poco.</p></section>';return}
  guestEvents=data||[];renderGuestEvents();
}
