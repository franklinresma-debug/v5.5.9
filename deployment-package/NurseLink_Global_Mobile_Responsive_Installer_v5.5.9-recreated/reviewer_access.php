<?php

declare(strict_types=1);

if ($argc < 3) {
    fwrite(STDERR, "Usage:\n");
    fwrite(STDERR, "  php reviewer_access.php <api-root> list\n");
    fwrite(STDERR, "  php reviewer_access.php <api-root> grant <user-id-or-email> <reviewer|admin>\n");
    fwrite(STDERR, "  php reviewer_access.php <api-root> revoke <user-id-or-email>\n");
    exit(2);
}

$apiRoot = rtrim((string) $argv[1], '/');
$command = strtolower((string) $argv[2]);

if (! is_file($apiRoot . '/vendor/autoload.php') || ! is_file($apiRoot . '/bootstrap/app.php')) {
    fwrite(STDERR, "Laravel bootstrap files not found in {$apiRoot}.\n");
    exit(2);
}

require $apiRoot . '/vendor/autoload.php';
$app = require $apiRoot . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

function resolveUser(string $identifier): ?object
{
    $query = DB::table('users')->where('id', $identifier);

    if (Schema::hasColumn('users', 'email')) {
        $query->orWhere('email', $identifier);
    }

    return $query->first();
}

if (! Schema::hasTable('nurselink_reviewer_access')) {
    fwrite(STDERR, "nurselink_reviewer_access does not exist. Install NurseLink v2.3.0 first.\n");
    exit(1);
}

if ($command === 'list') {
    $rows = DB::table('nurselink_reviewer_access')
        ->orderByDesc('active')
        ->orderBy('role')
        ->orderBy('user_id')
        ->get();

    if ($rows->isEmpty()) {
        echo "No explicit NurseLink reviewer grants found.\n";
        exit(0);
    }

    foreach ($rows as $row) {
        echo $row->user_id . " | " . $row->role . " | " . ($row->active ? 'active' : 'inactive') . PHP_EOL;
    }

    exit(0);
}

$identifier = trim((string) ($argv[3] ?? ''));

if ($identifier === '') {
    fwrite(STDERR, "A user ID or email is required.\n");
    exit(2);
}

$user = resolveUser($identifier);

if (! $user) {
    fwrite(STDERR, "User not found: {$identifier}\n");
    exit(1);
}

$userId = (string) $user->id;

if ($command === 'grant') {
    $role = strtolower((string) ($argv[4] ?? ''));

    if (! in_array($role, ['reviewer', 'admin'], true)) {
        fwrite(STDERR, "Role must be reviewer or admin.\n");
        exit(2);
    }

    DB::table('nurselink_reviewer_access')->updateOrInsert(
        ['user_id' => $userId],
        [
            'role' => $role,
            'active' => true,
            'updated_at' => now(),
            'created_at' => now(),
        ]
    );

    echo "Granted {$role} access to {$userId}.\n";
    exit(0);
}

if ($command === 'revoke') {
    DB::table('nurselink_reviewer_access')
        ->where('user_id', $userId)
        ->update([
            'active' => false,
            'updated_at' => now(),
        ]);

    echo "Revoked NurseLink reviewer access for {$userId}.\n";
    exit(0);
}

fwrite(STDERR, "Unknown command: {$command}\n");
exit(2);
