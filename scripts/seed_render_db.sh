#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Seed the Render PostgreSQL database with the local dump.
#
# Usage:
#   1. Export the local DB:
#      PGPASSWORD="your_local_password" pg_dump -h localhost -U postgres -d swipe_x \
#        --no-owner --no-privileges --clean --if-exists -f scripts/swipe_x_full_dump.sql
#
#   2. Import into Render (use the External Database URL from Render dashboard):
#      PGPASSWORD="render_password" psql -h render_host -p 5432 \
#        -U render_user -d render_db -f scripts/swipe_x_full_dump.sql
#
#   Or use the full connection string from Render:
#      psql "postgres://user:password@host:port/dbname" -f scripts/swipe_x_full_dump.sql
# ─────────────────────────────────────────────────────────────

# On Windows (PowerShell) equivalent:
# $env:PGPASSWORD="revanth@1030"
# & "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h localhost -p 5432 -U postgres -d swipe_x --no-owner --no-privileges --clean --if-exists -f scripts/swipe_x_full_dump.sql
#
# Then import to Render:
# & "C:\Program Files\PostgreSQL\18\bin\psql.exe" "<RENDER_EXTERNAL_DATABASE_URL>" -f scripts/swipe_x_full_dump.sql

echo "=== SWIPE X Database Seeding ==="
echo ""
echo "Step 1: Make sure scripts/swipe_x_full_dump.sql exists"
echo "Step 2: Get the External Database URL from Render dashboard"
echo "Step 3: Run: psql \"\$RENDER_DB_URL\" -f scripts/swipe_x_full_dump.sql"
echo ""

if [ -z "$1" ]; then
  echo "Usage: ./scripts/seed_render_db.sh <RENDER_EXTERNAL_DATABASE_URL>"
  exit 1
fi

RENDER_DB_URL="$1"
DUMP_FILE="scripts/swipe_x_full_dump.sql"

if [ ! -f "$DUMP_FILE" ]; then
  echo "ERROR: $DUMP_FILE not found. Export your local DB first."
  exit 1
fi

echo "Importing $DUMP_FILE into Render PostgreSQL..."
psql "$RENDER_DB_URL" -f "$DUMP_FILE"
echo "Done!"
