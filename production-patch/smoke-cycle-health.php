<?php

use App\Http\Controllers\Api\MembershipCycleHealthController;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require '/var/www/nurselink-api/vendor/autoload.php';
$app = require '/var/www/nurselink-api/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$membershipId = DB::table('nurselink_memberships')->orderBy('id')->value('id');
if (! $membershipId) {
    fwrite(STDERR, "No membership record is available for the smoke test.\n");
    exit(2);
}

$response = $app->make(MembershipCycleHealthController::class)->show((int) $membershipId);
$payload = json_decode($response->getContent(), true, flags: JSON_THROW_ON_ERROR);

if (! isset($payload['data']['status'], $payload['data']['checks'])) {
    fwrite(STDERR, "Cycle-health response is invalid.\n");
    exit(3);
}

printf(
    "CYCLE_HEALTH_SMOKE_OK membership_id=%d status=%s checks=%d\n",
    $membershipId,
    $payload['data']['status'],
    count($payload['data']['checks'])
);
