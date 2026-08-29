#!/usr/bin/env bash
set -euo pipefail

MODE="dry-run"
ARCHIVE=""
API_ROOT="${API_ROOT:-/var/www/nurselink-api}"
WEB_ROOT="${WEB_ROOT:-/var/www/nurselink-web}"
LIVE_ROOT="${LIVE_ROOT:-/var/www/app.amsertech.com}"

usage() {
  cat <<'EOF'
Usage:
  ./restore-nurselink-baseline.sh --archive PATH [--dry-run]
  ./restore-nurselink-baseline.sh --archive PATH --apply

Environment overrides:
  API_ROOT  (default /var/www/nurselink-api)
  WEB_ROOT  (default /var/www/nurselink-web)
  LIVE_ROOT (default /var/www/app.amsertech.com)

This restores application source and built assets only. It never restores a
database, .env file, dependency directory, cache, log, or uploaded document.
EOF
}

while (($#)); do
  case "$1" in
    --archive)
      ARCHIVE="${2:-}"
      shift 2
      ;;
    --dry-run)
      MODE="dry-run"
      shift
      ;;
    --apply)
      MODE="apply"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

[[ -n "$ARCHIVE" ]] || { printf 'ERROR: --archive is required.\n' >&2; exit 2; }
[[ -f "$ARCHIVE" ]] || { printf 'ERROR: archive not found: %s\n' "$ARCHIVE" >&2; exit 2; }
command -v tar >/dev/null || { printf 'ERROR: tar is required.\n' >&2; exit 2; }
command -v rsync >/dev/null || { printf 'ERROR: rsync is required.\n' >&2; exit 2; }

if [[ "$MODE" == "apply" && "${EUID:-$(id -u)}" -ne 0 ]]; then
  printf 'ERROR: --apply must run as root.\n' >&2
  exit 2
fi

ARCHIVE="$(readlink -f "$ARCHIVE")"
WORK_DIR="$(mktemp -d /tmp/nurselink-restore-XXXXXXXX)"

cleanup() {
  case "$WORK_DIR" in
    /tmp/nurselink-restore-????????) rm -rf -- "$WORK_DIR" ;;
    *) printf 'WARNING: refusing cleanup of unexpected path: %s\n' "$WORK_DIR" >&2 ;;
  esac
}
trap cleanup EXIT

tar -tzf "$ARCHIVE" > "$WORK_DIR/archive-contents.txt"

if grep -Eq '^/|(^|/)\.\.(/|$)' "$WORK_DIR/archive-contents.txt"; then
  printf 'ERROR: archive contains an absolute or parent-traversal path.\n' >&2
  exit 3
fi

if grep -Eq '(^|/)\.env($|\.)|(^|/)(vendor|node_modules|storage|\.git|\.nurselink-backups|\.nurselink-releases)(/|$)' "$WORK_DIR/archive-contents.txt"; then
  printf 'ERROR: archive contains excluded secret, dependency, runtime, or backup paths.\n' >&2
  exit 3
fi

for required in \
  nurselink-api/routes/api.php \
  nurselink-api/artisan \
  nurselink-web/package.json \
  nurselink-web/dist/index.html \
  nurselink-web/dist/admin/dashboard.js; do
  grep -Fxq "$required" "$WORK_DIR/archive-contents.txt" || {
    printf 'ERROR: required archive entry is missing: %s\n' "$required" >&2
    exit 3
  }
done

tar -xzf "$ARCHIVE" -C "$WORK_DIR"

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
)

restore_tree() {
  local source="$1"
  local target="$2"
  local args=(-a --itemize-changes "${RSYNC_EXCLUDES[@]}")
  [[ "$MODE" == "dry-run" ]] && args+=(--dry-run)
  mkdir_args=()
  if [[ "$MODE" == "apply" ]]; then
    mkdir -p "$target"
  elif [[ ! -d "$target" ]]; then
    printf 'DRY-RUN target would be created: %s\n' "$target"
    target="$WORK_DIR/dry-run-target/$(basename "$target")"
    mkdir -p "$target"
  fi
  rsync "${args[@]}" "$source/" "$target/"
}

printf 'Mode: %s\n' "$MODE"
printf 'Archive: %s\n' "$ARCHIVE"
printf 'API target: %s\n' "$API_ROOT"
printf 'Web target: %s\n' "$WEB_ROOT"
printf 'Live compatibility target: %s\n' "$LIVE_ROOT"

restore_tree "$WORK_DIR/nurselink-api" "$API_ROOT"
restore_tree "$WORK_DIR/nurselink-web" "$WEB_ROOT"
restore_tree "$WORK_DIR/app.amsertech.com" "$LIVE_ROOT"

if [[ "$MODE" == "dry-run" ]]; then
  printf 'DRY-RUN COMPLETE: no production files were changed.\n'
  exit 0
fi

[[ -f "$API_ROOT/.env" ]] || {
  printf 'ERROR: API .env is missing after source restore. Restore it from secure configuration backup.\n' >&2
  exit 4
}

if command -v php >/dev/null; then
  php -l "$API_ROOT/routes/api.php"
  (
    cd "$API_ROOT"
    php artisan optimize:clear
    php artisan route:list >/dev/null
  )
fi

if command -v node >/dev/null; then
  node --check "$WEB_ROOT/dist/admin/dashboard.js"
fi

printf 'SOURCE RESTORE COMPLETE. Database restoration was not performed.\n'
