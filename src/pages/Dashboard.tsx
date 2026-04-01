import { useApp } from "@/context/AppContext";
import { getProjectTotalMaterial, getGlobalPrintProgress, getSuggestions, getAdvancedAnalytics, getProjectExpensesTotal, getEstimatedMaterialCost, getProjectProgress } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DollarSign, TrendingUp, Package, Clock, Weight, Lightbulb, Printer, Award, BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import { format, parseISO, startOfMonth, startOfYear, isAfter, isBefore } from "date-fns";
import ProductionSummary from "@/components/ProductionSummary";
import MaterialUsageSummary from "@/components/MaterialUsageSummary";

const COLORS = ["hsl(168,60%,38%)", "hsl(220,60%,50%)", "hsl(38,92%,50%)", "hsl(280,60%,50%)", "hsl(0,72%,51%)"];

type TimeRange = "month" | "year" | "all";

function filterByRange<T extends { orderDate?: string; shippingDate?: string; date?: string }>(items: T[], range: TimeRange): T[] {
  if (range === "all") return items;
  const now = new Date();
  const start = range === "month" ? startOfMonth(now) : startOfYear(now);
  return items.filter(item => {
    const dateStr = (item as any).orderDate || (item as any).shippingDate || (item as any).date;
    if (!dateStr) return false;
    try { return isAfter(parseISO(dateStr), start); } catch { return false; }
  });
}

export default function Dashboard() {
  const { projects, expenses, settings, totalFilamentPurchasesCost } = useApp();
  const [range, setRange] = useState<TimeRange>("all");

  const filteredProjects = useMemo(() => filterByRange(projects, range), [projects, range]);
  const filteredExpenses = useMemo(() => filterByRange(expenses, range), [expenses, range]);

  const stats = useMemo(() => {
    const paidSent = filteredProjects.filter(p => p.paid && p.sent);
    const totalRevenue = paidSent.reduce((s, p) => s + (p.totalPrice || 0), 0);
    const projectExpenses = paidSent.reduce((s, p) => s + getProjectExpensesTotal(p), 0);
    const otherExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const realProfit = totalRevenue - (range === "all" ? totalFilamentPurchasesCost : 0) - otherExpenses - projectExpenses;
    const totalMaterial = filteredProjects.reduce((s, p) => s + getProjectTotalMaterial(p), 0);
    return { totalRevenue, totalProfit: realProfit, totalOrders: filteredProjects.length, totalMaterial };
  }, [filteredProjects, filteredExpenses, settings, totalFilamentPurchasesCost, range]);

  const globalProgress = useMemo(() => getGlobalPrintProgress(filteredProjects), [filteredProjects]);
  const suggestions = useMemo(() => getSuggestions(projects), [projects]);
  const advanced = useMemo(() => getAdvancedAnalytics(filteredProjects, filteredExpenses, settings.filamentCostPerGram), [filteredProjects, filteredExpenses, settings]);

  // Auto-complete projects where all parts are done
  const projectsWithProgress = useMemo(() => {
    return filteredProjects.map(p => {
      const prog = getProjectProgress(p);
      const autoComplete = prog.totalPieces > 0 && prog.percent === 100;
      return { ...p, _progress: prog, _autoComplete: autoComplete };
    });
  }, [filteredProjects]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; orders: number; revenue: number; profit: number }>();
    filteredProjects.filter(p => p.paid && p.sent).forEach(p => {
      const dateStr = p.shippingDate || p.orderDate;
      if (!dateStr) return;
      const key = format(parseISO(dateStr), "yyyy-MM");
      const label = format(parseISO(dateStr), "MMM yy");
      const existing = map.get(key) || { month: label, orders: 0, revenue: 0, profit: 0 };
      existing.orders++;
      existing.revenue += p.totalPrice || 0;
      existing.profit += (p.totalPrice || 0) - getProjectExpensesTotal(p);
      map.set(key, existing);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filteredProjects]);

  const sourceData = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number }>();
    filteredProjects.forEach(p => {
      const existing = map.get(p.customerSource) || { orders: 0, revenue: 0 };
      existing.orders++;
      if (p.paid && p.sent) existing.revenue += p.totalPrice || 0;
      map.set(p.customerSource, existing);
    });
    return Array.from(map.entries()).map(([name, v]) => ({ name, value: v.orders, revenue: v.revenue }));
  }, [filteredProjects]);

  const kpis = [
    { label: "Revenue", value: `€${stats.totalRevenue.toFixed(2)}`, icon: DollarSign, accent: true },
    { label: "Net Profit", value: `€${stats.totalProfit.toFixed(2)}`, icon: TrendingUp, accent: stats.totalProfit > 0 },
    { label: "Orders", value: stats.totalOrders, icon: Package },
    { label: "Hours Printed", value: `${globalProgress.completedHours.toFixed(1)}h`, icon: Clock },
    { label: "Hours Remaining", value: `${globalProgress.remainingHours.toFixed(1)}h`, icon: Printer },
    { label: "Material Used", value: `${stats.totalMaterial.toFixed(0)}g`, icon: Weight },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <Select value={range} onValueChange={(v: TimeRange) => setRange(v)}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground hidden md:block">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <k.icon className="h-4 w-4 text-primary" />
                </div>
              </div>
              <p className="text-xl font-bold tracking-tight">{k.value}</p>
              <span className="text-xs text-muted-foreground">{k.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Global print progress */}
      <Card className="hover:shadow-md transition-shadow">
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

      {/* Advanced analytics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Avg Order Value", value: `€${advanced.avgOrderValue.toFixed(2)}`, icon: DollarSign },
          { label: "Avg Profit Margin", value: `${advanced.avgProfitMargin.toFixed(1)}%`, icon: TrendingUp },
          { label: "Avg Print Time/Order", value: `${advanced.avgPrintTime.toFixed(1)}h`, icon: Clock },
          { label: "Avg Material/Order", value: `${advanced.avgMaterial.toFixed(0)}g`, icon: Weight },
        ].map(k => (
          <Card key={k.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                <k.icon className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{k.label}</span>
              </div>
              <p className="text-lg font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insights */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            Key Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Most Profitable Print", value: advanced.mostProfitablePrint },
              { label: "Most Ordered Print", value: advanced.mostOrderedPrint },
              { label: "Longest Print Job", value: advanced.longestPrint },
              { label: "Most Material Project", value: advanced.mostMaterialProject },
            ].map(i => (
              <div key={i.label} className="space-y-1 p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">{i.label}</p>
                <p className="text-sm font-semibold truncate">{i.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-warning" />
              Suggestions &amp; Optimization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((s, i) => (
              <div key={i} className="rounded-lg border p-3 hover:bg-accent/20 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">{s.type === 'batch' ? 'Batch' : 'Next Print'}</Badge>
                </div>
                <p className="text-sm">{s.message}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {s.printNames.map(n => (
                    <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader><CardTitle className="text-base">Revenue &amp; Profit by Month</CardTitle></CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No completed orders yet. Revenue is counted when Paid + Sent.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="hsl(168,60%,38%)" radius={[4, 4, 0, 0]} name="Revenue" />
                  <Bar dataKey="profit" fill="hsl(220,60%,50%)" radius={[4, 4, 0, 0]} name="Profit" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader><CardTitle className="text-base">Orders by Source</CardTitle></CardHeader>
          <CardContent>
            {sourceData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue by source */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />Revenue by Source</CardTitle></CardHeader>
        <CardContent>
          {sourceData.filter(s => s.revenue > 0).length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No revenue data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sourceData.filter(s => s.revenue > 0)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" />
                <YAxis type="category" dataKey="name" className="text-xs" width={80} />
                <Tooltip />
                <Bar dataKey="revenue" fill="hsl(168,60%,38%)" radius={[0, 4, 4, 0]} name="Revenue (€)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
