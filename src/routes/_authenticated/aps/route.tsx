import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { Lock, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { apsResourceForPath } from "@/components/aps/navigation";
import { AccessContext, useMyApsAccess } from "@/lib/aps/client";
import { can } from "@/lib/aps/resources";

export const Route = createFileRoute("/_authenticated/aps")({
  component: ApsLayout,
});

function ApsLayout() {
  const { user } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const {
    data: access,
    isPending,
    isError,
    isFetching,
    refetch,
  } = useMyApsAccess({
    userId: user.id,
  });

  if (isPending) {
    return (
      <div className="glass-panel rounded-2xl p-6 text-sm text-muted-foreground" role="status">
        Checking access to advanced planning and scheduling…
      </div>
    );
  }

  if (isError || !access?.active) {
    return (
      <section className="glass-panel mx-auto max-w-lg rounded-2xl p-6 text-center">
        <ShieldAlert aria-hidden className="mx-auto mb-3 size-7 text-warning" />
        <h1 className="font-display text-xl font-semibold">APS access unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isError
            ? "Your Command Access Hub permissions could not be checked."
            : (access?.message ?? "Your account needs an APS role in the Command Access Hub.")}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isFetching}
          className="mt-4"
          onClick={() => void refetch()}
        >
          Retry access check
        </Button>
      </section>
    );
  }

  const resource = apsResourceForPath(pathname);
  if (!resource || !can(access, resource)) {
    return (
      <section className="glass-panel mx-auto max-w-lg rounded-2xl p-6 text-center">
        <Lock aria-hidden className="mx-auto mb-3 size-7 text-muted-foreground" />
        <h1 className="font-display text-xl font-semibold">Page access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your Command Access Hub role does not include this APS page.
        </p>
      </section>
    );
  }

  return (
    <AccessContext.Provider value={access}>
      {access.message && (
        <Alert className="mb-4 border-warning/30 bg-warning/10 text-warning">
          <AlertDescription>{access.message}</AlertDescription>
        </Alert>
      )}
      <Outlet />
    </AccessContext.Provider>
  );
}
