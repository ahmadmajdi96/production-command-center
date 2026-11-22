import { describe, expect, it } from "vitest";
import { assessFeasibility, buildInputSnapshot, detectStalePlan, generateSchedule, tzOffsetMinutes, workingWindows, type Order, type PlantData } from "./engine";
import { parsePayload, samplePayloads, SOURCES } from "./contracts";

const route = [{ seq: 10, name: "Mixing", machine_type: "mixer", process_min: 15, setup_min: 5, min_gap_after: 0, skill: "mixing", depends_on: [] }];
const base = (): PlantData => ({
  products: [{ sku: "OJ", name: "OJ", setup_family: "blue", bom_status: "approved", routing_status: "approved", recipe_status: "approved", recipe_required: true, bom: [{ material: "M", qty_per_unit: 1 }], routing: route, routing_revision: "RT1", bom_revision: "B1", recipe_revision: "R1" }],
  materials: [{ code: "M", name: "M", uom: "L", on_hand: 10000, on_hold: 0, expected_qty: 0, expected_at: null, status: "released", quality_status: "released" }],
  machines: [{ code: "MX", name: "Mixer", machine_type: "mixer", line: "L1", rate_per_hour: 6000, status: "running", repair_eta: null }],
  shifts: [{ name: "Day", start_hour: 0, end_hour: 24, break_start_hour: null, break_minutes: 0 }],
  operators: [{ id: "o", name: "A", skills: ["mixing"], shift_name: "Day", available: true }],
  maintenance: [], changeovers: [],
});
const start = "2026-11-02T00:00:00.000Z";
const order: Order & { order_revision: number } = { id: "1", po_number: "PO-1", sku: "OJ", quantity: 1000, due_date: "2026-11-06T00:00:00.000Z", priority: 3, status: "released", order_revision: 1 };
const now = Date.parse(start);

describe("quality holds (QMS → APS)", () => {
  it("a product on quality hold is not feasible", () => {
    const d = base(); d.products[0]!.quality_hold = true;
    expect(assessFeasibility(order, d, now).status).toBe("not_feasible");
  });
  it("material on quality hold counts as zero usable stock", () => {
    const d = base(); d.materials[0]!.quality_status = "hold";
    const f = assessFeasibility(order, d, now);
    expect(f.status).toBe("not_feasible");
    expect(f.missingMaterials[0]?.short).toBe(1000);
  });
});

describe("out-of-date approved plan", () => {
  const d = base();
  const plan = generateSchedule([order], d, [], start);
  const snap = buildInputSnapshot(d, [order], start);
  it("is valid when nothing changed", () => {
    expect(detectStalePlan(plan.items, snap, d, [order], now)).toEqual([]);
  });
  it("is flagged when a planned machine goes down", () => {
    const d2 = base(); d2.machines[0]!.status = "down";
    expect(detectStalePlan(plan.items, snap, d2, [order], now).map((r) => r.kind)).toContain("machine");
  });
  it("is flagged when the routing revision changes", () => {
    const d2 = base(); d2.products[0]!.routing_revision = "RT2";
    expect(detectStalePlan(plan.items, snap, d2, [order], now).some((r) => r.kind === "revision")).toBe(true);
  });
  it("is flagged when the order gets a new revision in OMS", () => {
    expect(detectStalePlan(plan.items, snap, d, [{ ...order, order_revision: 2 }], now).some((r) => r.kind === "order")).toBe(true);
  });
});

describe("plant time zone", () => {
  it("a 06:00–14:00 shift in UTC+3 starts at 03:00 UTC", () => {
    const w = workingWindows([{ name: "M", start_hour: 6, end_hour: 14, break_start_hour: null, break_minutes: 0 }], now, 1, 180);
    expect(new Date(w[0]!.s).toISOString()).toBe("2026-11-02T03:00:00.000Z");
  });
  it("reads the offset of a named zone", () => {
    expect(tzOffsetMinutes("Asia/Amman", now)).toBe(180);
    expect(tzOffsetMinutes("UTC", now)).toBe(0);
  });
});

describe("interface contracts", () => {
  it("every documented sample payload is accepted", () => {
    for (const s of SOURCES) expect(parsePayload(s, samplePayloads[s]).ok, s).toBe(true);
  });
  it("inventory without an as_of timestamp is rejected", () => {
    const r = parsePayload("wms", { records: [{ code: "M", name: "M", on_hand: 1 }] });
    expect(r.ok).toBe(false);
  });
  it("an unsupported schema version is rejected", () => {
    expect(parsePayload("oms", { ...(samplePayloads.oms as object), schema_version: "2" }).ok).toBe(false);
  });
  it("an unknown source returns 404", () => {
    const r = parsePayload("erp", { records: [] });
    expect(!r.ok && r.status).toBe(404);
  });
});
