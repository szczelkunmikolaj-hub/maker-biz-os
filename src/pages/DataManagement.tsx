import { useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, Wand2, Archive, RotateCcw } from 'lucide-react';
import posthog from '@/lib/posthog';
import { ImportFromSpreadsheet } from '@/components/ImportFromSpreadsheet';
import { ImportFromAI } from '@/components/ImportFromAI';
import { useToast } from '@/hooks/useToast';
// PAYMENTS_TODO: import { UpgradeModal } from '@/components/UpgradeModal';
// PAYMENTS_TODO: import { useTier } from '@/context/TierContext';
import type { Project } from '@/types';
import { normalizeProject } from '@/types';

function csvCell(v: any): string {
  const s = v === null || v === undefined ? '' : String(v);
  return '"' + s.replace(/"/g, '""') + '"';
}

function buildCSV(projects: Project[]): string {
  const headers = [
    'project_id', 'project_name', 'customer_name', 'customer_source', 'payment_method',
    'order_date', 'due_date', 'completed_at', 'paid_at', 'shipping_date',
    'total_price', 'printed', 'paid', 'sent', 'kanban_status', 'is_recurring_customer', 'notes',
    'print_id', 'print_name', 'print_status', 'quantity', 'completed_quantity',
    'print_hours', 'material_grams', 'material_type', 'color', 'price_per_piece',
    'expenses_total', 'expenses_detail',
  ];

  const rows: string[] = [headers.join(',')];

  for (const p of projects) {
    const expTotal = (p.projectExpenses || []).reduce((s, e) => s + (e.amount || 0), 0);
    const expDetail = (p.projectExpenses || [])
      .map(e => `${e.name}:${e.amount}${e.category ? ':' + e.category : ''}`)
      .join('; ');

    const projectCols = [
      csvCell(p.id), csvCell(p.name), csvCell(p.customerName), csvCell(p.customerSource),
      csvCell(p.paymentMethod), csvCell(p.orderDate), csvCell(p.dueDate),
      csvCell(p.completedAt), csvCell(p.paidAt), csvCell(p.shippingDate),
      csvCell(p.totalPrice), csvCell(p.printed), csvCell(p.paid), csvCell(p.sent),
      csvCell(p.kanbanStatus), csvCell(p.isRecurringCustomer), csvCell(p.notes),
    ];

    const emptyPrint = Array(10).fill(csvCell(''));

    if (!p.prints || p.prints.length === 0) {
      rows.push([...projectCols, ...emptyPrint, csvCell(expTotal), csvCell(expDetail)].join(','));
    } else {
      for (const pr of p.prints) {
        rows.push([
          ...projectCols,
          csvCell(pr.id), csvCell(pr.name), csvCell(pr.status),
          csvCell(pr.quantity), csvCell(pr.completedQuantity),
          csvCell(pr.estimatedPrintTime), csvCell(pr.materialUsed),
          csvCell(pr.material), csvCell(pr.color), csvCell(pr.pricePerPiece),
          csvCell(expTotal), csvCell(expDetail),
        ].join(','));
      }
    }
  }

  return rows.join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function DataManagement() {
  const { projects, expenses, filamentPurchases, templates, settings, addProject, replaceAllData } = useApp();
  const { t } = useTranslation();
  const toast = useToast();
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const [showSpreadsheetImport, setShowSpreadsheetImport] = useState(false);
  const [showAIImport, setShowAIImport] = useState(false);
  // PAYMENTS_TODO: const [showUpgrade, setShowUpgrade] = useState(false);
  // PAYMENTS_TODO: const [upgradeFeature, setUpgradeFeature] = useState<'data_export' | 'excel_csv_import'>('data_export');
  // PAYMENTS_TODO: const { isPro } = useTier();

  const handleImport = (imported: Project[]) => {
    imported.forEach(p => addProject(p));
    posthog.capture('projects_bulk_imported', { count: imported.length, source: 'import-export' });
  };

  const handleExportCSV = () => {
    downloadFile(buildCSV(projects), `projects-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    posthog.capture('data_exported', { project_count: projects.length, format: 'csv' });
  };

  const handleExportJSON = () => {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      projects,
      expenses,
      filamentPurchases,
      templates,
      settings,
    };
    downloadFile(JSON.stringify(backup, null, 2), `printtrack-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    posthog.capture('data_exported', { format: 'json', project_count: projects.length });
  };

  const handleImportJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data.projects || !Array.isArray(data.projects)) {
          toast.error(t('data.invalidBackup'));
          return;
        }
        replaceAllData({
          projects: (data.projects || []).map(normalizeProject),
          expenses: data.expenses || [],
          templates: data.templates || [],
          filamentPurchases: data.filamentPurchases || [],
          settings: { ...settings, ...(data.settings || {}) },
        });
        toast.success(t('data.restoreSuccess', { projects: data.projects.length }));
        posthog.capture('data_imported', { format: 'json', project_count: data.projects.length });
      } catch {
        toast.error(t('data.invalidBackup'));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">{t('data.title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('data.importData')}</CardTitle>
          <CardDescription>{t('data.importDataDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          <Button variant="outline" onClick={() => setShowSpreadsheetImport(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {t('settings.importFromSpreadsheet')}
          </Button>
          <Button variant="outline" onClick={() => setShowAIImport(true)}>
            <Wand2 className="h-4 w-4 mr-2" />
            {t('settings.importFromAI')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('data.exportData')}</CardTitle>
          <CardDescription>{t('data.exportDataDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          <Button variant="outline" onClick={() => {
            if (localStorage.getItem('pt_guest_mode') === 'true') {
              document.dispatchEvent(new CustomEvent('guest-gate', { detail: { message: 'Create an account to export your data' } }));
              return;
            }
            handleExportCSV();
          }} disabled={projects.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            {t('data.exportCSV')} ({projects.length} {t('data.projectsWord')})
          </Button>
          <Button variant="outline" onClick={() => {
            if (localStorage.getItem('pt_guest_mode') === 'true') {
              document.dispatchEvent(new CustomEvent('guest-gate', { detail: { message: 'Create an account to export your data' } }));
              return;
            }
            handleExportJSON();
          }} disabled={projects.length === 0}>
            <Archive className="h-4 w-4 mr-2" />
            {t('data.exportFullBackup')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('data.restoreBackup')}</CardTitle>
          <CardDescription>{t('data.restoreBackupDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={jsonFileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleImportJSON(f);
              e.target.value = '';
            }}
          />
          <Button variant="outline" onClick={() => jsonFileRef.current?.click()}>
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('data.restoreFromBackup')}
          </Button>
        </CardContent>
      </Card>

      <ImportFromSpreadsheet
        open={showSpreadsheetImport}
        onClose={() => setShowSpreadsheetImport(false)}
        onImport={handleImport}
      />
      <ImportFromAI
        open={showAIImport}
        onClose={() => setShowAIImport(false)}
        onImport={handleImport}
      />
      {/* PAYMENTS_TODO: <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} feature={upgradeFeature} /> */}
    </div>
  );
}
