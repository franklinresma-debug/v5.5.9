import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const packageRoot = path.join(
  root,
  'deployment-package',
  'NurseLink_Global_Mobile_Responsive_Installer_v5.5.9-recreated',
  'payload'
);

const controller = fs.readFileSync(
  path.join(
    packageRoot,
    'api',
    'app',
    'Http',
    'Controllers',
    'Api',
    'MembershipAdministrationController.php'
  ),
  'utf8'
);

const dashboard = fs.readFileSync(
  path.join(packageRoot, 'admin', 'dashboard.js'),
  'utf8'
);

const checks = [
  ['API validates page', controller.includes("'page' => [")],
  ['API validates allowed page sizes', controller.includes("Rule::in([\n                    10,\n                    25,\n                    50,")],
  ['API applies a stable ID tiebreaker', controller.includes("->orderBy(\n                'm.id'")],
  ['API emits pagination metadata', controller.includes("'last_page' => $lastPage")],
  ['Legacy callers remain supported', controller.includes("$request->has('page')")],
  ['Client sends page number', dashboard.includes("params.set('page', String(applicationPage))")],
  ['Client sends page size', dashboard.includes("params.set('per_page', String(applicationPageSize))")],
  ['Client consumes pagination metadata', dashboard.includes('queuePayload?.pagination')],
  ['Page navigation reloads from API', dashboard.includes('if (applicationPaginationData) {\n            loadApplications();')]
];

const failures = checks.filter(([, passed]) => !passed);

for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
}

if (failures.length) {
  process.exitCode = 1;
} else {
  console.log(`PASS: ${checks.length} application pagination contract checks`);
}
