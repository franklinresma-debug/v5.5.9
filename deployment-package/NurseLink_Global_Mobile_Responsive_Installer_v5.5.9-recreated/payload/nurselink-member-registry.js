(() => {
  const API = 'https://api.amsertech.com';

  const identityEl = document.getElementById('adminIdentity');
  const summaryEl = document.getElementById('memberRegistrySummary');
  const registryEl = document.getElementById('memberRegistryArea');
  const detailEl = document.getElementById('memberRegistryDetail');
  const noticeEl = document.getElementById('registryNotice');
  const refreshButton = document.getElementById('refreshMemberRegistry');
  const exportButton = document.getElementById('exportMemberRegistry');
  const searchInput = document.getElementById('memberRegistrySearch');
  const credentialFilter = document.getElementById('memberCredentialFilter');
  const standingFilter = document.getElementById('memberStandingFilter');
  const publicProfileFilter = document.getElementById('memberPublicProfileFilter');
  const signOutButton = document.getElementById('adminSignOut');

  let rows = [];
  let selectedMembershipId = null;
  let searchTimer = null;

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
        payload?.message || `Member Registry request failed (${response.status}).`
      );
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  function redirectToAdminLogin() {
    window.location.replace(
      '/nurselink-admin-login.html?return=/nurselink-member-registry.html'
    );
  }

  function notice(message = '', tone = '') {
    noticeEl.textContent = message;
    noticeEl.hidden = !message;
    noticeEl.dataset.tone = tone;
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

  function renderSummary(data) {
    const cards = [
      ['Approved Members', data.total_approved ?? 0],
      ['Approved Last 30 Days', data.approved_last_30_days ?? 0],
      ['Approved This Year', data.approved_this_year ?? 0],
      ['Active Standing', data.active_members ?? 0],
      ['Suspended', data.suspended_members ?? 0],
      ['Inactive', data.inactive_members ?? 0],
      ['With Verified Credentials', data.with_verified_credentials ?? 0],
      ['Public Profiles Enabled', data.public_profiles_enabled ?? 0]
    ];

    summaryEl.innerHTML = cards.map(([label, value]) => `
      <div class="nl-member-registry-summary-card">
        <span>${esc(label)}</span>
        <strong>${esc(value)}</strong>
      </div>
    `).join('');
  }

  function credentialLabel(row) {
    const total = Number(row?.credentials?.total || 0);
    const verified = Number(row?.credentials?.verified || 0);
    const attention = Number(row?.credentials?.attention || 0);

    if (!total) return 'No credentials';
    if (attention === 0 && verified > 0) {
      return `${verified}/${total} verified`;
    }
    return `${verified}/${total} verified · ${attention} attention`;
  }

  function rowHtml(row) {
    return `
      <tr data-member-id="${esc(row.membership_id)}">
        <td>
          <strong>${esc(row.name)}</strong>
          <small>${esc(row.email)}</small>
        </td>
        <td><strong>${esc(row.member_number || '—')}</strong></td>
        <td>
          <span class="nl-member-standing"
            data-standing="${esc(row.standing || 'active')}">
            ${esc(row.standing_label || row.standing || 'Active')}
          </span>
        </td>
        <td>${esc(row.approved_at || '—')}</td>
        <td>${esc(credentialLabel(row))}</td>
        <td>${esc(row.employment_records ?? 0)}</td>
        <td>${esc(row.learning_records ?? 0)}</td>
        <td>
          <span class="nl-member-public-state"
            data-enabled="${row.public_profile?.enabled ? '1' : '0'}">
            ${row.public_profile?.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </td>
        <td>
          <button type="button"
            class="nl-member-view-button"
            data-open-member="${esc(row.membership_id)}">
            View
          </button>
        </td>
      </tr>
    `;
  }

  function renderRows() {
    exportButton.disabled = rows.length === 0;

    if (!rows.length) {
      registryEl.innerHTML = `
        <div class="nl-admin-empty">
          No approved members match the current filters.
        </div>
      `;
      return;
    }

    registryEl.innerHTML = `
      <div class="nl-member-registry-table-wrap">
        <table class="nl-member-registry-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Member Number</th>
              <th>Standing</th>
              <th>Approved</th>
              <th>Credentials</th>
              <th>Employment</th>
              <th>Learning</th>
              <th>Public Profile</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows.map(rowHtml).join('')}</tbody>
        </table>
      </div>
    `;

    registryEl.querySelectorAll('[data-open-member]').forEach(button => {
      button.addEventListener('click', () => {
        openMember(Number(button.dataset.openMember));
      });
    });
  }

  async function loadSummary() {
    const payload = await request(
      '/api/nurselink/admin/member-registry/summary'
    );
    renderSummary(payload?.data || {});
  }

  async function loadRows() {
    registryEl.innerHTML = `
      <div class="nl-admin-loading">Loading approved members…</div>
    `;

    const params = new URLSearchParams();
    const search = searchInput.value.trim();
    const credential = credentialFilter.value;
    const standing = standingFilter.value;
    const publicProfile = publicProfileFilter.value;

    if (search) params.set('search', search);
    if (credential && credential !== 'all') {
      params.set('credential_state', credential);
    }
    if (standing && standing !== 'all') {
      params.set('standing', standing);
    }
    if (publicProfile && publicProfile !== 'all') {
      params.set('public_profile', publicProfile);
    }

    try {
      const suffix = params.toString() ? `?${params}` : '';
      const payload = await request(
        `/api/nurselink/admin/member-registry${suffix}`
      );
      rows = Array.isArray(payload?.data) ? payload.data : [];
      renderRows();
    } catch (error) {
      if ([401, 403, 419].includes(error.status)) {
        redirectToAdminLogin();
        return;
      }

      registryEl.innerHTML = `
        <div class="nl-admin-empty">${esc(error.message)}</div>
      `;
    }
  }

  function section(title, items, renderer) {
    return `
      <section class="nl-member-registry-section">
        <div class="nl-member-registry-section-head">
          <h3>${esc(title)}</h3>
          <span>${items.length}</span>
        </div>
        <div class="nl-member-registry-section-list">
          ${items.length
            ? items.map(renderer).join('')
            : '<div class="nl-member-registry-none">No records</div>'}
        </div>
      </section>
    `;
  }

  function renderDetail(data) {
    const membership = data.membership || {};
    const member = data.member || {};
    const publicProfile = data.public_profile || {};
    const credentials = Array.isArray(data.credentials) ? data.credentials : [];
    const employment = Array.isArray(data.employment) ? data.employment : [];
    const learning = Array.isArray(data.learning) ? data.learning : [];
    const audit = Array.isArray(data.membership_audit) ? data.membership_audit : [];

    detailEl.innerHTML = `
      <div class="nl-member-registry-detail-head">
        <div>
          <span class="nl-admin-eyebrow">APPROVED MEMBER</span>
          <h2>${esc(member.name || 'NurseLink Member')}</h2>
          <p>${esc(member.email || '')}</p>
        </div>
        <div class="nl-member-registry-status-stack">
          <span class="nl-member-approved-badge">Approved</span>
          <span class="nl-member-standing"
            data-standing="${esc(membership.standing || 'active')}">
            ${esc(membership.standing_label || membership.standing || 'Active')}
          </span>
        </div>
      </div>

      <div class="nl-member-registry-id-grid">
        <div>
          <span>Member Number</span>
          <strong>${esc(membership.member_number || '—')}</strong>
        </div>
        <div>
          <span>Approved</span>
          <strong>${esc(membership.approved_at || '—')}</strong>
        </div>
        <div>
          <span>Profile Photo</span>
          <strong>${member.profile_photo_uploaded ? 'Uploaded' : 'Not uploaded'}</strong>
        </div>
        <div>
          <span>Professional Standing</span>
          <strong>${esc(membership.standing_label || membership.standing || 'Active')}</strong>
        </div>
        <div>
          <span>Standing Changed</span>
          <strong>${esc(membership.standing_changed_at || '—')}</strong>
        </div>
        <div>
          <span>Standing Reason</span>
          <strong>${esc(membership.standing_reason || '—')}</strong>
        </div>
      </div>

      <div class="nl-member-registry-actions">
        ${membership.verification_url ? `
          <a href="${esc(membership.verification_url)}"
            target="_blank" rel="noopener noreferrer">
            Verify Membership
          </a>
          <button type="button"
            id="copyMemberVerify"
            data-copy="${esc(membership.verification_url)}">
            Copy Verify Link
          </button>
        ` : ''}
        ${publicProfile.enabled && publicProfile.url ? `
          <a href="${esc(publicProfile.url)}"
            target="_blank" rel="noopener noreferrer">
            Public Profile
          </a>
        ` : ''}
      </div>

      <div class="nl-member-registry-signal-grid">
        <div>
          <span>Credentials</span>
          <strong>${credentials.filter(c => c.verification_status === 'verified').length}/${credentials.length} verified</strong>
        </div>
        <div>
          <span>Employment</span>
          <strong>${employment.length} record${employment.length === 1 ? '' : 's'}</strong>
        </div>
        <div>
          <span>Learning</span>
          <strong>${learning.length} record${learning.length === 1 ? '' : 's'}</strong>
        </div>
        <div>
          <span>Public Profile</span>
          <strong>${publicProfile.enabled ? 'Enabled' : 'Disabled'}</strong>
        </div>
      </div>

      <section class="nl-member-lifecycle-panel">
        <div class="nl-member-registry-section-head">
          <div>
            <h3>Membership Lifecycle Management</h3>
            <small>
              Permanent approval remains unchanged. This changes professional
              standing and member-only access.
            </small>
          </div>
        </div>

        <form id="memberLifecycleForm">
          <label>
            <span>New standing</span>
            <select id="memberLifecycleStanding" required>
              <option value="">Select standing</option>
            </select>
          </label>

          <label>
            <span>Reason</span>
            <textarea id="memberLifecycleReason"
              rows="3"
              required
              minlength="3"
              maxlength="3000"
              placeholder="Required reason for this membership standing change"></textarea>
          </label>

          <label id="memberLifecycleSelfConfirmWrap"
            class="nl-member-lifecycle-self-confirm"
            hidden>
            <input id="memberLifecycleSelfConfirm" type="checkbox">
            <span>
              I confirm this is my own membership record. This Super Administrator
              self-action will be explicitly audited.
            </span>
          </label>

          <div id="memberLifecycleGuidance"
            class="nl-member-lifecycle-guidance">
            Loading allowed lifecycle transitions…
          </div>

          <button id="memberLifecycleSubmit"
            class="nl-member-lifecycle-submit"
            type="submit">
            Save Standing Change
          </button>
        </form>
      </section>

      ${section('Credentials', credentials, item => `
        <div class="nl-member-registry-record">
          <div>
            <strong>${esc(item.title)}</strong>
            <small>${esc(item.credential_type)} · ${esc(item.issuing_body || '—')}</small>
          </div>
          <span data-status="${esc(item.verification_status)}">
            ${esc(item.verification_status)}
          </span>
        </div>
      `)}

      ${section('Employment', employment, item => `
        <div class="nl-member-registry-record">
          <div>
            <strong>${esc(item.position)} · ${esc(item.employer_name)}</strong>
            <small>${esc(item.country)}${item.city ? ` · ${esc(item.city)}` : ''}</small>
          </div>
          <span>${item.is_current ? 'Current' : esc(item.end_date || 'Past')}</span>
        </div>
      `)}

      ${section('Learning & CPD', learning, item => `
        <div class="nl-member-registry-record">
          <div>
            <strong>${esc(item.title)}</strong>
            <small>${esc(item.provider || '—')} · ${esc(item.status)}</small>
          </div>
          <span>${item.cpd_units !== null ? `${esc(item.cpd_units)} CPD` : esc(item.learning_hours ?? '—')}</span>
        </div>
      `)}

      ${section('Membership Audit', audit, item => `
        <div class="nl-member-registry-record">
          <div>
            <strong>${esc(item.action)}</strong>
            <small>${esc(item.created_at || '')}</small>
          </div>
        </div>
      `)}

      <div class="nl-member-registry-detail-privacy">
        Credential numbers, uploaded documents, home address, phone number and reviewer notes are intentionally excluded from this registry.
      </div>
    `;

    bindMembershipLifecycle(membership);

    detailEl.querySelector('#copyMemberVerify')?.addEventListener(
      'click',
      async event => {
        const value = event.currentTarget.dataset.copy || '';
        if (!value) return;
        try {
          await navigator.clipboard.writeText(value);
          notice('Membership verification link copied.', 'success');
        } catch (_) {
          notice('Unable to copy verification link.', 'error');
        }
      }
    );
  }

  function standingLabel(value) {
    return ({
      active: 'Active',
      suspended: 'Suspended',
      inactive: 'Inactive'
    })[value] || value || 'Active';
  }

  async function bindMembershipLifecycle(membership) {
    const form = document.getElementById('memberLifecycleForm');
    const select = document.getElementById('memberLifecycleStanding');
    const reason = document.getElementById('memberLifecycleReason');
    const guidance = document.getElementById('memberLifecycleGuidance');
    const submit = document.getElementById('memberLifecycleSubmit');
    const selfWrap = document.getElementById('memberLifecycleSelfConfirmWrap');
    const selfConfirm = document.getElementById('memberLifecycleSelfConfirm');

    if (!form || !membership?.id) return;

    try {
      const payload = await request(
        `/api/nurselink/admin/membership-lifecycle/${encodeURIComponent(membership.id)}`
      );

      const lifecycle = payload?.data || {};
      const allowed = Array.isArray(lifecycle.allowed_transitions)
        ? lifecycle.allowed_transitions
        : [];

      select.innerHTML = `
        <option value="">Select standing</option>
        ${allowed.map(value => `
          <option value="${esc(value)}">${esc(standingLabel(value))}</option>
        `).join('')}
      `;

      selfWrap.hidden = !lifecycle.is_self;

      if (!allowed.length) {
        select.disabled = true;
        reason.disabled = true;
        submit.disabled = true;
        guidance.textContent =
          'No lifecycle transition is available from the current standing.';
      } else {
        guidance.textContent =
          `Current standing: ${standingLabel(lifecycle.standing)}. `
          + `Allowed: ${allowed.map(standingLabel).join(', ')}.`;
      }

      form.addEventListener('submit', async event => {
        event.preventDefault();

        const target = select.value;
        const why = reason.value.trim();

        if (!target || why.length < 3) return;

        const confirmed = window.confirm(
          `Change membership standing from ${standingLabel(lifecycle.standing)} to ${standingLabel(target)}?`
        );

        if (!confirmed) return;

        submit.disabled = true;
        submit.textContent = 'Saving…';
        notice('');

        try {
          const result = await request(
            `/api/nurselink/admin/membership-lifecycle/${encodeURIComponent(membership.id)}/standing`,
            {
              method: 'POST',
              body: JSON.stringify({
                standing: target,
                reason: why,
                confirm_self_action: !!selfConfirm?.checked
              })
            }
          );

          notice(
            result?.message || 'Membership standing updated.',
            'success'
          );

          await Promise.all([
            loadSummary(),
            loadRows()
          ]);

          await openMember(membership.id);
        } catch (error) {
          notice(error.message, 'error');

          if (error?.payload?.confirmation_required) {
            selfConfirm?.focus();
          }
        } finally {
          submit.disabled = false;
          submit.textContent = 'Save Standing Change';
        }
      });
    } catch (error) {
      guidance.textContent = error.message;
      select.disabled = true;
      reason.disabled = true;
      submit.disabled = true;
    }
  }

  async function openMember(id) {
    selectedMembershipId = Number(id);
    detailEl.innerHTML = `
      <div class="nl-admin-loading">Loading member details…</div>
    `;

    try {
      const payload = await request(
        `/api/nurselink/admin/member-registry/${encodeURIComponent(id)}`
      );
      renderDetail(payload?.data || {});
    } catch (error) {
      if ([401, 403, 419].includes(error.status)) {
        redirectToAdminLogin();
        return;
      }
      detailEl.innerHTML = `
        <div class="nl-admin-empty">${esc(error.message)}</div>
      `;
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
      'Professional Standing',
      'Standing Changed At',
      'Approved At',
      'Credentials Total',
      'Credentials Verified',
      'Credentials Attention',
      'Employment Records',
      'Learning Records',
      'Public Profile Enabled'
    ];

    const lines = [
      header.map(csvCell).join(','),
      ...rows.map(row => [
        row.name,
        row.email,
        row.member_number,
        row.standing_label || row.standing || 'Active',
        row.standing_changed_at || '',
        row.approved_at,
        row.credentials?.total ?? 0,
        row.credentials?.verified ?? 0,
        row.credentials?.attention ?? 0,
        row.employment_records ?? 0,
        row.learning_records ?? 0,
        row.public_profile?.enabled ? 'Yes' : 'No'
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
      `nurselink-member-registry-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    notice(`Exported ${rows.length} approved member${rows.length === 1 ? '' : 's'}.`, 'success');
  }

  refreshButton?.addEventListener('click', async () => {
    notice('');
    await Promise.all([loadSummary(), loadRows()]);
    if (selectedMembershipId) {
      await openMember(selectedMembershipId);
    }
  });

  exportButton?.addEventListener('click', exportCsv);
  credentialFilter?.addEventListener('change', loadRows);
  standingFilter?.addEventListener('change', loadRows);
  publicProfileFilter?.addEventListener('change', loadRows);

  searchInput?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(loadRows, 250);
  });

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
      const sessionPayload = await request('/api/nurselink/admin/session');
      renderIdentity(sessionPayload?.data || {});
      await Promise.all([loadSummary(), loadRows()]);
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
