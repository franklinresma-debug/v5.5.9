#!/usr/bin/env bash
set -euo pipefail

STAMP="$(date -u +%Y%m%d-%H%M%S)"
BASELINE_ROOT="/home/nurselink-backup/production-baselines"
RELEASE_NAME="NurseLink_Production_Baseline_${STAMP}"
RELEASE_DIR="$BASELINE_ROOT/$RELEASE_NAME"
ARCHIVE="$RELEASE_DIR/${RELEASE_NAME}.tar.gz"
SNAPSHOT="$RELEASE_DIR/snapshot"

mkdir -p "$RELEASE_DIR"

{
  printf 'NurseLink Production Recovery Baseline\n'
  printf 'Created UTC: %s\n' "$(date -u --iso-8601=seconds)"
  printf 'Host: %s\n' "$(hostname)"
  printf 'Purpose: sanitized current-production source and built-asset recovery baseline\n'
  printf 'Database: stored separately in the protected VPS backup area\n'
  printf 'Secrets and user data: intentionally excluded\n'
  printf '\nRuntime versions\n'
  php -v | head -n 1
  node --version
  npm --version
  nginx -v 2>&1
  mariadb --version | head -n 1
} > "$RELEASE_DIR/MANIFEST.txt"

find /var/www/nurselink-api/database/migrations -maxdepth 1 -type f -printf '%f\n' \
  | sort > "$RELEASE_DIR/API_MIGRATIONS.txt"

(
  cd /var/www/nurselink-api
  php artisan route:list --json
) > "$RELEASE_DIR/API_ROUTES.json"

mkdir -p "$SNAPSHOT"

RSYNC_EXCLUDES=(
  --exclude='.env'
  --exclude='.env.*'
  --exclude='.git/'
  --exclude='.nurselink-backups/'
  --exclude='.nurselink-releases/'
  --exclude='vendor/'
  --exclude='node_modules/'
  --exclude='storage/'
  --exclude='public/storage'
  --exclude='bootstrap/cache/*.php'
  --exclude='npm-debug.log*'
  --exclude='NurseLink_*_Installer_*'
)

for source in nurselink-api nurselink-web app.amsertech.com; do
  rsync -a "${RSYNC_EXCLUDES[@]}" "/var/www/$source/" "$SNAPSHOT/$source/"
done

# A second pass catches files that changed during the first copy.
for source in nurselink-api nurselink-web app.amsertech.com; do
  rsync -a --delete "${RSYNC_EXCLUDES[@]}" "/var/www/$source/" "$SNAPSHOT/$source/"
done

tar -czf "$ARCHIVE" -C "$SNAPSHOT" \
  nurselink-api nurselink-web app.amsertech.com

tar -tzf "$ARCHIVE" > "$RELEASE_DIR/ARCHIVE_CONTENTS.txt"

if grep -Eq '(^|/)\.env($|\.)|(^|/)(vendor|node_modules|storage|\.git|\.nurselink-backups|\.nurselink-releases)(/|$)' "$RELEASE_DIR/ARCHIVE_CONTENTS.txt"; then
  printf 'Refusing baseline: excluded sensitive/runtime paths were found.\n' >&2
  exit 1
fi

sha256sum "$ARCHIVE" "$RELEASE_DIR/MANIFEST.txt" \
  "$RELEASE_DIR/API_MIGRATIONS.txt" "$RELEASE_DIR/API_ROUTES.json" \
  > "$RELEASE_DIR/SHA256SUMS"

case "$SNAPSHOT" in
  /home/nurselink-backup/production-baselines/NurseLink_Production_Baseline_*/snapshot)
    rm -rf -- "$SNAPSHOT"
    ;;
  *)
    printf 'Refusing to remove unexpected snapshot path: %s\n' "$SNAPSHOT" >&2
    exit 1
    ;;
esac

chmod 0700 "$RELEASE_DIR"
chmod 0600 "$RELEASE_DIR"/*

printf 'BASELINE_DIR=%s\n' "$RELEASE_DIR"
printf 'ARCHIVE=%s\n' "$ARCHIVE"
stat -c 'ARCHIVE_SIZE=%s' "$ARCHIVE"
sha256sum "$ARCHIVE"
