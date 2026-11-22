import { ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const signature = "Find a sequence the plant can run.";
const portrait = "/brand/planner-440.webp";

export function ManuQubeEmblem() {
  return (
    <img
      src="/brand/manuqube-emblem.png"
      alt=""
      width={44}
      height={37}
      className="size-10 shrink-0 object-contain"
    />
  );
}

function Portrait({ className, priority = false }: { className: string; priority?: boolean }) {
  return (
    <img
      src={portrait}
      alt="Planner, the violet robot with wing-shaped displays"
      width={440}
      height={583}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={className}
    />
  );
}

export function PlannerWelcome() {
  return (
    <aside
      aria-labelledby="planner-welcome"
      className="aps-brand-stage overflow-hidden rounded-2xl p-5 sm:p-7"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(4.5rem,28%)] items-center gap-4 lg:grid-cols-1">
        <div>
          <p id="planner-welcome" className="mb-2 text-sm font-semibold text-planner">
            Planner
          </p>
          <p className="max-w-sm text-xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {signature}
          </p>
        </div>
        <picture>
          <source media="(min-width: 64rem)" srcSet="/brand/planner-759.webp" />
          <Portrait
            className="aspect-square w-full rounded-lg object-cover object-[50%_32%] lg:mx-auto lg:max-h-[23rem] lg:w-auto lg:max-w-full lg:aspect-auto"
            priority
          />
        </picture>
      </div>
    </aside>
  );
}

export function PlannerBanner() {
  return (
    <aside
      aria-labelledby="planner-dashboard"
      className="aps-brand-stage flex items-center justify-between gap-4 rounded-xl px-4 py-3 sm:gap-7 sm:px-6"
    >
      <div className="min-w-0">
        <p id="planner-dashboard" className="text-sm font-semibold text-planner">
          Planner
        </p>
        <p className="mt-1 text-base font-semibold leading-snug sm:text-xl">{signature}</p>
        <p className="mt-1 text-sm text-ivory/75">
          Compare capacity, material availability, and holds before releasing a schedule.
        </p>
      </div>
      <Portrait className="size-16 shrink-0 rounded-lg border border-ivory/15 object-cover object-[50%_36%] sm:size-24" />
    </aside>
  );
}

export function PlannerPresence() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Meet Planner"
          className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-sidebar-border p-1.5 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:p-0"
        >
          <img
            src={portrait}
            width={36}
            height={36}
            alt=""
            className="size-9 shrink-0 rounded-md object-cover object-[50%_29%]"
          />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
            Planner
          </span>
          <ArrowUpRight
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
          />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto">
        <DialogTitle className="pr-10">Meet Planner</DialogTitle>
        <DialogDescription>
          Planning guidance for feasibility, constraints, and schedule release.
        </DialogDescription>
        <div className="aps-brand-stage flex items-center gap-4 rounded-xl p-4">
          <Portrait className="w-20 shrink-0 rounded-lg sm:w-28" />
          <p className="text-lg font-semibold leading-tight text-ivory">{signature}</p>
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-semibold">Compare sequences</dt>
            <dd className="text-muted-foreground">
              Check how a change affects due dates, capacity, and changeovers.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Review before release</dt>
            <dd className="text-muted-foreground">
              Keep quality holds in force. Release a schedule only after an authorized planner approves it.
            </dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
