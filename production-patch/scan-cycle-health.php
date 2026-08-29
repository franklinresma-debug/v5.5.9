<?php

use App\Http\Controllers\Api\MembershipCycleHealthController;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require '/var/www/nurselink-api/vendor/autoload.php';
$app = require '/var/www/nurselink-api/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$controller = $app->make(MembershipCycleHealthController::class);
$summary = [
    'healthy' => 0,
    'action_required' => 0,
    'check_needed' => 0,
];
$failedChecks = [];
$warnings = [];
$repairableIds = [];

DB::table('nurselink_memberships')->orderBy('id')->chunkById(100, function ($rows) use (
    $controller,
    &$summary,
    &$failedChecks,
    &$warnings,
    &$repairableIds
): void {
    foreach ($rows as $membership) {
        $response = $controller->show((int) $membership->id);
        $data = json_decode($response->getContent(), true, flags: JSON_THROW_ON_ERROR)['data'];
        $status = $data['status'];
        $summary[$status] = ($summary[$status] ?? 0) + 1;

        foreach ($data['checks'] as $name => $passed) {
            if (! $passed) $failedChecks[$name] = ($failedChecks[$name] ?? 0) + 1;
        }
        foreach ($data['warnings'] ?? [] as $warning) {
            $warnings[$warning] = ($warnings[$warning] ?? 0) + 1;
        }
        if ($data['repairable']) $repairableIds[] = (int) $membership->id;
    }
});

ksort($failedChecks);
ksort($warnings);
echo json_encode([
    'summary' => $summary,
    'failed_checks' => $failedChecks,
    'warnings' => $warnings,
    'repairable_membership_ids' => $repairableIds,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), PHP_EOL;
