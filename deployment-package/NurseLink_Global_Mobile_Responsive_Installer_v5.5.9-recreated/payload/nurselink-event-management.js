(() => {
  const API='https://api.amsertech.com';
  const notice=document.getElementById('eventAdminNotice');
  const identity=document.getElementById('adminIdentity');
  const form=document.getElementById('eventForm');
  const list=document.getElementById('eventAdminList');
  const regPanel=document.getElementById('registrationPanel');
  const regList=document.getElementById('registrationList');
  const regTitle=document.getElementById('registrationTitle');
  let rows=[];let chapters=[];

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const cookie=name=>{const p=`${name}=`;const r=document.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(p));return r?r.slice(p.length):''};
  async function csrf(){const r=await fetch(`${API}/sanctum/csrf-cookie`,{credentials:'include',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});if(!r.ok)throw new Error('Unable to initialize secure administrator request.')}
  async function request(path,options={}){
    const method=String(options.method||'GET').toUpperCase(),mutating=!['GET','HEAD','OPTIONS'].includes(method);
    if(mutating)await csrf();
    const headers={Accept:'application/json','X-Requested-With':'XMLHttpRequest',...(options.headers||{})};
    if(mutating){headers['Content-Type']='application/json';const t=decodeURIComponent(cookie('XSRF-TOKEN'));if(t)headers['X-XSRF-TOKEN']=t}
    const r=await fetch(`${API}${path}`,{...options,method,credentials:'include',headers});let body=null;try{body=await r.json()}catch(_){}
    if(!r.ok){const e=new Error(body?.message||`Event Management request failed (${r.status}).`);e.status=r.status;e.payload=body;throw e}return body;
  }
  function show(m='',tone=''){notice.textContent=m;notice.hidden=!m;notice.dataset.tone=tone}
  function adminLogin(){location.replace('/nurselink-admin-login.html?return=/nurselink-event-management.html')}
  function dt(v){if(!v)return'';const d=new Date(v);if(Number.isNaN(d.getTime()))return'';const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
  function iso(v){return v?new Date(v).toISOString():null}
  function label(v){return String(v||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}

  function payload(){
    return {
      chapter_id:$('eventChapter').value?Number($('eventChapter').value):null,
      title:$('eventTitle').value.trim(),
      event_type:$('eventType').value,
      delivery_mode:$('eventMode').value,
      description:$('eventDescription').value.trim()||null,
      organizer:$('eventOrganizer').value.trim()||null,
      venue:$('eventVenue').value.trim()||null,
      city:$('eventCity').value.trim()||null,
      country:$('eventCountry').value.trim()||null,
      meeting_url:$('eventMeetingUrl').value.trim()||null,
      starts_at:iso($('eventStarts').value),
      ends_at:iso($('eventEnds').value),
      capacity:$('eventCapacity').value?Number($('eventCapacity').value):null,
      status:$('eventStatus').value,
      member_only:true,
      registration_required:$('eventRegistrationRequired').checked,
      registration_deadline:iso($('eventDeadline').value),
      learning_hours:$('eventLearningHours').value?Number($('eventLearningHours').value):null,
      cpd_units_claimed:$('eventCpdUnits').value?Number($('eventCpdUnits').value):null
    };
  }
  function reset(){
    form.reset();$('eventId').value='';$('eventChapter').value='';$('eventRegistrationRequired').checked=true;$('eventMemberOnly').checked=true;$('eventStatus').value='draft';$('eventMode').value='online';$('eventType').value='webinar';
  }
  function edit(row){
    $('eventId').value=row.id;$('eventChapter').value=row.chapter_id??'';$('eventTitle').value=row.title||'';$('eventType').value=row.event_type;$('eventMode').value=row.delivery_mode;$('eventDescription').value=row.description||'';$('eventOrganizer').value=row.organizer||'';$('eventVenue').value=row.venue||'';$('eventCity').value=row.city||'';$('eventCountry').value=row.country||'';$('eventMeetingUrl').value=row.meeting_url||'';$('eventStarts').value=dt(row.starts_at);$('eventEnds').value=dt(row.ends_at);$('eventCapacity').value=row.capacity??'';$('eventDeadline').value=dt(row.registration_deadline);$('eventLearningHours').value=row.learning_hours??'';$('eventCpdUnits').value=row.cpd_units_claimed??'';$('eventStatus').value=row.status;$('eventRegistrationRequired').checked=!!row.registration_required;window.scrollTo({top:0,behavior:'smooth'});
  }
  function render(){
    if(!rows.length){list.innerHTML='<div class="nl-admin-empty">No events created yet.</div>';return}
    list.innerHTML=rows.map(row=>{const c=row.registration_counts||{};return `<article class="em-item"><div><span>${esc(label(row.event_type))} · ${esc(label(row.delivery_mode))}</span><strong>${esc(row.title)}</strong><small>${esc(row.starts_at)}${row.chapter_name?` · ${esc(row.chapter_name)}`:''}</small></div><div class="em-item-meta"><span data-status="${esc(row.status)}">${esc(label(row.status))}</span><small>${esc(c.registered||0)} registered · ${esc(c.waitlisted||0)} waitlisted · ${esc(c.attended||0)} attended</small></div><div class="em-item-actions"><button data-edit="${row.id}">Edit</button><button data-reg="${row.id}">Registrations</button></div></article>`}).join('');
    list.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>edit(rows.find(r=>String(r.id)===b.dataset.edit))));
    list.querySelectorAll('[data-reg]').forEach(b=>b.addEventListener('click',()=>loadRegistrations(b.dataset.reg)));
  }
  async function loadChapters(){
    const b=await request('/api/nurselink/admin/chapters');
    chapters=Array.isArray(b?.data)?b.data:[];
    $('eventChapter').innerHTML=
      '<option value="">All NurseLink members</option>'+
      chapters
        .filter(c=>c.status==='active')
        .map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`)
        .join('');
  }

  async function load(){
    list.innerHTML='<div class="nl-admin-loading">Loading events…</div>';
    try{const b=await request('/api/nurselink/admin/events');rows=Array.isArray(b?.data)?b.data:[];render()}
    catch(e){if([401,403,419].includes(e.status)){adminLogin();return}list.innerHTML=`<div class="nl-admin-empty">${esc(e.message)}</div>`}
  }
  async function loadRegistrations(id){
    regPanel.hidden=false;regList.innerHTML='<div class="nl-admin-loading">Loading registrations…</div>';
    try{const b=await request(`/api/nurselink/admin/events/${id}/registrations`);regTitle.textContent=b?.event?.title||'Event registrations';const r=Array.isArray(b?.data)?b.data:[];regList.innerHTML=r.length?r.map(x=>`<div class="em-registration"><div><strong>${esc(x.email||x.user_id)}</strong><small>${esc(x.registered_at||'')}</small></div><select data-registration="${x.id}" data-event="${id}">${['registered','waitlisted','cancelled','attended','no_show'].map(s=>`<option value="${s}" ${x.status===s?'selected':''}>${label(s)}</option>`).join('')}</select></div>`).join(''):'<div class="nl-admin-empty">No registrations yet.</div>';regList.querySelectorAll('[data-registration]').forEach(s=>s.addEventListener('change',async()=>{try{await request(`/api/nurselink/admin/events/${s.dataset.event}/registrations/${s.dataset.registration}`,{method:'PATCH',body:JSON.stringify({status:s.value})});show('Registration status updated.','success');await load()}catch(e){show(e.message,'error')}}))}
    catch(e){regList.innerHTML=`<div class="nl-admin-empty">${esc(e.message)}</div>`}
  }

  form.addEventListener('submit',async e=>{e.preventDefault();show('');const id=$('eventId').value;try{const b=await request(id?`/api/nurselink/admin/events/${id}`:'/api/nurselink/admin/events',{method:id?'PATCH':'POST',body:JSON.stringify(payload())});show(b?.message||'Event saved.','success');reset();await load()}catch(err){show(err.message,'error')}});
  $('resetEvent').addEventListener('click',reset);$('refreshAdminEvents').addEventListener('click',load);$('closeRegistrations').addEventListener('click',()=>{regPanel.hidden=true});
  $('adminSignOut').addEventListener('click',async()=>{try{await request('/api/nurselink/admin/logout',{method:'POST',body:'{}'})}catch(_){}location.replace('/nurselink-admin-login.html')});
  (async()=>{try{const s=await request('/api/nurselink/admin/session');const d=s?.data||{};identity.innerHTML=`<span>${esc(d?.access?.label||'Administrator')}</span><strong>${esc(d?.user?.name||d?.user?.email||'NurseLink Staff')}</strong><small>${esc(d?.user?.email||'')}</small>`;await loadChapters();await load()}catch(e){if([401,403,419].includes(e.status)){adminLogin();return}show(e.message,'error')}})();
})();
