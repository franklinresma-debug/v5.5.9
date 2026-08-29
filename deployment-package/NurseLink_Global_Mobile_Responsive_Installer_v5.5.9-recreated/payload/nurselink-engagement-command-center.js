(() => {
const API='https://api.amsertech.com',$=id=>document.getElementById(id),notice=$('engagementAdminNotice'),identity=$('adminIdentity');
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const cookie=n=>{const p=`${n}=`;const r=document.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(p));return r?r.slice(p.length):''};
async function csrf(){const r=await fetch(`${API}/sanctum/csrf-cookie`,{credentials:'include',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});if(!r.ok)throw new Error('Unable to initialize secure administrator request.')}
async function request(path,opt={}){const method=String(opt.method||'GET').toUpperCase(),mut=!['GET','HEAD','OPTIONS'].includes(method);if(mut)await csrf();const h={Accept:'application/json','X-Requested-With':'XMLHttpRequest',...(opt.headers||{})};if(mut){h['Content-Type']='application/json';const t=decodeURIComponent(cookie('XSRF-TOKEN'));if(t)h['X-XSRF-TOKEN']=t}const r=await fetch(`${API}${path}`,{...opt,method,credentials:'include',headers:h});let b=null;try{b=await r.json()}catch(_){}if(!r.ok){const e=new Error(b?.message||`Engagement Admin request failed (${r.status}).`);e.status=r.status;throw e}return b}
function show(m='',tone=''){notice.textContent=m;notice.hidden=!m;notice.dataset.tone=tone}
function login(){location.replace('/nurselink-admin-login.html?return=/nurselink-engagement-command-center.html')}
function stat(label,value,detail){return `<div class="ec-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></div>`}
async function loadActivity(){
 const b=await request('/api/nurselink/admin/engagement/activity-summary?days=30'),d=b?.data||{},t=d.totals||{},rows=Array.isArray(d.daily)?d.daily:[];
 $('engagementActivitySummary').innerHTML=[
  stat('New Chapter Records',t.chapters||0,'30-day period'),
  stat('Event Registrations',t.events||0,'30-day period'),
  stat('Mentoring Requests',t.mentoring||0,'30-day period'),
  stat('Benefit Requests',t.benefit_requests||0,'30-day period'),
  stat('Benefit Saves',t.benefit_saves||0,'30-day period')
 ].join('');
 $('engagementActivityTrend').innerHTML=rows.length?`<table class="ec-table"><thead><tr><th>Date</th><th>Chapters</th><th>Events</th><th>Mentoring</th><th>Benefit Requests</th><th>Benefit Saves</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.chapters||0)}</td><td>${esc(r.events||0)}</td><td>${esc(r.mentoring||0)}</td><td>${esc(r.benefit_requests||0)}</td><td>${esc(r.benefit_saves||0)}</td></tr>`).join('')}</tbody></table>`:'<div class="nl-admin-empty">No activity in this period.</div>';
}
async function load(){
 try{
  const b=await request('/api/nurselink/admin/engagement/summary'),d=b?.data||{},c=d.chapters||{},e=d.events||{},m=d.mentoring||{},bf=d.benefits||{};
  $('engagementAdminSummary').innerHTML=[
   stat('Active Chapters',c.active||0,`${c.pending_requests||0} pending join requests`),
   stat('Active Chapter Memberships',c.active_memberships||0,'Across all active chapters'),
   stat('Upcoming Published Events',e.published_upcoming||0,`${e.waitlisted||0} waitlisted`),
   stat('Event Attendance',e.attended||0,`${e.registrations||0} registered/attended records`),
   stat('Discoverable Mentoring Profiles',m.discoverable||0,`${m.profiles||0} total profiles`),
   stat('Active Mentoring',m.accepted_relationships||0,`${m.open_requests||0} open requests`),
   stat('Available Benefits',bf.published_available||0,`${bf.requested||0} member requests`),
   stat('Approved / Fulfilled Benefits',Number(bf.approved||0)+Number(bf.fulfilled||0),`${bf.fulfilled||0} fulfilled`)
  ].join('');
  $('ecChapters').textContent=`${c.active||0} active chapters · ${c.pending_requests||0} pending requests`;
  $('ecEvents').textContent=`${e.published_upcoming||0} upcoming · ${e.attended||0} attended records`;
  $('ecMentoring').textContent=`${m.discoverable||0} discoverable · ${m.accepted_relationships||0} active relationships`;
  $('ecBenefits').textContent=`${bf.published_available||0} available · ${bf.requested||0} requested · ${bf.fulfilled||0} fulfilled`;
  const rows=Array.isArray(d.chapter_activity)?d.chapter_activity:[];
  $('chapterActivity').innerHTML=rows.length?`<table class="ec-table"><thead><tr><th>Chapter</th><th>Region</th><th>Active Members</th><th>Pending</th><th>Upcoming Events</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.name)}</strong></td><td>${esc([r.region,r.country].filter(Boolean).join(', '))}</td><td>${esc(r.active_members)}</td><td>${esc(r.pending_requests)}</td><td>${esc(r.upcoming_events)}</td></tr>`).join('')}</tbody></table>`:'<div class="nl-admin-empty">No active chapter activity.</div>';
 }catch(e){if([401,403,419].includes(e.status)){login();return}show(e.message,'error')}
}
$('refreshEngagementAdmin').addEventListener('click',()=>Promise.all([load(),loadActivity()]));$('adminSignOut').addEventListener('click',async()=>{try{await request('/api/nurselink/admin/logout',{method:'POST',body:'{}'})}catch(_){}location.replace('/nurselink-admin-login.html')});
(async()=>{try{const s=await request('/api/nurselink/admin/session'),d=s?.data||{};identity.innerHTML=`<span>${esc(d?.access?.label||'Administrator')}</span><strong>${esc(d?.user?.name||d?.user?.email||'NurseLink Staff')}</strong><small>${esc(d?.user?.email||'')}</small>`;await Promise.all([load(),loadActivity()])}catch(e){if([401,403,419].includes(e.status)){login();return}show(e.message,'error')}})();
})();
