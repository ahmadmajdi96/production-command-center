import { PlannerBanner } from "@/components/aps/planner-persona";
import { needsQueryStatus, QueryStatus } from "@/components/aps/kit";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Chip,
  Panel,
  PageHead,
  Stat,
  Empty,
  feasLabel,
  feasTone,
  fmt,
  mins,
  sevTone,
  statusTone,
} from "@/components/aps/kit";
import { usePreview, usePlanStatus, useVersions } from "@/lib/aps/client";

export const Route = createFileRoute("/_authenticated/aps/")({
  head: () => ({
    meta: [
      { title: "Planning Overview · APS" },
      {
        name: "description",
        content: "Plan health, feasibility, conflicts and capacity at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const preview = usePreview();
  const plan = preview.data;
  const versionsQuery = useVersions("dashboard");
  const { data: versions } = versionsQuery;
  const statusQuery = usePlanStatus();
  const { data: planStatus } = statusQuery;
  const approved = versions?.find((v) => v.status === "approved");
  const pending = versions?.filter((v) => v.status === "pending_approval") ?? [];
  const queries = [preview, versionsQuery, statusQuery];
  if (!plan || needsQueryStatus(queries))
    return <QueryStatus queries={queries} subject="the planning overview" />;
  const f = (s: string) => plan.feasibility.filter((x) => x.status === s).length;
  return (
    <>
      <PageHead
        icon={<LayoutDashboard className="h-6 w-6 text-primary" />}
        title="Planning Overview"
        desc="Live view calculated from current orders, materials, machines, workforce and rules."
      />
      <PlannerBanner />
      {planStatus?.approved && planStatus.reasons.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <div className="font-medium">
            Approved plan v{planStatus.approved.version_no} is out of date — reschedule and
            re-approve.
          </div>
          <ul className="mt-1 list-disc pl-4">
            {planStatus.reasons.slice(0, 6).map((r, i) => (
              <li key={i}>{r.message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="Feasible" value={f("feasible")} tone="success" hint="orders" />
        <Stat label="Conditional" value={f("conditional")} tone="warning" hint="orders" />
        <Stat label="Not feasible" value={f("not_feasible")} tone="destructive" hint="orders" />
        <Stat
          label="Conflicts"
          value={plan.conflicts.length}
          tone={plan.conflicts.some((c) => c.severity === "high") ? "destructive" : "warning"}
          hint={`${plan.conflicts.filter((c) => c.severity === "high").length} high`}
        />
        <Stat
          label="Changeover"
          value={mins(plan.metrics.total_changeover_min)}
          tone="info"
          hint="in draft plan"
        />
        <Stat
          label="On time"
          value={`${plan.metrics.on_time}/${plan.metrics.orders_scheduled}`}
          tone="primary"
          hint={`avg utilization ${plan.metrics.avg_utilization}%`}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Machine load (draft, 7-day horizon)" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart
                data={plan.capacity.map((c) => ({
                  name: c.machine,
                  Used: Math.round(c.used_min / 60),
                  Remaining: Math.round(c.remaining_min / 60),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} unit="h" />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="Used" stackId="a" fill="var(--chart-1)" />
                <Bar dataKey="Remaining" stackId="a" fill="var(--muted)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Schedule status">
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Approved version</span>
              {approved ? (
                <Chip tone="success">v{approved.version_no}</Chip>
              ) : (
                <Chip tone="muted">none</Chip>
              )}
            </div>
            {approved && (
              <div className="text-[11px] text-muted-foreground">
                Approved plan from {fmt(approved.created_at)} by {approved.created_by}
              </div>
            )}
            {planStatus?.approved && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sent to MES</span>
                <Chip
                  tone={
                    planStatus.approved.dispatch_status === "acknowledged" ? "success" : "warning"
                  }
                >
                  {planStatus.approved.dispatch_status === "acknowledged"
                    ? `confirmed ${fmt(planStatus.approved.acknowledged_at)}`
                    : "awaiting MES confirmation"}
                </Chip>
              </div>
            )}
            {planStatus?.approved && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plan still valid</span>
                <Chip tone={planStatus.reasons.length ? "destructive" : "success"}>
                  {planStatus.reasons.length ? `${planStatus.reasons.length} change(s)` : "yes"}
                </Chip>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Awaiting approval</span>
              <Chip tone={pending.length ? "warning" : "muted"}>{pending.length}</Chip>
            </div>
            <div className="border-t border-border/40 pt-3">
              <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Recent versions
              </div>
              {(versions ?? []).slice(0, 5).map((v) => (
                <div key={v.id} className="flex items-center justify-between py-1">
                  <span>
                    v{v.version_no} · {v.kind}
                  </span>
                  <Chip tone={statusTone[v.status]}>{v.status.replace("_", " ")}</Chip>
                </div>
              ))}
              {!versions?.length && (
                <p className="text-muted-foreground">
                  No versions yet —{" "}
                  <Link to="/aps/schedule" className="text-primary">
                    generate one
                  </Link>
                  .
                </p>
              )}
            </div>
          </div>
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Order feasibility"
          action={
            <Link to="/aps/orders" className="text-[11px] text-primary">
              Details →
            </Link>
          }
        >
          <div className="space-y-1.5">
            {plan.feasibility.map((x) => (
              <div
                key={x.orderId}
                className="flex items-center justify-between rounded-lg border border-border/40 px-2 py-1.5 text-xs"
              >
                <span className="font-mono">{x.po}</span>
                <span className="truncate px-2 text-[11px] text-muted-foreground">
                  {x.issues.find((i) => i.severity !== "info")?.message ?? "All checks passed"}
                </span>
                <Chip tone={feasTone[x.status]}>{feasLabel[x.status]}</Chip>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Top conflicts"
          action={
            <Link to="/aps/conflicts" className="text-[11px] text-primary">
              All →
            </Link>
          }
        >
          <div className="space-y-1.5">
            {plan.conflicts.slice(0, 8).map((c) => (
              <div key={c.id} className="rounded-lg border border-border/40 px-2 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <Chip tone={sevTone[c.severity]}>{c.type.replace("_", " ")}</Chip>
                  <span className="font-mono text-[11px]">{c.orders.join(", ")}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{fmt(c.at)}</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {c.reason} — <span className="text-foreground">{c.impact}</span>
                </div>
              </div>
            ))}
            {!plan.conflicts.length && <Empty>No conflicts detected.</Empty>}
          </div>
        </Panel>
      </div>
    </>
  );
}
