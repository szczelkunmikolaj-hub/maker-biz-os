import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useMonth } from "@/context/MonthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, LayoutGrid, AlignLeft } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isValid, isBefore, startOfWeek, endOfWeek, addWeeks, subWeeks, isAfter } from "date-fns";

type EventType = 'order' | 'due' | 'delivered';
type CalView = 'month' | 'week';

interface CalEvent {
  id: string;
  projectId: string;
  name: string;
  customer: string;
  date: Date;
  type: EventType;
  overdue?: boolean;
}

const TYPE_META: Record<EventType, { label: string; dot: string; bg: string; text: string; border: string }> = {
  order:     { label: 'Order date',  dot: 'bg-[hsl(210,70%,50%)]',  bg: 'bg-[hsl(210,70%,50%/0.12)]',  text: 'text-[hsl(210,70%,38%)]',  border: 'border-[hsl(210,70%,50%/0.25)]' },
  due:       { label: 'Due date',    dot: 'bg-[hsl(38,85%,46%)]',   bg: 'bg-[hsl(38,85%,46%/0.12)]',   text: 'text-[hsl(38,85%,34%)]',   border: 'border-[hsl(38,85%,46%/0.25)]' },
  delivered: { label: 'Delivered',   dot: 'bg-[hsl(142,40%,38%)]',  bg: 'bg-[hsl(142,40%,38%/0.12)]',  text: 'text-[hsl(142,40%,30%)]',  border: 'border-[hsl(142,40%,38%/0.25)]' },
};
const OVERDUE = { bg: 'bg-[hsl(0,68%,50%/0.12)]', text: 'text-[hsl(0,68%,42%)]', border: 'border-[hsl(0,68%,50%/0.25)]', dot: 'bg-[hsl(0,68%,50%)]' };

export default function CalendarPage() {
  const { projects } = useApp();
  const { calendarMonth } = useMonth();
  const navigate = useNavigate();

  const initialDate = useMemo(() => parseISO(`${calendarMonth}-01`), [calendarMonth]);
  const [current, setCurrent] = useState(initialDate);
  const [view, setView] = useState<CalView>('month');
  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>('all');

  const openProject = (id: string) => navigate(`/projects?id=${id}`, { state: { from: '/calendar' } });

  const events = useMemo((): CalEvent[] => {
    const out: CalEvent[] = [];
    const today = new Date();
    projects.forEach(p => {
      if (p.orderDate) {
        const d = parseISO(p.orderDate);
        if (isValid(d)) out.push({ id: `${p.id}-order`, projectId: p.id, name: p.name, customer: p.customerName, date: d, type: 'order' });
      }
      if (p.dueDate) {
        const d = parseISO(p.dueDate);
        if (isValid(d)) out.push({ id: `${p.id}-due`, projectId: p.id, name: p.name, customer: p.customerName, date: d, type: 'due', overdue: isBefore(d, today) && !isSameDay(d, today) });
      }
      const deliveredDate = p.shippingDate || (p.sent ? p.orderDate : null);
      if (deliveredDate && (p.sent || p.paid)) {
        const d = parseISO(deliveredDate);
        if (isValid(d)) out.push({ id: `${p.id}-delivered`, projectId: p.id, name: p.name, customer: p.customerName, date: d, type: 'delivered' });
      }
    });
    return out;
  }, [projects]);

  const visibleEvents = typeFilter === 'all' ? events : events.filter(e => e.type === typeFilter);

  const today = new Date();

  // Month view: full month grid
  const monthDays = useMemo(() => {
    const start = startOfMonth(current);
    const end = endOfMonth(current);
    const days = eachDayOfInterval({ start, end });
    const pad = start.getDay() === 0 ? 6 : start.getDay() - 1;
    const before: Date[] = Array.from({ length: pad }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() - pad + i); return d;
    });
    const combined = [...before, ...days];
    const rem = 7 - (combined.length % 7);
    const after: Date[] = rem < 7 ? Array.from({ length: rem }, (_, i) => {
      const d = new Date(end); d.setDate(d.getDate() + i + 1); return d;
    }) : [];
    return [...combined, ...after];
  }, [current]);

  // Week view: 7 days starting Monday
  const weekDays = useMemo(() => {
    const start = startOfWeek(current, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end: endOfWeek(current, { weekStartsOn: 1 }) });
  }, [current]);

  const EventChip = ({ event, compact = true }: { event: CalEvent; compact?: boolean }) => {
    const meta = TYPE_META[event.type];
    const isOver = event.overdue;
    const bg = isOver ? OVERDUE.bg : meta.bg;
    const text = isOver ? OVERDUE.text : meta.text;
    const border = isOver ? OVERDUE.border : meta.border;
    return (
      <div
        className={`rounded px-1.5 py-0.5 border cursor-pointer hover:opacity-80 transition-opacity ${bg} ${text} ${border} ${compact ? 'truncate' : ''}`}
        onClick={() => openProject(event.projectId)}
        title={`${event.name} — ${meta.label}${isOver ? ' (overdue)' : ''}`}
      >
        <span className="text-xs font-medium leading-tight">{event.name}</span>
        {!compact && <span className="text-[11px] opacity-70 ml-1">{event.customer}</span>}
      </div>
    );
  };

  const DayCell = ({ day, inMonth }: { day: Date; inMonth: boolean }) => {
    const isToday = isSameDay(day, today);
    const dayEvents = visibleEvents.filter(e => isSameDay(e.date, day));
    return (
      <div className={`min-h-[70px] p-1 rounded-md transition-colors ${inMonth ? 'bg-card' : 'bg-muted/20 opacity-50'} ${isToday ? 'ring-2 ring-primary ring-offset-1' : 'border border-border/50'}`}>
        <div className={`text-[11px] font-semibold mb-1 ${isToday ? 'text-primary' : 'text-foreground'}`}>
          {isToday
            ? <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 inline-flex items-center justify-center text-[10px]">{format(day, 'd')}</span>
            : format(day, 'd')}
        </div>
        <div className="space-y-0.5">
          {dayEvents.slice(0, 3).map(e => <EventChip key={e.id} event={e} />)}
          {dayEvents.length > 3 && <div className="text-[10px] text-muted-foreground text-center">+{dayEvents.length - 3}</div>}
        </div>
      </div>
    );
  };

  const prev = () => view === 'month' ? setCurrent(d => subMonths(d, 1)) : setCurrent(d => subWeeks(d, 1));
  const next = () => view === 'month' ? setCurrent(d => addMonths(d, 1)) : setCurrent(d => addWeeks(d, 1));

  const periodLabel = view === 'month'
    ? format(current, 'MMMM yyyy')
    : `${format(weekDays[0], 'MMM d')} – ${format(weekDays[6], 'MMM d, yyyy')}`;

  const upcomingEvents = useMemo(() =>
    visibleEvents.filter(e => isAfter(e.date, today) || isSameDay(e.date, today))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 10),
    [visibleEvents, today]
  );

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="hidden sm:flex rounded-md border border-border overflow-hidden">
            <button className={`px-2.5 py-1.5 transition-colors ${view === 'month' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`} onClick={() => setView('month')} title="Month view">
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button className={`px-2.5 py-1.5 transition-colors border-l border-border ${view === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`} onClick={() => setView('week')} title="Week view">
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Legend + type filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${typeFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted text-muted-foreground'}`}
          onClick={() => setTypeFilter('all')}
        >All</button>
        {(Object.entries(TYPE_META) as [EventType, typeof TYPE_META[EventType]][]).map(([type, meta]) => (
          <button
            key={type}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${typeFilter === type ? `${meta.bg} ${meta.text} ${meta.border}` : 'border-border hover:bg-muted text-muted-foreground'}`}
            onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
          >
            <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
            {meta.label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 text-muted-foreground">
          <div className={`w-2 h-2 rounded-full ${OVERDUE.dot}`} />
          Overdue
        </div>
      </div>

      {/* Calendar grid — hidden on mobile, shown on sm+ */}
      <Card className="hidden sm:block overflow-hidden">
        <CardHeader className="pb-2 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
            <CardTitle className="text-base">{periodLabel}</CardTitle>
            <Button variant="ghost" size="icon" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-[11px] font-semibold text-muted-foreground text-center py-1.5">{d}</div>
            ))}
          </div>
          {view === 'month' ? (
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((day, i) => (
                <DayCell key={i} day={day} inMonth={isSameMonth(day, current)} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day, i) => {
                const dayEvents = visibleEvents.filter(e => isSameDay(e.date, day));
                const isToday = isSameDay(day, today);
                return (
                  <div key={i} className={`p-1.5 rounded-md min-h-[120px] ${isToday ? 'ring-2 ring-primary ring-offset-1 bg-card' : 'border border-border/50 bg-card'}`}>
                    <div className={`text-[11px] font-semibold mb-2 ${isToday ? 'text-primary' : ''}`}>
                      {isToday
                        ? <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 inline-flex items-center justify-center text-[10px]">{format(day, 'd')}</span>
                        : format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.map(e => <EventChip key={e.id} event={e} compact={false} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agenda view — always shown on mobile (sm:hidden), hidden on desktop */}
      <Card className="sm:hidden">
        <CardHeader className="pb-2 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
            <CardTitle className="text-base">{format(current, 'MMMM yyyy')}</CardTitle>
            <Button variant="ghost" size="icon" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No upcoming events</p>
          ) : (
            upcomingEvents.map(event => {
              const meta = TYPE_META[event.type];
              const isOver = event.overdue;
              const bg = isOver ? OVERDUE.bg : meta.bg;
              const text = isOver ? OVERDUE.text : meta.text;
              const dot = isOver ? OVERDUE.dot : meta.dot;
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => openProject(event.projectId)}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{event.name}</p>
                    <p className="text-xs text-muted-foreground">{event.customer}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-medium ${text}`}>{meta.label}</p>
                    <p className="text-[11px] text-muted-foreground">{format(event.date, 'MMM d')}</p>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Upcoming events list (desktop) */}
      <Card className="hidden sm:block">
        <CardHeader className="pb-2"><CardTitle className="text-base">Upcoming events</CardTitle></CardHeader>
        <CardContent className="p-0">
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No upcoming events</p>
          ) : (
            upcomingEvents.map(event => {
              const meta = TYPE_META[event.type];
              const isOver = event.overdue;
              const text = isOver ? OVERDUE.text : meta.text;
              const dot = isOver ? OVERDUE.dot : meta.dot;
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => openProject(event.projectId)}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{event.name}</p>
                    <p className="text-xs text-muted-foreground">{event.customer}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-medium ${text}`}>{meta.label}{isOver ? ' · Overdue' : ''}</p>
                    <p className="text-[11px] text-muted-foreground">{format(event.date, 'MMM d, yyyy')}</p>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
