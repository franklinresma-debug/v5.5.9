import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const packageRoot = path.join(root, 'deployment-package', 'NurseLink_Global_Mobile_Responsive_Installer_v5.5.9-recreated');
const payload = path.join(packageRoot, 'payload');
const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8');

const service = read(payload, 'api', 'app', 'Services', 'ApplicationSlaEvaluationService.php');
const migration = read(payload, 'api', 'database', 'migrations', '2026_08_29_047000_create_nurselink_application_sla_alerts.php');
const controller = read(payload, 'api', 'app', 'Http', 'Controllers', 'Api', 'MembershipAdministrationController.php');
const routes = read(root, 'production-audit', 'api.php');
const installer = read(packageRoot, 'install_v552_base.sh');

const checks = [
  ['Alert ledger has a database dedupe key', migration.includes('nl_app_sla_alert_dedupe')],
  ['Alert ledger retains acknowledgement and resolution facts', migration.includes('acknowledged_at') && migration.includes('resolved_at')],
  ['Evaluator is limited to pending workflow states', service.includes("'ready_for_approval'") && service.includes("whereIn('status', self::PENDING_STATUSES)" )],
  ['Disabled policy resolves open alerts', service.includes("if (! (bool) $policy->enabled)")],
  ['Evaluator uses configured business days', service.includes('dayOfWeekIso')],
  ['Evaluator emits warning and breach states', service.includes("$state = 'warning'") && service.includes("$state = 'breached'")],
  ['Alert creation is idempotent', service.includes('insertOrIgnore')],
  ['Notification claim uses transaction and row lock', service.includes('DB::transaction') && service.includes('->lockForUpdate()')],
  ['Notification copy avoids applicant PII', !service.includes('applicant') && service.includes('An assigned membership review requires attention.')],
  ['Warning resolves when breach begins', service.includes("->where('alert_state', 'warning')")],
  ['Alerts resolve after leaving pending workflow', service.includes("->whereNotIn('membership_id', $activeMembershipIds)")],
  ['Manual evaluation requires administrator authority', controller.includes('Administrator access is required to evaluate SLA alerts.')],
  ['Evaluation is audited', controller.includes("'application.sla_evaluated'")],
  ['Route exposes the evaluator as POST', routes.includes("Route::post('/nurselink/admin/membership-administration/sla-evaluate'")],
  ['Installer includes service and alert migration', installer.includes('ApplicationSlaEvaluationService.php') && installer.includes('APPLICATION_SLA_ALERTS_MIGRATION')]
];

const failures = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);

if (failures.length) process.exitCode = 1;
else console.log(`PASS: ${checks.length} SLA-alert contract checks`);
