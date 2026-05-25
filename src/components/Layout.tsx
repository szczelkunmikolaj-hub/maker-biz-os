import { useEffect, useState, useCallback } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useMonth } from "@/context/MonthContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalStatusBar } from "@/components/GlobalStatusBar";
import { CommandPalette } from "@/components/CommandPalette";
import { WelcomeModal } from "@/components/WelcomeModal";
// PAYMENTS_TODO: re-enable when payments are ready
// import { TrialBanner } from "@/components/TrialBanner";
// import { TrialOptInModal } from "@/components/TrialOptInModal";
import { useDemo } from "@/context/DemoContext";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/AppContext";
import { useNotifications } from "@/context/NotificationContext";
import { Project } from "@/types";
import { format, addDays } from "date-fns";
import { useRef } from "react";

function newQuickProject(): Project {
  return {
    id: crypto.randomUUID(), name: "", customerName: "", customerSource: "Other",
    paymentMethod: "Other", orderDate: new Date().toISOString().split("T")[0],
    dueDate: "", totalPrice: 0, printed: false, paid: false, sent: false,
    shippingDate: "", notes: "", prints: [], kanbanStatus: "new-order", projectExpenses: [],
  };
}

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode, setMode, label, prevMonth, nextMonth } = useMonth();
  const { isDemoMode, toggleDemoMode } = useDemo();
  const { t } = useTranslation();
  const { addProject, projects } = useApp();
  const { addNotification, notifications } = useNotifications();
  const prevPaidRef = useRef<Record<string, boolean>>({});
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickDraft, setQuickDraft] = useState<Project>(newQuickProject());

  // Listen for quick-add trigger (from keyboard shortcut / command palette)
  useEffect(() => {
    const handler = () => { setQuickDraft(newQuickProject()); setShowQuickAdd(true); };
    document.addEventListener("quick-add-project", handler);
    return () => document.removeEventListener("quick-add-project", handler);
  }, []);

  // Auto-notify: due tomorrow
  useEffect(() => {
    const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");
    projects.forEach(p => {
      if (!p.dueDate || p.paid || p.sent) return;
      if (p.dueDate !== tomorrowStr) return;
      const notifId = `due-tomorrow-${p.id}-${tomorrowStr}`;
      if (notifications.some(n => n.id === notifId)) return;
      addNotification({
        id: notifId,
        type: "due_tomorrow",
        title: `Due tomorrow: ${p.name}`,
        customerName: p.customerName || undefined,
        message: p.customerName ? `Order for ${p.customerName} is due tomorrow.` : "This project is due tomorrow.",
      });
    });
    // Auto-notify: project marked as paid
    projects.forEach(p => {
      const wasPaid = prevPaidRef.current[p.id];
      if (p.paid && !wasPaid && wasPaid !== undefined) {
        const notifId = `paid-${p.id}-${Date.now()}`;
        addNotification({
          id: notifId,
          type: "project_paid",
          title: `Payment received: ${p.name}`,
          customerName: p.customerName || undefined,
          message: `"${p.name}" has been marked as paid.`,
        });
      }
    });
    prevPaidRef.current = Object.fromEntries(projects.map(p => [p.id, p.paid]));
  }, [projects]); // eslint-disable-line

  const handleQuickAdd = useCallback(() => {
    if (!quickDraft.name.trim()) return;
    const proj = { ...quickDraft };
    addProject(proj);
    setShowQuickAdd(false);
    setQuickDraft(newQuickProject());
    navigate(`/projects?id=${proj.id}`);
  }, [quickDraft, addProject, navigate]);

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
    "/customers": "Customers",
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
          {/* PAYMENTS_TODO: <TrialBanner /> */}
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

          {/* Floating quick-add button */}
          <button
            onClick={() => { setQuickDraft(newQuickProject()); setShowQuickAdd(true); }}
            className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 hover:shadow-xl transition-all flex items-center justify-center"
            aria-label="Quick add project"
          >
            <Plus className="h-6 w-6" />
          </button>

          <WelcomeModal />
          {/* PAYMENTS_TODO: <TrialOptInModal /> */}
          <CommandPalette />

          {/* Quick-add modal */}
          <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" /> Quick Add Project
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>Project name *</Label>
                  <Input
                    autoFocus
                    placeholder="e.g. Miniature set for John"
                    value={quickDraft.name}
                    onChange={e => setQuickDraft(d => ({ ...d, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
                  />
                </div>
                <div>
                  <Label>Customer name</Label>
                  <Input
                    placeholder="e.g. John Smith"
                    value={quickDraft.customerName}
                    onChange={e => setQuickDraft(d => ({ ...d, customerName: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={quickDraft.totalPrice || ""}
                      onChange={e => setQuickDraft(d => ({ ...d, totalPrice: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label>Due date</Label>
                    <Input
                      type="date"
                      value={quickDraft.dueDate || ""}
                      onChange={e => setQuickDraft(d => ({ ...d, dueDate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowQuickAdd(false)}>Cancel</Button>
                <Button onClick={handleQuickAdd} disabled={!quickDraft.name.trim()}>
                  Save & Open
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </SidebarProvider>
  );
}
