import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import {
  format, parseISO, isValid, isWithinInterval,
  startOfWeek, endOfWeek, addWeeks,
  startOfMonth, endOfMonth, addMonths,
  startOfYear, endOfYear, addYears,
} from 'date-fns';
import { Project, Expense, FilamentPurchase, getEffectiveDate } from '@/types';

export type PeriodOption = 'this-week' | 'this-month' | 'last-3-months' | 'this-year' | 'all-time';
export type ChartGrouping = 'day' | 'week' | 'month' | 'year';

function isProjectActive(p: Project): boolean {
  return !p.printed || !p.paid || !p.sent || p.kanbanStatus !== 'shipped';
}

interface MonthContextType {
  period: PeriodOption;
  setPeriod: (p: PeriodOption) => void;
  offset: number;
  prevPeriod: () => void;
  nextPeriod: () => void;
  label: string;
  autoGrouping: ChartGrouping;
  isInPeriod: (dateStr: string | null) => boolean;
  filterProjects: (projects: Project[]) => Project[];
  filterProjectsForWorkflow: (projects: Project[]) => Project[];
  filterExpenses: (expenses: Expense[]) => Expense[];
  filterFilamentPurchases: (fps: FilamentPurchase[]) => FilamentPurchase[];
  interval: { start: Date; end: Date } | null;
  /** 'yyyy-MM' string for CalendarPage to sync to the right month */
  calendarMonth: string;
  /** Backward compat: 'all' when period === 'all-time', else 'month' */
  mode: 'month' | 'all';
}

const MonthContext = createContext<MonthContextType | null>(null);

function computeInterval(period: PeriodOption, offset: number): { start: Date; end: Date } | null {
  const now = new Date();
  if (period === 'all-time') return null;
  if (period === 'this-week') {
    const base = addWeeks(now, offset);
    return { start: startOfWeek(base, { weekStartsOn: 1 }), end: endOfWeek(base, { weekStartsOn: 1 }) };
  }
  if (period === 'this-month') {
    const base = addMonths(now, offset);
    return { start: startOfMonth(base), end: endOfMonth(base) };
  }
  if (period === 'last-3-months') {
    // Each step shifts a full 3-month window; offset 0 = current 3 months
    const endMonth = addMonths(startOfMonth(now), offset * 3);
    const end = endOfMonth(endMonth);
    const start = startOfMonth(addMonths(endMonth, -2));
    return { start, end };
  }
  if (period === 'this-year') {
    const base = addYears(now, offset);
    return { start: startOfYear(base), end: endOfYear(base) };
  }
  return null;
}

function computeLabel(period: PeriodOption, offset: number, interval: { start: Date; end: Date } | null): string {
  if (period === 'all-time') return 'All Time';
  if (!interval) return '';
  if (period === 'this-week') {
    const prefix = offset === 0 ? 'This week · ' : offset === -1 ? 'Last week · ' : '';
    return `${prefix}${format(interval.start, 'MMM d')}–${format(interval.end, 'MMM d')}`;
  }
  if (period === 'this-month') return format(interval.start, 'MMMM yyyy');
  if (period === 'last-3-months') {
    const startLabel = format(interval.start, 'MMM');
    const endLabel = format(interval.end, 'MMM yyyy');
    return `${startLabel}–${endLabel}`;
  }
  if (period === 'this-year') return format(interval.start, 'yyyy');
  return '';
}

function computeCalendarMonth(period: PeriodOption, offset: number, interval: { start: Date; end: Date } | null): string {
  const now = new Date();
  if (!interval) return format(now, 'yyyy-MM');
  if (period === 'this-month') return format(interval.start, 'yyyy-MM');
  if (period === 'this-week') return format(interval.start, 'yyyy-MM');
  if (period === 'last-3-months') return format(interval.end, 'yyyy-MM');
  if (period === 'this-year') {
    return offset === 0 ? format(now, 'yyyy-MM') : format(interval.end, 'yyyy-MM');
  }
  return format(now, 'yyyy-MM');
}

function computeAutoGrouping(period: PeriodOption): ChartGrouping {
  if (period === 'this-week') return 'day';
  if (period === 'this-month') return 'day';
  if (period === 'last-3-months') return 'week';
  return 'month'; // this-year + all-time
}

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const [period, setPeriodRaw] = usePersistedState<PeriodOption>('global_period', 'this-month');
  const [offset, setOffset] = usePersistedState<number>('global_period_offset', 0);

  const setPeriod = useCallback((p: PeriodOption) => {
    setPeriodRaw(p);
    setOffset(0);
  }, [setPeriodRaw, setOffset]);

  const prevPeriod = useCallback(() => setOffset((o: number) => o - 1), [setOffset]);
  const nextPeriod = useCallback(() => setOffset((o: number) => o + 1), [setOffset]);

  const interval = useMemo(() => computeInterval(period, offset), [period, offset]);
  const label = useMemo(() => computeLabel(period, offset, interval), [period, offset, interval]);
  const calendarMonth = useMemo(() => computeCalendarMonth(period, offset, interval), [period, offset, interval]);
  const autoGrouping = useMemo(() => computeAutoGrouping(period), [period]);
  const mode = period === 'all-time' ? 'all' as const : 'month' as const;

  const isInPeriod = useCallback((dateStr: string | null): boolean => {
    if (!dateStr) return false;
    if (!interval) return true;
    try {
      const d = parseISO(dateStr);
      return isValid(d) && isWithinInterval(d, interval);
    } catch { return false; }
  }, [interval]);

  const filterProjects = useCallback((projects: Project[]): Project[] => {
    if (!interval) return projects;
    return projects.filter(p => {
      const ed = getEffectiveDate(p);
      return ed ? isInPeriod(ed) : false;
    });
  }, [interval, isInPeriod]);

  const filterProjectsForWorkflow = useCallback((projects: Project[]): Project[] => {
    if (!interval) return projects;
    return projects.filter(p => {
      if (isProjectActive(p)) return true;
      const ed = getEffectiveDate(p);
      return ed ? isInPeriod(ed) : true;
    });
  }, [interval, isInPeriod]);

  const filterExpenses = useCallback((expenses: Expense[]): Expense[] => {
    if (!interval) return expenses;
    return expenses.filter(e => isInPeriod(e.date));
  }, [interval, isInPeriod]);

  const filterFilamentPurchases = useCallback((fps: FilamentPurchase[]): FilamentPurchase[] => {
    if (!interval) return fps;
    return fps.filter(fp => isInPeriod(fp.purchaseDate));
  }, [interval, isInPeriod]);

  return (
    <MonthContext.Provider value={{
      period, setPeriod, offset, prevPeriod, nextPeriod,
      label, autoGrouping, isInPeriod,
      filterProjects, filterProjectsForWorkflow, filterExpenses, filterFilamentPurchases,
      interval, calendarMonth, mode,
    }}>
      {children}
    </MonthContext.Provider>
  );
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error('useMonth must be used within MonthProvider');
  return ctx;
}
