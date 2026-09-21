import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useApp } from "@/context/AppContext";
import {
  Project, Print, ProjectExpense, Payment, PaymentMethod, PaymentStatus,
  getProjectTotalPrintTime, getProjectTotalMaterial, getProjectProgress,
  getProjectExpensesTotal, getProjectPiecesTotal, getProjectTotalPieces,
  getProjectEstimatedCost, getProjectEstimatedMargin, getProjectPaymentsTotal,
  getProjectBalance, getProjectPaymentStatus, getPrintDerivedStatus,
  cleanDisplayName, cleanPlateName, getCurrencySymbol,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Plus, Trash2, Copy, BookTemplate, Calendar, Kanban, Receipt,
  RefreshCw, ArrowUp, ArrowDown, Box, X, MoveRight, FileText, Link2, CreditCard,
  Check, Loader2, MoreHorizontal, ChevronDown, Pencil, Minus,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlateImporter } from "@/components/PlateImporter";
import { RecurringBadge } from "@/components/RecurringBadge";
import { ColorPills } from "@/components/ColorPills";
import { PlatePreview } from "@/components/PlatePreview";
import { StatusPill } from "@/components/StatusPill";
import { normalizeMaterial } from "@/lib/normalize";
import { deriveProjectStatus } from "@/lib/projectStatus";
import posthog from "@/lib/posthog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PrintModel } from "@/types";
import { InvoiceModal } from "@/components/InvoicePDF";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENTS_ENABLED } from "@/config/features";

function newPrint(): Print {
  return { id: crypto.randomUUID(), name: "", estimatedPrintTime: 0, materialUsed: 0, printer: "", status: "not-printed", quantity: 1, completedQuantity: 0, color: "", material: "", pricePerPiece: 0 };
}

function newProjectExpense(): ProjectExpense {
  return { id: crypto.randomUUID(), name: "", amount: 0, category: "Other", notes: "" };
}

function newPayment(method: PaymentMethod = "Other"): Payment {
  return { id: crypto.randomUUID(), amount: 0, date: new Date().toISOString().split("T")[0], method };
}

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "PayPal", "Bank Transfer", "Bizum", "Other"];
const SOURCES = ["Wallapop", "Instagram", "Website", "Other"] as const;

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const config = {
    unpaid: { label: 'Unpaid', cls: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 border' },
    partial: { label: 'Partially paid', cls: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 border' },
    paid: { label: 'Paid', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 border' },
  }[status];
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${config.cls}`}>{config.label}</span>;
}

interface Props { project: Project; onBack: () => void; }

export default function ProjectDetail({ project, onBack }: Props) {
  const { updateProject, deleteProject, duplicateProject, settings, templates, addExpense, allPrintNames } = useApp();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showTemplates, setShowTemplates] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [trackingCopied, setTrackingCopied] = useState(false);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState(project.stripePaymentLinkUrl || "");
  const [paymentLinkCopied, setPaymentLinkCopied] = useState(false);
  const [paymentLinkLoading, setPaymentLinkLoading] = useState(false);

  // Section state
  const [detailsEditMode, setDetailsEditMode] = useState(false);
  const [detailsDraft, setDetailsDraft] = useState<Partial<Project>>({});
  const [expandedPlateId, setExpandedPlateId] = useState<string | null>(null);
  const [expandedModelsPlateId, setExpandedModelsPlateId] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState<Payment>(newPayment(project.paymentMethod || "Other"));

  const p = project;
  const save = (updated: Project) => { updateProject(updated); };
  const set = (partial: Partial<Project>) => save({ ...p, ...partial });

  const currencySymbol = getCurrencySymbol(settings.currency);

  // ── Details section ──
  const startEditDetails = () => {
    setDetailsDraft({
      name: p.name,
      customerName: p.customerName,
      customerEmail: p.customerEmail || '',
      customerSource: p.customerSource,
      paymentMethod: p.paymentMethod,
      orderDate: p.orderDate,
      dueDate: p.dueDate || '',
      shippingDate: p.shippingDate || '',
      notes: p.notes || '',
    });
    setDetailsEditMode(true);
  };

  const saveDetails = () => {
    set(detailsDraft);
    setDetailsEditMode(false);
  };

  const cancelDetails = () => setDetailsEditMode(false);

  // ── Plate helpers ──
  const addPrint = () => save({ ...p, prints: [...p.prints, newPrint()] });

  const addFromTemplate = (tmpl: { name: string; estimatedPrintTime: number; materialUsed: number }) => {
    const pr = newPrint();
    pr.name = tmpl.name;
    pr.estimatedPrintTime = tmpl.estimatedPrintTime;
    pr.materialUsed = tmpl.materialUsed;
    save({ ...p, prints: [...p.prints, pr] });
    setShowTemplates(false);
  };

  const updatePrint = (id: string, partial: Partial<Print>) => {
    save({ ...p, prints: p.prints.map(pr => pr.id === id ? { ...pr, ...partial } : pr) });
  };

  const removePrint = (id: string) => save({ ...p, prints: p.prints.filter(pr => pr.id !== id) });

  const duplicatePrint = (id: string) => {
    const pr = p.prints.find(x => x.id === id);
    if (!pr) return;
    const copy = { ...pr, id: crypto.randomUUID(), name: pr.name ? `${pr.name} (copy)` : '', completedQuantity: 0, status: 'not-printed' as const };
    const idx = p.prints.findIndex(x => x.id === id);
    const arr = [...p.prints];
    arr.splice(idx + 1, 0, copy);
    save({ ...p, prints: arr });
  };

  const movePrint = (id: string, dir: -1 | 1) => {
    const idx = p.prints.findIndex(pr => pr.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= p.prints.length) return;
    const arr = [...p.prints];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    save({ ...p, prints: arr });
  };

  const markAllPrinted = () => {
    save({ ...p, prints: p.prints.map(pr => ({ ...pr, completedQuantity: pr.quantity || 1, status: 'completed' as const })) });
  };

  const stepCompleted = (id: string, delta: number) => {
    const pr = p.prints.find(x => x.id === id);
    if (!pr) return;
    const next = Math.min(pr.quantity || 1, Math.max(0, (pr.completedQuantity || 0) + delta));
    updatePrint(id, { completedQuantity: next });
  };

  // ── Model helpers ──
  const addModel = (printId: string) => {
    const m: PrintModel = { id: crypto.randomUUID(), name: "" };
    updatePrint(printId, { models: [...(p.prints.find(pr => pr.id === printId)?.models || []), m] });
  };

  const updateModel = (printId: string, modelId: string, partial: Partial<PrintModel>) => {
    const pr = p.prints.find(x => x.id === printId);
    if (!pr) return;
    updatePrint(printId, { models: (pr.models || []).map(m => m.id === modelId ? { ...m, ...partial } : m) });
  };

  const removeModel = (printId: string, modelId: string) => {
    const pr = p.prints.find(x => x.id === printId);
    if (!pr) return;
    updatePrint(printId, { models: (pr.models || []).filter(m => m.id !== modelId) });
  };

  const moveModel = (fromPrintId: string, modelId: string, toPrintId: string) => {
    if (fromPrintId === toPrintId) return;
    const from = p.prints.find(x => x.id === fromPrintId);
    const to = p.prints.find(x => x.id === toPrintId);
    if (!from || !to) return;
    const model = (from.models || []).find(m => m.id === modelId);
    if (!model) return;
    save({
      ...p,
      prints: p.prints.map(pr => {
        if (pr.id === fromPrintId) return { ...pr, models: (pr.models || []).filter(m => m.id !== modelId) };
        if (pr.id === toPrintId) return { ...pr, models: [...(pr.models || []), model] };
        return pr;
      }),
    });
  };

  // ── Project expenses ──
  const addProjectExpense = () => save({ ...p, projectExpenses: [...(p.projectExpenses || []), newProjectExpense()] });

  const updateProjectExpense = (id: string, partial: Partial<ProjectExpense>) => {
    save({ ...p, projectExpenses: (p.projectExpenses || []).map(e => e.id === id ? { ...e, ...partial } : e) });
  };

  const removeProjectExpense = (id: string) => {
    save({ ...p, projectExpenses: (p.projectExpenses || []).filter(e => e.id !== id) });
  };

  const syncExpenseToGlobal = (pe: ProjectExpense) => {
    addExpense({
      id: crypto.randomUUID(),
      date: p.orderDate || new Date().toISOString().split("T")[0],
      name: pe.name,
      category: 'Project Expense',
      amount: pe.amount,
      notes: `Project: ${p.name}`,
      linkedProject: p.name,
    });
  };

  // ── Payments ──
  const addPaymentRecord = () => {
    if (paymentDraft.amount <= 0) return;
    save({ ...p, payments: [...(p.payments || []), paymentDraft] });
    setPaymentDraft(newPayment(p.paymentMethod || "Other"));
    setShowPaymentForm(false);
  };

  const removePaymentRecord = (id: string) => {
    save({ ...p, payments: (p.payments || []).filter(pay => pay.id !== id) });
  };

  // ── Tracking / Stripe ──
  const copyTrackingLink = () => {
    const url = `${window.location.origin}/track/${p.id}`;
    navigator.clipboard.writeText(url).then(() => {
      localStorage.setItem("pt_checklist_copied_tracking", "true");
      setTrackingCopied(true);
      setTimeout(() => setTrackingCopied(false), 2500);
    });
  };

  const generatePaymentLink = async () => {
    setPaymentLinkLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment-link", {
        body: { projectId: p.id, projectName: p.name, amount: effectiveTotal },
      });
      if (error) throw error;
      if (data?.url) {
        setPaymentLinkUrl(data.url);
        save({ ...p, stripePaymentLinkUrl: data.url, stripePaymentLinkId: data.paymentLinkId });
      }
    } catch (err) {
      console.error("[stripe] payment link error:", err);
      alert("Failed to generate payment link. Check that the create-payment-link edge function is deployed and STRIPE_SECRET_KEY is set.");
    } finally {
      setPaymentLinkLoading(false);
    }
  };

  const copyPaymentLink = () => {
    navigator.clipboard.writeText(paymentLinkUrl).then(() => {
      setPaymentLinkCopied(true);
      setTimeout(() => setPaymentLinkCopied(false), 2500);
    });
  };

  // ── Derived values ──
  const piecesTotal = getProjectPiecesTotal(p);
  const autoCalcTotal = piecesTotal > 0;
  const effectiveTotal = autoCalcTotal ? piecesTotal : (p.totalPrice || 0);
  const totalTime = getProjectTotalPrintTime(p);
  const totalMaterial = getProjectTotalMaterial(p);
  const estimatedCost = getProjectEstimatedCost(p, settings);
  const estimatedMargin = getProjectEstimatedMargin(p, settings);
  const profit = effectiveTotal - estimatedCost;
  const profitMargin = effectiveTotal > 0 ? (profit / effectiveTotal) * 100 : null;
  const progress = getProjectProgress(p);
  const paymentsTotal = getProjectPaymentsTotal(p);
  const balance = getProjectBalance(p);
  const paymentStatus = getProjectPaymentStatus(p);
  const projectStatus = deriveProjectStatus(p);
  const displayName = cleanDisplayName(p.name) || t('projectDetail.untitled');

  const marginColor = profitMargin !== null
    ? (profitMargin >= 60 ? "text-green-600" : profitMargin >= 30 ? "text-yellow-600" : "text-red-600")
    : "text-muted-foreground";

  const allPrinted = p.prints.length > 0 && p.prints.every(pr => (pr.completedQuantity || 0) >= (pr.quantity || 1));

  return (
    <div className="space-y-4 pb-8">
      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PlatePreview
            thumbnail={p.coverThumbnail || p.prints?.[0]?.thumbnail}
            color={(p.prints || []).map(pr => pr.color).filter(Boolean).join(", ") || undefined}
            palette={(p.prints || []).flatMap(pr => pr.colorPalette || [])}
            label={displayName}
            size="sm"
            noHover
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg md:text-xl font-bold truncate">{displayName}</h1>
              <StatusPill status={projectStatus} />
              {p.isRecurringCustomer && <RecurringBadge size="md" />}
            </div>
            <p className="text-sm text-muted-foreground truncate">{p.customerName || <span className="italic">No customer</span>}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <Button size="sm" variant="outline" className="text-xs gap-1 min-h-[36px]" onClick={copyTrackingLink}>
            {trackingCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Link2 className="h-3.5 w-3.5" />}
            {trackingCopied ? "Copied!" : "Tracking link"}
          </Button>
          <Button size="sm" variant="outline" className="text-xs gap-1 min-h-[36px]" onClick={() => {
            if (localStorage.getItem('pt_guest_mode') === 'true') {
              document.dispatchEvent(new CustomEvent('guest-gate', { detail: { message: 'Sign up free to generate and download invoices' } }));
              return;
            }
            setShowInvoice(true);
            posthog.capture('invoice_generated', { customer_source: p.customerSource });
          }}>
            <FileText className="h-3.5 w-3.5" />{t('invoice.generateBtn')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="min-h-[36px] px-2.5">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => { duplicateProject(p.id); posthog.capture('project_duplicated'); onBack(); }}>
                <Copy className="h-3.5 w-3.5 mr-2" />Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/kanban')}>
                <Kanban className="h-3.5 w-3.5 mr-2" />{t('projectDetail.kanban')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/calendar')}>
                <Calendar className="h-3.5 w-3.5 mr-2" />{t('projectDetail.calendar')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/expenses')}>
                <Receipt className="h-3.5 w-3.5 mr-2" />{t('projectDetail.expenses')}
              </DropdownMenuItem>
              {PAYMENTS_ENABLED && (
                <>
                  <DropdownMenuSeparator />
                  {!paymentLinkUrl ? (
                    <DropdownMenuItem onClick={generatePaymentLink} disabled={paymentLinkLoading || effectiveTotal <= 0}>
                      {paymentLinkLoading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <CreditCard className="h-3.5 w-3.5 mr-2" />}
                      Send payment link
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={copyPaymentLink}>
                      {paymentLinkCopied ? <Check className="h-3.5 w-3.5 mr-2 text-green-600" /> : <CreditCard className="h-3.5 w-3.5 mr-2" />}
                      {paymentLinkCopied ? "Copied!" : "Copy payment link"}
                    </DropdownMenuItem>
                  )}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => { deleteProject(p.id); posthog.capture('project_deleted'); onBack(); }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── SUMMARY STRIP ── */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border bg-card px-4 py-3 text-sm">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-muted-foreground">Price</span>
          <span className="font-bold text-primary text-base">
            {currencySymbol}{effectiveTotal.toFixed(2)}
            {autoCalcTotal && <span className="text-[10px] font-normal text-muted-foreground ml-1">from pieces</span>}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <PaymentStatusBadge status={paymentStatus} />
          {balance > 0 && (
            <span className="text-xs text-muted-foreground">{currencySymbol}{balance.toFixed(2)} due</span>
          )}
        </div>
        {progress.totalPieces > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Progress</span>
            <span className="text-xs font-medium">{progress.completedPieces}/{progress.totalPieces} plates</span>
            <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        )}
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-muted-foreground">Est. profit</span>
          {estimatedMargin !== null ? (
            <span className="font-medium">{currencySymbol}{profit.toFixed(2)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-muted-foreground">Est. margin</span>
          {estimatedMargin !== null ? (
            <span className={`font-medium ${marginColor}`}>{estimatedMargin.toFixed(1)}%</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        {p.dueDate && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs text-muted-foreground">Due</span>
            <span className={`text-xs font-medium ${projectStatus === 'overdue' ? 'text-red-600' : ''}`}>{p.dueDate}</span>
          </div>
        )}
      </div>

      {/* ── DETAILS SECTION ── */}
      <Card>
        <CardContent className="p-4">
          {!detailsEditMode ? (
            <div className="space-y-4">
              {/* Customer group */}
              {(p.customerName || p.customerEmail || p.customerSource) && (
                <div>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Customer</h4>
                  <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
                    {p.customerName && <><span className="text-muted-foreground">Name</span><span className="font-medium">{p.customerName}</span></>}
                    {p.customerEmail && <><span className="text-muted-foreground">Email</span><span>{p.customerEmail}</span></>}
                    {p.customerSource && <><span className="text-muted-foreground">Source</span><span>{p.customerSource}</span></>}
                  </div>
                </div>
              )}

              {/* Order group */}
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Order</h4>
                <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
                  {p.orderDate && <><span className="text-muted-foreground">Order date</span><span>{p.orderDate}</span></>}
                  {p.dueDate && <><span className="text-muted-foreground">Due date</span><span>{p.dueDate}</span></>}
                  {p.shippingDate && <><span className="text-muted-foreground">Shipping date</span><span>{p.shippingDate}</span></>}
                  {p.paymentMethod && <><span className="text-muted-foreground">Payment method</span><span>{p.paymentMethod}</span></>}
                </div>
              </div>

              {/* Notes */}
              {p.notes && (
                <div>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Notes</h4>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{p.notes}</p>
                </div>
              )}

              {/* Toggles — live, not inside edit mode */}
              <div className="flex gap-4 flex-wrap pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={p.sent} onCheckedChange={v => set({ sent: !!v })} />
                  <span className="text-sm">{t('projectDetail.sentCheck')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={p.isRecurringCustomer || false} onCheckedChange={v => set({ isRecurringCustomer: !!v })} />
                  <span className="text-sm flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" />{t('projectDetail.recurringCustomer')}
                  </span>
                </label>
              </div>

              <Button size="sm" variant="outline" onClick={startEditDetails} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" />Edit details
              </Button>
            </div>
          ) : (
            /* Edit mode */
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>{t('projectDetail.projectName')}</Label>
                <Input value={detailsDraft.name || ''} onChange={e => setDetailsDraft(d => ({ ...d, name: e.target.value }))} />
              </div>
              <div>
                <Label>{t('projectDetail.customer')}</Label>
                <Input value={detailsDraft.customerName || ''} onChange={e => setDetailsDraft(d => ({ ...d, customerName: e.target.value }))} />
              </div>
              <div>
                <Label>Customer email</Label>
                <Input type="email" value={detailsDraft.customerEmail || ''} onChange={e => setDetailsDraft(d => ({ ...d, customerEmail: e.target.value }))} placeholder="customer@example.com" />
              </div>
              <div>
                <Label>{t('projectDetail.source')}</Label>
                <Select value={detailsDraft.customerSource as string || 'Other'} onValueChange={v => setDetailsDraft(d => ({ ...d, customerSource: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('projectDetail.paymentMethod')}</Label>
                <Select value={detailsDraft.paymentMethod as string || 'Other'} onValueChange={v => setDetailsDraft(d => ({ ...d, paymentMethod: v as PaymentMethod }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('projectDetail.orderDate')}</Label>
                <Input type="date" value={detailsDraft.orderDate || ''} onChange={e => setDetailsDraft(d => ({ ...d, orderDate: e.target.value }))} />
              </div>
              <div>
                <Label>{t('projectDetail.dueDate')}</Label>
                <Input type="date" value={detailsDraft.dueDate || ''} onChange={e => setDetailsDraft(d => ({ ...d, dueDate: e.target.value }))} />
              </div>
              <div>
                <Label>
                  {t('projectDetail.totalPrice')}
                  {autoCalcTotal && <span className="text-xs text-muted-foreground ml-1">{t('projectDetail.autoFromPieces')}</span>}
                </Label>
                <Input
                  type="number" step="0.01"
                  value={autoCalcTotal ? piecesTotal.toFixed(2) : (p.totalPrice || '')}
                  onChange={e => set({ totalPrice: parseFloat(e.target.value) || 0 })}
                  readOnly={autoCalcTotal}
                  className={autoCalcTotal ? "bg-muted" : ""}
                />
              </div>
              <div>
                <Label>{t('projectDetail.shippingDate')}</Label>
                <Input type="date" value={detailsDraft.shippingDate || ''} onChange={e => setDetailsDraft(d => ({ ...d, shippingDate: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>{t('projectDetail.notes')}</Label>
                <Textarea value={detailsDraft.notes || ''} onChange={e => setDetailsDraft(d => ({ ...d, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button onClick={saveDetails}>Save</Button>
                <Button variant="outline" onClick={cancelDetails}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── PAYMENTS SECTION ── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />Payments
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowPaymentForm(v => !v)}>
            <Plus className="h-4 w-4 mr-1" />Add payment
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Summary row */}
          <div className="flex gap-4 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Total price</p>
              <p className="font-bold">{currencySymbol}{effectiveTotal.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Paid</p>
              <p className="font-bold text-emerald-600">{currencySymbol}{paymentsTotal.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Balance due</p>
              <p className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{currencySymbol}{Math.max(0, balance).toFixed(2)}</p>
            </div>
          </div>

          {/* Payment list */}
          {(p.payments || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">No payments recorded</p>
          ) : (
            <div className="space-y-1.5">
              {(p.payments || []).map(pay => (
                <div key={pay.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-medium text-sm">{currencySymbol}{pay.amount.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground">{pay.date}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{pay.method}</Badge>
                    {pay.notes && <span className="text-xs text-muted-foreground truncate">{pay.notes}</span>}
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => removePaymentRecord(pay.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add payment inline form */}
          {showPaymentForm && (
            <div className="grid gap-2 grid-cols-2 rounded-lg border p-3 bg-muted/20">
              <div>
                <Label className="text-xs">Amount</Label>
                <Input type="number" step="0.01" placeholder="0.00"
                  value={paymentDraft.amount || ''}
                  onChange={e => setPaymentDraft(d => ({ ...d, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs">Date</Label>
                <Input type="date" value={paymentDraft.date}
                  onChange={e => setPaymentDraft(d => ({ ...d, date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Method</Label>
                <Select value={paymentDraft.method} onValueChange={v => setPaymentDraft(d => ({ ...d, method: v as PaymentMethod }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Note (optional)</Label>
                <Input placeholder="Deposit, invoice #…"
                  value={paymentDraft.notes || ''}
                  onChange={e => setPaymentDraft(d => ({ ...d, notes: e.target.value }))} />
              </div>
              <div className="col-span-2 flex gap-2">
                <Button size="sm" onClick={addPaymentRecord} disabled={paymentDraft.amount <= 0}>Record payment</Button>
                <Button size="sm" variant="outline" onClick={() => { setShowPaymentForm(false); setPaymentDraft(newPayment(p.paymentMethod || 'Other')); }}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── PLATES SECTION ── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">{t('projectDetail.platesTitle')}</CardTitle>
          <div className="flex gap-1.5">
            {p.prints.length > 0 && !allPrinted && (
              <Button size="sm" variant="outline" className="text-xs" onClick={markAllPrinted}>
                <Check className="h-3.5 w-3.5 mr-1" />Mark all printed
              </Button>
            )}
            {templates.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setShowTemplates(true)}>
                <BookTemplate className="h-4 w-4 mr-1" />{t('projectDetail.fromTemplate')}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={addPrint}><Plus className="h-4 w-4 mr-1" />{t('projectDetail.addPlate')}</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Import dropzone — compact when plates exist */}
          <div className={p.prints.length > 0 ? "mb-2" : "mb-4"}>
            <PlateImporter project={p} compact={p.prints.length > 0} />
          </div>

          {p.prints.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">{t('projectDetail.noPlatesYet')}</p>}

          {p.prints.map((pr, idx) => {
            const printStatus = getPrintDerivedStatus(pr);
            const isExpanded = expandedPlateId === pr.id;
            const modelsExpanded = expandedModelsPlateId === pr.id;
            const models = pr.models || [];
            const otherPlates = p.prints.filter(x => x.id !== pr.id);
            const pieceTotal = (pr.pricePerPiece || 0) * (pr.quantity || 1);
            const cleanName = cleanPlateName(pr.name, idx, models);

            return (
              <div key={pr.id} className="rounded-lg border bg-muted/20 overflow-hidden">
                {/* Compact row */}
                <div
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setExpandedPlateId(isExpanded ? null : pr.id)}
                >
                  <PlatePreview
                    thumbnail={pr.thumbnail}
                    color={pr.color}
                    palette={pr.colorPalette}
                    label={cleanName}
                    size="sm"
                    noHover
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
                      <span className="text-sm font-medium truncate">{cleanName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                      {pr.material && <span>{normalizeMaterial(pr.material)}</span>}
                      <ColorPills color={pr.color} palette={pr.colorPalette} material={normalizeMaterial(pr.material)} size="xs" showLabel={false} />
                      {pr.estimatedPrintTime > 0 && <span>⏱ {pr.estimatedPrintTime}h</span>}
                      {pr.materialUsed > 0 && <span>⚖ {pr.materialUsed}g</span>}
                      <span className={printStatus.done ? 'text-emerald-600 font-medium' : printStatus.partial ? 'text-yellow-600' : ''}>
                        {printStatus.label}
                      </span>
                    </div>
                  </div>
                  {/* +/- stepper */}
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 rounded-full"
                      onClick={() => stepCompleted(pr.id, -1)}
                      disabled={(pr.completedQuantity || 0) <= 0}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-xs font-medium w-10 text-center">{pr.completedQuantity || 0}/{pr.quantity}</span>
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 rounded-full"
                      onClick={() => stepCompleted(pr.id, 1)}
                      disabled={(pr.completedQuantity || 0) >= (pr.quantity || 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    {!printStatus.done && (
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 text-[10px] px-2 text-emerald-600 hover:text-emerald-700"
                        onClick={(e) => { e.stopPropagation(); updatePrint(pr.id, { completedQuantity: pr.quantity || 1 }); }}
                      >
                        ✓ Done
                      </Button>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Expanded edit form */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-2 border-t space-y-3 bg-card">
                    <div className="flex items-center gap-1 flex-wrap -mb-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={() => movePrint(pr.id, -1)} title={t('projectDetail.moveUp')}><ArrowUp className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === p.prints.length - 1} onClick={() => movePrint(pr.id, 1)} title={t('projectDetail.moveDown')}><ArrowDown className="h-3 w-3" /></Button>
                      <span className="text-[10px] text-muted-foreground ml-1">#{idx + 1}</span>
                      <div className="flex-1" />
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Duplicate" onClick={() => duplicatePrint(pr.id)}><Copy className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive h-7 w-7" onClick={() => removePrint(pr.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>

                    <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                      <div className="col-span-2 md:col-span-2">
                        <Label className="text-xs">{t('projectDetail.platePieceName')}</Label>
                        <Input value={pr.name} onChange={e => updatePrint(pr.id, { name: e.target.value })} list={`names-${pr.id}`} placeholder="e.g. Plate 1 / Gear Housing" />
                        <datalist id={`names-${pr.id}`}>{allPrintNames.map(n => <option key={n} value={n} />)}</datalist>
                      </div>
                      <div><Label className="text-xs">{t('projectDetail.materialField')}</Label><Input value={pr.material || ""} onChange={e => updatePrint(pr.id, { material: e.target.value })} placeholder="PLA, PETG…" /></div>
                      <div><Label className="text-xs">{t('projectDetail.color')}</Label><Input value={pr.color || ""} onChange={e => updatePrint(pr.id, { color: e.target.value })} placeholder="Black, White…" /></div>
                    </div>

                    <div className="grid gap-2 grid-cols-2 md:grid-cols-5">
                      <div><Label className="text-xs">{t('projectDetail.qty')}</Label><Input type="number" min="1" value={pr.quantity || 1} onChange={e => updatePrint(pr.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
                      <div><Label className="text-xs">{t('projectDetail.printTimeH')}</Label><Input type="number" step="0.1" value={pr.estimatedPrintTime || ""} onChange={e => updatePrint(pr.id, { estimatedPrintTime: parseFloat(e.target.value) || 0 })} /></div>
                      <div><Label className="text-xs">{t('projectDetail.materialG')}</Label><Input type="number" value={pr.materialUsed || ""} onChange={e => updatePrint(pr.id, { materialUsed: parseFloat(e.target.value) || 0 })} /></div>
                      <div><Label className="text-xs">{t('projectDetail.pricePerPiece')}</Label><Input type="number" step="0.01" value={pr.pricePerPiece || ""} onChange={e => updatePrint(pr.id, { pricePerPiece: parseFloat(e.target.value) || 0 })} /></div>
                      <div><Label className="text-xs">Done</Label><Input type="number" min="0" max={pr.quantity || 1} value={pr.completedQuantity || 0} onChange={e => updatePrint(pr.id, { completedQuantity: Math.min(pr.quantity || 1, Math.max(0, parseInt(e.target.value) || 0)) })} /></div>
                    </div>

                    {pieceTotal > 0 && (
                      <div className="text-xs text-muted-foreground text-right">
                        {t('projectDetail.subtotal')} <span className="font-medium text-foreground">{currencySymbol}{pieceTotal.toFixed(2)}</span>
                        {(pr.quantity || 1) > 1 && <span className="ml-1">({pr.quantity} × {currencySymbol}{(pr.pricePerPiece || 0).toFixed(2)})</span>}
                      </div>
                    )}

                    {/* Models section — collapsed by default */}
                    <div className="border-t pt-2">
                      <button
                        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
                        onClick={() => setExpandedModelsPlateId(modelsExpanded ? null : pr.id)}
                      >
                        <Box className="h-3 w-3" />
                        {t('projectDetail.models')} ({models.length})
                        <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${modelsExpanded ? 'rotate-180' : ''}`} />
                        <span className="flex-1" />
                        <span
                          className="text-primary hover:underline"
                          onClick={(e) => { e.stopPropagation(); setExpandedModelsPlateId(pr.id); addModel(pr.id); }}
                        >+ {t('projectDetail.addModel')}</span>
                      </button>

                      {modelsExpanded && (
                        <div className="mt-2 space-y-1">
                          {models.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground/70 italic">{t('projectDetail.noModels')}</p>
                          ) : models.map(m => (
                            <div key={m.id} className="flex items-center gap-1.5 text-xs">
                              <Box className="h-3 w-3 text-muted-foreground shrink-0" />
                              <Input value={m.name} onChange={e => updateModel(pr.id, m.id, { name: e.target.value })} placeholder={t('projectDetail.modelName')} className="h-7 text-xs" />
                              <Input value={m.material || ""} onChange={e => updateModel(pr.id, m.id, { material: e.target.value })} placeholder={t('projectDetail.modelMat')} className="h-7 text-xs w-20" />
                              <ColorPills color={m.color || pr.color} palette={pr.colorPalette} material={normalizeMaterial(m.material || pr.material)} size="xs" showLabel={false} className="shrink-0" />
                              {otherPlates.length > 0 && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Move to plate"><MoveRight className="h-3 w-3" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {otherPlates.map(op => (
                                      <DropdownMenuItem key={op.id} onClick={() => moveModel(pr.id, m.id, op.id)}>
                                        {t('projectDetail.moveToPlate', { name: op.name || 'plate' })}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeModel(pr.id, m.id)}><X className="h-3 w-3" /></Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── PROJECT EXPENSES ── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">{t('projectDetail.projectExpenses')}</CardTitle>
          <Button size="sm" variant="outline" onClick={addProjectExpense}><Plus className="h-4 w-4 mr-1" />{t('projectDetail.addExpense')}</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(p.projectExpenses || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{t('projectDetail.noProjectExpenses')}</p>}
          {(p.projectExpenses || []).map(pe => (
            <div key={pe.id} className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-5 items-end p-3 rounded-lg border bg-muted/30">
              <div><Label className="text-xs">{t('projectDetail.expName')}</Label><Input value={pe.name} onChange={e => updateProjectExpense(pe.id, { name: e.target.value })} /></div>
              <div><Label className="text-xs">{t('projectDetail.expAmount')}</Label><Input type="number" step="0.01" value={pe.amount || ""} onChange={e => updateProjectExpense(pe.id, { amount: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label className="text-xs">{t('projectDetail.expCategory')}</Label><Input value={pe.category} onChange={e => updateProjectExpense(pe.id, { category: e.target.value })} placeholder={t('projectDetail.hardwareCategory')} /></div>
              <div><Label className="text-xs">{t('projectDetail.expNotes')}</Label><Input value={pe.notes} onChange={e => updateProjectExpense(pe.id, { notes: e.target.value })} /></div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => syncExpenseToGlobal(pe)}>{t('projectDetail.syncGlobal')}</Button>
                <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => removeProjectExpense(pe.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <InvoiceModal open={showInvoice} onClose={() => setShowInvoice(false)} project={p} settings={settings} />

      {/* Template picker dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('projectDetail.insertFromTemplate')}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {templates.map(tmpl => (
              <Card key={tmpl.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => addFromTemplate(tmpl)}>
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{tmpl.name}</p>
                  <p className="text-xs text-muted-foreground">{tmpl.estimatedPrintTime}h · {tmpl.materialUsed}g</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
