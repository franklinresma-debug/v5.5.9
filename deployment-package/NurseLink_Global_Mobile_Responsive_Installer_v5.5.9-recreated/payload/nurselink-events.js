(() => {
  const API='https://api.amsertech.com';
  const list=document.getElementById('eventList');
  const notice=document.getElementById('eventNotice');
  const search=document.getElementById('eventSearch');
  const mode=document.getElementById('eventMode');
  const scope=document.getElementById('eventScope');
  const refresh=document.getElementById('refreshEvents');
  let timer=null;

  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const cookie=name=>{const p=`${name}=`;const r=document.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(p));return r?r.slice(p.length):''};

  async function csrf(){const r=await fetch(`${API}/sanctum/csrf-cookie`,{credentials:'include',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});if(!r.ok)throw new Error('Unable to initialize secure event request.')}
  async function request(path,options={}){
    const method=String(options.method||'GET').toUpperCase();
    const mutating=!['GET','HEAD','OPTIONS'].includes(method);
    if(mutating)await csrf();
    const headers={Accept:'application/json','X-Requested-With':'XMLHttpRequest',...(options.headers||{})};
    if(mutating){headers['Content-Type']='application/json';const t=decodeURIComponent(cookie('XSRF-TOKEN'));if(t)headers['X-XSRF-TOKEN']=t}
    const r=await fetch(`${API}${path}`,{...options,method,credentials:'include',headers});
    let body=null;try{body=await r.json()}catch(_){}
    if(!r.ok){const e=new Error(body?.message||`Event request failed (${r.status}).`);e.status=r.status;throw e}
    return body;
  }
  function show(m='',tone=''){notice.textContent=m;notice.hidden=!m;notice.dataset.tone=tone}
  function fmt(v){if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?esc(v):esc(d.toLocaleString())}
  function label(v){return String(v||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}

  function card(row){
    const reg=row.registration;
    const active=reg&&['registered','waitlisted','attended'].includes(reg.status);
    const full=row.remaining_capacity===0 && row.capacity!==null;
    return `<article class="ev-card" data-mode="${esc(row.delivery_mode)}">
      <div class="ev-main"><span>${row.chapter_name?`${esc(row.chapter_name)} · `:''}${esc(label(row.event_type))} · ${esc(label(row.delivery_mode))}</span><h2>${esc(row.title)}</h2><p>${esc(row.description||'')}</p>
      <div class="ev-meta"><strong>${fmt(row.starts_at)}</strong>${row.ends_at?`<span>Ends ${fmt(row.ends_at)}</span>`:''}${row.organizer?`<span>${esc(row.organizer)}</span>`:''}${row.venue?`<span>${esc(row.venue)}${row.city?`, ${esc(row.city)}`:''}</span>`:''}</div></div>
      <div class="ev-side">
        ${row.capacity!==null?`<small>${esc(row.registered_count)} / ${esc(row.capacity)} registered</small>`:'<small>Open capacity</small>'}
        ${row.learning_hours!==null?`<small>${esc(row.learning_hours)} learning hours</small>`:''}
        ${row.cpd_units_claimed!==null?`<small>${esc(row.cpd_units_claimed)} CPD units*</small>`:''}
        ${active?`<strong class="ev-status" data-status="${esc(reg.status)}">${esc(label(reg.status))}</strong>`:''}
        ${row.registration_required
          ? active && reg.status!=='attended'
            ? `<button data-cancel="${esc(row.id)}" type="button">Cancel Registration</button>`
            : reg?.status==='attended'
              ? `<span class="ev-attended">Attendance recorded</span>`
              : `<button data-register="${esc(row.id)}" type="button">${full?'Join Waitlist':'Register'}</button>`
          : '<span class="ev-open">No registration required</span>'}
      </div>
    </article>`;
  }

  async function load(){
    list.innerHTML='<div class="ev-loading">Loading events…</div>';show('');
    const params=new URLSearchParams();
    if(search.value.trim())params.set('search',search.value.trim());
    if(mode.value!=='all')params.set('mode',mode.value);
    params.set('scope',scope.value);
    try{
      const body=await request(`/api/events?${params}`);
      const rows=Array.isArray(body?.data)?body.data:[];
      list.innerHTML=rows.length?rows.map(card).join(''):'<div class="ev-empty">No events match this view.</div>';
      bind();
    }catch(e){
      if([401,403,419].includes(e.status)){window.location.replace('/login?return=/nurselink-events.html');return}
      list.innerHTML='<div class="ev-empty">Events are unavailable.</div>';show(e.message,'error');
    }
  }
  function bind(){
    list.querySelectorAll('[data-register]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{const r=await request(`/api/events/${b.dataset.register}/register`,{method:'POST',body:'{}'});show(r?.message||'Registered.','success');await load()}catch(e){show(e.message,'error');b.disabled=false}}));
    list.querySelectorAll('[data-cancel]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Cancel this event registration?'))return;b.disabled=true;try{const r=await request(`/api/events/${b.dataset.cancel}/registration`,{method:'DELETE'});show(r?.message||'Registration cancelled.','success');await load()}catch(e){show(e.message,'error');b.disabled=false}}));
  }
  search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(load,250)});
  mode.addEventListener('change',load);scope.addEventListener('change',load);refresh.addEventListener('click',load);load();
})();
