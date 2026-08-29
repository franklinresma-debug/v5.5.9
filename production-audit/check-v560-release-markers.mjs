import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageRoot = path.join(root, 'deployment-package', 'NurseLink_Global_Mobile_Responsive_Installer_v5.5.9-recreated');
const html = fs.readFileSync(path.join(packageRoot, 'payload', 'admin', 'index.html'), 'utf8');
const installer = fs.readFileSync(path.join(packageRoot, 'install.sh'), 'utf8');
const verifier = fs.readFileSync(path.join(root, 'production-audit', 'verify-v560-deployment.mjs'), 'utf8');

const checks = [
  ['Admin page exposes the RC marker', html.includes('data-nurselink-release="5.6.0-rc.1"')],
  ['Dashboard uses the RC cache key', html.includes('dashboard.js?nlv=5600rc1')],
  ['Consolidated CSS uses the RC cache key', html.includes('admin-consolidated.css?nlv=5600rc1')],
  ['Installer identifies the RC', installer.includes('NurseLink v5.6.0-rc.1 cumulative installer')],
  ['Verifier bypasses caches', verifier.includes("searchParams.set('nl_verify'")],
  ['Verifier checks all v5.6 feature markers', ['saved-views', 'sla-policy', 'sla-alerts', 'bulk-triage', 'export-history'].every(marker => verifier.includes(marker))]
];

let failed = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${label}`);
  if (!passed) failed++;
}

console.log(`${failed ? 'FAIL' : 'PASS'}: ${checks.length} v5.6 release-marker checks`);
if (failed) process.exitCode = 1;
