import './nurselink-mobile.css';

/**
 * NurseLink Global Mobile + Auth UI Layer v5.5.2
 *
 * HOTFIX:
 * v1.2.0 could detach the registration form before its replacement
 * layout was inserted. v5.5.2 inserts the new shell first, then moves
 * the original form/container, preserving registration behavior.
 */
(() => {
  'use strict';

  const BREAKPOINT = 780;
  const ROOT_SELECTOR = '.app-shell';


  /* =========================================================
     NurseLink v5.5.2 — normal-browser stale session recovery
     ========================================================= */

  const NURSELINK_API_ORIGIN = 'https://api.amsertech.com';
  const NURSELINK_NATIVE_FETCH = window.fetch.bind(window);
  let nurselinkLoginResetPromise = null;
  let nurselinkSessionLoginCompleted = false;

  function nurseLinkIsPublicAuthRoute() {
    const path = location.pathname.replace(/\/+$/, '') || '/';

    return [
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/verify-email'
    ].some(route => path === route || path.startsWith(`${route}/`));
  }

  function nurseLinkAuthCookieValue(name) {
    const prefix = `${name}=`;
    const part = document.cookie
      .split(';')
      .map(value => value.trim())
      .find(value => value.startsWith(prefix));

    return part ? part.slice(prefix.length) : '';
  }

  async function nurseLinkResetClientAuth() {
    if (nurselinkLoginResetPromise) {
      return nurselinkLoginResetPromise;
    }

    nurselinkLoginResetPromise = (async () => {
      const reset = await NURSELINK_NATIVE_FETCH(
        `${NURSELINK_API_ORIGIN}/api/nurselink/session-bootstrap`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          redirect: 'error'
        }
      );

      if (!reset.ok) {
        throw new Error(`NurseLink session bootstrap failed (${reset.status}).`);
      }

      const csrf = await NURSELINK_NATIVE_FETCH(
        `${NURSELINK_API_ORIGIN}/sanctum/csrf-cookie`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          redirect: 'error'
        }
      );

      if (!csrf.ok && csrf.status !== 204) {
        throw new Error(`NurseLink CSRF refresh failed (${csrf.status}).`);
      }
    })();

    try {
      await nurselinkLoginResetPromise;
    } finally {
      nurselinkLoginResetPromise = null;
    }
  }

  window.fetch = async function nurseLinkFetch(input, init = {}) {
    const requestUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input?.url || '';

    const method = String(
      init.method ||
      (typeof Request !== 'undefined' && input instanceof Request
        ? input.method
        : 'GET')
    ).toUpperCase();

    const normalizedUrl = requestUrl.replace(/\/+$/, '');

    if (
      method === 'POST' &&
      normalizedUrl === `${NURSELINK_API_ORIGIN}/login`
    ) {
      await nurseLinkResetClientAuth();

      const headers = new Headers(
        typeof Request !== 'undefined' && input instanceof Request
          ? input.headers
          : undefined
      );

      new Headers(init.headers || {}).forEach((value, key) => {
        headers.set(key, value);
      });

      headers.set('Accept', 'application/json');
      headers.set('X-Requested-With', 'XMLHttpRequest');

      const token = nurseLinkAuthCookieValue('XSRF-TOKEN');

      if (token) {
        try {
          headers.set('X-XSRF-TOKEN', decodeURIComponent(token));
        } catch (_) {
          headers.set('X-XSRF-TOKEN', token);
        }
      }

      const loginResponse = await NURSELINK_NATIVE_FETCH(
        `${NURSELINK_API_ORIGIN}/api/nurselink/session-login`,
        {
          ...init,
          method: 'POST',
          headers,
          credentials: 'include',
          redirect: 'error'
        }
      );

      if (loginResponse.ok) {
        nurselinkSessionLoginCompleted = true;

        nurselinkIdentityState.loaded = false;
        nurselinkIdentityState.loading = null;
        nurselinkIdentityState.data = null;

        /*
         * v5.5.2: support a tightly-scoped post-login return to the Partner
         * Portal. Only the local NurseLink Partner Portal path is accepted;
         * external/open redirects are intentionally rejected.
         */
        const returnPath = new URLSearchParams(location.search).get('return') || '';

        if (
          location.pathname.replace(/\/+$/, '') === '/login' &&
          (
            returnPath === '/nurselink-partner-portal.html' ||
            returnPath.startsWith('/nurselink-partner-portal.html?') ||
            returnPath === '/nurselink-institutional-analytics.html' ||
            returnPath === '/nurselink-production-readiness.html'
          )
        ) {
          setTimeout(() => {
            location.replace(returnPath);
          }, 0);
        }
      }

      return loginResponse;
    }

    if (
      method === 'GET' &&
      normalizedUrl === `${NURSELINK_API_ORIGIN}/api/nurselink/session-identity` &&
      nurseLinkIsPublicAuthRoute() &&
      !nurselinkSessionLoginCompleted
    ) {
      /*
       * v5.5.2: privileged identity is irrelevant on public auth screens.
       * Avoid an authenticated API request before dedicated session-login.
       */
      return new Response(
        JSON.stringify({
          data: {
            role: 'guest',
            label: 'Guest',
            is_super_admin: false,
            is_admin: false,
            is_reviewer: false,
            privileged_session: false
          },
          security: {
            server_confirmed: false,
            public_auth_deferred: true
          }
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    if (
      method === 'GET' &&
      normalizedUrl === `${NURSELINK_API_ORIGIN}/api/me` &&
      nurseLinkIsPublicAuthRoute() &&
      !nurselinkSessionLoginCompleted
    ) {
      /*
       * The base app probes /api/me on public auth screens to detect an
       * existing session. Before login, a 401/403 is expected but appears as
       * a red DevTools error. Return a local unauthenticated JSON response
       * instead; the real /api/me call is allowed immediately after the
       * dedicated session-login succeeds.
       */
      return new Response(
        JSON.stringify({
          authenticated: false,
          deferred: true
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    return NURSELINK_NATIVE_FETCH(input, init);
  };

  /* NurseLink v5.5.2 — shared authenticated JSON API request helper */
  async function nurseLinkRefreshCsrf() {
    const response = await NURSELINK_NATIVE_FETCH(
      `${NURSELINK_API_ORIGIN}/sanctum/csrf-cookie`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        redirect: 'error'
      }
    );

    if (!response.ok && response.status !== 204) {
      throw new Error(`NurseLink CSRF refresh failed (${response.status}).`);
    }
  }

  function nurseLinkApiErrorMessage(payload, response) {
    if (payload?.message) return String(payload.message);

    if (payload?.errors && typeof payload.errors === 'object') {
      const first = Object.values(payload.errors).flat().find(Boolean);
      if (first) return String(first);
    }

    if (response.status === 401) return 'Please sign in to NurseLink.';
    if (response.status === 403) return 'Your NurseLink account is not authorized for this action.';
    if (response.status === 419) return 'Your secure NurseLink session expired. Please try again.';
    if (response.status === 422) return 'Please review the submitted information.';

    return `NurseLink request failed (${response.status}).`;
  }

  async function nurseLinkJsonRequest(baseUrl, path = '', options = {}) {
    if (path && typeof path === 'object' && !Array.isArray(path)) {
      options = path;
      path = '';
    }

    const base = String(baseUrl || '').replace(/\/+$/, '');
    const suffix = String(path || '');

    if (!base) throw new Error('NurseLink API endpoint is missing.');

    const url = suffix
      ? `${base}${suffix.startsWith('/') ? suffix : `/${suffix}`}`
      : base;

    const method = String(options.method || 'GET').toUpperCase();
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);

    async function perform(allow419Retry = true) {
      const headers = new Headers(options.headers || {});

      headers.set('Accept', 'application/json');
      headers.set('X-Requested-With', 'XMLHttpRequest');

      if (
        options.body !== undefined &&
        options.body !== null &&
        !headers.has('Content-Type') &&
        !(typeof FormData !== 'undefined' && options.body instanceof FormData)
      ) {
        headers.set('Content-Type', 'application/json');
      }

      if (mutating) {
        let token = nurseLinkAuthCookieValue('XSRF-TOKEN');

        if (!token) {
          await nurseLinkRefreshCsrf();
          token = nurseLinkAuthCookieValue('XSRF-TOKEN');
        }

        if (token) {
          try {
            headers.set('X-XSRF-TOKEN', decodeURIComponent(token));
          } catch (_) {
            headers.set('X-XSRF-TOKEN', token);
          }
        }
      }

      const response = await NURSELINK_NATIVE_FETCH(url, {
        ...options,
        method,
        headers,
        credentials: 'include',
        redirect: 'error'
      });

      if (response.status === 419 && mutating && allow419Retry) {
        await nurseLinkRefreshCsrf();
        return perform(false);
      }

      let payload = null;

      if (response.status !== 204) {
        const type = response.headers.get('content-type') || '';

        if (type.includes('application/json')) {
          try { payload = await response.json(); } catch (_) {}
        } else {
          try {
            const text = await response.text();
            payload = text ? { message: text.slice(0, 500) } : null;
          } catch (_) {}
        }
      }

      if (!response.ok) {
        const error = new Error(nurseLinkApiErrorMessage(payload, response));
        error.status = response.status;
        error.payload = payload;
        throw error;
      }

      return payload ?? {};
    }

    return perform(true);
  }

  const ROUTES = [
    'dashboard','profile','smart-registration','application-status',
    'qualifications','credentials','documents','portfolio',
    'learning','jobs','applications','messages','events','organizations',
    'mentoring','help','register','signup','login','signin','verify-email'
  ];

  function pathName() {
    return (window.location.pathname || '/').toLowerCase();
  }

  function routeSlug() {
    const first = pathName().split('/').filter(Boolean)[0] || 'dashboard';
    return ROUTES.includes(first) ? first : first.replace(/[^a-z0-9_-]/g, '');
  }

  function syncRouteClass() {
    const root = document.documentElement;
    [...root.classList]
      .filter(c => c.startsWith('nurselink-route-'))
      .forEach(c => root.classList.remove(c));
    root.classList.add(`nurselink-route-${routeSlug() || 'unknown'}`);
  }

  function closeNav(shell) {
    if (!shell) return;
    shell.classList.remove('mobile-nav-open');
    document.documentElement.classList.remove('nurselink-nav-lock');
  }

  function openNav(shell) {
    if (!shell) return;
    shell.classList.add('mobile-nav-open');
    document.documentElement.classList.add('nurselink-nav-lock');
  }

  function makeButton(className, label, html, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.setAttribute('aria-label', label);
    b.innerHTML = html;
    b.addEventListener('click', onClick);
    return b;
  }

  function markWideContent(scope) {
    if (!scope) return;

    scope.querySelectorAll('table').forEach(table => {
      if (table.closest('.nurselink-mobile-scroll')) return;
      const wrap = document.createElement('div');
      wrap.className = 'nurselink-mobile-scroll';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });

    scope.querySelectorAll('img, video, iframe, canvas, svg').forEach(el => {
      el.classList.add('nurselink-fluid-media');
    });
  }

  function pageText() {
    return ((document.querySelector('main') || document.body)?.textContent || '').toLowerCase();
  }

  function detectRegistrationPage() {
    const path = pathName();
    if (/(register|signup|sign-up|create-account|member-registration)/.test(path)) return true;
    const text = pageText();
    return [
      'create account',
      'create your nurselink account',
      'member registration',
      'continue registration',
      'confirm password'
    ].some(s => text.includes(s));
  }

  function detectLoginPage() {
    const path = pathName();
    if (/(login|signin|sign-in)/.test(path)) return true;
    const text = pageText();
    return (
      ['sign in','log in','welcome back'].some(s => text.includes(s)) &&
      !!document.querySelector('input[type="password"]')
    );
  }

  function findAuthForm() {
    // Prefer the first form with a password input on public auth pages.
    const candidates = [...document.querySelectorAll('form')];
    return candidates.find(f => f.querySelector('input[type="password"]')) || candidates[0] || null;
  }

  function findFormContainer(form) {
    if (!form) return null;

    // Prefer a card/panel wrapper while avoiding overly broad document containers.
    const selectors = [
      '.auth-card',
      '.register-card',
      '.login-card',
      '.form-card',
      '.registration-card',
      '.panel',
      '.card'
    ];

    for (const sel of selectors) {
      const hit = form.closest(sel);
      if (hit) return hit;
    }

    // Walk upward only a few levels to find a reasonable visual wrapper.
    let node = form.parentElement;
    let depth = 0;
    while (node && node !== document.body && depth < 4) {
      if (node.children.length <= 6) return node;
      node = node.parentElement;
      depth++;
    }

    return form;
  }

  function createHero(type) {
    const hero = document.createElement('aside');
    hero.className = 'nurselink-auth-hero';
    hero.innerHTML = `
      <div class="nurselink-auth-hero-inner">
        <div class="nurselink-auth-brand">
          <div class="nurselink-auth-logo">NL</div>
          <div class="nurselink-auth-brand-copy">
            <strong>NurseLink</strong>
            <span>${type === 'login' ? 'Welcome back' : 'Member Community'}</span>
          </div>
        </div>

        <div class="nurselink-auth-copy">
          <span class="nurselink-auth-kicker">${type === 'login' ? 'MEMBER ACCESS' : 'MEMBER REGISTRATION'}</span>
          <h1>${type === 'login' ? 'Welcome back to NurseLink' : 'Join NurseLink'}</h1>
          <p>${type === 'login'
            ? 'Access your profile, credentials, learning, opportunities, and professional network.'
            : 'Start your journey. Connect. Grow. Make an impact.'}</p>
        </div>

        <div class="nurselink-auth-points">
          <div class="nurselink-auth-point">
            <div class="nurselink-auth-icon">+</div>
            <div>
              <strong>Built for Nurses</strong>
              <span>A professional community designed around nurses and their careers.</span>
            </div>
          </div>

          <div class="nurselink-auth-point">
            <div class="nurselink-auth-icon">✓</div>
            <div>
              <strong>Secure & Trusted</strong>
              <span>Your information and professional records are handled securely.</span>
            </div>
          </div>

          <div class="nurselink-auth-point">
            <div class="nurselink-auth-icon">↗</div>
            <div>
              <strong>Grow Your Future</strong>
              <span>Build credentials, access learning, and discover opportunities.</span>
            </div>
          </div>
        </div>

        <div class="nurselink-auth-bottom">
          <strong>Connecting Filipino nurses.</strong>
          <span>Together, we elevate care.</span>
        </div>
      </div>
    `;
    return hero;
  }

  function suppressOldAuthHero(layout) {
    if (!layout || !layout.parentElement) return;
    const parent = layout.parentElement;

    [...parent.children].forEach(node => {
      if (node === layout || !(node instanceof HTMLElement)) return;
      if (node.querySelector('form')) return;

      const text = (node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

      if (
        text.includes('join nurselink') ||
        text.includes('create your account and begin your membership') ||
        text.includes('member registration')
      ) {
        node.classList.add('nurselink-auth-suppressed');
      }
    });
  }


  function polishAuthCard(sourceContainer, form, type) {
    if (!sourceContainer || !form) return;

    sourceContainer.classList.add('nurselink-auth-card-polished');

    // Add stable hooks to the live form without changing names, values,
    // submit handlers, endpoints, or authentication behavior.
    form.querySelectorAll('label').forEach(label => {
      label.classList.add('nurselink-auth-field-label');
    });

    form.querySelectorAll('input, select, textarea').forEach(field => {
      field.classList.add('nurselink-auth-field');
    });

    const submit = form.querySelector(
      'button[type="submit"], input[type="submit"], .primary-button'
    );
    if (submit) submit.classList.add('nurselink-auth-submit');

    // Detect the existing visible form title and improve only its display copy.
    const headings = [...sourceContainer.querySelectorAll('h1,h2,h3,h4,strong')];
    const title = headings.find(el => {
      const value = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      return value === 'create account' ||
             value === 'create your account' ||
             value === 'sign in' ||
             value === 'login';
    });

    if (title) {
      title.classList.add('nurselink-auth-form-title');

      if (type === 'register') {
        title.textContent = 'Create your NurseLink Account';
      } else if (type === 'login') {
        title.textContent = 'Welcome back to NurseLink';
      }

      if (!sourceContainer.querySelector('.nurselink-auth-form-subtitle')) {
        const subtitle = document.createElement('p');
        subtitle.className = 'nurselink-auth-form-subtitle';
        subtitle.textContent = type === 'register'
          ? 'Fill in your details below to get started with your membership.'
          : 'Sign in to continue to your NurseLink account.';
        title.insertAdjacentElement('afterend', subtitle);
      }
    }

    // Style the existing "Member Registration" text if present.
    [...sourceContainer.querySelectorAll('span,div,p,strong')].forEach(el => {
      if (el.children.length) return;
      const value = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (
        value === 'member registration' ||
        value === 'member access'
      ) {
        el.classList.add('nurselink-auth-form-kicker');
      }
    });

    // Real HTML trust strip: no image-embedded text, no fake form controls.
    if (!sourceContainer.querySelector('.nurselink-auth-trust-strip')) {
      const trust = document.createElement('div');
      trust.className = 'nurselink-auth-trust-strip';
      trust.setAttribute('aria-label', 'NurseLink trust and community benefits');
      trust.innerHTML = `
        <div class="nurselink-auth-trust-item">
          <span class="nurselink-auth-trust-icon" aria-hidden="true">✓</span>
          <div>
            <strong>Secure & Private</strong>
            <span>Your data is always protected.</span>
          </div>
        </div>
        <div class="nurselink-auth-trust-item">
          <span class="nurselink-auth-trust-icon" aria-hidden="true">◎</span>
          <div>
            <strong>Trusted Community</strong>
            <span>Connect with nurses nationwide.</span>
          </div>
        </div>
        <div class="nurselink-auth-trust-item">
          <span class="nurselink-auth-trust-icon" aria-hidden="true">↗</span>
          <div>
            <strong>Career Growth</strong>
            <span>Opportunities and resources for you.</span>
          </div>
        </div>
      `;
      sourceContainer.appendChild(trust);
    }
  }

  function enhanceAuthPage(type) {
    // Idempotent: do nothing if this version already enhanced the page.
    if (document.querySelector('.nurselink-auth-layout[data-nurselink-auth="1"]')) return true;

    const form = findAuthForm();
    if (!form) return false;

    const sourceContainer = findFormContainer(form);
    if (!sourceContainer || !sourceContainer.parentElement) return false;

    // CRITICAL v5.5.2 FIX:
    // Save the real parent and insert the new layout BEFORE moving the form.
    const originalParent = sourceContainer.parentElement;

    const layout = document.createElement('section');
    layout.className = `nurselink-auth-layout nurselink-auth-${type}`;
    layout.dataset.nurselinkAuth = '1';
    layout.setAttribute('data-nurselink-version', '3.1.0');
    layout.setAttribute('data-nurselink-hotfix', 'standalone-routing-v321');

    const hero = createHero(type);
    const panelWrap = document.createElement('div');
    panelWrap.className = 'nurselink-auth-panel-wrap';

    layout.appendChild(hero);
    layout.appendChild(panelWrap);

    // Insert replacement shell while sourceContainer is still in originalParent.
    originalParent.insertBefore(layout, sourceContainer);

    // Only now move the existing functional card/form into the new shell.
    panelWrap.appendChild(sourceContainer);
    sourceContainer.classList.add('nurselink-register-panel');

    document.documentElement.classList.add(`nurselink-public-${type}`);
    suppressOldAuthHero(layout);

    // Helpful form semantics/styling hooks without changing field values or names.
    form.classList.add('nurselink-auth-form');
    polishAuthCard(sourceContainer, form, type);

    form.querySelectorAll('input').forEach(input => {
      if (!input.getAttribute('autocomplete')) {
        const n = (input.name || input.type || '').toLowerCase();
        if (n.includes('email')) input.autocomplete = 'email';
        else if (n.includes('first')) input.autocomplete = 'given-name';
        else if (n.includes('last')) input.autocomplete = 'family-name';
        else if (input.type === 'password') input.autocomplete = 'new-password';
      }
    });

    return true;
  }


  /* =========================================================
     NurseLink Professional Onboarding — v5.5.2
     UI-only enhancement over the existing live application routes.
     No API endpoint, field name, submit handler, or permission is replaced.
     ========================================================= */

  const APPLICATION_STEPS = [
    {
      number: 1,
      title: 'Personal Information',
      short: 'Personal',
      href: '/profile?nlstep=1',
      description: 'Identity, contact details and current address.'
    },
    {
      number: 2,
      title: 'Professional Information',
      short: 'Professional',
      href: '/profile?nlstep=2',
      description: 'Professional title and nursing experience.'
    },
    {
      number: 3,
      title: 'Credentials & Licenses',
      short: 'Credentials',
      href: '/smart-registration?nlstep=3',
      description: 'PRC license, diploma and professional evidence.'
    },
    {
      number: 4,
      title: 'Employment / OFW History',
      short: 'Employment',
      href: '/profile?nlstep=4',
      description: 'Current or most recent position and employer.'
    },
    {
      number: 5,
      title: 'Documents & Missing Info',
      short: 'Documents',
      href: '/smart-registration?nlstep=5',
      description: 'Upload evidence and complete missing information.'
    },
    {
      number: 6,
      title: 'Review & Submit',
      short: 'Review',
      href: '/application-status',
      description: 'Review completion and submit your application.'
    }
  ];

  function isApplicantPortal() {
    const topbar = document.querySelector('.topbar');
    const topbarText = (topbar?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (topbarText.includes('applicant portal') || topbarText.includes('applicantportal')) {
      return true;
    }

    const userChip = document.querySelector('.user-chip');
    const chipText = (userChip?.textContent || '').toLowerCase();
    return chipText.includes('membership pending');
  }

  function applicationStepFromLocation() {
    const route = routeSlug();
    const params = new URLSearchParams(window.location.search);
    const requested = Number(params.get('nlstep') || 0);

    if (route === 'profile') {
      if ([1, 2, 4].includes(requested)) return requested;
      return 1;
    }

    if (route === 'smart-registration') {
      if ([3, 5].includes(requested)) return requested;
      return 3;
    }

    if (route === 'application-status') return 6;

    return 0;
  }

  function applicationStepByProgress(progress) {
    const value = Math.max(0, Math.min(100, Number(progress) || 0));

    if (value < 25) return APPLICATION_STEPS[0];
    if (value < 50) return APPLICATION_STEPS[1];
    if (value < 65) return APPLICATION_STEPS[2];
    if (value < 75) return APPLICATION_STEPS[3];
    if (value < 90) return APPLICATION_STEPS[4];
    return APPLICATION_STEPS[5];
  }

  function readApplicantDashboard() {
    let progress = 0;
    let status = 'Not Started';

    const cards = [...document.querySelectorAll('.stat-card')];

    cards.forEach(card => {
      const text = (card.textContent || '').replace(/\s+/g, ' ').trim();

      if (/Application Progress/i.test(text)) {
        const match = text.match(/(\d{1,3})\s*%/);
        if (match) progress = Math.max(0, Math.min(100, Number(match[1])));
      }

      if (/Application Status/i.test(text)) {
        const strong = card.querySelector('strong');
        if (strong?.textContent?.trim()) status = strong.textContent.trim();
      }
    });

    return { progress, status };
  }

  function createApplicationJourney(currentStep) {
    const current = APPLICATION_STEPS[currentStep - 1] || APPLICATION_STEPS[0];
    const previous = APPLICATION_STEPS[currentStep - 2] || null;
    const next = APPLICATION_STEPS[currentStep] || null;

    const section = document.createElement('section');
    section.className = 'nurselink-application-journey';
    section.dataset.nurselinkJourney = '1';
    section.setAttribute('aria-label', 'NurseLink membership application steps');

    section.innerHTML = `
      <div class="nurselink-journey-heading">
        <div>
          <span class="nurselink-journey-eyebrow">MEMBERSHIP APPLICATION</span>
          <strong>Complete your application</strong>
          <p>Save your information as you go. You can return to any available step before submission.</p>
        </div>
        <div class="nurselink-journey-count">
          <span>Step</span>
          <strong>${currentStep}</strong>
          <small>of 6</small>
        </div>
      </div>

      <div class="nurselink-journey-mobile-summary">
        <div>
          <span>Step ${currentStep} of 6</span>
          <strong>${current.title}</strong>
          <small>${current.description}</small>
        </div>
        <div class="nurselink-journey-progress" aria-hidden="true">
          <i style="width:${(currentStep / 6) * 100}%"></i>
        </div>
      </div>

      <nav class="nurselink-journey-steps">
        ${APPLICATION_STEPS.map(step => `
          <a
            href="${step.href}"
            class="nurselink-journey-step ${step.number === currentStep ? 'active' : ''}"
            ${step.number === currentStep ? 'aria-current="step"' : ''}
          >
            <span class="nurselink-journey-number">${step.number}</span>
            <span class="nurselink-journey-step-copy">
              <strong>${step.title}</strong>
              <small>${step.description}</small>
            </span>
          </a>
        `).join('')}
      </nav>

      <div class="nurselink-journey-mobile-actions">
        ${previous ? `<a class="nurselink-journey-back" href="${previous.href}">← ${previous.short}</a>` : '<span></span>'}
        ${next ? `<a class="nurselink-journey-next" href="${next.href}">${next.short} →</a>` : '<a class="nurselink-journey-next" href="/application-status">Review status →</a>'}
      </div>
    `;

    return section;
  }

  function ensureApplicationJourney(page) {
    if (!page || !isApplicantPortal()) return;

    const currentStep = applicationStepFromLocation();
    if (!currentStep) return;

    page.classList.add('nurselink-applicant-flow');
    document.documentElement.classList.add('nurselink-applicant-flow');

    let journey = page.querySelector('.nurselink-application-journey');

    if (!journey) {
      journey = createApplicationJourney(currentStep);
      const header = page.querySelector('.page-header');

      if (header?.parentElement === page) {
        header.insertAdjacentElement('afterend', journey);
      } else {
        page.insertBefore(journey, page.firstChild);
      }
    } else {
      const existingCurrent = Number(
        journey.querySelector('.nurselink-journey-count strong')?.textContent || 0
      );

      if (existingCurrent !== currentStep) {
        journey.replaceWith(createApplicationJourney(currentStep));
      }
    }
  }

  function textStartsWith(element, prefix) {
    return (element?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .startsWith(prefix.toLowerCase());
  }

  function ensureStepContext(page, key, title, text) {
    if (!page) return null;

    let card = page.querySelector('.nurselink-step-context');

    if (!card) {
      card = document.createElement('section');
      card.className = 'nurselink-step-context';
      const journey = page.querySelector('.nurselink-application-journey');

      if (journey) journey.insertAdjacentElement('afterend', card);
      else page.insertBefore(card, page.firstChild);
    }

    card.dataset.context = key;
    card.innerHTML = `
      <div class="nurselink-step-context-icon" aria-hidden="true">✓</div>
      <div>
        <span>APPLICATION STEP</span>
        <strong>${title}</strong>
        <p>${text}</p>
      </div>
    `;

    return card;
  }

  function enhanceProfileApplication(page) {
    if (!page || routeSlug() !== 'profile' || !isApplicantPortal()) return;

    const step = applicationStepFromLocation();
    page.classList.add(`nurselink-profile-step-${step}`);

    page.querySelectorAll('.nurselink-step-focus, .nurselink-section-active')
      .forEach(el => el.classList.remove('nurselink-step-focus', 'nurselink-section-active'));

    const headings = [...page.querySelectorAll('h2')];
    const personal = headings.find(h => textStartsWith(h, 'personal information'));
    const professional = headings.find(h => textStartsWith(h, 'professional information'));

    const labels = [...page.querySelectorAll('.profile-form label')];
    const titleLabel = labels.find(label => textStartsWith(label, 'professional title'));
    const yearsLabel = labels.find(label => textStartsWith(label, 'years of experience'));
    const positionLabel = labels.find(label => textStartsWith(label, 'current position'));
    const employerLabel = labels.find(label => textStartsWith(label, 'current employer'));

    if (personal) personal.id = 'nurselink-personal-information';
    if (professional) professional.id = 'nurselink-professional-information';

    let scrollTarget = null;

    if (step === 1) {
      personal?.classList.add('nurselink-section-active');
      scrollTarget = personal;

      ensureStepContext(
        page,
        'personal',
        'Personal Information',
        'Confirm your legal name, contact information and current address. Fields marked with an asterisk are required.'
      );
    }

    if (step === 2) {
      professional?.classList.add('nurselink-section-active');
      titleLabel?.classList.add('nurselink-step-focus');
      yearsLabel?.classList.add('nurselink-step-focus');
      scrollTarget = professional || titleLabel;

      ensureStepContext(
        page,
        'professional',
        'Professional Information',
        'Tell NurseLink about your nursing title and experience so your application can be reviewed in the correct professional context.'
      );
    }

    if (step === 4) {
      professional?.classList.add('nurselink-section-active');
      positionLabel?.classList.add('nurselink-step-focus');
      employerLabel?.classList.add('nurselink-step-focus');
      scrollTarget = positionLabel || professional;

      ensureStepContext(
        page,
        'employment',
        'Employment / OFW History',
        'Build a complete record of your local and overseas nursing employment. Add each employer or facility separately, then upload supporting evidence in Step 5.'
      );
    }

    if (
      scrollTarget &&
      page.dataset.nurselinkScrolledStep !== String(step)
    ) {
      page.dataset.nurselinkScrolledStep = String(step);

      setTimeout(() => {
        scrollTarget.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, 180);
    }
  }

  function enhanceSmartRegistrationApplication(page) {
    if (!page || routeSlug() !== 'smart-registration' || !isApplicantPortal()) return;

    const step = applicationStepFromLocation();
    page.classList.add(`nurselink-smart-step-${step}`);

    if (step === 3) {
      ensureStepContext(
        page,
        'credentials',
        'Credentials & Licenses',
        'Upload your PRC license, nursing diploma, international license, training certificate or other professional evidence. NurseLink can use supported documents to extract information for review.'
      );
    } else {
      ensureStepContext(
        page,
        'documents',
        'Documents & Missing Information',
        'Upload your CV, employment certificates, passport or ID and other supporting evidence. Review extracted information and complete anything NurseLink identifies as missing.'
      );
    }
  }

  function enhanceApplicationStatus(page) {
    if (!page || routeSlug() !== 'application-status' || !isApplicantPortal()) return;

    page.classList.add('nurselink-review-submit-page');

    ensureStepContext(
      page,
      'review',
      'Final Review & Submission',
      'Check your application completion and current status below. When the application is ready, use the existing NurseLink submission controls to send it for review.'
    );
  }

  function enhanceApplicantDashboard(page) {
    if (!page || routeSlug() !== 'dashboard' || !isApplicantPortal()) return;

    page.classList.add('nurselink-applicant-dashboard');

    const data = readApplicantDashboard();
    const nextStep = applicationStepByProgress(data.progress);

    let card = page.querySelector('.nurselink-applicant-command');

    if (!card) {
      card = document.createElement('section');
      card.className = 'nurselink-applicant-command';

      const header = page.querySelector('.page-header');
      if (header) header.insertAdjacentElement('afterend', card);
      else page.insertBefore(card, page.firstChild);
    }

    const safeStatus = data.status || 'Not Started';

    card.style.setProperty('--nurselink-application-progress', `${data.progress * 3.6}deg`);

    card.innerHTML = `
      <div class="nurselink-command-main">
        <span class="nurselink-command-eyebrow">APPLICANT JOURNEY</span>
        <h2>Complete your NurseLink membership application</h2>
        <p>Build your application in clear stages, save your information as you go, and review everything before submission.</p>

        <div class="nurselink-command-actions">
          <a class="primary-button" href="${nextStep.href}">Continue application →</a>
          <a class="secondary-button" href="/application-status">View application status</a>
        </div>
      </div>

      <div class="nurselink-command-progress-wrap">
        <div class="nurselink-command-ring" aria-label="${data.progress}% application completion">
          <div>
            <strong>${data.progress}%</strong>
            <span>Complete</span>
          </div>
        </div>

        <div class="nurselink-command-facts">
          <div>
            <span>Current status</span>
            <strong>${safeStatus}</strong>
          </div>
          <div>
            <span>Next action</span>
            <strong>${nextStep.title}</strong>
          </div>
          <div>
            <span>What needs attention</span>
            <strong>${data.progress >= 90 ? 'Final review and submission' : 'Complete remaining application steps'}</strong>
          </div>
        </div>
      </div>
    `;
  }

  function enhanceVerificationPage() {
    if (routeSlug() !== 'verify-email') return false;

    if (document.querySelector('.nurselink-auth-layout[data-nurselink-verification="1"]')) {
      return true;
    }

    const card = document.querySelector('.auth-card');
    if (!card || !card.parentElement) return false;

    const originalParent = card.parentElement;

    const layout = document.createElement('section');
    layout.className = 'nurselink-auth-layout nurselink-auth-verification';
    layout.dataset.nurselinkVerification = '1';
    layout.setAttribute('data-nurselink-version', '3.1.0');

    const hero = createHero('register');

    const kicker = hero.querySelector('.nurselink-auth-kicker');
    const heading = hero.querySelector('.nurselink-auth-copy h1');
    const description = hero.querySelector('.nurselink-auth-copy p');

    if (kicker) kicker.textContent = 'EMAIL VERIFICATION';
    if (heading) heading.textContent = 'Almost there';
    if (description) {
      description.textContent =
        'Verify your email address to secure your account and continue your NurseLink membership application.';
    }

    const panel = document.createElement('div');
    panel.className = 'nurselink-auth-panel-wrap';

    originalParent.insertBefore(layout, card);
    layout.appendChild(hero);
    layout.appendChild(panel);
    panel.appendChild(card);

    card.classList.add(
      'nurselink-register-panel',
      'nurselink-verification-card'
    );

    const title = [...card.querySelectorAll('h1,h2,h3')]
      .find(el => textStartsWith(el, 'check your email'));

    title?.classList.add('nurselink-auth-form-title');

    card.querySelector('.eyebrow')?.classList.add('nurselink-auth-form-kicker');

    const verificationEmail = card.querySelector('.verification-email');
    verificationEmail?.classList.add('nurselink-verification-email');

    document.documentElement.classList.add(
      'nurselink-public-verification',
      'nurselink-route-verify-email'
    );

    suppressOldAuthHero(layout);
    return true;
  }

  function enhanceProfessionalOnboarding(page) {
    if (!page) return;

    if (isApplicantPortal()) {
      document.documentElement.classList.add('nurselink-applicant-portal');

      ensureApplicationJourney(page);
      enhanceProfileApplication(page);
      enhanceSmartRegistrationApplication(page);
      enhanceApplicationStatus(page);
      enhanceApplicantDashboard(page);
    } else {
      document.documentElement.classList.remove(
        'nurselink-applicant-portal',
        'nurselink-applicant-flow'
      );
    }
  }


  /* =========================================================
     NurseLink Profile Photo — v5.5.2
     Persistent API-backed photo with preview, crop, replace, remove,
     topbar synchronization and mobile camera support.
     ========================================================= */

  const PROFILE_PHOTO_API = 'https://api.amsertech.com/api/profile-photo';
  const PROFILE_PHOTO_CSRF = 'https://api.amsertech.com/sanctum/csrf-cookie';

  const profilePhotoState = {
    loaded: false,
    loading: null,
    url: null
  };

  function cookieValue(name) {
    const prefix = `${name}=`;
    const row = document.cookie
      .split(';')
      .map(value => value.trim())
      .find(value => value.startsWith(prefix));

    return row ? decodeURIComponent(row.slice(prefix.length)) : '';
  }

  async function ensureProfilePhotoCsrf() {
    await fetch(PROFILE_PHOTO_CSRF, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json'
      }
    });
  }

  async function profilePhotoRequest(path = '', options = {}) {
    const method = (options.method || 'GET').toUpperCase();

    if (!['GET', 'HEAD'].includes(method)) {
      await ensureProfilePhotoCsrf();
    }

    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');

    if (!['GET', 'HEAD'].includes(method)) {
      const token = cookieValue('XSRF-TOKEN');
      if (token) headers.set('X-XSRF-TOKEN', token);
    }

    const response = await fetch(`${PROFILE_PHOTO_API}${path}`, {
      ...options,
      method,
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      let message = 'Unable to update profile photo.';

      try {
        const data = await response.json();
        const errors = data?.errors;

        if (errors && typeof errors === 'object') {
          const first = Object.values(errors)[0];
          if (Array.isArray(first) && first[0]) message = first[0];
          else if (typeof first === 'string') message = first;
        } else if (data?.message) {
          message = data.message;
        }
      } catch (_) {}

      throw new Error(message);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  function profileInitial() {
    const chip = document.querySelector('.user-chip');
    const text = (chip?.textContent || '').replace(/\s+/g, ' ').trim();
    return text ? text.charAt(0).toUpperCase() : 'N';
  }

  function applyProfilePhotoToAvatar(url) {
    document.querySelectorAll('.topbar .avatar').forEach(avatar => {
      if (!avatar.dataset.nurselinkInitial) {
        avatar.dataset.nurselinkInitial =
          (avatar.textContent || '').trim() || profileInitial();
      }

      avatar.classList.toggle('has-profile-photo', !!url);

      if (url) {
        let img = avatar.querySelector('img.nurselink-avatar-photo');

        if (!img) {
          avatar.textContent = '';
          img = document.createElement('img');
          img.className = 'nurselink-avatar-photo';
          img.alt = 'Profile photo';
          avatar.appendChild(img);
        }

        if (img.src !== url) img.src = url;
      } else {
        avatar.innerHTML = '';
        avatar.textContent = avatar.dataset.nurselinkInitial || profileInitial();
      }
    });

    document
      .querySelectorAll('.nurselink-profile-photo-image')
      .forEach(img => {
        if (!(img instanceof HTMLImageElement)) return;

        if (url) {
          img.src = url;
          img.hidden = false;
        } else {
          img.removeAttribute('src');
          img.hidden = true;
        }
      });

    document
      .querySelectorAll('.nurselink-profile-photo-fallback')
      .forEach(el => {
        el.hidden = !!url;
        if (!url) el.textContent = profileInitial();
      });

    document
      .querySelectorAll('.nurselink-profile-photo-remove')
      .forEach(button => {
        button.hidden = !url;
      });
  }

  async function loadProfilePhoto(force = false) {
    if (profilePhotoState.loaded && !force) {
      applyProfilePhotoToAvatar(profilePhotoState.url);
      return profilePhotoState.url;
    }

    if (profilePhotoState.loading && !force) {
      return profilePhotoState.loading;
    }

    profilePhotoState.loading = profilePhotoRequest()
      .then(payload => {
        profilePhotoState.url = payload?.data?.profile_photo_url || null;
        profilePhotoState.loaded = true;
        applyProfilePhotoToAvatar(profilePhotoState.url);
        return profilePhotoState.url;
      })
      .catch(() => {
        profilePhotoState.loaded = true;
        profilePhotoState.url = null;
        applyProfilePhotoToAvatar(null);
        return null;
      })
      .finally(() => {
        profilePhotoState.loading = null;
      });

    return profilePhotoState.loading;
  }

  function setProfilePhotoStatus(card, text, tone = '') {
    const status = card?.querySelector('.nurselink-profile-photo-status');
    if (!status) return;

    status.textContent = text || '';
    status.dataset.tone = tone;
  }

  function openProfileCrop(file) {
    return new Promise((resolve, reject) => {
      const type = (file?.type || '').toLowerCase();

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
        reject(new Error('Please choose a JPG, PNG or WebP image.'));
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('Profile photo must not exceed 5 MB.'));
        return;
      }

      const reader = new FileReader();

      reader.onerror = () => reject(new Error('Unable to read that image.'));

      reader.onload = () => {
        const dialog = document.createElement('div');
        dialog.className = 'nurselink-photo-crop-modal';
        dialog.innerHTML = `
          <div class="nurselink-photo-crop-backdrop"></div>
          <section class="nurselink-photo-crop-dialog" role="dialog" aria-modal="true" aria-label="Crop profile photo">
            <div class="nurselink-photo-crop-head">
              <div>
                <span>PROFILE PHOTO</span>
                <strong>Position your photo</strong>
              </div>
              <button type="button" class="nurselink-photo-crop-close" aria-label="Close">×</button>
            </div>

            <div class="nurselink-photo-crop-stage">
              <div class="nurselink-photo-crop-viewport">
                <img alt="Profile photo crop preview">
                <div class="nurselink-photo-crop-guide"></div>
              </div>
              <small>Drag to reposition. Use the slider to zoom.</small>
            </div>

            <label class="nurselink-photo-zoom">
              <span>Zoom</span>
              <input type="range" min="1" max="3" value="1" step="0.01">
            </label>

            <div class="nurselink-photo-crop-actions">
              <button type="button" class="secondary-button nurselink-photo-cancel">Cancel</button>
              <button type="button" class="primary-button nurselink-photo-use">Use Photo</button>
            </div>
          </section>
        `;

        document.body.appendChild(dialog);
        document.documentElement.classList.add('nurselink-photo-modal-open');

        const image = dialog.querySelector('img');
        const viewport = dialog.querySelector('.nurselink-photo-crop-viewport');
        const zoom = dialog.querySelector('input[type="range"]');
        const close = dialog.querySelector('.nurselink-photo-crop-close');
        const cancel = dialog.querySelector('.nurselink-photo-cancel');
        const use = dialog.querySelector('.nurselink-photo-use');
        const backdrop = dialog.querySelector('.nurselink-photo-crop-backdrop');

        let naturalWidth = 0;
        let naturalHeight = 0;
        let baseScale = 1;
        let scale = 1;
        let offsetX = 0;
        let offsetY = 0;
        let pointerId = null;
        let startX = 0;
        let startY = 0;
        let originX = 0;
        let originY = 0;
        let settled = false;

        function finish(value, error = null) {
          if (settled) return;
          settled = true;
          dialog.remove();
          document.documentElement.classList.remove('nurselink-photo-modal-open');
          if (error) reject(error);
          else resolve(value);
        }

        function viewportSize() {
          return viewport.getBoundingClientRect().width || 280;
        }

        function clampOffsets() {
          const size = viewportSize();
          const drawnW = naturalWidth * scale;
          const drawnH = naturalHeight * scale;
          const maxX = Math.max(0, (drawnW - size) / 2);
          const maxY = Math.max(0, (drawnH - size) / 2);

          offsetX = Math.max(-maxX, Math.min(maxX, offsetX));
          offsetY = Math.max(-maxY, Math.min(maxY, offsetY));
        }

        function renderImage() {
          if (!naturalWidth || !naturalHeight) return;

          clampOffsets();

          image.style.width = `${naturalWidth * scale}px`;
          image.style.height = `${naturalHeight * scale}px`;
          image.style.transform =
            `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`;
        }

        image.onload = () => {
          naturalWidth = image.naturalWidth;
          naturalHeight = image.naturalHeight;

          if (naturalWidth < 160 || naturalHeight < 160) {
            finish(null, new Error('Please choose an image at least 160 × 160 pixels.'));
            return;
          }

          const size = viewportSize();
          baseScale = Math.max(size / naturalWidth, size / naturalHeight);
          scale = baseScale;
          renderImage();
        };

        image.src = String(reader.result);

        zoom.addEventListener('input', () => {
          const multiplier = Number(zoom.value) || 1;
          scale = baseScale * multiplier;
          renderImage();
        });

        viewport.addEventListener('pointerdown', event => {
          if (!naturalWidth) return;

          pointerId = event.pointerId;
          viewport.setPointerCapture(pointerId);

          startX = event.clientX;
          startY = event.clientY;
          originX = offsetX;
          originY = offsetY;
        });

        viewport.addEventListener('pointermove', event => {
          if (pointerId !== event.pointerId) return;

          offsetX = originX + (event.clientX - startX);
          offsetY = originY + (event.clientY - startY);
          renderImage();
        });

        function release(event) {
          if (pointerId !== event.pointerId) return;
          pointerId = null;
        }

        viewport.addEventListener('pointerup', release);
        viewport.addEventListener('pointercancel', release);

        close.addEventListener('click', () => finish(null));
        cancel.addEventListener('click', () => finish(null));
        backdrop.addEventListener('click', () => finish(null));

        use.addEventListener('click', () => {
          if (!naturalWidth || !naturalHeight) {
            finish(null, new Error('Image is still loading.'));
            return;
          }

          const size = viewportSize();
          const cropSourceSize = size / scale;
          const centerX = naturalWidth / 2 - offsetX / scale;
          const centerY = naturalHeight / 2 - offsetY / scale;

          const sx = Math.max(
            0,
            Math.min(naturalWidth - cropSourceSize, centerX - cropSourceSize / 2)
          );

          const sy = Math.max(
            0,
            Math.min(naturalHeight - cropSourceSize, centerY - cropSourceSize / 2)
          );

          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 640;

          const context = canvas.getContext('2d');

          if (!context) {
            finish(null, new Error('Your browser could not prepare the photo.'));
            return;
          }

          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, 640, 640);
          context.drawImage(
            image,
            sx,
            sy,
            cropSourceSize,
            cropSourceSize,
            0,
            0,
            640,
            640
          );

          canvas.toBlob(blob => {
            if (!blob) {
              finish(null, new Error('Unable to create the cropped photo.'));
              return;
            }

            finish(new File(
              [blob],
              'nurselink-profile-photo.jpg',
              { type: 'image/jpeg' }
            ));
          }, 'image/jpeg', 0.9);
        });
      };

      reader.readAsDataURL(file);
    });
  }

  async function uploadProfilePhoto(card, sourceFile) {
    let cropped;

    try {
      cropped = await openProfileCrop(sourceFile);
    } catch (error) {
      setProfilePhotoStatus(card, error.message, 'error');
      return;
    }

    if (!cropped) return;

    const formData = new FormData();
    formData.append('photo', cropped);

    setProfilePhotoStatus(card, 'Uploading photo…', 'loading');

    try {
      const payload = await profilePhotoRequest('', {
        method: 'POST',
        body: formData
      });

      profilePhotoState.loaded = true;
      profilePhotoState.url = payload?.data?.profile_photo_url || null;

      applyProfilePhotoToAvatar(profilePhotoState.url);
      setProfilePhotoStatus(card, 'Profile photo updated.', 'success');
    } catch (error) {
      setProfilePhotoStatus(card, error.message, 'error');
    }
  }

  function ensureProfilePhotoCard(page) {
    if (!page || routeSlug() !== 'profile') return;
    if (page.querySelector('.nurselink-profile-photo-card')) {
      loadProfilePhoto();
      return;
    }

    const card = document.createElement('section');
    card.className = 'nurselink-profile-photo-card';
    card.innerHTML = `
      <div class="nurselink-profile-photo-preview">
        <img class="nurselink-profile-photo-image" alt="Your NurseLink profile photo" hidden>
        <span class="nurselink-profile-photo-fallback">${profileInitial()}</span>
        <span class="nurselink-profile-photo-camera" aria-hidden="true">＋</span>
      </div>

      <div class="nurselink-profile-photo-copy">
        <span class="nurselink-profile-photo-eyebrow">PROFILE PHOTO</span>
        <strong>Add a professional profile picture</strong>
        <p>
          Use a clear, recent head-and-shoulders photo. Your picture will appear
          in your NurseLink profile and account avatar.
        </p>
        <small>JPG, PNG or WebP · up to 5 MB · minimum 160 × 160 px</small>

        <div class="nurselink-profile-photo-status" aria-live="polite"></div>
      </div>

      <div class="nurselink-profile-photo-actions">
        <label class="primary-button nurselink-profile-photo-upload">
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden>
          <span>Upload / Change Photo</span>
        </label>

        <label class="secondary-button nurselink-profile-photo-camera-button">
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" hidden>
          <span>Take Photo</span>
        </label>

        <button type="button" class="nurselink-profile-photo-remove" hidden>
          Remove
        </button>
      </div>
    `;

    const context = page.querySelector('.nurselink-step-context');
    const journey = page.querySelector('.nurselink-application-journey');
    const form = page.querySelector('.profile-form');

    if (context) {
      context.insertAdjacentElement('afterend', card);
    } else if (journey) {
      journey.insertAdjacentElement('afterend', card);
    } else if (form) {
      form.insertAdjacentElement('beforebegin', card);
    } else {
      page.appendChild(card);
    }

    const fileInputs = card.querySelectorAll('input[type="file"]');

    fileInputs.forEach(input => {
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.value = '';
        if (file) await uploadProfilePhoto(card, file);
      });
    });

    card
      .querySelector('.nurselink-profile-photo-remove')
      ?.addEventListener('click', async () => {
        if (!window.confirm('Remove your NurseLink profile photo?')) return;

        setProfilePhotoStatus(card, 'Removing photo…', 'loading');

        try {
          await profilePhotoRequest('', { method: 'DELETE' });
          profilePhotoState.loaded = true;
          profilePhotoState.url = null;
          applyProfilePhotoToAvatar(null);
          setProfilePhotoStatus(card, 'Profile photo removed.', 'success');
        } catch (error) {
          setProfilePhotoStatus(card, error.message, 'error');
        }
      });

    loadProfilePhoto();
  }

  function enhanceProfilePhoto(page) {
    if (!page) return;

    // Load the account photo on every authenticated shell so the topbar avatar
    // stays synchronized across Dashboard, Profile, Smart Registration, etc.
    loadProfilePhoto();

    if (routeSlug() === 'profile') {
      ensureProfilePhotoCard(page);
    }
  }


  const EMPLOYMENT_HISTORY_API = 'https://api.amsertech.com/api/employment-history';

  const employmentState = {
    loaded: false,
    loading: null,
    rows: []
  };

  async function employmentRequest(path = '', options = {}) {
    const method = (options.method || 'GET').toUpperCase();

    if (!['GET', 'HEAD'].includes(method)) {
      await ensureProfilePhotoCsrf();
    }

    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');

    if (!['GET', 'HEAD'].includes(method)) {
      const token = cookieValue('XSRF-TOKEN');
      if (token) headers.set('X-XSRF-TOKEN', token);

      if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
    }

    const response = await fetch(`${EMPLOYMENT_HISTORY_API}${path}`, {
      ...options,
      method,
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      let message = 'Unable to update employment history.';

      try {
        const data = await response.json();

        if (data?.errors && typeof data.errors === 'object') {
          const first = Object.values(data.errors)[0];
          if (Array.isArray(first) && first[0]) message = first[0];
          else if (typeof first === 'string') message = first;
        } else if (data?.message) {
          message = data.message;
        }
      } catch (_) {}

      throw new Error(message);
    }

    return response.status === 204 ? null : response.json();
  }

  async function loadEmploymentHistory(force = false) {
    if (employmentState.loaded && !force) return employmentState.rows;
    if (employmentState.loading && !force) return employmentState.loading;

    employmentState.loading = employmentRequest()
      .then(payload => {
        employmentState.rows = Array.isArray(payload?.data) ? payload.data : [];
        employmentState.loaded = true;
        return employmentState.rows;
      })
      .finally(() => {
        employmentState.loading = null;
      });

    return employmentState.loading;
  }

  function employmentLabel(value) {
    const labels = {
      hospital: 'Hospital',
      clinic: 'Clinic',
      care_facility: 'Care Facility',
      government: 'Government',
      private_company: 'Private Company',
      recruitment_agency: 'Recruitment Agency',
      home_care: 'Home Care',
      education: 'Education / Academe',
      full_time: 'Full-time',
      part_time: 'Part-time',
      contract: 'Contract',
      temporary: 'Temporary',
      project_based: 'Project-based',
      volunteer: 'Volunteer',
      licensed_agency: 'Licensed Recruitment Agency',
      direct_hire: 'Direct Hire',
      government_to_government: 'Government-to-Government',
      name_hire: 'Name Hire',
      local_employment: 'Local Employment',
      other: 'Other'
    };

    return labels[value] || value || '—';
  }

  function employmentMonth(value) {
    if (!value) return 'Present';

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      year: 'numeric'
    }).format(date);
  }

  function employmentPayload(form) {
    const value = name => form.elements.namedItem(name)?.value?.trim?.() || '';
    const checked = name => !!form.elements.namedItem(name)?.checked;

    return {
      employer_name: value('employer_name'),
      facility_type: value('facility_type') || null,
      country: value('country'),
      city: value('city') || null,
      position: value('position'),
      specialty: value('specialty') || null,
      employment_type: value('employment_type') || null,
      start_date: value('start_date') || null,
      end_date: checked('is_current') ? null : (value('end_date') || null),
      is_current: checked('is_current'),
      is_overseas: checked('is_overseas'),
      deployment_type: checked('is_overseas')
        ? (value('deployment_type') || null)
        : 'local_employment',
      agency_or_program: checked('is_overseas')
        ? (value('agency_or_program') || null)
        : null,
      notes: value('notes') || null
    };
  }

  function syncEmploymentForm(form) {
    const current = form.elements.namedItem('is_current');
    const overseas = form.elements.namedItem('is_overseas');
    const endDate = form.elements.namedItem('end_date');

    if (endDate) {
      endDate.disabled = !!current?.checked;
      if (current?.checked) endDate.value = '';
    }

    form.querySelectorAll('[data-overseas-only]').forEach(group => {
      const visible = !!overseas?.checked;
      group.hidden = !visible;

      group.querySelectorAll('input,select').forEach(field => {
        field.disabled = !visible;
      });
    });
  }

  function employmentEditor(record = null) {
    const form = document.createElement('form');
    form.className = 'nurselink-employment-editor';

    form.innerHTML = `
      <div class="nurselink-employment-editor-head">
        <div>
          <span>EMPLOYMENT RECORD</span>
          <strong>${record ? 'Edit employment record' : 'Add employment record'}</strong>
          <p>Add one record for each hospital, employer or facility.</p>
        </div>
        <button type="button" class="nurselink-employment-editor-close" aria-label="Close">×</button>
      </div>

      <div class="nurselink-employment-grid">
        <label class="span-2">
          <span>Employer / Hospital / Facility *</span>
          <input name="employer_name" maxlength="190" required>
        </label>

        <label>
          <span>Facility Type</span>
          <select name="facility_type">
            <option value="">Select type</option>
            <option value="hospital">Hospital</option>
            <option value="clinic">Clinic</option>
            <option value="care_facility">Care Facility</option>
            <option value="government">Government</option>
            <option value="private_company">Private Company</option>
            <option value="recruitment_agency">Recruitment Agency</option>
            <option value="home_care">Home Care</option>
            <option value="education">Education / Academe</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label>
          <span>Country *</span>
          <input name="country" maxlength="120" required>
        </label>

        <label>
          <span>City</span>
          <input name="city" maxlength="120">
        </label>

        <label>
          <span>Position *</span>
          <input name="position" maxlength="150" required placeholder="e.g. Staff Nurse">
        </label>

        <label>
          <span>Specialty / Area</span>
          <input name="specialty" maxlength="150" placeholder="e.g. ICU, ER">
        </label>

        <label>
          <span>Employment Type</span>
          <select name="employment_type">
            <option value="">Select type</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="temporary">Temporary</option>
            <option value="project_based">Project-based</option>
            <option value="volunteer">Volunteer</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label>
          <span>Start Date</span>
          <input name="start_date" type="date">
        </label>

        <label>
          <span>End Date</span>
          <input name="end_date" type="date">
        </label>

        <label class="toggle">
          <input name="is_current" type="checkbox">
          <span>Currently employed here</span>
        </label>

        <label class="toggle">
          <input name="is_overseas" type="checkbox">
          <span>This was overseas / OFW employment</span>
        </label>

        <label data-overseas-only hidden>
          <span>Deployment / Hiring Type</span>
          <select name="deployment_type" disabled>
            <option value="">Select type</option>
            <option value="licensed_agency">Licensed Recruitment Agency</option>
            <option value="direct_hire">Direct Hire</option>
            <option value="government_to_government">Government-to-Government</option>
            <option value="name_hire">Name Hire</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label data-overseas-only hidden>
          <span>Agency / Program</span>
          <input name="agency_or_program" maxlength="190" disabled>
        </label>

        <label class="span-2">
          <span>Notes</span>
          <textarea name="notes" rows="3" maxlength="2000"></textarea>
        </label>
      </div>

      <div class="nurselink-employment-editor-status" aria-live="polite"></div>

      <div class="nurselink-employment-editor-actions">
        <button type="button" class="secondary-button cancel">Cancel</button>
        <button type="submit" class="primary-button">
          ${record ? 'Save Changes' : 'Add Employment Record'}
        </button>
      </div>
    `;

    const set = (name, value) => {
      const field = form.elements.namedItem(name);
      if (!field) return;

      if (field instanceof HTMLInputElement && field.type === 'checkbox') {
        field.checked = !!value;
      } else if (value !== null && value !== undefined) {
        field.value = String(value);
      }
    };

    if (record) {
      [
        'employer_name', 'facility_type', 'country', 'city', 'position',
        'specialty', 'employment_type', 'start_date', 'end_date',
        'deployment_type', 'agency_or_program', 'notes'
      ].forEach(name => set(name, record[name]));

      set('is_current', record.is_current);
      set('is_overseas', record.is_overseas);
    }

    form.elements.namedItem('is_current')
      ?.addEventListener('change', () => syncEmploymentForm(form));

    form.elements.namedItem('is_overseas')
      ?.addEventListener('change', () => syncEmploymentForm(form));

    syncEmploymentForm(form);
    return form;
  }

  function renderEmployment(root, rows) {
    const list = root.querySelector('.nurselink-employment-list');
    const empty = root.querySelector('.nurselink-employment-empty');
    const count = root.querySelector('.nurselink-employment-count');

    if (!list || !empty || !count) return;

    count.textContent = `${rows.length} record${rows.length === 1 ? '' : 's'}`;
    empty.hidden = rows.length > 0;
    list.innerHTML = '';

    rows.forEach(record => {
      const card = document.createElement('article');
      card.className = 'nurselink-employment-record';

      card.innerHTML = `
        <div class="nurselink-employment-record-head">
          <div class="icon">＋</div>
          <div>
            <strong>${nlV200Escape(record.position || 'Nursing position')}</strong>
            <span>${nlV200Escape(record.employer_name || 'Employer')}</span>
          </div>
          ${record.is_current ? '<em>Current</em>' : ''}
        </div>

        <div class="nurselink-employment-record-meta">
          <span>${record.city ? `${nlV200Escape(record.city)}, ` : ''}${nlV200Escape(record.country || '—')}</span>
          <span>${employmentMonth(record.start_date)} – ${record.is_current ? 'Present' : employmentMonth(record.end_date)}</span>
          ${record.specialty ? `<span>${nlV200Escape(record.specialty)}</span>` : ''}
          ${record.employment_type ? `<span>${employmentLabel(record.employment_type)}</span>` : ''}
          <span class="${record.is_overseas ? 'ofw' : ''}">
            ${record.is_overseas ? 'OFW / Overseas' : 'Local employment'}
          </span>
        </div>

        ${record.is_overseas && record.deployment_type ? `
          <div class="nurselink-employment-deployment">
            <span>Deployment</span>
            <strong>${employmentLabel(record.deployment_type)}</strong>
            ${record.agency_or_program ? `<small>${nlV200Escape(record.agency_or_program)}</small>` : ''}
          </div>
        ` : ''}

        <div class="nurselink-employment-record-actions">
          <button type="button" data-action="edit">Edit</button>
          <button type="button" data-action="delete">Remove</button>
        </div>
      `;

      card.querySelector('[data-action="edit"]')
        ?.addEventListener('click', () => openEmploymentEditor(root, record));

      card.querySelector('[data-action="delete"]')
        ?.addEventListener('click', async () => {
          if (!window.confirm(`Remove ${record.position || 'this record'} at ${record.employer_name || 'this employer'}?`)) {
            return;
          }

          try {
            await employmentRequest(`/${record.id}`, { method: 'DELETE' });
            await refreshEmployment(root);
          } catch (error) {
            const status = root.querySelector('.nurselink-employment-status');
            if (status) {
              status.textContent = error.message;
              status.dataset.tone = 'error';
            }
          }
        });

      list.appendChild(card);
    });
  }

  async function refreshEmployment(root) {
    const status = root?.querySelector('.nurselink-employment-status');

    if (status) {
      status.textContent = 'Loading employment history…';
      status.dataset.tone = 'loading';
    }

    try {
      const rows = await loadEmploymentHistory(true);
      renderEmployment(root, rows);

      if (status) {
        status.textContent = '';
        status.dataset.tone = '';
      }
    } catch (error) {
      if (status) {
        status.textContent = error.message;
        status.dataset.tone = 'error';
      }
    }
  }

  function openEmploymentEditor(root, record = null) {
    root.querySelector('.nurselink-employment-editor-wrap')?.remove();

    const wrap = document.createElement('div');
    wrap.className = 'nurselink-employment-editor-wrap';

    const form = employmentEditor(record);
    wrap.appendChild(form);

    root.querySelector('.nurselink-employment-controls')
      ?.insertAdjacentElement('afterend', wrap);

    const close = () => wrap.remove();

    form.querySelector('.nurselink-employment-editor-close')
      ?.addEventListener('click', close);

    form.querySelector('.cancel')
      ?.addEventListener('click', close);

    form.addEventListener('submit', async event => {
      event.preventDefault();

      if (!form.reportValidity()) return;

      const status = form.querySelector('.nurselink-employment-editor-status');
      const submit = form.querySelector('button[type="submit"]');

      if (status) {
        status.textContent = record ? 'Saving changes…' : 'Adding employment record…';
        status.dataset.tone = 'loading';
      }

      if (submit) submit.disabled = true;

      try {
        await employmentRequest(
          record ? `/${record.id}` : '',
          {
            method: record ? 'PUT' : 'POST',
            body: JSON.stringify(employmentPayload(form))
          }
        );

        close();
        await refreshEmployment(root);
      } catch (error) {
        if (status) {
          status.textContent = error.message;
          status.dataset.tone = 'error';
        }
      } finally {
        if (submit) submit.disabled = false;
      }
    });

    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function ensureEmploymentModule(page) {
    if (!page || routeSlug() !== 'profile' || applicationStepFromLocation() !== 4) return;

    let root = page.querySelector('.nurselink-employment-history');

    if (!root) {
      root = document.createElement('section');
      root.className = 'nurselink-employment-history';

      root.innerHTML = `
        <div class="nurselink-employment-heading">
          <div>
            <span>STEP 4 · EMPLOYMENT / OFW HISTORY</span>
            <h2>Your Nursing Employment History</h2>
            <p>Add each local or overseas nursing position separately.</p>
          </div>
          <div class="nurselink-employment-count">0 records</div>
        </div>

        <div class="nurselink-employment-controls">
          <button type="button" class="primary-button add">+ Add Employment Record</button>
          <a class="secondary-button" href="/smart-registration?nlstep=5">
            Upload supporting documents →
          </a>
        </div>

        <div class="nurselink-employment-status" aria-live="polite"></div>

        <div class="nurselink-employment-empty">
          <div>＋</div>
          <strong>No employment history added yet</strong>
          <p>Add your current or most recent nursing position first.</p>
        </div>

        <div class="nurselink-employment-list"></div>
      `;

      const context = page.querySelector('.nurselink-step-context');
      const form = page.querySelector('.profile-form');

      if (context) context.insertAdjacentElement('afterend', root);
      else if (form) form.insertAdjacentElement('beforebegin', root);
      else page.appendChild(root);

      root.querySelector('.add')
        ?.addEventListener('click', () => openEmploymentEditor(root));
    }

    refreshEmployment(root);
  }

  function compactApplicationStepper(page) {
    const journey = page?.querySelector('.nurselink-application-journey');
    if (!journey) return;

    journey.classList.add('nurselink-journey-compact');

    journey.querySelectorAll('.nurselink-journey-step-copy small')
      .forEach(el => {
        el.hidden = true;
      });
  }

  function enhanceSmartUploadDropzone(page) {
    if (!page || routeSlug() !== 'smart-registration') return;

    const input = page.querySelector('input[type="file"]');
    if (!input || input.closest('.nurselink-smart-dropzone')) return;

    const parent = input.parentElement;
    if (!parent) return;

    const zone = document.createElement('div');
    zone.className = 'nurselink-smart-dropzone';
    zone.innerHTML = `
      <div>⇧</div>
      <strong>Drag & drop your document here</strong>
      <span>or choose a file from your device</span>
      <small>PDF, JPG, JPEG, PNG or DOCX · maximum 15 MB</small>
    `;

    parent.insertBefore(zone, input);
    zone.appendChild(input);

    zone.addEventListener('dragover', event => {
      event.preventDefault();
      zone.classList.add('dragging');
    });

    zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));

    zone.addEventListener('drop', event => {
      event.preventDefault();
      zone.classList.remove('dragging');

      const file = event.dataTransfer?.files?.[0];
      if (!file) return;

      try {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_) {}
    });
  }

  async function enhanceReviewChecklist(page) {
    if (!page || routeSlug() !== 'application-status') return;

    let root = page.querySelector('.nurselink-review-checklist');

    if (!root) {
      root = document.createElement('section');
      root.className = 'nurselink-review-checklist';

      const context = page.querySelector('.nurselink-step-context');
      if (context) context.insertAdjacentElement('afterend', root);
      else page.insertBefore(root, page.firstChild);
    }

    let photo = null;
    let employment = [];

    try { photo = await loadProfilePhoto(); } catch (_) {}
    try { employment = await loadEmploymentHistory(); } catch (_) {}

    const items = [
      ['Profile Photo', photo ? 'Professional photo added' : 'Recommended before submission', photo ? 'complete' : 'attention', '/profile?nlstep=1'],
      ['Personal Information', 'Review identity, contact details and current address', 'review', '/profile?nlstep=1'],
      ['Professional Information', 'Review title and nursing experience', 'review', '/profile?nlstep=2'],
      ['Credentials & Licenses', 'Review PRC license, diploma and professional evidence', 'review', '/smart-registration?nlstep=3'],
      ['Employment / OFW History', employment.length ? `${employment.length} employment record${employment.length === 1 ? '' : 's'} added` : 'Add at least one employment record', employment.length ? 'complete' : 'attention', '/profile?nlstep=4'],
      ['Supporting Documents', 'Review uploaded evidence and missing information', 'review', '/smart-registration?nlstep=5']
    ];

    root.innerHTML = `
      <div class="nurselink-review-checklist-head">
        <span>APPLICATION READINESS</span>
        <strong>Review before you submit</strong>
        <p>Open any section below to confirm or complete your information.</p>
      </div>

      <div class="nurselink-review-checklist-grid">
        ${items.map(([title, detail, status, href]) => `
          <a href="${href}" class="nurselink-review-item" data-status="${status}">
            <span class="state">${status === 'complete' ? '✓' : status === 'attention' ? '!' : '→'}</span>
            <span class="copy">
              <strong>${title}</strong>
              <small>${detail}</small>
            </span>
            <span class="open">Review →</span>
          </a>
        `).join('')}
      </div>
    `;
  }

  function ensureStepNavigation(page) {
    if (!page || !isApplicantPortal()) return;

    const step = applicationStepFromLocation();
    if (!step || step === 6 || page.querySelector('.nurselink-step-actions')) return;

    const previous = APPLICATION_STEPS[step - 2];
    const next = APPLICATION_STEPS[step];

    const bar = document.createElement('div');
    bar.className = 'nurselink-step-actions';
    bar.innerHTML = `
      <div>${previous ? `<a class="secondary-button" href="${previous.href}">← Previous Step</a>` : ''}</div>
      <div>
        <span>Save any changes on this page before continuing.</span>
        ${next ? `<a class="primary-button" href="${next.href}">Continue to ${next.short} →</a>` : ''}
      </div>
    `;

    const target =
      (step === 4 && page.querySelector('.nurselink-employment-history')) ||
      page.querySelector('.profile-form');

    if (target) target.insertAdjacentElement('afterend', bar);
    else page.appendChild(bar);
  }

  function enhanceV150(page) {
    if (!page) return;
    compactApplicationStepper(page);
    enhanceSmartUploadDropzone(page);
    ensureEmploymentModule(page);
    ensureStepNavigation(page);
    enhanceReviewChecklist(page);
  }


  const CREDENTIAL_REGISTRY_API = 'https://api.amsertech.com/api/credential-registry';

  const credentialState = {
    loaded: false,
    loading: null,
    rows: [],
    error: null
  };

  async function credentialRequest(path = '', options = {}) {
    const method = (options.method || 'GET').toUpperCase();

    if (!['GET', 'HEAD'].includes(method)) {
      await ensureProfilePhotoCsrf();
    }

    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');

    if (!['GET', 'HEAD'].includes(method)) {
      const token = cookieValue('XSRF-TOKEN');
      if (token) headers.set('X-XSRF-TOKEN', token);

      if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
    }

    const response = await fetch(`${CREDENTIAL_REGISTRY_API}${path}`, {
      ...options,
      method,
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      let message = 'Unable to update credential.';

      try {
        const data = await response.json();

        if (data?.errors && typeof data.errors === 'object') {
          const first = Object.values(data.errors)[0];
          if (Array.isArray(first) && first[0]) message = first[0];
          else if (typeof first === 'string') message = first;
        } else if (data?.message) {
          message = data.message;
        }
      } catch (_) {}

      throw new Error(message);
    }

    return response.status === 204 ? null : response.json();
  }

  async function loadCredentialRegistry(force = false) {
    if (credentialState.loaded && !force) return credentialState.rows;
    if (credentialState.loading) return credentialState.loading;

    if (credentialState.error && !force) {
      throw credentialState.error;
    }

    if (force) {
      credentialState.error = null;
    }

    credentialState.loading = credentialRequest()
      .then(payload => {
        credentialState.rows = Array.isArray(payload?.data) ? payload.data : [];
        credentialState.loaded = true;
        credentialState.error = null;
        return credentialState.rows;
      })
      .catch(error => {
        credentialState.error = error;
        throw error;
      })
      .finally(() => {
        credentialState.loading = null;
      });

    return credentialState.loading;
  }

  function credentialTypeLabel(value) {
    const labels = {
      prc_license: 'PRC License',
      nursing_diploma: 'Nursing Diploma / Degree',
      international_license: 'International Nursing License',
      specialty_certification: 'Specialty Certification',
      training_certificate: 'Training Certificate',
      professional_membership: 'Professional Membership',
      language_certificate: 'Language Certificate',
      other: 'Other Credential'
    };

    return labels[value] || value || 'Credential';
  }

  function credentialStatusLabel(value) {
    const labels = {
      unverified: 'Unverified',
      pending: 'Pending Verification',
      verified: 'Verified',
      expired: 'Expired'
    };

    return labels[value] || value;
  }

  function credentialPayload(form) {
    const value = name => form.elements.namedItem(name)?.value?.trim?.() || '';

    return {
      credential_type: value('credential_type'),
      title: value('title'),
      issuing_body: value('issuing_body') || null,
      credential_number: value('credential_number') || null,
      country: value('country') || null,
      issue_date: value('issue_date') || null,
      expiry_date: value('expiry_date') || null,
      notes: value('notes') || null
    };
  }

  function credentialEditor(record = null) {
    const form = document.createElement('form');
    form.className = 'nurselink-credential-editor';

    form.innerHTML = `
      <div class="nurselink-credential-editor-head">
        <div>
          <span>PROFESSIONAL CREDENTIAL</span>
          <strong>${record ? 'Edit credential' : 'Add credential'}</strong>
          <p>Add structured credential details, then attach supporting evidence through Smart Registration.</p>
        </div>
        <button type="button" class="close" aria-label="Close">×</button>
      </div>

      <div class="nurselink-credential-grid">
        <label>
          <span>Credential Type *</span>
          <select name="credential_type" required>
            <option value="">Select type</option>
            <option value="prc_license">PRC License</option>
            <option value="nursing_diploma">Nursing Diploma / Degree</option>
            <option value="international_license">International Nursing License</option>
            <option value="specialty_certification">Specialty Certification</option>
            <option value="training_certificate">Training Certificate</option>
            <option value="professional_membership">Professional Membership</option>
            <option value="language_certificate">Language Certificate</option>
            <option value="other">Other Credential</option>
          </select>
        </label>

        <div class="nurselink-credential-review-state">
          <span>Verification Status</span>
          <strong>${credentialStatusLabel(record?.verification_status || 'unverified')}</strong>
          <small>
            Reviewer-controlled. Saving credential changes will require re-verification.
          </small>
        </div>

        <label class="span-2">
          <span>Credential Title *</span>
          <input name="title" maxlength="190" required placeholder="e.g. Registered Nurse Licensure">
        </label>

        <label>
          <span>Issuing Body</span>
          <input name="issuing_body" maxlength="190" placeholder="e.g. PRC">
        </label>

        <label>
          <span>Credential / License Number</span>
          <input name="credential_number" maxlength="160">
        </label>

        <label>
          <span>Country</span>
          <input name="country" maxlength="120">
        </label>

        <label>
          <span>Issue Date</span>
          <input name="issue_date" type="date">
        </label>

        <label>
          <span>Expiry Date</span>
          <input name="expiry_date" type="date">
        </label>

        <label class="span-2">
          <span>Notes</span>
          <textarea name="notes" rows="3" maxlength="2000"></textarea>
        </label>
      </div>

      <div class="nurselink-credential-editor-status" aria-live="polite"></div>

      <div class="nurselink-credential-editor-actions">
        <button type="button" class="secondary-button cancel">Cancel</button>
        <button type="submit" class="primary-button">
          ${record ? 'Save Changes' : 'Add Credential'}
        </button>
      </div>
    `;

    const set = (name, value) => {
      const field = form.elements.namedItem(name);
      if (field && value !== null && value !== undefined) field.value = String(value);
    };

    if (record) {
      [
        'credential_type', 'title', 'issuing_body',
        'credential_number', 'country', 'issue_date', 'expiry_date', 'notes'
      ].forEach(name => set(name, record[name]));
    }

    return form;
  }

  function credentialExpiryState(record) {
    if (!record.expiry_date) return '';

    const expiry = new Date(`${record.expiry_date}T00:00:00`);
    if (Number.isNaN(expiry.getTime())) return '';

    const days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);

    if (days < 0) return 'Expired';
    if (days <= 90) return `Expires in ${days} day${days === 1 ? '' : 's'}`;
    return '';
  }

  function renderCredentials(root, rows) {
    const list = root.querySelector('.nurselink-credential-list');
    const empty = root.querySelector('.nurselink-credential-empty');
    const count = root.querySelector('.nurselink-credential-count');

    if (!list || !empty || !count) return;

    count.textContent = `${rows.length} credential${rows.length === 1 ? '' : 's'}`;
    empty.hidden = rows.length > 0;
    list.innerHTML = '';

    rows.forEach(record => {
      const expiry = credentialExpiryState(record);
      const card = document.createElement('article');

      card.className = 'nurselink-credential-record';
      card.dataset.status = record.verification_status || 'unverified';

      card.innerHTML = `
        <div class="nurselink-credential-record-head">
          <div class="icon">✓</div>
          <div>
            <span>${credentialTypeLabel(record.credential_type)}</span>
            <strong>${nlV200Escape(record.title || credentialTypeLabel(record.credential_type))}</strong>
          </div>
          <em>${credentialStatusLabel(record.verification_status)}</em>
        </div>

        <div class="nurselink-credential-meta">
          ${record.issuing_body ? `<span>${nlV200Escape(record.issuing_body)}</span>` : ''}
          ${record.credential_number ? `<span>No. ${nlV200Escape(record.credential_number)}</span>` : ''}
          ${record.country ? `<span>${nlV200Escape(record.country)}</span>` : ''}
          ${record.expiry_date ? `<span>Expires ${record.expiry_date}</span>` : ''}
          ${expiry ? `<span class="expiry">${expiry}</span>` : ''}
        </div>

        <div class="nurselink-credential-actions">
          <a href="/smart-registration?nlstep=3">Upload evidence</a>
          <button type="button" data-action="edit">Edit</button>
          <button type="button" data-action="delete">Remove</button>
        </div>
      `;

      card.querySelector('[data-action="edit"]')
        ?.addEventListener('click', () => openCredentialEditor(root, record));

      card.querySelector('[data-action="delete"]')
        ?.addEventListener('click', async () => {
          if (!window.confirm(`Remove ${record.title || 'this credential'}?`)) return;

          try {
            await credentialRequest(`/${record.id}`, { method: 'DELETE' });
            await refreshCredentialRegistry(root, true);
          } catch (error) {
            const status = root.querySelector('.nurselink-credential-status');
            if (status) {
              status.textContent = error.message;
              status.dataset.tone = 'error';
            }
          }
        });

      list.appendChild(card);
    });
  }

  async function refreshCredentialRegistry(root, force = false) {
    const status = root?.querySelector('.nurselink-credential-status');

    if (status) {
      status.textContent = 'Loading credentials…';
      status.dataset.tone = 'loading';
    }

    try {
      const rows = await loadCredentialRegistry(force);
      renderCredentials(root, rows);

      if (root) {
        root.dataset.nurselinkCredentialsHydrated = '1';
      }

      if (status) {
        status.textContent = '';
        status.dataset.tone = '';
      }
    } catch (error) {
      if (root) {
        root.dataset.nurselinkCredentialsHydrated = 'error';
      }

      if (status) {
        status.textContent = error.message;
        status.dataset.tone = 'error';
      }
    }
  }

  function openCredentialEditor(root, record = null) {
    root.querySelector('.nurselink-credential-editor-wrap')?.remove();

    const wrap = document.createElement('div');
    wrap.className = 'nurselink-credential-editor-wrap';

    const form = credentialEditor(record);
    wrap.appendChild(form);

    root.querySelector('.nurselink-credential-controls')
      ?.insertAdjacentElement('afterend', wrap);

    const close = () => wrap.remove();

    form.querySelector('.close')?.addEventListener('click', close);
    form.querySelector('.cancel')?.addEventListener('click', close);

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const status = form.querySelector('.nurselink-credential-editor-status');
      const submit = form.querySelector('button[type="submit"]');

      if (status) {
        status.textContent = record ? 'Saving changes…' : 'Adding credential…';
        status.dataset.tone = 'loading';
      }

      if (submit) submit.disabled = true;

      try {
        await credentialRequest(
          record ? `/${record.id}` : '',
          {
            method: record ? 'PUT' : 'POST',
            body: JSON.stringify(credentialPayload(form))
          }
        );

        close();
        await refreshCredentialRegistry(root, true);
      } catch (error) {
        if (status) {
          status.textContent = error.message;
          status.dataset.tone = 'error';
        }
      } finally {
        if (submit) submit.disabled = false;
      }
    });

    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function ensureCredentialRegistry(page) {
    if (!page || routeSlug() !== 'smart-registration' || applicationStepFromLocation() !== 3) return;

    let root = page.querySelector('.nurselink-credential-registry');

    if (!root) {
      root = document.createElement('section');
      root.className = 'nurselink-credential-registry';

      root.innerHTML = `
        <div class="nurselink-credential-heading">
          <div>
            <span>STEP 3 · CREDENTIALS & LICENSES</span>
            <h2>Professional Credentials Registry</h2>
            <p>Add structured credential information here, then upload the supporting document below.</p>
          </div>
          <div class="nurselink-credential-count">0 credentials</div>
        </div>

        <div class="nurselink-credential-controls">
          <button type="button" class="primary-button add">+ Add Credential</button>
        </div>

        <div class="nurselink-credential-status" aria-live="polite"></div>

        <div class="nurselink-credential-empty">
          <div>✓</div>
          <strong>No structured credentials added yet</strong>
          <p>Start with your PRC license or nursing diploma.</p>
        </div>

        <div class="nurselink-credential-list"></div>
      `;

      const context = page.querySelector('.nurselink-step-context');
      if (context) context.insertAdjacentElement('afterend', root);
      else page.insertBefore(root, page.firstChild);

      root.querySelector('.add')
        ?.addEventListener('click', () => openCredentialEditor(root));
    }

    if (!root.dataset.nurselinkCredentialsHydrated) {
      root.dataset.nurselinkCredentialsHydrated = 'loading';
      refreshCredentialRegistry(root);
    }
  }

  async function enhanceCredentialReviewChecklist(page) {
    if (!page || routeSlug() !== 'application-status') return;

    let rows = [];

    try {
      rows = await loadCredentialRegistry();
    } catch (_) {}

    const item = page
      .querySelectorAll('.nurselink-review-item');

    item.forEach(card => {
      const title = card.querySelector('.copy strong')?.textContent?.trim();
      if (title !== 'Credentials & Licenses') return;

      const small = card.querySelector('.copy small');
      const state = card.querySelector('.state');

      if (rows.length) {
        card.dataset.status = 'complete';
        if (state) state.textContent = '✓';
        if (small) small.textContent = `${rows.length} structured credential${rows.length === 1 ? '' : 's'} added`;
      } else {
        card.dataset.status = 'attention';
        if (state) state.textContent = '!';
        if (small) small.textContent = 'Add at least your primary nursing credential';
      }
    });
  }

  function enhanceV160(page) {
    ensureCredentialRegistry(page);
    enhanceCredentialReviewChecklist(page);
  }


  /* =========================================================
     NurseLink v5.5.2 — Qualification Readiness
     Uses structured NurseLink data already owned by the member.
     This is an internal profile-readiness indicator, not a PRC,
     PQF, licensing-board or government qualification decision.
     ========================================================= */

  const qualificationReadinessState = {
    loaded: false,
    loading: null,
    data: null
  };

  function isApprovedMemberPortal() {
    if (
      document.documentElement.classList.contains(
        'nurselink-super-admin-test-mode'
      )
    ) {
      return true;
    }

    if (
      membershipState?.loaded
      && membershipState.data?.status === 'approved'
      && !membershipHasActiveStanding(membershipState.data)
    ) {
      return false;
    }

    if (isApplicantPortal()) return false;

    const shell = document.querySelector(ROOT_SELECTOR);
    if (!shell) return false;

    const sidebar = shell.querySelector('.sidebar');
    const sidebarText = (sidebar?.textContent || '').toLowerCase();

    return (
      sidebarText.includes('qualifications') ||
      sidebarText.includes('credentials') ||
      sidebarText.includes('portfolio') ||
      sidebarText.includes('learning')
    );
  }

  function primaryLicenseCredentials(rows) {
    return rows.filter(row =>
      ['prc_license', 'international_license'].includes(row.credential_type)
    );
  }

  function trainingCredentials(rows) {
    return rows.filter(row =>
      ['specialty_certification', 'training_certificate', 'language_certificate']
        .includes(row.credential_type)
    );
  }

  function qualificationReadinessFromData({ credentials, employment, photo }) {
    const rows = Array.isArray(credentials) ? credentials : [];
    const jobs = Array.isArray(employment) ? employment : [];

    const primary = primaryLicenseCredentials(rows);
    const education = rows.filter(row => row.credential_type === 'nursing_diploma');
    const specialty = trainingCredentials(rows);
    const verified = rows.filter(row => row.verification_status === 'verified');
    const pending = rows.filter(row => row.verification_status === 'pending');
    const overseas = jobs.filter(row => row.is_overseas);

    const sections = [
      {
        key: 'license',
        title: 'Primary Nursing License',
        weight: 20,
        score: primary.length ? 20 : 0,
        state: primary.length ? 'complete' : 'attention',
        detail: primary.length
          ? `${primary.length} primary license record${primary.length === 1 ? '' : 's'}`
          : 'Add your PRC or current nursing license',
        href: '/smart-registration?nlstep=3'
      },
      {
        key: 'education',
        title: 'Nursing Education',
        weight: 15,
        score: education.length ? 15 : 0,
        state: education.length ? 'complete' : 'attention',
        detail: education.length
          ? `${education.length} nursing education record${education.length === 1 ? '' : 's'}`
          : 'Add your nursing diploma or degree',
        href: '/smart-registration?nlstep=3'
      },
      {
        key: 'employment',
        title: 'Professional Experience',
        weight: 25,
        score: jobs.length >= 2 ? 25 : jobs.length === 1 ? 20 : 0,
        state: jobs.length ? 'complete' : 'attention',
        detail: jobs.length
          ? `${jobs.length} employment record${jobs.length === 1 ? '' : 's'}`
          : 'Add your nursing employment history',
        href: '/profile?nlstep=4'
      },
      {
        key: 'international',
        title: 'International / OFW Experience',
        weight: 10,
        score: overseas.length ? 10 : 0,
        state: overseas.length ? 'complete' : 'optional',
        detail: overseas.length
          ? `${overseas.length} overseas employment record${overseas.length === 1 ? '' : 's'}`
          : 'Optional: add overseas / OFW nursing experience',
        href: '/profile?nlstep=4'
      },
      {
        key: 'specialty',
        title: 'Specialty & Continuing Development',
        weight: 10,
        score: specialty.length >= 2 ? 10 : specialty.length === 1 ? 7 : 0,
        state: specialty.length ? 'complete' : 'optional',
        detail: specialty.length
          ? `${specialty.length} training or specialty credential${specialty.length === 1 ? '' : 's'}`
          : 'Add trainings, specialty or language credentials',
        href: '/smart-registration?nlstep=3'
      },
      {
        key: 'verification',
        title: 'Credential Verification',
        weight: 15,
        score: verified.length
          ? Math.min(15, 8 + Math.min(7, verified.length * 2))
          : pending.length
            ? 5
            : 0,
        state: verified.length ? 'complete' : pending.length ? 'pending' : 'attention',
        detail: verified.length
          ? `${verified.length} verified credential${verified.length === 1 ? '' : 's'}`
          : pending.length
            ? `${pending.length} credential${pending.length === 1 ? '' : 's'} pending verification`
            : 'No verified credentials yet',
        href: '/smart-registration?nlstep=3'
      },
      {
        key: 'photo',
        title: 'Professional Profile Photo',
        weight: 5,
        score: photo ? 5 : 0,
        state: photo ? 'complete' : 'optional',
        detail: photo ? 'Profile photo added' : 'Add a professional profile photo',
        href: '/profile?nlstep=1'
      }
    ];

    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(sections.reduce((sum, section) => sum + section.score, 0))
      )
    );

    const level =
      score >= 90 ? 'Excellent' :
      score >= 75 ? 'Strong' :
      score >= 55 ? 'Developing' :
      'Getting Started';

    const next = sections.find(section =>
      ['attention', 'pending'].includes(section.state)
    ) || sections.find(section => section.state === 'optional') || null;

    return {
      score,
      level,
      sections,
      credentials: rows,
      employment: jobs,
      photo: !!photo,
      counts: {
        credentials: rows.length,
        employment: jobs.length,
        verified: verified.length,
        overseas: overseas.length
      },
      next
    };
  }

  async function loadQualificationReadiness(force = false) {
    if (qualificationReadinessState.loaded && !force) {
      return qualificationReadinessState.data;
    }

    if (qualificationReadinessState.loading && !force) {
      return qualificationReadinessState.loading;
    }

    qualificationReadinessState.loading = Promise.all([
      loadCredentialRegistry(force).catch(() => []),
      loadEmploymentHistory(force).catch(() => []),
      loadProfilePhoto(force).catch(() => null)
    ])
      .then(([credentials, employment, photo]) => {
        const data = qualificationReadinessFromData({
          credentials,
          employment,
          photo
        });

        qualificationReadinessState.loaded = true;
        qualificationReadinessState.data = data;
        return data;
      })
      .finally(() => {
        qualificationReadinessState.loading = null;
      });

    return qualificationReadinessState.loading;
  }

  function qualificationRingStyle(score) {
    return `${Math.max(0, Math.min(100, Number(score) || 0)) * 3.6}deg`;
  }

  function createQualificationReadiness(data) {
    const section = document.createElement('section');
    section.className = 'nurselink-qualification-readiness';
    section.style.setProperty(
      '--nurselink-qualification-progress',
      qualificationRingStyle(data.score)
    );

    section.innerHTML = `
      <div class="nurselink-readiness-hero">
        <div class="nurselink-readiness-copy">
          <span>PROFESSIONAL READINESS</span>
          <h2>NurseLink Qualification Readiness</h2>
          <p>
            A practical view of how complete your NurseLink professional profile is
            based on the credentials, nursing experience and verification information
            currently stored in your account.
          </p>

          <div class="nurselink-readiness-actions">
            ${data.next ? `
              <a class="primary-button" href="${data.next.href}">
                Improve ${data.next.title} →
              </a>
            ` : ''}
            <a class="secondary-button" href="/profile">Review Profile</a>
          </div>
        </div>

        <div class="nurselink-readiness-score-card">
          <div class="nurselink-readiness-ring" aria-label="${data.score}% NurseLink readiness">
            <div>
              <strong>${data.score}%</strong>
              <span>${data.level}</span>
            </div>
          </div>
          <small>NurseLink readiness indicator</small>
        </div>
      </div>

      <div class="nurselink-readiness-metrics">
        <div>
          <span>Credentials</span>
          <strong>${data.counts.credentials}</strong>
        </div>
        <div>
          <span>Verified</span>
          <strong>${data.counts.verified}</strong>
        </div>
        <div>
          <span>Employment Records</span>
          <strong>${data.counts.employment}</strong>
        </div>
        <div>
          <span>Overseas / OFW</span>
          <strong>${data.counts.overseas}</strong>
        </div>
      </div>

      <div class="nurselink-readiness-grid">
        ${data.sections.map(item => `
          <a
            href="${item.href}"
            class="nurselink-readiness-item"
            data-state="${item.state}"
          >
            <span class="nurselink-readiness-item-state">
              ${item.state === 'complete' ? '✓' :
                item.state === 'pending' ? '…' :
                item.state === 'attention' ? '!' : '+'}
            </span>

            <span class="nurselink-readiness-item-copy">
              <strong>${item.title}</strong>
              <small>${item.detail}</small>
            </span>

            <span class="nurselink-readiness-item-score">
              ${item.score}/${item.weight}
            </span>
          </a>
        `).join('')}
      </div>

      <div class="nurselink-readiness-disclaimer">
        <strong>Important:</strong>
        This score is an internal NurseLink profile-readiness indicator. It is not
        a PRC, Professional Regulation Commission, Philippine Qualifications
        Framework, employer, licensing-board or government qualification decision.
      </div>
    `;

    return section;
  }

  async function enhanceQualificationReadiness(page) {
    if (
      !page ||
      routeSlug() !== 'qualifications' ||
      !isApprovedMemberPortal() ||
      document.documentElement.classList.contains('nurselink-member-locked')
    ) {
      return;
    }

    page.classList.add('nurselink-approved-qualifications');

    let root = page.querySelector('.nurselink-qualification-readiness');

    const loading = page.querySelector('.nurselink-readiness-loading');

    if (!root && !loading) {
      const placeholder = document.createElement('section');
      placeholder.className = 'nurselink-readiness-loading';
      placeholder.innerHTML = `
        <div></div>
        <strong>Preparing your professional readiness profile…</strong>
      `;

      const header = page.querySelector('.page-header');
      if (header) header.insertAdjacentElement('afterend', placeholder);
      else page.insertBefore(placeholder, page.firstChild);
    }

    const data = await loadQualificationReadiness();

    page.querySelector('.nurselink-readiness-loading')?.remove();

    root = page.querySelector('.nurselink-qualification-readiness');
    const nextRoot = createQualificationReadiness(data);

    if (root) root.replaceWith(nextRoot);
    else {
      const header = page.querySelector('.page-header');
      if (header) header.insertAdjacentElement('afterend', nextRoot);
      else page.insertBefore(nextRoot, page.firstChild);
    }
  }

  function enhanceV170(page) {
    enhanceQualificationReadiness(page);
  }


  /* =========================================================
     NurseLink v5.5.2 — Approved Member Dashboard
     ========================================================= */

  function memberDisplayName() {
    const chip = document.querySelector('.user-chip');
    if (!chip) return '';

    const clone = chip.cloneNode(true);
    clone.querySelectorAll('.avatar, small, span, em').forEach(el => el.remove());

    return (clone.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function memberModuleCards() {
    return [
      {
        href: '/profile',
        icon: '◉',
        title: 'Professional Profile',
        text: 'Keep your identity, professional information and employment history current.'
      },
      {
        href: '/qualifications',
        icon: '✓',
        title: 'Qualification Readiness',
        text: 'Review your NurseLink professional readiness and the areas that need strengthening.'
      },
      {
        href: '/credentials',
        icon: '◆',
        title: 'Credentials',
        text: 'Manage your approved member credentials and verification records.'
      },
      {
        href: '/documents',
        icon: '▤',
        title: 'Documents',
        text: 'Access professional evidence and important member documents.'
      },
      {
        href: '/portfolio',
        icon: '▣',
        title: 'Professional Portfolio',
        text: 'Build a professional record of your work, achievements and nursing experience.'
      },
      {
        href: '/learning',
        icon: '◫',
        title: 'Learning',
        text: 'Continue professional development and strengthen your future readiness.'
      },
      {
        href: '/jobs',
        icon: '↗',
        title: 'Jobs & Opportunities',
        text: 'Explore suitable nursing and professional opportunities.'
      },
      {
        href: '/events',
        icon: '◇',
        title: 'Events & Community',
        text: 'Stay connected with NurseLink professional and community activities.'
      },
      {
        href: '/mentoring',
        icon: '◎',
        title: 'Mentoring',
        text: 'Connect with professional guidance, peer support and mentoring.'
      }
    ];
  }

  function memberNextRecommendation(data) {
    if (data?.next) {
      return {
        href: data.next.href,
        title: data.next.title,
        text: data.next.detail
      };
    }

    return {
      href: '/learning',
      title: 'Continue Professional Development',
      text: 'Your core profile is strong. Continue building skills and professional evidence.'
    };
  }

  async function enhanceApprovedMemberDashboard(page) {
    if (
      !page ||
      routeSlug() !== 'dashboard' ||
      !isApprovedMemberPortal()
    ) {
      return;
    }

    page.classList.add('nurselink-approved-member-dashboard');

    let root = page.querySelector('.nurselink-member-hub');

    if (!root) {
      root = document.createElement('section');
      root.className = 'nurselink-member-hub nurselink-member-hub-loading';
      root.innerHTML = `
        <div class="nurselink-member-hub-loader"></div>
        <strong>Preparing your NurseLink member dashboard…</strong>
      `;

      const header = page.querySelector('.page-header');
      if (header) header.insertAdjacentElement('afterend', root);
      else page.insertBefore(root, page.firstChild);
    }

    const data = await loadQualificationReadiness();
    const recommendation = memberNextRecommendation(data);
    const name = memberDisplayName();

    root.className = 'nurselink-member-hub';
    root.style.setProperty(
      '--nurselink-member-progress',
      qualificationRingStyle(data.score)
    );

    root.innerHTML = `
      <div class="nurselink-member-welcome">
        <div>
          <span>APPROVED MEMBER</span>
          <h2>${name ? `Welcome, ${name}` : 'Welcome to your NurseLink Member Hub'}</h2>
          <p>
            Manage your professional profile, qualifications, credentials,
            opportunities and continuing development from one place.
          </p>

          <div class="nurselink-member-welcome-actions">
            <a class="primary-button" href="${recommendation.href}">
              ${data.score >= 90 ? 'Continue Professional Growth' : 'Improve Professional Readiness'} →
            </a>
            <a class="secondary-button" href="/profile">View Profile</a>
          </div>
        </div>

        <div class="nurselink-member-readiness-mini">
          <div class="nurselink-member-readiness-ring">
            <div>
              <strong>${data.score}%</strong>
              <span>Readiness</span>
            </div>
          </div>
          <small>${data.level}</small>
        </div>
      </div>

      <div class="nurselink-member-status-row">
        <div>
          <span>Credentials</span>
          <strong>${data.counts.credentials}</strong>
          <small>${data.counts.verified} verified</small>
        </div>
        <div>
          <span>Employment</span>
          <strong>${data.counts.employment}</strong>
          <small>${data.counts.overseas} overseas / OFW</small>
        </div>
        <div>
          <span>Profile Photo</span>
          <strong>${data.photo ? 'Added' : 'Missing'}</strong>
          <small>${data.photo ? 'Profile identity ready' : 'Recommended'}</small>
        </div>
        <div>
          <span>Next Focus</span>
          <strong>${recommendation.title}</strong>
          <small>${recommendation.text}</small>
        </div>
      </div>

      <div class="nurselink-member-section-head">
        <div>
          <span>YOUR NURSELINK</span>
          <strong>Professional tools and member services</strong>
        </div>
        <a href="/qualifications">View readiness →</a>
      </div>

      <div class="nurselink-member-module-grid">
        ${memberModuleCards().map(module => `
          <a href="${module.href}" class="nurselink-member-module-card">
            <span class="nurselink-member-module-icon">${module.icon}</span>
            <span class="nurselink-member-module-copy">
              <strong>${module.title}</strong>
              <small>${module.text}</small>
            </span>
            <span class="nurselink-member-module-arrow">→</span>
          </a>
        `).join('')}
      </div>

      <div class="nurselink-member-note">
        <strong>Your professional information stays connected.</strong>
        Updates to your credentials, employment history and profile automatically
        improve the readiness information shown across NurseLink.
      </div>
    `;
  }

  function enhanceV180(page) {
    enhanceApprovedMemberDashboard(page);
  }


  const PORTFOLIO_API = 'https://api.amsertech.com/api/portfolio-items';

  const portfolioState = {
    loaded: false,
    loading: null,
    rows: []
  };

  async function portfolioRequest(path = '', options = {}) {
    const method = (options.method || 'GET').toUpperCase();

    if (!['GET', 'HEAD'].includes(method)) {
      await ensureProfilePhotoCsrf();
    }

    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');

    if (!['GET', 'HEAD'].includes(method)) {
      const token = cookieValue('XSRF-TOKEN');
      if (token) headers.set('X-XSRF-TOKEN', token);

      if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
    }

    const response = await fetch(`${PORTFOLIO_API}${path}`, {
      ...options,
      method,
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      let message = 'Unable to update portfolio.';

      try {
        const data = await response.json();

        if (data?.errors && typeof data.errors === 'object') {
          const first = Object.values(data.errors)[0];
          if (Array.isArray(first) && first[0]) message = first[0];
          else if (typeof first === 'string') message = first;
        } else if (data?.message) {
          message = data.message;
        }
      } catch (_) {}

      throw new Error(message);
    }

    return response.status === 204 ? null : response.json();
  }

  async function loadPortfolioItems(force = false) {
    if (portfolioState.loaded && !force) return portfolioState.rows;
    if (portfolioState.loading && !force) return portfolioState.loading;

    portfolioState.loading = portfolioRequest()
      .then(payload => {
        portfolioState.rows = Array.isArray(payload?.data) ? payload.data : [];
        portfolioState.loaded = true;
        return portfolioState.rows;
      })
      .finally(() => {
        portfolioState.loading = null;
      });

    return portfolioState.loading;
  }

  function portfolioTypeLabel(value) {
    const labels = {
      achievement: 'Achievement',
      leadership: 'Leadership',
      research: 'Research',
      project: 'Professional Project',
      training: 'Training / Development',
      volunteer: 'Volunteer Work',
      recognition: 'Recognition / Award',
      publication: 'Publication',
      community_service: 'Community Service',
      other: 'Other'
    };

    return labels[value] || value || 'Portfolio Item';
  }

  function portfolioVisibilityLabel(value) {
    return ({
      private: 'Private',
      members: 'NurseLink Members',
      public: 'Public'
    })[value] || value;
  }

  function portfolioPayload(form) {
    const value = name => form.elements.namedItem(name)?.value?.trim?.() || '';
    const checked = name => !!form.elements.namedItem(name)?.checked;

    return {
      item_type: value('item_type'),
      title: value('title'),
      organization: value('organization') || null,
      location: value('location') || null,
      start_date: value('start_date') || null,
      end_date: value('end_date') || null,
      description: value('description') || null,
      reference_url: value('reference_url') || null,
      visibility: value('visibility') || 'members',
      is_featured: checked('is_featured')
    };
  }

  function portfolioEditor(record = null) {
    const form = document.createElement('form');
    form.className = 'nurselink-portfolio-editor';

    form.innerHTML = `
      <div class="nurselink-portfolio-editor-head">
        <div>
          <span>DIGITAL NURSE PROFILE</span>
          <strong>${record ? 'Edit portfolio item' : 'Add portfolio item'}</strong>
          <p>Document professional achievements, leadership, research, service and meaningful nursing work.</p>
        </div>
        <button type="button" class="close" aria-label="Close">×</button>
      </div>

      <div class="nurselink-portfolio-grid">
        <label>
          <span>Item Type *</span>
          <select name="item_type" required>
            <option value="">Select type</option>
            <option value="achievement">Achievement</option>
            <option value="leadership">Leadership</option>
            <option value="research">Research</option>
            <option value="project">Professional Project</option>
            <option value="training">Training / Development</option>
            <option value="volunteer">Volunteer Work</option>
            <option value="recognition">Recognition / Award</option>
            <option value="publication">Publication</option>
            <option value="community_service">Community Service</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label>
          <span>Visibility</span>
          <select name="visibility">
            <option value="members">NurseLink Members</option>
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </label>

        <label class="span-2">
          <span>Title *</span>
          <input name="title" maxlength="190" required>
        </label>

        <label>
          <span>Organization / Institution</span>
          <input name="organization" maxlength="190">
        </label>

        <label>
          <span>Location</span>
          <input name="location" maxlength="190">
        </label>

        <label>
          <span>Start Date</span>
          <input name="start_date" type="date">
        </label>

        <label>
          <span>End Date</span>
          <input name="end_date" type="date">
        </label>

        <label class="span-2">
          <span>Description</span>
          <textarea name="description" rows="5" maxlength="5000"></textarea>
        </label>

        <label class="span-2">
          <span>Reference URL</span>
          <input name="reference_url" type="url" maxlength="512" placeholder="https://">
        </label>

        <label class="toggle span-2">
          <input name="is_featured" type="checkbox">
          <span>Feature this item on my NurseLink professional profile</span>
        </label>
      </div>

      <div class="nurselink-portfolio-editor-status" aria-live="polite"></div>

      <div class="nurselink-portfolio-editor-actions">
        <button type="button" class="secondary-button cancel">Cancel</button>
        <button type="submit" class="primary-button">
          ${record ? 'Save Changes' : 'Add to Portfolio'}
        </button>
      </div>
    `;

    const set = (name, value) => {
      const field = form.elements.namedItem(name);
      if (!field) return;

      if (field instanceof HTMLInputElement && field.type === 'checkbox') {
        field.checked = !!value;
      } else if (value !== null && value !== undefined) {
        field.value = String(value);
      }
    };

    if (record) {
      [
        'item_type', 'visibility', 'title', 'organization', 'location',
        'start_date', 'end_date', 'description', 'reference_url'
      ].forEach(name => set(name, record[name]));

      set('is_featured', record.is_featured);
    }

    return form;
  }

  function portfolioDateRange(record) {
    const start = record.start_date ? employmentMonth(record.start_date) : '';
    const end = record.end_date ? employmentMonth(record.end_date) : '';

    if (start && end) return `${start} – ${end}`;
    return start || end || '';
  }

  function renderPortfolio(root, rows) {
    const list = root.querySelector('.nurselink-portfolio-list');
    const empty = root.querySelector('.nurselink-portfolio-empty');
    const count = root.querySelector('.nurselink-portfolio-count');

    if (!list || !empty || !count) return;

    const featuredCount = rows.filter(row => row.is_featured).length;

    count.textContent =
      `${rows.length} item${rows.length === 1 ? '' : 's'} · ${featuredCount} featured`;

    empty.hidden = rows.length > 0;
    list.innerHTML = '';

    rows.forEach(record => {
      const card = document.createElement('article');
      card.className = 'nurselink-portfolio-item';

      card.innerHTML = `
        <div class="nurselink-portfolio-item-head">
          <span class="icon">◆</span>
          <div>
            <span>${portfolioTypeLabel(record.item_type)}</span>
            <strong>${nlV200Escape(record.title)}</strong>
          </div>
          ${record.is_featured ? '<em>Featured</em>' : ''}
        </div>

        <div class="nurselink-portfolio-item-meta">
          ${record.organization ? `<span>${nlV200Escape(record.organization)}</span>` : ''}
          ${record.location ? `<span>${nlV200Escape(record.location)}</span>` : ''}
          ${portfolioDateRange(record) ? `<span>${portfolioDateRange(record)}</span>` : ''}
          <span>${portfolioVisibilityLabel(record.visibility)}</span>
        </div>

        ${record.description ? `<p>${nlV200Escape(record.description)}</p>` : ''}

        <div class="nurselink-portfolio-item-actions">
          ${record.reference_url ? `<a href="${nlV200Escape(record.reference_url)}" target="_blank" rel="noopener noreferrer">View Reference ↗</a>` : ''}
          <button type="button" data-action="edit">Edit</button>
          <button type="button" data-action="delete">Remove</button>
        </div>
      `;

      card.querySelector('[data-action="edit"]')
        ?.addEventListener('click', () => openPortfolioEditor(root, record));

      card.querySelector('[data-action="delete"]')
        ?.addEventListener('click', async () => {
          if (!window.confirm(`Remove "${nlV200Escape(record.title)}" from your portfolio?`)) return;

          try {
            await portfolioRequest(`/${record.id}`, { method: 'DELETE' });
            await refreshPortfolio(root);
          } catch (error) {
            const status = root.querySelector('.nurselink-portfolio-status');
            if (status) {
              status.textContent = error.message;
              status.dataset.tone = 'error';
            }
          }
        });

      list.appendChild(card);
    });
  }

  async function refreshPortfolio(root) {
    const status = root?.querySelector('.nurselink-portfolio-status');

    if (status) {
      status.textContent = 'Loading professional portfolio…';
      status.dataset.tone = 'loading';
    }

    try {
      const rows = await loadPortfolioItems(true);
      renderPortfolio(root, rows);

      if (status) {
        status.textContent = '';
        status.dataset.tone = '';
      }
    } catch (error) {
      if (status) {
        status.textContent = error.message;
        status.dataset.tone = 'error';
      }
    }
  }

  function openPortfolioEditor(root, record = null) {
    root.querySelector('.nurselink-portfolio-editor-wrap')?.remove();

    const wrap = document.createElement('div');
    wrap.className = 'nurselink-portfolio-editor-wrap';

    const form = portfolioEditor(record);
    wrap.appendChild(form);

    root.querySelector('.nurselink-portfolio-controls')
      ?.insertAdjacentElement('afterend', wrap);

    const close = () => wrap.remove();

    form.querySelector('.close')?.addEventListener('click', close);
    form.querySelector('.cancel')?.addEventListener('click', close);

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const status = form.querySelector('.nurselink-portfolio-editor-status');
      const submit = form.querySelector('button[type="submit"]');

      if (status) {
        status.textContent = record ? 'Saving changes…' : 'Adding portfolio item…';
        status.dataset.tone = 'loading';
      }

      if (submit) submit.disabled = true;

      try {
        await portfolioRequest(
          record ? `/${record.id}` : '',
          {
            method: record ? 'PUT' : 'POST',
            body: JSON.stringify(portfolioPayload(form))
          }
        );

        close();
        await refreshPortfolio(root);
      } catch (error) {
        if (status) {
          status.textContent = error.message;
          status.dataset.tone = 'error';
        }
      } finally {
        if (submit) submit.disabled = false;
      }
    });

    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function ensureProfessionalPortfolio(page) {
    if (!page || routeSlug() !== 'portfolio' || !isApprovedMemberPortal()) return;

    page.classList.add('nurselink-professional-portfolio-page');

    let root = page.querySelector('.nurselink-professional-portfolio');

    if (!root) {
      root = document.createElement('section');
      root.className = 'nurselink-professional-portfolio';

      root.innerHTML = `
        <div class="nurselink-portfolio-heading">
          <div>
            <span>PROFESSIONAL PORTFOLIO</span>
            <h2>Your Digital Nurse Profile</h2>
            <p>
              Build a professional record beyond licenses and employment.
              Highlight leadership, achievements, research, projects, training,
              service and recognitions that show the full story of your nursing career.
            </p>
          </div>
          <div class="nurselink-portfolio-count">0 items</div>
        </div>

        <div class="nurselink-portfolio-controls">
          <button type="button" class="primary-button add">+ Add Portfolio Item</button>
          <a class="secondary-button" href="/qualifications">View Qualification Readiness →</a>
        </div>

        <div class="nurselink-portfolio-status" aria-live="polite"></div>

        <div class="nurselink-portfolio-empty">
          <div>◆</div>
          <strong>Your professional portfolio is ready to grow</strong>
          <p>Add an achievement, leadership role, project, recognition or community contribution.</p>
        </div>

        <div class="nurselink-portfolio-list"></div>
      `;

      const header = page.querySelector('.page-header');
      if (header) header.insertAdjacentElement('afterend', root);
      else page.insertBefore(root, page.firstChild);

      root.querySelector('.add')
        ?.addEventListener('click', () => openPortfolioEditor(root));
    }

    refreshPortfolio(root);
  }

  async function enhanceMemberDashboardPortfolio(page) {
    if (!page || routeSlug() !== 'dashboard' || !isApprovedMemberPortal()) return;

    let rows = [];

    try {
      rows = await loadPortfolioItems();
    } catch (_) {}

    const hub = page.querySelector('.nurselink-member-hub');
    if (!hub) return;

    let summary = hub.querySelector('.nurselink-member-portfolio-summary');

    if (!summary) {
      summary = document.createElement('div');
      summary.className = 'nurselink-member-portfolio-summary';
      hub.appendChild(summary);
    }

    const featured = rows.filter(row => row.is_featured);

    summary.innerHTML = `
      <div>
        <span>PROFESSIONAL PORTFOLIO</span>
        <strong>${rows.length} portfolio item${rows.length === 1 ? '' : 's'}</strong>
        <small>${featured.length} featured on your Digital Nurse Profile</small>
      </div>
      <a href="/portfolio">
        ${rows.length ? 'Manage Portfolio →' : 'Start Your Portfolio →'}
      </a>
    `;
  }

  function enhanceV190(page) {
    ensureProfessionalPortfolio(page);
    enhanceMemberDashboardPortfolio(page);
  }

  /* =========================================================
     NurseLink v5.5.2 — Career Matching + Learning / CPD
     ========================================================= */

  const CAREER_PREFERENCES_API = 'https://api.amsertech.com/api/career-preferences';
  const LEARNING_RECORDS_API = 'https://api.amsertech.com/api/learning-records';

  const NURSELINK_SECURITY_V300 = 'standalone-routing-v321';

  function nlV200Escape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const careerState = { loaded: false, loading: null, data: null };
  const learningState = { loaded: false, loading: null, rows: [] };

  async function nurselinkJson(base, path = '', options = {}) {
    const method = (options.method || 'GET').toUpperCase();

    if (!['GET', 'HEAD'].includes(method)) {
      await ensureProfilePhotoCsrf();
    }

    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');

    if (!['GET', 'HEAD'].includes(method)) {
      const token = cookieValue('XSRF-TOKEN');
      if (token) headers.set('X-XSRF-TOKEN', token);
      if (typeof options.body === 'string' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
    }

    const response = await fetch(`${base}${path}`, {
      ...options,
      method,
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      let message = 'Unable to save your NurseLink information.';
      try {
        const data = await response.json();
        if (data?.errors && typeof data.errors === 'object') {
          const first = Object.values(data.errors)[0];
          if (Array.isArray(first) && first[0]) message = first[0];
          else if (typeof first === 'string') message = first;
        } else if (data?.message) {
          message = data.message;
        }
      } catch (_) {}
      throw new Error(message);
    }

    return response.status === 204 ? null : response.json();
  }

  async function loadCareerPreferences(force = false) {
    if (careerState.loaded && !force) return careerState.data;
    if (careerState.loading && !force) return careerState.loading;

    careerState.loading = nurselinkJson(CAREER_PREFERENCES_API)
      .then(payload => {
        careerState.data = payload?.data || null;
        careerState.loaded = true;
        return careerState.data;
      })
      .finally(() => { careerState.loading = null; });

    return careerState.loading;
  }

  function splitCareerValues(value) {
    return String(value || '')
      .split(/[,;\n]/)
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  function careerReadiness(data) {
    if (!data) return { score: 0, label: 'Not Set Up' };

    const checks = [
      !!data.career_stage,
      !!data.desired_roles?.length,
      !!data.specialties?.length,
      !!data.target_countries?.length,
      !!data.work_settings?.length,
      !!data.employment_types?.length,
      !!data.available_from,
      !!String(data.career_goal || '').trim()
    ];

    const score = Math.round(checks.filter(Boolean).length / checks.length * 100);
    return {
      score,
      label: score >= 90 ? 'Match Ready' : score >= 70 ? 'Strong' : score >= 45 ? 'Developing' : 'Getting Started'
    };
  }

  function careerForm(data = null) {
    const form = document.createElement('form');
    form.className = 'nurselink-career-editor';
    form.innerHTML = `
      <div class="nurselink-v200-editor-head">
        <div>
          <span>CAREER MATCHING PROFILE</span>
          <strong>Tell NurseLink what opportunity fits you</strong>
          <p>This profile prepares future matching. It does not submit an employer application.</p>
        </div>
        <button type="button" class="close" aria-label="Close">×</button>
      </div>

      <div class="nurselink-v200-grid">
        <label><span>Career Stage</span><select name="career_stage">
          <option value="">Select stage</option>
          <option value="new_graduate">New Graduate</option>
          <option value="early_career">Early Career</option>
          <option value="mid_career">Mid-Career</option>
          <option value="senior">Senior / Experienced Nurse</option>
          <option value="leadership">Leadership / Management</option>
          <option value="returning_ofw">Returning OFW Nurse</option>
          <option value="career_transition">Career Transition</option>
        </select></label>

        <label><span>Available From</span><input name="available_from" type="date"></label>

        <label class="span-2"><span>Desired Roles</span><input name="desired_roles" placeholder="Staff Nurse, Nurse Educator, Head Nurse"><small>Separate multiple values with commas.</small></label>
        <label class="span-2"><span>Preferred Specialties</span><input name="specialties" placeholder="ICU, Emergency, Pediatrics"></label>
        <label class="span-2"><span>Target Countries / Locations</span><input name="target_countries" placeholder="Philippines, Saudi Arabia, Germany"></label>

        <fieldset class="span-2"><legend>Preferred Work Settings</legend><div class="nurselink-v200-checks">
          ${[['hospital','Hospital'],['clinic','Clinic'],['community','Community'],['home_care','Home Care'],['long_term_care','Long-term Care'],['education','Education / Academe'],['occupational_health','Occupational Health'],['telehealth','Telehealth'],['government','Government'],['other','Other']].map(([v,l]) => `<label><input type="checkbox" name="work_settings" value="${v}"><span>${l}</span></label>`).join('')}
        </div></fieldset>

        <fieldset class="span-2"><legend>Employment Types</legend><div class="nurselink-v200-checks">
          ${[['full_time','Full-time'],['part_time','Part-time'],['contract','Contract'],['temporary','Temporary'],['project_based','Project-based'],['other','Other']].map(([v,l]) => `<label><input type="checkbox" name="employment_types" value="${v}"><span>${l}</span></label>`).join('')}
        </div></fieldset>

        <label class="toggle"><input type="checkbox" name="open_to_overseas"><span>Open to overseas opportunities</span></label>
        <label class="toggle"><input type="checkbox" name="open_to_relocation"><span>Open to relocation</span></label>
        <label class="toggle"><input type="checkbox" name="open_to_telehealth"><span>Open to telehealth / remote nursing</span></label>
        <div></div>

        <label><span>Preferred Currency</span><input name="preferred_currency" maxlength="8" placeholder="PHP, USD, SAR"></label>
        <label><span>Minimum Monthly Compensation</span><input name="minimum_monthly_compensation" type="number" min="0" step="0.01"></label>
        <label class="span-2"><span>Career Goal</span><textarea name="career_goal" rows="4" maxlength="3000"></textarea></label>
      </div>

      <div class="nurselink-v200-status" aria-live="polite"></div>
      <div class="nurselink-v200-editor-actions">
        <button type="button" class="secondary-button cancel">Cancel</button>
        <button type="submit" class="primary-button">Save Career Profile</button>
      </div>`;

    if (data) {
      const set = (name, value) => {
        const field = form.elements.namedItem(name);
        if (field && value !== null && value !== undefined) field.value = String(value);
      };
      set('career_stage', data.career_stage);
      set('available_from', data.available_from);
      set('desired_roles', (data.desired_roles || []).join(', '));
      set('specialties', (data.specialties || []).join(', '));
      set('target_countries', (data.target_countries || []).join(', '));
      set('preferred_currency', data.preferred_currency);
      set('minimum_monthly_compensation', data.minimum_monthly_compensation);
      set('career_goal', data.career_goal);
      ['open_to_overseas','open_to_relocation','open_to_telehealth'].forEach(name => {
        const field = form.elements.namedItem(name);
        if (field instanceof HTMLInputElement) field.checked = !!data[name];
      });
      form.querySelectorAll('input[name="work_settings"]').forEach(el => el.checked = data.work_settings?.includes(el.value) || false);
      form.querySelectorAll('input[name="employment_types"]').forEach(el => el.checked = data.employment_types?.includes(el.value) || false);
    }

    return form;
  }

  function careerPayload(form) {
    const value = name => form.elements.namedItem(name)?.value?.trim?.() || '';
    return {
      desired_roles: splitCareerValues(value('desired_roles')),
      specialties: splitCareerValues(value('specialties')),
      target_countries: splitCareerValues(value('target_countries')),
      work_settings: Array.from(form.querySelectorAll('input[name="work_settings"]:checked')).map(el => el.value),
      employment_types: Array.from(form.querySelectorAll('input[name="employment_types"]:checked')).map(el => el.value),
      open_to_overseas: !!form.elements.namedItem('open_to_overseas')?.checked,
      open_to_relocation: !!form.elements.namedItem('open_to_relocation')?.checked,
      open_to_telehealth: !!form.elements.namedItem('open_to_telehealth')?.checked,
      available_from: value('available_from') || null,
      preferred_currency: value('preferred_currency') || null,
      minimum_monthly_compensation: value('minimum_monthly_compensation') ? Number(value('minimum_monthly_compensation')) : null,
      career_stage: value('career_stage') || null,
      career_goal: value('career_goal') || null
    };
  }

  function renderCareerProfile(root, data) {
    const readiness = careerReadiness(data);
    root.style.setProperty('--nurselink-career-progress', `${readiness.score * 3.6}deg`);
    const body = root.querySelector('.nurselink-career-body');
    if (!body) return;

    body.innerHTML = `
      <div class="nurselink-career-readiness">
        <div class="nurselink-career-ring"><div><strong>${readiness.score}%</strong><span>${readiness.label}</span></div></div>
        <div><span>JOB MATCHING READINESS</span><strong>${data ? 'Career preferences saved' : 'Create your career matching profile'}</strong><p>Build a clearer picture of the roles, locations and work settings you want.</p></div>
      </div>
      ${data ? `<div class="nurselink-career-summary">
        <div><span>Roles</span><strong>${nlV200Escape(data.desired_roles?.join(', ') || 'Not specified')}</strong></div>
        <div><span>Specialties</span><strong>${nlV200Escape(data.specialties?.join(', ') || 'Not specified')}</strong></div>
        <div><span>Target Locations</span><strong>${nlV200Escape(data.target_countries?.join(', ') || 'Not specified')}</strong></div>
        <div><span>Available</span><strong>${nlV200Escape(data.available_from || 'Not specified')}</strong></div>
      </div>` : ''}
      <div class="nurselink-v200-actions"><button type="button" class="primary-button edit">${data ? 'Edit Career Profile' : 'Create Career Profile'}</button><a class="secondary-button" href="/qualifications">Review Professional Readiness →</a></div>`;

    body.querySelector('.edit')?.addEventListener('click', () => openCareerEditor(root, data));
  }

  function openCareerEditor(root, data) {
    root.querySelector('.nurselink-career-editor-wrap')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'nurselink-career-editor-wrap';
    const form = careerForm(data);
    wrap.appendChild(form);
    root.appendChild(wrap);
    const close = () => wrap.remove();
    form.querySelector('.close')?.addEventListener('click', close);
    form.querySelector('.cancel')?.addEventListener('click', close);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const status = form.querySelector('.nurselink-v200-status');
      const submit = form.querySelector('button[type="submit"]');
      if (status) status.textContent = 'Saving career profile…';
      if (submit) submit.disabled = true;
      try {
        const payload = await nurselinkJson(CAREER_PREFERENCES_API, '', { method: 'PUT', body: JSON.stringify(careerPayload(form)) });
        careerState.loaded = true;
        careerState.data = payload?.data || null;
        close();
        renderCareerProfile(root, careerState.data);
      } catch (error) {
        if (status) { status.textContent = error.message; status.dataset.tone = 'error'; }
      } finally { if (submit) submit.disabled = false; }
    });
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function enhanceCareerMatching(page) {
    if (!page || routeSlug() !== 'jobs' || !isApprovedMemberPortal()) return;
    let root = page.querySelector('.nurselink-career-matching');
    if (!root) {
      root = document.createElement('section');
      root.className = 'nurselink-career-matching';
      root.innerHTML = `<div class="nurselink-v200-heading"><span>CAREER MATCHING</span><h2>Your NurseLink Career Profile</h2><p>Define the nursing roles, specialties, locations and work settings you want NurseLink to use for future opportunity matching.</p></div><div class="nurselink-career-body"><div class="nurselink-v200-loading">Loading career preferences…</div></div>`;
      const header = page.querySelector('.page-header');
      if (header) header.insertAdjacentElement('afterend', root); else page.insertBefore(root, page.firstChild);
    }
    try { renderCareerProfile(root, await loadCareerPreferences()); }
    catch (error) { root.querySelector('.nurselink-career-body').innerHTML = `<div class="nurselink-v200-error">${error.message}</div>`; }
  }

  async function loadLearningRecords(force = false) {
    if (learningState.loaded && !force) return learningState.rows;
    if (learningState.loading && !force) return learningState.loading;
    learningState.loading = nurselinkJson(LEARNING_RECORDS_API)
      .then(payload => {
        learningState.rows = Array.isArray(payload?.data) ? payload.data : [];
        learningState.loaded = true;
        return learningState.rows;
      })
      .finally(() => { learningState.loading = null; });
    return learningState.loading;
  }

  function learningSummary(rows) {
    const completed = rows.filter(row => row.status === 'completed');
    return {
      total: rows.length,
      completed: completed.length,
      hours: completed.reduce((sum, row) => sum + Number(row.learning_hours || 0), 0),
      units: completed.reduce((sum, row) => sum + Number(row.cpd_units || 0), 0)
    };
  }

  function learningForm(record = null) {
    const form = document.createElement('form');
    form.className = 'nurselink-learning-editor';
    form.innerHTML = `
      <div class="nurselink-v200-editor-head"><div><span>LEARNING & DEVELOPMENT</span><strong>${record ? 'Edit learning record' : 'Add learning record'}</strong><p>CPD units are self-reported unless independently verified.</p></div><button type="button" class="close" aria-label="Close">×</button></div>
      <div class="nurselink-v200-grid">
        <label><span>Learning Type *</span><select name="learning_type" required><option value="">Select type</option><option value="course">Course</option><option value="webinar">Webinar</option><option value="workshop">Workshop</option><option value="conference">Conference</option><option value="certification">Certification</option><option value="self_study">Self-study</option><option value="mentoring">Mentoring</option><option value="other">Other</option></select></label>
        <label><span>Status *</span><select name="status" required><option value="planned">Planned</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></select></label>
        <label class="span-2"><span>Title *</span><input name="title" maxlength="190" required></label>
        <label><span>Provider / Organization</span><input name="provider" maxlength="190"></label>
        <label><span>Topic / Specialty</span><input name="topic" maxlength="160"></label>
        <label><span>Start Date</span><input name="started_at" type="date"></label>
        <label><span>Completion Date</span><input name="completed_at" type="date"></label>
        <label><span>Learning Hours</span><input name="learning_hours" type="number" min="0" step="0.25"></label>
        <label><span>CPD Units</span><input name="cpd_units" type="number" min="0" step="0.25"><small>Self-reported unless verified.</small></label>
        <label class="span-2"><span>Certificate / Reference URL</span><input name="certificate_url" type="url" maxlength="512" placeholder="https://"></label>
        <label class="span-2"><span>Notes</span><textarea name="notes" rows="4" maxlength="3000"></textarea></label>
      </div>
      <div class="nurselink-v200-status" aria-live="polite"></div>
      <div class="nurselink-v200-editor-actions"><button type="button" class="secondary-button cancel">Cancel</button><button type="submit" class="primary-button">${record ? 'Save Changes' : 'Add Learning Record'}</button></div>`;
    if (record) {
      ['learning_type','status','title','provider','topic','started_at','completed_at','learning_hours','cpd_units','certificate_url','notes'].forEach(name => {
        const field = form.elements.namedItem(name);
        if (field && record[name] !== null && record[name] !== undefined) field.value = String(record[name]);
      });
    }
    return form;
  }

  function learningPayload(form) {
    const value = name => form.elements.namedItem(name)?.value?.trim?.() || '';
    return {
      learning_type: value('learning_type'), title: value('title'), provider: value('provider') || null,
      topic: value('topic') || null, status: value('status'), started_at: value('started_at') || null,
      completed_at: value('completed_at') || null, learning_hours: value('learning_hours') ? Number(value('learning_hours')) : null,
      cpd_units: value('cpd_units') ? Number(value('cpd_units')) : null, certificate_url: value('certificate_url') || null,
      notes: value('notes') || null
    };
  }

  function renderLearning(root, rows) {
    const summary = learningSummary(rows);
    const metrics = root.querySelector('.nurselink-learning-metrics');
    if (metrics) metrics.innerHTML = `<div><span>Total Records</span><strong>${summary.total}</strong></div><div><span>Completed</span><strong>${summary.completed}</strong></div><div><span>Learning Hours</span><strong>${summary.hours.toFixed(1)}</strong></div><div><span>Self-Reported CPD</span><strong>${summary.units.toFixed(1)}</strong></div>`;
    const list = root.querySelector('.nurselink-learning-list');
    const empty = root.querySelector('.nurselink-learning-empty');
    if (!list || !empty) return;
    list.innerHTML = '';
    empty.hidden = rows.length > 0;
    const typeLabel = v => ({course:'Course',webinar:'Webinar',workshop:'Workshop',conference:'Conference',certification:'Certification',self_study:'Self-study',mentoring:'Mentoring',other:'Other'})[v] || v;
    const statusLabel = v => ({planned:'Planned',in_progress:'In Progress',completed:'Completed'})[v] || v;
    rows.forEach(record => {
      const card = document.createElement('article');
      card.className = 'nurselink-learning-record';
      card.dataset.status = record.status;
      card.innerHTML = `<div class="nurselink-learning-record-head"><span class="icon">◫</span><div><span>${typeLabel(record.learning_type)}</span><strong>${nlV200Escape(record.title)}</strong></div><em>${statusLabel(record.status)}</em></div><div class="nurselink-learning-meta">${record.provider ? `<span>${nlV200Escape(record.provider)}</span>` : ''}${record.topic ? `<span>${nlV200Escape(record.topic)}</span>` : ''}${record.learning_hours !== null ? `<span>${Number(record.learning_hours).toFixed(1)} hours</span>` : ''}${record.cpd_units !== null ? `<span>${Number(record.cpd_units).toFixed(1)} CPD units*</span>` : ''}</div>${record.notes ? `<p>${nlV200Escape(record.notes)}</p>` : ''}<div class="nurselink-learning-record-actions">${record.certificate_url ? `<a href="${record.certificate_url}" target="_blank" rel="noopener noreferrer">View Reference ↗</a>` : ''}<button type="button" data-action="edit">Edit</button><button type="button" data-action="delete">Remove</button></div>`;
      card.querySelector('[data-action="edit"]')?.addEventListener('click', () => openLearningEditor(root, record));
      card.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
        if (!window.confirm(`Remove "${nlV200Escape(record.title)}" from your learning records?`)) return;
        await nurselinkJson(LEARNING_RECORDS_API, `/${record.id}`, { method: 'DELETE' });
        refreshLearning(root);
      });
      list.appendChild(card);
    });
  }

  async function refreshLearning(root) {
    const status = root.querySelector('.nurselink-learning-status');
    if (status) status.textContent = 'Loading learning records…';
    try { renderLearning(root, await loadLearningRecords(true)); if (status) status.textContent = ''; }
    catch (error) { if (status) { status.textContent = error.message; status.dataset.tone = 'error'; } }
  }

  function openLearningEditor(root, record = null) {
    root.querySelector('.nurselink-learning-editor-wrap')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'nurselink-learning-editor-wrap';
    const form = learningForm(record);
    wrap.appendChild(form);
    root.querySelector('.nurselink-learning-controls')?.insertAdjacentElement('afterend', wrap);
    const close = () => wrap.remove();
    form.querySelector('.close')?.addEventListener('click', close);
    form.querySelector('.cancel')?.addEventListener('click', close);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const status = form.querySelector('.nurselink-v200-status');
      const submit = form.querySelector('button[type="submit"]');
      if (status) status.textContent = record ? 'Saving changes…' : 'Adding learning record…';
      if (submit) submit.disabled = true;
      try {
        await nurselinkJson(LEARNING_RECORDS_API, record ? `/${record.id}` : '', { method: record ? 'PUT' : 'POST', body: JSON.stringify(learningPayload(form)) });
        close();
        await refreshLearning(root);
      } catch (error) { if (status) { status.textContent = error.message; status.dataset.tone = 'error'; } }
      finally { if (submit) submit.disabled = false; }
    });
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function enhanceLearningTracker(page) {
    if (!page || routeSlug() !== 'learning' || !isApprovedMemberPortal()) return;
    let root = page.querySelector('.nurselink-learning-tracker');
    if (!root) {
      root = document.createElement('section');
      root.className = 'nurselink-learning-tracker';
      root.innerHTML = `<div class="nurselink-v200-heading"><span>LEARNING & DEVELOPMENT</span><h2>Your Professional Learning Record</h2><p>Track continuing education, training and development. CPD units shown here are self-reported unless separately verified.</p></div><div class="nurselink-learning-metrics"><div><span>Total Records</span><strong>0</strong></div><div><span>Completed</span><strong>0</strong></div><div><span>Learning Hours</span><strong>0.0</strong></div><div><span>Self-Reported CPD</span><strong>0.0</strong></div></div><div class="nurselink-learning-controls"><button type="button" class="primary-button add">+ Add Learning Record</button><a class="secondary-button" href="/qualifications">View Qualification Readiness →</a></div><div class="nurselink-learning-status" aria-live="polite"></div><div class="nurselink-learning-empty"><div>◫</div><strong>Start your professional learning record</strong><p>Add a course, webinar, workshop, conference or other learning activity.</p></div><div class="nurselink-learning-list"></div><div class="nurselink-learning-disclaimer">* CPD units entered in NurseLink are self-reported unless the issuing or accrediting body has independently verified them. NurseLink does not replace PRC or other official CPD records.</div>`;
      const header = page.querySelector('.page-header');
      if (header) header.insertAdjacentElement('afterend', root); else page.insertBefore(root, page.firstChild);
      root.querySelector('.add')?.addEventListener('click', () => openLearningEditor(root));
    }
    refreshLearning(root);
  }

  async function enhanceMemberHubV200(page) {
    if (!page || routeSlug() !== 'dashboard' || !isApprovedMemberPortal()) return;
    const hub = page.querySelector('.nurselink-member-hub');
    if (!hub) return;
    let career = null, learning = [];
    try { career = await loadCareerPreferences(); } catch (_) {}
    try { learning = await loadLearningRecords(); } catch (_) {}
    const c = careerReadiness(career);
    const l = learningSummary(learning);
    let strip = hub.querySelector('.nurselink-member-v200-strip');
    if (!strip) { strip = document.createElement('div'); strip.className = 'nurselink-member-v200-strip'; hub.appendChild(strip); }
    strip.innerHTML = `<a href="/jobs"><span>CAREER MATCHING</span><strong>${c.score}% ready</strong><small>${c.label}</small></a><a href="/learning"><span>PROFESSIONAL LEARNING</span><strong>${l.completed} completed</strong><small>${l.hours.toFixed(1)} hours · ${l.units.toFixed(1)} self-reported CPD</small></a>`;
  }

  function enhanceV200(page) {
    enhanceCareerMatching(page);
    enhanceLearningTracker(page);
    enhanceMemberHubV200(page);
  }


  /* =========================================================
     NurseLink v2.1/v2.2 — Explainable Matching + Applications
     ========================================================= */

  if (typeof nurseLinkJsonRequest !== 'function') {
    throw new Error('NurseLink core JSON request helper failed to initialize.');
  }

  const JOB_MATCHES_API = 'https://api.amsertech.com/api/job-opportunities';
  const SAVED_JOBS_API = 'https://api.amsertech.com/api/saved-jobs';
  const JOB_APPLICATIONS_API = 'https://api.amsertech.com/api/job-applications';

  const opportunityState = {
    jobs: [],
    saved: new Set(),
    applications: [],
    loaded: false
  };

  async function loadOpportunityCenter(force = false) {
    if (opportunityState.loaded && !force) return opportunityState;

    const [jobsPayload, savedPayload, appsPayload] = await Promise.all([
      nurseLinkJsonRequest(JOB_MATCHES_API),
      nurseLinkJsonRequest(SAVED_JOBS_API),
      nurseLinkJsonRequest(JOB_APPLICATIONS_API)
    ]);

    opportunityState.jobs = Array.isArray(jobsPayload?.data) ? jobsPayload.data : [];
    opportunityState.saved = new Set(
      Array.isArray(savedPayload?.data) ? savedPayload.data.map(Number) : []
    );
    opportunityState.applications = Array.isArray(appsPayload?.data) ? appsPayload.data : [];
    opportunityState.loaded = true;

    return opportunityState;
  }

  function applicationForJob(jobId) {
    return opportunityState.applications.find(
      app => Number(app.job_opportunity_id) === Number(jobId)
    ) || null;
  }

  function matchBand(score) {
    if (score >= 85) return 'Excellent Match';
    if (score >= 70) return 'Strong Match';
    if (score >= 50) return 'Possible Match';
    return 'Explore';
  }

  function jobSalary(job) {
    if (job.salary_min === null && job.salary_max === null) return '';

    const currency = job.salary_currency || '';
    const fmt = value => {
      if (value === null || value === undefined) return '';
      return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
    };

    if (job.salary_min !== null && job.salary_max !== null) {
      return `${currency} ${fmt(job.salary_min)} – ${fmt(job.salary_max)}`;
    }

    if (job.salary_min !== null) return `${currency} ${fmt(job.salary_min)}+`;
    return `Up to ${currency} ${fmt(job.salary_max)}`;
  }

  function jobApplicationStatus(value) {
    return ({
      submitted: 'Submitted',
      under_review: 'Under Review',
      shortlisted: 'Shortlisted',
      interview: 'Interview',
      offer: 'Offer',
      declined: 'Closed',
      withdrawn: 'Withdrawn'
    })[value] || value;
  }

  function openApplicationDialog(root, job) {
    root.querySelector('.nurselink-job-apply-wrap')?.remove();

    const wrap = document.createElement('div');
    wrap.className = 'nurselink-job-apply-wrap';

    wrap.innerHTML = `
      <form class="nurselink-job-apply-form">
        <div class="nurselink-job-apply-head">
          <div>
            <span>APPLICATION TRACKER</span>
            <strong>${nlV200Escape(job.title)}</strong>
            <small>${nlV200Escape(job.employer_name)} · ${job.city ? `${nlV200Escape(job.city)}, ` : ''}${nlV200Escape(job.country)}</small>
          </div>
          <button type="button" class="close" aria-label="Close">×</button>
        </div>

        <p>
          Add this opportunity to your NurseLink application tracker. If the employer
          uses an external application website, complete that external application
          separately using the link provided.
        </p>

        <label>
          <span>Application / Cover Note</span>
          <textarea name="cover_note" rows="5" maxlength="5000" placeholder="Optional note for your own NurseLink application record."></textarea>
        </label>

        <div class="nurselink-job-apply-status" aria-live="polite"></div>

        <div class="nurselink-job-apply-actions">
          <button type="button" class="secondary-button cancel">Cancel</button>
          <button type="submit" class="primary-button">Track Application</button>
        </div>
      </form>
    `;

    root.querySelector('.nurselink-opportunity-controls')
      ?.insertAdjacentElement('afterend', wrap);

    const form = wrap.querySelector('form');
    const close = () => wrap.remove();

    form.querySelector('.close')?.addEventListener('click', close);
    form.querySelector('.cancel')?.addEventListener('click', close);

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const status = form.querySelector('.nurselink-job-apply-status');
      const submit = form.querySelector('button[type="submit"]');

      status.textContent = 'Adding application to your tracker…';
      status.dataset.tone = 'loading';
      submit.disabled = true;

      try {
        await nurseLinkJsonRequest(JOB_APPLICATIONS_API, '', {
          method: 'POST',
          body: JSON.stringify({
            job_opportunity_id: Number(job.id),
            cover_note: form.elements.namedItem('cover_note')?.value?.trim() || null
          })
        });

        opportunityState.loaded = false;
        await loadOpportunityCenter(true);
        renderOpportunityMatches(root);
        close();
      } catch (error) {
        status.textContent = error.message;
        status.dataset.tone = 'error';
      } finally {
        submit.disabled = false;
      }
    });

    wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function toggleSavedJob(root, jobId) {
    const saved = opportunityState.saved.has(Number(jobId));

    await nurseLinkJsonRequest(
      SAVED_JOBS_API,
      `/${jobId}`,
      { method: saved ? 'DELETE' : 'POST' }
    );

    if (saved) opportunityState.saved.delete(Number(jobId));
    else opportunityState.saved.add(Number(jobId));

    renderOpportunityMatches(root);
  }

  function renderOpportunityMatches(root) {
    const list = root.querySelector('.nurselink-opportunity-list');
    const empty = root.querySelector('.nurselink-opportunity-empty');
    const summary = root.querySelector('.nurselink-opportunity-summary');

    if (!list || !empty || !summary) return;

    const jobs = opportunityState.jobs;
    const strong = jobs.filter(job => Number(job.match_score) >= 70).length;
    const tracked = opportunityState.applications.filter(app => app.status !== 'withdrawn').length;

    summary.innerHTML = `
      <div><span>Active Opportunities</span><strong>${jobs.length}</strong></div>
      <div><span>Strong Matches</span><strong>${strong}</strong></div>
      <div><span>Saved Jobs</span><strong>${opportunityState.saved.size}</strong></div>
      <div><span>Tracked Applications</span><strong>${tracked}</strong></div>
    `;

    empty.hidden = jobs.length > 0;
    list.innerHTML = '';

    jobs.forEach(job => {
      const card = document.createElement('article');
      const saved = opportunityState.saved.has(Number(job.id));
      const application = applicationForJob(job.id);

      card.className = 'nurselink-opportunity-card';
      card.dataset.band =
        Number(job.match_score) >= 85 ? 'excellent' :
        Number(job.match_score) >= 70 ? 'strong' :
        Number(job.match_score) >= 50 ? 'possible' : 'explore';

      card.innerHTML = `
        <div class="nurselink-opportunity-card-head">
          <div class="nurselink-opportunity-match">
            <strong>${Number(job.match_score)}%</strong>
            <span>${matchBand(Number(job.match_score))}</span>
          </div>

          <div class="nurselink-opportunity-title">
            <span>${nlV200Escape(job.reference_code)}</span>
            <strong>${nlV200Escape(job.title)}</strong>
            <small>${nlV200Escape(job.employer_name)}</small>
          </div>

          <button type="button" class="save" aria-pressed="${saved}">
            ${saved ? '★ Saved' : '☆ Save'}
          </button>
        </div>

        <div class="nurselink-opportunity-meta">
          <span>${job.city ? `${nlV200Escape(job.city)}, ` : ''}${nlV200Escape(job.country)}</span>
          ${job.specialty ? `<span>${nlV200Escape(job.specialty)}</span>` : ''}
          ${job.work_setting ? `<span>${employmentLabel(job.work_setting)}</span>` : ''}
          ${job.employment_type ? `<span>${employmentLabel(job.employment_type)}</span>` : ''}
          ${jobSalary(job) ? `<span>${jobSalary(job)}</span>` : ''}
          ${job.overseas_opportunity ? '<span class="overseas">Overseas</span>' : ''}
        </div>

        ${job.description ? `<p>${nlV200Escape(job.description)}</p>` : ''}

        <div class="nurselink-opportunity-explain">
          <div>
            <span>WHY IT MATCHES</span>
            <ul>
              ${(job.match_reasons?.length ? job.match_reasons : ['Complete your Career Profile to improve matching.'])
                .slice(0, 4)
                .map(reason => `<li>${reason}</li>`)
                .join('')}
            </ul>
          </div>

          ${job.match_gaps?.length ? `
            <div class="gaps">
              <span>CHECK BEFORE APPLYING</span>
              <ul>
                ${job.match_gaps.slice(0, 3).map(gap => `<li>${gap}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <div class="nurselink-opportunity-actions">
          ${application ? `
            <a href="/applications" class="application-status" data-status="${application.status}">
              ${jobApplicationStatus(application.status)} →
            </a>
          ` : `
            <button type="button" class="primary-button apply">Track Application</button>
          `}

          ${job.apply_url ? `
            <a href="${nlV200Escape(job.apply_url)}" target="_blank" rel="noopener noreferrer" class="secondary-button">
              Employer Application ↗
            </a>
          ` : ''}
        </div>
      `;

      card.querySelector('.save')
        ?.addEventListener('click', async () => {
          try {
            await toggleSavedJob(root, job.id);
          } catch (error) {
            window.alert(error.message);
          }
        });

      card.querySelector('.apply')
        ?.addEventListener('click', () => openApplicationDialog(root, job));

      list.appendChild(card);
    });
  }

  async function enhanceOpportunityMatches(page) {
    if (!page || routeSlug() !== 'jobs' || !isApprovedMemberPortal()) return;

    let root = page.querySelector('.nurselink-opportunity-center');

    if (!root) {
      root = document.createElement('section');
      root.className = 'nurselink-opportunity-center';

      root.innerHTML = `
        <div class="nurselink-opportunity-heading">
          <div>
            <span>OPPORTUNITY MATCHING</span>
            <h2>Jobs matched to your NurseLink profile</h2>
            <p>
              Match scores are explainable indicators based on your recorded preferences,
              credentials, licenses and professional experience. They are not hiring decisions.
            </p>
          </div>
          <a href="/applications">View Applications →</a>
        </div>

        <div class="nurselink-opportunity-summary">
          <div><span>Active Opportunities</span><strong>0</strong></div>
          <div><span>Strong Matches</span><strong>0</strong></div>
          <div><span>Saved Jobs</span><strong>0</strong></div>
          <div><span>Tracked Applications</span><strong>0</strong></div>
        </div>

        <div class="nurselink-opportunity-controls">
          <a class="secondary-button" href="/qualifications">Professional Readiness</a>
          <a class="secondary-button" href="/profile?nlstep=4">Employment History</a>
        </div>

        <div class="nurselink-opportunity-empty">
          <div>↗</div>
          <strong>No active opportunities are loaded yet</strong>
          <p>
            Your Career Matching Profile is ready. NurseLink will rank opportunities
            here as verified job records are added to the platform.
          </p>
        </div>

        <div class="nurselink-opportunity-list"></div>

        <div class="nurselink-opportunity-disclaimer">
          Match percentages help organize opportunities. They do not guarantee employer
          eligibility, interview selection, licensing approval, visa approval or employment.
        </div>
      `;

      const career = page.querySelector('.nurselink-career-matching');
      if (career) career.insertAdjacentElement('afterend', root);
      else {
        const header = page.querySelector('.page-header');
        if (header) header.insertAdjacentElement('afterend', root);
        else page.insertBefore(root, page.firstChild);
      }
    }

    try {
      await loadOpportunityCenter();
      renderOpportunityMatches(root);
    } catch (error) {
      const empty = root.querySelector('.nurselink-opportunity-empty');
      if (empty) {
        empty.hidden = false;
        empty.querySelector('strong').textContent = 'Opportunity matching could not be loaded';
        empty.querySelector('p').textContent = error.message;
      }
    }
  }

  function applicationPipelineCounts(rows) {
    const result = {
      total: rows.length,
      active: 0,
      interview: 0,
      offers: 0
    };

    rows.forEach(row => {
      if (!['withdrawn', 'declined'].includes(row.status)) result.active++;
      if (row.status === 'interview') result.interview++;
      if (row.status === 'offer') result.offers++;
    });

    return result;
  }

  async function withdrawTrackedApplication(root, id) {
    if (!window.confirm('Withdraw this application from your NurseLink tracker?')) return;

    await nurseLinkJsonRequest(JOB_APPLICATIONS_API, `/${id}/withdraw`, {
      method: 'PATCH'
    });

    opportunityState.loaded = false;
    await loadOpportunityCenter(true);
    renderApplicationsPipeline(root);
  }

  function renderApplicationsPipeline(root) {
    const rows = opportunityState.applications;
    const metrics = root.querySelector('.nurselink-app-pipeline-metrics');
    const list = root.querySelector('.nurselink-app-pipeline-list');
    const empty = root.querySelector('.nurselink-app-pipeline-empty');

    const counts = applicationPipelineCounts(rows);

    metrics.innerHTML = `
      <div><span>Total Tracked</span><strong>${counts.total}</strong></div>
      <div><span>Active</span><strong>${counts.active}</strong></div>
      <div><span>Interviews</span><strong>${counts.interview}</strong></div>
      <div><span>Offers</span><strong>${counts.offers}</strong></div>
    `;

    empty.hidden = rows.length > 0;
    list.innerHTML = '';

    rows.forEach(app => {
      const card = document.createElement('article');
      card.className = 'nurselink-app-pipeline-card';
      card.dataset.status = app.status;

      card.innerHTML = `
        <div class="nurselink-app-pipeline-card-head">
          <div>
            <span>${nlV200Escape(app.reference_code)}</span>
            <strong>${nlV200Escape(app.title)}</strong>
            <small>${nlV200Escape(app.employer_name)} · ${app.city ? `${nlV200Escape(app.city)}, ` : ''}${nlV200Escape(app.country)}</small>
          </div>

          <em>${jobApplicationStatus(app.status)}</em>
        </div>

        <div class="nurselink-app-pipeline-meta">
          ${app.specialty ? `<span>${nlV200Escape(app.specialty)}</span>` : ''}
          ${app.employment_type ? `<span>${employmentLabel(app.employment_type)}</span>` : ''}
          ${app.submitted_at ? `<span>Tracked ${String(app.submitted_at).slice(0, 10)}</span>` : ''}
        </div>

        ${app.cover_note ? `<p>${nlV200Escape(app.cover_note)}</p>` : ''}

        <div class="nurselink-app-pipeline-actions">
          <a href="/jobs">View Job Matches</a>
          ${app.apply_url ? `<a href="${nlV200Escape(app.apply_url)}" target="_blank" rel="noopener noreferrer">Employer Site ↗</a>` : ''}
          ${!['withdrawn', 'declined'].includes(app.status)
            ? '<button type="button" class="withdraw">Withdraw</button>'
            : ''}
        </div>
      `;

      card.querySelector('.withdraw')
        ?.addEventListener('click', async () => {
          try {
            await withdrawTrackedApplication(root, app.id);
          } catch (error) {
            window.alert(error.message);
          }
        });

      list.appendChild(card);
    });
  }

  async function enhanceApplicationsPipeline(page) {
    if (!page || routeSlug() !== 'applications' || !isApprovedMemberPortal()) return;

    let root = page.querySelector('.nurselink-applications-pipeline');

    if (!root) {
      root = document.createElement('section');
      root.className = 'nurselink-applications-pipeline';

      root.innerHTML = `
        <div class="nurselink-app-pipeline-heading">
          <div>
            <span>APPLICATIONS</span>
            <h2>Your NurseLink Application Pipeline</h2>
            <p>
              Keep one clear record of the opportunities you are pursuing and their
              current application status.
            </p>
          </div>
          <a href="/jobs">Find Matches →</a>
        </div>

        <div class="nurselink-app-pipeline-metrics">
          <div><span>Total Tracked</span><strong>0</strong></div>
          <div><span>Active</span><strong>0</strong></div>
          <div><span>Interviews</span><strong>0</strong></div>
          <div><span>Offers</span><strong>0</strong></div>
        </div>

        <div class="nurselink-app-pipeline-empty">
          <div>▤</div>
          <strong>No applications tracked yet</strong>
          <p>Open Jobs, review your matched opportunities, and add one to your tracker.</p>
          <a class="primary-button" href="/jobs">View Job Matches</a>
        </div>

        <div class="nurselink-app-pipeline-list"></div>

        <div class="nurselink-app-pipeline-note">
          Application status shown here is a NurseLink tracking status. Employer or
          recruiter systems remain the authoritative source for formal hiring decisions.
        </div>
      `;

      const header = page.querySelector('.page-header');
      if (header) header.insertAdjacentElement('afterend', root);
      else page.insertBefore(root, page.firstChild);
    }

    try {
      await loadOpportunityCenter();
      renderApplicationsPipeline(root);
    } catch (error) {
      const empty = root.querySelector('.nurselink-app-pipeline-empty');
      if (empty) {
        empty.hidden = false;
        empty.querySelector('strong').textContent = 'Applications could not be loaded';
        empty.querySelector('p').textContent = error.message;
      }
    }
  }

  async function enhanceMemberHubV220(page) {
    if (!page || routeSlug() !== 'dashboard' || !isApprovedMemberPortal()) return;

    const hub = page.querySelector('.nurselink-member-hub');
    if (!hub) return;

    try {
      await loadOpportunityCenter();
    } catch (_) {
      return;
    }

    const topMatch = opportunityState.jobs[0] || null;
    const activeApps = opportunityState.applications.filter(
      app => !['withdrawn', 'declined'].includes(app.status)
    ).length;

    let strip = hub.querySelector('.nurselink-member-v220-strip');

    if (!strip) {
      strip = document.createElement('div');
      strip.className = 'nurselink-member-v220-strip';
      hub.appendChild(strip);
    }

    strip.innerHTML = `
      <a href="/jobs">
        <span>TOP OPPORTUNITY MATCH</span>
        <strong>${topMatch ? `${topMatch.match_score}% · ${topMatch.title}` : 'No active opportunities yet'}</strong>
        <small>${topMatch ? `${topMatch.employer_name} · ${topMatch.country}` : 'Your matching profile is ready.'}</small>
      </a>

      <a href="/applications">
        <span>APPLICATION PIPELINE</span>
        <strong>${activeApps} active application${activeApps === 1 ? '' : 's'}</strong>
        <small>${opportunityState.saved.size} saved job${opportunityState.saved.size === 1 ? '' : 's'}</small>
      </a>
    `;
  }

  function enhanceV220(page) {
    enhanceOpportunityMatches(page);
    enhanceApplicationsPipeline(page);
    enhanceMemberHubV220(page);
  }


  /* =========================================================
     NurseLink v5.5.2 — Reviewer / Admin Verification Center
     ========================================================= */

  const REVIEW_CENTER_API = 'https://api.amsertech.com/api/reviewer';

  const reviewCenterState = {
    summary: null,
    credentials: [],
    applications: [],
    jobs: [],
    audit: [],
    loaded: false
  };

  async function reviewerRequest(path = '', options = {}) {
    return nurseLinkJsonRequest(REVIEW_CENTER_API, path, options);
  }

  async function loadReviewCenter(force = false) {
    if (reviewCenterState.loaded && !force) return reviewCenterState;

    const [summary, credentials, applications, jobs] = await Promise.all([
      reviewerRequest('/summary'),
      reviewerRequest('/credentials'),
      reviewerRequest('/job-applications'),
      reviewerRequest('/job-opportunities')
    ]);

    reviewCenterState.summary = summary?.data || null;
    reviewCenterState.credentials = Array.isArray(credentials?.data) ? credentials.data : [];
    reviewCenterState.applications = Array.isArray(applications?.data) ? applications.data : [];
    reviewCenterState.jobs = Array.isArray(jobs?.data) ? jobs.data : [];
    reviewCenterState.loaded = true;

    return reviewCenterState;
  }

  function reviewerRole() {
    return reviewCenterState.summary?.role || 'reviewer';
  }

  function reviewTabButton(name, label, count = null) {
    return `
      <button type="button" data-review-tab="${name}">
        <span>${label}</span>
        ${count !== null ? `<em>${count}</em>` : ''}
      </button>
    `;
  }

  function reviewerCredentialType(value) {
    return credentialTypeLabel(value);
  }

  function reviewerApplicationStatus(value) {
    return jobApplicationStatus(value);
  }

  function reviewerJobStatus(value) {
    return ({
      active: 'Active',
      paused: 'Paused',
      closed: 'Closed'
    })[value] || value;
  }

  async function saveCredentialReview(root, record, card) {
    const status = card.querySelector('select[name="verification_status"]')?.value;
    const notes = card.querySelector('textarea[name="review_notes"]')?.value?.trim() || null;
    const message = card.querySelector('.nurselink-review-card-status');
    const button = card.querySelector('[data-action="save-credential"]');

    message.textContent = 'Saving review…';
    message.dataset.tone = 'loading';
    button.disabled = true;

    try {
      await reviewerRequest(`/credentials/${record.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          verification_status: status,
          review_notes: notes
        })
      });

      reviewCenterState.loaded = false;
      await loadReviewCenter(true);
      renderReviewCenter(root);
    } catch (error) {
      message.textContent = error.message;
      message.dataset.tone = 'error';
    } finally {
      button.disabled = false;
    }
  }

  async function saveApplicationReview(root, record, card) {
    const status = card.querySelector('select[name="status"]')?.value;
    const notes = card.querySelector('textarea[name="reviewer_notes"]')?.value?.trim() || null;
    const message = card.querySelector('.nurselink-review-card-status');
    const button = card.querySelector('[data-action="save-application"]');

    message.textContent = 'Saving application review…';
    message.dataset.tone = 'loading';
    button.disabled = true;

    try {
      await reviewerRequest(`/job-applications/${record.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          reviewer_notes: notes
        })
      });

      reviewCenterState.loaded = false;
      opportunityState.loaded = false;
      await loadReviewCenter(true);
      renderReviewCenter(root);
    } catch (error) {
      message.textContent = error.message;
      message.dataset.tone = 'error';
    } finally {
      button.disabled = false;
    }
  }

  function reviewerJobPayload(form) {
    const value = name => form.elements.namedItem(name)?.value?.trim?.() || '';
    const checked = name => !!form.elements.namedItem(name)?.checked;

    return {
      reference_code: value('reference_code'),
      title: value('title'),
      employer_name: value('employer_name'),
      country: value('country'),
      city: value('city') || null,
      work_setting: value('work_setting') || null,
      employment_type: value('employment_type') || null,
      specialty: value('specialty') || null,
      required_license_type: value('required_license_type') || null,
      minimum_experience_years: value('minimum_experience_years')
        ? Number(value('minimum_experience_years'))
        : 0,
      overseas_opportunity: checked('overseas_opportunity'),
      salary_min: value('salary_min') ? Number(value('salary_min')) : null,
      salary_max: value('salary_max') ? Number(value('salary_max')) : null,
      salary_currency: value('salary_currency') || null,
      description: value('description') || null,
      requirements: value('requirements') || null,
      apply_url: value('apply_url') || null,
      source_label: value('source_label') || null,
      status: value('status') || 'paused',
      published_at: value('published_at') || null,
      expires_at: value('expires_at') || null
    };
  }

  function reviewerJobForm(record = null) {
    const form = document.createElement('form');
    form.className = 'nurselink-review-job-editor';

    form.innerHTML = `
      <div class="nurselink-review-job-editor-head">
        <div>
          <span>VERIFIED OPPORTUNITY</span>
          <strong>${record ? 'Edit opportunity' : 'Add opportunity'}</strong>
          <p>
            Admin-only job management. Activate only opportunities whose employer,
            requirements and application channel have been verified.
          </p>
        </div>
        <button type="button" class="close" aria-label="Close">×</button>
      </div>

      <div class="nurselink-review-job-grid">
        <label>
          <span>Reference Code *</span>
          <input name="reference_code" maxlength="120" required>
        </label>

        <label>
          <span>Status *</span>
          <select name="status" required>
            <option value="paused">Paused</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <label class="span-2">
          <span>Job Title *</span>
          <input name="title" maxlength="190" required>
        </label>

        <label>
          <span>Employer *</span>
          <input name="employer_name" maxlength="190" required>
        </label>

        <label>
          <span>Country *</span>
          <input name="country" maxlength="120" required>
        </label>

        <label>
          <span>City</span>
          <input name="city" maxlength="120">
        </label>

        <label>
          <span>Specialty</span>
          <input name="specialty" maxlength="150">
        </label>

        <label>
          <span>Work Setting</span>
          <select name="work_setting">
            <option value="">Not specified</option>
            <option value="hospital">Hospital</option>
            <option value="clinic">Clinic</option>
            <option value="community">Community</option>
            <option value="home_care">Home Care</option>
            <option value="long_term_care">Long-term Care</option>
            <option value="education">Education / Academe</option>
            <option value="occupational_health">Occupational Health</option>
            <option value="telehealth">Telehealth</option>
            <option value="government">Government</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label>
          <span>Employment Type</span>
          <select name="employment_type">
            <option value="">Not specified</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="temporary">Temporary</option>
            <option value="project_based">Project-based</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label>
          <span>Required License</span>
          <select name="required_license_type">
            <option value="">No specific record required</option>
            <option value="prc_license">PRC License</option>
            <option value="nursing_diploma">Nursing Diploma / Degree</option>
            <option value="international_license">International Nursing License</option>
            <option value="specialty_certification">Specialty Certification</option>
            <option value="training_certificate">Training Certificate</option>
            <option value="language_certificate">Language Certificate</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label>
          <span>Minimum Experience (years)</span>
          <input name="minimum_experience_years" type="number" min="0" max="99" step="0.5" value="0">
        </label>

        <label class="toggle">
          <input name="overseas_opportunity" type="checkbox">
          <span>Overseas opportunity</span>
        </label>

        <label>
          <span>Salary Currency</span>
          <input name="salary_currency" maxlength="8" placeholder="PHP, USD, SAR">
        </label>

        <label>
          <span>Salary Minimum</span>
          <input name="salary_min" type="number" min="0" step="0.01">
        </label>

        <label>
          <span>Salary Maximum</span>
          <input name="salary_max" type="number" min="0" step="0.01">
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
          <span>Employer Application URL</span>
          <input name="apply_url" type="url" maxlength="512" placeholder="https://">
        </label>

        <label>
          <span>Source / Verification Label</span>
          <input name="source_label" maxlength="190">
        </label>

        <label>
          <span>Published At</span>
          <input name="published_at" type="datetime-local">
        </label>

        <label>
          <span>Expires At</span>
          <input name="expires_at" type="datetime-local">
        </label>
      </div>

      <div class="nurselink-review-job-editor-status" aria-live="polite"></div>

      <div class="nurselink-review-job-editor-actions">
        <button type="button" class="secondary-button cancel">Cancel</button>
        <button type="submit" class="primary-button">
          ${record ? 'Save Opportunity' : 'Create Opportunity'}
        </button>
      </div>
    `;

    const set = (name, value) => {
      const field = form.elements.namedItem(name);
      if (!field || value === null || value === undefined) return;

      if (field instanceof HTMLInputElement && field.type === 'checkbox') {
        field.checked = !!value;
      } else if (
        field instanceof HTMLInputElement &&
        field.type === 'datetime-local'
      ) {
        field.value = String(value).replace(' ', 'T').slice(0, 16);
      } else {
        field.value = String(value);
      }
    };

    if (record) {
      [
        'reference_code',
        'status',
        'title',
        'employer_name',
        'country',
        'city',
        'specialty',
        'work_setting',
        'employment_type',
        'required_license_type',
        'minimum_experience_years',
        'salary_currency',
        'salary_min',
        'salary_max',
        'description',
        'requirements',
        'apply_url',
        'source_label',
        'published_at',
        'expires_at'
      ].forEach(name => set(name, record[name]));

      set('overseas_opportunity', record.overseas_opportunity);
    }

    return form;
  }

  function openReviewerJobEditor(root, record = null) {
    root.querySelector('.nurselink-review-job-editor-wrap')?.remove();

    const wrap = document.createElement('div');
    wrap.className = 'nurselink-review-job-editor-wrap';

    const form = reviewerJobForm(record);
    wrap.appendChild(form);

    root.querySelector('.nurselink-review-tabs')
      ?.insertAdjacentElement('afterend', wrap);

    const close = () => wrap.remove();

    form.querySelector('.close')?.addEventListener('click', close);
    form.querySelector('.cancel')?.addEventListener('click', close);

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const status = form.querySelector('.nurselink-review-job-editor-status');
      const submit = form.querySelector('button[type="submit"]');

      status.textContent = record ? 'Saving opportunity…' : 'Creating opportunity…';
      status.dataset.tone = 'loading';
      submit.disabled = true;

      try {
        await reviewerRequest(
          record ? `/job-opportunities/${record.id}` : '/job-opportunities',
          {
            method: record ? 'PATCH' : 'POST',
            body: JSON.stringify(reviewerJobPayload(form))
          }
        );

        close();
        reviewCenterState.loaded = false;
        opportunityState.loaded = false;
        await loadReviewCenter(true);
        renderReviewCenter(root);
      } catch (error) {
        status.textContent = error.message;
        status.dataset.tone = 'error';
      } finally {
        submit.disabled = false;
      }
    });

    wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderCredentialQueue(container) {
    const rows = reviewCenterState.credentials;

    container.innerHTML = `
      <div class="nurselink-review-queue-head">
        <div>
          <strong>Credential Verification Queue</strong>
          <small>${rows.length} credential record${rows.length === 1 ? '' : 's'}</small>
        </div>
      </div>

      <div class="nurselink-review-card-list"></div>
    `;

    const list = container.querySelector('.nurselink-review-card-list');

    rows.forEach(record => {
      const card = document.createElement('article');
      card.className = 'nurselink-review-card';
      card.dataset.status = record.verification_status;

      card.innerHTML = `
        <div class="nurselink-review-card-head">
          <div>
            <span>${reviewerCredentialType(record.credential_type)}</span>
            <strong>${nlV200Escape(record.title)}</strong>
            <small>${nlV200Escape(record.member)}</small>
          </div>
          <em>${credentialStatusLabel(record.verification_status)}</em>
        </div>

        <div class="nurselink-review-card-meta">
          ${record.issuing_body ? `<span>${nlV200Escape(record.issuing_body)}</span>` : ''}
          ${record.credential_number ? `<span>No. ${nlV200Escape(record.credential_number)}</span>` : ''}
          ${record.country ? `<span>${nlV200Escape(record.country)}</span>` : ''}
          ${record.expiry_date ? `<span>Expires ${record.expiry_date}</span>` : ''}
        </div>

        <div class="nurselink-review-card-fields">
          <label>
            <span>Verification Status</span>
            <select name="verification_status">
              <option value="unverified">Unverified</option>
              <option value="pending">Pending Verification</option>
              <option value="verified">Verified</option>
              <option value="expired">Expired</option>
            </select>
          </label>

          <label>
            <span>Reviewer Notes</span>
            <textarea name="review_notes" rows="3" maxlength="4000"></textarea>
          </label>
        </div>

        <div class="nurselink-review-card-status" aria-live="polite"></div>

        <div class="nurselink-review-card-actions">
          <a href="/smart-registration?nlstep=3">Applicant Evidence →</a>
          <button type="button" class="primary-button" data-action="save-credential">
            Save Review
          </button>
        </div>
      `;

      card.querySelector('select[name="verification_status"]').value =
        record.verification_status || 'unverified';

      card.querySelector('textarea[name="review_notes"]').value =
        record.review_notes || '';

      card.querySelector('[data-action="save-credential"]')
        ?.addEventListener('click', () => saveCredentialReview(container.closest('.nurselink-review-center'), record, card));

      list.appendChild(card);
    });

    if (!rows.length) {
      list.innerHTML = `
        <div class="nurselink-review-empty">
          <strong>No credentials are currently in the review queue.</strong>
        </div>
      `;
    }
  }

  function renderApplicationQueue(container) {
    const rows = reviewCenterState.applications;

    container.innerHTML = `
      <div class="nurselink-review-queue-head">
        <div>
          <strong>Job Application Review Queue</strong>
          <small>${rows.length} tracked application${rows.length === 1 ? '' : 's'}</small>
        </div>
      </div>

      <div class="nurselink-review-card-list"></div>
    `;

    const list = container.querySelector('.nurselink-review-card-list');

    rows.forEach(record => {
      const card = document.createElement('article');
      card.className = 'nurselink-review-card';
      card.dataset.status = record.status;

      card.innerHTML = `
        <div class="nurselink-review-card-head">
          <div>
            <span>${nlV200Escape(record.reference_code)}</span>
            <strong>${nlV200Escape(record.title)}</strong>
            <small>${record.member} · ${record.employer_name}</small>
          </div>
          <em>${reviewerApplicationStatus(record.status)}</em>
        </div>

        <div class="nurselink-review-card-meta">
          <span>${record.city ? `${nlV200Escape(record.city)}, ` : ''}${nlV200Escape(record.country)}</span>
          ${record.specialty ? `<span>${nlV200Escape(record.specialty)}</span>` : ''}
          ${record.submitted_at ? `<span>Submitted ${String(record.submitted_at).slice(0, 10)}</span>` : ''}
        </div>

        ${record.cover_note ? `
          <div class="nurselink-review-member-note">
            <span>MEMBER NOTE</span>
            <p>${nlV200Escape(record.cover_note)}</p>
          </div>
        ` : ''}

        <div class="nurselink-review-card-fields">
          <label>
            <span>Reviewer Status</span>
            <select name="status">
              <option value="under_review">Under Review</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="interview">Interview</option>
              <option value="offer">Offer</option>
              <option value="declined">Declined / Closed</option>
            </select>
          </label>

          <label>
            <span>Reviewer Notes</span>
            <textarea name="reviewer_notes" rows="3" maxlength="5000"></textarea>
          </label>
        </div>

        <div class="nurselink-review-card-status" aria-live="polite"></div>

        <div class="nurselink-review-card-actions">
          <button type="button" class="primary-button" data-action="save-application">
            Save Application Review
          </button>
        </div>
      `;

      const select = card.querySelector('select[name="status"]');

      if (['under_review', 'shortlisted', 'interview', 'offer', 'declined'].includes(record.status)) {
        select.value = record.status;
      } else {
        select.value = 'under_review';
      }

      if (record.status === 'withdrawn') {
        select.disabled = true;
        card.querySelector('[data-action="save-application"]').disabled = true;
      }

      card.querySelector('textarea[name="reviewer_notes"]').value =
        record.reviewer_notes || '';

      card.querySelector('[data-action="save-application"]')
        ?.addEventListener('click', () => saveApplicationReview(container.closest('.nurselink-review-center'), record, card));

      list.appendChild(card);
    });

    if (!rows.length) {
      list.innerHTML = `
        <div class="nurselink-review-empty">
          <strong>No job applications are currently tracked.</strong>
        </div>
      `;
    }
  }

  function renderOpportunityQueue(container, root) {
    const rows = reviewCenterState.jobs;
    const isAdmin = reviewerRole() === 'admin';

    container.innerHTML = `
      <div class="nurselink-review-queue-head">
        <div>
          <strong>Verified Opportunity Management</strong>
          <small>${rows.length} opportunity record${rows.length === 1 ? '' : 's'}</small>
        </div>

        ${isAdmin ? `
          <button type="button" class="primary-button add-job">+ Add Opportunity</button>
        ` : `
          <span class="nurselink-review-role-note">Admin access required to edit opportunities</span>
        `}
      </div>

      <div class="nurselink-review-job-list"></div>
    `;

    container.querySelector('.add-job')
      ?.addEventListener('click', () => openReviewerJobEditor(root));

    const list = container.querySelector('.nurselink-review-job-list');

    rows.forEach(record => {
      const card = document.createElement('article');
      card.className = 'nurselink-review-job-card';
      card.dataset.status = record.status;

      card.innerHTML = `
        <div>
          <span>${nlV200Escape(record.reference_code)}</span>
          <strong>${nlV200Escape(record.title)}</strong>
          <small>${nlV200Escape(record.employer_name)} · ${record.city ? `${nlV200Escape(record.city)}, ` : ''}${nlV200Escape(record.country)}</small>
        </div>

        <div class="nurselink-review-job-card-meta">
          <em>${reviewerJobStatus(record.status)}</em>
          ${record.specialty ? `<span>${nlV200Escape(record.specialty)}</span>` : ''}
          ${record.verified_at ? `<span>Verified ${String(record.verified_at).slice(0, 10)}</span>` : ''}
        </div>

        ${isAdmin ? `
          <button type="button" class="secondary-button edit-job">Edit</button>
        ` : ''}
      `;

      card.querySelector('.edit-job')
        ?.addEventListener('click', () => openReviewerJobEditor(root, record));

      list.appendChild(card);
    });

    if (!rows.length) {
      list.innerHTML = `
        <div class="nurselink-review-empty">
          <strong>No opportunities have been loaded yet.</strong>
        </div>
      `;
    }
  }

  function renderReviewCenter(root, activeTab = null) {
    const summary = reviewCenterState.summary || {};
    const previousTab =
      activeTab ||
      root.querySelector('.nurselink-review-tabs button[aria-selected="true"]')?.dataset?.reviewTab ||
      'credentials';

    root.innerHTML = `
      <div class="nurselink-review-heading">
        <div>
          <span>AUTHORIZED REVIEW CENTER</span>
          <h2>NurseLink Verification & Opportunity Operations</h2>
          <p>
            Review professional credentials, manage job-application stages and,
            for administrators, publish verified opportunities. Every saved review
            is recorded in the NurseLink audit trail.
          </p>
        </div>

        <em>${summary.role === 'admin' ? 'Administrator' : 'Reviewer'}</em>
      </div>

      <div class="nurselink-review-metrics">
        <div><span>Credentials Pending</span><strong>${summary.credentials_pending ?? 0}</strong></div>
        <div><span>Active Applications</span><strong>${summary.job_applications_active ?? 0}</strong></div>
        <div><span>Interviews</span><strong>${summary.job_applications_interview ?? 0}</strong></div>
        <div><span>Active Opportunities</span><strong>${summary.job_opportunities_active ?? 0}</strong></div>
      </div>

      <div class="nurselink-review-tabs" role="tablist">
        ${reviewTabButton('credentials', 'Credentials', reviewCenterState.credentials.length)}
        ${reviewTabButton('applications', 'Applications', reviewCenterState.applications.length)}
        ${reviewTabButton('opportunities', 'Opportunities', reviewCenterState.jobs.length)}
      </div>

      <div class="nurselink-review-tab-panel"></div>

      <div class="nurselink-review-security-note">
        Reviewer controls are enforced by the API, not only by this screen.
        Ordinary members cannot use these endpoints. Opportunity creation/editing
        requires administrator access.
      </div>
    `;

    const panel = root.querySelector('.nurselink-review-tab-panel');

    const activate = tab => {
      root.querySelectorAll('.nurselink-review-tabs button').forEach(button => {
        button.setAttribute(
          'aria-selected',
          String(button.dataset.reviewTab === tab)
        );
      });

      if (tab === 'applications') renderApplicationQueue(panel);
      else if (tab === 'opportunities') renderOpportunityQueue(panel, root);
      else renderCredentialQueue(panel);
    };

    root.querySelectorAll('.nurselink-review-tabs button').forEach(button => {
      button.addEventListener('click', () => activate(button.dataset.reviewTab));
    });

    activate(previousTab);
  }

  const nurselinkAdminReviewElevationState = {
    loaded: false,
    loading: null
  };

  async function requireNurseLinkAdminElevation() {
    if (nurselinkAdminReviewElevationState.loaded) return true;

    if (nurselinkAdminReviewElevationState.loading) {
      return nurselinkAdminReviewElevationState.loading;
    }

    nurselinkAdminReviewElevationState.loading = nurseLinkJsonRequest(
      `${NURSELINK_API_ORIGIN}/api/nurselink/admin/session`
    )
      .then(() => {
        nurselinkAdminReviewElevationState.loaded = true;
        return true;
      })
      .finally(() => {
        nurselinkAdminReviewElevationState.loading = null;
      });

    return nurselinkAdminReviewElevationState.loading;
  }

  async function enhanceReviewCenter(page) {
    if (!page || routeSlug() !== 'admin') return;

    try {
      await requireNurseLinkAdminElevation();
    } catch (error) {
      if ([401, 403, 419].includes(error.status)) {
        window.location.replace(
          '/nurselink-admin-login.html?return=/admin'
        );
        return;
      }

      throw error;
    }

    let root = page.querySelector('.nurselink-review-center');

    if (!root) {
      root = document.createElement('section');
      root.className = 'nurselink-review-center nurselink-review-center-loading';
      root.innerHTML = `
        <div class="nurselink-review-loader"></div>
        <strong>Checking reviewer authorization…</strong>
      `;

      const header = page.querySelector('.page-header');
      if (header) header.insertAdjacentElement('afterend', root);
      else page.insertBefore(root, page.firstChild);
    }

    try {
      await loadReviewCenter();
      root.classList.remove('nurselink-review-center-loading');
      renderReviewCenter(root);
    } catch (error) {
      root.className = 'nurselink-review-center nurselink-review-access-denied';

      root.innerHTML = `
        <div class="nurselink-review-denied-icon">🔒</div>
        <strong>Reviewer authorization required</strong>
        <p>${error.message}</p>
        <small>
          Access is denied by default. An existing application administrator may
          already qualify, or explicit reviewer/admin access can be granted from
          cPanel Terminal using the v2.3 reviewer access utility.
        </small>
      `;
    }
  }

  function enhanceV230(page) {
    enhanceReviewCenter(page);
  }


  /* =========================================================
     NurseLink v2.4/v2.5 — Membership Identity + Notifications
     ========================================================= */

  const MEMBERSHIP_API = 'https://api.amsertech.com/api/membership';
  const MEMBERSHIP_REVIEW_API = 'https://api.amsertech.com/api/reviewer/membership-applications';
  const NOTIFICATIONS_API = 'https://api.amsertech.com/api/notifications';

  const membershipState = {
    loaded: false,
    loading: null,
    data: null
  };

  const notificationState = {
    loaded: false,
    loading: null,
    rows: [],
    unread: 0
  };

  async function loadMembership(force = false) {
    if (membershipState.loaded && !force) return membershipState.data;
    if (membershipState.loading && !force) return membershipState.loading;

    membershipState.loading = nurseLinkJsonRequest(MEMBERSHIP_API, '/me')
      .then(payload => {
        membershipState.data = payload?.data || null;
        membershipState.loaded = true;
        return membershipState.data;
      })
      .finally(() => {
        membershipState.loading = null;
      });

    return membershipState.loading;
  }

  function membershipStatusLabel(value) {
    return ({
      submitted: 'Submitted',
      under_review: 'Under Review',
      needs_information: 'Needs Information',
      ready_for_approval: 'Ready for Approval',
      approved: 'Approved',
      declined: 'Declined'
    })[value] || value;
  }

  function membershipStatusTone(value) {
    return ({
      submitted: 'info',
      under_review: 'info',
      needs_information: 'warning',
      ready_for_approval: 'info',
      approved: 'success',
      declined: 'error'
    })[value] || 'info';
  }

  function membershipStandingLabel(value) {
    return ({
      active: 'Active',
      suspended: 'Suspended',
      inactive: 'Inactive'
    })[String(value || 'active').toLowerCase()]
      || String(value || 'Active');
  }

  function membershipStandingTone(value) {
    return ({
      active: 'success',
      suspended: 'warning',
      inactive: 'muted'
    })[String(value || 'active').toLowerCase()]
      || 'muted';
  }

  function membershipHasActiveStanding(data) {
    if (!data || data.status !== 'approved') return false;

    const standing = String(data.standing || 'active')
      .toLowerCase()
      .trim();

    return !standing || standing === 'active';
  }

  let nurselinkQrLibraryPromise = null;

  function ensureNurseLinkQrLibrary() {
    if (window.QRCode) return Promise.resolve(window.QRCode);
    if (nurselinkQrLibraryPromise) return nurselinkQrLibraryPromise;

    nurselinkQrLibraryPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-nurselink-qrcode]');

      if (existing) {
        existing.addEventListener('load', () => resolve(window.QRCode), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = '/nurselink-qrcode.min.js';
      script.async = true;
      script.dataset.nurselinkQrcode = '1';

      script.addEventListener('load', () => {
        if (window.QRCode) resolve(window.QRCode);
        else reject(new Error('NurseLink QR library unavailable.'));
      }, { once: true });

      script.addEventListener('error', reject, { once: true });

      document.head.appendChild(script);
    });

    return nurselinkQrLibraryPromise;
  }

  async function hydrateDigitalMemberPhoto(card) {
    const photo = card.querySelector('.nurselink-member-id-photo');
    if (!photo) return;

    try {
      const response = await NURSELINK_NATIVE_FETCH(
        `${NURSELINK_API_ORIGIN}/api/profile-photo/image`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
          }
        }
      );

      if (!response.ok) return;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const img = document.createElement('img');

      img.alt = 'NurseLink member profile photo';
      img.src = url;

      img.addEventListener('load', () => {
        photo.querySelector('.avatar')?.remove();
        photo.appendChild(img);
      }, { once: true });

      img.addEventListener('error', () => URL.revokeObjectURL(url), { once: true });

      card.addEventListener('DOMNodeRemoved', event => {
        if (event.target === card) URL.revokeObjectURL(url);
      }, { once: true });
    } catch (_) {
      // Keep the NL fallback avatar.
    }
  }

  async function hydrateDigitalMemberQr(card, data) {
    const target = card.querySelector('.nurselink-member-id-qr-code');
    const value = data.verification_url || '';

    if (!target || !value) return;

    try {
      const QR = await ensureNurseLinkQrLibrary();

      target.innerHTML = '';

      new QR(target, {
        text: value,
        width: 132,
        height: 132,
        colorDark: '#10204d',
        colorLight: '#ffffff',
        correctLevel: QR.CorrectLevel.M
      });

      target.dataset.ready = '1';
    } catch (_) {
      target.innerHTML = `
        <div class="nurselink-qr-fallback">
          QR unavailable
        </div>
      `;
    }
  }

  function renderDigitalMembershipCard(data) {
    const card = document.createElement('section');
    card.className = 'nurselink-digital-member-card';
    card.dataset.nurselinkDigitalId = 'v5.5.2';

    const standing = String(data.standing || 'active')
      .toLowerCase()
      .trim() || 'active';
    const standingLabel = membershipStandingLabel(standing);
    const standingActive = standing === 'active';

    card.dataset.membershipStanding = standing;

    const safeName = nlV200Escape(data.member_name || 'NurseLink Member');
    const safeNumber = nlV200Escape(data.member_number || '');
    const safeDate = nlV200Escape(
      data.approved_at ? String(data.approved_at).slice(0, 10) : '—'
    );
    const safeCode = nlV200Escape(
      data.verification_code
        ? data.verification_code.slice(0, 12).toUpperCase()
        : '—'
    );

    card.innerHTML = `
      <div class="nurselink-member-id-band">
        <div>
          <span>NurseLink</span>
          <small>Professional Membership Network</small>
        </div>
        <em>DIGITAL MEMBER ID</em>
      </div>

      <div class="nurselink-member-id-main">
        <div class="nurselink-member-id-body">
          <div class="nurselink-member-id-photo">
            <span class="avatar">NL</span>
          </div>

          <div class="nurselink-member-id-copy">
            <span>APPROVED MEMBER</span>
            <strong>${safeName}</strong>
            <small>${safeNumber}</small>

            <div class="nurselink-member-id-status"
              data-standing="${nlV200Escape(standing)}">
              <span>${standingActive ? '✓' : '!'}</span>
              <strong>
                ${standingActive
                  ? 'Active NurseLink Membership'
                  : `${nlV200Escape(standingLabel)} Membership Standing`}
              </strong>
            </div>

            ${!standingActive ? `
              <div class="nurselink-member-id-standing-notice">
                Member-only services are unavailable while this membership is
                ${nlV200Escape(standingLabel)}.
              </div>
            ` : ''}
          </div>
        </div>

        <div class="nurselink-member-id-qr">
          <div class="nurselink-member-id-qr-code" aria-label="Membership verification QR code"></div>
          <strong>SCAN TO VERIFY</strong>
          <small>NurseLink membership</small>
        </div>
      </div>

      <div class="nurselink-member-id-footer">
        <div>
          <span>Member Since</span>
          <strong>${safeDate}</strong>
        </div>

        <div>
          <span>Member Number</span>
          <strong>${safeNumber || '—'}</strong>
        </div>

        <div>
          <span>Verification Code</span>
          <strong>${safeCode}</strong>
        </div>

        <div>
          <span>Membership Standing</span>
          <strong>${nlV200Escape(standingLabel)}</strong>
        </div>

        <div class="nurselink-member-id-actions">
          <button type="button" class="copy-verification">
            Copy Verify Link
          </button>
          <a class="open-verification"
             href="${nlV200Escape(data.verification_url || '#')}"
             target="_blank"
             rel="noopener noreferrer">
            Open Verification
          </a>
        </div>
      </div>

      <div class="nurselink-member-id-note">
        This digital card confirms NurseLink membership and current NurseLink
        professional standing only. It is not a PRC license, government ID,
        immigration document or employer credential.
      </div>
    `;

    card.querySelector('.copy-verification')
      ?.addEventListener('click', async event => {
        const button = event.currentTarget;
        const value = data.verification_url || '';

        if (!value) return;

        try {
          await navigator.clipboard.writeText(value);
          button.textContent = 'Copied ✓';
          setTimeout(() => {
            button.textContent = 'Copy Verify Link';
          }, 1600);
        } catch (_) {
          window.prompt('Copy this verification link:', value);
        }
      });

    hydrateDigitalMemberPhoto(card);
    hydrateDigitalMemberQr(card, data);

    return card;
  }

  async function enhanceMembershipIdentity(page) {
    if (!page) return;

    const route = routeSlug();

    if (!['dashboard', 'application-status', 'profile'].includes(route)) return;

    let membership;

    try {
      membership = await loadMembership();
    } catch (_) {
      return;
    }

    if (!membership) return;

    if (route === 'application-status') {
      let status = page.querySelector('.nurselink-membership-status-card');

      if (!status) {
        status = document.createElement('section');
        status.className = 'nurselink-membership-status-card';

        const header = page.querySelector('.page-header');
        if (header) header.insertAdjacentElement('afterend', status);
        else page.insertBefore(status, page.firstChild);
      }

      status.dataset.tone = membershipStatusTone(membership.status);

      status.innerHTML = `
        <div>
          <span>MEMBERSHIP REVIEW</span>
          <strong>${membershipStatusLabel(membership.status)}</strong>
          <p>
            ${membership.reviewer_notes
              ? membership.reviewer_notes
              : membership.status === 'approved'
                ? 'Your NurseLink membership has been approved.'
                : 'Your application is in the NurseLink membership review workflow.'}
          </p>
        </div>

        ${membership.member_number ? `
          <div class="nurselink-membership-number">
            <span>Member Number</span>
            <strong>${membership.member_number}</strong>
            ${membership.status === 'approved' ? `
              <span>Professional Standing</span>
              <strong data-standing="${nlV200Escape(
                membership.standing || 'active'
              )}">
                ${nlV200Escape(
                  membershipStandingLabel(
                    membership.standing || 'active'
                  )
                )}
              </strong>
            ` : ''}
          </div>
        ` : ''}
      `;
    }

    if (
      membership.status === 'approved'
      && !membershipHasActiveStanding(membership)
      && ['dashboard', 'application-status', 'profile'].includes(route)
    ) {
      let lifecycleAlert = page.querySelector(
        '.nurselink-membership-standing-alert'
      );

      if (!lifecycleAlert) {
        lifecycleAlert = document.createElement('section');
        lifecycleAlert.className =
          'nurselink-membership-standing-alert';

        const header = page.querySelector('.page-header');
        if (header) {
          header.insertAdjacentElement('afterend', lifecycleAlert);
        } else {
          page.insertBefore(lifecycleAlert, page.firstChild);
        }
      }

      lifecycleAlert.dataset.standing =
        membership.standing || 'inactive';

      lifecycleAlert.innerHTML = `
        <div>
          <span>MEMBERSHIP STANDING</span>
          <strong>
            ${nlV200Escape(
              membershipStandingLabel(
                membership.standing || 'inactive'
              )
            )}
          </strong>
          <p>
            ${nlV200Escape(
              membership.standing_reason
                || 'Member-only services are unavailable until this membership returns to Active standing.'
            )}
          </p>
        </div>
        <a href="/application-status">
          View Membership Status
        </a>
      `;
    }

    if (membership.status === 'approved' && ['dashboard', 'profile'].includes(route)) {
      let existing = page.querySelector('.nurselink-digital-member-card');

      if (!existing) {
        const card = renderDigitalMembershipCard(membership);

        const anchor =
          page.querySelector('.nurselink-member-hub') ||
          page.querySelector('.page-header');

        if (anchor) anchor.insertAdjacentElement('afterend', card);
        else page.insertBefore(card, page.firstChild);
      }
    }
  }

  async function loadNotifications(force = false) {
    if (notificationState.loaded && !force) return notificationState;

    if (notificationState.loading && !force) {
      return notificationState.loading;
    }

    const request = nurseLinkJsonRequest(NOTIFICATIONS_API)
      .then(payload => {
        notificationState.rows = Array.isArray(payload?.data)
          ? payload.data
          : [];
        notificationState.unread = Number(payload?.unread_count || 0);
        notificationState.loaded = true;
        return notificationState;
      })
      .finally(() => {
        if (notificationState.loading === request) {
          notificationState.loading = null;
        }
      });

    notificationState.loading = request;

    return request;
  }

  async function markNotificationRead(id) {
    await nurseLinkJsonRequest(NOTIFICATIONS_API, `/${id}/read`, {
      method: 'PATCH'
    });

    notificationState.loaded = false;
    return loadNotifications(true);
  }

  async function markAllNotificationsRead() {
    await nurseLinkJsonRequest(NOTIFICATIONS_API, '/read-all', {
      method: 'POST'
    });

    notificationState.loaded = false;
    return loadNotifications(true);
  }

  function notificationActionUrl(row) {
    const stored = String(row?.action_url || '').trim();
    const type = String(row?.type || '').toLowerCase();
    const membershipStatus = String(
      membershipState.data?.status || ''
    ).toLowerCase();

    /*
     * v5.5.2:
     * Credential review notifications may have been created while the nurse
     * was still an applicant. /credentials is intentionally approved-member
     * only, while Step 3 Credential Registry must remain available to pending
     * applicants.
     */
    if (type.startsWith('credential.renewal.')) {
      return membershipStatus === 'approved'
        ? '/nurselink-credential-renewal.html'
        : '/smart-registration?nlstep=3';
    }

    if (type.startsWith('benefit.')) {
      return membershipStatus === 'approved'
        ? '/nurselink-benefits.html'
        : '/application-status';
    }

    if (type.startsWith('mentoring.')) {
      return membershipStatus === 'approved'
        ? '/nurselink-mentoring.html'
        : '/application-status';
    }

    if (type.startsWith('chapter.')) {
      return membershipStatus === 'approved'
        ? '/nurselink-chapters.html'
        : '/application-status';
    }

    if (type.startsWith('credential.renewal.')) {
      return membershipStatus === 'approved'
        ? '/nurselink-credential-renewal.html'
        : '/smart-registration?nlstep=3';
    }

    if (type.startsWith('credential.')) {
      return membershipStatus === 'approved'
        ? '/credentials'
        : '/smart-registration?nlstep=3';
    }

    if (type.startsWith('membership.')) {
      return '/application-status';
    }

    if (stored) return stored;

    return null;
  }

  function closeNotificationDrawer() {
    document.querySelector('.nurselink-notification-drawer')?.remove();

    const button = document.querySelector(
      `${ROOT_SELECTOR} .nurselink-notification-button`
    );

    if (button) {
      button.setAttribute('aria-expanded', 'false');
    }

    document.documentElement.classList.remove(
      'nurselink-notification-drawer-open'
    );
  }

  function openNotificationDrawer(button) {
    const existing = document.querySelector(
      '.nurselink-notification-drawer'
    );

    if (existing) {
      closeNotificationDrawer();
      return;
    }

    const drawer = document.createElement('aside');
    drawer.className = 'nurselink-notification-drawer';
    drawer.id = 'nurselink-notification-drawer';
    drawer.dataset.nurselinkNotificationInstant = '1';
    drawer.setAttribute('data-nurselink-notification-instant', '1');
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'false');
    drawer.setAttribute('aria-label', 'NurseLink notifications');

    drawer.innerHTML = `
      <div class="nurselink-notification-drawer-bar">
        <div>
          <span>ACTION CENTER</span>
          <strong>Notifications</strong>
        </div>
        <button type="button"
          class="nurselink-notification-drawer-close"
          aria-label="Close notifications">×</button>
      </div>
      <div class="nurselink-notification-drawer-content">
        <div class="nurselink-notification-drawer-loading">
          Loading notifications…
        </div>
      </div>
    `;

    document.body.appendChild(drawer);

    button?.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add(
      'nurselink-notification-drawer-open'
    );

    drawer.querySelector('.nurselink-notification-drawer-close')
      ?.addEventListener('click', closeNotificationDrawer);

    const content = drawer.querySelector(
      '.nurselink-notification-drawer-content'
    );

    /*
     * v5.5.2 — CACHE-FIRST NOTIFICATION DRAWER
     *
     * The dashboard Action Center and unread badge usually loaded the same
     * notification state already. Reuse it immediately instead of blocking
     * the drawer on another API request.
     */
    if (content && notificationState.loaded) {
      renderNotificationCenter(content);
      drawer.dataset.nurselinkNotificationSource = 'cache';
    }

    const membershipRefresh = membershipState.loaded
      ? Promise.resolve(membershipState.data)
      : loadMembership().catch(() => null);

    const notificationRefresh = notificationState.loaded
      ? loadNotifications(true)
      : loadNotifications();

    Promise.allSettled([
      membershipRefresh,
      notificationRefresh
    ]).then(results => {
      if (!drawer.isConnected) return;

      const currentContent = drawer.querySelector(
        '.nurselink-notification-drawer-content'
      );

      if (!currentContent) return;

      const notificationResult = results[1];

      if (
        notificationResult?.status === 'fulfilled'
        || notificationState.loaded
      ) {
        renderNotificationCenter(currentContent);
        drawer.dataset.nurselinkNotificationSource = 'refreshed';
        updateNotificationBadge();
        return;
      }

      /*
       * If the dashboard already had cached data, keep it visible even when a
       * quiet refresh fails. Do not replace useful notifications with an error.
       */
      if (notificationState.loaded) {
        renderNotificationCenter(currentContent);
        return;
      }

      const reason = notificationResult?.reason;

      currentContent.innerHTML = `
        <div class="nurselink-notification-drawer-error">
          <strong>Notifications unavailable</strong>
          <small>${nlV200Escape(
            reason?.message || 'Please try again.'
          )}</small>
        </div>
      `;
    });
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeNotificationDrawer();
    }
  });

  function renderNotificationCenter(root, options = {}) {
    const rows = notificationState.rows;
    const limit = Number.isFinite(options.limit)
      ? Math.max(0, Number(options.limit))
      : 12;
    const compact = !!options.compact;
    const showViewAll = !!options.showViewAll;
    const visibleRows = limit > 0 ? rows.slice(0, limit) : rows;

    root.classList.toggle(
      'nurselink-notification-center-dashboard-compact',
      compact
    );

    root.innerHTML = `
      <div class="nurselink-notification-head">
        <div>
          <span>ACTION CENTER</span>
          <strong>Notifications</strong>
          <small>${notificationState.unread} unread</small>
        </div>

        <div class="nurselink-notification-head-actions">
          ${showViewAll ? `
            <a class="view-all" href="/nurselink-notifications.html">
              View all notifications
            </a>
          ` : ''}
          ${notificationState.unread ? `
            <button type="button" class="mark-all">Mark all read</button>
          ` : ''}
        </div>
      </div>

      <div class="nurselink-notification-list"></div>
    `;

    root.querySelector('.mark-all')
      ?.addEventListener('click', async () => {
        await markAllNotificationsRead();
        renderNotificationCenter(root, options);
        updateNotificationBadge();
      });

    const list = root.querySelector('.nurselink-notification-list');

    if (!rows.length) {
      list.innerHTML = `
        <div class="nurselink-notification-empty">
          <strong>No notifications yet</strong>
          <small>Membership, credential and application updates will appear here.</small>
        </div>
      `;
      return;
    }

    visibleRows.forEach(row => {
      const item = document.createElement('article');
      item.className = 'nurselink-notification-item';
      item.dataset.severity = row.severity || 'info';
      item.dataset.read = row.read_at ? 'true' : 'false';

      item.innerHTML = `
        <span class="dot"></span>

        <div>
          <strong>${nlV200Escape(row.title)}</strong>
          <p>${nlV200Escape(row.message)}</p>
          <small>${row.created_at ? String(row.created_at).replace('T', ' ').slice(0, 16) : ''}</small>
        </div>

        <div class="nurselink-notification-actions">
          ${notificationActionUrl(row) ? `<a href="${nlV200Escape(notificationActionUrl(row))}">Open</a>` : ''}
          ${!row.read_at ? `<button type="button">Read</button>` : ''}
        </div>
      `;

      item.querySelector('button')
        ?.addEventListener('click', async () => {
          await markNotificationRead(row.id);
          renderNotificationCenter(root, options);
          updateNotificationBadge();
        });

      list.appendChild(item);
    });

    if (compact && rows.length > visibleRows.length) {
      const footer = document.createElement('div');
      footer.className = 'nurselink-notification-compact-footer';
      footer.innerHTML = `
        <span>Showing ${visibleRows.length} of ${rows.length} recent notifications</span>
        <a href="/nurselink-notifications.html">View all notifications →</a>
      `;
      root.appendChild(footer);
    }
  }

  async function updateNotificationBadge() {
    let state;

    try {
      state = await loadNotifications();
    } catch (_) {
      return;
    }

    document.querySelectorAll('.nurselink-notification-badge')
      .forEach(badge => {
        badge.textContent = state.unread > 99 ? '99+' : String(state.unread);
        badge.hidden = state.unread <= 0;
      });
  }

  async function enhanceNotificationActionCenter(page) {
    if (!page || !document.querySelector(ROOT_SELECTOR)) return;

    let topbar = document.querySelector(`${ROOT_SELECTOR} .topbar`);

    if (topbar && !topbar.querySelector('.nurselink-notification-button')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nurselink-notification-button';
      button.setAttribute('aria-label', 'Open notifications');
      button.innerHTML = `
        <span>🔔</span>
        <em class="nurselink-notification-badge" hidden>0</em>
      `;

      topbar.appendChild(button);

      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-controls', 'nurselink-notification-drawer');
      button.setAttribute('aria-expanded', 'false');

      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openNotificationDrawer(button);
      });
    }

    await updateNotificationBadge();

    if (!document.documentElement.dataset.nurselinkNotificationOutsideClose) {
      document.documentElement.dataset.nurselinkNotificationOutsideClose = '1';

      document.addEventListener('click', event => {
        const drawer = document.querySelector(
          '.nurselink-notification-drawer'
        );
        const bell = event.target.closest?.(
          '.nurselink-notification-button'
        );

        if (!drawer || bell || drawer.contains(event.target)) return;

        closeNotificationDrawer();
      });
    }

    if (routeSlug() === 'dashboard') {
      let center = page.querySelector('.nurselink-notification-center');

      if (!center) {
        center = document.createElement('section');
        center.className = 'nurselink-notification-center nurselink-notification-center-compact';

        const memberId = page.querySelector('.nurselink-digital-member-card');
        const hub = page.querySelector('.nurselink-member-hub');
        const anchor = memberId || hub || page.querySelector('.page-header');

        if (anchor) anchor.insertAdjacentElement('afterend', center);
        else page.insertBefore(center, page.firstChild);
      }

      try {
        await loadMembership().catch(() => null);
        await loadNotifications();
        renderNotificationCenter(center, {
          limit: 4,
          compact: true,
          showViewAll: true
        });
      } catch (_) {}
    }
  }

  async function loadMembershipReviewQueue() {
    const payload = await reviewerRequest('/membership-applications');
    return Array.isArray(payload?.data) ? payload.data : [];
  }

  async function saveMembershipReview(root, record, card) {
    const status = card.querySelector('select[name="status"]')?.value;
    const reviewerNotes =
      card.querySelector('textarea[name="reviewer_notes"]')?.value?.trim() || null;

    const message = card.querySelector('.nurselink-review-card-status');
    const button = card.querySelector('[data-action="save-membership"]');

    message.textContent = 'Saving membership review…';
    message.dataset.tone = 'loading';
    button.disabled = true;

    try {
      await reviewerRequest(`/membership-applications/${record.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          reviewer_notes: reviewerNotes
        })
      });

      reviewCenterState.loaded = false;
      membershipState.loaded = false;
      notificationState.loaded = false;

      const membershipRows = await loadMembershipReviewQueue();
      reviewCenterState.memberships = membershipRows;

      await loadReviewCenter(true);
      reviewCenterState.memberships = membershipRows;

      renderReviewCenter(root, 'memberships');
    } catch (error) {
      message.textContent = error.message;
      message.dataset.tone = 'error';
    } finally {
      button.disabled = false;
    }
  }

  function renderMembershipQueue(container) {
    const rows = reviewCenterState.memberships || [];
    const isAdmin = reviewerRole() === 'admin';

    container.innerHTML = `
      <div class="nurselink-review-queue-head">
        <div>
          <strong>Membership Applications Queue</strong>
          <small>${rows.length} membership record${rows.length === 1 ? '' : 's'}</small>
        </div>
      </div>

      <div class="nurselink-review-card-list"></div>
    `;

    const list = container.querySelector('.nurselink-review-card-list');

    rows.forEach(record => {
      const card = document.createElement('article');
      card.className = 'nurselink-review-card nurselink-membership-review-card';
      card.dataset.status = record.status;

      card.innerHTML = `
        <div class="nurselink-review-card-head">
          <div>
            <span>MEMBERSHIP APPLICATION</span>
            <strong>${record.member}</strong>
            <small>${nlV200Escape(record.member_number || 'Membership number pending')}</small>
          </div>

          <em>${membershipStatusLabel(record.status)}</em>
        </div>

        <div class="nurselink-review-card-meta">
          ${record.updated_at ? `<span>Updated ${String(record.updated_at).slice(0, 10)}</span>` : ''}
          ${record.approved_at ? `<span>Approved ${String(record.approved_at).slice(0, 10)}</span>` : ''}
        </div>

        <div class="nurselink-review-card-fields">
          <label>
            <span>Membership Status</span>
            <select name="status">
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="needs_information">Needs Information</option>
              <option value="ready_for_approval">Ready for Approval</option>
              ${isAdmin ? '<option value="approved">Approved</option>' : ''}
              <option value="declined">Declined</option>
            </select>
          </label>

          <label>
            <span>Reviewer Notes</span>
            <textarea name="reviewer_notes" rows="3" maxlength="6000"></textarea>
          </label>
        </div>

        <div class="nurselink-review-card-status" aria-live="polite"></div>

        <div class="nurselink-review-card-actions">
          <a href="/application-status">Application Status →</a>
          <button type="button" class="primary-button" data-action="save-membership">
            Save Membership Review
          </button>
        </div>
      `;

      const select = card.querySelector('select[name="status"]');

      if (Array.from(select.options).some(option => option.value === record.status)) {
        select.value = record.status;
      } else {
        select.value = 'ready_for_approval';
      }

      if (record.status === 'approved') {
        select.disabled = true;
        card.querySelector('[data-action="save-membership"]').disabled = true;
      }

      card.querySelector('textarea[name="reviewer_notes"]').value =
        record.reviewer_notes || '';

      card.querySelector('[data-action="save-membership"]')
        ?.addEventListener('click', () =>
          saveMembershipReview(
            container.closest('.nurselink-review-center'),
            record,
            card
          )
        );

      list.appendChild(card);
    });

    if (!rows.length) {
      list.innerHTML = `
        <div class="nurselink-review-empty">
          <strong>No membership records are in the queue yet.</strong>
          <small>
            Membership records are created automatically when authenticated users
            access NurseLink after v5.5.2 is installed.
          </small>
        </div>
      `;
    }
  }

  const originalRenderReviewCenterV230 = renderReviewCenter;

  renderReviewCenter = function(root, activeTab = null) {
    const summary = reviewCenterState.summary || {};
    const memberships = reviewCenterState.memberships || [];

    originalRenderReviewCenterV230(root, activeTab);

    const tabs = root.querySelector('.nurselink-review-tabs');
    const panel = root.querySelector('.nurselink-review-tab-panel');

    if (!tabs || !panel) return;

    if (!tabs.querySelector('[data-review-tab="memberships"]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.reviewTab = 'memberships';
      button.innerHTML = `<span>Memberships</span><em>${memberships.length}</em>`;
      tabs.prepend(button);
    }

    const activateMembership = () => {
      root.querySelectorAll('.nurselink-review-tabs button').forEach(button => {
        button.setAttribute(
          'aria-selected',
          String(button.dataset.reviewTab === 'memberships')
        );
      });

      renderMembershipQueue(panel);
    };

    const membershipButton = tabs.querySelector('[data-review-tab="memberships"]');
    membershipButton.onclick = activateMembership;

    if (activeTab === 'memberships') {
      activateMembership();
    }
  };

  async function enhanceReviewMembershipQueue(page) {
    if (!page || routeSlug() !== 'admin') return;

    try {
      const memberships = await loadMembershipReviewQueue();
      reviewCenterState.memberships = memberships;

      const root = page.querySelector('.nurselink-review-center');

      if (root && reviewCenterState.loaded) {
        renderReviewCenter(root);
      }
    } catch (_) {}
  }

  function enhanceV250(page) {
    enhanceMembershipIdentity(page);
    enhanceNotificationActionCenter(page);
    enhanceReviewMembershipQueue(page);
  }


  /* =========================================================
     NurseLink v5.5.2 — Shareable Digital Nurse Profile
     ========================================================= */

  const PUBLIC_PROFILE_API = 'https://api.amsertech.com/api/public-profile';

  const publicProfileState = {
    loaded: false,
    data: null
  };

  async function loadPublicProfileSettings(force = false) {
    if (publicProfileState.loaded && !force) return publicProfileState.data;

    const payload = await nurseLinkJsonRequest(PUBLIC_PROFILE_API, '/settings');

    publicProfileState.data = payload?.data || null;
    publicProfileState.loaded = true;

    return publicProfileState.data;
  }

  function publicProfileSettingsForm(data) {
    const form = document.createElement('form');
    form.className = 'nurselink-public-profile-editor';

    form.innerHTML = `
      <div class="nurselink-public-profile-editor-head">
        <div>
          <span>PUBLIC DIGITAL NURSE PROFILE</span>
          <strong>Choose what you want to share</strong>
          <p>
            Only the sections you enable are returned by the public NurseLink API.
            Credential numbers, private notes, addresses and uploaded documents are never published.
          </p>
        </div>
      </div>

      <div class="nurselink-public-profile-grid">
        <label class="toggle span-2">
          <input type="checkbox" name="enabled">
          <span>Enable my shareable NurseLink profile</span>
        </label>

        <label class="span-2">
          <span>Professional Headline</span>
          <input name="headline" maxlength="190" placeholder="Registered Nurse · ICU · International Experience">
        </label>

        <label class="span-2">
          <span>Professional Bio</span>
          <textarea name="bio" rows="4" maxlength="3000" placeholder="Write a concise professional introduction."></textarea>
        </label>

        <fieldset class="span-2">
          <legend>Public Sections</legend>

          <div class="nurselink-public-profile-checks">
            ${[
              ['show_photo', 'Profile Photo'],
              ['show_member_number', 'NurseLink Member Number'],
              ['show_credentials', 'Credentials'],
              ['show_employment', 'Employment History'],
              ['show_portfolio', 'Public Portfolio'],
              ['show_learning', 'Completed Learning / CPD']
            ].map(([name, label]) => `
              <label>
                <input type="checkbox" name="${name}">
                <span>${label}</span>
              </label>
            `).join('')}
          </div>
        </fieldset>
      </div>

      <div class="nurselink-public-profile-editor-status" aria-live="polite"></div>

      <div class="nurselink-public-profile-editor-actions">
        <button type="submit" class="primary-button">Save Public Profile</button>
      </div>
    `;

    const set = (name, value) => {
      const field = form.elements.namedItem(name);
      if (!field) return;

      if (field instanceof HTMLInputElement && field.type === 'checkbox') {
        field.checked = !!value;
      } else if (value !== null && value !== undefined) {
        field.value = String(value);
      }
    };

    [
      'enabled',
      'headline',
      'bio',
      'show_photo',
      'show_member_number',
      'show_credentials',
      'show_employment',
      'show_portfolio',
      'show_learning'
    ].forEach(name => set(name, data?.[name]));

    return form;
  }

  function publicProfilePayload(form) {
    const value = name => form.elements.namedItem(name)?.value?.trim?.() || '';
    const checked = name => !!form.elements.namedItem(name)?.checked;

    return {
      enabled: checked('enabled'),
      headline: value('headline') || null,
      bio: value('bio') || null,
      show_photo: checked('show_photo'),
      show_member_number: checked('show_member_number'),
      show_credentials: checked('show_credentials'),
      show_employment: checked('show_employment'),
      show_portfolio: checked('show_portfolio'),
      show_learning: checked('show_learning')
    };
  }

  function renderPublicProfileSettings(root, data) {
    root.innerHTML = `
      <div class="nurselink-public-profile-heading">
        <div>
          <span>SHAREABLE PROFILE</span>
          <h2>Digital Nurse Profile</h2>
          <p>
            Create a professional public profile you control. NurseLink publishes
            only the sections you explicitly enable.
          </p>
        </div>

        <em data-enabled="${data.enabled}">
          ${data.enabled ? 'Public' : 'Private'}
        </em>
      </div>

      <div class="nurselink-public-profile-share">
        <div>
          <span>SHARE LINK</span>
          <strong>${nlV200Escape(data.share_url)}</strong>
          <small>${data.enabled ? 'Anyone with this link can view the enabled sections.' : 'This link stays unavailable until you enable the profile.'}</small>
        </div>

        <div>
          ${data.enabled ? `<a href="${nlV200Escape(data.share_url)}" target="_blank" rel="noopener">Preview Public Profile ↗</a>` : ''}
          <button type="button" class="copy">Copy Link</button>
        </div>
      </div>

      <div class="nurselink-public-profile-editor-wrap"></div>

      <div class="nurselink-public-profile-privacy">
        <strong>Privacy by design:</strong>
        credential numbers, reviewer notes, contact details, addresses, application
        data and uploaded documents are not exposed by the public-profile endpoint.
      </div>
    `;

    root.querySelector('.copy')
      ?.addEventListener('click', async event => {
        const button = event.currentTarget;

        try {
          await navigator.clipboard.writeText(data.share_url);
          button.textContent = 'Copied ✓';
          setTimeout(() => button.textContent = 'Copy Link', 1600);
        } catch (_) {
          window.prompt('Copy this public profile link:', data.share_url);
        }
      });

    const wrap = root.querySelector('.nurselink-public-profile-editor-wrap');
    const form = publicProfileSettingsForm(data);
    wrap.appendChild(form);

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const status = form.querySelector('.nurselink-public-profile-editor-status');
      const submit = form.querySelector('button[type="submit"]');

      status.textContent = 'Saving public profile settings…';
      status.dataset.tone = 'loading';
      submit.disabled = true;

      try {
        const payload = await nurseLinkJsonRequest(PUBLIC_PROFILE_API, '/settings', {
          method: 'PUT',
          body: JSON.stringify(publicProfilePayload(form))
        });

        publicProfileState.data = payload?.data || null;
        publicProfileState.loaded = true;
        renderPublicProfileSettings(root, publicProfileState.data);
      } catch (error) {
        status.textContent = error.message;
        status.dataset.tone = 'error';
      } finally {
        submit.disabled = false;
      }
    });
  }

  async function enhancePublicDigitalProfile(page) {
    if (!page || !['portfolio', 'profile'].includes(routeSlug())) return;

    let membership;

    try {
      membership = await loadMembership();
    } catch (_) {
      return;
    }

    if (!membership || membership.status !== 'approved') return;

    let root = page.querySelector('.nurselink-public-profile-settings');

    if (!root) {
      root = document.createElement('section');
      root.className = 'nurselink-public-profile-settings';

      const anchor =
        page.querySelector('.nurselink-professional-portfolio') ||
        page.querySelector('.nurselink-digital-member-card') ||
        page.querySelector('.page-header');

      if (anchor) anchor.insertAdjacentElement('afterend', root);
      else page.insertBefore(root, page.firstChild);
    }

    try {
      const settings = await loadPublicProfileSettings();
      renderPublicProfileSettings(root, settings);
    } catch (error) {
      root.innerHTML = `
        <div class="nurselink-public-profile-error">
          <strong>Public profile settings unavailable</strong>
          <small>${error.message}</small>
        </div>
      `;
    }
  }

  function enhanceV260(page) {
    enhancePublicDigitalProfile(page);
  }

  /* =========================================================
     NurseLink v5.5.2 — stale browser cache defense
     ========================================================= */

  function installNurseLinkCacheGuard() {
    try {
      document.documentElement.setAttribute('data-nurselink-cache-guard', 'v263');

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations()
          .then(registrations => {
            registrations.forEach(registration => {
              const scope = registration.scope || '';
              if (scope.startsWith(location.origin)) {
                registration.unregister().catch(() => {});
              }
            });
          })
          .catch(() => {});
      }

      if ('caches' in window) {
        caches.keys()
          .then(keys => Promise.all(
            keys
              .filter(key => /nurselink|vite|workbox|precache/i.test(key))
              .map(key => caches.delete(key))
          ))
          .catch(() => {});
      }
    } catch (_) {}
  }

  installNurseLinkCacheGuard();


  /* =========================================================
     NurseLink v5.5.2 — Partner Portal launcher
     ========================================================= */

  function enhancePartnerPortalLauncher(page) {
    if (!page) return;

    const params = new URLSearchParams(location.search);

    if (params.get('partner') !== '1') return;

    let card = page.querySelector('.nurselink-partner-portal-launcher');

    if (card) return;

    card = document.createElement('section');
    card.className = 'nurselink-partner-portal-launcher';
    card.innerHTML = `
      <div>
        <span>EMPLOYER / PARTNER ACCESS</span>
        <strong>NurseLink Partner Portal</strong>
        <small>
          For verified hospitals, health systems, recruitment partners and
          authorized institutional users.
        </small>
      </div>
      <a href="/nurselink-partner-portal.html">Open Partner Portal →</a>
    `;

    const anchor = page.querySelector('.page-header');
    if (anchor) anchor.insertAdjacentElement('afterend', card);
    else page.insertBefore(card, page.firstChild);
  }

  function enhanceV270(page) {
    enhancePartnerPortalLauncher(page);
  }


  /* =========================================================
     NurseLink v5.5.2 — Candidate Messaging + Interviews
     ========================================================= */

  const APPLICATION_COMM_API = 'https://api.amsertech.com/api/job-applications';

  function v280Escape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function v280Label(value) {
    return String(value || '')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  async function loadCandidateCommunication(applicationId) {
    const payload = await nurseLinkJsonRequest(
      APPLICATION_COMM_API,
      `/${applicationId}/communications`
    );

    return payload?.data || null;
  }

  async function sendCandidateMessage(applicationId, body) {
    return nurseLinkJsonRequest(
      APPLICATION_COMM_API,
      `/${applicationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ body })
      }
    );
  }

  async function markCandidateMessagesRead(applicationId) {
    return nurseLinkJsonRequest(
      APPLICATION_COMM_API,
      `/${applicationId}/messages/read`,
      { method: 'POST' }
    );
  }

  async function respondCandidateInterview(applicationId, interviewId, status, notes) {
    return nurseLinkJsonRequest(
      APPLICATION_COMM_API,
      `/${applicationId}/interviews/${interviewId}/respond`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          candidate_notes: notes || null
        })
      }
    );
  }

  function renderCandidateCommunication(root, data) {
    const messages = Array.isArray(data?.messages) ? data.messages : [];
    const interviews = Array.isArray(data?.interviews) ? data.interviews : [];
    const application = data?.application || {};

    root.innerHTML = `
      <div class="nurselink-comm-heading">
        <div>
          <span>EMPLOYER COMMUNICATION</span>
          <strong>${v280Escape(application.partner_name || application.employer_name || 'NurseLink Partner')}</strong>
          <small>${v280Escape(application.job_title || '')}</small>
        </div>
        <em>${v280Escape(v280Label(application.status))}</em>
      </div>

      <div class="nurselink-comm-layout">
        <section class="nurselink-message-panel">
          <div class="nurselink-panel-title">
            <strong>Messages</strong>
            <small>Messages are available only for this job application.</small>
          </div>

          <div class="nurselink-message-list">
            ${messages.length ? messages.map(message => `
              <article data-sender="${v280Escape(message.sender_type)}">
                <span>${message.sender_type === 'candidate' ? 'You' : 'Employer / Partner'}</span>
                <p>${v280Escape(message.body)}</p>
                <small>${v280Escape(String(message.created_at || '').replace('T', ' ').slice(0, 16))}</small>
              </article>
            `).join('') : `
              <div class="nurselink-comm-empty">No messages yet.</div>
            `}
          </div>

          <form class="nurselink-message-form">
            <textarea name="body" rows="3" maxlength="5000" required placeholder="Write a message about this application."></textarea>
            <div class="status" aria-live="polite"></div>
            <button type="submit" class="primary-button">Send Message</button>
          </form>
        </section>

        <section class="nurselink-interview-panel">
          <div class="nurselink-panel-title">
            <strong>Interviews</strong>
            <small>Confirm, request a new schedule, or cancel an invitation.</small>
          </div>

          <div class="nurselink-interview-list">
            ${interviews.length ? interviews.map(interview => `
              <article data-interview-id="${interview.id}">
                <div class="nurselink-interview-head">
                  <div>
                    <span>${v280Escape(v280Label(interview.mode))} INTERVIEW</span>
                    <strong>${v280Escape(String(interview.scheduled_start || '').replace('T', ' ').slice(0, 16))}</strong>
                    <small>${v280Escape(interview.timezone || '')}</small>
                  </div>
                  <em data-status="${v280Escape(interview.status)}">${v280Escape(v280Label(interview.status))}</em>
                </div>

                ${interview.location_or_link ? `
                  <div class="nurselink-interview-location">
                    ${/^https?:\/\//i.test(interview.location_or_link)
                      ? `<a href="${v280Escape(interview.location_or_link)}" target="_blank" rel="noopener">Open Interview Link ↗</a>`
                      : `<span>${v280Escape(interview.location_or_link)}</span>`}
                  </div>
                ` : ''}

                ${interview.partner_notes ? `<p>${v280Escape(interview.partner_notes)}</p>` : ''}

                ${!['completed','cancelled'].includes(interview.status) ? `
                  <div class="nurselink-interview-response">
                    <textarea name="candidate_notes" rows="2" maxlength="3000" placeholder="Optional note or preferred reschedule time.">${v280Escape(interview.candidate_notes || '')}</textarea>
                    <div class="buttons">
                      <button type="button" data-response="confirmed">Confirm</button>
                      <button type="button" data-response="reschedule_requested">Request Reschedule</button>
                      <button type="button" data-response="cancelled">Cancel</button>
                    </div>
                    <div class="status"></div>
                  </div>
                ` : ''}
              </article>
            `).join('') : `
              <div class="nurselink-comm-empty">No interview invitations yet.</div>
            `}
          </div>
        </section>
      </div>

      <div class="nurselink-comm-privacy">
        Employer messaging is application-specific. This channel does not expose your
        home address, private documents, credential numbers, or private portfolio content.
      </div>
    `;

    const form = root.querySelector('.nurselink-message-form');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const body = form.elements.namedItem('body')?.value?.trim() || '';
      const status = form.querySelector('.status');
      const button = form.querySelector('button[type="submit"]');

      if (!body) return;

      status.textContent = 'Sending…';
      button.disabled = true;

      try {
        await sendCandidateMessage(application.id, body);
        const refreshed = await loadCandidateCommunication(application.id);
        renderCandidateCommunication(root, refreshed);
      } catch (error) {
        status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });

    root.querySelectorAll('[data-response]').forEach(button => {
      button.addEventListener('click', async () => {
        const card = button.closest('[data-interview-id]');
        const interviewId = Number(card?.dataset.interviewId);
        const notes = card?.querySelector('[name="candidate_notes"]')?.value?.trim() || '';
        const status = card?.querySelector('.nurselink-interview-response .status');

        button.disabled = true;
        status.textContent = 'Saving response…';

        try {
          await respondCandidateInterview(
            application.id,
            interviewId,
            button.dataset.response,
            notes
          );

          const refreshed = await loadCandidateCommunication(application.id);
          renderCandidateCommunication(root, refreshed);
        } catch (error) {
          status.textContent = error.message;
        } finally {
          button.disabled = false;
        }
      });
    });

    markCandidateMessagesRead(application.id).catch(() => {});
  }

  async function enhanceCandidateCommunications(page) {
    if (!page || routeSlug() !== 'applications' || !isApprovedMemberPortal()) return;

    try {
      await loadOpportunityCenter();
    } catch (_) {
      return;
    }

    if (!opportunityState.applications.length) return;

    let root = page.querySelector('.nurselink-application-communications');

    if (!root) {
      root = document.createElement('section');
      root.className = 'nurselink-application-communications';

      const pipeline = page.querySelector('.nurselink-applications-pipeline');
      if (pipeline) pipeline.insertAdjacentElement('afterend', root);
      else page.appendChild(root);
    }

    root.innerHTML = `
      <div class="nurselink-comm-selector">
        <div>
          <span>MESSAGES & INTERVIEWS</span>
          <strong>Employer Communication</strong>
          <small>Select a tracked application to view its partner communication channel.</small>
        </div>

        <select aria-label="Select application">
          ${opportunityState.applications.map(app => `
            <option value="${Number(app.id)}">
              ${v280Escape(app.title || 'Application')} · ${v280Escape(app.employer_name || '')}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="nurselink-comm-content">
        <div class="nurselink-comm-loading">Loading communication…</div>
      </div>
    `;

    const select = root.querySelector('select');
    const content = root.querySelector('.nurselink-comm-content');

    const loadSelected = async () => {
      content.innerHTML = '<div class="nurselink-comm-loading">Loading communication…</div>';

      try {
        const data = await loadCandidateCommunication(Number(select.value));
        renderCandidateCommunication(content, data);
      } catch (error) {
        content.innerHTML = `
          <div class="nurselink-comm-unavailable">
            <strong>Partner communication is not available</strong>
            <small>${v280Escape(error.message)}</small>
          </div>
        `;
      }
    };

    select.addEventListener('change', loadSelected);
    await loadSelected();
  }

  function enhanceV280(page) {
    enhanceCandidateCommunications(page);
  }


  /* =========================================================
     NurseLink v5.5.2 — Institutional Analytics launcher
     ========================================================= */

  function enhanceInstitutionalAnalyticsLauncher(page) {
    if (!page || routeSlug() !== 'admin') return;

    let card = page.querySelector('.nurselink-institutional-analytics-launcher');
    if (card) return;

    card = document.createElement('section');
    card.className = 'nurselink-institutional-analytics-launcher';
    card.innerHTML = `
      <div>
        <span>RECRUITMENT INTELLIGENCE</span>
        <strong>Institutional Analytics</strong>
        <small>Aggregate partner, opportunity, application, interview and offer reporting.</small>
      </div>
      <a href="/nurselink-institutional-analytics.html">Open Analytics →</a>
    `;

    const anchor = page.querySelector('.page-header');
    if (anchor) anchor.insertAdjacentElement('afterend', card);
    else page.insertBefore(card, page.firstChild);
  }

  function enhanceV290(page) {
    enhanceInstitutionalAnalyticsLauncher(page);
  }

  /* NurseLink v5.5.2 — Production UAT launcher */

  /*
   * NurseLink v5.5.2 — build-persistent release marker.
   * DOM mutation is a runtime side effect and cannot be tree-shaken.
   */
  const NURSELINK_RUNTIME_V326 = 'nurselink-runtime-v326';

  document.documentElement.setAttribute(
    'data-nurselink-runtime',
    NURSELINK_RUNTIME_V326
  );

  document.documentElement.setAttribute(
    'data-nurselink-release',
    '5.5.2'
  );

  document.documentElement.setAttribute(
    'data-nurselink-release-stage',
    'production'
  );

  document.documentElement.setAttribute(
    'data-nurselink-production',
    'stable'
  );

  function enhanceProductionUatLauncher(page) {
    if (!page || routeSlug() !== 'admin') return;

    let card = page.querySelector('.nurselink-production-uat-launcher');
    if (card) return;

    card = document.createElement('section');
    card.className = 'nurselink-production-uat-launcher';
    card.dataset.nurselinkRuntime = NURSELINK_RUNTIME_V326;
    card.dataset.nurselinkRelease = '5.5.2';
    card.dataset.nurselinkStage = 'production';
    card.innerHTML = `
      <div>
        <span>RELEASE VERIFICATION</span>
        <strong>Production UAT & Readiness</strong>
        <small>Run automated environment checks and the formal end-to-end acceptance checklist.</small>
      </div>
      <a href="/nurselink-production-readiness.html">Open UAT Center →</a>
    `;

    const analytics = page.querySelector('.nurselink-institutional-analytics-launcher');
    if (analytics) analytics.insertAdjacentElement('afterend', card);
    else {
      const header = page.querySelector('.page-header');
      if (header) header.insertAdjacentElement('afterend', card);
      else page.insertBefore(card, page.firstChild);
    }
  }

  function enhanceOperationsCenterLauncher(page) {
    if (!page || routeSlug() !== 'admin') return;

    let card = page.querySelector('.nurselink-operations-center-launcher');
    if (card) return;

    card = document.createElement('section');
    card.className = 'nurselink-operations-center-launcher';
    card.innerHTML = `
      <div>
        <span>PRODUCTION OPERATIONS</span>
        <strong>Operations Center</strong>
        <small>Health snapshots, incidents, deployment history, backups and reliability monitoring.</small>
      </div>
      <a href="/nurselink-operations-center.html">Open Operations Center →</a>
    `;

    const uat = page.querySelector('.nurselink-production-uat-launcher');
    if (uat) uat.insertAdjacentElement('afterend', card);
    else {
      const analytics = page.querySelector('.nurselink-institutional-analytics-launcher');
      if (analytics) analytics.insertAdjacentElement('afterend', card);
      else {
        const header = page.querySelector('.page-header');
        if (header) header.insertAdjacentElement('afterend', card);
        else page.insertBefore(card, page.firstChild);
      }
    }
  }

  function enhanceCareerIntelligenceLauncher(page) {
    if (!page || !isApprovedMemberPortal()) return;

    const slug = routeSlug();

    if (!['dashboard', 'jobs', 'learning', 'qualifications'].includes(slug)) {
      return;
    }

    let card = page.querySelector('.nurselink-career-intelligence-launcher');

    if (card) return;

    card = document.createElement('section');
    card.className = 'nurselink-career-intelligence-launcher';

    card.innerHTML = `
      <div>
        <span>CAREER INTELLIGENCE</span>
        <strong>Professional Growth & Mobility Insights</strong>
        <small>Readiness score, credential expiry forecast, learning priorities and explainable job-fit guidance.</small>
      </div>
      <a href="/nurselink-career-intelligence.html">Open Career Intelligence →</a>
    `;

    if (slug === 'dashboard') {
      const hub = page.querySelector('.nurselink-member-hub');
      if (hub) hub.appendChild(card);
      else {
        const header = page.querySelector('.page-header');
        if (header) header.insertAdjacentElement('afterend', card);
        else page.insertBefore(card, page.firstChild);
      }
      return;
    }

    const career = page.querySelector('.nurselink-career-matching');
    const learning = page.querySelector('.nurselink-learning-tracker');
    const qualification = page.querySelector('.nurselink-qualification-readiness');

    if (career) career.insertAdjacentElement('afterend', card);
    else if (learning) learning.insertAdjacentElement('afterend', card);
    else if (qualification) qualification.insertAdjacentElement('afterend', card);
    else {
      const header = page.querySelector('.page-header');
      if (header) header.insertAdjacentElement('afterend', card);
      else page.insertBefore(card, page.firstChild);
    }
  }

  function enhanceCredentialRenewalLauncher(page) {
    if (!page || !isApprovedMemberPortal()) return;

    const slug = routeSlug();

    if (!['dashboard', 'learning', 'qualifications', 'credentials'].includes(slug)) {
      return;
    }

    let card = page.querySelector(
      '.nurselink-credential-renewal-launcher'
    );

    if (card) return;

    card = document.createElement('section');
    card.className = 'nurselink-credential-renewal-launcher';

    card.innerHTML = `
      <div>
        <span>CREDENTIAL RENEWAL</span>
        <strong>Professional Compliance Planning</strong>
        <small>
          Track expiry timelines, renewal priorities and credentials that need
          attention before they lapse.
        </small>
      </div>
      <a href="/nurselink-credential-renewal.html">
        Open Renewal Center →
      </a>
    `;

    if (slug === 'dashboard') {
      const hub = page.querySelector('.nurselink-member-hub');

      if (hub) {
        hub.appendChild(card);
      } else {
        const header = page.querySelector('.page-header');

        if (header) {
          header.insertAdjacentElement('afterend', card);
        } else {
          page.insertBefore(card, page.firstChild);
        }
      }

      return;
    }

    const anchorNode =
      page.querySelector('.nurselink-qualification-readiness')
      || page.querySelector('.nurselink-learning-tracker')
      || page.querySelector('.nurselink-career-intelligence-launcher')
      || page.querySelector('.page-header');

    if (anchorNode) {
      anchorNode.insertAdjacentElement('afterend', card);
    } else {
      page.insertBefore(card, page.firstChild);
    }
  }

  function enhanceEnterpriseLauncher(page) {
    if (!page || !isApprovedMemberPortal()) return;

    const slug = routeSlug();

    if (!['dashboard', 'profile'].includes(slug)) {
      return;
    }

    if (page.querySelector('.nurselink-enterprise-launcher')) {
      return;
    }

    const card = document.createElement('section');
    card.className = 'nurselink-enterprise-launcher';
    card.dataset.nurselinkEnterprise = 'v5.5.2';

    card.innerHTML = `
      <div>
        <span>ENTERPRISE PLATFORM</span>
        <strong>Institutional Cohorts</strong>
        <small>
          View NurseLink institutional cohort assignments linked
          to verified partner organizations.
        </small>
      </div>
      <a href="/nurselink-enterprise.html">
        Open Enterprise →
      </a>
    `;

    const anchorNode =
      page.querySelector('.nurselink-benefits-launcher')
      || page.querySelector('.nurselink-engagement-hub-launcher')
      || page.querySelector('.page-header');

    if (anchorNode) {
      anchorNode.insertAdjacentElement('afterend', card);
    } else {
      page.insertBefore(card, page.firstChild);
    }
  }

  function enhanceBenefitsLauncher(page) {
    if (!page || !isApprovedMemberPortal()) return;

    const slug = routeSlug();

    if (!['dashboard', 'profile'].includes(slug)) {
      return;
    }

    if (page.querySelector('.nurselink-benefits-launcher')) {
      return;
    }

    const card = document.createElement('section');
    card.className = 'nurselink-benefits-launcher';
    card.dataset.nurselinkBenefits = 'v5.5.2';

    card.innerHTML = `
      <div>
        <span>MEMBER BENEFITS & RESOURCES</span>
        <strong>Explore Member Support</strong>
        <small>
          Browse NurseLink resources, professional support offers
          and member opportunities subject to listed terms.
        </small>
      </div>
      <a href="/nurselink-benefits.html">
        Browse Benefits →
      </a>
    `;

    const anchorNode =
      page.querySelector('.nurselink-engagement-hub-launcher')
      || page.querySelector('.nurselink-mentoring-launcher')
      || page.querySelector('.page-header');

    if (anchorNode) {
      anchorNode.insertAdjacentElement('afterend', card);
    } else {
      page.insertBefore(card, page.firstChild);
    }
  }

  function enhanceEngagementHubLauncher(page) {
    if (!page || !isApprovedMemberPortal()) return;

    const slug = routeSlug();

    if (!['dashboard', 'profile'].includes(slug)) {
      return;
    }

    if (page.querySelector('.nurselink-engagement-hub-launcher')) {
      return;
    }

    const card = document.createElement('section');
    card.className = 'nurselink-engagement-hub-launcher';
    card.dataset.nurselinkEngagementHub = 'v5.5.2';

    card.innerHTML = `
      <div>
        <span>MEMBER ENGAGEMENT HUB</span>
        <strong>Your NurseLink Community</strong>
        <small>
          One place for chapters, events, mentoring
          and recommended community actions.
        </small>
      </div>
      <a href="/nurselink-engagement.html">
        Open Engagement Hub →
      </a>
    `;

    const anchorNode =
      page.querySelector('.nurselink-mentoring-launcher')
      || page.querySelector('.nurselink-chapters-launcher')
      || page.querySelector('.page-header');

    if (anchorNode) {
      anchorNode.insertAdjacentElement('afterend', card);
    } else {
      page.insertBefore(card, page.firstChild);
    }
  }

  function enhanceMentoringLauncher(page) {
    if (!page || !isApprovedMemberPortal()) return;

    const slug = routeSlug();

    if (!['dashboard', 'profile', 'learning'].includes(slug)) {
      return;
    }

    if (page.querySelector('.nurselink-mentoring-launcher')) {
      return;
    }

    const card = document.createElement('section');
    card.className = 'nurselink-mentoring-launcher';
    card.dataset.nurselinkMentoring = 'v5.5.2';

    card.innerHTML = `
      <div>
        <span>MENTORING & PEER SUPPORT</span>
        <strong>Connect with NurseLink Members</strong>
        <small>
          Create an opt-in mentoring profile, discover mentors
          and manage professional mentoring requests.
        </small>
      </div>
      <a href="/nurselink-mentoring.html">
        Open Mentoring →
      </a>
    `;

    const anchorNode =
      page.querySelector('.nurselink-chapters-launcher')
      || page.querySelector('.nurselink-events-programs-launcher')
      || page.querySelector('.page-header');

    if (anchorNode) {
      anchorNode.insertAdjacentElement('afterend', card);
    } else {
      page.insertBefore(card, page.firstChild);
    }
  }

  function enhanceChaptersLauncher(page) {
    if (!page || !isApprovedMemberPortal()) return;

    const slug = routeSlug();

    if (!['dashboard', 'profile'].includes(slug)) {
      return;
    }

    if (page.querySelector('.nurselink-chapters-launcher')) {
      return;
    }

    const card = document.createElement('section');
    card.className = 'nurselink-chapters-launcher';
    card.dataset.nurselinkChapters = 'v5.5.2';

    card.innerHTML = `
      <div>
        <span>CHAPTERS & COMMUNITIES</span>
        <strong>Connect with Your Nurse Community</strong>
        <small>
          Join regional, overseas, institutional and
          professional-interest NurseLink communities.
        </small>
      </div>
      <a href="/nurselink-chapters.html">
        Explore Chapters →
      </a>
    `;

    const anchorNode =
      page.querySelector('.nurselink-events-programs-launcher')
      || page.querySelector('.nurselink-credential-renewal-launcher')
      || page.querySelector('.page-header');

    if (anchorNode) {
      anchorNode.insertAdjacentElement('afterend', card);
    } else {
      page.insertBefore(card, page.firstChild);
    }
  }

  function enhanceEventsProgramsLauncher(page) {
    if (!page || !isApprovedMemberPortal()) return;

    const slug = routeSlug();

    if (!['dashboard', 'learning', 'profile'].includes(slug)) {
      return;
    }

    if (page.querySelector('.nurselink-events-programs-launcher')) {
      return;
    }

    const card = document.createElement('section');
    card.className = 'nurselink-events-programs-launcher';
    card.dataset.nurselinkEventsPrograms = 'v5.5.2';

    card.innerHTML = `
      <div>
        <span>EVENTS & PROGRAMS</span>
        <strong>Connect, Learn & Participate</strong>
        <small>
          Discover NurseLink webinars, workshops, orientations,
          networking activities and member programs.
        </small>
      </div>
      <a href="/nurselink-events.html">
        Browse Events →
      </a>
    `;

    const anchorNode =
      page.querySelector('.nurselink-credential-renewal-launcher')
      || page.querySelector('.nurselink-career-intelligence-launcher')
      || page.querySelector('.page-header');

    if (anchorNode) {
      anchorNode.insertAdjacentElement('afterend', card);
    } else {
      page.insertBefore(card, page.firstChild);
    }
  }

  function enhanceV420(page) {
    enhanceCareerIntelligenceLauncher(page);
    enhanceCredentialRenewalLauncher(page);
    enhanceEventsProgramsLauncher(page);
    enhanceChaptersLauncher(page);
    enhanceMentoringLauncher(page);
    enhanceEngagementHubLauncher(page);
    enhanceBenefitsLauncher(page);
    enhanceEnterpriseLauncher(page);
  }

  function enhanceV320(page) {
    enhanceProductionUatLauncher(page);
    enhanceOperationsCenterLauncher(page);
  }

  /* =========================================================
     NurseLink v5.5.2 — Server-confirmed Super Administrator identity
     ========================================================= */

  const NURSELINK_SESSION_IDENTITY_API =
    `${NURSELINK_API_ORIGIN}/api/nurselink/session-identity`;

  const nurselinkIdentityState = {
    loaded: false,
    loading: null,
    data: null
  };

  async function loadNurseLinkSessionIdentity(force = false) {
    if (nurselinkIdentityState.loaded && !force) {
      return nurselinkIdentityState.data;
    }

    if (nurselinkIdentityState.loading && !force) {
      return nurselinkIdentityState.loading;
    }

    nurselinkIdentityState.loading = nurseLinkJsonRequest(
      NURSELINK_SESSION_IDENTITY_API
    )
      .then(payload => {
        nurselinkIdentityState.data = payload?.data || null;
        nurselinkIdentityState.loaded = true;
        return nurselinkIdentityState.data;
      })
      .finally(() => {
        nurselinkIdentityState.loading = null;
      });

    return nurselinkIdentityState.loading;
  }

  function clearSuperAdministratorIdentity(shell) {
    document.documentElement.classList.remove(
      'nurselink-super-admin-session'
    );

    document.documentElement.removeAttribute(
      'data-nurselink-access-level'
    );

    shell?.querySelectorAll(
      '.nurselink-super-admin-badge,.nurselink-super-admin-banner'
    ).forEach(node => node.remove());


    shell?.querySelector(
      '.nurselink-super-admin-center-link'
    )?.remove();


    shell?.querySelector(
      '.nurselink-super-admin-test-center-link'
    )?.remove();

    clearSuperAdminTestModeDecoration(shell);

    shell?.querySelector(
      '.nurselink-access-membership-summary'
    )?.remove();

    shell?.removeAttribute(
      'data-nurselink-role-membership-clarity'
    );

    if (shell?._nurselinkSuperAdminPortalObserver) {
      shell._nurselinkSuperAdminPortalObserver.disconnect();
      delete shell._nurselinkSuperAdminPortalObserver;
    }

    const underlyingPortalLabel = isApplicantPortal()
      ? 'Applicant Portal'
      : 'Member Portal';

    const topbar = shell?.querySelector('.topbar');

    if (topbar) {
      [
        ...topbar.querySelectorAll(
          '[data-nurselink-super-admin-portal-label="1"]'
        )
      ].forEach(node => {
        node.textContent = underlyingPortalLabel;
        node.classList.remove(
          'nurselink-super-admin-portal-label'
        );
        node.removeAttribute(
          'data-nurselink-super-admin-portal-label'
        );
      });
    }

    shell?.querySelectorAll('.nurselink-super-admin-user')
      .forEach(node => {
        node.classList.remove('nurselink-super-admin-user');
        node.removeAttribute('data-nurselink-role');
      });
  }

  /* =========================================================
     NurseLink v5.5.2 — System Access vs Membership Identity Clarity
     ========================================================= */

  const nurselinkRoleClarityState = {
    membershipLoading: null,
    lastRoute: null
  };

  function portalLabelCandidates(topbar) {
    if (!topbar) return [];

    return [
      topbar,
      ...topbar.querySelectorAll('*')
    ].filter(node => {
      if (!node || node.children.length > 0) return false;

      const value = (node.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();

      return /^(Applicant|Member|Reviewer|Administrator|Admin|Super Administrator)\s+Portal$/i
        .test(value);
    });
  }

  function findPortalLabel(topbar) {
    return portalLabelCandidates(topbar)[0] || null;
  }

  function enforceSuperAdministratorPortalLabel(shell) {
    const topbar = shell?.querySelector('.topbar');
    if (!topbar) return false;

    let changed = false;

    portalLabelCandidates(topbar).forEach(node => {
      const current = (node.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();

      if (current !== 'Super Administrator Portal') {
        node.textContent = 'Super Administrator Portal';
        changed = true;
      }

      node.classList.add(
        'nurselink-super-admin-portal-label'
      );
      node.setAttribute(
        'data-nurselink-super-admin-portal-label',
        '1'
      );
    });

    return changed;
  }

  function ensureSuperAdministratorPortalLabelObserver(shell) {
    if (!shell || shell._nurselinkSuperAdminPortalObserver) {
      return;
    }

    let scheduled = false;

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;

      window.requestAnimationFrame(() => {
        scheduled = false;

        if (
          document.documentElement.classList.contains(
            'nurselink-super-admin-session'
          )
        ) {
          enforceSuperAdministratorPortalLabel(shell);
        }
      });
    };

    const observer = new MutationObserver(schedule);

    observer.observe(shell, {
      childList: true,
      subtree: true,
      characterData: true
    });

    shell._nurselinkSuperAdminPortalObserver = observer;
    schedule();
  }

  function ensureSuperAdminCenterLink(sidebar) {
    if (!sidebar) return null;

    let link = sidebar.querySelector(
      '.nurselink-super-admin-center-link'
    );

    if (link) return link;

    link = document.createElement('a');
    link.className = 'nurselink-super-admin-center-link';
    link.href = '/admin/login.html';
    link.setAttribute('data-nurselink-system-access', 'super-admin');
    link.setAttribute('aria-label', 'Open separate NurseLink Administrator sign-in');

    link.innerHTML = `
      <span class="nurselink-super-admin-center-icon" aria-hidden="true">SA</span>
      <span class="nurselink-super-admin-center-copy">
        <strong>Admin Center</strong>
        <small>Super Administrator</small>
      </span>
    `;

    const signOut = [...sidebar.querySelectorAll('a,button')]
      .find(node => {
        const value = (node.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();

        return value === 'sign out'
          || value === 'logout'
          || value === 'log out';
      });

    if (signOut?.parentElement) {
      signOut.insertAdjacentElement('beforebegin', link);
    } else {
      sidebar.appendChild(link);
    }

    return link;
  }

  function ensureSuperAdminTestCenterLink(sidebar) {
    if (!sidebar) return null;

    let link = sidebar.querySelector(
      '.nurselink-super-admin-test-center-link'
    );

    if (link) return link;

    link = document.createElement('a');
    link.className = 'nurselink-super-admin-test-center-link';
    link.href = '/nurselink-super-admin-test-center.html';
    link.setAttribute(
      'data-nurselink-system-access',
      'super-admin-test'
    );
    link.setAttribute(
      'aria-label',
      'Open Super Administrator Test Center'
    );

    link.innerHTML = `
      <span class="nurselink-super-admin-center-icon" aria-hidden="true">QA</span>
      <span class="nurselink-super-admin-center-copy">
        <strong>Test Center</strong>
        <small>Super Administrator QA</small>
      </span>
    `;

    const adminLink = sidebar.querySelector(
      '.nurselink-super-admin-center-link'
    );

    if (adminLink) {
      adminLink.insertAdjacentElement('afterend', link);
    } else {
      sidebar.appendChild(link);
    }

    return link;
  }

  const nurselinkSuperAdminTestModeState = {
    loaded: false,
    loading: null,
    data: null
  };

  function clearSuperAdminTestModeDecoration(shell) {
    document.documentElement.classList.remove(
      'nurselink-super-admin-test-mode'
    );

    document.documentElement.removeAttribute(
      'data-nurselink-super-admin-test-mode'
    );

    shell?.querySelector(
      '.nurselink-super-admin-test-mode-banner'
    )?.remove();

    document.documentElement.classList.remove(
      'nurselink-member-locked'
    );
  }

  function applySuperAdminTestModeDecoration(shell, page, data) {
    if (!shell || !data?.active) {
      clearSuperAdminTestModeDecoration(shell);
      return;
    }

    document.documentElement.classList.add(
      'nurselink-super-admin-test-mode'
    );

    document.documentElement.setAttribute(
      'data-nurselink-super-admin-test-mode',
      'v453'
    );

    document.documentElement.classList.remove(
      'nurselink-member-locked'
    );

    let banner = shell.querySelector(
      '.nurselink-super-admin-test-mode-banner'
    );

    if (!banner) {
      banner = document.createElement('section');
      banner.className =
        'nurselink-super-admin-test-mode-banner';

      const header = page?.querySelector('.page-header');

      if (header) {
        header.insertAdjacentElement('afterend', banner);
      } else if (page) {
        page.insertBefore(banner, page.firstChild);
      }
    }

    const expires = Number(data.expires_at || 0);
    const expiryText = expires
      ? new Date(expires * 1000).toLocaleTimeString()
      : 'session expiry';

    banner.innerHTML = `
      <div>
        <strong>SUPER ADMINISTRATOR TEST MODE ACTIVE</strong>
        <small>
          Member-only access is temporarily enabled for functional testing.
          Your real membership status is unchanged.
        </small>
      </div>
      <div>
        <span>Membership: ${
          nlV200Escape(
            membershipStatusLabel(
              data.membership_status || 'pending'
            )
          )
        }</span>
        <span>Expires: ${nlV200Escape(expiryText)}</span>
        <a href="/nurselink-super-admin-test-center.html">
          Test Center
        </a>
      </div>
    `;
  }

  async function loadSuperAdminTestModeState(force = false) {
    if (
      nurselinkSuperAdminTestModeState.loaded
      && !force
    ) {
      return nurselinkSuperAdminTestModeState.data;
    }

    if (
      nurselinkSuperAdminTestModeState.loading
      && !force
    ) {
      return nurselinkSuperAdminTestModeState.loading;
    }

    nurselinkSuperAdminTestModeState.loading =
      nurseLinkJsonRequest(
        `${NURSELINK_API_ORIGIN}/api/nurselink/admin/test-mode/session`
      )
        .then(payload => {
          nurselinkSuperAdminTestModeState.data =
            payload?.data || null;
          nurselinkSuperAdminTestModeState.loaded = true;
          return nurselinkSuperAdminTestModeState.data;
        })
        .finally(() => {
          nurselinkSuperAdminTestModeState.loading = null;
        });

    return nurselinkSuperAdminTestModeState.loading;
  }

  function enhanceSuperAdminTestMode(shell, page) {
    if (
      !shell
      || nurseLinkIsPublicAuthRoute()
      || !document.documentElement.classList.contains(
        'nurselink-super-admin-session'
      )
    ) {
      clearSuperAdminTestModeDecoration(shell);
      return;
    }

    ensureSuperAdminTestCenterLink(
      shell.querySelector('.sidebar')
    );

    loadSuperAdminTestModeState()
      .then(data => {
        applySuperAdminTestModeDecoration(
          document.querySelector(ROOT_SELECTOR),
          document.querySelector(`${ROOT_SELECTOR} .page`)
            || document.querySelector(`${ROOT_SELECTOR} main`),
          data
        );
      })
      .catch(() => {
        clearSuperAdminTestModeDecoration(shell);
      });
  }

  function membershipRoleFromData(membership) {
    if (!membership) return 'Applicant';

    return membership.status === 'approved'
      ? 'Member'
      : 'Applicant';
  }

  function membershipStandingLabel(membership) {
    if (!membership) return 'Pending';

    if (membership.status === 'approved') return 'Approved';

    return membershipStatusLabel(
      membership.status || 'submitted'
    );
  }

  function updateMembershipRoleStat(page, membership) {
    if (!page) return;

    const cards = [...page.querySelectorAll('.stat-card')];

    const roleCard = cards.find(card => {
      const text = (card.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();

      return /^Role\b/i.test(text)
        || /Current access level/i.test(text);
    });

    if (!roleCard) return;

    const leafNodes = [...roleCard.querySelectorAll('span,small,p,div')]
      .filter(node => node.children.length === 0);

    const roleLabel = leafNodes.find(node =>
      /^Role$/i.test((node.textContent || '').trim())
    );

    if (roleLabel) {
      roleLabel.textContent = 'Membership Role';
    }

    const roleValue = roleCard.querySelector('strong');

    if (roleValue) {
      roleValue.textContent = membershipRoleFromData(membership);
    }

    const accessCopy = leafNodes.find(node =>
      /Current access level/i.test(
        (node.textContent || '').trim()
      )
    );

    if (accessCopy) {
      accessCopy.textContent = 'Membership standing';
    }

    roleCard.setAttribute(
      'data-nurselink-membership-role-card',
      '1'
    );
  }

  function renderSuperAdminIdentitySummary(page, membership) {
    if (!page || routeSlug() !== 'dashboard') return;

    let summary = page.querySelector(
      '.nurselink-access-membership-summary'
    );

    if (!summary) {
      summary = document.createElement('section');
      summary.className = 'nurselink-access-membership-summary';
      summary.setAttribute(
        'data-nurselink-identity-clarity',
        'system-access-membership'
      );

      const header = page.querySelector('.page-header');

      if (header) {
        header.insertAdjacentElement('afterend', summary);
      } else {
        page.insertBefore(summary, page.firstChild);
      }
    }

    const memberRole = membershipRoleFromData(membership);
    const standing = membershipStandingLabel(membership);
    const memberNumber = membership?.member_number || 'Pending';
    const applicationStatus = membership?.status
      ? membershipStatusLabel(membership.status)
      : 'Pending';

    summary.innerHTML = `
      <div class="nurselink-access-membership-summary-head">
        <div>
          <span>ACCESS & MEMBERSHIP</span>
          <strong>Your system authority and membership standing are separate.</strong>
        </div>
        <em>SERVER-CONFIRMED ACCESS</em>
      </div>

      <div class="nurselink-access-membership-summary-grid">
        <div data-kind="system">
          <span>System Access</span>
          <strong>Super Administrator</strong>
          <small>Privileged system session</small>
        </div>

        <div data-kind="membership-role">
          <span>Membership Role</span>
          <strong>${nlV200Escape(memberRole)}</strong>
          <small>Professional membership role</small>
        </div>

        <div data-kind="membership-status">
          <span>Membership Status</span>
          <strong>${nlV200Escape(standing)}</strong>
          <small>Application: ${nlV200Escape(applicationStatus)}</small>
        </div>

        <div data-kind="member-number">
          <span>Member Number</span>
          <strong>${nlV200Escape(memberNumber)}</strong>
          <small>${membership?.member_number
            ? 'Permanent NurseLink member number'
            : 'Issued after membership approval'}</small>
        </div>
      </div>
    `;
  }

  function applySuperAdminMembershipClarity(
    shell,
    page,
    identity,
    membership
  ) {
    if (!shell || !identity?.is_super_admin) return;

    const topbar = shell.querySelector('.topbar');
    const sidebar = shell.querySelector('.sidebar');

    enforceSuperAdministratorPortalLabel(shell);
    ensureSuperAdministratorPortalLabelObserver(shell);

    ensureSuperAdminCenterLink(sidebar);
    ensureSuperAdminTestCenterLink(sidebar);

    if (page) {
      updateMembershipRoleStat(page, membership);
      renderSuperAdminIdentitySummary(page, membership);
    }

    shell.setAttribute(
      'data-nurselink-role-membership-clarity',
      '1'
    );

    shell.setAttribute(
      'data-nurselink-system-access',
      'super-administrator'
    );

    shell.setAttribute(
      'data-nurselink-super-admin-portal-persistence',
      'v451'
    );
  }

  function enhanceSuperAdminMembershipClarity(
    shell,
    page,
    identity
  ) {
    if (!shell || !identity?.is_super_admin) return;

    /*
     * Apply the system-access distinction immediately, then hydrate
     * membership standing through the existing one-flight membership loader.
     */
    applySuperAdminMembershipClarity(
      shell,
      page,
      identity,
      membershipState.data
    );

    if (membershipState.loaded) return;

    if (nurselinkRoleClarityState.membershipLoading) return;

    nurselinkRoleClarityState.membershipLoading = loadMembership()
      .then(membership => {
        applySuperAdminMembershipClarity(
          document.querySelector(ROOT_SELECTOR),
          document.querySelector(`${ROOT_SELECTOR} .page`)
            || document.querySelector(`${ROOT_SELECTOR} main`),
          identity,
          membership
        );
      })
      .catch(() => {
        /*
         * System access remains visible even if membership standing
         * is temporarily unavailable.
         */
      })
      .finally(() => {
        nurselinkRoleClarityState.membershipLoading = null;
      });
  }

  function applySuperAdministratorIdentity(shell, page, identity) {
    if (!shell) return;

    if (!identity?.is_super_admin) {
      clearSuperAdministratorIdentity(shell);
      return;
    }

    document.documentElement.classList.add(
      'nurselink-super-admin-session'
    );

    document.documentElement.setAttribute(
      'data-nurselink-access-level',
      'super-admin'
    );

    const topbar = shell.querySelector('.topbar');

    if (topbar && !topbar.querySelector('.nurselink-super-admin-badge')) {
      const badge = document.createElement('div');
      badge.className = 'nurselink-super-admin-badge';
      badge.setAttribute('role', 'status');
      badge.setAttribute(
        'aria-label',
        'Signed in as NurseLink Super Administrator'
      );

      badge.innerHTML = `
        <span class="nurselink-super-admin-mark" aria-hidden="true">SA</span>
        <span class="nurselink-super-admin-copy">
          <strong>SUPER ADMINISTRATOR</strong>
          <small>Privileged session</small>
        </span>
      `;

      const userChip = topbar.querySelector('.user-chip');

      if (userChip) {
        topbar.insertBefore(badge, userChip);
      } else {
        topbar.appendChild(badge);
      }
    }

    const userChip = shell.querySelector('.user-chip');

    if (userChip) {
      userChip.classList.add('nurselink-super-admin-user');
      userChip.dataset.nurselinkRole = 'super-admin';
      userChip.setAttribute(
        'aria-label',
        'NurseLink user menu — Super Administrator'
      );
    }

    enhanceSuperAdminMembershipClarity(
      shell,
      page,
      identity
    );

    if (routeSlug() !== 'admin' || !page) return;

    let banner = page.querySelector('.nurselink-super-admin-banner');

    if (!banner) {
      banner = document.createElement('section');
      banner.className = 'nurselink-super-admin-banner';

      banner.innerHTML = `
        <div class="nurselink-super-admin-banner-mark" aria-hidden="true">SA</div>
        <div>
          <span>SUPER ADMINISTRATOR SESSION</span>
          <strong>You are signed in with elevated NurseLink system administration access.</strong>
          <small>
            This identity is confirmed by the NurseLink server. Administrator and reviewer
            actions remain subject to access controls and audit logging.
          </small>
        </div>
      `;

      const header = page.querySelector('.page-header');

      if (header) {
        header.insertAdjacentElement('afterend', banner);
      } else {
        page.insertBefore(banner, page.firstChild);
      }
    }
  }

  function enhanceSuperAdministratorIdentity(shell, page) {
    if (!shell) return;

    /*
     * v5.5.2 PUBLIC-AUTH ISOLATION
     *
     * Never issue an authenticated session-identity probe from Login,
     * Registration, Forgot Password, Reset Password or Email Verification.
     *
     * The clean-auth bootstrap intentionally keeps public auth pages free of
     * authenticated session fanout before the dedicated session-login flow.
     * This also prevents a stale session response from racing the login reset.
     */
    if (nurseLinkIsPublicAuthRoute()) {
      clearSuperAdministratorIdentity(shell);
      return;
    }

    if (nurselinkIdentityState.loaded) {
      applySuperAdministratorIdentity(
        shell,
        page,
        nurselinkIdentityState.data
      );
      return;
    }

    if (nurselinkIdentityState.loading) return;

    loadNurseLinkSessionIdentity()
      .then(identity => {
        if (nurseLinkIsPublicAuthRoute()) return;

        applySuperAdministratorIdentity(
          document.querySelector(ROOT_SELECTOR),
          document.querySelector(`${ROOT_SELECTOR} .page`)
            || document.querySelector(`${ROOT_SELECTOR} main`),
          identity
        );
      })
      .catch(() => {
        /*
         * Identity decoration is non-blocking. Existing authentication,
         * authorization and application behavior remain authoritative.
         */
      });
  }

  function markLockedQualification(scope) {
    if (!scope || routeSlug() !== 'qualifications') return;

    if (
      document.documentElement.classList.contains(
        'nurselink-super-admin-test-mode'
      )
    ) {
      document.documentElement.classList.remove(
        'nurselink-member-locked'
      );
      return;
    }

    const txt = scope.textContent || '';
    const isLocked =
      /membership application is approved/i.test(txt) ||
      /available after membership approval/i.test(txt);

    document.documentElement.classList.toggle('nurselink-member-locked', isLocked);

    if (isLocked) {
      scope.querySelectorAll('h1,h2,h3,h4').forEach(h => {
        const value = (h.textContent || '').trim().toLowerCase();
        if (
          value === 'qualification framework' ||
          value === 'available after membership approval'
        ) {
          h.classList.add('nurselink-ghost-heading');
        }
      });
    }
  }


  /* =========================================================
     NurseLink v5.5.2 — Two-Portal Consolidation
     Member /login -> /dashboard
     Administrator login -> consolidated Administrator Portal
     ========================================================= */

  const nurselinkPortal520State = {
    onboardingLoaded: false,
    onboardingLoading: null,
    onboarding: null
  };

  async function loadMemberPortalOnboarding520(force = false) {
    if (
      nurselinkPortal520State.onboardingLoaded
      && !force
    ) {
      return nurselinkPortal520State.onboarding;
    }

    if (
      nurselinkPortal520State.onboardingLoading
      && !force
    ) {
      return nurselinkPortal520State.onboardingLoading;
    }

    nurselinkPortal520State.onboardingLoading =
      nurseLinkJsonRequest(
        `${NURSELINK_API_ORIGIN}/api/membership/onboarding`
      )
        .then(payload => {
          nurselinkPortal520State.onboarding =
            payload?.data || null;
          nurselinkPortal520State.onboardingLoaded = true;
          return nurselinkPortal520State.onboarding;
        })
        .finally(() => {
          nurselinkPortal520State.onboardingLoading = null;
        });

    return nurselinkPortal520State.onboardingLoading;
  }

  function memberActivationAction520(
    done,
    title,
    note,
    url = ''
  ) {
    return `
      <div class="nurselink-member-portal-action" data-done="${done ? '1' : '0'}">
        <span aria-hidden="true">${done ? '✓' : '○'}</span>
        <div>
          <strong>${nlV200Escape(title)}</strong>
          <small>${nlV200Escape(note)}</small>
        </div>
        ${url ? `<a href="${nlV200Escape(url)}">Open</a>` : ''}
      </div>
    `;
  }

  async function renderMemberPortalMembership520(
    page,
    force = false
  ) {
    if (
      !page
      || routeSlug() !== 'dashboard'
      || !isApprovedMemberPortal()
    ) {
      return;
    }

    let card = page.querySelector(
      '.nurselink-member-portal-membership-v520'
    );

    if (!card) {
      card = document.createElement('section');
      card.className =
        'nurselink-member-portal-membership-v520';

      card.innerHTML = `
        <div class="nurselink-member-portal-loading">
          <strong>Membership & Activation</strong>
          <small>Loading your NurseLink member status…</small>
        </div>
      `;

      const hub = page.querySelector(
        '.nurselink-member-hub'
      );

      if (hub) {
        hub.insertBefore(
          card,
          hub.firstChild
        );
      } else {
        const header = page.querySelector(
          '.page-header'
        );

        if (header) {
          header.insertAdjacentElement(
            'afterend',
            card
          );
        } else {
          page.insertBefore(
            card,
            page.firstChild
          );
        }
      }
    }

    let data;

    try {
      data = await loadMemberPortalOnboarding520(
        force
      );
    } catch (error) {
      if (error?.status === 403) {
        card.remove();
      } else {
        card.innerHTML = `
          <div class="nurselink-member-portal-loading">
            <strong>Membership & Activation</strong>
            <small>Member activation information is temporarily unavailable.</small>
          </div>
        `;
      }
      return;
    }

    if (!data) return;

    const membership =
      data.membership || {};
    const onboarding =
      data.onboarding || {};
    const signals =
      data.signals || {};

    card.innerHTML = `
      <div class="nurselink-member-portal-head">
        <div>
          <span>MEMBERSHIP</span>
          <strong>Membership & Activation</strong>
          <small>
            Member ${nlV200Escape(membership.member_number || 'number pending')}
            · ${nlV200Escape(String(membership.standing || '').replace(/_/g, ' '))}
          </small>
        </div>
        <div class="nurselink-member-portal-score">
          <strong>${Number(signals.activation_score || 0)}%</strong>
          <small>Activation</small>
        </div>
      </div>

      <div class="nurselink-member-portal-actions">
        ${memberActivationAction520(
          !!onboarding.welcome_viewed_at,
          'Welcome reviewed',
          'Your approved NurseLink membership is active.'
        )}
        ${memberActivationAction520(
          !!onboarding.orientation_completed_at,
          'Member orientation',
          onboarding.orientation_completed_at
            ? 'Internal NurseLink member orientation completed.'
            : 'Review the NurseLink member-use and privacy principles.'
        )}
        ${memberActivationAction520(
          !!signals.profile_photo_ready,
          'Professional profile',
          'Keep your professional profile current.',
          '/profile'
        )}
        ${memberActivationAction520(
          Number(signals.credentials_registered || 0) > 0,
          'Credentials',
          `${Number(signals.credentials_registered || 0)} credential record(s).`,
          '/credentials'
        )}
        ${memberActivationAction520(
          !!signals.portfolio_started,
          'Professional portfolio',
          'Build and maintain your NurseLink portfolio.',
          '/portfolio'
        )}
        ${memberActivationAction520(
          !!signals.digital_member_identity_ready,
          'Digital member identity',
          'NurseLink membership identity — not a government or PRC ID.',
          '/nurselink-digital-id.html'
        )}
      </div>

      <div class="nurselink-member-portal-footer">
        <span>
          Onboarding: <strong>${nlV200Escape(
            String(onboarding.status || 'pending')
              .replace(/_/g, ' ')
          )}</strong>
        </span>
        ${!onboarding.orientation_completed_at
          ? '<button type="button" data-member-orientation-v520>Complete Orientation</button>'
          : '<span class="done">Orientation complete</span>'}
      </div>
    `;

    card
      .querySelector(
        '[data-member-orientation-v520]'
      )
      ?.addEventListener(
        'click',
        async event => {
          const button = event.currentTarget;
          button.disabled = true;
          button.textContent = 'Saving…';

          try {
            await nurseLinkJsonRequest(
              `${NURSELINK_API_ORIGIN}/api/membership/onboarding/progress`,
              {
                method: 'POST',
                body: JSON.stringify({
                  action:
                    'orientation_completed'
                })
              }
            );

            nurselinkPortal520State.onboardingLoaded =
              false;

            await renderMemberPortalMembership520(
              page,
              true
            );
          } catch (error) {
            button.disabled = false;
            button.textContent =
              error?.message || 'Try again';
          }
        }
      );

    const focus =
      location.hash === '#membership'
      || (() => {
        try {
          return sessionStorage.getItem(
            'nurselink_member_portal_focus'
          ) === 'membership';
        } catch (_) {
          return false;
        }
      })();

    if (focus) {
      try {
        sessionStorage.removeItem(
          'nurselink_member_portal_focus'
        );
      } catch (_) {}

      setTimeout(() => {
        card.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    }
  }

  function enhanceMemberLoginChoice520() {
    if (!detectLoginPage()) return;

    const root =
      document.querySelector(
        '.nurselink-auth-form-card'
      )
      || document.querySelector(
        '.auth-card'
      )
      || document.querySelector(
        'form'
      )?.parentElement;

    if (
      !root
      || root.querySelector(
        '.nurselink-admin-login-choice-v520'
      )
    ) {
      return;
    }

    const link = document.createElement('a');
    link.className =
      'nurselink-admin-login-choice-v520';
    link.href =
      '/admin/login.html';
    link.textContent =
      'Administrator sign in';

    root.appendChild(link);
  }

  function enhanceV520Portal(page) {
    if (
      page
      && routeSlug() === 'dashboard'
    ) {
      renderMemberPortalMembership520(
        page
      );
    }

    if (detectLoginPage()) {
      enhanceMemberLoginChoice520();
    }
  }

  function ensureAppShell() {
    const shell = document.querySelector(ROOT_SELECTOR);
    if (!shell) return false;

    const sidebar = shell.querySelector('.sidebar');
    const topbar = shell.querySelector('.topbar');
    const page = shell.querySelector('.page') || shell.querySelector('main');

    shell.classList.add('nurselink-mobile-ready');

    if (sidebar && topbar) {
      if (!shell.querySelector('.mobile-nav-backdrop')) {
        const backdrop = makeButton(
          'mobile-nav-backdrop',
          'Close navigation',
          '',
          () => closeNav(shell)
        );
        shell.insertBefore(backdrop, shell.firstChild);
      }

      if (!topbar.querySelector('.mobile-menu-button')) {
        const menu = makeButton(
          'mobile-menu-button',
          'Open navigation',
          '<span></span><span></span><span></span>',
          () => openNav(shell)
        );
        topbar.insertBefore(menu, topbar.firstChild);
      }

      if (!sidebar.querySelector('.mobile-nav-close')) {
        const close = makeButton(
          'mobile-nav-close',
          'Close navigation',
          '<span aria-hidden="true">×</span>',
          () => closeNav(shell)
        );
        sidebar.insertBefore(close, sidebar.firstChild);
      }

      if (!sidebar.dataset.nurselinkMobileBound) {
        sidebar.dataset.nurselinkMobileBound = '1';
        sidebar.addEventListener('click', e => {
          const target = e.target instanceof Element ? e.target.closest('a,button') : null;
          if (!target || target.classList.contains('mobile-nav-close')) return;
          if (target.matches('a') || target.closest('nav')) closeNav(shell);
        });
      }
    }

    markWideContent(page || shell);
    markLockedQualification(page || shell);
    enhanceProfessionalOnboarding(page || shell);
    enhanceProfilePhoto(page || shell);
    enhanceV150(page || shell);
    enhanceV160(page || shell);
    enhanceV170(page || shell);
    enhanceV180(page || shell);
    enhanceV190(page || shell);
    enhanceV200(page || shell);
    enhanceV220(page || shell);
    enhanceV230(page || shell);
    enhanceV250(page || shell);
    enhanceV260(page || shell);
    enhanceV270(page || shell);
    enhanceV280(page || shell);
    enhanceV290(page || shell);
    enhanceV320(page || shell);
    enhanceV420(page || shell);
    enhanceV520Portal(page || shell);
    enhanceSuperAdministratorIdentity(shell, page || shell);
    enhanceSuperAdminTestMode(shell, page || shell);
    return true;
  }

  function runEnhancements() {
    syncRouteClass();

    const hasAppShell = ensureAppShell();

    if (!hasAppShell) {
      if (routeSlug() === 'verify-email') {
        enhanceVerificationPage();
      } else if (detectRegistrationPage()) {
        document.documentElement.classList.add('nurselink-route-register');
        enhanceAuthPage('register');
      } else if (detectLoginPage()) {
        document.documentElement.classList.add('nurselink-route-login');
        enhanceAuthPage('login');
        enhanceMemberLoginChoice520();
      }

      markWideContent(document.body);
    }
  }

  function boot() {
    runEnhancements();

    // Observer is intentionally throttled to avoid repeated DOM changes.
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        runEnhancements();
      });
    });

    observer.observe(document.querySelector('#root') || document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > BREAKPOINT) {
        closeNav(document.querySelector(ROOT_SELECTOR));
      }
    }, { passive: true });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeNav(document.querySelector(ROOT_SELECTOR));
    });

    const rerun = () => setTimeout(runEnhancements, 0);

    ['pushState', 'replaceState'].forEach(method => {
      const original = history[method];
      if (typeof original !== 'function') return;

      history[method] = function (...args) {
        const result = original.apply(this, args);
        rerun();
        return result;
      };
    });

    window.addEventListener('popstate', rerun);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

/* Historical cumulative routing markers only:
nurselink-admin-login.html
nurselink-admin-login.html?return=/admin
*/
