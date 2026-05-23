import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Project, normalizeProject, normalizePrint } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';

type FieldKey = 'name' | 'customerName' | 'totalPrice' | 'orderDate' | 'dueDate' | 'notes' | 'printed' | 'paid' | 'sent' | 'printHours' | 'material' | 'color';

const FIELD_PATTERNS: Record<FieldKey, RegExp> = {
  name:         /^(project[_ ]?name|name|title|order[_ ]?name|item|product)$/i,
  customerName: /^(customer[_ ]?name|customer|client|buyer|contact)$/i,
  totalPrice:   /^(price|total|amount|revenue|value|€|\$|£|eur|usd|total[_ ]?price|sale|order[_ ]?value)$/i,
  orderDate:    /^(date|order[_ ]?date|created|order[_ ]?created)$/i,
  dueDate:      /^(due|deadline|due[_ ]?date|delivery[_ ]?date|ship[_ ]?date)$/i,
  notes:        /^(note|notes|description|comments?|details?)$/i,
  printed:      /^(print(ed)?|completed?|done|finished)$/i,
  paid:         /^(paid|payment|payment[_ ]?received)$/i,
  sent:         /^(sent|ship(ped)?|deliver(ed)?|dispatched?)$/i,
  printHours:   /^(hours?|print[_ ]?time|time[_ ]?h(ours?)?|h$|duration)$/i,
  material:     /^(material|filament|grams?|weight|g$)$/i,
  color:        /^(colou?rs?)$/i,
};

function autoDetect(headers: string[]): Partial<Record<FieldKey, string>> {
  const result: Partial<Record<FieldKey, string>> = {};
  const used = new Set<string>();
  for (const [field, pattern] of Object.entries(FIELD_PATTERNS) as [FieldKey, RegExp][]) {
    for (const h of headers) {
      if (pattern.test(h.trim()) && !used.has(h)) {
        result[field as FieldKey] = h;
        used.add(h);
        break;
      }
    }
  }
  return result;
}

function parseBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return ['true', 'yes', '1', 'x', '✓', '✔'].includes(String(v).toLowerCase().trim());
}

function parseDate(v: any): string {
  if (!v) return '';
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

function buildProjects(rows: Record<string, any>[], mapping: Partial<Record<FieldKey, string>>): Project[] {
  const today = new Date().toISOString().slice(0, 10);
  const get = (row: Record<string, any>, field: FieldKey) => mapping[field] ? row[mapping[field]] : undefined;

  return rows
    .filter(row => {
      const col = mapping['name'];
      return col && String(row[col] || '').trim() !== '';
    })
    .map(row => {
      const printHours = parseFloat(String(get(row, 'printHours') ?? '')) || 0;
      const material = parseFloat(String(get(row, 'material') ?? '')) || 0;
      const color = String(get(row, 'color') ?? '');

      const prints = (printHours > 0 || material > 0) ? [normalizePrint({
        id: crypto.randomUUID(),
        name: String(get(row, 'name') ?? 'Print').trim(),
        estimatedPrintTime: printHours,
        materialUsed: material,
        color,
      })] : [];

      return normalizeProject({
        id: crypto.randomUUID(),
        name: String(get(row, 'name') ?? '').trim(),
        customerName: String(get(row, 'customerName') ?? '').trim(),
        customerSource: 'Other',
        paymentMethod: 'Other',
        totalPrice: parseFloat(String(get(row, 'totalPrice') ?? '')) || 0,
        orderDate: parseDate(get(row, 'orderDate')) || today,
        dueDate: parseDate(get(row, 'dueDate')),
        notes: String(get(row, 'notes') ?? '').trim(),
        printed: parseBool(get(row, 'printed')),
        paid: parseBool(get(row, 'paid')),
        sent: parseBool(get(row, 'sent')),
        shippingDate: '',
        prints,
        projectExpenses: [],
        kanbanStatus: 'new-order',
      });
    });
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (projects: Project[]) => void;
}

export function ImportFromSpreadsheet({ open, onClose, onImport }: Props) {
  const toast = useToast();
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'map'>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, string>>>({});
  const [loading, setLoading] = useState(false);

  const FIELD_LABELS: Record<FieldKey, string> = {
    name: t('importSpreadsheet.fieldName'),
    customerName: t('importSpreadsheet.fieldCustomer'),
    totalPrice: t('importSpreadsheet.fieldPrice'),
    orderDate: t('importSpreadsheet.fieldOrderDate'),
    dueDate: t('importSpreadsheet.fieldDueDate'),
    notes: t('importSpreadsheet.fieldNotes'),
    printed: t('importSpreadsheet.fieldPrinted'),
    paid: t('importSpreadsheet.fieldPaid'),
    sent: t('importSpreadsheet.fieldSent'),
    printHours: t('importSpreadsheet.fieldPrintHours'),
    material: t('importSpreadsheet.fieldMaterial'),
    color: t('importSpreadsheet.fieldColor'),
  };

  const reset = () => { setStep('upload'); setHeaders([]); setRows([]); setMapping({}); };
  const handleClose = () => { onClose(); reset(); };

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rawRows.length) { toast.error(t('importSpreadsheet.noDataError')); return; }
      const hdrs = Object.keys(rawRows[0]);
      setHeaders(hdrs);
      setRows(rawRows);
      setMapping(autoDetect(hdrs));
      setStep('map');
    } catch {
      toast.error(t('importSpreadsheet.parseError'));
    } finally {
      setLoading(false);
    }
  };

  const preview = step === 'map' ? buildProjects(rows, mapping) : [];

  const handleConfirm = () => {
    if (!preview.length) { toast.error(t('importSpreadsheet.noProjectsError')); return; }
    onImport(preview);
    handleClose();
    toast.success(t('importSpreadsheet.importSuccess', { count: preview.length }));
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {t('importSpreadsheet.title')}
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div
            className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            {loading
              ? <Loader2 className="h-10 w-10 mx-auto animate-spin text-muted-foreground" />
              : <>
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium">{t('importSpreadsheet.dropPrompt')}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t('importSpreadsheet.dropHint')}</p>
                </>
            }
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        )}

        {step === 'map' && (
          <>
            <p className="text-sm text-muted-foreground">
              {t('importSpreadsheet.rowsFound', { count: rows.length })}
            </p>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {(Object.keys(FIELD_LABELS) as FieldKey[]).map(field => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs">{FIELD_LABELS[field]}</Label>
                  <Select
                    value={mapping[field] || '__none__'}
                    onValueChange={v => setMapping(prev => ({ ...prev, [field]: v === '__none__' ? undefined : v }))}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('importSpreadsheet.notImported')}</SelectItem>
                      {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {preview.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  {t('importSpreadsheet.previewLabel', { shown: Math.min(preview.length, 3), total: preview.length })}
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs py-2">{t('common.name')}</TableHead>
                        <TableHead className="text-xs py-2">{t('projects.customerName')}</TableHead>
                        <TableHead className="text-xs py-2">{t('expenses.amount')}</TableHead>
                        <TableHead className="text-xs py-2">{t('common.date')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.slice(0, 3).map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs py-2 font-medium">{p.name}</TableCell>
                          <TableCell className="text-xs py-2">{p.customerName || '—'}</TableCell>
                          <TableCell className="text-xs py-2">{p.totalPrice > 0 ? `€${p.totalPrice}` : '—'}</TableCell>
                          <TableCell className="text-xs py-2">{p.orderDate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter className="gap-2">
          {step === 'upload'
            ? <Button variant="outline" onClick={handleClose}>{t('common.cancel')}</Button>
            : <>
                <Button variant="outline" onClick={() => setStep('upload')}>{t('common.back')}</Button>
                <Button onClick={handleConfirm} disabled={preview.length === 0}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {t('importSpreadsheet.confirmBtn', { count: preview.length })}
                </Button>
              </>
          }
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
