(() => {
  const API = 'https://api.amsertech.com';
  const root = document.getElementById('analyticsRoot');

  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  async function get(path) {
    const response = await fetch(`${API}${path}`, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    let payload = null;
    try { payload = await response.json(); } catch (_) {}

    if (!response.ok) {
      throw new Error(
        payload?.message
        || (response.status === 401
          ? 'Sign in to NurseLink first.'
          : response.status === 403
            ? 'NurseLink administrator access is required.'
            : `Request failed (${response.status}).`)
      );
    }

    return payload;
  }

  function percent(value) {
    return `${Number(value || 0).toFixed(1)}%`;
  }

  function max(rows, key) {
    return Math.max(1, ...rows.map(row => Number(row?.[key] || 0)));
  }

  function exportCsv(data) {
    const rows = [
      ['NurseLink Institutional Analytics'],
      ['Generated', data.generated_at || ''],
      [],
      ['Metric','Value'],
      ['Partner Organizations', data.summary?.partners_total ?? 0],
      ['Verified Partners', data.summary?.partners_verified ?? 0],
      ['Partner Opportunities', data.summary?.opportunities_total ?? 0],
      ['Active Opportunities', data.summary?.opportunities_active ?? 0],
      ['Applications', data.summary?.applications_total ?? 0],
      ['Interviews', data.summary?.interviews_total ?? 0],
      ['Offers', data.summary?.offers_total ?? 0],
      ['Enterprise Cohorts', data.summary?.enterprise_cohorts_total ?? 0],
      ['Active Enterprise Cohorts', data.summary?.enterprise_cohorts_active ?? 0],
      ['Enterprise Assignments', data.summary?.enterprise_assignments_total ?? 0],
      ['Active Enterprise Assignments', data.summary?.enterprise_assignments_active ?? 0],
      [],
      ['Organization','Type','Country','Status','Opportunities','Active Opportunities','Applications','Interviews','Offers','Interview Rate','Offer Rate','Enterprise Cohorts','Active Cohorts','Enterprise Assignments','Active Assignments'],
      ...(data.partners || []).map(row => [
        row.organization,
        row.organization_type,
        row.country,
        row.status,
        row.opportunities,
        row.active_opportunities,
        row.applications,
        row.interviews,
        row.offers,
        row.interview_rate,
        row.offer_rate,
        row.enterprise_cohorts,
        row.enterprise_active_cohorts,
        row.enterprise_assignments,
        row.enterprise_active_assignments
      ])
    ];

    const csv = rows.map(row => row.map(value => {
      const text = String(value ?? '');
      return /[",\n]/.test(text)
        ? `"${text.replaceAll('"', '""')}"`
        : text;
    }).join(',')).join('\n');

    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NurseLink_Institutional_Analytics_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function render(data) {
    const monthly = data.monthly || [];
    const monthlyMax = max(monthly, 'applications');

    root.innerHTML = `
      <section class="hero">
        <div>
          <span>NURSELINK ADMIN INTELLIGENCE</span>
          <h1>Institutional Analytics</h1>
          <p>Aggregate recruitment and enterprise cohort performance across NurseLink partner organizations.</p>
        </div>
        <button id="exportCsv" type="button">Export CSV</button>
      </section>

      <div class="kpis">
        ${[
          ['Partner Organizations', data.summary?.partners_total ?? 0],
          ['Verified Partners', data.summary?.partners_verified ?? 0],
          ['Partner Opportunities', data.summary?.opportunities_total ?? 0],
          ['Active Opportunities', data.summary?.opportunities_active ?? 0],
          ['Applications', data.summary?.applications_total ?? 0],
          ['Interviews', data.summary?.interviews_total ?? 0],
          ['Offers', data.summary?.offers_total ?? 0],
          ['Enterprise Cohorts', data.summary?.enterprise_cohorts_total ?? 0],
          ['Active Cohorts', data.summary?.enterprise_cohorts_active ?? 0],
          ['Enterprise Assignments', data.summary?.enterprise_assignments_total ?? 0],
          ['Active Assignments', data.summary?.enterprise_assignments_active ?? 0]
        ].map(([label,value]) => `
          <article><span>${esc(label)}</span><strong>${esc(value)}</strong></article>
        `).join('')}
      </div>

      <section class="panel">
        <div class="panel-title">
          <strong>12-Month Recruitment Trend</strong>
          <small>Applications, interviews and offers across institutional partners</small>
        </div>
        <div class="monthly">
          ${monthly.map(row => `
            <div class="month">
              <div class="bars">
                <i class="applications" style="height:${Math.max(2,(Number(row.applications||0)/monthlyMax)*100)}%"></i>
                <i class="interviews" style="height:${Math.max(2,(Number(row.interviews||0)/monthlyMax)*100)}%"></i>
                <i class="offers" style="height:${Math.max(2,(Number(row.offers||0)/monthlyMax)*100)}%"></i>
              </div>
              <span>${esc(String(row.month||'').slice(0,3))}</span>
            </div>
          `).join('')}
        </div>
        <div class="legend">
          <span><i class="applications"></i>Applications</span>
          <span><i class="interviews"></i>Interviews</span>
          <span><i class="offers"></i>Offers</span>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">
          <strong>Partner Organization Performance</strong>
          <small>Aggregate operational metrics; no candidate identities or private records.</small>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Status</th>
                <th>Opportunities</th>
                <th>Applications</th>
                <th>Interviews</th>
                <th>Offers</th>
                <th>Interview Rate</th>
                <th>Offer Rate</th>
                <th>Enterprise Cohorts</th>
                <th>Assignments</th>
              </tr>
            </thead>
            <tbody>
              ${(data.partners || []).map(row => `
                <tr>
                  <td><strong>${esc(row.organization)}</strong><small>${esc(row.country)}</small></td>
                  <td>${esc(row.status)}</td>
                  <td>${esc(row.opportunities)}</td>
                  <td>${esc(row.applications)}</td>
                  <td>${esc(row.interviews)}</td>
                  <td>${esc(row.offers)}</td>
                  <td>${esc(percent(row.interview_rate))}</td>
                  <td>${esc(percent(row.offer_rate))}</td>
                  <td>${esc(row.enterprise_cohorts || 0)}</td>
                  <td>${esc(row.enterprise_assignments || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>

      <div class="privacy">
        Aggregate analytics only. Candidate identities, contact information,
        addresses, credentials, uploaded documents, enterprise member identities
        and enterprise internal notes are excluded.
      </div>
    `;

    document.getElementById('exportCsv')
      ?.addEventListener('click', () => exportCsv(data));
  }

  async function boot() {
    try {
      const payload = await get('/api/reviewer/institutional-analytics?months=12');
      render(payload?.data || {});
    } catch (error) {
      root.innerHTML = `
        <section class="error">
          <div>NL</div>
          <strong>Institutional Analytics Access Required</strong>
          <p>${esc(error.message)}</p>
          <a href="/login?return=%2Fnurselink-institutional-analytics.html">Sign in</a>
        </section>
      `;
    }
  }

  boot();
})();
