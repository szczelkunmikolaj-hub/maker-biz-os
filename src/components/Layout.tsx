import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/projects": "Projects",
  "/kanban": "Kanban Board",
  "/calendar": "Calendar",
  "/expenses": "Expenses",
  "/filament": "Filament",
  "/templates": "Templates",
  "/import": "Import Queue",
  "/quote": "Quote Generator",
  "/settings": "Settings",
};

export function Layout() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || "";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card/80 backdrop-blur-sm px-4 shrink-0 sticky top-0 z-10">
            <SidebarTrigger />
            {title && <span className="ml-3 text-sm font-medium text-muted-foreground">{title}</span>}
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6 animate-fade-in">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
