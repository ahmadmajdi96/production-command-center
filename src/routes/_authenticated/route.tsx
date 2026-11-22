import { createFileRoute, Outlet, Navigate, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ChevronRight, LogOut, User as UserIcon, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { CommandPalette } from "@/components/command-palette";
import { ApsThemeToggle } from "@/components/aps/appearance";
import { NotificationBell } from "@/components/notification-bell";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, visibleAdvancedPlanning } from "@/components/app-sidebar";
import { useMyApsAccess } from "@/lib/aps/client";
import type { MyAccess as ApsAccess } from "@/lib/aps/resources";
import { getMyAccess } from "@/lib/mes/authz.functions";
import { AccessProvider } from "@/lib/access";
import { IdleSignout } from "@/components/idle-signout";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});


function initials(name: string) {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function TopBar({
  mesAvailable,
  apsAccess,
}: {
  mesAvailable: boolean;
  apsAccess?: ApsAccess;
}) {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user.id],
    enabled: mesAvailable,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, job_title, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["my-roles", user.id],
    enabled: mesAvailable,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return (data ?? []).map((r) => r.role as string);
    },
  });

  const name = profile?.full_name || apsAccess?.fullName || user.email || "User";
  const subtitle = profile?.job_title || roles?.[0] || apsAccess?.roles[0] || "Member";

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/70 px-2 backdrop-blur-xl sm:gap-3 sm:px-4">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <div className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
        <span>Riyadh HQ</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Plant 01</span>
        <ChevronRight className="h-3 w-3" />
        <span>Shift A · 06:00 → 14:00</span>
      </div>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Search everything"
          className="flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-2.5 text-sm text-muted-foreground transition hover:border-primary/50 md:w-64"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden flex-1 text-left md:inline">Search everything…</span>
          <kbd className="hidden rounded border border-border/60 px-1.5 font-mono text-[10px] md:inline">Ctrl K</kbd>
        </button>
        <CommandPalette
          open={searchOpen}
          onOpenChange={setSearchOpen}
          mesAvailable={mesAvailable}
          apsAccess={apsAccess}
        />
        <ApsThemeToggle />
        {mesAvailable ? (
          <>
            <NotificationBell userId={user.id} />
            <Link
          to="/profile"
          className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-2 py-1 transition hover:border-primary/50"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-6 w-6 rounded-md object-cover" />
          ) : (
            <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-primary to-info text-[10px] font-bold text-primary-foreground">
              {initials(name)}
            </div>
          )}
          <div className="hidden text-xs leading-tight sm:block">
            <div className="font-medium">{name}</div>
            <div className="text-[10px] text-muted-foreground">{subtitle}</div>
          </div>
          <UserIcon className="h-3.5 w-3.5 text-muted-foreground sm:hidden" />
            </Link>
          </>
        ) : (
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-border/60 bg-card/60 text-xs" title={name} aria-label={name}>
            {initials(name)}
          </div>
        )}
        <button
          onClick={handleSignOut}
          title="Sign out"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function NoAccess({ email }: { email?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="glass-panel max-w-md rounded-2xl p-8 text-center">
        <ShieldAlert className="mx-auto mb-4 h-8 w-8 text-warning" />
        <h1 className="font-display text-xl font-semibold">Access not yet assigned</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account{email ? ` (${email})` : ""} is signed in. Ask an administrator for a production role in MES or an APS role in the Command Access Hub.
        </p>
        <button
          onClick={async () => {
            await queryClient.cancelQueries();
            queryClient.clear();
            await supabase.auth.signOut();
            navigate({ to: "/auth", replace: true });
          }}
          className="mt-6 rounded-lg border border-border/60 bg-card/60 px-4 py-2 text-sm"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const pathname = useRouterState({ select: (router) => router.location.pathname });
  const { data: access, isLoading, error } = useQuery({
    queryKey: ["my-access", user.id],
    queryFn: () => getMyAccess(),
    staleTime: 60_000,
  });

  const aps = useMyApsAccess({ userId: user.id });
  const mesAvailable = Boolean(
    !error && access?.userId === user.id &&
    (access.grants.length > 0 || access.permissions.includes("platform.admin")),
  );
  const signedInEmail = user.email?.trim().toLowerCase();
  const apsAccess =
    !aps.isError && signedInEmail && aps.data?.email.trim().toLowerCase() === signedInEmail
      ? aps.data
      : undefined;
  const apsPage = visibleAdvancedPlanning(apsAccess)[0];
  const apsPath = pathname === "/aps" || pathname.startsWith("/aps/");

  if (!mesAvailable && !apsPage && (isLoading || aps.isPending)) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Checking your access…
      </div>
    );
  }
  if (!mesAvailable && !apsPage) {
    if (error || aps.isError) {
      return (
        <div className="grid min-h-screen place-items-center p-6 text-center text-sm text-destructive">
          Could not verify your access. Please reload the page.
        </div>
      );
    }
    return <NoAccess email={user.email ?? undefined} />;
  }
  if (!mesAvailable && !apsPath && (pathname === "/scheduling" || pathname === "/")) {
    return <Navigate to={apsPage?.url ?? "/aps"} replace />;
  }

  const mesAccess = mesAvailable && access
    ? access
    : { userId: user.id, email: user.email ?? null, displayName: null, permissions: [], grants: [] };

  return (
    <AccessProvider access={mesAccess}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar mesAvailable={mesAvailable} apsAccess={apsAccess} />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar mesAvailable={mesAvailable} apsAccess={apsAccess} />
            <main className="flex-1 p-4 sm:p-6">
              {mesAvailable || apsPath ? (
                <Outlet />
              ) : (
                <section className="glass-panel mx-auto max-w-lg rounded-2xl p-6 text-center">
                  <ShieldAlert className="mx-auto mb-3 h-7 w-7 text-warning" aria-hidden />
                  <h1 className="font-display text-xl font-semibold">Production workspace access required</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    An MES role is required to view production management and workforce pages.
                  </p>
                  <Link
                    to={apsPage?.url ?? "/aps"}
                    className="mt-4 inline-flex rounded-lg border border-border/60 bg-card/60 px-4 py-2 text-sm"
                  >
                    Open advanced planning
                  </Link>
                </section>
              )}
            </main>
            <IdleSignout />
          </div>
        </div>
      </SidebarProvider>
    </AccessProvider>
  );
}

