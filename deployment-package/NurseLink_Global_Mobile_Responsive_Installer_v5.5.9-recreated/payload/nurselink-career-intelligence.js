(() => {
  const API = 'https://api.amsertech.com';
  const root = document.getElementById('careerIntelligenceRoot');
  const notice = document.getElementById('notice');
  const refreshButton = document.getElementById('refreshButton');
  const snapshotButton = document.getElementById('snapshotButton');

  const esc = value => String(value ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');

  function cookie(name) {
    const prefix = `${name}=`;
    const hit = document.cookie.split(';').map(v => v.trim()).find(v => v.startsWith(prefix));
    return hit ? hit.slice(prefix.length) : '';
  }

  async function csrf() {
    await fetch(`${API}/sanctum/csrf-cookie`, {
      credentials:'include',
      headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}
    });
  }

  async function request(path, options={}) {
    const method = String(options.method || 'GET').toUpperCase();
    const mutating = !['GET','HEAD','OPTIONS'].includes(method);

    if (mutating) await csrf();

    const headers = {
      Accept:'application/json',
      'X-Requested-With':'XMLHttpRequest',
      ...(options.headers || {})
    };

    if (mutating) {
      headers['Content-Type']='application/json';
      const token = decodeURIComponent(cookie('XSRF-TOKEN'));
      if (token) headers['X-XSRF-TOKEN']=token;
    }

    const response = await fetch(`${API}${path}`, {
      ...options, method, headers, credentials:'include'
    });

    let payload=null;
    try { payload=await response.json(); } catch (_) {}

    if (!response.ok) {
      const error=new Error(payload?.message || `Request failed (${response.status})`);
      error.status=response.status;
      throw error;
    }

    return payload;
  }

  function message(text='') {
    notice.textContent=text;
    notice.hidden=!text;
  }

  function when(value) {
    if (!value) return '—';
    const date=new Date(value);
    return Number.isNaN(date.getTime()) ? esc(value) : esc(date.toLocaleString());
  }

  function scoreMetric(label,value,max) {
    const safe=Math.max(0,Math.min(max,Number(value || 0)));
    const pct=Math.round(safe/max*100);
    return `<div class="metric"><span>${esc(label)}</span><strong>${safe}/${max}</strong><div class="progress"><i style="width:${pct}%"></i></div></div>`;
  }

  function renderAccess(error) {
    const pending=error?.status===403;
    root.innerHTML=`
      <div class="access-card">
        <span class="eyebrow">${pending ? 'APPROVED MEMBERSHIP REQUIRED' : 'AUTHENTICATION REQUIRED'}</span>
        <h2>${pending ? 'Career Intelligence unlocks after membership approval' : 'Sign in to NurseLink'}</h2>
        <p>${pending
          ? 'Career Intelligence uses member-only career, credential, learning and employment data. Complete the membership process to unlock this feature.'
          : 'Sign in to your NurseLink account, then return to Career Intelligence.'}</p>
        <a href="/login?return=/nurselink-career-intelligence.html">Open NurseLink Sign In</a>
      </div>`;
  }

  function render(data, advisory) {
    const scores=data.scores || {};
    const limits=data.score_limits || {};
    const actions=Array.isArray(data.priority_actions)?data.priority_actions:[];
    const alerts=Array.isArray(data.credentials?.expiry_alerts)?data.credentials.expiry_alerts:[];
    const learning=Array.isArray(data.learning?.recommended_focus)?data.learning.recommended_focus:[];
    const jobs=Array.isArray(data.job_fit?.top_matches)?data.job_fit.top_matches:[];
    const checks=Array.isArray(data.mobility?.checks)?data.mobility.checks:[];
    const history=Array.isArray(data.history)?data.history:[];

    const actionHtml=actions.map(row=>`
      <div class="action-card">
        <span class="priority ${esc(row.priority)}">${esc(row.priority)} priority · ${esc(row.category)}</span>
        <strong>${esc(row.title)}</strong>
        <p>${esc(row.detail)}</p>
        ${row.action_url ? `<a class="action-link" href="${esc(row.action_url)}">Open →</a>` : ''}
      </div>`).join('');

    const credentialHtml=alerts.map(row=>`
      <div class="credential-card">
        <span class="state ${esc(row.status)}">${esc(row.status.replaceAll('_',' '))}</span>
        <strong>${esc(row.title || row.credential_type)}</strong>
        <p>${esc(row.issuing_body || '')}${row.expiry_date ? ` · expires ${esc(row.expiry_date)}` : ''}</p>
        <div class="tags">
          <span class="tag">${esc(row.verification_status)}</span>
          ${row.days_to_expiry !== null && row.days_to_expiry !== undefined ? `<span class="tag">${esc(row.days_to_expiry)} days</span>` : ''}
        </div>
      </div>`).join('');

    const learningHtml=learning.map(row=>`
      <div class="learning-card">
        <strong>${esc(row.title)}</strong>
        <p>${esc(row.reason)}</p>
        <a class="action-link" href="/learning">Review Learning Record →</a>
      </div>`).join('');

    const jobsHtml=jobs.map(job=>`
      <div class="job-card">
        <div class="job-card-head">
          <div><strong>${esc(job.title)}</strong><p>${esc(job.employer_name)} · ${esc(job.country)}</p></div>
          <div class="job-score">${esc(job.match_score)}%</div>
        </div>
        <div class="tags">${(job.match_reasons || []).slice(0,4).map(r=>`<span class="tag">${esc(r)}</span>`).join('')}</div>
        ${(job.match_gaps || []).length ? `<p style="margin-top:8px">Review: ${esc((job.match_gaps || []).slice(0,2).join(' · '))}</p>` : ''}
      </div>`).join('');

    const mobilityHtml=checks.map(check=>`
      <div class="mobility-card">
        <span class="state ${check.ready ? '' : 'renewal_window'}">${check.ready ? 'ready' : 'review'}</span>
        <strong>${esc(check.label)}</strong>
        <p>${check.ready ? 'Recorded in your NurseLink profile.' : 'Consider updating this item if it applies to your stated overseas career goal.'}</p>
      </div>`).join('');

    const historyRows=history.map(row=>`
      <tr>
        <td>${when(row.generated_at)}</td>
        <td><strong>${esc(row.overall_score)}</strong></td>
        <td>${esc(row.career_profile_score)}</td>
        <td>${esc(row.credential_score)}</td>
        <td>${esc(row.experience_score)}</td>
        <td>${esc(row.learning_score)}</td>
        <td>${esc(row.mobility_score)}</td>
        <td>${esc(row.market_alignment_score)}</td>
      </tr>`).join('');

    root.innerHTML=`
      <section class="hero">
        <div class="score-card">
          <div class="score">${esc(scores.overall || 0)}</div>
          <h2>${esc(data.readiness_label || 'Career Readiness')}</h2>
          <p>Explainable NurseLink career-planning indicator based on your recorded profile.</p>
          <span class="score-badge">Advisory indicator · 100 max</span>
        </div>
        <div class="metrics">
          ${scoreMetric('Career Profile',scores.career_profile,limits.career_profile || 20)}
          ${scoreMetric('Credentials',scores.credentials,limits.credentials || 20)}
          ${scoreMetric('Experience',scores.experience,limits.experience || 20)}
          ${scoreMetric('Learning',scores.learning,limits.learning || 15)}
          ${scoreMetric('Mobility',scores.mobility,limits.mobility || 15)}
          ${scoreMetric('Market Alignment',scores.market_alignment,limits.market_alignment || 10)}
        </div>
      </section>

      <section class="grid-two">
        <div class="panel">
          <div class="section-head"><h2>Priority Career Actions</h2><span class="muted">Top next steps</span></div>
          <div class="action-list">${actionHtml || '<div class="empty">No priority actions detected from your current NurseLink profile.</div>'}</div>
        </div>
        <div class="panel">
          <div class="section-head"><h2>Credential Expiry Forecast</h2><span class="muted">Next 180 days</span></div>
          <div class="credential-list">${credentialHtml || '<div class="empty">No expiry alerts detected within the forecast window.</div>'}</div>
        </div>
      </section>

      <section class="grid-two">
        <div class="panel">
          <div class="section-head"><h2>Suggested Learning Focus</h2><span class="muted">${esc(data.learning?.completed_hours || 0)} completed hours recorded</span></div>
          <div class="learning-list">${learningHtml || '<div class="empty">Your recorded learning already covers the current NurseLink developmental focus set.</div>'}</div>
        </div>
        <div class="panel">
          <div class="section-head"><h2>Mobility Readiness</h2><span class="muted">${esc(scores.mobility || 0)}/${esc(limits.mobility || 15)}</span></div>
          <div class="mobility-list">${mobilityHtml || `<div class="empty">${esc(data.mobility?.note || 'No overseas mobility assessment required for your current career preference.')}</div>`}</div>
        </div>
      </section>

      <section class="panel" style="margin-top:14px">
        <div class="section-head"><h2>Explainable Job Fit</h2><a class="action-link" href="/jobs">View All Jobs →</a></div>
        <div class="job-list">${jobsHtml || '<div class="empty">No active opportunities are currently available for Career Intelligence ranking.</div>'}</div>
      </section>

      <section class="panel history">
        <div class="section-head"><h2>Readiness History</h2><span class="muted">Latest 24 saved snapshots</span></div>
        ${historyRows ? `<div class="table-wrap"><table class="ci-table"><thead><tr><th>Saved</th><th>Overall</th><th>Career</th><th>Cred.</th><th>Exp.</th><th>Learning</th><th>Mobility</th><th>Market</th></tr></thead><tbody>${historyRows}</tbody></table></div>` : '<div class="empty">No saved Career Intelligence snapshots yet.</div>'}
      </section>

      <div class="disclaimer">
        ${esc(advisory?.message || 'NurseLink Career Intelligence is advisory only.')}
        Match scores, learning suggestions, mobility indicators and credential forecasts do not guarantee hiring, licensing, visa, immigration, deployment, specialty recognition or CPD approval.
      </div>
    `;
  }

  async function load() {
    try {
      await request('/api/me');
      const payload=await request('/api/career-intelligence');
      render(payload.data || {},payload.advisory || {});
    } catch (error) {
      if ([401,403,419].includes(error.status)) renderAccess(error);
      else root.innerHTML=`<div class="panel"><strong>Career Intelligence unavailable</strong><p>${esc(error.message)}</p></div>`;
    }
  }

  refreshButton?.addEventListener('click',()=>{message('');load();});

  snapshotButton?.addEventListener('click',async()=>{
    try {
      snapshotButton.disabled=true;
      message('Saving Career Intelligence snapshot…');
      await request('/api/career-intelligence/snapshot',{method:'POST',body:'{}'});
      message('Snapshot saved.');
      await load();
    } catch (error) {
      message(error.message);
    } finally {
      snapshotButton.disabled=false;
    }
  });

  load();
})();
