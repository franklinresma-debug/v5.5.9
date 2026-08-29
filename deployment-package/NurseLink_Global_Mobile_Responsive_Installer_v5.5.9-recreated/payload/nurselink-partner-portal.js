(() => {
  const API = 'https://api.amsertech.com/api/partner';
  const root = document.getElementById('partnerRoot');
  const refreshButton = document.getElementById('refreshButton');

  const state = {
    me: null,
    summary: null,
    opportunities: [],
    applications: [],
    analytics: null
  };

  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const cookie = name => {
    const prefix = `${name}=`;
    const part = document.cookie
      .split(';')
      .map(value => value.trim())
      .find(value => value.startsWith(prefix));

    return part ? part.slice(prefix.length) : '';
  };

  async function csrf() {
    const response = await fetch('https://api.amsertech.com/sanctum/csrf-cookie', {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`Unable to establish secure NurseLink session (${response.status}).`);
    }
  }

  async function request(path = '', options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || {});

    headers.set('Accept', 'application/json');
    headers.set('X-Requested-With', 'XMLHttpRequest');

    if (!['GET', 'HEAD'].includes(method)) {
      await csrf();
      headers.set('Content-Type', 'application/json');

      const token = cookie('XSRF-TOKEN');

      if (token) {
        try {
          headers.set('X-XSRF-TOKEN', decodeURIComponent(token));
        } catch (_) {
          headers.set('X-XSRF-TOKEN', token);
        }
      }
    }

    const response = await fetch(`${API}${path}`, {
      ...options,
      method,
      headers,
      credentials: 'include'
    });

    let payload = null;

    try {
      payload = await response.json();
    } catch (_) {}

    if (!response.ok) {
      throw new Error(
        payload?.message ||
        (response.status === 401
          ? 'Please sign in to NurseLink first.'
          : response.status === 403
            ? 'Your account does not have verified NurseLink partner access.'
            : `NurseLink request failed (${response.status}).`)
      );
    }

    return payload;
  }

  async function nurseLinkSession() {
    const response = await fetch('https://api.amsertech.com/api/me', {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    let payload = null;

    try {
      payload = await response.json();
    } catch (_) {}

    if (response.status === 401 || response.status === 403) {
      return {
        authenticated: false,
        status: response.status,
        payload
      };
    }

    if (!response.ok) {
      throw new Error(`Unable to verify NurseLink session (${response.status}).`);
    }

    return {
      authenticated: true,
      status: response.status,
      payload
    };
  }

  function partnerReturnPath() {
    const params = new URLSearchParams(location.search);
    const application = params.get('application');

    return application && /^\d+$/.test(application)
      ? `/nurselink-partner-portal.html?application=${encodeURIComponent(application)}`
      : '/nurselink-partner-portal.html';
  }

  function renderSignInRequired() {
    const returnPath = partnerReturnPath();
    const loginUrl = `/login?return=${encodeURIComponent(returnPath)}`;

    root.innerHTML = `
      <section class="access-error partner-auth-gate">
        <div class="lock">NL</div>
        <span class="gate-eyebrow">NURSELINK PARTNER PORTAL</span>
        <strong>Sign in to continue</strong>
        <p>
          The Partner Portal is protected. Sign in with the NurseLink account
          authorized for your hospital, employer, recruitment agency, or partner
          organization.
        </p>
        <a href="${esc(loginUrl)}">Sign in to Partner Portal</a>
        <small>
          After sign-in, NurseLink will return you automatically to this portal.
        </small>
      </section>
    `;
  }

  function renderPartnerAccessRequired(message) {
    root.innerHTML = `
      <section class="access-error partner-auth-gate">
        <div class="lock">NL</div>
        <span class="gate-eyebrow">AUTHENTICATED NURSELINK ACCOUNT</span>
        <strong>Partner Access Required</strong>
        <p>
          ${esc(message || 'Your NurseLink account is signed in, but it is not authorized for a verified partner organization.')}
        </p>
        <div class="gate-actions">
          <a href="https://app.amsertech.com/dashboard">Return to NurseLink</a>
          <button id="gateRefresh" type="button">Check Access Again</button>
        </div>
        <small>
          Partner access is granted separately from applicant/member access.
        </small>
      </section>
    `;

    document.getElementById('gateRefresh')?.addEventListener('click', boot);
  }

  function money(row) {
    if (row.salary_min == null && row.salary_max == null) return '';

    const currency = row.salary_currency || '';
    const min = row.salary_min != null ? Number(row.salary_min).toLocaleString() : '';
    const max = row.salary_max != null ? Number(row.salary_max).toLocaleString() : '';

    return [currency, min && max ? `${min} – ${max}` : min || max]
      .filter(Boolean)
      .join(' ');
  }

  function statusLabel(value) {
    return String(value || '')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, ch => ch.toUpperCase());
  }

  async function loadAll() {
    /*
     * Authorize the partner account first. Do not fan out to summary/jobs/
     * applications until /partner/me succeeds.
     */
    const me = await request('/me');

    state.me = me?.data || null;

    const [summary, opportunities, applications, analytics] = await Promise.all([
      request('/summary'),
      request('/opportunities'),
      request('/applications'),
      request('/analytics?months=12').catch(() => ({ data: null }))
    ]);

    state.summary = summary?.data || null;
    state.opportunities = opportunities?.data || [];
    state.applications = applications?.data || [];
    state.analytics = analytics?.data || null;
  }

  function summaryCards() {
    const s = state.summary || {};

    return `
      <div class="summary-grid">
        ${[
          ['Opportunities', s.opportunities_total ?? 0],
          ['Active', s.opportunities_active ?? 0],
          ['Pending Review', s.opportunities_pending_review ?? 0],
          ['Applications', s.applications_total ?? 0],
          ['Shortlisted', s.applications_shortlisted ?? 0],
          ['Interviews', s.applications_interview ?? 0],
          ['Offers', s.applications_offer ?? 0]
        ].map(([label, value]) => `
          <article class="metric-card">
            <span>${esc(label)}</span>
            <strong>${esc(value)}</strong>
          </article>
        `).join('')}
      </div>
    `;
  }

  function opportunityForm() {
    if (!['manager', 'recruiter'].includes(state.me?.role)) return '';

    return `
      <details class="create-panel">
        <summary>+ Submit a New Opportunity</summary>

        <form id="opportunityForm" class="opportunity-form">
          <label class="span-2">
            <span>Job Title *</span>
            <input name="title" required maxlength="190" placeholder="Registered Nurse – ICU">
          </label>

          <label>
            <span>Country *</span>
            <input name="country" required maxlength="120" placeholder="Philippines">
          </label>

          <label>
            <span>City</span>
            <input name="city" maxlength="120">
          </label>

          <label>
            <span>Work Setting</span>
            <select name="work_setting">
              <option value="">Select</option>
              <option value="hospital">Hospital</option>
              <option value="clinic">Clinic</option>
              <option value="community">Community</option>
              <option value="home_care">Home Care</option>
              <option value="long_term_care">Long-term Care</option>
              <option value="education">Education</option>
              <option value="occupational_health">Occupational Health</option>
              <option value="telehealth">Telehealth</option>
              <option value="government">Government</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label>
            <span>Employment Type</span>
            <select name="employment_type">
              <option value="">Select</option>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="temporary">Temporary</option>
              <option value="project_based">Project-based</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label>
            <span>Specialty</span>
            <input name="specialty" maxlength="150" placeholder="ICU / Critical Care">
          </label>

          <label>
            <span>Required License</span>
            <input name="required_license_type" maxlength="80" placeholder="prc_license">
          </label>

          <label>
            <span>Minimum Experience (years)</span>
            <input name="minimum_experience_years" type="number" min="0" max="99" step="0.5" value="0" required>
          </label>

          <label class="checkbox">
            <input name="overseas_opportunity" type="checkbox">
            <span>Overseas opportunity</span>
          </label>

          <label>
            <span>Salary Minimum</span>
            <input name="salary_min" type="number" min="0" step="0.01">
          </label>

          <label>
            <span>Salary Maximum</span>
            <input name="salary_max" type="number" min="0" step="0.01">
          </label>

          <label>
            <span>Currency</span>
            <input name="salary_currency" maxlength="8" placeholder="PHP">
          </label>

          <label>
            <span>Expires At</span>
            <input name="expires_at" type="date">
          </label>

          <label class="span-2">
            <span>Description</span>
            <textarea name="description" rows="4" maxlength="12000"></textarea>
          </label>

          <label class="span-2">
            <span>Requirements</span>
            <textarea name="requirements" rows="4" maxlength="12000"></textarea>
          </label>

          <label class="span-2">
            <span>External Apply URL</span>
            <input name="apply_url" type="url" maxlength="512">
          </label>

          <div class="form-note span-2">
            Partner-created opportunities are submitted as <strong>Paused / Pending Verification</strong>.
            Only NurseLink administrators can verify and publish them.
          </div>

          <div id="opportunityFormStatus" class="form-status span-2"></div>

          <div class="span-2 form-actions">
            <button class="primary" type="submit">Submit for NurseLink Verification</button>
          </div>
        </form>
      </details>
    `;
  }

  function opportunityCards() {
    if (!state.opportunities.length) {
      return `<div class="empty">No partner opportunities yet.</div>`;
    }

    return `
      <div class="cards">
        ${state.opportunities.map(row => `
          <article class="opportunity-card">
            <div class="card-head">
              <div>
                <span>${esc(row.reference_code)}</span>
                <strong>${esc(row.title)}</strong>
                <small>${esc([row.city, row.country].filter(Boolean).join(', '))}</small>
              </div>

              <em data-status="${esc(row.status)}">${esc(statusLabel(row.status))}</em>
            </div>

            <div class="chips">
              ${row.specialty ? `<span>${esc(row.specialty)}</span>` : ''}
              ${row.employment_type ? `<span>${esc(statusLabel(row.employment_type))}</span>` : ''}
              ${row.overseas_opportunity ? '<span>Overseas</span>' : ''}
              ${money(row) ? `<span>${esc(money(row))}</span>` : ''}
            </div>

            <p>${esc(row.description || 'No description provided.')}</p>

            <div class="verification">
              <strong>${row.verified ? '✓ NurseLink Verified' : 'Pending NurseLink Verification'}</strong>
              <small>
                ${row.verified_at
                  ? `Verified ${esc(String(row.verified_at).slice(0, 10))}`
                  : 'Partner changes cannot self-publish an opportunity.'}
              </small>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function applicationCards() {
    if (!state.applications.length) {
      return `<div class="empty">No nurses have applied to your linked opportunities yet.</div>`;
    }

    const canWrite = ['manager', 'recruiter'].includes(state.me?.role);

    return `
      <div class="applications">
        ${state.applications.map(row => `
          <article class="application-card" data-id="${row.id}">
            <div class="card-head">
              <div>
                <span>${esc(row.job.reference_code)}</span>
                <strong>${esc(row.candidate.name)}</strong>
                <small>
                  ${esc(row.candidate.member_number || 'NurseLink member')}
                  · ${esc(row.job.title)}
                </small>
              </div>

              <em data-status="${esc(row.status)}">${esc(statusLabel(row.status))}</em>
            </div>

            ${row.cover_note ? `
              <div class="cover-note">
                <span>Candidate Note</span>
                <p>${esc(row.cover_note)}</p>
              </div>
            ` : ''}

            <div class="application-meta">
              <span>Submitted ${esc(String(row.submitted_at || '').slice(0, 10) || '—')}</span>
              ${row.candidate.public_profile_url
                ? `<a href="${esc(row.candidate.public_profile_url)}" target="_blank" rel="noopener">View Public Nurse Profile ↗</a>`
                : '<span>Public profile not enabled</span>'}
            </div>

            <div class="communication-actions">
              <button type="button" class="open-communication secondary">
                Messages & Interview
              </button>
            </div>

            <div class="communication-panel" hidden></div>

            ${canWrite && row.status !== 'withdrawn' ? `
              <div class="review-controls">
                <label>
                  <span>Application Status</span>
                  <select name="status">
                    ${['under_review','shortlisted','interview','offer','declined']
                      .map(status => `<option value="${status}" ${row.status === status ? 'selected' : ''}>${esc(statusLabel(status))}</option>`)
                      .join('')}
                  </select>
                </label>

                <label>
                  <span>Partner Internal Notes</span>
                  <textarea name="partner_notes" rows="3" maxlength="5000">${esc(row.partner_notes || '')}</textarea>
                </label>

                <div class="review-status"></div>
                <button type="button" class="save-application primary">Save Status</button>
              </div>
            ` : ''}
          </article>
        `).join('')}
      </div>
    `;
  }


  async function loadPartnerCommunication(applicationId) {
    const payload = await request(`/applications/${applicationId}/communications`);
    return payload?.data || null;
  }

  async function renderPartnerCommunication(panel, applicationId) {
    panel.innerHTML = '<div class="communication-loading">Loading messages and interviews…</div>';

    try {
      const data = await loadPartnerCommunication(applicationId);
      const messages = Array.isArray(data?.messages) ? data.messages : [];
      const interviews = Array.isArray(data?.interviews) ? data.interviews : [];
      const canWrite = ['manager', 'recruiter'].includes(state.me?.role);

      panel.innerHTML = `
        <div class="communication-columns">
          <section>
            <div class="communication-title">
              <strong>Messages</strong>
              <small>Application-specific communication</small>
            </div>

            <div class="partner-message-list">
              ${messages.length ? messages.map(message => `
                <article data-sender="${esc(message.sender_type)}">
                  <span>${message.sender_type === 'partner' ? 'Your Organization' : 'Candidate'}</span>
                  <p>${esc(message.body)}</p>
                  <small>${esc(String(message.created_at || '').replace('T', ' ').slice(0, 16))}</small>
                </article>
              `).join('') : '<div class="communication-empty">No messages yet.</div>'}
            </div>

            ${canWrite ? `
              <form class="partner-message-form">
                <textarea name="body" rows="3" maxlength="5000" required placeholder="Message this applicant about this application."></textarea>
                <div class="status"></div>
                <button type="submit" class="primary">Send Message</button>
              </form>
            ` : ''}
          </section>

          <section>
            <div class="communication-title">
              <strong>Interviews</strong>
              <small>Schedule and manage interviews</small>
            </div>

            <div class="partner-interview-list">
              ${interviews.length ? interviews.map(interview => `
                <article data-interview-id="${interview.id}">
                  <div class="partner-interview-head">
                    <div>
                      <span>${esc(statusLabel(interview.mode))} INTERVIEW</span>
                      <strong>${esc(String(interview.scheduled_start || '').replace('T', ' ').slice(0, 16))}</strong>
                      <small>${esc(interview.timezone || '')}</small>
                    </div>
                    <em data-status="${esc(interview.status)}">${esc(statusLabel(interview.status))}</em>
                  </div>

                  ${interview.location_or_link ? `<p>${esc(interview.location_or_link)}</p>` : ''}
                  ${interview.partner_notes ? `<p>${esc(interview.partner_notes)}</p>` : ''}
                  ${interview.candidate_notes ? `<div class="candidate-response"><strong>Candidate:</strong> ${esc(interview.candidate_notes)}</div>` : ''}

                  ${canWrite ? `
                    <button type="button" class="edit-interview secondary" data-interview="${interview.id}">
                      Update Interview
                    </button>
                  ` : ''}
                </article>
              `).join('') : '<div class="communication-empty">No interview scheduled yet.</div>'}
            </div>

            ${canWrite ? `
              <details class="schedule-panel">
                <summary>+ Schedule Interview</summary>

                <form class="schedule-form">
                  <label>
                    <span>Start *</span>
                    <input type="datetime-local" name="scheduled_start" required>
                  </label>

                  <label>
                    <span>End</span>
                    <input type="datetime-local" name="scheduled_end">
                  </label>

                  <label>
                    <span>Timezone *</span>
                    <input name="timezone" value="Asia/Manila" required maxlength="80">
                  </label>

                  <label>
                    <span>Mode *</span>
                    <select name="mode" required>
                      <option value="video">Video</option>
                      <option value="phone">Phone</option>
                      <option value="onsite">On-site</option>
                    </select>
                  </label>

                  <label class="span-2">
                    <span>Location / Meeting Link</span>
                    <input name="location_or_link" maxlength="512">
                  </label>

                  <label class="span-2">
                    <span>Notes to Candidate</span>
                    <textarea name="partner_notes" rows="3" maxlength="3000"></textarea>
                  </label>

                  <div class="status span-2"></div>
                  <button type="submit" class="primary span-2">Propose Interview</button>
                </form>
              </details>
            ` : ''}
          </section>
        </div>
      `;

      request(`/applications/${applicationId}/messages/read`, {
        method: 'POST',
        body: JSON.stringify({})
      }).catch(() => {});

      const messageForm = panel.querySelector('.partner-message-form');
      messageForm?.addEventListener('submit', async event => {
        event.preventDefault();

        const body = messageForm.elements.namedItem('body')?.value?.trim() || '';
        const status = messageForm.querySelector('.status');
        const button = messageForm.querySelector('button');

        if (!body) return;

        status.textContent = 'Sending…';
        button.disabled = true;

        try {
          await request(`/applications/${applicationId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ body })
          });

          await renderPartnerCommunication(panel, applicationId);
        } catch (error) {
          status.textContent = error.message;
        } finally {
          button.disabled = false;
        }
      });

      const scheduleForm = panel.querySelector('.schedule-form');
      scheduleForm?.addEventListener('submit', async event => {
        event.preventDefault();

        const value = name => scheduleForm.elements.namedItem(name)?.value?.trim?.() || '';
        const status = scheduleForm.querySelector('.status');
        const button = scheduleForm.querySelector('button');

        status.textContent = 'Scheduling…';
        button.disabled = true;

        try {
          await request(`/applications/${applicationId}/interviews`, {
            method: 'POST',
            body: JSON.stringify({
              scheduled_start: value('scheduled_start'),
              scheduled_end: value('scheduled_end') || null,
              timezone: value('timezone'),
              mode: value('mode'),
              location_or_link: value('location_or_link') || null,
              partner_notes: value('partner_notes') || null
            })
          });

          await loadAll();
          render();
          const target = root.querySelector(`.application-card[data-id="${applicationId}"] .communication-panel`);
          if (target) {
            target.hidden = false;
            await renderPartnerCommunication(target, applicationId);
          }
        } catch (error) {
          status.textContent = error.message;
        } finally {
          button.disabled = false;
        }
      });

      panel.querySelectorAll('.edit-interview').forEach(button => {
        button.addEventListener('click', async () => {
          const interview = interviews.find(row => Number(row.id) === Number(button.dataset.interview));
          if (!interview) return;

          const start = window.prompt(
            'Interview start (YYYY-MM-DD HH:MM:SS)',
            String(interview.scheduled_start || '').replace('T', ' ').slice(0, 19)
          );
          if (!start) return;

          const status = window.prompt(
            'Status: proposed, confirmed, completed, cancelled',
            interview.status || 'proposed'
          );
          if (!status) return;

          try {
            await request(`/applications/${applicationId}/interviews/${interview.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                scheduled_start: start,
                scheduled_end: interview.scheduled_end || null,
                timezone: interview.timezone || 'Asia/Manila',
                mode: interview.mode,
                location_or_link: interview.location_or_link || null,
                status,
                partner_notes: interview.partner_notes || null
              })
            });

            await renderPartnerCommunication(panel, applicationId);
          } catch (error) {
            window.alert(error.message);
          }
        });
      });
    } catch (error) {
      panel.innerHTML = `<div class="communication-empty">${esc(error.message)}</div>`;
    }
  }


  function analyticsPercent(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? `${number.toFixed(1)}%` : '0.0%';
  }

  function analyticsHours(value) {
    if (value == null || value === '') return '—';

    const hours = Number(value);

    if (!Number.isFinite(hours)) return '—';

    return hours < 24
      ? `${hours.toFixed(1)} hrs`
      : `${(hours / 24).toFixed(1)} days`;
  }

  function analyticsMax(rows, key) {
    return Math.max(1, ...rows.map(row => Number(row?.[key] || 0)));
  }

  function exportPartnerAnalyticsCsv() {
    const a = state.analytics;
    if (!a) return;

    const rows = [
      ['NurseLink Partner Analytics'],
      ['Organization', a.organization?.name || ''],
      ['Generated', a.period?.generated_at || ''],
      [],
      ['Metric', 'Value'],
      ['Total Opportunities', a.headline?.opportunities_total ?? 0],
      ['Active Opportunities', a.headline?.opportunities_active ?? 0],
      ['Applications', a.headline?.applications_total ?? 0],
      ['Reviewed Applications', a.headline?.applications_reviewed ?? 0],
      ['Shortlisted', a.headline?.shortlisted ?? 0],
      ['Interviews', a.headline?.interviews ?? 0],
      ['Offers', a.headline?.offers ?? 0],
      ['Review Rate', a.conversion?.review_rate ?? 0],
      ['Shortlist Rate', a.conversion?.shortlist_rate ?? 0],
      ['Interview Rate', a.conversion?.interview_rate ?? 0],
      ['Offer Rate', a.conversion?.offer_rate ?? 0],
      ['Avg Time to Review (hours)', a.timing?.average_time_to_review_hours ?? ''],
      ['Avg Time to First Interview (hours)', a.timing?.average_time_to_first_interview_hours ?? ''],
      [],
      ['Month', 'Applications', 'Interviews', 'Offers'],
      ...(a.monthly || []).map(row => [
        row.month,
        row.applications,
        row.interviews,
        row.offers
      ]),
      [],
      ['Reference', 'Title', 'Applications', 'Interview+', 'Offers', 'Interview Rate', 'Offer Rate'],
      ...(a.opportunities || []).map(row => [
        row.reference_code || '',
        row.title || '',
        row.applications || 0,
        row.interview_or_beyond || 0,
        row.offers || 0,
        row.interview_conversion_rate || 0,
        row.offer_conversion_rate || 0
      ])
    ];

    const csv = rows.map(row => row.map(value => {
      const text = String(value ?? '');
      return /[",\n]/.test(text)
        ? `"${text.replaceAll('"', '""')}"`
        : text;
    }).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `NurseLink_Partner_Analytics_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function analyticsSection() {
    const a = state.analytics;

    if (!a) {
      return `
        <section class="section partner-analytics-section">
          <div class="section-head">
            <div>
              <span>RECRUITMENT INTELLIGENCE</span>
              <h2>Institutional Analytics</h2>
              <p>Analytics are temporarily unavailable; operational Partner Portal features remain available.</p>
            </div>
          </div>
        </section>
      `;
    }

    const funnel = [
      ['Applications', a.funnel?.applications ?? 0],
      ['Reviewed+', a.funnel?.under_review_or_beyond ?? 0],
      ['Shortlisted+', a.funnel?.shortlisted_or_beyond ?? 0],
      ['Interview+', a.funnel?.interview_or_beyond ?? 0],
      ['Offers', a.funnel?.offers ?? 0]
    ];

    const funnelMax = Math.max(1, ...funnel.map(row => Number(row[1] || 0)));
    const monthly = Array.isArray(a.monthly) ? a.monthly : [];
    const monthlyMax = analyticsMax(monthly, 'applications');

    return `
      <section class="section partner-analytics-section">
        <div class="section-head analytics-head">
          <div>
            <span>RECRUITMENT INTELLIGENCE</span>
            <h2>Institutional Analytics</h2>
            <p>
              Aggregate performance for your organization. Candidate identities
              and private records are excluded.
            </p>
          </div>
          <button id="exportAnalyticsCsv" type="button" class="analytics-export">Export CSV</button>
        </div>

        <div class="analytics-kpis">
          ${[
            ['Applications', a.headline?.applications_total ?? 0],
            ['Review Rate', analyticsPercent(a.conversion?.review_rate)],
            ['Shortlist Rate', analyticsPercent(a.conversion?.shortlist_rate)],
            ['Interview Rate', analyticsPercent(a.conversion?.interview_rate)],
            ['Offer Rate', analyticsPercent(a.conversion?.offer_rate)],
            ['Avg. Review Time', analyticsHours(a.timing?.average_time_to_review_hours)],
            ['Avg. Interview Turnaround', analyticsHours(a.timing?.average_time_to_first_interview_hours)]
          ].map(([label, value]) => `
            <article><span>${esc(label)}</span><strong>${esc(value)}</strong></article>
          `).join('')}
        </div>

        <div class="analytics-panels">
          <article class="analytics-panel">
            <div class="analytics-panel-title">
              <strong>Recruitment Funnel</strong>
              <small>Applications progressing through the hiring pipeline</small>
            </div>
            <div class="funnel-bars">
              ${funnel.map(([label, value]) => `
                <div class="funnel-row">
                  <span>${esc(label)}</span>
                  <div><i style="width:${Math.max(2,(Number(value||0)/funnelMax)*100)}%"></i></div>
                  <strong>${esc(value)}</strong>
                </div>
              `).join('')}
            </div>
          </article>

          <article class="analytics-panel">
            <div class="analytics-panel-title">
              <strong>12-Month Trend</strong>
              <small>Applications, interviews and offers</small>
            </div>
            <div class="monthly-bars">
              ${monthly.map(row => `
                <div class="month-column" title="${esc(row.month)}">
                  <div class="month-bars">
                    <i class="applications" style="height:${Math.max(2,(Number(row.applications||0)/monthlyMax)*100)}%"></i>
                    <i class="interviews" style="height:${Math.max(2,(Number(row.interviews||0)/monthlyMax)*100)}%"></i>
                    <i class="offers" style="height:${Math.max(2,(Number(row.offers||0)/monthlyMax)*100)}%"></i>
                  </div>
                  <span>${esc(String(row.month||'').slice(0,3))}</span>
                </div>
              `).join('')}
            </div>
            <div class="analytics-legend">
              <span><i class="applications"></i> Applications</span>
              <span><i class="interviews"></i> Interviews</span>
              <span><i class="offers"></i> Offers</span>
            </div>
          </article>
        </div>

        <div class="analytics-table-wrap">
          <table class="analytics-table">
            <thead>
              <tr>
                <th>Opportunity</th>
                <th>Applications</th>
                <th>Interview+</th>
                <th>Offers</th>
                <th>Interview Rate</th>
                <th>Offer Rate</th>
              </tr>
            </thead>
            <tbody>
              ${(a.opportunities || []).length ? a.opportunities.map(row => `
                <tr>
                  <td><strong>${esc(row.title)}</strong><small>${esc(row.reference_code || '')}</small></td>
                  <td>${esc(row.applications)}</td>
                  <td>${esc(row.interview_or_beyond)}</td>
                  <td>${esc(row.offers)}</td>
                  <td>${esc(analyticsPercent(row.interview_conversion_rate))}</td>
                  <td>${esc(analyticsPercent(row.offer_conversion_rate))}</td>
                </tr>
              `).join('') : `
                <tr><td colspan="6">No opportunity analytics yet.</td></tr>
              `}
            </tbody>
          </table>
        </div>

        <div class="analytics-privacy">
          Aggregate analytics only. No candidate names, email addresses, phone
          numbers, home addresses, documents or credential details are included.
        </div>
      </section>
    `;
  }

  function render() {
    const org = state.me?.organization || {};

    root.innerHTML = `
      <section class="hero">
        <div>
          <span>VERIFIED NURSELINK PARTNER</span>
          <h1>${esc(org.name || 'Partner Organization')}</h1>
          <p>
            Manage verified employment opportunities and review nurses who applied
            specifically to your organization.
          </p>
        </div>

        <div class="partner-identity">
          <span>${esc(statusLabel(org.organization_type))}</span>
          <strong>${esc(state.me?.role || '')}</strong>
          <small>${esc([org.city, org.country].filter(Boolean).join(', '))}</small>
        </div>
      </section>

      ${summaryCards()}

      ${analyticsSection()}

      <section class="section">
        <div class="section-head">
          <div>
            <span>OPPORTUNITIES</span>
            <h2>Jobs & Recruitment Opportunities</h2>
          </div>
        </div>

        ${opportunityForm()}
        ${opportunityCards()}
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <span>APPLICANTS</span>
            <h2>Applications to Your Organization</h2>
            <p>
              Privacy scope is intentionally limited to nurses who applied to your
              organization’s linked opportunities.
            </p>
          </div>
        </div>

        <div class="privacy-banner">
          NurseLink does not expose candidate home addresses, mobile numbers,
          email addresses, credential numbers, uploaded documents, or private
          portfolio content in the Partner Portal.
        </div>

        ${applicationCards()}
      </section>
    `;

    wireOpportunityForm();
    wireApplicationControls();

    document.getElementById('exportAnalyticsCsv')
      ?.addEventListener('click', exportPartnerAnalyticsCsv);

    const requestedApplication = Number(
      new URLSearchParams(location.search).get('application') || 0
    );

    if (requestedApplication) {
      const card = root.querySelector(`.application-card[data-id="${requestedApplication}"]`);
      const button = card?.querySelector('.open-communication');

      if (button) {
        setTimeout(() => button.click(), 0);
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  function formPayload(form) {
    const value = name => form.elements.namedItem(name)?.value?.trim?.() || '';
    const number = name => {
      const raw = value(name);
      return raw === '' ? null : Number(raw);
    };

    return {
      title: value('title'),
      country: value('country'),
      city: value('city') || null,
      work_setting: value('work_setting') || null,
      employment_type: value('employment_type') || null,
      specialty: value('specialty') || null,
      required_license_type: value('required_license_type') || null,
      minimum_experience_years: number('minimum_experience_years') ?? 0,
      overseas_opportunity: !!form.elements.namedItem('overseas_opportunity')?.checked,
      salary_min: number('salary_min'),
      salary_max: number('salary_max'),
      salary_currency: value('salary_currency') || null,
      description: value('description') || null,
      requirements: value('requirements') || null,
      apply_url: value('apply_url') || null,
      expires_at: value('expires_at') || null,
      partner_status: 'submit_for_review'
    };
  }

  function wireOpportunityForm() {
    const form = document.getElementById('opportunityForm');
    if (!form) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const status = document.getElementById('opportunityFormStatus');
      const button = form.querySelector('button[type="submit"]');

      status.textContent = 'Submitting opportunity for verification…';
      status.dataset.tone = 'loading';
      button.disabled = true;

      try {
        await request('/opportunities', {
          method: 'POST',
          body: JSON.stringify(formPayload(form))
        });

        await loadAll();
        render();
      } catch (error) {
        status.textContent = error.message;
        status.dataset.tone = 'error';
      } finally {
        button.disabled = false;
      }
    });
  }

  function wireApplicationControls() {
    root.querySelectorAll('.application-card').forEach(card => {
      const communicationButton = card.querySelector('.open-communication');
      const communicationPanel = card.querySelector('.communication-panel');

      communicationButton?.addEventListener('click', async () => {
        const applicationId = Number(card.dataset.id);
        communicationPanel.hidden = !communicationPanel.hidden;

        if (!communicationPanel.hidden) {
          await renderPartnerCommunication(communicationPanel, applicationId);
        }
      });

      const button = card.querySelector('.save-application');
      if (!button) return;

      button.addEventListener('click', async () => {
        const id = card.dataset.id;
        const statusEl = card.querySelector('.review-status');
        const status = card.querySelector('[name="status"]').value;
        const notes = card.querySelector('[name="partner_notes"]').value.trim();

        button.disabled = true;
        statusEl.textContent = 'Saving…';
        statusEl.dataset.tone = 'loading';

        try {
          await request(`/applications/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              status,
              partner_notes: notes || null
            })
          });

          await loadAll();
          render();
        } catch (error) {
          statusEl.textContent = error.message;
          statusEl.dataset.tone = 'error';
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  async function boot() {
    root.innerHTML = `
      <section class="loading-card">
        <div class="spinner"></div>
        <strong>Loading Partner Portal…</strong>
        <small>Checking your NurseLink session and partner authorization.</small>
      </section>
    `;

    try {
      const session = await nurseLinkSession();

      if (!session.authenticated) {
        renderSignInRequired();
        return;
      }

      try {
        await loadAll();
        render();
      } catch (error) {
        renderPartnerAccessRequired(error.message);
      }
    } catch (error) {
      root.innerHTML = `
        <section class="access-error partner-auth-gate">
          <div class="lock">NL</div>
          <span class="gate-eyebrow">NURSELINK CONNECTION</span>
          <strong>Unable to check Partner Portal access</strong>
          <p>${esc(error.message)}</p>
          <button id="gateRefresh" type="button">Try Again</button>
        </section>
      `;

      document.getElementById('gateRefresh')?.addEventListener('click', boot);
    }
  }

  refreshButton?.addEventListener('click', boot);
  boot();
})();
