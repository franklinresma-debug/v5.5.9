import process from 'node:process';

const appOrigin = new URL(process.argv[2] || 'https://app.amsertech.com');
const apiOrigin = new URL(process.argv[3] || 'https://api.amsertech.com');
const expectedRelease = '5.6.0-rc.1';

const checks = [];

async function read(path, origin) {
  const url = new URL(path, origin);
  url.searchParams.set('nl_verify', Date.now().toString());
  const response = await fetch(url, {
    headers: {
      accept: path.endsWith('.js') || path.endsWith('/') ? 'text/html,*/*' : 'application/json,*/*',
      'cache-control': 'no-cache'
    },
    redirect: 'follow'
  });
  return {url: url.toString(), response, body: await response.text()};
}

function record(name, passed, detail) {
  checks.push({name, passed, detail});
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
}

try {
  const health = await read('/api/health/ready', apiOrigin);
  let healthData = {};
  try { healthData = JSON.parse(health.body); } catch {}
  record('API readiness', health.response.ok && healthData.status === 'ok', `HTTP ${health.response.status}; environment=${healthData.environment || 'unknown'}; release=${healthData.release || 'unknown'}`);

  const admin = await read('/admin/', appOrigin);
  record('Administrator page', admin.response.ok, `HTTP ${admin.response.status}`);
  record('RC release marker', admin.body.includes(`data-nurselink-release="${expectedRelease}"`), expectedRelease);
  record('SLA markup', admin.body.includes('applicationSlaSection'), 'applicationSlaSection');
  record('Bulk-triage markup', admin.body.includes('applicationBulkTriage'), 'applicationBulkTriage');
  record('Fresh dashboard cache key', admin.body.includes('dashboard.js?nlv=5600rc1'), 'nlv=5600rc1');

  const dashboard = await read('/admin/dashboard.js', appOrigin);
  record('Administrator JavaScript', dashboard.response.ok, `HTTP ${dashboard.response.status}; ${dashboard.body.length} bytes`);
  for (const marker of ['saved-views', 'sla-policy', 'sla-alerts', 'bulk-triage', 'export-history']) {
    record(`Dashboard marker ${marker}`, dashboard.body.includes(marker), marker);
  }
} catch (error) {
  record('Verifier execution', false, error instanceof Error ? error.message : String(error));
}

const failed = checks.filter(check => !check.passed);
console.log(`\n${failed.length ? 'BLOCKED' : 'PASS'}: v5.6 deployment verification (${checks.length - failed.length}/${checks.length} passed)`);
if (failed.length) process.exitCode = 1;
