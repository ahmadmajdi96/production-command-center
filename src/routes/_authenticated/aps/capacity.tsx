import { needsQueryStatus, QueryStatus } from "@/components/aps/kit";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { createFileRoute } from "@tanstack/react-router";
import { Gauge } from "lucide-react";
import { Chip, Panel, PageHead, Empty, mins, td, th } from "@/components/aps/kit";
import { usePreview } from "@/lib/aps/client";
import { HORIZON_DAYS } from "@/lib/aps/engine";

export const Route = createFileRoute("/_authenticated/aps/capacity")({
  head: () => ({
    meta: [
      { title: "Capacity · APS" },
      {
        name: "description",
        content: "Actual available capacity per machine and workforce skill.",
      },
    ],
  }),
  component: Capacity,
});

function Capacity() {
  const preview = usePreview("capacity");
  const plan = preview.data;
  if (!plan || needsQueryStatus([preview]))
    return <QueryStatus queries={[preview]} subject="capacity" />;
  return (
    <>
      <PageHead
        icon={<Gauge className="h-6 w-6 text-primary" />}
        title="Actual Capacity"
        desc={`Next ${HORIZON_DAYS} days after shifts, breaks, planned maintenance, failures, setups and changeovers. Load reflects the live draft plan.`}
      />
      <Panel title="Machines">
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[900px]">
            <TableHeader>
              <TableRow className="border-b border-border/60">
                {[
                  "Machine",
                  "Type / line",
                  "Status",
                  "Speed",
                  "Calendar",
                  "Breaks",
                  "Downtime",
                  "Available",
                  "Setup+CO",
                  "Used",
                  "Remaining",
                  "Load",
                  "Net units",
                ].map((h) => (
                  <TableHead key={h} className={th}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.capacity.map((c) => (
                <TableRow key={c.machine} className="border-b border-border/30">
                  <TableCell className={td}>
                    <div className="font-medium">{c.machine}</div>
                    <div className="text-[10px] text-muted-foreground">{c.name}</div>
                  </TableCell>
                  <TableCell className={td}>
                    {c.type}
                    <div className="text-[10px] text-muted-foreground">{c.line}</div>
                  </TableCell>
                  <TableCell className={td}>
                    <Chip
                      tone={
                        c.status === "running"
                          ? "success"
                          : c.status === "idle"
                            ? "info"
                            : "destructive"
                      }
                    >
                      {c.status}
                    </Chip>
                  </TableCell>
                  <TableCell className={td}>{c.rate_per_hour.toLocaleString()}/h</TableCell>
                  <TableCell className={td}>{mins(c.calendar_min)}</TableCell>
                  <TableCell className={td}>{mins(c.break_min)}</TableCell>
                  <TableCell className={`${td} ${c.downtime_min ? "text-destructive" : ""}`}>
                    {mins(c.downtime_min)}
                  </TableCell>
                  <TableCell className={`${td} font-medium text-primary`}>
                    {mins(c.available_min)}
                  </TableCell>
                  <TableCell className={td}>{mins(c.changeover_min)}</TableCell>
                  <TableCell className={td}>{mins(c.used_min)}</TableCell>
                  <TableCell className={td}>{mins(c.remaining_min)}</TableCell>
                  <TableCell className={td}>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${c.utilization > 90 ? "bg-destructive" : c.utilization > 70 ? "bg-warning" : "bg-primary"}`}
                        style={{ width: `${Math.min(100, c.utilization)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{c.utilization}%</span>
                  </TableCell>
                  <TableCell className={td}>{c.capacity_units.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
      <Panel title="Workforce by skill (qualified, available operators on shift)">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plan.skills.map((s) => (
            <div key={s.skill} className="rounded-xl border border-border/40 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">{s.skill}</span>
                <Chip tone={s.operators ? "primary" : "destructive"}>{s.operators} operators</Chip>
              </div>
              <div className="mt-2 text-muted-foreground">
                Available {mins(s.available_min)} · Assigned {mins(s.used_min)}
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-info"
                  style={{
                    width: `${s.available_min ? Math.min(100, (s.used_min / s.available_min) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
          {!plan.skills.length && <Empty>No operators.</Empty>}
        </div>
      </Panel>
    </>
  );
}
