(() => {
  const API = 'https://api.amsertech.com';

  const identityEl = document.getElementById('adminIdentity');
  const summaryEl = document.getElementById('membershipSummary');
  const queueEl = document.getElementById('membershipQueueArea');
  const panelEl = document.getElementById('membershipReviewPanel');
  const noticeEl = document.getElementById('commandNotice');
  const refreshButton = document.getElementById('refreshMembershipQueue');
  const searchInput = document.getElementById('membershipSearch');
  const statusFilter = document.getElementById('membershipStatusFilter');
  const signOutButton = document.getElementById('adminSignOut');

  let session = null;
  let queue = [];
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
      throw new Error('Unable to initialize secure membership review request.');
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
        payload?.message || `Membership review request failed (${response.status}).`
      );
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  function redirectToAdminLogin() {
    window.location.replace(
      '/nurselink-admin-login.html?return=/nurselink-membership-command-center.html'
    );
  }

  function notice(message = '', tone = '') {
    noticeEl.textContent = message;
    noticeEl.hidden = !message;
    noticeEl.dataset.tone = tone;
  }

  function label(status) {
    return ({
      submitted: 'Submitted',
      under_review: 'Under Review',
      needs_information: 'Needs Information',
      ready_for_approval: 'Ready for Approval',
      approved: 'Approved',
      declined: 'Declined'
    })[status] || status || 'Unknown';
  }

  function renderIdentity(data) {
    session = data;
    const user = data?.user || {};
    const access = data?.access || {};

    identityEl.innerHTML = `
      <span>${esc(access.label || 'Administrator')}</span>
      <strong>${esc(user.name || user.email || 'NurseLink Staff')}</strong>
      <small>${esc(user.email || '')}</small>
    `;
    identityEl.dataset.role = access.role || '';
  }

  function summaryCard(status, value) {
    return `
      <button type="button"
        class="nl-membership-summary-card"
        data-summary-status="${esc(status)}">
        <span>${esc(label(status))}</span>
        <strong>${esc(value)}</strong>
      </button>
    `;
  }

  function renderSummary(data) {
    const counts = data?.counts || {};
    summaryEl.innerHTML = [
      'submitted',
      'under_review',
      'needs_information',
      'ready_for_approval',
      'approved',
      'declined'
    ].map(status => summaryCard(status, counts[status] ?? 0)).join('');

    summaryEl.querySelectorAll('[data-summary-status]').forEach(button => {
      button.addEventListener('click', () => {
        statusFilter.value = button.dataset.summaryStatus || '';
        loadQueue();
      });
    });
  }

  function queueRow(row) {
    return `
      <tr data-membership-id="${esc(row.id)}">
        <td>
          <strong>${esc(row.name)}</strong>
          <small>${esc(row.email)}</small>
          ${row.is_self ? '<em>YOUR APPLICATION</em>' : ''}
        </td>
        <td>
          <span class="nl-membership-status"
            data-status="${esc(row.status)}">
            ${esc(row.status_label || label(row.status))}
          </span>
        </td>
        <td>${esc(row.member_number || 'Pending')}</td>
        <td>
          <span>${esc(row.reviewer_name || '—')}</span>
          <small>${esc(row.reviewer_email || '')}</small>
        </td>
        <td>${esc(row.updated_at || '')}</td>
        <td>
          <button class="review-button"
            type="button"
            data-review="${esc(row.id)}">
            Review
          </button>
        </td>
      </tr>
    `;
  }

  function renderQueue() {
    if (!queue.length) {
      queueEl.innerHTML = `
        <div class="nl-admin-empty">
          No membership applications match the current filters.
        </div>
      `;
      return;
    }

    queueEl.innerHTML = `
      <div class="nl-membership-table-wrap">
        <table class="nl-membership-table">
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Status</th>
              <th>Member Number</th>
              <th>Last Reviewer</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${queue.map(queueRow).join('')}
          </tbody>
        </table>
      </div>
    `;

    queueEl.querySelectorAll('[data-review]').forEach(button => {
      button.addEventListener('click', () => {
        openMembership(Number(button.dataset.review));
      });
    });
  }

  async function loadSummary() {
    const payload = await request(
      '/api/nurselink/admin/membership-command/summary'
    );
    renderSummary(payload?.data || {});
  }

  async function loadQueue() {
    queueEl.innerHTML = `
      <div class="nl-admin-loading">Loading applications…</div>
    `;

    const params = new URLSearchParams();
    const status = statusFilter.value;
    const search = searchInput.value.trim();

    if (status) params.set('status', status);
    if (search) params.set('search', search);

    try {
      const suffix = params.toString() ? `?${params}` : '';
      const payload = await request(
        `/api/nurselink/admin/membership-command${suffix}`
      );

      queue = Array.isArray(payload?.data) ? payload.data : [];
      renderQueue();

      if (
        selectedMembershipId
        && !queue.some(row => Number(row.id) === selectedMembershipId)
      ) {
        selectedMembershipId = null;
      }
    } catch (error) {
      if ([401, 403, 419].includes(error.status)) {
        redirectToAdminLogin();
        return;
      }

      queueEl.innerHTML = `
        <div class="nl-admin-empty">${esc(error.message)}</div>
      `;
    }
  }

  function profileIndicator(labelText, value, tone = '') {
    return `
      <div class="nl-membership-profile-indicator"
        data-tone="${esc(tone)}">
        <span>${esc(labelText)}</span>
        <strong>${esc(value)}</strong>
      </div>
    `;
  }

  function historyRow(row) {
    const afterStatus = row?.after?.status
      ? label(row.after.status)
      : null;

    return `
      <div class="nl-membership-history-row">
        <span></span>
        <div>
          <strong>${esc(
            afterStatus
              ? `${row.action} → ${afterStatus}`
              : row.action
          )}</strong>
          <small>
            ${esc(row.reviewer_name || row.reviewer_email || row.reviewer_user_id)}
            · ${esc(row.created_at || '')}
          </small>
        </div>
      </div>
    `;
  }


  function smartRegistrationReviewSection(smart) {
    const profile = smart?.profile || null;
    const documents = Array.isArray(smart?.documents) ? smart.documents : [];
    if (!profile && !documents.length) return '';

    const item = (name, value) => `
      <div class="nl557-review-item"><span>${esc(name)}</span><strong>${esc(value === null || value === undefined || value === '' ? 'Not provided' : value)}</strong></div>`;
    const fullName = profile
      ? [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ')
      : '';

    return `
      <section class="nl557-smart-submission">
        <div class="nl557-review-head">
          <div><h3>Smart Registration Submission</h3><small>Applicant-confirmed information and supporting evidence</small></div>
          <span>${documents.length} document${documents.length === 1 ? '' : 's'}</span>
        </div>
        ${profile ? `
          <div class="nl557-review-columns">
            <div><h4>Personal</h4><div class="nl557-review-grid">
              ${item('Name', fullName)}
              ${item('Date of birth', profile.birth_date)}
              ${item('Nationality', profile.nationality)}
              ${item('Mobile', profile.phone)}
              ${item('Country', profile.country)}
            </div></div>
            <div><h4>Professional</h4><div class="nl557-review-grid">
              ${item('Title', profile.professional_title)}
              ${item('Experience', profile.years_experience === null || profile.years_experience === undefined ? '' : `${profile.years_experience} years`)}
              ${item('Employer', profile.current_employer)}
              ${item('License', profile.primary_license_number)}
              ${item('Jurisdiction', profile.primary_license_country)}
              ${item('Education', profile.highest_nursing_education)}
            </div></div>
          </div>
        ` : ''}
        <div class="nl557-review-documents">
          <h4>Evidence</h4>
          ${documents.length ? documents.map(doc => `
            <div class="nl557-review-document">
              <div><strong>${esc(doc.name || 'Document')}</strong><small>${esc(label(doc.document_type || 'document'))} · v${esc(doc.version || 1)} · ${doc.is_current === false ? 'Superseded' : 'Current'} · ${esc(label(doc.extraction_status || 'uploaded'))}</small></div>
              <a href="${esc(doc.download_url ? `${API}${doc.download_url}` : '#')}" target="_blank" rel="noopener">Open evidence</a>
            </div>
          `).join('') : '<p>No Smart Registration evidence attached.</p>'}
        </div>
        <p class="nl557-review-boundary">Extraction assists data entry only; credential and identity verification remain reviewer-controlled.</p>
      </section>`;
  }

  function renderReviewPanel(detail, history) {
    const membership = detail.membership || {};
    const applicant = detail.applicant || {};
    const profile = detail.profile || {};
    const review = detail.review || {};
    const smartApplication = detail.smart_application || null;
    const lifecycle = detail.lifecycle || {};
    const statusHistory = Array.isArray(lifecycle.status_history) ? lifecycle.status_history : [];
    const delivery = lifecycle.notification_delivery || {};
    const deliveryRecent = Array.isArray(delivery.recent) ? delivery.recent : [];
    const allowed = Array.isArray(review.allowed_actions)
      ? review.allowed_actions
      : [];

    const credentials = profile.credentials;

    panelEl.innerHTML = `
      <div class="nl-membership-panel-head">
        <div>
          <span class="nl-admin-eyebrow">APPLICATION REVIEW</span>
          <h2>${esc(applicant.name || 'Applicant')}</h2>
          <p>${esc(applicant.email || '')}</p>
        </div>
        <span class="nl-membership-status"
          data-status="${esc(membership.status)}">
          ${esc(membership.status_label || label(membership.status))}
        </span>
      </div>

      <div class="nl-membership-id-grid">
        <div>
          <span>Application ID</span>
          <strong>#${esc(membership.id)}</strong>
        </div>
        <div>
          <span>Member Number</span>
          <strong>${esc(membership.member_number || 'Pending')}</strong>
        </div>
        <div>
          <span>Last Reviewed</span>
          <strong>${esc(membership.reviewed_at || 'Not yet reviewed')}</strong>
        </div>
      </div>

      <section class="nl-membership-profile-checks">
        <h3>Application Signals</h3>
        <div class="nl-membership-profile-grid">
          ${profileIndicator(
            'Profile Photo',
            profile.profile_photo_uploaded ? 'Uploaded' : 'Missing',
            profile.profile_photo_uploaded ? 'good' : 'warn'
          )}
          ${profileIndicator(
            'Employment Records',
            profile.employment_records === null
              ? 'Unavailable'
              : String(profile.employment_records),
            Number(profile.employment_records || 0) > 0 ? 'good' : 'warn'
          )}
          ${profileIndicator(
            'Credentials',
            credentials
              ? `${credentials.verified}/${credentials.total} verified`
              : 'Unavailable',
            credentials && credentials.verified > 0 ? 'good' : 'warn'
          )}
          ${profileIndicator(
            'Credential Review',
            credentials
              ? `${credentials.pending} pending · ${credentials.expired} expired`
              : 'Unavailable',
            credentials && credentials.pending === 0 && credentials.expired === 0
              ? 'good'
              : 'warn'
          )}
        </div>
      </section>

      ${smartRegistrationReviewSection(smartApplication)}

      <section class="nl-membership-current-notes">
        <h3>Current Reviewer Notes</h3>
        <p>${membership.reviewer_notes
          ? esc(membership.reviewer_notes)
          : 'No reviewer notes recorded.'}</p>
      </section>

      <section class="nl-membership-decision">
        <div class="nl-membership-decision-head">
          <div>
            <h3>Review Action</h3>
            <small>
              ${review.final_decision_requires_admin
                ? 'Final approval or decline requires Administrator access.'
                : ''}
            </small>
          </div>
        </div>

        ${allowed.length ? `
          <form id="membershipDecisionForm">
            <label>
              <span>Next status</span>
              <select id="membershipNextStatus" required>
                <option value="">Select next action</option>
                ${allowed.map(status => `
                  <option value="${esc(status)}">${esc(label(status))}</option>
                `).join('')}
              </select>
            </label>

            <label>
              <span>Reviewer notes</span>
              <textarea id="membershipReviewerNotes"
                rows="4"
                placeholder="Internal review notes visible in the membership record">${esc(membership.reviewer_notes || '')}</textarea>
            </label>

            <label id="decisionReasonField" hidden>
              <span>Decision / information request reason</span>
              <textarea id="membershipDecisionReason"
                rows="3"
                placeholder="Required for Needs Information or Declined"></textarea>
            </label>

            ${review.is_self ? `
              <label class="nl-membership-self-confirm">
                <input id="membershipSelfConfirm" type="checkbox">
                <span>
                  I understand this is my own membership application.
                  This Super Administrator action will be explicitly recorded
                  in the NurseLink audit trail.
                </span>
              </label>
            ` : ''}

            <div class="nl-membership-decision-warning" id="decisionWarning">
              Select a next status to continue.
            </div>

            <button class="primary" id="membershipDecisionButton"
              type="submit">
              Save Review Action
            </button>
          </form>
        ` : `
          <div class="nl-membership-closed">
            <strong>Workflow closed</strong>
            <small>
              This application is ${esc(label(membership.status))}.
              No further command-center transitions are available.
            </small>
          </div>
        `}
      </section>

      <section class="nl-membership-lifecycle">
        <div class="nl-membership-history-head">
          <h3>Applicant Status Timeline</h3>
          <span>${statusHistory.length} transition${statusHistory.length === 1 ? '' : 's'}</span>
        </div>
        <div class="nl558-status-timeline">
          ${statusHistory.length ? statusHistory.slice().reverse().map(item => `
            <div class="nl558-status-row">
              <span aria-hidden="true"></span>
              <div><strong>${esc(label(item.to_status || 'submitted'))}</strong><small>${esc(item.created_at || '')}${item.actor_type ? ` · ${esc(label(item.actor_type))}` : ''}</small>${item.reason ? `<p>${esc(item.reason)}</p>` : ''}</div>
            </div>`).join('') : '<div class="nl-membership-history-empty">No lifecycle history recorded yet.</div>'}
        </div>
      </section>

      <section class="nl-membership-deliveries">
        <div class="nl-membership-history-head">
          <h3>Applicant Notifications</h3>
          <span>${delivery.available === false ? 'Unavailable' : `${Number(delivery.delivered || 0)} delivered · ${Number(delivery.failed || 0)} failed`}</span>
        </div>
        <div class="nl558-delivery-summary">
          <span><strong>${Number(delivery.total || 0)}</strong>Total</span>
          <span><strong>${Number(delivery.delivered || 0)}</strong>Delivered</span>
          <span><strong>${Number(delivery.pending || 0)}</strong>Pending</span>
          <span data-tone="${Number(delivery.failed || 0) ? 'error' : 'ok'}"><strong>${Number(delivery.failed || 0)}</strong>Failed</span>
        </div>
        <div class="nl558-delivery-list">
          ${deliveryRecent.length ? deliveryRecent.map(row => `
            <div class="nl558-delivery-row" data-status="${esc(row.status || 'pending')}">
              <div><strong>${esc(label(row.event_key || 'membership update'))}</strong><small>${esc(row.recipient || 'No email')} · ${esc(label(row.status || 'pending'))} · ${Number(row.attempts || 0)} attempt${Number(row.attempts || 0) === 1 ? '' : 's'}</small>${row.last_error ? `<p>${esc(row.last_error)}</p>` : ''}</div>
              ${row.status === 'failed' ? `<button type="button" data-retry-delivery="${Number(row.id)}">Retry email</button>` : ''}
            </div>`).join('') : '<div class="nl-membership-history-empty">No notification deliveries recorded yet.</div>'}
        </div>
      </section>

      <section class="nl-membership-history">
        <div class="nl-membership-history-head">
          <h3>Membership Audit History</h3>
          <span>${history.length} record${history.length === 1 ? '' : 's'}</span>
        </div>
        <div class="nl-membership-history-list">
          ${history.length
            ? history.map(historyRow).join('')
            : '<div class="nl-membership-history-empty">No membership audit history yet.</div>'}
        </div>
      </section>
    `;

    bindDecisionForm(detail);

    panelEl.querySelectorAll('[data-retry-delivery]').forEach(button => {
      button.addEventListener('click', async () => {
        const deliveryId = Number(button.dataset.retryDelivery || 0);
        if (!deliveryId) return;
        button.disabled = true;
        button.textContent = 'Retrying…';
        notice('');
        try {
          const result = await request(
            `/api/nurselink/admin/membership-command/${encodeURIComponent(membership.id)}/notification-deliveries/${encodeURIComponent(deliveryId)}/retry`,
            { method: 'POST', body: JSON.stringify({}) }
          );
          notice(result?.message || 'Notification delivery retried.', result?.data?.status === 'failed' ? 'warning' : 'success');
          await openMembership(membership.id);
        } catch (error) {
          notice(error.message, 'error');
          button.disabled = false;
          button.textContent = 'Retry email';
        }
      });
    });
  }

  function bindDecisionForm(detail) {
    const form = document.getElementById('membershipDecisionForm');
    if (!form) return;

    const status = document.getElementById('membershipNextStatus');
    const reasonField = document.getElementById('decisionReasonField');
    const reason = document.getElementById('membershipDecisionReason');
    const warning = document.getElementById('decisionWarning');
    const button = document.getElementById('membershipDecisionButton');

    function syncDecisionUi() {
      const value = status.value;
      const reasonRequired = ['needs_information', 'declined'].includes(value);

      reasonField.hidden = !reasonRequired;
      if (reason) reason.required = reasonRequired;

      warning.dataset.tone = '';

      if (!value) {
        warning.textContent = 'Select a next status to continue.';
        return;
      }

      if (value === 'approved') {
        warning.dataset.tone = 'approval';
        warning.textContent =
          'Approval will issue the permanent NurseLink member number and activate member-only access.';
        return;
      }

      if (value === 'declined') {
        warning.dataset.tone = 'decline';
        warning.textContent =
          'Decline is a final command-center decision. A reason is required.';
        return;
      }

      if (value === 'needs_information') {
        warning.dataset.tone = 'warning';
        warning.textContent =
          'The applicant will be notified to review the information request.';
        return;
      }

      warning.textContent =
        `Application will move to ${label(value)}.`;
    }

    status.addEventListener('change', syncDecisionUi);
    syncDecisionUi();

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const nextStatus = status.value;
      if (!nextStatus) return;

      if (nextStatus === 'approved') {
        const confirmed = window.confirm(
          'Approve this NurseLink membership and issue the permanent member number?'
        );
        if (!confirmed) return;
      }

      if (nextStatus === 'declined') {
        const confirmed = window.confirm(
          'Decline this NurseLink membership application? This command-center workflow treats decline as final.'
        );
        if (!confirmed) return;
      }

      const selfConfirm = document.getElementById('membershipSelfConfirm');

      button.disabled = true;
      button.textContent = 'Saving…';
      notice('');

      try {
        const result = await request(
          `/api/nurselink/admin/membership-command/${encodeURIComponent(detail.membership.id)}/transition`,
          {
            method: 'POST',
            body: JSON.stringify({
              status: nextStatus,
              reviewer_notes:
                document.getElementById('membershipReviewerNotes')?.value?.trim()
                || null,
              decision_reason: reason?.value?.trim() || null,
              confirm_self_action: !!selfConfirm?.checked
            })
          }
        );

        notice(result?.message || 'Membership review saved.', 'success');

        await Promise.all([
          loadSummary(),
          loadQueue()
        ]);

        await openMembership(detail.membership.id);
      } catch (error) {
        notice(error.message, 'error');

        if (error.payload?.confirmation_required && selfConfirm) {
          selfConfirm.focus();
        }
      } finally {
        button.disabled = false;
        button.textContent = 'Save Review Action';
      }
    });
  }

  async function openMembership(id) {
    selectedMembershipId = Number(id);

    panelEl.innerHTML = `
      <div class="nl-admin-loading">Loading membership review…</div>
    `;

    try {
      const [detailResult, historyResult] = await Promise.all([
        request(`/api/nurselink/admin/membership-command/${encodeURIComponent(id)}`),
        request(`/api/nurselink/admin/membership-command/${encodeURIComponent(id)}/history`)
      ]);

      renderReviewPanel(
        detailResult?.data || {},
        Array.isArray(historyResult?.data) ? historyResult.data : []
      );
    } catch (error) {
      if ([401, 403, 419].includes(error.status)) {
        redirectToAdminLogin();
        return;
      }

      panelEl.innerHTML = `
        <div class="nl-admin-empty">${esc(error.message)}</div>
      `;
    }
  }

  refreshButton?.addEventListener('click', async () => {
    notice('');
    await Promise.all([loadSummary(), loadQueue()]);
    if (selectedMembershipId) {
      await openMembership(selectedMembershipId);
    }
  });

  statusFilter?.addEventListener('change', loadQueue);

  searchInput?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(loadQueue, 250);
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
      const sessionPayload = await request(
        '/api/nurselink/admin/session'
      );
      renderIdentity(sessionPayload?.data || {});

      await Promise.all([
        loadSummary(),
        loadQueue()
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
