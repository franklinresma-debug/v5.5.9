<?php

$apiRoot =
    $argv[1]
    ?? '/home/frankresma/nurselink-api';

$apiRoot = rtrim(
    $apiRoot,
    DIRECTORY_SEPARATOR
);

if (! is_file($apiRoot . '/artisan')) {
    fwrite(
        STDERR,
        "NurseLink API root is invalid: {$apiRoot}\n"
    );
    exit(2);
}

require $apiRoot . '/vendor/autoload.php';

$app = require $apiRoot
    . '/bootstrap/app.php';

$kernel = $app->make(
    Illuminate\Contracts\Console\Kernel::class
);
$kernel->bootstrap();

$service = $app->make(
    App\Services\BenefitReminderService::class
);

$result = $service->generate();

echo "NurseLink Benefit Reminder Generator\n";
echo "====================================\n";
echo "Eligible: "
    . ($result['eligible'] ?? 0)
    . "\n";
echo "30-day reminders sent: "
    . ($result['sent_30_day'] ?? 0)
    . "\n";
echo "7-day reminders sent: "
    . ($result['sent_7_day'] ?? 0)
    . "\n";
echo "Duplicates skipped: "
    . ($result['skipped_duplicate'] ?? 0)
    . "\n";

if (! empty($result['missing_table'])) {
    fwrite(
        STDERR,
        "Required table missing: "
        . $result['missing_table']
        . "\n"
    );
    exit(3);
}

exit(0);
