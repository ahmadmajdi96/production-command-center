import type { HTMLAttributes, ReactNode } from "react";

/** Reference to a record managed in MES Command Center (not part of PMS). Rendered as plain text. */
export function MesRef({ to: _to, params: _p, search: _s, children, ...rest }: { to?: string; params?: unknown; search?: unknown; children?: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return <span {...rest}>{children}</span>;
}
