import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Project, Payment, PaymentMethod } from "@/types";
import { getProjectPiecesTotal, getCurrencySymbol } from "@/types";
import { useApp } from "@/context/AppContext";
import { appToast } from "@/hooks/useToast";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "PayPal", "Bank Transfer", "Bizum", "Other"];

interface Props {
  project: Project;
  open: boolean;
  onClose: () => void;
}

export function RecordPaymentDialog({ project, open, onClose }: Props) {
  const { updateProject, settings } = useApp();
  const currency = getCurrencySymbol(settings.currency);
  const effectiveTotal = getProjectPiecesTotal(project) || project.totalPrice || 0;

  const [amountType, setAmountType] = useState<'fixed' | 'percent'>('fixed');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<PaymentMethod>(project.paymentMethod || 'Other');
  const [note, setNote] = useState('');

  const resolvedAmount = amountType === 'percent'
    ? (parseFloat(amount) || 0) / 100 * effectiveTotal
    : (parseFloat(amount) || 0);

  const record = () => {
    if (resolvedAmount <= 0) return;
    const payment: Payment = {
      id: crypto.randomUUID(),
      amount: resolvedAmount,
      date,
      method,
      notes: note || undefined,
    };
    updateProject({ ...project, payments: [...(project.payments || []), payment] });
    appToast.success(`Payment recorded · ${currency}${resolvedAmount.toFixed(2)}`);
    handleClose();
  };

  const handleClose = () => {
    setAmount('');
    setNote('');
    setAmountType('fixed');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base">Record payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-1.5 block">Amount</Label>
            <div className="flex gap-1 mb-1.5">
              <button
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${amountType === 'fixed' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-accent'}`}
                onClick={() => setAmountType('fixed')}
              >
                {currency} Fixed
              </button>
              <button
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${amountType === 'percent' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-accent'} disabled:opacity-40`}
                onClick={() => setAmountType('percent')}
                disabled={effectiveTotal <= 0}
              >
                % of total
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="flex-1"
              />
              {amountType === 'percent' && effectiveTotal > 0 && (
                <span className="text-xs text-muted-foreground shrink-0">= {currency}{resolvedAmount.toFixed(2)}</span>
              )}
            </div>
          </div>

          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">Method</Label>
            <Select value={method} onValueChange={v => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Input placeholder="Deposit, invoice #…" value={note} onChange={e => setNote(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={record} disabled={resolvedAmount <= 0} className="flex-1">
              Record payment
            </Button>
            <Button size="sm" variant="outline" onClick={handleClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
