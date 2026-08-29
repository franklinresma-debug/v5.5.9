<?php

declare(strict_types=1);

if ($argc < 3) {
    fwrite(STDERR, "Usage:\n");
    fwrite(STDERR, "  php super_admin_access.php <api-root> list\n");
    fwrite(STDERR, "  php super_admin_access.php <api-root> grant <user-id-or-email> [note]\n");
    fwrite(STDERR, "  php super_admin_access.php <api-root> revoke <user-id-or-email>\n");
    exit(2);
}

$apiRoot = rtrim((string) $argv[1], '/');
$command = strtolower(trim((string) $argv[2]));

if (
    !is_file($apiRoot . '/vendor/autoload.php')
    || !is_file($apiRoot . '/bootstrap/app.php')
) {
    fwrite(STDERR, "Laravel bootstrap files not found in {$apiRoot}.\n");
    exit(2);
}

require $apiRoot . '/vendor/autoload.php';

$app = require $apiRoot . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

function resolveSuperAdminUser(string $identifier): ?object
{
    $query = DB::table('users')->where('id', $identifier);

    if (Schema::hasColumn('users', 'email')) {
        $query->orWhere('email', $identifier);
    }

    return $query->first();
}

if (!Schema::hasTable('nurselink_super_admin_access')) {
    fwrite(STDERR, "nurselink_super_admin_access does not exist. Install NurseLink v5.5.2 first.\n");
    exit(1);
}

if ($command === 'list') {
    $rows = DB::table('nurselink_super_admin_access')
        ->orderByDesc('active')
        ->orderByDesc('granted_at')
        ->orderBy('user_id')
        ->get();

    if ($rows->isEmpty()) {
        echo "No explicit NurseLink Super Administrator grants found.\n";
        exit(0);
    }

    foreach ($rows as $row) {
        echo $row->user_id
            . " | super_admin | "
            . ($row->active ? 'active' : 'inactive')
            . ($row->granted_at ? " | granted {$row->granted_at}" : '')
            . PHP_EOL;
    }

    exit(0);
}

$identifier = trim((string) ($argv[3] ?? ''));

if ($identifier === '') {
    fwrite(STDERR, "A user ID or login email is required.\n");
    exit(2);
}

$user = resolveSuperAdminUser($identifier);

if (!$user) {
    fwrite(STDERR, "User not found: {$identifier}\n");
    exit(1);
}

$userId = (string) $user->id;

if ($command === 'grant') {
    $note = trim((string) ($argv[4] ?? 'Granted through NurseLink cPanel administration.'));

    $exists = DB::table('nurselink_super_admin_access')
        ->where('user_id', $userId)
        ->exists();

    $payload = [
        'active' => true,
        'note' => $note !== '' ? substr($note, 0, 255) : null,
        'granted_at' => now(),
        'revoked_at' => null,
        'updated_at' => now(),
    ];

    if ($exists) {
        DB::table('nurselink_super_admin_access')
            ->where('user_id', $userId)
            ->update($payload);
    } else {
        DB::table('nurselink_super_admin_access')->insert([
            ...$payload,
            'user_id' => $userId,
            'created_at' => now(),
        ]);
    }

    /*
     * A Super Administrator must also retain normal NurseLink admin
     * permissions. Keep reviewer/admin authorization compatible by ensuring
     * the existing reviewer access record is active and set to admin.
     */
    if (Schema::hasTable('nurselink_reviewer_access')) {
        $reviewerExists = DB::table('nurselink_reviewer_access')
            ->where('user_id', $userId)
            ->exists();

        if ($reviewerExists) {
            DB::table('nurselink_reviewer_access')
                ->where('user_id', $userId)
                ->update([
                    'role' => 'admin',
                    'active' => true,
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('nurselink_reviewer_access')->insert([
                'user_id' => $userId,
                'role' => 'admin',
                'active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    echo "Granted SUPER ADMINISTRATOR identity to {$userId}.\n";
    echo "Normal NurseLink administrator access is active for the same account.\n";
    exit(0);
}

if ($command === 'revoke') {
    DB::table('nurselink_super_admin_access')
        ->where('user_id', $userId)
        ->update([
            'active' => false,
            'revoked_at' => now(),
            'updated_at' => now(),
        ]);

    echo "Revoked SUPER ADMINISTRATOR identity for {$userId}.\n";
    echo "Existing reviewer/admin access was not removed.\n";
    exit(0);
}

fwrite(STDERR, "Unknown command: {$command}\n");
exit(2);
