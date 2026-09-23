import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useMonth } from "@/context/MonthContext";
import {
  getProjectTotalMaterial, getGlobalPrintProgress, getSuggestions,
  getProjectExpensesTotal, getProjectProgress, getProjectTotalPrintTime,
  getEffectiveDate, getProjectBalance, normalizeStage,
} from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  DollarSign, TrendingUp, Package, Clock, Weight, Lightbulb,
  Printer, Award, BarChart3, AlertTriangle, Activity, ExternalLink,
  CalendarClock, CheckCircle2, AlertCircle,
} from "lucide-react";
import { useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  format, parseISO, isBefore, isSameDay, startOfToday, eachMonthOfInterval, eachWeekOfInterval, eachDayOfInterval,
  startOfMonth, endOfMonth, startOfYear, endOfYear, addDays,
  startOfWeek, endOfWeek,
} from "date-fns";
import ProductionSummary from "@/components/ProductionSummary";
import MaterialUsageSummary from "@/components/MaterialUsageSummary";
import type { ChartGrouping } from "@/context/MonthContext";
import { HelpTip } from "@/components/HelpTip";
import { useDemo } from "@/context/DemoContext";
import { ActivationChecklist } from "@/components/ActivationChecklist";
import { getCurrencySymbol } from "@/types";

function DemoHint({ text }: { text: string }) {
  return (
    <span title={text} className="relative ml-1.5 cursor-help inline-flex items-center">
      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-primary/50" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary/70" />
    </span>
  );
}

const COLORS = [
  "hsl(215,70%,45%)",  // indigo steel — primary
  "hsl(200,70%,50%)",  // steel blue
  "hsl(142,55%,45%)",  // green
  "hsl(280,60%,58%)",  // purple
  "hsl(0,72%,51%)",    // red
  "hsl(45,95%,52%)",   // yellow
];

// Helper: build time buckets for a given grouping and interval
function buildBuckets(grouping: ChartGrouping, interval: { start: Date; end: Date } | null) {
  if (!interval) return null;
  if (grouping === "day") {
    return eachDayOfInterval(interval).map(d => ({
      start: d, end: d, label: format(d, "MMM d"), key: format(d, "yyyy-MM-dd"),
    }));
  }
  if (grouping === "week") {
    const multiYear = interval.end.getFullYear() > interval.start.getFullYear();
    return eachWeekOfInterval(interval, { weekStartsOn: 1 }).map(d => ({
      start: startOfWeek(d, { weekStartsOn: 1 }),
      end: endOfWeek(d, { weekStartsOn: 1 }),
      label: multiYear ? `W${format(d, "w")} '${format(d, "yy")}` : `W${format(d, "w")}`,
      key: `W${format(d, "w")}-${format(d, "yyyy")}`,
    }));
  }
  if (grouping === "year") {
    const years: { start: Date; end: Date; label: string; key: string }[] = [];
    for (let y = interval.start.getFullYear(); y <= interval.end.getFullYear(); y++) {
      years.push({
        start: startOfYear(new Date(y, 0, 1)),
        end: endOfYear(new Date(y, 0, 1)),
        label: String(y),
        key: String(y),
      });
    }
    return years;
  }
  return eachMonthOfInterval(interval).map(d => ({
    start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM"), key: format(d, "yyyy-MM"),
  }));
}

export default function Dashboard() {
  const { projects, expenses, filamentPurchases, settings } = useApp();
  const { filterProjects, filterExpenses, filterFilamentPurchases, interval, period, autoGrouping, label: periodLabel } = useMonth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isDemoMode } = useDemo();

  const currencySymbol = getCurrencySymbol(settings.currency);

  const filteredProjects = useMemo(() => filterProjects(projects), [projects, filterProjects]);
  const filteredExpenses = useMemo(() => filterExpenses(expenses), [expenses, filterExpenses]);
  const filteredFilament = useMemo(() => filterFilamentPurchases(filamentPurchases), [filamentPurchases, filterFilamentPurchases]);

  // ── Core stats ──
  const stats = useMemo(() => {
    const paidSent = filteredProjects.filter(p => p.paid && p.sent);
    const totalRevenue = paidSent.reduce((s, p) => s + (p.totalPrice || 0), 0);
    const projectExp = paidSent.reduce((s, p) => s + getProjectExpensesTotal(p), 0);
    const otherExp = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    // Filament cost now always period-filtered (not just all-time)
    const filCost = filteredFilament.reduce((s, fp) => s + (fp.totalCost || 0), 0);
    const totalMaterial = filteredProjects.reduce((s, p) => s + getProjectTotalMaterial(p), 0);

    const completedProjects = filteredProjects.filter(p => getProjectProgress(p).percent === 100);
    const overdueProjects = filteredProjects.filter(p => {
      if (!p.dueDate) return false;
      return getProjectProgress(p).percent < 100 && isBefore(parseISO(p.dueDate), startOfToday());
    });

    const allPrints = filteredProjects.flatMap(p => p.prints || []);
    const completedPrints = allPrints.filter(pr => (pr.completedQuantity || 0) >= (pr.quantity || 1));
    const totalHoursPrinted = allPrints.reduce((s, pr) => s + (pr.estimatedPrintTime || 0) * (pr.completedQuantity || 0), 0);
    const totalCompletedPieces = allPrints.reduce((s, pr) => s + (pr.completedQuantity || 0), 0);
    const avgPrintTime = totalCompletedPieces > 0 ? totalHoursPrinted / totalCompletedPieces : 0;

    const completionRate = filteredProjects.length > 0
      ? (completedProjects.length / filteredProjects.length) * 100 : 0;
    const avgProfitPerProject = paidSent.length > 0
      ? (totalRevenue - projectExp - otherExp - filCost) / paidSent.length : 0;
    const projectsWithPrints = filteredProjects.filter(p => (p.prints || []).length > 0);
    const avgTimePerProject = projectsWithPrints.length > 0
      ? projectsWithPrints.reduce((s, p) => s + getProjectTotalPrintTime(p), 0) / projectsWithPrints.length : 0;

    const materialMap = new Map<string, number>();
    filteredProjects.forEach(p => (p.prints || []).forEach(pr => {
      const mat = pr.material || "Unknown";
      materialMap.set(mat, (materialMap.get(mat) || 0) + (pr.materialUsed || 0) * (pr.quantity || 1));
    }));
    const materialBreakdown = Array.from(materialMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
    const mostUsedMaterial = materialBreakdown[0]?.name || "—";

    const onTime = paidSent.filter(p => {
      if (!p.dueDate || !p.shippingDate) return true;
      return parseISO(p.shippingDate) <= parseISO(p.dueDate);
    }).length;
    const late = paidSent.length - onTime;

    const totalExpenses = projectExp + otherExp + filCost;
    const netProfit = totalRevenue - totalExpenses;

    return {
      totalRevenue, totalExpenses, netProfit,
      filCost, otherExp: projectExp + otherExp,
      totalOrders: filteredProjects.length, totalMaterial,
      completedProjects: completedProjects.length,
      activeProjects: filteredProjects.length - completedProjects.length,
      overdueProjects: overdueProjects.length,
      totalPrintsCompleted: completedPrints.length, totalHoursPrinted, avgPrintTime,
      completionRate, avgProfitPerProject, avgTimePerProject,
      materialBreakdown, mostUsedMaterial, onTime, late,
    };
  }, [filteredProjects, filteredExpenses, filteredFilament]);

  // Outstanding balance across ALL projects (global, not period-filtered)
  const outstandingBalance = useMemo(() =>
    projects.reduce((s, p) => s + Math.max(0, getProjectBalance(p)), 0),
    [projects]
  );

  const globalProgress = useMemo(() => getGlobalPrintProgress(filteredProjects), [filteredProjects]);
  const suggestions = useMemo(() => getSuggestions(projects), [projects]);

  // Previous period for deltas
  const prevInterval = useMemo(() => {
    if (!interval) return null;
    const duration = interval.end.getTime() - interval.start.getTime();
    const prevEnd = new Date(interval.start.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - duration);
    return { start: prevStart, end: prevEnd };
  }, [interval]);

  const prevStats = useMemo(() => {
    if (!prevInterval) return null;
    const inPrev = (d: Date) => d >= prevInterval.start && d <= prevInterval.end;
    const pp = projects.filter(p => { try { const d = getEffectiveDate(p); return d ? inPrev(parseISO(d)) : false; } catch { return false; } });
    const pe = expenses.filter(e => { try { return inPrev(parseISO(e.date)); } catch { return false; } });
    const pf = filamentPurchases.filter(fp => { try { return inPrev(parseISO(fp.purchaseDate)); } catch { return false; } });
    const paidSent = pp.filter(p => p.paid && p.sent);
    const revenue = paidSent.reduce((s, p) => s + (p.totalPrice || 0), 0);
    const spending = paidSent.reduce((s, p) => s + getProjectExpensesTotal(p), 0)
      + pe.reduce((s, e) => s + (e.amount || 0), 0)
      + pf.reduce((s, fp) => s + (fp.totalCost || 0), 0);
    const hours = pp.reduce((s, p) => s + (p.prints || []).reduce((ph, pr) => ph + (pr.estimatedPrintTime || 0) * (pr.completedQuantity || 0), 0), 0);
    const active = pp.filter(p => !p.paid || !p.sent).length;
    return { revenue, spending, profit: revenue - spending, hours, active };
  }, [prevInterval, projects, expenses, filamentPurchases]);

  // Needs attention
  const needsAttention = useMemo(() => {
    const today = startOfToday();
    const in3days = addDays(today, 3);
    const result: Array<{ project: typeof projects[0]; reason: string; urgency: 'high' | 'medium' | 'low' }> = [];
    projects.forEach(p => {
      const done = p.paid && p.sent;
      if (!done && p.dueDate) {
        try {
          const due = parseISO(p.dueDate);
          if (isBefore(due, today) && !isSameDay(due, today)) {
            const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
            result.push({ project: p, reason: `${days}d overdue`, urgency: 'high' }); return;
          }
          if (!isBefore(due, today) && isBefore(due, in3days)) {
            const days = Math.floor((due.getTime() - today.getTime()) / 86400000);
            result.push({ project: p, reason: days === 0 ? 'Due today' : `Due in ${days}d`, urgency: 'medium' }); return;
          }
        } catch {}
      }
      if (p.sent && !p.paid && getProjectBalance(p) > 0) {
        result.push({ project: p, reason: 'Delivered, awaiting payment', urgency: 'medium' }); return;
      }
      if (normalizeStage(p) === 'awaiting-approval') {
        result.push({ project: p, reason: 'Awaiting client approval', urgency: 'low' });
      }
    });
    return result.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.urgency] - { high: 0, medium: 1, low: 2 }[b.urgency]));
  }, [projects]);

  // ── Generic time-series builder ──
  const buildTimeSeries = useCallback((
    grouping: ChartGrouping,
    mapper: (projectsInBucket: typeof filteredProjects, expensesInBucket: typeof filteredExpenses, filamentInBucket: typeof filteredFilament) => Record<string, number>,
  ) => {
    const buckets = buildBuckets(grouping, interval);

    if (!buckets) {
      const allDates: Date[] = [];
      filteredProjects.forEach(p => {
        const ds = getEffectiveDate(p);
        if (ds) { try { allDates.push(parseISO(ds)); } catch {} }
      });
      filteredExpenses.forEach(e => {
        if (e.date) { try { allDates.push(parseISO(e.date)); } catch {} }
      });
      filteredFilament.forEach(fp => {
        if (fp.purchaseDate) { try { allDates.push(parseISO(fp.purchaseDate)); } catch {} }
      });
      if (allDates.length === 0) return [];
      const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
      const allTimeBuckets = buildBuckets(grouping, { start: minDate, end: new Date() });
      if (!allTimeBuckets) return [];
      return allTimeBuckets.map(b => {
        const bProjects = filteredProjects.filter(p => {
          const ds = getEffectiveDate(p);
          if (!ds) return false;
          try { const d = parseISO(ds); return d >= b.start && d <= b.end; } catch { return false; }
        });
        const bExpenses = filteredExpenses.filter(e => {
          try { const d = parseISO(e.date); return d >= b.start && d <= b.end; } catch { return false; }
        });
        const bFilament = filteredFilament.filter(fp => {
          try { const d = parseISO(fp.purchaseDate); return d >= b.start && d <= b.end; } catch { return false; }
        });
        const vals = mapper(bProjects, bExpenses, bFilament);
        return { label: b.label, ...vals };
      });
    }

    return buckets.map(b => {
      const bProjects = filteredProjects.filter(p => {
        const ds = getEffectiveDate(p);
        if (!ds) return false;
        try { const d = parseISO(ds); return d >= b.start && d <= b.end; } catch { return false; }
      });
      const bExpenses = filteredExpenses.filter(e => {
        try { const d = parseISO(e.date); return d >= b.start && d <= b.end; } catch { return false; }
      });
      const bFilament = filteredFilament.filter(fp => {
        try { const d = parseISO(fp.purchaseDate); return d >= b.start && d <= b.end; } catch { return false; }
      });
      const vals = mapper(bProjects, bExpenses, bFilament);
      return { label: b.label, ...vals };
    });
  }, [interval, filteredProjects, filteredExpenses, filteredFilament]);

  // ── Chart data ──
  const revenueOverTime = useMemo(() => buildTimeSeries(autoGrouping, (ps) => {
    const revenue = ps.filter(p => p.paid && p.sent).reduce((s, p) => s + (p.totalPrice || 0), 0);
    return { revenue: +revenue.toFixed(2) };
  }), [buildTimeSeries, autoGrouping]);

  const profitExpensesData = useMemo(() => buildTimeSeries(autoGrouping, (ps, es, fps) => {
    const paidSent = ps.filter(p => p.paid && p.sent);
    const revenue = paidSent.reduce((s, p) => s + (p.totalPrice || 0), 0);
    const pExp = paidSent.reduce((s, p) => s + getProjectExpensesTotal(p), 0);
    const eExp = es.reduce((s, e) => s + (e.amount || 0), 0);
    const fExp = fps.reduce((s, fp) => s + (fp.totalCost || 0), 0);
    const totalExp = pExp + eExp + fExp;
    return { profit: +(revenue - totalExp).toFixed(2), expenses: +totalExp.toFixed(2) };
  }), [buildTimeSeries, autoGrouping]);

  const hoursOverTime = useMemo(() => buildTimeSeries(autoGrouping, (ps) => {
    const hours = ps.reduce((s, p) =>
      s + (p.prints || []).reduce((ph, pr) => ph + (pr.estimatedPrintTime || 0) * (pr.completedQuantity || 0), 0), 0);
    return { hours: +hours.toFixed(1) };
  }), [buildTimeSeries, autoGrouping]);

  const statusDistribution = useMemo(() => {
    return [
      { name: t('dashboard.completed'), value: stats.completedProjects, color: "hsl(142,55%,45%)" },
      { name: t('dashboard.active'), value: stats.activeProjects, color: "hsl(215,70%,45%)" },
      { name: t('dashboard.overdue'), value: stats.overdueProjects, color: "hsl(0,72%,51%)" },
    ].filter(d => d.value > 0);
  }, [stats, t]);

  const insights = useMemo(() => {
    const dayMap = new Map<string, number>();
    filteredProjects.filter(p => p.paid && p.sent).forEach(p => {
      const ds = getEffectiveDate(p);
      if (!ds) return;
      const key = format(parseISO(ds), "yyyy-MM-dd");
      dayMap.set(key, (dayMap.get(key) || 0) + (p.totalPrice || 0));
    });
    const bestDay = Array.from(dayMap.entries()).sort((a, b) => b[1] - a[1])[0];

    const weekMap = new Map<string, number>();
    filteredProjects.forEach(p => {
      const ds = getEffectiveDate(p) || p.orderDate;
      if (!ds) return;
      const key = format(parseISO(ds), "yyyy-'W'ww");
      weekMap.set(key, (weekMap.get(key) || 0) + 1);
    });
    const busiestWeek = Array.from(weekMap.entries()).sort((a, b) => b[1] - a[1])[0];

    const avgProfitPerPrint = stats.totalPrintsCompleted > 0
      ? stats.netProfit / stats.totalPrintsCompleted : 0;

    return [
      { label: t('dashboard.bestDay'), value: bestDay ? `${format(parseISO(bestDay[0]), "MMM d, yyyy")} — ${currencySymbol}${bestDay[1].toFixed(2)}` : "—" },
      { label: t('dashboard.mostUsedMaterial'), value: stats.mostUsedMaterial },
      { label: t('dashboard.busiestWeek'), value: busiestWeek ? `${busiestWeek[0]} (${busiestWeek[1]} ${t('dashboard.ordersLabel')})` : "—" },
      { label: t('dashboard.avgProfitPrint'), value: `${currencySymbol}${avgProfitPerPrint.toFixed(2)}` },
    ];
  }, [filteredProjects, stats, t, currencySymbol]);

  // Expenses breakdown text: "€74 (Filament €45 · Other €29)"
  const expensesBreakdown = useMemo(() => {
    if (stats.filCost === 0) return `${currencySymbol}${stats.totalExpenses.toFixed(2)}`;
    return `${currencySymbol}${stats.totalExpenses.toFixed(2)} (Filament ${currencySymbol}${stats.filCost.toFixed(2)} · Other ${currencySymbol}${stats.otherExp.toFixed(2)})`;
  }, [stats, currencySymbol]);

  const kpis = [
    { label: t('dashboard.revenue'), value: `${currencySymbol}${stats.totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-emerald-600" },
    { label: t('dashboard.netProfit'), value: `${currencySymbol}${stats.netProfit.toFixed(2)}`, icon: TrendingUp, color: stats.netProfit >= 0 ? "text-emerald-600" : "text-destructive" },
    { label: t('dashboard.expenses'), value: `${currencySymbol}${stats.totalExpenses.toFixed(2)}`, icon: AlertTriangle, color: "text-destructive", subtitle: stats.filCost > 0 ? `Filament ${currencySymbol}${stats.filCost.toFixed(2)} · Other ${currencySymbol}${stats.otherExp.toFixed(2)}` : undefined },
    { label: t('dashboard.orders'), value: stats.totalOrders, icon: Package, color: "text-primary" },
    { label: t('dashboard.hoursPrinted'), value: `${stats.totalHoursPrinted.toFixed(1)}h`, icon: Clock, color: "text-primary" },
    { label: t('dashboard.materialUsed'), value: `${stats.totalMaterial.toFixed(0)}g`, icon: Weight, color: "text-primary" },
    ...(outstandingBalance > 0 ? [{ label: 'Outstanding balance', value: `${currencySymbol}${outstandingBalance.toFixed(2)}`, icon: AlertTriangle, color: "text-yellow-600", subtitle: 'Across all unpaid orders' }] : []),
  ];

  const tooltipStyle = { borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))" };

  const noData = filteredProjects.length === 0 && filteredExpenses.length === 0;

  const today = startOfToday();
  const todayStr = format(today, "yyyy-MM-dd");

  const todaysTasks = useMemo(() => {
    return projects.filter(p => {
      if (p.paid && p.sent) return false;
      if (!p.dueDate) return false;
      const due = p.dueDate;
      const isDueToday = due === todayStr;
      const isOverdue = isBefore(parseISO(due), today);
      return isDueToday || isOverdue;
    }).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  }, [projects, todayStr, today]);

  const activeProjectsCount = filteredProjects.filter(p => !p.paid || !p.sent).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <HelpTip text={t('dashboard.helpTip')} />
        </div>
        <p className="text-xs text-muted-foreground hidden lg:block">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Primary number: Profit */}
      <div className="rounded-xl border bg-card px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-5xl font-bold tabular-nums tracking-tight leading-none">{currencySymbol}{stats.netProfit.toFixed(0)}</p>
            <p className="text-sm text-muted-foreground mt-2">Profit · {periodLabel}</p>
            {prevStats && interval && (
              <p className={`text-sm font-medium mt-1 ${stats.netProfit - prevStats.profit > 0 ? 'text-emerald-600' : stats.netProfit - prevStats.profit < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                {stats.netProfit - prevStats.profit >= 0 ? '+' : ''}{currencySymbol}{(stats.netProfit - prevStats.profit).toFixed(0)} vs previous period
              </p>
            )}
          </div>
          <HelpTip text="Net profit = Revenue from paid+shipped orders minus all expenses (filament, project costs, overheads) for the selected period." />
        </div>
      </div>

      {/* 5 supporting KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {([
          { label: 'Revenue', val: stats.totalRevenue, prev: prevStats?.revenue ?? null, fmt: (v: number) => `${currencySymbol}${v.toFixed(0)}`, tip: 'Total price of paid & shipped orders in this period.' },
          { label: 'Spending', val: stats.totalExpenses, prev: prevStats?.spending ?? null, fmt: (v: number) => `${currencySymbol}${v.toFixed(0)}`, invertDelta: true, tip: 'Filament purchases + project expenses + overheads in this period.' },
          { label: 'Outstanding', val: outstandingBalance, prev: null as number | null, fmt: (v: number) => `${currencySymbol}${v.toFixed(0)}`, tip: 'Unpaid balance across all orders globally.' },
          { label: 'Active projects', val: activeProjectsCount, prev: prevStats?.active ?? null, fmt: (v: number) => String(v), tip: 'Projects not yet fully paid and shipped.' },
          { label: 'Hours printed', val: stats.totalHoursPrinted, prev: prevStats?.hours ?? null, fmt: (v: number) => `${v.toFixed(1)}h`, tip: 'Estimated print hours × completed quantity for all plates in this period.' },
        ] as const).map(kpi => {
          const delta = kpi.prev !== null ? kpi.val - kpi.prev : null;
          const invertDelta = 'invertDelta' in kpi && kpi.invertDelta;
          const isGood = invertDelta ? (delta !== null && delta < 0) : (delta !== null && delta > 0);
          const isBad = invertDelta ? (delta !== null && delta > 0) : (delta !== null && delta < 0);
          return (
            <Card key={kpi.label}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-xl font-bold tabular-nums leading-tight">{kpi.fmt(kpi.val)}</p>
                  <HelpTip text={kpi.tip} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
                {delta !== null && interval && (
                  <p className={`text-[11px] mt-1 font-medium ${isGood ? 'text-emerald-600' : isBad ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {delta >= 0 ? '+' : ''}{kpi.fmt(delta)} vs prev.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ActivationChecklist />

      {noData && (
        <Card><CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-base">No data for this period</p>
            <p className="text-sm text-muted-foreground mt-1">
              {period === 'all-time'
                ? "Add projects and mark them as paid & shipped to see your analytics."
                : `No projects or expenses found for ${periodLabel}. Try a different period or switch to All Time.`}
            </p>
          </div>
          {period === 'all-time' && (
            <div className="text-left space-y-1.5 max-w-xs mx-auto">
              {["Create your first project", "Add prints with time & material", "Mark paid & shipped when done", "Watch your analytics grow"].map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">{i + 1}</div>
                  <span className="text-muted-foreground">{step}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
      )}

      {/* Needs attention */}
      <Card className={needsAttention.length > 0 ? "border-[hsl(38,85%,46%/0.4)] bg-[hsl(38,85%,46%/0.04)]" : ""}>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[hsl(38,85%,46%)]" />
            Needs attention
            {needsAttention.length > 0 && (
              <Badge variant="secondary" className="ml-1 bg-[hsl(38,85%,46%/0.15)] text-[hsl(38,85%,36%)]">{needsAttention.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          {needsAttention.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              Nothing needs attention.
            </div>
          ) : (
            <div className="space-y-2">
              {needsAttention.map(({ project: p, reason, urgency }) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => navigate(`/projects?id=${p.id}`, { state: { from: '/' } })}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {urgency === 'high'
                      ? <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                      : urgency === 'medium'
                      ? <AlertTriangle className="h-4 w-4 text-[hsl(38,85%,46%)] shrink-0" />
                      : <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                    }
                    <span className="text-sm font-medium truncate">{p.name}</span>
                    {p.customerName && <span className="text-xs text-muted-foreground truncate hidden sm:inline">· {p.customerName}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                      urgency === 'high' ? 'bg-red-500/10 text-red-600' :
                      urgency === 'medium' ? 'bg-[hsl(38,85%,46%/0.12)] text-[hsl(38,85%,34%)]' :
                      'bg-primary/10 text-primary'
                    }`}>{reason}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Secondary metrics */}
      <p className="text-xs font-medium text-muted-foreground">Key metrics · {periodLabel}</p>

      {/* Print Performance + Project Insights Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Printer className="h-4 w-4 text-primary" />{t('dashboard.printPerformance')}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('dashboard.printsCompleted')}</span><span className="font-semibold">{stats.totalPrintsCompleted}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('dashboard.totalHours')}</span><span className="font-semibold">{stats.totalHoursPrinted.toFixed(1)}h</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('dashboard.avgTimePrint')}</span><span className="font-semibold">{stats.avgPrintTime.toFixed(1)}h</span></div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />{t('dashboard.efficiency')}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('dashboard.completionRate')}</span><span className="font-semibold">{stats.completionRate.toFixed(0)}%</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('dashboard.onTime')}</span><span className="font-semibold text-emerald-600">{stats.onTime}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('dashboard.late')}</span><span className="font-semibold text-destructive">{stats.late}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('dashboard.avgTimeProject')}</span><span className="font-semibold">{stats.avgTimePerProject.toFixed(1)}h</span></div>
            {stats.totalRevenue > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Actual margin</span>
                <span className={`font-semibold ${(stats.netProfit / stats.totalRevenue) >= 0.3 ? 'text-emerald-600' : 'text-destructive'}`}>
                  {(stats.netProfit / stats.totalRevenue * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4 text-primary" />{t('dashboard.projectsCard')}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('dashboard.active')}</span><span className="font-semibold">{stats.activeProjects}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('dashboard.completed')}</span><span className="font-semibold text-emerald-600">{stats.completedProjects}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('dashboard.overdue')}</span><span className="font-semibold text-destructive">{stats.overdueProjects}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('dashboard.avgProfitProject')}</span><span className="font-semibold">{currencySymbol}{stats.avgProfitPerProject.toFixed(2)}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Global print progress */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{t('dashboard.globalPrintProgress')}</span>
            </div>
            <span className="text-sm font-bold text-primary">{globalProgress.percent}%</span>
          </div>
          <Progress value={globalProgress.percent} className="h-2.5" />
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{t('dashboard.completedHours')}: {globalProgress.completedHours.toFixed(1)}h</span>
            <span>{t('dashboard.remainingHours')}: {globalProgress.remainingHours.toFixed(1)}h</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProductionSummary projects={filteredProjects} />
        <MaterialUsageSummary projects={filteredProjects} />
      </div>

      {/* Smart Insight Cards */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Award className="h-4 w-4 text-primary" />{t('dashboard.quickInsights')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {insights.map(ins => (
              <div key={ins.label} className="rounded-lg bg-muted/40 p-3 space-y-1">
                <p className="text-xs text-muted-foreground">{ins.label}</p>
                <p className="text-sm font-semibold truncate">{ins.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('dashboard.revenueOverTime')}</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueOverTime.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('dashboard.noCompletedOrders')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={revenueOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(215,70%,45%)" strokeWidth={2} dot={{ r: 3 }} name={`${t('dashboard.revenue')} (${currencySymbol})`} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('dashboard.profitVsExpenses')}</CardTitle>
          </CardHeader>
          <CardContent>
            {profitExpensesData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('dashboard.noDataYet')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={profitExpensesData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="profit" fill="hsl(142,60%,42%)" radius={[4, 4, 0, 0]} name={t('dashboard.netProfit')} />
                  <Bar dataKey="expenses" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} name={t('dashboard.expenses')} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('dashboard.hoursPrintedOverTime')}</CardTitle>
          </CardHeader>
          <CardContent>
            {hoursOverTime.every(h => (h as any).hours === 0) ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('dashboard.noPrintData')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={hoursOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="hours" stroke="hsl(200,70%,50%)" strokeWidth={2} dot={{ r: 3 }} name={t('dashboard.hoursPrinted')} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('dashboard.materialBreakdown')}</CardTitle></CardHeader>
          <CardContent>
            {stats.materialBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('dashboard.noMaterialData')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={stats.materialBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                    label={({ name, value }) => `${name}: ${value}g`} labelLine={{ strokeWidth: 1 }}>
                    {stats.materialBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t('dashboard.statusDistribution')}</CardTitle></CardHeader>
          <CardContent>
            {statusDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('dashboard.noProjects')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                    label={({ name, value }) => `${name}: ${value}`} labelLine={{ strokeWidth: 1 }}>
                    {statusDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" />{t('dashboard.revenueBySource')}</CardTitle></CardHeader>
          <CardContent>
            {(() => {
              const sourceData = (() => {
                const map = new Map<string, { orders: number; revenue: number }>();
                filteredProjects.forEach(p => {
                  const e = map.get(p.customerSource) || { orders: 0, revenue: 0 };
                  e.orders++;
                  if (p.paid && p.sent) e.revenue += p.totalPrice || 0;
                  map.set(p.customerSource, e);
                });
                return Array.from(map.entries()).map(([name, v]) => ({ name, value: v.orders, revenue: v.revenue }));
              })();
              return sourceData.filter(s => s.revenue > 0).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">{t('dashboard.noRevenueData')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={sourceData.filter(s => s.revenue > 0)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis type="number" className="text-xs" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" className="text-xs" width={80} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="revenue" fill="hsl(215,70%,45%)" radius={[0, 4, 4, 0]} name={`${t('dashboard.revenue')} (${currencySymbol})`} />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      {filteredProjects.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              {t('dashboard.recentProjects')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredProjects.slice(0, 5).map(p => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:bg-accent/20 hover:border-primary/40 transition-colors"
                onClick={() => navigate(`/projects?id=${p.id}`, { state: { from: '/' } })}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.customerName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary">{currencySymbol}{(p.totalPrice || 0).toFixed(2)}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              {t('dashboard.suggestions')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((s, i) => (
              <div key={i} className="rounded-lg border p-3 hover:bg-accent/20 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">{s.type === "batch" ? t('dashboard.batch') : t('dashboard.nextPrint')}</Badge>
                </div>
                <p className="text-sm">{s.message}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {s.printNames.map(n => <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
