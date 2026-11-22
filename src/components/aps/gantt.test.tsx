import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ScheduleItem } from "@/lib/aps/engine";
import { Gantt } from "./gantt";

const archivedOperation: ScheduleItem = {
  key: "MO-42:10",
  orderId: "order-42",
  po: "MO-42",
  sku: "TABLET-500",
  product: "Tablet 500",
  family: "tablets",
  seq: 10,
  op: "Blend",
  machine: "MIX-ARCHIVED",
  line: "Line 2",
  operator: "OP-4",
  start: "2026-11-22T07:00:00Z",
  end: "2026-11-22T08:00:00Z",
  process_min: 45,
  setup_min: 15,
  changeover_min: 0,
  qty: 500,
  due: "2026-11-22T10:00:00Z",
};

describe("APS Gantt", () => {
  it("keeps a saved operation visible when its machine is absent from the current catalogue", () => {
    const markup = renderToStaticMarkup(<Gantt items={[archivedOperation]} machines={[]} />);
    expect(markup).toContain("MIX-ARCHIVED");
    expect(markup).toContain("Line 2");
    expect(markup).toContain("MO-42");
    expect(markup).toContain("width:25%");
  });
});
