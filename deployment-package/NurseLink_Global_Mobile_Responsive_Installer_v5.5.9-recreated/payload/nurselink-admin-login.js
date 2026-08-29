(() => {
  'use strict';

  const API = 'https://api.amsertech.com';
  const CFG = window.NurseLinkPortalConfig || {};
  const form = document.getElementById('adminLoginForm');
  const email = document.getElementById('adminEmail');
  const password = document.getElementById('adminPassword');
  const status = document.getElementById('adminLoginStatus');
  const button = document.getElementById('adminLoginButton');

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
      throw new Error('Unable to initialize Administrator sign-in.');
    }
  }

  async function login(payload) {
    await csrf();

    const token = decodeURIComponent(cookie('XSRF-TOKEN'));

    const response = await fetch(
      `${API}/api/nurselink/admin/session-login`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...(token ? {'X-XSRF-TOKEN': token} : {})
        },
        body: JSON.stringify(payload)
      }
    );

    let data = null;
    try { data = await response.json(); } catch (_) {}

    if (!response.ok) {
      const message =
        data?.errors?.email?.[0]
        || data?.message
        || `Administrator sign-in failed (${response.status}).`;
      throw new Error(message);
    }

    return data;
  }

  function requestedTab() {
    const allowed = new Set(
      (CFG.adminTabs || []).map(row => row[0])
    );

    let tab = '';

    try {
      tab = sessionStorage.getItem(
        'nurselink_admin_portal_tab'
      ) || '';
    } catch (_) {}

    if (!allowed.has(tab)) {
      const legacy = new URLSearchParams(
        location.search
      ).get('return') || '';

      const map = {
        '/admin': 'dashboard',
        '/nurselink-membership-command-center.html': 'applications',
        '/nurselink-membership-administration.html': 'applications',
        '/nurselink-membership-onboarding-admin.html': 'members',
        '/nurselink-member-registry.html': 'members',
        '/nurselink-credential-compliance.html': 'verification',
        '/nurselink-event-management.html': 'training',
        '/nurselink-institutional-analytics.html': 'reports',
        '/nurselink-operations-center.html': 'health',
        '/nurselink-production-readiness.html': 'health',
        '/nurselink-super-admin-test-center.html': 'health',
        '/nurselink-chapter-management.html': 'programs',
        '/nurselink-benefit-management.html': 'programs',
        '/nurselink-engagement-command-center.html': 'programs',
        '/nurselink-enterprise-command-center.html': 'programs'
      };

      Object.entries(
        CFG.managedModules || {}
      ).forEach(([group, rows]) => {
        (rows || []).forEach(([path]) => {
          map[path] = group;
        });
      });

      try {
        const parsed = new URL(
          legacy,
          location.origin
        );

        if (parsed.origin === window.location.origin) {
          tab = map[parsed.pathname] || '';
        }
      } catch (_) {}
    }

    return allowed.has(tab) ? tab : 'dashboard';
  }

  form?.addEventListener('submit', async event => {
    event.preventDefault();

    status.textContent = '';
    status.dataset.tone = '';
    button.disabled = true;
    button.textContent = 'Signing in…';

    try {
      const result = await login({
        email: email.value.trim(),
        password: password.value
      });

      status.textContent =
        `${result?.data?.label || 'Administrator'} access confirmed.`;
      status.dataset.tone = 'success';

      const tab = requestedTab();

      try {
        sessionStorage.removeItem(
          'nurselink_admin_portal_tab'
        );
        sessionStorage.removeItem(
          'nurselink_admin_return'
        );
      } catch (_) {}

      window.location.assign(
        `${CFG?.entryPoints?.adminPortal || '/nurselink-admin-dashboard.html'}#${tab}`
      );
    } catch (error) {
      status.textContent = error.message;
      status.dataset.tone = 'error';
    } finally {
      button.disabled = false;
      button.textContent = 'Sign in to Administrator Portal';
    }
  });
})();