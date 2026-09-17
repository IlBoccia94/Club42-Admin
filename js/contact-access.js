import {$,db,esc,toast} from './core.js';
import {loadContacts} from './contacts.js';
import {isAdmin} from './permissions.js?v=20260917-access3';

const typeLabels={person:'Persona',artist:'Artista',association:'Associazione',supplier:'Fornitore',venue:'Location',speaker:'Relatore / ospite',sponsor:'Sponsor',media:'Media',professional:'Professionista'};
let basicContacts=[];

function setBasicUi(){
  const hero=document.querySelector('#view-contacts .contacts-hero p');
  if(hero)hero.textContent='Rubrica essenziale dei collaboratori Club42. Per Staff e Tesoriere sono visibili soltanto i recapiti utili, senza note, tag, indirizzi o storico delle collaborazioni.';
  const summary=document.querySelector('#view-contacts .contacts-summary');if(summary)summary.hidden=true;
  const tabs=document.querySelector('#view-contacts .contacts-tabs');if(tabs)tabs.hidden=true;
  const history=$('contact-panel-history');if(history)history.hidden=true;
  const directory=$('contact-panel-directory');if(directory){directory.hidden=false;directory.classList.add('active')}
  const newBtn=$('newContactBtn');if(newBtn)newBtn.hidden=true;
  const status=$('contactStatusFilter');if(status)status.hidden=true;
  const search=$('contactSearch');if(search)search.placeholder='🔎 Cerca nome, organizzazione o recapito…';
  const subtitle=$('pageSubtitle');if(subtitle)subtitle.textContent='Rubrica collaboratori · informazioni essenziali in sola lettura';
}

function basicCard(c){
  return `<article class="contact-card"><div class="contact-card-top"><span class="contact-type">${typeLabels[c.contact_type]||esc(c.contact_type||'Contatto')}</span><span class="badge ok">Sola lettura</span></div><h4>${esc(c.name)}</h4>${c.organization?`<p class="contact-org">${esc(c.organization)}</p>`:''}<div class="contact-meta">${c.email?`<span>✉ ${esc(c.email)}</span>`:''}${c.phone?`<span>☎ ${esc(c.phone)}</span>`:''}${c.instagram?`<span>◎ ${esc(c.instagram)}</span>`:''}${c.city?`<span>⌖ ${esc(c.city)}</span>`:''}</div></article>`;
}

function renderBasic(){
  const q=$('contactSearch')?.value?.toLowerCase().trim()||'';
  const tf=$('contactTypeFilter')?.value||'all';
  let rows=basicContacts.filter(c=>tf==='all'||c.contact_type===tf);
  if(q)rows=rows.filter(c=>[c.name,c.organization,c.email,c.phone,c.instagram,c.city].some(v=>(v||'').toLowerCase().includes(q)));
  rows.sort((a,b)=>a.name.localeCompare(b.name,'it'));
  $('contactsGrid').innerHTML=rows.length?rows.map(basicCard).join(''):'<div class="contact-empty">Nessun contatto trovato.</div>';
}

export async function loadContactsForRole(){
  if(isAdmin())return loadContacts();
  setBasicUi();
  const {data,error}=await db.rpc('club42_contact_directory');
  if(error){console.error(error);toast('Errore nel caricamento contatti');return}
  basicContacts=data||[];
  renderBasic();
  $('contactSearch').oninput=renderBasic;
  $('contactTypeFilter').onchange=renderBasic;
}
