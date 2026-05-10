#!/bin/bash
set -euo pipefail

# ═══════════════════════════════════════════
# Stationery ERP - Database Restore
# Usage: ./scripts/restore.sh path/to/erp-db-YYYY-MM-DD_HHMMSS.sql.gz
# ═══════════════════════════════════════════

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path-to-backup.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: file not found: $BACKUP_FILE"
  exit 1
fi

# Load env
ENV_FILE="$(dirname "$0")/../.env"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Error: SUPABASE_DB_URL not set in .env"
  echo "Add: SUPABASE_DB_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql not installed. Install with: brew install libpq && brew link --force libpq"
  exit 1
fi

# Extract host (strips credentials so we can show it safely)
DB_HOST=$(echo "$SUPABASE_DB_URL" | sed -E 's|postgresql://[^@]+@([^:/]+).*|\1|')

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
MTIME=$(date -r "$BACKUP_FILE" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "unknown")

echo ""
echo "═══════════════════════════════════════"
echo "  RESTORE DATABASE"
echo "═══════════════════════════════════════"
echo "  Backup file:   $BACKUP_FILE"
echo "  File size:     $SIZE"
echo "  Backup taken:  $MTIME"
echo "  Target host:   $DB_HOST"
echo "═══════════════════════════════════════"
echo ""
echo "⚠  This pipes the dump's SQL straight into the target database."
echo "   If tables already exist, psql will stop on the first conflict."
echo "   For a clean restore, run against an empty Supabase project,"
echo "   or drop the public schema first (DROP SCHEMA public CASCADE;"
echo "   CREATE SCHEMA public;) — note this also wipes Supabase's own"
echo "   objects in public, so prefer a fresh project for full DR."
echo ""
read -p "Type the host name to confirm ($DB_HOST): " CONFIRM

if [ "$CONFIRM" != "$DB_HOST" ]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo "Restoring..."
gunzip -c "$BACKUP_FILE" | psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1

echo ""
echo "═══════════════════════════════════════"
echo "Restore complete."
echo "═══════════════════════════════════════"
