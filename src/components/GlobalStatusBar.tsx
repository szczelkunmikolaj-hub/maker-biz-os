import { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { Activity, Printer, AlertTriangle, CalendarClock } from "lucide-react";
import { parseISO, isValid, format, differenceInCalendarDays } from "date-fns";
import { useTranslation } from "react-i18next";

export function GlobalStatusBar() {
  const { projects, settings, filamentPurchases } = useApp();
  const { t } = useTranslation();

  const stats = useMemo(() => {
    const activeJobs = projects.filter(p => {
      if (p.printed || p.sent) return false;
      return (p.prints || []).some(pr => pr.status === "printing");
    }).length;

    const printerCount = settings.printerCount || 0;
    const printersBusy = Math.min(activeJobs, printerCount || activeJobs);

    const totalGramsPurchased = filamentPurchases.reduce(
      (s, fp) => s + (fp.spoolWeight || 0) * (fp.numberOfSpools || 0),
      0
    );
    const consumedGrams = projects.reduce((s, p) => {
      return s + (p.prints || []).reduce(
        (ps, pr) => ps + (pr.materialUsed || 0) * (pr.completedQuantity || 0),
        0
      );
    }, 0);
    const remainingStock = Math.max(0, totalGramsPurchased - consumedGrams);
    const lowMaterial = totalGramsPurchased > 0 && remainingStock < 500;

    const upcoming = projects
      .filter(p => !p.sent && p.dueDate)
      .map(p => {
        const d = parseISO(p.dueDate);
        return isValid(d) ? { p, d } : null;
      })
      .filter((x): x is { p: typeof projects[number]; d: Date } => !!x)
      .sort((a, b) => a.d.getTime() - b.d.getTime());
    const next = upcoming[0];

    return { activeJobs, printerCount, printersBusy, lowMaterial, remainingStock, next };
  }, [projects, settings, filamentPurchases]);

  const nextDeadlineLabel = stats.next
    ? (() => {
        const days = differenceInCalendarDays(stats.next.d, new Date());
        const dateStr = format(stats.next.d, "MMM d");
        const rel =
          days < 0 ? t('status.dOverdue', { days: Math.abs(days) }) :
          days === 0 ? t('status.today') :
          days === 1 ? t('status.tomorrow') :
          t('status.inDays', { days });
        return { name: stats.next.p.name, dateStr, rel, late: days < 0 };
      })()
    : null;

  return (
    <div className="h-12 border-b bg-card/60 backdrop-blur-sm px-4 flex items-center gap-4 overflow-x-auto shrink-0 text-xs">
      <div className="flex items-center gap-1.5 shrink-0">
        <Activity className="h-3.5 w-3.5 text-status-printing" />
        <span className="text-muted-foreground">{t('status.active')}:</span>
        <span className="font-semibold text-foreground tabular-nums">{stats.activeJobs}</span>
      </div>

      <span className="h-4 w-px bg-border shrink-0" />

      <div className="flex items-center gap-1.5 shrink-0">
        <Printer className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">{t('status.printers')}:</span>
        <span className="font-semibold text-foreground tabular-nums">
          {stats.printerCount > 0
            ? t('status.busyOf', { busy: stats.printersBusy, total: stats.printerCount })
            : t('status.running', { count: stats.activeJobs })}
        </span>
      </div>

      <span className="h-4 w-px bg-border shrink-0" />

      {stats.lowMaterial ? (
        <div className="flex items-center gap-1.5 shrink-0 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-warning">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="font-medium">{t('status.lowFilament', { grams: Math.round(stats.remainingStock) })}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 opacity-50" />
          <span>{t('status.materialsOK')}</span>
        </div>
      )}

      <span className="h-4 w-px bg-border shrink-0" />

      <div className="flex items-center gap-1.5 min-w-0 ml-auto">
        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {nextDeadlineLabel ? (
          <>
            <span className="text-muted-foreground shrink-0">{t('status.next')}:</span>
            <span className="font-medium truncate max-w-[180px]">{nextDeadlineLabel.name}</span>
            <span className={`shrink-0 tabular-nums ${nextDeadlineLabel.late ? "text-status-overdue font-semibold" : "text-muted-foreground"}`}>
              · {nextDeadlineLabel.dateStr} ({nextDeadlineLabel.rel})
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">{t('status.noUpcomingDeadlines')}</span>
        )}
      </div>
    </div>
  );
}

export default GlobalStatusBar;
