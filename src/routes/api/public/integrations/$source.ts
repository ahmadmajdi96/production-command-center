import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { parsePayload } from "@/lib/aps/contracts";

// Inbound data feed for connected systems. Contracts live in src/lib/aps/contracts.ts.
// POST /api/public/integrations/<source>   header: x-api-key: <APS_INTEGRATION_KEY>
// body: { event_id?, correlation_id?, idempotency_key?, schema_version?, occurred_at?, records: [...] }
function keyOk(given: string | null) {
  const expected = process.env["APS_INTEGRATION_KEY"];
  if (!expected || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/integrations/$source")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!keyOk(request.headers.get("x-api-key"))) return Response.json({ error: "Unauthorized" }, { status: 401 });
        let json: unknown;
        try { json = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
        const parsed = parsePayload(params.source, json);
        if (!parsed.ok) return Response.json({ error: parsed.error, issues: (parsed as any).issues }, { status: parsed.status });
        const { source, envelope } = parsed;
        const records = parsed.records;
        const db = (await import("@/lib/aps/database.server")).getApsDb();
        const now = new Date().toISOString();
        let error: { message: string } | null = null;
        // Idempotency: a repeated key is acknowledged without processing the records again.
        if (envelope.idempotency_key) {
          const { data: seen } = await db.from("integration_events").select("outcome, received_at").eq("idempotency_key", envelope.idempotency_key).maybeSingle();
          if (seen && seen.outcome !== "failed") return Response.json({ ok: true, duplicate: true, source, first_received_at: seen.received_at });
          if (seen) await db.from("integration_events").update({ idempotency_key: `${envelope.idempotency_key}#failed@${now}` }).eq("idempotency_key", envelope.idempotency_key);
        }
        if (source === "oms") ({ error } = await db.from("production_orders").upsert(records.map((r) => ({ ...r, source: "OMS", updated_at: now })), { onConflict: "po_number" }));
        if (source === "wms") ({ error } = await db.from("materials").upsert(records.map((r) => ({ ...r, updated_at: now })), { onConflict: "code" }));
        if (source === "machines") ({ error } = await db.from("machines").upsert(records.map((r) => ({ ...r, updated_at: now })), { onConflict: "code" }));
        if (source === "maintenance") ({ error } = await db.from("maintenance_events").upsert(records, { onConflict: "external_id" }));
        if (source === "bom") ({ error } = await db.from("products").upsert(records.map((r) => ({ ...r, updated_at: now })), { onConflict: "sku" }));
        if (source === "workforce") {
          const shifts = records.filter((r) => r.type === "shift").map(({ type: _t, ...r }) => r);
          const ops = records.filter((r) => r.type === "operator").map(({ type: _t, ...r }) => ({ ...r, updated_at: now }));
          if (shifts.length) ({ error } = await db.from("shifts").upsert(shifts, { onConflict: "name" }));
          if (!error && ops.length) ({ error } = await db.from("operators").upsert(ops, { onConflict: "name" }));
        }
        if (source === "routing" || source === "rms") {
          for (const r of records) {
            const { data: p } = await db.from("products").select("routing").eq("sku", r.sku).maybeSingle();
            if (!p) { error = { message: `Unknown SKU ${r.sku} — send BOM / product master first` }; break; }
            const patch = source === "routing"
              ? { routing_status: r.routing_status, routing: r.routing, routing_revision: r.routing_revision ?? null, ...(r.effective_from ? { effective_from: r.effective_from } : {}) }
              : { recipe_status: r.recipe_status, recipe_revision: r.recipe_revision ?? null, routing: (p.routing as any[]).map((s) => ({ ...s, process_min: r.steps.find((x: any) => x.seq === s.seq)?.process_min ?? s.process_min })) };
            ({ error } = await db.from("products").update({ ...patch, updated_at: now }).eq("sku", r.sku));
            if (error) break;
          }
        }
        if (source === "qms") {
          for (const r of records) {
            ({ error } = r.target === "product"
              ? await db.from("products").update({ quality_hold: r.disposition === "hold", quality_note: r.note, updated_at: now }).eq("sku", r.sku)
              : await db.from("materials").update({ quality_status: r.disposition, updated_at: now }).eq("code", r.code));
            if (error) break;
          }
        }
        if (source === "mes") {
          for (const r of records) {
            if (r.type === "ack") {
              const { data: v } = await db.from("schedule_versions").select("id, status").eq("version_no", r.version_no).maybeSingle();
              if (!v || v.status !== "approved") { error = { message: `Version v${r.version_no} is not the approved schedule` }; break; }
              ({ error } = await db.from("schedule_versions").update({ dispatch_status: "acknowledged", acknowledged_at: now, acknowledged_by: r.acknowledged_by }).eq("id", v.id));
            } else {
              const { type: _t, ...row } = r;
              ({ error } = await db.from("execution_feedback").upsert({ ...row, received_at: now }, { onConflict: "po_number,seq" }));
            }
            if (error) break;
          }
        }
        await db.from("integration_events").insert({
          event_id: envelope.event_id ?? null, correlation_id: envelope.correlation_id ?? null, source_system: source, entity_id: envelope.entity_id ?? null,
          entity_revision: envelope.entity_revision ?? null, schema_version: envelope.schema_version, idempotency_key: envelope.idempotency_key ?? null,
          occurred_at: envelope.occurred_at ?? null, received_at: now, records: records.length, outcome: error ? "failed" : "processed", error: error?.message ?? null,
        });
        await db.from("integration_sources").update({ last_sync_at: now, last_status: error ? "error" : "ok", records_last_sync: error ? 0 : records.length }).eq("key", source);
        await db.from("audit_log").insert({ actor: `system:${source}`, action: error ? "integration.failed" : "integration.synced", entity: "integration", entity_id: source, after_value: { records: records.length, error: error?.message ?? null, event_id: envelope.event_id ?? null, correlation_id: envelope.correlation_id ?? null } as never });
        if (error) return Response.json({ error: "Sync failed", detail: error.message }, { status: 400 });
        return Response.json({ ok: true, source, records: records.length });
      },
    },
  },
});
