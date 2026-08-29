(() => {
  const API = 'https://api.amsertech.com';

  const identityEl = document.getElementById('adminIdentity');
  const summaryEl = document.getElementById('complianceSummary');
  const areaEl = document.getElementById('complianceArea');
  const noticeEl = document.getElementById('complianceNotice');
  const searchEl = document.getElementById('complianceSearch');
  const expiryEl = document.getElementById('expiryStateFilter');
  const workflowEl = document.getElementById('workflowFilter');
  const refreshEl = document.getElementById('refreshCompliance');
  const exportEl = document.getElementById('exportCompliance');
  const signOutEl = document.getElementById('adminSignOut');

  let rows = [];
  let searchTimer = null;

  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function cookie(name) {
    const prefix = `${name}=`;
    const row = document.cookie
      .split(';')
      .map(value => value.trim())
      .find(value => value.startsWith(prefix));
    return row ? row.slice(prefix.length) : '';
  }

  async function csrf() {
    const response = await fetch(`${API}/sanctum/csrf-cookie`, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!response.ok) {
      throw new Error('Unable to initialize secure administrator request.');
    }
  }

  async function request(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);

    if (mutating) await csrf();

    const headers = {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.headers || {})
    };

    if (mutating) {
      headers['Content-Type'] = 'application/json';
      const token = decodeURIComponent(cookie('XSRF-TOKEN'));
      if (token) headers['X-XSRF-TOKEN'] = token;
    }

    const response = await fetch(`${API}${path}`, {
      ...options,
      method,
      credentials: 'include',
      headers
    });

    let payload = null;
    try { payload = await response.json(); } catch (_) {}

    if (!response.ok) {
      const error = new Error(
        payload?.message || `Credential Compliance request failed (${response.status}).`
      );
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  function notice(message = '', tone = '') {
    noticeEl.textContent = message;
    noticeEl.hidden = !message;
    noticeEl.dataset.tone = tone;
  }

  function redirectToAdminLogin() {
    window.location.replace(
      '/nurselink-admin-login.html?return=/nurselink-credential-compliance.html'
    );
  }

  function renderIdentity(data) {
    const user = data?.user || {};
    const access = data?.access || {};

    identityEl.innerHTML = `
      <span>${esc(access.label || 'Administrator')}</span>
      <strong>${esc(user.name || user.email || 'NurseLink Staff')}</strong>
      <small>${esc(user.email || '')}</small>
    `;
  }

  function renderSummary(data = {}) {
    const expiry = data.summary || {};
    const workflow = data.workflow || {};

    const cards = [
      ['Expired', expiry.expired || 0, 'expired'],
      ['≤ 30 Days', expiry.critical_30 || 0, 'critical'],
      ['31–90 Days', expiry.due_90 || 0, 'due'],
      ['91–180 Days', expiry.upcoming_180 || 0, 'planning'],
      ['Submitted Workflows', workflow.submitted || 0, 'submitted'],
      ['Returned', workflow.returned || 0, 'returned'],
      ['Completed', workflow.completed || 0, 'completed']
    ];

    summaryEl.innerHTML = cards.map(([label, value, state]) => `
      <div class="nl-compliance-summary-card" data-state="${esc(state)}">
        <span>${esc(label)}</span>
        <strong>${esc(value)}</strong>
      </div>
    `).join('');
  }

  function workflowLabel(row) {
    return row.renewal?.status_label || 'No Renewal Plan';
  }

  function expiryLabel(state) {
    return ({
      expired: 'Expired',
      critical_30: '≤ 30 Days',
      due_90: '31–90 Days',
      upcoming_180: '91–180 Days'
    })[state] || state;
  }

  function tableRow(row) {
    const renewal = row.renewal;

    return `
      <tr>
        <td>
          <strong>${esc(row.member_name)}</strong>
          <small>${esc(row.member_email)}</small>
          <small>${esc(row.member_number || 'No member number')}</small>
        </td>
        <td>
          <strong>${esc(row.title)}</strong>
          <small>${esc(row.credential_type)}</small>
          <small>${esc(row.issuing_body || '—')}</small>
        </td>
        <td>
          <span class="nl-compliance-expiry" data-state="${esc(row.expiry_state)}">
            ${esc(expiryLabel(row.expiry_state))}
          </span>
          <strong>${esc(row.expiry_date || '—')}</strong>
          <small>
            ${row.days_until_expiry < 0
              ? `${Math.abs(row.days_until_expiry)} days expired`
              : `${row.days_until_expiry} days remaining`}
          </small>
        </td>
        <td>
          <strong>${esc(row.verification_status || 'unverified')}</strong>
          <small>Standing: ${esc(row.membership_standing || '—')}</small>
        </td>
        <td>
          <span class="nl-compliance-workflow"
            data-status="${esc(renewal?.status || 'none')}">
            ${esc(workflowLabel(row))}
          </span>
          ${renewal?.target_date ? `<small>Target: ${esc(renewal.target_date)}</small>` : ''}
        </td>
        <td>
          ${renewal ? `
            <button type="button"
              data-manage-renewal="${esc(renewal.id)}"
              data-current-status="${esc(renewal.status)}">
              Manage
            </button>
          ` : '<small>Member has not started a renewal plan.</small>'}
        </td>
      </tr>
    `;
  }

  function renderRows() {
    exportEl.disabled = rows.length === 0;

    if (!rows.length) {
      areaEl.innerHTML = `
        <div class="nl-admin-empty">
          No credentials match the selected compliance filters.
        </div>
      `;
      return;
    }

    areaEl.innerHTML = `
      <div class="nl-compliance-table-wrap">
        <table class="nl-compliance-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Credential</th>
              <th>Expiry</th>
              <th>Verification</th>
              <th>Renewal Workflow</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(tableRow).join('')}
          </tbody>
        </table>
      </div>
    `;

    areaEl
      .querySelectorAll('[data-manage-renewal]')
      .forEach(button => {
        button.addEventListener('click', () => {
          openWorkflowDialog(
            Number(button.dataset.manageRenewal),
            button.dataset.currentStatus
          );
        });
      });
  }

  async function loadSummary() {
    const payload = await request(
      '/api/nurselink/admin/credential-renewal/summary'
    );
    renderSummary(payload?.data || {});
  }

  async function loadRows() {
    areaEl.innerHTML =
      '<div class="nl-admin-loading">Loading credential compliance workload…</div>';

    const params = new URLSearchParams();
    const search = searchEl.value.trim();
    const expiry = expiryEl.value;
    const workflow = workflowEl.value;

    if (search) params.set('search', search);
    if (expiry !== 'all') params.set('expiry_state', expiry);
    if (workflow !== 'all') params.set('workflow_status', workflow);

    try {
      const suffix = params.toString() ? `?${params}` : '';
      const payload = await request(
        `/api/nurselink/admin/credential-renewal${suffix}`
      );

      rows = Array.isArray(payload?.data)
        ? payload.data
        : [];

      renderRows();
    } catch (error) {
      if ([401, 403, 419].includes(error.status)) {
        redirectToAdminLogin();
        return;
      }

      areaEl.innerHTML = `
        <div class="nl-admin-empty">${esc(error.message)}</div>
      `;
    }
  }

  async function openWorkflowDialog(renewalId, currentStatus) {
    const status = window.prompt(
      'Set NurseLink renewal workflow status:\nplanning | in_progress | submitted | returned | completed | cancelled',
      currentStatus || 'submitted'
    );

    if (!status) return;

    const allowed = [
      'planning',
      'in_progress',
      'submitted',
      'returned',
      'completed',
      'cancelled'
    ];

    if (!allowed.includes(status)) {
      notice('Invalid workflow status.', 'error');
      return;
    }

    const notes = window.prompt(
      'Optional workflow note. This is an internal NurseLink workflow note, not official regulator confirmation.',
      ''
    );

    if (!window.confirm(
      `Change this NurseLink renewal workflow to ${status}?`
    )) {
      return;
    }

    try {
      const payload = await request(
        `/api/nurselink/admin/credential-renewal/${encodeURIComponent(renewalId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status,
            notes: notes || null
          })
        }
      );

      notice(
        payload?.message || 'Renewal workflow updated.',
        'success'
      );

      await Promise.all([
        loadSummary(),
        loadRows()
      ]);
    } catch (error) {
      notice(error.message, 'error');
    }
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportCsv() {
    if (!rows.length) return;

    const header = [
      'Member Name',
      'Email',
      'Member Number',
      'Membership Standing',
      'Credential Type',
      'Credential Title',
      'Issuing Body',
      'Country',
      'Expiry Date',
      'Expiry State',
      'Days Until Expiry',
      'Verification Status',
      'Renewal Workflow',
      'Renewal Target Date'
    ];

    const lines = [
      header.map(csvCell).join(','),
      ...rows.map(row => [
        row.member_name,
        row.member_email,
        row.member_number,
        row.membership_standing,
        row.credential_type,
        row.title,
        row.issuing_body,
        row.country,
        row.expiry_date,
        row.expiry_state,
        row.days_until_expiry,
        row.verification_status,
        row.renewal?.status || 'none',
        row.renewal?.target_date || ''
      ].map(csvCell).join(','))
    ];

    const blob = new Blob(
      [lines.join('\r\n')],
      {type: 'text/csv;charset=utf-8'}
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download =
      `nurselink-credential-compliance-${new Date().toISOString().slice(0,10)}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    notice(`Exported ${rows.length} compliance row${rows.length === 1 ? '' : 's'}.`, 'success');
  }

  refreshEl?.addEventListener('click', async () => {
    notice('');
    await Promise.all([loadSummary(), loadRows()]);
  });

  exportEl?.addEventListener('click', exportCsv);
  expiryEl?.addEventListener('change', loadRows);
  workflowEl?.addEventListener('change', loadRows);

  searchEl?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(loadRows, 250);
  });

  signOutEl?.addEventListener('click', async () => {
    try {
      await request('/api/nurselink/admin/logout', {
        method: 'POST',
        body: '{}'
      });
    } catch (_) {}

    window.location.replace('/nurselink-admin-login.html');
  });

  async function boot() {
    try {
      const sessionPayload = await request(
        '/api/nurselink/admin/session'
      );

      renderIdentity(sessionPayload?.data || {});

      await Promise.all([
        loadSummary(),
        loadRows()
      ]);
    } catch (error) {
      if ([401, 403, 419].includes(error.status)) {
        redirectToAdminLogin();
        return;
      }

      notice(error.message, 'error');
    }
  }

  boot();
})();
