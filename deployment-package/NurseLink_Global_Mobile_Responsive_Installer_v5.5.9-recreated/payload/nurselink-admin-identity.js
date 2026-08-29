(() => {
  const API = 'https://api.amsertech.com';

  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  async function loadIdentity() {
    const response = await fetch(
      `${API}/api/nurselink/session-identity`,
      {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );

    if (!response.ok) return null;

    try {
      const payload = await response.json();
      return payload?.data || null;
    } catch (_) {
      return null;
    }
  }

  function render(identity) {
    if (!identity?.is_super_admin) return;

    document.documentElement.classList.add(
      'nurselink-standalone-super-admin'
    );

    document.documentElement.setAttribute(
      'data-nurselink-access-level',
      'super-admin'
    );

    if (document.querySelector('.nurselink-standalone-super-admin-strip')) {
      return;
    }

    const strip = document.createElement('div');
    strip.className = 'nurselink-standalone-super-admin-strip';
    strip.setAttribute(
      'aria-label',
      'Signed in as NurseLink Super Administrator'
    );

    strip.innerHTML = `
      <span class="nurselink-standalone-super-admin-mark" aria-hidden="true">SA</span>
      <span>
        <strong>SUPER ADMINISTRATOR</strong>
        <small>Server-confirmed privileged session</small>
      </span>
    `;

    document.body.insertBefore(strip, document.body.firstChild);
  }

  loadIdentity()
    .then(render)
    .catch(() => {
      // Identity decoration is non-blocking.
    });
})();
