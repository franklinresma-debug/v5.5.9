import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const packageRoot = path.join(root, 'deployment-package', 'NurseLink_Global_Mobile_Responsive_Installer_v5.5.9-recreated');
const controller = fs.readFileSync(path.join(packageRoot, 'payload', 'api', 'app', 'Http', 'Controllers', 'Api', 'MembershipAdministrationController.php'), 'utf8');
const dashboard = fs.readFileSync(path.join(packageRoot, 'payload', 'admin', 'dashboard.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'production-audit', 'api.php'), 'utf8');

const checks = [
  ['CSV formula injection is neutralized', ['=', '+', '-', '@'].every(value => controller.includes(`'${value}'`)) && controller.includes("return \"'\"\n                . $text")],
  ['Contact fields are opt-in', controller.includes("'include_contact' => ['nullable', 'boolean']") && controller.includes("$includeContact = (bool)")],
  ['Default export headers omit applicant identity', controller.includes("if ($includeContact) {\n                    array_splice($headers")],
  ['Export has a correlation UUID', controller.includes('$exportId = (string) Str::uuid()')],
  ['Export audit records contact scope', controller.includes("'include_contact' =>")],
  ['Export history requires administrator authority', controller.includes('Administrator access is required to view export history.')],
  ['Export history is bounded', controller.includes("->where('target_type', 'membership_export')") && controller.includes('->limit(100)')],
  ['Readiness is explainable', controller.includes("'missing' => $missing")],
  ['Readiness is explicitly advisory', controller.includes("'advisory_only' => true")],
  ['Readiness cannot make a decision', controller.includes('does not make a membership decision')],
  ['Queue exposes readiness score', controller.includes("'readiness' =>")],
  ['UI displays readiness', dashboard.includes('Readiness ${esc(row.readiness?.score ?? 0)}%')],
  ['Export removes page limits', dashboard.includes("params.delete('page')") && dashboard.includes("params.delete('per_page')")],
  ['UI asks before including contact data', dashboard.includes('Include applicant names and email addresses?')],
  ['History route is installed', routes.includes("membership-administration/export-history")]
];

const failures = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
if (failures.length) process.exitCode = 1;
else console.log(`PASS: ${checks.length} export/readiness contract checks`);
