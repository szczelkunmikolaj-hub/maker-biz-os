import { useApp } from "@/context/AppContext";
import { getWorkloadStats, WorkloadLevel } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useMemo } from "react";
import { Clock, Layers, Weight, Activity, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const days = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  if (days === 0) return `${h}h`;
  return `${days}d ${h}h`;
}

export default function ProductionSummary() {
  const { projects, settings } = useApp();
  const { t } = useTranslation();

  const levelConfig: Record<WorkloadLevel, { label: string; emoji: string; color: string; badgeClass: string; accept: string; acceptLabel: string; message: string }> = {
    low: {
      label: t('production.lowLoad'),
      emoji: "🟢",
      color: "hsl(var(--primary))",
      badgeClass: "bg-primary/15 text-primary border-primary/30",
      accept: t('production.acceptYes'),
      acceptLabel: t('production.acceptLabel'),
      message: t('production.lowMessage'),
    },
    moderate: {
      label: t('production.moderateLoad'),
      emoji: "🟡",
      color: "hsl(38, 92%, 50%)",
      badgeClass: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
      accept: t('production.acceptMaybe'),
      acceptLabel: t('production.acceptCarefullyLabel'),
      message: t('production.moderateMessage'),
    },
    high: {
      label: t('production.highLoad'),
      emoji: "🔴",
      color: "hsl(var(--destructive))",
      badgeClass: "bg-destructive/15 text-destructive border-destructive/30",
      accept: t('production.acceptNo'),
      acceptLabel: t('production.doNotAcceptLabel'),
      message: t('production.highMessage'),
    },
  };

  const stats = useMemo(() => getWorkloadStats(projects, settings), [projects, settings]);
  const cfg = levelConfig[stats.level];

  const progressValue = Math.min(100, (stats.effectiveHours / settings.moderateLoadThreshold) * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {t('production.title')}
          </CardTitle>
          <Badge variant="outline" className={cfg.badgeClass}>
            {cfg.emoji} {cfg.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat icon={Layers} label={t('production.remainingPrints')} value={String(stats.remainingPrints)} />
          <Stat icon={Clock} label={t('production.printHoursLeft')} value={`${stats.totalHours.toFixed(1)}h`} />
          <Stat icon={Weight} label={t('production.materialRequired')} value={`${stats.totalMaterial.toFixed(0)}g`} />
          <Stat icon={Clock} label={t('production.estCompletion')} value={formatDuration(stats.effectiveHours)} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('production.workload')}</span>
            <span>{stats.effectiveHours.toFixed(1)}h / {settings.moderateLoadThreshold}h</span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        <div className="flex items-center gap-2 rounded-md border p-3 text-sm">
          <CheckCircle className="h-4 w-4 shrink-0" style={{ color: cfg.color }} />
          <div>
            <span className="font-medium">{t('production.acceptNewOrders')} {cfg.accept}</span>
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
