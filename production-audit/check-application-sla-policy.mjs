import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const packageRoot = path.join(root, 'deployment-package', 'NurseLink_Global_Mobile_Responsive_Installer_v5.5.9-recreated');
const payload = path.join(packageRoot, 'payload');
const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8');

const controller = read(payload, 'api', 'app', 'Http', 'Controllers', 'Api', 'MembershipAdministrationController.php');
const migration = read(payload, 'api', 'database', 'migrations', '2026_08_29_046000_create_nurselink_application_sla_policy.php');
const routes = read(root, 'production-audit', 'api.php');
const installer = read(packageRoot, 'install_v552_base.sh');

const checks = [
  ['Migration creates one SLA policy table', migration.includes("'nurselink_application_sla_policy'")],
  ['Default timezone is explicit', migration.includes("'Asia/Manila'")],
  ['Default business days are explicit', migration.includes('json_encode([1, 2, 3, 4, 5])')],
  ['Policy uses monotonic versioning', migration.includes("$table->unsignedInteger('version')")],
  ['Policy read requires administrator authority', controller.includes("Administrator access is required to view SLA policy.")],
  ['Policy update requires administrator authority', controller.includes("Administrator access is required to update SLA policy.")],
  ['IANA timezone validation is present', controller.includes('timezone_identifiers_list()')],
  ['Warning must precede breach target', controller.includes('Warning hours must be less than target hours.')],
  ['Concurrent changes return conflict', controller.includes('The SLA policy changed in another session.')],
  ['Policy update uses a row lock', controller.includes('->lockForUpdate()')],
  ['Policy change writes before/after audit', controller.includes("'application.sla_policy.updated'")],
  ['Routes expose read and update only', routes.includes("'slaPolicy'") && routes.includes("'updateSlaPolicy'")],
  ['Installer includes the SLA migration', installer.includes('APPLICATION_SLA_POLICY_MIGRATION')]
];

const failures = checks.filter(([, passed]) => !passed);

for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
}

if (failures.length) {
  process.exitCode = 1;
} else {
  console.log(`PASS: ${checks.length} SLA-policy contract checks`);
}
