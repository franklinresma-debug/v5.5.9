(() => {
const API='https://api.amsertech.com',$=id=>document.getElementById(id),notice=$('engagementNotice');
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
async function request(path){const r=await fetch(`${API}${path}`,{credentials:'include',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});let b=null;try{b=await r.json()}catch(_){}if(!r.ok){const e=new Error(b?.message||`Engagement request failed (${r.status}).`);e.status=r.status;throw e}return b}
function show(m='',tone=''){notice.textContent=m;notice.hidden=!m;notice.dataset.tone=tone}
function card(label,value,detail,state){return `<div class="eg-stat" data-state="${esc(state)}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></div>`}
function timelineItem(x){
 return `<a class="eg-timeline-item" href="${esc(x.url||'/nurselink-engagement.html')}"><span>${esc(String(x.module||'activity').toUpperCase())} · ${esc(x.status||'')}</span><strong>${esc(x.title||'NurseLink activity')}</strong><small>${esc(x.detail||'')}${x.occurred_at?` · ${esc(new Date(x.occurred_at).toLocaleString())}`:''}</small></a>`;
}
async function loadTimeline(){
 try{
  const b=await request('/api/engagement/timeline?limit=40'),rows=Array.isArray(b?.data)?b.data:[];
  $('engagementTimeline').innerHTML=rows.length?rows.map(timelineItem).join(''):'<div class="eg-complete"><strong>No recent engagement activity yet.</strong><span>Your chapter, event, mentoring and benefit activity will appear here.</span></div>';
 }catch(e){
  $('engagementTimeline').innerHTML='<div class="eg-loading">Recent activity unavailable.</div>';
 }
}
async function load(){
  $('engagementSummary').innerHTML='<div class="eg-loading">Loading engagement summary…</div>';show('');
  try{
    const b=await request('/api/engagement'),d=b?.data||{},c=d.chapters||{},e=d.events||{},m=d.mentoring||{},bf=d.benefits||{};
    $('engagementSummary').innerHTML=[
      card('Active Chapters',c.active||0,c.primary?.name?`Primary: ${c.primary.name}`:`${c.pending||0} pending`,'chapters'),
      card('Upcoming Events',e.upcoming_registered||0,e.next_event?.title?`Next: ${e.next_event.title}`:`${e.waitlisted||0} waitlisted`,'events'),
      card('Mentoring',m.active_relationships||0,m.profile_configured?(m.discoverable?'Profile discoverable':'Profile private'):'Profile not configured','mentoring'),
      card('Available Benefits',bf.available||0,`${bf.requested||0} requested · ${bf.approved||0} approved`,'benefits'),
      card('Completed Participation',Number(e.attended||0)+Number(m.completed_relationships||0)+Number(bf.fulfilled||0),'Attendance + mentoring + fulfilled benefit requests','completed')
    ].join('');
    $('chapterDetail').textContent=c.primary?.name?`${c.active||0} active chapter(s) · Primary: ${c.primary.name}`:`${c.active||0} active · ${c.pending||0} pending`;
    $('eventDetail').textContent=e.next_event?.title?`${e.upcoming_registered||0} upcoming · Next: ${e.next_event.title}`:`${e.upcoming_registered||0} upcoming registrations · ${e.waitlisted||0} waitlisted`;
    $('mentorDetail').textContent=m.profile_configured?`${m.active_relationships||0} active · ${m.pending_requests||0} pending request(s)`:'Set up your mentoring preferences';
    $('benefitDetail').textContent=`${bf.available||0} available · ${bf.saved||0} saved · ${bf.ending_within_30_days||0} ending soon · ${bf.approved||0} approved`;
    const actions=Array.isArray(d.recommended_actions)?d.recommended_actions:[];
    $('engagementActions').innerHTML=actions.length?actions.map(a=>`<a href="${esc(a.url)}" class="eg-action"><span>${esc(a.priority||'recommended')}</span><strong>${esc(a.title)}</strong><small>${esc(a.message)}</small></a>`).join(''):'<div class="eg-complete"><strong>Your engagement basics are set up.</strong><span>Continue participating through chapters, events and mentoring as useful to your goals.</span></div>';
  }catch(e){
    if([401,403,419].includes(e.status)){location.replace('/login?return=/nurselink-engagement.html');return}
    $('engagementSummary').innerHTML='<div class="eg-loading">Engagement summary unavailable.</div>';show(e.message,'error');
  }
}
$('refreshEngagement').addEventListener('click',()=>Promise.all([load(),loadTimeline()]));Promise.all([load(),loadTimeline()]);
})();
