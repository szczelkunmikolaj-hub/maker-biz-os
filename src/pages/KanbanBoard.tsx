import { useApp } from "@/context/AppContext";
import { useMonth } from "@/context/MonthContext";
import { ProductionStage, normalizeStage, STAGE_META, getProjectProgress, getProjectPaymentStatus, getProjectPiecesTotal, getProjectBalance, getProgressSummary } from "@/types";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePersistedState } from "@/hooks/usePersistedState";
import { PlatePreview } from "@/components/PlatePreview";
import { PaymentBadge } from "@/components/PaymentBadge";
import { RecordPaymentDialog } from "@/components/RecordPaymentDialog";
import { useMarkAsPaid } from "@/hooks/useMarkAsPaid";
import { isBefore, isAfter, subDays, parseISO, startOfToday } from "date-fns";
import posthog from "@/lib/posthog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreditCard, DollarSign, MoreHorizontal } from "lucide-react";
import type { Project } from "@/types";

const STAGE_COLS: ProductionStage[] = ['new', 'in-design', 'awaiting-approval', 'printing', 'ready', 'delivered'];

const COL_STYLE: Record<ProductionStage, { dot: string; bg: string; border: string }> = {
  'new':               { dot: 'bg-[hsl(215,14%,52%)]', bg: 'bg-[hsl(215,14%,52%/0.04)]', border: 'border-[hsl(215,14%,52%/0.2)]' },
  'in-design':         { dot: 'bg-[hsl(262,45%,56%)]', bg: 'bg-[hsl(262,45%,56%/0.04)]', border: 'border-[hsl(262,45%,56%/0.2)]' },
  'awaiting-approval': { dot: 'bg-[hsl(38,85%,46%)]',  bg: 'bg-[hsl(38,85%,46%/0.04)]',  border: 'border-[hsl(38,85%,46%/0.2)]' },
  'printing':          { dot: 'bg-[hsl(215,70%,45%)]', bg: 'bg-[hsl(215,70%,45%/0.04)]', border: 'border-[hsl(215,70%,45%/0.2)]' },
  'ready':             { dot: 'bg-[hsl(188,60%,36%)]', bg: 'bg-[hsl(188,60%,36%/0.04)]', border: 'border-[hsl(188,60%,36%/0.2)]' },
  'delivered':         { dot: 'bg-[hsl(142,30%,40%)]', bg: 'bg-[hsl(142,30%,40%/0.04)]', border: 'border-[hsl(142,30%,40%/0.2)]' },
};

export default function KanbanBoard() {
  const { projects, moveProject, settings } = useApp();
  const { filterProjectsForWorkflow, mode } = useMonth();
  const navigate = useNavigate();
  const [dragging, setDragging] = useState<string | null>(null);
  const [showAll, setShowAll] = usePersistedState<boolean>("kanban_show_all", true);
  const [showAllDelivered, setShowAllDelivered] = useState(false);
  const [collapsed, setCollapsed] = usePersistedState<Record<string, boolean>>("kanban_collapsed", {});
  const [recordPaymentProject, setRecordPaymentProject] = useState<Project | null>(null);
  const markAsPaid = useMarkAsPaid();
  const currency = settings.currency === 'USD' ? '$' : settings.currency === 'GBP' ? '£' : '€';

  const visibleProjects = useMemo(() => {
    return (showAll || mode === 'all') ? projects : filterProjectsForWorkflow(projects);
  }, [projects, showAll, mode, filterProjectsForWorkflow]);

  const colItems = useMemo(() => {
    const today = startOfToday();
    const cutoff = subDays(today, 14);
    return Object.fromEntries(STAGE_COLS.map(stage => {
      let items = visibleProjects.filter(p => normalizeStage(p) === stage);
      if (stage === 'delivered' && !showAllDelivered) {
        items = items.filter(p => {
          const d = p.shippingDate || p.completedAt;
          return !d || isAfter(parseISO(d), cutoff);
        });
      }
      return [stage, items];
    }));
  }, [visibleProjects, showAllDelivered]);

  const handleDrop = (stage: ProductionStage) => {
    if (!dragging) return;
    const proj = projects.find(p => p.id === dragging);
    if (proj && normalizeStage(proj) !== stage) {
      posthog.capture('project_kanban_moved', { from_stage: normalizeStage(proj), to_stage: stage });
      moveProject(dragging, stage);
    }
    setDragging(null);
  };

  const openProject = (id: string) => navigate(`/projects?id=${id}`, { state: { from: '/kanban' } });

  const today = startOfToday();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Kanban board</h1>
        {mode === 'month' && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" className="rounded" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
            Show all projects
          </label>
        )}
      </div>

      <div className="overflow-x-auto -mx-4 px-4 pb-2">
        <div className="grid gap-3 min-h-[65vh]" style={{ gridTemplateColumns: `repeat(${STAGE_COLS.length}, minmax(180px, 1fr))`, minWidth: 900 }}>
          {STAGE_COLS.map(stage => {
            const meta = STAGE_META[stage];
            const style = COL_STYLE[stage];
            const items = colItems[stage] || [];
            const totalValue = items.reduce((s, p) => s + (getProjectPiecesTotal(p) || p.totalPrice || 0), 0);
            const isCollapsed = collapsed[stage];

            return (
              <div
                key={stage}
                className={`rounded-xl border p-2.5 space-y-2 transition-colors ${style.bg} ${style.border} ${dragging ? 'border-dashed border-2' : ''}`}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(stage)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-0.5 mb-1">
                  <button
                    className="flex items-center gap-1.5 text-left"
                    onClick={() => setCollapsed(prev => ({ ...prev, [stage]: !isCollapsed }))}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
                    <span className="text-sm font-semibold">{meta.label}</span>
                    <span className="text-[10px] text-muted-foreground bg-background/80 rounded-full px-1.5 py-0.5 font-medium">{items.length}</span>
                  </button>
                  {totalValue > 0 && (
                    <span className="text-[10px] text-muted-foreground font-medium">{currency}{totalValue.toFixed(0)}</span>
                  )}
                </div>

                {!isCollapsed && (
                  <>
                    {items.map(p => {
                      const progress = getProjectProgress(p);
                      const payStatus = getProjectPaymentStatus(p);
                      const balance = getProjectBalance(p);
                      const price = getProjectPiecesTotal(p) || p.totalPrice || 0;
                      const summary = getProgressSummary(p);
                      const due = p.dueDate ? parseISO(p.dueDate) : null;
                      const isOverdue = due && isBefore(due, today) && progress.percent < 100;
                      const isDueSoon = due && !isOverdue && isBefore(due, new Date(today.getTime() + 2 * 86400000));

                      return (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={() => setDragging(p.id)}
                          onDragEnd={() => setDragging(null)}
                          className="bg-card border border-border rounded-lg p-2.5 cursor-grab active:cursor-grabbing hover:border-[hsl(215,70%,45%/0.5)] hover:shadow-sm transition-all group"
                          onClick={() => openProject(p.id)}
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <PlatePreview
                              thumbnail={p.coverThumbnail || p.prints?.[0]?.thumbnail}
                              color={(p.prints || []).map(pr => pr.color).filter(Boolean).join(', ') || undefined}
                              palette={(p.prints || []).flatMap(pr => pr.colorPalette || [])}
                              label={p.name}
                              size="sm"
                              noHover
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-xs truncate leading-tight group-hover:text-[hsl(215,70%,45%)] transition-colors">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{p.customerName}</p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0">
                                  <MoreHorizontal className="h-3 w-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44" onClick={e => e.stopPropagation()}>
                                {balance > 0 && (
                                  <>
                                    <DropdownMenuItem onClick={() => markAsPaid(p)}>
                                      <CreditCard className="h-3.5 w-3.5 mr-2" />Mark as paid
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setRecordPaymentProject(p)}>
                                      <DollarSign className="h-3.5 w-3.5 mr-2" />Record payment
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                <DropdownMenuItem onClick={() => openProject(p.id)}>
                                  Open
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="flex items-center justify-between mt-1.5 gap-1">
                            <span className="text-sm font-bold tabular-nums">{currency}{price.toFixed(2)}</span>
                            <PaymentBadge status={payStatus} balance={balance} currency={currency} />
                          </div>

                          {summary && (
                            <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{summary}</p>
                          )}

                          {p.dueDate && (
                            <div className={`mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full w-fit ${
                              isOverdue ? 'bg-[hsl(0,68%,50%/0.12)] text-[hsl(0,68%,44%)]' :
                              isDueSoon ? 'bg-[hsl(38,85%,46%/0.12)] text-[hsl(38,85%,36%)]' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {isOverdue ? 'Overdue · ' : isDueSoon ? 'Due soon · ' : 'Due '}{p.dueDate}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {stage === 'delivered' && !showAllDelivered && visibleProjects.filter(p => normalizeStage(p) === 'delivered').length > items.length && (
                      <button
                        className="w-full text-[10px] text-primary underline text-center py-1"
                        onClick={e => { e.stopPropagation(); setShowAllDelivered(true); }}
                      >
                        Show all delivered
                      </button>
                    )}

                    {items.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg border-border/50">
                        Drop here
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {recordPaymentProject && (
        <RecordPaymentDialog
          project={recordPaymentProject}
          open={!!recordPaymentProject}
          onClose={() => setRecordPaymentProject(null)}
        />
      )}
    </div>
  );
}
