#!/usr/bin/env bash
# =============================================================================
# DuzAPI — Local Deploy Trigger
# Run from your local machine to push code and deploy to VPS.
# Usage:  ./scripts/deploy-local.sh [--all | --service backend | --only-nginx]
# =============================================================================
set -euo pipefail

VPS_HOST="root@185.173.110.162"
VPS_DIR="/opt/duzapi"
BRANCH="main"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $*"; }
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; }

# --------------------------------------------------------------------------
# Step 1: Check local git status
# --------------------------------------------------------------------------
log "Checking local git status..."

UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l)
if [[ "$UNCOMMITTED" -gt 0 ]]; then
  echo ""
  git status --short
  echo ""
  err "You have uncommitted changes. Commit or stash before deploying."
  exit 1
fi

# --------------------------------------------------------------------------
# Step 2: Push to remote
# --------------------------------------------------------------------------
log "Pushing to origin/$BRANCH..."
git push origin "$BRANCH" 2>&1 || { err "Git push failed"; exit 1; }
ok "Code pushed"

# --------------------------------------------------------------------------
# Step 3: SSH and deploy
# --------------------------------------------------------------------------
log "Connecting to VPS and deploying..."
echo ""

# Forward all remaining args to the VPS deploy script
ssh -t "$VPS_HOST" "bash $VPS_DIR/scripts/deploy.sh $*"

echo ""
ok "Deploy pipeline complete!"
