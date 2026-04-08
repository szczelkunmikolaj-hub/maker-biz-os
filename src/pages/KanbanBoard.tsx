import { useApp } from "@/context/AppContext";
import { useMonth } from "@/context/MonthContext";
import { KanbanStatus, getProjectTotalPrintTime, getProjectTotalMaterial, getProjectProgress } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Weight, Layers, ArrowRight } from "lucide-react";
import { usePersistedState } from "@/hooks/usePersistedState";

const COLUMNS: { status: KanbanStatus; label: string; dotColor: string; bgClass: string }[] = [
  { status: "new-order", label: "New Order", dotColor: "bg-blue-500", bgClass: "bg-blue-500/5 border-blue-500/20" },
  { status: "printing", label: "Printing", dotColor: "bg-yellow-500", bgClass: "bg-yellow-500/5 border-yellow-500/20" },
  { status: "finished", label: "Finished", dotColor: "bg-emerald-500", bgClass: "bg-emerald-500/5 border-emerald-500/20" },
  { status: "paid", label: "Paid", dotColor: "bg-purple-500", bgClass: "bg-purple-500/5 border-purple-500/20" },
  { status: "shipped", label: "Shipped", dotColor: "bg-muted-foreground", bgClass: "bg-muted/30 border-muted-foreground/20" },
];

export default function KanbanBoard() {
  const { projects, moveProject, updateProject } = useApp();
  const { filterProjectsForWorkflow, mode } = useMonth();
  const navigate = useNavigate();
  const [dragging, setDragging] = useState<string | null>(null);
  const [showAll, setShowAll] = usePersistedState<boolean>("kanban_show_all", true);

  const visibleProjects = useMemo(() => {
    return (showAll || mode === 'all') ? projects : filterProjectsForWorkflow(projects);
  }, [projects, showAll, mode, filterProjectsForWorkflow]);

  const handleDragStart = (id: string) => setDragging(id);
  const handleDrop = (status: KanbanStatus) => {
    if (dragging) { moveProject(dragging, status); setDragging(null); }
  };

  const toggleField = (id: string, field: 'printed' | 'paid' | 'sent') => {
    const proj = projects.find(p => p.id === id);
    if (proj) updateProject({ ...proj, [field]: !proj[field] });
  };

  const openProject = (id: string) => navigate(`/projects?id=${id}`);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kanban Board</h1>
        {mode === 'month' && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <Switch checked={showAll} onCheckedChange={setShowAll} className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4" />
            Show All Projects
          </label>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 min-h-[65vh]">
        {COLUMNS.map(col => {
          const items = visibleProjects.filter(p => p.kanbanStatus === col.status);
          return (
            <div
              key={col.status}
              className={`rounded-xl border p-3 space-y-2.5 transition-colors ${col.bgClass} ${
                dragging ? 'border-dashed border-2' : ''
              }`}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(col.status)}
            >
              <div className="flex items-center justify-between mb-1 px-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                  <span className="text-sm font-semibold">{col.label}</span>
                </div>
                <span className="text-xs text-muted-foreground font-medium bg-background/80 rounded-full px-2 py-0.5">{items.length}</span>
              </div>
              {items.map(p => {
                const progress = getProjectProgress(p);
                const totalTime = getProjectTotalPrintTime(p);
                const totalMaterial = getProjectTotalMaterial(p);
                return (
                  <Card
                    key={p.id}
                    draggable
                    onDragStart={() => handleDragStart(p.id)}
                    className="cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-md transition-all group"
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="cursor-pointer" onClick={() => openProject(p.id)}>
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{p.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{p.customerName}</p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                        </div>
                        <p className="text-sm font-bold text-primary mt-1">€{p.totalPrice.toFixed(2)}</p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                          {(p.prints || []).length > 0 && (
                            <span className="flex items-center gap-0.5"><Layers className="h-3 w-3" />{(p.prints || []).length}</span>
                          )}
                          {totalTime > 0 && (
                            <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{totalTime.toFixed(0)}h</span>
                          )}
                          {totalMaterial > 0 && (
                            <span className="flex items-center gap-0.5"><Weight className="h-3 w-3" />{totalMaterial.toFixed(0)}g</span>
                          )}
                        </div>
                        {progress.totalPieces > 0 && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Progress value={progress.percent} className="h-1 flex-1" />
                            <span className="text-[10px] text-muted-foreground">{progress.percent}%</span>
                          </div>
                        )}
                        {p.dueDate && (
                          <p className="text-[10px] text-muted-foreground mt-1">Due: {p.dueDate}</p>
                        )}
                      </div>
                      <div className="flex gap-3 pt-1.5 border-t" onClick={e => e.stopPropagation()}>
                        {(["printed", "paid", "sent"] as const).map(field => (
                          <label key={field} className="flex items-center gap-1 cursor-pointer">
                            <Checkbox checked={p[field]} onCheckedChange={() => toggleField(p.id, field)} />
                            <span className="text-[10px] capitalize">{field === 'sent' ? 'shipped' : field}</span>
                          </label>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {items.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-10 border-2 border-dashed rounded-lg">
                  Drop here
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
