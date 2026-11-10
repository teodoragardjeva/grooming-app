#!/bin/sh
# Applies db/migrations/*.sql in name order, once each (tracked in public.schema_migrations).
# Optionally loads db/seed.sql (EXAMPLE data) into an empty database when SEED_EXAMPLE_DATA=1.
# Connection comes from the standard PG* environment variables.
set -eu

PSQL="psql -v ON_ERROR_STOP=1 -q"

$PSQL -c "create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())"

for f in /db/migrations/*.sql; do
  name=$(basename "$f")
  applied=$($PSQL -tA -c "select 1 from public.schema_migrations where name = '$name'")
  if [ -z "$applied" ]; then
    echo "applying $name"
    $PSQL --single-transaction -f "$f" -c "insert into public.schema_migrations (name) values ('$name')"
  fi
done

if [ "${SEED_EXAMPLE_DATA:-0}" = "1" ]; then
  seeded=$($PSQL -tA -c "select 1 from public.business_settings limit 1")
  if [ -z "$seeded" ]; then
    echo "loading example seed data"
    $PSQL --single-transaction -f /db/seed.sql
  fi
fi

echo "database is up to date"
