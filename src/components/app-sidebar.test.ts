import { describe, expect, it } from "vitest";
import { advancedPlanning, planning, visibleAdvancedPlanning, workforce } from "./app-sidebar";
import { apsRouteResources } from "@/components/aps/navigation";
import type { MyAccess } from "@/lib/aps/resources";

describe("MES section coverage in PMS", () => {
  it("includes every MES Planning destination", () => {
    expect(planning.map((page) => page.url)).toEqual([
      "/products", "/recipes", "/production-orders", "/planner",
      "/scheduling", "/reports", "/inventory",
    ]);
  });

  it("includes every MES Workforce destination", () => {
    expect(workforce.map((page) => page.url)).toEqual([
      "/users", "/assignments", "/skills", "/shifts",
    ]);
  });
});

describe("Advanced planning navigation", () => {
  it("maps each preserved APS page to the same server resource as its route", () => {
    expect(Object.fromEntries(advancedPlanning.map(({ url, permission }) => [url, permission])))
      .toEqual(apsRouteResources);
  });

  it("shows only granted APS pages for an active identity", () => {
    const access: MyAccess = {
      email: "planner@example.test",
      hubConnected: true,
      active: true,
      roles: ["planner"],
      fullName: "Planning Fixture",
      permissions: {
        capacity: { view: true, create: false, edit: false, delete: false },
        approvals: { view: false, create: false, edit: true, delete: false },
      },
      message: null,
    };
    expect(visibleAdvancedPlanning(access).map((page) => page.url)).toEqual(["/aps/capacity"]);
    expect(visibleAdvancedPlanning({ ...access, active: false })).toEqual([]);
    expect(visibleAdvancedPlanning(undefined)).toEqual([]);
  });
});
