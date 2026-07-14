#!/usr/bin/env bash
# Safe local/test PostgreSQL backup for Nelna FG.
set -euo pipefail

OUT_DIR="${1:-}"
DB_URL="${DATABASE_URL:-}"

if [[ -z "$OUT_DIR" ]]; then
  echo "Usage: $0 <output-dir>" >&2
  exit 1
fi
if [[ -z "$DB_URL" ]]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi
if ! command -v pg_dump >/dev/null; then
  echo "pg_dump not found on PATH" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
BASE="${OUT_DIR%/}/nelna_fg_${STAMP}"
DUMP="${BASE}.dump"
HASH="${BASE}.sha256"
COUNTS="${BASE}.counts.txt"
LEAF="nelna_fg_${STAMP}.dump"

echo "Writing dump to ${DUMP}"
pg_dump -Fc --no-owner --no-acl -f "$DUMP" "$DB_URL"

if command -v sha256sum >/dev/null; then
  HASH_VAL="$(sha256sum "$DUMP" | awk '{print $1}')"
elif command -v shasum >/dev/null; then
  HASH_VAL="$(shasum -a 256 "$DUMP" | awk '{print $1}')"
else
  echo "No sha256 tool found" >&2
  exit 1
fi
echo "${HASH_VAL}  ${LEAF}" >"$HASH"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if command -v psql >/dev/null && [[ -f "$ROOT/scripts/db/reconcile_counts.sql" ]]; then
  psql "$DB_URL" -f "$ROOT/scripts/db/reconcile_counts.sql" -o "$COUNTS" || echo "Warning: count capture failed"
fi

echo "Backup complete: ${DUMP}"
echo "Checksum: ${HASH}"
