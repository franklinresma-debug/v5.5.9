<?php
declare(strict_types=1);

$targets = [
    [
        'label' => 'App shell',
        'url' => 'https://app.amsertech.com/',
        'expected' => [200, 399],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Login',
        'url' => 'https://app.amsertech.com/login',
        'expected' => [200, 399],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'UAT Center',
        'url' => 'https://app.amsertech.com/nurselink-production-readiness.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Member Verify',
        'url' => 'https://app.amsertech.com/nurselink-member-verify.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Partner Portal',
        'url' => 'https://app.amsertech.com/nurselink-partner-portal.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Institutional Analytics',
        'url' => 'https://app.amsertech.com/nurselink-institutional-analytics.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Operations Center',
        'url' => 'https://app.amsertech.com/nurselink-operations-center.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Career Intelligence',
        'url' => 'https://app.amsertech.com/nurselink-career-intelligence.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Administrator Sign In',
        'url' => 'https://app.amsertech.com/nurselink-admin-login.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Administrator Dashboard',
        'url' => 'https://app.amsertech.com/nurselink-admin-dashboard.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Notification Center',
        'url' => 'https://app.amsertech.com/nurselink-notifications.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Membership Command Center',
        'url' => 'https://app.amsertech.com/nurselink-membership-command-center.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Membership Administration Suite',
        'url' => 'https://app.amsertech.com/nurselink-membership-administration.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Consolidated Administrator Portal',
        'url' => 'https://app.amsertech.com/nurselink-admin-dashboard.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Administrator Sign In',
        'url' => 'https://app.amsertech.com/nurselink-admin-login.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Membership Welcome Center',
        'url' => 'https://app.amsertech.com/nurselink-membership-welcome.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Membership Onboarding Admin',
        'url' => 'https://app.amsertech.com/nurselink-membership-onboarding-admin.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Member Registry',
        'url' => 'https://app.amsertech.com/nurselink-member-registry.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Super Admin Test Center',
        'url' => 'https://app.amsertech.com/nurselink-super-admin-test-center.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Credential Renewal Center',
        'url' => 'https://app.amsertech.com/nurselink-credential-renewal.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Credential Compliance Center',
        'url' => 'https://app.amsertech.com/nurselink-credential-compliance.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Events & Programs Center',
        'url' => 'https://app.amsertech.com/nurselink-events.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Event Management Center',
        'url' => 'https://app.amsertech.com/nurselink-event-management.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Chapters & Communities Center',
        'url' => 'https://app.amsertech.com/nurselink-chapters.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Chapter Management Center',
        'url' => 'https://app.amsertech.com/nurselink-chapter-management.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Mentoring & Peer Support Center',
        'url' => 'https://app.amsertech.com/nurselink-mentoring.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Member Engagement Hub',
        'url' => 'https://app.amsertech.com/nurselink-engagement.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Engagement Command Center',
        'url' => 'https://app.amsertech.com/nurselink-engagement-command-center.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Member Benefits & Resources Center',
        'url' => 'https://app.amsertech.com/nurselink-benefits.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Benefit Management Center',
        'url' => 'https://app.amsertech.com/nurselink-benefit-management.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Enterprise Member Portal',
        'url' => 'https://app.amsertech.com/nurselink-enterprise.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Enterprise Command Center',
        'url' => 'https://app.amsertech.com/nurselink-enterprise-command-center.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Enterprise Partner Analytics',
        'url' => 'https://app.amsertech.com/nurselink-enterprise-partner.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Enterprise Member Goals',
        'url' => 'https://app.amsertech.com/nurselink-enterprise-goals.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Enterprise Goal Management',
        'url' => 'https://app.amsertech.com/nurselink-enterprise-goals-admin.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Enterprise Partner Goal Analytics',
        'url' => 'https://app.amsertech.com/nurselink-enterprise-goals-partner.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Enterprise Invitations',
        'url' => 'https://app.amsertech.com/nurselink-enterprise-invitations.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Enterprise Enrollment Admin',
        'url' => 'https://app.amsertech.com/nurselink-enterprise-enrollment-admin.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Enterprise Enrollment Partner',
        'url' => 'https://app.amsertech.com/nurselink-enterprise-enrollment-partner.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Enterprise Member Outcomes',
        'url' => 'https://app.amsertech.com/nurselink-enterprise-outcomes.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Enterprise Outcomes Admin',
        'url' => 'https://app.amsertech.com/nurselink-enterprise-outcomes-admin.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Enterprise Outcomes Partner',
        'url' => 'https://app.amsertech.com/nurselink-enterprise-outcomes-partner.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Enterprise Member Support',
        'url' => 'https://app.amsertech.com/nurselink-enterprise-support.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Enterprise Support Admin',
        'url' => 'https://app.amsertech.com/nurselink-enterprise-support-admin.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'Enterprise Support Partner',
        'url' => 'https://app.amsertech.com/nurselink-enterprise-support-partner.html',
        'expected' => [200, 299],
        'headers' => [
            'Cache-Control: no-cache',
        ],
    ],
    [
        'label' => 'API bootstrap / authorized Origin',
        'url' => 'https://api.amsertech.com/api/nurselink/session-bootstrap',
        'expected' => [200, 200],
        'headers' => [
            'Origin: https://app.amsertech.com',
            'Accept: application/json',
            'X-Requested-With: XMLHttpRequest',
            'Cache-Control: no-cache',
        ],
        'body_contains' => '"bootstrap":true',
    ],
    [
        'label' => 'API bootstrap / missing Origin',
        'url' => 'https://api.amsertech.com/api/nurselink/session-bootstrap',
        'expected' => [403, 403],
        'headers' => [
            'Accept: application/json',
            'X-Requested-With: XMLHttpRequest',
            'Cache-Control: no-cache',
        ],
        'security_negative' => true,
    ],
];

echo "NurseLink v5.5.2 Sequential Smoke Test\n";
echo "======================================\n\n";

$fail = 0;
$warn = 0;

foreach ($targets as $target) {
    $label = $target['label'];
    $url = $target['url'];
    [$minStatus, $maxStatus] = $target['expected'];

    $headers = $target['headers'] ?? [];
    $headers[] = 'User-Agent: NurseLink-Production-Smoke/5.5.2';

    $ch = curl_init($url);

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_HEADER => true,
    ]);

    $start = microtime(true);
    $response = curl_exec($ch);
    $ms = round((microtime(true) - $start) * 1000, 1);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $error = curl_error($ch);

    curl_close($ch);

    if ($response === false) {
        $fail++;
        printf(
            "[FAIL] %-34s request failed / %.1f ms%s\n",
            $label,
            $ms,
            $error ? " / $error" : ''
        );
        continue;
    }

    $body = substr($response, $headerSize);
    $statusOk = $status >= $minStatus && $status <= $maxStatus;

    if (!$statusOk) {
        $fail++;
        printf(
            "[FAIL] %-34s HTTP %d / expected %d-%d / %.1f ms\n",
            $label,
            $status,
            $minStatus,
            $maxStatus,
            $ms
        );
        continue;
    }

    $bodyContains = $target['body_contains'] ?? null;

    if (
        is_string($bodyContains)
        && $bodyContains !== ''
        && !str_contains($body, $bodyContains)
    ) {
        $fail++;
        printf(
            "[FAIL] %-34s response body missing expected marker\n",
            $label
        );
        continue;
    }

    $slow = $ms > 2500;

    if ($slow) {
        $warn++;
    }

    if (($target['security_negative'] ?? false) === true) {
        printf(
            "[%s] %-34s HTTP %d / %.1f ms / security rejection expected\n",
            $slow ? 'WARN' : 'PASS',
            $label,
            $status,
            $ms
        );
        continue;
    }

    printf(
        "[%s] %-34s HTTP %d / %.1f ms\n",
        $slow ? 'WARN' : 'PASS',
        $label,
        $status,
        $ms
    );
}

echo "\nSequential smoke test only. No concurrency or load generation.\n";
echo "The bootstrap negative test expects HTTP 403 without the approved Origin.\n";

exit($fail > 0 ? 2 : ($warn > 0 ? 1 : 0));
