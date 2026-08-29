<?php
declare(strict_types=1);

$apiRoot = $argv[1] ?? '/home/frankresma/nurselink-api';
$release = $argv[2] ?? '5.5.2';
$backupLabel = $argv[3] ?? null;

require rtrim($apiRoot, DIRECTORY_SEPARATOR) . '/vendor/autoload.php';
$app = require rtrim($apiRoot, DIRECTORY_SEPARATOR) . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

if (!Schema::hasTable('nurselink_deployments')) {
    fwrite(STDERR, "ERROR: deployment history table missing.\n");
    exit(2);
}

$id = DB::table('nurselink_deployments')->insertGetId([
    'release' => substr((string)$release, 0, 40),
    'stage' => 'production',
    'backup_label' => $backupLabel ? substr(basename((string)$backupLabel), 0, 190) : null,
    'source' => 'installer',
    'deployed_by' => null,
    'notes' => 'Cumulative NurseLink production deployment.',
    'deployed_at' => now(),
    'created_at' => now(),
    'updated_at' => now(),
]);

printf("Deployment #%d recorded for %s.\n", $id, $release);
exit(0);
