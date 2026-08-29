#!/usr/bin/env bash
set -Eeuo pipefail

VERSION="5.5.2"
WEB_ROOT="${WEB_ROOT:-/home/frankresma/nurselink-web}"
API_ROOT="${API_ROOT:-/home/frankresma/nurselink-api}"
LIVE_ROOT="${LIVE_ROOT:-/home/frankresma/app.amsertech.com}"
BACKUP_ROOT="${BACKUP_ROOT:-/home/frankresma/nurselink-backups}"
NPM_BIN="${NPM_BIN:-/home/frankresma/nodevenv/nurselink-web/22/bin/npm}"
PHP_BIN="${PHP_BIN:-$(command -v php || true)}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_DIR="$SCRIPT_DIR/payload"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/cumulative-v552-$STAMP"

PROFILE_MIGRATION="2026_08_12_000100_add_profile_photo_path_to_users_table.php"
EMPLOYMENT_MIGRATION="2026_08_12_001500_create_nurselink_employment_histories_table.php"
CREDENTIAL_MIGRATION="2026_08_12_002000_create_nurselink_credentials_registry_table.php"
PORTFOLIO_MIGRATION="2026_08_12_003000_create_nurselink_portfolio_items_table.php"
CAREER_MIGRATION="2026_08_12_004000_create_nurselink_career_preferences_table.php"
LEARNING_MIGRATION="2026_08_12_005000_create_nurselink_learning_records_table.php"
JOBS_MIGRATION="2026_08_12_006000_create_nurselink_job_opportunities_table.php"
SAVED_JOBS_MIGRATION="2026_08_12_007000_create_nurselink_saved_jobs_table.php"
APPLICATIONS_MIGRATION="2026_08_12_008000_create_nurselink_job_applications_table.php"
REVIEWER_ACCESS_MIGRATION="2026_08_12_009000_create_nurselink_reviewer_access_table.php"
REVIEW_META_MIGRATION="2026_08_12_010000_add_review_metadata_to_nurselink_tables.php"
REVIEW_AUDIT_MIGRATION="2026_08_12_011000_create_nurselink_review_audit_table.php"
MEMBERSHIP_MIGRATION="2026_08_12_012000_create_nurselink_memberships_table.php"
NOTIFICATIONS_MIGRATION="2026_08_12_013000_create_nurselink_notifications_table.php"
PUBLIC_PROFILE_MIGRATION="2026_08_12_014000_create_nurselink_public_profiles_table.php"
PARTNER_ORGS_MIGRATION="2026_08_12_015000_create_nurselink_partner_organizations_table.php"
PARTNER_ACCESS_MIGRATION="2026_08_12_016000_create_nurselink_partner_access_table.php"
PARTNER_LINK_MIGRATION="2026_08_12_017000_add_partner_fields_to_job_workflow.php"
PARTNER_AUDIT_MIGRATION="2026_08_12_018000_create_nurselink_partner_audit_table.php"
MESSAGES_MIGRATION="2026_08_12_019000_create_nurselink_application_messages_table.php"
INTERVIEWS_MIGRATION="2026_08_12_020000_create_nurselink_interviews_table.php"
OPERATIONS_MIGRATION="2026_08_13_021000_create_nurselink_operations_tables.php"
CAREER_INTELLIGENCE_MIGRATION="2026_08_13_022000_create_nurselink_career_intelligence_snapshots_table.php"
SUPER_ADMIN_MIGRATION="2026_08_13_023000_create_nurselink_super_admin_access_table.php"
MEMBERSHIP_LIFECYCLE_MIGRATION="2026_08_13_024000_add_membership_lifecycle_fields.php"
CREDENTIAL_RENEWAL_WORKFLOW_MIGRATION="2026_08_13_025000_create_nurselink_credential_renewals_table.php"
EVENTS_MIGRATION="2026_08_13_026000_create_nurselink_events_tables.php"
CHAPTERS_MIGRATION="2026_08_13_027000_create_nurselink_chapters_and_link_events.php"
MENTORING_MIGRATION="2026_08_13_028000_create_nurselink_mentoring_tables.php"
BENEFITS_MIGRATION="2026_08_13_029000_create_nurselink_member_benefits_tables.php"
SAVED_BENEFITS_MIGRATION="2026_08_14_030000_create_nurselink_saved_benefits_table.php"
BENEFIT_REMINDER_MIGRATION="2026_08_14_031000_create_nurselink_benefit_reminder_log.php"
ENTERPRISE_MIGRATION="2026_08_14_032000_create_nurselink_enterprise_cohorts.php"
ENTERPRISE_GOALS_MIGRATION="2026_08_14_033000_create_nurselink_enterprise_cohort_goals.php"
ENTERPRISE_INVITATIONS_MIGRATION="2026_08_14_034000_create_nurselink_enterprise_cohort_invitations.php"
ENTERPRISE_OUTCOMES_MIGRATION="2026_08_14_035000_create_nurselink_enterprise_cohort_outcomes.php"
ENTERPRISE_SUPPORT_MIGRATION="2026_08_14_036000_create_nurselink_enterprise_support_checkins.php"
MEMBERSHIP_ADMIN_MIGRATION="2026_08_14_038000_add_membership_administration_fields.php"
MEMBERSHIP_ONBOARDING_MIGRATION="2026_08_14_039000_create_nurselink_membership_onboarding.php"
SUPPORT_CASES_MIGRATION="2026_08_14_040000_create_nurselink_support_cases_table.php"
ADMIN_SAVED_VIEWS_MIGRATION="2026_08_29_045000_create_nurselink_admin_saved_views.php"

say() { printf '\n[NurseLink v%s] %s\n' "$VERSION" "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
warn() { printf '\nWARNING: %s\n' "$*" >&2; }

say "Preflight checks"

[[ -d "$WEB_ROOT/src" ]] || fail "React source not found."
[[ -f "$WEB_ROOT/package.json" ]] || fail "Web package.json missing."
[[ -d "$API_ROOT" && -f "$API_ROOT/artisan" ]] || fail "Laravel API root invalid."
[[ -f "$API_ROOT/routes/api.php" ]] || fail "routes/api.php missing."
[[ -f "$API_ROOT/routes/web.php" ]] || fail "routes/web.php missing."
[[ -f "$API_ROOT/.env" ]] || fail "Laravel .env missing."
[[ -d "$LIVE_ROOT" ]] || fail "Live web root missing."

for f in \
  "$PAYLOAD_DIR/nurselink-mobile.js" \
  "$PAYLOAD_DIR/nurselink-mobile.css" \
  "$PAYLOAD_DIR/nurselink-nurse-montage.png" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/ProfilePhotoController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/EmploymentHistoryController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/CredentialRegistryController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/PortfolioItemController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/CareerPreferenceController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/LearningRecordController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/JobOpportunityController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/SavedJobController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/JobApplicationController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/ReviewCenterController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/MembershipController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/MembershipReviewController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/NotificationController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/PublicProfileController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/SessionBootstrapController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/SessionLoginController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/PartnerPortalController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/PartnerAdminController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/ApplicationCommunicationController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/PartnerCommunicationController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/PartnerAnalyticsController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/InstitutionalAnalyticsController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/ProductionReadinessController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/OperationsCenterController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/CareerIntelligenceController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/SessionIdentityController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/AdminSessionLoginController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/AdminPortalController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/AdminMembershipCommandController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/AdminMemberRegistryController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/SuperAdminTestModeController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/AdminMembershipLifecycleController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/CredentialRenewalController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/EventsController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/ChaptersController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/MentoringController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/EngagementController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/MemberBenefitsController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/BenefitIntelligenceController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/BenefitReminderController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/EngagementTimelineController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/EnterprisePlatformController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/EnterpriseGoalsController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/EnterpriseEnrollmentController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/EnterpriseOutcomesController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/EnterpriseSupportController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/MembershipAdministrationController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/MembershipOnboardingController.php" \
  "$PAYLOAD_DIR/api/app/Http/Controllers/Api/AdministrationOperationsCenterController.php" \
  "$PAYLOAD_DIR/api/app/Services/BenefitReminderService.php" \
  "$PAYLOAD_DIR/api/app/Http/Middleware/EnsureApprovedNurseLinkMember.php" \
  "$PAYLOAD_DIR/api/database/migrations/$PROFILE_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$EMPLOYMENT_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$CREDENTIAL_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$PORTFOLIO_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$CAREER_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$LEARNING_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$JOBS_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$SAVED_JOBS_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$APPLICATIONS_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$REVIEWER_ACCESS_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$REVIEW_META_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$REVIEW_AUDIT_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$MEMBERSHIP_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$NOTIFICATIONS_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$PUBLIC_PROFILE_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$PARTNER_ORGS_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$PARTNER_ACCESS_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$PARTNER_LINK_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$PARTNER_AUDIT_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$MESSAGES_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$INTERVIEWS_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$OPERATIONS_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$CAREER_INTELLIGENCE_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$SUPER_ADMIN_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$MEMBERSHIP_LIFECYCLE_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$CREDENTIAL_RENEWAL_WORKFLOW_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$EVENTS_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$CHAPTERS_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$MENTORING_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$BENEFITS_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$SAVED_BENEFITS_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$BENEFIT_REMINDER_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$ENTERPRISE_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$ENTERPRISE_GOALS_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$ENTERPRISE_INVITATIONS_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$ENTERPRISE_OUTCOMES_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$ENTERPRISE_SUPPORT_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$MEMBERSHIP_ADMIN_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$MEMBERSHIP_ONBOARDING_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$SUPPORT_CASES_MIGRATION" \
  "$PAYLOAD_DIR/api/database/migrations/$ADMIN_SAVED_VIEWS_MIGRATION"
do
  [[ -f "$f" ]] || fail "Required payload missing: $f"
done

[[ -f "$SCRIPT_DIR/db_compat_check.php" ]] || fail "Missing db_compat_check.php."
[[ -f "$SCRIPT_DIR/post_install_cleanup.py" ]] || fail "Missing post_install_cleanup.py."
[[ -f "$SCRIPT_DIR/jobs_import.php" ]] || fail "Missing jobs_import.php."
[[ -f "$SCRIPT_DIR/JOB_IMPORT_TEMPLATE.json" ]] || fail "Missing JOB_IMPORT_TEMPLATE.json."
[[ -f "$SCRIPT_DIR/reviewer_access.php" ]] || fail "Missing reviewer_access.php."
[[ -f "$SCRIPT_DIR/partner_access.php" ]] || fail "Missing partner_access.php."
[[ -f "$PAYLOAD_DIR/nurselink-public-profile.html" ]] || fail "Missing public profile HTML."
[[ -f "$PAYLOAD_DIR/nurselink-public-profile.js" ]] || fail "Missing public profile JS."
[[ -f "$PAYLOAD_DIR/nurselink-public-profile.css" ]] || fail "Missing public profile CSS."
[[ -f "$PAYLOAD_DIR/nurselink-partner-portal.html" ]] || fail "Missing Partner Portal HTML."
[[ -f "$PAYLOAD_DIR/nurselink-partner-portal.js" ]] || fail "Missing Partner Portal JS."
[[ -f "$PAYLOAD_DIR/nurselink-partner-portal.css" ]] || fail "Missing Partner Portal CSS."
[[ -f "$PAYLOAD_DIR/nurselink-institutional-analytics.html" ]] || fail "Missing institutional analytics HTML."
[[ -f "$PAYLOAD_DIR/nurselink-institutional-analytics.js" ]] || fail "Missing institutional analytics JS."
[[ -f "$PAYLOAD_DIR/nurselink-institutional-analytics.css" ]] || fail "Missing institutional analytics CSS."
[[ -f "$PAYLOAD_DIR/nurselink-qrcode.min.js" ]] || fail "Missing local QR library."
[[ -f "$PAYLOAD_DIR/nurselink-member-verify.html" ]] || fail "Missing member verification HTML."
[[ -f "$PAYLOAD_DIR/nurselink-member-verify.js" ]] || fail "Missing member verification JS."
[[ -f "$PAYLOAD_DIR/nurselink-member-verify.css" ]] || fail "Missing member verification CSS."
[[ -f "$PAYLOAD_DIR/nurselink-production-readiness.html" ]] || fail "Missing production readiness HTML."
[[ -f "$PAYLOAD_DIR/nurselink-production-readiness.js" ]] || fail "Missing production readiness JS."
[[ -f "$PAYLOAD_DIR/nurselink-production-readiness.css" ]] || fail "Missing production readiness CSS."
[[ -f "$PAYLOAD_DIR/nurselink-operations-center.html" ]] || fail "Missing Operations Center HTML."
[[ -f "$PAYLOAD_DIR/nurselink-operations-center.js" ]] || fail "Missing Operations Center JS."
[[ -f "$PAYLOAD_DIR/nurselink-operations-center.css" ]] || fail "Missing Operations Center CSS."
[[ -f "$PAYLOAD_DIR/nurselink-admin-identity.js" ]] || fail "Missing standalone Super Administrator identity JS."
[[ -f "$PAYLOAD_DIR/nurselink-admin-identity.css" ]] || fail "Missing standalone Super Administrator identity CSS."
[[ -f "$PAYLOAD_DIR/nurselink-career-intelligence.html" ]] || fail "Missing Career Intelligence HTML."
[[ -f "$PAYLOAD_DIR/nurselink-career-intelligence.js" ]] || fail "Missing Career Intelligence JS."
[[ -f "$PAYLOAD_DIR/nurselink-career-intelligence.css" ]] || fail "Missing Career Intelligence CSS."
[[ -f "$PAYLOAD_DIR/nurselink-admin-login.html" ]] || fail "Missing Administrator Login HTML."
[[ -f "$PAYLOAD_DIR/nurselink-admin-login.js" ]] || fail "Missing Administrator Login JS."
[[ -f "$PAYLOAD_DIR/nurselink-admin-dashboard.html" ]] || fail "Missing Administrator Dashboard HTML."
[[ -f "$PAYLOAD_DIR/nurselink-admin-dashboard.js" ]] || fail "Missing Administrator Dashboard JS."
[[ -f "$PAYLOAD_DIR/nurselink-admin-portal.css" ]] || fail "Missing Administrator Portal CSS."
[[ -f "$PAYLOAD_DIR/nurselink-portal-config.js" ]] || fail "Missing centralized Portal Configuration."
[[ -f "$PAYLOAD_DIR/nurselink-admin-consolidated.css" ]] || fail "Missing consolidated Administrator Portal CSS."
[[ -f "$PAYLOAD_DIR/nurselink-admin-spa-rescue.js" ]] || fail "Missing Administrator SPA rescue module."
[[ -f "$PAYLOAD_DIR/nurselink-admin-index-bootstrap-v533.html" ]] || fail "Missing pre-React Administrator index bootstrap snippet."

ADMIN_PHYSICAL_FILES=(
  index.html
  login.html
  dashboard.js
  login.js
  portal-config.js
  admin-portal.css
  admin-consolidated.css
  .htaccess
)

for name in "${ADMIN_PHYSICAL_FILES[@]}"; do
  [[ -f "$PAYLOAD_DIR/admin/$name" ]] \
    || fail "Missing physical Administrator portal payload: admin/$name"
done

printf 'Physical Administrator directory payload [OK]\n'


[[ -f "$PAYLOAD_DIR/nurselink-notifications.html" ]] || fail "Missing Notification Center HTML."
[[ -f "$PAYLOAD_DIR/nurselink-notifications.js" ]] || fail "Missing Notification Center JS."
[[ -f "$PAYLOAD_DIR/nurselink-notifications.css" ]] || fail "Missing Notification Center CSS."
[[ -f "$PAYLOAD_DIR/nurselink-membership-command-center.html" ]] || fail "Missing Membership Command Center HTML."
[[ -f "$PAYLOAD_DIR/nurselink-membership-command-center.js" ]] || fail "Missing Membership Command Center JS."
[[ -f "$PAYLOAD_DIR/nurselink-membership-command-center.css" ]] || fail "Missing Membership Command Center CSS."
[[ -f "$PAYLOAD_DIR/nurselink-member-registry.html" ]] || fail "Missing Member Registry HTML."
[[ -f "$PAYLOAD_DIR/nurselink-member-registry.js" ]] || fail "Missing Member Registry JS."
[[ -f "$PAYLOAD_DIR/nurselink-member-registry.css" ]] || fail "Missing Member Registry CSS."
[[ -f "$PAYLOAD_DIR/nurselink-super-admin-test-center.html" ]] || fail "Missing Super Administrator Test Center HTML."
[[ -f "$PAYLOAD_DIR/nurselink-super-admin-test-center.js" ]] || fail "Missing Super Administrator Test Center JS."
[[ -f "$PAYLOAD_DIR/nurselink-super-admin-test-center.css" ]] || fail "Missing Super Administrator Test Center CSS."
[[ -f "$PAYLOAD_DIR/nurselink-credential-renewal.html" ]] || fail "Missing Credential Renewal Center HTML."
[[ -f "$PAYLOAD_DIR/nurselink-credential-renewal.js" ]] || fail "Missing Credential Renewal Center JS."
[[ -f "$PAYLOAD_DIR/nurselink-credential-renewal.css" ]] || fail "Missing Credential Renewal Center CSS."
[[ -f "$PAYLOAD_DIR/nurselink-credential-compliance.html" ]] || fail "Missing Credential Compliance Center HTML."
[[ -f "$PAYLOAD_DIR/nurselink-credential-compliance.js" ]] || fail "Missing Credential Compliance Center JS."
[[ -f "$PAYLOAD_DIR/nurselink-credential-compliance.css" ]] || fail "Missing Credential Compliance Center CSS."
[[ -f "$PAYLOAD_DIR/nurselink-events.html" ]] || fail "Missing Events & Programs HTML."
[[ -f "$PAYLOAD_DIR/nurselink-events.js" ]] || fail "Missing Events & Programs JS."
[[ -f "$PAYLOAD_DIR/nurselink-events.css" ]] || fail "Missing Events & Programs CSS."
[[ -f "$PAYLOAD_DIR/nurselink-event-management.html" ]] || fail "Missing Event Management HTML."
[[ -f "$PAYLOAD_DIR/nurselink-event-management.js" ]] || fail "Missing Event Management JS."
[[ -f "$PAYLOAD_DIR/nurselink-event-management.css" ]] || fail "Missing Event Management CSS."
[[ -f "$PAYLOAD_DIR/nurselink-chapters.html" ]] || fail "Missing Chapters & Communities HTML."
[[ -f "$PAYLOAD_DIR/nurselink-chapters.js" ]] || fail "Missing Chapters & Communities JS."
[[ -f "$PAYLOAD_DIR/nurselink-chapters.css" ]] || fail "Missing Chapters & Communities CSS."
[[ -f "$PAYLOAD_DIR/nurselink-chapter-management.html" ]] || fail "Missing Chapter Management HTML."
[[ -f "$PAYLOAD_DIR/nurselink-chapter-management.js" ]] || fail "Missing Chapter Management JS."
[[ -f "$PAYLOAD_DIR/nurselink-chapter-management.css" ]] || fail "Missing Chapter Management CSS."
[[ -f "$PAYLOAD_DIR/nurselink-mentoring.html" ]] || fail "Missing Mentoring & Peer Support HTML."
[[ -f "$PAYLOAD_DIR/nurselink-mentoring.js" ]] || fail "Missing Mentoring & Peer Support JS."
[[ -f "$PAYLOAD_DIR/nurselink-mentoring.css" ]] || fail "Missing Mentoring & Peer Support CSS."
[[ -f "$PAYLOAD_DIR/nurselink-engagement.html" ]] || fail "Missing Member Engagement Hub HTML."
[[ -f "$PAYLOAD_DIR/nurselink-engagement.js" ]] || fail "Missing Member Engagement Hub JS."
[[ -f "$PAYLOAD_DIR/nurselink-engagement.css" ]] || fail "Missing Member Engagement Hub CSS."
[[ -f "$PAYLOAD_DIR/nurselink-engagement-command-center.html" ]] || fail "Missing Engagement Command Center HTML."
[[ -f "$PAYLOAD_DIR/nurselink-engagement-command-center.js" ]] || fail "Missing Engagement Command Center JS."
[[ -f "$PAYLOAD_DIR/nurselink-engagement-command-center.css" ]] || fail "Missing Engagement Command Center CSS."
[[ -f "$PAYLOAD_DIR/nurselink-benefits.html" ]] || fail "Missing Member Benefits & Resources HTML."
[[ -f "$PAYLOAD_DIR/nurselink-benefits.js" ]] || fail "Missing Member Benefits & Resources JS."
[[ -f "$PAYLOAD_DIR/nurselink-benefits.css" ]] || fail "Missing Member Benefits & Resources CSS."
[[ -f "$PAYLOAD_DIR/nurselink-benefit-management.html" ]] || fail "Missing Benefit Management HTML."
[[ -f "$PAYLOAD_DIR/nurselink-benefit-management.js" ]] || fail "Missing Benefit Management JS."
[[ -f "$PAYLOAD_DIR/nurselink-benefit-management.css" ]] || fail "Missing Benefit Management CSS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise.html" ]] || fail "Missing Member Enterprise HTML."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise.js" ]] || fail "Missing Member Enterprise JS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise.css" ]] || fail "Missing Member Enterprise CSS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-command-center.html" ]] || fail "Missing Enterprise Command Center HTML."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-command-center.js" ]] || fail "Missing Enterprise Command Center JS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-command-center.css" ]] || fail "Missing Enterprise Command Center CSS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-partner.html" ]] || fail "Missing Partner Enterprise Analytics HTML."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-partner.js" ]] || fail "Missing Partner Enterprise Analytics JS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-partner.css" ]] || fail "Missing Partner Enterprise Analytics CSS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-goals.html" ]] || fail "Missing Member Enterprise Goals HTML."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-goals.js" ]] || fail "Missing Member Enterprise Goals JS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-goals.css" ]] || fail "Missing Member Enterprise Goals CSS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-goals-admin.html" ]] || fail "Missing Enterprise Goal Management HTML."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-goals-admin.js" ]] || fail "Missing Enterprise Goal Management JS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-goals-admin.css" ]] || fail "Missing Enterprise Goal Management CSS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-goals-partner.html" ]] || fail "Missing Partner Enterprise Goal Analytics HTML."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-goals-partner.js" ]] || fail "Missing Partner Enterprise Goal Analytics JS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-goals-partner.css" ]] || fail "Missing Partner Enterprise Goal Analytics CSS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-invitations.html" ]] || fail "Missing Enterprise Invitations HTML."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-invitations.js" ]] || fail "Missing Enterprise Invitations JS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-invitations.css" ]] || fail "Missing Enterprise Invitations CSS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-enrollment-admin.html" ]] || fail "Missing Enterprise Enrollment Admin HTML."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-enrollment-admin.js" ]] || fail "Missing Enterprise Enrollment Admin JS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-enrollment-admin.css" ]] || fail "Missing Enterprise Enrollment Admin CSS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-enrollment-partner.html" ]] || fail "Missing Enterprise Enrollment Partner HTML."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-enrollment-partner.js" ]] || fail "Missing Enterprise Enrollment Partner JS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-enrollment-partner.css" ]] || fail "Missing Enterprise Enrollment Partner CSS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes.html" ]] || fail "Missing Enterprise Outcomes HTML."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes.js" ]] || fail "Missing Enterprise Outcomes JS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes.css" ]] || fail "Missing Enterprise Outcomes CSS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes-admin.html" ]] || fail "Missing Enterprise Outcomes Admin HTML."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes-admin.js" ]] || fail "Missing Enterprise Outcomes Admin JS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes-admin.css" ]] || fail "Missing Enterprise Outcomes Admin CSS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes-partner.html" ]] || fail "Missing Enterprise Outcomes Partner HTML."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes-partner.js" ]] || fail "Missing Enterprise Outcomes Partner JS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes-partner.css" ]] || fail "Missing Enterprise Outcomes Partner CSS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-support.html" ]] || fail "Missing Enterprise Support HTML."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-support.js" ]] || fail "Missing Enterprise Support JS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-support.css" ]] || fail "Missing Enterprise Support CSS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-support-admin.html" ]] || fail "Missing Enterprise Support Admin HTML."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-support-admin.js" ]] || fail "Missing Enterprise Support Admin JS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-support-admin.css" ]] || fail "Missing Enterprise Support Admin CSS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-support-partner.html" ]] || fail "Missing Enterprise Support Partner HTML."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-support-partner.js" ]] || fail "Missing Enterprise Support Partner JS."
[[ -f "$PAYLOAD_DIR/nurselink-enterprise-support-partner.css" ]] || fail "Missing Enterprise Support Partner CSS."
[[ -f "$PAYLOAD_DIR/nurselink-membership-administration.html" ]] || fail "Missing Membership Administration Suite HTML."
[[ -f "$PAYLOAD_DIR/nurselink-membership-administration.js" ]] || fail "Missing Membership Administration Suite JS."
[[ -f "$PAYLOAD_DIR/nurselink-membership-administration.css" ]] || fail "Missing Membership Administration Suite CSS."
[[ -f "$PAYLOAD_DIR/nurselink-membership-welcome.html" ]] || fail "Missing Membership Welcome Center HTML."
[[ -f "$PAYLOAD_DIR/nurselink-membership-welcome.js" ]] || fail "Missing Membership Welcome Center JS."
[[ -f "$PAYLOAD_DIR/nurselink-membership-welcome.css" ]] || fail "Missing Membership Welcome Center CSS."
[[ -f "$PAYLOAD_DIR/nurselink-membership-onboarding-admin.html" ]] || fail "Missing Membership Onboarding Admin HTML."
[[ -f "$PAYLOAD_DIR/nurselink-membership-onboarding-admin.js" ]] || fail "Missing Membership Onboarding Admin JS."
[[ -f "$PAYLOAD_DIR/nurselink-membership-onboarding-admin.css" ]] || fail "Missing Membership Onboarding Admin CSS."







[[ -f "$SCRIPT_DIR/nurselink_benefit_reminders.php" ]] || fail "Missing Benefit Reminder generator."
[[ -f "$SCRIPT_DIR/nurselink_credential_alerts.php" ]] || fail "Missing credential renewal alert utility."
[[ -f "$PAYLOAD_DIR/api/config/cors.php" ]] || fail "Missing config/cors.php payload."
[[ -f "$SCRIPT_DIR/cors_preflight_block.txt" ]] || fail "Missing CORS preflight route block."
[[ -f "$SCRIPT_DIR/cors_env_fix.php" ]] || fail "Missing CORS env helper."
[[ -f "$SCRIPT_DIR/cache_policy_v263.htaccess" ]] || fail "Missing v5.5.2 cache policy."
[[ -f "$SCRIPT_DIR/standalone_pages_v321.htaccess" ]] || fail "Missing v5.5.2 standalone-page routing policy."
[[ -f "$SCRIPT_DIR/security_headers_v330.htaccess" ]] || fail "Missing v5.5.2 security headers policy."
[[ -f "$SCRIPT_DIR/nurselink_ops_check.php" ]] || fail "Missing v5.5.2 operations utility."
[[ -f "$SCRIPT_DIR/PRODUCTION_OPERATIONS_RUNBOOK.txt" ]] || fail "Missing operations runbook."
[[ -f "$SCRIPT_DIR/UAT_SIGNOFF_CHECKLIST.txt" ]] || fail "Missing UAT sign-off checklist."
[[ -f "$SCRIPT_DIR/nurselink_backup_verify.php" ]] || fail "Missing backup verifier."
[[ -f "$SCRIPT_DIR/nurselink_smoke_test.php" ]] || fail "Missing smoke test."
[[ -f "$SCRIPT_DIR/nurselink_rc_check.php" ]] || fail "Missing production gate utility."
[[ -f "$SCRIPT_DIR/RELEASE_CANDIDATE_SIGNOFF.txt" ]] || fail "Missing RC sign-off checklist."
[[ -f "$SCRIPT_DIR/nurselink_production_gate.php" ]] || fail "Missing final production gate utility."
[[ -f "$SCRIPT_DIR/nurselink_ops_snapshot.php" ]] || fail "Missing operations snapshot utility."
[[ -f "$SCRIPT_DIR/nurselink_record_deployment.php" ]] || fail "Missing deployment recorder."
[[ -f "$SCRIPT_DIR/super_admin_access.php" ]] || fail "Missing Super Administrator access utility."
[[ -f "$SCRIPT_DIR/FINAL_PRODUCTION_SIGNOFF.txt" ]] || fail "Missing final production sign-off."
[[ -f "$SCRIPT_DIR/GO_LIVE_RUNBOOK.txt" ]] || fail "Missing go-live runbook."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/config/cors.php"
"$PHP_BIN" -l "$SCRIPT_DIR/cors_env_fix.php"
"$PHP_BIN" -l "$SCRIPT_DIR/reviewer_access.php"
"$PHP_BIN" -l "$SCRIPT_DIR/partner_access.php"
"$PHP_BIN" -l "$SCRIPT_DIR/jobs_import.php"
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Middleware/EnsureApprovedNurseLinkMember.php"
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/AdminSessionLoginController.php" >/dev/null || fail "Administrator session login controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/AdminPortalController.php" >/dev/null || fail "Administrator portal controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/AdminMembershipCommandController.php" >/dev/null || fail "Membership Command Center controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/AdminMemberRegistryController.php" >/dev/null || fail "Member Registry controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/SuperAdminTestModeController.php" >/dev/null || fail "Super Administrator Test Mode controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/AdminMembershipLifecycleController.php" >/dev/null || fail "Membership Lifecycle controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/CredentialRenewalController.php" >/dev/null || fail "Credential Renewal controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/EventsController.php" >/dev/null || fail "Events controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/ChaptersController.php" >/dev/null || fail "Chapters controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/MentoringController.php" >/dev/null || fail "Mentoring controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/EngagementController.php" >/dev/null || fail "Engagement controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/MemberBenefitsController.php" >/dev/null || fail "Member Benefits controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/BenefitIntelligenceController.php" >/dev/null || fail "Benefit Intelligence controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/BenefitReminderController.php" >/dev/null || fail "Benefit Reminder controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/EngagementTimelineController.php" >/dev/null || fail "Engagement Timeline controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/EnterprisePlatformController.php" >/dev/null || fail "Enterprise Platform controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/EnterpriseGoalsController.php" >/dev/null || fail "Enterprise Goals controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/EnterpriseEnrollmentController.php" >/dev/null || fail "Enterprise Enrollment controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/EnterpriseOutcomesController.php" >/dev/null || fail "Enterprise Outcomes controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/EnterpriseSupportController.php" >/dev/null || fail "Enterprise Support controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/MembershipAdministrationController.php" >/dev/null || fail "Membership Administration controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/MembershipOnboardingController.php" >/dev/null || fail "Membership Onboarding controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Http/Controllers/Api/AdministrationOperationsCenterController.php" >/dev/null || fail "Administration Operations Center controller has invalid PHP syntax."
"$PHP_BIN" -l "$PAYLOAD_DIR/api/app/Services/BenefitReminderService.php" >/dev/null || fail "Benefit Reminder service has invalid PHP syntax."
"$PHP_BIN" -l "$SCRIPT_DIR/nurselink_benefit_reminders.php" >/dev/null || fail "Benefit Reminder generator has invalid PHP syntax."
"$PHP_BIN" -l "$SCRIPT_DIR/nurselink_credential_alerts.php" >/dev/null || fail "Credential renewal alert utility has invalid PHP syntax."

"$PHP_BIN" -l "$SCRIPT_DIR/db_compat_check.php"

if [[ ! -x "$NPM_BIN" ]]; then
  NPM_BIN="$(command -v npm || true)"
fi

[[ -n "${NPM_BIN:-}" && -x "$NPM_BIN" ]] || fail "npm not found."
[[ -n "${PHP_BIN:-}" && -x "$PHP_BIN" ]] || fail "php not found."
"$PHP_BIN" -l "$SCRIPT_DIR/nurselink_ops_check.php" >/dev/null || fail "Operations check utility has invalid PHP syntax."
"$PHP_BIN" -l "$SCRIPT_DIR/nurselink_backup_verify.php" >/dev/null || fail "Backup verifier has invalid PHP syntax."
"$PHP_BIN" -l "$SCRIPT_DIR/nurselink_smoke_test.php" >/dev/null || fail "Smoke test has invalid PHP syntax."
"$PHP_BIN" -l "$SCRIPT_DIR/nurselink_rc_check.php" >/dev/null || fail "RC gate has invalid PHP syntax."
"$PHP_BIN" -l "$SCRIPT_DIR/nurselink_production_gate.php" >/dev/null || fail "Production gate has invalid PHP syntax."
"$PHP_BIN" -l "$SCRIPT_DIR/nurselink_ops_snapshot.php" >/dev/null || fail "Operations snapshot utility has invalid PHP syntax."
"$PHP_BIN" -l "$SCRIPT_DIR/nurselink_record_deployment.php" >/dev/null || fail "Deployment recorder has invalid PHP syntax."
"$PHP_BIN" -l "$SCRIPT_DIR/super_admin_access.php" >/dev/null || fail "Super Administrator access utility has invalid PHP syntax."

ENTRY_FILE=""
for candidate in \
  "$WEB_ROOT/src/main.jsx" \
  "$WEB_ROOT/src/main.tsx" \
  "$WEB_ROOT/src/main.js" \
  "$WEB_ROOT/src/main.ts"
do
  if [[ -f "$candidate" ]]; then
    ENTRY_FILE="$candidate"
    break
  fi
done

if [[ -z "$ENTRY_FILE" ]]; then
  ENTRY_FILE="$(grep -RIl --include='*.jsx' --include='*.tsx' --include='*.js' --include='*.ts' \
    -E 'createRoot\(|ReactDOM\.createRoot' "$WEB_ROOT/src" 2>/dev/null | head -n1 || true)"
fi

[[ -n "$ENTRY_FILE" ]] || fail "React entry file not found."

command -v python3 >/dev/null 2>&1 \
  || fail "python3 is required for NurseLink installer cleanup."

python3 -m py_compile "$SCRIPT_DIR/post_install_cleanup.py" \
  || fail "Installer cleanup helper is incompatible with this server Python runtime."

python3 - "$SCRIPT_DIR/post_install_cleanup.py" <<'PYPYCOMPAT481'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

if sys.version_info < (3, 6):
    raise SystemExit(
        "NurseLink installer requires Python 3.6 or newer for cleanup."
    )

for forbidden in (
    "from __future__ import annotations",
    "tuple[list[",
    "list[Path]",
):
    if forbidden in text:
        raise SystemExit(
            "Unsupported server-Python syntax remains in cleanup helper: "
            + forbidden
        )

print(
    "Server Python cleanup compatibility [OK] "
    + str(sys.version_info[0])
    + "."
    + str(sys.version_info[1])
)
PYPYCOMPAT481

python3 - "$SCRIPT_DIR/install.sh" "$SCRIPT_DIR/post_install_cleanup.py" <<'PYPRE473'
from pathlib import Path
import sys

installer = Path(sys.argv[1]).read_text(encoding="utf-8")
cleanup = Path(sys.argv[2]).read_text(encoding="utf-8")

for item in (
    'say "Self-healing old installer cleanup"',
    '"preinstall"',
    'say "Creating cumulative rollback backup"',
    'say "Final post-install installer cleanup"',
    '"final"',
    'Independent installer cleanup verification [OK]',
    'say "SUCCESS"',
):
    if item not in installer:
        raise SystemExit(
            "Two-stage cleanup requirement missing: " + item
        )

for item in (
    'HOME_ROOT = Path("/home/frankresma").resolve()',
    'shutil.rmtree(folder)',
    'archive.unlink()',
    'remaining_folders, remaining_zips = candidates()',
):
    if item not in cleanup:
        raise SystemExit(
            "Cleanup implementation requirement missing: " + item
        )

pre = installer.find('say "Self-healing old installer cleanup"')
backup = installer.find('say "Creating cumulative rollback backup"')
final = installer.rfind('say "Final post-install installer cleanup"')
success = installer.rfind('say "SUCCESS"')

if not (0 <= pre < backup < final < success):
    raise SystemExit(
        "Cleanup/install/SUCCESS ordering is invalid."
    )

print("Two-stage installer cleanup regression guard [OK]")
PYPRE473

say "Self-healing old installer cleanup"

python3 "$SCRIPT_DIR/post_install_cleanup.py" "$SCRIPT_DIR" "preinstall" \
  || fail "Pre-install installer cleanup failed."

pre_remaining_folders="$(
  find /home/frankresma \
    -mindepth 1 -maxdepth 1 -type d \
    \( -name 'NurseLink_Mobile_Responsive_Installer_v*' \
       -o -name 'NurseLink_Global_Mobile_Responsive_Installer_v*' \) \
    ! -path "$SCRIPT_DIR" -print
)"

pre_remaining_zips="$(
  find /home/frankresma \
    -mindepth 1 -maxdepth 1 -type f \
    \( -name 'NurseLink_Mobile_Responsive_Installer_v*.zip' \
       -o -name 'NurseLink_Global_Mobile_Responsive_Installer_v*.zip' \) \
    ! -path "/home/frankresma/$(basename "$SCRIPT_DIR").zip" -print
)"

[[ -z "$pre_remaining_folders" ]] \
  || fail "Pre-install cleanup verification found old installer folders: $pre_remaining_folders"

[[ -z "$pre_remaining_zips" ]] \
  || fail "Pre-install cleanup verification found old installer ZIPs: $pre_remaining_zips"

printf 'Pre-install installer cleanup verification [OK]\n'

say "Creating cumulative rollback backup"

mkdir -p "$BACKUP_DIR/source" "$BACKUP_DIR/live" "$BACKUP_DIR/api"

cp -a "$ENTRY_FILE" "$BACKUP_DIR/source/$(basename "$ENTRY_FILE")"
[[ -f "$WEB_ROOT/src/nurselink-mobile.js" ]] && cp -a "$WEB_ROOT/src/nurselink-mobile.js" "$BACKUP_DIR/source/nurselink-mobile.js.previous"
[[ -f "$WEB_ROOT/src/nurselink-mobile.css" ]] && cp -a "$WEB_ROOT/src/nurselink-mobile.css" "$BACKUP_DIR/source/nurselink-mobile.css.previous"
if [[ -f "$WEB_ROOT/index.html" ]]; then
  cp -a "$WEB_ROOT/index.html" "$BACKUP_DIR/source/index.html.previous"
  touch "$BACKUP_DIR/source/index.html.existed"
fi

if [[ -d "$WEB_ROOT/public/admin" ]]; then
  mkdir -p "$BACKUP_DIR/source/public-admin.previous"
  cp -a "$WEB_ROOT/public/admin/." \
    "$BACKUP_DIR/source/public-admin.previous/"
  touch "$BACKUP_DIR/source/public-admin.existed"
fi

if [[ -f "$WEB_ROOT/src/nurselink-admin-spa-rescue.js" ]]; then
  cp -a "$WEB_ROOT/src/nurselink-admin-spa-rescue.js" \
    "$BACKUP_DIR/source/nurselink-admin-spa-rescue.js.previous"
  touch "$BACKUP_DIR/source/nurselink-admin-spa-rescue.js.existed"
fi

[[ -f "$WEB_ROOT/public/nurselink-nurse-montage.png" ]] && cp -a "$WEB_ROOT/public/nurselink-nurse-montage.png" "$BACKUP_DIR/source/nurselink-nurse-montage.png.previous"

V501_PUBLIC_FILES=(
  nurselink-enterprise.html
  nurselink-enterprise.css
  nurselink-enterprise-command-center.html
  nurselink-enterprise-partner.html
  nurselink-admin-dashboard.html
  nurselink-admin-dashboard.js
  nurselink-admin-consolidated.css
  nurselink-portal-config.js
  nurselink-admin-login.html
  nurselink-admin-login.js
  nurselink-super-admin-test-center.js
  nurselink-enterprise-goals.html
  nurselink-enterprise-goals.js
  nurselink-enterprise-goals.css
  nurselink-enterprise-goals-admin.html
  nurselink-enterprise-goals-admin.js
  nurselink-enterprise-goals-admin.css
  nurselink-enterprise-goals-partner.html
  nurselink-enterprise-goals-partner.js
  nurselink-enterprise-goals-partner.css
  nurselink-enterprise-invitations.html
  nurselink-enterprise-invitations.js
  nurselink-enterprise-invitations.css
  nurselink-enterprise-enrollment-admin.html
  nurselink-enterprise-enrollment-admin.js
  nurselink-enterprise-enrollment-admin.css
  nurselink-enterprise-enrollment-partner.html
  nurselink-enterprise-enrollment-partner.js
  nurselink-enterprise-enrollment-partner.css
  nurselink-enterprise-outcomes.html
  nurselink-enterprise-outcomes.js
  nurselink-enterprise-outcomes.css
  nurselink-enterprise-outcomes-admin.html
  nurselink-enterprise-outcomes-admin.js
  nurselink-enterprise-outcomes-admin.css
  nurselink-enterprise-outcomes-partner.html
  nurselink-enterprise-outcomes-partner.js
  nurselink-enterprise-outcomes-partner.css
  nurselink-enterprise-support.html
  nurselink-enterprise-support.js
  nurselink-enterprise-support.css
  nurselink-enterprise-support-admin.html
  nurselink-enterprise-support-admin.js
  nurselink-enterprise-support-admin.css
  nurselink-enterprise-support-partner.html
  nurselink-enterprise-support-partner.js
  nurselink-enterprise-support-partner.css
  nurselink-membership-administration.html
  nurselink-membership-administration.js
  nurselink-membership-administration.css
  nurselink-membership-welcome.html
  nurselink-membership-welcome.js
  nurselink-membership-welcome.css
  nurselink-membership-onboarding-admin.html
  nurselink-membership-onboarding-admin.js
  nurselink-membership-onboarding-admin.css
)

for file in "${V501_PUBLIC_FILES[@]}"; do
  if [[ -f "$WEB_ROOT/public/$file" ]]; then
    cp -a "$WEB_ROOT/public/$file"       "$BACKUP_DIR/source/$file.previous"
    touch "$BACKUP_DIR/source/$file.existed"
  fi
done

cp -a "$LIVE_ROOT/." "$BACKUP_DIR/live/"
cp -a "$API_ROOT/routes/api.php" "$BACKUP_DIR/api/routes-api.php"
cp -a "$API_ROOT/routes/web.php" "$BACKUP_DIR/api/routes-web.php"
cp -a "$API_ROOT/.env" "$BACKUP_DIR/api/env.previous"
if [[ -f "$API_ROOT/config/cors.php" ]]; then
  cp -a "$API_ROOT/config/cors.php" "$BACKUP_DIR/api/cors.php.previous"
  touch "$BACKUP_DIR/api/cors.php.existed"
fi

CONTROLLERS=(
  ProfilePhotoController.php
  EmploymentHistoryController.php
  CredentialRegistryController.php
  PortfolioItemController.php
  CareerPreferenceController.php
  LearningRecordController.php
  JobOpportunityController.php
  SavedJobController.php
  JobApplicationController.php
  ReviewCenterController.php
  MembershipController.php
  MembershipReviewController.php
  NotificationController.php
  PublicProfileController.php
  SessionBootstrapController.php
  SessionLoginController.php
  PartnerPortalController.php
  PartnerAdminController.php
  ApplicationCommunicationController.php
  PartnerCommunicationController.php
  PartnerAnalyticsController.php
  InstitutionalAnalyticsController.php
  ProductionReadinessController.php
  OperationsCenterController.php
  CareerIntelligenceController.php
  SessionIdentityController.php
  AdminSessionLoginController.php
  AdminPortalController.php
  AdminMembershipCommandController.php
  AdminMemberRegistryController.php
  SuperAdminTestModeController.php
  AdminMembershipLifecycleController.php
  CredentialRenewalController.php
  EventsController.php
  ChaptersController.php
  MentoringController.php
  EngagementController.php
  MemberBenefitsController.php
  BenefitIntelligenceController.php
  BenefitReminderController.php
  EngagementTimelineController.php
  EnterprisePlatformController.php
  EnterpriseGoalsController.php
  EnterpriseEnrollmentController.php
  EnterpriseOutcomesController.php
  EnterpriseSupportController.php
  MembershipAdministrationController.php
  MembershipOnboardingController.php
  AdministrationOperationsCenterController.php
)

MIGRATIONS=(
  "$PROFILE_MIGRATION"
  "$EMPLOYMENT_MIGRATION"
  "$CREDENTIAL_MIGRATION"
  "$PORTFOLIO_MIGRATION"
  "$CAREER_MIGRATION"
  "$LEARNING_MIGRATION"
  "$JOBS_MIGRATION"
  "$SAVED_JOBS_MIGRATION"
  "$APPLICATIONS_MIGRATION"
  "$REVIEWER_ACCESS_MIGRATION"
  "$REVIEW_META_MIGRATION"
  "$REVIEW_AUDIT_MIGRATION"
  "$MEMBERSHIP_MIGRATION"
  "$NOTIFICATIONS_MIGRATION"
  "$PUBLIC_PROFILE_MIGRATION"
  "$PARTNER_ORGS_MIGRATION"
  "$PARTNER_ACCESS_MIGRATION"
  "$PARTNER_LINK_MIGRATION"
  "$PARTNER_AUDIT_MIGRATION"
  "$MESSAGES_MIGRATION"
  "$INTERVIEWS_MIGRATION"
  "$OPERATIONS_MIGRATION"
  "$CAREER_INTELLIGENCE_MIGRATION"
  "$SUPER_ADMIN_MIGRATION"
  "$MEMBERSHIP_LIFECYCLE_MIGRATION"
  "$CREDENTIAL_RENEWAL_WORKFLOW_MIGRATION"
  "$EVENTS_MIGRATION"
  "$CHAPTERS_MIGRATION"
  "$MENTORING_MIGRATION"
  "$BENEFITS_MIGRATION"
  "$SAVED_BENEFITS_MIGRATION"
  "$BENEFIT_REMINDER_MIGRATION"
  "$ENTERPRISE_MIGRATION"
  "$ENTERPRISE_GOALS_MIGRATION"
  "$ENTERPRISE_INVITATIONS_MIGRATION"
  "$ENTERPRISE_OUTCOMES_MIGRATION"
  "$ENTERPRISE_SUPPORT_MIGRATION"
  "$MEMBERSHIP_ADMIN_MIGRATION"
  "$MEMBERSHIP_ONBOARDING_MIGRATION"
  "$SUPPORT_CASES_MIGRATION"
  "$ADMIN_SAVED_VIEWS_MIGRATION"
)

for controller in "${CONTROLLERS[@]}"; do
  if [[ -f "$API_ROOT/app/Http/Controllers/Api/$controller" ]]; then
    cp -a "$API_ROOT/app/Http/Controllers/Api/$controller" "$BACKUP_DIR/api/$controller.previous"
    touch "$BACKUP_DIR/api/$controller.existed"
  fi
done

if [[ -f "$API_ROOT/app/Services/BenefitReminderService.php" ]]; then
  cp -a "$API_ROOT/app/Services/BenefitReminderService.php"     "$BACKUP_DIR/api/BenefitReminderService.php.previous"
  touch "$BACKUP_DIR/api/BenefitReminderService.php.existed"
fi

# v2.6.4 reset controller is obsolete. Preserve it in backup if present, then remove.
if [[ -f "$API_ROOT/app/Http/Controllers/Api/ClientSessionResetController.php" ]]; then
  if [[ ! -f "$BACKUP_DIR/api/ClientSessionResetController.php.previous" ]]; then
    cp -a "$API_ROOT/app/Http/Controllers/Api/ClientSessionResetController.php"       "$BACKUP_DIR/api/ClientSessionResetController.php.previous"
    touch "$BACKUP_DIR/api/ClientSessionResetController.php.existed"
  fi
  rm -f "$API_ROOT/app/Http/Controllers/Api/ClientSessionResetController.php"
fi

if [[ -f "$API_ROOT/app/Http/Middleware/EnsureApprovedNurseLinkMember.php" ]]; then
  cp -a "$API_ROOT/app/Http/Middleware/EnsureApprovedNurseLinkMember.php"     "$BACKUP_DIR/api/EnsureApprovedNurseLinkMember.php.previous"
  touch "$BACKUP_DIR/api/EnsureApprovedNurseLinkMember.php.existed"
fi

for migration in "${MIGRATIONS[@]}"; do
  if [[ -f "$API_ROOT/database/migrations/$migration" ]]; then
    cp -a "$API_ROOT/database/migrations/$migration" "$BACKUP_DIR/api/$migration.previous"
    touch "$BACKUP_DIR/api/$migration.file-existed"
  fi
done

cd "$API_ROOT"

record_migration_state() {
  local file="$1"
  local flag="$2"
  local key="${file%.php}"

  if "$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
      "$API_ROOT" migration-applied "$key" >/dev/null 2>&1
  then
    touch "$BACKUP_DIR/api/$flag"
  fi
}

record_migration_state "$PROFILE_MIGRATION" "profile-migration-was-applied"
record_migration_state "$EMPLOYMENT_MIGRATION" "employment-migration-was-applied"
record_migration_state "$CREDENTIAL_MIGRATION" "credential-migration-was-applied"
record_migration_state "$PORTFOLIO_MIGRATION" "portfolio-migration-was-applied"
record_migration_state "$CAREER_MIGRATION" "career-migration-was-applied"
record_migration_state "$LEARNING_MIGRATION" "learning-migration-was-applied"
record_migration_state "$JOBS_MIGRATION" "jobs-migration-was-applied"
record_migration_state "$SAVED_JOBS_MIGRATION" "saved-jobs-migration-was-applied"
record_migration_state "$APPLICATIONS_MIGRATION" "applications-migration-was-applied"
record_migration_state "$REVIEWER_ACCESS_MIGRATION" "reviewer-access-migration-was-applied"
record_migration_state "$REVIEW_META_MIGRATION" "review-meta-migration-was-applied"
record_migration_state "$REVIEW_AUDIT_MIGRATION" "review-audit-migration-was-applied"
record_migration_state "$MEMBERSHIP_MIGRATION" "membership-migration-was-applied"
record_migration_state "$NOTIFICATIONS_MIGRATION" "notifications-migration-was-applied"
record_migration_state "$PUBLIC_PROFILE_MIGRATION" "public-profile-migration-was-applied"
record_migration_state "$PARTNER_ORGS_MIGRATION" "partner-orgs-migration-was-applied"
record_migration_state "$PARTNER_ACCESS_MIGRATION" "partner-access-migration-was-applied"
record_migration_state "$PARTNER_LINK_MIGRATION" "partner-link-migration-was-applied"
record_migration_state "$PARTNER_AUDIT_MIGRATION" "partner-audit-migration-was-applied"
record_migration_state "$MESSAGES_MIGRATION" "messages-migration-was-applied"
record_migration_state "$INTERVIEWS_MIGRATION" "interviews-migration-was-applied"
record_migration_state "$OPERATIONS_MIGRATION" "operations-migration-was-applied"
record_migration_state "$CAREER_INTELLIGENCE_MIGRATION" "career-intelligence-migration-was-applied"
record_migration_state "$SUPER_ADMIN_MIGRATION" "super-admin-migration-was-applied"
record_migration_state "$MEMBERSHIP_LIFECYCLE_MIGRATION" "membership-lifecycle-migration-was-applied"
record_migration_state "$CREDENTIAL_RENEWAL_WORKFLOW_MIGRATION" "credential-renewal-workflow-migration-was-applied"
record_migration_state "$EVENTS_MIGRATION" "events-migration-was-applied"
record_migration_state "$CHAPTERS_MIGRATION" "chapters-migration-was-applied"
record_migration_state "$MENTORING_MIGRATION" "mentoring-migration-was-applied"
record_migration_state "$BENEFITS_MIGRATION" "benefits-migration-was-applied"
record_migration_state "$SAVED_BENEFITS_MIGRATION" "saved-benefits-migration-was-applied"
record_migration_state "$BENEFIT_REMINDER_MIGRATION" "benefit-reminder-migration-was-applied"
record_migration_state "$ENTERPRISE_MIGRATION" "enterprise-migration-was-applied"
record_migration_state "$ENTERPRISE_GOALS_MIGRATION" "enterprise-goals-migration-was-applied"
record_migration_state "$ENTERPRISE_INVITATIONS_MIGRATION" "enterprise-invitations-migration-was-applied"
record_migration_state "$ENTERPRISE_OUTCOMES_MIGRATION" "enterprise-outcomes-migration-was-applied"
record_migration_state "$ENTERPRISE_SUPPORT_MIGRATION" "enterprise-support-migration-was-applied"
record_migration_state "$MEMBERSHIP_ADMIN_MIGRATION" "membership-admin-migration-was-applied"
record_migration_state "$MEMBERSHIP_ONBOARDING_MIGRATION" "membership-onboarding-migration-was-applied"
record_migration_state "$SUPPORT_CASES_MIGRATION" "support-cases-migration-was-applied"

printf '%s\n' "$ENTRY_FILE" > "$BACKUP_DIR/entry-file.txt"
printf '%s\n' "$BACKUP_DIR" > "$SCRIPT_DIR/.last_backup"

say "Repairing physical Administrator delivery before cumulative application work"

bash "$SCRIPT_DIR/repair_admin_portal.sh" \
  || fail "Physical Administrator direct-delivery repair failed."

printf 'Early physical Administrator HTTP delivery repair [OK]\n'

say "Installing NurseLink auth/CORS hotfix"

mkdir -p "$API_ROOT/config"

cp -f "$PAYLOAD_DIR/api/config/cors.php" "$API_ROOT/config/cors.php"
"$PHP_BIN" -l "$API_ROOT/config/cors.php"

"$PHP_BIN" "$SCRIPT_DIR/cors_env_fix.php" "$API_ROOT"

python3 - "$API_ROOT/routes/web.php" "$SCRIPT_DIR/cors_preflight_block.txt" <<'PY'
from pathlib import Path
import sys

route_path = Path(sys.argv[1])
block_path = Path(sys.argv[2])

text = route_path.read_text(encoding="utf-8")
block = block_path.read_text(encoding="utf-8").strip()

marker = "/* NURSELINK_CORS_PREFLIGHT_V261_START */"

if marker not in text:
    if not text.endswith("\n"):
        text += "\n"
    text += "\n" + block + "\n"
    route_path.write_text(text, encoding="utf-8")
PY

"$PHP_BIN" -l "$API_ROOT/routes/web.php"

say "Installing all cumulative API modules"

mkdir -p "$API_ROOT/app/Http/Controllers/Api" "$API_ROOT/app/Http/Middleware" "$API_ROOT/app/Services" "$API_ROOT/database/migrations" "$WEB_ROOT/public"

for controller in "${CONTROLLERS[@]}"; do
  cp -f "$PAYLOAD_DIR/api/app/Http/Controllers/Api/$controller" \
    "$API_ROOT/app/Http/Controllers/Api/$controller"

  "$PHP_BIN" -l "$API_ROOT/app/Http/Controllers/Api/$controller"
done

cp -f "$PAYLOAD_DIR/api/app/Services/BenefitReminderService.php"   "$API_ROOT/app/Services/BenefitReminderService.php"
"$PHP_BIN" -l "$API_ROOT/app/Services/BenefitReminderService.php"

cp -f "$PAYLOAD_DIR/api/app/Http/Middleware/EnsureApprovedNurseLinkMember.php"   "$API_ROOT/app/Http/Middleware/EnsureApprovedNurseLinkMember.php"
"$PHP_BIN" -l "$API_ROOT/app/Http/Middleware/EnsureApprovedNurseLinkMember.php"

for migration in "${MIGRATIONS[@]}"; do
  cp -f "$PAYLOAD_DIR/api/database/migrations/$migration" \
    "$API_ROOT/database/migrations/$migration"

  "$PHP_BIN" -l "$API_ROOT/database/migrations/$migration"
done

python3 - "$API_ROOT/routes/api.php" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

# Remove obsolete v2.6.4 client-session reset route if it exists on the live API.
text = re.sub(
    r"/\* NURSELINK_CLIENT_SESSION_RESET_V264_START \*/.*?/\* NURSELINK_CLIENT_SESSION_RESET_V264_END \*/\s*",
    "",
    text,
    flags=re.S,
)

blocks = [
r'''
/* NURSELINK_PROFILE_PHOTO_V141_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/profile-photo', [\App\Http\Controllers\Api\ProfilePhotoController::class, 'show']);
    Route::get('/profile-photo/image', [\App\Http\Controllers\Api\ProfilePhotoController::class, 'image']);
    Route::post('/profile-photo', [\App\Http\Controllers\Api\ProfilePhotoController::class, 'store']);
    Route::delete('/profile-photo', [\App\Http\Controllers\Api\ProfilePhotoController::class, 'destroy']);
});
/* NURSELINK_PROFILE_PHOTO_V141_END */
'''.strip(),
r'''
/* NURSELINK_EMPLOYMENT_HISTORY_V150_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/employment-history', [\App\Http\Controllers\Api\EmploymentHistoryController::class, 'index']);
    Route::post('/employment-history', [\App\Http\Controllers\Api\EmploymentHistoryController::class, 'store']);
    Route::put('/employment-history/{id}', [\App\Http\Controllers\Api\EmploymentHistoryController::class, 'update'])->whereNumber('id');
    Route::delete('/employment-history/{id}', [\App\Http\Controllers\Api\EmploymentHistoryController::class, 'destroy'])->whereNumber('id');
});
/* NURSELINK_EMPLOYMENT_HISTORY_V150_END */
'''.strip(),
r'''
/* NURSELINK_CREDENTIAL_REGISTRY_V160_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/credential-registry', [\App\Http\Controllers\Api\CredentialRegistryController::class, 'index']);
    Route::post('/credential-registry', [\App\Http\Controllers\Api\CredentialRegistryController::class, 'store']);
    Route::put('/credential-registry/{id}', [\App\Http\Controllers\Api\CredentialRegistryController::class, 'update'])->whereNumber('id');
    Route::delete('/credential-registry/{id}', [\App\Http\Controllers\Api\CredentialRegistryController::class, 'destroy'])->whereNumber('id');
});
/* NURSELINK_CREDENTIAL_REGISTRY_V160_END */
'''.strip(),
r'''
/* NURSELINK_PORTFOLIO_ITEMS_V190_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user', \App\Http\Middleware\EnsureApprovedNurseLinkMember::class])->group(function () {
    Route::get('/portfolio-items', [\App\Http\Controllers\Api\PortfolioItemController::class, 'index']);
    Route::post('/portfolio-items', [\App\Http\Controllers\Api\PortfolioItemController::class, 'store']);
    Route::put('/portfolio-items/{id}', [\App\Http\Controllers\Api\PortfolioItemController::class, 'update'])->whereNumber('id');
    Route::delete('/portfolio-items/{id}', [\App\Http\Controllers\Api\PortfolioItemController::class, 'destroy'])->whereNumber('id');
});
/* NURSELINK_PORTFOLIO_ITEMS_V190_END */
'''.strip(),
r'''
/* NURSELINK_CAREER_PREFERENCES_V200_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user', \App\Http\Middleware\EnsureApprovedNurseLinkMember::class])->group(function () {
    Route::get('/career-preferences', [\App\Http\Controllers\Api\CareerPreferenceController::class, 'show']);
    Route::put('/career-preferences', [\App\Http\Controllers\Api\CareerPreferenceController::class, 'upsert']);
});
/* NURSELINK_CAREER_PREFERENCES_V200_END */
'''.strip(),
r'''
/* NURSELINK_LEARNING_RECORDS_V200_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user', \App\Http\Middleware\EnsureApprovedNurseLinkMember::class])->group(function () {
    Route::get('/learning-records', [\App\Http\Controllers\Api\LearningRecordController::class, 'index']);
    Route::post('/learning-records', [\App\Http\Controllers\Api\LearningRecordController::class, 'store']);
    Route::put('/learning-records/{id}', [\App\Http\Controllers\Api\LearningRecordController::class, 'update'])->whereNumber('id');
    Route::delete('/learning-records/{id}', [\App\Http\Controllers\Api\LearningRecordController::class, 'destroy'])->whereNumber('id');
});
/* NURSELINK_LEARNING_RECORDS_V200_END */
'''.strip(),
r'''
/* NURSELINK_JOB_MATCHING_V220_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user', \App\Http\Middleware\EnsureApprovedNurseLinkMember::class])->group(function () {
    Route::get('/job-opportunities', [\App\Http\Controllers\Api\JobOpportunityController::class, 'index']);
    Route::get('/job-opportunities/{id}', [\App\Http\Controllers\Api\JobOpportunityController::class, 'show'])->whereNumber('id');

    Route::get('/saved-jobs', [\App\Http\Controllers\Api\SavedJobController::class, 'index']);
    Route::post('/saved-jobs/{jobId}', [\App\Http\Controllers\Api\SavedJobController::class, 'store'])->whereNumber('jobId');
    Route::delete('/saved-jobs/{jobId}', [\App\Http\Controllers\Api\SavedJobController::class, 'destroy'])->whereNumber('jobId');

    Route::get('/job-applications', [\App\Http\Controllers\Api\JobApplicationController::class, 'index']);
    Route::post('/job-applications', [\App\Http\Controllers\Api\JobApplicationController::class, 'store']);
    Route::patch('/job-applications/{id}/withdraw', [\App\Http\Controllers\Api\JobApplicationController::class, 'withdraw'])->whereNumber('id');
});
/* NURSELINK_JOB_MATCHING_V220_END */
'''.strip(),
r'''
/* NURSELINK_REVIEW_CENTER_V230_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->prefix('reviewer')->group(function () {
    Route::get('/summary', [\App\Http\Controllers\Api\ReviewCenterController::class, 'summary']);

    Route::get('/credentials', [\App\Http\Controllers\Api\ReviewCenterController::class, 'credentials']);
    Route::patch('/credentials/{id}', [\App\Http\Controllers\Api\ReviewCenterController::class, 'reviewCredential'])->whereNumber('id');

    Route::get('/job-applications', [\App\Http\Controllers\Api\ReviewCenterController::class, 'jobApplications']);
    Route::patch('/job-applications/{id}', [\App\Http\Controllers\Api\ReviewCenterController::class, 'reviewJobApplication'])->whereNumber('id');

    Route::get('/job-opportunities', [\App\Http\Controllers\Api\ReviewCenterController::class, 'jobOpportunities']);
    Route::post('/job-opportunities', [\App\Http\Controllers\Api\ReviewCenterController::class, 'storeJobOpportunity']);
    Route::patch('/job-opportunities/{id}', [\App\Http\Controllers\Api\ReviewCenterController::class, 'updateJobOpportunity'])->whereNumber('id');

    Route::get('/audit-log', [\App\Http\Controllers\Api\ReviewCenterController::class, 'auditLog']);
});
/* NURSELINK_REVIEW_CENTER_V230_END */
'''.strip(),
r'''
/* NURSELINK_MEMBERSHIP_IDENTITY_V250_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/membership/me', [\App\Http\Controllers\Api\MembershipController::class, 'me']);

    Route::get('/notifications', [\App\Http\Controllers\Api\NotificationController::class, 'index']);
    Route::patch('/notifications/{id}/read', [\App\Http\Controllers\Api\NotificationController::class, 'read'])->whereNumber('id');
    Route::post('/notifications/read-all', [\App\Http\Controllers\Api\NotificationController::class, 'readAll']);
});

Route::get('/membership/verify/{code}', [\App\Http\Controllers\Api\MembershipController::class, 'verify']);

Route::middleware(['auth:sanctum', 'verified', 'active.user'])->prefix('reviewer')->group(function () {
    Route::get('/membership-applications', [\App\Http\Controllers\Api\MembershipReviewController::class, 'index']);
    Route::patch('/membership-applications/{id}', [\App\Http\Controllers\Api\MembershipReviewController::class, 'review'])->whereNumber('id');
});
/* NURSELINK_MEMBERSHIP_IDENTITY_V250_END */
'''.strip(),
r'''
/* NURSELINK_PUBLIC_PROFILE_V260_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/public-profile/settings', [\App\Http\Controllers\Api\PublicProfileController::class, 'settings']);
    Route::put('/public-profile/settings', [\App\Http\Controllers\Api\PublicProfileController::class, 'updateSettings']);
});

Route::get('/public-profile/{slug}', [\App\Http\Controllers\Api\PublicProfileController::class, 'show']);
Route::get('/public-profile/{slug}/photo', [\App\Http\Controllers\Api\PublicProfileController::class, 'photo']);
/* NURSELINK_PUBLIC_PROFILE_V260_END */
'''.strip(),
r'''
/* NURSELINK_SESSION_BOOTSTRAP_V265_START */
Route::get(
    '/nurselink/session-bootstrap',
    [\App\Http\Controllers\Api\SessionBootstrapController::class, 'show']
);
/* NURSELINK_SESSION_BOOTSTRAP_V265_END */
'''.strip(),
r'''
/* NURSELINK_SESSION_LOGIN_V266_START */
Route::post(
    '/nurselink/session-login',
    [\App\Http\Controllers\Api\SessionLoginController::class, 'login']
);
/* NURSELINK_SESSION_LOGIN_V266_END */
'''.strip(),
r'''
/* NURSELINK_PARTNER_PORTAL_V270_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->prefix('partner')->group(function () {
    Route::get('/me', [\App\Http\Controllers\Api\PartnerPortalController::class, 'me']);
    Route::get('/summary', [\App\Http\Controllers\Api\PartnerPortalController::class, 'summary']);
    Route::get('/opportunities', [\App\Http\Controllers\Api\PartnerPortalController::class, 'opportunities']);
    Route::post('/opportunities', [\App\Http\Controllers\Api\PartnerPortalController::class, 'storeOpportunity']);
    Route::put('/opportunities/{id}', [\App\Http\Controllers\Api\PartnerPortalController::class, 'updateOpportunity'])->whereNumber('id');
    Route::get('/applications', [\App\Http\Controllers\Api\PartnerPortalController::class, 'applications']);
    Route::patch('/applications/{id}', [\App\Http\Controllers\Api\PartnerPortalController::class, 'updateApplication'])->whereNumber('id');
    Route::get('/audit-log', [\App\Http\Controllers\Api\PartnerPortalController::class, 'auditLog']);
});

Route::middleware(['auth:sanctum', 'verified', 'active.user'])->prefix('reviewer')->group(function () {
    Route::get('/partner-organizations', [\App\Http\Controllers\Api\PartnerAdminController::class, 'organizations']);
    Route::post('/partner-organizations', [\App\Http\Controllers\Api\PartnerAdminController::class, 'storeOrganization']);
    Route::patch('/partner-organizations/{id}', [\App\Http\Controllers\Api\PartnerAdminController::class, 'updateOrganization'])->whereNumber('id');
    Route::get('/partner-access', [\App\Http\Controllers\Api\PartnerAdminController::class, 'access']);
    Route::post('/partner-access', [\App\Http\Controllers\Api\PartnerAdminController::class, 'grantAccess']);
    Route::patch('/job-opportunities/{id}/partner', [\App\Http\Controllers\Api\PartnerAdminController::class, 'linkOpportunity'])->whereNumber('id');
});
/* NURSELINK_PARTNER_PORTAL_V270_END */
'''.strip(),
r'''
/* NURSELINK_PARTNER_COMMUNICATIONS_V280_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user', \App\Http\Middleware\EnsureApprovedNurseLinkMember::class])->group(function () {
    Route::get('/job-applications/{application}/communications', [\App\Http\Controllers\Api\ApplicationCommunicationController::class, 'show'])->whereNumber('application');
    Route::post('/job-applications/{application}/messages', [\App\Http\Controllers\Api\ApplicationCommunicationController::class, 'sendMessage'])->whereNumber('application');
    Route::post('/job-applications/{application}/messages/read', [\App\Http\Controllers\Api\ApplicationCommunicationController::class, 'markMessagesRead'])->whereNumber('application');
    Route::patch('/job-applications/{application}/interviews/{interview}/respond', [\App\Http\Controllers\Api\ApplicationCommunicationController::class, 'respondInterview'])->whereNumber('application')->whereNumber('interview');
});

Route::middleware(['auth:sanctum', 'verified', 'active.user'])->prefix('partner')->group(function () {
    Route::get('/applications/{application}/communications', [\App\Http\Controllers\Api\PartnerCommunicationController::class, 'show'])->whereNumber('application');
    Route::post('/applications/{application}/messages', [\App\Http\Controllers\Api\PartnerCommunicationController::class, 'sendMessage'])->whereNumber('application');
    Route::post('/applications/{application}/messages/read', [\App\Http\Controllers\Api\PartnerCommunicationController::class, 'markMessagesRead'])->whereNumber('application');
    Route::post('/applications/{application}/interviews', [\App\Http\Controllers\Api\PartnerCommunicationController::class, 'scheduleInterview'])->whereNumber('application');
    Route::patch('/applications/{application}/interviews/{interview}', [\App\Http\Controllers\Api\PartnerCommunicationController::class, 'updateInterview'])->whereNumber('application')->whereNumber('interview');
});
/* NURSELINK_PARTNER_COMMUNICATIONS_V280_END */
'''.strip(),
r'''
/* NURSELINK_INSTITUTIONAL_ANALYTICS_V290_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/partner/analytics', [\App\Http\Controllers\Api\PartnerAnalyticsController::class, 'show']);
    Route::get('/reviewer/institutional-analytics', [\App\Http\Controllers\Api\InstitutionalAnalyticsController::class, 'show']);
});
/* NURSELINK_INSTITUTIONAL_ANALYTICS_V290_END */
'''.strip(),
r'''
/* NURSELINK_PRODUCTION_READINESS_V320_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/reviewer/production-readiness', [\App\Http\Controllers\Api\ProductionReadinessController::class, 'show']);
});
/* NURSELINK_PRODUCTION_READINESS_V320_END */
'''.strip(),
r'''
/* NURSELINK_OPERATIONS_CENTER_V410_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/reviewer/operations-center', [\App\Http\Controllers\Api\OperationsCenterController::class, 'show']);
    Route::post('/reviewer/operations-center/snapshot', [\App\Http\Controllers\Api\OperationsCenterController::class, 'snapshot']);
    Route::post('/reviewer/operations-center/incidents', [\App\Http\Controllers\Api\OperationsCenterController::class, 'storeIncident']);
    Route::patch('/reviewer/operations-center/incidents/{incident}', [\App\Http\Controllers\Api\OperationsCenterController::class, 'updateIncident'])->whereNumber('incident');
});
/* NURSELINK_OPERATIONS_CENTER_V410_END */
'''.strip(),
r'''
/* NURSELINK_CAREER_INTELLIGENCE_V420_START */
Route::middleware([
    'auth:sanctum',
    'verified',
    'active.user',
    \App\Http\Middleware\EnsureApprovedNurseLinkMember::class,
])->group(function () {
    Route::get('/career-intelligence', [\App\Http\Controllers\Api\CareerIntelligenceController::class, 'show']);
    Route::post('/career-intelligence/snapshot', [\App\Http\Controllers\Api\CareerIntelligenceController::class, 'snapshot']);
});
/* NURSELINK_CAREER_INTELLIGENCE_V420_END */
'''.strip(),
r'''
/* NURSELINK_SESSION_IDENTITY_V421_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/nurselink/session-identity', [\App\Http\Controllers\Api\SessionIdentityController::class, 'show']);
});
/* NURSELINK_SESSION_IDENTITY_V421_END */
'''.strip(),
r'''
/* NURSELINK_ADMIN_PORTAL_V430_START */
Route::post('/nurselink/admin/session-login', [\App\Http\Controllers\Api\AdminSessionLoginController::class, 'login']);
Route::post('/nurselink/admin/logout', [\App\Http\Controllers\Api\AdminSessionLoginController::class, 'logout']);

Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/nurselink/admin/session', [\App\Http\Controllers\Api\AdminPortalController::class, 'session']);
    Route::get('/nurselink/admin/dashboard', [\App\Http\Controllers\Api\AdminPortalController::class, 'dashboard']);
    Route::get('/nurselink/admin/users', [\App\Http\Controllers\Api\AdminPortalController::class, 'users']);
    Route::post('/nurselink/admin/users/grant', [\App\Http\Controllers\Api\AdminPortalController::class, 'grant']);
    Route::delete('/nurselink/admin/users/{userId}', [\App\Http\Controllers\Api\AdminPortalController::class, 'revoke']);
});
/* NURSELINK_ADMIN_PORTAL_V430_END */
'''.strip(),
r'''
/* NURSELINK_MEMBERSHIP_COMMAND_CENTER_V440_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/nurselink/admin/membership-command/summary', [\App\Http\Controllers\Api\AdminMembershipCommandController::class, 'summary']);
    Route::get('/nurselink/admin/membership-command', [\App\Http\Controllers\Api\AdminMembershipCommandController::class, 'index']);
    Route::get('/nurselink/admin/membership-command/{id}', [\App\Http\Controllers\Api\AdminMembershipCommandController::class, 'show']);
    Route::get('/nurselink/admin/membership-command/{id}/history', [\App\Http\Controllers\Api\AdminMembershipCommandController::class, 'history']);
    Route::post('/nurselink/admin/membership-command/{id}/transition', [\App\Http\Controllers\Api\AdminMembershipCommandController::class, 'transition']);
});
/* NURSELINK_MEMBERSHIP_COMMAND_CENTER_V440_END */
'''.strip(),
r'''
/* NURSELINK_MEMBER_REGISTRY_V450_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/nurselink/admin/member-registry/summary', [\App\Http\Controllers\Api\AdminMemberRegistryController::class, 'summary']);
    Route::get('/nurselink/admin/member-registry', [\App\Http\Controllers\Api\AdminMemberRegistryController::class, 'index']);
    Route::get('/nurselink/admin/member-registry/{membershipId}', [\App\Http\Controllers\Api\AdminMemberRegistryController::class, 'show']);
});
/* NURSELINK_MEMBER_REGISTRY_V450_END */
'''.strip(),
r'''
/* NURSELINK_SUPER_ADMIN_TEST_MODE_V453_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/nurselink/admin/test-mode/session', [\App\Http\Controllers\Api\SuperAdminTestModeController::class, 'session']);
    Route::post('/nurselink/admin/test-mode/start', [\App\Http\Controllers\Api\SuperAdminTestModeController::class, 'start']);
    Route::post('/nurselink/admin/test-mode/stop', [\App\Http\Controllers\Api\SuperAdminTestModeController::class, 'stop']);
    Route::get('/nurselink/admin/test-mode/checks', [\App\Http\Controllers\Api\SuperAdminTestModeController::class, 'checks']);
});
/* NURSELINK_SUPER_ADMIN_TEST_MODE_V453_END */
'''.strip(),
r'''
/* NURSELINK_MEMBERSHIP_LIFECYCLE_V460_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/nurselink/admin/membership-lifecycle/summary', [\App\Http\Controllers\Api\AdminMembershipLifecycleController::class, 'summary']);
    Route::get('/nurselink/admin/membership-lifecycle/{membershipId}', [\App\Http\Controllers\Api\AdminMembershipLifecycleController::class, 'show']);
    Route::post('/nurselink/admin/membership-lifecycle/{membershipId}/standing', [\App\Http\Controllers\Api\AdminMembershipLifecycleController::class, 'transition']);
});
/* NURSELINK_MEMBERSHIP_LIFECYCLE_V460_END */
'''.strip(),
r'''
/* NURSELINK_CREDENTIAL_RENEWAL_V461_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/credential-renewal', [\App\Http\Controllers\Api\CredentialRenewalController::class, 'member'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::post('/credential-renewal/{credentialId}', [\App\Http\Controllers\Api\CredentialRenewalController::class, 'start'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::patch('/credential-renewal/{credentialId}/{renewalId}', [\App\Http\Controllers\Api\CredentialRenewalController::class, 'update'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::get('/nurselink/admin/credential-renewal/summary', [\App\Http\Controllers\Api\CredentialRenewalController::class, 'adminSummary']);
    Route::get('/nurselink/admin/credential-renewal', [\App\Http\Controllers\Api\CredentialRenewalController::class, 'adminIndex']);
    Route::patch('/nurselink/admin/credential-renewal/{renewalId}', [\App\Http\Controllers\Api\CredentialRenewalController::class, 'adminUpdate']);
});
/* NURSELINK_CREDENTIAL_RENEWAL_V461_END */
'''.strip(),
r'''
/* NURSELINK_EVENTS_PROGRAMS_V471_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/events', [\App\Http\Controllers\Api\EventsController::class, 'memberIndex'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::post('/events/{eventId}/register', [\App\Http\Controllers\Api\EventsController::class, 'register'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::delete('/events/{eventId}/registration', [\App\Http\Controllers\Api\EventsController::class, 'cancel'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);

    Route::get('/nurselink/admin/events', [\App\Http\Controllers\Api\EventsController::class, 'adminIndex']);
    Route::post('/nurselink/admin/events', [\App\Http\Controllers\Api\EventsController::class, 'adminStore']);
    Route::patch('/nurselink/admin/events/{eventId}', [\App\Http\Controllers\Api\EventsController::class, 'adminUpdate']);
    Route::get('/nurselink/admin/events/{eventId}/registrations', [\App\Http\Controllers\Api\EventsController::class, 'adminRegistrations']);
    Route::patch('/nurselink/admin/events/{eventId}/registrations/{registrationId}', [\App\Http\Controllers\Api\EventsController::class, 'adminRegistrationStatus']);
});
/* NURSELINK_EVENTS_PROGRAMS_V471_END */
'''.strip(),
r'''
/* NURSELINK_CHAPTERS_COMMUNITIES_V472_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/chapters', [\App\Http\Controllers\Api\ChaptersController::class, 'memberIndex'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::post('/chapters/{chapterId}/request', [\App\Http\Controllers\Api\ChaptersController::class, 'requestJoin'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::delete('/chapters/{chapterId}/membership', [\App\Http\Controllers\Api\ChaptersController::class, 'withdraw'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);

    Route::get('/nurselink/admin/chapters', [\App\Http\Controllers\Api\ChaptersController::class, 'adminIndex']);
    Route::post('/nurselink/admin/chapters', [\App\Http\Controllers\Api\ChaptersController::class, 'adminStore']);
    Route::patch('/nurselink/admin/chapters/{chapterId}', [\App\Http\Controllers\Api\ChaptersController::class, 'adminUpdate']);
    Route::get('/nurselink/admin/chapters/{chapterId}/members', [\App\Http\Controllers\Api\ChaptersController::class, 'adminMembers']);
    Route::patch('/nurselink/admin/chapters/{chapterId}/members/{membershipId}', [\App\Http\Controllers\Api\ChaptersController::class, 'adminMembershipStatus']);
});
/* NURSELINK_CHAPTERS_COMMUNITIES_V472_END */
'''.strip(),
r'''
/* NURSELINK_MENTORING_V473_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/mentoring/profile', [\App\Http\Controllers\Api\MentoringController::class, 'profile'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::put('/mentoring/profile', [\App\Http\Controllers\Api\MentoringController::class, 'updateProfile'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::get('/mentoring/directory', [\App\Http\Controllers\Api\MentoringController::class, 'directory'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::get('/mentoring/requests', [\App\Http\Controllers\Api\MentoringController::class, 'requests'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::post('/mentoring/requests', [\App\Http\Controllers\Api\MentoringController::class, 'sendRequest'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::patch('/mentoring/requests/{requestId}', [\App\Http\Controllers\Api\MentoringController::class, 'updateRequest'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::get('/nurselink/admin/mentoring/summary', [\App\Http\Controllers\Api\MentoringController::class, 'adminSummary']);
});
/* NURSELINK_MENTORING_V473_END */
'''.strip(),
r'''
/* NURSELINK_ENGAGEMENT_HUB_V480_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/engagement', [\App\Http\Controllers\Api\EngagementController::class, 'memberSummary'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::get('/nurselink/admin/engagement/summary', [\App\Http\Controllers\Api\EngagementController::class, 'adminSummary']);
});
/* NURSELINK_ENGAGEMENT_HUB_V480_END */
'''.strip(),
r'''
/* NURSELINK_MEMBER_BENEFITS_V482_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/benefits', [\App\Http\Controllers\Api\MemberBenefitsController::class, 'memberIndex'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::post('/benefits/{benefitId}/request', [\App\Http\Controllers\Api\MemberBenefitsController::class, 'requestBenefit'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::delete('/benefits/{benefitId}/request', [\App\Http\Controllers\Api\MemberBenefitsController::class, 'cancelRequest'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);

    Route::get('/nurselink/admin/benefits', [\App\Http\Controllers\Api\MemberBenefitsController::class, 'adminIndex']);
    Route::post('/nurselink/admin/benefits', [\App\Http\Controllers\Api\MemberBenefitsController::class, 'adminStore']);
    Route::patch('/nurselink/admin/benefits/{benefitId}', [\App\Http\Controllers\Api\MemberBenefitsController::class, 'adminUpdate']);
    Route::get('/nurselink/admin/benefits/{benefitId}/requests', [\App\Http\Controllers\Api\MemberBenefitsController::class, 'adminRequests']);
    Route::patch('/nurselink/admin/benefits/{benefitId}/requests/{requestId}', [\App\Http\Controllers\Api\MemberBenefitsController::class, 'adminRequestStatus']);
});
/* NURSELINK_MEMBER_BENEFITS_V482_END */
'''.strip(),
r'''
/* NURSELINK_BENEFIT_INTELLIGENCE_V483_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/benefits/intelligence', [\App\Http\Controllers\Api\BenefitIntelligenceController::class, 'memberSummary'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::post('/benefits/{benefitId}/save', [\App\Http\Controllers\Api\BenefitIntelligenceController::class, 'save'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::delete('/benefits/{benefitId}/save', [\App\Http\Controllers\Api\BenefitIntelligenceController::class, 'unsave'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::get('/nurselink/admin/benefits/summary', [\App\Http\Controllers\Api\BenefitIntelligenceController::class, 'adminSummary']);
});
/* NURSELINK_BENEFIT_INTELLIGENCE_V483_END */
'''.strip(),
r'''
/* NURSELINK_BENEFIT_REMINDERS_V484_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/benefits/reminders', [\App\Http\Controllers\Api\BenefitReminderController::class, 'member'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::get('/nurselink/admin/benefits/reminders/summary', [\App\Http\Controllers\Api\BenefitReminderController::class, 'adminSummary']);
    Route::post('/nurselink/admin/benefits/reminders/generate', [\App\Http\Controllers\Api\BenefitReminderController::class, 'generate']);
});
/* NURSELINK_BENEFIT_REMINDERS_V484_END */
'''.strip(),
r'''
/* NURSELINK_ENGAGEMENT_TIMELINE_V490_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/engagement/timeline', [\App\Http\Controllers\Api\EngagementTimelineController::class, 'member'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::get('/nurselink/admin/engagement/activity-summary', [\App\Http\Controllers\Api\EngagementTimelineController::class, 'adminSummary']);
});
/* NURSELINK_ENGAGEMENT_TIMELINE_V490_END */
'''.strip(),
r'''
/* NURSELINK_ENTERPRISE_PLATFORM_V500_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/enterprise/me', [\App\Http\Controllers\Api\EnterprisePlatformController::class, 'memberMe'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);

    Route::get('/partner/enterprise', [\App\Http\Controllers\Api\EnterprisePlatformController::class, 'partnerSummary']);

    Route::get('/nurselink/admin/enterprise/summary', [\App\Http\Controllers\Api\EnterprisePlatformController::class, 'adminSummary']);
    Route::get('/nurselink/admin/enterprise/organizations', [\App\Http\Controllers\Api\EnterprisePlatformController::class, 'adminOrganizations']);
    Route::get('/nurselink/admin/enterprise/cohorts', [\App\Http\Controllers\Api\EnterprisePlatformController::class, 'adminCohorts']);
    Route::post('/nurselink/admin/enterprise/cohorts', [\App\Http\Controllers\Api\EnterprisePlatformController::class, 'adminStoreCohort']);
    Route::get('/nurselink/admin/enterprise/cohorts/{cohortId}', [\App\Http\Controllers\Api\EnterprisePlatformController::class, 'adminCohortDetail']);
    Route::patch('/nurselink/admin/enterprise/cohorts/{cohortId}', [\App\Http\Controllers\Api\EnterprisePlatformController::class, 'adminUpdateCohort']);
    Route::post('/nurselink/admin/enterprise/cohorts/{cohortId}/members', [\App\Http\Controllers\Api\EnterprisePlatformController::class, 'adminEnrollMember']);
    Route::delete('/nurselink/admin/enterprise/cohorts/{cohortId}/members/{userId}', [\App\Http\Controllers\Api\EnterprisePlatformController::class, 'adminRemoveMember']);
});
/* NURSELINK_ENTERPRISE_PLATFORM_V500_END */
'''.strip(),
r'''
/* NURSELINK_ENTERPRISE_GOALS_V501_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/enterprise/goals', [\App\Http\Controllers\Api\EnterpriseGoalsController::class, 'memberIndex'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::put('/enterprise/goals/{goalId}/progress', [\App\Http\Controllers\Api\EnterpriseGoalsController::class, 'memberUpdate'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);

    Route::get('/partner/enterprise/goals', [\App\Http\Controllers\Api\EnterpriseGoalsController::class, 'partnerGoals']);

    Route::get('/nurselink/admin/enterprise/cohorts/{cohortId}/goals', [\App\Http\Controllers\Api\EnterpriseGoalsController::class, 'adminGoals']);
    Route::post('/nurselink/admin/enterprise/cohorts/{cohortId}/goals', [\App\Http\Controllers\Api\EnterpriseGoalsController::class, 'adminStoreGoal']);
    Route::patch('/nurselink/admin/enterprise/goals/{goalId}', [\App\Http\Controllers\Api\EnterpriseGoalsController::class, 'adminUpdateGoal']);
    Route::get('/nurselink/admin/enterprise/goals/{goalId}/progress', [\App\Http\Controllers\Api\EnterpriseGoalsController::class, 'adminProgress']);
    Route::put('/nurselink/admin/enterprise/goals/{goalId}/progress/{userId}', [\App\Http\Controllers\Api\EnterpriseGoalsController::class, 'adminUpdateProgress']);
});
/* NURSELINK_ENTERPRISE_GOALS_V501_END */
'''.strip(),
r'''
/* NURSELINK_ENTERPRISE_ENROLLMENT_V503_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/enterprise/invitations', [\App\Http\Controllers\Api\EnterpriseEnrollmentController::class, 'memberInvitations'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::post('/enterprise/invitations/{invitationId}/respond', [\App\Http\Controllers\Api\EnterpriseEnrollmentController::class, 'memberRespond'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);

    Route::get('/partner/enterprise/enrollment-summary', [\App\Http\Controllers\Api\EnterpriseEnrollmentController::class, 'partnerOrganizationReport']);

    Route::get('/nurselink/admin/enterprise/cohorts/{cohortId}/invitations', [\App\Http\Controllers\Api\EnterpriseEnrollmentController::class, 'adminInvitations']);
    Route::post('/nurselink/admin/enterprise/cohorts/{cohortId}/invitations', [\App\Http\Controllers\Api\EnterpriseEnrollmentController::class, 'adminInvite']);
    Route::delete('/nurselink/admin/enterprise/invitations/{invitationId}', [\App\Http\Controllers\Api\EnterpriseEnrollmentController::class, 'adminCancelInvitation']);
    Route::get('/nurselink/admin/enterprise/enrollment-summary', [\App\Http\Controllers\Api\EnterpriseEnrollmentController::class, 'adminOrganizationReport']);
});
/* NURSELINK_ENTERPRISE_ENROLLMENT_V503_END */
'''.strip(),
r'''
/* NURSELINK_ENTERPRISE_OUTCOMES_V504_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/enterprise/outcomes', [\App\Http\Controllers\Api\EnterpriseOutcomesController::class, 'memberIndex'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);

    Route::get('/partner/enterprise/outcomes', [\App\Http\Controllers\Api\EnterpriseOutcomesController::class, 'partnerOutcomes']);

    Route::get('/nurselink/admin/enterprise/cohorts/{cohortId}/outcomes', [\App\Http\Controllers\Api\EnterpriseOutcomesController::class, 'adminCohortOutcomes']);
    Route::put('/nurselink/admin/enterprise/cohorts/{cohortId}/outcomes/{userId}', [\App\Http\Controllers\Api\EnterpriseOutcomesController::class, 'adminUpdateOutcome']);
});
/* NURSELINK_ENTERPRISE_OUTCOMES_V504_END */
'''.strip(),
r'''
/* NURSELINK_ENTERPRISE_SUPPORT_V505_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/enterprise/support', [\App\Http\Controllers\Api\EnterpriseSupportController::class, 'memberIndex'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::post('/enterprise/support', [\App\Http\Controllers\Api\EnterpriseSupportController::class, 'memberStore'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);

    Route::get('/partner/enterprise/support-summary', [\App\Http\Controllers\Api\EnterpriseSupportController::class, 'partnerSummary']);

    Route::get('/nurselink/admin/enterprise/support', [\App\Http\Controllers\Api\EnterpriseSupportController::class, 'adminIndex']);
    Route::put('/nurselink/admin/enterprise/support/{checkinId}', [\App\Http\Controllers\Api\EnterpriseSupportController::class, 'adminUpdate']);
});
/* NURSELINK_ENTERPRISE_SUPPORT_V505_END */
'''.strip(),
r'''
/* NURSELINK_MEMBERSHIP_ADMINISTRATION_V510_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/nurselink/admin/membership-administration/overview', [\App\Http\Controllers\Api\MembershipAdministrationController::class, 'overview']);
    Route::get('/nurselink/admin/membership-administration/queue', [\App\Http\Controllers\Api\MembershipAdministrationController::class, 'queue']);
    Route::get('/nurselink/admin/membership-administration/staff', [\App\Http\Controllers\Api\MembershipAdministrationController::class, 'staff']);
    Route::get('/nurselink/admin/membership-administration/export', [\App\Http\Controllers\Api\MembershipAdministrationController::class, 'export']);
    Route::put('/nurselink/admin/membership-administration/{membershipId}/assignment', [\App\Http\Controllers\Api\MembershipAdministrationController::class, 'assignReview']);
    Route::get('/nurselink/admin/membership-administration/activity', [\App\Http\Controllers\Api\MembershipAdministrationController::class, 'activity']);
    Route::get('/nurselink/admin/membership-administration/saved-views', [\App\Http\Controllers\Api\MembershipAdministrationController::class, 'savedViews']);
    Route::post('/nurselink/admin/membership-administration/saved-views', [\App\Http\Controllers\Api\MembershipAdministrationController::class, 'storeSavedView']);
    Route::delete('/nurselink/admin/membership-administration/saved-views/{viewId}', [\App\Http\Controllers\Api\MembershipAdministrationController::class, 'deleteSavedView']);
});
/* NURSELINK_MEMBERSHIP_ADMINISTRATION_V510_END */
'''.strip(),
r'''
/* NURSELINK_MEMBERSHIP_ONBOARDING_V511_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/membership/onboarding', [\App\Http\Controllers\Api\MembershipOnboardingController::class, 'memberIndex'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);
    Route::post('/membership/onboarding/progress', [\App\Http\Controllers\Api\MembershipOnboardingController::class, 'memberMark'])
        ->middleware(\App\Http\Middleware\EnsureApprovedNurseLinkMember::class);

    Route::get('/nurselink/admin/membership-onboarding/summary', [\App\Http\Controllers\Api\MembershipOnboardingController::class, 'adminSummary']);
    Route::get('/nurselink/admin/membership-onboarding', [\App\Http\Controllers\Api\MembershipOnboardingController::class, 'adminQueue']);
    Route::put('/nurselink/admin/membership-onboarding/{membershipId}', [\App\Http\Controllers\Api\MembershipOnboardingController::class, 'adminUpdate']);
    Route::post('/nurselink/admin/membership-onboarding/{membershipId}/welcome', [\App\Http\Controllers\Api\MembershipOnboardingController::class, 'adminSendWelcome']);
});
/* NURSELINK_MEMBERSHIP_ONBOARDING_V511_END */
'''.strip(),
r'''
/* NURSELINK_ADMIN_OPERATIONS_CENTER_V530_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/nurselink/admin/operations-center/summary', [\App\Http\Controllers\Api\AdministrationOperationsCenterController::class, 'summary']);
    Route::get('/nurselink/admin/operations-center/support-cases', [\App\Http\Controllers\Api\AdministrationOperationsCenterController::class, 'supportCases']);
    Route::post('/nurselink/admin/operations-center/support-cases', [\App\Http\Controllers\Api\AdministrationOperationsCenterController::class, 'storeSupportCase']);
    Route::put('/nurselink/admin/operations-center/support-cases/{caseId}', [\App\Http\Controllers\Api\AdministrationOperationsCenterController::class, 'updateSupportCase']);
    Route::post('/nurselink/admin/operations-center/communications', [\App\Http\Controllers\Api\AdministrationOperationsCenterController::class, 'sendCommunication']);
    Route::get('/nurselink/admin/operations-center/audit-log', [\App\Http\Controllers\Api\AdministrationOperationsCenterController::class, 'auditLog']);
    Route::get('/nurselink/admin/operations-center/system-health', [\App\Http\Controllers\Api\AdministrationOperationsCenterController::class, 'systemHealth']);
    Route::get('/nurselink/admin/operations-center/settings', [\App\Http\Controllers\Api\AdministrationOperationsCenterController::class, 'settings']);
});
/* NURSELINK_ADMIN_OPERATIONS_CENTER_V530_END */
'''.strip(),
]

markers = [
    '/* NURSELINK_PROFILE_PHOTO_V141_START */',
    '/* NURSELINK_EMPLOYMENT_HISTORY_V150_START */',
    '/* NURSELINK_CREDENTIAL_REGISTRY_V160_START */',
    '/* NURSELINK_PORTFOLIO_ITEMS_V190_START */',
    '/* NURSELINK_CAREER_PREFERENCES_V200_START */',
    '/* NURSELINK_LEARNING_RECORDS_V200_START */',
    '/* NURSELINK_JOB_MATCHING_V220_START */',
    '/* NURSELINK_REVIEW_CENTER_V230_START */',
    '/* NURSELINK_MEMBERSHIP_IDENTITY_V250_START */',
    '/* NURSELINK_PUBLIC_PROFILE_V260_START */',
    '/* NURSELINK_SESSION_BOOTSTRAP_V265_START */',
    '/* NURSELINK_SESSION_LOGIN_V266_START */',
    '/* NURSELINK_PARTNER_PORTAL_V270_START */',
    '/* NURSELINK_PARTNER_COMMUNICATIONS_V280_START */',
    '/* NURSELINK_INSTITUTIONAL_ANALYTICS_V290_START */',
    '/* NURSELINK_PRODUCTION_READINESS_V320_START */',
    '/* NURSELINK_OPERATIONS_CENTER_V410_START */',
    '/* NURSELINK_CAREER_INTELLIGENCE_V420_START */',
    '/* NURSELINK_SESSION_IDENTITY_V421_START */',
    '/* NURSELINK_ADMIN_PORTAL_V430_START */',
    '/* NURSELINK_MEMBERSHIP_COMMAND_CENTER_V440_START */',
    '/* NURSELINK_MEMBER_REGISTRY_V450_START */',
    '/* NURSELINK_SUPER_ADMIN_TEST_MODE_V453_START */',
    '/* NURSELINK_MEMBERSHIP_LIFECYCLE_V460_START */',
    '/* NURSELINK_CREDENTIAL_RENEWAL_V461_START */',
    '/* NURSELINK_EVENTS_PROGRAMS_V471_START */',
    '/* NURSELINK_CHAPTERS_COMMUNITIES_V472_START */',
    '/* NURSELINK_MENTORING_V473_START */',
    '/* NURSELINK_ENGAGEMENT_HUB_V480_START */',
    '/* NURSELINK_MEMBER_BENEFITS_V482_START */',
    '/* NURSELINK_BENEFIT_INTELLIGENCE_V483_START */',
    '/* NURSELINK_BENEFIT_REMINDERS_V484_START */',
    '/* NURSELINK_ENGAGEMENT_TIMELINE_V490_START */',
    '/* NURSELINK_ENTERPRISE_PLATFORM_V500_START */',
    '/* NURSELINK_ENTERPRISE_GOALS_V501_START */',
    '/* NURSELINK_ENTERPRISE_ENROLLMENT_V503_START */',
    '/* NURSELINK_ENTERPRISE_OUTCOMES_V504_START */',
    '/* NURSELINK_ENTERPRISE_SUPPORT_V505_START */',
    '/* NURSELINK_MEMBERSHIP_ADMINISTRATION_V510_START */',
    '/* NURSELINK_MEMBERSHIP_ONBOARDING_V511_START */',
    '/* NURSELINK_ADMIN_OPERATIONS_CENTER_V530_START */',
]

changed = False

for marker, block in zip(markers, blocks):
    end_marker = marker.replace('_START */', '_END */')
    pattern = re.compile(
        re.escape(marker) + r'.*?' + re.escape(end_marker),
        re.S
    )

    if pattern.search(text):
        updated = pattern.sub(lambda _: block, text, count=1)

        if updated != text:
            text = updated
            changed = True
    else:
        text = text.rstrip() + "\n\n" + block + "\n"
        changed = True

if changed:
    path.write_text(text, encoding="utf-8")
    print("Refreshed cumulative NurseLink API route blocks.")
else:
    print("Cumulative NurseLink API route blocks already current.")
PY

"$PHP_BIN" -l "$API_ROOT/routes/api.php"

say "Refreshing Laravel auth/CORS configuration"
cd "$API_ROOT"
"$PHP_BIN" artisan optimize:clear
"$PHP_BIN" artisan route:list --method=OPTIONS | grep -q "OPTIONS" || fail "OPTIONS preflight route not registered."

say "Inspecting live users.id type"

cd "$API_ROOT"
"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" "$API_ROOT" inspect-users-id

say "Running cumulative migrations"

for migration in "${MIGRATIONS[@]}"; do
  "$PHP_BIN" artisan migrate --force --path="database/migrations/$migration"
done

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php"   "$API_ROOT" migration-applied "${OPERATIONS_MIGRATION%.php}"   || fail "Operations Center migration was not recorded as applied."

printf 'Operations Center migration [OK]\n'

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${CAREER_INTELLIGENCE_MIGRATION%.php}" \
  || fail "Career Intelligence snapshot migration was not recorded as applied."

printf 'Career Intelligence snapshot migration [OK]\n'

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${SUPER_ADMIN_MIGRATION%.php}" \
  || fail "Super Administrator access migration was not recorded as applied."

"$PHP_BIN" "$SCRIPT_DIR/super_admin_access.php" "$API_ROOT" list >/dev/null \
  || fail "Super Administrator access utility could not read the installed access table."

printf 'Super Administrator access registry [OK]\n'


"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${MEMBERSHIP_LIFECYCLE_MIGRATION%.php}" \
  || fail "Membership Lifecycle migration was not recorded as applied."

printf 'Membership Lifecycle migration [OK]\n'


"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${CREDENTIAL_RENEWAL_WORKFLOW_MIGRATION%.php}" \
  || fail "Credential Renewal Workflow migration was not recorded as applied."

printf 'Credential Renewal Workflow migration [OK]\n'

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${EVENTS_MIGRATION%.php}" \
  || fail "Events & Programs migration was not recorded as applied."

printf 'Events & Programs migration [OK]\n'

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${CHAPTERS_MIGRATION%.php}" \
  || fail "Chapters & Communities migration was not recorded as applied."

printf 'Chapters & Communities migration [OK]\n'

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${MENTORING_MIGRATION%.php}" \
  || fail "Mentoring migration was not recorded as applied."

printf 'Mentoring & Peer Support migration [OK]\n'

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${BENEFITS_MIGRATION%.php}" \
  || fail "Member Benefits migration was not recorded as applied."

printf 'Member Benefits & Resources migration [OK]\n'

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${SAVED_BENEFITS_MIGRATION%.php}" \
  || fail "Saved Benefits migration was not recorded as applied."

printf 'Saved Benefits migration [OK]\n'

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${BENEFIT_REMINDER_MIGRATION%.php}" \
  || fail "Benefit Reminder migration was not recorded as applied."

printf 'Benefit Reminder migration [OK]\n'

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${ENTERPRISE_MIGRATION%.php}" \
  || fail "Enterprise Platform migration was not recorded as applied."

printf 'Enterprise Platform migration [OK]\n'

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${ENTERPRISE_GOALS_MIGRATION%.php}" \
  || fail "Enterprise Goals migration was not recorded as applied."

printf 'Enterprise Goals migration [OK]\n'

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${ENTERPRISE_INVITATIONS_MIGRATION%.php}" \
  || fail "Enterprise Invitations migration was not recorded as applied."

printf 'Enterprise Invitations migration [OK]\n'

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${ENTERPRISE_OUTCOMES_MIGRATION%.php}" \
  || fail "Enterprise Outcomes migration was not recorded as applied."

printf 'Enterprise Outcomes migration [OK]\n'

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${ENTERPRISE_SUPPORT_MIGRATION%.php}" \
  || fail "Enterprise Support migration was not recorded as applied."

printf 'Enterprise Support migration [OK]\n'

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${MEMBERSHIP_ADMIN_MIGRATION%.php}" \
  || fail "Membership Administration migration was not recorded as applied."

printf 'Membership Administration workflow migration [OK]\n'

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${MEMBERSHIP_ONBOARDING_MIGRATION%.php}" \
  || fail "Membership Onboarding migration was not recorded as applied."

printf 'Membership Onboarding migration [OK]\n'

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" migration-applied "${SUPPORT_CASES_MIGRATION%.php}" \
  || fail "Support Cases migration was not recorded as applied."

printf 'Support Cases migration [OK]\n'

















"$PHP_BIN" artisan optimize:clear

say "Verifying adaptive NurseLink user_id columns"

"$PHP_BIN" "$SCRIPT_DIR/db_compat_check.php" \
  "$API_ROOT" verify-user-id-tables \
  nurselink_employment_histories \
  nurselink_credentials_registry \
  nurselink_portfolio_items \
  nurselink_career_preferences \
  nurselink_learning_records \
  nurselink_saved_jobs \
  nurselink_job_applications \
  nurselink_reviewer_access \
  nurselink_memberships \
  nurselink_notifications \
  nurselink_public_profiles \
  nurselink_partner_access \
  nurselink_partner_audit \
  nurselink_application_messages \
  nurselink_interviews \
  nurselink_career_intelligence_snapshots \
  nurselink_super_admin_access \
  nurselink_benefit_requests \
  nurselink_saved_benefits \
  nurselink_benefit_reminder_log \
  nurselink_enterprise_cohort_members \
  nurselink_enterprise_cohort_progress \
  nurselink_enterprise_cohort_invitations \
  nurselink_enterprise_cohort_outcomes \
  nurselink_enterprise_support_checkins

say "Verifying live auth/CORS preflight"

CURL_BIN="$(command -v curl || true)"
[[ -n "$CURL_BIN" ]] || fail "curl is required for live CORS verification."

check_preflight() {
  local path="$1"
  local requested_method="$2"
  local requested_headers="$3"
  local headers_file
  local status

  headers_file="$(mktemp)"

  status="$("$CURL_BIN" -sS -o /dev/null -D "$headers_file" -w '%{http_code}' \
    -X OPTIONS \
    -H "Origin: https://app.amsertech.com" \
    -H "Access-Control-Request-Method: $requested_method" \
    -H "Access-Control-Request-Headers: $requested_headers" \
    "https://api.amsertech.com$path")"

  if [[ "$status" != "200" && "$status" != "204" ]]; then
    cat "$headers_file" >&2 || true
    rm -f "$headers_file"
    fail "CORS preflight failed for $path with HTTP $status."
  fi

  grep -Eiq '^Access-Control-Allow-Origin:[[:space:]]*https://app\.amsertech\.com[[:space:]]*$' "$headers_file" \
    || { cat "$headers_file" >&2; rm -f "$headers_file"; fail "Missing Access-Control-Allow-Origin for $path."; }

  grep -Eiq '^Access-Control-Allow-Credentials:[[:space:]]*true[[:space:]]*$' "$headers_file" \
    || { cat "$headers_file" >&2; rm -f "$headers_file"; fail "Missing credentialed CORS header for $path."; }

  if grep -Eiq '^Location:' "$headers_file"; then
    cat "$headers_file" >&2 || true
    rm -f "$headers_file"
    fail "Preflight for $path is still redirecting."
  fi

  rm -f "$headers_file"
  printf 'CORS %s %s [OK]\n' "$requested_method" "$path"
}

check_preflight "/login" "POST" "content-type,x-xsrf-token"
check_preflight "/sanctum/csrf-cookie" "GET" "x-requested-with"
check_preflight "/api/me" "GET" "content-type,x-xsrf-token"

say "Verifying real Sanctum/CORS responses"

COOKIE_JAR="$(mktemp)"
CSRF_HEADERS="$(mktemp)"
ME_HEADERS="$(mktemp)"
trap 'rm -f "$COOKIE_JAR" "$CSRF_HEADERS" "$ME_HEADERS"' EXIT

CSRF_STATUS="$("$CURL_BIN" -sS -o /dev/null -D "$CSRF_HEADERS" -c "$COOKIE_JAR" -w '%{http_code}' \
  -H "Origin: https://app.amsertech.com" \
  -H "Accept: application/json" \
  "https://api.amsertech.com/sanctum/csrf-cookie")"

if [[ "$CSRF_STATUS" != "200" && "$CSRF_STATUS" != "204" ]]; then
  cat "$CSRF_HEADERS" >&2 || true
  fail "Real Sanctum CSRF-cookie request failed with HTTP $CSRF_STATUS."
fi

grep -Eiq '^Access-Control-Allow-Origin:[[:space:]]*https://app\.amsertech\.com[[:space:]]*$' "$CSRF_HEADERS" \
  || { cat "$CSRF_HEADERS" >&2; fail "Real csrf-cookie response is missing Access-Control-Allow-Origin."; }

grep -Eiq '^Access-Control-Allow-Credentials:[[:space:]]*true[[:space:]]*$' "$CSRF_HEADERS" \
  || { cat "$CSRF_HEADERS" >&2; fail "Real csrf-cookie response is missing Access-Control-Allow-Credentials."; }

grep -Eiq '^Set-Cookie:[[:space:]]*XSRF-TOKEN=' "$CSRF_HEADERS" \
  || { cat "$CSRF_HEADERS" >&2; fail "Sanctum did not issue XSRF-TOKEN."; }

if grep -Eiq '^Location:' "$CSRF_HEADERS"; then
  cat "$CSRF_HEADERS" >&2 || true
  fail "Real csrf-cookie request is redirecting."
fi

printf 'CORS GET /sanctum/csrf-cookie real response [OK]\n'

ME_STATUS="$("$CURL_BIN" -sS -o /dev/null -D "$ME_HEADERS" -b "$COOKIE_JAR" -w '%{http_code}' \
  -H "Origin: https://app.amsertech.com" \
  -H "Accept: application/json" \
  "https://api.amsertech.com/api/me")"

if [[ "$ME_STATUS" != "401" && "$ME_STATUS" != "403" ]]; then
  cat "$ME_HEADERS" >&2 || true
  fail "Unauthenticated /api/me should return 401/403, received HTTP $ME_STATUS."
fi

grep -Eiq '^Access-Control-Allow-Origin:[[:space:]]*https://app\.amsertech\.com[[:space:]]*$' "$ME_HEADERS" \
  || { cat "$ME_HEADERS" >&2; fail "Unauthenticated /api/me lacks CORS origin header."; }

grep -Eiq '^Access-Control-Allow-Credentials:[[:space:]]*true[[:space:]]*$' "$ME_HEADERS" \
  || { cat "$ME_HEADERS" >&2; fail "Unauthenticated /api/me lacks credentialed CORS header."; }

if grep -Eiq '^Location:' "$ME_HEADERS"; then
  cat "$ME_HEADERS" >&2 || true
  fail "Unauthenticated /api/me is redirecting instead of returning authorization status."
fi

printf 'CORS GET /api/me authorization response %s [OK]\n' "$ME_STATUS"

say "Verifying LiteSpeed-safe session bootstrap endpoint"

BOOTSTRAP_HEADERS="$(mktemp)"
BOOTSTRAP_BODY="$(mktemp)"

BOOTSTRAP_STATUS="$("$CURL_BIN" -sS -o "$BOOTSTRAP_BODY" -D "$BOOTSTRAP_HEADERS" -w '%{http_code}' \
  -X GET \
  -H "Origin: https://app.amsertech.com" \
  -H "Accept: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  "https://api.amsertech.com/api/nurselink/session-bootstrap")"

if [[ "$BOOTSTRAP_STATUS" != "200" ]]; then
  cat "$BOOTSTRAP_HEADERS" >&2 || true
  cat "$BOOTSTRAP_BODY" >&2 || true
  rm -f "$BOOTSTRAP_HEADERS" "$BOOTSTRAP_BODY"
  fail "Session-bootstrap endpoint failed with HTTP $BOOTSTRAP_STATUS."
fi

grep -Eiq '^Access-Control-Allow-Origin:[[:space:]]*https://app\.amsertech\.com[[:space:]]*$' "$BOOTSTRAP_HEADERS" \
  || {
       cat "$BOOTSTRAP_HEADERS" >&2
       rm -f "$BOOTSTRAP_HEADERS" "$BOOTSTRAP_BODY"
       fail "Session-bootstrap endpoint lacks NurseLink CORS header."
     }

grep -Eiq '^Set-Cookie:[[:space:]]*(laravel_session|nurselink_session|XSRF-TOKEN)=' "$BOOTSTRAP_HEADERS" \
  || {
       cat "$BOOTSTRAP_HEADERS" >&2
       rm -f "$BOOTSTRAP_HEADERS" "$BOOTSTRAP_BODY"
       fail "Session-bootstrap endpoint did not expire auth/XSRF cookies."
     }

grep -q '"bootstrap":true' "$BOOTSTRAP_BODY" \
  || {
       cat "$BOOTSTRAP_BODY" >&2
       rm -f "$BOOTSTRAP_HEADERS" "$BOOTSTRAP_BODY"
       fail "Session-bootstrap endpoint returned an unexpected response."
     }

printf 'LiteSpeed-safe session bootstrap endpoint [OK]\n'

say "Verifying redirect-free NurseLink JSON session login"

LOGIN_COOKIE_JAR="$(mktemp)"
LOGIN_HEADERS="$(mktemp)"
LOGIN_BODY="$(mktemp)"

"$CURL_BIN" -sS -o /dev/null -c "$LOGIN_COOKIE_JAR" \
  -H "Origin: https://app.amsertech.com" \
  -H "Accept: application/json" \
  "https://api.amsertech.com/sanctum/csrf-cookie" \
  || fail "Unable to create JSON-login probe session."

XSRF_RAW="$(awk '$6=="XSRF-TOKEN" {print $7}' "$LOGIN_COOKIE_JAR" | tail -n1)"
[[ -n "$XSRF_RAW" ]] || fail "JSON-login probe did not receive XSRF-TOKEN."

XSRF_TOKEN="$(python3 - "$XSRF_RAW" <<'PY'
import sys
from urllib.parse import unquote
print(unquote(sys.argv[1]))
PY
)"

PROBE_EMAIL="nurselink-probe-$(date +%s)@invalid.test"

LOGIN_STATUS="$("$CURL_BIN" -sS -o "$LOGIN_BODY" -D "$LOGIN_HEADERS" -b "$LOGIN_COOKIE_JAR" -w '%{http_code}' \
  -X POST \
  -H "Origin: https://app.amsertech.com" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "X-XSRF-TOKEN: $XSRF_TOKEN" \
  --data "{\"email\":\"$PROBE_EMAIL\",\"password\":\"NurseLinkProbeInvalid123!\"}" \
  "https://api.amsertech.com/api/nurselink/session-login")"

if [[ "$LOGIN_STATUS" != "422" && "$LOGIN_STATUS" != "401" ]]; then
  cat "$LOGIN_HEADERS" >&2 || true
  cat "$LOGIN_BODY" >&2 || true
  fail "JSON session-login probe expected 401/422, received HTTP $LOGIN_STATUS."
fi

grep -Eiq '^Content-Type:[[:space:]]*application/json' "$LOGIN_HEADERS" \
  || { cat "$LOGIN_HEADERS" >&2; fail "JSON session-login endpoint did not return JSON."; }

grep -Eiq '^Access-Control-Allow-Origin:[[:space:]]*https://app\.amsertech\.com[[:space:]]*$' "$LOGIN_HEADERS" \
  || { cat "$LOGIN_HEADERS" >&2; fail "JSON session-login endpoint lacks CORS header."; }

if grep -Eiq '^Location:' "$LOGIN_HEADERS"; then
  cat "$LOGIN_HEADERS" >&2 || true
  fail "JSON session-login endpoint redirected."
fi

printf 'Redirect-free JSON session-login endpoint %s [OK]\n' "$LOGIN_STATUS"

rm -f "$LOGIN_COOKIE_JAR" "$LOGIN_HEADERS" "$LOGIN_BODY"
rm -f "$BOOTSTRAP_HEADERS" "$BOOTSTRAP_BODY"
rm -f "$COOKIE_JAR" "$CSRF_HEADERS" "$ME_HEADERS"
trap - EXIT

say "Verifying cumulative API routes"

for route in \
  "api/profile-photo" \
  "api/employment-history" \
  "api/credential-registry" \
  "api/portfolio-items" \
  "api/career-preferences" \
  "api/learning-records" \
  "api/job-opportunities" \
  "api/saved-jobs" \
  "api/job-applications" \
  "api/reviewer/summary" \
  "api/reviewer/credentials" \
  "api/reviewer/job-applications" \
  "api/reviewer/job-opportunities" \
  "api/reviewer/membership-applications" \
  "api/membership/me" \
  "api/membership/verify" \
  "api/notifications" \
  "api/public-profile/settings" \
  "api/public-profile/{slug}" \
  "api/nurselink/session-bootstrap" \
  "api/nurselink/session-login" \
  "api/partner/me" \
  "api/partner/summary" \
  "api/partner/opportunities" \
  "api/partner/applications" \
  "api/reviewer/partner-organizations" \
  "api/reviewer/partner-access" \
  "api/job-applications/{application}/communications" \
  "api/job-applications/{application}/messages" \
  "api/partner/applications/{application}/communications" \
  "api/partner/applications/{application}/messages" \
  "api/partner/applications/{application}/interviews" \
  "api/partner/analytics" \
  "api/reviewer/institutional-analytics" \
  "api/reviewer/production-readiness"
do
  "$PHP_BIN" artisan route:list | grep -q "$route" || fail "API route missing: $route"
done

say "Verifying v3.0 production security boundaries"

grep -q "EnsureApprovedNurseLinkMember::class" "$API_ROOT/routes/api.php"   || fail "Approved-member server boundary is missing from API routes."

python3 - "$API_ROOT/routes/api.php" <<'PY'
from pathlib import Path
import re
import sys

text = Path(sys.argv[1]).read_text(encoding='utf-8')
m = re.search(
    r'/\* NURSELINK_CREDENTIAL_REGISTRY_V160_START \*/(.*?)/\* NURSELINK_CREDENTIAL_REGISTRY_V160_END \*/',
    text,
    re.S,
)

if not m:
    raise SystemExit('Credential Registry route block missing.')

block = m.group(1)

if 'EnsureApprovedNurseLinkMember' in block:
    raise SystemExit('Credential Registry is incorrectly approved-member only.')

for required in ('auth:sanctum', 'verified', 'active.user'):
    if required not in block:
        raise SystemExit('Credential Registry applicant boundary is incomplete.')

print('Applicant Credential Registry route boundary [OK]')
PY


grep -q "verification_status' => 'unverified'"   "$API_ROOT/app/Http/Controllers/Api/CredentialRegistryController.php"   || fail "Credential self-verification hardening is missing."

if grep -q "'verification_status' => \['required'"   "$API_ROOT/app/Http/Controllers/Api/CredentialRegistryController.php"
then
  fail "Credential member validation still accepts verification_status."
fi

grep -q "where('verification_status', 'verified')"   "$API_ROOT/app/Http/Controllers/Api/PublicProfileController.php"   || fail "Public profile is not restricted to verified credentials."

grep -q "https://app.amsertech.com"   "$API_ROOT/app/Http/Controllers/Api/PublicProfileController.php"   || fail "Public profile frontend share host is not configured."

printf 'Approved-member API boundary [OK]\n'
printf 'Credential reviewer-control boundary [OK]\n'
printf 'Verified-only public credentials [OK]\n'
printf 'Public profile app-host share URL [OK]\n'



for controller in \
  ProfilePhotoController \
  EmploymentHistoryController \
  CredentialRegistryController \
  PortfolioItemController \
  CareerPreferenceController \
  LearningRecordController \
  JobOpportunityController \
  SavedJobController \
  JobApplicationController \
  ReviewCenterController \
  MembershipController \
  MembershipReviewController \
  NotificationController \
  PublicProfileController \
  SessionBootstrapController \
  SessionLoginController \
  PartnerPortalController \
  PartnerAdminController \
  ApplicationCommunicationController \
  PartnerCommunicationController \
  PartnerAnalyticsController \
  InstitutionalAnalyticsController \
  ProductionReadinessController \
  OperationsCenterController \
  CareerIntelligenceController \
  SessionIdentityController \
  AdminSessionLoginController \
  AdminPortalController \
  AdminMembershipCommandController \
  AdminMemberRegistryController \
  SuperAdminTestModeController \
  AdminMembershipLifecycleController \
  CredentialRenewalController \
  EventsController \
  ChaptersController \
  MentoringController \
  EngagementController \
  MemberBenefitsController \
  BenefitIntelligenceController \
  BenefitReminderController \
  EngagementTimelineController \
  EnterprisePlatformController \
  EnterpriseGoalsController \
  EnterpriseEnrollmentController \
  EnterpriseOutcomesController \
  EnterpriseSupportController \
  MembershipAdministrationController \
  MembershipOnboardingController \
  AdministrationOperationsCenterController
do
  "$PHP_BIN" artisan route:list | grep -q "$controller" || fail "Controller route missing: $controller"
done

"$PHP_BIN" artisan route:list | grep -q "reviewer/operations-center" \
  || fail "Operations Center route family missing."

grep -q "class OperationsCenterController" \
  "$API_ROOT/app/Http/Controllers/Api/OperationsCenterController.php" \
  || fail "Operations Center controller implementation missing."

printf 'Operations Center API routes [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "career-intelligence" \
  || fail "Career Intelligence route family missing."

grep -q "EnsureApprovedNurseLinkMember::class" "$API_ROOT/routes/api.php" \
  || fail "Approved-member middleware missing from cumulative API routes."

grep -q "NURSELINK_CAREER_INTELLIGENCE_V420_START" "$API_ROOT/routes/api.php" \
  || fail "Career Intelligence route marker missing."

printf 'Career Intelligence member-only API routes [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "nurselink/session-identity" \
  || fail "Session identity API route missing."

grep -q "class SessionIdentityController" \
  "$API_ROOT/app/Http/Controllers/Api/SessionIdentityController.php" \
  || fail "Session identity controller implementation missing."

grep -q "nurselink_super_admin_access" \
  "$API_ROOT/app/Http/Controllers/Api/SessionIdentityController.php" \
  || fail "Session identity is not connected to Super Administrator access."

printf 'Server-confirmed session identity API [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/session-login" \
  || fail "Separate Administrator session-login route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/dashboard" \
  || fail "Administrator Dashboard API route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/users" \
  || fail "Administrator Users & Access route family missing."

grep -q "nurselink_admin_elevated_user_id" \
  "$API_ROOT/app/Http/Controllers/Api/AdminSessionLoginController.php" \
  || fail "Separate administrator session elevation marker missing."

grep -q "A separate NurseLink administrator sign-in is required" \
  "$API_ROOT/app/Http/Controllers/Api/AdminPortalController.php" \
  || fail "Administrator Portal is not enforcing separate sign-in."

grep -q "Super Administrator access is required to manage staff roles" \
  "$API_ROOT/app/Http/Controllers/Api/AdminPortalController.php" \
  || fail "Staff role changes are not restricted to Super Administrators."

grep -q "cannot revoke their own access" \
  "$API_ROOT/app/Http/Controllers/Api/AdminPortalController.php" \
  || fail "Super Administrator self-revocation protection missing."

grep -q "last active Super Administrator" \
  "$API_ROOT/app/Http/Controllers/Api/AdminPortalController.php" \
  || fail "Last Super Administrator protection missing."

printf 'Separate Administrator authentication [OK]\n'
printf 'Administrator Users & Access API [OK]\n'
printf 'Super Administrator access-control protections [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/membership-command/summary" \
  || fail "Membership Command Center summary route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/membership-command/{id}/transition" \
  || fail "Membership Command Center transition route missing."

grep -q "approval_requires_ready_for_approval" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMembershipCommandController.php" \
  || fail "Membership approval readiness gate missing."

grep -q "Administrator access is required for final membership decisions" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMembershipCommandController.php" \
  || fail "Final membership decisions are not administrator-restricted."

grep -q "membership.self_action_super_admin" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMembershipCommandController.php" \
  || fail "Super Administrator self-action audit marker missing."

grep -q "decision reason is required" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMembershipCommandController.php" \
  || fail "Membership decision-reason requirement missing."

grep -q "NL-%s-%06d" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMembershipCommandController.php" \
  || fail "Permanent NurseLink member-number generator missing."

printf 'Membership command API [OK]\n'
printf 'Membership approval governance [OK]\n'
printf 'Membership self-action audit protection [OK]\n'

grep -q "A separate NurseLink administrator sign-in is required for membership review" \
  "$API_ROOT/app/Http/Controllers/Api/MembershipReviewController.php" \
  || fail "Legacy membership-review API does not require Administrator Portal elevation."

grep -q "Self-actions must use the Membership Command Center" \
  "$API_ROOT/app/Http/Controllers/Api/MembershipReviewController.php" \
  || fail "Legacy membership-review API can bypass self-action governance."

grep -q "Administrator access is required for final membership decisions" \
  "$API_ROOT/app/Http/Controllers/Api/MembershipReviewController.php" \
  || fail "Legacy membership-review API can bypass final-decision role governance."

printf 'Legacy membership-review bypass protection [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/member-registry/summary" \
  || fail "Member Registry summary route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/member-registry/{membershipId}" \
  || fail "Member Registry detail route missing."

grep -q "Administrator access is required for the approved-member registry" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMemberRegistryController.php" \
  || fail "Member Registry is not restricted to Administrator-level access."

grep -q "'registry_is_read_only' => true" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMemberRegistryController.php" \
  || fail "Member Registry read-only declaration missing."

grep -q "'credential_numbers_exposed' => false" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMemberRegistryController.php" \
  || fail "Member Registry credential-number privacy boundary missing."

grep -q "'uploaded_documents_exposed' => false" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMemberRegistryController.php" \
  || fail "Member Registry document privacy boundary missing."

printf 'Approved Member Registry API [OK]\n'
printf 'Member Registry privacy boundary [OK]\n'
printf 'Member Registry read-only scope [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/test-mode/session" \
  || fail "Super Administrator Test Mode session route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/test-mode/start" \
  || fail "Super Administrator Test Mode start route missing."

grep -q "membership_status_mutated' => false" \
  "$API_ROOT/app/Http/Controllers/Api/SuperAdminTestModeController.php" \
  || fail "Test Mode does not explicitly preserve real membership status."

grep -q "partner_tenant_bypass' => false" \
  "$API_ROOT/app/Http/Controllers/Api/SuperAdminTestModeController.php" \
  || fail "Test Mode partner-tenant boundary declaration missing."

grep -q "super_admin.test_mode_started" \
  "$API_ROOT/app/Http/Controllers/Api/SuperAdminTestModeController.php" \
  || fail "Test Mode start audit marker missing."

grep -q "super_admin.test_mode_stopped" \
  "$API_ROOT/app/Http/Controllers/Api/SuperAdminTestModeController.php" \
  || fail "Test Mode stop audit marker missing."

grep -q "X-NurseLink-Test-Mode" \
  "$API_ROOT/app/Http/Middleware/EnsureApprovedNurseLinkMember.php" \
  || fail "Approved-member middleware Test Mode marker missing."

grep -q "superAdminTestModeActive" \
  "$API_ROOT/app/Http/Middleware/EnsureApprovedNurseLinkMember.php" \
  || fail "Approved-member middleware Test Mode gate missing."

printf 'Super Administrator Test Mode API [OK]\n'
printf 'Super Administrator member-gate test bypass [OK]\n'
printf 'Super Administrator Test Mode audit [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/membership-lifecycle/summary" \
  || fail "Membership Lifecycle summary route missing."

"$PHP_BIN" artisan route:list | grep -q "membership-lifecycle/{membershipId}/standing" \
  || fail "Membership Lifecycle standing transition route missing."

grep -q "Administrator access is required to manage membership standing" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMembershipLifecycleController.php" \
  || fail "Membership Lifecycle administrator gate missing."

grep -q "standing_self_action_super_admin" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMembershipLifecycleController.php" \
  || fail "Membership Lifecycle self-action audit marker missing."

grep -q "Active NurseLink membership standing is required" \
  "$API_ROOT/app/Http/Middleware/EnsureApprovedNurseLinkMember.php" \
  || fail "Member-only middleware is not enforcing Active standing."

grep -Fq "\$update['standing'] = 'active';" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMembershipCommandController.php" \
  || fail "Membership approval does not initialize Active standing."

grep -Fq "\$update['standing'] = 'active';" \
  "$API_ROOT/app/Http/Controllers/Api/MembershipReviewController.php" \
  || fail "Legacy membership approval does not initialize Active standing."

grep -q "standing === ''" \
  "$API_ROOT/app/Http/Controllers/Api/PublicProfileController.php" \
  || fail "Public professional profile standing compatibility check missing."

grep -q "standing === 'active'" \
  "$API_ROOT/app/Http/Controllers/Api/PublicProfileController.php" \
  || fail "Public professional profile is not restricted to Active standing."

printf 'Membership Lifecycle API [OK]\n'
printf 'Active-standing member access enforcement [OK]\n'
printf 'Membership standing audit governance [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "credential-renewal" \
  || fail "Credential Renewal routes missing."

grep -q "Expires within 30 days" \
  "$API_ROOT/app/Http/Controllers/Api/CredentialRenewalController.php" \
  || fail "Credential Renewal 30-day expiry classification missing."

grep -q "Expires within 90 days" \
  "$API_ROOT/app/Http/Controllers/Api/CredentialRenewalController.php" \
  || fail "Credential Renewal 90-day expiry classification missing."

grep -q "Expires within 180 days" \
  "$API_ROOT/app/Http/Controllers/Api/CredentialRenewalController.php" \
  || fail "Credential Renewal 180-day planning classification missing."

grep -q "credential_numbers_exposed' => false" \
  "$API_ROOT/app/Http/Controllers/Api/CredentialRenewalController.php" \
  || fail "Credential Renewal administrator privacy boundary missing."

grep -q "Administrator access is required for credential renewal monitoring" \
  "$API_ROOT/app/Http/Controllers/Api/CredentialRenewalController.php" \
  || fail "Credential Renewal administrator authorization missing."

printf 'Credential Renewal API [OK]\n'
printf 'Credential expiry intelligence [OK]\n'
printf 'Credential Renewal privacy boundary [OK]\n'

grep -q "credential_renewal.started" \
  "$API_ROOT/app/Http/Controllers/Api/CredentialRenewalController.php" \
  || fail "Credential Renewal start audit missing."

grep -q "credential_renewal.updated" \
  "$API_ROOT/app/Http/Controllers/Api/CredentialRenewalController.php" \
  || fail "Credential Renewal member update audit missing."

grep -q "credential_renewal.admin_status_changed" \
  "$API_ROOT/app/Http/Controllers/Api/CredentialRenewalController.php" \
  || fail "Credential Renewal administrator audit missing."

grep -q "official_renewal_certification" \
  "$API_ROOT/app/Http/Controllers/Api/CredentialRenewalController.php" \
  || fail "Credential Renewal governance disclaimer missing."

"$PHP_BIN" artisan route:list | grep -q "credential-renewal/{credentialId}/{renewalId}" \
  || fail "Credential Renewal member workflow update route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/credential-renewal/{renewalId}" \
  || fail "Credential Renewal administrator workflow route missing."

printf 'Credential Renewal workflow governance [OK]\n'
printf 'Credential Renewal workflow audit [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "events/{eventId}/register" \
  || fail "Member event registration route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/events/{eventId}/registrations" \
  || fail "Administrator event registrations route missing."

grep -q "Administrator access is required for event management" \
  "$API_ROOT/app/Http/Controllers/Api/EventsController.php" \
  || fail "Event Management administrator gate missing."

grep -q "cpd_units_are_official' => false" \
  "$API_ROOT/app/Http/Controllers/Api/EventsController.php" \
  || fail "Event CPD governance boundary missing."

grep -q "event.registration_status_changed" \
  "$API_ROOT/app/Http/Controllers/Api/EventsController.php" \
  || fail "Event attendance/registration audit missing."

printf 'Events & Programs API [OK]\n'
printf 'Event registration workflow [OK]\n'
printf 'Event Management governance [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "chapters/{chapterId}/request" \
  || fail "Member chapter request route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/chapters/{chapterId}/members" \
  || fail "Administrator chapter roster route missing."

grep -q "Administrator access is required for chapter management" \
  "$API_ROOT/app/Http/Controllers/Api/ChaptersController.php" \
  || fail "Chapter Management administrator gate missing."

grep -q "chapter.membership_status_changed" \
  "$API_ROOT/app/Http/Controllers/Api/ChaptersController.php" \
  || fail "Chapter membership audit missing."

grep -q "Only an Active chapter membership can be marked primary" \
  "$API_ROOT/app/Http/Controllers/Api/ChaptersController.php" \
  || fail "Primary chapter governance rule missing."

grep -q "activeChapterIds" \
  "$API_ROOT/app/Http/Controllers/Api/EventsController.php" \
  || fail "Chapter-specific Event visibility restriction missing."

printf 'Chapters & Communities API [OK]\n'
printf 'Chapter membership governance [OK]\n'
printf 'Chapter-specific Events linkage [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "mentoring/requests/{requestId}" \
  || fail "Mentoring request workflow route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/mentoring/summary" \
  || fail "Mentoring administrator analytics route missing."

grep -q "mentor_role_is_official_credential" \
  "$API_ROOT/app/Http/Controllers/Api/MentoringController.php" \
  || fail "Mentoring governance boundary missing."

grep -q "email_exposed' => false" \
  "$API_ROOT/app/Http/Controllers/Api/MentoringController.php" \
  || fail "Mentoring directory privacy boundary missing."

grep -q "Only the requested mentor can accept or decline" \
  "$API_ROOT/app/Http/Controllers/Api/MentoringController.php" \
  || fail "Mentoring acceptance authorization missing."

printf 'Mentoring & Peer Support API [OK]\n'
printf 'Mentoring privacy boundary [OK]\n'
printf 'Mentoring request governance [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "api/engagement" \
  || fail "Member Engagement summary route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/engagement/summary" \
  || fail "Engagement administrator summary route missing."

grep -q "engagement_is_professional_credential" \
  "$API_ROOT/app/Http/Controllers/Api/EngagementController.php" \
  || fail "Engagement governance advisory missing."

grep -q "aggregate_only' => true" \
  "$API_ROOT/app/Http/Controllers/Api/EngagementController.php" \
  || fail "Engagement administrator aggregate privacy boundary missing."

grep -q "mentoring_messages_exposed' => false" \
  "$API_ROOT/app/Http/Controllers/Api/EngagementController.php" \
  || fail "Engagement mentoring privacy boundary missing."

printf 'Member Engagement API [OK]\n'
printf 'Engagement aggregate privacy [OK]\n'
printf 'Engagement governance advisory [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "benefits/{benefitId}/request" \
  || fail "Member Benefit request route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/benefits/{benefitId}/requests" \
  || fail "Benefit Management request queue route missing."

grep -q "membership_eligibility_guaranteed" \
  "$API_ROOT/app/Http/Controllers/Api/MemberBenefitsController.php" \
  || fail "Member benefit eligibility advisory missing."

grep -q "provider_endorsement_implied" \
  "$API_ROOT/app/Http/Controllers/Api/MemberBenefitsController.php" \
  || fail "Member benefit provider endorsement boundary missing."

grep -q "Only an Approved benefit request can be marked Fulfilled" \
  "$API_ROOT/app/Http/Controllers/Api/MemberBenefitsController.php" \
  || fail "Benefit fulfillment transition governance missing."

grep -q "uploaded_documents_exposed' => false" \
  "$API_ROOT/app/Http/Controllers/Api/MemberBenefitsController.php" \
  || fail "Benefit Management privacy boundary missing."

printf 'Member Benefits & Resources API [OK]\n'
printf 'Benefit request governance [OK]\n'
printf 'Benefit Management privacy [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "benefits/intelligence" \
  || fail "Benefit Intelligence member summary route missing."

"$PHP_BIN" artisan route:list | grep -q "benefits/{benefitId}/save" \
  || fail "Saved Benefit member route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/benefits/summary" \
  || fail "Benefit Analytics administrator route missing."

grep -q "saved_benefit_ids" \
  "$API_ROOT/app/Http/Controllers/Api/BenefitIntelligenceController.php" \
  || fail "Saved Benefits member intelligence missing."

grep -q "ending_within_7_days" \
  "$API_ROOT/app/Http/Controllers/Api/BenefitIntelligenceController.php" \
  || fail "Benefit 7-day availability intelligence missing."

grep -q "ending_within_30_days" \
  "$API_ROOT/app/Http/Controllers/Api/BenefitIntelligenceController.php" \
  || fail "Benefit 30-day availability intelligence missing."

grep -q "aggregate_only' => true" \
  "$API_ROOT/app/Http/Controllers/Api/BenefitIntelligenceController.php" \
  || fail "Benefit Analytics aggregate privacy boundary missing."

printf 'Saved Benefits API [OK]\n'
printf 'Benefit availability intelligence [OK]\n'
printf 'Benefit Analytics aggregate privacy [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "benefits/reminders" \
  || fail "Member Benefit Reminder route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/benefits/reminders/generate" \
  || fail "Benefit Reminder generation route missing."

grep -q "skipped_duplicate" \
  "$API_ROOT/app/Services/BenefitReminderService.php" \
  || fail "Benefit Reminder de-duplication missing."

grep -q "m.standing" \
  "$API_ROOT/app/Services/BenefitReminderService.php" \
  || fail "Benefit Reminder Active standing gate missing."

grep -q "automatic_cron_created" \
  "$API_ROOT/app/Http/Controllers/Api/BenefitReminderController.php" \
  || fail "Benefit Reminder cron governance boundary missing."

grep -q "aggregate_only' => true" \
  "$API_ROOT/app/Http/Controllers/Api/BenefitReminderController.php" \
  || fail "Benefit Reminder admin privacy boundary missing."

printf 'Benefit Reminder API [OK]\n'
printf 'Benefit Reminder de-duplication [OK]\n'
printf 'Benefit Reminder Active standing gate [OK]\n'
printf 'Benefit Reminder privacy + cron governance [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "engagement/timeline" \
  || fail "Member Engagement Timeline route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/engagement/activity-summary" \
  || fail "Administrator Engagement Activity route missing."

grep -q "private_messages_exposed" \
  "$API_ROOT/app/Http/Controllers/Api/EngagementTimelineController.php" \
  || fail "Engagement Timeline member privacy boundary missing."

grep -q "member_notes_exposed" \
  "$API_ROOT/app/Http/Controllers/Api/EngagementTimelineController.php" \
  || fail "Engagement Timeline private-note exclusion missing."

grep -q "aggregate_only' => true" \
  "$API_ROOT/app/Http/Controllers/Api/EngagementTimelineController.php" \
  || fail "Engagement Activity aggregate privacy boundary missing."

grep -q "user_ids_exposed' => false" \
  "$API_ROOT/app/Http/Controllers/Api/EngagementTimelineController.php" \
  || fail "Engagement Activity user-id privacy boundary missing."

printf 'Member Engagement Timeline API [OK]\n'
printf 'Engagement Timeline privacy [OK]\n'
printf 'Engagement Activity aggregate analytics [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "enterprise/me" \
  || fail "Enterprise member route missing."

"$PHP_BIN" artisan route:list | grep -q "partner/enterprise" \
  || fail "Enterprise partner route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/enterprise/cohorts" \
  || fail "Enterprise administrator cohort routes missing."

grep -q "Only an approved NurseLink member can be assigned" \
  "$API_ROOT/app/Http/Controllers/Api/EnterprisePlatformController.php" \
  || fail "Enterprise cohort Approved-member assignment boundary missing."

grep -q "aggregate_only' => true" \
  "$API_ROOT/app/Http/Controllers/Api/EnterprisePlatformController.php" \
  || fail "Enterprise partner aggregate privacy boundary missing."

grep -q "member_identity_included' => false" \
  "$API_ROOT/app/Http/Controllers/Api/EnterprisePlatformController.php" \
  || fail "Enterprise partner identity privacy boundary missing."

grep -q "administrator_only_roster' => true" \
  "$API_ROOT/app/Http/Controllers/Api/EnterprisePlatformController.php" \
  || fail "Enterprise administrator roster boundary missing."

grep -q "employment_relationship_implied" \
  "$API_ROOT/app/Http/Controllers/Api/EnterprisePlatformController.php" \
  || fail "Enterprise governance boundary missing."

printf 'Enterprise member cohort API [OK]\n'
printf 'Enterprise administrator cohort management [OK]\n'
printf 'Enterprise partner aggregate analytics [OK]\n'
printf 'Enterprise privacy + governance [OK]\n'

grep -q "enterprise_cohorts_total" \
  "$API_ROOT/app/Http/Controllers/Api/InstitutionalAnalyticsController.php" \
  || fail "Institutional Analytics enterprise cohort aggregation missing."

grep -q "enterprise_assignments_total" \
  "$API_ROOT/app/Http/Controllers/Api/InstitutionalAnalyticsController.php" \
  || fail "Institutional Analytics enterprise assignment aggregation missing."

printf 'Institutional Enterprise Analytics [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "enterprise/goals/{goalId}/progress" \
  || fail "Enterprise member goal progress route missing."

"$PHP_BIN" artisan route:list | grep -q "partner/enterprise/goals" \
  || fail "Enterprise partner goal analytics route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/enterprise/cohorts/{cohortId}/goals" \
  || fail "Enterprise administrator goal routes missing."

grep -q "self_reported_progress" \
  "$API_ROOT/app/Http/Controllers/Api/EnterpriseGoalsController.php" \
  || fail "Enterprise goal self-report governance missing."

grep -q "minimum_aggregate_cohort_size" \
  "$API_ROOT/app/Http/Controllers/Api/EnterpriseGoalsController.php" \
  || fail "Enterprise goal partner small-cohort privacy missing."

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/EnterpriseGoalsController.php" \
  <<'PYGOALPRIV502'
from pathlib import Path
import sys

text = " ".join(
    Path(sys.argv[1]).read_text(
        encoding="utf-8"
    ).split()
)

required = (
    "'aggregate_only' => true",
    "'member_identity_included' => false",
    "'member_notes_included' => false",
    "'member_contact_details_included' => false",
    "'small_cohort_metrics_suppressed' => true",
    "'minimum_aggregate_cohort_size' => 3",
)

for item in required:
    if item not in text:
        raise SystemExit(
            "Enterprise goal partner privacy requirement missing: "
            + item
        )

print(
    "Enterprise goal partner privacy normalized validator [OK]"
)
PYGOALPRIV502

grep -q "administrator_only_detail" \
  "$API_ROOT/app/Http/Controllers/Api/EnterpriseGoalsController.php" \
  || fail "Enterprise goal administrator detail boundary missing."

printf 'Enterprise member goal progress API [OK]\n'
printf 'Enterprise administrator goal management [OK]\n'
printf 'Enterprise partner goal analytics [OK]\n'
printf 'Enterprise goal privacy + governance [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "enterprise/invitations/{invitationId}/respond" \
  || fail "Enterprise member invitation response route missing."

"$PHP_BIN" artisan route:list | grep -q "partner/enterprise/enrollment-summary" \
  || fail "Enterprise partner enrollment reporting route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/enterprise/enrollment-summary" \
  || fail "Enterprise administrator enrollment summary route missing."

grep -q "Only an Approved + Active NurseLink member can be invited" \
  "$API_ROOT/app/Http/Controllers/Api/EnterpriseEnrollmentController.php" \
  || fail "Enterprise invitation Approved + Active member boundary missing."

grep -q "invitation_is_employment_offer" \
  "$API_ROOT/app/Http/Controllers/Api/EnterpriseEnrollmentController.php" \
  || fail "Enterprise invitation governance boundary missing."

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/EnterpriseEnrollmentController.php" \
  <<'PYENROLLPRIV503'
from pathlib import Path
import sys

text = " ".join(
    Path(sys.argv[1]).read_text(
        encoding="utf-8"
    ).split()
)

required = (
    "'aggregate_only' => true",
    "'member_identity_included' => false",
    "'member_contact_details_included' => false",
    "'member_notes_included' => false",
    "'small_cohort_metrics_suppressed' => true",
    "'minimum_aggregate_cohort_size' => 3",
    "'administrator_only_detail' => true",
    "'partner_access' => false",
)

for item in required:
    if item not in text:
        raise SystemExit(
            "Enterprise enrollment privacy requirement missing: "
            + item
        )

print(
    "Enterprise enrollment normalized privacy validator [OK]"
)
PYENROLLPRIV503

printf 'Enterprise invitation workflow API [OK]\n'
printf 'Enterprise enrollment organization reporting [OK]\n'
printf 'Enterprise enrollment privacy + governance [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "enterprise/outcomes" \
  || fail "Enterprise member outcomes route missing."

"$PHP_BIN" artisan route:list | grep -q "partner/enterprise/outcomes" \
  || fail "Enterprise partner outcomes route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/enterprise/cohorts/{cohortId}/outcomes" \
  || fail "Enterprise administrator outcomes routes missing."

grep -q "nurselink_internal_outcome" \
  "$API_ROOT/app/Http/Controllers/Api/EnterpriseOutcomesController.php" \
  || fail "Enterprise outcome governance declaration missing."

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/EnterpriseOutcomesController.php" \
  <<'PYOUTCOMEPRIV504'
from pathlib import Path
import sys

text = " ".join(
    Path(sys.argv[1]).read_text(
        encoding="utf-8"
    ).split()
)

required = (
    "'internal_notes_included' => false",
    "'other_member_outcomes_included' => false",
    "'administrator_only_detail' => true",
    "'partner_access_to_member_detail' => false",
    "'aggregate_only' => true",
    "'member_identity_included' => false",
    "'member_contact_details_included' => false",
    "'member_summary_included' => false",
    "'small_cohort_metrics_suppressed' => true",
    "'minimum_aggregate_cohort_size' => 3",
    "'official_certificate' => false",
    "'official_credential' => false",
)

for item in required:
    if item not in text:
        raise SystemExit(
            "Enterprise outcome privacy/governance requirement missing: "
            + item
        )

print(
    "Enterprise outcomes normalized privacy validator [OK]"
)
PYOUTCOMEPRIV504

printf 'Enterprise member outcomes API [OK]\n'
printf 'Enterprise administrator outcome review [OK]\n'
printf 'Enterprise partner aggregate outcomes [OK]\n'
printf 'Enterprise outcome privacy + governance [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "enterprise/support" \
  || fail "Enterprise member support routes missing."

"$PHP_BIN" artisan route:list | grep -q "partner/enterprise/support-summary" \
  || fail "Enterprise partner support analytics route missing."

"$PHP_BIN" artisan route:list | grep -q "nurselink/admin/enterprise/support" \
  || fail "Enterprise administrator support routes missing."

grep -q "support_record_is_employment_action" \
  "$API_ROOT/app/Http/Controllers/Api/EnterpriseSupportController.php" \
  || fail "Enterprise support governance declaration missing."

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/EnterpriseSupportController.php" \
  <<'PYSUPPORTPRIV505'
from pathlib import Path
import sys

text = " ".join(
    Path(sys.argv[1]).read_text(
        encoding="utf-8"
    ).split()
)

required = (
    "'member_own_records_only' => true",
    "'administrator_notes_included' => false",
    "'partner_access_to_member_notes' => false",
    "'administrator_only_detail' => true",
    "'partner_access_to_member_detail' => false",
    "'aggregate_only' => true",
    "'member_identity_included' => false",
    "'member_contact_details_included' => false",
    "'member_notes_included' => false",
    "'assigned_staff_included' => false",
    "'small_cohort_metrics_suppressed' => true",
    "'minimum_aggregate_cohort_size' => 3",
    "'employment_action_metrics' => false",
    "'disciplinary_action_metrics' => false",
    "'clinical_record_metrics' => false",
    "'regulatory_record_metrics' => false",
)

for item in required:
    if item not in text:
        raise SystemExit(
            "Enterprise support privacy/governance requirement missing: "
            + item
        )

print(
    "Enterprise support normalized privacy validator [OK]"
)
PYSUPPORTPRIV505

printf 'Enterprise member support workflow [OK]\n'
printf 'Enterprise administrator support triage [OK]\n'
printf 'Enterprise partner support analytics [OK]\n'
printf 'Enterprise support privacy + governance [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "membership-administration/overview" \
  || fail "Membership Administration overview route missing."

"$PHP_BIN" artisan route:list | grep -q "membership-administration/queue" \
  || fail "Membership Administration review queue route missing."

"$PHP_BIN" artisan route:list | grep -q "membership-administration/{membershipId}/assignment" \
  || fail "Membership Administration review assignment route missing."

grep -q "Administrator access is required for final membership decisions" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMembershipCommandController.php" \
  || fail "Final membership decision Administrator boundary missing."

grep -q "Membership must be Ready for Approval before final approval" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMembershipCommandController.php" \
  || fail "Ready-for-Approval hard gate missing."

grep -q "assigned_reviewer_user_id" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMembershipCommandController.php" \
  || fail "Automatic review ownership metadata integration missing."

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/MembershipAdministrationController.php" \
  "$API_ROOT/app/Http/Controllers/Api/AdminPortalController.php" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMembershipCommandController.php" \
  <<'PYMEMADMIN510'
from pathlib import Path
import sys

suite = " ".join(
    Path(sys.argv[1]).read_text(
        encoding="utf-8"
    ).split()
)
portal = " ".join(
    Path(sys.argv[2]).read_text(
        encoding="utf-8"
    ).split()
)
review = " ".join(
    Path(sys.argv[3]).read_text(
        encoding="utf-8"
    ).split()
)

suite_required = (
    "'can_final_decide' => $access['is_admin']",
    "'can_assign_reviews' => $access['is_admin']",
    "'can_manage_roles' => $access['is_super_admin']",
    "'role_assignment_requires_super_admin' => true",
    "'last_super_admin_protected' => true",
    "'separate_admin_sign_in_required' => true",
    "Only pending membership applications can be assigned for review.",
    "Assigned reviewer must have active Reviewer, Administrator or Super Administrator access.",
)

portal_required = (
    "'can_manage_access' => $access['is_super_admin']",
    "'cannot_revoke_self' => true",
    "'protect_last_super_admin' => true",
)

review_required = (
    "Administrator access is required for final membership decisions.",
    "Membership must be Ready for Approval before final approval.",
    "Explicit Super Administrator self-action confirmation is required.",
)

for item in suite_required:
    if item not in suite:
        raise SystemExit(
            "Membership Administration suite requirement missing: "
            + item
        )

for item in portal_required:
    if item not in portal:
        raise SystemExit(
            "Administrator role-governance requirement missing: "
            + item
        )

for item in review_required:
    if item not in review:
        raise SystemExit(
            "Membership-decision governance requirement missing: "
            + item
        )

print(
    "Membership Administration governance validator [OK]"
)
PYMEMADMIN510

printf 'Membership Administration API + governance [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "membership/onboarding" \
  || fail "Membership onboarding member routes missing."

"$PHP_BIN" artisan route:list | grep -q "membership-onboarding/summary" \
  || fail "Membership onboarding Administrator summary route missing."

grep -q "nurselink_membership_onboarding" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMembershipCommandController.php" \
  || fail "Membership approval-to-onboarding bridge missing."

grep -q "/nurselink-membership-welcome.html" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMembershipCommandController.php" \
  || fail "Approved-member Welcome Center notification link missing."

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/MembershipOnboardingController.php" \
  <<'PYONBOARD511'
from pathlib import Path
import sys

text = " ".join(
    Path(sys.argv[1]).read_text(
        encoding="utf-8"
    ).split()
)

required = (
    "'administrator_note_included' => false",
    "'assigned_admin_identity_included' => false",
    "'other_member_data_included' => false",
    "'onboarding_completion_is_official_credential' => false",
    "'onboarding_completion_is_licensure' => false",
    "'onboarding_completion_is_regulatory_status' => false",
    "Administrator access is required for membership onboarding management.",
    "Assigned onboarding owner must have active Administrator or Super Administrator access.",
)

for item in required:
    if item not in text:
        raise SystemExit(
            "Membership onboarding governance requirement missing: "
            + item
        )

print(
    "Membership Onboarding governance validator [OK]"
)
PYONBOARD511

printf 'Membership onboarding member workflow [OK]\n'
printf 'Membership onboarding Administrator workflow [OK]\n'
printf 'Membership onboarding governance [OK]\n'

"$PHP_BIN" artisan route:list | grep -q "operations-center/summary" \
  || fail "Administration Operations Center summary route missing."

"$PHP_BIN" artisan route:list | grep -q "operations-center/support-cases" \
  || fail "Administration Support Cases routes missing."

"$PHP_BIN" artisan route:list | grep -q "operations-center/communications" \
  || fail "Administration Communications route missing."

"$PHP_BIN" artisan route:list | grep -q "operations-center/audit-log" \
  || fail "Administration Audit Logs route missing."

"$PHP_BIN" artisan route:list | grep -q "operations-center/system-health" \
  || fail "Administration System Health route missing."

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/AdministrationOperationsCenterController.php" \
  "$PAYLOAD_DIR/api/database/migrations/$SUPPORT_CASES_MIGRATION" \
  <<'PYADMINOPS530'
from pathlib import Path
import sys

controller = " ".join(
    Path(sys.argv[1]).read_text(
        encoding="utf-8"
    ).split()
)

migration = Path(sys.argv[2]).read_text(
    encoding="utf-8"
)

required = (
    "'raw_database_administration' => false",
    "'workflow_api_required' => true",
    "Administrator access is required for Support Cases.",
    "Administrator access is required to send member communications.",
    "'message_body_excluded_from_audit' => true",
    "'raw_before_state_included' => false",
    "'raw_after_state_included' => false",
    "'database_credentials_exposed' => false",
    "'super_administrator_required_for_privileged_role_changes' => true",
)

for item in required:
    if item not in controller:
        raise SystemExit(
            "Administration Operations Center governance missing: "
            + item
        )

for item in (
    "nurselink_support_cases",
    "member_user_id",
    "assigned_admin_user_id",
    "created_by_user_id",
    "information_schema.COLUMNS",
):
    if item not in migration:
        raise SystemExit(
            "Support Cases migration requirement missing: "
            + item
        )

print(
    "Administration Operations Center governance validator [OK]"
)
PYADMINOPS530

printf 'Administration Operations Center workflow APIs [OK]\n'
printf 'Support Cases governance [OK]\n'
printf 'Controlled member communications [OK]\n'
printf 'Normalized audit log privacy [OK]\n'


printf 'Membership approval Administrator gate [OK]\n'
printf 'Super Administrator role-management gate [OK]\n'


























say "Installing v5.5.2 security-hardened web UI"

cp -f "$PAYLOAD_DIR/nurselink-mobile.js" "$WEB_ROOT/src/nurselink-mobile.js"
cp -f "$PAYLOAD_DIR/nurselink-admin-spa-rescue.js" "$WEB_ROOT/src/nurselink-admin-spa-rescue.js"

rm -rf "$WEB_ROOT/public/admin"
mkdir -p "$WEB_ROOT/public/admin"
cp -a "$PAYLOAD_DIR/admin/." "$WEB_ROOT/public/admin/" \
  || fail "Unable to copy physical Administrator directory into Vite public."

printf 'Physical Administrator directory copied to Vite public [OK]\n'


[[ -f "$WEB_ROOT/index.html" ]] \
  || fail "Vite root index.html is missing."

python3 - \
  "$WEB_ROOT/index.html" \
  "$PAYLOAD_DIR/nurselink-admin-index-bootstrap-v533.html" \
  <<'PYINDEXBOOT533'
from pathlib import Path
import re
import sys

index_path = Path(sys.argv[1])
snippet_path = Path(sys.argv[2])

text = index_path.read_text(
    encoding="utf-8"
)
snippet = snippet_path.read_text(
    encoding="utf-8"
).strip()

start_marker = (
    "<!-- NURSELINK_ADMIN_INDEX_BOOTSTRAP_V533_START -->"
)
end_marker = (
    "<!-- NURSELINK_ADMIN_INDEX_BOOTSTRAP_V533_END -->"
)

pattern = re.compile(
    re.escape(start_marker)
    + r".*?"
    + re.escape(end_marker),
    re.S,
)

text = pattern.sub(
    "",
    text,
)

head = re.search(
    r"<head(?:\s[^>]*)?>",
    text,
    re.I,
)

if not head:
    raise SystemExit(
        "Vite root index.html has no <head> element."
    )

insert_at = head.end()

text = (
    text[:insert_at]
    + "\n"
    + snippet
    + "\n"
    + text[insert_at:]
)

bootstrap_pos = text.find(
    "NURSELINK_ADMIN_INDEX_BOOTSTRAP_V533_START"
)

module_match = re.search(
    r"<script\b[^>]*\btype=[\"']module[\"'][^>]*>",
    text,
    re.I,
)

if module_match and bootstrap_pos > module_match.start():
    raise SystemExit(
        "Administrator index bootstrap must appear before the first module script."
    )

index_path.write_text(
    text,
    encoding="utf-8"
)

print(
    "Pre-React Administrator index bootstrap installed [OK]"
)
PYINDEXBOOT533

cp -f "$PAYLOAD_DIR/nurselink-mobile.css" "$WEB_ROOT/src/nurselink-mobile.css"
cp -f "$PAYLOAD_DIR/nurselink-nurse-montage.png" "$WEB_ROOT/public/nurselink-nurse-montage.png"
cp -f "$PAYLOAD_DIR/nurselink-public-profile.html" "$WEB_ROOT/public/nurselink-public-profile.html"
cp -f "$PAYLOAD_DIR/nurselink-public-profile.js" "$WEB_ROOT/public/nurselink-public-profile.js"
cp -f "$PAYLOAD_DIR/nurselink-public-profile.css" "$WEB_ROOT/public/nurselink-public-profile.css"
cp -f "$PAYLOAD_DIR/nurselink-partner-portal.html" "$WEB_ROOT/public/nurselink-partner-portal.html"
cp -f "$PAYLOAD_DIR/nurselink-partner-portal.js" "$WEB_ROOT/public/nurselink-partner-portal.js"
cp -f "$PAYLOAD_DIR/nurselink-partner-portal.css" "$WEB_ROOT/public/nurselink-partner-portal.css"
cp -f "$PAYLOAD_DIR/nurselink-enterprise.html" "$WEB_ROOT/public/nurselink-enterprise.html"
cp -f "$PAYLOAD_DIR/nurselink-enterprise.js" "$WEB_ROOT/public/nurselink-enterprise.js"
cp -f "$PAYLOAD_DIR/nurselink-enterprise.css" "$WEB_ROOT/public/nurselink-enterprise.css"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-command-center.html" "$WEB_ROOT/public/nurselink-enterprise-command-center.html"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-command-center.js" "$WEB_ROOT/public/nurselink-enterprise-command-center.js"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-command-center.css" "$WEB_ROOT/public/nurselink-enterprise-command-center.css"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-partner.html" "$WEB_ROOT/public/nurselink-enterprise-partner.html"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-partner.js" "$WEB_ROOT/public/nurselink-enterprise-partner.js"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-partner.css" "$WEB_ROOT/public/nurselink-enterprise-partner.css"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-goals.html" "$WEB_ROOT/public/nurselink-enterprise-goals.html"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-goals.js" "$WEB_ROOT/public/nurselink-enterprise-goals.js"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-goals.css" "$WEB_ROOT/public/nurselink-enterprise-goals.css"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-goals-admin.html" "$WEB_ROOT/public/nurselink-enterprise-goals-admin.html"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-goals-admin.js" "$WEB_ROOT/public/nurselink-enterprise-goals-admin.js"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-goals-admin.css" "$WEB_ROOT/public/nurselink-enterprise-goals-admin.css"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-goals-partner.html" "$WEB_ROOT/public/nurselink-enterprise-goals-partner.html"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-goals-partner.js" "$WEB_ROOT/public/nurselink-enterprise-goals-partner.js"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-goals-partner.css" "$WEB_ROOT/public/nurselink-enterprise-goals-partner.css"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-invitations.html" "$WEB_ROOT/public/nurselink-enterprise-invitations.html"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-invitations.js" "$WEB_ROOT/public/nurselink-enterprise-invitations.js"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-invitations.css" "$WEB_ROOT/public/nurselink-enterprise-invitations.css"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-enrollment-admin.html" "$WEB_ROOT/public/nurselink-enterprise-enrollment-admin.html"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-enrollment-admin.js" "$WEB_ROOT/public/nurselink-enterprise-enrollment-admin.js"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-enrollment-admin.css" "$WEB_ROOT/public/nurselink-enterprise-enrollment-admin.css"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-enrollment-partner.html" "$WEB_ROOT/public/nurselink-enterprise-enrollment-partner.html"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-enrollment-partner.js" "$WEB_ROOT/public/nurselink-enterprise-enrollment-partner.js"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-enrollment-partner.css" "$WEB_ROOT/public/nurselink-enterprise-enrollment-partner.css"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes.html" "$WEB_ROOT/public/nurselink-enterprise-outcomes.html"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes.js" "$WEB_ROOT/public/nurselink-enterprise-outcomes.js"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes.css" "$WEB_ROOT/public/nurselink-enterprise-outcomes.css"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes-admin.html" "$WEB_ROOT/public/nurselink-enterprise-outcomes-admin.html"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes-admin.js" "$WEB_ROOT/public/nurselink-enterprise-outcomes-admin.js"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes-admin.css" "$WEB_ROOT/public/nurselink-enterprise-outcomes-admin.css"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes-partner.html" "$WEB_ROOT/public/nurselink-enterprise-outcomes-partner.html"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes-partner.js" "$WEB_ROOT/public/nurselink-enterprise-outcomes-partner.js"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-outcomes-partner.css" "$WEB_ROOT/public/nurselink-enterprise-outcomes-partner.css"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-support.html" "$WEB_ROOT/public/nurselink-enterprise-support.html"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-support.js" "$WEB_ROOT/public/nurselink-enterprise-support.js"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-support.css" "$WEB_ROOT/public/nurselink-enterprise-support.css"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-support-admin.html" "$WEB_ROOT/public/nurselink-enterprise-support-admin.html"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-support-admin.js" "$WEB_ROOT/public/nurselink-enterprise-support-admin.js"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-support-admin.css" "$WEB_ROOT/public/nurselink-enterprise-support-admin.css"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-support-partner.html" "$WEB_ROOT/public/nurselink-enterprise-support-partner.html"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-support-partner.js" "$WEB_ROOT/public/nurselink-enterprise-support-partner.js"
cp -f "$PAYLOAD_DIR/nurselink-enterprise-support-partner.css" "$WEB_ROOT/public/nurselink-enterprise-support-partner.css"
cp -f "$PAYLOAD_DIR/nurselink-membership-administration.html" "$WEB_ROOT/public/nurselink-membership-administration.html"
cp -f "$PAYLOAD_DIR/nurselink-membership-administration.js" "$WEB_ROOT/public/nurselink-membership-administration.js"
cp -f "$PAYLOAD_DIR/nurselink-membership-administration.css" "$WEB_ROOT/public/nurselink-membership-administration.css"
cp -f "$PAYLOAD_DIR/nurselink-membership-welcome.html" "$WEB_ROOT/public/nurselink-membership-welcome.html"
cp -f "$PAYLOAD_DIR/nurselink-membership-welcome.js" "$WEB_ROOT/public/nurselink-membership-welcome.js"
cp -f "$PAYLOAD_DIR/nurselink-membership-welcome.css" "$WEB_ROOT/public/nurselink-membership-welcome.css"
cp -f "$PAYLOAD_DIR/nurselink-membership-onboarding-admin.html" "$WEB_ROOT/public/nurselink-membership-onboarding-admin.html"
cp -f "$PAYLOAD_DIR/nurselink-membership-onboarding-admin.js" "$WEB_ROOT/public/nurselink-membership-onboarding-admin.js"
cp -f "$PAYLOAD_DIR/nurselink-membership-onboarding-admin.css" "$WEB_ROOT/public/nurselink-membership-onboarding-admin.css"







cp -f "$PAYLOAD_DIR/nurselink-institutional-analytics.html" "$WEB_ROOT/public/nurselink-institutional-analytics.html"
cp -f "$PAYLOAD_DIR/nurselink-institutional-analytics.js" "$WEB_ROOT/public/nurselink-institutional-analytics.js"
cp -f "$PAYLOAD_DIR/nurselink-institutional-analytics.css" "$WEB_ROOT/public/nurselink-institutional-analytics.css"
cp -f "$PAYLOAD_DIR/nurselink-qrcode.min.js" "$WEB_ROOT/public/nurselink-qrcode.min.js"
cp -f "$PAYLOAD_DIR/nurselink-member-verify.html" "$WEB_ROOT/public/nurselink-member-verify.html"
cp -f "$PAYLOAD_DIR/nurselink-member-verify.js" "$WEB_ROOT/public/nurselink-member-verify.js"
cp -f "$PAYLOAD_DIR/nurselink-member-verify.css" "$WEB_ROOT/public/nurselink-member-verify.css"
cp -f "$PAYLOAD_DIR/nurselink-production-readiness.html" "$WEB_ROOT/public/nurselink-production-readiness.html"
cp -f "$PAYLOAD_DIR/nurselink-production-readiness.js" "$WEB_ROOT/public/nurselink-production-readiness.js"
cp -f "$PAYLOAD_DIR/nurselink-production-readiness.css" "$WEB_ROOT/public/nurselink-production-readiness.css"
cp -f "$PAYLOAD_DIR/nurselink-operations-center.html" "$WEB_ROOT/public/nurselink-operations-center.html"
cp -f "$PAYLOAD_DIR/nurselink-operations-center.js" "$WEB_ROOT/public/nurselink-operations-center.js"
cp -f "$PAYLOAD_DIR/nurselink-operations-center.css" "$WEB_ROOT/public/nurselink-operations-center.css"
cp -f "$PAYLOAD_DIR/nurselink-admin-identity.js" "$WEB_ROOT/public/nurselink-admin-identity.js"
cp -f "$PAYLOAD_DIR/nurselink-admin-identity.css" "$WEB_ROOT/public/nurselink-admin-identity.css"
cp -f "$PAYLOAD_DIR/nurselink-career-intelligence.html" "$WEB_ROOT/public/nurselink-career-intelligence.html"
cp -f "$PAYLOAD_DIR/nurselink-career-intelligence.js" "$WEB_ROOT/public/nurselink-career-intelligence.js"
cp -f "$PAYLOAD_DIR/nurselink-career-intelligence.css" "$WEB_ROOT/public/nurselink-career-intelligence.css"
cp -f "$PAYLOAD_DIR/nurselink-admin-login.html" "$WEB_ROOT/public/nurselink-admin-login.html"
cp -f "$PAYLOAD_DIR/nurselink-admin-login.js" "$WEB_ROOT/public/nurselink-admin-login.js"
cp -f "$PAYLOAD_DIR/nurselink-admin-dashboard.html" "$WEB_ROOT/public/nurselink-admin-dashboard.html"
cp -f "$PAYLOAD_DIR/nurselink-admin-dashboard.js" "$WEB_ROOT/public/nurselink-admin-dashboard.js"
cp -f "$PAYLOAD_DIR/nurselink-admin-portal.css" "$WEB_ROOT/public/nurselink-admin-portal.css"
cp -f "$PAYLOAD_DIR/nurselink-portal-config.js" "$WEB_ROOT/public/nurselink-portal-config.js"
cp -f "$PAYLOAD_DIR/nurselink-admin-consolidated.css" "$WEB_ROOT/public/nurselink-admin-consolidated.css"

cp -f "$PAYLOAD_DIR/nurselink-notifications.html" "$WEB_ROOT/public/nurselink-notifications.html"
cp -f "$PAYLOAD_DIR/nurselink-notifications.js" "$WEB_ROOT/public/nurselink-notifications.js"
cp -f "$PAYLOAD_DIR/nurselink-notifications.css" "$WEB_ROOT/public/nurselink-notifications.css"
cp -f "$PAYLOAD_DIR/nurselink-membership-command-center.html" "$WEB_ROOT/public/nurselink-membership-command-center.html"
cp -f "$PAYLOAD_DIR/nurselink-membership-command-center.js" "$WEB_ROOT/public/nurselink-membership-command-center.js"
cp -f "$PAYLOAD_DIR/nurselink-membership-command-center.css" "$WEB_ROOT/public/nurselink-membership-command-center.css"
cp -f "$PAYLOAD_DIR/nurselink-member-registry.html" "$WEB_ROOT/public/nurselink-member-registry.html"
cp -f "$PAYLOAD_DIR/nurselink-member-registry.js" "$WEB_ROOT/public/nurselink-member-registry.js"
cp -f "$PAYLOAD_DIR/nurselink-member-registry.css" "$WEB_ROOT/public/nurselink-member-registry.css"
cp -f "$PAYLOAD_DIR/nurselink-super-admin-test-center.html" "$WEB_ROOT/public/nurselink-super-admin-test-center.html"
cp -f "$PAYLOAD_DIR/nurselink-super-admin-test-center.js" "$WEB_ROOT/public/nurselink-super-admin-test-center.js"
cp -f "$PAYLOAD_DIR/nurselink-super-admin-test-center.css" "$WEB_ROOT/public/nurselink-super-admin-test-center.css"
cp -f "$PAYLOAD_DIR/nurselink-credential-renewal.html" "$WEB_ROOT/public/nurselink-credential-renewal.html"
cp -f "$PAYLOAD_DIR/nurselink-credential-renewal.js" "$WEB_ROOT/public/nurselink-credential-renewal.js"
cp -f "$PAYLOAD_DIR/nurselink-credential-renewal.css" "$WEB_ROOT/public/nurselink-credential-renewal.css"
cp -f "$PAYLOAD_DIR/nurselink-credential-compliance.html" "$WEB_ROOT/public/nurselink-credential-compliance.html"
cp -f "$PAYLOAD_DIR/nurselink-credential-compliance.js" "$WEB_ROOT/public/nurselink-credential-compliance.js"
cp -f "$PAYLOAD_DIR/nurselink-credential-compliance.css" "$WEB_ROOT/public/nurselink-credential-compliance.css"
cp -f "$PAYLOAD_DIR/nurselink-events.html" "$WEB_ROOT/public/nurselink-events.html"
cp -f "$PAYLOAD_DIR/nurselink-events.js" "$WEB_ROOT/public/nurselink-events.js"
cp -f "$PAYLOAD_DIR/nurselink-events.css" "$WEB_ROOT/public/nurselink-events.css"
cp -f "$PAYLOAD_DIR/nurselink-event-management.html" "$WEB_ROOT/public/nurselink-event-management.html"
cp -f "$PAYLOAD_DIR/nurselink-event-management.js" "$WEB_ROOT/public/nurselink-event-management.js"
cp -f "$PAYLOAD_DIR/nurselink-event-management.css" "$WEB_ROOT/public/nurselink-event-management.css"
cp -f "$PAYLOAD_DIR/nurselink-chapters.html" "$WEB_ROOT/public/nurselink-chapters.html"
cp -f "$PAYLOAD_DIR/nurselink-chapters.js" "$WEB_ROOT/public/nurselink-chapters.js"
cp -f "$PAYLOAD_DIR/nurselink-chapters.css" "$WEB_ROOT/public/nurselink-chapters.css"
cp -f "$PAYLOAD_DIR/nurselink-chapter-management.html" "$WEB_ROOT/public/nurselink-chapter-management.html"
cp -f "$PAYLOAD_DIR/nurselink-chapter-management.js" "$WEB_ROOT/public/nurselink-chapter-management.js"
cp -f "$PAYLOAD_DIR/nurselink-chapter-management.css" "$WEB_ROOT/public/nurselink-chapter-management.css"
cp -f "$PAYLOAD_DIR/nurselink-mentoring.html" "$WEB_ROOT/public/nurselink-mentoring.html"
cp -f "$PAYLOAD_DIR/nurselink-mentoring.js" "$WEB_ROOT/public/nurselink-mentoring.js"
cp -f "$PAYLOAD_DIR/nurselink-mentoring.css" "$WEB_ROOT/public/nurselink-mentoring.css"
cp -f "$PAYLOAD_DIR/nurselink-engagement.html" "$WEB_ROOT/public/nurselink-engagement.html"
cp -f "$PAYLOAD_DIR/nurselink-engagement.js" "$WEB_ROOT/public/nurselink-engagement.js"
cp -f "$PAYLOAD_DIR/nurselink-engagement.css" "$WEB_ROOT/public/nurselink-engagement.css"
cp -f "$PAYLOAD_DIR/nurselink-engagement-command-center.html" "$WEB_ROOT/public/nurselink-engagement-command-center.html"
cp -f "$PAYLOAD_DIR/nurselink-engagement-command-center.js" "$WEB_ROOT/public/nurselink-engagement-command-center.js"
cp -f "$PAYLOAD_DIR/nurselink-engagement-command-center.css" "$WEB_ROOT/public/nurselink-engagement-command-center.css"
cp -f "$PAYLOAD_DIR/nurselink-benefits.html" "$WEB_ROOT/public/nurselink-benefits.html"
cp -f "$PAYLOAD_DIR/nurselink-benefits.js" "$WEB_ROOT/public/nurselink-benefits.js"
cp -f "$PAYLOAD_DIR/nurselink-benefits.css" "$WEB_ROOT/public/nurselink-benefits.css"
cp -f "$PAYLOAD_DIR/nurselink-benefit-management.html" "$WEB_ROOT/public/nurselink-benefit-management.html"
cp -f "$PAYLOAD_DIR/nurselink-benefit-management.js" "$WEB_ROOT/public/nurselink-benefit-management.js"
cp -f "$PAYLOAD_DIR/nurselink-benefit-management.css" "$WEB_ROOT/public/nurselink-benefit-management.css"

say "Verifying copied v5.5.2 frontend source"

cmp -s "$PAYLOAD_DIR/nurselink-mobile.js" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Copied NurseLink frontend source does not match the v5.5.2 payload."

grep -q "nurselink-runtime-v326" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Canonical build-persistent runtime marker missing from copied source."

grep -q "data-nurselink-runtime" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "v5.5.2 runtime DOM side effect missing from copied source."

grep -q "standalone-routing-v321" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Standalone routing implementation marker missing from copied source."

printf 'Frontend payload copied before validation [OK]\n'

grep -q "nurselink-operations-center-launcher" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Operations Center admin launcher missing from copied frontend."

grep -q "nurselink-operations-center.html" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Operations Center launcher URL missing from copied frontend."

printf 'Operations Center launcher copied [OK]\n'

grep -q "nurselink-career-intelligence-launcher" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Career Intelligence member launcher missing from copied frontend."

grep -q "nurselink-career-intelligence.html" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Career Intelligence launcher URL missing from copied frontend."

printf 'Career Intelligence launcher copied [OK]\n'

grep -q "nurselink-credential-renewal-launcher" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Credential Renewal member launcher missing."

grep -q "nurselink-credential-renewal.html" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Credential Renewal launcher URL missing."

grep -q "/api/credential-renewal" \
  "$WEB_ROOT/public/nurselink-credential-renewal.js" \
  || fail "Credential Renewal Center API integration missing."

printf 'Credential Renewal member launcher [OK]\n'
printf 'Credential Renewal Center UI [OK]\n'

grep -q "data-renewal-form" \
  "$WEB_ROOT/public/nurselink-credential-renewal.js" \
  || fail "Credential Renewal member workflow UI missing."

grep -q "credential-compliance.html" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  || fail "Administrator Dashboard Credential Compliance launcher missing."

grep -q "credential-renewal/summary" \
  "$WEB_ROOT/public/nurselink-credential-compliance.js" \
  || fail "Credential Compliance summary integration missing."

grep -q "text/csv;charset=utf-8" \
  "$WEB_ROOT/public/nurselink-credential-compliance.js" \
  || fail "Credential Compliance CSV export missing."

printf 'Credential Renewal workflow UI [OK]\n'
printf 'Credential Compliance Center UI [OK]\n'

grep -q "/api/events" \
  "$WEB_ROOT/public/nurselink-events.js" \
  || fail "Events & Programs member API integration missing."

grep -q "nurselink-events-programs-launcher-v471" \
  "$WEB_ROOT/src/nurselink-mobile.css" \
  || fail "Events & Programs member launcher missing."

grep -q "nurselink/admin/events" \
  "$WEB_ROOT/public/nurselink-event-management.js" \
  || fail "Event Management API integration missing."

grep -q "nurselink-event-management.html" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  || fail "Administrator Dashboard Event Management launcher missing."

printf 'Events & Programs member UI [OK]\n'
printf 'Event Management UI [OK]\n'

grep -q "/api/chapters" \
  "$WEB_ROOT/public/nurselink-chapters.js" \
  || fail "Chapters & Communities member API integration missing."

grep -q "nurselink/admin/chapters" \
  "$WEB_ROOT/public/nurselink-chapter-management.js" \
  || fail "Chapter Management API integration missing."

grep -q "nurselink-chapters-launcher-v472" \
  "$WEB_ROOT/src/nurselink-mobile.css" \
  || fail "Chapters & Communities member launcher missing."

grep -q "eventChapter" \
  "$WEB_ROOT/public/nurselink-event-management.js" \
  || fail "Event Management chapter selector missing."

printf 'Chapters & Communities member UI [OK]\n'
printf 'Chapter Management UI [OK]\n'
printf 'Chapter-specific Event UI [OK]\n'

grep -q "/api/mentoring/profile" \
  "$WEB_ROOT/public/nurselink-mentoring.js" \
  || fail "Mentoring profile API integration missing."

grep -q "/api/mentoring/directory" \
  "$WEB_ROOT/public/nurselink-mentoring.js" \
  || fail "Mentoring directory integration missing."

grep -q "nurselink-mentoring-launcher-v473" \
  "$WEB_ROOT/src/nurselink-mobile.css" \
  || fail "Mentoring member launcher missing."

printf 'Mentoring & Peer Support member UI [OK]\n'

grep -q "/api/engagement" \
  "$WEB_ROOT/public/nurselink-engagement.js" \
  || fail "Member Engagement API integration missing."

grep -q "nurselink/admin/engagement/summary" \
  "$WEB_ROOT/public/nurselink-engagement-command-center.js" \
  || fail "Engagement Command Center API integration missing."

grep -q "nurselink-engagement-hub-v480" \
  "$WEB_ROOT/src/nurselink-mobile.css" \
  || fail "Member Engagement Hub launcher missing."

grep -q "nurselink-engagement-command-center.html" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  || fail "Administrator Dashboard Engagement launcher missing."

printf 'Member Engagement Hub UI [OK]\n'
printf 'Engagement Command Center UI [OK]\n'

grep -q "/api/benefits" \
  "$WEB_ROOT/public/nurselink-benefits.js" \
  || fail "Member Benefits API integration missing."

grep -q "nurselink/admin/benefits" \
  "$WEB_ROOT/public/nurselink-benefit-management.js" \
  || fail "Benefit Management API integration missing."

grep -q "nurselink-benefits-launcher-v482" \
  "$WEB_ROOT/src/nurselink-mobile.css" \
  || fail "Member Benefits launcher missing."

grep -q "nurselink-benefit-management.html" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  || fail "Administrator Dashboard Benefit Management launcher missing."

printf 'Member Benefits & Resources UI [OK]\n'
printf 'Benefit Management UI [OK]\n'

grep -q "/api/benefits/intelligence" \
  "$WEB_ROOT/public/nurselink-benefits.js" \
  || fail "Member Benefit Intelligence integration missing."

grep -q '/api/benefits/${id}/save' \
  "$WEB_ROOT/public/nurselink-benefits.js" \
  || fail "Saved Benefit UI integration missing."

grep -q "/api/nurselink/admin/benefits/summary" \
  "$WEB_ROOT/public/nurselink-benefit-management.js" \
  || fail "Benefit Analytics admin UI integration missing."

grep -q "nurselink-benefit-intelligence-v483" \
  "$WEB_ROOT/public/nurselink-benefits.css" \
  || fail "Member Benefit Intelligence UI marker missing."

printf 'Saved Benefits UI [OK]\n'
printf 'Benefit availability intelligence UI [OK]\n'
printf 'Benefit Analytics UI [OK]\n'

grep -q "/api/nurselink/admin/benefits/reminders/generate" \
  "$WEB_ROOT/public/nurselink-benefit-management.js" \
  || fail "Benefit Reminder generator UI integration missing."

grep -q "/api/nurselink/admin/benefits/reminders/summary" \
  "$WEB_ROOT/public/nurselink-benefit-management.js" \
  || fail "Benefit Reminder summary UI integration missing."

grep -q "nurselink-benefit-reminders-v484" \
  "$WEB_ROOT/public/nurselink-benefit-management.css" \
  || fail "Benefit Reminder UI marker missing."

printf 'Benefit Reminder administrator UI [OK]\n'

grep -q "/api/engagement/timeline" \
  "$WEB_ROOT/public/nurselink-engagement.js" \
  || fail "Member Engagement Timeline UI integration missing."

grep -q "/api/nurselink/admin/engagement/activity-summary" \
  "$WEB_ROOT/public/nurselink-engagement-command-center.js" \
  || fail "Engagement Activity admin UI integration missing."

grep -q "nurselink-engagement-timeline-v490" \
  "$WEB_ROOT/public/nurselink-engagement.css" \
  || fail "Member Engagement Timeline UI marker missing."

grep -q "nurselink-engagement-activity-v490" \
  "$WEB_ROOT/public/nurselink-engagement-command-center.css" \
  || fail "Engagement Activity admin UI marker missing."

printf 'Member Engagement Timeline UI [OK]\n'
printf 'Engagement Activity Command Center UI [OK]\n'

grep -q "/api/enterprise/me" \
  "$WEB_ROOT/public/nurselink-enterprise.js" \
  || fail "Enterprise member API integration missing."

grep -q "/api/nurselink/admin/enterprise/cohorts" \
  "$WEB_ROOT/public/nurselink-enterprise-command-center.js" \
  || fail "Enterprise Command Center API integration missing."

grep -q "/api/partner/enterprise" \
  "$WEB_ROOT/public/nurselink-enterprise-partner.js" \
  || fail "Enterprise Partner Analytics API integration missing."

grep -q "nurselink-enterprise-launcher-v500" \
  "$WEB_ROOT/src/nurselink-mobile.css" \
  || fail "Enterprise member launcher missing."

grep -q "nurselink-enterprise-command-center.html" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  || fail "Administrator Dashboard Enterprise launcher missing."

grep -q "nurselink-enterprise-partner.html" \
  "$WEB_ROOT/public/nurselink-partner-portal.html" \
  || fail "Partner Portal Enterprise launcher missing."

printf 'Enterprise member UI [OK]\n'
printf 'Enterprise Command Center UI [OK]\n'
printf 'Enterprise Partner Analytics UI [OK]\n'

grep -q "enterprise_cohorts_total" \
  "$WEB_ROOT/public/nurselink-institutional-analytics.js" \
  || fail "Institutional Analytics enterprise UI integration missing."

printf 'Institutional Enterprise Analytics UI [OK]\n'

grep -q "/api/enterprise/goals" \
  "$WEB_ROOT/public/nurselink-enterprise-goals.js" \
  || fail "Enterprise member goals UI integration missing."

grep -q "/api/nurselink/admin/enterprise/cohorts/" \
  "$WEB_ROOT/public/nurselink-enterprise-goals-admin.js" \
  || fail "Enterprise administrator goals UI integration missing."

grep -q "/api/partner/enterprise/goals" \
  "$WEB_ROOT/public/nurselink-enterprise-goals-partner.js" \
  || fail "Enterprise partner goals UI integration missing."

grep -q "nurselink-enterprise-goals.html" \
  "$WEB_ROOT/public/nurselink-enterprise.html" \
  || fail "Enterprise member Goals launcher missing."

grep -q "nurselink-enterprise-goals-admin.html" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  || fail "Administrator Dashboard Enterprise Goals launcher missing."

printf 'Enterprise member goals UI [OK]\n'
printf 'Enterprise Goal Management UI [OK]\n'
printf 'Enterprise Partner Goal Analytics UI [OK]\n'

grep -q "/api/enterprise/invitations" \
  "$WEB_ROOT/public/nurselink-enterprise-invitations.js" \
  || fail "Enterprise member invitation UI integration missing."

grep -q "/api/nurselink/admin/enterprise/enrollment-summary" \
  "$WEB_ROOT/public/nurselink-enterprise-enrollment-admin.js" \
  || fail "Enterprise Enrollment administrator reporting UI missing."

grep -q "/api/partner/enterprise/enrollment-summary" \
  "$WEB_ROOT/public/nurselink-enterprise-enrollment-partner.js" \
  || fail "Enterprise partner enrollment reporting UI missing."

grep -q "nurselink-enterprise-invitations.html" \
  "$WEB_ROOT/public/nurselink-enterprise.html" \
  || fail "Enterprise Invitations member launcher missing."

grep -q "nurselink-enterprise-enrollment-admin.html" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  || fail "Administrator Dashboard Enterprise Enrollment launcher missing."

printf 'Enterprise Invitations member UI [OK]\n'
printf 'Enterprise Enrollment administrator UI [OK]\n'
printf 'Enterprise Enrollment partner reporting UI [OK]\n'

grep -q "/api/enterprise/outcomes" \
  "$WEB_ROOT/public/nurselink-enterprise-outcomes.js" \
  || fail "Enterprise member outcomes UI integration missing."

grep -q "/api/nurselink/admin/enterprise/cohorts/" \
  "$WEB_ROOT/public/nurselink-enterprise-outcomes-admin.js" \
  || fail "Enterprise Outcomes administrator UI integration missing."

grep -q "/api/partner/enterprise/outcomes" \
  "$WEB_ROOT/public/nurselink-enterprise-outcomes-partner.js" \
  || fail "Enterprise partner outcome analytics UI missing."

grep -q "nurselink-enterprise-outcomes.html" \
  "$WEB_ROOT/public/nurselink-enterprise.html" \
  || fail "Enterprise Outcomes member launcher missing."

grep -q "nurselink-enterprise-outcomes-admin.html" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  || fail "Administrator Dashboard Enterprise Outcomes launcher missing."

printf 'Enterprise Outcomes member UI [OK]\n'
printf 'Enterprise Outcomes administrator UI [OK]\n'
printf 'Enterprise Outcomes partner analytics UI [OK]\n'

grep -q "/api/enterprise/support" \
  "$WEB_ROOT/public/nurselink-enterprise-support.js" \
  || fail "Enterprise Support member UI integration missing."

grep -q "/api/nurselink/admin/enterprise/support" \
  "$WEB_ROOT/public/nurselink-enterprise-support-admin.js" \
  || fail "Enterprise Support administrator UI integration missing."

grep -q "/api/partner/enterprise/support-summary" \
  "$WEB_ROOT/public/nurselink-enterprise-support-partner.js" \
  || fail "Enterprise Support partner analytics UI missing."

grep -q "nurselink-enterprise-support.html" \
  "$WEB_ROOT/public/nurselink-enterprise.html" \
  || fail "Enterprise Support member launcher missing."

grep -q "nurselink-enterprise-support-admin.html" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  || fail "Administrator Dashboard Enterprise Support launcher missing."

printf 'Enterprise Support member UI [OK]\n'
printf 'Enterprise Support administrator UI [OK]\n'
printf 'Enterprise Support partner analytics UI [OK]\n'

grep -q "/api/nurselink/admin/membership-administration/overview" \
  "$WEB_ROOT/public/nurselink-membership-administration.js" \
  || fail "Membership Administration overview UI integration missing."

grep -q "/api/nurselink/admin/membership-command/" \
  "$WEB_ROOT/public/nurselink-membership-administration.js" \
  || fail "Membership Administration decision workflow integration missing."

grep -q "/api/nurselink/admin/membership-lifecycle/" \
  "$WEB_ROOT/public/nurselink-membership-administration.js" \
  || fail "Membership Administration lifecycle integration missing."

grep -q "/api/nurselink/admin/users/grant" \
  "$WEB_ROOT/public/nurselink-membership-administration.js" \
  || fail "Membership Administration role-assignment integration missing."

grep -q "nurselink-membership-administration.html" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  || fail "Administrator Dashboard Membership Administration launcher missing."

grep -q "nurselink-membership-administration.html" \
  "$WEB_ROOT/public/nurselink-admin-login.js" \
  || fail "Administrator Login safe return for Membership Administration missing."

printf 'Membership Administration Suite UI [OK]\n'

grep -q "/api/membership/onboarding" \
  "$WEB_ROOT/public/nurselink-membership-welcome.js" \
  || fail "Membership Welcome Center API integration missing."

grep -q "/api/nurselink/admin/membership-onboarding" \
  "$WEB_ROOT/public/nurselink-membership-onboarding-admin.js" \
  || fail "Membership Onboarding Admin API integration missing."

grep -q "nurselink-membership-onboarding-admin.html" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  || fail "Central Operations Center onboarding compatibility route missing."

grep -q "nurselink-membership-onboarding-admin.html" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  || fail "Administrator Dashboard onboarding launcher missing."

printf 'Membership Welcome Center UI [OK]\n'
printf 'Membership Onboarding Admin UI [OK]\n'

printf 'Membership review + approval workflow UI [OK]\n'
printf 'Membership lifecycle UI [OK]\n'
printf 'Administrator role-management UI [OK]\n'


















grep -q "nurselink-super-admin-badge" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Super Administrator top-bar identity badge missing."

grep -q "nurselink-super-admin-banner" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Super Administrator admin-dashboard banner missing."

grep -q "nurselink/session-identity" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Frontend is not using the server-confirmed session identity API."

grep -q "data-nurselink-access-level" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Super Administrator access-level runtime marker missing."

printf 'Super Administrator visual distinction copied [OK]\n'

grep -q "System Access vs Membership Identity Clarity" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Role/membership identity clarity implementation missing."

grep -q "Super Administrator Portal" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Super Administrator Portal label implementation missing."

grep -q "nurselink-super-admin-center-link" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Super Administrator Admin Center navigation missing."

grep -q "data-nurselink-role-membership-clarity" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Role/membership clarity runtime marker missing."

grep -q "Membership Role" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Membership Role distinction missing."

printf 'System access vs membership distinction [OK]\n'

grep -q "enforceSuperAdministratorPortalLabel" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Persistent Super Administrator Portal label enforcement missing."

grep -q "ensureSuperAdministratorPortalLabelObserver" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Super Administrator Portal render-observer missing."

grep -q "data-nurselink-super-admin-portal-persistence" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Super Administrator Portal persistence runtime marker missing."

printf 'Persistent Super Administrator Portal label [OK]\n'

printf 'Super Administrator Admin Center navigation [OK]\n'

grep -q "nurselink-admin-login.html" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Admin Center does not point to the separate Administrator sign-in."

grep -q "nurselink/admin/session-login" "$WEB_ROOT/public/nurselink-admin-login.js" \
  || fail "Administrator Login page is not using the dedicated admin login endpoint."

grep -q "nurselink/admin/users/grant" "$WEB_ROOT/public/nurselink-admin-dashboard.js" \
  || fail "Administrator Dashboard role grant/change control missing."

grep -q "Super Administrator" "$WEB_ROOT/public/nurselink-admin-dashboard.html" \
  || fail "Administrator Dashboard access-management disclosure missing."

printf 'Separate Administrator login UI [OK]\n'

grep -q "NurseLinkPortalConfig" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  || fail "Centralized NurseLink Portal Configuration missing."

grep -q "/api/nurselink/admin/membership-administration/queue" \
  "$WEB_ROOT/public/nurselink-admin-dashboard.js" \
  || fail "Consolidated Administrator Portal membership workflow missing."

grep -q "/api/nurselink/admin/membership-onboarding" \
  "$WEB_ROOT/public/nurselink-admin-dashboard.js" \
  || fail "Consolidated Administrator Portal onboarding workflow missing."

grep -q "/api/nurselink/admin/member-registry" \
  "$WEB_ROOT/public/nurselink-admin-dashboard.js" \
  || fail "Consolidated Administrator Portal member registry workflow missing."

grep -q "/api/nurselink/admin/users/grant" \
  "$WEB_ROOT/public/nurselink-admin-dashboard.js" \
  || fail "Consolidated Administrator Portal access-management workflow missing."

grep -q "nurselink-member-portal-membership-v520" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Consolidated Member Portal membership panel missing."

grep -q "Administrator sign in" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Member Login Administrator entry choice missing."

printf 'Two-portal consolidation source implementation [OK]\n'

python3 - \
  "$WEB_ROOT/public/nurselink-admin-dashboard.html" \
  "$WEB_ROOT/public/nurselink-admin-dashboard.js" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  <<'PYADMINUI530'
from pathlib import Path
import sys

html = Path(sys.argv[1]).read_text(
    encoding="utf-8"
)
js = Path(sys.argv[2]).read_text(
    encoding="utf-8"
)
config = Path(sys.argv[3]).read_text(
    encoding="utf-8"
)

menu = (
    "Dashboard",
    "Members",
    "Applications",
    "Verification",
    "Organizations",
    "Programs",
    "Employment &amp; Opportunities",
    "Training &amp; Events",
    "Communications",
    "Reports &amp; Analytics",
    "Support Cases",
    "Audit Logs",
    "System Health",
    "Settings",
)

for item in menu:
    if item not in html:
        raise SystemExit(
            "Administration Operations Center menu missing: "
            + item
        )

for endpoint in (
    "/api/nurselink/admin/operations-center/summary",
    "/api/nurselink/admin/member-registry",
    "/api/nurselink/admin/membership-administration/queue",
    "/api/reviewer/credentials",
    "/api/reviewer/partner-organizations",
    "/api/reviewer/job-opportunities",
    "/api/nurselink/admin/events",
    "/api/nurselink/admin/operations-center/communications",
    "/api/reviewer/institutional-analytics",
    "/api/nurselink/admin/operations-center/support-cases",
    "/api/nurselink/admin/operations-center/audit-log",
    "/api/nurselink/admin/operations-center/system-health",
    "/api/nurselink/admin/operations-center/settings",
):
    if endpoint not in js:
        raise SystemExit(
            "Administration Operations Center UI workflow missing: "
            + endpoint
        )

if "Administration Operations Center" not in html:
    raise SystemExit(
        "Administration Operations Center identity missing."
    )

if "raw database" not in html.lower():
    raise SystemExit(
        "Workflow-first administration principle missing."
    )

if "adminTabs" not in config:
    raise SystemExit(
        "Central operations menu configuration missing."
    )

print(
    "Administration Operations Center source UI validator [OK]"
)
PYADMINUI530

printf 'Administration Operations Center source UI [OK]\n'

python3 - \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  "$WEB_ROOT/public/nurselink-admin-dashboard.html" \
  "$WEB_ROOT/public/nurselink-admin-dashboard.js" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYCENTRALLAUNCH534'
from pathlib import Path
import sys

config = Path(sys.argv[1]).read_text(
    encoding="utf-8"
)
html = Path(sys.argv[2]).read_text(
    encoding="utf-8"
)
js = Path(sys.argv[3]).read_text(
    encoding="utf-8"
)
installer = Path(sys.argv[4]).read_text(
    encoding="utf-8"
)

required_launchers = (
    "nurselink-credential-compliance.html",
    "nurselink-benefit-management.html",
    "nurselink-engagement-command-center.html",
    "nurselink-enterprise-command-center.html",
    "nurselink-enterprise-enrollment-admin.html",
    "nurselink-enterprise-goals-admin.html",
    "nurselink-enterprise-outcomes-admin.html",
    "nurselink-enterprise-support-admin.html",
    "nurselink-event-management.html",
    "nurselink-member-registry.html",
    "nurselink-membership-administration.html",
    "nurselink-membership-command-center.html",
    "nurselink-membership-onboarding-admin.html",
    "nurselink-super-admin-test-center.html",
)

for item in required_launchers:
    if item not in config:
        raise SystemExit(
            "Central portal launcher missing: "
            + item
        )

if "verificationModules" not in html:
    raise SystemExit(
        "Verification domain module launcher area missing."
    )

if "CFG?.managedModules?.verification" not in js:
    raise SystemExit(
        "Verification domain does not render centralized modules."
    )

# The installer must no longer require legacy launcher filenames to be
# hard-coded inside the dashboard HTML.  Central configuration is authoritative.
for item in required_launchers:
    needle = (
        'grep -q "'
        + item
        + '" \\\n  "$WEB_ROOT/public/nurselink-admin-dashboard.html"'
    )

    if needle in installer:
        raise SystemExit(
            "Stale direct-dashboard launcher validator remains: "
            + item
        )

print(
    "Centralized Administrator launcher ownership v5.5.2 [OK]"
)
PYCENTRALLAUNCH534

printf 'Centralized Administrator launcher validation [OK]\n'




grep -q "requireNurseLinkAdminElevation" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Review Center does not enforce the separate Administrator session."

grep -q "nurselink-admin-login.html?return=/admin" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Direct Review Center access is not redirected through Administrator sign-in."

printf 'Review Center separate-login gate [OK]\n'

printf 'Administrator Dashboard UI [OK]\n'

grep -q "nurselink-membership-command-center.html" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  || fail "Administrator Dashboard Membership Command Center launcher missing."

grep -q "membership-command/summary" \
  "$WEB_ROOT/public/nurselink-membership-command-center.js" \
  || fail "Membership Command Center summary API integration missing."

grep -q "membership-command/.*transition" \
  "$WEB_ROOT/public/nurselink-membership-command-center.js" \
  || fail "Membership Command Center transition integration missing."

grep -q "Super Administrator action will be explicitly recorded" \
  "$WEB_ROOT/public/nurselink-membership-command-center.js" \
  || fail "Self-action audit disclosure missing."

grep -q "nurselink-membership-command-center.html" \
  "$WEB_ROOT/public/nurselink-admin-login.js" \
  || fail "Administrator login safe-return allowlist is missing Membership Command Center."

printf 'Membership Command Center UI [OK]\n'
printf 'Membership Command Center admin launcher [OK]\n'

grep -q "nurselink-member-registry.html" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  || fail "Administrator Dashboard Member Registry launcher missing."

grep -q "member-registry/summary" \
  "$WEB_ROOT/public/nurselink-member-registry.js" \
  || fail "Member Registry summary API integration missing."

grep -q "Export CSV" \
  "$WEB_ROOT/public/nurselink-admin-dashboard.html" \
  || fail "Operations Center Members CSV export control missing."

grep -q "text/csv;charset=utf-8" \
  "$WEB_ROOT/public/nurselink-admin-dashboard.js" \
  || fail "Operations Center Members CSV export implementation missing."

grep -q "nurselink-member-registry.html" \
  "$WEB_ROOT/public/nurselink-admin-login.js" \
  || fail "Administrator login safe-return allowlist is missing Member Registry."

printf 'Member Registry UI [OK]\n'
printf 'Member Registry admin launcher [OK]\n'

grep -q "memberStandingFilter" \
  "$WEB_ROOT/public/nurselink-member-registry.js" \
  || fail "Member Registry standing filter missing."

grep -q "membership-lifecycle/" \
  "$WEB_ROOT/public/nurselink-member-registry.js" \
  || fail "Member Registry lifecycle API integration missing."

grep -q "nurselink-membership-standing-v460" \
  "$WEB_ROOT/src/nurselink-mobile.css" \
  || fail "Member standing UI styling missing."

grep -q "Membership Standing" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Digital Member ID standing display missing."

grep -q "VERIFIED NURSELINK MEMBERSHIP RECORD" \
  "$WEB_ROOT/public/nurselink-member-verify.js" \
  || fail "Public membership verification standing UI missing."

printf 'Membership Lifecycle Registry UI [OK]\n'
printf 'Digital Member ID standing [OK]\n'
printf 'Public membership standing verification [OK]\n'


grep -q "nurselink-super-admin-test-center.html" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  || fail "Administrator Dashboard Super Admin Test Center launcher missing."

grep -q "nurselink/admin/test-mode/start" \
  "$WEB_ROOT/public/nurselink-super-admin-test-center.js" \
  || fail "Super Admin Test Center start control missing."

grep -q "nurselink/admin/test-mode/stop" \
  "$WEB_ROOT/public/nurselink-super-admin-test-center.js" \
  || fail "Super Admin Test Center stop control missing."

grep -q "nurselink-super-admin-test-mode" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Main application Test Mode runtime integration missing."

grep -q "nurselink-super-admin-test-center.html" \
  "$WEB_ROOT/public/nurselink-admin-login.js" \
  || fail "Administrator login safe return is missing Super Admin Test Center."

printf 'Super Administrator Test Center UI [OK]\n'
printf 'Super Administrator Test Center launcher [OK]\n'






grep -q "v5.5.2 PUBLIC-AUTH ISOLATION" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Super Administrator public-auth isolation implementation missing."

grep -q "public_auth_deferred" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Public-auth session-identity suppression missing."

grep -q "if (nurseLinkIsPublicAuthRoute())" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Public auth route guard missing from Super Administrator identity enhancer."

printf 'Super Administrator public-auth isolation [OK]\n'

grep -q "function notificationActionUrl" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Adaptive notification action resolver missing."

grep -q "openNotificationDrawer" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Notification drawer implementation missing."

grep -q "nurselink-notification-drawer" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Notification drawer runtime marker missing."

grep -q "/smart-registration?nlstep=3" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Applicant-safe Credential Registry notification target missing."

grep -q "credentialActionUrl" \
  "$API_ROOT/app/Http/Controllers/Api/ReviewCenterController.php" \
  || fail "Future credential notifications are not membership-aware."

printf 'Notification Open-action routing [OK]\n'
printf 'Notification bell drawer [OK]\n'

grep -q "CACHE-FIRST NOTIFICATION DRAWER" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Cache-first Notification Drawer implementation missing."

grep -q "data-nurselink-notification-instant" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Instant Notification Drawer runtime marker missing."

grep -q "Promise.allSettled" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Quiet notification refresh orchestration missing."

grep -q "notificationState.loading" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Notification request de-duplication state missing."

printf 'Instant Notification Drawer cache reuse [OK]\n'
printf 'Notification request de-duplication [OK]\n'
grep -q "dashboard-notifications-limit-4" "$WEB_ROOT/src/nurselink-mobile.css" || fail "Compact dashboard notification styling missing."
grep -q "limit: 4" "$WEB_ROOT/src/nurselink-mobile.js" || fail "Dashboard notification limit is not 4."
grep -q "nurselink-notifications.html" "$WEB_ROOT/src/nurselink-mobile.js" || fail "Dashboard View All Notifications link missing."
printf 'Compact dashboard notifications [OK]\n'
printf 'Full Notification Center [OK]\n'


python3 - "$SCRIPT_DIR/install.sh" <<'PYNOTIF425'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")

sensitive_name = "notification" + "ActionUrl"

for line in text.splitlines():
    if sensitive_name not in line:
        continue

    stripped = line.strip()

    if "$WEB_ROOT/dist/assets" in line or "$LIVE_ROOT/assets" in line:
        raise SystemExit(
            "Minification-sensitive notification validator remains: " + stripped
        )

    if stripped == '"' + sensitive_name + '"':
        raise SystemExit(
            "Minification-sensitive function name remains in build marker loop."
        )

required = (
    '"nurselink-notification-drawer"',
    '"/smart-registration?nlstep=3"',
    'grep -Rqs "/smart-registration?nlstep=3" "$LIVE_ROOT/assets"',
)

for item in required:
    if item not in text:
        raise SystemExit(
            "Build-persistent notification validation missing: " + item
        )

print("Notification build-marker semantics [OK]")
PYNOTIF425




for admin_page in \
  "$WEB_ROOT/public/nurselink-production-readiness.html" \
  "$WEB_ROOT/public/nurselink-institutional-analytics.html" \
  "$WEB_ROOT/public/nurselink-operations-center.html"
do
  grep -q "nurselink-admin-identity.js" "$admin_page" \
    || fail "Standalone admin page missing Super Administrator identity runtime: $admin_page"
done

printf 'Standalone admin Super Administrator identity [OK]\n'

python3 - "$SCRIPT_DIR/install.sh" <<'PYUAT422'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")
bad_token = "$" + "UAT_BODY"

if bad_token in text:
    raise SystemExit(
        "Regression detected: undefined UAT response variable remains in installer."
    )

required = [
    'READINESS_BODY="$(curl -fsS',
    'printf \'%s\' "$READINESS_BODY" | grep -q \'nurselink-admin-identity.js\'',
    'Production UAT page is missing the Super Administrator identity runtime.',
]

for item in required:
    if item not in text:
        raise SystemExit("UAT identity validation semantic missing: " + item)

print("Production UAT identity variable consistency [OK]")
PYUAT422






grep -q "data-nurselink-release" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "v5.5.2 release runtime attribute missing."

grep -q "'5.5.2'" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "v5.5.2 release value missing."

printf 'v5.5.2 release runtime copied [OK]\n'

grep -q "data-nurselink-production" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Production-stable runtime marker missing."

grep -q "'stable'" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Production-stable runtime value missing."

printf 'Production-stable runtime marker [OK]\n'


python3 - \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  "$API_ROOT/app/Http/Controllers/Api/ProductionReadinessController.php" \
  <<'PYREL341'
from pathlib import Path
import re
import sys

frontend = Path(sys.argv[1]).read_text(encoding="utf-8")
controller = Path(sys.argv[2]).read_text(encoding="utf-8")

release = re.search(
    r"data-nurselink-release'\s*,\s*'([^']+)'",
    frontend,
    re.S,
)
stage = re.search(
    r"data-nurselink-release-stage'\s*,\s*'([^']+)'",
    frontend,
    re.S,
)

if not release or release.group(1) != "5.5.2":
    found = release.group(1) if release else "missing"
    raise SystemExit(
        "Frontend release mismatch: expected 5.5.2, found " + found
    )

if not stage or stage.group(1) != "production":
    raise SystemExit("Production runtime stage is missing or incorrect.")

if "'release' => '5.5.2'" not in controller:
    raise SystemExit("Production Readiness release is not 5.5.2.")

print("Release runtime value 5.5.2 [OK]")
print("Production runtime stage [OK]")
print("Production Readiness release 5.5.2 [OK]")
PYREL341


grep -q "data-nurselink-release-stage" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Production release stage attribute missing."

grep -q "production" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Production release stage value missing."

printf 'Production release stage runtime [OK]\n'

say "Verifying v5.5.2 release-version consistency"

python3 - "$SCRIPT_DIR/install.sh" <<'PYCONSIST341'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")

required = [
    "VERSION=\"5.5.2\"",
    "grep -q \"'5.5.2'\" \"$WEB_ROOT/src/nurselink-mobile.js\"",
    "grep -q \"'release' => '5.5.2'\"",
    "grep -Rqs \"5.5.2\" \"$WEB_ROOT/dist/assets\"",
    "grep -Rqs \"5.5.2\" \"$LIVE_ROOT/assets\"",
]

for item in required:
    if item not in text:
        raise SystemExit("Release consistency check missing: " + item)

old_versions = ["3." + "3.0", "3." + "4.0"]

for line in text.splitlines():
    if not (
        "grep -q" in line
        or "grep -Rqs" in line
        or "|| fail" in line
    ):
        continue
    if any(version in line for version in old_versions):
        raise SystemExit(
            "Stale executable release-version check remains: " + line.strip()
        )

print("Release-version consistency [OK]")
PYCONSIST341



printf 'Canonical build-persistent runtime copied [OK]\n'

say "Verifying Digital Member ID implementation"

grep -q "nurselink-member-verify.html?code=" \
  "$API_ROOT/app/Http/Controllers/Api/MembershipController.php" \
  || fail "Human-readable member verification URL is missing."

grep -q "nurselink-qrcode.min.js" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Local QR runtime loader missing."

grep -q "new QR(target" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Digital Member ID QR renderer missing."

grep -q "nurselink-member-id-qr-code" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Digital Member ID QR target missing."

grep -q "api/profile-photo/image" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Digital Member ID profile photo loader missing."

grep -q "nurselink-member-id-photo" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Digital Member ID photo target missing."

printf 'Digital Member ID profile photo [OK]\n'
printf 'Local QR verification code [OK]\n'
printf 'Human-readable member verification page [OK]\n'
printf 'Digital ID implementation validation [OK]\n'

say "Verifying shared JSON request runtime"

grep -q "async function nurseLinkJsonRequest" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Core nurseLinkJsonRequest helper is missing from source."

grep -q "async function nurseLinkRefreshCsrf" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Core JSON helper CSRF support is missing."

grep -q "headers.set('X-XSRF-TOKEN'" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Core JSON helper XSRF header support is missing."

grep -q "response.status === 419" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Core JSON helper 419 retry support is missing."

printf 'Core JSON request helper [OK]\n'
printf 'Reviewer Center API transport [OK]\n'
printf 'Member/jobs/notifications API transport [OK]\n'

say "Verifying applicant credential onboarding"

grep -q "credentialState.error" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Credential failed-read cache missing."

grep -q "nurselinkCredentialsHydrated" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Credential hydration guard missing."

grep -q "verification_status: value('verification_status')" "$WEB_ROOT/src/nurselink-mobile.js" \
  && fail "Applicant credential payload still allows verification_status."

grep -q "nurselink-credential-review-state" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Credential verification status is not read-only in the member UI."

printf 'Applicant Credential Registry access [OK]\n'
printf 'Credential request-storm prevention [OK]\n'
printf 'Reviewer-only verification status [OK]\n'

say "Verifying Production UAT center"

grep -q "ProductionReadinessController" "$API_ROOT/routes/api.php" \
  || fail "Production Readiness route missing."

grep -q "configuration_values_exposed.*false" \
  "$API_ROOT/app/Http/Controllers/Api/ProductionReadinessController.php" \
  || fail "Production Readiness privacy guard missing."

grep -q "nurselink-production-readiness.html" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Production UAT launcher/link is missing from frontend source."

[[ -f "$WEB_ROOT/public/nurselink-production-readiness.html" ]] \
  || fail "Production UAT HTML is missing from source public assets."

printf 'Production readiness API [OK]\n'
printf 'Reviewer/Admin UAT access [OK]\n'
printf 'Readiness privacy guard [OK]\n'

grep -q "latestBackupAgeHours" \
  "$API_ROOT/app/Http/Controllers/Api/ProductionReadinessController.php" \
  || fail "Production Readiness backup-age check missing."

grep -q "security_headers_policy" \
  "$API_ROOT/app/Http/Controllers/Api/ProductionReadinessController.php" \
  || fail "Production Readiness security-header check missing."

grep -q "'release' => '5.5.2'" \
  "$API_ROOT/app/Http/Controllers/Api/ProductionReadinessController.php" \
  || fail "Production Readiness release is not v5.5.2."

printf 'Production operations readiness checks [OK]\n'

grep -q "recentLogHealth" \
  "$API_ROOT/app/Http/Controllers/Api/ProductionReadinessController.php" \
  || fail "Recent Laravel log health check missing."

grep -q "'release' => '5.5.2'" \
  "$API_ROOT/app/Http/Controllers/Api/ProductionReadinessController.php" \
  || fail "Production Readiness release is not v5.5.2."

printf 'Production release readiness checks [OK]\n'

grep -q "production_release_stage" \
  "$API_ROOT/app/Http/Controllers/Api/ProductionReadinessController.php" \
  || fail "Production release stage readiness check missing."

grep -q "'release' => '5.5.2'" \
  "$API_ROOT/app/Http/Controllers/Api/ProductionReadinessController.php" \
  || fail "Production Readiness release is not v5.5.2."

printf 'Production release controller stage [OK]\n'




say "Verifying standalone routing package preflight"

[[ -f "$SCRIPT_DIR/standalone_pages_v321.htaccess" ]] \
  || fail "Standalone routing policy package is missing."

python3 - \
  "$SCRIPT_DIR/standalone_pages_v321.htaccess" \
  <<'PYSTANDALONE535'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

required = (
    "# NURSELINK_STANDALONE_PAGES_V321_START",
    "Options -MultiViews",
    "RewriteEngine On",
    r"RewriteRule ^nurselink-admin-login\.html$ - [END]",
    r"RewriteRule ^nurselink-admin-dashboard\.html$ - [END]",
    r"RewriteRule ^nurselink-admin-login\.js$ - [END]",
    r"RewriteRule ^nurselink-admin-dashboard\.js$ - [END]",
    r"RewriteRule ^nurselink-portal-config\.js$ - [END]",
    r"RewriteRule ^nurselink-admin-portal\.css$ - [END]",
    r"RewriteRule ^nurselink-admin-consolidated\.css$ - [END]",
    "RewriteCond %{REQUEST_FILENAME} -f [OR]",
    "RewriteCond %{REQUEST_FILENAME} -d",
    "RewriteRule ^ - [END]",
    "# NURSELINK_STANDALONE_PAGES_V321_END",
)

missing = [
    item
    for item in required
    if item not in text
]

if missing:
    raise SystemExit(
        "Standalone routing package preflight missing: "
        + " | ".join(missing)
    )

start = text.find(
    "# NURSELINK_STANDALONE_PAGES_V321_START"
)
login = text.find(
    r"RewriteRule ^nurselink-admin-login\.html$ - [END]"
)
dashboard = text.find(
    r"RewriteRule ^nurselink-admin-dashboard\.html$ - [END]"
)
generic = text.find(
    "RewriteCond %{REQUEST_FILENAME} -f [OR]"
)

if not (
    0 <= start
    < login
    < dashboard
    < generic
):
    raise SystemExit(
        "Standalone routing package directives are out of order."
    )

print(
    "Standalone routing package exact-literal preflight [OK]"
)
PYSTANDALONE535


python3 - "$SCRIPT_DIR/cache_policy_v263.htaccess" <<'PYCACHE325'
from pathlib import Path
import re
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")

rules = re.findall(
    r'<FilesMatch\s+"([^"]+)">(.*?)</FilesMatch>',
    text,
    re.S,
)

pages = (
    "index.html",
    "nurselink-public-profile.html",
    "nurselink-partner-portal.html",
    "nurselink-institutional-analytics.html",
    "nurselink-member-verify.html",
    "nurselink-production-readiness.html",
    "nurselink-operations-center.html",
    "nurselink-career-intelligence.html",
    "nurselink-admin-login.html" \
  "data-nurselink-super-admin-test-mode" \
  "nurselink-admin-login.html?return=/admin" \
  "nurselink-notifications.html",
    "nurselink-admin-dashboard.html",
    "nurselink-notifications.html",
    "nurselink-membership-command-center.html",
    "nurselink-member-registry.html",
    "nurselink-super-admin-test-center.html",
    "nurselink-credential-renewal.html",
    "nurselink-credential-compliance.html",
    "nurselink-events.html",
    "nurselink-event-management.html",
    "nurselink-chapters.html",
    "nurselink-chapter-management.html",
    "nurselink-mentoring.html",
    "nurselink-engagement.html",
    "nurselink-engagement-command-center.html",
    "nurselink-benefits.html",
    "nurselink-benefit-management.html",
    "nurselink-enterprise.html",
    "nurselink-enterprise-command-center.html",
    "nurselink-enterprise-partner.html",
    "nurselink-enterprise-goals.html",
    "nurselink-enterprise-goals-admin.html",
    "nurselink-enterprise-goals-partner.html",
    "nurselink-enterprise-invitations.html",
    "nurselink-enterprise-enrollment-admin.html",
    "nurselink-enterprise-enrollment-partner.html",
    "nurselink-enterprise-outcomes.html",
    "nurselink-enterprise-outcomes-admin.html",
    "nurselink-enterprise-outcomes-partner.html",
    "nurselink-enterprise-support.html",
    "nurselink-enterprise-support-admin.html",
    "nurselink-enterprise-support-partner.html",
    "nurselink-membership-administration.html",
    "nurselink-membership-welcome.html",
    "nurselink-membership-onboarding-admin.html",
)

matched_body = None

for pattern, body in rules:
    try:
        compiled = re.compile(pattern)
    except re.error as exc:
        raise SystemExit(f"Invalid FilesMatch regex: {exc}")

    if all(compiled.fullmatch(name) for name in pages):
        matched_body = body
        break

if matched_body is None:
    raise SystemExit(
        "No-cache FilesMatch rule does not cover all standalone NurseLink HTML pages."
    )

for required in (
    'Cache-Control "no-cache, no-store, must-revalidate"',
    'Pragma "no-cache"',
    'Expires "0"',
):
    if required not in matched_body:
        raise SystemExit(
            f"Standalone HTML no-cache directive is missing: {required}"
        )

print("Standalone HTML cache regex coverage [OK]")
print("Standalone HTML no-cache directives [OK]")
PYCACHE325

grep -q "standalone-routing-v321" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Standalone routing frontend implementation marker missing."

printf 'Standalone routing package preflight [OK]\n'

python3 - "$SCRIPT_DIR/security_headers_v330.htaccess" <<'PYSEC330'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")

for item in (
    "NURSELINK_SECURITY_HEADERS_V330_START",
    'X-Content-Type-Options "nosniff"',
    'Referrer-Policy "strict-origin-when-cross-origin"',
    'X-Frame-Options "SAMEORIGIN"',
    'X-Permitted-Cross-Domain-Policies "none"',
    "Permissions-Policy",
    "Header always unset X-Powered-By",
):
    if item not in text:
        raise SystemExit(f"Security header policy missing: {item}")

if "Content-Security-Policy" in text:
    raise SystemExit("Strict CSP must not be enabled in the v5.5.2 baseline.")

print("Security headers package policy [OK]")
PYSEC330

printf 'Standalone HTML no-cache policy [OK]\n'
printf 'UAT login return path [OK]\n'

say "Verifying canonical cumulative runtime"

grep -q "nurselink-runtime-v326" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Canonical NurseLink runtime marker missing."

grep -q "data-nurselink-runtime" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Canonical NurseLink runtime DOM side effect missing."

grep -q "standalone-routing-v321" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Standalone routing implementation marker missing."

grep -q "async function nurseLinkJsonRequest" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Shared NurseLink JSON transport implementation missing."

grep -q "nurselinkCredentialsHydrated" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Applicant credential hydration protection missing."

grep -q "nurselink-production-readiness.html" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Production UAT frontend implementation missing."

printf 'Canonical cumulative runtime validation [OK]\n'

say "Verifying v5.5.2 validator consistency"

python3 - "$SCRIPT_DIR/install.sh" <<'PYVALIDATOR327'
from pathlib import Path
import re
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")

obsolete = (
    "cumulative-validation-v322",
    "install-order-v323",
    "routing-order-v324",
    "cache-policy-validation-v325",
)

problems = []

for marker in obsolete:
    for line in text.splitlines():
        if marker in line and (
            "grep -q" in line
            or "grep -Rqs" in line
            or "Built web marker missing" in line
            or "Live web marker missing" in line
            or "|| fail" in line
        ):
            problems.append(f"{marker}: {line.strip()}")

if problems:
    raise SystemExit(
        "Obsolete hard runtime validation remains:\n" + "\n".join(problems)
    )

if "nurselink-runtime-v326" not in text:
    raise SystemExit("Canonical runtime validation is missing.")

print("No obsolete hard runtime markers [OK]")
PYVALIDATOR327

printf 'Validator consistency [OK]\n'


say "Verifying v5.5.2 post-copy frontend"

grep -q "nurselink-qrcode.min.js" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Copied frontend lacks local QR loader."

grep -q "async function nurseLinkJsonRequest" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Copied frontend lacks shared JSON transport."

grep -q "nurselinkCredentialsHydrated" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Copied frontend lacks credential request-storm protection."

grep -q "nurselink-production-readiness.html" "$WEB_ROOT/src/nurselink-mobile.js" \
  || fail "Copied frontend lacks Production UAT launcher."

printf 'Post-copy Digital ID validation [OK]\n'
printf 'Post-copy shared JSON validation [OK]\n'
printf 'Post-copy applicant credential validation [OK]\n'
printf 'Post-copy Production UAT validation [OK]\n'

grep -q "NURSELINK_ADMIN_SPA_RESCUE_V532" \
  "$WEB_ROOT/src/nurselink-admin-spa-rescue.js" \
  || fail "Administrator SPA rescue source marker missing."

grep -q "nurselink-admin-spa-rescue-login-v532" \
  "$WEB_ROOT/src/nurselink-admin-spa-rescue.js" \
  || fail "Administrator Login SPA rescue marker missing."

grep -q "nurselink-admin-spa-rescue-dashboard-v532" \
  "$WEB_ROOT/src/nurselink-admin-spa-rescue.js" \
  || fail "Administrator Dashboard SPA rescue marker missing."

printf 'Administrator SPA rescue source [OK]\n'

grep -q "NURSELINK_ADMIN_INDEX_BOOTSTRAP_V533_START" \
  "$WEB_ROOT/index.html" \
  || fail "Pre-React Administrator index bootstrap missing from Vite source index."

python3 - "$WEB_ROOT/index.html" <<'PYINDEXORDER533'
from pathlib import Path
import re
import sys

text = Path(sys.argv[1]).read_text(
    encoding="utf-8"
)

bootstrap = text.find(
    "NURSELINK_ADMIN_INDEX_BOOTSTRAP_V533_START"
)

module = re.search(
    r"<script\b[^>]*\btype=[\"']module[\"'][^>]*>",
    text,
    re.I,
)

if bootstrap < 0:
    raise SystemExit(
        "Administrator index bootstrap marker missing."
    )

if module and bootstrap > module.start():
    raise SystemExit(
        "Administrator index bootstrap executes after the React module script."
    )

print(
    "Administrator index bootstrap ordering [OK]"
)
PYINDEXORDER533

printf 'Pre-React Administrator index bootstrap source [OK]\n'

for name in \
  index.html \
  login.html \
  dashboard.js \
  login.js \
  portal-config.js \
  admin-portal.css \
  admin-consolidated.css \
  .htaccess
do
  [[ -f "$WEB_ROOT/public/admin/$name" ]] \
    || fail "Physical Administrator source file missing: admin/$name"
done

grep -q "Administration Operations Center" \
  "$WEB_ROOT/public/admin/index.html" \
  || fail "Physical Administrator Operations Center identity missing."

grep -q "/api/nurselink/admin/session-login" \
  "$WEB_ROOT/public/admin/login.js" \
  || fail "Physical Administrator Login workflow missing."

grep -q "/api/nurselink/admin/operations-center/summary" \
  "$WEB_ROOT/public/admin/dashboard.js" \
  || fail "Physical Administrator Operations Center workflow missing."

grep -q "adminLogin: '/admin/login.html'" \
  "$WEB_ROOT/public/admin/portal-config.js" \
  || fail "Physical Administrator login entry configuration missing."

grep -q "adminPortal: '/admin/'" \
  "$WEB_ROOT/public/admin/portal-config.js" \
  || fail "Physical Administrator portal entry configuration missing."

printf 'Physical Administrator source directory [OK]\n'
grep -q "NURSELINK_ADMIN_LIGHT_BLUE_V538_START" \
  "$WEB_ROOT/public/admin/admin-portal.css" \
  || fail "Administrator light-blue login/base theme missing from source."

grep -q "NURSELINK_ADMIN_LIGHT_BLUE_V538_START" \
  "$WEB_ROOT/public/admin/admin-consolidated.css" \
  || fail "Administrator light-blue Operations Center theme missing from source."

printf 'Administrator light-blue source theme [OK]\n'
grep -q "Membership Processing Progress" \
  "$WEB_ROOT/public/admin/index.html" \
  || fail "v5.5.2 Membership Processing Progress panel missing from source."

grep -q "dashboardRecentActivity" \
  "$WEB_ROOT/public/admin/index.html" \
  || fail "v5.5.2 Recent Administrative Activity panel missing from source."

grep -q "dashboardReminders" \
  "$WEB_ROOT/public/admin/index.html" \
  || fail "v5.5.2 Administrator Follow-up panel missing from source."

grep -q "NURSELINK_ADMIN_PROGRESS_SUMMARY_V540_START" \
  "$WEB_ROOT/public/admin/admin-consolidated.css" \
  || fail "v5.5.2 Administrator progress-summary styling missing from source."

printf 'v5.5.2 Administration dashboard milestone source [OK]\n'
grep -q "nl-admin-session-pending" \
  "$WEB_ROOT/public/admin/index.html" \
  || fail "Administrator source protected-shell pending state missing."

grep -q "nurselink-admin-session-gate-v541" \
  "$WEB_ROOT/public/admin/index.html" \
  || fail "Administrator source inline session gate missing."

grep -q "NURSELINK_ADMIN_SESSION_GATE_V541_START" \
  "$WEB_ROOT/public/admin/admin-consolidated.css" \
  || fail "Administrator source session-gate styling missing."

grep -q "revealAdministratorPortal" \
  "$WEB_ROOT/public/admin/dashboard.js" \
  || fail "Administrator source delayed-reveal workflow missing."

printf 'v5.5.2 Administrator no-flash source gate [OK]\n'
grep -q "adminGlobalSearch" \
  "$WEB_ROOT/public/admin/index.html" \
  || fail "v5.5.2 Administrator global search input missing from source."

grep -q "adminRoleWorkbench" \
  "$WEB_ROOT/public/admin/index.html" \
  || fail "v5.5.2 role-aware workbench missing from source."

grep -q "supportAssignment" \
  "$WEB_ROOT/public/admin/index.html" \
  || fail "v5.5.2 Support Case assignment filter missing from source."

grep -q "NURSELINK_ADMIN_WORKBENCH_V542_START" \
  "$WEB_ROOT/public/admin/admin-consolidated.css" \
  || fail "v5.5.2 workbench styling missing from source."

grep -q "runGlobalSearch" \
  "$WEB_ROOT/public/admin/dashboard.js" \
  || fail "v5.5.2 global-search JavaScript missing from source."

grep -q "renderRoleWorkbench" \
  "$WEB_ROOT/public/admin/dashboard.js" \
  || fail "v5.5.2 role-aware workbench JavaScript missing from source."

printf 'v5.5.2 Administrator workbench source [OK]\n'
grep -q "applicationCommandMetrics" \
  "$WEB_ROOT/public/admin/index.html" \
  || fail "v5.5.2 Applications Command Center KPI strip missing from source."

grep -q "applicationProgress" \
  "$WEB_ROOT/public/admin/index.html" \
  || fail "v5.5.2 Applications pipeline progress strip missing from source."

grep -q "applicationDetailDrawer" \
  "$WEB_ROOT/public/admin/index.html" \
  || fail "v5.5.2 Applications detail drawer missing from source."

grep -q "applicationFilterPriority" \
  "$WEB_ROOT/public/admin/index.html" \
  || fail "v5.5.2 Applications priority filter missing from source."

grep -q "applicationOrganization" \
  "$WEB_ROOT/public/admin/index.html" \
  || fail "v5.5.2 Applications organization filter missing from source."

grep -q "NURSELINK_APPLICATIONS_COMMAND_CENTER_V550_START" \
  "$WEB_ROOT/public/admin/admin-consolidated.css" \
  || fail "v5.5.2 Applications Command Center styling missing from source."

grep -q "renderApplicationTable" \
  "$WEB_ROOT/public/admin/dashboard.js" \
  || fail "v5.5.2 Applications professional table JavaScript missing from source."

grep -q "application_reference" \
  "$API_ROOT/app/Http/Controllers/Api/MembershipAdministrationController.php" \
  || fail "v5.5.2 application reference API presentation missing."

grep -q "latest_employment" \
  "$API_ROOT/app/Http/Controllers/Api/MembershipAdministrationController.php" \
  || fail "v5.5.2 application employment summary API presentation missing."

grep -q "review_stage" \
  "$API_ROOT/app/Http/Controllers/Api/MembershipAdministrationController.php" \
  || fail "v5.5.2 review-stage API presentation missing."

printf 'v5.5.2 Applications Command Center source/API [OK]\n'
grep -q "applicationWorkloadSection" \
  "$WEB_ROOT/public/admin/index.html" \
  || fail "v5.5.2 reviewer workload panel missing from source."

grep -q "applicationSavedView" \
  "$WEB_ROOT/public/admin/index.html" \
  || fail "v5.5.2 saved application views missing from source."

grep -q "exportApplications" \
  "$WEB_ROOT/public/admin/index.html" \
  || fail "v5.5.2 controlled application export control missing from source."

grep -q "NURSELINK_APPLICATION_TRIAGE_V552_START" \
  "$WEB_ROOT/public/admin/admin-consolidated.css" \
  || fail "v5.5.2 Applications triage styling missing from source."

grep -q "renderApplicationWorkload" \
  "$WEB_ROOT/public/admin/dashboard.js" \
  || fail "v5.5.2 reviewer workload JavaScript missing from source."

grep -q "saveApplicationView" \
  "$WEB_ROOT/public/admin/dashboard.js" \
  || fail "v5.5.2 saved application views JavaScript missing from source."

grep -q "exportApplicationQueue" \
  "$WEB_ROOT/public/admin/dashboard.js" \
  || fail "v5.5.2 controlled export JavaScript missing from source."

grep -q "membership-administration/export" \
  "$API_ROOT/routes/api.php" \
  || fail "v5.5.2 controlled application export API route missing."

grep -q "urgent_workload" \
  "$API_ROOT/app/Http/Controllers/Api/MembershipAdministrationController.php" \
  || fail "v5.5.2 reviewer urgent workload metric missing."

grep -q "overdue_workload" \
  "$API_ROOT/app/Http/Controllers/Api/MembershipAdministrationController.php" \
  || fail "v5.5.2 reviewer overdue workload metric missing."

grep -q "membership.application_queue_exported" \
  "$API_ROOT/app/Http/Controllers/Api/MembershipAdministrationController.php" \
  || fail "v5.5.2 controlled export audit action missing."

printf 'v5.5.2 Applications triage/workload/export source/API [OK]\n'



python3 - "$WEB_ROOT/public/admin/login.html" <<'PYADMINLOGINSOURCE541'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")

if text.count('href="/login"') != 1:
    raise SystemExit(
        "Administrator source login does not have exactly one Member / Applicant link."
    )

for forbidden in (
    'href="/">NurseLink Home</a>',
    "nl-admin-auth-footnote",
):
    if forbidden in text:
        raise SystemExit(
            "Administrator source login still contains extra footer content: "
            + forbidden
        )

print(
    "Administrator single Member / Applicant source link [OK]"
)
PYADMINLOGINSOURCE541










python3 - "$ENTRY_FILE" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

rescue = "import './nurselink-admin-spa-rescue.js';"
mobile = "import './nurselink-mobile.js';"

if "nurselink-admin-spa-rescue.js" not in text:
    text = rescue + "\n" + text

if "nurselink-mobile.js" not in text:
    imports = list(
        re.finditer(
            r'(?m)^import\b.*?;\s*$',
            text
        )
    )

    if imports:
        pos = imports[-1].end()
        text = text[:pos] + "\n" + mobile + text[pos:]
    else:
        text = mobile + "\n" + text

rescue_pos = text.find(
    "nurselink-admin-spa-rescue.js"
)
mobile_pos = text.find(
    "nurselink-mobile.js"
)

if rescue_pos < 0 or mobile_pos < 0:
    raise SystemExit(
        "NurseLink frontend imports are incomplete."
    )

if rescue_pos > mobile_pos:
    raise SystemExit(
        "Administrator SPA rescue must be imported before the mobile runtime."
    )

path.write_text(text, encoding="utf-8")
PY

say "Building production web bundle"

cd "$WEB_ROOT"
"$NPM_BIN" run build

[[ -f "$WEB_ROOT/dist/index.html" ]] || fail "dist/index.html missing."
[[ -d "$WEB_ROOT/dist/assets" ]] || fail "dist/assets missing."
[[ -f "$WEB_ROOT/dist/nurselink-nurse-montage.png" ]] || fail "Montage missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-public-profile.html" ]] || fail "Public profile HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-public-profile.js" ]] || fail "Public profile JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-public-profile.css" ]] || fail "Public profile CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-partner-portal.html" ]] || fail "Partner Portal HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-partner-portal.js" ]] || fail "Partner Portal JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-partner-portal.css" ]] || fail "Partner Portal CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-institutional-analytics.html" ]] || fail "Institutional analytics HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-institutional-analytics.js" ]] || fail "Institutional analytics JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-institutional-analytics.css" ]] || fail "Institutional analytics CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-qrcode.min.js" ]] || fail "QR library missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-member-verify.html" ]] || fail "Member verification HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-member-verify.js" ]] || fail "Member verification JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-member-verify.css" ]] || fail "Member verification CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-production-readiness.html" ]] || fail "Production readiness HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-production-readiness.js" ]] || fail "Production readiness JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-production-readiness.css" ]] || fail "Production readiness CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-operations-center.html" ]] || fail "Operations Center HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-operations-center.js" ]] || fail "Operations Center JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-operations-center.css" ]] || fail "Operations Center CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-admin-identity.js" ]] || fail "Standalone Super Administrator identity JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-admin-identity.css" ]] || fail "Standalone Super Administrator identity CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-career-intelligence.html" ]] || fail "Career Intelligence HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-career-intelligence.js" ]] || fail "Career Intelligence JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-career-intelligence.css" ]] || fail "Career Intelligence CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-admin-login.html" ]] || fail "Administrator Login HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-admin-login.js" ]] || fail "Administrator Login JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-admin-dashboard.html" ]] || fail "Administrator Dashboard HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-admin-dashboard.js" ]] || fail "Administrator Dashboard JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-admin-portal.css" ]] || fail "Administrator Portal CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-portal-config.js" ]] || fail "Portal Configuration missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-admin-consolidated.css" ]] || fail "Consolidated Administrator Portal CSS missing from dist."

[[ -f "$WEB_ROOT/dist/nurselink-notifications.html" ]] || fail "Notification Center HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-notifications.js" ]] || fail "Notification Center JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-notifications.css" ]] || fail "Notification Center CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-membership-command-center.html" ]] || fail "Membership Command Center HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-membership-command-center.js" ]] || fail "Membership Command Center JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-membership-command-center.css" ]] || fail "Membership Command Center CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-member-registry.html" ]] || fail "Member Registry HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-member-registry.js" ]] || fail "Member Registry JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-member-registry.css" ]] || fail "Member Registry CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-super-admin-test-center.html" ]] || fail "Super Admin Test Center HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-super-admin-test-center.js" ]] || fail "Super Admin Test Center JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-super-admin-test-center.css" ]] || fail "Super Admin Test Center CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-credential-renewal.html" ]] || fail "Credential Renewal Center HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-credential-renewal.js" ]] || fail "Credential Renewal Center JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-credential-renewal.css" ]] || fail "Credential Renewal Center CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-credential-compliance.html" ]] || fail "Credential Compliance Center HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-credential-compliance.js" ]] || fail "Credential Compliance Center JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-credential-compliance.css" ]] || fail "Credential Compliance Center CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-events.html" ]] || fail "Events & Programs HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-events.js" ]] || fail "Events & Programs JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-events.css" ]] || fail "Events & Programs CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-event-management.html" ]] || fail "Event Management HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-event-management.js" ]] || fail "Event Management JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-event-management.css" ]] || fail "Event Management CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-chapters.html" ]] || fail "Chapters & Communities HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-chapters.js" ]] || fail "Chapters & Communities JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-chapters.css" ]] || fail "Chapters & Communities CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-chapter-management.html" ]] || fail "Chapter Management HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-chapter-management.js" ]] || fail "Chapter Management JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-chapter-management.css" ]] || fail "Chapter Management CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-mentoring.html" ]] || fail "Mentoring HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-mentoring.js" ]] || fail "Mentoring JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-mentoring.css" ]] || fail "Mentoring CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-engagement.html" ]] || fail "Member Engagement Hub HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-engagement.js" ]] || fail "Member Engagement Hub JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-engagement.css" ]] || fail "Member Engagement Hub CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-engagement-command-center.html" ]] || fail "Engagement Command Center HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-engagement-command-center.js" ]] || fail "Engagement Command Center JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-engagement-command-center.css" ]] || fail "Engagement Command Center CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-benefits.html" ]] || fail "Member Benefits HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-benefits.js" ]] || fail "Member Benefits JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-benefits.css" ]] || fail "Member Benefits CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-benefit-management.html" ]] || fail "Benefit Management HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-benefit-management.js" ]] || fail "Benefit Management JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-benefit-management.css" ]] || fail "Benefit Management CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise.html" ]] || fail "Member Enterprise HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise.js" ]] || fail "Member Enterprise JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise.css" ]] || fail "Member Enterprise CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-command-center.html" ]] || fail "Enterprise Command Center HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-command-center.js" ]] || fail "Enterprise Command Center JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-command-center.css" ]] || fail "Enterprise Command Center CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-partner.html" ]] || fail "Partner Enterprise HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-partner.js" ]] || fail "Partner Enterprise JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-partner.css" ]] || fail "Partner Enterprise CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-goals.html" ]] || fail "Member Enterprise Goals HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-goals.js" ]] || fail "Member Enterprise Goals JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-goals.css" ]] || fail "Member Enterprise Goals CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-goals-admin.html" ]] || fail "Enterprise Goal Management HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-goals-admin.js" ]] || fail "Enterprise Goal Management JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-goals-admin.css" ]] || fail "Enterprise Goal Management CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-goals-partner.html" ]] || fail "Partner Enterprise Goal Analytics HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-goals-partner.js" ]] || fail "Partner Enterprise Goal Analytics JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-goals-partner.css" ]] || fail "Partner Enterprise Goal Analytics CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-invitations.html" ]] || fail "Enterprise Invitations HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-invitations.js" ]] || fail "Enterprise Invitations JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-invitations.css" ]] || fail "Enterprise Invitations CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-enrollment-admin.html" ]] || fail "Enterprise Enrollment Admin HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-enrollment-admin.js" ]] || fail "Enterprise Enrollment Admin JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-enrollment-admin.css" ]] || fail "Enterprise Enrollment Admin CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-enrollment-partner.html" ]] || fail "Enterprise Enrollment Partner HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-enrollment-partner.js" ]] || fail "Enterprise Enrollment Partner JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-enrollment-partner.css" ]] || fail "Enterprise Enrollment Partner CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-outcomes.html" ]] || fail "Enterprise Outcomes HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-outcomes.js" ]] || fail "Enterprise Outcomes JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-outcomes.css" ]] || fail "Enterprise Outcomes CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-outcomes-admin.html" ]] || fail "Enterprise Outcomes Admin HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-outcomes-admin.js" ]] || fail "Enterprise Outcomes Admin JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-outcomes-admin.css" ]] || fail "Enterprise Outcomes Admin CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-outcomes-partner.html" ]] || fail "Enterprise Outcomes Partner HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-outcomes-partner.js" ]] || fail "Enterprise Outcomes Partner JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-outcomes-partner.css" ]] || fail "Enterprise Outcomes Partner CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-support.html" ]] || fail "Enterprise Support HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-support.js" ]] || fail "Enterprise Support JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-support.css" ]] || fail "Enterprise Support CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-support-admin.html" ]] || fail "Enterprise Support Admin HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-support-admin.js" ]] || fail "Enterprise Support Admin JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-support-admin.css" ]] || fail "Enterprise Support Admin CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-support-partner.html" ]] || fail "Enterprise Support Partner HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-support-partner.js" ]] || fail "Enterprise Support Partner JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-enterprise-support-partner.css" ]] || fail "Enterprise Support Partner CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-membership-administration.html" ]] || fail "Membership Administration HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-membership-administration.js" ]] || fail "Membership Administration JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-membership-administration.css" ]] || fail "Membership Administration CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-membership-welcome.html" ]] || fail "Membership Welcome Center HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-membership-welcome.js" ]] || fail "Membership Welcome Center JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-membership-welcome.css" ]] || fail "Membership Welcome Center CSS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-membership-onboarding-admin.html" ]] || fail "Membership Onboarding Admin HTML missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-membership-onboarding-admin.js" ]] || fail "Membership Onboarding Admin JS missing from dist."
[[ -f "$WEB_ROOT/dist/nurselink-membership-onboarding-admin.css" ]] || fail "Membership Onboarding Admin CSS missing from dist."







grep -Rqs "standalone-routing-v321" "$WEB_ROOT/dist/assets" || fail "Built bundle is missing v5.5.2 JSON request runtime."

for marker in \
  "nurselink-runtime-v326" \
  "standalone-routing-v321" \
  "nurselink-profile-photo-card" \
  "nurselink-employment-history" \
  "nurselink-credential-registry" \
  "nurselink-qualification-readiness" \
  "nurselink-member-hub" \
  "nurselink-professional-portfolio" \
  "nurselink-career-matching" \
  "nurselink-learning-tracker" \
  "nurselink-opportunity-center" \
  "nurselink-applications-pipeline" \
  "nurselink-review-center" \
  "nurselink-digital-member-card" \
  "nurselink-notification-center" \
  "nurselink-public-profile-settings" \
  "nurselink-partner-portal-launcher" \
  "nurselink-application-communications" \
  "nurselink-production-uat-launcher" \
  "nurselink-operations-center-launcher" \
  "nurselink-career-intelligence-launcher" \
  "nurselink-super-admin-badge" \
  "nurselink/session-identity" \
  "public_auth_deferred" \
  "nurselink-notification-drawer" \
  "/smart-registration?nlstep=3" \
  "data-nurselink-notification-instant" \
  "data-nurselink-role-membership-clarity" \
  "Super Administrator Portal" \
  "data-nurselink-super-admin-portal-persistence" \
  "Admin Center" \
  "nurselink-admin-login.html"
do
  grep -Rqs "$marker" "$WEB_ROOT/dist/assets" \
    || fail "Built web implementation marker missing: $marker"
done

printf 'Build-persistent release marker [OK]\n'
printf 'Built cumulative NurseLink implementation [OK]\n'

grep -q "nurselink/admin/session-login" "$WEB_ROOT/dist/nurselink-admin-login.js" \
  || fail "Built Administrator Login dedicated endpoint missing."

grep -q "nurselink/admin/users/grant" "$WEB_ROOT/dist/nurselink-admin-dashboard.js" \
  || fail "Built Administrator Dashboard access-management controls missing."

grep -q "cannot_revoke_self" "$API_ROOT/app/Http/Controllers/Api/AdminPortalController.php" \
  || fail "Administrator access policy response missing self-revocation rule."

printf 'Built Administrator Portal implementation [OK]\n'

grep -q "NurseLinkPortalConfig" \
  "$WEB_ROOT/dist/nurselink-portal-config.js" \
  || fail "Built Portal Configuration missing."

grep -q "data-panel=\"membership\"" \
  "$WEB_ROOT/dist/nurselink-admin-dashboard.html" \
  || fail "Built consolidated Administrator membership panel missing."

grep -q "data-panel=\"onboarding\"" \
  "$WEB_ROOT/dist/nurselink-admin-dashboard.html" \
  || fail "Built consolidated Administrator onboarding panel missing."

grep -q "nurselink-member-portal-membership-v520" \
  "$WEB_ROOT/dist/assets/"*.js \
  || fail "Built Member Portal consolidation runtime missing."

printf 'Built two-portal consolidation [OK]\n'

grep -q "Administration Operations Center" \
  "$WEB_ROOT/dist/nurselink-admin-dashboard.html" \
  || fail "Built Administration Operations Center shell missing."

grep -q "/api/nurselink/admin/operations-center/summary" \
  "$WEB_ROOT/dist/nurselink-admin-dashboard.js" \
  || fail "Built Administration Operations Center summary integration missing."

grep -q "/api/nurselink/admin/operations-center/support-cases" \
  "$WEB_ROOT/dist/nurselink-admin-dashboard.js" \
  || fail "Built Support Cases integration missing."

printf 'Built Administration Operations Center [OK]\n'

grep -Rqs "NURSELINK_ADMIN_SPA_RESCUE_V532" \
  "$WEB_ROOT/dist/assets" \
  || fail "Built React bundle is missing Administrator SPA rescue."

grep -Rqs "nurselink-admin-spa-rescue-dashboard-v532" \
  "$WEB_ROOT/dist/assets" \
  || fail "Built React bundle is missing Administrator Dashboard rescue marker."

printf 'Built Administrator SPA fallback rescue [OK]\n'

grep -q "NURSELINK_ADMIN_INDEX_BOOTSTRAP_V533_START" \
  "$WEB_ROOT/dist/index.html" \
  || fail "Built Vite index is missing pre-React Administrator bootstrap."

python3 - "$WEB_ROOT/dist/index.html" <<'PYDISTINDEX533'
from pathlib import Path
import re
import sys

text = Path(sys.argv[1]).read_text(
    encoding="utf-8"
)

bootstrap = text.find(
    "NURSELINK_ADMIN_INDEX_BOOTSTRAP_V533_START"
)

module = re.search(
    r"<script\b[^>]*\btype=[\"']module[\"'][^>]*>",
    text,
    re.I,
)

if bootstrap < 0:
    raise SystemExit(
        "Built Administrator index bootstrap marker missing."
    )

if module and bootstrap > module.start():
    raise SystemExit(
        "Built Administrator index bootstrap is after the React module."
    )

print(
    "Built pre-React Administrator index bootstrap ordering [OK]"
)
PYDISTINDEX533

printf 'Built pre-React Administrator index bootstrap [OK]\n'

for name in \
  index.html \
  login.html \
  dashboard.js \
  login.js \
  portal-config.js \
  admin-portal.css \
  admin-consolidated.css \
  .htaccess
do
  [[ -f "$WEB_ROOT/dist/admin/$name" ]] \
    || fail "Built physical Administrator file missing: admin/$name"
done

grep -q "Administration Operations Center" \
  "$WEB_ROOT/dist/admin/index.html" \
  || fail "Built physical Administration Operations Center missing."

printf 'Built physical Administrator directory [OK]\n'





grep -q "api/notifications" "$WEB_ROOT/dist/nurselink-notifications.js" || fail "Built Notification Center API integration missing."
printf 'Built Notification Center implementation [OK]\n'

grep -q "membership-command/summary" \
  "$WEB_ROOT/dist/nurselink-membership-command-center.js" \
  || fail "Built Membership Command Center summary integration missing."

grep -q "confirm_self_action" \
  "$WEB_ROOT/dist/nurselink-membership-command-center.js" \
  || fail "Built Membership Command Center self-action confirmation missing."

grep -q "Membership Review & Approval Command Center" \
  "$WEB_ROOT/dist/nurselink-membership-command-center.html" \
  || fail "Built Membership Command Center content missing."

printf 'Built Membership Command Center implementation [OK]\n'

grep -q "member-registry/summary" \
  "$WEB_ROOT/dist/nurselink-member-registry.js" \
  || fail "Built Member Registry summary integration missing."

grep -q "text/csv;charset=utf-8" \
  "$WEB_ROOT/dist/nurselink-member-registry.js" \
  || fail "Built Member Registry CSV export missing."

grep -q "Privacy boundary" \
  "$WEB_ROOT/dist/nurselink-member-registry.html" \
  || fail "Built Member Registry privacy disclosure missing."

printf 'Built Member Registry implementation [OK]\n'

grep -q "membership-lifecycle/" \
  "$WEB_ROOT/dist/nurselink-member-registry.js" \
  || fail "Built Member Registry lifecycle integration missing."

grep -q "VERIFIED NURSELINK MEMBERSHIP RECORD" \
  "$WEB_ROOT/dist/nurselink-member-verify.js" \
  || fail "Built public membership standing verification missing."

grep -Rqs "nurselink-membership-standing-alert" \
  "$WEB_ROOT/dist/assets" \
  || fail "Built main bundle membership standing alert missing."

printf 'Built Membership Lifecycle implementation [OK]\n'

grep -q "/api/credential-renewal" \
  "$WEB_ROOT/dist/nurselink-credential-renewal.js" \
  || fail "Built Credential Renewal API integration missing."

grep -q "PROFESSIONAL COMPLIANCE PLANNING" \
  "$WEB_ROOT/dist/nurselink-credential-renewal.html" \
  || fail "Built Credential Renewal Center content missing."

grep -Rqs "nurselink-credential-renewal-launcher-v461" \
  "$WEB_ROOT/dist/assets" \
  || fail "Built Credential Renewal launcher runtime missing."

printf 'Built Credential Renewal Center [OK]\n'

grep -q "data-renewal-form" \
  "$WEB_ROOT/dist/nurselink-credential-renewal.js" \
  || fail "Built Credential Renewal workflow UI missing."

grep -q "Credential Compliance Center" \
  "$WEB_ROOT/dist/nurselink-credential-compliance.html" \
  || fail "Built Credential Compliance Center content missing."

grep -q "text/csv;charset=utf-8" \
  "$WEB_ROOT/dist/nurselink-credential-compliance.js" \
  || fail "Built Credential Compliance CSV export missing."

printf 'Built Credential Renewal workflow [OK]\n'
printf 'Built Credential Compliance Center [OK]\n'

grep -q "/api/events" \
  "$WEB_ROOT/dist/nurselink-events.js" \
  || fail "Built Events & Programs API integration missing."

grep -q "Events & Programs" \
  "$WEB_ROOT/dist/nurselink-events.html" \
  || fail "Built Events & Programs content missing."

grep -q "nurselink/admin/events" \
  "$WEB_ROOT/dist/nurselink-event-management.js" \
  || fail "Built Event Management API integration missing."

grep -Rqs "nurselink-events-programs-launcher-v471" \
  "$WEB_ROOT/dist/assets" \
  || fail "Built Events & Programs launcher runtime missing."

printf 'Built Events & Programs Center [OK]\n'
printf 'Built Event Management Center [OK]\n'

grep -q "/api/chapters" \
  "$WEB_ROOT/dist/nurselink-chapters.js" \
  || fail "Built Chapters & Communities API integration missing."

grep -q "nurselink/admin/chapters" \
  "$WEB_ROOT/dist/nurselink-chapter-management.js" \
  || fail "Built Chapter Management API integration missing."

grep -Rqs "nurselink-chapters-launcher-v472" \
  "$WEB_ROOT/dist/assets" \
  || fail "Built Chapters & Communities launcher runtime missing."

printf 'Built Chapters & Communities Center [OK]\n'
printf 'Built Chapter Management Center [OK]\n'

grep -q "/api/mentoring/requests" \
  "$WEB_ROOT/dist/nurselink-mentoring.js" \
  || fail "Built Mentoring request workflow missing."

grep -Rqs "nurselink-mentoring-launcher-v473" \
  "$WEB_ROOT/dist/assets" \
  || fail "Built Mentoring launcher runtime missing."

printf 'Built Mentoring & Peer Support Center [OK]\n'

grep -q "/api/engagement" \
  "$WEB_ROOT/dist/nurselink-engagement.js" \
  || fail "Built Member Engagement API integration missing."

grep -q "nurselink/admin/engagement/summary" \
  "$WEB_ROOT/dist/nurselink-engagement-command-center.js" \
  || fail "Built Engagement Command Center API integration missing."

grep -Rqs "nurselink-engagement-hub-v480" \
  "$WEB_ROOT/dist/assets" \
  || fail "Built Member Engagement Hub launcher runtime missing."

printf 'Built Member Engagement Hub [OK]\n'
printf 'Built Engagement Command Center [OK]\n'

grep -q "/api/benefits" \
  "$WEB_ROOT/dist/nurselink-benefits.js" \
  || fail "Built Member Benefits API integration missing."

grep -q "nurselink/admin/benefits" \
  "$WEB_ROOT/dist/nurselink-benefit-management.js" \
  || fail "Built Benefit Management API integration missing."

grep -Rqs "nurselink-benefits-launcher-v482" \
  "$WEB_ROOT/dist/assets" \
  || fail "Built Member Benefits launcher runtime missing."

printf 'Built Member Benefits & Resources Center [OK]\n'
printf 'Built Benefit Management Center [OK]\n'

grep -q "/api/benefits/intelligence" \
  "$WEB_ROOT/dist/nurselink-benefits.js" \
  || fail "Built Benefit Intelligence integration missing."

grep -q "/api/nurselink/admin/benefits/summary" \
  "$WEB_ROOT/dist/nurselink-benefit-management.js" \
  || fail "Built Benefit Analytics integration missing."

grep -q "nurselink-benefit-intelligence-v483" \
  "$WEB_ROOT/dist/nurselink-benefits.css" \
  || fail "Built Benefit Intelligence CSS marker missing."

printf 'Built Saved Benefits & Intelligence [OK]\n'
printf 'Built Benefit Analytics [OK]\n'

grep -q "/api/nurselink/admin/benefits/reminders/generate" \
  "$WEB_ROOT/dist/nurselink-benefit-management.js" \
  || fail "Built Benefit Reminder generator missing."

printf 'Built Benefit Reminder controls [OK]\n'

grep -q "/api/engagement/timeline" \
  "$WEB_ROOT/dist/nurselink-engagement.js" \
  || fail "Built Member Engagement Timeline integration missing."

grep -q "/api/nurselink/admin/engagement/activity-summary" \
  "$WEB_ROOT/dist/nurselink-engagement-command-center.js" \
  || fail "Built Engagement Activity admin integration missing."

printf 'Built Member Engagement Timeline [OK]\n'
printf 'Built Engagement Activity analytics [OK]\n'

grep -q "/api/enterprise/me" \
  "$WEB_ROOT/dist/nurselink-enterprise.js" \
  || fail "Built Enterprise member integration missing."

grep -q "/api/nurselink/admin/enterprise/cohorts" \
  "$WEB_ROOT/dist/nurselink-enterprise-command-center.js" \
  || fail "Built Enterprise Command Center integration missing."

grep -q "/api/partner/enterprise" \
  "$WEB_ROOT/dist/nurselink-enterprise-partner.js" \
  || fail "Built Enterprise Partner Analytics integration missing."

grep -Rqs "nurselink-enterprise-launcher-v500" \
  "$WEB_ROOT/dist/assets" \
  || fail "Built Enterprise member launcher runtime missing."

printf 'Built Enterprise member portal [OK]\n'
printf 'Built Enterprise Command Center [OK]\n'
printf 'Built Enterprise Partner Analytics [OK]\n'

grep -q "/api/enterprise/goals" \
  "$WEB_ROOT/dist/nurselink-enterprise-goals.js" \
  || fail "Built Enterprise member goals integration missing."

grep -q "/api/nurselink/admin/enterprise/cohorts/" \
  "$WEB_ROOT/dist/nurselink-enterprise-goals-admin.js" \
  || fail "Built Enterprise Goal Management integration missing."

grep -q "/api/partner/enterprise/goals" \
  "$WEB_ROOT/dist/nurselink-enterprise-goals-partner.js" \
  || fail "Built Enterprise Partner Goal Analytics integration missing."

printf 'Built Enterprise member goals [OK]\n'
printf 'Built Enterprise Goal Management [OK]\n'
printf 'Built Enterprise Partner Goal Analytics [OK]\n'

grep -q "/api/enterprise/invitations" \
  "$WEB_ROOT/dist/nurselink-enterprise-invitations.js" \
  || fail "Built Enterprise Invitations member integration missing."

grep -q "/api/nurselink/admin/enterprise/enrollment-summary" \
  "$WEB_ROOT/dist/nurselink-enterprise-enrollment-admin.js" \
  || fail "Built Enterprise Enrollment admin integration missing."

grep -q "/api/partner/enterprise/enrollment-summary" \
  "$WEB_ROOT/dist/nurselink-enterprise-enrollment-partner.js" \
  || fail "Built Enterprise Enrollment partner reporting missing."

printf 'Built Enterprise Invitations [OK]\n'
printf 'Built Enterprise Enrollment Admin [OK]\n'
printf 'Built Enterprise Enrollment Partner Reporting [OK]\n'

grep -q "/api/enterprise/outcomes" \
  "$WEB_ROOT/dist/nurselink-enterprise-outcomes.js" \
  || fail "Built Enterprise Outcomes member integration missing."

grep -q "/api/nurselink/admin/enterprise/cohorts/" \
  "$WEB_ROOT/dist/nurselink-enterprise-outcomes-admin.js" \
  || fail "Built Enterprise Outcomes admin integration missing."

grep -q "/api/partner/enterprise/outcomes" \
  "$WEB_ROOT/dist/nurselink-enterprise-outcomes-partner.js" \
  || fail "Built Enterprise Outcomes partner analytics missing."

printf 'Built Enterprise Outcomes Member [OK]\n'
printf 'Built Enterprise Outcomes Admin [OK]\n'
printf 'Built Enterprise Outcomes Partner Analytics [OK]\n'

grep -q "/api/enterprise/support" \
  "$WEB_ROOT/dist/nurselink-enterprise-support.js" \
  || fail "Built Enterprise Support member integration missing."

grep -q "/api/nurselink/admin/enterprise/support" \
  "$WEB_ROOT/dist/nurselink-enterprise-support-admin.js" \
  || fail "Built Enterprise Support admin integration missing."

grep -q "/api/partner/enterprise/support-summary" \
  "$WEB_ROOT/dist/nurselink-enterprise-support-partner.js" \
  || fail "Built Enterprise Support partner analytics missing."

printf 'Built Enterprise Support Member [OK]\n'
printf 'Built Enterprise Support Admin [OK]\n'
printf 'Built Enterprise Support Partner Analytics [OK]\n'

grep -q "/api/nurselink/admin/membership-administration/overview" \
  "$WEB_ROOT/dist/nurselink-membership-administration.js" \
  || fail "Built Membership Administration overview integration missing."

grep -q "/api/nurselink/admin/users/grant" \
  "$WEB_ROOT/dist/nurselink-membership-administration.js" \
  || fail "Built Membership Administration role-management integration missing."

printf 'Built Membership Administration Suite [OK]\n'

grep -q "/api/membership/onboarding" \
  "$WEB_ROOT/dist/nurselink-membership-welcome.js" \
  || fail "Built Membership Welcome Center integration missing."

grep -q "/api/nurselink/admin/membership-onboarding" \
  "$WEB_ROOT/dist/nurselink-membership-onboarding-admin.js" \
  || fail "Built Membership Onboarding Admin integration missing."

printf 'Built Membership Welcome Center [OK]\n'
printf 'Built Membership Onboarding Admin [OK]\n'



















grep -q "nurselink/admin/test-mode/start" \
  "$WEB_ROOT/dist/nurselink-super-admin-test-center.js" \
  || fail "Built Super Admin Test Center start endpoint missing."

grep -q "SAFE_TESTS" \
  "$WEB_ROOT/dist/nurselink-super-admin-test-center.js" \
  || fail "Built Super Admin safe functional test runner missing."

grep -q "MEMBERSHIP APPROVAL TEST" \
  "$WEB_ROOT/dist/nurselink-super-admin-test-center.html" \
  || fail "Built membership approval test workflow launcher missing."

printf 'Built Super Administrator Test Center [OK]\n'





grep -Rqs "nurselink-runtime-v326" "$WEB_ROOT/dist/assets" \
  || fail "Vite removed the v5.5.2 build-persistent runtime unexpectedly."

printf 'Vite runtime retention [OK]\n'

grep -Rqs "data-nurselink-release" "$WEB_ROOT/dist/assets" \
  || fail "Built bundle is missing v5.5.2 release runtime."

grep -Rqs "5.5.2" "$WEB_ROOT/dist/assets" \
  || fail "Built bundle is missing v5.5.2 release value."

printf 'v5.5.2 built release runtime [OK]\n'

grep -Rqs "data-nurselink-production" "$WEB_ROOT/dist/assets" \
  || fail "Built bundle is missing production-stable runtime marker."

grep -Rqs "stable" "$WEB_ROOT/dist/assets" \
  || fail "Built bundle is missing production-stable value."

printf 'Built production-stable runtime [OK]\n'


grep -Rqs "production" "$WEB_ROOT/dist/assets" \
  || fail "Built bundle is missing Production release stage."

printf 'Built Production release stage [OK]\n'


 

say "Deploying production web build"

rm -rf "$LIVE_ROOT/assets"
cp -a "$WEB_ROOT/dist/." "$LIVE_ROOT/"

say "Hardening Administrator entry-point deployment"

ADMIN_ENTRY_FILES=(
  nurselink-admin-login.html
  nurselink-admin-login.js
  nurselink-admin-dashboard.html
  nurselink-admin-dashboard.js
  nurselink-portal-config.js
  nurselink-admin-portal.css
  nurselink-admin-consolidated.css
)

for name in "${ADMIN_ENTRY_FILES[@]}"; do
  [[ -f "$PAYLOAD_DIR/$name" ]] \
    || fail "Administrator entry payload missing: $name"

  cp -f "$PAYLOAD_DIR/$name" "$LIVE_ROOT/$name" \
    || fail "Unable to force-deploy Administrator entry file: $name"

  [[ -f "$LIVE_ROOT/$name" ]] \
    || fail "Administrator entry file missing after force-deploy: $name"

  cmp -s "$PAYLOAD_DIR/$name" "$LIVE_ROOT/$name" \
    || fail "Administrator entry file differs from payload after deployment: $name"
done

printf 'Administrator entry files force-deployed from payload [OK]\n'

rm -rf "$LIVE_ROOT/admin"
mkdir -p "$LIVE_ROOT/admin"
cp -a "$PAYLOAD_DIR/admin/." "$LIVE_ROOT/admin/" \
  || fail "Unable to force-deploy physical Administrator directory."

for name in \
  index.html \
  login.html \
  dashboard.js \
  login.js \
  portal-config.js \
  admin-portal.css \
  admin-consolidated.css \
  .htaccess
do
  [[ -f "$LIVE_ROOT/admin/$name" ]] \
    || fail "Live physical Administrator file missing after force-deploy: admin/$name"

  cmp -s "$PAYLOAD_DIR/admin/$name" "$LIVE_ROOT/admin/$name" \
    || fail "Live physical Administrator file differs from payload: admin/$name"
done

printf 'Physical Administrator directory force-deployed [OK]\n'
grep -q "NURSELINK_ADMIN_LIGHT_BLUE_V538_START" \
  "$LIVE_ROOT/admin/admin-portal.css" \
  || fail "Live Administrator light-blue base theme missing."

grep -q "NURSELINK_ADMIN_LIGHT_BLUE_V538_START" \
  "$LIVE_ROOT/admin/admin-consolidated.css" \
  || fail "Live Administrator light-blue Operations Center theme missing."

printf 'Live Administrator light-blue theme [OK]\n'
grep -q "Membership Processing Progress" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "Live v5.5.2 Membership Processing Progress panel missing."

grep -q "NURSELINK_ADMIN_PROGRESS_SUMMARY_V540_START" \
  "$LIVE_ROOT/admin/admin-consolidated.css" \
  || fail "Live v5.5.2 Administrator progress-summary styling missing."

printf 'Live v5.5.2 Administration dashboard milestone [OK]\n'
grep -q "nl-admin-session-pending" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "Live Administrator protected shell does not start locked."

grep -q "NURSELINK_ADMIN_SESSION_GATE_V541_START" \
  "$LIVE_ROOT/admin/admin-consolidated.css" \
  || fail "Live Administrator session gate styling missing."

grep -q "revealAdministratorPortal" \
  "$LIVE_ROOT/admin/dashboard.js" \
  || fail "Live Administrator delayed portal reveal workflow missing."

printf 'Live v5.5.2 Administrator no-flash session gate [OK]\n'
grep -q "nl-admin-auth-links-single" \
  "$LIVE_ROOT/admin/login.html" \
  || fail "Live Administrator single Member / Applicant link wrapper missing."

grep -q "NURSELINK_ADMIN_LOGIN_SINGLE_MEMBER_LINK_V541_START" \
  "$LIVE_ROOT/admin/admin-portal.css" \
  || fail "Live Administrator single-link styling missing."

printf 'Live Administrator single Member / Applicant link [OK]\n'
grep -q "adminGlobalSearch" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "Live v5.5.2 Administrator global search input missing."

grep -q "NURSELINK_ADMIN_WORKBENCH_V542_START" \
  "$LIVE_ROOT/admin/admin-consolidated.css" \
  || fail "Live v5.5.2 Administrator workbench styling missing."

grep -q "runGlobalSearch" \
  "$LIVE_ROOT/admin/dashboard.js" \
  || fail "Live v5.5.2 Administrator global-search workflow missing."

printf 'Live v5.5.2 Administrator workbench [OK]\n'
grep -q "applicationCommandMetrics" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "Live v5.5.2 Applications Command Center KPI strip missing."

grep -q "applicationDetailDrawer" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "Live v5.5.2 Applications detail drawer missing."

grep -q "NURSELINK_APPLICATIONS_COMMAND_CENTER_V550_START" \
  "$LIVE_ROOT/admin/admin-consolidated.css" \
  || fail "Live v5.5.2 Applications Command Center styling missing."

grep -q "renderApplicationTable" \
  "$LIVE_ROOT/admin/dashboard.js" \
  || fail "Live v5.5.2 Applications professional table workflow missing."

printf 'Live v5.5.2 Applications Command Center [OK]\n'
grep -q "applicationWorkloadSection" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "Live v5.5.2 reviewer workload panel missing."

grep -q "applicationSavedView" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "Live v5.5.2 saved application views missing."

grep -q "NURSELINK_APPLICATION_TRIAGE_V552_START" \
  "$LIVE_ROOT/admin/admin-consolidated.css" \
  || fail "Live v5.5.2 Applications triage styling missing."

grep -q "renderApplicationWorkload" \
  "$LIVE_ROOT/admin/dashboard.js" \
  || fail "Live v5.5.2 reviewer workload workflow missing."

grep -q "exportApplicationQueue" \
  "$LIVE_ROOT/admin/dashboard.js" \
  || fail "Live v5.5.2 controlled export workflow missing."

printf 'Live v5.5.2 Applications triage/workload/export [OK]\n'










say "Installing standalone-page SPA bypass"

python3 - "$LIVE_ROOT/.htaccess" "$SCRIPT_DIR/standalone_pages_v321.htaccess" <<'PYSPA'
from pathlib import Path
import re
import sys

target = Path(sys.argv[1])
block = Path(sys.argv[2]).read_text(encoding="utf-8").strip()
text = target.read_text(encoding="utf-8") if target.exists() else ""

pattern = re.compile(
    r"# NURSELINK_STANDALONE_PAGES_V321_START.*?"
    r"# NURSELINK_STANDALONE_PAGES_V321_END",
    re.S,
)

# Remove an older copy wherever it exists, then prepend the current block.
text = pattern.sub("", text).lstrip()

if text:
    text = block + "\n\n" + text
else:
    text = block + "\n"

target.write_text(text, encoding="utf-8")
PYSPA

[[ -f "$LIVE_ROOT/.htaccess" ]] || fail "Live .htaccess missing after standalone-page policy installation."

python3 - "$LIVE_ROOT/.htaccess" <<'PYORDER'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8").lstrip()

if not text.startswith("# NURSELINK_STANDALONE_PAGES_V321_START"):
    raise SystemExit(
        "Standalone-page rewrite bypass is not before the SPA fallback."
    )

print("Standalone routing policy order [OK]")
PYORDER

grep -q "NURSELINK_STANDALONE_PAGES_V321_START" "$LIVE_ROOT/.htaccess" \
  || fail "Standalone-page routing marker missing from live .htaccess."

say "Verifying installed standalone route protection"

[[ -f "$LIVE_ROOT/.htaccess" ]] \
  || fail "Live .htaccess is missing after standalone routing installation."

grep -q "NURSELINK_STANDALONE_PAGES_V321_START" "$LIVE_ROOT/.htaccess" \
  || fail "Standalone page route protection is not installed."

python3 - "$LIVE_ROOT/.htaccess" <<'PYV324'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8").lstrip()

if not text.startswith("# NURSELINK_STANDALONE_PAGES_V321_START"):
    raise SystemExit("Standalone routing policy is not first in live .htaccess.")

for item in (
    "RewriteRule ^nurselink-admin-login\\.html$ - [END]",
    "RewriteRule ^nurselink-admin-dashboard\\.html$ - [END]",
    "RewriteCond %{REQUEST_FILENAME} -f",
    "RewriteCond %{REQUEST_FILENAME} -d",
    "RewriteRule ^ - [END]",
):
    if item not in text:
        raise SystemExit(f"Required standalone routing directive missing: {item}")

print("Standalone route protection installed [OK]")
PYV324

printf 'Standalone page SPA bypass [OK]\n'
printf 'Routing policy installed before validation [OK]\n'

say "Installing browser cache-busting policy"

python3 - "$LIVE_ROOT/.htaccess" "$SCRIPT_DIR/cache_policy_v263.htaccess" <<'PYHT'
from pathlib import Path
import re
import sys

target = Path(sys.argv[1])
block = Path(sys.argv[2]).read_text(encoding="utf-8").strip()
text = target.read_text(encoding="utf-8") if target.exists() else ""
pattern = re.compile(r"# NURSELINK_CACHE_POLICY_V263_START.*?# NURSELINK_CACHE_POLICY_V263_END", re.S)

if pattern.search(text):
    text = pattern.sub(block, text)
else:
    if text and not text.endswith("\\n"):
        text += "\\n"
    if text:
        text += "\\n"
    text += block + "\\n"

target.write_text(text, encoding="utf-8")
PYHT

[[ -f "$LIVE_ROOT/.htaccess" ]] || fail "Live .htaccess missing after cache-policy installation."
grep -q "NURSELINK_CACHE_POLICY_V263_START" "$LIVE_ROOT/.htaccess" \
  || fail "NurseLink cache-policy marker missing from live .htaccess."

python3 - "$LIVE_ROOT/.htaccess" <<'PYLIVECACHE325'
from pathlib import Path
import re
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")

start = "# NURSELINK_CACHE_POLICY_V263_START"
end = "# NURSELINK_CACHE_POLICY_V263_END"

if start not in text or end not in text:
    raise SystemExit("Live NurseLink cache-policy block is incomplete.")

block = text.split(start, 1)[1].split(end, 1)[0]

rules = re.findall(
    r'<FilesMatch\s+"([^"]+)">(.*?)</FilesMatch>',
    block,
    re.S,
)

pages = (
    "index.html",
    "nurselink-public-profile.html",
    "nurselink-partner-portal.html",
    "nurselink-institutional-analytics.html",
    "nurselink-member-verify.html",
    "nurselink-production-readiness.html",
    "nurselink-operations-center.html",
    "nurselink-career-intelligence.html",
    "nurselink-admin-login.html",
    "nurselink-admin-dashboard.html",
    "nurselink-notifications.html",
    "nurselink-membership-command-center.html",
    "nurselink-member-registry.html",
    "nurselink-super-admin-test-center.html",
    "nurselink-credential-renewal.html",
    "nurselink-credential-compliance.html",
    "nurselink-events.html",
    "nurselink-event-management.html",
    "nurselink-chapters.html",
    "nurselink-chapter-management.html",
    "nurselink-mentoring.html",
    "nurselink-engagement.html",
    "nurselink-engagement-command-center.html",
    "nurselink-benefits.html",
    "nurselink-benefit-management.html",
)

covered = False

for pattern, body in rules:
    try:
        compiled = re.compile(pattern)
    except re.error:
        continue

    if all(compiled.fullmatch(name) for name in pages):
        if 'no-cache, no-store, must-revalidate' not in body:
            raise SystemExit(
                "Live standalone HTML cache rule is missing no-cache Cache-Control."
            )
        covered = True
        break

if not covered:
    raise SystemExit(
        "Live cache policy does not cover all standalone NurseLink HTML pages."
    )

print("Live standalone HTML cache policy [OK]")
PYLIVECACHE325

say "Installing baseline browser security headers"

python3 - "$LIVE_ROOT/.htaccess" "$SCRIPT_DIR/security_headers_v330.htaccess" <<'PYSECINSTALL330'
from pathlib import Path
import re
import sys

target = Path(sys.argv[1])
block = Path(sys.argv[2]).read_text(encoding="utf-8").strip()
text = target.read_text(encoding="utf-8") if target.exists() else ""

pattern = re.compile(
    r"# NURSELINK_SECURITY_HEADERS_V330_START.*?"
    r"# NURSELINK_SECURITY_HEADERS_V330_END",
    re.S,
)

if pattern.search(text):
    text = pattern.sub(block, text)
else:
    if text and not text.endswith("\n"):
        text += "\n"
    text += "\n" + block + "\n"

target.write_text(text, encoding="utf-8")
PYSECINSTALL330

grep -q "NURSELINK_SECURITY_HEADERS_V330_START" "$LIVE_ROOT/.htaccess" \
  || fail "Security headers policy marker missing from live .htaccess."

printf 'Baseline security headers policy installed [OK]\n'

SECURITY_HEADERS="$(curl -fsSI -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/?nlv=330' 2>/dev/null || true)"

for header in \
  "X-Content-Type-Options" \
  "Referrer-Policy" \
  "X-Frame-Options" \
  "X-Permitted-Cross-Domain-Policies" \
  "Permissions-Policy"
do
  if printf '%s\n' "$SECURITY_HEADERS" | grep -qi "^${header}:"; then
    printf 'Live header %s [OK]\n' "$header"
  else
    warn "Live response did not expose ${header}; review LiteSpeed/header-module behavior."
  fi
done

say "Post-deploy verification"

[[ -f "$LIVE_ROOT/index.html" ]] || fail "Live index missing."
[[ -d "$LIVE_ROOT/assets" ]] || fail "Live assets missing."
[[ -f "$LIVE_ROOT/nurselink-public-profile.html" ]] || fail "Live public profile HTML missing."
[[ -f "$LIVE_ROOT/nurselink-public-profile.js" ]] || fail "Live public profile JS missing."
[[ -f "$LIVE_ROOT/nurselink-public-profile.css" ]] || fail "Live public profile CSS missing."
[[ -f "$LIVE_ROOT/nurselink-partner-portal.html" ]] || fail "Live Partner Portal HTML missing."
[[ -f "$LIVE_ROOT/nurselink-partner-portal.js" ]] || fail "Live Partner Portal JS missing."
[[ -f "$LIVE_ROOT/nurselink-partner-portal.css" ]] || fail "Live Partner Portal CSS missing."
[[ -f "$LIVE_ROOT/nurselink-institutional-analytics.html" ]] || fail "Live institutional analytics HTML missing."
[[ -f "$LIVE_ROOT/nurselink-institutional-analytics.js" ]] || fail "Live institutional analytics JS missing."
[[ -f "$LIVE_ROOT/nurselink-institutional-analytics.css" ]] || fail "Live institutional analytics CSS missing."
[[ -f "$LIVE_ROOT/nurselink-qrcode.min.js" ]] || fail "Live QR library missing."
[[ -f "$LIVE_ROOT/nurselink-member-verify.html" ]] || fail "Live member verification HTML missing."
[[ -f "$LIVE_ROOT/nurselink-member-verify.js" ]] || fail "Live member verification JS missing."
[[ -f "$LIVE_ROOT/nurselink-member-verify.css" ]] || fail "Live member verification CSS missing."
[[ -f "$LIVE_ROOT/nurselink-production-readiness.html" ]] || fail "Live production readiness HTML missing."
[[ -f "$LIVE_ROOT/nurselink-production-readiness.js" ]] || fail "Live production readiness JS missing."
[[ -f "$LIVE_ROOT/nurselink-production-readiness.css" ]] || fail "Live production readiness CSS missing."
[[ -f "$LIVE_ROOT/nurselink-operations-center.html" ]] || fail "Live Operations Center HTML missing."
[[ -f "$LIVE_ROOT/nurselink-operations-center.js" ]] || fail "Live Operations Center JS missing."
[[ -f "$LIVE_ROOT/nurselink-operations-center.css" ]] || fail "Live Operations Center CSS missing."
[[ -f "$LIVE_ROOT/nurselink-admin-identity.js" ]] || fail "Live standalone Super Administrator identity JS missing."
[[ -f "$LIVE_ROOT/nurselink-admin-identity.css" ]] || fail "Live standalone Super Administrator identity CSS missing."
[[ -f "$LIVE_ROOT/nurselink-career-intelligence.html" ]] || fail "Live Career Intelligence HTML missing."
[[ -f "$LIVE_ROOT/nurselink-career-intelligence.js" ]] || fail "Live Career Intelligence JS missing."
[[ -f "$LIVE_ROOT/nurselink-career-intelligence.css" ]] || fail "Live Career Intelligence CSS missing."
[[ -f "$LIVE_ROOT/nurselink-admin-login.html" ]] || fail "Live Administrator Login HTML missing."
[[ -f "$LIVE_ROOT/nurselink-admin-login.js" ]] || fail "Live Administrator Login JS missing."
[[ -f "$LIVE_ROOT/nurselink-admin-dashboard.html" ]] || fail "Live Administrator Dashboard HTML missing."
[[ -f "$LIVE_ROOT/nurselink-admin-dashboard.js" ]] || fail "Live Administrator Dashboard JS missing."
[[ -f "$LIVE_ROOT/nurselink-admin-portal.css" ]] || fail "Live Administrator Portal CSS missing."
[[ -f "$LIVE_ROOT/nurselink-portal-config.js" ]] || fail "Live Portal Configuration missing."
[[ -f "$LIVE_ROOT/nurselink-admin-consolidated.css" ]] || fail "Live consolidated Administrator Portal CSS missing."

[[ -f "$LIVE_ROOT/nurselink-notifications.html" ]] || fail "Live Notification Center HTML missing."
[[ -f "$LIVE_ROOT/nurselink-notifications.js" ]] || fail "Live Notification Center JS missing."
[[ -f "$LIVE_ROOT/nurselink-notifications.css" ]] || fail "Live Notification Center CSS missing."
[[ -f "$LIVE_ROOT/nurselink-membership-command-center.html" ]] || fail "Live Membership Command Center HTML missing."
[[ -f "$LIVE_ROOT/nurselink-membership-command-center.js" ]] || fail "Live Membership Command Center JS missing."
[[ -f "$LIVE_ROOT/nurselink-membership-command-center.css" ]] || fail "Live Membership Command Center CSS missing."
[[ -f "$LIVE_ROOT/nurselink-member-registry.html" ]] || fail "Live Member Registry HTML missing."
[[ -f "$LIVE_ROOT/nurselink-member-registry.js" ]] || fail "Live Member Registry JS missing."
[[ -f "$LIVE_ROOT/nurselink-member-registry.css" ]] || fail "Live Member Registry CSS missing."
[[ -f "$LIVE_ROOT/nurselink-super-admin-test-center.html" ]] || fail "Live Super Admin Test Center HTML missing."
[[ -f "$LIVE_ROOT/nurselink-super-admin-test-center.js" ]] || fail "Live Super Admin Test Center JS missing."
[[ -f "$LIVE_ROOT/nurselink-super-admin-test-center.css" ]] || fail "Live Super Admin Test Center CSS missing."
[[ -f "$LIVE_ROOT/nurselink-credential-renewal.html" ]] || fail "Live Credential Renewal Center HTML missing."
[[ -f "$LIVE_ROOT/nurselink-credential-renewal.js" ]] || fail "Live Credential Renewal Center JS missing."
[[ -f "$LIVE_ROOT/nurselink-credential-renewal.css" ]] || fail "Live Credential Renewal Center CSS missing."
[[ -f "$LIVE_ROOT/nurselink-credential-compliance.html" ]] || fail "Live Credential Compliance Center HTML missing."
[[ -f "$LIVE_ROOT/nurselink-credential-compliance.js" ]] || fail "Live Credential Compliance Center JS missing."
[[ -f "$LIVE_ROOT/nurselink-credential-compliance.css" ]] || fail "Live Credential Compliance Center CSS missing."
[[ -f "$LIVE_ROOT/nurselink-events.html" ]] || fail "Live Events & Programs HTML missing."
[[ -f "$LIVE_ROOT/nurselink-events.js" ]] || fail "Live Events & Programs JS missing."
[[ -f "$LIVE_ROOT/nurselink-events.css" ]] || fail "Live Events & Programs CSS missing."
[[ -f "$LIVE_ROOT/nurselink-event-management.html" ]] || fail "Live Event Management HTML missing."
[[ -f "$LIVE_ROOT/nurselink-event-management.js" ]] || fail "Live Event Management JS missing."
[[ -f "$LIVE_ROOT/nurselink-event-management.css" ]] || fail "Live Event Management CSS missing."
[[ -f "$LIVE_ROOT/nurselink-chapters.html" ]] || fail "Live Chapters & Communities HTML missing."
[[ -f "$LIVE_ROOT/nurselink-chapters.js" ]] || fail "Live Chapters & Communities JS missing."
[[ -f "$LIVE_ROOT/nurselink-chapters.css" ]] || fail "Live Chapters & Communities CSS missing."
[[ -f "$LIVE_ROOT/nurselink-chapter-management.html" ]] || fail "Live Chapter Management HTML missing."
[[ -f "$LIVE_ROOT/nurselink-chapter-management.js" ]] || fail "Live Chapter Management JS missing."
[[ -f "$LIVE_ROOT/nurselink-chapter-management.css" ]] || fail "Live Chapter Management CSS missing."
[[ -f "$LIVE_ROOT/nurselink-mentoring.html" ]] || fail "Live Mentoring HTML missing."
[[ -f "$LIVE_ROOT/nurselink-mentoring.js" ]] || fail "Live Mentoring JS missing."
[[ -f "$LIVE_ROOT/nurselink-mentoring.css" ]] || fail "Live Mentoring CSS missing."
[[ -f "$LIVE_ROOT/nurselink-engagement.html" ]] || fail "Live Member Engagement Hub HTML missing."
[[ -f "$LIVE_ROOT/nurselink-engagement.js" ]] || fail "Live Member Engagement Hub JS missing."
[[ -f "$LIVE_ROOT/nurselink-engagement.css" ]] || fail "Live Member Engagement Hub CSS missing."
[[ -f "$LIVE_ROOT/nurselink-engagement-command-center.html" ]] || fail "Live Engagement Command Center HTML missing."
[[ -f "$LIVE_ROOT/nurselink-engagement-command-center.js" ]] || fail "Live Engagement Command Center JS missing."
[[ -f "$LIVE_ROOT/nurselink-engagement-command-center.css" ]] || fail "Live Engagement Command Center CSS missing."
[[ -f "$LIVE_ROOT/nurselink-benefits.html" ]] || fail "Live Member Benefits HTML missing."
[[ -f "$LIVE_ROOT/nurselink-benefits.js" ]] || fail "Live Member Benefits JS missing."
[[ -f "$LIVE_ROOT/nurselink-benefits.css" ]] || fail "Live Member Benefits CSS missing."
[[ -f "$LIVE_ROOT/nurselink-benefit-management.html" ]] || fail "Live Benefit Management HTML missing."
[[ -f "$LIVE_ROOT/nurselink-benefit-management.js" ]] || fail "Live Benefit Management JS missing."
[[ -f "$LIVE_ROOT/nurselink-benefit-management.css" ]] || fail "Live Benefit Management CSS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise.html" ]] || fail "Live Member Enterprise HTML missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise.js" ]] || fail "Live Member Enterprise JS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise.css" ]] || fail "Live Member Enterprise CSS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-command-center.html" ]] || fail "Live Enterprise Command Center HTML missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-command-center.js" ]] || fail "Live Enterprise Command Center JS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-command-center.css" ]] || fail "Live Enterprise Command Center CSS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-partner.html" ]] || fail "Live Partner Enterprise HTML missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-partner.js" ]] || fail "Live Partner Enterprise JS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-partner.css" ]] || fail "Live Partner Enterprise CSS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-goals.html" ]] || fail "Live Member Enterprise Goals HTML missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-goals.js" ]] || fail "Live Member Enterprise Goals JS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-goals.css" ]] || fail "Live Member Enterprise Goals CSS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-goals-admin.html" ]] || fail "Live Enterprise Goal Management HTML missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-goals-admin.js" ]] || fail "Live Enterprise Goal Management JS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-goals-admin.css" ]] || fail "Live Enterprise Goal Management CSS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-goals-partner.html" ]] || fail "Live Partner Enterprise Goal Analytics HTML missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-goals-partner.js" ]] || fail "Live Partner Enterprise Goal Analytics JS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-goals-partner.css" ]] || fail "Live Partner Enterprise Goal Analytics CSS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-invitations.html" ]] || fail "Live Enterprise Invitations HTML missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-invitations.js" ]] || fail "Live Enterprise Invitations JS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-invitations.css" ]] || fail "Live Enterprise Invitations CSS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-enrollment-admin.html" ]] || fail "Live Enterprise Enrollment Admin HTML missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-enrollment-admin.js" ]] || fail "Live Enterprise Enrollment Admin JS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-enrollment-admin.css" ]] || fail "Live Enterprise Enrollment Admin CSS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-enrollment-partner.html" ]] || fail "Live Enterprise Enrollment Partner HTML missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-enrollment-partner.js" ]] || fail "Live Enterprise Enrollment Partner JS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-enrollment-partner.css" ]] || fail "Live Enterprise Enrollment Partner CSS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-outcomes.html" ]] || fail "Live Enterprise Outcomes HTML missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-outcomes.js" ]] || fail "Live Enterprise Outcomes JS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-outcomes.css" ]] || fail "Live Enterprise Outcomes CSS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-outcomes-admin.html" ]] || fail "Live Enterprise Outcomes Admin HTML missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-outcomes-admin.js" ]] || fail "Live Enterprise Outcomes Admin JS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-outcomes-admin.css" ]] || fail "Live Enterprise Outcomes Admin CSS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-outcomes-partner.html" ]] || fail "Live Enterprise Outcomes Partner HTML missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-outcomes-partner.js" ]] || fail "Live Enterprise Outcomes Partner JS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-outcomes-partner.css" ]] || fail "Live Enterprise Outcomes Partner CSS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-support.html" ]] || fail "Live Enterprise Support HTML missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-support.js" ]] || fail "Live Enterprise Support JS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-support.css" ]] || fail "Live Enterprise Support CSS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-support-admin.html" ]] || fail "Live Enterprise Support Admin HTML missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-support-admin.js" ]] || fail "Live Enterprise Support Admin JS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-support-admin.css" ]] || fail "Live Enterprise Support Admin CSS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-support-partner.html" ]] || fail "Live Enterprise Support Partner HTML missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-support-partner.js" ]] || fail "Live Enterprise Support Partner JS missing."
[[ -f "$LIVE_ROOT/nurselink-enterprise-support-partner.css" ]] || fail "Live Enterprise Support Partner CSS missing."
[[ -f "$LIVE_ROOT/nurselink-membership-administration.html" ]] || fail "Live Membership Administration HTML missing."
[[ -f "$LIVE_ROOT/nurselink-membership-administration.js" ]] || fail "Live Membership Administration JS missing."
[[ -f "$LIVE_ROOT/nurselink-membership-administration.css" ]] || fail "Live Membership Administration CSS missing."
[[ -f "$LIVE_ROOT/nurselink-membership-welcome.html" ]] || fail "Live Membership Welcome Center HTML missing."
[[ -f "$LIVE_ROOT/nurselink-membership-welcome.js" ]] || fail "Live Membership Welcome Center JS missing."
[[ -f "$LIVE_ROOT/nurselink-membership-welcome.css" ]] || fail "Live Membership Welcome Center CSS missing."
[[ -f "$LIVE_ROOT/nurselink-membership-onboarding-admin.html" ]] || fail "Live Membership Onboarding Admin HTML missing."
[[ -f "$LIVE_ROOT/nurselink-membership-onboarding-admin.js" ]] || fail "Live Membership Onboarding Admin JS missing."
[[ -f "$LIVE_ROOT/nurselink-membership-onboarding-admin.css" ]] || fail "Live Membership Onboarding Admin CSS missing."








say "Verifying live standalone HTML responses"

READINESS_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-production-readiness.html?nlv=325')"

printf '%s' "$READINESS_BODY" | grep -q "Production UAT & Operations Readiness" \
  || fail "Live UAT URL is not serving the NurseLink Production Readiness HTML."

printf '%s' "$READINESS_BODY" | grep -q 'nurselink-production-readiness.js' \
  || fail "Live UAT URL is being rewritten to the SPA index instead of the standalone page."

if printf '%s' "$READINESS_BODY" | grep -Eq 'src="/assets/index-[^"]+\.js"'; then
  fail "Live UAT URL still resolves to the React SPA index bundle."
fi

PARTNER_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-partner-portal.html?nlv=325')"

printf '%s' "$PARTNER_BODY" | grep -q 'nurselink-partner-portal.js' \
  || fail "Partner Portal standalone HTML is being rewritten to the SPA index."

ANALYTICS_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-institutional-analytics.html?nlv=325')"

printf '%s' "$ANALYTICS_BODY" | grep -q 'nurselink-institutional-analytics.js' \
  || fail "Institutional Analytics standalone HTML is being rewritten to the SPA index."

OPERATIONS_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-operations-center.html?nlv=410')"

printf '%s' "$OPERATIONS_BODY" | grep -q 'nurselink-operations-center.js' \
  || fail "Operations Center standalone HTML is being rewritten to the SPA index."

printf '%s' "$OPERATIONS_BODY" | grep -q 'Operations Center' \
  || fail "Operations Center standalone content missing."

CAREER_INTELLIGENCE_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-career-intelligence.html?nlv=420')"

printf '%s' "$CAREER_INTELLIGENCE_BODY" | grep -q 'nurselink-career-intelligence.js' \
  || fail "Career Intelligence standalone HTML is being rewritten to the SPA index."

printf '%s' "$CAREER_INTELLIGENCE_BODY" | grep -q 'Career Intelligence' \
  || fail "Career Intelligence standalone content missing."

ADMIN_LOGIN_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/admin/login.html?nlv=536')"

printf '%s' "$ADMIN_LOGIN_BODY" | grep -q 'Administration Operations Center' \
  || fail "Physical Administrator Login is not being served from /admin/login.html."

printf '%s' "$ADMIN_LOGIN_BODY" | grep -q './login.js?nlv=536' \
  || fail "Physical Administrator Login local JavaScript reference missing."

ADMIN_DASHBOARD_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/admin/?nlv=536')"

printf '%s' "$ADMIN_DASHBOARD_BODY" | grep -q 'Administration Operations Center' \
  || fail "Physical Administration Operations Center is not being served from /admin/."

printf '%s' "$ADMIN_DASHBOARD_BODY" | grep -q './dashboard.js?nlv=536' \
  || fail "Physical Administration Operations Center local JavaScript reference missing."

if printf '%s' "$ADMIN_DASHBOARD_BODY" | grep -q '<div id="root">'; then
  fail "Physical /admin/ portal is still being replaced by the Member React SPA shell."
fi

ADMIN_LOGIN_JS_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/admin/login.js?nlv=536')"

printf '%s' "$ADMIN_LOGIN_JS_BODY" | grep -q '/api/nurselink/admin/session-login' \
  || fail "Physical Administrator Login JavaScript is not served correctly."

ADMIN_DASHBOARD_JS_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/admin/dashboard.js?nlv=536')"

printf '%s' "$ADMIN_DASHBOARD_JS_BODY" | grep -q '/api/nurselink/admin/operations-center/summary' \
  || fail "Physical Administration Operations Center JavaScript is not served correctly."

PORTAL_CONFIG_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/admin/portal-config.js?nlv=536')"

printf '%s' "$PORTAL_CONFIG_BODY" | grep -q "adminPortal: '/admin/'" \
  || fail "Physical Administrator Portal Configuration is not served correctly."

printf 'Physical /admin/ HTTP delivery [OK]\n'


NOTIFICATION_CENTER_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-notifications.html?nlv=431')"
printf '%s' "$NOTIFICATION_CENTER_BODY" | grep -q 'nurselink-notifications.js' \
  || fail "Notification Center standalone HTML is being rewritten to the SPA index."
printf '%s' "$NOTIFICATION_CENTER_BODY" | grep -q 'Notification Center' \
  || fail "Notification Center standalone content missing."


MEMBERSHIP_COMMAND_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-membership-command-center.html?nlv=440')"

printf '%s' "$MEMBERSHIP_COMMAND_BODY" | grep -q 'nurselink-membership-command-center.js' \
  || fail "Membership Command Center HTML is being rewritten to the SPA index."

printf '%s' "$MEMBERSHIP_COMMAND_BODY" | grep -q 'Membership Review & Approval Command Center' \
  || fail "Membership Command Center standalone content missing."


MEMBER_REGISTRY_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-member-registry.html?nlv=450')"

printf '%s' "$MEMBER_REGISTRY_BODY" | grep -q 'nurselink-member-registry.js' \
  || fail "Member Registry HTML is being rewritten to the SPA index."

printf '%s' "$MEMBER_REGISTRY_BODY" | grep -q 'Member Registry' \
  || fail "Member Registry standalone content missing."


SUPER_ADMIN_TEST_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-super-admin-test-center.html?nlv=453')"

printf '%s' "$SUPER_ADMIN_TEST_BODY" | grep -q 'nurselink-super-admin-test-center.js' \
  || fail "Super Admin Test Center HTML is being rewritten to the SPA index."

printf '%s' "$SUPER_ADMIN_TEST_BODY" | grep -q 'Functional Test Center' \
  || fail "Super Admin Test Center standalone content missing."


CREDENTIAL_RENEWAL_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-credential-renewal.html?nlv=461')"

printf '%s' "$CREDENTIAL_RENEWAL_BODY" | grep -q 'nurselink-credential-renewal.js' \
  || fail "Credential Renewal Center HTML is being rewritten to the SPA index."

printf '%s' "$CREDENTIAL_RENEWAL_BODY" | grep -q 'Credential Renewal Center' \
  || fail "Credential Renewal Center standalone content missing."


CREDENTIAL_COMPLIANCE_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-credential-compliance.html?nlv=470')"

printf '%s' "$CREDENTIAL_COMPLIANCE_BODY" | grep -q 'nurselink-credential-compliance.js' \
  || fail "Credential Compliance Center HTML is being rewritten to the SPA index."

printf '%s' "$CREDENTIAL_COMPLIANCE_BODY" | grep -q 'Credential Compliance Center' \
  || fail "Credential Compliance Center standalone content missing."


EVENTS_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-events.html?nlv=471')"

printf '%s' "$EVENTS_BODY" | grep -q 'nurselink-events.js' \
  || fail "Events & Programs HTML is being rewritten to the SPA index."

printf '%s' "$EVENTS_BODY" | grep -q 'Events & Programs' \
  || fail "Events & Programs standalone content missing."

EVENT_MANAGEMENT_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-event-management.html?nlv=471')"

printf '%s' "$EVENT_MANAGEMENT_BODY" | grep -q 'nurselink-event-management.js' \
  || fail "Event Management HTML is being rewritten to the SPA index."

printf '%s' "$EVENT_MANAGEMENT_BODY" | grep -q 'Events & Programs Management' \
  || fail "Event Management standalone content missing."


CHAPTERS_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-chapters.html?nlv=472')"

printf '%s' "$CHAPTERS_BODY" | grep -q 'nurselink-chapters.js' \
  || fail "Chapters & Communities HTML is being rewritten to the SPA index."

printf '%s' "$CHAPTERS_BODY" | grep -q 'Chapters & Communities' \
  || fail "Chapters & Communities standalone content missing."

CHAPTER_MANAGEMENT_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-chapter-management.html?nlv=472')"

printf '%s' "$CHAPTER_MANAGEMENT_BODY" | grep -q 'nurselink-chapter-management.js' \
  || fail "Chapter Management HTML is being rewritten to the SPA index."

printf '%s' "$CHAPTER_MANAGEMENT_BODY" | grep -q 'Chapters & Communities Management' \
  || fail "Chapter Management standalone content missing."


MENTORING_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-mentoring.html?nlv=473')"

printf '%s' "$MENTORING_BODY" | grep -q 'nurselink-mentoring.js' \
  || fail "Mentoring HTML is being rewritten to the SPA index."

printf '%s' "$MENTORING_BODY" | grep -q 'Mentoring & Peer Support' \
  || fail "Mentoring standalone content missing."


ENGAGEMENT_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-engagement.html?nlv=480')"

printf '%s' "$ENGAGEMENT_BODY" | grep -q 'nurselink-engagement.js' \
  || fail "Member Engagement Hub HTML is being rewritten to the SPA index."

printf '%s' "$ENGAGEMENT_BODY" | grep -q 'Member Engagement Hub' \
  || fail "Member Engagement Hub standalone content missing."

ENGAGEMENT_ADMIN_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-engagement-command-center.html?nlv=480')"

printf '%s' "$ENGAGEMENT_ADMIN_BODY" | grep -q 'nurselink-engagement-command-center.js' \
  || fail "Engagement Command Center HTML is being rewritten to the SPA index."

printf '%s' "$ENGAGEMENT_ADMIN_BODY" | grep -q 'Engagement Command Center' \
  || fail "Engagement Command Center standalone content missing."


BENEFITS_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-benefits.html?nlv=482')"

printf '%s' "$BENEFITS_BODY" | grep -q 'nurselink-benefits.js' \
  || fail "Member Benefits HTML is being rewritten to the SPA index."

printf '%s' "$BENEFITS_BODY" | grep -q 'Benefits & Resources' \
  || fail "Member Benefits standalone content missing."

BENEFIT_ADMIN_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-benefit-management.html?nlv=482')"

printf '%s' "$BENEFIT_ADMIN_BODY" | grep -q 'nurselink-benefit-management.js' \
  || fail "Benefit Management HTML is being rewritten to the SPA index."

printf '%s' "$BENEFIT_ADMIN_BODY" | grep -q 'Benefits & Resources Management' \
  || fail "Benefit Management standalone content missing."

printf 'Production UAT standalone response [OK]\n'
printf 'Partner Portal standalone response [OK]\n'
printf 'Institutional Analytics standalone response [OK]\n'
printf 'Operations Center standalone response [OK]\n'

printf '%s' "$READINESS_BODY" | grep -q 'nurselink-admin-identity.js' \
  || fail "Production UAT page is missing the Super Administrator identity runtime."

printf '%s' "$ANALYTICS_BODY" | grep -q 'nurselink-admin-identity.js' \
  || fail "Institutional Analytics page is missing the Super Administrator identity runtime."

printf '%s' "$OPERATIONS_BODY" | grep -q 'nurselink-admin-identity.js' \
  || fail "Operations Center page is missing the Super Administrator identity runtime."

printf 'Live standalone admin identity runtime [OK]\n'

for admin_file in \
  "$LIVE_ROOT/nurselink-production-readiness.html" \
  "$LIVE_ROOT/nurselink-institutional-analytics.html" \
  "$LIVE_ROOT/nurselink-operations-center.html"
do
  grep -q "nurselink-admin-identity.js" "$admin_file" \
    || fail "Live standalone admin HTML is missing Super Administrator identity runtime: $admin_file"
done

printf 'Live standalone admin HTML identity references [OK]\n'


printf 'Career Intelligence standalone response [OK]\n'
printf 'Administrator Login standalone response [OK]\n'
printf 'Administrator Dashboard standalone response [OK]\n'
printf 'Notification Center standalone response [OK]\n'
printf 'Membership Command Center standalone response [OK]\n'
printf 'Member Registry standalone response [OK]\n'
printf 'Super Administrator Test Center standalone response [OK]\n'
printf 'Credential Renewal Center standalone response [OK]\n'
printf 'Credential Compliance Center standalone response [OK]\n'
printf 'Events & Programs standalone response [OK]\n'
printf 'Event Management standalone response [OK]\n'
printf 'Chapters & Communities standalone response [OK]\n'
printf 'Chapter Management standalone response [OK]\n'
printf 'Mentoring & Peer Support standalone response [OK]\n'
printf 'Member Engagement Hub standalone response [OK]\n'
printf 'Engagement Command Center standalone response [OK]\n'
printf 'Member Benefits & Resources standalone response [OK]\n'
printf 'Benefit Management standalone response [OK]\n'

ENTERPRISE_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-enterprise.html?nlv=500')"

printf '%s' "$ENTERPRISE_BODY" | grep -q 'nurselink-enterprise.js' \
  || fail "Member Enterprise HTML is being rewritten to the SPA index."

ENTERPRISE_ADMIN_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-enterprise-command-center.html?nlv=500')"

printf '%s' "$ENTERPRISE_ADMIN_BODY" | grep -q 'nurselink-enterprise-command-center.js' \
  || fail "Enterprise Command Center HTML is being rewritten to the SPA index."

ENTERPRISE_PARTNER_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-enterprise-partner.html?nlv=500')"

printf '%s' "$ENTERPRISE_PARTNER_BODY" | grep -q 'nurselink-enterprise-partner.js' \
  || fail "Partner Enterprise HTML is being rewritten to the SPA index."

printf 'Member Enterprise standalone response [OK]\n'
printf 'Enterprise Command Center standalone response [OK]\n'
printf 'Enterprise Partner Analytics standalone response [OK]\n'

ENTERPRISE_GOALS_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-enterprise-goals.html?nlv=501')"

printf '%s' "$ENTERPRISE_GOALS_BODY" | grep -q 'nurselink-enterprise-goals.js' \
  || fail "Enterprise Goals member HTML is being rewritten to the SPA index."

ENTERPRISE_GOALS_ADMIN_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-enterprise-goals-admin.html?nlv=501')"

printf '%s' "$ENTERPRISE_GOALS_ADMIN_BODY" | grep -q 'nurselink-enterprise-goals-admin.js' \
  || fail "Enterprise Goal Management HTML is being rewritten to the SPA index."

ENTERPRISE_GOALS_PARTNER_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-enterprise-goals-partner.html?nlv=501')"

printf '%s' "$ENTERPRISE_GOALS_PARTNER_BODY" | grep -q 'nurselink-enterprise-goals-partner.js' \
  || fail "Enterprise Partner Goal Analytics HTML is being rewritten to the SPA index."

printf 'Enterprise member goals standalone response [OK]\n'
printf 'Enterprise Goal Management standalone response [OK]\n'
printf 'Enterprise Partner Goal Analytics standalone response [OK]\n'

ENTERPRISE_INVITES_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-enterprise-invitations.html?nlv=503')"

printf '%s' "$ENTERPRISE_INVITES_BODY" | grep -q 'nurselink-enterprise-invitations.js' \
  || fail "Enterprise Invitations HTML is being rewritten to the SPA index."

ENTERPRISE_ENROLL_ADMIN_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-enterprise-enrollment-admin.html?nlv=503')"

printf '%s' "$ENTERPRISE_ENROLL_ADMIN_BODY" | grep -q 'nurselink-enterprise-enrollment-admin.js' \
  || fail "Enterprise Enrollment Admin HTML is being rewritten to the SPA index."

ENTERPRISE_ENROLL_PARTNER_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-enterprise-enrollment-partner.html?nlv=503')"

printf '%s' "$ENTERPRISE_ENROLL_PARTNER_BODY" | grep -q 'nurselink-enterprise-enrollment-partner.js' \
  || fail "Enterprise Enrollment Partner HTML is being rewritten to the SPA index."

printf 'Enterprise Invitations standalone response [OK]\n'
printf 'Enterprise Enrollment Admin standalone response [OK]\n'
printf 'Enterprise Enrollment Partner standalone response [OK]\n'

ENTERPRISE_OUTCOME_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-enterprise-outcomes.html?nlv=504')"

printf '%s' "$ENTERPRISE_OUTCOME_BODY" | grep -q 'nurselink-enterprise-outcomes.js' \
  || fail "Enterprise Outcomes member HTML is being rewritten to the SPA index."

ENTERPRISE_OUTCOME_ADMIN_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-enterprise-outcomes-admin.html?nlv=504')"

printf '%s' "$ENTERPRISE_OUTCOME_ADMIN_BODY" | grep -q 'nurselink-enterprise-outcomes-admin.js' \
  || fail "Enterprise Outcomes Admin HTML is being rewritten to the SPA index."

ENTERPRISE_OUTCOME_PARTNER_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-enterprise-outcomes-partner.html?nlv=504')"

printf '%s' "$ENTERPRISE_OUTCOME_PARTNER_BODY" | grep -q 'nurselink-enterprise-outcomes-partner.js' \
  || fail "Enterprise Outcomes Partner HTML is being rewritten to the SPA index."

printf 'Enterprise Outcomes member standalone response [OK]\n'
printf 'Enterprise Outcomes Admin standalone response [OK]\n'
printf 'Enterprise Outcomes Partner standalone response [OK]\n'

ENTERPRISE_SUPPORT_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-enterprise-support.html?nlv=505')"

printf '%s' "$ENTERPRISE_SUPPORT_BODY" | grep -q 'nurselink-enterprise-support.js' \
  || fail "Enterprise Support member HTML is being rewritten to the SPA index."

ENTERPRISE_SUPPORT_ADMIN_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-enterprise-support-admin.html?nlv=505')"

printf '%s' "$ENTERPRISE_SUPPORT_ADMIN_BODY" | grep -q 'nurselink-enterprise-support-admin.js' \
  || fail "Enterprise Support Admin HTML is being rewritten to the SPA index."

ENTERPRISE_SUPPORT_PARTNER_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-enterprise-support-partner.html?nlv=505')"

printf '%s' "$ENTERPRISE_SUPPORT_PARTNER_BODY" | grep -q 'nurselink-enterprise-support-partner.js' \
  || fail "Enterprise Support Partner HTML is being rewritten to the SPA index."

printf 'Enterprise Support member standalone response [OK]\n'
printf 'Enterprise Support Admin standalone response [OK]\n'
printf 'Enterprise Support Partner standalone response [OK]\n'

MEMBERSHIP_ADMIN_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-membership-administration.html?nlv=510')"

printf '%s' "$MEMBERSHIP_ADMIN_BODY" | grep -q 'nurselink-membership-administration.js' \
  || fail "Membership Administration HTML is being rewritten to the SPA index."

printf 'Membership Administration standalone response [OK]\n'

MEMBERSHIP_WELCOME_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-membership-welcome.html?nlv=511')"

printf '%s' "$MEMBERSHIP_WELCOME_BODY" | grep -q 'nurselink-membership-welcome.js' \
  || fail "Membership Welcome Center HTML is being rewritten to the SPA index."

MEMBERSHIP_ONBOARDING_ADMIN_BODY="$(curl -fsS -H 'Cache-Control: no-cache' \
  'https://app.amsertech.com/nurselink-membership-onboarding-admin.html?nlv=511')"

printf '%s' "$MEMBERSHIP_ONBOARDING_ADMIN_BODY" | grep -q 'nurselink-membership-onboarding-admin.js' \
  || fail "Membership Onboarding Admin HTML is being rewritten to the SPA index."

printf 'Membership Welcome Center standalone response [OK]\n'
printf 'Membership Onboarding Admin standalone response [OK]\n'








grep -Rqs "nurselink-runtime-v326" "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing canonical build-persistent runtime."

printf 'v5.5.2 live routing/runtime [OK]
'

grep -Rqs "nurselink-runtime-v326" "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing canonical NurseLink release runtime."

printf 'v5.5.2 live release runtime [OK]
'



grep -Rqs "standalone-routing-v321" "$LIVE_ROOT/assets" || fail "Live bundle is missing v5.5.2 JSON request runtime."
grep -q "renderSignInRequired" "$LIVE_ROOT/nurselink-partner-portal.js" || fail "Live Partner Portal auth gate missing."
grep -q "nurseLinkSession" "$LIVE_ROOT/nurselink-partner-portal.js" || fail "Live Partner Portal session probe missing."

say "Verifying browser cache headers"

CACHE_HEADERS="$(mktemp)"
ASSET_HEADERS="$(mktemp)"
trap 'rm -f "$CACHE_HEADERS" "$ASSET_HEADERS"' EXIT

"$CURL_BIN" -sS -o /dev/null -D "$CACHE_HEADERS" \
  "https://app.amsertech.com/index.html" \
  || fail "Unable to fetch live app-shell headers."

grep -Eiq '^Cache-Control:.*(no-cache|no-store|must-revalidate)' "$CACHE_HEADERS" \
  || { cat "$CACHE_HEADERS" >&2; fail "Live index.html is still cacheable."; }

LIVE_INDEX="$("$CURL_BIN" -sS "https://app.amsertech.com/index.html")"
LIVE_ASSET="$(printf '%s' "$LIVE_INDEX" | grep -oE '/assets/index-[^\"]+\.js' | head -n1 || true)"

[[ -n "$LIVE_ASSET" ]] || fail "Could not resolve the current Vite JavaScript bundle from live index.html."

"$CURL_BIN" -sS -o /dev/null -D "$ASSET_HEADERS" \
  "https://app.amsertech.com$LIVE_ASSET" \
  || fail "Unable to fetch live hashed asset headers."

grep -Eiq '^Cache-Control:.*immutable' "$ASSET_HEADERS" \
  || { cat "$ASSET_HEADERS" >&2; fail "Current hashed JavaScript bundle is not immutable-cached."; }

printf 'App shell cache policy [OK]\\n'
printf 'Current bundle %s immutable cache [OK]\\n' "$LIVE_ASSET"

rm -f "$CACHE_HEADERS" "$ASSET_HEADERS"
trap - EXIT

for marker in \
  "nurselink-runtime-v326" \
  "standalone-routing-v321" \
  "nurselink-profile-photo-card" \
  "nurselink-employment-history" \
  "nurselink-credential-registry" \
  "nurselink-qualification-readiness" \
  "nurselink-member-hub" \
  "nurselink-professional-portfolio" \
  "nurselink-career-matching" \
  "nurselink-learning-tracker" \
  "nurselink-opportunity-center" \
  "nurselink-applications-pipeline" \
  "nurselink-review-center" \
  "nurselink-digital-member-card" \
  "nurselink-notification-center" \
  "nurselink-public-profile-settings"
do
  grep -Rqs "$marker" "$LIVE_ROOT/assets" \
    || fail "Live web implementation marker missing: $marker"
done

printf 'Live build-persistent release marker [OK]\n'
printf 'Live cumulative NurseLink implementation [OK]\n'

grep -Rqs "data-nurselink-release" "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing v5.5.2 release runtime."

grep -Rqs "5.5.2" "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing v5.5.2 release value."

printf 'v5.5.2 live release runtime [OK]\n'

grep -Rqs "nurselink-super-admin-badge" "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing Super Administrator identity badge."

grep -Rqs "nurselink/session-identity" "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing server-confirmed session identity integration."

grep -Rqs "data-nurselink-access-level" "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing Super Administrator access-level marker."

printf 'Live Super Administrator identity distinction [OK]\n'

grep -Rqs "public_auth_deferred" "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing Super Administrator public-auth isolation."

printf 'Live clean-auth Super Administrator isolation [OK]\n'

grep -Rqs "nurselink-notification-drawer" "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing Notification Drawer."

grep -Rqs "/smart-registration?nlstep=3" "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing applicant-safe notification action routing."

printf 'Live Notification Drawer [OK]\n'
printf 'Live notification action routing [OK]\n'

grep -Rqs "data-nurselink-notification-instant" "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing cache-first instant Notification Drawer."

printf 'Live instant Notification Drawer [OK]\n'
grep -Rqs "nurselink-notifications.html" "$LIVE_ROOT/assets" || fail "Live dashboard bundle is missing View All Notifications navigation."
grep -q "api/notifications" "$LIVE_ROOT/nurselink-notifications.js" || fail "Live Notification Center API integration missing."
printf 'Live compact dashboard notifications [OK]\n'
printf 'Live full Notification Center [OK]\n'

grep -q "membership-command/summary" \
  "$LIVE_ROOT/nurselink-membership-command-center.js" \
  || fail "Live Membership Command Center summary integration missing."

grep -q "confirm_self_action" \
  "$LIVE_ROOT/nurselink-membership-command-center.js" \
  || fail "Live Membership Command Center self-action confirmation missing."

grep -q "nurselink-membership-command-center.html" \
  "$LIVE_ROOT/nurselink-portal-config.js" \
  || fail "Live Administrator Dashboard command-center launcher missing."

printf 'Live Membership Command Center [OK]\n'

grep -q "member-registry/summary" \
  "$LIVE_ROOT/nurselink-member-registry.js" \
  || fail "Live Member Registry summary integration missing."

grep -q "text/csv;charset=utf-8" \
  "$LIVE_ROOT/nurselink-member-registry.js" \
  || fail "Live Member Registry CSV export missing."

grep -q "nurselink-member-registry.html" \
  "$LIVE_ROOT/nurselink-portal-config.js" \
  || fail "Live Administrator Dashboard Member Registry launcher missing."

printf 'Live Member Registry [OK]\n'

grep -q "membership-lifecycle/" \
  "$LIVE_ROOT/nurselink-member-registry.js" \
  || fail "Live Member Registry lifecycle integration missing."

grep -q "VERIFIED NURSELINK MEMBERSHIP RECORD" \
  "$LIVE_ROOT/nurselink-member-verify.js" \
  || fail "Live public membership standing verification missing."

grep -Rqs "nurselink-membership-standing-alert" \
  "$LIVE_ROOT/assets" \
  || fail "Live main bundle membership standing runtime missing."

printf 'Live Membership Lifecycle [OK]\n'
printf 'Live Digital Member ID standing [OK]\n'
printf 'Live public membership standing verification [OK]\n'

grep -q "/api/credential-renewal" \
  "$LIVE_ROOT/nurselink-credential-renewal.js" \
  || fail "Live Credential Renewal API integration missing."

grep -Rqs "nurselink-credential-renewal-launcher-v461" \
  "$LIVE_ROOT/assets" \
  || fail "Live Credential Renewal launcher runtime missing."

printf 'Live Credential Renewal Center [OK]\n'
printf 'Live Credential Renewal launcher [OK]\n'

grep -q "data-renewal-form" \
  "$LIVE_ROOT/nurselink-credential-renewal.js" \
  || fail "Live Credential Renewal workflow UI missing."

grep -q "credential-renewal/summary" \
  "$LIVE_ROOT/nurselink-credential-compliance.js" \
  || fail "Live Credential Compliance API integration missing."

grep -q "credential-compliance.html" \
  "$LIVE_ROOT/nurselink-portal-config.js" \
  || fail "Live Administrator Dashboard Credential Compliance launcher missing."

printf 'Live Credential Renewal workflow [OK]\n'
printf 'Live Credential Compliance Center [OK]\n'

grep -q "/api/events" \
  "$LIVE_ROOT/nurselink-events.js" \
  || fail "Live Events & Programs API integration missing."

grep -q "nurselink/admin/events" \
  "$LIVE_ROOT/nurselink-event-management.js" \
  || fail "Live Event Management API integration missing."

grep -Rqs "nurselink-events-programs-launcher-v471" \
  "$LIVE_ROOT/assets" \
  || fail "Live Events & Programs launcher runtime missing."

printf 'Live Events & Programs Center [OK]\n'
printf 'Live Event Management Center [OK]\n'

grep -q "/api/chapters" \
  "$LIVE_ROOT/nurselink-chapters.js" \
  || fail "Live Chapters & Communities API integration missing."

grep -q "nurselink/admin/chapters" \
  "$LIVE_ROOT/nurselink-chapter-management.js" \
  || fail "Live Chapter Management API integration missing."

grep -Rqs "nurselink-chapters-launcher-v472" \
  "$LIVE_ROOT/assets" \
  || fail "Live Chapters & Communities launcher runtime missing."

printf 'Live Chapters & Communities Center [OK]\n'
printf 'Live Chapter Management Center [OK]\n'

grep -q "/api/mentoring/requests" \
  "$LIVE_ROOT/nurselink-mentoring.js" \
  || fail "Live Mentoring request workflow missing."

grep -Rqs "nurselink-mentoring-launcher-v473" \
  "$LIVE_ROOT/assets" \
  || fail "Live Mentoring launcher runtime missing."

printf 'Live Mentoring & Peer Support Center [OK]\n'

grep -q "/api/engagement" \
  "$LIVE_ROOT/nurselink-engagement.js" \
  || fail "Live Member Engagement API integration missing."

grep -q "nurselink/admin/engagement/summary" \
  "$LIVE_ROOT/nurselink-engagement-command-center.js" \
  || fail "Live Engagement Command Center API integration missing."

grep -Rqs "nurselink-engagement-hub-v480" \
  "$LIVE_ROOT/assets" \
  || fail "Live Member Engagement Hub launcher runtime missing."

printf 'Live Member Engagement Hub [OK]\n'
printf 'Live Engagement Command Center [OK]\n'

grep -q "/api/benefits" \
  "$LIVE_ROOT/nurselink-benefits.js" \
  || fail "Live Member Benefits API integration missing."

grep -q "nurselink/admin/benefits" \
  "$LIVE_ROOT/nurselink-benefit-management.js" \
  || fail "Live Benefit Management API integration missing."

grep -Rqs "nurselink-benefits-launcher-v482" \
  "$LIVE_ROOT/assets" \
  || fail "Live Member Benefits launcher runtime missing."

printf 'Live Member Benefits & Resources Center [OK]\n'
printf 'Live Benefit Management Center [OK]\n'

grep -q "/api/benefits/intelligence" \
  "$LIVE_ROOT/nurselink-benefits.js" \
  || fail "Live Benefit Intelligence integration missing."

grep -q "/api/nurselink/admin/benefits/summary" \
  "$LIVE_ROOT/nurselink-benefit-management.js" \
  || fail "Live Benefit Analytics integration missing."

grep -q "nurselink-benefit-intelligence-v483" \
  "$LIVE_ROOT/nurselink-benefits.css" \
  || fail "Live Benefit Intelligence CSS marker missing."

printf 'Live Saved Benefits & Intelligence [OK]\n'
printf 'Live Benefit Analytics [OK]\n'

grep -q "/api/nurselink/admin/benefits/reminders/generate" \
  "$LIVE_ROOT/nurselink-benefit-management.js" \
  || fail "Live Benefit Reminder generator missing."

printf 'Live Benefit Reminder controls [OK]\n'

grep -q "/api/engagement/timeline" \
  "$LIVE_ROOT/nurselink-engagement.js" \
  || fail "Live Member Engagement Timeline integration missing."

grep -q "/api/nurselink/admin/engagement/activity-summary" \
  "$LIVE_ROOT/nurselink-engagement-command-center.js" \
  || fail "Live Engagement Activity admin integration missing."

printf 'Live Member Engagement Timeline [OK]\n'
printf 'Live Engagement Activity analytics [OK]\n'

grep -q "/api/enterprise/me" \
  "$LIVE_ROOT/nurselink-enterprise.js" \
  || fail "Live Enterprise member integration missing."

grep -q "/api/nurselink/admin/enterprise/cohorts" \
  "$LIVE_ROOT/nurselink-enterprise-command-center.js" \
  || fail "Live Enterprise Command Center integration missing."

grep -q "/api/partner/enterprise" \
  "$LIVE_ROOT/nurselink-enterprise-partner.js" \
  || fail "Live Enterprise Partner Analytics integration missing."

grep -Rqs "nurselink-enterprise-launcher-v500" \
  "$LIVE_ROOT/assets" \
  || fail "Live Enterprise member launcher runtime missing."

printf 'Live Enterprise member portal [OK]\n'
printf 'Live Enterprise Command Center [OK]\n'
printf 'Live Enterprise Partner Analytics [OK]\n'

grep -q "/api/enterprise/goals" \
  "$LIVE_ROOT/nurselink-enterprise-goals.js" \
  || fail "Live Enterprise member goals integration missing."

grep -q "/api/nurselink/admin/enterprise/cohorts/" \
  "$LIVE_ROOT/nurselink-enterprise-goals-admin.js" \
  || fail "Live Enterprise Goal Management integration missing."

grep -q "/api/partner/enterprise/goals" \
  "$LIVE_ROOT/nurselink-enterprise-goals-partner.js" \
  || fail "Live Enterprise Partner Goal Analytics integration missing."

printf 'Live Enterprise member goals [OK]\n'
printf 'Live Enterprise Goal Management [OK]\n'
printf 'Live Enterprise Partner Goal Analytics [OK]\n'

grep -q "/api/enterprise/invitations" \
  "$LIVE_ROOT/nurselink-enterprise-invitations.js" \
  || fail "Live Enterprise Invitations integration missing."

grep -q "/api/nurselink/admin/enterprise/enrollment-summary" \
  "$LIVE_ROOT/nurselink-enterprise-enrollment-admin.js" \
  || fail "Live Enterprise Enrollment admin reporting missing."

grep -q "/api/partner/enterprise/enrollment-summary" \
  "$LIVE_ROOT/nurselink-enterprise-enrollment-partner.js" \
  || fail "Live Enterprise Enrollment partner reporting missing."

printf 'Live Enterprise Invitations [OK]\n'
printf 'Live Enterprise Enrollment Admin [OK]\n'
printf 'Live Enterprise Enrollment Partner Reporting [OK]\n'

grep -q "/api/enterprise/outcomes" \
  "$LIVE_ROOT/nurselink-enterprise-outcomes.js" \
  || fail "Live Enterprise Outcomes member integration missing."

grep -q "/api/nurselink/admin/enterprise/cohorts/" \
  "$LIVE_ROOT/nurselink-enterprise-outcomes-admin.js" \
  || fail "Live Enterprise Outcomes admin integration missing."

grep -q "/api/partner/enterprise/outcomes" \
  "$LIVE_ROOT/nurselink-enterprise-outcomes-partner.js" \
  || fail "Live Enterprise Outcomes partner analytics missing."

printf 'Live Enterprise Outcomes Member [OK]\n'
printf 'Live Enterprise Outcomes Admin [OK]\n'
printf 'Live Enterprise Outcomes Partner Analytics [OK]\n'

grep -q "/api/enterprise/support" \
  "$LIVE_ROOT/nurselink-enterprise-support.js" \
  || fail "Live Enterprise Support member integration missing."

grep -q "/api/nurselink/admin/enterprise/support" \
  "$LIVE_ROOT/nurselink-enterprise-support-admin.js" \
  || fail "Live Enterprise Support admin integration missing."

grep -q "/api/partner/enterprise/support-summary" \
  "$LIVE_ROOT/nurselink-enterprise-support-partner.js" \
  || fail "Live Enterprise Support partner analytics missing."

printf 'Live Enterprise Support Member [OK]\n'
printf 'Live Enterprise Support Admin [OK]\n'
printf 'Live Enterprise Support Partner Analytics [OK]\n'

grep -q "/api/nurselink/admin/membership-administration/overview" \
  "$LIVE_ROOT/nurselink-membership-administration.js" \
  || fail "Live Membership Administration overview integration missing."

grep -q "/api/nurselink/admin/users/grant" \
  "$LIVE_ROOT/nurselink-membership-administration.js" \
  || fail "Live Membership Administration role-management integration missing."

grep -q "nurselink-membership-administration.html" \
  "$LIVE_ROOT/nurselink-portal-config.js" \
  || fail "Live Administrator Dashboard Membership Administration launcher missing."

printf 'Live Membership Administration Suite [OK]\n'

grep -q "NurseLinkPortalConfig" \
  "$LIVE_ROOT/nurselink-portal-config.js" \
  || fail "Live centralized Portal Configuration missing."

grep -q "/api/nurselink/admin/membership-administration/queue" \
  "$LIVE_ROOT/nurselink-admin-dashboard.js" \
  || fail "Live consolidated Administrator membership workflow missing."

grep -q "/api/nurselink/admin/membership-onboarding" \
  "$LIVE_ROOT/nurselink-admin-dashboard.js" \
  || fail "Live consolidated Administrator onboarding workflow missing."

grep -Rqs "nurselink-member-portal-membership-v520" \
  "$LIVE_ROOT/assets" \
  || fail "Live consolidated Member Portal membership runtime missing."

printf 'Live two-portal consolidation [OK]\n'

grep -q "Administration Operations Center" \
  "$LIVE_ROOT/nurselink-admin-dashboard.html" \
  || fail "Live Administration Operations Center shell missing."

grep -q "/api/nurselink/admin/operations-center/summary" \
  "$LIVE_ROOT/nurselink-admin-dashboard.js" \
  || fail "Live Administration Operations Center summary integration missing."

grep -q "/api/nurselink/admin/operations-center/communications" \
  "$LIVE_ROOT/nurselink-admin-dashboard.js" \
  || fail "Live Administration Communications integration missing."

printf 'Live Administration Operations Center [OK]\n'

grep -Rqs "NURSELINK_ADMIN_SPA_RESCUE_V532" \
  "$LIVE_ROOT/assets" \
  || fail "Live React bundle is missing Administrator SPA fallback rescue."

printf 'Live Administrator SPA fallback rescue [OK]\n'

grep -q "NURSELINK_ADMIN_INDEX_BOOTSTRAP_V533_START" \
  "$LIVE_ROOT/index.html" \
  || fail "Live Vite index is missing pre-React Administrator bootstrap."

printf 'Live pre-React Administrator index bootstrap [OK]\n'



for name in \
  nurselink-admin-login.html \
  nurselink-admin-login.js \
  nurselink-admin-dashboard.html \
  nurselink-admin-dashboard.js \
  nurselink-portal-config.js \
  nurselink-admin-portal.css \
  nurselink-admin-consolidated.css
do
  cmp -s "$PAYLOAD_DIR/$name" "$LIVE_ROOT/$name" \
    || fail "Live Administrator entry point drift detected: $name"
done

printf 'Live Administrator entry-point payload equality [OK]\n'




grep -q "/api/membership/onboarding" \
  "$LIVE_ROOT/nurselink-membership-welcome.js" \
  || fail "Live Membership Welcome Center integration missing."

grep -q "/api/nurselink/admin/membership-onboarding" \
  "$LIVE_ROOT/nurselink-membership-onboarding-admin.js" \
  || fail "Live Membership Onboarding Admin integration missing."

printf 'Live Membership Welcome Center [OK]\n'
printf 'Live Membership Onboarding Admin [OK]\n'



















grep -q "nurselink/admin/test-mode/start" \
  "$LIVE_ROOT/nurselink-super-admin-test-center.js" \
  || fail "Live Super Admin Test Center start integration missing."

grep -q "SAFE_TESTS" \
  "$LIVE_ROOT/nurselink-super-admin-test-center.js" \
  || fail "Live Super Admin safe functional test runner missing."

grep -q "nurselink-super-admin-test-center.html" \
  "$LIVE_ROOT/nurselink-portal-config.js" \
  || fail "Live Administrator Dashboard Test Center launcher missing."

grep -Rqs "data-nurselink-super-admin-test-mode" \
  "$LIVE_ROOT/assets" \
  || fail "Live main bundle Super Admin Test Mode runtime missing."

printf 'Live Super Administrator Test Center [OK]\n'
printf 'Live Super Administrator Test Mode runtime [OK]\n'




grep -Rqs "data-nurselink-role-membership-clarity" "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing role/membership identity clarity."

grep -Rqs "Super Administrator Portal" "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing Super Administrator Portal label."

grep -Rqs "Admin Center" "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing Super Administrator Admin Center navigation."

printf 'Live role and membership identity clarity [OK]\n'

grep -Rqs "data-nurselink-super-admin-portal-persistence" \
  "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing persistent Super Administrator Portal identity."

printf 'Live persistent Super Administrator Portal label [OK]\n'

printf 'Live Super Administrator Admin Center navigation [OK]\n'

grep -Rqs "nurselink-admin-login.html" "$LIVE_ROOT/assets" \
  || fail "Live main bundle Admin Center does not use the separate Administrator login."

grep -q "nurselink/admin/session-login" "$LIVE_ROOT/nurselink-admin-login.js" \
  || fail "Live Administrator Login dedicated endpoint missing."

grep -q "nurselink/admin/users/grant" "$LIVE_ROOT/nurselink-admin-dashboard.js" \
  || fail "Live Administrator Dashboard grant/change access controls missing."

printf 'Live separate Administrator login [OK]\n'

grep -Rqs "nurselink-admin-login.html?return=/admin" "$LIVE_ROOT/assets" \
  || fail "Live Review Center does not enforce separate Administrator sign-in."

printf 'Live Review Center separate-login gate [OK]\n'

printf 'Live Administrator Dashboard access management [OK]\n'







grep -Rqs "data-nurselink-production" "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing production-stable runtime marker."

grep -Rqs "stable" "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing production-stable value."

printf 'Live production-stable runtime [OK]\n'


grep -Rqs "production" "$LIVE_ROOT/assets" \
  || fail "Live bundle is missing Production release stage."

printf 'Live Production release stage [OK]\n'

 

cd "$API_ROOT"

for route in \
  "api/profile-photo" \
  "api/employment-history" \
  "api/credential-registry" \
  "api/portfolio-items" \
  "api/career-preferences" \
  "api/learning-records" \
  "api/job-opportunities" \
  "api/saved-jobs" \
  "api/job-applications" \
  "api/reviewer/summary" \
  "api/reviewer/credentials" \
  "api/reviewer/job-applications" \
  "api/reviewer/job-opportunities" \
  "api/reviewer/membership-applications" \
  "api/membership/me" \
  "api/membership/verify" \
  "api/notifications" \
  "api/public-profile/settings" \
  "api/public-profile/{slug}"
do
  "$PHP_BIN" artisan route:list | grep -q "$route" || fail "Live API verification failed: $route"
done

say "Production operations utility ready"

printf 'Read-only operations check:\n'
printf '  php "%s/nurselink_ops_check.php" "%s" "%s" "%s"\n' \
  "$SCRIPT_DIR" "$API_ROOT" "$LIVE_ROOT" "$BACKUP_ROOT"

printf 'Production operations utility [OK]\n'

say "Release Candidate utilities ready"

printf 'Final RC gate command:\n'
printf '  php "%s/nurselink_rc_check.php" "%s" "%s" "%s"\n' \
  "$SCRIPT_DIR" "$API_ROOT" "$LIVE_ROOT" "$BACKUP_ROOT"

printf 'Release Candidate utilities [OK]\n'

grep -q "Origin: https://app.amsertech.com" \
  "$SCRIPT_DIR/nurselink_smoke_test.php" \
  || fail "RC smoke test lacks authorized Origin for session bootstrap."

grep -q "API bootstrap / missing Origin" \
  "$SCRIPT_DIR/nurselink_smoke_test.php" \
  || fail "RC smoke test lacks bootstrap security negative test."

grep -q "'expected' => \\[403, 403\\]" \
  "$SCRIPT_DIR/nurselink_smoke_test.php" \
  || fail "RC smoke test does not require 403 without Origin."

printf 'Session bootstrap smoke semantics [OK]\n'

python3 - "$SCRIPT_DIR/nurselink_smoke_test.php" <<'PYSMOKE342'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")

required = (
    "Origin: https://app.amsertech.com",
    "API bootstrap / authorized Origin",
    "API bootstrap / missing Origin",
    "'expected' => [200, 200]",
    "'expected' => [403, 403]",
    '"bootstrap":true',
)

for item in required:
    if item not in text:
        raise SystemExit(
            "Session-bootstrap smoke semantic missing: " + item
        )

print("Session bootstrap smoke regression guard [OK]")
PYSMOKE342



say "Recording v5.5.2 operations baseline"

"$PHP_BIN" "$SCRIPT_DIR/nurselink_record_deployment.php" \
  "$API_ROOT" "5.5.2" "$BACKUP_DIR" \
  || fail "Unable to record v5.5.2 deployment history."

"$PHP_BIN" "$SCRIPT_DIR/nurselink_ops_snapshot.php" \
  "$API_ROOT" deployment \
  || fail "Unable to capture the initial v5.5.2 health snapshot."

printf 'Deployment history record [OK]\n'
printf 'Initial operations health snapshot [OK]\n'

say "Final production gate ready"

printf 'Final production gate command:\n'
printf '  php "%s/nurselink_production_gate.php" "%s" "%s" "%s"\n' \
  "$SCRIPT_DIR" "$API_ROOT" "$LIVE_ROOT" "$BACKUP_ROOT"

printf 'Final production gate utility [OK]\n'

say "Operations Center ready"

printf 'Operations Center URL:\n'
printf '  https://app.amsertech.com/nurselink-operations-center.html\n'
printf 'Manual health snapshot:\n'
printf '  php "%s/nurselink_ops_snapshot.php" "%s" manual\n' \
  "$SCRIPT_DIR" "$API_ROOT"

printf 'NurseLink Operations Center [OK]\n'

printf 'Career Intelligence URL:\n'
printf '  https://app.amsertech.com/nurselink-career-intelligence.html\n'
printf 'NurseLink Career Intelligence [OK]\n'

printf 'Administrator Portal URLs:\n'
printf '  https://app.amsertech.com/nurselink-admin-login.html\n'
printf '  https://app.amsertech.com/nurselink-admin-dashboard.html\n'
printf 'NurseLink Administrator Portal [OK]\n'
printf 'Notification Center URL:\n'
printf '  https://app.amsertech.com/nurselink-notifications.html\n'
printf 'NurseLink Notification Center [OK]\n'

printf 'Membership Command Center URL:\n'
printf '  https://app.amsertech.com/nurselink-membership-command-center.html\n'
printf 'NurseLink Membership Command Center [OK]\n'

printf 'Member Registry URL:\n'
printf '  https://app.amsertech.com/nurselink-member-registry.html\n'
printf 'NurseLink Member Registry [OK]\n'

printf 'Super Administrator Test Center URL:\n'
printf '  https://app.amsertech.com/nurselink-super-admin-test-center.html\n'
printf 'NurseLink Super Administrator Test Center [OK]\n'

printf 'Membership Lifecycle management:\n'
printf '  Active / Suspended / Inactive standing enabled\n'
printf 'NurseLink Membership Lifecycle [OK]\n'

printf 'Credential Renewal Center URL:\n'
printf '  https://app.amsertech.com/nurselink-credential-renewal.html\n'
printf 'NurseLink Credential Renewal Center [OK]\n'







printf 'Super Administrator identity utility:\n'
printf '  php "%s/super_admin_access.php" "%s" grant YOUR_LOGIN_EMAIL\n' \
  "$SCRIPT_DIR" "$API_ROOT"
printf 'Super Administrator identity distinction [OK]\n'

python3 - "$WEB_ROOT/src/nurselink-mobile.js" <<'PYROLE427'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")

required = (
    "Super Administrator Portal",
    "Membership Role",
    "System Access",
    "Membership Status",
    "Admin Center",
    "data-nurselink-role-membership-clarity",
    "data-nurselink-system-access",
)

for item in required:
    if item not in text:
        raise SystemExit(
            "Role/membership identity requirement missing: " + item
        )

if "ensureSuperAdminCenterLink" not in text:
    raise SystemExit(
        "Super Administrator Admin Center navigation implementation missing."
    )

if "membershipRoleFromData" not in text:
    raise SystemExit(
        "Membership role is not derived independently of system access."
    )

if "membership.status === 'approved'" not in text:
    raise SystemExit(
        "Membership approval is not kept separate from Super Administrator access."
    )

print("Role and membership identity regression guard [OK]")
PYROLE427

python3 - "$WEB_ROOT/src/nurselink-mobile.js" <<'PYPORTAL451'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")

required = (
    "function portalLabelCandidates",
    "function enforceSuperAdministratorPortalLabel",
    "function ensureSuperAdministratorPortalLabelObserver",
    "MutationObserver",
    "requestAnimationFrame",
    "data-nurselink-super-admin-portal-label",
    "data-nurselink-super-admin-portal-persistence",
)

for item in required:
    if item not in text:
        raise SystemExit(
            "Persistent Super Administrator Portal requirement missing: " + item
        )

if "topbar.querySelectorAll('*')" not in text:
    raise SystemExit(
        "Portal label detection still depends on a narrow tag list."
    )

print("Persistent Super Administrator Portal regression guard [OK]")
PYPORTAL451



python3 - "$WEB_ROOT/src/nurselink-mobile.js" \
  "$API_ROOT/app/Http/Controllers/Api/ReviewCenterController.php" <<'PYNOTIF424'
from pathlib import Path
import sys

js = Path(sys.argv[1]).read_text(encoding="utf-8")
php = Path(sys.argv[2]).read_text(encoding="utf-8")

required_js = (
    "function notificationActionUrl",
    "type.startsWith('credential.')",
    "'/smart-registration?nlstep=3'",
    "openNotificationDrawer",
    "aria-expanded",
    "nurselink-notification-drawer",
)

for item in required_js:
    if item not in js:
        raise SystemExit("Notification runtime requirement missing: " + item)

if "credentialActionUrl" not in php:
    raise SystemExit("Membership-aware credential notification route missing.")

if "? '/credentials'" not in php or ": '/smart-registration?nlstep=3'" not in php:
    raise SystemExit("Credential notification route does not preserve applicant/member distinction.")

print("Notification routing regression guard [OK]")
PYNOTIF424

python3 - "$WEB_ROOT/src/nurselink-mobile.js" <<'PYNOTIF426'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")

required = (
    "CACHE-FIRST NOTIFICATION DRAWER",
    "data-nurselink-notification-instant",
    "notificationState.loading",
    "Promise.allSettled",
    "notificationState.loaded",
    "renderNotificationCenter(content)",
)

for item in required:
    if item not in text:
        raise SystemExit(
            "Instant Notification Drawer requirement missing: " + item
        )

blocking = """await loadMembership().catch(() => null);
      await loadNotifications(true);"""

if blocking in text:
    raise SystemExit(
        "Notification Drawer still blocks on sequential membership/notification requests."
    )

cache_render = """if (content && notificationState.loaded) {
      renderNotificationCenter(content);"""

if cache_render not in text:
    raise SystemExit(
        "Notification Drawer does not render cached notification state immediately."
    )

print("Instant Notification Drawer regression guard [OK]")
PYNOTIF426

python3 - "$WEB_ROOT/src/nurselink-mobile.js" "$WEB_ROOT/src/nurselink-mobile.css" <<'PYDASH431'
from pathlib import Path
import sys
js = Path(sys.argv[1]).read_text(encoding="utf-8")
css = Path(sys.argv[2]).read_text(encoding="utf-8")
for item in ("limit: 4","compact: true","showViewAll: true","nurselink-notifications.html","visibleRows"):
    if item not in js:
        raise SystemExit("Compact dashboard notification requirement missing: " + item)
if "dashboard-notifications-limit-4" not in css or "max-height:none!important" not in css:
    raise SystemExit("Compact dashboard notification CSS requirement missing.")
print("Compact dashboard notification regression guard [OK]")
PYDASH431




python3 - "$WEB_ROOT/src/nurselink-mobile.js" <<'PYAUTH423'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")

required = (
    "v5.5.2 PUBLIC-AUTH ISOLATION",
    "public_auth_deferred",
    "nurseLinkIsPublicAuthRoute()",
    "api/nurselink/session-identity",
    "nurselinkSessionLoginCompleted",
)

for item in required:
    if item not in text:
        raise SystemExit("Clean-auth identity requirement missing: " + item)

guard = """if (nurseLinkIsPublicAuthRoute()) {
      clearSuperAdministratorIdentity(shell);
      return;
    }"""

if guard not in text:
    raise SystemExit(
        "Super Administrator identity can still probe the API on a public auth page."
    )

login_reset = """nurselinkIdentityState.loaded = false;
        nurselinkIdentityState.loading = null;
        nurselinkIdentityState.data = null;"""

if login_reset not in text:
    raise SystemExit(
        "Authenticated identity cache is not reset after successful login."
    )

print("Clean-auth Super Administrator regression guard [OK]")
PYAUTH423




python3 - \
  "$API_ROOT/app/Http/Middleware/EnsureApprovedNurseLinkMember.php" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  "$WEB_ROOT/public/nurselink-super-admin-test-center.js" \
  <<'PYTEST453'
from pathlib import Path
import sys

middleware = Path(sys.argv[1]).read_text(encoding="utf-8")
main = Path(sys.argv[2]).read_text(encoding="utf-8")
center = Path(sys.argv[3]).read_text(encoding="utf-8")

for required in (
    "nurselink_super_admin_test_mode_user_id",
    "nurselink_super_admin_test_mode_expires_at",
    "nurselink_admin_elevated_user_id",
    "nurselink_admin_expires_at",
    "X-NurseLink-Test-Mode",
):
    if required not in middleware:
        raise SystemExit(
            "Member-gate Test Mode security requirement missing: "
            + required
        )

for required in (
    "nurselink-super-admin-test-mode",
    "data-nurselink-super-admin-test-mode",
    "nurselink-super-admin-test-center.html",
    "nurselink-credential-renewal.html",
    "nurselink-credential-compliance.html",
    "nurselink-events.html",
    "nurselink-event-management.html",
    "nurselink-chapters.html",
    "nurselink-chapter-management.html",
    "nurselink-mentoring.html",
    "nurselink-engagement.html",
    "nurselink-engagement-command-center.html",
    "nurselink-benefits.html",
    "nurselink-benefit-management.html",
):
    if required not in main:
        raise SystemExit(
            "Main app Super Admin Test Mode requirement missing: "
            + required
        )

for required in (
    "/api/nurselink/admin/test-mode/start",
    "/api/nurselink/admin/test-mode/stop",
    "SAFE_TESTS",
    "Membership Command Summary",
):
    if required not in center:
        raise SystemExit(
            "Super Admin Test Center requirement missing: "
            + required
        )

print("Super Administrator Test Mode regression guard [OK]")
PYTEST453

python3 - \
  "$API_ROOT/app/Http/Middleware/EnsureApprovedNurseLinkMember.php" \
  "$API_ROOT/app/Http/Controllers/Api/MembershipController.php" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMembershipLifecycleController.php" \
  "$WEB_ROOT/public/nurselink-member-registry.js" \
  "$WEB_ROOT/public/nurselink-member-verify.js" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  <<'PYLIFE460'
from pathlib import Path
import sys

middleware = Path(sys.argv[1]).read_text(encoding="utf-8")
membership = Path(sys.argv[2]).read_text(encoding="utf-8")
lifecycle = Path(sys.argv[3]).read_text(encoding="utf-8")
registry = Path(sys.argv[4]).read_text(encoding="utf-8")
verify = Path(sys.argv[5]).read_text(encoding="utf-8")
main = Path(sys.argv[6]).read_text(encoding="utf-8")

for item in (
    "Active NurseLink membership standing is required",
    "superAdminTestModeActive",
):
    if item not in middleware:
        raise SystemExit(
            "Membership standing member-gate requirement missing: " + item
        )

for item in (
    "'standing' => $standing",
    "'active_access' => $standing === 'active'",
):
    if item not in membership:
        raise SystemExit(
            "Membership API standing requirement missing: " + item
        )

for item in (
    "'active' => ['suspended', 'inactive']",
    "'suspended' => ['active', 'inactive']",
    "'inactive' => ['active']",
    "standing_self_action_super_admin",
):
    if item not in lifecycle:
        raise SystemExit(
            "Lifecycle governance requirement missing: " + item
        )

if "membership-lifecycle/" not in registry:
    raise SystemExit("Member Registry lifecycle integration missing.")

if "VERIFIED NURSELINK MEMBERSHIP RECORD" not in verify:
    raise SystemExit("Public standing verification UI missing.")

if "nurselink-membership-standing-alert" not in main:
    raise SystemExit("Main app membership standing alert missing.")

print("Membership Lifecycle regression guard [OK]")
PYLIFE460

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/CredentialRenewalController.php" \
  "$WEB_ROOT/public/nurselink-credential-renewal.js" \
  "$WEB_ROOT/public/nurselink-credential-compliance.js" \
  "$SCRIPT_DIR/nurselink_credential_alerts.php" \
  <<'PYRENEW470'
from pathlib import Path
import sys

api = Path(sys.argv[1]).read_text(encoding="utf-8")
member = Path(sys.argv[2]).read_text(encoding="utf-8")
admin = Path(sys.argv[3]).read_text(encoding="utf-8")
alerts = Path(sys.argv[4]).read_text(encoding="utf-8")

for item in (
    "critical_30",
    "due_90",
    "upcoming_180",
    "credential_renewal.started",
    "credential_renewal.updated",
    "credential_renewal.admin_status_changed",
    "official_renewal_certification",
):
    if item not in api:
        raise SystemExit(
            "Credential Renewal v5.5.2 requirement missing: " + item
        )

for item in (
    "data-renewal-form",
    "/api/credential-renewal/",
    "evidence_reference",
):
    if item not in member:
        raise SystemExit(
            "Member renewal workflow requirement missing: " + item
        )

for item in (
    "credential-renewal/summary",
    "workflow_status",
    "text/csv;charset=utf-8",
):
    if item not in admin:
        raise SystemExit(
            "Credential Compliance Center requirement missing: " + item
        )

for item in (
    "credential.renewal.alert.",
    "alreadyExists",
    "--dry-run",
):
    if item not in alerts:
        raise SystemExit(
            "Credential alert utility requirement missing: " + item
        )

print("Credential Renewal & Compliance regression guard [OK]")
PYRENEW470

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/EventsController.php" \
  "$WEB_ROOT/public/nurselink-events.js" \
  "$WEB_ROOT/public/nurselink-event-management.js" \
  <<'PYEVENT473'
from pathlib import Path
import sys

api = Path(sys.argv[1]).read_text(encoding="utf-8")
member = Path(sys.argv[2]).read_text(encoding="utf-8")
admin = Path(sys.argv[3]).read_text(encoding="utf-8")

for item in ("waitlisted", "registration_deadline", "cpd_units_are_official"):
    if item not in api:
        raise SystemExit("Events requirement missing: " + item)

if "/api/events" not in member:
    raise SystemExit("Events member API integration missing.")

if "/api/nurselink/admin/events" not in admin:
    raise SystemExit("Event Management API integration missing.")

print("Events & Programs regression guard [OK]")
PYEVENT473

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/ChaptersController.php" \
  "$API_ROOT/app/Http/Controllers/Api/EventsController.php" \
  "$WEB_ROOT/public/nurselink-chapters.js" \
  "$WEB_ROOT/public/nurselink-chapter-management.js" \
  <<'PYCHAPTER473'
from pathlib import Path
import sys

chapters = Path(sys.argv[1]).read_text(encoding="utf-8")
events = Path(sys.argv[2]).read_text(encoding="utf-8")
member = Path(sys.argv[3]).read_text(encoding="utf-8")
admin = Path(sys.argv[4]).read_text(encoding="utf-8")

for item in (
    "chapter.membership_status_changed",
    "Only an Active chapter membership can be marked primary.",
):
    if item not in chapters:
        raise SystemExit("Chapter requirement missing: " + item)

if "activeChapterIds" not in events:
    raise SystemExit("Chapter-specific Events visibility missing.")

if "/api/chapters" not in member:
    raise SystemExit("Chapter member API integration missing.")

if "/api/nurselink/admin/chapters" not in admin:
    raise SystemExit("Chapter admin API integration missing.")

print("Chapters & Communities regression guard [OK]")
PYCHAPTER473

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/MentoringController.php" \
  "$WEB_ROOT/public/nurselink-mentoring.js" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  <<'PYMENTOR473'
from pathlib import Path
import sys

api = Path(sys.argv[1]).read_text(encoding="utf-8")
member = Path(sys.argv[2]).read_text(encoding="utf-8")
main = Path(sys.argv[3]).read_text(encoding="utf-8")

for item in (
    "mentor_role_is_official_credential",
    "email_exposed",
    "Only the requested mentor can accept or decline",
    "mentoring.request_status_changed",
):
    if item not in api:
        raise SystemExit("Mentoring requirement missing: " + item)

for item in (
    "/api/mentoring/profile",
    "/api/mentoring/directory",
    "/api/mentoring/requests",
):
    if item not in member:
        raise SystemExit("Mentoring UI requirement missing: " + item)

if "nurselink-mentoring-launcher" not in main:
    raise SystemExit("Mentoring launcher missing.")

print("Mentoring & Peer Support regression guard [OK]")
PYMENTOR473

python3 - "$SCRIPT_DIR/install.sh" "$SCRIPT_DIR/post_install_cleanup.py" <<'PYCLEAN473'
from pathlib import Path
import sys

installer = Path(sys.argv[1]).read_text(encoding="utf-8")
cleanup = Path(sys.argv[2]).read_text(encoding="utf-8")

for item in (
    'say "Self-healing old installer cleanup"',
    '"preinstall"',
    'say "Final post-install installer cleanup"',
    '"final"',
    'Independent installer cleanup verification [OK]',
    'say "SUCCESS"',
):
    if item not in installer:
        raise SystemExit("Cleanup runtime requirement missing: " + item)

for item in (
    'HOME_ROOT = Path("/home/frankresma").resolve()',
    'shutil.rmtree(folder)',
    'archive.unlink()',
    'remaining_folders, remaining_zips = candidates()',
):
    if item not in cleanup:
        raise SystemExit("Cleanup implementation requirement missing: " + item)

for forbidden in (
    "from __future__ import annotations",
    "tuple[list[",
    "list[Path]",
):
    if forbidden in cleanup:
        raise SystemExit(
            "Server-Python cleanup compatibility regression: " + forbidden
        )

pre = installer.find('say "Self-healing old installer cleanup"')
final = installer.rfind('say "Final post-install installer cleanup"')
success = installer.rfind('say "SUCCESS"')

if not (0 <= pre < final < success):
    raise SystemExit("Cleanup/SUCCESS ordering is invalid.")

print("Two-stage cleanup current-runtime guard [OK]")
PYCLEAN473

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/EngagementController.php" \
  "$WEB_ROOT/public/nurselink-engagement.js" \
  "$WEB_ROOT/public/nurselink-engagement-command-center.js" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  <<'PYENGAGE480'
from pathlib import Path
import sys

api = Path(sys.argv[1]).read_text(encoding="utf-8")
member = Path(sys.argv[2]).read_text(encoding="utf-8")
admin = Path(sys.argv[3]).read_text(encoding="utf-8")
main = Path(sys.argv[4]).read_text(encoding="utf-8")

for item in (
    "engagement_is_professional_credential",
    "aggregate_only",
    "mentoring_messages_exposed",
    "recommended_actions",
):
    if item not in api:
        raise SystemExit("Engagement API requirement missing: " + item)

if "/api/engagement" not in member:
    raise SystemExit("Member Engagement API integration missing.")

if "/api/nurselink/admin/engagement/summary" not in admin:
    raise SystemExit("Engagement Command Center API integration missing.")

if "nurselink-engagement-hub-launcher" not in main:
    raise SystemExit("Member Engagement Hub launcher missing.")

print("Member Engagement regression guard [OK]")
PYENGAGE480

printf 'Server Python cleanup compatibility hotfix [OK]\n'

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/MemberBenefitsController.php" \
  "$API_ROOT/app/Http/Controllers/Api/EngagementController.php" \
  "$WEB_ROOT/public/nurselink-benefits.js" \
  "$WEB_ROOT/public/nurselink-benefit-management.js" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  <<'PYBENEFIT482'
from pathlib import Path
import sys

api = Path(sys.argv[1]).read_text(encoding="utf-8")
engagement = Path(sys.argv[2]).read_text(encoding="utf-8")
member = Path(sys.argv[3]).read_text(encoding="utf-8")
admin = Path(sys.argv[4]).read_text(encoding="utf-8")
main = Path(sys.argv[5]).read_text(encoding="utf-8")

for item in (
    "membership_eligibility_guaranteed",
    "provider_endorsement_implied",
    "Only an Approved benefit request can be marked Fulfilled.",
    "uploaded_documents_exposed",
):
    if item not in api:
        raise SystemExit("Benefit API requirement missing: " + item)

for item in (
    "benefitSummary",
    "nurselink_member_benefits",
    "nurselink_benefit_requests",
):
    if item not in engagement:
        raise SystemExit("Engagement benefit requirement missing: " + item)

if "/api/benefits" not in member:
    raise SystemExit("Member Benefits API integration missing.")

if "/api/nurselink/admin/benefits" not in admin:
    raise SystemExit("Benefit Management API integration missing.")

if "nurselink-benefits-launcher" not in main:
    raise SystemExit("Member Benefits launcher missing.")

print("Member Benefits & Resources regression guard [OK]")
PYBENEFIT482

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/BenefitIntelligenceController.php" \
  "$API_ROOT/app/Http/Controllers/Api/EngagementController.php" \
  "$WEB_ROOT/public/nurselink-benefits.js" \
  "$WEB_ROOT/public/nurselink-benefit-management.js" \
  <<'PYBENEFIT483'
from pathlib import Path
import sys

api = Path(sys.argv[1]).read_text(encoding="utf-8")
engagement = Path(sys.argv[2]).read_text(encoding="utf-8")
member = Path(sys.argv[3]).read_text(encoding="utf-8")
admin = Path(sys.argv[4]).read_text(encoding="utf-8")

for item in (
    "saved_benefit_ids",
    "ending_within_7_days",
    "ending_within_30_days",
    "aggregate_only",
):
    if item not in api:
        raise SystemExit(
            "Benefit Intelligence requirement missing: " + item
        )

for item in (
    "nurselink_saved_benefits",
    "ending_within_30_days",
    "'saved' =>",
):
    if item not in engagement:
        raise SystemExit(
            "Engagement benefit intelligence missing: " + item
        )

if "/api/benefits/intelligence" not in member:
    raise SystemExit("Member Benefit Intelligence UI missing.")

if "/api/nurselink/admin/benefits/summary" not in admin:
    raise SystemExit("Benefit Analytics admin UI missing.")

print("Saved Benefits & Benefit Intelligence regression guard [OK]")
PYBENEFIT483

python3 - \
  "$API_ROOT/app/Services/BenefitReminderService.php" \
  "$API_ROOT/app/Http/Controllers/Api/BenefitReminderController.php" \
  "$WEB_ROOT/public/nurselink-benefit-management.js" \
  <<'PYBENEFIT484'
from pathlib import Path
import sys

service = Path(sys.argv[1]).read_text(encoding="utf-8")
controller = Path(sys.argv[2]).read_text(encoding="utf-8")
admin = Path(sys.argv[3]).read_text(encoding="utf-8")

for item in (
    "saved_ending_30",
    "saved_ending_7",
    "skipped_duplicate",
    "m.standing",
):
    if item not in service:
        raise SystemExit(
            "Benefit reminder service requirement missing: " + item
        )

for item in (
    "automatic_cron_created",
    "aggregate_only",
    "benefit.reminders_generated",
):
    if item not in controller:
        raise SystemExit(
            "Benefit reminder controller requirement missing: " + item
        )

if "/api/nurselink/admin/benefits/reminders/generate" not in admin:
    raise SystemExit("Benefit reminder administrator UI missing.")

print("Benefit Reminder regression guard [OK]")
PYBENEFIT484

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/EngagementTimelineController.php" \
  "$WEB_ROOT/public/nurselink-engagement.js" \
  "$WEB_ROOT/public/nurselink-engagement-command-center.js" \
  <<'PYENGAGE490'
from pathlib import Path
import sys

api = Path(sys.argv[1]).read_text(encoding="utf-8")
member = Path(sys.argv[2]).read_text(encoding="utf-8")
admin = Path(sys.argv[3]).read_text(encoding="utf-8")

for item in (
    "private_messages_exposed",
    "member_notes_exposed",
    "private_contact_details_exposed",
    "aggregate_only",
    "user_ids_exposed",
    "member_names_exposed",
):
    if item not in api:
        raise SystemExit(
            "Engagement timeline/privacy requirement missing: " + item
        )

if "/api/engagement/timeline" not in member:
    raise SystemExit("Member Engagement Timeline UI missing.")

if "/api/nurselink/admin/engagement/activity-summary" not in admin:
    raise SystemExit("Engagement Activity admin UI missing.")

print("Member Engagement & Benefits v5.5.2 regression guard [OK]")
PYENGAGE490

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/EnterprisePlatformController.php" \
  "$WEB_ROOT/public/nurselink-enterprise.js" \
  "$WEB_ROOT/public/nurselink-enterprise-command-center.js" \
  "$WEB_ROOT/public/nurselink-enterprise-partner.js" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  <<'PYENTERPRISE500'
from pathlib import Path
import sys

api = Path(sys.argv[1]).read_text(encoding="utf-8")
member = Path(sys.argv[2]).read_text(encoding="utf-8")
admin = Path(sys.argv[3]).read_text(encoding="utf-8")
partner = Path(sys.argv[4]).read_text(encoding="utf-8")
main = Path(sys.argv[5]).read_text(encoding="utf-8")

for item in (
    "Only an approved NurseLink member can be assigned",
    "aggregate_only",
    "member_identity_included",
    "administrator_only_roster",
    "employment_relationship_implied",
    "credential_verification_implied",
    "small_cohort_metrics_suppressed",
    "minimum_aggregate_cohort_size",
):
    if item not in api:
        raise SystemExit(
            "Enterprise API requirement missing: " + item
        )

if "/api/enterprise/me" not in member:
    raise SystemExit("Enterprise member UI missing.")

if "/api/nurselink/admin/enterprise/cohorts" not in admin:
    raise SystemExit("Enterprise administrator UI missing.")

if "/api/partner/enterprise" not in partner:
    raise SystemExit("Enterprise partner analytics UI missing.")

if "nurselink-enterprise-launcher" not in main:
    raise SystemExit("Enterprise member launcher missing.")

print("NurseLink Enterprise Platform v5.5.2 regression guard [OK]")
PYENTERPRISE500

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/EnterpriseGoalsController.php" \
  "$WEB_ROOT/public/nurselink-enterprise-goals.js" \
  "$WEB_ROOT/public/nurselink-enterprise-goals-admin.js" \
  "$WEB_ROOT/public/nurselink-enterprise-goals-partner.js" \
  <<'PYENTERPRISE501'
from pathlib import Path
import sys

api = Path(sys.argv[1]).read_text(encoding="utf-8")
member = Path(sys.argv[2]).read_text(encoding="utf-8")
admin = Path(sys.argv[3]).read_text(encoding="utf-8")
partner = Path(sys.argv[4]).read_text(encoding="utf-8")

for item in (
    "self_reported_progress",
    "official_credential_status",
    "administrator_only_detail",
    "member_identity_included",
    "small_cohort_metrics_suppressed",
    "minimum_aggregate_cohort_size",
):
    if item not in api:
        raise SystemExit(
            "Enterprise goals requirement missing: " + item
        )

if "/api/enterprise/goals" not in member:
    raise SystemExit("Enterprise member goals UI missing.")

if "/api/nurselink/admin/enterprise/cohorts/" not in admin:
    raise SystemExit("Enterprise Goal Management UI missing.")

if "/api/partner/enterprise/goals" not in partner:
    raise SystemExit("Enterprise Partner Goal Analytics UI missing.")

print("Enterprise Goals & Progress v5.5.2 regression guard [OK]")
PYENTERPRISE501

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/EnterpriseGoalsController.php" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYHOTFIX502'
from pathlib import Path
import sys

controller = " ".join(
    Path(sys.argv[1]).read_text(
        encoding="utf-8"
    ).split()
)
installer = Path(sys.argv[2]).read_text(
    encoding="utf-8"
)

if "'member_notes_included' => false" not in controller:
    raise SystemExit(
        "Enterprise goal member-note privacy declaration missing."
    )

if "PYGOALPRIV502" not in installer:
    raise SystemExit(
        "Whitespace-tolerant Enterprise goal privacy validator missing."
    )

print(
    "Enterprise Goals privacy-validator hotfix v5.5.2 [OK]"
)
PYHOTFIX502

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/EnterpriseEnrollmentController.php" \
  "$WEB_ROOT/public/nurselink-enterprise-invitations.js" \
  "$WEB_ROOT/public/nurselink-enterprise-enrollment-admin.js" \
  "$WEB_ROOT/public/nurselink-enterprise-enrollment-partner.js" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYENROLL503'
from pathlib import Path
import sys

api = " ".join(
    Path(sys.argv[1]).read_text(
        encoding="utf-8"
    ).split()
)
member = Path(sys.argv[2]).read_text(
    encoding="utf-8"
)
admin = Path(sys.argv[3]).read_text(
    encoding="utf-8"
)
partner = Path(sys.argv[4]).read_text(
    encoding="utf-8"
)
installer = Path(sys.argv[5]).read_text(
    encoding="utf-8"
)

for item in (
    "'invitation_is_employment_offer' => false",
    "'acceptance_creates_nurselink_cohort_assignment' => true",
    "'aggregate_only' => true",
    "'member_identity_included' => false",
    "'member_notes_included' => false",
    "'small_cohort_metrics_suppressed' => true",
    "'minimum_aggregate_cohort_size' => 3",
):
    if item not in api:
        raise SystemExit(
            "Enterprise enrollment requirement missing: "
            + item
        )

if "/api/enterprise/invitations" not in member:
    raise SystemExit(
        "Enterprise Invitations member UI missing."
    )

if "/api/nurselink/admin/enterprise/enrollment-summary" not in admin:
    raise SystemExit(
        "Enterprise Enrollment admin UI missing."
    )

if "/api/partner/enterprise/enrollment-summary" not in partner:
    raise SystemExit(
        "Enterprise Enrollment partner UI missing."
    )

if "PYGOALPRIV502" not in installer:
    raise SystemExit(
        "v5.0.2 whitespace-tolerant goal privacy validator was not retained."
    )

print(
    "Enterprise Enrollment & Reporting v5.5.2 regression guard [OK]"
)
PYENROLL503

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/EnterpriseOutcomesController.php" \
  "$WEB_ROOT/public/nurselink-enterprise-outcomes.js" \
  "$WEB_ROOT/public/nurselink-enterprise-outcomes-admin.js" \
  "$WEB_ROOT/public/nurselink-enterprise-outcomes-partner.js" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYOUTCOME504'
from pathlib import Path
import sys

api = " ".join(
    Path(sys.argv[1]).read_text(
        encoding="utf-8"
    ).split()
)
member = Path(sys.argv[2]).read_text(
    encoding="utf-8"
)
admin = Path(sys.argv[3]).read_text(
    encoding="utf-8"
)
partner = Path(sys.argv[4]).read_text(
    encoding="utf-8"
)
installer = Path(sys.argv[5]).read_text(
    encoding="utf-8"
)

for item in (
    "'nurselink_internal_outcome' => true",
    "'official_certificate' => false",
    "'official_credential' => false",
    "'employment_determination' => false",
    "'administrator_only_detail' => true",
    "'partner_access_to_member_detail' => false",
    "'aggregate_only' => true",
    "'member_identity_included' => false",
    "'internal_notes_included' => false",
    "'small_cohort_metrics_suppressed' => true",
    "'minimum_aggregate_cohort_size' => 3",
):
    if item not in api:
        raise SystemExit(
            "Enterprise outcome requirement missing: "
            + item
        )

if "/api/enterprise/outcomes" not in member:
    raise SystemExit(
        "Enterprise Outcomes member UI missing."
    )

if "/api/nurselink/admin/enterprise/cohorts/" not in admin:
    raise SystemExit(
        "Enterprise Outcomes admin UI missing."
    )

if "/api/partner/enterprise/outcomes" not in partner:
    raise SystemExit(
        "Enterprise Outcomes partner UI missing."
    )

for tag in (
    "PYGOALPRIV502",
    "PYENROLLPRIV503",
    "PYOUTCOMEPRIV504",
):
    if tag not in installer:
        raise SystemExit(
            "Normalized privacy validator missing: "
            + tag
        )

print(
    "Enterprise Outcomes v5.5.2 regression guard [OK]"
)
PYOUTCOME504

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/EnterpriseSupportController.php" \
  "$WEB_ROOT/public/nurselink-enterprise-support.js" \
  "$WEB_ROOT/public/nurselink-enterprise-support-admin.js" \
  "$WEB_ROOT/public/nurselink-enterprise-support-partner.js" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYSUPPORT505'
from pathlib import Path
import sys

api = " ".join(
    Path(sys.argv[1]).read_text(
        encoding="utf-8"
    ).split()
)
member = Path(sys.argv[2]).read_text(
    encoding="utf-8"
)
admin = Path(sys.argv[3]).read_text(
    encoding="utf-8"
)
partner = Path(sys.argv[4]).read_text(
    encoding="utf-8"
)
installer = Path(sys.argv[5]).read_text(
    encoding="utf-8"
)

for item in (
    "'support_record_is_employment_action' => false",
    "'support_record_is_disciplinary_action' => false",
    "'support_record_is_clinical_record' => false",
    "'support_record_is_regulatory_record' => false",
    "'member_own_records_only' => true",
    "'administrator_only_detail' => true",
    "'partner_access_to_member_detail' => false",
    "'aggregate_only' => true",
    "'member_identity_included' => false",
    "'member_notes_included' => false",
    "'administrator_notes_included' => false",
    "'small_cohort_metrics_suppressed' => true",
    "'minimum_aggregate_cohort_size' => 3",
):
    if item not in api:
        raise SystemExit(
            "Enterprise support requirement missing: "
            + item
        )

if "/api/enterprise/support" not in member:
    raise SystemExit(
        "Enterprise Support member UI missing."
    )

if "/api/nurselink/admin/enterprise/support" not in admin:
    raise SystemExit(
        "Enterprise Support admin UI missing."
    )

if "/api/partner/enterprise/support-summary" not in partner:
    raise SystemExit(
        "Enterprise Support partner UI missing."
    )

for tag in (
    "PYGOALPRIV502",
    "PYENROLLPRIV503",
    "PYOUTCOMEPRIV504",
    "PYSUPPORTPRIV505",
):
    if tag not in installer:
        raise SystemExit(
            "Normalized privacy validator missing: "
            + tag
        )

print(
    "Enterprise Support v5.5.2 regression guard [OK]"
)
PYSUPPORT505

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/MembershipAdministrationController.php" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMembershipCommandController.php" \
  "$API_ROOT/app/Http/Controllers/Api/AdminPortalController.php" \
  "$WEB_ROOT/public/nurselink-membership-administration.js" \
  "$WEB_ROOT/public/nurselink-admin-login.js" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYMEMADMINREG510'
from pathlib import Path
import sys

suite = " ".join(
    Path(sys.argv[1]).read_text(
        encoding="utf-8"
    ).split()
)
review = " ".join(
    Path(sys.argv[2]).read_text(
        encoding="utf-8"
    ).split()
)
portal = " ".join(
    Path(sys.argv[3]).read_text(
        encoding="utf-8"
    ).split()
)
ui = Path(sys.argv[4]).read_text(
    encoding="utf-8"
)
login = Path(sys.argv[5]).read_text(
    encoding="utf-8"
)
installer = Path(sys.argv[6]).read_text(
    encoding="utf-8"
)

for item in (
    "'can_final_decide' => $access['is_admin']",
    "'can_assign_reviews' => $access['is_admin']",
    "'can_manage_roles' => $access['is_super_admin']",
    "'role_assignment_requires_super_admin' => true",
    "'last_super_admin_protected' => true",
    "'separate_admin_sign_in_required' => true",
    "Only pending membership applications can be assigned for review.",
):
    if item not in suite:
        raise SystemExit(
            "Membership Administration requirement missing: "
            + item
        )

for item in (
    "Administrator access is required for final membership decisions.",
    "Membership must be Ready for Approval before final approval.",
    "assigned_reviewer_user_id",
    "last_admin_action_at",
):
    if item not in review:
        raise SystemExit(
            "Membership review requirement missing: "
            + item
        )

for item in (
    "'can_manage_access' => $access['is_super_admin']",
    "'cannot_revoke_self' => true",
    "'protect_last_super_admin' => true",
):
    if item not in portal:
        raise SystemExit(
            "Administrator role protection missing: "
            + item
        )

for item in (
    "/api/nurselink/admin/membership-administration/overview",
    "/api/nurselink/admin/membership-command/",
    "/api/nurselink/admin/membership-lifecycle/",
    "/api/nurselink/admin/users/grant",
):
    if item not in ui:
        raise SystemExit(
            "Membership Administration UI integration missing: "
            + item
        )

if "nurselink-membership-administration.html" not in login:
    raise SystemExit(
        "Separate Administrator Login return path missing."
    )

for tag in (
    "PYGOALPRIV502",
    "PYENROLLPRIV503",
    "PYOUTCOMEPRIV504",
    "PYSUPPORTPRIV505",
    "PYMEMADMIN510",
):
    if tag not in installer:
        raise SystemExit(
            "Required normalized validator missing: "
            + tag
        )

print(
    "Membership Administration Suite v5.5.2 regression guard [OK]"
)
PYMEMADMINREG510

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/MembershipOnboardingController.php" \
  "$API_ROOT/app/Http/Controllers/Api/AdminMembershipCommandController.php" \
  "$WEB_ROOT/public/nurselink-membership-welcome.js" \
  "$WEB_ROOT/public/nurselink-membership-onboarding-admin.js" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYONBOARDREG511'
from pathlib import Path
import sys

api = " ".join(
    Path(sys.argv[1]).read_text(
        encoding="utf-8"
    ).split()
)
approval = Path(sys.argv[2]).read_text(
    encoding="utf-8"
)
member = Path(sys.argv[3]).read_text(
    encoding="utf-8"
)
admin = Path(sys.argv[4]).read_text(
    encoding="utf-8"
)
installer = Path(sys.argv[5]).read_text(
    encoding="utf-8"
)

for item in (
    "'administrator_note_included' => false",
    "'assigned_admin_identity_included' => false",
    "'other_member_data_included' => false",
    "'onboarding_completion_is_official_credential' => false",
    "'onboarding_completion_is_licensure' => false",
    "'onboarding_completion_is_regulatory_status' => false",
    "Assigned onboarding owner must have active Administrator or Super Administrator access.",
):
    if item not in api:
        raise SystemExit(
            "Membership onboarding requirement missing: "
            + item
        )

if "nurselink_membership_onboarding" not in approval:
    raise SystemExit(
        "Membership approval-to-onboarding bridge missing."
    )

if "/nurselink-membership-welcome.html" not in approval:
    raise SystemExit(
        "Approved-member Welcome Center notification missing."
    )

if "/api/membership/onboarding" not in member:
    raise SystemExit(
        "Membership Welcome Center integration missing."
    )

if "/api/nurselink/admin/membership-onboarding" not in admin:
    raise SystemExit(
        "Membership Onboarding Admin integration missing."
    )

for tag in (
    "PYMEMADMIN510",
    "PYMEMADMINREG510",
    "PYONBOARD511",
):
    if tag not in installer:
        raise SystemExit(
            "Membership governance validator missing: "
            + tag
        )

print(
    "Membership Onboarding v5.5.2 regression guard [OK]"
)
PYONBOARDREG511

python3 - \
  "$WEB_ROOT/public/nurselink-membership-welcome.js" \
  "$WEB_ROOT/public/nurselink-membership-administration.js" \
  "$WEB_ROOT/public/nurselink-membership-onboarding-admin.js" \
  "$WEB_ROOT/public/nurselink-admin-login.js" \
  "$WEB_ROOT/public/nurselink-admin-login.html" \
  "$WEB_ROOT/public/nurselink-membership-welcome.html" \
  "$WEB_ROOT/public/nurselink-membership-administration.html" \
  "$WEB_ROOT/public/nurselink-membership-onboarding-admin.html" \
  "$SCRIPT_DIR/cache_policy_v263.htaccess" \
  <<'PYREDIRECT512'
from pathlib import Path
import sys

welcome_js = Path(sys.argv[1]).read_text(encoding="utf-8")
membership_admin_js = Path(sys.argv[2]).read_text(encoding="utf-8")
onboarding_admin_js = Path(sys.argv[3]).read_text(encoding="utf-8")
admin_login_js = Path(sys.argv[4]).read_text(encoding="utf-8")
admin_login_html = Path(sys.argv[5]).read_text(encoding="utf-8")
welcome_html = Path(sys.argv[6]).read_text(encoding="utf-8")
membership_admin_html = Path(sys.argv[7]).read_text(encoding="utf-8")
onboarding_admin_html = Path(sys.argv[8]).read_text(encoding="utf-8")
cache = Path(sys.argv[9]).read_text(encoding="utf-8")

if "[401,403,419].includes(e.status)" in welcome_js:
    raise SystemExit(
        "Membership Welcome Center still redirects eligibility 403 responses."
    )

if "if(e.status===403)" not in welcome_js:
    raise SystemExit(
        "Membership Welcome Center 403 eligibility handling missing."
    )

for name, text in (
    ("Membership Administration", membership_admin_js),
    ("Membership Onboarding Admin", onboarding_admin_js),
):
    if "sessionStorage.setItem('nurselink_admin_return'" not in text:
        raise SystemExit(
            name + " Administrator return preservation missing."
        )

    if "needsAdminLogin" not in text:
        raise SystemExit(
            name + " access-error classification missing."
        )

if "sessionStorage.getItem(" not in admin_login_js:
    raise SystemExit(
        "Administrator Login stored return recovery missing."
    )

if "parsed.origin === window.location.origin" not in admin_login_js:
    raise SystemExit(
        "Administrator Login same-origin return validation missing."
    )

if "'/nurselink-membership-administration.html'" not in admin_login_js:
    raise SystemExit(
        "Membership Administration safe return missing."
    )

if "'/nurselink-membership-onboarding-admin.html'" not in admin_login_js:
    raise SystemExit(
        "Membership Onboarding Admin safe return missing."
    )

for name, html, asset in (
    ("Administrator Login", admin_login_html, "nurselink-admin-login.js?nlv=512"),
    ("Membership Welcome", welcome_html, "nurselink-membership-welcome.js?nlv=512"),
    ("Membership Administration", membership_admin_html, "nurselink-membership-administration.js?nlv=512"),
    ("Membership Onboarding Admin", onboarding_admin_html, "nurselink-membership-onboarding-admin.js?nlv=512"),
):
    if asset not in html:
        raise SystemExit(
            name + " v5.5.2 cache-busted asset reference missing."
        )

if "nurselink-protected-navigation-hotfix-v512" not in cache:
    raise SystemExit(
        "Protected navigation no-cache policy missing."
    )

print(
    "Protected-page redirect/session hotfix v5.5.2 [OK]"
)
PYREDIRECT512

python3 - \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  "$WEB_ROOT/public/nurselink-admin-dashboard.html" \
  "$WEB_ROOT/public/nurselink-admin-dashboard.js" \
  "$WEB_ROOT/public/nurselink-admin-login.js" \
  "$WEB_ROOT/public/nurselink-membership-command-center.html" \
  "$WEB_ROOT/public/nurselink-membership-administration.html" \
  "$WEB_ROOT/public/nurselink-membership-onboarding-admin.html" \
  "$WEB_ROOT/public/nurselink-member-registry.html" \
  "$WEB_ROOT/public/nurselink-membership-welcome.html" \
  "$WEB_ROOT/src/nurselink-mobile.js" \
  "$SCRIPT_DIR/cache_policy_v263.htaccess" \
  <<'PYPORTAL520'
from pathlib import Path
import sys

config = Path(sys.argv[1]).read_text(encoding="utf-8")
admin_html = Path(sys.argv[2]).read_text(encoding="utf-8")
admin_js = Path(sys.argv[3]).read_text(encoding="utf-8")
admin_login = Path(sys.argv[4]).read_text(encoding="utf-8")
command = Path(sys.argv[5]).read_text(encoding="utf-8")
membership = Path(sys.argv[6]).read_text(encoding="utf-8")
onboarding = Path(sys.argv[7]).read_text(encoding="utf-8")
registry = Path(sys.argv[8]).read_text(encoding="utf-8")
welcome = Path(sys.argv[9]).read_text(encoding="utf-8")
mobile = Path(sys.argv[10]).read_text(encoding="utf-8")
cache = Path(sys.argv[11]).read_text(encoding="utf-8")

for item in (
    "memberLogin: '/login'",
    "memberPortal: '/dashboard'",
    "adminLogin: '/nurselink-admin-login.html'",
    "adminPortal: '/nurselink-admin-dashboard.html'",
):
    if item not in config:
        raise SystemExit(
            "Two-portal entry point missing: " + item
        )

for panel in (
    'data-panel="membership"',
    'data-panel="onboarding"',
    'data-panel="members"',
    'data-panel="access"',
    'data-panel="programs"',
    'data-panel="enterprise"',
    'data-panel="operations"',
):
    if panel not in admin_html:
        raise SystemExit(
            "Consolidated Administrator panel missing: " + panel
        )

for endpoint in (
    "/api/nurselink/admin/membership-administration/queue",
    "/api/nurselink/admin/membership-command/",
    "/api/nurselink/admin/membership-onboarding",
    "/api/nurselink/admin/member-registry",
    "/api/nurselink/admin/membership-lifecycle/",
    "/api/nurselink/admin/users/grant",
):
    if endpoint not in admin_js:
        raise SystemExit(
            "Consolidated Administrator workflow missing: "
            + endpoint
        )

if "allowedReturns" in admin_login:
    raise SystemExit(
        "Administrator Login still maintains a standalone-page allowlist."
    )

if "nurselink-admin-dashboard.html" not in admin_login:
    raise SystemExit(
        "Administrator Login does not return to the single Administrator Portal."
    )

for name, text, target in (
    ("Membership Command", command, "/nurselink-admin-dashboard.html#membership"),
    ("Membership Administration", membership, "/nurselink-admin-dashboard.html#membership"),
    ("Membership Onboarding", onboarding, "/nurselink-admin-dashboard.html#onboarding"),
    ("Member Registry", registry, "/nurselink-admin-dashboard.html#members"),
    ("Member Welcome", welcome, "/dashboard#membership"),
):
    if target not in text:
        raise SystemExit(
            name + " compatibility redirect is missing: " + target
        )

for item in (
    "nurselink-member-portal-membership-v520",
    "Administrator sign in",
    "/api/membership/onboarding",
):
    if item not in mobile:
        raise SystemExit(
            "Consolidated Member Portal requirement missing: " + item
        )

if "nurselink-two-portal-consolidation-v520" not in cache:
    raise SystemExit(
        "Two-portal no-cache policy missing."
    )

print(
    "NurseLink v5.5.2 two-portal consolidation regression guard [OK]"
)
PYPORTAL520

python3 - \
  "$API_ROOT/app/Http/Controllers/Api/AdministrationOperationsCenterController.php" \
  "$API_ROOT/database/migrations/$SUPPORT_CASES_MIGRATION" \
  "$WEB_ROOT/public/nurselink-admin-dashboard.html" \
  "$WEB_ROOT/public/nurselink-admin-dashboard.js" \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  "$WEB_ROOT/public/nurselink-admin-login.js" \
  "$WEB_ROOT/public/nurselink-membership-command-center.html" \
  "$WEB_ROOT/public/nurselink-membership-administration.html" \
  "$WEB_ROOT/public/nurselink-membership-onboarding-admin.html" \
  "$WEB_ROOT/public/nurselink-member-registry.html" \
  "$SCRIPT_DIR/cache_policy_v263.htaccess" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYOPS530'
from pathlib import Path
import sys

api = " ".join(
    Path(sys.argv[1]).read_text(
        encoding="utf-8"
    ).split()
)
migration = Path(sys.argv[2]).read_text(
    encoding="utf-8"
)
html = Path(sys.argv[3]).read_text(
    encoding="utf-8"
)
ui = Path(sys.argv[4]).read_text(
    encoding="utf-8"
)
config = Path(sys.argv[5]).read_text(
    encoding="utf-8"
)
login = Path(sys.argv[6]).read_text(
    encoding="utf-8"
)
command = Path(sys.argv[7]).read_text(
    encoding="utf-8"
)
membership = Path(sys.argv[8]).read_text(
    encoding="utf-8"
)
onboarding = Path(sys.argv[9]).read_text(
    encoding="utf-8"
)
registry = Path(sys.argv[10]).read_text(
    encoding="utf-8"
)
cache = Path(sys.argv[11]).read_text(
    encoding="utf-8"
)
installer = Path(sys.argv[12]).read_text(
    encoding="utf-8"
)

for label in (
    "Dashboard",
    "Members",
    "Applications",
    "Verification",
    "Organizations",
    "Programs",
    "Employment &amp; Opportunities",
    "Training &amp; Events",
    "Communications",
    "Reports &amp; Analytics",
    "Support Cases",
    "Audit Logs",
    "System Health",
    "Settings",
):
    if label not in html:
        raise SystemExit(
            "Administration Operations Center domain missing: "
            + label
        )

for endpoint in (
    "/api/nurselink/admin/operations-center/summary",
    "/api/nurselink/admin/member-registry",
    "/api/nurselink/admin/membership-administration/queue",
    "/api/reviewer/credentials",
    "/api/reviewer/partner-organizations",
    "/api/reviewer/job-opportunities",
    "/api/reviewer/job-applications",
    "/api/nurselink/admin/events",
    "/api/nurselink/admin/operations-center/communications",
    "/api/reviewer/institutional-analytics",
    "/api/nurselink/admin/operations-center/support-cases",
    "/api/nurselink/admin/operations-center/audit-log",
    "/api/nurselink/admin/operations-center/system-health",
    "/api/nurselink/admin/operations-center/settings",
):
    if endpoint not in ui:
        raise SystemExit(
            "Administration workflow missing: "
            + endpoint
        )

for item in (
    "'raw_database_administration' => false",
    "'workflow_api_required' => true",
    "'message_body_excluded_from_audit' => true",
    "'raw_before_state_included' => false",
    "'raw_after_state_included' => false",
    "'database_credentials_exposed' => false",
    "'super_administrator_required_for_privileged_role_changes' => true",
):
    if item not in api:
        raise SystemExit(
            "Administration governance missing: "
            + item
        )

for item in (
    "nurselink_support_cases",
    "member_user_id",
    "assigned_admin_user_id",
    "created_by_user_id",
    "information_schema.COLUMNS",
):
    if item not in migration:
        raise SystemExit(
            "Support Cases data requirement missing: "
            + item
        )

for item in (
    "memberLogin: '/login'",
    "memberPortal: '/dashboard'",
    "adminLogin: '/nurselink-admin-login.html'",
    "adminPortal: '/nurselink-admin-dashboard.html'",
):
    if item not in config:
        raise SystemExit(
            "Two-entry-point architecture missing: "
            + item
        )

if "nurselink-admin-dashboard.html" not in login:
    raise SystemExit(
        "Administrator Login does not return to the Operations Center."
    )

for name, text, target in (
    ("Membership Command", command, "/nurselink-admin-dashboard.html#applications"),
    ("Membership Administration", membership, "/nurselink-admin-dashboard.html#applications"),
    ("Membership Onboarding", onboarding, "/nurselink-admin-dashboard.html#members"),
    ("Member Registry", registry, "/nurselink-admin-dashboard.html#members"),
):
    if target not in text:
        raise SystemExit(
            name + " v5.3 compatibility redirect missing."
        )

if "nurselink-admin-operations-center-v530" not in cache:
    raise SystemExit(
        "Operations Center no-cache policy missing."
    )

for tag in (
    "PYMEMADMINREG510",
    "PYONBOARDREG511",
    "PYREDIRECT512",
    "PYPORTAL520",
    "PYADMINOPS530",
    "PYADMINUI530",
):
    if tag not in installer:
        raise SystemExit(
            "Cumulative governance validator missing: "
            + tag
        )

print(
    "NurseLink v5.5.2 Administration Operations Center regression guard [OK]"
)
PYOPS530

python3 - \
  "$SCRIPT_DIR/standalone_pages_v321.htaccess" \
  "$WEB_ROOT/public/nurselink-admin-login.html" \
  "$WEB_ROOT/public/nurselink-admin-dashboard.html" \
  "$WEB_ROOT/public/nurselink-admin-login.js" \
  "$WEB_ROOT/public/nurselink-admin-dashboard.js" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYADMINROUTE531'
from pathlib import Path
import sys

routing = Path(sys.argv[1]).read_text(encoding="utf-8")
login_html = Path(sys.argv[2]).read_text(encoding="utf-8")
dashboard_html = Path(sys.argv[3]).read_text(encoding="utf-8")
login_js = Path(sys.argv[4]).read_text(encoding="utf-8")
dashboard_js = Path(sys.argv[5]).read_text(encoding="utf-8")
installer = Path(sys.argv[6]).read_text(encoding="utf-8")

for item in (
    r"RewriteRule ^nurselink-admin-login\.html$ - [END]",
    r"RewriteRule ^nurselink-admin-dashboard\.html$ - [END]",
    "RewriteCond %{REQUEST_FILENAME} -f",
    "RewriteRule ^ - [END]",
):
    if item not in routing:
        raise SystemExit(
            "Administrator route hardening missing: " + item
        )

if "Administration Operations Center" not in login_html:
    raise SystemExit(
        "Administrator Login is not the Operations Center sign-in page."
    )

if "Administration Operations Center" not in dashboard_html:
    raise SystemExit(
        "Administrator Dashboard is not the Operations Center shell."
    )

if "nurselink-admin-dashboard.html" not in login_js:
    raise SystemExit(
        "Administrator Login does not return to the Administrator portal."
    )

if "/nurselink-admin-login.html" not in dashboard_js:
    raise SystemExit(
        "Administrator Dashboard does not use the separate Administrator sign-in."
    )

for required in (
    "Administrator entry files force-deployed from payload [OK]",
    "Administrator Dashboard is not the member SPA shell [OK]",
    "Live Administrator entry-point payload equality [OK]",
):
    if required not in installer:
        raise SystemExit(
            "Administrator deploy/runtime guard missing: " + required
        )

print(
    "Administrator routing/deployment hotfix v5.5.2 [OK]"
)
PYADMINROUTE531

python3 - \
  "$WEB_ROOT/src/nurselink-admin-spa-rescue.js" \
  "$ENTRY_FILE" \
  "$WEB_ROOT/public/nurselink-admin-login.html" \
  "$WEB_ROOT/public/nurselink-admin-dashboard.html" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYADMINSPARESCUE532'
from pathlib import Path
import sys

rescue = Path(sys.argv[1]).read_text(encoding="utf-8")
entry = Path(sys.argv[2]).read_text(encoding="utf-8")
login = Path(sys.argv[3]).read_text(encoding="utf-8")
dashboard = Path(sys.argv[4]).read_text(encoding="utf-8")
installer = Path(sys.argv[5]).read_text(encoding="utf-8")

for item in (
    "NURSELINK_ADMIN_SPA_RESCUE_V532",
    "nurselink-admin-spa-rescue-login-v532",
    "nurselink-admin-spa-rescue-dashboard-v532",
    "/nurselink-admin-login.html",
    "/nurselink-admin-dashboard.html",
    "/nurselink-portal-config.js?nlv=532",
    "/nurselink-admin-login.js?nlv=532",
    "/nurselink-admin-dashboard.js?nlv=532",
):
    if item not in rescue:
        raise SystemExit(
            "Administrator SPA rescue requirement missing: "
            + item
        )

rescue_pos = entry.find(
    "nurselink-admin-spa-rescue.js"
)
mobile_pos = entry.find(
    "nurselink-mobile.js"
)

if rescue_pos < 0:
    raise SystemExit(
        "Administrator SPA rescue import missing from React entry."
    )

if mobile_pos < 0:
    raise SystemExit(
        "NurseLink mobile runtime import missing from React entry."
    )

if rescue_pos > mobile_pos:
    raise SystemExit(
        "Administrator SPA rescue does not execute before the member runtime."
    )

if "Administration Operations Center" not in login:
    raise SystemExit(
        "Administrator Login Operations Center identity missing."
    )

if "Administration Operations Center" not in dashboard:
    raise SystemExit(
        "Administrator Dashboard Operations Center identity missing."
    )

for required in (
    "Built Administrator SPA fallback rescue [OK]",
    "Live Administrator SPA fallback rescue [OK]",
    "PYADMINROUTE531",
):
    if required not in installer:
        raise SystemExit(
            "Administrator SPA rescue cumulative installer guard missing: "
            + required
        )

print(
    "Administrator SPA fallback rescue v5.5.2 [OK]"
)
PYADMINSPARESCUE532

python3 - \
  "$WEB_ROOT/index.html" \
  "$WEB_ROOT/dist/index.html" \
  "$LIVE_ROOT/index.html" \
  "$PAYLOAD_DIR/nurselink-admin-index-bootstrap-v533.html" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYADMININDEX533'
from pathlib import Path
import re
import sys

source = Path(sys.argv[1]).read_text(
    encoding="utf-8"
)
built = Path(sys.argv[2]).read_text(
    encoding="utf-8"
)
live = Path(sys.argv[3]).read_text(
    encoding="utf-8"
)
snippet = Path(sys.argv[4]).read_text(
    encoding="utf-8"
)
installer = Path(sys.argv[5]).read_text(
    encoding="utf-8"
)

marker = (
    "NURSELINK_ADMIN_INDEX_BOOTSTRAP_V533_START"
)

for name, text in (
    ("source", source),
    ("built", built),
    ("live", live),
):
    bootstrap = text.find(
        marker
    )

    if bootstrap < 0:
        raise SystemExit(
            "Administrator pre-React bootstrap missing from "
            + name
            + " index."
        )

    module = re.search(
        r"<script\b[^>]*\btype=[\"']module[\"'][^>]*>",
        text,
        re.I,
    )

    if module and bootstrap > module.start():
        raise SystemExit(
            "Administrator bootstrap is after the React module in "
            + name
            + " index."
        )

for item in (
    "/nurselink-admin-login.html",
    "/nurselink-admin-dashboard.html",
    "document.open();",
    "document.write(replacement);",
    "document.close();",
    "/nurselink-admin-portal.css?nlv=533",
    "/nurselink-admin-consolidated.css?nlv=533",
    "/nurselink-portal-config.js?nlv=533",
    "/nurselink-admin-login.js?nlv=533",
    "/nurselink-admin-dashboard.js?nlv=533",
):
    if item not in snippet:
        raise SystemExit(
            "Administrator index bootstrap requirement missing: "
            + item
        )

for required in (
    "pre-React index bootstrap is missing from the HTTP response",
    "Administrator Dashboard member-SPA fallback detected; pre-React bootstrap armed [OK]",
    "Administrator Login member-SPA fallback detected; pre-React bootstrap armed [OK]",
    "PYADMINSPARESCUE532",
    "PYADMINROUTE531",
):
    if required not in installer:
        raise SystemExit(
            "Administrator index-bootstrap installer guard missing: "
            + required
        )

print(
    "Administrator pre-React index bootstrap v5.5.2 [OK]"
)
PYADMININDEX533

python3 - \
  "$WEB_ROOT/public/nurselink-portal-config.js" \
  "$LIVE_ROOT/nurselink-portal-config.js" \
  "$WEB_ROOT/public/nurselink-admin-dashboard.js" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYLAUNCHERREG534'
from pathlib import Path
import sys

source_config = Path(sys.argv[1]).read_text(
    encoding="utf-8"
)
live_config = Path(sys.argv[2]).read_text(
    encoding="utf-8"
)
dashboard_js = Path(sys.argv[3]).read_text(
    encoding="utf-8"
)
installer = Path(sys.argv[4]).read_text(
    encoding="utf-8"
)

required = (
    "nurselink-credential-compliance.html",
    "nurselink-event-management.html",
    "nurselink-benefit-management.html",
    "nurselink-engagement-command-center.html",
    "nurselink-enterprise-command-center.html",
    "nurselink-enterprise-goals-admin.html",
    "nurselink-enterprise-enrollment-admin.html",
    "nurselink-enterprise-outcomes-admin.html",
    "nurselink-enterprise-support-admin.html",
    "nurselink-super-admin-test-center.html",
)

for name, config in (
    ("source", source_config),
    ("live", live_config),
):
    for item in required:
        if item not in config:
            raise SystemExit(
                name
                + " central launcher configuration missing: "
                + item
            )

if "CFG?.managedModules?.verification" not in dashboard_js:
    raise SystemExit(
        "Credential Compliance is not owned by the Verification domain."
    )

for tag in (
    "PYCENTRALLAUNCH534",
    "PYADMININDEX533",
    "PYADMINSPARESCUE532",
    "PYADMINROUTE531",
    "PYOPS530",
):
    if tag not in installer:
        raise SystemExit(
            "Cumulative launcher/routing validator missing: "
            + tag
        )

print(
    "Administrator launcher regression v5.5.2 [OK]"
)
PYLAUNCHERREG534

python3 - \
  "$SCRIPT_DIR/standalone_pages_v321.htaccess" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYSTANDALONEREG535'
from pathlib import Path
import sys

routing = Path(sys.argv[1]).read_text(
    encoding="utf-8"
)
installer = Path(sys.argv[2]).read_text(
    encoding="utf-8"
)

required = (
    r"RewriteRule ^nurselink-admin-login\.html$ - [END]",
    r"RewriteRule ^nurselink-admin-dashboard\.html$ - [END]",
    r"RewriteRule ^nurselink-admin-login\.js$ - [END]",
    r"RewriteRule ^nurselink-admin-dashboard\.js$ - [END]",
    r"RewriteRule ^nurselink-portal-config\.js$ - [END]",
    "RewriteCond %{REQUEST_FILENAME} -f [OR]",
    "RewriteCond %{REQUEST_FILENAME} -d",
    "RewriteRule ^ - [END]",
)

for item in required:
    if item not in routing:
        raise SystemExit(
            "Packaged standalone routing directive missing: "
            + item
        )

if "PYSTANDALONE535" not in installer:
    raise SystemExit(
        "Exact-literal standalone package preflight is missing."
    )

for line in installer.splitlines():
    stripped = line.lstrip()

    if not stripped.startswith("grep -q"):
        continue

    if (
        "nurselink-admin-login" in stripped
        or "nurselink-admin-dashboard" in stripped
    ) and "\\\\." in stripped:
        raise SystemExit(
            "Over-escaped standalone grep validator remains."
        )

for tag in (
    "PYLAUNCHERREG534",
    "PYADMININDEX533",
    "PYADMINSPARESCUE532",
    "PYADMINROUTE531",
    "PYOPS530",
):
    if tag not in installer:
        raise SystemExit(
            "Cumulative routing/portal validator missing: "
            + tag
        )

print(
    "Standalone routing preflight regression v5.5.2 [OK]"
)
PYSTANDALONEREG535

python3 - \
  "$WEB_ROOT/public/admin/index.html" \
  "$WEB_ROOT/public/admin/login.html" \
  "$WEB_ROOT/public/admin/dashboard.js" \
  "$WEB_ROOT/public/admin/login.js" \
  "$WEB_ROOT/public/admin/portal-config.js" \
  "$LIVE_ROOT/admin/index.html" \
  "$LIVE_ROOT/admin/login.html" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYPHYSICALADMIN536'
from pathlib import Path
import sys

source_dashboard = Path(sys.argv[1]).read_text(encoding="utf-8")
source_login = Path(sys.argv[2]).read_text(encoding="utf-8")
dashboard_js = Path(sys.argv[3]).read_text(encoding="utf-8")
login_js = Path(sys.argv[4]).read_text(encoding="utf-8")
config = Path(sys.argv[5]).read_text(encoding="utf-8")
live_dashboard = Path(sys.argv[6]).read_text(encoding="utf-8")
live_login = Path(sys.argv[7]).read_text(encoding="utf-8")
installer = Path(sys.argv[8]).read_text(encoding="utf-8")

for name, text in (
    ("source dashboard", source_dashboard),
    ("live dashboard", live_dashboard),
):
    if "Administration Operations Center" not in text:
        raise SystemExit(name + " identity missing.")
    if "./dashboard.js?nlv=536" not in text:
        raise SystemExit(name + " local dashboard JS missing.")

for name, text in (
    ("source login", source_login),
    ("live login", live_login),
):
    if "Administration Operations Center" not in text:
        raise SystemExit(name + " identity missing.")
    if "./login.js?nlv=536" not in text:
        raise SystemExit(name + " local login JS missing.")

if "/admin/login.html" not in dashboard_js:
    raise SystemExit("Physical dashboard does not use physical Administrator login.")

if "/api/nurselink/admin/session-login" not in login_js:
    raise SystemExit("Physical Administrator login workflow missing.")

for item in (
    "adminLogin: '/admin/login.html'",
    "adminPortal: '/admin/'",
):
    if item not in config:
        raise SystemExit("Physical portal configuration missing: " + item)

for required in (
    "Physical /admin/ HTTP delivery [OK]",
    "Physical Administrator directory force-deployed [OK]",
    "PYSTANDALONEREG535",
):
    if required not in installer:
        raise SystemExit("Physical Administrator installer guard missing: " + required)

print("Physical Administrator directory v5.5.2 [OK]")
PYPHYSICALADMIN536

python3 - \
  "$SCRIPT_DIR/install.sh" \
  "$SCRIPT_DIR/repair_admin_portal.sh" \
  "$PAYLOAD_DIR/admin/index.html" \
  "$PAYLOAD_DIR/admin/login.html" \
  <<'PYADMINDELIVERY537'
from pathlib import Path
import sys

installer = Path(sys.argv[1]).read_text(
    encoding="utf-8"
)
repair = Path(sys.argv[2]).read_text(
    encoding="utf-8"
)
dashboard = Path(sys.argv[3]).read_text(
    encoding="utf-8"
)
login = Path(sys.argv[4]).read_text(
    encoding="utf-8"
)

repair_call = installer.find(
    'bash "$SCRIPT_DIR/repair_admin_portal.sh"'
)

legacy_source_validation = installer.find(
    'say "Verifying copied v5.5.2 frontend source"'
)

if repair_call < 0:
    raise SystemExit(
        "Early Administrator repair call missing."
    )

if legacy_source_validation < 0:
    raise SystemExit(
        "Cumulative frontend validation marker missing."
    )

if repair_call > legacy_source_validation:
    raise SystemExit(
        "Administrator direct repair does not execute before cumulative frontend validation."
    )

for item in (
    'LIVE_ROOT="$HOME_ROOT/app.amsertech.com"',
    'PAYLOAD_ADMIN="$SCRIPT_DIR/payload/admin"',
    'rm -rf "$LIVE_ROOT/admin"',
    'cp -a "$PAYLOAD_ADMIN/." "$LIVE_ROOT/admin/"',
    'RewriteRule ^admin(?:/.*)?$ - [END]',
    'https://app.amsertech.com/admin/?nlv=537',
    'https://app.amsertech.com/admin/login.html?nlv=537',
    'Physical Administrator portal repair [SUCCESS]',
):
    if item not in repair:
        raise SystemExit(
            "Direct Administrator repair requirement missing: "
            + item
        )

if "Administration Operations Center" not in dashboard:
    raise SystemExit(
        "Physical Administrator dashboard identity missing."
    )

if "Administration Operations Center" not in login:
    raise SystemExit(
        "Physical Administrator login identity missing."
    )

print(
    "Physical Administrator direct delivery v5.5.2 [OK]"
)
PYADMINDELIVERY537

python3 - \
  "$PAYLOAD_DIR/admin/admin-portal.css" \
  "$PAYLOAD_DIR/admin/admin-consolidated.css" \
  "$PAYLOAD_DIR/nurselink-admin-portal.css" \
  "$PAYLOAD_DIR/nurselink-admin-consolidated.css" \
  "$LIVE_ROOT/admin/admin-portal.css" \
  "$LIVE_ROOT/admin/admin-consolidated.css" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYADMINLIGHTBLUE538'
from pathlib import Path
import sys

physical_base = Path(sys.argv[1]).read_text(encoding="utf-8")
physical_dashboard = Path(sys.argv[2]).read_text(encoding="utf-8")
legacy_base = Path(sys.argv[3]).read_text(encoding="utf-8")
legacy_dashboard = Path(sys.argv[4]).read_text(encoding="utf-8")
live_base = Path(sys.argv[5]).read_text(encoding="utf-8")
live_dashboard = Path(sys.argv[6]).read_text(encoding="utf-8")
installer = Path(sys.argv[7]).read_text(encoding="utf-8")

marker = "NURSELINK_ADMIN_LIGHT_BLUE_V538_START"

for name, text in (
    ("physical base", physical_base),
    ("physical dashboard", physical_dashboard),
    ("legacy base", legacy_base),
    ("legacy dashboard", legacy_dashboard),
    ("live base", live_base),
    ("live dashboard", live_dashboard),
):
    if marker not in text:
        raise SystemExit(
            "Administrator light-blue theme marker missing from "
            + name
        )

for item in (
    "#f5faff",
    "#eaf5ff",
    "#d8ebff",
    "#2f86d3",
):
    if item not in physical_dashboard:
        raise SystemExit(
            "Administrator dashboard light-blue palette missing: "
            + item
        )

for item in (
    "#eaf6ff",
    "#f8fcff",
    "#eef8ff",
):
    if item not in physical_base:
        raise SystemExit(
            "Administrator login light-blue palette missing: "
            + item
        )

for tag in (
    "PYADMINDELIVERY537",
    "PYPHYSICALADMIN536",
    "PYSTANDALONEREG535",
    "PYLAUNCHERREG534",
):
    if tag not in installer:
        raise SystemExit(
            "Cumulative Administrator validator missing: "
            + tag
        )

print(
    "Administrator light-blue theme v5.5.2 [OK]"
)
PYADMINLIGHTBLUE538

python3 - \
  "$PAYLOAD_DIR/admin/index.html" \
  "$PAYLOAD_DIR/admin/dashboard.js" \
  "$PAYLOAD_DIR/admin/admin-consolidated.css" \
  "$LIVE_ROOT/admin/index.html" \
  "$LIVE_ROOT/admin/dashboard.js" \
  "$LIVE_ROOT/admin/admin-consolidated.css" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYADMINMILESTONE540'
from pathlib import Path
import sys

source_html = Path(sys.argv[1]).read_text(encoding="utf-8")
source_js = Path(sys.argv[2]).read_text(encoding="utf-8")
source_css = Path(sys.argv[3]).read_text(encoding="utf-8")
live_html = Path(sys.argv[4]).read_text(encoding="utf-8")
live_js = Path(sys.argv[5]).read_text(encoding="utf-8")
live_css = Path(sys.argv[6]).read_text(encoding="utf-8")
installer = Path(sys.argv[7]).read_text(encoding="utf-8")

for name, text in (
    ("source HTML", source_html),
    ("live HTML", live_html),
):
    for item in (
        "Membership Processing Progress",
        "membershipProgress",
        "dashboardRecentActivity",
        "dashboardReminders",
        "Administrator Follow-up",
    ):
        if item not in text:
            raise SystemExit(
                "v5.5.2 dashboard milestone missing from "
                + name
                + ": "
                + item
            )

for name, text in (
    ("source JavaScript", source_js),
    ("live JavaScript", live_js),
):
    for item in (
        "progressStage(",
        "activityRow(",
        "reminderRow(",
        "/api/nurselink/admin/membership-administration/overview",
        "/api/nurselink/admin/membership-onboarding/summary",
        "/api/nurselink/admin/operations-center/audit-log",
        "Review Aging 8+ Days",
        "Final membership decisions",
    ):
        if item not in text:
            raise SystemExit(
                "v5.5.2 dashboard workflow missing from "
                + name
                + ": "
                + item
            )

for name, text in (
    ("source CSS", source_css),
    ("live CSS", live_css),
):
    for item in (
        "NURSELINK_ADMIN_PROGRESS_SUMMARY_V540_START",
        ".nl540-progress-grid",
        ".nl540-activity",
        ".nl540-reminder",
    ):
        if item not in text:
            raise SystemExit(
                "v5.5.2 dashboard styling missing from "
                + name
                + ": "
                + item
            )

for tag in (
    "PYADMINLIGHTBLUE538",
    "PYADMINDELIVERY537",
    "PYPHYSICALADMIN536",
):
    if tag not in installer:
        raise SystemExit(
            "Cumulative Administrator validator missing: "
            + tag
        )

print(
    "Administration Operations Center milestone v5.5.2 [OK]"
)
PYADMINMILESTONE540

python3 - \
  "$PAYLOAD_DIR/admin/index.html" \
  "$PAYLOAD_DIR/admin/dashboard.js" \
  "$PAYLOAD_DIR/admin/admin-consolidated.css" \
  "$LIVE_ROOT/admin/index.html" \
  "$LIVE_ROOT/admin/dashboard.js" \
  "$LIVE_ROOT/admin/admin-consolidated.css" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYADMINSESSIONGATE541'
from pathlib import Path
import sys

source_html = Path(sys.argv[1]).read_text(encoding="utf-8")
source_js = Path(sys.argv[2]).read_text(encoding="utf-8")
source_css = Path(sys.argv[3]).read_text(encoding="utf-8")
live_html = Path(sys.argv[4]).read_text(encoding="utf-8")
live_js = Path(sys.argv[5]).read_text(encoding="utf-8")
live_css = Path(sys.argv[6]).read_text(encoding="utf-8")
installer = Path(sys.argv[7]).read_text(encoding="utf-8")

for name, text in (
    ("source HTML", source_html),
    ("live HTML", live_html),
):
    for item in (
        "nl-admin-session-pending",
        "nurselink-admin-session-gate-v541",
        "adminSessionGate",
        "Verifying Administrator access",
    ):
        if item not in text:
            raise SystemExit(
                "Administrator no-flash HTML gate missing from "
                + name
                + ": "
                + item
            )

    shell = text.find(
        '<div class="nl-admin-shell nl530-shell">'
    )
    gate = text.find(
        'id="adminSessionGate"'
    )

    if gate < 0 or shell < 0 or gate > shell:
        raise SystemExit(
            "Administrator session gate must precede the protected shell in "
            + name
        )

for name, text in (
    ("source JavaScript", source_js),
    ("live JavaScript", live_js),
):
    for item in (
        "function setSessionGate(",
        "function revealAdministratorPortal(",
        "document.body.classList.add('nl-admin-session-pending')",
        "document.body.classList.remove('nl-admin-session-ready')",
        "const sessionPayload = await request('/api/nurselink/admin/session')",
        "revealAdministratorPortal();",
        "Administrator sign-in is required. Redirecting securely",
    ):
        if item not in text:
            raise SystemExit(
                "Administrator no-flash workflow missing from "
                + name
                + ": "
                + item
            )

    reveal = text.find(
        "revealAdministratorPortal();"
    )
    session = text.find(
        "const sessionPayload = await request('/api/nurselink/admin/session')"
    )

    if session < 0 or reveal < 0 or reveal < session:
        raise SystemExit(
            "Administrator portal can reveal before session verification in "
            + name
        )

for name, text in (
    ("source CSS", source_css),
    ("live CSS", live_css),
):
    for item in (
        "NURSELINK_ADMIN_SESSION_GATE_V541_START",
        ".nl541-session-gate",
        ".nl541-session-spinner",
    ):
        if item not in text:
            raise SystemExit(
                "Administrator no-flash gate styling missing from "
                + name
                + ": "
                + item
            )

for tag in (
    "PYADMINMILESTONE540",
    "PYADMINLIGHTBLUE538",
    "PYADMINDELIVERY537",
):
    if tag not in installer:
        raise SystemExit(
            "Cumulative Administrator validator missing: "
            + tag
        )

print(
    "Administrator no-flash session gate v5.5.2 [OK]"
)
PYADMINSESSIONGATE541

python3 - \
  "$PAYLOAD_DIR/admin/login.html" \
  "$PAYLOAD_DIR/admin/admin-portal.css" \
  "$LIVE_ROOT/admin/login.html" \
  "$LIVE_ROOT/admin/admin-portal.css" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYADMINLOGIN541'
from pathlib import Path
import sys

source_html = Path(sys.argv[1]).read_text(encoding="utf-8")
source_css = Path(sys.argv[2]).read_text(encoding="utf-8")
live_html = Path(sys.argv[3]).read_text(encoding="utf-8")
live_css = Path(sys.argv[4]).read_text(encoding="utf-8")
installer = Path(sys.argv[5]).read_text(encoding="utf-8")

for name, text in (
    ("source login", source_html),
    ("live login", live_html),
):
    if text.count('href="/login"') != 1:
        raise SystemExit(
            name
            + " must contain exactly one Member / Applicant Sign In link."
        )

    if "Member / Applicant Sign In" not in text:
        raise SystemExit(
            name
            + " is missing the Member / Applicant Sign In link."
        )

    for forbidden in (
        'href="/">NurseLink Home</a>',
        "nl-admin-auth-footnote",
    ):
        if forbidden in text:
            raise SystemExit(
                name
                + " contains disallowed extra login footer content: "
                + forbidden
            )

    form_end = text.find("</form>")
    member_link = text.find("Member / Applicant Sign In")

    if form_end < 0 or member_link < form_end:
        raise SystemExit(
            name
            + " does not place Member / Applicant Sign In after the Administrator sign-in button."
        )

for name, text in (
    ("source CSS", source_css),
    ("live CSS", live_css),
):
    for item in (
        "NURSELINK_ADMIN_LOGIN_SINGLE_MEMBER_LINK_V541_START",
        ".nl-admin-auth-links-single",
    ):
        if item not in text:
            raise SystemExit(
                name
                + " single-link styling missing: "
                + item
            )

for tag in (
    "PYADMINSESSIONGATE541",
    "PYADMINMILESTONE540",
    "PYADMINLIGHTBLUE538",
    "PYADMINDELIVERY537",
):
    if tag not in installer:
        raise SystemExit(
            "Cumulative Administrator validator missing: "
            + tag
        )

print(
    "Administrator simplified login footer v5.5.2 [OK]"
)
PYADMINLOGIN541

python3 - \
  "$PAYLOAD_DIR/admin/index.html" \
  "$PAYLOAD_DIR/admin/dashboard.js" \
  "$PAYLOAD_DIR/admin/admin-consolidated.css" \
  "$LIVE_ROOT/admin/index.html" \
  "$LIVE_ROOT/admin/dashboard.js" \
  "$LIVE_ROOT/admin/admin-consolidated.css" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYADMINWORKBENCH542'
from pathlib import Path
import sys

source_html = Path(sys.argv[1]).read_text(encoding="utf-8")
source_js = Path(sys.argv[2]).read_text(encoding="utf-8")
source_css = Path(sys.argv[3]).read_text(encoding="utf-8")
live_html = Path(sys.argv[4]).read_text(encoding="utf-8")
live_js = Path(sys.argv[5]).read_text(encoding="utf-8")
live_css = Path(sys.argv[6]).read_text(encoding="utf-8")
installer = Path(sys.argv[7]).read_text(encoding="utf-8")

for name, text in (
    ("source HTML", source_html),
    ("live HTML", live_html),
):
    for item in (
        "adminGlobalSearch",
        "adminGlobalSearchPanel",
        "adminRoleWorkbench",
        "supportSearch",
        "supportAssignment",
        "supportStatus",
        "supportFilterPriority",
        "Ctrl K",
    ):
        if item not in text:
            raise SystemExit(
                "v5.5.2 Administrator workbench HTML missing from "
                + name
                + ": "
                + item
            )

for name, text in (
    ("source JavaScript", source_js),
    ("live JavaScript", live_js),
):
    for item in (
        "function renderRoleWorkbench()",
        "async function runGlobalSearch(",
        "function bindGlobalSearch()",
        "/api/nurselink/admin/member-registry?standing=all&search=",
        "/api/nurselink/admin/membership-administration/queue?search=",
        "/api/nurselink/admin/operations-center/support-cases?search=",
        "Promise.allSettled",
        "supportAssignment",
        "supportFilterPriority",
        "currentAccess = access",
        "bindGlobalSearch();",
        "renderRoleWorkbench();",
    ):
        if item not in text:
            raise SystemExit(
                "v5.5.2 Administrator workbench JavaScript missing from "
                + name
                + ": "
                + item
            )

    if text.find("currentAccess = access") > text.find("renderRoleWorkbench();"):
        raise SystemExit(
            "Role-aware workbench renders before server-confirmed access is stored in "
            + name
        )

for name, text in (
    ("source CSS", source_css),
    ("live CSS", live_css),
):
    for item in (
        "NURSELINK_ADMIN_WORKBENCH_V542_START",
        ".nl542-global-search",
        ".nl542-search-panel",
        ".nl542-role-workbench",
        ".nl542-support-toolbar",
    ):
        if item not in text:
            raise SystemExit(
                "v5.5.2 Administrator workbench styling missing from "
                + name
                + ": "
                + item
            )

segment_start = source_js.find(
    "async function runGlobalSearch("
)
segment_end = source_js.find(
    "function bindGlobalSearch()",
    segment_start
)

if segment_start < 0 or segment_end <= segment_start:
    raise SystemExit(
        "Unable to isolate v5.5.2 Global Search implementation."
    )

global_search_segment = source_js[
    segment_start:segment_end
]

for forbidden in (
    "internal_note",
    "raw_before_state",
    "raw_after_state",
    "credential_number",
):
    if forbidden in global_search_segment:
        raise SystemExit(
            "Global Search exposes a disallowed sensitive field: "
            + forbidden
        )

for tag in (
    "PYADMINLOGIN541",
    "PYADMINSESSIONGATE541",
    "PYADMINMILESTONE540",
    "PYADMINLIGHTBLUE538",
    "PYADMINDELIVERY537",
):
    if tag not in installer:
        raise SystemExit(
            "Cumulative Administrator validator missing: "
            + tag
        )

print(
    "Administrator Global Search & Role-Aware Workbench v5.5.2 [OK]"
)
PYADMINWORKBENCH542

python3 - \
  "$PAYLOAD_DIR/admin/index.html" \
  "$PAYLOAD_DIR/admin/dashboard.js" \
  "$PAYLOAD_DIR/admin/admin-consolidated.css" \
  "$API_ROOT/app/Http/Controllers/Api/MembershipAdministrationController.php" \
  "$LIVE_ROOT/admin/index.html" \
  "$LIVE_ROOT/admin/dashboard.js" \
  "$LIVE_ROOT/admin/admin-consolidated.css" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYAPPLICATIONSCOMMAND550'
from pathlib import Path
import sys

source_html = Path(sys.argv[1]).read_text(encoding="utf-8")
source_js = Path(sys.argv[2]).read_text(encoding="utf-8")
source_css = Path(sys.argv[3]).read_text(encoding="utf-8")
api = Path(sys.argv[4]).read_text(encoding="utf-8")
live_html = Path(sys.argv[5]).read_text(encoding="utf-8")
live_js = Path(sys.argv[6]).read_text(encoding="utf-8")
live_css = Path(sys.argv[7]).read_text(encoding="utf-8")
installer = Path(sys.argv[8]).read_text(encoding="utf-8")

for name, text in (
    ("source HTML", source_html),
    ("live HTML", live_html),
):
    for item in (
        "applicationRoleWorkbench",
        "applicationCommandMetrics",
        "applicationProgress",
        "applicationSearch",
        "applicationStatus",
        "applicationStage",
        "applicationAssignment",
        "applicationFilterPriority",
        "applicationOrganization",
        "applicationOverdue",
        "applicationPageSize",
        "applicationPagination",
        "applicationDetailDrawer",
        "Membership Applications",
    ):
        if item not in text:
            raise SystemExit(
                "v5.5.2 Applications Command Center HTML missing from "
                + name
                + ": "
                + item
            )

for name, text in (
    ("source JavaScript", source_js),
    ("live JavaScript", live_js),
):
    for item in (
        "function applicationIcon(",
        "function applicationSla(",
        "function renderApplicationCommandHeader(",
        "function applicationTableRow(",
        "function renderApplicationPagination(",
        "function renderApplicationTable(",
        "function applicationClientFilter(",
        "function closeApplicationDetail(",
        "/api/nurselink/admin/membership-administration/queue?",
        "/api/nurselink/admin/membership-administration/overview",
        "/api/nurselink/admin/operations-center/summary",
        "/api/nurselink/admin/membership-onboarding/summary",
        "application_reference",
        "latest_employment",
        "review_stage",
    ):
        if item not in text:
            raise SystemExit(
                "v5.5.2 Applications Command Center workflow missing from "
                + name
                + ": "
                + item
            )

for name, text in (
    ("source CSS", source_css),
    ("live CSS", live_css),
):
    for item in (
        "NURSELINK_APPLICATIONS_COMMAND_CENTER_V550_START",
        ".nl550-kpi-strip",
        ".nl550-progress-grid",
        ".nl550-filterbar",
        ".nl550-applications-table",
        ".nl550-detail-drawer",
        ".sr-only",
    ):
        if item not in text:
            raise SystemExit(
                "v5.5.2 Applications Command Center styling missing from "
                + name
                + ": "
                + item
            )

for item in (
    "'application_reference'",
    "'submitted_at'",
    "'review_stage'",
    "'latest_employment'",
    "private function reviewStage(",
    "'organization' =>",
):
    if item not in api:
        raise SystemExit(
            "v5.5.2 Membership Administration API enhancement missing: "
            + item
        )

# Privacy boundary: the table workflow must not render sensitive credential
# numbers, raw audit snapshots or private support notes.
table_start = source_js.find(
    "function applicationTableRow("
)
table_end = source_js.find(
    "function renderApplicationPagination(",
    table_start
)

if table_start < 0 or table_end <= table_start:
    raise SystemExit(
        "Unable to isolate v5.5.2 application table renderer."
    )

table_segment = source_js[
    table_start:table_end
]

for forbidden in (
    "credential_number",
    "raw_before_state",
    "raw_after_state",
    "internal_note",
    "home_address",
    "phone_number",
):
    if forbidden in table_segment:
        raise SystemExit(
            "Applications table exposes a disallowed sensitive field: "
            + forbidden
        )

for tag in (
    "PYADMINWORKBENCH542",
    "PYADMINLOGIN541",
    "PYADMINSESSIONGATE541",
    "PYADMINMILESTONE540",
    "PYADMINLIGHTBLUE538",
    "PYADMINDELIVERY537",
):
    if tag not in installer:
        raise SystemExit(
            "Cumulative Administrator validator missing: "
            + tag
        )

print(
    "Applications Command Center major milestone v5.5.2 [OK]"
)
PYAPPLICATIONSCOMMAND550

python3 - \
  "$SCRIPT_DIR/repair_admin_portal.sh" \
  "$PAYLOAD_DIR/admin/index.html" \
  "$PAYLOAD_DIR/admin/login.html" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYNAMECHEAPCURL551'
from pathlib import Path
import sys

repair = Path(sys.argv[1]).read_text(encoding="utf-8")
admin_html = Path(sys.argv[2]).read_text(encoding="utf-8")
login_html = Path(sys.argv[3]).read_text(encoding="utf-8")
installer = Path(sys.argv[4]).read_text(encoding="utf-8")

for line in repair.splitlines():
    stripped = line.lstrip()

    if not stripped.startswith("| grep -q"):
        continue

    if (
        "/api/nurselink/admin/operations-center/summary"
        in stripped
        or "/api/nurselink/admin/session-login"
        in stripped
    ):
        raise SystemExit(
            "Unsafe Namecheap curl streaming validation remains."
        )

for required in (
    'ADMIN_DASHBOARD_JS_TMP="/tmp/nurselink-admin-dashboard-v552.js"',
    'ADMIN_LOGIN_JS_TMP="/tmp/nurselink-admin-login-v552.js"',
    '-o "$ADMIN_DASHBOARD_JS_TMP"',
    '-o "$ADMIN_LOGIN_JS_TMP"',
    'grep -q "/api/nurselink/admin/operations-center/summary"',
    'grep -q "renderApplicationTable"',
    'grep -q "/api/nurselink/admin/session-login"',
    "Namecheap curl error-23 safe HTTPS verifier v5.5.2 [OK]",
):
    if required not in repair:
        raise SystemExit(
            "v5.5.2 focused Administrator verifier missing: "
            + required
        )

for name, text in (
    ("Administrator dashboard HTML", admin_html),
    ("Administrator login HTML", login_html),
):
    if "nlv=552" not in text:
        raise SystemExit(
            name
            + " is missing the v5.5.2 cache key."
        )

for tag in (
    "PYAPPLICATIONSCOMMAND550",
    "PYADMINWORKBENCH542",
    "PYADMINLOGIN541",
    "PYADMINSESSIONGATE541",
):
    if tag not in installer:
        raise SystemExit(
            "Cumulative Administrator validator missing: "
            + tag
        )

print(
    "Namecheap Administrator HTTPS delivery hotfix v5.5.2 [OK]"
)
PYNAMECHEAPCURL551

python3 - \
  "$PAYLOAD_DIR/admin/index.html" \
  "$PAYLOAD_DIR/admin/dashboard.js" \
  "$PAYLOAD_DIR/admin/admin-consolidated.css" \
  "$API_ROOT/app/Http/Controllers/Api/MembershipAdministrationController.php" \
  "$API_ROOT/routes/api.php" \
  "$LIVE_ROOT/admin/index.html" \
  "$LIVE_ROOT/admin/dashboard.js" \
  "$LIVE_ROOT/admin/admin-consolidated.css" \
  "$SCRIPT_DIR/install.sh" \
  <<'PYAPPLICATIONTRIAGE552'
from pathlib import Path
import sys

source_html = Path(sys.argv[1]).read_text(encoding="utf-8")
source_js = Path(sys.argv[2]).read_text(encoding="utf-8")
source_css = Path(sys.argv[3]).read_text(encoding="utf-8")
api = Path(sys.argv[4]).read_text(encoding="utf-8")
routes = Path(sys.argv[5]).read_text(encoding="utf-8")
live_html = Path(sys.argv[6]).read_text(encoding="utf-8")
live_js = Path(sys.argv[7]).read_text(encoding="utf-8")
live_css = Path(sys.argv[8]).read_text(encoding="utf-8")
installer = Path(sys.argv[9]).read_text(encoding="utf-8")

for name, value in (
    ("source HTML", source_html),
    ("live HTML", live_html),
):
    for item in (
        "applicationWorkloadSection",
        "applicationWorkloadRecommendation",
        "applicationSavedView",
        "saveApplicationView",
        "deleteApplicationView",
        "exportApplications",
        'data-application-quick="ready"',
        'data-application-quick="overdue"',
        'data-application-quick="unassigned"',
        'data-application-quick="urgent"',
        'data-application-quick="mine"',
    ):
        if item not in value:
            raise SystemExit(
                "v5.5.2 Applications triage HTML missing from "
                + name
                + ": "
                + item
            )

for name, value in (
    ("source JavaScript", source_js),
    ("live JavaScript", live_js),
):
    for item in (
        "function applicationFilterSnapshot(",
        "function applicationQueryParams(",
        "function readApplicationSavedViews(",
        "function saveApplicationView(",
        "function loadApplicationSavedView(",
        "function setApplicationQuickView(",
        "function renderApplicationWorkload(",
        "async function exportApplicationQueue(",
        "nurselink:admin:application-views:v552:",
        "/api/nurselink/admin/membership-administration/staff",
        "/api/nurselink/admin/membership-administration/export?",
        "workload_score",
        "overdue_workload",
        "urgent_workload",
    ):
        if item not in value:
            raise SystemExit(
                "v5.5.2 Applications triage JavaScript missing from "
                + name
                + ": "
                + item
            )

for name, value in (
    ("source CSS", source_css),
    ("live CSS", live_css),
):
    for item in (
        "NURSELINK_APPLICATION_TRIAGE_V552_START",
        ".nl552-workload-card",
        ".nl552-workload-grid",
        ".nl552-triagebar",
        ".nl552-quick-views",
        ".nl552-view-tools",
    ):
        if item not in value:
            raise SystemExit(
                "v5.5.2 Applications triage styling missing from "
                + name
                + ": "
                + item
            )

for item in (
    "public function export(",
    "'membership.application_queue_exported'",
    "'urgent_workload'",
    "'high_workload'",
    "'overdue_workload'",
    "'ready_for_approval_workload'",
    "'workload_score'",
    "'workload_level'",
    "private function workloadLevel(",
    "private function csvCell(",
    "'stage' =>",
):
    if item not in api:
        raise SystemExit(
            "v5.5.2 Membership Administration API missing: "
            + item
        )

if "membership-administration/export" not in routes:
    raise SystemExit(
        "v5.5.2 membership application export route missing."
    )

# Controlled export is Administrator-only and must neutralize spreadsheet
# formula injection before emitting CSV.
export_start = api.find(
    "public function export("
)
export_end = api.find(
    "public function activity(",
    export_start
)
if export_start < 0 or export_end <= export_start:
    raise SystemExit(
        "Unable to isolate v5.5.2 export implementation."
    )

export_segment = api[export_start:export_end]

for required in (
    "$access['is_admin']",
    "streamDownload",
    "text/csv; charset=UTF-8",
    "no-store, private",
    "$this->csvCell(",
):
    if required not in export_segment:
        raise SystemExit(
            "Controlled export governance missing: "
            + required
        )

csv_start = api.find(
    "private function csvCell("
)
csv_end = api.find(
    "private function reviewStage(",
    csv_start
)
csv_segment = api[csv_start:csv_end]

for character in (
    "'='",
    "'+'",
    "'-'",
    "'@'",
):
    if character not in csv_segment:
        raise SystemExit(
            "CSV formula-injection protection missing for "
            + character
        )

# Workload data is explicitly an operational queue aid, not an employment
# performance measure.
if "not a staff performance rating" not in source_html:
    raise SystemExit(
        "Reviewer workload governance copy is missing."
    )

# Saved views must remain local filter preferences and must not persist
# application/member data.
saved_start = source_js.find(
    "function applicationViewStorageKey("
)
saved_end = source_js.find(
    "function workloadTone(",
    saved_start
)
saved_segment = source_js[saved_start:saved_end]

for forbidden in (
    "applicationRows",
    "memberRows",
    "credential_number",
    "email:",
    "name:",
):
    if forbidden in saved_segment:
        raise SystemExit(
            "Saved application views persist disallowed record data: "
            + forbidden
        )

for tag in (
    "PYNAMECHEAPCURL551",
    "PYAPPLICATIONSCOMMAND550",
    "PYADMINWORKBENCH542",
    "PYADMINSESSIONGATE541",
):
    if tag not in installer:
        raise SystemExit(
            "Cumulative Administrator validator missing: "
            + tag
        )

print(
    "Applications Triage & Reviewer Workload v5.5.2 [OK]"
)
PYAPPLICATIONTRIAGE552

say "Final post-install installer cleanup"

[[ -f "$SCRIPT_DIR/post_install_cleanup.py" ]] \
  || fail "Missing post_install_cleanup.py."

python3 "$SCRIPT_DIR/post_install_cleanup.py" "$SCRIPT_DIR" "final" \
  || fail "Post-install installer cleanup failed."

# Independent shell verification after the Python cleanup program.
remaining_installer_folders="$(
  find /home/frankresma \
    -mindepth 1 \
    -maxdepth 1 \
    -type d \
    \( \
      -name 'NurseLink_Mobile_Responsive_Installer_v*' \
      -o \
      -name 'NurseLink_Global_Mobile_Responsive_Installer_v*' \
    \) \
    ! -path "$SCRIPT_DIR" \
    -print
)"

remaining_installer_zips="$(
  find /home/frankresma \
    -mindepth 1 \
    -maxdepth 1 \
    -type f \
    \( \
      -name 'NurseLink_Mobile_Responsive_Installer_v*.zip' \
      -o \
      -name 'NurseLink_Global_Mobile_Responsive_Installer_v*.zip' \
    \) \
    ! -path "/home/frankresma/$(basename "$SCRIPT_DIR").zip" \
    -print
)"

[[ -z "$remaining_installer_folders" ]] \
  || fail "Post-install cleanup verification found old installer folders: $remaining_installer_folders"

[[ -z "$remaining_installer_zips" ]] \
  || fail "Post-install cleanup verification found old installer ZIPs: $remaining_installer_zips"

printf 'Independent installer cleanup verification [OK]\n'

printf 'Mentoring & Peer Support URL:\n'
printf '  https://app.amsertech.com/nurselink-mentoring.html\n'
printf 'NurseLink Mentoring & Peer Support Foundation [OK]\n'

printf 'Member Engagement Hub URL:\n'
printf '  https://app.amsertech.com/nurselink-engagement.html\n'
printf 'Engagement Command Center URL:\n'
printf '  https://app.amsertech.com/nurselink-engagement-command-center.html\n'
printf 'NurseLink Member Engagement Platform [OK]\n'

printf 'Member Benefits & Resources URL:\n'
printf '  https://app.amsertech.com/nurselink-benefits.html\n'
printf 'Benefit Management URL:\n'
printf '  https://app.amsertech.com/nurselink-benefit-management.html\n'
printf 'NurseLink Member Benefits & Resources Foundation [OK]\n'

printf 'Saved Benefits & Availability Intelligence [OK]\n'
printf 'Benefit Analytics [OK]\n'
printf 'NurseLink v5.5.2 Benefit Intelligence Foundation [OK]\n'

printf 'Benefit Reminder generator: php %s/nurselink_benefit_reminders.php %s\n' "$SCRIPT_DIR" "$API_ROOT"
printf 'NurseLink v5.5.2 Benefit Reminder Foundation [OK]\n'

printf 'Member Engagement Hub: https://app.amsertech.com/nurselink-engagement.html\n'
printf 'Engagement Command Center: https://app.amsertech.com/nurselink-engagement-command-center.html\n'
printf 'NurseLink v5.5.2 Member Engagement & Benefits milestone [OK]\n'

printf 'Enterprise Member Portal: https://app.amsertech.com/nurselink-enterprise.html\n'
printf 'Enterprise Command Center: https://app.amsertech.com/nurselink-enterprise-command-center.html\n'
printf 'Enterprise Partner Analytics: https://app.amsertech.com/nurselink-enterprise-partner.html\n'
printf 'NurseLink v5.5.2 Enterprise Platform milestone [OK]\n'

printf 'Enterprise Member Goals: https://app.amsertech.com/nurselink-enterprise-goals.html\n'
printf 'Enterprise Goal Management: https://app.amsertech.com/nurselink-enterprise-goals-admin.html\n'
printf 'Enterprise Partner Goal Analytics: https://app.amsertech.com/nurselink-enterprise-goals-partner.html\n'
printf 'NurseLink v5.5.2 Enterprise Cohort Goals & Progress Foundation [OK]\n'

printf 'NurseLink v5.5.2 Enterprise Goal privacy-validator hotfix [OK]\n'

printf 'Enterprise Invitations: https://app.amsertech.com/nurselink-enterprise-invitations.html\n'
printf 'Enterprise Enrollment Admin: https://app.amsertech.com/nurselink-enterprise-enrollment-admin.html\n'
printf 'Enterprise Enrollment Partner Reporting: https://app.amsertech.com/nurselink-enterprise-enrollment-partner.html\n'
printf 'NurseLink v5.5.2 Enterprise Enrollment & Organization Reporting [OK]\n'

printf 'Enterprise Member Outcomes: https://app.amsertech.com/nurselink-enterprise-outcomes.html\n'
printf 'Enterprise Outcomes Admin: https://app.amsertech.com/nurselink-enterprise-outcomes-admin.html\n'
printf 'Enterprise Outcomes Partner Analytics: https://app.amsertech.com/nurselink-enterprise-outcomes-partner.html\n'
printf 'NurseLink v5.5.2 Enterprise Cohort Completion & Outcome Reporting [OK]\n'

printf 'Enterprise Member Support: https://app.amsertech.com/nurselink-enterprise-support.html\n'
printf 'Enterprise Support Admin: https://app.amsertech.com/nurselink-enterprise-support-admin.html\n'
printf 'Enterprise Support Partner Analytics: https://app.amsertech.com/nurselink-enterprise-support-partner.html\n'
printf 'NurseLink v5.5.2 Enterprise Check-ins, Support & Follow-up [OK]\n'

printf 'Membership review, onboarding, registry and role management consolidated in Administrator Portal [OK]\n'
printf 'Member onboarding and activation consolidated in Member Portal [OK]\n'
printf 'Legacy membership URLs now operate as compatibility redirects [OK]\n'

printf 'Member Sign In: https://app.amsertech.com/login\n'
printf 'Member Portal: https://app.amsertech.com/dashboard\n'
printf 'Administrator Sign In: https://app.amsertech.com/nurselink-admin-login.html\n'
printf 'Administrator Portal: https://app.amsertech.com/nurselink-admin-dashboard.html\n'
printf 'Administration Operations Center: https://app.amsertech.com/nurselink-admin-dashboard.html\n'
printf 'NurseLink v5.5.2 Administration Operations Center [OK]\n'

printf 'Administrator standalone routing hardening [OK]\n'
printf 'Administrator entry-point direct deployment [OK]\n'
printf 'Member SPA fallback exclusion [OK]\n'

printf 'Administrator React-SPA rescue fallback [OK]\n'
printf 'Administrator member-router bypass [OK]\n'

printf 'Administrator pre-React root-index interception [OK]\n'
printf 'Administrator SPA document-response bootstrap [OK]\n'

printf 'Centralized Operations Center launcher validation [OK]\n'
printf 'Credential Compliance Verification-domain launcher [OK]\n'

printf 'Standalone routing exact-literal package preflight [OK]\n'
printf 'Over-escaped Administrator routing grep removed [OK]\n'

printf 'Administrator Sign In: https://app.amsertech.com/admin/login.html\n'
printf 'Administration Operations Center: https://app.amsertech.com/admin/\n'
printf 'Physical Administrator directory isolation [OK]\n'

printf 'Physical Administrator direct delivery repair [OK]\n'
printf 'Live /admin/ filesystem and HTTP verification [OK]\n'

printf 'Administrator light-blue theme [OK]\n'
printf 'Member login visual isolation [OK]\n'

printf 'Membership Processing Progress summary [OK]\n'
printf 'Recent Administrator Activity summary [OK]\n'
printf 'Administrator Follow-up reminders [OK]\n'

printf 'Administrator protected-content no-flash gate [OK]\n'
printf 'Administrator session-first reveal [OK]\n'

printf 'Administrator single Member / Applicant link [OK]\n'

printf 'Administrator Global Search [OK]\n'
printf 'Role-Aware Administrator Workbench [OK]\n'
printf 'Support Case productivity filters [OK]\n'

printf 'Professional Applications Command Center [OK]\n'
printf 'Applications pipeline + SLA table [OK]\n'
printf 'Application review drawer + pagination [OK]\n'
printf 'Applications privacy boundary [OK]\n'

printf 'Namecheap curl error-23 verifier hotfix [OK]\n'
printf 'Downloaded HTTPS Administrator JavaScript validation [OK]\n'

printf 'Application quick triage views [OK]\n'
printf 'Reviewer workload balancing [OK]\n'
printf 'Saved Administrator queue views [OK]\n'
printf 'Controlled application CSV export [OK]\n'

say "SUCCESS"

printf '\nNurseLink v5.5.2 Applications Triage & Reviewer Workload installed successfully.\n'
printf 'Includes the cumulative NurseLink platform plus credential expiry intelligence, member renewal workflows, Administrator Credential Compliance Center, advisory alerts, Membership Lifecycle, Super Administrator Test Mode and verified two-stage installer cleanup.\n'
printf 'Backup: %s\n' "$BACKUP_DIR"
printf 'Rollback: cd "%s" && ./rollback.sh\n\n' "$SCRIPT_DIR"
