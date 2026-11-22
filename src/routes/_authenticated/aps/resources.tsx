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
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Factory, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Chip,
  Modal,
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
import { setOperatorAvailability, updateMachine } from "@/lib/aps/aps.functions";
import type {
  Changeover,
  Machine,
  Maintenance,
  Material,
  Operator,
  Product,
  Shift,
} from "@/lib/aps/engine";

export const Route = createFileRoute("/_authenticated/aps/resources")({
  head: () => ({
    meta: [
      { title: "Plant Resources · APS" },
      {
        name: "description",
        content: "Machines, workforce, shifts, maintenance, changeovers, materials and products.",
      },
    ],
  }),
  component: Resources,
});

const TABS = [
  "Machines",
  "Workforce",
  "Shifts",
  "Maintenance",
  "Changeovers",
  "Materials",
  "Products & routing",
] as const;

function Resources() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Machines");
  return (
    <>
      <PageHead
        icon={<Factory className="h-6 w-6 text-primary" />}
        title="Plant Resources"
        desc="Planning data received from connected systems. Machine status and operator availability can be adjusted here for rescheduling."
      />
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg border px-3 py-1.5 text-xs ${tab === t ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground"}`}
          >
            {t}
          </Button>
        ))}
      </div>
      {tab === "Machines" && <Machines />}
      {tab === "Workforce" && <Workforce />}
      {tab === "Shifts" && (
        <Simple<Shift>
          table="shifts"
          cols={[
            ["Shift", (r) => r.name],
            ["Hours (UTC)", (r) => `${r.start_hour}:00 – ${r.end_hour}:00`],
            [
              "Break",
              (r) => (r.break_minutes ? `${r.break_minutes} min at ${r.break_start_hour}:00` : "—"),
            ],
          ]}
        />
      )}
      {tab === "Maintenance" && (
        <Simple<Maintenance>
          table="maintenance_events"
          cols={[
            ["Machine", (r) => r.machine_code],
            [
              "Type",
              (r) => <Chip tone={r.kind === "failure" ? "destructive" : "info"}>{r.kind}</Chip>,
            ],
            ["From", (r) => fmt(r.starts_at)],
            ["Until / repair ETA", (r) => fmt(r.ends_at)],
            ["Note", (r) => r.note ?? "—"],
          ]}
        />
      )}
      {tab === "Changeovers" && (
        <Simple<Changeover>
          table="changeovers"
          cols={[
            ["From setup", (r) => r.from_family],
            ["To setup", (r) => r.to_family],
            ["Minutes", (r) => r.minutes],
          ]}
        />
      )}
      {tab === "Materials" && (
        <Simple<Material>
          table="materials"
          cols={[
            ["Code", (r) => <span className="font-mono">{r.code}</span>],
            ["Name", (r) => r.name],
            ["On hand", (r) => `${Number(r.on_hand).toLocaleString()} ${r.uom}`],
            ["On hold", (r) => Number(r.on_hold).toLocaleString()],
            [
              "Expected",
              (r) =>
                Number(r.expected_qty)
                  ? `${Number(r.expected_qty).toLocaleString()} on ${fmt(r.expected_at)}`
                  : "—",
            ],
            [
              "Status",
              (r) => <Chip tone={r.status === "released" ? "success" : "warning"}>{r.status}</Chip>,
            ],
          ]}
        />
      )}
      {tab === "Products & routing" && (
        <Simple<Product>
          table="products"
          cols={[
            ["SKU", (r) => <span className="font-mono">{r.sku}</span>],
            ["Product", (r) => r.name],
            ["Setup family", (r) => r.setup_family],
            [
              "BOM / Routing / Recipe",
              (r) => (
                <div className="flex gap-1">
                  {[r.bom_status, r.routing_status, r.recipe_status].map((s, k) => (
                    <Chip key={k} tone={s === "approved" ? "success" : "warning"}>
                      {s}
                    </Chip>
                  ))}
                </div>
              ),
            ],
            [
              "Routing",
              (r) => (
                <span className="text-[11px] text-muted-foreground">
                  {r.routing
                    .map(
                      (s) =>
                        `${s.name} (${s.machine_type}, ${s.process_min}+${s.setup_min}m${s.min_gap_after ? `, gap ${s.min_gap_after}m` : ""})`,
                    )
                    .join(" → ") || "—"}
                </span>
              ),
            ],
          ]}
        />
      )}
    </>
  );
}

function Simple<T>({
  table,
  cols,
}: {
  table: "shifts" | "maintenance_events" | "changeovers" | "materials" | "products";
  cols: [string, (r: T) => React.ReactNode][];
}) {
  const query = useTable<T>(table);
  const { data = [] } = query;
  if (needsQueryStatus([query])) return <QueryStatus queries={[query]} subject="resources" />;
  return (
    <Panel>
      <div className="overflow-x-auto">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="border-b border-border/60">
              {cols.map(([h]) => (
                <TableHead key={h} className={th}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r, k) => (
              <TableRow key={k} className="border-b border-border/30">
                {cols.map(([h, f]) => (
                  <TableCell key={h} className={td}>
                    {f(r)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

function Machines() {
  const query = useTable<Machine>("machines", { column: "code" });
  const { data = [] } = query;
  const canEdit = useCan("resources", "edit");
  const [edit, setEdit] = useState<Machine | null>(null);
  if (needsQueryStatus([query])) return <QueryStatus queries={[query]} subject="machines" />;
  return (
    <Panel>
      <Table className="w-full">
        <TableHeader>
          <TableRow className="border-b border-border/60">
            {["Machine", "Type", "Line", "Speed", "Status", "Repair ETA", ""].map((h) => (
              <TableHead key={h} className={th}>
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((m) => (
            <TableRow key={m.code} className="border-b border-border/30">
              <TableCell className={td}>
                <div className="font-medium">{m.code}</div>
                <div className="text-[10px] text-muted-foreground">{m.name}</div>
              </TableCell>
              <TableCell className={td}>{m.machine_type}</TableCell>
              <TableCell className={td}>{m.line}</TableCell>
              <TableCell className={td}>
                {Number(m.rate_per_hour).toLocaleString()} units/h
              </TableCell>
              <TableCell className={td}>
                <Chip
                  tone={
                    m.status === "running"
                      ? "success"
                      : m.status === "idle"
                        ? "info"
                        : "destructive"
                  }
                >
                  {m.status}
                </Chip>
              </TableCell>
              <TableCell className={td}>{fmt(m.repair_eta)}</TableCell>
              <TableCell className={td}>
                {canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={ghost}
                    onClick={() => setEdit(m)}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {edit && <MachineModal m={edit} onClose={() => setEdit(null)} />}
    </Panel>
  );
}

function MachineModal({ m, onClose }: { m: Machine; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(updateMachine);
  const [status, setStatus] = useState(m.status);
  const [rate, setRate] = useState(Number(m.rate_per_hour));
  const [eta, setEta] = useState(m.repair_eta?.slice(0, 16) ?? "");
  async function submit() {
    try {
      await save({
        data: {
          code: m.code,
          status: status as "running",
          rate_per_hour: rate,
          repair_eta: eta ? new Date(eta).toISOString() : null,
        },
      });
      toast.success("Machine updated — reschedule to apply");
      qc.invalidateQueries({ queryKey: ["table", "machines"] });
      qc.invalidateQueries({ queryKey: ["preview"] });
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }
  return (
    <Modal open onClose={onClose} title={`Edit ${m.code}`}>
      <div className="space-y-3">
        <label className={lbl}>
          Status
          <select className={inp} value={status} onChange={(e) => setStatus(e.target.value)}>
            {["running", "idle", "down", "maintenance"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className={lbl}>
          Production speed (units / hour)
          <Input
            type="number"
            className={inp}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
        </label>
        <label className={lbl}>
          Repair ETA
          <Input
            type="datetime-local"
            className={inp}
            value={eta}
            onChange={(e) => setEta(e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" className={ghost} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" size="sm" className={btn} onClick={submit}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Workforce() {
  const query = useTable<Operator>("operators", { column: "name" });
  const { data = [] } = query;
  const canEdit = useCan("resources", "edit");
  const qc = useQueryClient();
  const toggle = useServerFn(setOperatorAvailability);
  if (needsQueryStatus([query])) return <QueryStatus queries={[query]} subject="operators" />;
  async function flip(o: Operator) {
    try {
      await toggle({ data: { id: o.id, available: !o.available } });
      qc.invalidateQueries({ queryKey: ["table", "operators"] });
      qc.invalidateQueries({ queryKey: ["preview"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  }
  return (
    <Panel>
      <Table className="w-full">
        <TableHeader>
          <TableRow className="border-b border-border/60">
            {["Operator", "Skills / certifications", "Shift", "Availability"].map((h) => (
              <TableHead key={h} className={th}>
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((o) => (
            <TableRow key={o.id} className="border-b border-border/30">
              <TableCell className={td}>{o.name}</TableCell>
              <TableCell className={td}>
                <div className="flex flex-wrap gap-1">
                  {o.skills.map((s) => (
                    <Chip key={s} tone="info">
                      {s}
                    </Chip>
                  ))}
                </div>
              </TableCell>
              <TableCell className={td}>{o.shift_name}</TableCell>
              <TableCell className={td}>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!canEdit}
                  onClick={() => flip(o)}
                >
                  <Chip tone={o.available ? "success" : "destructive"}>
                    {o.available ? "available" : "absent"}
                  </Chip>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}
