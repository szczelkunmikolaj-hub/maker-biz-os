import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Project, Expense, AppSettings, KanbanStatus, PrintTemplate, FilamentPurchase, normalizeProject } from '@/types';
import { deriveKanbanStatus, applyKanbanStatus } from '@/types/sync';

interface AppContextType {
  projects: Project[];
  expenses: Expense[];
  settings: AppSettings;
  templates: PrintTemplate[];
  filamentPurchases: FilamentPurchase[];
  addProject: (p: Project) => void;
  updateProject: (p: Project) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  addExpense: (e: Expense) => void;
  updateExpense: (e: Expense) => void;
  deleteExpense: (id: string) => void;
  updateSettings: (s: AppSettings) => void;
  moveProject: (id: string, status: KanbanStatus) => void;
  addTemplate: (t: PrintTemplate) => void;
  deleteTemplate: (id: string) => void;
  addFilamentPurchase: (fp: FilamentPurchase) => void;
  updateFilamentPurchase: (fp: FilamentPurchase) => void;
  deleteFilamentPurchase: (id: string) => void;
  totalFilamentPurchasesCost: number;
  allPrintNames: string[];
  replaceAllData: (data: { projects: Project[]; expenses: Expense[]; templates: PrintTemplate[]; filamentPurchases: FilamentPurchase[]; settings: AppSettings }) => void;
}

const AppContext = createContext<AppContextType | null>(null);

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() =>
    (loadJSON<any[]>('pt_projects', []) as any[]).map(normalizeProject)
  );
  const [expenses, setExpenses] = useState<Expense[]>(() => loadJSON('pt_expenses', []));
  const [templates, setTemplates] = useState<PrintTemplate[]>(() => loadJSON('pt_templates', []));
  const [filamentPurchases, setFilamentPurchases] = useState<FilamentPurchase[]>(() => loadJSON('pt_filament_purchases', []));
  const [settings, setSettings] = useState<AppSettings>(() => loadJSON('pt_settings', {
    filamentCostPerGram: 0.016,
    printerCount: 1,
    bufferMinutes: 15,
    lowLoadThreshold: 24,
    moderateLoadThreshold: 72,
  }));

  useEffect(() => { localStorage.setItem('pt_projects', JSON.stringify(projects)); }, [projects]);
  useEffect(() => { localStorage.setItem('pt_expenses', JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem('pt_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('pt_templates', JSON.stringify(templates)); }, [templates]);
  useEffect(() => { localStorage.setItem('pt_filament_purchases', JSON.stringify(filamentPurchases)); }, [filamentPurchases]);

  const addProject = useCallback((p: Project) => setProjects(prev => [normalizeProject(p), ...prev]), []);
  const updateProject = useCallback((p: Project) => {
    const normalized = normalizeProject(p);
    normalized.kanbanStatus = deriveKanbanStatus(normalized);
    setProjects(prev => prev.map(x => x.id === normalized.id ? normalized : x));
  }, []);
  const deleteProject = useCallback((id: string) => setProjects(prev => prev.filter(x => x.id !== id)), []);
  const moveProject = useCallback((id: string, status: KanbanStatus) => {
    setProjects(prev => prev.map(x => x.id === id ? { ...x, ...applyKanbanStatus(status) } : x));
  }, []);
  const duplicateProject = useCallback((id: string) => {
    setProjects(prev => {
      const original = prev.find(x => x.id === id);
      if (!original) return prev;
      const dup: Project = {
        ...original,
        id: crypto.randomUUID(),
        name: `${original.name} (Copy)`,
        printed: false, paid: false, sent: false,
        kanbanStatus: 'new-order',
        prints: (original.prints || []).map(pr => ({ ...pr, id: crypto.randomUUID(), status: 'not-printed' as const, completedQuantity: 0 })),
        projectExpenses: (original.projectExpenses || []).map(e => ({ ...e, id: crypto.randomUUID() })),
      };
      return [dup, ...prev];
    });
  }, []);

  const addExpense = useCallback((e: Expense) => setExpenses(prev => [e, ...prev]), []);
  const updateExpense = useCallback((e: Expense) => setExpenses(prev => prev.map(x => x.id === e.id ? e : x)), []);
  const deleteExpense = useCallback((id: string) => setExpenses(prev => prev.filter(x => x.id !== id)), []);
  const updateSettings = useCallback((s: AppSettings) => setSettings(s), []);

  const addTemplate = useCallback((t: PrintTemplate) => setTemplates(prev => [t, ...prev]), []);
  const deleteTemplate = useCallback((id: string) => setTemplates(prev => prev.filter(x => x.id !== id)), []);

  // Filament purchases
  const addFilamentPurchase = useCallback((fp: FilamentPurchase) => setFilamentPurchases(prev => [fp, ...prev]), []);
  const updateFilamentPurchase = useCallback((fp: FilamentPurchase) => setFilamentPurchases(prev => prev.map(x => x.id === fp.id ? fp : x)), []);
  const deleteFilamentPurchase = useCallback((id: string) => setFilamentPurchases(prev => prev.filter(x => x.id !== id)), []);

  const totalFilamentPurchasesCost = React.useMemo(() =>
    filamentPurchases.reduce((s, fp) => s + (fp.totalCost || 0), 0),
    [filamentPurchases]
  );

  const allPrintNames = React.useMemo(() => {
    const names = new Set<string>();
    projects.forEach(p => (p.prints || []).forEach(pr => { if (pr.name) names.add(pr.name); }));
    templates.forEach(t => { if (t.name) names.add(t.name); });
    return Array.from(names).sort();
  }, [projects, templates]);

  return (
    <AppContext.Provider value={{
      projects, expenses, settings, templates, filamentPurchases,
      addProject, updateProject, deleteProject, duplicateProject, moveProject,
      addExpense, updateExpense, deleteExpense, updateSettings,
      addTemplate, deleteTemplate,
      addFilamentPurchase, updateFilamentPurchase, deleteFilamentPurchase,
      totalFilamentPurchasesCost, allPrintNames,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
