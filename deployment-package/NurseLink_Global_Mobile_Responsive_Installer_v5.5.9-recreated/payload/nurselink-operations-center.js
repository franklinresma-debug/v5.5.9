(() => {
  const API = 'https://api.amsertech.com';
  const root = document.getElementById('operationsRoot');
  const notice = document.getElementById('statusMessage');
  const refreshButton = document.getElementById('refreshButton');
  const snapshotButton = document.getElementById('snapshotButton');

  const esc = value => String(value ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');

  function getCookie(name) {
    const prefix = `${name}=`;
    const part = document.cookie.split(';').map(v => v.trim()).find(v => v.startsWith(prefix));
    return part ? part.slice(prefix.length) : '';
  }

  async function csrf() {
    await fetch(`${API}/sanctum/csrf-cookie`, {
      credentials: 'include',
      headers: {Accept:'application/json','X-Requested-With':'XMLHttpRequest'}
    });
  }

  async function request(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const mutating = !['GET','HEAD','OPTIONS'].includes(method);

    if (mutating) await csrf();

    const headers = {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.headers || {})
    };

    if (mutating) {
      headers['Content-Type'] = 'application/json';
      const token = decodeURIComponent(getCookie('XSRF-TOKEN'));
      if (token) headers['X-XSRF-TOKEN'] = token;
    }

    const response = await fetch(`${API}${path}`, {
      ...options, method, headers, credentials:'include'
    });

    let payload = null;
    try { payload = await response.json(); } catch (_) {}

    if (!response.ok) {
      const error = new Error(payload?.message || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  function message(text='') {
    notice.textContent = text;
    notice.hidden = !text;
  }

  function fmt(value, suffix='') {
    return value === null || value === undefined || value === '' ? '—' : `${value}${suffix}`;
  }

  function when(value) {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? esc(value) : esc(d.toLocaleString());
  }

  function metric(label, value) {
    return `<div class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function renderAccess(error) {
    root.innerHTML = `
      <div class="access-card">
        <span class="eyebrow">${error?.status === 403 ? 'STAFF ACCESS REQUIRED' : 'AUTHENTICATION REQUIRED'}</span>
        <h2>${error?.status === 403 ? 'Operations Center is restricted' : 'Sign in to NurseLink'}</h2>
        <p>${error?.status === 403
          ? 'Only authorized NurseLink reviewers and administrators can access production operations data.'
          : 'Sign in to NurseLink, then return to this page.'}</p>
        <a href="/login?return=/nurselink-operations-center.html">Open NurseLink Sign In</a>
      </div>`;
  }

  function render(data) {
    const current = data.current || {};
    const summary = data.summary || {};
    const history = Array.isArray(data.history) ? data.history : [];
    const incidents = Array.isArray(data.incidents) ? data.incidents : [];
    const deployments = Array.isArray(data.deployments) ? data.deployments : [];
    const warnings = Array.isArray(current.warning_keys) ? current.warning_keys : [];

    const snapshots = history.map(row => `
      <tr>
        <td>${when(row.captured_at)}</td>
        <td><span class="pill ${esc(row.status)}">${esc(row.status)}</span></td>
        <td>${esc(fmt(row.database_latency_ms,' ms'))}</td>
        <td>${esc(fmt(row.disk_free_percent,'%'))}</td>
        <td>${esc(fmt(row.backup_age_hours,' h'))}</td>
        <td>${esc(fmt(row.recent_log_error_count))}</td>
      </tr>`).join('');

    const deploymentRows = deployments.map(row => `
      <tr>
        <td>${when(row.deployed_at)}</td>
        <td><strong>${esc(row.release)}</strong></td>
        <td>${esc(row.stage)}</td>
        <td>${esc(row.backup_label || '—')}</td>
      </tr>`).join('');

    const incidentRows = incidents.map(row => `
      <tr>
        <td><span class="severity ${esc(row.severity)}">${esc(row.severity)}</span>
          <div class="incident-title">${esc(row.title)}</div>
          <div class="muted">${esc(row.description || '')}</div>
        </td>
        <td>${esc(row.status)}</td>
        <td>${when(row.created_at)}</td>
        <td>${row.status !== 'resolved'
          ? `<button class="incident-action" data-resolve="${Number(row.id)}">Resolve</button>`
          : '<span class="muted">Resolved</span>'}</td>
      </tr>`).join('');

    root.innerHTML = `
      <section class="hero">
        <div class="summary-card">
          <span class="pill ${esc(current.status || 'warning')}">${esc(current.status || 'unknown')}</span>
          <h2>NurseLink Production</h2>
          <p>Release ${esc(data.release || '5.5.2')} · checked ${when(current.checked_at)}</p>
          <p class="muted">${warnings.length ? `Review: ${warnings.map(esc).join(', ')}` : 'No active health warnings detected.'}</p>
        </div>
        <div class="metrics">
          ${metric('DB latency',fmt(current.database_latency_ms,' ms'))}
          ${metric('Disk free',fmt(current.disk_free_percent,'%'))}
          ${metric('Backup age',fmt(current.backup_age_hours,' h'))}
          ${metric('Log errors',fmt(current.recent_log_error_count))}
          ${metric('Open incidents',fmt(summary.open_incidents))}
          ${metric('Critical incidents',fmt(summary.critical_incidents))}
          ${metric('Snapshots / 24h',fmt(summary.snapshots_24h))}
          ${metric('Deployments / 30d',fmt(summary.deployments_30d))}
        </div>
      </section>

      <section class="grid-two">
        <div class="panel">
          <div class="panel-head"><h2>Health History</h2><span class="muted">Latest 60 snapshots</span></div>
          ${snapshots ? `<div class="table-wrap"><table class="ops-table"><thead><tr><th>Captured</th><th>Status</th><th>DB</th><th>Disk</th><th>Backup</th><th>Errors</th></tr></thead><tbody>${snapshots}</tbody></table></div>` : '<div class="empty">No health snapshots yet.</div>'}
        </div>
        <div class="panel">
          <div class="panel-head"><h2>Deployment History</h2><span class="muted">Production releases</span></div>
          ${deploymentRows ? `<div class="table-wrap"><table class="ops-table"><thead><tr><th>Deployed</th><th>Release</th><th>Stage</th><th>Backup</th></tr></thead><tbody>${deploymentRows}</tbody></table></div>` : '<div class="empty">No deployment records yet.</div>'}
        </div>
      </section>

      <section class="panel" style="margin-top:14px">
        <div class="panel-head"><h2>Incident Register</h2><span class="muted">Operational incidents only. Do not enter member personal data.</span></div>
        <form id="incidentForm" class="incident-form">
          <select name="severity"><option value="warning">Warning</option><option value="critical">Critical</option><option value="info">Info</option></select>
          <input name="title" maxlength="160" required placeholder="Incident title">
          <textarea name="description" maxlength="2000" placeholder="Operational description. Do not include member personal data."></textarea>
          <button class="primary" type="submit">Record Incident</button>
        </form>
        ${incidentRows ? `<div class="table-wrap"><table class="ops-table"><thead><tr><th>Incident</th><th>Status</th><th>Opened</th><th>Action</th></tr></thead><tbody>${incidentRows}</tbody></table></div>` : '<div class="empty">No incidents recorded.</div>'}
      </section>`;

    root.querySelector('#incidentForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try {
        message('Recording incident…');
        await request('/api/reviewer/operations-center/incidents', {
          method:'POST',
          body:JSON.stringify({
            severity:form.get('severity'),
            title:form.get('title'),
            description:form.get('description'),
            source:'operations-center'
          })
        });
        message('Incident recorded.');
        await load();
      } catch (error) { message(error.message); }
    });

    root.querySelectorAll('[data-resolve]').forEach(button => {
      button.addEventListener('click', async () => {
        try {
          message('Resolving incident…');
          await request(`/api/reviewer/operations-center/incidents/${button.dataset.resolve}`, {
            method:'PATCH',
            body:JSON.stringify({status:'resolved'})
          });
          message('Incident resolved.');
          await load();
        } catch (error) { message(error.message); }
      });
    });
  }

  async function load() {
    try {
      await request('/api/me');
      const payload = await request('/api/reviewer/operations-center');
      render(payload.data || {});
    } catch (error) {
      if ([401,403,419].includes(error.status)) renderAccess(error);
      else root.innerHTML = `<div class="panel"><strong>Operations Center unavailable</strong><p>${esc(error.message)}</p></div>`;
    }
  }

  refreshButton?.addEventListener('click', () => { message(''); load(); });
  snapshotButton?.addEventListener('click', async () => {
    try {
      snapshotButton.disabled = true;
      message('Capturing production health snapshot…');
      await request('/api/reviewer/operations-center/snapshot', {method:'POST', body:'{}'});
      message('Health snapshot captured.');
      await load();
    } catch (error) { message(error.message); }
    finally { snapshotButton.disabled = false; }
  });

  load();
})();
