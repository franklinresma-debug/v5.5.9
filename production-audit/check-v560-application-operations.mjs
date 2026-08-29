import {spawnSync} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const scripts = [
  'check-application-pagination.mjs',
  'check-application-saved-views.mjs',
  'check-application-url-state.mjs',
  'check-application-sla-policy.mjs',
  'check-application-sla-alerts.mjs',
  'check-application-sla-admin.mjs',
  'check-application-bulk-triage.mjs',
  'check-application-export-readiness.mjs',
  'check-v560-release-markers.mjs'
];

let failed = 0;

for (const script of scripts) {
  console.log(`\n=== ${script} ===`);
  const result = spawnSync(
    process.execPath,
    [path.join(process.cwd(), 'production-audit', script)],
    {stdio: 'inherit'}
  );

  if (result.status !== 0) failed++;
}

console.log(`\n${failed ? 'FAIL' : 'PASS'}: v5.6 application-operations suite (${scripts.length} groups, ${failed} failed)`);
if (failed) process.exitCode = 1;
