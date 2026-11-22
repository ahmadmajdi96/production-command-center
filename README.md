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

The production build, TypeScript check, and 32 tests passed. A local PostgreSQL and PostgREST stack verified the APS migrations, private data access and audit protections. A Chromium acceptance run covered every advanced planning page, permission-aware search and mobile navigation, the shared sign-in boundary, and the path from schedule generation through submitted version, password re-verification, approved-plan retrieval, MES acknowledgement, and replay. The database recorded one acknowledged version, one signature, and four valid audit entries. MES sign-in and Command Access Hub responses used isolated fixtures.

Repository-wide lint reports inherited formatting and typing issues in both source applications. The copied visual system, engine, event contract, and original APS migrations match the pinned sources.

Hosted rollout still requires verified MES accounts and Command Access Hub grants, the separate APS data connection, and partner acceptance. APS denies access when the Hub cannot validate the account. Test concurrent version creation and approval failure recovery before taking production planning traffic. The dedicated [database notes](aps-backend/README.md) describe the source constraints, migration order, and isolation checks.
