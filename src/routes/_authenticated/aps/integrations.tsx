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
import { Fragment, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plug, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Chip,
  Empty,
  Panel,
  PageHead,
  btn,
  errMsg,
  fmt,
  ghost,
  inp,
  lbl,
  td,
  th,
} from "@/components/aps/kit";
import { useCan, useTable } from "@/lib/aps/client";
import { saveSettings } from "@/lib/aps/aps.functions";
import { CONTRACT_VERSION, samplePayloads, type Source } from "@/lib/aps/contracts";

export const Route = createFileRoute("/_authenticated/aps/integrations")({
  head: () => ({
    meta: [
      { title: "Data Integrations · APS" },
      {
        name: "description",
        content: "Connected source systems, event log, MES schedule feed and plant settings.",
      },
    ],
  }),
  component: Integrations,
});

type Src = {
  key: string;
  name: string;
  provider_system: string;
  data_scope: string;
  last_sync_at: string | null;
  last_status: string;
  records_last_sync: number;
};
type Evt = {
  id: string;
  event_id: string | null;
  correlation_id: string | null;
  source_system: string;
  idempotency_key: string | null;
  schema_version: string;
  occurred_at: string | null;
  received_at: string;
  records: number;
  outcome: string;
  error: string | null;
};
type Fb = {
  id: string;
  po_number: string;
  seq: number;
  version_no: number | null;
  status: string;
  actual_start: string | null;
  actual_end: string | null;
  good_qty: number | null;
  scrap_qty: number | null;
  reported_at: string | null;
};

function Integrations() {
  const sourcesQuery = useTable<Src>("integration_sources", { column: "name" });
  const eventsQuery = useTable<Evt>("integration_events", {
    column: "received_at",
    ascending: false,
  });
  const feedbackQuery = useTable<Fb>("execution_feedback", {
    column: "received_at",
    ascending: false,
  });
  const { data: sources = [] } = sourcesQuery;
  const { data: events = [] } = eventsQuery;
  const { data: feedback = [] } = feedbackQuery;
  const [open, setOpen] = useState<string | null>(null);
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Couldn’t copy. Select and copy the endpoint manually.");
    }
  };
  const queries = [sourcesQuery, eventsQuery, feedbackQuery];
  if (needsQueryStatus(queries))
    return <QueryStatus queries={queries} subject="integration activity" />;

  return (
    <>
      <PageHead
        icon={<Plug className="h-6 w-6 text-primary" />}
        title="Data Integrations"
        desc="Each source system pushes its data to APS; APS publishes the approved schedule back to MES. Every message is logged and every sync is in the audit trail."
      />
      <Panel title="Interface contract (version 1)">
        <div className="space-y-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
          <p>
            User access is read from the <span className="text-foreground">Command Access Hub</span>{" "}
            (system key <span className="font-mono text-foreground">aps</span>) on every sign-in and
            change; if the Hub can't be reached, all changes are refused.
          </p>
          <p>
            Inbound:{" "}
            <span className="font-mono text-foreground">
              POST {base}/api/public/integrations/&lt;source&gt;
            </span>{" "}
            with header <span className="font-mono text-foreground">x-api-key</span>. Body: shared
            event envelope (
            <span className="font-mono">
              event_id, correlation_id, idempotency_key, schema_version="{CONTRACT_VERSION}",
              occurred_at
            </span>
            ) plus <span className="font-mono">records</span>. A repeated{" "}
            <span className="font-mono">idempotency_key</span> is acknowledged but not processed
            again.
          </p>
          <p>
            Outbound to MES:{" "}
            <span className="font-mono text-foreground">
              GET {base}/api/public/schedule/approved
            </span>{" "}
            (same key) returns the approved plan with planned start/end per operation, the
            signature, plant time zone and whether the plan is out of date. MES confirms receipt
            with a <span className="font-mono">{'{ type: "ack" }'}</span> record to{" "}
            <span className="font-mono">/mes</span> and reports actuals with{" "}
            <span className="font-mono">{'{ type: "progress" }'}</span> records.
          </p>
          <p>
            All timestamps are ISO-8601 with offset (UTC recommended). Inventory snapshots must
            carry <span className="font-mono">as_of</span>; BOM, routing and recipe records should
            carry their revision.
          </p>
        </div>
      </Panel>
      <Panel title="Sources">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="border-b border-border/60">
              {["Source", "Provided by", "Data", "Last sync", "Status", "Records", ""].map((h) => (
                <TableHead key={h} className={th}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((s) => (
              <Fragment key={s.key}>
                <TableRow className="border-b border-border/30">
                  <TableCell className={td}>
                    <div className="font-medium">{s.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">/{s.key}</div>
                  </TableCell>
                  <TableCell className={td}>{s.provider_system}</TableCell>
                  <TableCell className={`${td} max-w-xs text-muted-foreground`}>
                    {s.data_scope}
                  </TableCell>
                  <TableCell className={td}>{fmt(s.last_sync_at)}</TableCell>
                  <TableCell className={td}>
                    <Chip
                      tone={
                        s.last_status === "ok"
                          ? "success"
                          : s.last_status === "error"
                            ? "destructive"
                            : "muted"
                      }
                    >
                      {s.last_status}
                    </Chip>
                  </TableCell>
                  <TableCell className={td}>{s.records_last_sync}</TableCell>
                  <TableCell className={td}>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={ghost}
                      onClick={() => setOpen(open === s.key ? null : s.key)}
                    >
                      {open === s.key ? "Hide" : "Payload"}
                    </Button>
                  </TableCell>
                </TableRow>
                {open === s.key && (
                  <TableRow>
                    <TableCell colSpan={7} className="p-3">
                      <div className="relative rounded-lg border border-border/40 bg-background/60 p-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={`${ghost} absolute right-2 top-2`}
                          onClick={() =>
                            copy(
                              `curl -X POST ${base}/api/public/integrations/${s.key} -H 'content-type: application/json' -H 'x-api-key: $APS_INTEGRATION_KEY' -d '${JSON.stringify(samplePayloads[s.key as Source])}'`,
                            )
                          }
                        >
                          <Copy className="h-3 w-3" />
                          curl
                        </Button>
                        <pre className="overflow-x-auto font-mono text-[11px] text-muted-foreground">
                          {JSON.stringify(samplePayloads[s.key as Source], null, 2)}
                        </pre>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Panel>
      <Panel title="Message log">
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[820px]">
            <TableHeader>
              <TableRow className="border-b border-border/60">
                {[
                  "Received",
                  "Source",
                  "Event / correlation",
                  "Idempotency key",
                  "Records",
                  "Outcome",
                ].map((h) => (
                  <TableHead key={h} className={th}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.slice(0, 100).map((e) => (
                <TableRow key={e.id} className="border-b border-border/30">
                  <TableCell className={td}>
                    {fmt(e.received_at)}
                    {e.occurred_at && (
                      <div className="text-[10px] text-muted-foreground">
                        sent {fmt(e.occurred_at)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className={`${td} font-mono`}>{e.source_system}</TableCell>
                  <TableCell className={`${td} font-mono text-[10px]`}>
                    {e.event_id ?? "—"}
                    <div className="text-muted-foreground">{e.correlation_id ?? ""}</div>
                  </TableCell>
                  <TableCell
                    className={`${td} max-w-[200px] truncate font-mono text-[10px] text-muted-foreground`}
                  >
                    {e.idempotency_key ?? "—"}
                  </TableCell>
                  <TableCell className={td}>{e.records}</TableCell>
                  <TableCell className={td}>
                    <Chip tone={e.outcome === "processed" ? "success" : "destructive"}>
                      {e.outcome}
                    </Chip>
                    {e.error && <div className="mt-1 text-[10px] text-destructive">{e.error}</div>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!events.length && <Empty>No messages received yet.</Empty>}
        </div>
      </Panel>
      <Panel title="Execution feedback from MES">
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[720px]">
            <TableHeader>
              <TableRow className="border-b border-border/60">
                {[
                  "Order",
                  "Op",
                  "Plan",
                  "Status",
                  "Actual start",
                  "Actual end",
                  "Good / scrap",
                ].map((h) => (
                  <TableHead key={h} className={th}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {feedback.map((f) => (
                <TableRow key={f.id} className="border-b border-border/30">
                  <TableCell className={`${td} font-mono`}>{f.po_number}</TableCell>
                  <TableCell className={td}>{f.seq}</TableCell>
                  <TableCell className={td}>{f.version_no ? `v${f.version_no}` : "—"}</TableCell>
                  <TableCell className={td}>
                    <Chip
                      tone={
                        f.status === "completed"
                          ? "success"
                          : f.status === "aborted"
                            ? "destructive"
                            : "info"
                      }
                    >
                      {f.status}
                    </Chip>
                  </TableCell>
                  <TableCell className={td}>{fmt(f.actual_start)}</TableCell>
                  <TableCell className={td}>{fmt(f.actual_end)}</TableCell>
                  <TableCell className={td}>
                    {f.good_qty ?? "—"} / {f.scrap_qty ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!feedback.length && <Empty>No execution actuals received from MES yet.</Empty>}
        </div>
      </Panel>
      <SettingsPanel />
    </>
  );
}

function SettingsPanel() {
  const settingsQuery = useTable<{
    key: string;
    value: unknown;
    updated_by: string | null;
    updated_at: string;
  }>("app_settings");
  const { data: settings = [] } = settingsQuery;
  const canEdit = useCan("integrations", "edit");
  const save = useServerFn(saveSettings);
  const qc = useQueryClient();
  const get = (k: string) => settings.find((s) => s.key === k);
  const [tz, setTz] = useState("UTC");
  const [years, setYears] = useState(10);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = get("plant_timezone")?.value;
    const y = get("audit_retention_years")?.value;
    if (typeof t === "string") setTz(t);
    if (typeof y === "number") setYears(y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);
  async function submit() {
    setBusy(true);
    try {
      await save({ data: { plant_timezone: tz.trim(), audit_retention_years: years } });
      toast.success("Settings saved — shift hours now follow this time zone");
      for (const k of [["table", "app_settings"], ["preview"], ["plan-status"]])
        qc.invalidateQueries({ queryKey: k });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  const updated = get("plant_timezone");
  const queries = [settingsQuery];
  if (needsQueryStatus(queries)) return <QueryStatus queries={queries} subject="plant settings" />;

  return (
    <Panel title="Plant settings">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={lbl}>
          Plant time zone (shift hours are local plant time)
          <Input
            className={inp}
            value={tz}
            disabled={!canEdit}
            onChange={(e) => setTz(e.target.value)}
            placeholder="e.g. Asia/Amman"
          />
        </label>
        <label className={lbl}>
          Audit record retention (years)
          <Input
            type="number"
            min={1}
            max={50}
            className={inp}
            value={years}
            disabled={!canEdit}
            onChange={(e) => setYears(Number(e.target.value))}
          />
        </label>
        <div className="flex items-end">
          {canEdit && (
            <Button type="button" size="sm" className={btn} disabled={busy} onClick={submit}>
              Save settings
            </Button>
          )}
        </div>
      </div>
      {updated?.updated_by && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Last changed by {updated.updated_by} · {fmt(updated.updated_at)}
        </p>
      )}
    </Panel>
  );
}
