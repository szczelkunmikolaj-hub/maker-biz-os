// AppContext — central state, synced to Lovable Cloud
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Project, Expense, AppSettings, KanbanStatus, PrintTemplate, FilamentPurchase, normalizeProject } from '@/types';
import { deriveKanbanStatus, applyKanbanStatus } from '@/types/sync';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface AppContextType {
  projects: Project[];
  expenses: Expense[];
  settings: AppSettings;
  templates: PrintTemplate[];
  filamentPurchases: FilamentPurchase[];
  loading: boolean;
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

const DEFAULT_SETTINGS: AppSettings = {
  filamentCostPerGram: 0.016,
  printerCount: 1,
  bufferMinutes: 15,
  lowLoadThreshold: 24,
  moderateLoadThreshold: 72,
};

const AppContext = createContext<AppContextType | null>(null);

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const [projects, setProjects] = useState<Project[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [filamentPurchases, setFilamentPurchases] = useState<FilamentPurchase[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const migratedRef = useRef(false);

  // Load from cloud on auth
  useEffect(() => {
    if (authLoading) return;
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [pjs, exs, tps, fps, st, profile] = await Promise.all([
        supabase.from('projects').select('data').eq('user_id', userId),
        supabase.from('expenses').select('data').eq('user_id', userId),
        supabase.from('templates').select('data').eq('user_id', userId),
        supabase.from('filament_purchases').select('data').eq('user_id', userId),
        supabase.from('user_settings').select('data').eq('user_id', userId).maybeSingle(),
        supabase.from('profiles').select('migrated_at').eq('user_id', userId).maybeSingle(),
      ]);
      if (cancelled) return;

      let nextProjects = (pjs.data || []).map(r => normalizeProject(r.data as any));
      let nextExpenses = (exs.data || []).map(r => r.data as Expense);
      let nextTemplates = (tps.data || []).map(r => r.data as PrintTemplate);
      let nextFilament = (fps.data || []).map(r => r.data as FilamentPurchase);
      let nextSettings: AppSettings = (st.data?.data as AppSettings) || DEFAULT_SETTINGS;

      // One-time localStorage migration
      const alreadyMigrated = profile.data?.migrated_at != null;
      if (!alreadyMigrated && !migratedRef.current) {
        migratedRef.current = true;
        const lsProjects = (loadJSON<any[]>('pt_projects', []) || []).map(normalizeProject);
        const lsExpenses = loadJSON<Expense[]>('pt_expenses', []);
        const lsTemplates = loadJSON<PrintTemplate[]>('pt_templates', []);
        const lsFilament = loadJSON<FilamentPurchase[]>('pt_filament_purchases', []);
        const lsSettings = loadJSON<AppSettings | null>('pt_settings', null);
        const hasLocal = lsProjects.length || lsExpenses.length || lsTemplates.length || lsFilament.length || lsSettings;
        if (hasLocal) {
          if (lsProjects.length) await supabase.from('projects').upsert(lsProjects.map(p => ({ id: p.id, user_id: userId, data: p as any })));
          if (lsExpenses.length) await supabase.from('expenses').upsert(lsExpenses.map(e => ({ id: e.id, user_id: userId, data: e as any })));
          if (lsTemplates.length) await supabase.from('templates').upsert(lsTemplates.map(t => ({ id: t.id, user_id: userId, data: t as any })));
          if (lsFilament.length) await supabase.from('filament_purchases').upsert(lsFilament.map(f => ({ id: f.id, user_id: userId, data: f as any })));
          if (lsSettings) await supabase.from('user_settings').upsert({ user_id: userId, data: lsSettings as any });
          nextProjects = lsProjects.length ? lsProjects : nextProjects;
          nextExpenses = lsExpenses.length ? lsExpenses : nextExpenses;
          nextTemplates = lsTemplates.length ? lsTemplates : nextTemplates;
          nextFilament = lsFilament.length ? lsFilament : nextFilament;
          if (lsSettings) nextSettings = lsSettings;
        }
        await supabase.from('profiles').update({ migrated_at: new Date().toISOString() }).eq('user_id', userId);
      }

      setProjects(nextProjects);
      setExpenses(nextExpenses);
      setTemplates(nextTemplates);
      setFilamentPurchases(nextFilament);
      setSettings(nextSettings);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, authLoading]);

  // ---- helpers
  const up = (table: 'projects'|'expenses'|'templates'|'filament_purchases', id: string, data: any) => {
    if (!userId) return;
    supabase.from(table).upsert({ id, user_id: userId, data }).then(({ error }) => {
      if (error) console.error(`[sync] ${table} upsert`, error);
    });
  };
  const del = (table: 'projects'|'expenses'|'templates'|'filament_purchases', id: string) => {
    if (!userId) return;
    supabase.from(table).delete().eq('id', id).then(({ error }) => {
      if (error) console.error(`[sync] ${table} delete`, error);
    });
  };

  const addProject = useCallback((p: Project) => {
    const n = normalizeProject(p);
    setProjects(prev => [n, ...prev]);
    up('projects', n.id, n);
  }, [userId]);

  const updateProject = useCallback((p: Project) => {
    const normalized = normalizeProject(p);
    if (normalized.printed) {
      normalized.prints = normalized.prints.map(pr => ({ ...pr, completedQuantity: pr.quantity, status: 'completed' as const }));
    }
    normalized.kanbanStatus = deriveKanbanStatus(normalized);
    const allPrintsComplete = normalized.prints.length > 0 && normalized.prints.every(pr => (pr.completedQuantity || 0) >= (pr.quantity || 1));
    if (!normalized.completedAt && (normalized.printed || normalized.sent || allPrintsComplete)) normalized.completedAt = new Date().toISOString();
    if (!normalized.paidAt && normalized.paid) normalized.paidAt = new Date().toISOString();
    setProjects(prev => prev.map(x => x.id === normalized.id ? normalized : x));
    up('projects', normalized.id, normalized);
  }, [userId]);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(x => x.id !== id));
    del('projects', id);
  }, [userId]);

  const moveProject = useCallback((id: string, status: KanbanStatus) => {
    setProjects(prev => {
      const next = prev.map(x => x.id === id ? { ...x, ...applyKanbanStatus(status, x) } : x);
      const updated = next.find(x => x.id === id);
      if (updated) up('projects', id, updated);
      return next;
    });
  }, [userId]);

  const duplicateProject = useCallback((id: string) => {
    setProjects(prev => {
      const original = prev.find(x => x.id === id);
      if (!original) return prev;
      const baseName = (original.name || '').replace(/\s*\(Copy\)\s*$/i, '').replace(/\s+\d+$/, '').trim();
      const usedNumbers = new Set<number>();
      prev.forEach(p => {
        const n = (p.name || '').trim();
        if (n === baseName) usedNumbers.add(0);
        const m = n.match(/^(.*)\s+(\d+)$/);
        if (m && m[1].trim() === baseName) usedNumbers.add(parseInt(m[2], 10));
      });
      let next = 1; while (usedNumbers.has(next)) next++;
      const today = new Date().toISOString().slice(0, 10);
      const dup: Project = {
        ...original, id: crypto.randomUUID(), name: `${baseName} ${next}`,
        orderDate: today, dueDate: '', shippingDate: '', completedAt: '', paidAt: '',
        printed: false, paid: false, sent: false, kanbanStatus: 'new-order',
        prints: (original.prints || []).map(pr => ({ ...pr, id: crypto.randomUUID(), status: 'not-printed' as const, completedQuantity: 0 })),
        projectExpenses: (original.projectExpenses || []).map(e => ({ ...e, id: crypto.randomUUID() })),
      };
      up('projects', dup.id, dup);
      return [dup, ...prev];
    });
  }, [userId]);

  const addExpense = useCallback((e: Expense) => { setExpenses(prev => [e, ...prev]); up('expenses', e.id, e); }, [userId]);
  const updateExpense = useCallback((e: Expense) => { setExpenses(prev => prev.map(x => x.id === e.id ? e : x)); up('expenses', e.id, e); }, [userId]);
  const deleteExpense = useCallback((id: string) => { setExpenses(prev => prev.filter(x => x.id !== id)); del('expenses', id); }, [userId]);

  const updateSettings = useCallback((s: AppSettings) => {
    setSettings(s);
    if (userId) supabase.from('user_settings').upsert({ user_id: userId, data: s as any }).then(({ error }) => error && console.error(error));
  }, [userId]);

  const addTemplate = useCallback((t: PrintTemplate) => { setTemplates(prev => [t, ...prev]); up('templates', t.id, t); }, [userId]);
  const deleteTemplate = useCallback((id: string) => { setTemplates(prev => prev.filter(x => x.id !== id)); del('templates', id); }, [userId]);

  const addFilamentPurchase = useCallback((fp: FilamentPurchase) => { setFilamentPurchases(prev => [fp, ...prev]); up('filament_purchases', fp.id, fp); }, [userId]);
  const updateFilamentPurchase = useCallback((fp: FilamentPurchase) => { setFilamentPurchases(prev => prev.map(x => x.id === fp.id ? fp : x)); up('filament_purchases', fp.id, fp); }, [userId]);
  const deleteFilamentPurchase = useCallback((id: string) => { setFilamentPurchases(prev => prev.filter(x => x.id !== id)); del('filament_purchases', id); }, [userId]);

  const totalFilamentPurchasesCost = React.useMemo(() =>
    filamentPurchases.reduce((s, fp) => s + (fp.totalCost || 0), 0),
    [filamentPurchases]
  );

  const replaceAllData = useCallback(async (data: { projects: Project[]; expenses: Expense[]; templates: PrintTemplate[]; filamentPurchases: FilamentPurchase[]; settings: AppSettings }) => {
    setProjects(data.projects);
    setExpenses(data.expenses);
    setTemplates(data.templates);
    setFilamentPurchases(data.filamentPurchases);
    setSettings(data.settings);
    if (!userId) return;
    await Promise.all([
      supabase.from('projects').delete().eq('user_id', userId),
      supabase.from('expenses').delete().eq('user_id', userId),
      supabase.from('templates').delete().eq('user_id', userId),
      supabase.from('filament_purchases').delete().eq('user_id', userId),
    ]);
    if (data.projects.length) await supabase.from('projects').upsert(data.projects.map(p => ({ id: p.id, user_id: userId, data: p as any })));
    if (data.expenses.length) await supabase.from('expenses').upsert(data.expenses.map(e => ({ id: e.id, user_id: userId, data: e as any })));
    if (data.templates.length) await supabase.from('templates').upsert(data.templates.map(t => ({ id: t.id, user_id: userId, data: t as any })));
    if (data.filamentPurchases.length) await supabase.from('filament_purchases').upsert(data.filamentPurchases.map(f => ({ id: f.id, user_id: userId, data: f as any })));
    await supabase.from('user_settings').upsert({ user_id: userId, data: data.settings as any });
  }, [userId]);

  const allPrintNames = React.useMemo(() => {
    const names = new Set<string>();
    projects.forEach(p => (p.prints || []).forEach(pr => { if (pr.name) names.add(pr.name); }));
    templates.forEach(t => { if (t.name) names.add(t.name); });
    return Array.from(names).sort();
  }, [projects, templates]);

  return (
    <AppContext.Provider value={{
      projects, expenses, settings, templates, filamentPurchases, loading,
      addProject, updateProject, deleteProject, duplicateProject, moveProject,
      addExpense, updateExpense, deleteExpense, updateSettings,
      addTemplate, deleteTemplate,
      addFilamentPurchase, updateFilamentPurchase, deleteFilamentPurchase,
      totalFilamentPurchasesCost, allPrintNames, replaceAllData,
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
