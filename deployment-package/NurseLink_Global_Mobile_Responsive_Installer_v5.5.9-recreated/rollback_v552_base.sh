#!/usr/bin/env bash
set -Eeuo pipefail

WEB_ROOT="${WEB_ROOT:-/home/frankresma/nurselink-web}"
API_ROOT="${API_ROOT:-/home/frankresma/nurselink-api}"
LIVE_ROOT="${LIVE_ROOT:-/home/frankresma/app.amsertech.com}"
PHP_BIN="${PHP_BIN:-$(command -v php || true)}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ -f "$SCRIPT_DIR/.last_backup" ]] || fail "No backup record found."
BACKUP_DIR="$(cat "$SCRIPT_DIR/.last_backup")"
[[ -d "$BACKUP_DIR" ]] || fail "Backup directory missing."

ENTRY_FILE="$(cat "$BACKUP_DIR/entry-file.txt")"
ENTRY_BACKUP="$BACKUP_DIR/source/$(basename "$ENTRY_FILE")"

printf '\n[NurseLink v5.5.2] Rolling back migrations newly applied by v5.5.2...\n'

rollback_if_new() {
  local migration="$1"
  local flag="$2"

  if [[ ! -f "$BACKUP_DIR/api/$flag" && -f "$API_ROOT/database/migrations/$migration" ]]; then
    "$PHP_BIN" artisan migrate:rollback --force --path="database/migrations/$migration" || true
  fi
}

if [[ -n "${PHP_BIN:-}" && -x "$PHP_BIN" && -f "$API_ROOT/artisan" ]]; then
  cd "$API_ROOT"

  rollback_if_new "$SUPPORT_CASES_MIGRATION" "support-cases-migration-was-applied"
  rollback_if_new "$MEMBERSHIP_ONBOARDING_MIGRATION" "membership-onboarding-migration-was-applied"
  rollback_if_new "$MEMBERSHIP_ADMIN_MIGRATION" "membership-admin-migration-was-applied"
  rollback_if_new "$ENTERPRISE_SUPPORT_MIGRATION" "enterprise-support-migration-was-applied"
  rollback_if_new "$ENTERPRISE_OUTCOMES_MIGRATION" "enterprise-outcomes-migration-was-applied"
  rollback_if_new "$ENTERPRISE_INVITATIONS_MIGRATION" "enterprise-invitations-migration-was-applied"
  rollback_if_new "$ENTERPRISE_GOALS_MIGRATION" "enterprise-goals-migration-was-applied"
  rollback_if_new "$ENTERPRISE_MIGRATION" "enterprise-migration-was-applied"
  rollback_if_new "$BENEFIT_REMINDER_MIGRATION" "benefit-reminder-migration-was-applied"
  rollback_if_new "$SAVED_BENEFITS_MIGRATION" "saved-benefits-migration-was-applied"
  rollback_if_new "$BENEFITS_MIGRATION" "benefits-migration-was-applied"
  rollback_if_new "$MENTORING_MIGRATION" "mentoring-migration-was-applied"
  rollback_if_new "$CHAPTERS_MIGRATION" "chapters-migration-was-applied"
  rollback_if_new "$EVENTS_MIGRATION" "events-migration-was-applied"
  rollback_if_new "$CREDENTIAL_RENEWAL_WORKFLOW_MIGRATION" "credential-renewal-workflow-migration-was-applied"
  rollback_if_new "$MEMBERSHIP_LIFECYCLE_MIGRATION" "membership-lifecycle-migration-was-applied"
  rollback_if_new "$SUPER_ADMIN_MIGRATION" "super-admin-migration-was-applied"
  rollback_if_new "$CAREER_INTELLIGENCE_MIGRATION" "career-intelligence-migration-was-applied"
  rollback_if_new "$OPERATIONS_MIGRATION" "operations-migration-was-applied"
  rollback_if_new "$INTERVIEWS_MIGRATION" "interviews-migration-was-applied"
  rollback_if_new "$MESSAGES_MIGRATION" "messages-migration-was-applied"
  rollback_if_new "$PARTNER_AUDIT_MIGRATION" "partner-audit-migration-was-applied"
  rollback_if_new "$PARTNER_LINK_MIGRATION" "partner-link-migration-was-applied"
  rollback_if_new "$PARTNER_ACCESS_MIGRATION" "partner-access-migration-was-applied"
  rollback_if_new "$PARTNER_ORGS_MIGRATION" "partner-orgs-migration-was-applied"
  rollback_if_new "$PUBLIC_PROFILE_MIGRATION" "public-profile-migration-was-applied"
  rollback_if_new "$NOTIFICATIONS_MIGRATION" "notifications-migration-was-applied"
  rollback_if_new "$MEMBERSHIP_MIGRATION" "membership-migration-was-applied"
  rollback_if_new "$REVIEW_AUDIT_MIGRATION" "review-audit-migration-was-applied"
  rollback_if_new "$REVIEW_META_MIGRATION" "review-meta-migration-was-applied"
  rollback_if_new "$REVIEWER_ACCESS_MIGRATION" "reviewer-access-migration-was-applied"
  rollback_if_new "$APPLICATIONS_MIGRATION" "applications-migration-was-applied"
  rollback_if_new "$SAVED_JOBS_MIGRATION" "saved-jobs-migration-was-applied"
  rollback_if_new "$JOBS_MIGRATION" "jobs-migration-was-applied"
  rollback_if_new "$LEARNING_MIGRATION" "learning-migration-was-applied"
  rollback_if_new "$CAREER_MIGRATION" "career-migration-was-applied"
  rollback_if_new "$PORTFOLIO_MIGRATION" "portfolio-migration-was-applied"
  rollback_if_new "$CREDENTIAL_MIGRATION" "credential-migration-was-applied"
  rollback_if_new "$EMPLOYMENT_MIGRATION" "employment-migration-was-applied"
  rollback_if_new "$PROFILE_MIGRATION" "profile-migration-was-applied"
fi

printf '[NurseLink v5.5.2] Restoring API files...\n'

cp -f "$BACKUP_DIR/api/routes-api.php" "$API_ROOT/routes/api.php"

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
)

for controller in "${CONTROLLERS[@]}"; do
  if [[ -f "$BACKUP_DIR/api/$controller.existed" ]]; then
    cp -f "$BACKUP_DIR/api/$controller.previous" \
      "$API_ROOT/app/Http/Controllers/Api/$controller"
  else
    rm -f "$API_ROOT/app/Http/Controllers/Api/$controller"
  fi
done

if [[ -f "$BACKUP_DIR/api/BenefitReminderService.php.existed" ]]; then
  mkdir -p "$API_ROOT/app/Services"
  cp -f "$BACKUP_DIR/api/BenefitReminderService.php.previous"     "$API_ROOT/app/Services/BenefitReminderService.php"
else
  rm -f "$API_ROOT/app/Services/BenefitReminderService.php"
fi

if [[ -f "$BACKUP_DIR/api/EnsureApprovedNurseLinkMember.php.existed" ]]; then
  mkdir -p "$API_ROOT/app/Http/Middleware"
  cp -f "$BACKUP_DIR/api/EnsureApprovedNurseLinkMember.php.previous"     "$API_ROOT/app/Http/Middleware/EnsureApprovedNurseLinkMember.php"
else
  rm -f "$API_ROOT/app/Http/Middleware/EnsureApprovedNurseLinkMember.php"
fi

if [[ -f "$BACKUP_DIR/api/ClientSessionResetController.php.existed" ]]; then
  cp -f "$BACKUP_DIR/api/ClientSessionResetController.php.previous"     "$API_ROOT/app/Http/Controllers/Api/ClientSessionResetController.php"
else
  rm -f "$API_ROOT/app/Http/Controllers/Api/ClientSessionResetController.php"
fi

for migration in "${MIGRATIONS[@]}"; do
  if [[ -f "$BACKUP_DIR/api/$migration.file-existed" ]]; then
    cp -f "$BACKUP_DIR/api/$migration.previous" \
      "$API_ROOT/database/migrations/$migration"
  else
    rm -f "$API_ROOT/database/migrations/$migration"
  fi
done

if [[ -n "${PHP_BIN:-}" && -x "$PHP_BIN" && -f "$API_ROOT/artisan" ]]; then
  cd "$API_ROOT"
  [[ -f "$BACKUP_DIR/api/routes-web.php" ]] && cp -a "$BACKUP_DIR/api/routes-web.php" "$API_ROOT/routes/web.php"
[[ -f "$BACKUP_DIR/api/env.previous" ]] && cp -a "$BACKUP_DIR/api/env.previous" "$API_ROOT/.env"
if [[ -f "$BACKUP_DIR/api/cors.php.existed" && -f "$BACKUP_DIR/api/cors.php.previous" ]]; then
  cp -a "$BACKUP_DIR/api/cors.php.previous" "$API_ROOT/config/cors.php"
else
  rm -f "$API_ROOT/config/cors.php"
fi

"$PHP_BIN" artisan optimize:clear || true
fi

printf '[NurseLink v5.5.2] Restoring web source...\n'

cp -f "$ENTRY_BACKUP" "$ENTRY_FILE"

if [[ -f "$BACKUP_DIR/source/nurselink-mobile.js.previous" ]]; then
  cp -f "$BACKUP_DIR/source/nurselink-mobile.js.previous" "$WEB_ROOT/src/nurselink-mobile.js"
else
  rm -f "$WEB_ROOT/src/nurselink-mobile.js"
fi

if [[ -f "$BACKUP_DIR/source/nurselink-mobile.css.previous" ]]; then
  cp -f "$BACKUP_DIR/source/nurselink-mobile.css.previous" "$WEB_ROOT/src/nurselink-mobile.css"
else
  rm -f "$WEB_ROOT/src/nurselink-mobile.css"
fi

if [[ -f "$BACKUP_DIR/source/index.html.existed" ]]; then
  cp -f "$BACKUP_DIR/source/index.html.previous" "$WEB_ROOT/index.html"
fi


if [[ -f "$BACKUP_DIR/source/public-admin.existed" ]]; then
  rm -rf "$WEB_ROOT/public/admin"
  mkdir -p "$WEB_ROOT/public/admin"
  cp -a "$BACKUP_DIR/source/public-admin.previous/." \
    "$WEB_ROOT/public/admin/"
else
  rm -rf "$WEB_ROOT/public/admin"
fi


if [[ -f "$BACKUP_DIR/source/nurselink-admin-spa-rescue.js.existed" ]]; then
  cp -f "$BACKUP_DIR/source/nurselink-admin-spa-rescue.js.previous" \
    "$WEB_ROOT/src/nurselink-admin-spa-rescue.js"
else
  rm -f "$WEB_ROOT/src/nurselink-admin-spa-rescue.js"
fi


if [[ -f "$BACKUP_DIR/source/nurselink-nurse-montage.png.previous" ]]; then
  cp -f "$BACKUP_DIR/source/nurselink-nurse-montage.png.previous" "$WEB_ROOT/public/nurselink-nurse-montage.png"
else
  rm -f "$WEB_ROOT/public/nurselink-nurse-montage.png"
fi

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
  if [[ -f "$BACKUP_DIR/source/$file.existed" ]]; then
    cp -f "$BACKUP_DIR/source/$file.previous"       "$WEB_ROOT/public/$file"
  else
    rm -f "$WEB_ROOT/public/$file"
  fi
done

printf '[NurseLink v5.5.2] Restoring live web site...\n'

find "$LIVE_ROOT" -mindepth 1 -maxdepth 1 ! -name '.htaccess' -exec rm -rf {} +
cp -a "$BACKUP_DIR/live/." "$LIVE_ROOT/"

printf '\nRollback completed from:\n%s\n\n' "$BACKUP_DIR"
