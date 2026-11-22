import { tzOffsetMinutes, type Order, type PlantData, type Rule } from "./engine";

export type OrderRow = Order & { order_revision?: number };

/** Loads all planning inputs plus plant settings with the given client. */
export async function loadPlant(sb: any) {
  const tables = ["products", "materials", "machines", "shifts", "operators", "maintenance_events", "changeovers", "production_orders", "business_rules", "app_settings"];
  const res = await Promise.all(tables.map((t) => sb.from(t).select("*")));
  for (const r of res) if (r.error) throw new Error(r.error.message);
  const [products, materials, machines, shifts, operators, maintenance, changeovers, orders, rules, settings] = res;
  const num = (rows: any[], keys: string[]) => rows.map((r) => ({ ...r, ...Object.fromEntries(keys.map((k) => [k, r[k] == null ? r[k] : Number(r[k])])) }));
  const setting = (k: string) => (settings.data as { key: string; value: unknown }[]).find((s) => s.key === k)?.value;
  const timezone = (setting("plant_timezone") as string) || "UTC";
  const data: PlantData = {
    products: products.data, materials: num(materials.data, ["on_hand", "on_hold", "expected_qty"]), machines: num(machines.data, ["rate_per_hour"]),
    shifts: num(shifts.data, ["break_start_hour"]), operators: operators.data, maintenance: maintenance.data, changeovers: changeovers.data,
    tzOffsetMin: tzOffsetMinutes(timezone),
  };
  return { data, orders: num(orders.data, ["quantity"]) as OrderRow[], rules: rules.data as Rule[], timezone };
}
