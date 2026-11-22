// Browser-safe catalogue of APS resources. Keys must match the resources
// registered for the "aps" system in the Command Access Hub.
export const APS_SYSTEM_KEY = "aps";

export const APS_RESOURCES = [
  { key: "dashboard", name: "Planning Overview", module: "Overview" },
  { key: "orders", name: "Production Orders & Feasibility", module: "Planning" },
  { key: "schedule", name: "Production Schedule", module: "Planning" },
  { key: "capacity", name: "Capacity", module: "Planning" },
  { key: "conflicts", name: "Conflicts", module: "Planning" },
  { key: "business-rules", name: "Planning Rules", module: "Configuration" },
  { key: "versions", name: "Schedule Versions", module: "Governance" },
  { key: "approvals", name: "Approvals & E-Signature", module: "Governance" },
  { key: "audit", name: "Audit Trail", module: "Governance" },
  { key: "compliance", name: "Standards & Ownership", module: "Governance" },
  { key: "integrations", name: "Data Integrations", module: "Configuration" },
  { key: "resources", name: "Plant Resources", module: "Configuration" },
] as const;

export type ResourceKey = (typeof APS_RESOURCES)[number]["key"];
export type Action = "view" | "create" | "edit" | "delete";
export type Perm = { view: boolean; create: boolean; edit: boolean; delete: boolean };
export type MyAccess = {
  email: string;
  hubConnected: boolean;
  active: boolean;
  roles: string[];
  fullName: string | null;
  permissions: Record<string, Perm>;
  message: string | null;
};

export function can(access: MyAccess | null | undefined, key: ResourceKey, action: Action = "view") {
  return access?.active === true && access.permissions[key]?.[action] === true;
}
