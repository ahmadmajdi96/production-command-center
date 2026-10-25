import type { ReactNode } from "react";

/** Reference to a record managed in MES Command Center (not part of PMS). Rendered as plain text. */
export function MesRef({ className, title, children }: { to?: string; params?: unknown; search?: unknown; className?: string; title?: string; children?: ReactNode }) {
  return <span className={className} title={title}>{children}</span>;
}
