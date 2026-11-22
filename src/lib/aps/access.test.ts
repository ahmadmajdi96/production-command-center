import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAccess, requirePermission } from "./access.server";
import { getApsDb } from "./database.server";
import { readTablePermissions, tableReadInput } from "./reads";
import { can } from "./resources";

const actor = "planner@example.test";
const response = {
  system: "aps",
  active: true,
  roles: ["planner"],
  user: { full_name: "Planning User" },
  permissions: [
    { resource_key: "orders", can_view: true, can_create: false, can_edit: false, can_delete: false },
    { resource_key: "orders-detail", can_view: true, can_create: false, can_edit: true, can_delete: false },
  ],
};

describe("isolated APS access", () => {
  beforeEach(() => {
    vi.stubEnv("ACCESS_HUB_URL", "https://access.example.test");
    vi.stubEnv("ACCESS_HUB_API_KEY", "local-test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("denies all planning access when the Hub is unavailable", async () => {
    vi.stubEnv("ACCESS_HUB_URL", "");
    const result = await fetchAccess(actor);
    expect(result.active).toBe(false);
    expect(result.permissions).toEqual({});
  });

  it("denies grants from another system or inactive account", async () => {
    const stub = vi.fn()
      .mockResolvedValueOnce(Response.json({ ...response, system: "mes" }))
      .mockResolvedValueOnce(Response.json({ ...response, active: false }));
    vi.stubGlobal("fetch", stub);
    for (let index = 0; index < 2; index++) {
      await expect(requirePermission(actor, "orders", "view")).rejects.toThrow("permission");
    }
  });

  it("allows only explicit APS resource grants and preserves the verified email", async () => {
    const stub = vi.fn(async () => Response.json(response));
    vi.stubGlobal("fetch", stub);
    const access = await requirePermission(actor, "orders", "view");
    expect(access.email).toBe(actor);
    expect(can(access, "orders", "edit")).toBe(false);
    expect(can(access, "capacity")).toBe(false);
    expect(stub).toHaveBeenCalledWith(
      new URL("https://access.example.test/api/public/v1/access?email=planner%40example.test"),
      expect.objectContaining({ headers: { "x-api-key": "local-test-key" }, redirect: "error" }),
    );
  });

  it("requires separate grants for the rule-history projection and all audit rows", () => {
    expect(readTablePermissions(tableReadInput.parse({ table: "audit_log" }))).toEqual(["audit"]);
    expect(readTablePermissions(tableReadInput.parse({ table: "audit_log", scope: "business-rules" })))
      .toEqual(["business-rules"]);
    expect(tableReadInput.safeParse({ table: "orders" }).success).toBe(false);
    expect(tableReadInput.safeParse({ table: "production_orders", order: { column: "id" } }).success)
      .toBe(false);
  });

  it("rejects a planning database configured with the MES endpoint", () => {
    vi.stubEnv("SUPABASE_URL", "https://mes.example.test/");
    vi.stubEnv("APS_SUPABASE_URL", "https://mes.example.test");
    vi.stubEnv("APS_SUPABASE_SERVICE_ROLE_KEY", "local-test-key");
    expect(() => getApsDb()).toThrow("separate from MES");
  });
});
