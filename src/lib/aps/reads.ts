import { z } from "zod";
import type { ScheduleResult } from "./engine";
import type { ResourceKey } from "./resources";

export const previewScope = z.enum(["dashboard", "orders", "schedule", "capacity", "conflicts"]);
export type PreviewScope = z.infer<typeof previewScope>;
export interface PreviewByScope {
  dashboard: Pick<ScheduleResult, "feasibility" | "conflicts" | "metrics" | "capacity">;
  orders: Pick<ScheduleResult, "feasibility">;
  schedule: Pick<ScheduleResult, "items" | "conflicts" | "rulesApplied" | "metrics">;
  capacity: Pick<ScheduleResult, "capacity" | "skills">;
  conflicts: Pick<ScheduleResult, "conflicts">;
}

export const versionScope = z.enum(["dashboard", "schedule", "conflicts", "versions", "approvals"]);
export type VersionScope = z.infer<typeof versionScope>;

const tableNames = z.enum([
  "products", "materials", "machines", "shifts", "operators", "maintenance_events", "changeovers",
  "production_orders", "business_rules", "approvals", "audit_log", "integration_sources",
  "integration_events", "execution_feedback", "app_settings",
]);
export type TableName = z.infer<typeof tableNames>;

const tableScopes: Record<TableName, readonly ResourceKey[]> = {
  products: ["resources", "orders"],
  materials: ["resources"],
  machines: ["resources", "orders", "schedule", "approvals"],
  shifts: ["resources"],
  operators: ["resources"],
  maintenance_events: ["resources"],
  changeovers: ["resources"],
  production_orders: ["orders"],
  business_rules: ["business-rules"],
  approvals: ["approvals", "versions"],
  audit_log: ["audit"],
  integration_sources: ["integrations"],
  integration_events: ["integrations"],
  execution_feedback: ["integrations"],
  app_settings: ["integrations", "audit"],
};

const orderColumns: Partial<Record<TableName, string>> = {
  machines: "code",
  operators: "name",
  production_orders: "due_date",
  business_rules: "rule_priority",
  approvals: "signed_at",
  audit_log: "at",
  integration_sources: "name",
  integration_events: "received_at",
  execution_feedback: "received_at",
};

export const tableReadInput = z.object({
  table: tableNames,
  order: z.object({ column: z.string(), ascending: z.boolean().optional() }).optional(),
  scope: z.literal("business-rules").optional(),
}).refine(({ table, order }) => !order || order.column === orderColumns[table], {
  message: "This sort column is not available for the APS table.",
}).refine(({ table, scope }) => !scope || table === "audit_log", {
  message: "Rule history is available only from the APS audit table.",
});

export function readTablePermissions({ scope, table }: z.infer<typeof tableReadInput>) {
  return scope === "business-rules" ? [scope] : tableScopes[table];
}
