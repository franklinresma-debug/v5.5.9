import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const dashboard = fs.readFileSync(
  path.join(
    process.cwd(),
    'deployment-package',
    'NurseLink_Global_Mobile_Responsive_Installer_v5.5.9-recreated',
    'payload',
    'admin',
    'dashboard.js'
  ),
  'utf8'
);

const checks = [
  ['URL state has an explicit restore path', dashboard.includes('function restoreApplicationStateFromUrl()')],
  ['URL state uses replaceState', dashboard.includes("history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)")],
  ['Status is persisted', dashboard.includes('app_status: filters.status')],
  ['Stage is persisted', dashboard.includes('app_stage: filters.stage')],
  ['Assignment is persisted', dashboard.includes('app_assignment:')],
  ['Priority is persisted', dashboard.includes('app_priority: filters.priority')],
  ['Pagination is persisted', dashboard.includes('app_page:') && dashboard.includes('app_per_page:')],
  ['Saved-view identity is persisted', dashboard.includes('app_view: applicationUrlSavedView')],
  ['Free-text applicant search is excluded', !dashboard.includes('app_search:')],
  ['Free-text organization search is excluded', !dashboard.includes('app_organization:')],
  ['Saved view is reapplied after server synchronization', dashboard.includes('if (applicationUrlSavedView && !applicationUrlViewApplied)')],
  ['Manual filter changes clear saved-view identity', dashboard.includes('clearApplicationSavedViewSelection();')]
];

const failures = checks.filter(([, passed]) => !passed);

for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
}

if (failures.length) {
  process.exitCode = 1;
} else {
  console.log(`PASS: ${checks.length} URL-state contract checks`);
}
