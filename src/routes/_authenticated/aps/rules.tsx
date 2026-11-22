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
import { Plus, SlidersHorizontal, Trash2, Pencil } from "lucide-react";
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
  Empty,
} from "@/components/aps/kit";
import { useCan, useTable } from "@/lib/aps/client";
import { deleteRule, saveRule } from "@/lib/aps/aps.functions";

export const Route = createFileRoute("/_authenticated/aps/rules")({
  head: () => ({
    meta: [
      { title: "Planning Rules · APS" },
      {
        name: "description",
        content: "Sequencing, conflict handling and changeover optimization rules.",
      },
    ],
  }),
  component: Rules,
});

type RuleRow = {
  id: string;
  name: string;
  description: string | null;
  criterion: string;
  direction: string;
  rule_priority: number;
  conflict_policy: string | null;
  active: boolean;
  updated_by: string | null;
  updated_at: string;
  code?: string | null;
};
const CRIT: Record<string, string> = {
  due_date: "Due date",
  priority: "Production order priority",
  processing_time: "Processing time",
  changeover: "Changeover time (group setups)",
};
const POLICY: Record<string, string> = {
  protect_due_dates: "Protect delivery dates over changeover savings",
  minimize_changeover: "Minimize changeovers even if dates slip",
};

function Rules() {
  const rulesQuery = useTable<RuleRow>("business_rules", { column: "rule_priority" });
  const logQuery = useTable<{
    id: string;
    at: string;
    actor: string;
    action: string;
    entity: string;
    entity_id: string;
    reason: string | null;
    before_value: Record<string, unknown> | null;
    after_value: Record<string, unknown> | null;
  }>("audit_log", { column: "at", ascending: false }, "business-rules");
  const { data: rules = [] } = rulesQuery;
  const { data: log = [] } = logQuery;
  const history = log.filter((l) => l.entity === "business_rule");
  const canCreate = useCan("business-rules", "create");
  const canEdit = useCan("business-rules", "edit");
  const canDelete = useCan("business-rules", "delete");
  const [edit, setEdit] = useState<Partial<RuleRow> | null>(null);
  const qc = useQueryClient();
  const save = useServerFn(saveRule);
  const del = useServerFn(deleteRule);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["table"] });
    qc.invalidateQueries({ queryKey: ["preview"] });
  };

  async function toggle(r: RuleRow) {
    try {
      await save({
        data: {
          id: r.id,
          name: r.name,
          description: r.description ?? "",
          criterion: r.criterion as "due_date",
          direction: r.direction as "asc",
          rule_priority: r.rule_priority,
          conflict_policy: r.conflict_policy as null,
          active: !r.active,
          reason: r.active ? "Deactivated" : "Activated",
        },
      });
      refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }
  async function remove(r: RuleRow) {
    if (!confirm(`Delete rule "${r.name}"?`)) return;
    try {
      await del({ data: { id: r.id } });
      refresh();
      toast.success("Rule deleted");
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  const queries = [rulesQuery, logQuery];
  if (needsQueryStatus(queries))
    return <QueryStatus queries={queries} subject="planning rules and history" />;

  return (
    <>
      <PageHead
        icon={<SlidersHorizontal className="h-6 w-6 text-primary" />}
        title="Planning Rules"
        desc="APS planning and scheduling rules (codes APS-PLAN-…), applied in priority order when sequencing orders, resolving conflicts and optimizing changeovers. Order orchestration and sourcing rules are owned by MES Command Central."
      >
        {canCreate && (
          <Button
            type="button"
            size="sm"
            className={btn}
            onClick={() =>
              setEdit({
                criterion: "due_date",
                direction: "asc",
                rule_priority: rules.length + 1,
                active: true,
                conflict_policy: null,
              })
            }
          >
            <Plus className="h-3.5 w-3.5" />
            New rule
          </Button>
        )}
      </PageHead>
      <Panel>
        <Table className="w-full">
          <TableHeader>
            <TableRow className="border-b border-border/60">
              {["#", "Rule", "Criterion", "Conflict handling", "Active", "Last change", ""].map(
                (h) => (
                  <TableHead key={h} className={th}>
                    {h}
                  </TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((r) => (
              <TableRow key={r.id} className="border-b border-border/30">
                <TableCell className={`${td} font-mono text-primary`}>{r.rule_priority}</TableCell>
                <TableCell className={td}>
                  <div className="font-mono text-[10px] text-primary">{r.code}</div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-[11px] text-muted-foreground">{r.description}</div>
                </TableCell>
                <TableCell className={td}>
                  {CRIT[r.criterion]} <span className="text-muted-foreground">({r.direction})</span>
                </TableCell>
                <TableCell className={td}>
                  {r.conflict_policy ? POLICY[r.conflict_policy] : "—"}
                </TableCell>
                <TableCell className={td}>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!canEdit}
                    onClick={() => toggle(r)}
                  >
                    <Chip tone={r.active ? "success" : "muted"}>
                      {r.active ? "active" : "inactive"}
                    </Chip>
                  </Button>
                </TableCell>
                <TableCell className={`${td} text-[11px] text-muted-foreground`}>
                  {r.updated_by ?? "seed"}
                  <div>{fmt(r.updated_at)}</div>
                </TableCell>
                <TableCell className={td}>
                  <div className="flex gap-1">
                    {canEdit && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={ghost}
                        aria-label={`Edit ${r.name}`}
                        onClick={() => setEdit(r)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={ghost}
                        aria-label={`Delete ${r.name}`}
                        onClick={() => remove(r)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      <Panel title="Rule change history">
        <div className="space-y-1.5">
          {history.map((h) => (
            <div key={h.id} className="rounded-lg border border-border/40 px-2 py-1.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="info">{h.action}</Chip>
                <span className="font-medium">{h.entity_id}</span>
                <span className="text-muted-foreground">by {h.actor}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{fmt(h.at)}</span>
              </div>
              {h.before_value && h.after_value && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {diffText(h.before_value, h.after_value)}
                </div>
              )}
              {h.reason && <div className="mt-1 text-[11px]">Reason: {h.reason}</div>}
            </div>
          ))}
          {!history.length && <Empty>No rule changes yet.</Empty>}
        </div>
      </Panel>
      {edit && (
        <RuleModal
          rule={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            refresh();
            setEdit(null);
          }}
        />
      )}
    </>
  );
}

function diffText(a: Record<string, unknown>, b: Record<string, unknown>) {
  return (
    ["name", "criterion", "direction", "rule_priority", "conflict_policy", "active"]
      .filter((k) => a[k] !== b[k])
      .map((k) => `${k}: ${String(a[k])} → ${String(b[k])}`)
      .join(" · ") || "no field changes"
  );
}

function RuleModal({
  rule,
  onClose,
  onSaved,
}: {
  rule: Partial<RuleRow>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(saveRule);
  const [f, setF] = useState({
    name: rule.name ?? "",
    description: rule.description ?? "",
    criterion: rule.criterion ?? "due_date",
    direction: rule.direction ?? "asc",
    rule_priority: rule.rule_priority ?? 1,
    conflict_policy: rule.conflict_policy ?? "protect_due_dates",
    active: rule.active ?? true,
    reason: "",
  });
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      await save({
        data: {
          ...f,
          id: rule.id,
          criterion: f.criterion as "due_date",
          direction: f.direction as "asc",
          conflict_policy:
            f.criterion === "changeover" ? (f.conflict_policy as "protect_due_dates") : null,
        },
      });
      toast.success("Rule saved");
      onSaved();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={rule.id ? "Edit planning rule" : "New planning rule"}>
      <div className="space-y-3">
        <label className={lbl}>
          Name
          <Input
            className={inp}
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
        </label>
        <label className={lbl}>
          Description
          <Input
            className={inp}
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
          />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className={`${lbl} col-span-2`}>
            Criterion
            <select
              className={inp}
              value={f.criterion}
              onChange={(e) => setF({ ...f, criterion: e.target.value })}
            >
              {Object.entries(CRIT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className={lbl}>
            Rule priority
            <Input
              type="number"
              min={1}
              max={99}
              className={inp}
              value={f.rule_priority}
              onChange={(e) => setF({ ...f, rule_priority: Number(e.target.value) })}
            />
          </label>
        </div>
        {f.criterion !== "changeover" ? (
          <label className={lbl}>
            Direction
            <select
              className={inp}
              value={f.direction}
              onChange={(e) => setF({ ...f, direction: e.target.value })}
            >
              <option value="asc">Ascending (earliest / smallest first)</option>
              <option value="desc">Descending</option>
            </select>
          </label>
        ) : (
          <label className={lbl}>
            When delivery dates conflict with changeover savings
            <select
              className={inp}
              value={f.conflict_policy}
              onChange={(e) => setF({ ...f, conflict_policy: e.target.value })}
            >
              {Object.entries(POLICY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={f.active}
            onChange={(e) => setF({ ...f, active: e.target.checked })}
          />
          Active
        </label>
        <label className={lbl}>
          Reason for change
          <Input
            className={inp}
            value={f.reason}
            onChange={(e) => setF({ ...f, reason: e.target.value })}
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
            disabled={busy || f.name.trim().length < 2}
            onClick={submit}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
