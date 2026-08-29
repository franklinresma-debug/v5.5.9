<?php

declare(strict_types=1);

if ($argc < 2) {
    fwrite(STDERR, "Usage: php cors_env_fix.php <api-root>\n");
    exit(2);
}

$apiRoot = rtrim((string) $argv[1], '/');
$envPath = $apiRoot . '/.env';

if (! is_file($envPath)) {
    fwrite(STDERR, ".env not found: {$envPath}\n");
    exit(1);
}

$values = [
    'FRONTEND_URL' => 'https://app.amsertech.com',
    'CORS_ALLOWED_ORIGINS' => 'https://app.amsertech.com',
    'SESSION_DOMAIN' => '.amsertech.com',
    'SANCTUM_STATEFUL_DOMAINS' => 'app.amsertech.com',
    'SESSION_SECURE_COOKIE' => 'true',
    'SESSION_SAME_SITE' => 'lax',
];

$text = (string) file_get_contents($envPath);

foreach ($values as $key => $value) {
    $line = $key . '=' . $value;
    $pattern = '/^' . preg_quote($key, '/') . '=.*$/m';

    if (preg_match($pattern, $text)) {
        $text = preg_replace($pattern, $line, $text, 1);
    } else {
        $text = rtrim($text) . PHP_EOL . $line . PHP_EOL;
    }
}

if (file_put_contents($envPath, $text) === false) {
    fwrite(STDERR, "Unable to update {$envPath}\n");
    exit(1);
}

echo "NurseLink auth/CORS environment values updated.\n";
