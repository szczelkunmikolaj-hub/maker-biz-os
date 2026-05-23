import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useApp } from "@/context/AppContext";
import { useMonth } from "@/context/MonthContext";
import { Project, getProjectTotalPrintTime } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Printer, Package, Truck, CircleDot, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isValid, isAfter, isBefore, differenceInDays } from "date-fns";

type EventType = 'order-created' | 'printing-scheduled' | 'printing-in-progress' | 'completed' | 'shipping-deadline' | 'late';

interface CalendarEvent {
  id: string;
  projectId: string;
  projectName: string;
  customerName: string;
  date: Date;
  type: EventType;
  estimatedHours: number;
  printCount: number;
  isNew: boolean;
}

type EventConfig = Record<EventType, { label: string; color: string; bgClass: string; textClass: string; icon: React.ElementType }>;

function isProjectCompleted(p: Project): boolean {
  return !!(p.printed || p.sent || p.paid);
}

function getDueDateEventType(p: Project): EventType {
  if (isProjectCompleted(p)) return 'completed';
  if (p.dueDate) {
    const due = parseISO(p.dueDate);
    if (isValid(due) && isBefore(due, new Date()) && !isSameDay(due, new Date())) {
      return 'late';
    }
  }
  const hasPrinting = (p.prints || []).some(pr => pr.status === 'printing');
  if (hasPrinting) return 'printing-in-progress';
  const hasAnyStarted = (p.prints || []).some(pr => pr.status === 'completed' || pr.completedQuantity > 0);
  if (hasAnyStarted) return 'printing-in-progress';
  return 'printing-scheduled';
}

function isNewProject(orderDate: string): boolean {
  if (!orderDate) return false;
  const d = parseISO(orderDate);
  return isValid(d) && differenceInDays(new Date(), d) <= 2;
}

export default function CalendarPage() {
  const { projects } = useApp();
  const { mode, selectedMonth: globalMonth } = useMonth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const EVENT_CONFIG: EventConfig = {
    'order-created':        { label: t('calendar.orderCreated'),       color: 'hsl(220, 60%, 50%)',  bgClass: 'bg-blue-500/15 border-blue-500/30',      textClass: 'text-blue-700 dark:text-blue-400',    icon: Package },
    'printing-scheduled':   { label: t('calendar.printingScheduled'),  color: 'hsl(25, 90%, 50%)',   bgClass: 'bg-orange-500/15 border-orange-500/30',  textClass: 'text-orange-700 dark:text-orange-400', icon: Printer },
    'printing-in-progress': { label: t('calendar.printing'),           color: 'hsl(45, 90%, 50%)',   bgClass: 'bg-yellow-500/15 border-yellow-500/30',  textClass: 'text-yellow-700 dark:text-yellow-400', icon: Clock },
    'completed':            { label: t('calendar.completed'),          color: 'hsl(142, 60%, 40%)',  bgClass: 'bg-emerald-500/15 border-emerald-500/30', textClass: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
    'late':                 { label: t('calendar.overdue'),            color: 'hsl(0, 72%, 51%)',    bgClass: 'bg-red-500/15 border-red-500/30',        textClass: 'text-red-700 dark:text-red-400',       icon: AlertTriangle },
    'shipping-deadline':    { label: t('calendar.shippingDeadline'),   color: 'hsl(280, 60%, 50%)',  bgClass: 'bg-purple-500/15 border-purple-500/30',  textClass: 'text-purple-700 dark:text-purple-400', icon: Truck },
  };

  const initialDate = useMemo(() => {
    if (mode === 'month') {
      return parseISO(`${globalMonth}-01`);
    }
    return new Date();
  }, [mode, globalMonth]);

  const [currentMonth, setCurrentMonth] = useState(initialDate);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [typeFilter, setTypeFilter] = usePersistedState<EventType | 'all'>('calendar_type_filter', 'all');

  const openProject = (projectId: string) => {
    navigate(`/projects?id=${projectId}`);
  };

  const events = useMemo(() => {
    const result: CalendarEvent[] = [];
    projects.forEach(p => {
      const totalHours = getProjectTotalPrintTime(p);
      const printCount = (p.prints || []).length;
      const isNew = isNewProject(p.orderDate);

      // Order created event
      if (p.orderDate) {
        const d = parseISO(p.orderDate);
        if (isValid(d)) {
          result.push({ id: `${p.id}-order`, projectId: p.id, projectName: p.name, customerName: p.customerName, date: d, type: 'order-created', estimatedHours: totalHours, printCount, isNew });
        }
      }

      // Due date event — type depends on project status
      if (p.dueDate) {
        const d = parseISO(p.dueDate);
        if (isValid(d)) {
          result.push({ id: `${p.id}-due`, projectId: p.id, projectName: p.name, customerName: p.customerName, date: d, type: getDueDateEventType(p), estimatedHours: totalHours, printCount, isNew });
        }
      }

      // Completed event on shippingDate (green marker)
      if (isProjectCompleted(p) && p.shippingDate) {
        const d = parseISO(p.shippingDate);
        if (isValid(d)) {
          result.push({ id: `${p.id}-completed`, projectId: p.id, projectName: p.name, customerName: p.customerName, date: d, type: 'completed', estimatedHours: totalHours, printCount, isNew: false });
        }
      }

      // Shipping deadline
      if (p.shippingDate && !isProjectCompleted(p)) {
        const d = parseISO(p.shippingDate);
        if (isValid(d)) {
          result.push({ id: `${p.id}-ship`, projectId: p.id, projectName: p.name, customerName: p.customerName, date: d, type: 'shipping-deadline', estimatedHours: totalHours, printCount, isNew });
        }
      }
    });
    return result;
  }, [projects]);

  const filteredEvents = typeFilter === 'all' ? events : events.filter(e => e.type === typeFilter);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDay = monthStart.getDay();
  const padStart = (startDay === 0 ? 6 : startDay - 1);
  const padDays = Array.from({ length: padStart }, (_, i) => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - padStart + i);
    return d;
  });

  const allDays = [...padDays, ...days];
  const remaining = 7 - (allDays.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(monthEnd);
      d.setDate(d.getDate() + i);
      allDays.push(d);
    }
  }

  const today = new Date();

  const upcomingEvents = filteredEvents
    .filter(e => isAfter(e.date, today) || isSameDay(e.date, today))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarIcon className="h-6 w-6 text-primary" />
          {t('calendar.title')}
        </h1>
        <div className="text-sm text-muted-foreground">
          {events.length} {events.length !== 1 ? t('calendar.events_other') : t('calendar.events_one')} {t('calendar.projectsFrom')} {projects.length} {projects.length !== 1 ? t('calendar.projectsWord_other') : t('calendar.projectsWord_one')}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={typeFilter === 'all' ? 'default' : 'outline'} onClick={() => setTypeFilter('all')} className="h-7 text-xs">{t('calendar.all')}</Button>
        {(Object.entries(EVENT_CONFIG) as [EventType, typeof EVENT_CONFIG[EventType]][]).map(([type, cfg]) => (
          <Button key={type} size="sm" variant={typeFilter === type ? 'default' : 'outline'} onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)} className="h-7 text-xs gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
            {cfg.label}
          </Button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/30">
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
        <CardContent className="p-3">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {[t('calendar.mon'), t('calendar.tue'), t('calendar.wed'), t('calendar.thu'), t('calendar.fri'), t('calendar.sat'), t('calendar.sun')].map(d => (
              <div key={d} className="text-xs font-semibold text-muted-foreground text-center py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {allDays.map((day, i) => {
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, today);
              const dayEvents = filteredEvents.filter(e => isSameDay(e.date, day));
              return (
                <div key={i} className={`min-h-[90px] p-1.5 rounded-md text-xs transition-all ${
                  isCurrentMonth ? "bg-card hover:bg-accent/20" : "bg-muted/20 opacity-50"
                } ${isToday ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "border border-border/50"}`}>
                  <div className={`font-semibold mb-1 text-[11px] ${
                    isToday ? "text-primary" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {isToday ? (
                      <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 inline-flex items-center justify-center text-[10px]">
                        {format(day, "d")}
                      </span>
                    ) : format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(event => {
                      const cfg = EVENT_CONFIG[event.type];
                      return (
                        <div key={event.id} className={`rounded px-1 py-0.5 truncate cursor-pointer text-[9px] leading-tight border transition-all hover:scale-[1.02] hover:shadow-sm ${cfg.bgClass} ${cfg.textClass} ${event.isNew ? 'ring-1 ring-primary shadow-sm' : ''}`}
                          onClick={() => openProject(event.projectId)}
                          title={`${event.projectName} — ${cfg.label} (click to open)`}>
                          <span className="font-semibold">{event.projectName}</span>
                          {event.estimatedHours > 0 && <span className="ml-0.5 opacity-70">{event.estimatedHours.toFixed(0)}h</span>}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && <div className="text-[9px] text-muted-foreground text-center">+{dayEvents.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedEvent && (
        <Card className={`border-l-4 ${EVENT_CONFIG[selectedEvent.type].bgClass}`} style={{ borderLeftColor: EVENT_CONFIG[selectedEvent.type].color }}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-base">{selectedEvent.projectName}</h3>
                  {selectedEvent.isNew && <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">{t('calendar.newBadge')}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{selectedEvent.customerName}</p>
              </div>
              <Badge variant="outline" className={`${EVENT_CONFIG[selectedEvent.type].bgClass} ${EVENT_CONFIG[selectedEvent.type].textClass}`}>
                {EVENT_CONFIG[selectedEvent.type].label}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
              <div><span className="text-muted-foreground text-xs">{t('calendar.date')}</span><p className="font-medium">{format(selectedEvent.date, "MMM d, yyyy")}</p></div>
              <div><span className="text-muted-foreground text-xs">{t('calendar.estPrintTime')}</span><p className="font-medium">{selectedEvent.estimatedHours.toFixed(1)}h</p></div>
              <div><span className="text-muted-foreground text-xs">{t('calendar.pieces')}</span><p className="font-medium">{selectedEvent.printCount}</p></div>
            </div>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="default" className="text-xs gap-1" onClick={() => openProject(selectedEvent.projectId)}>
                <ExternalLink className="h-3 w-3" />{t('calendar.openProject')}
              </Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSelectedEvent(null)}>{t('calendar.dismiss')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t('calendar.upcomingEvents')}</CardTitle></CardHeader>
        <CardContent>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t('calendar.noUpcomingEvents')}</p>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map(event => {
                const cfg = EVENT_CONFIG[event.type];
                const Icon = cfg.icon;
                const daysAway = differenceInDays(event.date, today);
                return (
                  <div key={event.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent/20 hover:border-primary/40 ${event.isNew ? 'ring-1 ring-primary/30' : ''}`}
                    onClick={() => openProject(event.projectId)}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bgClass}`}>
                        <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{event.projectName}</span>
                          {event.isNew && <Badge className="bg-primary/15 text-primary border-primary/30 text-[9px] px-1.5 py-0">{t('calendar.newBadge')}</Badge>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className={`text-[10px] ${cfg.bgClass} ${cfg.textClass}`}>{cfg.label}</Badge>
                          <span>{event.customerName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{format(event.date, "MMM d")}</p>
                      <p className="text-xs text-muted-foreground">
                        {daysAway === 0 ? t('calendar.today') : daysAway === 1 ? t('calendar.tomorrow') : t('calendar.daysAway', { count: daysAway })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
