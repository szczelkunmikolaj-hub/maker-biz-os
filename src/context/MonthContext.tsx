import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, isValid, addMonths, subMonths } from 'date-fns';
import { Project, Expense, getEffectiveDate } from '@/types';

export type GlobalTimeMode = 'month' | 'all';

function isProjectActive(p: Project): boolean {
  return !p.printed || !p.paid || !p.sent || p.kanbanStatus !== 'shipped';
}

interface MonthContextType {
  mode: GlobalTimeMode;
  setMode: (m: GlobalTimeMode) => void;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  prevMonth: () => void;
  nextMonth: () => void;
  label: string;
  isInPeriod: (dateStr: string | null) => boolean;
  /** Analytics filter: strictly by effective date */
  filterProjects: (projects: Project[]) => Project[];
  /** Workflow filter: active always shown, completed filtered by month */
  filterProjectsForWorkflow: (projects: Project[]) => Project[];
  filterExpenses: (expenses: Expense[]) => Expense[];
  interval: { start: Date; end: Date } | null;
}

const MonthContext = createContext<MonthContextType | null>(null);

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = usePersistedState<GlobalTimeMode>('global_time_mode', 'all');
  const [selectedMonth, setSelectedMonth] = usePersistedState('global_selected_month', format(new Date(), 'yyyy-MM'));

  const prevMonth = useCallback(() => {
    setSelectedMonth(prev => format(subMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'));
  }, [setSelectedMonth]);

  const nextMonth = useCallback(() => {
    setSelectedMonth(prev => format(addMonths(parseISO(`${prev}-01`), 1), 'yyyy-MM'));
  }, [setSelectedMonth]);

  const interval = useMemo(() => {
    if (mode === 'all') return null;
    const d = parseISO(`${selectedMonth}-01`);
    return { start: startOfMonth(d), end: endOfMonth(d) };
  }, [mode, selectedMonth]);

  const label = useMemo(() => {
    if (mode === 'all') return 'All Time';
    return format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy');
  }, [mode, selectedMonth]);

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

  /** Workflow: active projects always visible; completed ones filtered by month */
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

  return (
    <MonthContext.Provider value={{
      mode, setMode, selectedMonth, setSelectedMonth,
      prevMonth, nextMonth, label, isInPeriod,
      filterProjects, filterExpenses, interval,
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
