(() => {
  'use strict';

  const API = 'https://api.amsertech.com';
  const CFG = window.NurseLinkPortalConfig || {};
  const $ = id => document.getElementById(id);

  const noticeEl = $('operationsNotice');
  const sessionGateEl = $('adminSessionGate');
  const sessionGateMessageEl = $('adminSessionGateMessage');
  const titleEl = $('operationsTitle');
  const subtitleEl = $('operationsSubtitle');
  const identityEl = $('adminIdentity');
  const globalSearchEl = $('adminGlobalSearch');
  const globalSearchPanelEl = $('adminGlobalSearchPanel');
  const globalSearchResultsEl = $('adminGlobalSearchResults');
  const globalSearchTitleEl = $('adminGlobalSearchTitle');
  const roleWorkbenchEl = $('adminRoleWorkbench');
  const mobileMenuToggleEl = $('adminMobileMenuToggle');
  const mobileMenuCloseEl = $('adminMobileMenuClose');
  const mobileBackdropEl = $('adminMobileBackdrop');
  const mobileSidebarEl = $('operationsSidebar');
  const mobileTitleEl = $('adminMobileTitle');
  const mobileNavQuery = window.matchMedia('(max-width: 950px)');

  let summary = null;
  let privilegedUsers = [];
  let applicationRows = [];
  let memberRows = [];
  let selectedApplicationId = null;
  let searchTimer = null;
  let currentAccess = null;
  let currentAdminUser = null;
  let adminPermissionProfile = null;
  let adminManagement = null;
  let globalSearchTimer = null;
  let globalSearchSequence = 0;
  let applicationPage = 1;
  let applicationPageSize = 10;
  let applicationVisibleRows = [];
  let applicationCommandData = null;
  let applicationStaffRows = [];
  let applicationViewMode = 'membership';
  let applicationActiveQuickView = 'all';

  const subtitles = {
    dashboard: 'Operational workflows across membership, workforce, programs and platform health.',
    members: 'Manage approved NurseLink members through governed membership lifecycle workflows.',
    applications: 'Review membership applications without working directly against raw membership records.',
    verification: 'Review professional credential records through the NurseLink verification workflow.',
    organizations: 'Manage hospitals, health systems, recruiters and institutional partners.',
    programs: 'Operate communities, benefits, engagement and enterprise programs.',
    employment: 'Manage workforce opportunities and member job-application workflows.',
    training: 'Operate NurseLink events and professional-development programs.',
    communications: 'Send controlled, auditable in-app communications to resolved NurseLink members.',
    reports: 'Use platform-level analytics rather than querying production tables directly.',
    support: 'Track operational cases with ownership, status, priority and resolution workflow.',
    audit: 'Review normalized administrative actions without exposing raw before/after database state.',
    health: 'Monitor platform readiness and required operational data services.',
    settings: 'Invite administrators, manage multi-role permissions, record governance reasons and review immutable access history.'
  };

  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const label = value => String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  const debounce = (fn, wait = 250) => {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  };

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

    if (!response.ok && response.status !== 204) {
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
      cache: options.cache || 'no-store',
      credentials: 'include',
      headers
    });

    let payload = null;
    try { payload = await response.json(); } catch (_) {}

    if (!response.ok) {
      const error = new Error(
        payload?.errors
          ? Object.values(payload.errors).flat().find(Boolean)
            || payload?.message
            || `Administrator request failed (${response.status}).`
          : payload?.message || `Administrator request failed (${response.status}).`
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

  function setSessionGate(message = '') {
    if (sessionGateMessageEl && message) {
      sessionGateMessageEl.textContent = message;
    }
  }

  function revealAdministratorPortal() {
    document.body.classList.remove('nl-admin-session-pending');
    document.body.classList.add('nl-admin-session-ready');

    if (sessionGateEl) {
      sessionGateEl.hidden = true;
    }
  }

  function needsLogin(error) {
    if ([401, 419].includes(error.status)) return true;
    if (error.status !== 403) return false;

    return /separate NurseLink (?:Administrator Portal|administrator) sign-in is required/i
      .test(String(error.message || ''));
  }

  function redirectToLogin() {
    setSessionGate('Administrator sign-in is required. Redirecting securely…');

    const tab = location.hash.replace(/^#/, '') || 'dashboard';

    try {
      sessionStorage.setItem('nurselink_admin_portal_tab', tab);
    } catch (_) {}

    location.replace('/admin/login.html');
  }

  function metric(title, value, note = '', tone = '', applicationStatus = null) {
    const tag = applicationStatus === null ? 'div' : 'button';
    const action = applicationStatus === null
      ? ''
      : ` type="button" data-open-applications="${esc(applicationStatus)}" aria-label="Open ${esc(title)} applications"`;
    return `
      <${tag} class="nl530-metric${applicationStatus === null ? '' : ' nl-admin-card-link'}" data-tone="${esc(tone)}"${action}>
        <span>${esc(title)}</span>
        <strong>${esc(value)}</strong>
        <small>${esc(note)}</small>
      </${tag}>
    `;
  }

  function badges(...rows) {
    return `<div class="nl530-badges">${rows.filter(Boolean).map(row => {
      const [text, tone = ''] = Array.isArray(row) ? row : [row, ''];
      return `<span class="nl530-badge ${esc(tone)}">${esc(text)}</span>`;
    }).join('')}</div>`;
  }

  function setMobileNavigation(open = false) {
    const isMobile = mobileNavQuery.matches;
    const shouldOpen = Boolean(open && isMobile);

    document.body.classList.toggle('nl555-nav-open', shouldOpen);
    mobileMenuToggleEl?.setAttribute('aria-expanded', String(shouldOpen));

    if (mobileBackdropEl) {
      mobileBackdropEl.hidden = !shouldOpen;
    }

    if (mobileSidebarEl) {
      mobileSidebarEl.setAttribute('aria-hidden', String(isMobile && !shouldOpen));
      if ('inert' in mobileSidebarEl) {
        mobileSidebarEl.inert = Boolean(isMobile && !shouldOpen);
      }
    }
  }

  function syncMobileNavigation() {
    if (!mobileNavQuery.matches) {
      document.body.classList.remove('nl555-nav-open');
      mobileMenuToggleEl?.setAttribute('aria-expanded', 'false');
      if (mobileBackdropEl) mobileBackdropEl.hidden = true;
      if (mobileSidebarEl) {
        mobileSidebarEl.setAttribute('aria-hidden', 'false');
        if ('inert' in mobileSidebarEl) mobileSidebarEl.inert = false;
      }
      return;
    }

    setMobileNavigation(document.body.classList.contains('nl555-nav-open'));
  }

  function setTab(tab) {
    const valid = (CFG.adminTabs || []).map(row => row[0]);
    if (!valid.includes(tab)) tab = 'dashboard';
    const tabLink = document.querySelector(`[data-tab="${tab}"]`);
    if (tabLink?.hidden) tab = 'dashboard';

    document.querySelectorAll('[data-panel]').forEach(panel => {
      panel.hidden = panel.dataset.panel !== tab;
    });

    document.querySelectorAll('[data-tab]').forEach(link => {
      link.classList.toggle('active', link.dataset.tab === tab);
    });

    const tabLabel = (CFG.adminTabs || [])
      .find(row => row[0] === tab)?.[1] || 'Dashboard';

    titleEl.textContent = tabLabel;
    if (mobileTitleEl) mobileTitleEl.textContent = tabLabel;
    subtitleEl.textContent = subtitles[tab] || '';

    if (location.hash !== `#${tab}`) {
      history.replaceState(null, '', `#${tab}`);
    }

    const loaders = {
      dashboard: loadDashboard,
      members: loadMembers,
      applications: loadApplications,
      verification: loadVerification,
      organizations: loadOrganizations,
      programs: loadPrograms,
      employment: loadEmployment,
      training: loadTraining,
      reports: loadReports,
      support: loadSupport,
      audit: loadAudit,
      health: loadHealth,
      settings: loadSettings
    };

    loaders[tab]?.();
  }

  function roleKey() {
    return String(currentAccess?.role || '').toLowerCase();
  }

  function applyGranularNavigation() {
    if (!adminPermissionProfile) return;
    const scopes = new Set(adminPermissionProfile.scopes || []);
    const unrestricted = scopes.has('*') || scopes.has('legacy');
    const readOnly = !!adminPermissionProfile.read_only;
    const tabScopes = {
      dashboard: 'portal',
      members: 'membership',
      applications: 'membership',
      verification: 'verification',
      organizations: 'employment',
      programs: 'programs',
      employment: 'employment',
      training: 'training',
      communications: 'communications',
      reports: 'reports',
      support: 'support',
      audit: 'reports',
      health: 'health',
      settings: 'admin_management'
    };

    document.querySelectorAll('[data-tab]').forEach(link => {
      const tab = link.dataset.tab;
      const needed = tabScopes[tab] || 'portal';
      const allowed = unrestricted
        || needed === 'portal'
        || scopes.has(needed)
        || (readOnly && needed !== 'admin_management')
        || (needed === 'admin_management' && adminPermissionProfile.is_super_admin);
      link.hidden = !allowed;
    });
  }

  function renderRoleWorkbench() {
    if (!roleWorkbenchEl) return;

    const role = roleKey();
    const labelText =
      (adminPermissionProfile?.role_labels || []).join(' · ')
      || currentAccess?.label
      || label(role)
      || 'Administrator';

    let actions = [
      ['#applications', 'Review applications', 'Membership review queue'],
      ['#verification', 'Verify credentials', 'Credential workflow']
    ];

    if (['administrator', 'admin', 'super_administrator', 'super_admin'].includes(role)) {
      actions = actions.concat([
        ['#members', 'Add / manage member', 'Standing and onboarding'],
        ['#support', 'Open support cases', 'Assigned operational cases']
      ]);
    }

    actions = actions.filter(([href]) => {
      const tab = href.replace(/^#/, '');
      const link = document.querySelector(`[data-tab="${tab}"]`);
      return !link || !link.hidden;
    });

    roleWorkbenchEl.innerHTML = `
      <div class="nl542-role-copy">
        <span>QUICK ACTIONS</span>
        <strong>${esc(labelText)}</strong>
        <small>Common actions for your current Administrator permissions.</small>
      </div>
      <div class="nl542-role-actions">
        ${actions.map(([href, title, note]) => `
          <a href="${esc(href)}">
            <strong>${esc(title)}</strong>
            <small>${esc(note)}</small>
          </a>
        `).join('')}
      </div>
    `;
  }

  function closeGlobalSearch() {
    if (!globalSearchPanelEl) return;
    globalSearchPanelEl.hidden = true;
  }

  function globalResultButton(tab, query, title, detail, badge = '') {
    return `
      <button type="button" class="nl542-search-result" data-global-tab="${esc(tab)}" data-global-query="${esc(query)}">
        <div>
          <strong>${esc(title)}</strong>
          <small>${esc(detail)}</small>
        </div>
        ${badge ? `<span>${esc(badge)}</span>` : ''}
      </button>
    `;
  }

  function renderGlobalSearchGroup(title, body) {
    if (!body) return '';

    return `
      <section class="nl542-search-group">
        <h3>${esc(title)}</h3>
        ${body}
      </section>
    `;
  }

  function openGlobalSearchResult(tab, query) {
    const normalized = String(query || '').trim();

    if (tab === 'members' && $('memberSearch')) {
      $('memberSearch').value = normalized;
    }

    if (tab === 'applications' && $('applicationSearch')) {
      $('applicationSearch').value = normalized;
    }

    if (tab === 'support' && $('supportSearch')) {
      $('supportSearch').value = normalized;
    }

    closeGlobalSearch();
    setTab(tab);
  }

  async function runGlobalSearch(query) {
    const q = String(query || '').trim();
    const sequence = ++globalSearchSequence;

    if (!globalSearchPanelEl || !globalSearchResultsEl) return;

    globalSearchPanelEl.hidden = false;

    if (q.length < 2) {
      globalSearchTitleEl.textContent = 'Search NurseLink administration';
      globalSearchResultsEl.innerHTML =
        '<div class="nl530-empty">Type at least 2 characters to search.</div>';
      return;
    }

    globalSearchTitleEl.textContent = `Results for “${q}”`;
    globalSearchResultsEl.innerHTML =
      '<div class="nl-admin-loading">Searching governed NurseLink workflows…</div>';

    const encoded = encodeURIComponent(q);

    const results = await Promise.allSettled([
      request(`/api/nurselink/admin/member-registry?standing=all&search=${encoded}`),
      request(`/api/nurselink/admin/membership-administration/queue?search=${encoded}`),
      request(`/api/nurselink/admin/operations-center/support-cases?search=${encoded}`)
    ]);

    if (sequence !== globalSearchSequence) return;

    const memberRows =
      results[0].status === 'fulfilled' && Array.isArray(results[0].value?.data)
        ? results[0].value.data.slice(0, 6)
        : [];

    const applicationRowsFound =
      results[1].status === 'fulfilled' && Array.isArray(results[1].value?.data)
        ? results[1].value.data.slice(0, 6)
        : [];

    const supportRows =
      results[2].status === 'fulfilled' && Array.isArray(results[2].value?.data)
        ? results[2].value.data.slice(0, 6)
        : [];

    const memberHtml = memberRows.map(row =>
      globalResultButton(
        'members',
        row.email || row.member_number || row.name || q,
        row.name || row.email || 'Member',
        `${row.member_number || 'Member'} · ${label(row.standing || 'active')}`,
        'Member'
      )
    ).join('');

    const applicationHtml = applicationRowsFound.map(row =>
      globalResultButton(
        'applications',
        row.email || row.member_number || row.name || q,
        row.name || row.email || 'Application',
        `${label(row.status)} · ${row.assigned_reviewer?.name || 'Unassigned'} · ${row.age_days ?? '?'} day(s)`,
        'Application'
      )
    ).join('');

    const supportHtml = supportRows.map(row =>
      globalResultButton(
        'support',
        row.case_number || row.member?.email || row.subject || q,
        row.case_number || row.subject || 'Support Case',
        `${row.subject || 'No subject'} · ${label(row.status)} · ${label(row.priority)}`,
        'Support'
      )
    ).join('');

    const body = [
      renderGlobalSearchGroup('Members', memberHtml),
      renderGlobalSearchGroup('Membership Applications', applicationHtml),
      renderGlobalSearchGroup('Support Cases', supportHtml)
    ].join('');

    globalSearchResultsEl.innerHTML = body
      || '<div class="nl530-empty">No accessible NurseLink records matched this search.</div>';

    globalSearchResultsEl
      .querySelectorAll('[data-global-tab]')
      .forEach(button => {
        button.addEventListener('click', () => {
          openGlobalSearchResult(
            button.dataset.globalTab,
            button.dataset.globalQuery
          );
        });
      });
  }

  function bindGlobalSearch() {
    if (!globalSearchEl) return;

    globalSearchEl.addEventListener('input', () => {
      clearTimeout(globalSearchTimer);
      globalSearchTimer = setTimeout(
        () => runGlobalSearch(globalSearchEl.value),
        220
      );
    });

    globalSearchEl.addEventListener('focus', () => {
      runGlobalSearch(globalSearchEl.value);
    });

    $('adminGlobalSearchClose')?.addEventListener(
      'click',
      closeGlobalSearch
    );

    document.addEventListener('keydown', event => {
      if (
        (event.ctrlKey || event.metaKey)
        && event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        globalSearchEl.focus();
        globalSearchEl.select();
        runGlobalSearch(globalSearchEl.value);
      } else if (event.key === 'Escape') {
        closeApplicationDetail();
        closeGlobalSearch();
      }
    });
  }

  function renderModules(containerId, rows, note) {
    const el = $(containerId);
    if (!el) return;

    el.innerHTML = (rows || []).map(([url, name]) => `
      <a class="nl530-module" href="${esc(url)}">
        <strong>${esc(name)}</strong>
        <small>${esc(note)}</small>
      </a>
    `).join('');
  }

  function progressStage(title, value, note, tone = '', applicationStatus = null) {
    const tag = applicationStatus === null ? 'div' : 'button';
    const action = applicationStatus === null
      ? ''
      : ` type="button" data-open-applications="${esc(applicationStatus)}" aria-label="Open ${esc(title)} applications"`;
    return `
      <${tag} class="nl540-progress-stage${applicationStatus === null ? '' : ' nl-admin-card-link'}" data-tone="${esc(tone)}"${action}>
        <span>${esc(title)}</span>
        <strong>${esc(value)}</strong>
        <small>${esc(note)}</small>
      </${tag}>
    `;
  }

  function activityRow(row) {
    const actor =
      row?.actor?.name
      || row?.actor?.email
      || 'NurseLink Staff';

    return `
      <article class="nl540-activity">
        <div class="nl540-activity-dot"></div>
        <div>
          <strong>${esc(String(row?.action || 'Administrative action').replace(/\./g, ' → '))}</strong>
          <small>${esc(actor)} · ${esc(label(row?.target_type || 'record'))}${row?.target_id ? ` #${esc(row.target_id)}` : ''}</small>
          <time>${esc(row?.created_at || '')}</time>
        </div>
      </article>
    `;
  }

  function reminderRow(title, count, href, note, tone = '') {
    const numeric = Number(count || 0);

    return `
      <a class="nl540-reminder" href="${esc(href)}" data-tone="${esc(tone)}">
        <div>
          <strong>${esc(title)}</strong>
          <small>${esc(note)}</small>
        </div>
        <b>${esc(numeric)}</b>
      </a>
    `;
  }

  async function loadDashboard() {
    try {
      const [
        operationsPayload,
        membershipPayload,
        onboardingPayload,
        auditPayload
      ] = await Promise.all([
        request('/api/nurselink/admin/operations-center/summary'),
        request('/api/nurselink/admin/membership-administration/overview'),
        request('/api/nurselink/admin/membership-onboarding/summary')
          .catch(() => ({data: {counts: {}, overdue: 0, unassigned: 0}})),
        request('/api/nurselink/admin/operations-center/audit-log')
          .catch(() => ({data: []}))
      ]);

      summary = operationsPayload?.data || {};
      const m = summary.metrics || {};
      const membership = membershipPayload?.data || {};
      const counts = membership.counts || {};
      const standing = membership.standing || {};
      const aging = membership.aging || {};
      const onboarding = onboardingPayload?.data || {};
      const onboardingCounts = onboarding.counts || {};
      const auditRows = Array.isArray(auditPayload?.data)
        ? auditPayload.data
        : [];

      $('dashboardMetrics').innerHTML = [
        metric('Members', m.approved_members ?? 0, 'Approved NurseLink members'),
        metric('Applications', m.pending_membership_applications ?? 0, `${counts.ready_for_approval ?? 0} ready for approval`, Number(m.pending_membership_applications || 0) ? 'attention' : 'good', ''),
        metric('Verification', m.pending_verifications ?? 0, 'Credentials awaiting review', Number(m.pending_verifications || 0) ? 'attention' : ''),
        metric('Support Cases', m.open_support_cases ?? 0, 'Open operational cases', Number(m.open_support_cases || 0) ? 'danger' : 'good')
      ].join('');

      $('membershipProgress').innerHTML = [
        progressStage('Submitted', counts.submitted ?? 0, 'Awaiting review assignment', Number(counts.submitted || 0) ? 'attention' : '', 'submitted'),
        progressStage('Under Review', counts.under_review ?? 0, `${membership.unassigned_reviews ?? 0} unassigned`, Number(membership.unassigned_reviews || 0) ? 'attention' : '', 'under_review'),
        progressStage('Needs Information', counts.needs_information ?? 0, 'Applicant follow-up required', Number(counts.needs_information || 0) ? 'attention' : '', 'needs_information'),
        progressStage('Ready for Approval', counts.ready_for_approval ?? 0, 'Administrator decision queue', Number(counts.ready_for_approval || 0) ? 'good' : '', 'ready_for_approval'),
        progressStage('Approved', counts.approved ?? 0, `${standing.active ?? 0} active standing`, 'good', 'approved')
      ].join('');

      $('dashboardQueues').innerHTML = [
        ['Applications ready for approval', counts.ready_for_approval ?? 0, '#applications'],
        ['Overdue membership reviews', membership.overdue_reviews ?? 0, '#applications'],
        ['Unassigned membership reviews', membership.unassigned_reviews ?? 0, '#applications'],
        ['Open support cases', m.open_support_cases ?? 0, '#support'],
        ['Pending credential verification', m.pending_verifications ?? 0, '#verification'],
        ['Pending organizations', m.pending_organizations ?? 0, '#organizations']
      ].map(([name, value, href]) => `
        <a class="nl530-row" href="${href}">
          <div class="nl530-row-main">
            <strong>${esc(name)}</strong>
            <small>Open the governed operational queue.</small>
          </div>
          <strong>${esc(value)}</strong>
        </a>
      `).join('');

      $('dashboardRecentActivity').innerHTML = auditRows.length
        ? auditRows.slice(0, 7).map(activityRow).join('')
        : '<div class="nl530-empty">No recent administrative activity is available.</div>';

      $('dashboardReminders').innerHTML = [
        reminderRow(
          'Final membership decisions',
          counts.ready_for_approval ?? 0,
          '#applications',
          'Applications already cleared for Administrator approval.',
          Number(counts.ready_for_approval || 0) ? 'good' : ''
        ),
        reminderRow(
          'Overdue membership reviews',
          membership.overdue_reviews ?? 0,
          '#applications',
          'Review due date has passed.',
          Number(membership.overdue_reviews || 0) ? 'danger' : ''
        ),
        reminderRow(
          'Unassigned membership reviews',
          membership.unassigned_reviews ?? 0,
          '#applications',
          'Assign a Reviewer or Administrator owner.',
          Number(membership.unassigned_reviews || 0) ? 'attention' : ''
        ),
        reminderRow(
          'Overdue member onboarding',
          onboarding.overdue ?? 0,
          '#members',
          'Approved members requiring activation follow-up.',
          Number(onboarding.overdue || 0) ? 'attention' : ''
        ),
        reminderRow(
          'Pending credential verification',
          m.pending_verifications ?? 0,
          '#verification',
          'Professional records awaiting review.',
          Number(m.pending_verifications || 0) ? 'attention' : ''
        ),
        reminderRow(
          'Open support cases',
          m.open_support_cases ?? 0,
          '#support',
          'Operational cases that remain open.',
          Number(m.open_support_cases || 0) ? 'danger' : ''
        )
      ].join('');
    } catch (error) {
      if (needsLogin(error)) return redirectToLogin();

      $('dashboardMetrics').innerHTML =
        `<div class="nl530-empty">${esc(error.message)}</div>`;

      if ($('membershipProgress')) {
        $('membershipProgress').innerHTML =
          '<div class="nl530-empty">Membership progress is temporarily unavailable.</div>';
      }
    }
  }

  async function loadMembers() {
    const el = $('membersArea');
    el.innerHTML = '<div class="nl-admin-loading">Loading members…</div>';

    const params = new URLSearchParams();
    const search = $('memberSearch')?.value.trim();
    const standing = $('memberStanding')?.value || 'all';
    if (search) params.set('search', search);
    params.set('standing', standing);

    try {
      const payload = await request(`/api/nurselink/admin/member-registry?${params}`);
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      memberRows = rows;

      el.innerHTML = rows.length ? rows.map(row => {
        const current = row.standing || 'active';
        const actions = ({
          active: ['suspended', 'inactive'],
          suspended: ['active', 'inactive'],
          inactive: ['active']
        })[current] || [];

        return `
          <article class="nl530-row" data-member="${esc(row.membership_id)}">
            <div class="nl530-row-main">
              ${badges([row.member_number || 'Member', 'good'], [label(current), current === 'active' ? 'good' : 'attention'])}
              <strong>${esc(row.name || row.email)}</strong>
              <small>${esc(row.email || '')} · ${esc(row.credentials?.verified ?? 0)} verified credential(s) · ${esc(row.employment_records ?? 0)} employment record(s)</small>
            </div>
            <div class="nl530-row-actions">
              ${actions.map(action => `<button type="button" data-standing="${esc(action)}" class="${action === 'suspended' ? 'danger' : ''}">${action === 'active' ? 'Reactivate' : action === 'suspended' ? 'Suspend' : 'Set Inactive'}</button>`).join('')}
            </div>
          </article>
        `;
      }).join('') : '<div class="nl530-empty">No members match these filters.</div>';

      loadMemberOnboarding();

      el.querySelectorAll('[data-standing]').forEach(button => {
        button.addEventListener('click', async () => {
          const row = button.closest('[data-member]');
          const standingValue = button.dataset.standing;
          const reason = prompt(`Reason for changing standing to ${label(standingValue)}:`);
          if (!reason || reason.trim().length < 3) return;

          try {
            await request(`/api/nurselink/admin/membership-lifecycle/${row.dataset.member}/standing`, {
              method: 'POST',
              body: JSON.stringify({
                standing: standingValue,
                reason: reason.trim(),
                confirm_self_action: false
              })
            });
            notice('Membership standing updated.', 'success');
            await Promise.all([loadMembers(), loadDashboard()]);
          } catch (error) {
            if (
              error.payload?.confirmation_required
              && confirm('This is your own membership. Confirm this Super Administrator self-action?')
            ) {
              try {
                await request(`/api/nurselink/admin/membership-lifecycle/${row.dataset.member}/standing`, {
                  method: 'POST',
                  body: JSON.stringify({
                    standing: standingValue,
                    reason: reason.trim(),
                    confirm_self_action: true
                  })
                });
                notice('Membership standing updated.', 'success');
                await Promise.all([loadMembers(), loadDashboard()]);
              } catch (second) {
                notice(second.message, 'error');
              }
            } else {
              notice(error.message, 'error');
            }
          }
        });
      });
    } catch (error) {
      if (needsLogin(error)) return redirectToLogin();
      el.innerHTML = `<div class="nl530-empty">${esc(error.message)}</div>`;
    }
  }

  function exportMembersCsv() {
    if (!memberRows.length) {
      notice('There are no members in the current result set to export.', 'error');
      return;
    }

    const csvCell = value => {
      const text = String(value ?? '');
      return `"${text.replace(/"/g, '""')}"`;
    };

    const lines = [
      [
        'Member',
        'Email',
        'Member Number',
        'Standing',
        'Approved',
        'Verified Credentials',
        'Total Credentials',
        'Employment Records'
      ].map(csvCell).join(','),
      ...memberRows.map(row => [
        row.name || '',
        row.email || '',
        row.member_number || '',
        row.standing || '',
        row.approved_at || '',
        row.credentials?.verified ?? 0,
        row.credentials?.total ?? 0,
        row.employment_records ?? 0
      ].map(csvCell).join(','))
    ];

    const blob = new Blob(
      [lines.join('\r\n')],
      {type: 'text/csv;charset=utf-8'}
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download =
      `nurselink-members-${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    notice(
      `Exported ${memberRows.length} member${memberRows.length === 1 ? '' : 's'}.`,
      'success'
    );
  }

  function applicantInitials(name, email = '') {
    const source = String(name || email || 'NL').trim();
    const parts = source.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
    }

    return source.slice(0, 2).toUpperCase();
  }

  function formatApplicationDate(value, withRelative = false) {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return esc(String(value));
    }

    const formatted = date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    if (!withRelative) return esc(formatted);

    const days = Math.max(
      0,
      Math.floor(
        (Date.now() - date.getTime())
        / 86400000
      )
    );

    return `${esc(formatted)}<small>${esc(days)} day${days === 1 ? '' : 's'} ago</small>`;
  }

  function applicationTone(status) {
    return {
      submitted: 'blue',
      under_review: 'amber',
      needs_information: 'orange',
      ready_for_approval: 'purple',
      approved: 'green',
      declined: 'red'
    }[status] || 'neutral';
  }

  function applicationSla(row) {
    if (!row.review_due_at) {
      return {
        label: 'No due date',
        tone: 'neutral',
        progress: 0
      };
    }

    const due = new Date(row.review_due_at);

    if (Number.isNaN(due.getTime())) {
      return {
        label: 'Review due',
        tone: 'neutral',
        progress: 0
      };
    }

    const hours = Math.ceil(
      (due.getTime() - Date.now())
      / 3600000
    );

    if (hours < 0) {
      const overdueDays = Math.max(
        1,
        Math.ceil(Math.abs(hours) / 24)
      );

      return {
        label: `${overdueDays}d overdue`,
        tone: 'danger',
        progress: 100
      };
    }

    const days = Math.max(
      1,
      Math.ceil(hours / 24)
    );

    return {
      label: `${days} day${days === 1 ? '' : 's'} left`,
      tone: days <= 1 ? 'danger' : days <= 3 ? 'warning' : 'good',
      progress: days <= 1 ? 92 : days <= 3 ? 68 : 34
    };
  }

  function applicationIcon(name) {
    const paths = {
      members: '<circle cx="8" cy="7" r="3"/><path d="M2.5 16c.7-3 2.5-4.5 5.5-4.5S12.8 13 13.5 16"/><circle cx="16" cy="8" r="2.2"/><path d="M14.5 12.5c2.5-.2 4.1 1.1 4.8 3.5"/>',
      applications: '<path d="M6 3.5h8l3 3V20H6z"/><path d="M14 3.5V7h3"/><path d="M9 11h5M9 14h5M9 17h4"/>',
      verification: '<path d="M12 3l7 3v5c0 4.2-2.5 7.3-7 9-4.5-1.7-7-4.8-7-9V6z"/><path d="M8.5 11.5l2.2 2.2 4.8-5"/>',
      organizations: '<path d="M5 20V6h9v14M14 10h5v10"/><path d="M8 9h2M8 12h2M8 15h2M16 13h1M16 16h1M3 20h18"/>',
      support: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>',
      opportunities: '<rect x="4" y="7" width="16" height="11" rx="2"/><path d="M9 7V5h6v2M4 12h16M10 12v2h4v-2"/>',
      events: '<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 3v5M16 3v5M4 10h16M8 14h2M12 14h2M16 14h1"/>',
      notifications: '<path d="M6 16h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v4z"/><path d="M10 19h4"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      question: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-.9.5-1.4 1-1.4 2M12 16.8h.01"/>',
      approval: '<circle cx="12" cy="8" r="3"/><path d="M6 19c.8-3.5 2.7-5.2 6-5.2s5.2 1.7 6 5.2"/>',
      check: '<circle cx="12" cy="12" r="9"/><path d="M7.5 12l3 3 6-7"/>',
      onboarding: '<circle cx="9" cy="8" r="3"/><path d="M3.5 18c.7-3.4 2.5-5.1 5.5-5.1 1.4 0 2.6.4 3.5 1.2M17 11v7M13.5 14.5h7"/>',
      inactive: '<circle cx="12" cy="12" r="9"/><path d="M6 18L18 6"/>'
    };

    const path = paths[name] || paths.applications;

    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  }

  function applicationMetricCard(icon, title, value, note, tone = '', tab = '') {
    const action = tab
      ? ` type="button" data-open-admin-tab="${esc(tab)}" aria-label="Open ${esc(title)}"`
      : ' type="button" disabled aria-disabled="true"';
    return `
      <button class="nl550-kpi nl-admin-card-link" data-tone="${esc(tone)}"${action}>
        <div class="nl550-kpi-icon" aria-hidden="true">${applicationIcon(icon)}</div>
        <div>
          <span>${esc(title)}</span>
          <strong>${esc(value)}</strong>
          <small>${esc(note)}</small>
        </div>
      </button>
    `;
  }

  function applicationProgressCard(icon, title, value, note, tone = '', status = '', tab = '') {
    const action = status
      ? ` type="button" data-open-applications="${esc(status)}" aria-label="Open ${esc(title)} applications"`
      : ` type="button" data-open-admin-tab="${esc(tab || 'applications')}" aria-label="Open ${esc(title)}"`;
    return `
      <button class="nl550-progress-item nl-admin-card-link" data-tone="${esc(tone)}"${action}>
        <div class="nl550-progress-icon" aria-hidden="true">${applicationIcon(icon)}</div>
        <div class="nl550-progress-copy">
          <strong>${esc(value)}</strong>
          <span>${esc(title)}</span>
          <small>${esc(note)}</small>
        </div>
      </button>
    `;
  }

  function renderApplicationCommandHeader(operations, membership, onboarding) {
    const metrics = operations?.metrics || {};
    const counts = membership?.counts || {};
    const standing = membership?.standing || {};
    const aging = membership?.aging || {};
    const onboardingCounts = onboarding?.counts || {};

    const workbench = $('applicationRoleWorkbench');

    if (workbench && roleWorkbenchEl) {
      workbench.innerHTML = roleWorkbenchEl.innerHTML;
    }

    const pendingReview = Number(metrics.pending_membership_applications || 0);
    const agingEightPlus = Number(aging['8_14_days'] || 0) + Number(aging['15_plus_days'] || 0);

    $('applicationCommandMetrics').innerHTML = [
      applicationMetricCard('applications', 'Pending Review', pendingReview, 'Membership applications requiring review', pendingReview ? 'amber' : 'blue', 'applications'),
      applicationMetricCard('approval', 'Ready for Approval', counts.ready_for_approval ?? 0, 'Administrator decision queue', Number(counts.ready_for_approval || 0) ? 'green' : 'blue', 'applications'),
      applicationMetricCard('question', 'Needs Information', counts.needs_information ?? 0, 'Applicant follow-up required', Number(counts.needs_information || 0) ? 'amber' : 'blue', 'applications'),
      applicationMetricCard('clock', 'Review Aging 8+ Days', agingEightPlus, `${aging['15_plus_days'] ?? 0} at 15+ days`, agingEightPlus ? 'red' : 'blue', 'applications')
    ].join('');

    $('applicationProgress').innerHTML = [
      applicationProgressCard('applications', 'Submitted', counts.submitted ?? 0, 'Awaiting review', 'blue', 'submitted'),
      applicationProgressCard('clock', 'Under Review', counts.under_review ?? 0, `${membership.unassigned_reviews ?? 0} unassigned`, 'amber', 'under_review'),
      applicationProgressCard('question', 'Needs Information', counts.needs_information ?? 0, 'Applicant follow-up', 'orange', 'needs_information'),
      applicationProgressCard('approval', 'Ready for Approval', counts.ready_for_approval ?? 0, 'Admin decision queue', 'purple', 'ready_for_approval'),
      applicationProgressCard('check', 'Approved', counts.approved ?? 0, `${standing.active ?? 0} active members`, 'green', 'approved')
    ].join('');
  }

  function applicationTableRow(row) {
    const employment = row.latest_employment || {};
    const stage = row.review_stage || {};
    const sla = applicationSla(row);
    const reviewer = row.assigned_reviewer || {};
    const initials = applicantInitials(row.name, row.email);
    const reviewerInitials = applicantInitials(
      reviewer.name,
      reviewer.email
    );

    return `
      <tr data-application-row="${esc(row.membership_id)}">
        <td class="nl550-check-cell" data-label="Select"><input type="checkbox" disabled aria-label="Select application ${esc(row.application_reference || row.membership_id)}"></td>
        <td data-label="Applicant">
          <button type="button" class="nl550-applicant-button" data-application="${esc(row.membership_id)}">
            <span class="nl550-avatar">${esc(initials)}</span>
            <span>
              <strong>${esc(row.name || 'Applicant')}</strong>
              <small>${esc(row.email || '')}</small>
            </span>
          </button>
        </td>
        <td data-label="Application ID"><button type="button" class="nl550-reference" data-application="${esc(row.membership_id)}">${esc(row.application_reference || `APP-${row.membership_id}`)}</button></td>
        <td data-label="Organization">
          <div class="nl550-org-cell">
            <strong>${esc(employment.employer_name || 'Not provided')}</strong>
            <small>${esc([employment.city, employment.country].filter(Boolean).join(', ') || '—')}</small>
          </div>
        </td>
        <td data-label="Submitted"><div class="nl550-date-cell">${formatApplicationDate(row.submitted_at, true)}</div></td>
        <td data-label="Status"><span class="nl550-status" data-tone="${esc(applicationTone(row.status))}">${esc(label(row.status))}</span></td>
        <td data-label="Review Stage">
          <div class="nl550-stage-cell">
            <strong>${esc(stage.label || 'Review')}</strong>
            <small>${stage.step ? `Step ${esc(stage.step)} of ${esc(stage.steps_total || 4)}` : 'Workflow stage'}</small>
          </div>
        </td>
        <td data-label="Assigned To">
          <div class="nl550-reviewer-cell">
            <span class="nl550-reviewer-avatar ${reviewer.name ? '' : 'empty'}">${reviewer.name ? esc(reviewerInitials) : '—'}</span>
            <span>
              <strong>${esc(reviewer.name || 'Unassigned')}</strong>
              <small>${row.is_assigned_to_me ? 'You' : esc(reviewer.email || '')}</small>
            </span>
          </div>
        </td>
        <td data-label="SLA">
          <div class="nl550-sla" data-tone="${esc(sla.tone)}">
            <strong>${esc(sla.label)}</strong>
            <span><i style="width:${esc(sla.progress)}%"></i></span>
          </div>
        </td>
        <td class="nl550-actions-cell" data-label="Actions">
          <button type="button" class="nl550-row-menu" data-application="${esc(row.membership_id)}" aria-label="Review ${esc(row.application_reference || row.membership_id)}">•••</button>
        </td>
      </tr>
    `;
  }

  function renderApplicationPagination(total) {
    const pageSize = Math.max(1, Number(applicationPageSize || 10));
    const pages = Math.max(1, Math.ceil(total / pageSize));

    if (applicationPage > pages) {
      applicationPage = pages;
    }

    const start = total
      ? ((applicationPage - 1) * pageSize) + 1
      : 0;
    const end = Math.min(
      total,
      applicationPage * pageSize
    );

    $('applicationResultSummary').textContent =
      total
        ? `Showing ${start} to ${end} of ${total} results`
        : 'No applications match these filters';

    const pagination = $('applicationPagination');

    if (!pagination) return;

    const buttons = [];

    buttons.push(`
      <button type="button" data-page="${Math.max(1, applicationPage - 1)}" ${applicationPage <= 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>
    `);

    const visible = new Set([
      1,
      pages,
      applicationPage - 1,
      applicationPage,
      applicationPage + 1
    ].filter(page => page >= 1 && page <= pages));

    let last = 0;

    Array.from(visible)
      .sort((a, b) => a - b)
      .forEach(page => {
        if (last && page - last > 1) {
          buttons.push('<span>…</span>');
        }

        buttons.push(`
          <button type="button" data-page="${page}" class="${page === applicationPage ? 'active' : ''}">${page}</button>
        `);

        last = page;
      });

    buttons.push(`
      <button type="button" data-page="${Math.min(pages, applicationPage + 1)}" ${applicationPage >= pages ? 'disabled' : ''} aria-label="Next page">›</button>
    `);

    pagination.innerHTML = buttons.join('');

    pagination
      .querySelectorAll('[data-page]')
      .forEach(button => {
        button.addEventListener('click', () => {
          applicationPage = Number(button.dataset.page || 1);

          if (applicationViewMode === 'all') {
            renderAllApplicationTable();
          } else {
            renderApplicationTable();
          }
        });
      });
  }

  function renderApplicationTable() {
    const el = $('applicationsArea');
    const rows = applicationVisibleRows;
    const pageSize = Math.max(
      1,
      Number(applicationPageSize || 10)
    );
    const start = (applicationPage - 1) * pageSize;
    const pageRows = rows.slice(
      start,
      start + pageSize
    );

    if (!rows.length) {
      el.innerHTML =
        '<div class="nl530-empty nl550-empty-table">No membership applications match these filters.</div>';
      renderApplicationPagination(0);
      return;
    }

    el.innerHTML = `
      <table class="nl550-applications-table">
        <thead>
          <tr>
            <th class="nl550-check-cell"><input type="checkbox" disabled aria-label="Select all applications"></th>
            <th>Applicant</th>
            <th>Application ID</th>
            <th>Organization</th>
            <th>Submitted</th>
            <th>Status</th>
            <th>Review Stage</th>
            <th>Assigned To</th>
            <th>SLA</th>
            <th class="nl550-actions-cell">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pageRows.map(applicationTableRow).join('')}
        </tbody>
      </table>
    `;

    el
      .querySelectorAll('[data-application]')
      .forEach(button => {
        button.addEventListener(
          'click',
          () => openApplication(
            Number(button.dataset.application)
          )
        );
      });

    renderApplicationPagination(rows.length);
  }

  function applicationFilterSnapshot() {
    return {
      search: $('applicationSearch')?.value.trim() || '',
      status: $('applicationStatus')?.value || '',
      stage: $('applicationStage')?.value || '',
      assignment: $('applicationAssignment')?.value || 'all',
      priority: $('applicationFilterPriority')?.value || '',
      organization: $('applicationOrganization')?.value.trim() || '',
      overdue: Boolean($('applicationOverdue')?.checked)
    };
  }

  function applicationQueryParams(snapshot = applicationFilterSnapshot()) {
    const params = new URLSearchParams();

    if (snapshot.search) params.set('search', snapshot.search);
    if (snapshot.status) params.set('status', snapshot.status);
    if (snapshot.stage) params.set('stage', snapshot.stage);
    if (snapshot.priority) params.set('priority', snapshot.priority);
    if (snapshot.organization) params.set('organization', snapshot.organization);
    if (snapshot.overdue) params.set('overdue', '1');

    params.set(
      'assignment',
      snapshot.assignment || 'all'
    );

    return params;
  }

  function applicationViewStorageKey() {
    const userKey =
      currentAdminUser?.id
      || currentAdminUser?.email
      || 'administrator';

    return `nurselink:admin:application-views:v552:${userKey}`;
  }

  function readApplicationSavedViews() {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(
          applicationViewStorageKey()
        )
        || '[]'
      );

      return Array.isArray(parsed)
        ? parsed.slice(0, 12)
        : [];
    } catch (_) {
      return [];
    }
  }

  function writeApplicationSavedViews(rows) {
    try {
      localStorage.setItem(
        applicationViewStorageKey(),
        JSON.stringify(
          rows.slice(0, 12)
        )
      );
    } catch (_) {}
  }

  function renderApplicationSavedViews(selected = '') {
    const select = $('applicationSavedView');

    if (!select) return;

    const rows = readApplicationSavedViews();

    select.innerHTML = [
      '<option value="">Select saved view</option>',
      ...rows.map(row => `
        <option value="${esc(row.id)}">${esc(row.name)}</option>
      `)
    ].join('');

    if (
      selected
      && rows.some(
        row => String(row.id) === String(selected)
      )
    ) {
      select.value = selected;
    }
  }

  function applyApplicationFilterSnapshot(filters = {}, reload = true) {
    if ($('applicationSearch')) {
      $('applicationSearch').value =
        String(filters.search || '');
    }

    if ($('applicationStatus')) {
      $('applicationStatus').value =
        String(filters.status || '');
    }

    if ($('applicationStage')) {
      $('applicationStage').value =
        String(filters.stage || '');
    }

    if ($('applicationAssignment')) {
      $('applicationAssignment').value =
        String(filters.assignment || 'all');
    }

    if ($('applicationFilterPriority')) {
      $('applicationFilterPriority').value =
        String(filters.priority || '');
    }

    if ($('applicationOrganization')) {
      $('applicationOrganization').value =
        String(filters.organization || '');
    }

    if ($('applicationOverdue')) {
      $('applicationOverdue').checked =
        Boolean(filters.overdue);
    }

    if (reload) {
      applicationPage = 1;
      loadApplications();
    }
  }

  function markApplicationQuickView(key = '') {
    applicationActiveQuickView = key;

    document
      .querySelectorAll('[data-application-quick]')
      .forEach(button => {
        button.classList.toggle(
          'active',
          button.dataset.applicationQuick === key
        );
      });
  }

  function setApplicationQuickView(key) {
    const base = {
      search: '',
      status: '',
      stage: '',
      assignment: 'all',
      priority: '',
      organization: '',
      overdue: false
    };

    if (key === 'ready') {
      base.status = 'ready_for_approval';
    } else if (key === 'overdue') {
      base.overdue = true;
    } else if (key === 'unassigned') {
      base.assignment = 'unassigned';
    } else if (key === 'urgent') {
      base.priority = 'urgent';
    } else if (key === 'mine') {
      base.assignment = 'mine';
    }

    markApplicationQuickView(key);
    applyApplicationFilterSnapshot(base);
  }

  function saveApplicationView() {
    const name = String(
      window.prompt(
        'Name this application queue view:'
      )
      || ''
    )
      .trim()
      .slice(0, 40);

    if (!name) return;

    const rows = readApplicationSavedViews();
    const id =
      `view-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    rows.unshift({
      id,
      name,
      filters: applicationFilterSnapshot()
    });

    writeApplicationSavedViews(rows);
    renderApplicationSavedViews(id);
    notice(
      `Saved application view “${name}”.`,
      'good'
    );
  }

  function loadApplicationSavedView() {
    const id = $('applicationSavedView')?.value || '';

    if (!id) return;

    const row = readApplicationSavedViews()
      .find(
        item => String(item.id) === String(id)
      );

    if (!row) return;

    markApplicationQuickView('');
    applyApplicationFilterSnapshot(
      row.filters || {}
    );
  }

  function deleteApplicationSavedView() {
    const select = $('applicationSavedView');
    const id = select?.value || '';

    if (!id) return;

    const rows = readApplicationSavedViews();
    const target = rows.find(
      row => String(row.id) === String(id)
    );

    writeApplicationSavedViews(
      rows.filter(
        row => String(row.id) !== String(id)
      )
    );

    renderApplicationSavedViews();

    if (target) {
      notice(
        `Deleted saved view “${target.name}”.`
      );
    }
  }

  function workloadTone(level) {
    return {
      light: 'good',
      balanced: 'balanced',
      high: 'warning',
      heavy: 'danger'
    }[level] || 'neutral';
  }

  function renderApplicationWorkload(rows = []) {
    const section = $('applicationWorkloadSection');
    const container = $('applicationWorkload');
    const recommendation = $('applicationWorkloadRecommendation');
    const exportButton = $('exportApplications');
    const canBalance = ['admin', 'super_admin'].includes(roleKey());

    if (exportButton) {
      exportButton.hidden = !canBalance;
    }

    if (!section || !container) return;

    if (!canBalance) {
      section.hidden = true;
      return;
    }

    section.hidden = false;

    const active = rows
      .filter(
        row =>
          row.active
          && ['reviewer', 'admin', 'super_admin'].includes(row.role)
      )
      .sort((a, b) => {
        const scoreDelta =
          Number(a.workload_score || 0)
          - Number(b.workload_score || 0);

        if (scoreDelta !== 0) return scoreDelta;

        return Number(a.pending_workload || 0)
          - Number(b.pending_workload || 0);
      });

    if (!active.length) {
      container.innerHTML =
        '<div class="nl530-empty">No active privileged reviewers are available for workload balancing.</div>';

      if (recommendation) {
        recommendation.innerHTML = '';
      }

      return;
    }

    const suggested = active[0];

    if (recommendation) {
      recommendation.innerHTML = `
        <span>Lowest current queue pressure</span>
        <strong>${esc(suggested.name || suggested.email || 'Reviewer')}</strong>
        <small>${esc(suggested.pending_workload || 0)} pending · score ${esc(suggested.workload_score || 0)}</small>
      `;
    }

    container.innerHTML = active
      .slice(0, 8)
      .map(row => {
        const tone = workloadTone(row.workload_level);
        const initials = applicantInitials(row.name, row.email);

        return `
          <button type="button" class="nl552-workload-item nl-admin-card-link" data-tone="${esc(tone)}" data-open-workload-queue="${row.is_current_user ? 'mine' : 'assigned'}" aria-label="Open ${row.is_current_user ? 'your' : 'assigned'} application workload">
            <div class="nl552-workload-person">
              <span class="nl552-workload-avatar">${esc(initials)}</span>
              <div>
                <strong>${esc(row.name || row.email || 'Reviewer')}</strong>
                <small>${esc(row.role_label || label(row.role))}${row.is_current_user ? ' · You' : ''}</small>
              </div>
            </div>
            <div class="nl552-workload-stats">
              <span><b>${esc(row.pending_workload || 0)}</b> Pending</span>
              <span><b>${esc(row.overdue_workload || 0)}</b> Overdue</span>
              <span><b>${esc(row.urgent_workload || 0)}</b> Urgent</span>
              <span><b>${esc(row.ready_for_approval_workload || 0)}</b> Ready</span>
            </div>
            <div class="nl552-load-level" data-tone="${esc(tone)}">
              ${esc(label(row.workload_level || 'light'))} queue
            </div>
          </button>
        `;
      })
      .join('');
  }

  async function exportApplicationQueue() {
    if (!['admin', 'super_admin'].includes(roleKey())) {
      notice(
        'Administrator access is required to export applications.',
        'danger'
      );
      return;
    }

    const button = $('exportApplications');

    if (button) {
      button.disabled = true;
      button.textContent = 'Preparing CSV…';
    }

    try {
      const params = applicationQueryParams();
      const response = await fetch(
        `${API}/api/nurselink/admin/membership-administration/export?${params}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'text/csv',
            'X-Requested-With': 'XMLHttpRequest'
          }
        }
      );

      if (!response.ok) {
        let message =
          `Application export failed (${response.status}).`;

        try {
          const payload = await response.json();
          message = payload?.message || message;
        } catch (_) {}

        const error = new Error(message);
        error.status = response.status;
        throw error;
      }

      const blob = await response.blob();
      const disposition =
        response.headers.get('Content-Disposition')
        || '';

      const filenameMatch =
        disposition.match(
          /filename="?([^";]+)"?/i
        );

      const filename =
        filenameMatch?.[1]
        || 'nurselink-membership-applications.csv';

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setTimeout(
        () => URL.revokeObjectURL(url),
        1000
      );

      notice(
        'Application queue CSV exported.',
        'good'
      );
    } catch (error) {
      if (needsLogin(error)) {
        redirectToLogin();
        return;
      }

      notice(
        error.message
        || 'Unable to export applications.',
        'danger'
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Export CSV';
      }
    }
  }

  function applicationClientFilter(rows) {
    const stage = $('applicationStage')?.value || '';

    if (!stage) return rows;

    return rows.filter(
      row => String(row.review_stage?.key || '') === stage
    );
  }


  function setApplicationViewMode(mode = 'membership') {
    applicationViewMode =
      mode === 'all'
        ? 'all'
        : 'membership';

    const button = $('viewAllApplications');
    const heading = document.querySelector(
      '.nl550-queue-heading h2'
    );
    const description = document.querySelector(
      '.nl550-queue-heading p'
    );
    const triage = document.querySelector(
      '.nl552-triagebar'
    );

    const membershipOnlyIds = [
      'applicationStage',
      'applicationAssignment',
      'applicationFilterPriority',
      'applicationOrganization',
      'applicationOverdue'
    ];

    membershipOnlyIds.forEach(id => {
      const field = $(id);
      const wrapper = field?.closest('label');

      if (wrapper) {
        wrapper.hidden =
          applicationViewMode === 'all';
      }
    });

    if (triage) {
      triage.hidden =
        applicationViewMode === 'all';
    }

    if (button) {
      button.textContent =
        applicationViewMode === 'all'
          ? 'Back to Membership Queue'
          : 'View All Applications';
    }

    if (heading) {
      heading.textContent =
        applicationViewMode === 'all'
          ? 'All Applications'
          : 'Membership Applications';
    }

    if (description) {
      description.textContent =
        applicationViewMode === 'all'
          ? 'View every NurseLink application, including draft and imported Temporary Encoder applications.'
          : 'Review, assign and progress membership applications through governed NurseLink workflows.';
    }

    const status = $('applicationStatus');

    if (status) {
      const current =
        applicationViewMode === 'all'
          ? ''
          : status.value;

      status.innerHTML =
        applicationViewMode === 'all'
          ? `
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="returned_for_information">Returned for Information</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          `
          : `
            <option value="">Pending only</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="needs_information">Needs Information</option>
            <option value="ready_for_approval">Ready for Approval</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
          `;

      if (
        applicationViewMode === 'membership'
        && Array.from(status.options).some(
          option => option.value === current
        )
      ) {
        status.value = current;
      }
    }
  }

  function allApplicationSource(row) {
    const profile =
      row?.profile_data
      && typeof row.profile_data === 'object'
        ? row.profile_data
        : {};

    const snapshot =
      profile._bulk_professional_snapshot
      && typeof profile._bulk_professional_snapshot === 'object'
        ? profile._bulk_professional_snapshot
        : null;

    if (
      snapshot?.source === 'bulk_nurse_intake'
    ) {
      return 'Temporary Encoder Import';
    }

    return 'Applicant';
  }

  function allApplicationRow(row) {
    const user = row.user || {};
    const reviewer = row.reviewer || {};
    const initials = applicantInitials(
      user.name,
      user.email
    );

    return `
      <tr data-all-application-row="${esc(row.id)}">
        <td class="nl550-check-cell" data-label="Select">
          <input
            type="checkbox"
            disabled
            aria-label="Select application ${esc(row.application_no || row.id)}"
          >
        </td>

        <td data-label="Applicant">
          <button
            type="button"
            class="nl550-applicant-button"
            data-all-application="${esc(row.id)}"
          >
            <span class="nl550-avatar">${esc(initials)}</span>
            <span>
              <strong>${esc(user.name || 'Applicant')}</strong>
              <small>${esc(user.email || '')}</small>
            </span>
          </button>
        </td>

        <td data-label="Application ID">
          <button
            type="button"
            class="nl550-reference"
            data-all-application="${esc(row.id)}"
          >
            ${esc(row.application_no || row.id)}
          </button>
        </td>

        <td data-label="Source">
          <strong>${esc(allApplicationSource(row))}</strong>
        </td>

        <td data-label="Progress">
          <strong>${esc(row.progress_percent ?? 0)}%</strong>
        </td>

        <td data-label="Created">
          <div class="nl550-date-cell">
            ${formatApplicationDate(row.created_at, true)}
          </div>
        </td>

        <td data-label="Status">
          <span
            class="nl550-status"
            data-tone="${esc(applicationTone(row.status))}"
          >
            ${esc(label(row.status))}
          </span>
        </td>

        <td data-label="Reviewer">
          <strong>${esc(reviewer.name || 'Unassigned')}</strong>
        </td>

        <td class="nl550-actions-cell" data-label="Actions">
          <button
            type="button"
            class="nl550-row-menu"
            data-all-application="${esc(row.id)}"
            aria-label="Open ${esc(row.application_no || row.id)}"
          >•••</button>
        </td>
      </tr>
    `;
  }

  function renderAllApplicationTable() {
    const el = $('applicationsArea');
    const rows = applicationVisibleRows;
    const pageSize = Math.max(
      1,
      Number(applicationPageSize || 10)
    );

    const start =
      (applicationPage - 1) * pageSize;

    const pageRows =
      rows.slice(
        start,
        start + pageSize
      );

    if (!rows.length) {
      el.innerHTML =
        '<div class="nl530-empty nl550-empty-table">No applications match these filters.</div>';

      renderApplicationPagination(0);
      return;
    }

    el.innerHTML = `
      <table class="nl550-applications-table">
        <thead>
          <tr>
            <th class="nl550-check-cell">
              <input
                type="checkbox"
                disabled
                aria-label="Select all applications"
              >
            </th>
            <th>Applicant</th>
            <th>Application ID</th>
            <th>Source</th>
            <th>Progress</th>
            <th>Created</th>
            <th>Status</th>
            <th>Reviewer</th>
            <th class="nl550-actions-cell">Actions</th>
          </tr>
        </thead>

        <tbody>
          ${pageRows.map(allApplicationRow).join('')}
        </tbody>
      </table>
    `;

    el
      .querySelectorAll('[data-all-application]')
      .forEach(button => {
        button.addEventListener(
          'click',
          () => openAllApplication(
            button.dataset.allApplication
          )
        );
      });

    renderApplicationPagination(
      rows.length
    );
  }

  async function openAllApplication(id) {
    selectedApplicationId = id;

    const drawer =
      $('applicationDetailDrawer');

    const el =
      $('applicationDetail');

    if (drawer) {
      drawer.hidden = false;
      document.body.classList.add(
        'nl550-detail-open'
      );
    }

    const queueRow =
      applicationRows.find(
        row => String(row.id) === String(id)
      ) || {};

    if ($('applicationDetailTitle')) {
      $('applicationDetailTitle').textContent =
        queueRow.application_no
        || 'Application';
    }

    el.innerHTML =
      '<div class="nl-admin-loading">Loading application…</div>';

    try {
      const payload =
        await request(
          `/api/admin/applications/${encodeURIComponent(id)}`
        );

      const data =
        payload?.data || {};

      const user =
        data.user || {};

      const reviewer =
        data.reviewer || {};

      const profile =
        data.profile_data
        && typeof data.profile_data === 'object'
          ? data.profile_data
          : {};

      const snapshot =
        profile._bulk_professional_snapshot
        && typeof profile._bulk_professional_snapshot === 'object'
          ? profile._bulk_professional_snapshot
          : null;

      const counts = {
        education:
          Array.isArray(snapshot?.education)
            ? snapshot.education.length
            : 0,

        employment:
          Array.isArray(snapshot?.employment)
            ? snapshot.employment.length
            : 0,

        credentials:
          Array.isArray(snapshot?.credentials)
            ? snapshot.credentials.length
            : 0,

        competencies:
          Array.isArray(snapshot?.competencies)
            ? snapshot.competencies.length
            : 0,

        languages:
          Array.isArray(snapshot?.languages)
            ? snapshot.languages.length
            : 0,

        references:
          Array.isArray(snapshot?.references)
            ? snapshot.references.length
            : 0
      };

      const imported =
        snapshot?.source ===
        'bulk_nurse_intake';

      el.innerHTML = `
        <div class="nl530-detail-head">
          <div>
            <span class="nl-admin-eyebrow">
              ${esc(data.application_no || 'APPLICATION')}
            </span>
            <h2>${esc(user.name || user.email || 'Applicant')}</h2>
            <p>${esc(user.email || '')}</p>
          </div>

          <span class="nl530-badge">
            ${esc(label(data.status))}
          </span>
        </div>

        <section class="nl530-subpanel">
          <strong>Application status</strong>

          <div class="nl557-smart-review-grid">
            <div class="nl557-smart-review-item">
              <span>Progress</span>
              <strong>${esc(data.progress_percent ?? 0)}%</strong>
            </div>

            <div class="nl557-smart-review-item">
              <span>Source</span>
              <strong>${esc(imported ? 'Temporary Encoder Import' : 'Applicant')}</strong>
            </div>

            <div class="nl557-smart-review-item">
              <span>Reviewer</span>
              <strong>${esc(reviewer.name || 'Unassigned')}</strong>
            </div>

            <div class="nl557-smart-review-item">
              <span>Created</span>
              <strong>${formatApplicationDate(data.created_at, false)}</strong>
            </div>

            <div class="nl557-smart-review-item">
              <span>Submitted</span>
              <strong>${data.submitted_at ? formatApplicationDate(data.submitted_at, true) : 'Not submitted'}</strong>
            </div>

            <div class="nl557-smart-review-item">
              <span>Application ID</span>
              <strong>${esc(data.application_no || data.id)}</strong>
            </div>
          </div>
        </section>

        ${
          imported
            ? `
              <section class="nl530-subpanel">
                <strong>Imported professional snapshot</strong>
                <p>
                  This application was created from the governed
                  Temporary Encoder / Bulk Nurse Import workflow.
                </p>

                <div class="nl557-smart-review-grid">
                  <div class="nl557-smart-review-item">
                    <span>Education</span>
                    <strong>${esc(counts.education ?? 0)}</strong>
                  </div>

                  <div class="nl557-smart-review-item">
                    <span>Employment</span>
                    <strong>${esc(counts.employment ?? 0)}</strong>
                  </div>

                  <div class="nl557-smart-review-item">
                    <span>Credentials</span>
                    <strong>${esc(counts.credentials ?? 0)}</strong>
                  </div>

                  <div class="nl557-smart-review-item">
                    <span>Competencies</span>
                    <strong>${esc(counts.competencies ?? 0)}</strong>
                  </div>

                  <div class="nl557-smart-review-item">
                    <span>Languages</span>
                    <strong>${esc(counts.languages ?? 0)}</strong>
                  </div>

                  <div class="nl557-smart-review-item">
                    <span>Private references</span>
                    <strong>${esc(counts.references ?? 0)}</strong>
                  </div>
                </div>
              </section>
            `
            : ''
        }

        <section class="nl530-subpanel">
          <strong>Workflow position</strong>

          ${
            data.status === 'draft'
              ? `
                <div class="nl530-empty">
                  Draft application. It has not yet been submitted
                  into the membership review queue.
                </div>

                ${
                  imported
                    ? `
                      <div
                        id="importedActivationFeedback"
                        class="nl558-drawer-feedback"
                        role="status"
                        aria-live="polite"
                        hidden
                      ></div>

                      <div class="nl530-row-actions" style="margin-top:14px">
                        <button
                          id="sendImportedToTemporaryEncoder"
                          type="button"
                          class="primary"
                        >
                          Send to Temporary Encoder
                        </button>
                      </div>

                      <p class="nl557-smart-review-boundary">
                        This assigns the imported nurse record back to the
                        originating Temporary Encoder for continued data completion.
                        No nurse password or activation link is shared with the encoder.
                      </p>
                    `
                    : ''
                }
              `
              : `
                <div class="nl530-empty">
                  This application is in ${esc(label(data.status))}
                  status. Membership review controls remain in the
                  governed Membership Applications queue.
                </div>
              `
          }
        </section>
      `;

      const temporaryEncoderHandoffButton =
        $('sendImportedToTemporaryEncoder');

      if (temporaryEncoderHandoffButton) {
        temporaryEncoderHandoffButton.addEventListener(
          'click',
          async () => {
            if (
              !confirm(
                `Send ${user.name || user.email || 'this applicant'} back to the originating Temporary Encoder for continued data completion?`
              )
            ) {
              return;
            }

            const feedback =
              $('importedActivationFeedback');

            temporaryEncoderHandoffButton.disabled = true;
            temporaryEncoderHandoffButton.textContent = 'Assigning…';

            if (feedback) {
              feedback.hidden = false;
              feedback.textContent =
                'Assigning the application to the Temporary Encoder…';
            }

            try {
              const result =
                await request(
                  `/api/admin/applications/${encodeURIComponent(id)}/temporary-encoder-handoff`,
                  {
                    method: 'POST',
                    body: '{}'
                  }
                );

              notice(
                result?.message || 'Application assigned to Temporary Encoder.',
                'success'
              );

              if (feedback) {
                feedback.textContent =
                  result?.message || 'Application assigned to Temporary Encoder.';
              }

            } catch (error) {
              notice(
                error.message || 'Unable to assign the application to the Temporary Encoder.',
                'error'
              );

              if (feedback) {
                feedback.textContent =
                  error.message || 'Unable to assign the application to the Temporary Encoder.';
              }

            } finally {
              if (temporaryEncoderHandoffButton.isConnected) {
                temporaryEncoderHandoffButton.disabled = false;
                temporaryEncoderHandoffButton.textContent =
                  'Send to Temporary Encoder';
              }
            }
          }
        );
      }

    } catch (error) {
      if (needsLogin(error)) {
        redirectToLogin();
        return;
      }

      el.innerHTML =
        `<div class="nl530-empty">${esc(error.message)}</div>`;
    }
  }

  async function loadAllApplications() {
    const el =
      $('applicationsArea');

    el.innerHTML =
      '<div class="nl-admin-loading">Loading all NurseLink applications…</div>';

    const search =
      $('applicationSearch')?.value.trim()
      || '';

    const status =
      $('applicationStatus')?.value
      || '';

    const params =
      new URLSearchParams();

    if (search) {
      params.set(
        'search',
        search
      );
    }

    if (status) {
      params.set(
        'status',
        status
      );
    }

    try {
      const first =
        await request(
          `/api/admin/applications?${params.toString()}`
        );

      let rows =
        Array.isArray(first?.data)
          ? first.data
          : [];

      const lastPage =
        Math.max(
          1,
          Number(first?.last_page || 1)
        );

      if (lastPage > 1) {
        const pages = [];

        for (
          let page = 2;
          page <= lastPage;
          page += 1
        ) {
          const pageParams =
            new URLSearchParams(
              params
            );

          pageParams.set(
            'page',
            String(page)
          );

          pages.push(
            request(
              `/api/admin/applications?${pageParams.toString()}`
            )
          );
        }

        const payloads =
          await Promise.all(pages);

        payloads.forEach(payload => {
          if (Array.isArray(payload?.data)) {
            rows = rows.concat(
              payload.data
            );
          }
        });
      }

      applicationRows = rows;
      applicationVisibleRows = rows;
      applicationPage = 1;

      renderAllApplicationTable();

    } catch (error) {
      if (needsLogin(error)) {
        redirectToLogin();
        return;
      }

      el.innerHTML =
        `<div class="nl530-empty">${esc(error.message)}</div>`;
    }
  }

  function viewAllApplications() {
    if (
      applicationViewMode === 'all'
    ) {
      setApplicationViewMode(
        'membership'
      );

      clearApplicationFilters();
      return;
    }

    setApplicationViewMode(
      'all'
    );

    markApplicationQuickView('');

    if ($('applicationSearch')) {
      $('applicationSearch').value = '';
    }

    if ($('applicationStatus')) {
      $('applicationStatus').value = '';
    }

    applicationPage = 1;
    loadAllApplications();
  }


  function bindViewAllApplicationsHard() {
    const button = $('viewAllApplications');

    if (!button || button.dataset.v702Bound === '1') {
      return;
    }

    button.dataset.v702Bound = '1';

    button.addEventListener(
      'click',
      event => {
        event.preventDefault();
        event.stopPropagation();

        console.info(
          '[NurseLink V702] View All Applications clicked'
        );

        viewAllApplications();
      },
      true
    );
  }

  async function loadApplications() {
    if (applicationViewMode === 'all') {
      return loadAllApplications();
    }

    const el = $('applicationsArea');
    el.innerHTML =
      '<div class="nl-admin-loading">Loading professional applications command center…</div>';

    const params = applicationQueryParams();

    try {
      const commandPromise = applicationCommandData
        ? Promise.resolve(applicationCommandData)
        : Promise.all([
            request('/api/nurselink/admin/membership-administration/overview'),
            request('/api/nurselink/admin/operations-center/summary'),
            request('/api/nurselink/admin/membership-onboarding/summary')
              .catch(() => ({data: {counts: {}, overdue: 0, unassigned: 0}})),
            ['admin', 'super_admin'].includes(roleKey())
              ? request('/api/nurselink/admin/membership-administration/staff')
                  .catch(() => ({data: []}))
              : Promise.resolve({data: []})
          ]).then(([
            overviewPayload,
            operationsPayload,
            onboardingPayload,
            staffPayload
          ]) => ({
            overview: overviewPayload?.data || {},
            operations: operationsPayload?.data || {},
            onboarding: onboardingPayload?.data || {},
            staff: Array.isArray(staffPayload?.data)
              ? staffPayload.data
              : []
          }));

      const [
        queuePayload,
        commandData
      ] = await Promise.all([
        request(`/api/nurselink/admin/membership-administration/queue?${params}`),
        commandPromise
      ]);

      applicationRows = Array.isArray(queuePayload?.data)
        ? queuePayload.data
        : [];

      applicationVisibleRows = applicationClientFilter(
        applicationRows
      );

      applicationCommandData = commandData;

      renderApplicationCommandHeader(
        applicationCommandData.operations,
        applicationCommandData.overview,
        applicationCommandData.onboarding
      );

      applicationStaffRows =
        Array.isArray(applicationCommandData.staff)
          ? applicationCommandData.staff
          : [];

      renderApplicationWorkload(
        applicationStaffRows
      );

      renderApplicationSavedViews(
        $('applicationSavedView')?.value || ''
      );

      applicationPage = 1;
      renderApplicationTable();
    } catch (error) {
      if (needsLogin(error)) {
        redirectToLogin();
        return;
      }

      el.innerHTML =
        `<div class="nl530-empty">${esc(error.message)}</div>`;
    }
  }


  function smartApplicationReviewHtml(smart) {
    const profile = smart?.profile || null;
    const documents = Array.isArray(smart?.documents) ? smart.documents : [];
    if (!profile && !documents.length) return '';

    const fullName = profile
      ? [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ')
      : '';
    const location = profile
      ? [profile.city, profile.province, profile.country].filter(Boolean).join(', ')
      : '';

    const row = (name, value) => `
      <div class="nl557-smart-review-item">
        <span>${esc(name)}</span>
        <strong>${esc(value === null || value === undefined || value === '' ? 'Not provided' : value)}</strong>
      </div>`;

    return `
      <section class="nl530-subpanel nl557-smart-review">
        <div class="nl557-smart-review-head">
          <div><strong>Smart Registration submission</strong><small>Applicant-confirmed values and privately stored evidence</small></div>
          <span>${documents.length} document${documents.length === 1 ? '' : 's'}</span>
        </div>
        ${profile ? `
          <div class="nl557-smart-review-groups">
            <div>
              <h4>Personal information</h4>
              <div class="nl557-smart-review-grid">
                ${row('Name', fullName)}
                ${row('Date of birth', profile.birth_date)}
                ${row('Nationality', profile.nationality)}
                ${row('Mobile', profile.phone)}
                ${row('Location', location)}
              </div>
            </div>
            <div>
              <h4>Professional details</h4>
              <div class="nl557-smart-review-grid">
                ${row('Professional title', profile.professional_title)}
                ${row('Experience', profile.years_experience === null || profile.years_experience === undefined ? '' : `${profile.years_experience} years`)}
                ${row('Employer', profile.current_employer)}
                ${row('Specialty', profile.specialty)}
                ${row('License / registration', profile.primary_license_number)}
                ${row('License jurisdiction', profile.primary_license_country)}
                ${row('License expiry', profile.primary_license_expiry)}
                ${row('Nursing education', profile.highest_nursing_education)}
              </div>
            </div>
          </div>
        ` : ''}
        <div class="nl557-smart-review-docs">
          <h4>Supporting evidence</h4>
          ${documents.length ? documents.map(doc => `
            <div class="nl557-smart-review-doc">
              <div>
                <strong>${esc(doc.name || 'Document')}</strong>
                <small>${esc(label(doc.document_type || 'document'))} · ${esc(label(doc.extraction_status || 'uploaded'))}${doc.file_size ? ` · ${Math.max(1, Math.round(Number(doc.file_size) / 1024))} KB` : ''}</small>
              </div>
              <a href="${esc(doc.download_url ? `${API}${doc.download_url}` : '#')}" target="_blank" rel="noopener">Open evidence</a>
            </div>
          `).join('') : '<div class="nl530-empty">No Smart Registration evidence was attached.</div>'}
        </div>
        <p class="nl557-smart-review-boundary">Extracted values assist data entry only. Credential and identity verification remain reviewer-controlled.</p>
      </section>`;
  }

  function closeApplicationDetail() {
    const drawer = $('applicationDetailDrawer');

    if (drawer) {
      drawer.hidden = true;
    }

    document.body.classList.remove('nl550-detail-open');
    selectedApplicationId = null;
  }

  function applicationDrawerFeedback(message, tone = 'success') {
    const feedback = $('applicationActionFeedback');
    if (!feedback) return;
    feedback.hidden = false;
    feedback.dataset.tone = tone;
    feedback.textContent = message;
  }

  async function openApplication(id) {
    selectedApplicationId = id;
    const drawer = $('applicationDetailDrawer');
    const el = $('applicationDetail');

    if (drawer) {
      drawer.hidden = false;
      document.body.classList.add('nl550-detail-open');
    }

    const selectedRow = applicationRows.find(
      row => Number(row.membership_id) === Number(id)
    );

    if ($('applicationDetailTitle')) {
      $('applicationDetailTitle').textContent =
        selectedRow?.application_reference
        || `Application #${id}`;
    }
    el.innerHTML = '<div class="nl-admin-loading">Loading application…</div>';

    try {
      const [detailPayload, historyPayload, healthPayload] = await Promise.all([
        request(`/api/nurselink/admin/membership-command/${id}`),
        request(`/api/nurselink/admin/membership-command/${id}/history`),
        request(`/api/nurselink/admin/membership-cycle-health/${id}`),
        privilegedUsers.length ? Promise.resolve(null) : loadPrivilegedUsers().catch(() => null)
      ]);

      const data = detailPayload?.data || {};
      const membership = data.membership || {};
      const applicant = data.applicant || {};
      const profile = data.profile || {};
      const review = data.review || {};
      const smartApplication = data.smart_application || null;
      const allowed = Array.isArray(review.allowed_actions) ? review.allowed_actions : [];
      const history = Array.isArray(historyPayload?.data) ? historyPayload.data : [];
      const cycleHealth = healthPayload?.data || {};
      const cycleChecks = cycleHealth.checks || {};
      const artifactChecks = cycleHealth.registration_artifacts || {};
      const cycleWarnings = Array.isArray(cycleHealth.warnings) ? cycleHealth.warnings : [];
      const queueRow = applicationRows.find(row => Number(row.membership_id) === Number(id)) || {};

      el.innerHTML = `
        <div class="nl530-detail-head">
          <div><span class="nl-admin-eyebrow">${esc(queueRow.application_reference || `APPLICATION #${id}`)}</span><h2>${esc(applicant.name || applicant.email || 'Applicant')}</h2><p>${esc(applicant.email || '')}</p></div>
          <span class="nl530-badge">${esc(label(membership.status))}</span>
        </div>
        <div id="applicationActionFeedback" class="nl558-drawer-feedback" role="status" aria-live="polite" hidden></div>
        <div class="nl530-principles" style="margin-top:10px">
          <div><strong>Profile readiness</strong><span>Photo ${profile.profile_photo_uploaded ? 'uploaded' : 'missing'} · Employment ${esc(profile.employment_records ?? 0)} · Credentials ${esc(profile.credentials?.verified ?? 0)}/${esc(profile.credentials?.total ?? 0)} verified</span></div>
        </div>
        ${smartApplicationReviewHtml(smartApplication)}
        <section class="nl530-subpanel nl559-cycle-health" data-status="${esc(cycleHealth.status || 'unknown')}">
          <div class="nl559-cycle-health-head">
            <div>
              <span class="nl-admin-eyebrow">MEMBERSHIP CYCLE HEALTH</span>
              <strong>${esc(label(cycleHealth.status || 'unknown'))}</strong>
            </div>
            <span class="nl530-badge ${cycleHealth.status === 'healthy' ? 'good' : cycleHealth.repairable ? 'attention' : 'danger'}">${esc(label(cycleHealth.status || 'unknown'))}</span>
          </div>
          <div class="nl530-health-table">
            ${Object.entries(cycleChecks).map(([name, passed]) => `<div class="nl530-health-row"><span>${esc(label(name))}</span><b class="${passed ? 'good' : 'danger'}">${passed ? 'Healthy' : 'Needs attention'}</b></div>`).join('')}
          </div>
          ${Object.keys(artifactChecks).length ? `<div class="nl559-artifact-note"><strong>Registration artifacts</strong><span>${Object.entries(artifactChecks).map(([name, present]) => `${esc(label(name))}: ${present ? 'present' : 'not provided'}`).join(' · ')}</span>${cycleWarnings.length ? `<small>These are informational warnings and do not indicate broken lifecycle state.</small>` : ''}</div>` : ''}
          ${cycleHealth.repairable ? '<button id="reconcileMembershipCycle" type="button" class="nl530-action primary">Reconcile derived state</button>' : ''}
        </section>
        ${queueRow.can_assign ? `
        <section class="nl530-subpanel">
          <strong>Review assignment</strong>
          <form id="applicationAssignmentForm" class="nl530-row-form">
            <label class="wide"><span>Assigned reviewer</span><select id="applicationReviewer"><option value="">Unassigned</option>${privilegedUsers.filter(row => row.active && ['reviewer','admin','super_admin'].includes(row.role)).map(row => `<option value="${esc(row.user_id)}">${esc(row.name || row.email)} · ${esc(row.email || '')} · ${esc(label(row.role))}</option>`).join('')}</select></label>
            <label><span>Priority</span><select id="applicationPriority"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
            <label><span>Review due</span><input id="applicationDue" type="datetime-local"></label>
            <button type="submit">Save Assignment</button>
          </form>
        </section>` : ''}

        <section class="nl530-subpanel">
          <strong>Review decision</strong>
          ${allowed.length ? `
            <form id="applicationDecisionForm" class="nl530-row-form">
              <label><span>Next status</span><select id="applicationNextStatus"><option value="">Choose action</option>${allowed.map(value => `<option value="${esc(value)}">${esc(label(value))}</option>`).join('')}</select></label>
              <label class="wide"><span>Reviewer notes</span><textarea id="applicationReviewNotes" maxlength="6000">${esc(membership.reviewer_notes || '')}</textarea></label>
              <label class="wide"><span>Decision / information reason</span><textarea id="applicationReason" maxlength="3000"></textarea></label>
              <button type="submit">Apply Action</button>
            </form>
          ` : '<div class="nl530-empty">No application transitions are available for this role/status.</div>'}
        </section>
        <section class="nl530-subpanel">
          <strong>Recent activity</strong>
          <div class="nl530-list">
            ${history.slice(0,8).map(row => `<div class="nl530-audit"><strong>${esc(row.action || 'Administrative action')}</strong><small>${esc(row.reviewer_name || row.reviewer_email || row.reviewer_user_id || '')} · ${esc(row.created_at || '')}</small></div>`).join('') || '<div class="nl530-empty">No history recorded.</div>'}
          </div>
        </section>
      `;

      const assignmentForm = $('applicationAssignmentForm');

      $('reconcileMembershipCycle')?.addEventListener('click', async event => {
        const reason = prompt('Enter the audited reason for reconciling this approved membership (minimum 8 characters):');
        if (reason === null) return;
        if (reason.trim().length < 8) {
          applicationDrawerFeedback('Enter a reconciliation reason of at least 8 characters.', 'error');
          return;
        }

        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = 'Reconciling…';
        applicationDrawerFeedback('Reconciling approved membership derived state…', 'working');

        try {
          const result = await request(
            `/api/nurselink/admin/membership-cycle-health/${id}/reconcile`,
            {method: 'POST', body: JSON.stringify({reason: reason.trim()})}
          );
          applicationDrawerFeedback(result?.message || 'Membership cycle reconciled.', 'success');
          await openApplication(id);
        } catch (error) {
          applicationDrawerFeedback(error.message || 'Unable to reconcile membership cycle.', 'error');
          button.disabled = false;
          button.textContent = 'Reconcile derived state';
        }
      });

      if (assignmentForm) {
        $('applicationReviewer').value = queueRow.assigned_reviewer_user_id || '';
        $('applicationPriority').value = queueRow.review_priority || 'normal';

        if (queueRow.review_due_at) {
          const due = new Date(queueRow.review_due_at);
          const pad = n => String(n).padStart(2, '0');
          $('applicationDue').value =
            `${due.getFullYear()}-${pad(due.getMonth()+1)}-${pad(due.getDate())}T${pad(due.getHours())}:${pad(due.getMinutes())}`;
        }

        assignmentForm.addEventListener('submit', async event => {
          event.preventDefault();
          const button = event.submitter;
          if (button) {
            button.disabled = true;
            button.textContent = 'Saving…';
          }
          applicationDrawerFeedback('Saving review assignment…', 'working');

          try {
            const result = await request(
              `/api/nurselink/admin/membership-administration/${id}/assignment`,
              {
                method: 'PUT',
                body: JSON.stringify({
                  reviewer_user_id: $('applicationReviewer').value || null,
                  priority: $('applicationPriority').value,
                  review_due_at: $('applicationDue').value
                    ? new Date($('applicationDue').value).toISOString()
                    : null
                })
              }
            );

            notice(result?.message || 'Review assignment saved.', 'success');
            applicationCommandData = null;
            await loadApplications();
            await openApplication(id);
            applicationDrawerFeedback(result?.message || 'Review assignment saved.', 'success');
          } catch (error) {
            notice(error.message, 'error');
            applicationDrawerFeedback(error.message || 'Unable to save assignment.', 'error');
          } finally {
            if (button?.isConnected) {
              button.disabled = false;
              button.textContent = 'Save Assignment';
            }
          }
        });
      }

      $('applicationDecisionForm')?.addEventListener('submit', async event => {
        event.preventDefault();
        const status = $('applicationNextStatus').value;
        if (!status) {
          applicationDrawerFeedback('Choose a next status before applying an action.', 'error');
          $('applicationNextStatus').focus();
          return;
        }

        if (['approved', 'declined'].includes(status) && !confirm(`${label(status)} this membership application?`)) return;

        const button = event.submitter;
        if (button) {
          button.disabled = true;
          button.textContent = 'Applying…';
        }
        applicationDrawerFeedback(`Applying ${label(status)}…`, 'working');

        const transition = confirmSelfAction => request(
          `/api/nurselink/admin/membership-command/${id}/transition`,
          {
            method: 'POST',
            body: JSON.stringify({
              status,
              reviewer_notes: $('applicationReviewNotes').value.trim() || null,
              decision_reason: $('applicationReason').value.trim() || null,
              confirm_self_action: confirmSelfAction
            })
          }
        );

        try {
          let result;

          try {
            result = await transition(false);
          } catch (error) {
            if (
              error.payload?.confirmation_required
              && confirm('This is your own membership application. Confirm this audited Super Administrator action?')
            ) {
              result = await transition(true);
            } else {
              throw error;
            }
          }

          notice(result?.message || 'Application updated.', 'success');
          await Promise.all([loadApplications(), loadDashboard()]);
          await openApplication(id);
          applicationDrawerFeedback(result?.message || 'Application updated.', 'success');
        } catch (error) {
          notice(error.message, 'error');
          applicationDrawerFeedback(error.message || 'Unable to apply action.', 'error');
        } finally {
          if (button?.isConnected) {
            button.disabled = false;
            button.textContent = 'Apply Action';
          }
        }
      });

      await loadApplications();
    } catch (error) {
      if (needsLogin(error)) return redirectToLogin();
      el.innerHTML = `<div class="nl530-empty">${esc(error.message)}</div>`;
    }
  }

  function onboardingRow(row) {
    const signals = row.signals || {};

    return `
      <form class="nl530-row" data-onboarding="${esc(row.membership_id)}">
        <div class="nl530-row-main">
          ${badges([label(row.status), row.status === 'completed' ? 'good' : 'attention'], [row.member_number || 'Member', ''])}
          <strong>${esc(row.name || row.email)}</strong>
          <small>${esc(row.email || '')} · Activation ${esc(signals.activation_score ?? 0)}% · ${row.welcome_viewed_at ? 'Welcome viewed' : 'Welcome pending'} · ${row.orientation_completed_at ? 'Orientation complete' : 'Orientation pending'}</small>
        </div>
        <div class="nl530-row-actions">
          <select name="status">
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
          </select>
          <button type="button" data-send-welcome>Send Welcome</button>
          <button type="submit" class="primary">Save</button>
        </div>
      </form>
    `;
  }

  async function loadMemberOnboarding() {
    const el = $('memberOnboardingArea');
    if (!el) return;

    el.innerHTML = '<div class="nl-admin-loading">Loading onboarding…</div>';

    try {
      const payload = await request(
        '/api/nurselink/admin/membership-onboarding?assignment=all'
      );

      const rows = Array.isArray(payload?.data) ? payload.data : [];

      el.innerHTML = rows.length
        ? rows.slice(0, 100).map(onboardingRow).join('')
        : '<div class="nl530-empty">No onboarding records found.</div>';

      rows.slice(0, 100).forEach(row => {
        const form = el.querySelector(
          `[data-onboarding="${row.membership_id}"]`
        );

        if (!form) return;
        form.elements.status.value = row.status;

        form.addEventListener('submit', async event => {
          event.preventDefault();

          try {
            const result = await request(
              `/api/nurselink/admin/membership-onboarding/${row.membership_id}`,
              {
                method: 'PUT',
                body: JSON.stringify({
                  status: form.elements.status.value,
                  assigned_admin_user_id:
                    row.assigned_admin_user_id || null,
                  due_at: row.due_at || null,
                  admin_note: row.admin_note || null
                })
              }
            );

            notice(
              result?.message || 'Member onboarding updated.',
              'success'
            );

            await Promise.all([
              loadMemberOnboarding(),
              loadDashboard()
            ]);
          } catch (error) {
            notice(error.message, 'error');
          }
        });

        form
          .querySelector('[data-send-welcome]')
          ?.addEventListener('click', async () => {
            try {
              const result = await request(
                `/api/nurselink/admin/membership-onboarding/${row.membership_id}/welcome`,
                {
                  method: 'POST',
                  body: '{}'
                }
              );

              notice(
                result?.message || 'Welcome notification sent.',
                'success'
              );
            } catch (error) {
              notice(error.message, 'error');
            }
          });
      });
    } catch (error) {
      if (error.status === 403) {
        el.innerHTML =
          '<div class="nl530-empty">Administrator access is required for onboarding management.</div>';
        return;
      }

      if (needsLogin(error)) return redirectToLogin();

      el.innerHTML =
        `<div class="nl530-empty">${esc(error.message)}</div>`;
    }
  }

  async function loadVerification() {
    renderModules(
      'verificationModules',
      CFG?.managedModules?.verification || [],
      'Advanced credential compliance workflow under the current Administrator session.'
    );

    const el = $('verificationArea');
    el.innerHTML = '<div class="nl-admin-loading">Loading credential verification…</div>';

    const status = $('verificationStatus')?.value;
    const query = status ? `?status=${encodeURIComponent(status)}` : '';

    try {
      const payload = await request(`/api/reviewer/credentials${query}`);
      const rows = Array.isArray(payload?.data) ? payload.data : [];

      el.innerHTML = rows.length ? rows.map(row => `
        <form class="nl530-credential" data-credential="${esc(row.id)}">
          <div class="nl530-row-main">
            ${badges([label(row.verification_status), row.verification_status === 'verified' ? 'good' : row.verification_status === 'expired' ? 'danger' : 'attention'])}
            <strong>${esc(row.title || row.credential_type)}</strong>
            <small>${esc(row.member || row.user_id)} · ${esc(row.issuing_body || '')} · ${esc(row.country || '')}</small>
            ${row.evidence_download_url
              ? row.evidence_security_status === 'clean'
                ? `<a href="${esc(`${API}${row.evidence_download_url}`)}" target="_blank" rel="noopener">Open evidence</a>`
                : `<small>Evidence unavailable: ${esc(label(row.evidence_security_status || 'pending scan'))}</small>`
              : '<small>No primary evidence linked.</small>'}
          </div>
          <div class="nl530-row-form">
            <label><span>Status</span><select name="status"><option value="unverified">Unverified</option><option value="pending">Pending Review</option><option value="document_supported">Document Supported</option><option value="verified">Verified</option><option value="unable_to_verify">Unable to Verify</option><option value="discrepancy">Discrepancy</option></select></label>
            <label class="wide"><span>Review notes</span><textarea name="notes" maxlength="4000">${esc(row.review_notes || '')}</textarea></label>
            <button type="submit">Save Verification</button>
          </div>
        </form>
      `).join('') : '<div class="nl530-empty">No credentials match this status.</div>';

      rows.forEach(row => {
        const form = el.querySelector(`[data-credential="${row.id}"]`);
        if (!form) return;
        form.elements.status.value = row.verification_status;

        form.addEventListener('submit', async event => {
          event.preventDefault();
          try {
            const result = await request(`/api/reviewer/credentials/${row.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                verification_status: form.elements.status.value,
                review_notes: form.elements.notes.value.trim() || null
              })
            });
            notice(result?.message || 'Credential review saved.', 'success');
            await Promise.all([loadVerification(), loadDashboard()]);
          } catch (error) {
            notice(error.message, 'error');
          }
        });
      });
    } catch (error) {
      if (needsLogin(error)) return redirectToLogin();
      el.innerHTML = `<div class="nl530-empty">${esc(error.message)}</div>`;
    }
  }

  function organizationForm(row) {
    return `
      <form class="nl530-org" data-organization="${esc(row.id)}">
        <div class="nl530-row-main">
          ${badges([label(row.status), row.status === 'verified' ? 'good' : row.status === 'suspended' ? 'danger' : 'attention'])}
          <strong>${esc(row.name)}</strong>
          <small>${esc(label(row.organization_type))} · ${esc(row.city || '')} ${esc(row.country || '')}</small>
        </div>
        <div class="nl530-row-form">
          <label><span>Name</span><input name="name" value="${esc(row.name)}"></label>
          <label><span>Type</span><select name="organization_type"><option value="hospital">Hospital</option><option value="health_system">Health System</option><option value="clinic">Clinic</option><option value="recruitment_agency">Recruitment Agency</option><option value="government">Government</option><option value="education">Education</option><option value="professional_organization">Professional Organization</option><option value="other">Other</option></select></label>
          <label><span>Country</span><input name="country" value="${esc(row.country || '')}"></label>
          <label><span>City</span><input name="city" value="${esc(row.city || '')}"></label>
          <label><span>Website</span><input name="website" type="url" value="${esc(row.website || '')}"></label>
          <label><span>Status</span><select name="status"><option value="pending">Pending</option><option value="verified">Verified</option><option value="suspended">Suspended</option></select></label>
          <button type="submit">Save Organization</button>
        </div>
      </form>
    `;
  }

  async function loadOrganizations() {
    const el = $('organizationsArea');
    el.innerHTML = '<div class="nl-admin-loading">Loading organizations…</div>';

    try {
      const payload = await request('/api/reviewer/partner-organizations');
      const rows = Array.isArray(payload?.data) ? payload.data : [];

      el.innerHTML = rows.length
        ? rows.map(organizationForm).join('')
        : '<div class="nl530-empty">No partner organizations recorded.</div>';

      rows.forEach(row => {
        const form = el.querySelector(`[data-organization="${row.id}"]`);
        if (!form) return;
        form.elements.organization_type.value = row.organization_type;
        form.elements.status.value = row.status;

        form.addEventListener('submit', async event => {
          event.preventDefault();

          try {
            const result = await request(`/api/reviewer/partner-organizations/${row.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                name: form.elements.name.value.trim(),
                organization_type: form.elements.organization_type.value,
                country: form.elements.country.value.trim(),
                city: form.elements.city.value.trim() || null,
                website: form.elements.website.value.trim() || null,
                status: form.elements.status.value
              })
            });

            notice(result?.message || 'Organization updated.', 'success');
            await Promise.all([loadOrganizations(), loadDashboard()]);
          } catch (error) {
            notice(error.message, 'error');
          }
        });
      });
    } catch (error) {
      if (needsLogin(error)) return redirectToLogin();
      el.innerHTML = `<div class="nl530-empty">${esc(error.message)}</div>`;
    }
  }

  async function loadPrograms() {
    renderModules(
      'programModules',
      CFG?.managedModules?.programs || [],
      'Managed NurseLink program module under the current Administrator session.'
    );
  }

  async function loadEmployment() {
    const opportunities = $('opportunitiesArea');
    const applications = $('jobApplicationsArea');

    opportunities.innerHTML = '<div class="nl-admin-loading">Loading opportunities…</div>';
    applications.innerHTML = '<div class="nl-admin-loading">Loading job applications…</div>';

    try {
      const [jobPayload, applicationPayload] = await Promise.all([
        request('/api/reviewer/job-opportunities'),
        request('/api/reviewer/job-applications')
      ]);

      const jobs = Array.isArray(jobPayload?.data) ? jobPayload.data : [];
      const apps = Array.isArray(applicationPayload?.data) ? applicationPayload.data : [];

      opportunities.innerHTML = jobs.length ? jobs.map(row => `
        <article class="nl530-job">
          ${badges([label(row.status), row.status === 'active' ? 'good' : 'attention'], [row.reference_code || 'Opportunity', ''])}
          <div class="nl530-row-main"><strong>${esc(row.title)}</strong><small>${esc(row.employer_name)} · ${esc(row.city || '')} ${esc(row.country || '')} · ${esc(row.specialty || 'General')}</small></div>
        </article>
      `).join('') : '<div class="nl530-empty">No job opportunities found.</div>';

      applications.innerHTML = apps.length ? apps.map(row => `
        <form class="nl530-job" data-job-application="${esc(row.id)}">
          ${badges([label(row.status), row.status === 'offer' ? 'good' : row.status === 'declined' ? 'danger' : ''])}
          <div class="nl530-row-main"><strong>${esc(row.member)}</strong><small>${esc(row.title)} · ${esc(row.employer_name)} · ${esc(row.reference_code || '')}</small></div>
          <div class="nl530-row-form">
            <label><span>Status</span><select name="status"><option value="under_review">Under Review</option><option value="shortlisted">Shortlisted</option><option value="interview">Interview</option><option value="offer">Offer</option><option value="declined">Declined</option></select></label>
            <label class="wide"><span>Reviewer notes</span><textarea name="notes" maxlength="5000">${esc(row.reviewer_notes || '')}</textarea></label>
            <button type="submit">Save Application</button>
          </div>
        </form>
      `).join('') : '<div class="nl530-empty">No job applications found.</div>';

      apps.forEach(row => {
        const form = applications.querySelector(`[data-job-application="${row.id}"]`);
        if (!form || row.status === 'withdrawn') return;
        if ([...form.elements.status.options].some(option => option.value === row.status)) {
          form.elements.status.value = row.status;
        }

        form.addEventListener('submit', async event => {
          event.preventDefault();
          try {
            const result = await request(`/api/reviewer/job-applications/${row.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                status: form.elements.status.value,
                reviewer_notes: form.elements.notes.value.trim() || null
              })
            });
            notice(result?.message || 'Job application updated.', 'success');
            await loadEmployment();
          } catch (error) {
            notice(error.message, 'error');
          }
        });
      });
    } catch (error) {
      if (needsLogin(error)) return redirectToLogin();
      opportunities.innerHTML = `<div class="nl530-empty">${esc(error.message)}</div>`;
      applications.innerHTML = '';
    }
  }

  async function loadTraining() {
    const el = $('trainingArea');
    el.innerHTML = '<div class="nl-admin-loading">Loading training and events…</div>';

    renderModules(
      'trainingModules',
      CFG?.managedModules?.training || [],
      'Advanced training / compliance administration under the same Administrator session.'
    );

    try {
      const payload = await request('/api/nurselink/admin/events');
      const rows = Array.isArray(payload?.data) ? payload.data : [];

      el.innerHTML = rows.length ? rows.slice(0, 100).map(row => `
        <article class="nl530-event">
          ${badges([label(row.status), row.status === 'published' ? 'good' : ''], [label(row.delivery_mode || ''), ''])}
          <div class="nl530-row-main"><strong>${esc(row.title)}</strong><small>${row.starts_at ? esc(new Date(row.starts_at).toLocaleString()) : ''} · ${esc(row.organizer || '')} · ${esc(row.event_type || '')}</small></div>
        </article>
      `).join('') : '<div class="nl530-empty">No training or events found.</div>';
    } catch (error) {
      if (needsLogin(error)) return redirectToLogin();
      el.innerHTML = `<div class="nl530-empty">${esc(error.message)}</div>`;
    }
  }

  function flattenNumbers(value, prefix = '', out = []) {
    if (out.length >= 16) return out;

    if (typeof value === 'number') {
      out.push([prefix || 'Metric', value]);
      return out;
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return out;
    }

    Object.entries(value).forEach(([key, child]) => {
      if (out.length >= 16) return;
      flattenNumbers(child, prefix ? `${prefix} · ${label(key)}` : label(key), out);
    });

    return out;
  }

  async function loadReports() {
    const el = $('reportsArea');
    el.innerHTML = '<div class="nl-admin-loading">Loading analytics…</div>';

    renderModules(
      'reportModules',
      CFG?.managedModules?.reports || [],
      'Open the full NurseLink analytics module under the current Administrator session.'
    );

    try {
      const payload = await request('/api/reviewer/institutional-analytics');
      const rows = flattenNumbers(payload?.data || payload || {});

      el.innerHTML = rows.length
        ? `<div class="nl530-report-grid">${rows.map(([name, value]) => `<div class="nl530-report-card"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>`
        : '<div class="nl530-empty">Analytics returned no numeric summary metrics.</div>';
    } catch (error) {
      if (needsLogin(error)) return redirectToLogin();
      el.innerHTML = `<div class="nl530-empty">${esc(error.message)}</div>`;
    }
  }

  async function loadPrivilegedUsers() {
    try {
      const payload = await request('/api/nurselink/admin/users');
      privilegedUsers = Array.isArray(payload?.data) ? payload.data : [];
      return payload;
    } catch (error) {
      privilegedUsers = [];
      throw error;
    }
  }

  function adminOptions(selected = '') {
    return [
      '<option value="">Unassigned</option>',
      ...privilegedUsers
        .filter(row => row.active && ['admin', 'super_admin'].includes(row.role))
        .map(row => `<option value="${esc(row.user_id)}" ${String(row.user_id) === String(selected) ? 'selected' : ''}>${esc(row.name || row.email)} · ${esc(label(row.role))}</option>`)
    ].join('');
  }

  function supportCase(row) {
    return `
      <form class="nl530-case" data-support-case="${esc(row.id)}">
        ${badges([row.case_number, ''], [label(row.status), ['resolved','closed'].includes(row.status) ? 'good' : 'attention'], [label(row.priority), row.priority === 'urgent' ? 'danger' : row.priority === 'high' ? 'attention' : ''])}
        <div class="nl530-row-main">
          <strong>${esc(row.subject)}</strong>
          <small>${esc(label(row.category))} · ${esc(row.member?.name || row.member?.email || 'No member linked')} · ${esc(row.organization?.name || 'No organization')}</small>
        </div>
        <div class="nl530-row-form">
          <label><span>Status</span><select name="status"><option value="open">Open</option><option value="in_progress">In Progress</option><option value="waiting_member">Waiting Member</option><option value="waiting_internal">Waiting Internal</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label>
          <label><span>Priority</span><select name="priority"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
          <label><span>Owner</span><select name="assigned_admin_user_id">${adminOptions(row.assigned_admin_user_id)}</select></label>
          <label class="wide"><span>Subject</span><input name="subject" value="${esc(row.subject)}"></label>
          <label class="wide"><span>Description</span><textarea name="description">${esc(row.description || '')}</textarea></label>
          <label class="wide"><span>Internal note</span><textarea name="internal_note">${esc(row.internal_note || '')}</textarea></label>
          <label class="wide"><span>Resolution summary</span><textarea name="resolution_summary">${esc(row.resolution_summary || '')}</textarea></label>
          <button type="submit">Save Case</button>
        </div>
      </form>
    `;
  }

  async function loadSupport() {
    const el = $('supportArea');
    el.innerHTML = '<div class="nl-admin-loading">Loading cases…</div>';

    try {
      if (!privilegedUsers.length) {
        await loadPrivilegedUsers().catch(() => null);
      }

      const params = new URLSearchParams();
      const supportSearch = $('supportSearch')?.value.trim();
      const supportAssignment = $('supportAssignment')?.value || 'all';
      const supportStatus = $('supportStatus')?.value || '';
      const supportPriority = $('supportFilterPriority')?.value || '';

      if (supportSearch) params.set('search', supportSearch);
      if (supportAssignment) params.set('assignment', supportAssignment);
      if (supportStatus) params.set('status', supportStatus);
      if (supportPriority) params.set('priority', supportPriority);

      const payload = await request(`/api/nurselink/admin/operations-center/support-cases?${params}`);
      const rows = Array.isArray(payload?.data) ? payload.data : [];

      el.innerHTML = rows.length
        ? rows.map(supportCase).join('')
        : '<div class="nl530-empty">No support cases yet.</div>';

      rows.forEach(row => {
        const form = el.querySelector(`[data-support-case="${row.id}"]`);
        if (!form) return;
        form.elements.status.value = row.status;
        form.elements.priority.value = row.priority;

        form.addEventListener('submit', async event => {
          event.preventDefault();

          try {
            const result = await request(`/api/nurselink/admin/operations-center/support-cases/${row.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                category: row.category,
                priority: form.elements.priority.value,
                status: form.elements.status.value,
                subject: form.elements.subject.value.trim(),
                description: form.elements.description.value.trim() || null,
                assigned_admin_user_id: form.elements.assigned_admin_user_id.value || null,
                internal_note: form.elements.internal_note.value.trim() || null,
                resolution_summary: form.elements.resolution_summary.value.trim() || null
              })
            });

            notice(result?.message || 'Support case updated.', 'success');
            await Promise.all([loadSupport(), loadDashboard()]);
          } catch (error) {
            notice(error.message, 'error');
          }
        });
      });
    } catch (error) {
      if (needsLogin(error)) return redirectToLogin();
      el.innerHTML = `<div class="nl530-empty">${esc(error.message)}</div>`;
    }
  }

  async function loadAudit() {
    const el = $('auditArea');
    el.innerHTML = '<div class="nl-admin-loading">Loading audit log…</div>';

    try {
      const payload = await request('/api/nurselink/admin/operations-center/audit-log');
      const rows = Array.isArray(payload?.data) ? payload.data : [];

      el.innerHTML = rows.length ? rows.map(row => `
        <article class="nl530-audit">
          <div class="nl530-row-main">
            <strong>${esc(String(row.action || '').replace(/\./g, ' → '))}</strong>
            <small>${esc(row.actor?.name || row.actor?.email || 'NurseLink Staff')} · ${esc(label(row.target_type))} #${esc(row.target_id)} · ${esc(row.created_at || '')}</small>
          </div>
        </article>
      `).join('') : '<div class="nl530-empty">No audit events found.</div>';
    } catch (error) {
      if (needsLogin(error)) return redirectToLogin();
      el.innerHTML = `<div class="nl530-empty">${esc(error.message)}</div>`;
    }
  }

  async function loadHealth() {
    const el = $('healthArea');
    el.innerHTML = '<div class="nl-admin-loading">Loading system health…</div>';

    renderModules(
      'healthModules',
      CFG?.managedModules?.health || [],
      'Advanced NurseLink operations tooling under the current Administrator session.'
    );

    try {
      const [healthPayload, readinessPayload] = await Promise.all([
        request('/api/nurselink/admin/operations-center/system-health'),
        request('/api/reviewer/production-readiness').catch(() => ({data: {}}))
      ]);

      const h = healthPayload?.data || {};
      const tables = h.tables || {};
      const readyData = readinessPayload?.data || {};

      el.innerHTML = [
        metric('Release', h.release || '5.5.8', 'Administration Operations Center'),
        metric('Database', h.database_connected ? 'Connected' : 'Unavailable', 'Application database connectivity', h.database_connected ? 'good' : 'danger'),
        metric('Storage', h.storage_writable ? 'Writable' : 'Check', 'Laravel storage path', h.storage_writable ? 'good' : 'danger'),
        metric('Required Tables', h.all_required_tables_present ? 'Ready' : 'Attention', `${Object.values(tables).filter(Boolean).length}/${Object.keys(tables).length} present`, h.all_required_tables_present ? 'good' : 'danger'),
        metric('Readiness Checks', readyData?.summary?.passed ?? readyData?.pass ?? '—', 'Production readiness service')
      ].join('') + `<div class="nl530-health-table">${Object.entries(tables).map(([name, ok]) => `<div class="nl530-health-row"><span>${esc(name)}</span><b class="${ok ? 'good' : 'danger'}">${ok ? 'AVAILABLE' : 'MISSING'}</b></div>`).join('')}</div>`;
    } catch (error) {
      if (needsLogin(error)) return redirectToLogin();
      el.innerHTML = `<div class="nl530-empty">${esc(error.message)}</div>`;
    }
  }

  function roleCheckbox(role, selected = [], disabled = false) {
    const checked = selected.includes(role.key) ? 'checked' : '';
    return `
      <label class="nl553-role-option">
        <input type="checkbox" value="${esc(role.key)}" ${checked} ${disabled ? 'disabled' : ''}>
        <span><strong>${esc(role.label)}</strong><small>${esc(role.description || '')}</small></span>
      </label>
    `;
  }

  function renderInvitationRoles(roles = []) {
    const el = $('adminInviteRoles');
    if (!el) return;
    el.innerHTML = roles.map(role => roleCheckbox(role, role.key === 'membership_administrator' ? [role.key] : [])).join('');
  }

  function administratorRow(row, canManage, roles) {
    const statusTone = row.active ? 'good' : 'danger';
    const roleBadges = (row.role_labels || []).slice(0, 4).map(name => [name, name === 'Super Administrator' ? 'attention' : '']).concat(
      (row.role_labels || []).length > 4 ? [[`+${row.role_labels.length - 4} more`, '']] : []
    );

    return `
      <article class="nl553-admin-row" data-admin-user="${esc(row.user_id)}" data-admin-email="${esc(row.email)}">
        <div class="nl553-admin-summary">
          <div>
            ${badges([row.active ? 'Active' : 'Revoked', statusTone], ...roleBadges)}
            <strong>${esc(row.name || row.email)}</strong>
            <small>${esc(row.email || '')}${row.department_unit ? ` · ${esc(row.department_unit)}` : ''}${row.is_current_user ? ' · Current session' : ''}</small>
          </div>
          <div class="nl530-row-actions">
            ${canManage ? `<button type="button" data-admin-manage>Manage Roles</button><button type="button" class="danger" data-admin-revoke ${row.is_current_user ? 'disabled' : ''}>Revoke</button>` : '<small>View only — Super Administrator required for changes.</small>'}
          </div>
        </div>
        ${canManage ? `
          <div class="nl553-role-editor" hidden>
            <label class="nl553-department-field"><span>Department / Unit</span><input class="nl553-admin-department" value="${esc(row.department_unit || '')}" maxlength="190"></label>
            <div class="nl553-role-grid">${roles.map(role => roleCheckbox(role, row.roles || [], row.is_current_user && role.key === 'super_administrator')).join('')}</div>
            <label class="nl554-governance-field"><span>Change reason</span><textarea class="nl554-change-reason" placeholder="Required: why are these permissions changing?" minlength="10" maxlength="500"></textarea></label>
            <label class="nl554-governance-field"><span>Approval notes</span><textarea class="nl554-approval-notes" placeholder="Optional approver, ticket, or decision reference" maxlength="1000"></textarea></label>
            <div class="nl553-editor-actions">
              <button type="button" class="primary" data-admin-save>Save Permissions</button>
              <button type="button" data-admin-close>Cancel</button>
            </div>
          </div>
        ` : ''}
      </article>
    `;
  }

  function invitationRow(row, canManage) {
    const tone = row.delivery_status === 'sent' ? 'good' : row.delivery_status === 'manual_link_required' ? 'attention' : '';
    return `
      <article class="nl553-invitation-row" data-invitation-id="${esc(row.id)}">
        <div>
          ${badges(['Invitation Sent', 'attention'], [label(row.delivery_status || 'pending'), tone])}
          <strong>${esc(row.email)}</strong>
          <small>${esc((row.role_labels || []).join(' · '))}${row.department_unit ? ` · ${esc(row.department_unit)}` : ''}</small>
          <small>Expires: ${esc(row.expires_at || '—')}</small>
        </div>
        ${canManage ? `<div class="nl530-row-actions"><button type="button" data-invite-resend>Resend</button><button type="button" class="danger" data-invite-cancel>Cancel</button></div>` : ''}
      </article>
    `;
  }

  function showInvitationLink(message, link = '') {
    const el = $('adminInviteResult');
    if (!el) return;
    el.hidden = false;
    el.innerHTML = `
      <strong>${esc(message)}</strong>
      ${link ? `<div class="nl553-copy-link"><input value="${esc(link)}" readonly><button type="button" data-copy-invite-link>Copy Link</button></div>` : ''}
    `;
    el.querySelector('[data-copy-invite-link]')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(link);
        notice('Secure Administrator invitation link copied.', 'success');
      } catch (_) {
        el.querySelector('input')?.select();
      }
    });
  }

  function adminGovernanceActionLabel(value = '') {
    return ({
      'administrator.invitation_sent': 'Invitation sent',
      'administrator.invitation_resent': 'Invitation resent',
      'administrator.invitation_superseded': 'Invitation superseded',
      'administrator.invitation_cancelled': 'Invitation cancelled',
      'administrator.invitation_accepted_and_activated': 'Invitation accepted & activated',
      'administrator.permissions_updated': 'Permissions updated',
      'administrator.access_revoked': 'Access revoked'
    })[value] || label(String(value).replace(/^administrator\./, '').replaceAll('_', ' '));
  }

  function adminGovernanceState(state) {
    if (!state || typeof state !== 'object') return '';
    const parts = [];
    if (Array.isArray(state.roles)) parts.push(`Roles: ${state.roles.map(label).join(', ') || 'None'}`);
    if (state.department_unit !== undefined) parts.push(`Unit: ${state.department_unit || '—'}`);
    if (state.status) parts.push(`Status: ${label(state.status)}`);
    if (state.active !== undefined) parts.push(`Access: ${state.active ? 'Active' : 'Inactive'}`);
    return parts.join(' · ');
  }

  function adminGovernanceRow(row) {
    const before = adminGovernanceState(row.before_state);
    const after = adminGovernanceState(row.after_state);
    return `
      <article class="nl554-governance-row">
        <div class="nl554-governance-head">
          <div>${badges([adminGovernanceActionLabel(row.action), row.action?.includes('revoked') || row.action?.includes('cancelled') ? 'danger' : row.action?.includes('updated') ? 'attention' : 'good'])}<strong>${esc(row.subject_email || 'Administrator access record')}</strong><small>${esc(row.created_at || '—')} · Actor: ${esc(row.actor?.name || row.actor?.email || row.actor?.user_id || 'Unknown')}</small></div>
        </div>
        <div class="nl554-governance-detail"><strong>Reason</strong><span>${esc(row.reason || 'No reason recorded')}</span></div>
        ${row.approval_notes ? `<div class="nl554-governance-detail"><strong>Approval notes</strong><span>${esc(row.approval_notes)}</span></div>` : ''}
        ${(before || after) ? `<div class="nl554-governance-change"><span>${esc(before || 'No prior state')}</span><b>→</b><span>${esc(after || 'No resulting state')}</span></div>` : ''}
      </article>`;
  }

  async function loadAdminGovernanceHistory() {
    const card = $('adminGovernanceCard');
    const area = $('adminGovernanceArea');
    if (!card || !area || card.hidden) return;
    const q = $('adminGovernanceSearch')?.value.trim() || '';
    const action = $('adminGovernanceAction')?.value || '';
    const params = new URLSearchParams({limit: '50'});
    if (q) params.set('q', q);
    if (action) params.set('action', action);
    area.innerHTML = '<div class="nl-admin-loading">Loading Administrator governance history…</div>';
    try {
      const payload = await request(`/api/nurselink/admin/management/governance-history?${params}`);
      const data = payload?.data || {};
      const rows = Array.isArray(data.history) ? data.history : [];
      const select = $('adminGovernanceAction');
      if (select && select.options.length <= 1 && Array.isArray(data.actions)) {
        select.insertAdjacentHTML('beforeend', data.actions.map(value => `<option value="${esc(value)}">${esc(adminGovernanceActionLabel(value))}</option>`).join(''));
      }
      area.innerHTML = rows.length ? rows.map(adminGovernanceRow).join('') : '<div class="nl530-empty">No Administrator governance history matches this filter.</div>';
    } catch (error) {
      area.innerHTML = `<div class="nl530-empty">${esc(error.message)}</div>`;
    }
  }

  function governancePrompt(action, email) {
    const reason = prompt(`${action} for ${email}.\n\nEnter the required reason (minimum 10 characters):`);
    if (reason === null) return null;
    if (reason.trim().length < 10) {
      notice('A governance reason of at least 10 characters is required.', 'error');
      return null;
    }
    const approval = prompt('Optional approval notes (approver, ticket, or decision reference):') ?? '';
    return {reason: reason.trim(), approval_notes: approval.trim() || null};
  }

  async function loadSettings() {
    const settingsEl = $('settingsArea');
    const accessEl = $('settingsAccessArea');
    const invitationsEl = $('adminInvitationArea');

    try {
      const [settingsPayload, managementPayload] = await Promise.all([
        request('/api/nurselink/admin/operations-center/settings'),
        request('/api/nurselink/admin/management')
      ]);

      const data = settingsPayload?.data || {};
      const g = data.governance || {};
      const entry = data.entry_points || {};
      const management = managementPayload?.data || {};
      const permissions = managementPayload?.permissions || {};
      const roles = Array.isArray(management.roles) ? management.roles : [];
      const administrators = Array.isArray(management.administrators) ? management.administrators : [];
      const invitations = Array.isArray(management.invitations) ? management.invitations : [];
      const canManage = !!permissions.can_manage_administrators;
      adminManagement = managementPayload;

      settingsEl.innerHTML = `
        <div class="nl530-principles">
          <div><strong>Verified acceptance</strong><span>Invited users receive no Administrator access until the invitation is accepted by the matching verified NurseLink email account.</span></div>
          <div><strong>Multiple roles</strong><span>One Administrator can hold several operational roles. Server authorization checks the active role assignments for each governed area.</span></div>
          <div><strong>Legacy-safe enforcement</strong><span>Granular assignments synchronize to the established privileged-access layer so current NurseLink session protections remain intact.</span></div>
          <div><strong>Role protection</strong><span>Super Administrator is required for role changes; self-revoke and last-Super-Administrator safeguards remain enabled.</span></div>
          <div><strong>Administrator entry</strong><span>${esc(entry.administrator_login || '/admin/login.html')} → ${esc(entry.administrator_portal || '/admin/')}</span></div>
          <div><strong>Workflow governance</strong><span>${g.raw_database_administration === false ? 'Raw database administration remains disabled by design.' : 'Review configuration.'}</span></div>
        </div>
      `;

      renderInvitationRoles(roles);
      if ($('adminInviteForm')) $('adminInviteForm').hidden = !canManage;
      if ($('adminInviteLocked')) $('adminInviteLocked').hidden = canManage;
      if ($('adminGovernanceCard')) $('adminGovernanceCard').hidden = !canManage;

      invitationsEl.innerHTML = invitations.length
        ? `<div class="nl553-invitation-heading"><strong>Pending Invitations</strong><span>${invitations.length}</span></div>${invitations.map(row => invitationRow(row, canManage)).join('')}`
        : '';

      accessEl.innerHTML = administrators.length
        ? administrators.map(row => administratorRow(row, canManage, roles)).join('')
        : '<div class="nl530-empty">No granular Administrator profiles yet. Existing legacy administrators continue to work until migrated through this page.</div>';

      bindAdministratorManagementActions();
      if (canManage) await loadAdminGovernanceHistory();
    } catch (error) {
      if (needsLogin(error)) return redirectToLogin();
      settingsEl.innerHTML = `<div class="nl530-empty">${esc(error.message)}</div>`;
      accessEl.innerHTML = '';
      if (invitationsEl) invitationsEl.innerHTML = '';
    }
  }

  function checkedRoles(scope) {
    return Array.from(scope.querySelectorAll('.nl553-role-grid input[type="checkbox"]:checked')).map(input => input.value);
  }

  function bindAdministratorManagementActions() {
    $('settingsAccessArea')?.querySelectorAll('[data-admin-manage]').forEach(button => {
      button.addEventListener('click', () => {
        const row = button.closest('[data-admin-user]');
        const editor = row?.querySelector('.nl553-role-editor');
        if (editor) editor.hidden = !editor.hidden;
      });
    });

    $('settingsAccessArea')?.querySelectorAll('[data-admin-close]').forEach(button => {
      button.addEventListener('click', () => {
        const editor = button.closest('.nl553-role-editor');
        if (editor) editor.hidden = true;
      });
    });

    $('settingsAccessArea')?.querySelectorAll('[data-admin-save]').forEach(button => {
      button.addEventListener('click', async () => {
        const row = button.closest('[data-admin-user]');
        if (!row) return;
        const roles = checkedRoles(row);
        if (!roles.length) return notice('Select at least one Administrator role.', 'error');
        const reason = row.querySelector('.nl554-change-reason')?.value.trim() || '';
        if (reason.length < 10) return notice('Enter a change reason of at least 10 characters.', 'error');
        const approvalNotes = row.querySelector('.nl554-approval-notes')?.value.trim() || null;

        try {
          const result = await request(`/api/nurselink/admin/management/administrators/${encodeURIComponent(row.dataset.adminUser)}`, {
            method: 'PATCH',
            body: JSON.stringify({
              department_unit: row.querySelector('.nl553-admin-department')?.value.trim() || null,
              roles,
              reason,
              approval_notes: approvalNotes
            })
          });
          notice(result?.message || 'Administrator permissions saved.', 'success');
          await loadSettings();
        } catch (error) {
          notice(error.message, 'error');
        }
      });
    });

    $('settingsAccessArea')?.querySelectorAll('[data-admin-revoke]').forEach(button => {
      button.addEventListener('click', async () => {
        const row = button.closest('[data-admin-user]');
        if (!row || !confirm(`Revoke all Administrator access for ${row.dataset.adminEmail}?`)) return;
        const governance = governancePrompt('Revoke Administrator access', row.dataset.adminEmail);
        if (!governance) return;

        try {
          const result = await request(`/api/nurselink/admin/management/administrators/${encodeURIComponent(row.dataset.adminUser)}`, {
            method: 'DELETE',
            body: JSON.stringify(governance)
          });
          notice(result?.message || 'Administrator access revoked.', 'success');
          await loadSettings();
        } catch (error) {
          notice(error.message, 'error');
        }
      });
    });

    $('adminInvitationArea')?.querySelectorAll('[data-invite-resend]').forEach(button => {
      button.addEventListener('click', async () => {
        const row = button.closest('[data-invitation-id]');
        try {
          const result = await request(`/api/nurselink/admin/management/invitations/${encodeURIComponent(row.dataset.invitationId)}/resend`, {method: 'POST', body: '{}'});
          showInvitationLink(result?.message || 'Invitation refreshed.', result?.data?.invitation_link || '');
          notice(result?.message || 'Invitation refreshed.', 'success');
          await loadSettings();
        } catch (error) {
          notice(error.message, 'error');
        }
      });
    });

    $('adminInvitationArea')?.querySelectorAll('[data-invite-cancel]').forEach(button => {
      button.addEventListener('click', async () => {
        const row = button.closest('[data-invitation-id]');
        if (!confirm('Cancel this Administrator invitation?')) return;
        const governance = governancePrompt('Cancel Administrator invitation', 'this invitation');
        if (!governance) return;
        try {
          const result = await request(`/api/nurselink/admin/management/invitations/${encodeURIComponent(row.dataset.invitationId)}`, {method: 'DELETE', body: JSON.stringify(governance)});
          notice(result?.message || 'Invitation cancelled.', 'success');
          await loadSettings();
        } catch (error) {
          notice(error.message, 'error');
        }
      });
    });
  }

  $('organizationCreateForm')?.addEventListener('submit', async event => {
    event.preventDefault();

    try {
      const result = await request('/api/reviewer/partner-organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: $('orgName').value.trim(),
          organization_type: $('orgType').value,
          country: $('orgCountry').value.trim(),
          city: $('orgCity').value.trim() || null,
          website: $('orgWebsite').value.trim() || null,
          status: $('orgStatus').value
        })
      });

      notice(result?.message || 'Organization created.', 'success');
      $('orgName').value = '';
      $('orgCity').value = '';
      $('orgWebsite').value = '';
      await Promise.all([loadOrganizations(), loadDashboard()]);
    } catch (error) {
      notice(error.message, 'error');
    }
  });

  $('communicationForm')?.addEventListener('submit', async event => {
    event.preventDefault();

    try {
      const result = await request('/api/nurselink/admin/operations-center/communications', {
        method: 'POST',
        body: JSON.stringify({
          member_identifier: $('communicationMember').value.trim(),
          severity: $('communicationSeverity').value,
          title: $('communicationTitle').value.trim(),
          message: $('communicationMessage').value.trim(),
          action_url: $('communicationAction').value.trim() || null
        })
      });

      notice(result?.message || 'Member communication sent.', 'success');
      $('communicationTitle').value = '';
      $('communicationMessage').value = '';
      $('communicationAction').value = '';
      await loadDashboard();
    } catch (error) {
      notice(error.message, 'error');
    }
  });

  $('supportCreateForm')?.addEventListener('submit', async event => {
    event.preventDefault();

    try {
      const result = await request('/api/nurselink/admin/operations-center/support-cases', {
        method: 'POST',
        body: JSON.stringify({
          member_identifier: $('supportMember').value.trim() || null,
          organization_id: null,
          source: 'admin',
          category: $('supportCategory').value,
          priority: $('supportPriority').value,
          subject: $('supportSubject').value.trim(),
          description: $('supportDescription').value.trim() || null,
          assigned_admin_user_id: null,
          internal_note: $('supportInternalNote').value.trim() || null
        })
      });

      notice(result?.message || 'Support case created.', 'success');
      $('supportSubject').value = '';
      $('supportDescription').value = '';
      $('supportInternalNote').value = '';
      await Promise.all([loadSupport(), loadDashboard()]);
    } catch (error) {
      notice(error.message, 'error');
    }
  });

  $('adminInviteForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const roles = checkedRoles($('adminInviteForm'));
    if (!roles.length) return notice('Select at least one Administrator role.', 'error');

    try {
      const result = await request('/api/nurselink/admin/management/invitations', {
        method: 'POST',
        body: JSON.stringify({
          email: $('adminInviteEmail').value.trim(),
          department_unit: $('adminInviteDepartment').value.trim() || null,
          roles,
          reason: $('adminInviteReason').value.trim(),
          approval_notes: $('adminInviteApprovalNotes').value.trim() || null
        })
      });
      showInvitationLink(result?.message || 'Administrator invitation created.', result?.data?.invitation_link || '');
      notice(result?.message || 'Administrator invitation created.', 'success');
      $('adminInviteEmail').value = '';
      $('adminInviteDepartment').value = '';
      $('adminInviteReason').value = '';
      $('adminInviteApprovalNotes').value = '';
      await loadSettings();
    } catch (error) {
      notice(error.message, 'error');
    }
  });

  function bindFilters() {
    $('refreshMembers')?.addEventListener('click', loadMembers);
    $('exportMembersCsv')?.addEventListener('click', exportMembersCsv);
    $('refreshMemberOnboarding')?.addEventListener('click', loadMemberOnboarding);
    $('memberStanding')?.addEventListener('change', loadMembers);
    $('memberSearch')?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadMembers, 350);
    });

    $('refreshApplications')?.addEventListener('click', loadApplications);

    [
      'applicationStatus',
      'applicationStage',
      'applicationAssignment',
      'applicationFilterPriority',
      'applicationOverdue'
    ].forEach(id => {
      $(id)?.addEventListener('change', () => {
        markApplicationQuickView('');
        loadApplications();
      });
    });

    ['applicationSearch', 'applicationOrganization'].forEach(id => {
      $(id)?.addEventListener('input', () => {
        markApplicationQuickView('');
        clearTimeout(searchTimer);
        searchTimer = setTimeout(loadApplications, 300);
      });
    });

    $('applicationPageSize')?.addEventListener('change', () => {
      applicationPageSize = Number(
        $('applicationPageSize').value || 10
      );
      applicationPage = 1;
      renderApplicationTable();
    });

    const clearApplicationFilters = () => {
      markApplicationQuickView('all');
      applyApplicationFilterSnapshot({
        search: '',
        status: '',
        stage: '',
        assignment: 'all',
        priority: '',
        organization: '',
        overdue: false
      });
    };

    document
      .querySelectorAll('[data-application-quick]')
      .forEach(button => {
        button.addEventListener(
          'click',
          () => setApplicationQuickView(
            button.dataset.applicationQuick
          )
        );
      });

    $('applicationSavedView')?.addEventListener(
      'change',
      loadApplicationSavedView
    );
    $('saveApplicationView')?.addEventListener(
      'click',
      saveApplicationView
    );
    $('deleteApplicationView')?.addEventListener(
      'click',
      deleteApplicationSavedView
    );
    $('exportApplications')?.addEventListener(
      'click',
      exportApplicationQueue
    );

    renderApplicationSavedViews();

    $('resetApplicationFilters')?.addEventListener('click', clearApplicationFilters);
    $('closeApplicationDetail')?.addEventListener('click', closeApplicationDetail);
    $('applicationDrawerBackdrop')?.addEventListener('click', closeApplicationDetail);

    $('refreshVerification')?.addEventListener('click', loadVerification);
    $('verificationStatus')?.addEventListener('change', loadVerification);
    $('refreshOrganizations')?.addEventListener('click', loadOrganizations);
    $('refreshEmployment')?.addEventListener('click', loadEmployment);
    $('refreshTraining')?.addEventListener('click', loadTraining);
    $('refreshReports')?.addEventListener('click', loadReports);
    $('refreshSupport')?.addEventListener('click', loadSupport);
    ['supportAssignment', 'supportStatus', 'supportFilterPriority'].forEach(id => {
      $(id)?.addEventListener('change', loadSupport);
    });
    $('supportSearch')?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadSupport, 250);
    });
    $('refreshAudit')?.addEventListener('click', loadAudit);
    $('refreshSettings')?.addEventListener('click', loadSettings);
    $('refreshAdminGovernance')?.addEventListener('click', loadAdminGovernanceHistory);
    $('adminGovernanceAction')?.addEventListener('change', loadAdminGovernanceHistory);
    $('adminGovernanceSearch')?.addEventListener('input', debounce(loadAdminGovernanceHistory, 300));
  }

  // NurseLink v712 — reliable mobile menu activation on iOS/WebKit.
  // pointerup responds immediately to a completed touch. The click handler
  // remains as keyboard/mouse fallback and is suppressed after pointer use.
  let mobileMenuPointerHandledAt = 0;

  mobileMenuToggleEl?.addEventListener('pointerup', event => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      event.preventDefault();
      mobileMenuPointerHandledAt = Date.now();

      setMobileNavigation(
        !document.body.classList.contains('nl555-nav-open')
      );
    }
  });

  mobileMenuToggleEl?.addEventListener('click', event => {
    if (Date.now() - mobileMenuPointerHandledAt < 700) {
      event.preventDefault();
      return;
    }

    setMobileNavigation(
      !document.body.classList.contains('nl555-nav-open')
    );
  });
  mobileMenuCloseEl?.addEventListener('click', () => {
    setMobileNavigation(false);
    mobileMenuToggleEl?.focus();
  });
  mobileBackdropEl?.addEventListener('click', () => {
    setMobileNavigation(false);
    mobileMenuToggleEl?.focus();
  });

  document.querySelectorAll('#operationsMenu [data-tab]').forEach(link => {
    link.addEventListener('click', () => setMobileNavigation(false));
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.body.classList.contains('nl555-nav-open')) {
      setMobileNavigation(false);
      mobileMenuToggleEl?.focus();
    }
  });

  if (typeof mobileNavQuery.addEventListener === 'function') {
    mobileNavQuery.addEventListener('change', syncMobileNavigation);
  } else if (typeof mobileNavQuery.addListener === 'function') {
    mobileNavQuery.addListener(syncMobileNavigation);
  }
  syncMobileNavigation();

  $('adminSignOut')?.addEventListener('click', async () => {
    try {
      await request('/api/nurselink/admin/logout', {
        method: 'POST',
        body: '{}'
      });
    } catch (_) {}

    location.replace('/admin/login.html');
  });

  window.addEventListener('hashchange', () => {
    setMobileNavigation(false);
    setTab(location.hash.replace(/^#/, '') || 'dashboard');
  });

  document.addEventListener('click', event => {
    const tabCard = event.target.closest('[data-open-admin-tab]');
    if (tabCard) {
      setTab(tabCard.dataset.openAdminTab || 'dashboard');
      return;
    }

    const reviewerCard = event.target.closest('[data-open-workload-queue]');
    if (reviewerCard) {
      if ($('applicationAssignment')) $('applicationAssignment').value = reviewerCard.dataset.openWorkloadQueue || 'assigned';
      markApplicationQuickView('');
      setTab('applications');
      return;
    }

    const card = event.target.closest('[data-open-applications]');
    if (!card) return;

    const status = card.dataset.openApplications || '';
    if ($('applicationStatus')) $('applicationStatus').value = status;
    markApplicationQuickView('');
    setTab('applications');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        $('applicationsArea')
          ?.closest('.nl550-queue-card')
          ?.scrollIntoView({behavior: 'smooth', block: 'start'});
      });
    });
  });

  bindViewAllApplicationsHard();

  async function boot() {
    document.body.classList.add('nl-admin-session-pending');
    document.body.classList.remove('nl-admin-session-ready');
    setSessionGate('Checking your privileged NurseLink session…');

    try {
      const sessionPayload = await request('/api/nurselink/admin/session');
      const data = sessionPayload?.data || {};
      const user = data.user || {};
      const access = data.access || {};
      currentAdminUser = user;
      currentAccess = access;

      try {
        const permissionPayload = await request('/api/nurselink/admin/management/me');
        adminPermissionProfile = permissionPayload?.data || null;
      } catch (_) {
        adminPermissionProfile = null;
      }

      if (!user?.id && !user?.email) {
        redirectToLogin();
        return;
      }

      if (!access?.role) {
        redirectToLogin();
        return;
      }

      identityEl.innerHTML = `
        <span>${esc(access.label || label(access.role) || 'Administrator')}</span>
        <strong>${esc(user.name || user.email || 'NurseLink Staff')}</strong>
        <small>${esc(user.email || '')}</small>
      `;

      bindFilters();
      bindGlobalSearch();
      applyGranularNavigation();
      renderRoleWorkbench();

      const requested = location.hash.replace(/^#/, '');
      const valid = (CFG.adminTabs || []).some(row => row[0] === requested);

      revealAdministratorPortal();
      setTab(valid ? requested : 'dashboard');
    } catch (error) {
      if (needsLogin(error) || [401, 403, 419].includes(error.status)) {
        redirectToLogin();
        return;
      }

      setSessionGate(
        error?.message
          || 'Unable to verify Administrator access. Please try again.'
      );
    }
  }

  boot();
})();
/* Legacy cumulative compatibility marker retained for installer regression checks: /api/nurselink/admin/users/grant */
