import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAccess, getPlanStatus, previewPlan, readApsTable, readApsVersions } from "./aps.functions";
import type { PreviewByScope, PreviewScope, TableName, VersionScope } from "./reads";
import { can, type Action, type MyAccess, type ResourceKey } from "./resources";
import type { Conflict, Feasibility, ScheduleItem, AppliedRule, Metrics } from "./engine";

export const AccessContext = createContext<MyAccess | null>(null);
export function useAccess() { return useContext(AccessContext); }
export function useCan(key: ResourceKey, action: Action = "view") { return can(useAccess(), key, action); }

export function useMyApsAccess({ enabled = true, userId }: { enabled?: boolean; userId?: string } = {}) {
  const fn = useServerFn(getMyAccess);
  return useQuery({
    queryKey: ["aps-my-access", userId],
    queryFn: () => fn(),
    enabled,
  });
}

export function useTable<T = unknown>(
  table: TableName,
  order?: { column: string; ascending?: boolean },
  scope?: "business-rules",
) {
  const fn = useServerFn(readApsTable);
  const access = useAccess();
  return useQuery({
    queryKey: ["table", table, access?.email, order, scope],
    queryFn: async () => await fn({ data: { table, order, scope } }) as T[],
    enabled: access?.active === true,
  });
}

export type Version = {
  id: string; version_no: number; parent_id: string | null; status: string; kind: string; trigger: string | null; reason: string | null;
  created_by: string; created_at: string; horizon_start: string; items: ScheduleItem[]; conflicts: Conflict[];
  metrics: Metrics & { sequence?: string[] }; rules_applied: AppliedRule[]; feasibility: Feasibility[];
};
type VersionSummary = Pick<Version, "id" | "version_no" | "status" | "kind" | "created_at" | "created_by">;
type VersionConflicts = Pick<Version, "id" | "version_no" | "status" | "conflicts">;
type VersionByScope = {
  dashboard: VersionSummary;
  conflicts: VersionConflicts;
  versions: Version;
  schedule: Version;
  approvals: Version;
};

export function useVersionQueryKey(scope: VersionScope = "versions") {
  return ["versions", scope, useAccess()?.email] as const;
}

export function useVersions<Scope extends VersionScope = "versions">(scope?: Scope) {
  const view = scope ?? "versions";
  const fn = useServerFn(readApsVersions);
  const access = useAccess();
  return useQuery({
    queryKey: useVersionQueryKey(view),
    queryFn: async () => await fn({ data: { scope: view } }) as unknown as VersionByScope[Scope][],
    enabled: can(access, view),
  });
}

export function usePreview<Scope extends PreviewScope = "dashboard">(scope?: Scope) {
  const view = scope ?? "dashboard";
  const fn = useServerFn(previewPlan);
  const access = useAccess();
  return useQuery({
    queryKey: ["preview", view, access?.email],
    queryFn: async () => await fn({ data: { scope: view } }) as PreviewByScope[Scope],
    enabled: can(access, view),
    staleTime: 30_000,
  });
}

export const TRIGGERS: Record<string, string> = {
  new_plan: "New plan",
  machine_failure: "Machine failure / downtime",
  operator_absence: "Operator absence",
  material_delay: "Delayed material",
  due_date_change: "Due date change",
  new_order: "New production order",
  capacity_change: "Speed / capacity change",
  shift_change: "Shift or maintenance change",
  manual: "Manual adjustment",
  quality_hold: "Quality hold / disposition",
  revision_change: "Recipe / routing / BOM revision change",
};

export function usePlanStatus() {
  const fn = useServerFn(getPlanStatus);
  const access = useAccess();
  return useQuery({
    queryKey: ["plan-status", access?.email],
    queryFn: () => fn(),
    enabled: can(access, "dashboard"),
    staleTime: 30_000,
  });
}
