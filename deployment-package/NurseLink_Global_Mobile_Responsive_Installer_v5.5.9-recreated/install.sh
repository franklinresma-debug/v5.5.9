#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
printf '\nNurseLink v5.6.0-rc.1 cumulative installer\n'
printf 'Phase 1/2: v5.6.0 application-operations payload on the validated cumulative baseline\n'
bash "$SCRIPT_DIR/install_v552_base.sh"
printf '\nPhase 2/2: v5.5.9 reconstruction recovery layer\n'
bash "$SCRIPT_DIR/RECOVERY_OVERLAY_v559.sh"
printf '\nNurseLink v5.6.0-rc.1 cumulative installation complete.\n'
printf 'IMPORTANT: run the v5.6 post-deployment verifier and staging UAT before production promotion.\n'
