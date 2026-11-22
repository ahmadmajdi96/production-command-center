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
import { useMemo, useState } from "react";
import { GitCompare } from "lucide-react";
import {
  Chip,
  Panel,
  PageHead,
  Empty,
  fmt,
  fmtRange,
  inp,
  statusTone,
  td,
  th,
} from "@/components/aps/kit";
import { TRIGGERS, useTable, useVersions } from "@/lib/aps/client";
import { compareVersions } from "@/lib/aps/engine";

export const Route = createFileRoute("/_authenticated/aps/versions")({
  head: () => ({
    meta: [
      { title: "Schedule Versions · APS" },
      {
        name: "description",
        content: "Every schedule version with comparison and approval status.",
      },
    ],
  }),
  component: Versions,
});

function Versions() {
  const versionQuery = useVersions();
  const { data: versions = [] } = versionQuery;
  const approvalsQuery = useTable<{
    id: string;
    version_id: string;
    decision: string;
    signer_email: string;
    signed_at: string;
    comment: string | null;
  }>("approvals", { column: "signed_at", ascending: false });
  const { data: approvals = [] } = approvalsQuery;
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const A = versions.find((v) => v.id === (a || versions[1]?.id));
  const B = versions.find((v) => v.id === (b || versions[0]?.id));
  const diff = useMemo(() => (A && B ? compareVersions(A.items, B.items) : null), [A, B]);
  const queries = [versionQuery, approvalsQuery];
  if (needsQueryStatus(queries))
    return <QueryStatus queries={queries} subject="schedule versions" />;

  return (
    <>
      <PageHead
        icon={<GitCompare className="h-6 w-6 text-primary" />}
        title="Schedule Versions"
        desc="Versions are never overwritten. Compare sequences, times and allocated resources between any two."
      />
      <Panel title="Version history">
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[860px]">
            <TableHeader>
              <TableRow className="border-b border-border/60">
                {[
                  "Version",
                  "Type",
                  "Trigger",
                  "Reason",
                  "Created by",
                  "Created",
                  "Conflicts",
                  "Status",
                  "Approval",
                ].map((h) => (
                  <TableHead key={h} className={th}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((v) => {
                const ap = approvals.find((x) => x.version_id === v.id);
                const parent = versions.find((x) => x.id === v.parent_id);
                return (
                  <TableRow key={v.id} className="border-b border-border/30">
                    <TableCell className={`${td} font-mono text-primary`}>
                      v{v.version_no}
                      {parent && (
                        <div className="text-[10px] text-muted-foreground">
                          from v{parent.version_no}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className={td}>{v.kind}</TableCell>
                    <TableCell className={td}>{TRIGGERS[v.trigger ?? ""] ?? "—"}</TableCell>
                    <TableCell className={`${td} max-w-xs`}>{v.reason ?? "—"}</TableCell>
                    <TableCell className={td}>{v.created_by}</TableCell>
                    <TableCell className={td}>{fmt(v.created_at)}</TableCell>
                    <TableCell className={td}>{v.conflicts.length}</TableCell>
                    <TableCell className={td}>
                      <Chip tone={statusTone[v.status]}>{v.status.replace("_", " ")}</Chip>
                    </TableCell>
                    <TableCell className={`${td} text-[11px] text-muted-foreground`}>
                      {ap ? (
                        <>
                          {ap.decision} by {ap.signer_email}
                          <div>{fmt(ap.signed_at)}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!versions.length && <Empty>No schedule versions yet.</Empty>}
        </div>
      </Panel>
      {versions.length > 1 && (
        <Panel
          title="Compare versions"
          action={
            <div className="flex items-center gap-2">
              <select
                className={`${inp} w-40`}
                value={A?.id}
                onChange={(e) => setA(e.target.value)}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version_no}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">→</span>
              <select
                className={`${inp} w-40`}
                value={B?.id}
                onChange={(e) => setB(e.target.value)}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version_no}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          {diff && A && B && (
            <div className="space-y-3 text-xs">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border/40 p-2">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    v{A.version_no} sequence · by {A.created_by}
                  </div>
                  <div className="font-mono">{diff.sequenceBefore.join(" → ") || "—"}</div>
                  <div className="text-muted-foreground">
                    Changeover {A.metrics.total_changeover_min}m · late {A.metrics.late}
                  </div>
                </div>
                <div className="rounded-lg border border-primary/30 p-2">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    v{B.version_no} sequence · by {B.created_by}
                  </div>
                  <div className="font-mono text-primary">
                    {diff.sequenceAfter.join(" → ") || "—"}
                  </div>
                  <div className="text-muted-foreground">
                    Changeover {B.metrics.total_changeover_min}m · late {B.metrics.late} · reason:{" "}
                    {B.reason ?? "—"}
                  </div>
                </div>
              </div>
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="border-b border-border/60">
                    {["Order", "Operation", "Change", `v${A.version_no}`, `v${B.version_no}`].map(
                      (h) => (
                        <TableHead key={h} className={th}>
                          {h}
                        </TableHead>
                      ),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diff.diffs.map((d, k) => (
                    <TableRow key={k} className="border-b border-border/30">
                      <TableCell className={`${td} font-mono`}>{d.po}</TableCell>
                      <TableCell className={td}>{d.op}</TableCell>
                      <TableCell className={td}>
                        <Chip
                          tone={
                            d.change === "removed"
                              ? "destructive"
                              : d.change === "added"
                                ? "success"
                                : d.change === "reassigned"
                                  ? "info"
                                  : "warning"
                          }
                        >
                          {d.change}
                        </Chip>
                      </TableCell>
                      <TableCell className={td}>{fmtRange(d.before)}</TableCell>
                      <TableCell className={td}>{fmtRange(d.after)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!diff.diffs.length && <Empty>The two versions are identical.</Empty>}
            </div>
          )}
        </Panel>
      )}
    </>
  );
}
