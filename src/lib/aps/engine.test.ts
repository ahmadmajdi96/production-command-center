import { describe, expect, it } from "vitest";
import { assessFeasibility, generateSchedule, operationMinutes, sequenceOrders, validateSchedule, type Order, type PlantData, type Rule } from "./engine";

const route = (mix = 15) => [
  { seq: 10, name: "Mixing", machine_type: "mixer", process_min: mix, setup_min: 5, min_gap_after: 10, skill: "mixing", depends_on: [] },
  { seq: 20, name: "Filling", machine_type: "filler", process_min: 0, setup_min: 10, min_gap_after: 0, skill: "filling", depends_on: [10] },
];
const prod = (sku: string, family: string, mat: string) => ({ sku, name: sku, setup_family: family, bom_status: "approved", routing_status: "approved", recipe_status: "approved", recipe_required: true, bom: [{ material: mat, qty_per_unit: 1 }], routing: route() });
const data: PlantData = {
  products: [prod("OJ", "blue", "M-OJ"), prod("AJ", "orange", "M-AJ"), prod("GJ", "blue", "M-GJ")],
  materials: ["M-OJ", "M-AJ", "M-GJ"].map((code) => ({ code, name: code, uom: "L", on_hand: 10000, on_hold: 0, expected_qty: 0, expected_at: null, status: "released" })),
  machines: [
    { code: "MX", name: "Mixer", machine_type: "mixer", line: "L1", rate_per_hour: 6000, status: "running", repair_eta: null },
    { code: "FL", name: "Filler", machine_type: "filler", line: "L1", rate_per_hour: 3000, status: "running", repair_eta: null },
  ],
  shifts: [{ name: "Day", start_hour: 0, end_hour: 24, break_start_hour: null, break_minutes: 0 }],
  operators: [{ id: "o1", name: "A", skills: ["mixing", "filling"], shift_name: "Day", available: true }, { id: "o2", name: "B", skills: ["filling"], shift_name: "Day", available: true }],
  maintenance: [],
  changeovers: [{ from_family: "blue", to_family: "orange", minutes: 30 }, { from_family: "orange", to_family: "blue", minutes: 30 }],
};
const start = "2026-11-02T00:00:00.000Z";
const due = "2026-11-06T00:00:00.000Z";
const orders: Order[] = [
  { id: "1", po_number: "PO-001", sku: "OJ", quantity: 1000, due_date: due, priority: 3, status: "released" },
  { id: "2", po_number: "PO-002", sku: "AJ", quantity: 1000, due_date: due, priority: 3, status: "released" },
  { id: "3", po_number: "PO-003", sku: "GJ", quantity: 1000, due_date: due, priority: 3, status: "released" },
];
const rules: Rule[] = [
  { id: "r1", name: "Due date", criterion: "due_date", direction: "asc", rule_priority: 1, conflict_policy: null, active: true },
  { id: "r2", name: "Group setups", criterion: "changeover", direction: "asc", rule_priority: 2, conflict_policy: "protect_due_dates", active: true },
];

describe("APS engine", () => {
  it("adds RMS processing time and setup time (15 + 5 = 20 min)", () => {
    expect(operationMinutes(route()[0]!, 0, data.machines[0]!).total).toBe(20);
  });

  it("uses machine-specific speed: faster machine needs less time", () => {
    const slow = { ...data.machines[1]!, rate_per_hour: 1500 };
    expect(operationMinutes(route()[1]!, 3000, data.machines[1]!).process).toBe(60);
    expect(operationMinutes(route()[1]!, 3000, slow).process).toBe(120);
  });

  it("sequences PO-001, PO-003, PO-002 to reduce cap-colour changeovers", () => {
    expect(sequenceOrders(orders, data, rules, Date.parse(start)).map((o) => o.po_number)).toEqual(["PO-001", "PO-003", "PO-002"]);
  });

  it("keeps the due-date order when grouping would make an order late", () => {
    const tight = orders.map((o) => (o.id === "2" ? { ...o, due_date: "2026-11-02T00:40:00.000Z" } : o));
    const seq = sequenceOrders(tight, data, rules, Date.parse(start)).map((o) => o.po_number);
    expect(seq[0]).toBe("PO-002");
  });

  it("classifies feasible, conditionally feasible and not feasible orders", () => {
    const d: PlantData = { ...data, materials: data.materials.map((m) => (m.code === "M-AJ" ? { ...m, on_hand: 500, expected_qty: 1000, expected_at: "2026-11-03T00:00:00.000Z" } : m.code === "M-GJ" ? { ...m, on_hand: 100 } : m)) };
    expect(assessFeasibility(orders[0]!, d, 0).status).toBe("feasible");
    expect(assessFeasibility(orders[1]!, d, 0).status).toBe("conditional");
    expect(assessFeasibility(orders[2]!, d, 0).status).toBe("not_feasible");
  });

  it("never starts an operation before its predecessor plus the minimum gap", () => {
    const r = generateSchedule(orders, data, rules, start);
    for (const o of orders) {
      const mix = r.items.find((i) => i.orderId === o.id && i.seq === 10)!;
      const fill = r.items.find((i) => i.orderId === o.id && i.seq === 20)!;
      expect(Date.parse(fill.start) - Date.parse(mix.end)).toBeGreaterThanOrEqual(10 * 60_000);
    }
    expect(validateSchedule(r.items, data)).toEqual([]);
  });

  it("does not double-book a machine", () => {
    const r = generateSchedule(orders, data, rules, start);
    const fl = r.items.filter((i) => i.machine === "FL").sort((a, b) => a.start.localeCompare(b.start));
    for (let k = 1; k < fl.length; k++) expect(Date.parse(fl[k]!.start)).toBeGreaterThanOrEqual(Date.parse(fl[k - 1]!.end));
  });

  it("schedules around planned maintenance and reports it", () => {
    const d = { ...data, maintenance: [{ machine_code: "MX", kind: "planned", starts_at: start, ends_at: "2026-11-02T02:00:00.000Z" }] };
    const r = generateSchedule([orders[0]!], d, rules, start);
    expect(r.items[0]!.start >= "2026-11-02T02:00:00.000Z").toBe(true);
    expect(r.conflicts.some((c) => c.type === "maintenance")).toBe(true);
  });
});
