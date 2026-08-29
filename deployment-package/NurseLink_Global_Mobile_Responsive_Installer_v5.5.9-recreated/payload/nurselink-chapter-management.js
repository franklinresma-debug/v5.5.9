(() => {
  const API='https://api.amsertech.com';
  const $=id=>document.getElementById(id);
  const notice=$('chapterAdminNotice'),identity=$('adminIdentity'),form=$('chapterForm'),list=$('chapterAdminList'),rosterPanel=$('chapterRosterPanel'),roster=$('chapterRoster'),rosterTitle=$('chapterRosterTitle');
  let rows=[];

  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const label=v=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const cookie=n=>{const p=`${n}=`;const r=document.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(p));return r?r.slice(p.length):''};
  async function csrf(){const r=await fetch(`${API}/sanctum/csrf-cookie`,{credentials:'include',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});if(!r.ok)throw new Error('Unable to initialize secure administrator request.')}
  async function request(path,options={}){
    const method=String(options.method||'GET').toUpperCase(),mutating=!['GET','HEAD','OPTIONS'].includes(method);
    if(mutating)await csrf();
    const headers={Accept:'application/json','X-Requested-With':'XMLHttpRequest',...(options.headers||{})};
    if(mutating){headers['Content-Type']='application/json';const t=decodeURIComponent(cookie('XSRF-TOKEN'));if(t)headers['X-XSRF-TOKEN']=t}
    const r=await fetch(`${API}${path}`,{...options,method,credentials:'include',headers});let body=null;try{body=await r.json()}catch(_){}
    if(!r.ok){const e=new Error(body?.message||`Chapter Management request failed (${r.status}).`);e.status=r.status;throw e}return body;
  }
  function show(m='',tone=''){notice.textContent=m;notice.hidden=!m;notice.dataset.tone=tone}
  function login(){location.replace('/nurselink-admin-login.html?return=/nurselink-chapter-management.html')}
  function data(){
    return {name:$('chapterName').value.trim(),chapter_type:$('chapterType').value,region:$('chapterRegion').value.trim()||null,country:$('chapterCountry').value.trim(),city:$('chapterCity').value.trim()||null,description:$('chapterDescription').value.trim()||null,contact_email:$('chapterEmail').value.trim()||null,status:$('chapterStatus').value,member_join_enabled:$('chapterJoinEnabled').checked};
  }
  function reset(){form.reset();$('chapterId').value='';$('chapterCountry').value='Philippines';$('chapterType').value='regional';$('chapterStatus').value='draft';$('chapterJoinEnabled').checked=true}
  function edit(r){$('chapterId').value=r.id;$('chapterName').value=r.name||'';$('chapterType').value=r.chapter_type;$('chapterRegion').value=r.region||'';$('chapterCountry').value=r.country||'Philippines';$('chapterCity').value=r.city||'';$('chapterDescription').value=r.description||'';$('chapterEmail').value=r.contact_email||'';$('chapterStatus').value=r.status;$('chapterJoinEnabled').checked=!!r.member_join_enabled;window.scrollTo({top:0,behavior:'smooth'})}
  function render(){
    if(!rows.length){list.innerHTML='<div class="nl-admin-empty">No chapters created yet.</div>';return}
    list.innerHTML=rows.map(r=>{const c=r.membership_counts||{};return `<article class="cm-item"><div><span>${esc(label(r.chapter_type))}</span><strong>${esc(r.name)}</strong><small>${esc([r.region,r.city,r.country].filter(Boolean).join(' · '))}</small></div><div class="cm-counts"><span data-status="${esc(r.status)}">${esc(label(r.status))}</span><small>${esc(c.active||0)} active · ${esc(c.pending||0)} pending</small></div><div class="cm-item-actions"><button data-edit="${r.id}">Edit</button><button data-roster="${r.id}">Roster</button></div></article>`}).join('');
    list.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>edit(rows.find(r=>String(r.id)===b.dataset.edit))));
    list.querySelectorAll('[data-roster]').forEach(b=>b.addEventListener('click',()=>loadRoster(b.dataset.roster)));
  }
  async function load(){list.innerHTML='<div class="nl-admin-loading">Loading chapters…</div>';try{const b=await request('/api/nurselink/admin/chapters');rows=Array.isArray(b?.data)?b.data:[];render()}catch(e){if([401,403,419].includes(e.status)){login();return}list.innerHTML=`<div class="nl-admin-empty">${esc(e.message)}</div>`}}
  async function loadRoster(id){
    rosterPanel.hidden=false;roster.innerHTML='<div class="nl-admin-loading">Loading chapter roster…</div>';
    try{const b=await request(`/api/nurselink/admin/chapters/${id}/members`);rosterTitle.textContent=b?.chapter?.name||'Chapter roster';const r=Array.isArray(b?.data)?b.data:[];roster.innerHTML=r.length?r.map(x=>`<article class="cm-member"><div><strong>${esc(x.email||x.user_id)}</strong><small>Requested ${esc(x.requested_at||'—')}</small></div><div class="cm-member-controls"><select data-status="${x.id}">${['pending','active','declined','inactive'].map(s=>`<option value="${s}" ${x.status===s?'selected':''}>${label(s)}</option>`).join('')}</select><select data-role="${x.id}">${['member','officer','coordinator'].map(s=>`<option value="${s}" ${x.chapter_role===s?'selected':''}>${label(s)}</option>`).join('')}</select><label><input type="checkbox" data-primary="${x.id}" ${x.is_primary?'checked':''}> Primary</label><button data-save-member="${x.id}" data-chapter="${id}">Save</button></div></article>`).join(''):'<div class="nl-admin-empty">No chapter membership records yet.</div>';bindRoster()}
    catch(e){roster.innerHTML=`<div class="nl-admin-empty">${esc(e.message)}</div>`}
  }
  function bindRoster(){
    roster.querySelectorAll('[data-save-member]').forEach(b=>b.addEventListener('click',async()=>{const id=b.dataset.saveMember,ch=b.dataset.chapter,status=roster.querySelector(`[data-status="${id}"]`).value,role=roster.querySelector(`[data-role="${id}"]`).value,primary=roster.querySelector(`[data-primary="${id}"]`).checked;b.disabled=true;try{const r=await request(`/api/nurselink/admin/chapters/${ch}/members/${id}`,{method:'PATCH',body:JSON.stringify({status,chapter_role:role,is_primary:primary,notes:null})});show(r?.message||'Chapter membership updated.','success');await Promise.all([load(),loadRoster(ch)])}catch(e){show(e.message,'error');b.disabled=false}}))
  }

  form.addEventListener('submit',async e=>{e.preventDefault();show('');const id=$('chapterId').value;try{const b=await request(id?`/api/nurselink/admin/chapters/${id}`:'/api/nurselink/admin/chapters',{method:id?'PATCH':'POST',body:JSON.stringify(data())});show(b?.message||'Chapter saved.','success');reset();await load()}catch(e){show(e.message,'error')}});
  $('resetChapter').addEventListener('click',reset);$('refreshChaptersAdmin').addEventListener('click',load);$('closeRoster').addEventListener('click',()=>{rosterPanel.hidden=true});
  $('adminSignOut').addEventListener('click',async()=>{try{await request('/api/nurselink/admin/logout',{method:'POST',body:'{}'})}catch(_){}location.replace('/nurselink-admin-login.html')});
  (async()=>{try{const s=await request('/api/nurselink/admin/session');const d=s?.data||{};identity.innerHTML=`<span>${esc(d?.access?.label||'Administrator')}</span><strong>${esc(d?.user?.name||d?.user?.email||'NurseLink Staff')}</strong><small>${esc(d?.user?.email||'')}</small>`;await load()}catch(e){if([401,403,419].includes(e.status)){login();return}show(e.message,'error')}})();
})();
