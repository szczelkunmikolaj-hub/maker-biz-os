import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { useMonth } from "@/context/MonthContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Switch } from "@/components/ui/switch";

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
  const { mode, setMode, label, prevMonth, nextMonth } = useMonth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card/80 backdrop-blur-sm px-4 shrink-0 sticky top-0 z-10">
            <SidebarTrigger />
            {title && <span className="ml-3 text-sm font-medium text-muted-foreground">{title}</span>}

            {/* Global month selector */}
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                <label className="text-xs text-muted-foreground cursor-pointer select-none" htmlFor="month-toggle">
                  {mode === 'all' ? 'All Time' : 'Monthly'}
                </label>
                <Switch
                  id="month-toggle"
                  checked={mode === 'month'}
                  onCheckedChange={(checked) => setMode(checked ? 'month' : 'all')}
                  className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
                />
              </div>

              {mode === 'month' && (
                <div className="flex items-center gap-1 ml-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-sm font-medium min-w-[120px] text-center">{label}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6 animate-fade-in">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
