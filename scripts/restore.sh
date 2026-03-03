#!/bin/sh
# ---------------------------------------------------------------------------
# DuzAPI Restore Script
# Usage:
#   ./scripts/restore.sh postgres  <backup_file.sql.gz>
#   ./scripts/restore.sh mongodb   <backup_file.archive.gz>
# ---------------------------------------------------------------------------

set -e

TYPE="${1}"
FILE="${2}"

if [ -z "${TYPE}" ] || [ -z "${FILE}" ]; then
  echo "Usage: $0 <postgres|mongodb> <backup_file>"
  exit 1
fi

if [ ! -f "${FILE}" ]; then
  echo "Error: backup file not found: ${FILE}"
  exit 1
fi

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

case "${TYPE}" in
  postgres)
    echo "[restore] Restoring PostgreSQL from ${FILE} ..."
    gunzip -c "${FILE}" | psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" "${PG_DB}"
    echo "[restore] PostgreSQL restore complete"
    ;;

  mongodb)
    echo "[restore] Restoring MongoDB from ${FILE} ..."
    mongorestore \
      --host "${MONGO_HOST}:${MONGO_PORT}" \
      --username "${MONGO_USER}" \
      --password "${MONGO_PASSWORD}" \
      --authenticationDatabase admin \
      --db "${MONGO_DB}" \
      --archive="${FILE}" \
      --gzip \
      --drop
    echo "[restore] MongoDB restore complete"
    ;;

  *)
    echo "Unknown type: ${TYPE}. Use 'postgres' or 'mongodb'."
    exit 1
    ;;
esac
