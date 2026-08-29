(() => {
  const API = 'https://api.amsertech.com';

  const identityEl = document.getElementById('adminIdentity');
  const statusEl = document.getElementById('testModeStatus');
  const noticeEl = document.getElementById('testNotice');
  const matrixEl = document.getElementById('testMatrix');
  const resultsEl = document.getElementById('safeTestResults');
  const startButton = document.getElementById('startTestMode');
  const stopButton = document.getElementById('stopTestMode');
  const minutesSelect = document.getElementById('testModeMinutes');
  const refreshMatrix = document.getElementById('refreshTestMatrix');
  const runSafeTests = document.getElementById('runSafeTests');
  const signOutButton = document.getElementById('adminSignOut');

  let currentSession = null;
  let currentMode = null;

  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function cookie(name) {
    const prefix = `${name}=`;
    const row = document.cookie.split(';')
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
      throw new Error('Unable to initialize secure Super Administrator request.');
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
        payload?.message || `Test Center request failed (${response.status}).`
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
      '/nurselink-admin-login.html?return=/nurselink-super-admin-test-center.html'
    );
  }

  function formatTime(epoch) {
    const value = Number(epoch || 0);
    if (!value) return '—';
    return new Date(value * 1000).toLocaleString();
  }

  function renderIdentity(data) {
    currentSession = data;
    const user = data?.user || {};
    const access = data?.access || {};

    identityEl.innerHTML = `
      <span>${esc(access.label || 'Super Administrator')}</span>
      <strong>${esc(user.name || user.email || 'NurseLink Staff')}</strong>
      <small>${esc(user.email || '')}</small>
    `;
  }

  function renderMode(data) {
    currentMode = data;
    const active = !!data?.active;

    statusEl.innerHTML = `
      <div class="nl-super-test-status-card" data-active="${active ? '1' : '0'}">
        <div>
          <span>TEST MODE</span>
          <strong>${active ? 'ACTIVE' : 'INACTIVE'}</strong>
          <small>
            ${active
              ? 'Temporary approved-member gate bypass is enabled for this Super Administrator.'
              : 'Normal membership access rules are in force.'}
          </small>
        </div>
        <div>
          <span>Real Membership</span>
          <strong>${esc(data?.membership_status || 'Unknown')}</strong>
          <small>Test Mode never changes this value.</small>
        </div>
        <div>
          <span>Expires</span>
          <strong>${active ? esc(formatTime(data?.expires_at)) : '—'}</strong>
          <small>${active ? 'Automatically disables at expiry.' : 'No temporary bypass active.'}</small>
        </div>
        <div>
          <span>Partner Tenant Bypass</span>
          <strong>${data?.partner_tenant_bypass ? 'Enabled' : 'No'}</strong>
          <small>Partner organization boundaries remain independent.</small>
        </div>
      </div>
    `;

    startButton.disabled = active;
    stopButton.disabled = !active;
    runSafeTests.disabled = false;
  }

  async function loadMode() {
    const payload = await request(
      '/api/nurselink/admin/test-mode/session'
    );
    renderMode(payload?.data || {});
  }

  async function loadMatrix() {
    matrixEl.innerHTML =
      '<div class="nl-admin-loading">Loading functional areas…</div>';

    try {
      const payload = await request(
        '/api/nurselink/admin/test-mode/checks'
      );

      const groups = Array.isArray(payload?.data?.groups)
        ? payload.data.groups
        : [];

      matrixEl.innerHTML = groups.map(group => `
        <section class="nl-super-test-group">
          <h3>${esc(group.name)}</h3>
          <div class="nl-super-test-items">
            ${(group.items || []).map(item => `
              <a href="${esc(item.url)}"
                ${String(item.url || '').startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''}>
                <strong>${esc(item.name)}</strong>
                <small>${esc(item.note || 'Open functional area')}</small>
              </a>
            `).join('')}
          </div>
        </section>
      `).join('') || '<div class="nl-super-test-empty">No functional areas returned.</div>';
    } catch (error) {
      if ([401, 403, 419].includes(error.status)) {
        redirectToAdminLogin();
        return;
      }

      matrixEl.innerHTML = `
        <div class="nl-super-test-empty">${esc(error.message)}</div>
      `;
    }
  }

  const SAFE_TESTS = [
    ['Authenticated Session', '/api/me'],
    ['Membership Record', '/api/membership/me'],
    ['Notifications', '/api/notifications'],
    ['Credential Registry', '/api/credential-registry'],
    ['Portfolio', '/api/portfolio-items'],
    ['Learning', '/api/learning-records'],
    ['Career Preferences', '/api/career-preferences'],
    ['Career Intelligence', '/api/career-intelligence'],
    ['Credential Renewal', '/api/credential-renewal'],
    ['Events & Programs', '/api/events'],
    ['Chapters & Communities', '/api/chapters'],
    ['Mentoring Profile', '/api/mentoring/profile'],
    ['Mentoring Directory', '/api/mentoring/directory'],
    ['Mentoring Requests', '/api/mentoring/requests'],
    ['Member Engagement Summary', '/api/engagement'],
    ['Member Engagement Timeline', '/api/engagement/timeline'],
    ['Enterprise Member Cohorts', '/api/enterprise/me'],
    ['Enterprise Member Goals', '/api/enterprise/goals'],
    ['Enterprise Invitations', '/api/enterprise/invitations'],
    ['Enterprise Member Outcomes', '/api/enterprise/outcomes'],
    ['Enterprise Member Support', '/api/enterprise/support'],
    ['Member Benefits', '/api/benefits'],
    ['Benefit Intelligence', '/api/benefits/intelligence'],
    ['Benefit Reminders', '/api/benefits/reminders'],
    ['Administrator Dashboard', '/api/nurselink/admin/dashboard'],
    ['Administration Operations Center Summary', '/api/nurselink/admin/operations-center/summary'],
    ['Membership Administration Overview', '/api/nurselink/admin/membership-administration/overview'],
    ['Membership Onboarding Summary', '/api/nurselink/admin/membership-onboarding/summary'],
    ['Membership Command Summary', '/api/nurselink/admin/membership-command/summary'],
    ['Member Registry Summary', '/api/nurselink/admin/member-registry/summary'],
    ['Membership Lifecycle Summary', '/api/nurselink/admin/membership-lifecycle/summary'],
    ['Credential Renewal Admin Summary', '/api/nurselink/admin/credential-renewal/summary'],
    ['Credential Compliance Workload', '/api/nurselink/admin/credential-renewal'],
    ['Event Management', '/api/nurselink/admin/events'],
    ['Chapter Management', '/api/nurselink/admin/chapters'],
    ['Mentoring Analytics', '/api/nurselink/admin/mentoring/summary'],
    ['Engagement Analytics', '/api/nurselink/admin/engagement/summary'],
    ['Engagement Activity Summary', '/api/nurselink/admin/engagement/activity-summary?days=30'],
    ['Enterprise Platform Summary', '/api/nurselink/admin/enterprise/summary'],
    ['Enterprise Enrollment Summary', '/api/nurselink/admin/enterprise/enrollment-summary'],
    ['Enterprise Support Summary', '/api/nurselink/admin/enterprise/support'],
    ['Benefit Management', '/api/nurselink/admin/benefits'],
    ['Benefit Analytics', '/api/nurselink/admin/benefits/summary'],
    ['Benefit Reminder Summary', '/api/nurselink/admin/benefits/reminders/summary'],
    ['Super Admin Test Session', '/api/nurselink/admin/test-mode/session']
  ];

  async function safeProbe(name, path) {
    const started = performance.now();

    try {
      const response = await fetch(`${API}${path}`, {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      return {
        name,
        path,
        status: response.status,
        ok: response.ok,
        ms: Math.round(performance.now() - started)
      };
    } catch (_) {
      return {
        name,
        path,
        status: 0,
        ok: false,
        ms: Math.round(performance.now() - started)
      };
    }
  }

  function renderSafeTestResults(rows) {
    resultsEl.innerHTML = `
      <div class="nl-super-test-result-grid">
        ${rows.map(row => `
          <div class="nl-super-test-result" data-ok="${row.ok ? '1' : '0'}">
            <span>${row.ok ? 'PASS' : 'CHECK'}</span>
            <strong>${esc(row.name)}</strong>
            <small>${esc(row.path)}</small>
            <em>HTTP ${esc(row.status)} · ${esc(row.ms)} ms</em>
          </div>
        `).join('')}
      </div>
      <div class="nl-super-test-result-note">
        A CHECK result can be expected when a separate role or dataset is required.
        Use the functional matrix to complete write/action testing manually.
      </div>
    `;
  }

  startButton?.addEventListener('click', async () => {
    startButton.disabled = true;
    notice('');

    try {
      const minutes = Number(minutesSelect.value || 60);
      const payload = await request(
        '/api/nurselink/admin/test-mode/start',
        {
          method: 'POST',
          body: JSON.stringify({minutes})
        }
      );

      notice(payload?.message || 'Test Mode started.', 'success');
      await loadMode();
    } catch (error) {
      notice(error.message, 'error');
      startButton.disabled = false;
    }
  });

  stopButton?.addEventListener('click', async () => {
    if (!window.confirm('End Super Administrator Test Mode now?')) {
      return;
    }

    stopButton.disabled = true;
    notice('');

    try {
      const payload = await request(
        '/api/nurselink/admin/test-mode/stop',
        {
          method: 'POST',
          body: '{}'
        }
      );

      notice(payload?.message || 'Test Mode ended.', 'success');
      await loadMode();
    } catch (error) {
      notice(error.message, 'error');
      stopButton.disabled = false;
    }
  });

  runSafeTests?.addEventListener('click', async () => {
    runSafeTests.disabled = true;
    resultsEl.innerHTML =
      '<div class="nl-admin-loading">Running safe functional checks…</div>';

    const results = [];

    for (const [name, path] of SAFE_TESTS) {
      results.push(await safeProbe(name, path));
    }

    renderSafeTestResults(results);
    runSafeTests.disabled = false;
  });

  refreshMatrix?.addEventListener('click', loadMatrix);

  signOutButton?.addEventListener('click', async () => {
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

      if (!sessionPayload?.data?.access?.is_super_admin) {
        throw Object.assign(
          new Error('Super Administrator access is required for the Functional Test Center.'),
          {status: 403}
        );
      }

      renderIdentity(sessionPayload.data);

      await Promise.all([
        loadMode(),
        loadMatrix()
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
