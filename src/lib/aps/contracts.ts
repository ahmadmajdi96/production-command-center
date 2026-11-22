import { z } from "zod";

// Versioned interface contracts for systems sending data to APS.
// Browser-safe: also used to document payloads on the Data Integrations page.
export const CONTRACT_VERSION = "1";

const iso = z.string().datetime({ offset: true });
const rev = z.string().max(40).nullable().optional();
const step = z.object({ seq: z.number().int(), name: z.string().max(80), machine_type: z.string().max(40), process_min: z.number().min(0), setup_min: z.number().min(0), min_gap_after: z.number().min(0).default(0), skill: z.string().max(40), depends_on: z.array(z.number().int()).default([]) });

export const recordSchemas = {
  oms: z.object({ po_number: z.string().min(1).max(40), sku: z.string().min(1).max(40), quantity: z.number().positive(), due_date: iso, priority: z.number().int().min(1).max(9).default(3), status: z.enum(["released", "on_hold", "cancelled", "completed", "in_progress"]).default("released"), order_revision: z.number().int().min(1).default(1), sales_order_ref: z.string().max(60).nullable().default(null), source_updated_at: iso.nullable().default(null) }),
  wms: z.object({ code: z.string().min(1).max(40), name: z.string().max(120), uom: z.string().max(10).default("ea"), on_hand: z.number(), on_hold: z.number().default(0), expected_qty: z.number().default(0), expected_at: iso.nullable().default(null), status: z.string().max(20).default("released"), as_of: iso }),
  rms: z.object({ sku: z.string().min(1).max(40), recipe_status: z.string().max(20), recipe_revision: rev, steps: z.array(z.object({ seq: z.number().int(), process_min: z.number().min(0) })).default([]) }),
  routing: z.object({ sku: z.string().min(1).max(40), routing_status: z.string().max(20), routing_revision: rev, effective_from: iso.nullable().optional(), routing: z.array(step).max(50) }),
  bom: z.object({ sku: z.string().min(1).max(40), name: z.string().max(120), setup_family: z.string().max(40), bom_status: z.string().max(20), bom_revision: rev, effective_from: iso.nullable().optional(), bom: z.array(z.object({ material: z.string().max(40), qty_per_unit: z.number().positive() })).max(100) }),
  machines: z.object({ code: z.string().min(1).max(40), name: z.string().max(120), machine_type: z.string().max(40), line: z.string().max(40).default("Line 1"), rate_per_hour: z.number().positive(), status: z.enum(["running", "idle", "down", "maintenance"]), repair_eta: iso.nullable().default(null) }),
  workforce: z.discriminatedUnion("type", [
    z.object({ type: z.literal("operator"), name: z.string().min(1).max(80), skills: z.array(z.string().max(40)).max(30), shift_name: z.string().max(40), available: z.boolean().default(true) }),
    z.object({ type: z.literal("shift"), name: z.string().min(1).max(40), start_hour: z.number().int().min(0).max(23), end_hour: z.number().int().min(0).max(24), break_start_hour: z.number().min(0).max(24).nullable().default(null), break_minutes: z.number().int().min(0).max(240).default(0) }),
  ]),
  maintenance: z.object({ external_id: z.string().min(1).max(80), machine_code: z.string().max(40), kind: z.enum(["planned", "failure"]), starts_at: iso, ends_at: iso, note: z.string().max(300).nullable().default(null) }),
  qms: z.discriminatedUnion("target", [
    z.object({ target: z.literal("product"), sku: z.string().min(1).max(40), disposition: z.enum(["hold", "released"]), note: z.string().max(300).nullable().default(null) }),
    z.object({ target: z.literal("material"), code: z.string().min(1).max(40), disposition: z.enum(["hold", "released", "rejected"]), note: z.string().max(300).nullable().default(null) }),
  ]),
  mes: z.discriminatedUnion("type", [
    z.object({ type: z.literal("ack"), version_no: z.number().int().min(1), acknowledged_by: z.string().max(120) }),
    z.object({ type: z.literal("progress"), po_number: z.string().min(1).max(40), seq: z.number().int(), version_no: z.number().int().nullable().default(null), status: z.enum(["started", "paused", "completed", "aborted"]), actual_start: iso.nullable().default(null), actual_end: iso.nullable().default(null), good_qty: z.number().min(0).nullable().default(null), scrap_qty: z.number().min(0).nullable().default(null), reported_at: iso }),
  ]),
} as const;
export type Source = keyof typeof recordSchemas;
export const SOURCES = Object.keys(recordSchemas) as Source[];

/** Shared event envelope (see APS + MES mapping §7). Optional fields stay optional for simple senders. */
export const envelopeSchema = z.object({
  event_id: z.string().max(120).optional(),
  correlation_id: z.string().max(120).optional(),
  idempotency_key: z.string().min(8).max(200).optional(),
  schema_version: z.string().max(10).default(CONTRACT_VERSION),
  entity_id: z.string().max(120).optional(),
  entity_revision: z.string().max(60).optional(),
  occurred_at: iso.optional(),
});

export function parsePayload(source: string, json: unknown) {
  if (!(source in recordSchemas)) return { ok: false as const, status: 404, error: "Unknown source" };
  const schema = envelopeSchema.extend({ records: z.array(recordSchemas[source as Source] as z.ZodTypeAny).min(1).max(1000) });
  const parsed = schema.safeParse(json);
  if (!parsed.success) return { ok: false as const, status: 422, error: "Validation failed", issues: parsed.error.issues.slice(0, 10) };
  if (parsed.data.schema_version !== CONTRACT_VERSION) return { ok: false as const, status: 422, error: `Unsupported schema_version ${parsed.data.schema_version}; expected ${CONTRACT_VERSION}` };
  return { ok: true as const, source: source as Source, envelope: parsed.data, records: parsed.data.records as any[] };
}

const env = (k: string) => ({ event_id: `evt-${k}-0001`, correlation_id: "corr-PO-101", idempotency_key: `${k}-PO-101-r1`, schema_version: CONTRACT_VERSION, occurred_at: "2026-11-02T10:00:00Z" });
export const samplePayloads: Record<Source, unknown> = {
  oms: { ...env("oms"), records: [{ po_number: "PO-101", sku: "SKU-OJ-1L", quantity: 5000, due_date: "2026-11-10T12:00:00Z", priority: 2, status: "released", order_revision: 1, sales_order_ref: "SO-8812/10", source_updated_at: "2026-11-02T09:58:00Z" }] },
  wms: { ...env("wms"), records: [{ code: "MAT-ORANGE", name: "Orange concentrate", uom: "L", on_hand: 12000, on_hold: 0, expected_qty: 3000, expected_at: "2026-11-05T08:00:00Z", status: "released", as_of: "2026-11-02T09:55:00Z" }] },
  rms: { ...env("rms"), records: [{ sku: "SKU-OJ-1L", recipe_status: "approved", recipe_revision: "R3", steps: [{ seq: 10, process_min: 15 }] }] },
  routing: { ...env("routing"), records: [{ sku: "SKU-OJ-1L", routing_status: "approved", routing_revision: "RT2", effective_from: "2026-11-01T00:00:00Z", routing: [{ seq: 10, name: "Mixing", machine_type: "mixer", process_min: 15, setup_min: 5, min_gap_after: 10, skill: "mixing", depends_on: [] }] }] },
  bom: { ...env("bom"), records: [{ sku: "SKU-OJ-1L", name: "Orange Juice 1L", setup_family: "cap-blue", bom_status: "approved", bom_revision: "B4", bom: [{ material: "MAT-ORANGE", qty_per_unit: 0.9 }] }] },
  machines: { ...env("machines"), records: [{ code: "FL-01", name: "Filler 01", machine_type: "filler", line: "Line 1", rate_per_hour: 3000, status: "down", repair_eta: "2026-11-03T14:00:00Z" }] },
  workforce: { ...env("workforce"), records: [{ type: "shift", name: "Morning", start_hour: 6, end_hour: 14, break_start_hour: 10, break_minutes: 30 }, { type: "operator", name: "Ahmad K.", skills: ["mixing", "filling"], shift_name: "Morning", available: true }] },
  maintenance: { ...env("maintenance"), records: [{ external_id: "WO-5521", machine_code: "FL-01", kind: "planned", starts_at: "2026-11-04T10:00:00Z", ends_at: "2026-11-04T12:00:00Z", note: "Nozzle PM" }] },
  qms: { ...env("qms"), records: [{ target: "material", code: "MAT-APPLE", disposition: "hold", note: "Brix out of spec, lot L-2291" }] },
  mes: { ...env("mes"), records: [{ type: "ack", version_no: 3, acknowledged_by: "MES Command Central" }, { type: "progress", po_number: "PO-101", seq: 10, version_no: 3, status: "completed", actual_start: "2026-11-02T06:10:00Z", actual_end: "2026-11-02T07:40:00Z", good_qty: 4980, scrap_qty: 20, reported_at: "2026-11-02T07:41:00Z" }] },
};
