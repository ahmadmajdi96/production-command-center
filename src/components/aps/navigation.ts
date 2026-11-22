import type { ResourceKey } from "@/lib/aps/resources";

export const apsRouteResources = {
  "/aps": "dashboard",
  "/aps/orders": "orders",
  "/aps/schedule": "schedule",
  "/aps/capacity": "capacity",
  "/aps/conflicts": "conflicts",
  "/aps/versions": "versions",
  "/aps/approvals": "approvals",
  "/aps/audit": "audit",
  "/aps/compliance": "compliance",
  "/aps/rules": "business-rules",
  "/aps/resources": "resources",
  "/aps/integrations": "integrations",
} as const satisfies Record<string, ResourceKey>;

export function apsResourceForPath(pathname: string): ResourceKey | undefined {
  const path = pathname.replace(/\/$/, "");
  return apsRouteResources[path as keyof typeof apsRouteResources];
}
