#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
printf 'Rolling back using the original v5.5.2 cumulative rollback.\n'
bash "$SCRIPT_DIR/rollback_v552_base.sh"
