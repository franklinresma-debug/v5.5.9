(() => {
const API='https://api.amsertech.com',$=id=>document.getElementById(id);
const list=$('benefitList'),notice=$('benefitNotice'),search=$('benefitSearch'),category=$('benefitCategory'),scope=$('benefitScope'),summary=$('benefitSummary');
let timer=null,savedIds=new Set(),intelligence={};
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const label=v=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const cookie=n=>{const p=`${n}=`;const r=document.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(p));return r?r.slice(p.length):''};
async function csrf(){const r=await fetch(`${API}/sanctum/csrf-cookie`,{credentials:'include',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});if(!r.ok)throw new Error('Unable to initialize secure benefit request.')}
async function request(path,opt={}){const method=String(opt.method||'GET').toUpperCase(),mut=!['GET','HEAD','OPTIONS'].includes(method);if(mut)await csrf();const h={Accept:'application/json','X-Requested-With':'XMLHttpRequest',...(opt.headers||{})};if(mut){h['Content-Type']='application/json';const t=decodeURIComponent(cookie('XSRF-TOKEN'));if(t)h['X-XSRF-TOKEN']=t}const r=await fetch(`${API}${path}`,{...opt,method,credentials:'include',headers:h});let b=null;try{b=await r.json()}catch(_){}if(!r.ok){const e=new Error(b?.message||`Benefit request failed (${r.status}).`);e.status=r.status;throw e}return b}
function show(m='',tone=''){notice.textContent=m;notice.hidden=!m;notice.dataset.tone=tone}
function failAuth(e){if([401,403,419].includes(e.status)){location.replace('/login?return=/nurselink-benefits.html');return true}return false}
function fmt(v){if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?esc(v):esc(d.toLocaleDateString())}
function availability(x){
 if(!x.ends_at)return{state:'no_end_date',label:'No end date'};
 const d=new Date(x.ends_at),now=new Date();
 if(Number.isNaN(d.getTime()))return{state:'current',label:'Current'};
 const days=Math.ceil((d-now)/86400000);
 if(days<=7)return{state:'ending_7',label:`Ends in ${Math.max(days,0)} day${days===1?'':'s'}`};
 if(days<=30)return{state:'ending_30',label:`Ends in ${days} days`};
 return{state:'current',label:'Current'};
}
function renderSummary(){
 const r=intelligence.requests||{};
 summary.innerHTML=[
  ['Available',intelligence.available||0,'Published/current'],
  ['Ending ≤7 days',intelligence.ending_within_7_days||0,'Review soon'],
  ['Ending 8–30 days',intelligence.ending_within_30_days||0,'Upcoming end dates'],
  ['Saved',intelligence.saved_count||0,'Your bookmarks'],
  ['Requested / Approved',Number(r.requested||0)+Number(r.approved||0),`${r.requested||0} requested · ${r.approved||0} approved`]
 ].map(x=>`<div class="bf-stat"><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong><small>${esc(x[2])}</small></div>`).join('');
}
async function loadIntelligence(){
 const b=await request('/api/benefits/intelligence');
 intelligence=b?.data||{};
 savedIds=new Set((intelligence.saved_benefit_ids||[]).map(Number));
 renderSummary();
}
function card(x){
 const r=x.request,active=r&&['requested','approved','fulfilled'].includes(r.status);
 const cap=x.remaining_request_capacity,avail=availability(x),saved=savedIds.has(Number(x.id));
 let action='';
 if(x.requires_request){
   if(active){
     action=`<span class="bf-status" data-status="${esc(r.status)}">${esc(label(r.status))}</span>${['requested','approved'].includes(r.status)?`<button data-cancel="${x.id}" type="button">Cancel Request</button>`:''}`;
   }else{
     action=`<button data-request="${x.id}" type="button" ${(cap===0)?'disabled':''}>${cap===0?'Request Capacity Reached':'Request Benefit'}</button>`;
   }
 }else if(x.external_url){
   action=`<a href="${esc(x.external_url)}" target="_blank" rel="noopener noreferrer">Open Resource ↗</a>`;
 }else{
   action='<span class="bf-open">No NurseLink request required</span>';
 }
 return `<article class="bf-card"><div class="bf-main"><span>${esc(label(x.category))}${x.provider_name?` · ${esc(x.provider_name)}`:''}</span><h2>${esc(x.title)}</h2><p>${esc(x.description||'')}</p><div class="bf-meta"><span class="bf-availability" data-state="${esc(avail.state)}">${esc(avail.label)}</span>${x.eligibility_note?`<strong>Eligibility: ${esc(x.eligibility_note)}</strong>`:''}${x.ends_at?`<span>Available through ${fmt(x.ends_at)}</span>`:''}${x.requires_request&&x.max_requests!==null?`<span>${esc(cap)} request slot${Number(cap)===1?'':'s'} remaining</span>`:''}</div>${x.terms?`<details><summary>Terms & conditions</summary><p>${esc(x.terms)}</p></details>`:''}</div><div class="bf-side"><button class="bf-save" data-save="${x.id}" data-saved="${saved?'1':'0'}" type="button">${saved?'★ Saved':'☆ Save'}</button>${action}${r?.admin_note?`<small>Admin note: ${esc(r.admin_note)}</small>`:''}</div></article>`;
}
async function load(){list.innerHTML='<div class="bf-loading">Loading benefits…</div>';show('');const q=new URLSearchParams();if(search.value.trim())q.set('search',search.value.trim());if(category.value!=='all')q.set('category',category.value);if(scope.value!=='saved')q.set('scope',scope.value);try{await loadIntelligence();const b=await request(`/api/benefits?${q}`);let rows=Array.isArray(b?.data)?b.data:[];if(scope.value==='saved')rows=rows.filter(x=>savedIds.has(Number(x.id)));list.innerHTML=rows.length?rows.map(card).join(''):'<div class="bf-empty">No benefits match this view.</div>';bind()}catch(e){if(failAuth(e))return;list.innerHTML='<div class="bf-empty">Benefits are unavailable.</div>';show(e.message,'error')}}
function bind(){
 list.querySelectorAll('[data-save]').forEach(btn=>btn.addEventListener('click',async()=>{const id=btn.dataset.save,saved=btn.dataset.saved==='1';btn.disabled=true;try{const b=await request(`/api/benefits/${id}/save`,{method:saved?'DELETE':'POST',body:'{}'});show(b?.message||(saved?'Benefit removed from saved items.':'Benefit saved.'),'success');await load()}catch(e){show(e.message,'error');btn.disabled=false}}));
 list.querySelectorAll('[data-request]').forEach(btn=>btn.addEventListener('click',async()=>{const note=prompt('Optional note for the NurseLink administrator:','');if(note===null)return;btn.disabled=true;try{const b=await request(`/api/benefits/${btn.dataset.request}/request`,{method:'POST',body:JSON.stringify({member_note:note||null})});show(b?.message||'Benefit request submitted.','success');await load()}catch(e){show(e.message,'error');btn.disabled=false}}));
 list.querySelectorAll('[data-cancel]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Cancel this benefit request?'))return;btn.disabled=true;try{const b=await request(`/api/benefits/${btn.dataset.cancel}/request`,{method:'DELETE'});show(b?.message||'Benefit request cancelled.','success');await load()}catch(e){show(e.message,'error');btn.disabled=false}}));
}
search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(load,250)});category.addEventListener('change',load);scope.addEventListener('change',load);$('refreshBenefits').addEventListener('click',load);load();
})();
