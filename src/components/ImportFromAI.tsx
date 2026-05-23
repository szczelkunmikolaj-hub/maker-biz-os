import { useState } from 'react';
import { Project, normalizeProject } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Wand2, CheckCircle2, KeyRound, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';

const API_KEY_LS = 'pt_anthropic_key';
const MODEL = 'claude-sonnet-4-20250514';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (projects: Project[]) => void;
}

export function ImportFromAI({ open, onClose, onImport }: Props) {
  const toast = useToast();
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Project[] | null>(null);

  const storedKey = () => localStorage.getItem(API_KEY_LS) || '';

  const saveKey = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    localStorage.setItem(API_KEY_LS, trimmed);
    toast.success(t('importAI.keySaved'));
  };

  const handleExtract = async () => {
    const key = storedKey() || apiKey.trim();
    if (!key) { setError(t('importAI.noKeyError')); return; }
    if (!text.trim()) { setError(t('importAI.noTextError')); return; }
    setError(null);
    setLoading(true);

    const today = new Date().toISOString().slice(0, 10);
    const prompt = `You are a data extraction assistant for a 3D printing business management app.

The user pasted text that may contain project/order data (spreadsheet, notes, messages, emails, any format).

Extract all projects or orders you can find and return them as a JSON array. Each object uses only these fields (all optional except name):
- name: string (project or order name/description)
- customerName: string
- totalPrice: number (numeric only, no currency symbols)
- orderDate: string (YYYY-MM-DD; today is ${today}, resolve relative dates like "yesterday" or "Friday")
- dueDate: string (YYYY-MM-DD)
- notes: string
- paid: boolean
- printed: boolean
- sent: boolean

Rules:
- Return ONLY a valid JSON array, no markdown fences, no explanation
- If no projects found return []
- Merge related lines describing the same order into one object

Text:
${text.trim()}`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error?.message || `API error ${resp.status}`);
      }

      const data = await resp.json();
      const raw = data.content?.[0]?.text || '';

      // Strip optional markdown code fences then parse
      const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (!match) throw new Error(t('importAI.parseError'));

      const arr: any[] = JSON.parse(match[0]);
      if (!Array.isArray(arr)) throw new Error(t('importAI.parseError'));

      const projects = arr
        .filter(r => r && String(r.name || '').trim())
        .map(r => normalizeProject({
          id: crypto.randomUUID(),
          name: String(r.name || '').trim(),
          customerName: String(r.customerName || '').trim(),
          customerSource: 'Other',
          paymentMethod: 'Other',
          totalPrice: parseFloat(String(r.totalPrice ?? 0)) || 0,
          orderDate: String(r.orderDate || today),
          dueDate: String(r.dueDate || ''),
          notes: String(r.notes || '').trim(),
          printed: !!r.printed,
          paid: !!r.paid,
          sent: !!r.sent,
          shippingDate: '',
          prints: [],
          projectExpenses: [],
          kanbanStatus: 'new-order',
        }));

      if (!projects.length) { setError(t('importAI.noProjectsFound')); return; }
      setPreview(projects);
    } catch (e: any) {
      setError(e.message || t('common.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!preview) return;
    onImport(preview);
    handleClose();
    toast.success(t('importAI.importSuccess', { count: preview.length }));
  };

  const reset = () => { setText(''); setPreview(null); setError(null); setApiKey(''); };
  const handleClose = () => { onClose(); reset(); };

  const hasKey = !!storedKey();

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            {t('importAI.title')}
          </DialogTitle>
        </DialogHeader>

        {!hasKey && (
          <Alert>
            <KeyRound className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <p className="text-sm">{t('importAI.apiKeyRequired')}</p>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="sk-ant-..."
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="h-8 text-sm"
                  onKeyDown={e => e.key === 'Enter' && saveKey()}
                />
                <Button size="sm" onClick={saveKey} disabled={!apiKey.trim()}>
                  {t('importAI.saveKey')}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!preview ? (
          <div className="space-y-2">
            <Label>{t('importAI.pasteLabel')}</Label>
            <Textarea
              placeholder={t('importAI.pastePlaceholder')}
              value={text}
              onChange={e => setText(e.target.value)}
              className="min-h-[200px] font-mono text-sm resize-y"
            />
            <p className="text-xs text-muted-foreground">{t('importAI.hint')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('importAI.foundProjects', { count: preview.length })}
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-2">{t('common.name')}</TableHead>
                    <TableHead className="text-xs py-2">{t('projects.customerName')}</TableHead>
                    <TableHead className="text-xs py-2">{t('expenses.amount')}</TableHead>
                    <TableHead className="text-xs py-2">{t('common.date')}</TableHead>
                    <TableHead className="text-xs py-2">{t('common.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs py-2 font-medium">{p.name}</TableCell>
                      <TableCell className="text-xs py-2">{p.customerName || '—'}</TableCell>
                      <TableCell className="text-xs py-2">{p.totalPrice > 0 ? `€${p.totalPrice}` : '—'}</TableCell>
                      <TableCell className="text-xs py-2">{p.orderDate}</TableCell>
                      <TableCell className="text-xs py-2">
                        {[p.paid && 'paid', p.printed && 'printed', p.sent && 'sent'].filter(Boolean).join(', ') || 'new'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2">
          {!preview ? (
            <>
              <Button variant="outline" onClick={handleClose}>{t('common.cancel')}</Button>
              <Button onClick={handleExtract} disabled={loading || !text.trim()}>
                {loading
                  ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />{t('importAI.extracting')}</>
                  : <><Wand2 className="h-4 w-4 mr-1" />{t('importAI.extractBtn')}</>
                }
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setPreview(null)}>{t('common.back')}</Button>
              <Button onClick={handleConfirm}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {t('importAI.confirmBtn', { count: preview.length })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
