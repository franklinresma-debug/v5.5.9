(() => {
  const API = 'https://api.amsertech.com';
  const root = document.getElementById('readinessRoot');
  const esc = value => String(value ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');

  const manualCases = [
    ['Authentication','Register a new applicant and verify email.'],
    ['Authentication','Sign in in a normal Chrome window and reach Dashboard.'],
    ['Authentication','Sign out and confirm protected data no longer loads.'],
    ['Applicant Journey','Complete Step 1 Personal Information.'],
    ['Applicant Journey','Complete Step 2 Professional Information.'],
    ['Applicant Journey','Create a Step 3 credential while membership is pending.'],
    ['Applicant Journey','Confirm applicant cannot self-verify a credential.'],
    ['Applicant Journey','Complete Step 4 Employment / OFW History.'],
    ['Applicant Journey','Upload Step 5 documents and refresh missing information.'],
    ['Applicant Journey','Review Step 6 and submit the membership application.'],
    ['Reviewer','Reviewer Center loads summary, credentials and applications.'],
    ['Reviewer','Reviewer verifies a credential and audit record is created.'],
    ['Reviewer','Reviewer requests additional membership information.'],
    ['Reviewer','Admin approves a ready membership application.'],
    ['Approved Member','Permanent member number is displayed after approval.'],
    ['Approved Member','Digital Member ID displays the member profile photo.'],
    ['Approved Member','Digital Member ID QR opens public verification.'],
    ['Approved Member','Portfolio, Career, Learning, Jobs and Applications unlock.'],
    ['Jobs','Save and unsave a verified job.'],
    ['Jobs','Submit a job application and view it in Applications.'],
    ['Partner','Verified partner opens Partner Portal without auth errors.'],
    ['Partner','Partner sees only applicants to its own opportunities.'],
    ['Partner','Partner sends a message and applicant receives notification.'],
    ['Partner','Partner schedules an interview and applicant responds.'],
    ['Analytics','Partner analytics loads and exports CSV.'],
    ['Analytics','Institutional Analytics opens for authorized staff.'],
    ['Public Privacy','Public profile exposes no credential number/contact data.'],
    ['Public Privacy','Invalid verification code exposes no member information.'],
    ['Responsive','Applicant portal works at mobile width without overflow.'],
    ['Responsive','Partner and Reviewer portals work on mobile/tablet widths.'],
    ['Operations','Run rollback drill on staging or a backup copy.'],
    ['Operations','Confirm a current database backup can be restored.'],
    ['Operations','Review Laravel logs for repeated 4xx/5xx after UAT.'],
    ['Operations','Confirm Network panel has no request storms/unexpected failures.']
  ];

  let automatedData = null;

  async function requestReadiness() {
    const response = await fetch(`${API}/api/reviewer/production-readiness`, {
      credentials:'include',
      headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}
    });

    let payload = null;
    try { payload = await response.json(); } catch (_) {}

    if (!response.ok) {
      throw new Error(payload?.message || (
        response.status === 401 ? 'Sign in to NurseLink first.' :
        response.status === 403 ? 'Reviewer or administrator access is required.' :
        `Readiness request failed (${response.status}).`
      ));
    }
    return payload?.data || {};
  }

  const statusLabel = value =>
    value === 'ready_for_uat' ? 'READY FOR UAT' :
    value === 'ready_with_warnings' ? 'READY WITH WARNINGS' : 'BLOCKED';

  function render(data) {
    automatedData = data;
    const checks = Array.isArray(data.checks) ? data.checks : [];
    const critical = checks.filter(x => x.severity === 'critical');
    const advisory = checks.filter(x => x.severity !== 'critical');

    const groups = manualCases.reduce((o,row,i) => {
      (o[row[0]] ||= []).push({index:i,text:row[1]});
      return o;
    }, {});

    const checksHtml = rows => rows.map(row => `
      <article class="check ${esc(row.status)}">
        <div class="check-icon">${row.status === 'pass' ? '✓' : '!'}</div>
        <div><strong>${esc(row.label)}</strong><small>${esc(row.description)}</small></div>
        <span>${esc(String(row.status).toUpperCase())}</span>
      </article>`).join('');

    root.innerHTML = `
      <section class="hero ${esc(data.status || 'blocked')}">
        <div><span>NURSELINK RELEASE v${esc(data.release || '3.2.0')}</span><h1>Production UAT Center</h1><p>Automated infrastructure checks plus a formal end-to-end acceptance checklist before production sign-off.</p></div>
        <div class="score"><strong>${esc(data.score ?? 0)}%</strong><span>${esc(statusLabel(data.status))}</span></div>
      </section>

      <div class="summary">
        ${[
          ['Automated Checks',data.summary?.total_checks ?? 0],
          ['Passed',data.summary?.passed ?? 0],
          ['Critical Blockers',data.summary?.critical_blockers ?? 0],
          ['Warnings',data.summary?.warnings ?? 0],
          ['Active Reviewers',data.counts?.active_reviewers ?? '—'],
          ['Approved Members',data.counts?.approved_memberships ?? '—'],
          ['Verified Partners',data.counts?.verified_partner_organizations ?? '—']
        ].map(([a,b])=>`<article><span>${esc(a)}</span><strong>${esc(b)}</strong></article>`).join('')}
      </div>

      <section class="panel">
        <div class="panel-head"><div><span>AUTOMATED RELEASE CHECKS</span><h2>Infrastructure & Configuration</h2><p>Pass/fail only. Secret values and personal data are not returned.</p></div><button id="rerun">Run Again</button></div>
        <h3>Critical</h3><div class="check-list">${checksHtml(critical)}</div>
        <h3>Advisory</h3><div class="check-list">${checksHtml(advisory)}</div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><span>MANUAL ACCEPTANCE TESTING</span><h2>End-to-End UAT Checklist</h2><p>Check each case only after live manual verification.</p></div><div class="counter"><strong id="done">0</strong><span>/ ${manualCases.length}</span></div></div>
        <div class="uat-groups">
          ${Object.entries(groups).map(([group,rows])=>`
            <section class="uat-group"><h3>${esc(group)}</h3>
              ${rows.map(r=>`<label class="uat-case"><input type="checkbox" data-uat="${r.index}"><span><strong>${esc(r.text)}</strong><small>Manual verification required</small></span></label>`).join('')}
            </section>`).join('')}
        </div>

        <div class="signoff">
          <label><span>UAT Notes / Outstanding Issues</span><textarea id="notes" rows="5" placeholder="Record remaining issues, retest notes or release conditions."></textarea></label>
          <div><button id="export">Export UAT Report</button><button id="print">Print / Save PDF</button></div>
        </div>
      </section>

      <div class="privacy">Read-only UAT center. It does not modify memberships, credentials, applications, partner access or production configuration.</div>
    `;

    root.querySelectorAll('[data-uat]').forEach(el => el.addEventListener('change',updateCounter));
    document.getElementById('rerun')?.addEventListener('click',boot);
    document.getElementById('export')?.addEventListener('click',exportReport);
    document.getElementById('print')?.addEventListener('click',()=>window.print());
    updateCounter();
  }

  function updateCounter() {
    const n = root.querySelectorAll('[data-uat]:checked').length;
    const out = document.getElementById('done');
    if (out) out.textContent = String(n);
  }

  function exportReport() {
    if (!automatedData) return;
    const manual = manualCases.map((row,i)=>({
      category:row[0], test:row[1],
      passed:!!root.querySelector(`[data-uat="${i}"]`)?.checked
    }));
    const report = {
      product:'KAPIT-BISIG NurseLink',
      release:automatedData.release || '3.2.0',
      generated_at:new Date().toISOString(),
      automated:automatedData,
      manual_uat:manual,
      manual_summary:{
        total:manual.length,
        passed:manual.filter(x=>x.passed).length,
        remaining:manual.filter(x=>!x.passed).length
      },
      notes:document.getElementById('notes')?.value || ''
    };
    const blob = new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url;
    a.download=`NurseLink_UAT_Report_v${report.release}_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),0);
  }

  async function boot() {
    root.innerHTML='<section class="loading"><div class="spinner"></div><strong>Running production readiness checks…</strong><small>No secrets or personal member data are included.</small></section>';
    try { render(await requestReadiness()); }
    catch (error) {
      root.innerHTML=`<section class="error"><div>NL</div><strong>Production Readiness Access Required</strong><p>${esc(error.message)}</p><a href="/login?return=%2Fnurselink-production-readiness.html">Sign in</a></section>`;
    }
  }
  boot();
})();
