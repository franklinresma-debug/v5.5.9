#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
printf '\nNurseLink v5.5.9 RECREATED cumulative installer\n'
printf 'Phase 1/2: validated v5.5.2 cumulative baseline\n'
bash "$SCRIPT_DIR/install_v552_base.sh"
printf '\nPhase 2/2: v5.5.9 reconstruction recovery layer\n'
bash "$SCRIPT_DIR/RECOVERY_OVERLAY_v559.sh"
printf '\nNurseLink v5.5.9 RECREATED cumulative installation complete.\n'
printf 'IMPORTANT: run the live membership-cycle test before adopting this as the canonical production baseline.\n'
