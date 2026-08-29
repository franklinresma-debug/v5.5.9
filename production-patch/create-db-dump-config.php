<?php

use Illuminate\Contracts\Console\Kernel;

require '/var/www/nurselink-api/vendor/autoload.php';
$app = require '/var/www/nurselink-api/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$connection = config('database.connections.mysql');
$escape = static fn (mixed $value): string => str_replace(
    ["\\", "\n", "\r", "\""] ,
    ["\\\\", "\\n", "\\r", "\\\""] ,
    (string) $value
);

$contents = sprintf(
    "[client]\nhost=\"%s\"\nport=\"%s\"\nuser=\"%s\"\npassword=\"%s\"\n",
    $escape($connection['host'] ?? '127.0.0.1'),
    $escape($connection['port'] ?? '3306'),
    $escape($connection['username'] ?? ''),
    $escape($connection['password'] ?? '')
);

$path = $argv[1] ?? null;
if (! $path) throw new RuntimeException('Output path is required.');
file_put_contents($path, $contents, LOCK_EX);
chmod($path, 0600);
