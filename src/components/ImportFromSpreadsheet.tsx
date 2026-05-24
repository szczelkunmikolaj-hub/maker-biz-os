import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Project, KanbanStatus, normalizeProject, normalizePrint } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';

type FieldKey =
  | 'name' | 'customerName' | 'totalPrice' | 'orderDate' | 'dueDate' | 'notes'
  | 'printed' | 'paid' | 'sent'
  | 'printHours' | 'materialGrams' | 'materialName' | 'color'
  | 'quantity' | 'completedQuantity' | 'pricePerPiece'
  | 'expenseName' | 'expenseAmount';

const FIELD_PATTERNS: Record<FieldKey, RegExp> = {
  name:              /^(project[_ ]?name|name|title|order[_ ]?name|item|product)$/i,
  customerName:      /^(customer[_ ]?name|customer|client|buyer|contact)$/i,
  totalPrice:        /^(price|total|amount|revenue|value|€|\$|£|eur|usd|total[_ ]?price|sale|order[_ ]?value)$/i,
  orderDate:         /^(date|order[_ ]?date|created|order[_ ]?created|created[_ ]?at)$/i,
  dueDate:           /^(due|deadline|due[_ ]?date|delivery[_ ]?date|ship[_ ]?date|expected[_ ]?date)$/i,
  notes:             /^(note|notes|description|comments?|details?)$/i,
  printed:           /^(print(ed)?|completed?|done|finished)$/i,
  paid:              /^(paid|payment|payment[_ ]?received)$/i,
  sent:              /^(sent|ship(ped)?|deliver(ed)?|dispatched?)$/i,
  printHours:        /^(hours?|print[_ ]?time|time[_ ]?h(ours?)?|h$|duration|print[_ ]?hours?)$/i,
  materialGrams:     /^(grams?|weight|g$|material[_ ]?used|used[_ ]?grams?|filament[_ ]?grams?|material[_ ]?g)$/i,
  materialName:      /^(material[_ ]?type|filament[_ ]?type|material$|filament$|pla|petg|abs|resin|nylon)$/i,
  color:             /^(colou?rs?|color[_ ]?name)$/i,
  quantity:          /^(qty|quantity|count|pieces?|num[_ ]?pieces?|amount[_ ]?pieces?|copies|number)$/i,
  completedQuantity: /^(completed?[_ ]?qty|done[_ ]?qty|printed[_ ]?qty|finished[_ ]?qty|completed?[_ ]?pieces?)$/i,
  pricePerPiece:     /^(price[_ ]?per[_ ]?piece|unit[_ ]?price|piece[_ ]?price|per[_ ]?unit|each)$/i,
  expenseName:       /^(expense[_ ]?name|extra[_ ]?cost[_ ]?name|cost[_ ]?name|expense[_ ]?desc)$/i,
  expenseAmount:     /^(expense[_ ]?amount|extra[_ ]?cost|extra[_ ]?expense|additional[_ ]?cost|overhead)$/i,
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

  // YYYY-MM-DD — return as-is to avoid any timezone shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const d = new Date(+ddmmyyyy[3], +ddmmyyyy[2] - 1, +ddmmyyyy[1]);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // DD-MM-YYYY
  const ddmmyyyy2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyy2) {
    const d = new Date(+ddmmyyyy2[3], +ddmmyyyy2[2] - 1, +ddmmyyyy2[1]);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // DD.MM.YYYY
  const ddmmyyyy3 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyy3) {
    const d = new Date(+ddmmyyyy3[3], +ddmmyyyy3[2] - 1, +ddmmyyyy3[1]);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // Standard parsing (MM/DD/YYYY, etc.)
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return s;
}

function deriveKanbanStatus(printed: boolean, paid: boolean, sent: boolean): KanbanStatus {
  if (sent) return 'shipped';
  if (paid) return 'paid';
  if (printed) return 'finished';
  return 'new-order';
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
      const materialGrams = parseFloat(String(get(row, 'materialGrams') ?? '')) || 0;
      const materialName = String(get(row, 'materialName') ?? '').trim();
      const color = String(get(row, 'color') ?? '').trim();
      const quantity = Math.max(1, parseInt(String(get(row, 'quantity') ?? '1')) || 1);
      const completedQty = parseInt(String(get(row, 'completedQuantity') ?? '0')) || 0;
      const pricePerPiece = parseFloat(String(get(row, 'pricePerPiece') ?? '')) || 0;

      const printed = parseBool(get(row, 'printed'));
      const paid = parseBool(get(row, 'paid'));
      const sent = parseBool(get(row, 'sent'));

      const hasPrintData = printHours > 0 || materialGrams > 0 || materialName || color || quantity > 1 || pricePerPiece > 0;
      const prints = hasPrintData ? [normalizePrint({
        id: crypto.randomUUID(),
        name: String(get(row, 'name') ?? 'Print').trim(),
        estimatedPrintTime: printHours,
        materialUsed: materialGrams,
        material: materialName,
        color,
        quantity,
        completedQuantity: completedQty,
        pricePerPiece,
        status: sent || paid || printed ? 'completed' : 'not-printed',
      })] : [];

      const expName = String(get(row, 'expenseName') ?? '').trim();
      const expAmt = parseFloat(String(get(row, 'expenseAmount') ?? '')) || 0;
      const projectExpenses = (expName || expAmt > 0) ? [{
        id: crypto.randomUUID(),
        name: expName || 'Expense',
        amount: expAmt,
        category: 'Other',
        notes: '',
      }] : [];

      const kanbanStatus = deriveKanbanStatus(printed, paid, sent);

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
        printed,
        paid,
        sent,
        shippingDate: '',
        prints,
        projectExpenses,
        kanbanStatus,
      });
    });
}

// Columns that uniquely identify the app's own CSV export format
const APP_CSV_MARKER_COLS = ['project_id', 'project_name', 'print_name'];

function parseExpensesDetail(detail: string): Array<{ id: string; name: string; amount: number; category: string; notes: string }> {
  if (!detail || !detail.trim()) return [];
  return detail.split(';').map(s => s.trim()).filter(Boolean).map(entry => {
    const parts = entry.split(':');
    return {
      id: crypto.randomUUID(),
      name: parts[0]?.trim() || 'Expense',
      amount: parseFloat(parts[1]?.trim() || '0') || 0,
      category: parts[2]?.trim() || 'Other',
      notes: '',
    };
  });
}

function buildProjectsFromAppCSV(rows: Record<string, any>[]): Project[] {
  const today = new Date().toISOString().slice(0, 10);

  // Group rows by project_id preserving insertion order
  const groups = new Map<string, Record<string, any>[]>();
  for (const row of rows) {
    const pid = String(row['project_id'] || '').trim();
    if (!pid) continue;
    if (!groups.has(pid)) groups.set(pid, []);
    groups.get(pid)!.push(row);
  }

  const projects: Project[] = [];

  for (const [pid, groupRows] of groups) {
    const first = groupRows[0];

    const printed = parseBool(first['printed']);
    const paid    = parseBool(first['paid']);
    const sent    = parseBool(first['sent']);

    const prints = groupRows
      .filter(row => String(row['print_name'] || '').trim())
      .map(row => normalizePrint({
        id: String(row['print_id'] || '').trim() || crypto.randomUUID(),
        name: String(row['print_name'] || '').trim(),
        status: String(row['print_status'] || '').trim() || (sent || paid || printed ? 'completed' : 'not-printed'),
        quantity: Math.max(1, parseInt(String(row['quantity'] || '1')) || 1),
        completedQuantity: parseInt(String(row['completed_quantity'] || '0')) || 0,
        estimatedPrintTime: parseFloat(String(row['print_hours'] || '')) || 0,
        materialUsed: parseFloat(String(row['material_grams'] || '')) || 0,
        material: String(row['material_type'] || '').trim(),
        color: String(row['color'] || '').trim(),
        pricePerPiece: parseFloat(String(row['price_per_piece'] || '')) || 0,
      }));

    const projectExpenses = parseExpensesDetail(String(first['expenses_detail'] || ''));
    const storedStatus = String(first['kanban_status'] || '').trim() as KanbanStatus;
    const kanbanStatus: KanbanStatus = storedStatus || deriveKanbanStatus(printed, paid, sent);

    projects.push(normalizeProject({
      id: pid,
      name: String(first['project_name'] || '').trim(),
      customerName: String(first['customer_name'] || '').trim(),
      customerSource: (String(first['customer_source'] || '').trim() || 'Other') as Project['customerSource'],
      paymentMethod: (String(first['payment_method'] || '').trim() || 'Other') as Project['paymentMethod'],
      totalPrice: parseFloat(String(first['total_price'] || '')) || 0,
      orderDate: parseDate(first['order_date']) || today,
      dueDate: parseDate(first['due_date']),
      completedAt: parseDate(first['completed_at']),
      paidAt: parseDate(first['paid_at']),
      shippingDate: parseDate(first['shipping_date']),
      printed,
      paid,
      sent,
      isRecurringCustomer: parseBool(first['is_recurring_customer']),
      notes: String(first['notes'] || '').trim(),
      kanbanStatus,
      prints,
      projectExpenses,
    }));
  }

  return projects;
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
    name:              t('importSpreadsheet.fieldName'),
    customerName:      t('importSpreadsheet.fieldCustomer'),
    totalPrice:        t('importSpreadsheet.fieldPrice'),
    orderDate:         t('importSpreadsheet.fieldOrderDate'),
    dueDate:           t('importSpreadsheet.fieldDueDate'),
    notes:             t('importSpreadsheet.fieldNotes'),
    printed:           t('importSpreadsheet.fieldPrinted'),
    paid:              t('importSpreadsheet.fieldPaid'),
    sent:              t('importSpreadsheet.fieldSent'),
    printHours:        t('importSpreadsheet.fieldPrintHours'),
    materialGrams:     t('importSpreadsheet.fieldMaterial'),
    materialName:      t('importSpreadsheet.fieldMaterialName'),
    color:             t('importSpreadsheet.fieldColor'),
    quantity:          t('importSpreadsheet.fieldQuantity'),
    completedQuantity: t('importSpreadsheet.fieldCompletedQuantity'),
    pricePerPiece:     t('importSpreadsheet.fieldPricePerPiece'),
    expenseName:       t('importSpreadsheet.fieldExpenseName'),
    expenseAmount:     t('importSpreadsheet.fieldExpenseAmount'),
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

      // Auto-import when the file matches our own CSV export format
      if (APP_CSV_MARKER_COLS.every(col => hdrs.includes(col))) {
        const imported = buildProjectsFromAppCSV(rawRows);
        if (!imported.length) { toast.error(t('importSpreadsheet.noProjectsError')); return; }
        onImport(imported);
        handleClose();
        toast.success(t('importSpreadsheet.importSuccess', { count: imported.length }));
        return;
      }

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
