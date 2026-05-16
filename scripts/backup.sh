#!/bin/bash

# ═══════════════════════════════════════════
# Stationery ERP - Local Backup Script
# Run monthly: ./scripts/backup.sh
# ═══════════════════════════════════════════

# Load env variables
ENV_FILE="$(dirname "$0")/../.env"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

SUPABASE_URL="${VITE_SUPABASE_URL}"
SUPABASE_KEY="${VITE_SUPABASE_SERVICE_KEY:-$VITE_SUPABASE_ANON_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "Error: Missing SUPABASE_URL or keys in .env"
  echo "Add VITE_SUPABASE_SERVICE_KEY for full backup (bypasses RLS)"
  exit 1
fi

if [ -z "$VITE_SUPABASE_SERVICE_KEY" ]; then
  echo "⚠  Warning: Using anon key. Some tables may return 0 rows due to RLS."
  echo "   Add VITE_SUPABASE_SERVICE_KEY to .env for complete backup."
  echo ""
fi

# Create backup directory
DATE=$(date +%Y-%m-%d_%H%M)
BACKUP_DIR="$(dirname "$0")/../backups/$DATE"
mkdir -p "$BACKUP_DIR"

echo "Starting backup to $BACKUP_DIR..."

# Tables to backup. Grouped by domain for readability — order doesn't matter
# for export but is roughly the dependency order so manual review is easier.
TABLES=(
  # Identity & settings
  "profiles"
  "user_permissions"
  "store_settings"

  # Catalog
  "categories"
  "products"

  # Counterparties
  "suppliers"
  "customers"
  "customer_payments"

  # Sales
  "sales"
  "sale_items"
  "sale_payments"

  # Sales returns
  "sales_returns"
  "sales_return_items"

  # Procurement
  "purchase_orders"
  "purchase_order_items"
  "po_payments"

  # Purchase returns
  "purchase_returns"
  "purchase_return_items"

  # Operations
  "expenses"
  "expense_categories"
  "employees"
  "stock_adjustments"
)

# Export each table as JSON
for TABLE in "${TABLES[@]}"; do
  echo "  Exporting $TABLE..."
  curl -s \
    "${SUPABASE_URL}/rest/v1/${TABLE}?select=*" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Accept: text/csv" \
    > "$BACKUP_DIR/${TABLE}.csv"

  # Check if export was successful
  if [ $? -eq 0 ] && [ -s "$BACKUP_DIR/${TABLE}.csv" ]; then
    COUNT=$(tail -n +2 "$BACKUP_DIR/${TABLE}.csv" | wc -l | tr -d ' ')
    echo "    ✓ $TABLE ($COUNT rows)"
  else
    echo "    ✗ $TABLE (failed or empty)"
  fi
done

# Create a compressed archive
echo ""
echo "Compressing..."
BACKUPS_ROOT="$(cd "$(dirname "$0")/../backups" && pwd)"
cd "$BACKUPS_ROOT"
tar -czf "${DATE}.tar.gz" "$DATE"
rm -rf "$DATE"

SIZE=$(du -h "${BACKUPS_ROOT}/${DATE}.tar.gz" | cut -f1)

echo ""
echo "═══════════════════════════════════════"
echo "Backup complete!"
echo "File: backups/${DATE}.tar.gz ($SIZE)"
echo "═══════════════════════════════════════"
