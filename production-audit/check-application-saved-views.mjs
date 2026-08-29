import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const packageRoot = path.join(
  root,
  'deployment-package',
  'NurseLink_Global_Mobile_Responsive_Installer_v5.5.9-recreated'
);
const payload = path.join(packageRoot, 'payload');

const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8');
const controller = read(payload, 'api', 'app', 'Http', 'Controllers', 'Api', 'MembershipAdministrationController.php');
const dashboard = read(payload, 'admin', 'dashboard.js');
const migration = read(payload, 'api', 'database', 'migrations', '2026_08_29_045000_create_nurselink_admin_saved_views.php');
const routes = read(root, 'production-audit', 'api.php');
const installer = read(packageRoot, 'install_v552_base.sh');

const checks = [
  ['Migration creates the saved-view table', migration.includes("Schema::create(\n            'nurselink_admin_saved_views'")],
  ['Migration adapts to the users.id type', migration.includes('information_schema.COLUMNS')],
  ['Migration enforces owner/name uniqueness', migration.includes('nl_admin_view_owner_name_unique')],
  ['List endpoint scopes by current owner', controller.includes("->where('user_id', (string) $request->user()->getKey())")],
  ['Saved views are limited to twelve', controller.includes("abort_if($count >= 12")],
  ['Delete endpoint scopes by owner and type', controller.includes('public function deleteSavedView') && controller.includes("->where('view_type', 'membership_applications')")],
  ['Routes include list, store, and delete', ['savedViews', 'storeSavedView', 'deleteSavedView'].every(value => routes.includes(value))],
  ['Installer includes the migration', installer.includes('ADMIN_SAVED_VIEWS_MIGRATION')],
  ['Client synchronizes server views', dashboard.includes('async function syncApplicationSavedViews()')],
  ['Client retains browser fallback', dashboard.includes('Saved application view “${name}” in this browser.')]
];

const failures = checks.filter(([, passed]) => !passed);

for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
}

if (failures.length) {
  process.exitCode = 1;
} else {
  console.log(`PASS: ${checks.length} saved-view contract checks`);
}
