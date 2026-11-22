import type { ReactNode } from "react";

// Adapted from the ManuQube OMS page shell. Colors follow the active APS theme.
export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-1 basis-72 items-start gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/8 text-primary [&>svg]:size-5"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="text-pretty font-display text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-1 max-w-[68ch] text-pretty text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {actions && (
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
