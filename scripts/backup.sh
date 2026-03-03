#!/bin/sh
# ---------------------------------------------------------------------------
# DuzAPI Backup Script
# Backs up PostgreSQL and MongoDB to /backups/ and retains the last 7 backups.
# Designed to run inside or alongside the Docker Compose stack.
# ---------------------------------------------------------------------------

set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETAIN_DAYS=7
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Postgres
PG_HOST="${PG_HOST:-postgres}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${POSTGRES_USER:-whatsapp}"
PG_DB="${POSTGRES_DB:-whatsapp_automation}"
PGPASSWORD="${POSTGRES_PASSWORD}"
export PGPASSWORD

# MongoDB
MONGO_HOST="${MONGO_HOST:-mongodb}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGO_USER="${MONGO_USER:-whatsapp}"
MONGO_DB="${MONGO_DB:-whatsapp_logs}"

echo "[backup] Starting backup at ${TIMESTAMP}"

mkdir -p "${BACKUP_DIR}/postgres" "${BACKUP_DIR}/mongodb"

# ---------------------------------------------------------------------------
# PostgreSQL dump
# ---------------------------------------------------------------------------
PG_FILE="${BACKUP_DIR}/postgres/pg_${TIMESTAMP}.sql.gz"
echo "[backup] Dumping PostgreSQL → ${PG_FILE}"
pg_dump -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" "${PG_DB}" | gzip > "${PG_FILE}"
echo "[backup] PostgreSQL dump complete"

# ---------------------------------------------------------------------------
# MongoDB dump
# ---------------------------------------------------------------------------
MONGO_FILE="${BACKUP_DIR}/mongodb/mongo_${TIMESTAMP}.archive.gz"
echo "[backup] Dumping MongoDB → ${MONGO_FILE}"
mongodump \
  --host "${MONGO_HOST}:${MONGO_PORT}" \
  --username "${MONGO_USER}" \
  --password "${MONGO_PASSWORD}" \
  --authenticationDatabase admin \
  --db "${MONGO_DB}" \
  --archive="${MONGO_FILE}" \
  --gzip
echo "[backup] MongoDB dump complete"

# ---------------------------------------------------------------------------
# Cleanup — remove backups older than RETAIN_DAYS days
# ---------------------------------------------------------------------------
echo "[backup] Removing backups older than ${RETAIN_DAYS} days"
find "${BACKUP_DIR}/postgres" -name "*.sql.gz"      -mtime +${RETAIN_DAYS} -delete
find "${BACKUP_DIR}/mongodb"  -name "*.archive.gz"  -mtime +${RETAIN_DAYS} -delete

echo "[backup] Backup finished at $(date)"
