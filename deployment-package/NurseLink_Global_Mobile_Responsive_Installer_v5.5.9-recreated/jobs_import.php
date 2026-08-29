<?php

declare(strict_types=1);

if ($argc < 3) {
    fwrite(STDERR, "Usage: php jobs_import.php <api-root> <json-file>\n");
    exit(2);
}

$apiRoot = rtrim((string) $argv[1], '/');
$jsonFile = (string) $argv[2];

if (! is_file($apiRoot . '/vendor/autoload.php') || ! is_file($apiRoot . '/bootstrap/app.php')) {
    fwrite(STDERR, "Laravel bootstrap files not found in {$apiRoot}.\n");
    exit(2);
}

if (! is_file($jsonFile)) {
    fwrite(STDERR, "JSON file not found: {$jsonFile}\n");
    exit(2);
}

require $apiRoot . '/vendor/autoload.php';
$app = require $apiRoot . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$data = json_decode((string) file_get_contents($jsonFile), true);

if (! is_array($data)) {
    fwrite(STDERR, "The import file must contain a JSON array.\n");
    exit(2);
}

$allowedSettings = [
    'hospital','clinic','community','home_care','long_term_care',
    'education','occupational_health','telehealth','government','other'
];

$allowedEmployment = [
    'full_time','part_time','contract','temporary','project_based','other'
];

$allowedLicense = [
    'prc_license','nursing_diploma','international_license',
    'specialty_certification','training_certificate',
    'professional_membership','language_certificate','other'
];

$imported = 0;

foreach ($data as $index => $row) {
    if (! is_array($row)) continue;

    $reference = trim((string) ($row['reference_code'] ?? ''));
    $title = trim((string) ($row['title'] ?? ''));
    $employer = trim((string) ($row['employer_name'] ?? ''));
    $country = trim((string) ($row['country'] ?? ''));

    if ($reference === '' || $title === '' || $employer === '' || $country === '') {
        fwrite(STDERR, "Skipping row {$index}: reference_code, title, employer_name and country are required.\n");
        continue;
    }

    $workSetting = $row['work_setting'] ?? null;
    if ($workSetting !== null && ! in_array($workSetting, $allowedSettings, true)) {
        $workSetting = 'other';
    }

    $employmentType = $row['employment_type'] ?? null;
    if ($employmentType !== null && ! in_array($employmentType, $allowedEmployment, true)) {
        $employmentType = 'other';
    }

    $licenseType = $row['required_license_type'] ?? null;
    if ($licenseType !== null && ! in_array($licenseType, $allowedLicense, true)) {
        $licenseType = null;
    }

    DB::table('nurselink_job_opportunities')->updateOrInsert(
        ['reference_code' => $reference],
        [
            'title' => $title,
            'employer_name' => $employer,
            'country' => $country,
            'city' => $row['city'] ?? null,
            'work_setting' => $workSetting,
            'employment_type' => $employmentType,
            'specialty' => $row['specialty'] ?? null,
            'required_license_type' => $licenseType,
            'minimum_experience_years' => (float) ($row['minimum_experience_years'] ?? 0),
            'overseas_opportunity' => (bool) ($row['overseas_opportunity'] ?? false),
            'salary_min' => isset($row['salary_min']) ? (float) $row['salary_min'] : null,
            'salary_max' => isset($row['salary_max']) ? (float) $row['salary_max'] : null,
            'salary_currency' => $row['salary_currency'] ?? null,
            'description' => $row['description'] ?? null,
            'requirements' => $row['requirements'] ?? null,
            'apply_url' => $row['apply_url'] ?? null,
            'source_label' => $row['source_label'] ?? null,
            'status' => $row['status'] ?? 'active',
            'published_at' => $row['published_at'] ?? now(),
            'expires_at' => $row['expires_at'] ?? null,
            'updated_at' => now(),
            'created_at' => now(),
        ]
    );

    $imported++;
}

echo "Imported/updated {$imported} NurseLink opportunity record(s).\n";
