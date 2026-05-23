import { useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from 'react-i18next';
import { getUserId } from '@/lib/userId';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, AlertTriangle, Merge, Replace, Copy, User, FileText } from 'lucide-react';
import posthog from '@/lib/posthog';
import { normalizeProject } from '@/types';
import { parseLegacyText } from '@/lib/legacyTextParser';
import type { Project, Expense, PrintTemplate, FilamentPurchase, AppSettings } from '@/types';

interface ExportData {
  version: number;
  exportedAt: string;
  userId: string;
  projects: Project[];
  expenses: Expense[];
  templates: PrintTemplate[];
  filamentPurchases: FilamentPurchase[];
  settings: AppSettings;
}

function isValidExport(data: any): data is ExportData {
  return data && typeof data === 'object' && Array.isArray(data.projects);
}

export default function DataManagement() {
  const app = useApp();
  const { toast } = useToast();
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [jsonText, setJsonText] = useState('');
  const [parsed, setParsed] = useState<ExportData | null>(null);
  const [parseError, setParseError] = useState('');
  const [legacyText, setLegacyText] = useState('');
  const [legacyResult, setLegacyResult] = useState<{ projects: Project[]; expenses: Expense[] } | null>(null);
  const userId = getUserId();

  // ── Export ──
  const handleExport = () => {
    const data: ExportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      userId,
      projects: app.projects,
      expenses: app.expenses,
      templates: app.templates,
      filamentPurchases: app.filamentPurchases,
      settings: app.settings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `printtrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    posthog.capture('data_exported', {
      project_count: data.projects.length,
      expense_count: data.expenses.length,
      template_count: data.templates.length,
      filament_purchase_count: data.filamentPurchases.length,
    });
    toast({ title: t('data.exportComplete'), description: `${data.projects.length} ${t('data.projectsWord')} exported.` });
  };

  // ── Parse helper ──
  const tryParse = (raw: string) => {
    setParseError('');
    setParsed(null);
    try {
      const obj = JSON.parse(raw);
      if (!isValidExport(obj)) {
        setParseError('Invalid format: missing "projects" array.');
        return;
      }
      setParsed(obj);
    } catch (e: any) {
      setParseError(`JSON parse error: ${e.message}`);
    }
  };

  // ── File upload ──
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setJsonText(text);
      tryParse(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Import (replace or merge) ──
  const doImport = (mode: 'replace' | 'merge') => {
    if (!parsed) return;

    if (mode === 'replace') {
      // Replace all data
      app.replaceAllData({
        projects: (parsed.projects || []).map(normalizeProject),
        expenses: parsed.expenses || [],
        templates: parsed.templates || [],
        filamentPurchases: parsed.filamentPurchases || [],
        settings: parsed.settings || app.settings,
      });
      posthog.capture('data_imported', { import_mode: 'replace', project_count: parsed.projects.length });
      toast({ title: t('data.dataReplaced'), description: `${parsed.projects.length} ${t('data.projectsWord')} loaded.` });
    } else {
      // Merge: append non-duplicate items
      const existingProjectNames = new Set(app.projects.map(p => p.name.toLowerCase()));
      const existingExpenseIds = new Set(app.expenses.map(e => e.id));
      const existingTemplateIds = new Set(app.templates.map(t => t.id));
      const existingFpIds = new Set(app.filamentPurchases.map(f => f.id));

      let added = 0;
      (parsed.projects || []).forEach(p => {
        const norm = normalizeProject(p);
        if (!existingProjectNames.has(norm.name.toLowerCase())) {
          app.addProject(norm);
          added++;
        }
      });
      (parsed.expenses || []).forEach(e => {
        if (!existingExpenseIds.has(e.id)) app.addExpense(e);
      });
      (parsed.templates || []).forEach(t => {
        if (!existingTemplateIds.has(t.id)) app.addTemplate(t);
      });
      (parsed.filamentPurchases || []).forEach(fp => {
        if (!existingFpIds.has(fp.id)) app.addFilamentPurchase(fp);
      });
      posthog.capture('data_imported', { import_mode: 'merge', projects_added: added });
      toast({ title: t('data.mergeComplete'), description: `${added} ${t('data.projectsWord')} added.` });
    }
    setParsed(null);
    setJsonText('');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">{t('data.title')}</h1>

      {/* User ID */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> {t('data.deviceId')}</CardTitle>
          <CardDescription>{t('data.deviceIdDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <code className="text-xs bg-muted px-3 py-1.5 rounded-md font-mono flex-1 truncate">{userId}</code>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(userId); toast({ title: t('data.copied') }); }}>
            <Copy className="h-3 w-3" />
          </Button>
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Download className="h-4 w-4" /> {t('data.exportData')}</CardTitle>
          <CardDescription>{t('data.exportDataDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Includes {app.projects.length} {t('data.projectsWord')}, {app.expenses.length} {t('data.expensesWord')}, {app.templates.length} {t('data.templatesWord')}, {app.filamentPurchases.length} {t('data.filamentPurchasesWord')}.
          </p>
          <Button onClick={handleExport}><Download className="h-4 w-4 mr-2" /> {t('data.exportJSON')}</Button>
        </CardContent>
      </Card>

      {/* Import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> {t('data.importData')}</CardTitle>
          <CardDescription>{t('data.importDataDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('data.uploadJSON')}</Label>
            <input ref={fileRef} type="file" accept=".json" onChange={handleFile} className="block mt-1 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-3 file:py-1.5 file:text-sm file:font-medium file:cursor-pointer" />
          </div>
          <div>
            <Label>{t('data.pasteJSON')}</Label>
            <Textarea
              rows={6}
              placeholder='{"version":1,"projects":[...]}'
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              className="font-mono text-xs mt-1"
            />
            <Button variant="outline" size="sm" className="mt-2" onClick={() => tryParse(jsonText)}>{t('data.parseJSON')}</Button>
          </div>

          {parseError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" /> {parseError}
            </div>
          )}

          {parsed && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">{t('data.readyToImport')}</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {parsed.projects?.length || 0} {t('data.projectsWord')}</li>
                <li>• {parsed.expenses?.length || 0} {t('data.expensesWord')}</li>
                <li>• {parsed.templates?.length || 0} {t('data.templatesWord')}</li>
                <li>• {parsed.filamentPurchases?.length || 0} {t('data.filamentPurchasesWord')}</li>
              </ul>
              <div className="flex gap-2 pt-2">
                <Button variant="destructive" onClick={() => doImport('replace')}>
                  <Replace className="h-4 w-4 mr-2" /> {t('data.replaceAll')}
                </Button>
                <Button onClick={() => doImport('merge')}>
                  <Merge className="h-4 w-4 mr-2" /> {t('data.mergeWith')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Legacy Text Import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> {t('data.importFromText')}</CardTitle>
          <CardDescription>{t('data.importFromTextDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            rows={8}
            placeholder={`September\n[x] Figurine: 25 euros - Cash\n[x] Phone case: 15 euros - Wallapop\n[ ] Pending item\n\nExpenses\nFilament: 20 euros\n\nOctober\n[x] Vase: 30 euros - Bizum`}
            value={legacyText}
            onChange={e => setLegacyText(e.target.value)}
            className="font-mono text-xs"
          />
          <Button variant="outline" size="sm" onClick={() => {
            const result = parseLegacyText(legacyText);
            setLegacyResult(result);
          }}>{t('data.parseText')}</Button>

          {legacyResult && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">{t('data.parsedFromText')}</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {legacyResult.projects.length} {t('data.completedProjectsWord')}</li>
                <li>• {legacyResult.expenses.length} {t('data.expensesWord')}</li>
              </ul>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => {
                  const existingNames = new Set(app.projects.map(p => `${p.name.toLowerCase()}-${p.totalPrice}`));
                  let added = 0;
                  legacyResult.projects.forEach(p => {
                    const key = `${p.name.toLowerCase()}-${p.totalPrice}`;
                    if (!existingNames.has(key)) {
                      app.addProject(normalizeProject(p));
                      existingNames.add(key);
                      added++;
                    }
                  });
                  legacyResult.expenses.forEach(e => app.addExpense(e));
                  toast({ title: t('data.legacyImportComplete'), description: `${added} ${t('data.projectsWord')} and ${legacyResult.expenses.length} ${t('data.expensesWord')} added.` });
                  setLegacyResult(null);
                  setLegacyText('');
                }}>
                  <Merge className="h-4 w-4 mr-2" /> {t('data.importMerge')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
