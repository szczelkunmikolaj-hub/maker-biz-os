import { useState } from 'react';
import { Project, normalizeProject } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, ListPlus, AlertTriangle, X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

// Matches: "Name: [€]amount[€|euros|eur] [+ tip_amount [euros|eur] tip]"
// Group 1: name (everything before first colon)
// Group 2: base price digits (supports . and , as decimal separator)
// Group 3: tip digits (optional, must be followed by word "tip")
const LINE_RE =
  /^([^:]+):\s*(?:€\s*)?(\d+(?:[.,]\d+)?)\s*(?:€|euros?|eur)?(?:\s*\+\s*(\d+(?:[.,]\d+)?)\s*(?:€|euros?|eur)?\s*tip)?\s*$/i;

function parseNum(s: string): number {
  return parseFloat(s.replace(',', '.'));
}

interface ParsedRow {
  id: string;
  name: string;
  price: number;
  removed: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (projects: Project[]) => void;
}

export function QuickAddFromList({ open, onClose, onImport }: Props) {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const [text, setText] = useState('');
  const [date, setDate] = useState(today);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);

  const handleParse = () => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const rows: ParsedRow[] = [];
    const failed: string[] = [];

    for (const line of lines) {
      const m = LINE_RE.exec(line);
      if (!m) { failed.push(line); continue; }
      const name = m[1].trim();
      const base = parseNum(m[2]);
      const tip = m[3] ? parseNum(m[3]) : 0;
      if (isNaN(base)) { failed.push(line); continue; }
      rows.push({ id: crypto.randomUUID(), name, price: base + tip, removed: false });
    }

    setParsed(rows);
    setSkipped(failed);
  };

  const handleRemoveRow = (id: string) => {
    setParsed(prev => prev ? prev.map(r => r.id === id ? { ...r, removed: true } : r) : prev);
  };

  const handleConfirm = () => {
    if (!parsed) return;
    const active = parsed.filter(r => !r.removed);
    const projects: Project[] = active.map(r =>
      normalizeProject({
        id: crypto.randomUUID(),
        name: r.name,
        customerName: '',
        customerSource: 'Other',
        paymentMethod: 'Other',
        totalPrice: r.price,
        orderDate: date,
        dueDate: '',
        notes: '',
        printed: true,
        paid: false,
        sent: false,
        shippingDate: '',
        prints: [],
        projectExpenses: [],
        kanbanStatus: 'finished',
      }),
    );
    onImport(projects);
    handleClose();
    toast.success(`${projects.length} project${projects.length === 1 ? '' : 's'} added`);
  };

  const reset = () => { setText(''); setParsed(null); setSkipped([]); };
  const handleClose = () => { onClose(); reset(); };

  const activeRows = parsed ? parsed.filter(r => !r.removed) : [];

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5 text-primary" />
            Quick Add from List
          </DialogTitle>
        </DialogHeader>

        {!parsed ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                Order date{' '}
                <span className="font-normal text-muted-foreground">(applied to all entries)</span>
              </Label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-44"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Paste your list</Label>
              <Textarea
                placeholder={
                  'Coche teledirigido: 17 euros\nFiguras pokemon: 25 euros + 5 euro tip\nLampara escritorio: €32\nWidget holder: 14,50 eur'
                }
                value={text}
                onChange={e => setText(e.target.value)}
                className="min-h-[200px] font-mono text-sm resize-y"
              />
              <p className="text-xs text-muted-foreground">
                One project per line. Format:{' '}
                <code className="bg-muted px-1 rounded text-[11px]">Name: XX euros</code> or{' '}
                <code className="bg-muted px-1 rounded text-[11px]">Name: XX euros + YY euro tip</code>.
                Also accepts <code className="bg-muted px-1 rounded text-[11px]">€XX</code>,{' '}
                <code className="bg-muted px-1 rounded text-[11px]">XX€</code>, or{' '}
                <code className="bg-muted px-1 rounded text-[11px]">eur</code>.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {activeRows.length} project{activeRows.length !== 1 ? 's' : ''} ready to import on{' '}
              <strong>{date}</strong>. Remove any you don't want before confirming.
            </p>

            {activeRows.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs py-2">Name</TableHead>
                      <TableHead className="text-xs py-2 text-right">Price</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeRows.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs py-2 font-medium">{r.name}</TableCell>
                        <TableCell className="text-xs py-2 text-right tabular-nums">
                          €{r.price.toFixed(2)}
                        </TableCell>
                        <TableCell className="py-1 pr-2">
                          <button
                            onClick={() => handleRemoveRow(r.id)}
                            title="Remove this row"
                            className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {skipped.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <p className="font-medium mb-1">
                    {skipped.length} line{skipped.length !== 1 ? 's' : ''} couldn't be parsed and will be skipped:
                  </p>
                  <ul className="space-y-0.5">
                    {skipped.map((l, i) => (
                      <li key={i} className="font-mono truncate opacity-80">{l}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {!parsed ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleParse} disabled={!text.trim()}>
                <ListPlus className="h-4 w-4 mr-1" />
                Parse
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setParsed(null); setSkipped([]); }}>
                Back
              </Button>
              <Button onClick={handleConfirm} disabled={activeRows.length === 0}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Import {activeRows.length} project{activeRows.length !== 1 ? 's' : ''}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
