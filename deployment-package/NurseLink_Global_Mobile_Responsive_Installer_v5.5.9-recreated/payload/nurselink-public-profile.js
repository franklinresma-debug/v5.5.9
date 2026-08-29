(() => {
  const API = 'https://api.amsertech.com/api/public-profile';
  const root = document.getElementById('profile-root');

  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const slug = new URLSearchParams(location.search).get('slug') || '';

  function fmt(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  function section(title, content) {
    return `
      <section class="profile-section">
        <div class="section-head">
          <span>NURSELINK</span>
          <h2>${esc(title)}</h2>
        </div>
        ${content}
      </section>
    `;
  }

  function empty(text) {
    return `<div class="empty">${esc(text)}</div>`;
  }

  function credentialCards(rows) {
    if (!rows?.length) return empty('No public credential records.');

    return `<div class="card-grid">${rows.map(row => `
      <article class="info-card">
        <span>${esc(row.credential_type?.replaceAll('_', ' '))}</span>
        <strong>${esc(row.title)}</strong>
        <small>${esc(row.issuing_body || '')}</small>
        <div class="chips">
          ${row.country ? `<em>${esc(row.country)}</em>` : ''}
          <em data-tone="${esc(row.verification_status)}">${esc(row.verification_status?.replaceAll('_', ' '))}</em>
          ${row.expiry_date ? `<em>Exp. ${esc(fmt(row.expiry_date))}</em>` : ''}
        </div>
      </article>
    `).join('')}</div>`;
  }

  function employmentCards(rows) {
    if (!rows?.length) return empty('No public employment history.');

    return `<div class="timeline">${rows.map(row => `
      <article>
        <div class="timeline-dot"></div>
        <div>
          <span>${row.is_overseas ? 'OVERSEAS / OFW EXPERIENCE' : 'PROFESSIONAL EXPERIENCE'}</span>
          <strong>${esc(row.position)}</strong>
          <small>${esc(row.employer_name)}${row.country ? ` · ${esc(row.country)}` : ''}</small>
          <p>${esc(row.specialty || '')}</p>
          <em>${esc(fmt(row.start_date))}${row.is_current ? ' – Present' : row.end_date ? ` – ${esc(fmt(row.end_date))}` : ''}</em>
        </div>
      </article>
    `).join('')}</div>`;
  }

  function portfolioCards(rows) {
    if (!rows?.length) return empty('No public portfolio items.');

    return `<div class="card-grid">${rows.map(row => `
      <article class="info-card">
        <span>${esc(row.item_type?.replaceAll('_', ' '))}${row.is_featured ? ' · Featured' : ''}</span>
        <strong>${esc(row.title)}</strong>
        <small>${esc(row.organization || '')}</small>
        ${row.description ? `<p>${esc(row.description)}</p>` : ''}
        ${row.reference_url ? `<a href="${esc(row.reference_url)}" target="_blank" rel="noopener">Reference ↗</a>` : ''}
      </article>
    `).join('')}</div>`;
  }

  function learningCards(rows) {
    if (!rows?.length) return empty('No public learning records.');

    return `<div class="card-grid">${rows.map(row => `
      <article class="info-card">
        <span>${esc(row.learning_type?.replaceAll('_', ' '))}</span>
        <strong>${esc(row.title)}</strong>
        <small>${esc(row.provider || '')}</small>
        <div class="chips">
          ${row.completed_at ? `<em>${esc(fmt(row.completed_at))}</em>` : ''}
          ${row.learning_hours !== null ? `<em>${esc(row.learning_hours)} hours</em>` : ''}
          ${row.cpd_units !== null ? `<em>${esc(row.cpd_units)} CPD*</em>` : ''}
        </div>
      </article>
    `).join('')}</div>`;
  }

  async function load() {
    if (!slug) throw new Error('Profile link is incomplete.');

    const response = await fetch(`${API}/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(
        response.status === 404
          ? 'This NurseLink public profile is unavailable or private.'
          : 'Unable to load this NurseLink profile.'
      );
    }

    const payload = await response.json();
    return payload?.data;
  }

  function render(data) {
    document.title = `${data.member_name || 'NurseLink Member'} · NurseLink`;

    root.innerHTML = `
      <header class="profile-hero">
        <div class="brand">
          <strong>NurseLink</strong>
          <span>DIGITAL NURSE PROFILE</span>
        </div>

        <div class="hero-body">
          <div class="photo">
            ${data.photo_url
              ? `<img src="${esc(data.photo_url)}" alt="">`
              : '<span>NL</span>'}
          </div>

          <div class="identity">
            <span>VERIFIED NURSELINK MEMBER</span>
            <h1>${esc(data.member_name || 'NurseLink Member')}</h1>
            ${data.headline ? `<p>${esc(data.headline)}</p>` : ''}
            ${data.membership.member_number ? `<strong>${esc(data.membership.member_number)}</strong>` : ''}
          </div>

          <div class="verified">
            <div>✓</div>
            <strong>Membership Verified</strong>
            <small>Approved ${esc(fmt(data.membership.approved_at))}</small>
          </div>
        </div>

        ${data.bio ? `<div class="bio">${esc(data.bio)}</div>` : ''}
      </header>

      ${data.credentials !== undefined ? section('Verified Credentials', credentialCards(data.credentials)) : ''}
      ${data.employment !== undefined ? section('Professional Experience', employmentCards(data.employment)) : ''}
      ${data.portfolio !== undefined ? section('Professional Portfolio', portfolioCards(data.portfolio)) : ''}
      ${data.learning !== undefined ? section('Learning & Development', learningCards(data.learning)) : ''}

      <footer>
        <strong>NurseLink Digital Nurse Profile</strong>
        <p>${esc(data.disclaimers?.membership || '')}</p>
        <p>* ${esc(data.disclaimers?.learning || '')}</p>
      </footer>
    `;
  }

  load()
    .then(render)
    .catch(error => {
      root.innerHTML = `
        <section class="public-profile-error">
          <div>NL</div>
          <strong>Profile unavailable</strong>
          <p>${esc(error.message)}</p>
        </section>
      `;
    });
})();
