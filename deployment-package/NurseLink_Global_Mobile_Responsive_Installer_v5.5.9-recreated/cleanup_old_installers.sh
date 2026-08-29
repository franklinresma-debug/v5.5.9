#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CURRENT_DIR="$(cd "$SCRIPT_DIR" && pwd)"
python3 "$SCRIPT_DIR/post_install_cleanup.py" "$CURRENT_DIR" "manual"
