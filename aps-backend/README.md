# APS database

The APS planning store belongs in a dedicated Supabase database. MES remains the source of truth for production orders and workforce records. The application reads APS planning projections and publishes approved schedules through the APS backend.

The Drizzle files in this folder reproduce the source repository at `aac9ae5c8caf8dc0f8fef7de57e0ea327acf18d5`. Its journal and snapshots are preserved. This folder is separate from the MES and Lovable migration paths.

## Prepare an isolated database

Use a fresh disposable APS database for rehearsal. It needs the Supabase database roles `anon`, `authenticated`, and `service_role`, an `extensions` schema, and permission to install `pgcrypto` there. In the supported hosted arrangement, the APS server uses `service_role` with row-level security bypass after it verifies the operator's MES session and checks the APS permission in the Command Access Hub. Browser sessions use the MES sign-in.

Set `APS_DATABASE_URL` to the isolated APS migration connection when running Drizzle from this directory. The APS application connection is server-side via `APS_SUPABASE_URL` and `APS_SUPABASE_SERVICE_ROLE_KEY`.

Apply the original migrations once, following the recorded migration history.

1. `drizzle/migrations/0000_migration.sql` creates APS tables and includes a demonstration plant and six sample orders.
2. `drizzle/migrations/0001_migration.sql` adds unique operators and shift names and maintenance external IDs.
3. `drizzle/migrations/0002_mes_alignment.sql` adds integration events and feedback, schedule handoff state, quality and revision fields, configuration, and the audit chain.

Use the demo data only in an isolated database. An existing APS database should follow its recorded migration history. A fresh production APS database needs a reviewed bootstrap that omits the demo inserts. Never run these files against MES. APS has its own `products`, `machines` and `production_orders` relation definitions.

## Combined application permissions

After the original history is applied, run `post-migrations/0003_service_access.sql` on the dedicated APS database. It lets the combined application's verified server call `verify_audit_chain()` and removes the runtime service role's ability to truncate the audit log. The original browser verifier remains usable during a staged transition.

Once the legacy APS browser client is retired, run `post-migrations/0004_retire_direct_reads.sql` on that database. The combined application uses authenticated MES sessions and verified APS grants through its server. This step removes the original APS browser reads and its direct verifier permission. Keep this script out of the MES migration workflow.

Apply `post-migrations/0005_schedule_transactions.sql` before deploying the updated app. It adds the service-only schedule commands and unique version numbers. The constraint stops installation if there are duplicate historical numbers. Reconcile them against MES references and audit evidence before retrying. Retire legacy writers before switching to the commands.

## Local verification

Run `bash aps-backend/check-local.sh` from the workspace with PostgreSQL's `initdb`, `pg_ctl` and `psql` on `PATH`. The script creates a fresh Unix-socket-only cluster and an `aps_test_migrations` database. It removes that isolated cluster on exit.

PostgreSQL 18.6 passed all three source migrations with 16 row-level security tables. The checks cover anonymous and authenticated schedule permissions, the isolated demo inputs, a schedule version with an approval row, rejection of duplicate event idempotency keys, audit update and delete rejection, and verification of a two-row hash chain. The test then applies the two permission scripts and confirms that direct browser reads are retired, the APS service can read plan data and verify the chain, and the service role cannot truncate audit history. The rehearsal uses synthetic records and fixture roles. Hosted Supabase configuration, MES identity and the real Command Access Hub remain deployment acceptance checks.

## Source behavior to verify before launch

- Keep the APS database session timezone consistent across audit writes and verification. The original hash serializes a timestamp as text. The isolated test verified a chain written in UTC from a UTC session, and a session switched to Asia/Amman reported a mismatch at the first row.
- The local test runs competing draft creation and approval commands and injects an audit write failure. Verify the same workflow on the dedicated staging database with real MES and Hub test accounts before promoting.

## Cutover and rollback

Record the current APS database backup and migration history before switching the combined application to it. Retain the legacy application and connection configuration until sign-in, permissions, plan generation, approval, and MES approved-plan delivery pass with disposable accounts. Keep the old and new writers on separate isolated stores during rehearsal.

Roll back the application connection and deployment together. Retain the newly used APS database for reconciliation if any schedule was approved or sent to MES after cutover. Source migrations are forward-only. Before a deliberate return to a legacy browser client, restore its recorded APS grants if the direct-read retirement script ran. Recover a dedicated database from its verified backup if a schema rollout must be reverted.
