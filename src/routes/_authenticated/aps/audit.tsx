import { needsQueryStatus, QueryStatus } from "@/components/aps/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { History, ShieldCheck, Download } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { verifyAuditChain } from "@/lib/aps/aps.functions";
import {
  Chip,
  Panel,
  PageHead,
  Empty,
  errMsg,
  fmt,
  ghost,
  inp,
  td,
  th,
} from "@/components/aps/kit";
import { useTable } from "@/lib/aps/client";

export const Route = createFileRoute("/_authenticated/aps/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail · APS" },
      {
        name: "description",
        content: "Complete record of planning activities, changes and signatures.",
      },
    ],
  }),
  component: Audit,
});

type Row = {
  id: string;
  at: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string | null;
  before_value: unknown;
  after_value: unknown;
  reason: string | null;
  seq?: number;
  hash?: string | null;
};

function Audit() {
  const rowsQuery = useTable<Row>("audit_log", { column: "at", ascending: false });
  const { data: rows = [] } = rowsQuery;
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("all");
  const entities = Array.from(new Set(rows.map((r) => r.entity)));
  const settingsQuery = useTable<{ key: string; value: unknown }>("app_settings");
  const { data: settings = [] } = settingsQuery;
  const retention = settings.find((x) => x.key === "audit_retention_years")?.value as
    number | undefined;
  const verify = useServerFn(verifyAuditChain);
  const [check, setCheck] = useState<{
    ok: boolean;
    checked: number;
    broken_seq: number | null;
  } | null>(null);
  async function runCheck() {
    try {
      setCheck(await verify());
    } catch (e) {
      toast.error(errMsg(e));
    }
  }
  function exportCsv() {
    const cols = [
      "seq",
      "at",
      "actor",
      "action",
      "entity",
      "entity_id",
      "before_value",
      "after_value",
      "reason",
      "hash",
    ] as const;
    const esc = (v: unknown) => {
      const t = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      const safe = typeof v === "string" && /^\s*[=+@-]/.test(t) ? "'" + t : t;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const csv = [cols.join(","), ...list.map((r) => cols.map((c) => esc(r[c])).join(","))].join(
      "\n",
    );
    const a = document.createElement("a");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.href = url;
    a.download = `aps-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  const list = rows.filter(
    (r) =>
      (entity === "all" || r.entity === entity) &&
      (!q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())),
  );
  const queries = [rowsQuery, settingsQuery];
  if (needsQueryStatus(queries)) return <QueryStatus queries={queries} subject="audit history" />;

  return (
    <>
      <PageHead
        icon={<History className="h-6 w-6 text-primary" />}
        title="Audit Trail"
        desc="Schedule creation, changes, rescheduling, rule changes, approvals, signatures and integration syncs."
      >
        <Input
          className={`${inp} w-56`}
          placeholder="Search…"
          aria-label="Search audit history"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className={`${inp} w-44`}
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
        >
          <option value="all">All records</option>
          {entities.map((e) => (
            <option key={e} value={e}>
              {e.replace("_", " ")}
            </option>
          ))}
        </select>
      </PageHead>
      <Panel title="Record integrity">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            Records are append-only and chained with a SHA-256 fingerprint; editing or deleting any
            record breaks the chain.{retention ? ` Retention target: ${retention} years.` : ""}
          </span>
          <Button type="button" size="sm" variant="outline" className={ghost} onClick={runCheck}>
            <ShieldCheck className="h-3 w-3" />
            Verify integrity
          </Button>
          <Button type="button" size="sm" variant="outline" className={ghost} onClick={exportCsv}>
            <Download className="h-3 w-3" />
            Export CSV
          </Button>
          {check && (
            <Chip tone={check.ok ? "success" : "destructive"}>
              {check.ok
                ? `Intact — ${check.checked} records checked`
                : `Broken at record #${check.broken_seq}`}
            </Chip>
          )}
        </div>
      </Panel>
      <Panel>
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[900px]">
            <TableHeader>
              <TableRow className="border-b border-border/60">
                {["When", "Who", "Action", "Record", "Previous value", "New value", "Reason"].map(
                  (h) => (
                    <TableHead key={h} className={th}>
                      {h}
                    </TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.id} className="border-b border-border/30">
                  <TableCell className={`${td} whitespace-nowrap`}>
                    {fmt(r.at)}
                    <div
                      className="font-mono text-[9px] text-muted-foreground"
                      title={r.hash ?? ""}
                    >
                      #{r.seq} {r.hash?.slice(0, 10)}
                    </div>
                  </TableCell>
                  <TableCell className={td}>{r.actor}</TableCell>
                  <TableCell className={td}>
                    <Chip
                      tone={
                        r.action.includes("rejected") || r.action.includes("failed")
                          ? "destructive"
                          : r.action.includes("approved")
                            ? "success"
                            : "info"
                      }
                    >
                      {r.action}
                    </Chip>
                  </TableCell>
                  <TableCell className={td}>
                    {r.entity.replace("_", " ")}
                    <div className="font-mono text-[10px] text-muted-foreground">{r.entity_id}</div>
                  </TableCell>
                  <TableCell className={`${td} max-w-[220px]`}>
                    <Json v={r.before_value} />
                  </TableCell>
                  <TableCell className={`${td} max-w-[220px]`}>
                    <Json v={r.after_value} />
                  </TableCell>
                  <TableCell className={td}>{r.reason ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!list.length && <Empty>No audit records.</Empty>}
        </div>
      </Panel>
    </>
  );
}

function Json({ v }: { v: unknown }) {
  if (v == null) return <span className="text-muted-foreground">—</span>;
  const entries = Object.entries(v as Record<string, unknown>)
    .filter(([k]) => !["id", "updated_at", "description"].includes(k))
    .slice(0, 6);
  return (
    <div className="space-y-0.5 font-mono text-[10px] text-muted-foreground">
      {entries.map(([k, x]) => (
        <div key={k} className="truncate">
          <span className="text-foreground">{k}</span>:{" "}
          {typeof x === "object" ? JSON.stringify(x) : String(x)}
        </div>
      ))}
    </div>
  );
}
