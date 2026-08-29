import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const packageRoot = path.join(root, 'deployment-package', 'NurseLink_Global_Mobile_Responsive_Installer_v5.5.9-recreated');
const payload = path.join(packageRoot, 'payload');
const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8');
const controller = read(payload, 'api', 'app', 'Http', 'Controllers', 'Api', 'MembershipAdministrationController.php');
const html = read(payload, 'admin', 'index.html');
const dashboard = read(payload, 'admin', 'dashboard.js');
const routes = read(root, 'production-audit', 'api.php');

const checks = [
  ['Alert list requires administrator authority', controller.includes('Administrator access is required to view SLA alerts.')],
  ['Acknowledgement requires administrator authority', controller.includes('Administrator access is required to acknowledge SLA alerts.')],
  ['Resolved alerts cannot be acknowledged', controller.includes('Resolved SLA alerts cannot be acknowledged.')],
  ['Acknowledgement is idempotent', controller.includes("$before->acknowledged_at ?: now()")],
  ['Acknowledgement writes an audit record', controller.includes("'application.sla_alert.acknowledged'")],
  ['Alert list excludes applicant identity fields', !controller.includes("'applicant_name'") && !controller.includes("'applicant_email'")],
  ['Routes expose list and acknowledge actions', routes.includes("'slaAlerts'") && routes.includes("'acknowledgeSlaAlert'")],
  ['Policy editor is present', html.includes('applicationSlaPolicyForm')],
  ['Policy copy rejects performance scoring', html.includes('not staff performance ratings')],
  ['Manual evaluation control is present', html.includes('evaluateApplicationSla')],
  ['Alert status and state filters are present', html.includes('applicationSlaAlertStatus') && html.includes('applicationSlaAlertState')],
  ['UI is restricted by role', dashboard.includes("!['admin', 'super_admin'].includes(roleKey())")],
  ['UI supports policy save', dashboard.includes('async function saveApplicationSlaPolicy')],
  ['UI supports evaluation', dashboard.includes('async function evaluateApplicationSla')],
  ['UI supports acknowledgement', dashboard.includes('data-ack-sla')]
];

const failures = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
if (failures.length) process.exitCode = 1;
else console.log(`PASS: ${checks.length} SLA-admin contract checks`);
