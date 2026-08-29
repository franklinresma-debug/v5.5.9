<?php

declare(strict_types=1);

if ($argc < 3) {
    fwrite(STDERR, "Usage:\n");
    fwrite(STDERR, "  php partner_access.php <api-root> org-list\n");
    fwrite(STDERR, "  php partner_access.php <api-root> org-create <name> <type> <country> [city] [website]\n");
    fwrite(STDERR, "  php partner_access.php <api-root> org-status <org-id> <pending|verified|suspended>\n");
    fwrite(STDERR, "  php partner_access.php <api-root> access-list\n");
    fwrite(STDERR, "  php partner_access.php <api-root> grant <user-id-or-email> <org-id> <viewer|recruiter|manager>\n");
    fwrite(STDERR, "  php partner_access.php <api-root> revoke <user-id-or-email>\n");
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

function partnerResolveUser(string $identifier): ?object
{
    $query = DB::table('users')->where('id', $identifier);

    if (Schema::hasColumn('users', 'email')) {
        $query->orWhere('email', $identifier);
    }

    return $query->first();
}

foreach (['nurselink_partner_organizations', 'nurselink_partner_access'] as $table) {
    if (! Schema::hasTable($table)) {
        fwrite(STDERR, "{$table} does not exist. Install NurseLink v2.7.0 first.\n");
        exit(1);
    }
}

if ($command === 'org-list') {
    $rows = DB::table('nurselink_partner_organizations')
        ->orderBy('id')
        ->get();

    if ($rows->isEmpty()) {
        echo "No NurseLink partner organizations found.\n";
        exit(0);
    }

    foreach ($rows as $row) {
        echo $row->id
            . " | " . $row->name
            . " | " . $row->organization_type
            . " | " . $row->country
            . " | " . $row->status
            . PHP_EOL;
    }

    exit(0);
}

if ($command === 'org-create') {
    $name = trim((string) ($argv[3] ?? ''));
    $type = strtolower(trim((string) ($argv[4] ?? '')));
    $country = trim((string) ($argv[5] ?? ''));
    $city = trim((string) ($argv[6] ?? ''));
    $website = trim((string) ($argv[7] ?? ''));

    $types = [
        'hospital',
        'health_system',
        'clinic',
        'recruitment_agency',
        'government',
        'education',
        'professional_organization',
        'other',
    ];

    if ($name === '' || $country === '' || ! in_array($type, $types, true)) {
        fwrite(STDERR, "org-create requires valid name, type and country.\n");
        exit(2);
    }

    $id = DB::table('nurselink_partner_organizations')->insertGetId([
        'name' => $name,
        'organization_type' => $type,
        'country' => $country,
        'city' => $city !== '' ? $city : null,
        'website' => $website !== '' ? $website : null,
        'status' => 'verified',
        'verified_by' => 'terminal-admin',
        'verified_at' => now(),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    echo "Created verified NurseLink partner organization #{$id}: {$name}\n";
    exit(0);
}

if ($command === 'org-status') {
    $orgId = (int) ($argv[3] ?? 0);
    $status = strtolower((string) ($argv[4] ?? ''));

    if ($orgId < 1 || ! in_array($status, ['pending', 'verified', 'suspended'], true)) {
        fwrite(STDERR, "org-status requires <org-id> <pending|verified|suspended>.\n");
        exit(2);
    }

    $exists = DB::table('nurselink_partner_organizations')->where('id', $orgId)->exists();

    if (! $exists) {
        fwrite(STDERR, "Partner organization not found: {$orgId}\n");
        exit(1);
    }

    DB::table('nurselink_partner_organizations')
        ->where('id', $orgId)
        ->update([
            'status' => $status,
            'verified_by' => $status === 'verified' ? 'terminal-admin' : null,
            'verified_at' => $status === 'verified' ? now() : null,
            'updated_at' => now(),
        ]);

    echo "Partner organization #{$orgId} is now {$status}.\n";
    exit(0);
}

if ($command === 'access-list') {
    $rows = DB::table('nurselink_partner_access as a')
        ->join('nurselink_partner_organizations as o', 'o.id', '=', 'a.partner_organization_id')
        ->orderBy('o.name')
        ->get([
            'a.user_id',
            'a.role',
            'a.active',
            'o.id as organization_id',
            'o.name as organization_name',
        ]);

    if ($rows->isEmpty()) {
        echo "No NurseLink partner access grants found.\n";
        exit(0);
    }

    foreach ($rows as $row) {
        echo $row->user_id
            . " | org #" . $row->organization_id
            . " " . $row->organization_name
            . " | " . $row->role
            . " | " . ($row->active ? 'active' : 'inactive')
            . PHP_EOL;
    }

    exit(0);
}

$identifier = trim((string) ($argv[3] ?? ''));

if ($identifier === '') {
    fwrite(STDERR, "A user ID or email is required.\n");
    exit(2);
}

$user = partnerResolveUser($identifier);

if (! $user) {
    fwrite(STDERR, "User not found: {$identifier}\n");
    exit(1);
}

$userId = (string) $user->id;

if ($command === 'grant') {
    $orgId = (int) ($argv[4] ?? 0);
    $role = strtolower((string) ($argv[5] ?? ''));

    if ($orgId < 1 || ! in_array($role, ['viewer', 'recruiter', 'manager'], true)) {
        fwrite(STDERR, "grant requires <org-id> <viewer|recruiter|manager>.\n");
        exit(2);
    }

    $org = DB::table('nurselink_partner_organizations')->where('id', $orgId)->first();

    if (! $org) {
        fwrite(STDERR, "Partner organization not found: {$orgId}\n");
        exit(1);
    }

    DB::table('nurselink_partner_access')->updateOrInsert(
        ['user_id' => $userId],
        [
            'partner_organization_id' => $orgId,
            'role' => $role,
            'active' => true,
            'updated_at' => now(),
            'created_at' => now(),
        ]
    );

    echo "Granted {$role} access to {$userId} for {$org->name}.\n";
    exit(0);
}

if ($command === 'revoke') {
    DB::table('nurselink_partner_access')
        ->where('user_id', $userId)
        ->update([
            'active' => false,
            'updated_at' => now(),
        ]);

    echo "Revoked NurseLink partner access for {$userId}.\n";
    exit(0);
}

fwrite(STDERR, "Unknown command: {$command}\n");
exit(2);
