export const SUPABASE_URL='https://whqpryabjwpnrzyappir.supabase.co';
export const SUPABASE_KEY='sb_publishable_N9hO5f1-Z4iDBLOJhxlnsA_UAfHsxhC';
export const APP_URL='https://ilboccia94.github.io/Club42-Admin/';
export const LEGACY_KEY='club42_iscrizioni_v2';

export const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

export const app={
  state:{events:[],people:[],selected:null},
  currentUser:null,
  currentProfile:null,
  adminUsers:[],
  editEventId:null,
  editPersonId:null,
  editUserId:null
};

export const $=id=>document.getElementById(id);
export function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
export function selected(){return app.state.events.find(e=>e.id===app.state.selected)||app.state.events[0]||null}
export function list(eventId){return app.state.people.filter(p=>p.eventId===eventId)}
export function fmtDate(d){if(!d)return'';return new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(d+'T12:00:00'))}
export function toast(text){const x=$('toast');if(!x)return;x.textContent=text;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2400)}
export function badge(v){return v==='confirmed'?'<span class="badge ok">Confermato</span>':v==='waitlist'?'<span class="badge wait">Attesa</span>':'<span class="badge off">Annullato</span>'}
export function syncStatus(type='ok',text='Supabase'){const d=$('syncDot');if(!d)return;d.className='sync-dot'+(type==='loading'?' loading':type==='error'?' error':'');$('syncText').textContent=text}
export function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),700)}
