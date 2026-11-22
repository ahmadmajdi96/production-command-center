import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireApsIdentity } from "./identity-middleware";
import {
  buildInputSnapshot,
  detectStalePlan,
  generateSchedule,
  type ScheduleItem,
  type InputSnapshot,
} from "./engine";
import { previewScope, versionScope, tableReadInput, readTablePermissions } from "./reads";

const access = () => import("./access.server");

const database = async () => (await import("./database.server")).getApsDb();
const loadPlant = async (sb: Awaited<ReturnType<typeof database>>) =>
  (await import("./plant.server")).loadPlant(sb);

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireApsIdentity])
  .handler(async ({ context }) => {
    return (await access()).fetchAccess(context.apsEmail);
  });

export const readApsTable = createServerFn({ method: "GET" })
  .middleware([requireApsIdentity])
  .inputValidator((input: unknown) => tableReadInput.parse(input))
  .handler(async ({ data: input, context }) => {
    await (await access()).requirePermission(context.apsEmail, readTablePermissions(input), "view");
    const db = await database();
    let query =
      input.scope === "business-rules"
        ? db.from("audit_log").select("*").eq("entity", "business_rule")
        : input.table === "app_settings"
          ? db
              .from("app_settings")
              .select("*")
              .in("key", ["plant_timezone", "audit_retention_years"])
          : db.from(input.table).select("*");
    if (input.order)
      query = query.order(input.order.column, { ascending: input.order.ascending ?? true });
    const { data, error } = await query.limit(1000);
    if (error) throw new Error(error.message);
    return data;
  });

export const readApsVersions = createServerFn({ method: "GET" })
  .middleware([requireApsIdentity])
  .inputValidator((input: unknown) => z.object({ scope: versionScope }).parse(input))
  .handler(async ({ data: { scope }, context }) => {
    await (await access()).requirePermission(context.apsEmail, scope, "view");
    const columns =
      scope === "dashboard"
        ? "id,version_no,status,kind,created_at,created_by"
        : scope === "conflicts"
          ? "id,version_no,status,conflicts"
          : "id,version_no,parent_id,status,kind,trigger,reason,created_by,created_at,horizon_start,items,conflicts,metrics,rules_applied,feasibility";
    const { data, error } = await (
      await database()
    )
      .from("schedule_versions")
      .select(columns)
      .order("version_no", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data;
  });

/** Live preview for the requesting page, without saving the plan. */
export const previewPlan = createServerFn({ method: "GET" })
  .middleware([requireApsIdentity])
  .inputValidator((input: unknown) => z.object({ scope: previewScope }).parse(input))
  .handler(async ({ data: { scope }, context }) => {
    await (await access()).requirePermission(context.apsEmail, scope, "view");
    const { data, orders, rules } = await loadPlant(await database());
    const { items, conflicts, rulesApplied, feasibility, metrics, capacity, skills } =
      generateSchedule(orders, data, rules, new Date().toISOString());
    switch (scope) {
      case "dashboard":
        return { feasibility, conflicts, metrics, capacity };
      case "orders":
        return { feasibility };
      case "schedule":
        return { items, conflicts, rulesApplied, metrics };
      case "capacity":
        return { capacity, skills };
      case "conflicts":
        return { conflicts };
    }
  });

const genInput = z.object({
  reason: z.string().trim().min(3).max(500),
  trigger: z.enum([
    "new_plan",
    "machine_failure",
    "operator_absence",
    "material_delay",
    "due_date_change",
    "new_order",
    "capacity_change",
    "shift_change",
    "manual",
    "quality_hold",
    "revision_change",
  ]),
});
export const createScheduleVersion = createServerFn({ method: "POST" })
  .middleware([requireApsIdentity])
  .inputValidator((i: unknown) => genInput.parse(i))
  .handler(async ({ data: input, context }) => {
    const a = await access();
    const me = await a.requirePermission(context.apsEmail, "schedule", "create");
    const db = await database();
    const { data, orders, rules } = await loadPlant(db);
    const horizonStart = new Date().toISOString();
    const result = generateSchedule(orders, data, rules, horizonStart);
    const { data: draft, error } = await db
      .rpc("aps_create_schedule_draft", {
        actor_email: me.email,
        draft: {
          trigger: input.trigger,
          reason: input.reason,
          horizon_start: horizonStart,
          items: result.items,
          conflicts: result.conflicts,
          metrics: { ...result.metrics, sequence: result.sequence },
          rules_applied: result.rulesApplied,
          feasibility: result.feasibility,
          input_snapshot: buildInputSnapshot(data, orders, horizonStart),
        },
      })
      .single();
    if (error) throw new Error(error.message);
    return draft;
  });

export const submitVersion = createServerFn({ method: "POST" })
  .middleware([requireApsIdentity])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const a = await access();
    const me = await a.requirePermission(context.apsEmail, "schedule", "edit");
    const { error } = await (
      await database()
    ).rpc("aps_transition_schedule", {
      target_id: data.id,
      actor_email: me.email,
      decision: "submit",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const signInput = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  password: z.string().min(1).max(128),
  comment: z.string().trim().max(1000).optional().default(""),
});
export const signVersion = createServerFn({ method: "POST" })
  .middleware([requireApsIdentity])
  .inputValidator((i: unknown) => signInput.parse(i))
  .handler(async ({ data, context }) => {
    const a = await access();
    const me = await a.requirePermission(context.apsEmail, "approvals", "edit");
    if (data.decision === "rejected" && data.comment.length < 3)
      throw new Error("A rejection reason is required.");
    // Electronic signature: re-verify the signer's password.
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const verifier = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
            h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: signature, error: pwErr } = await verifier.auth.signInWithPassword({
      email: me.email,
      password: data.password,
    });
    if (pwErr || !signature.user || signature.user.id !== context.apsUserId) {
      throw new Error("Signature failed: verify your password and try again.");
    }
    const { error } = await (
      await database()
    ).rpc("aps_transition_schedule", {
      target_id: data.id,
      actor_email: me.email,
      decision: data.decision,
      signer_name: me.fullName,
      comment: data.comment || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ruleInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().default(""),
  criterion: z.enum(["due_date", "priority", "processing_time", "changeover"]),
  direction: z.enum(["asc", "desc"]),
  rule_priority: z.number().int().min(1).max(99),
  conflict_policy: z.enum(["protect_due_dates", "minimize_changeover"]).nullable(),
  active: z.boolean(),
  reason: z.string().trim().max(300).optional().default(""),
});
export const saveRule = createServerFn({ method: "POST" })
  .middleware([requireApsIdentity])
  .inputValidator((i: unknown) => ruleInput.parse(i))
  .handler(async ({ data, context }) => {
    const a = await access();
    const me = await a.requirePermission(
      context.apsEmail,
      "business-rules",
      data.id ? "edit" : "create",
    );
    const db = await database();
    const { id, reason, ...fields } = data;
    const row = {
      ...fields,
      conflict_policy:
        fields.criterion === "changeover" ? (fields.conflict_policy ?? "protect_due_dates") : null,
      updated_by: me.email,
      updated_at: new Date().toISOString(),
    };
    let before = null;
    if (id) {
      before = (await db.from("business_rules").select("*").eq("id", id).single()).data;
      const { error } = await db.from("business_rules").update(row).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: codes } = await db.from("business_rules").select("code");
      const next =
        1 +
        Math.max(
          0,
          ...(codes ?? []).map((c) => Number(String(c.code ?? "").replace(/\D/g, "")) || 0),
        );
      const { error } = await db
        .from("business_rules")
        .insert({ ...row, code: `APS-PLAN-${String(next).padStart(3, "0")}`, domain: "planning" });
      if (error) throw new Error(error.message);
    }
    await a.audit({
      actor: me.email,
      action: id ? "rule.updated" : "rule.created",
      entity: "business_rule",
      entity_id: data.name,
      before_value: before,
      after_value: row,
      reason: reason || null,
    });
    return { ok: true };
  });

export const deleteRule = createServerFn({ method: "POST" })
  .middleware([requireApsIdentity])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const a = await access();
    const me = await a.requirePermission(context.apsEmail, "business-rules", "delete");
    const db = await database();
    const before = (await db.from("business_rules").select("*").eq("id", data.id).single()).data;
    const { error } = await db.from("business_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await a.audit({
      actor: me.email,
      action: "rule.deleted",
      entity: "business_rule",
      entity_id: before?.name ?? data.id,
      before_value: before,
    });
    return { ok: true };
  });

const machineInput = z.object({
  code: z.string().min(1).max(40),
  status: z.enum(["running", "idle", "down", "maintenance"]),
  rate_per_hour: z.number().positive().max(1_000_000),
  repair_eta: z.string().datetime().nullable(),
});
export const updateMachine = createServerFn({ method: "POST" })
  .middleware([requireApsIdentity])
  .inputValidator((i: unknown) => machineInput.parse(i))
  .handler(async ({ data, context }) => {
    const a = await access();
    const me = await a.requirePermission(context.apsEmail, "resources", "edit");
    const db = await database();
    const before = (
      await db
        .from("machines")
        .select("status, rate_per_hour, repair_eta")
        .eq("code", data.code)
        .single()
    ).data;
    const { code, ...after } = data;
    const { error } = await db
      .from("machines")
      .update({ ...after, updated_at: new Date().toISOString() })
      .eq("code", code);
    if (error) throw new Error(error.message);
    await a.audit({
      actor: me.email,
      action: "machine.updated",
      entity: "machine",
      entity_id: code,
      before_value: before,
      after_value: after,
    });
    return { ok: true };
  });

export const setOperatorAvailability = createServerFn({ method: "POST" })
  .middleware([requireApsIdentity])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), available: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const a = await access();
    const me = await a.requirePermission(context.apsEmail, "resources", "edit");
    const db = await database();
    const before = (await db.from("operators").select("name, available").eq("id", data.id).single())
      .data;
    const { error } = await db
      .from("operators")
      .update({ available: data.available, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await a.audit({
      actor: me.email,
      action: "operator.availability",
      entity: "operator",
      entity_id: before?.name ?? data.id,
      before_value: before,
      after_value: { available: data.available },
    });
    return { ok: true };
  });

/** Whether the approved plan still matches current plant data. */
export const getPlanStatus = createServerFn({ method: "GET" })
  .middleware([requireApsIdentity])
  .handler(async ({ context }) => {
    await (await access()).requirePermission(context.apsEmail, "dashboard", "view");
    const sb = await database();
    const { data: v, error } = await sb
      .from("schedule_versions")
      .select(
        "id, version_no, items, input_snapshot, approved_at, dispatch_status, acknowledged_at, acknowledged_by",
      )
      .eq("status", "approved")
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!v) return { approved: null };
    const { data, orders, timezone } = await loadPlant(sb);
    const reasons = detectStalePlan(
      v.items as unknown as ScheduleItem[],
      v.input_snapshot as unknown as InputSnapshot | null,
      data,
      orders,
    );
    return {
      approved: {
        id: v.id as string,
        version_no: v.version_no as number,
        approved_at: v.approved_at as string | null,
        dispatch_status: v.dispatch_status as string,
        acknowledged_at: v.acknowledged_at as string | null,
        acknowledged_by: v.acknowledged_by as string | null,
      },
      reasons,
      timezone,
    };
  });

const settingsInput = z.object({
  plant_timezone: z
    .string()
    .min(1)
    .max(60)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown time zone"),
  audit_retention_years: z.number().int().min(1).max(50),
});
export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireApsIdentity])
  .inputValidator((i: unknown) => settingsInput.parse(i))
  .handler(async ({ data, context }) => {
    const a = await access();
    const me = await a.requirePermission(context.apsEmail, "integrations", "edit");
    const db = await database();
    const { data: before } = await db.from("app_settings").select("key, value");
    const now = new Date().toISOString();
    const { error } = await db.from("app_settings").upsert(
      Object.entries(data).map(([key, value]) => ({
        key,
        value: value as never,
        updated_by: me.email,
        updated_at: now,
      })),
    );
    if (error) throw new Error(error.message);
    await a.audit({
      actor: me.email,
      action: "settings.updated",
      entity: "settings",
      entity_id: "plant",
      before_value: before,
      after_value: data,
    });
    return { ok: true };
  });

/** Recomputes the audit hash chain to prove no record was altered or removed. */
export const verifyAuditChain = createServerFn({ method: "GET" })
  .middleware([requireApsIdentity])
  .handler(async ({ context }) => {
    await (await access()).requirePermission(context.apsEmail, "audit", "view");
    const { data, error } = await (await database()).rpc("verify_audit_chain");
    if (error) throw new Error(error.message);
    const r = (data as { ok: boolean; checked: number; broken_seq: number | null }[])[0];
    return r ?? { ok: true, checked: 0, broken_seq: null };
  });
