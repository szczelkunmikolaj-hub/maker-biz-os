import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Printer } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isValid } from "date-fns";

interface CalendarEntry {
  projectId: string;
  projectName: string;
  dueDate: Date;
  printer: string;
  estimatedHours: number;
  isPrinted: boolean;
}

export default function CalendarPage() {
  const { projects, updateProject } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editingProject, setEditingProject] = useState<string | null>(null);

  // Collect entries from projects with dueDates
  const entries = useMemo(() => {
    const result: CalendarEntry[] = [];
    projects.forEach(p => {
      if (p.dueDate) {
        const d = parseISO(p.dueDate);
        if (isValid(d)) {
          const totalHours = (p.prints || []).reduce((s, pr) => s + (pr.estimatedPrintTime || 0) * (pr.quantity || 1), 0);
          const mainPrinter = (p.prints || []).find(pr => pr.printer)?.printer || "";
          result.push({
            projectId: p.id,
            projectName: p.name,
            dueDate: d,
            printer: mainPrinter,
            estimatedHours: totalHours,
            isPrinted: p.printed,
          });
        }
      }
    });
    return result;
  }, [projects]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start to Monday
  const startDay = monthStart.getDay();
  const padStart = (startDay === 0 ? 6 : startDay - 1);
  const padDays = Array.from({ length: padStart }, (_, i) => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - padStart + i);
    return d;
  });

  const allDays = [...padDays, ...days];
  // Pad end to fill the week
  const remaining = 7 - (allDays.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(monthEnd);
      d.setDate(d.getDate() + i);
      allDays.push(d);
    }
  }

  const today = new Date();

  const handleDayClick = (day: Date, projectId: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (proj) {
      updateProject({ ...proj, dueDate: format(day, "yyyy-MM-dd") });
    }
    setEditingProject(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarIcon className="h-6 w-6" />
          Print Calendar
        </h1>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg">{format(currentMonth, "MMMM yyyy")}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-px mb-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
              <div key={d} className="text-xs font-medium text-muted-foreground text-center py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px">
            {allDays.map((day, i) => {
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, today);
              const dayEntries = entries.filter(e => isSameDay(e.dueDate, day));

              return (
                <div
                  key={i}
                  className={`min-h-[80px] p-1 border rounded-sm text-xs transition-colors ${
                    isCurrentMonth ? "bg-card" : "bg-muted/30"
                  } ${isToday ? "ring-2 ring-primary" : ""} ${
                    editingProject ? "cursor-pointer hover:bg-accent/50" : ""
                  }`}
                  onClick={() => {
                    if (editingProject) handleDayClick(day, editingProject);
                  }}
                >
                  <div className={`font-medium mb-0.5 ${isCurrentMonth ? "text-foreground" : "text-muted-foreground"}`}>
                    {format(day, "d")}
                  </div>
                  {dayEntries.map(entry => (
                    <div
                      key={entry.projectId}
                      className={`rounded px-1 py-0.5 mb-0.5 truncate cursor-pointer text-[10px] leading-tight ${
                        entry.isPrinted
                          ? "bg-primary/20 text-primary line-through"
                          : "bg-accent text-accent-foreground"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProject(editingProject === entry.projectId ? null : entry.projectId);
                      }}
                      title={`${entry.projectName} — ${entry.estimatedHours.toFixed(1)}h${entry.printer ? ` (${entry.printer})` : ""}`}
                    >
                      <span className="font-medium">{entry.projectName}</span>
                      {entry.estimatedHours > 0 && (
                        <span className="ml-1 opacity-70">{entry.estimatedHours.toFixed(0)}h</span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {editingProject && (
            <div className="mt-3 p-2 rounded-md border bg-accent/30 text-sm flex items-center justify-between">
              <span>Click a day to move <strong>{projects.find(p => p.id === editingProject)?.name}</strong></span>
              <Button size="sm" variant="ghost" onClick={() => setEditingProject(null)}>Cancel</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming prints list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Upcoming Due Dates</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.filter(e => !e.isPrinted).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No projects with due dates. Set a due date on a project to see it here.
            </p>
          ) : (
            <div className="space-y-2">
              {entries.filter(e => !e.isPrinted).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()).map(entry => (
                <div key={entry.projectId} className="flex items-center justify-between p-2 rounded-md border text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{format(entry.dueDate, "MMM d")}</Badge>
                    <span className="font-medium">{entry.projectName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {entry.printer && <span className="flex items-center gap-1"><Printer className="h-3 w-3" />{entry.printer}</span>}
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{entry.estimatedHours.toFixed(1)}h</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
