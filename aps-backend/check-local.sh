#!/usr/bin/env bash
set -euo pipefail

aps_backend=$(cd -- "$(dirname -- "$0")" && pwd)
aps_test_dir=$(mktemp -d /tmp/aps-migrations.XXXXXXXX)
aps_test_database=aps_test_migrations

cleanup() {
  if [[ -s "$aps_test_dir/data/postmaster.pid" ]]; then
    pg_ctl -D "$aps_test_dir/data" -m fast -w stop >/dev/null || return
  fi
  rm -rf -- "$aps_test_dir"
}
trap cleanup EXIT

initdb -D "$aps_test_dir/data" -U aps_test_owner --locale=C --encoding=UTF8 --auth-local=trust --auth-host=reject >/dev/null
pg_ctl -D "$aps_test_dir/data" -l "$aps_test_dir/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$aps_test_dir' -c timezone=UTC" -w start >/dev/null

psql_local() {
  psql -X --no-password --host="$aps_test_dir" --port=5432 --username=aps_test_owner --set=ON_ERROR_STOP=1 "$@"
}

psql_local --quiet --dbname=postgres <<SQL
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE DATABASE $aps_test_database;
SQL

psql_local --quiet --dbname="$aps_test_database" --command='CREATE SCHEMA extensions;'
for migration in 0000_migration 0001_migration 0002_mes_alignment; do
  psql_local --quiet --single-transaction --dbname="$aps_test_database" \
    --file="$aps_backend/drizzle/migrations/$migration.sql"
  printf 'Applied %s\n' "$migration"
done

psql_local --quiet --dbname="$aps_test_database" --file="$aps_backend/check-source.sql"

for migration in 0003_service_access 0004_retire_direct_reads; do
  psql_local --quiet --single-transaction --dbname="$aps_test_database" \
    --file="$aps_backend/post-migrations/$migration.sql"
  printf 'Applied %s\n' "$migration"
done

psql_local --quiet --dbname="$aps_test_database" --file="$aps_backend/check-service-only.sql"
