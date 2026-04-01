import { useApp } from "@/context/AppContext";
import {
  getProjectTotalMaterial, getGlobalPrintProgress, getSuggestions,
  getProjectExpensesTotal, getProjectProgress, getProjectTotalPrintTime,
} from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  DollarSign, TrendingUp, Package, Clock, Weight, Lightbulb,
  Printer, Award, BarChart3, AlertTriangle, Activity,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  format, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear,
  isWithinInterval, startOfWeek, endOfWeek, eachMonthOfInterval, eachWeekOfInterval, eachDayOfInterval,
  subMonths,
} from "date-fns";
import ProductionSummary from "@/components/ProductionSummary";
import MaterialUsageSummary from "@/components/MaterialUsageSummary";

const COLORS = [
  "hsl(168,60%,38%)", "hsl(220,60%,50%)", "hsl(38,92%,50%)",
  "hsl(280,60%,50%)", "hsl(0,72%,51%)", "hsl(120,40%,45%)",
];

type TimeRange = "month" | "year" | "all";
type Grouping = "day" | "week" | "month";

function getDateStr(item: any): string | null {
  return item.orderDate || item.shippingDate || item.date || null;
}

function buildMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const opts: { value: string; label: string }[] = [];
  for (let i = 0; i < 24; i++) {
    const d = subMonths(now, i);
    opts.push({ value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") });
  }
  return opts;
}

function buildYearOptions(): { value: string; label: string }[] {
  const currentYear = new Date().getFullYear();
  const opts: { value: string; label: string }[] = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    opts.push({ value: String(y), label: String(y) });
  }
  return opts;
}

export default function Dashboard() {
  const { projects, expenses, totalFilamentPurchasesCost } = useApp();
  const [range, setRange] = useState<TimeRange>("all");
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [grouping, setGrouping] = useState<Grouping>("month");

  const monthOptions = useMemo(buildMonthOptions, []);
  const yearOptions = useMemo(buildYearOptions, []);

  // Auto-adjust grouping based on range
  const effectiveGrouping = useMemo(() => {
    if (range === "month") return grouping === "month" ? "day" : grouping;
    if (range === "year") return grouping === "day" ? "week" : grouping;
    return grouping;
  }, [range, grouping]);

  // Build date interval
  const interval = useMemo(() => {
    if (range === "month") {
      const d = parseISO(`${selectedMonth}-01`);
      return { start: startOfMonth(d), end: endOfMonth(d) };
    }
    if (range === "year") {
      const d = new Date(Number(selectedYear), 0, 1);
      return { start: startOfYear(d), end: endOfYear(d) };
    }
    return null;
  }, [range, selectedMonth, selectedYear]);

  const inRange = useMemo(() => {
    return (dateStr: string | null): boolean => {
      if (!dateStr) return false;
      if (!interval) return true;
      try { return isWithinInterval(parseISO(dateStr), interval); } catch { return false; }
    };
  }, [interval]);

  const filteredProjects = useMemo(() => projects.filter(p => inRange(getDateStr(p))), [projects, inRange]);
  const filteredExpenses = useMemo(() => expenses.filter(e => inRange(e.date)), [expenses, inRange]);

  // ── Core stats ──
  const stats = useMemo(() => {
    const paidSent = filteredProjects.filter(p => p.paid && p.sent);
    const totalRevenue = paidSent.reduce((s, p) => s + (p.totalPrice || 0), 0);
    const projectExp = paidSent.reduce((s, p) => s + getProjectExpensesTotal(p), 0);
    const otherExp = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const filCost = range === "all" ? totalFilamentPurchasesCost : 0;
    const totalMaterial = filteredProjects.reduce((s, p) => s + getProjectTotalMaterial(p), 0);

    const completedProjects = filteredProjects.filter(p => {
      const prog = getProjectProgress(p);
      return prog.percent === 100;
    });
    const overdueProjects = filteredProjects.filter(p => {
      if (!p.dueDate) return false;
      const prog = getProjectProgress(p);
      return prog.percent < 100 && parseISO(p.dueDate) < new Date();
    });

    const allPrints = filteredProjects.flatMap(p => p.prints || []);
    const completedPrints = allPrints.filter(pr => (pr.completedQuantity || 0) >= (pr.quantity || 1));
    const totalHoursPrinted = allPrints.reduce((s, pr) => s + (pr.estimatedPrintTime || 0) * (pr.completedQuantity || 0), 0);
    const avgPrintTime = completedPrints.length > 0 ? totalHoursPrinted / completedPrints.length : 0;

    const completionRate = filteredProjects.length > 0
      ? (completedProjects.length / filteredProjects.length) * 100 : 0;
    const avgProfitPerProject = paidSent.length > 0
      ? (totalRevenue - projectExp - otherExp) / paidSent.length : 0;
    const avgTimePerProject = filteredProjects.length > 0
      ? filteredProjects.reduce((s, p) => s + getProjectTotalPrintTime(p), 0) / filteredProjects.length : 0;

    // Material breakdown
    const materialMap = new Map<string, number>();
    filteredProjects.forEach(p => (p.prints || []).forEach(pr => {
      const mat = pr.material || "Unknown";
      materialMap.set(mat, (materialMap.get(mat) || 0) + (pr.materialUsed || 0) * (pr.quantity || 1));
    }));
    const materialBreakdown = Array.from(materialMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
    const mostUsedMaterial = materialBreakdown[0]?.name || "—";

    // On-time vs late
    const onTime = paidSent.filter(p => {
      if (!p.dueDate || !p.shippingDate) return true;
      return parseISO(p.shippingDate) <= parseISO(p.dueDate);
    }).length;
    const late = paidSent.length - onTime;

    return {
      totalRevenue,
      totalExpenses: projectExp + otherExp + filCost,
      netProfit: totalRevenue - projectExp - otherExp - filCost,
      totalOrders: filteredProjects.length,
      totalMaterial,
      completedProjects: completedProjects.length,
      activeProjects: filteredProjects.length - completedProjects.length,
      overdueProjects: overdueProjects.length,
      totalPrintsCompleted: completedPrints.length,
      totalHoursPrinted,
      avgPrintTime,
      completionRate,
      avgProfitPerProject,
      avgTimePerProject,
      materialBreakdown,
      mostUsedMaterial,
      onTime, late,
    };
  }, [filteredProjects, filteredExpenses, totalFilamentPurchasesCost, range]);

  const globalProgress = useMemo(() => getGlobalPrintProgress(filteredProjects), [filteredProjects]);
  const suggestions = useMemo(() => getSuggestions(projects), [projects]);

  // ── Chart: Revenue over time ──
  const revenueOverTime = useMemo(() => {
    if (!interval) {
      // All-time: group by month across all data
      const map = new Map<string, { label: string; revenue: number; profit: number; expenses: number }>();
      filteredProjects.filter(p => p.paid && p.sent).forEach(p => {
        const ds = p.shippingDate || p.orderDate;
        if (!ds) return;
        const key = format(parseISO(ds), "yyyy-MM");
        const label = format(parseISO(ds), "MMM yy");
        const e = map.get(key) || { label, revenue: 0, profit: 0, expenses: 0 };
        const exp = getProjectExpensesTotal(p);
        e.revenue += p.totalPrice || 0;
        e.profit += (p.totalPrice || 0) - exp;
        e.expenses += exp;
        map.set(key, e);
      });
      return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
    }

    // Build time buckets
    let buckets: { start: Date; end: Date; label: string }[] = [];
    if (effectiveGrouping === "day") {
      buckets = eachDayOfInterval(interval).map(d => ({
        start: d, end: d, label: format(d, "MMM d"),
      }));
    } else if (effectiveGrouping === "week") {
      buckets = eachWeekOfInterval(interval, { weekStartsOn: 1 }).map(d => ({
        start: startOfWeek(d, { weekStartsOn: 1 }),
        end: endOfWeek(d, { weekStartsOn: 1 }),
        label: `W${format(d, "w")}`,
      }));
    } else {
      buckets = eachMonthOfInterval(interval).map(d => ({
        start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM"),
      }));
    }

    return buckets.map(b => {
      let revenue = 0, profit = 0, expenses = 0;
      filteredProjects.filter(p => p.paid && p.sent).forEach(p => {
        const ds = p.shippingDate || p.orderDate;
        if (!ds) return;
        try {
          const d = parseISO(ds);
          if (d >= b.start && d <= b.end) {
            const exp = getProjectExpensesTotal(p);
            revenue += p.totalPrice || 0;
            profit += (p.totalPrice || 0) - exp;
            expenses += exp;
          }
        } catch {}
      });
      return { label: b.label, revenue: +revenue.toFixed(2), profit: +profit.toFixed(2), expenses: +expenses.toFixed(2) };
    });
  }, [filteredProjects, interval, effectiveGrouping]);

  // ── Chart: Hours over time ──
  const hoursOverTime = useMemo(() => {
    return revenueOverTime.map((bucket) => {
      // Reuse same labels; compute hours per bucket separately
      let hours = 0;
      filteredProjects.forEach(p => {
        const ds = p.orderDate;
        if (!ds) return;
        try {
          const d = parseISO(ds);
          // Simple approach: if project falls in same bucket period
          const key = bucket.label;
          const projectMonth = interval
            ? (effectiveGrouping === "month" ? format(d, "MMM") : effectiveGrouping === "week" ? `W${format(d, "w")}` : format(d, "MMM d"))
            : format(d, "MMM yy");
          if (projectMonth === key) {
            hours += getProjectTotalPrintTime(p);
          }
        } catch {}
      });
      return { label: bucket.label, hours: +hours.toFixed(1) };
    });
  }, [revenueOverTime, filteredProjects, interval, effectiveGrouping]);

  // ── Chart: Project status distribution ──
  const statusDistribution = useMemo(() => {
    const data = [
      { name: "Completed", value: stats.completedProjects, color: "hsl(168,60%,38%)" },
      { name: "Active", value: stats.activeProjects, color: "hsl(220,60%,50%)" },
      { name: "Overdue", value: stats.overdueProjects, color: "hsl(0,72%,51%)" },
    ].filter(d => d.value > 0);
    return data;
  }, [stats]);

  // ── Smart insight cards ──
  const insights = useMemo(() => {
    // Best revenue day
    const dayMap = new Map<string, number>();
    filteredProjects.filter(p => p.paid && p.sent).forEach(p => {
      const ds = p.shippingDate || p.orderDate;
      if (!ds) return;
      const key = format(parseISO(ds), "yyyy-MM-dd");
      dayMap.set(key, (dayMap.get(key) || 0) + (p.totalPrice || 0));
    });
    const bestDay = Array.from(dayMap.entries()).sort((a, b) => b[1] - a[1])[0];

    // Busiest week
    const weekMap = new Map<string, number>();
    filteredProjects.forEach(p => {
      const ds = p.orderDate;
      if (!ds) return;
      const key = format(parseISO(ds), "yyyy-'W'ww");
      weekMap.set(key, (weekMap.get(key) || 0) + 1);
    });
    const busiestWeek = Array.from(weekMap.entries()).sort((a, b) => b[1] - a[1])[0];

    const avgProfitPerPrint = stats.totalPrintsCompleted > 0
      ? stats.netProfit / stats.totalPrintsCompleted : 0;

    return [
      { label: "Best Day (Revenue)", value: bestDay ? `${format(parseISO(bestDay[0]), "MMM d, yyyy")} — €${bestDay[1].toFixed(2)}` : "—" },
      { label: "Most Used Material", value: stats.mostUsedMaterial },
      { label: "Busiest Week", value: busiestWeek ? `${busiestWeek[0]} (${busiestWeek[1]} orders)` : "—" },
      { label: "Avg Profit/Print", value: `€${avgProfitPerPrint.toFixed(2)}` },
    ];
  }, [filteredProjects, stats]);

  const kpis = [
    { label: "Revenue", value: `€${stats.totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-emerald-600" },
    { label: "Net Profit", value: `€${stats.netProfit.toFixed(2)}`, icon: TrendingUp, color: stats.netProfit >= 0 ? "text-emerald-600" : "text-destructive" },
    { label: "Expenses", value: `€${stats.totalExpenses.toFixed(2)}`, icon: AlertTriangle, color: "text-destructive" },
    { label: "Orders", value: stats.totalOrders, icon: Package, color: "text-primary" },
    { label: "Hours Printed", value: `${stats.totalHoursPrinted.toFixed(1)}h`, icon: Clock, color: "text-primary" },
    { label: "Material Used", value: `${stats.totalMaterial.toFixed(0)}g`, icon: Weight, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={(v: TimeRange) => setRange(v)}>
            <SelectTrigger className="w-[120px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="year">Yearly</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          {range === "month" && (
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[170px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {range === "year" && (
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {range !== "all" && (
            <Select value={effectiveGrouping} onValueChange={(v: Grouping) => setGrouping(v)}>
              <SelectTrigger className="w-[110px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {range === "month" && <SelectItem value="day">By Day</SelectItem>}
                <SelectItem value="week">By Week</SelectItem>
                <SelectItem value="month">By Month</SelectItem>
              </SelectContent>
            </Select>
          )}

          <p className="text-xs text-muted-foreground hidden lg:block">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="hover:shadow-md transition-shadow border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <k.icon className={`h-4 w-4 ${k.color}`} />
                </div>
              </div>
              <p className="text-xl font-bold tracking-tight">{k.value}</p>
              <span className="text-xs text-muted-foreground">{k.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Print Performance + Project Insights Row */}
      <div className="grid md:grid-cols-3 gap-3">
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Printer className="h-4 w-4 text-primary" />Print Performance</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Prints Completed</span><span className="font-semibold">{stats.totalPrintsCompleted}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Hours</span><span className="font-semibold">{stats.totalHoursPrinted.toFixed(1)}h</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Avg Time/Print</span><span className="font-semibold">{stats.avgPrintTime.toFixed(1)}h</span></div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Efficiency</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Completion Rate</span><span className="font-semibold">{stats.completionRate.toFixed(0)}%</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">On-Time</span><span className="font-semibold text-emerald-600">{stats.onTime}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Late</span><span className="font-semibold text-destructive">{stats.late}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Avg Time/Project</span><span className="font-semibold">{stats.avgTimePerProject.toFixed(1)}h</span></div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4 text-primary" />Projects</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Active</span><span className="font-semibold">{stats.activeProjects}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Completed</span><span className="font-semibold text-emerald-600">{stats.completedProjects}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Overdue</span><span className="font-semibold text-destructive">{stats.overdueProjects}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Avg Profit/Project</span><span className="font-semibold">€{stats.avgProfitPerProject.toFixed(2)}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Global print progress */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Global Print Progress</span>
            </div>
            <span className="text-sm font-bold text-primary">{globalProgress.percent}%</span>
          </div>
          <Progress value={globalProgress.percent} className="h-2.5" />
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Completed: {globalProgress.completedHours.toFixed(1)}h</span>
            <span>Remaining: {globalProgress.remainingHours.toFixed(1)}h</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <ProductionSummary />
        <MaterialUsageSummary />
      </div>

      {/* Smart Insight Cards */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Award className="h-4 w-4 text-primary" />Quick Insights</CardTitle>
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

      {/* Charts Row 1: Revenue + Profit vs Expenses */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue Over Time</CardTitle></CardHeader>
          <CardContent>
            {revenueOverTime.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No completed orders yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={revenueOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(220,60%,50%)" strokeWidth={2} dot={{ r: 3 }} name="Revenue (€)" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Profit vs Expenses</CardTitle></CardHeader>
          <CardContent>
            {revenueOverTime.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="profit" fill="hsl(168,60%,38%)" radius={[4, 4, 0, 0]} name="Profit" />
                  <Bar dataKey="expenses" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Hours + Material Breakdown */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Hours Printed Over Time</CardTitle></CardHeader>
          <CardContent>
            {hoursOverTime.every(h => h.hours === 0) ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No print data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={hoursOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="hours" stroke="hsl(38,92%,50%)" strokeWidth={2} dot={{ r: 3 }} name="Hours" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Material Usage Breakdown</CardTitle></CardHeader>
          <CardContent>
            {stats.materialBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No material data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={stats.materialBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                    label={({ name, value }) => `${name}: ${value}g`} labelLine={{ strokeWidth: 1 }}>
                    {stats.materialBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Status Distribution + Orders by Source */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Project Status Distribution</CardTitle></CardHeader>
          <CardContent>
            {statusDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No projects yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                    label={({ name, value }) => `${name}: ${value}`} labelLine={{ strokeWidth: 1 }}>
                    {statusDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" />Revenue by Source</CardTitle></CardHeader>
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
                <p className="text-sm text-muted-foreground py-8 text-center">No revenue data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={sourceData.filter(s => s.revenue > 0)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis type="number" className="text-xs" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" className="text-xs" width={80} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="revenue" fill="hsl(168,60%,38%)" radius={[0, 4, 4, 0]} name="Revenue (€)" />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((s, i) => (
              <div key={i} className="rounded-lg border p-3 hover:bg-accent/20 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">{s.type === "batch" ? "Batch" : "Next Print"}</Badge>
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
