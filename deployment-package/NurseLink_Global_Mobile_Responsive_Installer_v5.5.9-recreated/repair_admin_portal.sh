#!/usr/bin/env bash
set -Eeuo pipefail

VERSION="5.5.2"
HOME_ROOT="/home/frankresma"
WEB_ROOT="$HOME_ROOT/nurselink-web"
LIVE_ROOT="$HOME_ROOT/app.amsertech.com"
BACKUP_ROOT="$HOME_ROOT/nurselink-backups"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_ADMIN="$SCRIPT_DIR/payload/admin"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/admin-direct-v552-$STAMP"

say() {
  printf '\n[NurseLink v%s] %s\n' "$VERSION" "$1"
}

fail() {
  printf '\nERROR: %s\n' "$1" >&2
  exit 1
}

[[ -d "$PAYLOAD_ADMIN" ]] \
  || fail "Physical Administrator payload directory is missing."

required=(
  index.html
  login.html
  dashboard.js
  login.js
  portal-config.js
  admin-portal.css
  admin-consolidated.css
  .htaccess
)

for name in "${required[@]}"; do
  [[ -f "$PAYLOAD_ADMIN/$name" ]] \
    || fail "Physical Administrator payload file is missing: $name"
done

[[ -d "$LIVE_ROOT" ]] \
  || fail "Live app root does not exist: $LIVE_ROOT"

[[ -d "$WEB_ROOT" ]] \
  || fail "React source root does not exist: $WEB_ROOT"

mkdir -p "$BACKUP_DIR"

say "Creating focused Administrator delivery backup"

if [[ -d "$LIVE_ROOT/admin" ]]; then
  mkdir -p "$BACKUP_DIR/live-admin"
  cp -a "$LIVE_ROOT/admin/." "$BACKUP_DIR/live-admin/"
  touch "$BACKUP_DIR/live-admin.existed"
fi

if [[ -d "$WEB_ROOT/public/admin" ]]; then
  mkdir -p "$BACKUP_DIR/public-admin"
  cp -a "$WEB_ROOT/public/admin/." "$BACKUP_DIR/public-admin/"
  touch "$BACKUP_DIR/public-admin.existed"
fi

if [[ -d "$WEB_ROOT/dist/admin" ]]; then
  mkdir -p "$BACKUP_DIR/dist-admin"
  cp -a "$WEB_ROOT/dist/admin/." "$BACKUP_DIR/dist-admin/"
  touch "$BACKUP_DIR/dist-admin.existed"
fi

for path in \
  "$LIVE_ROOT/.htaccess" \
  "$WEB_ROOT/public/.htaccess" \
  "$WEB_ROOT/dist/.htaccess"
do
  if [[ -f "$path" ]]; then
    key="$(printf '%s' "$path" | sed 's#[/ ]#_#g')"
    cp -a "$path" "$BACKUP_DIR/$key"
  fi
done

say "Deploying physical Administrator directory directly"

rm -rf "$LIVE_ROOT/admin"
mkdir -p "$LIVE_ROOT/admin"
cp -a "$PAYLOAD_ADMIN/." "$LIVE_ROOT/admin/"

mkdir -p "$WEB_ROOT/public"
rm -rf "$WEB_ROOT/public/admin"
mkdir -p "$WEB_ROOT/public/admin"
cp -a "$PAYLOAD_ADMIN/." "$WEB_ROOT/public/admin/"

if [[ -d "$WEB_ROOT/dist" ]]; then
  rm -rf "$WEB_ROOT/dist/admin"
  mkdir -p "$WEB_ROOT/dist/admin"
  cp -a "$PAYLOAD_ADMIN/." "$WEB_ROOT/dist/admin/"
fi

python3 - \
  "$LIVE_ROOT/.htaccess" \
  "$WEB_ROOT/public/.htaccess" \
  "$WEB_ROOT/dist/.htaccess" \
  <<'PYADMINHT537'
from pathlib import Path
import re
import sys

start = "# NURSELINK_ADMIN_PHYSICAL_V537_START"
end = "# NURSELINK_ADMIN_PHYSICAL_V537_END"

block = """# NURSELINK_ADMIN_PHYSICAL_V537_START
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteRule ^admin(?:/.*)?$ - [END]
</IfModule>
# NURSELINK_ADMIN_PHYSICAL_V537_END
"""

pattern = re.compile(
    re.escape(start)
    + r".*?"
    + re.escape(end)
    + r"\n?",
    re.S,
)

for raw in sys.argv[1:]:
    path = Path(raw)

    if not path.parent.exists():
        continue

    text = (
        path.read_text(encoding="utf-8")
        if path.exists()
        else ""
    )

    text = pattern.sub("", text)

    path.write_text(
        block + "\n" + text.lstrip("\n"),
        encoding="utf-8",
    )

    check = path.read_text(encoding="utf-8")

    if block.strip() not in check:
        raise SystemExit(
            "Unable to install /admin/ SPA bypass into "
            + str(path)
        )

print(
    "Physical /admin/ rewrite bypass installed [OK]"
)
PYADMINHT537

say "Verifying local physical Administrator files"

for name in "${required[@]}"; do
  [[ -f "$LIVE_ROOT/admin/$name" ]] \
    || fail "Live Administrator file missing: admin/$name"

  cmp -s "$PAYLOAD_ADMIN/$name" "$LIVE_ROOT/admin/$name" \
    || fail "Live Administrator file differs from payload: admin/$name"
done

grep -q "Administration Operations Center" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "Live physical Administrator index identity missing."

grep -q "/api/nurselink/admin/session-login" \
  "$LIVE_ROOT/admin/login.js" \
  || fail "Live physical Administrator Login workflow missing."

grep -q "/api/nurselink/admin/operations-center/summary" \
  "$LIVE_ROOT/admin/dashboard.js" \
  || fail "Live physical Operations Center workflow missing."

say "Verifying Administrator light-blue theme"

for css in \
  "$LIVE_ROOT/admin/admin-portal.css" \
  "$LIVE_ROOT/admin/admin-consolidated.css"
do
  grep -q "NURSELINK_ADMIN_LIGHT_BLUE_V538_START" "$css" \
    || fail "Administrator light-blue theme marker missing: $css"
done

grep -q "#f5faff" "$LIVE_ROOT/admin/admin-consolidated.css" \
  || fail "Administrator light-blue sidebar palette missing."

grep -q "#d8ebff" "$LIVE_ROOT/admin/admin-consolidated.css" \
  || fail "Administrator light-blue active-navigation palette missing."

printf 'Administrator light-blue theme files [OK]\n'

grep -q "NURSELINK_ADMIN_PROGRESS_SUMMARY_V540_START" \
  "$LIVE_ROOT/admin/admin-consolidated.css" \
  || fail "Administrator v5.5.2 dashboard progress styling missing."

grep -q "Membership Processing Progress" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "Administrator v5.5.2 membership progress panel missing."

grep -q "dashboardRecentActivity" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "Administrator v5.5.2 recent activity panel missing."

grep -q "dashboardReminders" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "Administrator v5.5.2 reminder panel missing."

grep -q "membershipProgress" \
  "$LIVE_ROOT/admin/dashboard.js" \
  || fail "Administrator v5.5.2 progress workflow JavaScript missing."

printf 'Administrator v5.5.2 operational dashboard milestone [OK]\n'
grep -q "nl-admin-session-pending" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "Administrator protected-shell pending state missing."

grep -q "nurselink-admin-session-gate-v541" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "Administrator inline no-flash session gate missing."

grep -q "NURSELINK_ADMIN_SESSION_GATE_V541_START" \
  "$LIVE_ROOT/admin/admin-consolidated.css" \
  || fail "Administrator session-gate styling missing."

grep -q "revealAdministratorPortal" \
  "$LIVE_ROOT/admin/dashboard.js" \
  || fail "Administrator delayed portal reveal workflow missing."

grep -q "Administrator sign-in is required. Redirecting securely" \
  "$LIVE_ROOT/admin/dashboard.js" \
  || fail "Administrator secure redirect gate messaging missing."

printf 'Administrator no-flash session gate v5.5.2 [OK]\n'

python3 - "$LIVE_ROOT/admin/login.html" <<'PYADMINLOGINLINK541'
from pathlib import Path
import re
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")

if text.count('href="/login"') != 1:
    raise SystemExit(
        "Administrator login must contain exactly one Member / Applicant link."
    )

if "Member / Applicant Sign In" not in text:
    raise SystemExit(
        "Member / Applicant Sign In link is missing."
    )

if 'href="/">NurseLink Home</a>' in text:
    raise SystemExit(
        "NurseLink Home link must not appear below the Administrator sign-in button."
    )

if "nl-admin-auth-footnote" in text:
    raise SystemExit(
        "Extra Administrator login footnote must not appear below the Member / Applicant link."
    )

form_end = text.find("</form>")
member_link = text.find("Member / Applicant Sign In")

if form_end < 0 or member_link < form_end:
    raise SystemExit(
        "Member / Applicant Sign In must appear directly after the Administrator sign-in form."
    )

print(
    "Administrator single Member / Applicant link v5.5.2 [OK]"
)
PYADMINLOGINLINK541

grep -q "adminGlobalSearch" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "Administrator global search input missing."

grep -q "adminRoleWorkbench" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "Administrator role-aware workbench missing."

grep -q "supportAssignment" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "Administrator Support Case assignment filter missing."

grep -q "NURSELINK_ADMIN_WORKBENCH_V542_START" \
  "$LIVE_ROOT/admin/admin-consolidated.css" \
  || fail "Administrator v5.5.2 workbench styling missing."

grep -q "runGlobalSearch" \
  "$LIVE_ROOT/admin/dashboard.js" \
  || fail "Administrator global-search workflow missing."

grep -q "renderRoleWorkbench" \
  "$LIVE_ROOT/admin/dashboard.js" \
  || fail "Administrator role-aware workbench workflow missing."

grep -q "supportFilterPriority" \
  "$LIVE_ROOT/admin/dashboard.js" \
  || fail "Administrator Support Case filtering workflow missing."

printf 'Administrator Global Search & Role-Aware Workbench v5.5.2 [OK]\n'

grep -q "applicationCommandMetrics" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "v5.5.2 Applications Command Center KPI strip missing."

grep -q "applicationProgress" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "v5.5.2 Applications pipeline progress strip missing."

grep -q "nl550-applications-table" \
  "$LIVE_ROOT/admin/dashboard.js" \
  || fail "v5.5.2 professional Applications table workflow missing."

grep -q "applicationFilterPriority" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "v5.5.2 Applications priority filter missing."

grep -q "applicationOrganization" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "v5.5.2 Applications organization filter missing."

grep -q "applicationDetailDrawer" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "v5.5.2 Applications review drawer missing."

grep -q "NURSELINK_APPLICATIONS_COMMAND_CENTER_V550_START" \
  "$LIVE_ROOT/admin/admin-consolidated.css" \
  || fail "v5.5.2 Applications Command Center styling missing."

printf 'Applications Command Center major milestone v5.5.2 [OK]\n'




python3 - "$SCRIPT_DIR/repair_admin_portal.sh" <<'PYADMINHTTPS551'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")

for line in text.splitlines():
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
            "Unsafe curl-to-grep streaming verifier remains."
        )

for required in (
    'ADMIN_DASHBOARD_JS_TMP="/tmp/nurselink-admin-dashboard-v552.js"',
    'ADMIN_LOGIN_JS_TMP="/tmp/nurselink-admin-login-v552.js"',
    '-o "$ADMIN_DASHBOARD_JS_TMP"',
    '-o "$ADMIN_LOGIN_JS_TMP"',
    'grep -q "/api/nurselink/admin/operations-center/summary"',
    'grep -q "renderApplicationTable"',
    'grep -q "/api/nurselink/admin/session-login"',
):
    if required not in text:
        raise SystemExit(
            "v5.5.2 HTTPS verifier structure missing: "
            + required
        )

print(
    "Namecheap curl error-23 safe HTTPS verifier v5.5.2 [OK]"
)
PYADMINHTTPS551

grep -q "applicationWorkloadSection" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "v5.5.2 reviewer workload panel missing."

grep -q "applicationSavedView" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "v5.5.2 saved application views missing."

grep -q "exportApplications" \
  "$LIVE_ROOT/admin/index.html" \
  || fail "v5.5.2 controlled application export control missing."

grep -q "NURSELINK_APPLICATION_TRIAGE_V552_START" \
  "$LIVE_ROOT/admin/admin-consolidated.css" \
  || fail "v5.5.2 Applications triage styling missing."

grep -q "renderApplicationWorkload" \
  "$LIVE_ROOT/admin/dashboard.js" \
  || fail "v5.5.2 reviewer workload workflow missing."

grep -q "saveApplicationView" \
  "$LIVE_ROOT/admin/dashboard.js" \
  || fail "v5.5.2 saved application views workflow missing."

grep -q "exportApplicationQueue" \
  "$LIVE_ROOT/admin/dashboard.js" \
  || fail "v5.5.2 controlled export workflow missing."

printf 'Applications Triage & Reviewer Workload v5.5.2 [OK]\n'

say "Verifying actual HTTPS delivery"

curl -fsSL \
  -H 'Cache-Control: no-cache' \
  "https://app.amsertech.com/admin/?nlv=552&ts=$STAMP" \
  -o /tmp/nurselink-admin-v552.html \
  || fail "Unable to retrieve live /admin/ URL."

curl -fsSL \
  -H 'Cache-Control: no-cache' \
  "https://app.amsertech.com/admin/login.html?nlv=552&ts=$STAMP" \
  -o /tmp/nurselink-admin-login-v552.html \
  || fail "Unable to retrieve live /admin/login.html URL."

grep -q "Administration Operations Center" \
  /tmp/nurselink-admin-v552.html \
  || {
    printf '\nLive /admin/ response:\n' >&2
    head -30 /tmp/nurselink-admin-v552.html >&2 || true
    fail "The live /admin/ URL is still not serving the physical Operations Center."
  }

if grep -q '<div id="root"></div>' /tmp/nurselink-admin-v552.html; then
  fail "The live /admin/ URL is still serving the Member React SPA shell."
fi

grep -q "Administration Operations Center" \
  /tmp/nurselink-admin-login-v552.html \
  || fail "The live /admin/login.html URL is not serving the Administrator Login."

ADMIN_DASHBOARD_JS_TMP="/tmp/nurselink-admin-dashboard-v552.js"
ADMIN_LOGIN_JS_TMP="/tmp/nurselink-admin-login-v552.js"

rm -f \
  "$ADMIN_DASHBOARD_JS_TMP" \
  "$ADMIN_LOGIN_JS_TMP"

curl -fsSL \
  -H 'Cache-Control: no-cache' \
  "https://app.amsertech.com/admin/dashboard.js?nlv=552&ts=$STAMP" \
  -o "$ADMIN_DASHBOARD_JS_TMP" \
  || fail "Unable to retrieve live /admin/dashboard.js URL."

curl -fsSL \
  -H 'Cache-Control: no-cache' \
  "https://app.amsertech.com/admin/login.js?nlv=552&ts=$STAMP" \
  -o "$ADMIN_LOGIN_JS_TMP" \
  || fail "Unable to retrieve live /admin/login.js URL."

[[ -s "$ADMIN_DASHBOARD_JS_TMP" ]] \
  || fail "Live /admin/dashboard.js response is empty."

[[ -s "$ADMIN_LOGIN_JS_TMP" ]] \
  || fail "Live /admin/login.js response is empty."

grep -q "/api/nurselink/admin/operations-center/summary" \
  "$ADMIN_DASHBOARD_JS_TMP" \
  || {
    printf '\nLive /admin/dashboard.js response preview:\n' >&2
    head -20 "$ADMIN_DASHBOARD_JS_TMP" >&2 || true
    fail "Live /admin/dashboard.js is not the Operations Center JavaScript."
  }

grep -q "renderApplicationTable" \
  "$ADMIN_DASHBOARD_JS_TMP" \
  || fail "Live /admin/dashboard.js does not contain the v5.5.x Applications Command Center."

grep -q "/api/nurselink/admin/session-login" \
  "$ADMIN_LOGIN_JS_TMP" \
  || {
    printf '\nLive /admin/login.js response preview:\n' >&2
    head -20 "$ADMIN_LOGIN_JS_TMP" >&2 || true
    fail "Live /admin/login.js is not the Administrator Login JavaScript."
  }

printf 'Downloaded Administrator JavaScript HTTPS verification [OK]\n'

printf '\nPhysical Administrator portal repair [SUCCESS]\n'
printf 'Administrator Sign In: https://app.amsertech.com/admin/login.html\n'
printf 'Administration Operations Center: https://app.amsertech.com/admin/\n'
printf 'Backup: %s\n' "$BACKUP_DIR"
