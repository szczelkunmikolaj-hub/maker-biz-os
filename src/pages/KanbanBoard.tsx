import { useApp } from "@/context/AppContext";
import { KanbanStatus } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";

const COLUMNS: { status: KanbanStatus; label: string; color: string }[] = [
  { status: "new-order", label: "New Order", color: "bg-blue-100 text-blue-800" },
  { status: "printing", label: "Printing", color: "bg-yellow-100 text-yellow-800" },
  { status: "finished", label: "Finished", color: "bg-green-100 text-green-800" },
  { status: "paid", label: "Paid", color: "bg-purple-100 text-purple-800" },
  { status: "shipped", label: "Shipped", color: "bg-muted text-muted-foreground" },
];

export default function KanbanBoard() {
  const { projects, moveProject, updateProject } = useApp();
  const [dragging, setDragging] = useState<string | null>(null);

  const handleDragStart = (id: string) => setDragging(id);
  const handleDrop = (status: KanbanStatus) => {
    if (dragging) { moveProject(dragging, status); setDragging(null); }
  };

  const toggleField = (id: string, field: 'printed' | 'paid' | 'sent') => {
    const proj = projects.find(p => p.id === id);
    if (proj) updateProject({ ...proj, [field]: !proj[field] });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Kanban Board</h1>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 min-h-[60vh]">
        {COLUMNS.map(col => {
          const items = projects.filter(p => p.kanbanStatus === col.status);
          return (
            <div
              key={col.status}
              className="rounded-lg border bg-muted/30 p-3 space-y-2"
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(col.status)}
            >
              <div className="flex items-center justify-between mb-2">
                <Badge className={col.color}>{col.label}</Badge>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              {items.map(p => (
                <Card
                  key={p.id}
                  draggable
                  onDragStart={() => handleDragStart(p.id)}
                  className="cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
                >
                  <CardContent className="p-3">
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.customerName}</p>
                    <p className="text-sm font-bold text-primary mt-1">€{p.totalPrice.toFixed(2)}</p>
                    <div className="flex gap-3 mt-2" onClick={e => e.stopPropagation()}>
                      {(["printed", "paid", "sent"] as const).map(field => (
                        <label key={field} className="flex items-center gap-1 cursor-pointer">
                          <Checkbox checked={p[field]} onCheckedChange={() => toggleField(p.id, field)} />
                          <span className="text-[10px] capitalize">{field === 'sent' ? 'shipped' : field}</span>
                        </label>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Drop here</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
