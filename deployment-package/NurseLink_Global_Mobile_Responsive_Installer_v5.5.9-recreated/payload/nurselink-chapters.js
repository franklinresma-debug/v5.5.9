(() => {
  const API='https://api.amsertech.com';
  const list=document.getElementById('chapterList'),notice=document.getElementById('chapterNotice'),search=document.getElementById('chapterSearch'),type=document.getElementById('chapterType'),scope=document.getElementById('chapterScope'),refresh=document.getElementById('refreshChapters');
  let timer=null;
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const label=v=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const cookie=n=>{const p=`${n}=`;const r=document.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(p));return r?r.slice(p.length):''};
  async function csrf(){const r=await fetch(`${API}/sanctum/csrf-cookie`,{credentials:'include',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});if(!r.ok)throw new Error('Unable to initialize secure chapter request.')}
  async function request(path,options={}){
    const method=String(options.method||'GET').toUpperCase(),mutating=!['GET','HEAD','OPTIONS'].includes(method);
    if(mutating)await csrf();
    const headers={Accept:'application/json','X-Requested-With':'XMLHttpRequest',...(options.headers||{})};
    if(mutating){headers['Content-Type']='application/json';const t=decodeURIComponent(cookie('XSRF-TOKEN'));if(t)headers['X-XSRF-TOKEN']=t}
    const r=await fetch(`${API}${path}`,{...options,method,credentials:'include',headers});let body=null;try{body=await r.json()}catch(_){}
    if(!r.ok){const e=new Error(body?.message||`Chapter request failed (${r.status}).`);e.status=r.status;throw e}return body;
  }
  function show(m='',tone=''){notice.textContent=m;notice.hidden=!m;notice.dataset.tone=tone}
  function card(row){
    const m=row.membership;
    const active=m?.status==='active', pending=m?.status==='pending';
    return `<article class="ch-card" data-status="${esc(m?.status||'none')}">
      <div class="ch-main"><span>${esc(label(row.chapter_type))}</span><h2>${esc(row.name)}</h2><p>${esc(row.description||'')}</p><div class="ch-meta">${row.region?`<strong>${esc(row.region)}</strong>`:''}<span>${esc([row.city,row.country].filter(Boolean).join(', ')||'Location not specified')}</span><span>${esc(row.active_member_count)} active member${Number(row.active_member_count)===1?'':'s'}</span>${row.contact_email?`<span>${esc(row.contact_email)}</span>`:''}</div></div>
      <div class="ch-side">
        ${m?`<span class="ch-status" data-status="${esc(m.status)}">${esc(label(m.status))}</span>`:''}
        ${active?`<strong>${m.is_primary?'Primary Chapter':'Chapter Member'}</strong><small>${esc(label(m.chapter_role||'member'))}</small><button data-leave="${esc(row.id)}" type="button">Leave Chapter</button>`:
          pending?`<strong>Request Pending</strong><button data-leave="${esc(row.id)}" type="button">Withdraw Request</button>`:
          row.member_join_enabled?`<button data-join="${esc(row.id)}" type="button">Request to Join</button>`:'<small>Join requests are currently closed.</small>'}
      </div>
    </article>`;
  }
  async function load(){
    list.innerHTML='<div class="ch-loading">Loading chapters…</div>';show('');
    const q=new URLSearchParams();
    if(search.value.trim())q.set('search',search.value.trim());
    if(type.value!=='all')q.set('type',type.value);
    q.set('scope',scope.value);
    try{const b=await request(`/api/chapters?${q}`);const rows=Array.isArray(b?.data)?b.data:[];list.innerHTML=rows.length?rows.map(card).join(''):'<div class="ch-empty">No chapters match this view.</div>';bind()}
    catch(e){if([401,403,419].includes(e.status)){location.replace('/login?return=/nurselink-chapters.html');return}list.innerHTML='<div class="ch-empty">Chapter information is unavailable.</div>';show(e.message,'error')}
  }
  function bind(){
    list.querySelectorAll('[data-join]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{const r=await request(`/api/chapters/${b.dataset.join}/request`,{method:'POST',body:'{}'});show(r?.message||'Chapter request submitted.','success');await load()}catch(e){show(e.message,'error');b.disabled=false}}));
    list.querySelectorAll('[data-leave]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Withdraw or end this chapter membership?'))return;b.disabled=true;try{const r=await request(`/api/chapters/${b.dataset.leave}/membership`,{method:'DELETE'});show(r?.message||'Chapter membership updated.','success');await load()}catch(e){show(e.message,'error');b.disabled=false}}));
  }
  search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(load,250)});type.addEventListener('change',load);scope.addEventListener('change',load);refresh.addEventListener('click',load);load();
})();
