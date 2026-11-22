import { Link, useRouterState } from "@tanstack/react-router";
import { can, type MyAccess as ApsAccess, type ResourceKey } from "@/lib/aps/resources";
import {
  LayoutDashboard,
  Factory,
  ClipboardList,
  PlayCircle,
  GitBranch,
  AlertOctagon,
  Activity,
  ShieldCheck,
  Settings,


  Boxes,
  Users,
  UserCog,
  ListChecks,
  History,
  Radio,
  Cpu,
  Package,
  CalendarDays,
  ScanLine,
  MonitorCog,
  HardHat,
  ClipboardCheck,
  Trash2,
  BookOpen,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export const overview: { title: string; url: string; icon: typeof CalendarDays }[] = [];

export const planning = [
  { title: "Products", url: "/products", icon: Package },
  { title: "Recipes", url: "/recipes", icon: ClipboardCheck },
  { title: "Production Orders", url: "/production-orders", icon: ClipboardList },
  { title: "Planner", url: "/planner", icon: CalendarDays },
  { title: "Scheduling & Capacity", url: "/scheduling", icon: CalendarDays },
  { title: "Reports & Compliance", url: "/reports", icon: ClipboardCheck },
  { title: "Inventory", url: "/inventory", icon: Package },
];

export const workforce = [
  { title: "Users", url: "/users", icon: Users },
  { title: "Assignments", url: "/assignments", icon: UserCog },
  { title: "Skills & Certifications", url: "/skills", icon: ListChecks },
  { title: "Shifts", url: "/shifts", icon: CalendarDays },
];

export const advancedPlanning = [
  { title: "Planning Overview", url: "/aps", icon: LayoutDashboard, permission: "dashboard" },
  { title: "Order Feasibility", url: "/aps/orders", icon: ClipboardList, permission: "orders" },
  { title: "Production Schedule", url: "/aps/schedule", icon: CalendarDays, permission: "schedule" },
  { title: "Finite Capacity", url: "/aps/capacity", icon: Activity, permission: "capacity" },
  { title: "Schedule Conflicts", url: "/aps/conflicts", icon: AlertOctagon, permission: "conflicts" },
  { title: "Plant Resources", url: "/aps/resources", icon: Factory, permission: "resources" },
  { title: "Planning Rules", url: "/aps/rules", icon: ListChecks, permission: "business-rules" },
  { title: "Schedule Versions", url: "/aps/versions", icon: GitBranch, permission: "versions" },
  { title: "Approvals & E-Signature", url: "/aps/approvals", icon: ShieldCheck, permission: "approvals" },
  { title: "Audit Trail", url: "/aps/audit", icon: History, permission: "audit" },
  { title: "Data Integrations", url: "/aps/integrations", icon: Radio, permission: "integrations" },
  { title: "Standards & Ownership", url: "/aps/compliance", icon: BookOpen, permission: "compliance" },
] as const satisfies readonly { title: string; url: string; icon: typeof CalendarDays; permission: ResourceKey }[];

export function visibleAdvancedPlanning(access: ApsAccess | undefined) {
  return access?.active ? advancedPlanning.filter((item) => can(access, item.permission)) : [];
}

export const execution: typeof overview = [];
export const monitoring: typeof overview = [];
export const platform: typeof overview = [];

export function AppSidebar({
  mesAvailable,
  apsAccess,
}: {
  mesAvailable: boolean;
  apsAccess?: ApsAccess;
}) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const apsPages = visibleAdvancedPlanning(apsAccess);
  const isActive = (url: string) =>
    path === url || path === url + "/" || (url !== "/aps" && path.startsWith(url + "/"));

  const renderGroup = (label: string, items: Readonly<typeof overview>) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = isActive(item.url);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:border data-[active=true]:border-primary/30 rounded-lg h-10"
                >
                  <Link to={item.url} className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <Link to={mesAvailable ? "/" : (apsPages[0]?.url ?? "/aps")} className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-[var(--shadow-glow)]">
            <Factory className="h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight">Cortanex APS</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Advanced Planning & Scheduling
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2">
        {mesAvailable && renderGroup("Planning", planning)}
        {apsPages.length > 0 && renderGroup("Advanced planning", apsPages)}
        {mesAvailable && renderGroup("Workforce", workforce)}
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="rounded-xl border border-border/60 bg-card/60 p-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 text-xs">
            <span className="status-dot animate-pulse-glow text-success" />
            <span className="font-medium">{mesAvailable ? "Edge gateway online" : "APS access verified"}</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {mesAvailable ? "6 plants · 24 lines streaming" : "Command Access Hub"}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
