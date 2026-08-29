<?php
declare(strict_types=1);

$apiRoot = $argv[1] ?? '/home/frankresma/nurselink-api';
$liveRoot = $argv[2] ?? '/home/frankresma/app.amsertech.com';
$backupRoot = $argv[3] ?? '/home/frankresma/nurselink-backups';

$pass = 0; $warn = 0; $fail = 0;

function out(string $status, string $label, string $detail = ''): void {
    global $pass, $warn, $fail;
    if ($status === 'PASS') $pass++;
    elseif ($status === 'WARN') $warn++;
    else $fail++;

    printf("[%-4s] %-42s%s\n", $status, $label, $detail ? " - $detail" : '');
}

function envMap(string $path): array {
    if (!is_file($path)) return [];
    $out = [];
    foreach (file($path, FILE_IGNORE_NEW_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $out[trim($k)] = trim(trim($v), "\"'");
    }
    return $out;
}

function latestBackupAge(string $root): ?float {
    if (!is_dir($root)) return null;
    $latest = null;
    foreach (glob(rtrim($root, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . '*') ?: [] as $path) {
        if (!is_dir($path)) continue;
        $mtime = @filemtime($path);
        if ($mtime !== false && ($latest === null || $mtime > $latest)) $latest = $mtime;
    }
    return $latest === null ? null : round(max(0, time() - $latest) / 3600, 1);
}

echo "NurseLink v3.3.0 Production Operations Check\n";
echo "=============================================\n\n";

out(is_dir($apiRoot) ? 'PASS' : 'FAIL', 'Laravel API root exists');
out(is_file("$apiRoot/artisan") ? 'PASS' : 'FAIL', 'Laravel artisan exists');
out(is_file("$apiRoot/.env") ? 'PASS' : 'FAIL', 'Laravel .env exists');
out(is_dir($liveRoot) ? 'PASS' : 'FAIL', 'Live frontend root exists');

$env = envMap("$apiRoot/.env");

foreach ([
    'APP_URL' => 'https://api.amsertech.com',
    'SESSION_DOMAIN' => '.amsertech.com',
    'SANCTUM_STATEFUL_DOMAINS' => 'app.amsertech.com',
    'CORS_ALLOWED_ORIGINS' => 'https://app.amsertech.com',
] as $key => $expected) {
    out(
        ($env[$key] ?? null) === $expected ? 'PASS' : 'WARN',
        "Environment: $key",
        ($env[$key] ?? null) === $expected ? 'expected production value' : 'review required'
    );
}

out(
    strtolower((string)($env['APP_DEBUG'] ?? 'false')) === 'false' ? 'PASS' : 'FAIL',
    'APP_DEBUG disabled'
);

$envPath = "$apiRoot/.env";
if (is_file($envPath)) {
    $mode = @fileperms($envPath);
    $worldReadable = is_int($mode) && (($mode & 0x0004) !== 0);
    $worldWritable = is_int($mode) && (($mode & 0x0002) !== 0);
    out(!$worldReadable && !$worldWritable ? 'PASS' : 'WARN', '.env not world-readable/writable');
}

out(
    is_dir("$apiRoot/storage/logs") && is_writable("$apiRoot/storage/logs") ? 'PASS' : 'FAIL',
    'Laravel log directory writable'
);

out(
    is_dir("$apiRoot/bootstrap/cache") && is_writable("$apiRoot/bootstrap/cache") ? 'PASS' : 'WARN',
    'Laravel bootstrap cache writable'
);

$free = @disk_free_space($apiRoot);
$total = @disk_total_space($apiRoot);

if (is_numeric($free) && is_numeric($total) && (float)$total > 0) {
    $percent = round(((float)$free / (float)$total) * 100, 1);
    $gb = round((float)$free / 1073741824, 2);
    out($percent >= 10 ? 'PASS' : 'WARN', 'Filesystem free capacity', "$percent% / $gb GB free");
} else {
    out('WARN', 'Filesystem free capacity', 'unable to calculate');
}

$age = latestBackupAge($backupRoot);
out(
    $age !== null && $age <= 168 ? 'PASS' : 'WARN',
    'Recent NurseLink backup',
    $age === null ? 'none detected' : "$age hours old"
);

foreach ([
    'index.html',
    'nurselink-production-readiness.html',
    'nurselink-partner-portal.html',
    'nurselink-institutional-analytics.html',
    'nurselink-member-verify.html',
    'nurselink-qrcode.min.js',
    'nurselink-operations-center.html',
    'nurselink-operations-center.js',
    'nurselink-operations-center.css',
    'nurselink-career-intelligence.html',
    'nurselink-career-intelligence.js',
    'nurselink-career-intelligence.css',
    'nurselink-admin-identity.js',
    'nurselink-admin-identity.css',
    'nurselink-admin-login.html',
    'nurselink-admin-login.js',
    'nurselink-admin-dashboard.html',
    'nurselink-admin-dashboard.js',
    'nurselink-portal-config.js',
    'nurselink-admin-consolidated.css',
    'nurselink-admin-portal.css',
    'nurselink-notifications.html',
    'nurselink-notifications.js',
    'nurselink-notifications.css',
    'nurselink-membership-command-center.html',
    'nurselink-membership-command-center.js',
    'nurselink-membership-command-center.css',
    'nurselink-membership-administration.html',
    'nurselink-membership-administration.js',
    'nurselink-membership-administration.css',
    'nurselink-membership-welcome.html',
    'nurselink-membership-welcome.js',
    'nurselink-membership-welcome.css',
    'nurselink-membership-onboarding-admin.html',
    'nurselink-membership-onboarding-admin.js',
    'nurselink-membership-onboarding-admin.css',
    'nurselink-member-registry.html',
    'nurselink-member-registry.js',
    'nurselink-member-registry.css',
    'nurselink-super-admin-test-center.html',
    'nurselink-super-admin-test-center.js',
    'nurselink-super-admin-test-center.css',
    'nurselink-credential-renewal.html',
    'nurselink-credential-renewal.js',
    'nurselink-credential-renewal.css',
    'nurselink-credential-compliance.html',
    'nurselink-credential-compliance.js',
    'nurselink-credential-compliance.css',
    'nurselink-events.html',
    'nurselink-events.js',
    'nurselink-events.css',
    'nurselink-event-management.html',
    'nurselink-event-management.js',
    'nurselink-event-management.css',
    'nurselink-chapters.html',
    'nurselink-chapters.js',
    'nurselink-chapters.css',
    'nurselink-chapter-management.html',
    'nurselink-chapter-management.js',
    'nurselink-chapter-management.css',
    'nurselink-mentoring.html',
    'nurselink-mentoring.js',
    'nurselink-mentoring.css',
    'nurselink-engagement.html',
    'nurselink-engagement.js',
    'nurselink-engagement.css',
    'nurselink-engagement-command-center.html',
    'nurselink-engagement-command-center.js',
    'nurselink-engagement-command-center.css',
    'nurselink-benefits.html',
    'nurselink-benefits.js',
    'nurselink-benefits.css',
    'nurselink-benefit-management.html',
    'nurselink-benefit-management.js',
    'nurselink-benefit-management.css',
    'nurselink-enterprise.html',
    'nurselink-enterprise.js',
    'nurselink-enterprise.css',
    'nurselink-enterprise-command-center.html',
    'nurselink-enterprise-command-center.js',
    'nurselink-enterprise-command-center.css',
    'nurselink-enterprise-partner.html',
    'nurselink-enterprise-partner.js',
    'nurselink-enterprise-partner.css',
    'nurselink-enterprise-goals.html',
    'nurselink-enterprise-goals.js',
    'nurselink-enterprise-goals.css',
    'nurselink-enterprise-goals-admin.html',
    'nurselink-enterprise-goals-admin.js',
    'nurselink-enterprise-goals-admin.css',
    'nurselink-enterprise-goals-partner.html',
    'nurselink-enterprise-goals-partner.js',
    'nurselink-enterprise-goals-partner.css',
    'nurselink-enterprise-invitations.html',
    'nurselink-enterprise-invitations.js',
    'nurselink-enterprise-invitations.css',
    'nurselink-enterprise-enrollment-admin.html',
    'nurselink-enterprise-enrollment-admin.js',
    'nurselink-enterprise-enrollment-admin.css',
    'nurselink-enterprise-enrollment-partner.html',
    'nurselink-enterprise-enrollment-partner.js',
    'nurselink-enterprise-enrollment-partner.css',
    'nurselink-enterprise-outcomes.html',
    'nurselink-enterprise-outcomes.js',
    'nurselink-enterprise-outcomes.css',
    'nurselink-enterprise-outcomes-admin.html',
    'nurselink-enterprise-outcomes-admin.js',
    'nurselink-enterprise-outcomes-admin.css',
    'nurselink-enterprise-outcomes-partner.html',
    'nurselink-enterprise-outcomes-partner.js',
    'nurselink-enterprise-outcomes-partner.css',
    'nurselink-enterprise-support.html',
    'nurselink-enterprise-support.js',
    'nurselink-enterprise-support.css',
    'nurselink-enterprise-support-admin.html',
    'nurselink-enterprise-support-admin.js',
    'nurselink-enterprise-support-admin.css',
    'nurselink-enterprise-support-partner.html',
    'nurselink-enterprise-support-partner.js',
    'nurselink-enterprise-support-partner.css',
] as $file) {
    out(is_file("$liveRoot/$file") ? 'PASS' : 'FAIL', "Live file: $file");
}

$ht = is_file("$liveRoot/.htaccess")
    ? (string) file_get_contents("$liveRoot/.htaccess")
    : '';

foreach ([
    'NURSELINK_STANDALONE_PAGES_V321_START' => 'Standalone SPA bypass policy',
    'NURSELINK_CACHE_POLICY_V263_START' => 'Browser cache policy',
    'NURSELINK_SECURITY_HEADERS_V330_START' => 'Security headers policy',
] as $marker => $label) {
    out(str_contains($ht, $marker) ? 'PASS' : 'WARN', $label);
}

$login = "$apiRoot/app/Http/Controllers/Api/SessionLoginController.php";
$src = is_file($login) ? (string) file_get_contents($login) : '';

out(
    str_contains($src, "hash_equals('https://app.amsertech.com'") ? 'PASS' : 'FAIL',
    'Session login exact-origin guard'
);

out(
    str_contains($src, 'RateLimiter::tooManyAttempts($key, 5)')
    && str_contains($src, 'RateLimiter::hit($key, 60)')
        ? 'PASS' : 'WARN',
    'Session login rate limit 5/minute'
);


$adminLoginPath = "$apiRoot/app/Http/Controllers/Api/AdminSessionLoginController.php";
$adminLogin = is_file($adminLoginPath)
    ? (string) file_get_contents($adminLoginPath)
    : '';

out(
    str_contains($adminLogin, "hash_equals(self::FRONTEND_ORIGIN")
    && str_contains($adminLogin, "nurselink-admin|")
        ? 'PASS' : 'FAIL',
    'Administrator login exact-origin + separate rate-limit namespace'
);

out(
    str_contains($adminLogin, 'nurselink_admin_elevated_user_id')
    && str_contains($adminLogin, 'nurselink_admin_expires_at')
        ? 'PASS' : 'FAIL',
    'Separate Administrator session elevation'
);

$adminPortalPath = "$apiRoot/app/Http/Controllers/Api/AdminPortalController.php";
$adminPortal = is_file($adminPortalPath)
    ? (string) file_get_contents($adminPortalPath)
    : '';

out(
    str_contains($adminPortal, 'Super Administrator access is required to manage staff roles')
    && str_contains($adminPortal, 'cannot revoke their own access')
    && str_contains($adminPortal, 'last active Super Administrator')
        ? 'PASS' : 'FAIL',
    'Administrator access-management protections'
);


$membershipCommandPath = "$apiRoot/app/Http/Controllers/Api/AdminMembershipCommandController.php";
$membershipCommand = is_file($membershipCommandPath)
    ? (string) file_get_contents($membershipCommandPath)
    : '';

out(
    str_contains($membershipCommand, 'Membership must be Ready for Approval before final approval.')
    && str_contains($membershipCommand, 'membership.self_action_super_admin')
    && str_contains($membershipCommand, 'decision reason is required')
        ? 'PASS' : 'FAIL',
    'Membership approval governance'
);

$membershipReviewPath = "$apiRoot/app/Http/Controllers/Api/MembershipReviewController.php";
$membershipReview = is_file($membershipReviewPath)
    ? (string) file_get_contents($membershipReviewPath)
    : '';

out(
    str_contains($membershipReview, 'A separate NurseLink administrator sign-in is required for membership review.')
    && str_contains($membershipReview, 'Self-actions must use the Membership Command Center')
        ? 'PASS' : 'FAIL',
    'Legacy membership review governance alignment'
);


$memberRegistryPath = "$apiRoot/app/Http/Controllers/Api/AdminMemberRegistryController.php";
$memberRegistry = is_file($memberRegistryPath)
    ? (string) file_get_contents($memberRegistryPath)
    : '';

out(
    str_contains($memberRegistry, 'Administrator access is required for the approved-member registry.')
    && str_contains($memberRegistry, "'credential_numbers_exposed' => false")
    && str_contains($memberRegistry, "'uploaded_documents_exposed' => false")
        ? 'PASS' : 'FAIL',
    'Approved-member registry privacy boundary'
);

out(
    str_contains($memberRegistry, "where('status', 'approved')")
    && str_contains($memberRegistry, "'registry_is_read_only' => true")
        ? 'PASS' : 'FAIL',
    'Approved-member registry read-only scope'
);


$testModePath = "$apiRoot/app/Http/Controllers/Api/SuperAdminTestModeController.php";
$testMode = is_file($testModePath)
    ? (string) file_get_contents($testModePath)
    : '';

out(
    str_contains($testMode, 'Super Administrator access is required for Test Mode.')
    && str_contains($testMode, "membership_status_mutated' => false")
    && str_contains($testMode, "partner_tenant_bypass' => false")
        ? 'PASS' : 'FAIL',
    'Super Administrator Test Mode security boundary'
);

$memberGatePath = "$apiRoot/app/Http/Middleware/EnsureApprovedNurseLinkMember.php";
$memberGate = is_file($memberGatePath)
    ? (string) file_get_contents($memberGatePath)
    : '';

out(
    str_contains($memberGate, 'superAdminTestModeActive')
    && str_contains($memberGate, 'X-NurseLink-Test-Mode')
    && str_contains($memberGate, 'nurselink_admin_expires_at')
        ? 'PASS' : 'FAIL',
    'Super Administrator temporary member-gate bypass'
);


$lifecyclePath = "$apiRoot/app/Http/Controllers/Api/AdminMembershipLifecycleController.php";
$lifecycle = is_file($lifecyclePath)
    ? (string) file_get_contents($lifecyclePath)
    : '';

out(
    str_contains($lifecycle, "'active' => ['suspended', 'inactive']")
    && str_contains($lifecycle, "'suspended' => ['active', 'inactive']")
    && str_contains($lifecycle, "'inactive' => ['active']")
        ? 'PASS' : 'FAIL',
    'Membership standing transition governance'
);

out(
    str_contains($lifecycle, 'standing_self_action_super_admin')
    && str_contains($lifecycle, 'Administrator access is required to manage membership standing.')
        ? 'PASS' : 'FAIL',
    'Membership lifecycle authorization + audit'
);

out(
    str_contains($memberGate, 'Active NurseLink membership standing is required')
        ? 'PASS' : 'FAIL',
    'Active-standing member-only enforcement'
);


$credentialRenewalPath = "$apiRoot/app/Http/Controllers/Api/CredentialRenewalController.php";
$credentialRenewal = is_file($credentialRenewalPath)
    ? (string) file_get_contents($credentialRenewalPath)
    : '';

out(
    str_contains($credentialRenewal, 'critical_30')
    && str_contains($credentialRenewal, 'due_90')
    && str_contains($credentialRenewal, 'upcoming_180')
        ? 'PASS' : 'FAIL',
    'Credential renewal expiry intelligence'
);

out(
    str_contains($credentialRenewal, "credential_numbers_exposed' => false")
    && str_contains($credentialRenewal, 'Administrator access is required for credential renewal monitoring.')
        ? 'PASS' : 'FAIL',
    'Credential renewal privacy + admin authorization'
);


out(
    str_contains($credentialRenewal, 'credential_renewal.started')
    && str_contains($credentialRenewal, 'credential_renewal.updated')
    && str_contains($credentialRenewal, 'credential_renewal.admin_status_changed')
        ? 'PASS' : 'FAIL',
    'Credential renewal workflow audit'
);

out(
    str_contains($credentialRenewal, 'official_renewal_certification')
    && str_contains($credentialRenewal, 'does not certify renewal by the issuing body')
        ? 'PASS' : 'FAIL',
    'Credential renewal governance disclaimer'
);


$eventsPath = "$apiRoot/app/Http/Controllers/Api/EventsController.php";
$events = is_file($eventsPath)
    ? (string) file_get_contents($eventsPath)
    : '';

out(
    str_contains($events, 'Administrator access is required for event management.')
    && str_contains($events, "event.registration_status_changed")
        ? 'PASS' : 'FAIL',
    'Events administration + registration audit'
);

out(
    str_contains($events, "cpd_units_are_official' => false")
    && str_contains($events, 'waitlisted')
    && str_contains($events, 'registration_deadline')
        ? 'PASS' : 'FAIL',
    'Events registration + CPD governance'
);


$chaptersPath = "$apiRoot/app/Http/Controllers/Api/ChaptersController.php";
$chapters = is_file($chaptersPath)
    ? (string) file_get_contents($chaptersPath)
    : '';

out(
    str_contains($chapters, 'Administrator access is required for chapter management.')
    && str_contains($chapters, 'chapter.membership_status_changed')
        ? 'PASS' : 'FAIL',
    'Chapter administration + membership audit'
);

out(
    str_contains($chapters, 'Only an Active chapter membership can be marked primary.')
    && str_contains($chapters, 'member_join_enabled')
        ? 'PASS' : 'FAIL',
    'Chapter membership governance'
);

out(
    str_contains($events, 'activeChapterIds')
    && str_contains($events, 'chapter_name')
        ? 'PASS' : 'FAIL',
    'Chapter-specific Events visibility'
);


$mentoringPath = "$apiRoot/app/Http/Controllers/Api/MentoringController.php";
$mentoring = is_file($mentoringPath)
    ? (string) file_get_contents($mentoringPath)
    : '';

out(
    str_contains($mentoring, "mentor_role_is_official_credential")
    && str_contains($mentoring, "email_exposed' => false")
        ? 'PASS' : 'FAIL',
    'Mentoring privacy + governance'
);

out(
    str_contains($mentoring, 'mentoring.request_status_changed')
    && str_contains($mentoring, 'Only the requested mentor can accept or decline')
        ? 'PASS' : 'FAIL',
    'Mentoring request authorization + audit'
);


$engagementPath = "$apiRoot/app/Http/Controllers/Api/EngagementController.php";
$engagement = is_file($engagementPath)
    ? (string) file_get_contents($engagementPath)
    : '';

out(
    str_contains($engagement, 'engagement_is_professional_credential')
    && str_contains($engagement, 'recommended_actions')
        ? 'PASS' : 'FAIL',
    'Member engagement summary + governance'
);

out(
    str_contains($engagement, "aggregate_only' => true")
    && str_contains($engagement, "mentoring_messages_exposed' => false")
        ? 'PASS' : 'FAIL',
    'Engagement aggregate privacy'
);


$benefitsPath = "$apiRoot/app/Http/Controllers/Api/MemberBenefitsController.php";
$benefits = is_file($benefitsPath)
    ? (string) file_get_contents($benefitsPath)
    : '';

out(
    str_contains($benefits, 'membership_eligibility_guaranteed')
    && str_contains($benefits, 'provider_endorsement_implied')
        ? 'PASS' : 'FAIL',
    'Member benefits eligibility + endorsement governance'
);

out(
    str_contains($benefits, "uploaded_documents_exposed' => false")
    && str_contains($benefits, 'Only an Approved benefit request can be marked Fulfilled.')
        ? 'PASS' : 'FAIL',
    'Benefit Management privacy + transition governance'
);


$benefitIntelligencePath =
    "$apiRoot/app/Http/Controllers/Api/BenefitIntelligenceController.php";

$benefitIntelligence =
    is_file($benefitIntelligencePath)
        ? (string) file_get_contents($benefitIntelligencePath)
        : '';

out(
    str_contains($benefitIntelligence, 'ending_within_7_days')
    && str_contains($benefitIntelligence, 'ending_within_30_days')
    && str_contains($benefitIntelligence, 'saved_benefit_ids')
        ? 'PASS' : 'FAIL',
    'Benefit availability + saved intelligence'
);

out(
    str_contains($benefitIntelligence, "aggregate_only' => true")
    && str_contains($benefitIntelligence, "member_private_notes_exposed")
        ? 'PASS' : 'FAIL',
    'Benefit analytics aggregate privacy'
);


$benefitReminderPath =
    "$apiRoot/app/Services/BenefitReminderService.php";

$benefitReminder =
    is_file($benefitReminderPath)
        ? (string) file_get_contents($benefitReminderPath)
        : '';

out(
    str_contains($benefitReminder, 'saved_ending_30')
    && str_contains($benefitReminder, 'saved_ending_7')
    && str_contains($benefitReminder, 'skipped_duplicate')
        ? 'PASS' : 'FAIL',
    'Benefit reminder de-duplication'
);

out(
    str_contains($benefitReminder, "where(\n                    'm.standing'")
        ? 'PASS' : 'FAIL',
    'Benefit reminder Active standing gate'
);


$engagementTimelinePath =
    "$apiRoot/app/Http/Controllers/Api/EngagementTimelineController.php";

$engagementTimeline =
    is_file($engagementTimelinePath)
        ? (string) file_get_contents($engagementTimelinePath)
        : '';

out(
    str_contains($engagementTimeline, 'private_messages_exposed')
    && str_contains($engagementTimeline, 'member_notes_exposed')
    && str_contains($engagementTimeline, 'private_contact_details_exposed')
        ? 'PASS' : 'FAIL',
    'Member engagement timeline privacy'
);

out(
    str_contains($engagementTimeline, "aggregate_only' => true")
    && str_contains($engagementTimeline, "user_ids_exposed' => false")
    && str_contains($engagementTimeline, "member_names_exposed")
        ? 'PASS' : 'FAIL',
    'Engagement activity aggregate privacy'
);


$enterprisePath =
    "$apiRoot/app/Http/Controllers/Api/EnterprisePlatformController.php";

$enterprise =
    is_file($enterprisePath)
        ? (string) file_get_contents($enterprisePath)
        : '';

out(
    str_contains($enterprise, 'Only an approved NurseLink member can be assigned')
    && str_contains($enterprise, 'administrator_only_roster')
        ? 'PASS' : 'FAIL',
    'Enterprise cohort assignment governance'
);

out(
    str_contains($enterprise, "aggregate_only' => true")
    && str_contains($enterprise, "member_identity_included' => false")
    && str_contains($enterprise, "internal_notes_included' => false")
        ? 'PASS' : 'FAIL',
    'Enterprise partner aggregate privacy'
);


out(
    str_contains($enterprise, 'small_cohort_metrics_suppressed')
    && str_contains($enterprise, 'minimum_aggregate_cohort_size')
        ? 'PASS' : 'FAIL',
    'Enterprise small-cohort privacy suppression'
);

$institutionalEnterprisePath =
    "$apiRoot/app/Http/Controllers/Api/InstitutionalAnalyticsController.php";

$institutionalEnterprise =
    is_file($institutionalEnterprisePath)
        ? (string) file_get_contents($institutionalEnterprisePath)
        : '';

out(
    str_contains($institutionalEnterprise, 'enterprise_cohorts_total')
    && str_contains($institutionalEnterprise, 'enterprise_assignments_total')
        ? 'PASS' : 'FAIL',
    'Institutional enterprise aggregate analytics'
);


$enterpriseGoalsPath =
    "$apiRoot/app/Http/Controllers/Api/EnterpriseGoalsController.php";

$enterpriseGoals =
    is_file($enterpriseGoalsPath)
        ? (string) file_get_contents($enterpriseGoalsPath)
        : '';

out(
    str_contains($enterpriseGoals, 'self_reported_progress')
    && str_contains($enterpriseGoals, 'official_credential_status')
        ? 'PASS' : 'FAIL',
    'Enterprise goal progress governance'
);

out(
    str_contains($enterpriseGoals, "member_identity_included")
    && str_contains($enterpriseGoals, "small_cohort_metrics_suppressed")
    && str_contains($enterpriseGoals, "minimum_aggregate_cohort_size")
        ? 'PASS' : 'FAIL',
    'Enterprise goal partner privacy'
);


$enterpriseEnrollmentPath =
    "$apiRoot/app/Http/Controllers/Api/EnterpriseEnrollmentController.php";

$enterpriseEnrollment =
    is_file($enterpriseEnrollmentPath)
        ? (string) file_get_contents($enterpriseEnrollmentPath)
        : '';

out(
    str_contains($enterpriseEnrollment, 'Only an Approved + Active NurseLink member can be invited')
    && str_contains($enterpriseEnrollment, 'acceptance_creates_nurselink_cohort_assignment')
        ? 'PASS' : 'FAIL',
    'Enterprise invitation enrollment governance'
);

out(
    str_contains($enterpriseEnrollment, "member_identity_included")
    && str_contains($enterpriseEnrollment, "member_notes_included")
    && str_contains($enterpriseEnrollment, "small_cohort_metrics_suppressed")
    && str_contains($enterpriseEnrollment, "minimum_aggregate_cohort_size")
        ? 'PASS' : 'FAIL',
    'Enterprise enrollment partner privacy'
);


$enterpriseOutcomesPath =
    "$apiRoot/app/Http/Controllers/Api/EnterpriseOutcomesController.php";

$enterpriseOutcomes =
    is_file($enterpriseOutcomesPath)
        ? (string) file_get_contents($enterpriseOutcomesPath)
        : '';

out(
    str_contains($enterpriseOutcomes, 'nurselink_internal_outcome')
    && str_contains($enterpriseOutcomes, 'official_certificate')
    && str_contains($enterpriseOutcomes, 'employment_determination')
        ? 'PASS' : 'FAIL',
    'Enterprise outcome governance'
);

out(
    str_contains($enterpriseOutcomes, "member_identity_included")
    && str_contains($enterpriseOutcomes, "internal_notes_included")
    && str_contains($enterpriseOutcomes, "small_cohort_metrics_suppressed")
    && str_contains($enterpriseOutcomes, "minimum_aggregate_cohort_size")
        ? 'PASS' : 'FAIL',
    'Enterprise outcome partner privacy'
);


$enterpriseSupportPath =
    "$apiRoot/app/Http/Controllers/Api/EnterpriseSupportController.php";

$enterpriseSupport =
    is_file($enterpriseSupportPath)
        ? (string) file_get_contents($enterpriseSupportPath)
        : '';

out(
    str_contains($enterpriseSupport, 'support_record_is_employment_action')
    && str_contains($enterpriseSupport, 'support_record_is_disciplinary_action')
    && str_contains($enterpriseSupport, 'support_record_is_clinical_record')
        ? 'PASS' : 'FAIL',
    'Enterprise support governance'
);

out(
    str_contains($enterpriseSupport, "member_identity_included")
    && str_contains($enterpriseSupport, "member_notes_included")
    && str_contains($enterpriseSupport, "administrator_notes_included")
    && str_contains($enterpriseSupport, "small_cohort_metrics_suppressed")
    && str_contains($enterpriseSupport, "minimum_aggregate_cohort_size")
        ? 'PASS' : 'FAIL',
    'Enterprise support partner privacy'
);

$routePath = "$apiRoot/routes/api.php";
$routes = is_file($routePath) ? (string) file_get_contents($routePath) : '';

out(
    str_contains($routes, 'EnsureApprovedNurseLinkMember::class') ? 'PASS' : 'FAIL',
    'Approved-member server boundary'
);

if (preg_match(
    '#/\* NURSELINK_CREDENTIAL_REGISTRY_V160_START \*/(.*?)/\* NURSELINK_CREDENTIAL_REGISTRY_V160_END \*/#s',
    $routes,
    $m
)) {
    $block = $m[1];
    out(
        !str_contains($block, 'EnsureApprovedNurseLinkMember')
        && str_contains($block, 'auth:sanctum')
        && str_contains($block, 'verified')
        && str_contains($block, 'active.user')
            ? 'PASS' : 'FAIL',
        'Applicant Credential Registry boundary'
    );
} else {
    out('FAIL', 'Applicant Credential Registry boundary', 'route block missing');
}

$autoload = "$apiRoot/vendor/autoload.php";
$bootstrap = "$apiRoot/bootstrap/app.php";

if (is_file($autoload) && is_file($bootstrap)) {
    try {
        require $autoload;
        $app = require $bootstrap;
        $kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
        $kernel->bootstrap();

        $started = microtime(true);
        Illuminate\Support\Facades\DB::select('select 1');
        $latency = round((microtime(true) - $started) * 1000, 2);
        out('PASS', 'Database connection', "$latency ms");

        foreach ([
            'users',
            'nurselink_credentials_registry',
            'nurselink_credential_renewals',
            'nurselink_events',
            'nurselink_event_registrations',
            'nurselink_chapters',
            'nurselink_chapter_memberships',
            'nurselink_mentoring_profiles',
            'nurselink_mentoring_requests',
            'nurselink_member_benefits',
            'nurselink_benefit_requests',
            'nurselink_saved_benefits',
            'nurselink_benefit_reminder_log',
            'nurselink_enterprise_cohorts',
            'nurselink_enterprise_cohort_members',
            'nurselink_enterprise_cohort_goals',
            'nurselink_enterprise_cohort_progress',
            'nurselink_enterprise_cohort_invitations',
            'nurselink_enterprise_cohort_outcomes',
            'nurselink_enterprise_support_checkins',
            'nurselink_memberships',
            'nurselink_membership_onboarding',
            'nurselink_support_cases',
            'nurselink_reviewer_access',
            'nurselink_job_opportunities',
            'nurselink_job_applications',
            'nurselink_partner_organizations',
            'nurselink_application_messages',
            'nurselink_interviews',
            'nurselink_operations_snapshots',
            'nurselink_operations_incidents',
            'nurselink_deployments',
            'nurselink_career_intelligence_snapshots',
            'nurselink_super_admin_access',
        ] as $table) {
            out(
                Illuminate\Support\Facades\Schema::hasTable($table) ? 'PASS' : 'FAIL',
                "Database table: $table"
            );
        }

        foreach ([
            'standing',
            'standing_reason',
            'standing_changed_by',
            'standing_changed_at',
            'suspended_at',
            'inactive_at',
            'reactivated_at',
            'assigned_reviewer_user_id',
            'review_priority',
            'review_due_at',
            'review_started_at',
            'last_admin_action_at',
        ] as $column) {
            out(
                Illuminate\Support\Facades\Schema::hasColumn(
                    'nurselink_memberships',
                    $column
                ) ? 'PASS' : 'FAIL',
                "Membership administration/lifecycle column: $column"
            );
        }
    } catch (Throwable $e) {
        out('FAIL', 'Laravel/Database boot', get_class($e) . ' (message suppressed)');
    }
} else {
    out('WARN', 'Laravel/Database boot', 'vendor/bootstrap unavailable');
}


$membershipAdministrationPath =
    "$apiRoot/app/Http/Controllers/Api/MembershipAdministrationController.php";

$membershipAdministration =
    is_file($membershipAdministrationPath)
        ? (string) file_get_contents($membershipAdministrationPath)
        : '';

out(
    str_contains($membershipAdministration, 'separate_admin_sign_in_required')
    && str_contains($membershipAdministration, 'can_final_decide')
    && str_contains($membershipAdministration, 'can_assign_reviews')
        ? 'PASS' : 'FAIL',
    'Membership administration governance'
);

out(
    str_contains($membershipAdministration, 'role_assignment_requires_super_admin')
    && str_contains($membershipAdministration, 'last_super_admin_protected')
        ? 'PASS' : 'FAIL',
    'Membership admin role protection'
);

$membershipReviewControllerPath =
    "$apiRoot/app/Http/Controllers/Api/AdminMembershipCommandController.php";

$membershipReviewController =
    is_file($membershipReviewControllerPath)
        ? (string) file_get_contents($membershipReviewControllerPath)
        : '';

out(
    str_contains(
        $membershipReviewController,
        'Administrator access is required for final membership decisions'
    )
    && str_contains(
        $membershipReviewController,
        'Membership must be Ready for Approval before final approval'
    )
        ? 'PASS' : 'FAIL',
    'Membership final-decision gates'
);


$membershipOnboardingPath =
    "$apiRoot/app/Http/Controllers/Api/MembershipOnboardingController.php";

$membershipOnboarding =
    is_file($membershipOnboardingPath)
        ? (string) file_get_contents($membershipOnboardingPath)
        : '';

out(
    str_contains($membershipOnboarding, 'administrator_note_included')
    && str_contains($membershipOnboarding, 'onboarding_completion_is_official_credential')
    && str_contains($membershipOnboarding, 'onboarding_completion_is_licensure')
        ? 'PASS' : 'FAIL',
    'Membership onboarding governance'
);

$membershipCommandPath =
    "$apiRoot/app/Http/Controllers/Api/AdminMembershipCommandController.php";

$membershipCommand =
    is_file($membershipCommandPath)
        ? (string) file_get_contents($membershipCommandPath)
        : '';

out(
    str_contains($membershipCommand, 'nurselink_membership_onboarding')
    && str_contains($membershipCommand, '/nurselink-membership-welcome.html')
        ? 'PASS' : 'FAIL',
    'Membership approval onboarding bridge'
);


$portalConfigPath =
    "$liveRoot/nurselink-portal-config.js";

$portalDashboardPath =
    "$liveRoot/nurselink-admin-dashboard.js";

$portalDashboardHtmlPath =
    "$liveRoot/nurselink-admin-dashboard.html";

$portalConfig =
    is_file($portalConfigPath)
        ? (string) file_get_contents($portalConfigPath)
        : '';

$portalDashboard =
    is_file($portalDashboardPath)
        ? (string) file_get_contents($portalDashboardPath)
        : '';

$portalDashboardHtml =
    is_file($portalDashboardHtmlPath)
        ? (string) file_get_contents($portalDashboardHtmlPath)
        : '';

out(
    str_contains($portalConfig, "memberLogin: '/login'")
    && str_contains($portalConfig, "memberPortal: '/dashboard'")
    && str_contains($portalConfig, "adminLogin: '/nurselink-admin-login.html'")
    && str_contains($portalConfig, "adminPortal: '/nurselink-admin-dashboard.html'")
        ? 'PASS' : 'FAIL',
    'Two-portal consolidation entry points'
);

out(
    str_contains($portalDashboard, '/api/nurselink/admin/membership-administration/queue')
    && str_contains($portalDashboard, '/api/nurselink/admin/membership-onboarding')
    && str_contains($portalDashboard, '/api/nurselink/admin/member-registry')
    && str_contains($portalDashboard, '/api/nurselink/admin/users/grant')
        ? 'PASS' : 'FAIL',
    'Consolidated Administrator workflows'
);

out(
    str_contains($portalDashboardHtml, 'data-panel="membership"')
    && str_contains($portalDashboardHtml, 'data-panel="onboarding"')
    && str_contains($portalDashboardHtml, 'data-panel="members"')
    && str_contains($portalDashboardHtml, 'data-panel="access"')
        ? 'PASS' : 'FAIL',
    'Consolidated Administrator portal panels'
);


$adminOperationsPath =
    "$apiRoot/app/Http/Controllers/Api/AdministrationOperationsCenterController.php";

$adminOperations =
    is_file($adminOperationsPath)
        ? (string) file_get_contents($adminOperationsPath)
        : '';

out(
    str_contains($adminOperations, 'raw_database_administration')
    && str_contains($adminOperations, 'workflow_api_required')
    && str_contains($adminOperations, 'Support Cases')
        ? 'PASS' : 'FAIL',
    'Administration operations workflow layer'
);

out(
    str_contains($adminOperations, 'message_body_excluded_from_audit')
    && str_contains($adminOperations, 'raw_before_state_included')
    && str_contains($adminOperations, 'raw_after_state_included')
        ? 'PASS' : 'FAIL',
    'Administration communications and audit privacy'
);

echo "\nSummary\n-------\n";
printf("PASS: %d\nWARN: %d\nFAIL: %d\n", $pass, $warn, $fail);

exit($fail > 0 ? 2 : ($warn > 0 ? 1 : 0));
