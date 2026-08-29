<?php
declare(strict_types=1);

$root = $argv[1] ?? '/home/frankresma/nurselink-backups';

echo "NurseLink v3.4.2 Backup Verification\n";
echo "====================================\n\n";

if (!is_dir($root)) {
    fwrite(STDERR, "[FAIL] Backup root does not exist.\n");
    exit(2);
}

$dirs = array_values(array_filter(
    glob(rtrim($root, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . '*') ?: [],
    'is_dir'
));

if ($dirs === []) {
    fwrite(STDERR, "[FAIL] No backup directories found.\n");
    exit(2);
}

usort(
    $dirs,
    static fn(string $a, string $b): int =>
        (@filemtime($b) ?: 0) <=> (@filemtime($a) ?: 0)
);

$latest = $dirs[0];
$age = round(max(0, time() - ((int) @filemtime($latest))) / 3600, 1);

printf("[PASS] Latest backup: %s\n", basename($latest));
printf("[%s] Backup age: %.1f hours\n", $age <= 168 ? 'PASS' : 'WARN', $age);

$bytes = 0;
foreach (new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($latest, FilesystemIterator::SKIP_DOTS)
) as $file) {
    if ($file->isFile()) $bytes += $file->getSize();
}
printf("[PASS] Backup size: %.2f MB\n", $bytes / 1048576);
echo "Read-only verification only. No restore was performed.\n";

exit($age <= 168 ? 0 : 1);
