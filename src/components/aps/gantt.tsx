import type { ScheduleItem } from "@/lib/aps/engine";
import { Empty, fmt, mins } from "./kit";

const palette = [
  "bg-chart-1/80 border-chart-1",
  "bg-chart-2/80 border-chart-2",
  "bg-chart-3/80 border-chart-3",
  "bg-chart-5/80 border-chart-5",
  "bg-chart-4/80 border-chart-4",
];

export function Gantt({
  items,
  machines,
}: {
  items: ScheduleItem[];
  machines: { code: string; name: string; line: string }[];
}) {
  if (!items.length) return <Empty>No operations scheduled.</Empty>;
  const t0 = Math.min(...items.map((i) => Date.parse(i.start)));
  const t1 = Math.max(...items.map((i) => Date.parse(i.end)));
  const span = Math.max(t1 - t0, 3_600_000);
  const families = Array.from(new Set(items.map((i) => i.family)));
  const ticks = Array.from({ length: 7 }, (_, k) => t0 + (span * k) / 6);
  const byMachine = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const list = byMachine.get(item.machine);
    if (list) list.push(item);
    else byMachine.set(item.machine, [item]);
  }
  const machineByCode = new Map(machines.map((machine) => [machine.code, machine]));
  const rows = Array.from(byMachine, ([code, operations]) => ({
    code,
    line: machineByCode.get(code)?.line ?? operations[0].line,
    operations,
  }));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {families.map((f, k) => (
          <span key={f} className="flex items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-sm border ${palette[k % palette.length]}`} />
            {f}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-destructive" />
          setup / changeover
        </span>
      </div>
      <div
        role="region"
        aria-label="Schedule timeline by machine"
        tabIndex={0}
        className="overflow-x-auto rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <div className="min-w-[760px]">
          <div className="ml-28 flex justify-between text-[10px] text-muted-foreground">
            {ticks.map((t) => (
              <span key={t}>{fmt(new Date(t).toISOString())}</span>
            ))}
          </div>
          {rows.map((m) => (
            <div key={m.code} className="flex items-center border-t border-border/40 py-1.5">
              <div className="w-28 shrink-0 pr-2 text-[11px]">
                <div className="font-medium">{m.code}</div>
                <div className="text-[10px] text-muted-foreground">{m.line}</div>
              </div>
              <div className="relative h-8 flex-1 rounded-md bg-muted/30">
                {m.operations.map((i) => {
                  const left = ((Date.parse(i.start) - t0) / span) * 100;
                  const width = Math.max(
                    ((Date.parse(i.end) - Date.parse(i.start)) / span) * 100,
                    0.4,
                  );
                  const total = (Date.parse(i.end) - Date.parse(i.start)) / 60000;
                  const preparation = i.changeover_min + i.setup_min;
                  const preparationPct = total ? (preparation / total) * 100 : 0;
                  return (
                    <div
                      key={i.key}
                      title={`${i.po} · ${i.op}\n${fmt(i.start)} → ${fmt(i.end)}\nProcess ${i.process_min}m · Setup ${i.setup_min}m · Changeover ${i.changeover_min}m\nOperator: ${i.operator ?? "—"}`}
                      className={`absolute top-0.5 flex h-7 overflow-hidden rounded border text-[10px] font-medium text-primary-foreground ${palette[families.indexOf(i.family) % palette.length]}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    >
                      {preparation > 0 && (
                        <span
                          className="h-full shrink-0 bg-destructive/80"
                          style={{ width: `${preparationPct}%` }}
                        />
                      )}
                      <span className="truncate px-1 leading-7">{i.po}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Span {mins(span / 60000)} · hover a bar for details
      </p>
    </div>
  );
}
