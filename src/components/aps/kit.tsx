import { useRef, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
export { btn, ghost, inp } from "@/components/qp-ui";

// Shared control styles, matching MES Command Center.
export const lbl = "block space-y-1 text-[11px] text-muted-foreground";
export const th =
  "px-2 py-2 text-left text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground";
export const td = "px-2 py-2 align-top text-xs";

export function PageHead({
  icon,
  title,
  desc,
  children,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          {icon}
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass-panel min-w-0 rounded-2xl p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && (
            <h2 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        onOpenAutoFocus={() => {
          opener.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          if (opener.current?.isConnected) {
            event.preventDefault();
            opener.current.focus();
          }
        }}
        className={`glass-panel max-h-[90vh] w-[calc(100%_-_2rem)] overflow-y-auto rounded-2xl ${wide ? "max-w-3xl" : "max-w-lg"}`}
      >
        <DialogTitle className="font-display">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export const tones: Record<string, string> = {
  primary: "border-primary/40 bg-primary/10 text-primary",
  info: "border-info/40 bg-info/10 text-info",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
  muted: "border-border/60 bg-muted/40 text-muted-foreground",
};

export function Chip({
  tone = "primary",
  children,
}: {
  tone?: string | undefined;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${tones[tone] ?? tones["primary"]}`}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "primary",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: string;
}) {
  const color: Record<string, string> = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    info: "text-info",
  };
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl font-semibold ${color[tone] ?? ""}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export const feasTone: Record<string, string> = {
  feasible: "success",
  conditional: "warning",
  not_feasible: "destructive",
};
export const feasLabel: Record<string, string> = {
  feasible: "Feasible",
  conditional: "Conditionally feasible",
  not_feasible: "Not feasible",
};
export const statusTone: Record<string, string> = {
  draft: "muted",
  pending_approval: "warning",
  approved: "success",
  rejected: "destructive",
  superseded: "info",
};
export const sevTone: Record<string, string> = {
  high: "destructive",
  medium: "warning",
  low: "info",
};

export const fmt = (s?: string | null) =>
  s ? new Date(s).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "—";
export const mins = (m: number) =>
  m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${Math.round(m)}m`;
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

export function fmtRange(s: string | null) {
  if (!s) return "—";
  return s.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, (m) => fmt(m));
}

type QueryStatusModel = {
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
};

export function needsQueryStatus(queries: QueryStatusModel[]) {
  return queries.some((query) => query.isPending || query.isError);
}

export function QueryStatus({
  queries,
  subject,
}: {
  queries: QueryStatusModel[];
  subject: string;
}) {
  const failures = queries.filter((query) => query.isError);
  if (!failures.length) {
    return (
      <div className="glass-panel rounded-2xl p-5 text-sm text-muted-foreground" role="status">
        Loading {subject}…
      </div>
    );
  }
  return (
    <Alert variant="destructive">
      <AlertTitle>Couldn’t load {subject}</AlertTitle>
      <AlertDescription>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2"
          disabled={failures.some((query) => query.isFetching)}
          onClick={() => void Promise.all(failures.map((query) => query.refetch()))}
        >
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
