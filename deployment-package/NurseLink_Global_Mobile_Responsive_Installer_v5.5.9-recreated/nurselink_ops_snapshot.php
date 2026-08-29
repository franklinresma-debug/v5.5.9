<?php
declare(strict_types=1);

$apiRoot = $argv[1] ?? '/home/frankresma/nurselink-api';
$source = $argv[2] ?? 'cli';

require rtrim($apiRoot, DIRECTORY_SEPARATOR) . '/vendor/autoload.php';
$app = require rtrim($apiRoot, DIRECTORY_SEPARATOR) . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

if (!Schema::hasTable('nurselink_operations_snapshots')) {
    fwrite(STDERR, "ERROR: operations snapshot table missing.\n");
    exit(2);
}

$started = microtime(true);
try {
    DB::select('select 1');
    $dbMs = round((microtime(true) - $started) * 1000, 2);
} catch (Throwable) {
    $dbMs = null;
}

$free = @disk_free_space(storage_path());
$total = @disk_total_space(storage_path());
$diskPct = (is_numeric($free) && is_numeric($total) && (float)$total > 0)
    ? round(((float)$free / (float)$total) * 100, 2) : null;

$latest = null;
foreach (glob('/home/frankresma/nurselink-backups/*') ?: [] as $path) {
    if (!is_dir($path)) continue;
    $mtime = @filemtime($path);
    if ($mtime !== false && ($latest === null || $mtime > $latest)) $latest = $mtime;
}
$backupAge = $latest === null ? null : round(max(0, time() - $latest) / 3600, 2);

$logErrors = 0;
$logs = glob(storage_path('logs/*.log')) ?: [];
if ($logs !== []) {
    usort($logs, static fn(string $a, string $b): int => (@filemtime($b) ?: 0) <=> (@filemtime($a) ?: 0));
    $size = @filesize($logs[0]);
    if ($size !== false && ($handle = @fopen($logs[0], 'rb'))) {
        $bytes = min((int)$size, 262144);
        if ($bytes > 0) @fseek($handle, -$bytes, SEEK_END);
        $tail = (string)stream_get_contents($handle);
        fclose($handle);
        preg_match_all('/\.(ERROR|CRITICAL|ALERT|EMERGENCY):/i', $tail, $matches);
        $logErrors = count($matches[0] ?? []);
    }
}

$ht = '/home/frankresma/app.amsertech.com/.htaccess';
$securityOk = is_file($ht) && str_contains((string)@file_get_contents($ht), 'NURSELINK_SECURITY_HEADERS_V330_START');

$warnings = 0;
if ($dbMs === null || $dbMs > 500) $warnings++;
if ($diskPct !== null && $diskPct < 15) $warnings++;
if ($backupAge === null || $backupAge > 168) $warnings++;
if ($logErrors > 0) $warnings++;
if (!$securityOk) $warnings++;

$status = $warnings === 0 ? 'healthy' : 'warning';
if ($diskPct !== null && $diskPct < 5) $status = 'critical';

$id = DB::table('nurselink_operations_snapshots')->insertGetId([
    'status' => $status,
    'database_latency_ms' => $dbMs,
    'disk_free_percent' => $diskPct,
    'backup_age_hours' => $backupAge,
    'recent_log_error_count' => $logErrors,
    'security_headers_ok' => $securityOk,
    'source' => substr((string)$source, 0, 40),
    'created_by' => null,
    'captured_at' => now(),
    'created_at' => now(),
    'updated_at' => now(),
]);

printf("Snapshot #%d recorded: %s\n", $id, $status);
exit(0);
