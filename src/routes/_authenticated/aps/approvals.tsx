import { needsQueryStatus, QueryStatus } from "@/components/aps/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PenLine, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Chip,
  Modal,
  Panel,
  PageHead,
  Empty,
  btn,
  errMsg,
  fmt,
  ghost,
  inp,
  lbl,
  sevTone,
  td,
  th,
} from "@/components/aps/kit";
import { Gantt } from "@/components/aps/gantt";
import { useAccess, useCan, useTable, useVersions, type Version } from "@/lib/aps/client";
import { signVersion } from "@/lib/aps/aps.functions";
import type { Machine } from "@/lib/aps/engine";

export const Route = createFileRoute("/_authenticated/aps/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals · APS" },
      { name: "description", content: "Review and electronically sign production schedules." },
    ],
  }),
  component: Approvals,
});

type ApprovalRow = {
  id: string;
  version_id: string;
  decision: string;
  signer_email: string;
  signer_name: string | null;
  meaning: string;
  comment: string | null;
  signed_at: string;
};

function Approvals() {
  const versionQuery = useVersions("approvals");
  const { data: versions = [] } = versionQuery;
  const { data: machines = [] } = useTable<Machine>("machines", { column: "code" });
  const { data: approvals = [] } = useTable<ApprovalRow>("approvals", {
    column: "signed_at",
    ascending: false,
  });
  const pending = versions.filter((v) => v.status === "pending_approval");
  const [sel, setSel] = useState<string | null>(null);
  const v = pending.find((x) => x.id === (sel ?? pending[0]?.id));
  const canSign = useCan("approvals", "edit");
  const [sign, setSign] = useState<null | "approved" | "rejected">(null);

  const queries = [versionQuery];
  if (needsQueryStatus(queries))
    return <QueryStatus queries={queries} subject="schedule approvals" />;

  return (
    <>
      <PageHead
        icon={<PenLine className="h-6 w-6 text-primary" />}
        title="Approvals & Electronic Signature"
        desc="Review schedule details, conflicts and allocated resources, then approve or reject with your signature."
      />
      <div className="grid gap-4 lg:grid-cols-4">
        <Panel title="Awaiting approval">
          <div className="space-y-1.5">
            {pending.map((p) => (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                key={p.id}
                onClick={() => setSel(p.id)}
                className={`w-full rounded-lg border px-2 py-2 text-left text-xs ${v?.id === p.id ? "border-primary/40 bg-primary/10" : "border-border/40"}`}
              >
                <div className="font-mono text-primary">v{p.version_no}</div>
                <div className="text-[11px] text-muted-foreground">
                  {p.kind} · {p.created_by}
                </div>
                <div className="text-[10px] text-muted-foreground">{fmt(p.created_at)}</div>
              </Button>
            ))}
            {!pending.length && <Empty>Nothing to approve.</Empty>}
          </div>
        </Panel>
        <div className="space-y-4 lg:col-span-3">
          {v ? (
            <>
              <Panel
                title={`Schedule v${v.version_no}`}
                action={
                  canSign && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={ghost}
                        onClick={() => setSign("rejected")}
                      >
                        Reject
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className={btn}
                        onClick={() => setSign("approved")}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Approve & sign
                      </Button>
                    </div>
                  )
                }
              >
                <div className="mb-3 grid gap-2 text-xs sm:grid-cols-4">
                  <div>
                    <span className="text-muted-foreground">Reason:</span> {v.reason ?? "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Orders:</span>{" "}
                    {v.metrics.orders_scheduled} ({v.metrics.late} late)
                  </div>
                  <div>
                    <span className="text-muted-foreground">Changeover:</span>{" "}
                    {v.metrics.total_changeover_min} min
                  </div>
                  <div>
                    <span className="text-muted-foreground">Completion:</span>{" "}
                    {fmt(v.metrics.makespan_end)}
                  </div>
                </div>
                <Gantt items={v.items} machines={machines} />
              </Panel>
              <div className="grid gap-4 md:grid-cols-2">
                <Panel title={`Conflicts (${v.conflicts.length})`}>
                  <div className="max-h-72 space-y-1.5 overflow-auto">
                    {v.conflicts.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg border border-border/40 px-2 py-1.5 text-xs"
                      >
                        <Chip tone={sevTone[c.severity]}>{c.type}</Chip>{" "}
                        <span className="font-mono">{c.orders.join(", ")}</span>
                        <div className="text-[11px] text-muted-foreground">
                          {c.reason} — {c.impact}
                        </div>
                      </div>
                    ))}
                    {!v.conflicts.length && <Empty>No conflicts.</Empty>}
                  </div>
                </Panel>
                <Panel title="Allocated resources">
                  <Resources v={v} />
                </Panel>
              </div>
            </>
          ) : (
            <Empty>Select a schedule awaiting approval.</Empty>
          )}
        </div>
      </div>
      <Panel title="Signature record">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="border-b border-border/60">
              {["Version", "Decision", "Signed by", "Meaning", "Comment", "Date & time"].map(
                (h) => (
                  <TableHead key={h} className={th}>
                    {h}
                  </TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {approvals.map((a) => (
              <TableRow key={a.id} className="border-b border-border/30">
                <TableCell className={`${td} font-mono`}>
                  v{versions.find((x) => x.id === a.version_id)?.version_no}
                </TableCell>
                <TableCell className={td}>
                  <Chip tone={a.decision === "approved" ? "success" : "destructive"}>
                    {a.decision}
                  </Chip>
                </TableCell>
                <TableCell className={td}>
                  {a.signer_name ?? a.signer_email}
                  <div className="text-[10px] text-muted-foreground">{a.signer_email}</div>
                </TableCell>
                <TableCell className={`${td} text-muted-foreground`}>{a.meaning}</TableCell>
                <TableCell className={td}>{a.comment ?? "—"}</TableCell>
                <TableCell className={td}>{fmt(a.signed_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!approvals.length && <Empty>No signatures yet.</Empty>}
      </Panel>
      {sign && v && <SignModal v={v} decision={sign} onClose={() => setSign(null)} />}
    </>
  );
}

function Resources({ v }: { v: Version }) {
  const m = new Map<string, { ops: number; min: number }>();
  for (const i of v.items) {
    const x = m.get(i.machine) ?? { ops: 0, min: 0 };
    x.ops++;
    x.min += (Date.parse(i.end) - Date.parse(i.start)) / 60000;
    m.set(i.machine, x);
  }
  const ops = Array.from(new Set(v.items.map((i) => i.operator).filter(Boolean)));
  return (
    <div className="space-y-2 text-xs">
      {Array.from(m).map(([k, x]) => (
        <div key={k} className="flex justify-between">
          <span>{k}</span>
          <span className="text-muted-foreground">
            {x.ops} ops · {Math.round(x.min)} min
          </span>
        </div>
      ))}
      <div className="border-t border-border/40 pt-2 text-muted-foreground">
        Operators: {ops.join(", ") || "—"}
      </div>
    </div>
  );
}

function SignModal({
  v,
  decision,
  onClose,
}: {
  v: Version;
  decision: "approved" | "rejected";
  onClose: () => void;
}) {
  const me = useAccess();
  const qc = useQueryClient();
  const sign = useServerFn(signVersion);
  const [password, setPassword] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      await sign({ data: { id: v.id, decision, password, comment } });
      toast.success(`v${v.version_no} ${decision}`);
      qc.invalidateQueries({ queryKey: ["versions"] });
      qc.invalidateQueries({ queryKey: ["table", "approvals"] });
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={
        decision === "approved"
          ? `Approve schedule v${v.version_no}`
          : `Reject schedule v${v.version_no}`
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-xs">
          <div className="text-muted-foreground">Signature meaning</div>
          <div className="font-medium">
            {decision === "approved"
              ? "I approve this production schedule for execution"
              : "I reject this production schedule"}
          </div>
          <div className="mt-2 text-muted-foreground">
            Signer: {me?.fullName ?? me?.email} · {new Date().toLocaleString()}
          </div>
        </div>
        <label className={lbl}>
          {decision === "rejected" ? "Rejection reason (required)" : "Comment (optional)"}
          <Textarea
            className={`${inp} h-20 py-2`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
        <label className={lbl}>
          Re-enter your password to sign
          <Input
            type="password"
            className={inp}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" className={ghost} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className={btn}
            disabled={busy || !password || (decision === "rejected" && comment.trim().length < 3)}
            onClick={submit}
          >
            {busy ? "Signing…" : "Sign"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
