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
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GanttChart, Play, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Chip,
  Modal,
  Panel,
  PageHead,
  Stat,
  btn,
  errMsg,
  fmt,
  fmtRange,
  ghost,
  inp,
  lbl,
  mins,
  statusTone,
  td,
  th,
  Empty,
} from "@/components/aps/kit";
import { Gantt } from "@/components/aps/gantt";
import {
  TRIGGERS,
  useCan,
  usePreview,
  useTable,
  useVersions,
  useVersionQueryKey,
  type Version,
} from "@/lib/aps/client";
import { createScheduleVersion, submitVersion } from "@/lib/aps/aps.functions";
import { compareVersions, type Machine } from "@/lib/aps/engine";

export const Route = createFileRoute("/_authenticated/aps/schedule")({
  head: () => ({
    meta: [
      { title: "Production Schedule · APS" },
      {
        name: "description",
        content: "Finite-capacity production schedule with Gantt view and rescheduling.",
      },
    ],
  }),
  component: Schedule,
});

function Schedule() {
  const versionQuery = useVersions("schedule");
  const previewQuery = usePreview("schedule");
  const { data: preview } = previewQuery;
  const { data: versions = [] } = versionQuery;
  const { data: machines = [] } = useTable<Machine>("machines", { column: "code" });
  const [sel, setSel] = useState<string>("live");
  const [gen, setGen] = useState<null | "new" | "re">(null);
  const canCreate = useCan("schedule", "create");
  const canEdit = useCan("schedule", "edit");
  const qc = useQueryClient();
  const submit = useServerFn(submitVersion);
  useEffect(() => {
    if (sel === "live" && versions[0]) setSel(versions[0].id);
  }, [versions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const v = versions.find((x) => x.id === sel);
  const items = v ? v.items : (preview?.items ?? []);
  const metrics = v ? v.metrics : preview?.metrics;
  const conflicts = v ? v.conflicts : (preview?.conflicts ?? []);
  const rules = v ? v.rules_applied : (preview?.rulesApplied ?? []);
  const current = versions.find((x) => x.status === "approved");

  async function doSubmit() {
    if (!v) return;
    try {
      await submit({ data: { id: v.id } });
      toast.success(`v${v.version_no} submitted for approval`);
      qc.invalidateQueries({ queryKey: ["versions"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  const queries = [versionQuery, previewQuery];
  if (needsQueryStatus(queries))
    return <QueryStatus queries={queries} subject="production schedule" />;

  return (
    <>
      <PageHead
        icon={<GanttChart className="h-6 w-6 text-primary" />}
        title="Production Schedule"
        desc="Operations allocated to machines and operators within shifts, respecting dependencies, gaps and changeovers."
      >
        <select
          aria-label="Select schedule version"
          className={`${inp} w-64`}
          value={sel}
          onChange={(e) => setSel(e.target.value)}
        >
          <option value="live">Live draft (not saved)</option>
          {versions.map((x) => (
            <option key={x.id} value={x.id}>
              v{x.version_no} · {x.status.replace("_", " ")} · {fmt(x.created_at)}
            </option>
          ))}
        </select>
        {canCreate && (
          <Button type="button" size="sm" className={btn} onClick={() => setGen("new")}>
            <Play className="h-3.5 w-3.5" />
            Generate schedule
          </Button>
        )}
        {canCreate && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={ghost}
            onClick={() => setGen("re")}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reschedule
          </Button>
        )}
        {canEdit && v && ["draft", "rejected"].includes(v.status) && (
          <Button type="button" size="sm" variant="outline" className={ghost} onClick={doSubmit}>
            <Send className="h-3.5 w-3.5" />
            Submit for approval
          </Button>
        )}
      </PageHead>

      {v && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Chip tone={statusTone[v.status]}>{v.status.replace("_", " ")}</Chip>
          <span>
            v{v.version_no} · {v.kind} · {TRIGGERS[v.trigger ?? ""] ?? v.trigger} · by{" "}
            {v.created_by}
          </span>
          {v.reason && <span>· “{v.reason}”</span>}
          {v.status === "pending_approval" && (
            <Link to="/aps/approvals" className="text-primary">
              Review approval →
            </Link>
          )}
        </div>
      )}

      {metrics && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat
            label="Orders scheduled"
            value={metrics.orders_scheduled}
            hint={`${metrics.orders_excluded} excluded`}
          />
          <Stat
            label="On time / late"
            value={`${metrics.on_time} / ${metrics.late}`}
            tone={metrics.late ? "warning" : "success"}
          />
          <Stat
            label="Total changeover"
            value={mins(metrics.total_changeover_min)}
            tone="info"
            hint={`setup ${mins(metrics.total_setup_min)}`}
          />
          <Stat label="Completion" value={fmt(metrics.makespan_end)} />
          <Stat
            label="Conflicts"
            value={conflicts.length}
            tone={conflicts.length ? "warning" : "success"}
          />
        </div>
      )}

      <Panel title="Gantt by machine">
        <Gantt items={items} machines={machines} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Operations" className="lg:col-span-2">
          <div className="max-h-[420px] overflow-auto">
            <Table className="w-full min-w-[720px]">
              <TableHeader className="sticky top-0 bg-card">
                <TableRow className="border-b border-border/60">
                  <TableHead className={th}>Order</TableHead>
                  <TableHead className={th}>Operation</TableHead>
                  <TableHead className={th}>Machine</TableHead>
                  <TableHead className={th}>Operator</TableHead>
                  <TableHead className={th}>Start</TableHead>
                  <TableHead className={th}>End</TableHead>
                  <TableHead className={th}>Process</TableHead>
                  <TableHead className={th}>Setup+CO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...items]
                  .sort((a, b) => a.start.localeCompare(b.start))
                  .map((i) => (
                    <TableRow key={i.key} className="border-b border-border/30">
                      <TableCell className={`${td} font-mono`}>{i.po}</TableCell>
                      <TableCell className={td}>{i.op}</TableCell>
                      <TableCell className={td}>{i.machine}</TableCell>
                      <TableCell className={td}>
                        {i.operator ?? <span className="text-destructive">unassigned</span>}
                      </TableCell>
                      <TableCell className={td}>{fmt(i.start)}</TableCell>
                      <TableCell className={td}>{fmt(i.end)}</TableCell>
                      <TableCell className={td}>{mins(i.process_min)}</TableCell>
                      <TableCell className={td}>
                        {mins(i.setup_min)}
                        {i.changeover_min ? (
                          <span className="text-warning"> +{i.changeover_min}m</span>
                        ) : (
                          ""
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            {!items.length && <Empty>No operations.</Empty>}
          </div>
        </Panel>
        <Panel title="Business rules applied">
          <ul className="space-y-2 text-xs">
            {rules.map((r, k) => (
              <li key={k} className="rounded-lg border border-border/40 p-2">
                <div className="font-medium text-primary">{r.rule}</div>
                <div className="text-muted-foreground">{r.effect}</div>
              </li>
            ))}
            {!rules.length && <Empty>No active rules.</Empty>}
          </ul>
          {(metrics as { sequence?: string[] } | undefined)?.sequence && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Sequence:{" "}
              <span className="font-mono text-foreground">
                {(metrics as { sequence?: string[] }).sequence!.join(" → ")}
              </span>
            </p>
          )}
        </Panel>
      </div>

      {gen && (
        <GenerateModal
          mode={gen}
          hasCurrent={!!current}
          onClose={() => setGen(null)}
          onDone={(id) => {
            setSel(id);
            setGen(null);
          }}
        />
      )}
    </>
  );
}

function GenerateModal({
  mode,
  hasCurrent,
  onClose,
  onDone,
}: {
  mode: "new" | "re";
  hasCurrent: boolean;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createScheduleVersion);
  const versionQueryKey = useVersionQueryKey("schedule");
  const [trigger, setTrigger] = useState(mode === "new" ? "new_plan" : "machine_failure");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState<ReturnType<typeof compareVersions> | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    try {
      const res = await create({ data: { trigger: trigger as "new_plan", reason } });
      await qc.invalidateQueries({ queryKey: ["versions"] });
      const all = qc.getQueryData<Version[]>(versionQueryKey) ?? [];
      const created = all.find((x) => x.id === res.id);
      const base = all.find((x) => x.status === "approved") ?? all.find((x) => x.id !== res.id);
      toast.success(`Schedule v${res.version_no} created as draft`);
      setLastId(res.id);
      if (mode === "re" && created && base) setDiff(compareVersions(base.items, created.items));
      else onDone(res.id);
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
      title={mode === "new" ? "Generate production schedule" : "Dynamic rescheduling"}
      wide={!!diff}
    >
      {!diff ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {mode === "new"
              ? "Builds a new schedule version from current data and active business rules."
              : `Recalculates capacity and dates from the latest data and compares the result with the ${hasCurrent ? "approved" : "latest"} schedule.`}
          </p>
          <label className={lbl}>
            Trigger
            <select className={inp} value={trigger} onChange={(e) => setTrigger(e.target.value)}>
              {Object.entries(TRIGGERS)
                .filter(([k]) => (mode === "new") === (k === "new_plan") || k === "manual")
                .map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
            </select>
          </label>
          <label className={lbl}>
            Reason (recorded in audit trail)
            <Input
              className={inp}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={mode === "new" ? "Weekly plan" : "FL-01 failure, ETA 4h"}
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
              disabled={busy || reason.trim().length < 3}
              onClick={run}
            >
              {busy ? "Calculating…" : "Generate"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-xs">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Current sequence
              </div>
              <div className="font-mono">{diff.sequenceBefore.join(" → ") || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Modified sequence
              </div>
              <div className="font-mono text-primary">{diff.sequenceAfter.join(" → ") || "—"}</div>
            </div>
          </div>
          <div className="max-h-72 overflow-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="border-b border-border/60">
                  <TableHead className={th}>Order</TableHead>
                  <TableHead className={th}>Operation</TableHead>
                  <TableHead className={th}>Change</TableHead>
                  <TableHead className={th}>Before</TableHead>
                  <TableHead className={th}>After</TableHead>
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
            {!diff.diffs.length && <Empty>No differences from the current schedule.</Empty>}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              className={btn}
              onClick={() => onDone(lastId ?? "live")}
            >
              View new version
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
