(() => {
  const API = 'https://api.amsertech.com';

  const $ = id => document.getElementById(id);
  const noticeEl = $('membershipAdminNotice');
  const identityEl = $('adminIdentity');
  const summaryEl = $('membershipAdminSummary');
  const queueEl = $('reviewQueueArea');
  const detailEl = $('reviewDetailArea');
  const membersEl = $('memberLifecycleArea');
  const staffEl = $('staffAccessArea');
  const activityEl = $('membershipActivityArea');
  const grantForm = $('grantRoleForm');

  let session = null;
  let overview = null;
  let staffRows = [];
  let selectedMembershipId = null;
  let searchTimer = null;

  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const label = value => ({
    submitted: 'Submitted',
    under_review: 'Under Review',
    needs_information: 'Needs Information',
    ready_for_approval: 'Ready for Approval',
    approved: 'Approved',
    declined: 'Declined',
    active: 'Active',
    suspended: 'Suspended',
    inactive: 'Inactive',
    reviewer: 'Reviewer',
    admin: 'Administrator',
    super_admin: 'Super Administrator',
    revoked: 'Revoked',
    urgent: 'Urgent',
    high: 'High',
    normal: 'Normal',
    low: 'Low'
  })[value] || String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

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
      throw new Error('Unable to initialize secure Administrator request.');
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
      headers,
      credentials: 'include'
    });

    let payload = null;
    try { payload = await response.json(); } catch (_) {}

    if (!response.ok) {
      const error = new Error(
        payload?.message || `Administrator request failed (${response.status}).`
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

  function redirectToLogin() {
    const target = '/nurselink-membership-administration.html';
    try {
      sessionStorage.setItem('nurselink_admin_return', target);
    } catch (_) {}

    window.location.replace(
      `/nurselink-admin-login.html?return=${encodeURIComponent(target)}`
    );
  }

  function needsAdminLogin(error) {
    if ([401, 419].includes(error.status)) return true;
    if (error.status !== 403) return false;

    return /separate NurseLink (?:Administrator Portal|administrator) sign-in is required/i
      .test(String(error.message || ''));
  }

  function stat(title, value, note = '', tone = '') {
    return `
      <div class="nma-stat" data-tone="${esc(tone)}">
        <span>${esc(title)}</span>
        <strong>${esc(value)}</strong>
        <small>${esc(note)}</small>
      </div>
    `;
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
  }

  function applyPermissions() {
    const permissions = overview?.permissions || {};
    const adminOnly = ['lifecycle', 'staff', 'activity'];

    document.querySelectorAll('[data-tab]').forEach(button => {
      if (
        adminOnly.includes(button.dataset.tab)
        && !permissions.can_final_decide
      ) {
        button.hidden = true;
      }
    });

    grantForm.hidden = !permissions.can_manage_roles;
  }

  function renderOverview(data) {
    overview = data || {};
    const counts = overview.counts || {};
    const aging = overview.aging || {};
    const standing = overview.standing || {};
    const staff = overview.staff || {};

    summaryEl.innerHTML = [
      stat(
        'Pending Applications',
        overview.pending_total ?? 0,
        `${counts.ready_for_approval ?? 0} ready for approval`,
        Number(overview.pending_total || 0) ? 'attention' : 'good'
      ),
      stat(
        'Overdue Reviews',
        overview.overdue_reviews ?? 0,
        `${overview.unassigned_reviews ?? 0} unassigned`,
        Number(overview.overdue_reviews || 0) ? 'danger' : 'good'
      ),
      stat(
        'Approved Members',
        counts.approved ?? 0,
        `${standing.active ?? 0} active`
      ),
      stat(
        'Standing Attention',
        Number(standing.suspended || 0) + Number(standing.inactive || 0),
        `${standing.suspended ?? 0} suspended · ${standing.inactive ?? 0} inactive`
      ),
      stat(
        'Privileged Staff',
        staff.total_privileged ?? 0,
        `${staff.reviewers ?? 0} reviewers · ${staff.administrators ?? 0} admins · ${staff.super_administrators ?? 0} super`
      ),
      stat(
        'Aging 15+ Days',
        aging['15_plus_days'] ?? 0,
        `${aging['8_14_days'] ?? 0} at 8–14 days`,
        Number(aging['15_plus_days'] || 0) ? 'danger' : ''
      )
    ].join('');

    applyPermissions();
  }

  async function loadOverview() {
    const payload = await request(
      '/api/nurselink/admin/membership-administration/overview'
    );
    renderOverview(payload?.data || {});
  }

  function priorityTone(priority) {
    return ({
      urgent: 'danger',
      high: 'attention',
      normal: '',
      low: 'muted'
    })[priority] || '';
  }

  function queueCard(row) {
    const assigned = row.assigned_reviewer || {};
    return `
      <button type="button"
        class="nma-queue-card ${Number(row.membership_id) === selectedMembershipId ? 'selected' : ''}"
        data-membership="${esc(row.membership_id)}">
        <div>
          <span class="nma-priority" data-tone="${esc(priorityTone(row.review_priority))}">
            ${esc(label(row.review_priority))}
          </span>
          ${row.overdue ? '<span class="nma-overdue">OVERDUE</span>' : ''}
          ${row.is_assigned_to_me ? '<span class="nma-mine">ASSIGNED TO YOU</span>' : ''}
        </div>
        <strong>${esc(row.name)}</strong>
        <small>${esc(row.email)}</small>
        <div class="nma-queue-meta">
          <span>${esc(label(row.status))}</span>
          <span>${row.age_days === null ? 'Age unavailable' : `${esc(row.age_days)} day(s) old`}</span>
          <span>${row.review_due_at ? `Due ${esc(new Date(row.review_due_at).toLocaleString())}` : 'No review due date'}</span>
          <span>${assigned.name ? `Assigned: ${esc(assigned.name)}` : 'Unassigned'}</span>
        </div>
      </button>
    `;
  }

  async function loadQueue() {
    queueEl.innerHTML = '<div class="nl-admin-loading">Loading applications…</div>';

    const params = new URLSearchParams();
    const search = $('reviewSearch').value.trim();
    const status = $('reviewStatus').value;
    const priority = $('reviewPriority').value;
    const assignment = $('reviewAssignment').value;

    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    if (assignment) params.set('assignment', assignment);
    if ($('reviewOverdue').checked) params.set('overdue', '1');

    try {
      const payload = await request(
        `/api/nurselink/admin/membership-administration/queue?${params}`
      );

      const rows = Array.isArray(payload?.data) ? payload.data : [];

      queueEl.innerHTML = rows.length
        ? rows.map(queueCard).join('')
        : '<div class="nma-empty">No membership applications match the selected filters.</div>';

      queueEl.querySelectorAll('[data-membership]').forEach(button => {
        button.addEventListener('click', () => {
          openReview(Number(button.dataset.membership));
        });
      });
    } catch (error) {
      queueEl.innerHTML = `<div class="nma-empty">${esc(error.message)}</div>`;
    }
  }

  function signal(title, value, tone = '') {
    return `
      <div class="nma-signal" data-tone="${esc(tone)}">
        <span>${esc(title)}</span>
        <strong>${esc(value)}</strong>
      </div>
    `;
  }

  function historyItem(row) {
    const afterStatus = row?.after?.status;
    return `
      <div class="nma-history-item">
        <span></span>
        <div>
          <strong>${esc(row.action || 'Administrative action')}</strong>
          <small>
            ${esc(row.reviewer_name || row.reviewer_email || row.reviewer_user_id || 'NurseLink Staff')}
            · ${esc(row.created_at || '')}
            ${afterStatus ? ` · ${esc(label(afterStatus))}` : ''}
          </small>
        </div>
      </div>
    `;
  }

  function staffOptions(selectedId = '') {
    const options = [
      '<option value="">Unassigned</option>'
    ];

    staffRows
      .filter(row => row.active)
      .forEach(row => {
        options.push(
          `<option value="${esc(row.user_id)}" ${String(row.user_id) === String(selectedId) ? 'selected' : ''}>${esc(row.name)} · ${esc(row.role_label)} · ${esc(row.pending_workload)} pending</option>`
        );
      });

    return options.join('');
  }

  async function ensureStaff() {
    if (staffRows.length) return;

    if (!overview?.permissions?.can_final_decide) return;

    try {
      const payload = await request(
        '/api/nurselink/admin/membership-administration/staff'
      );
      staffRows = Array.isArray(payload?.data) ? payload.data : [];
    } catch (_) {
      staffRows = [];
    }
  }

  async function openReview(membershipId) {
    selectedMembershipId = membershipId;
    detailEl.innerHTML = '<div class="nl-admin-loading">Loading application review…</div>';

    await ensureStaff();

    try {
      const [detailPayload, historyPayload] = await Promise.all([
        request(`/api/nurselink/admin/membership-command/${membershipId}`),
        request(`/api/nurselink/admin/membership-command/${membershipId}/history`)
      ]);

      const detail = detailPayload?.data || {};
      const history = Array.isArray(historyPayload?.data)
        ? historyPayload.data
        : [];

      const membership = detail.membership || {};
      const applicant = detail.applicant || {};
      const profile = detail.profile || {};
      const review = detail.review || {};
      const allowed = Array.isArray(review.allowed_actions)
        ? review.allowed_actions
        : [];
      const credentials = profile.credentials || {};

      const queuePayload = await request(
        `/api/nurselink/admin/membership-administration/queue?search=${encodeURIComponent(applicant.email || '')}&status=${encodeURIComponent(membership.status || '')}`
      );
      const queueRow = (Array.isArray(queuePayload?.data) ? queuePayload.data : [])
        .find(row => Number(row.membership_id) === membershipId) || {};

      detailEl.innerHTML = `
        <div class="nma-detail-head">
          <div>
            <span class="nl-admin-eyebrow">APPLICATION #${esc(membership.id)}</span>
            <h2>${esc(applicant.name || 'Applicant')}</h2>
            <p>${esc(applicant.email || '')}</p>
          </div>
          <span class="nma-status" data-status="${esc(membership.status)}">
            ${esc(membership.status_label || label(membership.status))}
          </span>
        </div>

        <div class="nma-signals">
          ${signal('Profile Photo', profile.profile_photo_uploaded ? 'Uploaded' : 'Missing', profile.profile_photo_uploaded ? 'good' : 'attention')}
          ${signal('Employment', profile.employment_records === null ? 'Unavailable' : String(profile.employment_records), Number(profile.employment_records || 0) > 0 ? 'good' : 'attention')}
          ${signal('Credentials', credentials.total === undefined ? 'Unavailable' : `${credentials.verified || 0}/${credentials.total || 0} verified`, Number(credentials.pending || 0) || Number(credentials.expired || 0) ? 'attention' : 'good')}
          ${signal('Member Number', membership.member_number || 'Pending')}
        </div>

        ${overview?.permissions?.can_assign_reviews ? `
        <form id="reviewAssignmentForm" class="nma-subpanel">
          <div class="nma-subhead">
            <div><strong>Review Assignment</strong><small>Set owner, priority and target review date.</small></div>
          </div>
          <div class="nma-form-grid">
            <label class="wide"><span>Assigned reviewer</span><select id="assignedReviewer">${staffOptions(queueRow.assigned_reviewer_user_id)}</select></label>
            <label><span>Priority</span><select id="assignedPriority"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
            <label><span>Review due</span><input id="assignedDue" type="datetime-local"></label>
            <button type="submit">Save Assignment</button>
          </div>
        </form>` : ''}

        <section class="nma-subpanel">
          <strong>Current Reviewer Notes</strong>
          <p>${membership.reviewer_notes ? esc(membership.reviewer_notes) : 'No reviewer notes recorded.'}</p>
        </section>

        <section class="nma-subpanel">
          <div class="nma-subhead">
            <div>
              <strong>Membership Decision Workflow</strong>
              <small>Final approval or decline requires Administrator access. Approval requires Ready for Approval status.</small>
            </div>
          </div>
          ${allowed.length ? `
          <form id="membershipDecisionForm" class="nma-form-grid">
            <label><span>Next status</span><select id="membershipNextStatus" required><option value="">Choose action</option>${allowed.map(value => `<option value="${esc(value)}">${esc(label(value))}</option>`).join('')}</select></label>
            <label class="wide"><span>Reviewer notes</span><textarea id="membershipReviewerNotes" rows="4" maxlength="6000">${esc(membership.reviewer_notes || '')}</textarea></label>
            <label class="wide"><span>Decision / information-request reason</span><textarea id="membershipDecisionReason" rows="3" maxlength="3000" placeholder="Required for Needs Information or Declined"></textarea></label>
            ${review.is_self ? '<label class="nma-checkbox wide"><input id="membershipSelfConfirm" type="checkbox"><span>I explicitly confirm this Super Administrator action on my own membership.</span></label>' : ''}
            <button type="submit">Apply Membership Action</button>
          </form>` : '<div class="nma-empty">No membership review transitions are available for this application and role.</div>'}
        </section>

        <section class="nma-subpanel">
          <strong>Review History</strong>
          <div class="nma-history">
            ${history.length ? history.map(historyItem).join('') : '<div class="nma-empty">No membership review history recorded.</div>'}
          </div>
        </section>
      `;

      const assignmentForm = $('reviewAssignmentForm');
      if (assignmentForm) {
        $('assignedPriority').value = queueRow.review_priority || 'normal';

        if (queueRow.review_due_at) {
          const due = new Date(queueRow.review_due_at);
          const pad = n => String(n).padStart(2, '0');
          $('assignedDue').value = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T${pad(due.getHours())}:${pad(due.getMinutes())}`;
        }

        assignmentForm.addEventListener('submit', async event => {
          event.preventDefault();
          try {
            const payload = {
              reviewer_user_id: $('assignedReviewer').value || null,
              priority: $('assignedPriority').value,
              review_due_at: $('assignedDue').value
                ? new Date($('assignedDue').value).toISOString()
                : null
            };

            await request(
              `/api/nurselink/admin/membership-administration/${membershipId}/assignment`,
              {
                method: 'PUT',
                body: JSON.stringify(payload)
              }
            );

            notice('Review assignment saved.', 'success');
            await Promise.all([loadOverview(), loadQueue()]);
            await openReview(membershipId);
          } catch (error) {
            notice(error.message, 'error');
          }
        });
      }

      const decisionForm = $('membershipDecisionForm');
      if (decisionForm) {
        decisionForm.addEventListener('submit', async event => {
          event.preventDefault();

          const status = $('membershipNextStatus').value;
          if (!status) return;

          const finalAction = ['approved', 'declined'].includes(status);
          if (
            finalAction
            && !window.confirm(
              `${label(status)} this NurseLink membership application?`
            )
          ) {
            return;
          }

          try {
            const payload = {
              status,
              reviewer_notes: $('membershipReviewerNotes').value.trim() || null,
              decision_reason: $('membershipDecisionReason').value.trim() || null,
              confirm_self_action: !!$('membershipSelfConfirm')?.checked
            };

            const result = await request(
              `/api/nurselink/admin/membership-command/${membershipId}/transition`,
              {
                method: 'POST',
                body: JSON.stringify(payload)
              }
            );

            notice(
              result?.message || 'Membership action saved.',
              'success'
            );

            await Promise.all([loadOverview(), loadQueue()]);
            await openReview(membershipId);
          } catch (error) {
            notice(error.message, 'error');
          }
        });
      }

      await loadQueue();
    } catch (error) {
      detailEl.innerHTML = `<div class="nma-empty">${esc(error.message)}</div>`;
    }
  }

  function memberRow(row) {
    const standing = row.standing || 'active';
    const actions = ({
      active: ['suspended', 'inactive'],
      suspended: ['active', 'inactive'],
      inactive: ['active']
    })[standing] || [];

    return `
      <article class="nma-member-row" data-membership="${esc(row.membership_id)}">
        <div>
          <span>${esc(row.member_number || '')}</span>
          <strong>${esc(row.name)}</strong>
          <small>${esc(row.email)}</small>
        </div>
        <div class="nma-member-signals">
          <span data-standing="${esc(standing)}">${esc(label(standing))}</span>
          <small>${esc(row.credentials?.verified ?? 0)} verified credential(s) · ${esc(row.employment_records ?? 0)} employment record(s)</small>
        </div>
        <div class="nma-member-actions">
          ${actions.map(value => `<button type="button" data-standing-action="${esc(value)}">${value === 'active' ? 'Reactivate' : value === 'suspended' ? 'Suspend' : 'Set Inactive'}</button>`).join('')}
        </div>
      </article>
    `;
  }

  async function changeStanding(membershipId, standing) {
    const reason = window.prompt(
      `Reason for changing membership standing to ${label(standing)}:`
    );

    if (!reason || reason.trim().length < 3) return;

    async function send(confirmSelf = false) {
      return request(
        `/api/nurselink/admin/membership-lifecycle/${membershipId}/standing`,
        {
          method: 'POST',
          body: JSON.stringify({
            standing,
            reason: reason.trim(),
            confirm_self_action: confirmSelf
          })
        }
      );
    }

    try {
      let result;
      try {
        result = await send(false);
      } catch (error) {
        if (
          error.payload?.confirmation_required
          && window.confirm(
            'This is your own membership. Confirm this explicit Super Administrator self-action?'
          )
        ) {
          result = await send(true);
        } else {
          throw error;
        }
      }

      notice(
        result?.message || 'Membership standing updated.',
        'success'
      );
      await Promise.all([loadOverview(), loadMembers()]);
    } catch (error) {
      notice(error.message, 'error');
    }
  }

  async function loadMembers() {
    if (!overview?.permissions?.can_manage_standing) {
      membersEl.innerHTML = '<div class="nma-empty">Administrator access is required to manage membership standing.</div>';
      return;
    }

    membersEl.innerHTML = '<div class="nl-admin-loading">Loading approved members…</div>';

    const params = new URLSearchParams();
    const search = $('memberSearch').value.trim();
    const standing = $('memberStanding').value || 'all';
    if (search) params.set('search', search);
    params.set('standing', standing);

    try {
      const payload = await request(
        `/api/nurselink/admin/member-registry?${params}`
      );

      const rows = Array.isArray(payload?.data) ? payload.data : [];
      membersEl.innerHTML = rows.length
        ? `<div class="nma-member-list">${rows.map(memberRow).join('')}</div>`
        : '<div class="nma-empty">No approved members match the selected filters.</div>';

      membersEl.querySelectorAll('[data-standing-action]').forEach(button => {
        button.addEventListener('click', () => {
          const row = button.closest('[data-membership]');
          changeStanding(
            Number(row.dataset.membership),
            button.dataset.standingAction
          );
        });
      });
    } catch (error) {
      membersEl.innerHTML = `<div class="nma-empty">${esc(error.message)}</div>`;
    }
  }

  function staffRow(row, canManage) {
    return `
      <article class="nma-staff-row" data-user="${esc(row.user_id)}" data-email="${esc(row.email)}">
        <div>
          <strong>${esc(row.name)}</strong>
          <small>${esc(row.email)}</small>
          ${row.is_current_user ? '<em>CURRENT SESSION</em>' : ''}
        </div>
        <div>
          <span class="nma-role" data-role="${esc(row.role)}">${esc(row.role_label)}</span>
          <small>${esc(row.pending_workload)} pending review(s)</small>
        </div>
        <div class="nma-staff-actions">
          ${canManage ? `
          <select class="nma-role-select" ${row.is_current_user ? 'disabled' : ''}>
            <option value="reviewer" ${row.role === 'reviewer' ? 'selected' : ''}>Reviewer</option>
            <option value="admin" ${row.role === 'admin' ? 'selected' : ''}>Administrator</option>
            <option value="super_admin" ${row.role === 'super_admin' ? 'selected' : ''}>Super Administrator</option>
          </select>
          <button type="button" data-role-apply ${row.is_current_user ? 'disabled' : ''}>Apply Role</button>
          <button type="button" class="danger" data-role-revoke ${row.is_current_user ? 'disabled' : ''}>Revoke</button>
          ` : '<small>View only — Super Administrator required for role changes.</small>'}
        </div>
      </article>
    `;
  }

  async function loadStaff() {
    if (!overview?.permissions?.can_final_decide) {
      staffEl.innerHTML = '<div class="nma-empty">Administrator access is required to view privileged staff.</div>';
      return;
    }

    staffEl.innerHTML = '<div class="nl-admin-loading">Loading privileged staff…</div>';

    try {
      const payload = await request(
        '/api/nurselink/admin/membership-administration/staff'
      );

      staffRows = Array.isArray(payload?.data) ? payload.data : [];
      const canManage = !!payload?.permissions?.can_manage_roles;
      grantForm.hidden = !canManage;

      staffEl.innerHTML = staffRows.length
        ? `<div class="nma-staff-list">${staffRows.map(row => staffRow(row, canManage)).join('')}</div>`
        : '<div class="nma-empty">No privileged NurseLink staff found.</div>';

      if (canManage) {
        staffEl.querySelectorAll('[data-role-apply]').forEach(button => {
          button.addEventListener('click', async () => {
            const row = button.closest('[data-user]');
            const email = row.dataset.email;
            const role = row.querySelector('.nma-role-select')?.value;
            if (!email || !role) return;

            try {
              await request('/api/nurselink/admin/users/grant', {
                method: 'POST',
                body: JSON.stringify({ email, role })
              });
              notice(`Role updated for ${email}.`, 'success');
              staffRows = [];
              await Promise.all([loadOverview(), loadStaff()]);
            } catch (error) {
              notice(error.message, 'error');
            }
          });
        });

        staffEl.querySelectorAll('[data-role-revoke]').forEach(button => {
          button.addEventListener('click', async () => {
            const row = button.closest('[data-user]');
            const userId = row.dataset.user;
            const email = row.dataset.email;

            if (!window.confirm(`Revoke privileged NurseLink access for ${email}?`)) {
              return;
            }

            try {
              await request(
                `/api/nurselink/admin/users/${encodeURIComponent(userId)}`,
                {
                  method: 'DELETE',
                  body: '{}'
                }
              );
              notice(`Privileged access revoked for ${email}.`, 'success');
              staffRows = [];
              await Promise.all([loadOverview(), loadStaff()]);
            } catch (error) {
              notice(error.message, 'error');
            }
          });
        });
      }
    } catch (error) {
      staffEl.innerHTML = `<div class="nma-empty">${esc(error.message)}</div>`;
    }
  }

  function activityRow(row) {
    return `
      <div class="nma-activity-row">
        <span></span>
        <div>
          <strong>${esc(String(row.action || '').replace(/\./g, ' → '))}</strong>
          <small>
            ${esc(row.reviewer_name || row.reviewer_email || row.reviewer_user_id)}
            · ${esc(row.target_type)} #${esc(row.target_id)}
            · ${esc(row.created_at || '')}
          </small>
        </div>
      </div>
    `;
  }

  async function loadActivity() {
    if (!overview?.permissions?.can_final_decide) {
      activityEl.innerHTML = '<div class="nma-empty">Administrator access is required to view administrative audit activity.</div>';
      return;
    }

    activityEl.innerHTML = '<div class="nl-admin-loading">Loading audit activity…</div>';

    try {
      const payload = await request(
        '/api/nurselink/admin/membership-administration/activity'
      );
      const rows = Array.isArray(payload?.data) ? payload.data : [];

      activityEl.innerHTML = rows.length
        ? `<div class="nma-activity-list">${rows.map(activityRow).join('')}</div>`
        : '<div class="nma-empty">No membership or staff-access audit activity found.</div>';
    } catch (error) {
      activityEl.innerHTML = `<div class="nma-empty">${esc(error.message)}</div>`;
    }
  }

  grantForm?.addEventListener('submit', async event => {
    event.preventDefault();

    const email = $('grantRoleEmail').value.trim();
    const role = $('grantRoleValue').value;
    if (!email || !role) return;

    try {
      await request('/api/nurselink/admin/users/grant', {
        method: 'POST',
        body: JSON.stringify({ email, role })
      });

      $('grantRoleEmail').value = '';
      notice(`${label(role)} access saved for ${email}.`, 'success');
      staffRows = [];
      await Promise.all([loadOverview(), loadStaff()]);
    } catch (error) {
      notice(error.message, 'error');
    }
  });

  document.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach(item => {
        item.classList.toggle('active', item === button);
      });

      document.querySelectorAll('.nma-tab').forEach(tab => {
        tab.classList.toggle(
          'active',
          tab.id === `tab-${button.dataset.tab}`
        );
      });

      if (button.dataset.tab === 'lifecycle') loadMembers();
      if (button.dataset.tab === 'staff') loadStaff();
      if (button.dataset.tab === 'activity') loadActivity();
    });
  });

  $('refreshReviewQueue')?.addEventListener('click', loadQueue);
  $('refreshMembers')?.addEventListener('click', loadMembers);
  $('refreshActivity')?.addEventListener('click', loadActivity);

  ['reviewStatus', 'reviewPriority', 'reviewAssignment', 'reviewOverdue']
    .forEach(id => $(id)?.addEventListener('change', loadQueue));

  $('reviewSearch')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadQueue, 350);
  });

  $('memberStanding')?.addEventListener('change', loadMembers);
  $('memberSearch')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadMembers, 350);
  });

  $('adminSignOut')?.addEventListener('click', async () => {
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

      await loadOverview();
      await loadQueue();
    } catch (error) {
      if (needsAdminLogin(error)) {
        redirectToLogin();
        return;
      }

      notice(error.message, 'error');
    }
  }

  boot();
})();