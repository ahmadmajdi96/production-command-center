# Cortanex APS

Cortanex APS combines the Planning and Workforce workspace from Production Command Center with the advanced planning engine and planning tools from APS Production Command Center. It keeps the production workspace's layout, theme, navigation groups and shared components. A single sign-in opens the pages granted by MES and the Command Access Hub.

## Run locally

Use Node.js 22.12 or later and Bun. Configure the backends for the environment you intend to use before opening the app.

```sh
bun install --frozen-lockfile
bun run dev
bun run typecheck
bun run test
bun run build
```

The application uses the existing MES identity provider and MES site and line grants for Production and Workforce. APS checks the Command Access Hub for its own resource grants on every server operation. Planners who used the standalone APS identity provider need an account with their approved email on the shared MES sign-in before cutover.

### Configuration

| Setting | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Shared MES browser connection. Use an isolated MES test project for local acceptance. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Shared MES server authentication and approval password re-verification. These must match the browser identity issuer. |
| `MES_SERVICE_ROLE_KEY` | Existing restricted server credential for privileged MES workflows. |
| `APS_SUPABASE_URL`, `APS_SUPABASE_SERVICE_ROLE_KEY` | Separate server-only APS data project and service credential. |
| `ACCESS_HUB_URL`, `ACCESS_HUB_API_KEY` | Server-only connection and key registered for the `aps` system. |
| `APS_INTEGRATION_KEY` | Server-only shared key used by the existing integration routes. |

See [APS database setup](aps-backend/README.md) for isolated migrations and role tests. The production workspace continues to use the existing MES schema. Configure release, rollback and partner acceptance before moving a live workload.

## Features

| Workspace | Available workflows |
| --- | --- |
| Planning | Products and details, recipes, production orders and order details, planner, scheduling and capacity, reports and compliance, inventory |
| Workforce | Users and details, assignments, skills and certifications, skill details, shifts |
| Advanced planning | Planning overview, order feasibility, schedule and Gantt, finite capacity, conflicts, plant resources, planning rules, schedule versions, approvals and electronic signatures, audit trail, integrations, standards and ownership |

The original PMS routes keep their addresses. Advanced planning appears under `/aps`. APS plans, approvals and integration projections stay in the APS data project. The original integration URLs remain `/api/public/integrations/$source` and `/api/public/schedule/approved`. Approved-plan retrieval and MES acknowledgement remain distinct from execution feedback.

### Source snapshots

- Production Command Center design and workspace at `6da6fcd291163fb98bfec6254cb0550cc598fc15`
- APS Production Command Center planning features at `aac9ae5c8caf8dc0f8fef7de57e0ea327acf18d5`

Both snapshots were verified against their Git trees. Environment files are supplied per environment.

## Lovable

The originating design workspace is available in the [Lovable editor](https://lovable.dev/projects/f24aecb3-3122-4000-9a34-14abdc97c259).

## Verification and rollout status

The Node production build, TypeScript check, and 32 tests pass. The PostgreSQL suite verifies migration order, the APS service role boundary, competing draft creation and approvals, and rollback of a signature and release if the audit write fails.

The isolated Chromium acceptance run covers all 12 Advanced Planning pages at desktop and 390 px, keyboard order search and details, dark mode persistence with reduced motion, and permission-aware navigation. It also generates and submits a schedule, verifies the signer against a test MES identity, retrieves the released plan, and sends and replays its MES acknowledgement. The database records one acknowledged version, one signature, and four verified audit entries. MES and Command Access Hub responses come from fixtures.

Repository-wide lint still reports inherited formatting and typing issues. The original APS migrations remain pinned to their source.

Production rollout requires working HTTPS on `aps.manuqube.com`, the dedicated APS store with migration 0005, and verified MES, Command Access Hub, and upstream planning feeds. Run the legacy Planning and Workforce workflows against disposable hosted accounts before using operational data. Keep the earlier application release and database backup available and retain any newly approved schedules for MES reconciliation if a rollback is needed. Follow the [database rollout notes](aps-backend/README.md).
