import { z } from "zod";
import { getApsDb } from "./database.server";
import { APS_RESOURCES, APS_SYSTEM_KEY, type Action, type MyAccess, type Perm, type ResourceKey } from "./resources";
import type { Json } from "./database.types";

const permission = z.object({
  resource_key: z.string(),
  can_view: z.boolean(),
  can_create: z.boolean(),
  can_edit: z.boolean(),
  can_delete: z.boolean(),
});

const accessResponse = z.object({
  system: z.literal(APS_SYSTEM_KEY),
  active: z.boolean(),
  roles: z.array(z.string()),
  user: z.object({ full_name: z.string().nullish() }).nullable(),
  permissions: z.array(permission),
});

const none: Perm = { view: false, create: false, edit: false, delete: false };

function denied(email: string, hubConnected: boolean, message: string): MyAccess {
  return { email, hubConnected, active: false, roles: [], fullName: null, permissions: {}, message };
}

/** Requests effective APS permissions for a verified MES identity. */
export async function fetchAccess(email: string): Promise<MyAccess> {
  const base = process.env.ACCESS_HUB_URL;
  const key = process.env.ACCESS_HUB_API_KEY;
  if (!base || !key) {
    return denied(email, false, "Command Access Hub is not configured for APS.");
  }

  try {
    const url = new URL("/api/public/v1/access", base);
    url.searchParams.set("email", email);
    const res = await fetch(url, {
      headers: { "x-api-key": key },
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    if (!res.ok) {
      return denied(email, true, "Command Access Hub refused the APS access request.");
    }
    const parsed = accessResponse.safeParse(await res.json());
    if (!parsed.success) {
      return denied(email, true, "Command Access Hub returned an invalid APS access response.");
    }
    const body = parsed.data;
    if (!body.active) return denied(email, true, "Your account has no active APS role in Command Access Hub.");

    const permissions: Record<string, Perm> = {};
    for (const grant of body.permissions) {
      const key = grant.resource_key;
      if (!APS_RESOURCES.some((resource) => resource.key === key)) continue;
      const previous = permissions[key] ?? none;
      permissions[key] = {
        view: previous.view || grant.can_view,
        create: previous.create || grant.can_create,
        edit: previous.edit || grant.can_edit,
        delete: previous.delete || grant.can_delete,
      };
    }
    return {
      email, hubConnected: true, active: true, roles: body.roles,
      fullName: body.user?.full_name ?? null, permissions, message: null,
    };
  } catch {
    return denied(email, false, "Command Access Hub could not be reached.");
  }
}

export async function requirePermission(
  email: string | undefined,
  resource: ResourceKey | readonly ResourceKey[],
  action: Action,
) {
  if (!email) throw new Error("Signed-in email required.");
  const access = await fetchAccess(email);
  const resources = typeof resource === "string" ? [resource] : resource;
  if (!access.active || !resources.some((key) => access.permissions[key]?.[action])) {
    throw new Error("You do not have permission for this APS action.");
  }
  return access;
}

export async function audit(row: {
  actor: string;
  action: string;
  entity: string;
  entity_id?: string | null;
  before_value?: unknown;
  after_value?: unknown;
  reason?: string | null;
}) {
  const { error } = await getApsDb().from("audit_log").insert({
    ...row,
    before_value: (row.before_value ?? null) as Json,
    after_value: (row.after_value ?? null) as Json,
  });
  if (error) throw new Error("APS audit recording failed.");
}
