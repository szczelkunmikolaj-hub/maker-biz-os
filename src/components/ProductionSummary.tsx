import { useApp } from "@/context/AppContext";
import { getWorkloadStats, WorkloadLevel } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useMemo } from "react";
import { Clock, Layers, Weight, Activity, CheckCircle } from "lucide-react";

const levelConfig: Record<WorkloadLevel, { label: string; emoji: string; color: string; badgeClass: string; accept: string; acceptLabel: string; message: string }> = {
  low: {
    label: "Low Load",
    emoji: "🟢",
    color: "hsl(var(--primary))",
    badgeClass: "bg-primary/15 text-primary border-primary/30",
    accept: "Yes",
    acceptLabel: "Accept New Orders",
    message: "Printer capacity available — safe to accept new projects.",
  },
  moderate: {
    label: "Moderate Load",
    emoji: "🟡",
    color: "hsl(38, 92%, 50%)",
    badgeClass: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
    accept: "Maybe",
    acceptLabel: "Accept Orders Carefully",
    message: "Moderate workload — accept orders carefully.",
  },
  high: {
    label: "High Load",
    emoji: "🔴",
    color: "hsl(var(--destructive))",
    badgeClass: "bg-destructive/15 text-destructive border-destructive/30",
    accept: "No",
    acceptLabel: "Do Not Accept Orders",
    message: "High workload — consider finishing current projects before accepting more.",
  },
};

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const days = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  if (days === 0) return `${h}h`;
  return `${days}d ${h}h`;
}

export default function ProductionSummary() {
  const { projects, settings } = useApp();

  const stats = useMemo(() => getWorkloadStats(projects, settings), [projects, settings]);
  const cfg = levelConfig[stats.level];

  const progressValue = Math.min(100, (stats.effectiveHours / settings.moderateLoadThreshold) * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Production Queue
          </CardTitle>
          <Badge variant="outline" className={cfg.badgeClass}>
            {cfg.emoji} {cfg.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat icon={Layers} label="Remaining Prints" value={String(stats.remainingPrints)} />
          <Stat icon={Clock} label="Print Hours Left" value={`${stats.totalHours.toFixed(1)}h`} />
          <Stat icon={Weight} label="Material Required" value={`${stats.totalMaterial.toFixed(0)}g`} />
          <Stat icon={Clock} label="Est. Completion" value={formatDuration(stats.effectiveHours)} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Workload</span>
            <span>{stats.effectiveHours.toFixed(1)}h / {settings.moderateLoadThreshold}h</span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        <div className="flex items-center gap-2 rounded-md border p-3 text-sm">
          <CheckCircle className="h-4 w-4 shrink-0" style={{ color: cfg.color }} />
          <div>
            <span className="font-medium">Accept New Orders? {cfg.accept}</span>
            <p className="text-xs text-muted-foreground mt-0.5">{cfg.message}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
