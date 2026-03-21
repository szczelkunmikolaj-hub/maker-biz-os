import { useApp } from "@/context/AppContext";
import { getProjectTotalMaterial, getGlobalPrintProgress, getSuggestions, getWorkloadStats, getAdvancedAnalytics, getProjectExpensesTotal, getEstimatedMaterialCost } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DollarSign, TrendingUp, Package, Clock, Weight, Lightbulb, Printer, Award, BarChart3 } from "lucide-react";
import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import ProductionSummary from "@/components/ProductionSummary";

const COLORS = ["hsl(168,60%,38%)", "hsl(220,60%,50%)", "hsl(38,92%,50%)", "hsl(280,60%,50%)", "hsl(0,72%,51%)"];

export default function Dashboard() {
  const { projects, expenses, settings, totalFilamentPurchasesCost } = useApp();

  const stats = useMemo(() => {
    const paidSent = projects.filter(p => p.paid && p.sent);
    const totalRevenue = paidSent.reduce((s, p) => s + (p.totalPrice || 0), 0);
    // Real profit: revenue - filament purchases - other expenses - project expenses
    const projectExpenses = paidSent.reduce((s, p) => s + getProjectExpensesTotal(p), 0);
    const otherExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const realProfit = totalRevenue - totalFilamentPurchasesCost - otherExpenses - projectExpenses;
    // Estimated material cost (informational only)
    const estimatedMaterialCost = projects.reduce((s, p) => s + getEstimatedMaterialCost(p, settings.filamentCostPerGram), 0);
    const totalMaterial = projects.reduce((s, p) => s + getProjectTotalMaterial(p), 0);
    const realMargin = totalRevenue > 0 ? (realProfit / totalRevenue) * 100 : 0;
    return { totalRevenue, totalProfit: realProfit, totalOrders: projects.length, totalMaterial, estimatedMaterialCost, realMargin };
  }, [projects, expenses, settings, totalFilamentPurchasesCost]);

  const globalProgress = useMemo(() => getGlobalPrintProgress(projects), [projects]);
  const suggestions = useMemo(() => getSuggestions(projects), [projects]);
  const advanced = useMemo(() => getAdvancedAnalytics(projects, expenses, settings.filamentCostPerGram), [projects, expenses, settings]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; orders: number; revenue: number; profit: number }>();
    projects.filter(p => p.paid && p.sent).forEach(p => {
      const dateStr = p.shippingDate || p.orderDate;
      if (!dateStr) return;
      const key = format(parseISO(dateStr), "yyyy-MM");
      const label = format(parseISO(dateStr), "MMM yy");
      const existing = map.get(key) || { month: label, orders: 0, revenue: 0, profit: 0 };
      existing.orders++;
      existing.revenue += p.totalPrice || 0;
      // For monthly chart, profit = revenue - project expenses (filament purchases are global)
      existing.profit += (p.totalPrice || 0) - getProjectExpensesTotal(p);
      map.set(key, existing);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [projects]);

  const sourceData = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number }>();
    projects.forEach(p => {
      const existing = map.get(p.customerSource) || { orders: 0, revenue: 0 };
      existing.orders++;
      if (p.paid && p.sent) existing.revenue += p.totalPrice || 0;
      map.set(p.customerSource, existing);
    });
    return Array.from(map.entries()).map(([name, v]) => ({ name, value: v.orders, revenue: v.revenue }));
  }, [projects]);

  const kpis = [
    { label: "Revenue", value: `€${stats.totalRevenue.toFixed(2)}`, icon: DollarSign },
    { label: "Net Profit", value: `€${stats.totalProfit.toFixed(2)}`, icon: TrendingUp },
    { label: "Orders", value: stats.totalOrders, icon: Package },
    { label: "Hours Printed", value: `${globalProgress.completedHours.toFixed(1)}h`, icon: Clock },
    { label: "Hours Remaining", value: `${globalProgress.remainingHours.toFixed(1)}h`, icon: Printer },
    { label: "Material Used", value: `${stats.totalMaterial.toFixed(0)}g`, icon: Weight },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <k.icon className="h-4 w-4" />
                <span className="text-xs font-medium">{k.label}</span>
              </div>
              <p className="text-xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Global print progress */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Global Print Progress</span>
            </div>
            <span className="text-sm text-muted-foreground">{globalProgress.percent}%</span>
          </div>
          <Progress value={globalProgress.percent} className="h-2" />
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Completed: {globalProgress.completedHours.toFixed(1)}h</span>
            <span>Remaining: {globalProgress.remainingHours.toFixed(1)}h</span>
          </div>
        </CardContent>
      </Card>

      <ProductionSummary />

      {/* Advanced analytics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Avg Order Value", value: `€${advanced.avgOrderValue.toFixed(2)}`, icon: DollarSign },
          { label: "Avg Profit Margin", value: `${advanced.avgProfitMargin.toFixed(1)}%`, icon: TrendingUp },
          { label: "Avg Print Time/Order", value: `${advanced.avgPrintTime.toFixed(1)}h`, icon: Clock },
          { label: "Avg Material/Order", value: `${advanced.avgMaterial.toFixed(0)}g`, icon: Weight },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <k.icon className="h-4 w-4" />
                <span className="text-xs font-medium">{k.label}</span>
              </div>
              <p className="text-lg font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4" />
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
              <div key={i.label} className="space-y-1">
                <p className="text-xs text-muted-foreground">{i.label}</p>
                <p className="text-sm font-medium">{i.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Suggestions & Optimization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((s, i) => (
              <div key={i} className="rounded-md border p-3">
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
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue & Profit by Month</CardTitle></CardHeader>
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

        <Card>
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
      <Card>
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
