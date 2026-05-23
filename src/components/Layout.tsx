import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useMonth } from "@/context/MonthContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalStatusBar } from "@/components/GlobalStatusBar";
import { CommandPalette } from "@/components/CommandPalette";
import { WelcomeModal } from "@/components/WelcomeModal";
import { useDemo } from "@/context/DemoContext";
import { useTranslation } from "react-i18next";

export function Layout() {
  const location = useLocation();
  const { mode, setMode, label, prevMonth, nextMonth } = useMonth();
  const { isDemoMode, toggleDemoMode } = useDemo();
  const { t } = useTranslation();

  const PAGE_TITLES: Record<string, string> = {
    "/": t('nav.dashboard'),
    "/projects": t('nav.projects'),
    "/kanban": t('nav.kanban'),
    "/calendar": t('nav.calendar'),
    "/expenses": t('nav.expenses'),
    "/filament": t('nav.filament'),
    "/templates": t('nav.templates'),
    "/quote": t('nav.quote'),
    "/data": t('nav.data'),
    "/settings": t('nav.settings'),
    "/customer-orders": t('nav.customerOrders'),
  };

  const title = PAGE_TITLES[location.pathname] || "";

  useEffect(() => {
    document.title = title ? `${title} — PrintTrack` : 'PrintTrack — 3D Printing Business Manager';
  }, [title]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card/80 backdrop-blur-sm px-3 md:px-4 shrink-0 sticky top-0 z-10 gap-1 md:gap-2">
            <SidebarTrigger className="shrink-0" />
            {title && <span className="ml-1 md:ml-3 text-sm font-medium text-muted-foreground truncate max-w-[120px] sm:max-w-none">{title}</span>}

            {/* Global month selector */}
            <div className="ml-auto flex items-center gap-1.5 md:gap-2 shrink-0">
              <div className="flex items-center gap-1 md:gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                <label className="text-xs text-muted-foreground cursor-pointer select-none hidden sm:block" htmlFor="month-toggle">
                  {mode === 'all' ? t('common.allTime') : t('common.monthly')}
                </label>
                <Switch
                  id="month-toggle"
                  checked={mode === 'month'}
                  onCheckedChange={(checked) => setMode(checked ? 'month' : 'all')}
                  className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
                />
              </div>

              {mode === 'month' && (
                <div className="flex items-center gap-0.5 md:gap-1 ml-0.5 md:ml-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs md:text-sm font-medium min-w-[80px] md:min-w-[120px] text-center">{label}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              <div className="ml-0.5 md:ml-1 pl-1.5 md:pl-2 border-l">
                <NotificationBell />
              </div>
            </div>
          </header>
          <GlobalStatusBar />
          {isDemoMode && (
            <div className="bg-yellow-500/10 border-b border-yellow-500/25 px-4 py-2 flex items-center justify-between shrink-0">
              <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">{t('demo.banner')}</span>
              <button onClick={toggleDemoMode} className="text-xs text-yellow-700 dark:text-yellow-400 underline hover:no-underline">{t('demo.turnOff')}</button>
            </div>
          )}
          {!isDemoMode && localStorage.getItem('pt_guest_mode') === 'true' && (
            <div className="bg-blue-500/10 border-b border-blue-500/25 px-4 py-2 flex items-center justify-between shrink-0">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{t('guest.banner')}</span>
              <Link to="/auth?mode=signup" className="text-xs text-blue-700 dark:text-blue-400 underline hover:no-underline">{t('guest.signUp')}</Link>
            </div>
          )}
          <main className="flex-1 overflow-auto p-4 md:p-6 animate-fade-in">
            <Outlet />
          </main>
          <WelcomeModal />
          <CommandPalette />
        </div>
      </div>
    </SidebarProvider>
  );
}
