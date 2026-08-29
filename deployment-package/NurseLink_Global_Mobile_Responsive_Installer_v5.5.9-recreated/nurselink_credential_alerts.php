<?php
declare(strict_types=1);

$apiRoot = $argv[1] ?? '/home/frankresma/nurselink-api';
$mode = $argv[2] ?? 'run';
$dryRun = $mode === '--dry-run' || $mode === 'dry-run';

require rtrim($apiRoot, DIRECTORY_SEPARATOR) . '/vendor/autoload.php';
$app = require rtrim($apiRoot, DIRECTORY_SEPARATOR) . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

if (! Schema::hasTable('nurselink_credentials_registry')) {
    fwrite(STDERR, "ERROR: credential registry table missing.\n");
    exit(2);
}

if (! Schema::hasTable('nurselink_notifications')) {
    fwrite(STDERR, "ERROR: notifications table missing.\n");
    exit(2);
}

if (! Schema::hasTable('nurselink_memberships')) {
    fwrite(STDERR, "ERROR: memberships table missing.\n");
    exit(2);
}

$today = CarbonImmutable::today();

$rows = DB::table('nurselink_credentials_registry as c')
    ->join(
        'nurselink_memberships as m',
        'm.user_id',
        '=',
        'c.user_id'
    )
    ->where('m.status', 'approved')
    ->where(function ($query): void {
        $query
            ->whereNull('m.standing')
            ->orWhere('m.standing', 'active');
    })
    ->whereNotNull('c.expiry_date')
    ->whereDate(
        'c.expiry_date',
        '<=',
        $today->addDays(180)->toDateString()
    )
    ->select([
        'c.id',
        'c.user_id',
        'c.title',
        'c.credential_type',
        'c.issuing_body',
        'c.expiry_date',
    ])
    ->orderBy('c.expiry_date')
    ->get();

$created = 0;
$skipped = 0;

foreach ($rows as $row) {
    try {
        $expiry = CarbonImmutable::parse(
            (string) $row->expiry_date
        )->startOfDay();
    } catch (Throwable) {
        $skipped++;
        continue;
    }

    $days = $today->diffInDays($expiry, false);

    if ($days < 0) {
        $state = 'expired';
        $severity = 'warning';
        $headline = 'Credential expired';
        $windowText = sprintf(
            '%d day%s ago',
            abs($days),
            abs($days) === 1 ? '' : 's'
        );
    } elseif ($days <= 30) {
        $state = '30';
        $severity = 'warning';
        $headline = 'Credential renewal due soon';
        $windowText = sprintf(
            'in %d day%s',
            $days,
            $days === 1 ? '' : 's'
        );
    } elseif ($days <= 90) {
        $state = '90';
        $severity = 'info';
        $headline = 'Credential renewal planning reminder';
        $windowText = sprintf(
            'in %d days',
            $days
        );
    } else {
        $state = '180';
        $severity = 'info';
        $headline = 'Credential renewal outlook';
        $windowText = sprintf(
            'in %d days',
            $days
        );
    }

    $expiryKey = str_replace('-', '', $expiry->toDateString());

    $type = sprintf(
        'credential.renewal.alert.%d.%s.%s',
        (int) $row->id,
        $expiryKey,
        $state
    );

    $alreadyExists = DB::table('nurselink_notifications')
        ->where('user_id', $row->user_id)
        ->where('type', $type)
        ->exists();

    if ($alreadyExists) {
        $skipped++;
        continue;
    }

    $title = trim((string) $row->title);
    if ($title === '') {
        $title = 'Professional credential';
    }

    $message = sprintf(
        '%s is due %s. Review official renewal requirements with the issuing body and update your NurseLink renewal plan. NurseLink reminders are advisory and do not replace regulator or issuer requirements.',
        $title,
        $windowText
    );

    if ($dryRun) {
        printf(
            "[DRY RUN] %s | user=%s | credential=%d | %s\n",
            $type,
            (string) $row->user_id,
            (int) $row->id,
            $message
        );
        $created++;
        continue;
    }

    DB::table('nurselink_notifications')->insert([
        'user_id' => $row->user_id,
        'type' => $type,
        'severity' => $severity,
        'title' => $headline,
        'message' => $message,
        'action_url' =>
            '/nurselink-credential-renewal.html',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $created++;
}

printf(
    "Credential renewal alerts complete. created=%d skipped=%d dry_run=%s\n",
    $created,
    $skipped,
    $dryRun ? 'yes' : 'no'
);

exit(0);
