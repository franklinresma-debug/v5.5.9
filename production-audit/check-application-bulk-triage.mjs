import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const packageRoot = path.join(root, 'deployment-package', 'NurseLink_Global_Mobile_Responsive_Installer_v5.5.9-recreated');
const controller = fs.readFileSync(path.join(packageRoot, 'payload', 'api', 'app', 'Http', 'Controllers', 'Api', 'MembershipAdministrationController.php'), 'utf8');
const dashboard = fs.readFileSync(path.join(packageRoot, 'payload', 'admin', 'dashboard.js'), 'utf8');
const html = fs.readFileSync(path.join(packageRoot, 'payload', 'admin', 'index.html'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'production-audit', 'api.php'), 'utf8');
const installer = fs.readFileSync(path.join(packageRoot, 'install_v552_base.sh'), 'utf8');

const checks = [
  ['Bulk triage requires administrator authority', controller.includes('Administrator access is required for bulk triage.')],
  ['Bulk triage supports preview and apply only', controller.includes("Rule::in(['preview', 'apply'])")],
  ['Batch size is bounded at fifty', controller.includes("'items' => ['required', 'array', 'min:1', 'max:50']")],
  ['Only triage fields are accepted', controller.includes("array_flip(['priority', 'assigned_reviewer_user_id', 'review_due_at'])")],
  ['Final decisions are not accepted', !controller.includes("$allowedChanges['status']") && !controller.includes("$allowedChanges['standing']")],
  ['Reason is mandatory', controller.includes("'reason' => ['required', 'string', 'min:5', 'max:500']")],
  ['Reviewer access is validated', controller.includes('isActivePrivilegedReviewer($reviewerId)')],
  ['Only pending applications can change', controller.includes('Only pending applications can be bulk triaged.')],
  ['Selection uses optimistic concurrency', controller.includes("'expected_updated_at'") && controller.includes('Application changed after selection.')],
  ['Apply repeats concurrency condition', controller.includes("->where('updated_at', $row->updated_at)")],
  ['Partial failures are explicit', controller.includes("'failed' => count($results) - $successful")],
  ['A correlation UUID is generated', controller.includes('Str::uuid()')],
  ['Each successful record is audited', controller.includes("'membership.bulk_triage.updated'")],
  ['Audit state is limited to triage fields', controller.includes('$afterState') && !controller.includes('array_merge((array) $after')],
  ['Route uses POST', routes.includes("Route::post('/nurselink/admin/membership-administration/bulk-triage'")],
  ['Installer includes the route', installer.includes("membership-administration/bulk-triage")],
  ['Queue exposes concurrency timestamp', controller.includes("'updated_at' =>")],
  ['Selection controls are administrator gated', dashboard.includes("['admin', 'super_admin'].includes(roleKey())")],
  ['UI enforces the fifty-record bound', dashboard.includes("applicationBulkSelection.size >= 50")],
  ['UI retains snapshots across pages', dashboard.includes('applicationBulkSnapshots = new Map()')],
  ['UI requires explicit change toggles', html.includes('applicationBulkPriorityEnabled') && html.includes('applicationBulkReviewerEnabled') && html.includes('applicationBulkDueEnabled')],
  ['UI provides separate preview and apply steps', dashboard.includes("applicationBulkRequest('preview')") && dashboard.includes("mode: 'apply'")],
  ['UI cannot apply without a preview', dashboard.includes('if (!applicationBulkPreviewRequest) return;')],
  ['UI clears selection after apply', dashboard.includes('applicationBulkSelection.clear();')]
];

const failures = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
if (failures.length) process.exitCode = 1;
else console.log(`PASS: ${checks.length} bulk-triage contract checks`);
