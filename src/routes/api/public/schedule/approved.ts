import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

// Outbound feed for MES: the current approved (released) schedule.
// GET /api/public/schedule/approved   header: x-api-key: <APS_INTEGRATION_KEY>
// MES confirms receipt by POSTing { type: "ack", version_no } to /api/public/integrations/mes.
function keyOk(given: string | null) {
  const expected = process.env["APS_INTEGRATION_KEY"];
  if (!expected || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/schedule/approved")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!keyOk(request.headers.get("x-api-key"))) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const db = (await import("@/lib/aps/database.server")).getApsDb();
        const { data: v, error } = await db.from("schedule_versions").select("*").eq("status", "approved").order("version_no", { ascending: false }).limit(1).maybeSingle();
        if (error) return Response.json({ error: "Lookup failed" }, { status: 500 });
        if (!v) return Response.json({ approved: null });
        const { loadPlant } = await import("@/lib/aps/plant.server");
        const { detectStalePlan } = await import("@/lib/aps/engine");
        const { data, orders, timezone } = await loadPlant(db);
        const stale = detectStalePlan(v.items as any, v.input_snapshot as any, data, orders);
        const { data: sig } = await db.from("approvals").select("signer_email, signer_name, meaning, signed_at").eq("version_id", v.id).eq("decision", "approved").order("signed_at", { ascending: false }).limit(1).maybeSingle();
        return Response.json({
          schema_version: "1",
          approved: {
            version_id: v.id, version_no: v.version_no, approved_at: v.approved_at, released_at: v.released_at,
            dispatch_status: v.dispatch_status, acknowledged_at: v.acknowledged_at, plant_timezone: timezone,
            signature: sig ?? null, stale: stale.length > 0, stale_reasons: stale,
            operations: (v.items as any[]).map((i) => ({ po_number: i.po, sku: i.sku, seq: i.seq, operation: i.op, machine: i.machine, line: i.line, operator: i.operator, planned_start: i.start, planned_end: i.end, quantity: i.qty, due_date: i.due })),
          },
        });
      },
    },
  },
});
