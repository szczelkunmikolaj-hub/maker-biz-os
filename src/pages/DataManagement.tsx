import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, Wand2 } from 'lucide-react';
import posthog from '@/lib/posthog';
import { ImportFromSpreadsheet } from '@/components/ImportFromSpreadsheet';
import { ImportFromAI } from '@/components/ImportFromAI';
import type { Project } from '@/types';

export default function DataManagement() {
  const { projects, addProject } = useApp();
  const { t } = useTranslation();
  const [showSpreadsheetImport, setShowSpreadsheetImport] = useState(false);
  const [showAIImport, setShowAIImport] = useState(false);

  const handleImport = (imported: Project[]) => {
    imported.forEach(p => addProject(p));
    posthog.capture('projects_bulk_imported', { count: imported.length, source: 'import-export' });
  };

  const exportCSV = () => {
    const header = 'Name,Customer,Source,Payment Method,Order Date,Total Price,Paid,Sent,Notes\n';
    const rows = projects.map(p =>
      `"${p.name}","${p.customerName}","${p.customerSource}","${p.paymentMethod || ''}","${p.orderDate || ''}",${p.totalPrice || 0},${p.paid},${p.sent},"${(p.notes || '').replace(/"/g, '""')}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `projects-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    posthog.capture('data_exported', { project_count: projects.length, format: 'csv' });
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
        <CardContent>
          <Button onClick={exportCSV} disabled={projects.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            {t('data.exportJSON')} ({projects.length} {t('data.projectsWord')})
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
    </div>
  );
}
