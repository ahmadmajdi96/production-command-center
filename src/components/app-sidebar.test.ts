import { describe, expect, it } from "vitest";
import { planning, workforce } from "./app-sidebar";

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