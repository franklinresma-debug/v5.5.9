<?php
declare(strict_types=1);

$base = __DIR__;
$api = $argv[1] ?? '/home/frankresma/nurselink-api';
$live = $argv[2] ?? '/home/frankresma/app.amsertech.com';
$backups = $argv[3] ?? '/home/frankresma/nurselink-backups';

echo "NurseLink v5.5.2 Release Candidate Gate\n";
echo "=======================================\n";

$tasks = [
    'Operations' => [PHP_BINARY, "$base/nurselink_ops_check.php", $api, $live, $backups],
    'Backup' => [PHP_BINARY, "$base/nurselink_backup_verify.php", $backups],
    'Smoke' => [PHP_BINARY, "$base/nurselink_smoke_test.php"],
];

$fail = 0; $warn = 0;

foreach ($tasks as $label => $parts) {
    echo "\n--- $label ---\n";
    $cmd = implode(' ', array_map('escapeshellarg', $parts));
    passthru($cmd, $code);
    if ($code >= 2) $fail++;
    elseif ($code === 1) $warn++;
}

echo "\nRelease Candidate Summary\n-------------------------\n";

if ($fail > 0) {
    echo "BLOCKED\n";
    exit(2);
}
if ($warn > 0) {
    echo "READY WITH WARNINGS\n";
    exit(1);
}
echo "READY FOR FINAL SIGN-OFF\n";
exit(0);
