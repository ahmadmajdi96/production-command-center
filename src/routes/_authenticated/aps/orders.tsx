import { needsQueryStatus, QueryStatus } from "@/components/aps/kit";
import { useListControls } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { ClipboardList, ChevronDown, ChevronRight, Lock } from "lucide-react";
import {
  Chip,
  Empty,
  Panel,
  PageHead,
  feasLabel,
  feasTone,
  fmt,
  inp,
  mins,
  td,
  th,
} from "@/components/aps/kit";
import { usePreview, useTable } from "@/lib/aps/client";
import { orderExecutionMinutes, type Order, type Product, type Machine } from "@/lib/aps/engine";

export const Route = createFileRoute("/_authenticated/aps/orders")({
  head: () => ({
    meta: [
      { title: "Orders & Feasibility · APS" },
      { name: "description", content: "MES production orders with feasibility assessment." },
    ],
  }),
  component: Orders,
});

type Row = Order & {
  source: string;
  updated_at: string;
  order_revision?: number;
  sales_order_ref?: string | null;
};

function Orders() {
  const orderQuery = useTable<Row>("production_orders", { column: "due_date" });
  const { data: orders = [] } = orderQuery;
  const productsQuery = useTable<Product>("products");
  const machinesQuery = useTable<Machine>("machines");
  const { data: products = [] } = productsQuery;
  const { data: machines = [] } = machinesQuery;
  const preview = usePreview("orders");
  const plan = preview.data;
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const feasibility = new Map(plan?.feasibility.map((result) => [result.orderId, result]));
  const productsBySku = new Map(products.map((product) => [product.sku, product]));
  const rows = orders
    .filter((order) => filter === "all" || feasibility.get(order.id)?.status === filter)
    .map((order) => ({ ...order, productName: productsBySku.get(order.sku)?.name }));
  const list = useListControls(rows, {
    searchKeys: ["po_number", "sku", "productName", "sales_order_ref"],
    searchLabel: "Search orders",
    hideExport: true,
  });

  const queries = [orderQuery, productsQuery, machinesQuery, preview];
  if (needsQueryStatus(queries))
    return <QueryStatus queries={queries} subject="order feasibility" />;

  return (
    <>
      <PageHead
        icon={<ClipboardList className="h-6 w-6 text-primary" />}
        title="Orders & Feasibility"
        desc="Orders received from MES, checked against materials, BOM, routing, recipe, machines, operators and shifts."
      >
        <select
          aria-label="Filter by feasibility"
          className={`${inp} w-48`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All orders</option>
          <option value="feasible">Feasible</option>
          <option value="conditional">Conditionally feasible</option>
          <option value="not_feasible">Not feasible</option>
        </select>
      </PageHead>
      <div className="flex items-start gap-2 rounded-xl border border-info/30 bg-info/10 px-3 py-2 text-xs text-info">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Order quantity, due date, priority and status are owned by MES Command Central and can
          only be changed there. APS reads each new revision and owns the planned placement and
          feasibility result.
        </span>
      </div>
      {list.toolbar}
      {list.visible.length ? (
        <Panel>
          <div className="overflow-x-auto">
            <Table className="w-full min-w-[860px]">
              <TableHeader>
                <TableRow className="border-b border-border/60">
                  <TableHead className={th} />
                  <TableHead className={th}>Order</TableHead>
                  <TableHead className={th}>Product / SKU</TableHead>
                  <TableHead className={th}>Qty</TableHead>
                  <TableHead className={th}>Due</TableHead>
                  <TableHead className={th}>Priority</TableHead>
                  <TableHead className={th}>Status</TableHead>
                  <TableHead className={th}>Est. time</TableHead>
                  <TableHead className={th}>Feasibility</TableHead>
                  <TableHead className={th}>Revision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.visible.map((o) => {
                  const f = feasibility.get(o.id);
                  const p = productsBySku.get(o.sku);
                  const est = p
                    ? orderExecutionMinutes(
                        { ...o, quantity: Number(o.quantity) },
                        p,
                        machines.map((m) => ({ ...m, rate_per_hour: Number(m.rate_per_hour) })),
                      )
                    : 0;
                  return (
                    <Fragment key={o.id}>
                      <TableRow key={o.id} className="border-b border-border/30 hover:bg-muted/20">
                        <TableCell className={td}>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setOpen(open === o.id ? null : o.id)}
                            aria-label={`Details for ${o.po_number}`}
                            aria-expanded={open === o.id}
                          >
                            {open === o.id ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className={`${td} font-mono`}>
                          {o.po_number}
                          <div className="text-[10px] text-muted-foreground">{o.source}</div>
                        </TableCell>
                        <TableCell className={td}>
                          {p?.name ?? "—"}
                          <div className="font-mono text-[10px] text-muted-foreground">{o.sku}</div>
                        </TableCell>
                        <TableCell className={td}>{Number(o.quantity).toLocaleString()}</TableCell>
                        <TableCell className={td}>{fmt(o.due_date)}</TableCell>
                        <TableCell className={td}>
                          <Chip
                            tone={
                              o.priority <= 1
                                ? "destructive"
                                : o.priority <= 2
                                  ? "warning"
                                  : "muted"
                            }
                          >
                            P{o.priority}
                          </Chip>
                        </TableCell>
                        <TableCell className={td}>{o.status.replace("_", " ")}</TableCell>
                        <TableCell className={td}>{est ? mins(est) : "—"}</TableCell>
                        <TableCell className={td}>
                          {f ? (
                            <Chip tone={feasTone[f.status]}>{feasLabel[f.status]}</Chip>
                          ) : (
                            <span className="text-muted-foreground">excluded</span>
                          )}
                        </TableCell>
                        <TableCell className={`${td} text-[10px] text-muted-foreground`}>
                          rev {o.order_revision ?? 1}
                          {o.sales_order_ref ? (
                            <div className="font-mono">{o.sales_order_ref}</div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                      {open === o.id && (
                        <TableRow
                          key={`${o.id}-d`}
                          className="border-b border-border/30 bg-muted/10"
                        >
                          <TableCell />
                          <TableCell colSpan={9} className="p-3">
                            {!f ? (
                              <p className="text-xs text-muted-foreground">
                                Order is {o.status} and not part of planning.
                              </p>
                            ) : (
                              <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                  <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                    Checks
                                  </div>
                                  <ul className="space-y-1 text-xs">
                                    {f.issues.length === 0 && (
                                      <li className="text-success">
                                        Material, BOM, routing, recipe, machine, operator, shift and
                                        machine-status checks passed.
                                      </li>
                                    )}
                                    {f.issues.map((i, k) => (
                                      <li key={k} className="flex gap-2">
                                        <Chip
                                          tone={
                                            i.severity === "blocking"
                                              ? "destructive"
                                              : i.severity === "condition"
                                                ? "warning"
                                                : "info"
                                          }
                                        >
                                          {i.check}
                                        </Chip>
                                        <span>{i.message}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                    Routing & time
                                  </div>
                                  <ul className="space-y-1 text-xs text-muted-foreground">
                                    {p?.routing.map((s) => (
                                      <li key={s.seq}>
                                        {s.seq} · {s.name} on {s.machine_type} — RMS {s.process_min}
                                        m + setup {s.setup_min}m
                                        {s.min_gap_after ? `, wait ${s.min_gap_after}m after` : ""}{" "}
                                        · skill {s.skill}
                                      </li>
                                    ))}
                                  </ul>
                                  {f.missingMaterials.length > 0 && (
                                    <p className="mt-2 text-xs text-destructive">
                                      Missing:{" "}
                                      {f.missingMaterials
                                        .map(
                                          (m) =>
                                            `${m.code} ${Math.round(m.short).toLocaleString()} ${m.uom}`,
                                        )
                                        .join(", ")}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Panel>
      ) : (
        <Empty>
          {orders.length
            ? "No orders match these filters."
            : "No production orders have been received from MES."}
        </Empty>
      )}
      {list.pager}
    </>
  );
}
