// APS planning engine: feasibility, operation time, capacity, finite-capacity
// scheduling with changeover optimization, conflict detection and version diff.
// Pure functions — no I/O — so the same logic runs in server functions and tests.

export type RoutingStep = {
  seq: number;
  name: string;
  machine_type: string;
  process_min: number; // fixed processing time from RMS recipe (per batch)
  setup_min: number; // setup time from routing
  min_gap_after: number; // minimum time before the next dependent operation
  skill: string;
  depends_on: number[];
};
export type BomLine = { material: string; qty_per_unit: number };
export type Product = {
  sku: string; name: string; setup_family: string;
  bom_status: string; routing_status: string; recipe_status: string; recipe_required: boolean;
  bom: BomLine[]; routing: RoutingStep[];
  bom_revision?: string | null; routing_revision?: string | null; recipe_revision?: string | null;
  quality_hold?: boolean; quality_note?: string | null;
};
export type Material = { code: string; name: string; uom: string; on_hand: number; on_hold: number; expected_qty: number; expected_at: string | null; status: string; quality_status?: string };
export type Machine = { code: string; name: string; machine_type: string; line: string; rate_per_hour: number; status: string; repair_eta: string | null };
export type Shift = { name: string; start_hour: number; end_hour: number; break_start_hour: number | null; break_minutes: number; days?: number[] };
export type Operator = { id: string; name: string; skills: string[]; shift_name: string; available: boolean };
export type Maintenance = { machine_code: string; kind: string; starts_at: string; ends_at: string; note?: string | null };
export type Changeover = { from_family: string; to_family: string; minutes: number };
export type Order = { id: string; po_number: string; sku: string; quantity: number; due_date: string; priority: number; status: string };
export type Rule = { id: string; name: string; criterion: string; direction: string; rule_priority: number; conflict_policy: string | null; active: boolean };

export type PlantData = {
  products: Product[]; materials: Material[]; machines: Machine[]; shifts: Shift[];
  operators: Operator[]; maintenance: Maintenance[]; changeovers: Changeover[];
  /** Plant offset from UTC in minutes; shift hours are local plant time. */
  tzOffsetMin?: number;
};

export type FeasibilityStatus = "feasible" | "conditional" | "not_feasible";
export type Issue = { check: string; severity: "blocking" | "condition" | "info"; message: string };
export type Feasibility = { orderId: string; po: string; status: FeasibilityStatus; issues: Issue[]; missingMaterials: { code: string; short: number; uom: string }[]; earliestStart: string | null };

export type ScheduleItem = {
  key: string; orderId: string; po: string; sku: string; product: string; family: string;
  seq: number; op: string; machine: string; line: string; operator: string | null;
  start: string; end: string; process_min: number; setup_min: number; changeover_min: number;
  qty: number; due: string;
};
export type ConflictType = "material" | "machine" | "operator" | "shift" | "capacity" | "dependency" | "min_gap" | "maintenance" | "delivery" | "changeover";
export type Conflict = { id: string; type: ConflictType; severity: "high" | "medium" | "low"; orders: string[]; operation: string | null; resource: string | null; at: string; reason: string; impact: string; rule: string | null };
export type AppliedRule = { rule: string; effect: string };
export type MachineCapacity = { machine: string; name: string; type: string; line: string; status: string; rate_per_hour: number; calendar_min: number; available_min: number; downtime_min: number; break_min: number; used_min: number; changeover_min: number; remaining_min: number; utilization: number; capacity_units: number };
export type SkillCapacity = { skill: string; operators: number; available_min: number; used_min: number };
export type Metrics = { orders_scheduled: number; orders_excluded: number; on_time: number; late: number; total_changeover_min: number; total_setup_min: number; makespan_end: string | null; avg_utilization: number };
export type ScheduleResult = { items: ScheduleItem[]; conflicts: Conflict[]; rulesApplied: AppliedRule[]; feasibility: Feasibility[]; metrics: Metrics; capacity: MachineCapacity[]; skills: SkillCapacity[]; sequence: string[] };

const MIN = 60_000;
export const HORIZON_DAYS = 7;
type Interval = { s: number; e: number; kind?: string };

// ---------- Time components (FR-05 / FR-08) ----------
export function changeoverMinutes(from: string | null, to: string, matrix: Changeover[]): number {
  if (!from || from === to) return 0;
  return matrix.find((c) => c.from_family === from && c.to_family === to)?.minutes ?? 20;
}
/** Execution time of one routing step on one machine: RMS processing + run time at machine speed + setup + changeover. */
export function operationMinutes(step: RoutingStep, qty: number, machine: Machine, changeover = 0) {
  const run = machine.rate_per_hour > 0 ? (qty / machine.rate_per_hour) * 60 : 0;
  const process = Math.round(step.process_min + run);
  return { process, setup: step.setup_min, changeover, total: process + step.setup_min + changeover };
}
/** Expected total execution time of an order using the fastest suitable machine per step (dependencies sequential). */
export function orderExecutionMinutes(order: Order, product: Product, machines: Machine[]): number {
  let total = 0;
  for (const step of product.routing) {
    const options = machines.filter((m) => m.machine_type === step.machine_type);
    if (!options.length) continue;
    total += Math.min(...options.map((m) => operationMinutes(step, order.quantity, m).total)) + step.min_gap_after;
  }
  return total;
}

// ---------- Calendar (FR-07) ----------
export function workingWindows(shifts: Shift[], start: number, days = HORIZON_DAYS, tzOffsetMin = 0): Interval[] {
  const out: Interval[] = [];
  const off = tzOffsetMin * MIN;
  const day0 = new Date(start + off); day0.setUTCHours(0, 0, 0, 0);
  for (let d = -1; d <= days; d++) {
    const local = day0.getTime() + d * 1440 * MIN;
    const dow = new Date(local).getUTCDay();
    const base = local - off;
    for (const sh of shifts) {
      if (sh.days && !sh.days.includes(dow)) continue;
      const s = base + sh.start_hour * 60 * MIN;
      const e = base + (sh.end_hour > sh.start_hour ? sh.end_hour : sh.end_hour + 24) * 60 * MIN;
      if (sh.break_start_hour != null && sh.break_minutes > 0) {
        const bs = base + sh.break_start_hour * 60 * MIN;
        const be = bs + sh.break_minutes * MIN;
        if (bs > s && be < e) { out.push({ s, e: bs, kind: sh.name }, { s: be, e, kind: sh.name }); continue; }
      }
      out.push({ s, e, kind: sh.name });
    }
  }
  const end = start + days * 1440 * MIN;
  return out.filter((w) => w.e > start && w.s < end).map((w) => ({ ...w, s: Math.max(w.s, start), e: Math.min(w.e, end) })).sort((a, b) => a.s - b.s);
}
function overlap(a: Interval, b: Interval) { return Math.max(0, Math.min(a.e, b.e) - Math.max(a.s, b.s)); }

export function machineBlocks(m: Machine, maint: Maintenance[], now: number, horizonEnd: number): Interval[] {
  const blocks: Interval[] = maint.filter((x) => x.machine_code === m.code).map((x) => ({ s: Date.parse(x.starts_at), e: Date.parse(x.ends_at), kind: x.kind }));
  if (m.status === "down" || m.status === "maintenance") {
    const eta = m.repair_eta ? Date.parse(m.repair_eta) : horizonEnd;
    blocks.push({ s: now, e: Math.max(eta, now), kind: m.status === "down" ? "failure" : "maintenance" });
  }
  return blocks.sort((a, b) => a.s - b.s);
}

/** Earliest start >= t where [start, start+dur] fits inside one working window without hitting any block. */
function findSlot(t: number, dur: number, windows: Interval[], blocks: Interval[]): { start: number; spansShift: boolean } | null {
  const longest = Math.max(0, ...windows.map((w) => w.e - w.s));
  const spans = dur * MIN > longest;
  for (const w of windows) {
    if (w.e <= t) continue;
    let s = Math.max(t, w.s);
    for (let guard = 0; guard < 200; guard++) {
      const e = s + dur * MIN;
      if (!spans && e > w.e) break;
      const hit = blocks.find((b) => b.s < e && b.e > s);
      if (!hit) return { start: s, spansShift: spans };
      s = hit.e;
      if (s >= w.e) break;
    }
  }
  return null;
}

// ---------- Capacity (FR-07) ----------
export function machineCapacity(data: PlantData, start: number, items: ScheduleItem[] = []): MachineCapacity[] {
  const windows = workingWindows(data.shifts, start, HORIZON_DAYS, data.tzOffsetMin ?? 0);
  const horizonEnd = start + HORIZON_DAYS * 1440 * MIN;
  const shiftSpan = data.shifts.reduce((a, s) => a + ((s.end_hour > s.start_hour ? s.end_hour : s.end_hour + 24) - s.start_hour) * 60, 0);
  const calendar = shiftSpan * HORIZON_DAYS;
  return data.machines.map((m) => {
    const working = windows.reduce((a, w) => a + (w.e - w.s) / MIN, 0);
    const blocks = machineBlocks(m, data.maintenance, start, horizonEnd);
    const down = windows.reduce((a, w) => a + blocks.reduce((b, x) => b + overlap(w, x), 0) / MIN, 0);
    const mine = items.filter((i) => i.machine === m.code);
    const used = mine.reduce((a, i) => a + (Date.parse(i.end) - Date.parse(i.start)) / MIN, 0);
    const co = mine.reduce((a, i) => a + i.changeover_min + i.setup_min, 0);
    const available = Math.max(0, Math.round(working - down));
    return {
      machine: m.code, name: m.name, type: m.machine_type, line: m.line, status: m.status, rate_per_hour: m.rate_per_hour,
      calendar_min: Math.round(calendar), break_min: Math.max(0, Math.round(calendar - working)), downtime_min: Math.round(down),
      available_min: available, used_min: Math.round(used), changeover_min: Math.round(co),
      remaining_min: Math.max(0, Math.round(available - used)), utilization: available ? Math.round((used / available) * 100) : 0,
      capacity_units: Math.round(((available - co) / 60) * m.rate_per_hour),
    };
  });
}
export function skillCapacity(data: PlantData, start: number, items: ScheduleItem[] = []): SkillCapacity[] {
  const skills = Array.from(new Set(data.operators.flatMap((o) => o.skills)));
  return skills.map((skill) => {
    const ops = data.operators.filter((o) => o.available && o.skills.includes(skill));
    const avail = ops.reduce((a, o) => {
      const sh = data.shifts.find((s) => s.name === o.shift_name);
      if (!sh) return a;
      return a + workingWindows([sh], start, HORIZON_DAYS, data.tzOffsetMin ?? 0).reduce((b, w) => b + (w.e - w.s) / MIN, 0);
    }, 0);
    const opNames = new Set(ops.map((o) => o.name));
    const used = items.filter((i) => i.operator && opNames.has(i.operator)).reduce((a, i) => a + (Date.parse(i.end) - Date.parse(i.start)) / MIN, 0);
    return { skill, operators: ops.length, available_min: Math.round(avail), used_min: Math.round(used) };
  });
}

// ---------- Feasibility (FR-03) ----------
export function assessFeasibility(order: Order, data: PlantData, now: number): Feasibility {
  const issues: Issue[] = [];
  const missing: Feasibility["missingMaterials"] = [];
  let earliest: number | null = null;
  const p = data.products.find((x) => x.sku === order.sku);
  if (!p) issues.push({ check: "BOM", severity: "blocking", message: `No product master for ${order.sku}` });
  else {
    if (p.bom_status !== "approved" || !p.bom.length) issues.push({ check: "BOM", severity: "blocking", message: `No approved bill of materials (status: ${p.bom_status})` });
    if (p.routing_status !== "approved" || !p.routing.length) issues.push({ check: "Routing", severity: "blocking", message: `No approved routing (status: ${p.routing_status})` });
    if (p.recipe_required && p.recipe_status !== "approved") issues.push({ check: "Recipe", severity: "blocking", message: `Recipe not approved (status: ${p.recipe_status})` });
    if (p.quality_hold) issues.push({ check: "Quality", severity: "blocking", message: `Product on quality hold${p.quality_note ? `: ${p.quality_note}` : ""}` });
    for (const line of p.bom) {
      const m = data.materials.find((x) => x.code === line.material);
      const req = order.quantity * line.qty_per_unit;
      if (!m) { issues.push({ check: "Material", severity: "blocking", message: `Material ${line.material} not found in WMS` }); missing.push({ code: line.material, short: req, uom: "" }); continue; }
      const qcBlocked = m.quality_status === "hold" || m.quality_status === "rejected";
      if (qcBlocked) issues.push({ check: "Quality", severity: "condition", message: `${m.name} is on quality ${m.quality_status} — stock not usable until released` });
      const avail = m.status === "blocked" || qcBlocked ? 0 : m.on_hand - m.on_hold;
      if (avail >= req) continue;
      const exp = m.expected_qty && m.expected_at ? m.expected_qty : 0;
      if (avail + exp >= req) {
        issues.push({ check: "Material", severity: "condition", message: `${m.name}: ${fmtNum(req - avail)} ${m.uom} short now, covered by receipt on ${new Date(m.expected_at!).toISOString().slice(0, 16).replace("T", " ")}` });
        earliest = Math.max(earliest ?? 0, Date.parse(m.expected_at!));
      } else {
        issues.push({ check: "Material", severity: "blocking", message: `${m.name}: short by ${fmtNum(req - avail - exp)} ${m.uom}` });
        missing.push({ code: m.code, short: req - avail - exp, uom: m.uom });
      }
    }
    for (const step of p.routing) {
      const ms = data.machines.filter((m) => m.machine_type === step.machine_type);
      if (!ms.length) { issues.push({ check: "Machine", severity: "blocking", message: `No ${step.machine_type} machine for "${step.name}"` }); continue; }
      const up = ms.filter((m) => m.status !== "down" && m.status !== "maintenance");
      if (!up.length) {
        const etas = ms.map((m) => m.repair_eta).filter(Boolean) as string[];
        if (etas.length) issues.push({ check: "Machine Status", severity: "condition", message: `All ${step.machine_type} machines down; earliest repair ${etas.sort()[0]!.slice(0, 16).replace("T", " ")}` });
        else issues.push({ check: "Machine Status", severity: "blocking", message: `All ${step.machine_type} machines down with no repair estimate` });
      } else if (up.length < ms.length) {
        issues.push({ check: "Machine Status", severity: "info", message: `${ms.filter((m) => !up.includes(m)).map((m) => m.code).join(", ")} unavailable — ${up.map((m) => m.code).join(", ")} can run "${step.name}"` });
      }
      const ops = data.operators.filter((o) => o.available && o.skills.includes(step.skill));
      if (!ops.length) issues.push({ check: "Operator", severity: "blocking", message: `No available operator qualified for ${step.skill}` });
      else if (!ops.some((o) => data.shifts.some((s) => s.name === o.shift_name))) issues.push({ check: "Shift", severity: "blocking", message: `Qualified ${step.skill} operators have no shift assigned` });
    }
    const maint = data.maintenance.filter((x) => x.kind === "planned" && p.routing.some((r) => data.machines.some((m) => m.code === x.machine_code && m.machine_type === r.machine_type)));
    for (const x of maint) issues.push({ check: "Machine Status", severity: "info", message: `Planned maintenance on ${x.machine_code} ${x.starts_at.slice(0, 16).replace("T", " ")} → ${x.ends_at.slice(11, 16)}` });
  }
  if (!data.shifts.length) issues.push({ check: "Shift", severity: "blocking", message: "No working shifts defined" });
  const status: FeasibilityStatus = issues.some((i) => i.severity === "blocking") ? "not_feasible" : issues.some((i) => i.severity === "condition") ? "conditional" : "feasible";
  void now;
  return { orderId: order.id, po: order.po_number, status, issues, missingMaterials: missing, earliestStart: earliest ? new Date(earliest).toISOString() : null };
}

// ---------- Sequencing with business rules (FR-01 / FR-10 / FR-12) ----------
export function sequenceOrders(orders: Order[], data: PlantData, rules: Rule[], start: number, applied: AppliedRule[] = []): Order[] {
  const active = rules.filter((r) => r.active).sort((a, b) => a.rule_priority - b.rule_priority);
  const product = (o: Order) => data.products.find((p) => p.sku === o.sku)!;
  const est = new Map(orders.map((o) => [o.id, bottleneckMinutes(o, product(o), data.machines)]));
  const cmp = (a: Order, b: Order) => {
    for (const r of active) {
      const dir = r.direction === "desc" ? -1 : 1;
      let d = 0;
      if (r.criterion === "due_date") d = Date.parse(a.due_date) - Date.parse(b.due_date);
      else if (r.criterion === "priority") d = a.priority - b.priority;
      else if (r.criterion === "processing_time") d = est.get(a.id)! - est.get(b.id)!;
      if (d !== 0) return d * dir;
    }
    return a.po_number.localeCompare(b.po_number);
  };
  const coRule = active.find((r) => r.criterion === "changeover");
  const remaining = [...orders];
  const out: Order[] = [];
  let last: string | null = null;
  let clock = start;
  while (remaining.length) {
    remaining.sort(cmp);
    let pick = remaining[0]!;
    if (coRule && last && product(pick).setup_family !== last) {
      const cand = remaining.find((o) => product(o).setup_family === last);
      if (cand) {
        const saved = changeoverMinutes(last, product(pick).setup_family, data.changeovers);
        const firstLate = clock + (est.get(cand.id)! + est.get(pick.id)!) * MIN > Date.parse(pick.due_date);
        if (coRule.conflict_policy === "minimize_changeover" || !firstLate) {
          applied.push({ rule: coRule.name, effect: `${cand.po_number} sequenced before ${pick.po_number} to stay on ${last} setup (avoids ${saved} min changeover)` });
          pick = cand;
        } else {
          applied.push({ rule: coRule.name, effect: `Kept ${pick.po_number} ahead of ${cand.po_number}: grouping would miss ${pick.po_number}'s delivery date (policy: protect due dates)` });
        }
      }
    }
    remaining.splice(remaining.indexOf(pick), 1);
    out.push(pick);
    clock += est.get(pick.id)! * MIN;
    last = product(pick).setup_family;
  }
  return out;
}
function bottleneckMinutes(o: Order, p: Product, machines: Machine[]) {
  let max = 0;
  for (const step of p.routing) {
    const opts = machines.filter((m) => m.machine_type === step.machine_type);
    if (opts.length) max = Math.max(max, Math.min(...opts.map((m) => operationMinutes(step, o.quantity, m).total)));
  }
  return max;
}

// ---------- Finite capacity scheduling (FR-09) ----------
export function generateSchedule(orders: Order[], data: PlantData, rules: Rule[], startIso: string): ScheduleResult {
  const start = Date.parse(startIso);
  const horizonEnd = start + HORIZON_DAYS * 1440 * MIN;
  const windows = workingWindows(data.shifts, start, HORIZON_DAYS, data.tzOffsetMin ?? 0);
  const conflicts: Conflict[] = [];
  const applied: AppliedRule[] = [];
  const add = (c: Omit<Conflict, "id">) => conflicts.push({ ...c, id: `C${conflicts.length + 1}` });

  const open = orders.filter((o) => !["cancelled", "completed", "closed"].includes(o.status));
  const feasibility = open.map((o) => assessFeasibility(o, data, start));
  const schedulable = open.filter((o) => feasibility.find((f) => f.orderId === o.id)!.status !== "not_feasible");
  for (const f of feasibility.filter((x) => x.status === "not_feasible")) {
    const o = open.find((x) => x.id === f.orderId)!;
    add({ type: f.issues.some((i) => i.check === "Material" && i.severity === "blocking") ? "material" : "capacity", severity: "high", orders: [o.po_number], operation: null, resource: null, at: o.due_date, reason: `Not feasible: ${f.issues.filter((i) => i.severity === "blocking").map((i) => i.message).join("; ")}`, impact: `Order excluded from schedule — delivery on ${o.due_date.slice(0, 10)} at risk`, rule: null });
  }

  const sequence = sequenceOrders(schedulable, data, rules, start, applied);
  const active = rules.filter((r) => r.active).sort((a, b) => a.rule_priority - b.rule_priority);
  applied.unshift(...active.filter((x) => x.criterion !== "changeover").map((r) => ({ rule: r.name, effect: `Sequencing criterion #${r.rule_priority}: ${r.criterion.replace("_", " ")} (${r.direction})` })));

  const machineState = new Map(data.machines.map((m) => [m.code, { busy: [] as Interval[], family: null as string | null, blocks: machineBlocks(m, data.maintenance, start, horizonEnd) }]));
  const operatorBusy = new Map(data.operators.map((o) => [o.id, [] as Interval[]]));
  const stock = new Map(data.materials.map((m) => [m.code, { now: m.status === "blocked" ? 0 : m.on_hand - m.on_hold, exp: m.expected_qty ?? 0, at: m.expected_at ? Date.parse(m.expected_at) : null }]));
  const items: ScheduleItem[] = [];
  const reportedDown = new Set<string>();

  for (const o of sequence) {
    const p = data.products.find((x) => x.sku === o.sku)!;
    // Material allocation in sequence order
    let matReady = start;
    for (const line of p.bom) {
      const s = stock.get(line.material);
      const req = o.quantity * line.qty_per_unit;
      if (!s) continue;
      if (s.now >= req) { s.now -= req; continue; }
      const short = req - s.now;
      if (s.at && s.exp >= short) {
        matReady = Math.max(matReady, s.at); s.exp -= short; s.now = 0;
        add({ type: "material", severity: "medium", orders: [o.po_number], operation: null, resource: line.material, at: new Date(s.at).toISOString(), reason: `${line.material} short by ${fmtNum(short)}; waiting for receipt`, impact: `Start delayed until ${new Date(s.at).toISOString().slice(0, 16).replace("T", " ")}`, rule: null });
      } else {
        s.now = 0;
        add({ type: "material", severity: "high", orders: [o.po_number], operation: null, resource: line.material, at: start ? new Date(start).toISOString() : "", reason: `${line.material} insufficient after earlier orders consumed stock (short ${fmtNum(short)})`, impact: "Order scheduled but cannot complete without additional material", rule: active[0]?.name ?? null });
      }
    }

    const ends = new Map<number, { end: number; gap: number }>();
    let orderEnd = start;
    for (const step of [...p.routing].sort((a, b) => a.seq - b.seq)) {
      let earliest = matReady;
      for (const d of step.depends_on) { const dep = ends.get(d); if (dep) earliest = Math.max(earliest, dep.end + dep.gap * MIN); }
      const options = data.machines.filter((m) => m.machine_type === step.machine_type);
      const qualified = data.operators.filter((op) => op.available && op.skills.includes(step.skill));
      let best: { m: Machine; s: number; e: number; t: ReturnType<typeof operationMinutes>; op: Operator | null; spans: boolean } | null = null;
      for (const m of options) {
        const st = machineState.get(m.code)!;
        const t = operationMinutes(step, o.quantity, m, changeoverMinutes(st.family, p.setup_family, data.changeovers));
        let tt = earliest;
        for (let i = 0; i < 60; i++) {
          const slot = findSlot(tt, t.total, windows, [...st.blocks, ...st.busy]);
          if (!slot) break;
          const s = slot.start, e = s + t.total * MIN;
          const op = qualified.find((q) => {
            const sh = data.shifts.find((x) => x.name === q.shift_name);
            if (!sh) return false;
            const inShift = workingWindows([sh], start, HORIZON_DAYS, data.tzOffsetMin ?? 0).some((w) => s >= w.s && (slot.spansShift || e <= w.e) && s < w.e);
            return inShift && !operatorBusy.get(q.id)!.some((b) => b.s < e && b.e > s);
          }) ?? null;
          if (op || !qualified.length) {
            if (!best || e < best.e) best = { m, s, e, t, op, spans: slot.spansShift };
            break;
          }
          tt = s + 15 * MIN;
        }
      }
      if (!best) {
        add({ type: "capacity", severity: "high", orders: [o.po_number], operation: step.name, resource: step.machine_type, at: new Date(earliest).toISOString(), reason: `No capacity on any ${step.machine_type} within the ${HORIZON_DAYS}-day horizon`, impact: "Operation and all following operations not scheduled", rule: null });
        break;
      }
      const st = machineState.get(best.m.code)!;
      st.busy.push({ s: best.s, e: best.e }); st.family = p.setup_family;
      if (best.op) operatorBusy.get(best.op.id)!.push({ s: best.s, e: best.e });
      ends.set(step.seq, { end: best.e, gap: step.min_gap_after });
      orderEnd = Math.max(orderEnd, best.e);
      items.push({ key: `${o.id}:${step.seq}`, orderId: o.id, po: o.po_number, sku: o.sku, product: p.name, family: p.setup_family, seq: step.seq, op: step.name, machine: best.m.code, line: best.m.line, operator: best.op?.name ?? null, start: new Date(best.s).toISOString(), end: new Date(best.e).toISOString(), process_min: best.t.process, setup_min: best.t.setup, changeover_min: best.t.changeover, qty: o.quantity, due: o.due_date });

      if (!qualified.length) add({ type: "operator", severity: "high", orders: [o.po_number], operation: step.name, resource: step.skill, at: new Date(best.s).toISOString(), reason: `No available operator qualified for ${step.skill}`, impact: "Operation cannot be staffed", rule: null });
      if (best.spans) add({ type: "shift", severity: "medium", orders: [o.po_number], operation: step.name, resource: best.m.code, at: new Date(best.s).toISOString(), reason: `Operation needs ${best.t.total} min, longer than any single shift window`, impact: "Runs across shift change / break; requires handover", rule: null });
      const blocker = st.blocks.find((b) => b.s < best!.s && b.e > earliest && b.e <= best!.s + 1);
      if (blocker && best.s > earliest) {
        const isFail = blocker.kind === "failure";
        if (!(isFail && reportedDown.has(best.m.code))) {
          add({ type: isFail ? "machine" : "maintenance", severity: "medium", orders: [o.po_number], operation: step.name, resource: best.m.code, at: new Date(blocker.s).toISOString(), reason: `${best.m.code} ${isFail ? "down (failure)" : "in planned maintenance"} until ${new Date(blocker.e).toISOString().slice(0, 16).replace("T", " ")}`, impact: `Operation delayed ${Math.round((best.s - earliest) / MIN)} min`, rule: null });
          if (isFail) reportedDown.add(best.m.code);
        }
      }
      for (const m of options.filter((x) => x.code !== best!.m.code && (x.status === "down" || x.status === "maintenance"))) {
        if (reportedDown.has(m.code)) continue;
        reportedDown.add(m.code);
        add({ type: "machine", severity: "low", orders: [o.po_number], operation: step.name, resource: m.code, at: new Date(start).toISOString(), reason: `${m.code} is ${m.status}${m.repair_eta ? ` (repair ETA ${m.repair_eta.slice(0, 16).replace("T", " ")})` : ""}`, impact: `Work routed to ${best.m.code}; reduced ${m.machine_type} capacity`, rule: null });
      }
    }
    const due = Date.parse(o.due_date);
    if (orderEnd > due) {
      const lateH = Math.round(((orderEnd - due) / 3_600_000) * 10) / 10;
      add({ type: "delivery", severity: "high", orders: [o.po_number], operation: null, resource: null, at: new Date(orderEnd).toISOString(), reason: `Completes ${new Date(orderEnd).toISOString().slice(0, 16).replace("T", " ")}, after due date`, impact: `Late by ${lateH} h`, rule: active[0]?.name ?? null });
      const co = items.filter((i) => i.orderId === o.id).reduce((a, i) => a + i.changeover_min, 0);
      if (co > 0) add({ type: "changeover", severity: "medium", orders: [o.po_number], operation: null, resource: null, at: new Date(orderEnd).toISOString(), reason: `${co} min of changeovers precede this late order`, impact: "Changeover time contributes to the delivery delay", rule: active.find((r) => r.criterion === "changeover")?.name ?? null });
    }
  }

  conflicts.push(...validateSchedule(items, data).map((c, i) => ({ ...c, id: `V${i + 1}` })));
  const capacity = machineCapacity(data, start, items);
  for (const c of capacity) if (c.available_min > 0 && c.used_min > c.available_min) add({ type: "capacity", severity: "high", orders: [], operation: null, resource: c.machine, at: new Date(start).toISOString(), reason: `${c.machine} loaded ${c.used_min} min vs ${c.available_min} min available`, impact: "Capacity overload", rule: null });
  const lateOrders = new Set(conflicts.filter((c) => c.type === "delivery").flatMap((c) => c.orders));
  const scheduledOrders = new Set(items.map((i) => i.orderId));
  const used = capacity.filter((c) => c.available_min > 0);
  return {
    items, conflicts, rulesApplied: applied, feasibility, capacity, skills: skillCapacity(data, start, items),
    sequence: sequence.map((o) => o.po_number),
    metrics: {
      orders_scheduled: scheduledOrders.size, orders_excluded: open.length - scheduledOrders.size,
      on_time: scheduledOrders.size - lateOrders.size, late: lateOrders.size,
      total_changeover_min: items.reduce((a, i) => a + i.changeover_min, 0),
      total_setup_min: items.reduce((a, i) => a + i.setup_min, 0),
      makespan_end: items.length ? new Date(Math.max(...items.map((i) => Date.parse(i.end)))).toISOString() : null,
      avg_utilization: used.length ? Math.round(used.reduce((a, c) => a + c.utilization, 0) / used.length) : 0,
    },
  };
}

// ---------- Conflict validation for any schedule (FR-06 / FR-11) ----------
export function validateSchedule(items: ScheduleItem[], data: PlantData): Omit<Conflict, "id">[] {
  const out: Omit<Conflict, "id">[] = [];
  const byOrder = new Map<string, ScheduleItem[]>();
  for (const i of items) byOrder.set(i.orderId, [...(byOrder.get(i.orderId) ?? []), i]);
  for (const [, ops] of byOrder) {
    const p = data.products.find((x) => x.sku === ops[0]!.sku);
    if (!p) continue;
    for (const op of ops) {
      const step = p.routing.find((r) => r.seq === op.seq);
      for (const d of step?.depends_on ?? []) {
        const prev = ops.find((x) => x.seq === d);
        const prevStep = p.routing.find((r) => r.seq === d);
        if (!prev) continue;
        const gapMin = (Date.parse(op.start) - Date.parse(prev.end)) / MIN;
        if (gapMin < 0) out.push({ type: "dependency", severity: "high", orders: [op.po], operation: op.op, resource: op.machine, at: op.start, reason: `"${op.op}" starts before "${prev.op}" finishes`, impact: "Violates operation sequence", rule: null });
        else if (prevStep && gapMin < prevStep.min_gap_after) out.push({ type: "min_gap", severity: "medium", orders: [op.po], operation: op.op, resource: op.machine, at: op.start, reason: `Only ${Math.round(gapMin)} min after "${prev.op}"; ${prevStep.min_gap_after} min required`, impact: "Minimum time between operations violated", rule: null });
      }
    }
  }
  const byMachine = new Map<string, ScheduleItem[]>();
  for (const i of items) byMachine.set(i.machine, [...(byMachine.get(i.machine) ?? []), i]);
  for (const [m, ops] of byMachine) {
    const sorted = [...ops].sort((a, b) => a.start.localeCompare(b.start));
    for (let k = 1; k < sorted.length; k++) if (Date.parse(sorted[k]!.start) < Date.parse(sorted[k - 1]!.end)) out.push({ type: "machine", severity: "high", orders: [sorted[k - 1]!.po, sorted[k]!.po], operation: sorted[k]!.op, resource: m, at: sorted[k]!.start, reason: `${m} double-booked`, impact: "Resource allocated to overlapping operations", rule: null });
  }
  return out;
}

// ---------- Version comparison (FR-14) ----------
export type VersionDiff = { key: string; po: string; op: string; change: "added" | "removed" | "moved" | "reassigned"; before: string | null; after: string | null };
export function compareVersions(a: ScheduleItem[], b: ScheduleItem[]) {
  const A = new Map(a.map((i) => [i.key, i]));
  const B = new Map(b.map((i) => [i.key, i]));
  const diffs: VersionDiff[] = [];
  for (const [k, x] of A) {
    const y = B.get(k);
    if (!y) { diffs.push({ key: k, po: x.po, op: x.op, change: "removed", before: `${x.machine} ${x.start}`, after: null }); continue; }
    if (x.machine !== y.machine || x.operator !== y.operator) diffs.push({ key: k, po: x.po, op: x.op, change: "reassigned", before: `${x.machine}${x.operator ? ` / ${x.operator}` : ""}`, after: `${y.machine}${y.operator ? ` / ${y.operator}` : ""}` });
    if (x.start !== y.start || x.end !== y.end) diffs.push({ key: k, po: x.po, op: x.op, change: "moved", before: `${x.start} → ${x.end}`, after: `${y.start} → ${y.end}` });
  }
  for (const [k, y] of B) if (!A.has(k)) diffs.push({ key: k, po: y.po, op: y.op, change: "added", before: null, after: `${y.machine} ${y.start}` });
  const seq = (items: ScheduleItem[]) => Array.from(new Set([...items].sort((p, q) => p.start.localeCompare(q.start)).map((i) => i.po)));
  return { diffs, sequenceBefore: seq(a), sequenceAfter: seq(b) };
}

function fmtNum(n: number) { return Math.round(n).toLocaleString("en-US"); }

// ---------- Time zone ----------
/** Offset (minutes) of an IANA time zone from UTC at a given instant. */
export function tzOffsetMinutes(timeZone: string, at = Date.now()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(at));
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"));
    return Math.round((asUtc - Math.floor(at / MIN) * MIN) / MIN);
  } catch { return 0; }
}

// ---------- Stale-plan detection ----------
export type InputSnapshot = {
  taken_at: string;
  products: Record<string, { bom: string | null; routing: string | null; recipe: string | null }>;
  orders: Record<string, { revision: number; quantity: number; due_date: string; status: string }>;
};
export type StaleReason = { kind: "machine" | "revision" | "quality" | "order" | "material"; ref: string; message: string };

export function buildInputSnapshot(data: PlantData, orders: (Order & { order_revision?: number })[], at: string): InputSnapshot {
  return {
    taken_at: at,
    products: Object.fromEntries(data.products.map((p) => [p.sku, { bom: p.bom_revision ?? null, routing: p.routing_revision ?? null, recipe: p.recipe_revision ?? null }])),
    orders: Object.fromEntries(orders.map((o) => [o.po_number, { revision: o.order_revision ?? 1, quantity: o.quantity, due_date: o.due_date, status: o.status }])),
  };
}

/** Why an approved plan no longer matches current plant data (empty = still valid). */
export function detectStalePlan(items: ScheduleItem[], snapshot: InputSnapshot | null, data: PlantData, orders: (Order & { order_revision?: number })[], now = Date.now()): StaleReason[] {
  const out: StaleReason[] = [];
  const future = items.filter((i) => Date.parse(i.end) > now);
  const machinesUsed = new Set(future.map((i) => i.machine));
  for (const code of machinesUsed) {
    const m = data.machines.find((x) => x.code === code);
    if (!m) out.push({ kind: "machine", ref: code, message: `${code} no longer exists` });
    else if (m.status === "down" || m.status === "maintenance") out.push({ kind: "machine", ref: code, message: `${code} is ${m.status} but has planned work` });
    for (const x of data.maintenance) {
      if (x.machine_code !== code) continue;
      const s = Date.parse(x.starts_at), e = Date.parse(x.ends_at);
      if (future.some((i) => i.machine === code && Date.parse(i.start) < e && Date.parse(i.end) > s)) out.push({ kind: "machine", ref: code, message: `${x.kind === "failure" ? "Failure" : "Maintenance"} on ${code} overlaps planned work` });
    }
  }
  const skus = new Set(future.map((i) => i.sku));
  for (const sku of skus) {
    const p = data.products.find((x) => x.sku === sku);
    if (!p) continue;
    if (p.quality_hold) out.push({ kind: "quality", ref: sku, message: `${sku} is on quality hold` });
    const snap = snapshot?.products[sku];
    if (snap) for (const k of ["bom", "routing", "recipe"] as const) {
      const cur = (p as any)[`${k}_revision`] ?? null;
      if (cur !== snap[k]) out.push({ kind: "revision", ref: sku, message: `${sku} ${k} revision changed (${snap[k] ?? "none"} → ${cur ?? "none"})` });
    }
    for (const line of p.bom) {
      const mat = data.materials.find((m) => m.code === line.material);
      if (mat && (mat.quality_status === "hold" || mat.quality_status === "rejected")) out.push({ kind: "material", ref: mat.code, message: `${mat.code} needed by ${sku} is on quality ${mat.quality_status}` });
    }
  }
  const pos = new Set(future.map((i) => i.po));
  for (const po of pos) {
    const o = orders.find((x) => x.po_number === po);
    const snap = snapshot?.orders[po];
    if (!o) { out.push({ kind: "order", ref: po, message: `${po} was removed` }); continue; }
    if (o.status === "cancelled" || o.status === "on_hold") out.push({ kind: "order", ref: po, message: `${po} is now ${o.status}` });
    else if (snap && ((o.order_revision ?? 1) !== snap.revision || o.quantity !== snap.quantity || Date.parse(o.due_date) !== Date.parse(snap.due_date))) out.push({ kind: "order", ref: po, message: `${po} changed in OMS since approval` });
  }
  const seen = new Set<string>();
  return out.filter((r) => { const k = r.kind + r.message; if (seen.has(k)) return false; seen.add(k); return true; });
}
