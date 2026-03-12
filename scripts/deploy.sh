#!/usr/bin/env bash
# =============================================================================
# DuzAPI — VPS Deploy Script
# Usage:  ./deploy.sh [--all | --service backend,admin_panel | --only-nginx]
# Place at: /opt/duzapi/scripts/deploy.sh
# =============================================================================
set -euo pipefail

DEPLOY_DIR="/opt/duzapi"
COMPOSE_DIR="$DEPLOY_DIR/whatsapp_automation"
COMPOSE="docker compose"
LOG_FILE="$DEPLOY_DIR/deploy.log"
BRANCH="${DEPLOY_BRANCH:-main}"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"; }
ok()   { echo -e "${GREEN}[✓]${NC} $*" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[!]${NC} $*" | tee -a "$LOG_FILE"; }
err()  { echo -e "${RED}[✗]${NC} $*" | tee -a "$LOG_FILE"; }

# --------------------------------------------------------------------------
# Parse args
# --------------------------------------------------------------------------
FORCE_ALL=false
ONLY_NGINX=false
ONLY_SERVICES=""
SKIP_PULL=false
RUN_MIGRATIONS=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)           FORCE_ALL=true; shift ;;
    --only-nginx)    ONLY_NGINX=true; shift ;;
    --service)       ONLY_SERVICES="$2"; shift 2 ;;
    --skip-pull)     SKIP_PULL=true; shift ;;
    --migrate)       RUN_MIGRATIONS=true; shift ;;
    -h|--help)
      echo "Usage: deploy.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --all          Rebuild all services (default: only changed)"
      echo "  --service X    Rebuild specific services (comma-separated)"
      echo "                 Valid: backend, admin_panel, bridge"
      echo "  --only-nginx   Only reload nginx config"
      echo "  --skip-pull    Skip git pull (use current code)"
      echo "  --migrate      Run Alembic migrations after deploy"
      echo "  -h, --help     Show this help"
      exit 0
      ;;
    *) err "Unknown option: $1"; exit 1 ;;
  esac
done

# --------------------------------------------------------------------------
# Pre-flight checks
# --------------------------------------------------------------------------
log "Starting deploy..."
cd "$DEPLOY_DIR"

if ! command -v docker &>/dev/null; then
  err "Docker not found"; exit 1
fi

# --------------------------------------------------------------------------
# Git pull
# --------------------------------------------------------------------------
if [[ "$SKIP_PULL" == false ]]; then
  log "Pulling latest code from $BRANCH..."
  git fetch origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"

  # Detect changed paths BEFORE merging
  CHANGED_FILES=$(git diff --name-only "HEAD..origin/$BRANCH" 2>/dev/null || echo "")

  git merge "origin/$BRANCH" --ff-only 2>&1 | tee -a "$LOG_FILE" || {
    err "Fast-forward merge failed. Manual intervention needed."
    exit 1
  }
  ok "Code updated"
else
  CHANGED_FILES=""
  warn "Skipping git pull (--skip-pull)"
fi

# --------------------------------------------------------------------------
# Nginx-only mode
# --------------------------------------------------------------------------
if [[ "$ONLY_NGINX" == true ]]; then
  log "Reloading nginx config..."
  cd "$COMPOSE_DIR"
  docker exec wa_nginx nginx -t 2>&1 | tee -a "$LOG_FILE" || { err "Nginx config invalid"; exit 1; }
  docker exec wa_nginx nginx -s reload 2>&1 | tee -a "$LOG_FILE"
  ok "Nginx reloaded"
  exit 0
fi

# --------------------------------------------------------------------------
# Determine which services to rebuild
# --------------------------------------------------------------------------
SERVICES_TO_BUILD=()

if [[ -n "$ONLY_SERVICES" ]]; then
  # Explicit service list
  IFS=',' read -ra REQUESTED <<< "$ONLY_SERVICES"
  for svc in "${REQUESTED[@]}"; do
    case "$svc" in
      backend)      SERVICES_TO_BUILD+=(backend celery_worker celery_beat) ;;
      admin_panel)  SERVICES_TO_BUILD+=(admin_panel) ;;
      bridge)       SERVICES_TO_BUILD+=(whatsapp_bridge) ;;
      *) warn "Unknown service: $svc" ;;
    esac
  done
elif [[ "$FORCE_ALL" == true ]]; then
  SERVICES_TO_BUILD=(backend celery_worker celery_beat whatsapp_bridge admin_panel)
else
  # Auto-detect from changed files
  if echo "$CHANGED_FILES" | grep -qE '^whatsapp_automation/(app/|main\.py|requirements\.txt|Dockerfile|alembic)'; then
    SERVICES_TO_BUILD+=(backend celery_worker celery_beat)
    log "Detected backend changes"
  fi

  if echo "$CHANGED_FILES" | grep -qE '^whatsapp_automation/whatsapp_bridge/'; then
    SERVICES_TO_BUILD+=(whatsapp_bridge)
    log "Detected bridge changes"
  fi

  if echo "$CHANGED_FILES" | grep -qE '^whatsapp_admin_panel/'; then
    SERVICES_TO_BUILD+=(admin_panel)
    log "Detected admin panel changes"
  fi

  # Auto-detect migrations
  if echo "$CHANGED_FILES" | grep -qE '^whatsapp_automation/alembic/versions/'; then
    RUN_MIGRATIONS=true
    log "Detected new migrations"
  fi
fi

# Nginx config change — always reload
NGINX_CHANGED=false
if echo "$CHANGED_FILES" | grep -qE '^whatsapp_automation/nginx/'; then
  NGINX_CHANGED=true
  log "Detected nginx config changes"
fi

# --------------------------------------------------------------------------
# Build & restart
# --------------------------------------------------------------------------
cd "$COMPOSE_DIR"

if [[ ${#SERVICES_TO_BUILD[@]} -eq 0 && "$NGINX_CHANGED" == false && "$RUN_MIGRATIONS" == false ]]; then
  ok "No changes detected — nothing to deploy"
  exit 0
fi

if [[ ${#SERVICES_TO_BUILD[@]} -gt 0 ]]; then
  log "Building: ${SERVICES_TO_BUILD[*]}"
  $COMPOSE build "${SERVICES_TO_BUILD[@]}" 2>&1 | tee -a "$LOG_FILE"
  ok "Build complete"

  log "Restarting: ${SERVICES_TO_BUILD[*]}"
  $COMPOSE up -d "${SERVICES_TO_BUILD[@]}" 2>&1 | tee -a "$LOG_FILE"
  ok "Services restarted"
fi

# --------------------------------------------------------------------------
# Migrations
# --------------------------------------------------------------------------
if [[ "$RUN_MIGRATIONS" == true ]]; then
  log "Running Alembic migrations..."
  docker exec wa_backend python -m alembic upgrade head 2>&1 | tee -a "$LOG_FILE" || {
    err "Migration failed!"
    exit 1
  }
  ok "Migrations applied"
fi

# --------------------------------------------------------------------------
# Nginx reload
# --------------------------------------------------------------------------
if [[ "$NGINX_CHANGED" == true ]]; then
  log "Reloading nginx..."
  docker exec wa_nginx nginx -t 2>&1 | tee -a "$LOG_FILE" || { err "Nginx config invalid"; exit 1; }
  docker exec wa_nginx nginx -s reload 2>&1 | tee -a "$LOG_FILE"
  ok "Nginx reloaded"
fi

# --------------------------------------------------------------------------
# Health checks
# --------------------------------------------------------------------------
log "Waiting for services to stabilize..."
sleep 10

HEALTHY=true

# Backend
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
  ok "Backend healthy"
else
  # Try via docker
  if docker exec wa_backend curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    ok "Backend healthy (via container)"
  else
    err "Backend health check FAILED"
    HEALTHY=false
  fi
fi

# Bridge
if docker exec wa_whatsapp_bridge node -e "require('http').get('http://localhost:3000/api/health', r => { process.exit(r.statusCode===200?0:1) }).on('error', () => process.exit(1))" 2>/dev/null; then
  ok "Bridge healthy"
else
  warn "Bridge health check failed (may still be starting)"
fi

# Admin panel
if docker exec wa_nginx wget -qO- --timeout=5 http://wa_admin_panel:3001/ > /dev/null 2>&1; then
  ok "Admin panel healthy"
else
  warn "Admin panel health check failed (may still be starting)"
fi

# --------------------------------------------------------------------------
# Summary
# --------------------------------------------------------------------------
echo ""
log "===== Deploy Summary ====="
if [[ ${#SERVICES_TO_BUILD[@]} -gt 0 ]]; then
  log "Rebuilt: ${SERVICES_TO_BUILD[*]}"
fi
[[ "$RUN_MIGRATIONS" == true ]] && log "Migrations: applied"
[[ "$NGINX_CHANGED" == true ]] && log "Nginx: reloaded"

# Disk usage
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5 " used (" $3 "/" $2 ")"}')
MEM_USAGE=$(free -h | awk 'NR==2 {print $3 "/" $2}')
log "Disk: $DISK_USAGE | Memory: $MEM_USAGE"

if [[ "$HEALTHY" == true ]]; then
  ok "Deploy completed successfully!"
else
  err "Deploy completed with warnings — check logs"
fi

echo ""
log "Full log: $LOG_FILE"
