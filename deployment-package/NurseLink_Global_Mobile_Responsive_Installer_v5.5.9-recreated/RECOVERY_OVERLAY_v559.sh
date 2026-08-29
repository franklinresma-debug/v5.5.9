#!/usr/bin/env bash
set -euo pipefail
say(){ printf '\n[NurseLink v5.5.9 recovery] %s\n' "$1"; }
fail(){ printf '\nERROR: %s\n' "$1" >&2; exit 1; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_DIR="$SCRIPT_DIR/payload"
WEB_ROOT="${WEB_ROOT:-/home/frankresma/nurselink-web}"
API_ROOT="${API_ROOT:-/home/frankresma/nurselink-api}"
PHP_BIN="${PHP_BIN:-php}"
[[ -d "$WEB_ROOT" ]] || fail "Web root missing: $WEB_ROOT"
[[ -d "$API_ROOT" ]] || fail "API root missing: $API_ROOT"
say "Installing reconstructed Smart Registration and lifecycle recovery"
for f in SmartRegistrationController.php AdminSmartRegistrationController.php MembershipCycleHealthController.php; do cp -f "$PAYLOAD_DIR/api/app/Http/Controllers/Api/$f" "$API_ROOT/app/Http/Controllers/Api/$f"; "$PHP_BIN" -l "$API_ROOT/app/Http/Controllers/Api/$f" >/dev/null; done
cp -f "$PAYLOAD_DIR/api/app/Services/MembershipLifecycleService.php" "$API_ROOT/app/Services/MembershipLifecycleService.php"; "$PHP_BIN" -l "$API_ROOT/app/Services/MembershipLifecycleService.php" >/dev/null
cp -f "$PAYLOAD_DIR/api/app/Http/Controllers/Api/MembershipController.php" "$API_ROOT/app/Http/Controllers/Api/MembershipController.php"; "$PHP_BIN" -l "$API_ROOT/app/Http/Controllers/Api/MembershipController.php" >/dev/null
for f in 2026_08_16_043000_create_nurselink_smart_registration.php 2026_08_16_044000_create_nurselink_membership_cycle_health.php; do cp -f "$PAYLOAD_DIR/api/database/migrations/$f" "$API_ROOT/database/migrations/$f"; "$PHP_BIN" -l "$API_ROOT/database/migrations/$f" >/dev/null; done
python3 - "$API_ROOT/routes/api.php" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); s=p.read_text()
block="""/* NURSELINK_RECREATED_V559_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/nurselink/smart-registration', [\\App\\Http\\Controllers\\Api\\SmartRegistrationController::class, 'show']);
    Route::put('/nurselink/smart-registration/profile', [\\App\\Http\\Controllers\\Api\\SmartRegistrationController::class, 'save']);
    Route::post('/nurselink/smart-registration/documents', [\\App\\Http\\Controllers\\Api\\SmartRegistrationController::class, 'upload']);
    Route::get('/nurselink/smart-registration/documents/{id}', [\\App\\Http\\Controllers\\Api\\SmartRegistrationController::class, 'document'])->whereNumber('id');
    Route::post('/nurselink/smart-registration/submit', [\\App\\Http\\Controllers\\Api\\SmartRegistrationController::class, 'submit']);
    Route::post('/nurselink/smart-registration/resubmit', [\\App\\Http\\Controllers\\Api\\SmartRegistrationController::class, 'resubmit']);
    Route::get('/nurselink/admin/smart-registration/{membershipId}', [\\App\\Http\\Controllers\\Api\\AdminSmartRegistrationController::class, 'show'])->whereNumber('membershipId');
    Route::get('/nurselink/admin/smart-registration/documents/{id}', [\\App\\Http\\Controllers\\Api\\AdminSmartRegistrationController::class, 'document'])->whereNumber('id');
    Route::get('/nurselink/admin/membership-cycle-health/{id}', [\\App\\Http\\Controllers\\Api\\MembershipCycleHealthController::class, 'show'])->whereNumber('id');
    Route::post('/nurselink/admin/membership-cycle-health/{id}/reconcile', [\\App\\Http\\Controllers\\Api\\MembershipCycleHealthController::class, 'reconcile'])->whereNumber('id');
});
/* NURSELINK_RECREATED_V559_END */"""
if 'NURSELINK_RECREATED_V559_START' not in s: p.write_text(s.rstrip()+"\n\n"+block+"\n")
PY
"$PHP_BIN" -l "$API_ROOT/routes/api.php" >/dev/null
cd "$API_ROOT"; "$PHP_BIN" artisan migrate --force; "$PHP_BIN" artisan optimize:clear >/dev/null 2>&1 || true
mkdir -p "$WEB_ROOT/public"; cp -f "$PAYLOAD_DIR/smart-registration.html" "$WEB_ROOT/public/smart-registration.html"; cp -f "$PAYLOAD_DIR/smart-registration.css" "$WEB_ROOT/public/smart-registration.css"; cp -f "$PAYLOAD_DIR/smart-registration.js" "$WEB_ROOT/public/smart-registration.js"
"$PHP_BIN" artisan route:list | grep -q 'nurselink/smart-registration' || fail "Smart Registration routes missing."
grep -q 'nl_sr_docs_user_type_idx' "$API_ROOT/database/migrations/2026_08_16_043000_create_nurselink_smart_registration.php" || fail "MariaDB-safe Smart Registration indexes missing."
grep -q 'ensureOnboarding' "$API_ROOT/app/Services/MembershipLifecycleService.php" || fail "Approval-to-onboarding service bridge missing."
say "Reconstructed v5.5.9 recovery layer installed"
printf 'Smart Registration: https://app.amsertech.com/smart-registration.html?smartstep=1\n'
