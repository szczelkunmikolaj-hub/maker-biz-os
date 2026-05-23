import {
  LayoutDashboard, FolderKanban, Columns3, Receipt, Calculator, Settings, BookTemplate, Upload, Calendar, Package, Database, Truck, ExternalLink, LogOut, FlaskConical,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import { HelpTip } from "@/components/HelpTip";
import { Switch } from "@/components/ui/switch";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, hint: "Overview of your revenue, profit, material usage, and print performance." },
  { title: "Projects", url: "/projects", icon: FolderKanban, hint: "Create and manage all your 3D printing orders from start to delivery." },
  { title: "Customer Orders", url: "https://prints-barcelona-pro.lovable.app/admin-orders", icon: Truck, external: true },
  { title: "Kanban Board", url: "/kanban", icon: Columns3, hint: "Drag projects through status columns to track their progress visually." },
  { title: "Calendar", url: "/calendar", icon: Calendar, hint: "See your project deadlines laid out on a monthly calendar." },
  { title: "Expenses", url: "/expenses", icon: Receipt, hint: "Log costs like filament and shipping to track your real net profit." },
  { title: "Filament", url: "/filament", icon: Package, hint: "Record filament purchases to calculate accurate material costs per project." },
  { title: "Templates", url: "/templates", icon: BookTemplate },
  { title: "Import Queue", url: "/import", icon: Upload },
  { title: "Quote Generator", url: "/quote", icon: Calculator },
  { title: "Data", url: "/data", icon: Database },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isDemoMode, toggleDemoMode } = useDemo();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <span className="text-sidebar-primary-foreground font-bold text-sm" style={{ fontFamily: 'Space Grotesk' }}>PT</span>
            </div>
            <span className="font-bold text-lg text-sidebar-foreground" style={{ fontFamily: 'Space Grotesk' }}>PrintTrack</span>
          </div>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center mx-auto">
            <span className="text-sidebar-primary-foreground font-bold text-sm" style={{ fontFamily: 'Space Grotesk' }}>PT</span>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title} className="relative">
                  <SidebarMenuButton asChild>
                    {item.external ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:bg-sidebar-accent flex items-center gap-2"
                        title={item.title}
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && (
                          <>
                            <span className="flex-1">{item.title}</span>
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </>
                        )}
                      </a>
                    ) : (
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    )}
                  </SidebarMenuButton>
                  {!collapsed && item.hint && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                      <HelpTip text={item.hint} side="right" />
                    </span>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2 border-t">
        {!collapsed && user && (
          <div className="px-2 py-1.5 text-xs text-sidebar-foreground/70 truncate">{user.email}</div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleDemoMode}
              className={`hover:bg-sidebar-accent ${isDemoMode ? 'text-yellow-600 dark:text-yellow-400' : ''}`}
              title="Demo mode"
            >
              <FlaskConical className="h-4 w-4" />
              {!collapsed && (
                <>
                  <span className="flex-1">Demo mode</span>
                  <Switch
                    checked={isDemoMode}
                    className="h-4 w-7 pointer-events-none [&>span]:h-3 [&>span]:w-3 data-[state=checked]:[&>span]:translate-x-3"
                    tabIndex={-1}
                  />
                </>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut()} className="hover:bg-sidebar-accent" title="Sign out">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sign out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
