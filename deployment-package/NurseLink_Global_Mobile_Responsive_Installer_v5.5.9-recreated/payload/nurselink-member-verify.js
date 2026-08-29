(() => {
  const API = 'https://api.amsertech.com/api/membership/verify/';
  const form = document.getElementById('verifyForm');
  const input = document.getElementById('verificationCode');
  const result = document.getElementById('verifyResult');

  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function normalizeCode(value) {
    return String(value || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 80);
  }

  function setLoading() {
    result.innerHTML = `
      <div class="verify-loading">
        <div class="spinner"></div>
        <strong>Checking NurseLink membership…</strong>
      </div>
    `;
  }

  function standingLabel(value) {
    return ({
      active: 'Active',
      suspended: 'Suspended',
      inactive: 'Inactive'
    })[String(value || 'active').toLowerCase()]
      || String(value || 'Active');
  }

  function renderValid(data) {
    const standing = String(data.standing || 'active')
      .toLowerCase()
      .trim() || 'active';
    const active = standing === 'active';
    const label = standingLabel(standing);

    result.innerHTML = `
      <article class="verification-card valid"
        data-standing="${esc(standing)}">
        <div class="verification-icon">${active ? '✓' : '!'}</div>
        <span>VERIFIED NURSELINK MEMBERSHIP RECORD</span>
        <h2>${esc(data.member_name || 'NurseLink Member')}</h2>
        <strong>${esc(data.member_number || '')}</strong>

        <dl>
          <div>
            <dt>Membership Decision</dt>
            <dd>Approved</dd>
          </div>
          <div>
            <dt>Professional Standing</dt>
            <dd>${esc(label)}</dd>
          </div>
          <div>
            <dt>Member Since</dt>
            <dd>${esc(data.approved_at ? String(data.approved_at).slice(0, 10) : '—')}</dd>
          </div>
          <div>
            <dt>Member Services</dt>
            <dd>${active ? 'Active Access' : 'Not Active'}</dd>
          </div>
        </dl>

        ${active ? `
          <p>
            This record confirms an approved NurseLink membership that is
            currently in Active professional standing.
          </p>
        ` : `
          <p class="standing-message">
            This is a valid approved NurseLink membership record, but its current
            professional standing is ${esc(label)}. Member-only NurseLink services
            are not active at this time.
          </p>
        `}
      </article>
    `;
  }

  function renderInvalid() {
    result.innerHTML = `
      <article class="verification-card invalid">
        <div class="verification-icon">!</div>
        <span>MEMBERSHIP NOT VERIFIED</span>
        <h2>Unable to verify this code</h2>
        <p>
          The verification code may be invalid, incomplete, expired, or no
          longer associated with an approved NurseLink membership.
        </p>
      </article>
    `;
  }

  async function verify(code) {
    const clean = normalizeCode(code);

    if (!clean) {
      renderInvalid();
      return;
    }

    input.value = clean;
    setLoading();

    try {
      const response = await fetch(`${API}${encodeURIComponent(clean)}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        renderInvalid();
        return;
      }

      const payload = await response.json();
      const data = payload?.data;

      if (!data?.valid || data?.status !== 'approved') {
        renderInvalid();
        return;
      }

      renderValid(data);
    } catch (_) {
      result.innerHTML = `
        <article class="verification-card unavailable">
          <div class="verification-icon">?</div>
          <span>NURSELINK CONNECTION</span>
          <h2>Verification service unavailable</h2>
          <p>Please try again when a network connection is available.</p>
        </article>
      `;
    }
  }

  form?.addEventListener('submit', event => {
    event.preventDefault();
    verify(input.value);
  });

  const params = new URLSearchParams(location.search);
  const initial = normalizeCode(params.get('code'));

  if (initial) {
    input.value = initial;
    verify(initial);
  }
})();
