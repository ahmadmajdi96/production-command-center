import { needsQueryStatus, QueryStatus } from "@/components/aps/kit";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Chip, Panel, PageHead, Empty, fmt, inp, sevTone, td, th } from "@/components/aps/kit";
import { usePreview, useVersions } from "@/lib/aps/client";

export const Route = createFileRoute("/_authenticated/aps/conflicts")({
  head: () => ({
    meta: [
      { title: "Conflicts · APS" },
      {
        name: "description",
        content: "Schedule conflicts with cause, timing, resource and delivery impact.",
      },
    ],
  }),
  component: Conflicts,
});

const TYPES = [
  "material",
  "machine",
  "operator",
  "shift",
  "capacity",
  "dependency",
  "min_gap",
  "maintenance",
  "delivery",
  "changeover",
];

function Conflicts() {
  const preview = usePreview("conflicts");
  const versionQuery = useVersions("conflicts");
  const plan = preview.data;
  const { data: versions = [] } = versionQuery;
  const [src, setSrc] = useState("live");
  const [type, setType] = useState("all");
  const v = versions.find((x) => x.id === src);
  const list = (v ? v.conflicts : (plan?.conflicts ?? [])).filter(
    (c) => type === "all" || c.type === type,
  );
  const counts = TYPES.map((t) => ({
    t,
    n: (v ? v.conflicts : (plan?.conflicts ?? [])).filter((c) => c.type === t).length,
  }));
  const queries = [preview, versionQuery];
  if (needsQueryStatus(queries))
    return <QueryStatus queries={queries} subject="schedule conflicts" />;

  return (
    <>
      <PageHead
        icon={<AlertTriangle className="h-6 w-6 text-primary" />}
        title="Schedule Conflicts"
        desc="Detected conflicts, the resource and time involved, their cause, the business rule applied and their impact."
      >
        <select
          aria-label="Select schedule version"
          className={`${inp} w-56`}
          value={src}
          onChange={(e) => setSrc(e.target.value)}
        >
          <option value="live">Live draft</option>
          {versions.map((x) => (
            <option key={x.id} value={x.id}>
              v{x.version_no} · {x.status.replace("_", " ")}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by conflict type"
          className={`${inp} w-44`}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </select>
      </PageHead>
      <div className="flex flex-wrap gap-2">
        {counts.map(({ t, n }) => (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            key={t}
            aria-pressed={type === t}
            onClick={() => setType(type === t ? "all" : t)}
          >
            <Chip tone={n ? (type === t ? "primary" : "warning") : "muted"}>
              {t.replace("_", " ")} · {n}
            </Chip>
          </Button>
        ))}
      </div>
      <Panel>
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[960px]">
            <TableHeader>
              <TableRow className="border-b border-border/60">
                {[
                  "Type",
                  "Severity",
                  "Orders",
                  "Operation",
                  "Resource",
                  "When",
                  "Reason",
                  "Impact",
                  "Rule applied",
                ].map((h) => (
                  <TableHead key={h} className={th}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id} className="border-b border-border/30">
                  <TableCell className={td}>
                    <Chip tone="primary">{c.type.replace("_", " ")}</Chip>
                  </TableCell>
                  <TableCell className={td}>
                    <Chip tone={sevTone[c.severity]}>{c.severity}</Chip>
                  </TableCell>
                  <TableCell className={`${td} font-mono`}>{c.orders.join(", ") || "—"}</TableCell>
                  <TableCell className={td}>{c.operation ?? "—"}</TableCell>
                  <TableCell className={td}>{c.resource ?? "—"}</TableCell>
                  <TableCell className={td}>{fmt(c.at)}</TableCell>
                  <TableCell className={`${td} max-w-xs`}>{c.reason}</TableCell>
                  <TableCell className={`${td} max-w-xs font-medium`}>{c.impact}</TableCell>
                  <TableCell className={`${td} text-muted-foreground`}>{c.rule ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!list.length && <Empty>No conflicts for this selection.</Empty>}
        </div>
      </Panel>
    </>
  );
}
