<?php

declare(strict_types=1);

if ($argc < 3) {
    fwrite(STDERR, "Usage: php db_compat_check.php <api-root> <command> [args...]\n");
    exit(2);
}

$apiRoot = rtrim((string) $argv[1], '/');
$command = (string) $argv[2];

if (! is_file($apiRoot . '/vendor/autoload.php') || ! is_file($apiRoot . '/bootstrap/app.php')) {
    fwrite(STDERR, "Laravel bootstrap files not found in {$apiRoot}.\n");
    exit(2);
}

require $apiRoot . '/vendor/autoload.php';

$app = require $apiRoot . '/bootstrap/app.php';

$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

function columnInfo(string $table, string $column): ?object
{
    return DB::selectOne(
        "SELECT DATA_TYPE, COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1",
        [$table, $column]
    );
}

function normalizedDataType(object $row): string
{
    $type = strtolower((string) $row->DATA_TYPE);
    return $type === 'integer' ? 'int' : $type;
}

function compatibleColumns(object $parent, object $child): bool
{
    $parentType = normalizedDataType($parent);
    $childType = normalizedDataType($child);

    if ($parentType !== $childType) {
        return false;
    }

    if (in_array($parentType, ['tinyint', 'smallint', 'mediumint', 'int', 'bigint'], true)) {
        $parentUnsigned = str_contains(strtolower((string) $parent->COLUMN_TYPE), 'unsigned');
        $childUnsigned = str_contains(strtolower((string) $child->COLUMN_TYPE), 'unsigned');

        return $parentUnsigned === $childUnsigned;
    }

    if (in_array($parentType, ['char', 'varchar'], true)) {
        return (int) $parent->CHARACTER_MAXIMUM_LENGTH ===
            (int) $child->CHARACTER_MAXIMUM_LENGTH;
    }

    return false;
}

try {
    if ($command === 'inspect-users-id') {
        $row = columnInfo('users', 'id');

        if (! $row) {
            fwrite(STDERR, "users.id could not be inspected.\n");
            exit(1);
        }

        echo 'users.id => ' . $row->COLUMN_TYPE . PHP_EOL;
        exit(0);
    }

    if ($command === 'migration-applied') {
        $migration = $argv[3] ?? '';

        if ($migration === '') {
            fwrite(STDERR, "Migration name is required.\n");
            exit(2);
        }

        if (! Schema::hasTable('migrations')) {
            exit(1);
        }

        $exists = DB::table('migrations')
            ->where('migration', $migration)
            ->exists();

        exit($exists ? 0 : 1);
    }

    if ($command === 'verify-user-id-tables') {
        $user = columnInfo('users', 'id');

        if (! $user) {
            fwrite(STDERR, "users.id could not be inspected.\n");
            exit(1);
        }

        $tables = array_slice($argv, 3);

        if ($tables === []) {
            fwrite(STDERR, "At least one child table is required.\n");
            exit(2);
        }

        foreach ($tables as $table) {
            $child = columnInfo((string) $table, 'user_id');

            if (! $child) {
                fwrite(STDERR, "Missing {$table}.user_id.\n");
                exit(1);
            }

            if (! compatibleColumns($user, $child)) {
                fwrite(
                    STDERR,
                    "Type mismatch: {$table}.user_id {$child->COLUMN_TYPE} vs users.id {$user->COLUMN_TYPE}.\n"
                );
                exit(1);
            }

            echo $table . '.user_id => ' . $child->COLUMN_TYPE . " [OK]\n";
        }

        exit(0);
    }

    fwrite(STDERR, "Unknown command: {$command}\n");
    exit(2);
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage() . "\n");
    exit(1);
}
