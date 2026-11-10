// AppContext — central state, synced to Supabase
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Project, Expense, AppSettings, KanbanStatus, ProductionStage, PrintTemplate, FilamentPurchase, Payment, TimelineEvent, normalizeProject, normalizeStage, getProjectPiecesTotal, STAGE_META } from '@/types';
import { deriveKanbanStatus, applyKanbanStatus } from '@/types/sync';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useDemo } from '@/context/DemoContext';
import i18n from '@/i18n';
import { DEMO_PROJECTS, DEMO_EXPENSES, DEMO_FILAMENT, DEMO_FILAMENT_COST } from '@/lib/demoData';
import { isAdmin } from '@/lib/admin';
import { NOTIFICATIONS_ENABLED } from '@/config/features';
import { toast } from 'sonner';
import { cacheJSON, cacheProjects, getCacheOwner, setCacheOwner, clearDataCache } from '@/lib/localCache';

/** One visible, de-duplicated warning whenever something could not be saved to the cloud. */
function notifySaveFailed(what: string) {
  toast.error(`Could not save ${what} to the cloud`, {
    id: 'sync-save-failed',
    description: 'Your change is only on this screen right now. Check your connection and try again before closing or reloading this tab.',
    duration: 15000,
  });
}

/** PostgREST error code for "this table does not exist in the database". */
const isMissingTable = (error: any) => error?.code === 'PGRST205' || /schema cache/i.test(error?.message || '');

/** Run a Supabase request, retrying twice on failure (timeouts and dropped connections happen). */
async function withRetry<T extends { error: any }>(run: () => PromiseLike<T>): Promise<T> {
  let last: T | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      last = await run();
      if (!last.error || isMissingTable(last.error)) return last;
    } catch (err) {
      last = { error: { message: err instanceof Error ? err.message : String(err) } } as T;
    }
    await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
  }
  return last as T;
}

/**
 * Load all of a user's rows from one table in small pages. Projects carry embedded preview
 * images, so one big "select everything" request can be several MB and time out.
 */
async function loadRowsPaged(table: 'projects' | 'expenses' | 'templates' | 'filament_purchases', userId: string, pageSize = 8): Promise<{ data: { data: any }[] | null; error: any }> {
  const ids = await withRetry(() => (supabase as any).from(table).select('id').eq('user_id', userId));
  if (ids.error) return { data: null, error: ids.error };
  const allIds: string[] = (ids.data || []).map((r: any) => r.id);
  const rows: { data: any }[] = [];
  for (let i = 0; i < allIds.length; i += pageSize) {
    const page = await withRetry(() => (supabase as any).from(table).select('data').eq('user_id', userId).in('id', allIds.slice(i, i + pageSize)));
    if (page.error) return { data: null, error: page.error };
    rows.push(...(page.data || []));
  }
  return { data: rows, error: null };
}

/** Split rows into small batches so one big request cannot fail the whole upload. */
function chunkRows<T>(rows: T[], maxChars = 900_000, maxRows = 20): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let size = 0;
  for (const row of rows) {
    const len = JSON.stringify(row).length;
    if (cur.length && (size + len > maxChars || cur.length >= maxRows)) { out.push(cur); cur = []; size = 0; }
    cur.push(row);
    size += len;
  }
  if (cur.length) out.push(cur);
  return out;
}

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
  moveProject: (id: string, status: KanbanStatus | ProductionStage) => void;
  addTemplate: (t: PrintTemplate) => void;
  deleteTemplate: (id: string) => void;
  addFilamentPurchase: (fp: FilamentPurchase) => void;
  updateFilamentPurchase: (fp: FilamentPurchase) => void;
  deleteFilamentPurchase: (id: string) => void;
  totalFilamentPurchasesCost: number;
  allPrintNames: string[];
  customerNotes: Record<string, string>;
  updateCustomerNote: (customerId: string, note: string) => void;
  replaceAllData: (data: { projects: Project[]; expenses: Expense[]; templates: PrintTemplate[]; filamentPurchases: FilamentPurchase[]; settings: AppSettings }) => Promise<{ ok: boolean; error?: string }>;
  snapshotToLocalStorage: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  filamentCostPerGram: 0.016,
  printerCount: 1,
  bufferMinutes: 15,
  lowLoadThreshold: 24,
  moderateLoadThreshold: 72,
  businessName: '',
  businessAddress: '',
  invoicePrefix: 'INV',
  currency: 'EUR',
  targetMarginPercent: 40,
  hourlyRate: 2,
  designRate: 20,
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
  const { isDemoMode } = useDemo();
  const isDemoRef = useRef(false);
  isDemoRef.current = isDemoMode;
  const userId = user?.id;

  const [projects, setProjects] = useState<Project[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [filamentPurchases, setFilamentPurchases] = useState<FilamentPurchase[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [customerNotes, setCustomerNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const migratedRef = useRef(false);

  // State refs — assigned synchronously each render so up()/del() always see
  // the latest in-memory data without relying on a stale closure or localStorage reads.
  const projectsRef = useRef<Project[]>([]);
  const expensesRef = useRef<Expense[]>([]);
  const templatesRef = useRef<PrintTemplate[]>([]);
  const filamentRef = useRef<FilamentPurchase[]>([]);
  projectsRef.current = projects;
  expensesRef.current = expenses;
  templatesRef.current = templates;
  filamentRef.current = filamentPurchases;

  // Load from cloud on auth — with localStorage fallback if Supabase fails
  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      if (localStorage.getItem('pt_guest_mode') === 'true') {
        setProjects((loadJSON<any[]>('pt_projects', []) || []).map(normalizeProject));
        setExpenses(loadJSON<Expense[]>('pt_expenses', []));
        setTemplates(loadJSON<PrintTemplate[]>('pt_templates', []));
        setFilamentPurchases(loadJSON<FilamentPurchase[]>('pt_filament_purchases', []));
        const lsSettings = loadJSON<AppSettings | null>('pt_settings', null);
        if (lsSettings) setSettings(lsSettings);
        const lsNotes = loadJSON<Record<string, string>>('pt_customer_notes', {});
        setCustomerNotes(lsNotes);
      }
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [pjs, exs, tps, fps, st, cn] = await Promise.all([
          loadRowsPaged('projects', userId),
          loadRowsPaged('expenses', userId, 200),
          loadRowsPaged('templates', userId, 50),
          loadRowsPaged('filament_purchases', userId, 200),
          supabase.from('user_settings').select('data').eq('user_id', userId).maybeSingle(),
          supabase.from('customer_notes').select('data').eq('user_id', userId).maybeSingle(),
        ]);
        if (cancelled) return;

        // Log any Supabase query errors for debugging
        if (pjs.error) console.error('[sync] projects query:', pjs.error);
        if (exs.error) console.error('[sync] expenses query:', exs.error);
        if (tps.error) console.error('[sync] templates query:', tps.error);
        if (fps.error) console.error('[sync] filament query:', fps.error);
        // A failed query is NOT "no data". Treating it as empty would show an empty app,
        // overwrite the device copy with nothing and could re-upload stale data.
        // Projects are essential: if they can't be loaded, stop and fall back. For the other tables a
        // MISSING table just means "nothing stored there" (some databases don't have every table);
        // any other error on them is still treated as a failed load.
        const optionalError = (e: any) => (e && !isMissingTable(e) ? e : null);
        if (exs.error && isMissingTable(exs.error)) console.warn('[sync] expenses table missing — treating as empty');
        if (tps.error && isMissingTable(tps.error)) console.warn('[sync] templates table missing — treating as empty');
        if (fps.error && isMissingTable(fps.error)) console.warn('[sync] filament_purchases table missing — treating as empty');
        const failed = pjs.error ? ['projects', pjs.error]
          : optionalError(exs.error) ? ['expenses', exs.error]
          : optionalError(tps.error) ? ['templates', tps.error]
          : optionalError(fps.error) ? ['filament', fps.error] : null;
        if (failed) throw new Error(`${failed[0]}: ${failed[1]?.message || failed[1]?.code || 'unknown error'}`);

        // Cached data on this device that belongs to a different account must never be
        // shown to, or uploaded into, this one.
        const cacheOwner = getCacheOwner();
        const cacheIsForeign = cacheOwner !== null && cacheOwner !== userId;
        if (cacheIsForeign) clearDataCache();

        let nextProjects = (pjs.data || []).map(r => normalizeProject(r.data as any));
        let nextExpenses = (exs.data || []).map(r => r.data as unknown as Expense);
        let nextTemplates = (tps.data || []).map(r => r.data as unknown as PrintTemplate);
        let nextFilament = (fps.data || []).map(r => r.data as unknown as FilamentPurchase);
        // Use Supabase settings if present; fall back to localStorage cache rather than DEFAULT_SETTINGS
        // so that flags like onboardingCompleted survive if the Supabase row is temporarily missing.
        const cachedSettings = loadJSON<AppSettings | null>('pt_settings', null);
        let nextSettings: AppSettings = (st.data?.data as unknown as AppSettings) || cachedSettings || DEFAULT_SETTINGS;

        // Load customer notes — migrate from localStorage on first load if Supabase row is empty
        const lsNotes = loadJSON<Record<string, string>>('pt_customer_notes', {});
        let nextNotes: Record<string, string> = (cn.data?.data as unknown as Record<string, string>) || {};
        if (Object.keys(nextNotes).length === 0 && Object.keys(lsNotes).length > 0) {
          nextNotes = lsNotes;
          const { error: notesErr } = await supabase.from('customer_notes').upsert({ user_id: userId, data: lsNotes as any });
          // Only drop the device copy once the cloud really has it
          if (notesErr) console.error('[sync] customer_notes migration:', notesErr);
          else localStorage.removeItem('pt_customer_notes');
        }

        // Fetch profile separately — columns may not exist in all deployments, so we fall back gracefully
        let profileLang: string | undefined;
        let profileMigratedAt: string | null | undefined;
        try {
          const profileResult = await supabase.from('profiles').select('migrated_at, language').eq('id', userId).maybeSingle();
          if (!profileResult.error && profileResult.data) {
            profileLang = (profileResult.data as any).language ?? undefined;
            profileMigratedAt = (profileResult.data as any).migrated_at ?? undefined;
          }
        } catch {
          // Profile columns may not exist in this deployment — skip silently
        }

        // Sync language preference from profile
        if (profileLang) {
          i18n.changeLanguage(profileLang);
          localStorage.setItem('pt_language', profileLang);
        }

        // One-time localStorage migration (runs only if cloud is empty and localStorage has data).
        // For admin accounts: always attempt migration — bypasses the alreadyMigrated gate.
        const alreadyMigrated = profileMigratedAt != null;
        const isAdminUser = isAdmin(user?.email);
        const shouldMigrate = (!alreadyMigrated || isAdminUser) && !migratedRef.current && !cacheIsForeign;
        if (shouldMigrate) {
          migratedRef.current = true;
          const lsProjects = (loadJSON<any[]>('pt_projects', []) || []).map(normalizeProject);
          const lsExpenses = loadJSON<Expense[]>('pt_expenses', []);
          const lsTemplates = loadJSON<PrintTemplate[]>('pt_templates', []);
          const lsFilament = loadJSON<FilamentPurchase[]>('pt_filament_purchases', []);
          const lsSettings = loadJSON<AppSettings | null>('pt_settings', null);
          // Only migrate if cloud is empty — don't overwrite existing cloud data
          const cloudIsEmpty = nextProjects.length === 0 && nextExpenses.length === 0;
          const hasLocal = lsProjects.length || lsExpenses.length || lsTemplates.length || lsFilament.length || lsSettings;
          if (hasLocal && cloudIsEmpty) {
            if (lsProjects.length) { const { error: e1 } = await supabase.from('projects').upsert(lsProjects.map(p => ({ id: p.id, user_id: userId, data: p as any }))); if (e1) console.error('[sync] migration projects:', e1); }
            if (lsExpenses.length) { const { error: e2 } = await supabase.from('expenses').upsert(lsExpenses.map(e => ({ id: e.id, user_id: userId, data: e as any }))); if (e2) console.error('[sync] migration expenses:', e2); }
            if (lsTemplates.length) { const { error: e3 } = await supabase.from('templates').upsert(lsTemplates.map(t => ({ id: t.id, user_id: userId, data: t as any }))); if (e3) console.error('[sync] migration templates:', e3); }
            if (lsFilament.length) { const { error: e4 } = await supabase.from('filament_purchases').upsert(lsFilament.map(f => ({ id: f.id, user_id: userId, data: f as any }))); if (e4) console.error('[sync] migration filament:', e4); }
            if (lsSettings) { const { error: e5 } = await supabase.from('user_settings').upsert({ user_id: userId, data: lsSettings as any }); if (e5) console.error('[sync] migration settings:', e5); }
            nextProjects = lsProjects.length ? lsProjects : nextProjects;
            nextExpenses = lsExpenses.length ? lsExpenses : nextExpenses;
            nextTemplates = lsTemplates.length ? lsTemplates : nextTemplates;
            nextFilament = lsFilament.length ? lsFilament : nextFilament;
            if (lsSettings) nextSettings = lsSettings;
            // Clear localStorage after successful migration
            if (isAdminUser) {
              ['pt_projects', 'pt_expenses', 'pt_templates', 'pt_filament_purchases', 'pt_settings'].forEach(k => localStorage.removeItem(k));
            }
          }
          // Use upsert so this works even if no profile row exists yet
          // profiles.id is the PK (references auth.users.id), not user_id
          await supabase.from('profiles').upsert({ id: userId, migrated_at: new Date().toISOString() });
        }

        // Payment migration: projects with paid=true but no payments → create synthetic payment
        const toMigrate = nextProjects.filter(p =>
          p.paid && !(p.payments || []).length && ((getProjectPiecesTotal(p) || p.totalPrice || 0) > 0)
        );
        if (toMigrate.length > 0) {
          const migrated = toMigrate.map(p => {
            const paymentDate = (p.paidAt || '').split('T')[0] || p.orderDate || new Date().toISOString().split('T')[0];
            const effectiveTotal = getProjectPiecesTotal(p) || (p.totalPrice || 0);
            const payment: Payment = {
              id: crypto.randomUUID(),
              amount: effectiveTotal,
              date: paymentDate,
              method: p.paymentMethod || 'Other',
            };
            return { ...p, payments: [payment] };
          });
          nextProjects = nextProjects.map(p => {
            const m = migrated.find(x => x.id === p.id);
            return m ? normalizeProject(m) : p;
          });
          if (userId) {
            await supabase.from('projects').upsert(
              migrated.map(p => ({ id: p.id, user_id: userId, data: p as any }))
            ).then(({ error }) => { if (error) console.error('[sync] payment migration upsert:', error); });
          }
        }

        setProjects(nextProjects);
        setExpenses(nextExpenses);
        setTemplates(nextTemplates);
        setFilamentPurchases(nextFilament);
        setSettings(nextSettings);
        setCustomerNotes(nextNotes);
        // Cache fresh Supabase data to localStorage so next load has a warm fallback
        // (never throws — a full device cache must not make a successful cloud load look failed)
        cacheProjects(nextProjects);
        cacheJSON('pt_expenses', nextExpenses);
        cacheJSON('pt_templates', nextTemplates);
        cacheJSON('pt_filament_purchases', nextFilament);
        cacheJSON('pt_settings', nextSettings);
        setCacheOwner(userId);
      } catch (err) {
        // Cloud unreachable or a query failed — fall back to this device's last copy,
        // but only if that copy belongs to this account, and say so.
        console.error('[sync] cloud load failed, falling back to device copy:', err);
        const owner = getCacheOwner();
        const cacheUsable = owner === null || owner === userId;
        if (!cancelled) {
          toast.error('Could not load your data from the cloud', {
            id: 'sync-load-failed',
            description: cacheUsable
              ? `Showing the last copy saved on this device, which may be out of date. Reload once you are back online. (${err instanceof Error ? err.message : String(err)})`
              : `Check your connection and reload the page. (${err instanceof Error ? err.message : String(err)})`,
            duration: Infinity,
          });
        }
        if (!cancelled && cacheUsable) {
          setProjects((loadJSON<any[]>('pt_projects', []) || []).map(normalizeProject));
          setExpenses(loadJSON<Expense[]>('pt_expenses', []));
          setTemplates(loadJSON<PrintTemplate[]>('pt_templates', []));
          setFilamentPurchases(loadJSON<FilamentPurchase[]>('pt_filament_purchases', []));
          const lsSettings = loadJSON<AppSettings | null>('pt_settings', null);
          if (lsSettings) setSettings(lsSettings);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, authLoading]);

  // ---- helpers
  const LS_TABLE_KEYS: Record<string, string> = {
    projects: 'pt_projects',
    expenses: 'pt_expenses',
    templates: 'pt_templates',
    filament_purchases: 'pt_filament_purchases',
  };

  const refForTable = (table: 'projects'|'expenses'|'templates'|'filament_purchases'): any[] => {
    if (table === 'projects') return projectsRef.current;
    if (table === 'expenses') return expensesRef.current;
    if (table === 'templates') return templatesRef.current;
    return filamentRef.current;
  };

  const up = (table: 'projects'|'expenses'|'templates'|'filament_purchases', id: string, data: any) => {
    // Always write localStorage as backup for both guest and auth users
    const key = LS_TABLE_KEYS[table];
    if (key) {
      const items = [...refForTable(table)];
      const idx = items.findIndex((x: any) => x.id === id);
      if (idx >= 0) items[idx] = data; else items.unshift(data);
      const cached = table === 'projects' ? cacheProjects(items) !== 'none' : cacheJSON(key, items);
      // Guests have no cloud copy — the device copy is all there is, so a failure must be loud.
      if (!cached && !userId) {
        toast.error('This browser is out of storage space', {
          id: 'device-storage-full',
          description: 'Your latest change could not be saved on this device. Sign in to keep your data in the cloud, or export a backup now.',
          duration: 15000,
        });
      }
    }
    if (!userId) return;
    const label = table === 'projects' ? `"${data?.name || 'project'}"` : 'your change';
    supabase.from(table).upsert({ id, user_id: userId, data }).then(async ({ error }) => {
      if (error) { console.error(`[sync] ${table} upsert error`, error); notifySaveFailed(label); return; }
      // Verify the write landed — read it back and log if missing
      const { data: verify, error: verifyErr } = await (supabase as any).from(table).select('id').eq('id', id).maybeSingle();
      if (verifyErr) { console.error(`[sync] ${table} verify error`, verifyErr); return; }
      if (!verify) { console.error(`[sync] ${table} id=${id} not found after upsert — possible RLS or data loss`); notifySaveFailed(label); }
    }, (err: unknown) => { console.error(`[sync] ${table} upsert failed`, err); notifySaveFailed(label); });
  };

  const del = (table: 'projects'|'expenses'|'templates'|'filament_purchases', id: string) => {
    // Always sync localStorage as backup for both guest and auth users
    const key = LS_TABLE_KEYS[table];
    if (key) {
      const items = refForTable(table).filter((x: any) => x.id !== id);
      if (table === 'projects') cacheProjects(items); else cacheJSON(key, items);
    }
    if (!userId) return;
    supabase.from(table).delete().eq('id', id).then(({ error }) => {
      if (error) { console.error(`[sync] ${table} delete`, error); notifySaveFailed('the deletion'); }
    }, (err: unknown) => { console.error(`[sync] ${table} delete failed`, err); notifySaveFailed('the deletion'); });
  };

  const addProject = useCallback((p: Project) => {
    if (isDemoRef.current) return;
    const n = normalizeProject(p);
    setProjects(prev => [n, ...prev]);
    up('projects', n.id, n);
  }, [userId]);

  const updateProject = useCallback((p: Project) => {
    if (isDemoRef.current) return;
    const normalized = normalizeProject(p);
    if (normalized.printed) {
      normalized.prints = normalized.prints.map(pr => ({ ...pr, completedQuantity: pr.quantity, status: 'completed' as const }));
    }
    normalized.kanbanStatus = deriveKanbanStatus(normalized);
    const allPrintsComplete = normalized.prints.length > 0 && normalized.prints.every(pr => (pr.completedQuantity || 0) >= (pr.quantity || 1));
    if (!normalized.completedAt && (normalized.printed || normalized.sent || allPrintsComplete)) normalized.completedAt = new Date().toISOString();
    if (normalized.completedAt && !normalized.printed && !normalized.sent && !allPrintsComplete) normalized.completedAt = '';
    if (!normalized.paidAt && normalized.paid) normalized.paidAt = new Date().toISOString();
    if (normalized.paidAt && !normalized.paid) normalized.paidAt = '';

    // Fire shipped email when project transitions to 'shipped' and has a customer email
    if (NOTIFICATIONS_ENABLED) {
      const previous = projectsRef.current.find(x => x.id === normalized.id);
      if (
        normalized.kanbanStatus === 'shipped' &&
        previous?.kanbanStatus !== 'shipped' &&
        normalized.customerEmail
      ) {
        supabase.functions.invoke('notify-shipped', {
          body: {
            projectId:     normalized.id,
            projectName:   normalized.name,
            customerEmail: normalized.customerEmail,
            shippingDate:  normalized.shippingDate || undefined,
          },
        }).catch(err => console.error('[notify] shipped email error:', err));
      }
    }

    setProjects(prev => prev.map(x => x.id === normalized.id ? normalized : x));
    up('projects', normalized.id, normalized);
  }, [userId]);

  const deleteProject = useCallback((id: string) => {
    if (isDemoRef.current) return;
    setProjects(prev => prev.filter(x => x.id !== id));
    del('projects', id);
  }, [userId]);

  const moveProject = useCallback((id: string, status: KanbanStatus | ProductionStage) => {
    if (isDemoRef.current) return;
    // Map new stage values to legacy kanbanStatus for backward compat
    const legacyStatusMap: Record<string, KanbanStatus> = {
      'new': 'new-order', 'in-design': 'new-order', 'awaiting-approval': 'new-order',
      'printing': 'printing', 'ready': 'finished', 'delivered': 'shipped',
    };
    const legacyStatus: KanbanStatus = legacyStatusMap[status] ?? (status as KanbanStatus);
    // New stage to persist
    const newStageValues: ProductionStage[] = ['new', 'in-design', 'awaiting-approval', 'printing', 'ready', 'delivered'];
    const newStage: ProductionStage | undefined = newStageValues.includes(status as ProductionStage)
      ? (status as ProductionStage) : undefined;

    setProjects(prev => {
      const project = prev.find(x => x.id === id);
      let updates: Partial<Project> = applyKanbanStatus(legacyStatus, project);
      if (newStage) updates.stage = newStage;
      // When delivering: set sent=true and shippingDate if empty
      if (newStage === 'delivered') {
        updates.sent = true;
        if (!project?.shippingDate) updates.shippingDate = new Date().toISOString().split('T')[0];
      }

      // For paid/shipped transitions, create a payment if none exist and price > 0
      if ((status === 'paid' || status === 'shipped') && project) {
        const payments = project.payments || [];
        if (payments.length === 0) {
          const effectiveTotal = getProjectPiecesTotal(project) || (project.totalPrice || 0);
          if (effectiveTotal > 0) {
            const payment: Payment = {
              id: crypto.randomUUID(),
              amount: effectiveTotal,
              date: new Date().toISOString().split('T')[0],
              method: project.paymentMethod || 'Other',
            };
            updates = { ...updates, payments: [payment] };
          }
        }
      }

      if (newStage) {
        const stageEvent: TimelineEvent = {
          id: crypto.randomUUID(),
          type: 'stage-changed',
          date: new Date().toISOString().split('T')[0],
          label: `Moved to ${STAGE_META[newStage].label}`,
        };
        updates.timelineEvents = [...(project?.timelineEvents || []), stageEvent];
      }

      const next = prev.map(x => x.id === id ? normalizeProject({ ...x, ...updates }) : x);
      const updated = next.find(x => x.id === id);
      if (updated) up('projects', id, updated);
      return next;
    });
  }, [userId]);

  const duplicateProject = useCallback((id: string) => {
    if (isDemoRef.current) return;
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
        stripePaymentLinkId: undefined, stripePaymentLinkUrl: undefined,
        prints: (original.prints || []).map(pr => ({ ...pr, id: crypto.randomUUID(), status: 'not-printed' as const, completedQuantity: 0 })),
        projectExpenses: (original.projectExpenses || []).map(e => ({ ...e, id: crypto.randomUUID() })),
      };
      up('projects', dup.id, dup);
      return [dup, ...prev];
    });
  }, [userId]);

  const addExpense = useCallback((e: Expense) => { if (isDemoRef.current) return; setExpenses(prev => [e, ...prev]); up('expenses', e.id, e); }, [userId]);
  const updateExpense = useCallback((e: Expense) => { if (isDemoRef.current) return; setExpenses(prev => prev.map(x => x.id === e.id ? e : x)); up('expenses', e.id, e); }, [userId]);
  const deleteExpense = useCallback((id: string) => { if (isDemoRef.current) return; setExpenses(prev => prev.filter(x => x.id !== id)); del('expenses', id); }, [userId]);

  const updateSettings = useCallback((s: AppSettings) => {
    if (isDemoRef.current) return;
    setSettings(s);
    // Always write localStorage as backup for both guest and auth users
    cacheJSON('pt_settings', s);
    if (!userId) return;
    supabase.from('user_settings').upsert({ user_id: userId, data: s as any }).then(({ error }) => {
      if (error) { console.error('[sync] user_settings upsert:', error); if (error.code !== 'PGRST205') notifySaveFailed('your settings'); }
    });
  }, [userId]);

  const updateCustomerNote = useCallback((customerId: string, note: string) => {
    if (isDemoRef.current) return;
    setCustomerNotes(prev => {
      const next = { ...prev, [customerId]: note };
      cacheJSON('pt_customer_notes', next);
      if (userId) {
        supabase.from('customer_notes').upsert({ user_id: userId, data: next as any }).then(({ error }) => {
          if (error) { console.error('[sync] customer_notes upsert:', error); notifySaveFailed('the customer note'); }
        });
      }
      return next;
    });
  }, [userId]);

  const addTemplate = useCallback((t: PrintTemplate) => { if (isDemoRef.current) return; setTemplates(prev => [t, ...prev]); up('templates', t.id, t); }, [userId]);
  const deleteTemplate = useCallback((id: string) => { if (isDemoRef.current) return; setTemplates(prev => prev.filter(x => x.id !== id)); del('templates', id); }, [userId]);

  const addFilamentPurchase = useCallback((fp: FilamentPurchase) => { if (isDemoRef.current) return; setFilamentPurchases(prev => [fp, ...prev]); up('filament_purchases', fp.id, fp); }, [userId]);
  const updateFilamentPurchase = useCallback((fp: FilamentPurchase) => { if (isDemoRef.current) return; setFilamentPurchases(prev => prev.map(x => x.id === fp.id ? fp : x)); up('filament_purchases', fp.id, fp); }, [userId]);
  const deleteFilamentPurchase = useCallback((id: string) => { if (isDemoRef.current) return; setFilamentPurchases(prev => prev.filter(x => x.id !== id)); del('filament_purchases', id); }, [userId]);

  const totalFilamentPurchasesCost = React.useMemo(() =>
    filamentPurchases.reduce((s, fp) => s + (fp.totalCost || 0), 0),
    [filamentPurchases]
  );

  // Restore from a backup file. MERGES into what is already there: every item in the backup is
  // added or updated, and nothing that exists only in the app is ever deleted.
  const replaceAllData = useCallback(async (data: { projects: Project[]; expenses: Expense[]; templates: PrintTemplate[]; filamentPurchases: FilamentPurchase[]; settings: AppSettings }): Promise<{ ok: boolean; error?: string }> => {
    if (isDemoRef.current) return { ok: false, error: 'Demo mode is on' };

    if (userId) {
      const tables = [
        { table: 'projects' as const, rows: data.projects },
        { table: 'expenses' as const, rows: data.expenses },
        { table: 'templates' as const, rows: data.templates },
        { table: 'filament_purchases' as const, rows: data.filamentPurchases },
      ];
      try {
        for (const { table, rows } of tables) {
          const payload = rows.map((r: any) => ({ id: r.id, user_id: userId, data: r as any }));
          for (const batch of chunkRows(payload)) {
            const { error } = await supabase.from(table).upsert(batch);
            if (error && table !== 'projects' && isMissingTable(error)) {
              console.warn(`[sync] restore: ${table} table missing in the database — skipped`);
              break;
            }
            if (error) throw new Error(`${table}: ${error.message}`);
          }
        }
      } catch (err) {
        console.error('[sync] restore failed — nothing was deleted:', err);
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
      // Settings are optional: some databases have no user_settings table. Never fail the restore on it.
      const { error: settingsErr } = await supabase.from('user_settings').upsert({ user_id: userId, data: data.settings as any });
      if (settingsErr) console.warn('[sync] restore: settings not saved to cloud (kept on this device):', settingsErr.message);
    }

    const mergeById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
      const incomingIds = new Set(incoming.map(x => x.id));
      return [...incoming, ...current.filter(x => !incomingIds.has(x.id))];
    };
    const nextProjects = mergeById(projectsRef.current, data.projects);
    const nextExpenses = mergeById(expensesRef.current, data.expenses);
    const nextTemplates = mergeById(templatesRef.current, data.templates);
    const nextFilament = mergeById(filamentRef.current, data.filamentPurchases);
    setProjects(nextProjects);
    setExpenses(nextExpenses);
    setTemplates(nextTemplates);
    setFilamentPurchases(nextFilament);
    setSettings(data.settings);
    const cached = cacheProjects(nextProjects);
    cacheJSON('pt_expenses', nextExpenses);
    cacheJSON('pt_templates', nextTemplates);
    cacheJSON('pt_filament_purchases', nextFilament);
    cacheJSON('pt_settings', data.settings);
    if (userId) setCacheOwner(userId);
    if (!userId && cached !== 'full') {
      return { ok: false, error: 'This backup is too large for this browser\'s storage. Sign in first, then restore it to your account.' };
    }
    return { ok: true };
  }, [userId]);

  const snapshotToLocalStorage = useCallback(() => {
    cacheProjects(projectsRef.current);
    cacheJSON('pt_expenses', expensesRef.current);
    cacheJSON('pt_templates', templatesRef.current);
    cacheJSON('pt_filament_purchases', filamentRef.current);
  }, []);

  const allPrintNames = React.useMemo(() => {
    const names = new Set<string>();
    projects.forEach(p => (p.prints || []).forEach(pr => { if (pr.name) names.add(pr.name); }));
    templates.forEach(t => { if (t.name) names.add(t.name); });
    return Array.from(names).sort();
  }, [projects, templates]);

  return (
    <AppContext.Provider value={{
      projects: isDemoMode ? DEMO_PROJECTS : projects,
      expenses: isDemoMode ? DEMO_EXPENSES : expenses,
      filamentPurchases: isDemoMode ? DEMO_FILAMENT : filamentPurchases,
      settings, templates,
      loading: isDemoMode ? false : loading,
      totalFilamentPurchasesCost: isDemoMode ? DEMO_FILAMENT_COST : totalFilamentPurchasesCost,
      allPrintNames: isDemoMode
        ? Array.from(new Set(DEMO_PROJECTS.flatMap(p => p.prints.map(pr => pr.name)))).sort()
        : allPrintNames,
      addProject, updateProject, deleteProject, duplicateProject, moveProject,
      addExpense, updateExpense, deleteExpense, updateSettings,
      customerNotes, updateCustomerNote,
      addTemplate, deleteTemplate,
      addFilamentPurchase, updateFilamentPurchase, deleteFilamentPurchase,
      replaceAllData, snapshotToLocalStorage,
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
