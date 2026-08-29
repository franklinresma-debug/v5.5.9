(() => {
  const API = 'https://api.amsertech.com';
  const summaryEl = document.getElementById('renewalSummary');
  const listEl = document.getElementById('renewalList');
  const filterEl = document.getElementById('renewalFilter');
  const refreshEl = document.getElementById('refreshRenewal');
  const noticeEl = document.getElementById('renewalNotice');

  let credentials = [];

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
    const response = await fetch(
      `${API}/sanctum/csrf-cookie`,
      {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        'Unable to initialize secure renewal request.'
      );
    }
  }

  async function request(path, options = {}) {
    const method = String(
      options.method || 'GET'
    ).toUpperCase();

    const mutating =
      !['GET', 'HEAD', 'OPTIONS'].includes(method);

    if (mutating) await csrf();

    const headers = {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.headers || {})
    };

    if (mutating) {
      headers['Content-Type'] = 'application/json';

      const token = decodeURIComponent(
        cookie('XSRF-TOKEN')
      );

      if (token) {
        headers['X-XSRF-TOKEN'] = token;
      }
    }

    const response = await fetch(`${API}${path}`, {
      ...options,
      method,
      credentials: 'include',
      headers
    });

    let payload = null;

    try {
      payload = await response.json();
    } catch (_) {}

    if (!response.ok) {
      const error = new Error(
        payload?.message
          || `Credential Renewal request failed (${response.status}).`
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

  function summaryCard(label, value, state) {
    return `
      <div class="cr-summary-card"
        data-state="${esc(state)}">
        <span>${esc(label)}</span>
        <strong>${esc(value)}</strong>
      </div>
    `;
  }

  function renderSummary(summary = {}, workflow = {}) {
    summaryEl.innerHTML = [
      ['Expired', summary.expired || 0, 'expired'],
      ['≤ 30 Days', summary.critical_30 || 0, 'critical'],
      ['31–90 Days', summary.due_90 || 0, 'due'],
      ['91–180 Days', summary.upcoming_180 || 0, 'planning'],
      ['Open Renewal Plans',
        (workflow.planning || 0)
          + (workflow.in_progress || 0)
          + (workflow.submitted || 0)
          + (workflow.returned || 0),
        'workflow'],
      ['Completed Plans',
        workflow.completed || 0,
        'completed']
    ].map(([label, value, state]) =>
      summaryCard(label, value, state)
    ).join('');
  }

  function daysText(row) {
    const days = row.days_until_expiry;

    if (days === null || days === undefined) {
      return 'No expiry date';
    }

    if (days < 0) {
      const amount = Math.abs(days);
      return `${amount} day${amount === 1 ? '' : 's'} expired`;
    }

    if (days === 0) return 'Expires today';

    return `${days} day${days === 1 ? '' : 's'} remaining`;
  }

  function workflowLabel(status) {
    return ({
      planning: 'Planning',
      in_progress: 'In Progress',
      submitted: 'Submitted',
      returned: 'Returned for Update',
      completed: 'Workflow Completed',
      cancelled: 'Cancelled'
    })[status] || 'Not Started';
  }

  function matchesFilter(row) {
    const filter = filterEl.value;

    if (filter === 'all') return true;

    if (filter === 'attention') {
      return [
        'expired',
        'critical_30',
        'due_90',
        'upcoming_180'
      ].includes(row.expiry_state);
    }

    if (filter === 'expired') {
      return row.expiry_state === 'expired';
    }

    if (filter === 'current') {
      return ['current', 'no_expiry']
        .includes(row.expiry_state);
    }

    if (filter === 'renewal_open') {
      return row.renewal
        && !['completed', 'cancelled']
          .includes(row.renewal.status);
    }

    return true;
  }

  function renewalForm(row) {
    const renewal = row.renewal;
    const closed = renewal
      && ['completed', 'cancelled']
        .includes(renewal.status);

    if (!renewal || closed) {
      return `
        <button type="button"
          class="cr-start-plan"
          data-start-renewal="${esc(row.id)}">
          ${renewal?.status === 'completed'
            ? 'Start New Renewal Cycle'
            : 'Start Renewal Plan'}
        </button>
      `;
    }

    return `
      <form class="cr-renewal-form"
        data-renewal-form="${esc(row.id)}"
        data-renewal-id="${esc(renewal.id)}">
        <div class="cr-renewal-form-grid">
          <label>
            <span>Workflow status</span>
            <select name="status" required>
              ${[
                ['planning', 'Planning'],
                ['in_progress', 'In Progress'],
                ['submitted', 'Submitted to Issuing Body'],
                ['cancelled', 'Cancel Plan']
              ].map(([value, label]) => `
                <option value="${value}"
                  ${renewal.status === value ? 'selected' : ''}>
                  ${label}
                </option>
              `).join('')}
            </select>
          </label>

          <label>
            <span>Target date</span>
            <input name="target_date"
              type="date"
              value="${esc(renewal.target_date || '')}">
          </label>
        </div>

        <label>
          <span>Renewal notes</span>
          <textarea name="notes"
            rows="2"
            maxlength="3000"
            placeholder="Planning notes, appointment details or next steps">${esc(renewal.notes || '')}</textarea>
        </label>

        <label>
          <span>Evidence / reference</span>
          <input name="evidence_reference"
            type="text"
            maxlength="512"
            value="${esc(renewal.evidence_reference || '')}"
            placeholder="Optional reference number or internal note">
        </label>

        ${renewal.status === 'returned' ? `
          <div class="cr-returned-note">
            This workflow was returned for update.
            Review the notes, revise the plan, then
            move it to In Progress or Submitted.
          </div>
        ` : ''}

        <button type="submit">
          Update Renewal Workflow
        </button>
      </form>
    `;
  }

  function renderList() {
    const rows = credentials.filter(matchesFilter);

    if (!rows.length) {
      listEl.innerHTML = `
        <div class="cr-empty">
          No credentials match the selected renewal filter.
        </div>
      `;
      return;
    }

    listEl.innerHTML = rows.map(row => `
      <article class="cr-row"
        data-state="${esc(row.expiry_state)}"
        data-priority="${esc(row.priority)}">
        <div class="cr-row-main">
          <span>
            ${esc(row.credential_type || 'credential')}
          </span>
          <strong>
            ${esc(row.title || 'Credential')}
          </strong>
          <small>
            ${esc(
              row.issuing_body
                || 'Issuing body not specified'
            )}
            ${row.country
              ? ` · ${esc(row.country)}`
              : ''}
          </small>
        </div>

        <div class="cr-row-expiry">
          <span>${esc(row.expiry_label)}</span>
          <strong>${esc(row.expiry_date || '—')}</strong>
          <small>${esc(daysText(row))}</small>
        </div>

        <div class="cr-row-review">
          <span>Verification</span>
          <strong>
            ${esc(
              row.verification_status || 'unverified'
            )}
          </strong>

          <span class="cr-workflow-label">
            Renewal workflow
          </span>
          <strong class="cr-workflow-status"
            data-status="${esc(
              row.renewal?.status || 'none'
            )}">
            ${esc(
              workflowLabel(row.renewal?.status)
            )}
          </strong>
        </div>

        <div class="cr-row-action">
          <span>Recommended action</span>
          <p>
            ${esc(row.recommended_action || '')}
          </p>
          <a href="/credentials">
            Open Credential Registry
          </a>
        </div>

        <div class="cr-renewal-workflow">
          ${renewalForm(row)}
        </div>
      </article>
    `).join('');

    bindRowActions();
  }

  async function startPlan(credentialId) {
    const result = await request(
      `/api/credential-renewal/${encodeURIComponent(
        credentialId
      )}`,
      {
        method: 'POST',
        body: JSON.stringify({
          status: 'planning'
        })
      }
    );

    notice(
      result?.message
        || 'Renewal plan started.',
      'success'
    );

    await load();
  }

  async function updatePlan(form) {
    const credentialId =
      form.dataset.renewalForm;

    const renewalId =
      form.dataset.renewalId;

    const data = new FormData(form);

    const result = await request(
      `/api/credential-renewal/${encodeURIComponent(
        credentialId
      )}/${encodeURIComponent(renewalId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: data.get('status'),
          target_date:
            data.get('target_date') || null,
          notes:
            data.get('notes') || null,
          evidence_reference:
            data.get('evidence_reference') || null
        })
      }
    );

    notice(
      result?.message
        || 'Renewal workflow updated.',
      'success'
    );

    await load();
  }

  function bindRowActions() {
    listEl
      .querySelectorAll('[data-start-renewal]')
      .forEach(button => {
        button.addEventListener(
          'click',
          async () => {
            button.disabled = true;
            notice('');

            try {
              await startPlan(
                button.dataset.startRenewal
              );
            } catch (error) {
              notice(error.message, 'error');
              button.disabled = false;
            }
          }
        );
      });

    listEl
      .querySelectorAll('[data-renewal-form]')
      .forEach(form => {
        form.addEventListener(
          'submit',
          async event => {
            event.preventDefault();

            const button =
              form.querySelector(
                'button[type="submit"]'
              );

            button.disabled = true;
            notice('');

            try {
              await updatePlan(form);
            } catch (error) {
              notice(error.message, 'error');
              button.disabled = false;
            }
          }
        );
      });
  }

  async function load() {
    listEl.innerHTML =
      '<div class="cr-loading">Loading credential records…</div>';

    notice('');

    try {
      const payload = await request(
        '/api/credential-renewal'
      );

      const data = payload?.data || {};

      credentials = Array.isArray(
        data.credentials
      )
        ? data.credentials
        : [];

      renderSummary(
        data.summary || {},
        data.workflow_summary || {}
      );

      renderList();
    } catch (error) {
      if ([401, 403, 419].includes(error.status)) {
        notice(
          error.status === 403
            ? 'Active approved NurseLink membership is required to use the Credential Renewal Center.'
            : 'Please sign in again to use the Credential Renewal Center.',
          'error'
        );
      } else {
        notice(error.message, 'error');
      }

      summaryEl.innerHTML = '';
      listEl.innerHTML = `
        <div class="cr-empty">
          Credential renewal information is unavailable.
        </div>
      `;
    }
  }

  filterEl?.addEventListener(
    'change',
    renderList
  );

  refreshEl?.addEventListener(
    'click',
    load
  );

  load();
})();
